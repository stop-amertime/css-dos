// Shared stack-address expression builders. Single home for the SP=0
// wrap fix - every emitter that touches the stack imports these instead
// of re-deriving the idiom (they used to be copy-pasted per file, with
// "keep in sync" comments pointing at each other).
//
// Stack-write address: SS*16 + (SP - offset) wrapped to 16 bits.
// SP is a 16-bit register on x86; when a PUSH at SP=0 decrements first,
// the resulting offset MUST be 0xFFFE, not -2. Without the wrap the
// address calc gives `SS*16 - 2` (one byte before the segment) instead
// of `SS*16 + 0xFFFE` (one word at the top of the segment), which
// silently misroutes the write into the previous segment. UPX-packed
// programs and any DOS EXEC of an .EXE with `SP=0x0000` in the header
// (e.g. DOOM8088) hit this on the very first push of the new stack.
//
// The +65536 keeps `mod()` input non-negative - same idiom alu.mjs
// uses for DEC/SUB wrap.

export function stackWriteAddr(offset) {
  return `calc(var(--__1SS) * 16 + --lowerBytes(calc(var(--__1SP) - ${offset} + 65536), 16))`;
}

// SP = (SP +/- n) wrapped to 16 bits - same reason: downstream address
// calcs read --__1SP literally, so a negative value would re-bug
// subsequent stack accesses.
export function spDecBy(n) {
  return `--lowerBytes(calc(var(--__1SP) - ${n} + 65536), 16)`;
}

export function spIncBy(n) {
  return `--lowerBytes(calc(var(--__1SP) + ${n}), 16)`;
}

// The word at the top of the stack (SS:SP) - what POP/RET consume.
export function stackReadWord() {
  return `--read2(calc(var(--__1SS) * 16 + var(--__1SP)))`;
}
