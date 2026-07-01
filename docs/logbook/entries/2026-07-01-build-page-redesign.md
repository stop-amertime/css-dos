# Build page: headings, gray/logo/centering, run-options stacked, sub-page restructure

**2026-07-01 · LANDED (branch web/build-boxart-cards)**

Several `web/site/` UI passes in one session:

- Headings no longer bold (`font-weight: normal` on `.step h1`/`h3`).
- Intro sub-page: lighter dialog gray (`--edit-gray` `#aaaaaa`→`#c8c8c8`),
  logo border/shadow dropped, logo+text centered as a block with text
  itself left-aligned, title merged to one line ("CSS-DOS: A full 80s PC
  in a stylesheet.", 28px), text width capped (520px). Along the way, fixed
  a real bug: `body:has(.window.wizard){display:grid}` had no explicit
  column, so the implicit track sized to the dialog's own 820px —
  `max-width: calc(100% - 32px)` was resolving against that instead of the
  viewport, breaking mobile (horizontal overflow at ≤820px). Pinned the
  track to `minmax(0, 1fr)`.
- Play step's two run-option cards stacked (`grid-template-columns: 1fr`)
  — side-by-side was too wide.
- **Build step restructured** to mirror the About step's sub-page/dot
  pattern instead of the old "01/02/03/04" numbered blocks: sub-page 1
  (pick a program), 2 (machine specs + advanced config + a new boot-mode
  radio — program vs. DOS shell, drives the now-hidden `#run-cmd` field —
  + a bigger Build button), 3 (cabinet ready + source viewer, reachable
  only once built). Next is gated with a tooltip ("Select a program
  first" / "Build the cabinet first") until each sub-page's exit
  condition is met, sourced from `#start.disabled` (build.js's own
  readiness signal) via a MutationObserver so it can't drift out of sync
  across cart-click / hidden-radio / file-upload selection paths. BIOS
  row relabeled "Firmware + OS" ("Corduroy + DOS" etc). The `#stages`
  checkbox-list progress display is hidden (kept in DOM — wizard.js's
  progress-bar observer still counts its mutations); only the small
  progress window (bar/%/log) shows.
- `build.html` (the older standalone build page, still live) needed a
  matching fix: it still uses the raw `#run-cmd-row` text field, so
  `refreshDosOnlyRows()` in build.js now toggles whichever of
  `#run-cmd-row` / `#boot-mode-row` exists on the current page.

Verified via Playwright in Chromium at desktop + 390px mobile widths;
`node tests/harness/run.mjs smoke` 6/6.
