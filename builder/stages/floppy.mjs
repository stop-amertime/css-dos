// Stage 2 — build the floppy image from the cart's resolved manifest.
//
// Input:  { cart, manifest, cacheDir }
// Output: { bytes, layout: [{name, size, source}] }
//
// DOS carts get a FAT12 image containing KERNEL.SYS, CONFIG.SYS (synthesized),
// the autorun program, any data files, and optionally COMMAND.COM.
// Hack carts skip this stage entirely.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFat12Image } from '../../tools/mkfat12.mjs';
import { resolveFloppySize } from '../lib/sizes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const KERNEL_SYS  = resolve(repoRoot, 'dos', 'bin', 'kernel.sys');
const COMMAND_COM = resolve(repoRoot, 'dos', 'bin', 'command.com');
const ANSI_SYS    = resolve(repoRoot, 'dos', 'bin', 'ansi.sys');
const EMSDRV_SYS  = resolve(repoRoot, 'dos', 'bin', 'emsdrv.sys');

const MSDOS4_DIR  = resolve(repoRoot, 'dos', 'msdos4', 'bin');

// Canonical FAT media descriptor per standard floppy size (by total
// sectors). Non-standard ("big floppy") geometries use 0xF0 (other).
const MEDIA_BYTES = { 720: 0xFD, 1440: 0xF9, 2400: 0xF9, 2880: 0xF0, 5760: 0xF0 };

export function buildFloppy({ cart, manifest, cacheDir }) {
  if (!manifest.disk) {
    return null; // hack carts have no floppy
  }

  mkdirSync(cacheDir, { recursive: true });

  if ((manifest.boot?.os ?? 'edrdos') === 'msdos4') {
    return buildMsdos4Floppy({ cart, manifest, cacheDir });
  }

  // Synthesize CONFIG.SYS. Every DOS cabinet boots COMMAND.COM as the
  // shell; the cart's program (if any) runs as a /K argument so the
  // shell stays alive after it exits. The cart never runs as the shell
  // directly — that path used to exist (SHELL=\GAME.EXE) but stripped
  // the program of COMSPEC, the environment block, and a re-entry point,
  // so it was deleted on 2026-04-27.
  const runCommand = (manifest.boot?.runCommand ?? '').trim();
  // SWITCHES=/F skips the ~2s F5/F8 startup delay — we don't need it in the emulator.
  // DEVICE=\ANSI.SYS loads NANSI (a GPLv2 DOS ANSI driver shipped in dos/bin/).
  // Programs that emit terminal escapes (Zork via FROTZ, SVARCOM's colored prompt,
  // any BBS-era software) rely on an ANSI driver being present. Without it the
  // escape bytes go straight to VRAM as literal text. NANSI is ~5 KB resident —
  // negligible given our default memory sizing.
  // DEVICE=\EMSDRV.SYS registers a fake EMMXXXX0 character device so EMS-gated
  // programs (DOOM8088, anything that does open("EMMXXXX0",...)) detect EMS
  // and proceed past their initial check. The driver doesn't actually back EMS
  // pages — it's enough for detection but not for real expanded-memory use.
  // Opt-in via `boot.ems = true` in program.json.
  const wantsEms = manifest.boot?.ems === true;
  const emsLine = wantsEms ? `DEVICE=\\EMSDRV.SYS\n` : '';
  // /P keeps the shell permanent (handles CONFIG/AUTOEXEC, never exits).
  // /K runs the cart's command and stays at the prompt afterwards.
  const shellLine = runCommand
    ? `SHELL=\\COMMAND.COM /P /K ${runCommand}\n`
    : `SHELL=\\COMMAND.COM /P\n`;
  const configContent = `SWITCHES=/F\nDEVICE=\\ANSI.SYS\n${emsLine}${shellLine}`;
  const configPath = join(cacheDir, 'CONFIG.SYS');
  writeFileSync(configPath, configContent);

  // Assemble the file list: KERNEL.SYS + ANSI.SYS + CONFIG.SYS + cart files
  // + COMMAND.COM (unless the cart already supplied one). ANSI.SYS must be
  // on the disk before CONFIG.SYS loads it, but file order within the FAT
  // image doesn't matter — files are located by name, not position.
  //
  // COMMAND.COM is included so:
  //   - the synthesized SHELL=\COMMAND.COM /P /K line targets it
  //     (e.g. to drop to a prompt and run a program with custom flags)
  //   - autorun batch files / programs can shell out or EXIT back to DOS
  //   - Ctrl-C from a hung autorun program lands somewhere sane
  // It's ~30 KB on a disk that's typically 1-3 MB; not worth the asymmetry.
  //
  // If the cart itself ships a COMMAND.COM (e.g. you're testing your own
  // shell, or running the bare `dos/bin/command.com` as a cart), skip the
  // bundled one — duplicate root-dir entries break the FAT12 lookup and
  // surface as "Bad or missing command interpreter" because DOS finds the
  // bundled (potentially packed) COMMAND.COM ahead of the user's copy.
  const layout = [
    { name: 'KERNEL.SYS',  source: 'dos/bin/kernel.sys',   path: KERNEL_SYS },
    { name: 'ANSI.SYS',    source: 'dos/bin/ansi.sys',     path: ANSI_SYS },
    { name: 'CONFIG.SYS',  source: `synthesized: ${configContent.trimEnd()}`, path: configPath },
  ];

  if (wantsEms) {
    layout.push({ name: 'EMSDRV.SYS', source: 'dos/bin/emsdrv.sys', path: EMSDRV_SYS });
  }

  for (const f of manifest.disk.files ?? []) {
    layout.push({
      name: f.name.toUpperCase(),
      source: f.source,
      path: resolve(cart.root, f.source),
    });
  }

  if (!layout.some(f => f.name === 'COMMAND.COM')) {
    layout.push({ name: 'COMMAND.COM', source: 'dos/bin/command.com', path: COMMAND_COM });
  }

  // Build the FAT12 image in-process (no execSync shell-out). Resolve
  // geometry first: autofit picks a standard floppy if content fits,
  // fabricates a bigger geometry otherwise. The BIOS reads this geometry
  // at runtime (patched in by the kiln stage), so the BPB and BIOS stay
  // in lockstep — programs that call INT 13h AH=08h get the same CHS
  // the disk is actually laid out with.
  const fatFiles = layout.map(f => ({
    name: f.name,
    bytes: readFileSync(f.path),
  }));
  const contentBytes = fatFiles.reduce((n, f) => n + f.bytes.length, 0);
  const { bytes: diskBytes, geometry } = resolveFloppySize(
    manifest.disk?.size ?? 'autofit',
    { autofitBytes: contentBytes },
  );
  const totalSectors = diskBytes / 512;
  // disk.sectorsPerCluster (optional) raises the minimum cluster size.
  // DOS walks a file's FAT chain per seek/read — programs that seek a lot
  // in a large file (Doom8088's lump loads) burn most of their I/O time
  // stepping 1 KB clusters. Bigger clusters shorten the chain linearly.
  const sectorsPerCluster = manifest.disk?.sectorsPerCluster;
  const bytes = buildFat12Image(fatFiles, { ...geometry, totalSectors, sectorsPerCluster });

  // Annotate sizes post-hoc.
  for (const f of layout) {
    if (existsSync(f.path)) {
      f.size = readFileSync(f.path).length;
    }
  }

  return { bytes, layout, geometry: { ...geometry, totalSectors } };
}

