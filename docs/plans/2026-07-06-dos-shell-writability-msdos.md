# Programs-cart line: stage 2 (writable disk) + stage 3 (boot MS-DOS)

Owner intent: one cart that is *programs, not games* (`carts/dos-shell`,
stage 1, LANDED 2026-07-06 — see LOGBOOK). Stage 2 makes it a usable
machine (editors can save); stage 3 boots real MS-DOS on the same
hardware.

**Stage 2 LANDED 2026-07-06** (same day — LOGBOOK
`2026-07-06-writable-disk-stage2` + calcite log 2026-07-06). The
detailed stage-2 section below is kept only as design history; the
as-built design diverged in two ways worth knowing before stage 3:
(a) no two-key guarded write — the disk is ordinary packed cells at a
high NAME base with a per-slot window remap (`--_dskInN`/`--_dskOffN`)
into a second write family; (b) Chrome rounds computed numeric custom
properties to ~6 significant digits, so every computed value stays
< diskLen and **writable disks must stay ≤ 720K** (memory-layout.md
"1e6 precision rule"). That bound also constrains stage 3: MS-DOS 4.0
on a writable disk must fit in 720K, or ship read-only on a bigger
floppy.

Delete this file when stage 3 ships (or dies); history → LOGBOOK.

## Stage 2 — INT 13h write path ("session-writable disk")

Design intent already on paper: `docs/memory-layout.md` §"Writable disk
(aspirational)" — writes live in a RAM shadow for the tab's lifetime,
reload = factory floppy. No cross-session persistence in v1.

### How reads work today (the thing being extended)

- Disk bytes live outside guest memory in `@function --readDiskByte(--idx)`,
  one `if()` arm per **non-zero** byte (`kiln/emit-css.mjs`
  `emitReadDiskByteStreaming`, ~line 934).
- Guest window `0xD0000..0xD01FF`; window byte `i` dispatches to
  `--readDiskByte(LBA*512+i)`; LBA = normal writable word at **linear
  0x4F0** (NOT BDA-relative — see the 0x4F0 pitfall, memory-layout.md).
- BIOS INT 13h AH=02 (`bios/corduroy/handlers.asm` ~1021; Muslin same
  contract): poke LBA, `REP MOVSW` 256 words out of the window, loop.
- Calcite flattens the literal-only dispatch to a `Vec<i32>` lookup
  (`DispatchFlatArray`, ~10M-entry span cap).

### Design: two-layer shadow, mirroring how RAM already works

RAM reads are `--__1m<a>: var(--__2m<a>, <init>)` — write-layer with
factory fallback (`emit-css.mjs` `emitMemoryBufferReadsStreaming`,
~line 959). Lift exactly that shape onto the disk:

1. **Shadow properties** `--__2d<idx>` (packed cells like RAM), no
   initial value. Emitted only when `disk.writable` is on.
2. **Read side**: `--readDiskByte` arms become
   `var(--__2d<cell>, <factoryByte>)` (extract byte from cell as the
   read dispatch already does for packed RAM). Reads see writes with no
   dirty-bit bookkeeping. Zero-byte sectors need arms too once writable
   (factory fallback 0) — emission is per-*allocated* cell, so gate on
   sectors that exist on the floppy, not just non-zero bytes.
3. **Write side**: shadow cells consume the existing 3-word write slots
   (`kiln/memory.mjs` NUM_WRITE_SLOTS) with a **two-key guard**: slot
   address ∈ window && LBA register == my sector. New CSS shape.
4. **BIOS**: INT 13h AH=03 = mirror of AH=02 (`REP MOVSW` *into* the
   window per sector, LBA++). AH=04 verify = trivial success. Correct
   status returns (AH=0, CF clear). Both Corduroy and (if bothered)
   Muslin; Gossamer skips.

### Calcite side (log in `../calcite/docs/log.md`, not here)

- **Indirect flat dispatch op**: dense integer dispatch whose arms are
  `var(--X<idx>, <literal>)` → indexed state-slot read with literal
  fallback. Without it the shadow read is a multi-100K-arm chain =
  unusable, so this is required for the feature to be *runnable*, not
  just fast. Cardinal-rule check: pure CSS shape (would fire on any
  cabinet with the same shape — 6502, brainfuck, whatever); no
  disk/x86 semantics in the recogniser.
- **Two-key guarded write** recognition in the write_mem pattern path.
- A/B: byte-identical cycles+IP vs main on the smoke set with
  `disk.writable` off; smoke + fulldiff with it on.

### Costs / gating

- Full shadow ≈ one packed cell per disk byte → cabinet text grows by
  tens of MB and calcite state by ~MBs on a 1.44M floppy. **Gate
  emission on `disk.writable`** so game carts don't pay. Schema default
  is `true` today — flip the *effective* default to false in the
  builder until the cost is measured, or set `writable: false` in game
  carts; decide at implementation, document in cart-format.md either
  way (update the `aspirational` tag when it lands).
