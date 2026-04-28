#!/usr/bin/env node
// bench-doom-stages-cli.mjs — native (calcite-cli) honest analog of
// bench-doom-stages.mjs.
//
// The web bench measures stage transitions via memory-peek polling at
// wall-time intervals, presses Enter when conditions match, and reports
// per-stage wall/tick/cycle deltas. This script does the exact same thing
// against `calcite-cli`, using the new `--poll-stride` / `--cond` flags.
//
// Why this exists: the prior "native runs in ~13s" figure was a `--ticks=N`
// throughput run — predeclared budget, no stage detection, no input. Not
// comparable to the web bench's "wait for menu, press Enter, wait for
// _g_usergame, wait for GS_LEVEL" wall measurement. This script closes
// that gap so web vs native can be diffed honestly.
//
// Output JSON shape mirrors bench-doom-stages.mjs so the two outputs can
// be diffed directly.
//
// Usage:
//   node tests/harness/bench-doom-stages-cli.mjs
//   node tests/harness/bench-doom-stages-cli.mjs --cabinet=doom8088.css
//   node tests/harness/bench-doom-stages-cli.mjs --json=tmp/cli-bench.json
//   node tests/harness/bench-doom-stages-cli.mjs --max-ticks=80000000
//   node tests/harness/bench-doom-stages-cli.mjs --poll-stride=50000

import { spawn } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
// CSS-DOS repo root (this file is in tests/harness/).
const CSSDOS_ROOT = resolve(__dirname, '..', '..');
// Calcite repo root. Defaults to sibling-of-CSS-DOS; override with
// CALCITE_REPO env var (useful for git worktrees whose calcite isn't at
// the default sibling location). CALCITE_CLI_BIN, when set, takes
// precedence over both.
const CALCITE_ROOT = process.env.CALCITE_REPO
  ? resolve(process.env.CALCITE_REPO)
  : resolve(CSSDOS_ROOT, '..', 'calcite');

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    if (!a.startsWith('--')) return [];
    const [k, v] = a.slice(2).split('=');
    return [[k, v ?? true]];
  }),
);

const CABINET    = resolve(CSSDOS_ROOT, args.cabinet ?? 'doom8088.css');
const JSON_OUT   = args.json ?? null;
// Stride is in ticks. 50K ticks ≈ 10.5 ms of guest time at 4.77 MHz, which
// is comparable to the web bench's 250 ms wall poll once you account for
// native being ~25× faster than the bridge — both end up checking
// stages roughly 2 K times across the run.
const POLL_STRIDE = parseInt(args['poll-stride'] ?? '50000', 10);
// Upper bound on ticks. Web baseline reaches stage_ingame at ~34M ticks;
// 80M leaves headroom in case calcite-cli takes a different (e.g. slower
// menu, more retries) path. u32 max is 4.29B so we won't overflow.
const MAX_TICKS  = parseInt(args['max-ticks'] ?? '80000000', 10);
// Spam interval (in ticks). 250K ticks ≈ 52 ms of guest time. The web
// bench spams every 500 ms wall — equivalent fairness here picks an
// interval where calcite-cli will produce a few menu redraws between
// presses but doesn't burn cycles on rapid-fire taps.
const SPAM_EVERY = parseInt(args['spam-every'] ?? '250000', 10);

if (!existsSync(CABINET)) {
  console.error(`cabinet not found: ${CABINET}`);
  process.exit(2);
}

// Resolve calcite-cli binary. CALCITE_CLI_BIN wins; otherwise default to
// the release build under CALCITE_ROOT (.exe on Windows, bare otherwise).
let CLI;
if (process.env.CALCITE_CLI_BIN) {
  CLI = resolve(process.env.CALCITE_CLI_BIN);
  if (!existsSync(CLI)) {
    console.error(`CALCITE_CLI_BIN points at a missing file: ${CLI}`);
    process.exit(2);
  }
} else {
  CLI = resolve(CALCITE_ROOT, 'target', 'release', 'calcite-cli.exe');
  if (!existsSync(CLI)) {
    CLI = resolve(CALCITE_ROOT, 'target', 'release', 'calcite-cli');
    if (!existsSync(CLI)) {
      console.error(`calcite-cli not found. Build with:\n  cd ${CALCITE_ROOT} && cargo build --release -p calcite-cli`);
      process.exit(2);
    }
  }
}

// Doom8088 sentinel addresses (see docs/agent-briefs/doom-perf-mission.md
// for derivation). These match what bench-doom-stages.mjs uses.
const ADDR = {
  GAMESTATE:   0x3a3c4,    // enum: 0=LEVEL 3=DEMOSCREEN
  MENUACTIVE:  0x3ac62,    // bool
  USERGAME:    0x3a5af,    // latches when G_InitNew runs
  BDA_MODE:    0x449,      // 0x03 text, 0x13 mode-13h
};
const GS_LEVEL = 0;
const GS_DEMOSCREEN = 3;
// Enter scancode|ascii = (0x1C << 8) | 0x0D = 0x1C0D.
const KEY_ENTER = 0x1C0D;

