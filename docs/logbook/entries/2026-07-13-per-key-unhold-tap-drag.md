# 2026-07-13 - Hold mode: per-key un-hold + tap-pair mouse drags

Owner UX request. Keyboard: tapping a HELD key again (wire still up)
delivers its break code and clears its `kbdHeld*` slot(s) - per-key
toggle - instead of latching a duplicate; wire-drop drain unchanged.
New `--_kbdUnhold` + `--_kbdClr0..7` wires in `emitKeyboardWires`
(slot equality `1 - min(1, abs(a-b))`; slot holes are fine). GOTCHA
re-learned: style()-TESTED wires are unregistered properties - their
values must be literal if() arms or typed `@function` results (`--or`
tree, the `--_kbdAnyHeld` convention); raw `min()/calc()` tokens
never match `style(--w: 1)` in a spec-faithful evaluator (first cut
passed on calcite anyway - possible calcite leniency, not relied on).
Mouse: `--msHeldBtn` TOGGLES on cell press edges (XOR via `abs`, new
`msTouchPrev` register) - tap presses at A, next tap drags to B and
releases on arrival (release-at-target falls out of the pending-edge
queue); wire-drop still releases immediately. Windows menus: tap
title, tap item. Player tooltips + raw-regen + README updated.
Verified: smoke 6/6, msdos, writable, kbd-e2e + mouse-e2e (both
extended to the new semantics).
