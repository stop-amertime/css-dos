# Keyboard branch 1.8× regression closed (apply-on-transition)

2026-05-28 · LANDED · cross-cutting (calcite + CSS-DOS)

The keyboard branch's per-tick `apply_input_edges` cost was a 1.8×
throughput regression on web doom-loading. Closed across four calcite
commits, all on calcite main:

- `763d6cd` (05-22): `#[inline(always)]` gate elides per-tick call
  frame. Fixed boot path; doom-demo within 0.5 % of master.
- `889e4d1` (05-26): inverted iteration + gen cache fixed doomLoad
  slow path. Walk active set (0-2 entries), reference-compare edges.
- `dcc7dd5` (05-28): gate collapsed to one bool field load. Wash on
  perf, cleanup for the structural fix below.
- `f4da585` (05-28): **apply-on-transition.** `State::set_pseudo_class_active`
  writes the gated state-var slot directly via `state.input_edge_groups`,
  installed by `Evaluator::wire_state_for_input_edges` at engine
  construction. Per-tick gate + apply path deleted entirely. Net −73
  lines from calcite-core.

**Web doom-loading bench, 4-run median: 79.5 s / 432K t/s.** Master
2026-05-08 baseline: 77.1 s / 446K. Within ~3 %.

Smoke 7/7 PASS. Calcite unit + integration input-edge tests pass.
Cardinal-rule check ✓ - apply path operates over CSS pseudo classes
+ selectors + state-var slots, no upstream knowledge.

Cross-link: calcite `docs/log.md` 2026-05-28.
