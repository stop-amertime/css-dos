# player

Static HTML shells for running a cabinet in Chrome. No build step.

## Files

| File | What it is |
|---|---|
| `calcite.html` | The main player. Pure HTML + CSS, zero `<script>`. In CSS mode the cabinet evaluates itself; in Calcite mode the bridge worker posts framebuffer bitmaps for it to render. |
| `calcite-canvas.html` | Calcite player variant rendering into a `<canvas>` instead of styled DOM nodes. Lower DOM cost when the bridge is producing many frames. |
| `raw.html` | The "theoretical" player. Mirrors `calcite.html`'s chrome exactly (it's **derived** from it by `web/scripts/raw-regen.mjs`) but replaces the `<img>` screen with a 320×200 = 64,000-element CSS pixel grid (`<i id=pN>`) and loads `/cabinet.css` as a real `<link rel="stylesheet">`. The cabinet's `kiln/pixels.mjs` rules paint each pixel from the Mode 13h framebuffer via `@function --paletteRGB()` over the live DAC — spec-correct for a compliant CSS evaluator. In practice Chrome crashes/hangs on the cabinet's (and grid's) sheer size; that's the point. **Fixed 2026-07-09:** clock and cpu used to share one element, letting `.cpu`'s animation shorthand cascade-clobber the clock's `anim-play` — machine frozen at tick 0 by construction. Now `.window` hosts `.clock`, `.window-body` hosts `.cpu` (nested, as the `@container style(--clock:)` gating requires), and the machine verifiably executes in Chromium (hello-text cabinet: cycleCount/IP advance, ~6 s of recalc per tick). Measured on doom8088: parse ~6 s, first tick ~5 min, then a permanent recalc backlog (see `experiments/huge-css-test.html`). Regenerate with `node web/scripts/raw-regen.mjs`. |
| `heartbeat.html` | Hidden-iframe SW keepalive: self-refreshes every 20s so each navigation is a fetch event and Chrome's ~30s service-worker idle-kill never fires — without it the screen/lamp multipart streams die (frame broadcasts are not SW events) and the player freezes for a user who just watches. Calcite player only (raw-regen strips it). |
| `turbo-meter.html` | Pure-CSS player with a fast clock animation + Hz meter overlay. No bridge. |
| `bench.html` | Browser-side bench rig used by `tests/harness/bench-web.mjs`. Spawns the bridge worker, surfaces stage timings in a small JSON panel. |
| `serve.mjs` | Tiny standalone static server for ad-hoc `calcite.html` runs without the full dev server. |

## Running

The dev server (`npm run dev`) serves `/cabinet.css` from
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
`/_kbd?key=kb-X` and the service worker forwards it to the bridge.

### Hold a key (chords)

The machine side is shared: the cabinet's
`&:has(#kb-holdmode:checked) { --kbdHold: 1 }` rule raises a second
keyboard wire, and while it is up the machine *suppresses key release
edges* — each released key's scancode is latched into one of eight
`kbdHeld*` state-var slots instead of delivering a break code. The
guest therefore sees makes without breaks: press LEFT then CTRL in
hold mode and the game sees both held at once — chords. The moment
the wire drops, the machine drains the slots back out as break
codes, one per keyboard-IRQ-idle tick (so the guest ISR keeps up),
releasing everything — no further input needed.

The page side differs per player (raw-regen swaps the control):

- **Calcite player:** the **"Hold keys"** button is a submit key like
  any other (`key=kb-hold`). The *bridge* owns the mode: each press
  toggles it and mirrors it onto the wire immediately, so turning the
  mode off releases all held keys right away. The page is script-free
  and holds no state; the lamp dot on the button is an `<img>` fed by
  the bridge's `/_screen/holdlamp` multipart stream (same mechanism
  as the screen) showing the machine's actual wire state — green =
  holding, black = off. The page can't colour individual held keys (it
  doesn't know which are held); the lamp and the machine's behavior
  are the feedback.
- **Raw player:** the button is a label on a hidden checkbox
  (`#kb-holdmode`) that Chrome wires straight into the `:has()` rule
  — live the instant the box is checked, lit via `:checked` styling.

Details: `--keyboard` is still a single cascade-resolved value (one
key *transitions* at a time — fine, since holding is what the slots
are for); the slots cap at 8 held keys, duplicates allowed;
Shift/Ctrl/Alt stay usable as ordinary tap keys outside hold mode.
Emit side: `kiln/patterns/misc.mjs` `emitKeyboardWires()` (latch/drain)
+ `kiln/template.mjs` (wire + slots). Regression:
`web/tests/kbd-e2e.playwright.mjs` chords LEFT+CTRL+ALT in-game and
asserts the mode-off drain needs no follow-up key press.

## Not to be confused with

Calcite's own browser frontend at `../calcite/web/` — that ships with
the calcite repo and exists for calcite's standalone demos. The player
here is the CSS-DOS-side runner that drives our cabinets.
