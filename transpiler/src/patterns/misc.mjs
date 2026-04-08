// Miscellaneous instructions: HLT, NOP, LODSB, MOV r/m imm, flag manipulation, etc.

/**
 * HLT (opcode 0xF4): halt execution.
 */
export function emitHLT(dispatch) {
  dispatch.addEntry('halt', 0xF4, `1`, `HLT`);
  dispatch.addEntry('IP', 0xF4, `var(--__1IP)`, `HLT (IP unchanged)`);
}

/**
 * NOP (opcode 0x90): no operation.
 */
export function emitNOP(dispatch) {
  dispatch.addEntry('IP', 0x90, `calc(var(--__1IP) + 1)`, `NOP`);
}

/**
 * LODSB (0xAC): load byte at DS:SI into AL, adjust SI by DF.
 * LODSW (0xAD): load word at DS:SI into AX, adjust SI by DF.
 */
export function emitLODS(dispatch) {
  // LODSB: AL = mem[DS:SI], SI += (DF ? -1 : 1)
  dispatch.addEntry('AX', 0xAC,
    `--mergelow(var(--__1AX), --readMem(calc(var(--__1DS) * 16 + var(--__1SI))))`,
    `LODSB`);
  // SI: DF (bit 10) controls direction. DF=0: SI++, DF=1: SI--
  dispatch.addEntry('SI', 0xAC,
    `--lowerBytes(calc(var(--__1SI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`,
    `LODSB SI adjust`);
  dispatch.addEntry('IP', 0xAC, `calc(var(--__1IP) + 1)`, `LODSB`);

  // LODSW: AX = mem[DS:SI], SI += (DF ? -2 : 2)
  dispatch.addEntry('AX', 0xAD,
    `--read2(calc(var(--__1DS) * 16 + var(--__1SI)))`,
    `LODSW`);
  dispatch.addEntry('SI', 0xAD,
    `--lowerBytes(calc(var(--__1SI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`,
    `LODSW SI adjust`);
  dispatch.addEntry('IP', 0xAD, `calc(var(--__1IP) + 1)`, `LODSW`);
}

/**
 * MOV r/m8, imm8 (0xC6) and MOV r/m16, imm16 (0xC7).
 * ModR/M byte selects destination. Immediate follows ModR/M+disp.
 */
export function emitMOV_RMimm(dispatch) {
  const REG16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
  const SPLIT_REGS = [
    { reg: 'AX', lowIdx: 0, highIdx: 4 },
    { reg: 'CX', lowIdx: 1, highIdx: 5 },
    { reg: 'DX', lowIdx: 2, highIdx: 6 },
    { reg: 'BX', lowIdx: 3, highIdx: 7 },
  ];

  // 0xC7: MOV r/m16, imm16 — immWord is after ModR/M+disp
  for (let r = 0; r < 8; r++) {
    dispatch.addEntry(REG16[r], 0xC7,
      `if(style(--mod: 3) and style(--rm: ${r}): var(--immWord); else: var(--__1${REG16[r]}))`,
      `MOV r/m16, imm16 → ${REG16[r]}`);
  }
  // Memory write
  dispatch.addMemWrite(0xC7,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `var(--immByte)`,
    `MOV r/m16, imm16 → mem lo`);
  dispatch.addMemWrite(0xC7,
    `if(style(--mod: 3): -1; else: calc(var(--ea) + 1))`,
    `--readMem(calc(var(--ipAddr) + var(--immOff) + 1))`,
    `MOV r/m16, imm16 → mem hi`);
  dispatch.addEntry('IP', 0xC7,
    `calc(var(--__1IP) + 2 + var(--modrmExtra) + 2)`,
    `MOV r/m16, imm16`);

  // 0xC6: MOV r/m8, imm8
  for (const { reg, lowIdx, highIdx } of SPLIT_REGS) {
    dispatch.addEntry(reg, 0xC6,
      `if(style(--mod: 3) and style(--rm: ${lowIdx}): --mergelow(var(--__1${reg}), var(--immByte)); ` +
      `style(--mod: 3) and style(--rm: ${highIdx}): --mergehigh(var(--__1${reg}), var(--immByte)); ` +
      `else: var(--__1${reg}))`,
      `MOV r/m8, imm8 → ${reg}`);
  }
  // Memory write
  dispatch.addMemWrite(0xC6,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `var(--immByte)`,
    `MOV r/m8, imm8 → mem`);
  dispatch.addEntry('IP', 0xC6,
    `calc(var(--__1IP) + 2 + var(--modrmExtra) + 1)`,
    `MOV r/m8, imm8`);
}

