## 2026-05-05 — plan + initial cleanup: JS-free keyboard via `:active`

Captures the plan plus what landed today.

**Done in this session**:

- Architectural proof (`web/player/experiments/active-input.html` +
  `active-input-probe.mjs`) — verified `:root:has(.kb-XXXX:active)`
  propagates a custom property in raw Chrome via Playwright. 11/11
  assertions pass.
- Discovered the cabinet's CSS *already* emits the right rules
  (`kiln/template.mjs::emitKeyboardRules` writes
  `.cpu { &:has(#kb-X:active) { --keyboard: N } }` per kiln-side
  KEYBOARD_KEYS; `--keyboard` is declared as `@property`). The raw
  player (`web/player/raw.html`) already has matching `id=kb-X`
  buttons inside a `.cpu` wrapper. **The cardinal-rule path is
  already wired in raw.html.**
- Real-cabinet probe (`raw-keyboard-probe.mjs`) — load `raw.html`,
  stub `/cabinet.css` with the actual keyboard rules extracted from
  `doom8088.css`, drive mouse-down/-up on five keys, assert
  `--keyboard` on `.cpu`. 11/11 green.
- The calcite player (`web/player/calcite.html`) was missing
  `id=kb-X` on its `<a class="kb-key">` buttons. Added them so the
  same DOM surface that works in raw Chrome is exposed to calcite
  too. Comma/period/slash stay id-less — they aren't in
  `KEYBOARD_KEYS` (separate gap).
- Calcite-core: deleted the `0x500` keyboard literal in
  `crates/calcite-core/src/eval.rs::property_to_address`. Dead code
  in current cabinets (kiln declares `@property --keyboard`,
  `load_properties` registers it). Smoke suite (7 carts) passes
  pre and post deletion. See `../calcite/docs/log.md` 2026-05-05.

### The cheat being removed

Today's keyboard path:

1. Click `<a class="kb-key" href="/_kbd?key=0x1c0d" target="kbd-sink">`.
2. Iframe navigation triggers SW route `/_kbd`.
3. SW calls `engine.set_keyboard(0x1c0d)` on the wasm engine.
4. Engine writes guest memory `0x500` (BIOS keyboard slot).
5. Cabinet polls `0x500`.

Calcite's `eval.rs::property_to_address` has a hardcoded fallback:
`keyboard / __1keyboard / __2keyboard → 0x500`. That's a name-based
literal, violates the cardinal rule. But the deeper issue is that
the cabinet's CSS has *no path* into the keyboard slot — the only
input mechanism is the `set_keyboard` host call. Raw Chrome (no
calcite) can boot a cabinet but can't type into it. The CSS doesn't
pay for itself.

### The fix, in two layers

**CSS-DOS side (the actual fix):** kiln emits a small "input wiring"
section per cabinet:

```css
@property --kb_1c0d { syntax: "<integer>"; initial-value: 0; inherits: true; }
:root:has(.kb-1c0d:active) { --kb_1c0d: 0x1c0d; }
/* ... one rule per key ... */
:root { --keyboard: max(var(--kb_1c0d), var(--kb_1e61), …); }
```

