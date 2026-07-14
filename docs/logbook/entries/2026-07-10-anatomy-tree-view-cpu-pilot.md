# Anatomy Tree View - CPU pilot (AST-powered)

A Tree View above the CPU section prose (`SectionCpu.svelte`), fully
powered by a real AST: `tools/extract-tree-data.mjs` runs the real
`emitCSS()` on a tiny synthetic cart, slices each register's dispatch,
and parses it token-by-token (decl/if/branch/value - a node's code is
ONLY its own token), plus `section`/`block` nodes for editorial labels
and verbatim exhibits. The tool **round-trip-verifies** every register
(AST reconstruction must equal the raw text) and opcode counts match
`cpu-coverage.js` for all 14 registers. Top level mirrors the REAL
file order (nothing reordered): 36 flag-arithmetic `@function`s
(scanned dynamically, addOF16…sarFlagsN8) → the COMPLETE `.cpu` rule
(163 entries: 8 aliases, fetch/decode/ModR/M/EA pipeline, 14
dispatches, banner comments - whole-rule round-trip-verified) →
`@property` blocks (really near the file's end). One
renderer (`TreeAst.svelte`); collapse ONLY at tool-carved fold points
(sections, decls, property/function blocks, nested-if opcode rows),
20-per-level pagination, one-line joins under an ~80-char budget else
split at the child boundary. Iterated live with the owner on the dev
server; earlier hand-transcribed/classifier-glyph versions fully
superseded (`TreeNode/TreeCode/classify/kind-style` deleted).
Regenerate: `node tools/extract-tree-data.mjs cpu > web/site/src/
components/anatomy/tree/cpu-tree.js`. Open: the other 9 file sections
still need their own extraction recipes (same primitives).
