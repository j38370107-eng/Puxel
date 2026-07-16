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
  colorOverride: RGBA | null;
  accentOverride: RGBA | null;
  animated: boolean;          // generate multiple frames
  frames: number;             // how many frames if animated
  expression: Expression;
}

type Subject =
  | 'jester' | 'wizard' | 'mage'
  | 'knight' | 'warrior' | 'archer'
  | 'rogue' | 'elf'
  | 'dragon' | 'slime' | 'skeleton' | 'ghost' | 'orc'
  | 'mushroom' | 'tree' | 'flower'
  | 'chest' | 'potion' | 'sword' | 'shield'
  | 'humanoid';  // fallback

type Expression = 'grin' | 'happy' | 'neutral' | 'stern' | 'angry';

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
  private sx: number; // scale x
  private sy: number; // scale y

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4); // all transparent
    this.sx = w / 32;
    this.sy = h / 32;
  }

  // Convert base-32 coordinate to real pixel
  private bx(x: number) { return Math.round(x * this.sx); }
  private by(y: number) { return Math.round(y * this.sy); }
  private bw(w: number) { return Math.max(1, Math.round(w * this.sx)); }
  private bh(h: number) { return Math.max(1, Math.round(h * this.sy)); }

  /** Set one real pixel. */
  set(x: number, y: number, c: RGBA) {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0]; this.data[i + 1] = c[1];
    this.data[i + 2] = c[2]; this.data[i + 3] = c[3];
  }

  /** Get one real pixel. */
  get(x: number, y: number): RGBA {
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return [0, 0, 0, 0];
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  /** Fill rectangle using base-32 coordinates. */
  rect(bX: number, bY: number, bW: number, bH: number, c: RGBA) {
    const x0 = this.bx(bX), y0 = this.by(bY);
    const x1 = x0 + this.bw(bW), y1 = y0 + this.bh(bH);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        this.set(x, y, c);
  }

  /** Single pixel in base-32 space. */
  pixel(bX: number, bY: number, c: RGBA) {
    this.rect(bX, bY, 1, 1, c);
  }

  /** Ellipse in base-32 space (cx, cy = centre; rx, ry = radii). */
  ellipse(bCx: number, bCy: number, bRx: number, bRy: number, c: RGBA) {
    const cx = this.bx(bCx), cy = this.by(bCy);
    const rx = this.bw(bRx), ry = this.bh(bRy);
    for (let dy = -ry; dy <= ry; dy++)
      for (let dx = -rx; dx <= rx; dx++)
        if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1)
          this.set(cx + dx, cy + dy, c);
  }

  /** Diagonal diamond checker pattern. */
  diamonds(bX: number, bY: number, bW: number, bH: number, c1: RGBA, c2: RGBA, tileBase = 3) {
    const tile = Math.max(1, Math.round(tileBase * this.sx));
    const x0 = this.bx(bX), y0 = this.by(bY);
    const pw = this.bw(bW), ph = this.bh(bH);
    for (let dy = 0; dy < ph; dy++)
      for (let dx = 0; dx < pw; dx++)
        this.set(x0 + dx, y0 + dy, Math.floor((dx + dy) / tile) % 2 === 0 ? c1 : c2);
  }

  /** Vertical-stripe checker. */
  vstripes(bX: number, bY: number, bW: number, bH: number, c1: RGBA, c2: RGBA, stripeBase = 2) {
    const stripe = Math.max(1, Math.round(stripeBase * this.sx));
    const x0 = this.bx(bX), y0 = this.by(bY);
    const pw = this.bw(bW), ph = this.bh(bH);
    for (let dy = 0; dy < ph; dy++)
      for (let dx = 0; dx < pw; dx++)
        this.set(x0 + dx, y0 + dy, Math.floor(dx / stripe) % 2 === 0 ? c1 : c2);
  }

  /** Horizontal-stripe checker. */
  hstripes(bX: number, bY: number, bW: number, bH: number, c1: RGBA, c2: RGBA, stripeBase = 2) {
    const stripe = Math.max(1, Math.round(stripeBase * this.sy));
    const x0 = this.bx(bX), y0 = this.by(bY);
    const pw = this.bw(bW), ph = this.bh(bH);
    for (let dy = 0; dy < ph; dy++)
      for (let dx = 0; dx < pw; dx++)
        this.set(x0 + dx, y0 + dy, Math.floor(dy / stripe) % 2 === 0 ? c1 : c2);
  }

  /**
   * Apply top-light shading to a rectangular region.
   * Top 25% → +35%; mid 25-50% → +15%; bottom 25% → −30%.
   */
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

  /** Left-edge highlight, right-edge shadow. */
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

  /** Draw 1-px outline around all opaque pixels. */
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
  cx: number,      // centre x (base-32)
  ey: number,      // eye-row y (base-32)
  expression: Expression,
) {
  const pupil = DARK;
  const eyeWhite = WHITE;
  const browColor = rgb(80, 50, 25);
  const cheekColor: RGBA = [220, 110, 95, 180];
  const lipColor = rgb(180, 60, 60);

  // Eyebrows
  p.rect(cx - 4, ey - 2, 2, 1, browColor);
  p.rect(cx + 2, ey - 2, 2, 1, browColor);
  if (expression === 'stern' || expression === 'angry') {
    // Angled brows
    p.pixel(cx - 3, ey - 3, browColor);
    p.pixel(cx + 4, ey - 3, browColor);
  }

  // Left eye: white 2×2, pupil on right cell
  p.rect(cx - 4, ey, 2, 2, eyeWhite);
  p.rect(cx - 3, ey, 1, 2, pupil);
  p.pixel(cx - 4, ey, rgb(255, 255, 255, 200)); // highlight

  // Right eye
  p.rect(cx + 2, ey, 2, 2, eyeWhite);
  p.rect(cx + 2, ey, 1, 2, pupil);
  p.pixel(cx + 3, ey, rgb(255, 255, 255, 200));

  // Nose
  p.rect(cx - 1, ey + 3, 2, 1, SKIN_SHADOW);

  // Mouth / expression
  const my = ey + 5;
  switch (expression) {
    case 'grin': {
      // Wide curved smile
      const smileXs = [-3, -2, -1, 0, 1, 2, 3];
      const smileOffsets = [0, 1, 2, 2, 2, 1, 0];
      smileXs.forEach((dx, i) => p.pixel(cx + dx, my + smileOffsets[i], DARK));
      // Teeth flash
      p.rect(cx - 2, my + 1, 4, 1, WHITE);
      // Cheeks
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
    default: // neutral
      p.rect(cx - 1, my, 3, 1, DARK);
  }
}

// ─── Subject Drawers ─────────────────────────────────────────────────────────
//
// Base-32 standard humanoid layout:
//   Hat/head-top : y = 0–7
//   Head (face)  : y = 7–16  (cx=16)
//   Collar/neck  : y = 16–18
//   Torso        : y = 18–26
//   Left arm     : x = 5–9,  y = 18–25
//   Right arm    : x = 22–26, y = 18–25
//   Left leg     : x = 10–15, y = 26–31
//   Right leg    : x = 17–22, y = 26–31
//

function drawJester(p: PixelPainter, main: RGBA, accent: RGBA) {
  const gold = hex('#f5c842');
  const goldDark = hex('#c89520');
  const white = rgb(245, 245, 245);
  const darkPurple = shade(main, 0.5);
  const darkAccent = shade(accent, 0.5);

  // ── Hat ──────────────────────────────────────────────────────────────────
  // Three prongs: left=main, centre=accent, right=main
  p.rect(7, 0, 5, 7, main);     // left prong
  p.rect(13, 0, 6, 6, accent);  // centre prong (slightly shorter for variety)
  p.rect(20, 0, 5, 7, main);    // right prong
  // Hat brim (wide band, two-colour stripe)
  p.hstripes(7, 5, 18, 4, main, accent, 2);

  // Bells at prong tips (gold)
  p.ellipse(9, 2, 2, 2, gold);
  p.ellipse(16, 2, 2, 2, gold);
  p.ellipse(22, 2, 2, 2, gold);
  // Bell sheen
  p.pixel(9, 1, shade(gold, 1.5));
  p.pixel(16, 1, shade(gold, 1.5));
  p.pixel(22, 1, shade(gold, 1.5));
  // Bell bottom detail
  p.pixel(9, 3, goldDark);
  p.pixel(16, 3, goldDark);
  p.pixel(22, 3, goldDark);

  // ── Head ─────────────────────────────────────────────────────────────────
  p.rect(10, 8, 12, 8, SKIN);
  // Ear nubs
  p.pixel(9, 10, SKIN_SHADOW);
  p.pixel(22, 10, SKIN_SHADOW);

  // Face (centred at x=16, eyes at y=10)
  drawFace(p, 16, 10, 'grin');

  // ── Ruffled Collar ────────────────────────────────────────────────────────
  p.rect(8, 16, 16, 3, white);
  // Ruffle peaks (alternating pixels one row up)
  for (let x = 8; x < 24; x += 2) {
    p.pixel(x, 15, white);
  }
  p.shadeRegion(8, 16, 16, 3);

  // ── Torso: diamond pattern ────────────────────────────────────────────────
  p.diamonds(9, 19, 14, 8, main, accent, 3);
  p.shadeRegion(9, 19, 14, 8);

  // ── Left Arm ─────────────────────────────────────────────────────────────
  p.rect(5, 18, 5, 7, main);
  p.rect(5, 24, 5, 2, white);   // cuff
  p.rect(6, 26, 3, 2, SKIN);    // hand

  // ── Right Arm ────────────────────────────────────────────────────────────
  p.rect(22, 18, 5, 7, accent);
  p.rect(22, 24, 5, 2, white);  // cuff
  p.rect(23, 26, 3, 2, SKIN);   // hand

  // ── Legs ─────────────────────────────────────────────────────────────────
  p.rect(10, 27, 5, 5, accent);
  p.rect(17, 27, 5, 5, main);

  // ── Curly-toe Shoes ──────────────────────────────────────────────────────
  const shoeColor = DARK;
  // Left shoe
  p.rect(8, 31, 8, 2, shoeColor);
  p.pixel(7, 30, shoeColor);  // curl tip
  // Right shoe
  p.rect(16, 31, 8, 2, shoeColor);
  p.pixel(24, 30, shoeColor);

  // ── Shading / Depth ──────────────────────────────────────────────────────
  p.shadeRegion(7, 0, 5, 7);    // left prong
  p.shadeRegion(20, 0, 5, 7);   // right prong
  p.shadeRegion(13, 0, 6, 6);   // centre prong
  p.shadeRegion(10, 8, 12, 8);  // head
  p.shadeRegion(5, 18, 5, 7);   // left arm
  p.shadeRegion(22, 18, 5, 7);  // right arm
  p.shadeRegion(10, 27, 5, 5);  // left leg
  p.shadeRegion(17, 27, 5, 5);  // right leg
}

function drawWizard(p: PixelPainter, main: RGBA, accent: RGBA) {
  const robe = main;
  const robeDark = shade(main, 0.55);
  const robeLight = shade(main, 1.35);
  const starColor = hex('#f5e642');
  const skinColor = SKIN;
  const white = rgb(245, 245, 245);

  // ── Pointed Hat ──────────────────────────────────────────────────────────
  // Tall conical point
  p.rect(14, 0, 4, 2, main);
  p.rect(13, 2, 6, 2, main);
  p.rect(12, 4, 8, 3, main);
  p.hstripes(9, 7, 14, 2, main, accent, 1); // hat brim stripe

  // Star on hat
  p.pixel(15, 1, starColor);
  p.pixel(16, 1, starColor);
  p.pixel(15, 3, starColor);

  // ── Head ─────────────────────────────────────────────────────────────────
  p.rect(10, 9, 12, 8, skinColor);
  // Beard (grey/white)
  const beard = rgb(200, 200, 200);
  p.rect(10, 14, 12, 5, beard);
  p.rect(11, 12, 10, 2, beard);
  // Ear nubs
  p.pixel(9, 11, SKIN_SHADOW);
  p.pixel(22, 11, SKIN_SHADOW);

  // Face (above beard)
  drawFace(p, 16, 10, 'neutral');

  // ── Robe Body ────────────────────────────────────────────────────────────
  p.rect(9, 17, 14, 11, robe);
  // Stars on robe
  p.pixel(12, 20, starColor); p.pixel(11, 21, starColor); p.pixel(13, 21, starColor); p.pixel(12, 22, starColor); // star1
  p.pixel(19, 19, starColor); p.pixel(18, 20, starColor); p.pixel(20, 20, starColor); p.pixel(19, 21, starColor); // star2
  p.pixel(15, 24, starColor); p.pixel(14, 25, starColor); p.pixel(16, 25, starColor); p.pixel(15, 26, starColor);

  // ── Sleeves / Arms ───────────────────────────────────────────────────────
  p.rect(4, 17, 6, 8, robe);
  p.rect(22, 17, 6, 8, robe);
  // Wide sleeve flare at wrist
  p.rect(3, 22, 7, 3, robe);
  p.rect(22, 22, 7, 3, robe);
  // Hands
  p.rect(4, 25, 4, 2, skinColor);
  p.rect(24, 25, 4, 2, skinColor);
  // Staff in right hand
  p.rect(27, 4, 2, 26, hex('#7a5230'));  // staff pole
  p.ellipse(28, 3, 2, 2, accent);        // staff orb
  p.pixel(28, 2, shade(accent, 1.6));    // orb glow

  // ── Robe bottom ──────────────────────────────────────────────────────────
  p.hstripes(8, 27, 16, 4, robe, shade(robe, 0.7), 2);

  // Shading
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

  // ── Helmet ───────────────────────────────────────────────────────────────
  p.rect(9, 3, 14, 8, metal);
  // Visor slit
  p.rect(11, 6, 10, 2, visorDark);
  p.pixel(11, 6, DARK);
  // Plume (accent colour on top)
  p.rect(14, 0, 4, 4, cloth);
  p.shadeSide(14, 0, 4, 4);
  // Chin guard
  p.rect(11, 10, 10, 2, metalDark);

  // ── Breastplate ──────────────────────────────────────────────────────────
  p.rect(9, 12, 14, 12, metal);
  // Chest insignia
  p.rect(13, 14, 6, 4, cloth);
  p.pixel(15, 15, metalLight); p.pixel(16, 15, metalLight);
  // Pauldrons (shoulder plates)
  p.rect(5, 12, 5, 5, metal);
  p.rect(22, 12, 5, 5, metal);

  // ── Arms (gauntlets) ─────────────────────────────────────────────────────
  p.rect(5, 17, 4, 7, metal);
  p.rect(23, 17, 4, 7, metal);
  // Gauntlet fists
  p.rect(5, 23, 5, 3, metalDark);
  p.rect(22, 23, 5, 3, metalDark);

  // ── Shield (left hand) ───────────────────────────────────────────────────
  p.rect(1, 17, 5, 9, metal);
  p.rect(2, 18, 3, 7, cloth);  // shield face
  p.pixel(3, 21, metalLight);  // boss

  // ── Sword (right hand) ───────────────────────────────────────────────────
  p.rect(26, 7, 2, 20, hex('#c0c0c0'));  // blade
  p.rect(24, 14, 6, 2, hex('#c8a000')); // crossguard
  p.rect(26, 16, 2, 4, hex('#7a5230')); // grip
  p.pixel(26, 7, metalLight); p.pixel(27, 7, metalLight); // tip shine

  // ── Legs (greaves) ───────────────────────────────────────────────────────
  p.rect(10, 24, 5, 7, metal);
  p.rect(17, 24, 5, 7, metal);
  // Knee pads
  p.rect(10, 24, 5, 2, metalDark);
  p.rect(17, 24, 5, 2, metalDark);
  // Boots
  p.rect(9, 30, 7, 2, metalDark);
  p.rect(16, 30, 7, 2, metalDark);

  // Shading
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

  // ── Body ─────────────────────────────────────────────────────────────────
  p.ellipse(16, 19, 9, 8, scale);
  // Belly
  p.ellipse(16, 21, 6, 5, belly);

  // ── Head ─────────────────────────────────────────────────────────────────
  p.ellipse(22, 9, 7, 6, scale);
  // Snout
  p.rect(25, 10, 6, 4, scale);
  p.rect(26, 13, 5, 2, scaleDark);  // mouth / jaw

  // Nostrils
  p.pixel(29, 11, DARK);
  p.pixel(29, 12, DARK);

  // Eyes
  p.ellipse(20, 8, 2, 2, eyeColor);
  p.pixel(20, 8, DARK);            // pupil slit
  p.pixel(19, 7, rgb(255, 255, 200, 200)); // highlight

  // Horn
  p.rect(21, 2, 2, 5, scaleDark);
  p.pixel(22, 1, scaleDark);

  // ── Wings ─────────────────────────────────────────────────────────────────
  // Left wing (spread)
  p.rect(3, 8, 8, 4, scaleDark);
  p.rect(1, 10, 5, 8, scaleDark);
  p.rect(3, 15, 3, 6, shade(scaleDark, 0.7));
  // Wing membrane lines
  p.rect(2, 11, 1, 7, shade(scaleDark, 0.6));
  p.rect(4, 10, 1, 9, shade(scaleDark, 0.6));
  p.rect(6, 9, 1, 6, shade(scaleDark, 0.6));

  // Right wing (folded back)
  p.rect(25, 9, 5, 3, scaleDark);
  p.rect(27, 11, 4, 6, scaleDark);

  // ── Tail ─────────────────────────────────────────────────────────────────
  p.rect(5, 22, 6, 4, scale);
  p.rect(3, 24, 5, 3, scale);
  p.rect(1, 26, 4, 2, scaleDark);
  p.pixel(1, 27, scaleDark);  // tail tip

  // ── Legs / Claws ─────────────────────────────────────────────────────────
  p.rect(12, 26, 4, 4, scale);
  p.rect(20, 26, 4, 4, scale);
  // Claws
  p.rect(11, 29, 2, 2, DARK); p.rect(13, 30, 2, 1, DARK); p.rect(15, 29, 2, 2, DARK);
  p.rect(19, 29, 2, 2, DARK); p.rect(21, 30, 2, 1, DARK); p.rect(23, 29, 2, 2, DARK);

  // ── Fire Breath ──────────────────────────────────────────────────────────
  // Coming from snout to right
  p.rect(30, 11, 2, 2, hex('#ff3300'));
  p.rect(31, 9, 2, 4, fireColor);
  p.pixel(31, 8, fireTip); p.pixel(31, 13, fireTip);

  // Shading
  p.shadeRegion(8, 12, 16, 14);
  p.shadeRegion(17, 5, 12, 10);
}

function drawSlime(p: PixelPainter, main: RGBA, accent: RGBA) {
  const glow = shade(main, 1.4);
  const dark = shade(main, 0.5);
  const shine = rgb(255, 255, 255, 200);

  // ── Body blob ─────────────────────────────────────────────────────────────
  p.ellipse(16, 21, 10, 8, main);
  // Slightly flattened bottom
  p.rect(7, 26, 18, 3, main);

  // ── Highlight ─────────────────────────────────────────────────────────────
  p.ellipse(13, 17, 4, 3, glow);
  p.ellipse(12, 16, 2, 2, shine);

  // ── Eyes ─────────────────────────────────────────────────────────────────
  const eyeWhite = rgb(245, 245, 245);
  // Left eye
  p.ellipse(12, 19, 3, 3, eyeWhite);
  p.ellipse(13, 20, 1, 2, DARK);
  p.pixel(11, 18, shine);
  // Right eye
  p.ellipse(20, 19, 3, 3, eyeWhite);
  p.ellipse(20, 20, 1, 2, DARK);
  p.pixel(19, 18, shine);

  // ── Cute smile ────────────────────────────────────────────────────────────
  p.rect(14, 23, 5, 1, dark);
  p.pixel(13, 22, dark); p.pixel(19, 22, dark);

  // ── Drip ─────────────────────────────────────────────────────────────────
  p.rect(22, 15, 2, 4, main);
  p.pixel(22, 19, dark);
  p.rect(9, 14, 2, 3, main);
  p.pixel(10, 17, dark);

  // Shading
  p.shadeRegion(7, 14, 18, 16);
}

function drawSkeleton(p: PixelPainter, main: RGBA, _accent: RGBA) {
  const bone = hex('#e8e0cc');
  const boneDark = hex('#b8b0a0');
  const boneShadow = hex('#8a8070');
  const voidColor = DARK;

  // ── Skull ─────────────────────────────────────────────────────────────────
  p.ellipse(16, 8, 6, 6, bone);
  // Eye sockets (dark voids)
  p.ellipse(13, 7, 2, 2, voidColor);
  p.ellipse(19, 7, 2, 2, voidColor);
  // Nose cavity
  p.rect(15, 10, 2, 2, voidColor);
  // Teeth
  for (let i = 0; i < 6; i++) {
    p.rect(12 + i * 2, 13, 1, 2, bone);
  }
  p.rect(11, 12, 10, 2, boneDark);

  // ── Ribcage ───────────────────────────────────────────────────────────────
  p.rect(12, 15, 8, 1, bone); // spine row 1
  // Ribs
  for (let row = 0; row < 4; row++) {
    const y = 16 + row * 2;
    p.rect(8, y, 4, 1, bone);
    p.rect(20, y, 4, 1, bone);
    p.rect(12, y, 8, 1, bone);
  }

  // ── Pelvis ────────────────────────────────────────────────────────────────
  p.rect(10, 24, 12, 3, bone);
  p.rect(12, 24, 8, 3, boneDark);

  // ── Arms ─────────────────────────────────────────────────────────────────
  p.rect(7, 15, 2, 8, bone);   // left upper
  p.rect(7, 23, 2, 5, bone);   // left lower
  p.rect(23, 15, 2, 8, bone);  // right upper
  p.rect(23, 23, 2, 5, bone);  // right lower
  // Bony hands
  p.rect(6, 27, 4, 2, bone);
  p.rect(22, 27, 4, 2, bone);

  // ── Legs ─────────────────────────────────────────────────────────────────
  p.rect(12, 27, 2, 7, bone);  // left femur
  p.rect(18, 27, 2, 7, bone);  // right femur
  // Knee joint
  p.ellipse(13, 27, 2, 2, boneDark);
  p.ellipse(19, 27, 2, 2, boneDark);

  // Shading
  p.shadeRegion(10, 2, 12, 12);
  p.shadeRegion(10, 15, 12, 12);
}

function drawMushroom(p: PixelPainter, main: RGBA, accent: RGBA) {
  const spotColor = rgb(245, 245, 245);
  const stemColor = hex('#d4c9a8');
  const stemDark = hex('#b8a88a');
  const gills = shade(main, 0.7);

  // ── Cap ───────────────────────────────────────────────────────────────────
  p.ellipse(16, 13, 12, 10, main);
  // Cap underside gills
  p.rect(7, 18, 18, 3, gills);

  // ── Spots ─────────────────────────────────────────────────────────────────
  p.ellipse(12, 10, 3, 3, spotColor);
  p.ellipse(20, 9, 2, 2, spotColor);
  p.ellipse(16, 7, 2, 2, spotColor);
  p.ellipse(10, 14, 2, 2, spotColor);
  p.ellipse(22, 13, 2, 2, spotColor);

  // ── Stem ─────────────────────────────────────────────────────────────────
  p.rect(12, 19, 8, 10, stemColor);
  // Stem shading
  p.shadeRegion(12, 19, 8, 10);
  // Stem ring
  p.rect(11, 22, 10, 2, shade(stemColor, 0.8));

  // ── Face (cute) ──────────────────────────────────────────────────────────
  const eyeW = rgb(245, 245, 245);
  p.ellipse(13, 21, 2, 2, eyeW);
  p.pixel(14, 21, DARK);
  p.ellipse(19, 21, 2, 2, eyeW);
  p.pixel(19, 21, DARK);
  // Smile
  p.rect(14, 24, 4, 1, DARK);
  p.pixel(13, 23, DARK); p.pixel(18, 23, DARK);

  // Cap shading
  p.shadeRegion(5, 5, 22, 14);
}

function drawTree(p: PixelPainter, main: RGBA, accent: RGBA) {
  const trunkColor = hex('#7a5230');
  const trunkDark = hex('#5a3a18');
  const leafLight = shade(main, 1.3);
  const leafDark = shade(main, 0.65);

  // ── Trunk ─────────────────────────────────────────────────────────────────
  p.rect(13, 21, 6, 11, trunkColor);
  p.shadeRegion(13, 21, 6, 11);
  // Bark lines
  p.rect(14, 22, 1, 9, trunkDark);
  p.rect(17, 24, 1, 7, trunkDark);
  // Roots
  p.rect(10, 30, 4, 2, trunkDark);
  p.rect(18, 30, 4, 2, trunkDark);

  // ── Foliage (3-layer cloud) ───────────────────────────────────────────────
  // Bottom layer
  p.ellipse(16, 22, 10, 6, main);
  // Mid layer
  p.ellipse(16, 17, 9, 6, main);
  // Top layer
  p.ellipse(16, 11, 7, 6, main);
  // Highlight blobs
  p.ellipse(13, 9, 4, 4, leafLight);
  p.ellipse(19, 12, 3, 3, leafLight);
  p.ellipse(11, 19, 3, 3, leafLight);
  // Shadow patches
  p.ellipse(20, 20, 3, 3, leafDark);
  p.ellipse(13, 22, 3, 2, leafDark);

  // Shading
  p.shadeRegion(5, 5, 22, 18);
}

function drawChest(p: PixelPainter, main: RGBA, accent: RGBA) {
  const wood = hex('#8b5e3c');
  const woodDark = hex('#5a3a1a');
  const metal = hex('#c0a030');
  const metalDark = hex('#8a7020');
  const gemColor = hex('#e040fb');
  const insideColor = hex('#3a2000');

  // ── Main box ─────────────────────────────────────────────────────────────
  p.rect(5, 14, 22, 16, wood);
  // Lid (slightly lighter)
  p.rect(5, 9, 22, 7, shade(wood, 1.2));
  // Top arc of lid
  p.rect(6, 7, 20, 4, shade(wood, 1.2));
  p.ellipse(16, 9, 10, 4, shade(wood, 1.2));

  // ── Metal banding ─────────────────────────────────────────────────────────
  // Lid band
  p.rect(4, 13, 24, 2, metal);
  // Vertical straps
  p.rect(14, 7, 4, 23, metal);
  p.rect(4, 10, 2, 20, metal);
  p.rect(26, 10, 2, 20, metal);
  // Bottom band
  p.rect(4, 27, 24, 2, metalDark);
  // Corner studs
  for (const [sx, sy] of [[5,10],[26,10],[5,27],[26,27]]) {
    p.ellipse(sx, sy, 2, 2, metal);
    p.pixel(sx - 1, sy - 1, shade(metal, 1.5));
  }

  // ── Lock / keyhole ────────────────────────────────────────────────────────
  p.ellipse(16, 14, 3, 3, metalDark);
  p.ellipse(16, 14, 2, 2, metal);
  p.rect(15, 15, 2, 3, metalDark);  // keyhole slot

  // ── Gem on lid ────────────────────────────────────────────────────────────
  p.ellipse(16, 10, 3, 3, gemColor);
  p.pixel(15, 9, shade(gemColor, 1.6));

  // ── Inside glow (if slightly open) ───────────────────────────────────────
  p.rect(7, 12, 18, 2, insideColor);

  // Wood grain
  p.rect(7, 17, 18, 1, woodDark);
  p.rect(7, 21, 18, 1, woodDark);
  p.rect(7, 25, 18, 1, woodDark);

  // Shading
  p.shadeRegion(5, 7, 22, 8);
  p.shadeRegion(5, 14, 22, 16);
}

function drawGenericHumanoid(p: PixelPainter, main: RGBA, accent: RGBA, expression: Expression = 'neutral') {
  const cloth = main;
  const clothDark = shade(main, 0.6);
  const belt = shade(accent, 0.8);
  const boot = shade(main, 0.4);

  // ── Simple round helmet/hood ──────────────────────────────────────────────
  p.ellipse(16, 7, 7, 7, cloth);
  // Face cutout
  p.rect(11, 5, 10, 8, SKIN);
  p.ellipse(16, 7, 5, 5, SKIN);

  // ── Head ─────────────────────────────────────────────────────────────────
  drawFace(p, 16, 8, expression);

  // ── Torso ────────────────────────────────────────────────────────────────
  p.rect(9, 15, 14, 11, cloth);
  // Belt
  p.rect(9, 22, 14, 2, belt);
  // Shading
  p.shadeRegion(9, 15, 14, 11);
  p.shadeSide(9, 15, 14, 11);

  // ── Arms ─────────────────────────────────────────────────────────────────
  p.rect(5, 15, 5, 8, cloth);
  p.rect(22, 15, 5, 8, cloth);
  // Hands
  p.rect(5, 23, 5, 2, SKIN);
  p.rect(22, 23, 5, 2, SKIN);

  // ── Legs / Boots ─────────────────────────────────────────────────────────
  p.rect(10, 26, 5, 5, clothDark);
  p.rect(17, 26, 5, 5, clothDark);
  p.rect(9, 30, 6, 2, boot);
  p.rect(17, 30, 6, 2, boot);

  // ── Collar ───────────────────────────────────────────────────────────────
  p.rect(12, 14, 8, 2, shade(cloth, 1.2));

  p.shadeRegion(5, 15, 5, 8);
  p.shadeRegion(22, 15, 5, 8);
}

// ─── Animation Frame Offset ──────────────────────────────────────────────────
//
// For walking animations we generate 4 frames, each with a slight leg offset.

function applyWalkOffset(p: PixelPainter, frame: number) {
  // Simple walk: shift leg pixels slightly up/down per frame
  const offsets = [0, -1, 0, 1];
  const dy = offsets[frame % 4];
  if (dy === 0) return;
  // Shift the lower body rows by dy (very rough – enough for basic animation)
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

// ─── Humanizer ───────────────────────────────────────────────────────────────

function humanize(img: ImageData, amount = 0.6): ImageData {
  const d = new Uint8ClampedArray(img.data);
  const w = img.width, h = img.height;

  // 1. Subtle colour jitter on non-outline opaque pixels
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    // Skip very dark pixels (outlines)
    if (d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) continue;
    if (Math.random() < 0.35 * amount) {
      const jitter = (Math.random() - 0.5) * 10 * amount;
      d[i] = clamp(d[i] + jitter);
      d[i + 1] = clamp(d[i + 1] + jitter);
      d[i + 2] = clamp(d[i + 2] + jitter);
    }
  }

  // 2. Occasional single-pixel noise (1%)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    if (Math.random() < 0.01 * amount) {
      const n = (Math.random() - 0.5) * 25;
      d[i] = clamp(d[i] + n); d[i + 1] = clamp(d[i + 1] + n); d[i + 2] = clamp(d[i + 2] + n);
    }
  }

  // 3. Very light edge erosion (2%)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const adjT = (((y - 1) * w + x) * 4 + 3);
      const adjB = (((y + 1) * w + x) * 4 + 3);
      const adjL = ((y * w + x - 1) * 4 + 3);
      const adjR = ((y * w + x + 1) * 4 + 3);
      const isEdge = d[adjT] === 0 || d[adjB] === 0 || d[adjL] === 0 || d[adjR] === 0;
      if (isEdge && Math.random() < 0.02 * amount) d[i + 3] = 0;
    }
  }

  return new ImageData(d, w, h);
}

