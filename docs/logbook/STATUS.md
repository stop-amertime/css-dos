# CSS-DOS status

The one doc you must read before working. Auto-loaded by `CLAUDE.md`.
Current state, the release bar, sentinels, active work, gotchas.
History → [`LOGBOOK.md`](LOGBOOK.md). Forward task detail → the
relevant file in `../plans/`.

Every factual claim here is meant to be verified against code/git,
not copied from prose. If you find a contradiction, fix it here
first, then log it. Last verified: 2026-06-10.

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
5. **doomLoad kernel-side characterisation** — NEW 2026-06-09. Half
   of doomLoad ticks are the DOS kernel's file-I/O loops — platform
   work, no cardinal rule. Also queued from the same analysis:
   calcite copy-elimination (36% of dispatched ops are moves; calcite
   log 2026-06-09). LOGBOOK 2026-06-09 ×2 for both findings.

## Git state (verified 2026-06-10)

- **CSS-DOS** `master`: pending commit for the 2026-06-10 docs
  (logbook/STATUS/plan deletion). Pre-existing untracked
  `broken-session-transcript.txt` and modified
  `web/prebake/{corduroy,gossamer}.meta.json` are NOT from this
  session — left untouched for owner triage.
- **calcite** `main` == `origin/main` == **`92af379`** (log entry on
  top of merge `cc729b2`, which lands `feat/rep-generic` — the
  rep_fast_forward cheat removal + merge-review fixes; see
  ship-blocker section). Branch `feat/rep-generic` (`b2dc52d`, on
  origin) is now merged; its worktree
  `calcite/.claude/worktrees/rep-generic` is clean.
- Genericity work safe on `origin/feat/calcite-genericity`
  (`3592bf0`); keyboard rework on
  `origin/feat/keyboard-pseudo-input` (`baf3086`); both
  byte-identical local↔origin. `feat/retire-keyboard` (`a05d85c`)
  retained intact, also on origin.
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

## Perf baseline (2026-05-08, web `--headed`, 3-run doom-all median)

| Phase | Wall | | Phase | Wall |
|---|--:|---|---|--:|
| compile | 27.8 s | | doomLoad | **68.5 s** |
| dosBoot | 9.0 s | | engine-run total | **79.7 s** |
| title+menu | 3.1 s | | throughput | 423 K t/s |

Steady-state FPS: fuzzy **~1-2 fps** band (±2× run noise — never
quote a single FPS number). Wall and ticks/sec are stable to ±3%.
**doomLoad is ~85% of engine-run — perf attention belongs there.**
BIF2 fusion is a real but modest +4-8% web win (the 2026-05-07
+47% figure was a CLI-bench artefact against a regressed baseline —
do not quote it).

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
