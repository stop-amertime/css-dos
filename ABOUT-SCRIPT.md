# About-page script (working copy)

The shared working script for the About-section rewrite. The site's About
pages get rebuilt from this document; prose here is final copy, not notes
toward copy. The owner and agents both edit this file directly.

## The mission

The About section is edutainment. Its job is to make a reader understand
what CSS-DOS is, how it works, and how unreasonable it is — and to enjoy
finding out. The audience is both developers and curious non-programmers.
People aren't stupid: don't teach them things they already know, and don't
slow down to be safe.

The single most important idea to convey is the **difference** between how
a normal program works and how CSS works. A normal program assigns:
`x = y`, line by line. CSS is a blueprint — nothing runs line-by-line — so
every variable has to be written as a formula that works out its own value.
Most of what's unreasonable in the machine follows from that difference,
and the writing should keep tracing things back to it.

The section stays about the artifact, not the process of building it. The
horror is presented as exhibits: real code from a real cabinet, then read
out in plain English. Show the crime scene; don't tell war stories.

## The register

Write like an engineer explaining a constraint they hit and what they did
about it. The canonical example, owner-written — match this:

> Normal computer programs assign variables, like x = y. Because CSS is a
> blueprint and not run line-by-line, we can't really instruct the program
> to do x = y. So instead, we have to write the variable ITSELF as a
> function that, when run, works out what the value of the variable is.
>
> This is more like how formulas work in a spreadsheet than a traditional
> programming language.
>
> ```
> x: IF it was changed previous tick THEN new value ELSE old value
> ```
>
> Naturally, this means that every single variable has to be re-checked,
> every single time anything happens. This is massively inefficient. In a
> normal programming language, x = y only changes x. In CSS-DOS, we have to
> check every single byte of RAM, like so:
>
> *(the RAM-write demo: every rule being checked in turn)*

Rules, derived from that example:

1. **Every sentence is a causal link.** *Because → so instead → naturally,
   this means.* The text is a chain of reasoning about a problem, not a
   narration of concepts. Each sentence answers the "so what?" raised by
   the one before it.
2. **Trust the reader.** Known things (`x = y`, spreadsheets) get one
   sentence as an anchor, not a lesson. Analogies are pointers, not
   vehicles.
3. **State evaluations flat.** "This is massively inefficient." The
   deadpan comes from saying an insane fact plainly. British, human.
4. **The widget is the paragraph's evidence.** Text sets up a claim; the
   demo pays it off, or helps to visualise.
5. **Stop when the information stops.** No summary line or
   echo.

Anti-patterns — all committed by agents on earlier drafts; the owner will
reject them:

