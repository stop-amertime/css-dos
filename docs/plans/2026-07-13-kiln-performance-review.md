# Kiln holistic performance & elegance review

Date: 2026-07-13. Branch: `claude/kiln-performance-review-tp2v46` (NOT
on master — owner review requested before landing anything).

Method: read all of `kiln/` end-to-end; mapped calcite's actual shape
recognisers (function-body classifiers in `compile.rs:2288-2453`,
dispatch recognition in `dispatch_table.rs`, chain building
`compile.rs:5304`, loop descriptors `pattern/loop_descriptor.rs`);
cross-referenced every hot emitted shape against what calcite can and
cannot collapse; validated the two cheapest changes empirically with
calcite-cli `--op-profile` A/B on a fresh sokoban cabinet (500K-tick
boot window, state fingerprint = cycles+IP at end of run).

Baseline (sokoban, ticks 0-500K): **849.8 ops/tick**, of which
BranchIfNotEqLit 22.1% (188/tick), LoadState 14.4%, LoadLit 11.5%,
LoadSlot 11.1%, DispatchChain 6.2%, Jump 4.7%, LoadPackedByte 3.1%.
Probe/branch machinery ≈ 34%, pure data movement ≈ 37%. This matches
the doom8088 profile in calcite's log (2026-06-09/10) — the review
below targets the probe third; the movement third is calcite's
copy-elim / per-dispatch-key territory, not kiln's.

## Ground truth about calcite recognition (verified in source)

Facts that shaped every judgement below; they correct a few
assumptions floating around:

- `--bit` / `--rightShift` / `--lowerBytes` bodies compile to **single
  native ops** (`Bit` / `Shr(Lit)` / `And(Lit)`) even with a variable
  exponent — `pow(2, var)` inside those *exact whole-function body
  shapes* is fine. The helpers are NOT a per-call cost. (Runtime `Bit`
  ≈ 10/tick, all cheap.)
- `pow(2, var)` anywhere ELSE compiles to a generic runtime `Op::Pow`
  (integer `wrapping_pow`). It exists in exactly one place we emit:
  the shift-by-CL flag functions (finding E).
- Compound conditions `style(A: x) and style(B: y)` can **never**
  become a DispatchTable (`dispatch_table.rs:38` bails on the first
  compound branch). With all-literal tests they compile to chained
  `BranchIfNotEqLit` on *different slots*, which the chain pass also
  cannot collapse (same-slot only). This is the single biggest
  structural cost kiln controls (finding B).
- `if(style(--k: N): …)` chains of ≥4 branches on ONE property with
  literal values → DispatchTable (HashMap ~30ns) or DispatchFlatArray
  (literal results, one array index). 2-5 branches on one property →
  dense flat chain (range ≤ 256 and ≤ 3× count) → one DispatchChain op.
- `--read2`'s body fails the word-read fast path on packed cabinets:
  `is_word_read_pattern` requires the inner `--readMem` to be a *pure
  identity* dispatch, and ours is near-packed (`mod`/`round` arms). So
  every 16-bit read compiles to ~8-10 ops instead of one `LoadMem16`
  (finding D — a calcite-side fix).
- The rep fast-forward LoopDescriptor keys on precise structural
  anchors (top-level dispatch family reachable through the TF/IRQ
  wrapper's `else`, IP body `self − X` / `self + lit`, counter
  `max(0, self − step)`, pointer `lowerBytes(self + k − bit(flag)*2k,
  mod)`, `-1` write-address sentinel, per-key `var(X) + K` cycle
  member). See "load-bearing shapes" at the bottom — several
  innocent-looking kiln refactors would break it, one measurably did
  (finding A).

## Landed on this branch (measured, boot-state-identical)

Commit on this branch; verified: rebuilt sokoban, 500K ticks →
cycles 6,620,618 / IP=1231 **identical to pre-change baseline**, rep
fast-forward healthy (95,998 iters elided, same as baseline).

1. **Dead code deleted.** `--leftShift` and `--int` were emitted into
   every cabinet and never called by any pattern (the D3 shifts use
   `--_pow2CL` directly). `--_shlCFidx16/8` were computed every tick
   and read by nothing (the flagsN functions compute the CF index
   internally). `--dispByte` was an unused alias of `--q2`. Measured:
   −2 Sub, −2 Max per tick + ~35 lines off every cabinet.
   *Note: the checked-in anatomy JSON under `web/site/public/anatomy/`
   snapshots the old css-lib and will be stale until regenerated.*

