# 2026-07-07 — websmoke gate: boot cabinets on the wasm the site ships

Prevention for the stale-vendored-wasm class (see same-day entry
`site-msdos4-stale-vendored-wasm`): every existing gate drives
calcite-cli, so nothing executed the vendored bundle users run. New
`tests/harness/web-boot.playwright.mjs` boots one cabinet through the
real web path — dev server (CALCITE_REPO forced into the void so the
**vendored** pkg is served even when a sibling build exists), cabinet
blob → Cache Storage → bridge worker → calcite-wasm — and polls text
VRAM (0xB8000 via peek-mem) for a sentinel; any error/panic status
fails fast. Preset `node tests/harness/run.mjs websmoke` runs one
target per engine class: hello-text (rom, "HELLO, CSS-DOS!"),
dos-writable (writable shadow disk, "HELLO FROM SHADOW"), msdos4
(the shipped cart, "MS-DOS Version 4.00"). `--engine=sibling` flag
tests a fresh calcite build pre-vendor. Now part of the regression
gate (STATUS); mandatory after re-vendoring `web/vendor/calcite-pkg/`
(vendor README). Verified: full preset PASS on the re-vendored bundle.
