# 2026-06-12 - player full keyboard restored + resized

`web/player/calcite.html` lost its full PC keyboard (added `8ebca35`
2026-05-05) when the keyboard side-channel reverts (`48767d2`,
`915acc3`) took the file back wholesale; the 2026-05-28 re-merge
(`e6c9749`) restored only bridge+bench, not the player HTML. Restored
the `8ebca35` layout (Esc/F1–F10, Tab/Caps/Shift/Ctrl, responsive
screen), then resized per owner review: window 666px wraps the 640px
screen + keyboard with a uniform 12px grey margin, keys 26px tall /
14px font (mods+F-keys 11px), arrows are one ► glyph CSS-rotated per
direction (pixel-identical) at 40px, Enter is ↵. Input path unchanged
(`/_kbd` link → SW → bridge queue). Kiln's 56-key `:active` rule set
(`kiln/template.mjs`) was never lost - cabinet CSS already supported
every key. `calcite-canvas.html` untouched (deprecated per owner).
Verified: dev server + Playwright screenshots of the rendered layout.
