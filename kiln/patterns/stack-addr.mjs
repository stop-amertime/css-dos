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

// --- Interrupt frame shared constants ---
// Every INT-family instruction (INT, INT3, INTO, TF trap, HW IRQ) pushes
// the same three words: FLAGS at SP-2, CS at SP-4, return IP at SP-6, and
// clears IF+TF in the new flags register. These constants are the single
// source of truth - previously each emitter hardcoded its own copy of the
// magic numbers (64767, SA offsets, stack layout), and the TF/IRQ overrides
// in emit-css.mjs used `calc(SP - 6)` without the --lowerBytes wrap that
// protects against SP=0 underflow.

// 0xFCFF = ~(IF | TF) & 0xFFFF - clears bits 8 (TF) and 9 (IF).
export const INT_FLAGS_MASK = 64767;

// CSS expression: new flags = old flags with IF+TF cleared.
export const INT_CLEAR_FLAGS_EXPR = `--and(var(--__1flags), ${INT_FLAGS_MASK})`;

// Stack frame layout: [SP-2]=FLAGS, [SP-4]=CS, [SP-6]=IP.
// Offsets index into stackWriteAddr().
export const INT_FRAME = [
  { offset: 2, val: 'var(--__1flags)', name: 'FLAGS' },
  { offset: 4, val: 'var(--__1CS)',    name: 'CS' },
  { offset: 6, val: null,              name: 'IP' },  // retIP varies per caller
];

/**
 * Emit a complete INT-style push frame for a single opcode.
 *
 * Handles: SP -= 6, load IP+CS from IVT, clear IF+TF, push FLAGS/CS/retIP.
 * Caller provides the variant-specific parameters.
 *
 * @param {object}  dispatch   - DispatchTable instance
 * @param {number}  opcode     - the opcode byte (0xCC, 0xCD, 0xCE)
 * @param {string}  vectorExpr - CSS expr for the IVT entry index (e.g. 'var(--q1)' or '3')
 * @param {string}  retIPExpr  - CSS expr for the return IP to push
 * @param {string}  label      - comment prefix (e.g. 'INT', 'INT 3')
 */
export function emitIntFrame(dispatch, opcode, { vectorExpr, retIPExpr, label }) {
  dispatch.addEntry('SP', opcode, spDecBy(6), `${label} (SP-=6)`);

  dispatch.addEntry('IP', opcode,
    `--read2(calc(${vectorExpr} * 4))`,
    `${label} load IP from IVT`);

  dispatch.addEntry('CS', opcode,
    `--read2(calc(${vectorExpr} * 4 + 2))`,
    `${label} load CS from IVT`);

  dispatch.addEntry('flags', opcode,
    INT_CLEAR_FLAGS_EXPR,
    `${label} clear IF+TF`);

  // 8086 INT pushes: FLAGS first (highest addr), then CS, then IP (lowest).
  dispatch.addMemWriteWord(opcode,
    stackWriteAddr(2),
    `var(--__1flags)`,
    `${label} push FLAGS`);

  dispatch.addMemWriteWord(opcode,
    stackWriteAddr(4),
    `var(--__1CS)`,
    `${label} push CS`);

  dispatch.addMemWriteWord(opcode,
    stackWriteAddr(6),
    retIPExpr,
    `${label} push IP`);
}
