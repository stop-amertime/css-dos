# Per-dispatch-key tick-body specialisation

**Status**: phases 1-2 are **BRANCH-ONLY** — they exist on calcite
`feat/calcite-genericity` (`a89067a`), **not on calcite `main`**
(`ef44f20`). Verified 2026-05-18: `discover_hot_key` /
`dispatch_specialise` have zero references on `main`. "Landed" here
means landed *on that branch*, not in the shippable line. Phases 3-6
pending. See the `BRANCH`-tagged 2026-05-12 per-dispatch-key entries
in `../logbook/LOGBOOK.md` for the gate results.

**Headline.** Compile-time partial evaluation of the cabinet's
assignments against each value of the **hottest dispatch key** (the
custom-property name that the most StyleConditions test on). For each
value V of that key, emit a specialised tick body where every
`if(style(--K: V_lit): then; ...; else: fallback)` is folded to its
matching branch (or fallback). At runtime, read the key once, jump to
the specialised body for that value, run a much shorter Op stream.

**Projected win.** Logbook 2026-05-12 frames this as 10-100× tick
throughput. The 2026-05-12 probe (`probe-specialise` in calcite-cli)
confirms the structural premise on doom8088: when the auto-picked hot
key (`--opcode`) is held constant, StyleConditions across the IR layer
collapse to 9.7 % of original, branches to 4.6 %, Calc nodes to 3.8 %.
On the dispatching properties specifically the collapse is sharper —
`--AX` goes 2435 → 10 Expr nodes (0.4 %), `--flags` 1946 → 17 (0.9 %),
`--IP` 1556 → 13 (0.8 %).

**Caveat the probe also exposed.** Most of doom8088's 362 242 assignments
(362 064 of them) are absorbed by the parser fast-path as broadcast /
packed-broadcast memory writes — they never reach the dispatch-bearing
IR. The 10-100× projection applies to the **dispatching part of the
tick** (the ~178 assignments that actually branch on the hot key), not
to a global IR-size reduction. That's still where the per-tick "hundreds
of dispatches" cost lives, so it's still the right lever — the framing
just needs to be tight.

## Cardinal-rule defence

The dangerous shortcut is "calcite knows that `--opcode` is the x86
opcode." Three failure modes to avoid:

1. **Hardcoded key name.** No `if key == "--opcode"` anywhere in the
   pass. The key is discovered structurally by counting the number of
   `StyleCondition` `Single`-test references each property name
   receives across all assignments. The probe confirms `--opcode`
   wins on doom8088 (1615 tests; next is `--reg` at 975). On a 6502
   cabinet it would discover whatever key that cabinet's dispatch
   actually uses. On a brainfuck cabinet with a `--currentCommand`
   key, it would pick that one.
2. **Fixed value range.** No `for v in 0..=255`. The value set is
   discovered by collecting every literal value that appears in a
   `Single` test on the chosen key. doom8088's set happens to be a
   subset of 0..=255; a hypothetical cabinet that branches on a key
   taking values in `{1, 7, 99}` specialises into three bodies.
3. **No knowledge of what the key "means."** The specialiser never
   reads characters out of slot names, never knows that `--AX` is a
   register, never knows the value 0x40 means INC AX. Specialisation
   is generic Expr-tree partial evaluation: given a binding
   `(key = literal_value)`, fold every `StyleCondition Single` test
   on that key, recurse into the rest of the tree.

Operational test from CLAUDE.md: "could a calcite engineer who has
never seen a CPU emulator derive this pass by staring at CSS shape
alone?" — yes, because the rule is "if many StyleConditions across
the cabinet branch on the same property name, and that property
takes a small set of literal values, specialise the cabinet per value
of that property." This is generic partial evaluation; it pays out on
any cabinet with a hot dispatch key.

Genericity probe (mandatory before phase 4): synthesise a small non-x86
cabinet whose CSS has a single hot dispatch key with three literal
values (e.g. a 3-instruction brainfuck shape). The pass must specialise
into three bodies, the hot key's StyleConditions must collapse in each,
and execution must be bit-identical to the unspecialised cabinet. If
the pass overfits to anything x86, the brainfuck cabinet exposes it.

## Out of scope (explicitly)

- **Multiple-key specialisation.** Specialising on tuples of keys
  (e.g. `(--opcode, --reg, --mod, --rm)`) would multiplicatively
  explode code size. The first hot key alone is the lever the probe
  validates; tuple-specialisation is a follow-on if and only if
  single-key wins ship and there's measured headroom.
- **Specialising the broadcast/packed-broadcast paths.** Those don't
  branch on the hot key — they're already a different machine.
- **Env-var gates.** Same rule as the routine-substitution plan: it
  either pays unconditionally or it doesn't ship.
- **Pre-baked specialised cabinets shipped to the user.** Per the
  CSS-DOS cardinal rule, calcite compiles at load time. The pass
  runs in-browser. The compile-time budget is bounded by user
  patience.

## Why this and not the alternatives

