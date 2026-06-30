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
// Pixel rules must be scoped so they only match inside .cpu host.
assert.match(css, /\.cpu\s+#p0\b|\.cpu\s*>\s*[^{]*#p0\b|#p0[^{]*\{[^}]*--ci/,
  'pixel rules present');

console.log('PASS pixels-emit index extraction');
