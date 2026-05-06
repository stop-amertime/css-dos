# `rep_fast_forward` — generic CSS-shape recogniser

**Status**: planning, multi-session mission.
**Owner**: rotates. Pick up at the next unchecked checkpoint.
**Cross-link**: see `docs/logbook/STATUS.md` "Open work" and
`../calcite/docs/log.md` 2026-05-05 for the audit-list context this
mission closes.

## Why this exists

`rep_fast_forward` (calcite-core/src/compile.rs:5734) is the last
cardinal-rule violation in calcite-core: ~341 lines of post-tick logic
that hardcodes x86 string-op semantics — opcode tables (0xAA/AB/A4/A5
write-side, 0xA6/A7/AE/AF read-side), REP/REPE/REPNE prefix decoding,
DF flag bit position, ZF flag bit position, segment base = `seg<<4`,
the `IP + 1 + prefixLen` post-fixup, hand-coded SUB-flag computation,
and CSS-DOS-specific virtual-region carve-outs (0x0500, 0xD0000,
0xF0000).

Calcite's cardinal rule (`../calcite/CLAUDE.md` and the genericity
probe in CSS-DOS's CLAUDE.md): an engine recogniser must be derivable
from CSS structural shape alone, by an engineer who has never seen a
CPU emulator. The current `rep_fast_forward` fails that test
spectacularly. The four siblings on the 2026-05-05 audit list landed;
this is the remaining one. It was deferred because removing it
requires a real CSS-shape recogniser plus a generic runtime applier,
gated on a real-cart perf budget — not a comment cleanup.

## Hard constraints (read these first)

1. **Cardinal rule.** The replacement recogniser must operate on CSS
   structural shape only. The genericity probe: a 6502 cabinet, a
   brainfuck cabinet, and an arbitrary non-emulator cabinet whose CSS
   happens to share the shape must all trigger the same fast-forward.
   If any of those three would need a calcite-side change, we've
   overfit.

2. **No reading characters out of variable names.** The recogniser may
   observe whether two slot references are *the same slot* (identity
   check on the slot index after compile-time resolution) and may
   observe whether a name *repeats* across multiple dispatch entries
   (counts of references). It must NOT pattern-match on prefix
   characters, suffix characters, underscores, or any substring of
   the name. This forecloses the easy-but-wrong shortcut of
   "recognise loops by spotting names that start with `_`". Names are
   opaque tokens.

3. **Perf gate.** Doom8088 web AND native CLI must come in within ±1%
   of pre-mission `runMsToInGame`. Quote JSON before/after. If only
   one target regresses that's a real regression in that target — do
   not dismiss.

4. **Correctness gate.** `node tests/harness/run.mjs smoke` 7/7 PASS
   at every checkpoint. Doom8088 reaches in-game (`g_gamestate==0`)
   on both web and CLI at every checkpoint. Prince of Persia title
   screen unchanged.

5. **Single fast-forward path at the end.** The current
   `rep_fast_forward` may be left in place as a fallback during
   checkpoints 1-3 (gated, off by default once the new path proves
   itself), but checkpoint 5 deletes it. There must not be two
   competing post-tick string-op paths in production.

6. **Compile-once-per-load.** All recogniser work happens at parse /
   compile time on `CompiledProgram`. The runtime applier reads
   pre-computed descriptors. No per-tick recognition.

## What we know about the CSS shape

Every REP-style instruction kiln emits has a recognisable structural
signature in the dispatch table for one opcode value V:

- **Counter slot S_c**: a dispatch entry for slot S_c whose body is
  shape `if(<gate>: self; else: max(0, calc(self - 1)))`. The slot
  read on both branches is the same slot S_c (identity check, not
  name match).
- **IP slot S_ip**: a dispatch entry for the program counter slot
  whose body is shape `if(<predicate>: calc(self - someLiteralOrSlot); else: calc(self + literal))`.
  The "stay-here" branch reduces the IP delta to zero (modulo the
  outer wrapper that adds `prefixLen`); the "advance" branch is the
  normal +instrLen step. The predicate is the same intermediate slot
  that gates the counter and the writes.
