# Raw Player: Identical Chrome + Paintable CSS Pixel Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `web/player/raw.html` look pixel-identical to `calcite.html` (swapping the `<img>` for a 64,000-element CSS pixel grid) and add a new always-on Kiln emit path so that grid is genuinely paintable by spec-compliant CSS.

**Architecture:** Two independent parts. (A) Rewrite `web/scripts/raw-regen.mjs` to derive `raw.html` *from* `calcite.html` with a small, enumerated set of substitutions, so chrome/keyboard can never drift. (B) Add `kiln/pixels.mjs`, a new emitter wired into `emit-css.mjs`, that emits one `background-color` rule per Mode 13h pixel: read the framebuffer byte from the packed `--__1mc{cell}` storage, map the colour index through a shared 256-arm DAC-palette `if()` cascade, paint the pixel. Inert in the calcite/bridge path; only the raw player has `#pN` elements to paint.

**Tech Stack:** Node ≥20 (builtins only), Kiln CSS emitter (`kiln/*.mjs`), Playwright (Chromium) for the small-grid render proof.

## Global Constraints

- **Cardinal rule:** No upstream knowledge in calcite. This is *emitter* work — Kiln is allowed to know VGA/DAC; calcite must still see only integer `--mc` cells and `background-color` rules. Do not touch the calcite engine.
- **Byte-extraction idiom (verified, from `emit-css.mjs:909-914`):** for linear address `A`, colour byte = `mod(var(--__1mc{A>>1}), 256)` when `A&1==0`, else `round(down, var(--__1mc{A>>1}) / 256)`. `PACK_SIZE=2`. The `--__1` prefix is the current-tick double-buffer read alias.
- **Constants (verified, `kiln/memory.mjs`):** framebuffer base `0xA0000`, 320×200=64000 bytes. `DAC_LINEAR = 0x100000`, 256 entries × 3 bytes (R,G,B), stored 6-bit (0..63). 6→8-bit expansion = `round(v * 255 / 63)`.
- **`cellIdxOf(addr) = Math.floor(addr / PACK_SIZE)`**, imported from `kiln/memory.mjs`.
- **raw.html needs `.clock`/`.cpu` wrapper nodes** around screen+keyboard (calcite.html has none — its bridge never applies cabinet rules). Cabinet `:has(#kb-*:active)` and pixel rules are `.cpu`-scoped, so a `.cpu` host must exist and the `#pN`/`#kb-*` nodes must be its descendants.
- **Regression gate:** `node tests/harness/run.mjs smoke` (7 carts) must stay green.
- **Pixel rules are ALWAYS emitted** (per owner decision); perf/size impact to be assessed after, not gated up front.

---

### Task 1: Pixel-paint emitter — colour-index extraction (small-grid testable core)

Build the emitter as a pure string-producing function with an injectable grid size, so the arithmetic can be proven on a tiny grid Chrome can render. Default size is the real 320×200.

**Files:**
- Create: `kiln/pixels.mjs`
- Test: `tests/harness/pixels-emit.test.mjs`

**Interfaces:**
- Produces: `emitPixelPaintRules({ width = 320, height = 200 } = {})` → string of CSS. Emits, in order: (1) a shared palette block (Task 2), (2) one rule per pixel `#p{i}` setting a per-pixel custom property `--ci` to the framebuffer colour index, scoped under `.cpu`. This task implements only the per-pixel index extraction; Task 2 adds the palette→rgb mapping.
- Consumes (from `kiln/memory.mjs`): `cellIdxOf`, `PACK_SIZE`.

- [ ] **Step 1: Write the failing test**

