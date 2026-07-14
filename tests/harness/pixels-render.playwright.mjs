// Real-Chrome render proof for the pixel painter (all mode families).
//
// Builds a minimal 8×8 HTML page per scenario with hand-seeded
// --__1mc{cell} values (VRAM + BDA mode byte + palette state), renders
// in headless Chromium via Playwright, reads back computed
// backgroundColor, and asserts the exact expected rgb() values.
//
// Scenarios:
//   mode 0x13 - framebuffer indices through the live DAC (--paletteRGB)
//   mode 0x03 - 80×25 text: glyph 'A' white-on-blue, sampled from the
//               8×8 ROM font at even glyph columns; pixels whose text
//               cell is unseeded degrade to black (invalid isolation)
//   mode 0x04 - CGA 320×200×4, palette 1, odd-scanline plane
//   mode 0x05 - same VRAM, mono palette
//   mode 0x06 - CGA 640×200×2, default white foreground
//
// Run: node tests/harness/pixels-render.playwright.mjs

let pw;
try {
  pw = await import('playwright');
} catch {
  const dir = process.env.PLAYWRIGHT_DIR;
  if (!dir) throw new Error('playwright not found - install it or set PLAYWRIGHT_DIR');
  const fallback = new URL('index.js', `file:///${dir.replace(/\\/g, '/')}/`).href;
  pw = (await import(fallback)).default ?? (await import(fallback));
}
const { chromium } = pw;

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emitPixelPaintRules } from '../../kiln/pixels.mjs';
import { cellIdxOf, DAC_LINEAR } from '../../kiln/memory.mjs';
import assert from 'node:assert';

const W = 8, H = 8;
const painter = emitPixelPaintRules({ width: W, height: H });

const FB_BASE = 0xA0000;
const VRAM = 0xB8000;
const MODE_ADDR = 0x449;
const CGA_PAL_ADDR = 0x4F3;

const FONT = new Uint8Array(readFileSync(resolve(
  dirname(fileURLToPath(import.meta.url)), '..', '..', 'bios', 'corduroy', 'cga-8x8.bin')));

// Pack a byte value into its cell entry (two bytes per cell, packed as lo | hi<<8).
function setByte(map, addr, val) {
  const idx = cellIdxOf(addr);
  const prev = map.get(idx) || 0;
  map.set(idx, (addr & 1) === 0
    ? (prev & 0xff00) | (val & 0xff)
    : (prev & 0x00ff) | ((val & 0xff) << 8));
}

