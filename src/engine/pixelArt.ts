// Museum-grade Hi-Bit Procedural Pixel-Art Sprite, Font & Parallax Generator for ESTRATO.
// Unified 24x24 block grid, 36x36 articulated Exo-Rig sprites, 64x64 Guardians, 5x7 bitmap font,
// Bayer 4x4 ordered dithering, and hue-shifted color ramps. All rendered with imageSmoothingEnabled = false.

import { AimDir, ArtifactId, ChassisId, COLOR_SYMBOLS, MaterialId, RigPose, RigUpgrades, StorySpeaker } from '../types/game';
import { ARTIFACTS } from '../data/collectibles';

export const TILE_PX = 24;
const spriteCache = new Map<string, HTMLCanvasElement>();

function getCached(key: string): HTMLCanvasElement | undefined {
  return spriteCache.get(key);
}

function setCached(key: string, canvas: HTMLCanvasElement): HTMLCanvasElement {
  if (spriteCache.size > 2400) {
    let toRemove = 500;
    for (const k of spriteCache.keys()) {
      spriteCache.delete(k);
      if (--toRemove <= 0) break;
    }
  }
  spriteCache.set(key, canvas);
  return canvas;
}

function hash2D(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

// 4x4 Ordered Bayer Matrix normalized to [-0.5, +0.5]
const BAYER4 = [
  [0 / 16 - 0.5, 8 / 16 - 0.5, 2 / 16 - 0.5, 10 / 16 - 0.5],
  [12 / 16 - 0.5, 4 / 16 - 0.5, 14 / 16 - 0.5, 6 / 16 - 0.5],
  [3 / 16 - 0.5, 11 / 16 - 0.5, 1 / 16 - 0.5, 9 / 16 - 0.5],
  [15 / 16 - 0.5, 7 / 16 - 0.5, 13 / 16 - 0.5, 5 / 16 - 0.5],
];

function bayerAt(x: number, y: number): number {
  return BAYER4[y & 3][x & 3];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [120, 120, 130];
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [120, 120, 130];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToStr(r: number, g: number, b: number, a = 1): string {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return a >= 1 ? `rgb(${cr},${cg},${cb})` : `rgba(${cr},${cg},${cb},${a})`;
}

function mixRgbVal(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): string {
  const [r, g, bl] = mixRgbVal(a, b, t);
  return rgbToStr(r, g, bl);
}

function shadeRgb(rgb: [number, number, number], factor: number): string {
  if (factor >= 0) {
    return mixRgb(rgb, [255, 255, 255], Math.min(1, factor));
  }
  return mixRgb(rgb, [0, 0, 0], Math.min(1, -factor));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hn = (((h % 360) + 360) % 360) / 360;
  if (s <= 0.001) {
    const v = Math.round(Math.max(0, Math.min(1, l)) * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hn) * 255),
    Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  ];
}

function shiftHueToward(h: number, targetH: number, deg: number): number {
  let diff = ((targetH - h + 540) % 360) - 180;
  if (Math.abs(diff) <= deg) return targetH;
  return (h + Math.sign(diff) * deg + 360) % 360;
}

export interface HueShiftedRamp {
  outline: string;
  dark: string;
  mid: string;
  light: string;
  specular: string;
  outlineRgb: [number, number, number];
  darkRgb: [number, number, number];
  midRgb: [number, number, number];
  lightRgb: [number, number, number];
  specularRgb: [number, number, number];
}

export function buildHueShiftedRamp(hex: string): HueShiftedRamp {
  const rgb = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

  // Special handling for near-monochrome shades (Stratum V / VI)
  if (s < 0.08) {
    const outL = Math.max(0.05, Math.min(0.14, l * 0.25));
    const darkL = Math.max(0.12, l - 0.22);
    const midL = l;
    const lightL = Math.min(0.92, l + 0.18);
    const specL = Math.min(1.0, l + 0.34);

    const outRgb = hslToRgb(240, 0.16, outL);
    const darkRgb = hslToRgb(235, 0.1, darkL);
    const midRgb = rgb;
    const lightRgb = hslToRgb(48, 0.08, lightL);
    const specRgb = hslToRgb(48, 0.04, specL);
    return {
      outline: rgbToStr(...outRgb),
      dark: rgbToStr(...darkRgb),
      mid: rgbToStr(...midRgb),
      light: rgbToStr(...lightRgb),
      specular: rgbToStr(...specRgb),
      outlineRgb: outRgb,
      darkRgb,
      midRgb,
      lightRgb,
      specularRgb: specRgb,
    };
  }

  const isCoolCyanBlue = h >= 180 && h <= 255;
  const highlightTarget = isCoolCyanBlue ? 190 : 54;

  const outH = shiftHueToward(h, 245, 28);
  const darkH = shiftHueToward(h, 250, 18);
  const lightH = shiftHueToward(h, highlightTarget, 14);
  const specH = shiftHueToward(h, isCoolCyanBlue ? 185 : 50, 22);

  const outRgb = hslToRgb(outH, Math.min(1, s * 0.85 + 0.12), Math.max(0.07, Math.min(0.16, l * 0.28)));
  const darkRgb = hslToRgb(darkH, Math.min(1, s + 0.08), Math.max(0.12, l - 0.21));
  const midRgb = rgb;
  const lightRgb = hslToRgb(lightH, Math.min(1, s + 0.04), Math.min(0.88, l + 0.17));
  const specRgb = hslToRgb(specH, Math.max(0.15, s - 0.12), Math.min(0.97, l + 0.34));

  return {
    outline: rgbToStr(...outRgb),
    dark: rgbToStr(...darkRgb),
    mid: rgbToStr(...midRgb),
    light: rgbToStr(...lightRgb),
    specular: rgbToStr(...specRgb),
    outlineRgb: outRgb,
    darkRgb,
    midRgb,
    lightRgb,
    specularRgb: specRgb,
  };
}

function createPixelCanvas(w = TILE_PX, h = TILE_PX): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [canvas, ctx];
}

// ==================== 5x7 CRISP PIXEL BITMAP FONT ====================

