// Execution engine: clock, double-buffer, store/execute keyframes, HTML wrapper.
// The 14 CPU registers, in the order used by the 8086.
// Each has: name, initial value
export const REGISTERS = [
  { name: 'AX', init: 0 },
  { name: 'CX', init: 0 },
  { name: 'DX', init: 0 },
  { name: 'BX', init: 0 },
  { name: 'SP', init: 0 }, // set dynamically based on memSize
  { name: 'BP', init: 0 },
  { name: 'SI', init: 0 },
  { name: 'DI', init: 0 },
  { name: 'CS', init: 0 },
  { name: 'DS', init: 0 },
  { name: 'ES', init: 0 },
  { name: 'SS', init: 0 },
  { name: 'IP', init: 0x100 }, // .COM entry point
  { name: 'flags', init: 0x0002 }, // bit 1 always set on 8086
];

// Extra state variables that participate in the double-buffer cycle
export const STATE_VARS = [
  { name: 'halt', init: 0 },
  { name: 'cycleCount', init: 0 },
  { name: '_tfPending', init: 0 },

  // PIC (i8259) state — see kiln/patterns/misc.mjs emitIO().
  // picMask: IMR. Bit set = IRQ masked. Init 0xFF (all masked) matches real
  // BIOS POST before the OS unmasks IRQ 0/1.
  // picPending: IRR. Bit set = IRQ requested, not yet acknowledged.
  // picInService: ISR. Bit set = IRQ currently being serviced (cleared by EOI).
  { name: 'picMask', init: 0xFF },
  { name: 'picPending', init: 0 },
  { name: 'picInService', init: 0 },

  // PIT (i8253) channel 0 state — see kiln/patterns/misc.mjs emitIO().
  // pitMode: counting mode (0..5 from control word bits 3-1).
  // pitReload: 16-bit reload latch, loaded by OUT 0x40 lo/hi sequence.
  // pitCounter: running countdown; reloads from pitReload on zero crossing.
  // pitWriteState: lo/hi toggle for OUT 0x40 (0 = lo byte next, 1 = hi byte next).
  { name: 'pitMode', init: 0 },
  { name: 'pitReload', init: 0 },
  { name: 'pitCounter', init: 0 },
  { name: 'pitWriteState', init: 0 },

  // Previous-tick snapshot of --keyboard, used to detect press edges for IRQ 1.
  // --keyboard is driven externally by :active button rules; its double-buffered
  // snapshot lets us compare this tick's value against last tick's.
  { name: 'prevKeyboard', init: 0 },

  // Keyboard scancode latch. Holds the most recent scancode (make code on
  // press, break code on release) until the next edge. Backs port 0x60
  // reads on non-edge ticks so the cabinet's IRQ-09h ISR can still read
  // a meaningful scancode N ticks after the edge fired (otherwise port
  // 0x60 returns 0 outside the single edge tick and DOOM's key-held
  // tracking never sees release events).
  { name: 'kbdScancodeLatch', init: 0 },

  // Hold-wire held set — scancodes whose release was latched while
  // --kbdHold was 1 (0 = empty slot). Filled lowest-slot-first; drained
  // highest-slot-first as synthesized break codes once --kbdHold drops.
  // Tapping a held key again while the wire is up delivers its break and
  // clears its slot(s) — per-key un-hold, holes are fine. 8 slots;
  // presses beyond that still deliver their make code but the break is
  // lost (stuck key until re-press) — see emitKeyboardWires.
  { name: 'kbdHeld0', init: 0 },
  { name: 'kbdHeld1', init: 0 },
  { name: 'kbdHeld2', init: 0 },
  { name: 'kbdHeld3', init: 0 },
  { name: 'kbdHeld4', init: 0 },
  { name: 'kbdHeld5', init: 0 },
  { name: 'kbdHeld6', init: 0 },
  { name: 'kbdHeld7', init: 0 },

  // VGA DAC state — see patterns/misc.mjs emitIO().
  // dacWriteIndex: which of the 256 DAC registers is currently being written
  //   (set by OUT 0x3C8; auto-increments after every 3 writes to 0x3C9).
  // dacSubIndex: 0/1/2 counter for R/G/B within a single DAC register.
  //   Advances on each OUT 0x3C9; wraps to 0 and bumps dacWriteIndex on 3.
  { name: 'dacWriteIndex', init: 0 },
  { name: 'dacSubIndex',   init: 0 },
  // Read side of the DAC. Written by OUT 0x3C7; every three IN 0x3C9 reads
  // bump dacReadIndex by 1 (wrapping the sub-index). Read and write paths
  // keep separate sub-indices so a program that interleaves the two (rare)
  // doesn't corrupt either cursor.
  { name: 'dacReadIndex',    init: 0 },
  { name: 'dacReadSubIndex', init: 0 },

  // Sticky latch: set to the offending opcode byte the first time the CPU
  // hits an instruction with no dispatch entry (unknownOp=1). Once set, never
  // clears — the host (player / CLI) surfaces it as a diagnostic. 0 means
  // no unknown opcode seen yet.
  { name: 'haltCode', init: 0 },
];

