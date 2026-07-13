// Miscellaneous instructions: HLT, NOP, LODSB, MOV r/m imm, flag manipulation, etc.

import { REG16, SPLIT_REGS } from './regs.mjs';

// ===== REP PREFIX HELPERS =====
// These helpers wrap string operation expressions to handle REP/REPE/REPNE prefixes.
// When hasREP=1 and CX=0, the string op is skipped (register/memory unchanged).
// When hasREP=1 and CX>1, IP stays at the prefix byte for re-execution.
// When hasREP=1 and CX=1, this is the last iteration — IP advances normally.

/** Wrap a register expression so that REP with CX=0 preserves the old value. */
function repGuardReg(expr, oldVal) {
  return `if(style(--hasREP: 1) and style(--_repActive: 0): ${oldVal}; else: ${expr})`;
}

/** Wrap a memory write address so that REP with CX=0 suppresses the write. */
function repGuardAddr(addr) {
  return `if(style(--hasREP: 1) and style(--_repActive: 0): -1; else: ${addr})`;
}

/** IP expression for string ops: re-execute if repeating, else advance.
 *  instrLen = byte length of the string op itself (always 1 for these). */
function repIP(instrLen = 1) {
  // _repContinue=1 when hasREP=1 and CX>1 → re-execute: IP stays at prefix byte.
  // The dispatch IP wrapper adds + prefixLen, so we emit (IP - prefixLen) here
  // so the final result is IP - prefixLen + prefixLen = IP (unchanged).
  // When not repeating (no REP, or last iteration, or CX=0): advance normally.
  return `if(style(--_repContinue: 1): calc(var(--__1IP) - var(--prefixLen)); else: calc(var(--__1IP) + ${instrLen}))`;
}

/** CX expression for string ops under REP: decrement CX, or keep if no REP.
 *  For CX=0 with REP, CX stays at 0 (max(0, 0-1) = 0). */
function repCX() {
  return `if(style(--hasREP: 0): var(--__1CX); else: max(0, calc(var(--__1CX) - 1)))`;
}

/** IP expression for REPE/REPNE string ops (CMPS/SCAS).
 *  For REPE (repType=1): stop if ZF=0 after comparison.
 *  For REPNE (repType=2): stop if ZF=1 after comparison.
 *  zfExpr = expression that evaluates to 1 when ZF would be set (operands equal). */
function repCondIP(zfExpr, instrLen = 1) {
  // Continue if: hasREP=1 AND CX>1 AND condition holds
  // REPE (repType=1): continue if equal (zf=1)  → stop if zf=0
  // REPNE (repType=2): continue if not equal (zf=0) → stop if zf=1
  // Combined: continue if (repType=1 and equal) or (repType=2 and not equal)
  //   = repType + zf != 3  (1+1=2, 1+0=1, 2+1=3, 2+0=2; stop when sum=3)
  //   Actually: REPE stops when zf=0, REPNE stops when zf=1
  //   Continue when: (repType=1 and zf=1) or (repType=2 and zf=0)
  //   = |repType - 1 - zf| < 1  → repType-1 == zf → repType == zf+1
  // Simpler: use if-chain. But we can't nest too deep.
  // Let's just use: repType=1 means stop if zfExpr=0, repType=2 means stop if zfExpr=1
  // _repContinue already checks CX>1. We also need the ZF condition.
  // Express as: _repContinue=1 AND ((repType=1 AND equal) OR (repType=2 AND not_equal))
  return `if(` +
    `style(--_repContinue: 1) and style(--repType: 1) and style(--_repZF: 1): calc(var(--__1IP) - var(--prefixLen)); ` +
    `style(--_repContinue: 1) and style(--repType: 2) and style(--_repZF: 0): calc(var(--__1IP) - var(--prefixLen)); ` +
    `else: calc(var(--__1IP) + ${instrLen}))`;
}

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
    repGuardReg(`--mergelow(var(--__1AX), var(--_strSrcByte))`, `var(--__1AX)`),
    `LODSB`);
  dispatch.addEntry('SI', 0xAC,
    repGuardReg(`--lowerBytes(calc(var(--__1SI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`, `var(--__1SI)`),
    `LODSB SI adjust`);
  dispatch.addEntry('CX', 0xAC, repCX(), `REP LODSB CX`);
  dispatch.addEntry('IP', 0xAC, repIP(), `LODSB`);

  // LODSW: AX = mem[DS:SI], SI += (DF ? -2 : 2)
  dispatch.addEntry('AX', 0xAD,
    repGuardReg(`calc(var(--_strSrcByte) + var(--_strSrcHiByte) * 256)`, `var(--__1AX)`),
    `LODSW`);
  dispatch.addEntry('SI', 0xAD,
    repGuardReg(`--lowerBytes(calc(var(--__1SI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`, `var(--__1SI)`),
    `LODSW SI adjust`);
  dispatch.addEntry('CX', 0xAD, repCX(), `REP LODSW CX`);
  dispatch.addEntry('IP', 0xAD, repIP(), `LODSW`);
}

/**
 * MOV r/m8, imm8 (0xC6) and MOV r/m16, imm16 (0xC7).
 * ModR/M byte selects destination. Immediate follows ModR/M+disp.
 */
export function emitMOV_RMimm(dispatch) {
  // 0xC7: MOV r/m16, imm16 — immWord is after ModR/M+disp
  for (let r = 0; r < 8; r++) {
    dispatch.addEntry(REG16[r], 0xC7,
      `if(style(--mod: 3) and style(--rm: ${r}): var(--immWord); else: var(--__1${REG16[r]}))`,
      `MOV r/m16, imm16 → ${REG16[r]}`);
  }
  // Memory write — use immByte/immWord (already decoded) instead of separate readMem
  dispatch.addMemWrite(0xC7,
    `if(style(--mod: 3): -1; else: var(--ea))`,
    `var(--immByte)`,
    `MOV r/m16, imm16 → mem lo`);
  dispatch.addMemWrite(0xC7,
    `if(style(--mod: 3): -1; else: calc(var(--ea) + 1))`,
    `--rightShift(var(--immWord), 8)`,
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
    repGuardAddr(`calc(var(--__1ES) * 16 + var(--__1DI))`),
    `var(--AL)`,
    `STOSB`);
  dispatch.addEntry('DI', 0xAA,
    repGuardReg(`--lowerBytes(calc(var(--__1DI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`, `var(--__1DI)`),
    `STOSB DI adjust`);
  dispatch.addEntry('CX', 0xAA, repCX(), `REP STOSB CX`);
  dispatch.addEntry('IP', 0xAA, repIP(), `STOSB`);

  // STOSW: mem[ES:DI] = AX (word), DI += (DF ? -2 : 2)
  dispatch.addMemWrite(0xAB,
    repGuardAddr(`calc(var(--__1ES) * 16 + var(--__1DI))`),
    `var(--AL)`,
    `STOSW lo`);
  dispatch.addMemWrite(0xAB,
    repGuardAddr(`calc(var(--__1ES) * 16 + var(--__1DI) + 1)`),
    `var(--AH)`,
    `STOSW hi`);
  dispatch.addEntry('DI', 0xAB,
    repGuardReg(`--lowerBytes(calc(var(--__1DI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`, `var(--__1DI)`),
    `STOSW DI adjust`);
  dispatch.addEntry('CX', 0xAB, repCX(), `REP STOSW CX`);
  dispatch.addEntry('IP', 0xAB, repIP(), `STOSW`);
}

/**
 * XCHG AX, reg16 (0x91-0x97) — exchange AX with another register.
 */
export function emitXCHG_AXreg(dispatch) {
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
    repGuardAddr(`calc(var(--__1ES) * 16 + var(--__1DI))`),
    `var(--_strSrcByte)`,
    `MOVSB`);
  dispatch.addEntry('SI', 0xA4,
    repGuardReg(`--lowerBytes(calc(var(--__1SI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`, `var(--__1SI)`),
    `MOVSB SI adjust`);
  dispatch.addEntry('DI', 0xA4,
    repGuardReg(`--lowerBytes(calc(var(--__1DI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`, `var(--__1DI)`),
    `MOVSB DI adjust`);
  dispatch.addEntry('CX', 0xA4, repCX(), `REP MOVSB CX`);
  dispatch.addEntry('IP', 0xA4, repIP(), `MOVSB`);

  // MOVSW: copy word (2 bytes)
  dispatch.addMemWrite(0xA5,
    repGuardAddr(`calc(var(--__1ES) * 16 + var(--__1DI))`),
    `var(--_strSrcByte)`,
    `MOVSW lo`);
  dispatch.addMemWrite(0xA5,
    repGuardAddr(`calc(var(--__1ES) * 16 + var(--__1DI) + 1)`),
    `var(--_strSrcHiByte)`,
    `MOVSW hi`);
  dispatch.addEntry('SI', 0xA5,
    repGuardReg(`--lowerBytes(calc(var(--__1SI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`, `var(--__1SI)`),
    `MOVSW SI adjust`);
  dispatch.addEntry('DI', 0xA5,
    repGuardReg(`--lowerBytes(calc(var(--__1DI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`, `var(--__1DI)`),
    `MOVSW DI adjust`);
  dispatch.addEntry('CX', 0xA5, repCX(), `REP MOVSW CX`);
  dispatch.addEntry('IP', 0xA5, repIP(), `MOVSW`);
}

/**
 * CMPSB (0xA6): compare byte at DS:SI with byte at ES:DI, set flags.
 * CMPSW (0xA7): compare word at DS:SI with word at ES:DI, set flags.
 */
export function emitCMPS(dispatch) {
  // CMPSB: flags = sub(mem[DS:SI], mem[ES:DI])
  dispatch.addEntry('flags', 0xA6,
    repGuardReg(`calc(--subFlags8(var(--_strSrcByte), var(--_strDstByte)) + --and(var(--__1flags), 1792))`, `var(--__1flags)`),
    `CMPSB flags`);
  dispatch.addEntry('SI', 0xA6,
    repGuardReg(`--lowerBytes(calc(var(--__1SI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`, `var(--__1SI)`),
    `CMPSB SI adjust`);
  dispatch.addEntry('DI', 0xA6,
    repGuardReg(`--lowerBytes(calc(var(--__1DI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`, `var(--__1DI)`),
    `CMPSB DI adjust`);
  dispatch.addEntry('CX', 0xA6, repCX(), `REPE/NE CMPSB CX`);
  dispatch.addEntry('IP', 0xA6, repCondIP(), `CMPSB`);

  // CMPSW: compare words
  dispatch.addEntry('flags', 0xA7,
    repGuardReg(`calc(--subFlags16(calc(var(--_strSrcByte) + var(--_strSrcHiByte) * 256), calc(var(--_strDstByte) + var(--_strDstHiByte) * 256)) + --and(var(--__1flags), 1792))`, `var(--__1flags)`),
    `CMPSW flags`);
  dispatch.addEntry('SI', 0xA7,
    repGuardReg(`--lowerBytes(calc(var(--__1SI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`, `var(--__1SI)`),
    `CMPSW SI adjust`);
  dispatch.addEntry('DI', 0xA7,
    repGuardReg(`--lowerBytes(calc(var(--__1DI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`, `var(--__1DI)`),
    `CMPSW DI adjust`);
  dispatch.addEntry('CX', 0xA7, repCX(), `REPE/NE CMPSW CX`);
  dispatch.addEntry('IP', 0xA7, repCondIP(), `CMPSW`);
}

/**
 * SCASB (0xAE): compare AL with byte at ES:DI, set flags, adjust DI.
 * SCASW (0xAF): compare AX with word at ES:DI, set flags, adjust DI.
 */
