# 2026-07-04 — Play "hangs forever" root cause: SW idle-restart loses the bridge port

Owner report: Play sometimes hangs on the loading text forever.
Cause: the browser idle-kills service workers (~30s) and restarts
them with EMPTY module state — `bridgePort = null` — and the boot
shim only handed its MessagePort over once, at page load, to the
instance alive then. Any `/_stream/fb` opened after a restart (e.g.
build → read the result page a minute → Play) never delivered
`viewer-connected`, the lazy compile never started, zero frames.
Keys after a mid-play restart died the same way. Fix: a recovery
handshake — a portless SW instance posts `cssdos-need-bridge` to its
window clients (from handleStream + handleKbd); calcite-bridge-boot
answers with a fresh MessageChannel; on (re-)register, the SW fires
`viewer-connected` if a stream is already waiting. Verified in
Chromium via CDP `ServiceWorker.stopAllWorkers` (same state wipe as
an idle kill) → next /_kbd recovers the port. **Trap found on the
way: `web/site/sw.js` was a DEAD duplicate** — Vite serves
`public/sw.js`; edits to the root copy did nothing. Root copy
deleted; `public/` is canonical (header comment says so).
Same commit: player loading text says ~300 MB (was 50-100MB), and
phone margins rethought — inline player full-bleed in the dialog,
embed mode edge-to-edge (screen 304→368px wide at 390).
