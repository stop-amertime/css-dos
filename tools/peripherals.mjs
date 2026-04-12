// Phase 3: JS peripheral chip implementations for CSS-DOS
//
// These plug into js8086.js's peripheral interface:
//   isConnected(port), portIn(w, port), portOut(w, port, val)
// PIC and PIT also need: hasInt(), nextInt(), tick(), raiseIRQ(n)

// --- i8259 PIC (Programmable Interrupt Controller) ---

export class PIC {
  constructor() {
    this.mask = 0xFF;      // IMR: all masked initially
    this.pending = 0;      // IRR: pending interrupt requests
    this.inService = 0;    // ISR: currently being serviced
  }

  isConnected(port) {
    return port === 0x20 || port === 0x21;
  }

  portOut(w, port, val) {
    if (port === 0x20) {
      // Command register
      if (val === 0x20) {
        // Non-specific EOI: clear highest-priority in-service bit
        for (let i = 0; i < 8; i++) {
          if (this.inService & (1 << i)) {
            this.inService &= ~(1 << i);
            break;
          }
        }
      }
      // ICW1-4 and other OCWs ignored for now
    } else if (port === 0x21) {
      // Data register: set interrupt mask
      this.mask = val & 0xFF;
    }
  }

  portIn(w, port) {
    if (port === 0x21) {
      return this.mask;
    }
    if (port === 0x20) {
      return this.inService;
    }
    return 0;
  }

  raiseIRQ(n) {
    this.pending |= (1 << n);
  }

  hasInt() {
    // Unmasked pending bit with no higher-priority in-service
    for (let i = 0; i < 8; i++) {
      if (this.inService & (1 << i)) {
        // Higher-priority IRQ is in service; block lower
        return false;
      }
      if ((this.pending & (1 << i)) && !(this.mask & (1 << i))) {
        return true;
      }
    }
    return false;
  }

  nextInt() {
    for (let i = 0; i < 8; i++) {
      if (this.inService & (1 << i)) {
        return 0;
      }
      if ((this.pending & (1 << i)) && !(this.mask & (1 << i))) {
        this.pending &= ~(1 << i);
        this.inService |= (1 << i);
        return 0x08 + i;  // IRQ N → INT 08h+N
      }
    }
    return 0;
  }

  tick() {
    // PIC has no periodic tick behavior
  }
}

// --- i8253 PIT (Programmable Interval Timer) ---

export class PIT {
  constructor(pic) {
    this.pic = pic;
    this.channels = [];
    for (let i = 0; i < 3; i++) {
      this.channels.push({
        counter: 0,
        reload: 0,
        mode: 0,
        latched: false,
        latchValue: 0,
        rwMode: 3,       // 3 = lo/hi byte sequencing
        readState: 0,    // 0 = lo byte next, 1 = hi byte next
        writeState: 0,   // 0 = lo byte next, 1 = hi byte next
      });
    }
  }

  isConnected(port) {
    return port >= 0x40 && port <= 0x43;
  }

  portOut(w, port, val) {
    if (port === 0x43) {
      // Control word
      const ch = (val >> 6) & 3;
      if (ch === 3) return; // Read-back (not needed)
      const rw = (val >> 4) & 3;
      const mode = (val >> 1) & 7;
      const channel = this.channels[ch];

      if (rw === 0) {
        // Counter latch command
        if (!channel.latched) {
          channel.latched = true;
          channel.latchValue = channel.counter;
        }
        return;
      }

      channel.mode = mode;
      channel.rwMode = rw;
      channel.writeState = 0;
      channel.readState = 0;
      channel.counter = 0;
      channel.reload = 0;
    } else {
      // Data port 0x40-0x42: load reload value
      const ch = port - 0x40;
      if (ch < 0 || ch > 2) return;
      const channel = this.channels[ch];

      if (channel.rwMode === 1) {
        // Low byte only
        channel.reload = val & 0xFF;
        channel.counter = channel.reload;
      } else if (channel.rwMode === 2) {
        // High byte only
        channel.reload = (val & 0xFF) << 8;
        channel.counter = channel.reload;
      } else {
        // Lo/hi sequencing (rwMode === 3)
        if (channel.writeState === 0) {
          channel.reload = (channel.reload & 0xFF00) | (val & 0xFF);
          channel.writeState = 1;
        } else {
          channel.reload = (channel.reload & 0x00FF) | ((val & 0xFF) << 8);
          channel.writeState = 0;
          channel.counter = channel.reload;
        }
      }
    }
  }

  portIn(w, port) {
    const ch = port - 0x40;
    if (ch < 0 || ch > 2) return 0;
    const channel = this.channels[ch];

    let value;
    if (channel.latched) {
      value = channel.latchValue;
    } else {
      value = channel.counter;
    }

    if (channel.rwMode === 1) {
      // Low byte only
      channel.latched = false;
      return value & 0xFF;
    } else if (channel.rwMode === 2) {
      // High byte only
      channel.latched = false;
      return (value >> 8) & 0xFF;
    } else {
      // Lo/hi sequencing
      if (channel.readState === 0) {
        channel.readState = 1;
        return value & 0xFF;
      } else {
        channel.readState = 0;
        channel.latched = false;
        return (value >> 8) & 0xFF;
      }
    }
  }

  tick() {
    for (let ch = 0; ch < 3; ch++) {
      const channel = this.channels[ch];
      if (channel.reload === 0) continue;

      if (channel.mode === 2) {
        // Rate generator: count down, fire on reaching 1, reload
        channel.counter--;
        if (channel.counter <= 0) {
          channel.counter = channel.reload;
          if (ch === 0) this.pic.raiseIRQ(0);
        }
      } else if (channel.mode === 3) {
        // Square wave: count down by 2, fire on reaching 0, reload
        channel.counter -= 2;
        if (channel.counter <= 0) {
          channel.counter = channel.reload;
          if (ch === 0) this.pic.raiseIRQ(0);
        }
      }
    }
  }
}

// --- Keyboard Controller ---

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
