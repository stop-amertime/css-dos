// tests/bench/profiles/doom-all.mjs — combined Doom8088 bench.
//
// Runs both `doom-loading` and `doom-ingame-fps` against a single
// boot, since the in-game-FPS profile already pays the full boot
// cost. One run, three sets of numbers:
//   - compileMs        (from cssdos-bridge-stats compile-done broadcast)
//   - runMsToInGame    (boot wall, doom-loading shape)
//   - ticksPerSecAvg   (1 Hz bridge-stats samples → derived; reported
//                       by the page-side runner not us)
//   - ingameFps        (8 s warmup + 20 s measurement)
//
// The single small profiles (`doom-loading`, `doom-ingame-fps`)
// remain valid and are useful when you only want one number quickly.
// `doom-all` is the right choice when you want all of them — runs in
// the same wall time as `doom-ingame-fps` alone.
//
// Web target only; CLI has no /_stream/fb consumer so FPS is
// undefined for it.

const ADDR_GAMESTATE  = 0x3a3c4;
const ADDR_MENUACTIVE = 0x3ac62;
const ADDR_USERGAME   = 0x3a5af;
const ADDR_BDA_MODE   = 0x449;
const ADDR_TEXT_VRAM  = 0xb8000;
const TEXT_VRAM_BYTES = 4000;

const FB_BASE  = 0xa0000;
const FB_BYTES = 320 * 200;

const MEASURE_SECONDS = 20;
const WARMUP_SECONDS  = 8;

// Pseudo-class input model (feat/retire-keyboard): the host flips the
// (active, kb-X) edge and the cabinet's `&:has(#kb-X:active){--keyboard:V}`
// rule produces V via calcite's input-edge recogniser. Same shape as
// doom-loading.mjs on this branch.
const ENTER_SELECTOR = 'kb-enter';
const LEFT_SELECTOR  = 'kb-left';
const TAP_HOLD = 50_000;

// Same watch list as doom-ingame-fps: full boot stages + walk_left
// after gamestate flips. The `ingame` watch emits but does NOT halt.
const WATCH_SPECS = [
  'poll:stride:every=50000',
  `text_drdos:cond:${ADDR_BDA_MODE}=0x03,pattern@${ADDR_TEXT_VRAM}:2:${TEXT_VRAM_BYTES}=DR-DOS:gate=poll:then=emit`,
  `text_doom:cond:${ADDR_BDA_MODE}=0x03,pattern@${ADDR_TEXT_VRAM}:2:${TEXT_VRAM_BYTES}=DOOM8088:gate=poll:then=emit`,
  `title:cond:${ADDR_MENUACTIVE}=0,${ADDR_GAMESTATE}=3,${ADDR_BDA_MODE}=0x13:gate=poll:then=emit`,
  `title_tap:cond:${ADDR_MENUACTIVE}=0,${ADDR_GAMESTATE}=3,${ADDR_BDA_MODE}=0x13,repeat:gate=poll:then=pseudo_pulse=active,${ENTER_SELECTOR},${TAP_HOLD}`,
  `menu:cond:${ADDR_MENUACTIVE}=1:gate=poll:then=emit`,
  `menu_tap:cond:${ADDR_MENUACTIVE}=1,repeat:gate=poll:then=pseudo_pulse=active,${ENTER_SELECTOR},${TAP_HOLD}`,
  `loading:cond:${ADDR_USERGAME}=1,${ADDR_GAMESTATE}=3:gate=poll:then=emit`,
  `ingame:cond:${ADDR_USERGAME}=1,${ADDR_GAMESTATE}=0:gate=poll:then=emit`,
  `walk_left:cond:${ADDR_GAMESTATE}=0,repeat:gate=poll:then=pseudo_pulse=active,${LEFT_SELECTOR},${TAP_HOLD}`,
];

export const manifest = {
  target: 'web',
  cabinet: 'cabinet:doom8088',
  requires: ['cabinet:doom8088', 'wasm:calcite', 'prebake:corduroy'],
  // Boot ~1-2 min + warmup + measurement; keep cap generous.
  wallCapMs: 600_000 + (WARMUP_SECONDS + MEASURE_SECONDS) * 1000,
  reportShape: {
    runMsToInGame:    'number',
    ticksToInGame:    'number',
    warmupSeconds:    'number',
    measureSeconds:   'number',
    framesChanged:    'number',
    ingameFps:        'number',
    fpsSamples:       'object',
    stages:           'object',
    phases:           'object',  // ms per substep (dosBoot, doomTitle, doomMenuDelay, doomLoad, warmup, measure)
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

  // Phase 1: boot. Drain stage events; stop loop body when ingame fires
  // but keep engine running for FPS measurement.
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

  // Phase 2: warmup (no measurement). Menu slide-off, view fade-in,
  // cache warmup.
  host.log(`in-game; warmup ${WARMUP_SECONDS}s while holding Left`);
  await new Promise(r => setTimeout(r, WARMUP_SECONDS * 1000));

  // Phase 3: FPS measurement. Sample FB every ~16ms.
  host.log(`measuring FPS for ${MEASURE_SECONDS}s`);
  const peekFb = async () => {
    const ch = new MessageChannel();
    return new Promise((resolve) => {
      ch.port1.onmessage = (m) => resolve(m.data?.bytes || []);
      setTimeout(() => resolve([]), 5000);
      bridge.postMessage({ type: 'peek-mem', addr: FB_BASE, len: FB_BYTES }, [ch.port2]);
    });
  };

  let lastBytes = await peekFb();
  let lastHash = hashFull(lastBytes);
  let framesChanged = 0;
  const fpsSamples = [];
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

  // Substep deltas — wall ms spent in each phase. The page-side runner
  // adds compileMs separately (it captures the compile-done broadcast
  // before the profile runs). Phases here:
  //
  //   dosBoot      = title.wallMs - 0                  (BIOS+kernel up to mode 13h title splash)
  //   doomTitle    = menu - title                      (title splash → menu visible)
  //   doomMenuDelay= loading - menu                    (Enter dismisses menu, level-load begins)
  //   doomLoad     = ingame - loading                  (level-load until gamestate=GS_LEVEL)
  //   warmup       = WARMUP_SECONDS * 1000             (menu slide-off, view fade-in)
  //   measure      = measureMs                         (steady-state FPS measurement)
  //
  // Each phase's wall reflects what the user actually waits through.
  const phases = {
    dosBoot:       stages.title?.wallMs ?? null,
    doomTitle:     (stages.menu?.wallMs    ?? 0) - (stages.title?.wallMs   ?? 0),
    doomMenuDelay: (stages.loading?.wallMs ?? 0) - (stages.menu?.wallMs    ?? 0),
    doomLoad:      (stages.ingame?.wallMs  ?? 0) - (stages.loading?.wallMs ?? 0),
    warmup:        WARMUP_SECONDS * 1000,
    measure:       Math.round(measureMs),
  };

  return {
    profileName: 'doom-all',
    runMsToInGame:  stages.ingame?.wallMs ?? null,
    ticksToInGame:  ingameTick,
    warmupSeconds:  WARMUP_SECONDS,
    measureSeconds: measureMs / 1000,
    framesChanged,
    ingameFps,
    fpsSamples,
    stages,
    phases,
  };
}
