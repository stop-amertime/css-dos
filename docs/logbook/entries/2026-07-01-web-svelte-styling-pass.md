# Web Svelte site — styling & UX pass (18 fixes)

**2026-07-01 · BRANCH (`web/build-boxart-cards`, on top of the Svelte
static port) — not yet on master.**

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
  single "(optional) Download cabinet.css — N MB" link; pager collapsed
  to one centred line `Source Code: « Prev  Page [n] of N  Next »`
  (editable page #, no bytes/lines); source box smaller-font & much
  taller — page is far less wasteful.
- **Play:** width constrained to 820px like the others (dropped the
  `wide`/`play-wide` path entirely).
- **Shared `Foldable.svelte`** (+ `foldable.css`) with a blue `[+]`/`[-]`
  glyph replaces the two ad-hoc `<details>` widgets (Build "Advanced",
  Play "Is this cheating?"); radio selection dot is now blue.
- **Audit (#18):** removed dead `.cart-detail`/`.cart-body` CSS, stale
  `@media` grid overrides, unused `wide` prop / `.play-wide`,
  `bytesLabel`. `UNPLACED.css` is a stale carve-audit comment file (its
  `.ext-link`/`.result-info` notes are now outdated) — left in place, not
  a docs-session deletion.

`vite build` green (623ms; only pre-existing a11y warnings). Old-DOM
Playwright harnesses untouched.
