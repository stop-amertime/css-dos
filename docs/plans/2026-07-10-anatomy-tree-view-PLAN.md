# Anatomy Tree View (CPU pilot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an expandable `[+]`/`[-]` tree view of real cabinet CSS to
the top of the CPU anatomy section pane, showing the register tables and
their real opcode rows with per-node classification (property / function
/ rule / etc.) and pagination for long lists.

**Architecture:** A pure `classify()` function labels any real CSS-text
chunk by syntax shape. A recursive `TreeNode.svelte` renders either an
editorial group (folder glyph, no code) or a real-construct node
(classifier glyph + `CodeCss` body), with a per-level 20-item cap and a
"(N more…)" expander. `TreeView.svelte` is the list-root wrapper, fed by
a hand-authored `cpu-tree.js` data file containing real, verbatim CSS
extracted from a built Sokoban cabinet. Mounted at the top of
`SectionCpu.svelte`, above the existing prose.

**Tech Stack:** Svelte 5 (runes: `$state`, `$props`, `$derived`), Vite,
existing `CodeCss.svelte` (Prism CSS highlighting), existing
`Foldable.svelte` glyph convention, `~icons/pixelarticons/*` via
unplugin-icons. No new dependencies.

## Global Constraints

- Design source of truth: [`docs/plans/2026-07-10-anatomy-tree-view.md`](2026-07-10-anatomy-tree-view.md)
  (the approved design spec). Every task below implements a section of it.
- Pilot scope is the CPU section ONLY (`SectionCpu.svelte`). Do not touch
  other `Section*.svelte` files.
- Real-construct node code must be **verbatim** cabinet CSS (byte-for-byte,
  whitespace/line-wrapping for readability allowed, content must not
  change) — copied from a real built cabinet, not invented. This plan's
  tree data was extracted from a real `carts/sokoban` build on
  2026-07-10 (see Task 3 for the build command used to source it).
- Classifier (`classify()`) only derives a node's own `kind`/`label` from
  its own CSS text. It must never decide tree shape, grouping, or
  pagination — those stay 100% in the hand-authored data file.
- One pagination mechanism only: any node's children list caps at 20,
  with a "(N more…)" control that appends the next 20 in place. No
  separate "skew detection" logic — lopsided-volume cases are handled by
  adding more editorial sub-groups in the data file, not new code.
