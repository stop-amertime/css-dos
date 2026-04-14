#!/usr/bin/env node
// build.mjs — CSS-DOS build script
//
// Takes a .COM program and produces a single CSS file that IS a running PC:
//   BIOS (x86 assembly) + DOS kernel + program + disk image → one .css file
//
// The CSS file can be opened in Chrome (runs slowly) or evaluated by Calcite (fast).
//
// BUILD PIPELINE:
//   1. Assemble bios/css-emu-bios.asm → flat binary at F000:0000
//   2. Build FAT12 disk image with kernel + CONFIG.SYS + program
//   3. Call emitCSS() → single CSS file containing:
//      - CPU logic (register dispatch tables, decode, flags)
//      - Memory (one @property per byte, ~640KB)
//      - Hardware (PIT timer, PIC interrupt controller, keyboard)
//      - Clock animation (@keyframes)
//
// Usage: node transpiler/build.mjs <program.com> -o output.css [options]
//
// Options:
//   -o FILE            Output CSS (or HTML with --html)
//   --html             Emit an HTML file wrapping the CSS
//   --mem BYTES        Conventional memory size (default 0xA0000 = 640KB)
//   --data NAME PATH   Copy a companion file onto the disk image
//   --no-gfx           Omit VGA Mode 13h framebuffer (0xA0000-0xAFA00)
//   --no-text-vga      Omit VGA text buffer (0xB8000-0xB8FA0)

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { emitCSS } from './src/emit-css.mjs';
import { dosMemoryZones } from './src/memory.mjs';
import { createWriteStream, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// --- Paths ---
const NASM = resolve('C:\\Users\\AdmT9N0CX01V65438A\\AppData\\Local\\bin\\NASM\\nasm.exe');
const BIOS_ASM = resolve(projectRoot, 'bios', 'css-emu-bios.asm');
const BIOS_BIN = resolve(projectRoot, 'bios', 'css-emu-bios.bin');
const BIOS_LST = resolve(projectRoot, 'bios', 'css-emu-bios.lst');
const KERNEL_SYS = resolve(projectRoot, 'dos', 'bin', 'kernel.sys');
const MKFAT12 = resolve(projectRoot, 'tools', 'mkfat12.mjs');
const CONFIG_SYS = resolve(projectRoot, 'dos', 'config.sys');

// --- Memory layout ---
const KERNEL_LINEAR = 0x600;     // 0060:0000 — DOS kernel load address
const DISK_LINEAR = 0xD0000;     // D000:0000 — memory-resident FAT12 disk image
const BIOS_LINEAR = 0xF0000;     // F000:0000 — BIOS ROM

// --- CLI ---
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node transpiler/build.mjs <program.com> [-o output] [--html] [--mem N] [--data NAME PATH]');
  process.exit(1);
}

let inputFile = null;
let outputFile = null;
let htmlMode = false;
let memOverride = null;
const prune = { gfx: false, textVga: false };
const dataFiles = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' && i + 1 < args.length) {
    outputFile = args[++i];
  } else if (args[i] === '--html') {
    htmlMode = true;
  } else if (args[i] === '--mem' && i + 1 < args.length) {
    memOverride = parseInt(args[++i]);
  } else if (args[i] === '--no-gfx') {
    prune.gfx = true;
  } else if (args[i] === '--no-text-vga') {
    prune.textVga = true;
  } else if (args[i] === '--data' && i + 2 < args.length) {
    dataFiles.push({ name: args[++i], path: args[++i] });
  } else if (!inputFile) {
    inputFile = args[i];
  }
}

if (!inputFile) {
  console.error('Error: no input file specified');
  process.exit(1);
}

const programName = basename(inputFile).toUpperCase();
const programName83 = programName.length <= 12 ? programName : programName.substring(0, 12);

// --- Step 1: Assemble BIOS ---
console.log('Assembling BIOS (css-emu-bios.asm)...');
try {
  execSync(`"${NASM}" -f bin -o "${BIOS_BIN}" "${BIOS_ASM}" -l "${BIOS_LST}"`, { stdio: 'pipe' });
} catch (e) {
  console.error('NASM failed:', e.stderr?.toString());
  process.exit(1);
}
const biosBytes = [...readFileSync(BIOS_BIN)];
console.log(`  BIOS: ${biosBytes.length} bytes`);

