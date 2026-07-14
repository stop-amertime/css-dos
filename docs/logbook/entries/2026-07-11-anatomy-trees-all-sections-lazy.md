# Anatomy trees on all 10 panes + lazy chunked data (owner-requested)

Landed to master 2026-07-11 (owner request, for live testing). Two halves:
- `tools/extract-tree-data.mjs` rewritten: one generic region parser covers
  all ten file sections (banner slicing, @property/@function/rules/nested
  one-liners/@keyframes); per-region round-trip still mandatory; cpu pane
  keeps its curated 3-group layout. Regen: `node tools/extract-tree-data.mjs all`.
- Progressive disclosure: per-section SKELETON module (bundled, ~19 KB total
  - site bundle 740→235 KB) + paged JSON chunks under
  `web/site/public/anatomy/<id>/` fetched on expand (`lazy: {ref, count}`,
  pages carry `next: {ref, remaining}` so "(N more…)" shows true totals
  before download). 64,000 pixel rules capped at 1024 + explicit `note` row.
Kiln: region run-delimiter comments planted (readMem RAM/bridge/ROM/window,
decl groups, memw/buffer/sweep headers) - comment-only, equivalence-checked.
Verified: Playwright browse test (all panes mount, zero fetches pre-expand,
cross-page pagination, cpu groups intact) + site build + websmoke. Native
gates still need a calcite checkout. Plan doc updated (format spec there).