The DOM elements are the existing `<a class="kb-key">` keyboard in
`web/player/calcite.html`. `:active` fires on mouse-down, reverts on
release. `:has()` propagates the active state to `:root`, so an
unrelated readout (or the cabinet's BIOS poll) reads `--keyboard`
via `var()`. Pure HTML+CSS, no JS on the page. Chrome runs it.

The `<a href>` + SW link route stays for the calcite path — it's a
JS-free way for a click to cross from the page into the host
runtime. The constraint is "no JS on the page", not "no SW".

**Calcite side (the recogniser, not a cheat):** at compile time,
walk the parsed assignment graph; for any RHS that depends on a
`:has(…:pseudo)` selector match, record an `InputEdge { pseudo,
class, slot }`. Expose to the host:

```
engine.input_edges() -> [{ pseudo, class, property_slot }]
engine.set_pseudo_class_active(pseudo, class, value)
```

The SW parses `class=` from the URL, calls
`set_pseudo_class_active("active", "kb-1c0d", true)` for the
press-hold window, then `false`. Calcite owns the matching
internally. The `0x500` literal in `property_to_address` deletes —
the cabinet's `@property --keyboard` declaration supplies the
address through the normal address map.

The recogniser is structural: any cabinet (6502, brainfuck,
non-emulator) that drives a property from `:has(...:active)` gets
the same treatment. No upstream knowledge.

### Architectural proof

`web/player/experiments/active-input.html` +
`web/player/experiments/active-input-probe.mjs` verify the CSS
mechanism end-to-end in headless Chrome via Playwright. All eleven
assertions pass: rest=0, hold-Enter→7181, hold-A→7777,
hold-B→12386, release→0, cross-key isolation. So the
`:root:has(...:active)` propagation reaches a `@property`-registered
custom property visible via `getComputedStyle`. Confirms the design
is feasible before any kiln/calcite work commits to it.

Run: `node web/player/experiments/active-input-probe.mjs`. Headed:
add `--headed`.

### Work remaining

The CSS-DOS-side cardinal-rule path is wired (kiln rules, raw.html
DOM, `--keyboard` propagation verified end-to-end). The literal
calcite cheat is gone (`0x500` deleted). What's still side-channel:

The SW link route writes `--keyboard` directly via
`engine.set_keyboard(scancode)`, short-circuiting the cabinet's
`:has(#kb-X:active)` rules entirely. Calcite-wasm doesn't currently
evaluate `:active` selectors; instead the host pushes the scancode in.
That's *legitimate host plumbing under the no-page-JS constraint* — but
the principled version is for calcite to recognise the
`:has(#kb-X:active)` shape and let the host flip the edge generically.

Phase B — calcite recogniser for `:has(...:pseudo)` edges:

1. Parser preserves `:has(…:pseudo)` predicates in the assignment
   graph (verify they aren't stripped today).
2. Compile-time pass enumerates `InputEdge { pseudo, class, slot }`
   triples; expose `input_edges()` on `CalciteEngine`.
3. Evaluator: when computing an assignment that depends on an
   input-edge pseudo-class match, consult host-supplied state
   (`set_pseudo_class_active` writes a per-edge bool); fall through
   to false otherwise.
4. SW link handler switches from `engine.set_keyboard(scancode)` to
   parsing `class=` from URL and calling
   `engine.set_pseudo_class_active("active", class, true)` with the
   release scheduled by the existing key queue (KEY_HOLD_BATCHES /
   KEY_GAP_BATCHES in `web/shim/calcite-bridge.js`).
5. Delete `engine.set_keyboard` once nothing references it.
6. Verify: doom8088 in calcite-wasm responds to on-screen button
   clicks identically to today; bench-doom-loading swaps
   `setvar_pulse` for click-driven input.

Polishing items:

- Add comma, period, slash to `kiln/template.mjs::KEYBOARD_KEYS` so
  those keys also work in raw Chrome.
- `web/player/calcite-canvas.html` uses `data-key="0xHHHH"` instead
  of `id=kb-X`; align with `calcite.html`/`raw.html` pattern if it's
  still in use.

### Scope notes

- Out of scope for now: physical keyboard support (`:active` is
  mouse-driven; physical keys would need a JS shim or a
  `<label for="checkbox">` + accesskey trick — separate question).
- Out of scope: chord/modifier support. Single-key-at-a-time first.
- Out of scope: `setvar_pulse` removal in general. The primitive
  remains useful for non-keyboard test inputs and watch actions;
  bench profiles just stop using it for keyboard once the new
  surface lands.
- The "calcite is generic" cleanup also covers (separately):
  delete `column_drawer_fast_forward` (off by default, net loss);
  move `summary.rs` out of `calcite-core` (diagnostic, x86-named);
  move `state::render_screen / render_framebuffer / CGA_PALETTE`
  into a `calcite-pc-video` crate or CSS-DOS-side adapter; strip
  doom/DOS comments from `calcite-core` non-test code; reframe
  `rep_fast_forward` as a generic CSS-shape recogniser (perf-gated
  mission, doom8088 web+CLI within 1 % of current).