/**
 * Flag manipulation: CLC, STC, CMC, CLD, STD, CLI, STI
 */
export function emitFlagManip(dispatch) {
  // CLC (0xF8): CF = 0
  dispatch.addEntry('flags', 0xF8,
    `calc(var(--__1flags) - --bit(var(--__1flags), 0))`,
    `CLC`);
  dispatch.addEntry('IP', 0xF8, `calc(var(--__1IP) + 1)`, `CLC`);

  // STC (0xF9): CF = 1
  dispatch.addEntry('flags', 0xF9,
    `--or(var(--__1flags), 1)`,
    `STC`);
  dispatch.addEntry('IP', 0xF9, `calc(var(--__1IP) + 1)`, `STC`);

  // CMC (0xF5): CF = !CF
  dispatch.addEntry('flags', 0xF5,
    `--xor(var(--__1flags), 1)`,
    `CMC`);
  dispatch.addEntry('IP', 0xF5, `calc(var(--__1IP) + 1)`, `CMC`);

  // CLD (0xFC): DF = 0 (bit 10)
  dispatch.addEntry('flags', 0xFC,
    `calc(var(--__1flags) - --bit(var(--__1flags), 10) * 1024)`,
    `CLD`);
  dispatch.addEntry('IP', 0xFC, `calc(var(--__1IP) + 1)`, `CLD`);

  // STD (0xFD): DF = 1
  dispatch.addEntry('flags', 0xFD,
    `--or(var(--__1flags), 1024)`,
    `STD`);
  dispatch.addEntry('IP', 0xFD, `calc(var(--__1IP) + 1)`, `STD`);

  // CLI (0xFA): IF = 0 (bit 9)
  dispatch.addEntry('flags', 0xFA,
    `calc(var(--__1flags) - --bit(var(--__1flags), 9) * 512)`,
    `CLI`);
  dispatch.addEntry('IP', 0xFA, `calc(var(--__1IP) + 1)`, `CLI`);

  // STI (0xFB): IF = 1
  dispatch.addEntry('flags', 0xFB,
    `--or(var(--__1flags), 512)`,
    `STI`);
  dispatch.addEntry('IP', 0xFB, `calc(var(--__1IP) + 1)`, `STI`);
}

/**
 * CBW (0x98): sign-extend AL to AX.
 * CWD (0x99): sign-extend AX to DX:AX.
 */
export function emitCBW_CWD(dispatch) {
  // CBW: if AL bit 7 set, AH = 0xFF, else AH = 0x00
  dispatch.addEntry('AX', 0x98,
    `calc(var(--AL) + --bit(var(--AL), 7) * 65280)`,
    `CBW`);
  dispatch.addEntry('IP', 0x98, `calc(var(--__1IP) + 1)`, `CBW`);

  // CWD: if AX bit 15 set, DX = 0xFFFF, else DX = 0x0000
  dispatch.addEntry('DX', 0x99,
    `calc(--bit(var(--__1AX), 15) * 65535)`,
    `CWD`);
  dispatch.addEntry('IP', 0x99, `calc(var(--__1IP) + 1)`, `CWD`);
}

/**
 * STOSB (0xAA): store AL at ES:DI, adjust DI.
 * STOSW (0xAB): store AX at ES:DI, adjust DI.
 */
export function emitSTOS(dispatch) {
  // STOSB: mem[ES:DI] = AL, DI += (DF ? -1 : 1)
  dispatch.addMemWrite(0xAA,
    `calc(var(--__1ES) * 16 + var(--__1DI))`,
    `var(--AL)`,
    `STOSB`);
  dispatch.addEntry('DI', 0xAA,
    `--lowerBytes(calc(var(--__1DI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`,
    `STOSB DI adjust`);
  dispatch.addEntry('IP', 0xAA, `calc(var(--__1IP) + 1)`, `STOSB`);

  // STOSW: mem[ES:DI] = AX (word), DI += (DF ? -2 : 2)
  dispatch.addMemWrite(0xAB,
    `calc(var(--__1ES) * 16 + var(--__1DI))`,
    `var(--AL)`,
    `STOSW lo`);
  dispatch.addMemWrite(0xAB,
    `calc(var(--__1ES) * 16 + var(--__1DI) + 1)`,
    `var(--AH)`,
    `STOSW hi`);
  dispatch.addEntry('DI', 0xAB,
    `--lowerBytes(calc(var(--__1DI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`,
    `STOSW DI adjust`);
  dispatch.addEntry('IP', 0xAB, `calc(var(--__1IP) + 1)`, `STOSW`);
}

