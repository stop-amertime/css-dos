# Whole-routine semantic substitution for hot guest sub-routines

**Status**: planning, **REFRAMED 2026-05-12**. First target: Watcom's
`__I4D` (32-bit signed divide). 46.1 % of doomLoad cycles per the
2026-05-11 cycle-weighted heatmap. Expected wall improvement on
`doomLoad`: 15-20 % (projection, not measured). See LOGBOOK 2026-05-11
— `__I4D` heatmap entry for the finding that motivated this plan.

## 2026-05-12 reframing: regions live in guest memory, not the Op stream

The original v0 of this plan assumed `__I4D` would appear as a
contiguous slice of the `CompiledProgram.ops` array (i.e. a stretch
of calcite Ops). It does not. After reading the Op enum and
`Evaluator::tick` end-to-end I confirmed: the **entire `program.ops`
array runs once per calcite tick**, and one tick equals one **guest**
x86 instruction. The Op stream is the cabinet's per-tick dispatch
logic — it reads `mem[CS:IP]`, looks up the opcode in a dispatch
table, runs the per-opcode body, advances IP. `__I4D` is not in the
Op stream; it is **211 bytes of guest x86 in `state.memory`** at
link-relative offset 0x16948.

This makes the cardinal-rule problem more delicate, not less. Scanning
guest memory bytes for x86 patterns ("does this byte sequence look
like Watcom's bit-shift divide?") is exactly what the cardinal rule
forbids: it requires calcite to know x86. The genericity probe would
fail trivially — a 6502 cabinet's signed-divide in 6502 bytes would
never match.

The cardinal-rule-clean reframing:

- A "region" is a **byte range in guest memory** with a designated
  entry address, identified by structurally walking forward through
  the per-tick dispatch *symbolically*, treating guest memory bytes
  as opaque data the CSS reads.
- The symbolic evaluator runs `program.ops` (the calcite Op stream
  — which is CSS) abstractly, starting from a symbolic state where
  `CS:IP` points at the entry, and accumulates the effect on slots
  and memory until it hits a Return-shape (a write to IP that
  reads from the stack).
- Memory bytes consumed during this symbolic walk are read
  concretely (they're the cabinet's loaded data), but the operands
  the dispatch *computes from those bytes* stay symbolic.
- The closed-form output is then matched against the catalogue.

In other words: calcite walks the CSS dispatch logic forward over a
range of guest addresses, with the actual bytes at those addresses
as input, and computes what the dispatch's accumulated effect would
be. A brainfuck cabinet, whose dispatch maps `+`/`-`/`>`/`<`/`[`/`]`
to slot/memory effects, when fed a brainfuck program in its guest
memory implementing `i32 div`, would symbolically evaluate to the
same `(a/b, a%b)` output and match the same catalogue entry. Zero
calcite changes.

This is harder than the original plan because:

1. The symbolic evaluator must abstractly run `program.ops`
   (~hundreds of Ops, including dispatch tables) per guest
   instruction, then chain ~hundreds of guest instructions per
   region, with path-splitting at every branch.
2. Loop-summary templates need to recognise loops at the **guest**
   level — induction variables in guest registers, exits via guest
   compare-and-branch — not at the Op-stream level.

Cheaper falls-out-of-itself alternative considered and rejected:
maintain a static map of CS:IP entry addresses with the catalogued
function each is known to compute. That's "calcite hardcodes
`0x1702:0x1694 → divide`," fails every cardinal-rule test, and is
exactly the slippery slope CLAUDE.md warns about.

The rest of this plan is rewritten to reflect the reframing. The
phase structure is unchanged but each phase's content is different.

## What this is

A compile-time pass in calcite that:

1. Finds candidate **guest-memory regions** by structurally walking
   the per-tick dispatch forward symbolically from candidate entry
   addresses, until it hits a Return-shape.
2. Symbolically evaluates each region to a closed-form expression
   tree per live output slot.
3. Matches that expression tree against a small catalogue of pure
   mathematical functions (initially: `signed_div_32`,
   `signed_mod_32`).
4. Substitutes the region with a runtime hook: when `CS:IP` enters
   the region's entry address at the top of a tick, the host
   computes the matched function in Rust, writes results into the
   discovered output slots, advances `CS:IP` to the region's return
   address (read from the simulated stack), advances `cycleCount`
   by the region's average cost, and continues — skipping the
   per-tick dispatch for those ticks.

The cardinal-rule defence is that the verifier proves equivalence
**from the region's computed function**, not from its bytecode shape
or any name. A 6502 cabinet's signed-divide, brainfuck's signed-divide,
or any other cabinet whose CSS happens to implement the same abstract
function would substitute identically with zero calcite-side changes.

## Cardinal-rule hazards (and how this plan avoids them)

The dangerous shortcut is "calcite knows what divide is." Three
specific failure modes to avoid:

1. **Hash table of known routines.** No `KNOWN_I4D_HASH` constant.
   No `if entry_pc == 0x1702_0008` hardcode. No bytecode-prefix
   match. The recogniser walks the Op stream every compile, with
   no calibration data baked in.
2. **Name sniffing.** The recogniser never reads characters from
   slot names or property names. Slots are opaque indices once
   compile-time resolution has happened.
3. **x86 register conventions.** The substitution never assumes
   "result goes in DX:AX." It discovers *which slots* hold
   `(a/b, a%b)` on region exit by structural search.

Operational test from CLAUDE.md: "could a calcite engineer who has
never seen a CPU emulator derive this rule by staring at CSS shape
alone?" — yes, because the rule is "any region whose computed
function equals one of N pure mathematical functions in our catalogue
can be replaced by a host call to that function." The catalogue is
the *only* x86-flavoured part of this plan, and even that is mitigated
because the matching is done over abstract i32/i64 arithmetic, not
over x86 mnemonics.

Genericity probe (mandatory at each phase): synthesise a small
non-x86 cabinet whose CSS implements `i32 div` by a different
algorithm (e.g. repeated subtraction). It MUST hit the same
substitution with zero calcite-side changes. If it doesn't, the
verifier has overfit to x86 and the plan reverts.

## Out of scope (explicitly)

- Affine self-loop fast-forward (`docs/plans/2026-05-01-affine-loop-fastforward.md`).
  Different mechanism. That plan stays parked; revisit only if this
  one fails to ship.
- Whole-program inlining / partial evaluation of non-pure routines.
  Substitution applies only to regions whose verifier-proven output
  is a pure function of input slots. Side-effecting regions (memory
  reads/writes, I/O, BIOS interrupts) are out of catalogue.
- Hash-based matching of any kind, even as a perf optimisation
  inside the verifier. (See "Cardinal-rule hazards" point 1.)
- Env-var gates. Same rule as the affine-loop plan: either it pays
  unconditionally or it doesn't ship.

## Why this and not affine self-loop fast-forward

The affine-loop plan would catch `__I4D`'s inner bit-loop as one of
many fast-forward sites. Per the 2026-05-11 entry that motivated
this plan, the expected payoff for affine fast-forward on `__I4D`
specifically is modest: 32-iteration trip count × dispatch overhead
per call leaves most of the win on the table. Whole-routine
substitution turns ~210 guest cycles (one call to `__I4D`) into one
Rust `i32::wrapping_div`, a 100×+ per-call speedup.

Affine fast-forward is the better generalist (any loop pays, even
ones we haven't catalogued). Routine substitution is the specialist
that pays out enormously on a specific known hotspot. The 2026-05-11
heatmap tells us the specific known hotspot **is** worth a specialist
pass.

## The phases

Each phase is independently landable. Each has a hard pass/fail gate
defined before measurement.

### Phase 1 — region finder + `--probe-routines` flag

Build the recogniser that identifies candidate **guest-memory
regions** by walking the per-tick dispatch forward from candidate
entry addresses. No symbolic evaluation, no substitution. Compile-time
only; runtime unchanged.

**Mechanism.** This is concretely a guest-CPU dry-run, not a static
analysis. Starting from each candidate entry address E:

1. Initialise a fresh `State` clone with `CS:IP = E`, `SP =`
   reserved scratch, registers and most of memory = symbolic
   placeholders.
2. Step the calcite Op stream concretely (running `compile::execute`
   on a clone) for up to K ticks (K=2048), reading guest bytes from
   the cabinet's loaded image at the addresses the dispatch chooses.
3. At each tick, check whether `CS:IP` has returned to a
   "Return-shape" state: the most recent IP write loaded its value
   from a memory slot the routine's prologue pushed to. (Detection:
   track stack-relative writes and reads; a return shape is `pop
   to IP` reading the byte the corresponding `call` pushed.)
4. If a return shape is detected within K ticks, record `(entry,
   exit, tick_count, ip_trace)` as a candidate region.

Candidate entry addresses come from the cabinet's loaded image
without name introspection: every byte that is the target of a
direct `call` instruction (opcode `0xE8` `0x9A`) in any other byte
range. The detection of "is this byte a call target" is itself the
trickiest part — and **it must be cardinal-rule-defensible**. Two
options:

- **Option A (preferred)**: detect call targets by *running* the
  dispatch with concrete starting states (e.g. start from the
  reset vector and follow every reachable path with bounded depth);
  every IP that the dispatch's call-handling code writes to during
  this walk is a candidate. This is generic — brainfuck's `[` would
  push a return address the same way (modulo specific dispatch
  encoding), so a brainfuck dispatch with stack semantics would
  yield candidate entries.
- **Option B (avoid)**: scan guest memory for `0xE8`/`0x9A` bytes.
  This is x86-knowledge; rejected.

**CLI flag**: `calcite-cli --probe-routines <cabinet>` dumps each
candidate region: entry guest address (CS:IP), exit guest address,
tick count, the slots touched. **No substitution yet.**

**Pass gate**: on `tests/bench/cache/doom8088.css`, the dump must
include a region whose entry address corresponds to `__I4D`. We
know `__I4D` is at link-relative offset 0x16948 in segment 0x1702,
so its linear address is `0x1702*16 + 0x16948 = 0x2D968`. (Verify
this calculation against the map file.) The exit's tick count
should be ~210 (the routine's measured cycle cost). If the probe
doesn't find that region, the recogniser is broken.

**Fail gate**: probe finds zero regions. Means call-target
detection or Return-shape detection is wrong; debug before
proceeding.

### Phase 2 — symbolic dry-run

A symbolic variant of Phase 1's dry-run. Same Op-stream concrete
execution machinery, but slot values and memory cells track symbolic
expressions instead of concrete `i32`s.

The shape of the abstract state:

- Each slot holds a symbolic `Expr` (literal, variable, or
  arithmetic tree).
- Memory cells the routine reads/writes are also symbolic, keyed by
  symbolic address expression when the address itself is symbolic.
- The guest IP is **concrete** (driven by the cabinet's actual
  bytes), but the guest data-path (registers, memory contents)
  is symbolic.
- Branches whose condition is symbolic split the path. The path
  pool is bounded by a max-fan-out K; if the pool overflows, the
  region is rejected (too data-dependent to summarise).

This formulation has a subtle but critical property: **the calcite
Op stream itself is run concretely at every step**, because the IP
is concrete and the dispatch table is keyed on concrete opcode
bytes. We're not symbolically interpreting CSS dispatch logic —
we're concretely running it, but the *data flowing through* the
dispatch is symbolic. This works because the dispatch implements a
deterministic state-transition over (opcode, state); concrete
opcode + symbolic state still yields a symbolic-state transition
the same way as concrete-state + concrete-opcode yields a
concrete-state transition.

**Loop summaries**. The 32-iter bit-shift loop in `__I4D` would
generate 2^32 path splits naively. The dry-run needs a loop-summary
template: when the symbolic IP returns to a previously-visited
guest address with a symbolic state whose only change from the
prior visit is "an integer-valued counter decremented by a fixed
amount and a small set of slots updated by some symbolic function
of themselves," replace the loop with its summary: closed-form
each slot at exit as a fold over the loop's trip count.

Start with one summary template: "single decrementing counter,
straight-line body, symbolic-but-bounded effects per iter,
deterministic exit when counter hits a literal." If that's
insufficient for `__I4D`, expand.

**Pass gate**: dry-running the `__I4D` entry symbolically yields a
closed-form symbolic state at the return point where:

- Two slots hold expressions that simplify to `sym_a / sym_b` and
  `sym_a % sym_b` for some pair of input slots `sym_a`, `sym_b`.

Verify by hand initially. Subsequent expansion uses property tests
(below).

**Fail gate**: the symbolic dry-run can't summarise the loop, OR
the simplifier can't reduce the symbolic output to a divide form.
Reassess: extend simplifier, extend summary template, or fall back
to property-test verification (described below).

### Phase 3 — function catalogue + matcher

Catalogue: a small Rust enum `SubstitutableFn` with variants
`SignedDiv32`, `SignedMod32`. Each variant has:

- A **canonical symbolic form** (what the verifier expects to see
  in the simplified expression tree).
- A **runtime implementation** (a Rust function `fn(i32, i32) -> i32`).

Matcher: given a region's simplified symbolic outputs, search for
a permutation of input slots and a pair of output slots such that
the symbolic expressions match a catalogue entry's canonical form.

Crucial constraint: the matcher discovers WHICH input slots map to
the function's parameters, and WHICH output slots receive its
return values. Calcite must not encode "DX:AX holds the result."
The matcher tries every (input-slot-permutation, output-slot-pair)
combination and picks the first that matches; on doom8088 the
search space is bounded by the region's live-in / live-out counts
(small — `__I4D` has 4 input slots and 4 output slots tops).

**Pass gate**: the matcher correctly identifies the `__I4D` region
as `(SignedDiv32, SignedMod32)` and reports the slot mapping. We
verify by checking the slot mapping against the Watcom calling
convention by hand (DX:AX = quotient, CX:BX = remainder per ABI
docs) — **but calcite doesn't know that**, calcite just reports
what slots it found.

**Fail gate**: the matcher finds the wrong slots or no match.
Either the catalogue's canonical form is too narrow (extend it) or
Phase 2's simplifier left rubble that the matcher can't see through.

### Phase 4 — substitution hook (tick-level)

Add a per-tick check: before running `program.ops`, compare the
current `CS:IP` against the table of substituted regions. If it
matches an entry's `entry_address`:

1. Read the input slots/memory cells the matcher discovered.
2. Call the catalogue's Rust impl.
3. Write outputs to the discovered output slots/memory cells.
4. Advance `cycleCount` by the region's `cycles_per_call`.
5. Pop the return address from the simulated stack (using the
   same memory reads the original code would have done) and set
   `CS:IP` to it.
6. Skip `program.ops` for this tick.

This is implemented as a new optional field on `Evaluator`:
`Vec<SubstitutedRegion>` plus a sorted-by-entry-address lookup.
The per-tick check is a single hashmap probe keyed on `CS:IP`,
zero overhead when no region matches (the common case).

The original guest-memory bytes are NOT modified. Calcite is just
short-circuiting the dispatch when CS:IP enters one of the
verified regions.

**Pass gate**: `tests/harness/run.mjs smoke` passes 7/7.
`pipeline.mjs fulldiff doom8088.css --ticks=5M` shows zero state
divergence vs the unsubstituted run.

**Fail gate**: any state divergence. The substitution is broken;
debug or revert.

### Phase 5 — correctness sweep

`pipeline.mjs fulldiff doom8088.css --ticks=30M` (full level-load).
Plus `prince`, `zork1`, `montezuma` smoke. Plus the conformance
suite.

**Pass gate**: zero divergence, all suites green.

**Fail gate**: any divergence on any cabinet. Investigate; the most
likely cause is a sign-extension or overflow edge case in the
catalogue's Rust impl not matching Watcom's exact semantics. If
unfixable, revert and consider the property-test fallback.

### Phase 6 — perf gate

`node tests/bench/driver/run.mjs doom-all --headed`, 3-run median.
Quiet host (no other agent benching, no stray Playwright).

**Pass gate**: doomLoad wall ≥ 5 % faster than the 2026-05-08
baseline (68.5 s median, so target ≤ 65.1 s). Total `runMsToInGame`
must also improve (no acceptable trade where doomLoad wins at the
expense of another phase).

**Fail gate**: < 5 % improvement, OR doomLoad faster but
`runMsToInGame` regressed. The pass doesn't ship. Likely cause:
substitution overhead (cycle bookkeeping, slot-load cost) eats the
win. Re-examine the eval arm for unnecessary work.

Expected outcome: 10-20 % doomLoad improvement (projection from the
46 % of cycles in `__I4D` times an estimated 30-50× per-call
speedup, with half the theoretical maximum lost to overhead).

## The hard parts I'm not pretending are easy

1. **Symbolic evaluator path-explosion on the bit-shift loop.** 32
   iterations of a 2-way branch is 4 billion paths if you split
   naively. Mitigation: loop-summary templates from Phase 2. The
   "shift-subtract divide" template is essentially a small theorem
   the evaluator has to recognise and apply.
2. **Recognising the closed form.** Even with a loop summary,
   proving the summary equals `a / b` requires arithmetic
   simplification. Strategy: start with a curated set of rewrite
   rules (e.g. `(x << k) >> k = x`, `(x + 0) = x`, `(x * 1) = x`,
   distribution rules for the divide-specific identities). If
   the rules don't suffice, fall back to the property-test
   verifier (below).
3. **Return-shape detection.** What does Watcom-emitted `retn`
   look like in calcite Ops? Probably a Jump whose target is loaded
   from a memory slot. The Phase 1 probe is partially a discovery
   tool: dump the suspected `__I4D` region first, look at how it
   ends, define Return-shape from what we see, then go back and
   make the recogniser general. **Define "Return-shape" by what's
   structurally common, not by what `__I4D` happens to do.**
4. **Slot liveness analysis at region boundaries.** Standard
   compiler stuff but calcite doesn't have it as a reusable pass
   yet. Build it.

## Fallback: property-test verification

If Phase 2's symbolic evaluator can't reduce the loop summary to a
recognisable closed form, the fallback is **runtime property testing
at compile time**: pick 10K random input pairs, execute both the
original region's Ops and the catalogue's Rust impl on each, require
bit-for-bit equality. Only substitute if all 10K agree.

This is a weaker cardinal-rule defence — it's empirical equivalence
rather than proven equivalence — but it's still entirely shape-based:
no name sniffing, no bytecode hashing, no x86-specific hardcoding.
And 10K random pairs covers the i32 input space densely enough that
the divide's edge cases (sign combinations, by-zero, INT_MIN) all
land.

Land the fallback only if Phase 2's full version is genuinely
blocked. Document the trade-off in the log entry where it ships.

## Files this will touch

Calcite:
- `crates/calcite-core/src/pattern/routine_finder.rs` — new, Phase 1.
- `crates/calcite-core/src/pattern/symbolic.rs` — new, Phase 2.
- `crates/calcite-core/src/pattern/substitutable.rs` — new, Phase 3
  catalogue.
- `crates/calcite-core/src/compile.rs` — adds `Op::SubstitutedRoutine`
  + eval arm + emission wiring (Phase 4).
- `crates/calcite-cli/src/main.rs` — adds `--probe-routines` flag
  (Phase 1).
- `crates/calcite-cli/src/bin/probe_routine_shape.rs` — optional
  diagnostic, Phase 1.

CSS-DOS:
- `docs/logbook/LOGBOOK.md` — entries at each phase landing.
- `docs/logbook/STATUS.md` — updates to "Open work" and baseline
  after Phase 6 perf gate.

## Genericity audit checklist (run at each phase)

Before each phase lands:

- [ ] Does anything in this phase's code read characters from a
      slot name, property name, or function name? If yes, revert.
- [ ] Does any decision branch on a specific PC, address, or
      hardcoded byte sequence? If yes, revert.
- [ ] Would a synthetic cabinet implementing the same abstract
      function with different bytecode hit the same code path
      with zero calcite changes? If no, revert.
- [ ] Does the catalogue contain only pure mathematical functions
      (no I/O, no memory effects, no register conventions)? If
      any catalogue entry has a side effect, revert it.

## Order of operations (concrete next steps)

1. ✅ Read the calcite Op enum end-to-end (`crates/calcite-core/src/compile.rs`
   line 124). **Key discovery**: the Op stream is per-tick dispatch
   logic, not Watcom bytecode. Triggered the 2026-05-12 reframing.
2. Implement a **concrete dry-run** harness: given a State clone and
   an entry CS:IP, run `compile::execute` N times in a loop,
   tracking IP trace and stack pushes/pops. This is the substrate
   for Phase 1's region finder.
3. Compute `__I4D`'s expected linear entry address from the
   Doom8088 map (LOAD_SEG 0x1702 + offset 0x16948 = linear
   0x2D968) and confirm a region terminates there with stack
   convention matching a call.
4. Find candidate entry addresses **generically**: track every
   address written to IP during boot+loading from a known good
   trace, classify those reached via a stack-push-then-IP-load
   pattern as candidate "callable" entries. Cardinal-rule check:
   no `0xE8`/`0x9A` byte scanning.
5. Build the symbolic dry-run (Phase 2) over a small Expr type;
   make symbolic-state extension of the concrete dry-run.
6. Loop summary for the 32-iter bit-loop.
7. Catalogue + matcher (Phase 3).
8. Substitute hook + verify (Phases 4-5).
9. Bench (Phase 6).

### Implementation reality check (gating step 2)

Before any code lands: the symbolic-dry-run approach hinges on
calcite being able to *cheaply* clone a `State` and step it many
times symbolically. That requires:

- A `State` clone fast enough to do thousands of compile-time
  symbolic runs (one per candidate entry).
- A `compile::execute` arm that can run with abstract values in
  some slots. Currently it stores `i32`s; abstract values would
  need a parallel symbolic-state structure.

If either is too expensive, the whole approach is non-starter
and we revisit. Spike step 2 first with no symbolic component —
just confirm the *concrete* dry-run (real i32 values, real
memory) works and can identify `__I4D`'s region boundaries from
a real boot trace. If concrete works, symbolic is a generalisation.
If concrete doesn't work, the entire approach is wrong and we
need a different shape.

## What I will not do

- Skip a phase's pass gate to save time.
- Land an env-var-gated version.
- Ship without the genericity probe at each phase.
- Promise a specific perf number before Phase 6 measures it.
- Conflate this with the affine-loop plan. They're separate
  mechanisms; this one ships or doesn't on its own merits.

## Cross-references

- LOGBOOK 2026-05-11 (cycle-weighted heatmap, `__I4D` finding) —
  the measurement that motivated this plan.
- `docs/plans/2026-05-01-affine-loop-fastforward.md` — the
  generalist alternative that this plan supersedes for `__I4D`
  specifically.
- `docs/plans/2026-05-06-rep-fast-forward-genericity.md` — precedent
  for "compile-time recogniser + runtime applier behind a flag,
  then default-on" workflow. This plan uses the same shape but
  skips the env-var flag (per "Out of scope").
- CLAUDE.md cardinal rule section — the source of the genericity
  probes used here.
