// Stack operations: PUSH/POP reg16, PUSH/POP segreg, PUSHF, POPF

import { REG16 } from './regs.mjs';
import { stackWriteAddr, spDecBy, spIncBy, stackReadWord } from './stack-addr.mjs';

/**
 * PUSH reg16 (0x50-0x57)
 * SP -= 2, then write reg value to SS:SP
 * Special case: PUSH SP (0x54) pushes SP-2 (the value after decrement)
 */
export function emitPUSH_reg(dispatch) {
  for (let r = 0; r < 8; r++) {
    const opcode = 0x50 + r;
    const reg = REG16[r];

    // SP always decrements (wrapped to 16 bits)
    dispatch.addEntry('SP', opcode,
      spDecBy(2),
      `PUSH ${reg} (SP-=2)`);

    // Value to push: for PUSH SP, it's SP-2 (post-decrement value), wrapped
    const pushVal = r === 4
      ? spDecBy(2)
      : `var(--__1${reg})`;

    // Memory write: word, lo byte at SS:SP-2, hi byte at SS:SP-1.
    // PUSH SP's value is already --lowerBytes(..., 16)-wrapped; a word
    // write would double-wrap the hi byte, so it stays two byte writes.
    if (r === 4) {
      dispatch.addMemWrite(opcode,
        stackWriteAddr(2),
        `--lowerBytes(${pushVal}, 8)`,
        `PUSH ${reg} lo`);
      dispatch.addMemWrite(opcode,
        stackWriteAddr(1),
        `--rightShift(${pushVal}, 8)`,
        `PUSH ${reg} hi`);
    } else {
      dispatch.addMemWriteWord(opcode,
        stackWriteAddr(2),
        pushVal,
        `PUSH ${reg}`);
    }

    // IP += 1
    dispatch.addEntry('IP', opcode, `calc(var(--__1IP) + 1)`, `PUSH ${reg}`);
  }
}

/**
 * POP reg16 (0x58-0x5F)
 * Read word from SS:SP, then SP += 2
 */
export function emitPOP_reg(dispatch) {
  for (let r = 0; r < 8; r++) {
    const opcode = 0x58 + r;
    const reg = REG16[r];

    // Read from stack
    dispatch.addEntry(reg, opcode,
      stackReadWord(),
      `POP ${reg}`);

    // SP += 2 (but if we're popping into SP, the popped value wins)
    if (r !== 4) {
      dispatch.addEntry('SP', opcode,
        spIncBy(2),
        `POP ${reg} (SP+=2)`);
    }

    // IP += 1
    dispatch.addEntry('IP', opcode, `calc(var(--__1IP) + 1)`, `POP ${reg}`);
  }
}

// Segment-register stack opcodes: PUSH at the listed opcode, POP one higher
// (0x06/0x07 ES, 0x0E/0x0F CS, 0x16/0x17 SS, 0x1E/0x1F DS).
const SEG_STACK = [
  { opcode: 0x06, reg: 'ES' },
  { opcode: 0x0E, reg: 'CS' },
  { opcode: 0x16, reg: 'SS' },
  { opcode: 0x1E, reg: 'DS' },
];

/**
 * PUSH segreg (0x06=ES, 0x0E=CS, 0x16=SS, 0x1E=DS)
 */
export function emitPUSH_seg(dispatch) {
  for (const { opcode, reg } of SEG_STACK) {
    dispatch.addEntry('SP', opcode,
      spDecBy(2),
      `PUSH ${reg} (SP-=2)`);
    dispatch.addMemWriteWord(opcode,
      stackWriteAddr(2),
      `var(--__1${reg})`,
      `PUSH ${reg}`);
    dispatch.addEntry('IP', opcode, `calc(var(--__1IP) + 1)`, `PUSH ${reg}`);
  }
}

/**
 * POP segreg (0x07=ES, 0x0F=CS, 0x17=SS, 0x1F=DS)
 */
export function emitPOP_seg(dispatch) {
  for (const { opcode: pushOpcode, reg } of SEG_STACK) {
    const opcode = pushOpcode + 1;
    dispatch.addEntry(reg, opcode,
      stackReadWord(),
      `POP ${reg}`);
    dispatch.addEntry('SP', opcode,
      spIncBy(2),
      `POP ${reg} (SP+=2)`);
    dispatch.addEntry('IP', opcode, `calc(var(--__1IP) + 1)`, `POP ${reg}`);
  }
}

/**
 * PUSHF (0x9C): push flags register
 */
export function emitPUSHF(dispatch) {
  dispatch.addEntry('SP', 0x9C,
    spDecBy(2),
    `PUSHF (SP-=2)`);
  dispatch.addMemWriteWord(0x9C,
    stackWriteAddr(2),
    `var(--__1flags)`,
    `PUSHF`);
  dispatch.addEntry('IP', 0x9C, `calc(var(--__1IP) + 1)`, `PUSHF`);
}

/**
 * POPF (0x9D): pop flags register (mask to valid bits + bit 1 always set)
 */
export function emitPOPF(dispatch) {
  // 0xFD5 = valid flag bits with bit 1 cleared. Then + 2 forces bit 1 on.
  dispatch.addEntry('flags', 0x9D,
    `calc(--and(var(--_stackWord0), 4053) + 2)`,
    `POPF`);
  dispatch.addEntry('SP', 0x9D,
    spIncBy(2),
    `POPF (SP+=2)`);
  dispatch.addEntry('IP', 0x9D, `calc(var(--__1IP) + 1)`, `POPF`);
}

/**
 * Register all stack opcodes.
 */
export function emitAllStack(dispatch) {
  emitPUSH_reg(dispatch);
  emitPOP_reg(dispatch);
  emitPUSH_seg(dispatch);
  emitPOP_seg(dispatch);
  emitPUSHF(dispatch);
  emitPOPF(dispatch);
}
