// Top-level CSS generation orchestrator.
// Collects dispatch entries from all opcode emitters, assembles per-register
// dispatch tables, and combines with infrastructure (clock, memory, decode).

import { emitCSSLib } from './css-lib.mjs';
import { emitDecodeFunction, emitDecodeProperties } from './decode.mjs';
import {
  emitPropertyDecls, emitBufferReads, emitRegisterAliases,
  emitStoreKeyframe, emitExecuteKeyframe, emitClockKeyframes,
  emitClockRule, emitClockPlumbingOpen,
  emitKeyboardRules,
} from './template.mjs';
import { emitPixelPaintRules } from './pixels.mjs';
import { emitWriteSlotProperties, emitDiskAddrProperties, buildInitialMemory, buildAddressSet,
         NUM_WRITE_SLOTS, PACK_SIZE, buildCellSet, buildInitialMemoryPacked,
         cellIdxOf, cellOffOf, cellBase } from './memory.mjs';
import { emitFlagFunctions } from './patterns/flags.mjs';

// Opcode emitters
import { emitMOV_RegImm16, emitMOV_RegImm8, emitMOV_RegRM, emitMOV_SegRM, emitMOV_AccMem, emitLEA, emitLES, emitLDS } from './patterns/mov.mjs';
import { emitAllALU } from './patterns/alu.mjs';
import { emitAllControl } from './patterns/control.mjs';
import { emitAllStack } from './patterns/stack.mjs';
import { emitAllMisc, emitPeripheralCompute, emitIRQCompute, pitCounterDefaultExpr, picPendingDefaultExpr } from './patterns/misc.mjs';
import { emitAllGroups } from './patterns/group.mjs';
import { emitAllShifts, emitShiftFlagFunctions, emitShiftByNFlagFunctions } from './patterns/shift.mjs';
import { emitAll186 } from './patterns/extended186.mjs';
import { emitCycleCounts } from './cycle-counts.mjs';

/**
 * Dispatch table builder. Collects per-register entries keyed by opcode.
 */
class DispatchTable {
  constructor() {
    // regEntries: Map<regName, Map<opcode, {expr, comment}>>
    this.regEntries = new Map();
    // memWrites: [{opcode, addrExpr, valExpr, comment}]
    // Each opcode can contribute to up to 3 write slots.
    this.memWritesByOpcode = new Map(); // opcode → [{addrExpr, valExpr, comment}]
  }

  addEntry(reg, opcode, expr, comment = '') {
    if (!this.regEntries.has(reg)) {
      this.regEntries.set(reg, new Map());
    }
    const regMap = this.regEntries.get(reg);
    if (regMap.has(opcode)) {
      // Multiple emitters writing the same register for same opcode
      // — this is an error in the emitter logic.
      throw new Error(`Duplicate dispatch entry: ${reg} opcode 0x${opcode.toString(16)} — existing: ${regMap.get(opcode).comment}, new: ${comment}`);
    }
    // For flags: ALU flag functions build flags from scratch but must preserve
    // TF/IF/DF (bits 8-10) from the previous tick. Instructions that DO modify
    // these bits (STI/CLI/CLD/STD/INT/IRET/POPF) already set them explicitly.
    // AF (bit 4) is computed by the flag functions themselves for ADD/SUB/etc.
    // TF|IF|DF (bits 8-10) preservation is handled at each call site or inside the
    // flag functions themselves (inc/dec). No automatic wrapper — it breaks mixed
    // dispatches that have both flag-computing and passthrough branches.
    regMap.set(opcode, { expr, comment });
  }

  /**
   * Emit --unknownOp: 1 if the current opcode has no IP dispatch entry, 0 otherwise.
   * Prefixes (0x26/0x2E/0x36/0x3E/0xF2/0xF3) are excluded — they're handled at decode level.
   */
  emitUnknownOpFlag() {
    const ipEntries = this.regEntries.get('IP');
    if (!ipEntries) return '  --unknownOp: 1;';
    const opcodes = [...ipEntries.keys()].sort((a, b) => a - b);
    const lines = ['  --unknownOp: if('];
    for (const op of opcodes) {
      lines.push(`    style(--opcode: ${op}): 0;`);
    }
    lines.push('    /* any opcode not implemented above is unknown — halt */');
    lines.push('  else: 1);');
    return lines.join('\n');
  }

  addMemWrite(opcode, addrExpr, valExpr, comment = '') {
    if (!this.memWritesByOpcode.has(opcode)) {
      this.memWritesByOpcode.set(opcode, []);
    }
    this.memWritesByOpcode.get(opcode).push({ addrExpr, valExpr, comment, width: 1 });
  }

  /**
   * Declare a 16-bit word write at runtime byte-address `addrExpr` with
   * value `wordValExpr` (the un-split word; lo lands at addrExpr, hi at
   * addrExpr+1). Allocates one width=2 slot, regardless of the surface
   * shape of valExpr — this is the explicit alternative to the regex-based
   * fusion in emitMemoryWriteSlots, used when the value/addr expressions
   * are structurally a top-level if(...) and don't pattern-match the
   * canonical --lowerBytes/--rightShift split.
   */
  addMemWriteWord(opcode, addrExpr, wordValExpr, comment = '') {
    if (!this.memWritesByOpcode.has(opcode)) {
      this.memWritesByOpcode.set(opcode, []);
    }
    this.memWritesByOpcode.get(opcode).push({ addrExpr, valExpr: wordValExpr, comment, width: 2 });
  }

