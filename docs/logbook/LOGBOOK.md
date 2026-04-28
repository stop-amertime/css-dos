# CSS-DOS Logbook

Last updated: 2026-04-28

## Current status

Working carts: zork, montezuma, sokoban, zork-big (2.88 MB), command-bare,
shelltest, the smoke set (dos-smoke, hello-text, cga4-stripes, cga5-mono,
cga6-hires). Doom8088 reaches in-game on **both** the web player and
calcite-cli. Prince of Persia reaches the title screen.

The smoke suite at `tests/harness/run.mjs smoke` (7 carts) is the
regression gate.

## 2026-04-28 — 3 word-slot scheme (worktree-3slot)

The kiln moves from **6 byte-slots → 3 word-slots** for memory writes.
Each slot now carries `--_slotKWidth` (1 or 2): width=2 packs an
addr/addr+1 byte-write pair into one slot whose `--memValK` holds the
un-split 16-bit word. INT/IRQ frames (FLAGS+CS+IP = 3 words) fit the
new 3-slot worst case exactly. `--applySlot` becomes 6-arg
(loOff, hiOff, val, width) and handles aligned-word, byte, and odd-
addressed straddle splices.

Calcite recogniser (`packed_broadcast_write.rs` + parser fast-path)
updated to recognise the new 6-arg shape; `CompiledPackedBroadcastWrite`
gains `width_slot` and the splice paths in `compile.rs`/`eval.rs` apply
1- or 2-byte writes per port per tick.

Cabinet size and headline measurements (calcite-cli native, post-merge
on top of `23c01df`):

| Cart    | 6-slot   | 3-slot   | Δ      |
|---------|---------:|---------:|-------:|
| dos-smoke (test) | 152.6 MB | 139.9 MB | −8.3% |
| zork1   | 299.6 MB | 274.7 MB | −8.3% |
| doom8088 | 341.7 MB | 316.9 MB | −7.3% |

Doom8088 stage bench (`bench-doom-stages-cli.mjs`):

| Stage         | 6-slot     | 3-slot     | Δ     |
|---------------|-----------:|-----------:|------:|
| text_drdos    |  1 110 ms  |  1 083 ms  | −2.4% |
| text_doom     |  3 751 ms  |  3 635 ms  | −3.1% |
| title         |  9 524 ms  |  9 284 ms  | −2.5% |
| menu          | 10 304 ms  | 10 024 ms  | −2.7% |
| loading       | 13 655 ms  | 13 319 ms  | −2.5% |
| **ingame**    | **90 995 ms** | **85 323 ms** | **−6.2%** |
| **runMsToInGame** | **91.0 s** | **85.3 s** | **−6.2% (5.7 s saved)** |
| ticksToInGame | 35 000 000 | 35 000 000 | identical |
| cyclesToInGame| 397 458 534 | 397 458 534 | identical |

**Same cycle count, same tick count to in-game** — the CPU is doing
identical work; the saving is per-tick CSS evaluation cost. The
level-load window (loading→ingame, 29.5 M ticks) drops 77.3 s → 72.0 s
= −6.9%.

Zork1 5 M-tick run also shows ~3% per-tick speedup with no per-cycle
regression, plus 20% faster compile.

The change is feature-complete in the worktrees. Open follow-ups:
- Calcite-wasm rebuild + web bench cross-check (web has a different
  per-tick fixed cost; the bridge measurement should still see ~6%).
- Snapshot files from 2026-04-28 are invalidated by this change
  (slot count + applySlot arity changed). Recapture if you need to
  iterate on level-load.

Worktrees:
- CSS-DOS: `.claude/worktrees/3slot/`, branch `worktree-3slot` (kiln + docs)
- calcite: `.claude/worktrees/3slot/`, branch `worktree-3slot` (recogniser + splice)

To run a worktree against the matching calcite, set `CALCITE_REPO`:
```
export CALCITE_REPO=/c/Users/.../calcite/.claude/worktrees/3slot
```
See CLAUDE.md "Working in a git worktree".

## Active focus — Doom8088 level-load is too slow

Re-measured 2026-04-28 (current cabinet, current calcite). Both numbers
are `stage_loading → stage_ingame` deltas (29.5 M ticks):

| Path                            | wallMsDelta | ticks/s |
|---------------------------------|------------:|--------:|
| CLI (bench-doom-stages-cli)     |     73 000  | 405 K   |
| CLI (direct + restore snapshot) |     74 200  | 398 K   |
| Web (bench-doom-stages)         |     88 200  | 334 K   |

Web is ~1.21× slower than CLI on this window. (Previous LOGBOOK figures
of 134 000 / 127 000 ms were stale — different cabinet build.) Web
compile is ~43 s (with LTO + codegen-units=1) vs ~3.8 s native; that's
wasm runtime cost, not bridge waste — the bridge does one
`new_from_bytes(bytes)` call with no extra copies.

