# CSS-BIOS splash in C — design

**Date:** 2026-04-14
**Status:** Design approved, pending implementation plan
**Owner:** TBD

## Summary

Replace the init portion of the assembly BIOS (`bios/css-emu-bios.asm`) with a
C implementation that (a) sets VGA mode 13h, (b) renders a splash screen with
the CSS-DOS logo and live-appearing POST lines, then (c) hands off to the DOS
bootloader. Existing assembly interrupt handlers (INT 08h/09h/10h/13h/16h/1Ah)
are preserved unchanged. This is the first concrete step on the logbook's
"Rewrite BIOS in C" workstream and the foundation for eventually reaching DOOM.

## Goals

- Visible BIOS-style splash when CSS-DOS boots, showing the logo and POST lines
- Establish the C + OpenWatcom toolchain for BIOS code
- Keep the existing assembly interrupt handlers working unmodified
- Minimum 2 seconds of splash before DOS bootloader takes over
- No regressions: DOS still boots to bootle.com after the splash

## Non-goals

- Porting interrupt handlers to C (separate future work)
- PIT / real timer support (separate workstream — see logbook)
- Keyboard-driven splash skip (explicitly dropped; boot time > 2s makes it moot)
- Cross-browser verification during development (calcite-only dev loop)
- Any changes to the DOS bootloader, kernel, or user programs

## Architecture

Hybrid asm + C layout in `bios/`:

```
bios/
  entry.asm          ; ROM entry at F000:FFF0. Sets seg regs, installs INT 13h
                     ; IVT entry, reads boot sector, calls bios_init, JMP FAR.
  bios_init.c        ; C entry — installs remaining IVT, BDA, calls splash_show.
  splash.c           ; mode 13h, palette, logo blit, text, POST lines, timing.
  splash.h
  font.c             ; 8x8 bitmap font: A-Z, 0-9, space, dash, period.
  font.h
  logo_data.c        ; Generated from tests/logo.bin — const unsigned char[1024].
  handlers.asm       ; Extracted from css-emu-bios.asm: INT handlers only,
                     ; init removed. Exports handler labels for IVT install.
  build.mjs          ; Orchestrates wcc/wasm/wlink, emits bios.bin.
```

`transpiler/generate-dos.mjs` consumes the new `bios.bin` instead of the
current asm-only output.

### Execution flow

Reality check from the existing `bios/css-emu-bios.asm`: the CSS-DOS
transpiler pre-loads `KERNEL.SYS` at `0060:0000`. The BIOS does not read a
boot sector — it just jumps to the kernel after init. Entry point is
`F000:0000` (`[bits 16] [org 0]`), not the reset vector.

```
Transpiler loads kernel at 0060:0000, starts CPU at F000:0000 (entry.asm)
  1. cli; cld
  2. Set SS:SP = 0030:0100  (matches current asm BIOS)
  3. CALL bios_init  (C function, small model, near call within F000)
        ├─ install_ivt()      — 32-vector table + fill rest with int_dummy,
        │                       plus overrides for INT 20h / INT 21h
        ├─ install_bda()      — equipment word, mem size, kbd buffer, video
        │                       state, timer, floppy state, warm boot flag
        ├─ splash_show()      — see splash.c below
        └─ return
  4. sti
  5. xor ax,ax; mov ds,ax
  6. mov bl, 0x00            ; boot drive A:
  7. JMP FAR 0060:0000       ; kernel entry (KERNEL_SEG from current BIOS)
```

### `splash_show()` sequence

```
set_mode_13h()                         ; INT 10h AX=0013
set_palette()                          ; program DAC regs 0-15 with CGA-16
blit_logo(40, 52, 3)                   ; 96x96 logo, 3x nearest-neighbor
draw_text("CSS-DOS",       160, 52, WHITE)
draw_text("CSS-BIOS v0.1", 160, 64, LIGHT_GRAY)
start_tick = read_bda_ticks()

for each post_line in [
    "IVT .......... OK",
    "BDA .......... OK",
    "Memory ....... 640K",     ; value read from BDA 0040:0013, formatted "%uK"
    "Keyboard ..... OK",
    "Video ........ OK",
]:
    draw_text(post_line, 160, 80 + 8*i, LIGHT_GRAY)
    wait_ticks(5)                      ; ~275ms each, ~1.4s total

wait_until(start_tick + 36)            ; enforce 2s minimum (36 ticks @ 18.2 Hz)
set_mode_text()                        ; INT 10h AX=0003 — back to 80x25 for DOS
```

## Components

