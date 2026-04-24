#!/usr/bin/env node
// mkfat12.mjs — Create a minimal FAT12 floppy disk image
//
// Usage: node mkfat12.mjs -o disk.img [--file NAME LOCAL_PATH] ...
//
// Creates a FAT12 floppy image with the specified files in the root directory.
// Used to build a bootable DOS disk image for CSS-DOS.
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

// ============================================================
// Pure function — no fs I/O
// ============================================================

/**
 * Build a FAT12 floppy disk image in memory.
 *
 * @param {Array<{name: string, bytes: Uint8Array}>} files
 *   Files to include. `name` may use backslash for a single subdirectory
 *   level, e.g. `"DATA\\ZORK1.DAT"`. Names are uppercased automatically.
 * @param {{cyls: number, heads: number, spt: number, totalSectors?: number}} [geometry]
 *   Optional geometry. If provided, the disk is sized to `totalSectors *
 *   512` (or `cyls*heads*spt*512` if totalSectors omitted) and the BPB
 *   records this geometry. If omitted, the disk is auto-sized to fit
 *   content and uses a generic 1.44 MB-style 2/18 geometry.
 * @returns {Uint8Array} Raw FAT12 disk image.
 */
export function buildFat12Image(files, geometry) {
  // Validate input: each file must have a string name and Uint8Array bytes.
  for (const f of files) {
    if (!f || typeof f.name !== 'string' || !(f.bytes instanceof Uint8Array)) {
      throw new Error(
        `buildFat12Image: each file must be {name: string, bytes: Uint8Array}; got ` +
        JSON.stringify(f, (k, v) => v instanceof Uint8Array ? `Uint8Array(${v.length})` : v),
      );
    }
  }

  // Normalise input: uppercase names, convert / to \
  const normFiles = files.map(f => ({
    name: f.name.toUpperCase().replace(/\//g, '\\'),
    data: f.bytes,
  }));

  // --- FAT12 geometry — auto-sized to fit content ---
  const SECTOR_SIZE = 512;
  const RESERVED_SECTORS = 1;    // boot sector
  const NUM_FATS = 2;
  const ROOT_DIR_ENTRIES = 224;  // standard 1.44 MB floppy root dir (14 sectors)
  const ROOT_DIR_SECTORS = Math.ceil(ROOT_DIR_ENTRIES * 32 / SECTOR_SIZE); // 14
  // FAT12 caps out at 4084 clusters (4085+ means DOS detects FAT16). We must
  // keep cluster count below this for every possible `dataSectors/spc`
  // computation DOS will do. Use 4084 as the hard max.
  const FAT12_MAX_CLUSTERS = 4084;

  // --- Compute content size ---
  let contentSectorsNeeded = 0;
  for (const file of normFiles) {
    contentSectorsNeeded += Math.ceil(file.data.length / SECTOR_SIZE) || 1;
  }
  // Add 1 cluster per unique subdirectory
  const uniqueDirs = new Set();
  for (const file of normFiles) {
    const backslash = file.name.indexOf('\\');
    if (backslash >= 0) uniqueDirs.add(file.name.substring(0, backslash));
  }
  contentSectorsNeeded += uniqueDirs.size;

  // Total sectors: use caller-provided geometry if given (keeps BPB and
  // BIOS geometry in lockstep), otherwise auto-size with 10% headroom.
  let TOTAL_SECTORS, HEADS, SECTORS_PER_TRACK;
  if (geometry) {
    HEADS = geometry.heads;
    SECTORS_PER_TRACK = geometry.spt;
    TOTAL_SECTORS = geometry.totalSectors
      ?? (geometry.cyls * geometry.heads * geometry.spt);
    // Validation (size fits content) happens below, after SPC is picked,
    // because SPC cluster rounding changes "sectors needed".
  } else {
    // Auto-sized: 10% headroom over content. SPC sizing below will still
    // apply if this happens to land past the 4085-cluster line.
    TOTAL_SECTORS = Math.max(64, RESERVED_SECTORS + NUM_FATS + ROOT_DIR_SECTORS +
      contentSectorsNeeded + Math.ceil(contentSectorsNeeded * 0.1));
    HEADS = 2;
    SECTORS_PER_TRACK = 18;
  }

  // --- Pick sectorsPerCluster so total dataClusters stays <= FAT12 max ---
  //
  // The problem: DOS re-computes dataClusters = (TOTAL_SECTORS - dataStart) / SPC
  // when it mounts the filesystem, and if dataClusters > 4085 it switches to
  // FAT16 interpretation — reading our 12-bit entries as 16-bit, walking the
  // wrong FAT chain, and failing any read past the first sector of a
  // multi-cluster file. We must keep dataClusters <= 4084 for *every* total
  // sector count, not just "clusters our content actually occupies".
  //
  // So SPC is driven by TOTAL_SECTORS, not by contentSectorsNeeded. We start
  // at SPC=1 and double until dataClusters <= FAT12_MAX_CLUSTERS.
  let SECTORS_PER_CLUSTER = 1;
  let FAT_SECTORS, DATA_START_SECTOR, dataSectors, dataClusters;
  for (;;) {
    // dataClusters that DOS will compute on mount = floor((TOTAL - dataStart) / SPC).
    // We need to keep this <= FAT12_MAX_CLUSTERS. Compute it iteratively
    // because FAT_SECTORS depends on dataClusters and dataStart depends on
    // FAT_SECTORS — converges in one or two passes.
    //
    // FAT_SECTORS is content-based, not whole-disk-based: only the clusters
    // we actually allocate (content + 2 reserved entries) need FAT entries.
    // The unused tail of each FAT is zero bytes, which is "free cluster" —
    // legal FAT12 even though we'd never write there. This keeps the layout
    // identical to the historical (working) shape for zork1 and doom.
    const clustersNeededForContent = Math.ceil(contentSectorsNeeded / SECTORS_PER_CLUSTER);
    const allocatedClusters = clustersNeededForContent + 2; // +2 for reserved entries
    FAT_SECTORS = Math.max(1, Math.ceil((allocatedClusters * 3 / 2) / SECTOR_SIZE));
    DATA_START_SECTOR = RESERVED_SECTORS + NUM_FATS * FAT_SECTORS + ROOT_DIR_SECTORS;
    dataSectors = TOTAL_SECTORS - DATA_START_SECTOR;
    if (dataSectors < 0) {
      throw new Error(
        `buildFat12Image: geometry (${TOTAL_SECTORS} sectors) is too small; ` +
        `FAT overhead (${DATA_START_SECTOR} sectors) leaves no room for data.`
      );
    }
    // The cluster count DOS computes on mount.
    dataClusters = Math.floor(dataSectors / SECTORS_PER_CLUSTER);
    if (dataClusters <= FAT12_MAX_CLUSTERS) break;
    SECTORS_PER_CLUSTER *= 2;
    // sanity cap: SPC=128 would be absurd even for huge disks.
    if (SECTORS_PER_CLUSTER > 128) {
      throw new Error(
        `buildFat12Image: disk too big to stay FAT12 (${TOTAL_SECTORS} sectors); ` +
        `needs FAT16.`
      );
    }
  }

  // Verify content actually fits in the data region.
  const clustersForContent = Math.ceil(contentSectorsNeeded / SECTORS_PER_CLUSTER);
  if (clustersForContent > dataClusters) {
    throw new Error(
      `buildFat12Image: content needs ${clustersForContent} clusters ` +
      `but disk only has ${dataClusters} data clusters at SPC=${SECTORS_PER_CLUSTER}.`
    );
  }

  const DISK_SIZE = TOTAL_SECTORS * SECTOR_SIZE;

  // --- Create disk image ---
  const disk = new Uint8Array(DISK_SIZE);

  // --- Boot sector (sector 0) ---
  disk[0] = 0xEB; disk[1] = 0x3C; disk[2] = 0x90;
  writeString(disk, 3, 'CSSDOS  ');

  // BIOS Parameter Block (BPB)
  writeWord(disk, 11, SECTOR_SIZE);
  disk[13] = SECTORS_PER_CLUSTER;             // sectors per cluster
  writeWord(disk, 14, RESERVED_SECTORS);
  disk[16] = NUM_FATS;
  writeWord(disk, 17, ROOT_DIR_ENTRIES);
  // totalSectors: fits in the 16-bit field at offset 19 up to 65535.
  // Beyond that the 16-bit field must be 0 and the true count goes in the
  // 32-bit field at offset 32. FAT12 rarely exceeds 65535 sectors in
  // practice, but this is what the spec says to do.
  if (TOTAL_SECTORS <= 0xFFFF) {
    writeWord(disk, 19, TOTAL_SECTORS);
  } else {
    writeWord(disk, 19, 0);
  }
  disk[21] = 0xF0;                            // media descriptor
  writeWord(disk, 22, FAT_SECTORS);
  writeWord(disk, 24, SECTORS_PER_TRACK);
  writeWord(disk, 26, HEADS);
  writeDword(disk, 28, 0);
  writeDword(disk, 32, TOTAL_SECTORS > 0xFFFF ? TOTAL_SECTORS : 0);

  // Extended boot record
  disk[36] = 0x00; disk[37] = 0x00; disk[38] = 0x29;
  writeDword(disk, 39, 0x12345678);
  writeString(disk, 43, 'CSS-DOS    ');
  writeString(disk, 54, 'FAT12   ');

  // Boot code
  disk[0x3E] = 0xFA; disk[0x3F] = 0xEB; disk[0x40] = 0xFE;
  disk[510] = 0x55; disk[511] = 0xAA;

  // --- Initialize FATs ---
  const fat1Start = RESERVED_SECTORS * SECTOR_SIZE;
  const fat2Start = (RESERVED_SECTORS + FAT_SECTORS) * SECTOR_SIZE;

  // Cluster indexing helpers (used by ensureSubdir / writeFileToDir closures).
  // Defined here so they're initialized before the writer closures are invoked.
  const CLUSTER_BYTES = SECTOR_SIZE * SECTORS_PER_CLUSTER;
  const clusterOffset = (cluster) =>
    (DATA_START_SECTOR + (cluster - 2) * SECTORS_PER_CLUSTER) * SECTOR_SIZE;
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

  for (const file of normFiles) {
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

  return disk;

  // ============================================================
  // Directory and file writing (closures over disk, nextCluster, etc.)
  // ============================================================

  function ensureSubdir(dirName) {
    if (subdirs.has(dirName)) return;

    // Allocate one cluster for the directory
    const dirCluster = nextCluster++;
    const dirDataOffset = clusterOffset(dirCluster);

    // Mark cluster as end-of-chain in FAT
    writeFAT12Entry(disk, fat1Start, dirCluster, 0xFFF);
    writeFAT12Entry(disk, fat2Start, dirCluster, 0xFFF);

    // Zero the cluster (already zero from Uint8Array init, but be explicit)
    for (let i = 0; i < CLUSTER_BYTES; i++) {
      disk[dirDataOffset + i] = 0;
    }

    // Write "." entry — points to self
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
      throw new Error(`root directory full, cannot create ${dirName}`);
    }
    const { name83 } = parse83Name(dirName);
    const entryOff = rootDirStart + rootDirEntryOffset;
    writeString(disk, entryOff, name83);
    disk[entryOff + 11] = 0x10; // directory attribute
    writeWord(disk, entryOff + 26, dirCluster);
    writeDword(disk, entryOff + 28, 0); // directory size = 0 in FAT12
    rootDirEntryOffset += 32;

    subdirs.set(dirName, { cluster: dirCluster, entryOffset: 64 }); // 64 = after . and ..
  }

  function writeFileToDir(name, data, dir) {
    const fileSize = data.length;
    // Cluster is the allocation unit, not sector — at SPC>1 a one-sector
    // file still occupies a full cluster.
    const clustersNeeded = Math.ceil(fileSize / CLUSTER_BYTES) || 1;
    const { name83 } = parse83Name(name);
    const startCluster = nextCluster;

    // Write file data to data region
    const dataOffset = clusterOffset(startCluster);
    for (let i = 0; i < fileSize; i++) {
      if (dataOffset + i >= DISK_SIZE) {
        throw new Error(`disk full writing ${name}`);
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
        throw new Error(`root directory full, cannot add ${name}`);
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
        throw new Error(`subdirectory ${dir} not found`);
      }
      // Subdir cluster holds CLUSTER_BYTES/32 dirents (16 per sector).
      if (sub.entryOffset >= CLUSTER_BYTES) {
        throw new Error(
          `subdirectory ${dir} full (max ${CLUSTER_BYTES/32 - 2} files per subdir)`
        );
      }
      const dirDataOffset = clusterOffset(sub.cluster);
      const entryOff = dirDataOffset + sub.entryOffset;
      writeString(disk, entryOff, name83);
      disk[entryOff + 11] = 0x20; // archive attribute
      writeWord(disk, entryOff + 26, startCluster);
      writeDword(disk, entryOff + 28, fileSize);
      sub.entryOffset += 32;
    }

    nextCluster += clustersNeeded;
  }
}

// ============================================================
// Helpers (module-level, used by buildFat12Image and CLI)
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

// ============================================================
// CLI entry point — only runs when invoked directly
// ============================================================

// Detect whether this module is the entry point (works for both CJS and ESM).
// The typeof guard is required: `process` is undefined in browsers, and a bare
// reference at module top level would throw ReferenceError before the if-check.
const isMain = typeof process !== 'undefined' && process.argv[1] &&
  (process.argv[1].endsWith('mkfat12.mjs') || process.argv[1].endsWith('mkfat12'));

if (isMain) {
  import('fs').then(({ readFileSync, writeFileSync }) => {
    import('path').then(({ resolve }) => {
      const args = process.argv.slice(2);
      let outputFile = null;
      const cliFiles = []; // [{name, bytes}]

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-o' && i + 1 < args.length) {
          outputFile = args[++i];
        } else if (args[i] === '--file' && i + 2 < args.length) {
          const name = args[++i];
          const path = args[++i];
          const bytes = readFileSync(resolve(path));
          cliFiles.push({ name, bytes });
        }
      }

      if (!outputFile) {
        console.error('Usage: node mkfat12.mjs -o disk.img [--file NAME PATH] ...');
        process.exit(1);
      }

      const disk = buildFat12Image(cliFiles);

      // Print layout info (mirrors the old per-file log output)
      for (const f of cliFiles) {
        const name = f.name.toUpperCase().replace(/\//g, '\\');
        console.log(`  ${name} — ${f.bytes.length} bytes`);
      }

      writeFileSync(resolve(outputFile), disk);
      const TOTAL_SECTORS = disk.length / 512;
      console.log(`Created ${outputFile} (${disk.length} bytes, ${cliFiles.length} files, ${TOTAL_SECTORS} sectors)`);
    });
  });
}
