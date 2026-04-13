# Phase 5: BIOS Handlers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement BIOS interrupt handlers (INT 09h keyboard, INT 10h video, INT 16h keyboard read, INT 1Ah timer, INT 20h halt) as microcode μop sequences, with keyboard input via HTML `:active` buttons firing IRQ 1.

**Architecture:** BIOS handlers are expressed as μop sequences dispatched via opcode 0xD6 (214, undocumented SALC on real 8086). This is separate from the IRQ delivery sentinel at 0xF1 (241), avoiding dispatch conflicts. Each handler is authored twice: as a JS function in the reference emulator, and as a CSS μop emitter in the transpiler. The conformance pipeline validates parity. Keyboard input uses HTML `<button>` elements with CSS `:active` pseudo-class to set a `--keyboard` property, which fires IRQ 1 on change. ROM layout at each handler address: `[0xD6, routineID, 0xCF]`.

**Tech Stack:** JavaScript (transpiler + reference emulator), CSS (generated output), NASM (test assembly), Calcite (JIT runner)

**Design spec:** `docs/superpowers/specs/2026-04-12-phase5-bios-handlers-design.md`

---

## File Structure

**New files:**
- `transpiler/src/patterns/bios.mjs` — BIOS microcode μop emitters (INT 09h, 10h, 16h, 1Ah, 20h)
- `tools/lib/bios-handlers.mjs` — JS reference BIOS handler functions (INT 09h, 10h, 16h, 1Ah, 20h)
- `tests/keyboard-irq.asm` — Test program: keyboard IRQ → BDA buffer → INT 16h read

**Modified files:**
- `tools/peripherals.mjs` — Update `KeyboardController` to accept full `(scancode<<8)|ascii` words, return scancode from port 0x60
- `tools/compare.mjs` — Wire `int_handler` hook, add keyboard event injection
- `transpiler/src/template.mjs` — Add `kbdLast` state var, add `--keyboard` `@property` declaration
- `transpiler/src/emit-css.mjs` — Add keyboard computed properties, update `picPending` default, update `irqActive` for μop 0 holds, wire BIOS emitters
- `transpiler/src/patterns/irq.mjs` — Fix `_irqEffective` to respect PIC in-service priority

---

## Task 0: PIC Priority Fix in CSS

Fix the pre-existing bug where `_irqEffective` ignores the PIC in-service register. Without this, adding a second IRQ source (keyboard) could cause incorrect IRQ delivery.

**Files:**
- Modify: `transpiler/src/patterns/irq.mjs:113-128`

- [ ] **Step 1: Write the fix in irq.mjs**

In `emitPicVectorProperties()`, change the `_irqEffective` computation to block all IRQs when any IRQ is in-service:

```javascript
export function emitPicVectorProperties() {
  return [
    // _irqEffective: unmasked pending IRQs, blocked when any IRQ is in-service.
    // Conservative: if picInService != 0, no IRQs fire. This matches the 8259A's
    // default mode where a lower-priority IRQ cannot preempt a higher-priority one.
    `  --_irqEffective: if(style(--__1picInService: 0): --and(var(--__1picPending), --not(var(--__1picMask))); else: 0);`,
    // _irqNum: lowest set bit of _irqEffective (for acknowledge — which bit to move)
    `  --_irqNum: --lowestBit(var(--_irqEffective));`,
    // _irqBit: bitmask for the IRQ being acknowledged
    `  --_irqBit: --pow2(var(--_irqNum));`,
    // picVector: derived from in-service register (stable after acknowledge).
    // With the priority fix above, only one bit is ever set in picInService,
    // so lowestBit always returns the correct IRQ number.
    `  --picVector: calc(8 + --lowestBit(var(--__1picInService)));`,
    // _ifFlag: interrupt enable flag
    `  --_ifFlag: --bit(var(--__1flags), 9);`,
  ].join('\n');
}
```

- [ ] **Step 2: Verify timer-irq test still passes**

```bash
C:\Users\AdmT9N0CX01V65438A\AppData\Local\bin\NASM\nasm.exe -f bin -o tests/timer-irq.com tests/timer-irq.asm
node transpiler/generate-hacky.mjs tests/timer-irq.com --mem 1536 -o tests/timer-irq.css
node tools/compare.mjs tests/timer-irq.com build/gossamer.bin tests/timer-irq.css --ticks=500
```

Expected: ALL INSTRUCTIONS MATCH (same as before the change).

- [ ] **Step 3: Commit**

```bash
git add transpiler/src/patterns/irq.mjs
git commit -m "fix: add PIC in-service priority check to _irqEffective

Block IRQ delivery when any IRQ is currently in-service. This prevents
incorrect vectoring when multiple IRQ sources are active (Phase 5 prep)."
```

---

## Task 1: Update KeyboardController for Full Key Words

The existing `KeyboardController` in `peripherals.mjs` takes a single scancode byte via `feedKey()` and returns it from port 0x60. Phase 5 needs it to accept a full `(scancode<<8)|ascii` word, return the scancode (high byte) from port 0x60, and expose the full word for the INT 09h handler.

**Files:**
- Modify: `tools/peripherals.mjs:221-257`

- [ ] **Step 1: Update KeyboardController**

```javascript
export class KeyboardController {
  constructor(pic) {
    this.pic = pic;
    this.queue = [];        // key word queue: (scancode<<8)|ascii
    this.currentWord = 0;   // last key word dequeued
  }

  isConnected(port) {
    return port === 0x60 || port === 0x61;
  }

  /**
   * Queue a key event. keyWord is (scancode<<8)|ascii for press, 0 for release.
   */
  feedKey(keyWord) {
    this.queue.push(keyWord & 0xFFFF);
    this.pic.raiseIRQ(1);
  }

  portIn(w, port) {
    if (port === 0x60) {
      if (this.queue.length > 0) {
        this.currentWord = this.queue.shift();
      }
      // Port 0x60 returns scancode (high byte), matching real hardware
      return (this.currentWord >> 8) & 0xFF;
    }
    if (port === 0x61) {
      return 0;
    }
    return 0;
  }

  portOut(w, port, val) {
    // Port 0x61 writes ignored
  }

  tick() {}
}
```

- [ ] **Step 2: Commit**

```bash
git add tools/peripherals.mjs
git commit -m "feat: KeyboardController accepts full (scancode<<8)|ascii words

Port 0x60 now returns the scancode (high byte), matching real PC hardware.
The full word is available via currentWord for the INT 09h handler."
```

---

## Task 2: JS BIOS Handler Functions

Create the JS reference implementations of all BIOS handlers. These run in the reference emulator when `int_handler(type)` is called.

**Files:**
- Create: `tools/lib/bios-handlers.mjs`

- [ ] **Step 1: Create bios-handlers.mjs with INT 09h**

