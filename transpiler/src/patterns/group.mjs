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
/**
 * Group 0x80: ALU r/m8, imm8
 * Group 0x82: same as 0x80
 * reg=0:ADD, 1:OR, 2:ADC, 3:SBB, 4:AND, 5:SUB, 6:XOR, 7:CMP
 *
 * For register destinations (mod=11), each 8-bit reg maps to a 16-bit reg.
 * immByte is the immediate operand after ModR/M+disp.
 */
export function emitGroup_80(dispatch) {
  // Result expressions for each sub-operation (8-bit)
  // All read rmVal8 as dst, immByte as src
  const subOps = [
    { reg: 0, name: 'ADD', result: `--lowerBytes(calc(var(--rmVal8) + var(--immByte)), 8)`, flags: `--addFlags8(var(--rmVal8), var(--immByte))`, writes: true },
    { reg: 1, name: 'OR',  result: `--or8(var(--rmVal8), var(--immByte))`, flags: `--orFlags8(var(--rmVal8), var(--immByte))`, writes: true },
    { reg: 2, name: 'ADC', result: `--lowerBytes(calc(var(--rmVal8) + var(--immByte) + var(--_cf)), 8)`, flags: `--adcFlags8(var(--rmVal8), var(--immByte), var(--_cf))`, writes: true },
    { reg: 3, name: 'SBB', result: `--lowerBytes(calc(var(--rmVal8) - var(--immByte) - var(--_cf) + 256), 8)`, flags: `--sbbFlags8(var(--rmVal8), var(--immByte), var(--_cf))`, writes: true },
    { reg: 4, name: 'AND', result: `--and8(var(--rmVal8), var(--immByte))`, flags: `--andFlags8(var(--rmVal8), var(--immByte))`, writes: true },
    { reg: 5, name: 'SUB', result: `--lowerBytes(calc(var(--rmVal8) - var(--immByte) + 256), 8)`, flags: `--subFlags8(var(--rmVal8), var(--immByte))`, writes: true },
    { reg: 6, name: 'XOR', result: `--xor8(var(--rmVal8), var(--immByte))`, flags: `--xorFlags8(var(--rmVal8), var(--immByte))`, writes: true },
    { reg: 7, name: 'CMP', result: null, flags: `--subFlags8(var(--rmVal8), var(--immByte))`, writes: false },
  ];

  // For opcodes 0x80 and 0x82 (same behavior)
  for (const opcode of [0x80, 0x82]) {
    // Register writes: each 16-bit register can be destination when mod=11
    for (const { reg: regName, lowIdx, highIdx } of SPLIT_REGS) {
      const branches = [];
      for (const { reg: subReg, result, writes } of subOps) {
        if (!writes) continue;
        branches.push(`style(--mod: 3) and style(--rm: ${lowIdx}) and style(--reg: ${subReg}): --mergelow(var(--__1${regName}), ${result})`);
        branches.push(`style(--mod: 3) and style(--rm: ${highIdx}) and style(--reg: ${subReg}): --mergehigh(var(--__1${regName}), ${result})`);
      }
      dispatch.addEntry(regName, opcode,
        `if(${branches.join('; ')}; else: var(--__1${regName}))`,
        `Group ${opcode.toString(16)} r/m8,imm8 → ${regName}`);
    }

    // Memory write for non-CMP sub-ops when mod!=3
    const memBranches = subOps.filter(s => s.writes).map(s =>
      `style(--reg: ${s.reg}): ${s.result}`
    );
    dispatch.addMemWrite(opcode,
      `if(style(--mod: 3): -1; style(--reg: 7): -1; else: var(--ea))`,
      `if(${memBranches.join('; ')}; else: 0)`,
      `Group ${opcode.toString(16)} r/m8,imm8 → mem`);

    // Flags: all sub-ops set flags
    const flagBranches = subOps.map(s =>
      `style(--reg: ${s.reg}): ${s.flags}`
    );
    dispatch.addEntry('flags', opcode,
      `if(${flagBranches.join('; ')}; else: var(--__1flags))`,
      `Group ${opcode.toString(16)} flags`);

    // IP: 2 + modrmExtra + 1 (for the immediate byte)
    dispatch.addEntry('IP', opcode,
      `calc(var(--__1IP) + 2 + var(--modrmExtra) + 1)`,
      `Group ${opcode.toString(16)}`);
  }
}

