# 2026-07-06 — Session-writable disk (INT 13h AH=03h) — Stage 2 LANDED

Opt-in `disk.writable`: the floppy becomes packed cells at linear 0x200000
(names only — see the 1e6 rule below); `--readDiskByte` arms read the cells;
per-slot `--_dskInN`/`--_dskOffN` remap window writes into a disk-local write
family; Corduroy 0.4.0 adds AH=03h (REP MOVSW into the window, LBA at 0x4F0)
+ AH=04h. JS ref machine mirrors the shadow. Calcite side (same-day, see
calcite log 2026-07-06): windowed-byte-array packed backing + window writes,
affine packed families, segmented fast-path runs, rep-Copy window carve-out.

**Chrome 1e6 precision cliff (FINDING):** computed numeric custom properties
round to ~6 significant digits in Chromium (verified: `calc()` value 2099714
stores as 2099710). All computed values in the write/read path stay < diskLen;
big constants live in names/literal keys only. Corollary: disk bytes ≥ 1e6
(disks > ~1MB) are Chrome-imprecise — pre-existing in rom mode too. Keep
writable carts ≤ 720K.

Costs: dos-shell 273.6 → 395.3 MB cabinet; calcite compile 2.4 → 6.0 s; ticks
~290K/s vs ~584K rom. Rom carts: zero change (smoke 6/6, conformance green).
Tests: `run.mjs writable` (batch ECHO>file + TYPE back, screen-asserted);
COPY CON e2e verified interactively on calcite + JS ref. fulldiff impractical
on 400MB cabinets (debugger init > 10 min) — noted, not fixed.
