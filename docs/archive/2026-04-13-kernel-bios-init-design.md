# Design: Let the kernel's BIOS init (drbio) run

**Date:** 2026-04-13
**Issue:** stop-amertime/css-dos#17

## Problem

`generate-dos.mjs` skips the kernel's BIOS init layer (drbio). It loads
kernel.sys at 0060:0000, pre-populates the IVT/BDA/disk image in memory,
and jumps straight to the kernel entry point. But kernel.sys is a
single-file kernel that includes drbio — the hardware abstraction layer
that sits on top of our BIOS. drbio:

- Decompresses the kernel (it's RLE-compressed in the binary)
- Detects memory size via INT 12h, probes for hard disks via INT 13h
- Initializes device drivers (CON, AUX, PRN, CLOCK, DISK, etc.)
- Builds the DDSC chain (disk parameter blocks)
- Processes CONFIG.SYS
- Relocates itself to high memory
- Sets up the List of Lists and other fdos internal structures

We skip all of this. The result: the kernel's internal data structures are
uninitialized, the DDSC chain is corrupt, and the kernel hangs.

## Layer model

```
Application (bootle.com, COMMAND.COM)
        | INT 21h
EDR-DOS fdos (file system, process management)
        | INT 13h, INT 10h, etc.
EDR-DOS drbio (device drivers, hardware abstraction)
        | INT 13h, INT 10h, etc.
CSS-BIOS (our microcode handlers — keyboard, VGA, disk, timer)
        |
CSS custom properties ("hardware")
```

drbio is a client of our BIOS. It calls INT 12h to get memory size, INT 13h
to read disk sectors, INT 10h to print characters. Our BIOS handlers answer
these calls. We were skipping drbio entirely and trying to pre-populate the
structures it would have built — getting it wrong.

## Design

### 1. BIOS init stub (`bios/init.asm`)

A small NASM flat binary that lives at the start of the BIOS ROM (F000:0000).
Real x86 instructions that both the CSS engine and any reference emulator
execute. It does:

1. Clear the screen (fill 0xB8000 with space + attribute 0x07)
2. Set up the stack (SS:SP = 0030:0100, linear 0x400, just below BDA)
3. Populate the IVT: default all 256 entries to an IRET stub, then
   overwrite entries for INT 08h, 09h, 10h, 11h, 12h, 13h, 15h, 16h,
   19h, 1Ah, 20h with pointers to the D6 microcode stubs in ROM
4. Initialize BDA fields: equipment word, memory size (640K), keyboard
   buffer pointers, video mode (03h = 80x25 text), timer, floppy state
5. Write VGA splash lines after each stage completes (so the screen
   shows real progress, not pre-baked text)
6. Set cursor position in BDA below the splash
7. Set BL=0 (boot drive A:), JMP FAR 0060:0000

The D6 microcode stubs follow the init stub in ROM. The init stub knows
their offsets so it can write the correct IVT entries.

The source lives at `bios/init.asm`. It is assembled at build time by
`generate-dos.mjs` using NASM (already a project dependency at
`C:\Users\...\NASM\nasm.exe`). The assembled bytes are prepended to the
D6 stub bytes from `buildBiosRom()` to form the complete BIOS ROM.

### 2. Changes to `generate-dos.mjs`

**Remove:**
- IVT construction (the ivt array, the loop, the embData push)
- BDA construction (the bda array, all field writes, the embData push)
- Boot splash VGA buffer construction and embData push

**Keep:**
- Disk image at 0xD0000 (embData)
- Kernel at 0x600 (programBytes)

**Add:**
- Load the assembled init stub bytes
- Prepend them to the BIOS ROM (init stub + D6 microcode stubs)
- Set initialCS=0xF000, initialIP=0x0000 (execution starts at init stub)

**Change:**
- initialRegs becomes minimal (hardware reset state — the stub sets
  up everything else)

### 3. Changes to `ref-emu-dos.mjs`

**Remove:**
- Dependency on `gossamer-dos.bin` and `gossamer-dos.lst`
- The listing file parsing for biosInitOffset

**Add:**
- Load the same assembled init stub + D6 stub bytes into ROM at 0xF0000
- Use `createBiosHandlers` from `bios-handlers.mjs` as the `int_handler`
  hook for js8086

**Change:**
- CS:IP starts at F000:0000 (init stub, not gossamer offset)

### 4. Conformance testing

Tick-accurate conformance testing between CSS and JS is not viable for the
DOS boot path. The D6 microcode system means the two sides have
fundamentally different execution traces — CSS does BIOS calls in 1-3
microcode ticks, JS does them instantly via the `int_handler` hook.

Additionally, the kernel's drbio saves IVT vectors and later calls through
them via CALL FAR (not INT instructions). The `int_handler` hook only
intercepts INT instructions, so these indirect calls to D6 stubs would
crash js8086.

**For the DOS boot path, debugging is against documentation, not against a
reference trace:**
- edrdos source at `../edrdos/` (drbio in `drbio/`, fdos in `drdos/`)
- Kernel map file at `dos/ke2044_86f16.zip` for symbol lookup
- Ralf Brown's Interrupt List for INT interfaces
- Calcite debugger for tick-by-tick CSS/calcite tracing

Conformance testing remains valid for individual instruction correctness
(the `.com` test programs that don't involve BIOS calls).

**Future:** stop-amertime/css-dos#18 explores replacing D6 microcode with
real assembly BIOS handlers. If done, both sides would execute identical
bytes and conformance testing would work for the full boot path.

### 5. What stays the same

- The D6 opcode / microcode BIOS pattern for CSS
- `bios.mjs` (CSS microcode handlers)
- `bios-handlers.mjs` (JS handlers for ref emulator)
- The disk image at 0xD0000
- The kernel loaded at 0x600
- All existing instruction-level conformance tests

### 6. What the kernel's drbio needs from us

Our BIOS handlers must correctly respond to the INT calls drbio makes
during init:

| INT | Service | What drbio expects |
|-----|---------|-------------------|
| 12h | Memory size | AX = 640 (KB) |
| 13h AH=00h | Disk reset | CF=0 |
| 13h AH=02h | Read sectors | Read from disk image at 0xD0000 |
| 13h AH=08h (DL<80h) | Floppy params | 1.44MB geometry, 1 drive |
| 13h AH=08h (DL>=80h) | Hard disk params | CF=1, DL=0 (no hard disks) |
| 13h AH=15h | Disk type | AH=01 (floppy, no change detect) |
| 13h AH=41h (DL>=80h) | LBA extensions | CF=1 (not supported) |
| 15h AH=88h | Extended memory | AX=0 (none) |
| 10h AH=0Eh | Teletype | Write char to VGA + advance cursor |
| 10h AH=00h | Set video mode | Update BDA, clear screen |
| 11h | Equipment list | AX from BDA 0x0410 |
| 1Ah AH=00h | Tick count | CX:DX from BDA 0x046C |
| 1Ah AH=02h | RTC time | Return 00:00:00 |
| 1Ah AH=04h | RTC date | Return 2025-01-01 |
| 16h AH=01h | Check keyboard | ZF=1 (empty) or peek key |

These are already implemented in both `bios.mjs` and `bios-handlers.mjs`.
The init stub just needs to wire the IVT so drbio can reach them.