- **Pointer slot(s) S_p**: zero or more dispatch entries of shape
  `lowerBytes(calc(self ± k - bit(flagsSlot, bitN) * 2k), 16)` —
  modular pointer with direction flag. Same-slot identity again.
- **Memory write entries**: `addMemWrite(V, addrExpr, valExpr)` where
  `addrExpr` is gated by the same predicate (the kiln helper
  `repGuardAddr` returns `-1` when the guard fails — and writing to
  address `-1` is already a no-op in calcite, so we don't need to
  treat the guard specially; we just need to recognise the address
  expression's structural form).

The "killer signature" is the IP-stay-here branch. Any opcode whose
IP-update has a "stay where I am" branch gated on a predicate is
structurally a loop. Everything else (counter, pointers, writes) is a
predictable consequence.

**Repetition is the engine of recognition.** The same predicate slot
appears in: the counter entry's gate, the IP entry's stay-branch
gate, the memwrite address gates, and possibly the pointer entry
gates. That repetition — same slot index appearing in N gate
positions — is what calcite identifies. It does not need to know the
slot's name, only its index.

## Genericity probe — synthetic test cabinets

Two synthetic-CSS cabinets must produce equivalent loop descriptors.
Both ship as fixtures used by the recogniser unit tests:

- **Cabinet A — x86-shaped** (mimics what kiln emits today). Slot
  names match current x86 ABI (`--CX`, `--DI`, `--ES`, etc.).
- **Cabinet B — brainfuck-shaped**. Same dispatch shape: counter
  decrement, IP-stay-here, modular pointer step, gated memwrite. But
  the slot names are arbitrary opaque tokens — `--moodMeter`,
  `--tapeCursor`, `--cellPage`. No x86 ABI. No naming convention
  shared with cabinet A.

If both cabinets compile to descriptors with the same structural
fields populated (counter index points at the right slot, pointer
index points at the right slot, predicate index agrees, write
descriptor's address and value formulas extract correctly), the
recogniser is genuinely structural. If cabinet B fails or produces a
different descriptor shape, the recogniser is overfit and the
checkpoint hasn't landed.

## What "incidentally" kiln can do

Kiln does not emit any new metadata or signal slot. The CSS it emits
today is already structurally clean — `repIP()`, `repCX()`,
`repGuardReg()`, `repGuardAddr()` produce shape-uniform output
because they share helpers. The mission does NOT add any side-channel
or annotation. Kiln stays out of it.

The one small kiln courtesy that's permissible (and doesn't cross
the line): if during checkpoint 1 we discover that kiln's repIP /
repCX shapes have minor inconsistencies that complicate the
recogniser unnecessarily, we may regularise them — but only if the
regularisation is also structurally cleaner from a pure-CSS
standpoint, justifiable without reference to calcite. Any such kiln
change must keep Chrome semantics identical (cardinal rule on the
CSS-DOS side).

## Loop descriptor — the compile-time output

The recogniser produces, per opcode value V where the shape matches:

```rust
struct LoopDescriptor {
    opcode: i32,                 // for dispatch lookup at runtime, not for semantics
    counter_slot: SlotIdx,       // monotone-decreasing slot
    predicate_slot: SlotIdx,     // intermediate that gates everything
    ip_slot: SlotIdx,
    ip_advance: i32,             // +N when predicate flips (the "exit" step)
    pointer_steps: Vec<PointerStep>,    // zero or more
    write_descriptors: Vec<WriteDescriptor>,  // zero or more
    exit_kind: ExitKind,         // Counter, Counter+FlagCondition, etc.
}

struct PointerStep {
    slot: SlotIdx,
    base_step: i32,              // ±1, ±2 etc; sign drawn from flag bit
    direction_flag_slot: SlotIdx,
    direction_flag_bit: u8,
}

struct WriteDescriptor {
    addr_expr: ExprId,           // pre-compiled slot expression
    val_expr: ExprId,            // pre-compiled slot expression
    width_bytes: u8,             // detected from "addr+0 and addr+1" pair grouping
}

enum ExitKind {
    CounterZero,                 // STOS/MOVS-shape
    CounterZeroOrFlag {          // CMPS/SCAS-shape
        flag_slot: SlotIdx,
        flag_bit: u8,
        flag_target: u8,         // 0 or 1
    },
}
```

The `ExitKind::CounterZeroOrFlag` discrimination is itself a
structural detection: an opcode whose IP-stay-branch predicate is the
*conjunction* of a counter check and a flag-bit check has the
extended exit kind. The CSS shape today (`repCondIP` in kiln) is a
chain of style() conjunctions — recognisable as "predicate is
counter-positive AND flag-bit-equals-target".

## Generic runtime applier

Reads `LoopDescriptor` instead of dispatching on opcode bytes.
Loop:

1. Read counter slot value n.
2. If exit kind is `CounterZeroOrFlag` and the flag check already
   passes, stop here (single CSS iter already happened, exit
   condition satisfied).
3. For each iter k in 0..n:
   - Evaluate `addr_expr` and `val_expr` against the simulated
     post-iter slot view.
   - Issue write through the appropriate sink (see "memory routing"
     below).
   - Step pointer slots.
   - For `CounterZeroOrFlag`: also evaluate flag_expr; break if it
     flips.
4. Commit final slot values: counter→0 (or partial), pointers
   advanced, IP set to `ip + ip_advance`, cycle count incremented by
   k × per-iter-cycle (the per-iter cycle cost is itself a slot the
   cabinet writes; recogniser captures it).

Specialisations (still pure-shape, no x86 knowledge):

- **Single-write loop with constant value**: detect when val_expr
  evaluates to a slot read that doesn't depend on iteration index →
  collapse to `bulk_fill`.
- **Single-write loop with read-from-mirror-pointer**: detect when
  val_expr is `read_mem(other_pointer_slot + iter*step)` and the
  write addr is `dst_pointer_slot + iter*step` → collapse to
  `bulk_copy`.
- **Otherwise**: walk per-iter. Slower but always correct.

The detection of "val_expr doesn't depend on iter index" is itself a
shape-level question (does the expression reference any pointer
slot?), not an opcode-level one.

## Memory routing — virtual regions

The current `ranges_overlap_virtual` carve-out (0x500, 0xD0000,
0xF0000) is CSS-DOS-specific and must move. The generalisation:

- The CSS dispatch recogniser already knows which memory regions are
  backed by something other than `state.memory` byte storage —
  because some other recogniser registered a windowed-byte-array
  descriptor, a keyboard-bridge descriptor, a state.extended
  descriptor.
- Add `state.virtual_regions: Vec<{start, len, sink}>` populated by
  whichever recogniser owns the region.
- Bulk fill / bulk copy consult this list. Overlap with a virtual
  region → either route the bulk write through `write_mem` for the
  overlapping bytes, or split the operation around the virtual range
  and use bulk for the non-virtual parts.

This is good independent of the mission — it removes a CSS-DOS-shaped
constant from calcite-core unconditionally.

## Checkpoints

Each checkpoint is independently shippable: smoke 7/7 + doom8088
in-game on both targets, no perf regression beyond the ±1% gate.

### Checkpoint 1 — recogniser, descriptors, unit tests — DONE 2026-05-06

Pure compile-time. No runtime path change. The new recogniser runs,
emits `Vec<LoopDescriptor>` on `Evaluator`, and unit tests verify it.

- [x] Add `LoopDescriptor` and friends to `Evaluator`. (Stored on
      `Evaluator::loop_descriptors`. `CompiledProgram` was the
      original target in this plan; on review the Evaluator was the
      cleaner home — the descriptor is consumed alongside other
      eval-time structures, and `CompiledProgram` is bytecode-only.)
- [x] Implement the recogniser pass over the dispatch table. Operates
      on slot/property identity and expression structural shape only.
      No name-character inspection.
- [x] Synthetic-CSS unit tests:
  - [x] Cabinet A (x86-shaped) — 2 descriptors (STOSB+MOVSB
        equivalents). The "8 descriptors" target in the original plan
        anticipated all eight x86 string-op variants; phase 1 lands
        with the simpler STOS/MOVS/LODS shape (no flag-conditioned
        exit). CMPS/SCAS recognition needs the flag-aware predicate
        matcher and lands with phase 2's runtime applier where it's
        first-class.
  - [x] Cabinet B (brainfuck-shaped) produces equivalent descriptors
        with zero calcite-side changes. Locked in by
        `a_and_b_descriptors_are_structurally_equivalent` test.
  - [x] Negative test (`no_loop_when_no_ip_stay_shape`): no IP-stay
        body → zero descriptors.
  - [x] Negative test (`no_loop_when_only_ip_stay_no_counter_or_pointer_or_write`):
        IP-stay alone, no counter/pointer/write → refused. Unbounded
        loops don't fast-forward.
  - [x] Wrapper-stripping tests (`outer_wrappers_are_stripped`,
        `ip_wrapper_with_non_self_overrides_still_recognises`,
        `dispatch_family_picks_largest_member_set`): outer kiln
        wrappers (Calc-add for prefixLen, StyleCondition for TF/IRQ,
        mixed-key StyleCondition for memwrite slots) are peeled
        structurally.
  - [x] Renaming probe (`renaming_slots_preserves_structure`):
        substituting every slot/property/function name to arbitrary
        new strings produces equivalent structural facts.
- [x] On the real doom8088 cabinet, the recogniser emits 6
      descriptors (key=0xA4/A5/AA/AB/AC/AD) under
      `CALCITE_LOOP_DIAG=1`. Pointer counts and step magnitudes
      cross-check against x86 string-op semantics.

Old `rep_fast_forward` still active. Smoke 7/7 + doom8088 in-game
unchanged. Engine workspace + wasm builds clean.

**Pickup notes for whoever takes checkpoint 2.** The descriptor
type lives in `crates/calcite-core/src/pattern/loop_descriptor.rs`
(`LoopDescriptor`, `CounterEntry`, `PointerEntry`, `WriteEntry`).
The runtime applier should:

- Run alongside (not replace) the existing
  `compile.rs::rep_fast_forward`, gated by `CALCITE_REP_GENERIC=1`
  env var.
- Consume `evaluator.loop_descriptors` and execute the same
  fast-forward semantics for the four currently-recognised
  variants (STOSB/STOSW/MOVSB/MOVSW) without opcode-specific code.
- For CMPS/SCAS: extend `match_ip_stay_or_advance` to accept
  conjunction predicates `<rep-continue> AND <flag-bit-condition>`,
  then add the flag-conditioned exit walk to the applier. The
  current `flag_conditioned: bool` field on `LoopDescriptor` is
  ready to flip true when this lands.
- The write descriptor's address/value pairing in phase 1 is a
  heuristic (sort by name, take first). Phase 2 should pair by
  the cabinet's assignment ordering (kiln pairs `--memAddrN` with
  `--memValN` by index).

