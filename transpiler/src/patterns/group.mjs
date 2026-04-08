// Group opcode emitters: 0xFE, 0xFF, 0xF6, 0xF7, 0x80-0x83
// These use the reg field of ModR/M to select the sub-operation.

const REG16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
const SPLIT_REGS = [
  { reg: 'AX', lowIdx: 0, highIdx: 4 },
  { reg: 'CX', lowIdx: 1, highIdx: 5 },
  { reg: 'DX', lowIdx: 2, highIdx: 6 },
  { reg: 'BX', lowIdx: 3, highIdx: 7 },
];

/**
 * Group 0xFE: byte operations on r/m8
 * reg=0: INC r/m8
 * reg=1: DEC r/m8
 */
export function emitGroup_FE(dispatch) {
  // Both INC and DEC write to r/m8, which is either a register or memory.
  // The result depends on reg field:
  //   reg=0: rm + 1 (INC)
  //   reg=1: rm - 1 (DEC)
  // For register destinations (mod=11):
  for (const { reg: regName, lowIdx, highIdx } of SPLIT_REGS) {
    dispatch.addEntry(regName, 0xFE,
      `if(` +
      `style(--mod: 3) and style(--rm: ${lowIdx}) and style(--reg: 0): --mergelow(var(--__1${regName}), --lowerBytes(calc(var(--rmVal8) + 1), 8)); ` +
      `style(--mod: 3) and style(--rm: ${lowIdx}) and style(--reg: 1): --mergelow(var(--__1${regName}), --lowerBytes(calc(var(--rmVal8) - 1 + 256), 8)); ` +
      `style(--mod: 3) and style(--rm: ${highIdx}) and style(--reg: 0): --mergehigh(var(--__1${regName}), --lowerBytes(calc(var(--rmVal8) + 1), 8)); ` +
      `style(--mod: 3) and style(--rm: ${highIdx}) and style(--reg: 1): --mergehigh(var(--__1${regName}), --lowerBytes(calc(var(--rmVal8) - 1 + 256), 8)); ` +
      `else: var(--__1${regName}))`,
      `Group FE INC/DEC r/m8 → ${regName}`);
  }

  // Memory write: if mod!=3
  dispatch.addMemWrite(0xFE,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `if(style(--reg: 0): --lowerBytes(calc(var(--rmVal8) + 1), 8); else: --lowerBytes(calc(var(--rmVal8) - 1 + 256), 8))`,
    `Group FE INC/DEC r/m8 → mem`);

  // Flags: INC preserves CF, DEC preserves CF
  dispatch.addEntry('flags', 0xFE,
    `if(style(--reg: 0): --incFlags8(var(--rmVal8), --lowerBytes(calc(var(--rmVal8) + 1), 8), var(--__1flags)); ` +
    `else: --decFlags8(var(--rmVal8), --lowerBytes(calc(var(--rmVal8) - 1 + 256), 8), var(--__1flags)))`,
    `Group FE flags`);

  dispatch.addEntry('IP', 0xFE, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `Group FE`);
}

/**
 * Group 0xF7: word operations on r/m16
 * reg=0: TEST r/m16, imm16
 * reg=2: NOT r/m16
 * reg=3: NEG r/m16
 * reg=4: MUL r/m16 (unsigned: DX:AX = AX * r/m16)
 * reg=6: DIV r/m16 (unsigned: AX = DX:AX / r/m16, DX = DX:AX % r/m16)
 *
 * For fib.asm we need DIV (reg=6).
 */
