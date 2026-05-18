# Genericity ↔ perf cost isolation

Active-work item #1 ("Isolate the genericity↔perf cost"). Decomposes
`feat/calcite-genericity` (squashed `a89067a`/local `3592bf0`, 30
files / ~7.5k lines over calcite `ef44f20`) into a verified
per-change perf-impact table.

**Verified 2026-05-18** against the actual diff
(`git diff main feat/calcite-genericity`), the branch's own
`docs/log.md`, and the existing LOGBOOK findings. Not copied from
prose — every row was read in the diff.

## Headline finding (changes the ship-blocker framing)

**The premise "genericity caused the perf drop" is false for the
`feat/calcite-genericity` branch as it stands.** Two independent
facts establish this:

1. **The entire genericity diagnostic stack is default-OFF or
   compile-time by construction.** Every new pattern module
   (`loop_descriptor`, `dispatch_specialise`, `identity_prune`) is
   called *only* from `Evaluator::from_parsed` (cabinet-load time,
   once), and the consuming code paths are env-gated
   (`CALCITE_REP_GENERIC`, `CALCITE_IDENTITY_PRUNE`,
   `CALCITE_SPECIALISE_DIAG`, `CALCITE_LOOP_DIAG`,
   `CALCITE_DISPATCH_RUN_DIAG`) — all default off, all `OnceLock`-
   cached. **Zero new code is wired into the per-tick
   `execute`/`exec_ops` path.** Verified: the only unconditional new
   per-load call is `recognise_loops(&program.assignments)`
   (eval.rs:634), a one-time compile cost, result stored but not
   consumed at runtime.

2. **The one default-ON behavioural change is a WIN.** BIF2 fusion
   (`fuse_diff_slot_bifnel_pairs`) flipped default-off→on
   (compile.rs). Web-bench-verified at **+4.5% throughput / +8%
   in-game fps** (LOGBOOK 2026-05-08 FINDING — the branch log's
   +47%/−31.8% is the *debunked* CLI-bench artefact against a
   regressed 142K baseline; do not quote it).

**The measured regression that the STATUS narrative attributes to
"genericity" is a different branch.** The `apply_input_edges`
per-tick drop (162K→297K t/s when fixed, calcite `a5e8eee`→`6d9e80a`)
lives on the **keyboard** rework (`feat/keyboard-pseudo-input`),
which adds an unconditional per-tick `self.apply_input_edges(state)`
call. `feat/calcite-genericity` does NOT contain it (the
2026-05-18 hand-partition split the `feat/retire-keyboard` bundle so
the per-tick keyboard cost stayed on the keyboard branch). The
`old-kbd` revert (origin `ef44f20`, the `a890e08 default-on BIF2` →
`ef44f20 hardcode BIF2 OFF` pair) was the *keyboard* stack being
thrown away for framerate; BIF2 was collateral, hardcoded off on
`main` to isolate measurement, then correctly re-enabled on the
clean genericity branch.

## The verified table

Impact column: **measured** (a bench number exists), **structural**
(reasoned from the diff — compile-time-only or default-off so
runtime cost is provably ~0), **unknown** (plausibly per-tick,
never benched). Hot-path = runs in `execute`/`exec_ops` per tick by
default.

