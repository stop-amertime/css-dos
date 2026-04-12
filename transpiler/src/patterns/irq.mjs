// IRQ injection: sentinel opcode 0xF1 dispatch for hardware interrupt delivery.
//
// When --irqActive is 1, --opcode is forced to 0xF1 (sentinel). The dispatch
// entries for 0xF1 implement a 6-μop INT sequence identical to software INT
// (0xCD), but the vector comes from the PIC state (--picVector) instead of q1.
//
// The PIC acknowledge happens on μop 0: the highest-priority pending IRQ is
// moved from picPending to picInService. --picVector is derived from the
// in-service register, keeping it stable for the rest of the sequence.
//
// --irqActive is set to 1 by the uOp advance logic (in emit-css.mjs) when:
//   - An instruction retires (uOp would return to 0)
//   - IF flag is set (bit 9 of flags)
//   - PIC has unmasked pending IRQ: (picPending & ~picMask) != 0
//
// --irqActive resets to 0 when the sentinel's μop sequence retires (μop 5→0).

// Compute the highest-priority pending unmasked IRQ number (0-7) from PIC state.
// This is the bit position of the lowest set bit in (pending & ~mask & ~inService).
// We use a priority chain: check bit 0 first, then 1, ..., then 7.
//
// In CSS, we compute the effective pending register and dispatch on its bits.
// --picVector = 8 + irq_number (INT 08h for IRQ 0, INT 09h for IRQ 1, etc.)
//
// Since --picVector is derived from picInService (after acknowledge on μop 0),
// and picInService is stable for μops 1-5, the vector stays constant.

const SENTINEL = 0xF1; // 241 decimal

export function emitIRQSentinel(dispatch) {
  const ssBase = `var(--__1SS) * 16`;

  // --- picVector computation ---
  // This is emitted as a CSS computed property in emit-css.mjs, not via dispatch.
  // See emitPicVectorProperty() below.

  // --- μop 0: SP -= 6, write FLAGS lo, PIC acknowledge ---
  dispatch.addEntry('SP', SENTINEL, `calc(var(--__1SP) - 6)`, `IRQ (SP-=6)`, 0);
  dispatch.addMemWrite(SENTINEL,
    `calc(${ssBase} + var(--__1SP) - 2)`,
    `--lowerBytes(var(--__1flags), 8)`,
    `IRQ push FLAGS lo`, 0);

  // PIC acknowledge: move highest-priority pending→inService.
  // picPending: clear the acknowledged bit
  // picInService: set the acknowledged bit
  // The acknowledged IRQ is the lowest set bit of (pending & ~mask).
  // We precompute --_irqBit as a power of 2 for the acknowledged IRQ.
  dispatch.addEntry('picPending', SENTINEL,
    `--and(var(--__1picPending), --not(var(--_irqBit)))`,
    `IRQ ack: clear pending`, 0);
  dispatch.addEntry('picInService', SENTINEL,
    `--or(var(--__1picInService), var(--_irqBit))`,
    `IRQ ack: set in-service`, 0);

  // μop 1: write FLAGS hi
  dispatch.addMemWrite(SENTINEL,
    `calc(${ssBase} + var(--__1SP) + 5)`,
    `--rightShift(var(--__1flags), 8)`,
    `IRQ push FLAGS hi`, 1);

  // μop 2: write CS lo
  dispatch.addMemWrite(SENTINEL,
    `calc(${ssBase} + var(--__1SP) + 2)`,
    `--lowerBytes(var(--__1CS), 8)`,
    `IRQ push CS lo`, 2);

  // μop 3: write CS hi
  dispatch.addMemWrite(SENTINEL,
    `calc(${ssBase} + var(--__1SP) + 3)`,
    `--rightShift(var(--__1CS), 8)`,
    `IRQ push CS hi`, 3);

  // μop 4: write retIP lo (return address = current IP, no instruction to skip)
  dispatch.addMemWrite(SENTINEL,
    `calc(${ssBase} + var(--__1SP))`,
    `--lowerBytes(var(--__1IP), 8)`,
    `IRQ push IP lo`, 4);

  // μop 5: write retIP hi, load CS:IP from IVT via --picVector, clear IF+TF, retire
  dispatch.addMemWrite(SENTINEL,
    `calc(${ssBase} + var(--__1SP) + 1)`,
    `--rightShift(var(--__1IP), 8)`,
    `IRQ push IP hi`, 5);
  dispatch.addEntry('IP', SENTINEL,
    `--read2(calc(var(--picVector) * 4))`,
    `IRQ load IP from IVT`, 5);
  dispatch.addEntry('CS', SENTINEL,
    `--read2(calc(var(--picVector) * 4 + 2))`,
    `IRQ load CS from IVT`, 5);
  dispatch.addEntry('flags', SENTINEL,
    `--and(var(--__1flags), 64767)`,
    `IRQ clear IF+TF`, 5);

  // irqActive resets to 0 on retirement (handled by uOp advance logic)

  // cycleCount: hardware interrupt takes 61 clocks (from js8086.js)
  dispatch.addEntry('cycleCount', SENTINEL,
    `calc(var(--__1cycleCount) + 61)`,
    `IRQ clocks`, 5);
}

