#!/usr/bin/env node
// tests/bench/driver/run.mjs — drive a bench profile.
//
// Two transports:
//
// - target: 'web'  → bring up the dev server (or assume it's running),
//                    load tests/bench/page/?profile=NAME via Playwright,
//                    poll window.__benchResult, return JSON.
// - target: 'cli'  → run `calcite-cli` directly with --watch flags
//                    derived from the profile's primitives, parse
//                    --measure-out JSONL stream, return JSON.
//
// Usage:
//   node tests/bench/driver/run.mjs <profile> [--target=web|cli]
//                                              [--port=5173]
//                                              [--no-rebuild]
//                                              [--out=PATH]
//                                              [--headed]
//
// Examples:
//   node tests/bench/driver/run.mjs doom-loading
//   node tests/bench/driver/run.mjs doom-loading --target=cli
//   node tests/bench/driver/run.mjs zork-steady --target=web --headed
//
// Profiles live in tests/bench/profiles/<name>.mjs and export a
// `manifest` object describing what the profile measures. The driver
// reads the manifest to know what cabinet to ensure-fresh, what
// transport to use, and what output shape to expect.

import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { ensureArtifact } from '../lib/ensure-fresh.mjs';
import '../lib/artifacts.mjs';  // side-effect register all known artifacts

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

