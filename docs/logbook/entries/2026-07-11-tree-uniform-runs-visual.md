# Tree View round 3: run-uniformity policy + visual polish

Owner-steered display round, ending "extremely regular and beautiful":
**run uniformity** — within a comment-delimited run, same-shaped
branches (condition with numbers masked) wrap together (renderer,
`runForcedKeys`) and fold together (tool carve pass; fold points 441 →
1361 — one-line rows fold to hide just their value), so a dispatch
table reads as a uniform list with only the genuinely-different
trailing `else:` standing out. **Depth always shown, exactly once**:
one level deeper = one tint step — block (`.ast-children` ramp), own
line (`.ast-continuation` tint), or inline (`.ast-depth` chip on the
value beside its condition); fixed a double-highlight where split
values got tint + chip. Also: comments as right-edge annotation
column (own flex item, never compresses; wrap-reverse stacks them
ABOVE tight rows; always stacked ≤640px); rigid condition boxes
(never wrap mid-token); values wrap hanging under their own start
(flex-basis-0 scheme); cyan fold boxes + (N more…) buttons; header =
script-text icon + title + real KB; multiline-comment render fix;
empty-glyph baseline fix (phantom margin). Two new principles (7, 8)
in `docs/plans/2026-07-10-anatomy-tree-view.md`. Gotcha: regenerating
cpu-tree.js truncates the file mid-write — a hot-reloading dev tab can
wedge on "no export named CPU_TREE" until a hard refresh.
