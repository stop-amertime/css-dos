# 2026-07-13 — LANDED: File Map "why not just X?" Q&A subsections

- New subsections, the reader's question as the SectionHead:
  - MemDecl "Wait - why pretend those are memory at all?" — palette/
    writable-disk cells vs a bespoke function (owner commit `428b6b2`).
  - Clock "Why not just make the clock faster?" — recalc ≫ 400 ms;
    numbers from logbook 2026-07-09-chrome-eval-huge-cabinet.
  - MemWrite "Does every byte really need this?" — nothing is
    knowably code at build time; and "Couldn't big instructions just
    take several ticks?" — owner tried it, 5-10× slower; the 1-slot
    filesize saving computed exactly: 105.6 MB over 368,256 cells
    (3-layer model 169.6 MB vs measured 171 MB region — sums in the
    component comment).
  - Screen "64,000 divs? Pixel artists manage with one" — not the
    hot path, never optimised past small experiments.
- New plan `docs/plans/2026-07-13-readmem-tree-dispatch.md`: explore
  chunked --readMem dispatch vs the flat ~744K-arm if() (constraints:
  calcite shape-recognition risk, 1e6 rule, Chrome nesting).
- Verified: site build green; decl page rendered via dev server.
