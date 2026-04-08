#!/usr/bin/env node
// mkfat12.mjs — Create a minimal FAT12 floppy disk image
//
// Usage: node mkfat12.mjs -o disk.img [--file NAME LOCAL_PATH] ...
//
// Creates a 1.44MB FAT12 floppy image with the specified files in the
// root directory. Used to build a bootable DOS disk image for CSS-DOS.
//
// Supports subdirectories: --file DATA\ZORK1.DAT path/to/zork1.dat
// will create a DATA subdirectory and place ZORK1.DAT inside it.
//
// Example:
//   node mkfat12.mjs -o disk.img \
//     --file KERNEL.SYS dos/bin/kernel.sys \
//     --file CONFIG.SYS dos/config.sys \
//     --file MYPROG.COM examples/fib.com \
//     --file DATA\GAME.DAT examples/game.dat

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// --- FAT12 1.44MB floppy geometry ---
const SECTOR_SIZE = 512;
const SECTORS_PER_TRACK = 18;
const HEADS = 2;
const CYLINDERS = 80;
const TOTAL_SECTORS = SECTORS_PER_TRACK * HEADS * CYLINDERS; // 2880
const DISK_SIZE = TOTAL_SECTORS * SECTOR_SIZE; // 1,474,560

// FAT12 layout
const RESERVED_SECTORS = 1;    // boot sector
const NUM_FATS = 2;
const FAT_SECTORS = 9;         // each FAT is 9 sectors for 1.44MB
const ROOT_DIR_ENTRIES = 224;  // standard for 1.44MB
const ROOT_DIR_SECTORS = Math.ceil(ROOT_DIR_ENTRIES * 32 / SECTOR_SIZE); // 14
const DATA_START_SECTOR = RESERVED_SECTORS + NUM_FATS * FAT_SECTORS + ROOT_DIR_SECTORS;
// = 1 + 2*9 + 14 = 33

// --- Parse arguments ---
const args = process.argv.slice(2);
let outputFile = null;
const files = []; // [{name, data}]  name may contain backslash for subdirs

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' && i + 1 < args.length) {
    outputFile = args[++i];
  } else if (args[i] === '--file' && i + 2 < args.length) {
    const name = args[++i].toUpperCase().replace(/\//g, '\\');
    const path = args[++i];
    const data = [...readFileSync(resolve(path))];
    files.push({ name, data });
  }
}

if (!outputFile) {
  console.error('Usage: node mkfat12.mjs -o disk.img [--file NAME PATH] ...');
  process.exit(1);
}

// --- Create disk image ---
const disk = new Uint8Array(DISK_SIZE);

// --- Boot sector (sector 0) ---
// Jump instruction
disk[0] = 0xEB; disk[1] = 0x3C; disk[2] = 0x90; // jmp short 0x3E; nop

// OEM name
writeString(disk, 3, 'CSSDOS  ');

// BIOS Parameter Block (BPB)
writeWord(disk, 11, SECTOR_SIZE);          // bytes per sector
disk[13] = 1;                               // sectors per cluster
writeWord(disk, 14, RESERVED_SECTORS);     // reserved sectors
disk[16] = NUM_FATS;                        // number of FATs
writeWord(disk, 17, ROOT_DIR_ENTRIES);     // root dir entries
writeWord(disk, 19, TOTAL_SECTORS);        // total sectors (16-bit)
disk[21] = 0xF0;                            // media descriptor (1.44MB floppy)
writeWord(disk, 22, FAT_SECTORS);          // sectors per FAT
writeWord(disk, 24, SECTORS_PER_TRACK);    // sectors per track
writeWord(disk, 26, HEADS);               // number of heads
writeDword(disk, 28, 0);                   // hidden sectors
writeDword(disk, 32, 0);                   // total sectors (32-bit, 0 since <65536)

// Extended boot record
disk[36] = 0x00;                            // drive number (floppy)
disk[37] = 0x00;                            // reserved
disk[38] = 0x29;                            // extended boot signature
writeDword(disk, 39, 0x12345678);          // volume serial number
writeString(disk, 43, 'CSS-DOS    ');      // volume label (11 chars)
writeString(disk, 54, 'FAT12   ');         // filesystem type

// Boot code — minimal: just print a message and halt
// We don't actually boot from this sector; the BIOS loads the kernel directly.
// But DOS kernel reads the BPB from the boot drive to understand disk geometry.
const bootCode = [
  0xFA,                     // cli
  0xEB, 0xFE,              // jmp $ (halt)
];
for (let i = 0; i < bootCode.length; i++) {
  disk[0x3E + i] = bootCode[i];
}

// Boot signature
disk[510] = 0x55;
disk[511] = 0xAA;

