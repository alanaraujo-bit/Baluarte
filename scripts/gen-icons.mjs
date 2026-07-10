/**
 * Generates the PWA icons procedurally — "O Bastião" (The Bastion):
 * a hexagonal crystalline shield with a liquid-glass core.
 *
 * Design concept:
 *   - Deep navy background with soft radial glow
 *   - Outer hexagonal frame in cyan (#35f0ff) with glow
 *   - Inner inverted hexagon (diamond orientation) in translucent glass
 *   - Bright central core (amber-to-cyan gradient)
 *   - Glass refraction highlights
 *   - Subtle magenta accents on edges
 *
 * Zero image dependencies — hand-encoded PNG via SDF rasterization.
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

// ————— SDF primitives —————

function distSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  return Math.sqrt(dx * dx + dy * dy);
}

function circleSDF(px, py, cx, cy, r) {
  return Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy)) - r;
}

/** Signed distance to a regular pointy-top hexagon */
function hexPointySDF(px, py, r) {
  const cos30 = 0.86602540378; // √3/2
  const sin30 = 0.5;
  const verts = [
    [0, -r],                          // top
    [r * cos30, -r * sin30],          // top-right
    [r * cos30, r * sin30],           // bottom-right
    [0, r],                           // bottom
    [-r * cos30, r * sin30],          // bottom-left
    [-r * cos30, -r * sin30],         // top-left
  ];
  let min = Infinity;
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    const d = distSegment(px, py, verts[i][0], verts[i][1], verts[j][0], verts[j][1]);
    if (d < min) min = d;
  }
  return min;
}

/** Signed distance to a regular flat-top hexagon (diamond orientation) */
function hexFlatSDF(px, py, r) {
  // Flat-top = pointy-top rotated 30° → just swap cos/sin roles
  const cos30 = 0.86602540378;
  const sin30 = 0.5;
  const verts = [
    [-r * sin30, -r * cos30],  // top-left    (was top)
    [r * sin30, -r * cos30],   // top-right
    [r, 0],                    // right
    [r * sin30, r * cos30],    // bottom-right
    [-r * sin30, r * cos30],   // bottom-left
    [-r, 0],                   // left
  ];
  let min = Infinity;
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    const d = distSegment(px, py, verts[i][0], verts[i][1], verts[j][0], verts[j][1]);
    if (d < min) min = d;
  }
  return min;
}

function roundRectSdf(px, py, half, radius) {
  const qx = Math.abs(px) - (half - radius);
  const qy = Math.abs(py) - (half - radius);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - radius;
}

// ————— color utilities —————

function lerp(a, b, t) { return a + (b - a) * t; }

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/** Radial gradient falloff: 1 at center, 0 at radius */
function radialFalloff(px, py, cx, cy, r) {
  const d = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy));
  return Math.max(0, 1 - d / r);
}

// ————— main icon renderer —————

/**
 * Draws "O Bastião" — a hexagonal crystalline shield.
 *
 * Composition (from back to front):
 *   1. Navy background with soft center glow
 *   2. Outer cyan hexagon ring with glow
 *   3. Inner diamond-orientation hexagon (glass fill)
 *   4. Central amber-to-cyan gradient core
 *   5. Glass highlight streaks
 *   6. Magenta edge accent glow
 */
