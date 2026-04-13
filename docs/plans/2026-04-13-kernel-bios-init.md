# Kernel BIOS Init Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the kernel's drbio layer run by replacing generate-dos.mjs's JS-side IVT/BDA/splash construction with a real NASM init stub that executes on the 8086.

**Architecture:** A small flat binary (`bios/init.asm`) runs at F000:0000. It populates the IVT, initializes BDA fields, writes the boot splash to VGA text memory, then jumps FAR to 0060:0000 to boot the kernel. `generate-dos.mjs` assembles this stub, prepends it to the D6 microcode stubs to form the full BIOS ROM, and sets CS:IP to F000:0000. `ref-emu-dos.mjs` loads the same ROM + uses `createBiosHandlers` as the `int_handler` hook.

**Tech Stack:** NASM (x86 assembly), Node.js (generate-dos.mjs, ref-emu-dos.mjs), CSS (emitted by transpiler)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `bios/init.asm` | NASM flat binary: IVT setup, BDA init, VGA splash, JMP FAR to kernel |
| Modify | `transpiler/generate-dos.mjs` | Assemble init.asm, prepend to BIOS ROM, remove JS IVT/BDA/splash, set CS:IP=F000:0000 |
| Modify | `tools/ref-emu-dos.mjs` | Remove gossamer dependency, load init stub + D6 stubs into ROM, wire int_handler |

---

### Task 1: Write the BIOS init stub (`bios/init.asm`)

**Files:**
- Create: `bios/init.asm`

This is a NASM flat binary (`-f bin`) that will live at F000:0000 in the BIOS ROM. It must be written to assemble correctly with `nasm -f bin`. The init stub does everything `generate-dos.mjs` currently does in JS, but as real x86 instructions.

The D6 microcode stubs from `buildBiosRom()` will be appended directly after this binary. The init stub needs to know the offsets of each stub so it can write the correct IVT entries. We'll define these offsets as NASM `equ` constants computed from `initStubSize + stubIndex * 3` (each D6 stub is 3 bytes: `[0xD6, routineID, 0xCF]`).

The stub ordering from `buildBiosRom()` (iterating `IVT_ENTRIES` in key order) is:
- INT 08h at stub offset 0 (3 bytes)
- INT 09h at stub offset 3
- INT 10h at stub offset 6
- INT 11h at stub offset 9
- INT 12h at stub offset 12
- INT 13h at stub offset 15
- INT 15h at stub offset 18
- INT 16h at stub offset 21
- INT 19h at stub offset 24
- INT 1Ah at stub offset 27
- INT 20h at stub offset 30

But the init stub's own size isn't known until assembled. We solve this with a two-pass approach: the `generate-dos.mjs` code will patch the stub offsets at runtime (Task 2). For now, the assembly uses symbolic labels that reference a known base.

**Actually, simpler approach:** The init stub knows its own size via NASM's `$` and `$$` operators. We define `INIT_SIZE equ (end_of_init - $$)`. Then each D6 stub offset (relative to ROM start) is `INIT_SIZE + N*3`. The stub order is fixed by `buildBiosRom()`.

- [ ] **Step 1: Create `bios/init.asm`**