  /**
   * Emit the dispatch table for one register as a CSS if() expression.
   * Returns the full property declaration (emitted inside .cpu for CPU
   * registers, .motherboard for chipset state — same player element).
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
      for (const [opcode, { expr, comment }] of sorted) {
        const commentStr = comment ? ` /* ${comment} */` : '';
        dispatchLines.push(`    style(--opcode: ${opcode}): ${expr};${commentStr}`);
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
      'picPending': `--and(${/* edge-OR applied so concurrent edges don't get dropped */''}--or(--or(var(--__1picPending), var(--_pitFired)), calc(var(--_kbdEdge) * 2)), --not(var(--_irqBit)))`,
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
   * Each slot fuses an addr/addr+1 byte-write pair (lo + hi) into a single
   * 16-bit word slot when possible. The detection looks for the canonical
   * pair shape that addMemWrite call sites emit:
   *   addMemWrite(opcode, addr,     '--lowerBytes(X, 8)', 'lo')
   *   addMemWrite(opcode, addr + 1, '--rightShift(X, 8)', 'hi')
   * Both halves must reference the same value expression X. When both
   * conditions hold, the pair becomes one width=2 slot whose --memValN is
   * X (the un-split word). Otherwise each addMemWrite uses one width=1
   * slot whose --memValN is the byte expression.
   *
   * Worst case: INT pushes FLAGS/CS/IP = 3 word writes = 3 width-2 slots.
   *
   * Slot 0 is the outermost in the cell cascade so it wins on collisions.
   * For multi-slot opcodes the call order determines which slot carries
   * which pair — slot 0 first, then slot 1, then slot 2. Multi-pair
   * opcodes (like INT) whose pairs must all execute in one tick can rely
   * on the slot order matching call order.
   */
  emitMemoryWriteSlots() {
    // Phase 1: fuse adjacent (addr, lo) / (addr+1, hi) pairs into width=2 slots.
    // Each opcode's `writes` is the call-order list from addMemWrite /
    // addMemWriteWord. Writes already declared as width=2 (via
    // addMemWriteWord) bypass regex fusion. Width=1 writes are
    // pair-detected against their immediate successor; on match, the pair
    // collapses into one width=2 slot.
    const fusedByOpcode = new Map();
    for (const [opcode, writes] of this.memWritesByOpcode) {
      const fused = [];
      let i = 0;
      while (i < writes.length) {
        const cur = writes[i];
        if (cur.width === 2) {
          fused.push(cur);
          i += 1;
          continue;
        }
        const next = writes[i + 1];
        const pair = (next && next.width === 1) ? tryFuseWordPair(cur, next) : null;
        if (pair) {
          fused.push(pair);
          i += 2;
        } else {
          fused.push({ width: 1, addrExpr: cur.addrExpr, valExpr: cur.valExpr, comment: cur.comment });
          i += 1;
        }
      }
      if (fused.length > NUM_WRITE_SLOTS) {
        throw new Error(`Opcode 0x${opcode.toString(16)} uses ${fused.length} memory write slots after fusion (max ${NUM_WRITE_SLOTS})`);
      }
      fusedByOpcode.set(opcode, fused);
    }

    const slots = Array.from({ length: NUM_WRITE_SLOTS }, () => []);
    for (const [opcode, fused] of fusedByOpcode) {
      for (let i = 0; i < fused.length; i++) {
        slots[i].push({ opcode, ...fused[i] });
      }
    }
    // Stash per-slot {opcode, width} lists so emitSlotLiveGates / emitSlotWidthGates
    // can emit the corresponding dispatches.
    this._slotMeta = slots.map(entries => entries.map(e => ({ opcode: e.opcode, width: e.width })));

    // TF trap and IRQ delivery both push FLAGS/CS/IP — three word-aligned
    // pushes. Each lands in one width=2 slot. Stack is always even-aligned
    // (SP starts even, decrements by 2) so no straddle here.
    const ssBase = 'calc(var(--__1SS) * 16)';
    // Wrap SP-K to 16 bits — without this, IRQ/TF push at SP=0 lands one
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

    const lines = [];
    for (let slot = 0; slot < NUM_WRITE_SLOTS; slot++) {
      lines.push(`  --memAddr${slot}: if(`);
      lines.push(`    style(--_tf: 1): ${intAddr[slot]};`);
      lines.push(`    style(--_irqActive: 1): ${intAddr[slot]};`);
      for (const { opcode, addrExpr, comment } of slots[slot]) {
        lines.push(`    style(--opcode: ${opcode}): ${addrExpr}; /* ${comment || ''} */`);
      }
      lines.push(`  else: -1);`);

      lines.push(`  --memVal${slot}: if(`);
      lines.push(`    style(--_tf: 1): ${intVal[slot]};`);
      lines.push(`    style(--_irqActive: 1): ${intVal[slot]};`);
      for (const { opcode, valExpr, comment } of slots[slot]) {
        lines.push(`    style(--opcode: ${opcode}): ${valExpr}; /* ${comment || ''} */`);
      }
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
    const lines = ['  /* Slot-live gates — skip per-byte memory write checks when no slot fires this tick */'];
    for (let slot = 0; slot < NUM_WRITE_SLOTS; slot++) {
      const meta = this._slotMeta[slot];
      const branches = [];
      // TF trap and IRQ delivery push FLAGS/CS/IP — all slots live.
      branches.push(`    style(--_tf: 1): 1;`);
      branches.push(`    style(--_irqActive: 1): 1;`);
      for (const { opcode } of meta) {
        branches.push(`    style(--opcode: ${opcode}): 1;`);
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
   * writes within one tick — every opcode is either purely byte (STOSB,
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
    // it doesn't ALSO have a width=1 slot — that would mean the opcode
    // mixes widths in one tick, which the global-width design can't
    // express. (No kiln opcode does this today; the check is to fail
    // fast if a future emitter accidentally introduces one.)
    const widthByOpcode = new Map(); // opcode → Set<width>
    for (let slot = 0; slot < NUM_WRITE_SLOTS; slot++) {
      for (const { opcode, width } of this._slotMeta[slot]) {
        if (!widthByOpcode.has(opcode)) widthByOpcode.set(opcode, new Set());
        widthByOpcode.get(opcode).add(width);
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
          `Opcode 0x${opcode.toString(16)} mixes byte and word writes in one tick — ` +
          `${perSlot.join(', ')}. The global --_writeWidth design can't express this. ` +
          `Either split the opcode across ticks or restore per-slot widths.`
        );
      }
      if (widths.has(2)) wordOpcodes.push(opcode);
    }
    wordOpcodes.sort((a, b) => a - b);

    const lines = ['  /* Global write-width gate — 1=byte, 2=word (addr+1 carries hi byte). Shared across slots. */'];
    const branches = [];
    branches.push(`    style(--_tf: 1): 2;`);
    branches.push(`    style(--_irqActive: 1): 2;`);
    for (const op of wordOpcodes) {
      branches.push(`    style(--opcode: ${op}): 2;`);
    }
    lines.push(`  --_writeWidth: if(`);
    lines.push(branches.join('\n'));
    lines.push(`  else: 1);`);
    return lines.join('\n');
  }
}

