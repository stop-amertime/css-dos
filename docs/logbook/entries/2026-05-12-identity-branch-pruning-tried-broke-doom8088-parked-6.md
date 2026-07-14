## 2026-05-12 - Identity-branch pruning: tried, broke doom8088, parked

**The intuition** (user-driven, conversational thinking-out-loud):
the per-tick Op stream is dominated by dispatches over `--opcode`,
and most per-opcode bodies for any given affected property are
*identity* (`var(--__1AX)` etc - "this opcode doesn't change me").
If we recognised those at compile time and stripped them, the Op
stream would shrink dramatically, every tick would be faster, and
downstream optimisation passes (fast-forward, fusion, symbolic
analysis) would all get easier because there'd be less noise.

**What we built.** `crates/calcite-core/src/pattern/identity_prune.rs`
(new module). Pre-compile pass that walks each assignment's `Expr`
tree and drops any `StyleCondition` branch whose `then` is
structurally equal to that condition's `fallback`. Cardinal-rule
clean - purely structural `Expr::eq`, no name sniffing, no upstream
knowledge. A 6502 or brainfuck cabinet with the same shape would
prune identically. 6 unit tests, all pass.

**What went wrong, and the surprise.** First reality check: kiln
already strips most outer-level identity branches at emit time.
AX's declaration only has ~70 opcode branches, not 256 - opcodes
that don't touch AX have NO entry. So the visible outer-level
"useless bullshit" is mostly already gone. The pass only found
**16 prunable branches on doom8088** (out of 3130 total).

Bigger surprise: enabling the pass **broke the cabinet**, even
though the rewrite is semantics-preserving at the Expr level.
CLI control (pass disabled): in-game at tick 34.65M, cycles
389.9M. CLI with pass enabled: 50M ticks, never reaches in-game,
IP stuck around 3487 - likely an early-boot infinite loop or
wrong-branch dispatch.

The 16 prunes are syntactically safe - branches like:

- `--IP` with `--opcode: 244` (HLT), `then = var(--__1IP)`,
  fallback also `var(--__1IP)`. Both produce the same value.
- `--AX` with `--q1: 967` (DAC port 0x3C7), `then = 0`, fallback
  also `0`. Both produce 0.
- `--memAddr0` with `--mod: 3`, `then = -1` (sentinel), fallback
  also `-1`.

In each case, removing the branch causes that key to fall through
to the fallback, which produces structurally the same value. So
the rewrite IS semantics-preserving at the abstract-CSS level.

**Hypothesis for why it breaks.** Calcite's compile pipeline isn't
a pure function of the parsed `Expr` tree. Some downstream pass -
likely `pattern::broadcast_write`, `pattern::dispatch_table`,
`pattern::packed_broadcast_write`, `pattern::replicated_body`, or
the dispatch-chain detection in `compile.rs` - uses the
**dispatch-key SET** as input, not just the value-per-key mapping.
Pruning shrinks the key set, even though the function it encodes
is unchanged, and the downstream pass produces different output
as a result. Possibilities:

- A flat-array dispatch may have been keyed on the *dense* key
  range `[min, max]`; pruning a key changes the range or makes
  it sparse, switching to a HashMap path with different evaluation
  semantics.
- A recogniser may use "all opcodes covered" as a precondition for
  emitting a specific specialised op variant.
- A packed-broadcast slot may rely on a specific key being
  present to wire up its address mapping.

This is the "downstream-pass interaction" failure mode I called
out earlier (when first surfacing the rethink to the user). The
pass is provably safe at the Expr layer; it's the
Expr-to-CompiledProgram layer that has hidden dependencies.

**Status.** The module stays in tree; the call site is gated on
`CALCITE_IDENTITY_PRUNE=1` and disabled by default. Re-enable
only after identifying which downstream pass changes behaviour
when the dispatch-key set shrinks.

**What I'd do differently.** Run a CLI-to-ingame **diff** of
tick-counts before claiming any pass works on doom8088. Smoke
passing is insufficient - smoke runs tiny cabinets with shallow
code paths; doom exercises everything. Smoke 7/7 + control-vs-
treatment CLI bit-equivalence at 34.65M ticks is the minimum bar
for any compile-pipeline change.

**Code.** New file `pattern/identity_prune.rs` (~180 lines + 6
unit tests). Module registered in `pattern.rs`. Call site in
`eval.rs::Evaluator::from_parsed` (gated on env var, default off).
