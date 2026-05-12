# CSS-DOS Logbook

Chronological work entries. Newest first. The durable handbook
(current state, sentinels, gotchas, how to test) is in
[`STATUS.md`](STATUS.md).

Last updated: 2026-05-12

## 2026-05-12 — `probe-specialise`: per-dispatch-key specialisation validated; plan filed

Productised the "per-opcode specialisation" idea from earlier today
into a measurement and a plan.

**The probe** (`crates/calcite-cli/src/bin/probe_specialise.rs` in
calcite, ~530 lines + helpers). Two phases:

1. Pick the hot dispatch key generically: count, per property name,
   how many `StyleCondition` `Single`-tests reference it across all
   assignments. Return the property with the highest count.
2. For one (key, value) binding, walk every assignment's Expr tree
   and partial-evaluate `StyleConditions`: drop branches whose test
   `NeverTakes`, fold branches whose test `AlwaysTakes`, keep
   `Unknown` branches and recurse. Count nodes before/after.

Zero hardcoded knowledge of x86, opcodes, or any cabinet specifics.
Genericity probe baked in: a brainfuck cabinet's hot dispatch key
would be discovered identically.

**On doom8088 (332 MB cabinet, 362 242 assignments):**

- Auto-picked hot key: **`--opcode`** (1615 SC tests). Next four are
  `--reg` (975), `--mod` (842), `--rm` (736), `--_tf` (39). The 4×
  gap between the top 4 and the rest confirms it's a real spike, not
  noise — and the top 4 are exactly what you'd expect a generic
  CPU-style dispatch to use, but the probe didn't know that.
- Specialising for opcode = 0x40 (INC AX): **StyleConditions 668 → 65
  (9.7 % kept), branches 3130 → 143 (4.6 % kept), Calc nodes 3690 →
  142 (3.8 %), FunctionCalls 2109 → 88 (4.2 %).**
- Hot register-update bodies: `--AX` 2435 → 10 (0.4 %), `--flags`
  1946 → 17 (0.9 %), `--CX/--DX/--BX` 1900s → 6 (0.3 %), `--IP`
  1556 → 13 (0.8 %).
- Repeated for 0x90 (NOP) and 0x89 (MOV r/m,r) — consistent
  collapse, slightly different bodies. Not a one-opcode artefact.

**The caveat the probe also exposed.** Of doom8088's 362 242
assignments, **362 064 (99.95 %) are absorbed by the parser fast-path
as broadcast / packed-broadcast memory writes** before reaching the
IR layer. The probe's aggregate node counts (744K → 725K, -2.6 %)
are misleading because most of those nodes are trivial 2-node
`Literal`/`Var` leaves from non-dispatching cells. The real win is on
the ~178 dispatching assignments, where the collapse is 10-200×.
That's still where today's per-tick "hundreds of dispatches" cost
lives, so it's still the right lever — but the framing needs to be
"shrink the dispatch budget on the hot 178," not "shrink the whole
IR 100×."

**Plan filed.** `docs/plans/2026-05-12-per-dispatch-key-
specialisation.md`. Six phases, each with a hard pass/fail gate.

1. `discover_hot_key` + `discover_key_value_set` as compile-pipeline
   diagnostics. Smallest unit; pays back in genericity-verification
   on the smoke set before heavier passes land.
2. Productise the probe's specialise() into
   `crate::pattern::dispatch_specialise`, 6+ unit tests.
3. Specialised CompiledProgram table + runtime dispatch. **Hard gate:
   CLI bit-equivalence on doom8088 at the same ticksToInGame +
   cyclesToInGame**, smoke 7/7, compile time ≤ 1.5× baseline.
4. Web bench perf measurement, 3-run medians. Conservative floor: ≥ 2×
   ticks/sec on `doom-loading`. Genericity probe: a synthetic 3-value
   brainfuck cabinet must specialise into three bodies with the same
   structural collapse.
5. Value-set dedup (specialised bodies that hash-equal share codegen).
6. Un-gate, ship default-on.

The bit-equivalence gate at phase 3 is the explicit lesson from this
morning's identity-prune failure: smoke 7/7 wasn't enough; doom-load
to in-game tick count is the minimum bar.

**Cardinal-rule defence.** The pass discovers the key structurally
(no hardcoded name), discovers the value set structurally (no fixed
range), and never reads characters out of slot names. Mandatory
brainfuck genericity probe at phase 4. Plan rejects any env-var
shipping gate — pays unconditionally or doesn't ship.

**Status.** Plan filed; STATUS open-work entry updated to point at
the plan. Probe binary committed at calcite `1dd5151` (with the
identity-prune module and the orphan `calcite-debug-summary` /
`calcite-pc-video` crates that were referenced from Cargo.toml but
unstaged). No code in the compile pipeline yet — phase 1 is the
pick-up.

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

## 2026-05-12 — Identity-branch pruning: tried, broke doom8088, parked

**The intuition** (user-driven, conversational thinking-out-loud):
the per-tick Op stream is dominated by dispatches over `--opcode`,
and most per-opcode bodies for any given affected property are
*identity* (`var(--__1AX)` etc — "this opcode doesn't change me").
If we recognised those at compile time and stripped them, the Op
stream would shrink dramatically, every tick would be faster, and
downstream optimisation passes (fast-forward, fusion, symbolic
analysis) would all get easier because there'd be less noise.

**What we built.** `crates/calcite-core/src/pattern/identity_prune.rs`
(new module). Pre-compile pass that walks each assignment's `Expr`
tree and drops any `StyleCondition` branch whose `then` is
structurally equal to that condition's `fallback`. Cardinal-rule
clean — purely structural `Expr::eq`, no name sniffing, no upstream
knowledge. A 6502 or brainfuck cabinet with the same shape would
prune identically. 6 unit tests, all pass.

**What went wrong, and the surprise.** First reality check: kiln
already strips most outer-level identity branches at emit time.
AX's declaration only has ~70 opcode branches, not 256 — opcodes
that don't touch AX have NO entry. So the visible outer-level
"useless bullshit" is mostly already gone. The pass only found
**16 prunable branches on doom8088** (out of 3130 total).

Bigger surprise: enabling the pass **broke the cabinet**, even
though the rewrite is semantics-preserving at the Expr level.
CLI control (pass disabled): in-game at tick 34.65M, cycles
389.9M. CLI with pass enabled: 50M ticks, never reaches in-game,
IP stuck around 3487 — likely an early-boot infinite loop or
wrong-branch dispatch.

The 16 prunes are syntactically safe — branches like:

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
a pure function of the parsed `Expr` tree. Some downstream pass —
likely `pattern::broadcast_write`, `pattern::dispatch_table`,
`pattern::packed_broadcast_write`, `pattern::replicated_body`, or
the dispatch-chain detection in `compile.rs` — uses the
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
passing is insufficient — smoke runs tiny cabinets with shallow
code paths; doom exercises everything. Smoke 7/7 + control-vs-
treatment CLI bit-equivalence at 34.65M ticks is the minimum bar
for any compile-pipeline change.

**Code.** New file `pattern/identity_prune.rs` (~180 lines + 6
unit tests). Module registered in `pattern.rs`. Call site in
`eval.rs::Evaluator::from_parsed` (gated on env var, default off).

## 2026-05-12 — Plan filed: `__I4D` whole-routine semantic substitution

Planning-only entry. Wrote
[`docs/plans/2026-05-12-routine-semantic-substitution.md`](../plans/2026-05-12-routine-semantic-substitution.md)
in response to the 2026-05-11 cycle-weighted heatmap pinpointing
Watcom's `__I4D` (32-bit signed divide) as 46.1 % of doomLoad cycles.

Mechanism: at compile time, find single-entry-single-exit regions of
the calcite Op stream that look structurally like sub-routines;
symbolically evaluate each region to a closed-form expression per
live-out slot; match against a small catalogue of pure mathematical
functions (initial entries: `signed_div_32`, `signed_mod_32`);
substitute matched regions with a single host op that calls the
catalogue's Rust implementation.

Cardinal-rule defence: the verifier proves equivalence from the
region's **computed function**, not from its bytecode shape or any
name. No hash table of known routines, no name sniffing, no x86
register conventions baked in. A 6502 cabinet's signed-divide or
brainfuck's signed-divide would substitute identically with zero
calcite-side changes. Genericity probe is mandatory at each phase.

Six phases, each independently landable with a defined pass/fail
gate:

1. Region finder + `--probe-routines` CLI flag.
2. Symbolic evaluator (pure-arithmetic Ops + loop-summary templates).
3. Function catalogue + matcher.
4. Substitution emitter + `Op::SubstitutedRoutine`.
5. Correctness sweep (fulldiff doom8088 + smoke + conformance).
6. Perf gate (≥ 5 % doomLoad improvement, 3-run web `--headed`
   median).

No env-var gate. Either it pays unconditionally or it doesn't ship —
same rule as the affine-loop plan.

Hard parts called out explicitly: symbolic-evaluator path-explosion
on the 32-iteration bit-shift loop (needs loop-summary templates),
recognising the closed form `(a/b, a%b)` from the summary,
Return-shape detection at the Op-stream level. Fallback if Phase 2's
full symbolic proof proves too hard: property-test verification
(10K random input pairs at compile time). Weaker defence but still
shape-based.

Out of scope (explicit): affine self-loop fast-forward stays parked,
no whole-program inlining, no hash-based matching even as perf
optimisation.

Picks up at "Order of operations" step 1 in the plan: read the
calcite Op enum end-to-end before any code changes.

## 2026-05-11 — release-oriented landing page (`/index.html`)

**What.** New `web/site/index.html` — a 4-step DOS-EDIT-styled wizard
(Welcome → How it works → Build → Play) that wraps the existing
`build.js` pipeline. Started from a Claude Design mockup
(`https://api.anthropic.com/v1/design/h/sRty-DSKgcWv-J_BVFVWMQ`,
extracted from the gzipped tarball it returns). Build wiring, SW
registration, and calcite-bridge boot are identical to `build.html` —
no changes to `build.js`, `sw.js`, or `calcite-bridge-boot.js`.

**Architecture.** `wizard.js` is pure visual chrome on top of `build.js`:
- Real form elements `build.js` reads (`#cart-list`, `#start`, `#stages`,
  `#log`, `#download`, `#run-cmd`, memory/preset/video radios, `#progress`,
  `#result`) live in a hidden `.wizard-hidden` block so build.js keeps
  ownership of the build pipeline.
