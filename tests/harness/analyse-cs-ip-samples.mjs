#!/usr/bin/env node
// analyse-cs-ip-samples.mjs — read a CSV produced by calcite-cli's
// `--sample-cs-ip` flag and turn it into actionable hot-spot data.
//
// The input shape (one row per sample, header line first):
//   tick,cs,ip,sp,burst_id
// burst_id == -1 means "wide single-tick sample". burst_id >= 0 means
// "this row is the Kth tick of burst N" (consecutive ticks share an id).
//
// Two kinds of output, because we sample for two different reasons:
//
// 1. Hot-spot heatmap (from the wide singles).
//    - Top buckets by exact (CS, IP).
//    - Top buckets by (CS, IP>>8) — coarser, useful for "which 256-byte
//      page of which segment is hot" when exact-IP is too noisy.
//    - Both as raw count and percent of singles.
//
// 2. Local-shape analysis (from the bursts).
//    For each burst:
//    - distinct IPs hit (small => tight loop, large => long body)
//    - distinct CS values (>1 means we crossed a segment boundary —
//      a CALL FAR happened)
//    - max consecutive identical-IP run (256 => REP bail signature)
//    - SP min/max (deep call chain vs flat)
//    Aggregate: cluster bursts by their starting CS:IP and report
//    typical shape per cluster.
//
// Why the burst data is structurally different from the heatmap: the
// heatmap is unbiased "where is time spent" (Poisson-style sampling).
// The burst is "what does the local CFG look like right now". Both
// matter. The heatmap tells you where to write a recogniser; the burst
// tells you what shape to recognise.

import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const csvPath = args.find(a => !a.startsWith('--'));
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const eq = a.indexOf('=');
  return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), true];
}));
if (!csvPath) {
  console.error('usage: analyse-cs-ip-samples.mjs <samples.csv> [--top=N] [--page-shift=K] [--json=PATH]');
  console.error('  --top=N         top-N buckets to print (default 30)');
  console.error('  --page-shift=K  IP page size = 1<<K bytes for the coarse heatmap (default 8 = 256-byte pages)');
  console.error('  --json=PATH     also write the full report to PATH as JSON');
  process.exit(2);
}
if (!existsSync(csvPath)) {
  console.error(`no such file: ${csvPath}`);
  process.exit(2);
}

const topN = parseInt(flags.top ?? '30', 10);
const pageShift = parseInt(flags['page-shift'] ?? '8', 10);

// --- read ---
const text = readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/);
if (lines.length === 0 || !lines[0].startsWith('tick,')) {
  console.error('not a sampler CSV (missing header)');
  process.exit(2);
}

// Each row -> {tick, cs, ip, sp, burst}.
const singles = [];
const burstRows = new Map(); // burst_id -> [rows]
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  const parts = line.split(',');
  if (parts.length < 5) continue;
  const row = {
    tick: +parts[0],
    cs:   +parts[1] & 0xFFFF,
    ip:   +parts[2] & 0xFFFF,
    sp:   +parts[3] & 0xFFFF,
    burst: parts[4] === '-1' ? -1 : +parts[4],
  };
  if (row.burst < 0) singles.push(row);
  else {
    let arr = burstRows.get(row.burst);
    if (!arr) { arr = []; burstRows.set(row.burst, arr); }
    arr.push(row);
  }
}

console.error(`loaded ${singles.length.toLocaleString()} wide singles + ${burstRows.size} bursts (${[...burstRows.values()].reduce((a, b) => a + b.length, 0).toLocaleString()} burst samples) from ${csvPath}`);

if (singles.length === 0) {
  console.error('no wide singles — heatmap requires --sample-cs-ip with EVERY > 1');
  process.exit(2);
}

// --- helpers ---
const fmtSeg = (s) => s.toString(16).toUpperCase().padStart(4, '0');
const csIpKey = (cs, ip) => `${fmtSeg(cs)}:${fmtSeg(ip)}`;
const csPageKey = (cs, ip) => `${fmtSeg(cs)}:${fmtSeg((ip >> pageShift) << pageShift)}+${(1 << pageShift)}`;
const fmtPct = (n) => (n * 100).toFixed(2).padStart(6) + '%';
const fmtCount = (n) => n.toLocaleString().padStart(9);

// --- heatmap (wide singles) ---
const exactCounts = new Map();
const pageCounts = new Map();
const segCounts = new Map();
for (const r of singles) {
  const ek = csIpKey(r.cs, r.ip);
  exactCounts.set(ek, (exactCounts.get(ek) ?? 0) + 1);
  const pk = csPageKey(r.cs, r.ip);
  pageCounts.set(pk, (pageCounts.get(pk) ?? 0) + 1);
  const sk = fmtSeg(r.cs);
  segCounts.set(sk, (segCounts.get(sk) ?? 0) + 1);
}
const N = singles.length;