```javascript
// JS reference BIOS handlers for the conformance emulator.
// These implement the same behavior as the CSS microcode μop sequences.
// The int_handler hook in js8086.js calls these; returning true skips
// the normal INT push/jump sequence.

// BDA keyboard buffer constants (standard PC layout)
const KBD_BUF_START = 0x001E;  // BDA offset of first buffer word
const KBD_BUF_END   = 0x003E;  // BDA offset past last buffer word
const BDA_BASE      = 0x0400;  // Linear address of BDA segment 0x0040

/**
 * Create BIOS handler functions bound to the emulator's memory and peripherals.
 *
 * @param {Uint8Array} memory - 1MB flat memory
 * @param {object} pic - PIC peripheral instance
 * @param {object} kbd - KeyboardController instance
 * @param {Function} getRegs - returns {ah, al, ax, bx, cx, dx, ...}
 * @param {Function} setRegs - sets register values
 * @returns {Function} int_handler(type) → true if handled
 */
export function createBiosHandlers(memory, pic, kbd, getRegs, setRegs) {

  function int09h() {
    const scancode = kbd.portIn(0, 0x60);
    if (scancode === 0) {
      pic.portOut(0, 0x20, 0x20);  // EOI
      return true;
    }
    const ascii = kbd.currentWord & 0xFF;

    const tail = memory[BDA_BASE + 0x1C] | (memory[BDA_BASE + 0x1D] << 8);
    const head = memory[BDA_BASE + 0x1A] | (memory[BDA_BASE + 0x1B] << 8);

    let newTail = tail + 2;
    if (newTail >= KBD_BUF_END) newTail = KBD_BUF_START;

    if (newTail !== head) {
      memory[BDA_BASE + tail] = ascii;
      memory[BDA_BASE + tail + 1] = scancode;
      memory[BDA_BASE + 0x1C] = newTail & 0xFF;
      memory[BDA_BASE + 0x1D] = (newTail >> 8) & 0xFF;
    }

    pic.portOut(0, 0x20, 0x20);  // EOI
    return true;
  }

  function int16h() {
    const regs = getRegs();
    if (regs.ah === 0x00) {
      // AH=00h: read key, blocking
      const head = memory[BDA_BASE + 0x1A] | (memory[BDA_BASE + 0x1B] << 8);
      const tail = memory[BDA_BASE + 0x1C] | (memory[BDA_BASE + 0x1D] << 8);
      if (head === tail) {
        // Buffer empty — in the reference emulator, we can't truly block.
        // Return false to let the program's own spin loop handle it.
        // The program will re-issue INT 16h on the next iteration.
        return false;
      }
      const ascii = memory[BDA_BASE + head];
      const scancode = memory[BDA_BASE + head + 1];
      setRegs({ al: ascii, ah: scancode });

      let newHead = head + 2;
      if (newHead >= KBD_BUF_END) newHead = KBD_BUF_START;
      memory[BDA_BASE + 0x1A] = newHead & 0xFF;
      memory[BDA_BASE + 0x1B] = (newHead >> 8) & 0xFF;
      return true;
    }
    if (regs.ah === 0x01) {
      // AH=01h: check key, non-blocking
      const head = memory[BDA_BASE + 0x1A] | (memory[BDA_BASE + 0x1B] << 8);
      const tail = memory[BDA_BASE + 0x1C] | (memory[BDA_BASE + 0x1D] << 8);
      if (head === tail) {
        // Empty — set ZF
        setRegs({ flags: regs.flags | 0x0040 });
      } else {
        // Key available — clear ZF, peek into AX
        const ascii = memory[BDA_BASE + head];
        const scancode = memory[BDA_BASE + head + 1];
        setRegs({ al: ascii, ah: scancode, flags: regs.flags & ~0x0040 });
      }
      return true;
    }
    return false;
  }

  function int10h() {
    const regs = getRegs();
    if (regs.ah === 0x0E) {
      // AH=0Eh: teletype output
      const ch = regs.al;
      const cursorRow = memory[BDA_BASE + 0x51];  // BDA cursor row
      const cursorCol = memory[BDA_BASE + 0x50];  // BDA cursor col
      const cols = 80;

      if (ch === 0x0D) {
        // CR: move cursor to column 0
        memory[BDA_BASE + 0x50] = 0;
      } else if (ch === 0x0A) {
        // LF: move cursor down one row
        if (cursorRow < 24) {
          memory[BDA_BASE + 0x51] = cursorRow + 1;
        } else {
          // Scroll up: copy rows 1-24 to 0-23, clear row 24
          for (let r = 1; r <= 24; r++) {
            for (let c = 0; c < cols; c++) {
              const srcOff = (r * cols + c) * 2;
              const dstOff = ((r - 1) * cols + c) * 2;
              memory[0xB8000 + dstOff] = memory[0xB8000 + srcOff];
              memory[0xB8000 + dstOff + 1] = memory[0xB8000 + srcOff + 1];
            }
          }
          // Clear last row
          for (let c = 0; c < cols; c++) {
            memory[0xB8000 + (24 * cols + c) * 2] = 0x20;
            memory[0xB8000 + (24 * cols + c) * 2 + 1] = 0x07;
          }
        }
      } else if (ch === 0x08) {
        // BS: move cursor left
        if (cursorCol > 0) {
          memory[BDA_BASE + 0x50] = cursorCol - 1;
        }
      } else if (ch === 0x07) {
        // BEL: ignore (no speaker)
      } else {
        // Printable character
        const offset = (cursorRow * cols + cursorCol) * 2;
        memory[0xB8000 + offset] = ch;
        memory[0xB8000 + offset + 1] = 0x07;  // light grey on black

        let newCol = cursorCol + 1;
        if (newCol >= cols) {
          newCol = 0;
          if (cursorRow < 24) {
            memory[BDA_BASE + 0x51] = cursorRow + 1;
          } else {
            // Scroll (same as LF scroll above)
            for (let r = 1; r <= 24; r++) {
              for (let c = 0; c < cols; c++) {
                const srcOff = (r * cols + c) * 2;
                const dstOff = ((r - 1) * cols + c) * 2;
                memory[0xB8000 + dstOff] = memory[0xB8000 + srcOff];
                memory[0xB8000 + dstOff + 1] = memory[0xB8000 + srcOff + 1];
              }
            }
            for (let c = 0; c < cols; c++) {
              memory[0xB8000 + (24 * cols + c) * 2] = 0x20;
              memory[0xB8000 + (24 * cols + c) * 2 + 1] = 0x07;
            }
          }
        }
        memory[BDA_BASE + 0x50] = newCol;
      }
      return true;
    }
    if (regs.ah === 0x02) {
      // AH=02h: set cursor position
      memory[BDA_BASE + 0x51] = regs.dh;  // row
      memory[BDA_BASE + 0x50] = regs.dl;  // col
      return true;
    }
    if (regs.ah === 0x03) {
      // AH=03h: get cursor position
      setRegs({ dh: memory[BDA_BASE + 0x51], dl: memory[BDA_BASE + 0x50], cx: 0 });
      return true;
    }
    if (regs.ah === 0x0F) {
      // AH=0Fh: get video mode
      setRegs({
        al: memory[BDA_BASE + 0x49],  // current mode
        ah: memory[BDA_BASE + 0x4A],  // columns
        bh: 0,                          // active page
      });
      return true;
    }
    if (regs.ah === 0x00) {
      // AH=00h: set video mode
      memory[BDA_BASE + 0x49] = regs.al;  // mode
      memory[BDA_BASE + 0x4A] = (regs.al === 0x13) ? 40 : 80;  // columns
      memory[BDA_BASE + 0x50] = 0;  // cursor col
      memory[BDA_BASE + 0x51] = 0;  // cursor row
      // Clear screen
      if (regs.al === 0x13) {
        // Mode 13h: 320x200x256 = 64000 bytes at 0xA0000
        for (let i = 0; i < 64000; i++) memory[0xA0000 + i] = 0;
      } else {
        // Text mode: 80x25x2 = 4000 bytes at 0xB8000
        for (let i = 0; i < 4000; i += 2) {
          memory[0xB8000 + i] = 0x20;
          memory[0xB8000 + i + 1] = 0x07;
        }
      }
      return true;
    }
    if (regs.ah === 0x06) {
      // AH=06h: scroll up (AL=lines, BH=attr, CH/CL=upper-left, DH/DL=lower-right)
      const lines = regs.al || 25;  // AL=0 means clear entire window
      const attr = regs.bh;
      const top = (regs.cx >> 8) & 0xFF;   // CH
      const left = regs.cx & 0xFF;          // CL
      const bottom = (regs.dx >> 8) & 0xFF; // DH
      const right = regs.dx & 0xFF;         // DL
      const cols = 80;

      for (let r = top; r <= bottom; r++) {
        const srcRow = r + lines;
        for (let c = left; c <= right; c++) {
          const dstOff = (r * cols + c) * 2;
          if (srcRow <= bottom) {
            const srcOff = (srcRow * cols + c) * 2;
            memory[0xB8000 + dstOff] = memory[0xB8000 + srcOff];
            memory[0xB8000 + dstOff + 1] = memory[0xB8000 + srcOff + 1];
          } else {
            memory[0xB8000 + dstOff] = 0x20;
            memory[0xB8000 + dstOff + 1] = attr;
          }
        }
      }
      return true;
    }
    return false;
  }

  function int1ah() {
    const regs = getRegs();
    if (regs.ah === 0x00) {
      // AH=00h: get tick count (use PIT counter as proxy)
      // In a real PC this reads the BIOS tick counter at BDA 0x006C.
      // For now, return 0 — the PIT counter is the authoritative time source.
      setRegs({ cx: 0, dx: 0, al: 0 });
      return true;
    }
    return false;
  }

  function int20h() {
    // Halt: write 1 to halt flag memory location
    memory[0x2110] = 1;
    return true;
  }

  return function int_handler(type) {
    switch (type) {
      case 0x09: return int09h();
      case 0x10: return int10h();
      case 0x16: return int16h();
      case 0x1A: return int1ah();
      case 0x20: return int20h();
      default: return false;
    }
  };
}
```

