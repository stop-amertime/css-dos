# File map: honest whole-tree reorg + two paging-bug fixes

**2026-07-12 · LANDED (master `5dbeb55`)**

Owner brief: make the File Map honest AND maximally scannable for a
reader who knows computers but not our CSS — enough sections to
demarcate cleanly, not so many it's a maze. Licence to reshape BOTH
Kiln's emit order AND the site's sectioning. No calcite in scope.

**Ten sections, each a coherent subsystem** (Kiln emit reordered;
declaration-inert — same @property/@function/@keyframes set and same
2,710,051 `--name:value` decls before/after, proven by an
order-independent sha fingerprint, so no re-verification of machine
behaviour was needed):

- Flag arithmetic @functions → CPU (only the CPU uses them). "Bit &
  byte helpers" keeps just the shared primitives (21 fns).
- Every subsystem's @property decls move next to its logic: registers→CPU,
  PIT/PIC/kbd/DAC latches→their chip, `--keyboard`/`--kbdHold`→keyboard
  selectors, write-slot props→memory writes. "Memory declarations" is now
  purely the 368,256-cell array.
- CPU splits into six sibling stages (each its own `.cpu {}` block, which
  merges): REGISTER DECLARATIONS · 1·FETCH & DECODE · PRECOMPUTED
  EXECUTION STATE · 2·UPDATE REGISTERS · 3·OUTPUT: MEMORY WRITE SLOTS ·
  HELPERS. Numbered only where there's a real sequence.
- Renames: Bit & byte helpers / Keyboard selectors / Display / Memory
  declarations|reads|writes. Deleted a stale never-called dup of
  `--incFlags8/--decFlags8` in group.mjs (had drifted vs flags.mjs).

**Two bugs fixed:**
- *Disk "(N more…)" showed zero arms* — a chunk page could hold only a
  landmark comment with content stranded on the next page. `writePages`
  now guarantees every page carries a substantive node. (extractor)
- *Stacked "(N more…)" buttons* — per-run buttons stacked. One shared
  reveal cursor across all runs → at most one button. (TreeAst.svelte)
  **SUPERSEDED same day**: the shared cursor clumped later runs'
  comments above one global button; per-run pagination restored — see
  2026-07-12-filemap-nesting-run-splits.

Verified in the built site (vite preview + Playwright): CPU shows the
six stages; disk shows its arms + one button; memory-declarations is
cells-only, one button, no leaked reg/chip props; keyboard selectors
carry `--keyboard`/`--kbdHold`. Section prose sizes/counts + groups.js
updated. (Correction: an earlier draft blamed a "svelte bare-import
dev breakage" — false. That was the legacy `web/scripts/dev.mjs`
static server, which can't serve the Svelte site by design; `npm run
dev` (vite) serves it fine, verified.)