/**
 * Group 0x81: ALU r/m16, imm16
 * reg=0:ADD, 1:OR, 2:ADC, 3:SBB, 4:AND, 5:SUB, 6:XOR, 7:CMP
 */
export function emitGroup_81(dispatch) {
  const subOps = [
    { reg: 0, name: 'ADD', result: `--lowerBytes(calc(var(--rmVal16) + var(--immWord)), 16)`, flags: `--addFlags16(var(--rmVal16), var(--immWord))`, writes: true },
    { reg: 1, name: 'OR',  result: `--or(var(--rmVal16), var(--immWord))`, flags: `--orFlags16(var(--rmVal16), var(--immWord))`, writes: true },
    { reg: 2, name: 'ADC', result: `--lowerBytes(calc(var(--rmVal16) + var(--immWord) + var(--_cf)), 16)`, flags: `--adcFlags16(var(--rmVal16), var(--immWord), var(--_cf))`, writes: true },
    { reg: 3, name: 'SBB', result: `--lowerBytes(calc(var(--rmVal16) - var(--immWord) - var(--_cf) + 65536), 16)`, flags: `--sbbFlags16(var(--rmVal16), var(--immWord), var(--_cf))`, writes: true },
    { reg: 4, name: 'AND', result: `--and(var(--rmVal16), var(--immWord))`, flags: `--andFlags16(var(--rmVal16), var(--immWord))`, writes: true },
    { reg: 5, name: 'SUB', result: `--lowerBytes(calc(var(--rmVal16) - var(--immWord) + 65536), 16)`, flags: `--subFlags16(var(--rmVal16), var(--immWord))`, writes: true },
    { reg: 6, name: 'XOR', result: `--xor(var(--rmVal16), var(--immWord))`, flags: `--xorFlags16(var(--rmVal16), var(--immWord))`, writes: true },
    { reg: 7, name: 'CMP', result: null, flags: `--subFlags16(var(--rmVal16), var(--immWord))`, writes: false },
  ];

  for (let r = 0; r < 8; r++) {
    const branches = subOps.filter(s => s.writes).map(s =>
      `style(--mod: 3) and style(--rm: ${r}) and style(--reg: ${s.reg}): ${s.result}`
    );
    dispatch.addEntry(REG16[r], 0x81,
      `if(${branches.join('; ')}; else: var(--__1${REG16[r]}))`,
      `Group 81 r/m16,imm16 → ${REG16[r]}`);
  }

  // Memory writes (word)
  const memLoBranches = subOps.filter(s => s.writes).map(s =>
    `style(--reg: ${s.reg}): --lowerBytes(${s.result}, 8)`
  );
  dispatch.addMemWrite(0x81,
    `if(style(--mod: 3): -1; style(--reg: 7): -1; else: var(--ea))`,
    `if(${memLoBranches.join('; ')}; else: 0)`,
    `Group 81 r/m16,imm16 → mem lo`);
  const memHiBranches = subOps.filter(s => s.writes).map(s =>
    `style(--reg: ${s.reg}): --rightShift(${s.result}, 8)`
  );
  dispatch.addMemWrite(0x81,
    `if(style(--mod: 3): -1; style(--reg: 7): -1; else: calc(var(--ea) + 1))`,
    `if(${memHiBranches.join('; ')}; else: 0)`,
    `Group 81 r/m16,imm16 → mem hi`);

  const flagBranches = subOps.map(s =>
    `style(--reg: ${s.reg}): ${s.flags}`
  );
  dispatch.addEntry('flags', 0x81,
    `if(${flagBranches.join('; ')}; else: var(--__1flags))`,
    `Group 81 flags`);

  dispatch.addEntry('IP', 0x81,
    `calc(var(--__1IP) + 2 + var(--modrmExtra) + 2)`,
    `Group 81`);
}

/**
 * Group 0x83: ALU r/m16, sign-extended imm8
 * Same sub-operations as 0x81 but immediate is sign-extended from 8 to 16 bits.
 */
