## 2026-05-01 - Repo cleanup: script primitives + bench harness + web/player merge

Big-bang cleanup across both repos. Branches `cleanup-2026-05-01`
in CSS-DOS and calcite.

**Calcite engine - script-primitive layer.** Logged in
`../calcite/docs/log.md` 2026-05-01. Generic measurement primitives
(stride/burst/at/edge/cond/halt + actions emit/halt/setvar/dump/
snapshot) in calcite-core, exposed identically on calcite-cli
(`--watch` flag) and calcite-wasm (`engine.register_watch`). Old
`--cond` / `--poll-stride` / `--script-event` removed cleanly.
Three new modules in calcite-core (`script.rs`, `script_eval.rs`,
`script_spec.rs`); ~280 LOC removed from calcite-cli/main.rs.
Grammar reference: [`docs/script-primitives.md`](../script-primitives.md).

**CSS-DOS bench harness.** New harness at `tests/bench/`:

- `lib/ensure-fresh.mjs` - staleness primitive. Mtime check artifact
  vs declared inputs (file globs + transitive artifact deps);
  rebuild if stale; `--no-rebuild` bypass.
- `lib/artifacts.mjs` - declarative manifest of every built artifact
  (`wasm:calcite`, `cli:calcite`, `prebake:{corduroy,gossamer,muslin}`,
  `cabinet:{doom8088,zork1,montezuma,hello-text}`).
- `driver/run.mjs` - Node CLI. Two transports (web via Playwright,
  cli via calcite-cli). Calls `ensureArtifact` for every required
  artifact before running.
- `page/index.html` - page-side bench runner. Spawns the
  calcite-bridge worker, posts cabinet-blob, listens for compile-done.
- `profiles/compile-only.mjs` - sanity profile; passes end-to-end.
- `profiles/doom-loading.mjs` - six-stage doom8088 boot bench
  (CLI target reaches in-game with kbdtap landed 2026-05-02).

**CSS-DOS-side web/player merge.** `player/*` → `web/player/*`
(history preserved via git mv). `player/calcite-bridge.js` →
`web/shim/calcite-bridge.js`. URL paths kept stable (`/player/...`,
`/sw.js`, `/cabinet.css`, `/_stream/fb`, `/_kbd?key=`); only the
dev-server alias map changed. `?bench=1` inline `<script>` block
removed from `web/player/calcite.html` - the player is now zero-script.
The service worker stays at `web/site/sw.js` because SW scope must
be at-or-above `/`.

**Calcite-side cleanup.** ~17 K LOC removed: `site/`, `programs/`,
`output/`, `serve.mjs`, `serve.py`, 6 `.bat` files; 9 zombie tools
moved to `tools/archive/`; `menu.rs` stripped of the
`node ../CSS-DOS/builder/build.mjs` shell-out (cardinal-rule
violation). `cargo test --workspace` clean.

**Docs.** `docs/rebuild-when.md` (artifact graph + ensureFresh +
/_reset/_clear endpoints); `tools/README.md` rewritten;
`docs/INDEX.md` updated; logbook discipline rule added to both
CLAUDE.md files. Calcite-perf entries (10 days, 2026-04-28 to
2026-05-01) migrated from this LOGBOOK to `../calcite/docs/log.md`
(stubs cross-link). Old `bench/` directory removed; 43 fast-shot
PNGs deleted from `tests/harness/results/` and gitignored; 8
calcite probe `.exe`s deleted (source files stay).

**Validation.** Web bench post-merge: 143 s runMsToInGame /
34.3 M ticks / 398.7 M cycles (cabinet=332 MB). Pre-cleanup
baseline: 134.6 s / 34.5 M ticks / 407 M cycles. +6.5 % wall (within
±10 % budget); ticks/cycles essentially identical. Cargo test:
161 PASS / 4 pre-existing rep_fast_forward failures. wasm-pack: clean.
