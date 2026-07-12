// Code exhibits shown on the About pages.
//
// CELL_PLUMBING — one memory cell's four-variable ring (Problem 3 on
// "How is this possible?" and SectionClock's "Why four keyframes?"
// fold — the same explanation appears in both places on purpose).
//
// AND_FULL_EXHIBIT — Problem 1's full AND machinery, verbatim from the
// Kiln emitters (kiln/css-lib.mjs, kiln/patterns/flags.mjs).

export const CELL_PLUMBING = `/* rule, always in force: the copy every formula reads —
   defined as the _2 copy, power-on value as the fallback */
--mc5000-prev: var(--mc5000_2, 32861);

/* rule, always in force: the cell's next value, computed from
   -prev copies only (the write formula from the write-formulas section) */
--mc5000: …;

/* the "execute" keyframe, at 75% of the lap: a copy of the computed value */
--mc5000_1: var(--mc5000);

/* the "store" keyframe, at 25% of the lap: a copy of _1 */
--mc5000_2: var(--mc5000_1, 32861);`;

export const AND_FULL_EXHIBIT = `/* CSS-DOS: the AND operation, plus auxiliary @functions.
   Extracted verbatim from the Kiln emitters (kiln/css-lib.mjs, kiln/patterns/flags.mjs).
   Dependency tree:
     --andFlags16/--andFlags8  (full FLAGS word after AND/TEST)
       -> --and      (16-bit bitwise AND, self-contained)
       -> --parity   (PF, 256-entry even-parity table over the low byte)
            -> --lowerBytes
       -> --bit      (single-bit extract, for SF)
            -> --rightShift
     --and8 = --and truncated to 8 bits via --lowerBytes */

/* ===== core helpers ===== */
@function --lowerBytes(--a <integer>, --b <integer>) returns <integer> {
  result: mod(var(--a), pow(2, var(--b)));
}

@function --rightShift(--a <integer>, --b <integer>) returns <integer> {
  result: round(down, var(--a) / pow(2, var(--b)));
}

@function --bit(--val <integer>, --idx <integer>) returns <integer> {
  result: mod(--rightShift(var(--val), var(--idx)), 2);
}

/* ===== the AND itself ===== */
@function --and(--a <integer>, --b <integer>) returns <integer> {
  --a1: mod(var(--a), 2);
  --a2: mod(round(down, var(--a) / 2), 2);
  --a3: mod(round(down, var(--a) / 4), 2);
  --a4: mod(round(down, var(--a) / 8), 2);
  --a5: mod(round(down, var(--a) / 16), 2);
  --a6: mod(round(down, var(--a) / 32), 2);
  --a7: mod(round(down, var(--a) / 64), 2);
  --a8: mod(round(down, var(--a) / 128), 2);
  --a9: mod(round(down, var(--a) / 256), 2);
  --a10: mod(round(down, var(--a) / 512), 2);
  --a11: mod(round(down, var(--a) / 1024), 2);
  --a12: mod(round(down, var(--a) / 2048), 2);
  --a13: mod(round(down, var(--a) / 4096), 2);
  --a14: mod(round(down, var(--a) / 8192), 2);
  --a15: mod(round(down, var(--a) / 16384), 2);
  --a16: mod(round(down, var(--a) / 32768), 2);
  --b1: mod(var(--b), 2);
  --b2: mod(round(down, var(--b) / 2), 2);
  --b3: mod(round(down, var(--b) / 4), 2);
  --b4: mod(round(down, var(--b) / 8), 2);
  --b5: mod(round(down, var(--b) / 16), 2);
  --b6: mod(round(down, var(--b) / 32), 2);
  --b7: mod(round(down, var(--b) / 64), 2);
  --b8: mod(round(down, var(--b) / 128), 2);
  --b9: mod(round(down, var(--b) / 256), 2);
  --b10: mod(round(down, var(--b) / 512), 2);
  --b11: mod(round(down, var(--b) / 1024), 2);
  --b12: mod(round(down, var(--b) / 2048), 2);
  --b13: mod(round(down, var(--b) / 4096), 2);
  --b14: mod(round(down, var(--b) / 8192), 2);
  --b15: mod(round(down, var(--b) / 16384), 2);
  --b16: mod(round(down, var(--b) / 32768), 2);
  result: calc(
    var(--a1) * var(--b1) +
    calc(var(--a2) * var(--b2)) * 2 +
    calc(var(--a3) * var(--b3)) * 4 +
    calc(var(--a4) * var(--b4)) * 8 +
    calc(var(--a5) * var(--b5)) * 16 +
    calc(var(--a6) * var(--b6)) * 32 +
    calc(var(--a7) * var(--b7)) * 64 +
    calc(var(--a8) * var(--b8)) * 128 +
    calc(var(--a9) * var(--b9)) * 256 +
    calc(var(--a10) * var(--b10)) * 512 +
    calc(var(--a11) * var(--b11)) * 1024 +
    calc(var(--a12) * var(--b12)) * 2048 +
    calc(var(--a13) * var(--b13)) * 4096 +
    calc(var(--a14) * var(--b14)) * 8192 +
    calc(var(--a15) * var(--b15)) * 16384 +
    calc(var(--a16) * var(--b16)) * 32768
  );
}

@function --and8(--a <integer>, --b <integer>) returns <integer> {
  --full: --and(var(--a), var(--b));
  result: --lowerBytes(var(--full), 8);
}

/* ===== flag computation ===== */
@function --parity(--val <integer>) returns <integer> {
  --low8: --lowerBytes(var(--val), 8);
  result: if(
    style(--low8: 0): 4;
    style(--low8: 1): 0;
    style(--low8: 2): 0;
    style(--low8: 3): 4;
    style(--low8: 4): 0;
    style(--low8: 5): 4;
    style(--low8: 6): 4;
    style(--low8: 7): 0;
    style(--low8: 8): 0;
    style(--low8: 9): 4;
    style(--low8: 10): 4;
    style(--low8: 11): 0;
    style(--low8: 12): 4;
    style(--low8: 13): 0;
    style(--low8: 14): 0;
    style(--low8: 15): 4;
    style(--low8: 16): 0;
    style(--low8: 17): 4;
    style(--low8: 18): 4;
    style(--low8: 19): 0;
    style(--low8: 20): 4;
    style(--low8: 21): 0;
    style(--low8: 22): 0;
    style(--low8: 23): 4;
    style(--low8: 24): 4;
    style(--low8: 25): 0;
    style(--low8: 26): 0;
    style(--low8: 27): 4;
    style(--low8: 28): 0;
    style(--low8: 29): 4;
    style(--low8: 30): 4;
    style(--low8: 31): 0;
    style(--low8: 32): 0;
    style(--low8: 33): 4;
    style(--low8: 34): 4;
    style(--low8: 35): 0;
    style(--low8: 36): 4;
    style(--low8: 37): 0;
    style(--low8: 38): 0;
    style(--low8: 39): 4;
    style(--low8: 40): 4;
    style(--low8: 41): 0;
    style(--low8: 42): 0;
    style(--low8: 43): 4;
    style(--low8: 44): 0;
    style(--low8: 45): 4;
    style(--low8: 46): 4;
    style(--low8: 47): 0;
    style(--low8: 48): 4;
    style(--low8: 49): 0;
    style(--low8: 50): 0;
    style(--low8: 51): 4;
    style(--low8: 52): 0;
    style(--low8: 53): 4;
    style(--low8: 54): 4;
    style(--low8: 55): 0;
    style(--low8: 56): 0;
    style(--low8: 57): 4;
    style(--low8: 58): 4;
    style(--low8: 59): 0;
    style(--low8: 60): 4;
    style(--low8: 61): 0;
    style(--low8: 62): 0;
    style(--low8: 63): 4;
    style(--low8: 64): 0;
    style(--low8: 65): 4;
    style(--low8: 66): 4;
    style(--low8: 67): 0;
    style(--low8: 68): 4;
    style(--low8: 69): 0;
    style(--low8: 70): 0;
    style(--low8: 71): 4;
    style(--low8: 72): 4;
    style(--low8: 73): 0;
    style(--low8: 74): 0;
    style(--low8: 75): 4;
    style(--low8: 76): 0;
    style(--low8: 77): 4;
    style(--low8: 78): 4;
    style(--low8: 79): 0;
    style(--low8: 80): 4;
    style(--low8: 81): 0;
    style(--low8: 82): 0;
    style(--low8: 83): 4;
    style(--low8: 84): 0;
    style(--low8: 85): 4;
    style(--low8: 86): 4;
    style(--low8: 87): 0;
    style(--low8: 88): 0;
    style(--low8: 89): 4;
    style(--low8: 90): 4;
    style(--low8: 91): 0;
    style(--low8: 92): 4;
    style(--low8: 93): 0;
    style(--low8: 94): 0;
    style(--low8: 95): 4;
    style(--low8: 96): 4;
    style(--low8: 97): 0;
    style(--low8: 98): 0;
    style(--low8: 99): 4;
    style(--low8: 100): 0;
    style(--low8: 101): 4;
    style(--low8: 102): 4;
    style(--low8: 103): 0;
    style(--low8: 104): 0;
    style(--low8: 105): 4;
    style(--low8: 106): 4;
    style(--low8: 107): 0;
    style(--low8: 108): 4;
    style(--low8: 109): 0;
    style(--low8: 110): 0;
    style(--low8: 111): 4;
    style(--low8: 112): 0;
    style(--low8: 113): 4;
    style(--low8: 114): 4;
    style(--low8: 115): 0;
    style(--low8: 116): 4;
    style(--low8: 117): 0;
    style(--low8: 118): 0;
    style(--low8: 119): 4;
    style(--low8: 120): 4;
    style(--low8: 121): 0;
    style(--low8: 122): 0;
    style(--low8: 123): 4;
    style(--low8: 124): 0;
    style(--low8: 125): 4;
    style(--low8: 126): 4;
    style(--low8: 127): 0;
    style(--low8: 128): 0;
    style(--low8: 129): 4;
    style(--low8: 130): 4;
    style(--low8: 131): 0;
    style(--low8: 132): 4;
    style(--low8: 133): 0;
    style(--low8: 134): 0;
    style(--low8: 135): 4;
    style(--low8: 136): 4;
    style(--low8: 137): 0;
    style(--low8: 138): 0;
    style(--low8: 139): 4;
    style(--low8: 140): 0;
    style(--low8: 141): 4;
    style(--low8: 142): 4;
    style(--low8: 143): 0;
    style(--low8: 144): 4;
    style(--low8: 145): 0;
    style(--low8: 146): 0;
    style(--low8: 147): 4;
    style(--low8: 148): 0;
    style(--low8: 149): 4;
    style(--low8: 150): 4;
    style(--low8: 151): 0;
    style(--low8: 152): 0;
    style(--low8: 153): 4;
    style(--low8: 154): 4;
    style(--low8: 155): 0;
    style(--low8: 156): 4;
    style(--low8: 157): 0;
    style(--low8: 158): 0;
    style(--low8: 159): 4;
    style(--low8: 160): 4;
    style(--low8: 161): 0;
    style(--low8: 162): 0;
    style(--low8: 163): 4;
    style(--low8: 164): 0;
    style(--low8: 165): 4;
    style(--low8: 166): 4;
    style(--low8: 167): 0;
    style(--low8: 168): 0;
    style(--low8: 169): 4;
    style(--low8: 170): 4;
    style(--low8: 171): 0;
    style(--low8: 172): 4;
    style(--low8: 173): 0;
    style(--low8: 174): 0;
    style(--low8: 175): 4;
    style(--low8: 176): 0;
    style(--low8: 177): 4;
    style(--low8: 178): 4;
    style(--low8: 179): 0;
    style(--low8: 180): 4;
    style(--low8: 181): 0;
    style(--low8: 182): 0;
    style(--low8: 183): 4;
    style(--low8: 184): 4;
    style(--low8: 185): 0;
    style(--low8: 186): 0;
    style(--low8: 187): 4;
    style(--low8: 188): 0;
    style(--low8: 189): 4;
    style(--low8: 190): 4;
    style(--low8: 191): 0;
    style(--low8: 192): 4;
    style(--low8: 193): 0;
    style(--low8: 194): 0;
    style(--low8: 195): 4;
    style(--low8: 196): 0;
    style(--low8: 197): 4;
    style(--low8: 198): 4;
    style(--low8: 199): 0;
    style(--low8: 200): 0;
    style(--low8: 201): 4;
    style(--low8: 202): 4;
    style(--low8: 203): 0;
    style(--low8: 204): 4;
    style(--low8: 205): 0;
    style(--low8: 206): 0;
    style(--low8: 207): 4;
    style(--low8: 208): 0;
    style(--low8: 209): 4;
    style(--low8: 210): 4;
    style(--low8: 211): 0;
    style(--low8: 212): 4;
    style(--low8: 213): 0;
    style(--low8: 214): 0;
    style(--low8: 215): 4;
    style(--low8: 216): 4;
    style(--low8: 217): 0;
    style(--low8: 218): 0;
    style(--low8: 219): 4;
    style(--low8: 220): 0;
    style(--low8: 221): 4;
    style(--low8: 222): 4;
    style(--low8: 223): 0;
    style(--low8: 224): 0;
    style(--low8: 225): 4;
    style(--low8: 226): 4;
    style(--low8: 227): 0;
    style(--low8: 228): 4;
    style(--low8: 229): 0;
    style(--low8: 230): 0;
    style(--low8: 231): 4;
    style(--low8: 232): 4;
    style(--low8: 233): 0;
    style(--low8: 234): 0;
    style(--low8: 235): 4;
    style(--low8: 236): 0;
    style(--low8: 237): 4;
    style(--low8: 238): 4;
    style(--low8: 239): 0;
    style(--low8: 240): 4;
    style(--low8: 241): 0;
    style(--low8: 242): 0;
    style(--low8: 243): 4;
    style(--low8: 244): 0;
    style(--low8: 245): 4;
    style(--low8: 246): 4;
    style(--low8: 247): 0;
    style(--low8: 248): 0;
    style(--low8: 249): 4;
    style(--low8: 250): 4;
    style(--low8: 251): 0;
    style(--low8: 252): 4;
    style(--low8: 253): 0;
    style(--low8: 254): 0;
    style(--low8: 255): 4;
  else: 0);
}

@function --andFlags16(--a <integer>, --b <integer>) returns <integer> {
  --res: --and(var(--a), var(--b));
  --pf: --parity(var(--res));
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 15) * 128);
  result: calc(var(--pf) + var(--zf) + var(--sf) + 2);
}

@function --andFlags8(--a <integer>, --b <integer>) returns <integer> {
  --full: --and(var(--a), var(--b));
  --res: --lowerBytes(var(--full), 8);
  --pf: --parity(var(--res));
  --zf: if(style(--res: 0): 64; else: 0);
  --sf: calc(--bit(var(--res), 7) * 128);
  result: calc(var(--pf) + var(--zf) + var(--sf) + 2);
}`;
