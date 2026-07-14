# 2026-06-09 - FINDING: per-tick op profile - 845 ops/tick, >⅓ is pure data movement (calcite-engine work, detail in calcite log)

First per-tick magnitude pulled from calcite's existing
`--op-profile` (doom8088, 2M-tick boot window): **845 dispatched ops
per guest instruction**. LoadSlot 28% + LoadLit 8% - copy
elimination is the biggest lever absent from the 2026-05-14
seven-item list; branch/dispatch machinery (that list's items 1–3)
is ~30%; ~59 map probes/tick (the "~50" guess was right). Also on
record: list item 5 (unchecked slot access) had already landed
2026-04-14 - the 2026-05-14 "−30%, never retry" DEAD entry
re-attempted a done thing; and `COLUMN_DRAWER_BODY` (hardcoded Doom
x86 bytes, default-off) still sits in `compile.rs` - delete at
genericity-ship time alongside `rep_fast_forward`. Full analysis +
proposed copy-propagation pass: calcite `docs/log.md` 2026-06-09.
