# 2026-07-13 - Shared prose/demo CSS hoisted to global.css

**LANDED** `ecd22c0`.

Owner report: bracket lists dead in the CPU section's "CPUs for
dummies" foldable - `.sim-list`/`.bracket-list` were scoped to
AboutHow.svelte, so SectionCpu's uses rendered as browser defaults.
Audit script (cross-refs every class use vs definition across
`web/site/src`) found the wider pattern. Hoisted to global.css:
sim/bracket lists, the `.tok-*` code-token palette (was 6
near-identical scoped copies), `.demo-toggle` push-button chrome
(was 4 copies). Deliberate divergences stay as scoped overrides
(KeyboardDemo green keycodes; TickClock red `@keyframes`/green
selectors - attic-only anyway). NOT hoisted: `.caption`,
`.demo-box*`, `.ph-*` - same names, different designs per component.
Verified by computed-style probes on keys/memw/screen/how/cpu:
colours + chrome byte-identical, console clean.
