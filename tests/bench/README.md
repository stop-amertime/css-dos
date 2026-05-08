# tests/bench — the canonical performance harness

This is **the** place to measure performance on CSS-DOS. One driver,
two transports (web via Playwright, native via `calcite-cli`), profiles
declare what to measure. The web bench runs the same calcite-wasm +
bridge + SW + player surface the user sees, so its numbers are the
numbers the user feels.

It is the perf-shaped peer to `tests/harness/` (correctness — smoke,
conformance, divergence-finding). If you need a perf number, you are
in the right place. If you need correctness, look there.

## You are required to read this whole page before running any bench

This is project policy, not a suggestion. Future-you and other agents
will compare numbers to whatever lands in STATUS / LOGBOOK; the
methodology has to be consistent or those comparisons are noise.

### The rules

1. **Use only the four canonical profiles** below. Don't roll an
   ad-hoc `.mjs` script under `tests/harness/` to "just measure
   something" — that's how the old `flamegraph-doom.mjs` /
   `bench-doom-stages.mjs` sprawl happened, and it's now deleted.
   If you need a measurement that isn't covered, add a profile
   under `profiles/` and document it here. **Don't reach for**
   `cargo bench`, `criterion`, the calcite `calcite-bench` Rust
   binary, the player's `?bench=1` HUD overlay, or any
   `bench-*.mjs` script outside `tests/bench/profiles/` — those
   are internal/legacy/HUD tooling and won't produce comparable
   numbers.

2. **Web is the source of truth, and the web bench MUST run
   `--headed`.** Headless Chromium throttles backgrounded workers,
   so headless wall-clock numbers are meaningless. The CLI bench
   (`--target=cli`) is a dev-only sanity check — different runtime,
   no SW, no `<img>` frame consumer — and **never** the source for
   a user-facing perf claim. Don't quote CLI numbers in STATUS/
   LOGBOOK as if they reflect what the user sees.

3. **Use a 3-run median when claiming a perf delta.** Single runs
   carry host-CPU / Chrome-GC noise; with nothing else competing
   the runs converge tightly (±0.5 %), but a wrong-direction
   single-run delta is meaningless. The `doom-all` profile is the
   right choice for delta measurements — it captures all phase
   timings in one boot.

4. **Quote JSON before/after a perf claim.** The driver writes
   the full result to `--out=PATH` (or stdout). Don't paraphrase;
   cite `runMsToInGame`, `ticksPerSecAvg`, `ingameFps`,
   `phases.doomLoad` etc. directly. Save the JSONs under
   `docs/benches/` for any baseline you want to anchor future
   comparisons against.

5. **Don't diagnose by running the player interactively.** Build a
   measurement tool. That's what this directory is for.

### Canonical profiles (the only valid bench surface)

| Profile | What it measures | When to use |
|---|---|---|
| `compile-only`     | Cabinet → parse → compile time              | Sanity check the build path. ~30 s. |
| `doom-loading`     | Boot through six stages → in-game           | "How fast does the cabinet boot?" Reports `runMsToInGame`, `ticksToInGame`, `ticksPerSecAvg`, `stages`. ~80 s. |
| `doom-ingame-fps`  | Steady-state in-game FPS while holding Left | "How does it feel mid-gameplay?" 8 s warmup (menu slide-off, view fade-in, cache warmup) → 20 s measurement. Hashes the full 320×200 framebuffer; each distinct hash is one user-visible frame. ~107 s. |
| `doom-all`         | doom-loading **and** doom-ingame-fps in one boot | **The default for any non-trivial perf measurement.** Same wall as `doom-ingame-fps` alone (both share the boot). Reports phase substeps (compile / dosBoot / doomTitle / doomMenuDelay / doomLoad / warmup / measure). |

### What "doom-all" reports (read this so you know what to cite)

```jsonc
{
  "compileMs":      27592,         // cabinet (332 MB) → calcite IR; one-shot per load
  "runMsToInGame":  77061,         // engine-running → gamestate=GS_LEVEL
  "ticksToInGame":  34528096,      // ~deterministic across runs (~1% variance)
  "ticksPerSecAvg": 443099,        // throughput, derived from 1 Hz bridge-stats
  "ingameFps":      1.85,          // distinct full-frame hashes / measureSeconds
  "phases": {
    "dosBoot":       9016,         // BIOS + EDR-DOS to mode-13h title splash
    "doomTitle":      531,         // title splash dismissed → menu visible
    "doomMenuDelay": 2139,         // Enter taps → G_InitNew → level-load begins
    "doomLoad":     65480,         // level-load until gamestate=GS_LEVEL  ← lion's share
    "warmup":        8000,         // menu slide-off, view fade-in (not measured)
    "measure":      20013          // FPS measurement window
  },
  "stages":      { ... },          // per-stage absolute tick + wallMs
  "fpsSamples":  [ ... ],          // 1 Hz instantaneous fps during measure
  "statsSamples":[ ... ]           // 1 Hz bridge-stats time series across the run
}
```

**doomLoad is ~85 % of the engine-run wall** — that's where perf
optimisation pays off most, and it's also where regressions hide.
Watch this number specifically.

### Current baseline (2026-05-08, old-kbd branch, BIF2 OFF, 3-run `doom-all` median)

