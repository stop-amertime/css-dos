# CSS-DOS Logbook

Last updated: 2026-04-28

## 2026-04-28 — XLAT segment-override fix (kiln correctness)

Kiln was emitting `--_xlatByte` with DS hard-coded as the segment, ignoring
any 0x26/0x2E/0x36/0x3E prefix. Doom8088's column drawer uses `ss xlat`
twice per pixel to read the colormap from SS:BX (see `i_vv13ha.asm`,
`i_vv13ma.asm`, `i_vv13la.asm`, `i_vegaa.asm`, `i_vmodya.asm`,
`i_vcgaa.asm`) — so every textured wall/sprite/sky pixel was reading from
DS:BX+AL, returning whatever happened to live at that DS offset rather
than the colormap entry. Fix: use `--directSeg` (override-or-DS, same
helper MOV AL,[mem] uses) at `kiln/decode.mjs:362`.

Verified: smoke (7 carts) green; Doom8088 reaches in-game on the web
bench (`stage_ingame` at tick 34.4M, `runMsToInGame` 110s) and the
gameplay frame renders correctly. Title splash unaffected (uses
V_DrawRaw, no XLAT).

Also rewired the smoke list — small carts moved to `carts/test-carts/`
so the harness was silently running only zork+montezuma; now all 7 fire.

## Strategic shift — calcite v2 (compiler) being explored in a worktree

Doom-perf work is being redirected from peephole fusion to a load-time
compiler. Strategic doc:
[`../../calcite/docs/compiler-mission.md`](../../../calcite/docs/compiler-mission.md);
pointer at [`../agent-briefs/calcite-compiler-mission.md`](../agent-briefs/calcite-compiler-mission.md).
Cardinal-rule sharpening landed in [`../../CLAUDE.md`](../../CLAUDE.md).

The work is being **tried in a git worktree** so master stays on the
v1 interpreter while v2 is being explored. If Phase 0 / 0.5 say the
ceiling is real, the worktree branch becomes the path forward; if
not, master is unaffected and we return to the peephole road.

### 2026-04-28 — Calcite compiler Phase 0 starting

Worktree: `calcite/.claude/worktrees/calcite-v2` on branch `calcite-v2`,
forked from `main` at 23c01df. Spec:
[`../../calcite/docs/compiler-spec.md`](../../../calcite/docs/compiler-spec.md).

**Pre-flight.** Baseline `cargo test --workspace` was red on a clean tree:
four `calcite-core` tests panicked in `rep_fast_forward` with "no `--opcode`
slot." Root cause: 23c01df tightened the REP fast-forward contract to
"every variant must fast-forward — no slow path," but didn't gate the
caller against cabinets that aren't x86 emulators at all (toy unit-test
programs that have no `--opcode` property anywhere). Fix landed in
da41841: a new `CompiledProgram.has_rep_machinery` flag, set at compile
time iff `--opcode` is in `property_slots`, gates the call. Five other
tests that asserted silent bail for conditions the same commit promoted
to hard panic (DF set, seg override, MOVS source overlapping rom-disk,
STOS dest overlapping BIOS, DI wrap) were deleted — they encoded the
old contract and the new one is "extend the bulk path or panic, never
silently fall back." Tree is now green (144 tests pass).

**Plan.** Phase 0 is a measurement: hand-code the normal form for one
hot region, microbench it against the interpreter on the same snapshot,
decide whether the >=10x ceiling is real.

- **Region pick:** segment 0x2D96 (BIOS dispatch, ~15 % of Doom8088
  level-load CPU, 46 distinct IPs in a 256-byte page — small, uniform,
  cleanly bounded). Picked over the bigger 0x55 (67.8 %, 110 distinct
  IPs) because the decision gate is "is the ceiling >=10x?" — that
  question is answered just as well by a smaller region, and the
  smaller region has less room for hand-derivation correctness bugs to
  confound the speed number. If 0x2D96 shows >=10x, road is committed
  and 0x55 becomes Phase 1+ work.
- **Snapshot strategy:** capture state at a tick where the next batch
  is dominated by 0x2D96. Use existing `State::snapshot` /
  `State::restore`. Fixture goes under
  `crates/calcite-core/benches/fixtures/phase0/` (or wherever existing
  Criterion benches keep inputs).
- **Microbench:** Criterion bench `phase0_seg2d96.rs` with two groups
  (`interpreter`, `handcoded`) sharing the snapshot. Conformance check
  in a separate `#[test]` asserts state-vars + memory bit-identical
  after an equivalent run. Median of three full bench invocations on a
  cooled machine.
- **Decision gate (mission doc):** >=10x → commit to road, proceed to
  Phase 0.5; 3-10x → road viable, recalibrate ceiling expectations;
  <3x → abandon, go back to peephole road. Logbook entry on completion
  states the gate fired and which branch.

## Current status

Working carts: zork, montezuma, sokoban, zork-big (2.88 MB), command-bare,
shelltest, the smoke set (dos-smoke, hello-text, cga4-stripes, cga5-mono,
cga6-hires). Doom8088 reaches in-game on **both** the web player and
calcite-cli. Prince of Persia reaches the title screen.

The smoke suite at `tests/harness/run.mjs smoke` (7 carts) is the
regression gate.

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
