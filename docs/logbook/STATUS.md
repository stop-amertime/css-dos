# CSS-DOS status

The one doc you must read before working. Auto-loaded by `CLAUDE.md`.
Current state, the release bar, sentinels, active work, gotchas.
History → [`LOGBOOK.md`](LOGBOOK.md). Forward task detail → the
relevant file in `../plans/`.

Every factual claim here is meant to be verified against code/git,
not copied from prose. If you find a contradiction, fix it here
first, then log it. Last verified: 2026-06-11.

## Release bar (what "done" means)

1. **Calcite must be generic — the gate.** No upstream knowledge in
   calcite (no x86 / DOS / Doom / cabinet awareness). This is the
   non-negotiable ship condition.
2. **Performance — improve if possible, NOT a gate.** Faster is
   better; slow-but-honest ships, fast-but-cheating does not.

These two fight each other, and that tension *was* the project's
central problem. As of 2026-06-10 the gate is met for the rep path
(see below); the tension still applies to every future optimisation.

## The ship-blocker — RESOLVED 2026-06-10

**The rep_fast_forward cheat is gone from calcite `main`.** Merge
`cc729b2` (pushed) deletes the ~341-line hardcoded x86 string-op
table; the post-tick dispatcher routes purely through the structural
recogniser (`pattern/loop_descriptor.rs`) → `BulkClass` appliers
(`pattern/rep_applier.rs`). Before merging, the 2026-06-09 review
warts were fixed (`b2dc52d`): IP/cycle commits go through
descriptor-carried names (`ip_property`, `CycleCharge.property` —
no literal "IP"/"cycleCount"), dispatch routing uses each
descriptor's `key_property` (no literal `--opcode`), and the
panic/diag tables are descriptor-driven (x86 opname decode deleted).
**Zero literal cabinet-property names remain in the generic rep
path** — a `--pc_y`/`--zorch`-named cabinet commits to its own slots
(tested).

**Verification.** Pre-merge on the branch: 288 unit tests;
calcite-cli A/B vs main **byte-identical** (cycles+IP, 7 smoke carts
× 2M ticks); smoke 7/7; 3-run `doom-all --headed` medians **+0.50%
wall / −1.49% t/s / +0.85% doomLoad** vs fresh main baseline (inside
gate/noise; JSONs `docs/benches/doom-all-2026-06-09-*`). Post-merge
from `main`: 288 tests, smoke 7/7, doom8088 title via fast-shoot
@6M ticks.

**Remaining genericity residue (tracked, NOT active cheats):**
`column_drawer_fast_forward` + `COLUMN_DRAWER_BODY` (~280 lines of
upstream-knowledge code in compile.rs) is **default-off** (env
`CALCITE_FUSION_FASTFWD`, disabled 2026-04-29 as a perf net-loss,
hard-`false` on wasm) — dead code queued for deletion. LODS-shape
`Full` commit refuses loudly (accumulator not modelled; unreached by
any current cart, proven by the A/B).

## Active work (detail in `../plans/`; done/dead → LOGBOOK only)

1. **Delete `column_drawer_fast_forward` dead code** — ~280 lines of
   default-off upstream-knowledge code in calcite `compile.rs`
   (`CALCITE_FUSION_FASTFWD` gate, disabled 2026-04-29 as a perf
   net-loss). Never runs; deleting it removes the last x86-aware
   code block from calcite. Small, supervised-cleanup-sized.
3. **Per-dispatch-key specialisation** — structurally upstream of
   all perf work; probed on the branch 2026-05-12 (not on `main`).
   Plan: `../plans/2026-05-12-per-dispatch-key-specialisation.md`.
4. **`__I4D` routine substitution** — DEPRIORITISED 2026-06-09: the
   46% figure was guest-cycle-weighted; by ticks (= calcite wall)
   `__I4D` is ~22% and the **EDR-DOS kernel is ~49% of doomLoad**.
   Plan (correction note added):
   `../plans/2026-05-12-routine-semantic-substitution.md`.
5. **doomLoad kernel side — RESOLVED 2026-06-11.** Characterised to
   EDR-DOS routine level (`fatptr` FAT chain walk = 21% of doomLoad
   alone) and fixed via new `disk.sectorsPerCluster` cart option
   (doom8088 → 32, 16K clusters): **doomLoad ticks −68.7%
   (29.55M→9.25M), web 59.6→19.1 s** (LOGBOOK 2026-06-11).
   Follow-ups: apply to zork-big / prince-of-persia; remaining
   per-read syscall overhead (fdrw div64s, deblock copies).

## Git state (verified 2026-06-10)

- **CSS-DOS** `master`: clean except the 2026-06-10/11 perf docs +
  bench-JSON commits. Pre-existing untracked
  `broken-session-transcript.txt` and modified
  `web/prebake/{corduroy,gossamer}.meta.json` are NOT from these
  sessions — left untouched for owner triage.
- **calcite** `main` == `origin/main` == **`854867d`** (short dense
  dispatch chains `f2c8615` + log, on top of `9ecc6de` — copy-elim
  pass `967ddad` + its wasm compile-cost fix, on top of `92af379` /
  merge `cc729b2` which landed `feat/rep-generic` — the
  rep_fast_forward cheat removal + merge-review fixes; see
  ship-blocker section). Branch `feat/rep-generic` (`b2dc52d`, on
  origin) is now merged; its worktree
  `calcite/.claude/worktrees/rep-generic` is clean.
