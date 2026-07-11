#!/usr/bin/env node
// extract-tree-data.mjs — generates the website's anatomy Tree View data
// from a REAL cabinet, never hand-typed CSS. Builds carts/sokoban with the
// real builder, slices the file into its ten sections (the same regions
// the site's file carousel shows), and parses each into the tree node
// model. Giant uniform runs ship a capped head per run plus a note row
// with the remaining count (see capRuns).
//
// OUTPUT IS SPLIT FOR LAZY LOADING (progressive disclosure):
//   web/site/src/components/anatomy/tree/<id>-tree.js   — the SKELETON: the
//     section's group structure and everything visible before any fold is
//     opened. Small; bundled with the app.
//   web/site/public/anatomy/<id>/<NNN>.json             — CHUNKS: the
//     children of heavy folded nodes, fetched by TreeAst.svelte only when
//     the fold is opened. Long child lists are paged (each page carries a
//     `next` ref + remaining count, so totals are always known without
//     downloading the tail).
// A folded node whose children live in a chunk carries
//   lazy: { ref: '<id>/<NNN>', count: <shipped child count> }
// instead of `children`. Chunk files are JSON: { nodes: [...], next:
// { ref, remaining } | null }.
//
// ONE node model powers the whole tree (TreeAst.svelte renders all of it):
//   section  editorial/banner label row; children nest under it. The
//            banner comment text is kept as `code` so round-trip covers it.
//   block    a verbatim chunk (comment, one-line declaration, @property
//            body, one-line nested rule); folds to its first line.
//   decl     a line that opens a nested body: "--REG:", "@function ... {",
//            ".motherboard {", "0%, 49.99% {". Children + `trailer` (its
//            real closing text).
//   if/branch/value  the dispatch AST (see parseIf).
//   note     EDITORIAL truncation marker (not source text; excluded from
//            round-trip): each capped run ends with the remaining count.
// Nothing is re-nested or reordered at the DATA level — a node's `code` is
// ONLY its own token. Display (one-lining, pagination) lives in
// TreeAst.svelte.
//
// SELF-CHECK: every region's parse is reconstructed and compared
// (whitespace-stripped) against the raw sliced text BEFORE caps/chunking.
// Any dropped or misattached character fails generation loudly.
//
// Usage:
//   node tools/extract-tree-data.mjs all          # regenerate everything
//   node tools/extract-tree-data.mjs cpu memr     # just these sections
// (Output paths are fixed; the tool writes the files itself.)

import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKELETON_DIR = resolve(REPO, 'web/site/src/components/anatomy/tree');
const CHUNK_DIR = resolve(REPO, 'web/site/public/anatomy');

// The data comes from a REAL cart build — the same Sokoban cabinet the
// rest of the site is measured against (groups.js sizes, the File Map,
// SectionCpu's prose). The tool rebuilds it (~12 s) so the tree always
// matches current kiln output.
const EXHIBIT_CART = 'carts/sokoban';
const CABINET_PATH = resolve(REPO, 'tests/harness/cache/sokoban.css');