export function emitSCAS(dispatch) {
  dispatch.addEntry('flags', 0xAE,
    repGuardReg(`calc(--subFlags8(var(--AL), var(--_strDstByte)) + --and(var(--__1flags), 1792))`, `var(--__1flags)`),
    `SCASB flags`);
  dispatch.addEntry('DI', 0xAE,
    repGuardReg(`--lowerBytes(calc(var(--__1DI) + 1 - --bit(var(--__1flags), 10) * 2), 16)`, `var(--__1DI)`),
    `SCASB DI adjust`);
  dispatch.addEntry('CX', 0xAE, repCX(), `REPE/NE SCASB CX`);
  dispatch.addEntry('IP', 0xAE, repCondIP(), `SCASB`);

  dispatch.addEntry('flags', 0xAF,
    repGuardReg(`calc(--subFlags16(var(--__1AX), --read2(calc(var(--__1ES) * 16 + var(--__1DI)))) + --and(var(--__1flags), 1792))`, `var(--__1flags)`),
    `SCASW flags`);
  dispatch.addEntry('DI', 0xAF,
    repGuardReg(`--lowerBytes(calc(var(--__1DI) + 2 - --bit(var(--__1flags), 10) * 4), 16)`, `var(--__1DI)`),
    `SCASW DI adjust`);
  dispatch.addEntry('CX', 0xAF, repCX(), `REPE/NE SCASW CX`);
  dispatch.addEntry('IP', 0xAF, repCondIP(), `SCASW`);
}

/**
 * XCHG reg16, r/m16 (0x87): exchange register with r/m operand.
 * XCHG reg8, r/m8 (0x86): exchange 8-bit register with r/m operand.
 */
