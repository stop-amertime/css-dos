#!/usr/bin/env node
// TEST HARNESS SHORTCUT — not a machine model.
//
// This file bypasses the normal PC boot sequence (BIOS init, IVT setup via
// bios_init) and sets up the emulator state directly from outside. It loads
// the .COM at 0x100, reads handler offsets from gossamer.lst (the NASM
// listing), pre-populates the IVT, and starts the CPU at CS:IP=0000:0100.
// This is enough for conformance testing but does NOT replicate what a real
// PC does at power-on.
//
// Conformance comparison: reference 8086 emulator vs calcite
//
// Usage: node tools/compare.mjs <program.com> <gossamer.bin> <program.css> [--ticks=N] [--dump-slots]
//
// Runs both emulators, finds the first tick where registers diverge,
// and outputs a diagnostic report.
//
// The reference emulator executes REP-prefixed string ops as a single step
// (CX→0 in one tick), while the CSS executes one iteration per tick.
// The comparison aligns traces by IP to handle this difference.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { loadIvtHandlers, writeIvtTo } from './lib/bios-symbols.mjs';
import { PIC, PIT, KeyboardController } from './peripherals.mjs';
import { createBiosHandlers } from './lib/bios-handlers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Parse args ---
const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const flags = Object.fromEntries(
  args.filter(a => a.startsWith('--')).map(a => {
    const [k, v] = a.split('=');
    return [k.replace(/^--/, ''), v ?? 'true'];
  })
);

if (positional.length < 3) {
  console.error('Usage: node tools/compare.mjs <program.com> <gossamer.bin> <program.css> [--ticks=N] [--dump-slots]');
  process.exit(1);
}

const comPath = resolve(positional[0]);
const biosPath = resolve(positional[1]);
const cssPath = resolve(positional[2]);
const maxTicks = parseInt(flags.ticks || '500');
const calciteTicks = parseInt(flags['calcite-ticks'] || String(maxTicks * 10));
const dumpSlots = 'dump-slots' in flags;

// Parse key events: --key-events=100:0x1E61,150:0
const keyEvents = [];
if (flags['key-events']) {
  for (const part of flags['key-events'].split(',')) {
    const [cycleStr, keyStr] = part.split(':');
    keyEvents.push({ cycle: parseInt(cycleStr), key: parseInt(keyStr) });
  }
}

// --- Load reference emulator ---
const js8086Source = readFileSync(resolve(__dirname, 'js8086.js'), 'utf-8');
const evalSource = js8086Source.replace("'use strict';", '').replace('let CPU_186 = 0;', 'var CPU_186 = 0;');
const Intel8086 = new Function(evalSource + '\nreturn Intel8086;')();

const comBin = readFileSync(comPath);
const biosBin = readFileSync(biosPath);

// 1MB flat memory
const memory = new Uint8Array(1024 * 1024);

// Load .COM at 0000:0100
for (let i = 0; i < comBin.length; i++) memory[0x100 + i] = comBin[i];

// Load BIOS at F000:0000
const BIOS_BASE = 0xF0000;
for (let i = 0; i < biosBin.length; i++) memory[BIOS_BASE + i] = biosBin[i];

// IVT — handler offsets come from the NASM listing next to the .bin,
// not hardcoded. See tools/lib/bios-symbols.mjs for the rationale.
const BIOS_SEG = 0xF000;
const handlers = loadIvtHandlers(biosPath.replace(/\.bin$/, '.lst'));
writeIvtTo(memory, handlers, BIOS_SEG);

const pic = new PIC();
const pit = new PIT(pic);
const kbd = new KeyboardController(pic);

let int_handler = null;

const cpu = Intel8086(
  (addr, val) => { memory[addr & 0xFFFFF] = val & 0xFF; },
  (addr) => memory[addr & 0xFFFFF],
  pic,
  pit,
  (type) => int_handler ? int_handler(type) : false,
);
cpu.reset();
cpu.setRegs({ cs: 0, ip: 0x0100, ss: 0, sp: 0x05F8, ds: 0, es: 0 });

int_handler = createBiosHandlers(
  memory, pic, kbd,
  () => cpu.getRegs(),
  (regs) => cpu.setRegs(regs),
);

function refState() {
  const r = cpu.getRegs();
  return {
    AX: (r.ah << 8) | r.al, CX: (r.ch << 8) | r.cl,
    DX: (r.dh << 8) | r.dl, BX: (r.bh << 8) | r.bl,
    SP: r.sp, BP: r.bp, SI: r.si, DI: r.di,
    IP: r.cs * 16 + r.ip,
    ES: r.es, CS: r.cs, SS: r.ss, DS: r.ds, FLAGS: r.flags,
  };
}

