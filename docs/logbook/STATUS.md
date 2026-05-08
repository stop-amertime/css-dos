# CSS-DOS status

The durable handbook. Auto-loaded by `CLAUDE.md`. Contains everything
a new agent needs to start work — current state, sentinel addresses,
how-to-test pointers, recurring gotchas. Chronological entries live
in [`LOGBOOK.md`](LOGBOOK.md).

## Current state

**Working carts:** zork, montezuma, sokoban, zork-big (2.88 MB),
command-bare, shelltest, smoke set (dos-smoke, hello-text,
cga4-stripes, cga5-mono, cga6-hires). Doom8088 reaches in-game on
**both** web player and calcite-cli. Prince of Persia reaches title
screen.

**Regression gate:** `node tests/harness/run.mjs smoke` (7 carts).

**Architecture:** V4 single-cycle. Every instruction completes in one
CSS tick with a configurable number of memory write slots
(minimum 6; the 3-word-slot scheme is the current default and saves
~6% wall on doom8088 vs the 6-byte scheme).

**Default BIOS:** Corduroy (`bios/corduroy/`). Muslin
(`bios/muslin/muslin.asm`) and Gossamer still available.

## Two-entrypoint testing

| Question                                          | Entrypoint              |
|---------------------------------------------------|-------------------------|
| Did my change break something? Diff vs reference. | `tests/harness/`        |
| How fast does this cabinet boot / load?           | `tests/bench/`          |

See [`docs/TESTING.md`](../TESTING.md) for the full split,
[`docs/script-primitives.md`](../script-primitives.md) for the
watch-spec grammar bench profiles use.

## How to benchmark (canonical)

**Read [`tests/bench/README.md`](../../tests/bench/README.md) before
running any benchmark.** It is the source of truth for the canonical
profile set, the run commands, and the harness contract.

**Three canonical profiles** under `tests/bench/profiles/`:

| Profile | What it measures |
|---|---|
| `compile-only`     | Cabinet → parse → compile time |
| `doom-loading`     | Boot through six stages → in-game (wall ms, ticks) |
| `doom-ingame-fps`  | Steady-state in-game FPS while holding Left |

**The web bench is the source of truth.** Always `--headed`. Headless
Chromium throttles workers and produces meaningless wall-clock times.
The CLI bench is a fast dev-only sanity check — different runtime, no
SW, no `<img>` frame consumer — its numbers do not reflect what the
user feels.

```sh
node tests/bench/driver/run.mjs doom-loading    --headed   # SOURCE OF TRUTH
node tests/bench/driver/run.mjs doom-ingame-fps --headed   # in-game FPS
node tests/bench/driver/run.mjs doom-loading    --target=cli  # dev-only sanity
```

**Current baseline (2026-05-08, old-kbd branch):**
- `doom-loading`: **76 s wall, 34.1 M ticks, 450 K ticks/sec avg**
- `doom-ingame-fps`: **1.45 fps** steady state (29 frames over 20 s,
  after 8 s warmup, holding Left). The first ~4 s after `gamestate=GS_LEVEL`
  are the menu sliding off and view fade-in — the warmup discards them
  so the headline reflects gameplay, not animation.

Quote JSON before/after perf claims. Diagnose with measurement tools,
not by running the player interactively.

For the Doom8088 perf mission (priority leads, success criteria,
where the time is going), see
[`docs/agent-briefs/doom-perf-mission.md`](../agent-briefs/doom-perf-mission.md).
For perf-iteration tooling (snapshots, CS:IP sampling, op
distribution, calcite worktrees), see
[`docs/perf-iteration.md`](../perf-iteration.md). To compose your own
stage detectors, see
[`docs/script-primitives.md`](../script-primitives.md).

## Boot sequence (dos-corduroy)

Generic carts: (1) Mode 13h splash → (2) Text-mode kernel + ANSI
banner → (3) Game.

Doom8088 (six stages, sentinels below):

