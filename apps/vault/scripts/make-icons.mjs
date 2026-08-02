// Generates the PWA icons in public/icons/ — the header brand mark (rounded
// square + dash in the Nocturne accent) on the app background. Pure Node, no
// image dependencies: shapes are rendered by signed distance with 3×
// supersampling and encoded as PNG by hand. Rerun after any redesign:
//   node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BG = [0x16, 0x18, 0x26];
const ACCENT = [0x91, 0x84, 0xd9];

// --- PNG encoding (RGBA, 8-bit, no interlace) ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- shape rendering ---
const roundedRectSd = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - (hw - r);
  const qy = Math.abs(y - cy) - (hh - r);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
};

/** markScale: the outline square's width as a fraction of the icon. */
function renderIcon(size, markScale) {
  const SS = 3;
  const s = size * SS;
  const c = s / 2;
  const mark = s * markScale;
  const half = mark / 2;
  const radius = mark * 0.27;
  const stroke = mark * 0.09;
  const dashHw = mark * 0.2;
  const dashHh = mark * 0.048;
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rs = 0;
      let gs = 0;
      let bs = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x * SS + sx + 0.5;
          const fy = y * SS + sy + 0.5;
          const outline = Math.abs(roundedRectSd(fx, fy, c, c, half, half, radius)) - stroke / 2;
          const dash = roundedRectSd(fx, fy, c, c, dashHw, dashHh, dashHh);
          const col = Math.min(outline, dash) <= 0 ? ACCENT : BG;
          rs += col[0];
          gs += col[1];
          bs += col[2];
        }
      }
      const i = (y * size + x) * 4;
      px[i] = rs / (SS * SS);
      px[i + 1] = gs / (SS * SS);
      px[i + 2] = bs / (SS * SS);
      px[i + 3] = 255;
    }
  }
  return encodePng(size, px);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
const icons = [
  ['icon-192.png', 192, 0.58],
  ['icon-512.png', 512, 0.58],
  ['icon-maskable-512.png', 512, 0.44], // mark inside the maskable safe zone
  ['apple-touch-icon.png', 180, 0.58],
];
for (const [name, size, scale] of icons) {
  writeFileSync(join(outDir, name), renderIcon(size, scale));
  console.log(`  ${name} (${size}×${size})`);
}