export function emitXCHG_RM(dispatch) {
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
    // Special case: both reg and rm select halves of the SAME register (e.g., XCHG AL,AH)
    // Both halves must change simultaneously — a full byte swap.
    // XCHG low,high (reg=low,rm=high): new_low=rmVal8(=high), new_high=regVal8(=low)
    branches.push(`style(--mod: 3) and style(--reg: ${lowIdx}) and style(--rm: ${highIdx}): calc(var(--rmVal8) + var(--regVal8) * 256)`);
    // XCHG high,low (reg=high,rm=low): new_low=regVal8(=high), new_high=rmVal8(=low)
    branches.push(`style(--mod: 3) and style(--reg: ${highIdx}) and style(--rm: ${lowIdx}): calc(var(--regVal8) + var(--rmVal8) * 256)`);
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
  // Pop value from stack into register (mod=3)
  for (let r = 0; r < 8; r++) {
    if (r === 4) continue; // SP handled separately
    dispatch.addEntry(REG16[r], 0x8F,
      `if(style(--mod: 3) and style(--rm: ${r}): --read2(calc(var(--__1SS) * 16 + var(--__1SP))); else: var(--__1${REG16[r]}))`,
      `POP r/m16 → ${REG16[r]}`);
  }
  // SP: gets popped value if rm=4, otherwise SP+=2 (wrapped to 16 bits).
  dispatch.addEntry('SP', 0x8F,
    `if(style(--mod: 3) and style(--rm: 4): --read2(calc(var(--__1SS) * 16 + var(--__1SP))); else: --lowerBytes(calc(var(--__1SP) + 2), 16))`,
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

  // SAHF: flags = (flags & 0xFF00) | (AH & 0xD5) | 0x02
  // 0xD5 = 213 clears bit 1 so +2 safely forces it on (avoids double-counting)
  // Preserves bits 0,2,4,6,7 of AH (CF,PF,AF,ZF,SF)
  dispatch.addEntry('flags', 0x9E,
    `calc(--rightShift(var(--__1flags), 8) * 256 + --and(var(--AH), 213) + 2)`,
    `SAHF`);
  dispatch.addEntry('IP', 0x9E, `calc(var(--__1IP) + 1)`, `SAHF`);
}

/**
 * Peripheral helper computed properties emitted into the .motherboard
 * (chipset) rule.
 *
 * These aren't dispatched — they're derived each tick from the new
 * --cycleCount (which the instruction's cycle-count entry has already
 * set for this tick) and the __1 versions of the PIT state vars.
 *
 * --_pitTicks: PIT input pulses consumed this retirement.
 *   The 8086 runs at ~4.77 MHz, the PIT at ~1.193 MHz — a 4:1 ratio.
 *   So each increment of cycleCount/4 is one PIT tick.
 * --_pitDecrement: how much to subtract from the counter. Mode 3
 *   (square wave) decrements by 2 per PIT tick; other modes by 1.
 * --_pitFired: 1 iff the counter would cross zero this tick and the
 *   PIT is armed (pitReload != 0). Used to raise IRQ 0 on picPending.
 *   Computed via sign(decrement - counter + 1): positive when the
 *   decrement is at least counter (i.e. counter reaches 0 or below),
 *   clamped to [0, 1].
 */
export function emitPitDerivation() {
  const pitTicks = `calc(round(down, var(--cycleCount) / 4) - round(down, var(--__1cycleCount) / 4))`;
  const pitDecrement = `if(style(--__1pitMode: 3): calc(var(--_pitTicks) * 2); else: var(--_pitTicks))`;
  const pitFired = `if(style(--__1pitReload: 0): 0; else: min(1, max(0, sign(calc(var(--_pitDecrement) - var(--__1pitCounter) + 1)))))`;
  return [
    `  /* PIT ticks elapsed this instruction, derived from --cycleCount (4.77 MHz / 4) */`,
    `  --_pitTicks: ${pitTicks};`,
    `  --_pitDecrement: ${pitDecrement};`,
    `  --_pitFired: ${pitFired};`,
  ].join('\n');
}

/**
 * Expression for --pitCounter's per-tick countdown: decrement by
 * --_pitDecrement, reload from --__1pitReload on zero crossing. Holds
 * at 0 while idle (pitReload == 0). Used both as the register-level
 * default (opcodes with no PIT dispatch entry) and as the `else:` of
 * the port-write entries (OUT to a non-PIT port must still tick).
 */
export function pitCounterDefaultExpr() {
  return `if(
    style(--__1pitReload: 0): 0;
    else: calc(
      var(--__1pitCounter) - var(--_pitDecrement)
      + max(0, sign(calc(var(--_pitDecrement) - var(--__1pitCounter) + 1))) * var(--__1pitReload)
    )
  )`;
}

/**
 * Default expression for --picPending. ORs in bit 0 when the PIT crosses
 * zero (_pitFired) and bit 1 on a keyboard press edge (_kbdEdge).
 *
 * The IRQ-acknowledge branch (clearing --_irqBit) is applied via the
 * register-level IRQ_OVERRIDES in emit-css.mjs, not here — the override
 * takes priority over this default when --_irqActive fires.
 */
export function picPendingDefaultExpr(mouse = false) {
  const base = `--or(
    --or(var(--__1picPending), var(--_pitFired)),
    calc(var(--_kbdEdge) * 2)
  )`;
  if (!mouse) return base;
  // Serial-mouse cabinets also latch IRQ 4 (bit 4) whenever the UART
  // loads a fresh RX byte (--_uartLoad is already gated on IER bit 0).
  return `--or(${base}, calc(var(--_uartLoad) * 16))`;
}

/**
 * Compute properties for IRQ delivery. Emitted as standalone lines in
 * the .motherboard (chipset) rule — not dispatch-routed.
 *
 *   --_kbdPress:    1 iff --keyboard went 0 → non-zero this tick (make code).
 *   --_kbdRelease:  1 iff --keyboard went non-zero → 0 this tick (break code).
 *   --_kbdEdge:     --_kbdPress | --_kbdRelease — either raises IRQ 1.
 *   --_kbdPort60:   what port 0x60 IN returns on this tick. Normally the
 *                   current scancode (high byte of --keyboard). On a release
 *                   tick, the previous scancode with bit 7 set (break code).
 *   --_picEffective: pending-and-unmasked IRQs, masked to 0 when another
 *                    IRQ is already in service (prevents nesting).
 *   --_ifFlag:      interrupt-enable flag (bit 9 of FLAGS).
 *   --_irqActive:   1 iff an IRQ should fire at this instruction boundary.
 *   --_irq0Pending: 1 iff IRQ 0 (PIT) is the effective pending IRQ.
 *                   IRQ 0 has priority over IRQ 1 on real PICs.
 *   --picVector:    INT vector for the acknowledged IRQ (8 or 9 for now).
 *   --_irqBit:      bitmask (1 or 2) of the IRQ being acknowledged.
 *
 * Phase 3 only handles IRQ 0 (timer) and IRQ 1 (keyboard) — the only ones
 * Doom8088 cares about. Adding more IRQs would generalize --picVector
 * and --_irqBit through a lowestBit helper like v3's irq.mjs did.
 *
 * Break-scancode synthesis (#27): Doom8088 tracks held keys via the high bit
 * of scancodes read from port 0x60. On a release tick we fire IRQ 1 and port
 * 0x60 must return the *previous* scancode with bit 7 set.
 */
export function emitKeyboardWires() {
  const kbdPress = `if(
    style(--keyboard: 0): 0;
    style(--__1prevKeyboard: 0): 1;
    else: 0
  )`;
  // Raw wire transition back to 0. While the hold wire (--kbdHold) is 1
  // it is LATCHED, not delivered: the scancode joins the held set and no
  // break code reaches the guest — the key stays down (chords). While
  // the hold wire is 0 it is a normal delivered release.
  const kbdRawRelease = `if(
    style(--__1prevKeyboard: 0): 0;
    style(--keyboard: 0): 1;
    else: 0
  )`;
  const SLOTS = 8;
  // Per-key un-hold (owner request 2026-07-13): a release whose scancode
  // is ALREADY in the held set — i.e. tapping a held key again — delivers
  // its break code and clears the matching slot(s) instead of latching a
  // duplicate. Tap holds, tap again releases, hold mode stays on. Slot
  // equality is arithmetic (1 - min(1, abs(a - b))) because style() can't
  // compare two variables; empty slots hold 0 and real scancodes are >= 1,
  // so an empty slot never matches. These wires are style()-TESTED, and
  // they are unregistered — raw min()/calc() tokens in an unregistered
  // property never compare equal to a literal 1 — so the value must pass
  // through a typed @function (--or, returns <integer>), whose result IS
  // a computed number: the --_kbdAnyHeld convention.
  const slotEq = (i) =>
    `calc(1 - min(1, abs(var(--__1kbdHeld${i}) - var(--_kbdLatchSc))))`;
  const eqPair = (a, b) => `--or(${a}, ${b})`;
  const anyEq = eqPair(
    eqPair(eqPair(slotEq(0), slotEq(1)), eqPair(slotEq(2), slotEq(3))),
    eqPair(eqPair(slotEq(4), slotEq(5)), eqPair(slotEq(6), slotEq(7))));
  const kbdUnhold = `if(
    style(--_kbdRawRelease: 0): 0;
    style(--kbdHold: 0): 0;
    else: ${anyEq}
  )`;
  const kbdRelease = `if(
    style(--_kbdRawRelease: 0): 0;
    style(--_kbdUnhold: 1): 1;
    style(--kbdHold: 1): 0;
    else: 1
  )`;
  const kbdLatch = `if(
    style(--_kbdRawRelease: 0): 0;
    style(--_kbdUnhold: 1): 0;
    style(--kbdHold: 1): 1;
    else: 0
  )`;
  // Held-set slot flags. Append (on a latch tick) into the lowest empty
  // slot; clear (on an un-hold tick) every slot matching the released
  // scancode — clearing all matches also retires any duplicate latched
  // before un-hold existed; drain (one per drain tick) from the highest
  // occupied slot. Holes are fine: append fills the lowest EMPTY slot and
  // drain pops the highest OCCUPIED one, neither needs compaction.
  const appFlags = [];
  const clrFlags = [];
  const popFlags = [];
  for (let i = 0; i < SLOTS; i++) {
    const lowerFull = Array.from({ length: i }, (_, j) =>
      `    style(--__1kbdHeld${j}: 0): 0;`).join('\n');
    appFlags.push(`  --_kbdApp${i}: if(
    style(--_kbdLatch: 0): 0;
${lowerFull ? lowerFull + '\n' : ''}    style(--__1kbdHeld${i}: 0): 1;
    else: 0
  );`);
    clrFlags.push(`  --_kbdClr${i}: if(
    style(--_kbdUnhold: 0): 0;
    else: --or(${slotEq(i)}, 0)
  );`);
    const top = i < SLOTS - 1
      ? `    style(--__1kbdHeld${i + 1}: 0): 1;\n    else: 0`
      : `    else: 1`;
    popFlags.push(`  --_kbdPop${i}: if(
    style(--_kbdDrain: 0): 0;
    style(--__1kbdHeld${i}: 0): 0;
${top}
  );`);
  }
  const anyHeld = `--or(--or(--or(var(--__1kbdHeld0), var(--__1kbdHeld1)), --or(var(--__1kbdHeld2), var(--__1kbdHeld3))), --or(--or(var(--__1kbdHeld4), var(--__1kbdHeld5)), --or(var(--__1kbdHeld6), var(--__1kbdHeld7))))`;
  // Drain: with the hold wire down and held slots occupied, emit one
  // synthesized break code per eligible tick. Eligible = no real key
  // edge this tick (real events own port 0x60) and the previous
  // keyboard IRQ fully consumed (pending bit clear, nothing in
  // service) — this self-paces the drain to the guest ISR's speed so
  // no break code is overwritten before it is read.
  const kbdDrain = `if(
    style(--kbdHold: 1): 0;
    style(--_kbdAnyHeld: 0): 0;
    style(--_kbdPress: 1): 0;
    style(--_kbdRawRelease: 1): 0;
    style(--_kbdPicKbdBit: 1): 0;
    style(--__1picInService: 0): 1;
    else: 0
  )`;
  const popSc = Array.from({ length: SLOTS }, (_, i) =>
    `var(--__1kbdHeld${i}) * var(--_kbdPop${i})`).join(' + ');
  // Port 0x60 returns the most recent scancode (make or break) until the
  // next event. On the event tick itself, we compute the new value
  // directly; off-event ticks fall through to --__1kbdScancodeLatch,
  // which the register-dispatch default updates with the same logic so
  // the latch and the live port read agree. Without the latch the break
  // code is only readable on the single event tick — if the ISR runs
  // even one tick later (CLI clear gap, nested IRQ pending, etc.) it
  // reads scancode 0 and DOOM's key-held state never clears.
  const kbdPort60 = `if(
    style(--_kbdPress: 1): --rightShift(var(--keyboard), 8);
    style(--_kbdRelease: 1): --or(--rightShift(var(--__1prevKeyboard), 8), 128);
    style(--_kbdDrain: 1): calc(var(--_kbdPopSc) + 128);
    else: var(--__1kbdScancodeLatch)
  )`;
  return [
    `  /* press/release edge wires, the hold-wire held set, and port 0x60's latch input */`,
    `  --_kbdPress: ${kbdPress};`,
    `  --_kbdRawRelease: ${kbdRawRelease};`,
    `  --_kbdUnhold: ${kbdUnhold};`,
    `  --_kbdRelease: ${kbdRelease};`,
    `  --_kbdLatch: ${kbdLatch};`,
    `  --_kbdLatchSc: --rightShift(var(--__1prevKeyboard), 8);`,
    ...appFlags,
    ...clrFlags,
    `  --_kbdAnyHeld: ${anyHeld};`,
    `  --_kbdPicKbdBit: --bit(var(--__1picPending), 1);`,
    `  --_kbdDrain: ${kbdDrain};`,
    ...popFlags,
    `  --_kbdPopSc: calc(${popSc});`,
    `  --_kbdEdge: --or(--or(var(--_kbdPress), var(--_kbdRelease)), var(--_kbdDrain));`,
    `  --_kbdPort60: ${kbdPort60};`,
  ].join('\n');
}

/**
 * Serial mouse — a Microsoft serial mouse on an 8250 UART at COM1
 * (0x3F8, IRQ 4). Opt-in per cart (`input.mouse`).
 *
 * Input side: the #mc-N cell grid (template.mjs emitMouseCellRules)
 * drives --mouseTgt with (x<<8|y)+1 while a cell is pressed, 0 when
 * released. The machine latches the last nonzero value as the target
 * position, and treats "a cell is currently pressed" as the left
 * button being down — so a tap is a move + click + release, and a
 * double-tap is a double-click.
 *
 * The hold wire (--msHold, raised by the player's shared hold switch
 * #kb-holdmode) turns tap pairs into press-drag-release: the first
 * cell press while the wire is up latches the button down at that
 * position (--msHeldBtn), and the NEXT tap completes the drag — the
 * cursor travels there with the button still held and releases on
 * arrival (owner call 2026-07-13; release-at-target falls out of the
 * pending-edge queue, which only lets button changes ride packets
 * once the cursor is AT the target). Windows 1.x menus are the
 * canonical use — press the title, tap the item, the menu selects.
 * Dropping the wire mid-drag still releases immediately at the
 * current position. Toggling hold on/off without tapping a cell
 * presses nothing (the latch arms on the first press, not on the
 * wire edge).
 *
 * Output side: whenever the guest's estimated cursor (msCurX/msCurY —
 * integrated deltas clamped to 640×200, mirroring what the guest
 * driver itself computes) differs from the target, or the button state
 * changed, a 3-byte Microsoft-protocol packet is generated:
 *
 *   byte 1: 0x40 | LB<<5 | RB<<4 | (dy76 << 2) | dx76
 *   byte 2: dx & 0x3F        (dx/dy are 8-bit two's complement)
 *   byte 3: dy & 0x3F
 *
 * Bytes are shifted into the UART's RBR one per tick as the guest
 * consumes them (reading 0x3F8 clears data-ready; the next byte loads
 * on the following tick and re-raises IRQ 4). Deltas are clamped to
 * ±127, so a full-screen jump takes a handful of packets. Everything
 * is gated on IER bit 0 — until the guest driver enables RX
 * interrupts, no packets flow (the probe handshake is handled in the
 * OUT dispatch: an MCR write with RTS rising loads the 'M'
 * identification byte, which the driver polls for via LSR).
 *
 * Wire glossary (all standalone lines on .motherboard):
 *   --_msTouch       1 while any cell is pressed (level)
 *   --_msTouchEdge   1 on a cell press edge (0 → pressed this tick;
 *                    prev level in --msTouchPrev)
 *   --_msHeldNext    hold-latch next value (arms on the first press,
 *                    cleared by the NEXT press edge or the wire
 *                    dropping) — also --msHeldBtn's register default
 *   --_msRawBtn      1 while any cell is pressed OR the hold latch is
 *                    up (left button state)
 *   --msQuietUntil   inter-packet pacing stamp (see uartStart) — set to
 *                    cycleCount + PACKET_GAP_CYCLES on every byte load
 *   --_msRawEdge     1 on a raw button transition this tick
 *   --_msPendCur     unsent button transitions incl. this tick's
 *                    (--msPendEdges' next value is --_msPendNext)
 *   --msRawPrev      previous tick's raw button (edge detection)
 *   --_msTgt         latched target ((x<<8|y)+1; 0 until first touch)
 *   --_msTgtX/Y      decoded target position (0 when never touched)
 *   --_msDx/Dy       this packet's clamped deltas
 *   --_msDx8/Dy8     the same as mod-256 bytes (two's complement)
 *   --_msDiff        1 if a packet is needed (move or button change)
 *   --_uartStart     packet begins this tick (captures deltas, byte 1)
 *   --_uartNext      bytes 2/3 load this tick
 *   --_uartDone      packet finished (phase returns to idle)
 *   --_uartLoad      any byte loaded this tick (raises IRQ 4)
 *   --_msB1/B2/B3    the packet bytes
 *   --_uartRbrNext / --_uartDrNext / --_uartPhaseNext
 *                    the registers' default next values (also reused as
 *                    the fall-through inside the IN/OUT dispatch arms)
 *   --_uartRtsEdge   MCR write is raising RTS (bit 1) this tick — the
 *                    reset that makes a real MS mouse send 'M'
 */
// Minimum idle CYCLES between serial-mouse packets — the 1200-baud
// line rate: a real MS mouse packet is 3×11 bits at 1200 baud ≈ 27 ms
// ≈ 120K cycles at 4.77 MHz. Counted in CYCLES (guest time), not
// ticks: an idle guest sits in HLT where one tick burns hundreds of
// cycles, so a tick-based gap would stretch to guest-seconds and blow
// the double-click window. Must comfortably exceed the guest's
// per-delivery work (ISR + USER MouseEvent + cursor redraw, tens of
// thousands of cycles) — without the gap the next packet's IRQ nests
// inside the still-running handler and Windows 1.x queues button
// events at the stale pre-move position.
export const MOUSE_PACKET_GAP_CYCLES = 120000;

// --msQuietUntil: cycleCount stamp before which no new packet may
// start. Re-armed on every byte load.
export function msQuietUntilDefaultExpr() {
  return `if(
    style(--_uartLoad: 1): calc(var(--__1cycleCount) + ${MOUSE_PACKET_GAP_CYCLES});
    else: var(--__1msQuietUntil)
  )`;
}

export function emitMouseWires() {
  const msTgt = `if(
    style(--mouseTgt: 0): var(--__1msTgtLatch);
    else: var(--mouseTgt)
  )`;
  // A packet is needed when position or button differ — but only after
  // the surface has been touched at least once (msHave) and only once
  // the guest has enabled RX interrupts (IER bit 0).
  const msDiff = `calc(
    min(1,
      max(var(--_msDx), -1 * var(--_msDx))
      + max(var(--_msDy), -1 * var(--_msDy))
      + max(var(--_msBtnD), -1 * var(--_msBtnD)))
    * min(1, var(--_msTgt))
    * --bit(var(--__1uartIer), 0)
  )`;
  // Inter-packet pacing: a real MS mouse on a 1200-baud line cannot
  // start a new packet until ~25 ms after the last byte — and Windows
  // 1.x USER depends on that: its MouseEvent handler enqueues button
  // events BEFORE applying the same delivery's movement, and our
  // back-to-back packets made the next packet's IRQ nest inside the
  // still-running handler, so button events were enqueued at the STALE
  // pre-move position (verified 2026-07-13 by dumping USER's hardware
  // event queue: WM_LBUTTONDOWN queued at the previous gesture's
  // coordinates). A new packet may only start once cycleCount passes
  // --msQuietUntil (re-armed on every byte load) — see
  // MOUSE_PACKET_GAP_CYCLES for why the gap is counted in cycles.
  const quietOk = `min(1, max(0, sign(calc(var(--__1cycleCount) - var(--__1msQuietUntil) + 1))))`;
  // The --_msDiff: 0 arm short-circuits before the pacing math — the
  // phase-0 branch's product is 0 whenever --_msDiff is 0, so the value
  // is identical; on idle ticks it skips the quietOk sign/calc chain
  // AND drops the per-tick dependency on --cycleCount (which changes
  // every tick) from the idle mouse graph.
  const uartStart = `if(
    style(--__1uartDr: 1): 0;
    style(--_msDiff: 0): 0;
    style(--__1uartPhase: 0): ${quietOk};
    else: 0
  )`;
  const uartNext = `if(
    style(--__1uartDr: 1): 0;
    style(--__1uartPhase: 1): 1;
    style(--__1uartPhase: 2): 1;
    else: 0
  )`;
  const uartDone = `if(
    style(--__1uartDr: 1): 0;
    style(--__1uartPhase: 3): 1;
    else: 0
  )`;
  const rbrNext = `if(
    style(--_uartLoad: 0): var(--__1uartRbr);
    style(--__1uartPhase: 0): var(--_msB1);
    style(--__1uartPhase: 1): var(--_msB2);
    else: var(--_msB3)
  )`;
  const phaseNext = `if(
    style(--_uartLoad: 1): calc(var(--__1uartPhase) + 1);
    style(--_uartDone: 1): 0;
    else: var(--__1uartPhase)
  )`;
  return [
    `  /* --- pointing surface → packet need --- */`,
    `  --_msTouch: min(1, var(--mouseTgt));`,
    `  --_msTouchEdge: max(0, calc(var(--_msTouch) - var(--__1msTouchPrev)));`,
    `  /* hold latch: each cell PRESS EDGE toggles it (XOR, as abs(a - b)
     on two 0/1s) — first tap arms, the next tap's press clears, and
     that tap's own release then completes the drag at its position.
     Edge (not level) on both sides: level-arming would re-arm during
     the clearing tap's remaining pressed ticks. The cell being pressed
     keeps --_msRawBtn up through the clearing tap, so no spurious
     mid-tap release edge. */`,
    `  --_msHeldNext: if(style(--msHold: 0): 0; else: calc(abs(var(--__1msHeldBtn) - var(--_msTouchEdge))));`,
    `  --_msRawBtn: max(var(--_msTouch), var(--_msHeldNext));`,
    `  --_msTgt: ${msTgt};`,
    `  /* Both axes are tracked in MICKEYS (half-pixels): Windows 1.01's
     CGA mouse mapping applies deltas 2:1 in X AND Y (measured
     empirically 2026-07-13 by clicking known targets and diffing the
     drawn arrow / selection bands). Targets' pixel coordinates are
     halved here; cell centres are even pixels, so nothing is lost. */`,
    `  --_msTgtX: --rightShift(calc(var(--_msTgt) - min(1, var(--_msTgt))), 9);`,
    `  --_msTgtY: --rightShift(--and(calc(var(--_msTgt) - min(1, var(--_msTgt))), 255), 1);`,
    `  --_msDx: clamp(-127, calc(var(--_msTgtX) - var(--__1msCurX)), 127);`,
    `  --_msDy: clamp(-127, calc(var(--_msTgtY) - var(--__1msCurY)), 127);`,
    `  --_msMove: min(1, calc(max(var(--_msDx), -1 * var(--_msDx)) + max(var(--_msDy), -1 * var(--_msDy))));`,
    `  /* Button state rides the packet only once the cursor is AT the
     target — while still travelling, packets repeat the previous
     button so a tap clicks at the destination, not mid-flight.
     Raw button EDGES are queued (--msPendEdges counts unsent
     transitions, --msRawPrev detects them) and drained one per paced
     packet, so presses shorter than the packet gap — even whole
     press/release/press trains — still reach the guest as their full
     transition sequence, in order. */`,
    `  --_msRawEdge: max(calc(var(--_msRawBtn) - var(--__1msRawPrev)), calc(var(--__1msRawPrev) - var(--_msRawBtn)));`,
    `  --_msPendCur: min(15, calc(var(--__1msPendEdges) + var(--_msRawEdge)));`,
    `  /* at rest: toggle sent state while edges are owed; mid-move: repeat */`,
    `  /* pendCur = 0 collapses the polynomial to sentBtn for either
     value of --_msMove: sent*m + (sent + (1-2sent)*0)*(1-m) = sent. */`,
    `  --_msBtnRep: if(style(--_msPendCur: 0): var(--__1msSentBtn); else: calc(var(--__1msSentBtn) * var(--_msMove) + (var(--__1msSentBtn) + (1 - 2 * var(--__1msSentBtn)) * min(1, var(--_msPendCur))) * (1 - var(--_msMove))));`,
    `  --_msBtnD: calc(var(--_msBtnRep) - var(--__1msSentBtn));`,
    `  --_msPendNext: max(0, calc(var(--_msPendCur) - var(--_uartStart) * max(var(--_msBtnD), -1 * var(--_msBtnD))));`,
    `  --_msDiff: ${msDiff};`,
    `  /* --- packet sequencing --- */`,
    `  --_uartStart: ${uartStart};`,
    `  --_uartNext: ${uartNext};`,
    `  --_uartDone: ${uartDone};`,
    `  --_uartLoad: --or(var(--_uartStart), var(--_uartNext));`,
    `  /* --- Microsoft-protocol packet bytes --- */`,
    `  /* Dx8/Dy8/B1 are consumed only on --_uartStart ticks (B1 by
     --_uartRbrNext's phase-0 arm, Dx8/Dy8 by B1 and the msDxL/msDyL
     register captures, all gated on start) — dead on other ticks, so
     the guard's 0 is never observed. Chrome computes the same CSS, so
     cabinet-internal consistency is unchanged. */`,
    `  --_msDx8: if(style(--_uartStart: 0): 0; else: calc(mod(var(--_msDx) + 256, 256)));`,
    `  --_msDy8: if(style(--_uartStart: 0): 0; else: calc(mod(var(--_msDy) + 256, 256)));`,
    `  --_msB1: if(style(--_uartStart: 0): 0; else: calc(64 + var(--_msBtnRep) * 32 + --rightShift(var(--_msDy8), 6) * 4 + --rightShift(var(--_msDx8), 6)));`,
    `  --_msB2: --and(var(--__1msDxL), 63);`,
    `  --_msB3: --and(var(--__1msDyL), 63);`,
    `  /* --- register next-values (shared with the IN/OUT dispatch arms) --- */`,
    `  --_uartRbrNext: ${rbrNext};`,
    `  --_uartDrNext: --or(var(--__1uartDr), var(--_uartLoad));`,
    `  --_uartPhaseNext: ${phaseNext};`,
    `  --_uartRtsEdge: calc(min(1, --and(--lowerBytes(var(--__1AX), 8), 2)) * (1 - --bit(var(--__1uartMcr), 1)));`,
  ].join('\n');
}

/**
 * PIC arbitration: which IRQ (if any) fires this tick. Consumed by the
 * CPU rule's register overrides (see DispatchTable.emitRegisterDispatch)
 * — when --_irqActive is 1 the fetched instruction is refused and the
 * FLAGS/CS/IP frame is pushed instead.
 */
export function emitIRQArbitration(mouse = false) {
  const picEffective = `if(
    style(--__1picInService: 0): --and(var(--__1picPending), --not(var(--__1picMask)));
    else: 0
  )`;
  if (!mouse) {
    return [
      `  /* which unmasked pending IRQ wins this tick (IRQ 0 outranks IRQ 1) */`,
      `  --_picEffective: ${picEffective};`,
      `  --_ifFlag: --bit(var(--__1flags), 9);`,
      `  --_irqActive: if(style(--_ifFlag: 0): 0; style(--_picEffective: 0): 0; else: 1);`,
      `  --_irq0Pending: --and(var(--_picEffective), 1);`,
      `  --picVector: if(style(--_irq0Pending: 1): 8; else: 9);`,
      `  --_irqBit: if(style(--_irq0Pending: 1): 1; else: 2);`,
    ].join('\n');
  }
  // Serial-mouse cabinets have a third IRQ source (IRQ 4, the COM1
  // UART), so the acknowledge mux picks the lowest set bit of the
  // effective set — the real 8259 priority order — over the bits that
  // can actually be pending here (0 = PIT, 1 = keyboard, 4 = UART).
  // Non-mouse cabinets keep the two-way mux above: same semantics for
  // their two sources, fewer per-tick wires on the hot path.
  return [
    `  /* which unmasked pending IRQ wins this tick (lowest bit = highest priority) */`,
    `  --_picEffective: ${picEffective};`,
    `  --_ifFlag: --bit(var(--__1flags), 9);`,
    `  --_irqActive: if(style(--_ifFlag: 0): 0; style(--_picEffective: 0): 0; else: 1);`,
    `  --_irq0Pending: --and(var(--_picEffective), 1);`,
    `  --_irq1Pending: --bit(var(--_picEffective), 1);`,
    `  --picVector: if(style(--_irq0Pending: 1): 8; style(--_irq1Pending: 1): 9; else: 12);`,
    `  --_irqBit: if(style(--_irq0Pending: 1): 1; style(--_irq1Pending: 1): 2; else: 16);`,
  ].join('\n');
}

/**
 * I/O port instructions: IN and OUT.
 *
 * Reads:
 *   Port 0x21 (PIC data) returns --picMask. Programs that do the standard
 *     read-modify-write (in al,0x21; and al,~bit; out 0x21,al) rely on this.
 *   Port 0x60 (keyboard) returns the scancode (high byte of --keyboard).
 *   Port 0x3DA (VGA input status 1) returns a byte whose bit 3 is the
 *     vertical retrace signal and bit 0 is display-enable (not in vsync).
 *     Both are derived from --cycleCount on a 70 Hz / 4.77 MHz timebase.
 *   All other ports return 0.
 *
 * Writes (state lives in --picMask/--picInService/--pitMode/--pitReload/
 * --pitCounter/--pitWriteState — declared in template.mjs STATE_VARS):
 *   Port 0x20 (PIC command): EOI clears the lowest-priority in-service bit.
 *     Phase 1 treats any write as a non-specific EOI (Doom8088 only sends
 *     0x20, which is the correct encoding).
 *   Port 0x21 (PIC data):    writes AL to --picMask.
 *   Port 0x40 (PIT ch0 data): lo/hi sequenced write to --pitReload; the
 *     hi-byte write also loads --pitCounter.
 *   Port 0x43 (PIT control): when the control word selects channel 0 with
 *     a write access-mode (bits 7-6 == 00, bits 5-4 != 00), sets --pitMode
 *     from bits 3-1 of AL and resets reload/counter/writeState. Control
 *     words for ch1/ch2 and ch0 counter-latch commands hold all state —
 *     we only track channel 0, and a ch2 speaker write must not stop it.
 *
 * Unhandled ports (speaker 0x61, CRTC 0x3D4/0x3D5, secondary PIC 0xA0/0xA1,
 * PIT ch1/ch2 0x41/0x42) remain no-ops. DAC ports 0x3C7/0x3C8/0x3C9 are
 * handled separately below (see VGA DAC block).
 *
 * Dispatch entries on OUT opcodes fall back to var(--__1NAME) when the port
 * doesn't match — the entry fires on every OUT of this opcode shape, so it
 * must explicitly hold the state for unrelated ports.
 *
 * Opcode shapes:
 *   IN AL, imm8  (0xE4): 2-byte, port in q1.
 *   IN AX, imm8  (0xE5): 2-byte, port in q1.
 *   OUT imm8, AL (0xE6): 2-byte, port in q1.
 *   OUT imm8, AX (0xE7): 2-byte, port in q1, AX written (no PIC/PIT effect).
 *   IN AL, DX   (0xEC): 1-byte, port in --__1DX.
 *   IN AX, DX   (0xED): 1-byte, port in --__1DX.
 *   OUT DX, AL  (0xEE): 1-byte, port in --__1DX.
 *   OUT DX, AX  (0xEF): 1-byte, port in --__1DX, no PIC/PIT effect.
 */
export function emitIO(dispatch, { mouse = false } = {}) {
  // --- VGA input status 1 (port 0x3DA = 986) ---
  //
  // Bit 3: vertical retrace (1 while beam is retracing top, 0 while drawing).
  // Bit 0: display enable — here, "not in vertical retrace". Real hardware
  //        also sets this during horizontal blanking, but that's per-scanline
  //        timing we don't simulate. Close enough for the common
  //        `in al,0x3DA; test al,8; jnz retrace_wait` pattern.
  // Other bits: 0.
  //
  // Cadence derived from cycleCount:
  //   CYCLES_PER_FRAME = 68182  (4.77 MHz / 70 Hz)
  //   RETRACE_CYCLES   = 3409   (~5% of frame — the vsync window)
  //   in_retrace = mod(cc, CYCLES_PER_FRAME) < RETRACE_CYCLES
  //
  // Expressed without comparison operators: `sign(retrace - mod(cc, frame))`
  // is +1 when in retrace, -1 when drawing, 0 exactly at the boundary.
  // `max(0, sign(...))` clamps to {0, 1}. The 1-cycle boundary glitch (both
  // bits 0 at `mod == RETRACE`) is harmless.
  //
  // Independent of vsyncMode — the program always sees the same port
  // behaviour. The player's paint cadence layers on top of this; it does
  // not change what the CPU observes when it reads 0x3DA.
  const VSYNC_RETRACE_BIT3 =
    `calc(max(0, sign(calc(3409 - mod(var(--__1cycleCount), 68182)))) * 8)`;
  const VSYNC_DISPENA_BIT0 =
    `max(0, sign(calc(mod(var(--__1cycleCount), 68182) - 3409)))`;
  const VGA_STATUS1 = `calc(${VSYNC_RETRACE_BIT3} + ${VSYNC_DISPENA_BIT0})`;

  // DAC palette storage — 768 bytes at the linear address below (outside
  // the 1 MB address space, accessed via --readMem/addMemWrite). See the
  // OUT 0x3C8/0x3C9 block further down for the full protocol.
  const DAC_LINEAR = 0x100000;

  // --- Reads ---

  // IN AL, imm8 (0xE4):
  //   port 0x21  → picMask (so programs can read-modify-write the mask)
  //   port 0x60  → scancode = rightShift(keyboard, 8)
  //   port 0x3DA → VGA input status 1 (vsync bit 3 + display-enable bit 0)
  //   other      → 0
  // DAC read byte: mem[DAC_LINEAR + dacReadIndex*3 + dacReadSubIndex].
  // Re-computed per-opcode; CSS evaluates it lazily inside the if() so
  // ports other than 0x3C9 never trigger the memory read.
  const dacReadByte = `--readMem(calc(${DAC_LINEAR} + var(--__1dacReadIndex) * 3 + var(--__1dacReadSubIndex)))`;

  // 8250 UART at COM1 (serial-mouse cabinets only). Ports, decimal:
  //   0x3F8=1016 RBR (rx byte)      0x3F9=1017 IER
  //   0x3FA=1018 IIR                0x3FB=1019 LCR (ignored; reads 0)
  //   0x3FC=1020 MCR                0x3FD=1021 LSR (0x60 | data-ready)
  //   0x3FE=1022 MSR (CTS|DSR)
  // DLAB is ignored: the one guest this serves (Windows 1.x MOUSE.DRV)
  // writes the divisor before enabling IER, so the stray DLL/DLM writes
  // land harmlessly on RBR-write (dropped) and IER (overwritten by the
  // real IER write that follows).
  // Ports above 0xFF are unreachable via IN/OUT imm8, so only the DX
  // forms carry UART arms.
  const uartInDx = (dxVar) => mouse
    ? `style(${dxVar}: 1016): var(--__1uartRbr); ` +
      `style(${dxVar}: 1017): var(--__1uartIer); ` +
      `style(${dxVar}: 1018): calc(1 + var(--__1uartDr) * 3); ` +
      `style(${dxVar}: 1020): var(--__1uartMcr); ` +
      `style(${dxVar}: 1021): calc(96 + var(--__1uartDr)); ` +
      `style(${dxVar}: 1022): 48; `
    : '';

  dispatch.addEntry('AX', 0xE4,
    `--mergelow(var(--__1AX), if(style(--q1: 33): var(--__1picMask); style(--q1: 96): var(--_kbdPort60); style(--q1: 986): ${VGA_STATUS1}; style(--q1: 967): 0; style(--q1: 968): var(--__1dacWriteIndex); style(--q1: 969): ${dacReadByte}; else: 0))`,
    `IN AL, imm8 (0x21=picMask, 0x60=kbdPort60, 0x3DA=vgaStatus1, 0x3C7/8/9=DAC)`);
  dispatch.addEntry('IP', 0xE4, `calc(var(--__1IP) + 2)`, `IN AL, imm8`);

  // IN AX, imm8 (0xE5):
  //   port 0x21  → picMask
  //   port 0x60  → full keyboard word
  //   port 0x3DA → VGA input status 1 (low byte only; high byte is 0)
  //   DAC ports  → same byte-read as 0xE4 in low, 0 in high (games that
  //                 do `in ax, 0x3C9` are buggy but real; mask to low byte)
  dispatch.addEntry('AX', 0xE5,
    `if(style(--q1: 33): var(--__1picMask); style(--q1: 96): var(--__1keyboard); style(--q1: 986): ${VGA_STATUS1}; style(--q1: 967): 0; style(--q1: 968): var(--__1dacWriteIndex); style(--q1: 969): ${dacReadByte}; else: 0)`,
    `IN AX, imm8 (0x21=picMask, 0x60=keyboard, 0x3DA=vgaStatus1, 0x3C7/8/9=DAC)`);
  dispatch.addEntry('IP', 0xE5, `calc(var(--__1IP) + 2)`, `IN AX, imm8`);

  // IN AL, DX (0xEC):
  //   DX=0x21  → picMask
  //   DX=0x60  → scancode
  //   DX=0x3DA → VGA input status 1
  //   DX=0x3C7 → 0 (DAC state byte: 0=write-ready, 3=read-ready; we don't
  //              distinguish — returning 0 keeps games happy)
  //   DX=0x3C8 → current write index
  //   DX=0x3C9 → DAC byte at [readIndex*3 + readSubIndex]
  dispatch.addEntry('AX', 0xEC,
    `--mergelow(var(--__1AX), if(style(--__1DX: 33): var(--__1picMask); style(--__1DX: 96): var(--_kbdPort60); style(--__1DX: 986): ${VGA_STATUS1}; style(--__1DX: 967): 0; style(--__1DX: 968): var(--__1dacWriteIndex); style(--__1DX: 969): ${dacReadByte}; ${uartInDx('--__1DX')}else: 0))`,
    `IN AL, DX (0x21=picMask, 0x60=kbdPort60, 0x3DA=vgaStatus1, 0x3C7/8/9=DAC${mouse ? ', 0x3F8-0x3FE=UART' : ''})`);
  dispatch.addEntry('IP', 0xEC, `calc(var(--__1IP) + 1)`, `IN AL, DX`);

  // IN AX, DX (0xED):
  //   DX=0x21  → picMask
  //   DX=0x60  → full keyboard word
  //   DX=0x3DA → VGA input status 1
  //   DX=0x3C7 → 0; DX=0x3C8 → write index; DX=0x3C9 → DAC byte (low)
  dispatch.addEntry('AX', 0xED,
    `if(style(--__1DX: 33): var(--__1picMask); style(--__1DX: 96): var(--__1keyboard); style(--__1DX: 986): ${VGA_STATUS1}; style(--__1DX: 967): 0; style(--__1DX: 968): var(--__1dacWriteIndex); style(--__1DX: 969): ${dacReadByte}; ${uartInDx('--__1DX')}else: 0)`,
    `IN AX, DX (0x21=picMask, 0x60=keyboard, 0x3DA=vgaStatus1, 0x3C7/8/9=DAC${mouse ? ', 0x3F8-0x3FE=UART' : ''})`);
  dispatch.addEntry('IP', 0xED, `calc(var(--__1IP) + 1)`, `IN AX, DX`);

  // --- Writes ---

  dispatch.addEntry('IP', 0xE6, `calc(var(--__1IP) + 2)`, `OUT imm8, AL`);
  dispatch.addEntry('IP', 0xE7, `calc(var(--__1IP) + 2)`, `OUT imm8, AX`);
  dispatch.addEntry('IP', 0xEE, `calc(var(--__1IP) + 1)`, `OUT DX, AL`);
  dispatch.addEntry('IP', 0xEF, `calc(var(--__1IP) + 1)`, `OUT DX, AX`);

  // AL, inline (can't use --AL alias in the state-var expressions below
  // because we read it across many different --__1AX values — the alias
  // would need to be re-derived per tick anyway and the cost is identical).
  const al = `--lowerBytes(var(--__1AX), 8)`;

  // Non-specific EOI on OUT 0x20 (any value). Clear the lowest-priority
  // in-service bit using the (x & (x-1)) bit-clear-lowest trick. When
  // picInService=0 this yields 0 (no effect), which is correct.
  const picEoiExpr = `--and(var(--__1picInService), calc(var(--__1picInService) - 1))`;

  // picInService: OUT to 0x20 → EOI. Other ports → hold.
  dispatch.addEntry('picInService', 0xE6,
    `if(style(--q1: 32): ${picEoiExpr}; else: var(--__1picInService))`,
    `OUT 0x20: non-specific EOI`);
  dispatch.addEntry('picInService', 0xEE,
    `if(style(--__1DX: 32): ${picEoiExpr}; else: var(--__1picInService))`,
    `OUT DX=0x20: non-specific EOI`);

  // picMask: OUT to 0x21 → AL becomes the new mask. Other ports → hold.
  dispatch.addEntry('picMask', 0xE6,
    `if(style(--q1: 33): ${al}; else: var(--__1picMask))`,
    `OUT 0x21: set PIC mask`);
  dispatch.addEntry('picMask', 0xEE,
    `if(style(--__1DX: 33): ${al}; else: var(--__1picMask))`,
    `OUT DX=0x21: set PIC mask`);

  // OUT 0x43 (PIT control word) — channel decode. Only a control word
  // that (a) selects channel 0 (bits 7-6 == 00) AND (b) has a non-latch
  // access mode (bits 5-4 != 00; 00 is "counter latch", which snapshots
  // the count for reading without disturbing it) may touch our channel-0
  // state. Control words for ch1/ch2 must hold everything: PC-speaker
  // effects send 0xB6 (ch2, mode 3) while the program's whole timebase
  // is ch0 IRQ 0s — zeroing ch0's reload on that write kills the timer
  // interrupt and wedges any wait-for-INT8-counter loop (PoP's landing
  // thud froze the game this way, 2026-07-05).
  // pitCh0Write is 1 for a ch0 write config, else 0 — used as an
  // arithmetic gate since style() can't test AL's bit fields.
  const pitCh0Write = `(max(0, 1 - --rightShift(${al}, 6)) * min(1, --and(${al}, 48)))`;

  // pitMode: OUT to 0x43 with ch0-write → bits 3-1 of AL; else hold.
  const pitModeExpr = `--lowerBytes(--rightShift(--and(${al}, 14), 1), 3)`;
  const pitModeGated =
    `calc(var(--__1pitMode) + (${pitModeExpr} - var(--__1pitMode)) * ${pitCh0Write})`;
  dispatch.addEntry('pitMode', 0xE6,
    `if(style(--q1: 67): ${pitModeGated}; else: var(--__1pitMode))`,
    `OUT 0x43: PIT control word`);
  dispatch.addEntry('pitMode', 0xEE,
    `if(style(--__1DX: 67): ${pitModeGated}; else: var(--__1pitMode))`,
    `OUT DX=0x43: PIT control word`);

  // pitWriteState: toggled by OUT 0x40, reset by OUT 0x43 (ch0 write config
  // only). Hold otherwise.
  const pitWriteStateGated = `calc(var(--__1pitWriteState) * (1 - ${pitCh0Write}))`;
  dispatch.addEntry('pitWriteState', 0xE6,
    `if(style(--q1: 67): ${pitWriteStateGated}; style(--q1: 64): calc(1 - var(--__1pitWriteState)); else: var(--__1pitWriteState))`,
    `OUT 0x43/0x40: PIT writeState`);
  dispatch.addEntry('pitWriteState', 0xEE,
    `if(style(--__1DX: 67): ${pitWriteStateGated}; style(--__1DX: 64): calc(1 - var(--__1pitWriteState)); else: var(--__1pitWriteState))`,
    `OUT DX=0x43/0x40: PIT writeState`);

  // pitReload: OUT 0x43 (ch0 write config) resets to 0. OUT 0x40 with
  // writeState=0 sets lo byte, writeState=1 sets hi byte. Hold otherwise.
  const pitReloadGated = `calc(var(--__1pitReload) * (1 - ${pitCh0Write}))`;
  const pitReloadImm = `if(
    style(--q1: 67): ${pitReloadGated};
    style(--q1: 64) and style(--__1pitWriteState: 0): calc(--and(var(--__1pitReload), 65280) + ${al});
    style(--q1: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);
    else: var(--__1pitReload)
  )`;
  const pitReloadDx = `if(
    style(--__1DX: 67): ${pitReloadGated};
    style(--__1DX: 64) and style(--__1pitWriteState: 0): calc(--and(var(--__1pitReload), 65280) + ${al});
    style(--__1DX: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);
    else: var(--__1pitReload)
  )`;
  dispatch.addEntry('pitReload', 0xE6, pitReloadImm, `OUT 0x40/0x43: PIT reload`);
  dispatch.addEntry('pitReload', 0xEE, pitReloadDx, `OUT DX=0x40/0x43: PIT reload`);

  // pitCounter: OUT 0x43 (ch0 write config) resets to 0; other 0x43 words
  // hold the count (pausing the countdown for that one tick — harmless
  // drift, and simpler than threading the countdown through the gate).
  // OUT 0x40 with writeState=1 loads the new full reload into the counter
  // (matches real PIT behavior — the counter starts ticking only after
  // both bytes are written). On OUT to any other port (e.g. 0x20, 0x21),
  // fall through to the normal per-tick countdown — the PIT must keep
  // running while the program is talking to other devices.
  const pitTick = pitCounterDefaultExpr();
  const pitCounterGated = `calc(var(--__1pitCounter) * (1 - ${pitCh0Write}))`;
  const pitCounterImm = `if(
    style(--q1: 67): ${pitCounterGated};
    style(--q1: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);
    else: ${pitTick}
  )`;
  const pitCounterDx = `if(
    style(--__1DX: 67): ${pitCounterGated};
    style(--__1DX: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);
    else: ${pitTick}
  )`;
  dispatch.addEntry('pitCounter', 0xE6, pitCounterImm, `OUT 0x40/0x43: PIT counter load`);
  dispatch.addEntry('pitCounter', 0xEE, pitCounterDx, `OUT DX=0x40/0x43: PIT counter load`);

  // --- VGA DAC (ports 0x3C8 write-index, 0x3C9 data) ---
  //
  // Real-hardware DAC protocol:
  //   OUT 0x3C8, n        set write index to n, reset sub-index to 0
  //   OUT 0x3C9, R        store R at palette[n], sub-index -> 1
  //   OUT 0x3C9, G        store G at palette[n], sub-index -> 2
  //   OUT 0x3C9, B        store B at palette[n], sub-index -> 0, n -> n+1
  // A program typically sets the index once, then writes 3*N bytes in a loop.
  //
  // We shadow the 256*3 = 768 palette bytes to out-of-1MB linear addresses
  // (kiln/memory.mjs DAC_LINEAR). Calcite reads them back when rendering the
  // Mode 13h framebuffer. Values are stored as-is (6-bit 0..63); the frame-
  // buffer renderer does the 6-to-8-bit expansion.
  //
  // Port 0x3C7 (DAC read index) and IN 0x3C9 (read DAC byte) are both wired
  // below. Games that read the palette back — e.g. palette-fade effects
  // that re-derive their target palette from the live DAC, or screensavers
  // that blend between whatever the previous program left and a new
  // palette — use the sequence OUT 0x3C7, n; IN 0x3C9; IN 0x3C9; IN 0x3C9.
  // OUT 0x3C7 mirrors OUT 0x3C8 except it sets the *read* cursor.
  // (DAC_LINEAR is declared above the IN handlers so the dacReadByte
  // helper can reference it — both reads and writes share that address.)

  // OUT 0x3C8 — set write index, reset sub-index.
  // Written as "968" and "969" in CSS since style() takes integer literals.
  dispatch.addEntry('dacWriteIndex', 0xE6,
    `if(style(--q1: 968): ${al}; style(--q1: 969) and style(--__1dacSubIndex: 2): calc(var(--__1dacWriteIndex) + 1); else: var(--__1dacWriteIndex))`,
    `OUT 0x3C8: set DAC write index; 0x3C9: auto-advance on wrap`);
  dispatch.addEntry('dacWriteIndex', 0xEE,
    `if(style(--__1DX: 968): ${al}; style(--__1DX: 969) and style(--__1dacSubIndex: 2): calc(var(--__1dacWriteIndex) + 1); else: var(--__1dacWriteIndex))`,
    `OUT DX=0x3C8: set DAC write index; DX=0x3C9: auto-advance on wrap`);

  // dacSubIndex: OUT 0x3C8 resets to 0. OUT 0x3C9 advances (0→1→2→0).
  // OUT 0x3C7 also resets — programs that transition from reading to
  // writing the DAC (rare, but spec-legal) expect a clean slate.
  dispatch.addEntry('dacSubIndex', 0xE6,
    `if(style(--q1: 968): 0; style(--q1: 967): 0; style(--q1: 969) and style(--__1dacSubIndex: 2): 0; style(--q1: 969): calc(var(--__1dacSubIndex) + 1); else: var(--__1dacSubIndex))`,
    `OUT 0x3C7/0x3C8/0x3C9: DAC write sub-index state`);
  dispatch.addEntry('dacSubIndex', 0xEE,
    `if(style(--__1DX: 968): 0; style(--__1DX: 967): 0; style(--__1DX: 969) and style(--__1dacSubIndex: 2): 0; style(--__1DX: 969): calc(var(--__1dacSubIndex) + 1); else: var(--__1dacSubIndex))`,
    `OUT DX=0x3C7/0x3C8/0x3C9: DAC write sub-index state`);

  // Read cursor: OUT 0x3C7 loads AL into dacReadIndex and resets the read
  // sub-index to 0. Three successful IN reads of 0x3C9 advance the sub-
  // index 0→1→2→0 and on the wrap also bump dacReadIndex by 1.
  //
  // OUT 0x3C7 → index := AL
  dispatch.addEntry('dacReadIndex', 0xE6,
    `if(style(--q1: 967): ${al}; style(--q1: 971) and style(--__1dacReadSubIndex: 2): calc(var(--__1dacReadIndex) + 1); else: var(--__1dacReadIndex))`,
    `OUT 0x3C7: set DAC read index; IN 0x3C9 auto-advance on wrap`);
  dispatch.addEntry('dacReadIndex', 0xEE,
    `if(style(--__1DX: 967): ${al}; else: var(--__1dacReadIndex))`,
    `OUT DX=0x3C7: set DAC read index`);
  // IN AL, imm8 (0xE4): port 0x3C9 advances the read cursor on wrap.
  // We use 971 as the sentinel "imm=0x3C9 AND this is an IN" — but the
  // port value in --q1 is just 0x3C9 (969). Disambiguate with the opcode
  // itself: addEntry is per-opcode, so this branch only fires on 0xE4.
  dispatch.addEntry('dacReadIndex', 0xE4,
    `if(style(--q1: 969) and style(--__1dacReadSubIndex: 2): calc(var(--__1dacReadIndex) + 1); else: var(--__1dacReadIndex))`,
    `IN AL, 0x3C9: DAC read cursor auto-advance on wrap`);
  dispatch.addEntry('dacReadIndex', 0xEC,
    `if(style(--__1DX: 969) and style(--__1dacReadSubIndex: 2): calc(var(--__1dacReadIndex) + 1); else: var(--__1dacReadIndex))`,
    `IN AL, DX=0x3C9: DAC read cursor auto-advance on wrap`);

  // dacReadSubIndex: OUT 0x3C7 resets to 0. IN 0x3C9 advances (0→1→2→0).
  // OUT 0x3C8 also resets (read-to-write transition — spec-legal to reuse
  // the sub-index state).
  dispatch.addEntry('dacReadSubIndex', 0xE6,
    `if(style(--q1: 967): 0; style(--q1: 968): 0; else: var(--__1dacReadSubIndex))`,
    `OUT 0x3C7/0x3C8: reset DAC read sub-index`);
  dispatch.addEntry('dacReadSubIndex', 0xEE,
    `if(style(--__1DX: 967): 0; style(--__1DX: 968): 0; else: var(--__1dacReadSubIndex))`,
    `OUT DX=0x3C7/0x3C8: reset DAC read sub-index`);
  dispatch.addEntry('dacReadSubIndex', 0xE4,
    `if(style(--q1: 969) and style(--__1dacReadSubIndex: 2): 0; style(--q1: 969): calc(var(--__1dacReadSubIndex) + 1); else: var(--__1dacReadSubIndex))`,
    `IN AL, 0x3C9: advance DAC read sub-index`);
  dispatch.addEntry('dacReadSubIndex', 0xEC,
    `if(style(--__1DX: 969) and style(--__1dacReadSubIndex: 2): 0; style(--__1DX: 969): calc(var(--__1dacReadSubIndex) + 1); else: var(--__1dacReadSubIndex))`,
    `IN AL, DX=0x3C9: advance DAC read sub-index`);

  // OUT 0x3C9 — write a byte to DAC_LINEAR + writeIndex*3 + subIndex.
  // The address expression evaluates to -1 (unused-slot sentinel) on any
  // other opcode/port, so this slot is a no-op outside DAC writes.
  // Also mask AL to 6 bits (0..63) — real VGA hardware truncates the DAC
  // value to 6 bits; programs that write 0..255 get the low 6 bits.
  const dacAddrImm = `if(style(--q1: 969): calc(${DAC_LINEAR} + var(--__1dacWriteIndex) * 3 + var(--__1dacSubIndex)); else: -1)`;
  const dacAddrDx  = `if(style(--__1DX: 969): calc(${DAC_LINEAR} + var(--__1dacWriteIndex) * 3 + var(--__1dacSubIndex)); else: -1)`;
  const dacVal     = `--and(${al}, 63)`;
  dispatch.addMemWrite(0xE6, dacAddrImm, dacVal, `OUT 0x3C9: DAC byte (6-bit)`);
  dispatch.addMemWrite(0xEE, dacAddrDx,  dacVal, `OUT DX=0x3C9: DAC byte (6-bit)`);

  // --- CGA palette mode register (port 0x3D9 = 985) ---
  //
  // OUT 0x3D9, AL sets the CGA palette register. Layout:
  //   bits 3..0: border colour in text modes / colour 0 in 320x200 gfx
  //   bit 4    : intensity (bright vs dark palette)
  //   bit 5    : palette set select
  //                palette 0 → green/red/yellow   (colours 1/2/3)
  //                palette 1 → cyan/magenta/white (colours 1/2/3)
  //   bits 6..7: ignored
  //
  // CSS-DOS doesn't interpret this in CSS — the player-side decoder
  // consumes the raw byte. We shadow it to linear 0x04F3 (BDA intra-app
  // area, just past the requested-video-mode shadow at 0x04F2) so
  // calcite's read_memory_range can surface it to JS.
  const CGA_PALETTE_REG_ADDR = 0x04F3;
  const cgaPalAddrImm = `if(style(--q1: 985): ${CGA_PALETTE_REG_ADDR}; else: -1)`;
  const cgaPalAddrDx  = `if(style(--__1DX: 985): ${CGA_PALETTE_REG_ADDR}; else: -1)`;
  dispatch.addMemWrite(0xE6, cgaPalAddrImm, al, `OUT 0x3D9: CGA palette mode register`);
  dispatch.addMemWrite(0xEE, cgaPalAddrDx,  al, `OUT DX=0x3D9: CGA palette mode register`);

  // --- 8250 UART register effects (serial-mouse cabinets only) ---
  //
  // The UART registers' per-tick defaults are the --_uart*Next wires
  // (see emitMouseWires + the customDefaults wiring in emit-css.mjs);
  // these dispatch entries layer the guest-visible side effects on top.
  // Every entry's else-arm repeats the default so a load can still land
  // on a tick whose instruction happens to be an unrelated IN/OUT.
  //
  //   OUT DX=0x3F9 (1017): AL → IER. (DLAB ignored — see the UART note
  //     above; the mouse driver's divisor write lands here harmlessly
  //     before the real IER write.)
  //   OUT DX=0x3FC (1020): AL → MCR. An RTS rising edge (bit 1, 0→1) is
  //     the mouse-reset handshake: load the 'M' (0x4D=77) identification
  //     byte, raise data-ready, reset the packet phase — exactly what a
  //     real Microsoft serial mouse answers, and what MOUSE.DRV polls
  //     LSR for during its probe.
  //   IN  DX=0x3F8 (1016): reading RBR clears data-ready; the next
  //     packet byte (if any) loads on a following tick and re-raises
  //     IRQ 4.
  if (mouse) {
    dispatch.addEntry('uartIer', 0xEE,
      `if(style(--__1DX: 1017): ${al}; else: var(--__1uartIer))`,
      `OUT DX=0x3F9: UART IER`);
    dispatch.addEntry('uartMcr', 0xEE,
      `if(style(--__1DX: 1020): ${al}; else: var(--__1uartMcr))`,
      `OUT DX=0x3FC: UART MCR`);
    dispatch.addEntry('uartRbr', 0xEE,
      `if(style(--__1DX: 1020): calc(var(--_uartRbrNext) * (1 - var(--_uartRtsEdge)) + 77 * var(--_uartRtsEdge)); else: var(--_uartRbrNext))`,
      `OUT DX=0x3FC RTS rising: mouse reset answers 'M'`);
    dispatch.addEntry('uartDr', 0xEE,
      `if(style(--__1DX: 1020): max(var(--_uartDrNext), var(--_uartRtsEdge)); else: var(--_uartDrNext))`,
      `OUT DX=0x3FC RTS rising: 'M' is ready`);
    dispatch.addEntry('uartPhase', 0xEE,
      `if(style(--__1DX: 1020): calc(var(--_uartPhaseNext) * (1 - var(--_uartRtsEdge))); else: var(--_uartPhaseNext))`,
      `OUT DX=0x3FC RTS rising: reset packet phase`);
    dispatch.addEntry('uartDr', 0xEC,
      `if(style(--__1DX: 1016): 0; else: var(--_uartDrNext))`,
      `IN AL, DX=0x3F8: reading RBR clears data-ready`);
    dispatch.addEntry('uartDr', 0xED,
      `if(style(--__1DX: 1016): 0; else: var(--_uartDrNext))`,
      `IN AX, DX=0x3F8: reading RBR clears data-ready`);
  }
}

/**
 * XLAT (0xD7): AL = mem[DS:BX + AL]. Table lookup.
 */
export function emitXLAT(dispatch) {
  dispatch.addEntry('AX', 0xD7,
    `--mergelow(var(--__1AX), var(--_xlatByte))`,
    `XLAT`);
  dispatch.addEntry('IP', 0xD7, `calc(var(--__1IP) + 1)`, `XLAT`);
}

/**
 * INT 3 (0xCC): software breakpoint — hardcoded interrupt 3, 1-byte instruction.
 * Same as INT 0xCD but interrupt number = 3, return IP = IP + 1.
 */
export function emitINT3(dispatch) {
  dispatch.addEntry('SP', 0xCC, `--lowerBytes(calc(var(--__1SP) - 6 + 65536), 16)`, `INT 3 (SP-=6)`);

  // Load new IP from IVT[3*4] = IVT[12]
  dispatch.addEntry('IP', 0xCC,
    `--read2(12)`,
    `INT 3 load IP from IVT`);

  // Load new CS from IVT[3*4+2] = IVT[14]
  dispatch.addEntry('CS', 0xCC,
    `--read2(14)`,
    `INT 3 load CS from IVT`);

  // Clear IF (bit 9) and TF (bit 8): flags & 0xFCFF = flags & 64767
  dispatch.addEntry('flags', 0xCC,
    `--and(var(--__1flags), 64767)`,
    `INT 3 clear IF+TF`);

  const retIP = `calc(var(--__1IP) + 1)`;
  // Wrap SP-K to 16 bits before adding to SS*16 — same SP=0 wrap fix
  // used in stack.mjs and control.mjs (CALL/INT/PUSH).
  const sa = (k) => `calc(var(--__1SS) * 16 + --lowerBytes(calc(var(--__1SP) - ${k} + 65536), 16))`;

  // Push FLAGS at SP-2/SP-1 (highest address, pushed first)
  dispatch.addMemWrite(0xCC,
    sa(2),
    `--lowerBytes(var(--__1flags), 8)`,
    `INT 3 push FLAGS lo`);
  dispatch.addMemWrite(0xCC,
    sa(1),
    `--rightShift(var(--__1flags), 8)`,
    `INT 3 push FLAGS hi`);

  // Push CS at SP-4/SP-3
  dispatch.addMemWrite(0xCC,
    sa(4),
    `--lowerBytes(var(--__1CS), 8)`,
    `INT 3 push CS lo`);
  dispatch.addMemWrite(0xCC,
    sa(3),
    `--rightShift(var(--__1CS), 8)`,
    `INT 3 push CS hi`);

  // Push return IP at SP-6/SP-5 (lowest address, pushed last)
  dispatch.addMemWrite(0xCC,
    sa(6),
    `--lowerBytes(${retIP}, 8)`,
    `INT 3 push IP lo`);
  dispatch.addMemWrite(0xCC,
    sa(5),
    `--rightShift(${retIP}, 8)`,
    `INT 3 push IP hi`);
}

/**
 * INTO (0xCE): interrupt on overflow. If OF (bit 11) is set, trigger INT 4.
 * Otherwise just advance IP by 1.
 */
export function emitINTO(dispatch) {
  // OF = bit 11 of flags. Use arithmetic mux since --_of isn't a decode property.
  // ofBit is 0 or 1. Arithmetic: of*trueVal + (1-of)*falseVal
  const ofBit = `--bit(var(--__1flags), 11)`;
  const ssBase = `calc(var(--__1SS) * 16)`;
  const retIP = `calc(var(--__1IP) + 1)`;

  // SP: if OF, SP -= 6; else unchanged. Wrap to 16 bits for the OF=1 case.
  dispatch.addEntry('SP', 0xCE,
    `calc(${ofBit} * --lowerBytes(calc(var(--__1SP) - 6 + 65536), 16) + (1 - ${ofBit}) * var(--__1SP))`,
    `INTO (SP-=6 if OF)`);

  // IP: if OF, load from IVT[16]; else IP + 1
  dispatch.addEntry('IP', 0xCE,
    `calc(${ofBit} * --read2(16) + (1 - ${ofBit}) * (var(--__1IP) + 1))`,
    `INTO load IP`);

  // CS: if OF, load from IVT[18]; else unchanged
  dispatch.addEntry('CS', 0xCE,
    `calc(${ofBit} * --read2(18) + (1 - ${ofBit}) * var(--__1CS))`,
    `INTO load CS`);

  // flags: if OF, clear IF+TF; else unchanged
  dispatch.addEntry('flags', 0xCE,
    `calc(${ofBit} * --and(var(--__1flags), 64767) + (1 - ${ofBit}) * var(--__1flags))`,
    `INTO clear IF+TF if OF`);

  // Memory pushes — addr uses arithmetic mux: of*real_addr + (1-of)*(-1).
  // Wrap SP-K to 16 bits before adding to SS*16, same fix as INT/PUSH.
  const sa = (k) => `calc(var(--__1SS) * 16 + --lowerBytes(calc(var(--__1SP) - ${k} + 65536), 16))`;
  dispatch.addMemWrite(0xCE,
    `calc(${ofBit} * (${sa(2)}) + (1 - ${ofBit}) * (-1))`,
    `--lowerBytes(var(--__1flags), 8)`,
    `INTO push FLAGS lo`);
  dispatch.addMemWrite(0xCE,
    `calc(${ofBit} * (${sa(1)}) + (1 - ${ofBit}) * (-1))`,
    `--rightShift(var(--__1flags), 8)`,
    `INTO push FLAGS hi`);
  dispatch.addMemWrite(0xCE,
    `calc(${ofBit} * (${sa(4)}) + (1 - ${ofBit}) * (-1))`,
    `--lowerBytes(var(--__1CS), 8)`,
    `INTO push CS lo`);
  dispatch.addMemWrite(0xCE,
    `calc(${ofBit} * (${sa(3)}) + (1 - ${ofBit}) * (-1))`,
    `--rightShift(var(--__1CS), 8)`,
    `INTO push CS hi`);
  dispatch.addMemWrite(0xCE,
    `calc(${ofBit} * (${sa(6)}) + (1 - ${ofBit}) * (-1))`,
    `--lowerBytes(${retIP}, 8)`,
    `INTO push IP lo`);
  dispatch.addMemWrite(0xCE,
    `calc(${ofBit} * (${sa(5)}) + (1 - ${ofBit}) * (-1))`,
    `--rightShift(${retIP}, 8)`,
    `INTO push IP hi`);
}

/**
 * BCD (Binary-Coded Decimal) instructions.
 *
 * AAM (0xD4): ASCII Adjust for Multiply.
 *   Format: 0xD4, imm8 (base, usually 0x0A).
 *   AH = floor(AL / base), AL = AL mod base.
 *   Flags: ZF, SF, PF from new AL. CF=OF=AF left undefined (set to 0).
 *   IP += 2.
 *
 * AAD (0xD5): ASCII Adjust for Division.
 *   Format: 0xD5, imm8 (base, usually 0x0A).
 *   AL = (AH * base + AL) & 0xFF, AH = 0.
 *   Flags: ZF, SF, PF from new AL.
 *   IP += 2.
 *
 * DAA (0x27), DAS (0x2F), AAA (0x37), AAS (0x3F): complex and rarely used.
 *   Implemented as IP-advance-only stubs to prevent crashes.
 */
export function emitBCD(dispatch) {
  // ---- AAM (0xD4) ----
  // q1 holds the imm8 base byte. Guard against divide-by-zero with max(1, ...).
  // new AH = floor(AL / base),  new AL = AL mod base
  // AX = new AH * 256 + new AL
  dispatch.addEntry('AX', 0xD4,
    `calc(round(down, var(--AL) / max(1, var(--q1))) * 256 + mod(var(--AL), max(1, var(--q1))))`,
    `AAM`);
  // Flags from new AL. mod() is a CSS math function (not a CSS @function), so it is
  // safe to pass inline as the argument to --logicFlags8.
  dispatch.addEntry('flags', 0xD4,
    `calc(--logicFlags8(mod(var(--AL), max(1, var(--q1)))) + --and(var(--__1flags), 1808))`,
    `AAM flags`);
  dispatch.addEntry('IP', 0xD4, `calc(var(--__1IP) + 2)`, `AAM`);

  // ---- AAD (0xD5) ----
  // new AL = (AH * base + AL) & 0xFF,  new AH = 0 → AX = new AL
  // We inline --lowerBytes as mod(..., 256) to avoid nesting a CSS @function call.
  dispatch.addEntry('AX', 0xD5,
    `mod(calc(var(--AH) * var(--q1) + var(--AL)), 256)`,
    `AAD`);
  // Flags from new AL (same mod expression — pure CSS math, safe as argument).
  dispatch.addEntry('flags', 0xD5,
    `calc(--logicFlags8(mod(calc(var(--AH) * var(--q1) + var(--AL)), 256)) + --and(var(--__1flags), 1808))`,
    `AAD flags`);
  dispatch.addEntry('IP', 0xD5, `calc(var(--__1IP) + 2)`, `AAD`);

  // ---- BCD helpers (all pure CSS math — no @function nesting) ----
  // CF = bit 0 of flags = mod(flags, 2)
  // AF = bit 4 of flags = mod(round(down, flags / 16), 2)
  // lowerBytes(x, 8) = mod(x + 256, 256) — the +256 guards against negative
  // mergelow(old, new) = round(down, old / 256) * 256 + new

  // ---- AAA (0x37): ASCII Adjust after Addition ----
  // If low nibble of AL > 9 or AF: AL += 6, AH += 1, CF=AF=1. Then AL &= 0x0F.
  dispatch.addEntry('AX', 0x37, (() => {
    const lowNib = `mod(var(--AL), 16)`;
    const nibGt9 = `round(down, ${lowNib} / 10)`;
    const af = `mod(round(down, var(--__1flags) / 16), 2)`;
    const adj = `min(1, calc(${nibGt9} + ${af}))`;
    const newAL = `mod(calc(var(--AL) + ${adj} * 6), 16)`;
    const newAH = `mod(calc(var(--AH) + ${adj} + 256), 256)`;
    return `calc(${newAH} * 256 + ${newAL})`;
  })(), `AAA`);
  dispatch.addEntry('flags', 0x37, (() => {
    const lowNib = `mod(var(--AL), 16)`;
    const nibGt9 = `round(down, ${lowNib} / 10)`;
    const af = `mod(round(down, var(--__1flags) / 16), 2)`;
    const adj = `min(1, calc(${nibGt9} + ${af}))`;
    const newAL = `mod(calc(var(--AL) + ${adj} * 6), 16)`;
    return `calc(--logicFlags8(${newAL}) + ${adj} + ${adj} * 16 + --and(var(--__1flags), 1792))`;
  })(), `AAA flags`);
  dispatch.addEntry('IP', 0x37, `calc(var(--__1IP) + 1)`, `AAA`);

  // ---- AAS (0x3F): ASCII Adjust after Subtraction ----
  dispatch.addEntry('AX', 0x3F, (() => {
    const lowNib = `mod(var(--AL), 16)`;
    const nibGt9 = `round(down, ${lowNib} / 10)`;
    const af = `mod(round(down, var(--__1flags) / 16), 2)`;
    const adj = `min(1, calc(${nibGt9} + ${af}))`;
    const newAL = `mod(calc(var(--AL) - ${adj} * 6 + 16), 16)`;
    const newAH = `mod(calc(var(--AH) - ${adj} + 256), 256)`;
    return `calc(${newAH} * 256 + ${newAL})`;
  })(), `AAS`);
  dispatch.addEntry('flags', 0x3F, (() => {
    const lowNib = `mod(var(--AL), 16)`;
    const nibGt9 = `round(down, ${lowNib} / 10)`;
    const af = `mod(round(down, var(--__1flags) / 16), 2)`;
    const adj = `min(1, calc(${nibGt9} + ${af}))`;
    const newAL = `mod(calc(var(--AL) - ${adj} * 6 + 16), 16)`;
    return `calc(--logicFlags8(${newAL}) + ${adj} + ${adj} * 16 + --and(var(--__1flags), 1792))`;
  })(), `AAS flags`);
  dispatch.addEntry('IP', 0x3F, `calc(var(--__1IP) + 1)`, `AAS`);

  // ---- DAA (0x27): Decimal Adjust after Addition ----
  // Phase 1: if (AL & 0xF) > 9 or AF: AL += 6
  // Phase 2: if oldAL > 0x99 or oldCF: AL += 0x60
  // newAL = (oldAL + adj1 + adj2) & 0xFF
  dispatch.addEntry('AX', 0x27, (() => {
    const oldAL = `var(--AL)`;
    const lowNib = `mod(${oldAL}, 16)`;
    const nibGt9 = `round(down, ${lowNib} / 10)`;
    const af = `mod(round(down, var(--__1flags) / 16), 2)`;
    const cond1 = `min(1, calc(${nibGt9} + ${af}))`;
    const adj1 = `calc(${cond1} * 6)`;

    const oldCF = `mod(var(--__1flags), 2)`;
    const gt99 = `round(down, ${oldAL} / 154)`;
    const cond2 = `min(1, calc(${gt99} + ${oldCF}))`;
    const adj2 = `calc(${cond2} * 96)`;

    // newAL = mod(oldAL + adj1 + adj2, 256), merge into AX preserving AH
    const newAL = `mod(calc(${oldAL} + ${adj1} + ${adj2}), 256)`;
    return `calc(round(down, var(--__1AX) / 256) * 256 + ${newAL})`;
  })(), `DAA`);
  dispatch.addEntry('flags', 0x27, (() => {
    const oldAL = `var(--AL)`;
    const lowNib = `mod(${oldAL}, 16)`;
    const nibGt9 = `round(down, ${lowNib} / 10)`;
    const af = `mod(round(down, var(--__1flags) / 16), 2)`;
    const cond1 = `min(1, calc(${nibGt9} + ${af}))`;
    const adj1 = `calc(${cond1} * 6)`;

    const oldCF = `mod(var(--__1flags), 2)`;
    const gt99 = `round(down, ${oldAL} / 154)`;
    const cond2 = `min(1, calc(${gt99} + ${oldCF}))`;
    const adj2 = `calc(${cond2} * 96)`;

    const newAL = `mod(calc(${oldAL} + ${adj1} + ${adj2}), 256)`;
    return `calc(--logicFlags8(${newAL}) + ${cond2} + ${cond1} * 16 + --and(var(--__1flags), 1792))`;
  })(), `DAA flags`);
  dispatch.addEntry('IP', 0x27, `calc(var(--__1IP) + 1)`, `DAA`);

  // ---- DAS (0x2F): Decimal Adjust after Subtraction ----
  // Phase 1: if (AL & 0xF) > 9 or AF: AL -= 6
  // Phase 2: if oldAL > 0x99 or oldCF: AL -= 0x60
  dispatch.addEntry('AX', 0x2F, (() => {
    const oldAL = `var(--AL)`;
    const lowNib = `mod(${oldAL}, 16)`;
    const nibGt9 = `round(down, ${lowNib} / 10)`;
    const af = `mod(round(down, var(--__1flags) / 16), 2)`;
    const cond1 = `min(1, calc(${nibGt9} + ${af}))`;
    const adj1 = `calc(${cond1} * 6)`;

    const oldCF = `mod(var(--__1flags), 2)`;
    const gt99 = `round(down, ${oldAL} / 154)`;
    const cond2 = `min(1, calc(${gt99} + ${oldCF}))`;
    const adj2 = `calc(${cond2} * 96)`;

    // +256 to avoid negative before mod
    const newAL = `mod(calc(${oldAL} - ${adj1} - ${adj2} + 256), 256)`;
    return `calc(round(down, var(--__1AX) / 256) * 256 + ${newAL})`;
  })(), `DAS`);
  dispatch.addEntry('flags', 0x2F, (() => {
    const oldAL = `var(--AL)`;
    const lowNib = `mod(${oldAL}, 16)`;
    const nibGt9 = `round(down, ${lowNib} / 10)`;
    const af = `mod(round(down, var(--__1flags) / 16), 2)`;
    const cond1 = `min(1, calc(${nibGt9} + ${af}))`;
    const adj1 = `calc(${cond1} * 6)`;

    const oldCF = `mod(var(--__1flags), 2)`;
    const gt99 = `round(down, ${oldAL} / 154)`;
    const cond2 = `min(1, calc(${gt99} + ${oldCF}))`;
    const adj2 = `calc(${cond2} * 96)`;

    const newAL = `mod(calc(${oldAL} - ${adj1} - ${adj2} + 256), 256)`;
    return `calc(--logicFlags8(${newAL}) + ${cond2} + ${cond1} * 16 + --and(var(--__1flags), 1792))`;
  })(), `DAS flags`);
  dispatch.addEntry('IP', 0x2F, `calc(var(--__1IP) + 1)`, `DAS`);
}

/**
 * WAIT (0x9B), ESC (0xD8-0xDF), LOCK (0xF0): no-op stubs.
 * WAIT: FPU sync — no FPU, so just advance IP.
 * ESC: FPU escape — needs ModR/M decode (skip operand bytes), no operation.
 * LOCK: bus lock prefix — meaningless in single-threaded CSS, advance IP.
 */
export function emitNopStubs(dispatch) {
  // WAIT (0x9B): 1-byte, no-op
  dispatch.addEntry('IP', 0x9B, `calc(var(--__1IP) + 1)`, `WAIT`);

  // LOCK (0xF0): 1-byte prefix, treated as no-op
  dispatch.addEntry('IP', 0xF0, `calc(var(--__1IP) + 1)`, `LOCK`);

  // ESC 0-7 (0xD8-0xDF): has ModR/M byte, so IP += 2 + modrmExtra
  for (let i = 0; i < 8; i++) {
    dispatch.addEntry('IP', 0xD8 + i,
      `calc(var(--__1IP) + 2 + var(--modrmExtra))`,
      `ESC ${i}`);
  }
}

/**
 * Register all misc opcodes.
 */
export function emitAllMisc(dispatch, opts = {}) {
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
  emitIO(dispatch, opts);
  emitXLAT(dispatch);
  emitINT3(dispatch);
  emitINTO(dispatch);
  emitBCD(dispatch);
  emitNopStubs(dispatch);
}