1. `stage_text_drdos` — kernel banner in 80×25 VRAM
2. `stage_text_doom`  — DOOM init log in VRAM
3. `stage_title`      — mode 13h, title splash
4. `stage_menu`       — `_g_menuactive=1`
5. `stage_loading`    — `_g_usergame=1`, gamestate still GS_DEMOSCREEN
6. `stage_ingame`     — gamestate flips to GS_LEVEL

"Ticks running" ≠ pass — peek the doom globals or use the bench.

## Sentinel addresses (Doom8088)

| Symbol            | Linear  | Notes                                              |
|-------------------|---------|----------------------------------------------------|
| `_g_gamestate`    | 0x3a3c4 | enum: 0=LEVEL 1=INTERMISSION 2=FINALE 3=DEMOSCREEN |
| `_g_menuactive`   | 0x3ac62 | bool                                               |
| `_g_gameaction`   | 0x3ac5e | TRANSIENT (cleared within one game tic)            |
| `_g_usergame`     | 0x3a5af | latches when G_InitNew runs                        |

`_g_gameaction` is the wrong sentinel for stage gating — cleared on
the next G_Ticker, a 250 ms poll usually misses it. `_g_usergame` is
the durable equivalent.

Re-derive on cabinet rebuild from the `.map` file (the offsets shift
with any kiln/builder change that moves data).

## Open work

- **Pre-ship Doom8088 FPS push.** Brief in
  [`docs/agent-briefs/2026-05-07-pre-ship-fps-leads.md`](../agent-briefs/2026-05-07-pre-ship-fps-leads.md).
  **2026-05-08 baseline (old-kbd branch): doom-loading 76 s wall
  (34.1 M ticks, 450 K ticks/sec avg); doom-ingame-fps 1.45 fps
  steady state (8 s warmup + 20 s measurement, holding Left).**
  Earlier wall-clock numbers (161 s @ 2026-05-07, 242 s pre-fix)
  reflect the prior keyboard-genericity stack which has since been
  reverted on this branch.
  Two changes:
  - `apply_input_edges` regression fix (calcite `6d9e80a`):
    lazy slot resolution + group caching + empty-set fast path.
    Recovered the 44 % throughput drop introduced in `a5e8eee`.
    5M-tick raw bench: 162 K → 297 K ticks/sec (+1.83×).
  - BIF2 fusion default-on (calcite `f014d35`): 794 fusions
    covering 13.5 % of dispatched ops, was env-var-gated since
    2026-04-30 wash on a different cabinet.
  ~~Lead #1 (widen `fuse_loadstate_branch`)~~ killed (probe
  `crates/calcite-cli/src/bin/probe_bif_predecessor.rs` shows 0
  static candidates).
  Steady-state in-game FPS measurable via the new
  `doom-ingame-fps` web bench profile (holds Left, hashes the full
  framebuffer to count user-visible frames). Smoke
  7/7 PASS at the current configuration.
- **EMS/XMS for Doom8088 — partial scaffold, inactive.** Corduroy
  hooks INT 2Fh / INT 67h, reserves "EMMXXXX0" magic at BIOS_SEG bytes
  0x0A..0x11. DOOM8088 detects EMS via `open("EMMXXXX0", O_RDWR)`
  (synthesised DOS char device) — still doesn't see it. Doom runs
  with `-noxms -noems -nosound` baked into `program.json` and
  sidesteps. Files: `bios/corduroy/{entry,handlers,bios_init}.{asm,c}`.
- **Memory packing pack=2 vs pack=1.** Native probe converges
  ≥500 K ticks; pack=2 slightly faster. Browser verification pending.
- ~~**Bench harness web target**~~ — done 2026-05-08. Web target
  works end-to-end (`tests/bench/page/index.html` iframes the
  player so `<img src="/_stream/fb">` has a frame consumer; bridge
  has running-guard + watch-preserving `bench-run` so watches don't
  get wiped by `engine.reset()`). Legacy
  `tests/harness/bench-doom-{load,stages,stages-cli,gameplay}.mjs`
  and `web/player/bench.html` deleted.
