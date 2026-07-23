// Top-level CSS generation orchestrator.
// Collects dispatch entries from all opcode emitters, assembles per-register
// dispatch tables, and combines with infrastructure (clock, memory, decode).

import { emitCSSLib } from './css-lib.mjs';
import { emitDecodeFunction, emitDecodeProperties, emitPrecomputedState } from './decode.mjs';
import {
  emitStatePropertiesFor, emitClockWireProperty, emitKeyboardWireProperties,
  emitBufferReads, emitRegisterAliases,
  emitStoreKeyframe, emitExecuteKeyframe, emitClockKeyframes,
  emitClockRule, emitClockPlumbingOpen,
  emitKeyboardRules, emitMouseWireProperty, emitMouseCellRules,
} from './template.mjs';
import { emitPixelPaintRules } from './pixels.mjs';
import { emitWriteSlotProperties, emitDiskAddrProperties, buildInitialMemory, buildAddressSet,
         NUM_WRITE_SLOTS, PACK_SIZE, buildCellSet, buildInitialMemoryPacked,
         cellIdxOf, cellOffOf, cellBase } from './memory.mjs';
import { emitFlagFunctions } from './patterns/flags.mjs';

// Opcode emitters
import { emitAllMOV } from './patterns/mov.mjs';
import { emitAllALU } from './patterns/alu.mjs';
import { emitAllControl } from './patterns/control.mjs';
import { emitAllStack } from './patterns/stack.mjs';
import { emitAllMisc, emitPitDerivation, emitKeyboardWires, emitMouseWires, msQuietUntilDefaultExpr, emitIRQArbitration, pitCounterDefaultExpr, picPendingDefaultExpr } from './patterns/misc.mjs';
import { emitAllGroups } from './patterns/group.mjs';
import { emitAllShifts, emitShiftFlagFunctions, emitShiftByNFlagFunctions } from './patterns/shift.mjs';
import { emitAll186 } from './patterns/extended186.mjs';
import { emitCycleCounts } from './cycle-counts.mjs';

// ---------------------------------------------------------------------------
// Run-delimiter comments for long dispatch lists.
//
// A 60-232-row if() dispatch is unreadable as one wall of rows. Standalone
// comments are legal wherever whitespace is and every spec-compliant
// evaluator strips them at tokenize time (verified for Chrome and calcite -
// see docs/plans/2026-07-10-anatomy-tree-view.md, principle 6), so we plant
// one wherever the list changes kind. The site's anatomy Tree View breaks
// pagination at exactly these comments, turning each list into labelled runs.

// The 8086 opcode map's natural rows. Register dispatches are emitted in
// ascending opcode order, so each family is one contiguous run.
const OPCODE_FAMILIES = [
  [0x00, 'ALU: ADD/OR/ADC/SBB/AND/SUB/XOR/CMP + BCD adjusts'],
  [0x40, 'INC/DEC reg16'],
  [0x50, 'PUSH/POP reg16'],
  [0x60, '80186: PUSH/IMUL immediate'],
  [0x70, 'conditional jumps'],
  [0x80, 'Group 80-83: ALU r/m, imm'],
  [0x84, 'TEST/XCHG, MOV r/m, LEA, MOV segreg, POP r/m'],
  [0x90, 'XCHG AX/NOP, CBW/CWD, CALL far, PUSHF/POPF, SAHF/LAHF'],
  [0xA0, 'MOV accumulator/[mem], string ops, TEST acc'],
  [0xB0, 'MOV reg, imm'],
  [0xC0, 'RET/RETF, LES/LDS, MOV r/m imm, INT/INTO/IRET'],
  [0xD0, 'shifts & rotates, AAM/AAD, XLAT'],
  [0xE0, 'LOOP/JCXZ, IN/OUT, CALL/JMP'],
  [0xF0, 'HLT/CMC, Group F6/F7, CLC..STD, Group FE/FF'],
];

// Short dispatches read fine without family labels; only label long ones.
const FAMILY_COMMENT_MIN_ROWS = 24;

function opcodeFamily(opcode) {
  let label = OPCODE_FAMILIES[0][1];
  for (const [start, l] of OPCODE_FAMILIES) {
    if (opcode < start) break;
    label = l;
  }
  return label;
}

// Memory write slots are grouped by where the write lands (the address
// expression's shape), so each slot dispatch reads as a table of
// destinations rather than emitter-registration order. Classification is
// shape-based so a new addMemWrite call site lands in the right run
// without touching a table here.
const WRITE_GROUPS = [
  ['ea',     'ModR/M memory destination (--ea; -1 when mod=3 targets a register)', 'ModR/M memory writes'],
  ['direct', 'direct-address MOV: accumulator to [imm16]',                         'direct-address MOVs'],
  ['string', 'string stores to ES:DI',                                             'string stores'],
  ['stack',  'stack pushes',                                                       'stack pushes'],
  ['group',  'group opcodes: destination picked by the /reg field',                'group opcodes'],
  ['io',     'OUT side-effects: VGA DAC / CGA palette shadow registers',           'OUT side-effects'],
];

// Get map[k], initialising it with make() the first time. Returns the value.
const getOrInit = (map, k, make) => {
  if (!map.has(k)) map.set(k, make());
  return map.get(k);
};