- A visible `#cart-grid` of cover-art cards mirrors selections into the
  hidden `#cart-list` radio group (programmatic `.checked = true` +
  `dispatchEvent('change')`), and the spec table mirrors radio/checkbox
  state. A short polling loop (0/100/500/1500 ms) covers build.js's
  async program.json apply, since direct `.value` writes don't fire
  `input` events.
- Build progress drives off two MutationObservers: one on `#stages`
  (each new `<li>` = one stage; bar eases toward 95 %), one on
  `#result.hidden` (un-hide = build done; snap to 100 %, reveal the
  cabinet block, unlock step 4).
- `#save-css` proxies to the hidden `#download` anchor.

**Carts.** Visible carts come from `web/site/assets/carts.js`
(cosmetic manifest with cover art / palette). `wizard.js` intersects
that with `/_carts.json` from the dev server — carts in `carts/` but
NOT in `window.CARTS` (variants: `doom8088-cga4`, dev fixtures:
`test-carts`, `vsync-poll`, `rogue36`) are intentionally hidden from
the release landing page. They remain available via `/build.html`,
which still lists every directory under `carts/`.

**Assets copied** to `web/site/assets/`: `IBM-PC.jpg`,
`css-dos-logo-narrow.png`, `css-dos-logo-32x32.png`, and
`boxart/{doom,persia,zork,sokoban}.{jpg,jpeg,webp}` from the design
bundle.

**Visual jank tightened from the mockup:**
- `.step-strip li.done` went from off-palette `#888` to `#666` with
  yellow numbers for legibility against the gray.
- `.cart-card.selected:hover` pinned to black so hover doesn't recolor
  the inverted-selected look.
- Dropped the mockup's fake CSS-source preview generator; the real
  paginated source viewer (from `build.js`) is now tucked inside a
  collapsible `<details>` on the result block.
- Dropped `F1=Help` from the status line (no help dialog exists); wired
  `Esc=Back` so the advertised shortcut does something honest.
- Hardened the keydown listener against synthetic dispatches with no
  `.matches` (was throwing when `e.target === document`).
- Three play options (calcite / canvas / raw) collapsed to two
  prominent cards (raw + calcite) with the canvas player and the
  classic builder UI as plain text links below.

**Verification.** Web preview at `localhost:5173/` (web preview config):
- Steps 1-4 navigate via Next/Back, step-strip clicks, and arrow keys.
- `/_carts.json` round-trip populates 8 cover-art cards.
- Clicking Zork → cart bytes fetched (7 files), `#run-cmd` prefilled
  to `_ZORK1`, spec table reflects `640K conventional` /
  `DOS + Corduroy BIOS` / `Text + Mode 13h`, build button enabled.
- Build button → 6 stages logged (preset → BIOS → DOS → FAT12 → CSS →
  ready), progress bar to 100 %, `Cabinet: 277.3 MB` displayed,
  floppy label `ZORK1`, download blob URL valid, step 4 unlocked.
- Step 4 cards link to `/player/raw.html` and `/player/calcite.html`
  (new tab); footnote links to `/player/calcite-canvas.html` and
  `/build.html`.
- No console errors, no failed network requests.

**Out of scope.** Help dialog (`F1`), drop-down menus on the menu bar
(flavour only, same as `build.html`), tearing down the cabinet on
Restart. The classic `/build.html` is unchanged and remains the
power-user surface.

**Files.** new: `web/site/index.html`, `web/site/assets/wizard.css`,
`web/site/assets/wizard.js`, `web/site/assets/carts.js`,
`web/site/assets/IBM-PC.jpg`, `web/site/assets/css-dos-logo-narrow.png`,
`web/site/assets/css-dos-logo-32x32.png`,
`web/site/assets/boxart/*.{jpg,jpeg,webp}`.

## 2026-05-11 — doomLoad cycle-weighted heatmap: `__I4D` (32-bit divide) is the lion

**Measurement.** Added a `cycles` column to calcite-cli's
`--sample-cs-ip` output (reads the cabinet's `cycleCount` state-var
at sample time). Cold-boot `tests/bench/cache/doom8088.css` with
`--sample-cs-ip=600,1000,100`, halt-on-ingame watches, filtered to
the loading window (tick 4.6M–34M) → `tmp/sampler/load-window.csv`.

Cross-check: count-weighted segment heatmap (what the old "67.8 %
segment 0x55" number used) vs cycle-weighted (sum of cycleCount
deltas per `(CS)` bucket from wide singles). Total cycles in
window 938 M reconciles with `cycleCount` end-minus-start. Top by
cycles:

| Segment | cycles% | count% | Resolved to |
|---|---:|---:|---|
| **0x2D96** | **46.1 %** | 22.3 % | **Watcom `__I4D` — 32-bit signed integer divide** (libc helper, 0xD3 = 211 bytes). |
| **0x26EF** | **24.2 %** | 5.3 %  | **`r_draw_TEXT` at offset 0xBB6** — column/span renderer inner loops. |
| 0x55       | 17.6 %    | 48.6 % | EDR-DOS kernel (below DOOM LOAD_SEG). "67.8 %" claim was a count-weighted sampling artefact. |
| 0x2BC2     | 5.3 %     | 9.2 %  | `st_stuff_TEXT` — status bar drawing. |
| 0x1122     | 2.1 %     | 7.3 %  | Below DOOM LOAD_SEG — EDR-DOS / DOS area. |

**How segments were resolved.** DOOM8088 source is at
`../Doom8088/`; Watcom map at `../Doom8088/WC16/DOOM16WC.map`
(map 2026-04-25 19:36, cart EXE 2026-04-26 00:36 — same build
day). LOAD_SEG derived from a known landmark: CS=0x2D96 has hot
IPs 0x27–0x53; map shows `i4d` at link-relative offset 0x16948
(paragraph 0x1694, offset 0x08 within the `0fd5:` code group).
So **LOAD_SEG = 0x2D96 − 0x1694 = 0x1702**. Verified: every
other hot CS maps cleanly into a named map segment with this
constant.

Formula for any CS:IP from this run:
```
link_relative_linear = (CS − 0x1702) × 16 + IP
```
Then find the `_TEXT` segment in the map whose
`[base, base+size)` contains that linear. Symbols inside each
segment are listed lower in the map.

**Shape of the lion (`__I4D`).** IPs 0x27–0x53 hit roughly
equally (top 20 IPs all 2.0–2.7 % each). That's the bit-shift
loop body inside the divide routine — 8086's `DIV` is only
16-bit, so 32-bit signed division is a software bit-loop of
~32–33 iterations over a ~6–10-byte body. The flat histogram
across ~45 bytes of IP space is exactly that body cycling.
Standard SAR/SHR/SBB long-divide algorithm (Watcom's
`clibm.lib(i4d)` per the map header).

**Why DOOM divides so much during level-load.** Fixed-point
math: BSP traversal, line-segment intersections, BBox clipping,
`divline_t` computations in `p_setup.c` / `p_maputl.c` /
`p_sight.c`. Any `fixed_t / fixed_t` (or wider-than-16-bit
divisor) compiles to a `__I4D` call. **Not** the zone walk the
perf doc speculated.

**Three corrections to the perf docs:**

1. Segment 0x55 is **not** 67.8 % of doomLoad — that was the
   *count* of samples, not weighted by cycles. By cycles it's
   17.6 %, and it's **EDR-DOS kernel**, not "DOOM zone-walk".
2. Segment 0x2D96 is **not** "Corduroy BIOS dispatch" — Corduroy
   is at runtime F000. It's `__I4D`.
3. The biggest single doomLoad optimisation target is **the libc
   divide routine**, not DOOM application code, not BIOS, not
   zone allocation.

**Why `__I4D` is a strong target.**
- Tiny (211 bytes), fixed routine, called from many sites.
- Inner-loop body matches the affine-loop fast-forward plan's
  shape: deterministic per-iter side effects, counter-bounded
  exit.
- Cardinal-rule-clean: a calcite recogniser for "tight
  bit-shift self-loop with counter exit" would fire on any
  other libc's 32-bit divide on any cabinet — no DOOM- or
  Watcom-specific knowledge needed.
- Alternative: whole-function semantic substitution.
  Pattern-recognise the 211-byte routine's CSS body as a unit,
  substitute one host i32 `idiv`. Much higher payoff per byte
  of matched code, narrower applicability. The recogniser would
  still read only CSS-shape facts (no x86 / DOOM knowledge).

**`r_draw` (24 %).** Previous `column_drawer_fast_forward`
attempt (deleted 2026-05-05) targeted this exact code. Failed
because per-tick detection cost exceeded savings. The
affine-loop plan's compile-time-keyed detection design fixes
that failure mode. Hot IPs cluster across pages 0x1400 (39.9 %),
0x1500 (46.5 %), 0x1600 (9.7 %) — a function with multiple
inner loops spanning ~768 bytes. Land `i4d` first to build
confidence in the compile-time-keyed detection pattern, then
revisit `r_draw`.

### Pipeline & artifacts (for the next agent)

- **calcite-cli `--sample-cs-ip`** now emits a `cycles` column
  (absolute `cycleCount` state-var at sample time;
  per-sample cost = `cycles[i] − cycles[i−1]`). Edit lives in
  `../calcite/crates/calcite-cli/src/main.rs` (search
  `cycleCount`). Build with `cargo build --release --bin
  calcite-cli` in `../calcite`. CSV header is now
  `tick,cs,ip,sp,cycles,burst_id` (was 5 columns).
- **Standing analyser
  `tests/harness/analyse-cs-ip-samples.mjs` does NOT yet
  consume the new column** — it still reads the 5-column
  schema. Update it before re-running automated analysis.
  Current cycle-weighted analysis was ad-hoc awk.
- **Raw data retained.** `tmp/sampler/cold.csv` = full
  cold-boot through past-ingame (tick 0 to ~96M).
  `tmp/sampler/load-window.csv` = filtered to tick 4.6M–34M.
  Built from `tests/bench/cache/doom8088.css` with the
  ingame-halt watches from `tests/bench/profiles/doom-loading.mjs`
  and `--sample-cs-ip=600,1000,100`.
