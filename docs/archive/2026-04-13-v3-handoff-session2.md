# V3 Handoff Notes — Session 2 (2026-04-13)

## What was accomplished

### IRET bug fixed (all BIOS handlers)
The folded IRET in all BIOS microcode handlers was broken. The 3-μop sequence
(pop IP → pop CS → pop FLAGS) corrupted the decode pipeline because popping IP
changed `--__1IP` on the next tick, causing `--opcode` to read from the wrong
address. Fix: collapsed all IRET pops into a single retirement μop. IRET is
read-only (stack pops via `--read2`), so all pops fit in one μop. Files changed:
`transpiler/src/patterns/bios.mjs` (INT 16h, 10h, 1Ah).

### New BIOS microcode handlers added
Added INT 08h (timer IRQ tick counter), INT 11h (equipment list), INT 12h
(memory size), INT 13h (disk read with byte-copy loop using biosSrc/biosDst/
biosCnt state vars), INT 15h (misc system services), INT 19h (bootstrap halt).
Files: `transpiler/src/patterns/bios.mjs`, `transpiler/src/template.mjs`
(added biosSrc/biosDst/biosCnt state vars).

### JS reference handlers added
Added matching JS handlers for INT 08h, 11h, 12h, 13h, 15h, 19h in
`tools/lib/bios-handlers.mjs`.

### generate-dos.mjs rewritten to use microcode BIOS
No longer assembles gossamer-dos.asm. Instead:
- Builds microcode ROM stubs via `buildBiosRom()`
- Populates IVT as embeddedData (all 256 entries, defaults to IRET)
- Populates BDA as embeddedData (matching what bios_init did)
- Starts execution at CS=0x0060, IP=0x0000 (kernel entry point directly)
- Sets DS=0, BL=0 (boot drive), SS=0x0030, SP=0x0100 via `initialRegs`

### Memory gap bug fixed
`dosMemoryZones` used to split conventional memory into low (0-0x30000) and
high (0x86000-0xA0000) zones. The DOS kernel relocates itself to ~0x60440 and
its code spans both regions, executing into the unmapped gap. Fixed by using
one contiguous 0-0xA0000 zone. File: `transpiler/src/memory.mjs`.

### compare-dos.mjs created
`tools/compare-dos.mjs` — DOS-path conformance tool using the debugger. Works
but is slow (HTTP per tick). The calcite repo has better tools (`fulldiff.mjs`)
but they need updating to work with the microcode BIOS init path. See below.

### CLAUDE.md updated
Added note pointing to `../calcite/docs/` for debugger and conformance testing
docs. Added instruction to look things up rather than guessing.

## What's broken: segment override prefix decode bug

**This is the current blocker for DOS boot.**

The DOS kernel's first ~43 instructions execute correctly (confirmed by
compare-dos.mjs matching 300 instructions at smaller scale). Then at
instruction `3E FF 76 1E` (DS: PUSH word [BP+0x1E]), calcite advances IP by
5 bytes instead of 4.

Evidence from calcite verbose trace at ticks 7-8:
```
Tick 7: IP=698(0x2BA) uOp=0  ← instruction starts (3E FF 76 1E)
Tick 8: IP=699(0x2BB) uOp=1  ← mid-instruction, IP advanced by 1??
        then IP jumps to 0x2BF on retirement (5 bytes instead of 4)
```

The instruction is: prefix(3E) + opcode(FF) + modrm(76) + disp8(1E) = 4 bytes.
ModR/M 0x76 = mod=01 rm=110 reg=110. mod=01 means disp8 (1 extra byte).
But calcite seems to be treating it as disp16 (2 extra bytes), giving 5 total.

**Where to look:** `transpiler/src/decode.mjs`. The `--modrmLen` function
itself looks correct (mod=1→1, mod=2→2). The bug is likely in how `--mod` is
derived when a segment override prefix is present. `--mod` comes from
`--rightShift(var(--q1), 6)`, and `--q1` depends on `--prefixLen`. If
`--prefixLen` or the q-byte indexing is off by one when there's a DS: prefix,
`--q1` reads the wrong byte, giving wrong mod and wrong instruction length.

The `isPrefix0`/`isPrefix1` detection and `prefixLen` computation at lines
167-184 of decode.mjs is the first place to check. Verify that for instruction
`3E FF 76 1E`: prefixLen=1, q0=FF, q1=76, mod=1, modrmExtra=1.

**The seg-override conformance test (`tests/seg-override.com`) already fails**
with a BX divergence — this is likely the same root cause.

## What's not broken

- Hack path (.COM programs) with keyboard-irq test: fully working, AX=7777
- timer-irq, rep-stosb, bcd tests: all pass conformance
- All existing BIOS microcode handlers (INT 09h, 10h, 16h, 1Ah, 20h): working
- New handlers (INT 08h, 11h, 12h, 13h, 15h, 19h): implemented but untested
  beyond generation (DOS boot crashes before they're called)

## INT 13h design note

The disk read handler (AH=02h) uses a byte-copy μop loop:
- μop 0: compute LBA from CHS, set biosSrc/biosDst/biosCnt
- μop 1: copy one byte (readMem(biosSrc) → memAddr=biosDst), advance ptrs
- μop 1 loops back to itself while biosCnt > 1 (checked via `style(--__1biosCnt: 1)`)
- μop 2: IRET

This has NOT been tested. The kernel crashes on the decode bug before reaching
any INT 13h call. Once the decode bug is fixed, INT 13h will be the next thing
to validate.

## fulldiff.mjs compatibility

The calcite repo's `tools/fulldiff.mjs` currently starts the reference emulator
at CS=0xF000:IP=bios_init using gossamer-dos.bin. Our new generate-dos.mjs
skips gossamer-dos entirely and starts at the kernel. To use fulldiff.mjs,
either:
1. Update it to support microcode BIOS init (start at kernel, use JS BIOS
   handlers from bios-handlers.mjs, set up IVT/BDA in JS memory)
2. Or make the CSS also start at bios_init (reverting the approach — not
   recommended)

Option 1 is right. The JS reference setup in fulldiff.mjs needs to match
what generate-dos.mjs does: load kernel at 0x600, disk at 0xD0000, IVT/BDA
from JS, start at CS=0x60:IP=0, with JS BIOS handlers intercepting interrupts.

## Direction of travel

1. **Fix the seg-override decode bug** in `transpiler/src/decode.mjs`
2. **Re-run DOS boot** — with the decode fix, the kernel should get much further
3. **Update fulldiff.mjs** in the calcite repo to support microcode BIOS init
4. **Use fulldiff.mjs** to find and fix remaining divergences until DOS boots
5. **Validate INT 13h** — the kernel will call it to load the program from disk
6. **End-to-end test** — halt-test.com runs through DOS boot to completion

## Uncommitted changes in CSS-DOS

- `transpiler/src/patterns/bios.mjs` — IRET fix + new handlers (08h,11h,12h,13h,15h,19h)
- `transpiler/src/template.mjs` — biosAH + biosSrc/biosDst/biosCnt state vars, initialRegs
- `transpiler/src/emit-css.mjs` — initialRegs passthrough
- `transpiler/src/memory.mjs` — removed memory gap in dosMemoryZones
- `transpiler/generate-dos.mjs` — rewritten to use microcode BIOS
- `tools/lib/bios-handlers.mjs` — added DOS-path JS handlers
- `tools/compare.mjs` — unchanged from previous session
- `tools/compare-dos.mjs` — new DOS comparison tool (works but slow)
- `CLAUDE.md` — added calcite docs pointer
