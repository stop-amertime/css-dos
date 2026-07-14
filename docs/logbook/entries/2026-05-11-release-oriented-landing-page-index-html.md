## 2026-05-11 - release-oriented landing page (`/index.html`)

**What.** New `web/site/index.html` - a 4-step DOS-EDIT-styled wizard
(Welcome → How it works → Build → Play) that wraps the existing
`build.js` pipeline. Started from a Claude Design mockup
(`https://api.anthropic.com/v1/design/h/sRty-DSKgcWv-J_BVFVWMQ`,
extracted from the gzipped tarball it returns). Build wiring, SW
registration, and calcite-bridge boot are identical to `build.html` -
no changes to `build.js`, `sw.js`, or `calcite-bridge-boot.js`.

**Architecture.** `wizard.js` is pure visual chrome on top of `build.js`:
- Real form elements `build.js` reads (`#cart-list`, `#start`, `#stages`,
  `#log`, `#download`, `#run-cmd`, memory/preset/video radios, `#progress`,
  `#result`) live in a hidden `.wizard-hidden` block so build.js keeps
  ownership of the build pipeline.
- A visible `#cart-grid` of cover-art cards mirrors selections into the
  hidden `#cart-list` radio group (programmatic `.checked = true` +
  `dispatchEvent('change')`), and the spec table mirrors radio/checkbox
  state. A short polling loop (0/100/500/1500 ms) covers build.js's
  async program.json apply, since direct `.value` writes don't fire
  `input` events.
- Build progress drives off two MutationObservers: one on `#stages`
  (each new `<li>` = one stage; bar eases toward 95 %), one on
  `#result.hidden` (un-hide = build done; snap to 100 %, reveal the
  cabinet block, unlock step 4).
- `#save-css` proxies to the hidden `#download` anchor.

**Carts.** Visible carts come from `web/site/assets/carts.js`
(cosmetic manifest with cover art / palette). `wizard.js` intersects
that with `/_carts.json` from the dev server - carts in `carts/` but
NOT in `window.CARTS` (variants: `doom8088-cga4`, dev fixtures:
`test-carts`, `vsync-poll`, `rogue36`) are intentionally hidden from
the release landing page. They remain available via `/build.html`,
which still lists every directory under `carts/`.

**Assets copied** to `web/site/assets/`: `IBM-PC.jpg`,
`css-dos-logo-narrow.png`, `css-dos-logo-32x32.png`, and
`boxart/{doom,persia,zork,sokoban}.{jpg,jpeg,webp}` from the design
bundle.

**Visual jank tightened from the mockup:**
- `.step-strip li.done` went from off-palette `#888` to `#666` with
  yellow numbers for legibility against the gray.
- `.cart-card.selected:hover` pinned to black so hover doesn't recolor
  the inverted-selected look.
- Dropped the mockup's fake CSS-source preview generator; the real
  paginated source viewer (from `build.js`) is now tucked inside a
  collapsible `<details>` on the result block.
- Dropped `F1=Help` from the status line (no help dialog exists); wired
  `Esc=Back` so the advertised shortcut does something honest.
- Hardened the keydown listener against synthetic dispatches with no
  `.matches` (was throwing when `e.target === document`).
- Three play options (calcite / canvas / raw) collapsed to two
  prominent cards (raw + calcite) with the canvas player and the
  classic builder UI as plain text links below.

**Verification.** Web preview at `localhost:5173/` (web preview config):
- Steps 1-4 navigate via Next/Back, step-strip clicks, and arrow keys.
- `/_carts.json` round-trip populates 8 cover-art cards.
- Clicking Zork → cart bytes fetched (7 files), `#run-cmd` prefilled
  to `_ZORK1`, spec table reflects `640K conventional` /
  `DOS + Corduroy BIOS` / `Text + Mode 13h`, build button enabled.
- Build button → 6 stages logged (preset → BIOS → DOS → FAT12 → CSS →
  ready), progress bar to 100 %, `Cabinet: 277.3 MB` displayed,
  floppy label `ZORK1`, download blob URL valid, step 4 unlocked.
- Step 4 cards link to `/player/raw.html` and `/player/calcite.html`
  (new tab); footnote links to `/player/calcite-canvas.html` and
  `/build.html`.
- No console errors, no failed network requests.

**Out of scope.** Help dialog (`F1`), drop-down menus on the menu bar
(flavour only, same as `build.html`), tearing down the cabinet on
Restart. The classic `/build.html` is unchanged and remains the
power-user surface.

**Files.** new: `web/site/index.html`, `web/site/assets/wizard.css`,
`web/site/assets/wizard.js`, `web/site/assets/carts.js`,
`web/site/assets/IBM-PC.jpg`, `web/site/assets/css-dos-logo-narrow.png`,
`web/site/assets/css-dos-logo-32x32.png`,
`web/site/assets/boxart/*.{jpg,jpeg,webp}`.
