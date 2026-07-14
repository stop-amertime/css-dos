# 2026-07-13 - Mouse wires: identity guards on idle ticks (−50 ops/tick)

Surgical restructure of `emitMouseWires` (kiln/patterns/misc.mjs) so
idle ticks short-circuit - every guard is an algebraic identity:
`--_uartStart` gains a `--_msDiff: 0` arm (skips the quietOk pacing
math AND drops the idle mouse graph's per-tick `--cycleCount`
dependency), `--_msBtnRep` collapses to `sentBtn` when no edges are
queued, `--_msB1/_msDx8/_msDy8` guard on `--_uartStart` (dead on
other ticks - their only consumers are start-gated). Windows cabinet:
2,218 → 2,168 ops/tick; ~90% of the mouse's +463 is per-wire floor -
the full quiescence design (ceiling ≈ −250) is in
`docs/plans/2026-07-13-windows-mouse-perf.md`, gated on a healthy
host. Verified: all windows-all stages at byte-identical ticks
(write_loaded 8,360,000), doom cabinet body-hash unchanged (non-mouse
emission untouched by construction), windows gate PASS (kbd + mouse
launch), mouse-e2e PASS (select, dbl-click launch, hold-mode menus).
