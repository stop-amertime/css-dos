// fast-shoot.mjs — screenshot at tick N via calcite-cli, no daemon.
//
// The slow path (`shoot.mjs` over `DebuggerClient`) advances the debugger
// in chunked seek calls (default 5000 ticks per IPC round-trip), recording
// per-tick deltas. For an idle inspect-at-tick-N use case that's hundreds
// of times slower than just running calcite-cli once. Boot reaches the
// A:\> prompt around tick 2-4M, so the daemon path doesn't terminate
// inside a 2-minute budget; calcite-cli does the same work in ~10s.
//
// Strategy:
//   1. Spawn calcite-cli with `--dump-tick=N --dump-mem-range=...` for the
//      VRAM and BDA regions we need.
//   2. Read the dumped bytes back from temp files.
//   3. Hand them to the same RGBA rasterisers shoot.mjs uses, then encode PNG.
//
// Output shape matches `shoot()` so callers can swap freely.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { encodePng, phash } from './png.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

// Default location for the calcite-cli release binary, override with
// CALCITE_CLI_BIN. Mirrors `defaultDebuggerBinary` in debugger-client.mjs
// — sibling repo at ../calcite from the CSS-DOS repo root.
export function defaultCalciteCliBinary() {
  return process.env.CALCITE_CLI_BIN
    ?? resolve(REPO_ROOT, '..', 'calcite', 'target', 'release', 'calcite-cli.exe');
}

// 16 standard CGA/VGA text-attribute colours.
const TEXT_PALETTE = [
  [0x00, 0x00, 0x00], [0x00, 0x00, 0xAA], [0x00, 0xAA, 0x00], [0x00, 0xAA, 0xAA],
  [0xAA, 0x00, 0x00], [0xAA, 0x00, 0xAA], [0xAA, 0x55, 0x00], [0xAA, 0xAA, 0xAA],
  [0x55, 0x55, 0x55], [0x55, 0x55, 0xFF], [0x55, 0xFF, 0x55], [0x55, 0xFF, 0xFF],
  [0xFF, 0x55, 0x55], [0xFF, 0x55, 0xFF], [0xFF, 0xFF, 0x55], [0xFF, 0xFF, 0xFF],
];

const FONT_WIDTH = 8;
const FONT_HEIGHT = 8;
let FONT_BYTES = null;
function loadFont() {
  if (FONT_BYTES) return FONT_BYTES;
  // Same 8×8 font shoot.mjs uses — keeps screenshots visually identical
  // between the slow and fast paths for baseline comparison.
  const path = resolve(REPO_ROOT, 'bios', 'corduroy', 'cga-8x8.bin');
  FONT_BYTES = new Uint8Array(readFileSync(path));
  return FONT_BYTES;
}

/**
 * Take a screenshot of `cabinetPath` at tick `tick`, returning the same
 * shape as `shoot()` from shoot.mjs. Wall-clock budget enforced — pass
 * `wallMs` to bound how long calcite-cli is allowed to run.
 *
 * @param {object} opts
 * @param {string} opts.cabinetPath — path to .css cabinet
 * @param {number} opts.tick — target tick for the screenshot
 * @param {number} [opts.wallMs=120_000] — kill calcite-cli after this many ms
 * @param {string} [opts.calciteCliBin] — override the calcite-cli binary path
 * @returns {Promise<{mode, kind, width, height, text?, rgba, png, phash}>}
 */
