# 2026-06-11 - short dense dispatch chains LANDED on calcite main (`f2c8615`)

Follows the copy-elim headroom note (BIfNEL = top op bucket). Runtime
adjacency profiling: 62% of BranchIfNotEqLit executions chain-walk in
probe runs shorter than the conversion threshold. Change: chains of
2–5 probes now convert to flat-array DispatchChain when dense
(range ≤ 256, ≤ 3× count); HashMap path keeps threshold 6.
doom8088: chains 208→358, dispatched ops/tick 700→678 (−3.1%),
BIfNEL 178→137/tick. A sparse-short-chain variant was built and
reverted - doom8088 has zero sparse short chains.

**Host caveat:** bench host ran ~35% below the 06-10 baseline all day
- cross-day absolutes invalid, so the gate was a same-day web A/B
(3-run medians, ref vs new wasm): **+4.8% t/s / −5.8% runMs / −4.4%
doomLoad** (~+3–5% honest band; CLI +2–3%). JSONs
`docs/benches/doom-all-2026-06-11-chainlen{2,-ref}-run*.json`.
Verified: 300 lib tests, state dump byte-identical @2M, smoke 7/7.
STATUS baseline NOT updated (degraded host) - re-baseline when healthy.