- **Cycle reconciliation check.** Sum of cycle deltas in window
  938 M; final `cycleCount` − first sample ≈ 1.04 G — discrepancy
  is the first wide-single's leading delta from before the
  window started. Within reason.

### Recommended next steps

1. **Confirm `i4d` body shape in the cabinet.** Translate
   CS=0x2D96 IP=0x08..0xDB to the calcite dispatch entries the
   cabinet emits for those linear addresses. Use
   `probe_bytecode_shape` in `../calcite/crates/calcite-cli/src/bin/`
   or inspect the cabinet CSS directly. The question: does the
   loop-core body match the affine-loop plan's invariants
   (single induction variable, side-effect bounded, exits via
   `BranchIfNotEqLit`)?
2. **Pick recogniser granularity:**
   - *Per-iter affine fast-forward* — the existing plan at
     `docs/plans/2026-05-01-affine-loop-fastforward.md`. Wins
     on any libc divide on any cabinet.
   - *Function-level semantic substitution* — bigger payoff,
     much narrower applicability. Still cardinal-rule-clean
     if the recogniser only reads CSS shape.
3. **Measure trip-count distribution first** (plan's step 3).
   `__I4D`'s trip count is ~32/call (architectural), so should
   easily pass the plan's step-4 gate (abandon if avg trip
   count < 4). Confirm with `--probe-affine-loops` before
   building.
4. **Re-run the cycle-weighted heatmap after any change.**
   Protocol: 3-run web `doom-all --headed` medians for the
   headline + cycle-weighted CS heatmap for sanity-checking
   *where* the change moved cost.
5. **Address `r_draw` (24 %) second**, with the lesson from
   `column_drawer_fast_forward` in mind.

### Open questions / things to verify

- **Is `r_draw` really hot during level-load**, or hot during
  the menu/title redraw running in parallel with G_DoLoadLevel?
  Tick window 4.6M–34M starts at `_g_usergame=1` (level-load
  begin) but the menu may still be onscreen. Disambiguate by
  re-sampling with the bursts gated to fire only after a watch
  confirms stage_loading has fired, or by filtering on a more
  precise tick boundary.
- **Cycle-weighting honesty when bulk ops fire.** Sampler
  records `cycleCount` at sample time, but `cycleCount` can be
  advanced in bulk by `rep_fast_forward` (and possibly other
  bulk paths). If a bulk op completes between two wide
  singles, the delta is attributed to whichever segment we
  *caught* the second sample in — not where the cycles were
  actually spent. Spot-check by comparing the cycle-weighted
  heatmap against a per-burst variant (bursts are tick-by-tick
  so they don't suffer this).

## 2026-05-11 — FPS baseline reframed as fuzzy ~1-2 fps; bench-host hygiene rule

User observed ~1-2 fps in interactive Doom8088 on the merged-master
build (post `old-kbd` merge), inconsistent with the **1.70 fps**
"baseline" quoted in STATUS.md and tests/bench/README.md.

Re-read the source — the 1.70 figure was the median of a 3-run
sample whose values were 0.70 / 1.80 / 0.85 (commit `64f1146`). A
±2× spread is not a stable baseline; picking the middle reading
hid the noise. STATUS.md, tests/bench/README.md, and the Open-work
entry all rewritten to quote **~1-2 fps (noisy, ±2× across runs)**
and to say explicitly that FPS deltas inside that band aren't
publishable. Wall (78-82 s) and ticks/sec (394-434 K) are ±3 %
and remain the actual perf signal.

Also added an explicit "quiet the host before benching" section to
tests/bench/README.md: check no other agent is running another
bench, a build, or a long Playwright session. Concurrent benches
make both runs' numbers garbage and this has bitten us. Look for
stray `node tests/bench/driver/run.mjs`, `playwright`, `chrome
--headless`, `calcite-cli`, `cargo build`/`test` processes.

No code changed.

## 2026-05-08 — BIF2 fusion isolated: +4.5 % throughput, +8 % in-game FPS

Hardcoded BIF2 (BIfNEL2 pair fusion) OFF in calcite (`ef44f20`,
const `BIF2_FUSE_ENABLED=false` in `compile.rs`), reran the canonical
3-run `doom-all` baseline, compared against the BIF2-on baseline
landed earlier today.

| Metric | BIF2 ON (median) | BIF2 OFF (median) | Δ |
|---|---:|---:|---:|
| compileMs       | 27,592 | 27,829 | +0.9 % |
| runMsToInGame   | 77,061 | 79,667 | **+3.4 %** |
| ticksToInGame   | 34,528,096 | 34,485,698 | −0.1 % (~deterministic) |
| ticksPerSecAvg  | 443,099 | 423,355 | **−4.5 %** |
| ingameFps       | 1.85 | 1.70 | **−8.2 %** |
| doomLoad phase  | 65,480 | 68,463 | **+4.6 %** |
| doomMenuDelay   | 2,139 | 2,608 | +21.9 % (small abs) |

So on the post-keyboard-revert old-kbd web baseline, BIF2 is worth
roughly **+4.5 % throughput / +8 % in-game FPS** — modest but real.

The 2026-05-07 calcite log entry that claimed +47 % throughput /
−32 % wall (calcite `8e592b0`/`f014d35`) measured BIF2 on the **CLI**
bench (`run.mjs doom-loading --target=cli`), with a baseline of
142 K ticks/sec (the engine was bottlenecked by the not-yet-fixed
`apply_input_edges` regression at that point — the same-day fix in
calcite `6d9e80a` recovered most of the throughput). On the CLI
runtime — no SW, no frame consumer, native rather than wasm — the
relative weight of dispatch overhead vs other engine work is
different too. The +47 % isn't wrong; it just doesn't generalise
across runtimes or across baselines. The web is the canonical
bench, and the canonical answer for BIF2 is +4-8 %.

Lesson: when claiming a percentage win, anchor to the canonical
bench (web `--headed`) and a fully-current baseline. CLI numbers
are dev-sanity, not headline material.

Raw JSONs:
`docs/benches/doom-all-2026-05-08-old-kbd-{run,bif2off-run}{1,2,3}.json`.

Also discovered (and fixed) along the way: `tests/bench/lib/artifacts.mjs`
hardcoded `../calcite/` for the wasm/cli artifacts, ignoring
`CALCITE_REPO`. From a CSS-DOS worktree, `../calcite/` resolves to
`CSS-DOS/.claude/worktrees/calcite/` (a sibling worktree, usually on a
different branch). The dev server already honours `CALCITE_REPO`; the
bench artifact registry now does too. Prior 3-run baseline happened
to use the right wasm only because the dev server served it and we
always passed `--no-rebuild` (so the bogus staleness check never
triggered a rebuild against the wrong calcite).

## 2026-05-08 — canonical bench set + 2026-05-08 baseline (old-kbd branch)

The benchmark layout was sprawling across `tests/harness/` (legacy
`flamegraph-doom.mjs`, `bench-doom-stages.mjs`, `bench-doom-load.mjs`)
and `tests/bench/profiles/`, with no single rule about which is the
canonical tool. Cleaned this up to **three** canonical profiles and
made `tests/bench/README.md` required reading before any benchmark
run.

**Canonical profile set** (under `tests/bench/profiles/`):

| Profile | What it measures |
|---|---|
| `compile-only`     | Cabinet → parse → compile time |
| `doom-loading`     | Boot through six stages → in-game (wall ms, ticks) |
| `doom-ingame-fps`  | Steady-state in-game FPS while holding Left |

`doom-ingame-fps` is the rename of the earlier `ingame-fps.mjs`
(cart-prefix matches `doom-loading`). Holds Left continuously,
samples the full 320×200 framebuffer every ~16ms, hashes via FNV-1a,
counts distinct frames. **Now includes 8 s warmup** before
measurement starts — right after `gamestate=GS_LEVEL` flips, the
menu slides off the bottom of the screen (~3-4 s), the view fades
in, and sprite/sector caches populate. Without warmup the headline
was ~2.7 fps with the first 4 s at 6-11 fps from menu animation.
With warmup the headline is **1.45 fps** — what the user actually
feels mid-gameplay.

**2026-05-08 baseline (old-kbd branch, 3-run doom-all median, web
`--headed`):**

| Phase | Median wall |
|---|---:|
| compile (cabinet → calcite IR, one-shot) | 27.6 s |
| dosBoot (BIOS + DOS to title splash)     | 9.0 s |
| doomTitle (title → menu)                 | 0.5 s |
| doomMenuDelay (Enter → level-load start) | 2.1 s |
| doomLoad (level-load → GS_LEVEL)         | **65.5 s** |
| warmup (menu slide-off, no measure)      | 8 s |
| measure (FPS sample window)              | 20 s |

- Run wall (engine-running to in-game): **77.1 s** (range 76.6-77.5,
  ±0.5 %). Tick count: 34.1 M; throughput: **443 K ticks/sec**.
- Steady-state in-game FPS: **1.85** (range 1.70-2.15).
- doomLoad is **84.9 %** of the engine-run wall — perf optimisation
  pays off there more than anywhere else.

Raw JSONs (each ~27 KB, contains full `statsSamples` and `fpsSamples`
time series) in `docs/benches/doom-all-2026-05-08-old-kbd-run{1,2,3}.json`.

Earlier 3-run set (range 78-112 s wall) was contaminated by host
CPU contention — that set's "use 3-run medians, ±30 %" advice was
overstated. With nothing else competing the runs converge to within
±0.5 %.

**Cleanup landed in this entry:**
- Renamed `tests/bench/profiles/ingame-fps.mjs` → `doom-ingame-fps.mjs`.
- Added `doom-all.mjs` — runs `doom-loading` + `doom-ingame-fps`
  in one boot. Same wall as ingame-fps alone (both pay the boot).
  Small profiles kept for "I want one number quickly" cases.
- Deleted `tests/harness/flamegraph-doom.mjs` (LEFT-holding workload
  bundled with V8 CPU profiling — superseded by the bench profile;
  if web-side flamegraphs are needed again, add them as a profile).
- Deleted `tests/harness/resolve-cpuprofile.mjs` (helper for above).
- Deleted `tests/harness/bench-doom-{load,stages,stages-cli,gameplay}.mjs`,
  `tests/harness/bench-web.mjs`, `web/player/bench.html` — all
  superseded by the canonical profiles.
- Updated `CLAUDE.md`, `docs/TESTING.md`, `tests/bench/README.md`,
  `STATUS.md` so all paths converge on the canonical set; reading
  `tests/bench/README.md` before running any bench is now mandatory.

## 2026-05-07 — `apply_input_edges` regression fixed (recovered 1.83×); BIF2 fusion default-on

The user noticed the web player felt slower. Bisect (5M tick raw
bench on doom8088) located the regression at calcite commit
`a5e8eee` (input-edge recogniser, 2026-05-05): **162 K ticks/sec
post-merge vs 289 K pre-regression — a 44 % throughput cut.**
Bench detail in [`../calcite/docs/log.md`](../../../calcite/docs/log.md).

Cause: `apply_input_edges()` ran at the top of every tick doing
work proportional to the cabinet's input-edge count (59 on
doom8088). Per tick: 59 string allocations, 59 HashMap probes
for slot resolution, 59² acc-scans, plus 59 more HashMap probes
(each allocating two Strings) for `pseudo_class_active`. The
function comment claimed "Cheap when nothing is pressed" — both
words were wrong.

