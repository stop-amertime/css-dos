#!/usr/bin/env node
// Verify the CGA 0x05 (320x200x4 mono) pipeline:
//
// Mode 5 shares the 0x04 framebuffer layout byte-for-byte — the only
// difference is the colour-burst disable on real CGA composite hardware
// collapses the three non-background colours into three greys. Our
// renderer models that by forcing a fixed grey ramp in decodeCga4's
// `mono` path, ignoring the palette-select / intensity bits entirely.
//
// Checks:
//   1. MODE_TABLE[0x05] is kind=cga4 with mono:true and points at 0xB8000.
//   2. decodeCga4 with { mono: true } returns black / dark-grey /
//      light-grey / white for colour indices 0..3.
//   3. Those outputs do NOT change when palette-reg bits 4/5 flip
//      (intensity and palette-select are electrically ignored in mode 5).
//   4. The palette-reg low nibble IS still honoured for colour 0
//      (background), because real mode 5 hardware still latches the bg
//      nibble — it's just the colour-burst signal that changes.
//   5. BIOS (Corduroy + Gossamer) has an `cmp al, 0x05` branch in set_mode
//      so INT 10h AX=0005h doesn't silently remap to mode 3.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const cartDir  = resolve(repoRoot, 'carts/cga5-mono');
const outDir   = resolve(repoRoot, 'tmp');
const outCss   = resolve(outDir, 'cga5-mono.test.css');

