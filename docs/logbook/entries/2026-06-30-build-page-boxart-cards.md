# Build-page cart picker: uncropped box art + card redesign

**2026-06-30 · LANDED (master)**

The landing/build cart grid (`web/site/index.html` step 01, rendered
by `web/site/assets/wizard.js`) cropped every cover: `.cart-cover`
forced a fixed `aspect-ratio: 3/4` and `.cart-cover img` used
`object-fit: cover`, chopping the (mostly ~0.67) portrait scans.

Changes:
- **Uncrop.** `object-fit: cover → contain` (whole scan visible, thin
  letterbox against `--edit-black`); dropped `image-rendering:
  pixelated` (these are photographic box scans, not pixel art).
- **Better scans.** Swapped 3 low-res/cluttered covers for clean
  full-box art (`carts.js`): doom→`doom-alt.jpg`, persia→`pop-alt.jpg`
  (old was a German price-sticker reprint), zork→`zork-box-2.webp`.
  Sokoban/Rogue kept (only good option). New files copied into
  `web/site/assets/boxart/` from repo-root `icons/boxart/`.
- **No text under cards.** Removed the per-card `.cart-body`
  name/desc. Selected cart's name (header) + blurb now live in one
  `#cart-detail` box below the grid.
- **Selection = thick green border** (`outline 4px #1faa1f` +
  matching shadow), not the old black fill - black blended into the
  card borders.
- **Custom card** carries its text inside the cover (dashed border,
  muted `#ededed` fill, `+` glyph + name + blurb) instead of the
  bright-red `?` placeholder.

Two selection sync paths updated (card-click `selectCartCard` and the
hidden-radio `change` mirror); detail box hides for the custom card.
Verified in Chromium via Playwright: all 6 cards render, full covers,
green selection across cards, custom panel toggles, console clean.
