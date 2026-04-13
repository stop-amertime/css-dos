# V3 Plan Handoff — Status and Next Steps

**Date:** 2026-04-13
**Previous session:** Fixed critical calcite compiler bug, INT 09h keyboard handler now works.

## What was accomplished

### Calcite slot aliasing bug — FIXED

**Root cause:** The slot compactor (`compact_sub_ops` in `calcite-core/src/compile.rs`) would alias a `LoadMem` destination slot with a `Dispatch` destination slot inside dispatch entry ops. This happened because `compute_liveness_into` (used for sub-op liveness analysis) did not examine slots referenced by nested dispatch tables' fallback_ops. A slot written by LoadMem and only read by a nested dispatch's fallback appeared dead and got reused.

**Fix:** Changed `compile_near_identity_dispatch` to inline exception checks as a BranchIfZero/Jump chain in the calling ops stream, instead of creating a nested Dispatch table with cross-scope slot references. This eliminates the cross-scope reference that compaction couldn't handle.

**Files changed in calcite repo (uncommitted):**
- `crates/calcite-core/src/compile.rs` — `compile_near_identity_dispatch`: inlined exception check; added `exec_ops_traced`, `trace_property` debugging infrastructure
- `crates/calcite-core/src/eval.rs` — added `trace_property`, `dump_ops_range` public APIs
- `crates/calcite-debugger/src/main.rs` — added `/trace-property` and `/dump-ops` HTTP endpoints
- `crates/calcite-debugger/Cargo.toml` — enabled `conformance` feature for serde

### Debugging infrastructure added

The calcite debugger now has two new endpoints that are essential for tracing compiled-path bugs:

- `POST /trace-property {"property": "--memAddr"}` — runs traced compiled execution of a specific property, returns every op that executed with slot values, branch decisions, and dispatch table entries. Filters to dependency chain of the target slot.
- `POST /dump-ops {"start": N, "end": M}` — dumps raw compiled ops in a range. Essential for seeing what the compactor did to slot assignments.

## V3 phase status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | μop infrastructure + slot collapse | Done |
| 2 | Multi-cycle instructions (PUSH/INT/CALL/REP) | Done |
| 3 | Peripheral chips in JS reference | Done |
| 4 | Peripheral chips in CSS + port I/O + IRQ | Done |
| 5 | BIOS microcode handlers | **Partially done — see below** |

## What's working in Phase 5

- **INT 09h (keyboard IRQ handler):** Fully working. Writes ASCII + scancode to BDA circular buffer at correct addresses. EOI sent. Tested with `keyboard-irq.asm`.
- **INT 16h AH=00h (blocking key read):** μop 0 hold when buffer empty works. Key data read from BDA buffer to AX works (AX=7777 confirmed). Head pointer update works.
- **INT 16h AH=01h (non-blocking peek):** Implemented but not separately tested.
- **INT 10h (video services):** AH=02h (set cursor), AH=03h (get cursor), AH=0Eh (teletype), AH=0Fh (get mode) all implemented. Not individually tested post-fix.
- **INT 1Ah (timer tick):** Implemented.
- **INT 20h (halt):** Implemented.

## What's broken: INT 16h folded IRET CS restoration

**Symptom:** After INT 16h returns AX=7777 correctly, execution resumes at CS=61440 (0xF000, BIOS ROM) instead of CS=0 (the .com program's segment). The program runs wild in BIOS ROM instead of executing the `MOV [result], AX` instruction.

**Evidence from the trace (keyboard-irq.css, key-events=50:0x1E61):**

```
Tick 64: uOp=1 CS=61440 IP=645 AX=7777  ← INT 16h read key: AX correct
Tick 65: uOp=2 CS=61440 IP=645           ← write head lo to BDA
Tick 66: uOp=3 CS=61440 IP=645           ← write head hi to BDA
Tick 67: uOp=4 CS=61440 IP=267           ← pop IP worked (267=0x10B), CS SHOULD be 0 but is 61440
Tick 68: uOp=0 CS=61440 IP=268           ← handler retired, CS still wrong
```

**Stack contents at SP=1522 (verified with debugger):**
```
SP+0: 267  (saved IP — correct, 0x10B = instruction after INT 16h)
SP+2: 0    (saved CS — correct, .com program runs in CS=0)
SP+4: 642  (saved FLAGS — correct, 0x0282)
```

**Key fact:** `compare-paths` shows zero diffs at tick 66 — both compiled and interpreted paths produce CS=61440. This is a CSS logic bug, not a calcite bug.

**The CSS for CS at opcode=214, uOp=4 (from keyboard-irq.css line ~2114):**
```css
style(--opcode: 214) and style(--__1uOp: 4):
  if(style(--q1: 22):                          /* INT 16h */
    if(style(--biosAH: 0):                     /* AH=00h */
      --read2(calc(calc(var(--__1SS) * 16) + var(--__1SP) + 2));  /* pop CS */
    else: var(--__1CS));
  else: var(--__1CS));
```

**The q1 value IS 22 and biosAH IS 0 at this tick** (verified with debugger state endpoint). So the branch should match and evaluate `--read2(1524)` which should return 0 (the saved CS on the stack).

**Possible causes (not yet investigated):**
1. The `--read2(1524)` expression evaluates to 61440 instead of 0 — perhaps another instance of the slot aliasing bug (though the fix should cover this case too since the same near-identity dispatch is used).
2. The branch matching q1=22 doesn't fire because another branch earlier in the CS dispatch matched first (if there's a duplicate or overlapping entry).
3. The `--read2` expression has a different calculation path when SP has already been modified by a prior μop in the same handler (though SP=1522 is confirmed unchanged at this tick).