function topBy(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

console.log('');
console.log(`=== Heatmap: top ${topN} segments ===`);
console.log(`  ${'CS'.padEnd(6)} ${'count'.padStart(9)} ${'pct'.padStart(7)}`);
for (const [k, c] of topBy(segCounts, topN)) {
  console.log(`  ${k.padEnd(6)} ${fmtCount(c)} ${fmtPct(c / N)}`);
}

console.log('');
console.log(`=== Heatmap: top ${topN} CS:IP pages (page = ${1 << pageShift} bytes) ===`);
console.log(`  ${'CS:IP-page'.padEnd(20)} ${'count'.padStart(9)} ${'pct'.padStart(7)}`);
for (const [k, c] of topBy(pageCounts, topN)) {
  console.log(`  ${k.padEnd(20)} ${fmtCount(c)} ${fmtPct(c / N)}`);
}

console.log('');
console.log(`=== Heatmap: top ${topN} exact CS:IP ===`);
console.log(`  ${'CS:IP'.padEnd(11)} ${'count'.padStart(9)} ${'pct'.padStart(7)}`);
for (const [k, c] of topBy(exactCounts, topN)) {
  console.log(`  ${k.padEnd(11)} ${fmtCount(c)} ${fmtPct(c / N)}`);
}

// --- burst analysis ---
// Each burst gives us a window of consecutive ticks. From a burst we can
// reconstruct: loop body length (distinct IPs), call depth (segment
// transitions, SP swing), and REP bail signatures (same-IP runs).

function analyseBurst(rows) {
  // rows is sorted by tick already (we wrote them in order).
  const distinctIps = new Set();
  const distinctCs = new Set();
  const cs0 = rows[0].cs;
  const ip0 = rows[0].ip;
  let maxRun = 1;
  let curRun = 1;
  let prevKey = csIpKey(rows[0].cs, rows[0].ip);
  let spMin = rows[0].sp;
  let spMax = rows[0].sp;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    distinctIps.add(`${r.cs}:${r.ip}`);
    distinctCs.add(r.cs);
    if (r.sp < spMin) spMin = r.sp;
    if (r.sp > spMax) spMax = r.sp;
    if (i > 0) {
      const k = csIpKey(r.cs, r.ip);
      if (k === prevKey) {
        curRun += 1;
        if (curRun > maxRun) maxRun = curRun;
      } else {
        curRun = 1;
        prevKey = k;
      }
    }
  }
  return {
    cs0, ip0,
    startKey: csIpKey(cs0, ip0),
    distinctIps: distinctIps.size,
    distinctCs: distinctCs.size,
    maxRun,
    spMin, spMax,
    spSwing: spMax - spMin,
    n: rows.length,
  };
}

const bursts = [...burstRows.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([id, rows]) => ({ id, ...analyseBurst(rows) }));

console.log('');
console.log(`=== Burst summary (${bursts.length} bursts) ===`);
if (bursts.length > 0) {
  console.log(`  ${'id'.padStart(4)} ${'startCS:IP'.padEnd(11)} ${'len'.padStart(5)} ${'distIP'.padStart(7)} ${'distCS'.padStart(7)} ${'maxRun'.padStart(7)} ${'spSwing'.padStart(8)}  shape`);
  for (const b of bursts) {
    let shape = '';
    if (b.distinctIps <= 8) shape = 'TIGHT-LOOP';
    else if (b.distinctIps <= 64) shape = 'small-body';
    else if (b.distinctIps <= 256) shape = 'medium-body';
    else shape = 'long-body';
    if (b.maxRun >= 64) shape += ' REP-BAIL?';
    if (b.distinctCs > 1) shape += ' CROSS-SEG';
    if (b.spSwing > 64) shape += ' DEEP-STACK';
    console.log(`  ${String(b.id).padStart(4)} ${b.startKey.padEnd(11)} ${String(b.n).padStart(5)} ${String(b.distinctIps).padStart(7)} ${String(b.distinctCs).padStart(7)} ${String(b.maxRun).padStart(7)} ${String(b.spSwing).padStart(8)}  ${shape}`);
  }
}

// --- cluster bursts by where the wide-sample heatmap says is hot ---
// For each burst, classify by which segment its starting CS lands in and
// summarise typical local shape per segment.
console.log('');
console.log(`=== Burst shapes by start segment ===`);
const bySeg = new Map();
for (const b of bursts) {
  const k = fmtSeg(b.cs0);
  let arr = bySeg.get(k);
  if (!arr) { arr = []; bySeg.set(k, arr); }
  arr.push(b);
}
const segOrder = [...bySeg.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`  ${'CS'.padEnd(6)} ${'#bursts'.padStart(8)} ${'medDistIP'.padStart(10)} ${'medMaxRun'.padStart(10)} ${'%cross-seg'.padStart(11)}`);
function median(xs) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
for (const [seg, bs] of segOrder) {
  const mDist = median(bs.map(b => b.distinctIps));
  const mRun = median(bs.map(b => b.maxRun));
  const cross = bs.filter(b => b.distinctCs > 1).length / bs.length;
  console.log(`  ${seg.padEnd(6)} ${String(bs.length).padStart(8)} ${String(mDist).padStart(10)} ${String(mRun).padStart(10)} ${fmtPct(cross).padStart(11)}`);
}

// --- json export ---
if (flags.json) {
  const out = {
    csvPath,
    nSingles: singles.length,
    nBursts: bursts.length,
    pageShift,
    heatmap: {
      bySegment: [...segCounts.entries()].sort((a, b) => b[1] - a[1]),
      byPage:    [...pageCounts.entries()].sort((a, b) => b[1] - a[1]),
      byExact:   [...exactCounts.entries()].sort((a, b) => b[1] - a[1]),
    },
    bursts,
  };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(flags.json, JSON.stringify(out, null, 2));
  console.error(`wrote ${flags.json}`);
}
