# 2026-07-03 — play-page calcite "unknown function: rgb" is benign; flow works

Tag: FINDING

Owner-reported: play page compile appeared to die after
`failed to parse result in @function --paletteRGB: parse error:
unknown function: rgb` (calcite_wasm). **Not reproducible as a
failure.** That warning is calcite honestly refusing the pixel
painter's `rgb()` results (`stylesheet.rs:245` → result falls back
to literal 0; painter inert in the calcite path by design). It fires
~3 s into EVERY successful wasm compile. Reproduced end-to-end via
Svelte-site dev server: Sokoban 294.9 MB compiled 13.0 s → runs;
Doom8088 323.0 MB compiled 9.5 s → title screen. Native A/B: painter
adds ~0.3 s / ~30 MB (3.3→3.6 s parse-only on doom).

Real traps found: (1) compile gives NO player-side feedback for
10–25 s and its console messages appear only in the *builder tab*;
(2) reloading/navigating the builder tab (incl. Vite HMR full-reload
from editing site files) silently kills the bridge worker + cabinet —
player then waits forever ("opening the player does nothing");
(3) committed debug debris in calcite `compile.rs` (~2044, `[linear
branch]` op dumps, "opcode 214" comment) floods DevTools during
compile, slowing it and making it look wedged.