/**
 * Try to fuse two consecutive memory writes into one width=2 slot.
 * Returns a fused descriptor `{width:2, addrExpr, valExpr, comment}` or null.
 *
 * Pair criteria — the canonical lo/hi shape addMemWrite call sites emit:
 *   lo: addrExpr=A,           valExpr='--lowerBytes(X, 8)'
 *   hi: addrExpr=A+1,         valExpr='--rightShift(X, 8)'
 * Also handles the dispatch-conditional shape:
 *   lo: 'if(style(--reg: 0): --lowerBytes(X0, 8); style(--reg: 1): --lowerBytes(X1, 8); ... else: 0)'
 *   hi: 'if(style(--reg: 0): --rightShift(X0, 8); style(--reg: 1): --rightShift(X1, 8); ... else: 0)'
 * — same dispatch keys, paired --lowerBytes/--rightShift over the same word X.
 *
 * The fused slot's value is X (or the dispatch over X-values, with
 * --lowerBytes/--rightShift wrappers stripped). The CSS write-side splits
 * the word back into lo at A and hi at A+1 either via --applySlot (packed)
 * or the per-byte write rule (unpacked).
 */
function tryFuseWordPair(lo, hi) {
  // Address criterion: hi.addrExpr must be the byte-after lo.addrExpr.
  if (!isAddrPlusOne(lo.addrExpr, hi.addrExpr)) return null;

  const wordVal = fuseWordVal(lo.valExpr, hi.valExpr);
  if (wordVal == null) return null;

  return {
    width: 2,
    addrExpr: lo.addrExpr,
    valExpr: wordVal,
    comment: lo.comment ? lo.comment.replace(/\s*lo\s*$/i, '').trim() : '',
  };
}

/**
 * Given paired lo/hi value expressions, return the fused un-split word
 * expression, or null if they don't match.
 *
 * Direct case:
 *   lo='--lowerBytes(X, 8)', hi='--rightShift(X, 8)' → returns X
 *
 * Dispatch case:
 *   lo='if(<branchKey>: --lowerBytes(Xn, 8); ... else: 0)'
 *   hi='if(<branchKey>: --rightShift(Xn, 8); ... else: 0)'
 *   → returns 'if(<branchKey>: Xn; ... else: 0)' if every branch pairs cleanly.
 */
function fuseWordVal(loVal, hiVal) {
  // Direct shape.
  const direct = matchLoHiPair(loVal, hiVal);
  if (direct != null) return direct;

  // Dispatch shape: parse both as `if(<branches>; else: 0)`.
  const loBr = parseIfBranches(loVal);
  const hiBr = parseIfBranches(hiVal);
  if (!loBr || !hiBr) return null;
  if (loBr.branches.length !== hiBr.branches.length) return null;
  if (loBr.fallback !== '0' || hiBr.fallback !== '0') return null;
  // Each pair of corresponding branches must share the same condition AND
  // pair as --lowerBytes/--rightShift over the same word.
  const fusedBranches = [];
  for (let i = 0; i < loBr.branches.length; i++) {
    const lb = loBr.branches[i];
    const hb = hiBr.branches[i];
    if (lb.cond !== hb.cond) return null;
    const word = matchLoHiPair(lb.body, hb.body);
    if (word == null) return null;
    fusedBranches.push({ cond: lb.cond, body: word });
  }
  return `if(${fusedBranches.map(b => `${b.cond}: ${b.body}`).join('; ')}; else: 0)`;
}

/**
 * Match the canonical (--lowerBytes(X, 8), --rightShift(X, 8)) pair.
 * Returns X if both expressions reference the same X, else null.
 */
function matchLoHiPair(loVal, hiVal) {
  const loMatch = /^--lowerBytes\((.+),\s*8\)$/.exec(loVal);
  const hiMatch = /^--rightShift\((.+),\s*8\)$/.exec(hiVal);
  if (!loMatch || !hiMatch) return null;
  // Allow the hi expression to be `--rightShift(--lowerBytes(X, 16), 8)` —
  // some pattern files (Group FF reg=0/1) double-wrap to keep the result
  // inside i32 even when X arithmetic could overflow. The lo form is
  // `--lowerBytes(X, 8)`; the matching hi keeps the same X.
  const hiX = hiMatch[1];
  const hiInnerMatch = /^--lowerBytes\((.+),\s*16\)$/.exec(hiX);
  const hiNormalised = hiInnerMatch ? hiInnerMatch[1] : hiX;
  if (loMatch[1] !== hiNormalised) return null;
  return loMatch[1];
}

/**
 * Parse an `if(<branches>; else: <fallback>)` expression into its parts.
 * Returns `{ branches: [{cond, body}], fallback }` or null if the shape
 * doesn't match.
 *
 * The parser is paren-counting (not regex) because branch bodies routinely
 * contain nested if(...) and calc(...) expressions.
 */
