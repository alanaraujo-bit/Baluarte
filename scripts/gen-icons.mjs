/**
 * Generates the PWA icons procedurally — a neon "V" emblem rendered with
 * signed distance fields into hand-encoded PNGs. Zero image dependencies.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

// ————— minimal PNG encoder —————

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ————— tiny SDF rasterizer —————

function distSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return Math.sqrt(dx * dx + dy * dy);
}

function roundRectSdf(px, py, half, radius) {
  const qx = Math.abs(px) - (half - radius);
  const qy = Math.abs(py) - (half - radius);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - radius;
}

function drawIcon(size, { maskable = false, rounded = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const pad = maskable ? 0.3 : 0.2;
  // "V" emblem endpoints in unit space.
  const v = {
    lx: pad, ly: pad + 0.04,
    rx: 1 - pad, ry: pad + 0.04,
    bx: 0.5, by: 1 - pad,
  };
  const coreW = size * 0.052;
  const glowW = size * 0.1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      let alpha = 255;
      if (rounded && !maskable) {
        const d = roundRectSdf(px - size / 2, py - size / 2, size / 2, size * 0.21);
        if (d > 0) {
          rgba[i + 3] = 0;
          continue;
        }
        alpha = d > -1.5 ? Math.round(255 * Math.min(1, -d / 1.5)) : 255;
      }

      // Background: vertical navy gradient with a soft center light.
      const t = y / size;
      let r = 8 + t * 4;
      let g = 12 + t * 2;
      let b = 30 - t * 10;
      const cx = px / size - 0.5;
      const cy = py / size - 0.42;
      const centerGlow = Math.exp(-(cx * cx + cy * cy) * 7);
      r += centerGlow * 10;
      g += centerGlow * 22;
      b += centerGlow * 38;

      // Magenta echo of the V, offset downward.
      const off = size * 0.045;
      const dm = Math.min(
        distSegment(px, py - off, v.lx * size, v.ly * size, v.bx * size, v.by * size),
        distSegment(px, py - off, v.rx * size, v.ry * size, v.bx * size, v.by * size),
      );
      const mGlow = Math.exp(-Math.max(0, dm - coreW) / glowW) * 0.55;
      r += 255 * mGlow * 0.9;
      g += 46 * mGlow;
      b += 138 * mGlow;

      // Cyan V with white-hot core.
      const d = Math.min(
        distSegment(px, py, v.lx * size, v.ly * size, v.bx * size, v.by * size),
        distSegment(px, py, v.rx * size, v.ry * size, v.bx * size, v.by * size),
      );
      const glow = Math.exp(-Math.max(0, d - coreW) / glowW);
      r += 53 * glow;
      g += 240 * glow;
      b += 255 * glow;
      if (d < coreW) {
        const core = 1 - d / coreW;
        const white = 0.35 + core * 0.65;
        r += (255 - r) * white * 0.9;
        g += (255 - g) * white * 0.95;
        b += (255 - b) * white * 0.6;
      }

      rgba[i] = Math.min(255, Math.round(r));
      rgba[i + 1] = Math.min(255, Math.round(g));
      rgba[i + 2] = Math.min(255, Math.round(b));
      rgba[i + 3] = alpha;
    }
  }
  return encodePng(size, rgba);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-512.png', drawIcon(512));
writeFileSync('public/icons/icon-512-maskable.png', drawIcon(512, { maskable: true }));
writeFileSync('public/icons/icon-192.png', drawIcon(192));
writeFileSync('public/icons/icon-180.png', drawIcon(180, { rounded: false }));
console.log('Ícones gerados em public/icons/');
