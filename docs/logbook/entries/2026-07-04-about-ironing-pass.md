# 2026-07-04 - About/Play ironing pass (owner list, 5 items)

Owner-directed, landed as 5 master commits (06c543f…). (1) Calcite
now has its own About page 4 (`#about/calcite`, 7 sub-pages; Play's
intro + promoted cheating argument moved there); Play is player-first
- Calcite runs embedded by default via new pure-CSS `#embed` mode in
calcite.html (`:has(:target)` on a display:none anchor hides the
desktop chrome AND avoids parent scroll-into-view), with a raw-CSS
warning modal replacing the run-option cards. (2) Term underlines
everywhere: GLOSSARY callouts + the what-is-CSS fold deleted; terms.js
gains css/sector/bios/8086/jit/wasm/fat12/mode13h; underline now 2px
dotted EDIT-blue. (3) Fun promoted out of folds: full ADD (row + IP +
flag function) and branchless jumps in the CPU main flow; clock
conductor, keyboard latch, screen palette likewise. (4) tippy.js hint
bubble under the bar on first map visit (cursor icon + "top shelf
stuff, I promise" line; dismisses on click/carousel use). (5) Callouts
rebuilt as Callout.svelte with pixelarticons icons (info/tip/warn
chips + per-kind colour). New deps: tippy.js, unplugin-icons,
@iconify-json/pixelarticons. All Playwright-verified; vite build
green. Owner prose review pending as usual.
