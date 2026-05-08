// tests/bench/profiles/doom-ingame-fps.mjs — Doom8088 in-game FPS measurement.
//
// Steady-state FPS is the number the user actually feels. The
// doom-loading profile measures wall-time-to-in-game (a one-shot
// number); this profile measures *steady-state in-game framerate*
// once the level is loaded.
//
// Method:
//   1. Boot Doom to the in-game state (gamestate=0 = GS_LEVEL).
//      Use the same stage-detection watches as doom-loading; halt
//      when ingame is reached.
//   2. Hold Left Arrow continuously so the world animates — each
//      frame is a real new frame, not a static title screen the
//      hash-dedup-style optimisations would skip.
//   3. Sample the framebuffer once per second, hash the ENTIRE
//      rgba (not the sparse sub-sample the runtime sampler used
//      to do — that was unsound), compare to last hash. Each
//      change is one user-visible new frame.
//   4. Run for MEASURE_SECONDS and report fps = frames-changed
//      / measure_seconds, plus a time series.
//
// Web target only; CLI has no /_stream/fb consumer so "FPS" is
// undefined for it.

const ADDR_GAMESTATE  = 0x3a3c4;
const ADDR_MENUACTIVE = 0x3ac62;
const ADDR_USERGAME   = 0x3a5af;
const ADDR_BDA_MODE   = 0x449;
const ADDR_TEXT_VRAM  = 0xb8000;
const TEXT_VRAM_BYTES = 4000;

const FB_BASE  = 0xa0000;
const FB_BYTES = 320 * 200;

// How long to measure FPS for once we reach in-game. Longer = more
// stable number; shorter = bench finishes faster.
const MEASURE_SECONDS = 20;

// Watch specs for the boot-to-ingame phase. Same shape as
// doom-loading, except we hold Left in addition to Enter so the
// game starts moving as soon as it can. The ingame watch halts.
const ENTER = 0x1c0d;
const LEFT  = 0x4b00;
const TAP_HOLD = 50_000;

const WATCH_SPECS = [
  'poll:stride:every=50000',
  `text_drdos:cond:${ADDR_BDA_MODE}=0x03,pattern@${ADDR_TEXT_VRAM}:2:${TEXT_VRAM_BYTES}=DR-DOS:gate=poll:then=emit`,
  `text_doom:cond:${ADDR_BDA_MODE}=0x03,pattern@${ADDR_TEXT_VRAM}:2:${TEXT_VRAM_BYTES}=DOOM8088:gate=poll:then=emit`,
  `title:cond:${ADDR_MENUACTIVE}=0,${ADDR_GAMESTATE}=3,${ADDR_BDA_MODE}=0x13:gate=poll:then=emit`,
  `title_tap:cond:${ADDR_MENUACTIVE}=0,${ADDR_GAMESTATE}=3,${ADDR_BDA_MODE}=0x13,repeat:gate=poll:then=setvar_pulse=keyboard,${ENTER},${TAP_HOLD}`,
  `menu:cond:${ADDR_MENUACTIVE}=1:gate=poll:then=emit`,
  `menu_tap:cond:${ADDR_MENUACTIVE}=1,repeat:gate=poll:then=setvar_pulse=keyboard,${ENTER},${TAP_HOLD}`,
  `loading:cond:${ADDR_USERGAME}=1,${ADDR_GAMESTATE}=3:gate=poll:then=emit`,
  // ingame: usergame=1 AND gamestate=0. We DO NOT halt here — the
  // FPS measurement runs while the game is in-game. The profile JS
  // detects the ingame stage event and switches to FPS-sampling.
  `ingame:cond:${ADDR_USERGAME}=1,${ADDR_GAMESTATE}=0:gate=poll:then=emit`,
  // Once in-game, hold Left continuously so the world animates.
  // setvar_pulse with a long hold + repeat keeps re-arming the pulse.
  `walk_left:cond:${ADDR_GAMESTATE}=0,repeat:gate=poll:then=setvar_pulse=keyboard,${LEFT},${TAP_HOLD}`,
];

