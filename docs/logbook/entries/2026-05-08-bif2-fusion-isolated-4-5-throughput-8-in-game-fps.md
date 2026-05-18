## 2026-05-08 — BIF2 fusion isolated: +4.5 % throughput, +8 % in-game FPS

Hardcoded BIF2 (BIfNEL2 pair fusion) OFF in calcite (`ef44f20`,
const `BIF2_FUSE_ENABLED=false` in `compile.rs`), reran the canonical
3-run `doom-all` baseline, compared against the BIF2-on baseline
landed earlier today.

| Metric | BIF2 ON (median) | BIF2 OFF (median) | Δ |
|---|---:|---:|---:|
| compileMs       | 27,592 | 27,829 | +0.9 % |
| runMsToInGame   | 77,061 | 79,667 | **+3.4 %** |
| ticksToInGame   | 34,528,096 | 34,485,698 | −0.1 % (~deterministic) |
| ticksPerSecAvg  | 443,099 | 423,355 | **−4.5 %** |
| ingameFps       | 1.85 | 1.70 | **−8.2 %** |
| doomLoad phase  | 65,480 | 68,463 | **+4.6 %** |
| doomMenuDelay   | 2,139 | 2,608 | +21.9 % (small abs) |

So on the post-keyboard-revert old-kbd web baseline, BIF2 is worth
roughly **+4.5 % throughput / +8 % in-game FPS** — modest but real.

The 2026-05-07 calcite log entry that claimed +47 % throughput /
−32 % wall (calcite `8e592b0`/`f014d35`) measured BIF2 on the **CLI**
bench (`run.mjs doom-loading --target=cli`), with a baseline of
142 K ticks/sec (the engine was bottlenecked by the not-yet-fixed
`apply_input_edges` regression at that point — the same-day fix in
calcite `6d9e80a` recovered most of the throughput). On the CLI
runtime — no SW, no frame consumer, native rather than wasm — the
relative weight of dispatch overhead vs other engine work is
different too. The +47 % isn't wrong; it just doesn't generalise
across runtimes or across baselines. The web is the canonical
bench, and the canonical answer for BIF2 is +4-8 %.

Lesson: when claiming a percentage win, anchor to the canonical
bench (web `--headed`) and a fully-current baseline. CLI numbers
are dev-sanity, not headline material.

Raw JSONs:
`docs/benches/doom-all-2026-05-08-old-kbd-{run,bif2off-run}{1,2,3}.json`.

Also discovered (and fixed) along the way: `tests/bench/lib/artifacts.mjs`
hardcoded `../calcite/` for the wasm/cli artifacts, ignoring
`CALCITE_REPO`. From a CSS-DOS worktree, `../calcite/` resolves to
`CSS-DOS/.claude/worktrees/calcite/` (a sibling worktree, usually on a
different branch). The dev server already honours `CALCITE_REPO`; the
bench artifact registry now does too. Prior 3-run baseline happened
to use the right wasm only because the dev server served it and we
always passed `--no-rebuild` (so the bogus staleness check never
triggered a rebuild against the wrong calcite).