### `entry.asm` (~25 lines)
- Positioned first in the linked output so `F000:0000` is the entry point
  (matches current asm BIOS's `[org 0]` layout)
- `cli; cld`
- `mov ss, 0x0030; mov sp, 0x0100` (same as current asm BIOS)
- `call bios_init` (small-model C ABI; near call within segment F000)
- `sti`
- `xor ax, ax; mov ds, ax; mov bl, 0`
- `jmp far 0060:0000` — kernel is pre-loaded at `KERNEL_SEG:0` by the
  transpiler, no boot-sector read required
- No disk read, no error halt path: failures in `bios_init` are either
  impossible (no dynamic state) or cosmetic (frozen PIT is handled inside
  `wait_ticks`). If something catastrophic happens in the splash the CPU
  will still reach the kernel jump; the kernel either boots or doesn't and
  that's detectable by existing conformance tests.

### `bios_init.c` (~100 lines)
Entry: `void bios_init(void);`

- `install_ivt()` — mirrors the current asm implementation:
  1. Fill all 256 IVT entries with `(F000, int_dummy)`
  2. Overwrite entries 0x00–0x1F with handler offsets from a static table
     matching the current `interrupt_table` in `css-emu-bios.asm:938`
  3. Overwrite INT 20h with `int20h_handler` and INT 21h with
     `default_handler`

- `install_bda()` — writes all fields the current asm sets (equipment
  word 0x0021, memory_size 640, keyboard buffer start/end/head/tail,
  video mode/columns/page size/cursor/page/port/rows/char height, timer
  ticks, floppy state, warm boot flag). Exact field list and values
  copied from the current asm at `css-emu-bios.asm:1037-1085`.

- Calls `splash_show()`.
- Returns to `entry.asm`, which then `sti` and `jmp far 0060:0000`.

Handler offsets are declared as `extern` symbols resolved by the linker
against `handlers.asm`, e.g.:

```c
extern void int08h_handler(void);
// ...
ivt[0x08].offset = (unsigned int)&int08h_handler;
ivt[0x08].segment = 0xF000;
```

For symbols that are far pointers in the linked ROM, we take their address
as a `unsigned int` offset within the F000 segment. The linker places all
handlers in the same segment as `entry.asm` / C code, so all offsets are
within F000:xxxx and a single `BIOS_SEG = 0xF000` constant is used for
every segment field.

### `splash.c` (~120 lines)
Public API:
- `void splash_show(void);`

Internal:
- `set_mode_13h()` — inline asm `int 10h` with AX=0x0013
- `set_palette()` — for i in 0..15: `outb(0x3C8, i); outb(0x3C9, cga[i].r>>2);
  outb(0x3C9, cga[i].g>>2); outb(0x3C9, cga[i].b>>2);` (6-bit DAC values)
- `blit_logo(x, y, scale)` — reads `logo_bin[i]` (1024 bytes), writes
  scale×scale pixel block to framebuffer at `0xA000:(row*320+col)` for each
  source pixel. Uses far pointer to segment 0xA000.
- `draw_text(x, y, str, color)` — for each char: look up 8 bytes in `font[]`,
  for each bit set in each row, write `color` to framebuffer. Unknown chars
  render as `?` for visibility.
- `wait_ticks(n)` — reads BDA 0040:006C, loops until it has advanced by `n`.
  Falls back to a ~100k-iteration timeout per tick so a frozen PIT doesn't
  stall forever (the logbook notes PIT is not yet wired up).
- `wait_until(target_tick)` — same mechanic, absolute target.
- `set_mode_text()` — inline asm `int 10h` with AX=0x0003

### `font.c` (~320 bytes of data)
Static `const unsigned char font[NUM_GLYPHS][8]`. One byte per row, MSB = left
pixel. Glyphs: A–Z (26), 0–9 (10), space, dash, period, colon, slash (41 glyphs
× 8 = 328 bytes). Lookup maps ASCII code → glyph index via a small switch;
unknown chars fall through to the `?` glyph.

### `logo_data.c` (1024 bytes data)
```c
const unsigned char logo_bin[1024] = { /* generated from tests/logo.bin */ };
```
Generated by `tools/bin-to-c.py tests/logo.bin bios/logo_data.c logo_bin`.
Committed to the repo; regenerated manually if the logo changes.

### `handlers.asm`
Extracted from `bios/css-emu-bios.asm` with init code (IVT write, BDA setup,
far jump) removed. Exports each INT handler as a public label:
`INT08_HANDLER`, `INT09_HANDLER`, `INT10_HANDLER`, `INT13_HANDLER`,
`INT16_HANDLER`, `INT1A_HANDLER`. `bios_init.c` references these via
`extern unsigned int INT10_HANDLER;` etc., taking their address.

### Build pipeline
`bios/build.mjs`:
1. Run `tools/bin-to-c.py tests/logo.bin bios/logo_data.c logo_bin` if
   `logo_data.c` is older than `tests/logo.bin`
2. `wasm bios/entry.asm` → `entry.obj`
3. `wasm bios/handlers.asm` → `handlers.obj`
4. `wcc -ms -0 -s -zl bios/bios_init.c bios/splash.c bios/font.c bios/logo_data.c`
   → one `.obj` each
5. `wlink` with a linker directive file placing `entry.obj` at the ROM-end
   offset so `entry.asm:_start` lands at F000:FFF0; other objects linked
   below. Output flat binary as `bios/bios.bin`.
6. `transpiler/generate-dos.mjs` reads `bios/bios.bin` into the ROM region of
   the CSS output.

## Data flow

**Build time:**
```
tests/logo.bin (1024 bytes, CGA-16 indexed)
  → tools/bin-to-c.py → bios/logo_data.c

bios/*.c ─wcc──► *.obj ─┐
bios/entry.asm ─wasm─►  ├─ wlink ─► bios/bios.bin
bios/handlers.asm ─wasm─┘

bios.bin + disk image → transpiler/generate-dos.mjs → *.css
```

**Run time:** see "Execution flow" above.

## Error handling

Real-mode ROM code with no OS below. Philosophy: fail loud and halt.

- **Disk read failure in entry.asm:** retry 3x. On persistent failure,
  `halt_with_error` prints "BOOT FAIL" via INT 10h teletype and `cli; hlt`.
- **Mode 13h / palette / framebuffer writes:** cannot meaningfully fail in
  our emulator. No checks.
- **Unknown font glyph:** render `?`. Makes bugs visible.
- **BDA tick counter not advancing** (PIT not yet wired): `wait_ticks` has a
  ~100k-iteration timeout per tick so the splash completes rather than
  hangs. Net effect: on a frozen PIT, splash appears fast; real PIT gives
  correct pacing.
- **No null pointers, no dynamic allocation, no recursion.** Stack sized
  generously (~2KB) in entry.asm; not at risk of overflow.

Explicitly not handled: logging, graceful degradation, partial boot recovery.

## Testing

### Phase 1 — visual/manual (during development)
1. **Calcite debugger:** build CSS, run through calcite, view splash via
   debugger's framebuffer dump. Sole source of visual truth during dev.
2. **JS reference emulator:** extend or add `tools/ref-c-bios.mjs` for fast
   iteration on C changes without the full CSS build cycle.

Chrome verification is skipped for this feature. The cardinal rule ("Chrome
is source of truth") still applies to the project — if the splash ever
breaks in Chrome, that's a real bug — but Chrome is not part of the dev
loop for this workstream.

### Phase 2 — framebuffer snapshot test (once splash is finalized)
New tool: `tests/bios-splash-snapshot.mjs`.

- Runs CSS through calcite for N ticks (enough to complete splash + mode
  switch back to text)
- At a designated "splash peak" tick (just before `set_mode_text`), dumps
  64000 bytes from 0xA0000 plus 48 palette bytes
- Compares against `tests/golden/splash-frame.bin` (64048 bytes total,
  committed)
- On mismatch: writes `splash-frame.actual.bin` and a PNG diff
- `--update` flag regenerates the golden from the current calcite run

### Phase 3 — conformance integration
- Add `splash-boot` case to `compare.mjs` — CSS vs JS reference must agree on
  register/memory state through the splash window
- Pixel correctness remains the snapshot test's job; conformance verifies
  calcite matches the reference

### Not tested
- Unit tests for `blit_logo` / `draw_text` in isolation (covered by snapshot)
- Precise timing (2s minimum is approximate)

## Open questions

None at design time. Implementation plan will surface concrete sub-tasks
(OpenWatcom install, linker directive shape, exact font glyph set, etc.).

## Risks

- **OpenWatcom setup on Windows:** installing and getting `wcc`/`wasm`/
  `wlink` invokable from the build script is a first-time activity. Plan
  includes a validation step (hello-world C → ROM → boot) before any splash
  code.
- **Linker positioning:** getting `entry.asm:_start` to land exactly at
  F000:FFF0 with other code packed below requires a correct `wlink`
  directive file. Plan includes verifying via hex dump of `bios.bin`.
- **C ABI mismatch with asm:** small model `wcc` uses near calls; `entry.asm`
  must match. Call convention verified by the hello-world milestone above.
- **IVT install ordering:** entry.asm installs INT 13h before the disk
  read. Other handlers installed in C — so if C code itself triggers an
  interrupt (e.g., INT 10h for mode 13h) before `install_ivt` runs, we'd
  use the default ROM vectors. Fix: `install_ivt` runs first in `bios_init`,
  before `splash_show`. Documented above in the execution flow.

## Alignment with existing workstreams

- Logbook "What's next" item 4: "Rewrite BIOS in C". This spec is scope A of
  that item (init only; handlers stay in asm).
- Logbook reference: OpenWatcom was already chosen as the target toolchain.
- No impact on items 1-3 (INT 13h hard disk rejection, PIT timer, more
  programs) — those remain independent.
