# Phase 5: BIOS Handlers — Design Delta

**Date:** 2026-04-12  
**Base spec:** V3-PLAN-1.md, Phase 5 section (lines 408-429) and "BIOS as microcode" section (lines 212-249)  
**Scope:** INT 09h (keyboard), INT 10h (video), INT 16h (keyboard read), INT 1Ah (timer), INT 20h (halt). INT 21h excluded — provided by the DOS kernel when booting EDR-DOS.

This document covers only what V3-PLAN-1.md does not already specify. The microcode sentinel approach, JS `int_handler` hook, and IVT layout are defined there and not repeated here.

**Revision 2 (2026-04-12):** Fixes for issues found during review. See Appendix A for full issue list and resolutions.

**Revision 3 (2026-04-12):** Port 0x60 returns scancode (not ASCII) for Doom compatibility. Replaced irqNum latch with _irqEffective in-service priority fix. Folded IRET into handler retirement for INT 16h AH=01h.

**Revision 4 (2026-04-12):** BIOS handlers use opcode 0xD6 (214, undocumented SALC on real 8086), not 0xF1. This avoids dispatch conflicts with the IRQ delivery sentinel (which uses 0xF1). ROM layout: `[0xD6, routineID, 0xCF]`.

## Terminology

Per V3-PLAN-1.md line 33: one CSS evaluation step is a **cycle** (was "tick" in v2). This spec uses "cycle" throughout.

---

## 1. Keyboard Input: `:active` → IRQ 1 → INT 09h → BDA Buffer

### 1.1 HTML Buttons

The HTML template includes a `<key-board>` element with `<button>` elements for each key. CSS selectors on the `.cpu` ancestor detect button presses via `:active` (not `:hover:active` — `:hover` sticks on touch devices) and set `--keyboard`:

```css
.cpu {
  &:has(key-board button:nth-child(1):active) { --keyboard: 4656; }
  /* 4656 = 0x1230 = scancode 0x12 (E), ascii 0x30 ('0') — example */
}
```

Each button maps to a `(scancode << 8) | ascii` word. When no button is pressed, `--keyboard` is 0 (its initial value from `@property`).

Button-to-value mapping uses real PC scan set 1 scancodes in the high byte and ASCII in the low byte. Example mappings:

| Button | Scancode | ASCII | `--keyboard` value |
|--------|----------|-------|-------------------|
| A | 0x1E | 0x61 | 0x1E61 (7777) |
| Enter | 0x1C | 0x0D | 0x1C0D (7181) |
| Space | 0x39 | 0x20 | 0x3920 (14624) |
| 1 | 0x02 | 0x31 | 0x0231 (561) |

Full mapping table to be defined at implementation time, covering the same key set as the legacy template (digits 0-9, letters A-Z, Enter, Space, Escape, arrow keys).

### 1.2 Edge Detection: `kbdLast` and `_kbdChanged`

**New state var:** `kbdLast` (init 0, debug false) added to `STATE_VARS` in template.mjs. Double-buffered like all state vars.

**Computed properties:**

```css
/* Only update kbdLast at instruction boundaries to avoid re-triggering mid-instruction */
--kbdLast: if(style(--__1uOp: 0): var(--keyboard); else: var(--__1kbdLast));

/* Detect any change: max(a,b) - min(a,b) gives absolute difference without abs() */
--_kbdChanged: if(style(--__1uOp: 0):
  min(1, max(0, sign(calc(
    max(var(--keyboard), var(--__1kbdLast)) - min(var(--keyboard), var(--__1kbdLast))
  ))));
else: 0);
```

`_kbdChanged` is 1 when `--keyboard` differs from its value at the previous instruction boundary (key pressed or released), 0 otherwise.

**Known limitation:** If a key is pressed and released entirely within a single multi-cycle instruction (e.g., a long REP MOVSB), the press is lost — both `kbdLast` and `--keyboard` will be 0 at the next instruction boundary. In practice this is negligible: even a fast REP MOVSB with CX=1000 takes ~13,000 cycles, which is ~13ms in Calcite, while the shortest human keypress is ~50-100ms.

### 1.3 IRQ 1 Firing

When `_kbdChanged` is 1, set bit 1 of `picPending` (IRQ 1). The `picPending` expression in emit-css.mjs becomes:

```css
--picPending: --or(--or(var(--__1picPending), var(--_pitFired)), calc(var(--_kbdChanged) * 2));
```

