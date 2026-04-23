#!/usr/bin/env node
// Verify the CGA 0x06 (640x200x2) pipeline:
//
// Mode 6 is CGA's "hires mono" mode: 640×200 at 1 bpp, same 16 KB
// aperture as modes 4/5 at 0xB8000, same even/odd scanline interleave
// (even at 0x0000, odd at 0x2000). Byte packing is MSB-first with
// bit 7 = leftmost pixel. The palette register's low nibble selects a
// non-default foreground colour; when the nibble is 0 the decoder
// falls back to white (matches stock IBM CGA).
//
// Checks:
//   1. MODE_TABLE[0x06] is kind=cga2 @ 640×200 from 0xB8000.
//   2. BIOS (Corduroy + Gossamer) accepts mode 0x06 via INT 10h AH=00h.
//   3. Corduroy has a tty_gfx6 branch so teletype in mode 6 doesn't
//      corrupt VRAM by falling through to the char+attr path.
//   4. decodeCga2 packs bits correctly: known VRAM → known pixels.
//   5. decodeCga2 respects the palette-reg low nibble when it's
//      non-zero; falls back to white when the nibble is zero.
//   6. Cart's CGA aperture zone is emitted in the CSS cabinet.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const cartDir  = resolve(repoRoot, 'carts/cga6-hires');
const outDir   = resolve(repoRoot, 'tmp');
const outCss   = resolve(outDir, 'cga6-hires.test.css');

