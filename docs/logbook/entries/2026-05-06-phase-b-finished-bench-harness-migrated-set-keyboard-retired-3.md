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
