# 2026-07-12 - File Map pane restyle: one code pane + borderless explanation

Owner styling sweep of `#about/file/*`. Old layout nested a white
TreeView box (with its own "CPU · 265 KB" head) inside the tinted
bordered pane whose header said the same thing, prose repeated it a
third time. New layout (AboutFileMap.svelte): ONE code pane on top -
coloured border, big header (icon + name + size + n/11, the only
place name/size appear) with the TreeView inside - then a short
gutter and the explanation on the tint with **no border**. TreeView
is now chrome-less and instantiated by AboutFileMap (Section*
components carry only prose; tree imports moved). Header text is the
section colour darkened (title 45%, size/icon 70%). Colours: clock
`#ffff55`→gold `#b8860b`, keys `#55ffff`→forest `#228b22` (invisible
on white). Filemap-only window-body padding 24/28→12/14 (CabinetBar
negative margins updated to match); explanation content centred in a
680px column. Verified via Playwright at 1280+390px (cpu/clock/keys/
map) + prod `vite build`. Finding: stale long-running dev servers on
:5173–:5275 still served the deleted `_fragments/about.css` from the
Vite module cache - restart before judging site styling.
