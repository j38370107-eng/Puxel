/**
 * PixelForge – Structured Pixel Art Generation Engine
 *
 * Generates recognisable pixel-art sprites through a five-step pipeline:
 *   1. Silhouette / base shapes
 *   2. Costume / colours / patterns
 *   3. Face / expression
 *   4. Shading (top-light model)
 *   5. Outline + humaniser pass
 *
 * All drawing coordinates are specified in a 32 × 32 "base" space and
 * automatically scaled to the actual canvas size.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type RGBA = [number, number, number, number]; // r, g, b, a (0–255)

export interface ParsedPrompt {
  subject: Subject;
  view: 'front' | 'side';
  style: 'simple' | 'normal' | 'detailed';
  stylePreset: StylePreset;
  colorOverride: RGBA | null;
  accentOverride: RGBA | null;
  animated: boolean;
  frames: number;
  expression: Expression;
  seed: number;
}

export type StylePreset =
  | 'blasphemous' | 'gothic' | 'retro8bit' | '16bit'
  | 'isometric' | 'cyberpunk' | 'none';

type Subject =
  | 'jester' | 'wizard' | 'mage'
  | 'knight' | 'warrior' | 'archer'
  | 'rogue' | 'elf'
  | 'dragon' | 'slime' | 'skeleton' | 'ghost' | 'orc'
  | 'mushroom' | 'tree' | 'flower'
  | 'chest' | 'potion' | 'sword' | 'shield'
  | 'isobox' | 'isotile'
  // New subjects
  | 'goblin' | 'vampire' | 'witch' | 'demon' | 'angel'
  | 'reaper' | 'zombie' | 'wolf' | 'spider' | 'bat'
  | 'gargoyle' | 'coin' | 'key' | 'torch' | 'bomb'
  | 'skull' | 'crown' | 'gem' | 'tome' | 'tombstone'
  | 'door' | 'rock' | 'flame' | 'axe' | 'staff'
  | 'humanoid';  // fallback

type Expression = 'grin' | 'happy' | 'neutral' | 'stern' | 'angry';

// ─── Seeded RNG ───────────────────────────────────────────────────────────────

function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

class SeededRNG {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0 || 1; }
  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    this.state = this.state >>> 0;
    return this.state / 0x100000000;
  }
  bool(prob = 0.5): boolean { return this.next() < prob; }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function rgb(r: number, g: number, b: number, a = 255): RGBA {
  return [r, g, b, a];
}

function hex(h: string): RGBA {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16), 255];
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function shade(c: RGBA, factor: number): RGBA {
  return [clamp(Math.round(c[0] * factor)), clamp(Math.round(c[1] * factor)), clamp(Math.round(c[2] * factor)), c[3]];
}

function mix(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    clamp(Math.round(a[0] * (1 - t) + b[0] * t)),
    clamp(Math.round(a[1] * (1 - t) + b[1] * t)),
    clamp(Math.round(a[2] * (1 - t) + b[2] * t)),
    clamp(Math.round(a[3] * (1 - t) + b[3] * t)),
  ];
}

// ─── Pixel Painter ────────────────────────────────────────────────────────────

class PixelPainter {
  data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
  private sx: number;
  private sy: number;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
    this.sx = w / 32;
    this.sy = h / 32;
  }

  private bx(x: number) { return Math.round(x * this.sx); }
  private by(y: number) { return Math.round(y * this.sy); }
  private bw(w: number) { return Math.max(1, Math.round(w * this.sx)); }
  private bh(h: number) { return Math.max(1, Math.round(h * this.sy)); }

  set(x: number, y: number, c: RGBA) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1];
    this.data[i + 2] = c[2]; this.data[i + 3] = c[3];
  }

  get(x: number, y: number): RGBA {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  rect(bX: number, bY: number, bW: number, bH: number, c: RGBA) {
    const x0 = this.bx(bX), y0 = this.by(bY);
    const x1 = x0 + this.bw(bW), y1 = y0 + this.bh(bH);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        this.set(x, y, c);
  }

  pixel(bX: number, bY: number, c: RGBA) {
    this.rect(bX, bY, 1, 1, c);
  }

  ellipse(bCx: number, bCy: number, bRx: number, bRy: number, c: RGBA) {
    const cx = this.bx(bCx), cy = this.by(bCy);
    const rx = this.bw(bRx), ry = this.bh(bRy);
    for (let dy = -ry; dy <= ry; dy++)
      for (let dx = -rx; dx <= rx; dx++)
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1)
          this.set(cx + dx, cy + dy, c);
  }

  diamonds(bX: number, bY: number, bW: number, bH: number, c1: RGBA, c2: RGBA, tileBase = 3) {
    const tile = Math.max(1, Math.round(tileBase * this.sx));
    const x0 = this.bx(bX), y0 = this.by(bY);
    const pw = this.bw(bW), ph = this.bh(bH);
    for (let dy = 0; dy < ph; dy++)
      for (let dx = 0; dx < pw; dx++)
        this.set(x0 + dx, y0 + dy, Math.floor((dx + dy) / tile) % 2 === 0 ? c1 : c2);
  }

  vstripes(bX: number, bY: number, bW: number, bH: number, c1: RGBA, c2: RGBA, stripeBase = 2) {
    const stripe = Math.max(1, Math.round(stripeBase * this.sx));
    const x0 = this.bx(bX), y0 = this.by(bY);
    const pw = this.bw(bW), ph = this.bh(bH);
    for (let dy = 0; dy < ph; dy++)
      for (let dx = 0; dx < pw; dx++)
        this.set(x0 + dx, y0 + dy, Math.floor(dx / stripe) % 2 === 0 ? c1 : c2);
  }

  hstripes(bX: number, bY: number, bW: number, bH: number, c1: RGBA, c2: RGBA, stripeBase = 2) {
    const stripe = Math.max(1, Math.round(stripeBase * this.sy));
    const x0 = this.bx(bX), y0 = this.by(bY);
    const pw = this.bw(bW), ph = this.bh(bH);
    for (let dy = 0; dy < ph; dy++)
      for (let dx = 0; dx < pw; dx++)
        this.set(x0 + dx, y0 + dy, Math.floor(dy / stripe) % 2 === 0 ? c1 : c2);
  }

  shadeRegion(bX: number, bY: number, bW: number, bH: number) {
    const x0 = this.bx(bX), y0 = this.by(bY);
    const pw = this.bw(bW), ph = this.bh(bH);
    for (let dy = 0; dy < ph; dy++) {
      const relY = dy / ph;
      const factor = relY < 0.2 ? 1.4 : relY < 0.45 ? 1.15 : relY > 0.75 ? 0.68 : 1.0;
      if (factor === 1.0) continue;
      for (let dx = 0; dx < pw; dx++) {
        const c = this.get(x0 + dx, y0 + dy);
        if (c[3] > 0) this.set(x0 + dx, y0 + dy, shade(c, factor));
      }
    }
  }

  shadeSide(bX: number, bY: number, bW: number, bH: number) {
    const x0 = this.bx(bX), y0 = this.by(bY);
    const pw = this.bw(bW), ph = this.bh(bH);
    for (let dy = 0; dy < ph; dy++)
      for (let dx = 0; dx < pw; dx++) {
        const relX = dx / pw;
        const factor = relX < 0.15 ? 1.25 : relX > 0.85 ? 0.75 : 1.0;
        if (factor === 1.0) continue;
        const c = this.get(x0 + dx, y0 + dy);
        if (c[3] > 0) this.set(x0 + dx, y0 + dy, shade(c, factor));
      }
  }

  outline(oc: RGBA = rgb(20, 12, 28)) {
    const snap = new Uint8ClampedArray(this.data);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (snap[i + 3] > 0) continue;
        const adj = [
          x > 0 && snap[(y * this.w + x - 1) * 4 + 3] > 0,
          x < this.w - 1 && snap[(y * this.w + x + 1) * 4 + 3] > 0,
          y > 0 && snap[((y - 1) * this.w + x) * 4 + 3] > 0,
          y < this.h - 1 && snap[((y + 1) * this.w + x) * 4 + 3] > 0,
        ];
        if (adj.some(Boolean)) {
          this.data[i] = oc[0]; this.data[i + 1] = oc[1];
          this.data[i + 2] = oc[2]; this.data[i + 3] = oc[3];
        }
      }
    }
  }

  toImageData(): ImageData {
    return new ImageData(new Uint8ClampedArray(this.data), this.w, this.h);
  }
}

// ─── Face Drawing ─────────────────────────────────────────────────────────────

const DARK = rgb(20, 12, 28);
const WHITE = rgb(245, 245, 245);
const SKIN = hex('#f5cba7');
const SKIN_SHADOW = hex('#d4a574');

function drawFace(
  p: PixelPainter,
  cx: number,
  ey: number,
  expression: Expression,
) {
  const pupil = DARK;
  const eyeWhite = WHITE;
  const browColor = rgb(80, 50, 25);
  const cheekColor: RGBA = [220, 110, 95, 180];

  p.rect(cx - 4, ey - 2, 2, 1, browColor);
  p.rect(cx + 2, ey - 2, 2, 1, browColor);
  if (expression === 'stern' || expression === 'angry') {
    p.pixel(cx - 3, ey - 3, browColor);
    p.pixel(cx + 4, ey - 3, browColor);
  }

  p.rect(cx - 4, ey, 2, 2, eyeWhite);
  p.rect(cx - 3, ey, 1, 2, pupil);
  p.pixel(cx - 4, ey, rgb(255, 255, 255, 200));

  p.rect(cx + 2, ey, 2, 2, eyeWhite);
  p.rect(cx + 2, ey, 1, 2, pupil);
  p.pixel(cx + 3, ey, rgb(255, 255, 255, 200));

  p.rect(cx - 1, ey + 3, 2, 1, SKIN_SHADOW);

  const my = ey + 5;
  switch (expression) {
    case 'grin': {
      const smileXs = [-3, -2, -1, 0, 1, 2, 3];
      const smileOffsets = [0, 1, 2, 2, 2, 1, 0];
      smileXs.forEach((dx, i) => p.pixel(cx + dx, my + smileOffsets[i], DARK));
      p.rect(cx - 2, my + 1, 4, 1, WHITE);
      p.rect(cx - 5, ey + 2, 2, 2, cheekColor);
      p.rect(cx + 3, ey + 2, 2, 2, cheekColor);
      break;
    }
    case 'happy': {
      const xs = [-2, -1, 0, 1, 2];
      const offs = [0, 1, 1, 1, 0];
      xs.forEach((dx, i) => p.pixel(cx + dx, my + offs[i], DARK));
      p.rect(cx - 5, ey + 2, 2, 2, cheekColor);
      p.rect(cx + 3, ey + 2, 2, 2, cheekColor);
      break;
    }
    case 'stern':
      p.rect(cx - 2, my, 5, 1, DARK);
      break;
    case 'angry':
      p.rect(cx - 2, my, 5, 1, DARK);
      p.pixel(cx - 2, my - 1, DARK);
      p.pixel(cx + 2, my - 1, DARK);
      break;
    default:
      p.rect(cx - 1, my, 3, 1, DARK);
  }
}

// ─── Subject Drawers ─────────────────────────────────────────────────────────

function drawJester(p: PixelPainter, main: RGBA, accent: RGBA) {
  const gold = hex('#f5c842');
  const goldDark = hex('#c89520');
  const white = rgb(245, 245, 245);

  p.rect(7, 0, 5, 7, main);
  p.rect(13, 0, 6, 6, accent);
  p.rect(20, 0, 5, 7, main);
  p.hstripes(7, 5, 18, 4, main, accent, 2);

  p.ellipse(9, 2, 2, 2, gold);
  p.ellipse(16, 2, 2, 2, gold);
  p.ellipse(22, 2, 2, 2, gold);
  p.pixel(9, 1, shade(gold, 1.5));
  p.pixel(16, 1, shade(gold, 1.5));
  p.pixel(22, 1, shade(gold, 1.5));
  p.pixel(9, 3, goldDark);
  p.pixel(16, 3, goldDark);
  p.pixel(22, 3, goldDark);

  p.rect(10, 8, 12, 8, SKIN);
  p.pixel(9, 10, SKIN_SHADOW);
  p.pixel(22, 10, SKIN_SHADOW);
  drawFace(p, 16, 10, 'grin');

  p.rect(8, 16, 16, 3, white);
  for (let x = 8; x < 24; x += 2) p.pixel(x, 15, white);
  p.shadeRegion(8, 16, 16, 3);

  p.diamonds(9, 19, 14, 8, main, accent, 3);
  p.shadeRegion(9, 19, 14, 8);

  p.rect(5, 18, 5, 7, main);
  p.rect(5, 24, 5, 2, white);
  p.rect(6, 26, 3, 2, SKIN);

  p.rect(22, 18, 5, 7, accent);
  p.rect(22, 24, 5, 2, white);
  p.rect(23, 26, 3, 2, SKIN);

  p.rect(10, 27, 5, 5, accent);
  p.rect(17, 27, 5, 5, main);

  p.rect(8, 31, 8, 2, DARK);
  p.pixel(7, 30, DARK);
  p.rect(16, 31, 8, 2, DARK);
  p.pixel(24, 30, DARK);

  p.shadeRegion(7, 0, 5, 7);
  p.shadeRegion(20, 0, 5, 7);
  p.shadeRegion(13, 0, 6, 6);
  p.shadeRegion(10, 8, 12, 8);
  p.shadeRegion(5, 18, 5, 7);
  p.shadeRegion(22, 18, 5, 7);
  p.shadeRegion(10, 27, 5, 5);
  p.shadeRegion(17, 27, 5, 5);
}

function drawWizard(p: PixelPainter, main: RGBA, accent: RGBA) {
  const robe = main;
  const starColor = hex('#f5e642');
  const skinColor = SKIN;
  const white = rgb(245, 245, 245);

  p.rect(14, 0, 4, 2, main);
  p.rect(13, 2, 6, 2, main);
  p.rect(12, 4, 8, 3, main);
  p.hstripes(9, 7, 14, 2, main, accent, 1);
  p.pixel(15, 1, starColor); p.pixel(16, 1, starColor); p.pixel(15, 3, starColor);

  p.rect(10, 9, 12, 8, skinColor);
  const beard = rgb(200, 200, 200);
  p.rect(10, 14, 12, 5, beard);
  p.rect(11, 12, 10, 2, beard);
  p.pixel(9, 11, SKIN_SHADOW); p.pixel(22, 11, SKIN_SHADOW);
  drawFace(p, 16, 10, 'neutral');

  p.rect(9, 17, 14, 11, robe);
  p.pixel(12, 20, starColor); p.pixel(11, 21, starColor); p.pixel(13, 21, starColor); p.pixel(12, 22, starColor);
  p.pixel(19, 19, starColor); p.pixel(18, 20, starColor); p.pixel(20, 20, starColor); p.pixel(19, 21, starColor);
  p.pixel(15, 24, starColor); p.pixel(14, 25, starColor); p.pixel(16, 25, starColor); p.pixel(15, 26, starColor);

  p.rect(4, 17, 6, 8, robe);
  p.rect(22, 17, 6, 8, robe);
  p.rect(3, 22, 7, 3, robe);
  p.rect(22, 22, 7, 3, robe);
  p.rect(4, 25, 4, 2, skinColor);
  p.rect(24, 25, 4, 2, skinColor);
  p.rect(27, 4, 2, 26, hex('#7a5230'));
  p.ellipse(28, 3, 2, 2, accent);
  p.pixel(28, 2, shade(accent, 1.6));

  p.hstripes(8, 27, 16, 4, robe, shade(robe, 0.7), 2);
  p.shadeRegion(9, 17, 14, 11);
  p.shadeRegion(10, 9, 12, 8);
  p.shadeRegion(12, 0, 8, 9);
}

function drawKnight(p: PixelPainter, main: RGBA, accent: RGBA) {
  const metal = hex('#9badb7');
  const metalDark = hex('#5a7088');
  const metalLight = hex('#cfdee8');
  const visorDark = hex('#2c3e50');
  const cloth = accent;

  p.rect(9, 3, 14, 8, metal);
  p.rect(11, 6, 10, 2, visorDark);
  p.pixel(11, 6, DARK);
  p.rect(14, 0, 4, 4, cloth);
  p.shadeSide(14, 0, 4, 4);
  p.rect(11, 10, 10, 2, metalDark);

  p.rect(9, 12, 14, 12, metal);
  p.rect(13, 14, 6, 4, cloth);
  p.pixel(15, 15, metalLight); p.pixel(16, 15, metalLight);
  p.rect(5, 12, 5, 5, metal);
  p.rect(22, 12, 5, 5, metal);

  p.rect(5, 17, 4, 7, metal);
  p.rect(23, 17, 4, 7, metal);
  p.rect(5, 23, 5, 3, metalDark);
  p.rect(22, 23, 5, 3, metalDark);

  p.rect(1, 17, 5, 9, metal);
  p.rect(2, 18, 3, 7, cloth);
  p.pixel(3, 21, metalLight);

  p.rect(26, 7, 2, 20, hex('#c0c0c0'));
  p.rect(24, 14, 6, 2, hex('#c8a000'));
  p.rect(26, 16, 2, 4, hex('#7a5230'));
  p.pixel(26, 7, metalLight); p.pixel(27, 7, metalLight);

  p.rect(10, 24, 5, 7, metal);
  p.rect(17, 24, 5, 7, metal);
  p.rect(10, 24, 5, 2, metalDark);
  p.rect(17, 24, 5, 2, metalDark);
  p.rect(9, 30, 7, 2, metalDark);
  p.rect(16, 30, 7, 2, metalDark);

  p.shadeRegion(9, 12, 14, 12);
  p.shadeRegion(9, 3, 14, 8);
  p.shadeRegion(10, 24, 5, 7);
  p.shadeRegion(17, 24, 5, 7);
  p.shadeSide(5, 12, 5, 5);
  p.shadeSide(22, 12, 5, 5);
}

function drawDragon(p: PixelPainter, main: RGBA, accent: RGBA) {
  const scale = main;
  const scaleDark = shade(main, 0.55);
  const belly = shade(accent, 1.1);
  const eyeColor = hex('#f5e642');
  const fireColor = hex('#ff6b00');
  const fireTip = hex('#f5e642');

  p.ellipse(16, 19, 9, 8, scale);
  p.ellipse(16, 21, 6, 5, belly);
  p.ellipse(22, 9, 7, 6, scale);
  p.rect(25, 10, 6, 4, scale);
  p.rect(26, 13, 5, 2, scaleDark);
  p.pixel(29, 11, DARK); p.pixel(29, 12, DARK);
  p.ellipse(20, 8, 2, 2, eyeColor);
  p.pixel(20, 8, DARK);
  p.pixel(19, 7, rgb(255, 255, 200, 200));
  p.rect(21, 2, 2, 5, scaleDark);
  p.pixel(22, 1, scaleDark);

  p.rect(3, 8, 8, 4, scaleDark);
  p.rect(1, 10, 5, 8, scaleDark);
  p.rect(3, 15, 3, 6, shade(scaleDark, 0.7));
  p.rect(2, 11, 1, 7, shade(scaleDark, 0.6));
  p.rect(4, 10, 1, 9, shade(scaleDark, 0.6));
  p.rect(6, 9, 1, 6, shade(scaleDark, 0.6));
  p.rect(25, 9, 5, 3, scaleDark);
  p.rect(27, 11, 4, 6, scaleDark);

  p.rect(5, 22, 6, 4, scale);
  p.rect(3, 24, 5, 3, scale);
  p.rect(1, 26, 4, 2, scaleDark);
  p.pixel(1, 27, scaleDark);

  p.rect(12, 26, 4, 4, scale);
  p.rect(20, 26, 4, 4, scale);
  p.rect(11, 29, 2, 2, DARK); p.rect(13, 30, 2, 1, DARK); p.rect(15, 29, 2, 2, DARK);
  p.rect(19, 29, 2, 2, DARK); p.rect(21, 30, 2, 1, DARK); p.rect(23, 29, 2, 2, DARK);

  p.rect(30, 11, 2, 2, hex('#ff3300'));
  p.rect(31, 9, 2, 4, fireColor);
  p.pixel(31, 8, fireTip); p.pixel(31, 13, fireTip);

  p.shadeRegion(8, 12, 16, 14);
  p.shadeRegion(17, 5, 12, 10);
}

function drawSlime(p: PixelPainter, main: RGBA, accent: RGBA) {
  const glow = shade(main, 1.4);
  const dark = shade(main, 0.5);
  const shine = rgb(255, 255, 255, 200);

  p.ellipse(16, 21, 10, 8, main);
  p.rect(7, 26, 18, 3, main);
  p.ellipse(13, 17, 4, 3, glow);
  p.ellipse(12, 16, 2, 2, shine);

  const eyeWhite = rgb(245, 245, 245);
  p.ellipse(12, 19, 3, 3, eyeWhite);
  p.ellipse(13, 20, 1, 2, DARK);
  p.pixel(11, 18, shine);
  p.ellipse(20, 19, 3, 3, eyeWhite);
  p.ellipse(20, 20, 1, 2, DARK);
  p.pixel(19, 18, shine);

  p.rect(14, 23, 5, 1, dark);
  p.pixel(13, 22, dark); p.pixel(19, 22, dark);
  p.rect(22, 15, 2, 4, main);
  p.pixel(22, 19, dark);
  p.rect(9, 14, 2, 3, main);
  p.pixel(10, 17, dark);

  p.shadeRegion(7, 14, 18, 16);
}

function drawSkeleton(p: PixelPainter, main: RGBA, _accent: RGBA) {
  const bone = hex('#e8e0cc');
  const boneDark = hex('#b8b0a0');
  const voidColor = DARK;

  p.ellipse(16, 8, 6, 6, bone);
  p.ellipse(13, 7, 2, 2, voidColor);
  p.ellipse(19, 7, 2, 2, voidColor);
  p.rect(15, 10, 2, 2, voidColor);
  for (let i = 0; i < 6; i++) p.rect(12 + i * 2, 13, 1, 2, bone);
  p.rect(11, 12, 10, 2, boneDark);

  p.rect(12, 15, 8, 1, bone);
  for (let row = 0; row < 4; row++) {
    const y = 16 + row * 2;
    p.rect(8, y, 4, 1, bone);
    p.rect(20, y, 4, 1, bone);
    p.rect(12, y, 8, 1, bone);
  }

  p.rect(10, 24, 12, 3, bone);
  p.rect(12, 24, 8, 3, boneDark);

  p.rect(7, 15, 2, 8, bone); p.rect(7, 23, 2, 5, bone);
  p.rect(23, 15, 2, 8, bone); p.rect(23, 23, 2, 5, bone);
  p.rect(6, 27, 4, 2, bone); p.rect(22, 27, 4, 2, bone);

  p.rect(12, 27, 2, 7, bone); p.rect(18, 27, 2, 7, bone);
  p.ellipse(13, 27, 2, 2, boneDark); p.ellipse(19, 27, 2, 2, boneDark);

  p.shadeRegion(10, 2, 12, 12);
  p.shadeRegion(10, 15, 12, 12);
}

function drawMushroom(p: PixelPainter, main: RGBA, accent: RGBA) {
  const spotColor = rgb(245, 245, 245);
  const stemColor = hex('#d4c9a8');
  const gills = shade(main, 0.7);

  p.ellipse(16, 13, 12, 10, main);
  p.rect(7, 18, 18, 3, gills);
  p.ellipse(12, 10, 3, 3, spotColor);
  p.ellipse(20, 9, 2, 2, spotColor);
  p.ellipse(16, 7, 2, 2, spotColor);
  p.ellipse(10, 14, 2, 2, spotColor);
  p.ellipse(22, 13, 2, 2, spotColor);

  p.rect(12, 19, 8, 10, stemColor);
  p.shadeRegion(12, 19, 8, 10);
  p.rect(11, 22, 10, 2, shade(stemColor, 0.8));

  const eyeW = rgb(245, 245, 245);
  p.ellipse(13, 21, 2, 2, eyeW); p.pixel(14, 21, DARK);
  p.ellipse(19, 21, 2, 2, eyeW); p.pixel(19, 21, DARK);
  p.rect(14, 24, 4, 1, DARK);
  p.pixel(13, 23, DARK); p.pixel(18, 23, DARK);

  p.shadeRegion(5, 5, 22, 14);
}

function drawTree(p: PixelPainter, main: RGBA, accent: RGBA) {
  const trunkColor = hex('#7a5230');
  const trunkDark = hex('#5a3a18');
  const leafLight = shade(main, 1.3);
  const leafDark = shade(main, 0.65);

  p.rect(13, 21, 6, 11, trunkColor);
  p.shadeRegion(13, 21, 6, 11);
  p.rect(14, 22, 1, 9, trunkDark); p.rect(17, 24, 1, 7, trunkDark);
  p.rect(10, 30, 4, 2, trunkDark); p.rect(18, 30, 4, 2, trunkDark);

  p.ellipse(16, 22, 10, 6, main);
  p.ellipse(16, 17, 9, 6, main);
  p.ellipse(16, 11, 7, 6, main);
  p.ellipse(13, 9, 4, 4, leafLight);
  p.ellipse(19, 12, 3, 3, leafLight);
  p.ellipse(11, 19, 3, 3, leafLight);
  p.ellipse(20, 20, 3, 3, leafDark);
  p.ellipse(13, 22, 3, 2, leafDark);

  p.shadeRegion(5, 5, 22, 18);
}

function drawChest(p: PixelPainter, main: RGBA, accent: RGBA) {
  const wood = hex('#8b5e3c');
  const woodDark = hex('#5a3a1a');
  const metal = hex('#c0a030');
  const metalDark = hex('#8a7020');
  const gemColor = hex('#e040fb');
  const insideColor = hex('#3a2000');

  p.rect(5, 14, 22, 16, wood);
  p.rect(5, 9, 22, 7, shade(wood, 1.2));
  p.rect(6, 7, 20, 4, shade(wood, 1.2));
  p.ellipse(16, 9, 10, 4, shade(wood, 1.2));

  p.rect(4, 13, 24, 2, metal);
  p.rect(14, 7, 4, 23, metal);
  p.rect(4, 10, 2, 20, metal);
  p.rect(26, 10, 2, 20, metal);
  p.rect(4, 27, 24, 2, metalDark);
  for (const [sx, sy] of [[5,10],[26,10],[5,27],[26,27]]) {
    p.ellipse(sx, sy, 2, 2, metal);
    p.pixel(sx - 1, sy - 1, shade(metal, 1.5));
  }

  p.ellipse(16, 14, 3, 3, metalDark);
  p.ellipse(16, 14, 2, 2, metal);
  p.rect(15, 15, 2, 3, metalDark);

  p.ellipse(16, 10, 3, 3, gemColor);
  p.pixel(15, 9, shade(gemColor, 1.6));
  p.rect(7, 12, 18, 2, insideColor);
  p.rect(7, 17, 18, 1, woodDark); p.rect(7, 21, 18, 1, woodDark); p.rect(7, 25, 18, 1, woodDark);

  p.shadeRegion(5, 7, 22, 8);
  p.shadeRegion(5, 14, 22, 16);
}

function drawGenericHumanoid(p: PixelPainter, main: RGBA, accent: RGBA, expression: Expression = 'neutral') {
  const cloth = main;
  const clothDark = shade(main, 0.6);
  const belt = shade(accent, 0.8);
  const boot = shade(main, 0.4);

  p.ellipse(16, 7, 7, 7, cloth);
  p.rect(11, 5, 10, 8, SKIN);
  p.ellipse(16, 7, 5, 5, SKIN);
  drawFace(p, 16, 8, expression);

  p.rect(9, 15, 14, 11, cloth);
  p.rect(9, 22, 14, 2, belt);
  p.shadeRegion(9, 15, 14, 11);
  p.shadeSide(9, 15, 14, 11);

  p.rect(5, 15, 5, 8, cloth); p.rect(22, 15, 5, 8, cloth);
  p.rect(5, 23, 5, 2, SKIN); p.rect(22, 23, 5, 2, SKIN);

  p.rect(10, 26, 5, 5, clothDark); p.rect(17, 26, 5, 5, clothDark);
  p.rect(9, 30, 6, 2, boot); p.rect(17, 30, 6, 2, boot);
  p.rect(12, 14, 8, 2, shade(cloth, 1.2));

  p.shadeRegion(5, 15, 5, 8); p.shadeRegion(22, 15, 5, 8);
}

// ─── NEW Subject Drawers ──────────────────────────────────────────────────────

function drawGoblin(p: PixelPainter, main: RGBA, accent: RGBA) {
  const skin = hex('#5a9e2f');
  const skinDark = hex('#3d7020');
  const eye = hex('#ffee00');
  const tooth = rgb(240, 240, 200);

  // Big ears
  p.ellipse(8, 10, 3, 4, skin);
  p.ellipse(24, 10, 3, 4, skin);
  p.pixel(8, 10, skinDark); p.pixel(24, 10, skinDark);

  // Head (small, wide)
  p.rect(10, 6, 12, 9, skin);
  p.ellipse(16, 10, 6, 5, skin);

  // Big glowing eyes
  p.ellipse(13, 9, 2, 2, eye);
  p.pixel(13, 9, DARK);
  p.pixel(12, 8, rgb(255, 255, 200, 200));
  p.ellipse(19, 9, 2, 2, eye);
  p.pixel(19, 9, DARK);
  p.pixel(18, 8, rgb(255, 255, 200, 200));

  // Nose bump
  p.pixel(15, 11, skinDark); p.pixel(16, 11, skinDark); p.pixel(17, 11, skinDark);

  // Toothy grin
  p.rect(12, 13, 8, 2, skinDark);
  p.pixel(13, 13, tooth); p.pixel(15, 13, tooth); p.pixel(17, 13, tooth); p.pixel(19, 13, tooth);
  p.pixel(14, 14, tooth); p.pixel(16, 14, tooth); p.pixel(18, 14, tooth);

  // Hunched body
  p.rect(10, 15, 12, 9, main);
  p.rect(8, 16, 4, 7, main); // left arm (longer, hunched)
  p.rect(20, 16, 4, 7, main);
  // Clawed hands
  p.pixel(7, 23, DARK); p.pixel(8, 24, DARK); p.pixel(9, 24, DARK);
  p.pixel(23, 23, DARK); p.pixel(22, 24, DARK); p.pixel(21, 24, DARK);

  // Belt / loincloth
  p.rect(10, 22, 12, 3, accent);

  // Short legs
  p.rect(11, 25, 4, 5, shade(main, 0.7));
  p.rect(17, 25, 4, 5, shade(main, 0.7));
  // Feet
  p.rect(10, 29, 5, 2, skinDark); p.rect(17, 29, 5, 2, skinDark);

  p.shadeRegion(10, 6, 12, 9); p.shadeRegion(10, 15, 12, 9);
}

function drawVampire(p: PixelPainter, main: RGBA, accent: RGBA) {
  const capeColor = hex('#8b0000');
  const capeInner = hex('#4a0000');
  const formalWhite = rgb(240, 240, 235);
  const skinPale = hex('#e8d5c8');

  // Cape (billowing, spreads wide)
  p.rect(3, 12, 26, 18, capeColor);
  p.rect(4, 13, 24, 17, capeInner);
  // Cape collar / shoulders
  p.rect(7, 10, 18, 4, capeColor);
  p.pixel(7, 10, shade(capeColor, 1.3)); p.pixel(24, 10, shade(capeColor, 1.3));
  // Cape bottom scallops
  for (let x = 4; x < 28; x += 4) p.rect(x, 29, 3, 2, capeColor);

  // Formal shirt
  p.rect(11, 14, 10, 10, formalWhite);
  // Bow tie
  p.rect(13, 15, 2, 2, accent);
  p.rect(17, 15, 2, 2, accent);
  p.pixel(16, 16, accent);

  // Head
  p.rect(10, 3, 12, 10, skinPale);
  p.pixel(9, 6, SKIN_SHADOW); p.pixel(22, 6, SKIN_SHADOW);

  // Widow's peak hair
  p.rect(10, 1, 12, 4, DARK);
  p.pixel(15, 4, DARK); p.pixel(16, 4, DARK); p.pixel(17, 4, DARK); // peak
  p.pixel(15, 5, DARK); p.pixel(17, 5, DARK);

  // Eyes (glowing red)
  const redEye: RGBA = [200, 20, 20, 255];
  p.rect(11, 6, 3, 2, redEye);
  p.rect(18, 6, 3, 2, redEye);
  p.pixel(12, 6, rgb(255, 100, 100)); p.pixel(19, 6, rgb(255, 100, 100));

  // Fangs
  p.rect(14, 11, 2, 3, formalWhite);
  p.rect(17, 11, 2, 3, formalWhite);
  p.pixel(15, 13, hex('#cc0000')); p.pixel(18, 13, hex('#cc0000'));

  // Nose
  p.pixel(15, 9, SKIN_SHADOW); p.pixel(16, 9, SKIN_SHADOW);

  // Legs in dark trousers
  p.rect(11, 24, 5, 7, DARK);
  p.rect(16, 24, 5, 7, DARK);
  p.rect(10, 30, 6, 2, hex('#2a0a0a')); p.rect(16, 30, 6, 2, hex('#2a0a0a'));

  p.shadeRegion(10, 3, 12, 10); p.shadeRegion(3, 12, 26, 18);
}

function drawWitch(p: PixelPainter, main: RGBA, accent: RGBA) {
  const hatColor = main;
  const robeColor = main;
  const skinTone = hex('#d4c9a8');

  // Tall pointy hat
  p.rect(15, 0, 3, 3, hatColor);
  p.rect(13, 3, 6, 3, hatColor);
  p.rect(11, 6, 10, 3, hatColor);
  p.hstripes(9, 8, 14, 2, hatColor, accent, 1);

  // Hat brim wider
  p.rect(8, 9, 16, 2, shade(hatColor, 0.8));

  // Long hair (flows down sides)
  p.rect(9, 11, 3, 10, hex('#2a1a00'));
  p.rect(20, 11, 3, 10, hex('#2a1a00'));
  p.rect(9, 18, 2, 5, hex('#2a1a00'));

  // Head
  p.rect(10, 11, 12, 9, skinTone);
  p.pixel(9, 13, SKIN_SHADOW); p.pixel(22, 13, SKIN_SHADOW);
  drawFace(p, 16, 13, 'grin');

  // Wart on nose
  p.pixel(16, 16, hex('#7a8a30'));

  // Robe body (wide)
  p.rect(8, 20, 16, 12, robeColor);
  p.shadeRegion(8, 20, 16, 12);
  // Robe detail - stars/moons
  p.pixel(11, 22, accent); p.pixel(20, 24, accent); p.pixel(13, 26, accent);
  p.pixel(19, 22, hex('#ffff80')); p.pixel(12, 28, hex('#ffff80'));

  // Wide sleeves
  p.rect(3, 20, 6, 7, robeColor);
  p.rect(23, 20, 6, 7, robeColor);
  // Hands
  p.rect(3, 26, 5, 2, skinTone);
  p.rect(24, 26, 5, 2, skinTone);
  // Broom in hand
  p.rect(1, 10, 2, 20, hex('#8b5e2c'));
  p.rect(0, 28, 4, 3, hex('#c8a060'));
  p.pixel(0, 30, hex('#a08040')); p.pixel(1, 31, hex('#a08040')); p.pixel(3, 31, hex('#a08040'));

  // Cat familiar
  p.rect(24, 28, 5, 4, DARK);
  p.pixel(24, 27, DARK); p.pixel(28, 27, DARK); // ears
  p.pixel(25, 29, hex('#ffcc00')); p.pixel(27, 29, hex('#ffcc00')); // eyes

  p.shadeRegion(10, 11, 12, 9);
  p.shadeRegion(3, 20, 6, 7); p.shadeRegion(23, 20, 6, 7);
}

function drawDemon(p: PixelPainter, main: RGBA, accent: RGBA) {
  const skin = main;
  const darkSkin = shade(main, 0.55);
  const hornColor = hex('#8b0000');
  const eye = hex('#ff4400');

  // Curved horns
  p.rect(10, 0, 3, 5, hornColor);
  p.pixel(11, 5, hornColor); p.pixel(12, 6, hornColor);
  p.rect(19, 0, 3, 5, hornColor);
  p.pixel(20, 5, hornColor); p.pixel(19, 6, hornColor);
  p.shadeRegion(10, 0, 3, 5); p.shadeRegion(19, 0, 3, 5);

  // Head
  p.rect(9, 5, 14, 10, skin);
  p.pixel(8, 8, darkSkin); p.pixel(23, 8, darkSkin);

  // Glowing eyes
  p.rect(10, 9, 3, 2, eye);
  p.rect(19, 9, 3, 2, eye);
  p.pixel(11, 9, rgb(255, 150, 100)); p.pixel(20, 9, rgb(255, 150, 100));

  // Nose - wide demonic
  p.rect(14, 12, 4, 2, darkSkin);

  // Mouth - wide evil grin
  p.rect(11, 14, 10, 2, DARK);
  p.pixel(12, 13, darkSkin); p.pixel(21, 13, darkSkin);
  // Fangs
  for (let x = 12; x < 22; x += 2) p.pixel(x, 14, rgb(240, 230, 210));

  // Muscular body
  p.rect(9, 15, 14, 12, skin);
  p.rect(7, 15, 4, 10, skin); // left arm
  p.rect(21, 15, 4, 10, skin);
  // Muscle definition
  p.rect(12, 16, 8, 2, shade(skin, 1.2));
  p.pixel(13, 20, darkSkin); p.pixel(15, 20, darkSkin); p.pixel(17, 20, darkSkin);

  // Chest insignia (glowing rune)
  p.pixel(16, 19, accent); p.pixel(15, 18, accent); p.pixel(17, 18, accent); p.pixel(16, 17, accent);

  // Hands with claws
  p.rect(5, 25, 4, 3, skin);
  p.rect(23, 25, 4, 3, skin);
  p.pixel(5, 27, DARK); p.pixel(6, 28, DARK); p.pixel(7, 28, DARK); p.pixel(8, 27, DARK);
  p.pixel(23, 27, DARK); p.pixel(24, 28, DARK); p.pixel(25, 28, DARK); p.pixel(26, 27, DARK);

  // Loincloth
  p.rect(10, 27, 12, 4, accent);

  // Hooved legs
  p.rect(11, 27, 4, 5, shade(skin, 0.7));
  p.rect(17, 27, 4, 5, shade(skin, 0.7));
  p.rect(10, 30, 5, 3, DARK); p.rect(17, 30, 5, 3, DARK);

  // Tail
  p.rect(23, 22, 2, 5, skin);
  p.pixel(24, 27, hornColor); p.pixel(25, 26, hornColor); p.pixel(25, 28, hornColor);

  p.shadeRegion(9, 5, 14, 10); p.shadeRegion(9, 15, 14, 12);
}

function drawAngel(p: PixelPainter, main: RGBA, accent: RGBA) {
  const white = rgb(245, 245, 255);
  const feather = rgb(255, 255, 240);
  const glow = rgb(255, 245, 150, 200);
  const halo = hex('#ffd700');

  // Halo
  for (let dx = -5; dx <= 5; dx++) {
    const dy = Math.abs(dx) > 3 ? -1 : 0;
    p.pixel(16 + dx, 1 + dy, halo);
  }
  p.pixel(16, 0, shade(halo, 1.4));

  // Wings (large, billowing)
  // Left wing
  p.rect(1, 10, 10, 8, feather);
  p.rect(2, 7, 7, 5, feather);
  p.rect(1, 14, 8, 6, feather);
  // Feather details
  for (let y = 8; y < 20; y += 2) p.pixel(4, y, rgb(220, 220, 200));
  for (let y = 8; y < 18; y += 2) p.pixel(7, y, rgb(220, 220, 200));
  // Right wing
  p.rect(21, 10, 10, 8, feather);
  p.rect(23, 7, 7, 5, feather);
  p.rect(23, 14, 8, 6, feather);
  for (let y = 8; y < 20; y += 2) p.pixel(28, y, rgb(220, 220, 200));
  for (let y = 8; y < 18; y += 2) p.pixel(25, y, rgb(220, 220, 200));

  // Head
  p.rect(10, 3, 12, 9, SKIN);
  p.pixel(9, 6, SKIN_SHADOW); p.pixel(22, 6, SKIN_SHADOW);
  drawFace(p, 16, 6, 'happy');

  // Robe (white/golden)
  p.rect(9, 12, 14, 14, white);
  p.hstripes(9, 12, 14, 14, white, rgb(240, 240, 255), 3);
  // Golden trim
  p.rect(9, 12, 14, 2, halo);
  p.hstripes(9, 25, 14, 3, halo, shade(halo, 0.8), 1);

  // Arms
  p.rect(5, 12, 5, 8, white);
  p.rect(22, 12, 5, 8, white);
  p.rect(5, 20, 5, 2, SKIN); p.rect(22, 20, 5, 2, SKIN);

  // Glow aura (subtle)
  for (let i = 0; i < 4; i++) {
    p.pixel(8, 12 + i * 3, glow); p.pixel(24, 12 + i * 3, glow);
  }

  p.shadeRegion(10, 3, 12, 9); p.shadeRegion(9, 12, 14, 14);
}

function drawReaper(p: PixelPainter, main: RGBA, accent: RGBA) {
  const robeColor = DARK;
  const cloakInner = rgb(30, 20, 40);
  const scytheBlade = hex('#9badb7');
  const scythePole = hex('#5a3a18');
  const glowEye = hex('#00ff88');

  // Scythe (large, over shoulder)
  p.rect(24, 0, 2, 30, scythePole);
  // Blade curve
  p.rect(14, 0, 12, 2, scytheBlade);
  p.rect(16, 2, 10, 2, scytheBlade);
  p.rect(20, 4, 6, 2, scytheBlade);
  p.rect(23, 6, 3, 2, scytheBlade);
  p.pixel(14, 0, shade(scytheBlade, 1.5)); p.pixel(15, 0, shade(scytheBlade, 1.5));
  p.pixel(14, 1, shade(scytheBlade, 1.3));

  // Hood/cloak (enveloping)
  p.rect(7, 0, 18, 32, robeColor);
  p.rect(6, 5, 20, 27, robeColor);
  p.rect(5, 10, 22, 22, robeColor);
  p.rect(4, 15, 24, 17, robeColor);

  // Hood shadow
  p.rect(9, 2, 14, 7, cloakInner);
  p.rect(11, 5, 10, 5, cloakInner);

  // Glowing eyes in darkness
  p.pixel(13, 6, glowEye); p.pixel(14, 6, glowEye);
  p.pixel(18, 6, glowEye); p.pixel(19, 6, glowEye);
  p.pixel(13, 5, rgb(0, 200, 100, 100)); p.pixel(19, 5, rgb(0, 200, 100, 100));

  // Skeletal hand clutching scythe
  p.rect(22, 18, 3, 4, hex('#e8e0cc'));
  p.pixel(22, 22, DARK); p.pixel(23, 23, DARK); p.pixel(24, 23, DARK); p.pixel(25, 22, DARK);

  // Cloak folds detail
  p.rect(8, 12, 1, 18, cloakInner);
  p.rect(23, 12, 1, 18, cloakInner);
  p.rect(11, 20, 1, 12, cloakInner);
  p.rect(20, 20, 1, 12, cloakInner);

  p.shadeRegion(4, 0, 24, 32);
}

function drawZombie(p: PixelPainter, main: RGBA, accent: RGBA) {
  const skin = hex('#7aab6a');  // sickly green
  const skinDark = hex('#4a7a4a');
  const rot = hex('#3a5a2a');
  const torn = shade(main, 0.6);

  // Arms outstretched (zombie pose)
  p.rect(2, 14, 8, 4, skin);   // left arm extended
  p.rect(22, 14, 8, 4, skin);  // right arm extended
  // Dangling hands
  p.rect(1, 18, 6, 3, skin);
  p.rect(25, 18, 6, 3, skin);
  // Missing finger details
  p.pixel(1, 18, skinDark); p.pixel(3, 18, skinDark); p.pixel(5, 18, skinDark);

  // Head (tilted, lolling)
  p.rect(10, 5, 12, 10, skin);
  p.pixel(9, 8, skinDark); p.pixel(22, 8, skinDark);

  // Decayed eyes - one normal, one X
  p.rect(11, 8, 3, 2, rgb(210, 210, 200));
  p.pixel(12, 8, DARK);
  // X eye
  p.pixel(19, 8, DARK); p.pixel(21, 8, DARK); p.pixel(20, 9, DARK); p.pixel(19, 10, DARK); p.pixel(21, 10, DARK);
  p.rect(19, 8, 3, 3, rgb(150, 0, 0, 180));
  p.pixel(19, 8, DARK); p.pixel(21, 8, DARK); p.pixel(20, 9, DARK); p.pixel(19, 10, DARK); p.pixel(21, 10, DARK);

  // Rotting face
  p.rect(13, 11, 6, 2, skinDark); // sunken cheeks
  p.pixel(15, 12, rot); p.pixel(16, 12, rot);

  // Exposed brain detail
  p.ellipse(16, 5, 4, 3, hex('#cc88aa'));
  p.pixel(14, 4, hex('#aa6688')); p.pixel(18, 4, hex('#aa6688'));

  // Torn clothes body
  p.rect(10, 15, 12, 10, main);
  p.shadeRegion(10, 15, 12, 10);
  // Torn edges
  p.pixel(10, 15, torn); p.pixel(11, 14, torn); p.pixel(14, 24, rot);
  p.pixel(21, 15, torn); p.pixel(20, 14, torn); p.pixel(17, 24, rot);

  // Legs (staggering)
  p.rect(10, 25, 5, 7, shade(main, 0.7));
  p.rect(17, 26, 5, 6, shade(main, 0.7));
  p.rect(9, 31, 6, 2, skinDark); p.rect(17, 31, 5, 2, skinDark);

  p.shadeRegion(10, 5, 12, 10);
}

function drawWolf(p: PixelPainter, main: RGBA, accent: RGBA) {
  const fur = main;
  const furLight = shade(main, 1.4);
  const furDark = shade(main, 0.6);
  const eyeGlow: RGBA = [255, 200, 50, 255];
  const nose = DARK;
  const tooth = rgb(245, 245, 245);

  // Tail (up and curled)
  p.rect(26, 10, 4, 14, fur);
  p.rect(27, 8, 3, 4, fur);
  p.pixel(28, 7, furDark);

  // Body
  p.ellipse(14, 22, 10, 7, fur);
  // Belly (lighter)
  p.ellipse(14, 24, 6, 4, furLight);

  // Head (turned 3/4)
  p.ellipse(10, 12, 7, 6, fur);

  // Ears (pointed)
  p.rect(5, 5, 4, 5, fur);
  p.pixel(6, 4, furDark); p.pixel(7, 4, furDark); p.pixel(8, 4, furDark);
  p.rect(6, 6, 2, 3, furLight); // inner ear
  p.rect(13, 5, 4, 5, fur);
  p.pixel(14, 4, furDark); p.pixel(15, 4, furDark);
  p.rect(14, 6, 2, 3, furLight);

  // Snout
  p.rect(3, 12, 5, 4, fur);
  p.ellipse(4, 12, 2, 2, shade(fur, 0.8)); // nose area
  p.ellipse(4, 11, 2, 1, nose); // nose tip
  p.pixel(3, 12, nose); p.pixel(5, 12, nose); // nostrils

  // Jaws
  p.rect(3, 14, 5, 2, furDark);
  p.pixel(4, 14, tooth); p.pixel(6, 14, tooth); p.pixel(7, 14, tooth); // fangs

  // Eyes
  p.ellipse(9, 10, 2, 2, eyeGlow);
  p.pixel(9, 10, DARK); // pupil
  p.pixel(8, 9, rgb(255, 240, 100, 200));

  // Legs
  p.rect(7, 27, 4, 6, fur);   // front left
  p.rect(13, 28, 4, 5, fur);  // front right
  p.rect(18, 27, 4, 6, fur);  // back left
  p.rect(23, 28, 4, 5, fur);  // back right
  // Paws
  p.rect(6, 32, 5, 2, furDark); p.rect(12, 32, 5, 2, furDark);
  p.rect(17, 32, 5, 2, furDark); p.rect(22, 32, 5, 2, furDark);

  p.shadeRegion(4, 6, 14, 12); p.shadeRegion(4, 15, 20, 14);
}

function drawSpider(p: PixelPainter, main: RGBA, accent: RGBA) {
  const bodyColor = main;
  const legColor = shade(main, 0.7);
  const eyeColor = hex('#ff2200');
  const abdomenColor = shade(main, 0.8);

  // 8 legs (4 per side)
  // Left legs
  p.rect(3, 14, 9, 1, legColor); // L1
  p.rect(2, 17, 10, 1, legColor); // L2
  p.rect(2, 20, 10, 1, legColor); // L3
  p.rect(4, 23, 8, 1, legColor);  // L4
  // Leg joints/bends
  p.pixel(6, 13, legColor); p.pixel(5, 12, legColor); // L1 bend
  p.pixel(5, 16, legColor); p.pixel(4, 15, legColor);
  p.pixel(4, 19, legColor); p.pixel(3, 18, legColor);
  p.pixel(6, 22, legColor); p.pixel(5, 21, legColor);

  // Right legs
  p.rect(20, 14, 9, 1, legColor);
  p.rect(20, 17, 10, 1, legColor);
  p.rect(20, 20, 10, 1, legColor);
  p.rect(20, 23, 8, 1, legColor);
  p.pixel(26, 13, legColor); p.pixel(27, 12, legColor);
  p.pixel(27, 16, legColor); p.pixel(28, 15, legColor);
  p.pixel(28, 19, legColor); p.pixel(29, 18, legColor);
  p.pixel(26, 22, legColor); p.pixel(27, 21, legColor);

  // Cephalothorax (front body)
  p.ellipse(16, 17, 6, 5, bodyColor);

  // Abdomen (large, round, rear)
  p.ellipse(16, 26, 8, 7, abdomenColor);
  // Abdomen pattern
  p.ellipse(16, 25, 4, 3, accent);
  p.pixel(16, 23, shade(accent, 1.3)); p.pixel(14, 25, shade(accent, 0.8)); p.pixel(18, 25, shade(accent, 0.8));

  // 8 eyes (2x4 grid)
  const eyePositions = [[13,14],[14,13],[16,13],[18,13],[19,14],[14,15],[16,15],[18,15]];
  for (const [ex, ey] of eyePositions) {
    p.pixel(ex, ey, eyeColor);
  }

  // Chelicerae (fangs)
  p.rect(14, 20, 2, 3, bodyColor);
  p.rect(17, 20, 2, 3, bodyColor);
  p.pixel(14, 22, accent); p.pixel(18, 22, accent);

  // Silk thread
  p.rect(16, 1, 1, 4, rgb(200, 200, 200, 180));

  p.shadeRegion(10, 12, 12, 10); p.shadeRegion(8, 19, 16, 14);
}

function drawBat(p: PixelPainter, main: RGBA, accent: RGBA) {
  const wingColor = main;
  const wingMembrane = shade(main, 0.7);
  const bodyColor = shade(main, 1.2);
  const eyeColor: RGBA = [200, 20, 20, 255];

  // Left wing (spread, webbed)
  p.rect(0, 12, 12, 2, wingColor);
  p.rect(1, 10, 10, 4, wingColor);
  p.rect(2, 8, 8, 6, wingMembrane);
  p.rect(3, 6, 6, 7, wingMembrane);
  p.rect(5, 4, 4, 8, wingMembrane);
  // Wing finger bones
  p.rect(0, 13, 12, 1, shade(wingColor, 0.8));
  p.rect(3, 7, 1, 7, shade(wingColor, 0.9));
  p.rect(6, 5, 1, 9, shade(wingColor, 0.9));

  // Right wing
  p.rect(20, 12, 12, 2, wingColor);
  p.rect(21, 10, 10, 4, wingColor);
  p.rect(22, 8, 8, 6, wingMembrane);
  p.rect(23, 6, 6, 7, wingMembrane);
  p.rect(23, 4, 4, 8, wingMembrane);
  p.rect(20, 13, 12, 1, shade(wingColor, 0.8));
  p.rect(28, 7, 1, 7, shade(wingColor, 0.9));
  p.rect(25, 5, 1, 9, shade(wingColor, 0.9));

  // Body (small, round)
  p.ellipse(16, 16, 5, 6, bodyColor);

  // Head (with ears)
  p.ellipse(16, 10, 5, 5, bodyColor);

  // Pointed ears
  p.rect(11, 4, 3, 5, bodyColor);
  p.pixel(12, 3, shade(bodyColor, 0.8)); p.pixel(12, 4, shade(bodyColor, 0.8));
  p.pixel(12, 5, accent); // inner ear
  p.rect(18, 4, 3, 5, bodyColor);
  p.pixel(19, 3, shade(bodyColor, 0.8)); p.pixel(19, 4, shade(bodyColor, 0.8));
  p.pixel(19, 5, accent);

  // Eyes (red, glowing)
  p.ellipse(13, 10, 2, 2, eyeColor);
  p.pixel(13, 10, DARK);
  p.pixel(12, 9, rgb(255, 100, 100, 200));
  p.ellipse(19, 10, 2, 2, eyeColor);
  p.pixel(19, 10, DARK);
  p.pixel(18, 9, rgb(255, 100, 100, 200));

  // Nose
  p.pixel(15, 12, DARK); p.pixel(16, 12, DARK); p.pixel(17, 12, DARK);

  // Fangs
  p.pixel(14, 14, rgb(240, 240, 220));
  p.pixel(18, 14, rgb(240, 240, 220));

  // Feet / claws (hanging)
  p.rect(14, 22, 2, 4, DARK); p.rect(16, 22, 2, 4, DARK);
  p.pixel(13, 25, DARK); p.pixel(16, 26, DARK); p.pixel(18, 25, DARK);

  p.shadeRegion(11, 4, 10, 18);
}

function drawGargoyle(p: PixelPainter, main: RGBA, accent: RGBA) {
  const stone = main;
  const stoneDark = shade(main, 0.55);
  const stoneLight = shade(main, 1.3);
  const eyeGlow = hex('#ff6600');

  // Stone wings (folded, tucked behind)
  p.rect(3, 8, 8, 16, stoneDark);
  p.rect(21, 8, 8, 16, stoneDark);
  // Wing texture
  for (let y = 9; y < 22; y += 2) { p.pixel(4, y, shade(stoneDark, 1.2)); p.pixel(27, y, shade(stoneDark, 1.2)); }

  // Crouching body (stocky, hunched)
  p.rect(9, 16, 14, 12, stone);
  p.shadeRegion(9, 16, 14, 12);

  // Massive shoulders/arms
  p.rect(5, 15, 6, 11, stone);
  p.rect(21, 15, 6, 11, stone);
  p.shadeRegion(5, 15, 6, 11); p.shadeRegion(21, 15, 6, 11);

  // Clawed hands (large)
  p.rect(4, 26, 7, 4, stone);
  p.pixel(3, 27, DARK); p.pixel(3, 28, DARK); p.pixel(4, 29, DARK);
  p.pixel(5, 30, DARK); p.pixel(7, 30, DARK); p.pixel(9, 30, DARK);
  p.rect(21, 26, 7, 4, stone);
  p.pixel(29, 27, DARK); p.pixel(29, 28, DARK); p.pixel(28, 29, DARK);
  p.pixel(27, 30, DARK); p.pixel(25, 30, DARK); p.pixel(23, 30, DARK);

  // Head (horned, scary)
  p.rect(10, 6, 12, 11, stone);
  p.pixel(9, 9, stoneDark); p.pixel(22, 9, stoneDark);
  // Horns
  p.rect(11, 2, 3, 5, stoneDark);
  p.pixel(12, 1, stoneDark);
  p.rect(18, 2, 3, 5, stoneDark);
  p.pixel(19, 1, stoneDark);

  // Eyes (glowing orange)
  p.rect(11, 9, 3, 2, eyeGlow);
  p.rect(18, 9, 3, 2, eyeGlow);
  p.pixel(12, 9, rgb(255, 150, 80)); p.pixel(19, 9, rgb(255, 150, 80));

  // Snout / muzzle
  p.rect(13, 12, 6, 4, shade(stone, 0.8));
  p.pixel(14, 15, DARK); p.pixel(15, 15, DARK); p.pixel(17, 15, DARK); p.pixel(18, 15, DARK);
  // Jutting chin
  p.rect(14, 16, 4, 2, stoneDark);

  // Stone texture accents
  p.pixel(13, 18, stoneLight); p.pixel(17, 20, stoneLight); p.pixel(11, 22, stoneLight);
  p.pixel(21, 18, stoneLight); p.pixel(15, 24, stoneLight);

  p.shadeRegion(10, 6, 12, 11);
}

// ─── Item / Object Drawers ────────────────────────────────────────────────────

function drawCoin(p: PixelPainter, main: RGBA, accent: RGBA) {
  const gold = hex('#f5c842');
  const goldDark = hex('#8a6800');
  const goldLight = hex('#fff176');
  const rim = hex('#c8a000');

  // Coin body (shiny disc)
  p.ellipse(16, 16, 12, 12, gold);
  // Inner ring
  p.ellipse(16, 16, 10, 10, shade(gold, 1.1));
  // Symbol (stylized coin face)
  p.ellipse(16, 14, 3, 4, goldDark); // head silhouette
  // Crown on symbol
  p.rect(14, 11, 5, 2, goldDark);
  p.pixel(14, 10, goldDark); p.pixel(16, 10, goldDark); p.pixel(18, 10, goldDark);
  // Neck/chest
  p.rect(15, 18, 3, 2, goldDark);

  // Shine arc
  p.ellipse(11, 10, 3, 2, goldLight);
  p.pixel(10, 9, rgb(255, 255, 255, 200));

  // Rim (edge definition)
  for (let angle = 0; angle < 360; angle += 15) {
    const rad = angle * Math.PI / 180;
    const ex = Math.round(16 + 11 * Math.cos(rad));
    const ey = Math.round(16 + 11 * Math.sin(rad));
    p.pixel(ex, ey, rim);
  }

  // Stars accent
  p.pixel(20, 12, goldLight); p.pixel(12, 20, goldLight);

  p.shadeRegion(4, 4, 24, 24);
}

function drawKey(p: PixelPainter, main: RGBA, accent: RGBA) {
  const metal = hex('#c8a000');
  const metalDark = hex('#7a5f00');
  const metalLight = hex('#fff176');
  const gemColor = accent;

  // Key ring (top)
  for (let angle = 0; angle < 360; angle += 10) {
    const rad = angle * Math.PI / 180;
    p.pixel(Math.round(13 + 5 * Math.cos(rad)), Math.round(11 + 5 * Math.sin(rad)), metal);
    p.pixel(Math.round(13 + 4 * Math.cos(rad)), Math.round(11 + 4 * Math.sin(rad)), shade(metal, 1.1));
  }
  // Gem in ring center
  p.ellipse(13, 11, 2, 2, gemColor);
  p.pixel(12, 10, shade(gemColor, 1.5));

  // Key shaft
  p.rect(13, 16, 3, 15, metal);
  p.shadeRegion(13, 16, 3, 15);

  // Key teeth (3 teeth)
  p.rect(16, 18, 3, 2, metal);
  p.rect(16, 23, 4, 2, metal);
  p.rect(16, 28, 3, 2, metal);

  // Highlight
  p.rect(14, 16, 1, 15, metalLight);
  p.pixel(14, 17, rgb(255, 255, 200, 200));

  p.shadeRegion(10, 6, 6, 10);
}

function drawTorch(p: PixelPainter, main: RGBA, accent: RGBA) {
  const wood = hex('#7a5230');
  const woodDark = hex('#4a3010');
  const fireRed = hex('#ff4400');
  const fireOrange = hex('#ff8800');
  const fireYellow = hex('#ffee00');
  const ember = hex('#ff2200');
  const wrap = hex('#8b4513');

  // Pole / handle
  p.rect(14, 16, 4, 17, wood);
  p.shadeRegion(14, 16, 4, 17);
  p.rect(15, 17, 1, 15, woodDark); // grain

  // Wrapping bands
  p.rect(13, 18, 6, 2, wrap);
  p.rect(13, 23, 6, 2, wrap);
  p.rect(13, 28, 6, 2, wrap);

  // Torch head (wider)
  p.rect(11, 13, 10, 5, woodDark);
  p.shadeRegion(11, 13, 10, 5);

  // Ember glow
  p.ellipse(16, 13, 4, 2, ember);

  // Flame (animated-feel, multiple layers)
  // Core
  p.rect(14, 7, 4, 7, fireYellow);
  // Mid flame
  p.rect(13, 5, 6, 6, fireOrange);
  p.pixel(12, 7, fireOrange); p.pixel(20, 7, fireOrange);
  // Outer flame tips
  p.rect(14, 2, 4, 5, fireRed);
  p.pixel(13, 3, fireRed); p.pixel(19, 3, fireRed);
  p.pixel(15, 1, fireOrange); p.pixel(16, 0, fireYellow); p.pixel(17, 1, fireOrange);
  // Flame wisps
  p.pixel(11, 8, fireOrange); p.pixel(10, 9, fireRed);
  p.pixel(21, 8, fireOrange); p.pixel(22, 9, fireRed);

  // Glow halo (subtle)
  p.pixel(16, 12, rgb(255, 200, 100, 120));
  p.pixel(12, 10, rgb(255, 150, 50, 80)); p.pixel(20, 10, rgb(255, 150, 50, 80));

  p.shadeRegion(14, 16, 4, 17);
}

function drawBomb(p: PixelPainter, main: RGBA, accent: RGBA) {
  const bodyColor = hex('#2a2a2a');
  const shine = rgb(100, 100, 130);
  const sparkColor = hex('#ffee00');
  const fuseColor = hex('#8b6914');

  // Body (round bomb)
  p.ellipse(16, 20, 11, 11, bodyColor);
  // Shine highlight
  p.ellipse(11, 14, 3, 3, shine);
  p.pixel(10, 13, rgb(150, 150, 180));

  // Band/stripe
  p.rect(6, 19, 20, 3, shade(bodyColor, 1.3));
  // Bolts
  p.pixel(8, 20, shine); p.pixel(24, 20, shine);

  // Fuse
  p.rect(15, 8, 2, 5, fuseColor);
  p.pixel(16, 7, fuseColor);
  p.pixel(17, 6, fuseColor); p.pixel(18, 5, fuseColor);
  p.pixel(19, 5, fuseColor); p.pixel(20, 4, fuseColor);

  // Sparks at fuse tip
  p.pixel(20, 3, sparkColor); p.pixel(19, 3, sparkColor); p.pixel(21, 4, sparkColor);
  p.pixel(19, 2, accent); p.pixel(21, 2, accent); p.pixel(22, 3, hex('#ff8800'));

  // Reflection on round body
  p.ellipse(12, 22, 2, 2, shade(bodyColor, 1.5));

  p.shadeRegion(5, 9, 22, 22);
}

function drawSkull(p: PixelPainter, main: RGBA, accent: RGBA) {
  const bone = hex('#e8e0cc');
  const boneDark = hex('#b0a898');
  const boneLight = hex('#fffff0');
  const voidColor = DARK;

  // Cranium (large, round)
  p.ellipse(16, 11, 11, 10, bone);
  // Forehead highlight
  p.ellipse(13, 7, 4, 3, boneLight);
  p.pixel(12, 6, rgb(255, 255, 240, 200));

  // Large eye sockets
  p.ellipse(12, 12, 4, 5, voidColor);
  p.ellipse(20, 12, 4, 5, voidColor);
  // Socket highlights (subtle)
  p.pixel(10, 10, boneDark); p.pixel(18, 10, boneDark);

  // Nose cavity (heart-shaped)
  p.rect(15, 17, 2, 2, voidColor);
  p.pixel(14, 17, voidColor); p.pixel(17, 17, voidColor);

  // Jaw (wide, heavy)
  p.rect(9, 20, 14, 6, bone);
  p.shadeRegion(9, 20, 14, 6);
  // Jaw definition
  p.rect(9, 20, 14, 1, boneDark);

  // Teeth (6 big teeth)
  for (let i = 0; i < 6; i++) {
    p.rect(10 + i * 2, 23, 1, 3, bone);
    p.rect(10 + i * 2, 25, 1, 1, boneDark); // tooth tip shadow
  }
  // Tooth gaps
  for (let i = 0; i < 5; i++) p.pixel(11 + i * 2, 23, voidColor);

  // Crack (battle damage)
  p.pixel(16, 5, boneDark); p.pixel(17, 6, boneDark); p.pixel(16, 7, boneDark);

  // Accent glow in eyes (if colored)
  if (accent[0] > 100 || accent[1] > 100 || accent[2] > 100) {
    p.pixel(11, 12, rgb(accent[0], accent[1], accent[2], 100));
    p.pixel(19, 12, rgb(accent[0], accent[1], accent[2], 100));
  }

  p.shadeRegion(5, 1, 22, 20);
}

function drawCrown(p: PixelPainter, main: RGBA, accent: RGBA) {
  const gold = hex('#f5c842');
  const goldDark = hex('#8a6800');
  const goldLight = hex('#fff176');
  const gemRed = hex('#cc0000');
  const gemBlue = hex('#1565c0');
  const gemGreen = hex('#2e7d32');
  const velvet = hex('#8b0000');

  // Crown base band (wide)
  p.rect(5, 18, 22, 8, gold);
  p.shadeRegion(5, 18, 22, 8);

  // Velvet interior / band
  p.rect(6, 19, 20, 6, velvet);
  p.shadeRegion(6, 19, 20, 6);

  // Five points
  // Center (tallest)
  p.rect(14, 7, 4, 12, gold);
  p.shadeRegion(14, 7, 4, 12);
  p.pixel(15, 6, goldDark); p.pixel(16, 5, goldLight); p.pixel(17, 6, goldDark);
  // Inner points
  p.rect(10, 10, 4, 9, gold);
  p.pixel(11, 9, goldDark); p.pixel(12, 8, goldLight); p.pixel(13, 9, goldDark);
  p.rect(18, 10, 4, 9, gold);
  p.pixel(19, 9, goldDark); p.pixel(20, 8, goldLight); p.pixel(21, 9, goldDark);
  // Outer points (shorter)
  p.rect(6, 13, 4, 6, gold);
  p.pixel(7, 12, goldDark); p.pixel(8, 11, goldLight); p.pixel(9, 12, goldDark);
  p.rect(22, 13, 4, 6, gold);
  p.pixel(23, 12, goldDark); p.pixel(24, 11, goldLight); p.pixel(25, 12, goldDark);

  // Gems on band (alternating colors)
  p.ellipse(9, 22, 2, 2, gemRed);
  p.pixel(8, 21, shade(gemRed, 1.6));
  p.ellipse(16, 21, 3, 3, gemBlue);
  p.pixel(15, 20, shade(gemBlue, 1.6)); p.pixel(16, 20, shade(gemBlue, 1.8));
  p.ellipse(23, 22, 2, 2, gemGreen);
  p.pixel(22, 21, shade(gemGreen, 1.6));

  // Gold accent gems on points
  p.pixel(16, 6, rgb(255, 255, 200, 200)); // center shine
  p.pixel(12, 9, rgb(255, 255, 200, 150));
  p.pixel(20, 9, rgb(255, 255, 200, 150));

  // Gold trim at top of band
  p.rect(5, 18, 22, 2, shade(gold, 1.2));
}

function drawGem(p: PixelPainter, main: RGBA, accent: RGBA) {
  const gemColor = main;
  const gemLight = shade(main, 1.6);
  const gemDark = shade(main, 0.5);
  const facetColor = mix(main, rgb(255, 255, 255), 0.4);
  const sparkle = rgb(255, 255, 255, 220);

  // Gem top (flat cut surface)
  p.rect(10, 8, 12, 5, gemLight);
  p.hstripes(10, 8, 12, 5, gemLight, shade(gemLight, 0.9), 2);

  // Main facet faces
  // Front center
  p.rect(8, 13, 16, 8, gemColor);
  // Left face
  p.rect(5, 13, 5, 8, shade(gemColor, 0.7));
  // Right face
  p.rect(23, 13, 5, 8, shade(gemColor, 0.85));
  // Lower taper
  p.rect(9, 21, 14, 5, gemDark);
  // Bottom point
  p.rect(13, 26, 6, 3, gemDark);
  p.rect(15, 29, 2, 2, shade(gemDark, 0.7));
  p.pixel(15, 30, shade(gemDark, 0.5)); p.pixel(16, 30, shade(gemDark, 0.5));

  // Facet lines (inside)
  p.rect(16, 13, 1, 8, facetColor);
  p.rect(10, 15, 1, 6, shade(facetColor, 0.8));
  p.rect(22, 15, 1, 6, shade(facetColor, 0.8));

  // Diagonal facet lines
  for (let i = 0; i < 8; i++) p.pixel(8 + i, 13 + i, facetColor);
  for (let i = 0; i < 8; i++) p.pixel(24 - i, 13 + i, shade(facetColor, 0.9));

  // Top edges
  p.rect(10, 8, 12, 1, sparkle);
  p.pixel(9, 9, sparkle); p.pixel(22, 9, sparkle);

  // Sparkles
  p.pixel(11, 9, sparkle); p.pixel(21, 11, sparkle); p.pixel(14, 10, sparkle);
  p.pixel(13, 10, rgb(255, 255, 255, 150));

  p.shadeRegion(5, 8, 22, 18);
}

function drawTome(p: PixelPainter, main: RGBA, accent: RGBA) {
  const cover = main;
  const coverDark = shade(main, 0.55);
  const page = hex('#f5f0e0');
  const pageDark = hex('#c8c0a8');
  const spine = shade(main, 0.7);
  const goldTrim = hex('#c8a000');
  const runeColor = accent;

  // Spine (left side)
  p.rect(5, 5, 4, 24, spine);
  p.shadeRegion(5, 5, 4, 24);

  // Back cover
  p.rect(5, 5, 22, 3, cover);

  // Pages (visible from top)
  p.rect(9, 5, 16, 22, page);
  // Page lines
  for (let y = 8; y <= 24; y += 2) p.rect(10, y, 14, 1, pageDark);
  // Page right edge shading
  p.rect(23, 6, 2, 20, pageDark);

  // Front cover
  p.rect(9, 4, 18, 25, cover);
  p.shadeRegion(9, 4, 18, 25);

  // Metal corner clasps
  p.rect(9, 4, 4, 3, goldTrim);
  p.rect(23, 4, 4, 3, goldTrim);
  p.rect(9, 26, 4, 3, goldTrim);
  p.rect(23, 26, 4, 3, goldTrim);
  // Clasp gems
  p.pixel(10, 5, shade(goldTrim, 1.5)); p.pixel(24, 5, shade(goldTrim, 1.5));

  // Central rune/symbol (glowing)
  // Circle
  for (let angle = 0; angle < 360; angle += 20) {
    const rad = angle * Math.PI / 180;
    p.pixel(Math.round(18 + 5 * Math.cos(rad)), Math.round(16 + 5 * Math.sin(rad)), runeColor);
  }
  // Inner star
  p.pixel(18, 12, runeColor); p.pixel(18, 20, runeColor);
  p.pixel(14, 16, runeColor); p.pixel(22, 16, runeColor);
  p.pixel(15, 13, runeColor); p.pixel(21, 13, runeColor);
  p.pixel(15, 19, runeColor); p.pixel(21, 19, runeColor);
  p.pixel(18, 16, shade(runeColor, 1.6)); // center glow

  // Title embossing
  p.rect(11, 8, 14, 2, coverDark);

  // Bookmark ribbon
  p.rect(25, 4, 2, 12, hex('#cc0000'));
  p.pixel(25, 16, hex('#aa0000')); p.pixel(26, 17, hex('#aa0000'));

  p.shadeRegion(9, 4, 18, 25);
}

function drawTombstone(p: PixelPainter, main: RGBA, accent: RGBA) {
  const stone = main;
  const stoneDark = shade(main, 0.6);
  const stoneLight = shade(main, 1.25);
  const moss = hex('#3a6e20');
  const rip = rgb(200, 190, 170);

  // Base slab (wide)
  p.rect(5, 28, 22, 4, stoneDark);
  p.shadeRegion(5, 28, 22, 4);

  // Main stone body
  p.rect(8, 12, 16, 18, stone);
  p.shadeRegion(8, 12, 16, 18);

  // Rounded top
  p.ellipse(16, 13, 8, 7, stone);
  p.shadeRegion(8, 6, 16, 8);

  // Cross carved into stone
  p.rect(14, 14, 4, 10, stoneDark);
  p.rect(11, 17, 10, 4, stoneDark);
  p.rect(15, 15, 2, 8, stoneLight); // cross highlight

  // R.I.P. text area
  p.rect(10, 26, 12, 3, stoneDark);
  // RIP letters (dot matrix)
  // R
  p.pixel(11, 27, rip); p.pixel(11, 28, rip); p.pixel(12, 27, rip); p.pixel(13, 27, rip); p.pixel(12, 28, rip); p.pixel(13, 29, rip);
  // I
  p.pixel(15, 27, rip); p.pixel(15, 28, rip); p.pixel(15, 29, rip);
  // P
  p.pixel(17, 27, rip); p.pixel(17, 28, rip); p.pixel(18, 27, rip); p.pixel(19, 27, rip); p.pixel(18, 28, rip);

  // Moss growth (bottom and sides)
  p.rect(8, 27, 4, 3, moss); p.rect(20, 27, 4, 3, moss);
  p.pixel(9, 26, moss); p.pixel(21, 26, moss); p.pixel(11, 27, moss);
  p.rect(8, 12, 2, 4, moss); // left side moss
  p.pixel(9, 11, moss); p.pixel(11, 10, moss);

  // Cracks
  p.pixel(17, 15, shade(stone, 0.5)); p.pixel(18, 16, shade(stone, 0.5)); p.pixel(17, 17, shade(stone, 0.5));

  // Shadow at base
  p.rect(5, 29, 22, 1, shade(stoneDark, 0.6));

  p.shadeRegion(8, 6, 16, 22);
}

function drawDoor(p: PixelPainter, main: RGBA, accent: RGBA) {
  const wood = main;
  const woodDark = shade(main, 0.55);
  const metalColor = hex('#8a7060');
  const metalLight = hex('#c0b080');
  const stoneFrame = hex('#8a8a80');

  // Stone frame
  p.rect(3, 2, 26, 30, stoneFrame);
  p.shadeRegion(3, 2, 26, 30);
  // Stone texture
  p.rect(4, 4, 4, 5, shade(stoneFrame, 1.1));
  p.rect(4, 10, 4, 5, shade(stoneFrame, 0.9));
  p.rect(24, 4, 4, 5, shade(stoneFrame, 1.1));

  // Arch above door
  p.ellipse(16, 8, 10, 7, shade(stoneFrame, 0.7));

  // Door panels (two-panel wooden door)
  p.rect(8, 8, 16, 23, wood);
  p.shadeRegion(8, 8, 16, 23);

  // Center split
  p.rect(15, 8, 2, 23, woodDark);

  // Wood planks horizontal
  p.rect(8, 13, 16, 1, woodDark);
  p.rect(8, 19, 16, 1, woodDark);
  p.rect(8, 25, 16, 1, woodDark);

  // Door knocker
  p.ellipse(16, 17, 2, 2, metalColor);
  p.pixel(16, 17, metalLight);
  // Ring
  p.pixel(14, 17, metalColor); p.pixel(18, 17, metalColor);
  p.pixel(15, 15, metalColor); p.pixel(17, 15, metalColor);
  p.pixel(16, 14, metalColor);

  // Handle knobs
  p.ellipse(12, 21, 2, 2, metalColor);
  p.pixel(12, 20, metalLight);
  p.ellipse(20, 21, 2, 2, metalColor);
  p.pixel(20, 20, metalLight);

  // Keyhole
  p.ellipse(16, 22, 1, 1, woodDark);
  p.rect(15, 23, 2, 2, woodDark);

  // Arch detail stones
  for (let angle = 180; angle <= 360; angle += 20) {
    const rad = angle * Math.PI / 180;
    const ex = Math.round(16 + 9 * Math.cos(rad));
    const ey = Math.round(8 + 7 * Math.sin(rad));
    p.pixel(ex, ey, shade(stoneFrame, 1.2));
  }

  // Ground threshold
  p.rect(6, 30, 20, 2, shade(stoneFrame, 0.6));

  p.shadeRegion(8, 8, 16, 23);
}

function drawRock(p: PixelPainter, main: RGBA, accent: RGBA) {
  const stone = main;
  const stoneDark = shade(main, 0.55);
  const stoneLight = shade(main, 1.35);
  const crack = shade(main, 0.4);

  // Main large boulder
  p.ellipse(17, 21, 13, 10, stone);
  // Ground shadow / flat base
  p.rect(6, 28, 22, 3, stoneDark);
  p.ellipse(17, 28, 13, 3, stoneDark);

  // Smaller rock (left)
  p.ellipse(8, 26, 5, 4, shade(stone, 0.9));

  // Pebbles
  p.ellipse(24, 27, 3, 2, shade(stone, 0.8));
  p.ellipse(6, 29, 2, 2, stoneDark);

  // Surface cracks
  p.pixel(14, 18, crack); p.pixel(15, 19, crack); p.pixel(14, 20, crack); p.pixel(15, 21, crack);
  p.pixel(19, 16, crack); p.pixel(20, 17, crack);
  p.pixel(22, 20, crack); p.pixel(23, 21, crack); p.pixel(22, 22, crack);

  // Highlight (upper-left catching light)
  p.ellipse(11, 16, 4, 3, stoneLight);
  p.pixel(10, 15, rgb(255, 255, 255, 180));
  p.ellipse(13, 18, 2, 2, shade(stoneLight, 0.9));

  // Lichen/moss patches
  p.pixel(20, 20, hex('#5a8a30')); p.pixel(21, 21, hex('#5a8a30')); p.pixel(19, 22, hex('#4a7a20'));
  p.pixel(15, 22, hex('#3a6a10')); p.pixel(16, 23, hex('#3a6a10'));

  p.shadeRegion(4, 11, 26, 20);
}

function drawFlame(p: PixelPainter, main: RGBA, accent: RGBA) {
  const coreColor = hex('#fff176');
  const midColor = hex('#ff8800');
  const outerColor = hex('#ff4400');
  const tipColor = hex('#cc2200');
  const embers = hex('#ff6600');

  // Base (widest)
  p.ellipse(16, 28, 9, 4, outerColor);
  p.rect(8, 26, 16, 5, outerColor);
  // Ground glow
  p.ellipse(16, 30, 8, 2, shade(outerColor, 0.7));

  // Lower flame body
  p.rect(10, 20, 12, 10, midColor);
  p.ellipse(16, 22, 7, 8, midColor);
  // Tongue shapes (left and right lean)
  p.rect(9, 18, 6, 8, outerColor);
  p.rect(17, 16, 6, 10, outerColor);
  p.pixel(9, 17, embers); p.pixel(8, 18, embers);
  p.pixel(22, 15, embers); p.pixel(23, 16, embers);

  // Mid flame
  p.ellipse(16, 17, 5, 7, midColor);
  p.rect(13, 12, 6, 9, midColor);

  // Inner bright core
  p.ellipse(16, 18, 3, 5, coreColor);
  p.rect(14, 14, 4, 8, coreColor);
  p.pixel(14, 13, coreColor); p.pixel(17, 12, coreColor);

  // Flame tips (multiple)
  p.rect(14, 7, 4, 8, outerColor);
  p.pixel(14, 6, outerColor); p.pixel(17, 6, outerColor);
  p.rect(15, 3, 2, 6, tipColor);
  p.pixel(15, 2, embers); p.pixel(16, 1, midColor); p.pixel(17, 2, embers);
  // Side tips
  p.pixel(12, 11, midColor); p.pixel(11, 10, outerColor); p.pixel(10, 11, tipColor);
  p.pixel(20, 10, midColor); p.pixel(21, 9, outerColor); p.pixel(22, 10, tipColor);

  // Embers floating
  p.pixel(8, 15, embers); p.pixel(7, 13, midColor);
  p.pixel(24, 14, embers); p.pixel(25, 12, midColor);
  p.pixel(10, 8, embers); p.pixel(22, 7, embers);

  p.shadeRegion(8, 3, 16, 28);
}

function drawAxe(p: PixelPainter, main: RGBA, accent: RGBA) {
  const blade = hex('#c0c8d0');
  const bladeEdge = hex('#e8f0f8');
  const bladeDark = hex('#6a7880');
  const handle = hex('#6a3a10');
  const handleDark = hex('#4a2808');
  const band = hex('#c8a000');

  // Handle (long, wooden)
  p.rect(15, 8, 3, 25, handle);
  p.shadeRegion(15, 8, 3, 25);
  p.pixel(16, 9, handleDark); p.pixel(16, 14, handleDark); p.pixel(16, 20, handleDark);

  // Metal bands on handle
  p.rect(14, 10, 5, 2, band);
  p.rect(14, 20, 5, 2, band);
  p.rect(14, 28, 5, 2, band);

  // Axe head (left side, large crescent)
  // Back of blade
  p.rect(5, 7, 12, 16, blade);
  p.shadeRegion(5, 7, 12, 16);
  // Crescent curve (bite out of front)
  p.ellipse(14, 15, 5, 9, handleDark); // carve out ellipse shape

  // Blade edge (sharp, bright)
  p.rect(4, 7, 2, 16, bladeEdge);
  p.pixel(3, 9, bladeEdge); p.pixel(3, 14, bladeEdge); p.pixel(3, 19, bladeEdge);
  p.pixel(5, 6, bladeEdge); p.pixel(5, 22, bladeEdge);

  // Top spike
  p.rect(8, 3, 8, 5, blade);
  p.pixel(10, 2, blade); p.pixel(12, 2, blade); p.pixel(14, 2, blade);
  p.pixel(12, 1, bladeEdge); p.pixel(11, 0, bladeEdge);

  // Bottom beard spike
  p.rect(8, 22, 8, 5, blade);
  p.pixel(10, 27, blade); p.pixel(12, 27, blade); p.pixel(14, 27, blade);
  p.pixel(12, 28, bladeEdge);

  // Blood/worn look on blade dark areas
  p.pixel(6, 9, bladeDark); p.pixel(6, 18, bladeDark);
  p.pixel(9, 11, bladeDark); p.pixel(9, 19, bladeDark);

  // Accent: rune on blade
  p.pixel(9, 14, accent); p.pixel(8, 15, accent); p.pixel(9, 16, accent); p.pixel(10, 15, accent);

  p.shadeRegion(4, 3, 12, 25);
}

function drawStaff(p: PixelPainter, main: RGBA, accent: RGBA) {
  const poleColor = hex('#6a4a20');
  const poleDark = hex('#4a2c10');
  const orbColor = main;
  const orbGlow = shade(main, 1.6);
  const crystal = accent;
  const wrap = hex('#8b6914');

  // Staff pole
  p.rect(15, 8, 3, 26, poleColor);
  p.shadeRegion(15, 8, 3, 26);
  p.pixel(16, 10, poleDark); p.pixel(16, 16, poleDark); p.pixel(16, 22, poleDark);

  // Decorative wrappings
  p.rect(14, 12, 5, 2, wrap);
  p.rect(14, 18, 5, 2, wrap);
  p.rect(14, 24, 5, 2, wrap);
  p.rect(14, 30, 5, 2, wrap);

  // Top decorative ferrule
  p.rect(13, 6, 5, 4, hex('#c8a000'));
  p.pixel(14, 5, hex('#f5c842')); p.pixel(16, 5, hex('#f5c842'));

  // Crystal/orb formation at top
  // Main orb
  p.ellipse(16, 4, 5, 5, orbColor);
  p.shadeRegion(11, 0, 10, 8);
  p.pixel(14, 2, orbGlow); p.pixel(15, 1, orbGlow); p.pixel(13, 3, shade(orbGlow, 0.9));

  // Flanking crystals
  p.rect(11, 2, 3, 5, crystal);
  p.pixel(12, 1, crystal); p.pixel(11, 6, shade(crystal, 0.7));
  p.rect(18, 2, 3, 5, crystal);
  p.pixel(19, 1, crystal); p.pixel(20, 6, shade(crystal, 0.7));

  // Glow aura
  p.pixel(16, 0, rgb(orbColor[0], orbColor[1], orbColor[2], 150));
  p.pixel(10, 3, rgb(orbColor[0], orbColor[1], orbColor[2], 100));
  p.pixel(22, 3, rgb(orbColor[0], orbColor[1], orbColor[2], 100));

  // Arcane rune on pole
  p.pixel(15, 20, accent); p.pixel(17, 20, accent);
  p.pixel(16, 19, accent); p.pixel(16, 21, accent);
  p.pixel(15, 22, accent); p.pixel(17, 22, accent);
}

function drawPotion(p: PixelPainter, main: RGBA, accent: RGBA) {
  const liquid = main;
  const glass = rgb(200, 220, 240, 200);
  const glassEdge = rgb(220, 240, 255, 230);
  const glassShine = rgb(255, 255, 255, 220);
  const cork = hex('#8b6914');
  const liquidGlow = shade(main, 1.5);

  // Cork
  p.rect(13, 6, 6, 4, cork);
  p.shadeRegion(13, 6, 6, 4);
  p.rect(14, 9, 4, 2, shade(cork, 0.7));

  // Neck
  p.rect(13, 10, 6, 5, glass);
  p.pixel(13, 11, glassEdge); p.pixel(18, 11, glassEdge);

  // Bottle body (rounded flask)
  p.ellipse(16, 22, 10, 11, glass);
  // Fill with liquid
  p.ellipse(16, 23, 8, 9, liquid);
  p.shadeRegion(8, 13, 16, 20);
  // Liquid level line
  p.ellipse(16, 16, 7, 2, mix(liquid, glass, 0.5));

  // Bubble highlights in liquid
  p.ellipse(12, 22, 2, 2, liquidGlow);
  p.pixel(11, 21, rgb(255, 255, 255, 200));
  p.ellipse(19, 25, 1, 2, liquidGlow);

  // Glass shine (front highlight)
  p.ellipse(11, 19, 3, 4, glassShine);
  p.pixel(10, 18, rgb(255, 255, 255, 200));

  // Glass edge outlines (semi-transparent)
  p.rect(7, 16, 2, 12, glassEdge);
  p.rect(23, 16, 2, 12, glassEdge);

  // Glow aura (liquid color)
  p.pixel(6, 22, rgb(liquid[0], liquid[1], liquid[2], 100));
  p.pixel(26, 22, rgb(liquid[0], liquid[1], liquid[2], 100));
  p.pixel(16, 32, rgb(liquid[0], liquid[1], liquid[2], 80));

  // Label area on bottle
  p.rect(11, 21, 10, 6, mix(liquid, rgb(255, 255, 200), 0.15));
  // Skull & crossbones on label (if main is dark)
  p.pixel(13, 23, shade(liquid, 0.4)); p.pixel(14, 22, shade(liquid, 0.4)); p.pixel(15, 23, shade(liquid, 0.4));
  p.pixel(16, 24, shade(liquid, 0.4)); p.pixel(17, 23, shade(liquid, 0.4)); p.pixel(18, 22, shade(liquid, 0.4)); p.pixel(19, 23, shade(liquid, 0.4));

  p.shadeRegion(8, 12, 16, 20);
}

function drawSword(p: PixelPainter, main: RGBA, accent: RGBA) {
  const blade = hex('#c8d8e8');
  const bladeEdge = hex('#e8f4ff');
  const bladeMid = hex('#a0b8c8');
  const guard = hex('#c8a000');
  const grip = hex('#5a3010');
  const pommel = hex('#c8a000');
  const bloodGroove = hex('#9badb7');

  // Tip (diamond point)
  p.pixel(16, 0, bladeEdge);
  p.pixel(15, 1, bladeEdge); p.pixel(16, 1, blade); p.pixel(17, 1, bladeEdge);
  p.rect(15, 2, 3, 2, blade);

  // Blade (long, with blood groove)
  p.rect(14, 4, 4, 18, blade);
  p.rect(15, 4, 2, 18, bladeEdge); // edge highlight
  // Blood groove (center channel)
  p.rect(16, 4, 1, 16, bloodGroove);
  // Blade facets
  p.rect(14, 6, 1, 14, bladeMid);
  p.rect(17, 6, 1, 14, bladeMid);

  // Fuller/fuller on blade
  p.pixel(15, 8, shade(blade, 1.2)); p.pixel(15, 12, shade(blade, 1.2)); p.pixel(15, 16, shade(blade, 1.2));

  // Crossguard (wide)
  p.rect(7, 22, 18, 3, guard);
  p.shadeRegion(7, 22, 18, 3);
  // Guard decoration
  p.pixel(8, 23, shade(guard, 1.4)); p.pixel(23, 23, shade(guard, 1.4));
  p.ellipse(16, 23, 2, 2, shade(guard, 1.3));
  // Guard tips
  p.rect(6, 22, 3, 4, shade(guard, 0.8));
  p.rect(23, 22, 3, 4, shade(guard, 0.8));
  p.pixel(6, 23, shade(guard, 1.2)); p.pixel(25, 23, shade(guard, 1.2));

  // Grip (wrapped)
  p.rect(14, 25, 4, 7, grip);
  p.shadeRegion(14, 25, 4, 7);
  // Grip wrapping
  for (let y = 25; y < 32; y += 2) p.rect(13, y, 6, 1, shade(grip, 0.8));

  // Pommel (round)
  p.ellipse(16, 33, 4, 3, pommel);
  p.pixel(15, 32, shade(pommel, 1.4)); p.pixel(16, 31, shade(pommel, 1.5));

  p.shadeRegion(14, 4, 4, 18);
}

function drawShield(p: PixelPainter, main: RGBA, accent: RGBA) {
  const shieldFace = main;
  const shieldDark = shade(main, 0.55);
  const shieldLight = shade(main, 1.3);
  const metal = hex('#9badb7');
  const metalDark = hex('#5a7088');
  const bossColor = hex('#c8a000');

  // Shield back/depth
  p.rect(4, 5, 24, 24, shieldDark);

  // Main shield face (kite shape)
  p.rect(6, 4, 20, 22, shieldFace);
  // Rounded top
  p.ellipse(16, 6, 10, 4, shieldFace);
  // Pointed bottom
  p.rect(10, 24, 12, 3, shieldFace);
  p.rect(12, 27, 8, 2, shieldFace);
  p.rect(14, 29, 4, 2, shieldFace);
  p.pixel(15, 30, shieldFace); p.pixel(16, 31, shieldFace); p.pixel(17, 30, shieldFace);

  // Shading
  p.shadeRegion(6, 4, 20, 28);

  // Metal border
  p.rect(5, 4, 2, 24, metal);
  p.rect(25, 4, 2, 24, metal);
  p.rect(6, 3, 20, 2, metal);
  p.shadeRegion(5, 4, 22, 26);

  // Quadrant design (heraldic)
  p.rect(6, 4, 10, 13, shade(shieldFace, 1.15)); // top-left lighter
  p.rect(16, 17, 10, 9, shade(shieldFace, 1.15)); // bottom-right lighter
  // Dividing cross
  p.rect(14, 4, 4, 26, metal);
  p.rect(6, 12, 20, 4, metal);

  // Boss (center rivet)
  p.ellipse(16, 14, 5, 5, bossColor);
  p.pixel(15, 12, shade(bossColor, 1.5)); p.pixel(16, 12, shade(bossColor, 1.6));
  p.ellipse(16, 14, 2, 2, shade(bossColor, 0.7));

  // Accent emblem in each quadrant
  p.pixel(10, 8, accent); p.pixel(11, 9, accent); p.pixel(10, 10, accent);
  p.pixel(21, 18, accent); p.pixel(22, 19, accent); p.pixel(21, 20, accent);

  p.shadeRegion(6, 4, 20, 28);
}

function drawFlower(p: PixelPainter, main: RGBA, accent: RGBA) {
  const petalColor = main;
  const petalLight = shade(main, 1.4);
  const center = accent;
  const stemColor = hex('#3a7a20');
  const leafColor = hex('#2e6b1a');

  // Stem
  p.rect(15, 18, 2, 14, stemColor);
  p.shadeRegion(15, 18, 2, 14);
  // Stem curve
  p.pixel(16, 22, hex('#285a14')); p.pixel(17, 26, hex('#285a14'));

  // Leaves
  p.rect(11, 22, 5, 3, leafColor);
  p.pixel(10, 23, leafColor); p.pixel(10, 22, shade(leafColor, 1.2));
  p.rect(17, 26, 5, 3, leafColor);
  p.pixel(22, 27, leafColor); p.pixel(22, 26, shade(leafColor, 1.2));

  // Petals (8 petals, overlapping)
  const petalPositions = [
    [16, 7], [16, 9], // top
    [16, 23], [16, 21], // bottom
    [7, 15], [9, 15], // left
    [25, 15], [23, 15], // right
    [9, 9], [10, 10],   // top-left
    [23, 9], [22, 10],  // top-right
    [9, 21], [10, 20],  // bot-left
    [23, 21], [22, 20], // bot-right
  ];
  for (const [px, py] of petalPositions) p.ellipse(px, py, 3, 3, petalColor);
  // Petal highlights
  for (const [px, py] of petalPositions.filter((_, i) => i % 2 === 0)) {
    p.pixel(px - 1, py - 1, petalLight);
  }

  // Center (large, detailed)
  p.ellipse(16, 15, 5, 5, center);
  p.shadeRegion(11, 10, 10, 10);
  p.pixel(15, 13, shade(center, 1.4)); p.pixel(16, 13, shade(center, 1.5));
  // Center dots
  p.pixel(14, 15, shade(center, 0.7)); p.pixel(18, 15, shade(center, 0.7));
  p.pixel(16, 17, shade(center, 0.7));

  p.shadeRegion(8, 7, 16, 16);
}

// ─── Animation Frame Offset ──────────────────────────────────────────────────

function applyWalkOffset(p: PixelPainter, frame: number) {
  const offsets = [0, -1, 0, 1];
  const dy = offsets[frame % 4];
  if (dy === 0) return;
  const legStartY = Math.round(26 * p.h / 32);
  const shiftData = new Uint8ClampedArray(p.data.length);
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const srcY = y < legStartY ? y : y - dy;
      const si = (Math.max(0, Math.min(p.h - 1, srcY)) * p.w + x) * 4;
      const di = (y * p.w + x) * 4;
      shiftData[di] = p.data[si]; shiftData[di + 1] = p.data[si + 1];
      shiftData[di + 2] = p.data[si + 2]; shiftData[di + 3] = p.data[si + 3];
    }
  }
  p.data.set(shiftData);
}

// ─── Style Post-Processors ───────────────────────────────────────────────────

// PICO-8 palette (16 colors)
const PICO8_PALETTE: RGBA[] = [
  [0, 0, 0, 255],       // black
  [29, 43, 83, 255],    // dark blue
  [126, 37, 83, 255],   // dark purple
  [0, 135, 81, 255],    // dark green
  [171, 82, 54, 255],   // brown
  [95, 87, 79, 255],    // dark grey
  [194, 195, 199, 255], // light grey
  [255, 241, 232, 255], // white
  [255, 0, 77, 255],    // red
  [255, 163, 0, 255],   // orange
  [255, 236, 39, 255],  // yellow
  [0, 228, 54, 255],    // green
  [41, 173, 255, 255],  // blue
  [131, 118, 156, 255], // lavender
  [255, 119, 168, 255], // pink
  [255, 204, 170, 255], // peach
];

function nearestPalette(c: RGBA, palette: RGBA[]): RGBA {
  let best = palette[0];
  let bestDist = Infinity;
  for (const p of palette) {
    const dr = c[0] - p[0], dg = c[1] - p[1], db = c[2] - p[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; best = p; }
  }
  return best;
}

function applyStylePost(img: ImageData, style: StylePreset, rng: SeededRNG): ImageData {
  if (style === 'none' || style === '16bit' || style === 'isometric') return img;

  const d = new Uint8ClampedArray(img.data);
  const w = img.width, h = img.height;

  if (style === 'blasphemous') {
    // Darken + add purple tint + desaturate slightly
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // Darken
      d[i]     = clamp(Math.round(r * 0.78));
      d[i + 1] = clamp(Math.round(g * 0.72));
      d[i + 2] = clamp(Math.round(b * 0.85 + 18)); // purple push
      // Occasional desaturation to grey-purple
      if (rng.bool(0.12)) {
        const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
        d[i]     = clamp(Math.round(avg * 0.6 + 50));
        d[i + 1] = clamp(Math.round(avg * 0.5 + 30));
        d[i + 2] = clamp(Math.round(avg * 0.7 + 60));
      }
    }
  } else if (style === 'gothic') {
    // High contrast: darken shadows, lighten highlights, desaturate midtones
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 60) {
        // Crush shadows to near-black
        d[i]     = clamp(Math.round(r * 0.4));
        d[i + 1] = clamp(Math.round(g * 0.4));
        d[i + 2] = clamp(Math.round(b * 0.45));
      } else if (lum > 180) {
        // Blow out highlights to white-grey
        d[i]     = clamp(Math.round(r * 1.2));
        d[i + 1] = clamp(Math.round(g * 1.2));
        d[i + 2] = clamp(Math.round(b * 1.3));
      } else {
        // Midtones: desaturate + slight blue tint
        const avg = lum;
        d[i]     = clamp(Math.round(avg * 0.7 + r * 0.3));
        d[i + 1] = clamp(Math.round(avg * 0.75 + g * 0.25));
        d[i + 2] = clamp(Math.round(avg * 0.6 + b * 0.4 + 10));
      }
    }
  } else if (style === 'retro8bit') {
    // Quantize to PICO-8 16-color palette
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const original: RGBA = [d[i], d[i + 1], d[i + 2], d[i + 3]];
      const mapped = nearestPalette(original, PICO8_PALETTE);
      d[i] = mapped[0]; d[i + 1] = mapped[1]; d[i + 2] = mapped[2];
    }
    // Scale up pixels to chunky 2x2 look (by averaging 2x2 blocks)
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const val: RGBA = [d[i], d[i + 1], d[i + 2], d[i + 3]];
        const coords = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
        for (const [cx, cy] of coords) {
          if (cx < w && cy < h) {
            const ci = (cy * w + cx) * 4;
            d[ci] = val[0]; d[ci + 1] = val[1]; d[ci + 2] = val[2];
          }
        }
      }
    }
  } else if (style === 'cyberpunk') {
    // Neon: shift midtones toward cyan/magenta, blow out with neon
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // Reduce saturation of dark areas, then add neon
      if (lum < 80) {
        d[i]     = clamp(Math.round(r * 0.3 + 10));
        d[i + 1] = clamp(Math.round(g * 0.3 + 5));
        d[i + 2] = clamp(Math.round(b * 0.5 + 20));
      } else {
        // Push towards cyan/magenta
        const isWarm = r > b;
        if (isWarm) {
          // Magenta push
          d[i]     = clamp(Math.round(r * 1.2 + 30));
          d[i + 1] = clamp(Math.round(g * 0.6));
          d[i + 2] = clamp(Math.round(b * 1.3 + 40));
        } else {
          // Cyan push
          d[i]     = clamp(Math.round(r * 0.4));
          d[i + 1] = clamp(Math.round(g * 1.1 + 30));
          d[i + 2] = clamp(Math.round(b * 1.3 + 50));
        }
      }
    }
  }

  return new ImageData(d, w, h);
}

// ─── Humanizer ───────────────────────────────────────────────────────────────

function humanize(img: ImageData, amount = 0.6, rng: SeededRNG): ImageData {
  const d = new Uint8ClampedArray(img.data);
  const w = img.width, h = img.height;

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) continue;
    if (rng.next() < 0.35 * amount) {
      const jitter = (rng.next() - 0.5) * 10 * amount;
      d[i] = clamp(d[i] + jitter);
      d[i + 1] = clamp(d[i + 1] + jitter);
      d[i + 2] = clamp(d[i + 2] + jitter);
    }
  }

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    if (rng.next() < 0.01 * amount) {
      const n = (rng.next() - 0.5) * 25;
      d[i] = clamp(d[i] + n); d[i + 1] = clamp(d[i + 1] + n); d[i + 2] = clamp(d[i + 2] + n);
    }
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const isEdge =
        d[((y - 1) * w + x) * 4 + 3] === 0 || d[((y + 1) * w + x) * 4 + 3] === 0 ||
        d[(y * w + x - 1) * 4 + 3] === 0    || d[(y * w + x + 1) * 4 + 3] === 0;
      if (isEdge && rng.next() < 0.02 * amount) d[i + 3] = 0;
    }
  }

  return new ImageData(d, w, h);
}

// ─── Prompt Parser ───────────────────────────────────────────────────────────

const KEYWORD_COLOURS: Array<{ words: string[]; main: RGBA; accent: RGBA }> = [
  { words: ['jester', 'fool', 'harlequin'], main: hex('#9b3dab'), accent: hex('#f5c842') },
  { words: ['red jester', 'red harlequin'], main: hex('#c0392b'), accent: hex('#f5e642') },
  { words: ['blue jester'], main: hex('#2980b9'), accent: hex('#f5c842') },
  { words: ['green jester'], main: hex('#27ae60'), accent: hex('#f5e642') },
  { words: ['wizard', 'mage', 'sorcerer'], main: hex('#1a237e'), accent: hex('#7c4dff') },
  { words: ['blue wizard'], main: hex('#1565c0'), accent: hex('#82b1ff') },
  { words: ['red wizard', 'fire wizard'], main: hex('#b71c1c'), accent: hex('#ff6d00') },
  { words: ['green mage', 'nature mage'], main: hex('#1b5e20'), accent: hex('#76ff03') },
  { words: ['knight', 'paladin', 'crusader'], main: hex('#4a6fa5'), accent: hex('#c0a030') },
  { words: ['dark knight', 'black knight'], main: hex('#212121'), accent: hex('#b71c1c') },
  { words: ['warrior', 'barbarian', 'fighter'], main: hex('#795548'), accent: hex('#e64a19') },
  { words: ['archer', 'ranger'], main: hex('#388e3c'), accent: hex('#8d6e63') },
  { words: ['rogue', 'assassin', 'thief'], main: hex('#424242'), accent: hex('#8e24aa') },
  { words: ['elf', 'dark elf'], main: hex('#1b5e20'), accent: hex('#c8e6c9') },
  { words: ['dragon', 'serpent'], main: hex('#2e7d32'), accent: hex('#ff6f00') },
  { words: ['red dragon', 'fire dragon'], main: hex('#c62828'), accent: hex('#ff6f00') },
  { words: ['blue dragon', 'ice dragon'], main: hex('#1565c0'), accent: hex('#80deea') },
  { words: ['purple dragon'], main: hex('#6a1b9a'), accent: hex('#e040fb') },
  { words: ['slime', 'blob'], main: hex('#4caf50'), accent: hex('#a5d6a7') },
  { words: ['blue slime'], main: hex('#1976d2'), accent: hex('#90caf9') },
  { words: ['red slime'], main: hex('#d32f2f'), accent: hex('#ef9a9a') },
  { words: ['skeleton', 'bones', 'undead'], main: hex('#e8e0cc'), accent: hex('#78909c') },
  { words: ['mushroom'], main: hex('#f44336'), accent: hex('#ffccbc') },
  { words: ['blue mushroom'], main: hex('#1976d2'), accent: hex('#bbdefb') },
  { words: ['tree', 'forest', 'oak', 'pine'], main: hex('#388e3c'), accent: hex('#7a5230') },
  { words: ['chest', 'treasure'], main: hex('#8b5e3c'), accent: hex('#c0a030') },
  { words: ['ghost'], main: hex('#b0bec5'), accent: hex('#e8f5e9') },
  { words: ['orc'], main: hex('#558b2f'), accent: hex('#795548') },
  { words: ['goblin'], main: hex('#388e3c'), accent: hex('#795548') },
  { words: ['vampire'], main: hex('#212121'), accent: hex('#8b0000') },
  { words: ['witch'], main: hex('#4a148c'), accent: hex('#76ff03') },
  { words: ['demon'], main: hex('#c62828'), accent: hex('#ff6d00') },
  { words: ['angel'], main: hex('#fff9c4'), accent: hex('#ffd700') },
  { words: ['reaper', 'grim reaper'], main: hex('#212121'), accent: hex('#00ff88') },
  { words: ['zombie'], main: hex('#558b2f'), accent: hex('#795548') },
  { words: ['wolf', 'werewolf'], main: hex('#546e7a'), accent: hex('#90a4ae') },
  { words: ['spider'], main: hex('#212121'), accent: hex('#f44336') },
  { words: ['bat'], main: hex('#37474f'), accent: hex('#880e4f') },
  { words: ['gargoyle'], main: hex('#607d8b'), accent: hex('#ff6600') },
  { words: ['coin', 'gold coin'], main: hex('#f5c842'), accent: hex('#c8a000') },
  { words: ['key'], main: hex('#c0a030'), accent: hex('#e040fb') },
  { words: ['torch'], main: hex('#7a5230'), accent: hex('#ff8800') },
  { words: ['bomb'], main: hex('#2a2a2a'), accent: hex('#ffee00') },
  { words: ['skull'], main: hex('#e8e0cc'), accent: hex('#78909c') },
  { words: ['crown'], main: hex('#f5c842'), accent: hex('#c62828') },
  { words: ['gem', 'crystal', 'ruby', 'sapphire', 'emerald'], main: hex('#c62828'), accent: hex('#ff8a80') },
  { words: ['tome', 'spellbook', 'grimoire'], main: hex('#1a237e'), accent: hex('#7c4dff') },
  { words: ['tombstone', 'gravestone'], main: hex('#78909c'), accent: hex('#2e7d32') },
  { words: ['door', 'gate'], main: hex('#5d4037'), accent: hex('#9badb7') },
  { words: ['rock', 'boulder', 'stone'], main: hex('#78909c'), accent: hex('#a5d6a7') },
  { words: ['flame', 'fire'], main: hex('#ff4400'), accent: hex('#ffee00') },
  { words: ['axe', 'battle axe'], main: hex('#9badb7'), accent: hex('#c62828') },
  { words: ['staff', 'wand'], main: hex('#6a4a20'), accent: hex('#7c4dff') },
  { words: ['potion', 'vial', 'flask'], main: hex('#9c27b0'), accent: hex('#e1bee7') },
  { words: ['sword', 'blade'], main: hex('#9badb7'), accent: hex('#c0a030') },
  { words: ['shield', 'buckler'], main: hex('#1565c0'), accent: hex('#c0a030') },
  { words: ['flower', 'rose', 'daisy'], main: hex('#f06292'), accent: hex('#fff176') },
];

const COLOUR_NAMES: Record<string, RGBA> = {
  red: hex('#c62828'), crimson: hex('#b71c1c'), scarlet: hex('#d32f2f'),
  blue: hex('#1565c0'), navy: hex('#0d47a1'), cobalt: hex('#1976d2'),
  green: hex('#2e7d32'), emerald: hex('#1b5e20'), lime: hex('#558b2f'),
  yellow: hex('#f9a825'), gold: hex('#f5c842'), amber: hex('#e65100'),
  orange: hex('#e64a19'), purple: hex('#6a1b9a'), violet: hex('#7b1fa2'),
  magenta: hex('#880e4f'), pink: hex('#c2185b'), brown: hex('#5d4037'),
  grey: hex('#455a64'), gray: hex('#455a64'), black: hex('#212121'),
  white: hex('#e8e8e8'), silver: hex('#78909c'), cyan: hex('#00838f'),
  teal: hex('#00695c'), indigo: hex('#283593'), maroon: hex('#880e4f'),
};

const SUBJECT_MAP: Record<string, Subject> = {
  jester: 'jester', fool: 'jester', harlequin: 'jester',
  wizard: 'wizard', mage: 'mage', sorcerer: 'wizard', magician: 'wizard', warlock: 'wizard',
  knight: 'knight', paladin: 'knight', crusader: 'knight',
  warrior: 'warrior', fighter: 'warrior', barbarian: 'warrior',
  archer: 'archer', ranger: 'archer', hunter: 'archer',
  rogue: 'rogue', thief: 'rogue', assassin: 'rogue',
  elf: 'elf',
  dragon: 'dragon', drake: 'dragon', wyvern: 'dragon',
  slime: 'slime', blob: 'slime',
  skeleton: 'skeleton', bones: 'skeleton', undead: 'skeleton',
  mushroom: 'mushroom', shroom: 'mushroom',
  tree: 'tree', oak: 'tree', pine: 'tree', forest: 'tree',
  chest: 'chest', treasure: 'chest',
  ghost: 'humanoid', orc: 'warrior',
  // New subjects
  goblin: 'goblin', imp: 'goblin',
  vampire: 'vampire', dracula: 'vampire', nosferatu: 'vampire',
  witch: 'witch', hag: 'witch',
  demon: 'demon', devil: 'demon', fiend: 'demon',
  angel: 'angel', seraph: 'angel', cherub: 'angel',
  reaper: 'reaper', 'grim reaper': 'reaper',
  zombie: 'zombie',
  wolf: 'wolf', werewolf: 'wolf', hound: 'wolf',
  spider: 'spider', arachnid: 'spider',
  bat: 'bat',
  gargoyle: 'gargoyle',
  coin: 'coin', 'gold coin': 'coin',
  key: 'key',
  torch: 'torch', lantern: 'torch',
  bomb: 'bomb', explosive: 'bomb',
  skull: 'skull', 'skull and crossbones': 'skull',
  crown: 'crown', coronet: 'crown',
  gem: 'gem', crystal: 'gem', ruby: 'gem', sapphire: 'gem', diamond: 'gem',
  tome: 'tome', spellbook: 'tome', grimoire: 'tome', book: 'tome',
  tombstone: 'tombstone', gravestone: 'tombstone', grave: 'tombstone',
  door: 'door', gate: 'door', portal: 'door',
  rock: 'rock', boulder: 'rock', stone: 'rock',
  flame: 'flame', fire: 'flame', blaze: 'flame',
  axe: 'axe', hatchet: 'axe',
  staff: 'staff', wand: 'staff', scepter: 'staff',
  potion: 'potion', vial: 'potion', flask: 'potion', elixir: 'potion',
  sword: 'sword', blade: 'sword', longsword: 'sword', katana: 'sword',
  shield: 'shield', buckler: 'shield',
  flower: 'flower', rose: 'flower', daisy: 'flower',
};

export function parsePrompt(prompt: string, stylePreset: StylePreset = 'none'): ParsedPrompt {
  const p = prompt.toLowerCase();
  const seed = hashString(prompt);

  let subject: Subject = 'humanoid';

  // ── Priority tiers: ITEMS first (lowest priority), CHARACTERS last (highest) ──
  // Later checks override earlier ones, so characters always beat items.

  // Tier 1 – items / props (lowest priority)
  if (p.includes('coin') || p.includes('gold coin')) subject = 'coin';
  if (p.includes(' key') || p.startsWith('key')) subject = 'key';
  if (p.includes('torch') || p.includes('lantern')) subject = 'torch';
  if (p.includes('bomb') || p.includes('explosive')) subject = 'bomb';
  if (p.includes('skull')) subject = 'skull';
  if (p.includes('crown') || p.includes('coronet')) subject = 'crown';
  if (p.includes(' gem') || p.includes('ruby') || p.includes('sapphire') || p.includes('crystal')) subject = 'gem';
  if (p.includes('tome') || p.includes('spellbook') || p.includes('grimoire')) subject = 'tome';
  if (p.includes('tombstone') || p.includes('gravestone') || p.includes('grave')) subject = 'tombstone';
  if (p.includes('door') || p.includes('portal') || p.includes('gate')) subject = 'door';
  if (p.includes('rock') || p.includes('boulder')) subject = 'rock';
  if (p.includes('flame') || p.includes(' fire') || p.startsWith('fire')) subject = 'flame';
  if (p.includes(' axe') || p.startsWith('axe') || p.includes('hatchet')) subject = 'axe';
  if (p.includes(' staff') || p.startsWith('staff') || p.includes(' wand') || p.includes('scepter')) subject = 'staff';
  if (p.includes('potion') || p.includes(' vial') || p.includes(' flask') || p.includes('elixir')) subject = 'potion';
  if (p.includes('sword') || p.includes('longsword') || p.includes('katana') || p.includes(' blade')) subject = 'sword';
  if (p.includes('shield') || p.includes('buckler')) subject = 'shield';
  if (p.includes('flower') || p.includes(' rose') || p.includes('daisy')) subject = 'flower';

  // Tier 2 – environment / scenery
  if (p.includes('isometric') || p.includes('iso tile') || p.includes('isotile')) subject = 'isobox';
  if (p.includes('isometric grass') || p.includes('iso grass') || p.includes('isometric ground')) subject = 'isotile';
  if (p.includes('chest') || p.includes('treasure')) subject = 'chest';
  if (p.includes('mushroom') || p.includes('shroom')) subject = 'mushroom';
  if (p.includes('tree') || p.includes('forest')) subject = 'tree';
  if (p.includes('rock') || p.includes('boulder')) subject = 'rock';

  // Tier 3 – creatures / monsters
  if (p.includes('slime') || p.includes('blob')) subject = 'slime';
  if (p.includes('skeleton') || p.includes('bones')) subject = 'skeleton';
  if (p.includes('dragon') || p.includes('drake') || p.includes('wyvern')) subject = 'dragon';
  if (p.includes('spider') || p.includes('arachnid')) subject = 'spider';
  if (p.includes(' bat') || p.startsWith('bat')) subject = 'bat';
  if (p.includes('gargoyle')) subject = 'gargoyle';
  if (p.includes('wolf') || p.includes('werewolf') || p.includes('hound')) subject = 'wolf';

  // Tier 4 – named characters (highest priority — always beat items)
  if (p.includes('zombie') || p.includes('undead')) subject = 'zombie';
  if (p.includes('goblin') || p.includes('imp')) subject = 'goblin';
  if (p.includes('vampire') || p.includes('dracula') || p.includes('nosferatu')) subject = 'vampire';
  if (p.includes('witch') || p.includes(' hag')) subject = 'witch';
  if (p.includes('demon') || p.includes('devil') || p.includes('fiend')) subject = 'demon';
  if (p.includes('angel') || p.includes('seraph') || p.includes('cherub')) subject = 'angel';
  if (p.includes('reaper')) subject = 'reaper';
  if (p.includes('elf')) subject = 'elf';
  if (p.includes('orc')) subject = 'warrior';
  if (p.includes('ghost')) subject = 'humanoid';
  if (p.includes('archer') || p.includes('ranger') || p.includes('hunter')) subject = 'archer';
  if (p.includes('rogue') || p.includes('thief') || p.includes('assassin')) subject = 'rogue';
  if (p.includes('warrior') || p.includes('fighter') || p.includes('barbarian')) subject = 'warrior';
  if (p.includes('knight') || p.includes('paladin') || p.includes('crusader')) subject = 'knight';
  if (p.includes('mage') || p.includes('sorcerer') || p.includes('warlock') || p.includes('magician')) subject = 'mage';
  if (p.includes('wizard')) subject = 'wizard';
  if (p.includes('jester') || p.includes('fool') || p.includes('harlequin')) subject = 'jester';

  let expression: Expression = 'neutral';
  if (subject === 'jester') expression = 'grin';
  if (p.includes('happy') || p.includes('smile')) expression = 'happy';
  if (p.includes('stern') || p.includes('serious')) expression = 'stern';
  if (p.includes('angry') || p.includes('rage')) expression = 'angry';
  if (p.includes('grin') || p.includes('mischievous')) expression = 'grin';

  const view: 'front' | 'side' = p.includes('side') ? 'side' : 'front';

  let style: 'simple' | 'normal' | 'detailed' = 'normal';
  if (p.includes('simple') || p.includes('basic')) style = 'simple';
  if (p.includes('detailed') || p.includes('complex')) style = 'detailed';

  let main: RGBA | null = null;
  let accent: RGBA | null = null;
  for (const entry of KEYWORD_COLOURS) {
    if (entry.words.some(w => p.includes(w))) {
      main = entry.main; accent = entry.accent; break;
    }
  }

  let colorOverride: RGBA | null = null;
  let accentOverride: RGBA | null = null;
  const colourWords = Object.keys(COLOUR_NAMES);
  const firstColour = colourWords.find(c => p.includes(c));
  if (firstColour) colorOverride = COLOUR_NAMES[firstColour];
  const secondColour = colourWords.filter(c => c !== firstColour).find(c => p.includes(c));
  if (secondColour) accentOverride = COLOUR_NAMES[secondColour];

  const animated =
    p.includes('walk') || p.includes('running') || p.includes('animation') ||
    p.includes('animated') || p.includes('frames');
  const frames = animated ? 4 : 1;

  return { subject, view, style, stylePreset, colorOverride, accentOverride, animated, frames, expression, seed };
}

// ─── Colour Resolution ───────────────────────────────────────────────────────

function resolveColours(parsed: ParsedPrompt): [RGBA, RGBA] {
  const defaults: Record<Subject, [RGBA, RGBA]> = {
    jester:    [hex('#9b3dab'), hex('#f5c842')],
    wizard:    [hex('#1a237e'), hex('#7c4dff')],
    mage:      [hex('#4a148c'), hex('#7c4dff')],
    knight:    [hex('#4a6fa5'), hex('#c0a030')],
    warrior:   [hex('#795548'), hex('#e64a19')],
    archer:    [hex('#388e3c'), hex('#8d6e63')],
    rogue:     [hex('#424242'), hex('#8e24aa')],
    elf:       [hex('#1b5e20'), hex('#c8e6c9')],
    dragon:    [hex('#2e7d32'), hex('#ff6f00')],
    slime:     [hex('#4caf50'), hex('#a5d6a7')],
    skeleton:  [hex('#e8e0cc'), hex('#78909c')],
    ghost:     [hex('#b0bec5'), hex('#e0f7fa')],
    orc:       [hex('#558b2f'), hex('#795548')],
    mushroom:  [hex('#f44336'), hex('#ffccbc')],
    tree:      [hex('#388e3c'), hex('#7a5230')],
    isobox:    [hex('#7986cb'), hex('#9fa8da')],
    isotile:   [hex('#66bb6a'), hex('#a5d6a7')],
    flower:    [hex('#f06292'), hex('#fff176')],
    chest:     [hex('#8b5e3c'), hex('#c0a030')],
    potion:    [hex('#9c27b0'), hex('#e1bee7')],
    sword:     [hex('#9badb7'), hex('#c0a030')],
    shield:    [hex('#1565c0'), hex('#c0a030')],
    humanoid:  [hex('#795548'), hex('#e64a19')],
    goblin:    [hex('#388e3c'), hex('#795548')],
    vampire:   [hex('#212121'), hex('#8b0000')],
    witch:     [hex('#4a148c'), hex('#76ff03')],
    demon:     [hex('#c62828'), hex('#ff6d00')],
    angel:     [hex('#fff9c4'), hex('#ffd700')],
    reaper:    [hex('#212121'), hex('#00ff88')],
    zombie:    [hex('#558b2f'), hex('#795548')],
    wolf:      [hex('#546e7a'), hex('#90a4ae')],
    spider:    [hex('#212121'), hex('#f44336')],
    bat:       [hex('#37474f'), hex('#880e4f')],
    gargoyle:  [hex('#607d8b'), hex('#ff6600')],
    coin:      [hex('#f5c842'), hex('#c8a000')],
    key:       [hex('#c0a030'), hex('#e040fb')],
    torch:     [hex('#7a5230'), hex('#ff8800')],
    bomb:      [hex('#2a2a2a'), hex('#ffee00')],
    skull:     [hex('#e8e0cc'), hex('#78909c')],
    crown:     [hex('#f5c842'), hex('#c62828')],
    gem:       [hex('#c62828'), hex('#ff8a80')],
    tome:      [hex('#1a237e'), hex('#7c4dff')],
    tombstone: [hex('#78909c'), hex('#2e7d32')],
    door:      [hex('#5d4037'), hex('#9badb7')],
    rock:      [hex('#78909c'), hex('#a5d6a7')],
    flame:     [hex('#ff4400'), hex('#ffee00')],
    axe:       [hex('#9badb7'), hex('#c62828')],
    staff:     [hex('#6a4a20'), hex('#7c4dff')],
  };

  let [main, accent] = defaults[parsed.subject] ?? defaults.humanoid;

  for (const entry of KEYWORD_COLOURS) {
    if (entry.words.some(w => w === parsed.subject as string)) {
      main = entry.main; accent = entry.accent; break;
    }
  }

  if (parsed.colorOverride) main = parsed.colorOverride;
  if (parsed.accentOverride) accent = parsed.accentOverride;

  return [main, accent];
}

// ─── Main Draw Dispatcher ────────────────────────────────────────────────────

function drawSubject(p: PixelPainter, parsed: ParsedPrompt, main: RGBA, accent: RGBA) {
  switch (parsed.subject) {
    case 'jester':                   return drawJester(p, main, accent);
    case 'wizard': case 'mage':      return drawWizard(p, main, accent);
    case 'knight':                   return drawKnight(p, main, accent);
    case 'dragon':                   return drawDragon(p, main, accent);
    case 'slime':                    return drawSlime(p, main, accent);
    case 'skeleton':                 return drawSkeleton(p, main, accent);
    case 'mushroom':                 return drawMushroom(p, main, accent);
    case 'tree':                     return drawTree(p, main, accent);
    case 'chest':                    return drawChest(p, main, accent);
    case 'isobox':                   return drawIsometricBox(p, main, accent);
    case 'isotile':                  return drawIsometricTile(p, main, accent);
    case 'goblin':                   return drawGoblin(p, main, accent);
    case 'vampire':                  return drawVampire(p, main, accent);
    case 'witch':                    return drawWitch(p, main, accent);
    case 'demon':                    return drawDemon(p, main, accent);
    case 'angel':                    return drawAngel(p, main, accent);
    case 'reaper':                   return drawReaper(p, main, accent);
    case 'zombie':                   return drawZombie(p, main, accent);
    case 'wolf':                     return drawWolf(p, main, accent);
    case 'spider':                   return drawSpider(p, main, accent);
    case 'bat':                      return drawBat(p, main, accent);
    case 'gargoyle':                 return drawGargoyle(p, main, accent);
    case 'coin':                     return drawCoin(p, main, accent);
    case 'key':                      return drawKey(p, main, accent);
    case 'torch':                    return drawTorch(p, main, accent);
    case 'bomb':                     return drawBomb(p, main, accent);
    case 'skull':                    return drawSkull(p, main, accent);
    case 'crown':                    return drawCrown(p, main, accent);
    case 'gem':                      return drawGem(p, main, accent);
    case 'tome':                     return drawTome(p, main, accent);
    case 'tombstone':                return drawTombstone(p, main, accent);
    case 'door':                     return drawDoor(p, main, accent);
    case 'rock':                     return drawRock(p, main, accent);
    case 'flame':                    return drawFlame(p, main, accent);
    case 'axe':                      return drawAxe(p, main, accent);
    case 'staff':                    return drawStaff(p, main, accent);
    case 'potion':                   return drawPotion(p, main, accent);
    case 'sword':                    return drawSword(p, main, accent);
    case 'shield':                   return drawShield(p, main, accent);
    case 'flower':                   return drawFlower(p, main, accent);
    default:                         return drawGenericHumanoid(p, main, accent, parsed.expression);
  }
}

// ── Isometric helpers ────────────────────────────────────────────────────────

function isoShade(c: RGBA, factor: number): RGBA {
  return [
    Math.min(255, Math.round(c[0] * factor)),
    Math.min(255, Math.round(c[1] * factor)),
    Math.min(255, Math.round(c[2] * factor)),
    c[3],
  ];
}

function drawIsometricBox(p: PixelPainter, main: RGBA, _accent: RGBA): void {
  const top   = isoShade(main, 1.4);
  const left  = main;
  const right = isoShade(main, 0.58);

  for (let row = 0; row < 5; row++) {
    const hw = (row + 1) * 2;
    p.rect(16 - hw, 4 + row, hw * 2, 1, top);
  }
  for (let row = 0; row < 5; row++) {
    const hw = (4 - row) * 2;
    if (hw <= 0) continue;
    p.rect(16 - hw, 9 + row, hw * 2, 1, top);
  }
  for (let row = 0; row < 12; row++) {
    const x0 = 6 + Math.ceil(row * 0.5);
    p.rect(x0, 12 + row, 16 - x0, 1, left);
  }
  for (let row = 0; row < 12; row++) {
    const x1 = 26 - Math.ceil(row * 0.5);
    p.rect(16, 12 + row, x1 - 16, 1, right);
  }
  for (let row = 2; row < 11; row += 4) {
    const x0 = 7 + Math.ceil(row * 0.5);
    p.rect(x0, 12 + row, Math.max(1, 14 - x0), 1, isoShade(left, 0.75));
  }
}

function drawIsometricTile(p: PixelPainter, main: RGBA, _accent: RGBA): void {
  const top = isoShade(main, 1.15);
  const edL = isoShade(main, 0.7);
  const edR = isoShade(main, 0.5);

  for (let row = 0; row < 5; row++) {
    const hw = (row + 1) * 2;
    p.rect(16 - hw, 10 + row, hw * 2, 1, top);
  }
  for (let row = 0; row < 5; row++) {
    const hw = (4 - row) * 2;
    if (hw <= 0) continue;
    p.rect(16 - hw, 15 + row, hw * 2, 1, top);
  }
  for (let row = 0; row < 4; row++) {
    const x0 = 6 + Math.ceil((row + 4) * 0.5);
    p.rect(x0, 19 + row, 16 - x0, 1, edL);
  }
  for (let row = 0; row < 4; row++) {
    const x1 = 26 - Math.ceil((row + 4) * 0.5);
    p.rect(16, 19 + row, x1 - 16, 1, edR);
  }
  [[14, 11], [18, 13], [12, 14], [20, 12], [16, 16]].forEach(([x, y]) =>
    p.rect(x, y, 1, 1, isoShade(main, 0.82))
  );
}

// ─── Palette Quantization ─────────────────────────────────────────────────────

/**
 * Reduce an ImageData to at most `maxColors` distinct colors using frequency-
 * based selection followed by nearest-palette remapping. Transparent pixels are
 * left untouched. This keeps hard color edges — essential for pixel art.
 */
