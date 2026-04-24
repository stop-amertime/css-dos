// Stage 3 — invoke Kiln (the transpiler) to emit CSS.
//
// Input:  { bios, floppy (nullable for hack), manifest, kernelBytes,
//           programBytes, output, header }
//
//   kernelBytes   — DOS branch only: contents of dos/bin/kernel.sys as an
//                   Array<number>. The caller (builder/build.mjs on Node;
//                   web/browser-builder/main.mjs in the browser) loads these.
//   programBytes  — hack branch only: contents of the .COM file named in
//                   manifest.boot.raw as an Array<number>. Same ownership.
//
// Output: writes CSS to `output` (any object with a .write(string) method).

import { emitCSS } from '../../kiln/emit-css.mjs';
import { comMemoryZones, dosMemoryZones, buildIVTData } from '../../kiln/memory.mjs';
import { resolveMemorySize, autofitDosMem, DOS_MAX_MEM } from '../lib/sizes.mjs';

const KERNEL_LINEAR = 0x600; // DOS kernel load address

export function runKiln({ bios, floppy, manifest, kernelBytes, programBytes, output, header }) {
  const isHack = manifest.preset === 'hack';
  return isHack
    ? runKilnHack({ bios, manifest, programBytes, output, header })
    : runKilnDos({ bios, floppy, manifest, kernelBytes, output, header });
}

// Patch the corduroy BIOS's disk-geometry slots so INT 13h AH=02h/08h see
// the geometry the floppy was actually laid out with. Each field is
// preceded by a 4-byte ASCII anchor in handlers.asm; the patcher finds
// the anchor and writes the little-endian 16-bit value immediately after.
// For SPT we additionally patch disk_param_spt — an 8-bit sentinel
// (0xD4) in the INT 1Eh diskette parameter table that the reference
// BIOSes also expose.
const DISK_GEOM_ANCHORS = {
  spt:   [0x44, 0x47, 0x53, 0x50], // 'DGSP'
  heads: [0x44, 0x47, 0x48, 0x44], // 'DGHD'
  cyls:  [0x44, 0x47, 0x43, 0x59], // 'DGCY'
};
const DISK_PARAM_SPT_SENTINEL = 0xD4;

