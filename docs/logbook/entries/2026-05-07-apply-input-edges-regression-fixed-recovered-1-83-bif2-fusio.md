## 2026-05-07 - `apply_input_edges` regression fixed (recovered 1.83×); BIF2 fusion default-on

The user noticed the web player felt slower. Bisect (5M tick raw
bench on doom8088) located the regression at calcite commit
`a5e8eee` (input-edge recogniser, 2026-05-05): **162 K ticks/sec
post-merge vs 289 K pre-regression - a 44 % throughput cut.**
Bench detail in [`../calcite/docs/log.md`](../../../calcite/docs/log.md).

Cause: `apply_input_edges()` ran at the top of every tick doing
work proportional to the cabinet's input-edge count (59 on
doom8088). Per tick: 59 string allocations, 59 HashMap probes
for slot resolution, 59² acc-scans, plus 59 more HashMap probes
(each allocating two Strings) for `pseudo_class_active`. The
function comment claimed "Cheap when nothing is pressed" - both
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
   constructing the lookup key - no allocations on the
   nothing-pressed path.

Bench results:

```
                      doom8088 5M ticks   doom-loading 34M ticks
  pre-regression       289 K ticks/sec    (extrapolated ~120 s)
  pre-fix main         162 K ticks/sec    242 s
  post-fix main        297 K ticks/sec    161 s
                       (+1.83×)           (-33 %)
```

Cycles match across all configurations - same observable
behaviour. Smoke 7/7 PASS.

This puts doom-loading at 161 s (was 242 s pre-fix). Steady-state
in-game FPS not yet measured (still no profile for it), but the
161 s wall is comfortably ahead of the ship target.
