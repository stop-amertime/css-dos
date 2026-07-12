// Chipset emitters: the support chips around the CPU and their I/O ports.
// Emitted into the .motherboard rule (PIT derivation, keyboard wires, IRQ
// arbitration) and into the IN/OUT opcode dispatches (emitIO). Split out
// of misc.mjs 2026-07-12 so the source mirrors the emitted CHIPSET file
// section (see emit-css.mjs).

import { DAC_LINEAR } from '../memory.mjs';

/**
 * Peripheral helper computed properties emitted into the .motherboard
 * (chipset) rule.
 *
 * These aren't dispatched — they're derived each tick from the new
 * --cycleCount (which the instruction's cycle-count entry has already
 * set for this tick) and the __1 versions of the PIT state vars.
 *
 * --_pitTicks: PIT input pulses consumed this retirement.
 *   The 8086 runs at ~4.77 MHz, the PIT at ~1.193 MHz — a 4:1 ratio.
 *   So each increment of cycleCount/4 is one PIT tick.
 * --_pitDecrement: how much to subtract from the counter. Mode 3
 *   (square wave) decrements by 2 per PIT tick; other modes by 1.
 * --_pitFired: 1 iff the counter would cross zero this tick and the
 *   PIT is armed (pitReload != 0). Used to raise IRQ 0 on picPending.
 *   Computed via sign(decrement - counter + 1): positive when the
 *   decrement is at least counter (i.e. counter reaches 0 or below),
 *   clamped to [0, 1].
 */
export function emitPitDerivation() {
  const pitTicks = `calc(round(down, var(--cycleCount) / 4) - round(down, var(--__1cycleCount) / 4))`;
  const pitDecrement = `if(style(--__1pitMode: 3): calc(var(--_pitTicks) * 2); else: var(--_pitTicks))`;
  const pitFired = `if(style(--__1pitReload: 0): 0; else: min(1, max(0, sign(calc(var(--_pitDecrement) - var(--__1pitCounter) + 1)))))`;
  return [
    `  /* PIT ticks elapsed this instruction, derived from --cycleCount (4.77 MHz / 4) */`,
    `  --_pitTicks: ${pitTicks};`,
    `  --_pitDecrement: ${pitDecrement};`,
    `  --_pitFired: ${pitFired};`,
  ].join('\n');
}

/**
 * Expression for --pitCounter's per-tick countdown: decrement by
 * --_pitDecrement, reload from --__1pitReload on zero crossing. Holds
 * at 0 while idle (pitReload == 0). Used both as the register-level
 * default (opcodes with no PIT dispatch entry) and as the `else:` of
 * the port-write entries (OUT to a non-PIT port must still tick).
 */
export function pitCounterDefaultExpr() {
  return `if(
    style(--__1pitReload: 0): 0;
    else: calc(
      var(--__1pitCounter) - var(--_pitDecrement)
      + max(0, sign(calc(var(--_pitDecrement) - var(--__1pitCounter) + 1))) * var(--__1pitReload)
    )
  )`;
}

/**
 * Default expression for --picPending. ORs in bit 0 when the PIT crosses
 * zero (_pitFired) and bit 1 on a keyboard press edge (_kbdEdge).
 *
 * The IRQ-acknowledge branch (clearing --_irqBit) is applied via the
 * register-level IRQ_OVERRIDES in emit-css.mjs, not here — the override
 * takes priority over this default when --_irqActive fires.
 */
export function picPendingDefaultExpr() {
  return `--or(
    --or(var(--__1picPending), var(--_pitFired)),
    calc(var(--_kbdEdge) * 2)
  )`;
}

