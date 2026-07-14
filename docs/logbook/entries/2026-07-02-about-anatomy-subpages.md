# 2026-07-02 - About section: two "how it works" sub-pages + 4 live widgets

Branch `worktree-cabinet-anatomy-doc`. About step grows 5→7 sub-pages
("Screen & keys", "Memory & CPU" between "The file" and Credits;
`ABOUT_SUBPAGES` 7). Four new widget components, each using the real
cabinet mechanism where possible:

- `PixelScreen` - paintable 16×16 grid of real divs (invader sprite).
- `KeyboardDemo` - zero-JS: real `:has(:active)` rules set `--demo-kbd`,
  readout rendered via `counter-reset` (the cabinet's debug trick).
- `RamWrite` - 8 byte-cells + scripted MOV writes, hit-flash.
- `DispatchDemo` - miniature register dispatch: AX genuinely computed
  by CSS `if()`/`calc()` from `--demo-opcode`.

Playwright-verified in Chromium (held key → 7777 → 0; ADD/SUB/MOV → 8/2/42;
paint + MOV flash work). Source doc for later Advanced/Tricks pages:
`CABINET-ANATOMY.md` (repo root, same branch).