2. **Prefix-path short-circuit** (`decode.mjs`): `--segOverride`,
   `--hasSegOverride`, `--repType` each gained a leading
   `style(--prefixLen: 0): 0;` arm. On the ~90% of ticks with no
   prefix these chains now cost 1 probe instead of walking 4-8
   compound branches. Prefixed (REP/override) ticks pay +1 probe.
   Chrome sees the same values by construction (all three previously
   fell through to `else: 0` when no prefix was present).

   Measured (1+2 together): **849.8 → 842.0 ops/tick (−0.9%)**,
   state-identical. Small but free, and the win grows on
   prefix-light workloads.

## Proposals, highest expected value first

Confidence labels: *mechanism* = how sure I am the reasoning is right
(verified against calcite source / measured); *impact* = how sure I am
of the size of the win.

### A. Merged interrupt wire `--_evt` — prototyped, measured, REVERTED (blocked on a calcite recogniser change)

Every register/write-slot dispatch is wrapped
`if(style(--_tf:1): …; style(--_irqActive:1): …; else: <dispatch>)` —
two probes on two *different* properties × ~45 dispatched properties
per tick. Replacing both keys with one precomputed wire
(`--_evt: if(style(--_tf:1):1; style(--_irqActive:1):2; else: 0)`)
makes each wrapper a dense same-key pair that chain recognition
collapses.

**Measured: 842.0 → 802.3 ops/tick (−4.7%); BIfNEL 191 → 102/tick.**
But the run diverged (cycles 6.62M → 5.75M at 500K ticks) because
**rep fast-forward died completely**: `CALCITE_REP_DIAG=1` shows
`no-descriptor: 50000/50000` bails and 0 elided iters (vs 95,998).
Cause: the wrapper became a *strict single-key* top-level
StyleCondition on `--_evt`, so `extract_single_key_dispatch`
(loop_descriptor.rs:655) stops there instead of descending into the
`else` to find the `--opcode` family — the family collection is
hijacked and no loop descriptor is ever built.

**Required calcite change (generic, cardinal-rule-clean):** when the
top level is single-key but its `else` fallback contains a *larger*
single-key dispatch, prefer the key with more literal branches (or
recurse and take the max). A calcite engineer staring at CSS shape
alone would derive this ("dispatch family = the dominant key by branch
count, wrappers are whatever sits above it") — it generalises the
existing dominant-key tolerance. With that landed, re-apply the kiln
change (the exact diff is trivial to reconstruct: one `--_evt` wire in
`emitIRQArbitration` + keying the wrapper and the 4 interrupt-frame
branch sites on it).

- Mechanism: **high** (measured both the win and the breakage).
- Impact: **high** confidence in ~4-5% ops/tick; ~2-4% web t/s.
- Cost: small kiln diff + small calcite recogniser extension + full
  A/B re-verification (byte-identical fingerprint + REP diag + smoke).

### B. Single-key ModR/M dispatch keys (kill the compound-guard tax)

The inner bodies of ModR/M opcodes are compound-guard chains:
`style(--mod: 3) and style(--rm: r)` (ALU/MOV register writeback),
`… and style(--reg: s)` (groups 80/81/83, F6/F7, FE/FF, D0-D3, 8C) —
2-3 probes per branch, 7-16 branches per entry, never table-able
(verified: compound → no DispatchTable, cross-slot → no chain).

Proposal: precompute single-key composites in decode, e.g.

    --_rmReg: if(style(--mod: 3): var(--rm); else: -1);
    --_rmRegOp: if(style(--mod: 3): calc(var(--reg) * 8 + var(--rm)); else: -1);

(`--_rmRegOp` needs @property registration or an if()-shaped
definition so its computed value is a plain integer token — same
consideration as `--_dskOffN`.) Then group/shift entries become
`if(style(--_rmRegOp: K1): …; style(--_rmRegOp: K2): …; …)` — ≥4
literal branches on ONE key → DispatchTable/flat array: one lookup
replaces 14-48 probes in the taken entry. Chrome also wins (one
style() query per branch instead of three).

Caveats: (i) these keys must NOT become the *top level* of a
register's property (finding A's lesson) — they live inside per-opcode
entry bodies, under the `--opcode` dispatch, where family extraction
never looks; (ii) verify REP diag + byte-identical fingerprint after
each pattern-file conversion; (iii) the memory write-slot fusion
regexes (`tryFuseWordPair`) parse branch *conditions* textually —
converted branches keep cond-for-cond pairing, but re-check the fused
output on group FF/81/83.

- Mechanism: **high** (recognition rules verified in calcite source).
- Impact: **medium** — est. 20-60 ops/tick (~3-7%) depending on the
  hot-opcode mix (ModR/M opcodes dominate real code). Biggest single
  kiln-side lever after A.
- Cost: medium — touches most pattern files; mechanical but broad.

### C. Gate the always-computed decode preamble on class flags