```nasm
; bios/init.asm — BIOS initialization stub for CSS-DOS
; Assembled with: nasm -f bin -o bios/init.bin bios/init.asm
; Lives at F000:0000 in the BIOS ROM. The D6 microcode stubs
; (built by buildBiosRom()) are appended immediately after this binary.
;
; What this does:
;   1. Set up stack at 0030:0100 (linear 0x400, just below BDA)
;   2. Clear the VGA text screen (fill 0xB8000 with space + 0x07)
;   3. Default all 256 IVT entries to a dummy IRET at the end of this stub
;   4. Override IVT entries for handled interrupts with D6 stub pointers
;   5. Initialize BDA fields (equipment, memory, keyboard, video, timer, floppy)
;   6. Write boot splash to VGA text buffer
;   7. Set cursor position below splash
;   8. JMP FAR 0060:0000 (kernel entry)

[BITS 16]
[ORG 0]              ; Offsets relative to F000:0000

; ---- Step 1: Stack ----
cli
mov ax, 0x0030
mov ss, ax
mov sp, 0x0100
sti

; ---- Step 2: Clear VGA text screen ----
; Fill 80*25*2 = 4000 bytes at B800:0000 with [0x20, 0x07] pairs
mov ax, 0xB800
mov es, ax
xor di, di
mov ax, 0x0720       ; attribute 0x07, char 0x20 (space)
mov cx, 2000         ; 2000 words = 4000 bytes
cld
rep stosw

; ---- Step 3: Default all 256 IVT entries to dummy IRET ----
; IVT is at 0000:0000, each entry is [offset_lo, offset_hi, seg_lo, seg_hi]
; Point all to the IRET byte at the end of this init stub
xor ax, ax
mov es, ax           ; ES = 0000
xor di, di           ; DI = 0000 (start of IVT)
mov cx, 256          ; 256 entries
.default_ivt:
  mov word [es:di], dummy_iret    ; offset of IRET in ROM
  mov word [es:di+2], 0xF000      ; segment
  add di, 4
  loop .default_ivt

; ---- Step 4: Override IVT entries for handled interrupts ----
; D6 stubs start at offset STUB_BASE (= end of init stub + 1 for dummy IRET)
; Each stub is 3 bytes. Stub order matches IVT_ENTRIES key order.
; Macro: set_ivt INT_NUM, STUB_INDEX
%macro set_ivt 2
  mov word [es:%1*4], STUB_BASE + (%2 * 3)
  mov word [es:%1*4+2], 0xF000
%endmacro

  set_ivt 0x08, 0    ; INT 08h — timer
  set_ivt 0x09, 1    ; INT 09h — keyboard IRQ
  set_ivt 0x10, 2    ; INT 10h — video
  set_ivt 0x11, 3    ; INT 11h — equipment list
  set_ivt 0x12, 4    ; INT 12h — memory size
  set_ivt 0x13, 5    ; INT 13h — disk
  set_ivt 0x15, 6    ; INT 15h — system services
  set_ivt 0x16, 7    ; INT 16h — keyboard input
  set_ivt 0x19, 8    ; INT 19h — bootstrap
  set_ivt 0x1A, 9    ; INT 1Ah — time of day
  set_ivt 0x20, 10   ; INT 20h — program terminate

; ---- Step 5: Initialize BDA (0040:0000 = linear 0x0400) ----
mov ax, 0x0040
mov es, ax

; Equipment list word at 0x0410: floppy present + 80x25 color = 0x0021
mov word [es:0x10], 0x0021

; Memory size word at 0x0413: 640 KiB
mov word [es:0x13], 640

; Keyboard buffer pointers (offsets relative to BDA segment)
mov word [es:0x1A], 0x001E    ; head
mov word [es:0x1C], 0x001E    ; tail (empty)
mov word [es:0x80], 0x001E    ; buffer start
mov word [es:0x82], 0x003E    ; buffer end

; Keyboard flags
mov byte [es:0x17], 0
mov byte [es:0x18], 0
mov byte [es:0x19], 0

; Video mode and parameters
mov byte [es:0x49], 0x03      ; mode 3 = 80x25 color text
mov word [es:0x4A], 80        ; columns per row
mov word [es:0x4C], 0x1000    ; page size
mov word [es:0x4E], 0x0000    ; page 0 offset
; Cursor positions for pages 0-3 (col, row pairs) — all 0
mov word [es:0x50], 0x0000
mov word [es:0x52], 0x0000
mov word [es:0x54], 0x0000
mov word [es:0x56], 0x0000
; Cursor shape
mov byte [es:0x60], 0x07      ; end line
mov byte [es:0x61], 0x06      ; start line
; Active display page
mov byte [es:0x62], 0
; CRT controller port
mov word [es:0x63], 0x03D4
; Rows minus 1, char height
mov byte [es:0x84], 24
mov word [es:0x85], 16

; Timer tick counter (dword at 0x046C)
mov word [es:0x6C], 0
mov word [es:0x6E], 0
mov byte [es:0x70], 0         ; midnight flag

; Floppy state
mov byte [es:0x3E], 0
mov byte [es:0x3F], 0
mov byte [es:0x40], 0
mov byte [es:0x41], 0

; Warm boot flag
mov word [es:0x72], 0

; ---- Step 6: Write boot splash to VGA text buffer ----
; Use INT 10h AH=0Eh (teletype) via our own D6 handler.
; But the D6 handlers are CSS microcode — they don't execute as real x86.
; So we write directly to VGA memory instead.
mov ax, 0xB800
mov es, ax

; Helper macro: write string at (row, col) with attribute
; Uses SI as string pointer, DI as VGA offset
%macro vga_str 3  ; row, col, attr
  mov di, ((%1) * 80 + (%2)) * 2
  mov ah, %3
  %%loop:
    lodsb
    test al, al
    jz %%done
    stosw          ; write char + attr
    jmp %%loop
  %%done:
%endmacro

; DS = F000 (our segment, where strings live in ROM)
mov ax, 0xF000
mov ds, ax

vga_str 0, 0, 0x0F    ; row 0, col 0, white
splash_0: db 'CSS-BIOS v0.3', 0

vga_str 1, 0, 0x07    ; row 1, col 0, gray
splash_1: db '640K conventional memory', 0

vga_str 2, 0, 0x07
splash_2: db 'IVT: 256 vectors', 0

vga_str 3, 0, 0x07
splash_3: db 'BDA: initialized', 0

vga_str 4, 0, 0x07
splash_4: db 'Disk: FAT12 image', 0

vga_str 5, 0, 0x07
splash_5: db 'Kernel: at 0060:0000', 0

vga_str 6, 0, 0x0F    ; white
splash_6: db 'Booting DOS...', 0

; ---- Step 7: Set cursor position below splash ----
; BDA cursor pos for page 0 at 0040:0050 = (col, row) as two bytes
mov ax, 0x0040
mov es, ax
mov byte [es:0x50], 0    ; col = 0
mov byte [es:0x51], 8    ; row = 8

; ---- Step 8: Jump to kernel ----
; BL = 0 (boot drive A:), DS = 0
xor ax, ax
mov ds, ax
mov bl, 0                ; boot drive A:
jmp 0x0060:0x0000        ; FAR jump to kernel entry

; Dummy IRET handler — default IVT entries point here
dummy_iret:
  iret

; D6 microcode stubs are appended here by generate-dos.mjs
STUB_BASE equ (dummy_iret + 1 - $$)
```

