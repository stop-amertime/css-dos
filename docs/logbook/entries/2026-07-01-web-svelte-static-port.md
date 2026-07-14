# Website: Svelte 5 port + static-hosting rebuild (no dev server)

**2026-07-01 · LANDED (master `4dc7092`)**

The `web/site/` site is now a Svelte 5 app that builds to a plain
static `dist/`, replacing the monolithic HTML+JS site and its bespoke
Node dev server. 1:1 port of look/behaviour, DRY'd into components.

- **Svelte 5 (runes) under `web/site/src/`.** `Build`/`Nav` classes with
  `$state` fields (`lib/builder.svelte.js`, `lib/router.svelte.js`) back
  the reactive UI directly - no MutationObserver/hidden-DOM signalling.
  Routes (`About`/`Build`/`Play`) + components (StepDots, RadioGroup,
  CartCard/Grid, SpecTable, BuildProgress, SourceViewer, …). Hash routing
  keeps deep-links/refresh working (`#about`/`#build`/`#play`).
- **`display.cover` in program.json.** A cart opts onto the landing grid
  by declaring `display.cover`; name/description come from the same
  program.json (no second frontend manifest). `carts.js` deleted.
  Documented in `docs/cart-format.md`.
- **Static hosting - dev == prod, one source of truth.**
  `web/site/scripts/runtime-assets.mjs` holds a single `RUNTIME_COPIES`
  table (`[urlPath, srcDir]`) for every root-absolute runtime file the
  site fetches but Vite doesn't bundle: the browser-builder ESM graph +
  its reach (builder/lib, builder/stages, kiln, tools/mkfat12), presets,
  dos/bin, prebake, shim, player, calcite/pkg (vendored WASM), carts.
  Dev middleware serves that table off disk; build `closeBundle` copies
  it into `dist/`, emits `carts/index.json` (the directory listing a
  static host won't give the browser - same `[{name,files,program}]`
  shape the app consumes) and `vercel.json` + `_headers` (COOP/COEP for
  SharedArrayBuffer). The browser-builder import is marked Rollup-external
  so it's copied, not bundled - no shebang/Node-ism problems; the one CLI
  shebang (`tools/mkfat12.mjs`) is stripped on serve+copy.
- **Deleted:** the old externalize hack + the 210-line dev-middleware
  (`/_status`, `/_reset`, `/_clear` all gone). Root `npm run dev` now runs
  Vite; `dev:legacy` keeps `web/scripts/dev.mjs` for the two Playwright
  harnesses that still target the old `build.html` / bench-page DOM.

**Verified** on a pure static host (custom COOP/COEP server + Chromium):
`crossOriginIsolated=true`, calcite bridge + SW live on a deep-linked
`#build` entry, cart grid from `/carts/index.json`, and a full 323 MB
Doom8088 cabinet built end-to-end through the copied browser-builder
graph. Cabinet output is byte-identical by construction (manifest built
the same way as the old build.js). `vite build` clean.

**Not done (owner-visible follow-ups):** legacy site files
(`assets/{build,wizard,learn,carts}.js`, `{site,wizard}.css`,
`build.html`, `split.html`, `index.old.html`, `web/scripts/split-regen.mjs`)
and the old `web/scripts/dev.mjs` still exist - deleting them breaks
`web/tests/kbd-e2e.playwright.mjs` (STATUS's only real-path keyboard
coverage) and `compile-phase-capture.playwright.mjs`, which drive the old
DOM. Migrating those two harnesses to the Svelte `/build` route is the
prerequisite for the final delete.