`decode.mjs` computes per tick regardless of opcode: 4 string-op
bytes (`--_strSrcByte` etc. = 4 packed loads + address arith), 2
stack words (`--_stackWord0/2` ≈ 16-20 ops), signed IMUL/IDIV
operands + safe divisors (~12-15 ops), `--_xlatByte`,
`--_movAlMemByte`, `--_cmpDiff`/`--_repZF`. Rough total 50-80
ops/tick computed for instructions that run a few % of the time.

Gating each behind a cheap opcode-class flag
(`--_stackWord0: if(style(--_isPopf: 1): --read2(…); else: 0)`) makes
the untaken arm a skipped branch in calcite and lazily-unevaluated in
Chrome.

**Hard constraint:** do NOT gate `--_strSrcByte`/`--_strDstByte`
(and hi variants) without a calcite change — the rep applier's Copy
classification (`recognise_indirect_read`) requires the value
property's top-level assignment to BE a FunctionCall referencing a
pointer mirror; wrapping it in `if()` flips REP MOVS to
`Unsupported` → **panic** (fail-loud policy). Phase the work:
1. Gate only the rep-inert precomputes (stack words, IMUL/IDIV
   signeds, xlat, movAlMem): ~30-45 ops/tick, no recogniser contact.
2. String bytes only after calcite's indirect-read matcher learns to
   descend a StyleCondition gate (small, generic extension).

- Mechanism: **high** for phase 1 (no recogniser touches these
  shapes); **medium** for phase 2.
- Impact: **medium** — est. 4-6% ops/tick phase 1, +2-3% phase 2.
- Cost: small-medium; each gated property is an independent,
  A/B-able edit.

### D. (Calcite-side) word reads on packed cabinets → `LoadMem16`

`--read2` misses the `LoadMem16` fast path because our `--readMem` is
near-packed, not identity. Every word read — `--rmVal16` (mod≠3),
POP/RET/IRET/LES/LDS, IVT fetches, the two per-tick stack words —
pays ~8-10 ops for what could be 1-2 (two `LoadPackedByte` + shifts +
adds + the `--read2` call plumbing). Extending
`is_word_read_pattern` / adding a packed-backed `LoadMem16` variant
(recompose shape `mod(P,256) + round(down,P/256)*256` already exists
as `match_u16_recompose` for disk entries) is shape-generic.

- Mechanism: **high** (gap verified in `compile.rs:747-773`).
- Impact: **medium** — est. 15-30 ops/tick (~2-4%).
- Cost: calcite-only; zero CSS change; no cardinal-rule tension.

### E. The one true "inefficient bit-shift formula": `Op::Pow` in shift-by-CL flags

`--shlFlagsN16/8`, `--shrFlagsN16/8`, `--sarFlagsN16/8`
(`patterns/shift.mjs:357-417`) compute `pow(2, var(--n))` inline
(SAR twice). These bodies are multi-local so no body-shape recogniser
applies → the only *generic runtime `Op::Pow`* in the whole cabinet
(measured: 13.2K fires in the 500K-tick boot window). The per-tick
decode already computes `--_pow2CL` through the `--pow2` flat table —
pass it (and a precomputed `65535 − round(down, 65535/pow2CL)`
sign-fill if wanted) as extra arguments instead.

- Mechanism: **high** (measured the Pow fires).
- Impact: **low** globally (D2/D3 are rare) — this is a tail/elegance
  fix, not a throughput lever. Worth doing while touching shift.mjs.

### F. Redundant `round(down, x + 0.5)` wrappers in hot flag formulas

`flags.mjs` CF/AF terms use
`round(down, max(0, sign(...)) + 0.5)` — but `max(0, sign(...))` is
already exactly 0 or 1, so the `+0.5` and `round` are two dead ops
per term, identical results in Chrome (floor(0.5)=0, floor(1.5)=1).
Affects `--subFlags16/8` CF (every SUB/CMP/SBB tick) and the
ADD_AF/SUB_AF terms (every ADD/SUB/ADC/SBB/CMP tick).

- Mechanism: **high**; impact: **low-medium** (~1-3 ops/tick avg,
  more on ALU-heavy code). Trivial, safe, land with a fingerprint A/B.

### G. Fetch restructure: read q0-q5 directly at `ipAddr + prefixLen + N`

Today: 8 unconditional `--rawN` reads + 6 three-way muxes on
`--prefixLen`. Direct `--qN: --readMem(calc(var(--ipAddr) +
var(--prefixLen) + N))` keeps raw0/raw1 (prefix detection needs them),
drops raw2-raw7 and all six muxes. Same read count, minus the mux
chains: est. 15-20 ops/tick.

- Mechanism: **medium-high**; impact: **low-medium** (~2%).
- Risk: touches the shape every emitter depends on; the REP IP path
  reads `--prefixLen` — descriptor anchors unaffected (IP body shape
  unchanged), but full REP diag + fulldiff verification mandatory.

