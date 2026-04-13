# Debugging the DOS Kernel

The DOS kernel is **EDR-DOS** (open source, SvarDOS/edrdos on GitHub). We did
not write it. When the kernel misbehaves, you need to understand what the
kernel code is doing internally.

## Key resources

### Kernel map file

Location: `dos/ke2044_86f16.zip` -> `bin/kwc8616.map`

Maps addresses to symbol names. When you see the CPU stuck at `9675:61D0`,
compute the offset from the kernel's relocated base and look up the function.

**How to use:**
1. The kernel loads at `0060:0000` (linear `0x600`) and relocates itself upward.
   The relocated CS is visible in traces (e.g., `CS=9675`).
2. IP value is the offset from CS. Cross-reference with TGROUP/HMA_TEXT
   segment offsets in the map.
3. Key symbols: `_DPBp` (disk parameter blocks), `_sfthead` (system file table),
   `_first_mcb` (memory control blocks), `_CDSp` (current directory structure),
   `_syscon` (console device), `_clock` (clock device).

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
