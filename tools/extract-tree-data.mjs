#!/usr/bin/env node
// extract-tree-data.mjs — generates the website's anatomy Tree View data
// (web/site/src/components/anatomy/tree/*-tree.js) from REAL Kiln output,
// never hand-typed CSS. Runs the same emitCSS(opts, writeStream) entry
// point builder/build.mjs uses, against a tiny synthetic cart, and slices
// real rows out of the real generated text.
//
// ONE node model powers the whole tree (TreeAst.svelte renders all of it):
//   section "AX" / "Registers" — editorial label, no code. The only
//           editorial invention in the tree: the CSS itself doesn't group
//           a register's @property with its dispatch.
//   block   a verbatim multi-line exhibit (@property/@function/alias),
//           folds to its first line.
//   decl    "--REG:" — the register declaration; one child, its if.
//   if      "if(" (or "calc(if(" for IP's prefixLen wrap) — one child per
//           branch, in source order; `trailer` is the real closing text
//           (")", ");", ") + var(--prefixLen))" ...).
//   branch  "style(cond):" or "else:" — one child: a leaf `value`, or an
//           `if` when the branch's value itself branches. `comment` holds
//           the row's own trailing "/* ... */" (Kiln emits it after the
//           row's ';').
//   value   a plain leaf expression, ';' included when the source had one.
// Nothing is collapsed or re-nested at the DATA level — a node's `code`
// is only its own token, never text that belongs to a child. TreeAst.svelte
// may render single-child chains on one visual line (when they fit a line
// budget); that is display logic, not a change to the tree.
//
// COLLAPSING is data-carved: `folded: true` marks a node's INITIAL state;
// every node with hidden content is click-togglable regardless. The cpu
// recipe folds: all sections, every @property block, and every opcode row
// whose value is a nested if (so the ~99-232-row lists scan as one line
// per row — "[+] style(--opcode: 0): … /* ADD r/m8, reg8 → AX */" — and
// expand on demand).
//
// SELF-CHECK: after parsing, each register's AST is reconstructed and
// compared (whitespace-stripped) against the raw sliced text. Any dropped
// or misattached character — the historical failure mode here, twice —
// fails the generation loudly instead of shipping a silently-wrong tree.
//
// Usage: node tools/extract-tree-data.mjs cpu > \
//   web/site/src/components/anatomy/tree/cpu-tree.js
// Only "cpu" is implemented; the other 9 file sections (memory/disk/
// clock/...) need their own extraction recipe per section (see the survey
// referenced in the logbook) — captureRealCSS()/parseIf() generalise, but
// each section's own dispatch shape still needs its own parser.

import { emitCSS } from '../kiln/emit-css.mjs';

// A tiny synthetic cart: a 6-byte program at 0x100 (enough for emitCSS's
// address-set builder to run for real), no BIOS/disk. Real emitter logic,
// fake-small input — the technique verified across all 10 file sections.
const SYNTHETIC_OPTS = {
  memoryZones: [[0x100, 0x106]],
  programBytes: new Uint8Array([0xb8, 0x05, 0x00, 0xcd, 0x20, 0x00]), // MOV AX,5; INT 0x20
  biosBytes: new Uint8Array(0),
  embeddedData: [],
  programOffset: 0x100,
  initialCS: 0,
  initialIP: 0x100,
  diskBytes: null,
  writableDisk: null,
  header: null,
};

function captureRealCSS(opts = SYNTHETIC_OPTS) {
  const chunks = [];
  const fakeStream = { write: (s) => { chunks.push(s); return true; } };
  emitCSS(opts, fakeStream);
  return chunks.join('');
}

// ---------------------------------------------------------------------------
// Scanning primitives — all comment-aware. Comments can contain parens
// ("/* HLT (IP unchanged) */") and must never affect depth tracking.

// If text[i] starts a "/* ... */" comment, returns the index just past its
// "*/"; otherwise returns i unchanged.
function skipComment(text, i) {
  if (text[i] === '/' && text[i + 1] === '*') {
    const end = text.indexOf('*/', i + 2);
    return end === -1 ? text.length : end + 2;
  }
  return i;
}

// Index of the ')' matching the '(' at openIndex.
function matchParen(text, openIndex) {
  let depth = 1;
  for (let i = openIndex + 1; i < text.length; ) {
    const skipped = skipComment(text, i);
    if (skipped !== i) { i = skipped; continue; }
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i;
    i++;
  }
  throw new Error(`unbalanced parens from index ${openIndex}: ${text.slice(openIndex, openIndex + 60)}...`);
}

