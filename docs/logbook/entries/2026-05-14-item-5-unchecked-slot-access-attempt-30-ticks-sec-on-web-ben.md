## 2026-05-14 — Item #5 (unchecked slot access) attempt: -30% ticks/sec on web bench, write-off

Implemented item #5 from the seven-item inefficiency list filed earlier
today (replace bounds-checked slot reads/writes in `execute()`'s
writeback/broadcast/packed-broadcast loops and the two `read_prop`
helpers in `rep_fast_forward`/`rep_fast_forward_cmps_scas` with the
same `get_unchecked` + `debug_assert!` pattern the inner `exec_ops` /
`exec_ops_with_op_profile` loops already use). The inner loop was
already unchecked; the wrappers around it were not.

**Result, single web bench run, doom-loading, headed Chrome, calcite
old-kbd worktree + change applied:**

| metric | this run | 2026-05-08 baseline (3-run median) |
|---|---:|---:|
| runMsToInGame    | **119.5 s** | 79.7 s |
| ticksPerSecAvg   | **290 K**   | 423 K  |
| ticksToInGame    | 34.6 M      | 34.5 M |
| compileMs        | 27.3 s      | 27.8 s |

Same number of ticks executed (so the change didn't break correctness;
the engine reaches in-game at the same point in guest time). But
ticks/sec dropped ~30%, so wall went up ~50%. **The change made
things slower.**

Most plausible explanation: the writeback / broadcast loops aren't
hot enough for `get_unchecked` to matter, and Rust's existing
bounds-check elimination was probably already removing the checks
where they'd cost anything. Removing the indices' visibility to the
optimiser (the `[idx]` form sometimes acts as a "this index is in
range" hint that lets surrounding code restructure) may have hurt
codegen. The macro expansion is larger than the original `slots[i]`,
which can shift inlining decisions in non-obvious ways.

Not chasing this further — one run on a possibly-noisy host doesn't
prove it's exactly -30%, but it's nowhere near the +small% we
expected, and the per-tick cost of writeback/broadcast loops is small
relative to the inner exec loop (which was already unchecked).

**Write-off.** Item #5 is dead. Don't retry without a clear story for
why the result would differ. The change is left in place on the
calcite `old-kbd` worktree at
`C:/Users/AdmT9N0CX01V65438A/Documents/src/calcite/.claude/worktrees/old-kbd`
for inspection if useful; revert it cleanly with
`git checkout -- crates/calcite-core/src/compile.rs` from inside that
worktree before doing real work there.

### Lessons from this session (the harness pitfalls)

The unchecked-slot change itself took ~10 minutes. Getting a number
took several hours because of bench harness state that bites every
new agent. Recording so the next agent doesn't repeat:

1. **CSS-DOS master is on the post-old-kbd-merge state.** The bench
   profiles (`tests/bench/profiles/*.mjs`) use
   `setvar_pulse=keyboard,${ENTER},${TAP_HOLD}` — the **old** keyboard
   side-channel. The SW (`web/site/sw.js`) handles `/_kbd?key=0xHHHH`
   forwarded as `{type:'kbd', key}` over the bridge port. The bridge
   (`web/shim/calcite-bridge.js`) has the old `keyQueue`/hold-batches
   drainer. **This is the correct state on master.** Do NOT
   "modernise" these to `pseudo_pulse=active,kb-X` / `?class=kb-X` /
   `{type:'press'}` — STATUS describes the post-retire path but
   master is pre-retire. STATUS lies. The reverts at commits
   `915acc3`, `48767d2`, `80f4974` and the merge `5c4b0ad` are the
   ground truth.

2. **Calcite `main` IS the working state — NO `CALCITE_REPO` needed
   anymore.** Resolved 2026-05-14/15: calcite `main` was reset to
   `ef44f20` (the ex-`old-kbd` tip — the keyboard-side-channel state
   CSS-DOS master needs). The retire-keyboard work + everything
   built on top of it (the crate-extraction refactor, the
   rep_fast_forward genericity phases, the dispatch-specialise
   phases) is parked intact on calcite branch
   **`feat/retire-keyboard`** (tip `a05d85c`). The redundant
   `old-kbd` branches + worktrees were deleted from BOTH repos. So:

   ```
   # Just works — calcite main == the old keyboard side-channel state
   node web/scripts/dev.mjs
   node tests/bench/driver/run.mjs doom-loading --headed
   ```

   If you ever see Doom stall at the title screen, FIRST check
   `cd ../calcite && git rev-parse main` is `ef44f20`. If someone
   advanced calcite main past that with retire-keyboard work, the
   bench breaks again (engine no longer speaks
   `setvar_pulse=keyboard`).

3. **The bench driver doesn't echo the page log.** The bench page
   logs detailed status to a DOM `<div id="log">` but only
   `console.error` is piped to stderr by the driver. So if the bench
   stalls, the operator sees nothing for 10 minutes. I added DOM-log
   scraping during this session — it's reverted now, but if you find
   yourself debugging a stalled bench, re-add it. It's the most
   useful 15 lines of code you can write.

4. **The `[page-error] Failed to load resource: 404` line is
   benign.** It's a console.error from inside the page (likely
   favicon or similar) and it shows on every run, baseline or not.
   Don't waste time on it.