What this means for perf work: **the level-load cost is the engine
itself**, not the bridge. Optimisations that reduce per-tick CSS
evaluation cost or eliminate slow REP fast-forward bails help both
targets. Bridge-only optimisations won't move the level-load number.

The mission doc is
[`docs/agent-briefs/doom-perf-mission.md`](../agent-briefs/doom-perf-mission.md).
Read it before starting perf work.

### What the level-load is actually doing (2026-04-28)

Two new measurements against the 29.5 M-tick window (snapshot-restore
from `stage_loading.snap`, halt on `_g_gamestate=GS_LEVEL`):

**CS:IP heatmap** (`tests/harness/analyse-cs-ip-samples.mjs` on a
sample CSV from `calcite-cli --sample-cs-ip`):

- Segment 0x55: **67.8 %** of CPU. Bursts: 110 distinct IPs / 500 ticks
  → medium-body function (not a tight loop) called millions of times.
  Matches the brief's gcc-ia16 paragraph→linear helper hypothesis.
- Segment 0x2D96 (BIOS dispatch): **15.0 %**, all in one 256-byte page.
  Bursts: 46 distinct IPs → small dispatcher loop.
- Segment 0x1122: **8.3 %** (not in any prior analysis). Same 46-IP
  small-loop shape as 0x2D96.

Three segments = 91 % of level-load CPU.

**Op distribution** (`calcite-bench --profile --batch=0` after restore):

- LoadSlot 27 % + BranchIfNotEqLit 25 % + LoadState 9 % + LoadLit 8 %
  → **>60 % of ops are un-fused load-then-compare-then-branch chains.**
- Dispatch 2.7 % + DispatchChain 3.9 % (each averaging 177 sub-ops)
  → recognisers fire on bulk work, but the long tail above is real.
- LoadStateAndBranchIfNotEqLit 0.7 % → fused op exists, almost never
  hit. **Adding more fused ops for common load+compare+branch
  patterns is a real lead.**
- BroadcastWrite 0 % → packed-broadcast recogniser is doing its job.

**Caveat on the profile output**: `--batch=0 --profile` reports
snapshot+change-detect at ~91 % of time. That cost only fires in
single-tick mode and is an instrumentation artifact — in `run_batch`
execution neither phase runs. The op-count *distribution* is real;
the time *split* in that run is not representative of production.

## How to test (Doom8088 perf)

Use either bench. Web is preferred when you want to *see* what's
happening; CLI is preferred for headless or batch measurement. They
report the same shape of JSON.

```sh
# Web bench (Playwright, headed if you want to watch).
node tests/harness/bench-doom-stages.mjs --headed --json=tmp/web.json

# CLI bench (calcite-cli + memory-peek polling, no browser).
node tests/harness/bench-doom-stages-cli.mjs --json=tmp/cli.json
```

Both run the same six stages with the same sentinels and emit
`headline.runMsToInGame` / `ticksToInGame` / `cyclesToInGame`. Quote
the JSON before/after any claimed perf change. Don't trust "felt
faster".

If only one of the two regresses on a change, that's a real regression
in *that target* — investigate the difference rather than dismissing it.

**Don't diagnose by running the player interactively.** That's the
2026-04-27 trap; spend the time on the bench instead.

## Boot sequence (dos-corduroy)

For generic carts:

1. Mode 13h splash
2. Text-mode kernel + ANSI banner
3. Game starts

For Doom8088 the bench observes six stages — sentinel definitions live
in the perf brief:

1. `stage_text_drdos` — kernel banner in 80×25 VRAM
2. `stage_text_doom` — DOOM init log in VRAM
3. `stage_title` — mode 13h, title splash
4. `stage_menu` — `_g_menuactive=1`
5. `stage_loading` — `_g_usergame=1`, gamestate still GS_DEMOSCREEN
6. `stage_ingame` — gamestate flips to GS_LEVEL

"Ticks are running" is not a pass — peek the doom globals or use the
bench.

## Test infrastructure

`tests/harness/` is the unified entry point.

- `run.mjs smoke|conformance|visual|full` — preset-level runner.
- `pipeline.mjs <subcommand>` — single-command entrypoint for `build`,
  `inspect`, `run`, `shoot`, `fast-shoot`, `full`, `fulldiff`, `triage`,
  `cabinet-diff`, `baseline-record`, `baseline-verify`, `consistency`.
- `bench-doom-stages.mjs` / `bench-doom-stages-cli.mjs` — Doom-specific
  stage bench (web / native). Web bench is **headed by default**; pass
  `--headless` to opt out.
- `bench-web.mjs` — generic web throughput bench (Zork-shaped boots).
- `analyse-cs-ip-samples.mjs` — read CSV from `calcite-cli --sample-cs-ip`
  and emit a CS:IP heatmap + per-burst loop-shape report.

