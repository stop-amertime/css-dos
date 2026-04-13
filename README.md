# CSS-DOS

An Intel 8086 PC implemented entirely in CSS custom properties and `calc()`.
The CSS runs in Chrome — no JavaScript, no WebAssembly, just a stylesheet
executing machine code. The goal: boot DOS from a CSS file.

[Calcite](https://github.com/stop-amertime/calcite) is a JIT compiler that
makes the CSS fast enough to actually use (~200K+ ticks/sec vs Chrome's
~1 tick/sec).

## How it works

A transpiler converts a reference JavaScript 8086 emulator into equivalent CSS.
Every register, flag, and memory byte is a CSS custom property. Every instruction
is a CSS expression. Each "tick" of CSS evaluation executes one cycle.

The output is a self-contained `.css` file (or `.html` with visualization) that
can be:
- Opened in Chrome (works, but slowly — one frame per year)
- Run through calcite for real-time execution

## Status

**V3 microcode execution model** — cycle-accurate CSS with micro-operation
sequences. BIOS handlers are microcode, not assembly. 3740 instructions
conformant on the DOS boot path.

What works:
- Full 8086 ISA transpiled to CSS
- BIOS microcode handlers (INT 08h-20h)
- PIT timer, PIC interrupt controller, keyboard input
- Conformance testing infrastructure (reference emulator + tick-by-tick comparison)
- DOS kernel boot (partial — blocked on a decode bug)

What's next:
- Fix segment override decode bug (current blocker)
- Complete DOS boot to COMMAND.COM prompt
- ROM disk plan for large programs (Doom8088, Wolfenstein 3D)

## Project layout

```
transpiler/     JS->CSS transpiler (v3 microcode model)
tools/          Conformance testing (reference emulator + comparison)
bios/           BIOS init stub (real x86 assembly)
tests/          Test programs (.asm, .com)
dos/            DOS kernel and system files
legacy/         Retired code (v1 JSON approach + old BIOS assembly)
docs/           Documentation (start at docs/INDEX.md)
```

See `CLAUDE.md` for detailed architecture and contributor guide.

## Credits

- [rebane2001](https://github.com/rebane2001) for the original
  [x86css](https://github.com/rebane2001/x86css)
- Jane Ori for the
  [CPU Hack](https://dev.to/janeori/expert-css-the-cpu-hack-4ddj)
- [emu8](https://github.com/nicknisi/emu8) for the reference 8086 emulator

## License

GNU GPLv3
