# 2026-07-13 — File Map copy gaps closed (from-scratch doc diff)

Owner asked for a from-scratch, line-by-line re-diff of every anatomy
carousel component against `docs/CSS-DOS-site-copy.md` (lines 701+),
since two earlier passes (this-session's copy-sweep port + intervening
owner/agent refactors) left uncertainty about full coverage. Found and
fixed three real gaps:

- **SectionCpu.svelte**: the instruction decoder (8-byte fetch, prefix
  aliasing `--q0`.`.--q5`, modrm decode), "How do errors work?"
  (`--haltCode`), and "Decode everything, keep what's needed" +
  "Chrome leads to waste, too" (~70 discarded standing values/tick,
  Kiln's `@function`-flattening, `--_cf` hoisting, DAA duplication) —
  three whole subsections were never ported. Confirmed via grep
  (`prefixLen`/`isPrefix0`/`haltCode` appeared nowhere in the repo)
  before adding.
- **SectionKeys.svelte**: "Detecting presses and releases" (`--_kbdPress`,
  the Crimewatch framing) and "Hold mode" (CTRL+G problem, the
  `kb-holdmode` checkbox, the eight `--kbdHeld0-7` pigeonholes) were
  entirely missing.
- **SectionScreen.svelte**: the pixel-rule exhibit still called
  `--paletteRGB` directly and claimed to be the "only" colour-returning
  function — both stale from before the 2026-07-12 text/CGA painter
  work. Verified against `kiln/pixels.mjs`: the real rule dispatches
  through `--screenPx()`, and exactly three functions return
  `<color>`. Fixed to match current kiln output.
- **SectionUtil.svelte**: fixed an internal inconsistency (intro said
  "21 functions", closing paragraph said "the rest of the 66" — a
  leftover from before the 2026-07-12 CPU-section split). Verified 21
  is correct against the generated `util-tree.js` paged data
  (7+4+3+2+1+3+1=21) before rewording.

Numbers double-checked, not assumed: CPU 307KB / Chipset 19KB match
`*_TREE_META.bytes` (the doc's 265KB/16KB are the stale side, no site
fix needed). Verified via headless Playwright against the dev server —
all seven new/changed headings render, zero console errors. Commit
`0364c24`, on top of the owner's concurrent File Map pane restyle
(`690490f`).