`calcite-cli --sample-cs-ip=STRIDE,BURST,EVERY,PATH` records CS:IP at
mixed wide-and-bursty intervals during a run. Pairs with `--restore`
to sample a specific window. `calcite-bench --restore=PATH` also
exists now for op-distribution profiling against a restored window.

Each command emits structured JSON to stdout, human progress to stderr,
and has wall-clock + tick + stall-rate budgets. Don't fire-and-forget.

The builder emits `<cabinet>.bios.bin / .kernel.bin / .disk.bin /
.meta.json` sidecars next to every `.css`. The reference emulator
(`tests/harness/lib/ref-machine.mjs`) uses these to stand up the same
1 MB image calcite sees, so divergence hunts compare like with like.
The cabinet itself carries a `/*!HARNESS v1 {json}!*/` header with
build meta.

The legacy tools at `../calcite/tools/fulldiff.mjs`, `tools/compare-dos.mjs`,
`ref-dos.mjs`, etc. import the deleted `transpiler/` directory and don't
run. Their headers say so. Use the harness instead.

## Snapshots — fast iteration substrate

Calcite has `State::snapshot` / `State::restore`, exposed as
`--snapshot-out` / `--restore` on calcite-cli and `engine.snapshot()` /
`engine.restore(bytes)` in calcite-wasm. Same-cabinet only.

`bench-doom-stages.mjs --capture-snapshots=DIR` saves a `.snap` at
every stage transition (~1.5 MB each). Restore from `stage_loading.snap`
to skip the boot+menu and only measure the level-load window — saves
~25 s per iteration.

Snapshots are invalidated by any cabinet rebuild OR any calcite change
that touches parse/slot allocation. If you see a phash mismatch right
after restore, throw the snapshot away and recapture.

## Sentinel addresses (Doom8088)

| Symbol            | Linear  | Notes                                          |
|-------------------|---------|------------------------------------------------|
| `_g_gamestate`    | 0x3a3c4 | enum: 0=LEVEL 1=INTERMISSION 2=FINALE 3=DEMOSCREEN |
| `_g_menuactive`   | 0x3ac62 | bool                                           |
| `_g_gameaction`   | 0x3ac5e | TRANSIENT (cleared within one game tic)        |
| `_g_usergame`     | 0x3a5af | latches when G_InitNew runs                    |

Re-derivation procedure (when the cabinet rebuilds with a different
binary layout) is in the perf brief.

`_g_gameaction` is the wrong signal for stage gating — the value is
cleared on the next G_Ticker call, so a 250 ms poll usually misses it.
The bench logs `firstGaSeenAt` if it gets lucky but never gates on it.
`_g_usergame` is the durable equivalent.

## Model gotchas

- Don't run interactively to "check if it's loaded yet" — build a
  measurement tool. The 2026-04-27 lesson is captured in
  `feedback_doom_dont_run_blindly` (auto-memory).
- Don't trust the visible halt opcode — the CPU was redirected
  somewhere upstream, trace backwards.
- Always test the suspected primitive in isolation before binary-
  patching downstream code (the 2026-04-26 ROR lesson).
- When a renderer uses a "borrow path" (clone extended, build scratch
  state) instead of the unified-read path, any write port whose CSS
  sink doesn't go through `write_mem` will be invisible. Pattern from
  the 2026-04-26 DAC-palette bug.
- Don't accumulate "defensive" fixes whose root scenario you can't
  reproduce after the actual bug is gone.
- Don't reach for the old `tools/fulldiff.mjs` / `compare-dos.mjs` /
  `ref-dos.mjs` — they reference a deleted transpiler. Use
  `pipeline.mjs fulldiff` instead.

## Open work

- **EMS/XMS for Doom8088 — partial scaffold, not active.** Corduroy
  hooks INT 2Fh / INT 67h and reserves the "EMMXXXX0" magic at
  BIOS_SEG bytes 0x0A..0x11. DOOM8088 still doesn't see it because
  it detects EMS by `open("EMMXXXX0", O_RDWR)` — a synthesised DOS
  character device. Doom currently runs with `-noxms -noems -nosound`
  baked into `program.json`, which sidesteps this entirely. Files:
  `bios/corduroy/{entry,handlers,bios_init}.{asm,c}`.
- **REPNE/REPE SCASB+CMPSB fast-forward** is missing. DOOM-side libc
  string scans bail to per-byte CSS evaluation. Each variant is a
  separate case in `crates/calcite-core/src/compile.rs::rep_fast_forward`.
- **Memory packing pack=2 vs pack=1.** Native probe converges on
  ≥500 K ticks; pack=2 is slightly faster than pack=1. Browser
  verification still pending.

## Web vs native — they should agree

CSS-DOS's contract is that calcite-cli, calcite-wasm in the browser,
and a spec-compliant CSS evaluator (Chrome) all produce the same result
from the same cabinet, at different speeds. If a change makes one
target work and the other regress, **that's a bug** — not an acceptable
trade-off. The two benches exist precisely so you can spot this
quickly.
