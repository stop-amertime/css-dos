#!/usr/bin/env node
// extract-tree-data.mjs — generates the website's anatomy Tree View data
// from REAL Kiln output, never hand-typed CSS. Runs the same
// emitCSS(opts, writeStream) entry point builder/build.mjs uses, against a
// tiny synthetic cart, slices the file into its ten sections (the same
// regions the site's file carousel shows), and parses each into the tree
// node model.
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
//            round-trip): giant uniform runs (the 64,000 pixel rules) ship
//            only their head, and the note states the real total. This is
//            the no-silent-caps rule made visible.
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

import { emitCSS } from '../kiln/emit-css.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKELETON_DIR = resolve(REPO, 'web/site/src/components/anatomy/tree');
const CHUNK_DIR = resolve(REPO, 'web/site/public/anatomy');

// A tiny synthetic cart: 1.5 KB of conventional memory (IVT + BDA + the
// program — so the keyboard-bridge and LBA-register arms exist), a 6-byte
// program at 0x100, and a 512-byte rom disk (so the DISK section exists).
// Real emitter logic, fake-small input.
const SYNTHETIC_DISK = new Uint8Array(512);
for (let i = 0; i < 64; i++) SYNTHETIC_DISK[i] = (i * 7 + 3) & 0xff;
const SYNTHETIC_OPTS = {
  memoryZones: [[0x0, 0x600]],
  programBytes: new Uint8Array([0xb8, 0x05, 0x00, 0xcd, 0x20, 0x00]), // MOV AX,5; INT 0x20
  biosBytes: new Uint8Array(0),
  embeddedData: [],
  programOffset: 0x100,
  initialCS: 0,
  initialIP: 0x100,
  diskBytes: SYNTHETIC_DISK,
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
    if (!this.major) this.openMajor('', '(preamble)');
    this.sub = { kind: 'section', label: title, code: comment, folded: true, children: [] };
    this.major.children.push(this.sub);
  }
  comment(text) {
    const majorBanner = text.match(/^\/\* =+ (.+?) =+ \*\/$/s);
    const subBanner = text.match(/^\/\* -+ (.+?) -+ \*\/$/s);
    if (majorBanner) this.openMajor(text, majorBanner[1].trim());
    else if (subBanner) this.openSub(text, subBanner[1].trim());
    else this.push({ kind: 'block', code: text });
  }
  push(node) {
    if (!this.major) this.openMajor('', '(preamble)');
    (this.sub ?? this.major).children.push(node);
  }
}

// ---------------------------------------------------------------------------
// The generic region parser: walks a slice of the real file item by item.
// Handles comments/banners, @property blocks, @function bodies, style
// rules (including nested one-liner rules — the keyboard block — and
// @keyframes percent blocks), and plain declarations.

