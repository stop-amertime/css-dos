# Memory layout

A cabinet's "memory" is a sparse set of **zones**. Only addresses
inside a zone get a backing CSS property; reads outside zones return
0, writes are silently dropped.

## The zones, by default

For a DOS cart with all defaults (`"preset": "dos-corduroy"`):

| Zone | Linear range | Purpose | Controlled by |
|---|---|---|---|
| Conventional RAM | `0x00000–0xA0000` (640K) | IVT, BDA, kernel, program, stack | `memory.conventional` |
| VGA Mode 13h | `0xA0000–0xAFA00` (64000 B) | 320×200×256 framebuffer | `memory.gfx` |
| VGA text | `0xB8000–0xB8FA0` (4000 B) | 80×25 text buffer | `memory.textVga` |
| Rom-disk window | `0xD0000–0xD01FF` (512 B) | Dispatches to `--readDiskByte(idx)` | `disk.mode = "rom"` |
| BIOS ROM | `0xF0000+` | Read-only BIOS bytes | Always included |

For a hack cart (`"preset": "hack"`):

| Zone | Linear range | Purpose |
|---|---|---|
| Conventional RAM | `0x0000–<memory.conventional>` | IVT, BDA, .COM at `0x100`, stack |
| VGA text | `0xB8000–0xB8FA0` | Always included today (no knob yet - follow-up) |
| BIOS ROM | `0xF0000+` | Always included |

## The rom-disk window

Pre-rom-disk, a DOS cart's floppy was baked into 8086 memory as an
`embeddedData` zone. That put a hard ceiling on disk size (it had to
fit in 640K minus the kernel, ~200K in practice).

The rom-disk window breaks that ceiling. The disk bytes live **outside
the 8086 address space**. Reads to `0xD0000–0xD01FF` are dispatched to
a `@function --readDiskByte(--idx)` whose entries are indexed by a
linearised key `lba * 512 + offset`. The LBA register lives at linear
`0x04F0` (inside the BDA intra-application area 0x4F0–0x4FF, which no
real DOS component uses).

Muslin's `INT 13h` handler:
1. Writes the requested LBA word to linear `0x4F0`.
2. `REP MOVSW` 256 words from `D000:0000` to `ES:DI`.
3. LBA++, sector count--, loop.

Because reads all live on a single-parameter, dense, literal-only
dispatch, Calcite compiles it to a single `Vec<i32>` lookup via its
`DispatchFlatArray` op. The limit is Calcite's 10 M-entry span - about
10 MB of rom-disk. Bootle (tiny) and Zork+FROTZ (~284 KB) are well
within.

## The 0x4F0 pitfall

Old drafts described the LBA register as "BDA offset 0x4F0". That can
be misread as `BDA_SEG(0x40) * 16 + 0x4F0 = 0x8F0`, which lands inside
the kernel's code segment and would corrupt it.

The correct location is **linear 0x4F0**, reached as `0000:04F0`. It's
inside the BDA intra-application area (BDA 0x0F0–0x0FF when
segment-relative), which sits at absolute 0x4F0–0x4FF.

Future BIOS work touching INT 13h: use `xor ax, ax; mov ds, ax`
before addressing the LBA register. Don't use `BDA_SEG`.

## Platform registers: keep them inside 0x4F0–0x4FF

Kiln's memory-mapped platform registers all live in the BDA
intra-application area, **linear 0x4F0–0x4FF** - the only low-memory
range no real DOS component touches:

| Linear | Width | What | Direction |
|---|---|---|---|
| `0x4F0–0x4F1` | word | Rom-disk LBA latch (cell `--__1mc632`) | guest writes, kiln disk window reads |
| `0x4F2` | byte | Requested-video-mode shadow (Corduroy INT 10h AH=00h) | guest writes, host renderer reads |
| `0x4F3` | byte | CGA palette-register shadow (kiln `OUT 0x3D9`) | guest writes, host renderer reads |
| `0x4F4–0x4F5` | word | Keyboard bridge - guest reads return `--__1keyboard` | guest reads (Gossamer INT 16h) |

Each register owns its address exclusively - don't overlap a
write-shadow with a read-bridge even though their directions differ
(the aliasing is invisible until some new consumer reads the "wrong"
side).

The keyboard bridge lived at **0x500–0x501 until 2026-07-06**, and
that placement was a live bug: linear 0x500 is the start of the DOS
inter-application communication area, and MS-DOS's boot sector
(MSBOOT) hardcodes 0x500 as its root-directory sector buffer. The
guest wrote the dir sector there, but reads came back as keyboard
state (the readMem arms shadowed the RAM cells), so MS-DOS 4.00
failed with "Non-System disk" - on calcite only, since the JS ref
machine doesn't model the bridge. EDR-DOS never noticed for months
because it doesn't use 0x500. Anything memory-mapped outside
0x4F0–0x4FF is a collision waiting for a guest that uses that byte.

