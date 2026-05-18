# CSS-DOS status

The one doc you must read before working. Auto-loaded by `CLAUDE.md`.
Current state, the release bar, sentinels, active work, gotchas.
History → [`LOGBOOK.md`](LOGBOOK.md). Forward task detail → the
relevant file in `../plans/`.

Every factual claim here is meant to be verified against code/git,
not copied from prose. If you find a contradiction, fix it here
first, then log it. Last verified: 2026-05-18.

## Release bar (what "done" means)

1. **Calcite must be generic — the gate.** No upstream knowledge in
   calcite (no x86 / DOS / Doom / cabinet awareness). This is the
   non-negotiable ship condition.
2. **Performance — improve if possible, NOT a gate.** Faster is
   better; slow-but-honest ships, fast-but-cheating does not.

These two fight each other, and that tension *is* the project's
central problem — not a side issue. See "The ship-blocker" below.

## The ship-blocker (verified 2026-05-18)

**`main` still cheats.** `rep_fast_forward` in
`crates/calcite-core/src/compile.rs` is ~341 lines of hardcoded x86
string-op semantics. On calcite `main` (`ef44f20`) there is **no
generic path at all** — verified: `CALCITE_REP_GENERIC`,
`discover_hot_key`, `dispatch_specialise` have **zero references on
`main`**.

The generic work exists **only on the unmerged branch
`feat/calcite-genericity`** (one squashed commit `a89067a` over
`ef44f20`; also in the un-split `feat/retire-keyboard` bundle). What
it actually contains: a structural recogniser + a **read-only
diagnostic validator** behind `CALCITE_REP_GENERIC=1` (default off).
**The replacement applier that would let the hardcoded cheat be
deleted was never built — it was explicitly deferred** (branch
`docs/log.md` line 280: the ±1% perf gate "is deferred to a future"
phase).

**The perf cost of genericity is real in aggregate but never
isolated.** The earlier keyboard-genericity stack was *reverted*
(not fixed) via the `old-kbd` merge specifically to recover
framerate — so "genericity hurts perf" is true enough that work was
thrown away over it. But **no one has measured which specific
genericity change costs what.** The one regression that was actually
*fixed* (not reverted) is the separate keyboard `apply_input_edges`
drop (calcite `a5e8eee` → `6d9e80a`, 162K→297K t/s) — a different
concern from `rep_fast_forward`. The generic `rep_fast_forward`
applier has never been benched because it does not exist.

**Honest summary:** the blocker is not "make the slow generic path
fast." It is "**the generic replacement was never finished, it is
unmerged, and the per-change perf cost of genericity has never been
isolated.**" Isolating it is the named next investigation (below).

## Active work (detail in `../plans/`; done/dead → LOGBOOK only)

1. **Isolate the genericity↔perf cost** — THE unblocking task.
   Decompose `feat/calcite-genericity`'s squashed diff (30 files,
   ~7.5k lines over `ef44f20`) + its 835-line `docs/log.md` into a
   verified table: each genericity change → perf impact
   (measured / assumed / unknown), hot-path or not. Output is what
   lets the ship-blocker framing above become concrete. *No plan
   file yet — write one when picked up.*
2. **`rep_fast_forward` generic applier** — the actual cheat removal.
   Recogniser + validator exist on the branch; the perf-gated
   applier (±1%, must replace the hardcoded path) was deferred,
   never built. Plan: `../plans/2026-05-06-rep-fast-forward-genericity.md`
   (note: its "phases 1–3a landed" status is branch-only, not on
   `main`).
3. **Per-dispatch-key specialisation** — structurally upstream of
   all perf work; probed on the branch 2026-05-12 (not on `main`).
   Plan: `../plans/2026-05-12-per-dispatch-key-specialisation.md`.
4. **`__I4D` routine substitution** — 46% of doomLoad cycles
   (2026-05-11 cycle-weighted heatmap). Pure plan, no code anywhere.
   Plan: `../plans/2026-05-12-routine-semantic-substitution.md`.

## Git state (verified 2026-05-18)

- **CSS-DOS** `master`: clean, in sync with origin (1 local logbook
  commit).
- **calcite** `main` == `origin/main` == `ef44f20`. No divergence,
  no force-push pending. The 2026-05-15 history rewrite has already
  been reconciled with origin.
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
  (`645f497`, on `origin/worktree-rep-3b`) is **live ship-blocker
  work** (rep_fast_forward phase 3b applier), NOT stale — do not
  prune. The stale worktree/branch removal is its own supervised
  task, not a docs-session action.
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
