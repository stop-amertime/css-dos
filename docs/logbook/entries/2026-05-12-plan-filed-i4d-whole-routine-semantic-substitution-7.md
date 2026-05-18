## 2026-05-12 — Plan filed: `__I4D` whole-routine semantic substitution

Planning-only entry. Wrote
[`docs/plans/2026-05-12-routine-semantic-substitution.md`](../plans/2026-05-12-routine-semantic-substitution.md)
in response to the 2026-05-11 cycle-weighted heatmap pinpointing
Watcom's `__I4D` (32-bit signed divide) as 46.1 % of doomLoad cycles.

Mechanism: at compile time, find single-entry-single-exit regions of
the calcite Op stream that look structurally like sub-routines;
symbolically evaluate each region to a closed-form expression per
live-out slot; match against a small catalogue of pure mathematical
functions (initial entries: `signed_div_32`, `signed_mod_32`);
substitute matched regions with a single host op that calls the
catalogue's Rust implementation.

Cardinal-rule defence: the verifier proves equivalence from the
region's **computed function**, not from its bytecode shape or any
name. No hash table of known routines, no name sniffing, no x86
register conventions baked in. A 6502 cabinet's signed-divide or
brainfuck's signed-divide would substitute identically with zero
calcite-side changes. Genericity probe is mandatory at each phase.

Six phases, each independently landable with a defined pass/fail
gate:

1. Region finder + `--probe-routines` CLI flag.
2. Symbolic evaluator (pure-arithmetic Ops + loop-summary templates).
3. Function catalogue + matcher.
4. Substitution emitter + `Op::SubstitutedRoutine`.
5. Correctness sweep (fulldiff doom8088 + smoke + conformance).
6. Perf gate (≥ 5 % doomLoad improvement, 3-run web `--headed`
   median).

No env-var gate. Either it pays unconditionally or it doesn't ship —
same rule as the affine-loop plan.

Hard parts called out explicitly: symbolic-evaluator path-explosion
on the 32-iteration bit-shift loop (needs loop-summary templates),
recognising the closed form `(a/b, a%b)` from the summary,
Return-shape detection at the Op-stream level. Fallback if Phase 2's
full symbolic proof proves too hard: property-test verification
(10K random input pairs at compile time). Weaker defence but still
shape-based.

Out of scope (explicit): affine self-loop fast-forward stays parked,
no whole-program inlining, no hash-based matching even as perf
optimisation.

Picks up at "Order of operations" step 1 in the plan: read the
calcite Op enum end-to-end before any code changes.
