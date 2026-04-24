// Size preset parsing. Strings are presets ("640K", "1440K", "autofit"),
// numbers are exact bytes.

const MEMORY_PRESETS = {
  '4K':   4 * 1024,
  '64K':  64 * 1024,
  '128K': 128 * 1024,
  '256K': 256 * 1024,
  '512K': 512 * 1024,
  '640K': 640 * 1024,
};

// Standard floppy sizes + their canonical CHS geometries. Used by autofit
// when content fits in a real floppy, and as the set of accepted string
// values for `disk.size`. For larger disks we fabricate a geometry instead
// (see pickFloppyGeometry).
const FLOPPY_PRESETS = {
  '360K':  { bytes:  360 * 1024, cyls: 40, heads: 2, spt:  9 },
  '720K':  { bytes:  720 * 1024, cyls: 80, heads: 2, spt:  9 },
  '1200K': { bytes: 1200 * 1024, cyls: 80, heads: 2, spt: 15 },
  '1440K': { bytes: 1440 * 1024, cyls: 80, heads: 2, spt: 18 },
  '2880K': { bytes: 2880 * 1024, cyls: 80, heads: 2, spt: 36 },
};

const SECTOR_SIZE = 512;
const LBA_MAX_SECTORS = 65535; // CSS disk-byte dispatch: LBA is 16-bit

export function resolveMemorySize(value, { autofitBytes } = {}) {
  if (typeof value === 'number') return value;
  if (value === 'autofit') {
    if (autofitBytes == null) {
      throw new Error("memory.conventional: 'autofit' requires a context-provided size");
    }
    return autofitBytes;
  }
  if (MEMORY_PRESETS[value] != null) return MEMORY_PRESETS[value];
  throw new Error(`memory.conventional: unknown value ${JSON.stringify(value)}`);
}

// DOS autofit constants — shared by build.mjs (for harness-header memory
// resolution) and stages/kiln.mjs (the canonical consumer). Kept here so
// the two paths can't drift.
//
// DOS layout assumed:
//   0x00000 - 0x00600   IVT + BDA (1.5 KB, always)
//   0x00600 - 0x1A000   kernel image + decompressed code (~105 KB)
//   0x1A000 - ...       TPA: loaded program + stack + DOS heap
//   top ~104 KB         DOS kernel high area (relocated at boot via INT 12h)
export const DOS_TPA_BASE     = 0x1A000;   // kernel image + decompressed code
export const DOS_HIGH_AREA    = 0x1A000;   // kernel high area at the top
export const DOS_STACK_BUDGET = 0x10000;   // 64 KB stack + heap headroom
export const DOS_MIN_MEM      = 0x20000;   // 128 KB floor
export const DOS_MAX_MEM      = 0xA0000;   // 640 KB cap
export const DOS_MEM_ALIGN    = 0x4000;    // 16 KB granularity

export function autofitDosMem(programSize) {
  const raw = DOS_TPA_BASE + programSize + DOS_STACK_BUDGET + DOS_HIGH_AREA;
  const aligned = Math.ceil(raw / DOS_MEM_ALIGN) * DOS_MEM_ALIGN;
  return Math.min(DOS_MAX_MEM, Math.max(DOS_MIN_MEM, aligned));
}

// Autofit for hack-preset .COM carts. Fits program + 256 bytes of headroom.
export function autofitHackMem(programSize) {
  return Math.max(0x600, 0x100 + programSize + 0x100);
}