function quantizeToNColors(img: ImageData, maxColors: number): ImageData {
  const d = new Uint8ClampedArray(img.data);
  const w = img.width, h = img.height;

  // Count color frequencies (ignore alpha < 128)
  const freq = new Map<string, { count: number; rgba: RGBA }>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    // Quantize to 4-bit depth per channel first to bucket nearby shades
    const r = d[i] & 0xf0, g = d[i + 1] & 0xf0, b = d[i + 2] & 0xf0;
    const key = `${r},${g},${b}`;
    const existing = freq.get(key);
    if (existing) { existing.count++; }
    else { freq.set(key, { count: 1, rgba: [d[i], d[i + 1], d[i + 2], d[i + 3]] }); }
  }

  if (freq.size <= maxColors) return img; // already within budget

  // Pick top-N most-used colors as the palette
  const palette: RGBA[] = [...freq.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map(e => e.rgba);

  // Remap every opaque pixel to its nearest palette entry
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const c: RGBA = [d[i], d[i + 1], d[i + 2], d[i + 3]];
    const mapped = nearestPalette(c, palette);
    d[i] = mapped[0]; d[i + 1] = mapped[1]; d[i + 2] = mapped[2];
  }

  return new ImageData(d, w, h);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate one or more pixel-art frames from a text prompt.
 * Returns an array of ImageData (length = parsed.frames or frameCountOverride).
 * @param maxColors - palette cap applied after generation (default 16)
 */
