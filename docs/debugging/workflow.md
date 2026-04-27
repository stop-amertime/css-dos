# Debugging Workflow

## Standard process: find -> diagnose -> fix -> verify

### 1. Find the divergence

Build the cabinet and run `fulldiff` from the harness:

```sh
node builder/build.mjs carts/<cart> -o /tmp/<cart>.css
node tests/harness/pipeline.mjs fulldiff /tmp/<cart>.css --max-ticks=10000
```

Note the tick number and the register/memory diff. Always pass `--max-ticks`
— see "Budgets" below.

### 2. Diagnose: is it a CSS bug or a calcite bug?

Use the debugger's `compare_paths` tool (drives `pipeline.mjs consistency`):

```sh
node tests/harness/pipeline.mjs consistency /tmp/<cart>.css --tick=N
```

- **Compiled and interpreted agree but differ from reference** -> CSS bug,
  fix in `kiln/`.
- **Compiled and interpreted disagree** -> calcite compiler bug, fix in
  `../calcite/crates/calcite-core/src/compile.rs`.

### 3. Fix

For CSS bugs: check the emitter in the relevant `kiln/patterns/*.mjs`. Common
causes:
- Wrong effective address computation
- Prefix length not accounted for in IP advance
- Missing register update in a multi-uOp sequence
- Direction-flag (DF) not respected in REP semantics

For calcite bugs: use `trace_property` and `dump_ops` via the debugger to
trace the compiled execution path. See
[`calcite-debugger.md`](calcite-debugger.md) for the quick reference, and the
[Agent-oriented tooling](../../../calcite/docs/debugger.md#agent-oriented-tooling)
section for the full tool inventory (`inspect_packed_cell`, `compare_paths`,
`watchpoint`, async `run_until`, multi-session side-by-side, etc.). Harness
wrappers are in
[`tests/harness/lib/debugger-client.mjs`](../../tests/harness/lib/debugger-client.mjs).

### 4. Verify

Re-run `fulldiff` to confirm the fix and find the next divergence. For
visual sanity-check, screenshot at a tick past where the program should be:

```sh
node tests/harness/pipeline.mjs fast-shoot /tmp/<cart>.css --tick=3000000 --out=/tmp/shot.png
```

## Budgets — every command needs an explicit ≤2-minute cap

Boot reaches the `A:\>` prompt around tick 2-4M. The slow `pipeline.mjs shoot`
path drives `calcite-debugger` at ~1500 ticks/s and will not terminate inside
that budget for late ticks. Use `pipeline.mjs fast-shoot` (~375K ticks/s via
`calcite-cli`) for any tick past ~200K.

For partial inspection at intermediate ticks, `calcite-cli` directly is fast
and self-contained:

```sh
# Run to tick N then dump VRAM + video-mode byte to disk.
../calcite/target/release/calcite-cli.exe -i /tmp/<cart>.css \
    --speed 0 --dump-tick 1000000 \
    --dump-mem-range=0x449:1:/tmp/mode.bin \
    --dump-mem-range=0xB8000:4000:/tmp/vram.bin \
    --sample-cells=0
```

`--dump-mem-range` is repeatable for multiple regions in one run. Combine with
`--dump-ticks=T1,T2,...` for samples across multiple ticks.

`run`-style budgets are enforced explicitly:

```sh
# Run with a 110-second wall clock and stop when the program enters.
node tests/harness/pipeline.mjs run /tmp/<cart>.css \
    --until-program-entered --wall-ms=110000
```

If no path fits the budget, **build a faster one** rather than firing and
hoping. That's how `fast-shoot`, `--dump-mem-range`, and the REP-fastfwd
diagnostic counters (`CALCITE_REP_DIAG=1`) came to exist.

## Critical rules for debugging

- **DO NOT RUSH TO CONCLUSIONS.** Gather information first. Don't apply
  speculative fixes.
- **DO NOT reverse-engineer assembly.** Use the kernel map file, edrdos source,
  and Ralf Brown's Interrupt List.
- **DO NOT chase bugs blindly.** Use the debugger. Add features to the debugger
  if needed.
- **DO NOT trust prior agents' work.** Verify with the tools, not with
  assumptions about what should work.
- **PREFER debugging infrastructure over individual bug fixes.** A good
  debugging tool pays for itself across many bugs.
