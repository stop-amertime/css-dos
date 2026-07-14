// MOV instruction emitters.
// Covers: MOV reg,imm (0xB0-0xBF), MOV r/m,reg (0x88-0x8B), MOV r/m,imm (0xC6-0xC7)

import { REG16, SPLIT_REGS } from './regs.mjs';

/**
 * Register entries for MOV reg16, imm16 (opcodes 0xB8-0xBF).
 * B8+r: MOV AX/CX/DX/BX/SP/BP/SI/DI, imm16
 * Instruction is 3 bytes: opcode + imm16
 */
export function emitMOV_RegImm16(dispatch) {
  for (let i = 0; i < 8; i++) {
    const opcode = 0xB8 + i;
    const reg = REG16[i];
    // imm16 is at q1:q2 (bytes 1-2 after opcode)
    dispatch.addEntry(reg, opcode, `calc(var(--q1) + var(--q2) * 256)`,
      `MOV ${reg}, imm16`);
    // IP advances by 3
    dispatch.addEntry('IP', opcode, `calc(var(--__1IP) + 3)`,
      `MOV ${reg}, imm16`);
  }
}

/**
 * Register entries for MOV reg8, imm8 (opcodes 0xB0-0xB7).
 * B0+r: MOV AL/CL/DL/BL/AH/CH/DH/BH, imm8
 * Instruction is 2 bytes: opcode + imm8
 */
export function emitMOV_RegImm8(dispatch) {
  // 8-bit registers: 0=AL, 1=CL, 2=DL, 3=BL, 4=AH, 5=CH, 6=DH, 7=BH.
  // rm 0-3 are the low bytes, 4-7 the high bytes of SPLIT_REGS' AX/CX/DX/BX;
  // the 8-bit name is the reg's first letter + L (low) / H (high).
  for (let i = 0; i < 8; i++) {
    const opcode = 0xB0 + i;
    const merge = i < 4 ? 'low' : 'high';
    const reg = SPLIT_REGS[i % 4].reg;
    const name = reg[0] + (merge === 'low' ? 'L' : 'H');
    // imm8 is at q1
    if (merge === 'low') {
      dispatch.addEntry(reg, opcode, `--mergelow(var(--__1${reg}), var(--q1))`,
        `MOV ${name}, imm8`);
    } else {
      dispatch.addEntry(reg, opcode, `--mergehigh(var(--__1${reg}), var(--q1))`,
        `MOV ${name}, imm8`);
    }
    // IP advances by 2
    dispatch.addEntry('IP', opcode, `calc(var(--__1IP) + 2)`, `MOV ${name}, imm8`);
  }
}

/**
 * MOV r/m, reg and MOV reg, r/m (opcodes 0x88-0x8B).
 * These use ModR/M addressing. The d bit selects direction.
 *
 * For register-to-register MOV (mod=11), we need dispatch entries
 * for each possible destination register. Since the destination depends
 * on the rm/reg field (runtime), we use per-register checks.
 */
