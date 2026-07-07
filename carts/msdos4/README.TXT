MS-DOS 4.00 on CSS-DOS
----------------------

This is real MS-DOS 4.00 - the October 1988 release, rebuilt from the
source code Microsoft published under the MIT license in April 2024 -
booting from its own boot sector on an emulated PC whose CPU is a
CSS stylesheet.

The floppy is writable for this session: anything you save lives
until you reload the page, then the disk snaps back to factory.

Things to try:

  VER              - it really is 4.00
  DIR              - what's on the floppy
  EDIT README.TXT  - full-screen editor (F10 for the menu; it saves!)
  EDLIN T.TXT      - 1980s line editing (E saves, Q quits)
  ATTRIB *.* /S    - reveal IO.SYS and MSDOS.SYS, hidden since 1988
  MODE 40          - big chunky 40-column text (MODE 80 to go back)
  DEBUG            - dump memory: try D F000:0000, quit with Q
  MEM /PROGRAM     - where DOS sits in memory
  CHKDSK           - check this very floppy
  TREE             - directory tree
  COPY CON T.BAT   - type a batch file, end with F6 + Enter, run it
  XCOPY / COMP / FC / FIND / SORT / MORE / LABEL / EXE2BIN

All DOS binaries were built from github.com/microsoft/MS-DOS (v4.0),
restored by community patches (hharte, ecm, lotharsm). MIT license -
see the LICENSE file in dos/msdos4/ of the CSS-DOS repository.

One anachronism: EDIT.EXE is the FreeDOS editor (GPL - see
licenses/ in the cart folder). MS-DOS didn't get its own EDIT until
5.0 in 1991; in 1988 you got EDLIN and liked it.
