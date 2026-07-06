# 2026-07-06 — Player plumbing rebuilt: stateless SW, one bus, cache-only cabinets

With the bridge worker in-page (inline player), the two-tab MessagePort
design was vestigial — and its statefulness was where every recent bug
lived. Rebuilt: (1) all bridge↔SW↔builder traffic rides one
`cssdos-bridge` BroadcastChannel (frames, viewer signals, /_kbd relay,
cabinet pings); the SW holds zero cross-request state, so an
idle-killed instance needs no recovery handshake — `register-calcite-
bridge`/`cssdos-need-bridge`/port-replacement all deleted. Two site
tabs arbitrate by a boot-time `bridge-takeover` broadcast (older
bridge mutes). (2) Cache Storage is the cabinet's ONLY home: builder
writes it + broadcasts `cabinet-updated`; the bridge compiles from
cache on viewer-connect, so reload-rehydration and mid-session builds
are the same code path (`cabinet-blob*` messages deleted). Cabinets
are stored CHUNKED (64 MB parts + header-only index, parts-first):
single ~330 MB puts reproducibly die on Windows Chromium ("Unexpected
internal error", doom8088 = 323 MB — kbd-e2e caught it). (3) Renamed
`/_stream/fb` → `/_screen/framebuffer`. Verified: site build→play→
keys→reload-rehydrate→Stop/Start (Chromium), CDP `stopAllWorkers` →
next stream just works (no handshake), kbd-e2e full doom flow PASS,
bench page updated. Legacy `assets/build.js` migrated too.
