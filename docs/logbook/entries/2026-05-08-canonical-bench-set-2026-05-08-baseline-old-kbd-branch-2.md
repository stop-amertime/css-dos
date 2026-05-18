## 2026-05-08 — canonical bench set + 2026-05-08 baseline (old-kbd branch)

The benchmark layout was sprawling across `tests/harness/` (legacy
`flamegraph-doom.mjs`, `bench-doom-stages.mjs`, `bench-doom-load.mjs`)
and `tests/bench/profiles/`, with no single rule about which is the
canonical tool. Cleaned this up to **three** canonical profiles and
made `tests/bench/README.md` required reading before any benchmark
run.

**Canonical profile set** (under `tests/bench/profiles/`):

| Profile | What it measures |
|---|---|
| `compile-only`     | Cabinet → parse → compile time |
| `doom-loading`     | Boot through six stages → in-game (wall ms, ticks) |
| `doom-ingame-fps`  | Steady-state in-game FPS while holding Left |

`doom-ingame-fps` is the rename of the earlier `ingame-fps.mjs`
(cart-prefix matches `doom-loading`). Holds Left continuously,
samples the full 320×200 framebuffer every ~16ms, hashes via FNV-1a,
counts distinct frames. **Now includes 8 s warmup** before
measurement starts — right after `gamestate=GS_LEVEL` flips, the
menu slides off the bottom of the screen (~3-4 s), the view fades
in, and sprite/sector caches populate. Without warmup the headline
was ~2.7 fps with the first 4 s at 6-11 fps from menu animation.
With warmup the headline is **1.45 fps** — what the user actually
feels mid-gameplay.

**2026-05-08 baseline (old-kbd branch, 3-run doom-all median, web
`--headed`):**

| Phase | Median wall |
|---|---:|
| compile (cabinet → calcite IR, one-shot) | 27.6 s |
| dosBoot (BIOS + DOS to title splash)     | 9.0 s |
| doomTitle (title → menu)                 | 0.5 s |
| doomMenuDelay (Enter → level-load start) | 2.1 s |
| doomLoad (level-load → GS_LEVEL)         | **65.5 s** |
| warmup (menu slide-off, no measure)      | 8 s |
| measure (FPS sample window)              | 20 s |

- Run wall (engine-running to in-game): **77.1 s** (range 76.6-77.5,
  ±0.5 %). Tick count: 34.1 M; throughput: **443 K ticks/sec**.
- Steady-state in-game FPS: **1.85** (range 1.70-2.15).
- doomLoad is **84.9 %** of the engine-run wall — perf optimisation
  pays off there more than anywhere else.

Raw JSONs (each ~27 KB, contains full `statsSamples` and `fpsSamples`
time series) in `docs/benches/doom-all-2026-05-08-old-kbd-run{1,2,3}.json`.

Earlier 3-run set (range 78-112 s wall) was contaminated by host
CPU contention — that set's "use 3-run medians, ±30 %" advice was
overstated. With nothing else competing the runs converge to within
±0.5 %.

**Cleanup landed in this entry:**
- Renamed `tests/bench/profiles/ingame-fps.mjs` → `doom-ingame-fps.mjs`.
- Added `doom-all.mjs` — runs `doom-loading` + `doom-ingame-fps`
  in one boot. Same wall as ingame-fps alone (both pay the boot).
  Small profiles kept for "I want one number quickly" cases.
- Deleted `tests/harness/flamegraph-doom.mjs` (LEFT-holding workload
  bundled with V8 CPU profiling — superseded by the bench profile;
  if web-side flamegraphs are needed again, add them as a profile).
- Deleted `tests/harness/resolve-cpuprofile.mjs` (helper for above).
- Deleted `tests/harness/bench-doom-{load,stages,stages-cli,gameplay}.mjs`,
  `tests/harness/bench-web.mjs`, `web/player/bench.html` — all
  superseded by the canonical profiles.
- Updated `CLAUDE.md`, `docs/TESTING.md`, `tests/bench/README.md`,
  `STATUS.md` so all paths converge on the canonical set; reading
  `tests/bench/README.md` before running any bench is now mandatory.