function parseIfBranches(expr) {
  const m = /^if\((.*)\)$/s.exec(expr);
  if (!m) return null;
  const inner = m[1];
  const parts = splitTopLevel(inner, ';');
  if (parts.length < 2) return null;
  // Last part is `else: <fallback>`.
  const last = parts[parts.length - 1].trim();
  const elseMatch = /^else:\s*(.+)$/s.exec(last);
  if (!elseMatch) return null;
  const fallback = elseMatch[1].trim();
  const branches = [];
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i].trim();
    // Branch shape: `<cond>: <body>` where cond is `style(...)` or `style(...) and style(...)` etc.
    // Find the *outer* `:` separating cond from body.
    const colonIdx = findTopLevelColon(p);
    if (colonIdx < 0) return null;
    const cond = p.slice(0, colonIdx).trim();
    const body = p.slice(colonIdx + 1).trim();
    branches.push({ cond, body });
  }
  return { branches, fallback };
}

/**
 * Split `s` at top-level occurrences of `sep` (paren-counting).
 */
function splitTopLevel(s, sep) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && c === sep) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

/**
 * Find the index of the first top-level `:` in `s` (paren-counting).
 */
function findTopLevelColon(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && c === ':') return i;
  }
  return -1;
}

/**
 * True iff `hi` is the byte-after-`lo` address expression. Recognises the
 * common shapes the pattern files use:
 *   stack: sa(K) and sa(K-1)              — lo at SP-K, hi at SP-(K-1)
 *   ea-based: var(--ea) and calc(var(--ea) + 1)
 *   ES:DI with offset: ...DI) and ...DI + 1)
 *   dispatch-conditional (Group 0xFF): if(<branchKey>: <addr>; ... else: -1)
 *     paired branch-by-branch with hi at addr+1, both fallback to -1.
 */
function isAddrPlusOne(loAddr, hiAddr) {
  if (loAddr === hiAddr) return false;

  if (isAddrPlusOneAtomic(loAddr, hiAddr)) return true;

  // Dispatch-conditional shape: both lo and hi are
  //   if(<branchKey>: <addrExpr>; ...; else: -1)
  // Each corresponding branch must satisfy isAddrPlusOneAtomic with hi at +1.
  // The fallback can be -1 (Group FF, INTO-with-OF) or some other invalidating
  // sentinel — both lo and hi must use the same fallback.
  const loBr = parseIfBranches(loAddr);
  const hiBr = parseIfBranches(hiAddr);
  if (loBr && hiBr
      && loBr.fallback === hiBr.fallback
      && loBr.branches.length === hiBr.branches.length) {
    for (let i = 0; i < loBr.branches.length; i++) {
      if (loBr.branches[i].cond !== hiBr.branches[i].cond) return false;
      if (!isAddrPlusOneAtomic(loBr.branches[i].body, hiBr.branches[i].body)) return false;
    }
    return true;
  }

  return false;
}

/**
 * isAddrPlusOne for non-dispatch atomic address expressions.
 */
