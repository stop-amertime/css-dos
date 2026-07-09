# 2026-07-09 — FINDING: what Chrome actually does with a 316 MB cabinet

Measured headless Chromium on doom8088.css via the new
`web/player/experiments/huge-css-test.html` (open via file://; params
`css=`, `dom=0` parse-only, `grid=0` no pixel grid).

- **Parse via `<link>`: ~6 s, no crash.** The ~536 MB V8 string cap is
  fetch-path-only; the native CSS parser doesn't care.
- **First style resolution of one bare `.cpu` div: ~310 s** of hard
  main-thread block — then it *completes*: registers read tick-0 values
  (`CS=0xF000 IP=0 cycleCount=0`). The 64K-pixel grid adds nothing; the
  block is the custom-property avalanche itself.
- **With a live clock the tab wedges forever** (recalc ≫ 400 ms clock
  period; 7 min observed, zero idle windows). "Crashes Chrome" is really
  an unbounded recalc backlog; no renderer crash seen headless.
- **BUG (follow-up: raw-regen.mjs):** raw.html puts `clock`+`cpu` on ONE
  element, so `.cpu`'s `animation: store…,execute…` (doom8088.css:1185)
  cascade-clobbers `.clock`'s `anim-play` (line 1180) → the clock never
  ticks; `@container style(--clock:)` also only queries ancestors. The
  raw player is frozen at tick 0 by construction (verified by minimal
  repro + full cabinet). Fix = nest `.clock > .cpu`. Its loading message
  ("wait ~10 seconds") is off ~30×.