| Phase / metric | Value |
|---|---:|
| compile        | 27.8 s |
| dosBoot        | 9.0 s |
| doomTitle      | 0.5 s |
| doomMenuDelay  | 2.6 s |
| **doomLoad**   | **68.5 s** (≈85 % of engine-run wall) |
| warmup         | 8.0 s |
| measure        | 20.0 s |
| **runMsToInGame** | **79.7 s** |
| **ticksPerSecAvg** | **423 K** |
| **ingameFps**     | **1.70** |

Raw JSONs under `docs/benches/doom-all-2026-05-08-old-kbd-*.json`.
With BIF2 fusion ON: 77.1 s / 443 K ticks/sec / 1.85 fps (~+4-8 %).

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
# Sanity (no boot, no run — just compile time):
node tests/bench/driver/run.mjs compile-only

# Default for any non-trivial perf measurement (boot + FPS in one run):
node tests/bench/driver/run.mjs doom-all --headed --out=tmp/baseline.json

# Just one number quickly:
node tests/bench/driver/run.mjs doom-loading    --headed   # boot wall
node tests/bench/driver/run.mjs doom-ingame-fps --headed   # steady-state FPS

# Native CLI sanity (do NOT use for headline claims):
node tests/bench/driver/run.mjs doom-loading --target=cli
```

**Three-run protocol for delta claims:**

```sh
for i in 1 2 3; do
  node tests/bench/driver/run.mjs doom-all --headed \
    --no-rebuild --out=tmp/run-$i.json
done
# Then compare medians of runMsToInGame, ticksPerSecAvg, ingameFps.
```

**Prerequisites:**

- **Dev server.** Start with
  `CALCITE_REPO=/abs/path/to/calcite node web/scripts/dev.mjs` (port
  5173 by default; pass `PORT=N` env to override). From a worktree
  set `CALCITE_REPO` to the calcite repo (or worktree) you want to
  bench against — `../calcite/` resolves to the wrong path inside
  worktrees. The driver attaches via Playwright; pass `--port=N` to
  match the server.
- **System Chrome on Windows.** The driver's `--headed` path uses
  system Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`
  via `launchPersistentContext` so the window actually opens
  visibly. Bundled Playwright Chromium fails on this machine
  ("side-by-side configuration is incorrect" — missing VC++
  redistributable). On other platforms, bundled Chromium is used.
- **Nothing else competing for CPU.** Close other Chrome windows,
  MCP playwright sessions, heavy editor processes. Run-to-run noise
  jumps from ±0.5 % (clean) to ±30 % (contended). Check
  `tasklist //FI "IMAGENAME eq chrome.exe"` first.

The driver's first action is `ensureArtifact()` for every artifact the
profile declares (cabinet, calcite-wasm or -cli, prebakes). Stale
artifacts get rebuilt automatically; `--no-rebuild` errors instead. See
[`docs/rebuild-when.md`](../../docs/rebuild-when.md) for the artifact
graph. The artifact registry honours `CALCITE_REPO`.

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

## What's NOT here, and what to use them for instead

| You want… | Use |
|---|---|
| Smoke / conformance / divergence check | `tests/harness/run.mjs smoke`, `tests/harness/pipeline.mjs fulldiff` |
| Visual screenshot at tick N             | `tests/harness/pipeline.mjs fast-shoot` |
| Calcite debugger MCP surface            | `tests/harness/pipeline.mjs`, `../calcite/docs/debugger.md` |
| Low-level Rust microbench / Criterion   | `../calcite/docs/benchmarking.md` (`calcite-bench`, `cargo bench`) — **internal calcite-engine work only**. Not a CSS-DOS perf number. |
| Player-side stats HUD overlay           | `?bench=1` URL param on `/player/calcite.html`. **Display only**, not a measurement tool. |

**None of those produce numbers comparable to STATUS / LOGBOOK
baselines.** If you find yourself wanting to "just measure
something" with one of them — stop, and add a profile here instead.

## Common pitfalls (read once, save yourself an hour)

- **Wrong calcite.** Without `CALCITE_REPO` set, both the dev server
  and the bench artifact registry fall back to `../calcite/`, which
  from a CSS-DOS worktree resolves to a sibling worktree on a
  different branch (`worktrees/calcite/`, usually
  `worktree-packed-memory`). Always set `CALCITE_REPO` to point at
  the calcite branch you mean to bench.
- **Stale wasm.** The dev server caches `/calcite/pkg/calcite_wasm_bg.wasm`.
  After rebuilding calcite-wasm, hit `http://localhost:5173/_clear`
  to wipe browser caches, or just restart the dev server. The bench
  page sets `Cache-Control: no-store` so reload picks up new wasm.
- **Headless wins that aren't.** A headless run can produce a
  faster wall than headed because Chromium's frame consumer never
  paints. Don't compare headed-vs-headless. Always headed.
- **Single-run perf claims.** Even with nothing else running, one
  run per side can swap which side is "faster" by 2-3 %. Three
  runs per side, compare medians.
- **Quoting CLI numbers as if they're user-facing.** CLI is
  faster than web for reasons that are real (no SW, native rather
  than wasm) but irrelevant — the user runs the web. CLI numbers
  belong in dev notes; web numbers in headlines.
