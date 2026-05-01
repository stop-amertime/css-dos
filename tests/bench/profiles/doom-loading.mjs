// tests/bench/profiles/doom-loading.mjs — doom8088 boot-to-loading bench.
//
// Replaces the old bench-doom-load.mjs. Same intent: measure how long
// the level-load path takes. The window is from snapshot_loading
// (boot+menu skipped via snapshot restore) through GS_LEVEL.
//
// Profile shape: a `manifest` object the driver reads (transport,
// dependencies, wall-clock cap), and a `run(host)` function the page
// calls to actually drive the engine + collect measurements.
//
// Once the calcite-core script primitives land in Chunk D this profile
// expresses its waits via:
//
//   primitives.cond({ name: 'level_loaded', addr: 0x3a3c4, eq: 0 })   // GS_LEVEL=0
//   primitives.stride(50_000)                                          // poll every 50K ticks
//
// For now the profile uses the same shape the page-side runner has
// always used (page peeks calcite state via the bridge worker).

export const manifest = {
  target: 'web',
  cabinet: 'cabinet:doom8088',
  // What ensureFresh must rebuild before this profile can run.
  requires: ['cabinet:doom8088', 'wasm:calcite', 'prebake:corduroy'],
  wallCapMs: 600_000,  // 10 min
  reportShape: {
    runMsToLevel:    'number',
    ticksToLevel:    'number',
    cyclesToLevel:   'number',
    cabinetBytes:    'number',
    bootBuildMs:     'number',
    compileMs:       'number',
  },
};

export async function run(host) {
  host.log('doom-loading profile starting');

  // STUB: This will compose calcite-wasm engine.registerWatch() calls
  // once Chunk D's API is exposed. For now, reports a placeholder so
  // the harness skeleton is exercisable end-to-end.
  host.log('STUB: Chunk D primitives not yet wired');

  return {
    profileName: 'doom-loading',
    note: 'stub — wired once Chunk D lands',
    runMsToLevel: null,
    ticksToLevel: null,
    cyclesToLevel: null,
    cabinetBytes: null,
    bootBuildMs: null,
    compileMs: null,
  };
}
