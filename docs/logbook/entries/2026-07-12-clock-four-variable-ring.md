# 2026-07-12 — Clock section rework: four-variable ring, `-prev` names, no beats

Owner-collab copy session. The clock page's double-buffer explanation
rebuilt as a three-step argument with diagrams (`CycleDiagrams.svelte`,
`panel` prop, prose interleaves): self-reference banned → two-variable
cycle banned → the airlock ring `--X → --X_1 → --X_2 → --X-prev`,
animated by pure-CSS keyframes (latch links conduct only during their
own quarter; ring never fully connected). Vocabulary decisions (owner):
"snapshot"/"staged"/"held" retired site-wide — read copy is `--X-prev`,
couriers `_1`/`_2` (real `--__1/--__0/--__2`); "beat" retired for
keyframe percentages (0%/25%/50%/75%); rest keyframes honestly labelled
spacers (nothing runs; recompute is reactive). Nitty-gritty Foldable:
pause-is-the-latch, why two couriers minimum, tick-one fallbacks.
TickClock widget retired (attic only). "The other clock" moved
clock → chipset ("Where the timer's ticks come from"). Doc synced
(52 refs script-renamed). Commits `781abee`…`64c3062`; verified via
Playwright desktop + 375px.
