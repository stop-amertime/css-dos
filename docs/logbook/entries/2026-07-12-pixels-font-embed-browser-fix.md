# 2026-07-12 - pixels.mjs font embed: browser-builder graph unbroken

**LANDED.** The text/CGA painters (same day, see that entry) gave
`kiln/pixels.mjs` top-level `node:fs`/`node:path`/`node:url` imports
to read `bios/corduroy/cga-8x8.bin`. `/kiln` is served RAW to the
browser (runtime-assets table, no Vite transform), so the site's
module graph (`builder.svelte.js` → browser-builder → kiln) made the
browser fetch literal `node:fs` URLs - CORS errors on every page
load, and any in-browser build would have thrown at emit.

Fix: the 2048-byte ROM font is embedded in pixels.mjs as base64
(decoded via `atob`, works Node + browser); node: imports deleted.
Emitted CSS proven byte-identical (sokoban before/after sha256 equal
outside the two build-timestamp lines). Site loads clean on the dev
server (headless Chromium: zero console errors / failed requests).
Drift guard: pixels-render.playwright.mjs round-trips glyphs against
the JS decoder, which still reads the bin. Pattern note: dual-env
modules in the served graph must not static-import node builtins -
mkfat12.mjs's guarded dynamic `import('fs')` is the precedent.
