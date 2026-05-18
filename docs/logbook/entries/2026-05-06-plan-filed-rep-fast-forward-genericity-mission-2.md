## 2026-05-06 — Plan filed: `rep_fast_forward` genericity mission

Planning-only entry. Wrote
[`docs/plans/2026-05-06-rep-fast-forward-genericity.md`](../plans/2026-05-06-rep-fast-forward-genericity.md)
covering the multi-session mission to replace the last cardinal-rule
violation in calcite-core (`rep_fast_forward`, ~341 lines of
hardcoded x86 string-op semantics in
`../calcite/crates/calcite-core/src/compile.rs:5734`) with a generic
CSS-shape recogniser plus a descriptor-driven runtime applier.

Hard constraints fixed up-front so future agents can't drift:

- Cardinal rule. Genericity probe with synthetic brainfuck-shaped
  cabinet must produce equivalent descriptors without calcite-side
  changes.
- Recogniser may not read any character of any slot name. It works
  off slot identity (same-slot checks after compile-time resolution)
  and expression shape only. This forecloses the
  obvious-but-wrong shortcut of name-prefix sniffing.
- Perf gate ±1% on doom8088 `runMsToInGame` web AND native CLI.
- Smoke 7/7 PASS at every checkpoint.
- Single fast-forward path at the end. Old path stays gated during
  transition checkpoints, gets deleted at checkpoint 5.

Five checkpoints, each independently shippable:

1. Recogniser + descriptors + unit tests (compile-time only, old
   path still active).
2. Generic runtime applier behind `CALCITE_REP_GENERIC=1` flag,
   default off. Memory-snapshot diff sweeps prove byte-for-byte
   parity.
3. Specialisation passes for `bulk_fill` / `bulk_copy` shapes. Perf
   gate validated here.
4. Flip default to generic path; soak.
5. Delete `rep_fast_forward` and helpers; close the audit list.

Cross-cutting plumbing: `state.virtual_regions` replaces the
hardcoded `ranges_overlap_virtual(0x500, 0xD0000, 0xF0000)` carve-out
so the generic applier doesn't need to know which CSS-DOS-specific
ranges exist.

Pick up at the next unchecked checkpoint in the plan. No code
landed today.
