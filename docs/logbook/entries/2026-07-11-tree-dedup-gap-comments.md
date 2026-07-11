# 2026-07-11 — Tree dedup + gap-comment landmarks (owner round 3)

Owner: registers duplicated across CPU/decl panes; comments not
rendering properly; why not chunk at the 20-row page boundary?
- CPU pane's borrowed boxes deleted (flag @functions live in util,
  register @property blocks in decl) — cpu now parses its real file
  region like every other pane: `.cpu {` open with FETCH & DECODE /
  REGISTERS / MEMORY WRITE SLOTS. `buildCpuNodes` special-case gone.
- decl pane retitled "Variable declarations" (it holds ALL @property
  decls, not just memory) — TreeView title + map-bar label.
- Kiln: `/* gap: bytes 0x..-0x.. unpopulated in this build */` at
  address jumps in all 6 big lists (decl/@property, write rules,
  __1mc/__2mc/__0mc plumbing, readMem arms). Full A/B equivalence
  PASS (rom + writable). Fixes memw's silent 359679→376832 jump.
- Region-header banner notes dropped (pane header renders that);
  chunk `next.remaining` + group pagination now WEIGHTED (a run
  counts its rows): decl "(7 more…)" lie → "(368,264 more…)"; a
  part-shown run hides later siblings behind the one group button.
- Anatomy data 15→7.5 MB. Browse test (62 checks) + websmoke PASS.
