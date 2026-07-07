// End-to-end test for the calcite player's REAL keyboard input path:
//   on-screen key click → /_kbd?class=kb-X link → service worker →
//   {type:'kbd-active'} → bridge → engine.set_pseudo_class_active →
//   input-edge recogniser → cabinet --keyboard var → BIOS ring.
//
// This is the one input path nothing else covers: the bench injects keys
// via setvar_pulse watch actions (engine-side), so a dead host keyboard
// keeps every bench green. That blind spot hid a two-week regression
// (bridge calling the deleted `set_keyboard` API inside try{}catch{};
// see logbook 2026-06-12). This test exists so that can't recur.
//
// NOT part of `node --test` (no .test. in the name): it needs the dev
// server (node web/scripts/dev.mjs) on :5173 and system Chrome, builds
// the doom8088 cabinet in-browser, and takes ~2 minutes.
//
//   node web/tests/kbd-e2e.playwright.mjs
//
// PASS = build → title → menu opens on Enter → game starts → ingame,
// all driven by clicking the player's on-screen Enter key.

// `playwright` normally resolves from node_modules. Set PLAYWRIGHT_DIR to a
// directory containing the playwright package if it doesn't (e.g. npx cache).
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

// Browser resolution: CHROME_BIN env → system Chrome (Windows) →
// Playwright-managed chromium (PLAYWRIGHT_BROWSERS_PATH / default).
import { existsSync } from 'node:fs';
import { pngCenterPixel } from './helpers/png-pixel.mjs';
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium',
].filter(Boolean);
const SYS_CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));
// BASE env override: the legacy dev server this test needs may have to
// dodge a Vite dev server already on :5173 (PORT=5273 node web/scripts/dev.mjs).
const BASE = process.env.BASE || 'http://localhost:5173';
// Doom8088 sentinels (linear addresses, docs/logbook/STATUS.md — re-derive
// from the .map if the doom8088 cart or memory layout changes).
const G_GAMESTATE = 0x3a3c4, G_MENUACTIVE = 0x3ac62, G_USERGAME = 0x3a5af;
const t0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

const browser = await chromium.launch({
  headless: true,
  executablePath: SYS_CHROME,
  // The build tab owns the bridge worker and a ~300MB cabinet blob;
  // without these flags headless Chrome discards it mid-run.
  args: [
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-background-timer-throttling',
    '--disable-features=AutomaticTabDiscarding,MemorySaverMode,BackForwardCache',
    // Container-friendly: /dev/shm is tiny in CI boxes and the cabinet
    // blob is large; without this the renderer OOM-crashes.
    '--disable-dev-shm-usage',
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

const buildPage = await ctx.newPage();
buildPage.on('crash', () => log('!! build page CRASHED'));
buildPage.on('console', (msg) => {
  const t = msg.text();
  if (msg.type() === 'error' || /kbd-trace|keyboard input broken|bridge boot/.test(t)) {
    console.log(`  [build-console:${msg.type()}] ${t}`);
  }
});

log('opening build.html');
await buildPage.goto(`${BASE}/build.html`, { waitUntil: 'load' });
await buildPage.waitForSelector('input[name="cart"][value="doom8088"]', { timeout: 20000 });
// The site hides the real inputs behind ::before marker glyphs, so click
// them programmatically (build.js listens for bubbled 'change' events).
await buildPage.evaluate(() => {
  const el = document.querySelector('input[name="cart"][value="doom8088"]');
  el.checked = true;
  el.dispatchEvent(new Event('change', { bubbles: true }));
});
await buildPage.waitForFunction(() => !document.getElementById('start').disabled, { timeout: 60000 });
// Eager compile so the player connect is instant.
await buildPage.evaluate(() => { document.getElementById('eager-compile').checked = true; });
log('cart loaded, clicking Build');
await buildPage.click('#start');
await buildPage.waitForSelector('#result:not([hidden])', { timeout: 360000 });
log('cabinet built: ' + await buildPage.textContent('#size'));

// Hook the bridge from the build page: status messages + peek-mem helper
// + kbd-trace broadcast capture.
await buildPage.evaluate(() => {
  const w = window.__calciteBridge;
  window.__bridgeStatuses = [];
  w.addEventListener('message', (ev) => {
    if (ev.data?.type === 'status') window.__bridgeStatuses.push(ev.data.message);
  });
  window.__kbdTraces = [];
  new BroadcastChannel('cssdos-kbd-trace').onmessage = (ev) => window.__kbdTraces.push(ev.data);
  w.postMessage({ type: 'kbd-trace', enabled: true });
  // Peeks resolve on the worker's reply, with a timeout fallback: an
  // unresolved promise leaves page.evaluate pending, and a pending
  // evaluate racing the player's viewer-connect can die with a spurious
  // "execution context destroyed" (seen on headless Linux). Bounded
  // promises + the try/catch below make each poll independently safe —
  // the waitFor loops just retry a second later.
  window.__peek = (addr, len) => new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (m) => resolve(m.data);
    w.postMessage({ type: 'peek-mem', addr, len }, [ch.port2]);
    setTimeout(() => resolve(null), 4000);
  });
  window.__peekVar = (name) => new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (m) => resolve(m.data);
    w.postMessage({ type: 'peek-var', name }, [ch.port2]);
    setTimeout(() => resolve(null), 4000);
  });
});
const peekByte = async (addr) => {
  const r = await buildPage.evaluate((a) => window.__peek(a, 1), addr).catch(() => null);
  return r?.ok && r.bytes?.length ? r.bytes[0] : null;
};
const peekVar = async (name) => {
  const r = await buildPage.evaluate((n) => window.__peekVar(n), name).catch(() => null);
  return r?.ok ? r.value : null;
};

