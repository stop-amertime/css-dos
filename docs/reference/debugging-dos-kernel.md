# Debugging the DOS Kernel

The DOS kernel is **EDR-DOS** (open source, SvarDOS/edrdos on GitHub). We did
not write it. When the kernel misbehaves, you need to understand what the
kernel code is doing internally.

## Key resources

### Kernel map file

There is no checked-in map. The deployed `dos/bin/kernel.sys` is EDR-DOS
build `20250427` rev `72ae65f`; regenerate the linker maps by building
that exact rev from the `../edrdos` clone (rev is an ancestor of HEAD):

```sh
git -C ../edrdos worktree add /tmp/edrdos-72ae65f 72ae65f
cd /tmp/edrdos-72ae65f
# needs OpenWatcom (C:\WATCOM) + JWasm on PATH
wmake -h clean all SINGLEFILE=1 VERSION=20250427 GIT_REV=72ae65f
# maps: drdos/bin/drdos.map (file system), drbio/bin/drbio.map (BIO)
# sanity: bin/kernel.sys differs from dos/bin/kernel.sys only in the
# two embedded build-timestamp strings (19 ASCII bytes)
```

**How to use (verified 2026-06-11 against the running guest):**
1. The DRDOS (file-system) module runs with **CS = 0x55** (image base,
   linear 0x550). IP = linear offset within the image, so a sampled
   `0x55:IP` resolves directly against `drdos.map` addresses
   (`seg:off` in the map → linear `seg*16+off`).
2. The code group `PCMCODE` spans image offsets 0–0xB9E0; `BDOS_CODE`
   (0x67AA–0xB0BA) is where file-I/O hot spots live (`fatptr`,
   `getblk`, `fdosrw`, `locate_buffer`, `div32`).
3. **Beware the old FreeDOS map**: git history contains
   `dos/bin/kwc8616.map` (deleted in `d60f8af`) from a FreeDOS-kernel
   era. Its symbols do NOT match the EDR-DOS kernel — don't use it.

### EDR-DOS source

Cloned at `../edrdos/` (from `SvarDOS/edrdos` on GitHub). Key files:
- `drdos/fdos.equ` — DDSC (DPB), BCB (buffer control block) field offsets
- `drdos/header.asm` — SDA (Swap Data Area), internal_data, device headers
- `drbio/config.asm` — boot-time device driver chain initialization

### Ralf Brown's Interrupt List

Canonical reference for DOS and BIOS interrupt interfaces. Search the web for
specific INT calls (e.g., "INT 21h AH=52h" returns the List of Lists pointer).
Documents internal structures: DOS SYSVARS, DPB chain, SFT, MCB chain, etc.

### JS8086 browser runner

`http://localhost:8086` (started via `run-js.bat web programs\foo.com` from
calcite). Shows live VGA output. `ref-dos.mjs` flags like `--trace-from`,
`--int-trace`, and `--int-trace-from` are essential for pinpointing where
execution diverges.

## The layer model

```
Application (bootle.com, COMMAND.COM)
        | INT 21h
EDR-DOS fdos (file system, process management)
        | INT 13h, INT 10h, etc.
EDR-DOS drbio (device drivers, hardware abstraction)
        | INT 13h, INT 10h, etc.
CSS-BIOS (our microcode handlers)
        |
CSS custom properties ("hardware")
```

drbio is a client of our BIOS. It calls INT 12h, 13h, 10h, etc. during init.
Our handlers must respond correctly for the kernel to initialize.

## Important: don't reverse-engineer assembly

If you attempt to reverse-engineer assembly code, you will be chasing it round
and round forever. Use the map file, read the edrdos source, look up the
interrupt interfaces. Don't guess.
