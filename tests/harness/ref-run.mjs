#!/usr/bin/env node
// Run the JS reference 8086 standalone against a cabinet's sidecars for N
// instructions. Prints periodic register snapshots so you can see boot
// progression without involving calcite. Helpful for finding "where does
// DOOM go normally?" vs "where does calcite get stuck?".
//
// Usage:
//   node tests/harness/ref-run.mjs <cabinet>.css [--max=N] [--sample-every=N]

import { loadCabinetSidecars, createRefMachine } from './lib/ref-machine.mjs';

const args = process.argv.slice(2);
const cssPath = args.find(a => !a.startsWith('--'));
if (!cssPath) {
  console.error('usage: ref-run.mjs <cabinet>.css [--max=N] [--sample-every=N]');
  process.exit(2);
}
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const eq = a.indexOf('=');
  return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), true];
}));
const maxInstr = parseInt(flags.max ?? '10000000', 10);
const sampleEvery = parseInt(flags['sample-every'] ?? '500000', 10);

const sc = loadCabinetSidecars(cssPath);
const entryCS = sc.meta.bios.entrySegment;
const entryIP = sc.meta.bios.entryOffset;
const ref = createRefMachine(sc, { initialCS: entryCS, initialIP: entryIP });

const t0 = performance.now();
let lastSampleAt = 0;
for (let i = 0; i < maxInstr; i++) {
  ref.step();
  if (i - lastSampleAt >= sampleEvery) {
    lastSampleAt = i;
    const r = ref.regs();
    const wall = ((performance.now() - t0) / 1000).toFixed(1);
    const mode = ref.mem[0x449];
    const lba = ref.mem[0x4F0] | (ref.mem[0x4F1] << 8);
    process.stdout.write(`instr=${i} t=${wall}s mode=0x${mode.toString(16)} lba=${lba} CS=${r.CS.toString(16)} IP=${r.IP.toString(16)} SP=${r.SP.toString(16)} AX=${r.AX.toString(16)}\n`);
  }
}
const dt = ((performance.now() - t0) / 1000).toFixed(1);
const r = ref.regs();
process.stdout.write(`done instr=${maxInstr} t=${dt}s CS=${r.CS.toString(16)} IP=${r.IP.toString(16)} mode=0x${ref.mem[0x449].toString(16)}\n`);
