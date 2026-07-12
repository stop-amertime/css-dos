# Kiln audit: dead-code sweep, chipset split, tree-tool polish

**2026-07-12 · BRANCH (`claude/kiln-code-audit-kca9pm`)**

Owner-requested audit of kiln + the file-map extractor, then fixes:
- Deleted 5 never-called @functions (`--int`/`--leftShift`/`--extractByte`/
  `--spliceByte`/`--logicFlags16`) and 5 dead per-tick decode props
  (`--dBit`/`--wBit`/`--dispByte`/`--_shlCFidx16/8`).
- Removed structurally unreachable IN/OUT **imm8** arms for ports > 0xFF
  (`--q1` is one byte; incl. the leftover `style(--q1: 971)`). DX forms untouched.
- New `patterns/chipset.mjs`: PIT/PIC/kbd/DAC wires + `emitIO` out of misc.mjs;
  `DAC_LINEAR` now imported from memory.mjs (was a duplicated literal).
- mov.mjs on shared `REG16`/`SPLIT_REGS`; TF/IRQ override tables hoisted; chipset
  reg lists moved beside their section; ~10 stale comments fixed (README layout,
  6-slot residue, XOR/OR formulas, `--_dskAddrN`, "D0-D1").
- Tree tool: one shared banner classifier, unused `lazy.count` dropped, TreeAst
  prefetches the next chunk page; trees regenerated (round-trip + sanity PASS).
- Prose/counts refreshed: util 21→17 fns, "the 66"→61, 35 flag calculators;
  groups.js sizes re-measured (util 13,680 / cpu 304,674 / chipset 17,960;
  disk 12,788,804 — drift is floppy-timestamp, HEAD A/B builds identical).

Verified: A/B vs HEAD sokoban build — removed property/function NAME sets are
exactly the dead set, zero additions; imm8 high-port arms 0 new vs 7+2+1+1 old,
DX arms identical; hello-text + sokoban builds; site vite build PASS. NOT run
(no calcite in this env): smoke/writable/msdos/websmoke — owed before merge.
