# CSS-DOS Logbook

Last updated: 2026-04-27

## Current status

Zork, Montezuma's Revenge, and sokoban boot and run under dos-corduroy
with autofit memory. zork-big (2.88 MB disk variant) now boots too
after the FAT12 cluster-boundary fix. **Doom8088 and Prince of Persia
both BOOT TO TITLE SCREEN** in mode 13h via two source-level fixes (no
binary patching). Doom reaches the marine/id-Software splash by ~30M
ticks; PoP reaches the Persian palace splash in the same window.

The web player (build.html → calcite.html) now renders the Doom title
in correct mode-13h colors after a calcite WASM fix; previously it was
showing magenta/cyan CGA garbage where calcite-cli rendered fine.

**Active blocker — Doom8088 stuck on title splash forever (calcite is
diverging from a real 8086 reference).** Verified by running the same
cabinet through `tests/harness/ref-shoot.mjs` (js8086 in-process,
~2 M instructions/s): the reference reaches the demo loop by ~60 M
instructions (interior of map, marine HUD, ammo readouts). Calcite at
20 M ticks shows the same title splash phash as 5 M / 10 M / 15 M ticks
— it never advances. The `haltCode=110 OUTSB` halt I claimed fixed
earlier was actually inert; the PIT-during-REP race that motivated the
bail involves `--_irqActive`, which the cabinet never references via
`var()`, so calcite doesn't compile a property slot for it and
`read_prop` always returns 0. The bail never fires. The OUTSB halt
specifically may not recur in the current cabinet, but the broader
"calcite diverges from real 8086 → never reaches demo" problem is open.

Non-planar video modes should be working following the recent
video-modes work.

## 2026-04-27 — Reference-emulator-driven divergence hunt