5. **CALCITE_REPO is honoured by the dev server, the bench driver,
   the harness, and the fast-shoot path** (per CLAUDE.md). One env
   var, multiple consumers. Set it once and forget.

### Handoff to the agent picking up item #2

Item #2 from the inefficiency list: **hoist dispatch-invariant prep
ops between dispatches**.

What it means: the cabinet emits ~50 `Op::Dispatch` (or
`DispatchChain`) ops per tick, all keyed on the same hot slot
(`--opcode`). Between dispatches the op stream interleaves
`LoadState`, arithmetic, function-call inlining, etc. — the
"prep work" that computes inputs for the next dispatched property.
Some of that prep computes values that don't depend on `--opcode`.
Those are tick-invariant for the duration of the tick (or even
loop-invariant across ticks, but tick-scope is enough).

The optimisation: identify ops whose inputs are all reads of slots
that aren't written between the previous dispatch and the next, and
that aren't downstream of any `--opcode`-dispatched value. Move them
out of the per-dispatch stream entirely — hoist once to the top of
the tick body, or eliminate as common subexpressions.

This is standard compiler stuff: loop-invariant code motion + common
subexpression elimination, scoped to the per-tick op stream. The
calcite passes that already exist do some of this for the broadcast
paths but not for the main op stream.

**Where to look first:**

- `crates/calcite-core/src/compile.rs` — the `compile()` entry,
  ~line 3187. After the main compile loop produces the op stream,
  the post-Compiler passes run: `inline_calls`, `compact_slots`,
  fusion passes, `build_dispatch_chains`, `recognise_replicated_bodies`.
  A new pass `hoist_dispatch_invariant` would slot in here.
- `crates/calcite-core/src/pattern/dispatch_specialise.rs` — the
  Expr-level partial evaluator. It already classifies which
  assignments dispatch on `--opcode` vs which don't. Useful as a
  reference for "which slots are dispatch-dependent."
- `crates/calcite-core/src/pattern/op_profile.rs` — op-adjacency
  profiler. If you want to see what ops sit between dispatches on
  doom8088 before writing the pass, run with op-profile enabled
  and grep the output.

**Architectural shape (write a one-page data model before coding,
per the user's rule):**

- What is a "dispatch group"? Contiguous run of ops between two
  `Op::Dispatch`/`DispatchChain` ops keyed on the same hot slot.
- What does it mean for an op in that run to be "dispatch-invariant"?
  - Its inputs are all reads from slots that aren't written by any
    op in the prep group BEFORE it, AND
  - None of those input slots are downstream (transitively) of the
    hot key's slot.
- What's the hoist target? A "prelude block" at the top of the tick
  body, before the first dispatch. Hoisted ops execute once per tick
  instead of once per inter-dispatch gap.
- What's the slot story? Hoisted ops write to the same destination
  slot they originally wrote to. Subsequent reads in the original
  position resolve through the slot, so no rewrites needed
  downstream — slot is just "already initialised" by the time the
  inner reads happen.

**Hard part to think about before coding:** loop-carried dependencies.
If the prep op reads a slot that an *earlier* dispatch wrote to,
it's not invariant — it depends on what the earlier dispatch did,
which depends on the opcode value of the earlier dispatch. The
analysis needs to handle this. Specifically: an op is hoistable iff
every transitive input slot is either (a) a state-var read
(`Op::LoadState`), (b) a literal, or (c) the output of another
hoistable op. No transitive dependency on any dispatch's output.

**Pass gate (per the user's rule: pick one optimisation, do it
properly, measure once):**

1. Bit-equivalence: `pipeline.mjs fulldiff doom8088.css --ticks=5M`
   shows zero divergence vs unhoisted run.
2. Smoke 7/7 PASS.
3. Single web bench run on a quiet host (no other Chromes, no
   parallel Claude tools doing work). Report the number to the user
   honestly. The user decides.

**Setup for the bench run** (don't get bitten by the harness state
from the lessons above):

```sh
# 1. Stop any running dev server. If there's a background task in
#    this session, TaskStop it.
# 2. Confirm calcite main is the working state:
cd ../calcite && git rev-parse main   # MUST be ef44f20...
# 3. Apply your change directly on calcite main:
# (edit crates/calcite-core/src/compile.rs)
# Build the BENCH-CRITICAL crates, not just -p calcite-core. A
# core-only build passed while cli/wasm were broken during the
# 2026-05-14 cherry-pick attempt and hid a regression for an hour:
cargo build --release -p calcite-core -p calcite-cli -p calcite-wasm
# 4. Start dev server (no CALCITE_REPO needed — main is correct):
cd ../CSS-DOS
node web/scripts/dev.mjs &
# 5. Wait for "web dev server: http://localhost:5173/" in its output
# 6. Reset to force WASM rebuild:
curl -X POST http://localhost:5173/_reset
# 7. Run the bench:
node tests/bench/driver/run.mjs doom-loading --headed
```

If the number is a win, log it and stop. If it's not, log it and
stop. **Don't run multiple variants chasing a target. One change,
one number, user decides.**

If you find yourself wanting to "just measure something quickly" —
re-read the directive at the top of this entry (2026-05-14, the
First-principles section). The previous agent's failure mode was
exactly this. Measurement was used to defer thinking, not to validate
a design.