export function generateSprite(
  prompt: string,
  width: number,
  height: number,
  style: StylePreset = 'none',
  frameCountOverride?: number,
  maxColors = 16,
): ImageData[] {
  const parsed = parsePrompt(prompt, style);
  const [main, accent] = resolveColours(parsed);
  const frameCount = frameCountOverride ?? parsed.frames;
  const results: ImageData[] = [];
  const rng = new SeededRNG(parsed.seed);

  for (let f = 0; f < frameCount; f++) {
    const p = new PixelPainter(width, height);
    drawSubject(p, parsed, main, accent);
    if (parsed.animated && frameCount > 1) applyWalkOffset(p, f);
    p.outline();
    const humanized = humanize(p.toImageData(), 0.5, new SeededRNG(parsed.seed ^ (f * 0x9e3779b9)));
    const styled = applyStylePost(humanized, style, new SeededRNG(parsed.seed ^ 0xdeadbeef));
    results.push(quantizeToNColors(styled, maxColors));
  }

  return results;
}

/**
 * Refine an existing sprite by re-generating with the combined prompt.
 */
export function refineSprite(
  originalPrompt: string,
  refinement: string,
  width: number,
  height: number,
  style: StylePreset = 'none',
): ImageData[] {
  const combined = `${originalPrompt} ${refinement}`.trim();
  return generateSprite(combined, width, height, style);
}