let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ok  ${msg}`); }
  else      { console.log(`  FAIL ${msg}`); failed++; }
}

// --- Build the cart --------------------------------------------------------
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
console.log('[build] carts/cga6-hires → tmp/cga6-hires.test.css');
execFileSync('node', ['builder/build.mjs', cartDir, '-o', outCss], {
  cwd: repoRoot,
  stdio: ['ignore', 'ignore', 'inherit'],
});
const css = readFileSync(outCss, 'utf8');

// --- CGA aperture present --------------------------------------------------
console.log('[check] CGA aperture covered by @property declarations');
assert(/^@property --m753664 /m.test(css),
  '--m753664 (0xB8000) declared — aperture low bound present');
assert(/^@property --m770047 /m.test(css),
  '--m770047 (0xBBFFF) declared — aperture high bound present');
assert(!/^@property --m770048 /m.test(css),
  '--m770048 (0xBC000) NOT declared — aperture is half-open');

// --- BIOS handlers accept mode 0x06 ---------------------------------------
console.log('[check] BIOS handlers accept mode 0x06');
const corduroy = readFileSync(resolve(repoRoot, 'bios/corduroy/handlers.asm'), 'utf8');
const gossamer = readFileSync(resolve(repoRoot, 'bios/gossamer/gossamer.asm'), 'utf8');
assert(/cmp al, 0x06/.test(corduroy),
  'Corduroy set_mode has a `cmp al, 0x06` branch (accepts mode 0x06)');
assert(/cmp al, 0x06/.test(gossamer),
  'Gossamer set_mode has a `cmp al, 0x06` branch (accepts mode 0x06)');
assert(/^\.tty_gfx6:/m.test(corduroy) || /\.tty_gfx6:/.test(corduroy),
  'Corduroy has a tty_gfx6 branch (AH=0Eh in mode 6 does not corrupt VRAM)');
assert(/bda_mode_06h/.test(corduroy),
  'Corduroy writes mode-6-specific BDA geometry (video_columns = 80)');

// --- JS decoder: MODE_TABLE shape ------------------------------------------
console.log('[check] MODE_TABLE[0x06] metadata');
const videoModesPath = resolve(repoRoot, '..', 'calcite/web/video-modes.mjs');
const mod = await import(pathToFileURL(videoModesPath).href);
const { decodeCga2, pickMode } = mod;

const modeInfo = pickMode(0x06);
assert(modeInfo && modeInfo.kind === 'cga2',
  'MODE_TABLE[0x06] is kind=cga2');
assert(modeInfo && modeInfo.width === 640 && modeInfo.height === 200,
  'MODE_TABLE[0x06] geometry is 640x200');
assert(modeInfo && modeInfo.vramAddr === 0xB8000,
  'MODE_TABLE[0x06] reads from 0xB8000');

// --- JS decoder: MSB-first 1bpp packing ------------------------------------
// Tiny hand-built VRAM: put 0x80 (= 0b10000000 = leftmost-pixel-only) at
// plane-0 row 0. With the default palette (fg=white, bg=black), we
// should see one white pixel at (0, 0) and seven black pixels at (1..7, 0).
console.log('[check] JS decoder 1bpp MSB-first packing');
const vram = new Uint8Array(0x4000);
vram[0] = 0x80;                   // plane 0 scanline 0: leftmost pixel set
vram[0x2000] = 0x01;              // plane 1 scanline 0 (== output y=1): rightmost
const outRGBA = new Uint8Array(640 * 200 * 4);
decodeCga2(vram, 0x00, outRGBA);  // palReg low nibble=0 → fg falls back to white

function pixel(y, x) {
  const off = (y * 640 + x) * 4;
  return [outRGBA[off], outRGBA[off + 1], outRGBA[off + 2]];
}
function eq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }

// Plane 0 scanline → output y=0 (even).
assert(eq(pixel(0, 0), [255, 255, 255]), 'y=0 x=0 is white (bit 7 set)');
assert(eq(pixel(0, 1), [  0,   0,   0]), 'y=0 x=1 is black (bit 6 clear)');
assert(eq(pixel(0, 7), [  0,   0,   0]), 'y=0 x=7 is black (bit 0 clear)');

// Plane 1 scanline → output y=1 (odd). First byte is 0x01: rightmost set.
assert(eq(pixel(1, 0), [  0,   0,   0]), 'y=1 x=0 is black (bit 7 clear)');
assert(eq(pixel(1, 6), [  0,   0,   0]), 'y=1 x=6 is black (bit 1 clear)');
assert(eq(pixel(1, 7), [255, 255, 255]), 'y=1 x=7 is white (bit 0 set)');

// Scanlines with VRAM=0 everywhere should be uniformly black.
assert(eq(pixel(10, 100), [0, 0, 0]), 'untouched scanline is black');

// --- Smoke cart band pattern ----------------------------------------------
// Reproduce the tests/cga6_stripes.asm VRAM layout and spot-check bands.
console.log('[check] JS decoder reproduces cart stripe pattern');
const cartVram = new Uint8Array(0x4000);
for (let y = 0; y < 200; y++) {
  const rowDiv25 = Math.floor(y / 25);
  const isWhite = (rowDiv25 & 1) === 1;
  const byte = isWhite ? 0xFF : 0x00;
  const plane = y & 1;
  const row = y >> 1;
  const base = plane * 0x2000 + row * 80;
  for (let i = 0; i < 80; i++) cartVram[base + i] = byte;
}
const cartOut = new Uint8Array(640 * 200 * 4);
decodeCga2(cartVram, 0x00, cartOut);

function sampleCart(y, x = 320) {
  const off = (y * 640 + x) * 4;
  return [cartOut[off], cartOut[off + 1], cartOut[off + 2]];
}
assert(eq(sampleCart(12),  [  0,   0,   0]), 'band 0 (rows 0..24) is black');
assert(eq(sampleCart(37),  [255, 255, 255]), 'band 1 (rows 25..49) is white');
assert(eq(sampleCart(62),  [  0,   0,   0]), 'band 2 (rows 50..74) is black');
assert(eq(sampleCart(87),  [255, 255, 255]), 'band 3 (rows 75..99) is white');
assert(eq(sampleCart(112), [  0,   0,   0]), 'band 4 (rows 100..124) is black');
assert(eq(sampleCart(137), [255, 255, 255]), 'band 5 (rows 125..149) is white');
assert(eq(sampleCart(162), [  0,   0,   0]), 'band 6 (rows 150..174) is black');
assert(eq(sampleCart(187), [255, 255, 255]), 'band 7 (rows 175..199) is white');

// Band edges — check interleave routing.
assert(eq(sampleCart(24),  [  0,   0,   0]), 'last row of black band still black');
assert(eq(sampleCart(25),  [255, 255, 255]), 'first row of white band now white');

// --- Palette-reg low nibble selects foreground when non-zero ---------------
console.log('[check] palette-reg low nibble selects foreground');
const nibbleVram = new Uint8Array(0x4000);
nibbleVram[0] = 0xFF;            // row 0 all foreground
const outRed = new Uint8Array(640 * 200 * 4);
decodeCga2(nibbleVram, 0x04, outRed);   // low nibble 4 = red (VGA index 4)
const redPx = [outRed[0], outRed[1], outRed[2]];
assert(redPx[0] === 170 && redPx[1] === 0 && redPx[2] === 0,
  'palReg low-nibble=4 → foreground is red (VGA #4)');

const outCyan = new Uint8Array(640 * 200 * 4);
decodeCga2(nibbleVram, 0x0B, outCyan);  // low nibble 11 = bright cyan
const cyanPx = [outCyan[0], outCyan[1], outCyan[2]];
assert(cyanPx[0] === 85 && cyanPx[1] === 255 && cyanPx[2] === 255,
  'palReg low-nibble=11 → foreground is bright cyan (VGA #11)');

// --- Report ----------------------------------------------------------------
if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log('\nAll CGA 0x06 checks passed.');