```js
// tests/harness/pixels-emit.test.mjs
import { emitPixelPaintRules } from '../../kiln/pixels.mjs';
import assert from 'node:assert';

const css = emitPixelPaintRules({ width: 2, height: 2 });

// 2x2 = 4 pixels, addresses 0xA0000..0xA0003.
// Pixel 0 @ 0xA0000 (even) → low byte of cell 0xA0000>>1 = 0x50000.
assert.match(css, /#p0\b[^}]*--ci:\s*mod\(var\(--__1mc327680\),\s*256\)/,
  'pixel 0 reads low byte of cell 0x50000');
// Pixel 1 @ 0xA0001 (odd) → high byte of same cell.
assert.match(css, /#p1\b[^}]*--ci:\s*round\(down,\s*var\(--__1mc327680\)\s*\/\s*256\)/,
  'pixel 1 reads high byte of cell 0x50000');
// Exactly 4 pixel rules.
assert.equal((css.match(/#p\d+\s*\{/g) || []).length, 4, 'one rule per pixel');
// Pixel rules must be scoped so they only match inside .cpu host.
assert.match(css, /\.cpu\s+#p0\b|\.cpu\s*>\s*[^{]*#p0\b|#p0[^{]*\{[^}]*--ci/,
  'pixel rules present');

console.log('PASS pixels-emit index extraction');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/harness/pixels-emit.test.mjs`
Expected: FAIL — `Cannot find module '../../kiln/pixels.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// kiln/pixels.mjs
// Pure-CSS Mode 13h framebuffer painter.
//
// Emits one CSS rule per pixel that reads the pixel's framebuffer byte
// from packed memory storage (--__1mc{cell}) and (in Task 2) maps it
// through the live DAC palette to a background-color. ALWAYS emitted;
// inert in the calcite/bridge players (which have no #pN nodes and
// render the framebuffer to an <img>). Only the raw player paints.
//
// This is CSS-DOS PLATFORM knowledge (Mode 13h geometry, DAC layout)
// living in the EMITTER, exactly where memory.mjs/patterns/misc.mjs
// already keep VGA/DAC knowledge. Calcite sees only integer cells and
// background-color rules — the cardinal rule is untouched.

import { cellIdxOf } from './memory.mjs';

const FB_BASE = 0xA0000;

// Per-pixel colour-index read: extract the framebuffer byte at the
// pixel's linear address from its packed cell.
function indexExpr(addr) {
  const idx = cellIdxOf(addr);
  return (addr & 1) === 0
    ? `mod(var(--__1mc${idx}), 256)`
    : `round(down, var(--__1mc${idx}) / 256)`;
}

export function emitPixelPaintRules({ width = 320, height = 200 } = {}) {
  const lines = [];
  lines.push('/* ===== MODE 13h PIXEL PAINTER (raw player only) ===== */');
  const count = width * height;
  for (let i = 0; i < count; i++) {
    lines.push(`.cpu #p${i} { --ci: ${indexExpr(FB_BASE + i)}; }`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/harness/pixels-emit.test.mjs`
Expected: `PASS pixels-emit index extraction`.

- [ ] **Step 5: Commit**

```bash
git add kiln/pixels.mjs tests/harness/pixels-emit.test.mjs
git commit -m "kiln: pixel painter — per-pixel framebuffer index extraction"
```

---

### Task 2: Pixel-paint emitter — DAC palette → rgb()

Add the shared 256-arm palette map and make each pixel paint its `background-color` from its `--ci`. The DAC cells live at `DAC_LINEAR + entry*3 + {0,1,2}`, always present in the address set.

**Files:**
- Modify: `kiln/pixels.mjs`
- Modify: `tests/harness/pixels-emit.test.mjs`

**Interfaces:**
- Produces: `emitPixelPaintRules(...)` now also emits a single shared rule `.cpu { ... }` defining `--rgb` (the painted colour) as a 256-arm `if()` cascade keyed on `--ci`, plus each `#p{i}` rule gains `background-color: var(--rgb)`. Wait — `--ci` is per-pixel, so the cascade must be evaluated per pixel. Implemented as: each pixel rule sets `--ci` AND `background-color: PALETTE(var(--ci))` where `PALETTE` is a shared `@function` so the 256-way table is written once.
- Consumes (from `kiln/memory.mjs`): `DAC_LINEAR`.

> **Why a `@function`, not a custom property:** a custom property holding the cascade would be defined once on `.cpu` and inherit the *same* value to every pixel — wrong. A CSS `@function` (already used across Kiln, see `emitCSSLib`) is re-evaluated per call site with the passed argument, so `--paletteRGB(var(--ci))` resolves per pixel. The 256-way table body is emitted once inside the function.

- [ ] **Step 1: Write the failing test**