Built the missing diagnostic tooling (the previous "is this calcite
or doom?" question was unanswerable without it) and used it to find
calcite's first divergence from js8086. New tools, all in
`tests/harness/`:

- **`ref-machine.mjs` (modified)** — js8086 setup now handles cabinets
  whose disk doesn't fit in 1 MB linear RAM (Doom8088 is 2.88 MB).
  Adds two virtual peripherals so the reference matches what calcite
  does:
  - **Rom-disk window at 0xD0000-0xD01FF**: `m_read` traps reads in
    that range and returns `disk[lba * 512 + offset]` where `lba` is
    the word at linear 0x4F0. Mirrors corduroy's INT 13h "set LBA via
    0x4F0, REP MOVSW from DS=D000" protocol exactly.
  - **VGA DAC at ports 0x3C7/0x3C8/0x3C9**: composite peripheral
    snoops OUT 0x3C9 writes into a 768-byte `dacBytes` array exposed
    on the returned object. Without this, programs that reprogram the
    palette (Doom does this constantly) render in junk colours.
- **`ref-run.mjs` (new)** — step the reference through N instructions,
  print sample regs / video mode / current-LBA every M ticks. Useful
  for "where is DOOM in the reference's boot sequence?".
- **`ref-shoot.mjs` (new)** — render the reference's mode-13h frame
  (uses the new dacBytes shadow) to PNG at instruction N. Comparable
  pixel-for-pixel to `pipeline.mjs fast-shoot`.
- **`diverge.mjs` (new)** — runs both engines on the same cabinet,
  bisects sample ticks to find first reg-mismatch, prints the offending
  CS:IP and reg deltas. Calcite goes through `calcite-cli --dump-ticks`
  (one process spawn for all samples), ref runs in-process. Time-capped:
  10 samples covering 2 M ticks = ~25 s. Use with `--from`/`--to`/`--step`.

### What the diagnostic showed

Initial run found first divergence at calcite tick 397452: ref completed
a `REP MOVSB` in 1 step (CX 11 → 0, SI/DI advanced 11), calcite
completed 1 byte (CX 11 → 10, SI/DI advanced 1, IP held at the prefix).
The bytes the REP was copying were at `DS=F000:SI` — a `REP MOVSB` from
**BIOS ROM** into a DOS data structure during corduroy's boot.

Root cause: `rep_fast_forward` bailed with `src-virtual-range` whenever
src linear was in `[0xF0000, 0x100000)` (BIOS ROM). The bail was added
because BIOS lives in `state.extended`, not `state.memory`, and the old
fast-forward path used a memmove on `state.memory` that returned zeros
for BIOS reads. But `bulk_copy_bytes` was rewritten earlier this month
(2026-04-25, the LZ77 / UPX fix) to do per-byte read-then-write through
`state.read_mem`, which DOES resolve `extended`. The src-virtual bail
became stale.

**Fix in calcite** (`crates/calcite-core/src/compile.rs`): drop the
BIOS-ROM source-overlap bail; the existing `bulk_copy_bytes` per-byte
`read_mem` path handles BIOS sources transparently. The disk-window
overlap (0xD0000-0xD01FF) STILL bails because that needs sector-byte
data the cabinet's CSS encodes as a giant `--readDiskByte` dispatch
that calcite-core can't call from Rust.

### Disk-window REP fast-forward via sidecar

After the BIOS fix, the next divergence point was at calcite tick ~414K
where `REP MOVSW` from `DS=D000:0002` (the rom-disk window) hits 256
iterations of per-byte CSS dispatch instead of one bulk copy. `F000:C68`
(the corduroy INT 13h sector reader) hits this REP **1785 times in
500K calcite ticks** per `CALCITE_REP_TRACE` — single biggest hot path.

**Fix in calcite** (`crates/calcite-core/src/state.rs` +
`calcite-cli/src/main.rs`): added `State::disk_image: Option<Vec<u8>>`.
calcite-cli loads the cabinet's `<name>.disk.bin` sidecar at startup.
`State::read_mem` for any address in `[0xD0000, 0xD0200)` returns
`disk_image[lba * 512 + (addr - 0xD0000)]` where `lba = read_mem16(0x4F0)`.
This mirrors the cabinet's CSS `--readDiskByte` dispatch byte-for-byte
but in O(1) Rust. The previously stale `rep_fast_forward` bail for
the disk window is replaced with a no-op (the bail is no longer needed
because read_mem handles the dispatch). `bulk_copy_bytes` then services
the REP MOVSW source through the same path.

Verified: post-fix, the disk-window REP entries dropped from 1785 to 7
in 500K ticks, and the first divergence moved from tick 414K to tick
444841. CycleCount per tick improved slightly (5 M ticks: 187 M → 202 M
cycles). Smoke suite was time-capped during verification — needs a
fresh run before claiming no regression.

### Next divergence layer (still open)

At tick 444841 the next divergence is a `REPNE SCASB` (`f2 ae`,
`repType=2`) at CS:IP=8AEC:7EA2 — DOOM-side libc string scan, CX≤256.
calcite's `rep_fast_forward` only handles plain REP / REPE on
MOVS/STOS (`repType=1`, opcodes 0xA4/0xA5/0xAA/0xAB). REPNE bails
with `repType-ne-1`, falls back to per-byte CSS, costs N ticks instead
of 1.

Implementing REPNE/REPE SCASB and CMPSB in `rep_fast_forward` is
straightforward (linear scan of `state.memory` looking for AL match,
respecting CX-bounded early exit, updating ZF), but each REP variant
is its own case and there will likely be more divergence layers behind
this one.

### Tooling left in place

- `tests/harness/diverge.mjs`, `ref-run.mjs`, `ref-shoot.mjs` —
  ref-machine-driven diagnostics, all time-capped.
- `calcite-cli --trace-halt` (from earlier in the day) — ring-buffer
  dump of last N ticks before `haltCode` transitions 0→nonzero.
- Calcite-side: `CALCITE_REP_TRACE=1` — per-REP eprintln of opcode,
  CS:IP, hasREP, repType, hasSeg, CX, flags. Used to verify the
  disk-REP fix dropped the hot path.

### Things I claimed earlier that turned out to be wrong

- "CPU halt at title FIXED via `_irqActive` bail" — false. The bail
  reads `--_irqActive` via `read_prop`, but the cabinet only references
  `--_irqActive` via `style(--_irqActive: 1)` containment (0 var()
  references), so calcite doesn't compile a property slot for it.
  `read_prop` returns None → unwrap_or(0). Bail never fires. The fact
  that DOOM ran longer was probably a side-effect of the LZ77 /
  bulk_copy_bytes change made by another session.
- "Title-stuck is a missing key press" — false. Real DOOM auto-advances
  title → demo → "press any key" without input. Reference confirms
  this: js8086 reaches the demo's interior-room scene at instr=60 M
  with no input. The bug is calcite running ~hundreds of times slower
  than ref because each REP variant calcite can't fast-forward eats
  N×CSS-evaluation cost.

## 2026-04-26 — Doom8088 web colors + title investigation

### Fix: web player rendered DOOM title in CGA garbage colors

calcite-cli rendered the Doom8088 title screen with the correct VGA
palette but the web player at `/player/calcite.html` produced a
recognisable but wildly miscolored image (magenta/cyan/green noise
where the marine + id Software logo should have been red/green/yellow).
Geometry was preserved → palette path was wrong, not the framebuffer
read.

**Root cause** (`crates/calcite-wasm/src/lib.rs::CalciteEngine::read_framebuffer_rgba`):
For packed cabinets the WASM wrapper builds a `scratch` `State` and
clones `self.state.extended` into it, then asks `State::read_framebuffer_rgba`
to resolve the DAC palette from `extended`. But for packed cabinets,
DAC writes from `OUT 0x3C9` go through the `CompiledPackedBroadcastWrite`
port (compile.rs ~line 4754) directly into `state.state_vars[]` —
they NEVER touch `extended` (the `extended.insert` path in `write_mem`
only fires for non-packed addresses ≥ 0xF0000). So the cloned
`extended` was empty, `dac_populated` stayed `false`, and
`read_framebuffer_rgba` fell back to the hardcoded 16-entry CGA
palette → garbage colors.

calcite-cli dodged the bug because its `--dump-mem-range` uses
`state.read_mem`, which checks the packed cell table FIRST before
falling back to `extended`.

**Fix:** after cloning `extended`, populate the scratch's DAC region
via the unified-read helper:
```rust
for i in 0..768i32 {
    let addr = calcite_core::state::VGA_DAC_LINEAR + i;
    let v = self.read_byte_unified(addr) as i32;
    if v != 0 { scratch.extended.insert(addr, v); }
}
```
Verified in Playwright against the doom8088 cabinet: title screen now
renders identical to calcite-cli's trophy.

**Pattern to remember:** when a renderer uses a "borrow path" (clone
extended, build scratch state) instead of the unified-read path, ANY
write port whose CSS sink doesn't go through `write_mem` will be
invisible to the renderer. The `--__1dacWriteIndex` / `--__1dacSubIndex`
state-machine writes that resolve OUT 0x3C9 land via packed broadcast
write, exactly the kind of thing this gap drops.

### Fix: title-screen halt at tick ~50.3M (calcite rep_fast_forward + IRQ race)

Both web and calcite-cli froze on the title screen at the same tick
(~50.3M, cycleCount latched at 1,211,508,671) with `haltCode=110`
(0x6E = OUTSB) and the CPU parked at CS:IP=3070:808 — inside a data
area near the PSP, NOT executable code. The actual halt opcode 0x6E is
just where the runaway CPU eventually hit an undispatched byte; the
real bug fired several hundred ticks earlier.

**Root cause** (calcite, `crates/calcite-core/src/compile.rs::rep_fast_forward`):
calcite's `rep_fast_forward` runs at end-of-tick, AFTER the CSS writeback
that applies `--IP`/`--CS`/`--SP` slot values to state-vars. When a
hardware IRQ delivers in the same tick as a REP MOVSW (PIT timer fires
during a libc memcpy), CSS correctly computes the IRQ override
(`--IP` = IVT[8].IP = 0, `--CS` = IVT[8].CS = 0x2BC2), writeback updates
state-vars to the IRQ vector. Then `rep_fast_forward` fires anyway —
the string-op opcode (0xA5) is still in `slots[]` because decode ran
against the OLD CS:IP — reads the post-IRQ IP=0, and overwrites it with
`0 + 1 + prefix_len = 2`. The IRQ handler at CS=11202:0 has prologue
`PUSH CX; PUSH AX; PUSH DX; ...` — entering at IP=2 skips the first
two pushes but the exit still pops `... POP AX; POP CX; IRET`. SP ends
up 4 bytes too high → IRET pops a bogus frame from above its own
stack window → CPU lands in PSP/data area → halts on 0x6E several
hundred ticks of garbage execution later.

**Trace evidence:** the CPU executed ~290 ticks of incrementing-IP-by-2
through valid-but-meaningless 0x20/0x29 opcodes (AND/SUB on memory)
before hitting 0x6E. Fast-forward-disabled (`CALCITE_REP_FASTFWD=0`)
DOOM ran to cycleCount > 2.7B without halting — confirming
rep_fast_forward was the cause, not a separate bug.

**Fix:** in `rep_fast_forward`, bail when `--_irqActive` or `--_tf` was
1 this tick:
```rust
let irq_active = read_prop(program, state, slots, "--_irqActive").unwrap_or(0);
let tf_active  = read_prop(program, state, slots, "--_tf").unwrap_or(0);
if irq_active != 0 || tf_active != 0 {
    rep_diag_bail("irq-or-tf-this-tick");
    return;
}
```
This is the direct signal that the per-tick CSS already vectored to a
handler; rep_fast_forward must not touch the post-vector registers.

**Verification:**
- Smoke suite (7 carts: dos-smoke, hello-text, cga4-stripes, cga5-mono,
  cga6-hires, zork1, montezuma) — all PASS, no perf regression.
- calcite-cli at 100M / 200M ticks: cycleCount 1.8B / >2.7B (well past
  the old halt point at 1.211B).
- Web player (Playwright, post-WASM-rebuild): cycleCount climbed to
  1.1B+ in steady 68 fps mode-13h streaming, no halt observed.

**Misc tooling added** during the investigation (left in place, useful
for future similar bugs):
- `calcite-cli --trace-halt [--trace-halt-skip=N]`: tick-by-tick monitor
  with a 2048-entry ring buffer of (CS, IP, regs, opcode bytes); prints
  the ring when `haltCode` transitions 0→nonzero. Pair with `--ticks=N`
  upper bound. Slow (unbatched), so use `--trace-halt-skip` to fast-
  forward via `run_batch` first.

### Pattern to remember

- `rep_fast_forward`'s contract is "the REP would have completed
  uninterrupted this tick, so collapse it." That contract is broken
  whenever the same tick also delivered an IRQ/TF override — the
  state-vars no longer describe the post-REP CPU, they describe the
  post-IRQ CPU. Any optimization that fires in the post-writeback phase
  must check the override-active flags before touching state-vars that
  the override owns.
- The visible halt opcode (0x6E here) is rarely the bug. Trace BACKWARDS
  from the halt — the CPU had to be redirected somehow. In this case
  290 ticks of valid-data-as-instructions stood between the bad branch
  and the visible failure.

## 2026-04-26 — Doom8088 + Prince of Persia title screens

Two source-level bugs were blocking the title screen. Both fixed,
neither EXE was patched. Smoke suite still passes (7 carts).

1. **(kiln) `emitShift_D0` was missing ROL/ROR cases.**
   `kiln/patterns/shift.mjs::emitShift_D0` is the dispatch for
   "shift/rotate r/m8 by 1" (opcode `D0 /r`). It implemented SHL,
   SHR, SAR, RCL, RCR — but not ROL (reg=0) or ROR (reg=1). They
   fell through to `else: var(--__1${regName})` which is a no-op
   for the reg.

   Doom8088's libc memcmp does the standard Watcom "lahf;
   ror ah, 1; and ax, 0xa000; xor ax, 0x2000" trick to convert the
   post-cmpsw flags into a -1/0/+1 result. With ROR being a no-op,
   AH stayed at the lahf value (0x46 for ZF=1), the and/xor sequence
   yielded AX=0x6000 instead of 0, every memcmp reported "not equal"
   even when the bytes matched, and the WAD-lump search aborted at
   `W_GetNumForName: DPPISTOL not found`.

   Fix: added ROL+ROR to `emitShift_D0`'s result and flags
   dispatches, matching the layout already used by `emitShift_D1`
   (word-shift). Cleaned up the dispatch into a small `RESULTS` table
   so all 7 reg cases live in one obvious place — easier for the
   next agent to see if anything is missing.

   **Debugging pattern to remember:** the symptom was "DPPISTOL not
   found" which screamed "WAD load broke" or "cmpsw broke". The
   *actual* issue was 4 instructions later in the libc post-cmpsw
   flag conversion. **Always test the suspected primitive in
   isolation before assuming it's broken.** A 50-line repe-cmpsw
   `.COM` test would have ruled cmpsw out in 2 minutes — instead I
   spent hours patching the wrong layer. Same lesson for cmpsb: I
   "verified" it was broken too by patching the same bytes in DOOM
   to use cmpsb and seeing the same failure, but the failure was
   downstream of cmpsw/cmpsb (in the ROR), so swapping which one ran
   couldn't help.

2. **(corduroy) PIC IMR init was missing.** Real PC BIOSes write to
   port 0x21 at boot to unmask the IRQs the BIOS uses. Corduroy
   didn't, so picMask stayed at 0xFF (all IRQs masked) and IRQ 0
   (PIT/timer) never delivered. Doom's `TryRunTics` waited forever
   on `I_GetTime()` which only advances via the timer ISR. Fix: added
   `install_pic()` in `bios/corduroy/bios_init.c` that does
   `out 0x21, 0xFC` to unmask IRQ 0 and IRQ 1. Inline asm via Watcom
   `#pragma aux out_byte` (libc not linked into BIOS).

   This was discovered DURING debugging of doom's hang after
   "R_Init: DOOM refresh daemon" — picMask=0xFF visible in the
   `--dump-tick` state-vars line.

   ### Things I thought were bugs but weren't

   - calcite's `rep_fast_forward` interacting badly with IRQ
     delivery. Looked plausible (the fast-forward `state.set_var("IP",
     ip + 1 + prefix_len)` would clobber an IRQ-set IP). Patched it.
     After the real ROR fix landed, I reverted the calcite change and
     doom still works — the IRQ-during-REP scenario doesn't fire in
     practice. **Don't accumulate "defensive" fixes whose root
     scenario you can't reproduce after the actual bug is gone.**

   - calcite's `repe cmpsw` returning nonzero for equal operands.
     Wrote an isolated `repe cmpsw` test cart (one .COM, ~30 lines
     of asm). Test passed. Bug wasn't there. (But I should have run
     this test BEFORE binary-patching DOOM.EXE's memcmp.)

### How to apply / verify

```sh
# Build Doom and PoP
node builder/build.mjs carts/doom8088 -o doom8088.css
node builder/build.mjs carts/PERSIA -o pop.css

# Run + dump VGA + DAC palette to render the title
calcite-cli -i doom8088.css -n 30000000 --speed 0 --screen-interval 0 \
  --dump-mem-range=0xA0000:64000:vga.bin \
  --dump-mem-range=0x100000:768:dac.bin

# Render: 320x200, each VGA byte indexes the DAC (multiply DAC bytes by 4 — they are 6-bit)
```

The patched-EXE artifact `carts/doom8088/DOOM.EXE.memcmp_patched` is
kept as a reference for the workaround; `DOOM.EXE` is identical to
`DOOM.EXE.orig`.

## In flight

- **EMS/XMS for Doom8088 — partial scaffold, not working yet.**
  2026-04-25: corduroy now hooks INT 2Fh (XMS detect → AL=0x80, driver
  entry stub) and INT 67h (EMS function dispatcher); entry.asm reserves
  bytes 0x0A..0x11 of BIOS_SEG for the "EMMXXXX0" magic that traditional
  IVT-based EMS detectors look for. **Doesn't work for DOOM8088** because
  it detects EMS by `open("EMMXXXX0", O_RDWR)` — i.e. expects EMMXXXX0
  to be registered as a DOS character device, not just bytes at a
  segment offset. Adding a synthesized EMS device driver to the boot
  floppy + a real backing-store implementation is the path forward;
  not done in this session. Fix lives in
  `bios/corduroy/{entry,handlers,bios_init}.{asm,c}` — leaving in
  place since it's harmless for other carts (smoke suite still passes)
  and needed for the eventual EMS implementation.
- **PUSH/CALL/INT SP-wraparound fixed in kiln.** 2026-04-25: every
  PUSH/PUSHF/CALL/INT/INTO/Group-FF push/IRQ-frame emitter computed
  the write address as `SS*16 + SP - K` without wrapping `SP-K` to
  16 bits. When SP=0 (typical on a fresh stack — DOOM8088 does this
  per its EXE header `SP=0x0000`), `SP-2` is signed −2, the address
  becomes `SS*16 - 2`, and the push lands ONE SEGMENT EARLIER than it
  should. The CS:IP that EDR-DOS placed at the top of DOOM's stack for
  its exec-stub `RETF` got written 0x10000 bytes too low, so the IRET
  frame at the actual SS:0xFFFA was all-zero, and the kernel handler's
  final IRET popped CS=0,IP=0 and wild-jumped into the IVT (CS=0,
  IP=0x4C — the long-standing "Doom8088 stage-3→4 hang"). Fixed by
  wrapping `SP±K` to 16 bits via `--lowerBytes(calc(SP - K + 65536),
  16)` at every site (kiln/patterns/{stack,control,extended186,misc,
  group}.mjs and kiln/emit-css.mjs IRQ/TF push frame). Doom8088 now
  boots, allocates its zone, parses the WAD, prints "shareware
  version", and exits cleanly when XMS isn't present (separate gating
  issue — DOOM8088 hard-requires HIMEM/XMS, which CSS-DOS doesn't
  emulate yet). Smoke suite (7 carts) still passes.