/**
 * Improve an existing ImageData sprite with additional processing passes.
 * Enhances contrast, adds subtle details, and improves outlines.
 */
export function improveSprite(imageData: ImageData, amount = 0.5): ImageData {
  const d = new Uint8ClampedArray(imageData.data);
  const w = imageData.width, h = imageData.height;
  const rng = new SeededRNG(Date.now() & 0xffffffff);

  // Pass 1: Improve outline (make darker outline pixels more consistent)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Detect isolated light pixels surrounded by dark (noise) → darken
      if (lum > 200) {
        const neighbors = [
          [(y - 1) * w + x, (y + 1) * w + x, y * w + x - 1, y * w + x + 1].reduce((sum, idx) => {
            const ni = idx * 4;
            return sum + (d[ni + 3] > 0 ? 0.299 * d[ni] + 0.587 * d[ni + 1] + 0.114 * d[ni + 2] : lum);
          }, 0) / 4,
        ];
        if (neighbors[0] < 80 && rng.bool(0.3 * amount)) {
          d[i] = clamp(Math.round(r * 0.7));
          d[i + 1] = clamp(Math.round(g * 0.7));
          d[i + 2] = clamp(Math.round(b * 0.7));
        }
      }
    }
  }

  // Pass 2: Slight contrast boost
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const contrast = 1 + 0.15 * amount;
    d[i]     = clamp(Math.round((d[i] - 128) * contrast + 128));
    d[i + 1] = clamp(Math.round((d[i + 1] - 128) * contrast + 128));
    d[i + 2] = clamp(Math.round((d[i + 2] - 128) * contrast + 128));
  }

  // Pass 3: Add edge sharpening (dark-side neighbor push)
  const snap = new Uint8ClampedArray(d);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (snap[i + 3] === 0) continue;
      const topI = ((y - 1) * w + x) * 4;
      const leftI = (y * w + x - 1) * 4;
      if (snap[topI + 3] === 0 || snap[leftI + 3] === 0) {
        // Edge pixel — slightly brighten
        d[i]     = clamp(d[i] + Math.round(12 * amount));
        d[i + 1] = clamp(d[i + 1] + Math.round(12 * amount));
        d[i + 2] = clamp(d[i + 2] + Math.round(12 * amount));
      }
    }
  }

  // Pass 4: Sub-pixel dithering noise (subtle)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    if (rng.bool(0.08 * amount)) {
      const n = Math.round((rng.next() - 0.5) * 16 * amount);
      d[i]     = clamp(d[i] + n);
      d[i + 1] = clamp(d[i + 1] + n);
      d[i + 2] = clamp(d[i + 2] + n);
    }
  }

  return new ImageData(d, w, h);
}