log('opening calcite player');
const player = await ctx.newPage();
player.on('console', (msg) => { if (msg.type() === 'error') console.log(`  [player-console:error] ${msg.text()}`); });
// 'load' never fires: the framebuffer <img> is an endless multipart stream.
await player.goto(`${BASE}/player/calcite.html`, { waitUntil: 'domcontentloaded' });
// Keep the build tab (bridge worker + blob owner) foregrounded; clicks on
// the player work unfocused.
await buildPage.bringToFront();

const waitFor = async (label, fn, timeoutMs, everyMs = 1000) => {
  const start = Date.now();
  for (;;) {
    if (await fn()) { log(`${label} reached (+${((Date.now() - start) / 1000).toFixed(1)}s)`); return true; }
    if (Date.now() - start > timeoutMs) { log(`TIMEOUT waiting for ${label}`); return false; }
    await new Promise(r => setTimeout(r, everyMs));
  }
};

// Boot → doom title (mode 13h via BDA 0x449).
const mode13 = await waitFor('mode 13h (doom gfx)', async () => (await peekByte(0x449)) === 0x13, 120000);
if (!mode13) { console.log('statuses:', await buildPage.evaluate(() => window.__bridgeStatuses)); process.exit(1); }

// Title up: click on-screen Enter until the menu opens, then keep going
// (New Game → skill) until a game starts.
await new Promise(r => setTimeout(r, 3000));
let menuSeen = false, userGame = false;
for (let i = 0; i < 40 && !userGame; i++) {
  await player.click('#kb-enter');
  await new Promise(r => setTimeout(r, 1800));
  if (!menuSeen && await peekByte(G_MENUACTIVE) === 1) { menuSeen = true; log(`menu opened after ${i + 1} Enter click(s)`); }
  if (await peekByte(G_USERGAME) === 1) { userGame = true; log(`usergame latched after ${i + 1} Enter click(s)`); }
}
if (!userGame) {
  log('FAIL: usergame never latched (menu seen: ' + menuSeen + ')');
  console.log('kbd traces (last 10):', (await buildPage.evaluate(() => window.__kbdTraces)).slice(-10));
  console.log('statuses (last 10):', (await buildPage.evaluate(() => window.__bridgeStatuses)).slice(-10));
  await browser.close();
  process.exit(1);
}

