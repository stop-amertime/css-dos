# Cart format reference

A **cart** is the input to the CSS-DOS builder. It's either a folder or a zip
file containing a DOS program (plus optional data files and an optional
`program.json` manifest). The builder reads the cart and produces a
**cabinet** - a single `.css` file that, opened in Chrome or run through
Calcite, behaves like a tiny PC with the cart's program already booted.

This document is the canonical reference for what goes in a cart.

- Schema file: [`program.schema.json`](../program.schema.json) at repo root.
- Minimum viable cart: a single `.COM` file, or a folder with one `.COM`
  file and no `program.json`.
- The builder will infer defaults for everything unstated.

## The 30-second path

```
$ ls mycart/
BOOTLE.COM
$ node builder/build.mjs mycart/
Generated mycart.css (227.3 MB)
```

That's it. No `program.json` needed. You dropped one program, so the builder
autoruns it. You didn't specify a BIOS, so the builder picked the Corduroy
BIOS (the current default). You didn't specify memory, so the builder gave
you 640K.

If you need to change any of that, add a `program.json`.

### Even shorter: a bare `.com` is a cart

You don't need a folder at all. A single `.com` (or `.exe`) file path
is a complete cart on its own. The builder wraps it in a synthetic
one-file cart directory behind the scenes, applies the default preset
(`dos-corduroy`), and autoruns the program.

```
$ node builder/build.mjs ../calcite/programs/fire/fire.com -o fire.css
Generated fire.css
```

Useful for trying a random .COM without committing to a folder/manifest.
If you need any non-default - a different BIOS, extra data files on the
floppy, a specific memory size - you'll have to promote it to a folder
cart with a `program.json`. See [`builder/lib/cart.mjs`](../builder/lib/cart.mjs)
`wrapBareProgram` for the implementation.

## Cart structure

A cart is a flat folder (or a zip with contents at root). Files are
referenced by name, relative to the cart root. Escaping via `..` is
rejected.

```
mycart/
  program.json          (optional - everything defaults)
  BOOTLE.COM            (the program to run)
  README.TXT            (data file, goes on the floppy)
```

Zip carts look the same once unzipped:

```
mycart.zip
  ├─ program.json
  ├─ BOOTLE.COM
  └─ README.TXT
```

### Inferred defaults

When `program.json` is missing or sparse, the builder fills in:

| Field | Default |
|---|---|
| `preset` | `dos-corduroy` |
| `bios` | derived from preset (`corduroy`) |
| `memory.conventional` | `640K` for DOS carts; `autofit` for hack carts |
| `memory.gfx` | `true` |
| `memory.textVga` | `true` |
| `disk.mode` | `rom` |
| `disk.size` | `autofit` |
| `disk.writable` | `false` |
| `disk.files` | every non-`program.json` file in the cart folder |
| `boot.runCommand` | the single `.COM`/`.EXE` in the cart (name, no extension), or `""` (drop to prompt) if there are multiple |

## The manifest

```json
{
  "$schema": "../program.schema.json",

  "name": "Bootle",
  "version": "1.0.0",
  "author": "",
  "description": "Tiny heart-drawing demo",

  "preset": "dos-muslin",
  "bios": "muslin",

  "memory": {
    "conventional": "640K",
    "gfx": true,
    "textVga": true
  },

  "disk": {
    "mode": "rom",
    "size": "1440K",
    "files": [
      { "name": "BOOTLE.COM", "source": "bootle.com" }
    ]
  },

  "boot": {
    "runCommand": "BOOTLE"
  }
}
```

Every field is optional. A `program.json` that is just `{}` is valid and
equivalent to no `program.json` at all.

## Field reference

Each field is tagged with its **implementation state**:

- **implemented** - works today.
- **partial** - works in some configurations; the builder warns or errors
  clearly on unsupported combinations.
- **aspirational** - schema accepts it; the builder validates the shape
  but may error at build time until the feature lands.

