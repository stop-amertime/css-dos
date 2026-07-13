#!/usr/bin/env node
// web-boot.playwright.mjs — boot a cabinet through the REAL web path and
// assert a text sentinel appears on screen.
//
// Exists because every other gate (smoke/writable/msdos) drives
// calcite-cli: none of them execute the wasm bundle the site actually
// ships. A stale web/vendor/calcite-pkg/ kept all native gates green
// while the site failed with 'compile error: unreachable' (LOGBOOK
// 2026-07-07). This script is the missing coverage: dev server →
// Cache Storage → bridge worker → calcite-wasm → peek text VRAM.
//
// Usage:
//   node tests/harness/web-boot.playwright.mjs --cabinet=PATH \
//     --sentinel=TEXT [--cap-ms=180000] [--port=5461] [--engine=vendored]
//   node tests/harness/web-boot.playwright.mjs --cabinet=PATH \
//     --gfx-sentinel=MODE [--cap-ms=...]   # graphics cabinets: pass when
//     the BDA mode byte (0x449) equals MODE and the CGA framebuffer at
//     0xB8000 has >512 non-zero bytes (i.e. the program actually drew).
//     For carts that leave text mode (e.g. windows101, mode 6).
//
// --engine=vendored (default): force the vendored web/vendor/calcite-pkg
//   bundle — the artifact the site ships — even if a built sibling
//   calcite repo is present. --engine=sibling: normal dev-server
//   resolution (fresh sibling build if present), for pre-vendor testing.
//
// Emits one JSON line on stdout: {ok, sentinel, cabinetMB, compileMs?,
// wallMs, error?, statusTail}. Exit 0 on pass, 3 on test failure,
// 1 on harness error (mirrors pipeline.mjs conventions).

import { spawn } from 'node:child_process';
import { existsSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/opt/pw-browsers/chromium',
].filter(Boolean);
const SYS_CHROME = CHROME_CANDIDATES.find((p) => existsSync(p));

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const flags = {};
for (const a of process.argv.slice(2)) {
  if (!a.startsWith('--')) continue;
  const [k, v] = a.slice(2).split('=');
  flags[k] = v ?? true;
}
const cabinet = flags.cabinet && resolve(flags.cabinet);
const sentinel = flags.sentinel;
const gfxSentinel = flags['gfx-sentinel'] != null ? Number(flags['gfx-sentinel']) : null;
const capMs = Number(flags['cap-ms'] ?? 180_000);
const port = Number(flags.port ?? 5461);
const engine = flags.engine ?? 'vendored';
if (!cabinet || !existsSync(cabinet) || (!sentinel && gfxSentinel == null)) {
  console.log(JSON.stringify({ ok: false, error: 'need --cabinet=<existing path> and --sentinel=TEXT or --gfx-sentinel=MODE' }));
  process.exit(1);
}

const t0 = Date.now();
const statuses = [];
const emit = (obj) => console.log(JSON.stringify({
  sentinel, cabinet: basename(cabinet), wallMs: Date.now() - t0,
  statusTail: statuses.slice(-4), ...obj,
}));

// Serve the cabinet through the dev server's /tmp/ alias via a symlink.
const tmpDir = resolve(REPO_ROOT, 'tmp');
mkdirSync(tmpDir, { recursive: true });
const link = resolve(tmpDir, `web-boot-${basename(cabinet)}`);
rmSync(link, { force: true });
symlinkSync(cabinet, link);

// Dev server (Vite — the one dev server; web/site/vite.config.js serves the
// player, /tmp/ cabinets, and the calcite pkg). engine=vendored points
// CALCITE_REPO into the void so the pkg resolution falls back to
// web/vendor/calcite-pkg — the bundle the site ships is the one under test.
const env = { ...process.env, PORT: String(port) };
if (engine === 'vendored') env.CALCITE_REPO = resolve(tmpDir, 'nonexistent-force-vendored-pkg');
const viteBin = resolve(REPO_ROOT, 'web', 'site', 'node_modules', 'vite', 'bin', 'vite.js');
const server = spawn(process.execPath, [viteBin, '--port', String(port), '--strictPort'],
  { cwd: resolve(REPO_ROOT, 'web', 'site'), env, stdio: ['ignore', 'ignore', 'pipe'] });
let serverErr = '';
server.stderr.on('data', (d) => { serverErr += d.toString(); });

let browser = null;
async function cleanup() {
  try { if (browser) await browser.close(); } catch {}
  try { server.kill(); } catch {}
  rmSync(link, { force: true });
}