Wait — this approach has a problem. The `vga_str` macro calls `lodsb` which reads from DS:SI, but the strings are inline between the macros and the instructions flow into them. Let me restructure: put all strings at the end (before `dummy_iret`) and reference them by label.

- [ ] **Step 1 (revised): Create `bios/init.asm` with strings at end**

```nasm
; bios/init.asm — BIOS initialization stub for CSS-DOS
; Assembled with: nasm -f bin -o bios/init.bin bios/init.asm
; Lives at F000:0000 in the BIOS ROM. The D6 microcode stubs
; (built by buildBiosRom()) are appended immediately after this binary.

[BITS 16]
[ORG 0]

; ========== Step 1: Stack ==========
cli
mov ax, 0x0030
mov ss, ax
mov sp, 0x0100
sti

; ========== Step 2: Clear VGA text screen ==========
mov ax, 0xB800
mov es, ax
xor di, di
mov ax, 0x0720          ; attr=0x07, char=0x20
mov cx, 2000
cld
rep stosw

; ========== Step 3: Default all 256 IVT entries to dummy IRET ==========
xor ax, ax
mov es, ax
xor di, di
mov cx, 256
.default_ivt:
  mov word [es:di], dummy_iret
  mov word [es:di+2], 0xF000
  add di, 4
  loop .default_ivt

; ========== Step 4: Override IVT for handled interrupts ==========
%macro set_ivt 2
  mov word [es:%1*4], STUB_BASE + (%2 * 3)
  mov word [es:%1*4+2], 0xF000
%endmacro

  set_ivt 0x08, 0       ; timer
  set_ivt 0x09, 1       ; keyboard IRQ
  set_ivt 0x10, 2       ; video
  set_ivt 0x11, 3       ; equipment
  set_ivt 0x12, 4       ; memory size
  set_ivt 0x13, 5       ; disk
  set_ivt 0x15, 6       ; system services
  set_ivt 0x16, 7       ; keyboard input
  set_ivt 0x19, 8       ; bootstrap
  set_ivt 0x1A, 9       ; time of day
  set_ivt 0x20, 10      ; program terminate

; ========== Step 5: Initialize BDA ==========
mov ax, 0x0040
mov es, ax

; Equipment list (0x0410)
mov word [es:0x10], 0x0021

; Memory size (0x0413) — 640 KiB
mov word [es:0x13], 640

; Keyboard buffer
mov word [es:0x1A], 0x001E    ; head
mov word [es:0x1C], 0x001E    ; tail
mov word [es:0x80], 0x001E    ; buf start
mov word [es:0x82], 0x003E    ; buf end
mov byte [es:0x17], 0         ; shift flags
mov byte [es:0x18], 0
mov byte [es:0x19], 0

; Video
mov byte [es:0x49], 0x03      ; mode 3
mov word [es:0x4A], 80        ; columns
mov word [es:0x4C], 0x1000    ; page size
mov word [es:0x4E], 0x0000    ; page 0 offset
mov word [es:0x50], 0x0000    ; cursor page 0
mov word [es:0x52], 0x0000    ; cursor page 1
mov word [es:0x54], 0x0000    ; cursor page 2
mov word [es:0x56], 0x0000    ; cursor page 3
mov byte [es:0x60], 0x07      ; cursor end
mov byte [es:0x61], 0x06      ; cursor start
mov byte [es:0x62], 0         ; active page
mov word [es:0x63], 0x03D4    ; CRT port
mov byte [es:0x84], 24        ; rows - 1
mov word [es:0x85], 16        ; char height

; Timer
mov word [es:0x6C], 0
mov word [es:0x6E], 0
mov byte [es:0x70], 0

; Floppy
mov byte [es:0x3E], 0
mov byte [es:0x3F], 0
mov byte [es:0x40], 0
mov byte [es:0x41], 0

; Warm boot
mov word [es:0x72], 0

; ========== Step 6: Boot splash ==========
; Write strings directly to VGA memory at B800:0000
; DS = F000 (our ROM segment, where strings are)
mov ax, 0xF000
mov ds, ax
mov ax, 0xB800
mov es, ax

; Write each splash line: load SI with string addr, DI with VGA offset, AH with attr
%macro write_splash 3    ; string_label, vga_offset, attr
  mov si, %1
  mov di, %2
  mov ah, %3
  %%loop:
    lodsb
    test al, al
    jz %%done
    stosw
    jmp %%loop
  %%done:
%endmacro

  write_splash str_line0, (0*80+0)*2, 0x0F
  write_splash str_line1, (1*80+0)*2, 0x07
  write_splash str_line2, (2*80+0)*2, 0x07
  write_splash str_line3, (3*80+0)*2, 0x07
  write_splash str_line4, (4*80+0)*2, 0x07
  write_splash str_line5, (5*80+0)*2, 0x07
  write_splash str_line6, (6*80+0)*2, 0x0F

; ========== Step 7: Set cursor below splash ==========
mov ax, 0x0040
mov es, ax
mov byte [es:0x50], 0    ; col
mov byte [es:0x51], 8    ; row

; ========== Step 8: Jump to kernel ==========
xor ax, ax
mov ds, ax
xor bx, bx              ; BL=0 = boot drive A:
jmp 0x0060:0x0000

; ========== String data ==========
str_line0: db 'CSS-BIOS v0.3', 0
str_line1: db '640K conventional memory', 0
str_line2: db 'IVT: 256 vectors', 0
str_line3: db 'BDA: initialized', 0
str_line4: db 'Disk: FAT12 image', 0
str_line5: db 'Kernel: at 0060:0000', 0
str_line6: db 'Booting DOS...', 0

; ========== Dummy IRET (default IVT target) ==========
dummy_iret:
  iret

; ========== Constants ==========
; STUB_BASE: offset of first D6 stub (appended after this binary)
STUB_BASE equ ($ - $$)
```