function drawIcon(size, { maskable = false, rounded = true } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const half = size / 2;
  const cx = half;
  const cy = half;

  // Design parameters (in unit space, 0-1, then scaled)
  const outerHexR = 0.42;         // outer hexagon radius relative to size
  const ringThick = 0.055;        // thickness of the hex ring
  const innerHexR = 0.28;         // inner (diamond) hexagon radius
  const coreR = 0.10;             // central core radius
  const coreGlowR = 0.22;         // central glow radius

  // For maskable, everything must fit within 40% safe zone
  const scale = maskable ? 0.75 : 1.0;

  const oR = outerHexR * size * scale;
  const rT = ringThick * size * scale;
  const iR = innerHexR * size * scale;
  const cR = coreR * size * scale;
  const cGR = coreGlowR * size * scale;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;
      const dx = px - cx;
      const dy = py - cy;

      // ——— Step 1: Squircle mask for non-square rendering ———
      let alpha = 255;
      if (rounded && !maskable) {
        const d = roundRectSdf(dx, dy, half, size * 0.21);
        if (d > 0) {
          rgba[i + 3] = 0;
          continue;
        }
        alpha = d > -1.5 ? Math.round(255 * Math.min(1, -d / 1.5)) : 255;
      }

      // ——— Step 2: Background ———
      // Deep navy with a subtle warmer glow toward center
      const t = y / size;
      const bgGlow = radialFalloff(px, py, cx, cy, half * 0.85);

      let r = 5 + t * 3 + bgGlow * 6;
      let g = 7 + t * 2 + bgGlow * 10;
      let b = 15 - t * 5 + bgGlow * 20;

      // ——— Step 3: Outer hexagon ring (cyan) ———
      const hexDist = hexPointySDF(dx, dy, oR);
      const hexOuter = hexDist;                    // outside the hexagon
      const hexInner = -(hexDist - rT);             // inside the ring
      const ringDist = Math.max(hexOuter, hexInner); // signed distance to the ring

      if (ringDist < rT * 0.8) {
        // Glow falloff from the ring
        const ringGlow = Math.exp(-Math.max(0, ringDist) / (rT * 0.5));
        const ringFill = Math.max(0, 1 - Math.abs(hexDist - rT * 0.5) / (rT * 0.5));

        const cR = 53 * ringGlow + 30 * ringFill;
        const cG = 240 * ringGlow + 100 * ringFill;
        const cB = 255 * ringGlow + 180 * ringFill;
        r += cR;
        g += cG;
        b += cB;

        // White-hot core of the ring
        if (ringDist < rT * 0.15) {
          const core = 1 - ringDist / (rT * 0.15);
          r += (255 - r) * core * 0.7;
          g += (255 - g) * core * 0.8;
          b += (255 - b) * core * 0.5;
        }
      }

      // ——— Step 4: Inner diamond hexagon (glass fill) ———
      const innerDist = hexFlatSDF(dx, dy, iR);
      if (innerDist < 0) {
        // Translucent glass: cyan-to-deep-blue gradient with "depth"
        const depthFactor = 0.5 + (innerDist / iR) * 0.5; // 0 at edge, 1 at center
        const glassR = 8 + depthFactor * 30 + bgGlow * 15;
        const glassG = 20 + depthFactor * 80 + bgGlow * 25;
        const glassB = 45 + depthFactor * 100 + bgGlow * 30;

        // Blend glass over existing
        const glassAlpha = 0.55 + depthFactor * 0.25;
        r = r * (1 - glassAlpha) + glassR * glassAlpha;
        g = g * (1 - glassAlpha) + glassG * glassAlpha;
        b = b * (1 - glassAlpha) + glassB * glassAlpha;

        // Cyan edge glow on inner hexagon
        const edgeGlow = Math.exp(innerDist / (iR * 0.08));
        r += 40 * edgeGlow;
        g += 180 * edgeGlow;
        b += 200 * edgeGlow;
      }

      // ——— Step 5: Glass highlight streaks ———
      // Diagonal highlight from top-left toward center
      const streakAngle = Math.atan2(dy, dx);
      const streakDist = Math.abs(dx * 0.7 + dy * 0.7) / (size * 0.15);
      const streakFalloff = Math.exp(-(dx * dx + dy * dy) / (size * size * 0.06));
      const streak = Math.exp(-streakDist * streakDist) * 0.15 * streakFalloff;
      r += 255 * streak;
      g += 255 * streak;
      b += 255 * streak;

      // Secondary highlight, opposite direction, subtler
      const streak2Dist = Math.abs(-dx * 0.5 + dy * 0.5 - size * 0.05) / (size * 0.12);
      const streak2 = Math.exp(-streak2Dist * streak2Dist) * 0.06 * streakFalloff;
      r += 255 * streak2;
      g += 255 * streak2;
      b += 255 * streak2;

      // ——— Step 6: Amber-to-cyan central core ———
      const coreDist = circleSDF(px, py, cx, cy, cR);
      if (coreDist < cGR * 1.5) {
        // Outer glow: amber
        const glow = Math.exp(-Math.max(0, coreDist) / cGR);
        const coreWarmth = 0.3 + 0.7 * Math.exp(-coreDist / (cR * 0.8)); // warm at edge, bright at center

        // Core color: amber at outer edge, white-hot cyan at center
        const coreRcol = 255 * glow * coreWarmth;
        const coreGcol = 200 * glow * (0.3 + 0.7 * (1 - coreWarmth));
        const coreBcol = 80 * glow * (0.1 + 0.9 * (1 - coreWarmth));

        r += coreRcol * 0.5;
        g += coreGcol * 0.5;
        b += coreBcol * 0.5;

        if (coreDist < 0) {
          // White-hot center
          const centerBrite = 1 - coreDist / (-cR);
          const white = 0.5 + centerBrite * 0.5;
          r += (255 - r) * white * 0.85;
          g += (255 - g) * white * 0.9;
          b += (255 - b) * white * 0.7;
        }
      }

      // ——— Step 7: Magenta accent on outer hexagon edges ———
      // Only on the bottom-right and bottom-left edges for a subtle glass refraction
      // We'll add a subtle magenta aura on some edges
      const angle = Math.atan2(-dy, dx); // angle from center
      // Bottom edge regions (around -90° or 270°)
      const isBottomEdge = angle < -2.0 && angle > -2.8;
      if (isBottomEdge && ringDist < rT * 1.5 && ringDist > -rT * 0.5) {
        const mGlow = Math.exp(-Math.max(0, ringDist) / (rT * 0.6)) * 0.4;
        r += 255 * mGlow;
        g += 46 * mGlow;
        b += 138 * mGlow;
      }

      // Clamp and write
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
