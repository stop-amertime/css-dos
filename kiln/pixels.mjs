// kiln/pixels.mjs
// Pure-CSS framebuffer painter: Mode 13h, CGA graphics and text modes.
//
// Emits one CSS rule per pixel that reads the pixel's VRAM byte(s)
// from packed memory storage (--__1mc{cell}) and maps them to a
// background-color, dispatched on the live BDA video-mode byte
// (0x449) via the shared --screenPx() function. Scoped under
// .motherboard (the machine host element). ALWAYS emitted; inert in
// the calcite/bridge players (which have no #pN nodes and render the
// framebuffer to an <img>). Only the raw player paints.
//
// Modes (decode mirrors the JS reference in web/shim/video-modes.mjs;
// the grid is 320x200, wider modes subsample every other source column):
//   0x00/0x01  40x25 text   - 8x8 glyph cells, exact fit
//   0x02/0x03/0x07  80x25 text - 4x8 cells (even glyph columns only)
//   0x04/0x05  CGA 320x200x4 - exact fit; 0x05 renders the mono palette
//   0x06       CGA 640x200x2 - even source columns only
//   0x13       VGA 320x200x256 - exact fit, DAC palette (--paletteRGB)
//   anything else falls back to 80x25 text (the BIOS remaps
//   unimplemented modes to text anyway).
//
// Text/CGA colours use the fixed VGA 16-colour palette (--vgaRGB),
// matching VGA_PALETTE_U32 in the JS decoder; text glyphs come from
// the 8x8 ROM font (embedded below as base64; same bitmap as
// bios/corduroy/cga-8x8.bin, which the corduroy splash and the
// harness shooters use), baked into the
// 2048-arm --fontRow() function at build time. Attribute-bit-7 blink
// and the cursor are not painted (they're time-based; the painter is
// a pure function of machine state).
//
// Cells referenced by a mode the cart never enters may be unmapped
// (e.g. no CGA aperture): the var() resolves invalid, poisoning only
// the locals of that mode's arm — the arm selected by --vidMode still
// paints correctly, and an arm fed invalid cells degrades to black
// (proven in tests/harness/pixels-render.playwright.mjs).
//
// This is CSS-DOS PLATFORM knowledge (VRAM geometry, DAC layout, CGA
// palette register) living in the EMITTER, exactly where
// memory.mjs/patterns/misc.mjs already keep VGA/DAC knowledge.
// Calcite sees only integer cells and background-color rules — the
// cardinal rule is untouched.

import { cellIdxOf, DAC_LINEAR } from './memory.mjs';

const FB_BASE = 0xA0000;      // Mode 13h framebuffer
const VRAM_TEXT = 0xB8000;    // text char+attr pairs (modes 0-3, 7)
const VRAM_CGA = 0xB8000;     // CGA 2-plane aperture (modes 4/5/6)
const MODE_ADDR = 0x449;      // BDA current video mode byte
const CGA_PAL_ADDR = 0x4F3;   // kiln shadow of OUT 0x3D9 (palette reg)

