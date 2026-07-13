# CSS-DOS

**An entire ’80s PC in a stylesheet.**

An 8086 CPU, chipset, 640 KB RAM, floppy drive, keyboard, mouse and
screen — in one `.css` file. It’s a morbidly obese 300+ MB of
spec-compliant CSS, abused beyond recognition: some of the most
delightfully painful and wasteful code ever cursed to exist.

It boots **Microsoft Windows 1.01** and its namesake **MS-DOS**, and
runs real ’80s software. Yes, it runs **DOOM**.\*

<sub>\* barely.</sub>

### ▶ [Play it in your browser — css-dos.ahmedamer.co.uk](https://css-dos.ahmedamer.co.uk)

The site builds a cabinet from a boxed program (Windows 1.01, DOOM,
Rogue, Zork…) or from any DOS program you hand it, then boots it —
and explains, section by scale-drawn section, how 300 MB of stylesheet
becomes a working computer.

## How is that possible?

CSS has no lists of instructions, no way to change a variable later,
and no way for a variable to reference itself. So instead of writing
*programs* in CSS, CSS-DOS emulates an entire *computer* — a CPU is a
fixed circuit whose outputs are a function of its inputs, and circuits
turn out to be a surprisingly natural fit:

- **The clock** is a tiny CSS animation ticking a counter; every
  formula in the file re-evaluates every tick, one instruction per tick.
- **Every register and byte of RAM** is a custom property recomputed
  by one all-encompassing `calc()` formula, every tick, forever.
- **Reading one byte of memory** means traversing an `if()` with
  743,948 arms — one per address. That single function is the length
  of nine complete works of Shakespeare.
- **The floppy disk** is baked into the stylesheet byte by byte —
  CSS can’t open files, so the entire disk ships inside the `.css`.
- **The screen** is 64,000 `<div>`s, each colouring itself from its
  own byte of video RAM. **The keyboard** is real buttons wired
  through `:active`. **The mouse** is the screen’s own pixels being
  clickable, feeding an emulated serial mouse.

A browser evaluates all of this at roughly **two instructions per
second** — three weeks to boot DOS, if it didn’t freeze first. So the
sibling project [**Calcite**](https://github.com/stop-amertime/calcite),
a JIT compiler for computational CSS (Rust → WebAssembly), runs the
same file **200,000× faster** — without adding, changing, or removing
a single byte of it, and bound by the project’s cardinal rule: it must
produce exactly what a spec-compliant browser would, byte for byte.
[Why that isn’t cheating →](https://css-dos.ahmedamer.co.uk/#about/calcite)

---

## The 30-second version (for developers)

A **cart** (folder or zip) contains a DOS program. The **builder** takes
a cart, picks a **BIOS**, assembles a **floppy**, feeds it to **Kiln**
(the transpiler), and produces a **cabinet** — a self-contained `.css`
file. You play a cabinet in Chrome via the **player**, or fast via
Calcite.

```
$ node builder/build.mjs carts/rogue -o rogue.css
$ npm run dev                              # Vite dev server on :5173
$ open http://localhost:5173/build.html    # build/load the cabinet, then play
```

Or run it fast through Calcite:

```
$ ../calcite/target/release/calcite-cli -i rogue.css
```

## Vocabulary

| Word | Meaning |
|---|---|
| **cart** | Input folder or zip: a program, any data files, optional `program.json`. |
| **floppy** | FAT12 disk image the builder assembles from a cart. Internal. |
| **cabinet** | The built artifact — a single `.css` file, runnable. |
| **Kiln** | The transpiler. Turns an 8086 memory image into CSS. |
| **builder** | Orchestrator. Wires up BIOS → floppy → Kiln. |
| **BIOSes** | Three flavors: **Gossamer** (hack-path shim), **Muslin** (assembly DOS BIOS), **Corduroy** (structured C DOS BIOS, default). |
| **player** | Static HTML at `web/player/calcite.html`; loads `/cabinet.css` (served from the SW cache via `build.html`). |
| **Calcite** | Sibling repo: the JIT that runs cabinets fast. |

## Start here

- New to the project? → [`docs/architecture.md`](docs/architecture.md)
- Making a cart? → [`docs/cart-format.md`](docs/cart-format.md) + [`docs/building.md`](docs/building.md)
- Hacking on the codebase? → [`CLAUDE.md`](CLAUDE.md) + [`docs/INDEX.md`](docs/INDEX.md)

## Repo layout

```
builder/         Orchestrator CLI and stages
kiln/            The transpiler (née transpiler/src)
bios/
  gossamer/      Hack BIOS
  muslin/        Assembly DOS BIOS
  corduroy/      Structured C DOS BIOS (default)
web/             Front-end: player (calcite.html, raw.html, bench.html), shim, dev server, prebake bins
                 Build/load page: web/site/build.html. Service worker: web/site/sw.js
conformance/     Reference emulators for diff testing
carts/           Example carts
dos/             DOS kernel + COMMAND.COM
tools/           Build utilities (mkfat12, image converters, js8086)
tests/           Conformance test programs
docs/            Full documentation
legacy/          Archived earlier approaches
```

## Status

See [`docs/logbook/STATUS.md`](docs/logbook/STATUS.md) for the live
project status. Current default cabinet path boots DOS + the cart's
program end-to-end. Rom-disk mechanism exposes disks outside 8086
memory, so cabinet size is no longer bounded by a floppy size.

## Credits

- Lyra Rebane ([rebane2001](https://github.com/rebane2001)) — the
  original [x86css](https://github.com/rebane2001/x86css), a 16-bit
  x86 CPU in pure CSS. CSS-DOS grew out of it.
- Jane Ori — the [CPU Hack](https://dev.to/janeori/expert-css-the-cpu-hack-4ddj).
- [emu8](https://github.com/nicknisi/emu8) — the reference 8086 emulator.
- [Doom8088](https://github.com/FrenkelS/Doom8088) by Frenkel Smeijers —
  id Software’s DOOM, ported to the 16-bit 8088/8086.
- EDR-DOS via [SvarDOS](https://svardos.org/), and Microsoft’s
  [MS-DOS 4.00](https://github.com/microsoft/MS-DOS) (MIT, 2024).

Full credits on [the site](https://css-dos.ahmedamer.co.uk/#about/credits).

## License

GNU GPLv3.
