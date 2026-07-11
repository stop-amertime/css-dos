# Kiln .cpu commenting-consistency pass (owner item 2026-07-11)

All in `kiln/emit-css.mjs`; the tree mirrors it for free.
- MEMORY WRITE SLOTS: intro comment; `--- slot N ---` / `--- write gates ---`
  sub-banners; each slot's rows regrouped by destination kind (`classifyWrite`:
  ea → direct → string → stack → group → OUT) with a run-delimiter comment per
  kind and ascending opcode within; pre-else "slot idle" comments; slot-live +
  width gates carry per-row instruction comments (threaded through `_slotMeta`),
  mirroring slot order.
- Dispatches ≥24 rows + `--unknownOp`: run-delimiter comments at 8086 opcode-map
  family boundaries (`OPCODE_FAMILIES`); pre-else "REG holds" row; 4 group labels
  between the 16 register decls; stale `--instId` prose fixed to `--opcode`.
- Reorder safety: arms key on distinct `--opcode`, TF/IRQ arms pinned first.
  Proved old-vs-new equivalence (comment-strip + arm-set compare) on rom AND
  writable configs: only the 9 slot/gate dispatches differ, arm order only.
- cpu-tree.js regenerated (round-trip OK; slots = 4 sub-sections). Verified:
  websmoke PASS + site build. Landed to master 2026-07-11 at owner request
  for live testing; the env had no calcite sibling, so the native
  smoke/writable/msdos gates are still owed — run them next calcite session.
