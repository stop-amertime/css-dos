// tests/harness/pixels-emit.test.mjs
import { emitPixelPaintRules } from '../../kiln/pixels.mjs';
import assert from 'node:assert';

const css = emitPixelPaintRules({ width: 2, height: 2 });

// 2x2 = 4 pixels, addresses 0xA0000..0xA0003.
// Pixel 0 @ 0xA0000 (even) → low byte of cell 0xA0000>>1 = 0x50000.
assert.match(css, /#p0\b[^}]*--ci:\s*mod\(var\(--__1mc327680\),\s*256\)/,
  'pixel 0 reads low byte of cell 0x50000');
// Pixel 1 @ 0xA0001 (odd) → high byte of same cell.
assert.match(css, /#p1\b[^}]*--ci:\s*round\(down,\s*var\(--__1mc327680\)\s*\/\s*256\)/,
  'pixel 1 reads high byte of cell 0x50000');
// Exactly 4 pixel rules.
assert.equal((css.match(/#p\d+\s*\{/g) || []).length, 4, 'one rule per pixel');
// Pixel rules must be scoped so they only match inside the .motherboard host.
assert.match(css, /\.motherboard\s+#p0\b|\.motherboard\s*>\s*[^{]*#p0\b|#p0[^{]*\{[^}]*--ci/,
  'pixel rules present');

console.log('PASS pixels-emit index extraction');

const css2 = emitPixelPaintRules({ width: 2, height: 2 });

// The shared palette @function is emitted exactly once.
assert.equal((css2.match(/@function --paletteRGB/g) || []).length, 1,
  'one shared palette function');

// It reads DAC cells. Entry 1 R-byte @ DAC_LINEAR + 3 = 0x100003 (odd)
// → high byte of cell 0x80001 (0x100003>>1 = 0x80001).
assert.match(css2, /round\(down,\s*var\(--__1mc524289\)\s*\/\s*256\)/,
  'palette reads DAC entry 1 red from correct cell/half');

// 6->8 bit expansion present.
assert.match(css2, /\*\s*255\s*\/\s*63|255\s*\/\s*63/, '6->8 bit expansion');

// Each pixel paints from the function.
assert.match(css2, /#p0[^}]*background-color:\s*--paletteRGB\(var\(--ci\)\)/,
  'pixel 0 paints via palette function');

console.log('PASS pixels-emit palette');