// Serial-mouse state (8250 UART @ COM1 + Microsoft-protocol packet
// generator) — only included when the cart opts in via `input.mouse`.
// See kiln/patterns/misc.mjs emitMouseWires() for the machine.
//
// msCurX/msCurY: our estimate of where the guest driver's integrated
//   cursor sits (Windows-style: deltas accumulated, clamped to the
//   640×200 CGA screen). Init = the guest's power-on cursor (centre).
// msSentBtn: last button state reported in a packet.
// msTgtLatch: latched target cell value ((x<<8|y)+1; 0 = never touched).
// msDxL/msDyL: the packet-in-flight's dx/dy as mod-256 bytes, captured
//   at packet start so bytes 2/3 match byte 1.
// uartIer/uartMcr: 8250 interrupt-enable and modem-control latches.
// uartRbr/uartDr: receive byte + data-ready bit (LSR bit 0).
// uartPhase: packet sequencing (0 idle; N = byte N of 3 loaded).
export const MOUSE_STATE_VARS = [
  // msCurX/msCurY are in MICKEYS (half-pixels): Windows 1.01's CGA
  // mapping applies mouse deltas 2:1 on both axes (see emitMouseWires).
  // Init = the guest's power-on cursor, measured empirically at pixel
  // (320, 100) = mickey (160, 50). Dead reckoning from here is exact —
  // targets are always in-bounds so neither side ever clamps, and the
  // guest coalescing deltas (summing) changes nothing.
  { name: 'msCurX', init: 160 },
  { name: 'msCurY', init: 50 },
  { name: 'msSentBtn', init: 0 },
  { name: 'msTgtLatch', init: 0 },
  // Hold-mode button latch: toggled by cell press edges while the hold
  // wire (--msHold) is up — first tap arms it (button down there), the
  // next tap completes the drag (release at that tap's position) — and
  // cleared the moment the wire drops. Required for Windows 1.x menus,
  // which only stay open while the button is held. See emitMouseWires.
  { name: 'msHeldBtn', init: 0 },
  // Inter-packet pacing stamp (the 1200-baud line rate, in CYCLES —
  // guest time): a new packet may only start once cycleCount passes
  // this. Without the gap the next packet's IRQ nests inside the
  // guest's still-running mouse event handler and Windows 1.x
  // enqueues button events at the stale pre-move position. See
  // emitMouseWires / MOUSE_PACKET_GAP_CYCLES.
  { name: 'msQuietUntil', init: 0 },
  // Unsent raw-button transitions (edge queue) + previous raw state
  // for edge detection: presses shorter than the packet gap still
  // deliver their full down→up train, one transition per paced
  // packet. See emitMouseWires.
  { name: 'msPendEdges', init: 0 },
  { name: 'msRawPrev', init: 0 },
  // Previous tick's cell-pressed level — press-edge detection for the
  // hold latch's tap toggle (see emitMouseWires --_msTouchEdge).
  { name: 'msTouchPrev', init: 0 },
  { name: 'msDxL', init: 0 },
  { name: 'msDyL', init: 0 },
  { name: 'uartIer', init: 0 },
  { name: 'uartMcr', init: 0 },
  { name: 'uartRbr', init: 0 },
  { name: 'uartDr', init: 0 },
  { name: 'uartPhase', init: 0 },
];

// One @property registration block for a double-buffered <integer> variable.
function propertyBlock(name, init) {
  return `@property --${name} {
  syntax: '<integer>';
  inherits: true;
  initial-value: ${init};
}`;
}