export const manifest = {
  target: 'web',
  cabinet: 'cabinet:doom8088',
  requires: ['cabinet:doom8088', 'wasm:calcite', 'prebake:corduroy'],
  // Boot can take ~2 min on slow machines, plus MEASURE_SECONDS for
  // the actual measurement. Keep the cap generous.
  wallCapMs: 600_000 + MEASURE_SECONDS * 1000,
  reportShape: {
    runMsToInGame:    'number',
    ticksToInGame:    'number',
    measureSeconds:   'number',
    framesChanged:    'number',
    ingameFps:        'number',
    fpsSamples:       'object',
    stages:           'object',
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

// FNV-1a over the full byte array. Hot-loop one allocation, no
// sub-sampling — we want to detect any pixel change.
function hashFull(bytes) {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
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
  host.log('watches registered; booting to in-game');

  const stages = {};
  let ingameTick = null;
  const t0 = performance.now();

  // Phase 1: boot loop. Drain stage events; stop when ingame fires.
  while (true) {
    if (performance.now() - t0 > 600_000) {
      throw new Error('boot phase wall-clock cap exceeded (10 min)');
    }
    await new Promise(r => setTimeout(r, 500));
    const r = await bridgeRequest(bridge, { type: 'drain-measurements' });
    const events = JSON.parse(r.events);
    for (const ev of events) {
      if (!stages[ev.watch]) {
        stages[ev.watch] = { tick: ev.tick, wallMs: performance.now() - t0 };
        host.log(`stage ${ev.watch} tick=${ev.tick} wallMs=${stages[ev.watch].wallMs.toFixed(0)}`);
      }
      if (ev.watch === 'ingame' && ingameTick == null) {
        ingameTick = ev.tick;
      }
    }
    if (stages.ingame) break;
  }

  // Phase 2: FPS measurement. Walk_left is now firing every poll
  // (gate=poll:repeat) so the player is turning left continuously.
  // Sample the FB once per second, hash, compare.
  host.log(`in-game; measuring FPS for ${MEASURE_SECONDS}s while holding Left`);
  const peekFb = async () => {
    const ch = new MessageChannel();
    return new Promise((resolve) => {
      ch.port1.onmessage = (m) => resolve(m.data?.bytes || []);
      setTimeout(() => resolve([]), 5000);
      bridge.postMessage({ type: 'peek-mem', addr: FB_BASE, len: FB_BYTES }, [ch.port2]);
    });
  };

  // Reference fb sample, then sample every ~16ms to catch every
  // distinct frame rather than skipping with 1Hz aliasing.
  let lastBytes = await peekFb();
  let lastHash = hashFull(lastBytes);
  let framesChanged = 0;
  const fpsSamples = []; // [{wallMs, framesChangedSinceStart}]
  const measureT0 = performance.now();
  let nextLogAt = measureT0 + 1000;

  while (performance.now() - measureT0 < MEASURE_SECONDS * 1000) {
    await new Promise(r => setTimeout(r, 16));
    const bytes = await peekFb();
    if (bytes.length === 0) continue;
    const h = hashFull(bytes);
    if (h !== lastHash) {
      framesChanged++;
      lastHash = h;
    }
    const now = performance.now();
    if (now >= nextLogAt) {
      const elapsedSec = (now - measureT0) / 1000;
      fpsSamples.push({
        wallMs: Math.round(now - measureT0),
        framesChangedSinceStart: framesChanged,
        instantaneousFps: fpsSamples.length === 0
          ? framesChanged
          : framesChanged - fpsSamples[fpsSamples.length - 1].framesChangedSinceStart,
      });
      host.log(`fps@${elapsedSec.toFixed(1)}s: ${fpsSamples[fpsSamples.length-1].instantaneousFps} (cumul=${framesChanged})`);
      nextLogAt = now + 1000;
    }
  }

  const measureMs = performance.now() - measureT0;
  const ingameFps = framesChanged / (measureMs / 1000);

  bridge.postMessage({ type: 'bench-stop' });
  host.log(`done: ${framesChanged} frames in ${(measureMs/1000).toFixed(1)}s = ${ingameFps.toFixed(2)} fps`);

  return {
    profileName: 'doom-ingame-fps',
    runMsToInGame:  stages.ingame?.wallMs ?? null,
    ticksToInGame:  ingameTick,
    measureSeconds: measureMs / 1000,
    framesChanged,
    ingameFps,
    fpsSamples,
    stages,
  };
}