// Fixed VGA 16-colour palette — same values as VGA_PALETTE_U32 in
// web/shim/video-modes.mjs.
const VGA16 = [
  [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170],
  [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
  [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255],
  [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255],
];

// The 8x8 ROM font, base64 of bios/corduroy/cga-8x8.bin (2048 bytes).
// Embedded (not read off disk) because this module also runs in the
// browser-builder graph, where node:fs doesn't exist. Regenerate if
// the bin ever changes:
//   node -e "console.log(require('fs').readFileSync('bios/corduroy/cga-8x8.bin').toString('base64'))"
// Drift guard: tests/harness/pixels-render.playwright.mjs round-trips
// glyphs against the JS decoder, which reads the bin itself.
const FONT_B64 = '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';
let fontBytes = null;
function font() {
  if (!fontBytes) {
    fontBytes = Uint8Array.from(atob(FONT_B64), c => c.charCodeAt(0));
    if (fontBytes.length !== 2048) {
      throw new Error(`embedded cga-8x8 font size ${fontBytes.length} !== 2048 — FONT_B64 is corrupt`);
    }
  }
  return fontBytes;
}

// Extract the byte at linear address `addr` from its packed cell
// (--__1mc{cell}), the same idiom as emit-css.mjs's memory reads.
function cellByteExpr(addr) {
  const idx = cellIdxOf(addr);
  return (addr & 1) === 0
    ? `mod(var(--__1mc${idx}), 256)`
    : `round(down, var(--__1mc${idx}) / 256)`;
}

// DAC byte read for palette entry `e`, channel `c` (0=R,1=G,2=B),
// 6-bit value expanded to 8-bit.
function dacChannel8(entry, channel) {
  return `round(${cellByteExpr(DAC_LINEAR + entry * 3 + channel)} * 255 / 63)`;
}

// Shared 256-arm palette function: index -> rgb() from the live DAC.
// Written once; re-evaluated per call site (per pixel) with its --idx.
function emitPaletteFunction() {
  const arms = [];
  for (let e = 0; e < 256; e++) {
    const rgb = `rgb(${dacChannel8(e, 0)} ${dacChannel8(e, 1)} ${dacChannel8(e, 2)})`;
    arms.push(`    style(--idx: ${e}): ${rgb};`);
  }
  return `@function --paletteRGB(--idx <integer>) returns <color> {
  result: if(
${arms.join('\n')}
    else: rgb(0 0 0));
}`;
}

// Fixed 16-colour palette for text and CGA modes.
function emitVga16Function() {
  const arms = [];
  for (let e = 1; e < 16; e++) {
    const [r, g, b] = VGA16[e];
    arms.push(`    style(--i: ${e}): rgb(${r} ${g} ${b});`);
  }
  return `@function --vgaRGB(--i <integer>) returns <color> {
  result: if(
${arms.join('\n')}
    else: rgb(0 0 0));
}`;
}

// Glyph-row lookup: --k = char * 8 + row -> font byte (bit 7 =
// leftmost pixel). All-zero rows fall through to the else arm.
function emitFontFunction() {
  const f = font();
  const arms = [];
  for (let k = 0; k < 2048; k++) {
    if (f[k] !== 0) arms.push(`    style(--k: ${k}): ${f[k]};`);
  }
  return `@function --fontRow(--k <integer>) returns <integer> {
  result: if(
${arms.join('\n')}
    else: 0);
}`;
}

// Text/CGA colour selection. style() queries only work against typed
// function arguments (not calc'd locals), hence the small helpers.
function emitModeHelpers() {
  return `@function --pickFgBg(--on <integer>, --attr <integer>) returns <integer> {
  result: if(
    style(--on: 1): mod(var(--attr), 16);
    else: round(down, var(--attr) / 16));
}

/* --tw = char+attr word, --gy = glyph row, --gd = 2^(7 - glyph column) */
@function --textIdx(--tw <integer>, --gy <integer>, --gd <integer>) returns <integer> {
  --row: --fontRow(calc(mod(var(--tw), 256) * 8 + var(--gy)));
  result: --pickFgBg(mod(round(down, var(--row) / var(--gd)), 2), round(down, var(--tw) / 256));
}

/* CGA 320x200x4: pixel value 0 = background (palette reg bits 3..0);
   1..3 index the fixed palette pair picked by reg bit 5, brightened
   by bit 4 (VGA index = v*2 + bit5 + bit4*8). Mode 5 renders the
   mono ramp (dark grey / light grey / white) like the JS decoder. */
@function --cga4Idx(--v <integer>, --pal <integer>, --vm <integer>) returns <integer> {
  result: if(
    style(--v: 0): mod(var(--pal), 16);
    style(--vm: 5) and style(--v: 1): 8;
    style(--vm: 5) and style(--v: 2): 7;
    style(--vm: 5): 15;
    else: calc(var(--v) * 2 + mod(round(down, var(--pal) / 32), 2) + mod(round(down, var(--pal) / 16), 2) * 8));
}

/* CGA 640x200x2: colour 0 is black; colour 1 is the palette reg low
   nibble, defaulting to white when the nibble is 0 (stock IBM look). */
@function --cga6Fg(--n <integer>) returns <integer> {
  result: if(style(--n: 0): 15; else: var(--n));
}

@function --cga6Idx(--v <integer>, --pal <integer>) returns <integer> {
  --fg: --cga6Fg(mod(var(--pal), 16));
  result: if(style(--v: 0): 0; else: var(--fg));
}

/* Per-pixel mode dispatch. Args:
   --vm  video mode byte      --m13 Mode 13h framebuffer byte
   --cb  CGA aperture byte    --t40/--t80 text cell word (40/80 col)
   --gy  glyph row (y%8)      --d40/--d80 2^(7 - glyph/pixel column)
   --pal CGA palette register shadow */
@function --screenPx(--vm <integer>, --m13 <integer>, --cb <integer>,
    --t40 <integer>, --t80 <integer>, --gy <integer>,
    --d40 <integer>, --d80 <integer>, --pal <integer>) returns <color> {
  --ti: if(
    style(--vm: 0): --textIdx(var(--t40), var(--gy), var(--d40));
    style(--vm: 1): --textIdx(var(--t40), var(--gy), var(--d40));
    else: --textIdx(var(--t80), var(--gy), var(--d80)));
  --c4i: --cga4Idx(mod(round(down, var(--cb) * 2 / var(--d80)), 4), var(--pal), var(--vm));
  --c6i: --cga6Idx(mod(round(down, var(--cb) / var(--d80)), 2), var(--pal));
  result: if(
    style(--vm: 19): --paletteRGB(var(--m13));
    style(--vm: 4): --vgaRGB(var(--c4i));
    style(--vm: 5): --vgaRGB(var(--c4i));
    style(--vm: 6): --vgaRGB(var(--c6i));
    else: --vgaRGB(var(--ti)));
}`;
}

// The two dispatch inputs shared by every pixel, computed once on the
// machine element and inherited by the grid.
function emitVideoState() {
  return `@property --vidMode {
  syntax: '<integer>';
  inherits: true;
  initial-value: 3;
}

@property --vidPal {
  syntax: '<integer>';
  inherits: true;
  initial-value: 0;
}

.motherboard {
  --vidMode: ${cellByteExpr(MODE_ADDR)};
  --vidPal: ${cellByteExpr(CGA_PAL_ADDR)};
}`;
}

export function emitPixelPaintRules({ width = 320, height = 200 } = {}) {
  const lines = [];
  lines.push('/* ===== DISPLAY ===== */');
  lines.push('/* --- palette function --- */');
  lines.push(emitPaletteFunction());
  lines.push('/* --- VGA 16-colour palette (text + CGA modes) --- */');
  lines.push(emitVga16Function());
  lines.push('/* --- 8x8 ROM font (text modes) --- */');
  lines.push(emitFontFunction());
  lines.push('/* --- mode decode helpers --- */');
  lines.push(emitModeHelpers());
  lines.push('/* --- video state (BDA mode byte, CGA palette reg) --- */');
  lines.push(emitVideoState());
  const count = width * height;
  lines.push('/* --- pixel rules --- */');
  for (let i = 0; i < count; i++) {
    const x = i % width, y = (i - (i % width)) / width;
    // CGA aperture byte: even scanlines at +0, odd at +0x2000; 80
    // bytes per scanline, 4 pixels per byte. Mode 6 subsamples even
    // source columns, which lands on the same byte with the mode-4
    // divisor doubled — so one byte read serves modes 4, 5 and 6.
    const cga = cellByteExpr(VRAM_CGA + (y % 2) * 0x2000 + ((y - (y % 2)) / 2) * 80 + (x >> 2));
    // Text cell word (char lo, attr hi — always cell-aligned).
    const t40 = cellIdxOf(VRAM_TEXT + ((y >> 3) * 40 + (x >> 3)) * 2);
    const t80 = cellIdxOf(VRAM_TEXT + ((y >> 3) * 80 + (x >> 2)) * 2);
    const gy = y % 8;
    const d40 = 2 ** (7 - (x % 8));          // 40-col glyph column
    const d80 = 2 ** (7 - 2 * (x % 4));      // 80-col / CGA column
    lines.push(
      `.motherboard #p${i} { --ci: ${cellByteExpr(FB_BASE + i)}; ` +
      `background-color: --screenPx(var(--vidMode), var(--ci), ${cga}, ` +
      `var(--__1mc${t40}), var(--__1mc${t80}), ${gy}, ${d40}, ${d80}, var(--vidPal)); }`);
  }
  return lines.join('\n');
}