// Initialize BDA keyboard buffer pointers (empty buffer)
memory[0x041A] = 0x1E;  // head lo
memory[0x041B] = 0x00;  // head hi
memory[0x041C] = 0x1E;  // tail lo
memory[0x041D] = 0x00;  // tail hi
// BDA video mode defaults
memory[0x0449] = 0x03;  // video mode 3 (80x25 color text)
memory[0x044A] = 80;    // columns

// --- Generate reference trace ---
console.error(`Running reference emulator for ${maxTicks} ticks...`);
const refTrace = [];
let lastRefIP = -1;
for (let t = 0; t < maxTicks; t++) {
  // Inject key events at the right cycle
  for (const ev of keyEvents) {
    if (ev.cycle === t) {
      kbd.feedKey(ev.key);
    }
  }
  cpu.step();
  const st = refState();
  refTrace.push({ tick: t, ...st });
  if (st.IP === lastRefIP) {
    console.error(`Ref halted at tick ${t}, IP=0x${st.IP.toString(16)}`);
    break;
  }
  lastRefIP = st.IP;
}
writeFileSync(resolve(__dirname, '..', 'ref-trace.json'), JSON.stringify(refTrace));
console.error(`Reference trace saved (${refTrace.length} ticks)`);

// --- Run calcite and capture trace ---
console.error(`Running calcite for ${calciteTicks} ticks...`);

// Find calcite binary
const calciteExeName = process.platform === 'win32' ? 'calcite-cli.exe' : 'calcite-cli';
const calciteBin = resolve(__dirname, '..', '..', 'calcite', 'target', 'release', calciteExeName);
const calciteCmd = [
  calciteBin,
  '--input', cssPath,
  '--ticks', String(calciteTicks),
  '--trace-json',
  '--halt=-15',
].join(' ');

let calciteOutput;
try {
  calciteOutput = execSync(calciteCmd, {
    encoding: 'utf-8',
    maxBuffer: 200 * 1024 * 1024,
  });
} catch (e) {
  calciteOutput = e.stdout || '';
  if (e.stderr) console.error('calcite stderr:', e.stderr.slice(0, 500));
}

// Parse calcite JSON trace (last non-empty line is the JSON array)
const calciteTrace = [];
const lines = calciteOutput.trim().split('\n');
for (let i = lines.length - 1; i >= 0; i--) {
  try {
    const arr = JSON.parse(lines[i]);
    if (Array.isArray(arr)) {
      calciteTrace.push(...arr);
      break;
    }
  } catch {}
}

console.error(`Calcite trace parsed (${calciteTrace.length} ticks)`);

// --- Compare at instruction retirement boundaries ---
// v3 CSS executes one μop per tick. An instruction retires when --uOp returns
// to 0 after being non-zero, or when it was always 0 (single-cycle instruction).
// The reference emulator retires one instruction per tick.
//
// Alignment: for each ref tick, advance the Calcite cursor to the next
// retirement tick (uOp === 0), then compare. This handles multi-cycle
// instructions (PUSH, INT, CALL, REP string ops) uniformly.

const REG_NAMES = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI', 'IP', 'ES', 'CS', 'SS', 'DS'];

// Normalise IP: ref uses flat (CS*16+IP), calcite stores IP as segment offset.
function normaliseIP(state) {
  if (state.CS !== undefined && state.CS > 0) {
    return state.CS * 16 + state.IP;
  }
  return state.IP;
}

// Advance Calcite cursor to match the ref emulator's post-instruction state.
// This handles both multi-μop instructions (PUSH, INT — uOp > 0 during mid-
// instruction ticks) and multi-iteration REP (uOp stays 0 but IP doesn't
// advance until all iterations complete).
// Strategy: advance until calcite's IP matches the target IP.
function advanceToIP(trace, cursor, targetIP, limit = 500) {
  let j = cursor;
  const end = Math.min(trace.length, cursor + limit);
  while (j < end) {
    const calIP = trace[j].CS > 0
      ? trace[j].CS * 16 + trace[j].IP
      : trace[j].IP;
    if (calIP === targetIP && trace[j].uOp === 0) {
      return j;
    }
    j++;
  }
  return -1; // couldn't find matching IP
}

let firstDivergence = null;
let matchCount = 0;
let totalCompared = 0;
let multiCycleSkips = 0;

let ci = 0; // calcite cursor