export function emitMOV_RegRM(dispatch) {
  // 0x88: MOV r/m8, reg8  (d=0, w=0)
  // 0x89: MOV r/m16, reg16 (d=0, w=1) -- reg → r/m
  // 0x8A: MOV reg8, r/m8  (d=1, w=0)
  // 0x8B: MOV reg16, r/m16 (d=1, w=1) -- r/m → reg

  // 0x8B: MOV reg16, r/m16 - reg field selects destination register
  for (let r = 0; r < 8; r++) {
    dispatch.addEntry(REG16[r], 0x8B,
      `if(style(--reg: ${r}): var(--rmVal16); else: var(--__1${REG16[r]}))`,
      `MOV ${REG16[r]}, r/m16 (if reg=${r})`);
  }
  // IP: 2 + modrmExtra
  dispatch.addEntry('IP', 0x8B, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `MOV reg16, r/m16`);

  // 0x8A: MOV reg8, r/m8 - reg field selects destination 8-bit register
  // Each 16-bit register (AX,BX,CX,DX) can be written by two 8-bit regs (low+high),
  // so we combine them into a single dispatch entry per 16-bit register.
  //   reg=0→AL(AX low), reg=1→CL(CX low), reg=2→DL(DX low), reg=3→BL(BX low)
  //   reg=4→AH(AX high), reg=5→CH(CX high), reg=6→DH(DX high), reg=7→BH(BX high)
  for (const { reg, lowIdx, highIdx } of SPLIT_REGS) {
    dispatch.addEntry(reg, 0x8A,
      `if(style(--reg: ${lowIdx}): --mergelow(var(--__1${reg}), var(--rmVal8)); ` +
      `style(--reg: ${highIdx}): --mergehigh(var(--__1${reg}), var(--rmVal8)); ` +
      `else: var(--__1${reg}))`,
      `MOV ${reg}(lo/hi), r/m8`);
  }
  dispatch.addEntry('IP', 0x8A, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `MOV reg8, r/m8`);

  // 0x89: MOV r/m16, reg16 (d=0) - destination is r/m
  // If mod=11, r/m is a register. If mod!=11, it's a memory write.
  for (let r = 0; r < 8; r++) {
    dispatch.addEntry(REG16[r], 0x89,
      `if(style(--mod: 3) and style(--rm: ${r}): var(--regVal16); else: var(--__1${REG16[r]}))`,
      `MOV r/m16(reg), reg16 (if rm=${r})`);
  }
  // Memory write: if mod!=3, write regVal16 to ea (word: lo at ea, hi at ea+1)
  dispatch.addMemWriteWord(0x89,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `var(--regVal16)`,
    `MOV r/m16(mem), reg16 low byte`);
  dispatch.addEntry('IP', 0x89, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `MOV r/m16, reg16`);

  // 0x88: MOV r/m8, reg8 (d=0, w=0) - destination is r/m (byte)
  // When mod=11, rm selects a register. Combine lo/hi into one entry per 16-bit reg.
  for (const { reg, lowIdx, highIdx } of SPLIT_REGS) {
    dispatch.addEntry(reg, 0x88,
      `if(style(--mod: 3) and style(--rm: ${lowIdx}): --mergelow(var(--__1${reg}), var(--regVal8)); ` +
      `style(--mod: 3) and style(--rm: ${highIdx}): --mergehigh(var(--__1${reg}), var(--regVal8)); ` +
      `else: var(--__1${reg}))`,
      `MOV r/m8(reg), reg8 → ${reg}`);
  }
  // Memory write for byte
  dispatch.addMemWrite(0x88,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `var(--regVal8)`,
    `MOV r/m8(mem), reg8`);
  dispatch.addEntry('IP', 0x88, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `MOV r/m8, reg8`);
}

/**
 * MOV segreg, r/m16 (0x8E) - load segment register from r/m
 * MOV r/m16, segreg (0x8C) - store segment register to r/m
 * reg field selects segment: 0=ES, 1=CS, 2=SS, 3=DS
 */
export function emitMOV_SegRM(dispatch) {
  const segs = ['ES', 'CS', 'SS', 'DS'];

  // 0x8E: MOV segreg, r/m16 - reg field selects destination segreg
  for (let s = 0; s < 4; s++) {
    dispatch.addEntry(segs[s], 0x8E,
      `if(style(--reg: ${s}): var(--rmVal16); else: var(--__1${segs[s]}))`,
      `MOV ${segs[s]}, r/m16`);
  }
  dispatch.addEntry('IP', 0x8E, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `MOV segreg, r/m16`);

  // 0x8C: MOV r/m16, segreg - destination is r/m, source is segreg
  // If mod=11, rm selects destination register
  for (let r = 0; r < 8; r++) {
    const branches = segs.map((seg, s) =>
      `style(--mod: 3) and style(--rm: ${r}) and style(--reg: ${s}): var(--__1${seg})`
    );
    dispatch.addEntry(REG16[r], 0x8C,
      `if(${branches.join('; ')}; else: var(--__1${REG16[r]}))`,
      `MOV r/m16(${REG16[r]}), segreg`);
  }
  // Memory write: if mod!=3, write segreg value to EA
  // Uses precomputed --segRegVal from decode.mjs
  dispatch.addMemWriteWord(0x8C,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `var(--segRegVal)`,
    `MOV r/m16, segreg → mem`);
  dispatch.addEntry('IP', 0x8C, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `MOV r/m16, segreg`);
}