// ─── Prompt Parser ───────────────────────────────────────────────────────────

const KEYWORD_COLOURS: Array<{ words: string[]; main: RGBA; accent: RGBA }> = [
  { words: ['jester','fool','harlequin'], main: hex('#9b3dab'), accent: hex('#f5c842') },
  { words: ['red jester','red harlequin'], main: hex('#c0392b'), accent: hex('#f5e642') },
  { words: ['blue jester'], main: hex('#2980b9'), accent: hex('#f5c842') },
  { words: ['green jester'], main: hex('#27ae60'), accent: hex('#f5e642') },
  { words: ['wizard','mage','sorcerer'], main: hex('#1a237e'), accent: hex('#7c4dff') },
  { words: ['blue wizard'], main: hex('#1565c0'), accent: hex('#82b1ff') },
  { words: ['red wizard','fire wizard'], main: hex('#b71c1c'), accent: hex('#ff6d00') },
  { words: ['green mage','nature mage'], main: hex('#1b5e20'), accent: hex('#76ff03') },
  { words: ['knight','paladin','crusader'], main: hex('#4a6fa5'), accent: hex('#c0a030') },
  { words: ['dark knight','black knight'], main: hex('#212121'), accent: hex('#b71c1c') },
  { words: ['warrior','barbarian','fighter'], main: hex('#795548'), accent: hex('#e64a19') },
  { words: ['archer','ranger'], main: hex('#388e3c'), accent: hex('#8d6e63') },
  { words: ['rogue','assassin','thief'], main: hex('#424242'), accent: hex('#8e24aa') },
  { words: ['elf','dark elf'], main: hex('#1b5e20'), accent: hex('#c8e6c9') },
  { words: ['dragon','serpent'], main: hex('#2e7d32'), accent: hex('#ff6f00') },
  { words: ['red dragon','fire dragon'], main: hex('#c62828'), accent: hex('#ff6f00') },
  { words: ['blue dragon','ice dragon'], main: hex('#1565c0'), accent: hex('#80deea') },
  { words: ['purple dragon'], main: hex('#6a1b9a'), accent: hex('#e040fb') },
  { words: ['slime','blob'], main: hex('#4caf50'), accent: hex('#a5d6a7') },
  { words: ['blue slime'], main: hex('#1976d2'), accent: hex('#90caf9') },
  { words: ['red slime'], main: hex('#d32f2f'), accent: hex('#ef9a9a') },
  { words: ['skeleton','bones','undead'], main: hex('#e8e0cc'), accent: hex('#78909c') },
  { words: ['mushroom'], main: hex('#f44336'), accent: hex('#ffccbc') },
  { words: ['blue mushroom'], main: hex('#1976d2'), accent: hex('#bbdefb') },
  { words: ['tree','forest','oak','pine'], main: hex('#388e3c'), accent: hex('#7a5230') },
  { words: ['chest','treasure'], main: hex('#8b5e3c'), accent: hex('#c0a030') },
  { words: ['ghost'], main: hex('#b0bec5'), accent: hex('#e8f5e9') },
  { words: ['orc'], main: hex('#558b2f'), accent: hex('#795548') },
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
  wizard: 'wizard', mage: 'mage', sorcerer: 'wizard', magician: 'wizard',
  warlock: 'wizard',
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
  ghost: 'humanoid', orc: 'warrior', goblin: 'humanoid',
};