- **vs identity-branch pruning (logbook 2026-05-12).** That pass only
  found 16 prunable branches on doom8088 because kiln already strips
  most outer-level identities at emit time. The waste is *inside* the
  per-property dispatches, hidden behind the dispatch. Specialisation
  is the only way to get at it.
- **vs routine-semantic substitution (`2026-05-12-routine-semantic-
  substitution.md`).** That plan targets a specific 46 % cycle hotspot
  (`__I4D`) and pays out hugely on that one call. Per-opcode
  specialisation pays out on **every** tick by shrinking the dispatch
  budget. The two compose: post-specialisation, each per-opcode body
  is short and explicit, which makes routine substitution's symbolic
  walker tractable (it currently has to walk through hundreds of Ops
  with embedded dispatches; post-specialisation it walks ~50 straight-
  line Ops).
- **vs affine-loop fast-forward.** Same compose story — fast-forward
  recognisers see the loop shape on the surface of each ~50-Op
  specialised body, instead of having to see through hundreds of Ops.

So per-opcode specialisation is the **upstream-of-everything-else**
move. It should land first.

## The phases

Each phase is independently landable, with a hard pass/fail gate
defined before measurement.

### Phase 1 — `discover_hot_key` and `discover_key_value_set`

Build the two structural primitives the pass needs. No specialisation,
no codegen. Compile-time only; runtime unchanged.

**Mechanism.**

1. Walk every assignment's Expr tree once. For every `StyleCondition`
   with a `Single` test on property `P` with literal value `V`,
   increment `key_counts[P]` and add `V` to `key_values[P]`.
2. Pick the key with the highest count, breaking ties by lexicographic
   order on the name (deterministic). Report its full value set.
3. Wire as `Evaluator::from_parsed` diagnostic: log
   `[specialise-discover] hot key = <name>, count = <n>, values = <set>`.

This is mostly what `probe_specialise` already does — productise it
into the compile pipeline, gated on a diagnostic env var
(`CALCITE_SPECIALISE_DIAG=1`).

**Gate.** Diagnostic line agrees with `probe_specialise` on doom8088
(top key = `--opcode`, count = 1615). On the smoke set, every cabinet
either reports a hot key with a usable value set (count ≥ N_threshold,
TBD: probably ≥ 10) or reports "no specialisable key." No regressions
(smoke 7/7).

### Phase 2 — `specialise_assignments(key, value) → Vec<Assignment>`

Build the Expr-level partial-evaluator. No codegen, no runtime
integration. Pure transformation on the IR.

**Mechanism.** This is the same logic `probe_specialise` already
implements:

1. For each assignment, clone its Expr tree.
2. Walk the tree; for each `StyleCondition`:
   - Test each branch's condition against the binding `(key = value)`.
   - `NeverTakes` → drop the branch.
   - `AlwaysTakes` → replace the entire condition with the specialised
     branch's `then`.
   - `Unknown` → keep the branch, specialise its `then`.
3. If no branches remain, collapse to specialised fallback.
4. Recurse into Calc / Concat / FunctionCall / Var.fallback.

Productise the probe's `specialise()` into
`crate::pattern::dispatch_specialise::specialise_assignments`. Six
unit tests minimum:

- Branch with `Single { key, Literal(v) }` matching → folds.
- Branch with `Single { key, Literal(v) }` rejecting → drops.
- Branch with `Single { other_key, ... }` → unchanged.
- `And` of (matching, matching) → folds.
- `Or` of (matching, rejecting) → folds.
- Nested `StyleCondition` inside Calc → recurses, outer Calc preserved.

**Gate.** Unit tests pass. Calling the pass with the doom8088
`--opcode` = 0x40 binding produces an `Assignment` set whose total
StyleCondition count is ≤ 10 % of the unspecialised set (probe
already shows 9.7 %).

### Phase 3 — specialised `CompiledProgram` table + dispatch

Build the runtime structure that holds N specialised programs and
selects between them. Still no perf claim — just plumbing.

**Mechanism.**

1. Extend `CompiledProgram` with an optional
   `Vec<(i64 /* key value */, CompiledProgram /* specialised body */)>`.
2. In `Evaluator::from_parsed`, after key discovery, call
   `specialise_assignments(key, v)` for each `v` in the key's value
   set; topologically sort, compile-pipeline the specialised
   assignments through the existing post-Expr passes (broadcast,
   packed, dispatch_table, etc), append to the table.
3. In `Evaluator::tick`, if specialised table is present, read the
   hot key's current value from state, find the matching specialised
   `CompiledProgram` (linear scan or small jump table), run **that**
   Op stream for this tick instead of the generic one.
4. If the current key value isn't in the value set (shouldn't happen,
   but defensive), fall through to the generic Op stream.

**Hard parts.** The post-Expr compile passes (broadcast recognition,
packed broadcast, dispatch table, loop descriptors) currently run
once on the full assignment set. Running them N times per value adds
compile time. Phase 3 measures: how much.

**Gate.**
- CLI bit-equivalence on doom8088: control vs treatment reach
  in-game at the same `ticksToInGame` and `cyclesToInGame`. (The
  2026-05-12 identity-prune attempt failed this gate — make it the
  minimum bar.)
