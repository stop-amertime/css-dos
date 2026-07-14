# 2026-07-09 - FINDING: what Chrome actually does with a 316 MB cabinet

Measured headless Chromium on doom8088.css via the new
`web/player/experiments/huge-css-test.html` (open via file://; params
`css=`, `dom=0` parse-only, `grid=0` no pixel grid).

- **Parse via `<link>`: ~6 s, no crash.** The ~536 MB V8 string cap is
  fetch-path-only; the native CSS parser doesn't care.
- **First style resolution of one bare `.cpu` div: ~310 s** of hard
  main-thread block - then it *completes*: registers read tick-0 values
  (`CS=0xF000 IP=0 cycleCount=0`). The 64K-pixel grid adds nothing; the
  block is the custom-property avalanche itself.
- **With a live clock the tab wedges forever** (recalc ≫ 400 ms clock
  period; 7 min observed, zero idle windows). "Crashes Chrome" is really
  an unbounded recalc backlog; no renderer crash seen headless.
- **BUG, FIXED same day:** raw.html put `clock`+`cpu` on ONE element, so
  `.cpu`'s `animation: store…,execute…` (doom8088.css:1185)
  cascade-clobbered `.clock`'s `anim-play` (line 1180) → the clock never
  ticked; `@container style(--clock:)` also only queries ancestors. The
  raw player was frozen at tick 0 by construction (verified by minimal
  repro + full cabinet). Fix: raw-regen now puts `.clock` on `.window`
  and `.cpu` on `.window-body` (nested); raw-regen.test.mjs asserts the
  split. E2E-verified in Chromium with the hello-text cabinet:
  cycleCount 0→16, IP 0x100→0x104 (~6 s recalc/tick at 8.9 MB + 64K
  pixels). raw.html's "wait ~10 seconds" message is still off ~30× for
  Doom-sized cabinets.
