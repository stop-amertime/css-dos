# 2026-07-12 - How/Calcite/FAQs pages replaced verbatim from the copy doc; Credits gets MS-DOS4

Owner direction: move everything in `docs/CSS-DOS-site-copy.md` onto the
site, replacing where necessary (Home/Why were already in sync). Ported:

- **How is this possible?** - condensed 6-bullet summary replaced by the
  full Problems 1-9 essay: spreadsheet framing, the AND-function teaser
  with its complete verbatim exhibit (both Foldables, all 256 parity-table
  arms, no truncation), the AX-table walkthrough, double-buffering, I/O
  problems 4-7, Kiln, and "why so slow" with a new `.stat-grid`. Problem
  headings use the `.problem-box`/`.problem-tag` DOS-dialog CSS that was
  already sitting in `about.css` prepped for exactly this rewrite.
  File-map cross-links woven into each problem's prose in place of the
  old standalone "six abilities" list.
- **Calcite** - 3-rule cheat list expanded to the doc's full 5 rules
  (adds parse-blind/no-AOT and no-unnatural-signalling).
- **FAQs** - added What-doesn't-work, How-long, debugging story, AI-use
  reflection, contribute/donate, and the two contact entries.
- **Credits** - Operating System list now credits MS-DOS 4.00 + FreeDOS
  EDIT alongside EDR-DOS (a real, pre-existing gap - the site had never
  mentioned msdos4 in credits since it shipped 2026-07-06).

Verified via headless Playwright against the dev server: all four
sub-pages render, zero console/page errors. Commit `8733e10`.