export function parsePrompt(prompt: string): ParsedPrompt {
  const p = prompt.toLowerCase();

  // Subject
  let subject: Subject = 'humanoid';
  for (const [word, subj] of Object.entries(SUBJECT_MAP)) {
    if (p.includes(word)) { subject = subj; break; }
  }
  // Special overrides
  if (p.includes('mushroom')) subject = 'mushroom';
  if (p.includes('tree') || p.includes('forest')) subject = 'tree';
  if (p.includes('chest') || p.includes('treasure')) subject = 'chest';
  if (p.includes('dragon')) subject = 'dragon';
  if (p.includes('slime') || p.includes('blob')) subject = 'slime';
  if (p.includes('skeleton')) subject = 'skeleton';

  // Expression
  let expression: Expression = 'neutral';
  if (subject === 'jester') expression = 'grin';
  if (p.includes('happy') || p.includes('smile')) expression = 'happy';
  if (p.includes('stern') || p.includes('serious')) expression = 'stern';
  if (p.includes('angry') || p.includes('rage')) expression = 'angry';
  if (p.includes('grin') || p.includes('mischievous')) expression = 'grin';

  // View
  const view: 'front' | 'side' = p.includes('side') ? 'side' : 'front';

  // Style
  let style: 'simple' | 'normal' | 'detailed' = 'normal';
  if (p.includes('simple') || p.includes('basic')) style = 'simple';
  if (p.includes('detailed') || p.includes('complex')) style = 'detailed';

  // Colours – check compound colour + subject keywords first
  let main: RGBA | null = null;
  let accent: RGBA | null = null;

  for (const entry of KEYWORD_COLOURS) {
    if (entry.words.some(w => p.includes(w))) {
      main = entry.main;
      accent = entry.accent;
      break;
    }
  }

  // Override with explicit colour names in prompt
  let colorOverride: RGBA | null = null;
  let accentOverride: RGBA | null = null;
  const colourWords = Object.keys(COLOUR_NAMES);
  const firstColour = colourWords.find(c => p.includes(c));
  if (firstColour) colorOverride = COLOUR_NAMES[firstColour];
  const secondColour = colourWords.filter(c => c !== firstColour).find(c => p.includes(c));
  if (secondColour) accentOverride = COLOUR_NAMES[secondColour];

  // Animation
  const animated =
    p.includes('walk') || p.includes('running') || p.includes('animation') ||
    p.includes('animated') || p.includes('frames');
  const frames = animated ? 4 : 1;

  return { subject, view, style, colorOverride, accentOverride, animated, frames, expression };
}