/**
 * Compute properties for IRQ delivery. Emitted as standalone lines in
 * the .motherboard (chipset) rule — not dispatch-routed.
 *
 *   --_kbdPress:    1 iff --keyboard went 0 → non-zero this tick (make code).
 *   --_kbdRelease:  1 iff --keyboard went non-zero → 0 this tick (break code).
 *   --_kbdEdge:     --_kbdPress | --_kbdRelease — either raises IRQ 1.
 *   --_kbdPort60:   what port 0x60 IN returns on this tick. Normally the
 *                   current scancode (high byte of --keyboard). On a release
 *                   tick, the previous scancode with bit 7 set (break code).
 *   --_picEffective: pending-and-unmasked IRQs, masked to 0 when another
 *                    IRQ is already in service (prevents nesting).
 *   --_ifFlag:      interrupt-enable flag (bit 9 of FLAGS).
 *   --_irqActive:   1 iff an IRQ should fire at this instruction boundary.
 *   --_irq0Pending: 1 iff IRQ 0 (PIT) is the effective pending IRQ.
 *                   IRQ 0 has priority over IRQ 1 on real PICs.
 *   --picVector:    INT vector for the acknowledged IRQ (8 or 9 for now).
 *   --_irqBit:      bitmask (1 or 2) of the IRQ being acknowledged.
 *
 * Phase 3 only handles IRQ 0 (timer) and IRQ 1 (keyboard) — the only ones
 * Doom8088 cares about. Adding more IRQs would generalize --picVector
 * and --_irqBit through a lowestBit helper like v3's irq.mjs did.
 *
 * Break-scancode synthesis (#27): Doom8088 tracks held keys via the high bit
 * of scancodes read from port 0x60. On a release tick we fire IRQ 1 and port
 * 0x60 must return the *previous* scancode with bit 7 set.
 */
export function emitKeyboardWires() {
  const kbdPress = `if(
    style(--keyboard: 0): 0;
    style(--__1prevKeyboard: 0): 1;
    else: 0
  )`;
  // Raw wire transition back to 0. While the hold wire (--kbdHold) is 1
  // it is LATCHED, not delivered: the scancode joins the held set and no
  // break code reaches the guest — the key stays down (chords). While
  // the hold wire is 0 it is a normal delivered release.
  const kbdRawRelease = `if(
    style(--__1prevKeyboard: 0): 0;
    style(--keyboard: 0): 1;
    else: 0
  )`;
  const kbdRelease = `if(
    style(--_kbdRawRelease: 0): 0;
    style(--kbdHold: 1): 0;
    else: 1
  )`;
  const kbdLatch = `if(
    style(--_kbdRawRelease: 0): 0;
    style(--kbdHold: 1): 1;
    else: 0
  )`;
  // Held-set slot flags. Append (on a latch tick) into the lowest empty
  // slot; drain (one per drain tick) from the highest occupied slot.
  // Duplicates are allowed (re-pressing a held key latches it twice; the
  // extra break on drain is harmless) — they just spend slots.
  const SLOTS = 8;
  const appFlags = [];
  const popFlags = [];
  for (let i = 0; i < SLOTS; i++) {
    const lowerFull = Array.from({ length: i }, (_, j) =>
      `    style(--__1kbdHeld${j}: 0): 0;`).join('\n');
    appFlags.push(`  --_kbdApp${i}: if(
    style(--_kbdLatch: 0): 0;
${lowerFull ? lowerFull + '\n' : ''}    style(--__1kbdHeld${i}: 0): 1;
    else: 0
  );`);
    const top = i < SLOTS - 1
      ? `    style(--__1kbdHeld${i + 1}: 0): 1;\n    else: 0`
      : `    else: 1`;
    popFlags.push(`  --_kbdPop${i}: if(
    style(--_kbdDrain: 0): 0;
    style(--__1kbdHeld${i}: 0): 0;
${top}
  );`);
  }
  const anyHeld = `--or(--or(--or(var(--__1kbdHeld0), var(--__1kbdHeld1)), --or(var(--__1kbdHeld2), var(--__1kbdHeld3))), --or(--or(var(--__1kbdHeld4), var(--__1kbdHeld5)), --or(var(--__1kbdHeld6), var(--__1kbdHeld7))))`;
  // Drain: with the hold wire down and held slots occupied, emit one
  // synthesized break code per eligible tick. Eligible = no real key
  // edge this tick (real events own port 0x60) and the previous
  // keyboard IRQ fully consumed (pending bit clear, nothing in
  // service) — this self-paces the drain to the guest ISR's speed so
  // no break code is overwritten before it is read.
  const kbdDrain = `if(
    style(--kbdHold: 1): 0;
    style(--_kbdAnyHeld: 0): 0;
    style(--_kbdPress: 1): 0;
    style(--_kbdRawRelease: 1): 0;
    style(--_kbdPicKbdBit: 1): 0;
    style(--__1picInService: 0): 1;
    else: 0
  )`;
  const popSc = Array.from({ length: SLOTS }, (_, i) =>
    `var(--__1kbdHeld${i}) * var(--_kbdPop${i})`).join(' + ');
  // Port 0x60 returns the most recent scancode (make or break) until the
  // next event. On the event tick itself, we compute the new value
  // directly; off-event ticks fall through to --__1kbdScancodeLatch,
  // which the register-dispatch default updates with the same logic so
  // the latch and the live port read agree. Without the latch the break
  // code is only readable on the single event tick — if the ISR runs
  // even one tick later (CLI clear gap, nested IRQ pending, etc.) it
  // reads scancode 0 and DOOM's key-held state never clears.
  const kbdPort60 = `if(
    style(--_kbdPress: 1): --rightShift(var(--keyboard), 8);
    style(--_kbdRelease: 1): --or(--rightShift(var(--__1prevKeyboard), 8), 128);
    style(--_kbdDrain: 1): calc(var(--_kbdPopSc) + 128);
    else: var(--__1kbdScancodeLatch)
  )`;
  return [
    `  /* press/release edge wires, the hold-wire held set, and port 0x60's latch input */`,
    `  --_kbdPress: ${kbdPress};`,
    `  --_kbdRawRelease: ${kbdRawRelease};`,
    `  --_kbdRelease: ${kbdRelease};`,
    `  --_kbdLatch: ${kbdLatch};`,
    `  --_kbdLatchSc: --rightShift(var(--__1prevKeyboard), 8);`,
    ...appFlags,
    `  --_kbdAnyHeld: ${anyHeld};`,
    `  --_kbdPicKbdBit: --bit(var(--__1picPending), 1);`,
    `  --_kbdDrain: ${kbdDrain};`,
    ...popFlags,
    `  --_kbdPopSc: calc(${popSc});`,
    `  --_kbdEdge: --or(--or(var(--_kbdPress), var(--_kbdRelease)), var(--_kbdDrain));`,
    `  --_kbdPort60: ${kbdPort60};`,
  ].join('\n');
}