function pageFor(cells) {
  const cellDecls = [...cells].map(([i, v]) => `--__1mc${i}: ${v};`).join(' ');
  const grid = Array.from({ length: W * H }, (_, i) => `<i id="p${i}"></i>`).join('');
  return `<!doctype html><meta charset=utf-8>
<style>
.motherboard { ${cellDecls} }
#grid { display: grid; grid-template-columns: repeat(${W}, 8px); }
#grid i { width: 8px; height: 8px; display: block; }
${painter}
</style>
<div class="motherboard"><div id="grid">${grid}</div></div>`;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function colorsAt(cells, pixels) {
  await page.setContent(pageFor(cells));
  const out = {};
  for (const i of pixels) {
    out[i] = await page.$eval(`#p${i}`, el => getComputedStyle(el).backgroundColor);
  }
  return out;
}

try {
  // ---- mode 0x13: framebuffer through the live DAC ----
  {
    const cells = new Map();
    setByte(cells, MODE_ADDR, 0x13);
    setByte(cells, FB_BASE + 0, 5);
    const DAC5 = DAC_LINEAR + 5 * 3;
    setByte(cells, DAC5 + 0, 63); setByte(cells, DAC5 + 1, 0); setByte(cells, DAC5 + 2, 31);
    setByte(cells, FB_BASE + 7, 2);
    const DAC2 = DAC_LINEAR + 2 * 3;
    setByte(cells, DAC2 + 0, 0); setByte(cells, DAC2 + 1, 63); setByte(cells, DAC2 + 2, 0);

    const c = await colorsAt(cells, [0, 7]);
    assert.equal(c[0], 'rgb(255, 0, 125)',
      `mode 13h pixel 0 (index 5, DAC (63,0,31)) should be rgb(255, 0, 125), got ${c[0]}`);
    assert.equal(c[7], 'rgb(0, 255, 0)',
      `mode 13h pixel 7 (index 2, DAC (0,63,0)) should be rgb(0, 255, 0), got ${c[7]}`);
    console.log('PASS mode 13h renders in Chrome');
  }

  // ---- mode 0x03: 80x25 text, 'A' white-on-blue at cell (0,0) ----
  {
    const cells = new Map();
    setByte(cells, MODE_ADDR, 0x03);
    setByte(cells, VRAM + 0, 0x41);   // 'A'
    setByte(cells, VRAM + 1, 0x1F);   // white on blue

    const ids = Array.from({ length: H * 4 }, (_, k) => (k % 4) + Math.floor(k / 4) * W);
    const c = await colorsAt(cells, [...ids, 4]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < 4; x++) {
        // 80-col cells are 4px wide: pixel x samples glyph column 2x.
        const on = (FONT[0x41 * 8 + y] >> (7 - 2 * x)) & 1;
        const want = on ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 170)';
        const got = c[y * W + x];
        assert.equal(got, want, `text pixel (${x},${y}) glyph bit ${on}: want ${want}, got ${got}`);
      }
    }
    // Pixel 4 reads the unseeded second text cell: the var() resolves
    // invalid and the lookup chain degrades to the else arms → black.
    assert.equal(c[4], 'rgb(0, 0, 0)',
      `unseeded text cell should degrade to black, got ${c[4]}`);
    console.log("PASS text mode renders 'A' in Chrome (+ invalid isolation)");
  }

  // ---- modes 0x04/0x05: CGA 4-colour, both scanline planes ----
  {
    const cells = new Map();
    setByte(cells, MODE_ADDR, 0x04);
    setByte(cells, CGA_PAL_ADDR, 0x20);   // palette 1, intensity 0, bg 0
    setByte(cells, VRAM + 0, 0x1B);       // y=0: pixel values 0,1,2,3
    setByte(cells, VRAM + 0x2000, 0xC0);  // y=1 (odd plane): pixel value 3,0,0,0

    const c = await colorsAt(cells, [0, 1, 2, 3, W]);
    assert.equal(c[0], 'rgb(0, 0, 0)', `cga4 v0 bg, got ${c[0]}`);
    assert.equal(c[1], 'rgb(0, 170, 170)', `cga4 v1 cyan, got ${c[1]}`);
    assert.equal(c[2], 'rgb(170, 0, 170)', `cga4 v2 magenta, got ${c[2]}`);
    assert.equal(c[3], 'rgb(170, 170, 170)', `cga4 v3 light grey, got ${c[3]}`);
    assert.equal(c[W], 'rgb(170, 170, 170)', `cga4 odd scanline v3, got ${c[W]}`);

    // Same VRAM in mode 5 → mono ramp.
    setByte(cells, MODE_ADDR, 0x05);
    const m = await colorsAt(cells, [1, 2, 3]);
    assert.equal(m[1], 'rgb(85, 85, 85)', `cga5 v1 dark grey, got ${m[1]}`);
    assert.equal(m[2], 'rgb(170, 170, 170)', `cga5 v2 light grey, got ${m[2]}`);
    assert.equal(m[3], 'rgb(255, 255, 255)', `cga5 v3 white, got ${m[3]}`);
    console.log('PASS CGA mode 4/5 renders in Chrome');
  }

  // ---- mode 0x06: CGA 640x200x2, default white fg, even source columns ----
  {
    const cells = new Map();
    setByte(cells, MODE_ADDR, 0x06);
    setByte(cells, VRAM + 0, 0x80);   // source pixel 0 set → output x=0

    const c = await colorsAt(cells, [0, 1]);
    assert.equal(c[0], 'rgb(255, 255, 255)', `cga2 set bit → white, got ${c[0]}`);
    assert.equal(c[1], 'rgb(0, 0, 0)', `cga2 clear bit → black, got ${c[1]}`);
    console.log('PASS CGA mode 6 renders in Chrome');
  }

  console.log('PASS pixels render in Chrome');
} finally {
  await browser.close();
}