### `name` · implemented

Human-readable cart title. Defaults to the cart folder (or zip) basename.
Used only in the cabinet's header comment.

### `version` · implemented

Semver string. Optional. Validated against `\d+\.\d+\.\d+` if present.

### `author` · implemented

Cart author. Unused by the builder. Preserved in the cabinet header.

### `description` · implemented

One-line cart description. Unused by the builder. Preserved in the cabinet
header.

### `preset` · implemented

One of `dos-corduroy` (default), `dos-muslin`, or `hack`. A preset is a
partial manifest checked into `builder/presets/` that the cart's own
fields override selectively. Presets exist so the common case is a
one-line manifest or no manifest at all.

### `bios` · implemented

Which BIOS to boot. One of:

| Value | Which BIOS | Source |
|---|---|---|
| `gossamer` | The hack-path shim BIOS - minimal handlers for running a lone `.COM`. | `bios/gossamer/` |
| `corduroy` | **The default BIOS** - the structured C BIOS; implements the IBM PC BIOS contract well enough to boot DOS, built modularly in C. | `bios/corduroy/` |
| `muslin` | The assembly DOS BIOS - same contract as Corduroy, hand-written in asm. Still available. | `bios/muslin/` |

See [`docs/bios-flavors.md`](bios-flavors.md) for details on each.

Combining `bios` with `preset`: the preset's BIOS is used unless the cart
overrides it. The only invalid combination the builder rejects is
`preset: "hack"` + `bios: "muslin"|"corduroy"` - the hack path boots
without DOS and expects Gossamer's handler layout.

### `memory.conventional` · partial

Size of conventional RAM, in bytes.

- Integer → exact bytes (minimum 1024).
- String → preset (`"4K"`, `"64K"`, `"128K"`, `"256K"`, `"512K"`, `"640K"`)
  or `"autofit"`.
- `"autofit"` means "smallest safe size for the program". On hack carts
  it sizes just big enough for the `.COM` plus stack headroom. On DOS
  carts it resolves to `DOS_TPA_BASE + programSize + stack + kernel high
  area` aligned up to 16 KB, clamped to [128 KB, 640 KB] - typically
  272–480 KB for small programs, `"640K"` for anything large.
- Note: the Corduroy BIOS places its init stack in a 64 KB window ending
  just below this value (see `patchBiosStackSeg` in `kiln.mjs`), so the
  minimum usable size is 128 KB.

### `memory.gfx` · implemented (DOS) · aspirational (hack)

Include the VGA Mode 13h framebuffer at linear `0xA0000–0xAFA00` (64 KB).
Default `true`. Set to `false` to shrink the cabinet if the program never
enters Mode 13h.

On hack carts the field is accepted but not wired through today. Follow-up.

### `memory.textVga` · implemented (DOS) · aspirational (hack)

Include the VGA text buffer at `0xB8000–0xB8FA0` (4000 bytes). Default
`true`.

On hack carts the field is accepted; hack carts always get the text
buffer today, regardless of the value. Follow-up.

### `input.mouse` · implemented (DOS + hack)

Default `false`. When `true`, the cabinet gains a Microsoft serial
mouse on COM1: an 8250 UART at `0x3F8` (IRQ 4) implemented in the
emitted CSS, answering the standard probe (RTS toggle → `'M'`) and
streaming 3-byte Microsoft-protocol packets, plus an 80×25 grid of
`#mc-N` cell selectors - the pointing surface. Pressing cell N
(`:active`, exactly like the `#kb-X` keys) drives the cursor to that
cell's centre and clicks there; a tap is move+click+release, a
double-tap a double-click. Both players supply the cells: the calcite
player as invisible overlay buttons over the screen (taps ride the
same `/_kbd` → bridge pulse path as keys), the raw player as real
buttons whose `:active` Chrome evaluates natively.

