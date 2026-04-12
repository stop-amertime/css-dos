// PIT (i8253) CSS state: counter decrement, reload, IRQ firing.
//
// The PIT counter decrements by floor((cycleCount - __1cycleCount) / 4) on each
// instruction retirement. When the counter reaches 0, it reloads and raises IRQ 0.
//
// PIT state is managed as standalone computed properties (like irqActive), not
// through the per-opcode dispatch table. This avoids duplicate entry conflicts
// when multiple ports affect the same state var on the same OUT opcode.

/**
 * Emit PIT computed properties and state updates for the .cpu rule.
 */
export function emitPitProperties() {
  // Helper: AL = low byte of AX
  const al = `--lowerBytes(var(--__1AX), 8)`;

  // _pitTicks: PIT ticks this instruction = floor(new cycleCount/4) - floor(old/4)
  // Only nonzero on retirement ticks (when cycleCount advances).
  const pitTicks = `calc(round(down, var(--cycleCount) / 4) - round(down, var(--__1cycleCount) / 4))`;

  // _pitDecrement: mode 3 decrements by 2*ticks, mode 2 by 1*ticks
  const pitDecrement = `if(style(--__1pitMode: 3): calc(${pitTicks} * 2); else: ${pitTicks})`;

  // _pitNewCounter: counter after decrement (before reload check)
  const pitNewCounter = `calc(var(--__1pitCounter) - ${pitDecrement})`;

  // _pitFired: 1 if counter crossed zero (pitReload > 0 and newCounter <= 0)
  // sign(x) returns -1/0/1. We want fired=1 when newCounter <= 0 and pitReload > 0.
  // fired = (pitReload > 0) * max(0, sign(-newCounter + 1))
  //        = (pitReload > 0) * max(0, sign(1 - newCounter))
  // But sign() with CSS... let's use: if newCounter <= 0 then 1 else 0.
  // Since we can't easily do <= with style(), use: max(0, 1 - max(0, newCounter))
  // When newCounter > 0: max(0, 1 - newCounter) — if newCounter >= 1, this is <= 0, clamp to 0
  // When newCounter <= 0: max(0, 1 - 0) = 1 (or more, but we just need > 0)
  // Actually simpler: just compute the counter with modular reload.

  const lines = [];

  lines.push(`  --_pitTicks: ${pitTicks};`);
  lines.push(`  --_pitDecrement: ${pitDecrement};`);

  // _pitFired: 1 if PIT counter crossed zero this tick.
  // = 1 when pitReload > 0 AND __1pitCounter - _pitDecrement <= 0
  // = (pitReload > 0) * max(0, sign(_pitDecrement - __1pitCounter + 1))
  // sign(x) returns -1, 0, or 1. When decrement >= counter, sign >= 0 → max gives 0 or 1.
  // We clamp with min(1,...) to ensure it's exactly 0 or 1.
  lines.push(`  --_pitFired: if(style(--__1pitReload: 0): 0; else: min(1, max(0, sign(calc(var(--_pitDecrement) - var(--__1pitCounter) + 1)))));`);

  // pitCounter update: decrement, reload when hitting 0.
  // Also handle OUT port writes (0x43 resets, 0x40 loads data).
  //
  // Priority (first match wins):
  // 1. OUT imm8 to port 0x43: reset counter to 0
  // 2. OUT imm8 to port 0x40, writeState=1 (hi byte): load counter from new reload
  // 3. OUT DX to port 0x43/0x40: same as above but port in DX
  // 4. Normal tick: decrement, reload on zero crossing
  //
  // For the normal case: if pitReload=0, hold. Otherwise:
  //   newCounter = __1pitCounter - decrement
  //   if newCounter <= 0: newCounter + pitReload (reload)
  //   else: newCounter
  // This handles one firing per retirement. Multiple firings per retirement
  // (counter < -reload) would need modular arithmetic, but with realistic
  // cycle costs (max ~165 for IDIV), floor(165/4)=41 ticks max, and typical
  // reload values are 65536, so this never happens.

  lines.push(`  --pitCounter: if(`);
  // OUT imm8 port 0x43 (67): reset
  lines.push(`    style(--opcode: 230) and style(--q1: 67): 0;`);
  // OUT imm8 port 0x40 (64), writeState=1: load from reload
  lines.push(`    style(--opcode: 230) and style(--q1: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);`);
  // OUT DX port 0x43: reset
  lines.push(`    style(--opcode: 238) and style(--__1DX: 67): 0;`);
  // OUT DX port 0x40, writeState=1: load from reload
  lines.push(`    style(--opcode: 238) and style(--__1DX: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);`);
  // Normal: no reload set → hold at 0
  lines.push(`    style(--__1pitReload: 0): 0;`);
  // Normal: counter - decrement, reload on zero crossing
  // Use max to detect zero crossing: if (__1pitCounter - decrement) <= 0 → reload
  lines.push(`  else: calc(var(--__1pitCounter) - var(--_pitDecrement) + max(0, sign(calc(var(--_pitDecrement) - var(--__1pitCounter) + 1))) * var(--__1pitReload)));`);

  // pitReload update: set by OUT to port 0x40 (lo/hi sequencing)
  lines.push(`  --pitReload: if(`);
  // OUT imm8 port 0x43: reset reload
  lines.push(`    style(--opcode: 230) and style(--q1: 67): 0;`);
  // OUT imm8 port 0x40, writeState=0: set lo byte
  lines.push(`    style(--opcode: 230) and style(--q1: 64) and style(--__1pitWriteState: 0): calc(--and(var(--__1pitReload), 65280) + ${al});`);
  // OUT imm8 port 0x40, writeState=1: set hi byte
  lines.push(`    style(--opcode: 230) and style(--q1: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);`);
  // OUT DX port 0x43: reset reload
  lines.push(`    style(--opcode: 238) and style(--__1DX: 67): 0;`);
  // OUT DX port 0x40, writeState=0: set lo byte
  lines.push(`    style(--opcode: 238) and style(--__1DX: 64) and style(--__1pitWriteState: 0): calc(--and(var(--__1pitReload), 65280) + ${al});`);
  // OUT DX port 0x40, writeState=1: set hi byte
  lines.push(`    style(--opcode: 238) and style(--__1DX: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);`);
  lines.push(`  else: var(--__1pitReload));`);

  // pitMode: set by OUT port 0x43 (bits 3-1 of AL)
  lines.push(`  --pitMode: if(`);
  lines.push(`    style(--opcode: 230) and style(--q1: 67): --lowerBytes(--rightShift(--and(${al}, 14), 1), 3);`);
  lines.push(`    style(--opcode: 238) and style(--__1DX: 67): --lowerBytes(--rightShift(--and(${al}, 14), 1), 3);`);
  lines.push(`  else: var(--__1pitMode));`);

  // pitWriteState: toggled on OUT port 0x40, reset on OUT port 0x43
  lines.push(`  --pitWriteState: if(`);
  lines.push(`    style(--opcode: 230) and style(--q1: 67): 0;`);
  lines.push(`    style(--opcode: 230) and style(--q1: 64): calc(1 - var(--__1pitWriteState));`);
  lines.push(`    style(--opcode: 238) and style(--__1DX: 67): 0;`);
  lines.push(`    style(--opcode: 238) and style(--__1DX: 64): calc(1 - var(--__1pitWriteState));`);
  lines.push(`  else: var(--__1pitWriteState));`);

  return lines.join('\n');
}

/**
 * Emit picPending update that includes PIT IRQ firing.
 * This replaces the default picPending dispatch with one that also
 * ORs bit 0 when the PIT counter crosses zero.
 *
 * Returns the CSS expression for --picPending that should be used instead
 * of the dispatch-generated one.
 */
export function emitPicPendingWithPIT() {
  // The PIT fires IRQ 0 when the counter crosses zero.
  // _pitFired = 1 when __1pitCounter - _pitDecrement <= 0 and __1pitReload > 0
  // We detect this the same way as in pitCounter: sign(decrement - counter + 1) > 0
  //
  // When PIT fires: picPending |= 1 (set bit 0)
  // When OUT 0x20 or 0x21: handled by the existing dispatch entries
  // Otherwise: hold
  //
  // The issue: picPending is already driven by the dispatch table for sentinel
  // opcode 0xF1 (IRQ acknowledge clears pending). We need to merge the PIT
  // firing into the dispatch output.
  //
  // Solution: emit picPending as a standalone property that wraps the dispatch
  // output with the PIT firing.
  //
  // Actually, the cleanest approach: just return the _pitFired expression and
  // let emit-css.mjs handle the wiring.
  return null; // Handled by emit-css.mjs
}
