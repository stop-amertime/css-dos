// Composes a FAT12 floppy for the browser DOS path.
// Input:  { kernelBytes, commandBytes, ansiBytes, programName, programBytes,
//           programFiles?, runCommand?, ems? }
// Output: { bytes: Uint8Array, layout: [{name, size, source}] }
//
// Hack carts never call this (no floppy). DOS carts always do.

import { buildFat12Image } from '../../tools/mkfat12.mjs';
import { resolveFloppySize } from '../../builder/lib/sizes.mjs';

/**
 * Build a FAT12 floppy image in the browser (or Node test environment).
 *
 * @param {object} opts
 * @param {Uint8Array} opts.kernelBytes      dos/bin/kernel.sys
 * @param {Uint8Array} opts.commandBytes     dos/bin/command.com
 * @param {Uint8Array} opts.ansiBytes        dos/bin/ansi.sys (NANSI, GPLv2)
 * @param {Uint8Array} [opts.emsdrvBytes]    dos/bin/emsdrv.sys (only used if `ems` true)
 * @param {string}     opts.programName      Filename on disk (e.g. "BCD.COM")
 * @param {Uint8Array} opts.programBytes     The .COM/.EXE to put on disk
 * @param {Array}      [opts.programFiles]   Extra {name, bytes, source} entries
 *                                           from manifest.disk.files.
 * @param {string}     [opts.runCommand]     Command line passed to COMMAND.COM /K.
 *                                           Empty string (default) → bare prompt.
 *                                           CONFIG.SYS always boots COMMAND.COM
 *                                           as the shell; the cart never runs as
 *                                           the shell directly.
 * @param {boolean}    [opts.ems]            When true, emit DEVICE=\EMSDRV.SYS so
 *                                           programs that detect EMS via
 *                                           open("EMMXXXX0") see EMS as
 *                                           available. Caller must also pass
 *                                           emsdrvBytes; otherwise this throws.
 * @param {string|number} [opts.sizeRequest] Manifest disk.size - 'autofit',
 *                                           a preset string like '720K', or a
 *                                           number of bytes. Defaults to 'autofit'.
 * @param {number}     [opts.sectorsPerCluster] Manifest disk.sectorsPerCluster -
 *                                           minimum cluster size (power of 2).
 *                                           Passed through to buildFat12Image;
 *                                           keeps browser builds in lockstep
 *                                           with builder/stages/floppy.mjs.
 * @returns {{ bytes: Uint8Array, layout: [{name, size, source}], geometry: {cyls, heads, spt, totalSectors} }}
 */
export function buildFloppyInBrowser({
  kernelBytes,
  commandBytes,
  ansiBytes,
  emsdrvBytes = null,
  programName,
  programBytes,
  programFiles = [],
  runCommand = '',
  ems = false,
  sizeRequest = 'autofit',
  sectorsPerCluster = undefined,
}) {
  if (!(kernelBytes instanceof Uint8Array)) {
    throw new Error('buildFloppyInBrowser: kernelBytes must be Uint8Array');
  }
  if (!(commandBytes instanceof Uint8Array)) {
    throw new Error('buildFloppyInBrowser: commandBytes must be Uint8Array');
  }
  if (!(ansiBytes instanceof Uint8Array)) {
    throw new Error('buildFloppyInBrowser: ansiBytes must be Uint8Array');
  }
  if (ems && !(emsdrvBytes instanceof Uint8Array)) {
    throw new Error('buildFloppyInBrowser: ems=true requires emsdrvBytes (Uint8Array)');
  }

  // Synthesize CONFIG.SYS (mirror builder/stages/floppy.mjs logic). The
  // DEVICE=\ANSI.SYS line loads NANSI so programs that emit terminal
  // escapes (Zork+FROTZ, SVARCOM colored prompt) render correctly
  // instead of dumping raw ESC sequences to VRAM.
  // The shell is always COMMAND.COM /P (permanent); /K runs the cart's
  // command and stays at the prompt afterwards.
  // SWITCHES=/F skips the ~2s F5/F8 startup delay - we don't need it in the emulator.
  const trimmed = (runCommand ?? '').trim();
  const shellLine = trimmed
    ? `SHELL=\\COMMAND.COM /P /K ${trimmed}\n`
    : `SHELL=\\COMMAND.COM /P\n`;
  const emsLine = ems ? `DEVICE=\\EMSDRV.SYS\n` : '';
  const configContent = `SWITCHES=/F\nDEVICE=\\ANSI.SYS\n${emsLine}${shellLine}`;
  const configBytes = new TextEncoder().encode(configContent);

  const layout = [
    { name: 'KERNEL.SYS', bytes: kernelBytes, source: 'dos/bin/kernel.sys' },
    { name: 'ANSI.SYS',   bytes: ansiBytes,   source: 'dos/bin/ansi.sys' },
    { name: 'CONFIG.SYS', bytes: configBytes, source: `synthesized: ${configContent.trimEnd()}` },
  ];
  if (ems) {
    layout.push({ name: 'EMSDRV.SYS', bytes: emsdrvBytes, source: 'dos/bin/emsdrv.sys' });
  }

  // The user's program.
  const progName = (programName || 'PROG.COM').toUpperCase();
  layout.push({ name: progName, bytes: programBytes, source: 'user upload' });

  // Any extra data files from the cart (browser v1: passed in as programFiles).
  for (const f of programFiles) {
    layout.push({
      name: f.name.toUpperCase(),
      bytes: f.bytes,
      source: f.source ?? 'user upload',
    });
  }

  // COMMAND.COM is always included so autorun programs can shell out / EXIT
  // back to a prompt, and so users can set SHELL=\COMMAND.COM explicitly.
  // Skip only if the cart already supplied its own COMMAND.COM (above).
  const alreadyHasCommandCom = layout.some(f => f.name === 'COMMAND.COM');
  if (!alreadyHasCommandCom) {
    layout.push({ name: 'COMMAND.COM', bytes: commandBytes, source: 'dos/bin/command.com' });
  }

  // Resolve disk geometry the same way builder/stages/floppy.mjs does:
  // autofit picks a standard floppy when content fits, fabricates a larger
  // geometry otherwise. The BIOS is patched with this geometry in kiln.mjs,
  // so BPB and BIOS stay in lockstep.
  const contentBytes = layout.reduce((n, f) => n + f.bytes.length, 0);
  const { bytes: diskBytes, geometry } = resolveFloppySize(sizeRequest, {
    autofitBytes: contentBytes,
  });
  const totalSectors = diskBytes / 512;

  const imgBytes = buildFat12Image(
    layout.map(f => ({ name: f.name, bytes: f.bytes })),
    { ...geometry, totalSectors, sectorsPerCluster },
  );

  return {
    bytes: imgBytes,
    layout: layout.map(f => ({ name: f.name, size: f.bytes.length, source: f.source })),
    geometry: { ...geometry, totalSectors },
  };
}

