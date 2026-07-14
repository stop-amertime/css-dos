// Flag computation @functions.
// CONSTRAINTS:
// 1. Max 7 local variables per function (Chrome limit)
// 2. No nested function calls as arguments
// 3. Total call-chain complexity limited (deep xor nesting fails)
//
// Strategy: use inline arithmetic for AF (avoid expensive --xor chains),
// use --subOF/--addOF helpers for OF, combine ZF+SF into one local.

const PARITY = [
  1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
  0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
  0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
  1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
  0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
  1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
  1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
  0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
  0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
  1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
  1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
  0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
  1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
  0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
  0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0,
  1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1,
];

// AF inline formulas (avoid calling --xor which is too deep):
// ADD AF: carry from bit 3→4: (lo_dst + lo_src) >= 16
const ADD_AF = (dst, src) =>
  `calc(round(down, max(0, sign(mod(${dst}, 16) + mod(${src}, 16) - 15.5)) + 0.5) * 16)`;
// SUB AF: borrow from bit 4→3: lo_dst < lo_src
const SUB_AF = (dst, src) =>
  `calc(round(down, max(0, sign(mod(${src}, 16) - mod(${dst}, 16) - 0.5)) + 0.5) * 16)`;
// INC AF: (dst & 0xF) == 0xF → res low nibble wraps from F to 0
const INC_AF = () =>
  `if(style(--_nibble: 15): 16; else: 0)`;
// DEC AF: (dst & 0xF) == 0x0 → res low nibble wraps from 0 to F
const DEC_AF = () =>
  `if(style(--_nibble: 0): 16; else: 0)`;

// Composite logic-flag @function (--orFlags/--andFlags/--xorFlags, both
// widths): compute --res via the bitwise op then the shared PF/ZF/SF/+2
// tail that --logicFlags{16,8} carry. The 16-bit form uses --res directly;
// the 8-bit form masks --full down to 8 bits first.
function compositeLogicFlags(op, width) {
  const resLines = width === 16
    ? `  --res: --${op}(var(--a), var(--b));`
    : `  --full: --${op}(var(--a), var(--b));\n  --res: --lowerBytes(var(--full), 8);`;
  const sfBit = width === 16 ? 15 : 7;
  return `@function --${op}Flags${width}(--a <integer>, --b <integer>) returns <integer> {
${resLines}
  --pf: --parity(var(--res));
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), ${sfBit}) * 128);
  result: calc(var(--pf) + var(--zf) + var(--sf) + 2);
}`;
}

// INC/DEC flag @function. Differs only in: SF bit (15/7), the OF sentinel
// (the signed-overflow value the op lands on - INC hits 0x8000/0x80 going
// up, DEC hits 0x7FFF/0x7F coming down), and INC_AF vs DEC_AF.
function incDecFlags(dir, width) {
  const inc = dir === 'inc';
  const sfBit = width === 16 ? 15 : 7;
  const ofSentinel = width === 16 ? (inc ? 32768 : 32767) : (inc ? 128 : 127);
  const af = inc ? INC_AF() : DEC_AF();
  return `@function --${dir}Flags${width}(--dst <integer>, --res <integer>, --oldFlags <integer>) returns <integer> {
  --cf: --bit(var(--oldFlags), 0);
  --pf: --parity(var(--res));
  --_nibble: mod(var(--dst), 16);
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), ${sfBit}) * 128);
  --of: if(style(--res: ${ofSentinel}): 2048; else: 0);
  --keep: --and(var(--oldFlags), 1792);
  result: calc(var(--cf) + var(--pf) + ${af} + var(--zf) + var(--sf) + var(--of) + var(--keep) + 2);
}`;
}

