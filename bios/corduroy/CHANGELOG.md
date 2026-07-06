# Corduroy BIOS changelog

Semver-ish: bump MINOR for behavioural changes (new INT services,
different default BDA state, etc.), PATCH for internal fixes that don't
change what programs observe. MAJOR is reserved for layout breaks
(entry point moves, ABI changes).

Every bump must also change `VERSION` in this directory. The builder
stamps the version into the cabinet header so you can tell which BIOS
is baked into any given `.css`:

```
head -5 cabinet.css
```

## 0.4.0 — 2026-07-06

- INT 13h gains AH=03h (write sectors) and AH=04h (verify sectors).
  Write mirrors the AH=02h read: per sector it latches the LBA word at
  linear 0x4F0, then `REP MOVSW` 256 words from the caller's ES:BX
  *into* the window at D000:0000. On `disk.writable` cabinets the CSS
  routes window writes into shadow-disk cells; on rom cabinets the
  bytes vanish (adapter-ROM semantics). Verify always succeeds — the
  disk is CSS properties, there is no medium.

## 0.3.0 — 2026-07-06

- INT 09h `scancode2ascii` gains the digit row (`1`–`0`, scancodes
  0x02–0x0B) and the `,` `.` `/` cluster (0x33–0x35). These keys exist
  on the player keyboard and kiln emits their `--keyboard` values, but
  the table mapped them to ASCII 0 — INT 16h handed DOS a dead key, so
  typing `edit readme.txt` at the prompt silently dropped the dot (and
  every digit). F1–F10 / arrows are unchanged: ASCII 0 is correct for
  extended keys; DOS-side behaviour (e.g. F3 template recall) already
  worked.

## 0.2.0 — 2026-04-19

- INT 10h AH=00h accepts mode `0x01` (CGA 40×25 colour text) and
  normalises mode `0x00` (CGA 40×25 mono text) to `0x01`. Both share
  the B8000 buffer layout; only the column stride differs.
- Teletype output (INT 10h AH=0Eh) reads the active column count from
  `BDA[0x449]` at the start of each call: 80 columns for mode `0x03`,
  40 columns for mode `0x01`. Scroll-up is still hardcoded to 80
  columns; a program that scrolls in mode `0x01` will render wrong.

## 0.1.0 — 2026-04-18

- Initial numbered release. C-based DOS BIOS with INT 10h, 13h, 16h,
  1Ah services, real INT 09h keyboard handler, EOI on INT 08h/09h.
  Defaults: `BDA[0x449] = 0x03` (80×25 colour text), stack at the
  builder-patched `0xBEEE:0xFFFE`, 640 KB or autofit conventional.