Related: Corduroy writes a halt flag to linear `0x504` on fatal
errors. That is a **write-only convention** - nothing reads it (the
`--halt` property is driven by the HLT opcode alone), so guest data
landing on 0x504 (as MS-DOS dir loads do) is harmless.

## Writable disk (`disk.writable`, landed 2026-07-06)

Opt-in per cart (`"disk": { "writable": true }`). The whole floppy
image becomes ordinary packed memory cells at `DISK_SHADOW_LINEAR =
0x200000` (outside the 1 MB guest space, same trick as the DAC
shadow). Cell `@property` initial values are the factory floppy, so
writes live for the lifetime of the tab and a reload resets to
factory. No cross-session persistence - deliberate v1 decision.

Mechanics (all in `kiln/emit-css.mjs`, gated on `writableDisk`):

- **Reads** - `--readDiskByte(idx)` arms stop being literals; each arm
  reads its shadow cell: `style(--idx: N): mod(var(--__1mc<C>), 256)`
  with `C = (0x200000 + N) / 2`. Every byte gets an arm (free sectors
  must read back after a write).
- **Writes** - per write slot, two derived props:
  `--_dskInN` (1 iff `memAddrN` is inside the 0xD0000 window) and
  `--_dskOffN` (`lba*512 + (memAddrN - 0xD0000)` inside, −1 outside).
  Disk cells run the normal `--applySlot` cascade keyed on
  `--_dskOffN` with **disk-local** cell indices; RAM cells keep
  `--memAddrN` untouched.
- **BIOS** - Corduroy INT 13h AH=03h mirrors AH=02h with the copy
  reversed (`REP MOVSW` into the window per sector, LBA++); AH=04h
  verify always succeeds.

**The 1e6 precision rule.** Chrome stores computed numeric custom
properties with only ~6 significant digits - any computed value
≥ 1,000,000 silently loses precision (verified in Chromium, LOGBOOK
2026-07-06; an idealised spec evaluator would be exact, but the
cardinal rule's reference is what Chrome actually computes). That is
why the shadow's high base appears only in property NAMES and literal
arm keys, never in a computed value: disk offsets (`--_dskOffN`,
`--readDiskByte` keys) stay < diskLen. Corollary: on disks over
~1 MB, reads/writes beyond byte index 999,999 are Chrome-imprecise -
a bound **shared with rom mode** (rom `--readDiskByte` keys are
`lba*512+off` too, and `--memAddrN` at DAC addresses ≥ 0x100000 has
the same exposure). Calcite evaluates these exactly either way. Keep
writable carts on ≤ 720K floppies to stay inside the
everything-agrees region.

Cost: one packed cell per disk byte pair - a 360K floppy adds ~184K
cells (~120 MB of CSS text; measured end-to-end the shadow costs
~0.42 MB of cabinet per KB of floppy). Game carts must leave
`writable` off. Second hard bound besides the precision rule:
**the whole cabinet must stay under ~536 MB** (V8's max string
length - Chrome silently fails to load anything bigger; STATUS
gotcha 2026-07-07). A 720K writable floppy already breaks this;
msdos4 ships 480K (custom geometry) for that reason.

## Conventional RAM sizing caveat

The schema accepts `memory.conventional` values below 640K on DOS
carts. In practice the EDR-DOS kernel relocates code to the top of
conventional memory, and values below 640K can stall or crash the boot
depending on where the kernel ends up. The builder warns, proceeds,
and lets you experiment. The safe value is 640K.

## What Kiln does with all this

Zones are built by `comMemoryZones` (hack) or `dosMemoryZones` (DOS)
in `kiln/memory.mjs`. They produce a sorted array of linear
addresses. For each address, Kiln emits:

- A `@property --m<addr>` declaration with its initial byte.
- A `style(--at: <addr>): var(--__1m<addr>)` branch in `--readMem`.
- A double-buffer read `--__1m<addr>: var(--__2m<addr>, <init>)`.
- A write rule `--m<addr>: if(... else: var(--__1m<addr>))` that
  checks the 3 parallel write slots. Each slot is nested behind a
  `style(--_slotNLive: 1)` gate so that on ticks where slot N is idle,
  none of its per-byte `style(--memAddrN: addr)` branches are
  evaluated. Non-writing instructions (NOP, MOV reg,reg, jumps, most
  ALU reg-reg, flag ops) short-circuit at slot 0 with zero address
  lookups anywhere.
- Store and execute keyframe entries that double-buffer the byte.

That pattern - per-byte property + dispatch branches - is why
cabinets are hundreds of megabytes of CSS. The size is the price of
modeling 640K of RAM as 640K of CSS properties.
