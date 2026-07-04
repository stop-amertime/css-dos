# FINDING: COOP/COEP (cross-origin isolation) is NOT required

**2026-07-04 · FINDING**

The site's "host must send COOP/COEP or the player won't run" claim
(web/site/README.md, vite.config.js comments) is false for the current
engine. Zero uses of SharedArrayBuffer / shared wasm memory / atomics
exist in the live path (vendored calcite_wasm.js glue, shim, site src) —
the engine is single-threaded WASM, all transport is postMessage; SAB
was only an optional fast path in web/player/experiments/*. Verified
empirically: full flow (browser build → wasm compile 8.3s → run →
MJPEG frames in inline player) passes in Chromium with COOP/COEP
stripped and `typeof SharedArrayBuffer === 'undefined'`.
Consequence: the health.svelte.js crossOriginIsolated hard-gate
(added earlier today) over-blocks — hosts without header support
(e.g. GitHub Pages) and their mobile users would work fine.
Headers stay harmless to emit (future wasm-threads option).
