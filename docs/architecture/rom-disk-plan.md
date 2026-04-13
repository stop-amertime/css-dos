# ROM Disk Plan

**Status: Designed, not yet implemented.**

The DOS boot path currently bakes the FAT12 disk image into 8086 memory at
0xD0000. This limits disk size to ~128 KB (space between 0xD0000 and 0xEFFFF).
Real software (Doom8088 WAD = 1.3 MB) doesn't fit.

## The solution

Move disk bytes outside the 8086's 1MB address space and access them through
a memory-mapped window controlled by an LBA register.

| Address   | Size      | Purpose                              |
|-----------|-----------|--------------------------------------|
| 0x004F0   | 2 bytes   | Disk LBA register (in BDA)           |
| 0xD0000   | 512 bytes | Disk window (one sector at a time)   |

The LBA register is a normal writable word in the BDA's intra-application
communications area (0x4F0-0x4FF). The disk window reads are computed by
`--readMem` based on the current LBA value + byte offset.

## How reads work

INT 13h AH=02h handler:
1. Compute LBA from CHS parameters
2. Write LBA to 0x004F0
3. Copy 512 bytes from 0xD0000 to ES:BX using normal MOV loop
4. Advance to next sector, repeat

The CSS engine satisfies each window read by dispatching into a disk-data
table keyed on the current LBA. Programs using normal file I/O (INT 21h)
work automatically — DOS calls INT 13h, which uses the window.

## What changes in the codebase

- `transpiler/src/patterns/bios.mjs` — INT 13h uses LBA register + window
- `transpiler/src/memory.mjs` — ROM disk zone with `--readDiskByte` function
- `transpiler/src/emit-css.mjs` — wire dispatch function
- `transpiler/generate-dos.mjs` — pass disk image to ROM disk emitter

## What it unlocks

Doom8088 (~1.5 MB total), Wolfenstein 3D, Commander Keen, Sierra adventure
games — anything that uses normal INT 21h file I/O.

## Key design insight

CSS-DOS doesn't have physical RAM. Memory is a sparse map of integer addresses
to bytes. The 1MB limit is purely a property of the 8086's segment:offset
addressing (tops out at 0xFFFFF). We can put disk bytes at any CSS address
(e.g., 0x100000+) — the 8086 can't `mov` to them directly, but the BIOS
handler (which is emitted by the generator and knows where the data lives)
bridges the gap by copying through the window.

This is exactly how a real PC works: the BIOS sector driver is the only layer
that knows about the physical storage. Everything above (DOS kernel, libc,
application) uses INT 13h and doesn't care what's behind it.

## CSS implementation sketch

```css
@function --readDiskByte(--lba <integer>, --off <integer>) returns <integer> {
  result: if(
    style(--lba: 0, --off: 0): 235;    /* sector 0, byte 0 */
    style(--lba: 0, --off: 1): 60;
    /* ... one branch per disk byte ... */
  else: 0);
}
```

The disk window addresses (0xD0000-0xD01FF) in `--readMem` dispatch to
`--readDiskByte` keyed by the current LBA at 0x4F0, instead of returning
stored bytes.

## Size considerations

A 1.3 MB WAD = ~1.3 million dispatch branches = ~30-50 MB CSS source. Valid
CSS, but Chrome can't evaluate it at usable speed. Calcite JIT-compiles the
dispatch into a flat byte array — fast and memory-efficient.
