#!/usr/bin/env node
// Rasterize a (vga.bin, dac.bin) pair to a PNG.
// Usage: rasterize-mode13.mjs <vga.bin> <dac.bin> <out.png>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const [vgaP, dacP, outP] = process.argv.slice(2);
if (!vgaP || !dacP || !outP) {
  console.error('usage: rasterize-mode13.mjs <vga.bin> <dac.bin> <out.png>');
  process.exit(2);
}

import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.subarray(y * w * 4, (y + 1) * w * 4).copy ? rgba.subarray(y * w * 4, (y + 1) * w * 4).copy(raw, y * (w * 4 + 1) + 1)
      : Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const idat = deflateSync(raw);
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, 'ascii');
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const vga = readFileSync(vgaP);
const dac = readFileSync(dacP);
const rgba = new Uint8Array(320 * 200 * 4);
for (let i = 0; i < 320 * 200; i++) {
  const c = vga[i] & 0xFF;
  const r6 = dac[c * 3 + 0] & 0x3F;
  const g6 = dac[c * 3 + 1] & 0x3F;
  const b6 = dac[c * 3 + 2] & 0x3F;
  rgba[i * 4 + 0] = (r6 << 2) | (r6 >> 4);
  rgba[i * 4 + 1] = (g6 << 2) | (g6 >> 4);
  rgba[i * 4 + 2] = (b6 << 2) | (b6 >> 4);
  rgba[i * 4 + 3] = 0xFF;
}
const png = encodePng(320, 200, Buffer.from(rgba));
writeFileSync(outP, png);
console.log(`wrote ${outP}`);