- [ ] **Step 2: Verify the file parses**

```bash
node -e "import('./tools/lib/bios-handlers.mjs').then(() => console.log('OK'))"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add tools/lib/bios-handlers.mjs
git commit -m "feat: add JS reference BIOS handlers for Phase 5

INT 09h (keyboard → BDA buffer), INT 10h (teletype, cursor, mode, scroll),
INT 16h (read/peek keyboard buffer), INT 1Ah (tick count), INT 20h (halt).
These are consumed by compare.mjs via the int_handler hook in js8086.js."
```

---

## Task 3: Wire BIOS Handlers into compare.mjs

Connect the JS BIOS handlers to the reference emulator in compare.mjs. Add keyboard event injection support for conformance testing.

**Files:**
- Modify: `tools/compare.mjs`

- [ ] **Step 1: Import and wire bios-handlers**

Add after the existing imports (around line 28):

```javascript
import { createBiosHandlers } from './lib/bios-handlers.mjs';
```

After the CPU is created (after line 88), add:

```javascript
const int_handler = createBiosHandlers(
  memory, pic, kbd,
  () => cpu.getRegs(),
  (regs) => cpu.setRegs(regs),
);
```

Change the CPU construction (line 81) to pass `int_handler`:

```javascript
const cpu = Intel8086(
  (addr, val) => { memory[addr & 0xFFFFF] = val & 0xFF; },
  (addr) => memory[addr & 0xFFFFF],
  pic,
  pit,
  int_handler,
);
```

Wait — the CPU is created before `int_handler` exists. We need to create a wrapper:

```javascript
let int_handler = null;

const cpu = Intel8086(
  (addr, val) => { memory[addr & 0xFFFFF] = val & 0xFF; },
  (addr) => memory[addr & 0xFFFFF],
  pic,
  pit,
  (type) => int_handler ? int_handler(type) : false,
);
cpu.reset();
cpu.setRegs({ cs: 0, ip: 0x0100, ss: 0, sp: 0x05F8, ds: 0, es: 0 });

int_handler = createBiosHandlers(
  memory, pic, kbd,
  () => cpu.getRegs(),
  (regs) => cpu.setRegs(regs),
);
```

- [ ] **Step 2: Add keyboard event injection**

Add a `--key-events` CLI flag. After the flags parsing (around line 38), add:

```javascript
// Parse key events: --key-events=100:0x1E61,150:0
const keyEvents = [];
if (flags['key-events']) {
  for (const part of flags['key-events'].split(',')) {
    const [cycleStr, keyStr] = part.split(':');
    keyEvents.push({ cycle: parseInt(cycleStr), key: parseInt(keyStr) });
  }
}
```

In the reference trace loop (around line 105), inject keys after each step:

```javascript
for (let t = 0; t < maxTicks; t++) {
  // Inject key events at the right cycle
  for (const ev of keyEvents) {
    if (ev.cycle === t) {
      kbd.feedKey(ev.key);
    }
  }
  cpu.step();
  // ... rest of trace loop
}
```

- [ ] **Step 3: Initialize BDA keyboard buffer fields**

Before the trace loop, initialize the BDA keyboard buffer head/tail pointers so INT 09h and INT 16h work correctly:

```javascript
// Initialize BDA keyboard buffer pointers
// Head and tail both start at KBD_BUF_START (0x001E), meaning empty buffer.
memory[0x041A] = 0x1E;  // head lo
memory[0x041B] = 0x00;  // head hi
memory[0x041C] = 0x1E;  // tail lo
memory[0x041D] = 0x00;  // tail hi
// BDA video mode defaults
memory[0x0449] = 0x03;  // video mode 3 (80x25 color text)
memory[0x044A] = 80;    // columns
```

- [ ] **Step 4: Run existing timer-irq test to verify no regression**

```bash
node tools/compare.mjs tests/timer-irq.com build/gossamer.bin tests/timer-irq.css --ticks=500
```

