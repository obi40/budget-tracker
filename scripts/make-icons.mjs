// Draws the app icon (teal gradient, three rising white bars) as PNGs with no dependencies.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const bars = [ [0.22, 0.56, 0.36, 0.78], [0.43, 0.42, 0.57, 0.78], [0.64, 0.25, 0.78, 0.78] ];
  const r = 0.07 * size; // bar corner radius
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size);
      let R = Math.round(20 + (13 - 20) * t), G = Math.round(150 + (95 - 150) * t), B = Math.round(136 + (110 - 136) * t);
      const u = x / size, v = y / size;
      for (const [x0, y0, x1, y1] of bars) {
        if (u >= x0 && u <= x1 && v >= y0 && v <= y1) {
          const px = x, py = y, X0 = x0 * size, Y0 = y0 * size, X1 = x1 * size;
          const inCorner = (cx, cy) => (px - cx) ** 2 + (py - cy) ** 2 > r * r;
          let ok = true;
          if (px < X0 + r && py < Y0 + r) ok = !inCorner(X0 + r, Y0 + r);
          if (px > X1 - r && py < Y0 + r) ok = !inCorner(X1 - r, Y0 + r);
          if (ok) { R = 255; G = 255; B = 255; }
        }
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = R; raw[o + 1] = G; raw[o + 2] = B; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), png(size));
}
console.log('icons written');