// The subsystem each state variable's @property registration belongs with,
// so a variable's declaration sits in the same file-map section as the logic
// that drives it (instead of one monolithic declaration dump). Keys are the
// group ids; a variable not listed here defaults to the CPU group (the 14
// registers + bookkeeping latches). Platform wires (--clock/--keyboard/
// --kbdHold) are not double-buffered state vars and are emitted separately
// by their own section (see emitClockWireProperty / emitKeyboardWireProperties).
const STATE_VAR_GROUP = {
  picMask: 'pic', picPending: 'pic', picInService: 'pic',
  pitMode: 'pit', pitReload: 'pit', pitCounter: 'pit', pitWriteState: 'pit',
  prevKeyboard: 'kbd', kbdScancodeLatch: 'kbd',
  kbdHeld0: 'kbd', kbdHeld1: 'kbd', kbdHeld2: 'kbd', kbdHeld3: 'kbd',
  kbdHeld4: 'kbd', kbdHeld5: 'kbd', kbdHeld6: 'kbd', kbdHeld7: 'kbd',
  dacWriteIndex: 'dac', dacSubIndex: 'dac',
  dacReadIndex: 'dac', dacReadSubIndex: 'dac',
  msCurX: 'mouse', msCurY: 'mouse', msSentBtn: 'mouse', msTgtLatch: 'mouse',
  msHeldBtn: 'mouse', msQuietUntil: 'mouse', msPendEdges: 'mouse', msRawPrev: 'mouse',
  msTouchPrev: 'mouse', msDxL: 'mouse', msDyL: 'mouse',
  uartIer: 'mouse', uartMcr: 'mouse', uartRbr: 'mouse', uartDr: 'mouse',
  uartPhase: 'mouse',
};

// Emit the @property registrations for one subsystem group ('cpu' | 'pit' |
// 'kbd' | 'pic' | 'dac'). The CPU group carries the 14 registers plus the
// bookkeeping latches (halt / cycleCount / _tfPending / haltCode); the chip
// groups carry only their own latches. Each group is emitted inside its own
// file-map section so declarations sit with the logic that uses them.
export function emitStatePropertiesFor(group, opts) {
  const all = getAllVars(opts);
  return all
    .filter(v => (STATE_VAR_GROUP[v.name] ?? 'cpu') === group)
    .map(v => propertyBlock(v.name, v.init))
    .join('\n\n');
}

// Platform wire registrations, emitted by the sections that own the wire:
// --clock by the clock section, --keyboard / --kbdHold by the keyboard
// selectors section. They are not double-buffered state vars.
export function emitClockWireProperty() {
  return propertyBlock('clock', 0);
}
export function emitKeyboardWireProperties() {
  return `${propertyBlock('keyboard', 0)}\n\n${propertyBlock('kbdHold', 0)}`;
}
export function emitMouseWireProperty() {
  return `${propertyBlock('mouseTgt', 0)}\n\n${propertyBlock('msHold', 0)}`;
}

// The per-cell memory @property array is emitted directly by
// emit-css.mjs (emitMemoryPropertiesStreaming) — it dominates the file and
// must stream. The subsystem state registrations above are the small,
// human-scale remainder.

/**
 * Emit the machine element's __1 variable reads (read from double-buffer).
 * --__1AX: var(--__2AX, <init>);
 */
export function emitBufferReads(opts) {
  const all = getAllVars(opts);
  return all.map(v =>
    `  --__1${v.name}: var(--__2${v.name}, ${v.init});`
  ).join('\n');
}

/**
 * Emit convenience aliases for 8-bit register halves.
 */
export function emitRegisterAliases() {
  return [
    '  --AL: --lowerBytes(var(--__1AX), 8);',
    '  --CL: --lowerBytes(var(--__1CX), 8);',
    '  --DL: --lowerBytes(var(--__1DX), 8);',
    '  --BL: --lowerBytes(var(--__1BX), 8);',
    '  --AH: --rightShift(var(--__1AX), 8);',
    '  --CH: --rightShift(var(--__1CX), 8);',
    '  --DH: --rightShift(var(--__1DX), 8);',
    '  --BH: --rightShift(var(--__1BX), 8);',
  ].join('\n');
}

/**
 * Emit the store keyframe (clock phase 1): copy __0 → __2
 */
