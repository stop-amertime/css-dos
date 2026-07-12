# Anatomy of a CSS-DOS cabinet

*A byte-by-byte tour of the `.css` file that is a working PC.*

A **cabinet** is the single `.css` file CSS-DOS emits. Open it in a
browser (or the Calcite runner) and it *is* a complete 1980s PC: an
Intel 8086 CPU, 640 KB of RAM, a floppy disk, a keyboard, and a VGA
screen — all expressed as Cascading Style Sheets. No JavaScript runs the
machine. The CSS *is* the machine.

This document picks one apart. The reference cabinet here is **Sokoban**,
a typical small DOS game, which comes out to **~309 MB** of CSS. (Doom is
the same shape, ~330 MB — the size is dominated by the game's own data,
not by the machine.) Sizes below are measured from that real file.

A quick sense of proportion before we start. **The CPU — the part that
actually computes — is about 300 KB, one tenth of one percent of the
file.** Everything else, the other 99.9%, is *memory*: one small CSS rule
for every single byte of RAM and every byte on the disk, repeated
hundreds of thousands of times. Almost the entire file is the machine's
memory written out longhand; only a sliver is the processor that acts on
it.

Here is the whole file, top to bottom, with real sizes:

| # | Section | Size (Sokoban) | What it is |
|---|---|---:|---|
| 1 | Header comment | 25 KB | Human-readable "birth certificate" |
| 2 | Utility functions | 15 KB | Math the CSS engine can't do natively (AND, OR, shifts…) |
| 3 | Instruction decode | 27 KB | How to read an 8086 instruction |
| 4 | Engine + fetch/decode | 21 KB | The clock, and per-tick instruction prep |
| 5 | **Register dispatch tables** | **225 KB** | **The CPU itself** — every opcode |
| 6 | Memory write slots + gates | 30 KB | How a write finds its destination |
| 7 | Keyboard | 4 KB | `:active` key rules |
| 8 | Mode 13h pixel painter | 6.5 MB | 64,000 pixels, each a CSS rule |
| 9 | Property declarations | 32 MB | Declaring every memory cell exists |
| 10 | Memory read function | 44 MB | Reading any byte of RAM/ROM |
| 11 | Disk read function | 13 MB | Reading any byte of the floppy |
| 12 | Double-buffer reads | 15 MB | "Last tick's memory" |
| 13 | **Memory write rules** | **171 MB** | **The single biggest thing** — how every byte updates |
| 14 | Store keyframe | 15 MB | Clock phase: latch memory |
| 15 | Execute keyframe | 13 MB | Clock phase: commit memory |
| 16 | Clock keyframes | 0.1 KB | The four-beat heartbeat |

The rest of this document walks each one.

---

## The one trick that makes all of this possible

Before the tour, the single idea everything rests on. Modern CSS has a
feature called **`if()` / `style()` queries** and **custom properties**
(`--things`). Together they let one CSS property's value *depend on*
another's:

```css
--result: if(style(--opcode: 5): 42; else: 0);
```

That reads: "if the property `--opcode` currently equals 5, `--result` is
42, otherwise 0." That's a conditional. CSS also has `calc()` for
arithmetic. **Conditionals + arithmetic + variables = a programming
language**, and a whole CPU can be built out of nothing else. Every
section below is some flavour of a giant `if(...)` choosing a number.

