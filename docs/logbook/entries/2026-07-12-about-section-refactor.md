# 2026-07-12 — About section full refactor (structure only, look unchanged)

`About.svelte` (1,400 lines) split into a thin shell + seven
`routes/about/About*.svelte` subpage components; the 375-line
AND/cell-plumbing exhibit strings moved to `lib/exhibits.js` (shared
with SectionClock — was duplicated). Fragment CSS dissolved:
`about.css`/`anatomy.css`/`UNPLACED.css`/`cabinet-bar.css`/
`tree-view.css` deleted; rules moved into the owning components'
scoped `<style>` blocks (pane → AboutFileMap, callout → Callout,
tree → TreeView/TreeAst); genuinely shared bits (`.byte-example`
pane + Prism palette, `.ext-link`) → `global.css`. Dead rules
(`.hero-*`, `.cross-list`, `.anatomy-list`, `.tick-walk`, …) deleted.
New `SectionHead` (30 h3s) + `ProblemBox` (6 dialogs) components.
All hand-wrapped prose unwrapped to one-line-per-paragraph source
(render-identical); `text-wrap: pretty` added site-wide. TricksPage →
attic. Verified: before/after Playwright screenshots of all 17 About
pages + prod build.