// --- Initialize FATs ---
// FAT12: first two entries are reserved
// Entry 0: media descriptor | 0xF00
// Entry 1: 0xFFF (end of chain marker)
const fat1Start = RESERVED_SECTORS * SECTOR_SIZE;
const fat2Start = (RESERVED_SECTORS + FAT_SECTORS) * SECTOR_SIZE;

// FAT12 entries are 12 bits each, packed in 1.5 bytes
// Entry 0 = 0xFF0, Entry 1 = 0xFFF
// Bytes: F0 FF FF
disk[fat1Start + 0] = 0xF0;
disk[fat1Start + 1] = 0xFF;
disk[fat1Start + 2] = 0xFF;
disk[fat2Start + 0] = 0xF0;
disk[fat2Start + 1] = 0xFF;
disk[fat2Start + 2] = 0xFF;

// --- Write files ---
let nextCluster = 2; // first data cluster
const rootDirStart = (RESERVED_SECTORS + NUM_FATS * FAT_SECTORS) * SECTOR_SIZE;
let rootDirEntryOffset = 0;

// Track subdirectories: dirName -> { cluster, entryOffset (bytes used within cluster) }
const subdirs = new Map();

// Separate files into root-level and subdirectory files
const rootFiles = [];
const subdirFiles = []; // [{dirName, fileName, data}]

for (const file of files) {
  const backslash = file.name.indexOf('\\');
  if (backslash >= 0) {
    const dirName = file.name.substring(0, backslash);
    const fileName = file.name.substring(backslash + 1);
    subdirFiles.push({ dirName, fileName, data: file.data });
  } else {
    rootFiles.push(file);
  }
}

// Write root-level files first
for (const file of rootFiles) {
  writeFileToDir(file.name, file.data, 'root');
}

// Create subdirectories and write their files
for (const sf of subdirFiles) {
  ensureSubdir(sf.dirName);
  writeFileToDir(sf.fileName, sf.data, sf.dirName);
}

// --- Write volume label in root directory ---
if (rootDirEntryOffset < ROOT_DIR_ENTRIES * 32) {
  const entryOff = rootDirStart + rootDirEntryOffset;
  writeString(disk, entryOff, 'CSS-DOS    '); // 11 chars
  disk[entryOff + 11] = 0x08;                 // volume label attribute
  rootDirEntryOffset += 32;
}

// --- Write disk image ---
writeFileSync(resolve(outputFile), disk);
console.log(`Created ${outputFile} (${DISK_SIZE} bytes, ${files.length} files)`);

// ============================================================
// Directory and file writing
// ============================================================

function ensureSubdir(dirName) {
  if (subdirs.has(dirName)) return;

  // Allocate one cluster for the directory
  const dirCluster = nextCluster++;
  const dirDataOffset = (DATA_START_SECTOR + (dirCluster - 2)) * SECTOR_SIZE;

  // Mark cluster as end-of-chain in FAT
  writeFAT12Entry(disk, fat1Start, dirCluster, 0xFFF);
  writeFAT12Entry(disk, fat2Start, dirCluster, 0xFFF);

  // Zero the cluster (already zero from Uint8Array init, but be explicit)
  for (let i = 0; i < SECTOR_SIZE; i++) {
    disk[dirDataOffset + i] = 0;
  }

  // Write "." entry — points to self
  const { name83: dotName } = parse83Name('.');
  const dotOff = dirDataOffset;
  writeString(disk, dotOff, '.          '); // padded to 11
  disk[dotOff + 11] = 0x10; // directory attribute
  writeWord(disk, dotOff + 26, dirCluster);

  // Write ".." entry — points to root (cluster 0 for root)
  const dotdotOff = dirDataOffset + 32;
  writeString(disk, dotdotOff, '..         '); // padded to 11
  disk[dotdotOff + 11] = 0x10;
  writeWord(disk, dotdotOff + 26, 0); // 0 = root directory

  // Add directory entry in root directory
  if (rootDirEntryOffset >= ROOT_DIR_ENTRIES * 32) {
    console.error(`Error: root directory full, cannot create ${dirName}`);
    process.exit(1);
  }
  const { name83 } = parse83Name(dirName);
  const entryOff = rootDirStart + rootDirEntryOffset;
  writeString(disk, entryOff, name83);
  disk[entryOff + 11] = 0x10; // directory attribute
  writeWord(disk, entryOff + 26, dirCluster);
  writeDword(disk, entryOff + 28, 0); // directory size = 0 in FAT12
  rootDirEntryOffset += 32;

  console.log(`  ${dirName}\\ — directory, cluster ${dirCluster}`);

  subdirs.set(dirName, { cluster: dirCluster, entryOffset: 64 }); // 64 = after . and ..
}

