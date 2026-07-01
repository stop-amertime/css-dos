// Dev-server middleware shared by vite.config.js. Ports the endpoints and
// aliases from the old web/scripts/dev.mjs so Vite serves the same URL
// surface: /_status, /_reset, /_carts.json, /_clear, plus /player/,
// /shim/, /calcite/pkg/, /carts/, etc. aliased to their real dirs.
import { readFileSync, statSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/ -> site/ -> web/ -> repo root
const webRoot = resolve(__dirname, '..', '..');
const repoRoot = resolve(webRoot, '..');
const calciteRoot = process.env.CALCITE_REPO
  ? resolve(process.env.CALCITE_REPO)
  : resolve(repoRoot, '..', 'calcite');

const vendoredCalcitePkg = resolve(webRoot, 'vendor', 'calcite-pkg');
function resolveCalcitePkgDir() {
  const siblingPkg = resolve(calciteRoot, 'web', 'pkg');
  if (existsSync(resolve(siblingPkg, 'calcite_wasm.js'))) return siblingPkg;
  return vendoredCalcitePkg;
}
const calcitePkgDir = resolveCalcitePkgDir();
const cartsDir = resolve(repoRoot, 'carts');

// URL prefix -> real directory. Vite serves the site itself; these cover
// everything that lives outside web/site/.
export const ALIASES = [
  ['/prebake/', resolve(webRoot, 'prebake')],
  ['/browser-builder/', resolve(webRoot, 'browser-builder')],
  ['/kiln/', resolve(repoRoot, 'kiln')],
  ['/builder/', resolve(repoRoot, 'builder')],
  ['/tools/', resolve(repoRoot, 'tools')],
  ['/assets/dos/', resolve(repoRoot, 'dos', 'bin')],
  ['/player/', resolve(webRoot, 'player')],
  ['/shim/', resolve(webRoot, 'shim')],
  ['/bench/', resolve(repoRoot, 'tests', 'bench')],
  ['/presets/', resolve(repoRoot, 'builder', 'presets')],
  ['/calcite/pkg/', calcitePkgDir],
  ['/calcite/', resolve(calciteRoot, 'web')],
  ['/tests/', resolve(webRoot, 'tests')],
  ['/tmp/', resolve(repoRoot, 'tmp')],
  ['/bench-assets/', resolve(calciteRoot, 'programs')],
  ['/carts/', cartsDir],
];

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json',
  '.bin': 'application/octet-stream', '.wasm': 'application/wasm',
};

const ALLOWED_ROOTS = ALIASES.map(([, dir]) => dir);
const isInsideAllowedRoot = (file) => {
  const abs = resolve(file);
  return ALLOWED_ROOTS.some((root) => abs === root || abs.startsWith(root + sep));
};

// ── /_status + /_reset support ───────────────────────────────────────────
const wasmPkgDir = resolve(calciteRoot, 'web', 'pkg');
const prebakeDir = resolve(webRoot, 'prebake');
const calciteWasmCrate = resolve(calciteRoot, 'crates', 'calcite-wasm');

const gitHead = (repoDir) => {
  const r = spawnSync('git', ['-C', repoDir, 'log', '-1', '--format=%h %s'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : `(git failed: ${r.stderr?.trim() || 'unknown'})`;
};
const fileInfo = (path) => {
  if (!existsSync(path)) return null;
  const st = statSync(path);
  return { bytes: st.size, mtime: st.mtime.toISOString(), md5: createHash('md5').update(readFileSync(path)).digest('hex').slice(0, 16) };
};
const dirFiles = (dir) => existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.') && !f.endsWith('.d.ts')) : [];

function statusSnapshot() {
  return {
    cssDosCommit: gitHead(repoRoot),
    calciteCommit: gitHead(calciteRoot),
    wasmServedFrom: calcitePkgDir === vendoredCalcitePkg ? 'vendored' : 'sibling-repo',
    wasm: fileInfo(resolve(calcitePkgDir, 'calcite_wasm_bg.wasm')),
    wasmPkgFiles: dirFiles(calcitePkgDir),
    prebake: {
      corduroyBin: fileInfo(resolve(prebakeDir, 'corduroy.bin')),
      muslinBin: fileInfo(resolve(prebakeDir, 'muslin.bin')),
      gossamerBin: fileInfo(resolve(prebakeDir, 'gossamer.bin')),
      manifest: fileInfo(resolve(prebakeDir, 'manifest.json')),
    },
  };
}

function wipeDir(dir, filter = () => true) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || !filter(name)) continue;
    try { unlinkSync(join(dir, name)); n++; } catch {}
  }
  return n;
}
function runStep(label, cmd, args, opts = {}) {
  const started = Date.now();
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return {
    label, ok: !r.error && r.status === 0, exitCode: r.status, ms: Date.now() - started,
    errorMessage: r.error?.message || '',
    stdoutTail: (r.stdout || '').split('\n').slice(-10).join('\n'),
    stderrTail: (r.stderr || '').split('\n').slice(-10).join('\n'),
  };
}
async function resetEverything() {
  const steps = [];
  steps.push({ label: 'wipe calcite/web/pkg', ok: true, filesDeleted: wipeDir(wasmPkgDir) });
  steps.push({ label: 'wipe web/prebake', ok: true, filesDeleted: wipeDir(prebakeDir, (n) => n.endsWith('.bin') || n.endsWith('.json')) });
  steps.push(runStep('wasm-pack build calcite-wasm', 'wasm-pack',
    ['build', calciteWasmCrate, '--target', 'web', '--out-dir', wasmPkgDir, '--release'], { cwd: calciteRoot }));
  steps.push(runStep('prebake BIOSes', process.execPath,
    [resolve(webRoot, 'scripts', 'prebake.mjs')], { cwd: repoRoot }));
  return { startedAt: new Date().toISOString(), steps, status: statusSnapshot() };
}