**How to investigate:** Use the debugger's `/trace-property` on `--CS` at tick 66 to see exactly which ops execute and what values flow through. The trace has 90K entries so filtering will be needed. Alternatively, add a debug property like `--_dbgPopCS: --read2(calc(calc(var(--__1SS) * 16) + var(--__1SP) + 2));` and check its compiled vs interpreted value.

## What hasn't been started yet

### INT 13h (disk I/O) — the ROM disk plan

This is the biggest remaining piece of the v3 plan. It's fully designed in CLAUDE.md under "The disk problem and the ROM disk plan" but no code exists yet. Summary:

- Disk image bytes stored as CSS at addresses > 0xFFFFF (outside 8086 address space)
- LBA register at BDA 0x4F0 (2 bytes) controls which sector is visible
- Disk window at 0xD0000 (512 bytes) — reads dispatch on LBA register
- INT 13h AH=02h BIOS handler: sets LBA register, copies from window to ES:BX
- Unlocks full DOS programs (Doom8088, Wolfenstein 3D, etc.)

### End-to-end validation

Once the IRET bug is fixed, the full pipeline needs testing:
1. keyboard-irq.asm should reach INT 20h and halt with correct AX
2. Compare against reference emulator (tools/compare.mjs) for tick-by-tick conformance
3. Test INT 10h teletype output (write a simple hello-world test)
4. Test DOS kernel boot (generate-dos.mjs path)

## Reproducing the current state

```bash
# Generate test CSS
node transpiler/generate-hacky.mjs tests/keyboard-irq.com --mem 1536 -o tests/keyboard-irq.css

# Run and see the bug (CS=61440 at tick 68 instead of CS=0)
../calcite/target/release/calcite-cli.exe --input tests/keyboard-irq.css --ticks 100 --verbose --key-events=50:0x1E61 2>&1 | grep "^Tick" | awk 'NR>=64 && NR<=70'

# Use debugger for interactive investigation
../calcite/target/release/calcite-debugger.exe --input tests/keyboard-irq.css
# Then: POST /tick {"count":49}, POST /keyboard {"value":7777}, POST /tick {"count":17}
# Then: GET /compare-paths, POST /trace-property {"property":"--CS"}
```

## Uncommitted changes in CSS-DOS repo

All in working directory (not staged):
1. `transpiler/src/template.mjs` — biosAH state variable
2. `transpiler/src/emit-css.mjs` — biosAH computed property, keyboard CSS rules, name-based halt
3. `transpiler/src/patterns/bios.mjs` — all BIOS handler emitters (INT 09h, 10h, 16h, 1Ah, 20h)
4. `transpiler/generate-hacky.mjs` — BDA keyboard buffer init, video mode/columns
5. `tools/compare.mjs` — BIOS handler skip logic, key-events forwarding
6. `tools/lib/bios-handlers.mjs` — JS reference BIOS handlers for compare.mjs
7. `tests/keyboard-irq.css` — generated test file (regenerate with command above)

## Uncommitted changes in calcite repo

1. `crates/calcite-core/src/compile.rs` — near-identity dispatch fix, tracing infrastructure
2. `crates/calcite-core/src/eval.rs` — trace_property, dump_ops_range APIs
3. `crates/calcite-cli/src/main.rs` — --key-events flag, name-based --halt resolution
4. `crates/calcite-debugger/src/main.rs` — /trace-property, /dump-ops, /keyboard endpoints
5. `crates/calcite-debugger/Cargo.toml` — conformance feature flag
6. `Cargo.toml` — no net change (was temporarily modified, reverted)
