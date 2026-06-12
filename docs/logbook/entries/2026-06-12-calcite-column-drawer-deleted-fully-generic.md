# 2026-06-12 — calcite column_drawer deleted: cardinal rule holds tree-wide

Release-audit action. Calcite `main` `788389d` deletes
`column_drawer_fast_forward` + `COLUMN_DRAWER_BODY` + `FusionDiag` +
the `CALCITE_FUSION_FASTFWD`/`CALCITE_FUSION_DIAG` gates (−308 lines
incl. calcite-cli hooks) — the last x86-aware code block, default-off
since 2026-04-29. A pre-deletion audit swept calcite `crates/` for
any other upstream knowledge: none outside comments and test
fixtures. With this, STATUS active-work item 1 is done and the
genericity residue note is cleared. Verified: `cargo build --release`
green, `cargo test -p calcite-core --release` all targets pass,
CSS-DOS smoke 7/7 post-deletion. (`cargo test --workspace` fails on
this host compiling test deps — missing `dlltool.exe`, pre-existing
environment issue, unrelated.) Detail: calcite log 2026-06-12.
