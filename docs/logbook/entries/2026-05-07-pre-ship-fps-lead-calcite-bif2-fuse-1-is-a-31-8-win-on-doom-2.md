## 2026-05-07 — pre-ship FPS lead: **`CALCITE_BIF2_FUSE=1` is a 31.8 % win on doom-loading**

After lead #1 (widen `fuse_loadstate_branch`) was retired (entry
below), I asked calcite for a **runtime** op-adjacency profile via
`calcite-cli --restore … --op-profile` against fresh in-game and
loading snapshots. The static probe (`probe_bif_predecessor`) was
showing what's in `program.ops` post-compile; the runtime profile
shows what actually gets *dispatched*. The two profiles look very
different.

Top runtime adjacencies (consistent across cold / loading / in-game,
all within ~1 % of each other; 200K ticks each):

| Adjacency | In-game | Loading | Cold |
|---|---:|---:|---:|
| **BIfNEL → BIfNEL** | **13.52 %** | 12.73 % | 12.96 % |
| LoadSlot → LoadSlot | 9.73 % | 9.67 % | 10.27 % |
| **LoadSlot → BIfNEL** | 5.11 % | 5.31 % | 5.19 % |
| LoadState → LoadSlot | 3.49 % | 3.52 % | 3.52 % |
| BIfNEL → LoadState | 2.39 % | 2.23 % | 2.46 % |

`BranchIfNotEqLit2` is **already implemented** (`fuse_diff_slot_bifnel_pairs`
in `crates/calcite-core/src/compile.rs:3821`, op variant at compile.rs:359),
but **off by default** — gated behind `CALCITE_BIF2_FUSE` because the
2026-04-30 measurement on the reference cabinet was net wash.

Re-tested on the current doom8088 cabinet:

```
                     ticks/sec    runMsToInGame   throughput Δ
baseline (median-3)  142 656      241 872 ms       —
CALCITE_BIF2_FUSE=1  210 155      164 878 ms      +47.3 %
                                  −31.8 % wall
```

794 fusions fire on doom8088 (vs 0 baseline, vs 50 for
`fuse_loadstate_branch`). Smoke 7/7 PASS with `BIF2_FUSE=1`
(`dos-smoke`, `hello-text`, `cga4/5/6`, `zork1`, `montezuma` —
107.9 s wall).

**This eclipses the entire pre-ship FPS target in one env-var flip.**
3 FPS → 4 FPS at the steady-state ratio (ticks/sec moved from 142 K
to 210 K, a 1.47× — the brief target was "4–5+ FPS", i.e. 1.33–1.67×).

The 2026-04-30 net-wash result was specific to the reference
cabinet's adjacency profile. doom8088 has 794 candidate pairs
instead of "1330 with BIfNEL2 fusion offset by `pc += 2; continue;`
cost" — the dispatch savings dominate at this candidate count.

**Where it goes from here.** Recommend flipping `CALCITE_BIF2_FUSE`
to ON-by-default after one more cabinet bench (zork-big or another
non-trivial cart) confirms the 2026-04-30 wash isn't a regression on
that shape. Calcite-side detail in
[`../calcite/docs/log.md`](../../../calcite/docs/log.md). Brief at
[`docs/agent-briefs/2026-05-07-pre-ship-fps-leads.md`](../agent-briefs/2026-05-07-pre-ship-fps-leads.md)
needs updating: the new ranked top pick is "audit the 2026-04-30
BIF2 wash result on the current reference cabinet, then default on."
