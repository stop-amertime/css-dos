# Trees ship ALL the cabinet's code - lossless run compression (owner)

Owner rejected truncation ("if the code is too big chunk it better don't
lie"). Caps and note rows are gone; every row of the 309 MB sokoban
cabinet is now reachable in the trees:
- `compressRuns` (tools/extract-tree-data.mjs): a uniform stretch becomes a
  `run` node - `period` templates (%%N%% tokens; memory arms alternate
  mod/round shapes for even/odd bytes) + one numeric column per token:
  constant {c} / exact linear {b,s} / explicit {v:[…]}. Zone gaps cut
  stretches into linear segments where that's smaller; irregular columns
  (floppy bytes, memory-image inits) ship as full arrays - that IS the
  content. EVERY row is re-expanded and compared byte-exact to its source
  serialization at generation time; failures fall back to explicit rows.
- Client (`lazy.js expandRun` + TreeAst `run` branch): rows materialize on
  demand, "(N more…)" pages to the true end (memr alone: 736,434 rows
  behind buttons, verified expanding at row 0 / 500,000 / last).
- Sizes: memw's 171 MB region compresses into a 3.5 KB skeleton of linear
  runs; whole anatomy dir 15 MB raw (disk 4.3 MB = the floppy's bytes,
  decl 3.2 MB = the memory image, clock 6 MB = sweep inits). Site/tool
  only - no kiln changes this round.
- Owner follow-up same day: RUN_MIN raised 16 → 256 so runs exist ONLY in
  the flat memory-scale lists (memr/memw/decl/disk/clock/pixels + the
  256-arm parity table) - there is no tree to break those up by. Every
  tree-shaped section (cpu/chipset/keys/util rest) ships plain nodes
  chunked along the tree, zero runs. Verified by a per-section run census.