export function emitStoreKeyframe(opts) {
  const all = getAllVars(opts);
  const lines = all.map(v =>
    `    --__2${v.name}: var(--__0${v.name}, ${v.init});`
  );
  return `@keyframes store {
  0%, 100% {
${lines.join('\n')}
  }
}`;
}

/**
 * Emit the execute keyframe (clock phase 3): copy computed → __0
 */
export function emitExecuteKeyframe(opts) {
  const all = getAllVars(opts);
  const lines = all.map(v =>
    `    --__0${v.name}: var(--${v.name});`
  );
  return `@keyframes execute {
  0%, 100% {
${lines.join('\n')}
  }
}`;
}

/**
 * Emit the clock animation keyframes.
 */
export function emitClockKeyframes() {
  return `@keyframes anim-play {
  0% { --clock: 0 }
  25% { --clock: 1 }
  50% { --clock: 2 }
  75% { --clock: 3 }
}`;
}

/**
 * Emit the .clock rule — the animation heartbeat. The .clock element
 * must be an ANCESTOR of the .motherboard element (never the same one:
 * the motherboard's `animation: store…, execute…` shorthand would
 * cascade-clobber anim-play, and the cabinet's `@container
 * style(--clock: N)` queries only consult ancestors).
 */
export function emitClockRule() {
  return `.clock {
  animation: anim-play 400ms steps(4, jump-end) infinite;
  --clock: 0;
}`;
}

/**
 * Open the clock-plumbing rule on the machine element: attaches the
 * store/execute keyframes permanently paused, and unpauses each for a
 * single beat per clock lap. Returned UNCLOSED — emit-css.mjs streams
 * the double-buffer reads into it and closes it.
 */
export function emitClockPlumbingOpen() {
  return `.motherboard {
  animation: store 1ms infinite, execute 1ms infinite;
  animation-play-state: paused, paused;
  @container style(--clock: 1) { animation-play-state: running, paused }
  @container style(--clock: 3) { animation-play-state: paused, running }`;
}

// HTML wrapping used to live here. It moved out of Kiln and into
// `player/index.html`, a static file that loads cabinets via
// `?cabinet=path/to/cabinet.css`. Kiln emits pure CSS; the player loads it.

// --- Internal ---

function getAllVars(opts) {
  const regs = REGISTERS.map(r => ({ ...r }));
  const stateVars = opts.mouse ? [...STATE_VARS, ...MOUSE_STATE_VARS] : STATE_VARS;
  // Set SP initial value based on memory size (must match reference emulator)
  const spReg = regs.find(r => r.name === 'SP');
  spReg.init = ((opts.memSize || 0x600) - 0x8) & 0xFFFF;
  // Set IP to program entry (or BIOS init for DOS boot)
  const ipReg = regs.find(r => r.name === 'IP');
  ipReg.init = opts.initialIP != null ? opts.initialIP : (opts.programOffset || 0x100);
  // Set CS (0 for .COM, 0xF000 for DOS BIOS boot)
  const csReg = regs.find(r => r.name === 'CS');
  if (opts.initialCS != null) csReg.init = opts.initialCS;
  // Apply any additional initial register overrides
  if (opts.initialRegs) {
    for (const [name, val] of Object.entries(opts.initialRegs)) {
      const reg = regs.find(r => r.name === name);
      if (reg) reg.init = val;
    }
  }
  return [...regs, ...stateVars];
}

