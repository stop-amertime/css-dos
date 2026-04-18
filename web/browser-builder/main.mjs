// Browser-side build orchestrator. Replaces builder/build.mjs for the
// browser path. Shares kiln/, builder/lib/sizes.mjs, tools/mkfat12.mjs,
// and builder/stages/kiln.mjs with the Node path.
//
// Supports: hack (.com direct) and dos-muslin (.com via DOS boot).
// dos-corduroy will be added when Corduroy stabilises.
//
// Uses resolveManifest + preset JSONs (fetched from /presets/*) so the
// resolved manifest is byte-identical to what builder/build.mjs produces.

import { runKiln } from '../../builder/stages/kiln.mjs';
import { resolveManifest } from '../../builder/lib/config.mjs';
import { loadPrebakedBios } from './prebake-loader.mjs';
import { buildFloppyInBrowser } from './floppy-adapter.mjs';
import { BlobWriter } from './blob-writer.mjs';

const SUPPORTED_PRESETS = new Set(['hack', 'dos-muslin']);
const ALL_PRESET_NAMES = ['dos-muslin', 'dos-corduroy', 'hack'];

// Fetch and parse a JSON resource.
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// Fetch raw bytes as Uint8Array.
async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Load all preset JSON files from /presets/*.json so resolveManifest can
 * merge them. Matches what builder/build.mjs does at startup.
 */
async function loadPresets() {
  const entries = await Promise.all(
    ALL_PRESET_NAMES.map(async name => [name, await fetchJSON(`/presets/${name}.json`)]),
  );
  return Object.fromEntries(entries);
}

/**
 * Build a CSS cabinet in the browser from a .COM/.EXE program.
 *
 * @param {object}   opts
 * @param {string}   opts.preset          'hack' or 'dos-muslin'
 * @param {Uint8Array} opts.programBytes  Raw program bytes
 * @param {string}   [opts.programName]   Filename on disk (e.g. 'BCD.COM')
 * @param {string}   [opts.bios]          Override BIOS flavor
 * @param {string}   [opts.autorun]       Override boot.autorun (DOS path only)
 * @param {string}   [opts.args]          Extra args for SHELL= line (DOS path only)
 * @param {object}   [opts.manifest]      Extra manifest fields (merged on top of preset)
 * @param {Function} [opts.onProgress]    Called with {stage, message} at each stage
 * @returns {Promise<Blob>}               The CSS cabinet as a Blob
 */
export async function buildCabinetInBrowser({
  preset,
  programBytes,
  programName = 'PROG.COM',
  bios: biosFlavorOverride = null,
  autorun = null,
  args = '',
  manifest: extraManifest = {},
  onProgress = () => {},
}) {
  if (!SUPPORTED_PRESETS.has(preset)) {
    throw new Error(
      `browser builder v1 supports: ${[...SUPPORTED_PRESETS].join(', ')}. got "${preset}"`,
    );
  }

  const progArr = programBytes instanceof Uint8Array
    ? programBytes
    : new Uint8Array(programBytes);

  // Normalise programName to uppercase 8.3.
  const progName = programName.toUpperCase();
  const progExt = progName.includes('.') ? '.' + progName.split('.').pop().toLowerCase() : '';

  // Load preset JSONs so resolveManifest can deep-merge them.
  onProgress({ stage: 'presets', message: 'Loading preset configuration...' });
  const presets = await loadPresets();

  // Construct the raw manifest the same way builder/build.mjs does:
  //   CLI overrides → rawManifest → resolveManifest(rawManifest, files, presets, { bare })
  // We're always treating the input as a "bare" single-file cart.
  const rawManifest = { preset, ...extraManifest };
  if (biosFlavorOverride) rawManifest.bios = biosFlavorOverride;
  if (autorun) {
    rawManifest.boot = { ...(rawManifest.boot ?? {}), autorun: autorun.toUpperCase() };
  }
  if (args) {
    rawManifest.boot = { ...(rawManifest.boot ?? {}), args };
  }

  // Construct the files list (same shape as cart.mjs::discoverFiles produces).
  const cartFiles = [{ name: progName, source: progName, ext: progExt }];

  // resolveManifest fills in boot.raw (hack) or boot.autorun + disk.files (DOS).
  const manifest = resolveManifest(rawManifest, cartFiles, presets, { bare: true });

  // Default BIOS is already baked into the preset and resolved by resolveManifest.
  const biosFlavor = manifest.bios;

  onProgress({ stage: 'bios', message: `Loading ${biosFlavor} BIOS...` });
  const bios = await loadPrebakedBios(biosFlavor);

  const writer = new BlobWriter();
  const header = buildHeader({ preset, biosFlavor, programName: progName });

  if (preset === 'hack') {
    // Hack path: program bytes go directly to Kiln as number[].
    onProgress({ stage: 'kiln', message: 'Transpiling to CSS...' });
    runKiln({
      bios,
      floppy: null,
      manifest,
      kernelBytes: null,
      programBytes: [...progArr],
      output: writer,
      header,
    });
  } else {
    // DOS path: fetch kernel + command.com, assemble FAT12 floppy, run Kiln.
    onProgress({ stage: 'dos', message: 'Loading DOS kernel and command.com...' });
    const [kernelArr, commandArr] = await Promise.all([
      fetchBytes('/assets/dos/kernel.sys'),
      fetchBytes('/assets/dos/command.com'),
    ]);

    onProgress({ stage: 'floppy', message: 'Assembling FAT12 floppy image...' });
    const floppyAutorun = manifest.boot?.autorun ?? null;
    const floppyArgs = manifest.boot?.args ?? '';

    const floppy = buildFloppyInBrowser({
      kernelBytes: kernelArr,
      commandBytes: commandArr,
      programName: progName,
      programBytes: progArr,
      autorun: floppyAutorun,
      args: floppyArgs,
    });

    onProgress({ stage: 'kiln', message: 'Transpiling to CSS...' });
    // kernelBytes must be number[] to match what builder/build.mjs passes.
    const kernelBytes = [...kernelArr];

    runKiln({
      bios,
      floppy,                // { bytes: Uint8Array, layout: [...] } — matches floppy.mjs output
      manifest,
      kernelBytes,
      programBytes: null,    // DOS branch; Kiln uses kernelBytes, not programBytes
      output: writer,
      header,
    });
  }

  onProgress({ stage: 'done', message: `Cabinet ready: ${writer.bytesWritten} bytes` });
  return writer.finish();
}

function buildHeader({ preset, biosFlavor, programName, floppyLayout = null }) {
  const lines = [
    '/* CSS-DOS cabinet (built in browser)',
    ` * Preset:   ${preset}`,
    ` * BIOS:     ${biosFlavor}`,
    ` * Program:  ${programName}`,
    ` * Built:    ${new Date().toISOString()}`,
  ];
  if (floppyLayout) {
    lines.push(' * Floppy layout:');
    for (const f of floppyLayout) {
      lines.push(` *   ${f.name.padEnd(12)} ${String(f.size).padStart(7)} bytes  (${f.source})`);
    }
  }
  lines.push(' */');
  return lines.join('\n');
}
