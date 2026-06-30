// kiln/pixels.mjs
// Pure-CSS Mode 13h framebuffer painter.
//
// Emits one CSS rule per pixel that reads the pixel's framebuffer byte
// from packed memory storage (--__1mc{cell}) and (in Task 2) maps it
// through the live DAC palette to a background-color. ALWAYS emitted;
// inert in the calcite/bridge players (which have no #pN nodes and
// render the framebuffer to an <img>). Only the raw player paints.
//
// This is CSS-DOS PLATFORM knowledge (Mode 13h geometry, DAC layout)
// living in the EMITTER, exactly where memory.mjs/patterns/misc.mjs
// already keep VGA/DAC knowledge. Calcite sees only integer cells and
// background-color rules — the cardinal rule is untouched.

import { cellIdxOf } from './memory.mjs';

const FB_BASE = 0xA0000;

// Per-pixel colour-index read: extract the framebuffer byte at the
// pixel's linear address from its packed cell.
function indexExpr(addr) {
  const idx = cellIdxOf(addr);
  return (addr & 1) === 0
    ? `mod(var(--__1mc${idx}), 256)`
    : `round(down, var(--__1mc${idx}) / 256)`;
}

export function emitPixelPaintRules({ width = 320, height = 200 } = {}) {
  const lines = [];
  lines.push('/* ===== MODE 13h PIXEL PAINTER (raw player only) ===== */');
  const count = width * height;
  for (let i = 0; i < count; i++) {
    lines.push(`.cpu #p${i} { --ci: ${indexExpr(FB_BASE + i)}; }`);
  }
  return lines.join('\n');
}
