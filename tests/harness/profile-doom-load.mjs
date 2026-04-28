#!/usr/bin/env node
// profile-doom-load.mjs — produce a flame-graph-shaped breakdown of where
// CPU time goes during Doom8088's level load, by stepping the reference
// JS 8086 emulator (~2M instr/s, in-process) and hooking every CALL/RET.
//
// Why this instead of running calcite + REP_DIAG: calcite at ~7 MHz takes
// ~1 wall minute to reach in-game; under the web player the same trip is
// many minutes. The reference is ~10-30x faster, deterministic, and easy
// to instrument. The CPU work being profiled is CSS-DOS-independent — what
// happens on the reference is what calcite has to execute eventually.
//
// What we profile: from boot to a configurable instruction budget. The
// title auto-advances to demo3 in Doom8088 (per LOGBOOK 2026-04-27),
// which exercises the same level-load code-path as a New Game without
// needing keyboard injection. Run far enough in (~80M instr) and the
// demo's level-load is captured.
//
// Output: top N CALL sites by self time and inclusive time, with caller
// distribution. CS:IP keys are reported raw — we don't have a .map file
// yet (Doom8088 release zip doesn't ship one). To resolve, build
// Doom8088 from source with -Wl,-Map=doom.map and the symbolicate flow
// can be added later.

import { loadCabinetSidecars, createRefMachine } from './lib/ref-machine.mjs';

const args = process.argv.slice(2);
const cssPath = args.find(a => !a.startsWith('--'));
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const eq = a.indexOf('=');
  return eq > 0 ? [a.slice(2, eq), a.slice(eq + 1)] : [a.slice(2), true];
}));
if (!cssPath) {
  console.error('usage: profile-doom-load.mjs <cabinet>.css [--instr=N] [--from=N] [--top=N] [--json=PATH]');
  console.error('  --instr=N : total instruction budget to run (default 80_000_000)');
  console.error('  --from=N  : start counting only after instruction N (skip BIOS/DOS boot, default 5_000_000)');
  console.error('  --top=N   : print top N call sites by inclusive time (default 30)');
  console.error('  --json=PATH : also write full per-key breakdown to JSON');
  console.error('  --dump=N    : after profiling, dump 64 code bytes + caller context for top-N sites (default 0)');
  console.error('  --callers=N : also report true byte-level call sites for the top-N sites by inclusive time');
  process.exit(2);
}

const totalInstr = parseInt(flags.instr ?? '80000000', 10);
const fromInstr  = parseInt(flags.from  ?? '5000000', 10);
const topN       = parseInt(flags.top   ?? '30', 10);
const dumpN      = parseInt(flags.dump  ?? '0', 10);
const callersN   = parseInt(flags.callers ?? '0', 10);

// If --callers=N, build the target set after the main profile run is
// complete. We'll need a second pass over recorded events; for now just
// stash pre-step regs each step and check post-step against a target set.
const trueCallSites = new Map(); // calleeKey -> Map(callerKey -> count)

// 8086 opcode classification.
// CALL: E8 (near rel16), 9A (far ptr16:16), FF /2 (near r/m16), FF /3 (far m16:16).
// RET:  C2/C3 (near, with/without imm16 pop), CA/CB (far, with/without imm16),
//        CF (IRET — far ret + flags pop).
// We classify BEFORE the step (peek the opcode bytes), then take regs
// AFTER the step (so the post-step CS:IP is the callee entry / caller
// resume). For FF we have to peek the modrm byte too.

const OP_CALL_NEAR_REL = 0xE8;
const OP_CALL_FAR_PTR  = 0x9A;
const OP_GROUP_FF      = 0xFF;
const OP_RET_NEAR_IMM  = 0xC2;
const OP_RET_NEAR      = 0xC3;
const OP_RET_FAR_IMM   = 0xCA;
const OP_RET_FAR       = 0xCB;
const OP_IRET          = 0xCF;

const sc = loadCabinetSidecars(cssPath);
const ref = createRefMachine(sc, {
  initialCS: sc.meta.bios.entrySegment,
  initialIP: sc.meta.bios.entryOffset,
});
const mem = ref.mem;

