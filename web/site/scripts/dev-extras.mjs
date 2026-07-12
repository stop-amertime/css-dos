// Dev-ONLY server surface for the Vite dev server (vite.config.js wires it
// into the css-dos-dev-runtime middleware). Two things live here:
//
// 1. DEV_ALIASES — URL prefixes served off disk in dev but NEVER copied into
//    the prod dist/ (unlike RUNTIME_COPIES in runtime-assets.mjs, which
//    drives both). These are the developer/test surfaces: the perf bench
//    page, the calcite dev pages, the web test harnesses, tmp cabinets.
//
// 2. The dev endpoints /_status, /_reset, /_clear, /_carts.json — the
//    cache-layer killers (see docs/rebuild-when.md). Ported verbatim in
//    spirit from the retired web/scripts/dev.mjs (deleted 2026-07-12 when
//    Vite became the single dev server):
//      /_status → JSON snapshot of what the server is serving (git heads,
//                 wasm + prebake hashes, vendored-vs-sibling)
//      /_reset  → wipe calcite WASM pkg + prebaked BIOSes, rebuild both
//      /_clear  → HTML page that purges browser-side state (SW, Cache
//                 Storage, IndexedDB, local/sessionStorage) then reloads
//      /_carts.json → legacy alias for the carts listing (the modern path
//                 is /carts/index.json; the legacy build.html fetches this)
//
// CALCITE_REPO is honoured for every calcite path, same as runtime-assets.

import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readFileSync, readdirSync, existsSync, statSync, unlinkSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const here = fileURLToPath(new URL('.', import.meta.url));
const siteRoot = resolve(here, '..');       // web/site/
const webRoot = resolve(siteRoot, '..');    // web/
const repoRoot = resolve(webRoot, '..');    // repo root
const calciteRoot = process.env.CALCITE_REPO
  ? resolve(process.env.CALCITE_REPO)
  : resolve(repoRoot, '..', 'calcite');

// Dev-only URL prefixes, [urlPath, srcAbsDir]. Checked AFTER the shared
// RUNTIME_COPIES table, so the specific entries there (/builder/lib,
// /calcite/pkg) win over the broader dev prefixes here.
export const DEV_ALIASES = [
  ['/builder',      resolve(repoRoot, 'builder')],        // full builder (build.mjs etc.)
  ['/bench',        resolve(repoRoot, 'tests', 'bench')], // perf bench page + profiles
  ['/bench-assets', resolve(calciteRoot, 'programs')],    // bench cabinet assets
  ['/calcite',      resolve(calciteRoot, 'web')],         // calcite dev pages
  ['/tests',        resolve(webRoot, 'tests')],           // web test harness pages
  ['/tmp',          resolve(repoRoot, 'tmp')],            // scratch cabinets
];

// --- /_status --------------------------------------------------------------

const vendoredCalcitePkg = resolve(webRoot, 'vendor', 'calcite-pkg');
const siblingCalcitePkg = resolve(calciteRoot, 'web', 'pkg');
const prebakeDir = resolve(webRoot, 'prebake');
const calciteWasmCrate = resolve(calciteRoot, 'crates', 'calcite-wasm');

function gitHead(repoDir) {
  const r = spawnSync('git', ['-C', repoDir, 'log', '-1', '--format=%h %s'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : `(git failed: ${r.stderr?.trim() || 'unknown'})`;
}

function fileInfo(path) {
  if (!existsSync(path)) return null;
  const st = statSync(path);
  const hash = createHash('md5').update(readFileSync(path)).digest('hex').slice(0, 16);
  return { bytes: st.size, mtime: st.mtime.toISOString(), md5: hash };
}

function dirFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => !f.startsWith('.') && !f.endsWith('.d.ts'));
}

export function statusSnapshot(servedPkgDir) {
  return {
    cssDosCommit: gitHead(repoRoot),
    calciteCommit: gitHead(calciteRoot),
    wasmServedFrom: servedPkgDir === vendoredCalcitePkg ? 'vendored' : 'sibling-repo',
    wasm: fileInfo(resolve(servedPkgDir, 'calcite_wasm_bg.wasm')),
    wasmPkgFiles: dirFiles(servedPkgDir),
    prebake: {
      corduroyBin: fileInfo(resolve(prebakeDir, 'corduroy.bin')),
      muslinBin:   fileInfo(resolve(prebakeDir, 'muslin.bin')),
      gossamerBin: fileInfo(resolve(prebakeDir, 'gossamer.bin')),
      manifest:    fileInfo(resolve(prebakeDir, 'manifest.json')),
    },
    serverStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
  };
}

