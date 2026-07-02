# `rep_fast_forward` Genericity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `crates/calcite-core/src/compile.rs::rep_fast_forward` and its helpers (~600 lines of hardcoded x86 string-op semantics) and replace with a descriptor-driven applier whose recogniser and runtime carry zero upstream knowledge — same observable behaviour, no opcode tables, no x86-shaped literal-name reads, no hardcoded flag bit positions, no encoded segment-shift constant outside the descriptor.

**Architecture:** A pattern recogniser running at `Evaluator::from_parsed` time produces a `Vec<LoopDescriptor>` of every self-loop opcode in the cabinet. Each descriptor captures the loop's structural shape — counter slot, pointers, write entries, the cabinet's own gating predicate. At per-tick post-CSS time, a generic applier reads the descriptor, evaluates the precondition, and either commits the bulk operation (Fill / Copy / ReadOnly variants) or panics loudly with cabinet state when the recogniser produced an Unsupported shape. No env-var toggle; the descriptor path is the only path. The hardcoded body, the dual harness scaffolding, and the panic-or-bail gates all retire.

**Tech Stack:** Rust (calcite-core, calcite-cli, calcite-wasm), CSS-DOS bench/harness (Node.js + Playwright). All work happens in `../calcite/.claude/worktrees/rep-generic/` (already created from `main` at `8de61a8`).

---

## Required reading before starting

Every task assumes the implementer has read:

1. `../calcite/CLAUDE.md` — the cardinal rule.
2. `CLAUDE.md` (CSS-DOS) — the genericity probe and "no slow path" rule for REP.
3. `docs/logbook/STATUS.md` — current state, the ship-blocker entry, perf baseline.
4. **The reference implementation that already exists on `origin/worktree-rep-3b` (calcite, commit `645f497`)** — this plan asks the implementer to *re-port* code from there onto current main. The reference paths to read:
   - `crates/calcite-core/src/pattern/loop_descriptor.rs` (recogniser + types, 1603 lines)
   - `crates/calcite-core/src/pattern/loop_descriptor/tests.rs` (unit tests)
   - `crates/calcite-core/src/pattern/rep_applier.rs` (Fill/Copy/ReadOnly appliers, 3099 lines)
   - `crates/calcite-core/src/pattern/rep_dual_harness.rs` (development scaffolding — not ported in this plan)
   - `crates/calcite-core/tests/rep_fast_forward.rs` (integration tests)
   - `docs/rep-3b-scoping.md` (design analysis)
5. **The hardcoded path being deleted** — `../calcite/crates/calcite-core/src/compile.rs:5767–6678` on `worktree-rep-3b` (`rep_fast_forward`, `rep_fast_forward_cmps_scas`, `rep_fast_forward_panic`, `compute_sub_flags`, `ranges_overlap_virtual`, `bulk_fill`, `bulk_store_byte`). Knowing what behaviour to reproduce is non-negotiable. The same functions exist at similar offsets on current main; line numbers may have shifted by a few hundred from the input-edge perf merge.

## Hard constraints

1. **Cardinal rule.** The recogniser inspects only CSS structural shape (slot identity, expression-tree variant, slot-name repetition counts). It does **not** inspect any character of any property name. Renaming every slot in the cabinet must produce identical descriptors modulo the new names. A 6502 / brainfuck / non-emulator cabinet of the same loop shape must produce a structurally equivalent descriptor and fast-forward identically.

2. **No env-var toggle.** No `CALCITE_REP_GENERIC`, no `CALCITE_REP_LEGACY`, no `CALCITE_REP_DUAL` survive past Phase 4. The descriptor path is the path.

3. **Loud failure on unrecognised shape.** When a REP-shape opcode dispatches but no descriptor exists, or the descriptor's `bulk_class` is `PerIter` (no fast-forward applier), or the applier returns `Unsupported`, the dispatcher **panics** with the same diagnostic shape as today's `rep_fast_forward_panic` (opcode, CX, flags, CS, IP). Per-iter CSS fallback is not acceptable: long REPs at 10-1000x slowdown make every cart that hits one unusable — the user's run hangs on a frozen screen with no error. A panic ends it with information.

4. **Precondition is a different outcome from Unsupported.** When the cabinet's own outer guard predicate evaluates false (e.g., IRQ vectored this tick, or the CSS already exited the REP via ZF on CMPS/SCAS), the applier returns `PreconditionNotMet` and the dispatcher silently bails. This is *not* a recogniser gap — the CSS already produced correct post-state and calcite has nothing to do. Two distinct outcomes, two distinct dispatcher responses.

5. **Perf gate.** Doom8088 web and CLI `runMsToInGame` within ±1% of pre-mission baseline (web 3-run median, CLI 3-run median). Run `doom-loading` profile on both targets. Quote JSON before/after. If only one target regresses, that's a real regression in that target — diagnose, don't dismiss.

6. **Correctness gate.** `node tests/harness/run.mjs smoke` (7 carts) PASS at every commit on the branch. Doom8088 reaches in-game (`g_gamestate==0`) on both web and CLI. Prince of Persia title screen unchanged.

7. **Compile-once-per-load.** All recogniser work happens at `Evaluator::from_parsed` time. The per-tick applier reads pre-computed descriptors — never re-recognises.

## Final file structure

After completion, the calcite tree changes as follows:

- **Created** in `crates/calcite-core/src/`:
  - `pattern/loop_descriptor.rs` — descriptor types + recogniser (one large file; matches reference shape).
  - `pattern/loop_descriptor/tests.rs` — recogniser unit tests on synthetic cabinets A (x86-shaped) and B (brainfuck-shaped) + negative tests + renaming probe + new tests for `precondition` / `per_iter_cycles` / `ip_extra_advance_slot` / `comparison` fields.
  - `pattern/rep_applier.rs` — `apply_fill` / `apply_copy` / `apply_read_only` driven by `LoopDescriptor`. Returns one of three outcomes (`Applied { iterations }` / `PreconditionNotMet` / `Unsupported(reason)`).
  - `tests/rep_fast_forward.rs` — integration tests asserting parity with the (about-to-be-deleted) hardcoded path on small synthetic cabinets. Survives the deletion as parity tests for the new path.

- **Modified**:
  - `crates/calcite-core/src/eval.rs` — `Evaluator::loop_descriptors` field, recogniser invocation in `from_parsed`.
  - `crates/calcite-core/src/state.rs` — `VirtualRegion { start, end, source }` type + `State::virtual_regions: Vec<VirtualRegion>` field, populated by the windowed-byte-array recogniser.
  - `crates/calcite-core/src/compile.rs` — `CompiledProgram::loop_descriptors` field; **rewrite** of `rep_fast_forward` body to dispatch into the applier; **deletion** of `rep_fast_forward_cmps_scas`, `compute_sub_flags` (lifted into `pattern/rep_applier.rs` if still needed), `bulk_fill` / `bulk_store_byte` / `ranges_overlap_virtual` lifted to `pub(crate)` for the applier. `rep_fast_forward_panic` retained — it is the canonical panic shape.
  - `crates/calcite-core/src/pattern.rs` — `pub mod loop_descriptor;` + `pub(crate) mod rep_applier;`.

- **Not created** (a notable inversion from the reference branch): no `pattern/rep_dual_harness.rs`. The dual harness was scaffolding for the multi-step landing on `worktree-rep-3b`; this plan lands the work in a different order and the harness is unnecessary. The integration tests in `tests/rep_fast_forward.rs` cover what the harness was for.

---

## Phase 1: Port descriptor types + recogniser

Goal: `pattern/loop_descriptor.rs` exists on `feat/rep-generic`, the recogniser runs at `Evaluator::from_parsed` time, all unit tests pass, real Doom8088 cabinet produces ~10 descriptors. No runtime path change yet — descriptors are emitted but not consumed.

The reference branch has 13 commits to land this; we land it in one because the design is settled and the tests are the gate.

### Task 1.1: Add `LoopDescriptor` + friends, recogniser, `loop_descriptors` field

**Files:**
- Create: `crates/calcite-core/src/pattern/loop_descriptor.rs`
- Create: `crates/calcite-core/src/pattern/loop_descriptor/tests.rs`
- Modify: `crates/calcite-core/src/pattern.rs` (add `pub mod loop_descriptor;`)
- Modify: `crates/calcite-core/src/eval.rs`: add `pub loop_descriptors: Vec<crate::pattern::loop_descriptor::LoopDescriptor>` field on `Evaluator`; in `from_parsed` after the cabinet is parsed, call `recognise_loops(&parsed.assignments)`; populate the field.
- Modify: `crates/calcite-core/src/state.rs`: add `VirtualRegion` type + `virtual_regions: Vec<VirtualRegion>` field on `State`, initialize empty in `State::new`.
- Modify: `crates/calcite-core/src/eval.rs::install_windowed_byte_array`: push a `VirtualRegion { start: cw.window_base, end: cw.window_end, source: "windowed_byte_array" }` after installing the window.

