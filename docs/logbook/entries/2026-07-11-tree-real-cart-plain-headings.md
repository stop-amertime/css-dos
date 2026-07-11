# Trees extract from the real sokoban cabinet; headings plain (owner)

Owner rejected the synthetic-cart "exhibit from a minimal build" framing
and the explanatory heading style. Fixed:
- `tools/extract-tree-data.mjs` now builds `carts/sokoban` (the cabinet the
  whole site is measured against) and parses THAT — headers show the real
  region sizes (memr 43.8 MB, memw 170.7 MB, decl 32 MB, disk 12.8 MB,
  clock 43 MB). Exhibit `note` prop deleted from TreeView + all mounts.
- Caps are now PER RUN (CAP_ROWS=512 between run-delimiter comments) so a
  655k-arm dispatch ships its head per region-run while the memory-map
  shape (RAM / bridge / ROM / window) stays visible; each capped run ends
  with a plain "… N more rows" note. Committed chunks still ~1.9 MB.
  Parser hardening for 44-171 MB regions: index-based trailing-comment
  lookahead (two O(n²) slices), no array spreads on 200k+ child lists.
  Generation ≈ 70 s + a 12 s cabinet build.
- Headings are bare descriptions, CPU-section style: "palette function" /
  "pixel rules"; "clock animation" / "store keyframe"; "PIT TIMER (8253)"
  → "tick derivation" / "registers"; "edge detection"; "IRQ arbitration";
  "index registers"; css-lib colon-explanations dropped. Full-kiln A/B
  EQUIVALENT (rom + writable). Tree titles restored per pane (sizes now
  agree with groups.js).
Verified: browse test ALL PASS (incl. real-MB header + cap-note checks),
websmoke PASS.
