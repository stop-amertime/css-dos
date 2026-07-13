# 2026-07-13 — DEAD/FINDING: tree-shaped --readMem dispatch not worth it

Explored (plan `2026-07-13-readmem-tree-dispatch.md`, now deleted)
turning the flat `--readMem` `if()` (one `style(--at: N)` arm per byte)
into a two-level tree: outer `if(style(--hi: K))` on
`round(down, --at/CHUNK)`, inner `if(style(--lo: J))` on
`mod(--at, CHUNK)`. Killed at the design/measurement-estimate stage —
no code emitted. Reasons:

- **Calcite: no speed upside, real regression risk.** Calcite already
  compiles the flat read to an **O(1) packed-byte array/jump-table**
  (`Op::LoadPackedByte` + dense exception table, recognised in
  `calcite-core/src/pattern/dispatch_table.rs` +
  `compile.rs`). A tree can't beat O(1). Worse: the recogniser runs
  once on the function body and **never recurses into nested `if()`
  branch-`then`s**, and its array fast paths require each arm to be a
  literal / `var` / byte-extract — a nested `if()` is none. So the
  outer level would become a hash on `--hi` and **every inner chunk
  would degrade to a linear `CmpEq` scan**, strictly slower than today.
  Reaching mere parity would need new recogniser work (recurse the
  two-level tree, re-flatten — legal, shape-only) just to stand still.
- **File size: ~3-5% of the readMem block only, i.e. low single-digit
  % of the cabinet.** Measured on a flat baseline (hello-text, 16.4 MB,
  7,632 arms): each `--readMem` arm ≈ 53 B, of which the `style(--at:
  N): ` key is ≈ 21 B and only ≈ 5-6 B is address digits. The tree
  shaves ~2-3 B/arm off the key digits, partly given back as per-chunk
  `if()` wrapper overhead — a couple percent, and Calcite (not Chrome)
  is what actually runs.
- **Chrome recalc** was the only place a tree could win (fewer
  `style()` tests per read). Chrome is the "in theory" path that
  crashes on cabinet size anyway, so a Chrome-only win isn't a
  real-world gain. Not measured — the size + calcite math made it
  moot.

Address split noted for anyone revisiting: in `--readMem`, arms
< 1e6 (RAM + BIOS ROM at 0xF0000=983040) are exact-key; the ≥ 1e6
arms are exactly the 768-byte DAC palette shadow (0x100000+) — the
Chrome-imprecise zone (memory-layout.md 1e6 rule). A tree would have
to leave those 768 arms flat regardless.

Verdict: **a couple percent of file size, zero speed, engine-regression
risk. Not worth it.** Owner call, 2026-07-13.