- Smoke 7/7 PASS.
- Compile time (web bench `compile-only`) ≤ 1.5× the unspecialised
  baseline (currently 27.8 s; gate is 41.7 s). If it overshoots,
  phase 3 is incomplete — fix the compile-cost path before shipping.

### Phase 4 — perf measurement

Run the canonical web bench. Quote 3-run medians per
`tests/bench/README.md`. Compare specialised vs unspecialised
on the same host, same Chrome, same hour.

**Profiles.**
- `compile-only` — confirm compile time within the phase 3 budget.
- `doom-loading` — wall to in-game, ticks/sec.
- `doom-ingame-fps` — steady-state FPS (noisy, but trend should be
  unambiguous if the win is real).

**Gate.** Conservative success: ≥ 2× ticks/sec on `doom-loading` web
bench, 3-run median. The probe's structural numbers project
substantially more (10-100× from the logbook framing, modulo the
broadcast-write caveat), but 2× is the floor below which the move
isn't worth the compile-cost and code-size trade.

Genericity verification before claiming the gate: run the brainfuck
cabinet probe from "Cardinal-rule defence" above. The pass must
specialise into three bodies, the hot key's StyleConditions must
collapse in each, and execution must be bit-identical.

**If the gate misses but the structural collapse holds**, the
hypothesis "shrinking dispatch budget per tick = faster tick" is
wrong — likely because the dispatch cost isn't the dominant per-tick
cost, or the dispatch cost in the engine is amortised differently
than the IR-node count suggests. Stop and re-baseline before
spending more compile budget.

### Phase 5 — value-set compression

If phase 4 ships, this phase reduces the code-size and compile-time
overhead.

Observation: many specialised bodies will be structurally identical
to each other (e.g. all the "this opcode doesn't write to AX"
opcodes produce the same `--AX` specialisation). Hash specialised
bodies for equivalence; deduplicate.

**Mechanism.**

1. After specialising for every value V, hash each specialised
   `CompiledProgram` (or each per-property Expr post-specialisation,
   pre-codegen — equivalence detection is cheaper at the Expr layer).
2. Group values by specialisation-equivalence class.
3. Compile only one body per class.
4. Runtime dispatch: small lookup `value → class_id → CompiledProgram`.

**Gate.** Specialised body count drops by ≥ 2× vs phase 4 with no
behaviour change. Compile time drops proportionally. Bit-equivalence
preserved.

### Phase 6 — turn the env-var gate off

Per project convention: a pass either ships unconditionally or it
doesn't ship. Once phase 4 has held for a week with no regressions
reported, remove `CALCITE_SPECIALISE_DIAG`, make the pass default-on
unconditionally, delete the fallback to generic dispatch.

If phase 5 didn't land but phase 4 did, that's fine — the pass ships
without dedup; phase 5 is optimisation.

## Compile-time strategy (the hard part)

Phase 3's gate is "compile time ≤ 1.5× baseline." The naive approach
("rerun the entire compile pipeline N times") is ~4 × baseline (256
specialisations of a 1.6 s post-parse compile-stage budget on
doom8088, optimistic). That misses the gate.

Three sources of savings:

1. **Share Expr-walk work.** The IR has one tree per assignment.
   Specialising doesn't need to re-walk every assignment for every
   value — for an assignment that doesn't contain the hot key, the
   specialised tree IS the original tree (no clone needed). The
   probe already shows this: 362 204 / 362 242 assignments are
   "unchanged" by specialisation on `--opcode = V` because they
   don't dispatch on `--opcode`. Only ~38 assignments actually
   change per value; the rest can be shared by reference.
2. **Run the post-Expr passes on the delta.** Broadcast-recognition,
   packed-broadcast, etc., only depend on the assignments that
   specialise — and those are the same ~38 per value. Rerun those
   passes against the small delta, not the full set.
3. **Phase 5 dedup runs at the Expr layer.** Identical specialised
   Expr trees ⇒ skip the post-Expr passes entirely.

Concrete budget: target ≤ 50 % compile-time overhead post-phase-5
(i.e. 27.8 s → ≤ 42 s). If we miss that, the move ships only at
larger granularities (e.g. specialise on the top 16 hot opcodes, not
all 256) until phase 5 closes the gap.

## Order of operations

1. **Phase 1** — `discover_hot_key`. Smallest unit of work; lets the
   diag flag report on all cabinets in the smoke set and confirm
   genericity in the wild before the heavier passes land.
2. **Phase 2** — `specialise_assignments`. Pure Expr transformation;
   completable in isolation; unit-testable.
3. **Phase 3** — runtime dispatch + bit-equivalence gate.
4. **Phase 4** — perf measurement and the brainfuck genericity probe.
5. **Phase 5** — value-set dedup. Optional, but probably required for
   ≤ 50 % compile-time overhead.
6. **Phase 6** — un-gate and ship.

## Pick up at

Phase 1. The probe (`probe-specialise` in calcite-cli) already implements
the key-discovery and specialisation logic — productise it into
`crate::pattern::dispatch_specialise` with the diagnostic env var and
unit tests as listed in phase 1's gate.
