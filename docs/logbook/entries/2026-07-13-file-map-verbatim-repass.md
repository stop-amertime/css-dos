# 2026-07-13 - Full verbatim re-pass: every file-map section word-matched to the copy doc

Owner: previous passes had fixed missing sections and stale numbers,
but a lot of prose had still drifted/been paraphrased away from
`docs/CSS-DOS-site-copy.md` over successive sessions. Went through all
11 carousel sections (Map, Util, CPU, Chipset, Keys, Screen, MemDecl,
MemRead, MemWrite, Disk, Clock) line by line and matched wording
exactly, restoring: rhetorical framings ("I hear a solitary person ask
from the back", "Wait, *read* formulas?..."), missing asides (Chipset's
idle/if shape note, the CGA `OUT`-register explanation, DIV/DAA's "Now
we're cooking" opener), and two structural bugs - CPU's IRQ code
exhibit + EXPANDABLE bullet list had been collapsed into prose, and
Clock's four-variable walkthrough was wrapped in a `<Foldable>` despite
the component's own header comment saying explicitly not to bury it in
a fold (now a plain main-body section again, matching both the doc and
that comment).

Verified three numbers before touching them, doc turned out stale on
none of the earlier ones but wrong on Screen's: checked
`kiln/pixels.mjs` directly - the real pixel-rule exhibit calls
`--screenPx()`, not `--paletteRGB` (fixed 2026-07-13 earlier pass);
`SCREEN_TREE_META.bytes` confirms 14.3 MB, so the live component's
stale "6.5 MB" was corrected to the doc's 14 MB here (the one case
this pass where the *site* was wrong, not the doc).

Flagged, not silently applied: the Map section's doc text was
mid-edit (uncommitted at the time, "is the a real file" typo) -
applied the obvious fix. The Disk section's FAT paragraph was left
untouched per an explicit earlier owner call ("not actually useful to
reexplain fat, ignore that") even though the doc's wording differs
there now.

Verified via headless Playwright: all 11 sections render, zero
console errors. Commit `36c97f9`.
