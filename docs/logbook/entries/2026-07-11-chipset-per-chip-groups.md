# Chipset divided BY CHIP; screen palette/pixels named (owner feedback)

"CHIP DISPATCH TABLES" was a label crowbarred over an undivided lump.
Fixed by actually dividing, in Kiln (declaration order in a rule is
name-resolved — full-kiln A/B set-compare EQUIVALENT on rom + writable):
- misc.mjs: `emitIRQCompute` split into `emitKeyboardWires` (edges, hold-wire
  held set, port-0x60 latch input) + `emitIRQArbitration` (which IRQ fires);
  `emitPeripheralCompute` renamed `emitPitDerivation`. Live doc/comment refs
  updated (template, players, bridge, raw-regen; dist/ + history left as-is).
- emit-css chipset rule now groups PER CHIP, wires-then-registers each:
  PIT — INTERVAL TIMER (8253) / KEYBOARD CONTROLLER / PIC — INTERRUPT
  CONTROLLER (8259) / VGA DAC — PALETTE STATE MACHINE. chipsetRegs array
  replaced by PIT/KBD/PIC/DAC_REGS with comments moved to their groups.
- pixels.mjs: `--- 256-colour palette ---` / `--- one rule per pixel
  (320×200 = 64,000) ---` sub-banners so the screen pane opens as two
  honest groups instead of an unlabelled wall.
Lesson written into plan principle 9: divide by the domain's real
structure FIRST, then label the divisions — never label the lump.
Verified: regen round-trips, browse test ALL PASS, websmoke PASS.