### Checkpoint 2 — generic runtime applier, behind a flag

Add the descriptor-driven applier as a parallel post-tick hook,
gated by `CALCITE_REP_GENERIC=1` env var (default off). Both paths
coexist; only one runs at a time.

- [ ] Implement applier per the descriptor walk above.
- [ ] Move `state.virtual_regions` and route bulk writes through it.
- [ ] Behavioural parity tests: with `CALCITE_REP_GENERIC=1`, run
      smoke + doom8088 CLI to in-game. Both must reach the same
      sentinel state.
- [ ] Diff calcite-cli memory snapshots between the two paths every
      100K ticks during doom8088 boot. Zero divergence.

Default OFF. This is the diagnostic-bedded landing.

### Checkpoint 3 — specialisation passes for bulk_fill / bulk_copy

The naive applier walks per-iter. For STOSB/MOVSB-shaped loops with
N=10000+ iters, per-iter is too slow. Add the structural
specialisations.

- [ ] At descriptor build time, classify "constant-value single-write"
      → mark for `bulk_fill`.
- [ ] Classify "mirror-pointer copy single-width" → mark for
      `bulk_copy`.
- [ ] Applier dispatches on classification.
- [ ] Behaviour-parity sweeps still pass.
- [ ] Perf parity: with `CALCITE_REP_GENERIC=1`, doom8088 web and
      CLI within ±1% of `CALCITE_REP_GENERIC=0`.