/**
 * Convert an image source (URL or data URL) to pixel art.
 * Resizes to targetW × targetH with nearest-neighbor and optional palette quantization.
 */
export function imageToPixelArt(
  src: string,
  targetW: number,
  targetH: number,
  palette?: RGBA[],
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Draw at tiny size (pixel art resolution)
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, targetW, targetH);
      let imgData = ctx.getImageData(0, 0, targetW, targetH);

      if (palette && palette.length > 0) {
        // Quantize to provided palette
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
          const orig: RGBA = [d[i], d[i + 1], d[i + 2], d[i + 3]];
          const mapped = nearestPalette(orig, palette);
          d[i] = mapped[0]; d[i + 1] = mapped[1]; d[i + 2] = mapped[2]; d[i + 3] = mapped[3];
        }
        imgData = new ImageData(d, targetW, targetH);
      } else {
        // Posterize (reduce color depth for pixelated feel)
        const d = imgData.data;
        const levels = 8;
        const step = 256 / levels;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
          d[i]     = clamp(Math.round(Math.round(d[i] / step) * step));
          d[i + 1] = clamp(Math.round(Math.round(d[i + 1] / step) * step));
          d[i + 2] = clamp(Math.round(Math.round(d[i + 2] / step) * step));
          d[i + 3] = 255;
        }
        imgData = new ImageData(d, targetW, targetH);
      }

      resolve(imgData);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/** A curated list of fun surprise prompts. */
