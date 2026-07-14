# 2026-06-10 - copy elimination LANDED on calcite main (`967ddad`+`9ecc6de`)

Executes the 2026-06-09 op-profile finding. New compile-time pass:
forward copy propagation + backward DCE + adjacent store-forwarding
over every op stream, between call inlining and the fuse peepholes.
doom8088: dispatched ops/tick 846 → 695 (−17.8%, all LoadSlot).

Web 3-run `doom-all --headed` medians vs the 2026-06-09 baseline:
**runMsToInGame 70.5 s (was 75.0, −6.1%) / 477.2K t/s (+4.6%) /
doomLoad 60.8 s (was 63.65, −4.4%)** - every run beat every clean
baseline run. JSONs `docs/benches/doom-all-2026-06-10-copyelim-*`.
Wasm compile cost ~1.7 s (same-day A/B; note: compile wall drifts
day-to-day, only runtime metrics are cross-day comparable).

Verified: 300 calcite lib tests; doom8088 full state dump
byte-identical vs pass-off @2M ticks; ticks+cycles+IP identical on
all 8 cached cabinets; smoke 7/7. Engine detail: calcite log
2026-06-10. Generic (CSS-shape only) - no cardinal-rule exposure.