/**
 * XCHG AX, reg16 (0x91-0x97) — exchange AX with another register.
 */
export function emitXCHG_AXreg(dispatch) {
  const REG16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
  for (let r = 1; r < 8; r++) { // 0x91-0x97 (skip 0x90=NOP)
    const opcode = 0x90 + r;
    // AX gets the other register's value
    dispatch.addEntry('AX', opcode, `var(--__1${REG16[r]})`, `XCHG AX, ${REG16[r]}`);
    // The other register gets AX's value
    dispatch.addEntry(REG16[r], opcode, `var(--__1AX)`, `XCHG AX, ${REG16[r]}`);
    dispatch.addEntry('IP', opcode, `calc(var(--__1IP) + 1)`, `XCHG AX, ${REG16[r]}`);
  }
}

/**
 * MOVSB (0xA4): copy byte from DS:SI to ES:DI, adjust SI and DI.
 * MOVSW (0xA5): copy word from DS:SI to ES:DI, adjust SI and DI.
 */
export function emitMOVS(dispatch) {
  // MOVSB: mem[ES:DI] = mem[DS:SI], SI += (DF?-1:1), DI += (DF?-1:1)
  dispatch.addMemWrite(0xA4,
    `calc(var(--__1ES) * 16 + var(--__1DI))`,
    `--readMem(calc(var(--__1DS) * 16 + var(--__1SI)))`,
    `MOVSB`);
  dispatch.addEntry('SI', 0xA4,
    `--lowerBytes(calc(var(--__1SI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`,
    `MOVSB SI adjust`);
  dispatch.addEntry('DI', 0xA4,
    `--lowerBytes(calc(var(--__1DI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`,
    `MOVSB DI adjust`);
  dispatch.addEntry('IP', 0xA4, `calc(var(--__1IP) + 1)`, `MOVSB`);

  // MOVSW: copy word (2 bytes)
  dispatch.addMemWrite(0xA5,
    `calc(var(--__1ES) * 16 + var(--__1DI))`,
    `--readMem(calc(var(--__1DS) * 16 + var(--__1SI)))`,
    `MOVSW lo`);
  dispatch.addMemWrite(0xA5,
    `calc(var(--__1ES) * 16 + var(--__1DI) + 1)`,
    `--readMem(calc(var(--__1DS) * 16 + var(--__1SI) + 1))`,
    `MOVSW hi`);
  dispatch.addEntry('SI', 0xA5,
    `--lowerBytes(calc(var(--__1SI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`,
    `MOVSW SI adjust`);
  dispatch.addEntry('DI', 0xA5,
    `--lowerBytes(calc(var(--__1DI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`,
    `MOVSW DI adjust`);
  dispatch.addEntry('IP', 0xA5, `calc(var(--__1IP) + 1)`, `MOVSW`);
}

/**
 * CMPSB (0xA6): compare byte at DS:SI with byte at ES:DI, set flags.
 * CMPSW (0xA7): compare word at DS:SI with word at ES:DI, set flags.
 */
export function emitCMPS(dispatch) {
  // CMPSB: flags = sub(mem[DS:SI], mem[ES:DI])
  dispatch.addEntry('flags', 0xA6,
    `--subFlags8(--readMem(calc(var(--__1DS) * 16 + var(--__1SI))), --readMem(calc(var(--__1ES) * 16 + var(--__1DI))))`,
    `CMPSB flags`);
  dispatch.addEntry('SI', 0xA6,
    `--lowerBytes(calc(var(--__1SI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`,
    `CMPSB SI adjust`);
  dispatch.addEntry('DI', 0xA6,
    `--lowerBytes(calc(var(--__1DI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`,
    `CMPSB DI adjust`);
  dispatch.addEntry('IP', 0xA6, `calc(var(--__1IP) + 1)`, `CMPSB`);

  // CMPSW: compare words
  dispatch.addEntry('flags', 0xA7,
    `--subFlags16(--read2(calc(var(--__1DS) * 16 + var(--__1SI))), --read2(calc(var(--__1ES) * 16 + var(--__1DI))))`,
    `CMPSW flags`);
  dispatch.addEntry('SI', 0xA7,
    `--lowerBytes(calc(var(--__1SI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`,
    `CMPSW SI adjust`);
  dispatch.addEntry('DI', 0xA7,
    `--lowerBytes(calc(var(--__1DI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`,
    `CMPSW DI adjust`);
  dispatch.addEntry('IP', 0xA7, `calc(var(--__1IP) + 1)`, `CMPSW`);
}

