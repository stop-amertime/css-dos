# Pre-ship Doom8088 FPS leads (2026-05-07)

A short brief from a bottleneck survey done in service of the
pre-ship perf push. Goal: get steady-state Doom8088 FPS from ~3 to
4–5+, and keep moving `headline.runMsToInGame` down on the
`doom-loading` profile. **Both targets — boot→ingame and in-game
steady-state — count.** They share some bottlenecks (per-tick op
floor, memwrite gate cost) but not all (level-load is dominated by
the segment-0x55 zone-walk; in-game has its own per-frame redraw
cost on top).

**Audience:** worker agent picking up a perf task before release.
Read [`docs/agent-briefs/doom-perf-mission.md`](doom-perf-mission.md)
first — this brief is a follow-up that points at specific code paths,
not a replacement for the cardinal rules.

## How to measure (canonical)

Per [`docs/TESTING.md`](../TESTING.md) and the perf-mission brief, the
authoritative numbers come from `tests/bench/driver/run.mjs
doom-loading` on **both** targets:

```sh
node tests/bench/driver/run.mjs doom-loading                # web
node tests/bench/driver/run.mjs doom-loading --target=cli   # native
```

Pin the JSON before/after any change. Web and CLI must track each
other within ~10 % on non-throughput metrics — a change that helps
one and hurts the other is a regression.

There is currently **no canonical in-game-FPS profile**. The
`doom-loading` profile halts on `stage_ingame` (first in-game frame).
A new profile that runs N ticks past `stage_ingame` and reports
ticks/sec, cycles/sec, and emitted-frame count would let pre-ship
work measure steady-state FPS the same way it measures load time.
**Adding it is checkpoint 0 of any mission targeting in-game FPS.**

`calcite-bench --profile` (on a pre-built cabinet) is the right tool
for op-distribution diagnostics — it tells you *where* the per-tick
cost is going. It does not produce headline numbers; it complements
the bench harness, doesn't replace it. Use it to pick a target;
use the harness to confirm the target moved.

## Survey snapshot

> ⚠️ **Caveat up front:** the op distribution below is from **cold
> start** (ticks 0–10K, BIOS init / early boot CSS). It is **not**
> from the loading window or steady-state in-game. The 0.8 %
> fusion hit-rate is suggestive — boot is dominated by linear init
> code, which the fuser would catch as easily as game-loop code —
> but the *exact* shape of the unfused chains may differ between
> stages. **Re-profile with `--restore=stage_loading.snap` and
> `--restore=stage_ingame.snap` before committing to any lead's
> design.** A long-warmup `calcite-bench` run (warmup 30M+ ticks)
> didn't fit the 2-minute budget on first attempt; the snapshot-
> restore path is the way in.

Op distribution on `doom8088.css` (cold start, 10K ticks via
`calcite-bench --profile`):

| Op | % of ops | per-tick avg |
|---|---:|---:|
| LoadSlot | 28.3 % | 226 |
| BranchIfNotEqLit | 22.5 % | 180 |
| LoadState | 9.9 % | 79 |
| LoadLit | 7.0 % | 56 |
| DispatchChain | 4.4 % | 35 |
| Add | 3.8 % | 31 |
| LoadPackedByte | 3.5 % | 28 |
| Dispatch | 2.9 % | 23 |
| **LoadStateAndBranchIfNotEqLit** | **0.8 %** | **6** |

Caveats: cold-start (boot CSS), not steady-state. A run with a long
warmup (35M+ ticks → in-game) is the right second measurement; that
profile didn't fit the 2-minute budget on the first attempt and
needs a snapshot-restore flow. **Re-run with
`--restore=in-game.snap` before committing to any of the leads
below.**

The comment at
[`crates/calcite-core/src/compile.rs:6708`](../../../calcite/crates/calcite-core/src/compile.rs)
claims "96 %+ of ops are `LoadStateAndBranchIfNotEqLit`" — that's
**stale**. The real fusion hit-rate is 0.8 %. The unfused
`LoadSlot + LoadState + LoadLit + (Cmp) + Branch` chain dominates
instead.

