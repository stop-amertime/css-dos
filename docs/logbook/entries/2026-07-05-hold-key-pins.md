# 2026-07-05 — Hold-a-key: per-key pin checkboxes (raw + calcite players)

Owner ask: hold keys (e.g. Shift) on the on-screen keyboard, with the held
key highlighted and un-holdable, working in theoretical CSS *and* calcite.
Mechanism: kiln now emits `&:has(#kb-X-hold:checked) { --keyboard: V }`
beside each `:active` rule (`kiln/template.mjs`); the player keyboard is a
script-free GET `<form>` — keys are submit buttons (`name=key`), each with
a pin checkbox (`name=held`, revealed by a Hold toggle, pinned key styled
pressed). Raw player: the checkbox holds the key directly in Chrome. Calcite
player: checked pins ride every submission; the bridge latches/releases via
`set_pseudo_class_active('checked', 'kb-X-hold', …)` — zero calcite changes
(its input-edge parser is pseudo-generic). Gesture: pin, then press the key.
Limit (both players): single `--keyboard` wire + 0↔nonzero edge detector =
one held key at a time, no chords; other presses are dropped while latched
(also avoids calcite's summed-overlap vs Chrome-cascade divergence).
Verified: Chromium test vs real emitted rules (pin→19200 sustained→0);
kbd-e2e extended with a hold phase; smoke gate. Legacy dev server got a
`/sw.js` → `site/public/sw.js` alias (broken since the 7-04 dedupe);
kbd-e2e now finds Chrome via CHROME_BIN/pw-browsers (Linux).
Docs: `web/player/README.md` §Keyboard. Follow-up idea (not built): second
modifier wire in the cabinet to enable Shift/Ctrl chords.
