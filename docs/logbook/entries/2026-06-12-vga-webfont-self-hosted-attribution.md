# 2026-06-12 — VGA webfont self-hosted + CC BY-SA attribution fixed

Release-audit licensing fix. `Web437_IBM_VGA_8x16.woff` (VileR's
Oldschool PC Font Pack v2.2, CC BY-SA 4.0) was hotlinked from a
third-party jsDelivr mirror with no attribution anywhere — a live
license violation. Now self-hosted at `web/player/fonts/` (sha256
verified bit-identical to the official int10h.org v2.2 zip), with the
pack's `FONT-LICENSE.TXT` alongside, provenance in the fonts README,
a visible credit line on the site index (under the wizard nav), and
`@font-face` in `web/player/calcite.html` + `web/site/assets/site.css`
pointed at `/player/fonts/`. Verified in-browser: site + player render
in WebVGA from the local file, no console errors.