// Loading → in-game (gamestate 0 = GS_LEVEL).
const ingame = await waitFor('ingame (gamestate=LEVEL)', async () => (await peekByte(G_GAMESTATE)) === 0 && (await peekByte(G_USERGAME)) === 1, 180000, 2000);

// Hold-wire phase: hold mode is a bridge-owned toggle — #kb-hold is a
// plain submit key whose press flips the cabinet's --kbdHold wire
// immediately. While the wire is up the MACHINE suppresses key release
// edges and latches each released key's scancode into the kbdHeld*
// slots — pressing LEFT, CTRL, ALT builds a chord (three makes, no
// breaks). Clicking #kb-hold again drops the wire and the machine
// drains the slots back out as break codes ON ITS OWN — asserting the
// 2026-07-07 fix: no follow-up key press is needed to release.
// The hold key's lamp dot is an <img> fed by the bridge's
// /_screen/holdlamp stream. Assert on ELEMENT SCREENSHOTS (compositor
// truth): in-page canvas drawImage of a multipart <img> returns a
// stale frame (multi-frame image sources draw their first/previous
// frame), so a pixel readback lies even while the display is correct.
// Read the dot's CENTRE pixel from the screenshot — corner pixels mix
// with the button background (hover/AA) and aren't stable.
const lampCenter = async () =>
  pngCenterPixel(await player.locator('#kb-hold .kb-lamp').screenshot());
const lampLit = async () => { const c = await lampCenter(); return c.r < 120 && c.g > 200 && c.b < 120; };  // #55ff55 green
const lampDark = async () => { const c = await lampCenter(); return c.r < 60 && c.g < 60 && c.b < 60; };    // #000000 black

let holdOk = false;
if (ingame) {
  log('hold phase: mode on, chord LEFT+CTRL+ALT');
  await player.click('#kb-hold');       // hold mode on → wire up now
  const lampOn = await waitFor('hold lamp lit (green on display)', lampLit, 15000);
  await player.click('#kb-left');       // press LEFT → latch 0x4B on release
  const left = await waitFor('kbdHeld0=75 (LEFT latched)', async () => (await peekVar('kbdHeld0')) === 75, 20000);
  await player.click('#kb-ctrl');       // press CTRL → latch 0x1D alongside
  const ctrl = await waitFor('kbdHeld1=29 (CTRL latched)', async () => (await peekVar('kbdHeld1')) === 29, 20000);
  await player.click('#kb-alt');        // press ALT (2026-07-07 key) → latch 0x38
  const alt = await waitFor('kbdHeld2=56 (ALT latched)', async () => (await peekVar('kbdHeld2')) === 56, 20000);
  const wireIdle = (await peekVar('keyboard')) === 0; // pulses pass through 0; the HOLD is in the slots
  log(`chord latched: LEFT=${left} CTRL=${ctrl} ALT=${alt} keyboard idle=${wireIdle}`);
  await player.click('#kb-hold');       // hold mode off — must drain with NO further key press
  const drained = await waitFor('kbdHeld slots drained (no follow-up key)', async () =>
    (await peekVar('kbdHeld0')) === 0 && (await peekVar('kbdHeld1')) === 0 && (await peekVar('kbdHeld2')) === 0, 20000);
  const lampOff = await waitFor('hold lamp back off (black on display)', lampDark, 15000);
  holdOk = left && ctrl && alt && wireIdle && drained && lampOn && lampOff;
  log(`lamp: on=${lampOn} off=${lampOff}`);
}

const traces = await buildPage.evaluate(() => window.__kbdTraces);
console.log(`kbd traces captured: ${traces.length}`);
console.log('keyboard-broken status present:', (await buildPage.evaluate(() => window.__bridgeStatuses)).some(s => /keyboard input broken/.test(s)));
await browser.close();
const pass = ingame && holdOk;
log(pass
  ? 'PASS: full flow build→title→menu→ingame + hold-wire chord via on-screen keyboard'
  : `FAIL: ingame=${ingame} holdOk=${holdOk}`);
process.exit(pass ? 0 : 1);
