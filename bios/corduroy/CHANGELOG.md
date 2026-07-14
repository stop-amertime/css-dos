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

## 0.6.0 - 2026-07-07

- INT 09h now tracks modifier state: Shift (0x2A/0x36), Ctrl (0x1D)
  and Alt (0x38) make/break update the BDA shift-flag byte at
  0040:0017 (so INT 16h AH=02h/12h and DOS finally see them), and
  modifier keys are no longer buffered as bogus ASCII-0 key events.
- INT 09h translation is modifier-aware: Shift selects a shifted
  table (uppercase letters, US digit-row symbols, `<` `>` `?`,
  back-tab), Ctrl selects control codes (letters → ASCII&0x1F -
  Ctrl+C works; Ctrl+Enter=LF, Ctrl+Bksp=DEL, Ctrl+6=RS), Alt
  buffers ASCII 0 with the scancode preserved. Break codes of
  non-modifier keys are still dropped (the buffer wants makes only).
  Combos must arrive via the player's hold wire (simultaneous
  `:active` presses don't chord - the single-valued wire never fires
  the second make); programs that hook INT 9 themselves (Prince of
  Persia) always saw raw make/break and are unaffected.

## 0.5.0 - 2026-07-06

- INT 13h AH=08h/15h now fail for any drive but 0 (AH=08h: CF set,
  AH=01; AH=15h: AH=00 "not present"). Previously both answered
  success for ANY DL including 80h - MS-DOS's MSINIT counts hard
  disks via AH=08h DL=80h and trusted the answer, conjuring a phantom
  hard disk whose SETHARD setup corrupted IO.SYS code in memory.
- INT 13h now honours the ROM-BIOS register contract: AH=02h/03h
  preserve BX/CX/DX (read used to return BX=last-LBA+1 and CX=0 -
  MS-DOS's MSBOOT reads the dir sector then does `MOV DI,BX` expecting
  its buffer pointer back; EDR-DOS never noticed). CF is now set/cleared
  in the STACKED FLAGS via a BP frame - the old bare `clc`/`stc` before
  IRET never reached the caller (IRET restores the caller's FLAGS
  image), so error returns were invisible.
- Real INT 19h bootstrap: reads the boot sector (LBA 0) to 0000:7C00,
  checks 55AA, jumps with DL=0. A missing/invalid boot sector halts.
- New build-time-patched `boot_mode` byte ('BTMD' anchor, default 0):
  entry.asm consults it after `bios_init` - 0 keeps the classic direct
  jump to the preloaded kernel at 0060:0000 (EDR-DOS), 1 issues
  INT 19h instead (boot.os "msdos4" carts, whose floppy carries a real
  MS-DOS boot sector). Loader error paths that re-issue INT 19h
  ("insert another disk") now re-enter the bootstrap instead of
  hitting a halt-only stub.

## 0.4.0 - 2026-07-06

- INT 13h gains AH=03h (write sectors) and AH=04h (verify sectors).
  Write mirrors the AH=02h read: per sector it latches the LBA word at
  linear 0x4F0, then `REP MOVSW` 256 words from the caller's ES:BX
  *into* the window at D000:0000. On `disk.writable` cabinets the CSS
  routes window writes into shadow-disk cells; on rom cabinets the
  bytes vanish (adapter-ROM semantics). Verify always succeeds - the
  disk is CSS properties, there is no medium.

## 0.3.0 - 2026-07-06

- INT 09h `scancode2ascii` gains the digit row (`1`–`0`, scancodes
  0x02–0x0B) and the `,` `.` `/` cluster (0x33–0x35). These keys exist
  on the player keyboard and kiln emits their `--keyboard` values, but
  the table mapped them to ASCII 0 - INT 16h handed DOS a dead key, so
  typing `edit readme.txt` at the prompt silently dropped the dot (and
  every digit). F1–F10 / arrows are unchanged: ASCII 0 is correct for
  extended keys; DOS-side behaviour (e.g. F3 template recall) already
  worked.

## 0.2.0 - 2026-04-19

- INT 10h AH=00h accepts mode `0x01` (CGA 40×25 colour text) and
  normalises mode `0x00` (CGA 40×25 mono text) to `0x01`. Both share
  the B8000 buffer layout; only the column stride differs.
- Teletype output (INT 10h AH=0Eh) reads the active column count from
  `BDA[0x449]` at the start of each call: 80 columns for mode `0x03`,
  40 columns for mode `0x01`. Scroll-up is still hardcoded to 80
  columns; a program that scrolls in mode `0x01` will render wrong.

## 0.1.0 - 2026-04-18

- Initial numbered release. C-based DOS BIOS with INT 10h, 13h, 16h,
  1Ah services, real INT 09h keyboard handler, EOI on INT 08h/09h.
  Defaults: `BDA[0x449] = 0x03` (80×25 colour text), stack at the
  builder-patched `0xBEEE:0xFFFE`, 640 KB or autofit conventional.