function isAddrPlusOneAtomic(loAddr, hiAddr) {
  // -1 sentinel: dispatch-conditional inactive branch. When both lo and hi
  // resolve to -1 on the same dispatch key, neither byte writes — pairing
  // the branches as a (suppressed) word write is correct. Must come BEFORE
  // the equality short-circuit below: ('-1', '-1') is equal but still pairs.
  if (loAddr === '-1' && hiAddr === '-1') return true;
  if (loAddr === '-1' || hiAddr === '-1') return false;
  if (loAddr === hiAddr) return false;

  // Stack: sa(K) returns
  //   calc(var(--__1SS) * 16 + --lowerBytes(calc(var(--__1SP) - K + 65536), 16))
  // Pair shape: lo uses K, hi uses K-1 (one byte higher in memory).
  const stackPattern = /^calc\(var\(--__1SS\) \* 16 \+ --lowerBytes\(calc\(var\(--__1SP\) - (\d+) \+ 65536\), 16\)\)$/;
  const loStack = stackPattern.exec(loAddr);
  const hiStack = stackPattern.exec(hiAddr);
  if (loStack && hiStack && parseInt(loStack[1], 10) - 1 === parseInt(hiStack[1], 10)) {
    return true;
  }

  // INTO conditional pushes wrap each addr in `calc(${ofBit} * (${sa(K)}) + (1 - ${ofBit}) * (-1))`.
  // Same K vs K-1 relation; match by stripping the wrapper.
  const intoPattern = /^calc\((.+) \* \((.+)\) \+ \(1 - (.+)\) \* \(-1\)\)$/;
  const loInto = intoPattern.exec(loAddr);
  const hiInto = intoPattern.exec(hiAddr);
  if (loInto && hiInto
      && loInto[1] === hiInto[1]    // same OF gate
      && loInto[3] === hiInto[3]
      && stackPattern.test(loInto[2])
      && stackPattern.test(hiInto[2])) {
    const lk = stackPattern.exec(loInto[2]);
    const hk = stackPattern.exec(hiInto[2]);
    if (parseInt(lk[1], 10) - 1 === parseInt(hk[1], 10)) return true;
  }

  // ea-based mod!=3 form (MOV r/m16 imm16, XCHG r/m16, POP r/m16):
  //   lo: 'if(style(--mod: 3): -1; else: var(--ea))'
  //   hi: 'if(style(--mod: 3): -1; else: calc(var(--ea) + 1))'
  // Detect by checking the +1 form.
  const eaPair = /^if\(style\(--mod: 3\): -1; else: (.+)\)$/;
  const loEa = eaPair.exec(loAddr);
  const hiEa = eaPair.exec(hiAddr);
  if (loEa && hiEa && hiEa[1] === `calc(${loEa[1]} + 1)`) return true;

  // Generic +1 form (STOSW/MOVSW with rep guard):
  //   lo: <expr>
  //   hi: <same expr with the inner "+ var(--__1DI)" replaced by "+ var(--__1DI) + 1">
  // The pattern files build hi by adding " + 1" textually. Match by
  // checking if hi == lo with " + 1)" inserted before the final paren.
  // E.g. lo='calc(var(--__1ES) * 16 + var(--__1DI))'
  //      hi='calc(var(--__1ES) * 16 + var(--__1DI) + 1)'
  if (hiAddr.endsWith(' + 1)') && loAddr.endsWith(')')) {
    const loBase = loAddr.slice(0, -1);
    if (hiAddr === `${loBase} + 1)`) return true;
  }
  // Wrap-in-calc +1 form (Group FF mod!=3 INC/DEC/PUSH r/m16):
  //   lo: 'var(--ea)'
  //   hi: 'calc(var(--ea) + 1)'
  // Pair files write the hi address as `calc(${lo} + 1)` even when lo is
  // a bare var(...) reference, leaving lo un-wrapped. Match by checking
  // hi against that exact wrap.
  if (hiAddr === `calc(${loAddr} + 1)`) return true;
  return false;
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
          initialCS, initialIP, diskBytes, writableDisk, header } = opts;

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
  // templateOpts.memSize is used for SP init — derive from the top of the lowest zone
  // (conventional memory area, which is always zones[0] by convention)
  const convEnd = memoryZones ? memoryZones[0][1] : (opts.memSize || 0x10000);
  const templateOpts = { memSize: convEnd, programOffset, initialCS, initialIP };

  // Build dispatch table
  const dispatch = new DispatchTable();

  // Register all opcode emitters
  emitMOV_RegImm16(dispatch);
  emitMOV_RegImm8(dispatch);
  emitMOV_RegRM(dispatch);
  emitMOV_SegRM(dispatch);
  emitMOV_AccMem(dispatch);
  emitLEA(dispatch);
  emitLES(dispatch);
  emitLDS(dispatch);
  emitAllALU(dispatch);       // ADD/SUB/CMP/AND/OR/XOR/ADC/SBB/TEST/INC/DEC
  emitAllControl(dispatch);   // JMP/Jcc/CALL/RET/INT/IRET/LOOP
  emitAllStack(dispatch);     // PUSH/POP/PUSHF/POPF
  emitAllMisc(dispatch);      // HLT/NOP/LODSB/STOSB/MOV r/m imm/flag manip/CBW/CWD/XCHG
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
  //   utility functions → CPU → chipset → keyboard → pixel painter →
  //   property declarations → memory read → memory write → disk → clock
  //
  // The .cpu and .motherboard rules target the SAME player element (it
  // carries both classes), so their custom properties merge into one
  // computed style. The split is organisational: the CPU proper (decode
  // + register dispatch tables) under .cpu, everything else on the
  // board — chipset, memory, plumbing — under .motherboard.
  // =====================================================================

  // 1. Utility @functions
  w('/* ===== UTILITY FUNCTIONS ===== */');
  w(emitCSSLib());
  w(emitDecodeFunction());
  w(emitFlagFunctions());
  w(emitShiftFlagFunctions());
  w(emitShiftByNFlagFunctions());

  // 2. CPU — instruction decode + the register dispatch tables.
  // Rule layout (the ===== / --- banner comments delimit the regions the
  // site's anatomy Tree View mirrors — see tools/extract-tree-data.mjs):
  //   FETCH & DECODE  (decode.mjs's sub-regions + the unknown-opcode flag)
  //   REGISTERS       (8-bit aliases + the per-register dispatch tables)
  //   MEMORY WRITE SLOTS
  // Custom-property order within one rule is functionally inert (var()
  // resolution is name-based), so this grouping is free.
  w('/* ===== CPU ===== */');
  writeStream.write('.cpu {\n');
  writeStream.write('  /* ===== FETCH & DECODE ===== */\n');
  w(emitDecodeProperties());

  // Unknown opcode detection — sets --unknownOp=1 and --haltCode=opcode
  writeStream.write('  /* --- unknown opcode flag --- */\n');
  writeStream.write(dispatch.emitUnknownOpFlag() + '\n');
  writeStream.write('  --haltCode: calc(var(--unknownOp) * var(--opcode));\n\n');

  writeStream.write('  /* ===== REGISTERS ===== */\n');
  writeStream.write('  /* --- register aliases (8-bit halves) --- */\n');
  w(emitRegisterAliases());
  writeStream.write('\n');

  // Per-register dispatch tables — the heart of instruction execution
  writeStream.write('  /* --- register update formulas --- */\n');
  writeStream.write('  /* Each register\'s next value is selected by opcode via a\n');
  writeStream.write('     giant if(style(--instId: N)) dispatch. This is the CPU. */\n');
  const cpuRegs = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI',
                   'CS', 'DS', 'ES', 'SS', 'IP', 'flags', 'halt', 'cycleCount'];
  // Chipset state — the support chips around the CPU, driven by the same
  // dispatch-table machinery (OUT handlers in patterns/misc.mjs) but
  // emitted under the CHIPSET banner in the .motherboard rule below.
  // Vars with no dispatch entries fall through to defaultExpr.
  const chipsetRegs = [
                    'picMask', 'picPending', 'picInService',
                    'pitMode', 'pitReload', 'pitCounter', 'pitWriteState',
                    // Keyboard-edge detection: snapshot current --keyboard.
                    'prevKeyboard',
                    // Port 0x60 latch: holds the most recent scancode (make
                    // or break) until the next edge. Without it, the break
                    // code is only readable on the single tick that
                    // _kbdRelease fires; if the IRQ-09h ISR runs even one
                    // tick later (typical when CLI flag was clear during
                    // the release tick), it reads scancode 0 and never
                    // sees the release. DOOM's key-held state then sticks.
                    'kbdScancodeLatch',
                    // Hold-wire held set: scancodes latched while --kbdHold
                    // was up, drained as break codes when it drops. See
                    // kiln/patterns/misc.mjs emitIRQCompute.
                    'kbdHeld0', 'kbdHeld1', 'kbdHeld2', 'kbdHeld3',
                    'kbdHeld4', 'kbdHeld5', 'kbdHeld6', 'kbdHeld7',
                    // VGA DAC state machines — write side updated by OUT
                    // 0x3C8 / 0x3C9, read side updated by OUT 0x3C7 / IN 0x3C9.
                    // See kiln/patterns/misc.mjs emitIO() for protocol.
                    'dacWriteIndex', 'dacSubIndex',
                    'dacReadIndex', 'dacReadSubIndex'];
  // Custom defaults: the fall-through expression when no dispatch entry fires
  // for this opcode. pitCounter ticks every instruction; picPending latches
  // PIT+keyboard edges; prevKeyboard snapshots --keyboard. Everything else
  // just holds its __1 value.
  const customDefaults = {
    pitCounter: pitCounterDefaultExpr(),
    picPending: picPendingDefaultExpr(),
    prevKeyboard: 'var(--keyboard)',
    // On a press tick: latch the new scancode. On a release tick: latch the
    // break code (prev scancode | 0x80). Otherwise: hold. The expression
    // here mirrors --_kbdPort60 (see emitIRQCompute) so port 0x60 reads
    // can use the latch as a level-readable backing store.
    kbdScancodeLatch: `if(
      style(--_kbdPress: 1): --rightShift(var(--keyboard), 8);
      style(--_kbdRelease: 1): --or(--rightShift(var(--__1prevKeyboard), 8), 128);
      style(--_kbdDrain: 1): calc(var(--_kbdPopSc) + 128);
      else: var(--__1kbdScancodeLatch)
    )`,
  };
  // Hold-wire held set: append the latched scancode into this slot when
  // its --_kbdApp flag fires, clear it when its --_kbdPop flag fires
  // (drain), otherwise carry. Flags come from emitIRQCompute.
  for (let i = 0; i < 8; i++) {
    customDefaults[`kbdHeld${i}`] = `if(
      style(--_kbdApp${i}: 1): var(--_kbdLatchSc);
      style(--_kbdPop${i}: 1): 0;
      else: var(--__1kbdHeld${i})
    )`;
  }
  const emitDispatchFor = (regs) => {
    for (const reg of regs) {
      const defaultExpr = customDefaults[reg] ?? `var(--__1${reg})`;
      writeStream.write(dispatch.emitRegisterDispatch(reg, defaultExpr) + '\n');
    }
  };
  emitDispatchFor(cpuRegs);
  writeStream.write('\n');

  // Memory write slots — the CPU's write port onto the bus
  writeStream.write('  /* ===== MEMORY WRITE SLOTS ===== */\n');
  writeStream.write(dispatch.emitMemoryWriteSlots() + '\n\n');
  writeStream.write(dispatch.emitSlotLiveGates() + '\n\n');
  writeStream.write(dispatch.emitWriteWidthGate() + '\n\n');
  if (writableDisk) {
    writeStream.write(emitDiskWriteRemap(writableDisk) + '\n\n');
  }

  w('}');

  // 3. Chipset — PIT, PIC, keyboard controller, VGA DAC. Same dispatch
  // machinery as the registers, but conceptually the support chips
  // around the CPU, so they get their own rule (same element).
  w('/* ===== CHIPSET ===== */');
  writeStream.write('.motherboard {\n');
  w(emitPeripheralCompute());
  w(emitIRQCompute());
  writeStream.write('  /* ===== CHIP DISPATCH TABLES ===== */\n');
  emitDispatchFor(chipsetRegs);
  w('}');

  // 4. Keyboard :active rules (separate .motherboard block)
  w('/* ===== KEYBOARD ===== */');
  w(emitKeyboardRules());

  // 4b. Mode 13h pixel painter (raw player only; inert in calcite path).
  w(emitPixelPaintRules());

  // =====================================================================
  // THE BULK — @property declarations, memory, disk, clock plumbing
  // (This is ~99% of the file by volume: one @property per memory cell,
  //  one read arm per byte, one write-rule per cell, etc.)
  // =====================================================================

  w('/* ===== PROPERTY DECLARATIONS ===== */');
  w(`/* Below: ${addresses.length} @property declarations (one per memory byte),\n` +
    '   followed by memory read/write rules, the disk, and the clock.\n' +
    '   The CPU logic above is a small fraction of this file. The rest is memory. */\n');
  w(emitPropertyDecls(templateOpts));
  // Memory properties — emit in chunks to avoid huge strings
  emitMemoryPropertiesStreaming(memOpts, writeStream);
  w(emitWriteSlotProperties());
  if (writableDisk) w(emitDiskAddrProperties());

  // readMem @function (large — one branch per memory byte)
  w('/* ===== MEMORY READ ===== */');
  emitReadMemStreaming(memOpts, writeStream);

  // Per-byte memory write rules — their own .motherboard rule
  w('/* ===== MEMORY WRITE RULES ===== */');
  writeStream.write('.motherboard {\n');
  emitMemoryWriteRulesStreaming(memOpts, writeStream);
  w('}');

  // The disk read @function (one arm per disk byte)
  if (diskBytes) {
    w('/* ===== DISK ===== */');
    emitReadDiskByteStreaming(diskBytes, writeStream, writableDisk);
  }

  // Clock — one contiguous section: the heartbeat rule, the plumbing
  // rule (paused store/execute animations + all double-buffer reads),
  // and the keyframes that do the handover.
  w('/* ===== CLOCK ===== */');
  w(emitClockRule());
  writeStream.write(emitClockPlumbingOpen() + '\n');
  writeStream.write('  /* Double-buffer reads */\n');
  w(emitBufferReads(templateOpts));
  emitMemoryBufferReadsStreaming(memOpts, writeStream);
  w('}');

  // Keyframes — store
  const storeKf = emitStoreKeyframe(templateOpts);
  const storeKfOpen = storeKf.replace('  }\n}', '');
  writeStream.write(storeKfOpen);
  emitMemoryStoreKeyframeStreaming(memOpts, writeStream);
  writeStream.write('  }\n}\n\n');

  // Execute keyframe
  const execKf = emitExecuteKeyframe(templateOpts);
  const execKfOpen = execKf.replace('  }\n}', '');
  writeStream.write(execKfOpen);
  emitMemoryExecuteKeyframeStreaming(memOpts, writeStream);
  writeStream.write('  }\n}\n\n');

  w(emitClockKeyframes());
}

