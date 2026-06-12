// Diagnostic: per-phase wasm compile breakdown for a cabinet.
//
// Loads the bench compile-only page, waits for compile-done, then pulls
// calcite's recorded phase timings via the bridge's 'phase-report'
// message (CalciteEngine::compile_phase_report). This exists because the
// engine's [compile phase] log lines are invisible in the browser —
// worker console output doesn't reach the host page — and attaching a
// CDP console listener distorts the very timing you're measuring
// (~+12 s on a 30 s compile when this was first built, 2026-06-12).
//
// NOT a benchmark (use tests/bench/driver/run.mjs compile-only for
// comparable compileMs numbers) — this is for finding out WHERE a slow
// compile spends its time. Needs the dev server:
//   node web/scripts/dev.mjs            (default port 5173)
//   node web/tests/compile-phase-capture.playwright.mjs [port]
const fallback = 'file:///C:/Users/AdmT9N0CX01V65438A/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.js';
let pw;
try { pw = await import('playwright'); } catch { pw = (await import(fallback)).default ?? await import(fallback); }
const { chromium } = pw;
const port = process.argv[2] || '5173';

const ctx = await chromium.launchPersistentContext(
  `${process.env.TEMP}/bench-phase-capture-${Date.now()}`,
  {
    headless: false,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    viewport: null,
  },
);
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(`http://localhost:${port}/bench/page/?profile=compile-only`, { waitUntil: 'domcontentloaded' });
for (;;) {
  const r = await page.evaluate(() => window.__benchResult ?? null);
  if (r) { console.log(`TOTAL compileMs: ${r.compileMs}`); break; }
  if (Date.now() - t0 > 180_000) { console.log('TIMEOUT'); process.exit(1); }
  await new Promise((r) => setTimeout(r, 500));
}
const phases = await page.evaluate(() => new Promise((resolve) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = (m) => resolve(m.data);
  window.__bridgeWorker.postMessage({ type: 'phase-report' }, [ch.port2]);
  setTimeout(() => resolve({ ok: false, err: 'timeout' }), 10_000);
}));
if (phases.ok) {
  for (const { phase, secs } of JSON.parse(phases.report)) {
    console.log(`${phase.padEnd(28)} ${secs.toFixed(2)}s`);
  }
} else {
  console.log('phase-report failed:', phases.err);
}
await ctx.close();