export function emitGroup_F7(dispatch) {
  // This is complex because different sub-ops write different registers.
  // DIV (reg=6): AX = quotient, DX = remainder
  // MUL (reg=4): DX:AX = AX * src
  // NEG (reg=3): r/m = 0 - r/m, sets flags
  // NOT (reg=2): r/m = ~r/m, no flag change
  // TEST (reg=0): r/m & imm16, flags only

  // AX: DIV writes quotient, MUL writes low product, NEG/NOT may write if rm=0
  dispatch.addEntry('AX', 0xF7,
    `if(` +
    `style(--reg: 6): round(down, calc((var(--__1DX) * 65536 + var(--__1AX)) / max(1, var(--rmVal16)))); ` +
    `style(--reg: 4): --lowerBytes(calc(var(--__1AX) * var(--rmVal16)), 16); ` +
    `style(--reg: 3) and style(--mod: 3) and style(--rm: 0): --lowerBytes(calc(0 - var(--rmVal16) + 65536), 16); ` +
    `style(--reg: 2) and style(--mod: 3) and style(--rm: 0): --not(var(--rmVal16)); ` +
    `else: var(--__1AX))`,
    `Group F7 AX`);

  // DX: DIV writes remainder, MUL writes high product
  dispatch.addEntry('DX', 0xF7,
    `if(` +
    `style(--reg: 6): mod(calc(var(--__1DX) * 65536 + var(--__1AX)), max(1, var(--rmVal16))); ` +
    `style(--reg: 4): --lowerBytes(--rightShift(calc(var(--__1AX) * var(--rmVal16)), 16), 16); ` +
    `style(--reg: 3) and style(--mod: 3) and style(--rm: 2): --lowerBytes(calc(0 - var(--rmVal16) + 65536), 16); ` +
    `style(--reg: 2) and style(--mod: 3) and style(--rm: 2): --not(var(--rmVal16)); ` +
    `else: var(--__1DX))`,
    `Group F7 DX`);

  // Other registers: NEG/NOT when mod=11 and rm selects that register
  for (let r = 0; r < 8; r++) {
    if (r === 0 || r === 2) continue; // AX and DX handled above
    const regName = REG16[r];
    dispatch.addEntry(regName, 0xF7,
      `if(` +
      `style(--reg: 3) and style(--mod: 3) and style(--rm: ${r}): --lowerBytes(calc(0 - var(--rmVal16) + 65536), 16); ` +
      `style(--reg: 2) and style(--mod: 3) and style(--rm: ${r}): --not(var(--rmVal16)); ` +
      `else: var(--__1${regName}))`,
      `Group F7 ${regName}`);
  }

  // Memory writes for NEG/NOT when mod!=3
  dispatch.addMemWrite(0xF7,
    `if(style(--mod: 3): -1; style(--reg: 3): var(--ea); style(--reg: 2): var(--ea); else: -1)`,
    `if(style(--reg: 3): --lowerBytes(calc(0 - var(--rmVal16) + 65536), 8); style(--reg: 2): --lowerBytes(--not(var(--rmVal16)), 8); else: 0)`,
    `Group F7 NEG/NOT → mem lo`);
  dispatch.addMemWrite(0xF7,
    `if(style(--mod: 3): -1; style(--reg: 3): calc(var(--ea) + 1); style(--reg: 2): calc(var(--ea) + 1); else: -1)`,
    `if(style(--reg: 3): --rightShift(--lowerBytes(calc(0 - var(--rmVal16) + 65536), 16), 8); style(--reg: 2): --rightShift(--not(var(--rmVal16)), 8); else: 0)`,
    `Group F7 NEG/NOT → mem hi`);

  // Flags
  dispatch.addEntry('flags', 0xF7,
    `if(` +
    `style(--reg: 0): --andFlags16(var(--rmVal16), var(--immWord)); ` +
    `style(--reg: 3): --subFlags16(0, var(--rmVal16)); ` +
    `style(--reg: 2): var(--__1flags); ` +
    `else: var(--__1flags))`,
    `Group F7 flags`);

  // IP: TEST has extra imm16 (2 bytes), others don't
  dispatch.addEntry('IP', 0xF7,
    `if(style(--reg: 0): calc(var(--__1IP) + 2 + var(--modrmExtra) + 2); else: calc(var(--__1IP) + 2 + var(--modrmExtra)))`,
    `Group F7`);
}

/**
 * Group 0xF6: byte operations on r/m8
 * reg=0: TEST r/m8, imm8
 * reg=2: NOT r/m8
 * reg=3: NEG r/m8
 * reg=4: MUL r/m8 (AX = AL * r/m8)
 * reg=6: DIV r/m8 (AL = AX / r/m8, AH = AX % r/m8)
 */
