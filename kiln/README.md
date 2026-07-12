# Kiln

**Kiln is the CSS-DOS transpiler.** It takes an 8086 memory image (BIOS
bytes + kernel or .COM + rom-disk) and emits CSS that, when evaluated by
Chrome or Calcite, behaves as a complete 8086 PC running that memory.

This folder used to be `transpiler/src/`. It was renamed in the big tidy
so the proper noun (Kiln) matches the folder. If you want to know *what*
the transpiler is and why it exists, read
[`../docs/architecture.md`](../docs/architecture.md). The notes below
are the implementation guide.

## Layout

```
kiln/
  emit-css.mjs       Top-level emitter. Wires dispatch tables + memory + template.
  decode.mjs         Instruction decode @functions + per-tick decode properties.
  memory.mjs         Memory layout: zone builders, packed cells, initial image.
  template.mjs       Execution engine: clock, double buffer, state tables, keyboard rules.
  css-lib.mjs        Shared bit & byte helper @functions.
  pixels.mjs         Mode 13h pixel painter (raw player).
  cycle-counts.mjs   Per-opcode 8086 cycle counts.
  patterns/
    regs.mjs         Shared REG16 / SPLIT_REGS register tables.
    alu.mjs          ADD/SUB/CMP/AND/OR/XOR/ADC/SBB/TEST/INC/DEC.
    control.mjs      JMP/Jcc/CALL/RET/INT/IRET/LOOP.
    stack.mjs        PUSH/POP/PUSHF/POPF.
    mov.mjs          MOV/LEA/LDS/LES.
    misc.mjs         HLT/NOP/string ops/flag manipulation/CBW/CWD/XCHG/BCD/INT3/INTO.
    chipset.mjs      PIT/PIC/keyboard/DAC wires + the IN/OUT port handlers.
    group.mjs        Group opcode dispatch (80-83, F6/F7, FE/FF).
    shift.mjs        Shifts & rotates (D0-D3): SHL/SHR/SAR/ROL/ROR/RCL/RCR.
    extended186.mjs  80186+ patterns (PUSH imm, IMUL imm).
    flags.mjs        Flag-computation @functions shared by ALU.
  AGENT-GUIDE.md     How to add a new instruction.
```

## Entry point

```js
import { emitCSS } from './kiln/emit-css.mjs';

emitCSS({
  programBytes,   // bytes loaded at programOffset (kernel for DOS, .COM for hack)
  biosBytes,      // BIOS ROM bytes, placed at 0xF0000
  memoryZones,    // [[start, end), ...] writable zones
  embeddedData,   // [{ addr, bytes }, ...] extra regions (e.g. IVT seeding)
  diskBytes,      // rom-disk payload, routed through --readDiskByte
  programOffset,  // where programBytes loads
  initialCS,
  initialIP,
  initialRegs,    // override default register values
  header,         // optional cabinet header comment string
}, writeStream);
```

`emitCSS` streams directly to the output — cabinets are too big to build
as a single string.

## The transpilation strategy

Hand-written emitters, not mechanical AST-to-CSS translation. Each
`patterns/*.mjs` file registers opcode entries with a `DispatchTable`.
The central `emit-css.mjs` assembles those entries into a per-register
`if(style(--opcode: N): ...)` dispatch — one for each of
AX/CX/DX/BX/SP/BP/SI/DI/CS/DS/ES/SS/IP/flags/halt/cycleCount.

Memory writes live in 3 parallel slots (`--memAddr0`/`--memVal0` …
`--memAddr2`/`--memVal2`). Each slot is one write whose width is set by
the global per-tick `--_writeWidth` gate (1 = byte, 2 = 16-bit word).
Three is the maximum any instruction uses: INT / TF trap / hardware IRQ
push FLAGS/CS/IP = 3 word writes. (This is the word-slot scheme; it
replaced an earlier byte-slot scheme that needed 6 slots for the same
frame.) `NUM_WRITE_SLOTS` in `memory.mjs` is the source of truth.

Slot gating: each slot is fronted by a per-tick `--_slotNLive`
property that is 1 only when the current opcode uses slot N (or a TF
trap / hardware IRQ is pushing the 3-word frame). The per-cell write
rule nests every slot check behind these gates, so non-writing
instructions — NOP, MOV reg,reg, jumps, most ALU reg-reg, flag ops —
short-circuit at each slot's gate and evaluate zero address
comparisons. Calcite's packed-broadcast-write recogniser
(`crates/calcite-core/src/pattern/packed_broadcast_write.rs`) peels
each gate off and skips the entire address table for gated-off slots;
Chrome gets the same speedup from the normal top-down `if()`
short-circuit.

## The execution engine

Inherited from the earliest x86-in-CSS work and refined into the V4
single-cycle architecture. One tick = one instruction. Double-buffered
registers (`--__1X` = previous tick, `--__2X` = next tick). Animation
keyframes store/execute.

See [`../docs/architecture.md`](../docs/architecture.md) and
[`AGENT-GUIDE.md`](AGENT-GUIDE.md).

## Adding an instruction

See [`AGENT-GUIDE.md`](AGENT-GUIDE.md) for the step-by-step.