export const SURPRISE_PROMPTS = [
  'purple jester with golden bells and colorful diamond outfit',
  'blue wizard with star robe and glowing staff',
  'dark knight in black armor with red plume',
  'fire dragon breathing flames',
  'green slime with big eyes',
  'red and yellow jester grinning mischievously',
  'ancient skeleton warrior rising from grave',
  'blue mushroom with white spots and happy face',
  'giant oak tree with deep roots',
  'golden treasure chest overflowing with gems',
  'crimson warrior with battle scars',
  'forest archer in emerald cloak',
  'ice dragon with blue scales',
  'purple mage casting lightning',
  'violet jester doing a somersault',
  'green goblin with sharp teeth and loincloth',
  'pale vampire in black cape with red eyes',
  'purple witch with cat familiar and broom',
  'red demon with wings and glowing runes',
  'white angel with golden halo and feathered wings',
  'grim reaper with scythe and glowing green eyes',
  'zombie with outstretched arms and rotting flesh',
  'grey wolf with yellow eyes and fangs',
  'black spider with red markings and eight eyes',
  'dark bat hanging with glowing red eyes',
  'stone gargoyle crouching on a perch',
  'gold coin with royal emblem and shine',
  'ornate golden key with gem and teeth',
  'burning torch with orange flame',
  'black bomb with sparking fuse',
  'ancient skull with glowing eye sockets',
  'golden crown with red and blue gems',
  'red ruby gem with sparkling facets',
  'blue spellbook with arcane rune circle',
  'mossy tombstone with RIP inscription',
  'wooden dungeon door with iron bolts',
  'grey boulder with lichen and cracks',
  'roaring bonfire with floating embers',
  'battle axe with runic engravings',
  'magic staff with crystal orb and gems',
  'purple poison potion in glass flask',
  'silver longsword with golden crossguard',
  'blue heraldic shield with golden boss',
  'red rose with green leaves and stem',
];
