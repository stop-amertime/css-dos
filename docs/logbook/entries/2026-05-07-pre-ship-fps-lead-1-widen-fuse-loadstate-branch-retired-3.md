## 2026-05-07 — pre-ship FPS lead #1 (widen `fuse_loadstate_branch`): retired

Calcite-side work. Full entry in
[`../calcite/docs/log.md`](../../../calcite/docs/log.md) under
"Widened `fuse_loadstate_branch`: NEGATIVE RESULT". Summary:

- **Hypothesis** (from the pre-ship FPS brief): widening
  `fuse_loadstate_branch` to allow non-aliasing intervening ops
  between `LoadState{dst:X}` and `BranchIfNotEqLit{a:X}` would lift
  the 0.8 % `LoadStateAndBranchIfNotEqLit` hit-rate ~30 % and cut the
  per-tick op floor.
- **Implementation** added a forward scan up to `LS_WINDOW=8` with
  full safety constraints (no read/write of slot X, no memory writes,
  no jump targets, no branch/jump/dispatch ops). Built clean.
- **Result:** **same 50 fusions as the adjacent path**; zero new
  candidates. Reverted.
- **Why:** probe `probe_bif_predecessor` shows 0 of 80,118 isolated
  BIfNELs in `doom8088.css` have a matching `LoadState{dst:X}` within
  a 16-op backward basic-block-bounded scan. 97.3 % of BIfNEL
  predecessors are `Jump` (the BIfNEL is reached *as a jump target*
  from a chain-miss path; the LoadState that fed it lives on a
  different basic block).
- **Bench unchanged:** doom-loading CLI median-of-3 = 241.872s
  (242.892, 241.872, 237.790).
- **Brief updated** to retire lead #1 and elevate lead #3
  (`apply_input_edges` short-circuit) to top pick. Probe
  `probe_bif_predecessor.rs` kept in-tree as a permanent diagnostic.