// boot.os "msdos4" — a real MS-DOS 4.00 floppy that boots via its own
// boot sector (dos/msdos4/, MIT-licensed). Differences from the EDR-DOS
// path above:
//   - IO.SYS + MSDOS.SYS must be the FIRST TWO root directory entries
//     with IO.SYS's first sectors contiguous at the start of the data
//     area — MSBOOT.ASM's hard layout assumptions. mkfat12 writes files
//     in layout order, contiguously, so list order is the guarantee.
//   - No KERNEL.SYS / ANSI.SYS / CONFIG.SYS synthesis. IO.SYS loads
//     \COMMAND.COM by default; carts can supply their own CONFIG.SYS
//     via disk.files.
//   - AUTOEXEC.BAT is synthesized (unless the cart supplies one): its
//     mere presence skips COMMAND.COM's blocking date/time prompt, VER
//     prints the screen-assertable banner, and boot.runCommand becomes
//     a line in it (the EDR path's SHELL=/K has no equivalent here).
//   - The boot sector is the real MSBOOT build with its BPB patched to
//     this image's geometry (mkfat12 `bootSector`), plus the canonical
//     media byte for standard sizes.
function buildMsdos4Floppy({ cart, manifest, cacheDir }) {
  const runCommand = (manifest.boot?.runCommand ?? '').trim();

  const layout = [
    { name: 'IO.SYS',    source: 'dos/msdos4/bin/IO.SYS',    path: join(MSDOS4_DIR, 'IO.SYS'),    attr: 0x07 },
    { name: 'MSDOS.SYS', source: 'dos/msdos4/bin/MSDOS.SYS', path: join(MSDOS4_DIR, 'MSDOS.SYS'), attr: 0x07 },
  ];

  for (const f of manifest.disk.files ?? []) {
    layout.push({
      name: f.name.toUpperCase(),
      source: f.source,
      path: resolve(cart.root, f.source),
    });
  }

  if (!layout.some(f => f.name === 'COMMAND.COM')) {
    layout.push({ name: 'COMMAND.COM', source: 'dos/msdos4/bin/COMMAND.COM', path: join(MSDOS4_DIR, 'COMMAND.COM') });
  }

  if (!layout.some(f => f.name === 'AUTOEXEC.BAT')) {
    const autoexecContent = `@ECHO OFF\r\nVER\r\n${runCommand ? runCommand + '\r\n' : ''}`;
    const autoexecPath = join(cacheDir, 'AUTOEXEC.BAT');
    writeFileSync(autoexecPath, autoexecContent);
    layout.push({
      name: 'AUTOEXEC.BAT',
      source: `synthesized: ${autoexecContent.trimEnd().replace(/\r\n/g, ' / ')}`,
      path: autoexecPath,
    });
  } else if (runCommand) {
    throw new Error('boot.runCommand and a cart-supplied AUTOEXEC.BAT are mutually exclusive under boot.os "msdos4" — put the command in your AUTOEXEC.BAT.');
  }

  const fatFiles = layout.map(f => ({
    name: f.name,
    bytes: readFileSync(f.path),
    attr: f.attr,
  }));
  const contentBytes = fatFiles.reduce((n, f) => n + f.bytes.length, 0);
  const { bytes: diskBytes, geometry } = resolveFloppySize(
    manifest.disk?.size ?? '720K',
    { autofitBytes: contentBytes },
  );
  const totalSectors = diskBytes / 512;
  const bootSector = readFileSync(join(MSDOS4_DIR, 'msboot.bin'));
  const bytes = buildFat12Image(fatFiles, {
    ...geometry,
    totalSectors,
    sectorsPerCluster: manifest.disk?.sectorsPerCluster,
    bootSector,
    mediaByte: MEDIA_BYTES[totalSectors] ?? 0xF0,
  });

  for (const f of layout) {
    if (existsSync(f.path)) f.size = readFileSync(f.path).length;
  }

  return { bytes, layout, geometry: { ...geometry, totalSectors } };
}