const GLYPH_5X7: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10011', '10101', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
  Á: ['00100', '01010', '10001', '11111', '10001', '10001', '10001'],
  É: ['00100', '11111', '10000', '11110', '10000', '10000', '11111'],
  Í: ['00100', '01110', '00100', '00100', '00100', '00100', '01110'],
  Ó: ['00100', '01110', '10001', '10001', '10001', '10001', '01110'],
  Ú: ['00100', '10001', '10001', '10001', '10001', '10001', '01110'],
  Ñ: ['01110', '00000', '10001', '11001', '10101', '10011', '10001'],
  Ü: ['01010', '00000', '10001', '10001', '10001', '10001', '01110'],
  '₂': ['00000', '00000', '01110', '00010', '01110', '01000', '01110'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '×': ['00000', '10001', '01010', '00100', '01010', '10001', '00000'],
  '%': ['11001', '11010', '00100', '00100', '01011', '10011', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '00110', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  '/': ['00001', '00010', '00100', '00100', '01000', '10000', '00000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '¡': ['00100', '00000', '00100', '00100', '00100', '00100', '00100'],
  '?': ['01110', '10001', '00010', '00100', '00100', '00000', '00100'],
  '¿': ['00100', '00000', '00100', '00100', '01000', '10001', '01110'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  '·': ['00000', '00000', '00000', '00100', '00000', '00000', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  '*': ['00100', '10101', '01110', '11111', '01110', '10101', '00100'],
  '▲': ['00100', '00100', '01110', '01110', '11111', '11111', '00000'],
  '▼': ['00000', '11111', '11111', '01110', '01110', '00100', '00100'],
  '◀': ['00010', '00110', '01110', '11110', '01110', '00110', '00010'],
  '▶': ['01000', '01100', '01110', '01111', '01110', '01100', '01000'],
  '★': ['00100', '00100', '11111', '01110', '01010', '10001', '00000'],
  '◆': ['00100', '01110', '11111', '11111', '01110', '00100', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

function normalizeGlyphChar(ch: string): string {
  if (GLYPH_5X7[ch]) return ch;
  const up = ch.toUpperCase();
  if (GLYPH_5X7[up]) return up;
  if (ch === '–' || ch === '—') return '-';
  return ' ';
}

export function measurePixelTextWidth(text: string, scale = 1): number {
  if (!text) return 0;
  const s = Math.max(1, Math.round(scale));
  return Math.max(0, (text.length * 6 - 1) * s);
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  opts?: {
    align?: 'left' | 'center' | 'right';
    scale?: number;
    outline?: string;
    shadow?: boolean;
  }
): void {
  if (!text) return;
  const scale = Math.max(1, Math.round(opts?.scale ?? 1));
  const align = opts?.align ?? 'left';
  const outline = opts?.outline ?? '#09090B';
  const shadow = opts?.shadow ?? true;

  const totalW = measurePixelTextWidth(text, scale);
  let startX = Math.round(x);
  if (align === 'center') startX = Math.round(x - totalW * 0.5);
  else if (align === 'right') startX = Math.round(x - totalW);
  const startY = Math.round(y);

  const chars = Array.from(text);

  // Pass 1: Crisp 1-pixel dark outline + optional drop shadow
  if (outline !== 'none') {
    ctx.fillStyle = outline;
    for (let i = 0; i < chars.length; i++) {
      const glyph = GLYPH_5X7[normalizeGlyphChar(chars[i])];
      const gx = startX + i * 6 * scale;
      for (let r = 0; r < 7; r++) {
        const row = glyph[r];
        for (let c = 0; c < 5; c++) {
          if (row[c] === '1') {
            const px = gx + c * scale;
            const py = startY + r * scale;
            ctx.fillRect(px - scale, py, scale, scale);
            ctx.fillRect(px + scale, py, scale, scale);
            ctx.fillRect(px, py - scale, scale, scale);
            ctx.fillRect(px, py + scale, scale, scale);
            if (shadow) {
              ctx.fillRect(px + scale, py + scale, scale, scale);
            }
          }
        }
      }
    }
  }

  // Pass 2: Crisp foreground pixels
  ctx.fillStyle = color;
  for (let i = 0; i < chars.length; i++) {
    const glyph = GLYPH_5X7[normalizeGlyphChar(chars[i])];
    const gx = startX + i * 6 * scale;
    for (let r = 0; r < 7; r++) {
      const row = glyph[r];
      for (let c = 0; c < 5; c++) {
        if (row[c] === '1') {
          ctx.fillRect(gx + c * scale, startY + r * scale, scale, scale);
        }
      }
    }
  }
}

// ==================== 4-LAYER PARALLAX RETRO CAVERN BACKGROUNDS ====================

export function getDeepVistaTile(
  stratumId: number,
  bgHex: string,
  borderHex: string,
  accentHex: string,
  isLightMode = false
): HTMLCanvasElement {
  const key = `VISTA_${stratumId}_${bgHex}_${borderHex}_${accentHex}_${isLightMode ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const W = 128;
  const H = 128;
  const [canvas, ctx] = createPixelCanvas(W, H);
  const bgRgb = hexToRgb(bgHex);
  const bdRgb = hexToRgb(borderHex);
  const accRgb = hexToRgb(accentHex);

  // Subtle deep abyssal Bayer-dithered gradient backdrop
  for (let py = 0; py < H; py++) {
    const depthShade = Math.sin((py / H) * Math.PI * 2) * 0.08;
    for (let px = 0; px < W; px++) {
      const b = bayerAt(px, py) * 0.07;
      ctx.fillStyle = shadeRgb(bgRgb, depthShade + b - (isLightMode ? 0.04 : 0.14));
      ctx.fillRect(px, py, 1, 1);
    }
  }

  const silDark = isLightMode ? mixRgb(bgRgb, bdRgb, 0.45) : shadeRgb(bgRgb, -0.42);
  const silMid = isLightMode ? mixRgb(bgRgb, bdRgb, 0.25) : mixRgb(bgRgb, bdRgb, 0.24);
  const silHi = mixRgb(bgRgb, accRgb, isLightMode ? 0.25 : 0.22);

  if (stratumId === 1) {
    // Subterranean mega-turbine gears & exhaust silhouettes
    const drawGear = (cx: number, cy: number, rad: number) => {
      for (let y = -rad - 4; y <= rad + 4; y++) {
        for (let x = -rad - 4; x <= rad + 4; x++) {
          const d = Math.hypot(x, y);
          const ang = Math.atan2(y, x);
          const tooth = Math.sin(ang * 8) > 0.3 ? 3 : 0;
          if (d <= rad + tooth && d >= rad * 0.42) {
            const px = (cx + x + W) % W;
            const py = (cy + y + H) % H;
            ctx.fillStyle = d > rad - 2 ? silMid : silDark;
            ctx.fillRect(px, py, 1, 1);
          }
        }
      }
    };
    drawGear(34, 42, 22);
    drawGear(96, 98, 18);
    ctx.fillStyle = silDark;
    ctx.fillRect(0, 62, W, 8);
    ctx.fillStyle = silHi;
    ctx.fillRect(0, 62, W, 1);
  } else if (stratumId === 2) {
    // Cathedral ice arches & giant suspended crystal stalactites
    ctx.fillStyle = silDark;
    for (const [cx, baseW, len] of [
      [24, 18, 48],
      [78, 22, 56],
      [112, 14, 38],
    ]) {
      for (let i = 0; i < len; i++) {
        const w = Math.max(1, Math.round((1 - i / len) * (baseW * 0.5)));
        ctx.fillStyle = silDark;
        ctx.fillRect(cx - w, i, w * 2, 1);
        ctx.fillStyle = silHi;
        ctx.fillRect(cx - w, i, 2, 1);
      }
    }
  } else if (stratumId === 3) {
    // Cascading distant magma falls behind basalt pillars
    ctx.fillStyle = silDark;
    ctx.fillRect(10, 0, 20, H);
    ctx.fillRect(92, 0, 22, H);
    for (let py = 0; py < H; py++) {
      const wave = Math.round(Math.sin(py * 0.14) * 4);
      ctx.fillStyle = 'rgba(234, 88, 12, 0.25)';
      ctx.fillRect(54 + wave, py, 12, 1);
      if ((py + wave) % 4 < 2) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.22)';
        ctx.fillRect(58 + wave, py, 4, 1);
      }
    }
  } else if (stratumId === 4) {
    // Sunken abyssal ribs & pressure domes
    ctx.fillStyle = silDark;
    for (let ry = 16; ry < H; ry += 42) {
      ctx.fillRect(0, ry, W, 10);
      ctx.fillStyle = silMid;
      ctx.fillRect(0, ry, W, 2);
      ctx.fillStyle = silDark;
    }
    ctx.strokeStyle = silHi;
    ctx.lineWidth = 2;
    ctx.strokeRect(42, 34, 44, 60);
  } else if (stratumId === 5) {
    // Floating geometric quantum obelisks
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(22, 16, 16, 52);
    ctx.fillRect(88, 56, 18, 56);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(22, 16, 16, 2);
    ctx.fillRect(88, 56, 18, 2);
  } else if (stratumId === 6) {
    // Alabaster temple colonnades & golden frieze
    ctx.fillStyle = silDark;
    ctx.fillRect(16, 0, 14, H);
    ctx.fillRect(98, 0, 14, H);
    ctx.fillStyle = silHi;
    ctx.fillRect(16, 0, 2, H);
    ctx.fillRect(98, 0, 2, H);
    ctx.fillRect(36, 60, 56, 4);
  } else {
    // Stratum 7: Event Horizon fractured cosmic obelisks & gold rings
    ctx.fillStyle = 'rgba(250, 204, 21, 0.14)';
    ctx.fillRect(28, 18, 22, 72);
    ctx.fillRect(82, 42, 18, 68);
    ctx.fillStyle = 'rgba(192, 132, 252, 0.2)';
    ctx.fillRect(28, 18, 22, 3);
    ctx.fillRect(82, 42, 18, 3);
    ctx.fillRect(16, 98, 96, 2);
  }

  return setCached(key, canvas);
}

export function getParallaxCavernTile(
  stratumId: number,
  bgHex: string,
  wallBorderHex: string,
  accentHex: string,
  isLightMode = false
): HTMLCanvasElement {
  const key = `BG_CAVERN_${stratumId}_${bgHex}_${wallBorderHex}_${accentHex}_${isLightMode ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const W = 96;
  const H = 96;
  const [canvas, ctx] = createPixelCanvas(W, H);
  const bgRgb = hexToRgb(bgHex);
  const bdRgb = hexToRgb(wallBorderHex);
  const accRgb = hexToRgb(accentHex);

  for (let py = 0; py < H; py++) {
    const stratumWave = Math.sin(py * 0.14 + Math.cos(py * 0.05) * 1.8) * 0.08;
    for (let px = 0; px < W; px++) {
      const gx = px >> 2;
      const gy = py >> 2;
      const cellNoise = hash2D(gx % 24, gy % 24, stratumId * 53 + 7);
      const fineNoise = hash2D(px, py, stratumId * 199 + 3);
      const dither = bayerAt(px, py) * 0.08;
      let shift = stratumWave + dither + (cellNoise - 0.5) * 0.16;

      if (fineNoise > 0.93) shift += 0.14;
      else if (fineNoise < 0.07) shift -= 0.18;

      const brickRow = Math.floor(py / 12);
      const brickOffset = (brickRow % 2) * 12;
      const isMortar = py % 12 === 0 || (px + brickOffset) % 24 === 0;
      if (isMortar && cellNoise > 0.35) {
        shift -= isLightMode ? 0.16 : 0.28;
      }

      ctx.fillStyle = shadeRgb(mixRgbVal(bgRgb, bdRgb, 0.35), shift);
      ctx.fillRect(px, py, 1, 1);
    }
  }

  if (stratumId === 1) {
    ctx.fillStyle = shadeRgb(bgRgb, -0.35);
    ctx.fillRect(10, 0, 8, H);
    ctx.fillRect(74, 0, 6, H);
    ctx.fillStyle = shadeRgb(bdRgb, 0.2);
    ctx.fillRect(11, 0, 2, H);
    ctx.fillRect(75, 0, 1, H);

    ctx.fillStyle = '#09090B';
    ctx.fillRect(34, 24, 24, 20);
    ctx.fillStyle = shadeRgb(bdRgb, 0.25);
    ctx.fillRect(34, 24, 24, 1);
    ctx.fillRect(34, 43, 24, 1);
    for (let sy = 27; sy < 42; sy += 3) {
      ctx.fillStyle = shadeRgb(bdRgb, -0.15);
      ctx.fillRect(36, sy, 20, 2);
    }
    ctx.fillStyle = mixRgb(bgRgb, accRgb, 0.45);
    ctx.fillRect(62, 66, 3, 2);
    ctx.fillRect(24, 78, 2, 3);
  } else if (stratumId === 2) {
    const spireCol = mixRgb(bgRgb, accRgb, 0.35);
    const spireHi = mixRgb(bgRgb, [224, 242, 254], 0.4);
    for (const [sx, sy, sh] of [
      [18, 12, 26],
      [68, 46, 30],
    ]) {
      for (let i = 0; i < sh; i++) {
        const w = Math.max(1, Math.round((1 - i / sh) * 8));
        ctx.fillStyle = spireCol;
        ctx.fillRect(sx - w, sy + i, w * 2, 1);
        ctx.fillStyle = spireHi;
        ctx.fillRect(sx - w, sy + i, 1, 1);
      }
    }
  } else if (stratumId === 3) {
    ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
    for (let py = 0; py < H; py++) {
      const vx = Math.round(48 + Math.sin(py * 0.13) * 14);
      ctx.fillRect(vx - 1, py, 3, 1);
      if (py % 3 !== 0) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.45)';
        ctx.fillRect(vx, py, 1, 1);
        ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
      }
    }
  } else if (stratumId === 4) {
    ctx.strokeStyle = shadeRgb(bdRgb, 0.25);
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, 72, 72);
    ctx.fillStyle = '#040810';
    ctx.fillRect(36, 36, 24, 24);
    ctx.strokeStyle = 'rgba(163, 230, 53, 0.25)';
    ctx.strokeRect(38, 38, 20, 20);
  } else if (stratumId === 5) {
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(16, 16, 2, 64);
    ctx.fillRect(78, 16, 2, 64);
    ctx.fillRect(36, 32, 24, 2);
    ctx.fillRect(36, 62, 24, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(46, 44, 4, 8);
  } else if (stratumId === 6) {
    ctx.fillStyle = 'rgba(181, 142, 62, 0.25)';
    ctx.fillRect(12, 0, 8, H);
    ctx.fillRect(76, 0, 8, H);
    ctx.fillRect(28, 44, 40, 2);
  } else {
    ctx.fillStyle = 'rgba(244, 114, 182, 0.22)';
    ctx.fillRect(18, 14, 60, 2);
    ctx.fillRect(18, 80, 60, 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.26)';
    ctx.fillRect(46, 20, 4, 56);
    ctx.fillRect(24, 46, 48, 4);
  }

  return setCached(key, canvas);
}

export function getParallaxMidgroundScaffolding(
  stratumId: number,
  borderHex: string,
  accentHex: string,
  isLightMode = false
): HTMLCanvasElement {
  const key = `BG_MID216_${stratumId}_${borderHex}_${accentHex}_${isLightMode ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const W = 216;
  const H = 96;
  const [canvas, ctx] = createPixelCanvas(W, H);
  const bdRgb = hexToRgb(borderHex);

  const steelDark = isLightMode ? 'rgba(40,40,48,0.22)' : 'rgba(6,8,12,0.62)';
  const steelMid = isLightMode ? 'rgba(90,85,75,0.24)' : shadeRgb(bdRgb, -0.05);
  const steelHi = isLightMode ? 'rgba(181,142,62,0.38)' : shadeRgb(bdRgb, 0.35);

  // Horizontal steel I-beam girder
  ctx.fillStyle = steelDark;
  ctx.fillRect(0, 8, W, 8);
  ctx.fillStyle = steelMid;
  ctx.fillRect(0, 9, W, 5);
  ctx.fillStyle = steelHi;
  ctx.fillRect(0, 9, W, 1);
  for (let rx = 8; rx < W; rx += 16) {
    ctx.fillStyle = steelHi;
    ctx.fillRect(rx, 11, 2, 2);
  }

  // Twin vertical elevator guide rails
  for (const gx of [24, W - 29]) {
    ctx.fillStyle = steelDark;
    ctx.fillRect(gx, 0, 5, H);
    ctx.fillStyle = steelMid;
    ctx.fillRect(gx + 1, 0, 2, H);
    ctx.fillStyle = steelHi;
    ctx.fillRect(gx + 1, 0, 1, H);
    for (let gy = 4; gy < H; gy += 16) {
      ctx.fillStyle = steelDark;
      ctx.fillRect(gx - 1, gy, 7, 3);
    }
  }

  // Hanging pixel chains
  for (const cx of [58, W - 60]) {
    for (let cy = 16; cy < 64; cy += 4) {
      ctx.fillStyle = steelDark;
      ctx.fillRect(cx, cy, 2, 3);
      ctx.fillStyle = steelHi;
      ctx.fillRect(cx, cy, 1, 1);
    }
  }

  // Diagonal lattice truss segments
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = steelMid;
    ctx.fillRect(29 + i, 16 + i, 2, 2);
    ctx.fillRect(W - 31 - i, 16 + i, 2, 2);
  }

  // Central hanging lantern beacon
  ctx.fillStyle = steelDark;
  ctx.fillRect(W / 2 - 2, 16, 4, 8);
  ctx.fillStyle = accentHex;
  ctx.fillRect(W / 2 - 2, 24, 4, 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(W / 2 - 1, 25, 2, 1);

  return setCached(key, canvas);
}

export function getShaftWallStrip(
  wallBg: string,
  wallBorder: string,
  stratumId: number,
  animFrame = 0
): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `WALL20_${stratumId}_${wallBg}_${wallBorder}_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const W = 20;
  const H = 48;
  const [canvas, ctx] = createPixelCanvas(W, H);
  const bgRgb = hexToRgb(wallBg);
  const bdRgb = hexToRgb(wallBorder);

  for (let py = 0; py < H; py++) {
    const seam = py % 16 === 0;
    for (let px = 0; px < W; px++) {
      const n = hash2D(px, py, stratumId * 131 + 19);
      let s = seam ? -0.35 : bayerAt(px, py) * 0.12;
      if (n > 0.88) s += 0.16;
      else if (n < 0.12) s -= 0.2;
      ctx.fillStyle = px >= W - 2 ? mixRgb(bgRgb, bdRgb, 0.9) : shadeRgb(bgRgb, s);
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Industrial hazard chevrons & rivets
  ctx.fillStyle = shadeRgb(bdRgb, 0.38);
  for (let ry = 4; ry < H; ry += 16) {
    ctx.fillRect(2, ry, 2, 2);
    ctx.fillRect(2, ry + 8, 2, 2);
  }
  // Recessed plasma conduit groove
  ctx.fillStyle = '#09090B';
  ctx.fillRect(11, 0, 4, H);

  const pulseColor =
    stratumId === 3
      ? '#FB923C'
      : stratumId === 4
      ? '#A3E635'
      : stratumId === 6
      ? '#FACC15'
      : stratumId === 7
      ? '#F472B6'
      : '#38BDF8';
  const pulseY = (f * 12) % H;
  ctx.fillStyle = pulseColor;
  ctx.fillRect(12, pulseY, 2, 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(12, pulseY + 1, 2, 1);

  return setCached(key, canvas);
}

// ==================== 24x24 BIOME-SPECIFIC CONNECTED MINERAL BLOCKS ====================

function drawEmbeddedColorSymbol(
  ctx: CanvasRenderingContext2D,
  colorIdx: number,
  ramp: HueShiftedRamp
): void {
  if (colorIdx < 0) return;
  const sym = COLOR_SYMBOLS[colorIdx % COLOR_SYMBOLS.length];
  const mask: string[] =
    sym === 'CIRCLE'
      ? ['0011100', '0100010', '1000001', '1000001', '1000001', '0100010', '0011100']
      : sym === 'DIAGONALS'
      ? ['1100000', '0110000', '0011000', '1001100', '0100110', '0010011', '0001001']
      : sym === 'CHEVRON'
      ? ['0001000', '0010100', '0100010', '1000001', '0100010', '0000000', '0000000']
      : sym === 'CROSS'
      ? ['0001000', '0001000', '0001000', '1111111', '0001000', '0001000', '0001000']
      : ['1111111', '1000001', '1001001', '1011101', '1001001', '1000001', '1111111'];

  const ox = 8;
  const oy = 8;
  // Chiseled emboss: dark 1px shadow at (x, y-1), bright inner rim at (x, y+1)
  ctx.fillStyle = ramp.dark;
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      if (mask[y][x] === '1') {
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
  ctx.fillStyle = ramp.light;
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      if (mask[y][x] === '1' && y + 1 < 7 && mask[y + 1][x] === '0') {
        ctx.fillRect(ox + x, oy + y + 1, 1, 1);
      }
    }
  }
}

export function getMineralBlockSprite(
  stratumId: number,
  colorHex: string,
  colorIdx: number,
  variant: number,
  joinMask: number, // bitmask: 1=top, 2=right, 4=bottom, 8=left
  isLightMode = false
): HTMLCanvasElement {
  const key = `MIN24_${stratumId}_${colorHex}_${colorIdx}_${variant}_${joinMask}_${isLightMode ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  const ramp = buildHueShiftedRamp(colorHex);
  const seed = stratumId * 97 + variant * 31 + ramp.midRgb[0];

  const joinTop = (joinMask & 1) !== 0;
  const joinRight = (joinMask & 2) !== 0;
  const joinBottom = (joinMask & 4) !== 0;
  const joinLeft = (joinMask & 8) !== 0;

  for (let py = 0; py < TILE_PX; py++) {
    for (let px = 0; px < TILE_PX; px++) {
      const b = bayerAt(px, py);
      const n = hash2D(px, py, seed);
      let col = ramp.mid;

      if (stratumId === 1) {
        // Layered industrial masonry courses with chipped surface
        const course = py % 8 === 0 || (px + (Math.floor(py / 8) % 2) * 12) % 24 === 0;
        if (course && py > 2 && py < 21) col = ramp.dark;
        else if (py < 6 + b * 4) col = ramp.light;
        else if (py > 18 + b * 4) col = ramp.dark;
        else if (n > 0.92) col = ramp.light;
        else if (n < 0.09) col = ramp.dark;
      } else if (stratumId === 2) {
        // Faceted crystalline glacial slab
        const diag = px + py;
        if (diag < 14 + b * 3 || Math.abs(px - py - 6) <= 1) col = ramp.light;
        else if (diag > 32 + b * 3) col = ramp.dark;
        else if (px - py === 4) col = ramp.specular;
      } else if (stratumId === 3) {
        // Kiln-fired ceramic hexagonal/interlocking bricks
        const seam = py % 6 === 0 || (px + (Math.floor(py / 6) % 2) * 6) % 12 === 0;
        if (seam && py > 2 && py < 21) col = ramp.dark;
        else if (py < 8 + b * 3) col = ramp.light;
        else if (py > 19) col = ramp.dark;
      } else if (stratumId === 4) {
        // Bolted bathysphere hull plate
        const groove = px === 4 || px === 19 || py === 4 || py === 19;
        if (groove) col = ramp.dark;
        else if (py < 9 + b * 2) col = ramp.light;
        else if (py > 16 + b * 2) col = ramp.dark;
      } else if (stratumId === 5) {
        // Quantum monolith scan-facets
        const scan = py % 4 === 0 && b > 0;
        if (scan) col = ramp.dark;
        else if (px + py < 18) col = ramp.light;
        else if (px + py > 30) col = ramp.dark;
      } else if (stratumId === 6) {
        // Stratum VI carved alabaster temple block
        const inner = px === 3 || px === 20 || py === 3 || py === 20;
        if (inner) col = '#B58E3E';
        else if (py < 9 + b * 3) col = ramp.light;
        else if (py > 16 + b * 3) col = ramp.dark;
      } else {
        // Stratum VII Event Horizon fractured gold-violet prism stone
        const diag = Math.abs(px - py) <= 1 || px + py === 23;
        if (diag && b > 0) col = ramp.specular;
        else if (px < 10 && py < 10) col = ramp.light;
        else if (px > 14 && py > 14) col = ramp.dark;
      }

      ctx.fillStyle = col;
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Sedimentary mineral vein crack
  const crackY = 5 + (variant % 3) * 2;
  ctx.fillStyle = ramp.dark;
  for (let i = 0; i < 6; i++) {
    const cx = 4 + i * 2;
    const cy = Math.max(3, Math.min(20, crackY + ((i + variant) % 3) - 1));
    ctx.fillRect(cx, cy, 1, 1);
    if (i % 2 === 0) {
      ctx.fillStyle = ramp.light;
      ctx.fillRect(cx, cy + 1, 1, 1);
      ctx.fillStyle = ramp.dark;
    }
  }

  // Embedded pixel-art colorblind symbol
  drawEmbeddedColorSymbol(ctx, colorIdx, ramp);

  // Exposed-edge bevels & 1px crisp dark outline (16-state seamless connected textures)
  ctx.fillStyle = ramp.light;
  if (!joinTop) ctx.fillRect(1, 1, TILE_PX - 2, 2);
  if (!joinLeft) ctx.fillRect(1, 1, 2, TILE_PX - 2);

  ctx.fillStyle = ramp.dark;
  if (!joinBottom) ctx.fillRect(1, TILE_PX - 3, TILE_PX - 2, 2);
  if (!joinRight) ctx.fillRect(TILE_PX - 3, 1, 2, TILE_PX - 2);

  ctx.fillStyle = isLightMode ? ramp.dark : ramp.outline;
  if (!joinTop) ctx.fillRect(0, 0, TILE_PX, 1);
  if (!joinLeft) ctx.fillRect(0, 0, 1, TILE_PX);
  if (!joinBottom) ctx.fillRect(0, TILE_PX - 1, TILE_PX, 1);
  if (!joinRight) ctx.fillRect(TILE_PX - 1, 0, 1, TILE_PX);

  // Specular glint on exposed top-left corner
  if (!joinTop && !joinLeft) {
    ctx.fillStyle = ramp.specular;
    ctx.fillRect(1, 1, 4, 1);
    ctx.fillRect(1, 1, 1, 4);
    if (stratumId === 1 || stratumId === 4) {
      // Corner industrial rivet
      ctx.fillStyle = ramp.dark;
      ctx.fillRect(3, 3, 2, 2);
      ctx.fillStyle = ramp.specular;
      ctx.fillRect(3, 3, 1, 1);
    }
  }

  // Connected energy bridge across merged borders
  ctx.fillStyle = ramp.light;
  if (joinRight) ctx.fillRect(TILE_PX - 2, 11, 2, 2);
  if (joinBottom) ctx.fillRect(11, TILE_PX - 2, 2, 2);

  return setCached(key, canvas);
}

// ==================== 24x24 ANIMATED SPECIAL BLOCKS ====================

export function getSlagBlockSprite(
  slagColor: string,
  hp: number,
  isVolatile: boolean,
  variant: number,
  animFrame = 0,
  hitFlash = false
): HTMLCanvasElement {
  const clampedHp = Math.max(1, Math.min(5, hp));
  const f = animFrame & 3;
  const key = `SLAG24_${slagColor}_${clampedHp}_${isVolatile ? 1 : 0}_${variant}_${f}_${hitFlash ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  if (hitFlash) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(3, 3, TILE_PX - 6, TILE_PX - 6);
    return setCached(key, canvas);
  }

  const ramp = buildHueShiftedRamp(isVolatile ? '#233617' : slagColor);
  const seed = 701 + variant * 17;

  for (let py = 0; py < TILE_PX; py++) {
    for (let px = 0; px < TILE_PX; px++) {
      const n = hash2D(px, py, seed);
      const b = bayerAt(px, py);
      if (py === 0 || px === 0 || py === TILE_PX - 1 || px === TILE_PX - 1) {
        ctx.fillStyle = '#09090B';
      } else if (n > 0.86 || (py < 4 && b > 0)) {
        ctx.fillStyle = ramp.light;
      } else if (n < 0.18 || py > 19) {
        ctx.fillStyle = ramp.dark;
      } else {
        ctx.fillStyle = ramp.mid;
      }
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Crust highlight rim
  ctx.fillStyle = isVolatile ? '#84CC16' : ramp.light;
  ctx.fillRect(1, 1, TILE_PX - 2, 1);
  ctx.fillRect(1, 1, 1, TILE_PX - 2);

  // Flowing magma / acid veins across obsidian boulder
  const veinOuter = isVolatile ? '#4D7C0F' : '#C2410C';
  const veinMid = isVolatile ? '#A3E635' : '#FB923C';
  const veinHot = isVolatile ? '#ECFCCB' : '#FEF08A';
  const pts: [number, number][] = [
    [3, 19], [4, 18], [5, 17], [6, 16], [7, 15], [8, 14], [9, 14], [10, 13],
    [11, 12], [12, 11], [13, 10], [14, 9], [15, 8], [16, 7], [17, 7], [18, 6], [19, 5],
    [10, 15], [11, 16], [12, 17], [13, 18],
  ];
  const dmg = 5 - clampedHp;
  for (let i = 0; i < pts.length; i++) {
    const [vx, vy] = pts[i];
    ctx.fillStyle = veinOuter;
    ctx.fillRect(vx - 1, vy, 3, 1);
    ctx.fillRect(vx, vy - 1, 1, 3);
  }
  for (let i = 0; i < pts.length; i++) {
    const [vx, vy] = pts[i];
    const pulse = (i + f) % 4 === 0 || dmg >= 2;
    ctx.fillStyle = pulse ? veinHot : veinMid;
    ctx.fillRect(vx, vy, 1, 1);
  }

  // Progressive fracture damage cracks
  if (dmg > 0) {
    ctx.fillStyle = '#09090B';
    for (let k = 0; k < dmg; k++) {
      ctx.fillRect(4 + k * 4, 4 + (k % 2) * 2, 3, 2);
      ctx.fillRect(5 + k * 4, 6 + (k % 2) * 2, 2, 3);
    }
  }

  return setCached(key, canvas);
}

export function getRivetBlockSprite(variant: number, animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `RIVET24_${variant}_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  const ramp = buildHueShiftedRamp('#3B4252');

  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = ramp.mid;
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);
  ctx.fillStyle = ramp.light;
  ctx.fillRect(1, 1, TILE_PX - 2, 2);
  ctx.fillRect(1, 1, 2, TILE_PX - 2);
  ctx.fillStyle = ramp.dark;
  ctx.fillRect(1, TILE_PX - 3, TILE_PX - 2, 2);
  ctx.fillRect(TILE_PX - 3, 1, 2, TILE_PX - 2);

  // Diagonal structural cross-brace
  for (let i = 3; i < 21; i++) {
    ctx.fillStyle = ramp.dark;
    ctx.fillRect(i, i, 2, 2);
    ctx.fillRect(i, 22 - i, 2, 2);
  }

  // Inner plate
  ctx.fillStyle = ramp.outline;
  ctx.fillRect(5, 5, 14, 14);
  ctx.fillStyle = ramp.mid;
  ctx.fillRect(6, 6, 12, 12);

  // 4 Heavy corner rivets
  for (const [rx, ry] of [
    [3, 3],
    [19, 3],
    [3, 19],
    [19, 19],
  ]) {
    ctx.fillStyle = '#09090B';
    ctx.fillRect(rx - 1, ry - 1, 4, 4);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(rx, ry, 2, 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rx, ry, 1, 1);
  }

  // Pulsing status core LED
  ctx.fillStyle = f % 2 === 0 ? '#F59E0B' : '#38BDF8';
  ctx.fillRect(10, 10, 4, 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(11, 11, 2, 2);

  return setCached(key, canvas);
}

export function getCrystalBlockSprite(
  colorHex: string,
  colorIdx: number,
  triggered: boolean,
  animFrame = 0
): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `CRYS24_${colorHex}_${colorIdx}_${triggered ? 1 : 0}_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  const ramp = buildHueShiftedRamp(colorHex);
  const glintOffset = f * 6;

  for (let py = 0; py < TILE_PX; py++) {
    for (let px = 0; px < TILE_PX; px++) {
      if (px === 0 || py === 0 || px === TILE_PX - 1 || py === TILE_PX - 1) {
        ctx.fillStyle = ramp.outline;
      } else {
        const facet = px + py < 23 ? ramp.light : ramp.mid;
        const shine = Math.abs((px + py) - (10 + glintOffset)) <= 1 ? ramp.specular : facet;
        ctx.fillStyle = px > 17 && py > 17 ? ramp.dark : shine;
      }
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Crisp crystal bevel edge & specular shard
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(1, 1, TILE_PX - 2, 1);
  ctx.fillRect(1, 1, 1, TILE_PX - 2);
  ctx.fillRect(3, 3, 4, 1);
  ctx.fillRect(3, 3, 1, 4);

  drawEmbeddedColorSymbol(ctx, colorIdx, ramp);

  if (triggered) {
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(4, 6, 16, 1);
    ctx.fillRect(8, 11, 10, 1);
    ctx.fillRect(5, 16, 12, 1);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(11, 6, 2, 11);
  }

  return setCached(key, canvas);
}

export function getConductorBlockSprite(animFrame = 0, hitFlash = false): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `COND24_${f}_${hitFlash ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  if (hitFlash) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);
    return setCached(key, canvas);
  }

  // Basalt housing + dark outline
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#2A120A';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);
  ctx.fillStyle = '#7C2D12';
  ctx.fillRect(1, 1, TILE_PX - 2, 2);
  ctx.fillRect(1, 1, 2, TILE_PX - 2);

  // Copper coil frame
  ctx.fillStyle = f % 2 === 0 ? '#F97316' : '#FB923C';
  ctx.fillRect(3, 3, 18, 2);
  ctx.fillRect(3, 19, 18, 2);
  ctx.fillRect(3, 3, 2, 18);
  ctx.fillRect(19, 3, 2, 18);

  // Cardinal gold busbar pins
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(10, 0, 4, 5);
  ctx.fillRect(10, 19, 4, 5);
  ctx.fillRect(0, 10, 5, 4);
  ctx.fillRect(19, 10, 5, 4);
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(11, 1, 2, 2);
  ctx.fillRect(11, 21, 2, 2);

  // Animated crackling plasma arc core
  ctx.fillStyle = '#180B06';
  ctx.fillRect(6, 6, 12, 12);
  ctx.fillStyle = '#F97316';
  const r = f === 1 || f === 2 ? 4 : 3;
  ctx.fillRect(12 - r, 12 - r, r * 2, r * 2);
  ctx.fillStyle = f % 2 === 0 ? '#FFFFFF' : '#FEF08A';
  ctx.fillRect(10, 10, 4, 4);
  // Animated arc spark
  ctx.fillStyle = '#FEF08A';
  if (f === 0) ctx.fillRect(7, 8, 2, 2);
  else if (f === 1) ctx.fillRect(15, 8, 2, 2);
  else if (f === 2) ctx.fillRect(15, 15, 2, 2);
  else ctx.fillRect(7, 15, 2, 2);

  return setCached(key, canvas);
}

export function getPhaseBlockSprite(
  colorHex: string,
  altColorHex: string,
  colorIdx: number,
  warning: boolean,
  animFrame = 0
): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `PHASE24_${colorHex}_${altColorHex}_${colorIdx}_${warning ? 1 : 0}_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  const rampA = buildHueShiftedRamp(colorHex);
  const rampB = buildHueShiftedRamp(altColorHex);

  for (let py = 0; py < TILE_PX; py++) {
    for (let px = 0; px < TILE_PX; px++) {
      if (px === 0 || py === 0 || px === TILE_PX - 1 || py === TILE_PX - 1) {
        ctx.fillStyle = rampA.outline;
        ctx.fillRect(px, py, 1, 1);
        continue;
      }
      const inAltCorner = px + (23 - py) < 11;
      const onSplit = Math.abs(px + (23 - py) - 11) <= 1;
      if (onSplit) {
        ctx.fillStyle = (px + py + f) % 2 === 0 ? '#FFFFFF' : rampB.light;
      } else if (inAltCorner) {
        ctx.fillStyle = px < 5 && py > 18 ? rampB.light : rampB.mid;
      } else {
        const b = bayerAt(px, py);
        ctx.fillStyle = py < 7 + b * 2 ? rampA.light : py > 17 + b * 2 ? rampA.dark : rampA.mid;
      }
      ctx.fillRect(px, py, 1, 1);
    }
  }

  drawEmbeddedColorSymbol(ctx, colorIdx, rampA);

  if (warning && f % 2 === 0) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(1, 1, TILE_PX - 2, 1);
    ctx.fillRect(1, TILE_PX - 2, TILE_PX - 2, 1);
    ctx.fillRect(1, 1, 1, TILE_PX - 2);
    ctx.fillRect(TILE_PX - 2, 1, 1, TILE_PX - 2);
  }

  return setCached(key, canvas);
}

export function getOxygenPodSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `O2_24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);

  // Crisp 1px dark silhouette
  ctx.fillStyle = '#09090B';
  ctx.fillRect(5, 1, 14, 22);
  ctx.fillRect(3, 5, 18, 14);

  // Titanium top & bottom caps with specular
  ctx.fillStyle = '#475569';
  ctx.fillRect(6, 2, 12, 3);
  ctx.fillRect(6, 19, 12, 3);
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(6, 2, 12, 1);
  ctx.fillRect(6, 19, 12, 1);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(7, 2, 4, 1);

  // Glass cryo-chamber body
  for (let py = 5; py < 19; py++) {
    for (let px = 4; px < 20; px++) {
      ctx.fillStyle =
        px === 4 || px === 19
          ? '#0284C7'
          : px < 9
          ? '#38BDF8'
          : px < 15
          ? '#0EA5E9'
          : '#0369A1';
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Animated rising cryo bubbles
  const b1 = 16 - ((f * 3) % 10);
  const b2 = 16 - (((f * 3) + 5) % 10);
  ctx.fillStyle = '#E0F2FE';
  ctx.fillRect(8, b1, 3, 3);
  ctx.fillRect(14, b2, 2, 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(8, b1, 1, 1);

  // Glass specular highlight + blinking status LED
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(6, 6, 2, 8);
  ctx.fillStyle = f % 2 === 0 ? '#A3E635' : '#38BDF8';
  ctx.fillRect(15, 2, 2, 2);

  return setCached(key, canvas);
}

export function getGeodeBlockSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `GEODE24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  const shell = buildHueShiftedRamp('#312E42');

  // Cracked basalt shell
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  for (let py = 1; py < TILE_PX - 1; py++) {
    for (let px = 1; px < TILE_PX - 1; px++) {
      const d = Math.hypot(px - 11.5, py - 11.5);
      if (d < 7.5) {
        ctx.fillStyle = '#1E1028';
      } else {
        const b = bayerAt(px, py);
        ctx.fillStyle = py < 7 + b * 2 ? shell.light : py > 17 ? shell.dark : shell.mid;
      }
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Inner shimmering golden & magenta crystal spires
  const spires: [number, number, number, string, string][] = [
    [8, 12, 5, '#FACC15', '#FEF08A'],
    [12, 8, 6, '#F472B6', '#FBCFE8'],
    [15, 13, 4, '#FACC15', '#FFFFFF'],
  ];
  for (const [sx, sy, sh, mid, hi] of spires) {
    for (let i = 0; i < sh; i++) {
      ctx.fillStyle = i < 2 ? hi : mid;
      ctx.fillRect(sx - (i >> 1), sy + i, 2 + (i >> 1), 1);
    }
  }

  // Animated 4-frame twinkle cross sparkle
  const sparkCoords: [number, number][] = [
    [7, 7],
    [16, 7],
    [16, 15],
    [8, 16],
  ];
  const [kx, ky] = sparkCoords[f];
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(kx - 1, ky, 3, 1);
  ctx.fillRect(kx, ky - 1, 1, 3);

  return setCached(key, canvas);
}

export function getCryoVentBlockSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `CRYO24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  const ramp = buildHueShiftedRamp('#164E63');

  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = ramp.mid;
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);
  ctx.fillStyle = '#67E8F9';
  ctx.fillRect(1, 1, TILE_PX - 2, 2);
  ctx.fillRect(1, 1, 2, TILE_PX - 2);

  // Dark circular turbine shroud
  ctx.fillStyle = '#082F49';
  ctx.fillRect(5, 5, 14, 14);

  // Rotating 4-frame turbine blades
  ctx.fillStyle = '#A5F3FC';
  if (f % 2 === 0) {
    ctx.fillRect(6, 11, 12, 2);
    ctx.fillRect(11, 6, 2, 12);
  } else {
    for (let i = -5; i <= 5; i++) {
      ctx.fillRect(11 + i, 11 + i, 2, 2);
      ctx.fillRect(11 + i, 11 - i, 2, 2);
    }
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(10, 10, 4, 4);

  // Frost icicles along top rim
  ctx.fillStyle = '#E0F2FE';
  ctx.fillRect(4, 2, 2, 3);
  ctx.fillRect(10, 2, 3, 2);
  ctx.fillRect(17, 2, 2, 3);

  return setCached(key, canvas);
}

export function getMagmaNodeBlockSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `MAGMA24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#3B0D16';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);

  // Concentric pulsing magma pressure rings
  const ringR = 5 + (f % 2) * 2;
  for (let py = 2; py < 22; py++) {
    for (let px = 2; px < 22; px++) {
      const d = Math.hypot(px - 11.5, py - 11.5);
      if (d < 3.2) ctx.fillStyle = '#FFFFFF';
      else if (d < ringR) ctx.fillStyle = '#FB923C';
      else if (d < ringR + 2.5) ctx.fillStyle = '#F43F5E';
      else continue;
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Dark iron cage bars over core
  ctx.fillStyle = '#18181B';
  ctx.fillRect(1, 11, 4, 2);
  ctx.fillRect(19, 11, 4, 2);
  ctx.fillRect(11, 1, 2, 4);
  ctx.fillRect(11, 19, 2, 4);

  return setCached(key, canvas);
}

export function getGravelBlockSprite(variant = 0): HTMLCanvasElement {
  const v = variant & 3;
  const key = `GRAVEL24_${v}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#451A03';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);

  const pebbles = [
    [2, 2, 7, 6, '#B45309', '#F59E0B'],
    [10, 2, 6, 5, '#92400E', '#FBBF24'],
    [16, 3, 6, 7, '#78350F', '#D97706'],
    [3, 9, 8, 6, '#78350F', '#F59E0B'],
    [12, 8, 6, 7, '#B45309', '#FDE68A'],
    [18, 11, 4, 5, '#92400E', '#D97706'],
    [2, 16, 6, 6, '#92400E', '#D97706'],
    [9, 16, 7, 6, '#B45309', '#F59E0B'],
    [17, 16, 5, 6, '#78350F', '#B45309'],
  ] as const;

  for (let i = 0; i < pebbles.length; i++) {
    const [px, py, pw, ph, mid, hi] = pebbles[i];
    const ox = ((i + v) % 3) - 1;
    const x = Math.max(1, Math.min(TILE_PX - pw - 1, px + ox));
    ctx.fillStyle = mid;
    ctx.fillRect(x, py, pw, ph);
    ctx.fillStyle = hi;
    ctx.fillRect(x, py, pw - 1, 1);
    ctx.fillRect(x, py, 1, ph - 1);
    ctx.fillStyle = '#291002';
    ctx.fillRect(x, py + ph - 1, pw, 1);
  }

  return setCached(key, canvas);
}

export function getBouncePadBlockSprite(animFrame = 0, activeBounce = false): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `BOUNCE24_${f}_${activeBounce ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);

  // Steel base plate
  ctx.fillStyle = '#334155';
  ctx.fillRect(2, 17, 20, 5);
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(2, 17, 20, 1);

  // Coiled titanium spring
  const compY = activeBounce ? 2 : f === 1 ? 1 : 0;
  ctx.fillStyle = '#64748B';
  ctx.fillRect(6, 10 + compY, 12, 7 - compY);
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(6, 11 + compY, 12, 1);
  ctx.fillRect(6, 14 + Math.min(2, compY), 12, 1);

  // Glowing cyan top bumper pad + upward chevron
  const topY = 3 + compY;
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(2, topY, 20, 6);
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(2, topY, 20, 3);
  ctx.fillStyle = '#E0F2FE';
  ctx.fillRect(3, topY, 18, 1);

  ctx.fillStyle = f % 2 === 0 || activeBounce ? '#FFFFFF' : '#7DD3FC';
  ctx.fillRect(11, topY + 2, 2, 2);
  ctx.fillRect(9, topY + 3, 2, 1);
  ctx.fillRect(13, topY + 3, 2, 1);

  return setCached(key, canvas);
}

export function getGasPocketBlockSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `GAS24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#1A2E05';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);

  // Bubbling translucent slime membrane
  for (let py = 2; py < 22; py++) {
    for (let px = 2; px < 22; px++) {
      const b = bayerAt(px + f, py);
      const d = Math.hypot(px - 11.5, py - 11.5);
      if (d < 8.5 + (f % 2)) {
        ctx.fillStyle = d < 4.2 ? '#BEF264' : b > 0 ? '#65A30D' : '#3F6212';
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
  // Animated rising bubbles
  const bY1 = 15 - f * 2;
  const bY2 = 12 - ((f + 2) & 3) * 2;
  ctx.fillStyle = '#ECFCCB';
  ctx.fillRect(7, bY1, 3, 3);
  ctx.fillRect(14, bY2, 2, 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(7, bY1, 1, 1);

  return setCached(key, canvas);
}

export function getAcidVatBlockSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `ACID24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);

  // Glass tank interior filled with glowing green acid
  ctx.fillStyle = '#14532D';
  ctx.fillRect(4, 3, 16, 18);
  const surfY = 7 + (f % 2);
  ctx.fillStyle = '#22C55E';
  ctx.fillRect(4, surfY, 16, 21 - surfY);
  ctx.fillStyle = '#4ADE80';
  ctx.fillRect(4, surfY, 16, 2);
  ctx.fillStyle = '#BBF7D0';
  ctx.fillRect(5 + f * 3, surfY + 1, 3, 1);

  // Tank brackets & warning stripe
  ctx.fillStyle = '#64748B';
  ctx.fillRect(2, 2, 20, 2);
  ctx.fillRect(2, 20, 20, 2);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(4, 20, 4, 2);
  ctx.fillRect(12, 20, 4, 2);

  return setCached(key, canvas);
}

export function getGravWellBlockSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `GRAV24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#1E1B4B';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);

  const ringR = 8 - f;
  for (let py = 2; py < 22; py++) {
    for (let px = 2; px < 22; px++) {
      const d = Math.hypot(px - 11.5, py - 11.5);
      if (d < 3) {
        ctx.fillStyle = '#020617';
        ctx.fillRect(px, py, 1, 1);
      } else if (Math.abs(d - ringR) < 1.1) {
        ctx.fillStyle = '#E879F9';
        ctx.fillRect(px, py, 1, 1);
      } else if (Math.abs(d - 5.5) < 0.9) {
        ctx.fillStyle = '#A855F7';
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(11, 11, 2, 2);

  return setCached(key, canvas);
}

export function getShockMineBlockSprite(animFrame = 0, armed = false): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `MINE24_${f}_${armed ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = armed ? '#3F1D24' : '#18181B';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);

  // Corner brass spikes
  ctx.fillStyle = '#94A3B8';
  for (const [sx, sy] of [
    [3, 3],
    [19, 3],
    [3, 19],
    [19, 19],
  ]) {
    ctx.fillRect(sx, sy, 2, 2);
  }

  // Mine octo chassis
  ctx.fillStyle = '#334155';
  ctx.fillRect(6, 6, 12, 12);
  ctx.fillStyle = '#475569';
  ctx.fillRect(5, 8, 14, 8);
  ctx.fillRect(8, 5, 8, 14);

  // Pulsing warning light
  const lit = armed ? (f % 2 === 0 ? '#FFFFFF' : '#E11D48') : f === 0 ? '#FACC15' : '#A16207';
  ctx.fillStyle = lit;
  ctx.fillRect(9, 9, 6, 6);
  if (armed) {
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(10, 10, 4, 4);
  }

  return setCached(key, canvas);
}

export function getTreasureCacheBlockSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `CACHE24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#451A03';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);

  // Ornate gold & steel expedition chest
  ctx.fillStyle = '#D97706';
  ctx.fillRect(2, 4, 20, 16);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(2, 3, 20, 3);
  ctx.fillRect(2, 18, 20, 2);
  ctx.fillRect(2, 4, 2, 15);
  ctx.fillRect(20, 4, 2, 15);

  // Center lock clasp + sparkling cyan/gold core
  ctx.fillStyle = '#18181B';
  ctx.fillRect(2, 10, 20, 2);
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(9, 8, 6, 6);
  ctx.fillStyle = f % 2 === 0 ? '#38BDF8' : '#FFFFFF';
  ctx.fillRect(11, 10, 2, 2);

  // Shimmer sweep
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(4 + f * 4, 4, 2, 1);

  return setCached(key, canvas);
}

export function getIgnitingBlockSprite(
  colorHex: string,
  chainLevel: number,
  animFrame = 0
): HTMLCanvasElement {
  const f = animFrame & 3;
  const tier = Math.min(4, Math.max(1, chainLevel));
  const key = `IGNITE24_${colorHex}_${tier}_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  const ramp = buildHueShiftedRamp(colorHex);

  for (let py = 0; py < TILE_PX; py++) {
    for (let px = 0; px < TILE_PX; px++) {
      const dist = Math.abs(px - 11.5) + Math.abs(py - 11.5);
      const crackle = ((px + py + f * 3) & 3) === 0;
      if (dist < 4 + (f % 2) + tier) {
        ctx.fillStyle = '#FFFFFF';
      } else if (dist < 9 + (f & 1) + tier) {
        ctx.fillStyle = crackle ? '#FEF08A' : ramp.specular;
      } else {
        ctx.fillStyle = crackle ? ramp.light : ramp.mid;
      }
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Boiling white-hot plasma outline
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, TILE_PX, 1);
  ctx.fillRect(0, TILE_PX - 1, TILE_PX, 1);
  ctx.fillRect(0, 0, 1, TILE_PX);
  ctx.fillRect(TILE_PX - 1, 0, 1, TILE_PX);

  // Orbiting corner sparks
  ctx.fillStyle = '#FEF08A';
  if (f % 2 === 0) {
    ctx.fillRect(2, 2, 3, 3);
    ctx.fillRect(19, 19, 3, 3);
  } else {
    ctx.fillRect(19, 2, 3, 3);
    ctx.fillRect(2, 19, 3, 3);
  }

  return setCached(key, canvas);
}

export function getMonolithBlockSprite(accentHex: string, animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `MONO24_${accentHex}_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#18181F';
  ctx.fillRect(2, 2, TILE_PX - 4, TILE_PX - 4);
  ctx.fillStyle = accentHex;
  ctx.fillRect(3, 3, TILE_PX - 6, 1);
  ctx.fillRect(3, TILE_PX - 4, TILE_PX - 6, 1);
  ctx.fillRect(3, 3, 1, TILE_PX - 6);
  ctx.fillRect(TILE_PX - 4, 3, 1, TILE_PX - 6);

  // Central pulsing ancient glyph pillar
  ctx.fillStyle = f % 2 === 0 ? '#FFFFFF' : accentHex;
  ctx.fillRect(10, 6, 4, 12);
  ctx.fillRect(8, 10, 8, 4);

  return setCached(key, canvas);
}

export function getPhaseKeyBlockSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `PKEY24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(2, 2, 20, 20);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(3, 3, 18, 18);
  ctx.fillStyle = f % 2 === 0 ? '#38BDF8' : '#FACC15';
  ctx.fillRect(6, 6, 12, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(9, 9, 6, 6);
  // Key notches
  ctx.fillStyle = '#09090B';
  ctx.fillRect(11, 6, 2, 3);
  ctx.fillRect(11, 15, 2, 3);
  return setCached(key, canvas);
}

export function getGhostEchoBlockSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `ECHO24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = 'rgba(224, 242, 254, 0.22)';
  ctx.fillRect(2, 2, 20, 20);
  ctx.fillStyle = f % 2 === 0 ? '#E2E8F0' : '#38BDF8';
  for (let i = 2; i < 22; i += 4) {
    ctx.fillRect(i, 2, 2, 1);
    ctx.fillRect(i, 21, 2, 1);
    ctx.fillRect(2, i, 1, 2);
    ctx.fillRect(21, i, 1, 2);
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(9, 7, 6, 8);
  ctx.fillRect(8, 9, 8, 4);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(10, 10, 1, 2);
  ctx.fillRect(13, 10, 1, 2);
  return setCached(key, canvas);
}

export function getSealGateSprite(
  accentHex: string,
  isBifurcation: boolean,
  animFrame = 0
): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `SEAL24_${accentHex}_${isBifurcation ? 1 : 0}_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = isBifurcation ? 'rgba(251, 191, 36, 0.25)' : 'rgba(56, 189, 248, 0.26)';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);
  ctx.fillStyle = accentHex;
  ctx.fillRect(1, 1, TILE_PX - 2, 2);
  ctx.fillRect(1, TILE_PX - 3, TILE_PX - 2, 2);

  // Horizontal scanning laser bar
  const scanY = 4 + ((f * 4) % 14);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(2, scanY, TILE_PX - 4, 2);

  return setCached(key, canvas);
}

export function getExtractionTubeSprite(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `EXT_TUBE24_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#052E16';
  ctx.fillRect(2, 1, 20, 22);
  ctx.fillStyle = '#A3E635';
  ctx.fillRect(2, 1, 20, 2);
  ctx.fillRect(2, 21, 20, 2);
  ctx.fillRect(2, 1, 2, 22);
  ctx.fillRect(20, 1, 2, 22);

  const offset = (3 - f) * 3;
  for (let row = 0; row < 2; row++) {
    const cy = ((5 + row * 9 + offset) % 14) + 4;
    ctx.fillStyle = row === 0 ? '#ECFCCB' : '#84CC16';
    ctx.fillRect(11, cy, 2, 2);
    ctx.fillRect(9, cy + 2, 2, 1);
    ctx.fillRect(13, cy + 2, 2, 1);
    ctx.fillRect(7, cy + 3, 2, 1);
    ctx.fillRect(15, cy + 3, 2, 1);
  }

  return setCached(key, canvas);
}

// ==================== BESPOKE PIXEL-ART BOSS SPRITES ====================

export function getLoomAnchorSprite(animFrame = 0, hitFlash = false): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `LOOM24_${f}_${hitFlash ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  if (hitFlash) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(2, 2, 20, 20);
    return setCached(key, canvas);
  }

  ctx.fillStyle = '#09090B';
  ctx.fillRect(2, 2, 20, 20);
  ctx.fillStyle = '#475569';
  ctx.fillRect(3, 3, 18, 18);
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(3, 3, 18, 2);
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(6, 6, 12, 12);

  // Rotating plasma core
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(8, 8, 8, 8);
  ctx.fillStyle = f % 2 === 0 ? '#FFFFFF' : '#FEF08A';
  ctx.fillRect(10, 10, 4, 4);
  if (f === 0 || f === 2) {
    ctx.fillRect(7, 11, 10, 2);
  } else {
    ctx.fillRect(11, 7, 2, 10);
  }

  return setCached(key, canvas);
}

export function getPendulumBossSprite(
  hpRatio: number,
  animFrame = 0,
  hitFlash = false
): HTMLCanvasElement {
  const f = animFrame & 3;
  const hpBand = Math.max(1, Math.ceil(hpRatio * 4));
  const key = `PEND64_${hpBand}_${f}_${hitFlash ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const S = 64;
  const [canvas, ctx] = createPixelCanvas(S, S);
  if (hitFlash) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(4, 4, S - 8, S - 8);
    return setCached(key, canvas);
  }

  const crimson = buildHueShiftedRamp('#E11D48');

  // Heavy outer armored silhouette
  ctx.fillStyle = '#09090B';
  ctx.fillRect(4, 4, 56, 56);
  ctx.fillRect(2, 12, 60, 40);

  // Armored beveled body
  for (let py = 6; py < 58; py++) {
    for (let px = 6; px < 58; px++) {
      const b = bayerAt(px, py);
      ctx.fillStyle = py < 14 + b * 3 ? crimson.light : py > 46 + b * 3 ? crimson.dark : crimson.mid;
      ctx.fillRect(px, py, 1, 1);
    }
  }

  // Steel top yoke & side thruster vents
  ctx.fillStyle = '#475569';
  ctx.fillRect(18, 4, 28, 6);
  ctx.fillStyle = '#94A3B8';
  ctx.fillRect(20, 5, 24, 2);
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(2, 20, 4, 24);
  ctx.fillRect(58, 20, 4, 24);
  ctx.fillStyle = f % 2 === 0 ? '#F97316' : '#FACC15';
  ctx.fillRect(2, 24, 2, 16);
  ctx.fillRect(60, 24, 2, 16);

  // Central cyclops reactor eye
  ctx.fillStyle = '#09090B';
  ctx.fillRect(18, 18, 28, 28);
  ctx.fillStyle = '#9F1239';
  ctx.fillRect(21, 21, 22, 22);
  const eyeShift = f === 1 ? 2 : f === 3 ? -2 : 0;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(26 + eyeShift, 26, 12, 12);
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(28 + eyeShift, 28, 8, 8);

  // Damage cracks as HP drops
  if (hpBand < 4) {
    ctx.fillStyle = '#09090B';
    ctx.fillRect(10, 12, 8, 2);
    ctx.fillRect(16, 14, 2, 6);
  }
  if (hpBand <= 2) {
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(42, 42, 10, 2);
    ctx.fillRect(46, 36, 2, 10);
  }

  return setCached(key, canvas);
}

export function getArchitectCeilingTile(animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `ARCH_CEIL_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const W = 48;
  const H = 24;
  const [canvas, ctx] = createPixelCanvas(W, H);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1E1E24';
  ctx.fillRect(0, 0, W, H - 3);
  ctx.fillStyle = '#B58E3E';
  ctx.fillRect(0, H - 3, W, 2);
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(0, H - 2, W, 1);

  // Mechanical crusher teeth & pulsing energy vents
  for (let x = 2; x < W; x += 12) {
    ctx.fillStyle = '#09090B';
    ctx.fillRect(x, H - 10, 6, 7);
    ctx.fillStyle = f % 2 === 0 ? '#FFFFFF' : '#FACC15';
    ctx.fillRect(x + 2, H - 8, 2, 3);
  }

  return setCached(key, canvas);
}

// ==================== 16x16 MATERIAL ICONS, 24x24 PORTRAITS & NEW GUARDIANS ====================

export function getMaterialIconSprite(matId: MaterialId): HTMLCanvasElement {
  const key = `MAT16_${matId}`;
  const cached = getCached(key);
  if (cached) return cached;

  const S = 16;
  const [canvas, ctx] = createPixelCanvas(S, S);
  const cfg: Record<MaterialId, [string, string, string]> = {
    ferrita: ['#7C2D12', '#EA580C', '#FDBA74'],
    cuarzo: ['#0369A1', '#38BDF8', '#E0F2FE'],
    ignita: ['#9A3412', '#F97316', '#FEF08A'],
    titanio: ['#365314', '#84CC16', '#ECFCCB'],
    eter: ['#581C87', '#C084FC', '#F3E8FF'],
    alabastro: ['#854D0E', '#FACC15', '#FFFFFF'],
  };
  const [dark, mid, hi] = cfg[matId] || cfg.ferrita;

  ctx.fillStyle = '#09090B';
  ctx.fillRect(4, 2, 8, 12);
  ctx.fillRect(2, 4, 12, 8);
  ctx.fillStyle = dark;
  ctx.fillRect(4, 3, 8, 10);
  ctx.fillRect(3, 5, 10, 6);
  ctx.fillStyle = mid;
  ctx.fillRect(5, 4, 6, 8);
  ctx.fillRect(4, 5, 8, 6);
  ctx.fillStyle = hi;
  ctx.fillRect(5, 4, 4, 2);
  ctx.fillRect(5, 4, 2, 5);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(6, 5, 1, 1);

  return setCached(key, canvas);
}

export function getCharacterPortraitSprite(speaker: StorySpeaker, animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `PORT24_${speaker}_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const S = 24;
  const [canvas, ctx] = createPixelCanvas(S, S);

  const bg =
    speaker === 'VANCE'
      ? '#0F172A'
      : speaker === 'SOLER'
      ? '#271A0C'
      : speaker === 'KAI'
      ? '#142615'
      : '#1E102E';
  const accent =
    speaker === 'VANCE'
      ? '#38BDF8'
      : speaker === 'SOLER'
      ? '#FACC15'
      : speaker === 'KAI'
      ? '#A3E635'
      : '#C084FC';

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  // Subtle scanlines on radio portrait background
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = (f % 2); y < S; y += 2) ctx.fillRect(0, y, S, 1);

  // Shoulders / jacket
  ctx.fillStyle = '#09090B';
  ctx.fillRect(4, 16, 16, 8);
  ctx.fillStyle = speaker === 'ARQUITECTO' ? '#4C1D95' : '#334155';
  ctx.fillRect(5, 17, 14, 7);
  ctx.fillStyle = accent;
  ctx.fillRect(5, 17, 14, 2);

  if (speaker === 'ARQUITECTO') {
    // Enigmatic floating obsidian diamond monolith + glowing pulse eye
    ctx.fillStyle = '#09090B';
    ctx.fillRect(7, 3, 10, 12);
    ctx.fillStyle = '#3B0764';
    ctx.fillRect(8, 4, 8, 10);
    ctx.fillStyle = accent;
    ctx.fillRect(9, 7, 6, 4);
    ctx.fillStyle = f % 2 === 0 ? '#FFFFFF' : '#F472B6';
    ctx.fillRect(11, 8, 2, 2);
    return setCached(key, canvas);
  }

  // Head + Hair/Helmet
  ctx.fillStyle = '#09090B';
  ctx.fillRect(7, 4, 10, 12);
  ctx.fillStyle = '#FDBA74'; // skin tone
  ctx.fillRect(8, 6, 8, 9);

  if (speaker === 'VANCE') {
    // Hair & tactical headset visor
    ctx.fillStyle = '#475569';
    ctx.fillRect(7, 4, 10, 4);
    ctx.fillRect(7, 6, 2, 5);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(9, 9, 3, 2);
    ctx.fillRect(13, 9, 3, 2);
    // Headset mic
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(6, 9, 2, 4);
    ctx.fillRect(7, 13, 3, 1);
  } else if (speaker === 'SOLER') {
    // Engineer goggles & beard
    ctx.fillStyle = '#92400E';
    ctx.fillRect(8, 4, 8, 3);
    ctx.fillRect(8, 13, 8, 3);
    ctx.fillStyle = '#FACC15';
    ctx.fillRect(8, 6, 8, 2);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(9, 7, 2, 2);
    ctx.fillRect(13, 7, 2, 2);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(9, 10, 2, 2);
    ctx.fillRect(13, 10, 2, 2);
  } else {
    // KAI: Vanguard flight visor helmet
    ctx.fillStyle = '#15803D';
    ctx.fillRect(7, 4, 10, 5);
    ctx.fillStyle = '#A3E635';
    ctx.fillRect(8, 8, 8, 3);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(9, 8, 3, 1);
  }

  // Animated talking mouth!
  ctx.fillStyle = '#09090B';
  ctx.fillRect(10, 13, 4, f % 2 === 0 ? 1 : 2);

  return setCached(key, canvas);
}

export function getCrystalWardenSprite(animFrame = 0, hitFlash = false): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `BOSS_WARDEN_${f}_${hitFlash ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const S = 56;
  const [canvas, ctx] = createPixelCanvas(S, S);
  const cMid = hitFlash ? '#FFFFFF' : '#0284C7';
  const cHi = hitFlash ? '#FFFFFF' : '#7DD3FC';
  const cCore = hitFlash ? '#FFFFFF' : f % 2 === 0 ? '#FEF08A' : '#38BDF8';

  // Floating crystal shield orbiters
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI * 2 * i) / 4 + f * 0.4;
    const ox = Math.round(28 + Math.cos(a) * 20);
    const oy = Math.round(28 + Math.sin(a) * 18);
    ctx.fillStyle = '#09090B';
    ctx.fillRect(ox - 4, oy - 6, 8, 12);
    ctx.fillStyle = cHi;
    ctx.fillRect(ox - 3, oy - 5, 6, 10);
  }

  // Central quartz spire body
  ctx.fillStyle = '#09090B';
  ctx.fillRect(16, 8, 24, 40);
  ctx.fillStyle = cMid;
  ctx.fillRect(18, 10, 20, 36);
  ctx.fillStyle = cHi;
  ctx.fillRect(18, 10, 6, 32);
  ctx.fillStyle = cCore;
  ctx.fillRect(24, 22, 8, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(26, 25, 4, 6);

  return setCached(key, canvas);
}

export function getForgeBossSprite(animFrame = 0, side: 'LEFT' | 'RIGHT', hitFlash = false): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `BOSS_FORGE_${side}_${f}_${hitFlash ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const W = 28;
  const H = 36;
  const [canvas, ctx] = createPixelCanvas(W, H);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = hitFlash ? '#FFFFFF' : '#451A03';
  ctx.fillRect(2, 2, W - 4, H - 4);
  ctx.fillStyle = hitFlash ? '#FFFFFF' : '#EA580C';
  ctx.fillRect(side === 'LEFT' ? 18 : 2, 4, 8, H - 8);
  ctx.fillStyle = hitFlash ? '#FFFFFF' : f % 2 === 0 ? '#FEF08A' : '#FB923C';
  ctx.fillRect(8, 12, 12, 12);

  return setCached(key, canvas);
}

export function getChronolithBossSprite(animFrame = 0, hitFlash = false): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `BOSS_CHRONO_${f}_${hitFlash ? 1 : 0}`;
  const cached = getCached(key);
  if (cached) return cached;

  const S = 64;
  const [canvas, ctx] = createPixelCanvas(S, S);
  const rim = hitFlash ? '#FFFFFF' : f % 2 === 0 ? '#F472B6' : '#FACC15';
  const body = hitFlash ? '#FFFFFF' : '#3B0764';

  // Outer rotating glyph ring
  ctx.fillStyle = rim;
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 + f * 0.25;
    const rx = Math.round(32 + Math.cos(a) * 26);
    const ry = Math.round(32 + Math.sin(a) * 24);
    ctx.fillRect(rx - 3, ry - 3, 6, 6);
  }

  // Chronolith prism body
  ctx.fillStyle = '#09090B';
  ctx.fillRect(16, 10, 32, 44);
  ctx.fillStyle = body;
  ctx.fillRect(18, 12, 28, 40);
  ctx.fillStyle = '#C084FC';
  ctx.fillRect(20, 14, 24, 4);
  ctx.fillStyle = rim;
  ctx.fillRect(26, 22, 12, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(29, 26, 6, 12);

  return setCached(key, canvas);
}

// ==================== 36x36 MULTI-CHASSIS ANIMATED PIXEL-ART EXO-RIG ====================

export interface PixelRigSpec {
  chassis: ChassisId;
  upgrades: RigUpgrades;
  rigLevel: number;
  pose: RigPose;
  animFrame: number; // 0..3
  aimDir: AimDir;
  facing: -1 | 1;
  hasPyro?: boolean;
  hasBallistic?: boolean;
  isLowO2?: boolean;
  overdriveActive?: boolean;
  hitFlash?: boolean;
  tintColor?: string;
}

export function getExoRigPixelSprite(spec: PixelRigSpec): HTMLCanvasElement {
  const f = spec.animFrame & 3;
  const lvlBand = spec.rigLevel >= 15 ? 4 : spec.rigLevel >= 10 ? 3 : spec.rigLevel >= 6 ? 2 : spec.rigLevel >= 3 ? 1 : 0;
  const u = spec.upgrades;
  const key = `RIG36_${spec.chassis}_${u.drillTier}_${u.thrusterTier}_${u.tankTier}_${u.armorTier}_${u.capacitorTier || 0}_${u.magnetTier || 0}_${lvlBand}_${spec.pose}_${f}_${spec.aimDir}_${spec.facing}_${spec.hasPyro ? 1 : 0}_${spec.hasBallistic ? 1 : 0}_${spec.isLowO2 ? 1 : 0}_${spec.overdriveActive ? 1 : 0}_${spec.hitFlash ? 1 : 0}_${spec.tintColor || ''}`;
  const cached = getCached(key);
  if (cached) return cached;

  const S = 36;
  const grid: (string | null)[][] = Array.from({ length: S }, () => Array(S).fill(null));
  const glowGrid: (string | null)[][] = Array.from({ length: S }, () => Array(S).fill(null));

  const put = (x: number, y: number, col: string) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix >= 1 && ix < S - 1 && iy >= 1 && iy < S - 1) {
      grid[iy][ix] = col;
    }
  };
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        put(x + dx, y + dy, col);
      }
    }
  };
  const putGlow = (x: number, y: number, col: string) => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix >= 0 && ix < S && iy >= 0 && iy < S) {
      glowGrid[iy][ix] = col;
    }
  };

  // Distinct character palettes across all 8 Operators
  const palettes: Record<ChassisId, [string, string, string, string]> = {
    MKI_VERTICE: ['#FFFFFF', '#E2E8F0', '#7E8C9E', '#EE4E34'],
    MKI_BRISA: ['#CCFBF1', '#2DD4BF', '#0F766E', '#FACC15'],
    MKII_ESPECTRO: ['#FAF5FF', '#C084FC', '#6B21A8', '#38BDF8'],
    MKIII_YUNQUE: ['#FEF3C7', '#F59E0B', '#92400E', '#FFFFFF'],
    MKVII_PIRO: ['#FFEDD5', '#FB923C', '#7C2D12', '#FEF08A'],
    MKIV_METRONOMO: ['#E0F2FE', '#38BDF8', '#075985', '#FACC15'],
    MKV_TITAN: ['#F1F5F9', '#64748B', '#334155', '#A3E635'],
    MKVI_QUANTUM: ['#FDF4FF', '#F472B6', '#831843', '#67E8F9'],
  };
  const [hullHi, hullMid, hullSh, visorBase] = palettes[spec.chassis] || palettes.MKI_VERTICE;
  const trimCol = spec.overdriveActive
    ? '#FACC15'
    : lvlBand >= 4
    ? '#F472B6'
    : lvlBand === 3
    ? '#38BDF8'
    : lvlBand === 2
    ? '#FACC15'
    : lvlBand === 1
    ? '#CBD5E1'
    : '#334155';

  const bobY =
    spec.pose === 'IDLE'
      ? f >= 2
        ? 1
        : 0
      : spec.pose === 'WALK'
      ? f % 2 === 1
        ? -1
        : 0
      : spec.pose === 'DRILL_STRIKE'
      ? f % 2 === 0
        ? 1
        : -1
      : 0;
  const cx = 18 + (spec.pose === 'DASH' ? spec.facing * 2 : 0);
  const cy = 16 + bobY;

  // 1. Thruster Wings & Exhaust Jets
  if (u.thrusterTier >= 1 || spec.chassis === 'MKII_ESPECTRO') {
    const wingCol = spec.chassis === 'MKII_ESPECTRO' ? '#7E22CE' : u.thrusterTier >= 3 ? '#38BDF8' : u.thrusterTier >= 2 ? '#0284C7' : '#475569';
    const wingHi = u.thrusterTier >= 2 ? '#BAE6FD' : '#94A3B8';
    const span = 5 + u.thrusterTier + (spec.chassis === 'MKII_ESPECTRO' ? 2 : 0);
    for (let i = 0; i < span; i++) {
      const yOff = Math.floor(i * 0.55);
      put(cx - 5 - i, cy - 3 - yOff, wingHi);
      put(cx - 5 - i, cy - 2 - yOff, wingCol);
      put(cx - 5 - i, cy - 1 - yOff, wingCol);

      put(cx + 4 + i, cy - 3 - yOff, wingHi);
      put(cx + 4 + i, cy - 2 - yOff, wingCol);
      put(cx + 4 + i, cy - 1 - yOff, wingCol);
    }
  }

  if (spec.pose === 'FALL' || spec.pose === 'SLAM_DIVE' || spec.pose === 'DASH' || u.thrusterTier >= 2) {
    const jetCol = spec.overdriveActive ? '#FACC15' : spec.pose === 'SLAM_DIVE' ? '#F97316' : u.thrusterTier >= 3 ? '#A3E635' : '#38BDF8';
    const jetLen = (spec.pose === 'FALL' || spec.pose === 'SLAM_DIVE' ? 6 : 3) + (f % 2 === 0 ? 2 : 0);
    for (const jx of [cx - 6, cx + 5]) {
      for (let k = 0; k < jetLen; k++) {
        putGlow(jx, cy - 4 - k, k < 2 ? '#FFFFFF' : jetCol);
        if (k < jetLen - 1) putGlow(jx + (jx < cx ? 1 : -1), cy - 4 - k, jetCol);
      }
    }
  }

  // 2. Shoulder Cryo Tanks
  if (u.tankTier >= 1) {
    const tankCol = u.tankTier >= 2 ? '#0EA5E9' : '#0369A1';
    for (const dir of [-1, 1]) {
      const tx = dir === -1 ? cx - 8 : cx + 6;
      rect(tx, cy - 5, 2, 6, tankCol);
      put(tx, cy - 6, '#64748B');
      put(tx + 1, cy - 6, '#64748B');
      if (u.tankTier >= 2) {
        put(tx, cy - 1 - ((f + (dir > 0 ? 1 : 0)) % 4), '#E0F2FE');
      }
    }
  }

  // 3. Articulated Legs / Pose Kinematics
  const bootCol = spec.chassis === 'MKIII_YUNQUE' ? '#475569' : '#334155';
  const bootHi = trimCol;
  if (spec.pose === 'WALK') {
    const stride = f === 0 ? 2 : f === 2 ? -2 : 0;
    const liftL = f === 0 ? -1 : 0;
    const liftR = f === 2 ? -1 : 0;
    rect(cx - 4 + stride, cy + 5 + liftL, 3, 4, bootCol);
    rect(cx - 4 + stride, cy + 5 + liftL, 3, 1, bootHi);
    rect(cx + 1 - stride, cy + 5 + liftR, 3, 4, bootCol);
    rect(cx + 1 - stride, cy + 5 + liftR, 3, 1, bootHi);
  } else if (spec.pose === 'CLIMB') {
    rect(cx - 4, cy + 4, 3, 3, bootCol);
    rect(cx + 1, cy + 6, 3, 3, bootCol);
    rect(cx - 7, cy - 7, 2, 5, hullMid);
    rect(cx + 5, cy - 8, 2, 5, hullHi);
  } else if (spec.pose === 'FALL' || spec.pose === 'SLAM_DIVE') {
    rect(cx - 6, cy + 4, 3, 3, bootCol);
    rect(cx + 3, cy + 4, 3, 3, bootCol);
  } else if (spec.pose === 'DASH') {
    rect(cx - 5 - spec.facing * 2, cy + 5, 4, 3, bootCol);
    rect(cx + 1 - spec.facing, cy + 5, 3, 3, bootCol);
  } else {
    rect(cx - 4, cy + 5, 3, 4, bootCol);
    rect(cx - 4, cy + 5, 3, 1, bootHi);
    rect(cx + 1, cy + 5, 3, 4, bootCol);
    rect(cx + 1, cy + 5, 3, 1, bootHi);
  }

  // 4. Distinct Operator Character Silhouettes, Suits & Headgear
  if (spec.chassis === 'MKI_BRISA') {
    // Nora · Brisa: nimble teal jacket, golden fringe hair, amber goggles & ponytail tie
    rect(cx - 4, cy - 2, 8, 7, hullMid);
    rect(cx - 4, cy + 3, 8, 2, hullSh);
    rect(cx - 5, cy - 1, 1, 4, hullSh);
    rect(cx + 4, cy - 1, 1, 4, hullSh);
    // Warm head/face + golden hair + ponytail anchor
    rect(cx - 4, cy - 7, 8, 5, '#F59E0B'); // golden hair dome
    rect(cx - 3, cy - 7, 6, 1, '#FDE68A');
    rect(cx - 3 + (spec.facing > 0 ? 1 : -1), cy - 5, 5, 3, '#FDBA74'); // expressive face
    rect(cx - 4, cy - 7, 8, 2, '#D97706'); // amber goggles strap
    rect(cx - 2 + (spec.facing > 0 ? 1 : -1), cy - 7, 4, 2, '#FEF08A'); // lens highlights
    // Back ponytail knot on opposite side of facing
    rect(cx - spec.facing * 5, cy - 6, 2, 2, '#FBBF24');
    put(cx - spec.facing * 4, cy - 6, '#2DD4BF');
  } else if (spec.chassis === 'MKIII_YUNQUE' || spec.chassis === 'MKV_TITAN') {
    // Heavy flat-top armored specialists: Bram (Forge-Dwarf w/ beard) & Orson (Bunker Titan w/ beacons)
    rect(cx - 7, cy - 5, 14, 10, hullMid);
    rect(cx - 6, cy - 7, 12, 2, hullHi);
    rect(cx - 7, cy + 3, 14, 2, hullSh);
    rect(cx - 9, cy - 4, 3, 5, spec.chassis === 'MKV_TITAN' ? '#A3E635' : '#64748B');
    rect(cx + 6, cy - 4, 3, 5, spec.chassis === 'MKV_TITAN' ? '#A3E635' : '#64748B');
    if (spec.chassis === 'MKIII_YUNQUE') {
      // Braided iron-amber forge beard!
      rect(cx - 3, cy + 1, 6, 3, '#D97706');
      rect(cx - 2, cy + 4, 4, 2, '#92400E');
      put(cx, cy + 5, '#FACC15');
    } else {
      // Orson's twin blinking lime reactor beacons
      rect(cx - 3, cy - 9, 6, 2, '#94A3B8');
      putGlow(cx - 4, cy - 8 + (f & 1), '#A3E635');
      putGlow(cx + 3, cy - 8 + ((f + 1) & 1), '#A3E635');
    }
  } else if (spec.chassis === 'MKVII_PIRO') {
    // Ignis · Crisol: obsidian thermal hood, glowing ember respirator & 4-frame flickering flame crest
    rect(cx - 5, cy - 4, 10, 9, hullMid);
    rect(cx - 4, cy - 6, 8, 2, '#292524');
    rect(cx - 5, cy + 3, 10, 2, hullSh);
    rect(cx - 2, cy + 1, 4, 2, '#1C1917'); // ember respirator
    putGlow(cx - 1 + (f & 1), cy + 1, '#FB923C');
    // Animated flame crest
    const fh = f === 0 || f === 2 ? 3 : 4;
    rect(cx - 2, cy - 6 - fh, 4, fh, '#F97316');
    rect(cx - 1, cy - 5 - fh, 2, fh - 1, '#FEF08A');
    putGlow(cx + (f % 2 === 0 ? -1 : 0), cy - 7 - fh, '#FEF08A');
  } else if (spec.chassis === 'MKII_ESPECTRO' || spec.chassis === 'MKVI_QUANTUM') {
    // Sleek stealth cowl (Sable) / Floating crystal scholar (Vex)
    rect(cx - 5, cy - 5, 10, 10, hullMid);
    rect(cx - 4, cy - 7, 8, 2, hullHi);
    rect(cx - 6, cy - 2, 1, 5, hullSh);
    rect(cx + 5, cy - 2, 1, 5, hullSh);
    rect(cx - 5, cy + 3, 10, 2, hullSh);
    if (spec.chassis === 'MKII_ESPECTRO') {
      // Scarf wrap collar
      rect(cx - 4, cy + 1, 8, 2, '#4C1D95');
    } else {
      // Levitating phase prism halo around Vex
      putGlow(cx - 7, cy - 6 + (f & 1), '#67E8F9');
      putGlow(cx + 6, cy - 6 + ((f + 1) & 1), '#F472B6');
      put(cx - 1, cy - 9 - (f & 1), '#67E8F9');
      put(cx, cy - 9 - (f & 1), '#F472B6');
    }
  } else if (spec.chassis === 'MKIV_METRONOMO') {
    // Lyra · Cadencia: acoustic suit, side headphones & pulsing tuning-fork crest
    rect(cx - 5, cy - 4, 10, 9, hullMid);
    rect(cx - 4, cy - 6, 8, 2, hullHi);
    rect(cx - 5, cy + 3, 10, 2, hullSh);
    rect(cx - 6, cy - 3, 2, 4, '#0F172A'); // headset left
    rect(cx + 4, cy - 3, 2, 4, '#0F172A'); // headset right
    put(cx - 6, cy - 2, f % 2 === 0 ? '#FACC15' : '#38BDF8');
    put(cx + 5, cy - 2, f % 2 === 0 ? '#FACC15' : '#38BDF8');
    rect(cx - 3, cy - 9, 1, 3, '#FACC15');
    rect(cx + 2, cy - 9, 1, 3, '#FACC15');
    if (f % 2 === 0) putGlow(cx, cy - 9, '#FACC15');
  } else {
    // Kael · Vértice: Horned deep-core explorer helm
    rect(cx - 5, cy - 4, 10, 9, hullMid);
    rect(cx - 4, cy - 6, 8, 2, hullHi);
    rect(cx - 5, cy + 3, 10, 2, hullSh);
    put(cx - 4, cy - 7, hullHi);
    put(cx + 3, cy - 7, hullHi);
  }

  // Prestige Trim
  rect(cx - 5, cy - 3, 1, 6, trimCol);
  rect(cx + 4, cy - 3, 1, 6, trimCol);

  // Armor Tier 1..3 Pauldrons & Titan Crown
  if (u.armorTier >= 1) {
    const pCol = u.armorTier >= 3 ? '#FACC15' : u.armorTier >= 2 ? '#CBD5E1' : '#64748B';
    rect(cx - 7, cy - 3, 3, 4, pCol);
    rect(cx + 4, cy - 3, 3, 4, pCol);
  }
  if (u.armorTier >= 3) {
    rect(cx - 2, cy - 8, 4, 2, '#FACC15');
    rect(cx - 1, cy - 9, 2, 1, '#FEF08A');
  }

  // Chest Reactor Core
  if (u.armorTier >= 2 || spec.rigLevel >= 2 || spec.overdriveActive || spec.chassis === 'MKV_TITAN') {
    const coreC = spec.overdriveActive
      ? '#FFFFFF'
      : spec.chassis === 'MKV_TITAN'
      ? '#A3E635'
      : u.armorTier >= 2
      ? f % 2 === 0
        ? '#FEF08A'
        : '#FACC15'
      : '#38BDF8';
    rect(cx - 1, cy + 2, 2, 2, coreC);
  }

  // 5. Expressive Directional Visor / Twin Eyes
  const vxOff = spec.aimDir === 'LEFT' ? -1 : spec.aimDir === 'RIGHT' ? 1 : spec.facing > 0 ? 1 : -1;
  const vyOff = spec.aimDir === 'UP' ? -1 : 0;
  const visorColor = spec.overdriveActive
    ? '#FEF08A'
    : spec.isLowO2 && f % 2 === 0
    ? '#E11D48'
    : spec.pose === 'FALL' || spec.pose === 'SLAM_DIVE'
    ? '#FACC15'
    : visorBase;

  if (spec.chassis === 'MKI_BRISA') {
    // Open face eyes!
    put(cx - 2 + vxOff, cy - 4 + vyOff, '#0F172A');
    put(cx + 1 + vxOff, cy - 4 + vyOff, '#0F172A');
    put(cx + vxOff, cy - 3 + vyOff, '#E11D48');
  } else if (spec.chassis === 'MKII_ESPECTRO' || spec.chassis === 'MKVI_QUANTUM') {
    // Twin luminous stealth/quantum eyes inside dark cowl
    rect(cx - 3 + vxOff, cy - 3 + vyOff, 6, 3, '#0F172A');
    rect(cx - 2 + vxOff, cy - 2 + vyOff, 2, 1, visorColor);
    rect(cx + 1 + vxOff, cy - 2 + vyOff, 2, 1, visorColor);
    put(cx - 2 + vxOff, cy - 2 + vyOff, '#FFFFFF');
  } else {
    rect(cx - 3 + vxOff, cy - 3 + vyOff, 6, 3, '#0F172A');
    rect(cx - 2 + vxOff, cy - 2 + vyOff, 4, 1, visorColor);
    put(cx - 2 + vxOff, cy - 2 + vyOff, '#FFFFFF');
  }

  // Parry Slash / Swap Cast gesture arm highlights
  if (spec.pose === 'PARRY_SLASH') {
    for (let s = -4; s <= 4; s++) {
      putGlow(cx + s * spec.facing, cy - 6 - Math.abs(s), '#FFFFFF');
      putGlow(cx + s * spec.facing, cy - 5 - Math.abs(s), '#38BDF8');
    }
  } else if (spec.pose === 'SWAP_CAST') {
    putGlow(cx - 7, cy - 1, '#38BDF8');
    putGlow(cx + 6, cy - 1, '#38BDF8');
  }

  // Capacitor & Magnet visual ornaments
  if ((u.capacitorTier || 0) >= 2) {
    putGlow(cx - 4, cy - 9, f % 2 === 0 ? '#FEF08A' : '#FACC15');
    putGlow(cx + 3, cy - 9, f % 2 === 1 ? '#FEF08A' : '#FACC15');
  }
  if ((u.magnetTier || 0) >= 1) {
    put(cx, cy - 10, '#38BDF8');
    if ((u.magnetTier || 0) >= 3) {
      putGlow(cx + ((f % 2 === 0) ? -9 : 8), cy + 1, '#38BDF8');
    }
  }

  // 6. Spinning 4-Frame Helical Pixel Drill Head along aimDir
  const drillTier = Math.max(0, Math.min(5, u.drillTier || 0));
  const dSteel =
    spec.overdriveActive
      ? '#FEF08A'
      : drillTier >= 5
      ? '#F472B6'
      : drillTier >= 4
      ? '#E0F2FE'
      : drillTier === 3
      ? '#C084FC'
      : drillTier === 2
      ? '#F59E0B'
      : drillTier === 1
      ? '#38BDF8'
      : '#CBD5E1';
  const dDark =
    spec.overdriveActive
      ? '#D97706'
      : drillTier >= 5
      ? '#9D174D'
      : drillTier >= 4
      ? '#0284C7'
      : drillTier === 3
      ? '#6B21A8'
      : drillTier === 2
      ? '#9A3412'
      : drillTier === 1
      ? '#0369A1'
      : '#475569';
  const dStripe =
    drillTier >= 3
      ? '#FFFFFF'
      : drillTier === 2
      ? '#FEF08A'
      : drillTier === 1
      ? '#E0F2FE'
      : '#D94126';
  const dTip = spec.overdriveActive || drillTier >= 3 ? '#FFFFFF' : drillTier >= 1 ? '#38BDF8' : '#FB923C';
  const strikeExtra = spec.pose === 'DRILL_STRIKE' || spec.pose === 'SLAM_DIVE' || spec.overdriveActive ? 2 : 0;
  const dLen = 6 + Math.min(3, drillTier) + (spec.hasBallistic ? 1 : 0) + strikeExtra;

  if (spec.aimDir === 'DOWN') {
    for (let i = 0; i < dLen; i++) {
      const hw = Math.max(0, Math.round((1 - i / dLen) * (spec.chassis === 'MKIII_YUNQUE' ? 3.5 : 3)));
      for (let dx = -hw; dx <= hw; dx++) {
        const stripe = (i + dx + f) % 3 === 0;
        put(cx + dx, cy + 5 + i, stripe ? dStripe : dx < 0 ? dSteel : dDark);
      }
    }
    put(cx, cy + 5 + dLen - 1, dTip);
    putGlow(cx, cy + 5 + dLen, dTip);
  } else if (spec.aimDir === 'UP') {
    for (let i = 0; i < dLen; i++) {
      const hw = Math.max(0, Math.round((1 - i / dLen) * 3));
      for (let dx = -hw; dx <= hw; dx++) {
        const stripe = (i + dx + f) % 3 === 0;
        put(cx + dx, cy - 6 - i, stripe ? dStripe : dx < 0 ? dSteel : dDark);
      }
    }
    put(cx, cy - 6 - dLen + 1, dTip);
    putGlow(cx, cy - 6 - dLen, dTip);
  } else if (spec.aimDir === 'LEFT') {
    for (let i = 0; i < dLen; i++) {
      const hh = Math.max(0, Math.round((1 - i / dLen) * 3));
      for (let dy = -hh; dy <= hh; dy++) {
        const stripe = (i + dy + f) % 3 === 0;
        put(cx - 6 - i, cy + dy, stripe ? dStripe : dy < 0 ? dSteel : dDark);
      }
    }
    put(cx - 6 - dLen + 1, cy, dTip);
    putGlow(cx - 6 - dLen, cy, dTip);
  } else {
    for (let i = 0; i < dLen; i++) {
      const hh = Math.max(0, Math.round((1 - i / dLen) * 3));
      for (let dy = -hh; dy <= hh; dy++) {
        const stripe = (i + dy + f) % 3 === 0;
        put(cx + 5 + i, cy + dy, stripe ? dStripe : dy < 0 ? dSteel : dDark);
      }
    }
    put(cx + 5 + dLen - 1, cy, dTip);
    putGlow(cx + 5 + dLen, cy, dTip);
  }

  const [canvas, ctx] = createPixelCanvas(S, S);

  if (spec.tintColor) {
    ctx.fillStyle = spec.tintColor;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (grid[y][x] !== null) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return setCached(key, canvas);
  }

  if (spec.hitFlash) {
    ctx.fillStyle = '#FFFFFF';
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (grid[y][x] !== null) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return setCached(key, canvas);
  }

  // 1. Glow layer
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const gc = glowGrid[y][x];
      if (gc) {
        ctx.fillStyle = gc;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // 2. Crisp 1px #09090B dark pixel outline
  ctx.fillStyle = '#09090B';
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (grid[y][x] !== null) continue;
      if (
        (x > 0 && grid[y][x - 1] !== null) ||
        (x < S - 1 && grid[y][x + 1] !== null) ||
        (y > 0 && grid[y - 1][x] !== null) ||
        (y < S - 1 && grid[y + 1][x] !== null)
      ) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  // 3. Solid pixel fill
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const c = grid[y][x];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  return setCached(key, canvas);
}

export function getArtifactPodSprite(color = '#FACC15', accent = '#FFFFFF', animFrame = 0): HTMLCanvasElement {
  const f = animFrame & 3;
  const key = `ARTPOD24_${color}_${accent}_${f}`;
  const cached = getCached(key);
  if (cached) return cached;

  const [canvas, ctx] = createPixelCanvas(TILE_PX, TILE_PX);
  ctx.fillStyle = '#09090B';
  ctx.fillRect(0, 0, TILE_PX, TILE_PX);
  ctx.fillStyle = '#181426';
  ctx.fillRect(1, 1, TILE_PX - 2, TILE_PX - 2);

  // Ornate ancient frame + golden corner clasps
  ctx.fillStyle = '#B45309';
  ctx.fillRect(2, 2, 20, 2);
  ctx.fillRect(2, 20, 20, 2);
  ctx.fillRect(2, 4, 2, 16);
  ctx.fillRect(20, 4, 2, 16);
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(2, 2, 4, 2);
  ctx.fillRect(18, 2, 4, 2);
  ctx.fillRect(2, 20, 4, 2);
  ctx.fillRect(18, 20, 4, 2);

  // Floating inner artifact crystal diamond
  const dy = f % 2 === 0 ? 0 : 1;
  ctx.fillStyle = color;
  ctx.fillRect(8, 8 + dy, 8, 8);
  ctx.fillRect(10, 6 + dy, 4, 12);
  ctx.fillRect(6, 10 + dy, 12, 4);
  ctx.fillStyle = accent;
  ctx.fillRect(10, 9 + dy, 4, 4);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(11, 10 + dy, 2, 2);

  // Orbiting pixel sparkles
  const sx = f === 0 ? 5 : f === 1 ? 17 : f === 2 ? 17 : 5;
  const sy = f === 0 ? 5 : f === 1 ? 6 : f === 2 ? 17 : 17;
  ctx.fillStyle = f % 2 === 0 ? '#FFFFFF' : '#FACC15';
  ctx.fillRect(sx, sy, 2, 2);

  return setCached(key, canvas);
}

export function getArtifactIconSprite(artifactId: ArtifactId): HTMLCanvasElement {
  const key = `ARTICON16_${artifactId}`;
  const cached = getCached(key);
  if (cached) return cached;

  const def = ARTIFACTS.find((a) => a.id === artifactId) || ARTIFACTS[0];
  const [canvas, ctx] = createPixelCanvas(16, 16);
  const c = def.color;
  const a = def.accent;

  ctx.fillStyle = '#09090B';
  ctx.fillRect(2, 2, 12, 12);
  ctx.fillStyle = '#14151F';
  ctx.fillRect(3, 3, 10, 10);

  switch (def.iconShape) {
    case 'COMPASS':
    case 'DIAL':
      ctx.fillStyle = c;
      ctx.fillRect(5, 3, 6, 10);
      ctx.fillRect(3, 5, 10, 6);
      ctx.fillStyle = '#18181B';
      ctx.fillRect(5, 5, 6, 6);
      ctx.fillStyle = a;
      ctx.fillRect(7, 4, 2, 8);
      ctx.fillStyle = '#EE4E34';
      ctx.fillRect(7, 4, 2, 3);
      break;
    case 'PRISM':
    case 'CORE':
      ctx.fillStyle = c;
      ctx.fillRect(7, 2, 2, 12);
      ctx.fillRect(5, 4, 6, 8);
      ctx.fillRect(3, 6, 10, 4);
      ctx.fillStyle = a;
      ctx.fillRect(6, 6, 4, 4);
      break;
    case 'CROWN':
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(3, 9, 10, 4);
      ctx.fillRect(3, 5, 2, 5);
      ctx.fillRect(7, 4, 2, 6);
      ctx.fillRect(11, 5, 2, 5);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 2, 2, 2);
      ctx.fillRect(7, 10, 2, 2);
      break;
    case 'FORK':
      ctx.fillStyle = c;
      ctx.fillRect(4, 3, 2, 6);
      ctx.fillRect(10, 3, 2, 6);
      ctx.fillRect(4, 8, 8, 2);
      ctx.fillRect(7, 9, 2, 5);
      ctx.fillStyle = a;
      ctx.fillRect(4, 3, 1, 2);
      ctx.fillRect(10, 3, 1, 2);
      break;
    case 'FEATHER':
    case 'TEAR':
      ctx.fillStyle = c;
      ctx.fillRect(7, 3, 4, 9);
      ctx.fillRect(5, 6, 5, 5);
      ctx.fillStyle = a;
      ctx.fillRect(7, 5, 2, 7);
      break;
    default:
      ctx.fillStyle = c;
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = a;
      ctx.fillRect(6, 5, 4, 6);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(7, 6, 2, 2);
      break;
  }

  return setCached(key, canvas);
}
