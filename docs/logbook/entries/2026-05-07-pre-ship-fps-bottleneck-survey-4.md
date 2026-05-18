## 2026-05-07 — pre-ship FPS bottleneck survey

Survey done in service of the pre-ship perf push (current
steady-state Doom8088 ~3 FPS, target 4–5+). Five untried leads
written up in
[`docs/agent-briefs/2026-05-07-pre-ship-fps-leads.md`](../agent-briefs/2026-05-07-pre-ship-fps-leads.md),
ranked by leverage/risk. No code change yet — this is reconnaissance
the next perf agent picks up.

Headline finding: the comment at calcite
`compile.rs:6708` claims 96 % of ops are
`LoadStateAndBranchIfNotEqLit`. Real fusion hit-rate measured at
three windows (cold start, loading, in-game) via
`calcite-bench --restore … --profile`: **0.8 % at all three**. The
unfused `LoadSlot + LoadState + LoadLit + Cmp + Branch` chain
dominates instead — widening `fuse_loadstate_branch` to handle the
real shape is the top-pick lead. **Op mix is virtually identical
across stages** (LoadSlot 28 %, BranchIfNotEqLit 21–22 %,
LoadState 10 %), so a flat per-tick win lands the same percentage
in both `headline.runMsToInGame` and steady-state in-game FPS.

What does change between stages is dispatch sub-op weight: 9 sub-
ops/Dispatch at boot, **177 during loading** (the segment-0x55
zone-walk going through heavy dispatch bodies), 34 in-game.

Snapshots saved to `tmp/perf-snaps/stage_{loading,ingame}.snap`
against the current `doom8088.css`. Regenerate on cabinet rebuild;
recipe + commands in the brief.

Process notes for the next agent:

- Both `headline.runMsToInGame` (boot→ingame) and steady-state
  in-game FPS are ship targets. They share some bottlenecks but
  not all. Measure both.
- There is currently no canonical in-game-FPS bench profile.
  Adding one (snapshot-restore from `stage_ingame.snap`, run N
  ticks, report tick/cycle/frame rate) is checkpoint 0 of any
  in-game-targeted mission.
- Canonical bench is `tests/bench/driver/run.mjs doom-loading` on
  both `--target=cli` and `--target=web` (default). `calcite-bench
  --profile` is a secondary tool for op distribution; it doesn't
  produce headline numbers. Quote bench-harness JSON before/after
  any change.
