# rep-generic dispatcher recovered; recogniser ip-slot shape gap found

**2026-06-08 · BRANCH/FINDING · calcite `feat/rep-generic`**

Recovered the cheat-removal deliverable from a wedged 2026-05-29
session (it hung awaiting a task-notification that never arrived;
transcript salvaged from the local `.jsonl`). The Task 3.5
descriptor-driven `rep_fast_forward` rewrite was sitting uncommitted in
the calcite `rep-generic` worktree — committed (`247b274`) + pushed to
`origin/feat/rep-generic`. It deletes the 341-line hardcoded x86
string-op table (+120 / −522), routing purely through `LoopDescriptor`
→ `BulkClass` → `apply_*_with_commit`. Obsolete `tests/rep_fast_forward.rs`
(asserted the deleted table) deleted. Unit suite green (281+28+7+5+10),
all three calcite binaries build.

**NOT shippable yet.** Smoke 6/7 panic:
`applier-unsupported — REPE/REP STOSW (op=0xab) ... ip_extra_advance_slot
not captured`. Root cause is a recogniser shape mismatch, NOT the
dispatcher: `extract_ip_extra_advance_slot` models IP-advance as
top-level `Add(dispatch, prefixLenVar)`, but real cabinets encode it as
a per-opcode `_repContinue`-gated body
(`__1IP − prefixLen` during REP, `__1IP + 1` after). The
`ip_extra_advance_slot_*` unit tests hand-build the wrong shape, so they
pass while every real cabinet panics — false-green coverage. First
hypothesis (descend the TF/IRQ `StyleCondition` wrappers) disproven by
the real CSS.

Full analysis + next-step design lives in **calcite `docs/log.md`
2026-06-08** (engine work logs there per logbook discipline). Remaining:
teach the recogniser the gated-subtraction IP shape, then smoke 7/7 +
±1% perf bench (neither passed yet — branch-only, do not mark LANDED).
Unknown: whether all 6 failing carts share this one shape.