/**
 * PIC arbitration: which IRQ (if any) fires this tick. Consumed by the
 * CPU rule's register overrides (see DispatchTable.emitRegisterDispatch)
 * — when --_irqActive is 1 the fetched instruction is refused and the
 * FLAGS/CS/IP frame is pushed instead.
 */
export function emitIRQArbitration() {
  const picEffective = `if(
    style(--__1picInService: 0): --and(var(--__1picPending), --not(var(--__1picMask)));
    else: 0
  )`;
  return [
    `  /* which unmasked pending IRQ wins this tick (IRQ 0 outranks IRQ 1) */`,
    `  --_picEffective: ${picEffective};`,
    `  --_ifFlag: --bit(var(--__1flags), 9);`,
    `  --_irqActive: if(style(--_ifFlag: 0): 0; style(--_picEffective: 0): 0; else: 1);`,
    `  --_irq0Pending: --and(var(--_picEffective), 1);`,
    `  --picVector: if(style(--_irq0Pending: 1): 8; else: 9);`,
    `  --_irqBit: if(style(--_irq0Pending: 1): 1; else: 2);`,
  ].join('\n');
}

/**
 * I/O port instructions: IN and OUT.
 *
 * Reads:
 *   Port 0x21 (PIC data) returns --picMask. Programs that do the standard
 *     read-modify-write (in al,0x21; and al,~bit; out 0x21,al) rely on this.
 *   Port 0x60 (keyboard) returns the scancode (high byte of --keyboard).
 *   Port 0x3DA (VGA input status 1) returns a byte whose bit 3 is the
 *     vertical retrace signal and bit 0 is display-enable (not in vsync).
 *     Both are derived from --cycleCount on a 70 Hz / 4.77 MHz timebase.
 *   All other ports return 0.
 *
 * Writes (state lives in --picMask/--picInService/--pitMode/--pitReload/
 * --pitCounter/--pitWriteState — declared in template.mjs STATE_VARS):
 *   Port 0x20 (PIC command): EOI clears the lowest-priority in-service bit.
 *     Phase 1 treats any write as a non-specific EOI (Doom8088 only sends
 *     0x20, which is the correct encoding).
 *   Port 0x21 (PIC data):    writes AL to --picMask.
 *   Port 0x40 (PIT ch0 data): lo/hi sequenced write to --pitReload; the
 *     hi-byte write also loads --pitCounter.
 *   Port 0x43 (PIT control): when the control word selects channel 0 with
 *     a write access-mode (bits 7-6 == 00, bits 5-4 != 00), sets --pitMode
 *     from bits 3-1 of AL and resets reload/counter/writeState. Control
 *     words for ch1/ch2 and ch0 counter-latch commands hold all state —
 *     we only track channel 0, and a ch2 speaker write must not stop it.
 *
 * Unhandled ports (speaker 0x61, CRTC 0x3D4/0x3D5, secondary PIC 0xA0/0xA1,
 * PIT ch1/ch2 0x41/0x42) remain no-ops. DAC ports 0x3C7/0x3C8/0x3C9 are
 * handled separately below (see VGA DAC block).
 *
 * Dispatch entries on OUT opcodes fall back to var(--__1NAME) when the port
 * doesn't match — the entry fires on every OUT of this opcode shape, so it
 * must explicitly hold the state for unrelated ports.
 *
 * Opcode shapes:
 *   IN AL, imm8  (0xE4): 2-byte, port in q1.
 *   IN AX, imm8  (0xE5): 2-byte, port in q1.
 *   OUT imm8, AL (0xE6): 2-byte, port in q1.
 *   OUT imm8, AX (0xE7): 2-byte, port in q1, AX written (no PIC/PIT effect).
 *   IN AL, DX   (0xEC): 1-byte, port in --__1DX.
 *   IN AX, DX   (0xED): 1-byte, port in --__1DX.
 *   OUT DX, AL  (0xEE): 1-byte, port in --__1DX.
 *   OUT DX, AX  (0xEF): 1-byte, port in --__1DX, no PIC/PIT effect.
 *
 * The imm8 forms can only encode ports 0x00-0xFF, so the VGA ports
 * (0x3C7-0x3C9 DAC, 0x3D9 CGA palette, 0x3DA status) are handled ONLY on
 * the DX forms — a `style(--q1: 969)`-style arm could never match the
 * byte-valued --q1 and would be dead weight in every dispatch.
 */
