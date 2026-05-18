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
