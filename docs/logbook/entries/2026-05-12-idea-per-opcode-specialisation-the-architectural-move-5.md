## 2026-05-12 — Idea: per-opcode specialisation (the architectural move)

Idea-stage, not implemented. Surfaced after the identity-pruning
attempt (below) made clear we were nibbling at the wrong altitude.
Recording it here so a future agent can pick it up.

**The framing.** Calcite currently runs at ~400K guest instructions
per second on the canonical web bench. A real 8088 ran Doom8088 at
~330K i/s. A modern CPU should be doing tens of millions of guest
instructions per second through a sensible emulator. The gap is
roughly 100-1000×.

The gap is NOT in:
- Op-body cost (each Op is cheap).
- Dispatch table lookup (already O(1) flat-array indexed).
- Identity branches (kiln already strips most at emit time; only 16
  prunable on doom8088).

The gap IS in: **every property's per-tick dispatch on `--opcode`
fires every tick, for every property, regardless of whether that
opcode affects that property.** The cabinet has hundreds of
properties (registers, segments, flags, prefix latches, operand-
decode slots, snapshot variables, memory ports, etc). Per tick:
each property's dispatch on `--opcode` runs to discover its
update for the current opcode — usually identity or a small
write. The full per-tick Op stream is hundreds of dispatches.
That fixed tax is the dominant cost.

**The move.** Compile-time specialisation of the entire tick body
per opcode value. For each opcode V in 0..255:

1. Walk every property's RHS Expr tree.
2. For each `StyleCondition` keyed on `--opcode`, fold to the
   matching `style(--opcode: V): expr` branch (or the fallback
   if none). All dispatches on `--opcode` collapse at compile
   time.
3. Aggressively simplify: constant-fold, eliminate identity
   assignments (now visible — `var(--__1AX)` becomes literal
   self-assignment which is dead code), constant-propagate
   through dependent slots (`--prefixLen=0` for INC AX, etc).
4. Compile the simplified per-property Exprs into Ops.
5. Concatenate into one specialised tick body for opcode V.

Runtime structure: read `--opcode`, jump to the specialised
body for V, run ~20-200 Ops (vs current ~hundreds-of-dispatches),
done. The outer dispatch on opcode is the ONLY per-tick
dispatch; everything below is straight-line specialised code.

**Projected payoff.** 5-50K total Ops across 256 specialised
bodies, with one ~50-Op slice running per tick, vs current
~hundreds-of-Ops running per tick. Plausibly 10-100× throughput
improvement. Doom8088 at the current 400K i/s would become
4-40M i/s, which is comfortably above the playable threshold
and probably approaching native-modern-emulator territory.

**Cardinal-rule check.** The move is "compile-time partial
evaluation of a known-constant operand of every dispatch." That's
a generic CSS optimisation — fold `if(style(--K: V_known): X;
else: Y)` to `X` when `K` is known. A brainfuck cabinet with 8
dispatch keys would specialise into 8 bodies. A 6502 cabinet
into 256 bodies. A non-emulator cabinet that has a dispatch on
a known-at-compile-time key would specialise identically. The
catch: calcite doesn't know `--opcode` is "the opcode" — it just
knows it's a key that every property's StyleConditions dispatch
on. So the pass needs to **discover** which dispatch key (across
all properties) is worth specialising on. Probably: pick the key
that the most StyleConditions dispatch on across all assignments.
That's a structural property of the cabinet's CSS, not a CPU
fact.

**Hard parts called out up-front.**

1. **Compilation cost.** Naive: run the existing compile pipeline
   256 times = ~2h. Won't ship. Pass needs to share work — parse
   once, walk Expr trees once per property, specialise by Expr
   pruning rather than full re-compile per opcode. Target: 60-120s
   added compile time, acceptable for the boot-once-ship-many
   model.

2. **Operand bytes stay symbolic.** `--opcode` is one byte read
   from `mem[CS:IP]`; calcite knows that's the dispatch key at
   compile time once we identify it. But `--q1`, `--q2`,
   `--immByte`, `--immWord`, `--rmVal16`, etc are read from
   subsequent guest bytes and stay symbolic. The pass specialises
   `--opcode` to a constant; everything that depends on `--opcode`
   transitively gets simplified; everything that depends on
   `--q1` etc stays a slot read. That's correct and matches what
   a CPU dispatch table does.

3. **Prefix opcodes.** ~7 opcodes (0x26/2E/36/3E for segment,
   0xF0/F2/F3 for lock/rep) set state for the next tick rather
   than do work themselves. Their specialised bodies update prefix
   latches + advance IP. The cabinet's StyleConditions already
   handle this; specialisation preserves it.

4. **Topological sort per opcode.** Currently the compile pipeline
   topo-sorts assignments by dependencies once. Specialised bodies
   may have different dependency graphs (specialised `--AX` for
   opcode 0x40 only depends on `--__1AX`, not on operand-decode
   slots). The pass either re-runs the topo sort per opcode (cheap
   on the smaller specialised set) or proves the original order
   is still valid post-specialisation (probably yes — specialisation
   only removes dependencies, doesn't add them).

5. **Code-size budget.** 256 × ~50-200 Ops per body = 5-50K total
   Ops in the per-opcode table. The current single Op stream is
   386K Ops on doom8088. So memory goes DOWN, not up. The savings
   come from removing the per-property dispatch repetition.

**The relationship to other optimisations.**

After per-opcode specialisation lands, every other optimisation
gets bigger leverage:

- **Affine-loop fast-forward** (`docs/plans/2026-05-01-affine-
  loop-fastforward.md`) — recognising a self-looping opcode is
  trivial once the per-opcode body is short and explicit. Today
  the recogniser has to see through hundreds of Ops; post-
  specialisation, each body is ~50 Ops, the loop shape is on the
  surface.
- **Routine semantic substitution** (`docs/plans/2026-05-12-routine-
  semantic-substitution.md`) — symbolic evaluation across a
  guest sub-routine becomes tractable. Symbolic-step through
  specialised per-opcode bodies, each ~50 Ops, instead of
  ~hundreds with embedded dispatches.
- **Identity pruning** (below entry) — works as intended once
  per-opcode bodies are specialised, because the simplification
  step exposes identities that were hidden behind dispatches.

So per-opcode specialisation is structurally upstream of every
other perf optimisation. It should be the next big architectural
move.

**Pick up at.** Probe stage: for one chosen opcode (e.g. INC AX
= 0x40), specialise the full cabinet's Expr trees by hand
(write the pass for just that opcode, run on doom8088, dump the
simplified per-property Expr trees, count Ops vs the unspecialised
version). If the simplified-body Op count is a small fraction of
the unspecialised stream and the result is structurally clean,
scale to all 256.

**Status.** Idea-stage. No code. No plan file yet — write one
before implementing if you pick this up.
