# Tree View round 2: Kiln banners restructured, run-delimited lists

The `.cpu` rule is now logically grouped IN KILN (owner-licensed,
functionality-inert — custom-prop order in one rule is name-resolved):
two banner levels (`===== FETCH & DECODE/REGISTERS/MEMORY WRITE SLOTS
=====` with `--- instruction fetch/prefix detection/…/register aliases/
register update formulas ---` subs), aliases moved under REGISTERS.
The tree mirrors it automatically (two-level section parsing). Long
sibling lists now render in RUNS delimited by standalone comments —
each run paginates independently, comments stay visible — proven by a
Kiln comment planted before `--unknownOp`'s final else (232 rows
paginate; the else can't drown). Comments inside `if()` values are
safe: servo cssparser tokenizes them away before calcite's recognizers
(verified in source + smoke). Short pane titles, header = code-file
icon + title + real KB, cyan fold boxes/more-buttons, depth tint ramp,
multiline-comment render fix (blocks are ONE `<code>` now). Gates:
smoke 6/6 + writable + msdos PASS. Conventions + running list:
`docs/plans/2026-07-10-anatomy-tree-view.md` (rewritten as living
doc; the shipped 4-task PLAN file deleted per protocol).
