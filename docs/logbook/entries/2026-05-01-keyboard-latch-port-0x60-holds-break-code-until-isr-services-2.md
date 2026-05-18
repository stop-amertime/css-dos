## 2026-05-01 — keyboard latch: port 0x60 holds break code until ISR services it

Three coupled bugs in the keyboard input path, all surfacing on
doom8088 because it's the only cart that hooks INT 09h directly
(replacing corduroy's stub). All fixed.

**Bug 1: zork "G" → "gg" (double-press).** `calcite-wasm::set_keyboard`
was calling both `state.bda_push_key(key)` AND `set_var("keyboard", k)`.
Once corduroy installed an INT 09h handler that also pushes to the BDA
ring, every press doubled. Fix: drop the wasm-side bda_push_key. The
cabinet's ISR is the single source of ring writes.
(`calcite-wasm/src/lib.rs::set_keyboard`.)

**Bug 2: doom "left arrow held forever".** Bridge's release path was
`setTimeout(() => set_keyboard(0), 100)`. The bridge worker lives in
build.html (background tab); Chrome throttles setTimeout in
background-tab workers to ~1Hz, so releases fired seconds late or
piled up. Fix: drive the release off the tickLoop counter (which uses
MessageChannel, immune to throttling). 3 batches ≈ 100ms wall but
bound to engine progress, not wall clock.
(`web/shim/calcite-bridge.js` v43-tick-driven-release.)

**Bug 3: Enter doesn't open the menu in demo loop.** This was the
real sink. `--_kbdPort60` returned the break code only on the *single
tick* the release edge fired:

```css
--_kbdPort60: if(
  style(--_kbdRelease: 1): --or(prevScancode, 128);
  else: scancode_or_zero
);
```

`_kbdRelease=1` for one tick (the transition); the IRQ pends in
`--picPending` but DOOM's ISR may not run until N ticks later (IF
gates, nested PIT IRQ, etc.). By then, port 0x60 returns 0, ISR sees
scancode 0, DOOM's "left held" flag never clears.

Fix: new state-var `--kbdScancodeLatch` holds the most recent
scancode (make on press, break on release) until the next edge. Port
0x60 reads the latch on non-edge ticks. Required three coupled
changes in Kiln:

1. `STATE_VARS` entry → `@property` decl + double-buffer rotation +
   `--__1kbdScancodeLatch` snapshot (otherwise the var never
   registers with calcite, get_state_var returns 0, and the latch is
   invisible).
2. `regOrder` entry + custom default expression mirroring port 0x60's
   edge logic.
3. Updated `_kbdPort60` to fall through to `__1kbdScancodeLatch`.

Verified via Playwright diagnostic: `_g_usergame` flips to 1 at
t=55.9 s — DOOM accepted "New Game" from menu.

Files: `kiln/template.mjs`, `kiln/emit-css.mjs`,
`kiln/patterns/misc.mjs`, `web/shim/calcite-bridge.js`,
`calcite-wasm/src/lib.rs`. Cabinet rebuild required. Snapshots
from before this date are invalidated (state-var ordering changed).

Cardinal-rule check: the latch is generic CSS-side keyboard-controller
modelling. Any cabinet whose CSS sets `--keyboard` and reads
`_kbdPort60` benefits — the rule is "scancode is level-readable
until the next edge", which is what real PC kbd hardware does. No
upstream knowledge encoded.
