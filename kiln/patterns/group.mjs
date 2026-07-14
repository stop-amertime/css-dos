// Group opcode emitters: 0xFE, 0xFF, 0xF6, 0xF7, 0x80-0x83
// These use the reg field of ModR/M to select the sub-operation.

// Wrap logic flag expressions to preserve AF (bit 4) from previous tick.
// On 8086, AF is undefined for AND/OR/XOR - real hardware preserves it.
// Wrap logic flag expressions to preserve AF+TF+IF+DF from previous tick.
const pKeep = (flagExpr, mask = 1808) => `calc(${flagExpr} + --and(var(--__1flags), ${mask}))`;

import { REG16, SPLIT_REGS } from './regs.mjs';
import { stackWriteAddr as sa, spDecBy } from './stack-addr.mjs';

/**
 * Group 0xFE: byte operations on r/m8
 * reg=0: INC r/m8
 * reg=1: DEC r/m8
 */
export function emitGroup_FE(dispatch) {
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
 * reg=5: IMUL r/m16 (signed: DX:AX = AX * r/m16)
 * reg=6: DIV r/m16 (unsigned: AX = DX:AX / r/m16, DX = DX:AX % r/m16)
 * reg=7: IDIV r/m16 (signed: AX = DX:AX / r/m16, DX = DX:AX % r/m16)
 */
export function emitGroup_F7(dispatch) {
  // IMUL uses pre-computed decode properties: --_imulProd16, --_sAX, --_sRM16
  const imulProd16 = `var(--_imulProd16)`;

  dispatch.addEntry('AX', 0xF7,
    `if(` +
    `style(--reg: 6): round(down, calc((var(--__1DX) * 65536 + var(--__1AX)) / max(1, var(--rmVal16)))); ` +
    `style(--reg: 7): --lowerBytes(calc(round(to-zero, calc(var(--_sDXAX) / var(--_safeSDivisor16))) + 65536), 16); ` +
    `style(--reg: 4): --lowerBytes(calc(var(--__1AX) * var(--rmVal16)), 16); ` +
    `style(--reg: 5): --lowerBytes(${imulProd16}, 16); ` +
    `style(--reg: 3) and style(--mod: 3) and style(--rm: 0): --lowerBytes(calc(0 - var(--rmVal16) + 65536), 16); ` +
    `style(--reg: 2) and style(--mod: 3) and style(--rm: 0): --not(var(--rmVal16)); ` +
    `else: var(--__1AX))`,
    `Group F7 AX`);

  // DX: DIV/IDIV remainder, MUL/IMUL high product, NEG/NOT if rm=DX
  dispatch.addEntry('DX', 0xF7,
    `if(` +
    `style(--reg: 6): mod(calc(var(--__1DX) * 65536 + var(--__1AX)), max(1, var(--rmVal16))); ` +
    `style(--reg: 7): --lowerBytes(calc(var(--_sDXAX) - round(to-zero, calc(var(--_sDXAX) / var(--_safeSDivisor16))) * var(--_safeSDivisor16) + 65536), 16); ` +
    `style(--reg: 4): --lowerBytes(--rightShift(calc(var(--__1AX) * var(--rmVal16)), 16), 16); ` +
    `style(--reg: 5): --lowerBytes(--rightShift(${imulProd16}, 16), 16); ` +
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

  // Memory write for NEG/NOT when mod!=3 (word: lo at ea, hi at ea+1).
  // The value is a per-/reg dispatch over the un-split word; the write
  // side splits it into lo/hi bytes.
  dispatch.addMemWriteWord(0xF7,
    `if(style(--mod: 3): -1; style(--reg: 3): var(--ea); style(--reg: 2): var(--ea); else: -1)`,
    `if(style(--reg: 3): calc(0 - var(--rmVal16) + 65536); style(--reg: 2): --not(var(--rmVal16)); else: 0)`,
    `Group F7 NEG/NOT → mem`);

  // Flags: MUL/IMUL set CF+OF based on upper half; DIV/IDIV undefined
  // MUL CF=OF: DX != 0 → bit at 0 and 11
  // IMUL CF=OF: DX:AX != sign-extend(AX) → DX != (bit(AX,15)*65535)
  dispatch.addEntry('flags', 0xF7,
    `if(` +
    `style(--reg: 0): ${pKeep('--andFlags16(var(--rmVal16), var(--immWord))')}; ` +
    `style(--reg: 3): ${pKeep('--subFlags16(0, var(--rmVal16))', 1792)}; ` +
    `style(--reg: 2): var(--__1flags); ` +
    `style(--reg: 4): calc(var(--__1flags) - --bit(var(--__1flags), 0) - --bit(var(--__1flags), 11) * 2048 + min(1, --lowerBytes(--rightShift(calc(var(--__1AX) * var(--rmVal16)), 16), 16)) * 2049); ` +
    `style(--reg: 5): calc(var(--__1flags) - --bit(var(--__1flags), 0) - --bit(var(--__1flags), 11) * 2048 + min(1, abs(--lowerBytes(round(down, ${imulProd16} / 65536), 16) - --bit(--lowerBytes(${imulProd16}, 16), 15) * 65535)) * 2049); ` +
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
 * reg=5: IMUL r/m8 (signed: AX = AL * r/m8)
 * reg=6: DIV r/m8 (AL = AX / r/m8, AH = AX % r/m8)
 * reg=7: IDIV r/m8 (signed: AL = AX / r/m8, AH = AX % r/m8)
 */
export function emitGroup_F6(dispatch) {
  // IMUL byte uses pre-computed decode property: --_imulProd8
  const imulProd8 = `var(--_imulProd8)`;

  // AX gets written for MUL, IMUL, DIV, and IDIV
  dispatch.addEntry('AX', 0xF6,
    `if(` +
    `style(--reg: 6): calc(round(down, var(--__1AX) / max(1, var(--rmVal8))) + mod(var(--__1AX), max(1, var(--rmVal8))) * 256); ` +
    `style(--reg: 7): calc(--lowerBytes(calc(round(to-zero, calc(var(--_sAX) / var(--_safeSDivisor8))) + 256), 8) + --lowerBytes(calc(var(--_sAX) - round(to-zero, calc(var(--_sAX) / var(--_safeSDivisor8))) * var(--_safeSDivisor8) + 256), 8) * 256); ` +
    `style(--reg: 4): calc(var(--AL) * var(--rmVal8)); ` +
    `style(--reg: 5): --lowerBytes(${imulProd8}, 16); ` +
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

  // Flags: MUL/IMUL set CF+OF; others as before
  // MUL byte: CF=OF=1 if AH (upper byte of product) != 0
  // IMUL byte: CF=OF=1 if AH != sign-extension of AL in result
  dispatch.addEntry('flags', 0xF6,
    `if(` +
    `style(--reg: 0): ${pKeep('--andFlags8(var(--rmVal8), var(--immByte))')}; ` +
    `style(--reg: 3): ${pKeep('--subFlags8(0, var(--rmVal8))', 1792)}; ` +
    `style(--reg: 2): var(--__1flags); ` +
    `style(--reg: 4): calc(var(--__1flags) - --bit(var(--__1flags), 0) - --bit(var(--__1flags), 11) * 2048 + min(1, round(down, calc(var(--AL) * var(--rmVal8)) / 256)) * 2049); ` +
    `style(--reg: 5): calc(var(--__1flags) - --bit(var(--__1flags), 0) - --bit(var(--__1flags), 11) * 2048 + min(1, abs(--rightShift(--lowerBytes(${imulProd8}, 16), 8) - --bit(--lowerBytes(${imulProd8}, 8), 7) * 255)) * 2049); ` +
    `else: var(--__1flags))`,
    `Group F6 flags`);

  // IP: TEST has extra imm8 (1 byte)
  dispatch.addEntry('IP', 0xF6,
    `if(style(--reg: 0): calc(var(--__1IP) + 2 + var(--modrmExtra) + 1); else: calc(var(--__1IP) + 2 + var(--modrmExtra)))`,
    `Group F6`);
}

// (--incFlags8 / --decFlags8 live in kiln/patterns/flags.mjs, emitted by
// emitFlagFunctions. A stale never-called duplicate here was removed
// 2026-07-12 during the file-map reorg - it had drifted to a different AF
// computation than the live copy.)

// The immediate-form ALU group (0x80/0x82/0x81/0x83) sub-operation table.
// reg=0:ADD, 1:OR, 2:ADC, 3:SBB, 4:AND, 5:SUB, 6:XOR, 7:CMP - all read the
// r/m operand as dst and the decoded immediate as src. Only CMP is
// write-less (flags-only). `w` picks 8- vs 16-bit widths; `imm` is the src
// token (immByte / immWord / sign-extended immByte); `ovf` is the borrow
// bias added before masking (256 or 65536). Logic ops use the width-suffixed
// helper (--or8 vs --or); flag helpers are always suffixed (--addFlags8/16).
function aluSubOps(w, imm) {
  const rm = `var(--rmVal${w})`;
  const ovf = w === 8 ? 256 : 65536;
  const L = w === 8 ? '8' : '';          // logic-op helper suffix
  const F = `${w}`;                       // flag-helper suffix
  const lb = (e) => `--lowerBytes(${e}, ${w})`;
  return [
    { reg: 0, name: 'ADD', result: lb(`calc(${rm} + ${imm})`),                       flags: pKeep(`--addFlags${F}(${rm}, ${imm})`, 1792),               writes: true },
    { reg: 1, name: 'OR',  result: `--or${L}(${rm}, ${imm})`,                         flags: pKeep(`--orFlags${F}(${rm}, ${imm})`),                      writes: true },
    { reg: 2, name: 'ADC', result: lb(`calc(${rm} + ${imm} + var(--_cf))`),          flags: pKeep(`--adcFlags${F}(${rm}, ${imm}, var(--_cf))`, 1792),    writes: true },
    { reg: 3, name: 'SBB', result: lb(`calc(${rm} - ${imm} - var(--_cf) + ${ovf})`), flags: pKeep(`--sbbFlags${F}(${rm}, ${imm}, var(--_cf))`, 1792),    writes: true },
    { reg: 4, name: 'AND', result: `--and${L}(${rm}, ${imm})`,                        flags: pKeep(`--andFlags${F}(${rm}, ${imm})`),                     writes: true },
    { reg: 5, name: 'SUB', result: lb(`calc(${rm} - ${imm} + ${ovf})`),              flags: pKeep(`--subFlags${F}(${rm}, ${imm})`, 1792),               writes: true },
    { reg: 6, name: 'XOR', result: `--xor${L}(${rm}, ${imm})`,                        flags: pKeep(`--xorFlags${F}(${rm}, ${imm})`),                     writes: true },
    { reg: 7, name: 'CMP', result: null,                                              flags: pKeep(`--subFlags${F}(${rm}, ${imm})`, 1792),               writes: false },
  ];
}

// Shared emitter for the immediate-form ALU groups. The register-write and
// memory-write SHAPE depends on width: byte writes merge into a 16-bit reg
// (--mergelow/high) and take a single mem slot; word writes assign the reg
// directly and split the mem write into lo/hi slots. `label` carries the
// exact per-opcode comment text so emitted output stays byte-identical.
function emitGroupALU(dispatch, { opcode, subOps, w, immLen, label }) {
  const writing = subOps.filter(s => s.writes);

  if (w === 8) {
    for (const { reg: regName, lowIdx, highIdx } of SPLIT_REGS) {
      const branches = [];
      for (const { reg: subReg, result } of writing) {
        branches.push(`style(--mod: 3) and style(--rm: ${lowIdx}) and style(--reg: ${subReg}): --mergelow(var(--__1${regName}), ${result})`);
        branches.push(`style(--mod: 3) and style(--rm: ${highIdx}) and style(--reg: ${subReg}): --mergehigh(var(--__1${regName}), ${result})`);
      }
      dispatch.addEntry(regName, opcode,
        `if(${branches.join('; ')}; else: var(--__1${regName}))`,
        label.reg(regName));
    }

    const memBranches = writing.map(s => `style(--reg: ${s.reg}): ${s.result}`);
    dispatch.addMemWrite(opcode,
      `if(style(--mod: 3): -1; style(--reg: 7): -1; else: var(--ea))`,
      `if(${memBranches.join('; ')}; else: 0)`,
      label.mem);
  } else {
    for (let r = 0; r < 8; r++) {
      const branches = writing.map(s =>
        `style(--mod: 3) and style(--rm: ${r}) and style(--reg: ${s.reg}): ${s.result}`
      );
      dispatch.addEntry(REG16[r], opcode,
        `if(${branches.join('; ')}; else: var(--__1${REG16[r]}))`,
        label.reg(REG16[r]));
    }

    const memLoBranches = writing.map(s => `style(--reg: ${s.reg}): --lowerBytes(${s.result}, 8)`);
    dispatch.addMemWrite(opcode,
      `if(style(--mod: 3): -1; style(--reg: 7): -1; else: var(--ea))`,
      `if(${memLoBranches.join('; ')}; else: 0)`,
      label.memLo);
    const memHiBranches = writing.map(s => `style(--reg: ${s.reg}): --rightShift(${s.result}, 8)`);
    dispatch.addMemWrite(opcode,
      `if(style(--mod: 3): -1; style(--reg: 7): -1; else: calc(var(--ea) + 1))`,
      `if(${memHiBranches.join('; ')}; else: 0)`,
      label.memHi);
  }

  const flagBranches = subOps.map(s => `style(--reg: ${s.reg}): ${s.flags}`);
  dispatch.addEntry('flags', opcode,
    `if(${flagBranches.join('; ')}; else: var(--__1flags))`,
    label.flags);

  dispatch.addEntry('IP', opcode,
    `calc(var(--__1IP) + 2 + var(--modrmExtra) + ${immLen})`,
    label.ip);
}

/**
 * Group 0x80: ALU r/m8, imm8
 * Group 0x82: same as 0x80
 * reg=0:ADD, 1:OR, 2:ADC, 3:SBB, 4:AND, 5:SUB, 6:XOR, 7:CMP
 *
 * For register destinations (mod=11), each 8-bit reg maps to a 16-bit reg.
 * immByte is the immediate operand after ModR/M+disp.
 */
export function emitGroup_80(dispatch) {
  const subOps = aluSubOps(8, `var(--immByte)`);
  for (const opcode of [0x80, 0x82]) {
    const hex = opcode.toString(16);
    emitGroupALU(dispatch, {
      opcode, subOps, w: 8, immLen: 1,
      label: {
        reg: (regName) => `Group ${hex} r/m8,imm8 → ${regName}`,
        mem: `Group ${hex} r/m8,imm8 → mem`,
        flags: `Group ${hex} flags`,
        ip: `Group ${hex}`,
      },
    });
  }
}

/**
 * Group 0x81: ALU r/m16, imm16
 * reg=0:ADD, 1:OR, 2:ADC, 3:SBB, 4:AND, 5:SUB, 6:XOR, 7:CMP
 */
export function emitGroup_81(dispatch) {
  emitGroupALU(dispatch, {
    opcode: 0x81, subOps: aluSubOps(16, `var(--immWord)`), w: 16, immLen: 2,
    label: {
      reg: (regName) => `Group 81 r/m16,imm16 → ${regName}`,
      memLo: `Group 81 r/m16,imm16 → mem lo`,
      memHi: `Group 81 r/m16,imm16 → mem hi`,
      flags: `Group 81 flags`,
      ip: `Group 81`,
    },
  });
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
  emitGroupALU(dispatch, {
    opcode: 0x83, subOps: aluSubOps(16, sext), w: 16, immLen: 1,
    label: {
      reg: (regName) => `Group 83 r/m16,sximm8 → ${regName}`,
      memLo: `Group 83 → mem lo`,
      memHi: `Group 83 → mem hi`,
      flags: `Group 83 flags`,
      ip: `Group 83`,
    },
  });
}

/**
 * Group 0xFF: word operations on r/m16
 * reg=0: INC r/m16
 * reg=1: DEC r/m16
 * reg=2: CALL near indirect (IP = r/m16, push old IP)
 * reg=3: CALL FAR indirect (push CS+IP, load CS:IP from [EA])
 * reg=4: JMP near indirect (IP = r/m16)
 * reg=5: JMP FAR indirect (load CS:IP from [EA])
 * reg=6: PUSH r/m16
 */
export function emitGroup_FF(dispatch) {
  // Registers that can be INC/DEC targets (mod=11):
  // All 8 regs. But SP also affected by CALL (push) and PUSH.
  // Handle SP separately from others.

  for (let r = 0; r < 8; r++) {
    if (r === 4) continue; // SP handled separately
    const regName = REG16[r];
    dispatch.addEntry(regName, 0xFF,
      `if(` +
      `style(--reg: 0) and style(--mod: 3) and style(--rm: ${r}): --lowerBytes(calc(var(--rmVal16) + 1), 16); ` +
      `style(--reg: 1) and style(--mod: 3) and style(--rm: ${r}): --lowerBytes(calc(var(--rmVal16) - 1 + 65536), 16); ` +
      `else: var(--__1${regName}))`,
      `Group FF INC/DEC → ${regName}`);
  }

  // SP: INC SP (reg=0,mod=3,rm=4), DEC SP (reg=1,mod=3,rm=4),
  //     CALL near indirect (reg=2, SP-=2), CALL FAR indirect (reg=3, SP-=4),
  //     PUSH r/m (reg=6, SP-=2)
  dispatch.addEntry('SP', 0xFF,
    `if(` +
    `style(--reg: 0) and style(--mod: 3) and style(--rm: 4): --lowerBytes(calc(var(--rmVal16) + 1), 16); ` +
    `style(--reg: 1) and style(--mod: 3) and style(--rm: 4): --lowerBytes(calc(var(--rmVal16) - 1 + 65536), 16); ` +
    `style(--reg: 2): ${spDecBy(2)}; ` +
    `style(--reg: 3): ${spDecBy(4)}; ` +
    `style(--reg: 6): ${spDecBy(2)}; ` +
    `else: var(--__1SP))`,
    `Group FF SP`);

  // CS: only CALL FAR indirect (reg=3) and JMP FAR indirect (reg=5) change CS.
  // New CS = word at [EA+2] = read2(ea+2)
  dispatch.addEntry('CS', 0xFF,
    `if(` +
    `style(--reg: 3): --read2(calc(var(--ea) + 2)); ` +
    `style(--reg: 5): --read2(calc(var(--ea) + 2)); ` +
    `else: var(--__1CS))`,
    `Group FF CS`);

  // Memory writes:
  // INC/DEC to memory (mod!=3): write result back (slots 0-1)
  // CALL near indirect (reg=2): push return address (slots 0-1)
  // CALL FAR indirect (reg=3): push CS (slots 0-1), push return IP (slots 2-3)
  // PUSH (reg=6): push the r/m value (slots 0-1)

  const retIP = `calc(var(--__1IP) + var(--prefixLen) + 2 + var(--modrmExtra))`;
  // sa(k) wraps SP-K to 16 bits (see stack-addr.mjs). Critical when
  // reg=2/3/6 (CALL/PUSH variants) pushes onto a fresh stack with SP=0,
  // e.g. EDR-DOS exec'ing an .EXE whose header sets SP=0x0000 (DOOM8088
  // hits this).

  // Slot 0 (word): INC/DEC mem, CALL near push ret, CALL FAR push CS,
  // PUSH push value. Address is a per-/reg dispatch; the un-split word
  // value dispatches on the same /reg and the write side splits lo/hi.
  dispatch.addMemWriteWord(0xFF,
    `if(` +
    `style(--mod: 3) and style(--reg: 0): -1; ` +
    `style(--mod: 3) and style(--reg: 1): -1; ` +
    `style(--reg: 0): var(--ea); ` +
    `style(--reg: 1): var(--ea); ` +
    `style(--reg: 2): ${sa(2)}; ` +
    `style(--reg: 3): ${sa(2)}; ` +
    `style(--reg: 6): ${sa(2)}; ` +
    `else: -1)`,
    `if(` +
    `style(--reg: 0): calc(var(--rmVal16) + 1); ` +
    `style(--reg: 1): calc(var(--rmVal16) - 1 + 65536); ` +
    `style(--reg: 2): ${retIP}; ` +
    `style(--reg: 3): var(--__1CS); ` +
    `style(--reg: 6): var(--rmVal16); ` +
    `else: 0)`,
    `Group FF mem/push`);

  // Slot 1 (word): CALL FAR indirect push return IP (only reg=3 uses it).
  dispatch.addMemWriteWord(0xFF,
    `if(style(--reg: 3): ${sa(4)}; else: -1)`,
    `if(style(--reg: 3): ${retIP}; else: 0)`,
    `Group FF CALL FAR push IP`);

  // Flags: INC/DEC set flags (preserving CF), others don't
  dispatch.addEntry('flags', 0xFF,
    `if(` +
    `style(--reg: 0): --incFlags16(var(--rmVal16), --lowerBytes(calc(var(--rmVal16) + 1), 16), var(--__1flags)); ` +
    `style(--reg: 1): --decFlags16(var(--rmVal16), --lowerBytes(calc(var(--rmVal16) - 1 + 65536), 16), var(--__1flags)); ` +
    `else: var(--__1flags))`,
    `Group FF flags`);

  // IP: CALL near/JMP near use rmVal16, CALL FAR/JMP FAR also use rmVal16.
  // rmVal16 is an absolute address - subtract prefixLen to cancel the
  // automatic calc(... + prefixLen) wrapper that emitRegisterDispatch adds.
  dispatch.addEntry('IP', 0xFF,
    `if(` +
    `style(--reg: 2): calc(var(--rmVal16) - var(--prefixLen)); ` +
    `style(--reg: 3): calc(var(--rmVal16) - var(--prefixLen)); ` +
    `style(--reg: 4): calc(var(--rmVal16) - var(--prefixLen)); ` +
    `style(--reg: 5): calc(var(--rmVal16) - var(--prefixLen)); ` +
    `else: calc(var(--__1IP) + 2 + var(--modrmExtra)))`,
    `Group FF IP`);
}

export function emitAllGroups(dispatch) {
  emitGroup_FE(dispatch);
  emitGroup_F7(dispatch);
  emitGroup_F6(dispatch);
  emitGroup_80(dispatch);
  emitGroup_81(dispatch);
  emitGroup_83(dispatch);
  emitGroup_FF(dispatch);
}