This merges three IRQ sources:
- Carry-forward from previous cycle (`__1picPending`)
- PIT timer crossing zero (`_pitFired`, bit 0)
- Keyboard change (`_kbdChanged`, bit 1)

The existing IRQ injection mechanism (Phase 4) handles the rest: at the next instruction boundary with IF=1 and IRQ 1 unmasked, `irqActive` goes to 1, the sentinel fires, and the CPU vectors through IVT[9] to the INT 09h handler.

### 1.4 Port 0x60: What Programs Read

`IN AL, 0x60` returns the **scancode** — the high byte of `--keyboard` (`scancode<<8|ascii` >> 8).

This matches real PC hardware, where port 0x60 returns raw make/break scancodes. Programs that hook INT 09h and read port 0x60 directly (Doom, Wolf3D, most id Software games, many others) will see correct scancodes.

Key release (`--keyboard` returns to 0) fires IRQ 1 but the handler sees scancode 0 from port 0x60 and skips the buffer insert.

### 1.5 ASCII Lookup: `--kbdAscii` Computed Property

On a real PC, the BIOS INT 09h handler translates scancodes to ASCII via a ROM lookup table. A full lookup table in CSS microcode is impractical (~100+ entries). Since `--keyboard` already contains the pre-computed `(scancode<<8)|ascii` pair from the HTML button mapping, the INT 09h microcode handler reads the ASCII byte directly from the low byte of `--keyboard` via a computed property:

```css
--_kbdAscii: --lowerBytes(var(--keyboard), 8);
--_kbdScancode: --rightShift(var(--keyboard), 8);
```

The INT 09h handler stuffs both `--_kbdScancode` and `--_kbdAscii` into the BDA ring buffer. This is invisible to programs — they see correct scancodes on port 0x60 and correct (scancode, ASCII) pairs from INT 16h.

The JS `KeyboardController.portIn` must also be updated to return the scancode (high byte) for `IN AL, 0x60`.

---

## 2. INT 09h Microcode Handler

### 2.1 JS Side (`int_handler` hook)

```javascript
// BDA keyboard buffer constants (standard PC layout).
// The buffer lives at BDA offsets 0x1E-0x3D (16 words = 32 bytes).
// Head/tail pointers at 0x1A/0x1C are offsets relative to segment 0x0040.
const KBD_BUF_START = 0x001E;  // BDA offset of first buffer word
const KBD_BUF_END   = 0x003E;  // BDA offset past last buffer word
const BDA_BASE      = 0x0400;  // Linear address of BDA segment 0x0040

function int09h(cpu) {
  // kbd.currentWord holds the full (scancode<<8)|ascii from feedKey().
  // Port 0x60 returns just the scancode (high byte), matching real HW.
  const scancode = kbd.portIn(0, 0x60);  // byte read = scancode
  if (scancode === 0) {
    // Key release — send EOI, do nothing else
    pic.portOut(0, 0x20, 0x20);
    return true;
  }
  const ascii = kbd.currentWord & 0xFF;  // ASCII from pre-computed pair
  const keyWord = (scancode << 8) | ascii;

  // Read BDA ring buffer pointers
  const tail = memory[BDA_BASE + 0x1C] | (memory[BDA_BASE + 0x1D] << 8);
  const head = memory[BDA_BASE + 0x1A] | (memory[BDA_BASE + 0x1B] << 8);

  // Advance tail (hardcoded buffer range — not reading 0x0480/0x0482)
  let newTail = tail + 2;
  if (newTail >= KBD_BUF_END) newTail = KBD_BUF_START;

  // If buffer not full, insert key word
  if (newTail !== head) {
    memory[BDA_BASE + tail] = ascii;
    memory[BDA_BASE + tail + 1] = scancode;
    memory[BDA_BASE + 0x1C] = newTail & 0xFF;
    memory[BDA_BASE + 0x1D] = (newTail >> 8) & 0xFF;
  }

  // EOI
  pic.portOut(0, 0x20, 0x20);
  return true;  // handled
}
```

### 2.2 CSS Side (Microcode μop Sequence)

The BIOS sentinel opcode (0xD6) followed by routine ID for INT 09h. The μop sequence:

