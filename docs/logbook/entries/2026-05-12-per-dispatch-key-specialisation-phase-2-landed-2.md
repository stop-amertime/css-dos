## 2026-05-12 - Per-dispatch-key specialisation phase 2 landed

Phase 2 of `docs/plans/2026-05-12-per-dispatch-key-specialisation.md`:
Expr-level partial evaluator productised from the probe.

**Code (calcite).** Added to
`crates/calcite-core/src/pattern/dispatch_specialise.rs`:

- `specialise_assignments(&mut [Assignment], key, value) ->
  SpecialiseStats` - partial-evaluate every assignment's Expr tree
  in-place; report aggregate counters.
- `specialise_expr(&mut Expr, key, value, &mut SpecialiseStats)` -
  per-tree contract: drop `NeverTakes` branches, fold chains on
  `AlwaysTakes`, leave `Unknown` branches; if all branches drop,
  collapse to specialised fallback.
- `test_outcome(&StyleTest, key, value) -> BranchOutcome` - pub for
  phase-3 code paths that want to reason about decidability. Public
  `BranchOutcome` enum.
- `SpecialiseStats { branches_dropped, conditions_decided,
  conditions_collapsed_to_fallback, conditions_visited }`.

**Tests.** Eight new tests on top of the 10 phase-1 tests: matching
Single folds, rejecting Single drops, Unknown Single kept, And of
(matching, unknown) is Unknown but And of (matching, matching) folds,
Or of (matching, rejecting) folds AlwaysTakes / Or of two rejecting
drops, nested in Calc preserves the wrapper, aggregate `specialise_
assignments` stats, non-literal RHS is Unknown. **18/18 pass.**

**In-pipeline trial.** Extended `CALCITE_SPECIALISE_DIAG=1` in
`Evaluator::from_parsed` to clone the post-fast-path assignments,
specialise on `(hot_key, value)`, and log SC-collapse. Default value
is the smallest in the discovered set; `CALCITE_SPECIALISE_VALUE=<n>`
overrides. New `count_style_conditions` helper added to eval.rs.

**Doom8088, six opcode values:**

| Value | SCs before | SCs after | Kept | Decided | Fallback-coll | Dropped |
|-------|-----------:|----------:|-----:|--------:|--------------:|--------:|
| 0     | 668        | 68        | 10.2% | 11     | 20            | 360     |
| 64    | 668        | 65        | 9.7%  | 5      | 23            | 1006    |
| 137   | 668        | 71        | 10.6% | 15     | 17            | 890     |
| 144   | 668        | 65        | 9.7%  | 3      | 25            | 1312    |
| 184   | 668        | 65        | 9.7%  | 4      | 24            | 1412    |
| 254   | 668        | 70        | 10.5% | 11     | 20            | 1557    |

All within 9.7-10.6 % kept - **phase 2 gate (≤ 10 % SC kept) cleared
on a 6-value sample.** Matches the probe's 9.7 % on `--opcode=64` to
the digit. Specialise cost: 0.00 s on the 147-assignment post-filter
set.

Variability in `decided` / `dropped` is structural: opcodes whose
dispatch-row sits early in the chain short-circuit on AlwaysTakes
(more `decided`, fewer `dropped`); late-chain opcodes walk past
hundreds of rejected rows first (more `dropped`).

**Gates cleared:**
- 18/18 unit tests pass.
- Doom8088 SC collapse ≤ 10 % on 6 sampled opcode values.
- CSS-DOS smoke 7/7 PASS - specialiser unused at runtime (no codegen
  yet), so this confirms the wiring is inert when the env var is
  unset.

**Pick up at phase 3.** Specialised `CompiledProgram` table + runtime
dispatch. Hard gate at phase 3 is CLI bit-equivalence on doom8088
(same `ticksToInGame` + `cyclesToInGame`), compile time ≤ 1.5×
baseline.
