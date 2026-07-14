# Drop the COOP/COEP hard-gate - player runs on header-less hosts

**2026-07-04 · LANDED (master)**

Follow-up to the same-day FINDING (COOP/COEP not required): removed
the `crossOriginIsolated` hard-failure from
`web/site/src/lib/health.svelte.js` - the banner no longer blocks
header-less hosts (GitHub Pages) or their mobile users. Corrected the
false "host must send COOP/COEP" claims in `web/site/README.md`,
`vite.config.js`, `runtime-assets.mjs`, and STATUS.md active-work #2.
The `vercel.json`/`_headers` emission and dev-server COI headers stay
(harmless; future wasm-threads option). History: headers were added
2026-06-30 (`34b91e7`) for a *planned* SAB framebuffer path that never
shipped (lives only in `web/player/experiments/`). Verified e2e with
headers stripped: no banner, calcite card enabled, build → inline
play → frames.