- **COMMAND.COM-as-shell fixed end-to-end.** 2026-04-25: setting
  `boot.autorun: "COMMAND.COM"` and running a bare `command.com` as a
  cart both boot to `A:\>` again. Two independent root causes:
  1. **Builder dedupe gap (CSS-DOS).** Builder always added bundled
     `dos/bin/command.com` to the floppy. If the cart manifest also
     had a COMMAND.COM (e.g. user runs `command.com` straight as a
     cart), the FAT12 image got two identical root-dir entries — DOS
     picked the first and ignored the user's one. Fixed in
     `builder/stages/floppy.mjs` by only appending the bundled
     COMMAND.COM when the cart didn't already provide one. The browser
     builder already had this guard; the Node builder was out of sync.
  2. **REP MOVSB fast-forward broke LZ77 self-reference (calcite).**
     `state.bulk_copy_bytes` snapshotted the source range before
     writing — `memmove` semantics, *not* per-iteration REP MOVSB
     semantics. UPX (and any LZ-style decompressor) relies on forward-
     overlap MOVSB: `MOV SI,dst-N; MOV CX,len; REP MOVSB` repeats the
     last N bytes by reading data that was *just written* by earlier
     iterations of the same REP. The snapshot pulled the stale source
     bytes instead, so UPX's decompression output came out garbage,
     SvarCOM exited via INT 20h immediately, and biosinit's
     `shell_error` path printed "Bad or missing command interpreter".
     Fixed in `calcite-core/src/state.rs` by changing `bulk_copy_bytes`
     to a per-byte read-then-write loop. Direction-flag is already
     bailed on in `rep_fast_forward`, so this only handles the
     forward-CLD case — which is what every caller produces.
     Verified: `command-bare`, `shelltest`, `montezuma` all boot;
     smoke suite (7 carts) passes.
  *Bisect technique that nailed it:* `CALCITE_REP_FASTFWD=0` made
  the symptom go away, narrowing it to runtime REP fast-forward;
  added two ad-hoc env gates (`CALCITE_REP_NO_MOVS` /
  `CALCITE_REP_NO_STOS`) to discriminate which opcode group was at
  fault — disabling MOVS-only fixed it, disabling STOS-only didn't.
  From there reading `bulk_copy_bytes` was a one-comment giveaway —
  the existing comment literally promised "stable read view" overlap
  semantics, which is the wrong contract for REP MOVSB.
