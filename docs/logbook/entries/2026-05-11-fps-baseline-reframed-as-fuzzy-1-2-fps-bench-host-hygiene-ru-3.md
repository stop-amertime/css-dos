## 2026-05-11 - FPS baseline reframed as fuzzy ~1-2 fps; bench-host hygiene rule

User observed ~1-2 fps in interactive Doom8088 on the merged-master
build (post `old-kbd` merge), inconsistent with the **1.70 fps**
"baseline" quoted in STATUS.md and tests/bench/README.md.

Re-read the source - the 1.70 figure was the median of a 3-run
sample whose values were 0.70 / 1.80 / 0.85 (commit `64f1146`). A
±2× spread is not a stable baseline; picking the middle reading
hid the noise. STATUS.md, tests/bench/README.md, and the Open-work
entry all rewritten to quote **~1-2 fps (noisy, ±2× across runs)**
and to say explicitly that FPS deltas inside that band aren't
publishable. Wall (78-82 s) and ticks/sec (394-434 K) are ±3 %
and remain the actual perf signal.

Also added an explicit "quiet the host before benching" section to
tests/bench/README.md: check no other agent is running another
bench, a build, or a long Playwright session. Concurrent benches
make both runs' numbers garbage and this has bitten us. Look for
stray `node tests/bench/driver/run.mjs`, `playwright`, `chrome
--headless`, `calcite-cli`, `cargo build`/`test` processes.

No code changed.
