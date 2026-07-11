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

## Running list

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