- [ ] **Step 1: Copy `pattern/loop_descriptor.rs` from `origin/worktree-rep-3b` (commit `645f497`)**

The reference file is at `../calcite/.claude/worktrees/rep-3b/crates/calcite-core/src/pattern/loop_descriptor.rs`. Copy verbatim — the recogniser logic is settled. The file defines:

```rust
pub struct LoopDescriptor {
    pub key_property: String,
    pub key_value: i64,
    pub ip_property: String,
    pub ip_self_property: String,
    pub ip_advance_literal: i32,
    pub predicate_properties: Vec<String>,
    pub predicate: StyleTest,
    pub counter: Option<CounterEntry>,
    pub pointers: Vec<PointerEntry>,
    pub writes: Vec<WriteEntry>,
    pub flag_conditioned: bool,
    pub bulk_class: BulkClass,
    // Phase-3 wart fields, added incrementally in their own tasks:
    //   pub precondition: Option<StyleTest>,
    //   pub per_iter_cycles: Option<i32>,
    //   pub ip_extra_advance_slot: Option<String>,
    //   pub comparison: Option<ComparisonShape>,
}
pub enum BulkClass { ReadOnly, Fill, Copy, PerIter }
pub struct CounterEntry { pub property: String, pub self_property: String, pub step: i32 }
pub struct PointerEntry {
    pub property: String, pub self_property: String,
    pub base_step: i32, pub flag_property: String, pub flag_bit: u32,
}
pub struct WriteEntry {
    pub addr_property: String, pub val_property: String,
    pub addr_expr: Expr, pub val_expr: Expr,
    pub addr_decomposition: Option<(String, String)>,
    pub val_indirect_read: Option<IndirectRead>,
}
pub struct IndirectRead {
    pub seg_property: Option<String>,
    pub pointer_property: String,
    pub intermediate_property: String,
}
pub fn recognise_loops(assignments: &[Assignment]) -> Vec<LoopDescriptor> { /* ... */ }
```

The four "Phase-3 wart fields" listed in the comment above are **not** added in Phase 1 — each is added in its own Phase 3 task.

Copy command (from the calcite worktree root):
```
cp ../rep-3b/crates/calcite-core/src/pattern/loop_descriptor.rs \
   crates/calcite-core/src/pattern/loop_descriptor.rs
```

- [ ] **Step 2: Copy the unit-test file**

```
mkdir -p crates/calcite-core/src/pattern/loop_descriptor
cp ../rep-3b/crates/calcite-core/src/pattern/loop_descriptor/tests.rs \
   crates/calcite-core/src/pattern/loop_descriptor/tests.rs
```

- [ ] **Step 3: Register the module in `pattern.rs`**

Modify `crates/calcite-core/src/pattern.rs`: add line `pub mod loop_descriptor;` near the other `pub mod` declarations.

- [ ] **Step 4: Add `VirtualRegion` + `State::virtual_regions`**

Modify `crates/calcite-core/src/state.rs`. Add struct above `impl State`:

```rust
/// A linear-address range backed by something other than the flat
/// `state.memory` byte array. Bulk paths consult this list before
/// committing wide writes, so they can bail when the destination would
/// overlap (e.g., a windowed-byte-array region whose CSS dispatch
/// can't be substituted with a flat memset).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VirtualRegion {
    /// First linear address inside the region (inclusive).
    pub start: i32,
    /// One past the last linear address inside the region.
    pub end: i32,
    /// Recogniser-supplied label, free-form, used for diagnostics only.
    pub source: &'static str,
}
```

Add field to the `State` struct:

```rust
pub virtual_regions: Vec<VirtualRegion>,
```

Initialize empty in `State::new`:

```rust
virtual_regions: Vec::new(),
```

- [ ] **Step 5: Populate `virtual_regions` from the windowed-byte-array recogniser**

In `crates/calcite-core/src/eval.rs::install_windowed_byte_array`, after the `state.windowed_byte_array = Some(...)` assignment and before the `log::info!`, push the region:

```rust
state.virtual_regions.push(crate::state::VirtualRegion {
    start: cw.window_base,
    end: cw.window_end,
    source: "windowed_byte_array",
});
```

- [ ] **Step 6: Add `Evaluator::loop_descriptors` field and recogniser invocation**

Modify `crates/calcite-core/src/eval.rs`. Add to the `Evaluator` struct:

```rust
pub loop_descriptors: Vec<crate::pattern::loop_descriptor::LoopDescriptor>,
```

In `Evaluator::from_parsed`, after the cabinet has been parsed (and `parsed.assignments` is available) but before construction returns, add:

```rust
let loop_descriptors = crate::pattern::loop_descriptor::recognise_loops(&parsed.assignments);
log::info!(
    "[loop-descriptor] recognised {} self-loop opcodes",
    loop_descriptors.len(),
);
```

Initialize the field in the `Evaluator { ... }` construction expression at the bottom of `from_parsed`. Also initialize in any other constructor (test stubs) by setting `loop_descriptors: Vec::new()`.

- [ ] **Step 7: Add `CompiledProgram::loop_descriptors` mirror**

Modify `crates/calcite-core/src/compile.rs`. Add to `CompiledProgram` struct:

```rust
/// Mirror of `Evaluator::loop_descriptors`. Populated at compile time
/// by the same recogniser; carried on the program so the per-tick path
/// can consult it without re-recognising.
pub loop_descriptors: Vec<crate::pattern::loop_descriptor::LoopDescriptor>,
```

Initialize empty in any `CompiledProgram { ... }` construction (search for `fn compile` and any `CompiledProgram {` literal). In `Evaluator::from_parsed`, after computing `loop_descriptors`, mirror it onto the compiled program:

```rust
compiled.loop_descriptors = loop_descriptors.clone();
```

- [ ] **Step 8: Run recogniser unit tests**

```
cargo test -p calcite-core --lib loop_descriptor 2>&1 | tail -20
```

Expected: all 15 tests in `pattern::loop_descriptor::tests` pass. These include:
- `a_and_b_descriptors_are_structurally_equivalent` — the x86 / brainfuck genericity probe.
- `no_loop_when_no_ip_stay_shape`, `no_loop_when_only_ip_stay_no_counter_or_pointer_or_write` — negative tests.
- `renaming_slots_preserves_structure` — the name-blindness probe.
- `outer_wrappers_are_stripped`, `ip_wrapper_with_non_self_overrides_still_recognises`, `dispatch_family_picks_largest_member_set` — wrapper stripping.
- `memwrite_pairing_uses_assignment_order_proximity`.
- BulkClass classification + CMPS/SCAS recognition tests from phase 3a.
- Indirect-read recognition tests from phase 3b step 2.

If any test fails, the port is incomplete or main has drifted in a way that changes the recogniser's input. Diff the test file against the reference and investigate. **Do not weaken a test to make it pass.**

- [ ] **Step 9: Run full lib test suite**

```
cargo test -p calcite-core --lib 2>&1 | tail -20
```

Expected: all tests pass except the 4 pre-existing `no-opcode` panics from the hardcoded `rep_fast_forward` (`compile::tests::compile_full_program`, `compile::tests::compile_value_forwarding`, `compile::tests::compile_dispatch_table`, `eval::tests::tick_applies_assignments`). These will be fixed in Phase 3 Task 3.5 when the hardcoded path is rewritten.

- [ ] **Step 10: Verify against the real Doom8088 cabinet**

Build the cabinet and check the recogniser produces ~10 descriptors:

```
cd ../../../CSS-DOS/.claude/worktrees/rep-generic
node builder/build.mjs carts/doom -o /tmp/doom.css
cd ../../calcite/.claude/worktrees/rep-generic
RUST_LOG=info cargo run --release -p calcite-cli -- -i /tmp/doom.css --max-ticks 1000 2>&1 | grep loop-descriptor | head -5
```

Expected output includes `[loop-descriptor] recognised 10 self-loop opcodes` (the 4 STOS/MOVS + 4 CMPS/SCAS + 2 LODS variants on a current doom8088 cabinet). If the count is off, investigate.

- [ ] **Step 11: Commit**