- **Keyboard input via `:active` — done.** Cabinet CSS emits
  `.cpu { &:has(#kb-X:active) { --keyboard:N } }` per key. Calcite
  parses these into `InputEdge`s and applies them pre-tick from
  host-supplied `(pseudo, selector)` state. The host drives
  `engine.set_pseudo_class_active(pseudo, selector, value)`; the
  SW route is `/_kbd?class=kb-X`; the bench harness uses
  `pseudo_pulse=active,kb-enter,HOLD` watch actions and
  `--press-events=TICK:[+|-]SELECTOR` on calcite-cli. The
  legacy `engine.set_keyboard`, the `?key=0xHHHH` URL form, the
  bridge `'kbd'` message kind, and the `--key-events` CLI flag are
  all gone. Doom8088 cabinet recognises 59 input edges; CLI bench
  reaches in-game at tick 34.65M via the new path (parity with
  the prior `setvar_pulse=keyboard` baseline). See LOGBOOK
  2026-05-06.
- **`rep_fast_forward` is still upstream-aware.** The other four items
  on the calcite-genericity audit list (delete `column_drawer_fast_forward`,
  move `summary.rs`, move CGA renderer to `calcite-pc-video`, strip
  doom/DOS comments) landed 2026-05-05. `rep_fast_forward` is the
  remaining cardinal-rule violation in calcite-core: ~341 lines of
  hardcoded x86 string-op semantics. Mission plan in
  [`docs/plans/2026-05-06-rep-fast-forward-genericity.md`](../plans/2026-05-06-rep-fast-forward-genericity.md)
  — perf-gated (doom8088 web+CLI within ±1%), recogniser must not
  read any character of any slot name.
  - **Phase 1 landed 2026-05-06**: structural recogniser produces
    descriptors on `Evaluator::loop_descriptors`, 9 unit tests pass,
    recognises 6 self-loop opcodes on doom8088 under
    `CALCITE_LOOP_DIAG=1`. Old path still active.
  - **Phase 2 landed 2026-05-07** as diagnostic-bedded validator (path
    B of the in-session re-scope). `CALCITE_REP_GENERIC=1` env-var
    enables a per-tick read-only validator that confirms a descriptor
    exists for every fired opcode with consistent shape. Also:
    `state.virtual_regions` populated by recognisers (replaces
    hardcoded carve-out), memwrite addr/val pairing by assignment-order
    proximity (replaces name-sort heuristic), `loop_descriptors`
    mirrored onto `CompiledProgram`, 10 unit tests pass.
  - **Phase 3a landed 2026-05-07** (recogniser + classification, again
    diagnostic-bedded). `match_ip_stay_or_advance` extended to
    multi-branch IP bodies (CMPS/SCAS shape via kiln's `repCondIP`).
    `BulkClass` enum (`ReadOnly`/`Fill`/`Copy`/`PerIter`) computed
    structurally at descriptor build time. Validator surfaces
    flag_conditioned + bulk_class against runtime expectations.
    On doom8088 the validator now reports 8/8 string opcodes
    recognised: STOS=Fill, CMPS/SCAS=ReadOnly+flag_conditioned (OK),
    MOVS=Fill (DRIFT — cabinet uses `--_strSrcByte` intermediate,
    structurally invisible to pure-shape classifier). 15 unit tests
    pass.
  - Pick up at phase 3b: build the descriptor-driven applier behind
    `CALCITE_REP_GENERIC=1`, replace the hardcoded path, hit ±1%
    perf gate. Open design question: how to handle the MOVS DRIFT —
    either trace through intermediate slots at compile time, or fall
    back to PerIter for shapes the structural classifier can't simplify.

## Model gotchas

- Don't run the player interactively to "check if loaded" — build a
  measurement tool instead.
- Don't trust the visible halt opcode — CPU was redirected upstream;
  trace back.
- Test a suspected primitive in isolation before binary-patching
  downstream.
- A renderer using a "borrow path" (clone extended, scratch state)
  instead of unified-read makes write ports whose CSS sink doesn't go
  through `write_mem` invisible.
- Don't accumulate "defensive" fixes whose root cause you can't
  reproduce.
- `tools/fulldiff.mjs` / `compare-dos.mjs` / `ref-dos.mjs` reference a
  deleted transpiler — use `tests/harness/pipeline.mjs fulldiff`.

