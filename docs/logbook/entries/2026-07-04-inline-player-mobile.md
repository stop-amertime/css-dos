# Inline player on Play route (mobile fix)

**2026-07-04 · BRANCH (`claude/mobile-service-worker-debug-hfda9g`)**

Mobile Chrome froze the old two-tab flow: the bridge worker (WASM
engine) lives in the site tab, and opening `/player/calcite.html` in a
new tab backgrounds it — mobile Chrome throttles/freezes/discards
background tabs, starving the `/_stream/fb` frame stream. Fix: the
"Run using Calcite" card (`web/site/src/routes/Play.svelte`) now
iframes `calcite.html` into the Play page, so engine + viewer share
the foreground tab. "Pop out ↗" keeps the old new-tab option; Stop
detaches the iframe (stream cancel → SW `viewer-disconnected` →
bridge pauses). No changes to sw.js/bridge — viewer-connected reset
and multi-viewer fan-out already handled it. Styles in
`styles/_fragments/play.css`. Verified e2e headless-Chromium:
build sokoban in-browser → inline play → first MJPEG frame decoded →
Stop detaches (scratchpad Playwright run, phone-size viewport).