Expected: ALL INSTRUCTIONS MATCH (BIOS handlers are wired but timer-irq doesn't use them).

- [ ] **Step 5: Commit**

```bash
git add tools/compare.mjs
git commit -m "feat: wire JS BIOS handlers and keyboard injection into compare.mjs

Pass int_handler to reference emulator for INT 09h/10h/16h/1Ah/20h.
Add --key-events flag for conformance testing keyboard input.
Initialize BDA keyboard buffer and video mode fields."
```

---

## Task 4: Write keyboard-irq Test Program

A test program that exercises the full keyboard path: unmask IRQ 1, wait for a key via INT 16h AH=00h, store result, halt.

**Files:**
- Create: `tests/keyboard-irq.asm`

- [ ] **Step 1: Write the test program**

```nasm
; keyboard-irq.asm — Test keyboard IRQ → BDA buffer → INT 16h path
; Unmasked IRQ 1, waits for a key via INT 16h AH=00h, stores AX, halts.
; When run with --key-events=50:0x1E61,100:0 the expected result is AX=0x1E61.

org 0x100

start:
    ; Enable interrupts
    sti

    ; Unmask IRQ 1 on PIC (clear bit 1 of mask register)
    in al, 0x21         ; read current mask
    and al, 0xFD        ; clear bit 1 (IRQ 1)
    out 0x21, al        ; write back

    ; Read a key via INT 16h AH=00h (blocking)
    mov ah, 0x00
    int 0x16

    ; AX now has (scancode<<8)|ascii from INT 16h
    ; Store in memory for visibility
    mov [result], ax

    ; Halt
    int 0x20

result:
    dw 0
```

- [ ] **Step 2: Assemble**

```bash
C:\Users\AdmT9N0CX01V65438A\AppData\Local\bin\NASM\nasm.exe -f bin -o tests/keyboard-irq.com tests/keyboard-irq.asm
```

- [ ] **Step 3: Test with reference emulator only**

```bash
node tools/compare.mjs tests/keyboard-irq.com build/gossamer.bin tests/keyboard-irq.css --ticks=200 --key-events=50:0x1E61,100:0
```

This will fail at the CSS comparison stage (no microcode emitters yet), but the reference emulator trace should show AX=0x1E61 at halt. Check the ref-trace.json output.

- [ ] **Step 4: Commit**

```bash
git add tests/keyboard-irq.asm tests/keyboard-irq.com
git commit -m "test: add keyboard-irq test program for Phase 5

Exercises IRQ 1 → INT 09h → BDA buffer → INT 16h AH=00h path.
Run with --key-events=50:0x1E61,100:0 to inject a keypress."
```

---

## Task 5: Add `kbdLast` State Var and Keyboard Computed Properties

Add the CSS infrastructure for keyboard edge detection: `kbdLast` state var, `--keyboard` property declaration, `--_kbdChanged`, `--_kbdScancode`, `--_kbdAscii` computed properties.

**Files:**
- Modify: `transpiler/src/template.mjs:23-35`
- Modify: `transpiler/src/emit-css.mjs`

- [ ] **Step 1: Add `kbdLast` to STATE_VARS in template.mjs**

```javascript
export const STATE_VARS = [
  { name: 'halt', init: 0, debug: true },
  { name: 'uOp', init: 0, debug: true },
  { name: 'cycleCount', init: 0, debug: false },
  { name: 'picMask', init: 0xFF, debug: false },
  { name: 'picPending', init: 0, debug: false },
  { name: 'picInService', init: 0, debug: false },
  { name: 'irqActive', init: 0, debug: false },
  { name: 'pitCounter', init: 0, debug: false },
  { name: 'pitReload', init: 0, debug: false },
  { name: 'pitMode', init: 0, debug: false },
  { name: 'pitWriteState', init: 0, debug: false },
  { name: 'kbdLast', init: 0, debug: false },
];
```

- [ ] **Step 2: Add `--keyboard` @property declaration to template.mjs**

In `emitPropertyDecls()`, add after the clock property:

```javascript
lines.push(`@property --keyboard {
  syntax: '<integer>';
  inherits: true;
  initial-value: 0;
}`);
```

- [ ] **Step 3: Add keyboard computed properties to emit-css.mjs**

After the PIC/IRQ state properties (around line 328), add a new keyboard section:

```javascript
  // Keyboard state
  writeStream.write('  /* ===== KEYBOARD ===== */\n');
  writeStream.write('  --_kbdScancode: --rightShift(var(--keyboard), 8);\n');
  writeStream.write('  --_kbdAscii: --lowerBytes(var(--keyboard), 8);\n');
  // Edge detection: update kbdLast only at instruction boundaries
  writeStream.write('  --kbdLast: if(style(--__1uOp: 0): var(--keyboard); else: var(--__1kbdLast));\n');
  // _kbdChanged: 1 when keyboard differs from previous boundary, 0 otherwise
  writeStream.write('  --_kbdChanged: if(style(--__1uOp: 0): min(1, max(0, sign(calc(max(var(--keyboard), var(--__1kbdLast)) - min(var(--keyboard), var(--__1kbdLast)))))); else: 0);\n');
```

- [ ] **Step 4: Update picPending default to include keyboard IRQ**

In emit-css.mjs, change the `picPending` default expression (around line 345):

```javascript
    const defaultExpr = reg === 'picPending'
      ? `--or(--or(var(--__1picPending), var(--_pitFired)), calc(var(--_kbdChanged) * 2))`
      : `var(--__1${reg})`;
```

- [ ] **Step 5: Verify existing tests still pass**

```bash
node transpiler/generate-hacky.mjs tests/timer-irq.com --mem 1536 -o tests/timer-irq.css
node tools/compare.mjs tests/timer-irq.com build/gossamer.bin tests/timer-irq.css --ticks=500
```

Expected: ALL INSTRUCTIONS MATCH (keyboard properties exist but `--keyboard` is always 0, so `_kbdChanged` is always 0).

- [ ] **Step 6: Commit**

```bash
git add transpiler/src/template.mjs transpiler/src/emit-css.mjs
git commit -m "feat: add keyboard edge detection CSS infrastructure

kbdLast state var, --keyboard property, _kbdChanged computed property,
_kbdScancode/_kbdAscii helpers. picPending now merges keyboard IRQ source."
```

---

## Task 6: Fix irqActive for BIOS Handler μop 0 Holds

Modify the irqActive expression to allow IRQ injection during BIOS handler μop 0 holds (opcode 0xD6 = 214), preventing the INT 16h deadlock. The IRQ delivery sentinel (0xF1 = 241) keeps its existing behavior.

**Files:**
- Modify: `transpiler/src/emit-css.mjs:355-363`

- [ ] **Step 1: Update irqActive expression**

Replace the irqActive block (lines 355-363) with:

```javascript
  writeStream.write('  /* ===== IRQ ACTIVE ===== */\n');
  writeStream.write('  /* Checked in order: first match wins. */\n');
  writeStream.write(`  --irqActive: if(\n`);
  writeStream.write(`    style(--opcode: 241) and style(--__1uOp: 5): 0; /* IRQ sentinel retirement */\n`);
  writeStream.write(`    style(--opcode: 241): var(--__1irqActive); /* IRQ sentinel mid-sequence: hold */\n`);
  // BIOS handler (0xD6) μop 0 hold: allow IRQ injection so INT 16h can receive keyboard IRQs.
  writeStream.write(`    style(--opcode: 214) and style(--__1uOp: 0): if(\n`);
  writeStream.write(`      style(--_irqEffective: 0): 0;\n`);
  writeStream.write(`      style(--_ifFlag: 0): 0;\n`);
  writeStream.write(`    else: 1);\n`);
  writeStream.write(`    style(--opcode: 214): 0; /* BIOS handler mid-sequence: no IRQ */\n`);
  writeStream.write(`    style(--_irqEffective: 0): 0; /* no unmasked pending IRQ */\n`);
  writeStream.write(`    style(--_ifFlag: 0): 0; /* IF=0: interrupts disabled */\n`);
  writeStream.write(`    style(--__1uOp: 0): 1; /* instruction boundary + IF=1 + IRQ pending */\n`);
  writeStream.write(`  else: 0); /* mid-instruction */\n\n`);
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
node transpiler/generate-hacky.mjs tests/timer-irq.com --mem 1536 -o tests/timer-irq.css
node tools/compare.mjs tests/timer-irq.com build/gossamer.bin tests/timer-irq.css --ticks=500
```

Expected: ALL INSTRUCTIONS MATCH (opcode 214 doesn't appear in any existing test program).

- [ ] **Step 3: Commit**

```bash
git add transpiler/src/emit-css.mjs
git commit -m "feat: add irqActive rules for BIOS handler opcode 0xD6

Allow IRQ injection during BIOS handler μop 0 holds (INT 16h wait).
Block IRQs during mid-sequence μops > 0. Separate from IRQ delivery
sentinel (0xF1) which keeps its existing behavior."
```

---

## BIOS Dispatch Architecture Note

All BIOS handlers share opcode 0xD6 (214). The existing dispatch system (`addEntry`, `addMemWrite`) allows one expression per `(opcode, uOp)` slot. Multiple handlers sharing the same opcode need **q1-guarded composite expressions** — e.g., `if(style(--q1: 9): int09h_addr; style(--q1: 16): int10h_addr; else: -1)` for `--memAddr`.

Two approaches:
1. **Composite emitter:** `emitAllBiosHandlers` builds one combined expression per μop slot, merging all handlers' contributions. More complex but uses existing dispatch API.
2. **Standalone properties:** Emit BIOS handler dispatch as standalone computed property blocks (like PIT properties), bypassing `addEntry`/`addMemWrite` entirely. Cleaner separation but duplicates dispatch infrastructure.

Resolve this at implementation time. The μop semantics in each task are correct regardless of which approach is used.

---

## Task 7: BIOS Microcode Emitter — Scaffold + INT 20h

Create the BIOS microcode emitter module. BIOS handlers use opcode 0xD6 (214) with a routine ID in `--q1` and subfunction in `--AH`. Start with INT 20h (halt) — the simplest handler — to validate the dispatch plumbing.

**Files:**
- Create: `transpiler/src/patterns/bios.mjs`
- Modify: `transpiler/src/emit-css.mjs` (import and register)
- Modify: `transpiler/src/memory.mjs` (place sentinel bytes in ROM)

- [ ] **Step 1: Create bios.mjs with constants and INT 20h**

```javascript
// BIOS microcode emitters: opcode 0xD6 (214) + routine ID dispatch.
//
// BIOS handlers use a different opcode (0xD6) from the IRQ delivery
// sentinel (0xF1) to avoid dispatch table conflicts. 0xD6 is the
// undocumented SALC instruction on real 8086 — no program uses it.
//
// ROM layout at each handler address: [0xD6, routineID, 0xCF]
//   0xD6 = BIOS sentinel opcode (triggers handler μop dispatch)
//   routineID = which handler (read as --q1)
//   0xCF = IRET (safety fallback, normally not reached)
//
// The dispatch keys on (opcode=214, q1=routineID, AH, uOp).
// Each handler's emitter adds entries for its routine ID.

export const BIOS_OPCODE = 0xD6;  // 214 decimal

// Routine IDs — one per BIOS interrupt
export const ROUTINE_IDS = {
  INT_09H: 0x09,
  INT_10H: 0x10,
  INT_16H: 0x16,
  INT_1AH: 0x1A,
  INT_20H: 0x20,
};

// IVT entries to populate: interrupt number → routine ID
export const IVT_ENTRIES = {
  0x09: ROUTINE_IDS.INT_09H,
  0x10: ROUTINE_IDS.INT_10H,
  0x16: ROUTINE_IDS.INT_16H,
  0x1A: ROUTINE_IDS.INT_1AH,
  0x20: ROUTINE_IDS.INT_20H,
};

/**
 * Build BIOS ROM bytes: for each handler, place [0xD6, routineID, 0xCF].
 * Returns {handlers, romBytes} where handlers maps intNum → offset within ROM,
 * and romBytes is the ROM content to embed at BIOS_BASE (0xF0000).
 */
export function buildBiosRom() {
  const rom = [];
  const handlers = {};
  for (const [intNum, routineId] of Object.entries(IVT_ENTRIES)) {
    handlers[intNum] = rom.length;  // offset within ROM
    rom.push(BIOS_OPCODE);          // 0xD6
    rom.push(routineId);            // routine ID
    rom.push(0xCF);                 // IRET fallback
  }
  return { handlers, romBytes: new Uint8Array(rom) };
}

/**
 * Emit INT 20h (halt) handler.
 * Sets halt flag to 1. Single μop, retires immediately.
 */
export function emitINT20h(dispatch) {
  dispatch.addEntry('halt', BIOS_OPCODE,
    `if(style(--q1: ${ROUTINE_IDS.INT_20H}): 1; else: var(--__1halt))`,
    `INT 20h: set halt`, 0);
}

/**
 * Register all BIOS handler emitters with the dispatch table.
 */
export function emitAllBiosHandlers(dispatch) {
  emitINT20h(dispatch);
  // INT 09h, 10h, 16h, 1Ah added in subsequent tasks
}
```

- [ ] **Step 2: Wire into emit-css.mjs**

Add import at top of emit-css.mjs:

```javascript
import { emitAllBiosHandlers, buildBiosRom, BIOS_OPCODE } from './patterns/bios.mjs';
```

In the `emitCSS` function, after `emitIRQSentinel(dispatch)` (around line 297), add:

```javascript
  emitAllBiosHandlers(dispatch);
```

- [ ] **Step 3: Update generate-hacky.mjs to use BIOS ROM from bios.mjs**

The generator needs to place the sentinel bytes in ROM and set up the IVT to point to them. This replaces the gossamer.bin loading for BIOS-handled interrupts.

Read `transpiler/generate-hacky.mjs` to understand how it currently loads gossamer.bin and sets up the IVT, then modify to use `buildBiosRom()` for the BIOS handler entries.

- [ ] **Step 4: Test with a minimal halt program**

Create a trivial test: `org 0x100 / int 0x20`. Verify the reference emulator halts (via int_handler) and the CSS halts (via BIOS sentinel dispatch on opcode 214).

```bash
echo -e '\xCD\x20' > tests/halt-test.com
node transpiler/generate-hacky.mjs tests/halt-test.com --mem 1536 -o tests/halt-test.css
node tools/compare.mjs tests/halt-test.com build/gossamer.bin tests/halt-test.css --ticks=50
```

Expected: ALL INSTRUCTIONS MATCH (program executes INT 0x20, CSS sentinel fires, halt flag set).

- [ ] **Step 5: Commit**

```bash
git add transpiler/src/patterns/bios.mjs transpiler/src/emit-css.mjs transpiler/generate-hacky.mjs
git commit -m "feat: BIOS microcode scaffold with INT 20h handler

BIOS handlers use opcode 0xD6 (separate from IRQ sentinel 0xF1).
ROM layout: [0xD6, routineID, 0xCF]. INT 20h sets halt flag.
buildBiosRom() generates ROM bytes and IVT entries."
```

---

## Task 8: BIOS Microcode — INT 09h (Keyboard → BDA Buffer)

Implement the INT 09h handler as a μop sequence: read scancode/ASCII from `--keyboard`, stuff into BDA ring buffer, send EOI.

**Files:**
- Modify: `transpiler/src/patterns/bios.mjs`

- [ ] **Step 1: Add emitINT09h to bios.mjs**

The INT 09h handler needs these μops:
- μop 0: Check `--_kbdScancode`. If 0 (key release), skip to EOI. Otherwise continue.
- μop 1: Read BDA tail pointer from 0x041C. Write `--_kbdAscii` at BDA+tail.
- μop 2: Write `--_kbdScancode` at BDA+tail+1.
- μop 3: Compute new tail (tail+2, wrap at 0x3E→0x1E), write to 0x041C.
- μop 4: EOI — clear lowest in-service bit in picInService. Retire.

The "skip to EOI on release" uses a conditional uOp advance: when `_kbdScancode == 0`, μop 0 jumps to the EOI μop.

```javascript
export function emitINT09h(dispatch) {
  const OP = BIOS_OPCODE;  // 214
  const RID = ROUTINE_IDS.INT_09H;  // 0x09

  // All entries are conditional on q1 == RID (this is the INT 09h handler).
  // The dispatch already keys on opcode; we add q1 checks inside expressions.

  // BDA addresses (linear)
  const BDA_TAIL_LO = 0x041C;
  const BDA_TAIL_HI = 0x041D;
  const BDA_HEAD_LO = 0x041A;
  const BDA_HEAD_HI = 0x041B;
  const KBD_BUF_START = 0x1E;
  const KBD_BUF_END = 0x3E;

  // Read BDA tail as a 2-byte value: need --read2 or two --readMem calls.
  // tail = readMem(0x041C) | (readMem(0x041D) << 8)
  const tail = `calc(--readMem(${BDA_TAIL_LO}) + --readMem(${BDA_TAIL_HI}) * 256)`;
  // BDA base + tail = 0x0400 + tail_offset
  const bufAddr = `calc(1024 + ${tail})`;

  // μop 0: write ASCII byte at BDA+tail (if scancode != 0)
  // If key release (scancode == 0), this write is harmless — we skip to EOI via uOp advance.
  dispatch.addMemWrite(OP,
    bufAddr,
    `var(--_kbdAscii)`,
    `INT 09h: write ASCII to BDA buffer`, 0);

  // μop 1: write scancode byte at BDA+tail+1
  dispatch.addMemWrite(OP,
    `calc(${bufAddr} + 1)`,
    `var(--_kbdScancode)`,
    `INT 09h: write scancode to BDA buffer`, 1);

  // μop 2: compute new tail, write tail pointer lo byte
  // newTail = tail + 2. If >= KBD_BUF_END (0x3E), wrap to KBD_BUF_START (0x1E).
  // In CSS: newTail = if(tail + 2 >= 0x3E, 0x1E, tail + 2)
  //       = if(tail >= 0x3C, 0x1E, tail + 2)
  const newTail = `if(style(--_kbdBufFull: 1): ${KBD_BUF_START}; else: calc(${tail} + 2))`;
  // _kbdBufFull: computed property — 1 when tail + 2 >= KBD_BUF_END
  // We'll need to emit this as a computed property. For now, use inline:
  // Actually, we can use: min(1, max(0, sign(tail + 2 - KBD_BUF_END + 1)))
  // When tail + 2 >= 0x3E: sign(tail + 2 - 0x3E + 1) = sign(tail - 0x3B) >= 0 if tail >= 0x3C
  // Simpler: just do the arithmetic. newTail = mod(tail + 2 - 0x1E, 0x20) + 0x1E
  // Buffer size = 0x3E - 0x1E = 0x20 = 32 bytes. mod(tail + 2 - 0x1E, 32) + 0x1E
  const newTailExpr = `calc(mod(${tail} + 2 - ${KBD_BUF_START}, ${KBD_BUF_END - KBD_BUF_START}) + ${KBD_BUF_START})`;
  dispatch.addMemWrite(OP,
    `${BDA_TAIL_LO}`,
    `--lowerBytes(${newTailExpr}, 8)`,
    `INT 09h: write new tail lo`, 2);

  // μop 3: write tail pointer hi byte
  dispatch.addMemWrite(OP,
    `${BDA_TAIL_HI}`,
    `--rightShift(${newTailExpr}, 8)`,
    `INT 09h: write new tail hi`, 3);

  // μop 4: EOI — clear lowest in-service bit
  dispatch.addEntry('picInService', OP,
    `if(style(--q1: ${RID}) and style(--__1uOp: 4): --and(var(--__1picInService), --not(--pow2(--lowestBit(var(--__1picInService))))); else: var(--__1picInService))`,
    `INT 09h: EOI`, 4);

  // Custom uOp advance: skip μops 0-3 on key release (scancode == 0)
  // Normal: 0→1→2→3→4→0
  // Key release: 0→4→0 (skip buffer insert)
  dispatch.setCustomUopAdvance(OP,
    `if(style(--q1: ${RID}): if(` +
    `  style(--__1uOp: 0): if(style(--_kbdScancode: 0): 4; else: 1);` +  // release → skip to EOI
    `  style(--__1uOp: 1): 2;` +
    `  style(--__1uOp: 2): 3;` +
    `  style(--__1uOp: 3): 4;` +
    `  style(--__1uOp: 4): 0;` +
    `else: 0);` +
    `else: 0)`
  );
}
```

Wait — this won't work. The dispatch `addEntry` for `picInService` would conflict with the IRQ sentinel's entries (which also write `picInService` at opcode 241). But BIOS uses opcode 214, so there's no conflict. Good.

However, there's a problem with `setCustomUopAdvance` — this sets the advance for the entire opcode 214, but multiple BIOS handlers share the same opcode. The uOp advance needs to dispatch on `--q1` (routine ID) to select the right advance for each handler. This means the custom advance must be a single expression that covers all BIOS handlers.

The `setCustomUopAdvance` API takes one expression per opcode. We'll need to build a combined expression that dispatches on `--q1` first, then on `--__1uOp`.

Revised approach: instead of each handler calling `setCustomUopAdvance`, have `emitAllBiosHandlers` build the combined advance expression and set it once.

Actually, let me check if `setCustomUopAdvance` exists:

```javascript
// From emit-css.mjs DispatchTable class:
this.customUopAdvance = new Map(); // opcode → CSS expression
```

Yes, it exists. One expression per opcode. For opcode 214, we need one big expression covering all BIOS handlers. I'll structure this in `emitAllBiosHandlers`.

This task is getting complex. Let me simplify: start with just INT 20h (which is single-cycle, no custom uOp advance needed), verify the plumbing works, then add INT 09h in the next task.

Actually, INT 20h is already in Task 7. Let me restructure: Task 8 adds INT 09h, and the uOp advance problem is addressed there.

```javascript
export function emitINT09h(dispatch) {
  const OP = BIOS_OPCODE;  // 214
  const RID = ROUTINE_IDS.INT_09H;

  // Helper: wrap expression in routine ID guard
  const guard = (expr, fallback) =>
    `if(style(--q1: ${RID}): ${expr}; else: ${fallback})`;

  // BDA tail pointer (2-byte read)
  const tail = `calc(--readMem(1052) + --readMem(1053) * 256)`;
  const bufAddr = `calc(1024 + ${tail})`;
  const newTail = `calc(mod(${tail} + 2 - 30, 32) + 30)`;  // wrap within [0x1E, 0x3E)

  // μop 0: write ASCII at BDA+tail
  dispatch.addMemWrite(OP, bufAddr, `var(--_kbdAscii)`, `INT 09h: ASCII→BDA`, 0);

  // μop 1: write scancode at BDA+tail+1
  dispatch.addMemWrite(OP, `calc(${bufAddr} + 1)`, `var(--_kbdScancode)`, `INT 09h: scan→BDA`, 1);

  // μop 2: write new tail lo
  dispatch.addMemWrite(OP, `1052`, `--lowerBytes(${newTail}, 8)`, `INT 09h: tail lo`, 2);

  // μop 3: write new tail hi
  dispatch.addMemWrite(OP, `1053`, `--rightShift(${newTail}, 8)`, `INT 09h: tail hi`, 3);

  // μop 4: EOI (clear lowest in-service bit)
  dispatch.addEntry('picInService', OP,
    guard(
      `--and(var(--__1picInService), --not(--pow2(--lowestBit(var(--__1picInService)))))`,
      `var(--__1picInService)`
    ),
    `INT 09h: EOI`, 4);
}
```

Hmm, but the `addMemWrite` and `addEntry` calls can't share a `(opcode, uOp)` slot across different BIOS handlers. INT 09h μop 0 writes to one address; INT 10h μop 0 writes to a different address. Both use opcode 214 μop 0. The dispatch has one `--memAddr` and one `--memVal` per `(opcode, uOp)` — they'd collide.

This is the same fundamental problem as the opcode conflict, but at the sub-dispatch level. Each BIOS handler needs its own μop sequence, but they all share opcode 214.

The solution: the memory write expressions must include `--q1` guards. Instead of a flat `addrExpr`, we need `if(style(--q1: 9): int09_addr; style(--q1: 16): int10_addr; ...)`.

This means we can't use `addMemWrite` directly — it throws on duplicate `(opcode, uOp)`. We need a mechanism for BIOS handlers to share the same opcode+uOp slot with q1-guarded expressions.

This is starting to look like it needs a different dispatch mechanism for BIOS handlers. Rather than trying to shoe-horn everything into the existing addEntry/addMemWrite API, we should probably emit the BIOS handler dispatch as a standalone computed property block (like PIT and irqActive are), bypassing the dispatch table entirely.

Let me reconsider the whole approach and write it up properly. The plan file has gotten messy with the false starts. Let me rewrite it cleanly from Task 7 onward.

- [ ] **Step 1: Implement INT 09h emitter (see above for detailed code)**

The exact CSS expressions involve reading BDA tail pointer via `--readMem`, computing buffer address, writing scancode/ASCII, advancing tail with wrap, and sending EOI. The conditional skip-to-EOI on key release uses the custom uOp advance mechanism.

**Note:** Multiple BIOS handlers sharing opcode 214 need q1-guarded expressions in their memory write slots. This is handled by building composite expressions in `emitAllBiosHandlers` that dispatch on `--q1` first. Implementation detail to be resolved at coding time — the structure above captures the μop semantics correctly.

- [ ] **Step 2: Register in emitAllBiosHandlers**

```javascript
export function emitAllBiosHandlers(dispatch) {
  emitINT20h(dispatch);
  emitINT09h(dispatch);
}
```

- [ ] **Step 3: Test with keyboard-irq.asm**

```bash
node transpiler/generate-hacky.mjs tests/keyboard-irq.com --mem 1536 -o tests/keyboard-irq.css
node tools/compare.mjs tests/keyboard-irq.com build/gossamer.bin tests/keyboard-irq.css --ticks=200 --key-events=50:0x1E61,100:0
```

Expected: Reference trace shows key delivered, CSS matches.

- [ ] **Step 4: Commit**

```bash
git add transpiler/src/patterns/bios.mjs
git commit -m "feat: INT 09h BIOS microcode handler

Keyboard IRQ → BDA ring buffer insert. Reads scancode/ASCII from
--keyboard computed properties, advances tail with wrap, sends EOI.
Key release (scancode=0) skips buffer insert."
```

---

## Task 9: BIOS Microcode — INT 16h (Keyboard Read)

Implement INT 16h AH=00h (blocking read) and AH=01h (non-blocking peek). AH=00h uses the μop 0 hold mechanism; AH=01h folds IRET into its retirement to set ZF correctly.

**Files:**
- Modify: `transpiler/src/patterns/bios.mjs`

- [ ] **Step 1: Add emitINT16h**

AH=00h μops:
- 0: Compare BDA head vs tail. If equal, hold (don't advance uOp). If different, advance.
- 1: Read key word from BDA[head]. Set AX.
- 2: Advance head pointer (head+2, wrap). Write new head to BDA.
- 3-5: Folded IRET: pop IP, pop CS, pop FLAGS+SP+=6. Retire.

AH=01h μops:
- 0: Compare head vs tail. Set AX (peek or unchanged). Compute ZF.
- 1-3: Folded IRET with merged FLAGS (ZF from μop 0). Retire.

The AH dispatch adds another dimension: `style(--AH: 0)` vs `style(--AH: 1)`.

- [ ] **Step 2: Test AH=00h with keyboard-irq.asm**

Same test as Task 8 — the program uses INT 16h AH=00h.

- [ ] **Step 3: Write an AH=01h test**

```nasm
; keyboard-peek.asm — Test INT 16h AH=01h (non-blocking peek)
org 0x100
    sti
    in al, 0x21
    and al, 0xFD
    out 0x21, al

    ; Peek — should set ZF (no key yet)
    mov ah, 0x01
    int 0x16
    jnz .has_key    ; should NOT jump
    ; ZF was set — good. Now wait for a key to arrive...
    ; (key injected at cycle 50)

.wait:
    mov ah, 0x01
    int 0x16
    jz .wait        ; loop until key available

.has_key:
    ; Key available — read it
    mov ah, 0x00
    int 0x16
    mov [result], ax
    int 0x20

result: dw 0
```

- [ ] **Step 4: Commit**

```bash
git add transpiler/src/patterns/bios.mjs tests/keyboard-peek.asm tests/keyboard-peek.com
git commit -m "feat: INT 16h BIOS microcode handler

AH=00h blocks at μop 0 until BDA buffer non-empty (interruptible hold).
AH=01h peeks buffer, sets ZF via folded IRET."
```

---

## Task 10: BIOS Microcode — INT 10h (Video) and Trivial Handlers

Implement INT 10h (AH=0Eh teletype first, then other subfunctions) and the trivial handlers (INT 1Ah, INT 20h already done).

**Files:**
- Modify: `transpiler/src/patterns/bios.mjs`

- [ ] **Step 1: Add emitINT10h — AH=0Eh (teletype output)**

This is the most complex handler. μop sequence:
- Read cursor position from BDA (0x0450/0x0451)
- Handle special characters (CR, LF, BS, BEL)
- For printable chars: compute VGA offset, write char+attr, advance cursor
- On line wrap or LF at row 24: scroll (sub-sequence of ~4000 μops)

Start with printable character output only (no scroll). Scroll can be added as a follow-up.

- [ ] **Step 2: Add AH=00h (set mode), AH=02h (set cursor), AH=03h (get cursor), AH=0Fh (get mode)**

These are 2-3 μop handlers each. Straightforward BDA reads/writes.

- [ ] **Step 3: Add emitINT1Ah — AH=00h (tick count)**

Read PIT counter. 2 μops.

- [ ] **Step 4: Test with a hello-world program that uses INT 10h AH=0Eh**

```nasm
; hello.asm — Print "HI" via INT 10h teletype, then halt
org 0x100
    mov ah, 0x0E
    mov al, 'H'
    int 0x10
    mov al, 'I'
    int 0x10
    int 0x20
```

- [ ] **Step 5: Commit**

```bash
git add transpiler/src/patterns/bios.mjs tests/hello.asm tests/hello.com
git commit -m "feat: INT 10h and INT 1Ah BIOS microcode handlers

INT 10h: teletype (AH=0Eh), set/get cursor, set/get mode.
INT 1Ah: tick count. All handlers use opcode 0xD6 dispatch."
```

---

## Task 11: HTML Template — Keyboard Buttons

Add the `<key-board>` element with `:active` button mappings to the HTML template. Each button sets `--keyboard` to `(scancode<<8)|ascii`.

**Files:**
- Modify: `transpiler/src/template.mjs` (HTML generation functions)

- [ ] **Step 1: Add keyboard HTML to emitHTMLFooter or equivalent**

```html
<key-board>
  <div>
    <button>1</button><button>2</button><button>3</button><button>4</button><button>5</button>
    <button>6</button><button>7</button><button>8</button><button>9</button><button>0</button>
  </div>
  <div>
    <button>Q</button><button>W</button><button>E</button><button>R</button><button>T</button>
    <button>Y</button><button>U</button><button>I</button><button>O</button><button>P</button>
  </div>
  <div>
    <button>A</button><button>S</button><button>D</button><button>F</button><button>G</button>
    <button>H</button><button>J</button><button>K</button><button>L</button><button>↵</button>
  </div>
  <div>
    <button>Z</button><button>X</button><button>C</button><button>V</button><button>B</button>
    <button>N</button><button>M</button><button>␣</button><button>Esc</button>
  </div>
</key-board>
```

- [ ] **Step 2: Add CSS button-to-keyboard mappings**

```css
.cpu {
  &:has(key-board button:nth-child(1):active) { --keyboard: 561; }   /* 1: scan=0x02, ascii=0x31 */
  &:has(key-board button:nth-child(2):active) { --keyboard: 816; }   /* 2: scan=0x03, ascii=0x32 */
  /* ... full mapping table for all keys ... */
}
```

The full scancode→value table uses PC scan set 1 scancodes. Build a constant array in template.mjs and emit the CSS rules from it.

- [ ] **Step 3: Commit**

```bash
git add transpiler/src/template.mjs
git commit -m "feat: HTML keyboard with :active button mappings

Each button sets --keyboard to (scancode<<8)|ascii using PC scan set 1.
Covers digits, letters A-Z, Enter, Space, Escape."
```

---

## Task 12: End-to-End Conformance Test

Run the full keyboard-irq test program through both the reference emulator and Calcite, verifying the complete path: button press → `--keyboard` → IRQ 1 → INT 09h → BDA buffer → INT 16h → program sees key.

**Files:**
- No new files — uses existing test infrastructure

- [ ] **Step 1: Generate CSS for keyboard-irq test**

```bash
node transpiler/generate-hacky.mjs tests/keyboard-irq.com --mem 1536 -o tests/keyboard-irq.css
```

- [ ] **Step 2: Run conformance comparison**

```bash
node tools/compare.mjs tests/keyboard-irq.com build/gossamer.bin tests/keyboard-irq.css --ticks=200 --key-events=50:0x1E61,100:0
```

Expected: ALL INSTRUCTIONS MATCH.

- [ ] **Step 3: Run hello-world test**

```bash
node transpiler/generate-hacky.mjs tests/hello.com --mem 1536 -o tests/hello.css
node tools/compare.mjs tests/hello.com build/gossamer.bin tests/hello.css --ticks=100
```

Expected: ALL INSTRUCTIONS MATCH. VGA text buffer at 0xB8000 contains 'H' and 'I'.

- [ ] **Step 4: Run keyboard-peek test**

```bash
C:\Users\AdmT9N0CX01V65438A\AppData\Local\bin\NASM\nasm.exe -f bin -o tests/keyboard-peek.com tests/keyboard-peek.asm
node transpiler/generate-hacky.mjs tests/keyboard-peek.com --mem 1536 -o tests/keyboard-peek.css
node tools/compare.mjs tests/keyboard-peek.com build/gossamer.bin tests/keyboard-peek.css --ticks=200 --key-events=50:0x1E61,100:0
```

Expected: ALL INSTRUCTIONS MATCH. AX=0x1E61 at halt.

- [ ] **Step 5: Commit any fixes needed, then final commit**

```bash
git add -A
git commit -m "test: Phase 5 end-to-end conformance validation

keyboard-irq, hello-world, keyboard-peek all pass conformance.
Full path validated: :active → --keyboard → IRQ 1 → INT 09h → BDA → INT 16h."
```

Option (a) is simplest: 0xF1 stays as the IRQ delivery sentinel (triggered by irqActive), 0xF2 is the BIOS handler sentinel (fetched from ROM). No dispatch conflicts. The generator places `[0xF2, routineID, 0xCF]` at each handler address (0xF2 = sentinel, routineID = which handler, 0xCF = IRET fallback).

But wait — 0xF2 is REPNE prefix on a real 8086. We can't use it if any program might legitimately use REPNE. However, 0xF2 only appears in ROM at BIOS handler addresses, never in user code. And the CSS dispatch already handles REPNE as a prefix (it modifies `--prefixLen`, not as an opcode). So if 0xF2 is fetched as an opcode (not a prefix), there's no existing handler for it — it falls through to unknown opcode. We could add it as the BIOS sentinel.

Actually, this won't work either. The prefix detection in the decode pipeline treats 0xF2 and 0xF3 as prefix bytes unconditionally — it sets `--prefixLen` and `--opcode` becomes the next byte. The BIOS 0xF2 in ROM would be consumed as a REPNE prefix, and the routine ID byte would become the opcode.

Let me reconsider. Option (c) is actually fine: BIOS entries use opcode 241 but are conditional on both `--q1` (routine ID) AND `irqActive` being 0. The IRQ sentinel entries are conditional on irqActive being 1 (or rather, they fire first in the priority chain because irqActive triggers them).

The real key: when `irqActive=1`, the opcode override forces 0xF1 regardless of what's in memory. The μop sequence is the IRQ delivery (6 μops). When `irqActive=0` and the CPU naturally fetches 0xF1 from ROM, the same opcode fires, but the IRQ sentinel entries should NOT match (because they're about IRQ delivery, not BIOS handling).

Currently, the IRQ sentinel entries are UNCONDITIONALLY keyed on opcode 241. They don't check irqActive. This means they fire for BOTH cases — which is wrong for BIOS handlers.

The fix: make IRQ sentinel entries conditional on `irqActive=1`, and BIOS handler entries conditional on `irqActive=0`. This requires the dispatch system to support conditions beyond just opcode and uOp.

This is a significant enough architectural question that it should be resolved as the first step of implementation. Let me restructure the plan.

I'm going to stop writing the plan file and flag this to you. There's a dispatch conflict that the design spec doesn't address: **the IRQ delivery sentinel (irq.mjs) and BIOS handler sentinels both use opcode 0xF1, and the current dispatch table has no way to distinguish them.**

The cleanest fix is probably option (c): add an `irqActive` condition to the dispatch entries. IRQ delivery entries match `(opcode=241, irqActive=1, uOp=N)`. BIOS handler entries match `(opcode=241, irqActive=0, q1=routineID, uOp=N)`. But this requires extending the dispatch system to support an extra condition dimension.

Should I fold this into the plan as Task 7 (resolve the dispatch conflict first, then build on it), or do you want to discuss the approach?