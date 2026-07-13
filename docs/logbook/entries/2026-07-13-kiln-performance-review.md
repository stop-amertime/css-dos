# 2026-07-13 — Kiln holistic perf review: recogniser-aware findings + small cleanups (branch)

Branch `claude/kiln-performance-review-tp2v46` (owner review before landing).
Full review: `docs/plans/2026-07-13-kiln-performance-review.md` — every kiln
shape cross-referenced against calcite's actual recognisers, findings labelled
with confidence, plus a "load-bearing shapes" list future kiln edits must not
break. Landed on the branch (sokoban 500K-tick fingerprint byte-identical,
REP diag healthy, smoke run — see plan's verification ledger): dead
`--leftShift`/`--int`/`--_shlCFidx*`/`--dispByte` deleted; prefix-path
short-circuits in `--segOverride`/`--hasSegOverride`/`--repType`
(849.8 → 842.0 ops/tick measured via `--op-profile`).
Key findings: (1) merged TF/IRQ `--_evt` wire measured −4.7% ops/tick but
**kills LoopDescriptor recognition** (top-level single-key hijacks family
extraction; rep iters 95,998 → 0) — needs a small generic calcite change
first, prototype reverted; (2) compound `style(A) and style(B)` guards can
never dispatch-table — single-key composite ModR/M keys are the biggest
kiln-side lever (est. 3-7%); (3) `--read2` misses LoadMem16 on packed
cabinets (calcite-side, est. 2-4%); (4) the one runtime `Op::Pow` lives in
the shift-by-CL flag functions (rare path, elegance fix).