export function emitIO(dispatch) {
  // --- VGA input status 1 (port 0x3DA = 986) ---
  //
  // Bit 3: vertical retrace (1 while beam is retracing top, 0 while drawing).
  // Bit 0: display enable — here, "not in vertical retrace". Real hardware
  //        also sets this during horizontal blanking, but that's per-scanline
  //        timing we don't simulate. Close enough for the common
  //        `in al,0x3DA; test al,8; jnz retrace_wait` pattern.
  // Other bits: 0.
  //
  // Cadence derived from cycleCount:
  //   CYCLES_PER_FRAME = 68182  (4.77 MHz / 70 Hz)
  //   RETRACE_CYCLES   = 3409   (~5% of frame — the vsync window)
  //   in_retrace = mod(cc, CYCLES_PER_FRAME) < RETRACE_CYCLES
  //
  // Expressed without comparison operators: `sign(retrace - mod(cc, frame))`
  // is +1 when in retrace, -1 when drawing, 0 exactly at the boundary.
  // `max(0, sign(...))` clamps to {0, 1}. The 1-cycle boundary glitch (both
  // bits 0 at `mod == RETRACE`) is harmless.
  //
  // Independent of vsyncMode — the program always sees the same port
  // behaviour. The player's paint cadence layers on top of this; it does
  // not change what the CPU observes when it reads 0x3DA.
  const VSYNC_RETRACE_BIT3 =
    `calc(max(0, sign(calc(3409 - mod(var(--__1cycleCount), 68182)))) * 8)`;
  const VSYNC_DISPENA_BIT0 =
    `max(0, sign(calc(mod(var(--__1cycleCount), 68182) - 3409)))`;
  const VGA_STATUS1 = `calc(${VSYNC_RETRACE_BIT3} + ${VSYNC_DISPENA_BIT0})`;

  // DAC palette storage — 768 bytes at DAC_LINEAR (imported from
  // memory.mjs; outside the 1 MB address space, accessed via
  // --readMem/addMemWrite). See the OUT 0x3C8/0x3C9 block further down
  // for the full protocol.

  // --- Reads ---

  // IN AL, imm8 (0xE4):
  //   port 0x21 → picMask (so programs can read-modify-write the mask)
  //   port 0x60 → scancode = rightShift(keyboard, 8)
  //   other     → 0 (VGA ports are unreachable via imm8 — see above)
  // DAC read byte: mem[DAC_LINEAR + dacReadIndex*3 + dacReadSubIndex].
  // CSS evaluates it lazily inside the if() so DX values other than
  // 0x3C9 never trigger the memory read.
  const dacReadByte = `--readMem(calc(${DAC_LINEAR} + var(--__1dacReadIndex) * 3 + var(--__1dacReadSubIndex)))`;

  dispatch.addEntry('AX', 0xE4,
    `--mergelow(var(--__1AX), if(style(--q1: 33): var(--__1picMask); style(--q1: 96): var(--_kbdPort60); else: 0))`,
    `IN AL, imm8 (0x21=picMask, 0x60=kbdPort60)`);
  dispatch.addEntry('IP', 0xE4, `calc(var(--__1IP) + 2)`, `IN AL, imm8`);

  // IN AX, imm8 (0xE5):
  //   port 0x21 → picMask
  //   port 0x60 → full keyboard word
  dispatch.addEntry('AX', 0xE5,
    `if(style(--q1: 33): var(--__1picMask); style(--q1: 96): var(--__1keyboard); else: 0)`,
    `IN AX, imm8 (0x21=picMask, 0x60=keyboard)`);
  dispatch.addEntry('IP', 0xE5, `calc(var(--__1IP) + 2)`, `IN AX, imm8`);

  // IN AL, DX (0xEC):
  //   DX=0x21  → picMask
  //   DX=0x60  → scancode
  //   DX=0x3DA → VGA input status 1
  //   DX=0x3C7 → 0 (DAC state byte: 0=write-ready, 3=read-ready; we don't
  //              distinguish — returning 0 keeps games happy)
  //   DX=0x3C8 → current write index
  //   DX=0x3C9 → DAC byte at [readIndex*3 + readSubIndex]
  dispatch.addEntry('AX', 0xEC,
    `--mergelow(var(--__1AX), if(style(--__1DX: 33): var(--__1picMask); style(--__1DX: 96): var(--_kbdPort60); style(--__1DX: 986): ${VGA_STATUS1}; style(--__1DX: 967): 0; style(--__1DX: 968): var(--__1dacWriteIndex); style(--__1DX: 969): ${dacReadByte}; else: 0))`,
    `IN AL, DX (0x21=picMask, 0x60=kbdPort60, 0x3DA=vgaStatus1, 0x3C7/8/9=DAC)`);
  dispatch.addEntry('IP', 0xEC, `calc(var(--__1IP) + 1)`, `IN AL, DX`);

  // IN AX, DX (0xED):
  //   DX=0x21  → picMask
  //   DX=0x60  → full keyboard word
  //   DX=0x3DA → VGA input status 1
  //   DX=0x3C7 → 0; DX=0x3C8 → write index; DX=0x3C9 → DAC byte (low)
  dispatch.addEntry('AX', 0xED,
    `if(style(--__1DX: 33): var(--__1picMask); style(--__1DX: 96): var(--__1keyboard); style(--__1DX: 986): ${VGA_STATUS1}; style(--__1DX: 967): 0; style(--__1DX: 968): var(--__1dacWriteIndex); style(--__1DX: 969): ${dacReadByte}; else: 0)`,
    `IN AX, DX (0x21=picMask, 0x60=keyboard, 0x3DA=vgaStatus1, 0x3C7/8/9=DAC)`);
  dispatch.addEntry('IP', 0xED, `calc(var(--__1IP) + 1)`, `IN AX, DX`);

  // --- Writes ---

  dispatch.addEntry('IP', 0xE6, `calc(var(--__1IP) + 2)`, `OUT imm8, AL`);
  dispatch.addEntry('IP', 0xE7, `calc(var(--__1IP) + 2)`, `OUT imm8, AX`);
  dispatch.addEntry('IP', 0xEE, `calc(var(--__1IP) + 1)`, `OUT DX, AL`);
  dispatch.addEntry('IP', 0xEF, `calc(var(--__1IP) + 1)`, `OUT DX, AX`);

  // AL, inline (can't use --AL alias in the state-var expressions below
  // because we read it across many different --__1AX values — the alias
  // would need to be re-derived per tick anyway and the cost is identical).
  const al = `--lowerBytes(var(--__1AX), 8)`;

  // Non-specific EOI on OUT 0x20 (any value). Clear the lowest-priority
  // in-service bit using the (x & (x-1)) bit-clear-lowest trick. When
  // picInService=0 this yields 0 (no effect), which is correct.
  const picEoiExpr = `--and(var(--__1picInService), calc(var(--__1picInService) - 1))`;

  // picInService: OUT to 0x20 → EOI. Other ports → hold.
  dispatch.addEntry('picInService', 0xE6,
    `if(style(--q1: 32): ${picEoiExpr}; else: var(--__1picInService))`,
    `OUT 0x20: non-specific EOI`);
  dispatch.addEntry('picInService', 0xEE,
    `if(style(--__1DX: 32): ${picEoiExpr}; else: var(--__1picInService))`,
    `OUT DX=0x20: non-specific EOI`);

  // picMask: OUT to 0x21 → AL becomes the new mask. Other ports → hold.
  dispatch.addEntry('picMask', 0xE6,
    `if(style(--q1: 33): ${al}; else: var(--__1picMask))`,
    `OUT 0x21: set PIC mask`);
  dispatch.addEntry('picMask', 0xEE,
    `if(style(--__1DX: 33): ${al}; else: var(--__1picMask))`,
    `OUT DX=0x21: set PIC mask`);

  // OUT 0x43 (PIT control word) — channel decode. Only a control word
  // that (a) selects channel 0 (bits 7-6 == 00) AND (b) has a non-latch
  // access mode (bits 5-4 != 00; 00 is "counter latch", which snapshots
  // the count for reading without disturbing it) may touch our channel-0
  // state. Control words for ch1/ch2 must hold everything: PC-speaker
  // effects send 0xB6 (ch2, mode 3) while the program's whole timebase
  // is ch0 IRQ 0s — zeroing ch0's reload on that write kills the timer
  // interrupt and wedges any wait-for-INT8-counter loop (PoP's landing
  // thud froze the game this way, 2026-07-05).
  // pitCh0Write is 1 for a ch0 write config, else 0 — used as an
  // arithmetic gate since style() can't test AL's bit fields.
  const pitCh0Write = `(max(0, 1 - --rightShift(${al}, 6)) * min(1, --and(${al}, 48)))`;

  // pitMode: OUT to 0x43 with ch0-write → bits 3-1 of AL; else hold.
  const pitModeExpr = `--lowerBytes(--rightShift(--and(${al}, 14), 1), 3)`;
  const pitModeGated =
    `calc(var(--__1pitMode) + (${pitModeExpr} - var(--__1pitMode)) * ${pitCh0Write})`;
  dispatch.addEntry('pitMode', 0xE6,
    `if(style(--q1: 67): ${pitModeGated}; else: var(--__1pitMode))`,
    `OUT 0x43: PIT control word`);
  dispatch.addEntry('pitMode', 0xEE,
    `if(style(--__1DX: 67): ${pitModeGated}; else: var(--__1pitMode))`,
    `OUT DX=0x43: PIT control word`);

  // pitWriteState: toggled by OUT 0x40, reset by OUT 0x43 (ch0 write config
  // only). Hold otherwise.
  const pitWriteStateGated = `calc(var(--__1pitWriteState) * (1 - ${pitCh0Write}))`;
  dispatch.addEntry('pitWriteState', 0xE6,
    `if(style(--q1: 67): ${pitWriteStateGated}; style(--q1: 64): calc(1 - var(--__1pitWriteState)); else: var(--__1pitWriteState))`,
    `OUT 0x43/0x40: PIT writeState`);
  dispatch.addEntry('pitWriteState', 0xEE,
    `if(style(--__1DX: 67): ${pitWriteStateGated}; style(--__1DX: 64): calc(1 - var(--__1pitWriteState)); else: var(--__1pitWriteState))`,
    `OUT DX=0x43/0x40: PIT writeState`);

  // pitReload: OUT 0x43 (ch0 write config) resets to 0. OUT 0x40 with
  // writeState=0 sets lo byte, writeState=1 sets hi byte. Hold otherwise.
  const pitReloadGated = `calc(var(--__1pitReload) * (1 - ${pitCh0Write}))`;
  const pitReloadImm = `if(
    style(--q1: 67): ${pitReloadGated};
    style(--q1: 64) and style(--__1pitWriteState: 0): calc(--and(var(--__1pitReload), 65280) + ${al});
    style(--q1: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);
    else: var(--__1pitReload)
  )`;
  const pitReloadDx = `if(
    style(--__1DX: 67): ${pitReloadGated};
    style(--__1DX: 64) and style(--__1pitWriteState: 0): calc(--and(var(--__1pitReload), 65280) + ${al});
    style(--__1DX: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);
    else: var(--__1pitReload)
  )`;
  dispatch.addEntry('pitReload', 0xE6, pitReloadImm, `OUT 0x40/0x43: PIT reload`);
  dispatch.addEntry('pitReload', 0xEE, pitReloadDx, `OUT DX=0x40/0x43: PIT reload`);

  // pitCounter: OUT 0x43 (ch0 write config) resets to 0; other 0x43 words
  // hold the count (pausing the countdown for that one tick — harmless
  // drift, and simpler than threading the countdown through the gate).
  // OUT 0x40 with writeState=1 loads the new full reload into the counter
  // (matches real PIT behavior — the counter starts ticking only after
  // both bytes are written). On OUT to any other port (e.g. 0x20, 0x21),
  // fall through to the normal per-tick countdown — the PIT must keep
  // running while the program is talking to other devices.
  const pitTick = pitCounterDefaultExpr();
  const pitCounterGated = `calc(var(--__1pitCounter) * (1 - ${pitCh0Write}))`;
  const pitCounterImm = `if(
    style(--q1: 67): ${pitCounterGated};
    style(--q1: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);
    else: ${pitTick}
  )`;
  const pitCounterDx = `if(
    style(--__1DX: 67): ${pitCounterGated};
    style(--__1DX: 64) and style(--__1pitWriteState: 1): calc(--and(var(--__1pitReload), 255) + ${al} * 256);
    else: ${pitTick}
  )`;
  dispatch.addEntry('pitCounter', 0xE6, pitCounterImm, `OUT 0x40/0x43: PIT counter load`);
  dispatch.addEntry('pitCounter', 0xEE, pitCounterDx, `OUT DX=0x40/0x43: PIT counter load`);

  // --- VGA DAC (ports 0x3C8 write-index, 0x3C9 data) ---
  //
  // Real-hardware DAC protocol:
  //   OUT 0x3C8, n        set write index to n, reset sub-index to 0
  //   OUT 0x3C9, R        store R at palette[n], sub-index -> 1
  //   OUT 0x3C9, G        store G at palette[n], sub-index -> 2
  //   OUT 0x3C9, B        store B at palette[n], sub-index -> 0, n -> n+1
  // A program typically sets the index once, then writes 3*N bytes in a loop.
  //
  // We shadow the 256*3 = 768 palette bytes to out-of-1MB linear addresses
  // (kiln/memory.mjs DAC_LINEAR). Calcite reads them back when rendering the
  // Mode 13h framebuffer. Values are stored as-is (6-bit 0..63); the frame-
  // buffer renderer does the 6-to-8-bit expansion.
  //
  // Port 0x3C7 (DAC read index) and IN 0x3C9 (read DAC byte) are both wired
  // below. Games that read the palette back — e.g. palette-fade effects
  // that re-derive their target palette from the live DAC, or screensavers
  // that blend between whatever the previous program left and a new
  // palette — use the sequence OUT 0x3C7, n; IN 0x3C9; IN 0x3C9; IN 0x3C9.
  // OUT 0x3C7 mirrors OUT 0x3C8 except it sets the *read* cursor.
  // (DAC_LINEAR is declared above the IN handlers so the dacReadByte
  // helper can reference it — both reads and writes share that address.)

  // OUT DX=0x3C8 — set write index, reset sub-index. All DAC port numbers
  // are above 0xFF, so only the DX forms (0xEE for writes, 0xEC for reads)
  // can reach them; the imm8 opcodes get no DAC entries at all.
  // Written as "967"/"968"/"969" in CSS since style() takes integer literals.
  dispatch.addEntry('dacWriteIndex', 0xEE,
    `if(style(--__1DX: 968): ${al}; style(--__1DX: 969) and style(--__1dacSubIndex: 2): calc(var(--__1dacWriteIndex) + 1); else: var(--__1dacWriteIndex))`,
    `OUT DX=0x3C8: set DAC write index; DX=0x3C9: auto-advance on wrap`);

  // dacSubIndex: OUT 0x3C8 resets to 0. OUT 0x3C9 advances (0→1→2→0).
  // OUT 0x3C7 also resets — programs that transition from reading to
  // writing the DAC (rare, but spec-legal) expect a clean slate.
  dispatch.addEntry('dacSubIndex', 0xEE,
    `if(style(--__1DX: 968): 0; style(--__1DX: 967): 0; style(--__1DX: 969) and style(--__1dacSubIndex: 2): 0; style(--__1DX: 969): calc(var(--__1dacSubIndex) + 1); else: var(--__1dacSubIndex))`,
    `OUT DX=0x3C7/0x3C8/0x3C9: DAC write sub-index state`);

  // Read cursor: OUT 0x3C7 loads AL into dacReadIndex and resets the read
  // sub-index to 0. Three successful IN reads of 0x3C9 advance the sub-
  // index 0→1→2→0 and on the wrap also bump dacReadIndex by 1.
  dispatch.addEntry('dacReadIndex', 0xEE,
    `if(style(--__1DX: 967): ${al}; else: var(--__1dacReadIndex))`,
    `OUT DX=0x3C7: set DAC read index`);
  dispatch.addEntry('dacReadIndex', 0xEC,
    `if(style(--__1DX: 969) and style(--__1dacReadSubIndex: 2): calc(var(--__1dacReadIndex) + 1); else: var(--__1dacReadIndex))`,
    `IN AL, DX=0x3C9: DAC read cursor auto-advance on wrap`);

  // dacReadSubIndex: OUT 0x3C7 resets to 0. IN 0x3C9 advances (0→1→2→0).
  // OUT 0x3C8 also resets (read-to-write transition — spec-legal to reuse
  // the sub-index state).
  dispatch.addEntry('dacReadSubIndex', 0xEE,
    `if(style(--__1DX: 967): 0; style(--__1DX: 968): 0; else: var(--__1dacReadSubIndex))`,
    `OUT DX=0x3C7/0x3C8: reset DAC read sub-index`);
  dispatch.addEntry('dacReadSubIndex', 0xEC,
    `if(style(--__1DX: 969) and style(--__1dacReadSubIndex: 2): 0; style(--__1DX: 969): calc(var(--__1dacReadSubIndex) + 1); else: var(--__1dacReadSubIndex))`,
    `IN AL, DX=0x3C9: advance DAC read sub-index`);

  // OUT DX=0x3C9 — write a byte to DAC_LINEAR + writeIndex*3 + subIndex.
  // The address expression evaluates to -1 (unused-slot sentinel) on any
  // other port, so this slot is a no-op outside DAC writes.
  // Also mask AL to 6 bits (0..63) — real VGA hardware truncates the DAC
  // value to 6 bits; programs that write 0..255 get the low 6 bits.
  const dacAddrDx = `if(style(--__1DX: 969): calc(${DAC_LINEAR} + var(--__1dacWriteIndex) * 3 + var(--__1dacSubIndex)); else: -1)`;
  const dacVal    = `--and(${al}, 63)`;
  dispatch.addMemWrite(0xEE, dacAddrDx, dacVal, `OUT DX=0x3C9: DAC byte (6-bit)`);

  // --- CGA palette mode register (port 0x3D9 = 985) ---
  //
  // OUT 0x3D9, AL sets the CGA palette register. Layout:
  //   bits 3..0: border colour in text modes / colour 0 in 320x200 gfx
  //   bit 4    : intensity (bright vs dark palette)
  //   bit 5    : palette set select
  //                palette 0 → green/red/yellow   (colours 1/2/3)
  //                palette 1 → cyan/magenta/white (colours 1/2/3)
  //   bits 6..7: ignored
  //
  // CSS-DOS doesn't interpret this in CSS — the player-side decoder
  // consumes the raw byte. We shadow it to linear 0x04F3 (BDA intra-app
  // area, just past the requested-video-mode shadow at 0x04F2) so
  // calcite's read_memory_range can surface it to JS. Port 0x3D9 is
  // above 0xFF, so only the DX form can address it.
  const CGA_PALETTE_REG_ADDR = 0x04F3;
  const cgaPalAddrDx = `if(style(--__1DX: 985): ${CGA_PALETTE_REG_ADDR}; else: -1)`;
  dispatch.addMemWrite(0xEE, cgaPalAddrDx, al, `OUT DX=0x3D9: CGA palette mode register`);
}
