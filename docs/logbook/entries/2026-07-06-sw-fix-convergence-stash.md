# 2026-07-06 - Convergent SW hang fix superseded; rehydration idea parked in stash

A second machine independently root-caused the Play hang-forever bug
(SW idle-restart losing the bridge port) and had an uncommitted fix
when it synced. Master's `94e35dd` (`cssdos-need-bridge` handshake,
LOGBOOK 2026-07-04) supersedes it - same diagnosis, different message
string, and the local work also edited the since-deleted dead
duplicate `web/site/sw.js`. Working tree was stashed, master
fast-forwarded `2413cca`→`ba715fb`, no conflicts. One piece has no
master equivalent: **cabinet rehydration** - boot shim restores the
built cabinet from Cache Storage (`cssdos-cabinets-v2`) via
`cabinet-blob-lazy` on page load, so a reloaded builder tab doesn't
strand the player; requires dropping the deliberate pagehide
`purgeCabinets()` ("cabinets are ephemeral", builder.svelte.js).
→ Resolved same day: owner opted to integrate; rehydration landed
(see `2026-07-06-cabinet-rehydration.md`) and the stash was dropped.
