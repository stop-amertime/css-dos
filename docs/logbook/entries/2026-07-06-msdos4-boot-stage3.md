# 2026-07-06 — Stage 3: real MS-DOS 4.00 boots (LANDED)

`carts/msdos4` boots MIT-licensed MS-DOS 4.00 end-to-end on both
engines via the authentic chain (MSBOOT → MSLOAD → IO.SYS →
MSDOS.SYS → COMMAND.COM); `DIR` typed via keyboard verified on
calcite. Pieces: binaries + provenance in `dos/msdos4/`;
`boot.os: "msdos4"` (cart-format.md); Corduroy 0.5.0 — INT 19h
bootstrap + 'BTMD' boot_mode, INT 13h register contract (BX/CX/DX
preserved, CF via stacked FLAGS), AH=08h/15h fail for DL≠0 (success
for DL=80h conjured a phantom hard disk; MSINIT's SETHARD then
corrupted IO.SYS in memory); mkfat12 bootSector/mediaByte/attr;
keyboard MMIO bridge moved 0x500→**0x4F4** (0x500 = MSBOOT's dir
buffer; 0x4F2/3 taken — memory-layout.md "Platform registers").
calcite: rep-Copy from ROM/virtual source now per-tick falls back
(PerIterFallback) instead of fabricating zeros — calcite log same
date. Found + fixed en route: stale hardcoded gossamer IVT offsets
(dead INT 16h/1Ah/20h/21h since the June CGA/DAC shift) — now read
from an 'IVTG' anchor in the image, ref-machine + kiln share it.
Site: msdos4 card (boxart cover); browser builder grew the msdos4
branch (`buildMsdos4FloppyInBrowser`, `/assets/msdos4` runtime copy,
disk.files honoured) — browser-path cabinet verified booting to A>.
Owner follow-up: cart made writable + full toolset (FreeDOS EDIT
runs full-screen; authentic ATTRIB/MODE/XCOPY/COMP/EXE2BIN; LABEL→
VOL shadow-write roundtrip verified); floppy 480K custom geometry —
720K-writable hit Chrome's ~536 MB V8 string cap (STATUS gotcha);
cabinet now ~464 MB. New gate:
`node tests/harness/run.mjs msdos`. Smoke 6/6, writable, msdos,
conformance 6/6 green post-change.