// --- Streaming memory emitters (write directly, avoid building huge strings) ---

const CHUNK = 8192; // lines per write() call

// Rom-disk window (guest side): 512 bytes at linear 0xD0000. Reads are
// dispatched through --readDiskByte; on writable carts, writes are remapped
// into the disk-shadow cells by --_dskAddrN below.
const DISK_WINDOW_BASE = 0xD0000;
const DISK_WINDOW_SIZE = 512;

// The LBA register is a normal writable word at linear 0x4F0 (see the
// 0x4F0 pitfall in docs/memory-layout.md). Compose it as low + high*256
// from the current PACK_SIZE's storage — shared by the window read arms
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
 * silently loses precision (verified in Chromium — see LOGBOOK
 * 2026-07-06). Big constants may live in property names and in literal
 * arm keys, never in computed values.
 *
 * Per write slot:
 *   --_dskIn N  = 1 when memAddrN is inside the rom-disk window, else 0
 *                 (product of two clamp(0,...,1) step functions).
 *   --_dskOffN  = lba*512 + (memAddrN - 0xD0000) when inside — the
 *                 disk-local byte offset of the write — and -1 outside.
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
  const lines = ['  /* ===== WRITABLE-DISK WRITE REMAP (--_dskInN / --_dskOffN) ===== */'];
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