/**
 * SCASB (0xAE): compare AL with byte at ES:DI, set flags, adjust DI.
 * SCASW (0xAF): compare AX with word at ES:DI, set flags, adjust DI.
 */
export function emitSCAS(dispatch) {
  dispatch.addEntry('flags', 0xAE,
    `--subFlags8(var(--AL), --readMem(calc(var(--__1ES) * 16 + var(--__1DI))))`,
    `SCASB flags`);
  dispatch.addEntry('DI', 0xAE,
    `--lowerBytes(calc(var(--__1DI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`,
    `SCASB DI adjust`);
  dispatch.addEntry('IP', 0xAE, `calc(var(--__1IP) + 1)`, `SCASB`);

  dispatch.addEntry('flags', 0xAF,
    `--subFlags16(var(--__1AX), --read2(calc(var(--__1ES) * 16 + var(--__1DI))))`,
    `SCASW flags`);
  dispatch.addEntry('DI', 0xAF,
    `--lowerBytes(calc(var(--__1DI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`,
    `SCASW DI adjust`);
  dispatch.addEntry('IP', 0xAF, `calc(var(--__1IP) + 1)`, `SCASW`);
}

/**
 * XCHG reg16, r/m16 (0x87): exchange register with r/m operand.
 * XCHG reg8, r/m8 (0x86): exchange 8-bit register with r/m operand.
 */
export function emitXCHG_RM(dispatch) {
  const REG16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
  const SPLIT_REGS = [
    { reg: 'AX', lowIdx: 0, highIdx: 4 },
    { reg: 'CX', lowIdx: 1, highIdx: 5 },
    { reg: 'DX', lowIdx: 2, highIdx: 6 },
    { reg: 'BX', lowIdx: 3, highIdx: 7 },
  ];

  // 0x87: XCHG reg16, r/m16
  // reg field register gets rmVal16, rm operand gets regVal16
  for (let r = 0; r < 8; r++) {
    const regName = REG16[r];
    // This register is the destination when reg field = r
    // It's also the source (for memory write) when rm = r and mod=3
    const branches = [];
    // When this reg is selected by the reg field: gets rmVal16
    branches.push(`style(--reg: ${r}): var(--rmVal16)`);
    // When this reg is selected by rm field (mod=3): gets regVal16
    for (let regF = 0; regF < 8; regF++) {
      if (regF === r) continue; // Already covered above (reg=r means rm is the source)
      branches.push(`style(--mod: 3) and style(--rm: ${r}) and style(--reg: ${regF}): var(--regVal16)`);
    }
    dispatch.addEntry(regName, 0x87,
      `if(${branches.join('; ')}; else: var(--__1${regName}))`,
      `XCHG r/m16 → ${regName}`);
  }
  // Memory write: when mod!=3, write regVal16 to EA
  dispatch.addMemWrite(0x87,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `--lowerBytes(var(--regVal16), 8)`,
    `XCHG r/m16 → mem lo`);
  dispatch.addMemWrite(0x87,
    `if(style(--mod: 3): -1; else: calc(var(--ea) + 1))`,
    `--rightShift(var(--regVal16), 8)`,
    `XCHG r/m16 → mem hi`);
  dispatch.addEntry('IP', 0x87, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `XCHG r/m16`);

  // 0x86: XCHG reg8, r/m8
  for (const { reg: regName, lowIdx, highIdx } of SPLIT_REGS) {
    const branches = [];
    // reg field selects this register's low byte
    branches.push(`style(--reg: ${lowIdx}): --mergelow(var(--__1${regName}), var(--rmVal8))`);
    // reg field selects this register's high byte
    branches.push(`style(--reg: ${highIdx}): --mergehigh(var(--__1${regName}), var(--rmVal8))`);
    // rm field selects this register's low byte (mod=3): gets regVal8
    branches.push(`style(--mod: 3) and style(--rm: ${lowIdx}): --mergelow(var(--__1${regName}), var(--regVal8))`);
    // rm field selects this register's high byte (mod=3): gets regVal8
    branches.push(`style(--mod: 3) and style(--rm: ${highIdx}): --mergehigh(var(--__1${regName}), var(--regVal8))`);
    dispatch.addEntry(regName, 0x86,
      `if(${branches.join('; ')}; else: var(--__1${regName}))`,
      `XCHG r/m8 → ${regName}`);
  }
  // Memory write for byte XCHG
  dispatch.addMemWrite(0x86,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `var(--regVal8)`,
    `XCHG r/m8 → mem`);
  dispatch.addEntry('IP', 0x86, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `XCHG r/m8`);
}

