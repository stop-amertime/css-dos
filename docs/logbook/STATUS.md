# CSS-DOS status

The one doc you must read before working. Auto-loaded by `CLAUDE.md`.
Current state, the release bar, sentinels, active work, gotchas.
History → [`LOGBOOK.md`](LOGBOOK.md). Forward task detail → the
relevant file in `../plans/`.

Every factual claim here is meant to be verified against code/git,
not copied from prose. If you find a contradiction, fix it here
first, then log it. Last verified: 2026-06-09.

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

**The genericity↔perf cost is isolated AND empirically benched
(2026-05-18,
`../plans/2026-05-18-genericity-perf-cost-isolation.md`): there is
no regression on `feat/calcite-genericity`.** Measured, not argued:
one `doom-all --headed` run on `3592bf0` vs the on-disk
`ef44f20`/BIF2-off baseline — genericity is **75.9 s / 448.5K t/s /
doomLoad 64.8 s** vs baseline **77–82 s / 416–443K / 65–70 s**, i.e.
at or below the *fastest* baseline run on every metric. (Prior
LOGBOOK perf numbers were treated as untrusted; this conclusion
rests on the fresh bench, JSON in `../benches/`.) Static analysis
agrees: every new pattern module
(`loop_descriptor`/`dispatch_specialise`/`identity_prune`) is called
*only* from `from_parsed` (compile-time) or behind a default-off
`OnceLock` gate — nothing in `execute`/`exec_ops`. The
`apply_input_edges` regression STATUS used to attribute here is a
**keyboard-branch** per-tick cost (`feat/keyboard-pseudo-input`),
not present on this branch; the `old-kbd` revert threw away the
*keyboard* stack, not this one.

**Honest summary (updated 2026-06-09):** the applier is now **built,
correct, and verified on the branch** (calcite `feat/rep-generic`
`17fe7da`, pushed). The 2026-06-08 "one recogniser gap" was five
layered defects (subtrahend capture, mirror-name routing, missing
continuation gate, source-base scaling, silent flags commit) — all
fixed with shape-true tests. Verified: smoke **7/7**; calcite-cli A/B
vs `main` **byte-identical** (cycles+IP, all 7 smoke carts × 2M
ticks); 3-run `doom-all --headed` medians **+0.50% wall / −1.49% t/s /
+0.85% doomLoad** vs a fresh main baseline (t/s inside the ±3% run
noise; JSONs in `docs/benches/doom-all-2026-06-09-*`). The blocker has
moved from "built, broken" to **"verified on branch — merge to calcite
main is the remaining step"** (plus the merge-review warts in calcite
log 2026-06-09: hardcoded "IP"/"cycleCount" commit names, `--opcode`
diagnostic reads, LODS loud hole).

## Active work (detail in `../plans/`; done/dead → LOGBOOK only)

1. **`rep_fast_forward` generic applier — VERIFIED ON BRANCH
   2026-06-09; remaining step is the merge.** Calcite
   `feat/rep-generic` `17fe7da` (pushed) deletes the 341-line x86
   table and routes purely through `LoopDescriptor` → `BulkClass`.
   Smoke 7/7; A/B vs main byte-identical (7 carts × 2M ticks); bench
   +0.5% wall / −1.5% t/s (inside noise). Remaining: merge review on
   calcite (warts listed in calcite log 2026-06-09 — hardcoded
   "IP"/"cycleCount" commit names should become descriptor fields,
   `--opcode` diagnostic reads, LODS Full-commit loud hole), then
   merge to calcite `main` and re-run smoke + a doom spot-check from
   main. Plan: `../plans/2026-05-06-rep-fast-forward-genericity.md`.
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

## Git state (verified 2026-06-09)

- **CSS-DOS** `master`: pending commit for this 2026-06-09 work
  (logbook/STATUS/plans + `docs/benches/doom-all-2026-06-09-*`).
  Pre-existing untracked `broken-session-transcript.txt` and modified
  `web/prebake/{corduroy,gossamer}.meta.json` are NOT from this
  session — left untouched for owner triage.
- **calcite** `main` == `origin/main` == **`2fe54c6`** (docs/log
  commits on top of `8de61a8`; code unchanged since the keyboard
  merge).
- **calcite `feat/rep-generic` (`17fe7da`, on origin)** — the
  rep_fast_forward cheat removal, now **verified** (smoke 7/7,
  byte-identical A/B, bench within gate — see ship-blocker section).
  Branched from `8de61a8`. Its worktree
  `calcite/.claude/worktrees/rep-generic` is clean (work committed).
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