- [ ] **Step 2: Create the `bios/` directory and assemble to verify**

```bash
mkdir -p bios
"C:\Users\AdmT9N0CX01V65438A\AppData\Local\bin\NASM\nasm.exe" -f bin -o bios/init.bin bios/init.asm
```

Expected: assembles cleanly, produces a binary ~300-400 bytes.

```bash
ls -la bios/init.bin
```

- [ ] **Step 3: Verify with `ndisasm` that the binary looks right**

```bash
"C:\Users\AdmT9N0CX01V65438A\AppData\Local\bin\NASM\ndisasm.exe" -b 16 -o 0 bios/init.bin | head -30
```

Expected: see CLI, MOV AX, MOV SS, MOV SP, STI, MOV AX 0xB800, etc. Sanity check that the code is sensible 16-bit x86.

- [ ] **Step 4: Commit**

```bash
git add bios/init.asm
git commit -m "feat: add BIOS init stub (IVT, BDA, splash, kernel jump)"
```

---

### Task 2: Update `generate-dos.mjs` to assemble and use the init stub

**Files:**
- Modify: `transpiler/generate-dos.mjs`

This task removes the JS-side IVT construction, BDA construction, and VGA splash code, replacing them with: (1) assemble `bios/init.asm` at build time, (2) prepend the assembled bytes to the D6 microcode stubs to form the complete BIOS ROM, (3) set `initialCS=0xF000, initialIP=0x0000`.

- [ ] **Step 1: Replace the IVT/BDA/splash construction with init stub assembly**

In `generate-dos.mjs`, replace everything from `// --- Step 4: Build IVT and BDA ---` through `embData[embData.length - 2] = { addr: BDA_BASE, bytes: [...bda] };` (lines 144-260) with:

```javascript
// --- Step 4: Embedded data (disk only — IVT/BDA/splash done by init stub) ---
const embData = [];
embData.push({ addr: DISK_LINEAR, bytes: diskBytes });
```

- [ ] **Step 2: Assemble the init stub at build time**

Add near the top of the file, after the `BIOS_SEG` constant (line 43), add the NASM path constant:

```javascript
const NASM = resolve('C:\\Users\\AdmT9N0CX01V65438A\\AppData\\Local\\bin\\NASM\\nasm.exe');
```

Replace the Step 1 BIOS ROM build section (lines 88-103) with:

```javascript
// --- Step 1: Build microcode BIOS ROM ---
console.log('Building BIOS ROM (init stub + microcode stubs)...');
const { handlers: biosRomHandlers, romBytes: biosRomBytes } = buildBiosRom();

// Assemble the init stub
const initAsmPath = resolve(projectRoot, 'bios', 'init.asm');
const initBinPath = resolve(projectRoot, 'bios', 'init.bin');
try {
  execSync(`"${NASM}" -f bin -o "${initBinPath}" "${initAsmPath}"`, { stdio: 'pipe' });
} catch (e) {
  console.error('NASM assembly failed:', e.stderr?.toString());
  process.exit(1);
}
const initBytes = [...readFileSync(initBinPath)];

// Complete BIOS ROM = init stub bytes + D6 microcode stub bytes
// The init stub's STUB_BASE equ points to the byte after itself,
// which is where the D6 stubs begin.
const biosBytes = [...initBytes, ...biosRomBytes];

console.log(`  Init stub: ${initBytes.length} bytes`);
console.log(`  D6 stubs: ${biosRomBytes.length} bytes`);
console.log(`  Total BIOS ROM: ${biosBytes.length} bytes`);
```

- [ ] **Step 3: Remove `dummyHandlerOffset` / `romStubBase` adjustment code**

Delete lines 97-103 (the old code that prepended 0xCF and adjusted handler offsets). The init stub already has its own `dummy_iret` label and the D6 stubs are at the right offsets.

Also remove the `biosRomHandlers` offset adjustment loop — the D6 stub offsets are now baked into the init stub assembly. The `biosRomHandlers` map is no longer used for IVT construction (the assembly handles it). But we still need it? No — `emitCSS` doesn't use it. The only consumer was the IVT construction we just removed. So we can drop the `handlers` destructuring.

Actually, `buildBiosRom()` is still needed for the `romBytes` (the D6 stub bytes themselves). Keep that call but we can ignore `handlers`.

- [ ] **Step 4: Update the `emitCSS` call**

Change the `emitCSS` call (currently lines 282-297) to:

```javascript
emitCSS({
  programBytes: kernelBytes,
  biosBytes,
  memoryZones,
  embeddedData: embData,
  htmlMode,
  programOffset: KERNEL_LINEAR,
  initialCS: 0xF000,             // start at BIOS init stub
  initialIP: 0x0000,
  initialRegs: {
    // Hardware reset state — the init stub sets everything up
  },
}, ws);
```

- [ ] **Step 5: Remove the `memOverride`-dependent splash text**

