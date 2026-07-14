## 2026-05-07 - `rep_fast_forward` genericity mission, phase 3a landed

Cross-link: see calcite [`docs/log.md`](../../../calcite/docs/log.md)
2026-05-07 entry (the newest one) for full engine-side details.

Phase 3a of the
[genericity mission](../plans/2026-05-06-rep-fast-forward-genericity.md)
landed: the recogniser now covers all 8 string opcodes (CMPS/SCAS
joined STOS/MOVS/LODS), and descriptors carry a `BulkClass` field
classifying each loop as `ReadOnly` / `Fill` / `Copy` / `PerIter`
purely from CSS shape. The validator was extended to surface drift
between the structural classification and the runtime hardcoded
expectations.

Same in-session re-scope rationale as phase 2: phase 3 was originally
"applier flip + specialisations + CMPS/SCAS + perf gate ±1%" all in
one shippable pack. That's too risky for one session on a perf-gated
mission. Phase 3a is the recogniser+classification half (no runtime
change, no perf risk); phase 3b is the actual applier flip.

Engine-side changes (calcite):

- `match_ip_stay_or_advance` extended to multi-branch IP bodies
  (CMPS/SCAS shape via kiln's `repCondIP`). Pure structural.
- `BulkClass` enum + `classify_bulk()` on `LoopDescriptor`.
- `validate_descriptor_for_opcode` extended with flag_conditioned and
  bulk_class checks.
- 5 new unit tests; 15 / 15 pass.

Validator finding on doom8088: 8/8 string opcodes recognised. STOS
classifies as `Fill` (correct). MOVS classifies as `Fill` rather than
`Copy` - DRIFT message - because the cabinet uses an intermediate
slot (`--_strSrcByte`) between SI's mirror and the write value, so
pure-shape classification can't see the pointer dependency. CMPS/SCAS
classify as `ReadOnly` with `flag_conditioned=true` (correct).

Smoke 7/7 PASS. doom8088 reaches in-game on calcite-cli with the
flag both off and on, tick 34.65M (parity with pre-mission baseline).

What's next (phase 3b): build the descriptor-driven applier behind
the same `CALCITE_REP_GENERIC=1` flag, replace the hardcoded path,
hit ±1% perf gate. Open question: how to handle the MOVS DRIFT -
either trace through the intermediate slot at compile time, or fall
back to PerIter for shapes the structural classifier can't simplify.