```js
// append to tests/harness/pixels-emit.test.mjs
const css2 = emitPixelPaintRules({ width: 2, height: 2 });

// The shared palette @function is emitted exactly once.
assert.equal((css2.match(/@function --paletteRGB/g) || []).length, 1,
  'one shared palette function');

// It reads DAC cells. Entry 1 R-byte @ DAC_LINEAR + 3 = 0x100003 (odd)
// → high byte of cell 0x80001 (0x100003>>1 = 0x80001).
assert.match(css2, /round\(down,\s*var\(--__1mc524289\)\s*\/\s*256\)/,
  'palette reads DAC entry 1 red from correct cell/half');

// 6->8 bit expansion present.
assert.match(css2, /\*\s*255\s*\/\s*63|255\s*\/\s*63/, '6->8 bit expansion');

// Each pixel paints from the function.
assert.match(css2, /#p0[^}]*background-color:\s*--paletteRGB\(var\(--ci\)\)/,
  'pixel 0 paints via palette function');

console.log('PASS pixels-emit palette');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/harness/pixels-emit.test.mjs`
Expected: FAIL — no `@function --paletteRGB`, no `background-color` on `#p0`.

- [ ] **Step 3: Write minimal implementation**

```js
// kiln/pixels.mjs — add DAC import and palette emission.
import { cellIdxOf, DAC_LINEAR } from './memory.mjs';
```
```js
// DAC byte read for palette entry `e`, channel `c` (0=R,1=G,2=B),
// 6-bit value expanded to 8-bit.
function dacChannel8(entry, channel) {
  const addr = DAC_LINEAR + entry * 3 + channel;
  const idx = cellIdxOf(addr);
  const raw = (addr & 1) === 0
    ? `mod(var(--__1mc${idx}), 256)`
    : `round(down, var(--__1mc${idx}) / 256)`;
  return `round(${raw} * 255 / 63)`;
}

// Shared 256-arm palette function: index -> rgb() from the live DAC.
// Written once; re-evaluated per call site (per pixel) with its --ci.
function emitPaletteFunction() {
  const arms = [];
  for (let e = 0; e < 256; e++) {
    const rgb = `rgb(${dacChannel8(e, 0)} ${dacChannel8(e, 1)} ${dacChannel8(e, 2)})`;
    arms.push(`    style(--idx: ${e}): ${rgb};`);
  }
  return `@function --paletteRGB(--idx) {
  result: if(
${arms.join('\n')}
    else: rgb(0 0 0));
}`;
}
```
Then in `emitPixelPaintRules`, emit the function before the loop and paint each pixel:
```js
export function emitPixelPaintRules({ width = 320, height = 200 } = {}) {
  const lines = [];
  lines.push('/* ===== MODE 13h PIXEL PAINTER (raw player only) ===== */');
  lines.push(emitPaletteFunction());
  const count = width * height;
  for (let i = 0; i < count; i++) {
    lines.push(
      `.cpu #p${i} { --ci: ${indexExpr(FB_BASE + i)}; ` +
      `background-color: --paletteRGB(var(--ci)); }`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/harness/pixels-emit.test.mjs`
Expected: `PASS pixels-emit index extraction` then `PASS pixels-emit palette`.

- [ ] **Step 5: Commit**

```bash
git add kiln/pixels.mjs tests/harness/pixels-emit.test.mjs
git commit -m "kiln: pixel painter — shared DAC palette function + per-pixel paint"
```

---

### Task 3: Wire the pixel painter into cabinet output

Emit the pixel rules into every cabinet, right after the keyboard rules.

**Files:**
- Modify: `kiln/emit-css.mjs` (import near line 12; call near line 780)
- Test: `tests/harness/pixels-wired.test.mjs`

**Interfaces:**
- Consumes: `emitPixelPaintRules` from `kiln/pixels.mjs`.

- [ ] **Step 1: Write the failing test**

```js
// tests/harness/pixels-wired.test.mjs
// Build a tiny cabinet and assert the pixel painter is present in output.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert';

const out = 'tests/harness/.tmp-pixels.css';
execFileSync('node', ['builder/build.mjs', 'carts/command-bare', '-o', out],
  { stdio: 'inherit' });
