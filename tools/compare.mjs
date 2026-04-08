#!/usr/bin/env node
// Conformance comparison: reference 8086 emulator vs calcite
//
// Usage: node tools/compare.mjs <program.com> <bios.bin> <fib.css> [--ticks N] [--dump-slots]
//
// Runs both emulators, finds the first tick where registers diverge,
// and outputs a diagnostic report.

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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
  console.error('Usage: node tools/compare.mjs <program.com> <bios.bin> <program.css> [--ticks=N] [--dump-slots]');
  process.exit(1);
}

const comPath = resolve(positional[0]);
const biosPath = resolve(positional[1]);
const cssPath = resolve(positional[2]);
const maxTicks = parseInt(flags.ticks || '500');
const dumpSlots = 'dump-slots' in flags;

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

// IVT
const BIOS_SEG = 0xF000;
const handlers = {
  0x10: 0x0000, 0x16: 0x0155, 0x1A: 0x0190,
  0x20: 0x0232, 0x21: 0x01A9,
};
for (const [intNum, off] of Object.entries(handlers)) {
  const addr = parseInt(intNum) * 4;
  memory[addr] = off & 0xFF;
  memory[addr + 1] = (off >> 8) & 0xFF;
  memory[addr + 2] = BIOS_SEG & 0xFF;
  memory[addr + 3] = (BIOS_SEG >> 8) & 0xFF;
}

const cpu = Intel8086(
  (addr, val) => { memory[addr & 0xFFFFF] = val & 0xFF; },
  (addr) => memory[addr & 0xFFFFF],
);
cpu.reset();
cpu.setRegs({ cs: 0, ip: 0x0100, ss: 0, sp: 0x05F8, ds: 0, es: 0 });

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

// --- Generate reference trace ---
console.error(`Running reference emulator for ${maxTicks} ticks...`);
const refTrace = [];
for (let t = 0; t < maxTicks; t++) {
  cpu.step();
  refTrace.push({ tick: t, ...refState() });
}
writeFileSync(resolve(__dirname, '..', 'ref-trace.json'), JSON.stringify(refTrace));
console.error(`Reference trace saved (${refTrace.length} ticks)`);

// --- Run calcite and capture trace ---
console.error(`Running calcite for ${maxTicks} ticks...`);
const calciteRoot = resolve(__dirname, '..');

// Build a small Rust program that outputs JSON trace
// Actually, let's use the existing CLI with verbose mode and parse its output
const calciteCmd = [
  'cargo', 'run', '--release', '-p', 'calcite-cli', '--',
  '--input', cssPath,
  '--ticks', String(maxTicks),
  '--verbose',
].join(' ');

let calciteOutput;
try {
  calciteOutput = execSync(calciteCmd, {
    cwd: calciteRoot,
    encoding: 'utf-8',
    maxBuffer: 100 * 1024 * 1024,
    env: { ...process.env, RUST_LOG: 'error' },
  });
} catch (e) {
  calciteOutput = e.stdout || '';
  if (e.stderr) console.error('calcite stderr:', e.stderr.slice(0, 500));
}

// Parse calcite verbose output
const calciteTrace = [];
for (const line of calciteOutput.split('\n')) {
  const m = line.match(/^Tick (\d+): \d+ changes \| (.+)/);
  if (!m) continue;
  const tick = parseInt(m[1]);
  const regs = {};
  for (const pair of m[2].split(' ')) {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) regs[k] = parseInt(v);
  }
  calciteTrace.push({ tick, ...regs });
}

console.error(`Calcite trace parsed (${calciteTrace.length} ticks)`);

// --- Compare ---
const REG_NAMES = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI', 'IP', 'ES', 'CS', 'SS', 'DS'];
// Skip FLAGS for now since calcite doesn't track bit 1

let firstDivergence = null;
let matchCount = 0;

for (let i = 0; i < Math.min(refTrace.length, calciteTrace.length); i++) {
  const ref = refTrace[i];
  const cal = calciteTrace[i];
  const diffs = [];

  for (const reg of REG_NAMES) {
    if (ref[reg] !== cal[reg]) {
      diffs.push({ reg, ref: ref[reg], cal: cal[reg] });
    }
  }

  if (diffs.length > 0) {
    firstDivergence = { tick: i, diffs, ref, cal };
    break;
  }
  matchCount++;
}

// --- Report ---
console.log(`\n${'='.repeat(60)}`);
console.log(`CONFORMANCE REPORT: ${positional[0]}`);
console.log(`${'='.repeat(60)}`);
console.log(`Ticks compared: ${Math.min(refTrace.length, calciteTrace.length)}`);
console.log(`Matching ticks: ${matchCount}`);

if (!firstDivergence) {
  console.log(`\nRESULT: ALL ${matchCount} TICKS MATCH`);
} else {
  const d = firstDivergence;
  console.log(`\nFIRST DIVERGENCE at tick ${d.tick}:`);
  console.log(`${'─'.repeat(40)}`);

  // Show context: 3 ticks before
  const contextStart = Math.max(0, d.tick - 3);
  for (let i = contextStart; i <= d.tick; i++) {
    const r = refTrace[i];
    const c = calciteTrace[i];
    const marker = i === d.tick ? '>>>' : '   ';
    console.log(`${marker} Tick ${i}:`);
    console.log(`     REF: AX=${r.AX} CX=${r.CX} DX=${r.DX} BX=${r.BX} SP=${r.SP} BP=${r.BP} SI=${r.SI} DI=${r.DI} IP=${r.IP} CS=${r.CS} DS=${r.DS}`);
    console.log(`     CAL: AX=${c.AX} CX=${c.CX} DX=${c.DX} BX=${c.BX} SP=${c.SP} BP=${c.BP} SI=${c.SI} DI=${c.DI} IP=${c.IP} CS=${c.CS} DS=${c.DS}`);
  }

  console.log(`\nDivergent registers:`);
  for (const { reg, ref: rv, cal: cv } of d.diffs) {
    console.log(`  ${reg}: ref=${rv} (0x${rv.toString(16)})  calcite=${cv} (0x${cv.toString(16)})`);
  }

  // What instruction is at the divergent IP?
  const prevRef = d.tick > 0 ? refTrace[d.tick - 1] : null;
  if (prevRef) {
    const ip = prevRef.IP;
    const biosOff = ip >= BIOS_BASE ? ip - BIOS_BASE : null;
    console.log(`\nInstruction context:`);
    console.log(`  Previous IP: ${ip} (0x${ip.toString(16)})${biosOff !== null ? ` = BIOS+0x${biosOff.toString(16)}` : ''}`);
    if (ip < 0x100 + comBin.length && ip >= 0x100) {
      const off = ip - 0x100;
      const bytes = Array.from(comBin.slice(off, off + 6)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`  Bytes at IP: ${bytes} (.COM+0x${off.toString(16)})`);
    } else if (biosOff !== null && biosOff < biosBin.length) {
      const bytes = Array.from(biosBin.slice(biosOff, biosOff + 6)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.log(`  Bytes at IP: ${bytes} (BIOS+0x${biosOff.toString(16)})`);
    }
  }

  if (dumpSlots) {
    console.log(`\nTo dump slot values at tick ${d.tick}, run calcite with debug instrumentation.`);
  }
}

console.log(`\n${'='.repeat(60)}`);
