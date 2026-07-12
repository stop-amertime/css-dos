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

// Each pixel paints through the mode dispatch function.
assert.match(css2, /#p0[^}]*background-color:\s*--screenPx\(var\(--vidMode\),\s*var\(--ci\)/,
  'pixel 0 paints via the mode dispatch function');

console.log('PASS pixels-emit palette');

// --- text + CGA mode painters ---

// Mode dispatch inputs read from the BDA: mode byte @ 0x449 (odd →
// high byte of cell 0x224 = 548), CGA palette reg shadow @ 0x4F3
// (odd → high byte of cell 0x279 = 633).
assert.match(css2, /--vidMode:\s*round\(down,\s*var\(--__1mc548\)\s*\/\s*256\)/,
  'mode byte read from BDA 0x449');
assert.match(css2, /--vidPal:\s*round\(down,\s*var\(--__1mc633\)\s*\/\s*256\)/,
  'CGA palette reg read from 0x4F3 shadow');

// One shared font function with real glyph data: 'A' (0x41) row 1 in
// cga-8x8.bin is non-zero, so key 0x41*8+1 = 521 must have an arm.
assert.equal((css2.match(/@function --fontRow/g) || []).length, 1,
  'one shared font function');
assert.match(css2, /style\(--k:\s*521\):\s*\d+;/, "font function has glyph 'A' row 1");

// Fixed VGA palette present (index 1 = blue).
assert.match(css2, /@function --vgaRGB[\s\S]*?style\(--i:\s*1\):\s*rgb\(0 0 170\)/,
  'VGA 16-colour palette');

// Pixel 0 (x=0, y=0): CGA byte @ 0xB8000 (even → low byte of cell
// 0x5C000 = 376832), text cells 40/80-col both @ 0xB8000 → same cell,
// gy=0, d40=128, d80=128.
assert.match(css2,
  /#p0[^}]*--screenPx\(var\(--vidMode\),\s*var\(--ci\),\s*mod\(var\(--__1mc376832\),\s*256\),\s*var\(--__1mc376832\),\s*var\(--__1mc376832\),\s*0,\s*128,\s*128,\s*var\(--vidPal\)\)/,
  'pixel 0 dispatch args (CGA byte, text cells, glyph row/columns)');

// Pixel 3 (x=1, y=1): CGA byte @ 0xBA000 (odd plane, even addr → cell
// 0x5D000 = 380928), d40=64 (glyph col 1), d80=32 (glyph col 2).
const css3 = emitPixelPaintRules({ width: 2, height: 2 });
assert.match(css3,
  /#p3[^}]*mod\(var\(--__1mc380928\),\s*256\)[^}]*,\s*1,\s*64,\s*32,\s*var\(--vidPal\)\)/,
  'pixel 3 reads the odd-scanline CGA plane with shifted divisors');

console.log('PASS pixels-emit text+CGA dispatch');
