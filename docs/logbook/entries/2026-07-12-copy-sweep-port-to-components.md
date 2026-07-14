# 2026-07-12 - Copy-sweep additions ported from doc into live components

The bracket-sweep session's new copy (landed in `docs/CSS-DOS-site-copy.md`
only, commits `62c9d09`…`9f64903`) had not reached the site. Ported: the
"Hidden storage above the 1 MB limit" + "No bounds checks" sections into
`SectionMemDecl.svelte`; "Why are all three in one function?" + the
disk-window rewrite + the `else: 0` explanation into `SectionMemRead.svelte`
(plus a matching comment line in `FetchLadder.svelte`'s exhibit); the
disk window-clutter wording sync in `SectionDisk.svelte`; the DAC
"Counting to three" section (new `dacSubIndex` exhibit) into
`SectionScreen.svelte`, previously missing from the live page entirely;
the CPU background's lightbulb simile into `SectionCpu.svelte`; and the
rewritten Build FAQ answer (~536 MB / RAM-reduction detail) into
`About.svelte`. Left untouched: `About.svelte`'s Why/How/Calcite/Credits
pages, which are governed by `ABOUT-SCRIPT.md`'s own condensed register,
not the doc's fuller early draft - the doc is a point-in-time extraction
for copy-editing, not the canonical source for those pages. Verified via
a throwaway headless Playwright run against the dev server: all 7 new/
changed headings render, zero console/page errors. Commit `76bd574`.
