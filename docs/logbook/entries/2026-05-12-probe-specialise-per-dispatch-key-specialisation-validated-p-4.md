## 2026-05-12 — `probe-specialise`: per-dispatch-key specialisation validated; plan filed

Productised the "per-opcode specialisation" idea from earlier today
into a measurement and a plan.

**The probe** (`crates/calcite-cli/src/bin/probe_specialise.rs` in
calcite, ~530 lines + helpers). Two phases:

1. Pick the hot dispatch key generically: count, per property name,
   how many `StyleCondition` `Single`-tests reference it across all
   assignments. Return the property with the highest count.
2. For one (key, value) binding, walk every assignment's Expr tree
   and partial-evaluate `StyleConditions`: drop branches whose test
   `NeverTakes`, fold branches whose test `AlwaysTakes`, keep
   `Unknown` branches and recurse. Count nodes before/after.

Zero hardcoded knowledge of x86, opcodes, or any cabinet specifics.
Genericity probe baked in: a brainfuck cabinet's hot dispatch key
would be discovered identically.

**On doom8088 (332 MB cabinet, 362 242 assignments):**

- Auto-picked hot key: **`--opcode`** (1615 SC tests). Next four are
  `--reg` (975), `--mod` (842), `--rm` (736), `--_tf` (39). The 4×
  gap between the top 4 and the rest confirms it's a real spike, not
  noise — and the top 4 are exactly what you'd expect a generic
  CPU-style dispatch to use, but the probe didn't know that.
- Specialising for opcode = 0x40 (INC AX): **StyleConditions 668 → 65
  (9.7 % kept), branches 3130 → 143 (4.6 % kept), Calc nodes 3690 →
  142 (3.8 %), FunctionCalls 2109 → 88 (4.2 %).**
- Hot register-update bodies: `--AX` 2435 → 10 (0.4 %), `--flags`
  1946 → 17 (0.9 %), `--CX/--DX/--BX` 1900s → 6 (0.3 %), `--IP`
  1556 → 13 (0.8 %).
- Repeated for 0x90 (NOP) and 0x89 (MOV r/m,r) — consistent
  collapse, slightly different bodies. Not a one-opcode artefact.

**The caveat the probe also exposed.** Of doom8088's 362 242
assignments, **362 064 (99.95 %) are absorbed by the parser fast-path
as broadcast / packed-broadcast memory writes** before reaching the
IR layer. The probe's aggregate node counts (744K → 725K, -2.6 %)
are misleading because most of those nodes are trivial 2-node
`Literal`/`Var` leaves from non-dispatching cells. The real win is on
the ~178 dispatching assignments, where the collapse is 10-200×.
That's still where today's per-tick "hundreds of dispatches" cost
lives, so it's still the right lever — but the framing needs to be
"shrink the dispatch budget on the hot 178," not "shrink the whole
IR 100×."

**Plan filed.** `docs/plans/2026-05-12-per-dispatch-key-
specialisation.md`. Six phases, each with a hard pass/fail gate.

1. `discover_hot_key` + `discover_key_value_set` as compile-pipeline
   diagnostics. Smallest unit; pays back in genericity-verification
   on the smoke set before heavier passes land.
2. Productise the probe's specialise() into
   `crate::pattern::dispatch_specialise`, 6+ unit tests.
3. Specialised CompiledProgram table + runtime dispatch. **Hard gate:
   CLI bit-equivalence on doom8088 at the same ticksToInGame +
   cyclesToInGame**, smoke 7/7, compile time ≤ 1.5× baseline.
4. Web bench perf measurement, 3-run medians. Conservative floor: ≥ 2×
   ticks/sec on `doom-loading`. Genericity probe: a synthetic 3-value
   brainfuck cabinet must specialise into three bodies with the same
   structural collapse.
5. Value-set dedup (specialised bodies that hash-equal share codegen).
6. Un-gate, ship default-on.

The bit-equivalence gate at phase 3 is the explicit lesson from this
morning's identity-prune failure: smoke 7/7 wasn't enough; doom-load
to in-game tick count is the minimum bar.

**Cardinal-rule defence.** The pass discovers the key structurally
(no hardcoded name), discovers the value set structurally (no fixed
range), and never reads characters out of slot names. Mandatory
brainfuck genericity probe at phase 4. Plan rejects any env-var
shipping gate — pays unconditionally or doesn't ship.

**Status.** Plan filed; STATUS open-work entry updated to point at
the plan. Probe binary committed at calcite `1dd5151` (with the
identity-prune module and the orphan `calcite-debug-summary` /
`calcite-pc-video` crates that were referenced from Cargo.toml but
unstaged). No code in the compile pipeline yet — phase 1 is the
pick-up.
