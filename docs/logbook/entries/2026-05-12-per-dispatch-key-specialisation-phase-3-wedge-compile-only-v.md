## 2026-05-12 - Per-dispatch-key specialisation phase 3 wedge: compile-only verify-mode diagnostic

Plan: `docs/plans/2026-05-12-per-dispatch-key-specialisation.md`,
phase 3. First wedge - compile-cost reality check before runtime
integration.

Behind `CALCITE_SPECIALISE_VERIFY=1` (calcite `eval.rs`), the
`from_parsed` diagnostic now also clones the post-sort assignment set,
runs `specialise_assignments(key, v)` for the first N values
(`CALCITE_SPECIALISE_MAX_VALUES`, default 4), and pushes each through
the full `compile::compile` pipeline. No `Evaluator` wiring - purely
"does specialised compilation succeed structurally, and how expensive
is it?"

**doom8088, 4 of 232 `--opcode` values:**

| metric                          | unspecialised | specialised (per value) |
|---------------------------------|--------------:|------------------------:|
| per-variant compile             |       -       |         1.07 – 1.17 s   |
| post-fuse op count              |      280 K    |              ~280 K     |
| slot count                      |      12 473   |              12 473     |
| `fuse_cmp_branch`               |      77 100   |             ~16 450     |
| `dispatch chains`               |        208    |                  34     |
| `fuse_diff_slot_bifnel_pairs`   |        794    |                  30     |

**The picture is messier than the probe suggested, but the lever still
exists - just lower in the stack.** Op count barely changes (the
broadcast/packed paths dominate, and they don't specialise). But the
unspecialised compile generates **26× more BIfNEL2 fusions** and
**4.7× more CmpBranch fusions** - those represent branch chains the
peephole stack collapses. In specialised IR those branches don't exist
to begin with. The per-tick win is **branch-free path shape**, not op
count.

**Compile-cost reality.** 232 × 1.1 s ≈ 250 s = 9 × baseline; the
1.5 × gate (41.7 s) is far away. Phase 5 (value-set dedup) is now
**mandatory not optional**, OR the phase-3 compile pipeline needs
restructuring to share work across variants:

- Prologue/tail factoring (compile prologue once, reuse across N
  specialised tails).
- Sub-`compile()` variant that takes precomputed broadcast / packed
  metadata and only re-runs the assignment-loop portion.

**`--opcode` is mid-tick, complicating runtime dispatch.** Not a
state-var; recomputed each tick as `--opcode = var(--q0)`. Runtime
swap (phase 3b) needs either:

- (a) prologue/tail split: run unspecialised prologue, read
      `--opcode`, jump to specialised tail.
- (b) differential check: run unspecialised, read opcode from its
      slot via `compiled.property_slots`, run matching specialised on
      a state clone, diff writebacks.

(b) is the bit-equivalence gate (identity-prune-style breakage
catcher). (a) is the eventual perf path.

**Smoke not run yet** - verify-mode is compile-only so far. Next
wedge: per-tick differential check.

Commits: calcite `1f890c4` (eval.rs diagnostic) + `fc5980b` (log).
See calcite log 2026-05-12 entry for the full numbers and tradeoff
breakdown.