function writeFileToDir(name, data, dir) {
  const fileSize = data.length;
  const clustersNeeded = Math.ceil(fileSize / SECTOR_SIZE) || 1;
  const { name83 } = parse83Name(name);
  const startCluster = nextCluster;

  // Write file data to data region
  const dataOffset = (DATA_START_SECTOR + (startCluster - 2)) * SECTOR_SIZE;
  for (let i = 0; i < fileSize; i++) {
    if (dataOffset + i >= DISK_SIZE) {
      console.error(`Error: disk full writing ${name}`);
      process.exit(1);
    }
    disk[dataOffset + i] = data[i];
  }

  // Write FAT chain
  for (let c = 0; c < clustersNeeded; c++) {
    const cluster = startCluster + c;
    const nextVal = (c === clustersNeeded - 1) ? 0xFFF : cluster + 1;
    writeFAT12Entry(disk, fat1Start, cluster, nextVal);
    writeFAT12Entry(disk, fat2Start, cluster, nextVal);
  }

  // Write directory entry
  if (dir === 'root') {
    if (rootDirEntryOffset >= ROOT_DIR_ENTRIES * 32) {
      console.error(`Error: root directory full, cannot add ${name}`);
      process.exit(1);
    }
    const entryOff = rootDirStart + rootDirEntryOffset;
    writeString(disk, entryOff, name83);
    disk[entryOff + 11] = 0x20; // archive attribute
    writeWord(disk, entryOff + 26, startCluster);
    writeDword(disk, entryOff + 28, fileSize);
    rootDirEntryOffset += 32;
  } else {
    const sub = subdirs.get(dir);
    if (!sub) {
      console.error(`Error: subdirectory ${dir} not found`);
      process.exit(1);
    }
    // Check if subdir cluster has space (512 bytes / 32 = 16 entries max per cluster)
    if (sub.entryOffset >= SECTOR_SIZE) {
      console.error(`Error: subdirectory ${dir} full (max 14 files per subdir)`);
      process.exit(1);
    }
    const dirDataOffset = (DATA_START_SECTOR + (sub.cluster - 2)) * SECTOR_SIZE;
    const entryOff = dirDataOffset + sub.entryOffset;
    writeString(disk, entryOff, name83);
    disk[entryOff + 11] = 0x20; // archive attribute
    writeWord(disk, entryOff + 26, startCluster);
    writeDword(disk, entryOff + 28, fileSize);
    sub.entryOffset += 32;
  }

  const dirLabel = dir === 'root' ? '' : `${dir}\\`;
  console.log(`  ${dirLabel}${name} — ${fileSize} bytes, clusters ${startCluster}-${startCluster + clustersNeeded - 1}`);

  nextCluster += clustersNeeded;
}

// ============================================================
// Helpers
// ============================================================

function writeWord(buf, offset, val) {
  buf[offset] = val & 0xFF;
  buf[offset + 1] = (val >> 8) & 0xFF;
}

function writeDword(buf, offset, val) {
  buf[offset] = val & 0xFF;
  buf[offset + 1] = (val >> 8) & 0xFF;
  buf[offset + 2] = (val >> 16) & 0xFF;
  buf[offset + 3] = (val >> 24) & 0xFF;
}

function writeString(buf, offset, str) {
  for (let i = 0; i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i);
  }
}

function parse83Name(name) {
  // Convert "KERNEL.SYS" → "KERNEL  SYS"
  const dot = name.indexOf('.');
  let base, ext;
  if (dot >= 0) {
    base = name.substring(0, dot);
    ext = name.substring(dot + 1);
  } else {
    base = name;
    ext = '';
  }
  base = base.toUpperCase().padEnd(8, ' ').substring(0, 8);
  ext = ext.toUpperCase().padEnd(3, ' ').substring(0, 3);
  return { name83: base + ext };
}

function writeFAT12Entry(buf, fatStart, cluster, value) {
  // FAT12: 12-bit entries packed in 1.5 bytes
  const offset = Math.floor(cluster * 3 / 2);
  if (cluster % 2 === 0) {
    // Even cluster: low 8 bits in byte[offset], high 4 bits in low nibble of byte[offset+1]
    buf[fatStart + offset] = value & 0xFF;
    buf[fatStart + offset + 1] = (buf[fatStart + offset + 1] & 0xF0) | ((value >> 8) & 0x0F);
  } else {
    // Odd cluster: low 4 bits in high nibble of byte[offset], high 8 bits in byte[offset+1]
    buf[fatStart + offset] = (buf[fatStart + offset] & 0x0F) | ((value << 4) & 0xF0);
    buf[fatStart + offset + 1] = (value >> 4) & 0xFF;
  }
}
