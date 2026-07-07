# 2026-07-07 — msdos4 "slow boot" was wasm compile; AddrOffset fast-path fix (105s → 10.8s)

Owner report: MS-DOS 4 "takes ages to boot". Diagnosis via new web
bench profile `msdos-boot` (boot-to-VER-banner; reports compile vs
run split + `fetchMs`/`saveMs` + wasm `phaseReport`): the emulated
boot is FAST (1.45M ticks, ~4.2s web — fewer ticks than EDR-DOS
carts) — the wall was **wasm compile: 105.4s** vs doom's 6.1s
(same-day A/B), 99s of it in `parse.cssparser`. The 245,760
writable-shadow cell assignments key their write cascade
region-relative (`- <cellIdx − base> * 2`), a shape the fast-scan
template learner classified `Free` → ~114MB fell to the slow parser.
Fix in calcite (`HoleKind::AddrOffset` — see calcite log 2026-07-07):
blanked 48.6% → 73.2%, web compile → **10.8s median** (3 runs),
time-to-prompt ~110s → ~18s incl. fetch+save. A/B byte-identical
(banner tick/cycles); gates msdos + writable + smoke 6/6 PASS; doom
compile unregressed. JSONs: `docs/benches/msdos-boot-2026-07-07-*`.
Benefits every writable cart (dos-shell etc.), no cart rebuild needed.