// --- /_reset ---------------------------------------------------------------

function wipeDir(dir, filter = () => true) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    if (!filter(name)) continue;
    try { unlinkSync(join(dir, name)); n++; } catch {}
  }
  return n;
}

function runStep(label, cmd, args, opts = {}) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  const ms = Date.now() - started;
  return {
    label,
    ok: !r.error && r.status === 0,
    exitCode: r.status,
    ms,
    errorMessage: r.error?.message || '',
    stdoutTail: (r.stdout || '').split('\n').slice(-10).join('\n'),
    stderrTail: (r.stderr || '').split('\n').slice(-10).join('\n'),
  };
}

// Wipe WASM + prebake, rebuild both from HEAD. A calcite-hacker action —
// the wasm-pack step only means anything with the sibling repo present.
export function resetEverything(servedPkgDir) {
  const steps = [];
  const wasmDeleted = wipeDir(siblingCalcitePkg, () => true);
  steps.push({ label: 'wipe calcite/web/pkg', ok: true, filesDeleted: wasmDeleted });
  const prebakeDeleted = wipeDir(prebakeDir, n => n.endsWith('.bin') || n.endsWith('.json'));
  steps.push({ label: 'wipe web/prebake', ok: true, filesDeleted: prebakeDeleted });
  steps.push(runStep(
    'wasm-pack build calcite-wasm',
    'wasm-pack',
    ['build', calciteWasmCrate, '--target', 'web', '--out-dir', siblingCalcitePkg, '--release'],
    { cwd: calciteRoot },
  ));
  steps.push(runStep(
    'prebake BIOSes',
    process.execPath,
    [resolve(webRoot, 'scripts', 'prebake.mjs')],
    { cwd: repoRoot },
  ));
  return { startedAt: new Date().toISOString(), steps, status: statusSnapshot(servedPkgDir) };
}

// --- /_clear ---------------------------------------------------------------

export const CLEAR_PAGE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>dev: clear browser caches</title>
<style>body{font-family:monospace;padding:24px;max-width:720px;margin:auto;line-height:1.5}h1{font-size:16px}.ok{color:#0a0}.err{color:#a00}pre{background:#eee;padding:8px;white-space:pre-wrap}</style></head>
<body><h1>Clearing browser caches…</h1><pre id="log">starting…\n</pre>
<script>
const log = document.getElementById('log');
const p = (s, ok) => { log.textContent += (ok === false ? '[FAIL] ' : '[ok]   ') + s + '\\n'; };
(async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) { await r.unregister(); p('unregister ' + (r.scope || '(no scope)')); }
      if (regs.length === 0) p('no service workers registered');
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) { await caches.delete(k); p('caches.delete ' + k); }
      if (keys.length === 0) p('no Cache Storage keys');
    }
    if ('indexedDB' in window) {
      try {
        const dbs = (await indexedDB.databases?.()) || [];
        for (const db of dbs) { if (db.name) { indexedDB.deleteDatabase(db.name); p('idb delete ' + db.name); } }
        if (dbs.length === 0) p('no IndexedDB dbs');
      } catch (e) { p('indexedDB: ' + e.message, false); }
    }
    localStorage.clear(); p('localStorage.clear()');
    sessionStorage.clear(); p('sessionStorage.clear()');
    p('done. reloading in 1.5s…');
    setTimeout(() => location.href = '/', 1500);
  } catch (e) {
    p('fatal: ' + e.message, false);
  }
})();
</script></body></html>`;

// Resolve a URL against the dev-only aliases (path-traversal guarded).
// Same contract as runtime-assets' resolveRuntimeUrl.
export function resolveDevAlias(urlPath) {
  for (const [prefix, srcDir] of DEV_ALIASES) {
    if (urlPath !== prefix && !urlPath.startsWith(prefix + '/')) continue;
    const rel = urlPath.slice(prefix.length).replace(/^\//, '');
    let file = rel ? join(srcDir, rel) : srcDir;
    const abs = resolve(file);
    if (abs !== srcDir && !abs.startsWith(srcDir + sep)) return null; // traversal
    let st;
    try { st = statSync(abs); } catch { return null; }
    if (st.isDirectory()) {
      file = join(abs, 'index.html');
      try { statSync(file); } catch { return null; }
      return file;
    }
    return abs;
  }
  return null;
}
