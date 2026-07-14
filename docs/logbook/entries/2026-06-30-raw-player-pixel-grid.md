# 2026-06-30 - raw player: identical chrome + paintable CSS pixel grid

Tag: LANDED

`raw.html` now derives from `calcite.html` (`web/scripts/raw-regen.mjs`
reads calcite.html and applies a few exact substitutions), so the two
players' chrome/keyboard match exactly and can't drift. The `<img>`
screen is replaced by a 320×200 = 64,000-element `<i id=pN>` grid; the
screen+keyboard host (`.window-body`) gains `clock cpu` classes so the
cabinet's `.cpu`-scoped rules have a host. Label reads `RAW`, cabinet
loaded as a real `<link rel="stylesheet">`.

New emitter `kiln/pixels.mjs` (wired in `emit-css.mjs` right after the
keyboard rules) emits, per pixel, a rule reading the Mode 13h
framebuffer byte from `--__1mc{cell}` and painting `background-color`
via a shared 256-arm `@function --paletteRGB()` over the live DAC
cells (6→8-bit expansion). ALWAYS emitted; **inert** in the
calcite/bridge path (no `#pN` nodes there). Cardinal rule untouched -
emitter-only; calcite still sees integer cells + `background-color`.

Verified: emitter unit tests (index extraction + palette); **8×8 render
proof in real Chromium 149** - `pixels-render.playwright.mjs` reads back
exact rgb (Chromium 149 fully supports CSS `@function`/`if()`/`style()`);
smoke **6/6** (calcite path unaffected); raw.html chrome confirmed
identical to calcite.html via reduced-grid render. The full 64k grid
crashes headless Chromium even with no cabinet - the expected
"theoretical player" behaviour. Size: painter adds a fixed **6.17 MB**
(hello-text 2.68→8.85 MB); calcite compile-only bench deferred
(concurrent session). Plan: `../plans/2026-06-30-raw-player-paintable-grid-PLAN.md`.