function parseArgs(argv) {
  const out = { _: [] };
  for (const a of argv) {
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq < 0) out[a.slice(2)] = true;
      else out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      out._.push(a);
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const profileName = args._[0];
if (!profileName) {
  console.error('usage: run.mjs <profile> [--target=web|cli] [--port=5173] [--no-rebuild] [--out=PATH] [--headed]');
  process.exit(2);
}

// Load the profile to read its manifest.
const profilePath = resolve(__dirname, '..', 'profiles', `${profileName}.mjs`);
if (!existsSync(profilePath)) {
  console.error(`profile not found: ${profilePath}`);
  process.exit(2);
}
const profile = await import(pathToFileURL(profilePath).href);
if (!profile.manifest) {
  console.error(`profile ${profileName} has no manifest export`);
  process.exit(2);
}

const target = args.target ?? profile.manifest.target ?? 'web';
const port   = parseInt(args.port ?? '5173', 10);
const noRebuild = args['no-rebuild'] === true;
const headed = args.headed === true;
const outPath = args.out ?? null;

console.error(`[driver] profile=${profileName} target=${target} port=${port}`);

// ---- Ensure the profile's required artifacts are fresh ----
// Profile-declared `requires`, filtered to the target (drop the
// other target's calcite binary so a CLI run doesn't trigger a wasm
// rebuild and vice-versa), plus the chosen target's calcite binary.
const otherTargetArtifact = target === 'cli' ? 'wasm:calcite' : 'cli:calcite';
const profileRequires = (profile.manifest.requires ?? [])
  .filter(name => name !== otherTargetArtifact);
const requiredArtifacts = [
  ...profileRequires,
  target === 'cli' ? 'cli:calcite' : 'wasm:calcite',
];
const seen = new Set();
for (const name of requiredArtifacts) {
  if (seen.has(name)) continue;
  seen.add(name);
  console.error(`[driver] ensuring ${name}`);
  const path = await ensureArtifact(name, { noRebuild, verbose: true });
  console.error(`[driver]   ready: ${path}`);
}

// ---- Run via the chosen transport ----
let result;
if (target === 'web') {
  result = await runWeb(profileName, port, headed);
} else if (target === 'cli') {
  result = await runCli(profileName, profile.manifest);
} else {
  console.error(`unknown target: ${target}`);
  process.exit(2);
}

if (outPath) {
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.error(`[driver] wrote ${outPath}`);
}
console.log(JSON.stringify(result, null, 2));

// ---- Web transport ----
async function runWeb(profileName, port, headed) {
  // Lazy-load chromium with a Windows npx-cache fallback (see loadChromium below).
  const { chromium } = await loadChromium();
  const sysChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const useSysChrome = process.platform === 'win32' && existsSync(sysChrome);

  let browser, ctx, page;
  if (headed && useSysChrome) {
    // Headed on Windows: launchPersistentContext with a fresh temp
    // user-data-dir so we get our own visible Chrome window instead of
    // attaching to the user's running profile (which opens a tab in
    // their existing browser, invisible to this bench process).
    // Playwright's bundled chromium fails on this machine ("side-by-
    // side configuration is incorrect" — missing VC++ redistributable),
    // so system Chrome is the only option.
    const tmpProfile = `${process.env.TEMP || '/tmp'}/cssdos-bench-profile-${Date.now()}`;
    ctx = await chromium.launchPersistentContext(tmpProfile, {
      executablePath: sysChrome,
      headless: false,
      viewport: null,
      args: ['--start-maximized', '--window-position=0,0', '--window-size=1280,900'],
    });
    browser = ctx.browser();
    page = ctx.pages()[0] || await ctx.newPage();
  } else {
    const launchOpts = { headless: !headed };
    if (headed) {
      launchOpts.args = ['--start-maximized', '--window-position=0,0', '--window-size=1280,900'];
    } else if (useSysChrome) {
      launchOpts.executablePath = sysChrome;
    }
    browser = await chromium.launch(launchOpts);
    ctx = await browser.newContext(
      headed ? { viewport: null } : { viewport: { width: 1024, height: 700 } }
    );
    page = await ctx.newPage();
  }

  page.on('console', (msg) => {
    const t = msg.text();
    if (msg.type() === 'error' || /ERROR/.test(t)) {
      process.stderr.write(`[page-${msg.type()}] ${t}\n`);
    }
  });
  page.on('pageerror', (err) => {
    process.stderr.write(`[pageerror] ${err.message}\n`);
  });
  // Trace 404s with the offending URL — the default page-error log
  // omits the URL so debugging "404 for who?" is impossible without it.
  page.on('requestfailed', (req) => {
    process.stderr.write(`[request-failed] ${req.method()} ${req.url()} (${req.failure()?.errorText})\n`);
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      process.stderr.write(`[response] ${resp.status()} ${resp.url()}\n`);
    }
  });

  const url = `http://localhost:${port}/bench/page/?profile=${encodeURIComponent(profileName)}`;
  console.error(`[driver] navigating to ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Poll for window.__benchResult to land. Hard wall-clock cap.
  const cap = (profile.manifest.wallCapMs ?? 600_000);
  const t0 = Date.now();
  while (Date.now() - t0 < cap) {
    const r = await page.evaluate(() => window.__benchResult ?? null);
    if (r) {
      // launchPersistentContext returns no Browser, just close ctx.
      if (browser) await browser.close(); else await ctx.close();
      return r;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  if (browser) await browser.close(); else await ctx.close();
  return { ok: false, error: `timed out after ${cap}ms` };
}

// ---- CLI transport ----
//
// Composes the profile's `cliWatches` (an array of --watch spec
// strings) into a calcite-cli invocation. The CLI runs the cabinet,
// emits MeasurementEvents to --measure-out=PATH (one JSONL per event),
// and exits when a halt action fires.
async function runCli(profileName, manifest) {
  if (!Array.isArray(manifest.cliWatches) || manifest.cliWatches.length === 0) {
    return {
      ok: false,
      error: `profile ${profileName} has no cliWatches[] for CLI transport`,
    };
  }

  // Resolve calcite-cli binary via CALCITE_CLI_BIN or relative path.
  const cliBin = process.env.CALCITE_CLI_BIN
    ?? resolve(REPO_ROOT, '..', 'calcite', 'target', 'release',
               process.platform === 'win32' ? 'calcite-cli.exe' : 'calcite-cli');
  if (!existsSync(cliBin)) {
    return { ok: false, error: `calcite-cli not found at ${cliBin}` };
  }

  // Resolve the cabinet path. The profile names a `cabinet:NAME` artifact;
  // we already ensureFresh'd it earlier — so just look up the spec.
  const { getArtifact } = await import('../lib/ensure-fresh.mjs');
  const cabSpec = getArtifact(manifest.cabinet);
  const cabPath = resolve(REPO_ROOT, cabSpec.output);
  if (!existsSync(cabPath)) {
    return { ok: false, error: `cabinet not found: ${cabPath}` };
  }

  const measureOut = resolve(REPO_ROOT, 'tmp', `${profileName}-${Date.now()}.jsonl`);

  const args = [
    '-i', cabPath,
    '--measure-out=' + measureOut,
  ];
  for (const w of manifest.cliWatches) {
    args.push('--watch', w);
  }
  const maxTicks = manifest.cliMaxTicks ?? 80_000_000;
  args.push('--ticks=' + maxTicks);

  console.error(`[driver-cli] ${cliBin} ${args.join(' ')}`);
  const t0 = Date.now();
  const proc = spawn(cliBin, args, { stdio: ['ignore', 'pipe', 'inherit'] });
  let stdoutBuf = '';
  proc.stdout.on('data', d => stdoutBuf += d.toString());
  const exitCode = await new Promise(res => proc.on('close', res));
  const totalMs = Date.now() - t0;

  // Parse the measurement events.
  let events = [];
  if (existsSync(measureOut)) {
    const { readFileSync } = await import('node:fs');
    const txt = readFileSync(measureOut, 'utf8');
    events = txt.split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  }

  return {
    ok: exitCode === 0,
    profileName,
    target: 'cli',
    totalWallMs: totalMs,
    exitCode,
    measureOut,
    events,
    cliStdoutSample: stdoutBuf.slice(-500),
  };
}

// ---- Chromium loader ----
// Normally `playwright` resolves from node_modules (it's a devDependency).
// If you run from a layout where it doesn't, point PLAYWRIGHT_DIR at a
// directory containing the playwright package (e.g. an npx cache entry).
async function loadChromium() {
  try { return await import('playwright'); }
  catch {}
  const dir = process.env.PLAYWRIGHT_DIR;
  if (dir) {
    const mod = await import(new URL('index.js', `file:///${dir.replace(/\\/g, '/')}/`).href);
    return mod.default ?? mod;
  }
  throw new Error('playwright not found — install it or set PLAYWRIGHT_DIR');
}
