// End-to-end test for the calcite player's REAL mouse input path:
//   overlay cell click → /_kbd?key=mc-N form submit → service worker →
//   {type:'kbd-event'} → bridge pulse → engine.set_pseudo_class_active →
//   input-edge recogniser → cabinet --mouseTgt → serial-mouse packet
//   machine → 8250 UART → IRQ 4 → Windows 1.01 MOUSE.DRV.
//
// Sibling of kbd-e2e.playwright.mjs (same dev-server + build.html
// harness — see that file's header for why the bench can't cover real
// input). Builds carts/windows101 in-browser, boots to the MS-DOS
// Executive (CGA mode 6), then clicks CLOCK.EXE's overlay cell —
// select, then double-click — and asserts the CGA framebuffer changed
// substantially (the Clock app took the screen over).
//
//   node web/tests/mouse-e2e.playwright.mjs
//
// Needs the dev server (npm run dev) on :5173 (BASE env to override)
// and system Chrome. ~4 minutes.

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

import { existsSync } from 'node:fs';
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium',
].filter(Boolean);
const SYS_CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
const BASE = process.env.BASE || 'http://localhost:5173';

// CLOCK.EXE sits on row 11 / col 5 of the 80×25 cell grid when the
// windows101 floppy's Executive listing is up (guest pixel ~(44,92)).
const CLOCK_CELL = 'mc-885';

const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

const browser = await chromium.launch({
  headless: true,
  executablePath: SYS_CHROME,
  args: [
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling',
    '--disable-features=AutomaticTabDiscarding,MemorySaverMode,BackForwardCache',
    '--disable-dev-shm-usage',
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

const buildPage = await ctx.newPage();
buildPage.on('crash', () => log('!! build page CRASHED'));
buildPage.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`  [build-console:error] ${msg.text()}`);
});

log('opening build.html');
await buildPage.goto(`${BASE}/build.html`, { waitUntil: 'load' });
await buildPage.waitForSelector('input[name="cart"][value="windows101"]', { timeout: 20000 });
await buildPage.evaluate(() => {
  const el = document.querySelector('input[name="cart"][value="windows101"]');
  el.checked = true;
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await buildPage.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 60000 });
await buildPage.evaluate(() => { document.getElementById('eager-compile').checked = true; });
log('cart loaded, clicking Build');
await buildPage.click('#start');
await buildPage.waitForSelector('#result:not([hidden])', { timeout: 360000 });
log('cabinet built: ' + await buildPage.textContent('#size'));

await buildPage.evaluate(() => {
  const w = window.__calciteBridge;
  window.__bridgeStatuses = [];
  w.addEventListener('message', (ev) => {
    if (ev.data?.type === 'status') window.__bridgeStatuses.push(ev.data.message);
  });
  window.__peek = (addr, len) => new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (m) => resolve(m.data);
    w.postMessage({ type: 'peek-mem', addr, len }, [ch.port2]);
    setTimeout(() => resolve(null), 4000);
  });
});
const peekByte = async (addr) => {
  const r = await buildPage.evaluate((a) => window.__peek(a, 1), addr).catch(() => null);
  return r?.ok && r.bytes?.length ? r.bytes[0] : null;
};
const peekCga = async () => {
  const r = await buildPage.evaluate(() => window.__peek(0xB8000, 0x4000)).catch(() => null);
  return r?.ok ? r.bytes : null;
};

log('opening calcite player');
const player = await ctx.newPage();
player.on('console', (msg) => { if (msg.type() === 'error') console.log(`  [player-console:error] ${msg.text()}`); });
await player.goto(`${BASE}/player/calcite.html`, { waitUntil: 'domcontentloaded' });
await buildPage.bringToFront();

const waitFor = async (label, fn, timeoutMs, everyMs = 1000) => {
  const start = Date.now();
  for (;;) {
    if (await fn()) { log(`${label} reached (+${((Date.now() - start) / 1000).toFixed(1)}s)`); return true; }
    if (Date.now() - start > timeoutMs) { log(`TIMEOUT waiting for ${label}`); return false; }
    await new Promise(r => setTimeout(r, everyMs));
  }
};

// Boot → Windows logo/Executive (CGA mode 6 via BDA 0x449).
const mode6 = await waitFor('mode 6 (Windows gfx)', async () => (await peekByte(0x449)) === 0x06, 180000);
if (!mode6) { console.log('statuses:', await buildPage.evaluate(() => window.__bridgeStatuses)); process.exit(1); }

// Mode 6 arrives at the Microsoft LOGO; the Executive is a couple of
// million ticks later. Wait until the framebuffer stops changing (the
// Executive is static; the logo/loading phases are not) before
// snapshotting the "before" state.
let before = await peekCga();
{
  let stable = 0;
  const ok = await waitFor('framebuffer stable (Executive drawn)', async () => {
    const now = await peekCga();
    if (!now || !before) { before = now; return false; }
    let diff = 0;
    for (let i = 0; i < now.length; i++) if (now[i] !== before[i]) diff++;
    before = now;
    stable = diff < 100 ? stable + 1 : 0;
    return stable >= 2;
  }, 240000, 5000);
  if (!ok) { log('FAIL: Executive never stabilised'); process.exit(1); }
}
if (!before) { log('FAIL: could not peek CGA framebuffer'); process.exit(1); }

// Select CLOCK.EXE, then double-click it (the Executive launches on a
// double-click over the already-selected item, as on real hardware).
log(`clicking ${CLOCK_CELL} (select)`);
await player.click(`#${CLOCK_CELL}`);
await new Promise(r => setTimeout(r, 4000));
log(`double-clicking ${CLOCK_CELL} (launch)`);
await player.click(`#${CLOCK_CELL}`);
await new Promise(r => setTimeout(r, 250));
await player.click(`#${CLOCK_CELL}`);

// Clock takes over the whole screen when it launches.
const launched = await waitFor('framebuffer takeover (Clock launched)', async () => {
  const after = await peekCga();
  if (!after) return false;
  let diff = 0;
  for (let i = 0; i < after.length; i++) if (after[i] !== before[i]) diff++;
  return diff > 2000;
}, 90000, 2000);

if (!launched) {
  console.log('statuses (last 10):', (await buildPage.evaluate(() => window.__bridgeStatuses)).slice(-10));
  await browser.close();
  process.exit(1);
}
log('PASS: real click path drove Windows 1.01 — CLOCK.EXE launched by mouse');
await browser.close();
process.exit(0);
