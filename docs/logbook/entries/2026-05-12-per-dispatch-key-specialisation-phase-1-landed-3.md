## 2026-05-12 — Per-dispatch-key specialisation phase 1 landed

Phase 1 of `docs/plans/2026-05-12-per-dispatch-key-specialisation.md`:
productise the probe's discovery logic into a compile-pipeline
diagnostic.

**Code.** New calcite module
`crates/calcite-core/src/pattern/dispatch_specialise.rs`. Three pub
functions, all purely structural (no name sniffing, no value
interpretation):

- `discover_hot_key(&[Assignment]) -> Option<HotKey>`
- `discover_key_value_set(&[Assignment], &str) -> BTreeSet<i64>`
- `rank_dispatch_keys(&[Assignment], usize) -> Vec<HotKey>`

Tie-break on (count, lexicographic name) for determinism.

Wired into `Evaluator::from_parsed` right after the optional
identity-prune block, gated on `CALCITE_SPECIALISE_DIAG=1`. Operates
on the **post-fast-path, post-topo-sort 147-assignment set** on
doom8088 — i.e. the surface specialisation will eventually transform,
not the parser's full 362K-assignment pre-filter view.

**10 unit tests pass** (empty input, no Single tests at all, single
key, multi-key with clear winner, tied keys (lexicographic break),
nested in Calc/FunctionCall, And/Or compound tests, value-set
correctness, value-set ignores non-literal RHS, rank-top-K
ordering).

**Diagnostic on doom8088:**

```
[specialise-discover] 0.00s — hot key = --opcode, count = 1615,
  distinct literal values = 232 (top 5: --opcode=1615, --reg=975,
  --mod=842, --rm=736, --_irqActive=39)
```

Matches the probe exactly (1615 SC tests on --opcode; 4× gap to the
5th-place key). 232 distinct literal values to specialise against —
fewer than the full 0..255 because some opcodes never appear in any
branch.

**Diagnostic across the smoke set** (hello-text, dos-smoke, zork1):
identical `--opcode=1615` result on all three, which is expected —
they share the same kiln-emitted CPU dispatch and differ only in
floppy data. Validates that key discovery is robust across cabinets.

**Gates cleared:**
- 10/10 dispatch_specialise unit tests pass.
- Diag fires when env var is set, silent when not.
- Smoke 7/7 PASS (dos-smoke, hello-text, cga4-stripes, cga5-mono,
  cga6-hires, zork1, montezuma) — no regression from the wiring.
- Diag cost: 0.00 s on doom8088 (sub-10ms HashMap walk over 147
  assignments).

**Pick up at phase 2.** Productise the probe's `specialise()` into
`crate::pattern::dispatch_specialise::specialise_assignments(&mut
[Assignment], &str, i64)`, with the 6 unit tests listed in the plan.
No runtime integration yet — pure Expr transformation.
