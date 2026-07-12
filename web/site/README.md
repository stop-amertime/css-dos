# web/site — the CSS-DOS website

Svelte 5 (runes) single-page app: the landing page + the cart→cabinet
build wizard + the Play/player launcher. Builds to a **plain static
`dist/`** that runs on any header-capable static host — no Node server
at runtime.

## Run it

```sh
npm run dev        # from the repo root — starts Vite on :5173
npm run site:build # from the repo root — static build into web/site/dist/
# or, from web/site/:
npm run dev | npm run build | npm run preview
```

Set `CALCITE_REPO` when running from a worktree so the freshly-built
calcite WASM is picked up (else the vendored `web/vendor/calcite-pkg/`
copy is served). See the repo `CLAUDE.md`.

## How it hangs together

- **`src/`** — the app. `lib/builder.svelte.js` (`Build` class, `$state`)
  and `lib/router.svelte.js` (`Nav` class) back the UI reactively;
  `routes/` are the three wizard steps (About / Build / Play — About
  hosts the Home hero as its first page, then Why? and the info
  pages), `components/` the shared pieces. Hash routing
  (`#home`/`#about/<page>`/`#build`/`#play`) so refresh/deep-links
  work; legacy hashes (`#about/intro`, `#how`, `#why`) still resolve.
- **The build runs in the browser.** `builder.svelte.js` imports the
  `/browser-builder/main.mjs` graph as native ESM and calls
  `buildCabinetInBrowser(...)` — the same kiln/builder code the Node
  path uses, producing a byte-identical cabinet.

## Static hosting — the one thing to understand

The app fetches a set of files at **root-absolute URLs** that Vite does
NOT bundle: the browser-builder ESM graph (+ its `kiln/`, `builder/`,
`tools/` reach), `presets/`, `assets/dos/`, `prebake/`, `shim/`,
`player/`, `calcite/pkg/` (WASM), and `carts/`. These live outside
`web/site/`, so they can't just sit in `public/`.

`scripts/runtime-assets.mjs` is the **single source of truth**: a
`RUNTIME_COPIES` table mapping each URL prefix to its on-disk dir.
`vite.config.js` uses it two ways so **dev and prod fetch identical
URLs**:

- **dev** — a middleware serves the table off disk (with COOP/COEP).
- **build** — `closeBundle` copies the table into `dist/`, then emits:
  - `carts/index.json` — `[{name, files, program}]`, the cart directory
    listing a static host won't give the browser. Adding a cart needs a
    rebuild.
  - `vercel.json` + `_headers` — COOP/COEP (cross-origin isolation).
    **Optional**: the engine is single-threaded WASM over postMessage and
    runs fine without isolation (verified end-to-end 2026-07-04 — see
    logbook). Emitted anyway to keep the door open for a future
    wasm-threads/SAB path; header-less hosts (e.g. GitHub Pages) work.

The browser-builder import is marked Rollup-external (copied, not
bundled — avoids its CLI shebang / Node-shaped files). The one shebang
(`tools/mkfat12.mjs`) is stripped on both serve and copy.

## Featured carts

A cart appears on the landing grid by declaring `display.cover` in its
`program.json` (name/description come from there too). See
`docs/cart-format.md`.

## Legacy (being retired)

`build.html`, `split.html`, `index.old.html`, and `assets/*.js|*.css`
are the pre-Svelte site pages. They're kept only because
`web/tests/kbd-e2e.playwright.mjs` and
`compile-phase-capture.playwright.mjs` still drive the old DOM — the
ONE dev server (`npm run dev`, Vite) serves them alongside the Svelte
site (the separate legacy server `web/scripts/dev.mjs` was retired
2026-07-12; its aliases and `/_status`//_reset`//_clear` endpoints
moved into `vite.config.js` + `scripts/dev-extras.mjs`). Migrating
those two harnesses to the Svelte `/build` route is the prerequisite
for deleting the old pages.
