import fs from 'node:fs';
import { encodePng } from '../tests/harness/lib/png.mjs';
const [, , vgaPath, dacPath, outPath] = process.argv;
const vga = new Uint8Array(fs.readFileSync(vgaPath));
const dac = new Uint8Array(fs.readFileSync(dacPath));
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
fs.writeFileSync(outPath, encodePng(320, 200, rgba));
console.log('wrote', outPath);
