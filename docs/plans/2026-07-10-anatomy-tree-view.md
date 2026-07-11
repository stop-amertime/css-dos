# Anatomy Tree View — living conventions + running list

Status: CPU section SHIPPED (see LOGBOOK 2026-07-10/11). This is the
working doc for extending the tree to the other 9 file sections —
principles first (they were hard-won, owner-set; don't relitigate),
then how the pieces fit, then the wishlist.

## Principles (owner-set, binding)

1. **The tree mirrors the file.** Never reorder, re-group, or re-nest
   editorially in the tool/site. If the file's order or structure reads
   badly, improve it **in Kiln** (banners, declaration order, comments)
   — functionality-preserving only — and the tree follows automatically.
   The only editorial invention allowed: top-level pane titles.
2. **Data vs display.** The extracted AST is fully decomposed — a
   node's `code` is ONLY its own token, never text belonging to a
   child. One-lining short chains, indentation, folding, pagination are
   all display logic in `TreeAst.svelte`, never baked into the data.
3. **Round-trip or it didn't happen.** Every extraction recipe must
   reconstruct the raw sliced text from its AST and compare
   (whitespace-stripped), failing generation on mismatch. This caught
   comment-bleed and dropped-text bugs twice; it is not optional.
4. **Grouping comes from Kiln's banners.** `/* ===== NAME ===== */`
   opens a major group, `/* --- name --- */` a sub-group. Better
   banners in Kiln = better tree, for free.
5. **Collapse only at carved points.** `folded:` flags in the data
   (set by the tool's recipe) are the ONLY togglable nodes. Everything
   else renders as plain always-visible code. Never make everything
   collapsible.
6. **Long lists break at comments.** Children render in RUNS delimited
   by standalone comments; each run paginates independently ("(N
   more…)") and the comments are always visible. So: insert comments
   in Kiln **judiciously** where a list *changes kind* — a reader
   wants 200 (or 200,000) same-shaped rows compressed away, but must
   still see that an `else`, a different formula, or a new region
   (RAM cells → BIOS ROM → disk window) appears later. Proven inside
   `if()` values too (`--unknownOp`'s pre-else comment): comments are
   spec-valid wherever whitespace is, and calcite strips them at
   tokenize time — it parses via Servo's `cssparser` crate whose
   tokenizer consumes comments before anything downstream (recognizers
   included) sees the stream; calcite's own parser has no comment code
   at all. Verified 2026-07-11 (+ smoke). Safe for the huge memory
   dispatches too; only cost is the one-pass byte scan.

7. **Depth is always shown, exactly once.** One structural level deeper
   = one tint-ramp step, whether rendered as a block (an if body's
   `.ast-children`), a value on its own line (`.ast-continuation`), or
   a value inline on its condition's row (the `.ast-depth` chip). Never
   two treatments on the same text (that double-highlights).
8. **Uniformity is a property of the sibling run, not the node.**
   Within a comment-delimited run, branches sharing a condition shape
   (condition text with numbers masked — `style(--opcode: #):`) get
   identical treatment: if one wraps, all wrap (renderer,
   `runForcedKeys`); if one folds, all fold (tool carve pass, so folds
   stay data-carved — one-line rows fold to hide just their value). A
   list of like rows must read as a table, no per-row lottery;
   different-shaped members (a trailing `else:`) keep their own
   treatment, which is what makes the genuinely-different row visible.

## How the pieces fit

- `tools/extract-tree-data.mjs` — the generator. Runs the real
  `emitCSS()` on a tiny synthetic cart, slices/parses per section,
  writes `web/site/src/components/anatomy/tree/<section>-tree.js`.
  Reusable primitives: `captureRealCSS`, comment-aware `splitTopLevel`
  / `matchParen`, `parseIf` (recursive if/branch/value AST),
  `assertRoundTrip`. Each section needs its own small recipe (the .cpu
  one parses the whole rule + banner grouping). Regenerate:
  `node tools/extract-tree-data.mjs cpu > web/site/src/components/anatomy/tree/cpu-tree.js`.
- Node model: `section` (label; `boxed:` = one tinted pane per file
  region) / `block` (verbatim chunk, folds to first line) / `decl` /
  `if` (carries `trailer`, its real closing text) / `branch` (carries
  `comment`) / `value`. `folded:` on any = togglable.
- `TreeAst.svelte` — the ONE renderer (sections, blocks, AST). Line
  budget ~80 chars decides one-lining vs split-at-child. `<pre>` lines
  dodge the wizard's inline-code white-chip rule by design.
- `TreeView.svelte` — header: code-file icon + title + real measured
  KB (`<SECTION>_TREE_META.bytes`).
- Styling: cyan `#00aaaa` (EGA colour 3) = interactable ([+] boxes,
  more-buttons; the palette's `--edit-cyan` is bright cyan 11,
  illegible on the light pane). Depth reads via a subtle blue tint
  ramp per `.ast-children` level.

## Playbook: giving another section this treatment

The CPU section took several owner-steered passes; this is the distilled
sequence so the next section takes one. Work top-down; the tree is a
mirror, so almost all the real work is IN KILN.

1. **Survey the real region first.** Capture real output
   (`captureRealCSS()`), then probe: what declarations/rules are
   actually there, in what order, with what existing comments, at what
   file offsets. Never work from assumptions or from what the site
   currently excerpts — both went stale twice during the CPU work
   (`--AL` "aliases", one lone flag function).
2. **Restructure the Kiln emitter** (functionality-inert only —
   custom-prop order within a rule is name-resolved; comments are
   tokenizer-stripped; when unsure whether a move is inert, don't):
   - **Headings**: two banner levels, `/* ===== MAJOR ===== */` and
     `/* --- sub --- */`, names simple and descriptive ("prefix
     detection", not "PREFIX-ADJUSTED INSTRUCTION QUEUE").
   - **Logical grouping + order**: move declarations so related things
     sit together and the order tells the dataflow story (fetch →
     decode → registers → writes). If the file reads badly, fix the
     file — the tree inherits it.
   - **Even commenting density**: every region should be commented to a
     comparable level. Register dispatches have a comment per opcode
     row; MEMORY WRITE SLOTS currently launches into raw slot code with
     nothing — that unevenness is a bug, not a style. Rows that differ
     meaningfully get row comments; repetitive runs get a comment at
     the run boundary instead.
   - **Run-delimiter comments in long lists**: where a list changes
     kind, or before an interesting tail (a lone `else` after N twins),
     plant a standalone comment — the renderer breaks pagination there
     and keeps it visible. Judicious, not mechanical.
3. **Write the extraction recipe** (`tools/extract-tree-data.mjs`):
   slice the region, parse with the shared primitives (comment-aware
   `splitTopLevel`/`matchParen`/`parseIf`), banner-driven grouping,
   `assertRoundTrip` (mandatory), plus a sanity check against an
   independent source (e.g. the CPU recipe asserts all 14 register
   dispatches present; opcode counts were cross-checked against
   `cpu-coverage.js`).
4. **Carve the folds** in the recipe: sections folded; big branching
   decls folded; rows whose value nests an `if` folded; tiny regions
   `'label'` (flat) via the banner-style map. Never make everything
   collapsible.
5. **Wire the pane**: emit `<SECTION>_TREE` + `_TREE_META.bytes`
   (real measured size), mount `<TreeView nodes title bytes>` in the
   section's `Section*.svelte`, pane titles short and plain.
6. **Verify + gate**: regeneration round-trips by construction; dump
   the structure and eyeball it; site build. Any Kiln change → smoke
   minimum; emission changes that touch every cabinet → also writable
   + msdos.
7. **Log it**: entry + LOGBOOK row per protocol; tick the running
   list here.

## Running list

- [ ] **Commenting-consistency pass over the .cpu tree** (owner,
      2026-07-11): commenting level is uneven — register dispatches
      comment every opcode row, but MEMORY WRITE SLOTS launches
      straight into slot code with no comments at all. Bring every
      region up to a comparable density (in Kiln).
- [ ] Extraction recipes for the other 9 sections (util, chipset,
      keys, screen, decl, memr, memw, disk, clock). memr/memw/disk are
      the big ones — pure-streaming emitters, fakeable with tiny
      synthetic opts (surveyed 2026-07-10).
- [ ] Memory section: plant region-boundary comments in Kiln
      (`/* RAM cells */`, `/* BIOS ROM */`, `/* disk window */`) so
      the run-splitting shows the memory map's real shape.
- [x] Calcite comment safety: verified 2026-07-11 — servo cssparser
      tokenizer drops comments before recognizers run (see principle 6).
- [ ] Maybe: opcode-family comments inside register dispatches
      (`/* string ops */`, ...) — tasteful, not mechanical.
- [ ] Decided against for now: moving register `@property` emission
      adjacent to `.cpu` (would fragment the decl block + the site's
      file-map measurements). Revisit only if the owner asks.
