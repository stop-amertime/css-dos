# About-section brief + design of record

What this doc is: the **register brief** (how all About-section prose must
be written — unchanged, still the law) and the **agreed design** for the
About / How-it-works rebuild, converged in conversation 2026-07-03. The
site source (`web/site/src/routes/`) is the working copy; this doc is why
it's shaped that way. Old page drafts that used to live here are
superseded and deleted (git history has them).

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
   this means.* Each sentence answers the "so what?" raised by the one
   before it.
2. **Trust the reader.** Known things (`x = y`, spreadsheets) get one
   sentence as an anchor, not a lesson.
3. **State evaluations flat.** "This is massively inefficient." The
   deadpan comes from saying an insane fact plainly. British, human.
4. **The widget is the paragraph's evidence.** Text sets up a claim; the
   demo pays it off.
5. **Stop when the information stops.** No summary line or echo.

Anti-patterns — all committed by agents on earlier drafts; the owner will
reject them:

- The "not X, but Y" antithesis tic. Aphorisms as paragraph endings.
- Ornamental analogies introduced once and dropped. Faux-philosophy.
- Over-slow hand-holding; conclusions stated at an altitude only someone
  who already understands can follow.
- **Drama-through-abstraction**: portentous abstract labels ("Nothing can
  change", "the first fight") in place of the concrete complaint ("you
  can't set a variable twice").
- **Prose walking through branches or steps** — that's code in a trench
  coat. Show the code; it speaks for itself. Don't invent reader-facing
  jargon for it either (no "arm").
- **Writing for a computer**: arrow-chains (`A → B → dies`), invented
  codenames (P0/b2), compressed notation. Write sentences.
- Transitions must carry facts, not stakes. No self-callbacks that require
  remembering earlier *phrasing* rather than earlier facts.

### Minimising vs demonstrating

Don't tell the reader something is simple — "just", "simply", "merely"
minimise. Show the thing itself and let it be simple. The memory-read
exhibit is the model: one line of `opcode = memory[IP];` next to a
2000-pixel tower of the real verbatim function, and the measured fact
(44 million characters). No narration needed.

## Working agreement (how owner + agent collaborate)

- Structure and beats are agreed **in conversation before anything is
  built**. No fait accompli.
- The owner writes or approves all final prose. Owner-typed sentences are
  finished copy — paste them, don't improve them.
- The agent holds the map: structure, facts, code extraction, widgets,
  layout, consistency, state. One item in front of the owner at a time.
- Every number and mechanism is verified against a **real cabinet**
  (`sokoban.css`, 309 MB, sections measured) — never quoted from prose.
- `docs/EXPLAINER.md` is a story source (the disk window, the player
  skeleton, the Calcite honesty argument) but has factual drift: it says
  six write channels (real: 3 slots), its Trick-4 prose swaps the
  store/execute beats, and its sizes are from an older build. Re-verify
  everything lifted from it.

---

# The design (agreed 2026-07-03)

Site shape: **3 wizard steps — About / Build / Play.** The separate
"How it works" step is gone; its material lives inside About. The old
8-page How-it-works route is stashed in `web/site/src/attic/` (not
mounted) so its copy and widgets can be recycled.

## Step 1: About — FIVE pages

1. Intro — the claim, Doom*, 300 MB of plain text. (Built; owner copy.)
2. How is this possible? — ✓-list, Lyra lineage (owner copy 2026-07-03),
   then the one-tool thesis (below) and the MoonViz walk (re-measured:
   309,116,250 chars → ~60% of the way to the Moon, not the old 2/3).
   (Built.)
3. Why? — Mallory / bongos. (Built; owner copy.)
4. FAQs — the expandable questions (below).
5. What's in the file — the cabinet dissected (the hub, below).

### Page 2 bottom — the one-tool thesis

The one idea the reader needs before the map, in the owner's words
(lightly edited for the page with owner permission; original verbatim):

> It's ALL made of CSS variables which are formulas, basically.
> Everything is a CSS variable which calculates its thing. The amount of
> complexity that that one sentence hides is difficult to comprehend. We
> have exactly one tool, and we are smacking every problem with it until
> its fixed. Some problems that could be fixed with a very slightly
> different tool are smacked a million times instead.

### Page 4 — FAQs

Expandable questions (Foldable component) for the curious — short
honest answers, deep versions live behind the map:

- What even is CSS? *(the four CssDemo panels fold out here)*
- Wait — CSS can do maths?
- How can there be a clock? Nothing in CSS moves.
- How does it draw video?
- How do you control it? Surely CSS can't see a keyboard.
- Don't you need an HTML page for this to work? *(yes — a small shell: a
  link tag, a div for the clock, a div for the CPU, 64,000 empty divs)*
- Really, no JavaScript? *(yes\* — at pure-CSS speed booting DOS takes
  about a year and a half, so a compiler called Calcite evaluates the
  same file faster)*

### Page 5 — the cabinet, dissected (the hub; replaces the slideshow)

The reader meets the absurd size EARLY and the anatomy is the navigation:

- **The bar**: the whole 309 MB file drawn to scale, 16 sections in file
  order, coloured by group.
- **The contents**: the cabinet's own table of contents, clickable.
  Clicking a row or a bar segment highlights its whole group and opens
  the group's story in a **pane below**. No page order; curiosity drives.
- Titles are rigorous, not floral: *topic — concrete detail · size*.

The eight groups (sizes measured from the real Sokoban cabinet):

| Group (one story each) | File sections | Size |
|---|---|---:|
| The header comment — the file's birth certificate | 1 | 25 KB |
| The CPU | utilities, decode, fetch, register tables, write slots | ~320 KB |
| The keyboard & debug display | 7 | 4 KB |
| The screen | pixel painter | 6.5 MB |
| Memory: storing and changing it | declarations + write rules | 203 MB |
| Memory: reading it | read function | 44 MB |
| The disk | disk read function | 13 MB |
| The clock | double-buffer reads, store, execute, keyframes | 43 MB |

Calcite has no bytes in the file → it stays at the door (the JavaScript
FAQ), not a fake section.

Existing assets slot into the stories: RamWrite (storing/changing),
the memory[IP]-vs-tower exhibit (reading), TickClock (clock), PixelScreen
(screen), KeyboardDemo (keyboard), ADD/flags/DAA exhibits (CPU). The disk
story gets the sector-window mechanism (a 512-byte region that is a *view*
onto whichever sector `--lba` names — DOS never learns the disk is
fiction) — currently missing from the site entirely.

Open: where Tricks and Credits live in the new shape (extra rows? pages
after the hub?). [Q for owner.]

## Status (2026-07-03)

- Built: 3-step wizard (About/Build/Play); About pages 1–4, including
  the FAQ page — owner thesis pasted verbatim, 7 Foldable questions
  with **agent-drafted answers awaiting owner review**. Page 5 is the
  group table + an under-construction note.
- Stashed: the old 8-page How-it-works route →
  `web/site/src/attic/HowItWorks.svelte` (unmounted; imports still
  resolve). Its widgets stay in `components/` for the pane stories.
- Not built: the hub (bar + contents + pane), the disk-window story.
- Next agreed step: build the hub **shell** on About page 5, then work
  the eight stories one at a time, together.