// Splits an if(...)'s inner body into its top-level ';'-separated branches.
// Each branch keeps its own ';' AND its own trailing "/* comment */" (Kiln
// emits the comment after the ';', so a naive cut hands it to the NEXT
// branch — the comment-bleed bug this parser has now regrown twice; the
// lookahead here is the permanent fix, guarded by the round-trip check).
function splitTopLevel(body) {
  const parts = [];
  let start = 0;
  let depth = 0;
  for (let j = 0; j < body.length; ) {
    const skipped = skipComment(body, j);
    if (skipped !== j) { j = skipped; continue; }
    const c = body[j];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth === 0) {
      let end = j + 1;
      const m = body.slice(end).match(/^[ \t]*\/\*[\s\S]*?\*\//);
      if (m) end += m[0].length;
      parts.push(body.slice(start, end));
      start = end;
      j = end;
      continue;
    }
    j++;
  }
  const last = body.slice(start);
  if (last.trim()) parts.push(last);
  return parts;
}

// First ':' at paren-depth 0 (the branch's own "cond: value" separator —
// colons inside style(...) conditions sit at depth 1 and don't match).
function topLevelColon(text) {
  let depth = 0;
  for (let j = 0; j < text.length; ) {
    const skipped = skipComment(text, j);
    if (skipped !== j) { j = skipped; continue; }
    const c = text[j];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ':' && depth === 0) return j;
    j++;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// The AST parser.

// Parses text beginning with "if(" (or "calc(if(") into an `if` node.
// `trailer` is everything from the if's own ')' to the end of the given
// text — for a plain branch value that's ");" (+ nothing, the comment was
// already peeled to the branch), for IP's calc wrap it's
// ") + var(--prefixLen))", for the register root it's ");". Keeping the
// trailer ON the node means the renderer can close the block visually at
// the right indent, and the round-trip check can prove no text was lost.
function parseIf(text) {
  const calcWrap = text.startsWith('calc(if(');
  const ifStart = text.indexOf('if(');
  const closeIdx = matchParen(text, ifStart + 2);
  const body = text.slice(ifStart + 3, closeIdx);
  const trailer = text.slice(closeIdx); // ')' inclusive, through end

  const children = splitTopLevel(body).flatMap((branchText) => {
    const nodes = [];
    let t = branchText.trim();
    // Standalone comments BETWEEN branches (own-line — a same-line
    // trailing comment was already attached to the previous chunk by
    // splitTopLevel's lookahead) become their own block nodes: real file
    // content in place, and run delimiters for the renderer's
    // per-run pagination (see TreeAst) — so a comment Kiln plants at a
    // type boundary in a long branch list stays visible instead of
    // drowning behind "(N more…)".
    while (t.startsWith('/*')) {
      const end = t.indexOf('*/') + 2;
      nodes.push({ kind: 'block', code: t.slice(0, end) });
      t = t.slice(end).trim();
    }
    if (!t) return nodes;
    // Peel the row's own trailing comment (already guaranteed by
    // splitTopLevel to be THIS row's) into the branch node.
    let comment = null;
    const cm = t.match(/\s*(\/\*[\s\S]*?\*\/)$/);
    if (cm) {
      comment = cm[1];
      t = t.slice(0, t.length - cm[0].length);
    }
    const colonAt = topLevelColon(t);
    if (colonAt === -1) throw new Error(`branch without top-level ':': ${t.slice(0, 60)}...`);
    const condText = t.slice(0, colonAt + 1).trim(); // "style(...):" / "else:"
    const valueText = t.slice(colonAt + 1).trim();

    const child = (valueText.startsWith('if(') || valueText.startsWith('calc(if('))
      ? parseIf(valueText)
      : { kind: 'value', code: valueText };

    const branch = { kind: 'branch', code: condText, children: [child] };
    if (comment) branch.comment = comment;
    nodes.push(branch);
    return nodes;
  });

  return { kind: 'if', code: calcWrap ? 'calc(if(' : 'if(', children, trailer };
}

// Parses the ENTIRE `.cpu { ... }` rule body — every declaration and
// comment, in file order, nothing hand-picked (the alias list and the
// flag-function exhibit both went stale because they were hand-kept;
// this doesn't). Each ';'-terminated chunk yields: leading "/* ... */"
// comments, then the declaration — a folded `decl` AST when its value
// branches (if(...) / calc(if(...)), a plain one-line block otherwise.
//
// GROUPING comes from the file itself, not editorial invention: Kiln
// delimits the rule's regions with TWO levels of banner comment —
// `/* ===== NAME ===== */` majors (FETCH & DECODE, REGISTERS, MEMORY
// WRITE SLOTS) and `/* --- name --- */` subs (instruction fetch, prefix
// detection, register aliases, ...). Each banner opens a `section` node
// — the banner's text is the node's `code` (so the round-trip check
// still covers it) and its cleaned title is the label; everything until
// the next banner at its level nests inside. Smaller `/* note */`
// comments stay inline where they are. Better banners in Kiln
// automatically become better groups here.
function parseCpuRule(css) {
  const ruleStart = css.indexOf('.cpu {');
  if (ruleStart === -1) throw new Error('.cpu rule not found');
  const bodyStart = ruleStart + '.cpu {'.length;
  const bodyEnd = css.indexOf('\n}', bodyStart);
  const body = css.slice(bodyStart, bodyEnd);
  // The rule's real size in the cabinet ('.cpu {' through its '}') — the
  // header shows this so a reader knows how much file this block is.
  const bytes = bodyEnd + 2 - ruleStart;

  const groups = [];
  let major = null;
  let sub = null;
  const openMajor = (comment, title) => {
    major = { kind: 'section', label: title, code: comment, folded: true, children: [] };
    sub = null;
    groups.push(major);
  };
  const openSub = (comment, title) => {
    if (!major) openMajor('', '(preamble)');
    sub = { kind: 'section', label: title, code: comment, folded: true, children: [] };
    major.children.push(sub);
  };
  const push = (node) => {
    if (!major) openMajor('', '(preamble)'); // safety net; real body always leads with a banner
    (sub ?? major).children.push(node);
  };

  for (const rawChunk of splitTopLevel(body)) {
    let chunk = rawChunk.trim();
    while (chunk.startsWith('/*')) {
      const end = chunk.indexOf('*/') + 2;
      const comment = chunk.slice(0, end);
      chunk = chunk.slice(end).trim();
      const majorBanner = comment.match(/^\/\* =+ (.+?) =+ \*\/$/);
      const subBanner = comment.match(/^\/\* -+ (.+?) -+ \*\/$/);
      if (majorBanner) {
        openMajor(comment, majorBanner[1].trim());
      } else if (subBanner) {
        openSub(comment, subBanner[1].trim());
      } else if (major == null) {
        // A pre-banner preamble: its leading plain comment is the label.
        openMajor(comment, comment.replace(/^\/\*\s*|\s*\*\/$/g, ''));
      } else {
        push({ kind: 'block', code: comment });
      }
    }
    if (!chunk) continue;
    const m = chunk.match(/^(--[\w-]+):/);
    if (!m) throw new Error(`unparsed .cpu chunk: ${chunk.slice(0, 60)}...`);
    const value = chunk.slice(m[0].length).trim();
    if (value.startsWith('if(') || value.startsWith('calc(if(')) {
      push({ kind: 'decl', code: m[0], children: [parseIf(value)] });
    } else {
      push({ kind: 'block', code: chunk });
    }
  }
  return { groups, body, bytes };
}

// ---------------------------------------------------------------------------
// The self-check: concatenating every token/comment/trailer in tree order
// must reproduce the raw sliced text exactly, modulo whitespace. Any
// parser bug that drops or misattaches text fails here, at generation
// time, instead of shipping a silently-wrong tree to the site.
function reconstruct(node) {
  let s = node.code ?? '';
  for (const c of node.children ?? []) s += ' ' + reconstruct(c);
  if (node.trailer) s += node.trailer;
  if (node.comment) s += ' ' + node.comment;
  return s;
}

function assertRoundTrip(declNode, raw, reg) {
  const strip = (s) => s.replace(/\s+/g, '');
  const rebuilt = strip(reconstruct(declNode));
  const original = strip(raw);
  if (rebuilt !== original) {
    // Find the first divergence for a useful error message.
    let i = 0;
    while (i < rebuilt.length && i < original.length && rebuilt[i] === original[i]) i++;
    throw new Error(
      `--${reg}: AST does not round-trip to the raw CSS (diverges at stripped index ${i}):\n` +
      `  raw:     ...${original.slice(Math.max(0, i - 30), i + 30)}...\n` +
      `  rebuilt: ...${rebuilt.slice(Math.max(0, i - 30), i + 30)}...`
    );
  }
}

// ---------------------------------------------------------------------------
// Verbatim slicing of non-dispatch exhibits.

// Extracts one real `@property --NAME { ... }` block verbatim.
function extractPropertyBlock(css, name) {
  const marker = `@property --${name} {`;
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`@property --${name} not found`);
  return css.slice(start, css.indexOf('\n}', start) + 2);
}