The player's hold switch (`#kb-holdmode`, the same control that
latches keyboard keys) also raises the mouse hold wire `--msHold`:
the first tap while it's up presses the button and KEEPS it down,
further taps drag with the button held, and toggling hold off
releases at the last position. That's press-drag-release from taps -
required for Windows 1.x menus, which only stay open while the
button is held (Hold Mode on → tap the menu title → tap the item →
Hold Mode off).

Guest software needs its own MS-serial-mouse driver - e.g. Windows
1.x MOUSE.DRV, which is what `carts/0windows101` bakes in. The
Corduroy BIOS advertises COM1 in the BDA (base word `0x400`,
equipment bits) so drivers can find it. Costs ~2000 input rules +
the UART/packet state machine per cabinet; carts without a mouse
consumer should leave it off.

Positioning note: Windows 1.01's CGA driver maps mouse deltas 2:1 on
both axes and starts its cursor at pixel (320,100) - the packet
machine tracks position in half-pixel "mickeys" and dead-reckons
from that measured start, so cell taps land pixel-exact without any
recalibration.

Pacing note: packets are spaced ≥120K CPU cycles apart
(`--msQuietUntil`, the genuine 1200-baud line rate ≈ 25 ms of guest
time - cycles, not ticks, because an idle guest's ticks are cheap
and a tick-counted gap would stretch to guest-seconds). Back-to-back
packets make the next packet's IRQ nest inside the guest driver's
still-running event handler, and Windows 1.x then queues button
events at the stale pre-move position (every click lands where the
PREVIOUS gesture pointed). Raw button transitions are queued
(`--msPendEdges`) and drained one per paced packet, so presses
shorter than the gap still deliver their full down→up train in
order. The calcite player's bridge paces tap hold/gap in cycles too
(~52 ms + ~31 ms guest) so double-click taps land inside Windows'
double-click window.

### `disk` · implemented

DOS carts have a `disk` object. Hack carts must set `disk: null` or omit
it entirely.

#### `disk.mode` · implemented

- `"rom"` (default) - disk bytes live outside 8086 memory, exposed through
  a 512-byte window at `0xD0000` dispatched by `--readDiskByte`. This is
  the path for everything except very small experiments.
- `"embedded"` - disk bytes baked into 8086 memory as a flat zone. Only
  works for tiny disks (must fit inside conventional memory without
  colliding with the kernel). See [`docs/hack-path.md`](hack-path.md) for
  details and why you'd almost never want this.

#### `disk.size` · implemented

Floppy size.

