#!/usr/bin/env node
// Compare Calcite trace vs reference emulator trace
import { readFileSync } from 'fs';

const cal = JSON.parse(readFileSync('tests/calcite-trace.json', 'utf8'));
const ref = JSON.parse(readFileSync('tests/ref-trace.json', 'utf8'));

const regs = ['AX','CX','DX','BX','SP','BP','SI','DI','ES','CS','SS','DS'];
const AF = 16;
let afOnly = 0;
let firstDiv = -1;

for (let i = 0; i < Math.min(ref.length, cal.length); i++) {
  const r = ref[i], c = cal[i];
  const refIP = r.IP - r.CS * 16;
  const diffs = [];
  if (refIP !== c.IP) diffs.push(`IP: ref=${refIP} cal=${c.IP}`);
  for (const reg of regs) {
    if (r[reg] !== c[reg]) diffs.push(`${reg}: ref=${r[reg]} cal=${c[reg]}`);
  }
  const refFnoAF = r.FLAGS & ~AF;
  const calFnoAF = c.FLAGS & ~AF;
  if (refFnoAF !== calFnoAF) diffs.push(`FLAGS: ref=${r.FLAGS}(${refFnoAF}) cal=${c.FLAGS}(${calFnoAF})`);
  else if (r.FLAGS !== c.FLAGS) afOnly++;

  if (diffs.length > 0) {
    console.log(`FIRST DIVERGENCE at tick ${i}:`);
    diffs.forEach(d => console.log(`  ${d}`));
    console.log(`  Ref: IP(flat)=${r.IP} IP(off)=${refIP} CS=${r.CS} FLAGS=${r.FLAGS}`);
    console.log(`  Cal: IP=${c.IP} CS=${c.CS} FLAGS=${c.FLAGS}`);
    console.log(`AF-only diffs before: ${afOnly}`);
    firstDiv = i;

    console.log('\n--- Context ---');
    for (let j = Math.max(0, i-3); j <= Math.min(Math.min(ref.length,cal.length)-1, i+3); j++) {
      const rr = ref[j], cc = cal[j];
      const rip = rr.IP - rr.CS * 16;
      const m = j === i ? '>>>' : '   ';
      console.log(`${m} t${j}: ref IP=${rip} CS=${rr.CS} AX=${rr.AX} SP=${rr.SP} FL=${rr.FLAGS} | cal IP=${cc.IP} AX=${cc.AX} SP=${cc.SP} FL=${cc.FLAGS}`);
    }
    break;
  }
}

if (firstDiv === -1) {
  console.log(`ALL ${Math.min(ref.length, cal.length)} TICKS MATCH (ignoring AF)! AF-only diffs: ${afOnly}`);
}
