# Calcite Compiler Bug: Stale Slot Reads in Branching Code

**Date:** 2026-04-13  
**Status:** Root cause identified, fix not yet working  
**Affects:** Any CSS with `--readMem` (or other dispatch-table functions) called from inside branching `if(style())` expressions

## The Symptom

`--readMem(1052)` returns 0 instead of 30 (the correct value at memory address 1052) when called from inside the `--memAddr` property's dispatch for `opcode=214, __1uOp=1`. The SAME `--readMem(1052)` works correctly at `uOp=0` and works correctly as a standalone computed property.

This blocks the BIOS INT 09h keyboard handler — the scancode byte gets written to address 1025 instead of 1055, corrupting the BDA keyboard buffer.

## The Architecture

CSS-DOS's `--memAddr` property is a giant `if(style())` chain:
```css
--memAddr: if(
    style(--opcode: 0): ...;
    style(--opcode: 1) and style(--__1uOp: 0): ...;
    style(--opcode: 1) and style(--__1uOp: 1): ...;
    ...
    style(--opcode: 214) and style(--__1uOp: 0): if(style(--q1: 9): calc(1024 + --read2(1052)); ...);
    style(--opcode: 214) and style(--__1uOp: 1): if(style(--q1: 9): calc(1024 + --read2(1052) + 1); ...);
    ...
  else: -1);
```

Because the branches use compound `and` conditions, `recognise_dispatch` fails and this compiles via `compile_style_condition_linear` (line ~960 in compile.rs). All branches compile into one flat ops stream with `BranchIfZero`/`Jump` for control flow.

`--read2(1052)` is an `@function` whose body is `calc(--readMem(var(--at)) + --readMem(calc(var(--at) + 1)) * 256)`. It goes through `compile_general_function` which binds `--at` to 1052, then compiles the body. The body's `--readMem(var(--at))` calls go through `compile_near_identity_dispatch` (because `--readMem` has a dispatch table with ~6000 identity entries and ~20 exception entries for keyboard/BIOS ROM).

## What the Debugger Shows

Using `/compare-paths` at tick 24 (INT 09h μop 1):
- **Compiled:** `--memAddr = 1025` (wrong — `1024 + 0 + 1`)  
- **Interpreted:** `--memAddr = 1055` (correct — `1024 + 30 + 1`)

The interpreted path evaluates `--readMem(1052)` = 30 correctly. The compiled path evaluates it as 0.

Memory at address 1052 IS 30 at this tick (verified via `/memory` endpoint and `--_dbgRead1052` standalone property). A standalone `--_dbgRead1052: --readMem(1052);` property evaluates to 30 in BOTH paths. The bug only manifests when `--readMem` is nested inside the branching memAddr dispatch.

## The Compiled Ops

From compile-time logging (ops around index 18456-18485):

```
[18458] LoadLit { dst: 38108, val: 1050 }      ← --read2 arg (BDA_KBD_HEAD for first call)
[18459] LoadSlot { dst: 38109, src: 38108 }     ← my parameter copy fix
[18460] LoadSlot { dst: 38110, src: 38109 }     ← near-identity parameter copy
[18461] LoadMem { dst: 38111, addr_slot: 38110 } ← readMem lo byte
[18462] Dispatch { table_id: 46 }                ← exception check
[18463] LoadLit { val: 1 }
[18464] Add { a: 38109, b: 38732 }               ← addr + 1
[18465] LoadSlot { dst: 38734 }                   ← copy for hi byte
[18466] LoadMem { dst: 38735, addr_slot: 38734 }  ← readMem hi byte
[18467] Dispatch { table_id: 47 }
[18468] LoadLit { val: 256 }
[18469] Mul                                        ← hi * 256
[18470] Add                                        ← lo + hi*256 = read2 result
[18471] LoadLit { dst: 39359, val: 1052 }         ← --read2 arg for SECOND call (BDA_KBD_TAIL)
[18472] LoadSlot { dst: 39360, src: 39359 }
[18473] LoadSlot { dst: 39361, src: 39360 }
[18474] LoadMem { dst: 39362, addr_slot: 39361 }  ← readMem(1052)
[18475] Dispatch { table_id: 48 }
... (hi byte, combine, etc)
```

The ops LOOK correct — `LoadLit(39359, 1052)` sets the slot, `LoadSlot` copies chain, `LoadMem` reads from it. At runtime, if this branch executes, slot 39359 should be 1052 and `LoadMem` should read `state.read_mem(1052) = 30`.

## Why It Still Fails

Despite the ops looking correct in isolation, the compiled result is still 0 for readMem(1052) in the uOp=1 branch. The interpreted path gets 30.

**Possible remaining causes:**

1. **The ops are correct but a different branch's compilation changed the behavior.** The `compile_style_condition_linear` compiles ALL branches sequentially into one ops stream. Each branch's `compile_expr` may modify compiler state (slot allocations, property_slots, dispatch table caches) that persists to the next branch. Even with the property_slots save/restore I added, there may be other shared state that leaks.

2. **The Dispatch ops (for readMem exceptions) may be sharing compiled dispatch table IDs across branches.** Table IDs 46, 47, 48, 49 are allocated sequentially. If branch A and branch B both compile readMem calls, they get different table IDs. But the table entries are compiled once and shared. If the exception entry compilation bakes in a slot reference from branch A's context, branch B's execution reads a stale slot.

