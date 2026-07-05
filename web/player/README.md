# player

Static HTML shells for running a cabinet in Chrome. No build step.

## Files

| File | What it is |
|---|---|
| `calcite.html` | The main player. Pure HTML + CSS, zero `<script>`. In CSS mode the cabinet evaluates itself; in Calcite mode the bridge worker posts framebuffer bitmaps for it to render. |
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

The keyboard is one GET `<form action="/_kbd" target="kbd-sink">`
(still zero `<script>`): each key is a submit button (`name=key
value=kb-X`), so a click navigates the hidden sink iframe to
`/_kbd?key=kb-X&held=…` and the service worker forwards it to the
bridge.

### Hold (pin) a key

Each key has a **pin checkbox** (`id="kb-X-hold"`, `name=held`) in the
same grid cell; the **Hold** toggle (pure-CSS checkbox + label) reveals
them. A checked pin marks the key held and styles it pressed
(`.kb-key:has(+ .kb-pin:checked)`).

- **Raw player:** the cabinet's `&:has(#kb-X-hold:checked)
  { --keyboard: V }` rule (Kiln emits one per key next to the
  `:active` rule) holds the key directly — the checkbox *is* the
  key-held state, no host involved.
- **Calcite player:** checked pins ride along on every key submission
  (repeated `held=` params). The bridge reconciles: pressing a pinned
  key latches it via `set_pseudo_class_active('checked','kb-X-hold',
  true)`; pressing it after unchecking the pin releases it. So the
  gesture is *toggle the pin, then press the key*.

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