function findUnique(biosBytes, needle, label) {
  let found = -1;
  for (let i = 0; i + needle.length <= biosBytes.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (biosBytes[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) {
      if (found !== -1) {
        throw new Error(`BIOS patch: sentinel ${label} appears multiple times (offsets ${found}, ${i}).`);
      }
      found = i;
    }
  }
  if (found === -1) throw new Error(`BIOS patch: sentinel ${label} not found in bios.bin.`);
  return found;
}

function patchBiosDiskGeometry(biosBytes, geometry) {
  const { spt, heads, cyls } = geometry;
  if (spt > 0xFF || heads > 0xFF || cyls > 0xFF) {
    // AH=08h returns these in CL/DH/CH bytes, and the LBA math reads the
    // low byte of each word. Geometry must fit in a byte — pickFloppyGeometry
    // is responsible for ensuring that.
    throw new Error(`BIOS patch: geometry out of range (spt=${spt}, heads=${heads}, cyls=${cyls}); must fit in a byte each.`);
  }
  for (const [field, anchor] of Object.entries(DISK_GEOM_ANCHORS)) {
    const anchorOff = findUnique(biosBytes, anchor, `disk_geometry_${field} anchor`);
    const dataOff = anchorOff + anchor.length;
    biosBytes[dataOff]     = geometry[field] & 0xFF;
    biosBytes[dataOff + 1] = (geometry[field] >> 8) & 0xFF;
  }
  // disk_param_table's SPT byte is an 8-bit sentinel. Searching for a bare
  // 0xD4 would be ambiguous, so anchor the search with the surrounding
  // bytes — the table is `[0x02, 0xD4, 0x1B]` (bytes-per-sector=2, SPT,
  // gap-length=0x1B).
  const paramAnchor = [0x02, DISK_PARAM_SPT_SENTINEL, 0x1B];
  const paramOff = findUnique(biosBytes, paramAnchor, 'disk_param_spt');
  biosBytes[paramOff + 1] = spt & 0xFF;
}

// Patch the corduroy BIOS's `conventional_mem_kb` variable in-place, so
// install_bda writes the actual configured size into BDA. The kernel
// calls INT 12h (which corduroy's handler serves from the BDA value) to
// find the top of conventional memory and relocate its BIOS code there.
// If this lies — e.g. install_bda says 640 but actual RAM is 240 KB —
// the relocation lands in unmapped memory and boot dies silently.
// The variable is initialized to 0xBEEF in bios_init.c as a signature
// so we can find and replace it here without parsing a link map.
function patchBiosMemSize(biosBytes, memBytes) {
  const kb = Math.floor(memBytes / 1024);
  let found = -1;
  for (let i = 0; i + 1 < biosBytes.length; i++) {
    if (biosBytes[i] === 0xEF && biosBytes[i + 1] === 0xBE) {
      if (found !== -1) {
        throw new Error(`BIOS patch: signature 0xBEEF appears multiple times in bios.bin (offsets ${found}, ${i}). Pick a different signature.`);
      }
      found = i;
    }
  }
  if (found === -1) {
    throw new Error('BIOS patch: signature 0xBEEF not found in bios.bin. Is conventional_mem_kb still initialized to 0xBEEF?');
  }
  biosBytes[found]     = kb & 0xFF;
  biosBytes[found + 1] = (kb >> 8) & 0xFF;
}

// Patch the corduroy BIOS entry stub's hardcoded stack segment. entry.asm
// loads `mov ax, 0xBEEE` then `mov ss, ax; mov sp, 0xFFFE`; we rewrite the
// 0xBEEE immediate to `(memBytes - 0x10000) / 16` so the stack lives in a
// 64 KB window ending just before the configured memory top. Without this,
// the hardcoded 0x9000:FFFE stack falls outside autofit RAM and every
// push/ret corrupts the return chain — boot dies silently inside
// install_ivt's C prologue.
function patchBiosStackSeg(biosBytes, memBytes) {
  if (memBytes < 0x10000) {
    throw new Error(`BIOS patch: memBytes (${memBytes}) is below the 64 KB stack window. Increase memory.conventional.`);
  }
  const stackSeg = (memBytes - 0x10000) >> 4;
  let found = -1;
  for (let i = 0; i + 1 < biosBytes.length; i++) {
    if (biosBytes[i] === 0xEE && biosBytes[i + 1] === 0xBE) {
      if (found !== -1) {
        throw new Error(`BIOS patch: signature 0xBEEE appears multiple times in bios.bin (offsets ${found}, ${i}). Pick a different signature.`);
      }
      found = i;
    }
  }
  if (found === -1) {
    throw new Error('BIOS patch: signature 0xBEEE not found in bios.bin. Is entry.asm still loading `mov ax, 0xBEEE` before `mov ss, ax`?');
  }
  biosBytes[found]     = stackSeg & 0xFF;
  biosBytes[found + 1] = (stackSeg >> 8) & 0xFF;
}

// Autofit constants live in builder/lib/sizes.mjs so build.mjs can use
// them to resolve memBytes for the harness header before runKiln runs.

function runKilnDos({ bios, floppy, manifest, kernelBytes, output, header }) {
  if (!kernelBytes) throw new Error('runKilnDos: kernelBytes is required');

  let autofitBytes = DOS_MAX_MEM;
  const autorun = manifest.boot?.autorun;
  if (autorun && floppy?.layout) {
    const prog = floppy.layout.find(f => f.name === autorun.toUpperCase());
    if (prog?.size != null) autofitBytes = autofitDosMem(prog.size);
  }
  const memBytes = resolveMemorySize(manifest.memory?.conventional ?? 'autofit', { autofitBytes });
  if (bios.meta?.flavor === 'corduroy') {
    patchBiosMemSize(bios.bytes, memBytes);
    patchBiosStackSeg(bios.bytes, memBytes);
    if (floppy?.geometry) patchBiosDiskGeometry(bios.bytes, floppy.geometry);
  } else if (bios.meta?.flavor === 'muslin') {
    if (floppy?.geometry) patchBiosDiskGeometry(bios.bytes, floppy.geometry);
  }
  const prune = {
    gfx:     manifest.memory?.gfx === false,
    textVga: manifest.memory?.textVga === false,
    cgaGfx:  manifest.memory?.cgaGfx !== true,
  };

  // embeddedData is reserved for legacy "embedded disk" mode; with
  // the default rom-disk path, disk bytes come in via opts.diskBytes.
  const embData = [];
  const memoryZones = dosMemoryZones(kernelBytes, KERNEL_LINEAR, memBytes, embData, prune);

  emitCSS({
    programBytes:  kernelBytes,
    biosBytes:     bios.bytes,
    memoryZones,
    embeddedData:  embData,
    diskBytes:     floppy.bytes,
    programOffset: KERNEL_LINEAR,
    initialCS:     bios.entrySegment,
    initialIP:     bios.entryOffset,
    initialRegs:   { SP: 0 },
    header,
  }, output);
}

function runKilnHack({ bios, manifest, programBytes, output, header }) {
  if (!programBytes) throw new Error('hack cart missing programBytes');
  const programOffset = 0x100;

  const autofitBytes = Math.max(0x600, programOffset + programBytes.length + 0x100);
  const memBytes = resolveMemorySize(manifest.memory?.conventional ?? 'autofit', { autofitBytes });

  const prune = {
    gfx:     manifest.memory?.gfx !== true,     // opt-in for hack carts
    cgaGfx:  manifest.memory?.cgaGfx !== true,  // opt-in for hack carts
  };

  const embeddedData = [buildIVTData()];
  const memoryZones = comMemoryZones(programBytes, programOffset, memBytes, prune);

  emitCSS({
    programBytes,
    biosBytes:     bios.bytes,
    memoryZones,
    embeddedData,
    programOffset,
    header,
  }, output);
}
