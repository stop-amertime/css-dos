#!/usr/bin/env node
// bench-doom-load.mjs — measure doom8088 web-side load time at fine granularity.
//
// Drives bench.html headless in chrome, hooks BroadcastChannel('cssdos-bridge-stats')
// from the page side, logs per-second bridge stats (cycles, ticks, batch, ms/batch)
// to stdout so we can SEE exactly how fast the bridge crunches through level-load.
//
// Usage:
//   node tests/harness/bench-doom-load.mjs                      # 1 run, target=100M
//   node tests/harness/bench-doom-load.mjs --target=410000000   # full level-load
//   node tests/harness/bench-doom-load.mjs --headed             # show browser
//
// Output is stream-of-stats per second + a summary line at end.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    if (!a.startsWith('--')) return [];
    const [k, v] = a.slice(2).split('=');
    return [[k, v ?? true]];
  }),
);
const TARGET = parseInt(args.target ?? '100000000', 10);
const HEADED = !!args.headed;
const TIMEOUT_MS = parseInt(args.timeout ?? '900000', 10);

// Use the same cart entry already added to bench.html.
// We override targetCycles via URL search params on calcite-bench.js,
// but it's cleaner to just use 'doom8088-load' which is configured.
const URL = `http://localhost:5173/player/bench.html?cart=doom8088-load&n=1`;

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const fallback =
    process.platform === 'win32'
      ? 'C:/Users/AdmT9N0CX01V65438A/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
      : null;
  if (!fallback) throw new Error('playwright not found');
  ({ chromium } = require(fallback));
}

const launchOpts = { headless: !HEADED };
const sysChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
try {
  const fs = require('node:fs');
  if (fs.existsSync(sysChrome)) launchOpts.executablePath = sysChrome;
} catch {}

const browser = await chromium.launch(launchOpts);
try {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
  const page = await ctx.newPage();

  // Surface stats lines specifically — filter heavy compile-warning noise.
  page.on('console', (msg) => {
    const t = msg.text();
    if (
      t.startsWith('[bridge-stats]') ||
      t.startsWith('[bench]') ||
      t.includes('ERROR') ||
      t.includes('error')
    ) {
      process.stderr.write(`${t}\n`);
    }
  });
  page.on('pageerror', (err) => {
    process.stderr.write(`[pageerror] ${err.message}\n`);
  });

  // Hook a BroadcastChannel listener on the page side BEFORE navigation,
  // so we don't miss any stats. We can't do that — we navigate first,
  // then hook. The bridge stats fire 1Hz so we just miss the first one.
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  await page.evaluate((target) => {
    globalThis.__benchTarget = target;
    globalThis.__benchStartT = null;
    globalThis.__benchTargetT = null;
    const ch = new BroadcastChannel('cssdos-bridge-stats');
    ch.onmessage = (ev) => {
      const d = ev.data;
      if (!d || d.type !== 'bridge-stats') return;
      if (globalThis.__benchStartT == null) globalThis.__benchStartT = performance.now();
      const wallS = (performance.now() - globalThis.__benchStartT) / 1000;
      // Log stats line we'll capture in node.
      console.log(
        `[bridge-stats] t=${wallS.toFixed(1)}s ` +
        `cyc=${d.cycles.toLocaleString()} ` +
        `ticks=${(d.ticks ?? 0).toLocaleString()} ` +
        `fps=${d.fpsWindow} ` +
        `batch=${d.batchCount} ${d.batchMsEma.toFixed(1)}ms ` +
        `mode=0x${(d.videoMode ?? 0).toString(16)}`
      );
      if (d.cycles >= globalThis.__benchTarget && globalThis.__benchTargetT == null) {
        globalThis.__benchTargetT = performance.now() - globalThis.__benchStartT;
        console.log(`[bridge-stats] === TARGET ${globalThis.__benchTarget.toLocaleString()} REACHED at t=${(globalThis.__benchTargetT/1000).toFixed(2)}s ===`);
      }
    };
  }, TARGET);

  // Auto-run was triggered by ?n=1 in the URL — no click needed.

  // Wait for target hit OR overall timeout.
  const result = await page.waitForFunction(
    () => globalThis.__benchTargetT != null,
    null,
    { timeout: TIMEOUT_MS, polling: 1000 },
  );
  const ms = await result.jsonValue();
  // The waitForFunction returns the truthy value; we set __benchTargetT to a number.
  // Actually it returns the JSHandle; jsonValue gets the value. But the predicate
  // returns boolean. Re-read explicitly:
  const targetMs = await page.evaluate(() => globalThis.__benchTargetT);
  const summary = {
    target: TARGET,
    wallMs: targetMs,
    wallSec: targetMs / 1000,
    real8086Sec: TARGET / 4_772_727,
    speedupVsReal: (TARGET / 4_772_727) / (targetMs / 1000),
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} finally {
  await browser.close();
}
