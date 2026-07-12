# 2026-07-12 — Text + CGA pixel painters (LANDED)

`kiln/pixels.mjs` now paints all implemented video modes, not just
Mode 13h — closing the oversight that the raw player could only show
graphics carts. Every pixel rule dispatches through a shared
`--screenPx()` on the BDA mode byte (0x449, `--vidMode` on
`.motherboard`): text 0–3/7 via a 2048-arm 8×8 ROM-font `@function`
(`bios/corduroy/cga-8x8.bin`, fixed VGA-16 colours, no blink/cursor),
CGA 4/5/6 via the fixed palettes + the 0x4F3 OUT-0x3D9 shadow, decode
mirroring `web/shim/video-modes.mjs`; 640-wide modes subsample even
source columns onto the 320×200 grid. Unmapped cells degrade to
black without poisoning the active mode's arm.

Proven in headless Chromium (`tests/harness/pixels-render.playwright.mjs`
now covers 13h/text/cga4/cga5/cga6 with exact rgb asserts) +
`pixels-emit`/`pixels-wired` (the latter's banner grep was stale since
the `a776e30` DISPLAY rename — fixed). Native gates re-run green.
Cost: painter 7.0 → 14.3 MB fixed per cabinet (escape-hatch flag in
STATUS still applies). Site anatomy snapshot exhibits (SectionScreen)
still show the old rule shape — refresh at next snapshot re-cut.
