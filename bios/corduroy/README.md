# Corduroy BIOS

The **default DOS BIOS**: same IBM-PC-BIOS contract as Muslin, rewritten
in C (with just enough assembly glue for the entry stub and interrupt
handlers that need register-level control). Has a real INT 09h keyboard
handler and sends EOI on INT 08h/09h, so games that rely on BIOS
keyboard IRQ work here (they don't under Muslin).

## When to pick it

Default. `"preset": "dos-corduroy"` (or no preset at all) gives you
Corduroy. Drop to Muslin with `"bios": "muslin"` if a specific cart
misbehaves.

## What it implements

Everything Muslin does, plus a Mode 13h splash screen with the CSS-DOS
logo before it jumps to the kernel. The modular C layout (separate
`bios_init.c` / `handlers.asm` / `splash.c` / `font.c`) is designed to
absorb future work (PIT, PIC, real IRQs) more easily than Muslin's
monolithic assembly.

Since 0.5.0, two boot paths, selected by the build-time-patched
`boot_mode` byte ('BTMD' anchor in `handlers.asm`, patched by
`builder/stages/kiln.mjs`):

- `0` (default) - classic direct jump to the preloaded EDR-DOS kernel
  at 0060:0000.
- `1` (`boot.os: "msdos4"` carts) - real **INT 19h** bootstrap: read
  LBA 0 to 0000:7C00, verify 55AA, jump with DL=0. This runs the
  floppy's actual boot sector, which is how real MS-DOS 4.00 boots
  (MSBOOT → MSLOAD → IO.SYS → MSDOS.SYS → COMMAND.COM). INT 13h
  honours the ROM-BIOS register contract (AH=02h/03h preserve
  BX/CX/DX; CF returned via the stacked FLAGS) and AH=08h/15h fail
  for any drive but 0 - MS-DOS depends on all of it (see
  `CHANGELOG.md` 0.5.0).

### Keyboard (INT 09h / INT 16h)

Since 0.6.0, INT 09h is modifier-aware: Shift (2A/36), Ctrl (1D) and
Alt (38) make/break update the BDA shift-flag byte at `0040:0017`
(live via INT 16h AH=02h/12h) and are never buffered as key events.
Character keys translate through the flag-selected table - Shift gives
uppercase/US symbols, Ctrl gives control codes (Ctrl+C = 0x03, so the
DOS break shortcut works; Ctrl+Enter = LF, Ctrl+Bksp = DEL), Alt
buffers ASCII 0 with the scancode preserved. Break codes of normal
keys are dropped (the ring buffer wants makes only). Combos must
arrive via the player's hold wire (held modifier make, break deferred
to hold-off): simultaneous `:active` presses do NOT chord - the
`--keyboard` wire is single-valued and a second key's make edge never
fires while another key is down (verified 2026-07-07). Programs that
hook INT 9 themselves (Prince of Persia, Doom8088) read raw
make/break off port 0x60 and bypass the translation, but the same
one-wire rule applies to how their input arrives.

### Supported video modes (INT 10h AH=00h)

| Mode | Kind | Clear behaviour |
|---|---|---|
| 0x00 | CGA 40×25 mono text (remapped to 0x01) | 4 KB text buffer → spaces + black-on-white |
| 0x01 | CGA 40×25 colour text | 4 KB text buffer → spaces + black-on-white |
| 0x03 | CGA 80×25 colour text (default) | 4 KB text buffer → spaces + black-on-white |
| 0x04 | CGA 320×200×4 graphics | 16 KB CGA aperture → 0 |
| 0x13 | VGA Mode 13h 320×200×256 | 64 KB framebuffer → 0 |

Any other mode byte is silently remapped to 0x03. The raw requested
byte is shadowed to linear `0x04F2` so the JS renderer can surface
"unsupported mode" warnings without the BIOS needing to know about
player-side UI.

CGA mode 0x04 also needs `memory.cgaGfx: true` in the cart manifest so
the builder emits the 16 KB aperture at `0xB8000–0xBC000`. Programs
configure the palette via `OUT 0x3D9, AL` - kiln shadows that byte to
linear `0x04F3` for the renderer to pick up.

## Files

| File | Role |
|---|---|
| `entry.asm`    | Far-entry stub at `F000:0000`. Sets up stack, calls `bios_init`. |
| `handlers.asm` | IVT table + INT handlers in assembly. |
| `bios_init.c`  | IVT/BDA init, splash, jump to kernel. |
| `splash.c`     | CSS-DOS logo rendering in Mode 13h. |
| `logo_data.c`  | Logo bitmap (generated from `tests/logo.bin` via `tools/bin-to-c.py`). |
| `font.c`       | 8×8 VGA font table. |
| `link.lnk`     | OpenWatcom linker script. |
| `toolchain.env` | Tool paths (NASM, wcc, wlink, Watcom include dir). |
| `build.mjs`    | Orchestrates NASM + wcc + wlink into `build/bios.bin`. |

## Build

Requires NASM **and** OpenWatcom (`wcc`, `wlink`). See `toolchain.env`.

```
node build.mjs
```

Emits `build/bios.bin`. The top-level builder calls this automatically
when `bios: "corduroy"` is selected.

## Status

Corduroy is the default BIOS for DOS carts and boots the working cart
set (Doom8088, zork, Prince of Persia, the smoke set) end-to-end. What
is still outstanding is *formal* conformance validation: there is no
`ref-corduroy` reference emulator yet, so Corduroy hasn't been
diffed instruction-for-instruction against a known-good run the way the
hack path is. Until that lands, treat byte-exact conformance (as
opposed to "it boots and plays") as unverified.