const css = readFileSync(out, 'utf8');
assert.ok(css.includes('MODE 13h PIXEL PAINTER'), 'painter block emitted');
assert.ok(css.includes('@function --paletteRGB'), 'palette function emitted');
assert.ok(/\.cpu #p63999 \{/.test(css), 'full 320x200 grid emitted (last pixel)');
console.log('PASS pixels wired into cabinet');
```
(If `carts/command-bare` is unavailable, substitute any cart from the smoke list — see `tests/harness/run.mjs smoke`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/harness/pixels-wired.test.mjs`
Expected: FAIL — `painter block emitted` assertion (painter not wired yet).

- [ ] **Step 3: Write minimal implementation**

In `kiln/emit-css.mjs`, add to the template imports (around line 12):
```js
import { emitPixelPaintRules } from './pixels.mjs';
```
After the keyboard rules write (around line 780, immediately after `w(emitKeyboardRules());`):
```js
  // 7b. Mode 13h pixel painter (raw player only; inert in calcite path).
  w(emitPixelPaintRules());
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/harness/pixels-wired.test.mjs`
Expected: `PASS pixels wired into cabinet`.

- [ ] **Step 5: Commit**

```bash
git add kiln/emit-css.mjs tests/harness/pixels-wired.test.mjs
git commit -m "kiln: emit Mode 13h pixel painter into every cabinet"
```

---

### Task 4: Small-grid render proof in real Chrome (Playwright)

Prove the index→DAC→rgb CSS is spec-correct by rendering a tiny grid in Chromium against seeded framebuffer + DAC values and reading back computed colours.

**Files:**
- Create: `tests/harness/pixels-render.playwright.mjs`
- Create (fixture, generated by the test): a minimal HTML page that defines `.cpu` with hand-set `--__1mc{cell}` values for a few framebuffer + DAC cells, includes the emitter's small-grid output, and an 8×8 grid of `#pN` nodes.

**Interfaces:**
- Consumes: `emitPixelPaintRules({ width: 8, height: 8 })`.

- [ ] **Step 1: Write the failing test**

```js
// tests/harness/pixels-render.playwright.mjs
import { chromium } from 'playwright';
import { emitPixelPaintRules } from '../../kiln/pixels.mjs';
import { cellIdxOf, DAC_LINEAR } from '../../kiln/memory.mjs';
import assert from 'node:assert';

const W = 8, H = 8;
const painter = emitPixelPaintRules({ width: W, height: H });

// Seed: framebuffer pixel 0 = colour index 5; DAC entry 5 = (63,0,31)
// (6-bit) → expected rgb(255,0,125) after 6->8 expansion (round(31*255/63)=125).
const FB0 = 0xA0000, DAC5 = DAC_LINEAR + 5 * 3;
function setByte(map, addr, val) {
  const idx = cellIdxOf(addr);
  const prev = map.get(idx) || 0;
  map.set(idx, (addr & 1) === 0
    ? (prev & 0xff00) | val
    : (prev & 0x00ff) | (val << 8));
}
const cells = new Map();
setByte(cells, FB0, 5);          // pixel 0 → index 5
setByte(cells, DAC5 + 0, 63);    // R6
setByte(cells, DAC5 + 1, 0);     // G6
setByte(cells, DAC5 + 2, 31);    // B6
const cellDecls = [...cells].map(([i, v]) => `--__1mc${i}: ${v};`).join(' ');

const grid = Array.from({ length: W * H }, (_, i) => `<i id="p${i}"></i>`).join('');
const html = `<!doctype html><meta charset=utf-8>
<style>.cpu{${cellDecls}} #grid{display:grid;grid-template-columns:repeat(${W},8px)}
#grid i{width:8px;height:8px;display:block} ${painter}</style>
<div class="cpu"><div id="grid">${grid}</div></div>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html);
const c0 = await page.$eval('#p0', el => getComputedStyle(el).backgroundColor);
await browser.close();

assert.equal(c0, 'rgb(255, 0, 125)',
  `pixel 0 should be index-5 DAC colour, got ${c0}`);