function emitMemoryPropertiesStreaming(opts, ws) {
  const { addresses } = opts;
  if (PACK_SIZE === 1) {
    const initMem = buildInitialMemory(opts);
    let buf = '';
    let count = 0;
    for (const addr of addresses) {
      const init = initMem.get(addr) || 0;
      buf += `@property --m${addr} {\n  syntax: '<integer>';\n  inherits: true;\n  initial-value: ${init};\n}\n\n`;
      if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
    }
    if (buf) ws.write(buf);
    return;
  }
  // Packed: one @property per cell. `--mc{cellIdx}` holds PACK_SIZE bytes.
  const cells = buildCellSet(addresses);
  const cellInit = buildInitialMemoryPacked(opts);
  let buf = '';
  let count = 0;
  for (const idx of cells) {
    const init = cellInit.get(idx) || 0;
    buf += `@property --mc${idx} {\n  syntax: '<integer>';\n  inherits: true;\n  initial-value: ${init};\n}\n\n`;
    if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
  }
  if (buf) ws.write(buf);
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
  // DOSes provably leave alone. It USED to sit at 0x0500-0x0501 — but
  // MS-DOS's boot sector loads the root directory at 0x0500 (DirOff in
  // MSBOOT.ASM) and could never read its own buffer back through the
  // bridge, so MS-DOS 4.0 boot died at "Non-System disk". 0x4F2/0x4F3
  // are taken too (corduroy's requested-video-mode and CGA pal-reg
  // shadows) — every platform register gets its own address.
  for (const addr of addresses) {
    // Disk-shadow cells are not guest-addressable — the CPU can only reach
    // them through the 0xD0000 window (whose arms are emitted below). Skip
    // their --readMem arms; they'd never match and only bloat the dispatch.
    if (writableDisk && addr >= writableDisk.base && addr < writableDisk.base + writableDisk.length) {
      continue;
    }
    if (addr === 0x04F4) {
      buf += `    style(--at: 1268): --lowerBytes(var(--__1keyboard), 8);\n`;
    } else if (addr === 0x04F5) {
      buf += `    style(--at: 1269): --rightShift(var(--__1keyboard), 8);\n`;
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
  // BIOS region (read-only constants) — always included
  if (biosBytes && biosBytes.length > 0) {
    for (let i = 0; i < biosBytes.length; i++) {
      if (biosBytes[i] !== 0) {
        buf += `    style(--at: ${0xF0000 + i}): ${biosBytes[i]};\n`;
        if (buf.length > 8192) { ws.write(buf); buf = ''; }
      }
    }
  }
  // Rom-disk window: 0xD0000..0xD01FF (512 bytes). Each read is dispatched
  // to --readDiskByte(lba_word, offset). The LBA register is a normal
  // writable word at linear 0x4F0 composed here as low + high*256 — same
  // pattern as other 16-bit reads. The source changes with PACK_SIZE:
  //   pack=1: bytes 0x4F0/0x4F1 live in --__1m1264/__1m1265.
  //   pack=2: both bytes live in cell --__1mc632 (1264/2=632) as low/high
  //           halves — extract with mod/round-down-div, same shape as the
  //           read dispatch above.
  if (diskBytes) {
    const { lo: lbaLowExpr, hi: lbaHighExpr } = lbaByteExprs();
    // The key is the plain disk byte index (lba*512 + offset) in both rom
    // and writable modes. It must stay a SMALL computed value: Chrome's
    // computed numeric custom properties only carry ~6 significant digits,
    // so keying on the shadow's high linear address would corrupt every
    // dispatch in a spec-compliant evaluator. (Disk indices themselves
    // stay exact up to ~1e6, i.e. ~1 MB of disk — a pre-existing bound
    // shared with rom mode.)
    for (let i = 0; i < DISK_WINDOW_SIZE; i++) {
      const addr = DISK_WINDOW_BASE + i;
      buf += `    style(--at: ${addr}): --readDiskByte(calc((${lbaLowExpr} + ${lbaHighExpr} * 256) * 512 + ${i}));\n`;
      if (buf.length > 8192) { ws.write(buf); buf = ''; }
    }
  }
  if (buf) ws.write(buf);
  ws.write(`  else: 0);\n}\n\n`);
  // --readDiskByte itself is emitted later, under the DISK banner —
  // @function order is irrelevant to CSS, so the forward reference from
  // the window arms above is fine.
}

function emitReadDiskByteStreaming(diskBytes, ws, writableDisk) {
  // --idx = lba*512 + offset (disk byte index) in both modes.
  // Rom disks: one branch per non-zero byte, literal result — calcite
  // flattens this dispatch into a byte-array lookup.
  // Writable disks: one branch per byte (zero bytes included — any free
  // sector can be written then read back), each reading its shadow cell.
  // The arm shape is byte extraction on --__1mc<(base+idx)/PACK_SIZE> —
  // the same extraction --readMem's packed arms use, with a constant
  // offset between the key space and the cell-name space (the shadow's
  // high name base never appears as a computed value — Chrome only keeps
  // ~6 significant digits on those).
  ws.write(`@function --readDiskByte(--idx <integer>) returns <integer> {\n  result: if(\n`);
  let buf = '';
  if (writableDisk) {
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
  const { addresses } = opts;
  if (PACK_SIZE === 1) {
    const initMem = buildInitialMemory(opts);
    let buf = '';
    let count = 0;
    for (const addr of addresses) {
      const init = initMem.get(addr) || 0;
      buf += `  --__1m${addr}: var(--__2m${addr}, ${init});\n`;
      if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
    }
    if (buf) ws.write(buf);
    return;
  }
  const cells = buildCellSet(addresses);
  const cellInit = buildInitialMemoryPacked(opts);
  let buf = '';
  let count = 0;
  for (const idx of cells) {
    const init = cellInit.get(idx) || 0;
    buf += `  --__1mc${idx}: var(--__2mc${idx}, ${init});\n`;
    if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
  }
  if (buf) ws.write(buf);
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
  // table when the gate reads 0 — see
  // calcite/crates/calcite-core/src/pattern/packed_broadcast_write.rs.
  const { addresses, writableDisk } = opts;
  // Disk-shadow cells form their own write family keyed on --_dskOffN
  // (the disk-local byte offset of a window write; -1 otherwise), with
  // disk-local cell indices in the offset arithmetic. RAM cells keep
  // --memAddrN and guest-linear indices, byte-identical to rom builds.
  // The two families have disjoint cell sets and each write matches at
  // most one — see emitDiskWriteRemap.
  const isDiskCell = (byteAddr) =>
    writableDisk && byteAddr >= writableDisk.base && byteAddr < writableDisk.base + writableDisk.length;
  if (PACK_SIZE === 1) {
    // Per byte at address A, each slot can hit two ways:
    //   (1) memAddrN == A             : slot's lo half lands here.
    //                                    width=1 → val is byte; width=2 → val is word, take lo via --lowerBytes.
    //   (2) memAddrN == A-1, width=2  : slot's hi half lands here. Take hi via --rightShift.
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
  // same-cell collisions — matching the legacy top-down byte-level
  // dispatch semantics. Every --applySlot short-circuits to its input
  // cell when --_slotNLive=0, so idle ticks pay NUM_WRITE_SLOTS style-query
  // gates per cell (down from 6 in the byte-slot scheme).
  //
  // applySlot args:
  //   cell       : previous-tick cell value (b0 | b1<<8)
  //   live       : --_slotNLive (1 if slot fires)
  //   loOff      : memAddrN - cellBase            (slot's lo/byte half offset within this cell)
  //   hiOff      : memAddrN + 1 - cellBase        (slot's hi half offset within this cell, only meaningful when width=2)
  //   val        : memValN — byte (width=1) or 16-bit word (width=2, lo at memAddrN, hi at memAddrN+1)
  //   width      : --_writeWidth (1 or 2; shared across all slots this tick)
  // applySlot handles aligned word writes (loOff=0, hiOff=1, width=2), the
  // straddle cases (loOff=1 → lo half lands here at off 1; hiOff=0 → hi half
  // lands here at off 0, both gated on width=2), and width=1 byte writes.
  const cells = buildCellSet(addresses);
  let buf = '';
  let count = 0;
  const diskBaseCell = writableDisk ? cellIdxOf(writableDisk.base) : -1;
  for (const idx of cells) {
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
  const { addresses } = opts;
  if (PACK_SIZE === 1) {
    const initMem = buildInitialMemory(opts);
    let buf = '';
    let count = 0;
    for (const addr of addresses) {
      const init = initMem.get(addr) || 0;
      buf += `    --__2m${addr}: var(--__0m${addr}, ${init});\n`;
      if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
    }
    if (buf) ws.write(buf);
    return;
  }
  const cells = buildCellSet(addresses);
  const cellInit = buildInitialMemoryPacked(opts);
  let buf = '';
  let count = 0;
  for (const idx of cells) {
    const init = cellInit.get(idx) || 0;
    buf += `    --__2mc${idx}: var(--__0mc${idx}, ${init});\n`;
    if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
  }
  if (buf) ws.write(buf);
}

function emitMemoryExecuteKeyframeStreaming(opts, ws) {
  const { addresses } = opts;
  if (PACK_SIZE === 1) {
    let buf = '';
    let count = 0;
    for (const addr of addresses) {
      buf += `    --__0m${addr}: var(--m${addr});\n`;
      if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
    }
    if (buf) ws.write(buf);
    return;
  }
  const cells = buildCellSet(addresses);
  let buf = '';
  let count = 0;
  for (const idx of cells) {
    buf += `    --__0mc${idx}: var(--mc${idx});\n`;
    if (++count % CHUNK === 0) { ws.write(buf); buf = ''; }
  }
  if (buf) ws.write(buf);
}
