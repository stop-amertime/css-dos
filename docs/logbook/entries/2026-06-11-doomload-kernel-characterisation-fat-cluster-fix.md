# 2026-06-11 - doomLoad kernel characterised: FAT chain walk was the lion; 16K clusters cut doomLoad ticks 69%

Resolved the ~49% kernel share of doomLoad (2026-06-09 finding) to
EDR-DOS routines by rebuilding the deployed kernel (rev `72ae65f`)
with its linker map (see `reference/debugging-dos-kernel.md` -
the old checked-in map was from a FreeDOS-kernel era and is wrong).
Per-symbol attribution of the load window: `fatptr` 21.4% of ALL
doomLoad ticks, `div32` 6.5%, `fdosrw` 6.5%, `getblk` 5.9%,
`locate_buffer` 5.1%, `getnblk` 2.1% - one causal chain: a FAT
chain-step costs ~50 ticks (software div32 per entry), and EDR-DOS
restarts the walk from cluster 1 on every backward seek. Doom8088
runs `-noxms` (8086 has no XMS), so every lump load = fseek+fread
against a 1.5 MB WAD that had ~1500 chain links at SPC=2.

Fix: new `disk.sectorsPerCluster` cart option (builder/mkfat12,
default unchanged); doom8088 set to 32 (16 KB clusters → 94-link
WAD chain). Deterministic ticks (CLI + web agree): boot→ingame
34.65M→13.50M (−61%); **loading→ingame 29.55M→9.25M (−68.7%)**.
Web doom-all A/B (3+3, JSONs `benches/doom-all-2026-06-11-spc{32,ref}-run*`):
host flapped healthy↔3×-degraded mid-block, but within-state ratios
match: doomLoad **59.6→19.1 s (healthy pair)**, 170→53 s (degraded
pairs); in-game FPS unchanged (rendering-bound). Smoke 7/7; title gfx
via fast-shoot. doomLoad is now ~67% of engine-run (was 86%).
Follow-ups: same option for zork-big / prince-of-persia; remaining
per-read syscall overhead (fdrw div64s, deblock copies) if doomLoad
stays the top phase.