// --- Step 2: Find bios_init entry point from listing ---
// NASM listing format: label is on its own line, offset appears on the next line.
//   992                                  bios_init:
//   993 00000513 FA                          cli
const listing = readFileSync(BIOS_LST, 'utf-8');
const listingLines = listing.split('\n');
let biosInitOffset = null;
for (let i = 0; i < listingLines.length; i++) {
  if (listingLines[i].includes('bios_init:')) {
    const next = listingLines[i + 1];
    if (next) {
      const match = next.match(/^\s*\d+\s+([0-9A-Fa-f]{4,})/);
      if (match) {
        biosInitOffset = parseInt(match[1], 16);
      }
    }
    break;
  }
}
if (biosInitOffset === null) {
  console.error('Error: could not find bios_init label in NASM listing');
  process.exit(1);
}
console.log(`  Entry point: bios_init at F000:${biosInitOffset.toString(16).padStart(4, '0')}`);

// --- Step 3: Build FAT12 disk image ---
console.log('Building disk image...');
const diskImgPath = resolve(projectRoot, 'dos', 'disk.img');

const COMMAND_COM = resolve(projectRoot, 'dos', 'bin', 'command.com');
const isShellMode = programName83 === 'SHELL.COM';
const shellProgram = isShellMode ? 'COMMAND.COM' : programName83;
writeFileSync(CONFIG_SYS, `SHELL=\\${shellProgram}\n`);

let mkfatCmd = `node "${MKFAT12}" -o "${diskImgPath}" --file KERNEL.SYS "${KERNEL_SYS}" --file CONFIG.SYS "${CONFIG_SYS}"`;
if (isShellMode) {
  mkfatCmd += ` --file COMMAND.COM "${COMMAND_COM}"`;
} else {
  mkfatCmd += ` --file ${programName83} "${resolve(inputFile)}"`;
}
for (const df of dataFiles) {
  mkfatCmd += ` --file ${df.name.toUpperCase()} "${resolve(df.path)}"`;
}
try {
  const out = execSync(mkfatCmd, { stdio: 'pipe' });
  console.log(out.toString().trim());
} catch (e) {
  console.error('mkfat12 failed:', e.stderr?.toString());
  process.exit(1);
}
const diskBytes = [...readFileSync(diskImgPath)];
console.log(`  Disk: ${diskBytes.length} bytes`);

// --- Step 4: Read kernel ---
const kernelBytes = [...readFileSync(KERNEL_SYS)];
console.log(`  Kernel: ${kernelBytes.length} bytes`);

// --- Step 5: Output path ---
if (!outputFile) {
  const base = basename(inputFile, extname(inputFile));
  outputFile = base + (htmlMode ? '.html' : '.css');
}

// --- Step 6: Generate CSS ---
console.log('Generating CSS...');
const memBytes = memOverride != null ? memOverride : 0xA0000;
const embData = [{ addr: DISK_LINEAR, bytes: diskBytes }];
const memoryZones = dosMemoryZones(kernelBytes, KERNEL_LINEAR, memBytes, embData, prune);

const totalAddresses = memoryZones.reduce((sum, [s, e]) => sum + (e - s), 0);
console.log(`  Memory: ${memoryZones.map(([s,e]) => `${(s/1024)|0}K-${(e/1024)|0}K`).join(', ')} (${(totalAddresses / 1024).toFixed(0)} KB total)`);

const outPath = resolve(outputFile);
const ws = createWriteStream(outPath, { encoding: 'utf-8' });

emitCSS({
  programBytes: kernelBytes,
  biosBytes,
  memoryZones,
  embeddedData: embData,
  htmlMode,
  programOffset: KERNEL_LINEAR,
  initialCS: 0xF000,
  initialIP: biosInitOffset,
  initialRegs: { SP: 0 },  // hardware reset — BIOS init sets SS:SP
  skipMicrocodeBios: true, // assembly BIOS handles INTs — no D6 microcode
}, ws);

ws.end(() => {
  const size = statSync(outPath).size;
  console.log(`Done: ${outPath} (${(size / 1024 / 1024).toFixed(1)} MB)`);
});
