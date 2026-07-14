# 2026-06-09 - FINDING: doomLoad re-weighted by ticks - EDR-DOS kernel is the lion (~49%); `__I4D` is ~22%, not 46%

Recomputed both weightings from the retained 2026-05-11 raw samples
(`tmp/sampler/load-window.csv`, window 4.6M–34M), cross-checked
against the tick-by-tick burst samples (immune to stride aliasing):
kernel CS=0x55 is **48.6% of ticks** (bursts: 49.7%), `__I4D` 22.3%
(22.0%), st_stuff 9.2%, r_draw 5.3%. Calcite wall cost is per
**tick** - every tick runs the same ~845-op dispatch - while guest
cycles weight DIV ~165 vs MOV ~3, inflating divide-heavy code. The
2026-05-11 "46% `__I4D`" headline picked cycle-weighting and called
tick-weighting an artefact; the bursts show no artefact existed.
Consequences: (1) routine-substitution payoff ceiling is ≤~22% of
doomLoad - plan deprioritised (correction note added to it);
(2) the untouched lever is the kernel file-I/O path - **platform
work, no cardinal rule**. Kernel time is flat loop bodies (~12% in
one ~35-byte loop at 0x55:0xAE9A–0xAEBD); resolve via edrdos map.
