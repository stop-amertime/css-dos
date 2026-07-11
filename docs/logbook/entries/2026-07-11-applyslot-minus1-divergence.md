# FINDING: suppressed (-1) width-2 writes corrupt byte 0 in Chrome, not in calcite

Probed 2026-07-11 (no calcite sibling in env; probes are reproducible):
- Real Chromium 141, spec CSS: `--applySlot(0, 1, -1, 0, 4660, 2)` = **18** —
  a width-2 write whose --memAddrN fell to the `-1` "no write" sentinel takes
  the `hiOff: 0` straddle arm at cell 0 and writes hi(val) into byte 0.
  Probe: scratchpad applyslot-probe.html technique (extract --applySlot +
  --lowerBytes/--rightShift from css-lib.mjs, read computed value).
- calcite wasm (vendored): hack-path probe cart runs `or ax,ax` (mod=3 →
  addr -1, --_writeWidth 2, slot live) then prints 'A'+mem[0] → byte 0 clean.
Affected class (already shipping): every width-2 opcode whose addr dispatch
falls to -1 while its slot is live — reg-form OR/AND/XOR/MOV r/m16 (mod=3),
INTO with OF=0, Group FF jmp-reg (/4 falls to else). PACK_SIZE=1 byte rule has
the same hazard (`style(--memAddrN: -1)` matches byte 0's key-1 branch).
Cardinal rule: the CSS is what's wrong (must work in Chrome); calcite happens
to guard. Fix options: change the sentinel to -2 (addr+1 stays negative), or
an edge variant of --applySlot for cell 0 — either needs calcite-side
recognizer checks (broadcast-write may assume the -1 shape), so do it in a
session with a calcite checkout + fulldiff. Chrome-side-only latent today.
