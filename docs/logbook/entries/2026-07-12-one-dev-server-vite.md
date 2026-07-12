# One dev server: Vite absorbs dev.mjs (legacy server retired)

**2026-07-12 · LANDED (master)**

Owner: "I don't want two solutions." The legacy static server
`web/scripts/dev.mjs` (+ dev.bat/dev.sh) is deleted; `npm run dev`
(Vite) is now the ONE dev server for everything.

What moved into Vite (`web/site/vite.config.js` +
`scripts/dev-extras.mjs`, CALCITE_REPO honoured):
- Dev-only aliases: `/builder` (full), `/bench` (tests/bench),
  `/bench-assets` (calcite/programs), `/calcite` (calcite/web),
  `/tests` (web/tests), `/tmp`. (The shared RUNTIME_COPIES table
  already served player/shim/kiln/tools/prebake/carts/calcite-pkg.)
- Endpoints: `/_status`, `/_reset` (wipe+rebuild wasm/prebake),
  `/_clear` (browser cache purge page), `/_carts.json` (legacy alias
  for `/carts/index.json`).
- dev.mjs's stdin `regen` → `npm run regen` (split-regen + raw-regen).

Consumers migrated / verified against Vite:
- websmoke (`tests/harness/web-boot.playwright.mjs`) now spawns Vite —
  **websmoke PASS 3/3** (hello-text, dos-writable, msdos4).
- kbd-e2e drives the legacy `build.html`, which Vite serves —
  **kbd-e2e PASS** (build→ingame + hold-wire chord), so the STATUS
  "needs the legacy dev server" gotcha is deleted, verified not assumed.
- bench README, CLAUDE.md quick start/worktree notes, building.md,
  perf-iteration.md, player/site/vendor READMEs, `.claude/launch.json`
  all updated to `npm run dev`.

Known semantic differences vs dev.mjs (accepted): unknown paths get
Vite's SPA fallback (200 index.html, not 404); no gzip in dev
(localhost; dev.mjs gzipSync'd 300 MB cabinets — strictly worse);
Vite injects its HMR client into served .html (harmless, kbd-e2e
proves it).
