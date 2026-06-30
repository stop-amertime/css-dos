// kiln/pixels.mjs
// Pure-CSS Mode 13h framebuffer painter.
//
// Emits one CSS rule per pixel that reads the pixel's framebuffer byte
// from packed memory storage (--__1mc{cell}) and maps it through the
// live DAC palette to a background-color. ALWAYS emitted; inert in the
// calcite/bridge players (which have no #pN nodes and render the
// framebuffer to an <img>). Only the raw player paints.
//
// The framebuffer (0xA0000) and DAC (0x100000) cells are only emitted
// for carts with gfx memory (memory.mjs prunes them otherwise). For a
// non-gfx cart the referenced --__1mc{cell} is undeclared, so var()
// resolves invalid → --ci invalid → the palette's `else` arm →
// rgb(0 0 0) black. That's correct: such carts never paint Mode 13h.
//
// This is CSS-DOS PLATFORM knowledge (Mode 13h geometry, DAC layout)
// living in the EMITTER, exactly where memory.mjs/patterns/misc.mjs
// already keep VGA/DAC knowledge. Calcite sees only integer cells and
// background-color rules — the cardinal rule is untouched.

import { cellIdxOf, DAC_LINEAR } from './memory.mjs';

const FB_BASE = 0xA0000;

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

export function emitPixelPaintRules({ width = 320, height = 200 } = {}) {
  const lines = [];
  lines.push('/* ===== MODE 13h PIXEL PAINTER (raw player only) ===== */');
  lines.push(emitPaletteFunction());
  const count = width * height;
  for (let i = 0; i < count; i++) {
    lines.push(
      `.cpu #p${i} { --ci: ${cellByteExpr(FB_BASE + i)}; ` +
      `background-color: --paletteRGB(var(--ci)); }`);
  }
  return lines.join('\n');
}
