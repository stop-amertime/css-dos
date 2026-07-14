# 2026-07-06 - Player hold-key rework (hold mode; zero-JS constraint)

The pin-checkbox Hold UI felt broken (latch only applied on the NEXT
key press) and wasn't ergonomic. Constraint discovered en route: with
zero `<script>` in the player, one click can flip page state OR submit
the form, never both - and CSS `background-image` fetches fire once
per URL per page (probed in Chrome via the real SW), so no pure-CSS
side channel exists. A 2-line auto-submit shim shipped briefly and was
vetoed by the owner same-day; final owner-picked design ("B"):
**calcite** = hold MODE - `#kb-holdmode` checkbox lights the 128px
italic "Hold a key..." label and rides key submissions (`holdmode=1`);
the bridge latches/releases/switches on presses, stale latches release
on the next plain press. No key colouring (page can't know the latch).
**raw** = one-shot arm→catch with red held key, pure CSS (radio group
+ per-key pin overlays), all injected by raw-regen; the styling sits
inert in calcite.html. Keys verified end-to-end on dos-shell (CLI
press-events + web sweep incl. `.` and F1/F3 template recall);
kbd-e2e doom PASS with the mode gesture.
