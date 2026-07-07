#!/usr/bin/env node
// revendor-calcite.mjs — sync web/vendor/calcite-pkg/ from a built sibling
// calcite repo, stamp provenance, and prove the result boots real cabinets.
//
// The vendored bundle is the engine the site SHIPS (a plain clone runs
// with no Rust toolchain), so promoting a new engine into it is a
// deliberate, committed act — this script makes that act one command
// instead of a README cp-block that nobody runs (LOGBOOK 2026-07-07:
// the site broke because the vendor went stale while every native gate
// stayed green).
//
// Usage:
//   npm run revendor                # copy sibling pkg -> vendor, run websmoke
//   npm run revendor -- --build     # wasm-pack build the pkg first
//   npm run revendor -- --skip-websmoke   # copy + stamp only (not for shipping)
//
// Calcite repo location: CALCITE_REPO env, else ../calcite.
// Writes VENDOR-INFO.json (calcite commit, dirty flag, date, file hashes)
// next to the bundle — machine-readable provenance instead of a hash
// buried in README prose.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');
const vendorDir = resolve(repoRoot, 'web', 'vendor', 'calcite-pkg');
const calciteRoot = process.env.CALCITE_REPO
  ? resolve(process.env.CALCITE_REPO)
  : resolve(repoRoot, '..', 'calcite');
const pkgDir = resolve(calciteRoot, 'web', 'pkg');

const FILES = [
  'calcite_wasm.js',
  'calcite_wasm_bg.wasm',
  'calcite_wasm.d.ts',
  'calcite_wasm_bg.wasm.d.ts',
];

const flags = new Set(process.argv.slice(2));
const log = (m) => process.stderr.write(`[revendor] ${m}\n`);
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const git = (...args) => {
  const r = spawnSync('git', ['-C', calciteRoot, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
};

if (!existsSync(calciteRoot)) {
  log(`calcite repo not found at ${calciteRoot} — set CALCITE_REPO`);
  process.exit(1);
}

if (flags.has('--build')) {
  log('wasm-pack build crates/calcite-wasm --target web --out-dir web/pkg --release');
  const r = spawnSync('wasm-pack',
    ['build', 'crates/calcite-wasm', '--target', 'web', '--out-dir', '../../web/pkg', '--release'],
    { cwd: calciteRoot, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) {
    log('wasm-pack build failed (is wasm-pack installed and the wasm32 target added?)');
    process.exit(1);
  }
}

if (!existsSync(resolve(pkgDir, 'calcite_wasm.js'))) {
  log(`no built pkg at ${pkgDir} — run with --build, or build it in the calcite repo first`);
  process.exit(1);
}

const commit = git('rev-parse', '--short', 'HEAD');
const dirty = git('status', '--porcelain') !== '';
if (dirty) log('WARNING: calcite working tree is dirty — vendoring an uncommitted engine');

let changed = 0;
const hashes = {};
for (const f of FILES) {
  const src = resolve(pkgDir, f);
  const dst = resolve(vendorDir, f);
  if (!existsSync(src)) {
    log(`missing in pkg: ${f}`);
    process.exit(1);
  }
  const srcHash = sha256(src);
  if (!existsSync(dst) || sha256(dst) !== srcHash) {
    copyFileSync(src, dst);
    changed++;
    log(`updated ${f}`);
  }
  hashes[f] = srcHash;
}
if (changed === 0) log('vendor already matches the sibling pkg (hashes identical)');

writeFileSync(resolve(vendorDir, 'VENDOR-INFO.json'), JSON.stringify({
  calciteCommit: commit,
  calciteDirty: dirty,
  vendoredAt: new Date().toISOString(),
  sha256: hashes,
}, null, 2) + '\n');
log(`stamped VENDOR-INFO.json (calcite ${commit}${dirty ? '-dirty' : ''})`);

if (flags.has('--skip-websmoke')) {
  log('websmoke SKIPPED — do not ship this without running: node tests/harness/run.mjs websmoke');
  process.exit(0);
}

// Prove the freshly vendored bundle boots real cabinets through the real
// web path. The gate forces the vendored bundle internally, so a stale or
// broken cut cannot pass on the strength of the sibling build.
log('running websmoke against the vendored bundle (~2 min)...');
const gate = spawnSync(process.execPath,
  [resolve(repoRoot, 'tests', 'harness', 'run.mjs'), 'websmoke'],
  { cwd: repoRoot, stdio: 'inherit' });
if (gate.status !== 0) {
  log('websmoke FAILED — the vendored bundle does not boot; do not commit');
  process.exit(2);
}
log('done — commit web/vendor/calcite-pkg/ (bundle + VENDOR-INFO.json)');