// --- Keyboard key definitions ---
const KEYBOARD_KEYS = [
  { id: 'kb-0',     label: '0',      scancode: 0x0B, ascii: 0x30 },
  { id: 'kb-1',     label: '1',      scancode: 0x02, ascii: 0x31 },
  { id: 'kb-2',     label: '2',      scancode: 0x03, ascii: 0x32 },
  { id: 'kb-3',     label: '3',      scancode: 0x04, ascii: 0x33 },
  { id: 'kb-4',     label: '4',      scancode: 0x05, ascii: 0x34 },
  { id: 'kb-5',     label: '5',      scancode: 0x06, ascii: 0x35 },
  { id: 'kb-6',     label: '6',      scancode: 0x07, ascii: 0x36 },
  { id: 'kb-7',     label: '7',      scancode: 0x08, ascii: 0x37 },
  { id: 'kb-8',     label: '8',      scancode: 0x09, ascii: 0x38 },
  { id: 'kb-9',     label: '9',      scancode: 0x0A, ascii: 0x39 },
  { id: 'kb-q',     label: 'Q',      scancode: 0x10, ascii: 0x71 },
  { id: 'kb-w',     label: 'W',      scancode: 0x11, ascii: 0x77 },
  { id: 'kb-e',     label: 'E',      scancode: 0x12, ascii: 0x65 },
  { id: 'kb-r',     label: 'R',      scancode: 0x13, ascii: 0x72 },
  { id: 'kb-t',     label: 'T',      scancode: 0x14, ascii: 0x74 },
  { id: 'kb-y',     label: 'Y',      scancode: 0x15, ascii: 0x79 },
  { id: 'kb-u',     label: 'U',      scancode: 0x16, ascii: 0x75 },
  { id: 'kb-i',     label: 'I',      scancode: 0x17, ascii: 0x69 },
  { id: 'kb-o',     label: 'O',      scancode: 0x18, ascii: 0x6F },
  { id: 'kb-p',     label: 'P',      scancode: 0x19, ascii: 0x70 },
  { id: 'kb-a',     label: 'A',      scancode: 0x1E, ascii: 0x61 },
  { id: 'kb-s',     label: 'S',      scancode: 0x1F, ascii: 0x73 },
  { id: 'kb-d',     label: 'D',      scancode: 0x20, ascii: 0x64 },
  { id: 'kb-f',     label: 'F',      scancode: 0x21, ascii: 0x66 },
  { id: 'kb-g',     label: 'G',      scancode: 0x22, ascii: 0x67 },
  { id: 'kb-h',     label: 'H',      scancode: 0x23, ascii: 0x68 },
  { id: 'kb-j',     label: 'J',      scancode: 0x24, ascii: 0x6A },
  { id: 'kb-k',     label: 'K',      scancode: 0x25, ascii: 0x6B },
  { id: 'kb-l',     label: 'L',      scancode: 0x26, ascii: 0x6C },
  { id: 'kb-enter', label: '\u21B5', scancode: 0x1C, ascii: 0x0D },
  { id: 'kb-z',     label: 'Z',      scancode: 0x2C, ascii: 0x7A },
  { id: 'kb-x',     label: 'X',      scancode: 0x2D, ascii: 0x78 },
  { id: 'kb-c',     label: 'C',      scancode: 0x2E, ascii: 0x63 },
  { id: 'kb-v',     label: 'V',      scancode: 0x2F, ascii: 0x76 },
  { id: 'kb-b',     label: 'B',      scancode: 0x30, ascii: 0x62 },
  { id: 'kb-n',     label: 'N',      scancode: 0x31, ascii: 0x6E },
  { id: 'kb-m',     label: 'M',      scancode: 0x32, ascii: 0x6D },
  { id: 'kb-comma',  label: ',',     scancode: 0x33, ascii: 0x2C },
  { id: 'kb-period', label: '.',     scancode: 0x34, ascii: 0x2E },
  { id: 'kb-slash',  label: '/',     scancode: 0x35, ascii: 0x2F },
  { id: 'kb-ctrl',  label: 'Ctrl',   scancode: 0x1D, ascii: 0x00 },
  { id: 'kb-alt',   label: 'Alt',    scancode: 0x38, ascii: 0x00 },
  { id: 'kb-space', label: '\u2423', scancode: 0x39, ascii: 0x20 },
  { id: 'kb-esc',   label: 'Esc',    scancode: 0x01, ascii: 0x1B },
  { id: 'kb-left',  label: '\u2190', scancode: 0x4B, ascii: 0x00 }, // ←
  { id: 'kb-down',  label: '\u2193', scancode: 0x50, ascii: 0x00 }, // ↓
  { id: 'kb-up',    label: '\u2191', scancode: 0x48, ascii: 0x00 }, // ↑
  { id: 'kb-right', label: '\u2192', scancode: 0x4D, ascii: 0x00 }, // →
  { id: 'kb-tab',   label: 'Tab',    scancode: 0x0F, ascii: 0x09 },
  { id: 'kb-bksp',  label: 'Bksp',   scancode: 0x0E, ascii: 0x08 },
  { id: 'kb-shift', label: 'Shift',  scancode: 0x2A, ascii: 0x00 },
  { id: 'kb-caps',  label: 'Caps',   scancode: 0x3A, ascii: 0x00 },
  { id: 'kb-del',   label: 'Del',    scancode: 0x53, ascii: 0x00 },
  { id: 'kb-f1',    label: 'F1',     scancode: 0x3B, ascii: 0x00 },
  { id: 'kb-f2',    label: 'F2',     scancode: 0x3C, ascii: 0x00 },
  { id: 'kb-f3',    label: 'F3',     scancode: 0x3D, ascii: 0x00 },
  { id: 'kb-f4',    label: 'F4',     scancode: 0x3E, ascii: 0x00 },
  { id: 'kb-f5',    label: 'F5',     scancode: 0x3F, ascii: 0x00 },
  { id: 'kb-f6',    label: 'F6',     scancode: 0x40, ascii: 0x00 },
  { id: 'kb-f7',    label: 'F7',     scancode: 0x41, ascii: 0x00 },
  { id: 'kb-f8',    label: 'F8',     scancode: 0x42, ascii: 0x00 },
  { id: 'kb-f9',    label: 'F9',     scancode: 0x43, ascii: 0x00 },
  { id: 'kb-f10',   label: 'F10',    scancode: 0x44, ascii: 0x00 },
];