- **New harness command: `fast-shoot`.** 2026-04-25: takes a screenshot
  at any tick by driving `calcite-cli` directly instead of going
  through `calcite-debugger`. ~375K ticks/s vs ~1500 on the daemon
  path (250x), which is the difference between "boots in 10s" and
  "doesn't fit a 2-minute budget". Implemented via a new
  `--dump-mem-range=ADDR:LEN:PATH` flag on calcite-cli that writes
  raw guest-memory bytes to a file at end-of-run; the Node-side
  `tests/harness/lib/fast-shoot.mjs` runs the cabinet, reads the
  dumps back, rasterises text/CGA/Mode-13h to RGBA via the same code
  shoot.mjs uses, and emits PNG. Limitation: pays the ~2s
  parse+compile cost per call (no compilation cache yet).
- **Disk geometry is now builder-driven.** 2026-04-24: disk.size
  defaults to `"autofit"` in both DOS presets. The builder picks CHS
  from content size (standard preset if content fits, fabricated
  geometry up to ~32 MB otherwise) and patches the same values into
  the BIOS at build time via ASCII sentinels (`DGSP`/`DGHD`/`DGCY`)
  plus a `0xD4` sentinel in `disk_param_table`. Both corduroy and
  muslin support it. Web builder (`web/browser-builder/*`) is plumbed
  through too — `buildFloppyInBrowser` now takes a `sizeRequest` and
  returns geometry, so web carts get the same behavior as Node.
  Smoke: zork + montezuma still pass. Does NOT unblock Doom8088 —
  same hang — or the Sokoban/LZEXE "Packed file is corrupt" (both
  are unrelated bugs).
