# 2026-06-10 - rep-generic MERGED to calcite main: the x86 string-op cheat is gone

Calcite `main` `cc729b2` (pushed) merges `feat/rep-generic`. Before
merging, the 2026-06-09 review warts were fixed on the branch
(`b2dc52d`): `per_iter_cycles` is now `CycleCharge {property, per_iter}`
so IP/cycle commits go through descriptor-carried names (no literal
"IP"/"cycleCount"); the dispatcher routes on each descriptor's
`key_property` (no literal `--opcode`); panic/diag tables are
descriptor-driven (x86 opname decode deleted). New test: a
`--pc_y`/`--zorch` cabinet commits to its own slots. Verified on
branch: 288 unit tests, calcite-cli A/B vs main byte-identical (7
carts × 2M ticks), smoke 7/7. Post-merge from main: 288 tests, smoke
7/7, doom8088 title via fast-shoot @6M ticks. Residue (tracked, not
blockers): default-off `column_drawer_fast_forward` queued for
deletion; LODS Full-commit loud hole. Detail: calcite log 2026-06-10.