export function emitFlagFunctions() {
  return `
@function --parity(--val <integer>) returns <integer> {
  --low8: --lowerBytes(var(--val), 8);
  result: if(
${PARITY.map((p, i) => `    style(--low8: ${i}): ${p * 4};`).join('\n')}
  else: 0);
}

/* OF helpers - arithmetic only, no --xor/--and (avoids Chrome nesting depth limit).
   ADD OF: signs same on inputs, different on result → overflow.
     OF = (1 - |sign_dst - sign_src|) * |sign_dst - sign_res|
   SUB OF: signs differ on inputs, result sign differs from dst → overflow.
     OF = |sign_dst - sign_src| * |sign_dst - sign_res|
*/

@function --addOF16(--dst <integer>, --src <integer>, --res <integer>) returns <integer> {
  --sd: --bit(var(--dst), 15);
  --ss: --bit(var(--src), 15);
  --sr: --bit(var(--res), 15);
  result: calc((1 - abs(var(--sd) - var(--ss))) * abs(var(--sd) - var(--sr)) * 2048);
}

@function --addOF8(--dst <integer>, --src <integer>, --res <integer>) returns <integer> {
  --sd: --bit(var(--dst), 7);
  --ss: --bit(var(--src), 7);
  --sr: --bit(var(--res), 7);
  result: calc((1 - abs(var(--sd) - var(--ss))) * abs(var(--sd) - var(--sr)) * 2048);
}

@function --subOF16(--dst <integer>, --src <integer>, --res <integer>) returns <integer> {
  --sd: --bit(var(--dst), 15);
  --ss: --bit(var(--src), 15);
  --sr: --bit(var(--res), 15);
  result: calc(abs(var(--sd) - var(--ss)) * abs(var(--sd) - var(--sr)) * 2048);
}

@function --subOF8(--dst <integer>, --src <integer>, --res <integer>) returns <integer> {
  --sd: --bit(var(--dst), 7);
  --ss: --bit(var(--src), 7);
  --sr: --bit(var(--res), 7);
  result: calc(abs(var(--sd) - var(--ss)) * abs(var(--sd) - var(--sr)) * 2048);
}

/* --- ADD flags --- */

@function --addFlags16(--dst <integer>, --src <integer>) returns <integer> {
  --raw: calc(var(--dst) + var(--src));
  --res: --lowerBytes(var(--raw), 16);
  --cf: min(1, round(down, var(--raw) / 65536));
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 15) * 128);
  --of: --addOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + ${ADD_AF('var(--dst)', 'var(--src)')} + var(--zfsf) + var(--of) + 2);
}

@function --addFlags8(--dst <integer>, --src <integer>) returns <integer> {
  --raw: calc(var(--dst) + var(--src));
  --res: --lowerBytes(var(--raw), 8);
  --cf: min(1, round(down, var(--raw) / 256));
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 7) * 128);
  --of: --addOF8(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + ${ADD_AF('var(--dst)', 'var(--src)')} + var(--zfsf) + var(--of) + 2);
}

/* --- SUB & CMP flags --- */

@function --subFlags16(--dst <integer>, --src <integer>) returns <integer> {
  --res: --lowerBytes(calc(var(--dst) - var(--src) + 65536), 16);
  --cf: round(down, max(0, sign(calc(var(--src) - var(--dst) - 0.5))) + 0.5);
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 15) * 128);
  --of: --subOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + ${SUB_AF('var(--dst)', 'var(--src)')} + var(--zfsf) + var(--of) + 2);
}

@function --subFlags8(--dst <integer>, --src <integer>) returns <integer> {
  --res: --lowerBytes(calc(var(--dst) - var(--src) + 256), 8);
  --cf: round(down, max(0, sign(calc(var(--src) - var(--dst) - 0.5))) + 0.5);
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 7) * 128);
  --of: --subOF8(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + ${SUB_AF('var(--dst)', 'var(--src)')} + var(--zfsf) + var(--of) + 2);
}

/* --- logic flags (AND/OR/XOR/TEST) --- */

@function --logicFlags16(--res <integer>) returns <integer> {
  --pf: --parity(var(--res));
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 15) * 128);
  result: calc(var(--pf) + var(--zf) + var(--sf) + 2);
}

@function --logicFlags8(--res <integer>) returns <integer> {
  --pf: --parity(var(--res));
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 7) * 128);
  result: calc(var(--pf) + var(--zf) + var(--sf) + 2);
}

/* --- composite logic flags --- */

${['or', 'and', 'xor'].map(op => `${compositeLogicFlags(op, 16)}\n\n${compositeLogicFlags(op, 8)}`).join('\n\n')}

/* --- INC/DEC flags --- */

${[16, 8].flatMap(width => ['inc', 'dec'].map(dir => incDecFlags(dir, width))).join('\n\n')}

/* --- ADC flags --- */

@function --adcFlags16(--dst <integer>, --src <integer>, --carry <integer>) returns <integer> {
  --raw: calc(var(--dst) + var(--src) + var(--carry));
  --res: --lowerBytes(var(--raw), 16);
  --cf: min(1, round(down, var(--raw) / 65536));
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 15) * 128);
  --of: --addOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + ${ADD_AF('var(--dst)', 'var(--src)')} + var(--zfsf) + var(--of) + 2);
}

@function --adcFlags8(--dst <integer>, --src <integer>, --carry <integer>) returns <integer> {
  --raw: calc(var(--dst) + var(--src) + var(--carry));
  --res: --lowerBytes(var(--raw), 8);
  --cf: min(1, round(down, var(--raw) / 256));
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 7) * 128);
  --of: --addOF8(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + ${ADD_AF('var(--dst)', 'var(--src)')} + var(--zfsf) + var(--of) + 2);
}

/* --- SBB flags --- */

@function --sbbFlags16(--dst <integer>, --src <integer>, --carry <integer>) returns <integer> {
  --total: calc(var(--src) + var(--carry));
  --res: --lowerBytes(calc(var(--dst) - var(--total) + 65536), 16);
  --cf: round(down, max(0, sign(calc(var(--total) - var(--dst) - 0.5))) + 0.5);
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 15) * 128);
  --of: --subOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + ${SUB_AF('var(--dst)', 'var(--src)')} + var(--zfsf) + var(--of) + 2);
}

@function --sbbFlags8(--dst <integer>, --src <integer>, --carry <integer>) returns <integer> {
  --total: calc(var(--src) + var(--carry));
  --res: --lowerBytes(calc(var(--dst) - var(--total) + 256), 8);
  --cf: round(down, max(0, sign(calc(var(--total) - var(--dst) - 0.5))) + 0.5);
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 7) * 128);
  --of: --subOF8(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf) + ${SUB_AF('var(--dst)', 'var(--src)')} + var(--zfsf) + var(--of) + 2);
}
`;
}
