# 2026-06-12 — cabinet compile wall 30.0 → 4.6 s (web, −85%)

Owner asked for a ground-up look at the ~30 s doom compile. Root
cause: the cabinet is ~90% byte data wearing CSS clothing (rom-disk
dispatch functions, memory-cell scaffolding), and calcite built ASTs
for it then deep-copied the recognised tables three times. Five
calcite commits (`6228955`…`3099813`, log entry 2026-06-12): byte-
level fast paths for literal `@function` dispatch runs and buffer-
copy assignment runs, no more dispatch-table/function-branch deep
copies, FxHashMap entries. Same-day driver A/B: `compile-only`
**29.96 → 10.64 s**, then **4.59 s** after the owned-from_parsed
addendum (calcite `4b107d1` — parsed ASTs move into the evaluator
instead of being cloned; JSONs `docs/benches/compile-only-2026-06-12-
fnfast-{baseline,final,final2}.json`). Every step verified byte-identical
(calcite-cli full state dump, 2M ticks, doom8088); smoke 7/7.

New debug surface: bridge `{type:'phase-report'}` returns calcite's
per-phase compile timings (worker console is invisible; CDP capture
distorts by ~12 s) — `web/tests/compile-phase-capture.playwright.mjs`
prints the breakdown. Runtime perf untouched (compile-time only).