function readCabinet() {
  console.error(`  building ${EXHIBIT_CART} → ${CABINET_PATH} ...`);
  execFileSync(process.execPath, [resolve(REPO, 'builder/build.mjs'), resolve(REPO, EXHIBIT_CART), '-o', CABINET_PATH], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (!existsSync(CABINET_PATH)) throw new Error('cabinet build produced no file');
  return readFileSync(CABINET_PATH, 'utf8');
}

// ---------------------------------------------------------------------------
// The ten file sections, in file order, delimited by their top-level
// banners (must match kiln/emit-css.mjs emission order exactly). The inner
// `/* ===== ... ===== */` banners some regions contain (css-lib's own
// headings inside UTILITY FUNCTIONS) become groups WITHIN the region.
const SECTIONS = [
  { id: 'util',    banner: 'UTILITY FUNCTIONS' },
  { id: 'cpu',     banner: 'CPU' },
  { id: 'chipset', banner: 'CHIPSET' },
  { id: 'keys',    banner: 'KEYBOARD' },
  { id: 'screen',  banner: 'MODE 13h PIXEL PAINTER (raw player only)' },
  { id: 'decl',    banner: 'PROPERTY DECLARATIONS' },
  { id: 'memr',    banner: 'MEMORY READ' },
  { id: 'memw',    banner: 'MEMORY WRITE RULES' },
  { id: 'disk',    banner: 'DISK' },
  { id: 'clock',   banner: 'CLOCK' },
];

function sliceRegions(css) {
  const marks = SECTIONS.map(({ id, banner }) => {
    const text = `/* ===== ${banner} ===== */`;
    return { id, text };
  });
  // Locate each banner in order — searching from the previous one forward
  // so an inner banner can't shadow a later section's.
  let from = 0;
  const found = [];
  for (const m of marks) {
    const at = css.indexOf(m.text, from);
    if (at === -1) throw new Error(`section banner not found in order: ${m.text}`);
    found.push({ ...m, at });
    from = at + m.text.length;
  }
  const regions = new Map();
  for (let i = 0; i < found.length; i++) {
    const end = i + 1 < found.length ? found[i + 1].at : css.length;
    regions.set(found[i].id, css.slice(found[i].at, end));
  }
  return regions;
}

// ---------------------------------------------------------------------------
// Scanning primitives — all comment-aware. Comments can contain parens
// ("/* HLT (IP unchanged) */") and must never affect depth tracking.

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

// Index of the '}' matching the '{' at openIndex.
function matchBrace(text, openIndex) {
  let depth = 1;
  for (let i = openIndex + 1; i < text.length; ) {
    const skipped = skipComment(text, i);
    if (skipped !== i) { i = skipped; continue; }
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return i;
    i++;
  }
  throw new Error(`unbalanced braces from index ${openIndex}: ${text.slice(openIndex, openIndex + 60)}...`);
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
      let end = trailingCommentEnd(body, j + 1);
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
// The dispatch AST parser (if / branch / value).

// Parses text beginning with "if(" (or "calc(if(") into an `if` node.
// `trailer` is everything from the if's own ')' to the end of the given
// text — keeping it ON the node means the renderer can close the block
// visually at the right indent, and the round-trip check can prove no text
// was lost.
function parseIf(text) {
  const calcWrap = text.startsWith('calc(if(');
  const ifStart = text.indexOf('if(');
  const closeIdx = matchParen(text, ifStart + 2);
  const body = text.slice(ifStart + 3, closeIdx);
  const trailer = text.slice(closeIdx); // ')' inclusive, through end

  const children = splitTopLevel(body).flatMap((branchText) => {
    const nodes = [];
    let t = branchText.trim();
    // Standalone comments BETWEEN branches become their own block nodes:
    // real file content in place, and run delimiters for the renderer's
    // per-run pagination — a comment Kiln plants at a type boundary in a
    // long branch list stays visible instead of drowning behind "(N more…)".
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

// ---------------------------------------------------------------------------
// Banner-driven grouping. `/* ===== NAME ===== */` opens a major group,
// `/* --- name --- */` a sub-group; everything until the next banner at its
// level nests inside. The banner text is the group's `code` (round-trip
// covers it); its cleaned title is the label. Smaller `/* note */` comments
// stay inline as block nodes.
class Grouper {
  constructor() {
    this.groups = [];
    this.major = null;
    this.sub = null;
  }
  openMajor(comment, title) {
    this.major = { kind: 'section', label: title, code: comment, folded: true, children: [] };
    this.sub = null;
    this.groups.push(this.major);
  }
  openSub(comment, title) {
    if (!this.major) this.fallbackMajor();
    this.sub = { kind: 'section', label: title, code: comment, folded: true, children: [] };
    this.major.children.push(this.sub);
  }
  // Content before the first banner has no honest label — that is a KILN
  // bug (plant a banner over it), not something to paper over here.
  fallbackMajor() {
    console.error('  WARNING: content before the first banner — add a banner in kiln (showing as "(preamble)")');
    this.openMajor('', '(preamble)');
  }
  comment(text) {
    const majorBanner = text.match(/^\/\* =+ (.+?) =+ \*\/$/s);
    const subBanner = text.match(/^\/\* -+ (.+?) -+ \*\/$/s);
    if (majorBanner) this.openMajor(text, majorBanner[1].trim());
    else if (subBanner) this.openSub(text, subBanner[1].trim());
    else this.push({ kind: 'block', code: text });
  }
  push(node) {
    if (!this.major) this.fallbackMajor();
    (this.sub ?? this.major).children.push(node);
  }
}

// ---------------------------------------------------------------------------
// The generic region parser: walks a slice of the real file item by item.
// Handles comments/banners, @property blocks, @function bodies, style
// rules (including nested one-liner rules — the keyboard block — and
// @keyframes percent blocks), and plain declarations.

// Index just past a trailing comment that STARTS on the same line as
// position `i` (spaces/tabs only in between); `i` if there is none.
// Index-based on purpose — slicing the remainder of a 44 MB region per
// row is O(n²).
function trailingCommentEnd(text, i) {
  let j = i;
  while (text[j] === ' ' || text[j] === '\t') j++;
  if (text[j] === '/' && text[j + 1] === '*') {
    const close = text.indexOf('*/', j + 2);
    if (close !== -1) return close + 2;
  }
  return i;
}

// Grabs one trailing same-line comment after position `i`. Returns
// [commentText|null, nextIndex].
function takeSameLineComment(text, i) {
  const end = trailingCommentEnd(text, i);
  if (end === i) return [null, i];
  const comment = text.slice(i, end).trimStart();
  if (comment.includes('\n')) return [null, i];
  return [comment, end];
}

// Parses the inside of a `{ ... }` body into child nodes (with banner
// grouping via a fresh Grouper when banners appear; otherwise flat).
function parseBody(body) {
  // Collect flat items first; banners become markers. Grouping replays at
  // the end ONLY if banners exist, so banner-less bodies (keyframe blocks,
  // one-liner rules) never trip the missing-banner warning.
  const items = [];
  const push = (node) => items.push(node);

  let i = 0;
  while (i < body.length) {
    if (/\s/.test(body[i])) { i++; continue; }
    // Comment (banner or plain).
    if (body[i] === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i + 2) + 2;
      const text = body.slice(i, end);
      if (/^\/\* [=-]+ .+? [=-]+ \*\/$/s.test(text) && /^\/\* (=+|-+) /.test(text)) {
        items.push({ __banner: text });
      } else {
        push({ kind: 'block', code: text });
      }
      i = end;
      continue;
    }
    // Nested rule or declaration: scan to the first top-level ';' or '{'.
    let j = i;
    let depth = 0;
    while (j < body.length) {
      const skipped = skipComment(body, j);
      if (skipped !== j) { j = skipped; continue; }
      const c = body[j];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (depth === 0 && (c === ';' || c === '{')) break;
      j++;
    }
    if (j >= body.length) {
      const rest = body.slice(i).trim();
      if (rest) push({ kind: 'block', code: rest });
      break;
    }
    if (body[j] === ';') {
      // Declaration. Every decl parses to name + value (fully decomposed —
      // display decides one-lining); its own trailing comment moves to the
      // node so the renderer's comment column gets it.
      let end = j + 1;
      const [comment, afterC] = takeSameLineComment(body, end);
      let chunk = body.slice(i, end).trim();
      const m = chunk.match(/^(--[\w-]+:|result:)/);
      if (m) {
        const value = chunk.slice(m[0].length).trim();
        const child = (value.startsWith('if(') || value.startsWith('calc(if('))
          ? parseIf(value)
          : { kind: 'value', code: value };
        const decl = { kind: 'decl', code: m[0], children: [child] };
        if (comment) decl.comment = comment;
        push(decl);
      } else {
        // Non-custom-property line (animation shorthand etc.) — verbatim.
        if (comment) chunk = `${chunk} ${comment}`;
        push({ kind: 'block', code: chunk });
      }
      i = comment ? afterC : end;
      continue;
    }
    // Nested rule: body[j] === '{'.
    const close = matchBrace(body, j);
    const [comment, afterC] = takeSameLineComment(body, close + 1);
    const whole = body.slice(i, close + 1);
    const header = body.slice(i, j + 1); // selector + '{'
    const inner = body.slice(j + 1, close);
    push(makeRuleNode(header, inner, whole, comment));
    i = comment ? afterC : close + 1;
  }
  if (!items.some((it) => it.__banner)) return items;
  const grouper = new Grouper();
  for (const it of items) {
    if (it.__banner) grouper.comment(it.__banner);
    else grouper.push(it);
  }
  return grouper.groups;
}

// A rule node: selector line, parsed declarations as children, '}' trailer.
// One-liner rules from long uniform families (the 64,000 pixel rules) carve
// folded so the list reads as a table of selectors; short one-liners (the
// keyboard rows) stay open and the renderer one-lines the whole chain.
const ONE_LINER_FOLD_LEN = 90;
function makeRuleNode(header, inner, whole, comment) {
  const rule = {
    kind: 'decl',
    code: header.trim(),
    children: parseBody(inner),
    trailer: '}',
  };
  if (comment) rule.comment = comment;
  if (whole.includes('\n') || whole.length > ONE_LINER_FOLD_LEN) rule.folded = true;
  return rule;
}

// Parses one whole region (banner included) into top-level nodes.
function parseRegion(region) {
  const grouper = new Grouper();
  let i = 0;
  while (i < region.length) {
    if (/\s/.test(region[i])) { i++; continue; }
    if (region[i] === '/' && region[i + 1] === '*') {
      const end = region.indexOf('*/', i + 2) + 2;
      grouper.comment(region.slice(i, end));
      i = end;
      continue;
    }
    // @property — verbatim block.
    if (region.startsWith('@property', i)) {
      const open = region.indexOf('{', i);
      const close = matchBrace(region, open);
      grouper.push({ kind: 'block', code: region.slice(i, close + 1), folded: true });
      i = close + 1;
      continue;
    }
    // @function / @keyframes / style rule — header + body.
    const open = region.indexOf('{', i);
    if (open === -1) {
      const rest = region.slice(i).trim();
      if (rest) grouper.push({ kind: 'block', code: rest });
      break;
    }
    const close = matchBrace(region, open);
    const [comment, afterC] = takeSameLineComment(region, close + 1);
    const whole = region.slice(i, close + 1);
    const header = region.slice(i, open + 1);
    const inner = region.slice(open + 1, close);
    // Small helper @functions with no dispatch stay verbatim blocks (fold
    // to their signature line); rules and dispatch-bearing functions parse
    // structurally so their contents indent, one-line, and paginate.
    const verbatimHelper = header.trimStart().startsWith('@function')
      && !/\bif\(/.test(inner) && !/\{/.test(inner) && inner.length <= 2000;
    if (verbatimHelper) {
      grouper.push({ kind: 'block', code: whole, folded: whole.includes('\n') ? true : undefined });
    } else {
      grouper.push(makeRuleNode(header, inner, whole, comment));
    }
    i = comment ? afterC : close + 1;
  }
  return grouper.groups;
}

// ---------------------------------------------------------------------------
// Round-trip self-check: concatenating every token/comment/trailer in tree
// order must reproduce the raw sliced text exactly, modulo whitespace.
// `note` nodes are editorial and excluded (they are only added AFTER the
// check, by the cap pass).
function reconstruct(node) {
  if (node.kind === 'note') return '';
  let s = node.code ?? '';
  for (const c of node.children ?? []) s += ' ' + reconstruct(c);
  if (node.trailer) s += node.trailer;
  if (node.comment) s += ' ' + node.comment;
  return s;
}

function assertRoundTrip(nodes, raw, label) {
  const strip = (s) => s.replace(/\s+/g, '');
  const rebuilt = strip(nodes.map(reconstruct).join(''));
  const original = strip(raw);
  if (rebuilt !== original) {
    let i = 0;
    while (i < rebuilt.length && i < original.length && rebuilt[i] === original[i]) i++;
    throw new Error(
      `${label}: parse does not round-trip to the raw CSS (diverges at stripped index ${i}):\n` +
      `  raw:     ...${original.slice(Math.max(0, i - 40), i + 40)}...\n` +
      `  rebuilt: ...${rebuilt.slice(Math.max(0, i - 40), i + 40)}...`
    );
  }
}

// ---------------------------------------------------------------------------
// Fold carving (same rules the CPU pilot shipped with).

function carveFolds(decl) {
  decl.folded = true;
  const walk = (node) => {
    if (node.kind === 'if') carveIfChildren(node.children);
    for (const c of node.children ?? []) walk(c);
  };
  walk(decl);
}

function carveIfChildren(children) {
  // Nested-if rows fold.
  for (const b of children) {
    if (b.kind === 'branch' && b.children?.[0]?.kind === 'if') b.folded = true;
  }
  // RUN UNIFORMITY: within a comment-delimited run, branches sharing a
  // condition shape (numbers masked) fold TOGETHER, one-line rows included.
  const runs = [];
  let cur = [];
  for (const c of children) {
    if (c.kind === 'block' && (c.code ?? '').startsWith('/*')) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else {
      cur.push(c);
    }
  }
  if (cur.length) runs.push(cur);
  for (const run of runs) {
    const groups = new Map();
    for (const m of run) {
      if (m.kind !== 'branch') continue;
      const key = m.code.replace(/\d+/g, '#');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    }
    for (const members of groups.values()) {
      if (members.length >= 2 && members.some((m) => m.folded)) {
        for (const m of members) m.folded = true;
      }
    }
  }
}

// Plain decl rows (name + value, no if): fold the ones whose value is a
// wall of text (memw's --applySlot cascades), with run-uniformity contagion
// across same-shaped siblings (--mc# rows fold together or not at all).
const DECL_FOLD_VALUE_LEN = 100;
function carveDeclRuns(children) {
  const groups = new Map();
  for (const c of children ?? []) {
    if (c.kind !== 'decl' || c.children?.length !== 1) continue;
    const v = c.children[0];
    if (v.kind !== 'value') continue;
    const key = c.code.replace(/\d+/g, '#');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  for (const members of groups.values()) {
    if (members.some((m) => m.children[0].code.length > DECL_FOLD_VALUE_LEN)) {
      for (const m of members) m.folded = true;
    }
  }
}

function carveRegion(nodes) {
  const walk = (node) => {
    if (node.kind === 'decl' && node.children?.[0]?.kind === 'if') {
      carveFolds(node);
      return; // carveFolds already walked the subtree
    }
    carveDeclRuns(node.children);
    for (const c of node.children ?? []) walk(c);
  };
  carveDeclRuns(nodes);
  for (const n of nodes) walk(n);
}

// ---------------------------------------------------------------------------
// De-ceremony passes (owner feedback 2026-07-11): the pane header already
// names the section, so a region that parses to a single group hoists its
// children to the top (the banner stays as a plain comment line), and any
// LONE structural wrapper (the one .motherboard rule, an @function's
// `result:` chain) renders open instead of demanding a click per level.
// Everything hoisted/unfolded still lazy-loads exactly as before — an
// unfolded lazy node fetches on mount, which happens when its parent
// becomes visible.

const isCommentNode = (n) =>
  n.kind === 'note' || (n.kind === 'block' && (n.code ?? '').startsWith('/*'));

function hoistAndRoot(nodes) {
  let items = nodes;
  if (items.length === 1 && items[0].kind === 'section') {
    const root = items[0];
    items = root.code ? [{ kind: 'block', code: root.code }] : [];
    items = items.concat(root.children); // no spread — child lists reach 200k+
  } else {
    // A leading empty group (the region banner immediately followed by the
    // first real banner) renders as a plain comment line, not an empty box.
    items = items.flatMap((n) =>
      n.kind === 'section' && (n.children?.length ?? 0) === 0 && n.code
        ? [{ kind: 'block', code: n.code }]
        : [n]);
  }
  return { kind: 'root', children: items };
}

function unfoldCeremony(node) {
  if (node.kind === 'if' || node.kind === 'branch') return;
  const kids = node.children ?? [];
  const structural = kids.filter((c) => !isCommentNode(c));
  if (structural.length === 1 && structural[0].kind !== 'section'
      && structural[0].folded != null) {
    delete structural[0].folded;
  }
  for (const c of kids) unfoldCeremony(c);
}

// ---------------------------------------------------------------------------
// The cap pass, PER RUN: within any child list, rows between two
// run-delimiter comments cap at CAP_ROWS — the head ships, a `note` row
// carries the remaining count, and the next run (the comment after it)
// survives. This keeps the shape of a region visible (RAM head … bridge …
// ROM head … window head) while a 655,000-arm dispatch ships kilobytes.
const CAP_ROWS = 512;

function capRuns(node) {
  for (const c of node.children ?? []) capRuns(c);
  const kids = node.children ?? [];
  if (kids.length <= CAP_ROWS) return;
  const out = [];
  let run = [];
  let capped = 0;
  const flushRun = () => {
    if (run.length > CAP_ROWS) {
      const dropped = run.length - CAP_ROWS;
      capped += dropped;
      for (const x of run.slice(0, CAP_ROWS)) out.push(x); // no spread — runs reach 600k+
      out.push({ kind: 'note', text: `… ${dropped.toLocaleString('en-US')} more rows` });
    } else {
      for (const x of run) out.push(x);
    }
    run = [];
  };
  for (const c of kids) {
    if (c.kind === 'block' && (c.code ?? '').startsWith('/*')) {
      flushRun();
      out.push(c);
    } else {
      run.push(c);
    }
  }
  flushRun();
  if (capped > 0) {
    node.children = out;
    node.capTotal = kids.length;
  }
}

// ---------------------------------------------------------------------------
// Lazy chunking: after parsing/carving/capping, children of heavy FOLDED
// nodes move into paged JSON files the client fetches on expand.

const INLINE_LIMIT = 2_000;   // max JSON chars a folded node keeps inline
const PAGE_LIMIT = 48_000;    // max JSON chars per chunk page

class ChunkWriter {
  constructor(sectionId) {
    this.sectionId = sectionId;
    this.counter = 0;
    this.files = []; // { name, json }
  }
  nextRef() {
    return `${this.sectionId}/${String(this.counter++).padStart(3, '0')}`;
  }
  // Writes `children` as one or more pages; returns { ref, count }.
  writePages(children) {
    // Split into pages by serialized size.
    const pages = [];
    let cur = [];
    let curLen = 0;
    for (const c of children) {
      const len = JSON.stringify(c).length + 1;
      if (cur.length && curLen + len > PAGE_LIMIT) {
        pages.push(cur);
        cur = [];
        curLen = 0;
      }
      cur.push(c);
      curLen += len;
    }
    if (cur.length) pages.push(cur);
    // Allocate refs first so each page can point at the next.
    const refs = pages.map(() => this.nextRef());
    let remaining = children.length;
    pages.forEach((page, k) => {
      remaining -= page.length;
      const payload = {
        nodes: page,
        next: k + 1 < pages.length ? { ref: refs[k + 1], remaining } : null,
      };
      this.files.push({ name: refs[k], json: JSON.stringify(payload) });
    });
    return { ref: refs[0], count: children.length };
  }
  flush() {
    const dir = resolve(CHUNK_DIR, this.sectionId);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const { name, json } of this.files) {
      writeFileSync(resolve(CHUNK_DIR, `${name}.json`), json);
    }
    return this.files.length;
  }
}

// Post-order: externalize heavy children. Folded nodes lazy-load on
// expand; non-foldable nodes (an if inside an expanded decl) lazy-load on
// mount — which still only happens after an ancestor fold opened, so both
// stay off the wire until the reader drills in. Non-foldable nodes get a
// looser threshold so medium rows don't cost a fetch each.
function externalize(node, writer) {
  for (const c of node.children ?? []) externalize(c, writer);
  if (!node.children?.length) return;
  const limit = node.folded != null ? INLINE_LIMIT : 4 * INLINE_LIMIT;
  const size = JSON.stringify(node.children).length;
  if (size <= limit) return;
  const { ref, count } = writer.writePages(node.children);
  node.lazy = { ref, count: node.capTotal ?? count };
  delete node.children;
}

// ---------------------------------------------------------------------------
// Skeleton serialization (a JS module, like the CPU pilot's cpu-tree.js).

function jsTemplateLiteral(s) {
  return `\`${s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``;
}

function serializeNode(node, indent) {
  const pad = '  '.repeat(indent);
  const props = [`kind: '${node.kind}'`];
  if (node.label != null) props.push(`label: ${JSON.stringify(node.label)}`);
  if (node.code != null) props.push(`code: ${jsTemplateLiteral(node.code)}`);
  if (node.text != null) props.push(`text: ${JSON.stringify(node.text)}`);
  if (node.comment) props.push(`comment: ${jsTemplateLiteral(node.comment)}`);
  if (node.trailer) props.push(`trailer: ${jsTemplateLiteral(node.trailer)}`);
  if (node.folded != null) props.push(`folded: ${node.folded}`);
  if (node.boxed) props.push(`boxed: true`);
  if (node.lazy) props.push(`lazy: ${JSON.stringify(node.lazy)}`);
  if (!node.children || node.children.length === 0) {
    return `${pad}{ ${props.join(', ')} }`;
  }
  const childExprs = node.children.map((c) => serializeNode(c, indent + 1));
  return `${pad}{\n${pad}  ${props.join(`,\n${pad}  `)},\n${pad}  children: [\n${childExprs.join(',\n')},\n${pad}  ],\n${pad}}`;
}

function writeSkeleton(id, nodes, bytes) {
  const NAME = id.toUpperCase();
  const lines = [];
  lines.push(`// ${id}-tree.js — GENERATED by tools/extract-tree-data.mjs. Do not hand-edit.`);
  lines.push(`// Every code string is real, verbatim CSS from a full carts/sokoban`);
  lines.push(`// build, round-trip-verified against the cabinet at generation time.`);
  lines.push(`// This module is the section's SKELETON; heavy folded nodes carry`);
  lines.push(`// lazy: { ref, count } and their children live in paged JSON chunks`);
  lines.push(`// under /anatomy/${id}/ (see the tool header for the format).`);
  lines.push(`// Regenerate: node tools/extract-tree-data.mjs ${id}`);
  lines.push('');
  lines.push(`export const ${NAME}_TREE = [`);
  for (const n of nodes) lines.push(`${serializeNode(n, 1)},`);
  lines.push(`];`);
  lines.push('');
  lines.push(`// Real measured size of this region in the sokoban cabinet.`);
  lines.push(`export const ${NAME}_TREE_META = { bytes: ${bytes} };`);
  lines.push('');
  writeFileSync(resolve(SKELETON_DIR, `${id}-tree.js`), lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Per-section sanity checks against independent expectations — a recipe
// that silently parses the wrong slice must fail here.
function countWhere(nodes, pred) {
  let n = 0;
  const walk = (node) => {
    if (pred(node)) n++;
    for (const c of node.children ?? []) walk(c);
  };
  for (const node of nodes) walk(node);
  return n;
}

const SANITY = {
  util: (nodes) => {
    const fns = countWhere(nodes, (n) => (n.code ?? '').startsWith('@function'));
    if (fns < 50) throw new Error(`util: only ${fns} @functions found (expected 50+)`);
  },
  cpu: (nodes) => {
    for (const reg of ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI', 'CS', 'DS', 'ES', 'SS', 'IP', 'flags']) {
      if (!countWhere(nodes, (n) => n.code === `--${reg}:`)) {
        throw new Error(`cpu: --${reg}: dispatch missing`);
      }
    }
  },
  chipset: (nodes) => {
    for (const v of ['picMask', 'pitCounter', 'kbdScancodeLatch']) {
      if (!countWhere(nodes, (n) => n.code === `--${v}:`)) {
        throw new Error(`chipset: --${v}: dispatch missing`);
      }
    }
  },
  keys: (nodes) => {
    const rows = countWhere(nodes, (n) => (n.code ?? '').includes(':active'));
    if (rows < 60) throw new Error(`keys: only ${rows} :active rows (expected 60+)`);
  },
  screen: (nodes) => {
    const px = countWhere(nodes, (n) => /#p\d+ \{/.test(n.code ?? ''));
    if (px !== 64000) throw new Error(`screen: ${px} pixel rules (expected 64,000)`);
  },
  decl: (nodes) => {
    const props = countWhere(nodes, (n) => (n.code ?? '').startsWith('@property'));
    if (props < 10_000) throw new Error(`decl: only ${props} @property blocks (expected 10k+ from a real cart)`);
  },
  memr: (nodes) => {
    const arms = countWhere(nodes, (n) => (n.code ?? '').startsWith('style(--at:'));
    if (arms < 100_000) throw new Error(`memr: only ${arms} read arms (expected 100k+ from a real cart)`);
  },
  memw: (nodes) => {
    const rules = countWhere(nodes, (n) => /^--mc\d+:/.test(n.code ?? ''));
    if (rules < 10_000) throw new Error(`memw: only ${rules} cell write rules (expected 10k+)`);
  },
  disk: (nodes) => {
    const arms = countWhere(nodes, (n) => (n.code ?? '').startsWith('style(--idx:'));
    if (arms < 1000) throw new Error(`disk: only ${arms} arms (expected 1000+ from a real floppy)`);
  },
  clock: (nodes) => {
    const kf = countWhere(nodes, (n) => (n.code ?? '').startsWith('@keyframes'));
    const reads = countWhere(nodes, (n) => /^--__1mc\d+:/.test(n.code ?? ''));
    if (kf < 3 || reads < 10_000) throw new Error(`clock: keyframes=${kf}, cell buffer reads=${reads}`);
  },
};

// ---------------------------------------------------------------------------
// Generation.

// The CPU pane keeps its shipped, owner-approved curated layout: the flag
// @function cluster (file-wise part of the util region), the COMPLETE .cpu
// rule, and the register @property blocks (file-wise part of decl) — three
// boxed groups. Everything else shows its plain file region.
function extractFunctionBlock(css, name) {
  const marker = `@function --${name}(`;
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`@function --${name} not found`);
  return css.slice(start, css.indexOf('\n}', start) + 2);
}

function extractPropertyBlock(css, name) {
  const marker = `@property --${name} {`;
  const start = css.indexOf(marker);
  if (start === -1) throw new Error(`@property --${name} not found`);
  return css.slice(start, css.indexOf('\n}', start) + 2);
}

const CPU_REGS = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI',
                  'CS', 'DS', 'ES', 'SS', 'IP', 'flags'];

// Per-banner display curation for the .cpu rule: 'label' = flat header
// whose contents stay visible (no toggle). Everything else folds.
const CPU_BANNER_STYLE = {
  'unknown opcode flag': 'label',
};

function buildCpuNodes(css) {
  // The whole .cpu rule, parsed with the same generic body parser.
  const ruleStart = css.indexOf('.cpu {');
  if (ruleStart === -1) throw new Error('.cpu rule not found');
  const open = css.indexOf('{', ruleStart);
  const close = matchBrace(css, open);
  const inner = css.slice(open + 1, close);
  const groups = parseBody(inner);
  assertRoundTrip(groups, inner, 'cpu-rule');
  carveRegion(groups);
  const allSections = [];
  const walkSections = (n) => {
    if (n.kind === 'section') allSections.push(n);
    for (const c of n.children ?? []) walkSections(c);
  };
  for (const g of groups) walkSections(g);
  for (const s of allSections) {
    if (CPU_BANNER_STYLE[s.label] === 'label') delete s.folded;
  }

  // The flag-arithmetic @function cluster — discovered by scanning the real
  // file (not a hand-kept list): every @function whose name ends in
  // Flags16/8, FlagsN16/8, or OF16/8, in file order.
  const flagFnNames = [...css.matchAll(/@function --([\w-]+)\(/g)]
    .map((m) => m[1])
    .filter((n) => /(FlagsN?(8|16)|OF(8|16))$/.test(n));
  if (flagFnNames.length < 30) {
    throw new Error(`flag-function scan looks wrong: only found ${flagFnNames.length}`);
  }

  const bytes = close + 1 - ruleStart;
  const nodes = [
    {
      kind: 'section', label: 'flag arithmetic helper functions',
      folded: true, boxed: true,
      children: flagFnNames.map((n) => ({ kind: 'block', code: extractFunctionBlock(css, n), folded: true })),
    },
    {
      kind: 'section', label: '.cpu — registers and decoder',
      folded: true, boxed: true,
      children: groups,
    },
    {
      kind: 'section', label: 'register declarations',
      folded: true, boxed: true,
      children: CPU_REGS.map((r) => ({ kind: 'block', code: extractPropertyBlock(css, r), folded: true })),
    },
  ];
  return { nodes, bytes };
}

function generate(ids) {
  const css = readCabinet();
  const regions = sliceRegions(css);
  for (const id of ids) {
    const region = regions.get(id);
    let nodes;
    let bytes;
    if (id === 'cpu') {
      ({ nodes, bytes } = buildCpuNodes(css));
    } else {
      nodes = parseRegion(region);
      assertRoundTrip(nodes, region, id);
      carveRegion(nodes);
      bytes = region.length;
    }
    const root = hoistAndRoot(nodes);
    unfoldCeremony(root);
    // Top-level groups render boxed (one tinted pane per group).
    for (const n of root.children) if (n.kind === 'section') n.boxed = true;
    SANITY[id]?.([root]);
    capRuns(root);
    const writer = new ChunkWriter(id);
    externalize(root, writer);
    const chunkCount = writer.flush();
    writeSkeleton(id, [root], bytes);
    const skJson = JSON.stringify([root]).length;
    console.error(`  ${id}: ${bytes.toLocaleString('en-US')} B region → skeleton ${skJson.toLocaleString('en-US')} B + ${chunkCount} chunks`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const ids = args.length === 1 && args[0] === 'all'
    ? SECTIONS.map((s) => s.id)
    : args.filter((a) => SECTIONS.some((s) => s.id === a));
  if (!ids.length) {
    console.error('Usage: node tools/extract-tree-data.mjs all | <section id ...>');
    console.error(`Sections: ${SECTIONS.map((s) => s.id).join(' ')}`);
    process.exit(1);
  }
  generate(ids);
}

main();
