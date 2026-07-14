// tests/bench/profiles/msdos-boot.mjs - MS-DOS 4.00 boot-to-prompt bench.
//
// carts/msdos4 boots real MS-DOS 4.00 via the Corduroy INT 19h path
// (MSBOOT -> MSLOAD -> IO.SYS -> MSDOS.SYS -> COMMAND.COM); AUTOEXEC.BAT
// runs VER, so "MS-DOS Version 4.00" in text VRAM means the whole chain
// executed and the prompt is up. Same sentinel as the harness `msdos`
// preset (tests/harness/run.mjs).
//
// Reports the compile-vs-run split for the "MS-DOS takes ages to boot"
// question: compileMs/cabinetBytes come from the page envelope,
// runMsToPrompt/ticksToPrompt from the banner watch.

const ADDR_TEXT_VRAM  = 0xb8000;
const TEXT_VRAM_BYTES = 4000;

const WATCH_SPECS = [
  'poll:stride:every=50000',
  `banner:cond:pattern@${ADDR_TEXT_VRAM}:2:${TEXT_VRAM_BYTES}=MS-DOS Version 4.00:gate=poll:then=emit+halt`,
];

export const manifest = {
  target: 'web',
  cabinet: 'cabinet:msdos4',
  requires: ['cabinet:msdos4', 'wasm:calcite', 'prebake:corduroy'],
  wallCapMs: 600_000,
  cliWatches: WATCH_SPECS,
  cliMaxTicks: 15_000_000,
  reportShape: {
    runMsToPrompt: 'number',
    ticksToPrompt: 'number',
    compileMs:     'number',
    cabinetBytes:  'number',
    stages:        'object',
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
  if (!window.__bridgeWorker) {
    throw new Error('no __bridgeWorker - page must spawn bridge first');
  }
  const bridge = window.__bridgeWorker;

  host.log(`registering ${WATCH_SPECS.length} watches`);
  for (const spec of WATCH_SPECS) {
    await bridgeRequest(bridge, { type: 'register-watch', spec });
  }
  bridge.postMessage({ type: 'set-watch-chunk-ticks', chunkTicks: 50_000 });
  bridge.postMessage({ type: 'bench-run' });

  host.log('watches registered; running until banner halt');

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
    if (stages.banner) break;
  }
  host.log('banner reached');

  // Per-phase wasm compile breakdown (parse/compile substeps) - the
  // bridge exposes engine.compile_phase_report() for exactly this.
  let phaseReport = null;
  try {
    const r = await bridgeRequest(bridge, { type: 'phase-report' });
    phaseReport = typeof r.report === 'string' ? JSON.parse(r.report) : r.report;
  } catch (e) {
    host.log(`phase-report unavailable: ${e.message}`);
  }

  return {
    profileName: 'msdos-boot',
    runMsToPrompt: stages.banner.wallMs,
    ticksToPrompt: stages.banner.tick,
    stages,
    phaseReport,
  };
}
