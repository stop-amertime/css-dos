# File Map carousel: wizard-nav paging, Skip button, yellow HINT

Owner-requested nav redesign of the About "File Map" sub-page. The
flanking ◄/► carousel arrows are gone (`CabinetBar.svelte`); instead
the wizard's own Back/Next walk the 11 section pages —
`nav.next()/prev()` step `FILE_SECTIONS` before crossing sub-pages
(entering forwards starts at `map`, backing in from Calcite lands on
`clock`, so the strip reads continuously; arrow keys inherit this for
free and App.svelte's special-casing is deleted). From page 2 onwards
a `Skip »»»` button sits left of Next and jumps past the section
(`nav.skipFileMap()` → Calcite). The first-visit hint lost its
▒-dither spotlight overlay (deleted from About.svelte +
cabinet-bar.css) and is now a yellow HINT note styled like the Play
page's HINTS toast, still arrow-pointing at the bar; it shows on
every carousel page until its X is clicked, and dismissal persists
per browser (`localStorage` `cssdos-filemap-hint`; `nav.carouselSeen`
→ `nav.hintDismissed`). Verified end-to-end in headless Chromium
(26-check Playwright sweep: paging, skip, hint persistence across
nav + reload).