- Integer → exact bytes.
- String → `"360K"` (5.25" DD), `"720K"` (3.5" DD), `"1200K"` (5.25" HD),
  `"1440K"` (3.5" HD), `"2880K"` (3.5" ED), or `"autofit"`.
- `"autofit"` (default) rounds up to the smallest preset that fits the
  cart's files. (`boot.os: "msdos4"` carts default to `"720K"` instead.)

The builder resolves the size (`builder/lib/sizes.mjs`), derives the
CHS geometry, and patches it into the BIOS at build time. Standard
sizes also pick the canonical FAT media descriptor byte
(`builder/stages/floppy.mjs`).

#### `disk.sectorsPerCluster` · implemented

Minimum FAT12 cluster size, in 512-byte sectors. Power of 2, 1–128.
Default: smallest value that keeps the cluster count under the FAT12
cap (SPC=2 for a 2880K floppy). The builder still doubles it further
if needed to respect that cap.

Why you'd set it: DOS walks a file's FAT chain entry-by-entry on every
seek (and from the *start* of the chain on every backward seek). A
program that seeks around a large file - Doom8088 lump loads - spends
most of its I/O time stepping the chain. Raising SPC shortens chains
linearly: at 32 (16 KB clusters) a 1.5 MB file is ~94 links instead of
~1500. Cost: more slack per file (avg SPC×256 bytes), irrelevant on a
fixed-size image with few files.

#### `disk.writable`

When `true`, INT 13h accepts writes (Corduroy AH=03h; AH=04h verify).
The whole floppy image becomes shadow memory cells whose initial values
are the factory floppy - writes live for the lifetime of the tab, and
reloading resets to factory. Nothing persists across sessions.

Default `false`, and deliberately opt-in: the shadow adds one packed
cell per disk byte pair, growing the cabinet by roughly 120 MB per
360K of floppy and slowing calcite ticks ~2× on the writable cart.
Keep it off on game carts. Keep writable carts on ≤ 720K floppies -
see the precision note in
[`memory-layout.md`](memory-layout.md#writable-disk-diskwritable-landed-2026-07-06).
Gossamer and Muslin have no write path (writes vanish, adapter-ROM
style).

#### `disk.files` · implemented

Explicit disk contents. Each entry is `{ name, source }`:

- `name` - the 8.3 filename as it appears on the floppy (uppercased).
- `source` - path relative to the cart root.

If omitted, the builder auto-discovers: every file in the cart folder
except `program.json` is added, uppercased.

On `edrdos` carts, `KERNEL.SYS`, `ANSI.SYS`, `COMMAND.COM`, and
`CONFIG.SYS` are always added by the builder (the first three sourced
from `dos/bin/`, `CONFIG.SYS` synthesized from `boot.runCommand`).
You don't list these yourself - COMMAND.COM is always the shell, so
the program can EXIT back to a prompt, and an empty `runCommand`
drops straight to DOS. On `msdos4` carts the builder instead adds
`IO.SYS`, `MSDOS.SYS`, and `COMMAND.COM` from `dos/msdos4/bin/` and
synthesizes `AUTOEXEC.BAT` (see `boot.os`).

If the cart already supplies a `COMMAND.COM` (e.g. you're testing your
own shell, or running a bare `command.com` straight as a cart), the
builder skips the bundled one - duplicate root-dir entries break the
FAT12 lookup and DOS reports "Bad or missing command interpreter".

### `boot.os` · implemented

DOS carts only. Which operating system boots. Default `"edrdos"`.

- `"edrdos"` - the classic path: the builder preloads the EDR-DOS
  kernel at 0060:0000 and the BIOS jumps straight to it after POST.
- `"msdos4"` - real MS-DOS 4.00 (MIT-licensed, binaries + provenance
  in `dos/msdos4/`). No kernel preload; the BIOS instead issues
  **INT 19h** at end of POST, which reads the floppy's real boot
  sector (MSBOOT) to 0000:7C00 and jumps to it - the authentic
  MSBOOT → MSLOAD → IO.SYS → MSDOS.SYS → COMMAND.COM chain. The
  builder lays out IO.SYS/MSDOS.SYS as the first two root-dir
  entries (hidden/system, contiguous - MSBOOT requires all three),
  stamps the MSBOOT boot sector with the cart's real BPB geometry,
  and synthesizes `AUTOEXEC.BAT` (`@ECHO OFF` + `VER` +
  `boot.runCommand`) - its presence also skips DOS's date/time
  prompt. Requires the Corduroy BIOS (≥ 0.5.0); incompatible with
  `boot.ems` (the EMS driver is EDR-DOS-shaped). `CONFIG.SYS` is
  not synthesized in this mode; supply your own if you need one.
  Combine with `disk.writable` for a fully usable system (keep the
  floppy ≤ 720K - see `disk.writable`).

Regression gate: `node tests/harness/run.mjs msdos`.

### `boot.runCommand` · implemented

DOS carts only. The exact command line COMMAND.COM runs at boot.
`CONFIG.SYS` always emits `SHELL=\COMMAND.COM /P /K <runCommand>` - the
cart program never runs as the shell directly.

- `"DOOM -noxms -nosound"` → COMMAND.COM runs it, and you get a prompt
  back when it exits.
- `""` (empty) → plain `A:\>` prompt, nothing auto-runs.

Default: if the cart contains exactly one `.COM`/`.EXE`, its name
(without extension); otherwise empty.

> The pre-2026-04-27 fields `boot.autorun` / `boot.args` were removed;
> the builder rejects them with a migration hint. Fold both into the
> single `boot.runCommand` string.

### `boot.ems` · implemented

DOS carts only, default `false`. When `true`, load the fake EMS device
driver (`EMSDRV.SYS`) so programs that detect EMS via
`open("EMMXXXX0")` see it as present. Gates only - no real EMS pages.

### `boot.raw` · implemented

Hack carts only. Filename of the `.COM` to load raw at `0x100`. Mutually
exclusive with `boot.runCommand`. Required on hack carts.

### `display.cover` · implemented (website)

Boxart filename for the landing-page cart grid, e.g. `"doom-79.jpg"`
(covers are 700×900, 7:9 portrait).
Resolved by the site against its own boxart directory
(`web/site/public/assets/boxart/`) - it is **not** a path inside the cart
and never lands on the floppy. Presence of this field is also what opts a
cart **into** the featured landing grid: carts without `display.cover`
still build (via `/build` and the picker), they just aren't showcased on
the front page. The card's title and blurb come from the cart's own
`name` / `description` - the website holds no per-cart metadata of its own.
Ignored by the builder.

### `display.recommended` · implemented (website)

`true` puts a small gold "MY PICK" seal (the hero flair's wiggle
edge) on the cart's card in the featured landing grid.
Display-only; ignored by the builder. Currently set on
`carts/0windows101` only - it's meant to single out ONE cart, not to
be sprinkled around.

### `display.bullets` / `display.accent` · implemented (website)

The cover-less alternative to `display.cover`: an array of short lines
the site renders as a text card - the cart's `name`, the word "with:",
then the bullets - on the `display.accent` background colour (any CSS
colour; default `#0000AA`). Like `cover`, the presence of `bullets`
opts the cart into the featured landing grid. Both ignored by the
builder. (No cart currently uses a cover-less card - `carts/dos-shell`
did until it was superseded on the site by `carts/msdos4`.)

### `display.playTips` · implemented (website)

An array of strings shown as a dismissible "HINTS" toast on the site's
Play page when this cart is running - one paragraph per line, with
markdown links (`[text](url)`) rendered. Does **not** opt the cart into
the featured grid, and does not imply `cover`/`bullets`. Only carts
picked in the current session show tips (a cabinet restored from cache
after a reload has no cart metadata). Ignored by the builder.

### `display.vsyncMode` · aspirational

Which paint cadence the player should use when running this cart. One of:

- `"sim"` (default) - paint on the simulated 70 Hz vertical-retrace edge
  derived from the CPU cycle counter. This is the same clock the guest
  program sees when it polls port `0x3DA`, so tearing behaves like real
  hardware: a program that waits for retrace gets tear-free frames, a
  program that doesn't tears.
- `"wall"` - paint on wall-clock 70 Hz regardless of how fast the CPU is
  running. Smooth to the viewer but decoupled from the emulated beam.
- `"turbo"` - paint every eval batch, no throttling. For debugging.

The CPU-side decode of port `0x3DA` is always live (independent of this
field); the field only affects how often the canvas is repainted.

**Not yet plumbed.** Today the mode is picked by `?vsync=...` on the
player URL or the status-bar dropdown; this field records the cart's
preferred default so future builder/player wiring can pick it up.

## Presets in full

### `dos-corduroy` (default)

```json
{
  "bios": "corduroy",
  "memory":  { "conventional": "autofit", "gfx": true, "textVga": true, "cgaGfx": false },
  "disk":    { "mode": "rom", "size": "autofit", "writable": false },
  "boot":    {}
}
```

### `dos-muslin`

As `dos-corduroy`, but `bios: "muslin"`.

### `hack`

```json
{
  "bios":   "gossamer",
  "memory": { "conventional": "autofit", "gfx": false, "textVga": true },
  "disk":   null,
  "boot":   {}
}
```

## Examples

### Zero-config cart

```
bootle/
  BOOTLE.COM
```

No `program.json`. The builder infers everything. Equivalent to writing:

```json
{
  "preset": "dos-corduroy",
  "disk":   { "files": [{ "name": "BOOTLE.COM", "source": "BOOTLE.COM" }] },
  "boot":   { "runCommand": "BOOTLE" }
}
```

### Cart with a data file

```
zork/
  program.json
  FROTZ.EXE
  ZORK1.Z3
```

```json
{
  "preset": "dos-muslin",
  "boot":   { "runCommand": "FROTZ ZORK1.Z3" }
}
```

### Multi-program cart (drop to prompt)

```
shareware-pack/
  program.json
  GAME1.COM
  GAME2.COM
  GAME3.COM
```

```json
{
  "preset": "dos-muslin"
}
```

With multiple programs and no `boot.runCommand`, the builder defaults
it to `""` - the cabinet drops to the `A:\>` prompt. `carts/dos-shell`
(the featured "DOS Shell" utilities cart) is exactly this shape.

### Small hack cart

```
hello/
  program.json
  HELLO.COM
```

```json
{
  "preset": "hack",
  "boot":   { "raw": "HELLO.COM" }
}
```

### Explicit, over-specified cart

```json
{
  "$schema": "https://css-dos.dev/program.schema.json",

  "name":        "Bootle",
  "version":     "1.0.0",
  "author":      "Example",
  "description": "Heart-drawing demo",

  "preset": "dos-muslin",
  "bios":   "muslin",

  "memory": {
    "conventional": "640K",
    "gfx":          true,
    "textVga":      true
  },

  "disk": {
    "mode":     "rom",
    "size":     "360K",
    "writable": true,
    "files": [
      { "name": "BOOTLE.COM", "source": "BOOTLE.COM" }
    ]
  },

  "boot": {
    "runCommand": "BOOTLE"
  }
}
```

## Validation

The builder rejects on first validation error after printing every error
it finds. Specifically rejects:

- Unknown top-level or nested fields.
- `source` paths that escape the cart root.
- `preset: "hack"` combined with `bios: "muslin"|"corduroy"`.
- `preset: "hack"` with a non-null `disk`.
- `boot.raw` and a non-empty `boot.runCommand` both set.
- `boot.raw` on a non-hack preset.
- The removed `boot.autorun` / `boot.args` fields (migration hint
  points at `boot.runCommand`).
- `version` not matching semver.
- Aspirational fields with specific unsupported values (with a message
  pointing at the follow-up issue).

## The cabinet header

Every built cabinet's `.css` file starts with a comment block:

```
/* CSS-DOS cabinet
 *
 * Built from: bootle/
 * Built at:   2026-04-18T15:47:00Z
 *
 * Resolved manifest:
 *   { "preset": "dos-muslin", "bios": "muslin", ... }
 *
 * Disk layout:
 *   KERNEL.SYS   102400 bytes  (dos/bin/kernel.sys)
 *   CONFIG.SYS       35 bytes  (synthesized: SHELL=\COMMAND.COM /P /K BOOTLE)
 *   BOOTLE.COM     2048 bytes  (bootle/BOOTLE.COM)
 *
 * BIOS: Muslin BIOS, 1520 bytes
 * Memory zones: 0x00000–0xA0000 (640K), 0xA0000–0xAFA00 (gfx),
 *               0xB8000–0xB8FA0 (text)
 * Kiln:    <git sha>
 * Builder: <git sha>
 */
```

The header is always the resolved manifest after defaults are filled in,
not the original `program.json`. This means a zero-config cart still
produces a cabinet you can diagnose from its header alone.