## Leads, ranked by leverage / risk ratio

### 1. Widen `fuse_loadstate_branch` to match emitted shapes ⭐ top pick

**File:** [`crates/calcite-core/src/compile.rs:3912`](../../../calcite/crates/calcite-core/src/compile.rs).

`fuse_loadstate_branch` only fuses adjacent `LoadState{dst:X};
BranchIfNotEqLit{a:X}` pairs. Kiln emits the comparison through
intermediate slots: typically `LoadSlot → LoadState → LoadLit → CmpEq
→ BranchIfZero` with one or two intervening slot-shuffle ops.

Add fusers for:

- `LoadSlot{dst:X} + LoadLit{dst:Y} + CmpEq{X,Y,...} + BranchIfZero` →
  one fused op
- `LoadState + LoadLit + CmpEq + BranchIfZero` → one fused op
- Allow up to N intervening ops if they don't alias the target slot

Each fusion converts 4 op-dispatches into 1. Going from 0.8 % →
~30 % fusion hit-rate is a flat per-tick speedup that hits **both
the loading window and steady-state in-game** because both are
dominated by the same op floor. Generic — applies to any cabinet
shape, cardinal-rule clean.

**Risk:** low. Each new fuser is independently revertible. Branch-
target safety logic already exists in `fuse_ls_ops`
([line 3938](../../../calcite/crates/calcite-core/src/compile.rs)) —
copy the `is_target` machinery.

**How to validate:**
1. Smoke 7/7 must pass.
2. Re-run `calcite-bench --profile` — fusion hit-rate should rise.
3. Bench harness web + CLI: `headline.runMsToInGame` + a new
   in-game-FPS profile delta. Median of 3.

**Estimated win:** 10–25 % per-tick reduction if fusion hit-rate
reaches ~30 %. Both targets, both stages.

### 2. Memwrite gate-loop empty-tick fast path

**File:** [`crates/calcite-core/src/compile.rs:5666–5692`](../../../calcite/crates/calcite-core/src/compile.rs).

The packed-broadcast-write loop iterates all slots every tick and
gate-checks each. The 2026-04-28 collapse 6→3 already shipped (~6 %
win). Next move: an `any_slot_live` summary slot that the cabinet
writes whenever it stages a write, cleared at the top of the gate
loop. Empty ticks (which dominate steady-state in-game between
redraws) collapse to one branch.

**Risk:** medium — needs the cabinet to maintain the summary slot
correctly, which means a kiln-side change too. Calcite-side
recogniser then folds the summary into the dispatch shape.

**Estimated win:** small per fired-tick cost; cumulative on
idle-frame stages — menu, in-game-steady. Less leverage on
level-load (writes are dense there).

### 3. `apply_input_edges` short-circuit on no-active-pseudo

**File:** [`crates/calcite-core/src/eval.rs:652–690`](../../../calcite/crates/calcite-core/src/eval.rs).

Currently a 59-edge linear scan every tick on doom8088 (per
STATUS.md), with HashMap probes and an O(n²) `acc.iter().any()` on
the inner accumulation. The "cheap when nothing pressed" comment is
not borne out by the code shape.

Add a `state.any_pseudo_active` dirty bit, set by
`set_pseudo_class_active`. When false, `apply_input_edges` does one
load and returns.

**Risk:** trivial. Local change, no cabinet involvement.

**Estimated win:** small but flat — one less per-tick floor cost
across all 29M+ ticks. Probably <2 % on its own, but pairs with
lead #1.

### 4. `tick_no_diff` skip property repopulation when no string ops fired

**File:** [`crates/calcite-core/src/eval.rs:843`](../../../calcite/crates/calcite-core/src/eval.rs).

`tick_no_diff` checks `if !self.string_assignments.is_empty()` and
unconditionally enters the `properties.clear() + populate from
slots` loop if any string assignments exist on the cabinet. Doom8088
likely has some (string properties for text mode, screen state).
Worth checking: do any of them actually fire per-tick, or is this
busywork during gameplay?