### H. Context: the structural levers are calcite-side

For scale: per-dispatch-key specialisation
(`2026-05-12-per-dispatch-key-specialisation.md`, probed at 90%+
StyleCondition collapse per specialised key) dwarfs everything above
on the dispatch third, and copy-elim already took the cheap slice of
the movement third. The kiln items here are complementary: A/B/C
shrink exactly the probe population that specialisation would
otherwise have to fold per-key.

## Elegance (no perf claim)

- `stackAddrMinus`/`spDecBy`/`spIncBy`/`sa(k)` are re-implemented in
  four files (`stack.mjs`, `control.mjs`, `group.mjs`, `misc.mjs`,
  `extended186.mjs` inlines them again). One shared helper module
  would also make the word-pair fusion regexes single-sourced.
- `mov.mjs` re-declares local `regOrder16`/`splitRegs` copies of
  `regs.mjs` `REG16`/`SPLIT_REGS`.
- `css-lib.mjs` XOR comment says "a ^ b = a + b - 2*a*b" but the code
  emits the (correct, recognised) `min(1,a+b) - a*b` form — comment
  should match the emitted shape since the shape is load-bearing for
  `classify_pair_combine`.
- The word-pair fusion in `emit-css.mjs` (`tryFuseWordPair`) matches
  `--lowerBytes(X, 8)` / `--rightShift(X, 8)` **textually**. It works,
  but it means "inline the helpers" style refactors silently unfuse
  word writes and can overflow the 3-slot budget. Documented here as a
  constraint; a structural (parsed) matcher would remove the trap.
- Pixel painter (+14.3 MB per cabinet, always emitted) still carries
  its open compile-cost assessment (STATUS item 3); the ~5-line build
  flag remains the escape hatch if compile-only regresses.

## Load-bearing shapes — do not change these casually

Verified against calcite source; breaking any of these either
silently deoptimises or (REP) panics:

1. TF/IRQ wrapper must NOT be single-key at the top level of a
   dispatched register property (family extraction hijack — finding A).
2. String-op IP body: `if(pred: calc(self − <bare var>); else:
   calc(self + <int lit>))` — subtrahend must stay a bare var
   (`--prefixLen`), advance must stay a literal.
3. CX under REP: exactly `max(0, calc(self − step))` in the else arm.
4. SI/DI update: `--lowerBytes(calc(self + k − --bit(flags, 10) * 2k),
   16)` — arity, the `2k`, and the modulus are all anchors.
5. Gated-off write addresses must keep the literal `-1` sentinel;
   addr/val `addMemWrite` pairs must stay adjacent (proximity pairing).
6. Every opcode keeps its `calc(var(--__1cycleCount) + K)` member
   (cycle-charge extraction; `CC_MOD`'s if() is fine for non-string
   opcodes).
7. `--and`/`--or`/`--xor` bodies: exactly 32 locals; `--not`: exactly
   16; combine terms exactly `a*b` / `min(1,a+b)` /
   `min(1,a+b) − a*b` / `1 − a` scaled by exact `2^i`.
8. `--lowerBytes`/`--rightShift`/`--bit` bodies: exact
   `mod(a, pow(2,b))` / `round(down, a/pow(2,b))` /
   `mod(<rightShift-shaped>, 2)` forms, zero locals.
9. Memory-cell write rules keep the `${idx} * ${PACK_SIZE}` un-folded
   arithmetic (parser fast-path Addr-hole templating) and the
   `--applySlot` cascade shape (packed broadcast recognition, ≥100
   cells, key families).
10. `--readMem` packed arms: exact `mod(mcN, 256)` /
    `round(down, mcN / 256)` extraction; function name ending in
    `readMem` (suffix check in the word-read matcher).
11. `--lowerBytes(X, 8)` / `--rightShift(X, 8)` value-pair text in
    `addMemWrite` calls (kiln's own fusion regexes).

## Verification ledger

- sokoban cabinet, calcite-cli, 500K ticks: baseline
  cycles=6,620,618 IP=1231; landed-changes build identical;
  `--_evt` prototype diverged (rep loss) and was reverted.
- op-profiles: 849.8 → 842.0 ops/tick landed; 802.3 with `--_evt`
  (recorded for the future paired change).
- REP diag: 95,998 iters elided baseline and landed; 0 with `--_evt`.
- `node tests/harness/run.mjs smoke` against the landed kiln changes:
  **6/6 PASS** (dos-smoke, hello-text, cga4-stripes, cga5-mono,
  cga6-hires, zork1; 106.5s).
- Not run (out of scope for a review branch): web bench medians,
  fulldiff, msdos/writable/windows gates. Required before any of
  this lands on master.