The `memKB`, `vgaWriteStr`, and splash string code is deleted in Step 1. Make sure `memOverride` / `memBytes` resolution still happens before the `dosMemoryZones` call (it currently does — it's at line 217-218 which is above the zones call at line 271). Move it up if needed, but verify it's still present.

The `defaultMem` and `memBytes` computation stays:

```javascript
const defaultMem = 0xA0000;
const memBytes = memOverride != null ? memOverride : defaultMem;
```

- [ ] **Step 6: Run generate-dos.mjs and verify it completes**

```bash
node transpiler/generate-dos.mjs dos/bin/command.com -o test-init.css --no-gfx
```

Expected: should print the new BIOS ROM stats, assemble the init stub, and produce the CSS file without errors.

- [ ] **Step 7: Verify the BIOS ROM in the CSS contains the init stub**

Quick sanity check: the first bytes of the BIOS ROM at 0xF0000 should be the init stub instructions (CLI = 0xFA, MOV AX = 0xB8, ...), not 0xCF (the old dummy IRET).

```bash
node -e "
const fs = require('fs');
const css = fs.readFileSync('test-init.css', 'utf-8');
// Find the first few memory properties at 0xF0000
const m = css.match(/--m983040:\s*(\d+)/);  // 0xF0000 = 983040
console.log('Byte at F0000:', m?.[1]);
// 0xFA = 250 (CLI instruction)
"
```

Expected: `Byte at F0000: 250` (which is 0xFA = CLI).

- [ ] **Step 8: Commit**

```bash
git add transpiler/generate-dos.mjs
git commit -m "feat: generate-dos uses assembled init stub, removes JS IVT/BDA/splash"
```

---

### Task 3: Update `ref-emu-dos.mjs` to use init stub + JS BIOS handlers

**Files:**
- Modify: `tools/ref-emu-dos.mjs`

This task replaces the gossamer-dos.bin dependency with: (1) assemble or read `bios/init.bin`, (2) append D6 stub bytes, (3) load into ROM at 0xF0000, (4) wire `createBiosHandlers` as the `int_handler` hook, (5) start at F000:0000.

The key insight: js8086 will execute the real x86 instructions in the init stub (CLI, MOV, REP STOSW, etc.) — that all works because it's a normal 8086 emulator. When the kernel later does `INT 13h`, js8086's `callInt()` checks `int_handler` first, and our handler intercepts it before js8086 tries to push flags/jump through the IVT to the D6 stub (which would crash because js8086 doesn't know opcode 0xD6).

The `compare-dos.mjs` file already has the exact pattern we need (lines 118-158). We'll follow it.

- [ ] **Step 1: Rewrite `ref-emu-dos.mjs`**

Replace the entire file with:

```javascript
#!/usr/bin/env node
// Reference 8086 emulator for DOS boot testing.
// Loads the same memory layout as generate-dos.mjs:
//   - KERNEL.SYS at 0060:0000 (linear 0x600)
//   - Disk image at D000:0000 (linear 0xD0000)
//   - BIOS ROM (init stub + D6 stubs) at F000:0000
//   - CS:IP starts at F000:0000 (init stub)
//
// Usage: node tools/ref-emu-dos.mjs <ticks> [--json]

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { PIC, PIT, KeyboardController } from './peripherals.mjs';
import { createBiosHandlers } from './lib/bios-handlers.mjs';
import { buildBiosRom } from '../transpiler/src/patterns/bios.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const NASM = resolve('C:\\Users\\AdmT9N0CX01V65438A\\AppData\\Local\\bin\\NASM\\nasm.exe');

// Load the 8086 CPU core
const js8086Path = resolve(__dirname, 'js8086.js');
const js8086Source = readFileSync(js8086Path, 'utf-8');
const evalSource = js8086Source.replace("'use strict';", '').replace('let CPU_186 = 0;', 'var CPU_186 = 0;');
const Intel8086 = new Function(evalSource + '\nreturn Intel8086;')();

// --- CLI ---
const args = process.argv.slice(2);
const maxTicks = parseInt(args[0]) || 10000;
const jsonMode = args.includes('--json');

// --- Constants ---
const KERNEL_LINEAR = 0x600;
const DISK_LINEAR   = 0xD0000;
const BIOS_LINEAR   = 0xF0000;

// --- Assemble init stub if needed ---
const initAsmPath = resolve(projectRoot, 'bios', 'init.asm');
const initBinPath = resolve(projectRoot, 'bios', 'init.bin');
if (!existsSync(initBinPath) || readFileSync(initAsmPath).length !== readFileSync(initBinPath)._nasmCheck) {
  // Always reassemble to be safe
  execSync(`"${NASM}" -f bin -o "${initBinPath}" "${initAsmPath}"`, { stdio: 'pipe' });
}
const initBytes = [...readFileSync(initBinPath)];

// --- Build BIOS ROM ---
const { romBytes: biosRomBytes } = buildBiosRom();
const biosBytes = [...initBytes, ...biosRomBytes];

// --- Load binaries ---
const kernelBin = readFileSync(resolve(projectRoot, 'dos', 'bin', 'kernel.sys'));
const diskBin = readFileSync(resolve(projectRoot, 'dos', 'disk.img'));

console.error(`Init stub: ${initBytes.length} bytes`);
console.error(`BIOS ROM: ${biosBytes.length} bytes`);
console.error(`Kernel: ${kernelBin.length} bytes`);
console.error(`Disk: ${diskBin.length} bytes`);

// --- Setup 1MB memory ---
const memory = new Uint8Array(1024 * 1024);

for (let i = 0; i < kernelBin.length; i++) memory[KERNEL_LINEAR + i] = kernelBin[i];
for (let i = 0; i < diskBin.length && DISK_LINEAR + i < memory.length; i++) {
  memory[DISK_LINEAR + i] = diskBin[i];
}
for (let i = 0; i < biosBytes.length; i++) memory[BIOS_LINEAR + i] = biosBytes[i];

// IVT is NOT pre-populated — init stub does it at runtime

// --- Peripherals + CPU ---
const pic = new PIC();
const pit = new PIT(pic);
const kbd = new KeyboardController(pic);
let int_handler = null;

const cpu = Intel8086(
  (addr, val) => { memory[addr & 0xFFFFF] = val & 0xFF; },
  (addr) => memory[addr & 0xFFFFF],
  pic, pit, (type) => int_handler ? int_handler(type) : false,
);
cpu.reset();
cpu.setRegs({
  cs: 0xF000,
  ip: 0x0000,        // Start at init stub
  ss: 0,
  sp: 0xFFF8,
  ds: 0,
  es: 0,
});

int_handler = createBiosHandlers(
  memory, pic, kbd,
  () => cpu.getRegs(),
  (regs) => cpu.setRegs(regs),
);

// --- Helper ---
function getState() {
  const r = cpu.getRegs();
  return {
    AX: (r.ah << 8) | r.al,
    CX: (r.ch << 8) | r.cl,
    DX: (r.dh << 8) | r.dl,
    BX: (r.bh << 8) | r.bl,
    SP: r.sp, BP: r.bp, SI: r.si, DI: r.di,
    IP: r.ip, ES: r.es, CS: r.cs, SS: r.ss, DS: r.ds, FLAGS: r.flags,
  };
}

// --- Run ---
const snapshots = [];
let sameIPCount = 0;
let lastFlatIP = -1;

for (let tick = 0; tick < maxTicks; tick++) {
  const state = getState();

  if (jsonMode) {
    snapshots.push({ tick, ...state });
  } else if (tick < 50 || tick % 1000 === 0) {
    console.error(
      `t${tick}: CS=${state.CS.toString(16)}:${state.IP.toString(16)} ` +
      `AX=${state.AX.toString(16)} CX=${state.CX.toString(16)} ` +
      `DS=${state.DS.toString(16)} SP=${state.SP.toString(16)} FL=${state.FLAGS.toString(16)}`
    );
  }

  cpu.step();

  const flatIP = state.CS * 16 + state.IP;
  if (flatIP === lastFlatIP) {
    sameIPCount++;
    if (sameIPCount >= 3) {
      console.error(`Halted at tick ${tick}, CS:IP=${state.CS.toString(16)}:${state.IP.toString(16)}`);
      if (jsonMode) snapshots.push({ tick: tick + 1, ...getState() });
      break;
    }
  } else {
    sameIPCount = 0;
  }
  lastFlatIP = flatIP;
}

if (jsonMode) {
  console.log(JSON.stringify(snapshots));
}

// --- Dump VGA screen ---
console.error('\n--- VGA Screen ---');
for (let row = 0; row < 25; row++) {
  let line = '';
  for (let col = 0; col < 80; col++) {
    const addr = 0xB8000 + (row * 80 + col) * 2;
    const ch = memory[addr];
    line += (ch >= 0x20 && ch < 0x7F) ? String.fromCharCode(ch) : ' ';
  }
  console.error(line.trimEnd());
}
```

- [ ] **Step 2: Run ref-emu-dos.mjs and verify the init stub executes**

First, make sure the disk image exists (generate-dos.mjs creates it):

```bash
node transpiler/generate-dos.mjs dos/bin/command.com -o /dev/null --no-gfx 2>&1 | head -5
```

Then run the reference emulator:

```bash
node tools/ref-emu-dos.mjs 5000
```

Expected: should see the init stub executing (CS=F000:IP starting from 0), setting up IVT, then jumping to 0060:0000 for the kernel. The VGA screen dump should show the splash text.

- [ ] **Step 3: Commit**

```bash
git add tools/ref-emu-dos.mjs
git commit -m "feat: ref-emu-dos uses init stub + JS BIOS handlers, drops gossamer dependency"
```

---

### Task 4: Fix the init stub assembly issues

**Files:**
- Modify: `bios/init.asm`

This task exists because the init stub in Task 1 likely has assembly issues that will surface during Task 2/3 testing. Common issues:

1. **NASM `ORG 0` with segment overrides**: `[es:0x08*4]` may not assemble — NASM may need explicit calculation like `[es:0x20]` for `0x08*4`.
2. **The `set_ivt` macro using multiplication in address expressions**: NASM may not support `%1*4` in effective addresses. May need to pre-compute: `set_ivt 0x20, 0` where first arg is already `INT_NUM * 4`.
3. **Forward reference to `dummy_iret`** in the IVT default loop and to `STUB_BASE` in the `set_ivt` macro — NASM handles forward references in flat binaries, but verify.
4. **`lodsb`/`stosw` in splash macros**: DS must be F000 (our ROM), ES must be B800 (VGA). Verify the segment setup is correct before each macro invocation.

- [ ] **Step 1: Attempt assembly and fix any NASM errors**

```bash
"C:\Users\AdmT9N0CX01V65438A\AppData\Local\bin\NASM\nasm.exe" -f bin -o bios/init.bin bios/init.asm 2>&1
```

Fix each error iteratively. The most likely fix for the `set_ivt` macro is changing it to take pre-computed IVT byte offsets:

```nasm
%macro set_ivt 2    ; ivt_byte_offset, stub_index
  mov word [es:%1], STUB_BASE + (%2 * 3)
  mov word [es:%1+2], 0xF000
%endmacro

  set_ivt 0x20, 0       ; INT 08h (0x08 * 4 = 0x20)
  set_ivt 0x24, 1       ; INT 09h (0x09 * 4 = 0x24)
  set_ivt 0x40, 2       ; INT 10h (0x10 * 4 = 0x40)
  set_ivt 0x44, 3       ; INT 11h
  set_ivt 0x48, 4       ; INT 12h
  set_ivt 0x4C, 5       ; INT 13h
  set_ivt 0x54, 6       ; INT 15h
  set_ivt 0x58, 7       ; INT 16h
  set_ivt 0x64, 8       ; INT 19h
  set_ivt 0x68, 9       ; INT 1Ah
  set_ivt 0x80, 10      ; INT 20h
```

- [ ] **Step 2: Run ref-emu-dos.mjs and check the IVT is correct**

```bash
node tools/ref-emu-dos.mjs 500
```

After the init stub runs (~200 ticks for the REP STOSW + IVT loop + BDA init), check that CS transitions from F000 to 0060 (the kernel jump). If it hangs or crashes in the init stub, add more trace output to diagnose.

- [ ] **Step 3: Verify IVT entries are correct**

Add a quick check script:

```bash
node -e "
const { readFileSync, execSync } = require('fs');
// After running ref-emu-dos briefly, check memory
// (We'll check the init.bin disassembly instead)
const bin = readFileSync('bios/init.bin');
console.log('Init stub size:', bin.length, 'bytes');
console.log('STUB_BASE should be:', bin.length);
console.log('First D6 stub at ROM offset:', bin.length, '= 0x' + bin.length.toString(16));
"
```

- [ ] **Step 4: Commit fixes**

```bash
git add bios/init.asm
git commit -m "fix: resolve NASM assembly issues in init stub"
```

---

### Task 5: Integration test — boot DOS to COMMAND.COM prompt

**Files:** (no new files — this is a validation task)

This is the smoke test. Generate the CSS with the init stub, run it in calcite, and verify the kernel boots through drbio to the COMMAND.COM prompt.

- [ ] **Step 1: Generate CSS for shell mode**

```bash
node transpiler/generate-dos.mjs dos/bin/command.com -o test-shell.css --no-gfx
```

- [ ] **Step 2: Run in calcite debugger and check VGA output**

```bash
cd ../calcite
cargo run --release --bin calcite-debugger -- --input ../CSS-DOS/test-shell.css
```

Then in another terminal:

```bash
curl -s http://localhost:3333/state | node -e "
const s=JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
console.log('Tick:', s.tick, 'CS:IP', s.registers.CS.toString(16)+':'+s.registers.IP.toString(16));
"

# Advance many ticks to let the kernel boot
curl -s -X POST http://localhost:3333/tick -H 'Content-Type: application/json' -d '{"count":100000}' | node -e "
process.stdin.on('data',d=>console.log(JSON.parse(d)));
"

# Check VGA screen
curl -s http://localhost:3333/vga-text
```

Expected: the VGA text output should show the CSS-BIOS splash, then EDR-DOS boot messages, then the COMMAND.COM prompt. If the kernel hangs, use the calcite debugger to trace where it got stuck (CS:IP will indicate whether it's in the init stub, drbio, or fdos).

- [ ] **Step 3: Run ref-emu-dos.mjs for comparison**

```bash
node tools/ref-emu-dos.mjs 50000
```

Expected: similar output — splash screen, kernel messages, COMMAND.COM prompt in the VGA dump.

- [ ] **Step 4: Clean up temp files and commit**

```bash
rm -f test-init.css test-shell.css
git add -A
git commit -m "feat: kernel drbio init runs — BIOS init stub replaces JS-side IVT/BDA construction"
```

---

### Task 6: Update `compare-dos.mjs` to use the init stub

**Files:**
- Modify: `tools/compare-dos.mjs`

`compare-dos.mjs` currently has its own inline IVT/BDA construction (copied from the old `generate-dos.mjs` pattern). Update it to load the init stub ROM, just like the updated `ref-emu-dos.mjs`. Follow the same pattern from Task 3.

- [ ] **Step 1: Update BIOS ROM loading in compare-dos.mjs**

Replace lines 118-143 (the BIOS ROM + IVT + BDA setup) with:

```javascript
// --- Build BIOS ROM (init stub + D6 stubs) ---
const initBinPath = resolve(projectRoot, 'bios', 'init.bin');
const initBytes = [...readFileSync(initBinPath)];
const { romBytes: biosRomBytes } = buildBiosRom();
const biosBytes = [...initBytes, ...biosRomBytes];
for (let i = 0; i < biosBytes.length; i++) memory[BIOS_LINEAR + i] = biosBytes[i];
// IVT and BDA are set up by the init stub at runtime — don't pre-populate
```

- [ ] **Step 2: Update CPU initial state**

Change the `cpu.setRegs` call to start at F000:0000 instead of 0060:0000:

```javascript
cpu.setRegs({ cs: 0xF000, ip: 0x0000, ss: 0, sp: 0xFFF8, ds: 0, es: 0 });
```

- [ ] **Step 3: Verify compare-dos still works**

```bash
node transpiler/generate-dos.mjs dos/bin/command.com -o test-compare.css --no-gfx
node tools/compare-dos.mjs test-compare.css --ticks=1000
```

- [ ] **Step 4: Clean up and commit**

```bash
rm -f test-compare.css
git add tools/compare-dos.mjs
git commit -m "feat: compare-dos uses init stub ROM, drops inline IVT/BDA construction"
```
