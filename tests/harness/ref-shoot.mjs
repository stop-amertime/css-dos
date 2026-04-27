#!/usr/bin/env node
// Render the JS-reference 8086's screen at instruction N, using the same
// mode-13h decoder as fast-shoot. Pure JS, fast (~2M instr/s), no calcite.
// Lets you see "what does the cabinet show under the reference CPU at
// instr=N" for direct visual comparison against `pipeline.mjs fast-shoot`.
//
// Usage: node tests/harness/ref-shoot.mjs <cabinet>.css --instr=N --out=path.png

import { writeFileSync } from 'node:fs';
import { loadCabinetSidecars, createRefMachine } from './lib/ref-machine.mjs';
import { encodePng } from './lib/png.mjs';

const args = process.argv.slice(2);
const cssPath = args.find(a => !a.startsWith('--'));
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const eq = a.indexOf('=');
  return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), true];
}));
if (!cssPath || !flags.instr || !flags.out) {
  console.error('usage: ref-shoot.mjs <cabinet>.css --instr=N --out=path.png');
  process.exit(2);
}
const targetInstr = parseInt(flags.instr, 10);

const sc = loadCabinetSidecars(cssPath);
const ref = createRefMachine(sc, {
  initialCS: sc.meta.bios.entrySegment,
  initialIP: sc.meta.bios.entryOffset,
});

const t0 = performance.now();
for (let i = 0; i < targetInstr; i++) ref.step();
const stepMs = performance.now() - t0;

const mode = ref.mem[0x449];
const r = ref.regs();
process.stderr.write(`ref ran ${targetInstr} instr in ${stepMs.toFixed(0)}ms (mode=0x${mode.toString(16)}, CS=${r.CS.toString(16)} IP=${r.IP.toString(16)})\n`);

if (mode !== 0x13) {
  console.error(`expected mode 0x13, got 0x${mode.toString(16)}`);
  process.exit(3);
}

// Mode 13h: 320x200 palette-indexed at 0xA0000.
// DAC: 6-bit RGB triples at 0x100000 — 768 bytes. But ref-machine has 1MB RAM
// (no out-of-1MB), so DAC won't be there. It would have come via OUT 0x3C9
// writes which the JS emulator (via PIC?) probably ignores. Fall back to
// reading port output history — for now use the standard VGA boot palette.
// Actually js8086 has no OUT 0x3C9 dispatch, so DAC writes are no-ops.
// We need to either: (a) wire OUT 0x3C9 to a side buffer, or (b) just use the
// hardcoded VGA palette as an approximation.
//
// For the first pass, we approximate with the VGA boot palette so we can
// see geometry. Doom programs its own palette so this won't be color-accurate.

// Resolve via the DAC ref-machine maintains by snooping OUT 0x3C9 writes.
// 6-bit DAC values get expanded to 8-bit the way real VGA hardware does.
const dac = ref.dacBytes;
const W = 320, H = 200;
const rgba = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const idx = ref.mem[0xA0000 + i];
  const r6 = dac[idx * 3] & 0x3F;
  const g6 = dac[idx * 3 + 1] & 0x3F;
  const b6 = dac[idx * 3 + 2] & 0x3F;
  rgba[i*4]   = (r6 << 2) | (r6 >> 4);
  rgba[i*4+1] = (g6 << 2) | (g6 >> 4);
  rgba[i*4+2] = (b6 << 2) | (b6 >> 4);
  rgba[i*4+3] = 0xFF;
}
writeFileSync(flags.out, encodePng(W, H, rgba));
process.stderr.write(`wrote ${flags.out}\n`);
