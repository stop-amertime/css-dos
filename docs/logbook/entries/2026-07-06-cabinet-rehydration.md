# 2026-07-06 - Cabinet rehydration: builds survive page reloads

The pagehide `purgeCabinets()` is gone - a built cabinet now stays in
Cache Storage until the next build starts (still at most one; build()
purges first). On page load `calcite-bridge-boot.js` re-feeds the
bridge worker from the cache (`cabinet-blob-lazy`), and a restore
probe in `builder.svelte.js` flips new `build.restored` state so Play
unlocks (`nav.canPlay = done || restored`); a `#play` hash that
arrived before the probe resolved is replayed to Play via the
`cssdos-cabinet-restored` event. Closes the 2026-07-03 trap "builder
tab reload (incl. Vite HMR) silently kills bridge+cabinet, player
waits forever" - the 94e35dd need-bridge handshake restores the
*port* after an SW restart but couldn't restore the *cabinet* after a
reload; this is the complementary half. Verified in Chromium: build
sokoban → play → reload on #play → auto-returns to Play, "Restored
your last cabinet (294.9 MB)", recompile 8.8 s, frames stream; Stop →
Start instant. Cost: one regenerable cabinet lingers per origin
(browser-evictable) - accepted trade.
