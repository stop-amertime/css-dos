## 2026-05-14 — First-principles re-framing of where the calcite ceiling lives, and a directive for the next agent

User-led re-grounding session after reading the 2026-05-12 per-dispatch-key
specialisation handoff with a critical eye. The handoff described three
failed attempts (parallel pipeline, peephole merge, fresh-Compiler bodies)
and recommended a multi-day refactor of five post-Compiler passes. The
session re-examined what calcite is actually doing and where the real
headroom lives.

**The ceiling.** Calcite's job is to make CSS evaluate fast while
producing the same answers Chrome would. The cardinal rule constrains
the method (derive speedups from CSS shape, no upstream knowledge), not
the destination. In the limit, a sufficiently smart calcite compiles
CSS to native code that does what a hand-written 8086 emulator does —
~1B ticks/sec on a modern desktop CPU. Calcite today does ~400 K
ticks/sec on the web bench. **Headroom is ~2500×, not the ~250× I
quoted earlier in the session.** The cardinal rule makes the climb
harder (calcite has to rediscover structure from CSS shape under a
load-time compile budget) but does not lower the ceiling.

**Why calcite is slow vs the ceiling.** Seven specific inefficiencies
identified, ranked by how upstream-shaped they are (i.e. lower the
per-tick floor for every cabinet, every routine, every workload):

1. ~50 HashMap dispatch probes per tick on the same key (`--opcode`)
   where a real 8086 does one. *Upstream.*
2. Prep work between dispatches recomputes things that don't depend
   on the dispatch key. *Upstream.*
3. Inside each dispatch case, nested branches still get walked
   instead of folded against the outer binding. *Upstream.*
4. The op stream is interpreted, not compiled to machine code.
   Every op pays a `match`-tag dispatch cost. *Most upstream of all
   — a multiplier on every other optimisation.*
5. Slot reads/writes go through bounds-checked `Vec<i64>` indexing.
   *Small but real.*
6. Write-port machinery is more general than the 8086 needs.
   *Wide blast radius, modest savings.*
7. 12 473 slots / 280 K ops for ~50 semantic ops per tick. *Falls
   out of fixing 1/3, not a standalone lever.*

Items 1-3 are what per-dispatch-key specialisation is trying to do.
Item 4 (JIT to native) is the biggest single ceiling-lifter on the
list, and a different category of project entirely.

**Effort ranking (10 = quickest, 1 = most work):**

| # | Inefficiency                              | Effort |
|---|-------------------------------------------|-------:|
| 5 | Bounds-checked slot access → unchecked    |     10 |
| 2 | Hoist dispatch-invariant prep ops         |      7 |
| 3 | Fold inner branches inside dispatch cases |      7 |
| 1 | Collapse 50 same-key dispatches into 1    |      5 |
| 6 | Write-port simplification                 |      3 |
| 7 | Slot/op bloat (consequence of 1/3)        |      3 |
| 4 | JIT to native code                        |      1 |

**On the routine-substitution plan (`__I4D`, 46 % of doomLoad cycles).**
User correctly flagged the instinct that whole-routine substitution
feels "too downstream." It is. `__I4D` being 46 % of cycles isn't a
fact about division; it's a fact about per-guest-instruction overhead
being so high that any routine running for 210 guest ticks dominates.
Killing `__I4D` is whack-a-mole — next profile shows the second-hottest
routine at 30 % of what's left. Lowering the per-tick floor (items
1-4 above) kills `__I4D`'s 46 % as a side effect and pays out on every
cabinet, every routine. Routine substitution is tactical; the upstream
items are structural. They're not mutually exclusive but the upstream
items deserve attention first.

**On the previous agent's working pattern (recorded so future agents
don't repeat).** The previous agent built three architectural shapes
without first sitting with the data model. Each attempt failed for a
different reason; the agent reframed each failure as motivation for
the next clever shape, culminating in a multi-day refactor proposal.
The cheaper path the agent never tried: share the main `Compiler`
instance with body compilation so `dispatch_tables` and
`compiled_functions` indices match. That's hours, not days. The
handoff dressed motivated reasoning ("≥2× probability ~25 %") as
calibration. There was no model under the numbers. Measurement was
being used to defer thinking, not to validate a design.

**Directive for the agent that picks this up next.**

Pick one item from the table above and implement it. Recommended: a
mid-table item where the work is defined and the impact is real (item
2, 3, or 1 — pick what your taste tells you is the cleanest win).

Rules of engagement, set explicitly by the user:

- **No bullshit, no flailing, no "this is different to what I
  expected" mid-stream pivots.**
- **No shortcuts.** If you take a shortcut you may be ruining the
  entire optimisation and it will not be tried again. If you
  implement something poorly you may be ruining the entire
  optimisation and it will never be tried again.
- **No measurement-as-procrastination.** Don't run wedges. Don't
  diagnose. Don't profile. Sit with the data model, write the code,
  do it properly.
- **No bugging the user for decisions.** You have one chance.
  Implement the entire thing to a high standard.
- **At the end, run the web benchmark once.** No "gate." No
  pass/fail framing. Just report the number honestly to the user.
- **The user decides what to do with the number.** Don't pre-spin
  the result, don't pre-justify a follow-up. The user will steer.
- **Then write up the entry in the logbook.** Honestly. Whether
  the change helped, didn't help, or made things worse. That's the
  data the project needs.

If you find yourself wanting to deviate from any of the above mid-task,
stop and re-read this entry. The user has explicitly chosen these
rules because the previous agent's failure mode was making one-way-door
architectural decisions silently and then dressing up the recovery as
analysis.
