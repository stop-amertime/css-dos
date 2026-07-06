MS-DOS 4.00 on CSS-DOS
----------------------

This is real MS-DOS 4.00 - the October 1988 release, rebuilt from the
source code Microsoft published under the MIT license in April 2024 -
booting from its own boot sector on an emulated PC whose CPU is a
CSS stylesheet.

Things to try:

  VER            - it really is 4.00
  DIR            - what's on the floppy
  MEM /PROGRAM   - where DOS sits in memory
  EDLIN T.TXT    - 1980s line editing (E saves, Q quits)
  DEBUG          - dump memory: try D F000:0000, quit with Q
  CHKDSK         - check this very floppy
  TREE           - directory tree
  TYPE README.TXT | MORE

All binaries were built from github.com/microsoft/MS-DOS (v4.0),
restored by community patches (hharte, ecm, lotharsm). MIT license -
see the LICENSE file in dos/msdos4/ of the CSS-DOS repository.
