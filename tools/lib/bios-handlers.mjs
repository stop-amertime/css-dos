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
 * @param {Function} getRegs - returns {ah, al, ax, bx, cx, dx, si, di, sp, bp, cs, ds, es, ss, ip, flags}
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
      const cursorRow = memory[BDA_BASE + 0x51];
      const cursorCol = memory[BDA_BASE + 0x50];
      const cols = 80;

      if (ch === 0x0D) {
        memory[BDA_BASE + 0x50] = 0;
      } else if (ch === 0x0A) {
        if (cursorRow < 24) {
          memory[BDA_BASE + 0x51] = cursorRow + 1;
        } else {
          // Scroll up
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
      } else if (ch === 0x08) {
        if (cursorCol > 0) {
          memory[BDA_BASE + 0x50] = cursorCol - 1;
        }
      } else if (ch === 0x07) {
        // BEL: ignore
      } else {
        // Printable character
        const offset = (cursorRow * cols + cursorCol) * 2;
        memory[0xB8000 + offset] = ch;
        memory[0xB8000 + offset + 1] = 0x07;

        let newCol = cursorCol + 1;
        if (newCol >= cols) {
          newCol = 0;
          if (cursorRow < 24) {
            memory[BDA_BASE + 0x51] = cursorRow + 1;
          } else {
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
      memory[BDA_BASE + 0x51] = regs.dh;
      memory[BDA_BASE + 0x50] = regs.dl;
      return true;
    }
    if (regs.ah === 0x03) {
      setRegs({ dh: memory[BDA_BASE + 0x51], dl: memory[BDA_BASE + 0x50], cx: 0 });
      return true;
    }
    if (regs.ah === 0x0F) {
      setRegs({
        al: memory[BDA_BASE + 0x49],
        ah: memory[BDA_BASE + 0x4A],
        bh: 0,
      });
      return true;
    }
    if (regs.ah === 0x00) {
      memory[BDA_BASE + 0x49] = regs.al;
      memory[BDA_BASE + 0x4A] = (regs.al === 0x13) ? 40 : 80;
      memory[BDA_BASE + 0x50] = 0;
      memory[BDA_BASE + 0x51] = 0;
      if (regs.al === 0x13) {
        for (let i = 0; i < 64000; i++) memory[0xA0000 + i] = 0;
      } else {
        for (let i = 0; i < 4000; i += 2) {
          memory[0xB8000 + i] = 0x20;
          memory[0xB8000 + i + 1] = 0x07;
        }
      }
      return true;
    }
    if (regs.ah === 0x06) {
      const lines = regs.al || 25;
      const attr = regs.bh;
      const top = (regs.cx >> 8) & 0xFF;
      const left = regs.cx & 0xFF;
      const bottom = (regs.dx >> 8) & 0xFF;
      const right = regs.dx & 0xFF;
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
      setRegs({ cx: 0, dx: 0, al: 0 });
      return true;
    }
    return false;
  }

  function int20h() {
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
