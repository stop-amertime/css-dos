# 2026-07-07 — Site: three sections, play-tips toasts, writable-disk UI; msdos4 splash

Owner litany, all landed on master. **Nav:** back to three strips —
About / Build / Play; About = 7 pages (Home hero, Why? — now page 2
with "TRY IT OUT IMMEDIATELY" → Build and "FIND OUT HOW IT WORKS" →
`#about/how` — how/file/calcite/faqs/credits). Play's Next is now
"How it Works »" → `#about/how`. `routes/Home.svelte` deleted.
**Toasts:** new `display.playTips` (program.json, schema +
cart-format.md) → dismissible HINTS dialog on Play; tips added to
prince-of-persia, pop1_4, msdos4, doom8088. **Build page:** fold
renamed Configuration; `disk.writable` checkbox (+~0.4 MB/KB warning;
verified: writable Sokoban 295→566 MB, over the V8 cap) wired through
`mergeManifest`; option sets stacked, white marker chips. **Result
page:** compact green ✓ row, 60% floppy, «/» pager (never wraps).
**Play mobile:** squish-to-fit iframe scale + fixed-height window,
note bottom-pinned. **dos-shell** de-listed from the site (display
block removed; cart kept). **msdos4:** `gfx: true` restores the BIOS
splash (was pruned, splash drew into nothing); cabinet 466.8 MB,
msdos gate + fast-shoot splash verified. Viewer: SectionDisk gains a
"Writable disks" section (measured numbers).
