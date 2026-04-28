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
node tests/harness/pipeline.mjs full carts/test-carts/dos-smoke

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

# Snapshot the engine state mid-run, then resume from it later. Pairs
# with --script-event to land on a specific moment (e.g. just-reached-
# in-game) and freeze it; later --restore skips the boot/menu cost.
# See ../calcite/docs/benchmarking.md "Snapshot / restore" for the full
# workflow and limits (same-cabinet only).
../calcite/target/release/calcite-cli.exe -i <cabinet>.css \
    --ticks=60000000 --snapshot-out=in-game.snap
../calcite/target/release/calcite-cli.exe -i <cabinet>.css \
    --restore=in-game.snap --ticks=10000000
```

Everything is documented in more detail in
[`tests/harness/README.md`](../tests/harness/README.md) — the harness's
own README has workflow recipes for common debugging scenarios.

## Web-side benchmarking — `tests/harness/bench-web.mjs`

The native CLI/bench numbers in `../calcite/docs/benchmarking.md` answer
"how fast is the rust evaluator on this workload?" The browser is the
real product though, so when CLI and web disagree (or when you're
chasing a wasm-only regression) you measure the web path directly:

```sh
# Start the dev server (needed for the player + bridge to load assets).
node web/scripts/dev.mjs                       # serves on :5173

# In another shell, drive the existing /player/bench.html page through
# headless Chrome. Builds the Zork1-2 cabinet IN-BROWSER (same code path
# the site uses) and reports steady-state cycles/sec.
node tests/harness/bench-web.mjs               # 1 zork run
node tests/harness/bench-web.mjs --runs=3      # 3 runs (reports min/median/max)
node tests/harness/bench-web.mjs --cart=plasma # CPU-bound Mode 13h plasma
node tests/harness/bench-web.mjs --headed      # show the Chrome window
```

Output is JSON on stdout — the same `window.__benchSummary` object that
`/player/bench.html?n=N` builds when you load it manually. Key fields:

- `summary.pctOf8086.median` — % of a real 4.77 MHz 8086 sustained over
  the boot phase (parse → `>` prompt). The honest "is this fast enough
  to ship?" number.
- `summary.idlePctOf8086.median` — same metric over the post-boot idle
  loop. Different question: "how smooth is interaction?"
- `summary.toTargetMs` — wall-clock to reach the 23M-cycle stabilisation
  target.

How it works: spawns `/player/calcite-bridge.js` exactly like the site
does (SW + worker + iframe), subscribes to the
`cssdos-bridge-stats` BroadcastChannel for 1 Hz cycle samples, and
returns when cycleCount crosses TARGET_CYCLES + IDLE_PHASE_MS has
elapsed. There is no benchmark-only code path — the engine, bridge,
worker pacing, and frame-encode loop are all the ones the user runs.

The driver uses the system Chrome at `C:\Program Files\Google\Chrome`
to avoid the heavy `npx playwright install` step. If that path is
absent it falls back to whatever Playwright finds.

The bench page itself (`/player/bench.html`) also has a UI — open it in
a browser and click "Run 1×" or "Run 3×" if you'd rather drive
interactively. Same numbers, same JSON written to `window.__benchSummary`.

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