```
git add crates/calcite-core/src/pattern/loop_descriptor.rs \
        crates/calcite-core/src/pattern/loop_descriptor/tests.rs \
        crates/calcite-core/src/pattern.rs \
        crates/calcite-core/src/state.rs \
        crates/calcite-core/src/eval.rs \
        crates/calcite-core/src/compile.rs
git commit -m "$(cat <<'EOF'
rep-generic phase 1: descriptor recogniser + virtual regions

Port loop_descriptor + recogniser from origin/worktree-rep-3b
(645f497) to current main. Adds Evaluator::loop_descriptors,
CompiledProgram::loop_descriptors, State::virtual_regions. The
windowed-byte-array recogniser registers its window so the bulk
applier (Phase 2) can detect overlaps generically.

No runtime path change. Descriptors emitted but not yet consumed.
The hardcoded rep_fast_forward is still the active fast-forward
path. 15 recogniser unit tests pass. doom8088 cabinet emits 10
descriptors.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Port the appliers (Fill / Copy / ReadOnly) — not yet wired

Goal: `pattern/rep_applier.rs` exists, contains `apply_fill` / `apply_copy` / `apply_read_only` (and their `_with_commit` variants), is **not yet called from the dispatch path**. The hardcoded `rep_fast_forward` continues to be the active fast-forward; the applier is dead code waiting for Phase 3 Task 3.5's dispatch rewrite.

The reference at `origin/worktree-rep-3b/crates/calcite-core/src/pattern/rep_applier.rs` is 3099 lines including tests. Port verbatim — the per-iter / bulk-fill / bulk-copy / cmps-scas logic is settled.

### Task 2.1: Port `rep_applier.rs` and lift the four primitive helpers

**Files:**
- Create: `crates/calcite-core/src/pattern/rep_applier.rs`
- Modify: `crates/calcite-core/src/pattern.rs` (`pub(crate) mod rep_applier;`)
- Modify: `crates/calcite-core/src/compile.rs`: lift `fn bulk_fill`, `fn bulk_store_byte`, `fn ranges_overlap_virtual`, `fn compute_sub_flags` from private to `pub(crate)`. (These functions exist today on the rep-3b reference at lines 6330 / 6681 / 6698 / 6730; on `feat/rep-generic` they exist inside `rep_fast_forward`'s body. The lift is mechanical.)

- [ ] **Step 1: Lift `bulk_fill` / `bulk_store_byte` / `ranges_overlap_virtual` / `compute_sub_flags` to crate-visible**

Read `crates/calcite-core/src/compile.rs` to find the current definitions on `feat/rep-generic`. The functions are:
- `compute_sub_flags(dst: i32, src: i32, is_word: bool, prev_flags: i32) -> i32` — implements x86 SUB-flag computation used by CMPS/SCAS.
- `ranges_overlap_virtual(state: &State, start: i64, len: i64) -> bool` — checks `state.virtual_regions` for overlap with `[start, start+len)`. Today it has hardcoded `0xF0000` / `0xD0000` carve-outs *in addition to* the virtual_regions list; the lifted version reads only from `state.virtual_regions` plus the structural `>= 0xF0000` extended-map boundary.
- `bulk_store_byte(state: &mut State, addr: i64, val: u8)` — writes one byte through packed-cell / windowed-array / extended-map routing.
- `bulk_fill(state: &mut State, dst: i64, count: usize, val: u8)` — bulk memset variant of the above.

Move these from any nested-fn position inside `rep_fast_forward` to top-level `pub(crate) fn` declarations in `compile.rs`. They will outlive `rep_fast_forward`'s rewrite (Task 3.5) and survive Phase 4.

For `ranges_overlap_virtual`, **remove the hardcoded 0xD0000 carve-out** — the windowed-byte-array recogniser now registers itself in Phase 1 Step 5. Keep the structural `>= 0xF0000` extended-map check (it's a State invariant, not cabinet-specific).

- [ ] **Step 2: Copy `rep_applier.rs` from `origin/worktree-rep-3b` verbatim**

```
cp ../rep-3b/crates/calcite-core/src/pattern/rep_applier.rs \
   crates/calcite-core/src/pattern/rep_applier.rs