/**
 * Emit CSS rules that map key-press UI state to --keyboard values.
 * Uses ID selectors (#kb-X) so HTML layout is free — button order in the
 * DOM does not need to match KEYBOARD_KEYS order.
 *
 *   #kb-X:active         — momentary press (mouse held down on the key).
 *   #kb-holdmode:checked — the hold wire (--kbdHold). While it is 1 the
 *                          machine LATCHES key releases instead of
 *                          delivering them: presses accumulate as held
 *                          keys (chords), and when the wire drops every
 *                          latched key's break code is drained back out.
 *                          See patterns/misc.mjs emitKeyboardWires. In the
 *                          raw player the player's hold-mode checkbox
 *                          drives this directly; the calcite bridge
 *                          mirrors it via set_pseudo_class_active.
 *
 * Emitted as separate rules (not a selector list) — calcite's input-edge
 * recogniser matches one `&:has(#ID:pseudo) { ... }` per rule.
 *
 * --keyboard is a single cascade-resolved value carrying serial press
 * PULSES (each press passes through 0). Simultaneity lives guest-side:
 * makes without breaks = keys down together.
 */
export function emitKeyboardRules() {
  const lines = ['.motherboard {'];
  for (const key of KEYBOARD_KEYS) {
    const value = (key.scancode << 8) | key.ascii;
    lines.push(`  &:has(#${key.id}:active) { --keyboard: ${value}; } /* ${key.label} */`);
  }
  lines.push(`  &:has(#kb-holdmode:checked) { --kbdHold: 1; } /* hold wire */`);
  lines.push('}');
  return lines.join('\n');
}

// --- Mouse cell grid ---
// The pointing surface: an 80×25 grid of 8×8-pixel cells over the CGA
// 640×200 screen. Pressing cell N (`#mc-N:active` — a real click in the
// raw player, set_pseudo_class_active from the calcite player) drives
// --mouseTgt to that cell's centre, encoded (x << 8 | y) + 1 so that 0
// means "no cell pressed". The serial-mouse machine (patterns/misc.mjs
// emitMouseWires) latches the last nonzero value as the movement target
// and treats nonzero as button-down.
//
// The player's hold switch (#kb-holdmode, the same control that latches
// keyboard keys) also raises the mouse hold wire --msHold: while it is
// up, a tap latches the button DOWN and later taps drag with it held;
// dropping the switch releases at the last position. This is how taps
// express press-drag-release — which Windows 1.x menus require (they
// only stay open while the button is held).
export const MOUSE_GRID = { cols: 80, rows: 25, cellW: 8, cellH: 8 };

export function emitMouseCellRules() {
  const { cols, rows, cellW, cellH } = MOUSE_GRID;
  const lines = ['.motherboard {'];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = r * cols + c;
      const x = c * cellW + (cellW >> 1);
      const y = r * cellH + (cellH >> 1);
      lines.push(`  &:has(#mc-${n}:active) { --mouseTgt: ${((x << 8) | y) + 1}; }`);
    }
  }
  lines.push(`  &:has(#kb-holdmode:checked) { --msHold: 1; } /* hold wire — the shared hold switch */`);
  lines.push('}');
  return lines.join('\n');
}
