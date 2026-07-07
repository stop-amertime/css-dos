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

### Hold a key (chords)

**"Hold a key..."** is a label on a hidden checkbox (`#kb-holdmode`,
`name=holdmode`); while checked the button stays lit ("hold mode on").
The checkbox is wired straight into the machine: the cabinet's
`&:has(#kb-holdmode:checked) { --kbdHold: 1 }` rule raises a second
keyboard wire, and while it is up the machine *suppresses key release
edges* — each released key's scancode is latched into one of eight
`kbdHeld*` state-var slots instead of delivering a break code. The
guest therefore sees makes without breaks: press LEFT then CTRL in
hold mode and the game sees both held at once — chords. Unchecking
the box drops the wire and the machine drains the slots back out as
break codes, one per keyboard-IRQ-idle tick (so the guest ISR keeps
up), releasing everything.

Because the hold state lives in the machine, both players get
identical behavior from identical markup — raw-regen does nothing to
the keyboard. In the calcite player the wire state rides along with
the next key submission (`/_kbd?key=kb-X&holdmode=1`) and the bridge
mirrors it onto the `checked` pseudo-class before pulsing the key;
consequences: toggling the mode takes effect at the *next* key press,
and the page can't colour held keys (it doesn't know which are held —
the lit mode button and the machine's behavior are the feedback). In
the raw player Chrome evaluates the `:has()` directly, so the wire is
live the instant the box is checked.

Details: `--keyboard` is still a single cascade-resolved value (one
key *transitions* at a time — fine, since holding is what the slots
are for); the slots cap at 8 held keys, duplicates allowed;
Shift/Ctrl stay usable as ordinary tap keys outside hold mode. Emit
side: `kiln/patterns/misc.mjs` `emitIRQCompute()` (latch/drain) +
`kiln/template.mjs` (wire + slots). Regression:
`web/tests/kbd-e2e.playwright.mjs` chords LEFT+CTRL in-game.

## Not to be confused with

Calcite's own browser frontend at `../calcite/web/` — that ships with
the calcite repo and exists for calcite's standalone demos. The player
here is the CSS-DOS-side runner that drives our cabinets.