let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ok  ${msg}`); }
  else      { console.log(`  FAIL ${msg}`); failed++; }
}

// --- Build the cart --------------------------------------------------------
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
console.log('[build] carts/cga5-mono → tmp/cga5-mono.test.css');
execFileSync('node', ['builder/build.mjs', cartDir, '-o', outCss], {
  cwd: repoRoot,
  stdio: ['ignore', 'ignore', 'inherit'],
});
const css = readFileSync(outCss, 'utf8');

// --- CGA aperture present --------------------------------------------------
// Mode 5 uses the same 16 KB aperture as mode 4; we're just confirming
// that cart manifests opting into cgaGfx get the zone emitted.
console.log('[check] CGA aperture covered by @property declarations');
assert(/^@property --m753664 /m.test(css),
  '--m753664 (0xB8000) declared — aperture low bound present');
assert(/^@property --m770047 /m.test(css),
  '--m770047 (0xBBFFF) declared — aperture high bound present');
assert(!/^@property --m770048 /m.test(css),
  '--m770048 (0xBC000) NOT declared — aperture is half-open');

// --- Port 0x3D9 still decodes ---------------------------------------------
// Mode 5 carts also write the palette reg (the low nibble still sets
// background colour). Kiln's decode must emit for this cart too.
console.log('[check] port 0x3D9 decode emitted by kiln');
assert(/style\(--q1:\s*985\).*1267/.test(css),
  'OUT imm8 form writes palette byte to linear 0x04F3 (1267)');
assert(/style\(--__1DX:\s*985\).*1267/.test(css),
  'OUT DX form writes palette byte to linear 0x04F3 (1267)');

// --- BIOS handlers accept mode 0x05 ---------------------------------------
console.log('[check] BIOS handlers accept mode 0x05');
const corduroy = readFileSync(resolve(repoRoot, 'bios/corduroy/handlers.asm'), 'utf8');
const gossamer = readFileSync(resolve(repoRoot, 'bios/gossamer/gossamer.asm'), 'utf8');
assert(/cmp al, 0x05/.test(corduroy),
  'Corduroy set_mode has a `cmp al, 0x05` branch (accepts mode 0x05)');
assert(/cmp al, 0x05/.test(gossamer),
  'Gossamer set_mode has a `cmp al, 0x05` branch (accepts mode 0x05)');

// --- JS decoder: MODE_TABLE shape ------------------------------------------
console.log('[check] MODE_TABLE[0x05] metadata');
const videoModesPath = resolve(repoRoot, '..', 'calcite/web/video-modes.mjs');
const mod = await import(pathToFileURL(videoModesPath).href);
const { decodeCga4, pickMode } = mod;

const modeInfo = pickMode(0x05);
assert(modeInfo && modeInfo.kind === 'cga4',
  'MODE_TABLE[0x05] is kind=cga4 (shares decoder with 0x04)');
assert(modeInfo && modeInfo.width === 320 && modeInfo.height === 200,
  'MODE_TABLE[0x05] geometry is 320x200');
assert(modeInfo && modeInfo.vramAddr === 0xB8000,
  'MODE_TABLE[0x05] reads from 0xB8000');
assert(modeInfo && modeInfo.mono === true,
  'MODE_TABLE[0x05] has mono:true flag');

// --- JS decoder: mono palette output ---------------------------------------
// Same 4-band VRAM image as cga4.test.mjs. In mono mode the output should
// be black / dark grey / light grey / white (VGA indices 0, 8, 7, 15 →
// 0x000000, 0x555555, 0xAAAAAA, 0xFFFFFF), regardless of what bits 4/5
// of the palette register are set to.
console.log('[check] JS decoder produces the expected 4 grey bands');
const vram = new Uint8Array(0x4000);
for (let y = 0; y < 200; y++) {
  const c = Math.floor(y / 50);
  const plane = y & 1;
  const row = y >> 1;
  const byte = (c | (c << 2) | (c << 4) | (c << 6)) & 0xFF;
  const base = plane * 0x2000 + row * 80;
  for (let i = 0; i < 80; i++) vram[base + i] = byte;
}

function sample(rgba, y) {
  const off = (y * 320 + 160) * 4;
  return [rgba[off], rgba[off + 1], rgba[off + 2]];
}
function eq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }

// palReg = 0x30 = palette-1 + intensity + bg=black. In mode 4 this gives
// bright cyan/magenta/white; in mode 5 those bits must be ignored.
const outA = new Uint8Array(320 * 200 * 4);
decodeCga4(vram, 0x30, outA, { mono: true });

assert(eq(sample(outA,  25), [  0,   0,   0]), 'band 0 (y=25)  → black');
assert(eq(sample(outA,  75), [ 85,  85,  85]), 'band 1 (y=75)  → dark grey (0x55)');
assert(eq(sample(outA, 125), [170, 170, 170]), 'band 2 (y=125) → light grey (0xAA)');
assert(eq(sample(outA, 175), [255, 255, 255]), 'band 3 (y=175) → white');

// --- Ignore palette-select / intensity bits --------------------------------
// Run the decoder four times: bits 4/5 in all combinations. As long as the
// low nibble (bg) is unchanged, every output must be identical.
console.log('[check] mono mode ignores palette-select and intensity bits');
const outB = new Uint8Array(320 * 200 * 4);
decodeCga4(vram, 0x00, outB, { mono: true });   // palette 0, no intensity, bg=black
const outC = new Uint8Array(320 * 200 * 4);
decodeCga4(vram, 0x10, outC, { mono: true });   // intensity only, bg=black
const outD = new Uint8Array(320 * 200 * 4);
decodeCga4(vram, 0x20, outD, { mono: true });   // palette 1 only, bg=black

function bufEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

assert(bufEq(outA, outB), 'palReg=0x30 and 0x00 produce identical pixels (bits 4/5 ignored)');
assert(bufEq(outA, outC), 'palReg=0x30 and 0x10 produce identical pixels (intensity ignored)');
assert(bufEq(outA, outD), 'palReg=0x30 and 0x20 produce identical pixels (palette-select ignored)');

// --- Background nibble IS honoured in mono mode ----------------------------
// Real CGA mode 5 still latches the bg-colour nibble — only the colour
// burst is disabled. Games that set mode 5 and then change bg colour
// expect it to work.
console.log('[check] mono mode honours the background nibble');
// palReg = 0x34 = same bits 4/5 as 0x30, but bg = 4 (red, VGA index 4).
const outE = new Uint8Array(320 * 200 * 4);
decodeCga4(vram, 0x34, outE, { mono: true });
assert(eq(sample(outE,  25), [170,   0,   0]),
  'band 0 honours bg nibble (palReg=0x34 → red)');
// Bands 1..3 must still be the fixed mono ramp regardless of bg.
assert(eq(sample(outE,  75), [ 85,  85,  85]),
  'band 1 still dark grey when bg changes');
assert(eq(sample(outE, 175), [255, 255, 255]),
  'band 3 still white when bg changes');

// --- Report ----------------------------------------------------------------
if (failed) { console.error(`\n${failed} check(s) FAILED`); process.exit(1); }
console.log('\nAll CGA 0x05 checks passed.');