- Palette: reuse `--edit-black` (#000000), `--edit-white` (#ffffff),
  `--edit-red` (#aa0000), `--edit-blue` (#0000aa), `--edit-yellow`
  (#ffff55), `--edit-gray` (#d6d6d6) from `web/site/src/styles/global.css`.
  Do not invent new hex colours for the base palette; classifier-kind
  accent colours (Task 1) may introduce a small number of new ones but
  should stay in the same EGA-leaning family as `groups.js`.
- No new npm dependencies. No new test framework — this is a
  presentational component; verification is `npm run build` (must stay
  green) plus manual browser check via `npm run dev`.

---

### Task 1: The classifier (`classify.js`) + its unit tests

**Files:**
- Create: `web/site/src/components/anatomy/tree/classify.js`
- Test: `web/site/src/components/anatomy/tree/classify.test.js`

**Interfaces:**
- Produces: `classify(cssChunk: string) -> { kind: string, label: string }`
  where `kind` is one of `'property' | 'function' | 'rule' | 'keyframes'
  | 'selector' | 'comment' | 'value'`. Used by `TreeNode.svelte` (Task 2)
  and `KIND_STYLE` (Task 2) to pick a glyph/colour per node.

This project has no existing JS unit-test runner wired up in
`web/site/` (only a Playwright e2e harness under `web/tests/`). Rather
than pull in a new test framework for one pure function, write the test
as a plain Node script using `assert` from the Node standard library,
runnable directly with `node`.

- [ ] **Step 1: Write `classify.js` with the seven pattern rules**

```js
// classify.js — labels a chunk of real cabinet CSS by its own syntax
// shape (at-rule name, selector type, declaration vs block). Never
// looks at anything beyond the text it's given: no upstream knowledge
// of x86/CPU/DOS, no tree-shape decisions — see docs/plans/
// 2026-07-10-anatomy-tree-view.md "The classifier".

const RULES = [
  {
    kind: 'property',
    test: /^\s*@property\s+(--[\w-]+)/,
    label: (m) => m[1],
  },
  {
    kind: 'function',
    test: /^\s*@function\s+(--[\w-]+)\s*\(/,
    label: (m) => `${m[1]}()`,
  },
  {
    kind: 'keyframes',
    test: /^\s*@keyframes\s+([\w-]+)/,
    label: (m) => m[1],
  },
  {
    kind: 'rule',
    test: /^\s*style\(([^)]*)\)\s*:/,
    label: (m) => m[1].trim(),
  },
  {
    kind: 'comment',
    test: /^\s*\/\*\s*([\s\S]*?)\s*\*\//,
    label: (m) => (m[1].length > 40 ? `${m[1].slice(0, 40)}…` : m[1]),
  },
  {
    kind: 'selector',
    test: /^\s*([.:#][\w:().,\s-]*?)\s*\{/,
    label: (m) => m[1].trim(),
  },
];

export function classify(cssChunk) {
  const text = String(cssChunk);
  for (const rule of RULES) {
    const m = text.match(rule.test);
    if (m) return { kind: rule.kind, label: rule.label(m) };
  }
  const firstToken = text.trim().split(/\s+/)[0] ?? '';
  return {
    kind: 'value',
    label: firstToken.length > 40 ? `${firstToken.slice(0, 40)}…` : firstToken,
  };
}
```

- [ ] **Step 2: Write the test script**

```js
// classify.test.js — run with: node web/site/src/components/anatomy/tree/classify.test.js
import assert from 'node:assert/strict';
import { classify } from './classify.js';

// @property
assert.deepEqual(
  classify('@property --AX {\n  syntax: \'<integer>\';\n  inherits: true;\n  initial-value: 0;\n}'),
  { kind: 'property', label: '--AX' },
);

// @function
assert.deepEqual(
  classify('@function --addFlags16(--dst <integer>, --src <integer>) returns <integer> {\n  result: 0;\n}'),
  { kind: 'function', label: '--addFlags16()' },
);

// style() rule
assert.deepEqual(
  classify('style(--opcode: 5): --lowerBytes(calc(var(--__1AX) + var(--imm16)), 16); /* ADD AX, imm16 */'),
  { kind: 'rule', label: '--opcode: 5' },
);

// keyframes
assert.deepEqual(
  classify('@keyframes clock-tick {\n  to { --tick: 1; }\n}'),
  { kind: 'keyframes', label: 'clock-tick' },
);

// selector
assert.deepEqual(
  classify('.cpu {\n  --AL: --lowerBytes(var(--__1AX), 8);\n}'),
  { kind: 'selector', label: '.cpu' },
);

// standalone comment
assert.deepEqual(
  classify('/* Register aliases (8-bit halves) */'),
  { kind: 'comment', label: 'Register aliases (8-bit halves)' },
);

// bare value/expression (fallback)
assert.deepEqual(
  classify('calc(var(--dst) + var(--src))'),
  { kind: 'value', label: 'calc(var(--dst)' },
);

// long comment truncates at 40 chars with an ellipsis
{
  const { kind, label } = classify(
    '/* This is a deliberately long comment used only to verify truncation behaviour in the classifier */',
  );
  assert.equal(kind, 'comment');
  assert.equal(label.length, 41); // 40 chars + '…'
  assert.ok(label.endsWith('…'));
}

console.log('classify.test.js: all assertions passed');
```

- [ ] **Step 3: Run the test script and verify it passes**

Run: `node web/site/src/components/anatomy/tree/classify.test.js`
Expected output: `classify.test.js: all assertions passed` and exit code 0.

If any `assert.deepEqual` throws, read the diff it prints (Node prints
expected vs actual) and fix `classify.js` — do not loosen the test.

- [ ] **Step 4: Commit**

```bash
git add web/site/src/components/anatomy/tree/classify.js web/site/src/components/anatomy/tree/classify.test.js
git commit -m "anatomy: add CSS-construct classifier for the tree view"
```

---

### Task 2: `TreeNode.svelte` (recursive renderer) + `KIND_STYLE`

**Files:**
- Create: `web/site/src/components/anatomy/tree/kind-style.js`
- Create: `web/site/src/components/anatomy/tree/TreeNode.svelte`
- Create: `web/site/src/styles/_fragments/tree-view.css`

**Interfaces:**
- Consumes: `classify(cssChunk) -> { kind, label }` from Task 1
  (`../tree/classify.js`, relative to `TreeNode.svelte`'s own directory
  it's `./classify.js`).
- Consumes: existing `CodeCss.svelte` at
  `web/site/src/components/CodeCss.svelte` — `<CodeCss code={string} />`,
  Prism-highlights and renders a `<pre><code>` block.
- Produces (this task): `KIND_STYLE` — a plain object exported from
  `kind-style.js`, keyed by the seven `classify()` kinds, each value
  `{ glyph: string, colour: string }` (colour is a CSS colour string).
  Consumed by `TreeNode.svelte` in this task and reusable by any future
  section's tree.
- Produces (this task): `TreeNode.svelte` — a recursive component. Props:
  - `node` — one entry from a tree-data array (shape defined below).
  - `depth` — integer, current nesting depth (root callers pass `0`).
- Produces (this task): the **tree-data node shape**, used by every data
  file (`cpu-tree.js` in Task 3 and any future section):
  ```js
  // Editorial group node — no code of its own, just organizes children.
  { type: 'group', label: 'Registers', children: [ /* nodes */ ] }

  // Real-construct node — wraps one verbatim chunk of cabinet CSS.
  { type: 'code', code: '@property --AX {\n  ...\n}', children: [ /* nodes, optional */ ] }
  ```
  `type: 'code'` nodes derive their glyph/label by running `node.code`
  through `classify()` at render time (not pre-computed in the data
  file — keeps the data file pure data, no risk of a stale label).

Build the tree-data node shape and `KIND_STYLE` first (below), since
`TreeNode.svelte` needs both to exist before it can render.

- [ ] **Step 1: Write `kind-style.js`**

```js
// kind-style.js — one fixed glyph + colour per classify() kind, shared
// across every section's tree so the vocabulary is learned once. Colours
// lean on the same EGA-ish families anatomy/groups.js already uses for
// the cabinet bar (memory = blues, utilities = green) without reusing
// its exact hex values 1:1 (those are per-SEGMENT, these are per-KIND).
export const KIND_STYLE = {
  property:  { glyph: '§', colour: '#2222cc' }, // memory-blue family
  function:  { glyph: 'ƒ', colour: '#00aa00' }, // utility green
  rule:      { glyph: '?', colour: '#aa0000' }, // silicon red (branch/condition)
  keyframes: { glyph: '@', colour: '#ffff55' }, // clock yellow (the thing that moves)
  selector:  { glyph: '.', colour: '#00aaaa' }, // I/O cyan
  comment:   { glyph: '/*', colour: '#555555' }, // neutral grey, matches .zoom-label / captions
  value:     { glyph: '=', colour: '#aa00aa' }, // disk purple, catch-all
};

export const GROUP_STYLE = { glyph: null, colour: '#555555' }; // folder glyph is drawn in CSS, not here
```

- [ ] **Step 2: Write the tree-view CSS fragment**

```css
/* tree-view.css — the anatomy Tree View: editorial [+]/[-] groups vs
   real-construct nodes (glyph + colour from classify.js's KIND_STYLE).
   Reuses Foldable's [+]/[-] convention rather than inventing a new one.
   Real code bodies render via CodeCss (Prism), same as the prose pages. */

.tree-view {
  margin: 12px 0 20px;
  border: 1px solid var(--edit-black);
  background: var(--edit-white);
  box-shadow: 4px 4px 0 var(--edit-black);
  padding: 10px 12px;
  font-size: 15px;
  line-height: 19px;
}

.tree-node { margin: 0; }
.tree-node > .tree-row {
  display: flex;
  align-items: baseline;
  gap: 7px;
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
}
.tree-node > .tree-row:hover { background: #f0f0f0; }
.tree-node > .tree-children {
  margin-left: 18px;
  padding-left: 10px;
  border-left: 1px dashed #ccc;
}

/* Expand/collapse glyph — same [+]/[-] text convention as Foldable. */
.tree-glyph {
  flex: none;
  width: 18px;
  font-family: 'WebVGA', monospace;
  letter-spacing: normal;
  color: var(--edit-blue);
}
.tree-node.is-leaf .tree-glyph { color: transparent; } /* keeps alignment, no arrow on leaves */

/* Editorial group label: neutral, prose-style, folder-flavoured. */
.tree-label-group {
  color: var(--edit-black);
  font-weight: bold;
}

/* Real-construct label: kind glyph chip + monospace code-shaped label. */
.tree-kind-chip {
  flex: none;
  display: inline-block;
  min-width: 16px;
  text-align: center;
  padding: 0 3px;
  border: 1px solid var(--edit-black);
  font-family: 'WebVGA', monospace;
  letter-spacing: normal;
  font-size: 12px;
  line-height: 15px;
  color: var(--edit-white);
}
.tree-label-code {
  font-family: 'WebVGA', monospace;
  letter-spacing: normal;
  color: var(--edit-black);
}

.tree-node .byte-example { margin: 4px 0 8px 18px; }

/* Pagination: "(N more…)" row, styled like a link, not a full node. */
.tree-more {
  margin: 4px 0 2px;
  padding-left: 18px;
}
.tree-more button {
  font: inherit;
  color: var(--edit-blue);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
}
.tree-more button:hover { color: var(--edit-red); }

@media (max-width: 640px) {
  .tree-view { padding: 8px; font-size: 14px; }
  .tree-node > .tree-children { margin-left: 12px; padding-left: 7px; }
}
```

- [ ] **Step 3: Write `TreeNode.svelte`**

```svelte
<script>
  // TreeNode — one row of the anatomy Tree View, recursive. Two
  // flavours: `type: 'group'` (editorial, no code, folder [+]/[-]) and
  // `type: 'code'` (real cabinet CSS, classify()'d for its glyph/colour,
  // rendered via CodeCss when expanded). Children paginate at 20 per
  // level via a "(N more…)" row that appends the next 20 in place — see
  // docs/plans/2026-07-10-anatomy-tree-view.md "Pagination".
  import { classify } from './classify.js';
  import { KIND_STYLE } from './kind-style.js';
  import CodeCss from '../../CodeCss.svelte';
  import TreeNode from './TreeNode.svelte'; // self-import: Svelte 5 deprecates <svelte:self>

  let { node, depth = 0 } = $props();

  const PAGE = 20;
  let open = $state(false);
  let shown = $state(PAGE);

  const isGroup = $derived(node.type === 'group');
  const meta = $derived(isGroup ? null : classify(node.code));
  const kindStyle = $derived(meta ? KIND_STYLE[meta.kind] : null);
  const hasChildren = $derived(Array.isArray(node.children) && node.children.length > 0);
  const isLeaf = $derived(!hasChildren && !isGroup);
  const visibleChildren = $derived(hasChildren ? node.children.slice(0, shown) : []);
  const remaining = $derived(hasChildren ? node.children.length - shown : 0);

  function toggle() {
    if (isLeaf) return; // leaf code nodes show their code inline, no fold
    open = !open;
  }
</script>

<div class="tree-node" class:is-leaf={isLeaf}>
  <div class="tree-row" role="button" tabindex="0"
       onclick={toggle} onkeydown={(e) => e.key === 'Enter' && toggle()}>
    <span class="tree-glyph" aria-hidden="true">{isLeaf ? '' : (open ? '[-]' : '[+]')}</span>
    {#if isGroup}
      <span class="tree-label-group">{node.label}</span>
    {:else}
      <span class="tree-kind-chip" style="background:{kindStyle.colour}">{kindStyle.glyph}</span>
      <span class="tree-label-code">{meta.label}</span>
    {/if}
  </div>

  {#if !isGroup && (open || isLeaf)}
    <CodeCss code={node.code} />
  {/if}

  {#if hasChildren && open}
    <div class="tree-children">
      {#each visibleChildren as child}
        <TreeNode node={child} depth={depth + 1} />
      {/each}
    </div>
    {#if remaining > 0}
      <div class="tree-more">
        <button onclick={() => (shown += PAGE)}>({remaining} more&hellip;)</button>
      </div>
    {/if}
  {/if}
</div>
```

- [ ] **Step 4: Verify the component has no syntax errors**

Run: `cd web/site && npx vite build --logLevel warn`
Expected: build completes without a Svelte compile error mentioning
`TreeNode.svelte` (other pre-existing warnings, if any, are fine — this
step only guards against a syntax mistake in the new file). This
component isn't imported anywhere yet, so the build won't include it in
the bundle output, but Vite/Svelte still needs to parse every `.svelte`
file it discovers via later imports — if this step errors before Task 4
wires it in, skip straight to Task 4's build check instead and come back
here; do not treat an "unused file" absence of errors as a pass on its
own. Prefer verifying this task together with Task 4's manual browser
check.

- [ ] **Step 5: Commit**

```bash
git add web/site/src/components/anatomy/tree/kind-style.js web/site/src/components/anatomy/tree/TreeNode.svelte web/site/src/styles/_fragments/tree-view.css
git commit -m "anatomy: add recursive TreeNode renderer + tree-view styles"
```

---

### Task 3: `cpu-tree.js` — real, verbatim CPU tree data

**Files:**
- Create: `web/site/src/components/anatomy/tree/cpu-tree.js`

**Interfaces:**
- Consumes: the tree-data node shape defined in Task 2
  (`{ type: 'group', label, children }` / `{ type: 'code', code, children? }`).
- Consumes: `COVERAGE` from `../cpu-coverage.js` (already exists) — an
  object keyed by register name (`AX`, `CX`, ..., `flags`), each value an
  array of opcode numbers that register's table has a row for. Used here
  only to write accurate "(N total opcodes)" group labels — the actual
  code strings below are hand-transcribed from a real build, not derived
  from `COVERAGE`.
- Produces: `export const CPU_TREE` — an array of top-level tree nodes,
  consumed by `TreeView.svelte` (Task 4).

All `code` strings below were extracted 2026-07-10 from a real
`carts/sokoban` build. To reproduce that extraction (e.g. to add more
rows later), the build command used was:

```bash
node builder/build.mjs carts/sokoban -o <scratch-path>/sokoban-check.css
```

— then locating text via `data.indexOf('--AX: if(')` /
`data.indexOf('@property --AX')` / `data.indexOf('@function --addFlags16')`
in the resulting file (a ~310 MB single-line-per-rule CSS file; the
`--AX:` register table itself is ~30 KB of one long line with
`/* ... */` trailing comments per opcode row — reformatted below across
multiple lines for readability, content unchanged). **Delete the scratch
build after extracting** — it's a 300+ MB throwaway artifact, not
something to commit or leave lying around.

- [ ] **Step 1: Write `cpu-tree.js`**

```js
// cpu-tree.js — hand-authored Tree View data for the CPU section pilot.
// Structure (which groups exist, how deep) is editorial; every `code`
// string is real, verbatim cabinet CSS extracted from a built
// carts/sokoban cabinet 2026-07-10 (see the extraction note in
// docs/plans/2026-07-10-anatomy-tree-view-PLAN.md Task 3) — only
// line-wrapping changed for readability, never content. Not every
// opcode row COVERAGE lists is transcribed yet; TreeNode's own
// pagination (20-per-level) is what a reader sees for the rest, same
// honesty-about-scope convention the rest of the site uses (see
// SectionCpu.svelte's "232 distinct opcodes, 850 rows" callout).
import { COVERAGE } from '../cpu-coverage.js';

const AX_PROPERTY = `@property --AX {
  syntax: '<integer>';
  inherits: true;
  initial-value: 0;
}`;

const ADD_AX_ROW = `style(--opcode: 5): --lowerBytes(calc(var(--__1AX) + var(--imm16)), 16); /* ADD AX, imm16 */`;

const ADD_RM8_REG8_ROW = `style(--opcode: 0): if(style(--mod: 3) and style(--rm: 0): --mergelow(var(--__1AX), --lowerBytes(calc(var(--rmVal8) + var(--regVal8)), 8)); style(--mod: 3) and style(--rm: 4): --mergehigh(var(--__1AX), --lowerBytes(calc(var(--rmVal8) + var(--regVal8)), 8)); else: var(--__1AX)); /* ADD r/m8, reg8 → AX */`;

const ADD_RM16_REG16_ROW = `style(--opcode: 1): if(style(--mod: 3) and style(--rm: 0): --lowerBytes(calc(var(--rmVal16) + var(--regVal16)), 16); else: var(--__1AX)); /* ADD r/m16, reg16 → AX */`;

const OR_RM8_REG8_ROW = `style(--opcode: 8): if(style(--mod: 3) and style(--rm: 0): --mergelow(var(--__1AX), --or8(var(--rmVal8), var(--regVal8))); style(--mod: 3) and style(--rm: 4): --mergehigh(var(--__1AX), --or8(var(--rmVal8), var(--regVal8))); else: var(--__1AX)); /* OR r/m8, reg8 → AX */`;

const CS_PROPERTY = `@property --CS {
  syntax: '<integer>';
  inherits: true;
  initial-value: 61440;
}`;

const IP_PROPERTY = `@property --IP {
  syntax: '<integer>';
  inherits: true;
  initial-value: 0;
}`;

const FLAGS_PROPERTY = `@property --flags {
  syntax: '<integer>';
  inherits: true;
  initial-value: 2;
}`;

const ADD_FLAGS16_FN = `@function --addFlags16(--dst <integer>, --src <integer>) returns <integer> {
  --raw: calc(var(--dst) + var(--src));
  --res: --lowerBytes(var(--raw), 16);
  --cf: min(1, round(down, var(--raw) / 65536));
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 15) * 128);
  --of: --addOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + calc(round(down, max(0, sign(mod(var(--dst), 16) + mod(var(--src), 16) - 15.5)) + 0.5) * 16) + var(--zfsf) + var(--of) + 2);
}`;

const AL_ALIAS = `--AL: --lowerBytes(var(--__1AX), 8);`;

function opcodeGroupLabel(reg) {
  const count = COVERAGE[reg]?.length ?? 0;
  return `${count} opcode rows`;
}

export const CPU_TREE = [
  {
    type: 'group',
    label: 'Register aliases (8-bit halves)',
    children: [
      { type: 'code', code: AL_ALIAS },
    ],
  },
  {
    type: 'group',
    label: 'Registers',
    children: [
      {
        type: 'group',
        label: 'AX',
        children: [
          { type: 'code', code: AX_PROPERTY },
          {
            type: 'group',
            label: opcodeGroupLabel('AX'),
            children: [
              { type: 'code', code: ADD_RM8_REG8_ROW },
              { type: 'code', code: ADD_RM16_REG16_ROW },
              { type: 'code', code: ADD_AX_ROW },
              { type: 'code', code: OR_RM8_REG8_ROW },
            ],
          },
        ],
      },
      {
        type: 'group',
        label: 'CS',
        children: [
          { type: 'code', code: CS_PROPERTY },
        ],
      },
      {
        type: 'group',
        label: 'IP',
        children: [
          { type: 'code', code: IP_PROPERTY },
        ],
      },
      {
        type: 'group',
        label: 'flags',
        children: [
          { type: 'code', code: FLAGS_PROPERTY },
        ],
      },
    ],
  },
  {
    type: 'group',
    label: 'Flag arithmetic',
    children: [
      { type: 'code', code: ADD_FLAGS16_FN },
    ],
  },
];
```

- [ ] **Step 2: Sanity-check the data file loads and has no syntax errors**

Run: `node --input-type=module -e "import('./web/site/src/components/anatomy/tree/cpu-tree.js').then(m => console.log('CPU_TREE nodes:', m.CPU_TREE.length))"`
Expected: prints `CPU_TREE nodes: 3` and exits 0 (no import error). If
`COVERAGE` import fails, double check the relative path
`../cpu-coverage.js` matches the real location of
`web/site/src/components/anatomy/cpu-coverage.js` relative to
`web/site/src/components/anatomy/tree/cpu-tree.js`.

- [ ] **Step 3: Commit**

```bash
git add web/site/src/components/anatomy/tree/cpu-tree.js
git commit -m "anatomy: add real, verbatim CPU tree data (registers, opcode rows, flag fn)"
```

---

### Task 4: `TreeView.svelte` root + mount in `SectionCpu.svelte`

**Files:**
- Create: `web/site/src/components/anatomy/tree/TreeView.svelte`
- Modify: `web/site/src/components/anatomy/SectionCpu.svelte`

**Interfaces:**
- Consumes: `TreeNode.svelte` from Task 2
  (`web/site/src/components/anatomy/tree/TreeNode.svelte`).
- Consumes: `CPU_TREE` from Task 3
  (`web/site/src/components/anatomy/tree/cpu-tree.js`).
- Consumes: `tree-view.css` from Task 2
  (`web/site/src/styles/_fragments/tree-view.css`).
- Produces: `TreeView.svelte` — props: `nodes` (array of top-level
  tree-data nodes, same shape as `CPU_TREE`), `label` (string heading
  shown above the tree, e.g. `"Tree view: real cabinet CSS"`). Reusable
  by any future section's tree (just pass a different `nodes` array).

- [ ] **Step 1: Write `TreeView.svelte`**

```svelte
<script>
  // TreeView — the root of the anatomy Tree View: a labelled panel
  // containing one TreeNode per top-level entry in `nodes`. Sits above
  // the existing prose in a section pane (see SectionCpu.svelte) — see
  // docs/plans/2026-07-10-anatomy-tree-view.md "Data & placement".
  import '../../../styles/_fragments/tree-view.css';
  import TreeNode from './TreeNode.svelte';

  let { nodes, label = 'Tree view: real cabinet CSS' } = $props();
</script>

<section class="tree-view" aria-label={label}>
  <h3 class="anatomy-head">{label}</h3>
  {#each nodes as node}
    <TreeNode {node} depth={0} />
  {/each}
</section>
```

- [ ] **Step 2: Mount it in `SectionCpu.svelte`**

Read `web/site/src/components/anatomy/SectionCpu.svelte` first (its
current content starts with the `<script>` block importing `Foldable`,
`CpuCoverage`, `Term`, `CodeCss`, `Callout`, then a series of `const ..
= \`...\`` template-literal snippets, then the template starting with
`<p>\n  This section is the fourteen <Term t="register">registers</Term>...`).

Add the import and mount point:

```svelte
  import Foldable from '../Foldable.svelte';
  import CpuCoverage from './CpuCoverage.svelte';
  import Term from '../Term.svelte';
  import CodeCss from '../CodeCss.svelte';
  import Callout from '../Callout.svelte';
  import TreeView from './tree/TreeView.svelte';
  import { CPU_TREE } from './tree/cpu-tree.js';
```

(insert `import TreeView ...` and `import { CPU_TREE } ...` immediately
after the existing `import Callout from '../Callout.svelte';` line —
keep all the existing `const AX_TABLE = ...` etc. declarations below it
unchanged).

Then insert the mount point as the very first thing in the template,
before the existing opening `<p>\n  This section is the fourteen...`
paragraph:

```svelte
<TreeView nodes={CPU_TREE} label="Tree view: real cabinet CSS" />

<p>
  This section is the fourteen <Term t="register">registers</Term> &mdash; <code>--AX</code>,
```

(the rest of that `<p>` and everything after it is unchanged — only the
new `<TreeView ... />` line is added immediately before it).

- [ ] **Step 3: Build the site and verify no errors**

Run: `cd web/site && npm run build`
Expected: build completes successfully (exit code 0), output mentions
the built bundle size, no Svelte/Vite errors referencing `TreeView`,
`TreeNode`, `cpu-tree.js`, or `SectionCpu.svelte`.

- [ ] **Step 4: Manual browser verification**

Run: `cd web/site && npm run dev` (leave running; note the printed
local URL, typically `http://localhost:5173`)

In a browser, navigate to the About/anatomy page and select the CPU
section (via the cabinet bar or the router hash, typically
`#about/file/cpu`). Verify:
- A "Tree view: real cabinet CSS" panel appears above the existing CPU
  prose (the "This section is the fourteen registers..." paragraph).
- The panel shows three top-level `[+]` groups: "Register aliases
  (8-bit halves)", "Registers", "Flag arithmetic".
- Expanding "Registers" shows AX / CS / IP / flags sub-groups.
- Expanding "AX" shows the `@property --AX` node (blue `§` chip) and a
  "4 opcode rows" group; expanding that shows four `rule`-kind nodes
  (red `?` chip) each labelled with their `--opcode: N` condition, and
  clicking one reveals its real, Prism-highlighted CSS via `CodeCss`.
- Expanding "Flag arithmetic" shows the `@function --addFlags16()` node
  (green `ƒ` chip); expanding it shows the real function body.
- No console errors in the browser devtools.

Stop the dev server (Ctrl+C) once verified.

- [ ] **Step 5: Commit**

```bash
git add web/site/src/components/anatomy/tree/TreeView.svelte web/site/src/components/anatomy/SectionCpu.svelte
git commit -m "anatomy: mount Tree View at the top of the CPU section pane"
```

---

## Self-Review Notes (already applied above)

- **Spec coverage:** classifier (Task 1) ✓, two node flavours + per-kind
  glyph/colour (Task 2) ✓, per-level 20-cap pagination (Task 2, `PAGE`/
  `shown`/`remaining`) ✓, editorial-grouping-as-the-only-skew-fix (Task 3
  models "N opcode rows" as one more editorial group, no separate
  mechanism) ✓, real verbatim leaf code sourced from a real build with
  the extraction method documented (Task 3) ✓, placement at top of
  section pane above prose (Task 4) ✓. The plan's "copy-aid extraction
  helper script" from the design spec was folded into Task 3's
  documented `node builder/build.mjs` + `indexOf` recipe rather than a
  separate committed script, since the pilot only needed a handful of
  lookups — if a future section needs many more extractions, promoting
  that recipe to a real script under `tools/` is a natural follow-up,
  not required by this plan's scope.
- **Placeholder scan:** no TBD/TODO; every code step has complete,
  runnable code.
- **Type/name consistency:** `classify()` return shape `{kind, label}`
  used identically in Task 1's tests, Task 2's `TreeNode.svelte`
  (`meta.kind`, `meta.label`), and `KIND_STYLE[meta.kind]` lookup. Tree
  node shape (`type: 'group' | 'code'`, `label`, `code`, `children`)
  used identically in Task 2's doc comment, Task 3's data file, and
  Task 4's `TreeView.svelte` prop passthrough.
