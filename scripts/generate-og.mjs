/**
 * Generates `public/og.png` — the 1200×630 social preview card.
 *
 * Social platforms do not render SVG previews, so this writes a real PNG using
 * only Node built-ins (no headless browser, no image dependency). Lettering
 * uses a 5×7 bitmap face scaled up, which suits the terminal/LED-board look the
 * site already leans on.
 *
 * Run with: npm run og
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../public/og.png');

const W = 1200;
const H = 630;

// ── 5×7 bitmap face ─────────────────────────────────────────────────────────
const GLYPHS = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.####|#....|#....|#....|#....|#....|.####',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.###.',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '#####|..#..|..#..|..#..|..#..|..#..|#####',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#...#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#...#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  1: '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  2: '.###.|#...#|....#|...#.|..#..|.#...|#####',
  3: '####.|....#|....#|.###.|....#|....#|####.',
  4: '#..#.|#..#.|#..#.|#####|...#.|...#.|...#.',
  5: '#####|#....|####.|....#|....#|#...#|.###.',
  6: '.###.|#....|#....|####.|#...#|#...#|.###.',
  7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
  8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  9: '.###.|#...#|#...#|.####|....#|....#|.###.',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  ',': '.....|.....|.....|.....|.##..|.##..|.#...',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  "'": '..#..|..#..|.....|.....|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
};

const buf = Buffer.alloc(W * H * 3);

function px(x, y, r, g, b, a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  if (a >= 1) {
    buf[i] = r;
    buf[i + 1] = g;
    buf[i + 2] = b;
    return;
  }
  buf[i] = Math.round(buf[i] * (1 - a) + r * a);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + g * a);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + b * a);
}

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

function rect(x0, y0, w, h, color, a = 1) {
  const [r, g, b] = hex(color);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) px(x, y, r, g, b, a);
}

function roundRect(x0, y0, w, h, radius, color, a = 1) {
  const [r, g, b] = hex(color);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.min(x, w - 1 - x);
      const dy = Math.min(y, h - 1 - y);
      if (dx < radius && dy < radius) {
        const d = Math.hypot(radius - dx, radius - dy);
        if (d > radius) continue;
        px(x0 + x, y0 + y, r, g, b, a * Math.min(1, radius - d + 0.5));
      } else {
        px(x0 + x, y0 + y, r, g, b, a);
      }
    }
  }
}

function text(str, x0, y0, scale, color, a = 1) {
  const [r, g, b] = hex(color);
  let cx = x0;
  for (const ch of str.toUpperCase()) {
    const rows = (GLYPHS[ch] ?? GLYPHS[' ']).split('|');
    rows.forEach((row, ry) => {
      [...row].forEach((cell, rx) => {
        if (cell !== '#') return;
        rect(cx + rx * scale, y0 + ry * scale, scale, scale, color, a);
      });
    });
    cx += 6 * scale;
    void r;
    void g;
    void b;
  }
  return cx - x0 - scale;
}

const textWidth = (str, scale) => str.length * 6 * scale - scale;

// ── Scene ───────────────────────────────────────────────────────────────────
// Base vertical gradient.
for (let y = 0; y < H; y++) {
  const t = y / H;
  const r = Math.round(12 + t * 10);
  const g = Math.round(10 + t * 8);
  const b = Math.round(9 + t * 7);
  for (let x = 0; x < W; x++) px(x, y, r, g, b);
}

// Warm lamp glow (Judaad House) on the left, cool metro glow on the right.
function glow(cx, cy, radius, color, strength) {
  const [r, g, b] = hex(color);
  for (let y = Math.max(0, cy - radius); y < Math.min(H, cy + radius); y++) {
    for (let x = Math.max(0, cx - radius); x < Math.min(W, cx + radius); x++) {
      const d = Math.hypot(x - cx, y - cy) / radius;
      if (d >= 1) continue;
      px(x, y, r, g, b, (1 - d) ** 2 * strength);
    }
  }
}
glow(210, 250, 520, '#f5a524', 0.2);
glow(1030, 470, 480, '#38bdf8', 0.16);
glow(700, 120, 420, '#f2545b', 0.08);

// Faint engineering grid.
for (let x = 0; x < W; x += 40) rect(x, 0, 1, H, '#ffffff', 0.028);
for (let y = 0; y < H; y += 40) rect(0, y, W, 1, '#ffffff', 0.028);

// Scanline texture.
for (let y = 0; y < H; y += 3) rect(0, y, W, 1, '#000000', 0.06);

// Top hairline.
rect(0, 0, W, 3, '#f5a524', 0.9);

// Eyebrow.
text('WHERE ARE YOU RIGHT NOW?', 80, 120, 4, '#f5a524', 0.95);

// Wordmark.
text('VIBE', 80, 190, 14, '#fafaf9');
text('MODE', 80, 310, 14, '#f5a524');

// Rule + tagline.
rect(80, 440, 300, 2, '#ffffff', 0.25);
text('FIVE LITTLE WORLDS. FIVE PLAYLISTS.', 80, 470, 3, '#d6d3d1', 0.85);
text('PRESS PLAY AND GO SOMEWHERE.', 80, 500, 3, '#d6d3d1', 0.55);

// Mode chips along the bottom.
const MODES = [
  ['JUDAAD HOUSE', '#f5a524'],
  ['METRO', '#38bdf8'],
  ['INDIAN TRAIN', '#e8b04b'],
  ['CAB WALA', '#e879f9'],
  ['OFFICE', '#7dd3fc'],
];
let chipX = 80;
for (const [label, color] of MODES) {
  const w = textWidth(label, 2) + 44;
  roundRect(chipX, 552, w, 34, 17, '#ffffff', 0.06);
  rect(chipX + 14, 565, 8, 8, color, 1);
  text(label, chipX + 30, 564, 2, '#e7e5e4', 0.9);
  chipX += w + 12;
}

// Pin + play mark on the right.
const PIN_X = 960;
const PIN_Y = 250;
for (let y = -150; y <= 210; y++) {
  for (let x = -150; x <= 150; x++) {
    const d = Math.hypot(x, y);
    let inside = false;
    if (y <= 30) {
      inside = d <= 140;
    } else {
      // Tapering tail down to the point.
      const halfWidth = 140 * (1 - (y - 30) / 190) ** 0.72;
      inside = Math.abs(x) <= halfWidth;
    }
    if (!inside) continue;
    const t = Math.min(1, Math.max(0, (x + 150) / 300 * 0.6 + (y + 150) / 360 * 0.4));
    const r = Math.round(245 + t * (56 - 245));
    const g = Math.round(165 + t * (189 - 165));
    const b = Math.round(36 + t * (248 - 36));
    px(PIN_X + x, PIN_Y + y, r, g, b, 0.95);
  }
}
// Hollow it out and drop in a play triangle.
for (let y = -90; y <= 90; y++) {
  for (let x = -90; x <= 90; x++) {
    if (Math.hypot(x, y) <= 84) px(PIN_X + x, PIN_Y + y, 12, 10, 9, 0.97);
  }
}
for (let y = -52; y <= 52; y++) {
  const w = Math.round(84 * (1 - Math.abs(y) / 52));
  for (let x = 0; x < w; x++) px(PIN_X - 28 + x, PIN_Y + y, 250, 250, 249, 1);
}

// ── Encode ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type: truecolour
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0; // filter: none
  buf.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`og.png written — ${W}×${H}, ${(png.length / 1024).toFixed(1)} kB`);