// Resolve a disk size request into { bytes, geometry }.
//
// Value forms:
//   'autofit'  — if autofitBytes fits in a standard preset, use that preset
//                (preserves the look of a real period-accurate floppy). If
//                it doesn't, size exactly to content (sector-aligned, small
//                headroom) and fabricate a geometry — "big floppy" mode.
//   'NNNNK'    — named preset (360K/720K/1200K/1440K/2880K). Canonical CHS.
//   number     — exact bytes. Fabricated geometry.
//
// Geometry: {cyls, heads, spt}. Matches real hardware for standard sizes;
// for fabricated sizes we keep heads=2/spt=18 (1.44 MB floppy style) and
// scale cyls. Total addressable sectors = cyls*heads*spt.
export function resolveFloppySize(value, { autofitBytes } = {}) {
  if (typeof value === 'number') {
    return { bytes: value, geometry: pickFloppyGeometry(value) };
  }
  if (value === 'autofit') {
    const needed = autofitBytes ?? FLOPPY_PRESETS['1440K'].bytes;
    // Account for FAT12 overhead (boot sector + 2 FATs + root dir) plus
    // a small slack for per-file cluster rounding. A standard 1.44 MB
    // floppy reserves ~33 sectors for overhead; round that up to be safe
    // and add a further 5% for cluster slack. Preset rounding uses this
    // "effective needed" value.
    const effectiveNeeded = Math.ceil(needed * 1.05) + 40 * SECTOR_SIZE;
    // If content plus overhead fits in a standard floppy, round up to
    // that preset so the cabinet looks like a real period-accurate floppy.
    const presets = Object.entries(FLOPPY_PRESETS).sort((a, b) => a[1].bytes - b[1].bytes);
    for (const [, p] of presets) {
      if (p.bytes >= effectiveNeeded) return { bytes: p.bytes, geometry: { cyls: p.cyls, heads: p.heads, spt: p.spt } };
    }
    // Otherwise fabricate: sector-align + 10% headroom (min 64 sectors).
    const dataSectors = Math.ceil(effectiveNeeded / SECTOR_SIZE);
    const totalSectors = Math.max(64, dataSectors + Math.ceil(dataSectors * 0.1));
    const bytes = totalSectors * SECTOR_SIZE;
    return { bytes, geometry: pickFloppyGeometry(bytes) };
  }
  if (FLOPPY_PRESETS[value] != null) {
    const p = FLOPPY_PRESETS[value];
    return { bytes: p.bytes, geometry: { cyls: p.cyls, heads: p.heads, spt: p.spt } };
  }
  throw new Error(`disk.size: unknown value ${JSON.stringify(value)}`);
}

// Pick a geometry for an arbitrary disk size. For known preset sizes, use
// the canonical CHS. Otherwise keep heads=2/spt=18 and scale cyls so
// cyls*heads*spt >= totalSectors. Max addressable is LBA_MAX_SECTORS
// (16-bit LBA in the rom-disk window), which is ~32 MB — a hard cap we
// enforce here rather than letting silent truncation bite later.
export function pickFloppyGeometry(sizeBytes) {
  const totalSectors = Math.ceil(sizeBytes / SECTOR_SIZE);
  if (totalSectors > LBA_MAX_SECTORS) {
    throw new Error(
      `disk.size: ${sizeBytes} bytes (${totalSectors} sectors) exceeds the ` +
      `${LBA_MAX_SECTORS}-sector rom-disk cap (~${Math.floor(LBA_MAX_SECTORS * SECTOR_SIZE / 1024 / 1024)} MB). ` +
      `Trim the cart or widen the LBA register.`
    );
  }
  for (const p of Object.values(FLOPPY_PRESETS)) {
    if (p.bytes === sizeBytes) return { cyls: p.cyls, heads: p.heads, spt: p.spt };
  }
  // Fabricated floppy: keep the 1.44 MB-style heads=2/spt=18 shape, scale
  // cylinders. CH in INT 13h CHS is one byte → max 256 cylinders. With
  // heads=2/spt=18 that's 256*2*18 = 9216 sectors = 4.6 MB. For anything
  // bigger we bump SPT (stays within the BPB spt word which is 16-bit).
  let heads = 2, spt = 18;
  let cyls = Math.ceil(totalSectors / (heads * spt));
  if (cyls > 255) {
    // Scale SPT up so cyls fits in a byte. Keep it even.
    spt = Math.ceil(totalSectors / (heads * 255));
    if (spt % 2) spt += 1;
    cyls = Math.ceil(totalSectors / (heads * spt));
  }
  return { cyls, heads, spt };
}