export async function fastShoot({ cabinetPath, tick, wallMs = 120_000, calciteCliBin } = {}) {
  if (!cabinetPath) throw new Error('fastShoot: cabinetPath required');
  if (typeof tick !== 'number' || tick < 0) throw new Error('fastShoot: tick must be a non-negative number');

  const bin = calciteCliBin ?? defaultCalciteCliBinary();
  const tmp = mkdtempSync(join(tmpdir(), 'fastshoot-'));
  const modePath = join(tmp, 'mode.bin');
  const dacPath  = join(tmp, 'dac.bin');
  const palPath  = join(tmp, 'pal.bin');  // CGA palette register at BDA 0x4F3
  // Generous regions. Text mode needs 80*25*2 = 4000 B at 0xB8000 (we read
  // the full 16 KB CGA aperture so CGA gfx rendering works too); mode 13h
  // needs 64000 B at 0xA0000; the DAC palette lives out-of-band at 0x100000.
  const cgaPath  = join(tmp, 'cga.bin');
  const vgaPath  = join(tmp, 'vga.bin');

  // Run calcite-cli once, dumping all the regions any renderer might need.
  // `--speed 0` runs as fast as the host can; without it calcite throttles
  // to real 8086 timing (~5 MHz), which would push us well past the budget
  // for any realistic boot tick.
  const args = [
    '-i', cabinetPath,
    '--speed', '0',
    '--dump-tick', String(tick),
    '--dump-mem-range', `0x449:1:${modePath}`,
    '--dump-mem-range', `0x4F3:1:${palPath}`,
    '--dump-mem-range', `0xB8000:0x4000:${cgaPath}`,
    '--dump-mem-range', `0xA0000:0xFA00:${vgaPath}`,
    '--dump-mem-range', `0x100000:768:${dacPath}`,
    // Suppress the long property dump --dump-tick produces by default —
    // we don't need it. --sample-cells with an empty list isn't allowed,
    // but giving it `--sample-cells=0` is harmless and keeps stdout small.
    '--sample-cells', '0',
  ];

  await runCalciteCli(bin, args, { wallMs });

  // Now decode based on mode.
  const mode = readFileSync(modePath)[0] & 0xFF;

  if (mode === 0x03 || mode === 0x02 || mode === 0x07) {
    return renderText({ mode, cols: 80, rows: 25, vram: readFileSync(cgaPath) });
  }
  if (mode === 0x00 || mode === 0x01) {
    return renderText({ mode, cols: 40, rows: 25, vram: readFileSync(cgaPath) });
  }
  if (mode === 0x13) {
    return renderMode13({ vram: readFileSync(vgaPath), dac: readFileSync(dacPath) });
  }
  if (mode === 0x04 || mode === 0x05) {
    return renderCga4({ mode, vram: readFileSync(cgaPath) });
  }
  if (mode === 0x06) {
    return renderCga2({ vram: readFileSync(cgaPath) });
  }
  // Unknown mode: return what we know. Caller can dump the bytes themselves.
  return {
    mode,
    kind: 'unknown',
    width: 0,
    height: 0,
    rgba: null,
    png: null,
    phash: null,
    note: `unknown video mode 0x${mode.toString(16)} — no fast-shoot renderer`,
  };
}

// ---- Renderers — pure (bytes -> {rgba, png, ...}) ----

function renderText({ mode, cols, rows, vram }) {
  const font = loadFont();
  const w = cols * FONT_WIDTH;
  const h = rows * FONT_HEIGHT;
  const rgba = new Uint8Array(w * h * 4);
  // Plain ASCII mirror — useful for debugging "did the prompt show up?"
  // without opening the PNG.
  const lines = [];
  for (let y = 0; y < rows; y++) {
    let s = '';
    for (let x = 0; x < cols; x++) {
      const off = (y * cols + x) * 2;
      const ch = vram[off] & 0xFF;
      const attr = vram[off + 1] & 0xFF;
      s += (ch >= 0x20 && ch < 0x7F) ? String.fromCharCode(ch) : (ch === 0 ? ' ' : '.');
      const fg = TEXT_PALETTE[attr & 0x0F];
      const bg = TEXT_PALETTE[(attr >> 4) & 0x07];
      for (let py = 0; py < FONT_HEIGHT; py++) {
        const row = font[(ch & 0xFF) * FONT_HEIGHT + py];
        for (let px = 0; px < FONT_WIDTH; px++) {
          const lit = (row >> (7 - px)) & 1;
          const c = lit ? fg : bg;
          const idx = ((y * FONT_HEIGHT + py) * w + (x * FONT_WIDTH + px)) * 4;
          rgba[idx] = c[0]; rgba[idx + 1] = c[1]; rgba[idx + 2] = c[2]; rgba[idx + 3] = 0xFF;
        }
      }
    }
    lines.push(s.replace(/ +$/, ''));
  }
  const png = encodePng(w, h, rgba);
  return { mode, kind: 'text', width: w, height: h, text: lines.join('\n'), rgba, png, phash: phash(w, h, rgba) };
}