// ─── Colour Resolution ───────────────────────────────────────────────────────

function resolveColours(parsed: ParsedPrompt): [RGBA, RGBA] {
  // Defaults per subject
  const defaults: Record<Subject, [RGBA, RGBA]> = {
    jester:   [hex('#9b3dab'), hex('#f5c842')],
    wizard:   [hex('#1a237e'), hex('#7c4dff')],
    mage:     [hex('#4a148c'), hex('#7c4dff')],
    knight:   [hex('#4a6fa5'), hex('#c0a030')],
    warrior:  [hex('#795548'), hex('#e64a19')],
    archer:   [hex('#388e3c'), hex('#8d6e63')],
    rogue:    [hex('#424242'), hex('#8e24aa')],
    elf:      [hex('#1b5e20'), hex('#c8e6c9')],
    dragon:   [hex('#2e7d32'), hex('#ff6f00')],
    slime:    [hex('#4caf50'), hex('#a5d6a7')],
    skeleton: [hex('#e8e0cc'), hex('#78909c')],
    ghost:    [hex('#b0bec5'), hex('#e0f7fa')],
    orc:      [hex('#558b2f'), hex('#795548')],
    mushroom: [hex('#f44336'), hex('#ffccbc')],
    tree:     [hex('#388e3c'), hex('#7a5230')],
    flower:   [hex('#f06292'), hex('#fff176')],
    chest:    [hex('#8b5e3c'), hex('#c0a030')],
    potion:   [hex('#9c27b0'), hex('#e1bee7')],
    sword:    [hex('#9badb7'), hex('#c0a030')],
    shield:   [hex('#1565c0'), hex('#c0a030')],
    humanoid: [hex('#795548'), hex('#e64a19')],
  };

  let [main, accent] = defaults[parsed.subject] ?? defaults.humanoid;

  // Keyword compound override
  for (const entry of KEYWORD_COLOURS) {
    const p = parsed.subject;
    if (entry.words.some(w => w.includes(p as string) || (parsed as any)._raw?.includes(w))) {
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
    default:                         return drawGenericHumanoid(p, main, accent, parsed.expression);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate one or more pixel-art frames from a text prompt.
 * Returns an array of ImageData (length = parsed.frames).
 */
export function generateSprite(prompt: string, width: number, height: number): ImageData[] {
  const parsed = parsePrompt(prompt);
  const [main, accent] = resolveColours(parsed);
  const frameCount = parsed.frames;
  const results: ImageData[] = [];

  for (let f = 0; f < frameCount; f++) {
    const p = new PixelPainter(width, height);
    drawSubject(p, parsed, main, accent);
    if (parsed.animated && frameCount > 1) applyWalkOffset(p, f);
    p.outline();
    results.push(humanize(p.toImageData(), 0.5));
  }

  return results;
}

/**
 * Refine an existing sprite by re-generating with the combined prompt.
 * The refinement is concatenated with the original prompt so new keywords
 * (colour changes, additions) take effect on the full draw pass.
 */
export function refineSprite(
  originalPrompt: string,
  refinement: string,
  width: number,
  height: number,
): ImageData[] {
  const combined = `${originalPrompt} ${refinement}`.trim();
  return generateSprite(combined, width, height);
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
];
