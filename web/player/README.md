# player

Static HTML shells for running a cabinet in Chrome. No build step.

## Files

| File | What it is |
|---|---|
| `calcite.html` | The main player. Pure HTML + CSS except one 2-line auto-submit shim (see Hold a key below). In CSS mode the cabinet evaluates itself; in Calcite mode the bridge worker posts framebuffer bitmaps for it to render. |
| `calcite-canvas.html` | Calcite player variant rendering into a `<canvas>` instead of styled DOM nodes. Lower DOM cost when the bridge is producing many frames. |
| `raw.html` | The "theoretical" player. Mirrors `calcite.html`'s chrome exactly (it's **derived** from it by `web/scripts/raw-regen.mjs`) but replaces the `<img>` screen with a 320×200 = 64,000-element CSS pixel grid (`<i id=pN>`) and loads `/cabinet.css` as a real `<link rel="stylesheet">`. The cabinet's `kiln/pixels.mjs` rules paint each pixel from the Mode 13h framebuffer via `@function --paletteRGB()` over the live DAC — spec-correct for a compliant CSS evaluator. In practice Chrome crashes/hangs on the cabinet's (and grid's) sheer size; that's the point. Regenerate with `node web/scripts/raw-regen.mjs`. |
| `turbo-meter.html` | Pure-CSS player with a fast clock animation + Hz meter overlay. No bridge. |
| `bench.html` | Browser-side bench rig used by `tests/harness/bench-web.mjs`. Spawns the bridge worker, surfaces stage timings in a small JSON panel. |
| `serve.mjs` | Tiny standalone static server for ad-hoc `calcite.html` runs without the full dev server. |

## Running

The dev server (`node web/scripts/dev.mjs`) serves `/cabinet.css` from
the service worker's Cache Storage. Use `web/site/build.html` to build
or load a cabinet into the cache, then open whichever player variant
suits the task:

```
http://localhost:5173/player/calcite.html
http://localhost:5173/player/calcite-canvas.html
http://localhost:5173/player/raw.html
http://localhost:5173/player/turbo-meter.html
```

## Assets

| Path | What it is |
|---|---|
| `assets/player.css` | Keyboard grid + beveled button styling. |
| `fonts/` | DOS-era bitmap fonts (WebVGA etc.) for text-mode rendering. |
| `experiments/` | Throwaway player variants kept for reference. |

## Keyboard

Keys use stable IDs (`id="kb-a"`, `id="kb-enter"`, etc.) that match
the `:has(#kb-X:active)` selectors Kiln emits. HTML layout is free —
key order in the DOM does not need to match Kiln's `KEYBOARD_KEYS`
array.

The keyboard is one GET `<form action="/_kbd" target="kbd-sink">`:
each key is a submit button (`name=key value=kb-X`), so a click
navigates the hidden sink iframe to `/_kbd?key=kb-X&held=…` and the
service worker forwards it to the bridge.

### Hold a key

Gesture: press **"Hold a key..."**, then press the key — it latches
and turns red. Pressing the held key again (or the hold button, now
"release key") lets go.

The state machine is one hidden radio group (`name=held`):
`#kb-holdmode` = armed, `#kb-nohold` = idle, `#kb-X-hold` = key X
held. Arming turns every key's pin radio into an invisible catch
target covering it, so the next key press checks that key's radio —
and radio exclusivity clears the armed state in the same click. The
held key's invisible `.kb-unpin` label (`for=kb-nohold`) covers it,
so re-pressing it returns the group to idle. All pure CSS.

- **Raw player:** the cabinet's `&:has(#kb-X-hold:checked)
  { --keyboard: V }` rule (Kiln emits one per key next to the
  `:active` rule) holds the key directly — the radio *is* the
  key-held state, no host involved. Zero `<script>`.
- **Calcite player:** the bridge must hear about the latch at the
  moment of the catch click, but a radio flip doesn't submit a GET
  form — the one `<script>` in the player (an auto-submit shim,
  stripped from raw.html by raw-regen) submits the form on every
  hold-state change. Submissions always carry `held=kb-X` (or
  `held=` for none) and the bridge reconciles its latch to it via
  `set_pseudo_class_active('checked','kb-X-hold', …)`.

One key at a time: `--keyboard` is a single cascade-resolved value and
the cabinet's press/release edges fire only on 0 ↔ non-zero
transitions, so while a key is held other presses are invisible to the
machine (the bridge drops them; in the raw player the cascade eats
them). Chords (held Shift + another key) would need a second keyboard
wire in the cabinet — not built.

## Not to be confused with

Calcite's own browser frontend at `../calcite/web/` — that ships with
the calcite repo and exists for calcite's standalone demos. The player
here is the CSS-DOS-side runner that drives our cabinets.
