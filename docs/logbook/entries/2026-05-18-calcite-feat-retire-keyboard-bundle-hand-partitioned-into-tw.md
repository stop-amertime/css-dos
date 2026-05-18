## 2026-05-18 — calcite feat/retire-keyboard bundle hand-partitioned into two clean branches

Follow-on to the 2026-05-15 reorg. The parked
`feat/retire-keyboard` bundle (calcite, tip `a05d85c`, 19 commits
over `ef44f20`) fused two unrelated concerns the user wanted on
separate feature branches: the `:active` pseudo-class keyboard
rework, and the cardinal-rule genericity / perf-diagnostic stack.

**Commit-level split is impossible.** A prior history rewrite
(rebase/squash) fused both concerns in every commit's tree from
`866d1b3` onward — the May-6-authored keyboard commit's tree already
contains `calcite_pc_video` refs introduced by a May-12-authored
"upkeep" commit. Author dates do not track tree lineage. Cherry-pick
and rebase splitting both fail. Only a hand-partition (diff final
tree vs `ef44f20`, classify every file/hunk, build two independent
patch sets) works. Decisive evidence:
`git show 866d1b3:crates/calcite-wasm/src/lib.rs | grep calcite_pc_video`
returns 7 hits; `git show ef44f20:...` returns 0.

**Done (both branches now on origin — see corrected repo state):**
- `feat/keyboard-pseudo-input` (`baf3086`, off `ef44f20`, 12 files):
  `:active` pseudo-class input model — `State::pseudo_active`,
  InputEdge recogniser, per-tick `apply_input_edges`, cli
  `--press-events`, wasm export, web `press` bridge, the
  `SetVarPulse`/`Stride{last_fired_at}` watch refactor. Build gate
  clean; both keyboard tests pass.
- `feat/calcite-genericity` (`3592bf0`, off `ef44f20`, 30 files):
  `calcite-pc-video` + `calcite-debug-summary` crates, de-x86
  comment sweep, `column_drawer_fast_forward` deletion,
  `State::virtual_regions`, `loop_descriptor`/`dispatch_specialise`/
  `identity_prune`, `scan_same_key_chain_runs`, BIF2 default-ON,
  probe bins, calcite log entry. Build gate clean.
- Method: 38-file diff classified file- then hunk-level; 5 files
  genuinely cross-cut (`eval.rs`, `compile.rs`, `state.rs`,
  `calcite-cli/main.rs`, `calcite-wasm/lib.rs`). No hunk truly mixed
  the concerns except ~3 mechanical 1-line interleaves (the
  `loop_descriptors` field next to keyboard fields). Whole-file
  buckets via `git checkout`; partials via per-hunk filtered
  patches + hand edits. Full file coverage verified (no orphans).

**Build gate (both branches):**
`cargo build --release -p calcite-core -p calcite-cli -p calcite-wasm`
— never core-only.

**Pre-existing base debt (NOT mine, NOT fixed here):** `ef44f20`'s
calcite lib-*test* target already fails to compile —
`script.rs` defines `WatchKind::Stride{every,last_fired_at}` but
`script_spec.rs:309` matches `Stride{every}`. The simplification is
keyboard-era, so `feat/keyboard-pseudo-input` incidentally fixes it
and `feat/calcite-genericity` (which leaves `script*.rs` at
`ef44f20`) inherits the broken base test. `cargo build` is green on
both; only `cargo test` surfaces it on the genericity branch.

**Repo state (CORRECTED 2026-05-18, verified against git):** The
original version of this entry claimed "nothing pushed; calcite
`main` diverged from origin, push needs `--force`". That is **no
longer true and should not alarm a future agent**:

- calcite `main` == `origin/main` == `ef44f20` (0 ahead / 0 behind).
  The 2026-05-15 history rewrite has been reconciled with origin —
  no force-push pending, no divergence.
- `feat/calcite-genericity` (`3592bf0`) and
  `feat/keyboard-pseudo-input` (`baf3086`) are **on origin**,
  byte-identical local↔origin. The split work is safe, not local-only.
- `feat/retire-keyboard` (`a05d85c`) retained intact, also on origin.
- CSS-DOS `master` unchanged.
- Only genuine loss risk: local-only, not-on-any-origin-branch
  `calcite-v2` / `calcite-v2-rewrite` (dead compiler experiments) —
  unrelated to this split.

Most likely the original claim was written pre-push and the branches
were pushed afterward without updating the entry — a staleness, not a
fabrication. Recorded here rather than silently rewritten so the
correction itself is auditable.

**Open / next:** (1) decide the fate of the intact
`feat/retire-keyboard` branch now that the two split branches
supersede it (keep as archive, or delete once the splits are
blessed). (2) The two split branches have not been bench-validated
end-to-end together; the keyboard branch needs the CSS-DOS-side
`feat/retire-keyboard` (`8c54435`) bench/SW/bridge to exercise the
new path. (3) The genericity branch's perf cost has never been
isolated per-change — see STATUS "active work" item 1.