/**
 * MOV AL/AX, [mem] (0xA0-0xA1) and MOV [mem], AL/AX (0xA2-0xA3)
 * Direct memory addressing with 16-bit address at bytes 1-2.
 */
export function emitMOV_AccMem(dispatch) {
  // 0xA0: MOV AL, [addr16] - load byte from seg:addr16 into AL (default DS, overridable)
  dispatch.addEntry('AX', 0xA0,
    `--mergelow(var(--__1AX), var(--_movAlMemByte))`,
    `MOV AL, [mem]`);
  dispatch.addEntry('IP', 0xA0, `calc(var(--__1IP) + 3)`, `MOV AL, [mem]`);

  // 0xA1: MOV AX, [addr16] - load word from seg:addr16 into AX (default DS, overridable)
  dispatch.addEntry('AX', 0xA1,
    `--read2(calc(var(--directSeg) + var(--q1) + var(--q2) * 256))`,
    `MOV AX, [mem]`);
  dispatch.addEntry('IP', 0xA1, `calc(var(--__1IP) + 3)`, `MOV AX, [mem]`);

  // 0xA2: MOV [addr16], AL - store AL to seg:addr16 (default DS, overridable)
  dispatch.addMemWrite(0xA2,
    `calc(var(--directSeg) + var(--q1) + var(--q2) * 256)`,
    `var(--AL)`,
    `MOV [mem], AL`);
  dispatch.addEntry('IP', 0xA2, `calc(var(--__1IP) + 3)`, `MOV [mem], AL`);

  // 0xA3: MOV [addr16], AX - store AX to seg:addr16 (default DS, overridable)
  dispatch.addMemWrite(0xA3,
    `calc(var(--directSeg) + var(--q1) + var(--q2) * 256)`,
    `var(--AL)`,
    `MOV [mem], AX lo`);
  dispatch.addMemWrite(0xA3,
    `calc(var(--directSeg) + var(--q1) + var(--q2) * 256 + 1)`,
    `var(--AH)`,
    `MOV [mem], AX hi`);
  dispatch.addEntry('IP', 0xA3, `calc(var(--__1IP) + 3)`, `MOV [mem], AX`);
}

/**
 * LEA reg16, [mem] (0x8D) - load effective address
 */
export function emitLEA(dispatch) {
  for (let r = 0; r < 8; r++) {
    dispatch.addEntry(REG16[r], 0x8D,
      `if(style(--reg: ${r}): var(--eaOff); else: var(--__1${REG16[r]}))`,
      `LEA ${REG16[r]}, [mem]`);
  }
  dispatch.addEntry('IP', 0x8D, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `LEA`);
}

/**
 * LES reg16, [mem] (0xC4): load pointer - reg = [EA], ES = [EA+2]
 * LDS reg16, [mem] (0xC5): load pointer - reg = [EA], DS = [EA+2]
 * The two differ only in opcode and which segreg gets [EA+2]; mnemonic is
 * L + segreg's first letter + S (ES -> LES, DS -> LDS).
 */
function emitLoadPtr(dispatch, opcode, seg) {
  const mnem = `L${seg[0]}S`;
  for (let r = 0; r < 8; r++) {
    dispatch.addEntry(REG16[r], opcode,
      `if(style(--reg: ${r}): --read2(var(--ea)); else: var(--__1${REG16[r]}))`,
      `${mnem} ${REG16[r]}, [mem]`);
  }
  dispatch.addEntry(seg, opcode,
    `--read2(calc(var(--ea) + 2))`,
    `${mnem} load ${seg}`);
  dispatch.addEntry('IP', opcode, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, mnem);
}

export function emitLES(dispatch) { emitLoadPtr(dispatch, 0xC4, 'ES'); }
export function emitLDS(dispatch) { emitLoadPtr(dispatch, 0xC5, 'DS'); }

/**
 * Register all MOV-family opcodes. Order matters: it fixes dispatch-row
 * order in some tables, so keep it as emit-css.mjs currently calls them.
 */
export function emitAllMOV(dispatch) {
  emitMOV_RegImm16(dispatch);
  emitMOV_RegImm8(dispatch);
  emitMOV_RegRM(dispatch);
  emitMOV_SegRM(dispatch);
  emitMOV_AccMem(dispatch);
  emitLEA(dispatch);
  emitLES(dispatch);
  emitLDS(dispatch);
}