- Genericity work safe on `origin/feat/calcite-genericity`
  (`3592bf0`), byte-identical local↔origin. The keyboard rework
  commit `baf3086` (:active pseudo-input model) is an ancestor of
  calcite `main` — verified 2026-06-12; the old
  `feat/keyboard-pseudo-input` branch no longer exists.
  `feat/retire-keyboard` (`a05d85c`) retained intact, also on
  origin. The player-side full keyboard UI, lost in the 2026-05
  reverts, was restored 2026-06-12 (LOGBOOK).
- **No loss risk remaining (as of 2026-05-18):** the only at-risk
  branches `calcite-v2` (`432c131`) / `calcite-v2-rewrite`
  (`3745e3c`) — dead compiler-rewrite experiments — were pushed to
  `origin/archive/calcite-v2{,-rewrite}`. Everything else local is a
  stale pointer to already-merged work.
- **Deferred git cleanup (NOT done — needs owner triage):** 7 calcite
  worktrees under `.claude/worktrees/` each have uncommitted changes
  (2–33 files); pruning any destroys that work. `worktree-rep-3b`
  (`645f497`, on `origin/worktree-rep-3b`) was an alternative
  rep_fast_forward phase-3b applier — **superseded by the 2026-06-10
  merge** of `feat/rep-generic`; now a pruning candidate, but the
  stale worktree/branch removal is its own supervised task, not a
  docs-session action.
- Pre-existing base debt: `ef44f20`'s calcite lib-*test* target
  fails to compile (`script.rs` `Stride{every,last_fired_at}` vs
  `script_spec.rs:309` `Stride{every}`). `cargo build` is green;
  only `cargo test` surfaces it. Keyboard branch incidentally fixes
  it; genericity branch inherits it.

## Working state

**Working carts:** zork, montezuma, sokoban, zork-big (2.88 MB),
command-bare, shelltest, smoke set. Doom8088 in-game on web + cli.
Prince of Persia → title screen.

**Regression gate:** `node tests/harness/run.mjs smoke` (7 carts).

**Architecture:** V4 single-cycle, one instruction per CSS tick,
3-word-slot scheme default. Default BIOS: Corduroy.

## Perf baseline (2026-06-11, web `--headed`, doom-all)

Post FAT-cluster fix (`disk.sectorsPerCluster: 32` for doom8088,
LOGBOOK 2026-06-11). Single healthy-host run
(`docs/benches/doom-all-2026-06-11-spc32-run1.json`); the host
flapped healthy↔3×-degraded that day, so a clean 3-run median is
still owed — but ticks are deterministic (boot→ingame 13.5–13.7M on
every run/transport) and within-state wall pairs agree to ±1%.

| Phase | Wall | | Phase | Wall |
|---|--:|---|---|--:|
| compile | ~27 s¹ | | doomLoad | **19.1 s** |
| dosBoot | 7.8 s | | engine-run total | **28.6 s** |
| title+menu | 1.6 s | | throughput | 478 K t/s |

¹ Web compile wall drifts day-to-day; only runtime metrics are
cross-day comparable. History: 2026-06-10 baseline (pre-cluster-fix)
70.5 s / 477 K / doomLoad 60.8 s; 2026-06-09 75.0 s / 456 K / 63.65;
2026-05-08 79.7 s / 423 K / 68.5. The 2026-06-11 short-dense-chains
calcite change (~+3–5% t/s) is also in these numbers.

Steady-state FPS: fuzzy **~1-2 fps** band (±2× run noise — never
quote a single FPS number). Wall and ticks/sec are stable to ±3%
when the host is healthy (it ran 3×-degraded for stretches of
2026-06-10/11 — sanity-check ticks/s before trusting any wall).
**doomLoad is now ~67% of engine-run** (was 86%); the rest of it is
per-read syscall overhead + Doom's own load code. BIF2 fusion is a
real but modest +4-8% web win (the 2026-05-07 +47% figure was a
CLI-bench artefact against a regressed baseline — do not quote it).

Quote 3-run web medians for any perf claim. Required reading before
benching: [`tests/bench/README.md`](../../tests/bench/README.md)
(canonical profiles, the `--headed` rule, the "why FPS is noisy"
rule). Check no other agent is benching first — concurrent benches
make both runs' numbers garbage.

## Boot sequence + sentinels (Doom8088)

Stages: `text_drdos` → `text_doom` → `title` → `menu`
(`_g_menuactive=1`) → `loading` (`_g_usergame=1`) → `ingame`
(`_g_gamestate=GS_LEVEL`). "Ticks running" ≠ pass — peek the globals
or use the bench.

| Symbol | Linear | Notes |
|---|---|---|
| `_g_gamestate` | 0x3a3c4 | 0=LEVEL 1=INTER 2=FINALE 3=DEMOSCREEN |
| `_g_menuactive` | 0x3ac62 | bool |
| `_g_usergame` | 0x3a5af | latches at G_InitNew (durable signal) |
| `_g_gameaction` | 0x3ac5e | TRANSIENT — wrong sentinel for gating |

Re-derive from the `.map` on any kiln/builder rebuild — offsets
shift with anything that moves data.

## Gotchas

- Don't run the player interactively to "check if loaded" — build or
  use a measurement tool.
- Don't trust the visible halt opcode — the CPU was redirected
  upstream; trace back.
- Test a suspected primitive in isolation before binary-patching
  downstream.
- A renderer on a "borrow path" (clone extended, scratch state)
  makes write ports whose CSS sink bypasses `write_mem` invisible.
- Don't accumulate defensive fixes whose root cause you can't
  reproduce.
- `tools/fulldiff.mjs` / `compare-dos.mjs` / `ref-dos.mjs` reference
  a deleted transpiler — use `tests/harness/pipeline.mjs fulldiff`.
- Docs claiming work "landed" may mean *on a branch*, not on `main`.
  Verify against code/git before trusting a status claim.
