// Resolve a cart's manifest against its preset, fill in defaults, validate.

const VALID_BIOSES = ['gossamer', 'muslin', 'corduroy'];
const VALID_PRESETS = ['dos-muslin', 'dos-corduroy', 'hack'];

/**
 * Given a raw cart manifest (possibly empty), discovered cart files, and
 * pre-loaded preset JSON objects, return a resolved manifest with defaults
 * filled in and preset merged.
 *
 * `presets` must be an object keyed by preset name, e.g.:
 *   { 'dos-muslin': {...}, 'dos-corduroy': {...}, 'hack': {...} }
 *
 * The caller (builder/build.mjs on Node; web/browser-builder/main.mjs in the
 * browser) is responsible for loading or bundling the preset JSON.
 *
 * Throws an Error with an `.errors` array listing every validation failure.
 */
export function resolveManifest(manifest, files, presets = {}) {
  const errors = [];

  const presetName = manifest.preset ?? 'dos-corduroy';
  if (!VALID_PRESETS.includes(presetName)) {
    errors.push(`preset: must be one of ${VALID_PRESETS.join(', ')}; got ${JSON.stringify(presetName)}`);
  } else if (presets[presetName] === undefined) {
    throw new Error(`preset "${presetName}" was not loaded by the caller; pass presets[${JSON.stringify(presetName)}] when calling resolveManifest`);
  }

  const preset = presets[presetName] ?? {};

  // Deep-merge preset ← manifest (manifest wins).
  const merged = deepMerge(preset, manifest);
  merged.preset = presetName;

  // Reject the pre-2026-04-27 boot fields up-front. The cabinet now always
  // boots SHELL=\COMMAND.COM /P /K <runCommand>; there is no SHELL=GAME.EXE
  // shortcut. Anything that still uses boot.autorun / boot.args needs to
  // migrate to a single boot.runCommand string.
  if (manifest.boot?.autorun !== undefined) {
    errors.push('boot.autorun was removed; use boot.runCommand (e.g. "DOOM -noxms") instead');
  }
  if (manifest.boot?.args !== undefined) {
    errors.push('boot.args was removed; fold the args into boot.runCommand instead');
  }

  // Auto-infer disk.files and boot.runCommand for DOS carts if not explicit.
  if (presetName !== 'hack') {
    if (merged.disk && merged.disk.files == null) {
      merged.disk.files = files.map(f => ({ name: f.name, source: f.source }));
    }
    if (merged.boot && merged.boot.runCommand === undefined) {
      const runnables = files.filter(f => f.ext === '.com' || f.ext === '.exe');
      merged.boot.runCommand = runnables.length === 1
        ? runnables[0].name.replace(/\.(com|exe)$/i, '')
        : '';
    }
  } else {
    // Hack cart: boot.raw required; default to the single .COM if any.
    merged.boot = merged.boot ?? {};
    if (merged.boot.raw == null) {
      const runnables = files.filter(f => f.ext === '.com');
      if (runnables.length === 1) merged.boot.raw = runnables[0].source;
    }
  }

  // ----- Validation -----
  if (merged.bios != null && !VALID_BIOSES.includes(merged.bios)) {
    errors.push(`bios: must be one of ${VALID_BIOSES.join(', ')}; got ${JSON.stringify(merged.bios)}`);
  }

  if (presetName === 'hack') {
    if (merged.bios && merged.bios !== 'gossamer') {
      errors.push(`preset "hack" requires bios "gossamer"; got ${JSON.stringify(merged.bios)}`);
    }
    if (merged.disk != null) {
      errors.push(`preset "hack" forbids disk; got ${JSON.stringify(merged.disk)}`);
    }
    if (merged.boot?.runCommand != null && merged.boot.runCommand !== '') {
      errors.push(`preset "hack" uses boot.raw, not boot.runCommand`);
    }
    if (merged.boot?.raw == null) {
      errors.push(`preset "hack" requires boot.raw (filename of .COM to load at 0x100)`);
    }
  } else {
    if (merged.boot?.raw != null) {
      errors.push(`boot.raw is only valid on hack carts`);
    }
    if (typeof merged.boot?.runCommand !== 'string') {
      errors.push(`boot.runCommand must be a string (got ${JSON.stringify(merged.boot?.runCommand)})`);
    }
  }

  if (manifest.version != null && !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    errors.push(`version: must be semver; got ${JSON.stringify(manifest.version)}`);
  }

  // Source-escapes-cart check — caller (floppy stage) also validates,
  // but a shape check here is cheap.
  if (merged.disk?.files) {
    for (const f of merged.disk.files) {
      if (typeof f.name !== 'string' || typeof f.source !== 'string') {
        errors.push(`disk.files[]: each entry must be { name, source }`);
        break;
      }
      if (f.source.includes('..')) {
        errors.push(`disk.files[].source must not escape cart root: ${JSON.stringify(f.source)}`);
      }
    }
  }

  if (errors.length) {
    const err = new Error(`cart manifest has ${errors.length} error${errors.length > 1 ? 's' : ''}:\n  ${errors.join('\n  ')}`);
    err.errors = errors;
    throw err;
  }

  return merged;
}

function deepMerge(a, b) {
  if (b === null) return null;
  if (Array.isArray(b) || typeof b !== 'object') return b;
  const out = { ...(a ?? {}) };
  for (const k of Object.keys(b)) {
    const av = out[k], bv = b[k];
    if (bv && typeof bv === 'object' && !Array.isArray(bv) && av && typeof av === 'object' && !Array.isArray(av)) {
      out[k] = deepMerge(av, bv);
    } else {
      out[k] = bv;
    }
  }
  return out;
}