| # | Change | File(s) | Default-on? | Hot-path? | Perf impact |
|---|---|---|---|---|---|
| 1 | BIF2 fusion default-off→on | compile.rs | **yes** | compile-time pass, affects op stream | **measured: +4.5% tput / +8% fps web** (2026-05-08) |
| 2 | `column_drawer_fast_forward` deleted (~280 lines) | compile.rs | was default-off | n/a (never ran by default) | **structural: 0** (deleting dead-by-default code; log says it was a net loss anyway) |
| 3 | `recognise_loops` + `loop_descriptors` field | eval.rs, compile.rs, loop_descriptor.rs | yes (produces), no (consumes) | **no** — `from_parsed` only, once per load | **structural: ~0 runtime**; one-time compile cost (logged ≪1s on doom8088) |
| 4 | `rep_fast_forward` per-tick validator | compile.rs | no (`CALCITE_REP_GENERIC`) | only when on | **structural: 1 cached-bool branch** when off, gated inside the already-string-op path; "≤8 fires/session" when on |
| 5 | `ranges_overlap_virtual(&State,..)` sig change + `virtual_regions` loop | compile.rs, state.rs | yes | inside `rep_fast_forward` only (not per-tick) | **unknown but structurally negligible**: replaces 2 hardcoded `overlaps()` with 1 + a loop over an empty Vec (doom8088 registers 0 regions; window recogniser would add 1) |
| 6 | `CALCITE_IDENTITY_PRUNE` pass | eval.rs, identity_prune.rs | no | no (`from_parsed`, gated) | **structural: 0** (default off; breaks doom8088 when on — documented) |
| 7 | `CALCITE_SPECIALISE_DIAG` + `count_style_conditions` | eval.rs, dispatch_specialise.rs | no | no (`from_parsed`, gated) | **structural: 0** (default off); when on, compile-only diagnostic |
| 8 | de-x86 comment sweep | eval/compile/state/etc. | n/a | n/a | **0** (comments only) |
| 9 | `calcite-pc-video` crate extraction (render/palette/cp437) | state.rs → new crate | n/a | render is host-side, not per-tick | **structural: 0** (pure code move; wasm-bindgen surface unchanged) |
| 10 | `calcite-debug-summary` crate extraction | new crate, debugger.rs | n/a | debugger-only | **structural: 0** (pure code move) |
| 11 | probe binaries (`probe_specialise`, `probe_bif_predecessor`) | calcite-cli | n/a | separate binaries | **0** (not in the engine) |
| 12 | `loop_descriptor/tests.rs` (1502 lines), other tests | test files | n/a | n/a | **0** (test-only) |
| 13 | `scan_same_key_chain_runs` + `CALCITE_DISPATCH_RUN_DIAG` | compile.rs | no | no (post-`build_dispatch_chains`, gated) | **structural: 0** (default off; compile-time diagnostic) |

## What this means for the ship-blocker

The STATUS "ship-blocker" framing — "genericity hurts perf, work was
thrown away over it" — conflates two branches. Corrected:

- **`feat/calcite-genericity` has no measured or structural per-tick
  regression.** It is net perf-*positive* on `main` (BIF2 win,
  row 1) and otherwise runtime-neutral by construction.
- The genuine perf cost of genericity is **deferred, not incurred**:
  the `rep_fast_forward` *generic applier* (the thing that would let
  the 341-line hardcoded cheat be deleted) was never built — only
  the read-only validator exists. There is no slow generic path on
  the branch to measure, because the replacement path doesn't exist
  yet. Row 4/5 are the only places a future applier would add cost,
  and that cost is **unmeasured because the code isn't written**.
- The only *measured* genericity-adjacent regression
  (`apply_input_edges`) is **keyboard-branch**, already fixed there
  (`6d9e80a`), and **not present on `feat/calcite-genericity`**.

So the real next step is not "find the regression" — there isn't one
on this branch. It is: **build the `rep_fast_forward` generic
applier (active-work #2), and bench *that* against the ±1% gate**,
because that is the only genericity change whose perf cost is
genuinely unknown — and it's unknown because it doesn't exist yet.

## Reproduce

```sh
cd ../calcite
git diff main feat/calcite-genericity -- crates/calcite-core/src/eval.rs
git diff main feat/calcite-genericity -- crates/calcite-core/src/compile.rs
git diff main feat/calcite-genericity -- crates/calcite-core/src/state.rs
git grep -nE "loop_descriptor::|dispatch_specialise::|identity_prune::" \
  feat/calcite-genericity -- crates/calcite-core/src/{eval,compile,lib}.rs
git show feat/calcite-genericity:docs/log.md   # author's own narrative
```

All call sites of the new pattern modules land in `from_parsed`
(compile-time) or behind a default-off `OnceLock` env gate. None in
`execute`/`exec_ops`.
