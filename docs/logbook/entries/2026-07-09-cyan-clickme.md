# EGA cyan "click me" pass on primary interactables

Owner request: mark navy-blue clickable chrome with `var(--edit-cyan)`
(#55ffff, true EGA cyan - NOT `--edit-blue-bright`/#5555ff, which stays
reserved for the desktop weave). Cyan is light, so text/glyphs go
black, not white (Norton/DOS-utility look).

`web/site/src/styles/global.css`: `.btn.primary` (Next », "Find out
how it works", "Build cabinet") - cyan bg, black text, hover lightens
to `#99ffff`; `.hot` accelerator switches to red (was yellow, illegible
on cyan). `.btn.primary:disabled` untouched (stays flat grey).

`web/site/src/components/StepDots.svelte`: step-strip tabs - new
`clickable` class (`n !== current && !disabled(n)`) gets cyan bg/black
text; current tab unchanged (black/white) but gains TUI-style `‹ ›`
angle brackets (yellow, pseudo-elements, no layout impact) per owner's
"more DOS" ask. StepDots sub-nav: selected dot's fill switched from
red to cyan (borders/other dots untouched).

Verified visually (dev server, fresh Playwright tab, 0 console errors)
on #home, #about/why (CTA), #build (tab states incl. disabled Next),
#play, #about/faqs (subdots fill + Next hover).