| μop | Action |
|-----|--------|
| 0 | Check `--_kbdScancode`. If 0 (key release), skip to EOI μop. |
| 1 | Read BDA tail pointer from 0x041C (2 bytes) |
| 2 | Write `--_kbdAscii` at BDA+tail |
| 3 | Write `--_kbdScancode` at BDA+tail+1 |
| 4 | Compute new tail (tail+2, wrap if >= bufEnd), write to 0x041C |
| 5 | EOI: write 0x20 to picInService (clear lowest in-service bit). Retire. |

The "skip to EOI on key release" is a conditional: if `--_kbdScancode == 0`, μop 0 jumps directly to the EOI μop. This uses the same conditional advance pattern as REP (conditional μop transitions).

Buffer-full check (newTail == head): compared at μop 4. If full, skip the tail pointer update (drop the key).

Exact CSS expressions to be determined at implementation time — the μop structure is what matters for the spec.

---

## 3. INT 16h: Keyboard Read

### 3.1 Existing State

gossamer-dos.asm already implements INT 16h correctly using the BDA ring buffer (AH=00h blocks until head != tail, AH=01h peeks with ZF). This handler runs as real 8086 code on the CPU.

### 3.2 Decision: Microcode or Assembly?

INT 16h AH=00h has a **spin loop** (`je .key_wait` when buffer is empty). As real 8086 code, this loop executes CMP + JE repeatedly, consuming cycles while waiting for a key. Each iteration goes through the full CPU decode pipeline.

