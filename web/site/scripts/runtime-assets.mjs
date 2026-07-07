// Single source of truth for the runtime files the built site fetches at
// root-absolute URLs but that Vite does not bundle: the browser-builder
// module graph (native ESM, fetched over HTTP), the player + shim, the
// prebaked BIOSes, the DOS binaries, the calcite WASM, and the carts.
//
// The SAME table drives dev and prod:
//   - dev  (vite.config.js configureServer): serve these paths off disk.
//   - prod (vite.config.js closeBundle):     copy them into dist/.
// So dev and prod fetch byte-identical URLs from one list — no divergence.
//
// Each entry is [urlPath, srcAbsDir]. urlPath is the root-absolute prefix
// the browser fetches; srcAbsDir is where the files live on disk.
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readFileSync, readdirSync, existsSync, statSync,
} from 'node:fs';
import { createHash } from 'node:crypto';

const here = fileURLToPath(new URL('.', import.meta.url));
const siteRoot = resolve(here, '..');       // web/site/
const webRoot = resolve(siteRoot, '..');    // web/
const repoRoot = resolve(webRoot, '..');    // repo root
const calciteRoot = process.env.CALCITE_REPO
  ? resolve(process.env.CALCITE_REPO)
  : resolve(repoRoot, '..', 'calcite');

// Prefer a freshly-built sibling calcite pkg; fall back to the vendored copy.
// When the sibling wins AND its engine differs from the vendored bundle,
// warn loudly: this table also drives the PROD dist/ copy, so a stale (or
// experimental) sibling build ships to users while the reviewed, committed
// engine sits unused in web/vendor/. `npm run revendor` re-syncs them.
function calcitePkgDir() {
  const sibling = resolve(calciteRoot, 'web', 'pkg');
  const vendored = resolve(webRoot, 'vendor', 'calcite-pkg');
  if (!existsSync(resolve(sibling, 'calcite_wasm.js'))) return vendored;
  try {
    const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
    if (hash(resolve(sibling, 'calcite_wasm_bg.wasm'))
        !== hash(resolve(vendored, 'calcite_wasm_bg.wasm'))) {
      console.warn(
        '[runtime-assets] WARNING: serving the sibling calcite build '
        + `(${sibling}), which DIFFERS from the vendored bundle the site `
        + 'ships (web/vendor/calcite-pkg/). A prod build from this machine '
        + 'ships the sibling engine. Run `npm run revendor` to sync, or '
        + 'delete the sibling web/pkg to use the vendored one.');
    }
  } catch { /* hash check is best-effort */ }
  return sibling;
}

// [urlPath, srcAbsDir]. Order doesn't matter; prefixes don't overlap.
export const RUNTIME_COPIES = [
  ['/browser-builder', resolve(webRoot, 'browser-builder')],
  ['/builder/lib', resolve(repoRoot, 'builder', 'lib')],
  ['/builder/stages', resolve(repoRoot, 'builder', 'stages')],
  ['/kiln', resolve(repoRoot, 'kiln')],
  ['/tools', resolve(repoRoot, 'tools')],
  ['/presets', resolve(repoRoot, 'builder', 'presets')],
  ['/assets/dos', resolve(repoRoot, 'dos', 'bin')],
  ['/assets/msdos4', resolve(repoRoot, 'dos', 'msdos4', 'bin')],
  ['/prebake', resolve(webRoot, 'prebake')],
  ['/shim', resolve(webRoot, 'shim')],
  ['/player', resolve(webRoot, 'player')],
  ['/calcite/pkg', calcitePkgDir()],
  ['/carts', resolve(repoRoot, 'carts')],
];

// tools/mkfat12.mjs carries a `#!/usr/bin/env node` shebang for its CLI use.
// The browser imports it as a module; the shebang is a parse error in a
// <script type=module>/import context, so strip it on serve + copy.
const SHEBANG = /^#![^\n]*\n/;
export function transformRuntimeFile(absFile, bytes) {
  if (absFile.replace(/\\/g, '/').endsWith('/tools/mkfat12.mjs')) {
    return Buffer.from(String(bytes).replace(SHEBANG, ''));
  }
  return bytes;
}

// The carts directory listing a static host won't provide. Same shape the
// app consumes: [{ name, files, program }]. Files are relative paths (one
// subdir level deep, matching the browser builder's FAT path support).
export function cartsIndex() {
  const cartsDir = resolve(repoRoot, 'carts');
  const out = [];
  let entries;
  try { entries = readdirSync(cartsDir, { withFileTypes: true }); } catch { return out; }
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
    const pj = join(dir, 'program.json');
    if (existsSync(pj)) { try { program = JSON.parse(readFileSync(pj, 'utf8')); } catch {} }
    out.push({ name: ent.name, files, program });
  }
  return out;
}

// COOP/COEP for dev parity with header-capable hosts. OPTIONAL: nothing in
// the live path uses SharedArrayBuffer (single-threaded wasm, postMessage
// transport — verified 2026-07-04); kept for a possible wasm-threads future.
export const COI_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.map': 'application/json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.sys': 'application/octet-stream', '.com': 'application/octet-stream',
  '.bin': 'application/octet-stream',
};
export const mimeFor = (file) => MIME[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream';

// Resolve a request URL against the copy table. Returns the on-disk file
// (guarded against path traversal) or null if no prefix matches. Shared by
// the dev middleware; prod copies whole dirs so it doesn't need this.
export function resolveRuntimeUrl(urlPath) {
  for (const [prefix, srcDir] of RUNTIME_COPIES) {
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
