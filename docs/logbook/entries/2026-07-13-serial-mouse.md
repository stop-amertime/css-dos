# 2026-07-13 - Serial mouse: Windows 1.01 is clickable

New opt-in cart hardware (`input.mouse`): a Microsoft serial mouse on an
8250 UART at COM1 (0x3F8, IRQ 4), implemented entirely in emitted CSS.
MOUSE.DRV's probe (disassembled from the driver: RTS toggle → expect 'M',
then IER=1, INT 0Ch from its own port table) is answered by OUT/IN
dispatch arms; a tick-clocked packet machine turns taps on an 80×25
`#mc-N` cell grid into 3-byte MS-protocol packets (kiln
`emitMouseWires`). PIC arbitration generalises to lowest-set-bit ONLY on
mouse cabinets - others keep the lean two-way mux. Corduroy 0.6.0 now
sets BDA COM1 base + equipment bits (drivers find the port there).
Findings: Win 1.01/CGA applies deltas **2:1 on both axes** and starts
its cursor at pixel (320,100) - position is dead-reckoned in half-pixel
mickeys from that measured origin (park-to-corner failed: the guest
COALESCES deltas by summing, so park+return cancels). Button state only
rides packets once the cursor is at target (click lands at destination,
not mid-flight). Executive semantics: click selects; double-click over
the already-selected item launches. Players: calcite.html overlays 2000
invisible submit buttons riding the existing `/_kbd`→bridge pulse path
(no bridge changes); raw-regen expands the same grid as real buttons
(pure `:active` in Chrome). New e2e: `node
web/tests/mouse-e2e.playwright.mjs` - real click launches CLOCK.EXE
through the whole stack.
