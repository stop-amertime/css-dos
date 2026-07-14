# Keyboard branch fails the web bench: stuck at Mode-13h title

2026-05-18 · FINDING · cross-cutting (CSS-DOS harness + calcite
`feat/keyboard-pseudo-input`)

Tried to bench calcite `feat/keyboard-pseudo-input` (`baf3086`)
end-to-end to verify the LOGBOOK's `apply_input_edges`
"162K→297K fixed" claim (treated as untrusted). Used its matched
CSS-DOS harness `feat/retire-keyboard` (`master`'s iframe bench page
+ SW + bridge are the *reverted* keyboard plumbing - wrong base; the
branch's own log-only page/profile is the correct pairing).

**Measured result: the keyboard branch does not reach in-game.**
doom8088 compiles fine (27.6 s), engine runs steadily (~450K cyc/s,
~1 fps, `mode=0x13`) but **never advances past the Mode-13h title
splash in 600 s** - `pseudo_pulse=active,kb-enter` never dismisses
the title. Engine is *ticking*, not slow-stuck - it's
**functionally** stuck. Control (same harness, calcite `main`)
throws `unknown action "pseudo_pulse=…"` immediately, proving the
harness is correctly matched (the action only exists on the keyboard
branch) and the stall is the branch itself. JSONs:
`docs/benches/doom-loading-2026-05-18-keyboard-baf3086-TIMEOUT.json`,
`docs/benches/doom-loading-2026-05-18-CONTROL-calcite-main-THROW.json`.

**Consequence:** the keyboard branch **cannot be perf-benched** (no
in-game). "Keyboard regression already fixed" is unproven; what's
proven is the branch is not web-shippable as-is. STATUS / the
genericity plan corrected to stop asserting the keyboard story is
settled.

**Harness debt found + fixed (on `feat/retire-keyboard`, local
only):** its bench driver was stale vs `master` - plain
`chromium.launch` (broken on this Win box; needs
`launchPersistentContext`+system Chrome), no SW-claim
context-destroy tolerance in the poll loop, and page `log()` is
DOM-only so stage progress was invisible. Ported `master`'s launch +
added poll resilience + DOM-`#log` stderr mirroring to diagnose.
Reverted after (branch is parked, not the active line).
