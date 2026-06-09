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

**Honest summary (updated 2026-06-08):** the applier now EXISTS
(calcite `feat/rep-generic` `247b274`, recovered 2026-06-08) and
deletes the hardcoded cheat — but it is **not yet correct on real
cabinets**: smoke 6/7 panic because the recogniser doesn't capture
`ip_extra_advance_slot` for the `_repContinue`-gated per-key IP shape.
So the blocker has moved from "never built" to "built, recogniser gap
remains; perf cost still unmeasured because it can't clear smoke yet."
Fix the recogniser shape (active-work #1), pass smoke 7/7, THEN bench.

## Active work (detail in `../plans/`; done/dead → LOGBOOK only)

1. **`rep_fast_forward` generic applier** — THE unblocking task and
   the actual cheat removal. **UPDATE 2026-06-08: the applier WAS
   built** (recovered from a wedged 2026-05-29 session, now committed
   `247b274` + pushed on calcite `feat/rep-generic`). It deletes the
   341-line x86 table and routes purely through `LoopDescriptor` →
   `BulkClass`. Unit-green, all binaries build — **but smoke 6/7
   PANIC**: the recogniser's `extract_ip_extra_advance_slot` models
   IP-advance as top-level `Add(dispatch, prefixLenVar)` while real
   cabinets encode a per-opcode `_repContinue`-gated body
   (`IP − prefixLen` during REP, `IP + 1` after). The unit tests
   hand-build the *wrong* shape → false-green. **Remaining: teach the
   recogniser that gated-subtraction shape, then smoke 7/7 + ±1% perf
   bench (neither passed — branch-only, NOT landed).** Full analysis:
   calcite `docs/log.md` 2026-06-08 + LOGBOOK
   2026-06-08. Plan: `../plans/2026-05-06-rep-fast-forward-genericity.md`.
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

## Git state (verified 2026-06-08)

- **CSS-DOS** `master`: clean except pending logbook/STATUS commit for
  this 2026-06-08 work.
- **calcite** `main` == `origin/main` == **`8de61a8`** (advanced past
  the old `ef44f20` baseline — the keyboard branch
  `feat/keyboard-pseudo-input` merged in; older STATUS revisions that
  say `main == ef44f20` are stale).
- **NEW: calcite `feat/rep-generic` (`247b274`, on origin)** — the
  recovered rep_fast_forward cheat-removal dispatcher. Branched from
  `8de61a8`. Unit-green, builds, but smoke 6/7 panic (recogniser gap,
  active-work #1). Its worktree
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
