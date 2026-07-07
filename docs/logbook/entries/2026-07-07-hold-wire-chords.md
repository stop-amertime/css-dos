# 2026-07-07 — Hold wire: machine-side multi-key hold (chords)

Owner: hold mode must hold MULTIPLE keys (keyboard shortcuts), and
Shift/Ctrl must stay usable as tap keys. Owner-designed fix: a second
wire. `#kb-holdmode:checked` → `--kbdHold`; while up the machine
suppresses key *release* edges, latching each released scancode into
8 `kbdHeld*` state-var slots (guest sees makes without breaks =
chords). Wire drop drains slots as break codes via port 0x60 + IRQ1,
one per IRQ-idle tick (paced on picPending/picInService). Emit:
`kiln/patterns/misc.mjs` `emitIRQCompute()` + `template.mjs`; per-key
`#kb-X-hold` rules and the bridge latch machine DELETED — the bridge
just mirrors `holdmode` onto the checkbox's `checked` pseudo. Both
players now share identical pure-CSS hold UX (raw-regen injects
nothing). Corduroy unchanged. Verified: CLI typing regression
(`A:\>e.,/1 a`), smoke 6/6, kbd-e2e doom chord LEFT+CTRL PASS.
