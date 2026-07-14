// 80186+ instructions emitted by modern DOS toolchains (Watcom, Borland).
// EDR-DOS and many real-mode programs compiled for "generic DOS" targets use
// these freely, so the transpiler has to cover them even though they're not
// 8086.
//
//   0x68  PUSH imm16
//   0x69  IMUL r16, r/m16, imm16   (signed, low 16 bits -> reg)
//   0x6A  PUSH imm8 (sign-extended to 16 bits)
//   0x6B  IMUL r16, r/m16, imm8    (signed, imm sign-extended)

import { REG16 } from './regs.mjs';
import { stackWriteAddr, spDecBy } from './stack-addr.mjs';

// Signed versions of r/m16 and the immediates. Inlined rather than added to
// decode.mjs so these helpers only pay their evaluation cost on the 4 opcodes
// that actually use them (instead of every tick).
const sRM16 = `calc(var(--rmVal16) - --bit(var(--rmVal16), 15) * 65536)`;
// immWord for IMUL imm16 (0x69): 2 bytes after ModR/M+disp, already signed-interpreted
const sImmWord = `calc(var(--immWord) - --bit(var(--immWord), 15) * 65536)`;
// immByte for IMUL imm8 (0x6B): 1 byte after ModR/M+disp, sign-extended to 16 bits
const sImmByte = `--u2s1(var(--immByte))`;

/**
 * PUSH imm16 (0x68): SP -= 2, mem[SS:SP] = imm16
 * Encoding: 68 lo hi
 */
export function emit68_PUSH_imm16(dispatch) {
  dispatch.addEntry('SP', 0x68,
    spDecBy(2),
    `PUSH imm16 (SP-=2)`);
  dispatch.addMemWrite(0x68,
    stackWriteAddr(2),
    `var(--q1)`,
    `PUSH imm16 lo`);
  dispatch.addMemWrite(0x68,
    stackWriteAddr(1),
    `var(--q2)`,
    `PUSH imm16 hi`);
  dispatch.addEntry('IP', 0x68, `calc(var(--__1IP) + 3)`, `PUSH imm16`);
}

/**
 * PUSH imm8 (0x6A): SP -= 2, mem[SS:SP] = sign_extend(imm8)
 * Encoding: 6A imm8
 */
export function emit6A_PUSH_imm8(dispatch) {
  // Sign-extended 16-bit value: if imm8 >= 0x80, high byte = 0xFF, else 0x00
  const hiByte = `calc(--bit(var(--q1), 7) * 255)`;
  dispatch.addEntry('SP', 0x6A,
    spDecBy(2),
    `PUSH imm8 sx (SP-=2)`);
  dispatch.addMemWrite(0x6A,
    stackWriteAddr(2),
    `var(--q1)`,
    `PUSH imm8 sx lo`);
  dispatch.addMemWrite(0x6A,
    stackWriteAddr(1),
    hiByte,
    `PUSH imm8 sx hi`);
  dispatch.addEntry('IP', 0x6A, `calc(var(--__1IP) + 2)`, `PUSH imm8`);
}

/**
 * IMUL r16, r/m16, imm (0x69 imm16 / 0x6B sign-extended imm8)
 * dst reg (from reg field of ModR/M) = low 16 bits of (signed r/m16 * signed imm)
 * Encoding: opcode modrm [disp] imm
 * Flags: CF=OF=1 if result doesn't fit in a signed 16-bit (full product differs
 * from sign-extended truncated product). ZF/SF/PF/AF undefined - preserve.
 * The two opcodes differ only in the immediate: sImm expression, its byte width,
 * and the "imm16"/"imm8" mnemonic tail.
 */
function emitIMUL(dispatch, opcode, sImm, immBytes, immName) {
  const prod = `calc(${sRM16} * ${sImm})`;
  const lo16 = `--lowerBytes(${prod}, 16)`;

  for (let r = 0; r < 8; r++) {
    dispatch.addEntry(REG16[r], opcode,
      `if(style(--reg: ${r}): ${lo16}; else: var(--__1${REG16[r]}))`,
      `IMUL ${REG16[r]}, r/m16, ${immName}`);
  }

  // CF=OF: prod is outside signed-16 range iff high 16 bits != sign-extension
  // of bit 15 of low 16. Same form as the Group F7 IMUL flag calc.
  // Bits 0 (CF) and 11 (OF): preserve other bits, set CF+OF = overflow bit.
  const overflow = `min(1, abs(--lowerBytes(round(down, ${prod} / 65536), 16) - --bit(${lo16}, 15) * 65535))`;
  dispatch.addEntry('flags', opcode,
    `calc(var(--__1flags) - --bit(var(--__1flags), 0) - --bit(var(--__1flags), 11) * 2048 + ${overflow} * 2049)`,
    `IMUL r/m16, ${immName} flags (CF=OF)`);

  // IP: opcode(1) + modrm(1) + modrmExtra + imm(immBytes)
  dispatch.addEntry('IP', opcode,
    `calc(var(--__1IP) + 2 + var(--modrmExtra) + ${immBytes})`,
    `IMUL r/m16, ${immName}`);
}

export function emitAll186(dispatch) {
  emit68_PUSH_imm16(dispatch);
  emit6A_PUSH_imm8(dispatch);
  emitIMUL(dispatch, 0x69, sImmWord, 2, 'imm16');
  emitIMUL(dispatch, 0x6B, sImmByte, 1, 'imm8');
}
