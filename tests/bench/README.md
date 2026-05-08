# tests/bench

Performance benchmark harness. One driver, two transports (web via
Playwright, native via `calcite-cli`), profiles declare what to
measure.

This is the perf-shaped peer to `tests/harness/`. If you want
correctness (smoke, conformance, divergence-finding), look there
instead.

## Read this before running any benchmark

1. **Use only the canonical profiles** below. Don't roll an ad-hoc
   `.mjs` script under `tests/harness/` to "just measure something" —
   that's how the old `flamegraph-doom.mjs` / `bench-doom-stages.mjs`
   sprawl happened. If you need a measurement that isn't covered, add
   a profile under `profiles/` and document it here.

2. **Web is the source of truth, and the web bench MUST run `--headed`.**
   Headless Chromium throttles backgrounded workers, so headless wall-
   clock numbers are meaningless. The CLI bench (`--target=cli`) is a
   dev-only sanity check — different runtime, no SW, no `<img>` frame
   consumer — and never the source for a user-facing perf claim.

3. **Quote JSON before/after a perf claim.** The driver writes the
   full result to `--out=PATH` (or stdout). Don't paraphrase; cite
   `runMsToInGame`, `ticksPerSecAvg`, `ingameFps` etc. directly.

4. **Don't diagnose by running the player interactively.** Build a
   measurement tool. That's what this directory is for.

## Canonical profiles

| Profile | What it measures | Notes |
|---|---|---|
| `compile-only`     | Cabinet → parse → compile time              | Sanity check the build path. |
| `doom-loading`     | Boot through six stages → in-game           | `runMsToInGame`, `ticksToInGame`, `ticksPerSecAvg`, `stages`. |
| `doom-ingame-fps`  | Steady-state in-game FPS while holding Left | 8 s warmup (menu slide-off, view fade-in, cache warmup) → 20 s measurement. Hashes the full 320×200 framebuffer; each distinct hash is one user-visible frame. |
| `doom-all`         | doom-loading **and** doom-ingame-fps in one boot | Same wall time as `doom-ingame-fps` alone (both share the boot cost). Use this when you want all the numbers; use the small profiles when you want one number quickly. |

## Layout

```
tests/bench/
  page/index.html       — page-side runner (loads calcite-bridge worker)
  driver/run.mjs        — Node CLI; drives page (Playwright) or calcite-cli
  profiles/             — one .mjs file per named bench
    compile-only.mjs    — sanity: cabinet → parse → compile, report ms
    doom-loading.mjs    — doom8088 boot through six stages to in-game
    doom-ingame-fps.mjs — doom8088 steady-state FPS while holding Left
    doom-all.mjs        — doom-loading + doom-ingame-fps in one boot
  lib/
    artifacts.mjs       — declarative manifest of every built artifact
    ensure-fresh.mjs    — staleness primitive (mtime + transitive rebuild)
    ensure-fresh.test.mjs
  cache/                — built cabinets (gitignored, ephemeral)
```

## Running a bench

```sh
node tests/bench/driver/run.mjs compile-only
node tests/bench/driver/run.mjs doom-loading --headed       # web (THE canonical bench)
node tests/bench/driver/run.mjs doom-loading --target=cli   # native, dev-only sanity
node tests/bench/driver/run.mjs doom-ingame-fps --headed    # steady-state in-game FPS
node tests/bench/driver/run.mjs doom-loading --no-rebuild --out=tmp/result.json
```

The driver's first action is `ensureArtifact()` for every artifact the
profile declares (cabinet, calcite-wasm or -cli, prebakes). Stale
artifacts get rebuilt automatically; `--no-rebuild` errors instead. See
[`docs/rebuild-when.md`](../../docs/rebuild-when.md) for the artifact
graph.

Web target needs the dev server (`node web/scripts/dev.mjs`) on
:5173. The driver attaches via Playwright; pass `--port=N` to override.

## Adding a profile

A profile is a `.mjs` file under `profiles/` that exports two things:

```js
export const manifest = {
  target:    'web' | 'cli',
  cabinet:   'cabinet:doom8088',
  requires:  ['cabinet:doom8088', 'wasm:calcite', 'prebake:corduroy'],
  wallCapMs: 600_000,
  cliWatches: ['name:cond:0x3a3c4=0:gate=poll:then=emit+halt', ...],
  reportShape: { runMsToInGame: 'number', stages: 'object', ... },
};

export async function run(host) {
  // host: { log(msg, cls?), setMeta(obj), profileName }
  // Compose calcite-core script primitives via:
  //   (web)  engine.register_watch("name:cond:0x3a3c4=0:gate=poll:then=emit+halt")
  //   (cli)  driver translates manifest.cliWatches into --watch flags
  // Drain measurement events; return the final report object.
}
```

Stage detectors compose generic primitives — `cond`, `pattern@…`, `gate=poll`,
`then=emit`, etc. — with the addresses for *this cart* in the profile
file (the consumer side, where they belong). The primitive grammar lives
in [`docs/script-primitives.md`](../../docs/script-primitives.md).

## Adding a built artifact

Edit `lib/artifacts.mjs`. One entry, four fields: `name`, `output`,
`inputs[]` (file globs + transitive artifact names), `rebuild`.
ensureFresh now auto-rebuilds it.

```js
registerArtifact({
  name:    'cabinet:rogue',
  output:  'tests/bench/cache/rogue.css',
  inputs:  ['carts/rogue/**', 'kiln/**', 'builder/**', 'prebake:corduroy'],
  rebuild: 'node builder/build.mjs carts/rogue -o tests/bench/cache/rogue.css',
});
```

## Web target: bridge spawning is the page's job

`page/index.html` spawns the calcite-bridge worker and exposes it as
`window.__bridgeWorker`. Profiles assume it's there and post messages
to it directly (`register-watch`, `set-watch-chunk-ticks`,
`bench-run`, `drain-measurements`). The page doesn't open a viewer
port (`/_stream/fb`) by default — keyboard input from a profile goes
either through the bridge's `kbd` MessagePort handler or through the
SW's `/_kbd?key=` endpoint.

## What's not here

- The smoke runner (`tests/harness/run.mjs smoke`) — correctness, not perf.
- The conformance ref-machine (`tests/harness/lib/ref-machine.mjs`) — same.
- Anything that wants the calcite debugger's MCP surface — that's
  `tests/harness/pipeline.mjs` territory.
