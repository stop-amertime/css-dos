# On-page health indicators (capability banner + live engine status)

**2026-07-04 · LANDED (master, `e6fa2ea`)**

Console errors are unreachable on mobile, so failures were invisible.
Now: `web/site/src/lib/health.svelte.js` probes capabilities once
(secure context, service workers, `crossOriginIsolated` → COOP/COEP,
WASM, `navigator.deviceMemory`) and listens to bridge status.
`EnvNotice.svelte` (Build sub-1 + Play) renders a red "This browser
can't run the player" box with the specific reasons, or a yellow
low-memory warning; the calcite run card disables on hard failure.
The inline-player bar shows the live bridge status line (fixes the
2026-07-03 "no compile feedback for 10–25s" trap) and turns red on
`boot failed:`/`compile error:`/`engine error:`/worker crash.
`calcite-bridge-boot.js` announces phase via `cssdos-bridge-state`
window event + `window.__calciteBridgeState` (inert for legacy pages).
Verified e2e: happy path (status compiling→running, no banner) and
COOP/COEP-stripped context (banner with isolation reason, card disabled).
