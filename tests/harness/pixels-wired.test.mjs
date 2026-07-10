// Test: verify pixel painter is wired into cabinet output.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert';

const out = 'tests/harness/.tmp-pixels.css';
execFileSync('node', ['builder/build.mjs', 'carts/test-carts/hello-text', '-o', out],
  { stdio: 'inherit' });
const css = readFileSync(out, 'utf8');
assert.ok(css.includes('MODE 13h PIXEL PAINTER'), 'painter block emitted');
assert.ok(css.includes('@function --paletteRGB'), 'palette function emitted');
assert.ok(/\.motherboard #p63999 \{/.test(css), 'full 320x200 grid emitted (last pixel)');
console.log('PASS pixels wired into cabinet');
