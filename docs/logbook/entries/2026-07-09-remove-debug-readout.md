# Removed the CPU register debug readout

**Tag: LANDED**

`emitDebugDisplay` (kiln/template.mjs) emitted a `.cpu::after`
pseudo-element that used CSS counters to print live register values
as on-screen text - leftover debugging scaffolding, not needed now
that the calcite debugger exists. Removed the function, its call
site in kiln/emit-css.mjs, and the now-pointless `debug: true/false`
tags on `REGISTERS`/`STATE_VARS` (they only fed this function; all
vars still emit normally). `node tests/harness/run.mjs smoke` 6/6
PASS; verified freshly-built cabinets no longer contain `.cpu::after`.

Also updated the two places that documented it as a feature:
CABINET-ANATOMY.md §7 (renamed "Debug display + keyboard" →
"Keyboard", dropped the debug-display paragraph + table row) and the
site's anatomy walkthrough (`SectionKeys.svelte`, dropped the debug
read-out subsection + code sample). `KeyboardDemo.svelte`'s own
counter-reset trick is unrelated (its own demo mechanism) - reworded
its comments so they no longer cite the now-removed `.cpu::after` as
precedent.

Not touched: `docs/CSS-DOS-site-copy.md` / `about-copy.md` (prose
copy drafts, not live-rendered - `about-copy.md` still describes the
debug readout in its "Keyboard & debug display" carousel section;
`docs/CSS-DOS-site-copy.md` had unrelated uncommitted changes in
flight when this landed). Follow-up if those drafts get used again.