If yes, gate the populate loop on a "string_assignments_fired" bit
set by the compiled bytecode when it touches a string-ref'd slot.

**Risk:** medium — needs careful audit that no string assignment
secretly depends on per-tick repopulation. Skip if the audit shows
real dependency.

**Estimated win:** depends entirely on how many properties are
populated and how many string ops actually fire. Measure first.

### 5. `rep_fast_forward` phase 3b applier (already on the books)

**File:** [`crates/calcite-core/src/compile.rs:rep_fast_forward`](../../../calcite/crates/calcite-core/src/compile.rs).

Phase 3a landed today (2026-05-07): all 8 string opcodes
recognised, BulkClass classification on descriptors. Phase 3b flips
the applier — replace the hardcoded x86-aware path with the
descriptor-driven one, with bulk specialisations for
`Fill`/`Copy`/`ReadOnly`. Perf-gated ±1 %.

Most of the win here is **level-load** (segment 0x55 zone-walk is
67.8 % of level-load CPU, much of it REP). Less direct in-game-FPS
impact. But it's already mid-mission, and unblocks future bulk
specialisations that *would* help in-game (e.g. block fills during
sprite blits).

**Risk:** medium — perf gate is tight, MOVS DRIFT issue is open
(see logbook 2026-05-07). Already scoped, just needs the next
session.

**Estimated win:** primarily moves `headline.runMsToInGame` (load
window). Secondary gain in-game depends on whether REPs fire there.

## Leads I'd not chase pre-ship

- **Affine self-loop fast-forward**
  ([`docs/plans/2026-05-01-affine-loop-fastforward.md`](../plans/2026-05-01-affine-loop-fastforward.md))
  — high theoretical payoff, but the `column_drawer_fast_forward`
  post-mortem (deleted 2026-05-05) showed per-tick detection cost
  eats the gain unless detection is fully compile-time. Large surface
  area for the deadline.
- **Trace-tier execution** (perf-tricks-breakdown #1) — months of
  work, deopt complexity, ship-irrelevant.
- **Mixed packing factors per zone** (#3) — bookkeeping cost not
  worth it for a few-FPS win.
- **Renderer/bridge tile-damage tracking** (#9) — the perf-mission
  brief is explicit that the bridge isn't the doom8088 bottleneck on
  either target. Wins land elsewhere.

## Suggested order of work

0. **Add a steady-state in-game-FPS bench profile.** New profile
   under `tests/bench/profiles/doom-ingame.mjs`: snapshot-restore
   from a captured `stage_ingame.snap`, run N ticks, report
   ticks/sec, cycles/sec, emitted-frame count. Without this, lead
   wins on in-game can only be inferred, not measured. Both
   targets.

1. **Lead #1 — widen `fuse_loadstate_branch`.** Highest leverage,
   lowest risk, hits both stages and both targets. One peephole pass
   per chain shape, smoke + bench gate each.

2. **Lead #3 — `apply_input_edges` short-circuit.** Trivial, lands
   while #1 is being measured.

3. **Lead #4 — `tick_no_diff` audit.** Read first, change only if
   the audit says it's safe.

4. **Lead #2 — memwrite gate empty-tick fast path.** Bigger surface
   (kiln + calcite). Defer until #1 numbers are in.

5. **Lead #5 — finish phase 3b** if the in-game profile shows
   significant REP time, otherwise punt to post-ship.

Each step independently revertible. Each step bench-gated against
both targets, smoke-gated, logbook entry with JSON before/after.
Stop when the user-experience criteria in
[`doom-perf-mission.md`](doom-perf-mission.md) § "What success
looks like" are met.

## Cardinal-rule check

All five leads operate on CSS shape only. None look at x86 opcodes,
DOS structures, BIOS calls, or Doom-specific addresses. Lead #1's
fusers fire on any cabinet whose emitter produces the shape; lead
#2's `any_slot_live` summary is structural; lead #3's pseudo-active
bit is host-state. Calcite stays general-purpose.