function classifyWrite(addrExpr, comment = '') {
  if (/dacWriteIndex/.test(addrExpr) || /^OUT\b/.test(comment)) return 'io';
  if (/--directSeg/.test(addrExpr)) return 'direct';
  if (/--__1DI/.test(addrExpr)) return 'string';
  if (/style\(--reg:/.test(addrExpr) && /--__1SP/.test(addrExpr)) return 'group';
  if (/--__1SP/.test(addrExpr)) return 'stack';
  return 'ea';
}

/**
 * Dispatch table builder. Collects per-register entries keyed by opcode.
 */
class DispatchTable {
  constructor() {
    // regEntries: Map<regName, Map<opcode, {expr, comment}>>
    this.regEntries = new Map();
    // Each opcode can contribute to up to 3 write slots, in call order.
    // width 1 = byte write (addMemWrite), 2 = word write (addMemWriteWord).
    this.memWritesByOpcode = new Map(); // opcode → [{addrExpr, valExpr, comment, width}]
    // The edge-latch half of picPending's IRQ-acknowledge override -
    // set by emitCSS to picPendingDefaultExpr(mouse) so cabinets with
    // extra IRQ sources keep the ack path in sync with the default path.
    this.picPendingLatchExpr = null;
  }

  addEntry(reg, opcode, expr, comment = '') {
    const regMap = getOrInit(this.regEntries, reg, () => new Map());
    if (regMap.has(opcode)) {
      // Multiple emitters writing the same register for same opcode
      // - this is an error in the emitter logic.
      throw new Error(`Duplicate dispatch entry: ${reg} opcode 0x${opcode.toString(16)} - existing: ${regMap.get(opcode).comment}, new: ${comment}`);
    }
    // For flags: ALU flag functions build flags from scratch but must preserve
    // TF/IF/DF (bits 8-10) from the previous tick. Instructions that DO modify
    // these bits (STI/CLI/CLD/STD/INT/IRET/POPF) already set them explicitly.
    // AF (bit 4) is computed by the flag functions themselves for ADD/SUB/etc.
    // TF|IF|DF (bits 8-10) preservation is handled at each call site or inside the
    // flag functions themselves (inc/dec). No automatic wrapper - it breaks mixed
    // dispatches that have both flag-computing and passthrough branches.
    regMap.set(opcode, { expr, comment });
  }

  /**
   * Emit --unknownOp: 1 if the current opcode has no IP dispatch entry, 0 otherwise.
   * Prefixes (0x26/0x2E/0x36/0x3E/0xF2/0xF3) are excluded - they're handled at decode level.
   */
  emitUnknownOpFlag() {
    const ipEntries = this.regEntries.get('IP');
    if (!ipEntries) return '  --unknownOp: 1;';
    const opcodes = [...ipEntries.keys()].sort((a, b) => a - b);
    const lines = ['  --unknownOp: if('];
    let prevFamily = null;
    for (const op of opcodes) {
      const family = opcodeFamily(op);
      if (family !== prevFamily) {
        lines.push(`    /* ${family} */`);
        prevFamily = family;
      }
      lines.push(`    style(--opcode: ${op}): 0;`);
    }
    lines.push('    /* any opcode not implemented above is unknown - halt */');
    lines.push('  else: 1);');
    return lines.join('\n');
  }

  /**
   * Declare an 8-bit byte write of `valExpr` to runtime byte-address
   * `addrExpr` for `opcode`. Allocates one width=1 slot in call order.
   * For 16-bit writes use addMemWriteWord instead.
   */
  addMemWrite(opcode, addrExpr, valExpr, comment = '') {
    getOrInit(this.memWritesByOpcode, opcode, () => []).push({ addrExpr, valExpr, comment, width: 1 });
  }

  /**
   * Declare a 16-bit word write at runtime byte-address `addrExpr` with
   * value `wordValExpr` (the un-split word; lo lands at addrExpr, hi at
   * addrExpr+1). Allocates one width=2 slot in call order; the per-cell
   * write rules split the word into lo/hi bytes. `wordValExpr` may be any
   * shape (a bare value or a top-level if(...) dispatch) - it is written
   * verbatim as the slot's --memValN.
   */
  addMemWriteWord(opcode, addrExpr, wordValExpr, comment = '') {
    getOrInit(this.memWritesByOpcode, opcode, () => []).push({ addrExpr, valExpr: wordValExpr, comment, width: 2 });
  }

  /**
   * Emit the dispatch table for one register as a CSS if() expression.
   * Returns the full property declaration (emitted inside .cpu for CPU
   * registers, .motherboard for chipset state - same player element).
   *
   * For IP: wraps the entire dispatch in calc(... + var(--prefixLen)) so that
   * all instruction IP calculations automatically account for prefix bytes
   * (segment overrides, REP) without changing each individual emitter.
   */
  emitRegisterDispatch(reg, defaultExpr) {
    const entries = this.regEntries.get(reg);
    const hasEntries = entries && entries.size > 0;

    // Build the normal instruction dispatch.
    const wrapIP = (reg === 'IP');
    let normalExpr;
    if (!hasEntries) {
      // No dispatch entries -> the "normal path" is just the default.
      // We still wrap with TF/IRQ overrides below so interrupt delivery can
      // override registers that only have custom-default behavior (e.g.
      // picPending latches edges by default but clears --_irqBit on ack).
      // IP always has entries so prefixLen wrapping doesn't apply here.
      normalExpr = defaultExpr;
    } else {
      const dispatchLines = [];
      const sorted = [...entries.entries()].sort(([a], [b]) => a - b);
      // Long lists get a run-delimiter comment at each opcode-family
      // boundary (see OPCODE_FAMILIES above); short ones stay unbroken.
      const labelFamilies = sorted.length >= FAMILY_COMMENT_MIN_ROWS;
      let prevFamily = null;
      for (const [opcode, { expr, comment }] of sorted) {
        if (labelFamilies) {
          const family = opcodeFamily(opcode);
          if (family !== prevFamily) {
            dispatchLines.push(`    /* ${family} */`);
            prevFamily = family;
          }
        }
        const commentStr = comment ? ` /* ${comment} */` : '';
        dispatchLines.push(`    style(--opcode: ${opcode}): ${expr};${commentStr}`);
      }
      if (defaultExpr === `var(--__1${reg})`) {
        dispatchLines.push(`    /* no entry for this opcode: ${reg} holds */`);
      }
      if (wrapIP) {
        normalExpr = `calc(if(\n${dispatchLines.join('\n')}\n  else: ${defaultExpr}) + var(--prefixLen))`;
      } else {
        normalExpr = `if(\n${dispatchLines.join('\n')}\n  else: ${defaultExpr})`;
      }
    }

    // TF (Trap Flag) override: when previous FLAGS had TF=1, fire INT 1 instead
    // of the normal instruction. INT 1: push FLAGS/CS/IP, clear TF+IF, jump to IVT[1].
    const TF_OVERRIDES = {
      'IP':    'var(--_tfIP)',
      'CS':    'var(--_tfCS)',
      'SP':    'calc(var(--__1SP) - 6)',
      'flags': '--and(var(--__1flags), 64767)',  // & 0xFCFF = clear TF+IF
    };

    // IRQ override: when --_irqActive fires (unmasked pending IRQ with IF set
    // and no in-service IRQ), deliver the interrupt instead of the instruction
    // fetched from memory. Identical push shape to TF/INT (FLAGS/CS/IP), but
    // the vector comes from --picVector (8 or 9 for IRQ 0 / IRQ 1) and retIP
    // is the current __1IP (no instruction consumed). cycleCount += 61 matches
    // the real 8086 hardware-interrupt cost. picPending clears the acknowledged
    // bit (while still latching any new edges); picInService sets it so that
    // lower-priority IRQs block until EOI.
    const IRQ_OVERRIDES = {
      'SP':       'calc(var(--__1SP) - 6)',
      'IP':       '--read2(calc(var(--picVector) * 4))',
      'CS':       '--read2(calc(var(--picVector) * 4 + 2))',
      'flags':    '--and(var(--__1flags), 64767)',
      'cycleCount': 'calc(var(--__1cycleCount) + 61)',
      // Edge-OR applied so concurrent edges don't get dropped. The latch
      // expression is settable (this.picPendingLatchExpr) because mouse
      // cabinets have a third edge source (the UART, IRQ 4) - it must
      // match picPendingDefaultExpr(mouse) from patterns/misc.mjs.
      'picPending': `--and(${this.picPendingLatchExpr ?? '--or(--or(var(--__1picPending), var(--_pitFired)), calc(var(--_kbdEdge) * 2))'}, --not(var(--_irqBit)))`,
      'picInService': '--or(var(--__1picInService), var(--_irqBit))',
    };

    const tfExpr = TF_OVERRIDES[reg] || `var(--__1${reg})`;
    const irqExpr = IRQ_OVERRIDES[reg] || `var(--__1${reg})`;
    return `  --${reg}: if(style(--_tf: 1): ${tfExpr}; style(--_irqActive: 1): ${irqExpr}; else: ${normalExpr});`;
  }

  /**
   * Emit the 3 memory write slot properties (--memAddr0/Val0 through
   * --memAddr2/Val2). Width is supplied globally by --_writeWidth (see
   * emitWriteWidthGate), not per-slot.
   *
   * Each write registered by a call site occupies one slot directly:
   * a byte write (addMemWrite) is a width=1 slot whose --memValN is the
   * byte value; a word write (addMemWriteWord) is a width=2 slot whose
   * --memValN is the un-split 16-bit word (lo lands at --memAddrN, hi at
   * --memAddrN+1 - the per-cell write rules do the split). Call order is
   * slot order.
   *
   * Worst case: INT pushes FLAGS/CS/IP = 3 word writes = 3 width-2 slots.
   *
   * Slot 0 is the outermost in the cell cascade so it wins on collisions.
   * For multi-slot opcodes the call order determines which slot carries
   * which write - slot 0 first, then slot 1, then slot 2. Multi-write
   * opcodes (like INT) whose writes must all execute in one tick can rely
   * on the slot order matching call order.
   */
  emitMemoryWriteSlots() {
    // Each opcode's registered writes map one-to-one onto slots in call
    // order (byte writes are width=1, word writes width=2). Guard the
    // NUM_WRITE_SLOTS ceiling; the INT family (3 word pushes) is the max.
    const slots = Array.from({ length: NUM_WRITE_SLOTS }, () => []);
    for (const [opcode, writes] of this.memWritesByOpcode) {
      if (writes.length > NUM_WRITE_SLOTS) {
        throw new Error(`Opcode 0x${opcode.toString(16)} uses ${writes.length} memory write slots (max ${NUM_WRITE_SLOTS})`);
      }
      for (let i = 0; i < writes.length; i++) {
        slots[i].push({ opcode, ...writes[i] });
      }
    }
    // Order each slot's rows by destination kind (classifyWrite), ascending
    // opcode within a kind, so the dispatch reads as a table of where
    // writes land instead of emitter-registration order. Safe to reorder:
    // every row keys on a distinct --opcode, so at most one arm matches.
    const groupRank = new Map(WRITE_GROUPS.map(([key], i) => [key, i]));
    for (const entries of slots) {
      for (const e of entries) e.group = classifyWrite(e.addrExpr, e.comment);
      entries.sort((a, b) =>
        (groupRank.get(a.group) - groupRank.get(b.group)) || (a.opcode - b.opcode));
    }
    // Stash per-slot {opcode, width, comment} lists (grouped order) so
    // emitSlotLiveGates / emitWriteWidthGate emit matching dispatches.
    this._slotMeta = slots.map(entries => entries.map(
      e => ({ opcode: e.opcode, width: e.width, comment: e.comment, group: e.group })));

    // TF trap and IRQ delivery both push FLAGS/CS/IP - three word-aligned
    // pushes. Each lands in one width=2 slot. Stack is always even-aligned
    // (SP starts even, decrements by 2) so no straddle here.
    const ssBase = 'calc(var(--__1SS) * 16)';
    // Wrap SP-K to 16 bits - without this, IRQ/TF push at SP=0 lands one
    // segment too low (SS:0xFFFE != SS-1:0xFFFE). Same fix as PUSH/CALL/INT
    // in kiln/patterns/{stack,control,misc,group}.mjs.
    const sa = (k) => `calc(${ssBase} + --lowerBytes(calc(var(--__1SP) - ${k} + 65536), 16))`;
    const intAddr = [
      sa(2),   // slot 0: FLAGS at SP-2..SP-1
      sa(4),   // slot 1: CS at SP-4..SP-3
      sa(6),   // slot 2: IP at SP-6..SP-5
    ];
    const intVal = [
      `var(--__1flags)`,
      `var(--__1CS)`,
      `var(--__1IP)`,
    ];
    const intFrameWord = [
      'FLAGS at SS:SP-2',
      'CS at SS:SP-4',
      'IP at SS:SP-6',
    ];
    const slotRole = [
      'every writing opcode\'s first (or only) write',
      'used only by multi-write opcodes: the second byte/word they write this tick',
      'used only by the INT family: the third frame word',
    ];
    const groupLabel = new Map(WRITE_GROUPS.map(([key, label]) => [key, label]));

    const lines = [];
    // Emits the rows of one slot dispatch (shared by --memAddrN and
    // --memValN so both list identical opcodes in identical order), with a
    // run-delimiter comment wherever the destination kind changes.
    const pushRows = (slot, exprOf) => {
      let prevGroup = null;
      for (const entry of slots[slot]) {
        if (entry.group !== prevGroup) {
          lines.push(`    /* ${groupLabel.get(entry.group)} */`);
          prevGroup = entry.group;
        }
        const commentStr = entry.comment ? ` /* ${entry.comment} */` : '';
        lines.push(`    style(--opcode: ${entry.opcode}): ${exprOf(entry)};${commentStr}`);
      }
    };
    for (let slot = 0; slot < NUM_WRITE_SLOTS; slot++) {
      lines.push(`  /* --- slot ${slot} --- */`);
      lines.push(`  /* ${slotRole[slot]} */`);
      lines.push(`  --memAddr${slot}: if(`);
      lines.push(`    /* interrupt frame: ${intFrameWord[slot]} (TF trap / hardware IRQ) */`);
      lines.push(`    style(--_tf: 1): ${intAddr[slot]};`);
      lines.push(`    style(--_irqActive: 1): ${intAddr[slot]};`);
      pushRows(slot, (e) => e.addrExpr);
      lines.push(`    /* any other opcode: slot idle this tick */`);
      lines.push(`  else: -1);`);

      lines.push(`  --memVal${slot}: if(`);
      lines.push(`    /* interrupt frame: ${intFrameWord[slot]} (TF trap / hardware IRQ) */`);
      lines.push(`    style(--_tf: 1): ${intVal[slot]};`);
      lines.push(`    style(--_irqActive: 1): ${intVal[slot]};`);
      pushRows(slot, (e) => e.valExpr);
      lines.push(`    /* slot idle: value unused (addr is -1) */`);
      lines.push(`  else: 0);`);
    }

    return lines.join('\n');
  }

  /**
   * Emit --_slot0Live through --_slot{N}Live: 1 on ticks where the slot is
   * used, 0 otherwise. Used to gate the per-byte memory write rules so
   * non-writing instructions skip all address checks.
   *
   * TF trap and hardware IRQ push the 3 FLAGS/CS/IP words, so they force
   * all three slots live.
   *
   * emitMemoryWriteSlots() must be called before this so _slotMeta is populated.
   */
  emitSlotLiveGates() {
    if (!this._slotMeta) {
      throw new Error('emitMemoryWriteSlots must be called before emitSlotLiveGates');
    }
    const shortLabel = new Map(WRITE_GROUPS.map(([key, , short]) => [key, short]));
    const lines = ['  /* Slot-live gates - skip per-byte memory write checks when no slot fires this tick. */',
                   '  /* Rows mirror the slot dispatches above: same opcodes, same order. */'];
    for (let slot = 0; slot < NUM_WRITE_SLOTS; slot++) {
      const meta = this._slotMeta[slot];
      const branches = [];
      branches.push(`    /* TF trap and IRQ delivery push FLAGS/CS/IP - all slots live */`);
      branches.push(`    style(--_tf: 1): 1;`);
      branches.push(`    style(--_irqActive: 1): 1;`);
      let prevGroup = null;
      for (const { opcode, comment, group } of meta) {
        if (group !== prevGroup) {
          branches.push(`    /* ${shortLabel.get(group)} */`);
          prevGroup = group;
        }
        const commentStr = comment ? ` /* ${comment} */` : '';
        branches.push(`    style(--opcode: ${opcode}): 1;${commentStr}`);
      }
      lines.push(`  --_slot${slot}Live: if(`);
      lines.push(branches.join('\n'));
      lines.push(`  else: 0);`);
    }
    return lines.join('\n');
  }

  /**
   * Emit a single global --_writeWidth gate.
   *
   * In practice no opcode the kiln currently emits *mixes* byte and word
   * writes within one tick - every opcode is either purely byte (STOSB,
   * single-byte MOV/XCHG, OUT to DAC, etc.) or purely word (PUSH, CALL,
   * INT, IRQ frame, word MOV/XCHG/POP). One per-tick width fits all
   * existing instructions, and saves N-1 width dispatches and N-1 slot
   * reads per tick compared to per-slot widths.
   *
   * If a future opcode wants to mix widths in a single tick, it must
   * either split across two ticks or this design needs to grow back to
   * per-slot widths. The kiln will throw if multi-width opcodes appear
   * (see check below).
   *
   * Width = 2 fires when ANY slot for the active opcode (or TF/IRQ) is
   * width=2. The splice path treats every active slot uniformly under
   * that width.
   */
  emitWriteWidthGate() {
    if (!this._slotMeta) {
      throw new Error('emitMemoryWriteSlots must be called before emitWriteWidthGate');
    }
    // Collect every opcode that has any width=2 slot. Cross-check that
    // it doesn't ALSO have a width=1 slot - that would mean the opcode
    // mixes widths in one tick, which the global-width design can't
    // express. (No kiln opcode does this today; the check is to fail
    // fast if a future emitter accidentally introduces one.)
    const widthByOpcode = new Map(); // opcode → Set<width>
    for (let slot = 0; slot < NUM_WRITE_SLOTS; slot++) {
      for (const { opcode, width } of this._slotMeta[slot]) {
        getOrInit(widthByOpcode, opcode, () => new Set()).add(width);
      }
    }
    const wordOpcodes = [];
    for (const [opcode, widths] of widthByOpcode) {
      if (widths.has(1) && widths.has(2)) {
        // Diagnostic: dump per-slot widths for the offending opcode.
        const perSlot = [];
        for (let slot = 0; slot < NUM_WRITE_SLOTS; slot++) {
          for (const e of this._slotMeta[slot]) {
            if (e.opcode === opcode) perSlot.push(`slot${slot}=w${e.width}`);
          }
        }
        throw new Error(
          `Opcode 0x${opcode.toString(16)} mixes byte and word writes in one tick - ` +
          `${perSlot.join(', ')}. The global --_writeWidth design can't express this. ` +
          `Either split the opcode across ticks or restore per-slot widths.`
        );
      }
      if (widths.has(2)) wordOpcodes.push(opcode);
    }
    wordOpcodes.sort((a, b) => a - b);
    // A representative comment per word-writing opcode, lifted from its
    // first slot entry, so the gate's rows name their instructions.
    const commentByOpcode = new Map();
    for (let slot = 0; slot < NUM_WRITE_SLOTS; slot++) {
      for (const { opcode, comment } of this._slotMeta[slot]) {
        if (comment && !commentByOpcode.has(opcode)) commentByOpcode.set(opcode, comment);
      }
    }

    const lines = ['  /* Global write-width gate - 1=byte, 2=word (addr+1 carries hi byte). Shared across slots. */'];
    const branches = [];
    branches.push(`    /* interrupt frame pushes are words */`);
    branches.push(`    style(--_tf: 1): 2;`);
    branches.push(`    style(--_irqActive: 1): 2;`);
    branches.push(`    /* word-writing opcodes */`);
    for (const op of wordOpcodes) {
      const comment = commentByOpcode.get(op);
      const commentStr = comment ? ` /* ${comment} */` : '';
      branches.push(`    style(--opcode: ${op}): 2;${commentStr}`);
    }
    branches.push(`    /* everything else writes single bytes */`);
    lines.push(`  --_writeWidth: if(`);
    lines.push(branches.join('\n'));
    lines.push(`  else: 1);`);
    return lines.join('\n');
  }
}

/**
 * Main CSS generation entry point.
 * Writes to a writable stream to avoid V8 string size limits with 1MB memory.
 *
 * opts.memoryZones: array of [start, end) ranges specifying which addresses to emit.
 * opts.memSize: (legacy) if memoryZones is not provided, emits 0..memSize contiguously.
 */
export function emitCSS(opts, writeStream) {
  const { programBytes, biosBytes, memoryZones, embeddedData, programOffset,
          initialCS, initialIP, diskBytes, writableDisk, header,
          mouse = false } = opts;

  // Build sorted address array from zones (or fall back to legacy contiguous range)
  let addresses;
  if (memoryZones) {
    addresses = buildAddressSet(memoryZones);
  } else {
    const memSize = opts.memSize || 0x10000;
    addresses = [];
    for (let i = 0; i < memSize; i++) addresses.push(i);
  }

  const memOpts = { addresses, programBytes, biosBytes, embeddedData, programOffset, diskBytes, writableDisk };

  // Pre-compute the memory maps that multiple streaming emitters need.
  // Before this change each emitter called buildInitialMemory (×3),
  // buildInitialMemoryPacked (×3), and buildCellSet (×5) independently,
  // rebuilding the same data structures on every call.
  memOpts._cells    = buildCellSet(addresses);
  memOpts._initMem  = buildInitialMemory(memOpts);
  memOpts._cellInit = buildInitialMemoryPacked(memOpts);
  // templateOpts.memSize is used for SP init - derive from the top of the lowest zone
  // (conventional memory area, which is always zones[0] by convention)
  const convEnd = memoryZones ? memoryZones[0][1] : (opts.memSize || 0x10000);
  const templateOpts = { memSize: convEnd, programOffset, initialCS, initialIP, mouse };

  // Build dispatch table
  const dispatch = new DispatchTable();

  // Register all opcode emitters
  emitAllMOV(dispatch);       // MOV variants, LEA/LES/LDS
  emitAllALU(dispatch);       // ADD/SUB/CMP/AND/OR/XOR/ADC/SBB/TEST/INC/DEC
  emitAllControl(dispatch);   // JMP/Jcc/CALL/RET/INT/IRET/LOOP
  emitAllStack(dispatch);     // PUSH/POP/PUSHF/POPF
  emitAllMisc(dispatch, { mouse }); // HLT/NOP/LODSB/STOSB/MOV r/m imm/flag manip/CBW/CWD/XCHG/IO
  emitAllGroups(dispatch);    // Group FE/F7/F6/80-83
  emitAllShifts(dispatch);    // SHL/SHR/SAR/ROL/ROR (D0-D1)
  emitAll186(dispatch);       // 80186+: PUSH imm, IMUL imm
  emitCycleCounts(dispatch);  // Per-instruction 8086 cycle costs

  const w = (s) => writeStream.write(s + '\n\n');

  // Optional cabinet header comment (the self-describing block the builder
  // prepends to every cabinet). Written verbatim at the top of the CSS.
  if (header) {
    writeStream.write(header);
    if (!header.endsWith('\n')) writeStream.write('\n');
    writeStream.write('\n');
  }

  // =====================================================================
  // File order (mirrors the site's file map):
  //   bit & byte helpers → CPU → chipset → keyboard selectors → display →
  //   memory declarations → memory reads → memory writes → disk → clock
  //
  // Each subsystem is one contiguous banner span: its @functions, its
  // @property registrations, and its rule(s) sit together, so a reader
  // meets each part of the machine as a coherent unit. The @property /
  // @function order across the file is functionally inert (var() and
  // function resolution are name-based), so grouping by subsystem is free.
  //
  // The .cpu and .motherboard rules target the SAME player element (it
  // carries both classes), so their custom properties merge into one
  // computed style. The split is organisational: the CPU proper (decode
  // + register dispatch tables) under .cpu, everything else on the
  // board - chipset, memory, clock - under .motherboard.
  // =====================================================================

  // 1. Bit & byte helpers - the shared low-level ops everything is built
  //    from. Only the genuinely-shared primitives live here; the
  //    CPU-only flag arithmetic and decode helpers sit with the CPU.
  w('/* ===== BIT & BYTE HELPERS ===== */');
  w(emitCSSLib());

  // 2. CPU - decode, register dispatch, output, and its own helpers.
  //    Banner spans (the ===== / --- comments the site's file map mirrors -
  //    see tools/extract-tree-data.mjs):
  //      1 · FETCH & DECODE           (decode @functions + decode properties)
  //      PRECOMPUTED EXECUTION STATE  (per-instruction precomputed operands)
  //      2 · UPDATE REGISTERS         (the per-register dispatch tables)
  //      3 · OUTPUT: MEMORY WRITE SLOTS
  //      HELPERS                      (register aliases + flag arithmetic)
  //    @functions can't nest in a rule, so the decode/flag @functions are
  //    emitted top-level inside the CPU banner span, around the .cpu rule.
  w('/* ===== CPU ===== */');
  // The CPU's own state registrations - the 14 registers plus the
  // bookkeeping latches (halt / cycleCount / trap-flag pending / haltCode).
  // Power-on values ride in initial-value. Homed with the CPU rather than in
  // one monolithic declaration dump so a register's declaration sits with the
  // logic that updates it.
  writeStream.write('/* ===== REGISTER DECLARATIONS ===== */\n\n');
  w(emitStatePropertiesFor('cpu', templateOpts));
  // Each CPU stage is emitted as its own .cpu {} block under a top-level
  // banner, so every stage reads as a sibling group in the file map (the
  // blocks merge into one computed style on the player element). @functions
  // can't nest in a rule, so the decode/flag @functions sit top-level within
  // their stage's banner span - AFTER the rule, so the `--- decode helpers ---`
  // banner scopes only the @functions (a `---` span runs until the next
  // banner; putting the rule after it would swallow the rule - see
  // tools/extract-tree-data.mjs Grouper). Same shape as HELPERS below.
  writeStream.write('/* ===== 1 · FETCH & DECODE ===== */\n\n');
  writeStream.write('.cpu {\n');
  w(emitDecodeProperties());
  // Unknown opcode detection - sets --unknownOp=1 and --haltCode=opcode
  writeStream.write('  /* --- unknown opcode flag --- */\n');
  writeStream.write(dispatch.emitUnknownOpFlag() + '\n');
  writeStream.write('  --haltCode: calc(var(--unknownOp) * var(--opcode)); /* the offending opcode, 0 while running */\n');
  w('}');
  w(emitDecodeFunction());

  writeStream.write('/* ===== PRECOMPUTED EXECUTION STATE ===== */\n\n');
  writeStream.write('.cpu {\n');
  w(emitPrecomputedState());
  w('}');

  // Per-register dispatch tables - the heart of instruction execution
  writeStream.write('/* ===== 2 · UPDATE REGISTERS ===== */\n\n');
  writeStream.write('.cpu {\n');
  writeStream.write('  /* Each register\'s next value is selected by opcode via a\n');
  writeStream.write('     giant if(style(--opcode: N)) dispatch. This is the CPU. */\n');
  // Chipset state - the support chips around the CPU, driven by the same
  // dispatch-table machinery (OUT handlers in patterns/misc.mjs) but
  // emitted PER CHIP in the .motherboard rule below (each chip's derived
  // wires and registers sit together - see the CHIPSET section).
  // Vars with no dispatch entries fall through to defaultExpr.
  const PIT_REGS = ['pitMode', 'pitReload', 'pitCounter', 'pitWriteState'];
  const PIC_REGS = ['picMask', 'picPending', 'picInService'];
  // Keyboard controller registers: prevKeyboard snapshots --keyboard for
  // edge detection; kbdScancodeLatch backs port 0x60 (holds the most
  // recent make/break code until the next edge - without it, the break
  // code is only readable on the single tick _kbdRelease fires, and if
  // the IRQ-09h ISR runs even one tick later it reads scancode 0 and
  // DOOM's key-held state sticks); kbdHeld0-7 is the hold-wire held set
  // (scancodes latched while --kbdHold was up; a slot clears early if
  // its key is tapped again - per-key un-hold - and the rest drain as
  // break codes when the wire drops - see kiln/patterns/misc.mjs
  // emitKeyboardWires).
  const KBD_REGS = ['prevKeyboard', 'kbdScancodeLatch',
                    'kbdHeld0', 'kbdHeld1', 'kbdHeld2', 'kbdHeld3',
                    'kbdHeld4', 'kbdHeld5', 'kbdHeld6', 'kbdHeld7'];
  // VGA DAC state machines - write side updated by OUT 0x3C8 / 0x3C9,
  // read side by OUT 0x3C7 / IN 0x3C9. See patterns/misc.mjs emitIO().
  const DAC_REGS = ['dacWriteIndex', 'dacSubIndex',
                    'dacReadIndex', 'dacReadSubIndex'];
  // Custom defaults: the fall-through expression when no dispatch entry fires
  // for this opcode. pitCounter ticks every instruction; picPending latches
  // PIT+keyboard edges; prevKeyboard snapshots --keyboard. Everything else
  // just holds its __1 value.
  const customDefaults = {
    pitCounter: pitCounterDefaultExpr(),
    picPending: picPendingDefaultExpr(mouse),
    prevKeyboard: 'var(--keyboard)',
    // On a press tick: latch the new scancode. On a release tick: latch the
    // break code (prev scancode | 0x80). Otherwise: hold. The expression
    // here mirrors --_kbdPort60 (see emitKeyboardWires) so port 0x60 reads
    // can use the latch as a level-readable backing store.
    kbdScancodeLatch: `if(
      style(--_kbdPress: 1): --rightShift(var(--keyboard), 8);
      style(--_kbdRelease: 1): --or(--rightShift(var(--__1prevKeyboard), 8), 128);
      style(--_kbdDrain: 1): calc(var(--_kbdPopSc) + 128);
      else: var(--__1kbdScancodeLatch)
    )`,
  };
  // Hold-wire held set: append the latched scancode into this slot when
  // its --_kbdApp flag fires, clear it when its --_kbdClr flag fires
  // (per-key un-hold: the held key was tapped again) or its --_kbdPop
  // flag fires (drain), otherwise carry. Flags come from
  // emitKeyboardWires.
  for (let i = 0; i < 8; i++) {
    customDefaults[`kbdHeld${i}`] = `if(
      style(--_kbdApp${i}: 1): var(--_kbdLatchSc);
      style(--_kbdClr${i}: 1): 0;
      style(--_kbdPop${i}: 1): 0;
      else: var(--__1kbdHeld${i})
    )`;
  }
  // Serial-mouse chipset (8250 UART + packet generator) - registers'
  // per-tick defaults are the --_uart*Next / mouse wires from
  // emitMouseWires; the IN/OUT side effects layer on via dispatch
  // entries added in emitIO. See patterns/misc.mjs for the machine.
  const MOUSE_REGS = ['msCurX', 'msCurY', 'msSentBtn', 'msTgtLatch',
                      'msHeldBtn', 'msQuietUntil', 'msPendEdges', 'msRawPrev',
                      'msTouchPrev', 'msDxL', 'msDyL',
                      'uartIer', 'uartMcr', 'uartRbr', 'uartDr', 'uartPhase'];
  if (mouse) {
    dispatch.picPendingLatchExpr = picPendingDefaultExpr(true);
    Object.assign(customDefaults, {
      // Both axes in mickeys (half-pixels) - see the 2:1 note in
      // emitMouseWires.
      msCurX: 'clamp(0, calc(var(--__1msCurX) + var(--_msDx) * var(--_uartStart)), 319)',
      msCurY: 'clamp(0, calc(var(--__1msCurY) + var(--_msDy) * var(--_uartStart)), 99)',
      msSentBtn: `if(
      style(--_uartStart: 1): var(--_msBtnRep);
      else: var(--__1msSentBtn)
    )`,
      msTgtLatch: 'var(--_msTgt)',
      msHeldBtn: 'var(--_msHeldNext)',
      msQuietUntil: msQuietUntilDefaultExpr(),
      msPendEdges: 'var(--_msPendNext)',
      msRawPrev: 'var(--_msRawBtn)',
      msTouchPrev: 'var(--_msTouch)',
      msDxL: `if(
      style(--_uartStart: 1): var(--_msDx8);
      else: var(--__1msDxL)
    )`,
      msDyL: `if(
      style(--_uartStart: 1): var(--_msDy8);
      else: var(--__1msDyL)
    )`,
      uartRbr: 'var(--_uartRbrNext)',
      uartDr: 'var(--_uartDrNext)',
      uartPhase: 'var(--_uartPhaseNext)',
    });
  }
  const emitDispatchFor = (regs) => {
    for (const reg of regs) {
      const defaultExpr = customDefaults[reg] ?? `var(--__1${reg})`;
      writeStream.write(dispatch.emitRegisterDispatch(reg, defaultExpr) + '\n');
    }
  };
  // Emitted in four labelled runs so the 16 dispatches scan as the
  // programmer-visible machine: data registers, then segments, then
  // control flow, then bookkeeping.
  writeStream.write('  /* general-purpose registers */\n');
  emitDispatchFor(['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI']);
  writeStream.write('  /* segment registers */\n');
  emitDispatchFor(['CS', 'DS', 'ES', 'SS']);
  writeStream.write('  /* instruction pointer & FLAGS */\n');
  emitDispatchFor(['IP', 'flags']);
  writeStream.write('  /* cycle counter + halt latch */\n');
  emitDispatchFor(['halt', 'cycleCount']);
  w('}');

  // Memory write slots - the CPU's write port onto the bus
  writeStream.write('/* ===== 3 · OUTPUT: MEMORY WRITE SLOTS ===== */\n\n');
  writeStream.write('.cpu {\n');
  writeStream.write('  /* The CPU\'s write port onto the bus: three (addr, val) slot pairs.\n');
  writeStream.write('     Slot N writes --memValN to linear address --memAddrN this tick\n');
  writeStream.write('     (addr -1 = slot idle); the shared --_writeWidth below picks byte\n');
  writeStream.write('     or word for every live slot. Three slots is the worst case: INT\n');
  writeStream.write('     (and the TF-trap / hardware-IRQ frame) pushes FLAGS, CS and IP\n');
  writeStream.write('     in one tick. */\n');
  writeStream.write(dispatch.emitMemoryWriteSlots() + '\n\n');
  writeStream.write('  /* --- write gates --- */\n');
  writeStream.write(dispatch.emitSlotLiveGates() + '\n\n');
  writeStream.write(dispatch.emitWriteWidthGate() + '\n\n');
  if (writableDisk) {
    writeStream.write(emitDiskWriteRemap(writableDisk) + '\n\n');
  }
  w('}');

  // CPU helpers - supporting definitions the dispatch above leans on:
  // the 8-bit register aliases (in-rule computed props) and the flag
  // arithmetic @functions (top-level, so emitted after the rule closes).
  // Only the CPU uses these, so they live with the CPU, not in the shared
  // bit & byte helpers.
  writeStream.write('/* ===== HELPERS ===== */\n\n');
  writeStream.write('.cpu {\n');
  writeStream.write('  /* --- register aliases (8-bit halves) --- */\n');
  writeStream.write('  /* Read-only views of the previous tick\'s (--__1) word registers. */\n');
  w(emitRegisterAliases());
  w('}');
  writeStream.write('/* --- flag arithmetic --- */\n\n');
  w(emitFlagFunctions());
  w(emitShiftFlagFunctions());
  w(emitShiftByNFlagFunctions());

  // 3. Chipset - the support chips around the CPU, one group PER CHIP. Each
  // chip's @property registrations, its derived wires, and its register
  // dispatch sit together under one banner so a reader meets each chip as a
  // whole. The @property order across the file is inert (name-resolved), so
  // homing each chip's declarations beside its logic is free.
  // Story order: the timer (time source) → the keyboard (input source) →
  // the interrupt controller (arbitrates both) → the DAC (output side).
  //
  // @functions/@property can't nest in a rule, so each chip emits its
  // @property blocks top-level, then a .motherboard {} block for its wires +
  // dispatch. The multiple .motherboard {} blocks merge into one computed
  // style on the player element.
  w('/* ===== CHIPSET ===== */');

  writeStream.write('/* ===== PIT TIMER (8253) ===== */\n\n');
  w(emitStatePropertiesFor('pit', templateOpts));
  writeStream.write('.motherboard {\n');
  writeStream.write('  /* --- timer countdown --- */\n');
  w(emitPitDerivation());
  writeStream.write('  /* --- registers --- */\n');
  emitDispatchFor(PIT_REGS);
  w('}');

  writeStream.write('/* ===== KEYBOARD CONTROLLER (8042) ===== */\n\n');
  w(emitStatePropertiesFor('kbd', templateOpts));
  writeStream.write('.motherboard {\n');
  writeStream.write('  /* --- edge detection --- */\n');
  w(emitKeyboardWires());
  writeStream.write('  /* --- registers --- */\n');
  emitDispatchFor(KBD_REGS);
  w('}');

  if (mouse) {
    writeStream.write('/* ===== SERIAL MOUSE (8250 UART @ COM1) ===== */\n\n');
    w(emitStatePropertiesFor('mouse', templateOpts));
    writeStream.write('.motherboard {\n');
    writeStream.write('  /* --- pointing surface, packet generator, UART --- */\n');
    w(emitMouseWires());
    writeStream.write('  /* --- registers --- */\n');
    emitDispatchFor(MOUSE_REGS);
    w('}');
  }

  writeStream.write('/* ===== PIC INTERRUPT CONTROLLER (8259) ===== */\n\n');
  w(emitStatePropertiesFor('pic', templateOpts));
  writeStream.write('.motherboard {\n');
  writeStream.write('  /* --- IRQ arbitration --- */\n');
  w(emitIRQArbitration(mouse));
  writeStream.write('  /* --- registers --- */\n');
  emitDispatchFor(PIC_REGS);
  w('}');

  writeStream.write('/* ===== VGA DAC ===== */\n\n');
  w(emitStatePropertiesFor('dac', templateOpts));
  writeStream.write('.motherboard {\n');
  writeStream.write('  /* --- index registers --- */\n');
  emitDispatchFor(DAC_REGS);
  w('}');

  // 4. Keyboard selectors - the :active key rules that turn an on-screen
  // key press into the --keyboard value, plus the --keyboard / --kbdHold
  // wire registrations they drive. The keyboard CONTROLLER (edge detection,
  // scancode latch, held set) lives in the chipset above; this section is
  // the input surface.
  w('/* ===== KEYBOARD SELECTORS ===== */');
  w(emitKeyboardWireProperties());
  w(emitKeyboardRules());

  // Mouse selectors - the 80×25 #mc-N cell grid that drives --mouseTgt.
  // The mouse CONTROLLER (packet generator + UART) lives in the chipset
  // above; this section is the pointing surface.
  if (mouse) {
    w('/* ===== MOUSE SELECTORS ===== */');
    w(emitMouseWireProperty());
    w(emitMouseCellRules());
  }

  // 5. Display - the pixel painter. Emits its own DISPLAY banner.
  w(emitPixelPaintRules());

  // =====================================================================
  // THE BULK - memory declarations, reads, writes, disk, clock
  // (This is ~99% of the file by volume: one @property per memory cell,
  //  one read arm per byte, one write-rule per cell, etc.)
  // =====================================================================

  w('/* ===== MEMORY DECLARATIONS ===== */');
  // The per-cell @property array - one declaration per memory cell, the
  // assembled power-on image in each initial-value. The subsystem-specific
  // declarations (registers, chipset, keyboard, write slots) have moved to
  // their own sections, so this is now purely the memory-cell array that
  // dominates the file.
  emitMemoryPropertiesStreaming(memOpts, writeStream);

  // readMem @function (large - one branch per memory byte)
  w('/* ===== MEMORY READS ===== */');
  emitReadMemStreaming(memOpts, writeStream);

  // Per-byte memory write rules - the write-slot registrations live with
  // them now, then the per-cell write cascade in its own .motherboard rule.
  w('/* ===== MEMORY WRITES ===== */');
  writeStream.write('/* --- write slot properties --- */\n\n');
  w(emitWriteSlotProperties());
  if (writableDisk) w(emitDiskAddrProperties());
  writeStream.write('/* --- per-cell write rules --- */\n\n');
  writeStream.write('.motherboard {\n');
  emitMemoryWriteRulesStreaming(memOpts, writeStream);
  w('}');

  // The disk read @function (one arm per disk byte)
  if (diskBytes) {
    w('/* ===== DISK ===== */');
    emitReadDiskByteStreaming(diskBytes, writeStream, writableDisk);
  }

  // 10. Clock - the tick engine: the animation that advances the beat, the
  // double-buffer reads that give each tick a stable view of memory, and the
  // store/execute keyframes that hand this tick's computed values over to be
  // next tick's current values. The --clock wire registration lives here too.
  w('/* ===== CLOCK ===== */');
  w(emitClockWireProperty());
  w('/* --- clock animation --- */');
  w(emitClockRule());
  w('/* --- double-buffer reads --- */');
  writeStream.write(emitClockPlumbingOpen() + '\n');
  writeStream.write('  /* this tick\'s stable view of every double-buffered value */\n');
  w(emitBufferReads(templateOpts));
  emitMemoryBufferReadsStreaming(memOpts, writeStream);
  w('}');

  // The value hand-over runs in two ordered phases per tick: store latches
  // this tick's computed values, then execute exposes them for next tick.
  w('/* --- 1 · store keyframe --- */');
  const storeKf = emitStoreKeyframe(templateOpts);
  const storeKfOpen = storeKf.replace('  }\n}', '');
  writeStream.write(storeKfOpen);
  emitMemoryStoreKeyframeStreaming(memOpts, writeStream);
  writeStream.write('  }\n}\n\n');

  w('/* --- 2 · execute keyframe --- */');
  const execKf = emitExecuteKeyframe(templateOpts);
  const execKfOpen = execKf.replace('  }\n}', '');
  writeStream.write(execKfOpen);
  emitMemoryExecuteKeyframeStreaming(memOpts, writeStream);
  writeStream.write('  }\n}\n\n');

  w('/* --- clock keyframes --- */');
  w(emitClockKeyframes());
}

// --- Streaming memory emitters (write directly, avoid building huge strings) ---

const CHUNK = 8192; // lines per write() call

// Chunked writer for the big per-address lists: append rowFor(item) for each
// item, flushing to the stream every CHUNK rows. Used by the PACK_SIZE===1
// branches, which have no address-gap comments.
function streamRows(ws, iterable, rowFor) {
  let buf = '';
  let count = 0;
  for (const item of iterable) {
    buf += rowFor(item);
    if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
  }
  if (buf) ws.write(buf);
}

// Chunked writer for the packed per-cell lists: like streamRows, but emits a
// run-delimiter comment before each row via preRow(prev, idx, indent).
// preRow defaults to cellGapComment (the address-gap marker); callers that
// need extra banners (e.g. the disk-shadow-cells marker) pass a stateful one.
function streamCellRows(ws, cells, indent, rowFor, preRow = cellGapComment) {
  let buf = '';
  let count = 0;
  let prev = -1;
  for (const idx of cells) {
    buf += preRow(prev, idx, indent);
    prev = idx;
    buf += rowFor(idx);
    if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
  }
  if (buf) ws.write(buf);
}

// Rom-disk window (guest side): 512 bytes at linear 0xD0000. Reads are
// dispatched through --readDiskByte; on writable carts, writes are remapped
// into the disk-shadow cells by --_dskAddrN below.
const DISK_WINDOW_BASE = 0xD0000;
const DISK_WINDOW_SIZE = 512;

// The LBA register is a normal writable word at linear 0x4F0 (see the
// 0x4F0 pitfall in docs/memory-layout.md). Compose it as low + high*256
// from the current PACK_SIZE's storage - shared by the window read arms
// and the write remap.
function lbaByteExprs() {
  const lo = PACK_SIZE === 1
    ? `var(--__1m1264)`
    : `mod(var(--__1mc${cellIdxOf(0x4F0)}), 256)`;
  const hi = PACK_SIZE === 1
    ? `var(--__1m1265)`
    : `round(down, var(--__1mc${cellIdxOf(0x4F1)}) / 256)`;
  return { lo, hi };
}

/**
 * Writable disk: per-slot window-write remap.
 *
 * The disk shadow lives as ordinary packed cells whose NAMES sit at
 * writableDisk.base (outside the 1 MB guest space), but every COMPUTED
 * value in the write path stays in disk-local byte units (0..diskLen).
 * That bound matters: Chrome stores computed numeric custom-property
 * values with only ~6 significant digits, so any computed value ≥ 1e6
 * silently loses precision (verified in Chromium - see LOGBOOK
 * 2026-07-06). Big constants may live in property names and in literal
 * arm keys, never in computed values.
 *
 * Per write slot:
 *   --_dskIn N  = 1 when memAddrN is inside the rom-disk window, else 0
 *                 (product of two clamp(0,...,1) step functions).
 *   --_dskOffN  = lba*512 + (memAddrN - 0xD0000) when inside - the
 *                 disk-local byte offset of the write - and -1 outside.
 *
 * Disk cells key their --applySlot cascade on --_dskOffN with disk-local
 * cell indices; RAM cells keep --memAddrN untouched. A write lands in
 * exactly one family: inside the window no RAM cell exists, and outside
 * the window --_dskOffN is -1 which matches no disk cell.
 */
function emitDiskWriteRemap(writableDisk) {
  const { lo, hi } = lbaByteExprs();
  const winLo = DISK_WINDOW_BASE;            // first window byte
  const winEnd = DISK_WINDOW_BASE + DISK_WINDOW_SIZE; // one past last
  const lines = ['  /* ===== WRITABLE-DISK WRITE REMAP (--_dskInN / --_dskOffN) ===== */',
                 '  /* Per slot: --_dskInN = 1 when memAddrN falls inside the rom-disk window,',
                 '     --_dskOffN = the disk-local byte offset of that write (-1 outside).',
                 '     Disk-shadow cells key their write cascade on --_dskOffN instead of',
                 '     --memAddrN - see the memory write rules. */'];
  for (let i = 0; i < NUM_WRITE_SLOTS; i++) {
    lines.push(
      `  --_dskIn${i}: calc(` +
      `clamp(0, var(--memAddr${i}) - ${winLo - 1}, 1) * ` +
      `clamp(0, ${winEnd} - var(--memAddr${i}), 1));`
    );
    lines.push(
      `  --_dskOff${i}: calc(var(--_dskIn${i}) * ` +
      `(var(--memAddr${i}) - ${winLo} + (${lo} + ${hi} * 256) * 512) ` +
      `+ var(--_dskIn${i}) - 1);`
    );
  }
  return lines.join('\n');
}

// Address-gap run-delimiter comments for the big per-cell / per-byte lists:
// the address set only covers zones this build populates, so the numbering
// jumps at zone boundaries (e.g. straight from the mode 13h framebuffer to
// text VGA at 0xB8000). Mark any jump ≥ GAP_MIN_BYTES so a reader scanning
// the list sees why. Comments only - every evaluator strips them at
// tokenize time.
const GAP_MIN_BYTES = 16;
function hex(n) { return '0x' + n.toString(16).toUpperCase(); }
function cellGapComment(prevIdx, idx, indent) {
  if (prevIdx < 0 || (idx - prevIdx - 1) * PACK_SIZE < GAP_MIN_BYTES) return '';
  return `${indent}/* gap: bytes ${hex((prevIdx + 1) * PACK_SIZE)}-${hex(idx * PACK_SIZE - 1)} unpopulated in this build */\n`;
}
function byteGapComment(prevAddr, addr, indent) {
  if (prevAddr < 0 || addr - prevAddr - 1 < GAP_MIN_BYTES) return '';
  return `${indent}/* gap: bytes ${hex(prevAddr + 1)}-${hex(addr - 1)} unpopulated in this build */\n`;
}

function emitMemoryPropertiesStreaming(opts, ws) {
  const { addresses, _cells: cells, _initMem: initMem, _cellInit: cellInit } = opts;
  if (PACK_SIZE === 1) {
    ws.write(`/* memory bytes: one @property per byte (--mN);\n   initial-value = the assembled memory image, so power-on state costs no writes */\n`);
    streamRows(ws, addresses, (addr) => {
      const init = initMem.get(addr) || 0;
      return `@property --m${addr} {\n  syntax: '<integer>';\n  inherits: true;\n  initial-value: ${init};\n}\n\n`;
    });
    return;
  }
  // Packed: one @property per cell. `--mc{cellIdx}` holds PACK_SIZE bytes.
  const diskCellStart = opts.writableDisk ? cellIdxOf(opts.writableDisk.base) : -1;
  ws.write(`/* memory cells: one @property per ${PACK_SIZE}-byte cell (--mcN holds bytes 2N and 2N+1);\n   initial-value = the assembled memory image, so power-on state costs no writes */\n`);
  // The disk-shadow-cells banner replaces the address-gap comment at the
  // first shadow cell; every other cell gets the ordinary gap marker.
  let inDiskCells = false;
  const preRow = (prev, idx, indent) => {
    if (!inDiskCells && diskCellStart !== -1 && idx >= diskCellStart) {
      inDiskCells = true;
      return `/* disk-shadow cells: the writable floppy's bytes, named outside the 1 MB guest space */\n`;
    }
    return cellGapComment(prev, idx, indent);
  };
  streamCellRows(ws, cells, '', (idx) => {
    const init = cellInit.get(idx) || 0;
    return `@property --mc${idx} {\n  syntax: '<integer>';\n  inherits: true;\n  initial-value: ${init};\n}\n\n`;
  }, preRow);
}

function emitReadMemStreaming(opts, ws) {
  const { addresses, biosBytes, diskBytes, writableDisk } = opts;
  ws.write(`@function --readMem(--at <integer>) returns <integer> {\n  result: if(\n`);
  let buf = '';
  let count = 0;
  // Writable memory region
  // Addresses 0x04F4-0x04F5 (1268-1269) bridge to --keyboard for BIOS
  // INT 16h (gossamer reads this word; corduroy/muslin use port 0x60).
  // The bridge lives in the BDA intra-application area (0x4F0-0x4FF,
  // beside the 0x4F0 LBA latch) because that's the one region real
  // DOSes provably leave alone. It USED to sit at 0x0500-0x0501 - but
  // MS-DOS's boot sector loads the root directory at 0x0500 (DirOff in
  // MSBOOT.ASM) and could never read its own buffer back through the
  // bridge, so MS-DOS 4.0 boot died at "Non-System disk". 0x4F2/0x4F3
  // are taken too (corduroy's requested-video-mode and CGA pal-reg
  // shadows) - every platform register gets its own address.
  // Region run-delimiter comments below (RAM / bridge / ROM / disk window)
  // are for the reader - every evaluator strips comments at tokenize time.
  buf += `    /* conventional RAM: one arm per byte, reading its backing cell */\n`;
  let afterBridge = false;
  let prevAddr = -1;
  for (const addr of addresses) {
    // Disk-shadow cells are not guest-addressable - the CPU can only reach
    // them through the 0xD0000 window (whose arms are emitted below). Skip
    // their --readMem arms; they'd never match and only bloat the dispatch.
    if (writableDisk && addr >= writableDisk.base && addr < writableDisk.base + writableDisk.length) {
      continue;
    }
    if (afterBridge && addr > 0x04F5) {
      buf += `    /* conventional RAM (continued) */\n`;
      afterBridge = false;
    } else {
      buf += byteGapComment(prevAddr, addr, '    ');
    }
    prevAddr = addr;
    if (addr === 0x04F4) {
      buf += `    /* keyboard MMIO bridge: BIOS INT 16h reads the player's --keyboard word here */\n`;
      buf += `    style(--at: 1268): --lowerBytes(var(--__1keyboard), 8);\n`;
      afterBridge = true;
    } else if (addr === 0x04F5) {
      buf += `    style(--at: 1269): --rightShift(var(--__1keyboard), 8);\n`;
      afterBridge = true;
    } else if (PACK_SIZE === 1) {
      buf += `    style(--at: ${addr}): var(--__1m${addr});\n`;
    } else {
      const idx = cellIdxOf(addr);
      const off = cellOffOf(addr);
      // Inline byte extraction for fewer @function call frames. Chrome handles
      // either shape; flat arithmetic is friendlier to the pattern recogniser.
      // PACK_SIZE=2: off=0 = low byte, off=1 = high byte. Values fit in i32.
      let expr;
      if (off === 0) expr = `mod(var(--__1mc${idx}), 256)`;
      else expr = `round(down, var(--__1mc${idx}) / 256)`;
      buf += `    style(--at: ${addr}): ${expr};\n`;
    }
    if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
  }
  // BIOS region (read-only constants) - always included
  if (biosBytes && biosBytes.length > 0) {
    buf += `    /* BIOS ROM at 0xF0000: read-only, so each byte is a baked literal (zero bytes omitted - the else arm returns 0) */\n`;
    for (let i = 0; i < biosBytes.length; i++) {
      if (biosBytes[i] !== 0) {
        buf += `    style(--at: ${0xF0000 + i}): ${biosBytes[i]};\n`;
        if (buf.length > 8192) { ws.write(buf); buf = ''; }
      }
    }
  }
  // Rom-disk window: 0xD0000..0xD01FF (512 bytes). Each read is dispatched
  // to --readDiskByte(lba_word, offset). The LBA register is a normal
  // writable word at linear 0x4F0 composed here as low + high*256 - same
  // pattern as other 16-bit reads. The source changes with PACK_SIZE:
  //   pack=1: bytes 0x4F0/0x4F1 live in --__1m1264/__1m1265.
  //   pack=2: both bytes live in cell --__1mc632 (1264/2=632) as low/high
  //           halves - extract with mod/round-down-div, same shape as the
  //           read dispatch above.
  if (diskBytes) {
    const { lo: lbaLowExpr, hi: lbaHighExpr } = lbaByteExprs();
    // The key is the plain disk byte index (lba*512 + offset) in both rom
    // and writable modes. It must stay a SMALL computed value: Chrome's
    // computed numeric custom properties only carry ~6 significant digits,
    // so keying on the shadow's high linear address would corrupt every
    // dispatch in a spec-compliant evaluator. (Disk indices themselves
    // stay exact up to ~1e6, i.e. ~1 MB of disk - a pre-existing bound
    // shared with rom mode.)
    buf += `    /* rom-disk window at 0xD0000 (512 bytes): reads route to --readDiskByte at sector LBA*512 + offset; the LBA register is the RAM word at 0x4F0 */\n`;
    for (let i = 0; i < DISK_WINDOW_SIZE; i++) {
      const addr = DISK_WINDOW_BASE + i;
      buf += `    style(--at: ${addr}): --readDiskByte(calc((${lbaLowExpr} + ${lbaHighExpr} * 256) * 512 + ${i}));\n`;
      if (buf.length > 8192) { ws.write(buf); buf = ''; }
    }
  }
  if (buf) ws.write(buf);
  ws.write(`  else: 0);\n}\n\n`);
  // --readDiskByte itself is emitted later, under the DISK banner -
  // @function order is irrelevant to CSS, so the forward reference from
  // the window arms above is fine.
}

function emitReadDiskByteStreaming(diskBytes, ws, writableDisk) {
  // --idx = lba*512 + offset (disk byte index) in both modes.
  // Rom disks: one branch per non-zero byte, literal result - calcite
  // flattens this dispatch into a byte-array lookup.
  // Writable disks: one branch per byte (zero bytes included - any free
  // sector can be written then read back), each reading its shadow cell.
  // The arm shape is byte extraction on --__1mc<(base+idx)/PACK_SIZE> -
  // the same extraction --readMem's packed arms use, with a constant
  // offset between the key space and the cell-name space (the shadow's
  // high name base never appears as a computed value - Chrome only keeps
  // ~6 significant digits on those).
  ws.write(`@function --readDiskByte(--idx <integer>) returns <integer> {\n  result: if(\n`);
  let buf = '';
  if (writableDisk) {
    buf += `    /* writable disk: one arm per byte, reading its shadow cell (zero bytes included - a freshly written sector must read back) */\n`;
    const { base } = writableDisk;
    for (let idx = 0; idx < diskBytes.length; idx++) {
      const nameAddr = base + idx;
      let expr;
      if (PACK_SIZE === 1) {
        expr = `var(--__1m${nameAddr})`;
      } else {
        const cell = cellIdxOf(nameAddr);
        expr = cellOffOf(nameAddr) === 0
          ? `mod(var(--__1mc${cell}), 256)`
          : `round(down, var(--__1mc${cell}) / 256)`;
      }
      buf += `    style(--idx: ${idx}): ${expr};\n`;
      if (buf.length > 8192) { ws.write(buf); buf = ''; }
    }
  } else {
    buf += `    /* rom disk: one literal arm per non-zero byte (zero bytes fall to the else) */\n`;
    for (let idx = 0; idx < diskBytes.length; idx++) {
      const b = diskBytes[idx];
      if (b !== 0) {
        buf += `    style(--idx: ${idx}): ${b};\n`;
        if (buf.length > 8192) { ws.write(buf); buf = ''; }
      }
    }
  }
  if (buf) ws.write(buf);
  ws.write(`  else: 0);\n}\n\n`);
}

function emitMemoryBufferReadsStreaming(opts, ws) {
  const { addresses, _cells: cells, _initMem: initMem, _cellInit: cellInit } = opts;
  ws.write(`  /* memory-cell double-buffer reads: this tick's stable view of every cell */\n`);
  if (PACK_SIZE === 1) {
    streamRows(ws, addresses, (addr) => {
      const init = initMem.get(addr) || 0;
      return `  --__1m${addr}: var(--__2m${addr}, ${init});\n`;
    });
    return;
  }
  streamCellRows(ws, cells, '  ', (idx) => {
    const init = cellInit.get(idx) || 0;
    return `  --__1mc${idx}: var(--__2mc${idx}, ${init});\n`;
  });
}

function emitMemoryWriteRulesStreaming(opts, ws) {
  // Each byte's write rule checks NUM_WRITE_SLOTS slots to see if the
  // current tick is writing to this address. Every slot is gated by
  // --_slotNLive (1 only when some opcode uses slot N or TF/IRQ is
  // pushing). The global --_writeWidth gate (1 = byte at memAddrN,
  // 2 = word with lo at memAddrN, hi at memAddrN+1) applies to every
  // active slot uniformly. Non-writing instructions set all gates to 0
  // so every branch rejects without touching --memAddrN.
  //
  // CSS `style(A) and style(B)` short-circuits on the first false operand,
  // so idle ticks pay one style-query per slot per byte. Calcite's
  // packed-broadcast-write recogniser peels each gate off and compiles
  // the whole shape to a gated address-table lookup, skipping the entire
  // table when the gate reads 0 - see
  // calcite/crates/calcite-core/src/pattern/packed_broadcast_write.rs.
  const { addresses, writableDisk } = opts;
  // Disk-shadow cells form their own write family keyed on --_dskOffN
  // (the disk-local byte offset of a window write; -1 otherwise), with
  // disk-local cell indices in the offset arithmetic. RAM cells keep
  // --memAddrN and guest-linear indices, byte-identical to rom builds.
  // The two families have disjoint cell sets and each write matches at
  // most one - see emitDiskWriteRemap.
  const isDiskCell = (byteAddr) =>
    writableDisk && byteAddr >= writableDisk.base && byteAddr < writableDisk.base + writableDisk.length;
  if (PACK_SIZE === 1) {
    // Per byte at address A, each slot can hit two ways:
    //   (1) memAddrN == A             : slot's lo half lands here.
    //                                    width=1 → val is byte; width=2 → val is word, take lo via --lowerBytes.
    //   (2) memAddrN == A-1, width=2  : slot's hi half lands here. Take hi via --rightShift.
    ws.write(`  /* one write rule per byte: ${NUM_WRITE_SLOTS} slots x (lo half at addr, hi half at addr-1) checks, else hold */\n`);
    let buf = '';
    let count = 0;
    for (const addr of addresses) {
      const hold = `var(--__1m${addr})`;
      // Disk bytes compare --_dskOffN against their DISK-LOCAL offset
      // (small, Chrome-exact); RAM bytes compare --memAddrN against their
      // guest-linear address.
      const disk = isDiskCell(addr);
      const av = disk ? '--_dskOff' : '--memAddr';
      const key = disk ? addr - writableDisk.base : addr;
      const branches = [];
      for (let i = 0; i < NUM_WRITE_SLOTS; i++) {
        // (1) lo/byte half at addr.
        branches.push(`    style(--_slot${i}Live: 1) and style(${av}${i}: ${key}): if(style(--_writeWidth: 2): --lowerBytes(var(--memVal${i}), 8); else: var(--memVal${i}));`);
        // (2) hi half at addr (slot's pair is at addr-1..addr).
        branches.push(`    style(--_slot${i}Live: 1) and style(${av}${i}: ${key - 1}) and style(--_writeWidth: 2): --rightShift(var(--memVal${i}), 8);`);
      }
      buf += `  --m${addr}: if(\n${branches.join('\n')}\n    else: ${hold});\n`;
      if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
    }
    if (buf) ws.write(buf);
    return;
  }
  // Packed: each cell's value is a NUM_WRITE_SLOTS-deep cascade of
  // --applySlot calls. Slot 0 is outermost (applied last) so it wins on
  // same-cell collisions - matching the legacy top-down byte-level
  // dispatch semantics. Every --applySlot short-circuits to its input
  // cell when --_slotNLive=0, so idle ticks pay NUM_WRITE_SLOTS style-query
  // gates per cell (down from 6 in the byte-slot scheme).
  //
  // applySlot args:
  //   cell       : previous-tick cell value (b0 | b1<<8)
  //   live       : --_slotNLive (1 if slot fires)
  //   loOff      : memAddrN - cellBase            (slot's lo/byte half offset within this cell)
  //   hiOff      : memAddrN + 1 - cellBase        (slot's hi half offset within this cell, only meaningful when width=2)
  //   val        : memValN - byte (width=1) or 16-bit word (width=2, lo at memAddrN, hi at memAddrN+1)
  //   width      : --_writeWidth (1 or 2; shared across all slots this tick)
  // applySlot handles aligned word writes (loOff=0, hiOff=1, width=2), the
  // straddle cases (loOff=1 → lo half lands here at off 1; hiOff=0 → hi half
  // lands here at off 0, both gated on width=2), and width=1 byte writes.
  const cells = opts._cells;
  ws.write(`  /* one write rule per cell: a ${NUM_WRITE_SLOTS}-slot --applySlot cascade (slot 0 outermost, so it wins same-cell collisions). Idle slots short-circuit at their --_slotNLive gate. */\n`);
  let buf = '';
  let count = 0;
  const diskBaseCell = writableDisk ? cellIdxOf(writableDisk.base) : -1;
  let inDiskCells = false;
  let prev = -1;
  for (const idx of cells) {
    if (!inDiskCells && diskBaseCell !== -1 && idx >= diskBaseCell) {
      buf += `  /* disk-shadow cells: keyed on --_dskOffN (disk-local offsets) instead of --memAddrN */\n`;
      inDiskCells = true;
    } else {
      buf += cellGapComment(prev, idx, '  ');
    }
    prev = idx;
    // Build the cascade inside-out: start with __1mcIDX, then slot N-1, ..., slot 0.
    // The `${idx} * ${PACK_SIZE}` arithmetic (rather than the pre-folded
    // `${cellBase(idx)}`) is deliberate: it keeps the per-cell digit run
    // equal to the cell index, so the parser fast-path classifies it as
    // an Addr hole (not a Free hole) and can template the whole run.
    //
    // Disk cells key on --_dskOffN with DISK-LOCAL cell indices (idx -
    // diskBaseCell): every computed value in the comparison stays below
    // Chrome's ~6-significant-digit precision cliff; only the property
    // NAME carries the high base.
    const disk = isDiskCell(cellBase(idx));
    const av = disk ? '--_dskOff' : '--memAddr';
    const key = disk ? idx - diskBaseCell : idx;
    let expr = `var(--__1mc${idx})`;
    for (let slot = NUM_WRITE_SLOTS - 1; slot >= 0; slot--) {
      expr = `--applySlot(${expr}, var(--_slot${slot}Live), calc(var(${av}${slot}) - ${key} * ${PACK_SIZE}), calc(var(${av}${slot}) + 1 - ${key} * ${PACK_SIZE}), var(--memVal${slot}), var(--_writeWidth))`;
    }
    buf += `  --mc${idx}: ${expr};\n`;
    if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
  }
  if (buf) ws.write(buf);
}

function emitMemoryStoreKeyframeStreaming(opts, ws) {
  const { addresses, _cells: cells, _initMem: initMem, _cellInit: cellInit } = opts;
  ws.write(`    /* memory cells: latch last tick's computed values into the __2 buffer */\n`);
  if (PACK_SIZE === 1) {
    streamRows(ws, addresses, (addr) => {
      const init = initMem.get(addr) || 0;
      return `    --__2m${addr}: var(--__0m${addr}, ${init});\n`;
    });
    return;
  }
  streamCellRows(ws, cells, '    ', (idx) => {
    const init = cellInit.get(idx) || 0;
    return `    --__2mc${idx}: var(--__0mc${idx}, ${init});\n`;
  });
}

function emitMemoryExecuteKeyframeStreaming(opts, ws) {
  const { addresses, _cells: cells } = opts;
  ws.write(`    /* memory cells: expose the freshly computed values as __0 for the next store */\n`);
  if (PACK_SIZE === 1) {
    streamRows(ws, addresses, (addr) => `    --__0m${addr}: var(--m${addr});\n`);
    return;
  }
  streamCellRows(ws, cells, '    ', (idx) => `    --__0mc${idx}: var(--mc${idx});\n`);
}
