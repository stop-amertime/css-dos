# Tree round 2 of the all-panes work: the "considered" pass (owner feedback)

Owner review of the live trees found flat unparsed rows, click-ceremony, and
raw internal banner names. Fixes, landed to master same day:
- Tool: EVERY decl parses to name+value and one-liner nested rules parse to
  selector+decls+trailer (comment peeled to the comment column) - pixel/
  keyboard/memw rows now get structure, indentation, and run uniformity.
- De-ceremony: single-group regions hoist (banner stays as a comment line)
  under an invisible `root` node (top level paginates/lazies like any list);
  LONE structural wrappers unfold (`.motherboard {`, `@function → result:`)
  so every pane opens onto content - at most one ~48 KB own-section chunk
  fetched on pane load, deeper folds still lazy.
- Kiln banners: css-lib's 7 micro-banners consolidated under BIT & BYTE
  HELPERS with --- subs; flag/shift families demoted to subs ("(N locals)"
  dropped); chipset PIT TIMER DERIVATION / KEYBOARD EDGES & IRQ ARBITRATION
  banners kill "(preamble)"; clock constructs named. Full-kiln A/B clean.
- Renderer: chain one-lining (whole short rules on one line, trailer incl.),
  line budget MEASURED from container width (fixes phone orphan-`}` wraps),
  glyph pinned to visual top (align-self under wrap-reverse), TreeView header
  is a constant "the real CSS + size" strip (no duplicate pane titles).
Verified: browse test (28 checks) + phone/desktop screenshots + websmoke.