export function emitGroup_83(dispatch) {
  // immByte sign-extended to 16 bits: --u2s1(var(--immByte)) gives signed value
  // But we need unsigned 16-bit for the operation: (immByte >= 128) ? immByte | 0xFF00 : immByte
  // In CSS: immByte + bit(immByte, 7) * 65280
  const sext = `calc(var(--immByte) + --bit(var(--immByte), 7) * 65280)`;

  const subOps = [
    { reg: 0, name: 'ADD', result: `--lowerBytes(calc(var(--rmVal16) + ${sext}), 16)`, flags: `--addFlags16(var(--rmVal16), ${sext})`, writes: true },
    { reg: 1, name: 'OR',  result: `--or(var(--rmVal16), ${sext})`, flags: `--orFlags16(var(--rmVal16), ${sext})`, writes: true },
    { reg: 2, name: 'ADC', result: `--lowerBytes(calc(var(--rmVal16) + ${sext} + var(--_cf)), 16)`, flags: `--adcFlags16(var(--rmVal16), ${sext}, var(--_cf))`, writes: true },
    { reg: 3, name: 'SBB', result: `--lowerBytes(calc(var(--rmVal16) - ${sext} - var(--_cf) + 65536), 16)`, flags: `--sbbFlags16(var(--rmVal16), ${sext}, var(--_cf))`, writes: true },
    { reg: 4, name: 'AND', result: `--and(var(--rmVal16), ${sext})`, flags: `--andFlags16(var(--rmVal16), ${sext})`, writes: true },
    { reg: 5, name: 'SUB', result: `--lowerBytes(calc(var(--rmVal16) - ${sext} + 65536), 16)`, flags: `--subFlags16(var(--rmVal16), ${sext})`, writes: true },
    { reg: 6, name: 'XOR', result: `--xor(var(--rmVal16), ${sext})`, flags: `--xorFlags16(var(--rmVal16), ${sext})`, writes: true },
    { reg: 7, name: 'CMP', result: null, flags: `--subFlags16(var(--rmVal16), ${sext})`, writes: false },
  ];

  for (let r = 0; r < 8; r++) {
    const branches = subOps.filter(s => s.writes).map(s =>
      `style(--mod: 3) and style(--rm: ${r}) and style(--reg: ${s.reg}): ${s.result}`
    );
    dispatch.addEntry(REG16[r], 0x83,
      `if(${branches.join('; ')}; else: var(--__1${REG16[r]}))`,
      `Group 83 r/m16,sximm8 → ${REG16[r]}`);
  }

  // Memory writes
  const memLoBranches = subOps.filter(s => s.writes).map(s =>
    `style(--reg: ${s.reg}): --lowerBytes(${s.result}, 8)`
  );
  dispatch.addMemWrite(0x83,
    `if(style(--mod: 3): -1; style(--reg: 7): -1; else: var(--ea))`,
    `if(${memLoBranches.join('; ')}; else: 0)`,
    `Group 83 → mem lo`);
  const memHiBranches = subOps.filter(s => s.writes).map(s =>
    `style(--reg: ${s.reg}): --rightShift(${s.result}, 8)`
  );
  dispatch.addMemWrite(0x83,
    `if(style(--mod: 3): -1; style(--reg: 7): -1; else: calc(var(--ea) + 1))`,
    `if(${memHiBranches.join('; ')}; else: 0)`,
    `Group 83 → mem hi`);

  const flagBranches = subOps.map(s =>
    `style(--reg: ${s.reg}): ${s.flags}`
  );
  dispatch.addEntry('flags', 0x83,
    `if(${flagBranches.join('; ')}; else: var(--__1flags))`,
    `Group 83 flags`);

  dispatch.addEntry('IP', 0x83,
    `calc(var(--__1IP) + 2 + var(--modrmExtra) + 1)`,
    `Group 83`);
}

export function emitAllGroups(dispatch) {
  emitGroup_FE(dispatch);
  emitGroup_F7(dispatch);
  emitGroup_F6(dispatch);
  emitGroup_80(dispatch);
  emitGroup_81(dispatch);
  emitGroup_83(dispatch);
}
