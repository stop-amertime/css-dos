# Sokoban cart made buildable (manifest no longer lies)

**Date:** 2026-06-29
**Tag:** BRANCH (`cleanup/public-presentation`)

## Problem

`web/site/assets/carts.js` advertised `id: 'sokoban'` (custom boxart +
description) in the public cart grid, but `carts/sokoban/` had **no
`program.json`** - so `node builder/build.mjs carts/sokoban` couldn't
produce a cabinet. The site offered a cart that couldn't load.

`SKB.EXE` (188 KB) is genuinely Sokoban - embedded strings show the
`S-O-K-O-B-A-N` title and the CGA/Tandy + joystick/keyboard prompts.
It's not in the licensing re-cut's deletion list, so it's intended to
ship. Fix = author the missing manifest (option 1), not delete the
manifest entry.

## Fix

Added `carts/sokoban/program.json` (`cart@1`, `dos-corduroy`,
`runCommand: "SKB"`). Sokoban draws in CGA graphics (mode 0x04,
320×200×4) → `memory.cgaGfx: true`.

## Verify

`node builder/build.mjs carts/sokoban -o sokoban.css` → 288.8 MB
cabinet, 87 files. `pipeline.mjs fast-shoot sokoban.css --tick=4000000`
reaches SKB.EXE's own title screen (`S-O-K-O-B-A-N` / `ENTER YOUR
SYSTEM : C/T`) - i.e. boots through DOS into the program's input loop.
fast-shoot injects no keys, so it stops at that prompt (press C for
CGA, then K for keyboard) - the standard "it boots" bar.

Not added to the smoke set: the curated 7-cart gate already covers CGA
modes via `cga4/5/6` test-carts; a 288 MB game adds little and slows
the gate. `web/prebake/manifest.json` is BIOS-only, no per-cart entry
needed.
