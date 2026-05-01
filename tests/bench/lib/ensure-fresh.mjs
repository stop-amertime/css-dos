// ensure-fresh.mjs — staleness check + rebuild for built artifacts.
//
// The contract: any consumer of a built artifact (cabinet, prebake bin,
// calcite-wasm pkg, ...) calls `ensureFresh(spec)` before reading the
// artifact. ensureFresh checks the artifact's mtime against its declared
// inputs (source files, dependent artifacts). If any input is newer than
// the artifact, the rebuild command runs. If --no-rebuild is passed (or
// `opts.noRebuild` is true), it errors when stale rather than rebuilding.
//
// This replaces the implicit "agents need to know to run prebake.mjs after
// editing bios/corduroy/" knowledge with a single primitive. Same shape
// for cabinets, prebake bins, calcite-wasm — describe inputs once, ensure
// freshness everywhere.
//
// Usage:
//   import { ensureFresh } from './ensure-fresh.mjs';
//   await ensureFresh({
//     name:    'doom8088 cabinet',
//     output:  'tests/bench/cache/doom8088.css',
//     inputs:  ['carts/doom8088/**', 'kiln/**', 'builder/**', 'bios/corduroy/**'],
//     rebuild: 'node builder/build.mjs carts/doom8088 -o tests/bench/cache/doom8088.css',
//   });
//
// Globs use a small in-house matcher (not minimatch — keeps deps small);
// supports `**`, `*`, and literal paths. Files starting with `.` are
// skipped. mtime resolution is filesystem-dependent; on NTFS it's
// 100ns precision so this is fine for sub-second rebuilds.
//
// `inputs` may also include other ensureFresh specs by name to express
// transitive deps — e.g. the cabinet depends on `corduroy.bin` which
// depends on `bios/corduroy/`. ensureFresh resolves those as a DAG, which
// means each artifact rebuilds at most once per call.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Repo root: this file is tests/bench/lib/ensure-fresh.mjs
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

// Registered specs by name, for transitive lookups. The host registers
// specs once; ensureFresh(byName) finds them.
const REGISTRY = new Map();

export function registerArtifact(spec) {
  if (!spec.name) throw new Error('ensureFresh spec needs a name');
  REGISTRY.set(spec.name, spec);
}

export function getArtifact(name) {
  const spec = REGISTRY.get(name);
  if (!spec) throw new Error(`unknown artifact: ${name}`);
  return spec;
}

// Ensure a registered artifact is fresh, then return its absolute output path.
// Convenience wrapper for the common pattern.
export async function ensureArtifact(name, opts = {}) {
  const spec = getArtifact(name);
  await ensureFresh(spec, opts);
  return resolve(REPO_ROOT, spec.output);
}

// Resolve a path relative to the repo root.
function repoPath(p) {
  return resolve(REPO_ROOT, p);
}

// Walk a directory, return absolute paths of files matching predicate.
function walkFiles(dir, pred = () => true, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const ent of entries) {
    if (ent.name.startsWith('.')) continue;
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, pred, out);
    else if (ent.isFile() && pred(full)) out.push(full);
  }
  return out;
}

// Resolve a glob-ish pattern under repoRoot to a list of files.
// Supports literal paths, `path/**` (everything under), `path/*.ext`.
function expandPattern(pat) {
  const abs = repoPath(pat);
  // `path/**` — everything under path
  if (pat.endsWith('/**')) {
    return walkFiles(repoPath(pat.slice(0, -3)));
  }
  // `path/*.ext` — files in path matching extension
  const lastSlash = pat.lastIndexOf('/');
  const last = lastSlash >= 0 ? pat.slice(lastSlash + 1) : pat;
  if (last.startsWith('*.')) {
    const ext = last.slice(1);
    const dir = repoPath(pat.slice(0, lastSlash));
    return walkFiles(dir, p => p.endsWith(ext) && !p.includes(sep + 'node_modules' + sep));
  }
  // Literal file
  return existsSync(abs) ? [abs] : [];
}

// Newest mtime across a list of patterns. Returns 0 if no files match.
function newestMtime(patterns) {
  let max = 0;
  for (const pat of patterns) {
    const files = expandPattern(pat);
    for (const f of files) {
      try {
        const m = statSync(f).mtimeMs;
        if (m > max) max = m;
      } catch {}
    }
  }
  return max;
}

// One-shot freshness check + rebuild.
//
// Returns { built: bool, reason: string, durationMs?: number }
//   built=true  → ran rebuild
//   built=false → artifact already fresh, nothing done
//
// Throws if `opts.noRebuild` is true and the artifact is stale.
export async function ensureFresh(spec, opts = {}) {
  const { name, output, inputs = [], rebuild } = spec;
  if (!output) throw new Error(`ensureFresh ${name}: spec.output required`);
  if (!rebuild && !opts.dryRun) throw new Error(`ensureFresh ${name}: spec.rebuild required`);

  if (spec.name) REGISTRY.set(spec.name, spec);

  // Resolve transitive specs in inputs first (recursive ensureFresh).
  const filePatterns = [];
  for (const inp of inputs) {
    if (typeof inp === 'string' && REGISTRY.has(inp)) {
      // Transitive dep — ensure that artifact first.
      const sub = REGISTRY.get(inp);
      await ensureFresh(sub, opts);
      filePatterns.push(sub.output);
    } else {
      filePatterns.push(inp);
    }
  }

  const outputAbs = repoPath(output);
  const outputMtime = existsSync(outputAbs) ? statSync(outputAbs).mtimeMs : 0;
  const inputMtime = newestMtime(filePatterns);

  // Stale if output missing OR any input newer than output.
  const stale = outputMtime === 0 || inputMtime > outputMtime;
  if (!stale) {
    return { built: false, reason: 'fresh' };
  }

  if (opts.noRebuild) {
    const reason = outputMtime === 0
      ? `${output} missing`
      : `${output} older than newest input (${(inputMtime - outputMtime) / 1000 | 0}s stale)`;
    throw new Error(`ensureFresh ${name}: stale and --no-rebuild: ${reason}`);
  }

  // Rebuild.
  const reason = outputMtime === 0 ? 'output missing' : 'inputs newer than output';
  if (opts.verbose !== false) {
    process.stderr.write(`[ensureFresh] ${name}: rebuilding (${reason})\n`);
  }
  const t0 = Date.now();
  try {
    execSync(rebuild, { cwd: REPO_ROOT, stdio: opts.verbose !== false ? 'inherit' : 'pipe' });
  } catch (e) {
    throw new Error(`ensureFresh ${name}: rebuild failed: ${e.message}`);
  }
  return { built: true, reason, durationMs: Date.now() - t0 };
}

// Convenience for use from CLI scripts: parse `--no-rebuild` and
// `--verbose=false` from argv-shaped objects.
export function flagsFromArgs(args) {
  return {
    noRebuild: args['no-rebuild'] === true || args.noRebuild === true,
    verbose:   args.verbose !== false,
    dryRun:    args['dry-run'] === true || args.dryRun === true,
  };
}