// Helpers: read the byte at the current CS:IP without advancing.
// Linear address respects 8086 segment:offset = (CS<<4)+IP.
function peek(cs, ip, off) {
  return mem[((cs << 4) + ((ip + off) & 0xFFFF)) & 0xFFFFF] ?? 0;
}

// --- classification ---
// Returns 'call' | 'ret' | null.
function classify(cs, ip) {
  const op = peek(cs, ip, 0);
  if (op === OP_CALL_NEAR_REL || op === OP_CALL_FAR_PTR) return 'call';
  if (op === OP_GROUP_FF) {
    const modrm = peek(cs, ip, 1);
    const reg = (modrm >> 3) & 0x07;
    if (reg === 2 || reg === 3) return 'call'; // /2 near, /3 far
    return null;
  }
  if (op === OP_RET_NEAR || op === OP_RET_NEAR_IMM
      || op === OP_RET_FAR  || op === OP_RET_FAR_IMM
      || op === OP_IRET) return 'ret';
  return null;
}

// --- accumulator tables ---
// Per call-site (keyed by callee CS:IP — the function entry point), track:
//   calls         : number of times entered
//   selfInstr     : sum of (instr executed inside this frame minus child inclusive)
//   inclusiveInstr: sum of (instr from CALL to matching RET)
// Plus a stack of currently-open frames so we can close them out on RET.
const stats = new Map();
const stack = []; // each: { calleeKey, instrAtEntry, childInclusive, callerKey }
let bottomFrameKey = '<root>'; // for instructions before the first CALL

function key(cs, ip) {
  return `${cs.toString(16).toUpperCase().padStart(4, '0')}:${ip.toString(16).toUpperCase().padStart(4, '0')}`;
}
function bumpStats(k, fields) {
  let s = stats.get(k);
  if (!s) {
    s = { calls: 0, selfInstr: 0, inclusiveInstr: 0, callers: new Map() };
    stats.set(k, s);
  }
  for (const f in fields) {
    if (f === 'callers') {
      for (const [ck, cv] of fields.callers) {
        s.callers.set(ck, (s.callers.get(ck) ?? 0) + cv);
      }
    } else {
      s[f] += fields[f];
    }
  }
}

// --- run ---
process.stderr.write(`profiling ${cssPath} for ${totalInstr.toLocaleString()} instr (skipping first ${fromInstr.toLocaleString()})...\n`);
const t0 = performance.now();

let instrCount = 0;
let recording = false;
let recordingStartedAt = 0;

// trueCalleeTargets is populated after the main pass; on the first pass we
// stash pre-step regs only when needed. To avoid two passes, we record
// pre-step regs on every step (cheap — Map lookups dominate the work
// anyway) and only consult them at RET-aggregation time.
let preCS = 0, preIP = 0;

while (instrCount < totalInstr) {
  const r = ref.regs();
  preCS = r.CS;
  preIP = r.IP;
  const cls = classify(r.CS, r.IP);

  if (!recording && instrCount >= fromInstr) {
    recording = true;
    recordingStartedAt = instrCount;
    bottomFrameKey = key(r.CS, r.IP);
    process.stderr.write(`recording from instr=${instrCount.toLocaleString()} CS:IP=${bottomFrameKey}\n`);
  }

  // Take a step. After it returns, post-step regs tell us who we called
  // (for CALL) or who we returned to (for RET).
  ref.step();
  instrCount++;

  if (!recording) continue;

  if (cls === 'call') {
    const post = ref.regs();
    const calleeKey = key(post.CS, post.IP);
    const callerKey = stack.length ? stack[stack.length - 1].calleeKey : bottomFrameKey;
    // True byte-level call site (the address of the CALL instruction).
    const callSiteKey = key(preCS, preIP);
    let m = trueCallSites.get(calleeKey);
    if (!m) { m = new Map(); trueCallSites.set(calleeKey, m); }
    m.set(callSiteKey, (m.get(callSiteKey) ?? 0) + 1);
    stack.push({
      calleeKey,
      instrAtEntry: instrCount,
      childInclusive: 0,
      callerKey,
    });
  } else if (cls === 'ret') {
    if (stack.length === 0) {
      // Returning from a frame we never saw CALLed (BIOS, IRQ handler entered
      // before recording started, or a stack-fiddling trampoline). Ignore.
      continue;
    }
    const f = stack.pop();
    const inclusive = instrCount - f.instrAtEntry;
    const self = inclusive - f.childInclusive;
    const fields = {
      calls: 1,
      selfInstr: self,
      inclusiveInstr: inclusive,
      callers: new Map([[f.callerKey, inclusive]]),
    };
    bumpStats(f.calleeKey, fields);
    // Propagate inclusive up to parent's child-time so its self gets reduced.
    if (stack.length > 0) stack[stack.length - 1].childInclusive += inclusive;
    // else: drop on the floor — bottomFrameKey is just a tag, we don't
    // accumulate self time for it (it's the recording-start frame which by
    // definition we entered without seeing a CALL).
  }

  // Periodic progress.
  if ((instrCount & 0xFFFFF) === 0) {
    const ms = performance.now() - t0;
    const mhz = (instrCount / ms / 1000).toFixed(2);
    const r2 = ref.regs();
    const mode = mem[0x449];
    process.stderr.write(`  ${(instrCount/1e6).toFixed(0).padStart(3)}M instr  ${mhz} M/s  CS:IP=${key(r2.CS,r2.IP)}  mode=0x${mode.toString(16)}  stack=${stack.length}\r`);
  }
}

