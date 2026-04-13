# V3 Conformance Progress

Tracking the state of conformance testing between the CSS emulator (via calcite)
and the JS reference emulator (js8086.js) on the DOS boot path.

## Current state

**3740 instructions conformant** on `bootle.com` DOS boot (as of 2026-04-13).

The JS reference emulator boots DOS fully — kernel loads, INT 21h installs,
program loads from disk, runs, draws to VGA, waits for keyboard. The CSS/calcite
side diverges at instruction 3740.

## Test setup

```bash
# Generate CSS (from CSS-DOS repo)
node transpiler/generate-dos.mjs ../calcite/programs/bootle.com -o ../calcite/output/bootle.css

# Run JS reference standalone (verify it works)
cd ../calcite && node tools/ref-dos.mjs --ticks=1000000 --vga

# Conformance test (start debugger, then fulldiff)
cd ../calcite
target/release/calcite-debugger.exe -i output/bootle.css &
# Wait for "Debug server listening" message
node tools/fulldiff.mjs --ticks=5000
```

## Bugs fixed this session

### 1. Segment override prefix decode bug (prefixLen wrapper)

**Symptom:** `DS: PUSH word [BP+0x1E]` (3E FF 76 1E) advanced IP by 5 instead of 4.

**Root cause:** `emitRegisterDispatch` wrapped the entire IP dispatch in
`calc(... + var(--prefixLen))`. For multi-μop instructions with inner conditional
holds (`else: var(--__1IP)`), the wrapper made IP drift by prefixLen during
mid-instruction cycles.

**Fix:** Removed the wrapper entirely. Each emitter now explicitly includes
`+ var(--prefixLen)` in its advance expressions. Holds are naturally correct.
Changed all 126 IP entries across 9 pattern files.

### 2. REP MOVSB rewind off-by-one

**Symptom:** REP MOVSB executed only 1 iteration instead of CX iterations.
After the first iteration, IP rewound to `IP - prefixLen` (one byte before the
prefix) instead of `IP` (the prefix byte itself).

**Root cause:** `repIP()` used `calc(var(--__1IP) - var(--prefixLen))` for the
rewind. This was correct when the old wrapper added `+ prefixLen` to everything
(rewind became `IP - prefixLen + prefixLen = IP`). After removing the wrapper,
it became `IP - prefixLen` — one byte too far back, landing on a 0x00 byte
instead of the F3 prefix.

**Fix:** Changed rewind to `var(--__1IP)` in both `repIP()` and `repCondIP()`.

### 3. SHR/SHL/SAR OF flag for shift-by-CL

**Symptom:** SHR AX, CL with AX=0x8008 CL=4 produced OF=0, reference had OF=1.

**Root cause:** The shift-by-CL flag functions (`shrFlagsN16`, `shlFlagsN16`,
etc.) didn't compute OF. The preserve mask (3856) included OF from previous
flags, which was stale.

**Fix:** Added OF computation to each function (SHR: MSB of original, SHL:
MSB of result XOR CF, SAR: always 0). Changed preserve mask from 3856 to 1808
to exclude OF.

## Next bug to investigate

**Instruction 3740:** `CS: POP [0x8633]` (2E 8F 06 33 86)

All registers match. Memory mismatch at 0x8D34: ref=0x00, calcite=0xF0. This
is the high byte of the word written by POP to CS:0x8633 (linear 0x8D33). The
low byte is correct, but the high byte has 0xF0 (BIOS segment byte?) instead
of 0x00.

Likely cause: word write to memory (2 μops) with segment override — may be
a similar class of bug to the seg-override prefix issue, but in the memory
write address computation rather than IP.

## Architecture notes for debugging

- **fulldiff.mjs** uses instruction-retirement alignment: ticks calcite until
  IP leaves the instruction's prefix range and uOp=0. No REP special-casing
  or tick counting.
- **Debugger kills existing instance** on startup (connects to port, sends
  /shutdown). No need for manual cleanup.
- **ref-dos.mjs** and **fulldiff.mjs** both use microcode BIOS path: kernel
  at 0x600, disk at 0xD0000, IVT/BDA from JS, BIOS ROM bytes at 0xF0000,
  JS BIOS handlers intercept INTs.
