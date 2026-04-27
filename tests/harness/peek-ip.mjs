#!/usr/bin/env node
// Run ref to instr=N and dump the bytes at CS:IP, plus a small disasm summary.
// Usage: peek-ip.mjs <cabinet>.css --instr=N [--bytes=16]
import { loadCabinetSidecars, createRefMachine } from './lib/ref-machine.mjs';

const args = process.argv.slice(2);
const cssPath = args.find(a => !a.startsWith('--'));
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const eq = a.indexOf('=');
  return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), true];
}));
const target = parseInt(flags.instr ?? '0', 10);
const nbytes = parseInt(flags.bytes ?? '32', 10);

const sc = loadCabinetSidecars(cssPath);
const ref = createRefMachine(sc, {
  initialCS: sc.meta.bios.entrySegment,
  initialIP: sc.meta.bios.entryOffset,
});
for (let i = 0; i < target; i++) ref.step();
const r = ref.regs();
const linear = ((r.CS & 0xFFFF) * 16 + (r.IP & 0xFFFF)) & 0xFFFFF;
const bytes = [];
for (let i = 0; i < nbytes; i++) bytes.push(ref.mem[(linear + i) & 0xFFFFF]);
const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
process.stdout.write(JSON.stringify({
  instr: target,
  CS: r.CS.toString(16), IP: r.IP.toString(16), linear: linear.toString(16),
  AX: r.AX.toString(16), CX: r.CX.toString(16), DX: r.DX.toString(16),
  BX: r.BX.toString(16), SI: r.SI.toString(16), DI: r.DI.toString(16),
  ES: r.ES.toString(16), DS: r.DS.toString(16), SS: r.SS.toString(16), SP: r.SP.toString(16),
  bytes: hex,
}, null, 2) + '\n');
