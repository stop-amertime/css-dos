// tests/bench/profiles/windows-all.mjs - Windows 1.01 boot + app-launch bench.
//
// The Windows analogue of `doom-all`: one boot, every phase timed.
// carts/0windows101 boots MS-DOS 4.00 (Corduroy INT 19h), AUTOEXEC runs
// VER then STARTWIN (SETVER3 TSR + WIN), Windows sets CGA mode 6 and
// draws the MS-DOS Executive. The profile then injects keys to open
// README.DOC - WIN.INI maps `doc=write.exe`, so this loads WRITE.EXE
// (188 KB, the heaviest app on the floppy, plus font loading). The
// wall from Enter to Write-drawn is `writeLoadMs` - the doomLoad
// analogue and the headline number for "opening programs is slow".
//
// Stages (watch names → phases):
//   dos_banner   - VER banner in text VRAM  (MS-DOS 4.00 booted)
//   win_gfx      - BDA mode byte = 0x06     (WIN.COM up, logo drawing)
//   executive    - Executive screen bytes   (desktop ready for input)
//   key_r/key_enter - injected taps         (select README.DOC, launch)
//   write_loaded - Write screen bytes       (README.DOC on screen; halt)
//
// Key injection is tick-scheduled (`at` watches): boot ticks are
// deterministic, same rationale as the harness `windows` preset's
// --press-events schedule. If a kiln/builder change shifts boot ticks,
// the `executive` stage will fire later than KEY_R_TICK and the bench
// fails loudly (write_loaded never fires) - re-derive the tick
// constants with fast-shoot, same as re-deriving sentinel addresses.

const ADDR_BDA_MODE  = 0x449;
const ADDR_TEXT_VRAM = 0xb8000;
const TEXT_VRAM_BYTES = 4000;

// Derived 2026-07-13 against the fresh 0windows101 cabinet (318 MB):
// the executive watch fires at 4.8M (screen verified fully drawn at
// 4.9M); R type-selects README.DOC (verified by screenshot); Enter
// launches Write, which has fully drawn README.DOC (caption, text,
// scrollbar, "Page 1" status bar) ~3.0M ticks later. Key ticks sit
// 400K ticks (~2.7 guest-seconds) after the executive stage for
// input-readiness margin. Byte tests picked by diffing CGA VRAM
// dumps of the logo / Executive / Write screens - each test byte
// differs from every other screen, spread across the display so
// partial redraws can't satisfy all of them, away from the mouse
// pointer (320,100) and Write's blinking caret (top-left of the
// document area).
const KEY_R_TICK     = 5_200_000;
const KEY_ENTER_TICK = 5_360_000;
const TAP_HOLD       = 5_000;
const EXECUTIVE_TESTS =
  '0x449=0x06,0xb8070=0x63,0xb80c8=0x36,0xb8fa1=0x87,0xb9c98=0xaa';
const WRITE_LOADED_TESTS =
  '0x449=0x06,0xb806f=0x63,0xb80c8=0x3e,0xb8fa4=0xf9,0xb8fee=0x3b,0xb9cc0=0xa0';

const WATCH_SPECS = [
  'poll:stride:every=50000',
  `dos_banner:cond:${ADDR_BDA_MODE}=0x03,pattern@${ADDR_TEXT_VRAM}:2:${TEXT_VRAM_BYTES}=MS-DOS Version 4.00:gate=poll:then=emit`,
  `win_gfx:cond:${ADDR_BDA_MODE}=0x06:gate=poll:then=emit`,
  `executive:cond:${EXECUTIVE_TESTS}:gate=poll:then=emit`,
  `key_r:at:tick=${KEY_R_TICK}:then=pseudo_pulse=active,kb-r,${TAP_HOLD}+emit`,
  `key_enter:at:tick=${KEY_ENTER_TICK}:then=pseudo_pulse=active,kb-enter,${TAP_HOLD}+emit`,
  `write_loaded:cond:${WRITE_LOADED_TESTS}:gate=poll:then=emit+halt`,
];

export const manifest = {
  target: 'web',
  cabinet: 'cabinet:0windows101',
  requires: ['cabinet:0windows101', 'wasm:calcite', 'prebake:corduroy'],
  wallCapMs: 600_000,
  cliWatches: WATCH_SPECS,
  cliMaxTicks: 40_000_000,
  reportShape: {
    runMsToExecutive: 'number',
    ticksToExecutive: 'number',
    writeLoadMs:      'number',
    writeLoadTicks:   'number',
    compileMs:        'number',
    stages:           'object',
    phases:           'object',
  },
};

function bridgeRequest(bridge, msg, transfer = []) {
  return new Promise((resolve, reject) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = (m) => {
      ch.port1.close();
      const r = m.data;
      if (r && r.ok) resolve(r);
      else reject(new Error(r?.err ?? 'bridge request failed'));
    };
    bridge.postMessage(msg, [ch.port2, ...transfer]);
  });
}

export async function run(host) {
  if (!window.__bridgeWorker) throw new Error('no __bridgeWorker');
  const bridge = window.__bridgeWorker;

  host.log(`registering ${WATCH_SPECS.length} watches`);
  for (const spec of WATCH_SPECS) {
    await bridgeRequest(bridge, { type: 'register-watch', spec });
  }
  bridge.postMessage({ type: 'set-watch-chunk-ticks', chunkTicks: 50_000 });
  bridge.postMessage({ type: 'bench-run' });
  host.log('watches registered; booting to Write');

  const stages = {};
  const t0 = performance.now();
  while (true) {
    if (performance.now() - t0 > manifest.wallCapMs) {
      throw new Error('wall-clock cap exceeded');
    }
    await new Promise(r => setTimeout(r, 500));
    const r = await bridgeRequest(bridge, { type: 'drain-measurements' });
    const events = JSON.parse(r.events);
    for (const ev of events) {
      if (!stages[ev.watch]) {
        stages[ev.watch] = { tick: ev.tick, wallMs: performance.now() - t0 };
        host.log(`stage ${ev.watch} tick=${ev.tick} wallMs=${stages[ev.watch].wallMs.toFixed(0)}`);
      }
    }
    if (stages.write_loaded) break;
  }
  host.log('write_loaded reached');

  // Phase walls - what the user actually waits through:
  //   dosBoot    = BIOS + MS-DOS 4.00 to the VER banner
  //   winBoot    = STARTWIN → WIN.COM → mode 6 (logo appears)
  //   executive  = logo → Executive ready
  //   navDelay   = executive stage → Enter tap (bench-scheduled, idle)
  //   writeLoad  = Enter → README.DOC drawn by Write   ← headline
  const phases = {
    dosBoot:   stages.dos_banner?.wallMs ?? null,
    winBoot:   (stages.win_gfx?.wallMs    ?? 0) - (stages.dos_banner?.wallMs ?? 0),
    executive: (stages.executive?.wallMs  ?? 0) - (stages.win_gfx?.wallMs    ?? 0),
    navDelay:  (stages.key_enter?.wallMs  ?? 0) - (stages.executive?.wallMs  ?? 0),
    writeLoad: (stages.write_loaded?.wallMs ?? 0) - (stages.key_enter?.wallMs ?? 0),
  };

  return {
    profileName: 'windows-all',
    runMsToExecutive: stages.executive?.wallMs ?? null,
    ticksToExecutive: stages.executive?.tick ?? null,
    writeLoadMs:    phases.writeLoad,
    writeLoadTicks: (stages.write_loaded?.tick ?? 0) - (stages.key_enter?.tick ?? 0),
    stages,
    phases,
  };
}
