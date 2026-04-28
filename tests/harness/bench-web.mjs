#!/usr/bin/env node
// Drive the existing /player/bench.html page through headless Chrome to
// measure the wasm bridge's steady-state cycles/sec on a real-world cart
// (Zork1 boot to `>` prompt by default; ?cart=plasma for a CPU-bound
// Mode 13h plasma). Builds the cabinet IN-BROWSER via the same path the
// site uses, so this measures the engine the user actually runs.
//
// Requires the dev server already running on :5173 (node web/scripts/dev.mjs).
// Reuses the playwright that ships with the npx mcp install.
//
// Usage:
//   node tests/harness/bench-web.mjs                  # 1 zork run
//   node tests/harness/bench-web.mjs --runs=3         # 3 zork runs
//   node tests/harness/bench-web.mjs --cart=plasma    # plasma cart
//   node tests/harness/bench-web.mjs --headed         # show the window
//
// Output: JSON summary on stdout, identical to window.__benchSummary
// inside the bench page. Exit 0 = ran cleanly.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    if (!a.startsWith('--')) return [];
    const [k, v] = a.slice(2).split('=');
    return [[k, v ?? true]];
  }),
);
const RUNS = parseInt(args.runs ?? '1', 10);
const CART = args.cart || 'zork';
const HEADED = !!args.headed;
const URL = `http://localhost:5173/player/bench.html?cart=${encodeURIComponent(CART)}&n=${RUNS}`;
const TIMEOUT_MS = parseInt(args.timeout ?? '600000', 10); // 10 min ceiling

// Resolve playwright from the npx mcp install — the only one present in
// this environment. If you've installed playwright locally, npm/yarn
// hoisting will resolve normally; this fallback just covers the bare box.
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const fallback =
    process.platform === 'win32'
      ? 'C:/Users/AdmT9N0CX01V65438A/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright'
      : null;
  if (!fallback) throw new Error('playwright not found and no fallback configured');
  ({ chromium } = require(fallback));
}

// Prefer the user's existing Chrome — Playwright's bundled chromium isn't
// installed here and `npx playwright install` is heavy. Falls through to
// Playwright's default if no Chrome at the standard Windows path.
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
  // Surface in-page console + bridge status for visibility while running.
  page.on('console', (msg) => {
    process.stderr.write(`[page:${msg.type()}] ${msg.text()}\n`);
  });
  page.on('pageerror', (err) => {
    process.stderr.write(`[pageerror] ${err.message}\n`);
  });
  await page.goto(URL, { waitUntil: 'load' });

  // The bench page auto-runs N times (?n=RUNS), then sets window.__benchSummary.
  // Poll for that. Status text and the per-second HUD give visibility.
  const result = await page.waitForFunction(
    () => globalThis.__benchSummary || null,
    null,
    { timeout: TIMEOUT_MS, polling: 1000 },
  );
  const summary = await result.jsonValue();
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} finally {
  await browser.close();
}
