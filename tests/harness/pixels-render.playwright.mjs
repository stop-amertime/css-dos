// Real-Chrome render proof for Mode 13h pixel painter.
//
// Builds a minimal 8×8 HTML page with hand-seeded --__1mc{cell} values for
// two framebuffer pixels + their DAC entries, renders in headless Chromium
// via Playwright, reads back computed backgroundColor, and asserts the exact
// expected rgb() values.
//
// Pixel 0: framebuffer index 5, DAC entry 5 = (R=63,G=0,B=31) 6-bit
//          → expected rgb(255, 0, 125)   [round(63*255/63)=255, round(31*255/63)=125]
//
// Pixel 7: framebuffer index 2, DAC entry 2 = (R=0,G=63,B=0) 6-bit
//          → expected rgb(0, 255, 0)
//
// Run: node tests/harness/pixels-render.playwright.mjs

let pw;
try {
  pw = await import('playwright');
} catch {
  const dir = process.env.PLAYWRIGHT_DIR;
  if (!dir) throw new Error('playwright not found — install it or set PLAYWRIGHT_DIR');
  const fallback = new URL('index.js', `file:///${dir.replace(/\\/g, '/')}/`).href;
  pw = (await import(fallback)).default ?? (await import(fallback));
}
const { chromium } = pw;

import { emitPixelPaintRules } from '../../kiln/pixels.mjs';
import { cellIdxOf, DAC_LINEAR } from '../../kiln/memory.mjs';
import assert from 'node:assert';

const W = 8, H = 8;
const painter = emitPixelPaintRules({ width: W, height: H });

const FB_BASE = 0xA0000;

// Pack a byte value into its cell entry (two bytes per cell, packed as lo | hi<<8).
function setByte(map, addr, val) {
  const idx = cellIdxOf(addr);
  const prev = map.get(idx) || 0;
  map.set(idx, (addr & 1) === 0
    ? (prev & 0xff00) | (val & 0xff)
    : (prev & 0x00ff) | ((val & 0xff) << 8));
}

const cells = new Map();

// Pixel 0 → colour index 5
setByte(cells, FB_BASE + 0, 5);
// DAC entry 5 = (R=63, G=0, B=31) 6-bit → rgb(255, 0, 125)
const DAC5 = DAC_LINEAR + 5 * 3;
setByte(cells, DAC5 + 0, 63);   // R6
setByte(cells, DAC5 + 1, 0);    // G6
setByte(cells, DAC5 + 2, 31);   // B6

// Pixel 7 → colour index 2
setByte(cells, FB_BASE + 7, 2);
// DAC entry 2 = (R=0, G=63, B=0) 6-bit → rgb(0, 255, 0)
const DAC2 = DAC_LINEAR + 2 * 3;
setByte(cells, DAC2 + 0, 0);    // R6
setByte(cells, DAC2 + 1, 63);   // G6
setByte(cells, DAC2 + 2, 0);    // B6

const cellDecls = [...cells].map(([i, v]) => `--__1mc${i}: ${v};`).join(' ');

const grid = Array.from({ length: W * H }, (_, i) => `<i id="p${i}"></i>`).join('');
const html = `<!doctype html><meta charset=utf-8>
<style>
.motherboard { ${cellDecls} }
#grid { display: grid; grid-template-columns: repeat(${W}, 8px); }
#grid i { width: 8px; height: 8px; display: block; }
${painter}
</style>
<div class="motherboard"><div id="grid">${grid}</div></div>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.setContent(html);

  const c0 = await page.$eval('#p0', el => getComputedStyle(el).backgroundColor);
  const c7 = await page.$eval('#p7', el => getComputedStyle(el).backgroundColor);

  console.log(`pixel 0 → ${c0}  (expected rgb(255, 0, 125))`);
  console.log(`pixel 7 → ${c7}  (expected rgb(0, 255, 0))`);

  assert.equal(c0, 'rgb(255, 0, 125)',
    `pixel 0 (index 5, DAC (63,0,31)) should be rgb(255, 0, 125), got ${c0}`);
  assert.equal(c7, 'rgb(0, 255, 0)',
    `pixel 7 (index 2, DAC (0,63,0)) should be rgb(0, 255, 0), got ${c7}`);

  console.log('PASS pixels render in Chrome');
} finally {
  await browser.close();
}
