// tests/bench/profiles/doom-demo.mjs - input-free Doom8088 perf bench.
//
// The story: Doom's title screen, if left alone for ~5 seconds of game
// time, starts a recorded demo. The demo is gameplay - gamestate flips
// to GS_LEVEL (0), mode stays 0x13, the viewport renders frames as if
// the player were walking the level. Crucially: NO KEYBOARD INPUT IS
// REQUIRED to reach this state, which makes it the right vehicle for
// measuring per-tick throughput on the keyboard branch (where we
// suspect apply_input_edges is involved in a ~1.76x regression vs the
// 2026-05-08 master baseline).
//
// Three numbers:
//   - runMsToDemo:  wall from profile-start to first frame of demo
//                   gameplay (gamestate=0, mode=0x13). Compare across
//                   branches to isolate per-tick cost on the boot path.
//   - ticksToDemo:  engine ticks to reach demo gameplay. Should be
//                   close to identical across branches (same x86 work).
//                   If it isn't, the cabinet is taking a different
//                   path - investigate before trusting wall numbers.
//   - demoFps:      frames-changed-per-second over MEASURE_SECONDS of
//                   demo playback. Direct steady-state speed reading.
//
// Differs from doom-loading / doom-all in that it never presses a key.
// `ingame` here is the demo's GS_LEVEL, not the new-game GS_LEVEL -
// `_g_usergame` stays 0 (the new-game path didn't run; demo path took
// us there via G_DeferedPlayDemo → G_DoPlayDemo → G_DoLoadLevel).
//
// Web target only; CLI has no /_screen/framebuffer consumer so demoFps is
// undefined for it.

const ADDR_GAMESTATE  = 0x3a3c4;
const ADDR_MENUACTIVE = 0x3ac62;
const ADDR_BDA_MODE   = 0x449;
const ADDR_TEXT_VRAM  = 0xb8000;
const TEXT_VRAM_BYTES = 4000;

const FB_BASE  = 0xa0000;
const FB_BYTES = 320 * 200;

const MEASURE_SECONDS = 20;
const WARMUP_SECONDS  = 4;   // shorter than doom-all's 8s - demo is
                              // already steady-state from frame 1, no
                              // door-melt-wipe to warm through.

// Watch list - boot stages + demo onset.
//   - poll: shared stride for all gated cond watches.
//   - text_drdos / text_doom: text-mode breadcrumbs.
//   - title: title splash visible (mode 0x13, gamestate=3, menuactive=0).
//   - demo_ingame: demo gameplay started (mode 0x13, gamestate=0).
//                  NO usergame=1 requirement - demo path doesn't set it.
const WATCH_SPECS = [
  'poll:stride:every=50000',
  `text_drdos:cond:${ADDR_BDA_MODE}=0x03,pattern@${ADDR_TEXT_VRAM}:2:${TEXT_VRAM_BYTES}=DR-DOS:gate=poll:then=emit`,
  `text_doom:cond:${ADDR_BDA_MODE}=0x03,pattern@${ADDR_TEXT_VRAM}:2:${TEXT_VRAM_BYTES}=DOOM8088:gate=poll:then=emit`,
  `title:cond:${ADDR_MENUACTIVE}=0,${ADDR_GAMESTATE}=3,${ADDR_BDA_MODE}=0x13:gate=poll:then=emit`,
  // `repeat` so the cond re-fires on every gated poll while it holds -
  // we ignore pre-title fires JS-side (tick-0 false-fire happens because
  // uninit memory + pre-BIOS mode aren't yet 0x13/zero; gating on
  // `text_doom` having already happened lets us trust the real fire).
  `demo_ingame:cond:${ADDR_GAMESTATE}=0,${ADDR_BDA_MODE}=0x13,repeat:gate=poll:then=emit`,
];

export const manifest = {
  target: 'web',
  cabinet: 'cabinet:doom8088',
  requires: ['cabinet:doom8088', 'wasm:calcite', 'prebake:corduroy'],
  // Boot + idle wait + warmup + measure. The idle wait (title → demo
  // auto-start) is ~5 seconds of game time which on the current engine
  // is many seconds of wall time; give plenty of room.
  wallCapMs: 600_000 + (WARMUP_SECONDS + MEASURE_SECONDS) * 1000,
  reportShape: {
    runMsToDemo:    'number',
    ticksToDemo:    'number',
    warmupSeconds:  'number',
    measureSeconds: 'number',
    framesChanged:  'number',
    demoFps:        'number',
    fpsSamples:     'object',
    stages:         'object',
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

  host.log(`registering ${WATCH_SPECS.length} watches (no keypresses - demo path)`);
  for (const spec of WATCH_SPECS) {
    await bridgeRequest(bridge, { type: 'register-watch', spec });
  }
  bridge.postMessage({ type: 'set-watch-chunk-ticks', chunkTicks: 50_000 });
  bridge.postMessage({ type: 'bench-run' });
  host.log('watches registered; booting and idling until demo starts');

  const stages = {};
  let demoTick = null;
  const t0 = performance.now();

  // Phase 1: boot + idle. Stop loop body when demo_ingame fires but
  // keep engine running for FPS measurement.
  //
  // IMPORTANT: demo_ingame's predicate (gamestate=0, mode=0x13) is
  // also satisfied at tick 0 (uninitialised memory zero + BIOS not
  // yet having set mode 0x03). To avoid that false-fire we ignore
  // demo_ingame events until we've seen `title` first. The cabinet
  // path is: pre-boot → text_drdos → text_doom (text mode) → mode
  // flips to 0x13 + gamestate=3 → title → ~5s game-time idle →
  // demo flips gamestate to 0 → demo_ingame.
  while (true) {
    if (performance.now() - t0 > 600_000) {
      throw new Error('demo-start wall-clock cap exceeded (10 min)');
    }
    await new Promise(r => setTimeout(r, 500));
    const r = await bridgeRequest(bridge, { type: 'drain-measurements' });
    const events = JSON.parse(r.events);
    for (const ev of events) {
      // Suppress demo_ingame until after title has fired - pre-title
      // hits are the tick-0 false-fire.
      if (ev.watch === 'demo_ingame' && !stages.title) continue;
      if (!stages[ev.watch]) {
        stages[ev.watch] = { tick: ev.tick, wallMs: performance.now() - t0 };
        host.log(`stage ${ev.watch} tick=${ev.tick} wallMs=${stages[ev.watch].wallMs.toFixed(0)}`);
      }
      if (ev.watch === 'demo_ingame' && demoTick == null && stages.title) {
        demoTick = ev.tick;
      }
    }
    if (stages.demo_ingame) break;
  }

  // Phase 2: warmup. Skip any initial transition frames.
  host.log(`demo started; warmup ${WARMUP_SECONDS}s`);
  await new Promise(r => setTimeout(r, WARMUP_SECONDS * 1000));

  // Phase 3: FPS measurement. Sample FB every ~16ms.
  host.log(`measuring demo FPS for ${MEASURE_SECONDS}s`);
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
  const demoFps = framesChanged / (measureMs / 1000);

  bridge.postMessage({ type: 'bench-stop' });
  host.log(`done: ${framesChanged} frames in ${(measureMs/1000).toFixed(1)}s = ${demoFps.toFixed(2)} fps`);

  return {
    profileName: 'doom-demo',
    runMsToDemo:    stages.demo_ingame?.wallMs ?? null,
    ticksToDemo:    demoTick,
    warmupSeconds:  WARMUP_SECONDS,
    measureSeconds: measureMs / 1000,
    framesChanged,
    demoFps,
    fpsSamples,
    stages,
  };
}
