# 2026-06-16 - Phase 0: Doom ingame is dispatch-bound, not memory-bound; compiler road is viable

**FINDING.** Settles whether codegen can beat the interpreter on Doom8088
ingame, before reviving the archived compiler road. The v2 wasm rewrite
(`calcite/origin/archive/calcite-v2-rewrite`) was built, made bit-correct,
benchmarked **45× SLOWER** than the v1 interpreter (native), and its author
concluded the workload is *memory-traffic-bound* (→ codegen can't help).
Phase 0 tests that conclusion directly. **It is wrong: the workload is
dispatch-bound, and v2 lost for fixable architectural reasons.**

## Baselines (this machine, owner's X3D desktop)
- Real interpreter: **207K t/s / 0.95 fps** ingame, web doom-all 3-run median
  (`tmp/ingame-baseline-run{1,2,3}.json`); 13.54M ticks-to-ingame
  (deterministic). ~333K t/s native (calcite-cli).
- v2 backends (branch logs, native, doom8088): bytecode 332,940 t/s;
  v2-wasm 7,447 (45× slower); v2-walker 7,328; best v2 (closures) ~93K
  (3.4× slower). **Every v2 backend lost to the interpreter.**
- Host is throttled ~2.3× today (207K vs old laptop 478K, stable; a native
  probe that should take 6s burned 333+ CPU-s). Separate, near-free FPS.

## The hot region
Doom's ingame cost is the **column drawer** (mode13h vertical strips).
Authoritative semantics from calcite's deleted `column_drawer_fast_forward`
(`788389d^`, compile.rs:6597): body = **11 guest instructions / 21 bytes,
unrolled ≤16×**. Per body iteration: **2 memory reads** (texture xlat +
colormap ss:xlat) + **4 memory writes** (2× stosw) + **~5 trivial ALU**.

## Diagnosis question
Interpreter does ~3µs/tick. Is that the real work (memory - unfixable) or
dispatch/plumbing (~678 interpreted ops/tick to execute one guest
instruction - removable by codegen)?

## Results (probes in `tmp/phase0/`, run 2026-06-16)

**A. Hot-region WORK only** (`coldraw_probe.rs`, native; column-drawer body
over 3 memory backends, 300M bodies):

| memory backend | t/s | ×vs 333K native | ×vs 207K browser |
|---|--:|--:|--:|
| flat array (= wasm linear memory) | 8.33 B | 25,020 | 40,249 |
| flat + presence-check (v2 "Step 2b") | 8.51 B | - | - |
| **hashmap per access** (pessimistic) | **198 M** | **595** | **957** |

→ Even a hashmap-per-access backend is **595× the interpreter**. The work
is trivial (ns). The interpreter's cost is **not memory** - it is dispatch.

**B. Browser engine** (`coldraw_v8.mjs`, V8/Node, same loop over a
Uint8Array = wasm linear memory): **2.39 B t/s = 11,564× the browser
interpreter.** Headroom holds in the browser, not just native - closes
v2's "browser never tested" caveat.

**C. Interpret vs compile, identical work** (`dispatch_probe.rs`, native;
a match-dispatch interpreter walking the *measured* 678-ops/tick profile -
LoadSlot 28% / LoadLit 8% / dispatch-chain / few mem - vs the taken path as
straight-line code, 2M ticks):

```
INTERP  (678 ops/tick via match): 825,418 t/s   (1.79 ns/op)
CODEGEN (straight-line taken path): 701,016,474 t/s
speedup: 849×   (model interp = 2.48× of real 333K - same order, sane)
```

→ 849× is the **ceiling** (codegen folds 678-op plumbing → ~15 real ops).
The **floor** - compiling the 678 ops as-is, no folding, per-op cost
1.79ns→~0.4ns - is **~4.5×**. Realistic codegen sits between; both clear
the 3×-viable / 10×-commit gates.

## Why v2 lost 45× despite this headroom
Two architecture mistakes, both fixable, neither fundamental:
1. **v2's DAG walker evaluates the whole tick** (no branch-skip) → 7.3K t/s.
   The v1 interpreter branch-skips to just the executed instruction's ~678
   ops → 333K. v2 discarded the branch-skip that makes interpreting fast.
2. **v2's wasm crossed a wasmtime host boundary per memory read.** Flat
   linear memory = one `i32.load`, zero crossings (probe A proves it). v2
   also tried lifting RAM into linear memory and reverted it (−19%) because
   its per-read presence-check cost > savings - probe A(c) shows a *plain*
   flat read is free; the presence-check was the regression, not flatness.

## Verdict
**GO.** Ingame is dispatch-bound; codegen of a flat-memory, zero-crossing
op stream recovers the overhead. The winning shape is to **codegen the v1
branch-skipping op stream → wasm, slots + guest memory in flat linear
memory** - NOT v2's whole-tick DAG walker.

**Caveats.** (1) Numbers are the *hot region*; whole-frame ingame gain is
Amdahl-bounded by the column-drawer's share of a frame (dominant in
rendering, not 100%) - realistically a ~5–15× whole-game multiple, ~1 fps →
~5–15 fps. (2) Probes model the ideal compiled form (the Phase-0 mandate:
"what the compiler would emit if it understood this region perfectly"); a
real generic codegen captures the floor nearly for free, the ceiling only
with folding/specialisation. (3) Probes are throwaway, not shipped.

Cardinal-rule sign-off for IR→wasm codegen given by owner 2026-06-16
(compiler-mission.md open-Q#1). v2 code intact on the archive branch
(`dag/`, cherry-pickable onto main).