/**
 * Emit computed properties for PIC/IRQ state in the .cpu rule.
 *
 * --_irqEffective: pending & ~mask (unmasked pending IRQs, 8-bit)
 * --_irqNum: bit position of highest-priority pending IRQ (0-7, or -1)
 * --_irqBit: 2^_irqNum (bitmask for the acknowledged IRQ)
 * --picVector: interrupt vector number (8 + _irqNum)
 * --_ifFlag: 1 if IF (bit 9 of flags) is set, 0 otherwise
 * --_irqReady: 1 if an IRQ should fire at the next instruction boundary
 */
export function emitPicVectorProperties() {
  return [
    // _irqEffective: unmasked pending IRQs (for trigger decision + acknowledge)
    `  --_irqEffective: --and(var(--__1picPending), --not(var(--__1picMask)));`,
    // _irqNum: lowest set bit of _irqEffective (for acknowledge — which bit to move)
    `  --_irqNum: --lowestBit(var(--_irqEffective));`,
    // _irqBit: bitmask for the IRQ being acknowledged
    `  --_irqBit: --pow2(var(--_irqNum));`,
    // picVector: derived from in-service register (stable after acknowledge).
    // During the sentinel sequence, picInService has the acknowledged bit set.
    // lowestBit(picInService) gives the IRQ number being serviced.
    `  --picVector: calc(8 + --lowestBit(var(--__1picInService)));`,
    // _ifFlag: interrupt enable flag
    `  --_ifFlag: --bit(var(--__1flags), 9);`,
  ].join('\n');
}

/**
 * Emit @functions for IRQ bit manipulation.
 * --lowestBit(val): returns the bit position (0-7) of the lowest set bit, or -1 if 0.
 * --pow2() is already defined in css-lib.mjs (0..31 range) — we reuse it.
 */
export function emitIRQFunctions() {
  // lowestBit uses 8 locals which exceeds Chrome's 7-local limit,
  // but Calcite handles it fine. Chrome isn't the execution target for
  // programs complex enough to need hardware interrupts.
  return `
/* Lowest set bit position (0-7) of an 8-bit value, or -1 if zero. */
@function --lowestBit(--val <integer>) returns <integer> {
  --b0: mod(var(--val), 2);
  --b1: mod(--rightShift(var(--val), 1), 2);
  --b2: mod(--rightShift(var(--val), 2), 2);
  --b3: mod(--rightShift(var(--val), 3), 2);
  --b4: mod(--rightShift(var(--val), 4), 2);
  --b5: mod(--rightShift(var(--val), 5), 2);
  --b6: mod(--rightShift(var(--val), 6), 2);
  --b7: mod(--rightShift(var(--val), 7), 2);
  result: if(
    style(--b0: 1): 0;
    style(--b1: 1): 1;
    style(--b2: 1): 2;
    style(--b3: 1): 3;
    style(--b4: 1): 4;
    style(--b5: 1): 5;
    style(--b6: 1): 6;
    style(--b7: 1): 7;
  else: -1);
}`;
}