for (let ri = 0; ri < refTrace.length && ci < calciteTrace.length; ri++) {
  const ref = refTrace[ri];

  // Advance Calcite to match ref's post-instruction IP.
  const refIP = ref.IP;
  const retireTick = advanceToIP(calciteTrace, ci, refIP);
  if (retireTick < 0) {
    firstDivergence = {
      refTick: ri, calTick: ci,
      diffs: [{ reg: 'IP', ref: refIP, cal: normaliseIP(calciteTrace[ci]) }],
      ref, cal: calciteTrace[ci],
      reason: `Could not find calcite tick matching ref IP=0x${refIP.toString(16)} (searched from tick ${ci})`,
    };
    break;
  }

  const skipped = retireTick - ci;
  multiCycleSkips += skipped;
  ci = retireTick;

  const calNow = calciteTrace[ci];

  // Compare registers at retirement.
  const diffs = [];
  for (const reg of REG_NAMES) {
    let rv = ref[reg], cv = calNow[reg];
    if (reg === 'IP') {
      rv = ref.IP;
      cv = normaliseIP(calNow);
    }
    if (reg === 'FLAGS') {
      rv = ref.FLAGS;
      cv = calNow.flags;
    }
    if (rv !== cv) {
      diffs.push({ reg, ref: rv, cal: cv });
    }
  }

  if (diffs.length > 0) {
    firstDivergence = {
      refTick: ri, calTick: ci,
      diffs, ref, cal: calNow,
    };
    break;
  }
  matchCount++;
  totalCompared++;
  ci++; // advance past this retirement tick
}

// --- Report ---
console.log(`\n${'='.repeat(60)}`);
console.log(`CONFORMANCE REPORT: ${positional[0]}`);
console.log(`${'='.repeat(60)}`);
console.log(`Ref ticks: ${refTrace.length}  Calcite ticks: ${calciteTrace.length}`);
console.log(`Instructions compared: ${totalCompared}`);
console.log(`Matching: ${matchCount}`);
if (multiCycleSkips > 0) {
  console.log(`Multi-cycle ticks skipped: ${multiCycleSkips} (mid-instruction μop ticks)`);
}

if (!firstDivergence) {
  console.log(`\nRESULT: ALL ${matchCount} INSTRUCTIONS MATCH`);
} else {
  const d = firstDivergence;
  console.log(`\nFIRST DIVERGENCE at ref tick ${d.refTick}, calcite tick ${d.calTick}:`);
  if (d.reason) console.log(`  ${d.reason}`);
  console.log(`${'─'.repeat(40)}`);

  // Show context: 3 ref ticks before
  const contextStart = Math.max(0, d.refTick - 3);
  for (let i = contextStart; i <= d.refTick; i++) {
    const r = refTrace[i];
    const marker = i === d.refTick ? '>>>' : '   ';
    console.log(`${marker} Ref tick ${i}:`);
    console.log(`     REF: AX=${r.AX} CX=${r.CX} DX=${r.DX} BX=${r.BX} SP=${r.SP} BP=${r.BP} SI=${r.SI} DI=${r.DI} IP=0x${r.IP.toString(16)} CS=${r.CS} FLAGS=0x${r.FLAGS.toString(16)}`);
  }
  console.log(`     CAL: AX=${d.cal.AX} CX=${d.cal.CX} DX=${d.cal.DX} BX=${d.cal.BX} SP=${d.cal.SP} BP=${d.cal.BP} SI=${d.cal.SI} DI=${d.cal.DI} IP=0x${normaliseIP(d.cal).toString(16)} CS=${d.cal.CS} FLAGS=0x${(d.cal.FLAGS||0).toString(16)}`);

  console.log(`\nDivergent registers:`);
  for (const { reg, ref: rv, cal: cv } of d.diffs) {
    console.log(`  ${reg}: ref=${rv} (0x${rv.toString(16)})  calcite=${cv} (0x${cv.toString(16)})`);
  }

  // What instruction is at the divergent IP?
  const prevRef = d.refTick > 0 ? refTrace[d.refTick - 1] : null;
  if (prevRef) {
    const ip = prevRef.IP;
    const biosOff = ip >= BIOS_BASE ? ip - BIOS_BASE : null;
    console.log(`\nInstruction context:`);
    console.log(`  Previous IP: 0x${ip.toString(16)}${biosOff !== null ? ` = BIOS+0x${biosOff.toString(16)}` : ''}`);
    if (ip < 0x100 + comBin.length && ip >= 0x100) {
      const off = ip - 0x100;
      const bytes = Array.from(comBin.slice(off, off + 6)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`  Bytes at IP: ${bytes} (.COM+0x${off.toString(16)})`);
    } else if (biosOff !== null && biosOff < biosBin.length) {
      const bytes = Array.from(biosBin.slice(biosOff, biosOff + 6)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`  Bytes at IP: ${bytes} (BIOS+0x${biosOff.toString(16)})`);
    }
  }
}

console.log(`\n${'='.repeat(60)}`);