```

The file exports:

```rust
pub(crate) enum ApplyOutcome { Applied { iterations: i32 }, Unsupported(&'static str) }
pub(crate) enum CommitMode { MemoryOnly, Full }
pub(crate) fn apply_fill(descriptor, program, state, slots) -> ApplyOutcome
pub(crate) fn apply_fill_with_commit(descriptor, program, state, slots, commit) -> ApplyOutcome
pub(crate) fn apply_copy(descriptor, program, state, slots) -> ApplyOutcome
pub(crate) fn apply_copy_with_commit(descriptor, program, state, slots, commit) -> ApplyOutcome
pub(crate) fn apply_read_only(descriptor, program, state, slots) -> ApplyOutcome
pub(crate) fn apply_read_only_with_commit(descriptor, program, state, slots, commit) -> ApplyOutcome
```

**Critical: this is the form before Phase 3 wart fixes.** It contains WART-commented literal-name reads (`--prefixLen`, `--ES`, `--DS`, `--SI`, `--DI`, `--AL`, `--AX`, `--repType`) and a hardcoded `per_iter_cycles` table. Those get fixed in Phase 3. Leave them in for now — Phase 2 is "land the body, get tests passing, don't change semantics."

- [ ] **Step 3: Register the module**

Modify `crates/calcite-core/src/pattern.rs`: add `pub(crate) mod rep_applier;`.

- [ ] **Step 4: Add `ApplyOutcome::PreconditionNotMet` variant**

Per the "Precondition is a different outcome from Unsupported" constraint, the outcome enum needs three states. Modify the enum:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ApplyOutcome {
    /// Applier ran successfully, mutated state, charged cycles.
    Applied { iterations: i32 },
    /// The cabinet's own outer guard predicate evaluates false on this
    /// tick — the CSS already produced the correct post-state and
    /// calcite has nothing to do. Dispatcher silently bails.
    PreconditionNotMet,
    /// The recogniser produced a descriptor but the applier doesn't
    /// handle this shape (e.g., BulkClass::PerIter, or a Copy shape
    /// without indirect-read decomposition). The dispatcher PANICS
    /// with cabinet state; per-iter CSS fallback is not acceptable for
    /// REP loops because the 10-1000x slowdown makes carts unusable.
    Unsupported(&'static str),
}
```

For Phase 2 no applier produces `PreconditionNotMet` — every existing `Unsupported` stays `Unsupported`. Phase 3 Task 3.4 (precondition wart) wires it up.

- [ ] **Step 5: Wire up applier tests**

The reference file's tests are inline `#[cfg(test)] mod tests`. They should compile and pass as-is. Run:

```
cargo test -p calcite-core --lib rep_applier 2>&1 | tail -20
```

Expected: 47 tests pass (15 Fill + 14 Copy + 18 ReadOnly). If a test fails because of the `PreconditionNotMet` enum variant addition, update the test's match arm to be exhaustive.

- [ ] **Step 6: Run full lib test suite**

```
cargo test -p calcite-core --lib 2>&1 | tail -20
```

Expected: all pass except the 4 pre-existing no-opcode failures.

- [ ] **Step 7: Commit**

```
git add crates/calcite-core/src/pattern/rep_applier.rs \
        crates/calcite-core/src/pattern.rs \
        crates/calcite-core/src/compile.rs
git commit -m "$(cat <<'EOF'
rep-generic phase 2: port descriptor-driven appliers (not yet wired)

Port pattern/rep_applier.rs from origin/worktree-rep-3b (645f497):
apply_fill (STOS), apply_copy (MOVS via indirect-read tracing), and
apply_read_only (LODS/CMPS/SCAS). All three appliers mutate state
through bulk_fill / bulk_store_byte / state.read_mem — generic memory
routing that respects packed cells, windowed byte arrays, and the
extended map without applier-side knowledge.

Lift bulk_fill / bulk_store_byte / ranges_overlap_virtual /
compute_sub_flags from rep_fast_forward's private scope to
pub(crate). These outlive rep_fast_forward's rewrite (Phase 3) and
deletion (Phase 4).

ApplyOutcome adds PreconditionNotMet variant; Phase 3 Task 3.4's
precondition wart will produce it. For now all bail paths return
Unsupported.

The hardcoded rep_fast_forward path is still the active one; the
new appliers are dead code until Phase 3 Task 3.5's dispatch
rewrite. 47 applier tests pass.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Fix the cardinal-rule warts in the descriptor + applier

Each task adds a descriptor field, extends the recogniser to populate it, and updates the applier to read by slot index instead of by literal name. Each lands as its own commit so a bisect can isolate it.

Wart 4 from the audit ("wasm32 path is a no-op because env-var-gated") doesn't appear here as a separate task — it's resolved by Phase 3 Task 3.5 (the dispatch rewrite) using no env var at all.

### Task 3.1: Wart 1 — `per_iter_cycles` field on descriptor

**The wart.** `rep_applier::per_iter_cycles(descriptor) -> i32` returns hardcoded `10` / `17` / `22` / `15` for `Fill` / `Copy` / `ReadOnly+2-pointers` / `ReadOnly+1-pointer`. These are x86 cycle counts for STOS/MOVS/CMPS/SCAS. A 6502 cabinet would have different counts.

**The fix.** The cabinet's CSS dispatches `--cycleCount` writes per opcode, with a literal `+ K` per-iteration delta. The recogniser extracts `K` for the rep opcode and stores it on the descriptor. The applier reads it.

**Files:**
- Modify: `crates/calcite-core/src/pattern/loop_descriptor.rs` (add `per_iter_cycles: Option<i32>` to `LoopDescriptor`; extend recogniser to populate)
- Modify: `crates/calcite-core/src/pattern/rep_applier.rs` (drop the hardcoded `per_iter_cycles` function, read from descriptor)
- Modify: `crates/calcite-core/src/pattern/loop_descriptor/tests.rs` (add `per_iter_cycles_extracted_from_cyclecount_dispatch` synthetic test)

- [ ] **Step 1: Write a failing test for the recogniser extraction**

Add to `tests.rs`:

```rust
#[test]
fn per_iter_cycles_extracted_from_cyclecount_dispatch() {
    // A synthetic cabinet whose --cycleCount dispatch contains:
    //   if(opcode=0x42: calc(self + 13); else: calc(self + 4))
    // The recogniser should attach per_iter_cycles=Some(13) to the
    // descriptor for key_value=0x42.
    let assignments = synthetic_cabinet_with_cyclecount_dispatch();
    let descs = recognise_loops(&assignments);
    let d = descs.iter().find(|d| d.key_value == 0x42).expect("descriptor for 0x42");
    assert_eq!(d.per_iter_cycles, Some(13));
}
```

The helper `synthetic_cabinet_with_cyclecount_dispatch` constructs a minimal cabinet with two dispatch families: the rep loop family (so the descriptor exists for 0x42) and a separate dispatch family whose body for key `0x42` is `calc(var(--cycleCount) + 13)`. Model it on the existing brainfuck-cabinet helpers in the same file.

- [ ] **Step 2: Run test, expect compile failure on `d.per_iter_cycles`**

```
cargo test -p calcite-core --lib per_iter_cycles_extracted 2>&1 | tail -10
```

Expected: compile error — field doesn't exist yet.

- [ ] **Step 3: Add the field to `LoopDescriptor`**

In `loop_descriptor.rs`, add to the struct:

```rust
/// Per-iteration cycle cost, when the cabinet's --cycleCount-shaped
/// dispatch body for this opcode has shape `calc(self + K)` for some
/// literal K. `None` when the recogniser can't decompose; the applier
/// returns Unsupported and the dispatcher panics (since cycle accuracy
/// is observable through cycleCount-gated branches in the cabinet).
pub per_iter_cycles: Option<i32>,
```

Initialize as `None` everywhere `LoopDescriptor { ... }` is constructed in tests (every synthetic-cabinet builder needs the new field).

- [ ] **Step 4: Extend the recogniser to populate `per_iter_cycles`**

In `loop_descriptor.rs`, after the main per-opcode descriptor is built and before `out.push(desc)`, look up the cycle counter dispatch.

Add a helper `extract_per_iter_cycles(assignments: &[Assignment], key_property: &str, key_value: i64) -> Option<i32>` that:
1. Scans `assignments` for ones whose body is a `StyleCondition` keyed on `key_property` (the same key as the loop family) where the branch for `key_value` has shape `Expr::Calc(CalcOp::Add(Expr::Var(self_property), Expr::Literal(k)))` and `self_property == asn.property` (the body reads its own slot — a self-add shape).
2. Among matching assignments, return the K from the most prolifically self-adding one (the cabinet's cycle counter is by far the most-dispatched-on slot with this shape — count the assignment's branch count and pick the max). Cardinal-rule note: this picks the **cycle counter family** structurally — "the slot whose dispatch is a per-opcode self + literal pattern with the most opcodes participating." A brainfuck cabinet whose tick counter has the same shape would be identified identically. Renaming `--cycleCount` to `--zorch` does not affect the match.
3. Return `Some(K)` if a match exists, `None` otherwise.

Document this rationale in code comments — future readers need to know "we picked this candidate because it has the most participants in the dispatch family," not "we matched the slot name."

- [ ] **Step 5: Run the failing test, expect PASS**

```
cargo test -p calcite-core --lib per_iter_cycles_extracted 2>&1 | tail -10
```

- [ ] **Step 6: Update the applier to read from the descriptor**

In `rep_applier.rs`, delete the hardcoded `fn per_iter_cycles(descriptor) -> i32` helper. Replace every call site with:

```rust
let per_iter = match descriptor.per_iter_cycles {
    Some(k) => k,
    None => return ApplyOutcome::Unsupported("per_iter_cycles not extracted"),
};
```

This sits inside `apply_*_with_commit` after the precondition (post-Task 3.4) and the basic counter check have passed. Returning `Unsupported` here will cause the dispatcher to panic — which is correct, because a real cabinet with this loop shape SHOULD have a recognisable cycle dispatch.

- [ ] **Step 7: Run full lib test suite**

```
cargo test -p calcite-core --lib 2>&1 | tail -10
```

All applier tests + recogniser tests should pass. The test fixtures construct `LoopDescriptor` by hand — update each constructor to set `per_iter_cycles: Some(10)` (or whatever the test expects) so the applier's new `None → Unsupported` branch doesn't fire spuriously.

- [ ] **Step 8: Verify against real doom8088 cabinet**

Add a one-line print in the recogniser's diagnostic block (gated by `log::info!`) showing `per_iter_cycles` for each descriptor. Then:

```
cd ../../../CSS-DOS/.claude/worktrees/rep-generic
node builder/build.mjs carts/doom -o /tmp/doom.css
cd ../../calcite/.claude/worktrees/rep-generic
RUST_LOG=info cargo run --release -p calcite-cli -- -i /tmp/doom.css --max-ticks 100 2>&1 | grep per_iter_cycles
```

Expected: STOS=Some(10), MOVS=Some(17), CMPS=Some(22), SCAS=Some(15) — same numbers as the hardcoded path used.

- [ ] **Step 9: Commit**

```
git add crates/calcite-core/src/pattern/loop_descriptor.rs \
        crates/calcite-core/src/pattern/loop_descriptor/tests.rs \
        crates/calcite-core/src/pattern/rep_applier.rs
git commit -m "$(cat <<'EOF'
rep-generic wart 1: per_iter_cycles structural

LoopDescriptor gains per_iter_cycles: Option<i32>, populated at
recogniser time by extracting the literal K from the most-
populated `self + K` dispatch family for this opcode. Applier
drops its hardcoded 10/17/22/15 table.

Cardinal-rule probe: the recogniser identifies the cycle slot
structurally ("the most-populated self-add dispatch family"). A
6502 / brainfuck cabinet with the same shape would attach its
own cycle counts; one without a cycle counter would land None
and the applier would panic loudly on entry.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: Wart 2 — `ip_extra_advance_slot` field on descriptor (replaces `--prefixLen` literal read)

**The wart.** `rep_applier::read_prefix_len` reads `--prefixLen` by literal name. The slot exists because the cabinet's IP-advance formula is `IP = IP + 1 + var(--prefixLen)` — the literal `1` is the opcode length, the `+ prefixLen` is the optional REP prefix's contribution.

**The fix.** The recogniser captures the name of the extra slot added to the IP advance, and the applier resolves it by slot name through the existing `read_prop` helper.

**Files:** same three files as Task 3.1.

- [ ] **Step 1: Write a failing test**

Add to `tests.rs`:

```rust
#[test]
fn ip_extra_advance_slot_extracted_from_ip_body() {
    // The cabinet's IP-advance branch shape:
    //   else: calc(var(--IP_prev) + 1 + var(--extraStep))
    // where --extraStep is the opaquely-named extra-advance slot.
    let assignments = synthetic_cabinet_with_extra_ip_advance("--extraStep");
    let descs = recognise_loops(&assignments);
    assert_eq!(descs[0].ip_extra_advance_slot.as_deref(), Some("--extraStep"));
}

#[test]
fn ip_extra_advance_slot_renaming_is_blind() {
    let assignments = synthetic_cabinet_with_extra_ip_advance("--zorch");
    let descs = recognise_loops(&assignments);
    assert_eq!(descs[0].ip_extra_advance_slot.as_deref(), Some("--zorch"));
}

#[test]
fn ip_extra_advance_slot_none_when_no_extra() {
    // Plain `self + 1` shape — no extra var addend.
    let assignments = synthetic_cabinet_plain_ip_advance();
    let descs = recognise_loops(&assignments);
    assert!(descs[0].ip_extra_advance_slot.is_none());
}
```

- [ ] **Step 2: Add field + recogniser extension**

In `loop_descriptor.rs`:

```rust
/// Name of the slot whose value is added to the IP per-iteration step.
/// Populated by structural matching on the IP body's advance branch
/// when it has shape `calc(self + literal + var(extra))` (or any
/// reassociation thereof). `None` when the IP body is just
/// `self + literal` with no extra var addend.
pub ip_extra_advance_slot: Option<String>,
```

Extend the IP-body recogniser to look for an extra-var-addend shape in the advance branch. Pattern match on the recursive form: an `Expr::Calc(CalcOp::Add(...))` tree where one leaf is the IP self property, one is a literal (the opcode length), and one is a `Var(extra)` reference. When found, set `ip_extra_advance_slot = Some(extra.clone())`.

- [ ] **Step 3: Update the applier**

In `rep_applier::commit_ip_and_cycles`, replace:

```rust
let prefix_len = read_prefix_len(program, state, slots);  // OLD
```

with:

```rust
let prefix_len = match descriptor.ip_extra_advance_slot.as_deref() {
    Some(slot) => read_prop(program, state, slots, slot).unwrap_or(0),
    None => 0,
};
```

Delete the `read_prefix_len` helper.

- [ ] **Step 4: Verify against doom**

Doom's `--prefixLen` is captured. Confirm the post-tick IP matches the hardcoded path by running smoke + doom-loading to title:

```
cd ../../../CSS-DOS/.claude/worktrees/rep-generic
node tests/harness/run.mjs smoke
```

Expected: 7/7 PASS.

- [ ] **Step 5: Commit**

```
rep-generic wart 2: ip_extra_advance_slot structural

LoopDescriptor gains ip_extra_advance_slot: Option<String>. The
recogniser walks the IP body's advance branch; when it has shape
`calc(self + literal + var(extra))`, captures `extra`'s name.
Applier resolves to slot via read_prop instead of literal-name
reading `--prefixLen`.

A 6502 cabinet without an opcode-prefix mechanism produces None
here; the applier adds 0 to the IP step, which is correct.
```

### Task 3.3: Wart 3 — `comparison: Option<ComparisonShape>` (replaces CMPS/SCAS literal-name reads)

**The wart.** `apply_read_only`'s CMPS/SCAS branch reads `--ES`, `--DS`, `--SI`, `--DI`, `--AL`, `--AX`, `--repType` by literal name. The shape of the comparison (two stepping pointers, or one pointer + accumulator) and the slots involved should be structurally captured.

**Files:** loop_descriptor.rs, rep_applier.rs, tests.rs.

- [ ] **Step 1: Add `ComparisonShape` + `ComparisonSource` types**

In `loop_descriptor.rs`:

```rust
/// How a flag-conditioned ReadOnly loop performs its per-iter
/// comparison. Captured structurally from the cabinet's predicate
/// shape at recogniser time.
#[derive(Debug, Clone, PartialEq)]
pub struct ComparisonShape {
    /// "Destination" side — the byte read from this pointer is one
    /// operand of the comparison.
    pub dst_seg_property: String,
    pub dst_ptr_property: String,
    /// "Source" side — either another stepping pointer (CMPS shape)
    /// or an accumulator slot (SCAS shape).
    pub source: ComparisonSource,
    /// Slot whose value selects REPE vs REPNE semantics. Today this
    /// is --repType in the x86 cabinet; on a brainfuck cabinet it
    /// could be absent (None → unconditional REPE-shape exit).
    pub rep_type_property: Option<String>,
    /// Width in bytes per comparison step (1 for byte, 2 for word).
    /// Structurally derived from `dst_ptr.base_step`.
    pub width: u8,
}

#[derive(Debug, Clone, PartialEq)]
pub enum ComparisonSource {
    /// Two stepping pointers (CMPS).
    Pointer { seg_property: String, ptr_property: String },
    /// Accumulator slot read once per iter (SCAS). `byte_property`
    /// is read for byte-shape loops, `word_property` for word-shape.
    Accumulator { byte_property: String, word_property: String },
}
```

Add to `LoopDescriptor`:

```rust
/// Comparison shape for flag-conditioned ReadOnly loops (CMPS/SCAS).
/// `Some` when the predicate has the disjunction shape captured by
/// the recogniser and the read-side dispatches decompose cleanly;
/// `None` otherwise (which makes the applier return Unsupported and
/// the dispatcher panic).
pub comparison: Option<ComparisonShape>,
```

- [ ] **Step 2: Tests covering CMPS, SCAS, renaming probe**

Add to `tests.rs`:

```rust
#[test]
fn comparison_extracted_for_cmps() {
    let descs = recognise_loops(&cmps_byte_cabinet());
    let cmp = descs[0].comparison.as_ref().expect("comparison shape captured");
    assert!(matches!(cmp.source, ComparisonSource::Pointer { .. }));
    assert_eq!(cmp.width, 1);
}

#[test]
fn comparison_extracted_for_scas() {
    let descs = recognise_loops(&scas_byte_cabinet());
    let cmp = descs[0].comparison.as_ref().expect("comparison shape captured");
    assert!(matches!(cmp.source, ComparisonSource::Accumulator { .. }));
}

#[test]
fn comparison_renaming_blind() {
    let descs_a = recognise_loops(&cmps_byte_cabinet());
    let descs_b = recognise_loops(&cmps_byte_cabinet_renamed_slots());
    // Comparison shape's structural fields differ only in name strings.
    assert_eq!(descs_a[0].comparison.is_some(), descs_b[0].comparison.is_some());
    let (a, b) = (descs_a[0].comparison.as_ref().unwrap(), descs_b[0].comparison.as_ref().unwrap());
    assert_eq!(a.width, b.width);
    matches!((&a.source, &b.source),
        (ComparisonSource::Pointer { .. }, ComparisonSource::Pointer { .. }));
}
```

- [ ] **Step 3: Extend the recogniser**

The recogniser already captures `flag_conditioned`. Extend it to also build `comparison` when `flag_conditioned == true`:

1. **Identify the destination read.** The predicate has the shape `<counter-positive> AND <flag-bit-N-target>`. The flag-bit-target's underlying flags slot has a `compute_sub_flags` shape feeding it. Walk back from the flags slot: the assignment writing it should have shape `subFlags(dst, src, ...)` (or in CSS shape, a structurally equivalent dispatch). The `dst` argument's source — a `read_mem(seg*16 + ptr)` expression — gives `dst_seg_property` and `dst_ptr_property`. For SCAS the dispatch is similar but with a register read on one side and a memory read on the other.

2. **Identify the source side.** If `pointers.len() == 2`, the source is the second pointer; the analogous `read_mem` shape gives its seg/ptr properties → `ComparisonSource::Pointer`. If `pointers.len() == 1`, the non-memory operand of `subFlags` is a slot dispatch with byte vs word selection based on the loop's pointer step — capture both as `ComparisonSource::Accumulator { byte_property, word_property }`.

3. **Identify the REPE/REPNE selector.** The flag-bit-N target in the predicate has a discriminator value (0 or 1) that depends on a slot. The slot whose value flips the target between 0 and 1 is `rep_type_property`. If the predicate has the same target value for all branches, no rep_type slot exists → `None`.

This is the deepest recogniser extension. **If the extraction is genuinely intractable to derive purely structurally for a particular shape, surface that — we re-scope by splitting "extract dst" / "extract source" / "extract rep_type" into separate tasks.** Do not silently weaken to "scan property names for `--ES`-shaped strings." Whole-name slot-identity comparison is allowed (that's what `read_prop` does); character inspection of names is not.

- [ ] **Step 4: Rewrite `apply_read_only`'s CMPS/SCAS branch**

Read every byte and discriminator via slot index resolved from `descriptor.comparison`. The literal-name reads (`--ES`, `--DS`, `--SI`, `--DI`, `--AL`, `--AX`, `--repType`) all go.

For `rep_type` semantics: if `comparison.rep_type_property` is `Some(slot)`, read the current value; otherwise default to "REPE-like" (continue while equal). The descriptor's `flag_conditioned == true` already gates entering this branch; the discriminator value selects the early-exit polarity.

- [ ] **Step 5: Verify**

Smoke + doom run to confirm no behavioural regression. CMPS/SCAS rarely fire in the doom common path; rely on the smoke suite for coverage.

- [ ] **Step 6: Commit**

```
rep-generic wart 3: comparison shape structural

CMPS/SCAS comparison metadata moved off literal-name reads onto
ComparisonShape on LoopDescriptor. The recogniser extracts dst /
source / rep_type slots structurally from the predicate's
disjunction shape and the flags-slot dispatch's subFlags-shape
arguments. apply_read_only drops --ES/--DS/--SI/--DI/--AL/--AX/
--repType literal-name reads.
```

### Task 3.4: Wart 6 — `precondition` field on descriptor

**The wart.** `try_apply_generic` reads `--hasREP`, `--repType`, `--CX`, `--flags`, `--hasSegOverride`, `--_irqActive`, `--_tf` by literal name to gate panic-or-bail. The CMPS/SCAS post-tick ZF short-circuit uses opcode tables and a hardcoded bit position (`(flags >> 6) & 1`).

**The fix.** The cabinet's CSS dispatch for the REP opcode wraps the loop body in a precondition predicate. The recogniser captures the predicate as a `StyleTest`; the applier evaluates it pre-run. When false → `PreconditionNotMet`. One mechanism replaces all 7 literal-name reads, all 4 opcode-table entries, and the bit-position read.

**Files:** loop_descriptor.rs, rep_applier.rs, tests.rs.

- [ ] **Step 1: Test for precondition capture**

Add to `tests.rs`:

```rust
#[test]
fn precondition_captures_outer_guard() {
    // Cabinet whose rep dispatch is wrapped:
    //   if(style(--hasREP: 1) AND style(--repType: 1)
    //      AND style(--_irqActive: 0) AND style(--_tf: 0)
    //      AND style(--hasSegOverride: 0):
    //      <rep body>;
    //    else: <single-iter passthrough>)
    let assignments = cabinet_with_outer_guard();
    let descs = recognise_loops(&assignments);
    let pre = descs[0].precondition.as_ref().expect("precondition captured");

    // Evaluating against a "all guards favourable" state returns true.
    let (program, state, slots) = setup_state_with(&[
        ("--hasREP", 1), ("--repType", 1),
        ("--_irqActive", 0), ("--_tf", 0), ("--hasSegOverride", 0),
    ]);
    assert!(crate::eval::evaluate_style_test(pre, &program, &state, &slots));

    // Setting --_irqActive to 1 makes it false.
    let (_, state_irq, slots_irq) = setup_state_with(&[
        ("--hasREP", 1), ("--repType", 1),
        ("--_irqActive", 1), ("--_tf", 0), ("--hasSegOverride", 0),
    ]);
    assert!(!crate::eval::evaluate_style_test(pre, &program, &state_irq, &slots_irq));
}

#[test]
fn precondition_none_when_no_outer_wrapper() {
    // Brainfuck-shaped cabinet — bare rep body, no wrapper.
    let descs = recognise_loops(&brainfuck_rep_cabinet());
    assert!(descs[0].precondition.is_none());
}
```

- [ ] **Step 2: Add `precondition: Option<StyleTest>` to descriptor**

```rust
/// The cabinet's own outer guard predicate for whether the rep body
/// should run this tick. Captured structurally from the StyleCondition
/// wrapping the rep dispatch body. When the predicate evaluates false
/// against the post-tick slot state, the applier returns
/// PreconditionNotMet and the dispatcher silently bails (the CSS
/// already produced the correct single-iter result).
///
/// `None` when the cabinet has no outer wrapper — the loop body
/// runs unconditionally whenever the opcode dispatches. (Brainfuck /
/// 6502 cabinets without segment overrides, single-step plumbing, or
/// REP prefixes would land here.)
pub precondition: Option<StyleTest>,
```

- [ ] **Step 3: Extend the recogniser**

When walking the dispatch body for the rep opcode, the outer wrapper is a `StyleCondition` whose `branches[0].condition` is the "all guards green" predicate (or a conjunction thereof). Capture the conjunction expressing "this branch fires" and store as `precondition`.

The CMPS/SCAS post-tick ZF short-circuit folds into this naturally: those descriptors' preconditions include a `flag-bit-N target-equals-X` test for the appropriate sign. If the existing `find_inner_dispatch` already strips this wrapper, then capturing the predicate is just remembering what's being stripped.

- [ ] **Step 4: Evaluate precondition at applier entry**

Modify `apply_fill_with_commit`, `apply_copy_with_commit`, `apply_read_only_with_commit`. As the first action after entry:

```rust
if let Some(pre) = descriptor.precondition.as_ref() {
    if !crate::eval::evaluate_style_test(pre, program, state, slots) {
        return ApplyOutcome::PreconditionNotMet;
    }
}
```

`evaluate_style_test` is a helper that walks a `StyleTest` against the program's property_slots and state's variables. It already exists in calcite-core (used by every per-tick condition); expose `pub(crate)` if not already exposed.

- [ ] **Step 5: Verify across the smoke set**

The precondition gating is the most semantically subtle change in the plan. Run:

```
cd ../../../CSS-DOS/.claude/worktrees/rep-generic
node tests/harness/run.mjs smoke
```

Expected: 7/7 PASS. Any cart that hits a CMPS/SCAS short-circuit (zork? prince of persia?) reaches its known checkpoint.

Also run a calcite-cli boot of doom to in-game and confirm `g_gamestate==0` reached.

- [ ] **Step 6: Commit**

```
rep-generic wart 6: precondition on descriptor

Capture the cabinet's own outer guard predicate as
LoopDescriptor.precondition: Option<StyleTest>. Applier evaluates
pre-run; if false, returns PreconditionNotMet and the dispatcher
silently bails — the CSS already produced correct state. Replaces
hardcoded reads of --hasREP / --repType / --hasSegOverride /
--_irqActive / --_tf and the CMPS/SCAS post-tick ZF short-circuit
(opcode-table-gated + (flags>>6)&1).

One mechanism replaces five literal-name reads + an opcode table
+ a hardcoded bit position. Brainfuck cabinet without those
guards: precondition is None, applier runs unconditionally.
```

### Task 3.5: Wart 5 — descriptor-lookup dispatch rewrite

**The wart.** `rep_fast_forward`'s body opens with:

```rust
let is_stos_movs = matches!(opcode, 0xAA | 0xAB | 0xA4 | 0xA5);
let is_cmps_scas = matches!(opcode, 0xA6 | 0xA7 | 0xAE | 0xAF);
```

The dispatcher knows specific x86 opcode bytes.

**The fix.** Look up by descriptor first, branch on `descriptor.bulk_class` and `descriptor.flag_conditioned`. No opcode-byte tables anywhere.

**Files:** compile.rs (large rewrite of `rep_fast_forward`).

- [ ] **Step 1: Rewrite `rep_fast_forward` body**

Replace the entire body from "snapshot every field" through the end of the function with:

```rust
fn rep_fast_forward(program: &CompiledProgram, state: &mut State, slots: &[i32]) {
    fn read_prop(program: &CompiledProgram, state: &State, slots: &[i32], name: &str) -> Option<i32> {
        if let Some(&s) = program.property_slots.get(name) {
            return Some(slots[s as usize]);
        }
        let bare = name.strip_prefix("--").unwrap_or(name);
        state.get_var(bare)
    }

    // What opcode just dispatched? Identity-compare against descriptors.
    let opcode = match read_prop(program, state, slots, "--opcode") {
        Some(v) => v,
        None => return,  // Cabinet has no opcode latch; no fast-forward applies.
    };

    // Find the descriptor for this opcode. No `matches!(opcode, 0xAA|...)`
    // — the descriptor list IS the source of truth for "what shapes can be
    // fast-forwarded."
    let Some(descriptor) = program.loop_descriptors.iter().find(|d| d.key_value == opcode as i64) else {
        // No descriptor: not a recognised loop shape. CSS handled the
        // single iter, nothing to fast-forward.
        return;
    };

    use crate::pattern::loop_descriptor::BulkClass;
    use crate::pattern::rep_applier::{
        apply_copy_with_commit, apply_fill_with_commit, apply_read_only_with_commit,
        ApplyOutcome, CommitMode,
    };

    let outcome = match descriptor.bulk_class {
        BulkClass::Fill =>
            apply_fill_with_commit(descriptor, program, state, slots, CommitMode::Full),
        BulkClass::Copy =>
            apply_copy_with_commit(descriptor, program, state, slots, CommitMode::Full),
        BulkClass::ReadOnly =>
            apply_read_only_with_commit(descriptor, program, state, slots, CommitMode::Full),
        BulkClass::PerIter => {
            // Recogniser produced a descriptor but bulk_class is PerIter
            // — no fast-forward applier handles this shape. Panic loudly;
            // 10-1000x slowdown on per-iter CSS is the user-facing
            // failure mode this design exists to prevent.
            rep_fast_forward_panic(
                "bulk-class-per-iter",
                opcode,
                read_prop(program, state, slots, "--repType").unwrap_or(0),
                read_prop(program, state, slots, "--CX").unwrap_or(0),
                read_prop(program, state, slots, "--flags").unwrap_or(0),
                read_prop(program, state, slots, "--CS").unwrap_or(0),
                state.get_var("IP").unwrap_or(0),
                "descriptor.bulk_class is PerIter — recogniser needs extension to cover this shape",
            );
        }
    };

    match outcome {
        ApplyOutcome::Applied { .. } => {},
        ApplyOutcome::PreconditionNotMet => {
            // The cabinet's own guard said "don't run the rep body
            // this tick" — CSS produced correct single-iter state,
            // nothing for calcite to do.
        }
        ApplyOutcome::Unsupported(reason) => {
            // Recogniser gap: descriptor exists but applier refused.
            // Panic with state — see "bulk-class-per-iter" comment above
            // for why fallback is not acceptable.
            rep_fast_forward_panic(
                "applier-unsupported",
                opcode,
                read_prop(program, state, slots, "--repType").unwrap_or(0),
                read_prop(program, state, slots, "--CX").unwrap_or(0),
                read_prop(program, state, slots, "--flags").unwrap_or(0),
                read_prop(program, state, slots, "--CS").unwrap_or(0),
                state.get_var("IP").unwrap_or(0),
                reason,
            );
        }
    }
}
```

Note: `rep_fast_forward_panic` still receives `--repType`/`--CX`/`--flags`/`--CS` by literal name **inside the panic diagnostic only**. That's documented as upstream-knowledge by design — the panic message is reporting cabinet state for a developer to debug, not a structural decision. The applier never reads these directly anymore.

- [ ] **Step 2: Delete `rep_fast_forward_cmps_scas` and `try_apply_generic`**

Once the new body is in place:
- `rep_fast_forward_cmps_scas` is unreachable. Delete it.
- `try_apply_generic` (if ported) is also unreachable. Delete it.
- Any env-var-gated dispatch (`rep_generic_enabled`, `CALCITE_REP_GENERIC` reads) — delete.

Search:
```
rg "rep_fast_forward_cmps_scas|try_apply_generic|rep_generic_enabled|CALCITE_REP_GENERIC|CALCITE_REP_LEGACY|CALCITE_REP_DUAL" crates/
```

Expected: only stale-doc hits remain; live code references are gone.

- [ ] **Step 3: Run smoke + tests**

```
cargo test -p calcite-core --lib 2>&1 | tail -10
cd ../../../CSS-DOS/.claude/worktrees/rep-generic
node tests/harness/run.mjs smoke
```

All must pass. The 4 previously-failing no-opcode tests now PASS (the new dispatcher silently bails when there's no opcode latch).

- [ ] **Step 4: Commit**

```
rep-generic wart 5: dispatcher looks up descriptor, no opcode tables

Replace rep_fast_forward's `let is_stos_movs = matches!(opcode,
0xAA|0xAB|0xA4|0xA5)` and `is_cmps_scas = matches!(opcode,
0xA6|0xA7|0xAE|0xAF)` with descriptor lookup against
program.loop_descriptors. Dispatch on descriptor.bulk_class. The
0xAA/0xAB/0xA4/0xA5/0xA6/0xA7/0xAE/0xAF opcode-byte literals are
gone from live code (matches in panic strings and test fixtures
remain — those are upstream-knowledge by design).

flag_conditioned (already on descriptor) replaces is_cmps_scas
everywhere downstream. The CMPS/SCAS post-tick ZF short-circuit
folded into wart 6's precondition.

Delete rep_fast_forward_cmps_scas — unreachable.

The 4 pre-existing no-opcode test failures now PASS — the new
dispatcher silently bails when there's no opcode latch.
```

---

## Phase 4: Final clean-up and perf gate

Goal: prove the descriptor path matches pre-mission baseline on both targets. Smoke 7/7. Doom in-game both targets. Zero hardcoded x86 literals in live code outside the panic diagnostic and test fixtures.

### Task 4.1: Verify, bench, document

**Files:** none modified in this task (other than possible perf fixes if the gate fails).

- [ ] **Step 1: Search for any surviving env-var reads**

```
rg "CALCITE_REP_GENERIC|CALCITE_REP_LEGACY|CALCITE_REP_DUAL" crates/
```

Expected: zero live hits (comments-only OK, but should also be removed for hygiene).

- [ ] **Step 2: Search for the opcode-byte literals**

```
rg "0xAA|0xAB|0xA4|0xA5|0xA6|0xA7|0xAE|0xAF" crates/calcite-core/src/ --type rust
```

Expected: live-code matches only in test fixtures (synthetic cabinet builders) and the `rep_fast_forward_panic`'s diagnostic string template. Anything else needs to come out.

- [ ] **Step 3: Search for the literal-name reads**

```
rg "\"\-\-hasREP|\"\-\-repType|\"\-\-hasSegOverride|\"\-\-_irqActive|\"\-\-_tf|\"\-\-prefixLen|\"\-\-ES\"|\"\-\-DS\"|\"\-\-SI\"|\"\-\-DI\"|\"\-\-AL\"|\"\-\-AX\"" crates/calcite-core/src/
```

Expected: hits only in (a) the recogniser's precondition / comparison capture code, where it's writing the captured shape — but ideally these capture the slot names from the cabinet's own dispatch, not by hardcoding; (b) `rep_fast_forward_panic`'s diagnostic body. No applier or dispatcher hits.

- [ ] **Step 4: Run full workspace tests**

```
cargo test --workspace 2>&1 | tail -10
```

All pass. The 4 previously-failing tests now pass per Task 3.5 Step 3.

- [ ] **Step 5: Smoke test on CSS-DOS side**

```
cd ../../../CSS-DOS/.claude/worktrees/rep-generic
node tests/harness/run.mjs smoke 2>&1 | tail -10
```

Expected: 7/7 PASS.

- [ ] **Step 6: Establish or refresh perf baseline on `main`**

Check `docs/logbook/STATUS.md` — the perf baseline section. If the numbers are within a week or two of today and were taken on the same hardware, use them. Otherwise re-bench `main`:

```
cd ../../calcite/.claude/worktrees/rep-generic
git stash               # temporarily save our work
git checkout main
cd ../../../CSS-DOS/.claude/worktrees/rep-generic
node tests/bench/driver/run.mjs doom-loading                # 3 runs web
node tests/bench/driver/run.mjs doom-loading --target=cli   # 3 runs CLI
# Quote 3-run medians. Pin the JSON files for diff.
cd ../../calcite/.claude/worktrees/rep-generic
git checkout feat/rep-generic
git stash pop
```

- [ ] **Step 7: Bench `feat/rep-generic`**

```
cd ../../../CSS-DOS/.claude/worktrees/rep-generic
node tests/bench/driver/run.mjs doom-loading                # 3 runs web
node tests/bench/driver/run.mjs doom-loading --target=cli   # 3 runs CLI
```

Compare medians to baseline. Both targets within ±1%.

- [ ] **Step 8: If perf gate fails, diagnose**

The applier walks per-iter for the comparison shape — slower than the hardcoded path's tighter inner loop? The precondition evaluator does a `StyleTest` walk per opcode entry? Profile. Specific likely culprits:
- `evaluate_style_test` allocating per call → inline the eval shape onto the descriptor at compile time.
- `program.loop_descriptors.iter().find(...)` being linear → swap for a `HashMap<i32, usize>` of opcode → descriptor index.
- The applier's per-iter `read_prop` doing a `HashMap.get` lookup per iteration → resolve to slot index once at applier entry.

**Do not lower the perf gate.** Diagnose and fix. If a fix is non-trivial, surface it as a follow-up task in the plan rather than ship a regression.

- [ ] **Step 9: Doom in-game both targets**

Already covered by the perf bench (doom-loading reaching in-game is what the bench measures). Verify ok:true on both targets.

- [ ] **Step 10: Commit (if perf fix needed)**

If steps 7-8 needed code changes to hit the perf gate, commit them with a clear "perf:" prefix. Otherwise no commit in this phase — verification only.

```
rep-generic phase 4 (optional): perf fix

[Describe what the bottleneck was and the fix.]

Web doom-loading: BEFORE -> AFTER (3-run median).
CLI doom-loading: BEFORE -> AFTER (3-run median).
Both within ±1% of pre-mission main baseline.
```

---

## Phase 5: Documentation

### Task 5.1: Update STATUS, plan, and logs

**Files:**
- Modify: `docs/logbook/STATUS.md` (CSS-DOS) — remove the `rep_fast_forward` ship-blocker entry; release bar now clear of this item.
- Modify: `docs/plans/2026-05-06-rep-fast-forward-genericity.md` (this file) — mark all phases complete.
- Create: `docs/logbook/entries/2026-XX-XX-rep-fast-forward-genericity-landed.md` (CSS-DOS).
- Modify: `../calcite/docs/log.md` (calcite) — entry summarising the landing.

- [ ] **Step 1: Update CSS-DOS STATUS**

In `docs/logbook/STATUS.md`:
- Remove the "The ship-blocker (verified 2026-05-18)" section entirely. Release bar item 1 ("Calcite must be generic") is now clear of this specific blocker (any remaining genericity items move to their own STATUS bullets if applicable).
- Remove the active-work item 1 (rep_fast_forward generic applier).
- Update "Last verified" date.

- [ ] **Step 2: Create CSS-DOS logbook entry**

Create `docs/logbook/entries/2026-XX-XX-rep-fast-forward-genericity-landed.md`:

```markdown
# 2026-XX-XX — rep_fast_forward genericity landed (LANDED)

calcite `feat/rep-generic` (merged into main as commit XXXXX) lands
the descriptor-driven REP fast-forward applier, replacing ~600 lines
of hardcoded x86 string-op semantics in compile.rs. Recogniser
captures structural shape; runtime applier dispatches on BulkClass
with zero opcode-byte tables outside the panic diagnostic and zero
literal-name reads outside the recogniser's precondition-capture and
the panic body.

Cardinal-rule probe: brainfuck-shaped synthetic cabinet test in
`pattern/loop_descriptor/tests.rs::a_and_b_descriptors_are_structurally_equivalent`
produces structurally equivalent descriptors and the new applier
would fast-forward it identically.

Perf gate: doom-loading within ±1% of pre-mission baseline on
web AND CLI. Smoke 7/7. Doom8088 in-game both targets. Prince of
Persia title unchanged.

Cross-link: ../calcite/docs/log.md 2026-XX-XX entry. Plan
(now COMPLETE): `docs/plans/2026-05-06-rep-fast-forward-genericity.md`.

Files: see plan's "Final file structure" section.
```

Add a row to `docs/logbook/LOGBOOK.md` index pointing at this entry.

- [ ] **Step 3: Calcite log entry**

Append to `../calcite/docs/log.md`:

```markdown
## 2026-XX-XX — rep_fast_forward retired

The hardcoded x86 string-op fast-forward path in compile.rs (~600
lines including rep_fast_forward / rep_fast_forward_cmps_scas /
compute_sub_flags) is gone. Replaced by a descriptor-driven applier
(pattern/rep_applier.rs) fed by a structural recogniser
(pattern/loop_descriptor.rs) that runs at Evaluator::from_parsed
time.

LoopDescriptor fields cover everything the hardcoded path used to
read by name: counter / pointers / writes / addr_decomposition /
val_indirect_read (MOVS-shape source tracking) / per_iter_cycles /
ip_extra_advance_slot / comparison (CMPS/SCAS shape) / precondition
(cabinet's own outer guard). The applier reads every byte and slot
through these fields — never by character of any name. Genericity
probe holds: x86, brainfuck, and non-emulator cabinets with the
same loop shape produce structurally equivalent descriptors.

Dispatcher: looks up descriptor by opcode-as-key (identity compare,
not opcode-byte table), branches on BulkClass. PerIter and
Unsupported outcomes panic loudly with cabinet state — per-iter CSS
fallback is unacceptable because 10-1000x slowdown leaves users
stranded on a frozen screen.

Perf JSON before/after [paste]. Smoke 7/7 PASS. Doom8088 in-game
on web AND CLI. Cardinal-rule audit list (2026-05-05): now empty for
the REP path.

Files added: pattern/loop_descriptor.rs, pattern/loop_descriptor/tests.rs,
pattern/rep_applier.rs, tests/rep_fast_forward.rs. Files removed:
rep_fast_forward_cmps_scas function (in compile.rs).
```

- [ ] **Step 4: Mark plan complete**

In this file (`docs/plans/2026-05-06-rep-fast-forward-genericity.md`), prepend a status line at the top:

```markdown
**Status: COMPLETE (landed 2026-XX-XX on calcite feat/rep-generic merged into main as XXXXX / CSS-DOS master).**
```

- [ ] **Step 5: Commit CSS-DOS docs**

```
cd ../../../CSS-DOS/.claude/worktrees/rep-generic
git add docs/logbook/STATUS.md docs/logbook/LOGBOOK.md \
        docs/logbook/entries/2026-XX-XX-rep-fast-forward-genericity-landed.md \
        docs/plans/2026-05-06-rep-fast-forward-genericity.md
git commit -m "log: rep_fast_forward retired (calcite feat/rep-generic landed)"
```

- [ ] **Step 6: Commit calcite log**

```
cd ../../calcite/.claude/worktrees/rep-generic
git add docs/log.md
git commit -m "log: rep_fast_forward retired — descriptor-driven applier is the path"
```

- [ ] **Step 7: Push both, open PRs**

```
git -C ../../../CSS-DOS/.claude/worktrees/rep-generic push -u origin worktree-rep-generic
git -C ../../calcite/.claude/worktrees/rep-generic push -u origin feat/rep-generic
gh pr create -R [css-dos repo] ...
gh pr create -R [calcite repo] ...
```

Merge once review passes (per the user's preference — direct merge or PR review).

---

## Success criteria recap

1. `rep_fast_forward` body (the opcode-keyed match) no longer exists; the function is now a small dispatcher that does descriptor lookup + applier dispatch + panic on unrecognised.
2. `rep_fast_forward_cmps_scas` no longer exists.
3. `rep_fast_forward_panic` retained (canonical panic shape for diagnostics).
4. No `CALCITE_REP_GENERIC` / `_LEGACY` / `_DUAL` env vars anywhere.
5. No `0xAA|0xAB|0xA4|0xA5|0xA6|0xA7|0xAE|0xAF` opcode-byte literals in live code (matches in panic strings and test fixtures are OK).
6. No `--hasREP|--repType|--hasSegOverride|--_irqActive|--_tf|--prefixLen|--ES|--DS|--SI|--DI|--AL|--AX` literal-name reads in the applier or dispatcher (recogniser's precondition / comparison capture: OK; panic diagnostic: OK).
7. Genericity probe: the brainfuck-shaped synthetic cabinet test in `pattern/loop_descriptor/tests.rs` passes.
8. doom-loading web AND CLI within ±1% of pre-mission baseline. JSON quoted in the Phase 4 commit message (or Phase 5 logbook entry).
9. `node tests/harness/run.mjs smoke` 7/7 PASS.
10. Doom8088 reaches in-game on web and CLI. Prince of Persia title screen unchanged.

## Failure modes and how to detect them

- **Recogniser misclassifies a non-loop opcode as a loop.** Synthetic-cabinet unit tests cover negative cases. Real cabinets: smoke would fail.
- **Applier panics on a real cabinet path.** Loud and immediate by design. The diagnostic identifies the shape; either the recogniser needs extension (preferred) or the cabinet has a shape this plan didn't anticipate.
- **Perf regression > 1%.** Profile. Common culprits listed in Task 4.1 Step 8.
- **Precondition over-zealous (bails when it should run).** Smoke catches gross cases. For subtle ones, run doom-loading and watch for `runMsToInGame` ballooning (the precondition is bailing on every iter, falling back to per-iter CSS).
- **MOVS overlap semantics regression.** The reference branch's `apply_copy` walks per-byte read-then-write to preserve overlap; the unit tests cover this. Don't optimise without re-running those tests.
- **Cycle count drift.** doomLoad's progression is gated on `cycleCount`-based wait loops. A wrong `per_iter_cycles` will produce visible time-domain drift in the game's title screens / loading screens. Run doom-loading to in-game and confirm the same wall time / cycle count as pre-mission.

## Out of scope

- Affine non-REP self-loop recogniser (`docs/plans/2026-05-01-affine-loop-fastforward.md`). Separate workstream.
- LODSB/LODSW. May or may not produce a usable descriptor; either is acceptable as long as correctness holds (LODS rarely fires).
- Removing CSS-DOS-shaped constants from places that aren't the REP path. Separate sweep if it happens.
- Dispatch-key specialisation (`docs/plans/2026-05-12-per-dispatch-key-specialisation.md`). Separate workstream.
