# BIOS Microcode Handler Gaps for drbio Init

> **For agentic workers:** Work through this checklist top to bottom. After implementing each handler, tick the checkbox and commit. Each handler must match the corresponding JS implementation in `tools/lib/bios-handlers.mjs`. The CSS microcode pattern is in `transpiler/src/patterns/bios.mjs`.

**Goal:** Add every missing CSS microcode BIOS handler that drbio calls during kernel init, so the DOS boot path doesn't hang.

**Source of truth for what drbio calls:** `../edrdos/drbio/` assembly source, constants in `ibmros.equ`.

**Source of truth for correct behavior:** `tools/lib/bios-handlers.mjs` (JS reference handlers).

**Architecture:** Each handler is a function in `bios.mjs` that returns `{ regEntries, memWrites, maxUop, ipEntries, uopAdvance, q1 }`. Entries are merged by `emitAllBiosHandlers()` into the shared opcode 0xD6 dispatch. All AH dispatch uses `--biosAH` (latched at instruction boundary). Single-μop handlers do work at μop 0 and IRET at μop 1. The IRET pops IP, CS, FLAGS, SP from the stack in one μop.

---

## INT 13h — Disk (highest priority, currently blocking boot)

The current INT 13h handler has NO DL-based dispatch. It assumes all calls are floppy. drbio probes hard disks (DL>=0x80) during init and hangs when unrecognized AH values get no IRET.

**Design for DL dispatch:** The `--biosAH` register is already latched. We also need DL. The low byte of DX is DL: `--lowerBytes(var(--__1DX), 8)`. We can check `DL >= 128` via `sign(calc(--lowerBytes(var(--__1DX), 8) - 128))` which is 1 when DL>=128, 0 otherwise. Call this `isHardDisk`.

For hard disk calls (isHardDisk=1): always return CF=1 (error/not supported), AH=01h or 00h depending on subfunction, then IRET. No sector reads, no geometry — we have no hard disks.

For floppy calls (isHardDisk=0): existing behavior for AH=00h/02h/08h/15h, plus new AH=16h.

**Implementation approach:** Rather than restructuring all existing INT 13h entries, add the hard disk path as a guard. For each register that currently dispatches on biosAH, wrap the floppy logic in an `isHardDisk=0` check and add the hard disk return values for `isHardDisk=1`.

- [x] **13h-1: AH=41h (LBA Extensions Check) — currently hanging the boot**
  - Called with: DL=0x80, AX=0x4100, BX=0x55AA
  - Must return: CF=1, AH=0x01 (not supported)
  - JS ref: `bios-handlers.mjs:285-288`
  - This is the immediate blocker. drbio calls this for each hard disk (DL=80h, 81h, ...) to check for LBA support.

- [x] **13h-2: AH=08h with DL>=0x80 (Hard Disk Parameters) — returns floppy geometry instead of error**
  - Called with: DL=0x80+
  - Must return: CF=1, AH=0x00, DL=0 (no hard drives present)
  - JS ref: `bios-handlers.mjs:291-295`
  - Currently returns floppy geometry (79 cyl, 18 sec, 1 head) for ALL calls regardless of DL.

- [x] **13h-3: AH=48h (Extended Drive Parameters) — not handled**
  - Called with: DL=0x80+
  - Must return: CF=1
  - JS ref: falls through to `bios-handlers.mjs:296-297` (generic hard disk error)

- [x] **13h-4: AH=15h with DL>=0x80 (Hard Disk Type) — returns floppy type instead of error**
  - Called with: DL=0x80+
  - Must return: CF=1, AH=0x01
  - JS ref: `bios-handlers.mjs:296-297`

- [x] **13h-5: AH=00h with DL>=0x80 (Hard Disk Reset) — currently succeeds, should also succeed but harmlessly**
  - Called with: DL=0x80+
  - Must return: CF=1 or CF=0 (either is OK, but CF=1 is more correct for "no drive")
  - JS ref: `bios-handlers.mjs:296-297`
  - Low priority — current behavior (CF=0) won't crash anything, but CF=1 is more accurate.

- [x] **13h-6: AH=16h (Disk Change Status) — not handled, floppy only**
  - Called with: DL=0x00 (floppy)
  - Must return: AH=0x00, CF=0 (disk not changed)
  - JS ref: not in bios-handlers.mjs (drbio runtime, not init — but add it to be safe)
  - drbio's disk driver calls this during media checks. Without it, floppy operations after boot may hang.