const stepMs = performance.now() - t0;
const recordedInstr = instrCount - recordingStartedAt;
process.stderr.write('\n');
process.stderr.write(`done: ${instrCount.toLocaleString()} instr in ${(stepMs/1000).toFixed(1)}s (${(instrCount/stepMs/1000).toFixed(2)} M/s); recorded ${recordedInstr.toLocaleString()} instr\n`);
process.stderr.write(`open frames at end: ${stack.length} (these never returned within the run)\n`);

// Close out any still-open frames against the recorded budget so their
// inclusive time is at least visible (self may be huge but accurate). Caller
// chain is preserved.
while (stack.length > 0) {
  const f = stack.pop();
  const inclusive = instrCount - f.instrAtEntry;
  const self = inclusive - f.childInclusive;
  bumpStats(f.calleeKey, {
    calls: 1,
    selfInstr: self,
    inclusiveInstr: inclusive,
    callers: new Map([[f.callerKey, inclusive]]),
  });
  if (stack.length > 0) stack[stack.length - 1].childInclusive += inclusive;
}

// --- report ---
const rows = [...stats.entries()].map(([k, s]) => ({
  key: k,
  calls: s.calls,
  self: s.selfInstr,
  inc: s.inclusiveInstr,
  callers: s.callers,
}));

const fmt = (n) => n.toLocaleString().padStart(13);
const fmtPct = (n) => (n * 100).toFixed(1).padStart(5) + '%';

console.log('');
console.log(`=== Top ${topN} call sites by SELF time (instructions executed in callee, excluding callees-of-callee) ===`);
console.log(`  ${'CS:IP'.padEnd(12)} ${'calls'.padStart(8)} ${'self'.padStart(13)} ${'self%'.padStart(6)} ${'inclusive'.padStart(13)} top callers`);
const bySelf = [...rows].sort((a, b) => b.self - a.self).slice(0, topN);
for (const r of bySelf) {
  const callers = [...r.callers.entries()].sort((a,b) => b[1]-a[1]).slice(0, 3)
    .map(([ck, cv]) => `${ck}(${(cv/r.inc*100).toFixed(0)}%)`).join(' ');
  console.log(`  ${r.key.padEnd(12)} ${String(r.calls).padStart(8)} ${fmt(r.self)} ${fmtPct(r.self/recordedInstr)} ${fmt(r.inc)} ${callers}`);
}

