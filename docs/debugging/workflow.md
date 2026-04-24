# Debugging Workflow

## Standard process: find -> diagnose -> fix -> verify

### 1. Find the divergence

Start the calcite debugger and run `fulldiff.mjs`:

```sh
# In CSS-DOS:
node transpiler/generate-dos.mjs ../calcite/programs/bootle.com -o ../calcite/output/bootle.css

# In calcite:
target/release/calcite-debugger.exe -i output/bootle.css &
node tools/fulldiff.mjs --ticks=5000
```

Note the tick number and the register/memory diff.

### 2. Diagnose: is it a CSS bug or a calcite bug?

Use the debugger's `/compare-paths` endpoint:

```sh
curl -sX POST localhost:3333/seek -d '{"tick":N}'
curl -s localhost:3333/compare-paths | python3 -m json.tool
```

- **Compiled and interpreted agree but differ from reference** -> CSS bug
  (fix in `transpiler/src/`)
- **Compiled and interpreted disagree** -> calcite compiler bug
  (fix in `../calcite/crates/calcite-core/src/compile.rs`)

### 3. Fix

For CSS bugs: check the emitter in the relevant pattern file. Common causes:
- Wrong effective address computation
- Prefix length not accounted for in IP advance
- uOp holding when it should advance (or vice versa)
- Missing register update in a multi-uOp sequence

For calcite bugs: use `trace_property` and `dump_ops` to trace the compiled
execution path. See [`docs/debugging/calcite-debugger.md`](calcite-debugger.md)
for the quick reference, and the
[Agent-oriented tooling](../../../calcite/docs/debugger.md#agent-oriented-tooling)
section of the calcite debugger docs for the full tool inventory
(`inspect_packed_cell`, `compare_paths`, `watchpoint`, async `run_until`,
multi-session side-by-side, etc.). Harness wrappers are in
[`tests/harness/lib/debugger-client.mjs`](../../tests/harness/lib/debugger-client.mjs).

### 4. Verify

Re-run `fulldiff.mjs` to confirm the fix and find the next divergence.

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
