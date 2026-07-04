# 2026-07-04 — About code blocks: manual tok-* spans → real Prism

Owner ask ("reuse the prism plugin"). All 21 static `.byte-example`
extracts in the anatomy sections are now `<CodeCss code={...}>`
(plain template-literal snippets) highlighted by Prism, replacing
~110 hand-written `.tok-*` spans. Prism moved from the jsdelivr CDN
`<script>`s to the npm package, bundled via new `lib/prism.js`
(core + css grammar), so highlighting works offline / on the static
host; the grammar gains `variable` (--idents anywhere, incl. @-rule
preludes — stock Prism misses var() args) and `number` tokens. DOS
theme in about.css: variables/selectors red, numbers green, comments
grey, functions (if/style/var/calc…) EDIT-blue, @-rules magenta,
strings brown; plain properties/punctuation stay black (owner asked
for functions "lighting up" after a first minimal-palette pass).
SourceViewer imports the same module (its previously-dead
.token.variable/.token.number theme rules now fire). Interactive
widgets (RamWrite/TickClock/CssDemo/…) keep manual spans — they bind
live state into their code. Verified: rendered textContent of all 23
blocks byte-identical pre/post (Playwright dump-diff); zero console
errors with no CDN reachable; vite build green.
