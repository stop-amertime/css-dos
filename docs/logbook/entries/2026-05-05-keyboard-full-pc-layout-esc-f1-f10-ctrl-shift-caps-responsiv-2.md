## 2026-05-05 — keyboard: full PC layout (Esc/F1-F10/Ctrl/Shift/Caps + responsive)

Doom8088 uses Ctrl to fire — without it the on-screen keyboard can't
shoot. While in there, brought the on-screen keyboard up to a full PC
layout (6 rows, 11 cols) and made the screen responsive.

- `kiln/template.mjs::KEYBOARD_KEYS` gains Ctrl (0x1D), Shift (0x2A),
  Caps (0x3A), Del (0x53), F1–F10 (0x3B–0x44). All ASCII=0x00 (the
  cabinet just sees scancode in the high byte of `--keyboard`).
  `emitKeyboardRules` writes 56 rules now (was 45); cabinet rebuilds
  pick up `.cpu { &:has(#kb-X:active) { --keyboard: N } }` for each.
- `web/player/calcite.html` — keyboard rebuilt as an explicit 6-row
  11-col grid:
  - Row 1: Esc | F1–F10
  - Row 2: 1–9 0 Bksp
  - Row 3: Tab Q–P
  - Row 4: Caps A–L Enter
  - Row 5: Shift Z–/
  - Row 6: Ctrl Space
  Each key gets explicit `grid-row` / `grid-column` so reordering
  doesn't drift the layout. Modifiers/digits/F-keys use a smaller
  font (11 px) since their labels are multi-char; letters stay at
  the default 16 px. Arrow keys still live in the right stack as
  fixed 32×32 squares right-aligned.
- Screen now responsive: `.screen-cell` and `.screen` use
  `width: 100%; max-width: 640px; aspect-ratio: 640/400` instead of
  fixed 640×400, so narrow viewports shrink the screen
  proportionally rather than overflowing.
- `calcite-canvas.html` left untouched (still on the JS `data-key →
  worker.postMessage` path; will get its own update once Phase B
  lands).
- Smoke suite (7 carts) PASS.
