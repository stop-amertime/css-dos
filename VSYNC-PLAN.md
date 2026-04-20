# Vsync + paint cadence plan

**Status:** planning, 2026-04-20. See LOGBOOK for current session.
**Adjacent work:** `MODE13-QUEST.md` Blocker 2 (port 0x3DA decode) — this
plan absorbs that blocker and goes further.

## Origin

While investigating "pixels visibly scan across the screen during the
Mode 13h splash", we concluded the scanning is not an emulation artefact
and not a CSS/Calcite slowness artefact in the way we first suspected.
It's a *real* consequence of the player imposing a paint cadence on a
machine that doesn't have one.

Real 8086 + VGA hardware has no system-level "frame complete" signal.
The program writes bytes into `0xA0000` whenever it wants; the CRT
continuously reads VRAM at ~70 Hz and displays whatever is there. A
slow drawing routine on real hardware *does* produce visible scanning —
that's tearing, and it's what port 0x3DA + back-buffers exist to avoid.

Our player currently paints on a wall-clock batch cadence (~14 ms per
batch, adaptive batch size). That's neither "the CRT's clock" nor "the
program's clock" — it's an arbitrary third thing that guarantees we
see partial states whenever a batch lands mid-blit. This is basically
forcing tearing.

The right model:

1. **Simulate the hardware faithfully.** Decode port 0x3DA (vsync bit).
   Let programs that want tear-free display do what they always did:
   read 0x3DA, vsync-sync, `rep movsw` a back-buffer into VRAM.
2. **Make the player a CRT.** Paint on a fixed-rate vsync clock, not
   per wall-clock batch. Read VRAM once per frame, display it.
3. **Let the program do whatever it's going to do** between our paints.
   If it writes coherent frames (back-buffered, vsynced), we display
   coherent frames. If it writes per-pixel with no buffering, we
   display torn frames — the same failure mode a real CRT would show.

## The clock-domain choice

A CRT runs at 70 Hz of *something*. On real hardware, that "something"
is wall clock. On an emulator whose CPU runs at some fraction of real
8086 speed, we have a genuine choice between:

| Mode  | CRT runs at 70 Hz of... | What the user sees                              | Use case                               |
|-------|-------------------------|-------------------------------------------------|----------------------------------------|
| sim   | simulated CPU time      | Time-dilated but internally consistent          | Default. Programs look "correct" relative to themselves. |
| wall  | real wall clock         | What the program genuinely looks like, warts    | Demos. "Does this feel OK".            |
| turbo | every worker batch      | Maximum visibility into intermediate state      | Debugging "why isn't it drawing".      |

Neither sim nor wall is more "correct" — they're different valid views
of the same simulation. Turbo is approximately what we do today.

All three modes use the **same** 0x3DA decode — the port behaves
identically from the program's perspective (vsync bit toggles on a
cycleCount-derived schedule). The only thing that changes between
modes is **when the player repaints its canvas**.

## What we build

### CSS side (CSS-DOS)

1. **Port 0x3DA decode.** In `kiln/patterns/io.mjs` (or wherever port
   reads live), add a read handler for 0x3DA:
   - Bit 3 (vsync): `1` when `cycleCount mod CYCLES_PER_FRAME <
     RETRACE_CYCLES`, else `0`. A good starting cadence:
     `CYCLES_PER_FRAME = 68182` (4.77 MHz / 70), `RETRACE_CYCLES = 3409`
     (~5% of frame).
   - Bit 0 (display enable): `1` when **not** in retrace or hblank.
     Rough approximation: invert bit 3 for now. Some programs poll this
     instead of bit 3.
   - Other bits: 0.
2. **Conformance test.** A tiny program that polls 0x3DA in a loop and
   counts edges. Over N cycles, bit 3 should toggle N / CYCLES_PER_FRAME
   times. Place in `conformance/tests/vsync/`.
3. **Expose `--videoFrameNumber`.** A derived state address that
   equals `cycleCount / CYCLES_PER_FRAME`. The player worker reads
   this each tick-result. This is the "sim-mode vsync clock."