console.log('PASS pixels render in Chrome');
```

- [ ] **Step 2: Run test to verify it fails (or surfaces a CSS-support gap)**

Run: `node tests/harness/pixels-render.playwright.mjs`
Expected: either FAIL on the colour assertion, or — if the installed Chromium doesn't yet support CSS `@function`/`if()`/`style()` — a transparent/empty `backgroundColor`. **If unsupported:** this is the known reason raw.html is "theoretical." Record the Chromium version and the unsupported feature in the test as a skip with a logged reason, and treat the *calcite render parity* check (Task 5) plus the emitter unit tests (Tasks 1–2) as the correctness evidence. Do NOT fake a pass.

- [ ] **Step 3: Make it pass**

If Chromium supports the features, the test passes once the emitter from Tasks 1–2 is correct (no new code). If a real arithmetic bug surfaces, fix it in `kiln/pixels.mjs` and re-run.

- [ ] **Step 4: Run to verify**

Run: `node tests/harness/pixels-render.playwright.mjs`
Expected: `PASS pixels render in Chrome` (or a clearly-logged skip with version + missing feature).

- [ ] **Step 5: Commit**

```bash
git add tests/harness/pixels-render.playwright.mjs
git commit -m "test: real-Chrome render proof for Mode 13h pixel painter (8x8)"
```

---

### Task 5: Calcite parity — pixel rules must not change the engine path

Confirm the new rules are inert/consistent under calcite: a smoke cabinet's calcite execution (cycles/IP) is unchanged, keeping the cardinal rule honest.

**Files:**
- Test: reuse `node tests/harness/run.mjs smoke`.

- [ ] **Step 1: Capture baseline before Task 3 was merged is not possible post-hoc; instead assert smoke passes now**

Run: `node tests/harness/run.mjs smoke`
Expected: 7/7 (or the current smoke count — STATUS notes 6 while montezuma is deleted on disk; match whatever `run.mjs smoke` enumerates). All green.

- [ ] **Step 2: Sanity that pixel rules don't perturb execution**

Reasoning to record in the commit/log: pixel rules only set `--ci`/`background-color` on `#pN` nodes, which exist in no calcite/bridge player and are never read by the engine (calcite renders the framebuffer to `<img>`, not from DOM `background-color`). They reference existing `--__1mc` cells read-only. Therefore execution (cycles/IP) is identical. Smoke green is the gate.

- [ ] **Step 3: Commit (if any fixup needed)**

```bash
git commit -am "test: confirm smoke green with pixel painter (calcite path unaffected)"
```

---

### Task 6: Rewrite `raw-regen.mjs` to derive raw.html from calcite.html

Make raw.html identical to calcite.html except the enumerated diffs.

**Files:**
- Modify: `web/scripts/raw-regen.mjs` (full rewrite)
- Regenerate: `web/player/raw.html` (committed output)
- Test: `tests/harness/raw-regen.test.mjs`

**Interfaces:**
- The generator reads `web/player/calcite.html`, applies substitutions, writes `web/player/raw.html`.

