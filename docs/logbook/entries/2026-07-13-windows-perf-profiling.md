# 2026-07-13 - Windows perf profiled: mouse +26% ops; host degraded (FINDING)

Host-independent op-profiles (calcite-cli `--op-profile`, 1M-tick boot
windows): **windows101-without-mouse = 1,755 ops/tick = doom8088
exactly**; the serial-mouse machine adds **+463 ops/tick (+26%),
always-on, fully idle** (~89 branches, ~130 loads, Mul/Sub/Max/Min
chains - `kiln/patterns/misc.mjs emitMouseWires`). Painters add only
~90 ops/tick. Same-day web A/B: mouse ≈ 1.8× on writeLoad
(39.5s → 21.9s) - direction certain, magnitude fuzzy because **the
host ran 2-3× degraded all day** (the documented flapping state:
compile 24 → 44-53 ms/MB vs 07-07; same cabinet + same-era wasm both
slow today). Retracted en route: an apparent "5× regression since
07-06" (cross-day comparison on a degraded host - kiln bisect at
5dbeb55/c3817e1, calcite wasm bisect at 4d8d597, and a no-painters
doom build all measured equal within host noise) and a "painters
1.7×" claim (same flap). The windows-all baseline JSONs are
degraded-host walls; tick counts are the durable part. writeLoad is
2.96M ticks; guest-side ~70% of it sits in two MS-DOS kernel
file-I/O segments (0x0277/0x0FDD) - same shape as the old doomLoad
finding. Next: quiescence-guard the mouse wires (kiln restructure,
Chrome-identical), verify by op-profile + gates; healthy-host wall
re-baseline owed.
