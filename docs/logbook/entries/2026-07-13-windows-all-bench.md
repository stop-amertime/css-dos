# 2026-07-13 - windows-all bench: boot + open README.DOC in Write

New canonical profile `tests/bench/profiles/windows-all.mjs` - the
doom-all analogue for Windows 1.01 (carts/0windows101). Stages:
`dos_banner` (VER text) → `win_gfx` (BDA mode 6) → `executive` (CGA
VRAM byte sentinel) → tick-scheduled keys (R type-selects README.DOC -
one keypress, verified by screenshot - Enter launches) →
`write_loaded` (Write caption/text/scrollbar/"Page 1" bytes; halt).
`writeLoadMs` = Enter → README.DOC drawn by WRITE.EXE is the doomLoad
analogue. Ticks deterministic: write_loaded 3.0M ticks after Enter on
every run/transport. Enabler (cross-link calcite log 2026-07-13):
`at:tick` watches fire on exact equality and the wasm `run_batch_watched`
polled on a chunk grid that stepped over them - worked on CLI, silently
never fired on web; calcite now shrinks batches to land on at-targets
(cli/wasm parity). Also fixed: harness/mouse-e2e/docs still said
`carts/windows101` after the 0windows101 rename - windows gate PASS.
Run 1 headed web: writeLoad 39.5s, toExecutive 57.8s, **80K t/s vs
doom's 478K** - the ~6× per-tick gap is the optimisation target.