**The enumerated diffs (and nothing else):**
1. Replace the `<img id="calcite-screen" ...>` element with the pixel grid container: a `<div id="grid" class="screen-grid">` holding 64,000 `<i id="pN">` elements.
2. Wrap the screen + keyboard region in `.clock > .cpu` so cabinet `.cpu`-scoped rules (keyboard `:has`, pixel painter) have a host. (calcite.html's `.window-body` content becomes `<div class="clock"><div class="cpu"> ... </div></div>` around the existing `.screen-cell` and `.keyboard`.)
3. Load the cabinet as a stylesheet: `<link rel="stylesheet" href="/cabinet.css">` replacing calcite.html's `<link rel="alternate" href="/cabinet.css" ...>`.
4. Bottom status-line label `CALCITE` → `RAW`; `<title>` → `CSS-DOS · raw CSS`.
5. Append a `<style>` block for `.screen-grid` (grid geometry, 320 × 1px columns, `image-rendering: pixelated`, sized into `.screen-cell`'s 640×400 box via `transform: scale(2)` or `width:640px;height:400px` with 2px cells — choose so it occupies the same box the `<img>` did).

- [ ] **Step 1: Write the failing test**

```js
// tests/harness/raw-regen.test.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

execFileSync('node', ['web/scripts/raw-regen.mjs'], { stdio: 'inherit' });
const raw = readFileSync('web/player/raw.html', 'utf8');
const cal = readFileSync('web/player/calcite.html', 'utf8');

// Grid: exactly 64000 pixel elements, none in calcite.html.
assert.equal((raw.match(/<i id=["']?p\d+["']?>/g) || []).length, 64000,
  '64000 pixel elements');
assert.equal((cal.match(/<i id=["']?p\d+/g) || []).length, 0,
  'calcite.html has no pixels');

// Full keyboard id set carried over verbatim from calcite.html.
for (const id of ['kb-caps','kb-ctrl','kb-shift','kb-f1','kb-f10','kb-slash','kb-enter','kb-space','kb-up']) {
  assert.ok(raw.includes(`id="${id}"`), `raw has ${id}`);
}
// .cpu host present so cabinet rules can match.
assert.ok(/class="cpu"|class="[^"]*\bcpu\b/.test(raw), 'raw has .cpu host');
// Cabinet loaded as a real stylesheet.
assert.ok(/rel="stylesheet"[^>]*href="\/cabinet\.css"/.test(raw), 'cabinet stylesheet link');
// The <img> screen is gone.
assert.ok(!raw.includes('id="calcite-screen"'), 'no <img> screen in raw');
// Distinguishing label.
assert.ok(raw.includes('>RAW<') || raw.includes('RAW'), 'RAW label');
console.log('PASS raw-regen');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/harness/raw-regen.test.mjs`
Expected: FAIL — current `raw.html` has the old `<key-board>` layout, no `kb-caps`, no 64000 `<i id=pN>` with that exact attribute style, etc.

- [ ] **Step 3: Rewrite the generator**

```js
#!/usr/bin/env node
// web/scripts/raw-regen.mjs
// Generate player/raw.html by deriving it from calcite.html, so the
// two players share chrome/keyboard verbatim and cannot drift. The
// ONLY differences: the <img> screen becomes a 320x200 = 64000-element
// CSS pixel grid, the cabinet loads as a real stylesheet, .clock/.cpu
// wrappers host the cabinet's .cpu-scoped rules, and the label reads RAW.
//
// In principle Chrome evaluates the cabinet and the pixel painter
// (kiln/pixels.mjs) drives #p0..#p63999 from the Mode 13h framebuffer.
// In practice Chrome hangs/crashes on the cabinet's size — the point of
// the "raw" player. calcite.html runs the same machine at speed.
//
//   node web/scripts/raw-regen.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const calcitePath = resolve(__dirname, '..', 'player', 'calcite.html');
const outPath = resolve(__dirname, '..', 'player', 'raw.html');

const W = 320, H = 200;

function pixelGrid() {
  const cells = new Array(W * H);
  for (let i = 0; i < cells.length; i++) cells[i] = `<i id="p${i}">`;
  // newline per row keeps editors from choking; grid layout ignores whitespace.
  const rows = [];
  for (let y = 0; y < H; y++) rows.push(cells.slice(y * W, (y + 1) * W).join(''));
  return `<div id="grid" class="screen-grid">\n${rows.join('\n')}\n</div>`;
}

let html = readFileSync(calcitePath, 'utf8');

// (1) Replace the <img> screen with the pixel grid.
html = html.replace(
  /<img id="calcite-screen"[\s\S]*?width="640" height="400">/,
  pixelGrid());

// (2) Wrap the .window-body content in .clock > .cpu so cabinet
//     .cpu-scoped rules (keyboard :has, pixel painter) have a host.
html = html.replace(
  /(<div class="window-body">)([\s\S]*?)(<\/div>\s*<\/div>\s*<iframe name="kbd-sink")/,
  (_m, open, body, tail) =>
    `${open}\n      <div class="clock"><div class="cpu">${body}</div></div>\n    ${tail}`);

// (3) Cabinet as a real stylesheet instead of <link rel="alternate">.
html = html.replace(
  /<link rel="alternate" href="\/cabinet\.css"[^>]*>/,
  '<link rel="stylesheet" href="/cabinet.css">');

// (4) Distinguishing title + label.
html = html.replace(/<title>[^<]*<\/title>/, '<title>CSS-DOS · raw CSS</title>');
html = html.replace(/>CALCITE</, '>RAW<');
html = html.replace(/CSS-DOS - PLAYING/, 'CSS-DOS - RAW CSS');

// (5) Grid geometry styles, injected before </head>. The grid sits in
//     the same 640x400 box the <img> occupied: 320x200 logical pixels
//     scaled x2, nearest-neighbour.
const gridStyle = `  <style>
    /* AUTOGEN raw-player pixel grid — replaces the calcite <img>. */
    .screen-grid {
      display: grid;
      grid-template-columns: repeat(${W}, 2px);
      grid-auto-rows: 2px;
      width: ${W * 2}px;
      height: ${H * 2}px;
      max-width: 640px;
      image-rendering: pixelated;
      background: #000;
      margin: 0 auto;
    }
    .screen-grid > i { display: block; width: 2px; height: 2px; background: transparent; }
  </style>
`;
html = html.replace(/<\/head>/, `${gridStyle}</head>`);

// Mark the file autogenerated.
html = html.replace(/<!DOCTYPE html>/,
  `<!DOCTYPE html>\n<!-- AUTOGEN by web/scripts/raw-regen.mjs from calcite.html. Do not edit. -->`);

writeFileSync(outPath, html);
console.log(`raw-regen: wrote ${outPath} (${html.length} bytes, ${W * H} pixels)`);
```

> **Implementer note:** the regexes above assume calcite.html's current exact markup (verified 2026-06-30: `<img id="calcite-screen" ... width="640" height="400">`, `>CALCITE<`, `CSS-DOS - PLAYING`, the `<link rel="alternate">`, and the `</div></div>` + `<iframe name="kbd-sink">` tail of `.window-body`). If a regex matches nothing, the substitution silently no-ops — so **each substitution must be asserted** by the Task-6 test. If calcite.html markup has changed, fix the regex to match; do not loosen it into matching the wrong region.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/harness/raw-regen.test.mjs`
Expected: `PASS raw-regen`.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/raw-regen.mjs web/player/raw.html tests/harness/raw-regen.test.mjs
git commit -m "player: raw.html derived from calcite.html + 64k pixel grid"
```

---

### Task 7: Manual browser smoke of raw.html chrome (no cabinet)

Confirm raw.html *renders identically* to calcite.html chrome in a real browser with no cabinet loaded (grid black, full keyboard, menu/status bars, window). Full-cabinet load is the expected crash path and is NOT a pass criterion.

**Files:** none (verification only).

- [ ] **Step 1: Serve and open both players**

Run: `node web/scripts/dev.mjs` (separate terminal), then drive with Playwright:
```js
// throwaway check — do not commit
import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage();
await p.goto('http://localhost:5173/player/raw.html');
await p.screenshot({ path: 'raw-chrome.png' });
await p.goto('http://localhost:5173/player/calcite.html');
await p.screenshot({ path: 'calcite-chrome.png' });
await b.close();
```

- [ ] **Step 2: Compare**

Expected: raw.html shows the same menu bar, EDIT-style window, full keyboard, and bottom status line as calcite.html; the screen area is a black grid instead of the `<img>` loading panel; bottom-right label reads `RAW`. Note: with no cabinet, no `--__1mc` cells are defined, so `--ci` resolves to its `@property` initial (or invalid → transparent → black via the grid background) — black grid is correct.

- [ ] **Step 3: Record outcome** in the LOGBOOK entry (Task 8). Delete the throwaway screenshots.

---

### Task 8: Docs — STATUS, LOGBOOK, player README

**Files:**
- Modify: `docs/logbook/STATUS.md` (active-work note)
- Create: `docs/logbook/entries/2026-06-30-raw-player-pixel-grid.md`
- Modify: `docs/logbook/LOGBOOK.md` (one index row)
- Modify: `web/player/README.md` (raw.html row)

- [ ] **Step 1: Write the logbook entry** (`≤~15 lines`)

```markdown
# 2026-06-30 — raw player: identical chrome + paintable CSS pixel grid

Tag: LANDED

raw.html now derives from calcite.html (web/scripts/raw-regen.mjs),
so chrome/keyboard match exactly; the <img> screen is replaced by a
320x200 = 64000-element CSS pixel grid under a .clock>.cpu host.

New emitter kiln/pixels.mjs (wired in emit-css.mjs after the keyboard
rules) emits, per pixel, a rule reading the Mode 13h framebuffer byte
from --__1mc{cell} and painting background-color via a shared 256-arm
--paletteRGB() DAC function. ALWAYS emitted; inert in the calcite/
bridge path (no #pN nodes there). Cardinal rule untouched — emitter
work only; calcite still sees integer cells + background-color.

Verified: emitter unit tests (index extraction + palette); 8x8 render
proof in real Chrome (rgb readback matches DAC); smoke N/N green
(calcite path unaffected). Full 320x200 is the expected Chrome-crash
path. Perf/size impact of always-emitting TBD (owner to assess).
```

- [ ] **Step 2: Add the LOGBOOK index row** (tag `LANDED`, link to the entry).

- [ ] **Step 3: Update STATUS active-work** with a one-line note that the raw player is fixed + paintable, and flag the always-emit size/compile cost as an open assessment item.

- [ ] **Step 4: Update `web/player/README.md`** raw.html row: note it now mirrors calcite.html chrome and carries the pixel painter; still the theoretical/crash path.

- [ ] **Step 5: Commit**

```bash
git add docs/logbook/STATUS.md docs/logbook/LOGBOOK.md docs/logbook/entries/2026-06-30-raw-player-pixel-grid.md web/player/README.md
git commit -m "docs: raw player paintable pixel grid — status/logbook/readme"
```

---

### Task 9: Assess perf/size impact of always-emitting pixel rules

Owner explicitly wants this assessed (not gated). Measure cabinet size + compile wall delta from the +64k rules.

**Files:** none (measurement; record in LOGBOOK entry).

- [ ] **Step 1: Size delta**

Build one smoke cabinet before/after is not possible post-merge; instead build with the painter and compare against a one-off build with the `emitPixelPaintRules()` call commented out (local, not committed):
Run: `node builder/build.mjs carts/<smoke-cart> -o /tmp/with.css` and (temporarily) without; `wc -c` both. Record bytes added.

- [ ] **Step 2: Compile wall** (only if size delta is material, >~5%)

Per `tests/bench/README.md`, run `node tests/bench/driver/run.mjs compile-only --headed` on a representative cabinet, compare to the STATUS baseline. **Read `tests/bench/README.md` end-to-end first** (mandatory). Check no other agent is benching.

- [ ] **Step 3: Record** the size (and, if measured, compile) delta in the Task-8 LOGBOOK entry, replacing the "TBD" line. If the delta is unacceptable, note the escape hatch: gate `emitPixelPaintRules()` behind a build flag (e.g. `manifest.screen?.cssPixels`), defaulting off — a ~5-line change in `emit-css.mjs` + `build.mjs`. Do not implement the flag unless the owner asks.

- [ ] **Step 4: Commit** the doc update.

```bash
git add docs/logbook/entries/2026-06-30-raw-player-pixel-grid.md
git commit -m "docs: record pixel-painter size/compile impact"
```

---

## Self-Review

**Spec coverage:**
- Part A (chrome identical) → Tasks 6, 7. Keyboard fix is automatic (derives from calcite.html) — covered by Task 6 assertions.
- Part B (paintable grid, always emit) → Tasks 1, 2, 3.
- Cardinal-rule honesty → Tasks 3 (emitter-only), 5 (calcite parity).
- Verification (small-grid proof + reasoning) → Task 4 (8×8 Chrome render), Tasks 1–2 (unit), Task 5 (smoke), Task 7 (chrome smoke). Full-size = documented crash path, not a pass gate. ✓
- Perf assessment (owner asked) → Task 9. ✓
- Docs → Task 8. ✓

**Placeholder scan:** No TBD/TODO in code steps; all code shown in full. Task 4 has a documented *conditional* (Chromium feature support) with an explicit, honest fallback — not a placeholder. Task 9's "TBD" is a value to be *measured*, with the exact measurement steps given. ✓

**Type/name consistency:** `emitPixelPaintRules({width,height})`, `--paletteRGB(--idx)`, `--ci`, `--__1mc{idx}`, `indexExpr`, `dacChannel8`, `cellIdxOf`, `DAC_LINEAR`, `FB_BASE=0xA0000` — used consistently across Tasks 1–6. Insertion point (`after emitKeyboardRules()`, ~line 780) and import line (~12) match `emit-css.mjs` as verified. ✓

**Risk flagged:** Task 4 may reveal Chromium doesn't yet support CSS `@function`/`if()`/`style()`; the plan handles this honestly (skip-with-reason + rely on calcite parity + unit tests), consistent with raw.html being the "theoretical" player.