## INT 10h — Video

The current INT 10h handler covers AH=02h, 03h, 0Eh, 0Fh. drbio init also calls:

- [x] **10h-1: AH=00h (Set Video Mode)**
  - Called with: AL = mode number (03h for 80x25 text, 13h for Mode 13h graphics)
  - Must: write mode to BDA 0x0449, set cols in BDA 0x044A (80 or 40), clear screen, reset cursor to (0,0)
  - JS ref: `bios-handlers.mjs:172-185`
  - drbio may call this during init to reset video mode. CONFIG.SYS processing can also trigger it.

- [ ] **10h-2: AH=06h (Scroll Window Up)**
  - Called with: AL=lines (0=clear), BH=fill attribute, CH/CL=top-left row/col, DH/DL=bottom-right row/col
  - Must: scroll the specified window up AL lines, fill vacated lines with space+BH attribute
  - JS ref: `bios-handlers.mjs:187-212`
  - drbio calls this to clear portions of the screen during init.

- [ ] **10h-3: AH=09h (Write Char+Attribute at Cursor)**
  - Called with: AL=char, BH=page, BL=attribute, CX=repeat count
  - Must: write AL with attribute BL at current cursor position, CX times. Do NOT advance cursor.
  - JS ref: not in bios-handlers.mjs yet — but drbio's `init.asm:537` and `config.asm:2336` call it.
  - Simpler than 0Eh: just write char+attr at cursor pos, no cursor advance, no scroll.

- [ ] **10h-4: AH=08h (Read Char+Attribute at Cursor)**
  - Called with: BH=page
  - Must return: AL=character, AH=attribute at current cursor position
  - JS ref: not in bios-handlers.mjs — but `config.asm:2334` calls it.
  - Read from VGA text buffer at (cursor_row * 80 + cursor_col) * 2.

## INT 16h — Keyboard

- [x] **16h-1: AH=02h (Get Shift Flags)**
  - Called with: (nothing)
  - Must return: AL = shift flag byte from BDA 0x0417
  - JS ref: not in bios-handlers.mjs — but `biosinit.asm:570` calls it.
  - Simple: read one byte from BDA, return in AL.

## INT 1Ah — Time

The current INT 1Ah handler only handles AH=00h (returns tick count = 0). drbio's clock driver (`clock.asm`) calls additional subfunctions:

- [x] **1Ah-1: AH=02h (Get RTC Time)**
  - Must return: CH=hours (BCD), CL=minutes (BCD), DH=seconds (BCD), DL=DST flag, CF=0
  - JS ref: `bios-handlers.mjs:223-225` returns 00:00:00
  - Return CH=0, CL=0, DH=0, DL=0, CF=0.

- [x] **1Ah-2: AH=04h (Get RTC Date)**
  - Must return: CH=century (BCD), CL=year (BCD), DH=month (BCD), DL=day (BCD), CF=0
  - JS ref: `bios-handlers.mjs:228-230` returns 2025-01-01
  - Return CH=0x20, CL=0x25, DH=0x01, DL=0x01, CF=0.

- [x] **1Ah-3: AH=00h dispatch fix — currently ignores biosAH**
  - The current INT 1Ah handler does NOT dispatch on biosAH at all — it unconditionally returns CX=0, DX=0 for every AH value. This means AH=02h and AH=04h also get CX=0, DX=0 which is wrong.
  - Must add biosAH dispatch so AH=00h returns tick count, AH=02h returns RTC time, AH=04h returns RTC date, and unknown AH values IRET cleanly.

---

## Verification

After all handlers are implemented:

```bash
# 1. Regenerate CSS
node transpiler/generate-dos.mjs dos/bin/command.com -o test-shell.css --no-gfx

# 2. Run in calcite — should get past the INT 13h AH=41h hang
cd ../calcite
cargo run --release --bin calcite-debugger -- --input ../CSS-DOS/test-shell.css
# In another terminal:
curl -X POST http://localhost:3333/tick -H 'Content-Type: application/json' -d '{"count":2000000}'
curl http://localhost:3333/state  # CS:IP should NOT be at F000:0247

# 3. Run ref-emu-dos — should boot to COMMAND.COM prompt
node tools/ref-emu-dos.mjs 50000
# VGA dump should show "Enhanced DR-DOS kernel..." and possibly the prompt
```
