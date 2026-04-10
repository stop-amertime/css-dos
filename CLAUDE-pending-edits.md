# Pending CLAUDE.md additions

Section to be merged into CLAUDE.md. Keeping it separate because CLAUDE.md
will have substantial unrelated edits before this lands.

## The transpiler-first policy

No CSS is written by hand. Ever. The source-of-truth chain is:

  reference JS (js8086.js, future JS chip models) → transpiler → generated CSS

The reference JS is the spec. The transpiler is a mechanical function from JS
to CSS. The generated CSS is output — an artifact, not a thing you edit.

When something is missing or wrong in the generated CSS, the fix is one of:

1. Extend the reference JS (e.g. add a faithful 8259A in the peripheral slot)
2. Extend the transpiler to handle a pattern it doesn't yet emit
3. Fix a bug in one of the two above

The fix is **never** "write CSS by hand to work around it."

## Why this reframes "shortcuts"

A shortcut in hand-written code is a real saving: fewer lines to write, fewer
bugs to chase. A shortcut in transpiled code is not a saving — the transpiler
generates whatever you feed it. Cutting 8253 channels 1 and 2, hardcoding an
ICW sequence, skipping XMS detection, implementing "just enough" of anything —
none of these reduce work that actually has to happen. All they do is make the
reference incorrect and the output incomplete.

Practical consequences:

- **Size work to faithful hardware, not to the current test program.** Do not
  implement "just enough 8259 for Doom8088." Implement a full 8259A. Then let
  Doom8088 use whatever subset it needs. The next program will trip over the
  parts you cut.
- **Complexity in the generated CSS is free.** File size and output bulk are
  not design criteria. Correctness and transpilability are.
- **Complexity in the reference JS is honest cost.** That is where design
  tradeoffs actually happen. Clean JS → clean transpiler pass → clean CSS.
- **When the transpiler cannot express something the reference JS does, extend
  the transpiler.** Do not cripple the JS to fit the transpiler's current
  vocabulary. The transpiler is the investment.

## Reference JS for peripherals

js8086's CPU core is the reference for the CPU. For peripheral chips (8259A
PIC, 8253 PIT, VGA DAC, etc.) there are currently no reference implementations
— they are stubbed in the peripheral slot. Adding them is the peripheral work.

The JS implementations should be:

- **Faithful to the real chip.** All registers, all modes, all documented
  behaviors, plus the commonly-depended-upon undocumented ones. Fidelity
  target is software-observable behavior — same bar as the CPU, not
  cycle-accurate microarchitecture.
- **Structured as self-contained objects** matching js8086's peripheral
  interface (`isConnected / portIn / portOut / hasInt / nextInt / tick`).
- **Written to be transpiler-friendly** in the same way the CPU is. Prefer
  patterns the transpiler can recognize: dispatch-shaped switches, pure
  functions of state, explicit state properties rather than hidden closures
  or mutable shared references.

The JS chips serve two roles simultaneously: they are the conformance oracle's
peripherals (paired with js8086's CPU in ref-emu.mjs), and they are the
transpiler input for the generated CSS. Writing them well the first time pays
twice.

**References for chip semantics:** PCjs (`jeffpar/pcjs`) has clean, readable
8259A/8253 implementations and is the best JS reading reference. Bochs is the
gold standard for edge-case accuracy when something is ambiguous. Do not fork
either — read them while writing our own.
