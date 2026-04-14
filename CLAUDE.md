# CSS-DOS

A complete Intel 8086 PC implemented in pure CSS. The CSS runs in Chrome —
no JavaScript, no WebAssembly. [Calcite](../calcite) is a JIT compiler that
makes it fast enough to be usable.

## Before you do ANYTHING

1. Read the logbook and doc index (auto-loaded below via @ links)
2. Understand the current status, active blocker, and priority list
3. If your task isn't in "What's next", ask the user why before proceeding
4. Read only the docs relevant to your specific task (the index tells you which)

@docs/logbook/LOGBOOK.md
@docs/INDEX.md

## Mandatory rules

### The checkpoint system

You may NOT stop working unless you either reach a checkpoint or have a
blocking question for the user. A checkpoint requires ALL of:

- [x] Task complete and tested (or user confirmed they tested it)
- [x] Logbook updated (status, entry, what's next)
- [x] New code/features documented in the appropriate docs/ file
- [x] No leftover debris (debug logging, temp files, unclear names)
- [x] GitHub issues updated if relevant

Only then may you commit and push.

### Git rules

Do not interact with Git unless explicitly allowed. No stashing, no looking
at previous commits, no rollbacks — even in bypass permissions mode.

### Documentation rules

- **DO NOT GUESS OR ASSUME FUNCTIONALITY.** Look up DOS, 8086, BIOS interrupts,
  FAT12, or kernel behavior in documentation before acting.
- **DO NOT reverse-engineer assembly.** Use the kernel map file, edrdos source
  (`../edrdos/`), and Ralf Brown's Interrupt List.
- **Log ALL findings and progress** in the logbook for future agents.

### Debugging rules

- **DO NOT RUSH TO CONCLUSIONS.** Gather information first.
- **DO NOT chase bugs blindly.** Use the debugger. Add features to the debugger
  if what you need doesn't exist.
- **DO NOT take shortcuts** that accrue tech debt or leave debris in the repo.
- **PREFER debugging infrastructure** over speculative individual fixes.

## The cardinal rule

The CSS is a working program that runs in Chrome. It is the source of truth.
Calcite must produce the same results Chrome would, just faster. Calcite has
zero x86 knowledge.

- **The CSS must work in Chrome.** If Chrome can't evaluate it, it's wrong.
- **Calcite can't change the CSS.** Only faster evaluation of the same expressions.
- **Never suggest CSS changes to help calcite.**
- **If calcite disagrees with Chrome, calcite is wrong.**

## Quick orientation

- **Current architecture:** V4 single-cycle (restored from V2). Every instruction
  completes in one CSS tick with 8 parallel memory write slots. The V3 μOp
  microcode rewrite was abandoned — it had bugs that prevented boot. V3 files
  are archived in `legacy/v3/`.
- **BIOS:** Assembly at `bios/css-emu-bios.asm`. No microcode BIOS.
- **Build script:** `transpiler/generate-dos.mjs` (single entry point for DOS boot).
- **Transpiler architecture:** `transpiler/README.md`
- **How to add instructions:** `transpiler/AGENT-GUIDE.md`
- **Conformance testing:** `docs/reference/conformance-testing.md`
- **Debugging workflow:** `docs/debugging/workflow.md`
- **Project layout:** `docs/reference/project-layout.md`

## Tools

**NASM** (assembler): `C:\Users\AdmT9N0CX01V65438A\AppData\Local\bin\NASM\nasm.exe`.
Not in PATH.

**Calcite debugger:** See `../calcite/docs/debugger.md` and `docs/debugging/calcite-debugger.md`.

**Conformance testing:** See `../calcite/docs/conformance-testing.md`.

## Conformance testing quick start

```sh
# Hack path (.COM programs)
node transpiler/generate-hacky.mjs tests/prog.com --mem 1536 -o tests/prog.css
node tools/compare.mjs tests/prog.com legacy/gossamer.bin tests/prog.css --ticks=500

# DOS boot path
node transpiler/generate-dos.mjs ../calcite/programs/bootle.com -o ../calcite/output/bootle.css
cd ../calcite
target/release/calcite-debugger.exe -i output/bootle.css &
node tools/fulldiff.mjs --ticks=5000
```

## Calcite

Sibling repo at `../calcite`. Read `../calcite/CLAUDE.md` before making changes there.
See `docs/architecture/calcite.md` for the relationship and Chrome limitations.