4. **`cart-format.md` + schema update.** New optional cart field:
   `display.vsyncMode` = `"sim" | "wall" | "turbo"`. Default `"sim"`.
   Informs the player's default paint mode; user can override.

### Player side

5. **Worker state output.** On every `tick-result`, include:
   - `videoFrameNumber` — read from the new state address
   - `wallTime` — `performance.now()` at message send
   - Existing `gfxBytes`, but **only when paint is needed** (see below).
6. **Paint-mode gate.** Main thread keeps `lastPaintedFrame` and
   `lastPaintWallTime`. Per mode:
   - `sim`: paint if `videoFrameNumber !== lastPaintedFrame`
   - `wall`: paint if `now - lastPaintWallTime >= 14.3` ms
   - `turbo`: paint always (current behaviour)
7. **Worker-side VRAM read gate.** Currently the worker
   unconditionally reads the 64 KB framebuffer and palette-expands.
   Move that work behind a "paint requested" flag from main thread to
   worker so non-paint batches are cheap.
8. **UI.** Dropdown next to canvas: `[sim ▼] [wall] [turbo]`. Also a
   readout showing `sim fps / wall fps` for educational value.
9. **URL param.** `?vsync=sim|wall|turbo` overrides cart default. Used
   for shareable demo links.

### Order of operations

Implement in this order so each step is independently testable:

1. 0x3DA decode + conformance test (CSS-DOS only, no player change)
2. `--videoFrameNumber` state address (CSS-DOS only)
3. Worker sends `videoFrameNumber` + `wallTime` on every tick-result
4. Paint-mode gate in main thread (sim mode only — use existing VRAM read)
5. Worker-side VRAM read gate (skip the read on non-paint batches)
6. Wall + turbo modes
7. UI dropdown + URL param
8. Cart-schema field + default resolution logic
9. Splash screenshots in all three modes, logbook entry

Steps 1–4 alone should visibly fix the splash scanning in sim mode.
Stop there if it's good and we'll pick up the rest in follow-up.

## What we're NOT building (yet)

- **Per-scanline accuracy.** The real CRT exposes horizontal retrace
  and actual scan position. Programs that race the beam (rare on Mode
  13h, common on CGA) would need this. Out of scope.
- **CRTC port emulation (0x3D4/0x3D5).** Page flipping, custom resolution.
  Out of scope per MODE13-QUEST.
- **Adaptive / dropped frames.** If sim mode is slower than wall,
  paint catches up naturally; no special "frame dropped" logic needed.
- **CSS/Calcite bulk ops (MemoryFill/MemoryCopy recognition).** The
  reason for this plan is that we think paint cadence explains most of
  the symptom. If sim-mode splash *still* looks bad because the CPU
  genuinely can't write pixels fast enough in one simulated frame,
  THEN we do the Calcite work. Not before.

## Success criteria

- Splash in sim mode: one coherent frame per simulated 1/70 sec, no
  visible scanning. Wall-clock speed depends on CPU emulation speed
  but each paint is a complete image.
- Splash in wall mode: paints at 70 Hz wall, shows whatever VRAM
  contains — which for the splash (no buffering) will be torn, and
  that's correct.
- Splash in turbo mode: matches current behaviour (for anyone who was
  relying on the maximal-visibility debug view).
- `in al, 0x3DA; test al, 8; jnz retrace_wait` loops behave correctly
  — the bit toggles, the loop terminates.
- Conformance test: edge count matches `CYCLES_PER_FRAME` derivation.

## Open questions

- **Default `CYCLES_PER_FRAME`.** 68182 (4.77 MHz / 70) matches a real
  8086's relationship to a real VGA. But our emulator doesn't pretend
  to run at 4.77 MHz in wall time. Does the sim-mode CRT feel right at
  68182 cycles per frame? If it feels too slow or too fast, we tune.
- **Who writes `cart.display.vsyncMode`?** Cart authors care about
  default presentation (e.g. "run this splash in sim mode"), but most
  carts won't set it and get the global default. OK to start.
- **Should turbo mode also gate VRAM reads by frame?** Probably not —
  turbo is explicitly "show me everything," so a per-batch read is
  what makes it useful. Keep it as-is.