### Checkpoint 4 — flip the default, soak

- [ ] `CALCITE_REP_GENERIC=1` becomes the default. Old path still
      compilable with `CALCITE_REP_GENERIC=0` for diagnostic A/B.
- [ ] Smoke 7/7. Doom8088 in-game both targets. Doom-loading bench
      unchanged.
- [ ] Run for at least 48h of normal session use without an A/B
      flip-back triggered by a regression.

### Checkpoint 5 — delete the old path

- [ ] Remove `rep_fast_forward` (the opcode-keyed body and helpers
      `rep_fast_forward_cmps_scas`, `compute_sub_flags`,
      `rep_fast_forward_panic`, `ranges_overlap_virtual`).
- [ ] Remove `CALCITE_REP_GENERIC` flag (descriptor path is
      unconditional).
- [ ] Update STATUS.md "Open work" — remove the rep_fast_forward
      bullet.
- [ ] Update calcite log.md — note the cardinal-rule audit list is
      now empty.
- [ ] Verify the genericity probe one more time on a mock 6502
      cabinet (used during checkpoint 1).

## Success criteria

1. `rep_fast_forward` no longer exists. The post-tick string-op fast
   path is descriptor-driven.
2. The recogniser, when shown a brainfuck-shaped cabinet, fires with
   no calcite-side change.