3. **The near-identity dispatch's `compile_near_identity_dispatch` removes and re-inserts the readMem dispatch table from `self.dispatch_tables`.** During the window when it's removed, if another code path checks `dispatch_tables.get("--readMem")` (e.g., `try_compile_by_body_pattern` for `--read2` checking `inner_is_pure_identity`), it sees None and defaults to `true`, causing `--read2` to be compiled as `LoadMem16` (direct memory read bypassing the exception dispatch). This would read from state directly, which is correct for identity entries but WRONG for this specific scenario... actually this might not be the issue since readMem's exceptions (keyboard at 1280/1281) don't affect address 1052.

## Fixes Already Attempted (in calcite compile.rs)

1. **LoadSlot parameter copy in `compile_near_identity_dispatch`** (line ~1319): Always emit `LoadSlot` to copy the compiled argument into a fresh local slot. Prevents reusing a slot from a different context. **Result: no effect.**

2. **LoadSlot parameter copy in `compile_general_function`** (line ~1537): Same fix for general function inlining. **Result: no effect.**

3. **LoadSlot parameter copy in `compile_dispatch_call`** (line ~1409): Same fix for dispatch call compilation. **Result: no effect.**

4. **Property_slots save/restore around each branch in `compile_style_condition_linear`** (line ~974): Save all property_slots before each branch, restore after. Prevents cross-branch contamination of variable bindings. **Result: no effect.**

All fixes are still in the code (not reverted).

## How to Reproduce

```bash
# Generate the test CSS
node transpiler/generate-hacky.mjs tests/keyboard-irq.com --mem 1536 -o tests/keyboard-irq.css

# Run with keyboard injection — AX should become 7777 but stays at 97
calcite-cli --input tests/keyboard-irq.css --ticks 100 --verbose --key-events=50:0x1E61 2>&1 | grep "Tick 59:"
# Shows memAddr=1025 (wrong, should be 1055)

# Use the debugger for interactive testing:
calcite-debugger --input tests/keyboard-irq.css
# Then: POST /tick {"count":15}, POST /keyboard {"value":7777}, POST /tick {"count":9}
# Then: GET /compare-paths → shows memAddr compiled=1025 interpreted=1055
```

## Key Files

- **Calcite compiler:** `calcite/crates/calcite-core/src/compile.rs`
  - `compile_style_condition_linear` (~line 960): where if/else branches are compiled
  - `compile_near_identity_dispatch` (~line 1285): where `--readMem` calls compile
  - `compile_general_function` (~line 1507): where `--read2` body is inlined
  - `compile_var` (~line 763): returns existing slot from property_slots without emitting ops
  - `compile_inline_dispatch` (~line 920): dispatch table compilation
- **Calcite evaluator:** `calcite/crates/calcite-core/src/eval.rs`
  - `eval_dispatch_raw` (~line 1591): interpreted readMem dispatch (works correctly)
- **CSS transpiler:** `CSS-DOS/transpiler/src/patterns/bios.mjs` — BIOS handler μop emitters
- **Test program:** `CSS-DOS/tests/keyboard-irq.asm` — exercises IRQ 1 → INT 09h → BDA → INT 16h

## Debugging Infrastructure Available

- **Calcite debugger HTTP API** at localhost:3333:
  - `POST /keyboard {"value":7777}` — set `--keyboard` CSS property (v3 microcode path)
  - `GET /compare-paths` — runs one tick both compiled and interpreted, diffs all properties
  - `POST /tick`, `POST /seek`, `GET /state`, `POST /memory` — standard debugging
- **Calcite CLI:** `--key-events=TICK:VALUE,...` flag for keyboard injection in trace/verbose mode
- **compare.mjs:** `--key-events` flag forwards to both JS ref emulator and calcite

## What Needs to Happen

The compiled path needs to produce the same result as the interpreted path for `--readMem(1052)` when nested inside a branching if(style()) expression. The root cause is somewhere in how `compile_style_condition_linear` or its callees handle slot allocation/reuse across branches. The interpreted path works because it evaluates everything fresh each time without slot caching.

## Other Changes in This Session (CSS-DOS side, uncommitted)

All in `CSS-DOS/` working directory, uncommitted:

1. **`transpiler/src/template.mjs`**: Added `biosAH` state variable (latches AH at instruction boundaries for BIOS handlers)
2. **`transpiler/src/emit-css.mjs`**: Added `--biosAH` computed property, keyboard CSS rules import, `--halt=halt` name-based halt
3. **`transpiler/src/patterns/bios.mjs`**: INT 16h uses `--biosAH` for subfunction dispatch (prevents AX modification from tainting AH). INT 10h also uses `--biosAH`. All `--read2` calls restored (workarounds removed).
4. **`transpiler/generate-hacky.mjs`**: BDA keyboard buffer initialization (head/tail = 0x1E), video mode/columns
5. **`tools/compare.mjs`**: BIOS handler skip logic, INT 16h rewind skip, `--key-events` forwarding to calcite, name-based `--halt=halt`
6. **`tools/lib/bios-handlers.mjs`**: INT 16h AH=00h IP rewind when buffer empty (prevents gossamer fallthrough)

Calcite changes (in `calcite/` repo):
1. **`crates/calcite-cli/src/main.rs`**: `--key-events` CLI flag, `--halt` name-based resolution, key injection in trace/verbose/dump-tick paths
2. **`crates/calcite-debugger/src/main.rs`**: `POST /keyboard` endpoint for `--keyboard` CSS property injection
3. **`crates/calcite-core/src/compile.rs`**: Three LoadSlot parameter copy fixes + property_slots branch isolation (none fully resolved the issue)