/**
 * POP r/m16 (0x8F): pop word from stack into r/m16.
 * Only reg=0 is defined.
 */
export function emitPOP_RM(dispatch) {
  const REG16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];

  // Pop value from stack into register (mod=3)
  for (let r = 0; r < 8; r++) {
    if (r === 4) continue; // SP handled separately
    dispatch.addEntry(REG16[r], 0x8F,
      `if(style(--mod: 3) and style(--rm: ${r}): --read2(calc(var(--__1SS) * 16 + var(--__1SP))); else: var(--__1${REG16[r]}))`,
      `POP r/m16 → ${REG16[r]}`);
  }
  // SP: gets popped value if rm=4, otherwise SP+=2
  dispatch.addEntry('SP', 0x8F,
    `if(style(--mod: 3) and style(--rm: 4): --read2(calc(var(--__1SS) * 16 + var(--__1SP))); else: calc(var(--__1SP) + 2))`,
    `POP r/m16 SP`);

  // Memory write: when mod!=3, write popped value to EA
  dispatch.addMemWrite(0x8F,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `--lowerBytes(--read2(calc(var(--__1SS) * 16 + var(--__1SP))), 8)`,
    `POP r/m16 → mem lo`);
  dispatch.addMemWrite(0x8F,
    `if(style(--mod: 3): -1; else: calc(var(--ea) + 1))`,
    `--rightShift(--read2(calc(var(--__1SS) * 16 + var(--__1SP))), 8)`,
    `POP r/m16 → mem hi`);

  dispatch.addEntry('IP', 0x8F, `calc(var(--__1IP) + 2 + var(--modrmExtra))`, `POP r/m16`);
}

/**
 * LAHF (0x9F): AH = flags low byte (SF, ZF, AF, PF, CF).
 * SAHF (0x9E): flags low byte = (AH & 0xD7) | 0x02, preserving upper byte.
 */
export function emitLAHF_SAHF(dispatch) {
  // LAHF: AH = flags & 0xFF → mergehigh(AX, flags & 0xFF)
  dispatch.addEntry('AX', 0x9F,
    `--mergehigh(var(--__1AX), --lowerBytes(var(--__1flags), 8))`,
    `LAHF`);
  dispatch.addEntry('IP', 0x9F, `calc(var(--__1IP) + 1)`, `LAHF`);

  // SAHF: flags = (flags & 0xFF00) | (AH & 0xD7) | 0x02
  // 0xD7 = 215, preserves bits 0,1,2,4,6,7 of AH (CF,PF,AF,ZF,SF)
  // Upper flags byte preserved via: clear low byte then OR in new
  // flags_hi * 256 + (AH & 0xD7) + 2 (force bit 1)
  dispatch.addEntry('flags', 0x9E,
    `calc(--rightShift(var(--__1flags), 8) * 256 + --and(var(--AH), 215) + 2)`,
    `SAHF`);
  dispatch.addEntry('IP', 0x9E, `calc(var(--__1IP) + 1)`, `SAHF`);
}

/**
 * Register all misc opcodes.
 */
export function emitAllMisc(dispatch) {
  emitHLT(dispatch);
  emitNOP(dispatch);
  emitLODS(dispatch);
  emitSTOS(dispatch);
  emitMOVS(dispatch);
  emitCMPS(dispatch);
  emitSCAS(dispatch);
  emitMOV_RMimm(dispatch);
  emitFlagManip(dispatch);
  emitCBW_CWD(dispatch);
  emitXCHG_AXreg(dispatch);
  emitXCHG_RM(dispatch);
  emitPOP_RM(dispatch);
  emitLAHF_SAHF(dispatch);
}
