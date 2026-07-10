# Anatomy tree view — design

Status: approved, pilot scope = CPU section only.

## Problem

Each anatomy section pane (`web/site/src/components/anatomy/Section*.svelte`,
reached by clicking a `CabinetBar` segment) is a hand-written guided-tour
prose page with a handful of hand-picked code snippets (e.g. `AX_TABLE`,
`ADD_AX` in `SectionCpu.svelte`). There is no way to browse a section's
real structure — e.g. "all fourteen register tables, each table's real
rows" — only the handful of excerpts the prose walk chose to show.

Add a **Tree View**: an expandable `[+]`/`[-]` tree of a section's real
CSS, sitting above the existing prose in each section pane, letting a
reader drill from a section down to real leaf code without reading a
guided tour first.

## Non-goals

- Not a live parser of an arbitrary cabinet build. Tree data (structure +
  leaf code) is hand-authored per section, same workflow as today's
  prose-page snippets — not generated from a build artifact at runtime
  or at site-build time.
- Not a replacement for the existing prose walkthroughs. Both coexist in
  the same pane; tree view is additive, on top.
- Pilot scope is the CPU section only. Other sections (memory, disk,
  clock, ...) are a follow-up once the interaction/visual design is
  validated, not part of this spec's implementation plan.

## Two node flavors

Every tree node is one of:

1. **Editorial group node** — an artificial grouping that doesn't
   correspond to any real CSS structure (e.g. "Registers", "AX",
   or a lopsided-volume slice like "memory-address rows" / "edge
   cases" under a big table — see Pagination below). Folder-style
   `[+]`/`[-]` glyph, neutral grey, prose-style label. Never shows code
   directly at its own level — expanding it reveals child nodes.
2. **Real construct node** — wraps one real, verbatim chunk of cabinet
   CSS. Glyph, colour, and label come from the classifier (below). If it
   has children (e.g. a register's table has many `style()` rows),
   expanding shows the classifier-labelled child list; the node's own
   code is shown via `CodeCss` (Prism-highlighted, same component the
   prose pages already use).

Leaf real-construct nodes with no children render their code directly,
no expand arrow — same as today's static `CodeCss` blocks.

## The classifier

A pure function, `classify(cssChunk) -> { kind, label }`, that reads the
actual syntax of a chunk of real CSS text and derives its kind — no
hand-picked kind-per-section list, so it holds up for sections not yet
built:

| Pattern | kind | label |
|---|---|---|
| `@property --NAME { ... }` | `property` | `--NAME` |
| `@function --name(...) { ... }` | `function` | `--name()` |
| `style(...): ...` guard | `rule` | the guard condition, e.g. `--opcode: 5` |
| `@keyframes name { ... }` | `keyframes` | `name` |
| bare selector block (`:is(...)`, `.class {`, etc.) | `selector` | the selector text |
| `/* ... */` standalone | `comment` | first ~40 chars |
| anything else (bare declaration/expression) | `value` | first token |

Each kind gets one fixed glyph + colour, reused across every section so
the vocabulary only has to be learned once. Colour choices should draw
from the existing semantic families in `groups.js` where sensible (e.g.
lean `property` toward the memory blues, `function` toward the utility
green) but this is a visual-pass decision, not a hard rule — expect to
iterate once nodes are on screen.

**The classifier only labels one node's own kind.** It never decides
tree shape, grouping, or pagination — that's all editorial (see below).

## Pagination: the per-level cap

Any node with more than ~20 children renders the first 20 plus a
`(N more…)` row; clicking it appends the next 20 in place (no new page,
scroll position holds).

**Lopsided-volume case** (e.g. a memory read-formula's function has
~700,000 same-kind rows of one shape, ~1,000 of another, ~500 of a
third): this is handled with the *same* editorial-grouping mechanism as
"Registers → AX", not a separate skew-detection feature in the
classifier. The person authoring that section's tree data slices the
lopsided node's children into editorial sub-groups with judgment-call
labels (e.g. "memory-address rows", "segment overrides", "edge cases"),
each independently subject to the same 20-cap. There is exactly one
grouping mechanism in the whole system; it's applied wherever a section
author judges a node's children need it, whether that's "these are
conceptually different things" (Registers/AX) or "this list is
otherwise unreadably long" (the 700K case).

## Data & placement

- New component `web/site/src/components/anatomy/TreeView.svelte`,
  rendered at the top of `SectionCpu.svelte`, above the existing prose.
- New data file `web/site/src/components/anatomy/cpu-tree.js`: hand-
  authored tree structure (editorial groups + real-construct nodes),
  reusing `cpu-coverage.js`'s 850-row opcode-per-register mapping as the
  source of truth for *which* `style(--opcode: N)` rows exist per
  register table. Not all 850 rows need real code transcribed for the
  pilot — populate a representative subset per register (capped/paginated
  display already tolerates partial data; a group can note "N more" even
  where some of those N aren't yet transcribed, same as the rest of the
  site's honesty-about-scope conventions).
- A small one-off Node helper script (location: `tools/` or similar,
  final call at implementation time) that, given a real built cabinet
  `.css`, can print "the full `@property`/`@function` block for
  `--NAME`" or "all `style(--opcode: N)` rows in table X" — a copy aid
  for transcribing real code accurately into `cpu-tree.js`, not a
  generator that produces the tree data file itself.

## Visual design

Expect iteration once real nodes are on screen (explicitly flagged by
the project owner as a "try stuff and see" area, not fully nailed down
here). Starting point:

- Reuse `Foldable`'s `[+]`/`[-]` glyph convention for expand/collapse,
  extended with the classifier's per-kind glyph/colour for real-construct
  nodes vs. the neutral folder glyph for editorial groups.
- Indentation per tree depth, monospace for real-construct labels/code,
  regular text for editorial group labels.
- `CodeCss` (existing component, Prism CSS highlighting) renders a real
  node's own code when expanded.

## Testing / verification

- Visual/manual: build the site, open the CPU section, verify the tree
  expands/collapses, the classifier labels look right against real
  cabinet code, the 20-cap "more" pagination works at both a normal
  level (opcode rows under AX) and, if authored, a lopsided-grouping
  level.
- No new automated test framework needed — this is a presentational
  Svelte component; existing site build (`npm run build`) and any
  Playwright smoke coverage of the About/anatomy pages (if present)
  should stay green.
