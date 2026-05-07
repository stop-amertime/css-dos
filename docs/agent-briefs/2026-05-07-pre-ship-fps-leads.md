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

Op distribution on `doom8088.css`, three windows, 200K ticks each
via `calcite-bench --restore … --profile` against fresh snapshots
captured at `stage_loading` (tick 5.1M) and `stage_ingame` (tick
34.65M):

| Op | Cold start | Loading | In-game |
|---|---:|---:|---:|
| LoadSlot | 28.3 % | 28.5 % | 28.2 % |
| BranchIfNotEqLit | 22.5 % | 20.8 % | 21.4 % |
| LoadState | 9.9 % | 10.1 % | 10.1 % |
| LoadLit | 7.0 % | 7.6 % | 7.4 % |
| DispatchChain | 4.4 % | 4.4 % | 4.4 % |
| Add | 3.8 % | 3.8 % | 3.8 % |
| LoadPackedByte | 3.5 % | 3.4 % | 3.4 % |
| Dispatch | 2.9 % | 3.0 % | 3.0 % |
| **LoadStateAndBranchIfNotEqLit** | **0.8 %** | **0.8 %** | **0.7 %** |
| ns/linear-op | 56.0 | 52.9 | 43.1 |
| Dispatch sub-ops (avg) | 9 | **177** | 34 |

**Op mix is virtually identical across all three stages.** Lead #1
(widening `fuse_loadstate_branch`) lands the same percentage win in
each window. The fusion hit-rate of 0.8 % is real and
stage-independent — the comment at
[`crates/calcite-core/src/compile.rs:6708`](../../../calcite/crates/calcite-core/src/compile.rs)
claiming "96 %+ of ops are `LoadStateAndBranchIfNotEqLit`" is
**stale**.

What does change between stages is the **dispatch sub-op weight**:
loading runs 177 sub-ops per `Dispatch` on average vs 34 in-game
and 9 at boot. That's the segment-0x55 zone-walk path going
through a large-bodied dispatch entry; lead #5 (REP fast-forward
phase 3b + bulk specialisations) targets this directly. In-game
sub-op count of 34 is closer to boot than to loading — game-loop
dispatch fan-out is moderate.

In-game `ns/linear-op` of 43.1 ns is the fastest of the three —
likely cache-warm on a smaller hot working set. The per-tick op
count is essentially constant (795–801), so any flat win on the op
floor (lead #1) is what moves both `headline.runMsToInGame` and
steady-state in-game FPS.

Snapshots used: `tmp/perf-snaps/stage_loading.snap`,
`tmp/perf-snaps/stage_ingame.snap` — captured 2026-05-07 against
the current `doom8088.css` (size 332 MB, May 1 build). Regenerate
on any cabinet rebuild — slot ordering is parse-dependent, an old
snapshot will fail to restore with a length mismatch. Recipe:

```sh
calcite-cli -i doom8088.css --speed=0 --ticks=80000000 \
  --watch "poll:stride:every=50000" \
  --watch "title:cond:0x3ac62=0,0x3a3c4=3,0x449=0x13:gate=poll:then=emit" \
  --watch "title_tap:cond:0x3ac62=0,0x3a3c4=3,0x449=0x13,repeat:gate=poll:then=pseudo_pulse=active,kb-enter,50000" \
  --watch "menu:cond:0x3ac62=1:gate=poll:then=emit" \
  --watch "menu_tap:cond:0x3ac62=1,repeat:gate=poll:then=pseudo_pulse=active,kb-enter,50000" \
  --watch "loading:cond:0x3a5af=1,0x3a3c4=3:gate=poll:then=emit+snapshot=tmp/perf-snaps/stage_loading.snap" \
  --watch "ingame:cond:0x3a5af=1,0x3a3c4=0:gate=poll:then=emit+snapshot=tmp/perf-snaps/stage_ingame.snap+halt"
```

Wall: ~3.5 minutes from cold to in-game on calcite-cli.

## Leads, ranked by leverage / risk ratio

### 1. ~~Widen `fuse_loadstate_branch` to match emitted shapes~~ — DEAD LEAD

**Status:** investigated 2026-05-07; **no opportunity exists**. Probe
[`crates/calcite-cli/src/bin/probe_bif_predecessor.rs`](../../../calcite/crates/calcite-cli/src/bin/probe_bif_predecessor.rs)
classifies the predecessor of every isolated `BranchIfNotEqLit` in
the post-compile op stream. On `doom8088.css`:

- Total isolated BIfNELs: 80,118 (after `fuse_cmp_branch` and
  `build_dispatch_chains` and the existing `fuse_loadstate_branch`).
- BIfNELs with a `LoadState{dst:X}` within a 16-op backward
  basic-block-bounded scan: **0**.
- Predecessor-op breakdown: **97.3 % `Jump`**, 1.7 %
  `BranchIfNotEqLit`, 0.2 % `LoadSlot`, 0.1 % `LoadLit`. No
  `LoadState`.

Why: `fuse_cmp_branch` already collapses
`LoadLit + CmpEq + BranchIfZero` triplets into `BranchIfNotEqLit`,
so the static residue is dominated by chain-miss exits laid out as
`...; Jump <chain entry body>; BranchIfNotEqLit <next-test miss>; ...`.
The BIfNEL is reached *as a jump target* from elsewhere — not via
the `Jump` at i-1 — so the LoadState that originally fed it has
been folded away or is on a different basic block.

The brief's earlier hypothesis (LoadState separated from its branch
by intervening slot-shuffle ops) was based on the stale
`compile.rs:6708` comment, not on the current emitter shape. The
0.8 % `LoadStateAndBranchIfNotEqLit` runtime hit-rate is the *real
ceiling* under the present chain-pass + fuse_cmp_branch interaction,
not a knob waiting to be widened.

