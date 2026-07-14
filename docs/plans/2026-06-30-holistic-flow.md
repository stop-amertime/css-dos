# CSS-DOS holistic flow - design

Date: 2026-06-30
Status: approved (brainstorm), implementation pending
Scope: `web/site/` wizard only. `build.js`, the calcite bridge, and the
player tab are **not** touched.

## Goal

Move the user's first entry point from the dev/testing player flow to the
new holistic multi-step wizard at `/`. Restructure the wizard so the
explanation is richer (3 sub-pages) and the flow *feels* right end to end.
This pass nails FLOW + real interactive widgets; exact prose / figures /
the Lyra URL go in as clearly-labeled placeholders to sharpen later.

## Top-level shape

Progress strip = **3 items: Learn · Build · Play**.

- The old separate "Welcome" step is gone as a top-level step; its content
  (CSS-DOS logo, tagline, the `[X] No JS` bullets, IBM 5150 photo) merges
  into **Learn sub-page 1**.
- "Learn" is a single wizard step that internally holds **3 sub-pages**
  with their own sub-navigation.
- Build and Play steps are unchanged in purpose (cart pick + build; play
  cards). All `build.js` / bridge / player wiring stays intact.

## Navigation model

`wizard.js` gains a sub-page cursor for the Learn step.

- On Learn, **Next** advances the sub-page (1→2→3). Only after sub-page 3
  does Next move the strip to **Build**. **Back** reverses symmetrically
  (Build → Back lands on Learn sub-page 3; Learn sub-page 1 → Back is a
  no-op / disabled, since Learn is now the first step).
- The strip's "Learn" item stays highlighted across all 3 sub-pages.
- A **sub-dot indicator** (e.g. ● ○ ○) inside the Learn step shows which
  sub-page is active and is clickable to jump between them.
- `/games` deep-link: visiting `index.html#games` jumps straight to the
  Build step (zero-plumbing hash handler; no real route needed).

## Learn sub-pages (content per owner spec; widgets are real)

### Sub-page 1 - "What is CSS?"
- Opens with CSS-DOS logo + tagline: "an entire 80s PC, running in a
  stylesheet. Running the first ever operating system, DOS, from a
  simulated floppy disk." (placeholder-sharpenable prose)
- "What is CSS?" recap: HTML = structure, CSS = styles on top.
- **Widget (real): CSS code-flicker demo.** A live styled box + tabs
  (`background-color: red`, `border`, `font-size`, …); clicking a tab
  swaps the rule and the box updates live.
- **Widget (real): basic functions / branching demo** - `calc()` and an
  `if`-style / container-query snippet shown with its visible effect.
- Punchline: CSS is technically Turing-complete → in theory can run any
  computation.

### Sub-page 2 - "Why is this so strange?" (the trick)
- "We're abusing CSS" + a ✗-list of what CSS has no business doing
  (keyboard input, graphics output, memory, …).
- Pivot: emulate every CPU instruction → emulate the whole machine.
- **Real external link** to Lyra's x86-CPU-in-CSS (placeholder URL box).
- "This extends that work" + list of everything CSS-DOS simulates (BIOS,
  floppy/disk, RAM, video, …).

### Sub-page 3 - "The file"
- RAM is defined **literally byte-for-byte** - a real example snippet.
- CSS can't read files → bake the whole computer + BIOS + program into ONE
  file → ~300 MB of pure text.
- Comparison: original Zork source size (placeholder figure).
- **Widget (real): earth–moon distance visual** (SVG): Earth, Moon, full
  distance, ~1/3 dotted to scale. Caption: "one step per character ≈ ⅓ of
  the way to the Moon" (placeholder arithmetic to verify).

## Parked content

The existing Step-2 **pipeline graphic** (your program → pack the PC →
make it CSS → one .css file) is **kept in `index.html` but removed from
the flow** (not reachable via Next). Parked for salvage; delete later if
unused.

## Files touched

- `web/site/index.html` - restructure strip to 3 items; replace the
  Welcome step + old pipeline step with the Learn step (3 `data-subpage`
  sections); park the old pipeline markup out of flow.
- `web/site/assets/wizard.js` - sub-page cursor, Next/Back logic across
  sub-pages, sub-dot indicator, `#games` hash handling.
- `web/site/assets/wizard.css` - Learn sub-page layout, sub-dot indicator,
  styling for the 3 widgets.
- Widget JS - inline in `index.html` or a small `learn.js`.

## Out of scope

- Player tab (`calcite.html`) polish - deferred (owner decision).
- Old dev surfaces (`build.html`, canvas, raw) - kept reachable by URL,
  unadvertised. Step-4 footer dev links already removed.
- Final prose, the Lyra URL, exact byte/distance figures.