- Sparse alternative (N shadow slots + LBA→slot map) rejected for v1:
  writable indirection on every read + ugly overflow semantics.

### What comes free / what to test

EDR-DOS FAT12 writes (FAT chain, dir entries, read-modify-write) work
the moment AH=03 does. Tests:
1. Conformance cart: INT 13h write sector → read back → compare (also
   teach the JS reference machine's INT 13h the same write path —
   `tests/harness` ref — or fulldiff diverges by design).
2. `pipeline.mjs fulldiff` on smoke set, writable on + off.
3. E2E (the point): boot dos-shell, `COPY CON T.TXT` / EDIT save /
   `TYPE T.TXT`; reload tab → file gone (factory floppy).

## Stage 3 — boot MS-DOS 4.0

MS-DOS 4.0 is MIT-licensed (microsoft/MS-DOS, April 2024), runs on
8086, core = IO.SYS (~33K) + MSDOS.SYS (~37K) + COMMAND.COM (~37K).
Read-only disk boots fine (EDR-DOS proves the pattern), so stage 2 is
not a prerequisite — just a force-multiplier.

### Work items, in dependency order

1. **Build the binaries.** MASM-era toolchain; community forks of
   microsoft/MS-DOS build under DOSBox/NTVDM or modern MASM. Output:
   IO.SYS, MSDOS.SYS, COMMAND.COM (+ optionally the MIT'd external
   utilities — EDLIN, DEBUG, etc. — as future dos-shell upgrades that
   would displace the GPL FreeDOS set). Park binaries + build recipe in
   a cart or `dos/msdos/`.
2. **Gap analysis by grep, not archaeology** (repo rule: we have the
   source). Sweep MSBIO/SYSINIT for `int 13h`/`int 10h`/`int 1[0-9a-f]h`
   and BDA/IVT absolute reads → concrete BIOS work list *before*
   coding. Known-likely from RBIL + source shape:
   - INT 13h AH=08 (drive params), AH=16h (change line), AH=04
     (verify), maybe 17h/18h (set media). AH=00/02/15h exist
     (`handlers.asm` ~975-1020).
   - INT 1Eh vector → plausible 11-byte diskette parameter table.
   - INT 14h/17h correct-shaped stubs (AUX/PRN drivers probe them);
     equipment word reports 0 serial / 0 parallel.
   - BDA fields EDR-DOS never read — found empirically via fulldiff.
3. **Boot handoff.** Today kiln preloads KERNEL.SYS at 0060:0000 and
   Corduroy jumps there with BL=drive (`bios/corduroy/entry.asm:94`,
   DRBIO convention). Two options:
   - (a) *Kernel-flavor table* in builder/kiln: per-DOS load address +
     entry register contract (MS-DOS: IO.SYS at 0070:0000, contract
     per MSBOOT.ASM in the 4.0 source). Quick, contained.
   - (b) *Real boot-sector path*: INT 19h reads LBA 0 → 0x7C00, jumps;
     floppy carries a real boot sector (4.0 source has MSBOOT.ASM).
     More work, but converts "boots the kernel we hardcoded" into
     "boots disks" — FreeDOS kernel then comes free as a cheap interim
     milestone/regression case. Recommended target; (a) acceptable as
     a probe.
   Either way IO.SYS's SYSINIT loads the rest of itself + MSDOS.SYS
   via INT 13h — the loader must only get the first sectors in.
4. **Cart plumbing.** `os: "edrdos" | "msdos4"`-style builder knob (or
   just a cart that supplies its own system files + boot sector once
   (b) exists). KERNEL.SYS auto-add must be suppressible; CONFIG.SYS /
   AUTOEXEC.BAT syntax differs slightly (SHELL= works on both; 4.0
   wants COMMAND.COM /P and AUTOEXEC for the run command).

### Verification

- fast-shoot: MS-DOS banner + `A:\>`; `VER` via keyboard injection
  (`--press-events` / `setvar_pulse=keyboard,...`, bench-profile
  pattern) shows "MS-DOS Version 4.0x".
- Smoke set stays on EDR-DOS and stays green — default path untouched.
- fulldiff of the msdos cart vs the JS reference for early boot.
- Cardinal rule: untouched — everything here is guest-side bytes +
  BIOS asm; calcite sees the same CSS shapes.

### Risks

- MASM build friction (worst case: pin a community fork's known-good
  build; the binaries are MIT either way).
- IO.SYS BDA/timing expectations EDR-DOS never exercised — budget
  debugger time; the 0x4F0 LBA register must not collide with
  anything IO.SYS uses in the BDA intra-app area (verify in source).
- 4.0's COMMAND.COM is bigger and 4.0 eats ~92K conventional — fine
  in 640K, irrelevant for utilities.