A widened scan implemented and tested 2026-05-07 (`LS_WINDOW=8`,
non-aliasing intervening ops) found exactly the same 50 fusions as
the adjacent-only path. The compiled cabinet has zero additional
candidates. Reverted.

**Where the leverage actually was.** Two findings on 2026-05-07:

1. **`BIfNEL → BIfNEL` adjacency** is 13.5 % of *dispatched* ops at
   runtime (measured via `calcite-cli --restore <snap> --op-profile`,
   not just the 1,395 static pairs). `fuse_diff_slot_bifnel_pairs`
   was already implemented but env-var-gated since a 2026-04-30
   reference-cabinet measurement was net wash. Re-measured on
   doom8088: 794 fusions, +47 % throughput, –32 % wall on
   doom-loading. **Default-on as of calcite [`f014d35`](https://github.com/stop-amertime/calcite/commit/f014d35).**

2. **Real lead #3 exists, was undersized.** `apply_input_edges`
   in calcite commit `a5e8eee` added per-tick work proportional
   to the cabinet's input-edge count (59 on doom8088): string
   allocs, HashMap probes, O(n²) acc scan, plus 2 string allocs
   per `pseudo_class_active` lookup. Net 44 % throughput
   regression vs pre-input-edge baseline — *not* the "<2 %" the
   brief originally estimated. Fixed in calcite [`6d9e80a`](https://github.com/stop-amertime/calcite/commit/6d9e80a)
   with lazy compile-once group caching + empty-set fast path.
   Recovers + slightly exceeds pre-regression performance.

The 80,118 pure BIfNELs are the floor we'd want to cut next, but
each candidate fuse needs a shape that doesn't exist in the static
stream. Remaining leverage is in leads #2 / #4 / #5.

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

1. ~~Lead #1.~~ Dead — see status note above. Skip.

2. ~~Lead #3.~~ ✅ Landed in calcite `6d9e80a`. The `apply_input_edges`
   short-circuit was much higher leverage than estimated (44 %
   throughput regression had been hiding in plain sight since
   `a5e8eee`).

3. ~~`CALCITE_BIF2_FUSE`.~~ ✅ Default-on in calcite `f014d35`.

4. **Lead #4 — `tick_no_diff` audit.** Now top pick. Read first,
   change only if the audit says it's safe.

5. **Lead #2 — memwrite gate empty-tick fast path.** Bigger surface
   (kiln + calcite). Defer until #4 numbers are in.

6. **Lead #5 — finish REP fast-forward phase 3b** if the in-game
   profile shows significant REP time, otherwise punt to post-ship.

Each step independently revertible. Each step bench-gated against
both targets, smoke-gated, logbook entry with JSON before/after.
Stop when the user-experience criteria in
[`doom-perf-mission.md`](doom-perf-mission.md) § "What success
looks like" are met.

## Diagnostic probes

Two `cargo run` probes characterise the static residue post-compile:

- `probe_bif_predecessor` — for every isolated `BranchIfNotEqLit`,
  classify the op at `i-1` and walk back up to 16 ops looking for a
  matching `LoadState`. Use to size widening windows or rule out
  fusion leads quickly.
- `probe_bif_pairs` — adjacent `BIfNEL → BIfNEL` pairs (same vs
  different slot, miss-shape vs fall-through, share-target rate).
  Drives `CALCITE_BIF2_FUSE` cost/benefit.

```sh
cd ../calcite && cargo run --release --bin probe_bif_predecessor -- \
  ../CSS-DOS/tests/bench/cache/doom8088.css
```

## Cardinal-rule check

All five leads operate on CSS shape only. None look at x86 opcodes,
DOS structures, BIOS calls, or Doom-specific addresses. Lead #1's
fusers fire on any cabinet whose emitter produces the shape; lead
#2's `any_slot_live` summary is structural; lead #3's pseudo-active
bit is host-state. Calcite stays general-purpose.