function cartsJson() {
  const out = [];
  let entries;
  try { entries = readdirSync(cartsDir, { withFileTypes: true }); } catch { entries = []; }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const dir = join(cartsDir, ent.name);
    const files = [];
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      if (f.isFile()) { if (f.name !== 'program.json') files.push(f.name); }
      else if (f.isDirectory()) {
        for (const g of readdirSync(join(dir, f.name), { withFileTypes: true })) {
          if (g.isFile()) files.push(`${f.name}/${g.name}`);
        }
      }
    }
    let program = null;
    const pjPath = join(dir, 'program.json');
    if (existsSync(pjPath)) {
      try { program = JSON.parse(readFileSync(pjPath, 'utf8')); } catch { program = null; }
    }
    out.push({ name: ent.name, files, program });
  }
  return out;
}

const CLEAR_PAGE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>dev: clear browser caches</title>
<style>body{font-family:monospace;padding:24px;max-width:720px;margin:auto;line-height:1.5}h1{font-size:16px}pre{background:#eee;padding:8px;white-space:pre-wrap}</style></head>
<body><h1>Clearing browser caches…</h1><pre id="log">starting…\n</pre>
<script>
const log = document.getElementById('log');
const p = (s) => { log.textContent += '[ok]   ' + s + '\\n'; };
(async () => {
  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) { await r.unregister(); p('unregister ' + (r.scope || '(no scope)')); }
  }
  if ('caches' in window) {
    for (const k of await caches.keys()) { await caches.delete(k); p('caches.delete ' + k); }
  }
  localStorage.clear(); sessionStorage.clear(); p('storage cleared');
  setTimeout(() => location.href = '/', 1500);
})();
</script></body></html>`;

const COI = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// Connect-style middleware: dev endpoints + alias file serving. Anything
// not matched calls next() so Vite handles it (the site itself + HMR).
export function devMiddleware(req, res, next) {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const json = (obj, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...COI });
    res.end(JSON.stringify(obj, null, 2));
  };

  if (path === '/_status') return json(statusSnapshot());
  if (path === '/_reset') return resetEverything().then((r) => json(r, r.steps.every((s) => s.ok !== false) ? 200 : 500));
  if (path === '/_carts.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...COI });
    return res.end(JSON.stringify(cartsJson()));
  }
  if (path === '/_clear') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store', ...COI });
    return res.end(CLEAR_PAGE);
  }

  // Aliased static files (dirs outside web/site/).
  for (const [prefix, dir] of ALIASES) {
    if (!path.startsWith(prefix)) continue;
    let file = join(dir, path.slice(prefix.length));
    if (!isInsideAllowedRoot(file)) { res.statusCode = 404; return res.end('not found'); }
    let st;
    try { st = statSync(file); } catch { res.statusCode = 404; return res.end('not found'); }
    if (st.isDirectory()) {
      file = join(file, 'index.html');
      try { statSync(file); } catch { res.statusCode = 404; return res.end('not found'); }
    }
    const ext = file.slice(file.lastIndexOf('.'));
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store', ...COI });
    return res.end(readFileSync(file));
  }

  next();
}