- **Memory packing (2 bytes per property):** ongoing. 2026-04-23:
  found + fixed the "pack=2 freezes partway through zork boot with
  partial splash" regression. Root cause on the calcite side:
  `bulk_fill` / `bulk_copy` / `bulk_store_byte`, all three paths of
  `Op::MemoryFill`/`MemoryCopy`, and the affine projectors in
  `cycle_tracker.rs` + `tick_period.rs` all guarded writes on
  `state.memory.len()`. For packed cabinets the flat array stays at
  `DEFAULT_MEM_SIZE = 0x600` (real bytes live in packed cells), so every
  REP STOS/MOVS fast-forward and projector silently dropped writes above
  0x600. zork diverges at tick ~397k on a `REP MOVSW` that copies
  ~58k bytes to `ES:DI = 0x20000`. Fix: new
  `effective_guest_mem_end(state) = max(flat_len,
  packed_cell_table.len() * pack_size)`. Native probe converges pack=1
  vs pack=2 through ≥500k ticks post-fix, and pack=2 is now *slightly
  faster* than pack=1 (not slower, as the user expected). Browser
  verification pending.
- **FAT12/FAT16 cluster-boundary fix (mkfat12).** 2026-04-24: any cart
  whose disk had more than 4085 data clusters (i.e. > ~2.05 MB at
  SPC=1) would hang boot at CS:IP=0x105:0x1730 partway through loading
  ANSI.SYS — DOS auto-detects FAT16 when `dataClusters > 4085`, reads
  our 12-bit FAT entries as 16-bit garbage, walks the wrong cluster
  chain, and fails any read past sector 1 of a multi-cluster file.
  `tools/mkfat12.mjs` now picks `sectorsPerCluster` (doubling from 1)
  so `floor((totalSectors - dataStart) / SPC) <= 4084` always. zork1
  default is unchanged (SPC=1, 703 clusters); 2.88 MB disks now use
  SPC=2 (~2866 clusters). Threshold was pinpointed by binary search:
  4102 total sectors (= 4085 data clusters) boots, 4103 (= 4086 data
  clusters) hangs. File writer uses `clusterOffset(c) = dataStart +
  (c-2)*SPC` and allocates in `CLUSTER_BYTES = SECTOR_SIZE * SPC`
  units. User-verified: zork1 + sokoban still boot; zork-big (2.88 MB)
  now boots; doom8088 clears its old stage-2→3 hang and now hits a
  separate stage-3→4 hang instead.
