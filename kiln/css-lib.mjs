// These are proven to work in Chrome. Emitted verbatim.

export function emitCSSLib() {
  return `
/* --- shifts, slices, sign helpers --- */

@function --lowerBytes(--a <integer>, --b <integer>) returns <integer> {
  result: mod(var(--a), pow(2, var(--b)));
}

@function --rightShift(--a <integer>, --b <integer>) returns <integer> {
  result: round(down, var(--a) / pow(2, var(--b)));
}

@function --leftShift(--a <integer>, --b <integer>) returns <integer> {
  --shift: if(
    style(--b:0):1;
    style(--b:1):2;
    style(--b:2):4;
    style(--b:3):8;
    style(--b:4):16;
    style(--b:5):32;
    style(--b:6):64;
    style(--b:7):128;
    style(--b:8):256;
    style(--b:9):512;
    style(--b:10):1024;
    style(--b:11):2048;
    style(--b:12):4096;
    style(--b:13):8192;
    style(--b:14):16384;
    style(--b:15):32768;
  else:calc(var(--a) * pow(2, var(--b))));
  result: calc(var(--a) * var(--shift));
}

@function --int(--i <integer>) returns <integer> {
  result: var(--i);
}

@function --u2s1(--u <integer>) returns <integer> {
  result: calc(var(--u) - round(down, var(--u) / 128) * 256);
}

@function --u2s2(--u <integer>) returns <integer> {
  result: calc(var(--u) - max(0, round(down, var(--u) / 32768)) * 65536);
}

@function --bit(--val <integer>, --idx <integer>) returns <integer> {
  result: mod(--rightShift(var(--val), var(--idx)), 2);
}

/* --- bitwise AND/OR/XOR/NOT (nibble LUT) --- */
/* Each operation uses a 16×16 nested-if lookup table per nibble,
   then combines four nibble results. This replaces the previous
   per-bit decomposition approach (32 intermediate variables + 16
   recombinations) with 8 nibble extractions + 4 table lookups.
   Evaluation cost: max 32 style() tests per lookup vs 48 intermediate
   variables + multiplications. CSS size is ~2.3× larger, but this is
   negligible in a 400 MB+ cabinet (~19 KB vs ~8 KB). */

${emitNibbleLUT('xor', (a, b) => (a ^ b))}

${emitNibbleWrapper('xor')}

${emitNibbleLUT('and', (a, b) => (a & b))}

${emitNibbleWrapper('and')}

${emitNibbleLUT('or', (a, b) => (a | b))}

${emitNibbleWrapper('or')}

${emitNotNibbleLUT()}

${emitNotNibbleWrapper()}

/* --- 8-bit wrappers --- */
/* Chrome can't nest function calls as arguments, so these provide
   pre-composed 8-bit variants of the bitwise ops. */

${['or', 'and', 'xor'].map(op => `@function --${op}8(--a <integer>, --b <integer>) returns <integer> {
  --full: --${op}(var(--a), var(--b));
  result: --lowerBytes(var(--full), 8);
}`).join('\n\n')}

/* --- byte merges --- */

@function --mergelow(--old <integer>, --new <integer>) returns <integer> {
  result: calc(round(down, var(--old) / 256) * 256 + --lowerBytes(var(--new), 8));
}

@function --mergehigh(--old <integer>, --new <integer>) returns <integer> {
  result: calc(var(--new) * 256 + --lowerBytes(var(--old), 8));
}

/* --- 16-bit memory read --- */

@function --read2(--at <integer>) returns <integer> {
  result: calc(--readMem(var(--at)) + --readMem(calc(var(--at) + 1)) * 256);
}

/* --- packed-cell helpers --- */
/*
   Memory is packed 2 bytes to a cell (cell holds b0 | b1<<8 - a 16-bit word).
   Value range 0..65535 stays well inside i32, so calcite's sign semantics
   don't corrupt byte extraction.
   --extractByte reads one byte from a cell; --applySlot conditionally splices
   a slot's write into a cell. Both take the cell-internal offset (0..1) as a
   function parameter so style() queries match against parameter values. */

@function --extractByte(--cell <integer>, --off <integer>) returns <integer> {
  result: if(
    style(--off: 0): mod(var(--cell), 256);
    style(--off: 1): round(down, var(--cell) / 256);
  else: 0);
}

@function --spliceByte(--cell <integer>, --val <integer>, --off <integer>) returns <integer> {
  result: if(
    style(--off: 0): calc(round(down, var(--cell) / 256) * 256 + var(--val));
    style(--off: 1): calc(var(--val) * 256 + mod(var(--cell), 256));
  else: var(--cell));
}

/* Conditionally splice a slot's write into a cell.
   --loOff = memAddrN - cellBase            (slot's first byte offset in this cell)
   --hiOff = memAddrN + 1 - cellBase        (slot's second byte offset in this cell; width=2 only)
   --val   = byte (width=1) or 16-bit word (width=2; lo at memAddrN, hi at memAddrN+1)
   --width = 1 or 2

   Cases:
     1. live=0 OR slot doesn't touch this cell → passthrough
     2. width=2 aligned (loOff=0 AND hiOff=1)   → whole cell = --lowerBytes(val, 16)
     3. width=2 straddle, lo lands here at off 1 (loOff=1)
                                                 → cell.b1 = val & 0xff
     4. width=2 straddle, hi lands here at off 0 (hiOff=0)
                                                 → cell.b0 = val >> 8
     5. width=1 byte at off 0                    (loOff=0)
                                                 → cell.b0 = val
     6. width=1 byte at off 1                    (loOff=1)
                                                 → cell.b1 = val
   Cases 5/6 only fire on width=1 ticks - the width=2 guards filter the
   width=2 paths above first.

   Chained NUM_WRITE_SLOTS times per cell (slot N-1 innermost, slot 0
   outermost) so slot 0 wins on same-cell collisions - matching the
   legacy byte-level top-down dispatch semantics. */
@function --applySlot(--cell <integer>, --live <integer>, --loOff <integer>, --hiOff <integer>, --val <integer>, --width <integer>) returns <integer> {
  result: if(
    style(--live: 0): var(--cell);
    style(--width: 2) and style(--loOff: 0) and style(--hiOff: 1): --lowerBytes(var(--val), 16);
    style(--width: 2) and style(--loOff: 1): calc(--lowerBytes(var(--val), 8) * 256 + mod(var(--cell), 256));
    style(--width: 2) and style(--hiOff: 0): calc(round(down, var(--cell) / 256) * 256 + --rightShift(var(--val), 8));
    style(--loOff: 0): calc(round(down, var(--cell) / 256) * 256 + var(--val));
    style(--loOff: 1): calc(var(--val) * 256 + mod(var(--cell), 256));
  else: var(--cell));
}

/* --- power-of-2 lookup --- */
/* Used for variable-count shifts (SHL/SHR by CL).
   Maps 0..31 → 2^0..2^31. Values beyond 31 return 0. */

@function --pow2(--n <integer>) returns <integer> {
  result: if(
    style(--n: 0): 1;
    style(--n: 1): 2;
    style(--n: 2): 4;
    style(--n: 3): 8;
    style(--n: 4): 16;
    style(--n: 5): 32;
    style(--n: 6): 64;
    style(--n: 7): 128;
    style(--n: 8): 256;
    style(--n: 9): 512;
    style(--n: 10): 1024;
    style(--n: 11): 2048;
    style(--n: 12): 4096;
    style(--n: 13): 8192;
    style(--n: 14): 16384;
    style(--n: 15): 32768;
    style(--n: 16): 65536;
    style(--n: 17): 131072;
    style(--n: 18): 262144;
    style(--n: 19): 524288;
    style(--n: 20): 1048576;
    style(--n: 21): 2097152;
    style(--n: 22): 4194304;
    style(--n: 23): 8388608;
    style(--n: 24): 16777216;
    style(--n: 25): 33554432;
    style(--n: 26): 67108864;
    style(--n: 27): 134217728;
    style(--n: 28): 268435456;
    style(--n: 29): 536870912;
    style(--n: 30): 1073741824;
    style(--n: 31): 2147483648;
  else: 0);
}
`;
}