try {
  // Wait for the server to answer.
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/player/calcite.html`);
      up = r.ok;
    } catch { /* not yet */ }
    if (!up) await new Promise((r) => setTimeout(r, 250));
  }
  if (!up) throw new Error(`dev server never came up on :${port}\n${serverErr.slice(-300)}`);

  browser = await chromium.launch({
    headless: true,
    executablePath: SYS_CHROME,
    // The page owns the bridge worker and (for msdos4) a ~440MB cabinet
    // blob; without these flags headless Chrome throttles/discards it.
    args: [
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-background-timer-throttling',
    ],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => statuses.push(`pageerror: ${e.message}`));

  await page.goto(`http://localhost:${port}/player/calcite.html`, { waitUntil: 'domcontentloaded' });

  // Same flow as the site: cabinet blob → Cache Storage → bridge worker.
  await page.evaluate(async (cabUrl) => {
    window.__statuses = [];
    const { purgeCabinets, saveCabinet } = await import('/browser-builder/storage.mjs');
    const r = await fetch(cabUrl);
    if (!r.ok) throw new Error(`cabinet fetch ${cabUrl} -> ${r.status}`);
    const blob = await r.blob();
    window.__cabinetMB = (blob.size / 1024 / 1024).toFixed(1);
    await purgeCabinets();
    await saveCabinet(blob);
    const w = new Worker('/shim/calcite-bridge.js', { type: 'module' });
    window.__bridge = w;
    w.addEventListener('message', (ev) => {
      if (ev.data?.type === 'status') window.__statuses.push(ev.data.message);
    });
    w.addEventListener('error', (ev) => {
      window.__statuses.push('worker-error: ' + (ev.message || 'unknown'));
    });
    w.postMessage({ type: 'cabinet-updated', eager: true });
  }, `/tmp/${basename(link)}`);
  const cabinetMB = await page.evaluate(() => window.__cabinetMB);

  let started = false;
  let compileMs = null;
  while (Date.now() - t0 < capMs) {
    const s = await page.evaluate(() => window.__statuses);
    statuses.length = 0;
    statuses.push(...s);

    // Any engine/compile/worker failure fails the gate immediately.
    const bad = s.find((m) => /error|unreachable|panic|broken|failed/i.test(m));
    if (bad) {
      emit({ ok: false, cabinetMB, error: bad });
      await cleanup();
      process.exit(3);
    }

    // compile-done rides the bench BroadcastChannel, not the worker
    // port — key off the '(ready)' status instead.
    if (!started && s.some((m) => m.includes('(ready)'))) {
      started = true;
      compileMs = Date.now() - t0;
      await page.evaluate(() => window.__bridge.postMessage({ type: 'bench-run' }));
    }

    if (started && sentinel) {
      const text = await page.evaluate(async () => {
        const ch = new MessageChannel();
        const p = new Promise((res) => { ch.port1.onmessage = (e) => res(e.data); });
        window.__bridge.postMessage({ type: 'peek-mem', addr: 0xB8000, len: 4000 }, [ch.port2]);
        const d = await p;
        if (!d.ok) return null;
        let out = '';
        for (let i = 0; i < d.bytes.length; i += 2) {
          const c = d.bytes[i];
          out += c >= 32 && c < 127 ? String.fromCharCode(c) : ' ';
        }
        return out;
      });
      if (text && text.includes(sentinel)) {
        emit({ ok: true, cabinetMB, compileMs });
        await cleanup();
        process.exit(0);
      }
    }

    // Graphics sentinel: BDA mode byte matches AND the CGA framebuffer
    // has real ink — proves the program switched mode and drew.
    if (started && gfxSentinel != null) {
      const gfx = await page.evaluate(async () => {
        const peek = (addr, len) => new Promise((res) => {
          const ch = new MessageChannel();
          ch.port1.onmessage = (e) => res(e.data);
          window.__bridge.postMessage({ type: 'peek-mem', addr, len }, [ch.port2]);
        });
        const m = await peek(0x449, 1);
        if (!m.ok) return null;
        const fb = await peek(0xB8000, 0x4000);
        if (!fb.ok) return null;
        let ink = 0;
        for (const b of fb.bytes) if (b !== 0) ink++;
        return { mode: m.bytes[0], ink };
      });
      if (gfx && gfx.mode === gfxSentinel && gfx.ink > 512) {
        emit({ ok: true, cabinetMB, compileMs, gfx });
        await cleanup();
        process.exit(0);
      }
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  emit({ ok: false, cabinetMB, compileMs, error: `sentinel not on screen within ${capMs}ms` });
  await cleanup();
  process.exit(3);
} catch (err) {
  emit({ ok: false, error: String(err?.message ?? err) });
  await cleanup();
  process.exit(1);
}