export function emitGroup_F6(dispatch) {
  // AX gets written for MUL and DIV
  dispatch.addEntry('AX', 0xF6,
    `if(` +
    `style(--reg: 6): calc(round(down, var(--__1AX) / max(1, var(--rmVal8))) + mod(var(--__1AX), max(1, var(--rmVal8))) * 256); ` +
    `style(--reg: 4): calc(var(--AL) * var(--rmVal8)); ` +
    // NEG/NOT on AL (rm=0, mod=11)
    `style(--reg: 3) and style(--mod: 3) and style(--rm: 0): --mergelow(var(--__1AX), --lowerBytes(calc(0 - var(--rmVal8) + 256), 8)); ` +
    `style(--reg: 2) and style(--mod: 3) and style(--rm: 0): --mergelow(var(--__1AX), --lowerBytes(--not(var(--rmVal8)), 8)); ` +
    // NEG/NOT on AH (rm=4, mod=11)
    `style(--reg: 3) and style(--mod: 3) and style(--rm: 4): --mergehigh(var(--__1AX), --lowerBytes(calc(0 - var(--rmVal8) + 256), 8)); ` +
    `style(--reg: 2) and style(--mod: 3) and style(--rm: 4): --mergehigh(var(--__1AX), --lowerBytes(--not(var(--rmVal8)), 8)); ` +
    `else: var(--__1AX))`,
    `Group F6 AX`);

  // Other split regs for NEG/NOT r/m8 (mod=11)
  for (const { reg: regName, lowIdx, highIdx } of SPLIT_REGS) {
    if (regName === 'AX') continue;
    dispatch.addEntry(regName, 0xF6,
      `if(` +
      `style(--reg: 3) and style(--mod: 3) and style(--rm: ${lowIdx}): --mergelow(var(--__1${regName}), --lowerBytes(calc(0 - var(--rmVal8) + 256), 8)); ` +
      `style(--reg: 2) and style(--mod: 3) and style(--rm: ${lowIdx}): --mergelow(var(--__1${regName}), --lowerBytes(--not(var(--rmVal8)), 8)); ` +
      `style(--reg: 3) and style(--mod: 3) and style(--rm: ${highIdx}): --mergehigh(var(--__1${regName}), --lowerBytes(calc(0 - var(--rmVal8) + 256), 8)); ` +
      `style(--reg: 2) and style(--mod: 3) and style(--rm: ${highIdx}): --mergehigh(var(--__1${regName}), --lowerBytes(--not(var(--rmVal8)), 8)); ` +
      `else: var(--__1${regName}))`,
      `Group F6 ${regName}`);
  }

  // Memory writes for NEG/NOT when mod!=3
  dispatch.addMemWrite(0xF6,
    `if(style(--mod: 3): -1; style(--reg: 3): var(--ea); style(--reg: 2): var(--ea); else: -1)`,
    `if(style(--reg: 3): --lowerBytes(calc(0 - var(--rmVal8) + 256), 8); style(--reg: 2): --lowerBytes(--not(var(--rmVal8)), 8); else: 0)`,
    `Group F6 NEG/NOT → mem`);

  // Flags
  dispatch.addEntry('flags', 0xF6,
    `if(` +
    `style(--reg: 0): --andFlags8(var(--rmVal8), var(--immByte)); ` +
    `style(--reg: 3): --subFlags8(0, var(--rmVal8)); ` +
    `style(--reg: 2): var(--__1flags); ` +
    `else: var(--__1flags))`,
    `Group F6 flags`);

  // IP: TEST has extra imm8 (1 byte)
  dispatch.addEntry('IP', 0xF6,
    `if(style(--reg: 0): calc(var(--__1IP) + 2 + var(--modrmExtra) + 1); else: calc(var(--__1IP) + 2 + var(--modrmExtra)))`,
    `Group F6`);
}

/**
 * Add 8-bit INC/DEC flag functions to flags.mjs output
 */
export function emitIncDecFlags8() {
  return `
@function --incFlags8(--dst <integer>, --res <integer>, --oldFlags <integer>) returns <integer> {
  --cf: --bit(var(--oldFlags), 0);
  --pf: --parity(var(--res));
  --_xor_rd: --xor(var(--res), var(--dst));
  --_xor_rd1: --xor(var(--_xor_rd), 1);
  --af: calc(--bit(var(--_xor_rd1), 4) * 16);
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 7) * 128);
  --of: if(style(--res: 128): 2048; else: 0);
  result: calc(var(--cf) + var(--pf) + var(--af) + var(--zf) + var(--sf) + var(--of) + 2);
}

@function --decFlags8(--dst <integer>, --res <integer>, --oldFlags <integer>) returns <integer> {
  --cf: --bit(var(--oldFlags), 0);
  --pf: --parity(var(--res));
  --_xor_rd: --xor(var(--res), var(--dst));
  --_xor_rd1: --xor(var(--_xor_rd), 1);
  --af: calc(--bit(var(--_xor_rd1), 4) * 16);
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 7) * 128);
  --of: if(style(--res: 127): 2048; else: 0);
  result: calc(var(--cf) + var(--pf) + var(--af) + var(--zf) + var(--sf) + var(--of) + 2);
}
`;
}

/**
 * Register all group opcodes.
 */
export function emitAllGroups(dispatch) {
  emitGroup_FE(dispatch);
  emitGroup_F7(dispatch);
  emitGroup_F6(dispatch);
}
