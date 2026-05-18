## 2026-05-06 — `rep_fast_forward` genericity mission, phase 1 landed

Cross-link: see calcite [`docs/log.md`](../../../calcite/docs/log.md)
2026-05-06 entry for the engine-side details. Summary: the
compile-time structural recogniser landed on the calcite side with 9
unit tests + working recognition of 6 self-loop opcodes (MOVSB/MOVSW/
STOSB/STOSW/LODSB/LODSW, opcode 0xA4-0xAD) on the doom8088 cabinet
under `CALCITE_LOOP_DIAG=1`. CMPS/SCAS variants are deferred to phase
2 (their flag-conditioned IP predicate needs flag-aware matching that
ties in with the runtime applier).

Phase 1 produces descriptors; the runtime path doesn't use them yet.
Old `rep_fast_forward` remains active. `node tests/harness/run.mjs
smoke`: 7/7 PASS pre and post change.

Plan: phase-1 checkpoint complete in
[`docs/plans/2026-05-06-rep-fast-forward-genericity.md`](../plans/2026-05-06-rep-fast-forward-genericity.md).
Pick up at checkpoint 2 (descriptor-driven runtime applier behind
`CALCITE_REP_GENERIC=1` flag).
