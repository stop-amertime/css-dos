# Web Svelte site - styling & UX pass (18 fixes)

**2026-07-01 · BRANCH (`web/build-boxart-cards`, on top of the Svelte
static port) - not yet on master.**

A polish pass over the Svelte site (`web/site/`) after the static port.
18 owner-requested fixes, all verified in Chromium against the dev
server (an actual Zork build → result page, Play unlocked):

- **Wizard chrome:** substep dots balanced (10px top/bottom) + centred;
  `.window.wizard` gained `min-height: min(600px, 100vh-96px)` so sparse
  pages don't collapse; all wizard `h1`s de-bolded (rule moved from
  `.step h1` → `.window.wizard h1` so Build/Play prose, which sits
  outside a `.step`, is covered too); inline `<code>` now renders as a
  monospace chip everywhere in the wizard (was stripped on Build/Play).
- **About:** intro "first time real programs" claim is now a muted
  gold **scalloped banner** (wavy-box radial+conic mask, `round()`-locked
  to the wave grid so no torn edge; HSL muted tones); GitHub link added;
  credits gained a **SvarDOS/EDR-DOS** credit + more section spacing;
  `.ext-link` restyled (was unstyled after the port).
- **Build:** removed the below-grid cart-detail text; cart grid capped
  (3×2, `max-width`, centred) and drop-shadow removed; custom card shows
  "Load your own program" + blurb; configure page is now **flex** (PC
  photo capped 200px, specs wrap beside it); spec-label column no longer
  blue (blue = action colour) → neutral `#333`; **disabled primary
  buttons now visibly grey** (were indistinguishable blue).
- **Result page (#16):** small floppy + "CSS file built" heading +
  single "(optional) Download cabinet.css - N MB" link; pager collapsed
  to one centred line `Source Code: « Prev  Page [n] of N  Next »`
  (editable page #, no bytes/lines); source box smaller-font & much
  taller - page is far less wasteful.
- **Play:** width constrained to 820px like the others (dropped the
  `wide`/`play-wide` path entirely).
- **Shared `Foldable.svelte`** (+ `foldable.css`) with a blue `[+]`/`[-]`
  glyph replaces the two ad-hoc `<details>` widgets (Build "Advanced",
  Play "Is this cheating?"); radio selection dot is now blue.
- **Audit (#18):** removed dead `.cart-detail`/`.cart-body` CSS, stale
  `@media` grid overrides, unused `wide` prop / `.play-wide`,
  `bytesLabel`. `UNPLACED.css` is a stale carve-audit comment file (its
  `.ext-link`/`.result-info` notes are now outdated) - left in place, not
  a docs-session deletion.

**Responsive / mobile layer** (same session, follow-on): the desktop
layout is a fixed 820px window; on narrow viewports it overflowed
horizontally (the "refresh doesn't fix the size" report was restored
h-scroll, not a stale dimension - no ResizeObserver needed). Root cause:
flex children with `min-width: auto` + `white-space: nowrap` (step-strip,
subdots) and the source viewer's long CSS lines gave the flex column a
min-content wider than the screen, defeating `max-width: 100%`. Fix:
`@media ≤900px` window → fluid, strip/subdots shrink (rules in
step-dots.css so they win the cascade); `≤640px` full-bleed, headings
32→22px, strip number chips + the two trailing bar labels ("CSS-DOS
SETUP" / build status) hidden. The source-viewer overflow needed the
mobile window anchored to `100vw` (absolute) not `%` (circular: parent
sizes to child, child caps at 100% of parent) so `.source-pre`'s
`overflow-x` scrolls the long lines internally. Desktop (>900px)
unchanged (verified 788px window at 1200vp). All four page types fit at
390px with no h-scroll.

`vite build` green (only pre-existing a11y warnings). Old-DOM Playwright
harnesses untouched.