// Stage flags, in the order they should fire. Each --cond is one stage.
//
// Notes:
// - text_drdos / text_doom check VRAM strings (mode=0x03 + ASCII match).
// - title gates on mode=0x13 + menuactive=0 + gamestate=GS_DEMOSCREEN.
//   then=tap fires Enter exactly once to dismiss the title splash.
// - menu fires when menuactive flips to 1; then=spam starts Enter spam.
// - loading fires when usergame=1 (G_InitNew has run); then=spam-stop
//   stops the menu spam — by this point we don't want stray Enters
//   interfering with G_DoLoadLevel.
// - ingame fires when gamestate flips to GS_LEVEL; then=halt ends the run.
const STAGES = [
  `text_drdos:0x${ADDR.BDA_MODE.toString(16)}=0x03,vram_text:DR-DOS`,
  `text_doom:0x${ADDR.BDA_MODE.toString(16)}=0x03,vram_text:DOOM8088`,
  // title: start Enter spam to dismiss the title. Single tap doesn't work
  // because DOOM's title-fade animation must finish before it accepts
  // input (web bench notes a 1.5s wait). Spam covers the whole window —
  // the spam will keep firing into the menu and select NEW GAME / skill
  // / start, all the way until stage_loading turns it off.
  `title:0x${ADDR.BDA_MODE.toString(16)}=0x13,0x${ADDR.MENUACTIVE.toString(16)}=0,0x${ADDR.GAMESTATE.toString(16)}=${GS_DEMOSCREEN}:then=spam:0x${KEY_ENTER.toString(16)}:every=${SPAM_EVERY}`,
  // menu fires when the spam from `title` reaches the main menu. No new
  // action — the spam continues. Stamp-only stage for measurement.
  `menu:0x${ADDR.MENUACTIVE.toString(16)}=1`,
  `loading:0x${ADDR.USERGAME.toString(16)}=1,0x${ADDR.GAMESTATE.toString(16)}=${GS_DEMOSCREEN}:then=spam-stop`,
  // ingame: gs=GS_LEVEL AND usergame=1. The usergame=1 guard rules out
  // the boot-time false positive — at reset, BSS is zero, gs=0=GS_LEVEL,
  // but usergame=0 because G_InitNew hasn't run. Web bench dodges this
  // via stage-ordering (stage_menu must have reached); native polling
  // doesn't have that machinery, so we encode the guard in the test.
  `ingame:0x${ADDR.GAMESTATE.toString(16)}=${GS_LEVEL},0x${ADDR.USERGAME.toString(16)}=1:then=halt`,
];

const cliArgs = [
  '-i', CABINET,
  '-n', String(MAX_TICKS),
  '--speed', '0',                  // unthrottled
  '--screen-interval', '0',        // no per-tick TTY render
  '--poll-stride', String(POLL_STRIDE),
  ...STAGES.flatMap((s) => ['--cond', s]),
];

process.stderr.write(
  `running ${CLI}\n  ` +
  `cabinet ${CABINET}\n  ` +
  `poll-stride=${POLL_STRIDE} max-ticks=${MAX_TICKS} spam-every=${SPAM_EVERY}\n`
);

const wallStart = performance.now();
const child = spawn(CLI, cliArgs, { stdio: ['ignore', 'pipe', 'inherit'] });

// Parse stdout for `stage=NAME t_ms=W tick=T cycles=C` lines.
const stages = {};
let stdoutBuf = '';
child.stdout.on('data', (chunk) => {
  stdoutBuf += chunk.toString();
  let nl;
  while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
    const line = stdoutBuf.slice(0, nl).trimEnd();
    stdoutBuf = stdoutBuf.slice(nl + 1);
    // calcite-cli prints ANSI clear/cursor escapes before some output,
    // so stage= may not be at column 0. Match anywhere in the line.
    const m = line.match(/stage=(\w+) t_ms=(\d+) tick=(\d+) cycles=(\d+)/);
    if (m) {
      const name = m[1];
      stages[name] = {
        wallMs: parseInt(m[2], 10),
        ticks:  parseInt(m[3], 10),
        cycles: parseInt(m[4], 10),
      };
      process.stderr.write(`[stages] ${name} t_ms=${m[2]} tick=${m[3]} cycles=${m[4]}\n`);
    } else if (line.length > 0) {
      // Non-stage stdout — surface it (probably the final summary).
      process.stderr.write(`[cli-stdout] ${line}\n`);
    }
  }
});

const exitCode = await new Promise((resolveP) => {
  child.on('exit', (code) => resolveP(code));
});

const totalWallMs = performance.now() - wallStart;

// Build the same JSON shape bench-doom-stages.mjs emits.
const ORDER = ['text_drdos', 'text_doom', 'title', 'menu', 'loading', 'ingame'];
const deltas = {};
let prev = { wallMs: 0, ticks: 0, cycles: 0 };
for (const name of ORDER) {
  const s = stages[name];
  if (!s) continue;
  const key = `stage_${name}`;
  deltas[key] = {
    wallMsAbs:    s.wallMs,
    wallMsDelta:  s.wallMs - prev.wallMs,
    ticks:        s.ticks,
    ticksDelta:   s.ticks - prev.ticks,
    cycles:       s.cycles,
    cyclesDelta:  s.cycles - prev.cycles,
  };
  prev = s;
}

const ingame = stages.ingame;
const summary = {
  cabinet: CABINET,
  cli: CLI,
  exitCode,
  pollStride: POLL_STRIDE,
  maxTicks: MAX_TICKS,
  spamEvery: SPAM_EVERY,
  totalWallMs: +totalWallMs.toFixed(0),
  // The CLI reports t_ms from immediately after parse+compile, so its
  // wallMs is comparable to the web bench's runMsToInGame (post-compile).
  // There is no equivalent of pageMsToInGame here — page-load doesn't
  // exist on the CLI.
  stages: deltas,
  headline: {
    runMsToInGame:  ingame ? ingame.wallMs : null,
    ticksToInGame:  ingame ? ingame.ticks  : null,
    cyclesToInGame: ingame ? ingame.cycles : null,
  },
  reachedIngame: !!ingame,
};

const out = JSON.stringify(summary, null, 2) + '\n';
process.stdout.write(out);
if (JSON_OUT) writeFileSync(JSON_OUT, out);
process.exit(exitCode === 0 ? 0 : 1);
