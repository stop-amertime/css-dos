# CSS-DOS — About section copy
Extracted 2026-07-08 from the rendered site.
Edit freely, but keep the `## …` / `### …` section headers and the
`source:` lines intact so edits can be mapped back to the right file.
Code fences are verbatim exhibits — usually not copy to edit.

---

## PAGE: Home (hero)
source: web/site/src/routes/About.svelte (sub 1)

![CSS-DOS]

# A complete 1980s PC, in a stylesheet.

An IBM PC compatible — 8086 processor, 640 KB of RAM, floppy drive, keyboard, VGA screen, and various less-memorable support chips — in one CSS file.

It boots real **DOS** (the precursor to Windows) from an emulated floppy and runs unmodified 1980s software.

Yes, it runs **Doom***

The first time real programs have run in CSS!

* barely.

The file that does all this is about **300 MB of plain text**. Every line is spec-compliant CSS, albeit abused beyond recognition.

[★ View the source on GitHub](https://github.com/stop-amertime/css-dos)

---

## PAGE: Why?
source: web/site/src/routes/About.svelte (sub 2)

# Why?

> “Because it’s there”

> *— George Mallory, when asked why he climbed Everest.*

Cave paintings started with some spare blood being misused to represent a deer. Ten thousand years later, someone beat Dark Souls using the Bongo Drums controller from a Donkey Kong rhythm game, which only has three buttons and a microphone.

I’m under no illusion here: this project was excruciating to create and serves no practical benefit whatsoever. But it sits in that special nook between ‘might be technically possible’ and ‘impossible’ that draws the foolish and the brave recklessly in.

---

## PAGE: How is this possible?
source: web/site/src/routes/About.svelte (sub 3)

# How is this possible?

Everything in the machine is made of CSS variables — which are, basically, formulas. A variable can be defined in terms of other variables, so a variable can compute: every register, every byte of RAM, every pixel on the screen is a variable that works out its own value, the way a cell in a spreadsheet does.

CSS was never meant to compute anything, but over the years it has picked up the working parts of a programming language — the newest of them, `@function` and `if()`, only reached browsers in the last couple of years:

plain styling

```css
.box {
  background-color: blue;
  color: white;
  width: 120px;
}
```

box

what CSS is for

variables

```css
:root { --accent: red; }

.box {
  background-color: var(--accent);
}
```

box

store a value once, reuse it

functions

```css
@function --double(--n) {
  result: calc(var(--n) * 2);
}

.box {
  width: --double(60px);
}
```

box

this box is really sized by that function

branching

```css
.box {
  background-color: if(
    style(--on: 1): green;
    else: red
  );
}
```

box

no JavaScript — the `if()` picks the colour

Six abilities, between them, cover the whole computer. Each is a stop on the [How-it-works tour](#about/file):

- `calc()`, `mod()` and `round()` do real arithmetic — enough to build AND, OR and the rest of a CPU’s toolkit ([utility functions](#about/file/util))

- one typed variable per pair of bytes holds the state ([memory](#about/file/decl))

- an `if()` table per register spells out what every instruction does to it ([the CPU](#about/file/cpu))

- 64,000 `<div>`s each colour themselves from their byte of video memory ([the screen](#about/file/screen))

- the `:active` selector reads an on-screen keyboard ([the keyboard](#about/file/keys))

- one animation ticks a counter, and every formula in the file re-evaluates each tick ([the clock](#about/file/clock))

We have exactly one tool, and we are smacking every problem with it until it’s fixed. Some problems that a very slightly different tool would fix in one hit get smacked a million times instead. All of those smacks have to be written down — that’s how the file ends up at 300 MB of plain text:

EARTHMOON~60%

Take one step for every character in the file — letter, digit, etc. — and you’d walk **about 60% of the way to the Moon** (some 230,000 km).

A browser really will evaluate all of this — at about two instructions per second. At that speed, booting DOS takes a year and a half. So this site runs the same file through **Calcite**, a compiler that evaluates the same CSS about a hundred thousand times faster; [its own page](#about/calcite) explains how it works, and the rule that keeps it honest.

Lyra Rebane first built an [x86 CPU in CSS](https://lyra.horse/x86css/) with a limited instruction set — this extends that work to a full machine running an unmodified OS and real programs.

---

## PAGE: Calcite
source: web/site/src/routes/About.svelte (sub 5)

# Calcite

You can *try* to load a 300 MB stylesheet into your browser, but it will crash. Browsers simply weren’t built for that.

So I built a separate tool — **Calcite** — a JIT compiler for computational CSS. It’s much like Chrome’s own V8 engine, which compiles your JavaScript down to machine code before running it rather than plodding through the source line by line. Calcite does the same trick for CSS: it’s written in Rust, ships as WebAssembly, and runs entirely inside the browser tab.

On load it walks the whole stylesheet once, recognises the repetitive shapes a CPU emulator forces CSS into, and compiles them into fast native routines. Then it evaluates one frame, paints, and loops — orders of magnitude faster than a browser doing the same work by hand.

### Is this cheating?

No, and I’ve taken the question seriously. The whole point of the project is that the program is written in *real*, spec-compliant CSS. Calcite is allowed to make that CSS fast, but it is not allowed to change what the CSS *means*. Three things keep it honest:

1. **Compiling before running is normal.** Chrome does exactly this to your JavaScript via V8; the code you wrote is still JavaScript. Almost no language runs from raw source — even CPython compiles your `.py` files to bytecode and runs *that*. Calcite is the same idea pointed at CSS.

2. **The CSS would run identically without Calcite.** Feed the exact same cabinet to Chrome’s own style engine and you get the same pixels — just unbearably slowly. Calcite changes the speed, never the result.

3. **Calcite knows nothing about DOS, x86, or Doom.** This is the cardinal rule of the project: Calcite only ever reasons about the *shape* of CSS. It has no idea it’s running an emulator. Point it at any other computational stylesheet — a different CPU, a cellular automaton, a spreadsheet encoded in selectors — and it would speed those up too. Nothing about this machine is baked in.

If Calcite ever produced a different result than a real browser would, that would be a bug in Calcite — not a feature.

---

## PAGE: FAQs
source: web/site/src/routes/About.svelte (sub 6)

# FAQs

#### ▸ Really — no JavaScript?

Really — the machine is one CSS file, and a browser can evaluate every line of it; nothing you see comes from JavaScript. What a browser can’t do is keep up: 300 MB of stylesheet is more than a tab survives, and even a small build runs at a couple of instructions per second. So this site feeds the same file to **Calcite**, a compiler built for the job — [its page](#about/calcite) explains it, and why it isn’t cheating.

#### ▸ Don’t you need an HTML page for this to work?

Yes — a small, dumb one. A tag that loads the stylesheet, one element for the clock, one for the CPU, and 64,000 empty ones for the pixels. Nothing in it computes anything; it’s scaffolding for the CSS to hang off.

#### ▸ How can there be a clock? Nothing in CSS moves.

One thing in CSS moves by itself: animations. At the very bottom of the file a tiny animation ticks a counter — 0, 1, 2, 3, forever — and each lap the machine advances by one instruction. The [clock section](#about/file/clock) has the real keyframes, and the trick that lets 368,256 memory cells change at once.

#### ▸ How does it draw video?

The screen is 64,000 boxes, 320 wide by 200 tall, each with a rule that turns its own byte of video memory into a background colour. The [screen section](#about/file/screen) has the rules, the palette, and the faked electron beam.

#### ▸ How do you control it? CSS can’t see a keyboard.

It can’t. What it can see is whether an element is currently being pressed — the `:active` selector — so the machine has an on-screen keyboard whose keys are real buttons. The [keyboard section](#about/file/keys) shows the actual rules, live.

#### ▸ Why is there no sound?

CSS has nothing that makes noise — there is no audio property to abuse the way animations get abused for time. The PC speaker stays silent, so Doom runs mute.

#### ▸ Is Doom actually playable?

Barely — the asterisk on the intro page is honest. Through Calcite it manages a frame or two per second: enough to walk, open doors and shoot, a long way from comfortable.

#### ▸ Can it run my own programs?

Yes — that’s the Build step. Hand the builder any DOS program small enough for a floppy and it bakes the machine and your files into a fresh cabinet. The presets on the Build page were made the same way.

---

## PAGE: Credits & thanks
source: web/site/src/routes/About.svelte (sub 7)

# Credits & thanks

CSS-DOS stands on the shoulders of people who proved, piece by piece, that a browser’s style engine could be a computer.

### Prior art & kindred projects

- [x86CSS](https://lyra.horse/x86css/) — Lyra Rebane ([rebane2001](https://github.com/rebane2001/x86css)). A working 16-bit x86 CPU in pure CSS — the original demonstration that the trick is possible at all. CSS-DOS grew out of it.

- [The CSS CPU Hack](https://dev.to/janeori/expert-css-the-cpu-hack-4ddj) — Jane Ori. The writeup for doing real computation in CSS.

- [emu8](https://github.com/nicknisi/emu8) — the reference 8086 emulator CSS-DOS checks itself against.

### Operating system

- The booted OS is **EDR-DOS**, from the [SvarDOS](https://svardos.org/) build — an open, freely-distributable DR-DOS descendant. CSS-DOS ships its `kernel.sys` and `command.com` on the emulated floppy.

### Assets

- Font (headings, code, chrome): “Web437 IBM VGA” by VileR, from the [Oldschool PC Font Pack](https://int10h.org/oldschool-pc-fonts/) (int10h.org) — CC BY-SA 4.0.

- Font (body text): “[More Perfect DOS VGA](https://laemeur.sdf.org/fonts/)” by LÆMEUR, remastering Zeh Fernando’s “Perfect DOS VGA 437”; IBM designed the glyphs. Free for all use.

---

## PAGE: How it works (the file carousel)
source: web/site/src/routes/About.svelte (sub 4) + components/anatomy/*


### CAROUSEL SECTION: The whole file (map)
source: web/site/src/components/anatomy/SectionMap.svelte

The bar above is the whole cabinet — a real build (Sokoban, 309 MB), drawn to scale, in file order. Click any stripe, or use the arrows to walk the sections in order.

Two things are worth knowing before you go in. First, the thinking is nearly free: the CPU — every register, every instruction — is the hairline at the bar’s left edge, 255 KB, under a tenth of a percent of the file. Second, one fact of CSS explains most of the rest: a variable can be defined exactly once. There is no `x = y` — every variable is a single formula that has to anticipate, in advance, everything that could ever happen to it. The biggest stripe, 171 MB of dark blue, is the price of that, and it’s the last stop on the tour.

### CAROUSEL SECTION: Utility functions
source: web/site/src/components/anatomy/SectionUtil.svelte

After a short header comment (the build recipe, for humans opening the file), the first thing in the cabinet is a toolbox: **66 small functions** that everything else is built from. They exist because of a supply problem:

CSS arithmetic has

`x + y`✓

`x − y`✓

`x × y`✓

`x ÷ y`✓

`mod(x, y)`✓

`round(x)`✓

an 8086 needs

`x AND y`✗

`x OR y`✗

`x XOR y`✗

`x << n`✗

`x < y`✗

Everything in the right-hand column has to be built out of the left-hand column.

#### ▸ Background: AND, OR, and why a CPU needs them

Computers store numbers as **bits** — a 16-bit number is sixteen 0-or-1 digits. AND, OR and XOR combine two numbers one bit position at a time: AND keeps a 1 only where both numbers have a 1, OR where either does, XOR where exactly one does. Programs lean on them for all their small work — testing whether one bit is set, blanking out part of a number while keeping the rest, flipping pixels — and a bit-shift (sliding all the digits left or right) is how they multiply and divide by powers of two cheaply.

### Bit operations from arithmetic

On single bits, AND is multiplication: 1×1 is 1, everything else is 0. Line two numbers up in binary and multiply each column:

10101100 = 172

AND 01100110 = 102

= 00100100 = 36

Each column is one multiplication; only 1 × 1 survives.

So `--and` splits both numbers into their sixteen bits with divide-and-remainder, multiplies each pair, and reassembles the result:

```css
@function --and(--a <integer>, --b <integer>) returns <integer> {
  --a1: mod(var(--a), 2);
  --a2: mod(round(down, var(--a) / 2), 2);
  --a3: mod(round(down, var(--a) / 4), 2);
  /* … sixteen bits of --a, sixteen bits of --b … */
  result: calc(
    var(--a1) * var(--b1) +
    calc(var(--a2) * var(--b2)) * 2 +
    calc(var(--a3) * var(--b3)) * 4 +
    /* … */
```

OR and XOR come out of the same move: per bit, OR is `min(1, a + b)` and XOR is `a + b − 2ab`; NOT is `1 − a`.

### Comparisons from sign()

“Is A less than B?” is built from `sign()`, which returns −1, 0 or +1:

```css
max(0, sign(B - A - 0.5))    /* 1 if A < B, else 0 */
```

`sign(B − A)` is +1 when A is below B, 0 at a tie, −1 above; `max()` flattens everything that isn’t +1 to 0. A and B are whole numbers, so subtracting 0.5 pushes a tie safely below zero instead of landing on `sign()`’s awkward middle answer. The result is a clean 0 or 1 that can be fed straight into more arithmetic. This exact line is how subtraction decides whether it had to borrow ([the CPU](#about/file/cpu)’s carry flag), and how [the screen](#about/file/screen) fakes its 70-per-second retrace signal.

A 0-or-1 answer also stands in for “if” inside a formula: `flag × A + (1 − flag) × B` picks A or B. The machine even uses it to cancel memory writes: when a write shouldn’t happen, the same trick turns its target address into −1, which no memory cell answers to, and the write lands nowhere.

### The prebaked tables

Some of the functions don’t compute anything — the answers were worked out at build time and written into the file. `calc()` can’t raise 2 to a variable power, which is needed whenever a program shifts by an amount held in a register, so `--pow2` is just the answers:

```css
@function --pow2(--n <integer>) returns <integer> {
  result: if(
    style(--n: 0): 1;
    style(--n: 1): 2;
    style(--n: 2): 4;
    style(--n: 3): 8;
    /* … up to 2³¹ … */
```

And the 8086’s parity flag reports the number of 1-bits in a result. Nothing in CSS counts bits, so `--parity` carries the verdict for all 256 possible bytes:

```css
@function --parity(--val <integer>) returns <integer> {
  --low8: --lowerBytes(var(--val), 8);
  result: if(
    style(--low8: 0): 4;
    style(--low8: 1): 0;
    style(--low8: 2): 0;
    style(--low8: 3): 4;
    /* … all 256 byte values … */
```

The answers are 0 and 4 rather than 0 and 1. The parity flag sits at bit 2 of the flags register — worth 4 — so the table stores every answer already moved to its position, saving a shift on every arithmetic instruction.

### What else is in the box

The rest of the 66 sort into three rough families: byte plumbing, which splits and splices the two-bytes-per-cell memory (`--extractByte`, `--spliceByte`, `--applySlot` — the [write-formulas section](#about/file/memw) shows the last one at work); instruction decoding, which picks apart x86 operand bytes (`--getReg16`, `--modrmLen`); and thirty-six flag calculators (`--addFlags16`, `--shrFlags8`, …), which [the CPU section](#about/file/cpu) comes back to.

### CAROUSEL SECTION: CPU
source: web/site/src/components/anatomy/SectionCpu.svelte

This section is the fourteen registers — `--AX`, `--BX`, `--IP` and the rest — and the tables that define them. It is about 255 KB: less than a tenth of a percent of the file does all of the machine’s thinking.

#### ▸ Background: what a CPU does

Memory is a long row of numbered boxes, each holding a number from 0 to 255. A program is numbers sitting in those boxes, and some of the numbers are instructions: the sequence 184, 5, 0 means “put the number 5 into AX”. AX is a **register** — one of fourteen values the processor keeps directly to hand instead of in memory. Another register, IP, holds the address of the current instruction.

The processor’s whole job is a loop: read the number IP points at, do what it says, move IP past it, repeat. On a real chip that loop is wiring — nobody writes code to make a CPU fetch; it fetches because that’s what the silicon does. Here there is no silicon, so the loop has to be made of variables.

A register changes constantly: ADD puts a sum in AX, MOV loads a value into it, POP pulls one off the stack into it. But `--AX` is a CSS variable, and a variable gets exactly one definition. So the definition has to cover, in advance, everything that could ever happen to the register — one table, keyed on the current opcode, with a row for every instruction that can touch it:

```css
--AX: if(
  style(--_irqActive: 1): var(--snapshot-AX);  /* interrupt pending — hardware outranks the program this tick */
  else: if(
    style(--opcode: 0): …;    /* ADD, one flavour */
    style(--opcode: 1): …;    /* ADD, another */
    …                     /* every opcode that can touch AX */
    else: var(--snapshot-AX)));   /* untouched: keep the old value */
```

Note

Code here is real cabinet code, structurally exact — only the variable names are tidied for reading: `--__1IP` becomes `--snapshot-IP`.

Fourteen of these tables, one per register. Evaluating all fourteen against the current opcode, once, is how an instruction gets executed. The opcode itself is just another variable — the cabinet contains the line `--opcode: var(--q0)`, where `--q0` is the byte of memory IP points at, fetched through the giant function in the [read-formulas section](#about/file/memr).

All fourteen tables, drawn as one grid — a mark where a table has a row for an opcode:

opcode 0255AXCXDXBXSPBPSIDICSDSESSSIPflags

850 rows, 232 distinct opcodes — measured from the Sokoban cabinet. The IP row is full: every instruction has to say where the machine goes next. The blank columns are opcodes the 8086 never defined; the near-empty rows are the segment registers, which almost nothing is allowed to touch.

These tables are the same CSS in every cabinet: Doom’s CPU and Zork’s are byte-identical, and everything that differs between two cabinets is memory and disk.

### One instruction, all the way through

Opcode 5 is “add a number to AX”. When the snapshot says `--opcode: 5`, this row fires in the AX table:

```css
style(--opcode: 5): --lowerBytes(calc(var(--snapshot-AX) + var(--imm16)), 16);   /* ADD AX, imm16 */
```

New AX = old AX plus the number that followed the opcode in memory, trimmed back to 16 bits because registers wrap. The same opcode selects a row in the IP table:

```css
style(--opcode: 5): calc(var(--snapshot-IP) + 3);   /* ADD is three bytes long */
```

— stepping the machine past the three-byte instruction. A jump’s IP row computes a destination instead, and a backwards jump is how loops happen. Next tick, the fetch reads from the new IP.

One more table is involved. A real ADD circuit also reports, as side effects of the silicon, whether the sum overflowed, hit zero, or went negative. These reports are the **flags**, and programs check them constantly — every “if” in every program ends up as a flag check — so the flags table has its own row for opcode 5 and calls the machine’s real 16-bit ADD flag function — in full:

```css
@function --addFlags16(--dst <integer>, --src <integer>) returns <integer> {
  --raw: calc(var(--dst) + var(--src));
  --res: --lowerBytes(var(--raw), 16);
  --cf: min(1, round(down, var(--raw) / 65536));
  --pf: --parity(var(--res));
  --zfsf: calc(if(style(--res: 0): 64; else: 0) + --bit(var(--res), 15) * 128);
  --of: --addOF16(var(--dst), var(--src), var(--res));
  result: calc(var(--cf) + var(--pf)
    + calc(round(down, max(0, sign(mod(var(--dst), 16)
        + mod(var(--src), 16) - 15.5)) + 0.5) * 16)
    + var(--zfsf) + var(--of) + 2);
}
```

In there: `--cf` asks “did the true sum pass 65,535?” — divide by 65,536, round down, and that is the **carry flag** as a 1 or a 0. `--zfsf` asks “is the result zero?” and “is its top bit set?” (a 16-bit number’s way of being negative) — the **zero** and **sign** flags, each parked at its own bit position. `--pf`, the **parity flag**, comes from the 256-entry lookup table in the utility-functions section. The long line in the middle is the **half-carry** flag — “did the bottom four bits overflow?” — built out of `sign()` because CSS has no `<`. And the `+ 2` at the end is a bit the 8086 keeps permanently switched on.

In total, one ADD is a sum, a new IP, six flags and a table lookup — and ADD is one of the easiest instructions in the set.

### How a program decides anything

Programs branch — “if health is zero, die” — and a formula can’t branch; it computes one value. So a conditional jump is arithmetic too: `--bit()` pulls one flag out of the flags register as a 0 or a 1, and the jump multiplies its travel distance by it. This is the real IP row for JZ, “jump if zero”:

```css
style(--opcode: 116): --lowerBytes(calc(var(--snapshot-IP) + 2
  + --bit(var(--snapshot-flags), 6) * --u2s1(var(--q1))), 16);   /* JZ — jump if zero */
```

Taken, IP moves by the distance byte; not taken, it moves by zero times the distance byte. (`--u2s1()` reads the byte as signed, so the distance can be negative.)

Some conditions cost more. “Jump if less” is taken when the sign flag and the overflow flag disagree — an XOR, which CSS doesn’t have. The [utility section](#about/file/util) builds XOR out of multiplication, and here it is at work on two flag bits:

```css
/* JL, "jump if less": taken when the sign flag differs from the
   overflow flag — an XOR, done as a + b − 2ab on two flag bits */
calc(--bit(var(--snapshot-flags), 7) + --bit(var(--snapshot-flags), 11)
   - 2 * --bit(var(--snapshot-flags), 7) * --bit(var(--snapshot-flags), 11))
```

#### ▸ DIV, DAA, and the less reasonable instructions

DIV divides a 32-bit number — held across two registers, DX and AX — producing a quotient and a remainder at once. Two tables catch its output:

```css
/* AX takes the quotient */
round(down, calc((var(--snapshot-DX) * 65536 + var(--snapshot-AX)) / max(1, var(--rmVal16))))
/* DX takes the remainder */
mod(calc(var(--snapshot-DX) * 65536 + var(--snapshot-AX)), max(1, var(--rmVal16)))
```

The `max(1, …)` is there because a program can ask to divide by zero, and the formula has to stay legal CSS when it does.

This is DAA, “decimal adjust AL” — a calculator-era relic that patches up sums done on numbers stored as decimal digits. DOS-era programs really use it, so:

```css
style(--opcode: 39): calc(round(down, var(--snapshot-AX) / 256) * 256
  + mod(calc(var(--AL)
  + calc(min(1, calc(round(down, mod(var(--AL), 16) / 10)
  + mod(round(down, var(--snapshot-flags) / 16), 2))) * 6)
  + calc(min(1, calc(round(down, var(--AL) / 154)
  + mod(var(--snapshot-flags), 2))) * 96)), 256))
```

DAA needs to ask “is this 4-bit chunk bigger than 9?”, and with no `<` available it asks by dividing: `round(down, nibble / 10)` is 1 exactly for 10–15 and 0 otherwise. The whole family of decimal instructions runs on that idiom.

It goes on like this for **232 distinct opcodes — 850 rows** across the register tables.

#### ▸ How an interrupt arrives

A keypress or a timer tick has to be able to interrupt the running program between instructions. On real hardware that’s wiring; here it’s the override standing in front of every register table. When an interrupt is pending, the machine **refuses to run the instruction it just fetched** — no register takes its decoded value that tick. Instead: IP and CS load the interrupt handler’s address out of a table in memory, SP drops by six for the three pushed words, and the flags register switches interrupts off so the handler can’t itself be interrupted. The cycle counter even charges 61 cycles — what the real 8086 billed for a hardware interrupt.

Behind that sits a simulated interrupt controller — three variables tracking which interrupts are masked, pending, and currently being serviced, with the timer outranking the keyboard. When a handler finishes, it announces “end of interrupt”, and the controller clears the in-service bit with a classic bit hack: `x AND (x − 1)` deletes the lowest set bit of a number, no loop required.

One timing subtlety is kept faithfully: the 8086’s single-step trap fires *after* the traced instruction, not before. The machine reproduces that with a one-tick delay line — verbatim:

```css
--_tf: var(--__1_tfPending);   /* this tick's trap = LAST tick's request */
```

#### ▸ REP — the instruction that re-runs itself

One instruction, one tick — but some 8086 instructions are supposed to repeat. `REP MOVSB` copies CX bytes in one go, and memory copies use it constantly. A loop can’t run inside a single tick, because a tick is defined as exactly one instruction.

The fix: the instruction copies **one** byte, decrements CX, and — if CX is still above zero — computes its *next* instruction pointer to point back at itself. Next tick, the CPU fetches the very same `REP MOVSB` again, copies the next byte, and so on until CX reaches zero and IP finally moves past it. From the outside it looks like one instruction copying a whole block; underneath it’s the same instruction re-run N times by the clock.

#### ▸ The other chips: timer, interrupt controller, palette

A PC was never one chip, and programs talk to the rest of the machine directly: they program a **timer chip** to interrupt them 18.2 times a second, tell the **interrupt controller** which events to let through, stream colours into the **VGA palette**. Each of those chips is simulated the same way the registers are — a few more variables, with tables describing what the silicon would have done:

```css
--AX --CX --DX --BX --SP --BP --SI --DI   /* the registers … */
--CS --DS --ES --SS --IP --flags          /* … all fourteen */
--picMask --picPending --picInService     /* interrupt controller */
--pitMode --pitReload --pitCounter …      /* timer chip */
--prevKeyboard --kbdScancodeLatch         /* keyboard */
--dacWriteIndex --dacSubIndex …           /* VGA palette chip */
```

### Power-on

Nothing starts the machine. The clock animation begins ticking the moment the stylesheet loads, and on tick one the fetch simply reads from wherever CS:IP already point. The declarations put them there:

```css
@property --CS { … initial-value: 61440; }   /* 0xF000 — the BIOS ROM */
@property --IP { … initial-value: 0; }
```

That is linear address 983,040 — the first ROM entry in the [read-formulas section](#about/file/memr) — and the byte there is 235, a jump instruction. The machine’s first act is to jump into the BIOS proper, which sets up a stack, fills in the interrupt table, paints its splash screen, and jumps again, into DOS. Power arrives, the processor wakes up pointing at firmware, and everything else follows — a cold boot, the same way a real PC did it.

### CAROUSEL SECTION: Keyboard & debug display
source: web/site/src/components/anatomy/SectionKeys.svelte

The smallest section in the file. Alongside the keyboard rules it carries a small debug read-out — the registers drawn on screen with CSS counters — but the interesting part is the keys.

CSS has no input events. The one thing it can ask is **`:active`** — “is this element being pressed, right now?” The player’s on-screen keys are real buttons, and these are the cabinet’s actual rules:

```css
.cpu:has(#kb-a:active) {
  --keyboard: 7777;
}
.cpu:has(#kb-s:active) {
  --keyboard: 8051;
}
.cpu:has(#kb-d:active) {
  --keyboard: 8292;
}
/* … one rule per key … */
```

--keyboard:

hold a key — even this readout is pure CSS

Each number packs the key’s hardware scancode with its text character (A: 30 × 256 + 97 = 7777). Release, and it snaps back to **0** — that’s how games see you let go.

### The release-code latch

Real keyboards also send a *release* code when a key comes back up, and games depend on it — it’s how Doom knows you stopped moving. But `:active` only stops matching for the single instant you let go, and programs usually don’t check the keyboard until a few ticks later — by then that instant is gone, and the key would look held down forever. So the machine keeps a **latch**: one variable holding the most recent key event, press or release, until the next one replaces it.

### The debug read-out

The section’s other job is printing the registers on screen, which runs into a missing tool: CSS has no way to display a number. `content` only prints text, and nothing converts the integer in `--AX` into the characters “31022”. The one thing in CSS that takes an integer and produces digits is a **counter** — the machinery meant for numbering chapters and list items. So the registers are displayed as chapter numbers:

```css
.cpu::after {
  counter-reset: AX var(--AX) BX var(--BX) CX var(--CX) … IP var(--IP);
  content: "\a --AX: " counter(AX) "\a --BX: " counter(BX) …;
}
```

Honest limits

CSS cannot see your physical keyboard — no selector reacts to a real keypress, so every program is piloted from the on-screen keys. And CSS cannot make sound — the PC speaker stays silent.

### CAROUSEL SECTION: Screen
source: web/site/src/components/anatomy/SectionScreen.svelte

CSS can’t draw pixels. It can colour elements. So the screen is **one <div> per pixel** — 64,000 of them, 320 wide by 200 tall — each with a rule that reads its own byte of video memory:

```css
#pixel-0 {
  background: --palette(var(--vram-0));
}
#pixel-1 {
  background: --palette(var(--vram-1));
}
#pixel-2 {
  background: --palette(var(--vram-2));
}
/* … 63,997 more, one per pixel … */
```

…⋱= 64,000<div>s320 pixels200 rows

Each rule reads its pixel’s byte of video memory (`--vram-…`) and looks the colour up in the palette. No image, no canvas — when a game draws, it writes bytes, and divs change colour.

When a program writes to video memory, the divs whose bytes changed recalculate their `background-color`, and the picture changes. These 64,000 rules are 6.5 MB of the file, and they’re always in it — this is the pure-CSS renderer, proven to paint in real Chromium.

Each rule is one line. Pixel 31,840 — row 99, column 160, the middle of the screen — is:

```css
#p31840 { --ci: mod(var(--snapshot-mc343600), 256); background-color: --paletteRGB(var(--ci)); }
```

`mod()` digs the pixel’s byte out of its packed memory cell, and the palette function turns that byte into a colour.

### The palette — how 256 colours get chosen

A pixel’s byte isn’t a colour; it’s an index into a palette of 256. The palette isn’t fixed either — the running program loads its own, and the machine accepts it exactly the way real VGA hardware did: to set one colour, the program writes three bytes — red, green, blue — to a single port, while a small counter steps 0, 1, 2 and rolls over to the next colour slot. When a game fades to black, it is re-streaming the whole table a little darker, over and over.

The lookup itself is a shared 256-way `if()` function, `--paletteRGB`, that turns the live palette into an actual `rgb(…)` value for each div:

```css
@function --paletteRGB(--idx <integer>) returns <color> {
  result: if(
    style(--idx: 0): rgb(round(mod(var(--snapshot-mc524288), 256) * 255 / 63)
                         round(round(down, var(--snapshot-mc524288) / 256) * 255 / 63)
                         round(mod(var(--snapshot-mc524289), 256) * 255 / 63));
    /* … all 256 palette slots … */
    else: rgb(0 0 0));
}
```

The mess inside `rgb()` is three live memory reads — red, green, blue — each scaled by 255/63 because a real VGA’s palette chip only kept six bits per channel: programs wrote brightnesses from 0 to 63, and the machine honours that. Of the file’s thousands of functions, this is the only one that returns a colour — everything else in 300 MB computes integers.

#### ▸ The palette read-back cursor

There’s a second, separate cursor for *reading* the palette back — a fade effect wants to know the current colours before dimming them, and real VGA hardware let it ask without disturbing the write cursor. So does this one.

### Text mode & CGA — the shared bytes

Mode 13h isn’t the only screen the machine carries. Text mode — the 80×25 grid the DOS prompt lives on — is its own region of video memory at a different address: two bytes per character, the letter and its colours. And the older CGA graphics modes have their own aperture… which **overlaps the text region**. The same memory cells serve both, on purpose, because that’s genuinely how 1981 CGA hardware behaved — the aliasing is part of the machine being faithful.

The pure-CSS painter above only draws Mode 13h. For the other modes the cabinet stores everything a renderer needs — including copying the current video mode and the CGA palette register into two spare bytes of the BIOS data area, so the outside of the machine can tell which screen the program meant. That register carries one famous bit: the choice between CGA’s two four-colour palettes, green/red/yellow or cyan/magenta/white — the reason so many old PC games are those exact colours.

### The electron beam

One more thing games ask the screen: “is the monitor mid-redraw?” A 1981 monitor painted the picture with an electron beam, top to bottom, 70 times a second — and games wait for the beam’s flyback (the *vertical retrace*) to redraw without tearing. They poll a status port for it, constantly.

There is no beam. The machine fakes its position from a number the CPU already tracks — the running count of cycles each instruction would have cost on the real 4.77 MHz chip. One seventieth of a second is 68,182 cycles, and the beam spends about 5% of each frame flying back, so:

```css
/* in retrace? — 1 while the beam would be flying back */
max(0, sign(3409 - mod(var(--snapshot-cycleCount), 68182)))
```

The electron beam of a CRT monitor, reduced to a `mod()` and a `sign()`. Games genuinely synchronise to it.

### CAROUSEL SECTION: Memory — variable declarations
source: web/site/src/components/anatomy/SectionMemDecl.svelte

Before CSS lets you use a variable as a typed integer, you have to declare it. The file declares every memory cell — all **368,256** of them. This one is verbatim:

```css
@property --mc5000 {
  syntax: '<integer>';
  inherits: true;
  initial-value: 32861;
}
```

The `initial-value` is that cell’s power-on contents. Which means the machine’s entire starting state — the BIOS, the boot sector, the blank RAM — is written into the declarations: Sokoban’s memory at the moment of switch-on, spelled out one cell at a time. 32 MB before anything has happened.

Do we really have to write `inherits: true` 368,256 times? Yes. The spec makes `inherits` a required descriptor of `@property` — leave it out and the whole rule is invalid and silently ignored. It can’t be `false` either: the memory variables live on the CPU element but get read by its descendants — every pixel of the screen, for instance, reaches its byte of video memory through inheritance. Set it to `false` and the pixels would see each cell’s power-on value instead of the live one, and the screen would freeze on the boot picture forever.

So that one line, seventeen-ish bytes at a time, adds up to about 6 MB of the file — roughly the size of the entire pixel painter, spent saying “yes, inherit” a third of a million times.

### One cell, four variables

There’s a wrinkle: `--mc5000` isn’t the only variable for that cell. The [clock section](#about/file/clock) explains why every tick has to read a frozen snapshot of memory while the new values are being computed — and that trick needs each cell to exist as **four** variables: the freshly computed value, the snapshot the formulas read, and two hand-over copies that pass results to the next tick.

Yet only the first one is ever declared. The other three have no `@property` block anywhere in the file — an unregistered CSS variable simply springs into existence the first time something assigns it. What they *do* need is the power-on value, for the very first tick, before anything has been handed over. It rides along as a fallback, right inside their plumbing lines (variable names tidied for reading — the real ones are `--__1mc5000` and friends):

```css
--snapshot-mc5000: var(--staged-mc5000, 32861);
--staged-mc5000: var(--held-mc5000, 32861);
```

If the staged copy doesn’t exist yet — tick one, nothing stored — the snapshot falls back to 32861, the declared power-on value. Which means every byte of the machine’s starting memory is actually written into the file **three times**: once as an `initial-value`, and twice more as fallbacks.

The one optimisation

Memory is **packed two bytes per variable** (32861 is really the two bytes 93 and 128), so every sweep over memory mentions half as many cells as there are bytes. Without it, everything memory-related in the file doubles.

### CAROUSEL SECTION: Memory — read formulas
source: web/site/src/components/anatomy/SectionMemRead.svelte

Reading sounds like the easy half — nothing changes, you just look at a value. It isn’t. Every memory cell is its own variable; an address is just a number; and CSS gives no way to get from the number to the variable. The very first thing a CPU does every tick — fetch the byte its instruction pointer points at — is already impossible to write directly.

The machine’s answer is `--readMem`: **one single function** with one arm for every address it could ever be asked about — 743,948 of them. Not a table, not a list of functions: one `if()`, forty-four million characters long, that simply asks “is it address 0? is it address 1? is it address 2?” until it hits yours.

any programming language

```css
opcode = memory[IP];
```

CSS — verbatim from the cabinet

```css
@function --readMem(--at <integer>) returns <integer> {
  result: if(
    style(--at: 0): mod(var(--__1mc0), 256);
    style(--at: 1): round(down, var(--__1mc0) / 256);
    style(--at: 2): mod(var(--__1mc1), 256);
    style(--at: 3): round(down, var(--__1mc1) / 256);
    style(--at: 4): mod(var(--__1mc2), 256);
    style(--at: 5): round(down, var(--__1mc2) / 256);
    style(--at: 6): mod(var(--__1mc3), 256);
    style(--at: 7): round(down, var(--__1mc3) / 256);
    style(--at: 8): mod(var(--__1mc4), 256);
    style(--at: 9): round(down, var(--__1mc4) / 256);
    style(--at: 10): mod(var(--__1mc5), 256);
    style(--at: 11): round(down, var(--__1mc5) / 256);
    style(--at: 12): mod(var(--__1mc6), 256);
    style(--at: 13): round(down, var(--__1mc6) / 256);
    style(--at: 14): mod(var(--__1mc7), 256);
    style(--at: 15): round(down, var(--__1mc7) / 256);
    style(--at: 16): mod(var(--__1mc8), 256);
    style(--at: 17): round(down, var(--__1mc8) / 256);
    style(--at: 18): mod(var(--__1mc9), 256);
    style(--at: 19): round(down, var(--__1mc9) / 256);
    style(--at: 20): mod(var(--__1mc10), 256);
    style(--at: 21): round(down, var(--__1mc10) / 256);
    style(--at: 22): mod(var(--__1mc11), 256);
    style(--at: 23): round(down, var(--__1mc11) / 256);
    style(--at: 24): mod(var(--__1mc12), 256);
    style(--at: 25): round(down, var(--__1mc12) / 256);
    style(--at: 26): mod(var(--__1mc13), 256);
    style(--at: 27): round(down, var(--__1mc13) / 256);
    style(--at: 28): mod(var(--__1mc14), 256);
    style(--at: 29): round(down, var(--__1mc14) / 256);
    style(--at: 30): mod(var(--__1mc15), 256);
    style(--at: 31): round(down, var(--__1mc15) / 256);
    style(--at: 32): mod(var(--__1mc16), 256);
    style(--at: 33): round(down, var(--__1mc16) / 256);
    style(--at: 34): mod(var(--__1mc17), 256);
    style(--at: 35): round(down, var(--__1mc17) / 256);
    style(--at: 36): mod(var(--__1mc18), 256);
    style(--at: 37): round(down, var(--__1mc18) / 256);
    style(--at: 38): mod(var(--__1mc19), 256);
    style(--at: 39): round(down, var(--__1mc19) / 256);
    style(--at: 40): mod(var(--__1mc20), 256);
    style(--at: 41): round(down, var(--__1mc20) / 256);
    style(--at: 42): mod(var(--__1mc21), 256);
    style(--at: 43): round(down, var(--__1mc21) / 256);
    style(--at: 44): mod(var(--__1mc22), 256);
    style(--at: 45): round(down, var(--__1mc22) / 256);
    style(--at: 46): mod(var(--__1mc23), 256);
    style(--at: 47): round(down, var(--__1mc23) / 256);
    style(--at: 48): mod(var(--__1mc24), 256);
    style(--at: 49): round(down, var(--__1mc24) / 256);
    style(--at: 50): mod(var(--__1mc25), 256);
    style(--at: 51): round(down, var(--__1mc25) / 256);
    style(--at: 52): mod(var(--__1mc26), 256);
    style(--at: 53): round(down, var(--__1mc26) / 256);
    style(--at: 54): mod(var(--__1mc27), 256);
    style(--at: 55): round(down, var(--__1mc27) / 256);
    style(--at: 56): mod(var(--__1mc28), 256);
    style(--at: 57): round(down, var(--__1mc28) / 256);
    style(--at: 58): mod(var(--__1mc29), 256);
    style(--at: 59): round(down, var(--__1mc29) / 256);
    style(--at: 60): mod(var(--__1mc30), 256);
    style(--at: 61): round(down, var(--__1mc30) / 256);
    style(--at: 62): mod(var(--__1mc31), 256);
    style(--at: 63): round(down, var(--__1mc31) / 256);
    style(--at: 64): mod(var(--__1mc32), 256);
    style(--at: 65): round(down, var(--__1mc32) / 256);
    style(--at: 66): mod(var(--__1mc33), 256);
    style(--at: 67): round(down, var(--__1mc33) / 256);
    style(--at: 68): mod(var(--__1mc34), 256);
    style(--at: 69): round(down, var(--__1mc34) / 256);
    style(--at: 70): mod(var(--__1mc35), 256);
    style(--at: 71): round(down, var(--__1mc35) / 256);
    style(--at: 72): mod(var(--__1mc36), 256);
    style(--at: 73): round(down, var(--__1mc36) / 256);
    style(--at: 74): mod(var(--__1mc37), 256);
    style(--at: 75): round(down, var(--__1mc37) / 256);
    style(--at: 76): mod(var(--__1mc38), 256);
    style(--at: 77): round(down, var(--__1mc38) / 256);
    style(--at: 78): mod(var(--__1mc39), 256);
    style(--at: 79): round(down, var(--__1mc39) / 256);

         … 736,430 more arms like these — every byte of RAM …

    style(--at: 983040): 235;
    style(--at: 983041): 16;
    style(--at: 983042): 144;
    style(--at: 983043): 144;

         … 6,920 more baked-in BIOS ROM bytes …

    style(--at: 851968): --readDiskByte(calc((mod(var(--__1mc632), 256) + round(down, var(--__1mc632) / 256) * 256) * 512 + 0));
    style(--at: 851969): --readDiskByte(calc((mod(var(--__1mc632), 256) + round(down, var(--__1mc632) / 256) * 256) * 512 + 1));

         … 510 more — the 512-byte disk window …

  else: 0);
}
```

One function, **743,948 arms** — one per address. Just this function, the part of the file that reads one byte, is **44 million characters**: nine complete works of Shakespeare.

Three different kinds of thing live inside that one function, and you can see all three in the tower above.

### The RAM arms — 736,510 of them

The overwhelming bulk. Memory cells hold two bytes each, so every cell gets a pair of arms: the even address extracts the low byte (`mod(…, 256)`), the odd address the high byte (divide by 256, round down). These arms read the live machine — whatever a program has written is what comes back.

Two arms hiding in the middle of the RAM range aren’t memory at all: addresses 1280 and 1281 are wired straight to the live keyboard value. When the BIOS keyboard service reads those addresses, it gets real keypresses through the same function as everything else:

```css
style(--at: 1280): --lowerBytes(var(--snapshot-keyboard), 8);
style(--at: 1281): --rightShift(var(--snapshot-keyboard), 8);
```

### The BIOS ROM arms — 6,924

The BIOS is read-only, so its bytes don’t need cells — each one is baked in as a literal constant: `style(--at: 983040): 235;`. Bytes that are zero are omitted entirely (the `else: 0` at the bottom of the function answers for them), which is why a 64 KB ROM region needs only 6,924 arms.

### The disk window — 512, at the very end

The last 512 arms are the strangest. They don’t hold anything: each one computes “requested sector × 512 + my offset” — the sector number itself read out of a memory cell — and passes the question through to the disk function. Those 512 addresses are a *view* onto whichever sector was last asked for. The [disk section](#about/file/disk) picks it up from there.

736,510 + 6,924 + 512 + 2 = 743,948. Then `else: 0);`, and the function ends.

### CAROUSEL SECTION: Disk
source: web/site/src/components/anatomy/SectionDisk.svelte

CSS can’t open anything at runtime — no files, no requests, no loading. Whatever the machine will ever need has to be in the stylesheet before it starts: the BIOS, DOS itself, and the entire floppy disk, baked in byte by byte — one `if()` arm each:

```css
@function --readDiskByte(--idx <integer>) returns <integer> {
  result: if(
    style(--idx: 0): 235;
    style(--idx: 1): 60;
    style(--idx: 2): 144;
    /* … one arm per byte of the floppy … */
```

(Verbatim, and already meaningful: 235, 60, 144 is the x86 jump instruction that every FAT boot sector opens with. Byte zero of the disk is the first thing the machine boots.)

### The window

DOS never reads the disk all at once — it asks the floppy controller for one sector at a time: “give me sector 57.” So the machine keeps a 512-byte **window** in memory whose contents are not stored anywhere: those 512 addresses read *through* to the disk table, at “requested sector × 512 + offset”. Ask for a different sector and the same window now shows different bytes. DOS copies them out and never learns the disk is a fiction.

Window byte 48’s actual arm, in full:

```css
style(--at: 852016): --readDiskByte(calc(
  (mod(var(--snapshot-mc632), 256) + round(down, var(--snapshot-mc632) / 256) * 256) * 512 + 48));
```

The clutter in the middle is the sector number being dug out of memory cell 632 — the “which sector do you want” register is itself two bytes of ordinary RAM. DOS writes a number there, and 512 addresses instantly mean a different part of the disk.

This is the one section that grows with the game — Sokoban’s disk is 13 MB of the file; Doom’s 1.3 MB floppy takes its cabinet to ~330 MB. It doesn’t shrink much either: the machine itself costs ~296 MB before any game arrives, so Zork — 85 KB of words on a screen — still comes out around 300 MB.

### Writable disks

Everything above is read-only — each disk byte is a literal baked into an `if()` arm, and there is nothing to write *to*. Fine for games; useless for saving your work. So a cart can opt in to a second mode (the “Writable” checkbox on the Build page): every byte of the floppy also becomes an ordinary memory cell — the same kind that holds RAM — whose starting value is the factory disk. Reads stop consulting the baked table and ask the cells instead, and the write machinery that already serves RAM now serves the floppy too. Save a file in the MS-DOS 4.00 cart’s EDIT and `DIR` shows it; the disk lives exactly as long as the tab, and a reload is a fresh factory floppy.

It isn’t free. A byte that can change needs a cell declaration, a read formula and a write formula — roughly ten times the text of a byte that just *is*, about 0.4 MB of cabinet per KB of floppy. Flip the switch on Sokoban’s 720 K floppy and the cabinet gains ~270 MB, landing near **570 MB** — past the ~536 MB where Chrome refuses to hold the file in one string at all, so a writable Sokoban literally cannot ship. Ticks slow about 2× too (more cells to consider). That’s why it’s opt-in per cart, and why the writable MS-DOS 4.00 floppy is a deliberately small 480 K.

#### ▸ A real, bootable floppy

The disk isn’t a loose pile of files — it’s a genuine FAT12 floppy image, the same format a 1980s drive wrote, assembled at build time from the cart’s files with DOS’s boot sector and kernel in place. DOS reads its directory tables and follows its cluster chains exactly as it would on hardware. (Zero bytes are skipped in the lookup, so sparse disks are cheaper than their nominal size.)

### CAROUSEL SECTION: Clock
source: web/site/src/components/anatomy/SectionClock.svelte

Exactly one thing in CSS changes on its own: an **animation**. At the very bottom of the file, after 300 MB of formulas, sits the thing that runs them — verbatim:

```css
.clock {
  animation: anim-play 400ms steps(4, jump-end) infinite;
  --clock: 0;
}

@keyframes anim-play {
  0% { --clock: 0 }
  25% { --clock: 1 }
  50% { --clock: 2 }
  75% { --clock: 3 }
}
```

A counter ticking 0, 1, 2, 3, forever. Each lap, every formula in the file re-evaluates once and the machine advances by one CPU instruction. These few lines are the smallest section of the cabinet and its only moving part.

### Why four beats and not one?

Because a formula isn’t allowed to refer to itself. A memory cell’s next value is computed from its current one — but written as one variable, that’s a circular definition, and CSS rejects it. So every cell exists as **several** variables: the copy the formulas read, and the copies used to hand each tick’s results across to the next tick. Here is one cell’s full plumbing:

```css
/* always in force: the snapshot — the copy every formula reads —
   is wired to the staged copy from last tick */
--snapshot-mc5000: var(--staged-mc5000, 32861);

/* always in force: the next value, computed from snapshots only
   (this is the write formula from the write-formulas section) */
--mc5000: …;

/* beat 3 — the "execute" keyframe: park the computed value */
--held-mc5000: var(--mc5000);

/* beat 1 — the "store" keyframe: stage the parked value
   so it becomes the NEXT tick's snapshot */
--staged-mc5000: var(--held-mc5000, 32861);
```

Follow one lap of the clock. The formulas compute the whole machine’s next state, reading only the frozen snapshots. On beat 3, the results are parked in the *held* copies. On beat 1 of the next lap, the parked values move into the *staged* copies — and since the snapshots are wired to those, every formula now sees the new state, and computes the tick after. Round and round.

The reason for the two-step handover: each copy is written at one beat and read at another, so nothing is ever read and overwritten at the same moment. The machine never sees a half-updated version of itself — every tick gets a clean before-picture, even though 368,256 cells and fourteen registers all change “at once.”

```css
@keyframes tick {
  0%   { --clock: 0 }
  25%  { --clock: 1 }
  50%  { --clock: 2 }
  75%  { --clock: 3 }
}
.cpu {
  animation: tick 400ms
    steps(4) infinite;
}
```

0 rest nothing moves

1 copy in the buffer becomes the snapshot every formula reads

2 compute every formula re-derives from the fresh snapshot

3 copy out the results are parked in the buffer for next tick

The moving highlight is itself a CSS animation — the same mechanism, slowed 8×. The cabinet’s clock does a full lap every 400 ms; Calcite runs the same lap hundreds of thousands of times a second.

And that is where the 43 MB goes: the animation is 0.1 KB, but the three plumbing lines have to be written out per cell — three sweeps over all of memory (15 + 15 + 13 MB). The registers get the same treatment in a much smaller block inside the CPU.

### The other clock — the one DOS sees

The animation is the machine’s heartbeat, but DOS has never heard of it. What DOS expects is the PC’s **timer chip**, interrupting it 18.2 times a second — that’s how it keeps the time of day, and how games pace themselves. CSS can’t read a wall clock, so the timer is derived from a number the CPU already tracks: a running tally of the cycles each instruction *would have cost* on the real 4.77 MHz chip.

The tally is one more register table — every instruction’s row adds what Intel’s 1978 manual billed for it:

```css
style(--opcode: 144): calc(var(--snapshot-cycleCount) + 3);   /* NOP: 3 cycles */
style(--opcode: 136): calc(var(--snapshot-cycleCount)
  + if(style(--mod: 3): 2; else: 9));   /* MOV: 2 — or 9 if memory is involved */
style(--opcode: 212): calc(var(--snapshot-cycleCount) + 83);  /* AAM: 83 — division was expensive */
```

The gearing is real 1981 engineering: the PC’s timer chip ran at exactly one quarter of the CPU’s clock, so the machine’s timer ticks are simply `cycleCount / 4`. The chip is simulated down to its quirks — in its default square-wave mode the counter genuinely counts down by *two* per tick, and its 16-bit reload value has to arrive as two separate byte writes before the count starts, just like the real part. Every time the counter crosses zero, the timer interrupt fires and DOS’s clock advances.

So the machine keeps two times: the CSS animation decides how fast the world computes, and the cycle counter decides what the software *believes* the time is. Evaluate the file faster and everything speeds up together, still in step — DOS’s sense of time is tied to work done, not to your wall clock.

### How one animation conducts two more

The store and execute steps are themselves `@keyframes` — and an animation can’t call another animation. So the cabinet attaches both to the CPU permanently, **paused**, and the clock unpauses each one for a single beat — verbatim:

```css
.cpu {
  animation: store 1ms infinite, execute 1ms infinite;
  animation-play-state: paused, paused;
  @container style(--clock: 1) { animation-play-state: running, paused }
  @container style(--clock: 3) { animation-play-state: paused, running }
```

### CAROUSEL SECTION: Memory — write formulas
source: web/site/src/components/anatomy/SectionMemWrite.svelte

The single biggest section of the file, and the reason for most of its size. It exists because of the difference between CSS and every other language.

Normal programming languages are a list of instructions, run in order — a recipe. They assign: `x = y`, and x changes. A stylesheet has no order: every rule in it is in force the whole time, more like a blueprint than a recipe. There is no moment at which x *becomes* y — you can only declare, once, what x *is*:

```css
--x: 5;
```

So the definition itself has to do the work: each byte of memory is written as a formula that works out, every tick, what its value now is — closer to how a spreadsheet cell works than to a line of code. The formula asks one question — did this tick’s instruction write to *my* address? Three **write slots** carry the answer: small variables holding the addresses and values of whatever the current instruction writes.

```css
/* every byte of RAM is this formula */

byte N = IF this instruction
           writes to address N:
             the value being written
       ELSE:
             last tick’s value of N
```

0 00000

85 00001

238 00002

0 00003

12 00004

7 00005

press run — watch every formula re-evaluate

Naturally, this means every byte has to re-check its formula every single tick, whether it was written or not. In a normal programming language, `x = y` changes x and touches nothing else. Here, an instruction that writes one byte — or no bytes at all — still makes all 650,000 write formulas ask their question again. This is massively inefficient.

More than half the file (171 MB) is this single formula, written out once per memory cell.

### How a write actually lands

Cells hold two bytes each, so “write this byte here” means *splicing* a value into half of a cell without disturbing the other half. One function does it, and every cell’s formula calls it once per write slot — verbatim:

```css
@function --applySlot(--cell, --live, --loOff, --hiOff, --val, --width) returns <integer> {
  result: if(
    style(--live: 0): var(--cell);                /* slot idle — pass through */
    style(--width: 2) and style(--loOff: 0) and style(--hiOff: 1):
      --lowerBytes(var(--val), 16);              /* whole word, aligned */
    style(--width: 2) and style(--loOff: 1):
      calc(--lowerBytes(var(--val), 8) * 256 + mod(var(--cell), 256));   /* word straddles me: low half */
    style(--width: 2) and style(--hiOff: 0):
      calc(round(down, var(--cell) / 256) * 256 + --rightShift(var(--val), 8));   /* word straddles me: high half */
    style(--loOff: 0): calc(round(down, var(--cell) / 256) * 256 + var(--val));   /* one byte, low */
    style(--loOff: 1): calc(var(--val) * 256 + mod(var(--cell), 256));            /* one byte, high */
  else: var(--cell));
}
```

The middle two cases are the awkward one: a 16-bit write to an odd address lands half in one cell and half in the next, so *both* cells fire, each splicing in its own half. And in every cell’s formula the three slot calls are nested with slot 0 outermost, so if two slots ever hit the same cell, slot 0 wins.

Assembled, this is one cell of the machine — verbatim, names tidied as usual, the middle slot elided:

```css
--mc5000: --applySlot(--applySlot(--applySlot(var(--snapshot-mc5000),
      var(--_slot2Live), calc(var(--memAddr2) - 5000 * 2),
      calc(var(--memAddr2) + 1 - 5000 * 2), var(--memVal2), var(--_writeWidth)),
    /* … slot 1, the same shape … */),
  var(--_slot0Live), calc(var(--memAddr0) - 5000 * 2),
  calc(var(--memAddr0) + 1 - 5000 * 2), var(--memVal0), var(--_writeWidth));
```

This line, once per cell — 368,256 times, each with its own address baked into the arithmetic — is the 171 MB.

Why stop at two bytes per cell, when four would halve everything again? Arithmetic: four packed bytes can reach past four billion, beyond what the 32-bit signed integers all this maths must survive in can hold. Two bytes tops out at 65,535 and is always safe.

#### ▸ Why exactly three write slots

The worst case is a hardware interrupt or an `INT` instruction, which pushes three 16-bit words onto the stack in a single tick — the flags, the code segment, and the return address. Everything else needs fewer, so three slots cover the whole instruction set.

Each slot also carries a **live gate** — a 0/1 saying whether it fires this tick. Most instructions don’t write memory at all, and the gate lets all 650,000 write formulas short-circuit at once: “no slot is live, nothing changes” — without checking a million addresses one by one.