Fix lands as calcite [`6d9e80a`](https://github.com/stop-amertime/calcite/commit/6d9e80a)
(input-edges) + [`f014d35`](https://github.com/stop-amertime/calcite/commit/f014d35)
(BIF2 default-on). Three changes:

1. Lazy compile-once + grouping. First apply resolves each
   binding's `bare(property)` → slot once and groups by slot;
   subsequent ticks read the cached groups.
2. `State.pseudo_active` is a HashSet (was HashMap). When empty
   AND last apply wrote zero everywhere, the function returns
   immediately. Doom8088's typical "no key pressed and none
   pressed last tick" hits this in O(1).
3. `pseudo_class_active_pair` short-circuits on empty set before
   constructing the lookup key — no allocations on the
   nothing-pressed path.

Bench results:

```
                      doom8088 5M ticks   doom-loading 34M ticks
  pre-regression       289 K ticks/sec    (extrapolated ~120 s)
  pre-fix main         162 K ticks/sec    242 s
  post-fix main        297 K ticks/sec    161 s
                       (+1.83×)           (-33 %)
```

Cycles match across all configurations — same observable
behaviour. Smoke 7/7 PASS.

This puts doom-loading at 161 s (was 242 s pre-fix). Steady-state
in-game FPS not yet measured (still no profile for it), but the
161 s wall is comfortably ahead of the ship target.

## 2026-05-07 — pre-ship FPS lead: **`CALCITE_BIF2_FUSE=1` is a 31.8 % win on doom-loading**

After lead #1 (widen `fuse_loadstate_branch`) was retired (entry
below), I asked calcite for a **runtime** op-adjacency profile via
`calcite-cli --restore … --op-profile` against fresh in-game and
loading snapshots. The static probe (`probe_bif_predecessor`) was
showing what's in `program.ops` post-compile; the runtime profile
shows what actually gets *dispatched*. The two profiles look very
different.

Top runtime adjacencies (consistent across cold / loading / in-game,
all within ~1 % of each other; 200K ticks each):

| Adjacency | In-game | Loading | Cold |
|---|---:|---:|---:|
| **BIfNEL → BIfNEL** | **13.52 %** | 12.73 % | 12.96 % |
| LoadSlot → LoadSlot | 9.73 % | 9.67 % | 10.27 % |
| **LoadSlot → BIfNEL** | 5.11 % | 5.31 % | 5.19 % |
| LoadState → LoadSlot | 3.49 % | 3.52 % | 3.52 % |
| BIfNEL → LoadState | 2.39 % | 2.23 % | 2.46 % |

`BranchIfNotEqLit2` is **already implemented** (`fuse_diff_slot_bifnel_pairs`
in `crates/calcite-core/src/compile.rs:3821`, op variant at compile.rs:359),
but **off by default** — gated behind `CALCITE_BIF2_FUSE` because the
2026-04-30 measurement on the reference cabinet was net wash.

Re-tested on the current doom8088 cabinet:

```
                     ticks/sec    runMsToInGame   throughput Δ
baseline (median-3)  142 656      241 872 ms       —
CALCITE_BIF2_FUSE=1  210 155      164 878 ms      +47.3 %
                                  −31.8 % wall
```

794 fusions fire on doom8088 (vs 0 baseline, vs 50 for
`fuse_loadstate_branch`). Smoke 7/7 PASS with `BIF2_FUSE=1`
(`dos-smoke`, `hello-text`, `cga4/5/6`, `zork1`, `montezuma` —
107.9 s wall).

**This eclipses the entire pre-ship FPS target in one env-var flip.**
3 FPS → 4 FPS at the steady-state ratio (ticks/sec moved from 142 K
to 210 K, a 1.47× — the brief target was "4–5+ FPS", i.e. 1.33–1.67×).

The 2026-04-30 net-wash result was specific to the reference
cabinet's adjacency profile. doom8088 has 794 candidate pairs
instead of "1330 with BIfNEL2 fusion offset by `pc += 2; continue;`
cost" — the dispatch savings dominate at this candidate count.

**Where it goes from here.** Recommend flipping `CALCITE_BIF2_FUSE`
to ON-by-default after one more cabinet bench (zork-big or another
non-trivial cart) confirms the 2026-04-30 wash isn't a regression on
that shape. Calcite-side detail in
[`../calcite/docs/log.md`](../../../calcite/docs/log.md). Brief at
[`docs/agent-briefs/2026-05-07-pre-ship-fps-leads.md`](../agent-briefs/2026-05-07-pre-ship-fps-leads.md)
needs updating: the new ranked top pick is "audit the 2026-04-30
BIF2 wash result on the current reference cabinet, then default on."

## 2026-05-07 — pre-ship FPS lead #1 (widen `fuse_loadstate_branch`): retired

Calcite-side work. Full entry in
[`../calcite/docs/log.md`](../../../calcite/docs/log.md) under
"Widened `fuse_loadstate_branch`: NEGATIVE RESULT". Summary:

- **Hypothesis** (from the pre-ship FPS brief): widening
  `fuse_loadstate_branch` to allow non-aliasing intervening ops
  between `LoadState{dst:X}` and `BranchIfNotEqLit{a:X}` would lift
  the 0.8 % `LoadStateAndBranchIfNotEqLit` hit-rate ~30 % and cut the
  per-tick op floor.
- **Implementation** added a forward scan up to `LS_WINDOW=8` with
  full safety constraints (no read/write of slot X, no memory writes,
  no jump targets, no branch/jump/dispatch ops). Built clean.
- **Result:** **same 50 fusions as the adjacent path**; zero new
  candidates. Reverted.
- **Why:** probe `probe_bif_predecessor` shows 0 of 80,118 isolated
  BIfNELs in `doom8088.css` have a matching `LoadState{dst:X}` within
  a 16-op backward basic-block-bounded scan. 97.3 % of BIfNEL
  predecessors are `Jump` (the BIfNEL is reached *as a jump target*
  from a chain-miss path; the LoadState that fed it lives on a
  different basic block).
- **Bench unchanged:** doom-loading CLI median-of-3 = 241.872s
  (242.892, 241.872, 237.790).
- **Brief updated** to retire lead #1 and elevate lead #3
  (`apply_input_edges` short-circuit) to top pick. Probe
  `probe_bif_predecessor.rs` kept in-tree as a permanent diagnostic.

## 2026-05-07 — pre-ship FPS bottleneck survey

Survey done in service of the pre-ship perf push (current
steady-state Doom8088 ~3 FPS, target 4–5+). Five untried leads
written up in
[`docs/agent-briefs/2026-05-07-pre-ship-fps-leads.md`](../agent-briefs/2026-05-07-pre-ship-fps-leads.md),
ranked by leverage/risk. No code change yet — this is reconnaissance
the next perf agent picks up.

Headline finding: the comment at calcite
`compile.rs:6708` claims 96 % of ops are
`LoadStateAndBranchIfNotEqLit`. Real fusion hit-rate measured at
three windows (cold start, loading, in-game) via
`calcite-bench --restore … --profile`: **0.8 % at all three**. The
unfused `LoadSlot + LoadState + LoadLit + Cmp + Branch` chain
dominates instead — widening `fuse_loadstate_branch` to handle the
real shape is the top-pick lead. **Op mix is virtually identical
across stages** (LoadSlot 28 %, BranchIfNotEqLit 21–22 %,
LoadState 10 %), so a flat per-tick win lands the same percentage
in both `headline.runMsToInGame` and steady-state in-game FPS.

What does change between stages is dispatch sub-op weight: 9 sub-
ops/Dispatch at boot, **177 during loading** (the segment-0x55
zone-walk going through heavy dispatch bodies), 34 in-game.

Snapshots saved to `tmp/perf-snaps/stage_{loading,ingame}.snap`
against the current `doom8088.css`. Regenerate on cabinet rebuild;
recipe + commands in the brief.

Process notes for the next agent:

- Both `headline.runMsToInGame` (boot→ingame) and steady-state
  in-game FPS are ship targets. They share some bottlenecks but
  not all. Measure both.
- There is currently no canonical in-game-FPS bench profile.
  Adding one (snapshot-restore from `stage_ingame.snap`, run N
  ticks, report tick/cycle/frame rate) is checkpoint 0 of any
  in-game-targeted mission.
- Canonical bench is `tests/bench/driver/run.mjs doom-loading` on
  both `--target=cli` and `--target=web` (default). `calcite-bench
  --profile` is a secondary tool for op distribution; it doesn't
  produce headline numbers. Quote bench-harness JSON before/after
  any change.

## 2026-05-07 — `rep_fast_forward` genericity mission, phase 3a landed

Cross-link: see calcite [`docs/log.md`](../../../calcite/docs/log.md)
2026-05-07 entry (the newest one) for full engine-side details.

Phase 3a of the
[genericity mission](../plans/2026-05-06-rep-fast-forward-genericity.md)
landed: the recogniser now covers all 8 string opcodes (CMPS/SCAS
joined STOS/MOVS/LODS), and descriptors carry a `BulkClass` field
classifying each loop as `ReadOnly` / `Fill` / `Copy` / `PerIter`
purely from CSS shape. The validator was extended to surface drift
between the structural classification and the runtime hardcoded
expectations.

Same in-session re-scope rationale as phase 2: phase 3 was originally
"applier flip + specialisations + CMPS/SCAS + perf gate ±1%" all in
one shippable pack. That's too risky for one session on a perf-gated
mission. Phase 3a is the recogniser+classification half (no runtime
change, no perf risk); phase 3b is the actual applier flip.

Engine-side changes (calcite):

- `match_ip_stay_or_advance` extended to multi-branch IP bodies
  (CMPS/SCAS shape via kiln's `repCondIP`). Pure structural.
- `BulkClass` enum + `classify_bulk()` on `LoopDescriptor`.
- `validate_descriptor_for_opcode` extended with flag_conditioned and
  bulk_class checks.
- 5 new unit tests; 15 / 15 pass.

Validator finding on doom8088: 8/8 string opcodes recognised. STOS
classifies as `Fill` (correct). MOVS classifies as `Fill` rather than
`Copy` — DRIFT message — because the cabinet uses an intermediate
slot (`--_strSrcByte`) between SI's mirror and the write value, so
pure-shape classification can't see the pointer dependency. CMPS/SCAS
classify as `ReadOnly` with `flag_conditioned=true` (correct).

Smoke 7/7 PASS. doom8088 reaches in-game on calcite-cli with the
flag both off and on, tick 34.65M (parity with pre-mission baseline).

What's next (phase 3b): build the descriptor-driven applier behind
the same `CALCITE_REP_GENERIC=1` flag, replace the hardcoded path,
hit ±1% perf gate. Open question: how to handle the MOVS DRIFT —
either trace through the intermediate slot at compile time, or fall
back to PerIter for shapes the structural classifier can't simplify.

## 2026-05-07 — `rep_fast_forward` genericity mission, phase 2 landed

Cross-link: see calcite [`docs/log.md`](../../../calcite/docs/log.md)
2026-05-07 entry for full engine-side details and the validator's
findings on doom8088.

Phase 2 of the
[genericity mission](../plans/2026-05-06-rep-fast-forward-genericity.md)
landed today, but as path B (diagnostic validator) not path A (full
runtime applier). The user accepted the smaller-step landing in-session
for risk reasons — building the per-iter applier *and* its bulk
specialisations *and* hitting the ±1% perf gate in one go was too
ambitious. Path A folds into checkpoint 3.

Engine-side changes (in calcite, see calcite log for details):

- `CALCITE_REP_GENERIC=1` env-var gate, default off.
- `loop_descriptors` mirrored onto `CompiledProgram` so the per-tick
  fast-forward path can validate against them.
- `state.virtual_regions: Vec<VirtualRegion>` populated by recognisers
  at compile time; the bulk path consults it instead of the hardcoded
  0xD0000 carve-out. Stale 0x500 keyboard-bridge entry removed.
- Memwrite addr/val paired by assignment-order proximity (replaces
  phase-1 name-sort heuristic). Cardinal-rule clean — purely
  positional.

Validator finding on the live doom8088 cabinet: 4/4 STOS/MOVS opcodes
(0xAA/0xAB/0xA4/0xA5) recognised with consistent shape. 4/4 CMPS/SCAS
opcodes (0xA6/0xA7/0xAE/0xAF) miss as documented — phase 1's
recogniser doesn't yet handle flag-conditioned exits. Phase 3 fixes
this.

Verification: smoke 7/7 with flag both off and on; doom8088 CLI to
in-game at tick 34.65M with flag on (parity).

## 2026-05-06 — `rep_fast_forward` genericity mission, phase 1 landed

Cross-link: see calcite [`docs/log.md`](../../../calcite/docs/log.md)
2026-05-06 entry for the engine-side details. Summary: the
compile-time structural recogniser landed on the calcite side with 9
unit tests + working recognition of 6 self-loop opcodes (MOVSB/MOVSW/
STOSB/STOSW/LODSB/LODSW, opcode 0xA4-0xAD) on the doom8088 cabinet
under `CALCITE_LOOP_DIAG=1`. CMPS/SCAS variants are deferred to phase
2 (their flag-conditioned IP predicate needs flag-aware matching that
ties in with the runtime applier).

Phase 1 produces descriptors; the runtime path doesn't use them yet.
Old `rep_fast_forward` remains active. `node tests/harness/run.mjs
smoke`: 7/7 PASS pre and post change.

Plan: phase-1 checkpoint complete in
[`docs/plans/2026-05-06-rep-fast-forward-genericity.md`](../plans/2026-05-06-rep-fast-forward-genericity.md).
Pick up at checkpoint 2 (descriptor-driven runtime applier behind
`CALCITE_REP_GENERIC=1` flag).

## 2026-05-06 — Plan filed: `rep_fast_forward` genericity mission

Planning-only entry. Wrote
[`docs/plans/2026-05-06-rep-fast-forward-genericity.md`](../plans/2026-05-06-rep-fast-forward-genericity.md)
covering the multi-session mission to replace the last cardinal-rule
violation in calcite-core (`rep_fast_forward`, ~341 lines of
hardcoded x86 string-op semantics in
`../calcite/crates/calcite-core/src/compile.rs:5734`) with a generic
CSS-shape recogniser plus a descriptor-driven runtime applier.

Hard constraints fixed up-front so future agents can't drift:

- Cardinal rule. Genericity probe with synthetic brainfuck-shaped
  cabinet must produce equivalent descriptors without calcite-side
  changes.
- Recogniser may not read any character of any slot name. It works
  off slot identity (same-slot checks after compile-time resolution)
  and expression shape only. This forecloses the
  obvious-but-wrong shortcut of name-prefix sniffing.
- Perf gate ±1% on doom8088 `runMsToInGame` web AND native CLI.
- Smoke 7/7 PASS at every checkpoint.
- Single fast-forward path at the end. Old path stays gated during
  transition checkpoints, gets deleted at checkpoint 5.

Five checkpoints, each independently shippable:

1. Recogniser + descriptors + unit tests (compile-time only, old
   path still active).
2. Generic runtime applier behind `CALCITE_REP_GENERIC=1` flag,
   default off. Memory-snapshot diff sweeps prove byte-for-byte
   parity.
3. Specialisation passes for `bulk_fill` / `bulk_copy` shapes. Perf
   gate validated here.
4. Flip default to generic path; soak.
5. Delete `rep_fast_forward` and helpers; close the audit list.

Cross-cutting plumbing: `state.virtual_regions` replaces the
hardcoded `ranges_overlap_virtual(0x500, 0xD0000, 0xF0000)` carve-out
so the generic applier doesn't need to know which CSS-DOS-specific
ranges exist.

Pick up at the next unchecked checkpoint in the plan. No code
landed today.

## 2026-05-06 — Phase B finished: bench harness migrated, set_keyboard retired

Closed out the keyboard-cheat retirement. The Phase B work from
2026-05-05 left two compatibility shims in place
(`engine.set_keyboard` on the wasm engine, the legacy `?key=0xHHHH`
URL form on the SW); both held back so the bench harness and
in-flight callers could keep working. Today they all moved to the
pseudo-class API and the shims came out.

**Calcite engine** — see `../calcite/docs/log.md` 2026-05-06 for the
engine-side details. Summary:

- New script-DSL action `pseudo_pulse=PSEUDO,SELECTOR,HOLD_TICKS`
  (mirror of `setvar_pulse` but on the pseudo-class surface). Same
  edge-pair semantics: flip active now, schedule a release after
  `HOLD_TICKS`. The skip-if-pending check now keys on a typed
  `PendingReleaseKind` enum (`Var{name}` vs `Pseudo{pseudo,selector}`)
  so the same registry handles both pulse types cleanly. Three new
  unit tests; 16/16 script tests green.
- `--press-events=TICK:[+|-]SELECTOR,...` replaces the legacy
  `--key-events=TICK:VALUE,...` flag on calcite-cli. Same use-case
  (script keyboard input at specific ticks for deterministic tests),
  driven on the pseudo edge instead of the `keyboard` state var.
  The interactive REPL keyboard handler routes through
  `set_pseudo_class_active("active", kb-X, true|false)` via a new
  `key_to_selector` map (mirrors `KEYBOARD_KEYS` from kiln).
- `engine.set_keyboard` deleted from calcite-wasm. The replacement
  `engine.set_pseudo_class_active(pseudo, selector, value)` was
  already exposed in 2026-05-05.

**CSS-DOS-side host migration**:

- `tests/bench/profiles/doom-loading.mjs`: title_tap and menu_tap
  watches now use `pseudo_pulse=active,kb-enter,50000` instead of
  `setvar_pulse=keyboard,0x1C0D,50000`. The driver-side `sendKey`
  fallback (used when the bench page race-conditions out of catching
  a poll-stride menu transition) switched from `?key=0x...` to
  `?class=kb-enter`.
- `tests/harness/bench-doom-stages.mjs` and
  `bench-doom-gameplay.mjs`: `?key=0x1C0D` → `?class=kb-enter`,
  `?key=0x4B00` → `?class=kb-left`.
- `web/site/sw.js::handleKbd`: dropped the `?key=0xHHHH` branch
  entirely; only `?class=kb-X` is recognised now. URLs pointing at
  the legacy form will silently no-op (intended — the legacy URLs
  are gone in our codebase, and external callers should migrate).
- `web/shim/calcite-bridge.js`: queue items are now plain selector
  strings (`'kb-X'`); the `kind: 'key' | 'active'` discriminator is
  gone. The `'kbd'` message type from the SW is no longer accepted —
  only `'kbd-active'`. Bridge version bumped to `v47-pseudo-only`.
- `web/player/calcite-canvas.html`: switched from
  `data-key="0xHHHH"` + `worker.postMessage({type:'keyboard'})` to
  `id="kb-X"` + `worker.postMessage({type:'press', selector, active})`.
  pointerup/pointercancel now flip the edge inactive — previous
  shape was edge-only (push on press, never release).
- `../calcite/web/calcite-worker.js` and `../calcite/web/index.html`
  (the calcite playground page, which lives outside this repo's
  build-UI): same `'press'` message migration. Comments updated to
  describe the principled path.

### Verification

- Smoke 7/7 PASS pre and post each step of the migration.
- doom-loading bench (CLI target) reaches in-game at tick 34,650,000
  — same as the legacy `setvar_pulse=keyboard` baseline. The new
  `pseudo_pulse=active,kb-enter` watch path drives the cabinet
  through title and menu identically.
- Browser e2e `pseudo-active-api-probe.html` PASS in headless Chrome
  against the fresh wasm (no `set_keyboard` export): 561 → 8338 → 0
  sequence through `set_pseudo_class_active` + `tick_batch`.
- 16/16 calcite-core script tests green (3 new); 1 new
  `pseudo_pulse_make_then_release` evaluator test.

### Cardinal-rule check

The cabinet's CSS pays for itself in calcite the same way it pays for
itself in raw Chrome. There's no calcite-side knowledge of which
selectors are "keys" or which property is "the keyboard" — the
recogniser fires on pure shape (`&:has(#IDENT:IDENT) { --PROP: V }`)
and the host flips arbitrary `(pseudo, selector)` edges. A 6502
cabinet that emitted `&:has(#trigger:active) { --gunFiring: 1 }`
would get the same treatment with no calcite-side change.

The `0x500` literal (CSS-DOS BDA keyboard slot) is gone from
calcite, the `set_keyboard` wrapper is gone, the `?key=0xHHHH` URL
is gone, the bridge `'kbd'` message kind is gone, and the
`--key-events` CLI flag is gone. What remains in the keyboard path:
the cabinet's own CSS rules (host-agnostic, expressed in CSS-DOS
vocabulary) plus calcite's structural recogniser
(upstream-agnostic). Nothing in between speaks both languages.

## 2026-05-05 — calcite-genericity cleanup: tasks 1-4 of the audit list

Worked through the post-keyboard "make calcite not cheat" list (LOGBOOK
2026-05-05 line 271-278). Four of five items landed; the fifth is its
own mission, deferred.

**Task 1: delete `column_drawer_fast_forward`.**
Off by default since 2026-04-29 (net perf loss; doom-specific 21-byte
ROM body recogniser, fired 159 times across a 35M-tick run). Removed
the function, its `FusionDiag` thread-local funnel, the
`CALCITE_FUSION_FASTFWD` and `CALCITE_FUSION_DIAG` env-var gates, and
the `rom_match` helper from `crates/calcite-core/src/compile.rs`.
Stripped the corresponding `fusion_diag_enable` /
`fusion_diag_snapshot` / `fusion_fire_count` plumbing from
`crates/calcite-cli/src/main.rs`. Smoke 7/7 PASS pre and post.

**Task 2: move `summary.rs` out of `calcite-core`.**
Per-tick event log + block segmenter for execution diagnostics — every
field name (CS/IP/opcode/_irqActive) was upstream-aware. New crate
`calcite-debug-summary` (lib, depends on calcite-core), registered in
the workspace `Cargo.toml` and as a workspace dependency. The
`calcite-debugger` consumer was migrated from
`calcite_core::summary::*` to `calcite_debug_summary::*`. The
calcite-core integration test for summary moved to a new test in the
new crate (and updated to bootstrap `State` via `parse_css` +
`load_properties` rather than poking the `pub(crate) state_var_index`
directly). 5 unit tests + 1 integration test green; smoke 7/7 PASS.

**Task 3: move CGA renderer + CP437 + DAC palette out of `calcite-core`.**
`State::render_screen` / `render_screen_ansi` / `render_screen_html` /
`render_framebuffer` / `read_framebuffer_rgba` / `read_video_memory`,
the `CGA_PALETTE` and `VGA_DAC_LINEAR` constants, and the
`cp437_to_unicode` helper all baked PC-video conventions into the
engine crate. New crate `calcite-pc-video` (lib, depends on
calcite-core) re-hosts them as free functions taking `&State`.
Consumers migrated: calcite-wasm (its `pub fn render_screen` /
`render_framebuffer` / `read_framebuffer_rgba` / `read_video_memory`
methods now delegate to the new crate, and the wasm public surface is
unchanged), calcite-cli (CGA palette + render_screen_ansi +
render_framebuffer call sites), calcite-debugger (its
`Session::render_screen` helper). Wasm rebuilt via `wasm-pack build
crates/calcite-wasm --target web --out-dir ../../web/pkg --release` so
the JS bindings reflect the new build. Smoke 7/7 PASS.

**Task 4: strip doom/DOS comments from non-test calcite-core code.**
Surgical comment pass — converted `doom8088`/`DOOM`/`x86CSS`/`CSS-DOS`
references in production-path comments to generic phrasings ("the
reference cabinet", "measured cabinets", "the cabinet's bytecode").
Kept calibration citations where they're load-bearing context (e.g.
"95% of all such pairs in the reference cabinet") and didn't touch
test code or comments inside `rep_fast_forward` (those describe real
cardinal-rule violations the *code* makes; reframing them in comments
without fixing the code would just hide the issue — see task 5).
Files touched: lib.rs, compile.rs, eval.rs, conformance.rs,
parser/fast_path.rs, pattern/broadcast_write.rs, pattern/byte_period.rs,
pattern/fusion_sim.rs, pattern/packed_broadcast_write.rs. Comment-only;
calcite-core builds clean.

**Task 5: reframe `rep_fast_forward` as a generic CSS-shape recogniser
— DEFERRED.**

This is the audit's "perf-gated mission" item, not a quick refactor.
The function (~341 lines + helpers in calcite-core/src/compile.rs)
inspects an x86 string-op opcode latch (`--opcode` ∈ {0xA4, 0xA5,
0xAA, 0xAB, 0xA6, 0xA7, 0xAE, 0xAF}), decodes 8086 REPE/REPNE
semantics, segment overrides, the direction flag, and bulk-applies CX
iterations. It also encodes a list of "virtual" memory regions
(0x0500-0x0502 keyboard bridge, 0xD0000-0xD0200 ROM-disk,
0xF0000-0x100000 BIOS ROM) that the bulk path mustn't trample, and
panics if it would. None of that knowledge is derivable from CSS
shape — it's pure upstream awareness encoded in the engine.

Generalising means recognising "function repeats body N times,
incrementing/decrementing addr, until counter hits 0" as a CSS shape
without ever spelling 0xA4. That's the design the affine-loop
fastforward plan (`docs/plans/2026-05-01-affine-loop-fastforward.md`)
already sketches for non-REP loops, but applying it to REP requires:
(a) detecting the shape at compile time keyed off the function name
the cabinet uses, (b) deriving the (init, step, terminator) tuple
from the body, (c) replacing the hardcoded x86 flag-word semantics
with whatever the body says, (d) replacing the hardcoded
virtual-region check with a generic "this address falls outside the
bulk-writable range" predicate driven by the address-map's dispatch
exceptions. Plus the perf gate — doom8088 web+CLI must stay within 1%
of current.

Multi-session work. Punted to its own brief.

## 2026-05-05 — keyboard: full PC layout (Esc/F1-F10/Ctrl/Shift/Caps + responsive)

Doom8088 uses Ctrl to fire — without it the on-screen keyboard can't
shoot. While in there, brought the on-screen keyboard up to a full PC
layout (6 rows, 11 cols) and made the screen responsive.

- `kiln/template.mjs::KEYBOARD_KEYS` gains Ctrl (0x1D), Shift (0x2A),
  Caps (0x3A), Del (0x53), F1–F10 (0x3B–0x44). All ASCII=0x00 (the
  cabinet just sees scancode in the high byte of `--keyboard`).
  `emitKeyboardRules` writes 56 rules now (was 45); cabinet rebuilds
  pick up `.cpu { &:has(#kb-X:active) { --keyboard: N } }` for each.
- `web/player/calcite.html` — keyboard rebuilt as an explicit 6-row
  11-col grid:
  - Row 1: Esc | F1–F10
  - Row 2: 1–9 0 Bksp
  - Row 3: Tab Q–P
  - Row 4: Caps A–L Enter
  - Row 5: Shift Z–/
  - Row 6: Ctrl Space
  Each key gets explicit `grid-row` / `grid-column` so reordering
  doesn't drift the layout. Modifiers/digits/F-keys use a smaller
  font (11 px) since their labels are multi-char; letters stay at
  the default 16 px. Arrow keys still live in the right stack as
  fixed 32×32 squares right-aligned.
- Screen now responsive: `.screen-cell` and `.screen` use
  `width: 100%; max-width: 640px; aspect-ratio: 640/400` instead of
  fixed 640×400, so narrow viewports shrink the screen
  proportionally rather than overflowing.
- `calcite-canvas.html` left untouched (still on the JS `data-key →
  worker.postMessage` path; will get its own update once Phase B
  lands).
- Smoke suite (7 carts) PASS.

## 2026-05-05 — plan + initial cleanup: JS-free keyboard via `:active`

Captures the plan plus what landed today.

**Done in this session**:

- Architectural proof (`web/player/experiments/active-input.html` +
  `active-input-probe.mjs`) — verified `:root:has(.kb-XXXX:active)`
  propagates a custom property in raw Chrome via Playwright. 11/11
  assertions pass.
- Discovered the cabinet's CSS *already* emits the right rules
  (`kiln/template.mjs::emitKeyboardRules` writes
  `.cpu { &:has(#kb-X:active) { --keyboard: N } }` per kiln-side
  KEYBOARD_KEYS; `--keyboard` is declared as `@property`). The raw
  player (`web/player/raw.html`) already has matching `id=kb-X`
  buttons inside a `.cpu` wrapper. **The cardinal-rule path is
  already wired in raw.html.**
- Real-cabinet probe (`raw-keyboard-probe.mjs`) — load `raw.html`,
  stub `/cabinet.css` with the actual keyboard rules extracted from
  `doom8088.css`, drive mouse-down/-up on five keys, assert
  `--keyboard` on `.cpu`. 11/11 green.
- The calcite player (`web/player/calcite.html`) was missing
  `id=kb-X` on its `<a class="kb-key">` buttons. Added them so the
  same DOM surface that works in raw Chrome is exposed to calcite
  too. Comma/period/slash stay id-less — they aren't in
  `KEYBOARD_KEYS` (separate gap).
- Calcite-core: deleted the `0x500` keyboard literal in
  `crates/calcite-core/src/eval.rs::property_to_address`. Dead code
  in current cabinets (kiln declares `@property --keyboard`,
  `load_properties` registers it). Smoke suite (7 carts) passes
  pre and post deletion. See `../calcite/docs/log.md` 2026-05-05.

### The cheat being removed

Today's keyboard path:

1. Click `<a class="kb-key" href="/_kbd?key=0x1c0d" target="kbd-sink">`.
2. Iframe navigation triggers SW route `/_kbd`.
3. SW calls `engine.set_keyboard(0x1c0d)` on the wasm engine.
4. Engine writes guest memory `0x500` (BIOS keyboard slot).
5. Cabinet polls `0x500`.

Calcite's `eval.rs::property_to_address` has a hardcoded fallback:
`keyboard / __1keyboard / __2keyboard → 0x500`. That's a name-based
literal, violates the cardinal rule. But the deeper issue is that
the cabinet's CSS has *no path* into the keyboard slot — the only
input mechanism is the `set_keyboard` host call. Raw Chrome (no
calcite) can boot a cabinet but can't type into it. The CSS doesn't
pay for itself.

### The fix, in two layers

**CSS-DOS side (the actual fix):** kiln emits a small "input wiring"
section per cabinet:

```css
@property --kb_1c0d { syntax: "<integer>"; initial-value: 0; inherits: true; }
:root:has(.kb-1c0d:active) { --kb_1c0d: 0x1c0d; }
/* ... one rule per key ... */
:root { --keyboard: max(var(--kb_1c0d), var(--kb_1e61), …); }
```

The DOM elements are the existing `<a class="kb-key">` keyboard in
`web/player/calcite.html`. `:active` fires on mouse-down, reverts on
release. `:has()` propagates the active state to `:root`, so an
unrelated readout (or the cabinet's BIOS poll) reads `--keyboard`
via `var()`. Pure HTML+CSS, no JS on the page. Chrome runs it.

The `<a href>` + SW link route stays for the calcite path — it's a
JS-free way for a click to cross from the page into the host
runtime. The constraint is "no JS on the page", not "no SW".

**Calcite side (the recogniser, not a cheat):** at compile time,
walk the parsed assignment graph; for any RHS that depends on a
`:has(…:pseudo)` selector match, record an `InputEdge { pseudo,
class, slot }`. Expose to the host:

```
engine.input_edges() -> [{ pseudo, class, property_slot }]
engine.set_pseudo_class_active(pseudo, class, value)
```

The SW parses `class=` from the URL, calls
`set_pseudo_class_active("active", "kb-1c0d", true)` for the
press-hold window, then `false`. Calcite owns the matching
internally. The `0x500` literal in `property_to_address` deletes —
the cabinet's `@property --keyboard` declaration supplies the
address through the normal address map.

The recogniser is structural: any cabinet (6502, brainfuck,
non-emulator) that drives a property from `:has(...:active)` gets
the same treatment. No upstream knowledge.

### Architectural proof

`web/player/experiments/active-input.html` +
`web/player/experiments/active-input-probe.mjs` verify the CSS
mechanism end-to-end in headless Chrome via Playwright. All eleven
assertions pass: rest=0, hold-Enter→7181, hold-A→7777,
hold-B→12386, release→0, cross-key isolation. So the
`:root:has(...:active)` propagation reaches a `@property`-registered
custom property visible via `getComputedStyle`. Confirms the design
is feasible before any kiln/calcite work commits to it.

Run: `node web/player/experiments/active-input-probe.mjs`. Headed:
add `--headed`.

### Work remaining

The CSS-DOS-side cardinal-rule path is wired (kiln rules, raw.html
DOM, `--keyboard` propagation verified end-to-end). The literal
calcite cheat is gone (`0x500` deleted). What's still side-channel:

The SW link route writes `--keyboard` directly via
`engine.set_keyboard(scancode)`, short-circuiting the cabinet's
`:has(#kb-X:active)` rules entirely. Calcite-wasm doesn't currently
evaluate `:active` selectors; instead the host pushes the scancode in.
That's *legitimate host plumbing under the no-page-JS constraint* — but
the principled version is for calcite to recognise the
`:has(#kb-X:active)` shape and let the host flip the edge generically.

Phase B — calcite recogniser for `:has(...:pseudo)` edges:

1. Parser preserves `:has(…:pseudo)` predicates in the assignment
   graph (verify they aren't stripped today).
2. Compile-time pass enumerates `InputEdge { pseudo, class, slot }`
   triples; expose `input_edges()` on `CalciteEngine`.
3. Evaluator: when computing an assignment that depends on an
   input-edge pseudo-class match, consult host-supplied state
   (`set_pseudo_class_active` writes a per-edge bool); fall through
   to false otherwise.
4. SW link handler switches from `engine.set_keyboard(scancode)` to
   parsing `class=` from URL and calling
   `engine.set_pseudo_class_active("active", class, true)` with the
   release scheduled by the existing key queue (KEY_HOLD_BATCHES /
   KEY_GAP_BATCHES in `web/shim/calcite-bridge.js`).
5. Delete `engine.set_keyboard` once nothing references it.
6. Verify: doom8088 in calcite-wasm responds to on-screen button
   clicks identically to today; bench-doom-loading swaps
   `setvar_pulse` for click-driven input.

Polishing items:

- Add comma, period, slash to `kiln/template.mjs::KEYBOARD_KEYS` so
  those keys also work in raw Chrome.
- `web/player/calcite-canvas.html` uses `data-key="0xHHHH"` instead
  of `id=kb-X`; align with `calcite.html`/`raw.html` pattern if it's
  still in use.

### Scope notes

- Out of scope for now: physical keyboard support (`:active` is
  mouse-driven; physical keys would need a JS shim or a
  `<label for="checkbox">` + accesskey trick — separate question).
- Out of scope: chord/modifier support. Single-key-at-a-time first.
- Out of scope: `setvar_pulse` removal in general. The primitive
  remains useful for non-keyboard test inputs and watch actions;
  bench profiles just stop using it for keyboard once the new
  surface lands.
- The "calcite is generic" cleanup also covers (separately):
  delete `column_drawer_fast_forward` (off by default, net loss);
  move `summary.rs` out of `calcite-core` (diagnostic, x86-named);
  move `state::render_screen / render_framebuffer / CGA_PALETTE`
  into a `calcite-pc-video` crate or CSS-DOS-side adapter; strip
  doom/DOS comments from `calcite-core` non-test code; reframe
  `rep_fast_forward` as a generic CSS-shape recogniser (perf-gated
  mission, doom8088 web+CLI within 1 % of current).

## 2026-05-02 — kbdtap → bench reaches in-game

Calcite-core gets a new `setvar_pulse=NAME,VALUE,HOLD_TICKS` action
that schedules a make/break edge pair, and `cond:repeat` is fixed to
sustain mode (fire on every gated poll while held, matching its
existing doc) instead of the previous rising-edge implementation.
See `../calcite/docs/log.md` 2026-05-02 for the engine-side details.

The CSS-DOS-side `doom-loading` profile uses these to spam Enter
through title and menu screens. The CLI bench reaches in-game:

```
text_drdos    1.5 s    tick=450 K
text_doom     5.3 s    tick=1.55 M
title        13.3 s    tick=3.85 M
menu         13.3 s    tick=4.10 M
loading      14.3 s    tick=5.10 M
ingame      145.8 s    tick=34.65 M  (GS_LEVEL reached, halt)
```

Pre-cleanup baseline (old `--cond/--spam` DSL): 119 s / 35 M ticks.
Post-kbdtap: 145.8 s / 34.65 M ticks. +22 % wall is the new
watch-poll overhead (8 cond watches gated on a 50 K-tick stride);
ticks/cycles essentially identical.

Open follow-ups: web-target bridge tickloop progression after
`bench-run` (likely SW + viewer-port plumbing); retire the old
`tests/harness/bench-doom-stages*.mjs` scripts once web target also
passes.

## 2026-05-01 — Repo cleanup: script primitives + bench harness + web/player merge

Big-bang cleanup across both repos. Branches `cleanup-2026-05-01`
in CSS-DOS and calcite.

**Calcite engine — script-primitive layer.** Logged in
`../calcite/docs/log.md` 2026-05-01. Generic measurement primitives
(stride/burst/at/edge/cond/halt + actions emit/halt/setvar/dump/
snapshot) in calcite-core, exposed identically on calcite-cli
(`--watch` flag) and calcite-wasm (`engine.register_watch`). Old
`--cond` / `--poll-stride` / `--script-event` removed cleanly.
Three new modules in calcite-core (`script.rs`, `script_eval.rs`,
`script_spec.rs`); ~280 LOC removed from calcite-cli/main.rs.
Grammar reference: [`docs/script-primitives.md`](../script-primitives.md).

**CSS-DOS bench harness.** New harness at `tests/bench/`:

- `lib/ensure-fresh.mjs` — staleness primitive. Mtime check artifact
  vs declared inputs (file globs + transitive artifact deps);
  rebuild if stale; `--no-rebuild` bypass.
- `lib/artifacts.mjs` — declarative manifest of every built artifact
  (`wasm:calcite`, `cli:calcite`, `prebake:{corduroy,gossamer,muslin}`,
  `cabinet:{doom8088,zork1,montezuma,hello-text}`).
- `driver/run.mjs` — Node CLI. Two transports (web via Playwright,
  cli via calcite-cli). Calls `ensureArtifact` for every required
  artifact before running.
- `page/index.html` — page-side bench runner. Spawns the
  calcite-bridge worker, posts cabinet-blob, listens for compile-done.
- `profiles/compile-only.mjs` — sanity profile; passes end-to-end.
- `profiles/doom-loading.mjs` — six-stage doom8088 boot bench
  (CLI target reaches in-game with kbdtap landed 2026-05-02).

**CSS-DOS-side web/player merge.** `player/*` → `web/player/*`
(history preserved via git mv). `player/calcite-bridge.js` →
`web/shim/calcite-bridge.js`. URL paths kept stable (`/player/...`,
`/sw.js`, `/cabinet.css`, `/_stream/fb`, `/_kbd?key=`); only the
dev-server alias map changed. `?bench=1` inline `<script>` block
removed from `web/player/calcite.html` — the player is now zero-script.
The service worker stays at `web/site/sw.js` because SW scope must
be at-or-above `/`.

**Calcite-side cleanup.** ~17 K LOC removed: `site/`, `programs/`,
`output/`, `serve.mjs`, `serve.py`, 6 `.bat` files; 9 zombie tools
moved to `tools/archive/`; `menu.rs` stripped of the
`node ../CSS-DOS/builder/build.mjs` shell-out (cardinal-rule
violation). `cargo test --workspace` clean.

**Docs.** `docs/rebuild-when.md` (artifact graph + ensureFresh +
/_reset/_clear endpoints); `tools/README.md` rewritten;
`docs/INDEX.md` updated; logbook discipline rule added to both
CLAUDE.md files. Calcite-perf entries (10 days, 2026-04-28 to
2026-05-01) migrated from this LOGBOOK to `../calcite/docs/log.md`
(stubs cross-link). Old `bench/` directory removed; 43 fast-shot
PNGs deleted from `tests/harness/results/` and gitignored; 8
calcite probe `.exe`s deleted (source files stay).

**Validation.** Web bench post-merge: 143 s runMsToInGame /
34.3 M ticks / 398.7 M cycles (cabinet=332 MB). Pre-cleanup
baseline: 134.6 s / 34.5 M ticks / 407 M cycles. +6.5 % wall (within
±10 % budget); ticks/cycles essentially identical. Cargo test:
161 PASS / 4 pre-existing rep_fast_forward failures. wasm-pack: clean.

## 2026-05-01 — keyboard latch: port 0x60 holds break code until ISR services it

Three coupled bugs in the keyboard input path, all surfacing on
doom8088 because it's the only cart that hooks INT 09h directly
(replacing corduroy's stub). All fixed.

**Bug 1: zork "G" → "gg" (double-press).** `calcite-wasm::set_keyboard`
was calling both `state.bda_push_key(key)` AND `set_var("keyboard", k)`.
Once corduroy installed an INT 09h handler that also pushes to the BDA
ring, every press doubled. Fix: drop the wasm-side bda_push_key. The
cabinet's ISR is the single source of ring writes.
(`calcite-wasm/src/lib.rs::set_keyboard`.)

**Bug 2: doom "left arrow held forever".** Bridge's release path was
`setTimeout(() => set_keyboard(0), 100)`. The bridge worker lives in
build.html (background tab); Chrome throttles setTimeout in
background-tab workers to ~1Hz, so releases fired seconds late or
piled up. Fix: drive the release off the tickLoop counter (which uses
MessageChannel, immune to throttling). 3 batches ≈ 100ms wall but
bound to engine progress, not wall clock.
(`web/shim/calcite-bridge.js` v43-tick-driven-release.)

**Bug 3: Enter doesn't open the menu in demo loop.** This was the
real sink. `--_kbdPort60` returned the break code only on the *single
tick* the release edge fired:

```css
--_kbdPort60: if(
  style(--_kbdRelease: 1): --or(prevScancode, 128);
  else: scancode_or_zero
);
```

`_kbdRelease=1` for one tick (the transition); the IRQ pends in
`--picPending` but DOOM's ISR may not run until N ticks later (IF
gates, nested PIT IRQ, etc.). By then, port 0x60 returns 0, ISR sees
scancode 0, DOOM's "left held" flag never clears.

Fix: new state-var `--kbdScancodeLatch` holds the most recent
scancode (make on press, break on release) until the next edge. Port
0x60 reads the latch on non-edge ticks. Required three coupled
changes in Kiln:

1. `STATE_VARS` entry → `@property` decl + double-buffer rotation +
   `--__1kbdScancodeLatch` snapshot (otherwise the var never
   registers with calcite, get_state_var returns 0, and the latch is
   invisible).
2. `regOrder` entry + custom default expression mirroring port 0x60's
   edge logic.
3. Updated `_kbdPort60` to fall through to `__1kbdScancodeLatch`.

Verified via Playwright diagnostic: `_g_usergame` flips to 1 at
t=55.9 s — DOOM accepted "New Game" from menu.

Files: `kiln/template.mjs`, `kiln/emit-css.mjs`,
`kiln/patterns/misc.mjs`, `web/shim/calcite-bridge.js`,
`calcite-wasm/src/lib.rs`. Cabinet rebuild required. Snapshots
from before this date are invalidated (state-var ordering changed).

Cardinal-rule check: the latch is generic CSS-side keyboard-controller
modelling. Any cabinet whose CSS sets `--keyboard` and reads
`_kbdPort60` benefits — the rule is "scancode is level-readable
until the next edge", which is what real PC kbd hardware does. No
upstream knowledge encoded.

## 2026-05-01 — LoadPackedByte: euclid → bitwise byte extract

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-05-01.

## 2026-04-30 — FxHashMap swap: +25% ingame fps, −24% web level-load

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-30.

## 2026-04-30 — Web flamegraph: exec_ops dominates, hashing is 17%

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-30.

## 2026-04-30 — read_mem borrow-overhead fix: dead lead, reverted

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-30.

## 2026-04-30 — BIfNEL2 fusion: dead lead, off by default

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-30.

## 2026-04-29 — runtime op-adjacency profile (post-fusion truth)

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-29.

## 2026-04-29 — REP FFD: leave alone

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-29.

## 2026-04-29 — calcite: DiskWindow → WindowedByteArray rename

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-29.

## 2026-04-29 — load+compare+branch widening: dead lead, reverted

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-29.

## 2026-04-29 — fusion FFD: funnel data + verdict (dead end on this window)

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-29.

## 2026-04-29 — fusion FFD: framing + diag redesign

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-29.

## 2026-04-29 — bridge: hash-gated emit + 30Hz sampler

**Problem.** Web bridge claimed 20 fps (TARGET_MS=50, BMP/batch).
User-perceived rate doom8088 gameplay = ~1-2 fps. The other 18
paints/s were duplicates (~5-10 ms each: BMP alloc + transferable
post + browser BMP-decode + DOM put).

**Fix** (`web/shim/calcite-bridge.js` v41):

- Decouple paint cadence from tick loop. New setInterval at
  FRAME_SAMPLER_HZ=30 calls `maybeEmitFrame` independently of batches.
- Hash-gate emit. `maybeEmitFrame` computes FNV-1a over sparse 1KB
  rgba subsample, short-circuits when unchanged.
- Drop produced-frame adaptive batch sizing (didn't help). Fixed
  TARGET_MS=33ms, simple 0.5×/2×.

**Results** (doom8088, 60s LEFT, fusion OFF):

```
simulatedFps = 34.2  (vs native 35Hz)
vramFps      = 1.6   (cabinet's true visible-frame rate)
paintFps     = 2.1   (was 19.5 pre-hash-gate — 9× fewer dups)
```

Each gametic only renders one column strip; full visible frame builds
over many gametics → ~600 ms per fully-painted screen.

## 2026-04-29 — fusion disabled by default (net loss, investigation pending)

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-29.

## 2026-04-29 — fusion-sim: 88.6% body compose on doom column-drawer

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-29.

## 2026-04-29 — calcite-v2-rewrite Phase 1 lands

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-29.

## 2026-04-28 — calcite Phase 3 prototype: closure backend

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-28.

## 2026-04-28 — calcite Phase 2: recogniser substrate

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-28.

## 2026-04-28 — Load-time fusion: byte_period + fusion_sim

Calcite-engine work (incl. body-composition probe followup). Logged
in `../calcite/docs/log.md` 2026-04-28.

## 2026-04-28 — Replicated-body recogniser: built, dead lead

Calcite-engine work. Logged in `../calcite/docs/log.md` 2026-04-28.

## 2026-04-28 — XLAT segment-override fix (kiln correctness)

Kiln emitted `--_xlatByte` with DS hard-coded, ignoring 0x26 / 0x2E /
0x36 / 0x3E prefix. Doom8088 column drawer uses `ss xlat` twice per
pixel for SS:BX colormap (`i_vv13ha.asm`, `i_vv13ma.asm`,
`i_vv13la.asm`, `i_vegaa.asm`, `i_vmodya.asm`, `i_vcgaa.asm`) —
every textured pixel read from DS:BX+AL. Fix: use `--directSeg`
(override-or-DS) at `kiln/decode.mjs:362`.

Verified: smoke 7 carts green; Doom8088 reaches in-game on web
(`stage_ingame` tick 34.4 M, `runMsToInGame` 110 s); gameplay frame
correct. Title splash unaffected (V_DrawRaw, no XLAT).

Also rewired smoke list — small carts moved to `carts/test-carts/`
so harness was silently running only zork+montezuma; now all 7 fire.

## 2026-04-28 — 3 word-slot scheme

Kiln moves from **6 byte-slots → 3 word-slots** for memory writes.
Each slot carries `--_slotKWidth` (1 or 2): width=2 packs addr/addr+1
byte pair into one slot whose `--memValK` holds the un-split 16-bit
word. INT/IRQ frames (FLAGS+CS+IP = 3 words) fit new 3-slot worst
case exactly. `--applySlot` becomes 6-arg (loOff, hiOff, val,
width): aligned-word, byte, odd-addressed straddle splices.

Calcite recogniser (`packed_broadcast_write.rs` + parser fast-path)
updated to 6-arg shape; `CompiledPackedBroadcastWrite` gains
`width_slot`; `compile.rs`/`eval.rs` apply 1- or 2-byte writes per
port per tick.

| Cart    | 6-slot   | 3-slot   | Δ      |
|---------|---------:|---------:|-------:|
| dos-smoke (test) | 152.6 MB | 139.9 MB | −8.3% |
| zork1   | 299.6 MB | 274.7 MB | −8.3% |
| doom8088 | 341.7 MB | 316.9 MB | −7.3% |

Doom8088 stage bench:

| Stage         | 6-slot     | 3-slot     | Δ        |
|---------------|-----------:|-----------:|---------:|
| text_drdos    |  1 110 ms  |  1 083 ms  | −2.4%    |
| text_doom     |  3 751 ms  |  3 635 ms  | −3.1%    |
| title         |  9 524 ms  |  9 284 ms  | −2.5%    |
| menu          | 10 304 ms  | 10 024 ms  | −2.7%    |
| loading       | 13 655 ms  | 13 319 ms  | −2.5%    |
| **ingame**    | **90 995** | **85 323** | **−6.2%** |
| ticksToInGame | 35 000 000 | 35 000 000 | identical |
| cyclesToInGame| 397 458 534| 397 458 534| identical |

Same cycle/tick counts → CPU work identical; savings = per-tick CSS
eval. Level-load (loading→ingame, 29.5 M ticks): 77.3 s → 72.0 s =
−6.9%. Zork1 5M-tick: ~3% per-tick speedup, no per-cycle regression,
20% faster compile.