// Canonical FAT media descriptor per standard floppy size (by total
// sectors) - mirror of builder/stages/floppy.mjs MEDIA_BYTES.
const MEDIA_BYTES = { 720: 0xFD, 1440: 0xF9, 2400: 0xF9, 2880: 0xF0, 5760: 0xF0 };

/**
 * Build a bootable MS-DOS 4.00 floppy in the browser - mirror of
 * builder/stages/floppy.mjs buildMsdos4Floppy. See that function for the
 * layout constraints (IO.SYS/MSDOS.SYS must be the first two root
 * entries, AUTOEXEC.BAT synthesis, real MSBOOT boot sector).
 *
 * @param {object} opts
 * @param {Uint8Array} opts.ioBytes          dos/msdos4/bin/IO.SYS
 * @param {Uint8Array} opts.msdosBytes       dos/msdos4/bin/MSDOS.SYS
 * @param {Uint8Array} opts.commandBytes     dos/msdos4/bin/COMMAND.COM
 * @param {Uint8Array} opts.bootSectorBytes  dos/msdos4/bin/msboot.bin
 * @param {Array}      [opts.programFiles]   Cart files: {name, bytes, source}
 * @param {string}     [opts.runCommand]     Extra AUTOEXEC.BAT line
 * @param {string|number} [opts.sizeRequest] Manifest disk.size (default '720K')
 * @param {number}     [opts.sectorsPerCluster]
 * @returns {{ bytes: Uint8Array, layout: [{name, size, source}], geometry: object }}
 */
export function buildMsdos4FloppyInBrowser({
  ioBytes,
  msdosBytes,
  commandBytes,
  bootSectorBytes,
  programFiles = [],
  runCommand = '',
  sizeRequest = '720K',
  sectorsPerCluster = undefined,
}) {
  for (const [k, v] of [['ioBytes', ioBytes], ['msdosBytes', msdosBytes],
                        ['commandBytes', commandBytes], ['bootSectorBytes', bootSectorBytes]]) {
    if (!(v instanceof Uint8Array)) {
      throw new Error(`buildMsdos4FloppyInBrowser: ${k} must be Uint8Array`);
    }
  }

  const layout = [
    { name: 'IO.SYS',    bytes: ioBytes,    source: 'dos/msdos4/bin/IO.SYS',    attr: 0x07 },
    { name: 'MSDOS.SYS', bytes: msdosBytes, source: 'dos/msdos4/bin/MSDOS.SYS', attr: 0x07 },
  ];

  for (const f of programFiles) {
    layout.push({ name: f.name.toUpperCase(), bytes: f.bytes, source: f.source ?? 'user upload' });
  }

  if (!layout.some(f => f.name === 'COMMAND.COM')) {
    layout.push({ name: 'COMMAND.COM', bytes: commandBytes, source: 'dos/msdos4/bin/COMMAND.COM' });
  }

  const trimmed = (runCommand ?? '').trim();
  if (!layout.some(f => f.name === 'AUTOEXEC.BAT')) {
    const autoexecContent = `@ECHO OFF\r\nVER\r\n${trimmed ? trimmed + '\r\n' : ''}`;
    layout.push({
      name: 'AUTOEXEC.BAT',
      bytes: new TextEncoder().encode(autoexecContent),
      source: `synthesized: ${autoexecContent.trimEnd().replace(/\r\n/g, ' / ')}`,
    });
  } else if (trimmed) {
    throw new Error('boot.runCommand and a cart-supplied AUTOEXEC.BAT are mutually exclusive under boot.os "msdos4" - put the command in your AUTOEXEC.BAT.');
  }

  const contentBytes = layout.reduce((n, f) => n + f.bytes.length, 0);
  const { bytes: diskBytes, geometry } = resolveFloppySize(sizeRequest, {
    autofitBytes: contentBytes,
  });
  const totalSectors = diskBytes / 512;

  const imgBytes = buildFat12Image(
    layout.map(f => ({ name: f.name, bytes: f.bytes, attr: f.attr })),
    {
      ...geometry,
      totalSectors,
      sectorsPerCluster,
      bootSector: bootSectorBytes,
      mediaByte: MEDIA_BYTES[totalSectors] ?? 0xF0,
    },
  );

  return {
    bytes: imgBytes,
    layout: layout.map(f => ({ name: f.name, size: f.bytes.length, source: f.source })),
    geometry: { ...geometry, totalSectors },
  };
}
