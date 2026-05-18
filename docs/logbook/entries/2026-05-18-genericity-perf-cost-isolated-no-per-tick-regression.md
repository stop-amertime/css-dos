# Genericity↔perf cost isolated: no per-tick regression on the branch

2026-05-18 · FINDING · cross-cutting (CSS-DOS analysis of calcite
`feat/calcite-genericity`; mirrored in `../calcite/docs/log.md`)

Decomposed `feat/calcite-genericity` (`a89067a`/`3592bf0`, 30 files
over `ef44f20`) into a verified per-change perf table —
`docs/plans/2026-05-18-genericity-perf-cost-isolation.md`. Read the
actual diff, not the prose.

**Result: the "genericity hurts perf" premise is false for this
branch.** Every new pattern module (`loop_descriptor`,
`dispatch_specialise`, `identity_prune`) is called *only* from
`Evaluator::from_parsed` (compile-time) or behind a default-off
`OnceLock` env gate. Nothing is wired into `execute`/`exec_ops`.
Verified via `git grep` of all call sites. The one default-on
behavioural change, BIF2 fusion default-on, is a measured *win*
(+4.5% tput / +8% fps web, 2026-05-08). `column_drawer_fast_forward`
deletion is dead-by-default code removal (0 runtime effect).

The measured regression STATUS used to pin here —
`apply_input_edges` 162K→297K (`a5e8eee`→`6d9e80a`) — is
**keyboard-branch**, already fixed there, not on this branch (the
2026-05-18 split kept it on `feat/keyboard-pseudo-input`).

**Unblocking consequence:** the only genericity change with unknown
perf cost is the `rep_fast_forward` generic *applier* — unknown
because it was never built. STATUS ship-blocker + active-work
updated to match. Next: build the applier (active-work #1), bench
that against the ±1% gate.
