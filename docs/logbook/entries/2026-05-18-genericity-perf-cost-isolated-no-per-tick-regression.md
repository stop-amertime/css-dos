# Genericity↔perf cost isolated: no per-tick regression on the branch

2026-05-18 · FINDING · cross-cutting (CSS-DOS analysis of calcite
`feat/calcite-genericity`; mirrored in `../calcite/docs/log.md`)

Decomposed `feat/calcite-genericity` (`a89067a`/`3592bf0`, 30 files
over `ef44f20`) into a verified per-change perf table, **then
benched it end-to-end** -
`docs/plans/2026-05-18-genericity-perf-cost-isolation.md`. Prior
LOGBOOK perf numbers were treated as untrusted; the conclusion
rests on a fresh measurement, not on those entries.

**Result: the "genericity hurts perf" premise is false - measured.**
One `doom-all --headed` run on `3592bf0` (wasm rebuilt from the
branch) vs the on-disk `ef44f20`/BIF2-off baseline: genericity
**75.9 s / 448.5K t/s / doomLoad 64.8 s** vs baseline
**77–82 s / 416–443K / 65–70 s** - at or below the *fastest*
baseline run on every metric. JSON:
`docs/benches/doom-all-2026-05-18-genericity-3592bf0-run1.json`.
1 run/side (a "much slower" branch would be far outside the ~6%
baseline spread; it's inside/below it) - proves not-a-regression,
no bisect needed. Static analysis agrees: every new pattern module
(`loop_descriptor`/`dispatch_specialise`/`identity_prune`) is called
*only* from `from_parsed` (compile-time) or behind a default-off
`OnceLock` gate - nothing in `execute`/`exec_ops`.
`column_drawer_fast_forward` deletion is dead-by-default removal.

The measured regression STATUS used to pin here -
`apply_input_edges` 162K→297K (`a5e8eee`→`6d9e80a`) - is
**keyboard-branch**, already fixed there, not on this branch (the
2026-05-18 split kept it on `feat/keyboard-pseudo-input`).

**Unblocking consequence:** the only genericity change with unknown
perf cost is the `rep_fast_forward` generic *applier* - unknown
because it was never built. STATUS ship-blocker + active-work
updated to match. Next: build the applier (active-work #1), bench
that against the ±1% gate.
