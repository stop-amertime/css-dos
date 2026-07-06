# 2026-07-06 — Player "Hold a key..." rework (arm → press → latch)

The pin-checkbox Hold mode felt broken (checking a pin did nothing
until the *next* key press — the bridge only latched on submissions)
and wasn't ergonomic. New gesture: press **"Hold a key..."** (italic,
arrow-block-width, right stack), press the key → it latches and turns
red; press it again (or the button, now "release key") to let go.
Mechanism: one hidden radio group `name=held` (#kb-holdmode = armed,
#kb-nohold = idle, #kb-X-hold = held) — while armed each pin radio is
an invisible catch target covering its key, and radio exclusivity
un-arms in the same click. Pure CSS in raw.html (cabinet contract
`#kb-X-hold:checked` unchanged). calcite.html gains its ONE script: a
2-line change→requestSubmit shim (raw-regen strips it) so the bridge
hears the latch at click time; bridge now reconciles its latch from
`held=` alone (no key click needed). kbd-e2e updated to the new
gesture + BASE env override; UI states verified headless, e2e PASS.