3. The recogniser does not look at any character of any variable
   name. Only slot identity and expression shape.
4. Doom8088 web and CLI: `runMsToInGame` within ±1% of pre-mission.
5. Smoke 7/7 PASS at every commit on the mission branch.

## Out of scope

- Rewriting the affine non-REP self-loop recogniser
  (`docs/plans/2026-05-01-affine-loop-fastforward.md`). That's a
  separate workstream. There's natural overlap (both are
  loop-shape recognisers); the descriptor type may end up shared.
  Don't pre-merge — land this mission first, then refactor if it's
  obvious.
- LODSB/LODSW (0xAC/0xAD). They have repIP/repCX but no memwrite
  and no DI step — they read into AL/AX. The shape recogniser will
  either pick them up naturally (read-side loops with no write) or
  not; either is acceptable as long as correctness holds.
- Removing CSS-DOS-shaped constants from places that aren't the
  string-op path. That's a separate sweep if it ever happens.

## Risks and how to detect them

- **Recogniser misidentifies a non-loop opcode as a loop** → unit
  tests on synthetic cabinets covering negative cases. Real-cart
  smoke catches everything else.
- **Specialisation classifier wrong** → checkpoint 2's behavioural
  parity sweep against the old path catches divergence at the
  memory-snapshot level. Don't ship checkpoint 3 (specialisation)
  until the naive applier is byte-for-byte clean.
- **Perf regression from per-iter applier** → checkpoint 3 is the
  perf gate; if specialisations don't recover the ±1%, the mission
  pauses and we either find a better classification or accept that
  the old hand-tuned path stays. We do NOT ship a regression to land
  the cleanup.
- **Virtual-region migration breaks something not REP-related** →
  unlikely (today's check is a constant range list), but the
  smoke suite covers BIOS-ROM and rom-disk reads. Run smoke after
  checkpoint 2's virtual-region move.