The catch: this was never meant to run programs. A real browser *can*
evaluate it (it's spec-compliant CSS), but a 300 MB stylesheet with a
million interdependent variables will bring Chrome to its knees. That's
why the project also ships **Calcite**, a compiler that reads the exact
same CSS and runs it fast — but the CSS is the source of truth, and it
must be honest CSS that a browser could in principle run.

---

## Recurring tricks

A few techniques show up in almost every section, so it's worth
explaining them once here rather than repeating them. The theme is
always the same: CSS's math is missing something a CPU needs, so we
build that thing out of the arithmetic CSS *does* have.

### There are no comparison operators, so we use `sign()`

CSS `calc()` can add, subtract, multiply, divide, and round. It has no
`<` or `>`. But a CPU constantly needs to ask "is A less than B?" — for
example, subtracting two numbers sets the **carry flag** if the result
would go negative.

The workaround is `sign()`, which returns −1, 0, or +1 depending on
whether its argument is negative, zero, or positive. So "is A less than
B?" becomes:

```css
max(0, sign(B - A - 0.5))    /* 1 if A < B, else 0 */
```

`sign(B − A)` is +1 exactly when A is below B; `max(0, …)` clamps the
−1/0 cases down to 0, giving a clean yes/no. The `− 0.5` nudges the
threshold off the exact boundary so we never land on the ambiguous 0.
This one line is how the carry flag, the auxiliary-carry flag, and the
screen's vertical-retrace timing are all computed.

### There's no "if X then A else B" in an expression, so we multiply by 0 or 1

Some places can use CSS's `if()`, but in the middle of an arithmetic
expression it's often easier to lean on the fact that any yes/no answer
is already a 0 or a 1. To pick between two values, multiply:

```css
flag * A + (1 - flag) * B    /* A if flag==1, B if flag==0 */
```

When `flag` is 1 you get A; when it's 0 you get B. The `INTO`
instruction ("call an interrupt, but only if the overflow flag is set")
is written entirely this way, and so is sign-extension. To *conditionally
skip a memory write*, the same trick sets the write's target address to
−1 — a deliberately invalid address that no memory cell matches, so the
write silently lands nowhere.

### Some things are too expensive to compute, so we bake a table

When a value is awkward to derive on the fly, we compute it ahead of time
in the build step and emit it as a giant `if()` lookup — a read-only
table baked into the stylesheet. Two examples:

- **The parity flag.** The 8086 sets this flag when a result has an even
  number of 1-bits. Rather than count bits in CSS, we precompute the
  answer for all 256 byte values and emit a 256-entry lookup.
- **Shifting by a variable amount.** `2ⁿ` can't be written directly in
  CSS when `n` is itself a variable, so 0–31 → 2ⁿ is a hand-written
  table, used whenever the program shifts a value left or right by a
  count held in a register.

(The disk and BIOS reads in §10–§11 are the same idea at enormous
scale: one table arm per byte.)

### Everything is unsigned; negative numbers are done by hand

CSS integers have no notion of a signed 16-bit value, so wherever the
8086 treats a number as possibly-negative, we correct it by hand:
`x − (x ≥ 32768 ? 65536 : 0)`. You'll see `65536` and `256` added and
subtracted all over the file for exactly this reason — it's the code
folding numbers back into range the way real 16-bit and 8-bit registers
would wrap.

### CSS functions are limited, which shapes the code

Chrome caps a CSS `@function` at about 7 local variables and won't let
you nest one function call directly inside another's arguments. A lot of
the arithmetic in this file looks more tangled than it "should" because
it's been flattened by hand to stay inside those limits — spelling out
`mod(x, 256)` inline instead of calling a tidy helper, for instance. It's
a reminder that this is real CSS running under a real browser's rules,
not a friendlier language pretending to be CSS.

---

## 1. Header comment — ~25 KB

Plain `/* ... */` comment at the very top. It's the cabinet's birth
certificate: what cart it was built from, when, and the full resolved
build manifest (BIOS flavour, memory size, the list of files on the
floppy). Does nothing at runtime; it's there so a human opening the file
knows what they're looking at.

```css
/* CSS-DOS cabinet
 *
 * Built from: Sokoban
 * Built at:   2026-07-01T15:08:54.286Z
 *   ...
 *     "memory": { "conventional": "640K", "gfx": true, ... }
 */
```

The size scales with how many files are on the disk (Sokoban's floppy has
87 files, each listed).

---

## 2. Utility @functions — ~15 KB

The CSS math engine can add, multiply, divide, and round. It **cannot**
do the bit-twiddling a CPU lives on: AND, OR, XOR, NOT, bit-shifts. This
section builds those out of the arithmetic that *does* exist.

The neat trick: **bitwise AND of two numbers is per-bit multiplication.**
So the function splits each 16-bit number into its individual bits (using
divide-and-remainder), multiplies them pairwise, and reassembles:

```css
@function --and(--a <integer>, --b <integer>) returns <integer> {
  --a1: mod(var(--a), 2);            /* bit 0 of a */
  --a2: mod(round(down, var(--a) / 2), 2);   /* bit 1 of a */
  ...                                /* 16 bits each for a and b */
  result: calc( var(--a1)*var(--b1) + var(--a2)*var(--b2)*2 + ... );
}
```

- **AND** = `a * b` per bit
- **OR** = `min(1, a + b)` per bit
- **XOR** = `a + b − 2·a·b` per bit
- **NOT** = `1 − a` per bit

Also here: **left/right shift** (implemented as multiply/divide by powers
of two), a **`--pow2` lookup table** mapping 0–31 to `2ⁿ` (used for
shift-by-a-variable, where you can't write `2^n` directly), and small
helpers to pull the low or high byte out of a 16-bit word. These get
called millions of times, so a couple are hand-inlined elsewhere for
speed.

**Trick worth noting:** everything is unsigned integer arithmetic faked
on top of CSS numbers. Signed values (negative numbers) are done by hand
with `x − (x ≥ 32768 ? 65536 : 0)` style corrections, because CSS has no
notion of a 16-bit signed integer.

---

## 3. Instruction decode @functions — ~27 KB

An 8086 instruction is a variable-length stream of bytes: an optional
prefix or two, an opcode, an optional "ModR/M" byte describing operands,
then displacement and immediate bytes. This section is the **rulebook for
reading one** — a set of functions that, given the raw bytes, work out:

- **How long** is this instruction? (so we know where the next one starts)
- **Which registers** does it touch? (`--getReg16`, `--getReg8`,
  `--getSegReg` — number-indexed lookups: reg 0 = AX, 1 = CX, …)
- **What memory address** does it point at? (`--eaOffset` /
  `--defaultSeg` compute the "effective address" from base + index +
  displacement registers — the 8086's addressing modes, as a big `if()`)

These are pure lookup/arithmetic functions, reused by every instruction.

---

## 4. Execution engine + per-tick decode — ~21 KB

Two things live here. First, the **clock**:

```css
.clock {
  animation: anim-play 400ms steps(4, jump-end) infinite;
}
```

A CSS **animation** counts `--clock` through 0 → 1 → 2 → 3, forever. Each
loop of that four-value cycle is **one CPU tick — one instruction
executed.** This is the foundation the whole machine sits on: a CSS
animation is the only thing in a stylesheet that changes over time by
itself, with nothing driving it. So the animation is used as the CPU's
clock. The four values coordinate a **double buffer** (explained at §12)
so that all of memory and all registers update together each tick,
without any of them reading a half-updated value.

Second, the **per-tick instruction prep**, computed fresh every tick
inside the `.cpu` rule:

- Fetch the next 8 bytes from `CS:IP` (the current code address).
- Detect prefix bytes and shift them out, so the opcode always lands in a
  known slot (`--q0`).
- Decode the ModR/M byte into its `mod` / `reg` / `rm` fields.
- Pre-compute a pile of "ingredients" the instructions will need:
  effective addresses, immediate values, the operand values, signed
  versions for multiply/divide, the current carry and zero flags, and so
  on.

Doing this once per tick and handing the results to the instruction table
keeps the giant table (next section) from having to repeat the work.

---

## 5. Register dispatch tables — ~225 KB — *the CPU*

**This is the processor.** It's small (a quarter of a megabyte in a
300 MB file) but it's where all the thinking happens.

The 8086 has ~14 registers (AX, BX, CX, …, the instruction pointer IP,
the flags). For **each register**, this section emits one giant
conditional that answers: *"given the opcode we just decoded, what is this
register's new value?"*

```css
--AX: if(
  ... ;
  else: if(
    style(--opcode: 0):  /* ADD */  ... ;
    style(--opcode: 1):  ... ;
    style(--opcode: 40): /* SUB */  ... ;
    ...  /* one arm per opcode that can change AX */
    else: var(--__1AX)    /* unchanged */
  ));
```

Read it as: *AX's next value is chosen by a switch on the opcode.* Add
`--BX`, `--CX`, …, `--IP`, `--flags` and you have the entire instruction
set. When you run the machine, every tick, **all of these evaluate at
once** — that's the CPU executing one instruction.

Notable details:

- **`IP` (the instruction pointer)** is where control flow lives — jumps,
  calls, and returns are just "compute a different next `IP`." Every
  instruction's IP arm is auto-wrapped to also skip past any prefix
  bytes.
- **Interrupts** (keyboard, timer, software `INT`) are handled by two
  override arms in *front* of every register: `--_tf` (single-step trap)
  and `--_irqActive` (a hardware interrupt is pending). When one fires,
  the register takes its interrupt value instead of the normal decoded
  one — this is how a keypress or timer tick interrupts the program
  between instructions.
- The same section also carries **peripheral state** that isn't a real
  8086 register but rides the same machinery: the interrupt controller
  (PIC), the timer chip (PIT), the keyboard scancode latch, and the VGA
  palette (DAC) write cursor.

### Loops that fit in one tick: instructions that rewind themselves

One instruction, one tick — but some 8086 instructions are supposed to
repeat. `REP MOVSB`, for instance, copies `CX` bytes in one go (memory
copies use it constantly). We can't run a loop inside a single tick,
because a tick is defined as exactly one instruction.

The fix: the instruction copies **one** byte, decrements `CX`, and — if
`CX` is still above zero — computes its *next* instruction pointer to
point back at itself. So on the next tick the CPU fetches the very same
`REP MOVSB` again, copies the next byte, and so on, until `CX` reaches
zero and the IP finally advances past it. The instruction rewinds its own
program counter to build a loop out of single steps. From the outside it
looks like one instruction copying a whole block; underneath it's the
same instruction re-run N times by the clock.

---

## 6. Memory write slots + gates — ~30 KB

An instruction can write to memory (e.g. `MOV [address], value`). But at
this point in the file we've only computed *what* to write and *where* —
we haven't touched the million memory cells yet. This section is the
**dispatcher** that says, per tick: "slot 0 writes value V to address A;
slots 1 and 2 are idle."

There are **three write slots** because the worst case — a hardware
interrupt or `INT` instruction — pushes three 16-bit words onto the stack
in a single tick (the flags, the code segment, and the return address).
Everything else needs fewer.

Each slot exposes: an **address** (`--memAddr0`), a **value**
(`--memVal0`), and a **live gate** (`--_slot0Live`, which is 1 only when
that slot actually fires this tick). Plus one global `--_writeWidth`
saying whether this tick's writes are single bytes or 16-bit words.

**Why the gates matter (a performance trick):** most instructions don't
write memory at all. The gate lets the (enormous) per-byte write rules in
§13 instantly short-circuit — "no slot is live, so no byte changes" —
without checking a million addresses. Both a real browser (via `if()`
short-circuit) and Calcite (via a dedicated recogniser) skip the whole
memory table on a non-writing tick.

---

## 7. Keyboard — ~4 KB

Each on-screen key is a DOM element; when you hold it down
it matches CSS's `:active` pseudo-class, and a rule fires:

```css
&:has(#kb-a:active) { --keyboard: 7777; }   /* A */
&:has(#kb-s:active) { --keyboard: 8051; }   /* S */
```

Holding a button *is* pressing the key. The number encodes the key's
hardware scancode and its ASCII code (`scancode·256 + ascii`). The CPU
watches `--keyboard` change from tick to tick, and a change edge fires a
keyboard interrupt — exactly as real hardware raises IRQ 1. No JavaScript
touches the keyboard; `:has()` + `:active` is the entire input path.
~60 keys, one rule each.

**The release-code latch.** Real keyboard hardware sends one code when a
key goes down and a *different* code — the same number with its top bit
set — when it comes back up. Games like Doom rely on the "up" code to
know a key was let go. The problem: in this machine the "up" event is
only true for the single tick when the button stops matching `:active`.
If the program's interrupt handler happens to run a tick or two later
(which is normal), that instant is already gone and the key would appear
stuck down forever.

So the machine keeps a small **latch** (`kbdScancodeLatch`) that holds the
most recent code — down or up — until the next key event replaces it.
When the program gets around to reading the keyboard port, the release
code is still there waiting. It's a one-value memory that papers over the
timing gap between "key released" and "program noticed."

**A note on time.** DOS programs expect two clocks the real PC had: a
timer chip that interrupts ~18.2 times a second (how DOS keeps the time
of day, and how games pace themselves), and a video "vertical retrace"
signal that flips on and off ~70 times a second (how games avoid drawing
mid-refresh and tearing the image). Neither exists for free in CSS. Both
are derived from a single number the CPU already keeps: a running count
of how many clock cycles each instruction would have cost on real
hardware. The real 8086 ran at 4.77 MHz and the timer chip at a quarter
of that, so the timer counts down using `cycleCount / 4`; the retrace
signal is `cycleCount` folded into a 70-times-a-second window with the
`sign()` comparison trick from earlier. Both clocks fall out of "how much
work has the CPU done so far" rather than any real-world wall clock.

---

## 8. Pixel painter — ~14 MB

The screen is a 320×200 grid — **64,000 pixels** (VGA Mode 13h's
geometry, the standard mode for DOS games; the other modes sample onto
the same grid). This section emits **one CSS rule per pixel**:

```css
.motherboard #p12345 {
  --ci: round(down, var(--__1mc333852) / 256);      /* Mode 13h colour index */
  background-color: --screenPx(var(--vidMode), var(--ci), ...);  /* mode dispatch */
}
```

Each rule reads that pixel's byte(s) straight out of the video memory
cells and hands them to a shared dispatch function, `--screenPx()`,
which switches on the live BIOS video-mode byte (the cabinet reads it
from memory 0x449 into `--vidMode` once per tick). Text modes look the
character up in an 8×8 ROM font baked into a 2048-arm `--fontRow()`
function and paint foreground/background from the classic 16-colour
palette; CGA graphics modes decode the 2-bits-per-pixel interleaved
scanlines the same way; Mode 13h pixels look their colour index up in
the live 256-colour palette. That palette is a shared 256-arm function,
`--paletteRGB`, that reads the live VGA DAC (the 256×3 table of
red/green/blue values the program has programmed) and produces an
actual `rgb(...)` colour:

```css
@function --paletteRGB(--idx <integer>) returns <color> {
  result: if(
    style(--idx: 0): rgb(... ... ...);   /* colour 0's live R G B */
    ...
    style(--idx: 255): rgb(...);
    else: rgb(0 0 0));
}
```

So the screen is literally 64,000 `<div>`s whose `background-color` is
computed from RAM every frame. This is the *pure-CSS* renderer — proven to
paint in real Chromium. (The fast Calcite player skips these rules and
blits the framebuffer to a single `<img>` instead; the rules are inert
there but always present, which is the ~14 MB fixed cost.)

Memory a mode needs that the cart doesn't map (say, the CGA aperture)
just paints black in that mode.

**How colours get into the palette.** The 256×3 palette isn't fixed — the
running program loads it, and the machine reproduces the exact way real
VGA hardware accepts it. To set one colour, a program writes three bytes
in a row to a single port: red, then green, then blue. The hardware keeps
a little counter that steps 0 → 1 → 2 and then rolls over to the next
colour slot, so a program can set the index once and stream a whole
palette through in one loop. The machine tracks that same counter, and
also truncates each value to 6 bits (`value & 63`) because that's the
precision the real DAC had. There's even a separate read cursor for the
rarer case of a program reading the palette back — for example, a
fade-to-black effect that needs to know the current colours before dimming
them.

---

## 9. Property declarations — ~32 MB

Before CSS will let you *use* a custom property as a typed integer, you
have to **declare** it with `@property`. This section declares every
memory cell:

```css
@property --mc5000 {
  syntax: '<integer>';
  inherits: true;
  initial-value: 32861;
}
```

Memory is **packed two bytes per cell** (so `--mc5000` holds two bytes of
RAM as one 16-bit number — halving the cell count). The `initial-value`
is the byte's power-on contents: the BIOS, the boot sector, whatever was
baked in. There's one of these blocks for **every cell of writable
memory** — hundreds of thousands of them. That repetition, ~120 bytes
apiece, is where the 32 MB comes from.

This is the first of the four sections (9, 10, 12, 13) that each iterate
over all of memory once; together they're the bulk of the file.

---

## 10. Memory read function — ~44 MB

`--readMem(addr)` — "give me the byte at address *addr*." It's a single
colossal `if()` with **one arm per address**:

```css
@function --readMem(--at <integer>) returns <integer> {
  result: if(
    style(--at: 5000): mod(var(--__1mc2500), 256);   /* low byte of a cell */
    style(--at: 5001): round(down, var(--__1mc2500) / 256);  /* high byte */
    ...
    style(--at: 983040): 235;   /* BIOS ROM byte — a constant */
    ...
  else: 0);
}
```

Three kinds of arm:

- **RAM** — extract the right byte from its packed cell.
- **BIOS ROM** — read-only, so the byte is baked in as a literal constant
  (no cell needed). Zero bytes are omitted entirely.
- **Disk window** — a small 512-byte region that reads through to the disk
  function below (see §11).

A couple of special addresses (linear `0x500`–`0x501`) are wired straight
to the live `--keyboard` value, so the BIOS keyboard service reads real
keypresses.

---

## 11. Disk read function — ~13 MB

The floppy disk is a **read-only lookup table**, `--readDiskByte(idx)`,
one arm per non-zero byte of the disk image:

```css
@function --readDiskByte(--idx <integer>) returns <integer> {
  result: if(
    style(--idx: 0): 235;
    style(--idx: 1): ... ;
    ...
  else: 0);
}
```

The disk is a real FAT12 floppy image the builder assembled from the
cart's files. When DOS reads a sector, the machine computes a byte index
(sector × 512 + offset) and this function returns the byte. **This size
tracks the game's data**, not the machine — a cabinet with a fat disk has
a fat disk function. (Zero bytes are skipped, so sparse disks are
cheaper than their nominal size.)

---

## 12. Double-buffer reads — ~15 MB

One line per memory cell:

```css
--__1mc5000: var(--__2mc5000, 32861);
```

This is half of the **double-buffering** that makes a whole computer
update atomically each tick. There are conceptually three copies of every
value:

- `--__1x` — **this tick's input** ("what memory was at the start of the
  tick")
- `--x` — **the freshly computed next value**
- `--__2x` / `--__0x` — the staging copies the clock shuffles between

Every read anywhere else in the file reads the `__1` (frozen) copy, and
every write produces the new value — so nothing ever reads a
half-updated machine. This section wires "this tick's input" to the
staged value from last tick, for all of memory. (The registers get the
same treatment, in a much smaller block up in §4.)

---

## 13. Memory write rules — ~171 MB — *the biggest section*

**More than half the entire file.** For **every memory cell**, a rule
that computes its next value by asking: "did any of the three write slots
target me this tick?"

```css
--mc5000: --applySlot(
            --applySlot(
              --applySlot(var(--__1mc5000),
                var(--_slot2Live), <slot 2 offset math>, var(--memVal2), var(--_writeWidth)),
              var(--_slot1Live), <slot 1 offset math>, var(--memVal1), var(--_writeWidth)),
            var(--_slot0Live), <slot 0 offset math>, var(--memVal0), var(--_writeWidth));
```

`--applySlot` (a helper from §2) means: "if this slot is live *and* it
lands on me, splice its byte in; otherwise pass me through unchanged." The
three slots are nested so **slot 0 wins** if two slots hit the same cell.

Because every cell has to check all three slots, and there are hundreds of
thousands of cells, this is the single largest thing in the cabinet. The
gates from §6 are what keep it from being catastrophically slow: on a tick
that writes nothing, every slot is "not live," and all these rules
collapse to "hold your previous value" almost for free.

---

## 14 & 15. Store & execute keyframes — ~15 MB + ~13 MB

The other two arms of the clock. These are CSS `@keyframes` — the
animation from §4 runs them on specific beats. They shuffle each cell
between the staging copies:

```css
/* store keyframe (clock beat 1): stage last tick's result */
--__2mc5000: var(--__0mc5000, 32861);

/* execute keyframe (clock beat 3): commit this tick's computed value */
--__0mc5000: var(--mc5000);
```

One line per cell in each — hence the size. Together with the §12 reads,
these four sweeps over memory (declare / read / store / execute) plus the
write rules are why a cabinet is ~99% memory plumbing. The sequence
"read the frozen copy → compute new values → stage → commit" is what
gives every tick its clean before/after snapshot.

---

## 16. Clock keyframes — ~0.1 KB

The clock itself, and the smallest section in the file:

```css
@keyframes anim-play {
  0%   { --clock: 0 }
  25%  { --clock: 1 }
  50%  { --clock: 2 }
  75%  { --clock: 3 }
}
```

Four values, looping forever. Each value is one phase of a single CPU
tick: **read** the previous state, **compute** the next state (all of §5
and §13 evaluate here), **store** it, then **commit** it. When the loop
returns to 0 the next instruction begins. This is about thirty lines of
CSS, and it's the only thing in the file that moves on its own — every
other section just describes what to compute; this is what makes it
happen, over and over.

---

## The shape of the whole thing

A cabinet is a CPU (§5, tiny) surrounded by an ocean of memory. Time comes
from a CSS **animation** (§16). Thinking comes from **`if()` switches on
the opcode** (§5). Memory is **one CSS variable per cell**, read by a
million-arm lookup (§10), written by a million per-cell rules (§13), and
kept consistent by a **double buffer** driven by the clock's four phases
(§12, §14, §15). Input is **`:active` on on-screen keys** (§7). Output is
**64,000 `background-color`s** (§8). Bit-math that CSS lacks is **built out
of multiply and divide** (§2).

None of it is JavaScript. It's all CSS.