console.log('');
console.log(`=== Top ${topN} call sites by INCLUSIVE time (callee + everything it called) ===`);
console.log(`  ${'CS:IP'.padEnd(12)} ${'calls'.padStart(8)} ${'inclusive'.padStart(13)} ${'inc%'.padStart(6)} ${'self'.padStart(13)} top callers`);
const byInc = [...rows].sort((a, b) => b.inc - a.inc).slice(0, topN);
for (const r of byInc) {
  const callers = [...r.callers.entries()].sort((a,b) => b[1]-a[1]).slice(0, 3)
    .map(([ck, cv]) => `${ck}(${(cv/r.inc*100).toFixed(0)}%)`).join(' ');
  console.log(`  ${r.key.padEnd(12)} ${String(r.calls).padStart(8)} ${fmt(r.inc)} ${fmtPct(r.inc/recordedInstr)} ${fmt(r.self)} ${callers}`);
}

// --- true call-site report (--callers=N) ---
// The "top callers" column in the existing reports is by *frame* — the
// enclosing calleeKey at the moment of CALL — which is misleading because
// it points at the outer function entry rather than the byte address of
// the actual CALL instruction. This report shows the latter, generated
// from the pre-step CS:IP we record on each step.
if (callersN > 0) {
  console.log('');
  console.log(`=== True byte-level call sites for top ${callersN} sites by INCLUSIVE time ===`);
  const top = [...rows].sort((a, b) => b.inc - a.inc).slice(0, callersN);
  for (const r of top) {
    const m = trueCallSites.get(r.key);
    if (!m) {
      console.log(`  ${r.key}: no recorded call entries (frame opened before recording started?)`);
      continue;
    }
    const sorted = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    console.log(`  ${r.key}  total CALL hits: ${total}`);
    for (const [ck, cn] of sorted) {
      console.log(`    ${ck}  ${cn}  (${(cn/total*100).toFixed(1)}%)`);
    }
  }
}

// --- byte dump of top sites for symbolication ---
// We don't have a .map for the released DOOM.EXE — gcc-ia16 build, no
// debug info shipped. Print 64 raw bytes at each hot CS:IP plus any
// printable ASCII in a +/-128-byte window (libgcc helpers don't have
// strings, but neighbouring gcc-emitted functions often do, which lets
// us bracket which compilation unit the helper sits next to).
if (dumpN > 0) {
  console.log('');
  console.log(`=== Code dump for top ${dumpN} sites by INCLUSIVE time ===`);
  const top = [...rows].sort((a, b) => b.inc - a.inc).slice(0, dumpN);
  for (const r of top) {
    const [csStr, ipStr] = r.key.split(':');
    const cs = parseInt(csStr, 16);
    const ip = parseInt(ipStr, 16);
    const linear = ((cs << 4) + ip) & 0xFFFFF;
    const head = [];
    for (let i = 0; i < 64; i++) head.push((mem[(linear + i) & 0xFFFFF] ?? 0).toString(16).padStart(2, '0'));
    console.log('');
    console.log(`  ${r.key}  linear=0x${linear.toString(16).padStart(5, '0')}  calls=${r.calls}  self=${r.self}  inc=${r.inc}`);
    console.log(`  bytes: ${head.join(' ')}`);
    // ASCII window
    const start = Math.max(0, linear - 128);
    const end = Math.min(0xFFFFF, linear + 192);
    let run = '';
    let runStart = -1;
    const found = [];
    for (let i = start; i <= end; i++) {
      const b = mem[i] ?? 0;
      if (b >= 0x20 && b < 0x7F) {
        if (runStart < 0) runStart = i;
        run += String.fromCharCode(b);
      } else {
        if (run.length >= 4) found.push(`@${(runStart - linear).toString(10)}: ${JSON.stringify(run)}`);
        run = '';
        runStart = -1;
      }
    }
    if (run.length >= 4) found.push(`@${(runStart - linear).toString(10)}: ${JSON.stringify(run)}`);
    if (found.length) {
      console.log(`  nearby strings:`);
      for (const f of found.slice(0, 8)) console.log(`    ${f}`);
    }
  }
}

if (flags.json) {
  const out = {
    cabinet: cssPath,
    totalInstr,
    recordedInstr,
    elapsedMs: stepMs,
    sites: rows.map(r => ({
      key: r.key,
      calls: r.calls,
      self: r.self,
      inc: r.inc,
      callers: [...r.callers.entries()],
    })),
  };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(flags.json, JSON.stringify(out, null, 2));
  process.stderr.write(`wrote ${flags.json}\n`);
}
