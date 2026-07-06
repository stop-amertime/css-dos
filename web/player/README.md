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
`/_kbd?key=kb-X[&holdmode=1]` and the service worker forwards it to
the bridge.

### Hold a key

Zero-JS constraint: one click can either flip page state (what CSS
can colour) or submit the form (what the bridge can hear) — never
both. So the two players implement hold differently, each fully
inside pure HTML+CSS:

- **Calcite player — hold mode.** **"Hold a key..."** is a label on a
  hidden checkbox (`name=holdmode`); while checked the button stays
  lit ("hold mode on") and the checkbox rides on every key
  submission. The *bridge* keeps the state: a press with `holdmode=1`
  latches the key (via `set_pseudo_class_active('checked',
  'kb-X-hold', …)`), pressing it again releases, pressing another key
  switches. Tap the button to exit the mode; a stale latch left
  behind (mode exited while holding, or a reload) is released by the
  next plain key press, which then types normally. The page can't
  know which key the bridge holds, so the held key isn't coloured —
  the machine's behavior is the feedback.
- **Raw player — one-shot catch.** raw-regen swaps the checkbox for a
  radio group (`#kb-holdmode` = armed, `#kb-nohold` = idle, injected
  per-key `#kb-X-hold` pins = held) and injects an invisible pin
  radio + release label into every key cell. Arming reveals the pins
  over their keys; the next press checks that key's radio — radio
  exclusivity un-arms in the same click — and the cabinet's
  `&:has(#kb-X-hold:checked) { --keyboard: V }` rule (Kiln emits one
  per key beside `:active`) holds the key directly. The held key is
  painted red; re-pressing it (its `.kb-unpin` label → `#kb-nohold`)
  releases. The styling for all of this sits inert in calcite.html's
  stylesheet; regen only adds the elements it selects on.

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