- **Doom8088:** stage-3→4 hang. 2026-04-24: after the FAT12 fix, doom
  now displays the mode-13h splash and the kernel/ANSI text output
  (stages 1–3) but freezes before the game starts. calcite cycleCount
  stops advancing (~14.6M) while tick counter continues — true CPU
  halt, not an idle loop. CS=0 IP=0x4C when stuck, which is inside the
  IVT. Needs investigation. Previous stage-2→3 hang is fixed.

## Boot sequence (dos-corduroy)

1. Mode 13h boot splash
2. Text mode — kernel message + ANSI message
3. Game starts

Full boot is typically 2–4 million ticks. "Ticks are running" is
NOT a pass — video must come out and be clearly recognisable as
the game.

## How to test

Default: dos-corduroy preset, autofit memory, via the web player.
**Ask the user how to test** for anything beyond the basic smoke test.
Log good methods here as you find them.

## Debugging and conformance infrastructure — now unified

As of 2026-04-23 the test harness lives in `tests/harness/`:

- `run.mjs smoke|conformance|visual|full` — preset-level runner, writes
  `tests/harness/results/latest.json` for agents to grep.
- `pipeline.mjs <subcommand>` — single-command entrypoint for `build`,
  `inspect`, `run`, `shoot`, `full`, `fulldiff`, `triage`, `cabinet-diff`,
  `baseline-record`, `baseline-verify`, `consistency`.
- Each command prints structured JSON to stdout + human progress to stderr.
- Every long-running command has wall-clock + tick + stall-rate budgets.

The old tools (`../calcite/tools/fulldiff.mjs`, `tools/compare-dos.mjs`,
etc) imported the deleted `transpiler/` and don't work — their headers
are marked as deprecated pointing at the new harness.

Key sidecar files: the builder now emits `<cabinet>.bios.bin / .kernel.bin
/ .disk.bin / .meta.json` alongside every `.css`. The JS reference
emulator uses these sidecars to stand up the exact same 1 MB memory image
calcite sees — no more "my ref setup doesn't match calcite" divergences.
The cabinet also carries a `/*!HARNESS v1 {json}!*/` header block with
all build meta.

See [`../TESTING.md`](../TESTING.md) (top-level doc) and
`../../tests/harness/README.md` (full workflows).

## Model gotchas

- Don't just run ticks and call it a pass — verify video.
- Ask the user how to test rather than guessing.
- Web player and MCP debugger are for different things — pick the
  right one for the task. Log which tool fits which job here as you
  learn it.
