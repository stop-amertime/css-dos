# Testing

If you're doing **anything** that changes the output of a cart — kiln
emitter edits, BIOS changes, builder tweaks, Calcite engine work — you
should be running it through `tests/harness/`.

## Quick start

```sh
# Full smoke suite — builds every reference cart, runs 15s, checks it's alive.
# Use this before/after any non-trivial change.
node tests/harness/run.mjs smoke

# Run the conformance diff — this is the "is calcite correctly running
# x86?" oracle. Takes several minutes for the full set.
node tests/harness/run.mjs conformance --max-ticks=5000
```

Reports land in `tests/harness/results/latest.json` (plain JSON, easy for
agents and CI to parse). Exit code: 0 = all passed, 2 = test failures,
1 = harness couldn't start.

## Single-cart commands

```sh
# Build + run + screenshot — the one-command "does this cart work?" check.
node tests/harness/pipeline.mjs full carts/dos-smoke

# Run fulldiff to find the first tick where calcite disagrees with the
# JS reference 8086 emulator. This is the main debugging tool.
node tests/harness/pipeline.mjs fulldiff <cabinet>.css --max-ticks=10000

# Screenshot at a late tick — `fast-shoot` drives calcite-cli directly
# (~375K ticks/s); use this for any tick past ~200K. The slower `shoot`
# path goes through calcite-debugger at ~1500 ticks/s and won't reach
# boot completion (2-4M ticks) inside a 2-minute budget.
node tests/harness/pipeline.mjs fast-shoot <cabinet>.css --tick=3000000 --out=shot.png

# Slow-path screenshot (early ticks only, or when sharing a daemon).
node tests/harness/pipeline.mjs shoot <cabinet>.css --tick=100000 --out=shot.png

# Raw byte dump from guest memory at end of run (no rendering).
# Repeatable for multiple regions in one invocation.
../calcite/target/release/calcite-cli.exe -i <cabinet>.css \
    --speed 0 --dump-tick 1000000 \
    --dump-mem-range=0xB8000:4000:vram.bin \
    --dump-mem-range=0x449:1:mode.bin \
    --sample-cells=0
```

Everything is documented in more detail in
[`tests/harness/README.md`](../tests/harness/README.md) — the harness's
own README has workflow recipes for common debugging scenarios.

## Budgets beat hopes — every command needs an explicit ≤2-minute cap

Every long-running command accepts `--wall-ms`, `--max-ticks`, and
`--stall-rate`. **Use them.** Cabinets and the JS daemon can run effectively
forever; firing-and-forgetting a tool that doesn't terminate burns real
time. Boot reaches the `A:\>` prompt around tick 2-4M, which is *not*
reachable inside a 2-minute budget on the slow `shoot`/`run` paths
(~1500 ticks/s through `calcite-debugger`). Use `fast-shoot` (`calcite-cli`,
~375K ticks/s) for late-tick screenshots, or pick a tick count the chosen
path can reach. If no path fits the budget, **build a faster one** rather
than launching and hoping — that's how `fast-shoot`, `--dump-mem-range`,
and the `CALCITE_REP_DIAG=1` fast-forward diagnostics all came to exist.

The native `run_until` tool has no wall-clock ceiling; it'll run forever if
the condition never triggers.

## Reference emulator = ground truth

`tests/harness/lib/ref-machine.mjs` stands up a JS reference 8086 with
real PIC/PIT peripherals using the BIOS/kernel/disk sidecar bytes the
builder emits. If calcite disagrees with the ref, **calcite is wrong**
(or the CSS is wrong — either way it's a bug we can fix).

## When to use the MCP debugger directly vs the harness

| Task | Tool |
|---|---|
| Exploratory: "what's going on at tick X?" | MCP debugger (interactive) |
| Scripted: "does this pass?" | `tests/harness/run.mjs` |
| Bisecting a divergence | `tests/harness/pipeline.mjs fulldiff`, then MCP debugger to dig |
| Visual sanity (early ticks, daemon active) | `tests/harness/pipeline.mjs shoot` |
| Visual sanity (late ticks / fresh cabinet) | `tests/harness/pipeline.mjs fast-shoot` |
| Raw guest memory dump | `calcite-cli --dump-mem-range=ADDR:LEN:PATH` |
| Regression check | `tests/harness/pipeline.mjs cabinet-diff` or `baseline-verify` |

The full MCP tool surface (including agent-oriented additions like
`inspect_packed_cell`, `compare_paths`, `watchpoint`, async `run_until`,
multi-session diffs, `trace_property`, `execution_summary`) lives in the
calcite docs:
[Agent-oriented tooling](../../calcite/docs/debugger.md#agent-oriented-tooling).
The harness wraps each tool in
[`tests/harness/lib/debugger-client.mjs`](../tests/harness/README.md).
