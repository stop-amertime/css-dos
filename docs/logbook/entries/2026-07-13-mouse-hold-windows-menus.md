# 2026-07-13 — Mouse hold + cycle-paced packets: Win 1.01 menus work

Owner report: menus won't open; clicks flash but do nothing. Finds:
(1) Win 1.x menus only stay open **while the button is held** — fix:
the hold switch (`#kb-holdmode`) also raises `--msHold`; the first tap
latches the button down (`--msHeldBtn`), later taps drag, hold-off
releases. (2) **Every click landed at the previous gesture's
position**: back-to-back UART packets made the next packet's IRQ nest
inside USER's still-running MouseEvent (buttons processed BEFORE
movement) — proven by dumping USER's hardware event queue. Fix:
`--msQuietUntil` packet pacing in **CYCLES** (120K ≈ the real
1200-baud 25 ms; ticks are useless — idle guests make them cheap) +
`--msPendEdges` edge queue (short presses still deliver their full
down→up train). (3) Bridge tap pacing moved to cycles too
(hold ~52 ms + gap ~31 ms guest, `calcite-bridge.js` bridge-4) — the
old tick-counted holds put double-click taps 4.5 guest-seconds apart,
outside Windows' 500 ms window. (4) The Executive's menu bar is the
SECOND text row (row 0 = caption with system-menu/zoom boxes — the
"buttons that go black"); its listbox hit zones sit ~a line below the
drawn text (click targets aim a row low, e.g. CLOCK = mc-885).
Isolation rig: `input.mouse` now works on hack carts — a 31-byte
UART-logger COM verifies the packet stream in seconds. Verified,
vendored-wasm web path: tap selects instantly, double-click launches
CLOCK, hold+tap View drops a menu that STAYS, drag highlights,
release executes (View→Long reformats the listing). e2e
`mouse-e2e.playwright.mjs`: menu-via-hold step + topInk-gated
Executive baseline. Non-mouse cabinets byte-clean.