// Extracts one real `@function --NAME(...) { ... }` block verbatim.
function extractFunctionBlock(css, name) {
  const marker = `@function --${name}(`;
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`@function --${name} not found`);
  return css.slice(start, css.indexOf('\n}', start) + 2);
}

// A JS template literal embedding real CSS verbatim — escapes backtick/${,
// never alters content.
function jsTemplateLiteral(s) {
  return `\`${s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``;
}

// ---------------------------------------------------------------------------
// Generation.

const CPU_REGS = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI',
                  'CS', 'DS', 'ES', 'SS', 'IP', 'flags'];

// Serializes an AST node as a JS object literal, token strings inlined as
// template literals (they're short — one token each).
function serializeNode(node, indent) {
  const pad = '  '.repeat(indent);
  const props = [`kind: '${node.kind}'`];
  if (node.label != null) props.push(`label: ${JSON.stringify(node.label)}`);
  if (node.code != null) props.push(`code: ${jsTemplateLiteral(node.code)}`);
  if (node.comment) props.push(`comment: ${jsTemplateLiteral(node.comment)}`);
  if (node.trailer) props.push(`trailer: ${jsTemplateLiteral(node.trailer)}`);
  if (node.folded != null) props.push(`folded: ${node.folded}`);
  if (node.boxed) props.push(`boxed: true`);
  if (!node.children || node.children.length === 0) {
    return `${pad}{ ${props.join(', ')} }`;
  }
  const childExprs = node.children.map((c) => serializeNode(c, indent + 1));
  return `${pad}{\n${pad}  ${props.join(`,\n${pad}  `)},\n${pad}  children: [\n${childExprs.join(',\n')},\n${pad}  ],\n${pad}}`;
}

// Carves the fold points into one register's AST: the decl itself (the
// register-level collapse — "[+] --AX: …") and every opcode row whose
// value is a nested if (so the long lists scan as one line per row).
// Only nodes carved here are togglable at all — TreeAst renders
// everything else as plain, always-visible code.
function carveFolds(decl) {
  decl.folded = true;
  const dispatchIf = decl.children[0];
  const elseBranch = dispatchIf.children.find((b) => b.code === 'else:');
  const inner = elseBranch?.children[0];
  if (inner?.kind === 'if') {
    for (const b of inner.children) {
      if (b.code.startsWith('style(--opcode:') && b.children[0]?.kind === 'if') {
        b.folded = true;
      }
    }
  }
}

// Per-banner display curation: 'fold' = collapsible region (starts
// closed), 'label' = flat header whose contents stay visible (no
// toggle). Banners not listed default to 'fold'. Hand-curated — tiny
// regions read better flat. Applies to both banner levels.
const CPU_BANNER_STYLE = {
  'unknown opcode flag': 'label',
};

function generateCpuTree() {
  const css = captureRealCSS();

  // The whole .cpu rule — every declaration + comment, file order,
  // grouped by Kiln's own two-level banner comments.
  const { groups, body: cpuBody, bytes: cpuBytes } = parseCpuRule(css);
  const allSections = groups.flatMap((g) => [g, ...g.children.filter((n) => n.kind === 'section')]);
  const declNodes = allSections.flatMap((s) => s.children.filter((n) => n.kind === 'decl'));
  for (const decl of declNodes) carveFolds(decl);
  for (const s of allSections) {
    if (CPU_BANNER_STYLE[s.label] === 'label') delete s.folded;
  }
  // Round-trip the ENTIRE rule body: concatenating every parsed node must
  // reproduce it (whitespace-stripped) — nothing dropped, nothing moved.
  assertRoundTrip({ code: '', children: groups }, cpuBody, 'cpu-rule');
  // Sanity: every register dispatch must be among the parsed decls.
  for (const reg of CPU_REGS) {
    if (!declNodes.some((n) => n.code === `--${reg}:`)) {
      throw new Error(`--${reg}: dispatch missing from parsed .cpu rule`);
    }
  }
  console.error(`  .cpu rule: ${groups.length} major regions, ${declNodes.length} branching decls, round-trip OK`);
  for (const g of groups) {
    const subs = g.children.filter((n) => n.kind === 'section');
    console.error(`    ${g.label}: ${subs.length ? subs.map((s) => `${s.label} (${s.children.length})`).join(', ') : `${g.children.length} entries`}`);
  }

  // The flag-arithmetic @function cluster — discovered by scanning the
  // real file (not a hand-kept list, so new helpers can't silently go
  // missing): every @function whose name ends in Flags16/8, FlagsN16/8,
  // or OF16/8, in file order. A contiguous region of the cabinet
  // (addOF16 … sarFlagsN8); 36 functions as of 2026-07-10.
  const flagFnNames = [...css.matchAll(/@function --([\w-]+)\(/g)]
    .map((m) => m[1])
    .filter((n) => /(FlagsN?(8|16)|OF(8|16))$/.test(n));
  if (flagFnNames.length < 30) {
    throw new Error(`flag-function scan looks wrong: only found ${flagFnNames.length} (${flagFnNames.join(', ')})`);
  }
  console.error(`  flag-arithmetic @functions: ${flagFnNames.length} found`);

  const lines = [];
  lines.push(`// cpu-tree.js — GENERATED by tools/extract-tree-data.mjs. Do not hand-edit.`);
  lines.push(`// Every code string below is real, verbatim cabinet CSS produced by`);
  lines.push(`// calling kiln/emit-css.mjs's real emitCSS() against a tiny synthetic`);
  lines.push(`// cart (same technique the real builder uses, tiny input) — never typed`);
  lines.push(`// by hand, and round-trip-verified against the raw generated text at`);
  lines.push(`// generation time. Regenerate: node tools/extract-tree-data.mjs cpu > \\`);
  lines.push(`//   web/site/src/components/anatomy/tree/cpu-tree.js`);
  lines.push(`// The top-level layout mirrors the REAL file order (nothing is`);
  lines.push(`// reordered, only curated): the flag @function cluster first, then`);
  lines.push(`// the COMPLETE .cpu rule (every declaration and banner comment, in`);
  lines.push(`// order — aliases, fetch/decode, ModR/M, EA, precomputed operands,`);
  lines.push(`// REP state, the 14 dispatches), then the @property registrations`);
  lines.push(`// near the end of the cabinet. Fold points (folded:) are carved by`);
  lines.push(`// the tool; everything else renders as plain code.`);
  lines.push('');

  const flagFnVarNames = [];
  for (const name of flagFnNames) {
    const varName = `FN_${name.toUpperCase()}`;
    flagFnVarNames.push(varName);
    lines.push(`const ${varName} = ${jsTemplateLiteral(extractFunctionBlock(css, name))};`);
  }
  lines.push('');

  const propVarNames = {};
  for (const reg of CPU_REGS) {
    propVarNames[reg] = `${reg}_PROPERTY`;
    lines.push(`const ${propVarNames[reg]} = ${jsTemplateLiteral(extractPropertyBlock(css, reg))};`);
  }
  lines.push('');

  // Top level in real file order: the @function cluster (~27-41K into
  // the cabinet), the complete .cpu rule (~42-306K), @property blocks
  // (~7.3M, near the end). Verified against the captured CSS's indexOf
  // offsets.
  lines.push(`export const CPU_TREE = [`);
  lines.push(`  {`);
  lines.push(`    kind: 'section',`);
  lines.push(`    label: 'flag arithmetic helper functions',`);
  lines.push(`    folded: true,`);
  lines.push(`    boxed: true,`);
  lines.push(`    children: [`);
  for (const varName of flagFnVarNames) {
    lines.push(`      { kind: 'block', code: ${varName}, folded: true },`);
  }
  lines.push(`    ],`);
  lines.push(`  },`);
  lines.push(`  {`);
  lines.push(`    kind: 'section',`);
  lines.push(`    label: '.cpu — registers and decoder',`);
  lines.push(`    folded: true,`);
  lines.push(`    boxed: true,`);
  lines.push(`    children: [`);
  for (const group of groups) {
    lines.push(`${serializeNode(group, 3)},`);
  }
  lines.push(`    ],`);
  lines.push(`  },`);
  lines.push(`  {`);
  lines.push(`    kind: 'section',`);
  lines.push(`    label: 'register declarations',`);
  lines.push(`    folded: true,`);
  lines.push(`    boxed: true,`);
  lines.push(`    children: [`);
  for (const reg of CPU_REGS) {
    lines.push(`      { kind: 'block', code: ${propVarNames[reg]}, folded: true },`);
  }
  lines.push(`    ],`);
  lines.push(`  },`);
  lines.push(`];`);
  lines.push('');
  lines.push(`// Real measured size of the .cpu rule in the cabinet — shown in the`);
  lines.push(`// tree header ("CPU · N KB").`);
  lines.push(`export const CPU_TREE_META = { bytes: ${cpuBytes} };`);
  lines.push('');

  return lines.join('\n');
}

function main() {
  const section = process.argv[2];
  if (section !== 'cpu') {
    console.error('Usage: node tools/extract-tree-data.mjs cpu');
    console.error('(only "cpu" is implemented so far — see file header)');
    process.exit(1);
  }
  process.stdout.write(generateCpuTree());
}

main();
