# Explore: tree-shaped --readMem dispatch

**Status: unexplored idea (2026-07-13). Owner wants it investigated.**

## The question

`--readMem` in every cabinet is one flat `if()` with one arm per
emitted byte address — ~744K arms / 44 MB in sokoban. A spec-compliant
evaluator scans arms in order, so a read near the end of memory walks
hundreds of thousands of `style()` tests, and the CPU makes 8+ such
calls per tick (the fetch alone). Could a chunked dispatch be faster
in Chrome?

Shape sketch (all inside the `@function`, which already uses locals):

```css
@function --readMem(--at <integer>) returns <integer> {
  --hi: round(down, var(--at) / 1024);
  --lo: mod(var(--at), 1024);
  result: if(
    style(--hi: 0): if(style(--lo: 0): …; style(--lo: 1): …; …);
    style(--hi: 1): if(…);
    …);
}
```

~744K arms → ~730 outer + 1024 inner tests per call. Two levels, or
three (32×32×~730), whatever measures best.

## Constraints (read before coding)

1. **Cardinal rule** (CLAUDE.md): restructuring CSS so it's easier to
   evaluate is explicitly allowed **as long as Chrome computes the
   same results**. A tree readMem pays for itself in Chrome — that's
   the point. No calcite-only signalling.
2. **Calcite recognisers pattern-match emitted shapes.** Changing
   readMem's shape may break calcite's compiled fast path for memory
   reads → compile-time or runtime cliff. Any calcite adaptation must
   pass the genericity probe (shape-only, no upstream knowledge).
   Budget for this being the real cost of the change.
3. **The 1e6 precision rule** (memory-layout.md): `--at` is a
   *computed value*; Chrome keeps ~6 significant digits of computed
   numeric properties. The existing flat arms and the >1 MB hidden
   storage already dance around this — check how match keys above
   1,048,576 currently work before assuming `round(down, --at/1024)`
   is safe across the full range.
4. **Chrome's `@function`/nesting fragility** (mapped by experiment;
   see kiln comments + the site CPU section). Nested `if()` inside one
   function may behave differently from nested function calls — test a
   small cabinet in real Chrome first.

## Prior art / warning

A related size-for-speed trade (multi-tick instructions, one write
slot) was tried and ran **5–10× slower** — leaner text lost to extra
re-evaluation. Direction of surprise is unpredictable here: measure,
don't reason.

## Experiment plan

1. Emitter variant in `kiln/memory.mjs` behind a build flag
   (default: flat). Both shapes are Chrome-honest, so a flag is fine.
2. Equivalence: build one cart both ways →
   `node tests/harness/run.mjs smoke` + `pipeline.mjs fulldiff` on the
   tree build; a few-tick A/B in real Chrome (the raw player or
   `web/player/experiments/huge-css-test.html`).
3. Measure:
   - **Chrome**: per-tick recalc, flat vs tree, small cabinet
     (hello-text-class, ~6 s/tick baseline) + doom8088 first style
     resolution (~310 s baseline) — method in logbook entry
     2026-07-09-chrome-eval-huge-cabinet.
   - **Calcite**: compile + runtime via canonical bench profiles only
     (**read `tests/bench/README.md` first — mandatory**), 3-run web
     medians.
   - File-size delta.
4. Ship bar: tree strictly faster in Chrome AND calcite inside the
   ±3% band → propose flipping the default. Either way, logbook
   FINDING entry with numbers, and delete this plan.