// --- Nibble LUT generators ---
// A 4-bit × 4-bit lookup table using nested if(): outer matches --a (16 arms),
// inner matches --b (16 arms). Worst-case evaluation: 16 + 16 = 32 style() tests.
function emitNibbleLUT(name, op) {
  const lines = [];
  lines.push(`@function --${name}Nibble(--a <integer>, --b <integer>) returns <integer> {`);
  lines.push(`  result: if(`);
  for (let a = 0; a < 16; a++) {
    const inner = [];
    for (let b = 0; b < 16; b++) inner.push(`style(--b: ${b}): ${op(a, b)}`);
    lines.push(`    style(--a: ${a}): if(${inner.join('; ')}; else: 0);`);
  }
  lines.push(`  else: 0);`);
  lines.push(`}`);
  return lines.join('\n');
}

// Wrapper: extract four nibbles from each 16-bit operand, look up each pair,
// and recombine with positional weights (1, 16, 256, 4096).
function emitNibbleWrapper(name) {
  return [
    `@function --${name}(--a <integer>, --b <integer>) returns <integer> {`,
    `  --an0: mod(var(--a), 16);`,
    `  --an1: mod(round(down, calc(var(--a) / 16)), 16);`,
    `  --an2: mod(round(down, calc(var(--a) / 256)), 16);`,
    `  --an3: mod(round(down, calc(var(--a) / 4096)), 16);`,
    `  --bn0: mod(var(--b), 16);`,
    `  --bn1: mod(round(down, calc(var(--b) / 16)), 16);`,
    `  --bn2: mod(round(down, calc(var(--b) / 256)), 16);`,
    `  --bn3: mod(round(down, calc(var(--b) / 4096)), 16);`,
    `  result: calc(`,
    `    --${name}Nibble(var(--an0), var(--bn0))`,
    `    + --${name}Nibble(var(--an1), var(--bn1)) * 16`,
    `    + --${name}Nibble(var(--an2), var(--bn2)) * 256`,
    `    + --${name}Nibble(var(--an3), var(--bn3)) * 4096`,
    `  );`,
    `}`,
  ].join('\n');
}

// NOT only has one operand: 16-entry single-level LUT.
function emitNotNibbleLUT() {
  const lines = [];
  lines.push(`@function --notNibble(--a <integer>) returns <integer> {`);
  lines.push(`  result: if(`);
  for (let a = 0; a < 16; a++) lines.push(`    style(--a: ${a}): ${15 - a};`);
  lines.push(`  else: 0);`);
  lines.push(`}`);
  return lines.join('\n');
}

function emitNotNibbleWrapper() {
  return [
    `@function --not(--a <integer>) returns <integer> {`,
    `  --an0: mod(var(--a), 16);`,
    `  --an1: mod(round(down, calc(var(--a) / 16)), 16);`,
    `  --an2: mod(round(down, calc(var(--a) / 256)), 16);`,
    `  --an3: mod(round(down, calc(var(--a) / 4096)), 16);`,
    `  result: calc(`,
    `    --notNibble(var(--an0))`,
    `    + --notNibble(var(--an1)) * 16`,
    `    + --notNibble(var(--an2)) * 256`,
    `    + --notNibble(var(--an3)) * 4096`,
    `  );`,
    `}`,
  ].join('\n');
}
