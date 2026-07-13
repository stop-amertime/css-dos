# Windows 1.01 / serial-mouse perf — remaining work

Status 2026-07-13: `windows-all` bench LANDED with degraded-host
baseline; profiling complete (LOGBOOK
2026-07-13-windows-perf-profiling); surgical identity-guards on the
mouse wires landed (−50 ops/tick, ticks byte-identical). This plan is
what remains. **Everything wall-based below is gated on a healthy
host** — sanity-check first (old-vintage doom cabinet should reach
`text_drdos` ≈1.2M ticks in ≤3s web; ≈8s means degraded, stop).

## 1. Healthy-host re-baseline (first, cheap)

- 3-run `windows-all` + `doom-all` medians on a healthy host; replace
  the degraded-host walls in STATUS. Ticks must match (writeLoad
  2.96M, toExecutive 4.79M).

## 2. Attribute the mouse's wall multiplier on wasm

Host-independent fact: mouse = +463 ops/tick (+26%); same-day A/B
said ≈1.8× writeLoad wall — ops alone can't explain that ratio.
Hypothesis: the mouse wires sit in the CPU register chain's
topological order (they read `--__1AX`, `--cycleCount`) and may
defeat calcite's short-dense-chain / copy-elim fusion of the hot
path, making every op in the chain slower — check with the
2026-06-11 chain-fusion diagnostics on mouse vs no-mouse cabinets
(same-day web A/B on a healthy host; the no-mouse variant is
reproducible via a cart copy with `input` removed). If confirmed,
the calcite-side fix is generic: fusion that tolerates (or reorders
around) leaf wires that hang off the hot chain.

## 3. Full quiescence restructure of emitMouseWires (kiln, optional)

Designed but not implemented (surgical guards landed instead —
the full version needs a healthy host to justify): one registered
`--msAtTgt` bit (cursor-at-target) + a `--_msQuiet` conjunction over
{mouseTgt=0, msTouchPrev=0, msHeldBtn=0, msRawPrev=0, msPendEdges=0,
uartPhase=0, uartDr=0, msAtTgt=1}; every mouse wire and register
default gets a `if(style(--_msQuiet: 1): <keep/0>; else: <full>)`
shape. Wires dead-under-quiet may output 0 (Chrome computes the same
CSS — cabinet self-consistency, cardinal-rule clean). Ceiling ≈
−250 ops/tick of the remaining ~410. Verify: stage ticks
byte-identical (write_loaded 8.36M), windows gate, mouse-e2e,
doom body-hash unchanged.

## 4. Painter runtime cost — verify properly

Painters measured +90 ops/tick (small); the "1.7×" web claim was
host flap. On a healthy host, A/B `KILN_NO_PIXELS`-style build vs
normal (doom) on doom-all before believing any painter cost. STATUS
item #3's compile-only assessment is still owed too.
