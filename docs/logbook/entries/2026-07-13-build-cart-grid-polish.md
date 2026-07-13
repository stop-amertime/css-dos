# 2026-07-13 — Build page: custom card back in the grid, wider carts

Owner styling pass on `#build` (pick page). The full-width dashed
"…or load your own program" bar is gone — the synthetic custom cart
now renders as an ordinary grid cell via CartCard's existing
`cart.custom` branch (which already drew the dashed "+ Load your own
program" cover; the wide bar had replaced it and is now un-replaced).
CartGrid stops filtering `custom` out and the bar markup/styles are
deleted. Grid max-width 540 → 680px (cards ~172 → ~219px, still 3
abreast; 560/380px column breakpoints unchanged). The intro text
("The entire computer … has to be baked …") hugged the window's left
edge while the grid centred — `.build-intro` now shares the same
centred 680px column (build.css). Verified on a fresh dev server at
desktop width (grid measured 3×218.7px, intro aligned with grid edge)
+ prod `vite build`.
