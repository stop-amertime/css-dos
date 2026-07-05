# 2026-07-05 — PoP ground-touch freeze: OUT 0x43 ignored PIT channel-select

pop1_4 froze at the kid's first landing (~tick 12.7M): the speaker thud
sends `OUT 0x43, 0xB6` (a **channel-2** control word) and kiln's PIT
handler ignored bits 7-6, zeroing channel 0's `--pitReload`/`--pitCounter`.
`pitReload=0` disarms IRQ 0 in kiln's model → PoP's 60 Hz INT 8 timebase
(reload 19886) dies → its wait-for-ISR-counter loop (`CMP [0x32EC],0/JZ/JMP`
at 0x122F:0x056D) spins forever. Chrome would freeze identically — kiln
bug, not calcite.

Fix in `kiln/patterns/misc.mjs` emitIO(): OUT 0x43 only touches ch0 state
when bits 7-6 == 00 AND bits 5-4 != 00 (counter-latch also holds now);
gate is arithmetic (`--rightShift`/`--and` product) since style() can't
test AL bit fields. Verified: pitReload survives the landing; kid runs
right, falls a level, lands, jumps, walks left across 24M+ ticks (cli
`--press-events`, now batched — see calcite log 2026-07-05). Also:
corduroy builds fall back to `web/prebake/corduroy.bin` when NASM/Watcom
are absent (`builder/stages/bios.mjs`); harness resolves non-`.exe`
calcite binaries on Linux.