// Grabs one trailing same-line comment after position `i` (spaces/tabs
// only in between). Returns [commentText|null, nextIndex].
function takeSameLineComment(text, i) {
  const m = text.slice(i).match(/^[ \t]*\/\*[\s\S]*?\*\//);
  if (!m || m[0].includes('\n')) return [null, i];
  return [m[0].trimStart(), i + m[0].length];
}

// Parses the inside of a `{ ... }` body into child nodes (with banner
// grouping via a fresh Grouper when banners appear; otherwise flat).
function parseBody(body) {
  const grouper = new Grouper();
  let sawBanner = false;
  const flat = [];
  const push = (node) => { grouper.push(node); flat.push(node); };

  let i = 0;
  while (i < body.length) {
    if (/\s/.test(body[i])) { i++; continue; }
    // Comment (banner or plain).
    if (body[i] === '/' && body[i + 1] === '*') {
      const end = body.indexOf('*/', i + 2) + 2;
      const text = body.slice(i, end);
      if (/^\/\* [=-]+ .+? [=-]+ \*\/$/s.test(text) && /^\/\* (=+|-+) /.test(text)) {
        sawBanner = true;
        grouper.comment(text);
        flat.push(null); // placeholder — grouped output used when banners exist
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
      // Declaration. Keep its ';' and its own trailing comment.
      let end = j + 1;
      const [comment, afterC] = takeSameLineComment(body, end);
      let chunk = body.slice(i, end).trim();
      const m = chunk.match(/^(--[\w-]+:|result:)/);
      const value = m ? chunk.slice(m[0].length).trim() : null;
      if (m && (value.startsWith('if(') || value.startsWith('calc(if('))) {
        const decl = { kind: 'decl', code: m[0], children: [parseIf(value)] };
        if (comment) decl.comment = comment;
        push(decl);
      } else {
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
    if (!whole.includes('\n')) {
      // One-liner nested rule (keyboard rows): a single verbatim block,
      // trailing comment included.
      push({ kind: 'block', code: comment ? `${whole} ${comment}` : whole });
      i = comment ? afterC : close + 1;
      continue;
    }
    const header = body.slice(i, j + 1); // selector + '{'
    const inner = body.slice(j + 1, close);
    const rule = {
      kind: 'decl',
      code: header.trim(),
      children: parseBody(inner),
      trailer: '}',
    };
    if (comment) rule.comment = comment;
    push(rule);
    i = comment ? afterC : close + 1;
  }
  return sawBanner ? grouper.groups : flat.filter(Boolean);
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
    const whole = region.slice(i, close + 1);
    const header = region.slice(i, open + 1).trim();
    const inner = region.slice(open + 1, close);
    // Small bodies with no dispatch stay verbatim blocks (fold to first
    // line); anything with an if( dispatch or nested rules is structured
    // so its long lists paginate.
    const structured = /\bif\(/.test(inner) || /\{/.test(inner) || inner.length > 2000;
    if (!structured) {
      grouper.push({ kind: 'block', code: whole, folded: whole.includes('\n') ? true : undefined });
    } else {
      grouper.push({
        kind: 'decl',
        code: header,
        children: parseBody(inner),
        trailer: '}',
        folded: true,
      });
    }
    i = close + 1;
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

function carveRegion(nodes) {
  const walk = (node) => {
    if (node.kind === 'decl' && node.children?.[0]?.kind === 'if') {
      carveFolds(node);
      return; // carveFolds already walked the subtree
    }
    for (const c of node.children ?? []) walk(c);
  };
  for (const n of nodes) walk(n);
}

// ---------------------------------------------------------------------------
// The cap pass: a children array of more than CAP_ROWS uniform one-line
// `block` rows (the 64,000 pixel rules — nothing else comes close) ships
// only its head plus an explicit editorial `note` stating the real total
// (the no-silent-caps rule). Structured dispatch lists (branch nodes) are
// never capped — they ship fully, just paged.
const CAP_ROWS = 1024;

function capLongLists(node) {
  for (const c of node.children ?? []) capLongLists(c);
  const kids = node.children ?? [];
  if (kids.length <= CAP_ROWS) return;
  const blocks = kids.filter((c) => c.kind === 'block').length;
  if (blocks / kids.length < 0.9) return; // structured lists ship fully
  const total = kids.length;
  const dropped = total - CAP_ROWS;
  node.children = kids.slice(0, CAP_ROWS);
  node.children.push({
    kind: 'note',
    text: `… ${dropped.toLocaleString('en-US')} more rows of the same shape continue in the real file — truncated here to keep the site data small (tools/extract-tree-data.mjs CAP_ROWS)`,
  });
  node.capTotal = total;
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
  lines.push(`// Every code string is real, verbatim cabinet CSS from kiln's emitCSS()`);
  lines.push(`// against a tiny synthetic cart, round-trip-verified at generation time.`);
  lines.push(`// This module is the section's SKELETON; heavy folded nodes carry`);
  lines.push(`// lazy: { ref, count } and their children live in paged JSON chunks`);
  lines.push(`// under /anatomy/${id}/ (see the tool header for the format).`);
  lines.push(`// Regenerate: node tools/extract-tree-data.mjs ${id}`);
  lines.push('');
  lines.push(`export const ${NAME}_TREE = [`);
  for (const n of nodes) lines.push(`${serializeNode(n, 1)},`);
  lines.push(`];`);
  lines.push('');
  lines.push(`// Real measured size of this region in the synthetic cabinet.`);
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
    const noted = countWhere(nodes, (n) => n.kind === 'note');
    if (px < CAP_ROWS - 2 || noted < 1) {
      throw new Error(`screen: pixel rules=${px}, notes=${noted} — expected a capped ${CAP_ROWS}-row head + note`);
    }
  },
  decl: (nodes) => {
    const props = countWhere(nodes, (n) => (n.code ?? '').startsWith('@property'));
    if (props < 700) throw new Error(`decl: only ${props} @property blocks (expected 700+)`);
  },
  memr: (nodes) => {
    const arms = countWhere(nodes, (n) => (n.code ?? '').startsWith('style(--at:'));
    if (arms < 1500) throw new Error(`memr: only ${arms} read arms (expected ~1536 RAM + 512 window)`);
  },
  memw: (nodes) => {
    const rules = countWhere(nodes, (n) => /^--mc\d+:/.test(n.code ?? ''));
    if (rules < 700) throw new Error(`memw: only ${rules} cell write rules (expected ~768)`);
  },
  disk: (nodes) => {
    const arms = countWhere(nodes, (n) => (n.code ?? '').startsWith('style(--idx:'));
    if (arms !== 64) throw new Error(`disk: ${arms} arms (expected exactly 64 non-zero bytes)`);
  },
  clock: (nodes) => {
    const kf = countWhere(nodes, (n) => (n.code ?? '').startsWith('@keyframes'));
    const reads = countWhere(nodes, (n) => /^--__1mc\d+:/.test(n.code ?? ''));
    if (kf < 3 || reads < 700) throw new Error(`clock: keyframes=${kf}, cell buffer reads=${reads}`);
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
  const css = captureRealCSS();
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
      // Top-level groups render boxed (one tinted pane per file region).
      for (const n of nodes) if (n.kind === 'section') n.boxed = true;
      bytes = region.length;
    }
    for (const n of nodes) capLongLists(n);
    SANITY[id]?.(nodes);
    const writer = new ChunkWriter(id);
    for (const n of nodes) externalize(n, writer);
    const chunkCount = writer.flush();
    writeSkeleton(id, nodes, bytes);
    const skJson = JSON.stringify(nodes).length;
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