- The "not X, but Y" antithesis tic as a sentence engine ("Not a picture
  of one." / "Nothing wrote to that byte — the byte noticed.").
- Aphorisms as paragraph endings ("the re-evaluation *is* the work").
- Ornamental analogies introduced once and dropped (to-do lists, etc.).
- Faux-philosophy and over-egging ("the single most important line of code
  in the world").
- Over-slow hand-holding ("You only type it once. You never 'run' it.").
- Conclusions stated at an altitude only someone who already understands
  can follow ("every rule is simply in force, all at once").

### Minimising vs demonstrating

Don't tell the reader something is simple — "just", "simply", "merely"
minimise. Show the thing itself and let it be simple. A real pair from
drafting the IP paragraph:

**Bad — minimises:**

> IP is updated by a formula like everything else: new IP = old IP + the
> length of the instruction. A jump instruction is just a formula arm that
> returns a different address instead. Next tick, the fetch starts from
> the new IP.

**Good — demonstrates:**

> IP is updated by a formula like everything else: every instruction has
> an arm in the IP table saying where the machine goes next. ADD's arm
> steps past itself:
>
> ```css
> style(--opcode: 5): calc(var(--snapshot-IP) + 3);   /* ADD AX, imm16 */
> ```
>
> — plus 3, because that instruction is three bytes long. A jump's arm
> computes a destination instead:
>
> ```css
> style(--opcode: 235): --lowerBytes(calc(var(--snapshot-IP) + 2 + --u2s1(var(--q1))), 16);   /* JMP short */
> ```
>
> — the byte after the opcode (`--q1`) is the jump distance. It can be
> negative: jumping backwards is how loops happen. Next tick, the fetch
> reads from the new IP.

The good version lets the reader see that a jump is one more arm in the
same table, instead of being told it's nothing special.

## Document conventions

- Below the skeleton, every h1 (`#`) is one About sub-page, in reading
  order; h2/h3 are headings within that page.
- Interactive elements are `[WIDGET — NAME]` blocks stating: *what you
  see*, *what you can do*, and *what it makes you believe*. If the third
  can't be filled in, the widget doesn't get built.
- `[STUB]` marks undrafted material; `[Q]` marks an open question for the
  owner.
- Code exhibits are real cabinet code, structurally exact, but with
  variable names tidied for readability (`--__1AX` → `--snapshot-AX`,
  `--mc5000` → `--memory-5000`). Renames only — never restructure, simplify
  or invent code. Note the convention on-page the first time code appears.
- Work **one page at a time** with the owner. Don't rewrite the whole
  document in a pass.
- The original sketch (`ABOUT-CSSDOS-GUIDE.md`) stays untouched as
  reference.

> **Status note:** the first four page drafts below predate this brief and
> do NOT yet match the register — they carry several of the anti-patterns
> listed above. The skeleton (page list and order) is agreed; the prose is
> due for rewriting page by page.

---

## The skeleton

1. **Intro** — the claim, plus proof it's real.
2. **Why?** — the human bit, short.
3. **How it Works** — what CSS is; that it secretly has the working parts
   of a programming language; Turing-complete = walking distance; the
   checklist of everything missing.
4. **The first stumbling block** — the core inversion (nothing can be
   written; everything pulls): write slots, the duplicate memory, the
   clock and its four stages.
5. **Where's the computer?** — the spine. What a program, a CPU, registers
   and IP actually are — and that every one of them is a variable. The
   one-tick flowchart.
6. **The CPU** — the horror gallery: real opcode arms, the flag formulas,
   DAA, fresh exhibits of maximum circuitousness. Sidebar: the machine's
   only debugger is the CPU printing its own registers via CSS counters.
7. **Screen, keys, time** — one div per pixel, the palette, `:active` keys,
   the two fake clocks. Honest limits: no real keyboard, no sound.
8. **The 300 MB question** — file map as hub; the floppy and what INT 13h
   demanded; two-byte packing; the Moon; finale: Chrome can't survive the
   file, hence Calcite.
9. **Tricks** — for the curious. Mostly the existing page.
10. **Credits** — as-is.

---


# A complete 1980s PC, in a stylesheet.

*(Layout: logo left, text right, the gold scalloped banner kept.)*

An IBM PC compatible - 8086 processor, 640 KB of RAM,
floppy drive, keyboard, VGA screen, and various less-memorable support chips - in one CSS file.

It boots real DOS (disk operating system, the precursor to Windows) from an emulated floppy and runs unmodified 1980s
software.

Yes, it runs Doom*

*(gold banner, kept as-is:)* THE FIRST TIME REAL\*\* PROGRAMS HAVE RUN IN CSS!

* footnote 1: barely
**(footnote 2: "real" meaning production programs — the command shell,
early computer games, and so on.)*

The file that does all this is about **300 MB of plain text**. Every line is spec-compliant CSS, albeit abused beyond recognition. 

---

# Why?

"Because it's there"
- George Mallory, when asked why he climbed Everest.

Cave paintings started with some spare blood being misused to represent a deer. Ten thousand years later, someone beat Dark Souls using the Bongo Drums controller from a Donkey Kong rhythm game, which only has three buttons and a microphone. [note: link that] Humans, we never learn, chasing useless abstract concepts like meaning, challenge, innovation, love. Pick your poison. 

I'm under no illusion here: this project was excruciating to create and serves no practical benefit whatsoever. But it sits in that special nook between 'might be technically possible' and 'impossible' that draws the foolish and the brave recklessly in. 


---

# How it Works

## What is CSS? 
(info callout) If you know what CSS is, click here (scrolls down to next subheading)

HTML declares what is *on* a webpage, and CSS declares how it should *appear*. Most of it does exactly what it
says on the tin:

```css
.box {
  background-color: blue;
  width: 120px;
}
```

> **[WIDGET — CSS DEMO** *(exists; needs one change)*. *What you see:* four
> panels — Basics, Variable, Function, Branching — each a few lines of real
> CSS with its live result beside it. *What you can do:* on Branching, a
> toggle flips `--on` and the box changes colour, no JavaScript involved.
> *What it makes you believe:* "CSS genuinely has variables, functions and
> `if()`." *Change:* don't hide the lesson behind tabs the reader might not
> click — auto-advance them, or stack the four panels vertically. The last
> two panels ARE the point.**]**

Over the years, CSS has quietly accumulated tools: variables you can
store and reuse like an accent colour, `calc()` for arithmetic, custom functions — and very
recently the rudimentary `if()` statement and functions. 

## CSS can technically run anything

Now, CSS is technically **Turing-complete**, meaning that IN THEORY (here, 'in theory' is in a much bigger font than the text around it)
it can run any computation *at all*. Instagram, Minecraft, anything - in theory. 

'Turing complete' is a very low bar —
an infinitely long roll of tape with a read/write head that can move along it technically also qualifies. 

Saying a language is Turing-complete is a bit like saying anywhere is
within walking distance, if you have enough time. 

Here is everything else a computer needs, and CSS has none of it:

- [ ] Keyboard input
- [ ] Pixels you can draw
- [ ] Memory you can write to
- [ ] Files
- [ ] Loops — or any way to run anything twice

[STUB] The current site follows this with the "what CSS-DOS simulates" ✓
checklist (BIOS + DOS, FAT12 floppy, 640 KB RAM, VGA, keyboard/timer/
interrupts) and the Lyra Rebane x86css lineage box. [Q] Keep both here, or
move the lineage to Intro/Credits and the ✓ list to the Intro?

---

# The first stumbling block

Basically all programming languages are a list of instructions, like a *recipe*. For example `x = y`. The instructions are actioned in order. 

A stylesheet is very different. It has no order: every rule in it is in force the whole time - more like a blueprint or a diagram. You cannot tell CSS to *do* things. You can only declare, once, what a thing *is*:

```css
--x: blue;
```

In other words, we can only define X ONCE, and can't change it later. 
This is clearly going to be a massive pain in the arse, but CSS is Turing complete, so there must be a way around it. 

We create a 'write slot' - a variable that just holds the address and value of a change to memory. Then, we define X as a function that looks at the write slot to see if it has been updated to a new value, and if not, it keeps its old value. 

(Some instructions change up to six bytes at once, so we need multiple write slots!)

There's another wrinkle: a formula isn't allowed to refer to itself, so we have to keep a duplicate copy of the entire memory, just to allow X to keep the same value. In a sense, every byte of memory does actually update every instruction, it's just that 99.99984% of the time it updates to the same value as before. 

[code block: just showing X = IF I changed then the new value, ELSE the old value - this already exists on the about page and is fine]

> **[WIDGET — RAM WRITE** *(exists — keep as-is)*. *What you see:* six
> bytes of RAM, and the one formula every byte is defined by. *What you can
> do:* press "run `MOV [00004], 99`" and watch a feed replay each byte's
> formula re-evaluating — "written this tick? no → stays", one "YES →
> becomes 99", then "…and ~650,000 more, checked every tick." *What it
> makes you believe:* "nothing wrote to that byte — the byte noticed."**]**

Now, the catch - this formula has to be rerun EVERY SINGLE TIME anything happens, even if that variable wasn't changed. 

In a normal programming language, Y = <value> only affects Y - one check, done. 

In CSS, an instruction might write one byte, and 650,000 formulas must be e rerun to check whether the write
was about them. Often, a CPU instruction doesn't write *any* bytes, but they all still have to check. This is absurdly wasteful. 

More than half the file (171 MB) is this single formula, written out once per byte.

## How does anything ever change? 

Exactly one thing in CSS changes on its own: an **animation**. The actual computation is run by an animation which ticks 0, 1, 2, 3, forever:

```css
.cpu { animation: tick 400ms steps(4) infinite; }
```

Each lap of the counter, every formula in the file re-evaluates once, and
the machine advances by one CPU instruction. This animation is the
only moving part in 300 MB.

The four stages are shown below:

[widget showing the four steps, written simply and intelligibly, showing the four stages. Perhaps a small visualisation of the snapshot, buffer, etc. runnnig?]

---

# Where's the computer?

We have memory and a clock now, but nothing that runs programs.

On a real PC this part comes for free. A program is machine code: a long
list of numbers sitting in memory, each one an instruction — 184, 5, 0
means "put the number 5 into AX". The CPU is a chip that loops forever:
read the number at the address IP points to, do what it says, move IP
along. AX and IP are registers — fourteen values the CPU keeps close to
hand — and all of it, the registers, the pointer, the reading itself, is
wiring. Nobody writes code to make a CPU fetch; it fetches because
that's what the silicon does.

We get none of that. Everything on that list has to be built, and the
only material available is variables:

- The program is numbers in memory, and memory is variables — last page.
- Every register is a variable: `--AX`, `--BX`, `--IP`...
- Even "which instruction are we on" is a variable. The cabinet literally
  contains the line:

```css
--opcode: var(--q0);   /* --q0: the byte of memory that IP points at */
```

And the reading — the thing silicon does without being asked — is the
first fight. CSS can't build a variable *name* out of a value: there is
no way to write "--memory-{whatever IP is}". So the file asks every
possibility in turn: if IP is 0, the opcode is byte 0's value; if IP is
1, byte 1's; on and on, for every address a program could run from. A
giant if-statement whose only job is to read one number.

Put together, one tick of the machine looks like this:

> **[WIDGET — ONE TICK, AS A FLOWCHART.** *What you see:* the loop drawn
> with the real names: `--IP` → the program bytes at that address →
> `--opcode` → the register formulas (`--AX` … `--flags`) and the write
> slots → the memory formulas → a new `--IP`. Around the outside, one
> arrow: "the animation, once per lap". *What you can do:* nothing
> required — static is fine; stepping it beat-by-beat is a bonus. *What it
> makes you believe:* "there is no engine underneath — every box is a
> variable defined in terms of the boxes behind it, and the animation
> makes the whole ring re-derive once per tick."**]**

IP is updated by a formula like everything else: every instruction has an
arm in the IP table saying where the machine goes next. ADD's arm steps
past itself:

```css
style(--opcode: 5): calc(var(--snapshot-IP) + 3);   /* ADD AX, imm16 */
```

— plus 3, because that instruction is three bytes long. A jump's arm
computes a destination instead:

```css
style(--opcode: 235): --lowerBytes(calc(var(--snapshot-IP) + 2 + --u2s1(var(--q1))), 16);   /* JMP short */
```

— the byte after the opcode (`--q1`) is the jump distance. It can be
negative: jumping backwards is how loops happen. Next tick, the fetch
reads from the new IP.

---

# The CPU

[STUB — next drafting round.] Plan:

- Transplant the strongest material from the current "How it computes":
  registers as cells in the same spreadsheet; the verbatim `ADD AX, imm16`
  arm and how to read it; silicon gives flags for free, we compute six
  formulas (carry / zero+sign / parity / the packing line); DAA in full.
- **The star is circuitousness itself** — fresh exhibits to be dug out of a
  real cabinet: MUL/DIV handling, and one or two of the worst offenders
  found while trawling. Present each as: what the 8086 does in one breath →
  the tangle CSS needs → a plain-English read of the tangle.
- "Not just the CPU": the 29 dispatch rules — 14 registers + PIC + PIT +
  keyboard latch + DAC — support chips are just more cells with formulas.
- Sidebar (deadpan): the machine's only debugging aid is the CPU printing
  its own registers on screen via CSS counters, because nothing else was
  possible. One bit wrong somewhere in 640 KB; good luck.
- 232 distinct opcodes, 1,094 arms.

---

# Screen, keys, time

[STUB — plan:]

- One div per pixel (PixelScreen widget, kept); 64,000 rules.
- The palette: programs stream 256×3 bytes through one port exactly as real
  VGA hardware accepted them; fade-to-black is re-streaming the table
  darker. (This page nearly killed the author. It should show, calmly.)
- Keys: the real `:has(#kb-a:active)` rules (KeyboardDemo widget, kept).
- Honest limits, plainly: CSS cannot see a physical keyboard — everything
  is piloted with clicks. CSS cannot make sound.
- "No clock on the wall" moves here from Tricks: the 18.2 Hz timer and the
  70 Hz retrace are both derived from a count of how many cycles each
  instruction *would have cost* on a 4.77 MHz 8086. Time measured in work
  done, not seconds.

---

# The 300 MB question

[STUB — plan:]

- FileMap as the centrepiece/hub (clickable segments? your sketch wanted
  bar-chart-as-navigation). CPU = 0.1% callout stays.
- Two-byte packing gets its paragraph — the one genuinely dignified
  optimisation in the file: memory cells halved by packing two bytes per
  custom property.
- The floppy: a real FAT12 image, byte by byte, one `if()` arm each;
  ramming a 1.3 MB Doom floppy in; what INT 13h and DOS's disk habits
  actually demanded of the BIOS. ("It is amazing how hacky old software
  is" — this sentiment, with one concrete example.)
- MoonViz callback.
- Finale, not footnote: every byte of this is real CSS and Chrome cannot
  survive it. Calcite exists — a compiler whose only job is to run one
  stylesheet fast. The CSS stays the source of truth.

---

# Tricks

[STUB.] Existing Tricks page survives mostly as-is, badged "for the
curious", minus items promoted into earlier pages ("no clock on the wall"
→ "Screen, keys, time"). Candidates that stay: no comparisons/`sign()` (+SignDemo), 0/1
multiplication + write-to-address-−1, bitwise from arithmetic, bake a
table, no negative numbers, REP self-rewind, the keyboard latch, Chrome's
own function limits.

---

# Credits

[STUB.] As-is from the current site (x86css / Jane Ori / emu8; EDR-DOS via
SvarDOS; the two fonts). Possibly absorbs the Lyra lineage box from "CSS in
sixty seconds" if it moves.
