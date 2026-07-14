# MS-DOS 4.00 (MIT-licensed)

System files for the `boot.os: "msdos4"` cart mode - real MS-DOS 4.00
booting from its own boot sector instead of the default EDR-DOS kernel.

## Contents

| File | Size | What |
|---|--:|---|
| `bin/IO.SYS` | 33,321 | MSBIO + SYSINIT (device drivers, boot init) |
| `bin/MSDOS.SYS` | 37,376 | The DOS kernel |
| `bin/COMMAND.COM` | 37,556 | Shell |
| `bin/msboot.bin` | 512 | Boot sector (MSBOOT.ASM build); the builder patches its BPB to the cart's floppy geometry |

## Provenance

Source: Microsoft's MIT-licensed MS-DOS 4.00 release
(<https://github.com/microsoft/MS-DOS>, April 2024), whose shipped tree
was build-broken; restored by community patches from Howard M. Harte
(hharte) and E. C. Masloch (ecm). Binaries here were extracted from the
compiled bootable 1.44 MB image published alongside the restored fork
(<https://felsqualle.com/posts/2024/05/the-broken-source-code-for-ms-dos-4-has-been-restored/>,
`msdos400_1440.ima`, sha256
`b5b2664c21ba7f2b4557564376c0cc47a7ae0c9c6bf0703de4660529f4f1e0b2`),
which matches the October 1988 MS-DOS 4.00 retail release. Restored
source fork: <https://github.com/lotharsm/MS-DOS> branch
`dos-4.00-reconstructed`.

Extraction recipe: files are ordinary FAT12 root-dir entries; boot
sector is LBA 0. Any FAT12 reader works - the session used a ~40-line
Node script walking the BPB/FAT/root dir of the image.

`LICENSE` is the MIT license from microsoft/MS-DOS. The full utility
set (EDLIN, DEBUG, CHKDSK, …) exists in the same image and is equally
MIT - only the boot-essential trio is parked here; utilities belong in
carts that want them.

## Boot contract (from v4.0/src/BOOT/MSBOOT.ASM)

- `IO.SYS` and `MSDOS.SYS` must be the **first two root directory
  entries** and IO.SYS's first 3 sectors **contiguous at the start of
  the data area** (the builder's mkfat12 writes files in layout order,
  contiguously, so listing IO.SYS first satisfies both).
- The boot sector loads those 3 sectors (IBMLOAD) at 0070:0000 and
  jumps with DL=drive (from its PhyDrv byte, 0), CH=media byte,
  AX:BX = first data sector. SYSINIT then loads the rest of IO.SYS +
  MSDOS.SYS itself via INT 13h.
- It reads the INT 1Eh diskette-parameter-table vector at boot (copies
  11 bytes) and re-points it - the BIOS must have a valid INT 1Eh
  vector (Corduroy does: `disk_param_table`).
