## 2026-05-07 — `rep_fast_forward` genericity mission, phase 2 landed

Cross-link: see calcite [`docs/log.md`](../../../calcite/docs/log.md)
2026-05-07 entry for full engine-side details and the validator's
findings on doom8088.

Phase 2 of the
[genericity mission](../plans/2026-05-06-rep-fast-forward-genericity.md)
landed today, but as path B (diagnostic validator) not path A (full
runtime applier). The user accepted the smaller-step landing in-session
for risk reasons — building the per-iter applier *and* its bulk
specialisations *and* hitting the ±1% perf gate in one go was too
ambitious. Path A folds into checkpoint 3.

Engine-side changes (in calcite, see calcite log for details):

- `CALCITE_REP_GENERIC=1` env-var gate, default off.
- `loop_descriptors` mirrored onto `CompiledProgram` so the per-tick
  fast-forward path can validate against them.
- `state.virtual_regions: Vec<VirtualRegion>` populated by recognisers
  at compile time; the bulk path consults it instead of the hardcoded
  0xD0000 carve-out. Stale 0x500 keyboard-bridge entry removed.
- Memwrite addr/val paired by assignment-order proximity (replaces
  phase-1 name-sort heuristic). Cardinal-rule clean — purely
  positional.

Validator finding on the live doom8088 cabinet: 4/4 STOS/MOVS opcodes
(0xAA/0xAB/0xA4/0xA5) recognised with consistent shape. 4/4 CMPS/SCAS
opcodes (0xA6/0xA7/0xAE/0xAF) miss as documented — phase 1's
recogniser doesn't yet handle flag-conditioned exits. Phase 3 fixes
this.

Verification: smoke 7/7 with flag both off and on; doom8088 CLI to
in-game at tick 34.65M with flag on (parity).