As microcode, the spin can be a single μop that holds (doesn't advance) until the BDA buffer is non-empty. This is dramatically more efficient under JIT — one property evaluation per cycle instead of full instruction decode.

**Decision: microcode.** The blocking spin is the hottest path for any interactive program.

### 3.3 Microcode μop Sequence

**AH=00h (read key, blocking):**

| μop | Action |
|-----|--------|
| 0 | Compare BDA head vs tail. If equal (empty), hold at μop 0 (don't advance). If different, advance to μop 1. |
| 1 | Read key word from BDA[head]. Set AX = key word. |
| 2 | Advance head pointer (head+2, wrap). Write new head to BDA 0x041A. |
| 3 | Pop IP from stack (SS:SP). |
| 4 | Pop CS from stack (SS:SP+2). |
| 5 | Pop FLAGS from stack (SS:SP+4). SP += 6. Retire. |

The μop 0 hold is the key optimization: while the buffer is empty, the CPU stays at μop 0 of the sentinel, evaluating one cheap comparison per cycle. IRQs can still fire at the μop 0 boundary (irqActive checks happen at instruction boundaries, and μop 0 is an instruction boundary for the sentinel).

Wait — that's a subtlety. The sentinel's μop 0 hold needs to allow IRQ injection. Otherwise the keyboard IRQ can never fire while INT 16h is waiting, creating a deadlock. The irqActive check must treat "sentinel holding at μop 0" as an instruction boundary.

**AH=01h (check key, non-blocking):**

| μop | Action |
|-----|--------|
| 0 | Compare BDA head vs tail. Set AX (key word or unchanged) and compute FLAGS with ZF set/cleared. |
| 1 | Pop IP from stack (SS:SP). |
| 2 | Pop CS from stack (SS:SP+2). |
| 3 | Pop stacked FLAGS from stack (SS:SP+4), OR/AND in ZF from μop 0's result. SP += 6. Retire. |

**Folded IRET:** The handler performs IRET inline as its last μops, which lets it merge the caller's stacked FLAGS with the ZF result. This avoids a separate IRET instruction and eliminates the FLAGS-on-stack write-back problem. The handler reads the stacked FLAGS at μop 3, sets or clears bit 6 (ZF), and writes the merged value to `--flags`. Since the handler retires at μop 3 (not at an IRET instruction), IP is set directly to the popped return address.

**AH=00h also folds IRET:** For consistency, AH=00h's retirement μops also perform the IRET inline (pop IP, pop CS, pop FLAGS, SP += 6). This means the IRET byte in ROM after the sentinel+ID is never reached for INT 16h — but it should still be present as a safety fallback for other code paths.

### 3.4 The Deadlock Problem

INT 16h AH=00h blocks until a key arrives. The key arrives via IRQ 1 → INT 09h. But IRQ injection only happens at instruction retirement boundaries (`--__1uOp: 0`).

If the sentinel's μop 0 hold is treated as "mid-instruction" (uOp != retirement), IRQs are blocked and INT 16h deadlocks.

**Solution:** Since BIOS handlers use opcode 0xD6 (214) — separate from the IRQ delivery sentinel at 0xF1 (241) — the irqActive logic needs rules for both opcodes. The IRQ delivery sentinel (241) keeps its existing behavior. The BIOS handler sentinel (214) needs a μop 0 hold that allows IRQ injection:

```css
--irqActive: if(
  style(--opcode: 241) and style(--__1uOp: 5): 0;           /* IRQ sentinel retirement */
  style(--opcode: 241): var(--__1irqActive);                  /* IRQ sentinel mid-sequence: hold */
  style(--opcode: 214) and style(--__1uOp: 0): if(           /* BIOS handler μop 0 hold */
    style(--_irqEffective: 0): 0;                             /*   no pending IRQ: stay idle */
    style(--_ifFlag: 0): 0;                                   /*   IF=0: no interrupt */
    else: 1);                                                  /*   IRQ pending + IF=1: fire */
  style(--opcode: 214): 0;                                    /* BIOS handler mid-sequence: no IRQ */
  style(--_irqEffective: 0): 0;
  style(--_ifFlag: 0): 0;
  style(--__1uOp: 0): 1;
else: 0);
```

This means a BIOS microcode handler that holds at μop 0 (like INT 16h waiting for a key) is interruptible. The IRQ delivery sentinel (0xF1) saves and restores the CPU state around the interrupt, then IRET returns to the BIOS handler's sentinel address (0xD6), which re-evaluates μop 0.

When IRQ 1 fires during the INT 16h hold:
1. irqActive goes to 1
2. Opcode override returns 0xF1 (the IRQ sentinel)
3. The IRQ sentinel pushes FLAGS/CS/IP (saving the INT 16h return state)
4. CPU vectors to INT 09h handler
5. INT 09h stuffs the BDA buffer, sends EOI, retires
6. IRET returns to the INT 16h sentinel
7. INT 16h's μop 0 re-evaluates: buffer now non-empty, advances to μop 1

This is exactly how a real 8086 handles nested interrupts during a HLT instruction — the hold is interruptible.

### 3.5 Architectural Constraint: Only μop 0 Holds Are Interruptible

The re-entrancy works because IRET returns the CPU to the sentinel's starting address, where it re-decodes and starts at μop 0 — which is exactly where the hold was. If a future handler tried to hold at μop > 0, the IRQ sentinel's μop sequence would overwrite `--uOp`, and after IRET the sentinel would restart at μop 0, not at the held μop. **This is an architectural constraint, not a coincidence.** Only μop 0 holds are safe for interruptible waits.

### 3.6 μop Numbering: Two Separate Opcodes, Two Separate Instructions

When IRQ 1 fires, two distinct instructions execute back-to-back:

1. **IRQ delivery** (opcode 0xF1 = 241, triggered by `irqActive=1`): μops 0-5, pushes FLAGS/CS/IP, loads CS:IP from IVT. This is the existing sequence in `irq.mjs`.
2. **BIOS handler** (opcode 0xD6 = 214, fetched from ROM at the IVT target address): its own μops 0-N, implementing the BIOS routine (e.g., INT 09h's buffer insert).

These use **different opcode numbers** (0xF1 vs 0xD6), so there are no dispatch conflicts. The IRQ delivery retires at μop 5 (uOp → 0), then the CPU fetches 0xD6 from ROM and starts the BIOS handler's μop 0.

---

## 4. Other BIOS Handlers (Brief)

These are defined in V3-PLAN-1.md. Noting the specific μop design decisions:

### INT 10h (Video)

**AH=0Eh (teletype):** The most complex handler. Microcode μop sequence: read cursor from BDA, handle CR/LF/BEL, compute VGA offset, write char+attr, advance cursor, conditionally scroll. Scroll is a sub-sequence that copies 1920 words up and clears the last row — ~3840 μops for a full scroll (each μop copies or clears one byte).

**AH=00h (set mode):** Write mode to BDA, clear screen (2000 words for text, 32000 words for Mode 13h).

**AH=02h (set cursor):** Write DH/DL to BDA. 2-3 μops.

**AH=03h (get cursor):** Read DH/DL from BDA. 2-3 μops.

**AH=0Fh (get mode):** Read mode, columns, page from BDA. 2-3 μops.

**AH=06h (scroll up):** Copy rows, clear bottom. Variable-length μop sequence.

### INT 1Ah (Timer)

**AH=00h:** Read PIT counter into CX:DX. 2-3 μops. Trivial.

### INT 20h (Halt)

Write 1 to halt flag at 0x2110. 1-2 μops.

---

## 5. Pre-existing Bug Fix: PIC Priority in CSS

### 5.1 The Problem

The CSS `_irqEffective` property does not implement PIC priority:

```css
--_irqEffective: --and(var(--__1picPending), --not(var(--__1picMask)));
```

This is `pending & ~mask` — it ignores the in-service register. On a real 8259A PIC, an IRQ is only deliverable if no higher-priority IRQ is currently in service. The JS PIC (`hasInt()` in peripherals.mjs) correctly implements this: it scans from IRQ 0 upward and blocks delivery if any lower-numbered (higher-priority) IRQ is in-service.

Phase 4 never hit this because only IRQ 0 (timer) existed. With Phase 5 adding IRQ 1 (keyboard), the CSS PIC would incorrectly deliver IRQ 1 while IRQ 0's handler is running (before EOI).

In practice this rarely bites because timer handlers send EOI quickly, but it's a correctness issue that should be fixed before adding more IRQ sources.

### 5.2 The Fix

Change `_irqEffective` to mask out IRQs at or below the highest in-service IRQ:

```css
/* _irqPriorityMask: bits at and below the highest-priority in-service IRQ are blocked.
   If inService has bit N set (and no bit < N set), mask = (2^(N+1)) - 1 = all bits 0..N.
   If inService is 0, mask is 0 (nothing blocked). */
--_irqPriorityMask: if(
  style(--__1picInService: 0): 0;
else: calc(var(--_lowestInServiceBit) * 2 - 1));

--_lowestInServiceBit: --pow2(--lowestBit(var(--__1picInService)));

--_irqEffective: --and(--and(var(--__1picPending), --not(var(--__1picMask))), --not(var(--_irqPriorityMask)));
```

Wait — the 8259A blocks all IRQs at equal or **lower** priority (higher number) than the in-service one. IRQ 0 is highest priority. If IRQ 0 is in-service, IRQs 1-7 are blocked. So the mask should block bits >= the in-service bit, not bits <= it.

Actually, re-reading the 8259A spec: the priority resolver blocks delivery of interrupts at the **same or lower priority** than the highest-priority in-service interrupt. Lower priority = higher IRQ number. So if IRQ 0 is in-service, all IRQs (0-7) are blocked. If IRQ 2 is in-service, IRQs 2-7 are blocked but 0-1 can still fire.

The mask we need: all bits from the lowest set bit in `picInService` upward. That's `~(lowestInServiceBit - 1)` or equivalently `0xFF << lowestBit(inService)`.

But this is getting complex for CSS. Simpler approach: since the JS PIC's `hasInt()` already does the priority check correctly, and we only have two IRQ sources (timer=0, keyboard=1), we can use a simplified check: if `picInService != 0`, no IRQs fire.

```css
--_irqEffective: if(
  style(--__1picInService: 0): --and(var(--__1picPending), --not(var(--__1picMask)));
else: 0);
```

This is conservative (blocks ALL IRQs when any is in-service) but correct for the 8259A's default mode with well-behaved handlers that send EOI before returning. If we later need true priority nesting, we can add the full mask computation then.

**The picVector derivation (`lowestBit(picInService)`) remains correct** with this fix, because with only one bit ever set in `picInService` at a time, `lowestBit` always returns the right IRQ number. The reviewer's nested-interrupt scenario (two bits in `picInService`) cannot occur when `_irqEffective` properly respects in-service state.

---

## 6. JS Reference Emulator Wiring

### 6.1 `int_handler` Hook

compare.mjs passes an `int_handler` function to the Intel8086 constructor. This function dispatches on interrupt number:

```javascript
const int_handler = (type) => {
  switch (type) {
    case 0x09: return int09h(cpu);
    case 0x10: return int10h(cpu);
    case 0x16: return int16h(cpu);
    case 0x1A: return int1ah(cpu);
    case 0x20: return int20h(cpu);
    default: return false;  // not handled, fall through to IVT
  }
};
```

Each handler function reads/writes `memory[]` directly and returns `true` to indicate it handled the interrupt.

### 6.2 Keyboard Event Injection

For conformance testing, compare.mjs feeds key events at predetermined cycles. `feedKey()` must be updated to accept a full `(scancode<<8)|ascii` word (currently it takes a single scancode byte and masks to 0xFF). Port 0x60 returns the scancode (high byte); the handler reads `currentWord` for the full pair.

```javascript
// Before the trace loop:
const keyEvents = [
  { cycle: 100, key: 0x1E61 },  // press 'A' at cycle 100
  { cycle: 150, key: 0 },        // release at cycle 150
];

// In the trace loop, after each instruction:
for (const ev of keyEvents) {
  if (ev.cycle === currentCycle) {
    kbd.feedKey(ev.key);
  }
}
```

The CSS side receives the same events via `--keyboard` changes at the same cycle boundaries.

---

## 7. Implementation Order

0. **PIC priority fix** — add in-service check to `_irqEffective` in irq.mjs. Test with existing timer-irq.asm (should still pass).
1. **JS int_handler functions** — INT 09h, 10h (AH=0Eh only initially), 16h, 1Ah, 20h. Wire into compare.mjs. Test with reference emulator alone.
2. **BDA initialization** — keyboard buffer head/tail/start/end fields in the generator.
3. **kbdLast + _kbdChanged** — new state var and computed property in template.mjs / emit-css.mjs.
4. **picPending update** — merge keyboard IRQ source.
5. **irqActive fix** — allow IRQ injection during sentinel μop 0 holds.
6. **INT 09h microcode emitter** — sentinel μop sequence in transpiler.
7. **INT 16h microcode emitter** — with the μop 0 hold for blocking read, FLAGS-on-stack for AH=01h.
8. **INT 10h microcode emitter** — AH=0Eh teletype first, then other subfunctions.
9. **INT 1Ah, INT 20h microcode emitters** — trivial.
10. **HTML template** — `:active` button mappings.
11. **Conformance tests** — keyboard-irq.asm test program exercising the full path.

**Deferred:** Terminology rename ("ticks" → "cycles") moved to a separate PR to avoid entangling with feature work.

---

## 8. What This Does NOT Cover

- **INT 13h (disk I/O):** Separate phase. Requires the ROM disk plan from CLAUDE.md.
- **INT 21h (DOS services):** Provided by EDR-DOS kernel, not the BIOS.
- **Shift-state tracking:** INT 09h does not maintain BDA keyboard flags. Deferred until a program needs shift/ctrl/alt.
- **Full scancode set:** Only the keys present as HTML buttons are mapped. Extended scancodes (function keys, etc.) deferred.
- **Typematic repeat:** Holding a button does not auto-repeat. The key fires once on press. Deferred.
- **Terminology rename:** "ticks" → "cycles" deferred to a separate PR.

---

## Appendix A: Review Issues and Resolutions

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Port 0x60 returns ASCII, not scancode (real HW deviation) | **Rev 3:** Fixed. Port 0x60 now returns scancode (high byte of `--keyboard`). ASCII available via `--_kbdAscii` computed property. Doom et al. see correct scancodes. |
| 2 | BDA buffer pointers at 0x0480-0x0483 may be uninitialized | Hardcode buffer range (0x1E-0x3E) in handlers instead of reading pointers. Initialize BDA fields during setup. |
| 3 | Sentinel re-entrancy only works for μop 0 holds | Documented as architectural constraint (Section 3.5). |
| 4 | Edge detection misses press+release within one instruction | Documented as known limitation. Negligible in practice (~13ms minimum instruction vs ~100ms keypress). |
| 5 | INT 16h AH=01h ZF must be set in stacked FLAGS, not current FLAGS | **Rev 3:** Handler folds IRET into its retirement μops, merging ZF into the popped FLAGS directly. No separate stack write-back needed. |
| 6 | picVector breaks with nested interrupts (pre-existing bug) | **Rev 3:** Root cause is missing PIC priority in `_irqEffective`. Fix: block all IRQs when any is in-service (`picInService != 0 → _irqEffective = 0`). This prevents multiple bits in `picInService`, so `lowestBit(picInService)` remains correct. No `irqNum` latch needed. |
| 7 | Nested `--or` calls may hit Chrome @function limits | Calcite-only. No fix needed. |
| 8 | INT 10h scroll is ~4000 μops | Acceptable (~4ms in Calcite). IRQs blocked during mid-sentinel μops > 0. |
| 9 | Terminology rename entangles with feature work | Deferred to separate PR. |
| 10 | μop numbering ambiguous between IRQ delivery and handler sentinels | Clarified: two separate sentinel executions with independent μop counters (Section 3.6). |