function renderMode13({ vram, dac }) {
  const rgba = new Uint8Array(320 * 200 * 4);
  for (let i = 0; i < 320 * 200; i++) {
    const c = vram[i] & 0xFF;
    const r6 = dac[c * 3 + 0] & 0x3F;
    const g6 = dac[c * 3 + 1] & 0x3F;
    const b6 = dac[c * 3 + 2] & 0x3F;
    // 6-bit DAC -> 8-bit: replicate top 2 bits into low 2 (matches real VGA
    // hardware and the bridge's pixel pipeline).
    rgba[i * 4 + 0] = (r6 << 2) | (r6 >> 4);
    rgba[i * 4 + 1] = (g6 << 2) | (g6 >> 4);
    rgba[i * 4 + 2] = (b6 << 2) | (b6 >> 4);
    rgba[i * 4 + 3] = 0xFF;
  }
  const png = encodePng(320, 200, rgba);
  return { mode: 0x13, kind: 'mode13', width: 320, height: 200, rgba, png, phash: phash(320, 200, rgba) };
}

function renderCga4({ mode, vram }) {
  // Same palette assumption as shoot.mjs — palette 1, intensity 0. CGA 5
  // (mono) overrides only the colour table, kept simple here.
  const PAL = [
    [0x00, 0x00, 0x00], [0x00, 0xFF, 0xFF], [0xFF, 0x00, 0xFF], [0xFF, 0xFF, 0xFF],
  ];
  const rgba = new Uint8Array(320 * 200 * 4);
  // Even rows at offset 0, odd rows at offset 0x2000 (interleaved CGA layout).
  for (let row = 0; row < 200; row++) {
    const baseOff = (row & 1) ? 0x2000 : 0;
    const srcRow = (row >> 1) * 80;
    for (let col = 0; col < 320; col++) {
      const byte = vram[baseOff + srcRow + (col >> 2)] & 0xFF;
      const shift = 6 - ((col & 3) * 2);
      const idx = (byte >> shift) & 3;
      const c = PAL[idx];
      const off = (row * 320 + col) * 4;
      rgba[off] = c[0]; rgba[off + 1] = c[1]; rgba[off + 2] = c[2]; rgba[off + 3] = 0xFF;
    }
  }
  const png = encodePng(320, 200, rgba);
  return { mode, kind: 'cga320', width: 320, height: 200, rgba, png, phash: phash(320, 200, rgba) };
}

function renderCga2({ vram }) {
  const rgba = new Uint8Array(640 * 200 * 4);
  for (let row = 0; row < 200; row++) {
    const baseOff = (row & 1) ? 0x2000 : 0;
    const srcRow = (row >> 1) * 80;
    for (let col = 0; col < 640; col++) {
      const byte = vram[baseOff + srcRow + (col >> 3)] & 0xFF;
      const lit = (byte >> (7 - (col & 7))) & 1;
      const off = (row * 640 + col) * 4;
      rgba[off] = rgba[off + 1] = rgba[off + 2] = lit ? 0xFF : 0x00;
      rgba[off + 3] = 0xFF;
    }
  }
  const png = encodePng(640, 200, rgba);
  return { mode: 0x06, kind: 'cga640', width: 640, height: 200, rgba, png, phash: phash(640, 200, rgba) };
}

// ---- calcite-cli runner with wall-clock budget ----

function runCalciteCli(bin, args, { wallMs }) {
  return new Promise((res, rej) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let killed = false;
    const t = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, wallMs);
    child.stdout.on('data', () => { /* discard — we only care about side-effect files */ });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', e => { clearTimeout(t); rej(new Error(`calcite-cli spawn failed: ${e.message}`)); });
    child.on('close', code => {
      clearTimeout(t);
      if (killed) return rej(new Error(`calcite-cli exceeded wall budget ${wallMs}ms`));
      if (code !== 0) return rej(new Error(`calcite-cli exit ${code}: ${stderr.split('\n').slice(-5).join('\n')}`));
      res();
    });
  });
}
