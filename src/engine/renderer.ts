// Masterpiece Hi-Bit Virtual-Pixel Renderer for ESTRATO.
// Renders the entire subterranean shaft at an integer-crisp 256px virtual width (20px walls + 9x24px playfield)
// with zero mixels, pixel-quantized dynamic lighting, Verlet scarf rendering, 36x36 Exo-Rig sprites, and CRT FX.

import { ARCHETYPE_COLORS, MODULES, OVERCHARGES, STRATA } from '../data/catalog';
import { ARTIFACTS } from '../data/collectibles';
import {
  AimDir,
  Cell,
  ChassisId,
  GRID_COLS,
  LAST_BREATH_FRAMES,
  RigPose,
  RigUpgrades,
  RmbDragPreview,
  StratumPalette,
  VisualSettings,
} from '../types/game';
import { EstratoSimulation } from './simulation';
import { createScarfNodes, ScarfNode, stepScarfNodes } from './fx';
import { soundEngine } from './audio';
import {
  drawPixelText,
  getAcidVatBlockSprite,
  getArchitectCeilingTile,
  getArtifactPodSprite,
  getBouncePadBlockSprite,
  getChronolithBossSprite,
  getConductorBlockSprite,
  getCryoVentBlockSprite,
  getCrystalBlockSprite,
  getCrystalWardenSprite,
  getDeepVistaTile,
  getExoRigPixelSprite,
  getExtractionTubeSprite,
  getForgeBossSprite,
  getGasPocketBlockSprite,
  getGeodeBlockSprite,
  getGhostEchoBlockSprite,
  getGravelBlockSprite,
  getGravWellBlockSprite,
  getIgnitingBlockSprite,
  getLoomAnchorSprite,
  getMagmaNodeBlockSprite,
  getMineralBlockSprite,
  getMonolithBlockSprite,
  getOxygenPodSprite,
  getParallaxCavernTile,
  getParallaxMidgroundScaffolding,
  getPendulumBossSprite,
  getPhaseBlockSprite,
  getPhaseKeyBlockSprite,
  getRivetBlockSprite,
  getSealGateSprite,
  getShaftWallStrip,
  getShockMineBlockSprite,
  getSlagBlockSprite,
  getTreasureCacheBlockSprite,
  TILE_PX,
} from './pixelArt';

export const VIRTUAL_W = 256;
export const VIRTUAL_WALL = 20;
export const VIRTUAL_CELL = TILE_PX; // 24 -> 9 * 24 = 216; 216 + 40 = 256 exact!
export const VIRTUAL_PLAY_W = VIRTUAL_CELL * GRID_COLS; // 216

export const DEFAULT_PC_CAMERA_ANCHOR_Y = 0.42;
export const DEFAULT_MOBILE_CAMERA_ANCHOR_Y = 0.60;
export const MIN_CAMERA_ANCHOR_Y = 0.38;
export const MAX_CAMERA_ANCHOR_Y = 0.72;

export function clampCameraAnchorY(
  value: number | undefined,
  fallback = DEFAULT_PC_CAMERA_ANCHOR_Y
): number {
  const safeFallback = Math.max(MIN_CAMERA_ANCHOR_Y, Math.min(MAX_CAMERA_ANCHOR_Y, fallback));
  if (typeof value !== 'number' || !Number.isFinite(value)) return safeFallback;
  return Math.max(MIN_CAMERA_ANCHOR_Y, Math.min(MAX_CAMERA_ANCHOR_Y, value));
}

export function getVirtualHeight(width: number, height: number): number {
  return Math.max(240, Math.round((height / Math.max(1, width)) * VIRTUAL_W));
}

export interface ShaftMetrics {
  wallWidth: number;
  playW: number;
  cellSize: number;
  visibleRows: number;
  topWorldRow: number;
}

export function getShaftMetrics(
  width: number,
  height: number,
  cameraRow: number,
  cameraAnchorY = DEFAULT_PC_CAMERA_ANCHOR_Y
): ShaftMetrics {
  const vH = getVirtualHeight(width, height);
  const wallWidth = (VIRTUAL_WALL / VIRTUAL_W) * width;
  const playW = (VIRTUAL_PLAY_W / VIRTUAL_W) * width;
  const cellSize = (VIRTUAL_CELL / VIRTUAL_W) * width;
  const visibleRows = vH / VIRTUAL_CELL;
  const anchorY = clampCameraAnchorY(cameraAnchorY, DEFAULT_PC_CAMERA_ANCHOR_Y);
  const topWorldRow = cameraRow - visibleRows * anchorY;
  return { wallWidth, playW, cellSize, visibleRows, topWorldRow };
}

export function screenPointToGridCell(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  sim: EstratoSimulation,
  cameraAnchorY = DEFAULT_PC_CAMERA_ANCHOR_Y
): { r: number; c: number; cellSize: number } | null {
  const vH = getVirtualHeight(rect.width, rect.height);
  const visibleRows = vH / VIRTUAL_CELL;
  const anchorY = clampCameraAnchorY(cameraAnchorY, DEFAULT_PC_CAMERA_ANCHOR_Y);
  const topWorldRow = sim.cameraRow - visibleRows * anchorY;
  let vx = ((clientX - rect.left) / Math.max(1, rect.width)) * VIRTUAL_W;
  let vy = ((clientY - rect.top) / Math.max(1, rect.height)) * vH;
  if (Math.abs(sim.camZoom - 1.0) > 0.002) {
    const playerVX = Math.round(VIRTUAL_WALL + (sim.px + 0.5) * VIRTUAL_CELL);
    const playerVY = Math.round((sim.py - 0.5 - topWorldRow) * VIRTUAL_CELL);
    const zoomFocusX = Math.round(VIRTUAL_W * 0.5 + (playerVX - VIRTUAL_W * 0.5) * 0.35);
    vx = zoomFocusX + (vx - zoomFocusX) / sim.camZoom;
    vy = playerVY + (vy - playerVY) / sim.camZoom;
  }
  const c = Math.floor((vx - VIRTUAL_WALL) / VIRTUAL_CELL);
  const r = Math.floor(vy / VIRTUAL_CELL + topWorldRow);
  if (c < 0 || c >= GRID_COLS || r < 0) return null;
  const cellSize = (VIRTUAL_CELL / VIRTUAL_W) * rect.width * sim.camZoom;
  return { r, c, cellSize };
}

export interface ExoRigRenderOpts {
  chassis: ChassisId;
  upgrades: RigUpgrades;
  rigLevel: number;
  timeSec: number;
  cellSize: number;
  aimAngle: number;
  facing?: -1 | 1;
  aimDir?: AimDir;
  pose?: RigPose;
  isFalling?: boolean;
  isClimbing?: boolean;
  hasPyro?: boolean;
  hasBallistic?: boolean;
  hasShield?: boolean;
  anvilShield?: boolean;
  hasAlpha?: boolean;
  hasLance?: boolean;
  overdriveActive?: boolean;
  squashX?: number;
  squashY?: number;
  vx?: number;
  vy?: number;
  coyoteCrushTimer?: number;
  oxygenRatio?: number;
  showO2Ring?: boolean;
}

// Persistent offscreen virtual buffers to guarantee 100% unified crisp pixel resolution
let vCanvas: HTMLCanvasElement | null = null;
let vCtx: CanvasRenderingContext2D | null = null;
let lightCanvas: HTMLCanvasElement | null = null;
let lightCtx: CanvasRenderingContext2D | null = null;

function ensureVirtualBuffer(vW: number, vH: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (!vCanvas) {
    vCanvas = document.createElement('canvas');
    vCtx = vCanvas.getContext('2d')!;
  }
  if (vCanvas.width !== vW || vCanvas.height !== vH) {
    vCanvas.width = vW;
    vCanvas.height = vH;
  }
  vCtx!.imageSmoothingEnabled = false;
  return [vCanvas, vCtx!];
}

function ensureLightBuffer(lW: number, lH: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas');
    lightCtx = lightCanvas.getContext('2d')!;
  }
  if (lightCanvas.width !== lW || lightCanvas.height !== lH) {
    lightCanvas.width = lW;
    lightCanvas.height = lH;
  }
  lightCtx!.imageSmoothingEnabled = false;
  return [lightCanvas, lightCtx!];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [120, 120, 130];
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [120, 120, 130];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbStr(r: number, g: number, b: number, a = 1): string {
  const cr = Math.max(0, Math.min(255, Math.round(r)));
  const cg = Math.max(0, Math.min(255, Math.round(g)));
  const cb = Math.max(0, Math.min(255, Math.round(b)));
  return a >= 1 ? `rgb(${cr},${cg},${cb})` : `rgba(${cr},${cg},${cb},${a})`;
}

function shadeHex(hex: string, factor: number, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex);
  if (factor >= 0) {
    return rgbStr(
      r + (255 - r) * factor,
      g + (255 - g) * factor,
      b + (255 - b) * factor,
      alpha
    );
  }
  const f = 1 + factor;
  return rgbStr(r * f, g * f, b * f, alpha);
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  return rgbStr(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

// Midpoint integer-pixel circle renderer (no anti-aliased strokes!)
function drawPixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  thickness = 1
): void {
  const r = Math.round(radius);
  if (r <= 0) return;
  const icx = Math.round(cx);
  const icy = Math.round(cy);
  ctx.fillStyle = color;
  let x = r;
  let y = 0;
  let err = 1 - x;
  while (x >= y) {
    ctx.fillRect(icx + x, icy + y, thickness, thickness);
    ctx.fillRect(icx + y, icy + x, thickness, thickness);
    ctx.fillRect(icx - y, icy + x, thickness, thickness);
    ctx.fillRect(icx - x, icy + y, thickness, thickness);
    ctx.fillRect(icx - x, icy - y, thickness, thickness);
    ctx.fillRect(icx - y, icy - x, thickness, thickness);
    ctx.fillRect(icx + y, icy - x, thickness, thickness);
    ctx.fillRect(icx + x, icy - y, thickness, thickness);
    y++;
    if (err < 0) {
      err += 2 * y + 1;
    } else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

// Stepped pixel line (Bresenham) for crisp lightning arcs & tethers
function drawPixelLine(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  pxSize = 1
): void {
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0);
  const dy = -Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  let safety = 0;
  while (safety++ < 180) {
    ctx.fillRect(ix0, iy0, pxSize, pxSize);
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ix0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      iy0 += sy;
    }
  }
}

// Stepped pixel-quantized radial light halo (zero smooth gradients!)
function drawPixelLightHalo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  peakAlpha: number
): void {
  const icx = Math.round(cx);
  const icy = Math.round(cy);
  const steps = 3;
  for (let s = steps; s >= 1; s--) {
    const r = Math.round((radius * s) / steps);
    if (r <= 1) continue;
    ctx.globalAlpha = peakAlpha * ((steps - s + 1) / (steps * 1.6));
    ctx.fillStyle = color;
    // Octagonal stepped pixel light disc for crisp hi-bit retro aesthetics
    const cut = Math.round(r * 0.38);
    ctx.fillRect(icx - r, icy - (r - cut), r * 2, (r - cut) * 2);
    ctx.fillRect(icx - (r - cut), icy - r, (r - cut) * 2, r * 2);
  }
}

function carveLightOctagon(
  lctx: CanvasRenderingContext2D,
  vx: number,
  vy: number,
  radiusPx: number,
  overscan: number,
  strength = 1
): void {
  const icx = Math.round((vx + overscan) * 0.5);
  const icy = Math.round((vy + overscan) * 0.5);
  const rOuter = Math.max(2, Math.round(radiusPx * 0.5));
  const rInner = Math.max(1, Math.round(rOuter * 0.56));
  lctx.fillStyle = '#FFFFFF';

  // Outer stepped soft falloff ring
  lctx.globalAlpha = Math.max(0.12, Math.min(1, strength * 0.55));
  const cutOut = Math.round(rOuter * 0.36);
  lctx.fillRect(icx - rOuter, icy - (rOuter - cutOut), rOuter * 2, (rOuter - cutOut) * 2);
  lctx.fillRect(icx - (rOuter - cutOut), icy - rOuter, (rOuter - cutOut) * 2, rOuter * 2);

  // Inner bright core pool
  lctx.globalAlpha = Math.max(0.15, Math.min(1, strength));
  const cutIn = Math.round(rInner * 0.36);
  lctx.fillRect(icx - rInner, icy - (rInner - cutIn), rInner * 2, (rInner - cutIn) * 2);
  lctx.fillRect(icx - (rInner - cutIn), icy - rInner, (rInner - cutIn) * 2, rInner * 2);
}

function drawBlockBounceRim(
  ctx: CanvasRenderingContext2D,
  nr: number,
  nc: number,
  fromDr: number,
  fromDc: number,
  topWorldRow: number,
  color: string,
  alpha: number
): void {
  const bx = Math.round(VIRTUAL_WALL + nc * VIRTUAL_CELL);
  const by = Math.round((nr - topWorldRow) * VIRTUAL_CELL);
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  if (fromDr === 1) {
    // Light source is below -> bounce highlight on bottom edge of neighbor
    ctx.fillRect(bx + 1, by + VIRTUAL_CELL - 2, VIRTUAL_CELL - 2, 2);
  } else if (fromDr === -1) {
    // Light source is above -> bounce highlight on top edge
    ctx.fillRect(bx + 1, by, VIRTUAL_CELL - 2, 2);
  } else if (fromDc === 1) {
    // Light source is right -> highlight right edge
    ctx.fillRect(bx + VIRTUAL_CELL - 2, by + 1, 2, VIRTUAL_CELL - 2);
  } else if (fromDc === -1) {
    // Light source is left -> highlight left edge
    ctx.fillRect(bx, by + 1, 2, VIRTUAL_CELL - 2);
  }
}

const DEFAULT_VISUALS: VisualSettings = {
  crtMode: 'SUBTLE',
  screenShake: 1,
  pixelGlow: true,
};

export function renderSimulation(
  ctx: CanvasRenderingContext2D,
  sim: EstratoSimulation,
  width: number,
  height: number,
  timeSec: number,
  hoveredCell?: { r: number; c: number } | null,
  visualSettings: VisualSettings = DEFAULT_VISUALS,
  rmbDrag?: RmbDragPreview | null
): void {
  const vH = getVirtualHeight(width, height);
  const [buf, v] = ensureVirtualBuffer(VIRTUAL_W, vH);

  const visibleRows = vH / VIRTUAL_CELL;
  const anchorY = clampCameraAnchorY(visualSettings.cameraAnchorY, DEFAULT_PC_CAMERA_ANCHOR_Y);
  const topWorldRow = sim.cameraRow - visibleRows * anchorY;

  const curRow = Math.floor(sim.cameraRow);
  const baseStratum = sim.getStratumForRow(curRow);
  let activeBg = baseStratum.bg;
  let activeWallBg = baseStratum.wallBg;
  let activeWallBorder = baseStratum.wallBorder;
  let accentColor = baseStratum.blockColors[0] || '#EE4E34';

  if (!sim.inStratum6 && curRow > 0) {
    const mod500 = curRow % 500;
    if (mod500 >= 472) {
      const nextS = sim.getStratumForRow(curRow + 32);
      const t = (mod500 - 472) / 28;
      activeBg = lerpColor(baseStratum.bg, nextS.bg, t);
      activeWallBg = lerpColor(baseStratum.wallBg, nextS.wallBg, t);
      activeWallBorder = lerpColor(baseStratum.wallBorder, nextS.wallBorder, t);
      accentColor = lerpColor(accentColor, nextS.blockColors[0] || '#38BDF8', t);
    }
  }

  v.save();
  v.imageSmoothingEnabled = false;
  v.fillStyle = activeBg;
  v.fillRect(0, 0, VIRTUAL_W, vH);

  // Camera Trauma, Directional Kick & Dynamic Zoom In/Out in crisp virtual pixels
  const shakeMult = visualSettings.screenShake;
  const traumaMag = sim.camTrauma * sim.camTrauma * 7.5;
  const traumaX = traumaMag > 0.1 ? Math.round(Math.sin(timeSec * 57.3) * traumaMag * shakeMult) : 0;
  const traumaY = traumaMag > 0.1 ? Math.round(Math.cos(timeSec * 64.9) * traumaMag * shakeMult) : 0;
  const shakeX = (sim.shakeTimer > 0 ? Math.round(sim.shakeX * 0.48 * shakeMult) : 0) + traumaX;
  const shakeY = (sim.shakeTimer > 0 ? Math.round(sim.shakeY * 0.48 * shakeMult) : 0) + traumaY;
  const kickX = Math.round(sim.camKickX * shakeMult);
  const kickY = Math.round(sim.camKickY * shakeMult);

  const playerVX = Math.round(VIRTUAL_WALL + (sim.px + 0.5) * VIRTUAL_CELL);
  const playerVY = Math.round((sim.py - 0.5 - topWorldRow) * VIRTUAL_CELL);
  const zoomFocusX = Math.round(VIRTUAL_W * 0.5 + (playerVX - VIRTUAL_W * 0.5) * 0.35);

  if (Math.abs(sim.camZoom - 1.0) > 0.002) {
    v.translate(zoomFocusX, playerVY);
    v.scale(sim.camZoom, sim.camZoom);
    v.translate(-zoomFocusX, -playerVY);
  }
  if (shakeX !== 0 || shakeY !== 0 || kickX !== 0 || kickY !== 0) {
    v.translate(shakeX + kickX, shakeY + kickY);
  }

  const startR = Math.max(sim.minPrunedRow, Math.floor(topWorldRow) - 4);
  const endR = Math.min(sim.maxGeneratedRow, Math.ceil(topWorldRow + visibleRows) + 4);

  // ==================== SHAFT CLIP REGION (overscanned for zoom-out) ====================
  v.save();
  v.beginPath();
  v.rect(VIRTUAL_WALL, -44, VIRTUAL_PLAY_W, vH + 88);
  v.clip();

  // Layer 0: Deep Vista Silhouettes (0.12x scroll)
  const vistaTile = getDeepVistaTile(
    baseStratum.id,
    activeBg,
    activeWallBorder,
    accentColor,
    baseStratum.isLightMode
  );
  const vistaOffY = (((sim.cameraRow * VIRTUAL_CELL * 0.12) % vistaTile.height) + vistaTile.height) % vistaTile.height;
  for (let ty = -vistaOffY - vistaTile.height; ty < vH + vistaTile.height * 2; ty += vistaTile.height) {
    for (let tx = VIRTUAL_WALL; tx < VIRTUAL_WALL + VIRTUAL_PLAY_W; tx += vistaTile.width) {
      v.drawImage(vistaTile, Math.round(tx), Math.round(ty));
    }
  }

  // Layer 1: Stratified Pixel Cavern Masonry (0.25x scroll)
  const bgTile = getParallaxCavernTile(
    baseStratum.id,
    activeBg,
    activeWallBorder,
    accentColor,
    baseStratum.isLightMode
  );
  const farOffY = (((sim.cameraRow * VIRTUAL_CELL * 0.25) % bgTile.height) + bgTile.height) % bgTile.height;
  v.globalAlpha = 0.72;
  for (let ty = -farOffY - bgTile.height; ty < vH + bgTile.height * 2; ty += bgTile.height) {
    for (let tx = VIRTUAL_WALL; tx < VIRTUAL_WALL + VIRTUAL_PLAY_W; tx += bgTile.width) {
      v.drawImage(bgTile, Math.round(tx), Math.round(ty));
    }
  }
  v.globalAlpha = 1;

  // Contrast backdrop wash so foreground blocks & player pop crisply
  v.fillStyle = baseStratum.isLightMode ? 'rgba(244,244,240,0.22)' : 'rgba(6,7,11,0.36)';
  v.fillRect(VIRTUAL_WALL, -44, VIRTUAL_PLAY_W, vH + 88);

  // Layer 1B: Biome-Specific Animated Wonders
  const animTick4 = Math.floor(timeSec * 6) & 3;
  if (baseStratum.id === 1) {
    const fanSpacing = VIRTUAL_CELL * 7;
    const fanOff = (((sim.cameraRow * VIRTUAL_CELL * 0.28) % fanSpacing) + fanSpacing) % fanSpacing;
    for (let fy = -fanOff + VIRTUAL_CELL * 2; fy < vH + fanSpacing; fy += fanSpacing) {
      const fx = Math.round(VIRTUAL_WALL + VIRTUAL_PLAY_W * 0.5);
      const rfy = Math.round(fy);
      v.fillStyle = 'rgba(0,0,0,0.58)';
      v.fillRect(fx - 14, rfy - 14, 28, 28);
      v.fillStyle = 'rgba(148,163,184,0.24)';
      v.fillRect(fx - 14, rfy - 14, 28, 1);
      v.fillRect(fx - 14, rfy + 13, 28, 1);
      v.fillStyle = 'rgba(100,116,139,0.48)';
      if (animTick4 % 2 === 0) {
        v.fillRect(fx - 11, rfy - 2, 22, 4);
        v.fillRect(fx - 2, rfy - 11, 4, 22);
      } else {
        for (let b = -9; b <= 9; b += 3) {
          v.fillRect(fx + b - 1, rfy + b - 1, 3, 3);
          v.fillRect(fx + b - 1, rfy - b - 1, 3, 3);
        }
      }
      const lampOn = Math.sin(timeSec * 4.5 + fy) > -0.6;
      v.fillStyle = lampOn ? '#F59E0B' : '#78350F';
      v.fillRect(VIRTUAL_WALL + 8, rfy - 4, 3, 3);
      v.fillRect(VIRTUAL_WALL + VIRTUAL_PLAY_W - 11, rfy - 4, 3, 3);
    }
  } else if (baseStratum.id === 2) {
    for (let i = 0; i < 5; i++) {
      const sx = VIRTUAL_WALL + ((i * 43 + 14) % (VIRTUAL_PLAY_W - 10));
      const shimmer = 0.09 + 0.06 * Math.sin(timeSec * 3.2 + i * 1.7);
      v.fillStyle = `rgba(63, 208, 244, ${shimmer.toFixed(3)})`;
      v.fillRect(sx, 0, 3, vH);
    }
  } else if (baseStratum.id === 3) {
    const pulse = 0.1 + 0.06 * Math.sin(timeSec * 4.2);
    v.fillStyle = `rgba(249,115,22,${pulse.toFixed(3)})`;
    v.fillRect(VIRTUAL_WALL, Math.round(vH * 0.58), VIRTUAL_PLAY_W, Math.round(vH * 0.42));
  } else if (baseStratum.id === 4) {
    const pingPhase = (timeSec * 0.45) % 1;
    const pingRad = Math.round(pingPhase * VIRTUAL_PLAY_W * 0.65);
    v.globalAlpha = (1 - pingPhase) * 0.25;
    drawPixelCircle(v, VIRTUAL_WALL + VIRTUAL_PLAY_W * 0.5, vH * 0.45, pingRad, '#A3E635', 1);
    v.globalAlpha = 1;
  } else if (baseStratum.id === 5) {
    for (let i = 0; i < 12; i++) {
      const rx = VIRTUAL_WALL + ((i * 19 + 8) % (VIRTUAL_PLAY_W - 6));
      const ry = Math.round(((timeSec * (45 + (i % 4) * 18) + i * 33) % (vH + 20)) - 10);
      v.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(161,161,170,0.16)';
      v.fillRect(rx, ry, 1, 6);
      v.fillStyle = 'rgba(255,255,255,0.5)';
      v.fillRect(rx, ry + 6, 1, 1);
    }
  } else if (baseStratum.id === 6) {
    const cx = Math.round(VIRTUAL_WALL + VIRTUAL_PLAY_W * 0.5);
    const cy = Math.round(vH * 0.44);
    const r = Math.round(VIRTUAL_PLAY_W * 0.28 + Math.sin(timeSec * 2) * 4);
    drawPixelCircle(v, cx, cy, r, 'rgba(181, 142, 62, 0.28)', 1);
  } else if (baseStratum.id === 7) {
    // VII. Horizonte de Eventos: rotating accretion singularity & upward time-shards
    const cx = Math.round(VIRTUAL_WALL + VIRTUAL_PLAY_W * 0.5);
    const cy = Math.round(vH * 0.36);
    v.fillStyle = '#030306';
    drawPixelCircle(v, cx, cy, 18, '#F472B6', 1);
    v.fillStyle = '#05050A';
    v.fillRect(cx - 14, cy - 14, 28, 28);
    drawPixelCircle(v, cx, cy, 28 + Math.round(Math.sin(timeSec * 3) * 3), 'rgba(250, 204, 21, 0.26)', 1);
    for (let k = 0; k < 8; k++) {
      const ang = timeSec * 1.9 + (k * Math.PI) / 4;
      const ox = Math.round(cx + Math.cos(ang) * 32);
      const oy = Math.round(cy + Math.sin(ang) * 14);
      v.fillStyle = k % 2 === 0 ? '#F472B6' : '#FACC15';
      v.fillRect(ox - 1, oy - 1, 3, 2);
    }
    for (let i = 0; i < 10; i++) {
      const tx = VIRTUAL_WALL + ((i * 23 + 12) % (VIRTUAL_PLAY_W - 8));
      const ty = Math.round(((vH - (timeSec * (26 + (i % 3) * 12) + i * 31)) % vH + vH) % vH);
      v.fillStyle = i % 2 === 0 ? 'rgba(244, 114, 182, 0.35)' : 'rgba(250, 204, 21, 0.32)';
      v.fillRect(tx, ty, 2, 5);
    }
  }

  // Layer 2: Mid-ground Steel Scaffolding & Elevator Guide Rails (0.48x scroll)
  const midTile = getParallaxMidgroundScaffolding(
    baseStratum.id,
    activeWallBorder,
    accentColor,
    baseStratum.isLightMode
  );
  const midOffY = (((sim.cameraRow * VIRTUAL_CELL * 0.48) % midTile.height) + midTile.height) % midTile.height;
  for (let my = -midOffY; my < vH + midTile.height; my += midTile.height) {
    v.drawImage(midTile, VIRTUAL_WALL, Math.round(my));
  }

  // Subtle column guide grooves
  for (let c = 1; c < GRID_COLS; c++) {
    const x = VIRTUAL_WALL + c * VIRTUAL_CELL;
    v.fillStyle = baseStratum.isLightMode ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.2)';
    v.fillRect(x, 0, 1, vH);
  }

  // Architectural Depth Stamps every 25m/50m + Seismic Seal & 500m Horizon bands (Pure Pixel Bitmap Text!)
  const firstStamp = Math.floor(startR / 25) * 25;
  for (let sr = firstStamp; sr <= endR; sr += 25) {
    if (sr <= 0) continue;
    const screenY = Math.round((sr - topWorldRow) * VIRTUAL_CELL);
    const isMajor = sr % 50 === 0;
    const isSeal = sr % 100 === 0;

    if (sr % 500 === 0) {
      const nextBiome = sim.getStratumForRow(sr + 5);
      const bColB = nextBiome.blockColors[0] || '#FACC15';
      v.fillStyle = shadeHex(bColB, 0.1, 0.18);
      v.fillRect(VIRTUAL_WALL, screenY - 12, VIRTUAL_PLAY_W, 24);
      v.fillStyle = bColB;
      v.fillRect(VIRTUAL_WALL, screenY - 1, VIRTUAL_PLAY_W, 2);
      drawPixelText(
        v,
        `HORIZONTE ${nextBiome.name.toUpperCase()} · ${sr}M`,
        VIRTUAL_WALL + VIRTUAL_PLAY_W * 0.5,
        screenY - 11,
        '#FFFFFF',
        { align: 'center', scale: 1 }
      );
    } else if (isSeal) {
      v.fillStyle = 'rgba(56, 189, 248, 0.1)';
      v.fillRect(VIRTUAL_WALL, screenY - 3, VIRTUAL_PLAY_W, 6);
      v.fillStyle = 'rgba(56, 189, 248, 0.42)';
      v.fillRect(VIRTUAL_WALL, screenY, VIRTUAL_PLAY_W, 1);
    } else if (isMajor) {
      v.fillStyle = baseStratum.isLightMode ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.08)';
      v.fillRect(VIRTUAL_WALL, screenY, VIRTUAL_PLAY_W, 1);
    }

    if (isMajor) {
      v.globalAlpha = baseStratum.isLightMode ? 0.14 : 0.12;
      drawPixelText(
        v,
        `${String(sr).padStart(4, '0')}M`,
        VIRTUAL_WALL + VIRTUAL_PLAY_W * 0.5,
        screenY - 10,
        baseStratum.isLightMode ? '#141416' : '#FFFFFF',
        { align: 'center', scale: 3, outline: 'none', shadow: false }
      );
      v.globalAlpha = 1;
    }
  }

  // Ambient drifting mineral dust / embers / snow motes
  for (let i = 0; i < 24; i++) {
    const layer = i % 2 === 0 ? 0.28 : 0.56;
    const mx =
      VIRTUAL_WALL +
      (((Math.round(i * 37 + Math.sin(timeSec * 0.8 + i) * 7) % VIRTUAL_PLAY_W) + VIRTUAL_PLAY_W) %
        VIRTUAL_PLAY_W);
    const my =
      ((Math.round(i * 53 - sim.cameraRow * VIRTUAL_CELL * layer - timeSec * (8 + (i % 4) * 3)) % vH) + vH) % vH;
    v.fillStyle =
      i % 4 === 0
        ? shadeHex(accentColor, 0.3, 0.55)
        : baseStratum.isLightMode
        ? 'rgba(20,20,22,0.22)'
        : 'rgba(255,255,255,0.22)';
    const sz = i % 3 === 0 ? 2 : 1;
    v.fillRect(mx, my, sz, sz);
  }

  // Ambient Occlusion: wall edges + drop shadows beneath overhanging blocks
  v.fillStyle = baseStratum.isLightMode ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.45)';
  v.fillRect(VIRTUAL_WALL, 0, 2, vH);
  v.fillRect(VIRTUAL_WALL + VIRTUAL_PLAY_W - 2, 0, 2, vH);

  for (let r = startR; r <= endR; r++) {
    const row = sim.grid.get(r);
    if (!row) continue;
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = row[c];
      if (cell.state === 'EMPTY' || cell.state === 'DETONATING') continue;
      const below = sim.getCell(r + 1, c);
      if (below.state === 'EMPTY' && cell.state !== 'FALLING') {
        const sx = VIRTUAL_WALL + c * VIRTUAL_CELL + 1;
        const sy = Math.round((r + 1 - topWorldRow) * VIRTUAL_CELL);
        v.fillRect(sx, sy, VIRTUAL_CELL - 2, 3);
      }
    }
  }

  // Hanging Verlet Shaft Cables & Sizzling Acid Puddles
  for (const cable of sim.fx.shaftCables.values()) {
    const nodes = cable.nodes;
    for (let i = 0; i < nodes.length - 1; i++) {
      const x0 = Math.round(VIRTUAL_WALL + nodes[i].x * VIRTUAL_CELL);
      const y0 = Math.round((nodes[i].y - topWorldRow) * VIRTUAL_CELL);
      const x1 = Math.round(VIRTUAL_WALL + nodes[i + 1].x * VIRTUAL_CELL);
      const y1 = Math.round((nodes[i + 1].y - topWorldRow) * VIRTUAL_CELL);
      drawPixelLine(v, x0, y0, x1, y1, '#09090B', 2);
      drawPixelLine(v, x0, y0, x1, y1, cable.color, 1);
    }
    const tip = nodes[nodes.length - 1];
    const tx = Math.round(VIRTUAL_WALL + tip.x * VIRTUAL_CELL);
    const ty = Math.round((tip.y - topWorldRow) * VIRTUAL_CELL);
    v.fillStyle = timeSec % 1 < 0.5 ? '#F59E0B' : '#38BDF8';
    v.fillRect(tx - 1, ty - 1, 2, 2);
  }

  for (const puddle of sim.acidPuddles) {
    if (puddle.timer <= 0) continue;
    const px = VIRTUAL_WALL + puddle.c * VIRTUAL_CELL;
    const py = Math.round((puddle.r - topWorldRow) * VIRTUAL_CELL) - 3;
    const fade = Math.min(1, puddle.timer / 40);
    v.globalAlpha = fade;
    v.fillStyle = '#166534';
    v.fillRect(px + 2, py, VIRTUAL_CELL - 4, 3);
    v.fillStyle = '#4ADE80';
    v.fillRect(px + 3, py, VIRTUAL_CELL - 6, 2);
    if (Math.floor(timeSec * 10 + puddle.c) % 2 === 0) {
      v.fillStyle = '#DCFCE7';
      v.fillRect(px + 6 + ((puddle.c * 5) % 8), py - 1, 2, 2);
    }
    v.globalAlpha = 1;
  }

  // ==================== CELLS (24x24 BESPOKE PIXEL SPRITES) ====================
  const anim4 = Math.floor(timeSec * 6) & 3;
  const fastAnim4 = Math.floor(timeSec * 14) & 3;

  for (let r = startR; r <= endR; r++) {
    const row = sim.grid.get(r);
    if (!row) continue;
    const rowStratum = sim.getStratumForRow(r);

    for (let c = 0; c < GRID_COLS; c++) {
      const cell = row[c];
      if (cell.state === 'EMPTY') continue;

      let drawX = VIRTUAL_WALL + c * VIRTUAL_CELL;
      let drawY = (r - topWorldRow) * VIRTUAL_CELL;

      if (cell.state === 'FALLING') {
        drawY += cell.fallOffset * VIRTUAL_CELL;
      }

      if (cell.state === 'SWAPPING') {
        const fromX = VIRTUAL_WALL + cell.swapFromCol * VIRTUAL_CELL;
        const fromY = (cell.swapFromRow - topWorldRow) * VIRTUAL_CELL;
        const t = Math.min(1, cell.swapProgress);
        const ease = 1 - Math.pow(1 - t, 2.2);
        drawX = fromX + (drawX - fromX) * ease;
        drawY = fromY + (drawY - fromY) * ease;
      }

      if (cell.state === 'WOBBLE') {
        const urgency = cell.wobbleTimer / Math.max(1, cell.wobbleMax);
        const amp = 0.6 + urgency * 1.4;
        drawX += Math.round(Math.sin(timeSec * 56 + r * 3 + c * 5) * amp);
      }

      // Spring landing bounce squash (bottom-anchored!)
      const bouncePx = cell.landBounce && cell.landBounce > 0.05 ? Math.round(cell.landBounce * 3) : 0;
      const ix = Math.round(drawX);
      const iy = Math.round(drawY) + bouncePx;
      const drawW = VIRTUAL_CELL;
      const drawH = VIRTUAL_CELL - bouncePx;

      const kind = cell.kind || 'SOLID';
      const hitFlash = Boolean(cell.hitFlash && cell.hitFlash > 0);
      const colorHex = cell.color >= 0 ? rowStratum.blockColors[cell.color] : '#9CA3AF';

      if (kind === 'OXYGEN') {
        const bob = Math.round(Math.sin(timeSec * 5 + r) * 1.2);
        v.drawImage(getOxygenPodSprite(anim4), ix, iy + bob, drawW, drawH);
        continue;
      }
      if (kind === 'SLAG') {
        const variant = (r * 7 + c * 13) & 3;
        v.drawImage(
          getSlagBlockSprite(rowStratum.slagColor, cell.hp, Boolean(cell.isVolatileSlag), variant, anim4, hitFlash),
          ix,
          iy,
          drawW,
          drawH
        );
        if (cell.hp > 0 && cell.hp < 5) {
          const veinCol = cell.isVolatileSlag ? '#A3E635' : '#F97316';
          for (let p = 0; p < 5; p++) {
            v.fillStyle = p < cell.hp ? veinCol : '#09090B';
            v.fillRect(ix + 2 + p * 4, iy + drawH - 4, 3, 2);
          }
        }
        continue;
      }
      if (kind === 'RIVET') {
        v.drawImage(getRivetBlockSprite((r + c) & 3, anim4), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'CONDUCTOR') {
        v.drawImage(getConductorBlockSprite(anim4, hitFlash), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'GEODE') {
        v.drawImage(getGeodeBlockSprite((anim4 + r + c) & 3), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'CRYO_VENT') {
        v.drawImage(getCryoVentBlockSprite((anim4 + r) & 3), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'MAGMA_NODE') {
        v.drawImage(getMagmaNodeBlockSprite((anim4 + c) & 3), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'GRAVEL') {
        v.drawImage(getGravelBlockSprite((r * 5 + c * 3) & 3), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'BOUNCE_PAD') {
        const bActive = Boolean(cell.bounceAnim && cell.bounceAnim > 0);
        v.drawImage(getBouncePadBlockSprite(anim4, bActive), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'GAS_POCKET') {
        v.drawImage(getGasPocketBlockSprite((anim4 + r + c) & 3), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'ACID_VAT') {
        v.drawImage(getAcidVatBlockSprite((anim4 + c) & 3), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'GRAV_WELL') {
        v.drawImage(getGravWellBlockSprite((anim4 + r) & 3), ix, iy, drawW, drawH);
        const pulseR = 14 + (anim4 % 3) * 4;
        drawPixelCircle(v, ix + 12, iy + 12, pulseR, 'rgba(192,132,252,0.32)', 1);
        continue;
      }
      if (kind === 'SHOCK_MINE') {
        const armed = Boolean(cell.mineArmed);
        v.drawImage(getShockMineBlockSprite(armed ? fastAnim4 : anim4, armed), ix, iy, drawW, drawH);
        if (armed && cell.mineTimer !== undefined) {
          const ratio = Math.max(0, Math.min(1, cell.mineTimer / 72));
          v.fillStyle = '#09090B';
          v.fillRect(ix + 2, iy + drawH - 4, VIRTUAL_CELL - 4, 3);
          v.fillStyle = ratio < 0.35 ? '#FFFFFF' : '#E11D48';
          v.fillRect(ix + 3, iy + drawH - 3, Math.max(0, Math.round((VIRTUAL_CELL - 6) * ratio)), 1);
        }
        continue;
      }
      if (kind === 'TREASURE_CACHE') {
        v.drawImage(getTreasureCacheBlockSprite(anim4), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'ARTIFACT_POD') {
        const art = ARTIFACTS.find((a) => a.id === cell.artifactId) || ARTIFACTS[0];
        v.drawImage(getArtifactPodSprite(art.color, art.accent, anim4), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'MONOLITH') {
        const mHex = cell.monolithColor !== undefined ? rowStratum.blockColors[cell.monolithColor] : '#FFFFFF';
        v.drawImage(getMonolithBlockSprite(mHex, anim4), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'PHASE_KEY') {
        v.drawImage(getPhaseKeyBlockSprite(anim4), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'GHOST_ECHO') {
        v.drawImage(getGhostEchoBlockSprite(anim4), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'EXTRACTION_TUBE') {
        v.drawImage(getExtractionTubeSprite(anim4), ix, iy, drawW, drawH);
        continue;
      }
      if (kind === 'BREACH_SEAL' || kind === 'BIFURCATION_SEAL') {
        const sHex = kind === 'BIFURCATION_SEAL' ? '#FBBF24' : '#38BDF8';
        v.drawImage(getSealGateSprite(sHex, kind === 'BIFURCATION_SEAL', anim4), ix, iy, drawW, drawH);
        continue;
      }

      if (cell.state === 'IGNITING') {
        const fuseRatio = 1 - cell.fuseTimer / Math.max(1, cell.fuseMax);
        v.drawImage(getIgnitingBlockSprite(colorHex, cell.chainLevel, fastAnim4), ix, iy, drawW, drawH);
        // Pixel fuse meter along bottom edge
        v.fillStyle = '#09090B';
        v.fillRect(ix + 2, iy + drawH - 5, VIRTUAL_CELL - 4, 3);
        v.fillStyle = '#FFFFFF';
        v.fillRect(ix + 3, iy + drawH - 4, Math.max(0, Math.round((VIRTUAL_CELL - 6) * (1 - fuseRatio))), 1);

        // Crackling pixel lightning arc bridging adjacent IGNITING or CONDUCTOR neighbors!
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
          [0, -1],
          [-1, 0],
        ]) {
          const nb = sim.getCell(r + dr, c + dc);
          const isIgnitingFwd = nb.state === 'IGNITING' && (dr > 0 || dc > 0);
          if (isIgnitingFwd || nb.kind === 'CONDUCTOR') {
            const jx = ((fastAnim4 * 3 + r + c) % 3) - 1;
            const jy = ((fastAnim4 * 5 + r) % 3) - 1;
            drawPixelLine(
              v,
              ix + 12,
              iy + 12,
              ix + 12 + dc * VIRTUAL_CELL + jx,
              iy + 12 + dr * VIRTUAL_CELL + jy,
              fastAnim4 % 2 === 0 ? '#FFFFFF' : '#FEF08A',
              1
            );
          }
        }
        continue;
      }

      if (cell.state === 'DETONATING') {
        v.fillStyle = '#FFFFFF';
        v.fillRect(ix - 2, iy - 2, VIRTUAL_CELL + 4, VIRTUAL_CELL + 4);
        v.fillStyle = '#FEF08A';
        v.fillRect(ix - 5, iy + 8, VIRTUAL_CELL + 10, 8);
        v.fillRect(ix + 8, iy - 5, 8, VIRTUAL_CELL + 10);
        continue;
      }

      if (kind === 'CRYSTAL') {
        v.globalAlpha = cell.crystalTriggered ? 0.72 : 0.96;
        v.drawImage(
          getCrystalBlockSprite(colorHex, cell.color, Boolean(cell.crystalTriggered), (anim4 + r + c) & 3),
          ix,
          iy,
          drawW,
          drawH
        );
        v.globalAlpha = 1;
        continue;
      }

      if (kind === 'PHASE') {
        const altHex =
          cell.altColor !== undefined
            ? rowStratum.blockColors[cell.altColor % rowStratum.blockColors.length]
            : '#FFFFFF';
        v.drawImage(
          getPhaseBlockSprite(colorHex, altHex, cell.color, Boolean(sim.phaseShiftWarning), (anim4 + r) & 3),
          ix,
          iy,
          drawW,
          drawH
        );
      } else {
        // 16-State Seamless Connected Texture Mineral Block
        const sameColor = (nr: number, nc: number): boolean => {
          if (cell.state !== 'SOLID' && cell.state !== 'WOBBLE') return false;
          const n = sim.getCell(nr, nc);
          return (
            (n.state === 'SOLID' || n.state === 'WOBBLE') &&
            (n.kind === 'SOLID' || n.kind === 'PHASE') &&
            n.color === cell.color
          );
        };
        const joinMask =
          (sameColor(r - 1, c) ? 1 : 0) |
          (sameColor(r, c + 1) ? 2 : 0) |
          (sameColor(r + 1, c) ? 4 : 0) |
          (sameColor(r, c - 1) ? 8 : 0);
        const variant = (cell.id + r * 3 + c * 5) & 3;
        v.drawImage(
          getMineralBlockSprite(
            rowStratum.id,
            colorHex,
            cell.color,
            variant,
            joinMask,
            rowStratum.isLightMode
          ),
          ix,
          iy,
          drawW,
          drawH
        );

        // Smooth harmonic silhouette pulse on 3-block near-match clusters (replaces jarring corner blink)
        if (cell.nearMatch && (cell.state === 'SOLID' || cell.state === 'WOBBLE')) {
          const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.6 + cell.clusterId * 1.3);
          const rgb = rowStratum.isLightMode ? '245, 158, 11' : '255, 250, 224';
          const washAlpha = (0.02 + pulse * 0.06).toFixed(3);
          const rimAlpha = (0.18 + pulse * 0.34).toFixed(3);
          const joinTop = (joinMask & 1) !== 0;
          const joinRight = (joinMask & 2) !== 0;
          const joinBottom = (joinMask & 4) !== 0;
          const joinLeft = (joinMask & 8) !== 0;

          v.fillStyle = `rgba(${rgb}, ${washAlpha})`;
          v.fillRect(ix + 1, iy + 1, drawW - 2, drawH - 2);

          v.fillStyle = `rgba(${rgb}, ${rimAlpha})`;
          if (!joinTop) v.fillRect(ix + (joinLeft ? 0 : 1), iy + 1, drawW - (joinLeft ? 0 : 1) - (joinRight ? 0 : 1), 1);
          if (!joinBottom)
            v.fillRect(ix + (joinLeft ? 0 : 1), iy + drawH - 2, drawW - (joinLeft ? 0 : 1) - (joinRight ? 0 : 1), 1);
          if (!joinLeft) v.fillRect(ix + 1, iy + (joinTop ? 0 : 1), 1, drawH - (joinTop ? 0 : 1) - (joinBottom ? 0 : 1));
          if (!joinRight)
            v.fillRect(ix + drawW - 2, iy + (joinTop ? 0 : 1), 1, drawH - (joinTop ? 0 : 1) - (joinBottom ? 0 : 1));

          // Soft harmonic bridge across internal joined seams
          v.fillStyle = `rgba(${rgb}, ${(0.22 + pulse * 0.38).toFixed(3)})`;
          if (joinRight) v.fillRect(ix + drawW - 2, iy + Math.floor(drawH * 0.5) - 2, 2, 4);
          if (joinBottom) v.fillRect(ix + Math.floor(drawW * 0.5) - 2, iy + drawH - 2, 4, 2);
        }
      }

      if (cell.state === 'WOBBLE') {
        const urg = cell.wobbleTimer / Math.max(1, cell.wobbleMax);
        v.fillStyle = `rgba(255, 245, 190, ${(0.5 + urg * 0.5).toFixed(2)})`;
        v.fillRect(ix + 5, iy + 5, 6, 2);
        v.fillRect(ix + 10, iy + 7, 2, 7);
        v.fillRect(ix + 8, iy + 14, 7, 2);
      }

      if (hitFlash) {
        v.fillStyle = 'rgba(255,255,255,0.75)';
        v.fillRect(ix, iy, drawW, drawH);
      }
    }
  }

  // ==================== BREACH CHAMBER & BIFURCATION PIXEL CARDS ====================
  if (sim.activeBreach && !sim.activeBreach.resolved) {
    const brY = Math.round((sim.activeBreach.yRow - topWorldRow) * VIRTUAL_CELL);
    sim.activeBreach.options.forEach((opt, idx) => {
      const gx = VIRTUAL_WALL + idx * 3 * VIRTUAL_CELL;
      const gw = 3 * VIRTUAL_CELL; // 72px
      const mod = MODULES.find((m) => m.id === opt.moduleId);
      const oc = OVERCHARGES.find((o) => o.id === opt.moduleId);
      const title = (mod ? mod.name : oc ? oc.name : opt.moduleId).slice(0, 10);
      const archColor = opt.isOvercharge
        ? '#E11D48'
        : mod
        ? ARCHETYPE_COLORS[mod.archetype]
        : '#FFFFFF';

      v.fillStyle = 'rgba(12, 13, 18, 0.94)';
      v.fillRect(gx + 2, brY - 46, gw - 4, 42);
      v.fillStyle = archColor;
      v.fillRect(gx + 2, brY - 46, gw - 4, 2);
      v.fillRect(gx + 2, brY - 5, gw - 4, 1);
      v.fillRect(gx + 2, brY - 46, 1, 42);
      v.fillRect(gx + gw - 3, brY - 46, 1, 42);

      const tag = opt.isOvercharge ? 'SOBREC' : opt.isUpgrade ? 'MK-II' : 'MODULO';
      drawPixelText(v, tag, gx + gw * 0.5, brY - 40, archColor, { align: 'center', scale: 1 });
      drawPixelText(v, title, gx + gw * 0.5, brY - 28, '#FFFFFF', { align: 'center', scale: 1 });
      drawPixelText(v, 'PICAR', gx + gw * 0.5, brY - 16, '#A1A1AA', { align: 'center', scale: 1 });
    });
  }

  if (sim.activeBifurcation && !sim.activeBifurcation.resolved) {
    const bifY = Math.round((sim.activeBifurcation.yRow - topWorldRow) * VIRTUAL_CELL);
    const drawBranch = (x: number, w: number, title: string, desc: string, color: string) => {
      v.fillStyle = 'rgba(12, 13, 18, 0.94)';
      v.fillRect(x + 2, bifY - 44, w - 4, 40);
      v.fillStyle = color;
      v.fillRect(x + 2, bifY - 44, w - 4, 2);
      v.fillRect(x + 2, bifY - 5, w - 4, 1);
      drawPixelText(v, title.slice(0, 14), x + w * 0.5, bifY - 36, color, { align: 'center', scale: 1 });
      drawPixelText(v, desc.slice(0, 15), x + w * 0.5, bifY - 22, '#E5E7EB', { align: 'center', scale: 1 });
    };
    drawBranch(
      VIRTUAL_WALL,
      4 * VIRTUAL_CELL,
      sim.activeBifurcation.leftTitle,
      sim.activeBifurcation.leftDesc,
      '#4AC6E8'
    );
    drawBranch(
      VIRTUAL_WALL + 5 * VIRTUAL_CELL,
      4 * VIRTUAL_CELL,
      sim.activeBifurcation.rightTitle,
      sim.activeBifurcation.rightDesc,
      '#FBBF24'
    );
  }

  // ==================== BESPOKE PIXEL-ART GUARDIANS ====================
  if (sim.activeGuardian) {
    const g = sim.activeGuardian;
    const bossFlash = g.hitFlashTimer > 0;
    const isP2 = g.phase === 2;

    // Shared vertical column telegraph for boss attacks
    if (g.attackWarnTimer > 0 && g.attackCols.length > 0) {
      for (const ac of g.attackCols) {
        const ax = VIRTUAL_WALL + ac * VIRTUAL_CELL;
        v.fillStyle = fastAnim4 % 2 === 0 ? 'rgba(244, 63, 94, 0.24)' : 'rgba(250, 204, 21, 0.14)';
        v.fillRect(ax + 3, 0, VIRTUAL_CELL - 6, vH);
        drawPixelText(v, '▼', ax + 12, 8, fastAnim4 % 2 === 0 ? '#FFFFFF' : '#F43F5E', { align: 'center', scale: 1 });
      }
    }

    if (g.id === 'WARDEN') {
      const wx = Math.round(VIRTUAL_WALL + (g.pendulumCol + 0.5) * VIRTUAL_CELL);
      const wy = Math.round((g.arenaRow - 4 - topWorldRow) * VIRTUAL_CELL);
      if (isP2) drawPixelCircle(v, wx, wy, 29 + (fastAnim4 & 1) * 2, '#F43F5E', 1);
      const ws = getCrystalWardenSprite(anim4, bossFlash);
      v.drawImage(ws, wx - 28, wy - 28);
      for (const anchor of g.loomAnchors) {
        if (anchor.hp <= 0) continue;
        const ax = VIRTUAL_WALL + anchor.col * VIRTUAL_CELL;
        const ay = Math.round((anchor.row - topWorldRow) * VIRTUAL_CELL);
        v.drawImage(getCrystalBlockSprite('#38BDF8', 0, false, anim4), ax, ay);
      }
    } else if (g.id === 'LOOM') {
      const anchorSprite = getLoomAnchorSprite(anim4, bossFlash);
      for (const anchor of g.loomAnchors) {
        if (anchor.hp <= 0) continue;
        const ax = VIRTUAL_WALL + anchor.col * VIRTUAL_CELL;
        const ay = Math.round((anchor.row - topWorldRow) * VIRTUAL_CELL);
        v.drawImage(anchorSprite, ax, ay);
      }
      if (g.laserWarningRow !== null) {
        const ly = Math.round((g.laserWarningRow - topWorldRow) * VIRTUAL_CELL);
        v.fillStyle = `rgba(245, 158, 11, ${0.26 + 0.2 * Math.sin(timeSec * 28)})`;
        v.fillRect(VIRTUAL_WALL, ly, VIRTUAL_PLAY_W, VIRTUAL_CELL);
        v.fillStyle = anim4 % 2 === 0 ? '#FFFFFF' : '#FACC15';
        v.fillRect(VIRTUAL_WALL, ly + 11, VIRTUAL_PLAY_W, 2);
      }
    } else if (g.id === 'FORGE') {
      const fy = Math.round((g.arenaRow - 5 - topWorldRow) * VIRTUAL_CELL);
      v.drawImage(getForgeBossSprite(anim4, 'LEFT', bossFlash), VIRTUAL_WALL, fy);
      v.drawImage(getForgeBossSprite(anim4, 'RIGHT', bossFlash), VIRTUAL_WALL + VIRTUAL_PLAY_W - 28, fy);
      if (g.laserWarningRow !== null) {
        const ly = Math.round((g.laserWarningRow - topWorldRow) * VIRTUAL_CELL);
        v.fillStyle = 'rgba(249, 115, 22, 0.25)';
        v.fillRect(VIRTUAL_WALL, ly, VIRTUAL_PLAY_W, VIRTUAL_CELL);
        v.fillStyle = anim4 % 2 === 0 ? '#FEF08A' : '#F97316';
        v.fillRect(VIRTUAL_WALL, ly + 10, VIRTUAL_PLAY_W, 4);
      }
    } else if (g.id === 'PENDULUM') {
      const pxCenter = Math.round(VIRTUAL_WALL + (g.pendulumCol + 0.5) * VIRTUAL_CELL);
      const pyCenter = Math.round((g.arenaRow - 4 - topWorldRow) * VIRTUAL_CELL);
      if (isP2) drawPixelCircle(v, pxCenter, pyCenter, 34, '#F43F5E', 1);
      // Hanging iron chains from ceiling
      for (const cxOff of [-14, 14]) {
        for (let cy = 0; cy < pyCenter - 26; cy += 5) {
          v.fillStyle = '#475569';
          v.fillRect(pxCenter + cxOff, cy, 2, 4);
          v.fillStyle = '#94A3B8';
          v.fillRect(pxCenter + cxOff, cy, 1, 1);
        }
      }
      const pendSprite = getPendulumBossSprite(g.hp / Math.max(1, g.maxHp), anim4, bossFlash);
      v.drawImage(pendSprite, pxCenter - 32, pyCenter - 32);
    } else if (g.id === 'ARCHITECT') {
      const ceilY = Math.round((g.ceilingRow - topWorldRow) * VIRTUAL_CELL);
      if (ceilY > 0) {
        v.fillStyle = bossFlash ? '#FFFFFF' : '#141418';
        v.fillRect(VIRTUAL_WALL, 0, VIRTUAL_PLAY_W, Math.max(0, ceilY - 24));
        const tile = getArchitectCeilingTile(anim4);
        for (let tx = VIRTUAL_WALL; tx < VIRTUAL_WALL + VIRTUAL_PLAY_W; tx += tile.width) {
          v.drawImage(tile, tx, ceilY - 24);
        }
      }
    } else if (g.id === 'CHRONOLITH') {
      const cxCenter = Math.round(VIRTUAL_WALL + (g.pendulumCol + 0.5) * VIRTUAL_CELL);
      const cyCenter = Math.round((g.arenaRow - 5 - topWorldRow) * VIRTUAL_CELL);
      if (isP2) drawPixelCircle(v, cxCenter, cyCenter, 36 + (fastAnim4 & 1) * 2, '#FACC15', 1);
      v.drawImage(getChronolithBossSprite(anim4, bossFlash), cxCenter - 32, cyCenter - 32);
      const anchorSprite = getLoomAnchorSprite(anim4, bossFlash);
      for (const anchor of g.loomAnchors) {
        if (anchor.hp <= 0) continue;
        const ax = VIRTUAL_WALL + anchor.col * VIRTUAL_CELL;
        const ay = Math.round((anchor.row - topWorldRow) * VIRTUAL_CELL);
        v.drawImage(anchorSprite, ax, ay);
      }
    }
  }

  // ==================== ENVIRONMENTAL HAZARD TELEGRAPHS ====================
  if (sim.activeHazard && sim.activeHazard.type !== 'NONE') {
    const hz = sim.activeHazard;
    if (hz.targetCols && hz.targetCols.length > 0 && (hz.warningTimer > 0 || hz.activeTimer > 0)) {
      const isActive = hz.warningTimer <= 0;
      for (const hc of hz.targetCols) {
        const hx = VIRTUAL_WALL + hc * VIRTUAL_CELL;
        v.fillStyle = isActive
          ? 'rgba(244, 63, 94, 0.25)'
          : anim4 % 2 === 0
          ? 'rgba(56, 189, 248, 0.14)'
          : 'rgba(250, 204, 21, 0.12)';
        v.fillRect(hx + 2, 0, VIRTUAL_CELL - 4, vH);
        drawPixelText(v, isActive ? '!!' : '!', hx + 12, 8, isActive ? '#FB7185' : '#FACC15', {
          align: 'center',
          scale: 1,
        });
      }
    }
    if (hz.type === 'MAGMA_UPDRAFT' && (hz.warningTimer > 0 || hz.activeTimer > 0)) {
      v.fillStyle = hz.warningTimer > 0 ? 'rgba(249, 115, 22, 0.12)' : 'rgba(249, 115, 22, 0.24)';
      v.fillRect(VIRTUAL_WALL, vH - 18, VIRTUAL_PLAY_W, 18);
    }
  }

  // Stratum VI Living Alabaster-Gold Ceiling
  if (sim.inStratum6) {
    const ceilY = Math.round((sim.stratum6CeilingRow - topWorldRow) * VIRTUAL_CELL);
    if (ceilY > 0) {
      v.fillStyle = '#141416';
      v.fillRect(VIRTUAL_WALL, 0, VIRTUAL_PLAY_W, Math.max(0, ceilY - 24));
      const tile = getArchitectCeilingTile(anim4);
      for (let tx = VIRTUAL_WALL; tx < VIRTUAL_WALL + VIRTUAL_PLAY_W; tx += tile.width) {
        v.drawImage(tile, tx, ceilY - 24);
      }
    }
  }

  // ==================== TACTICAL PIXEL TELEGRAPHS ====================
  const pRow = Math.max(0, sim.gridRow);
  const pCol = Math.max(0, Math.min(GRID_COLS - 1, sim.gridCol));

  // Overhead Danger Collapse Column Warning ([!])
  if (sim.overheadDangerCol && !sim.finished) {
    const wx = VIRTUAL_WALL + pCol * VIRTUAL_CELL;
    const blink = fastAnim4 % 2 === 0;
    v.fillStyle = blink ? 'rgba(225, 29, 72, 0.22)' : 'rgba(245, 158, 11, 0.12)';
    v.fillRect(wx + 2, 0, VIRTUAL_CELL - 4, Math.max(0, playerVY - 16));
    drawPixelText(v, '!', wx + 12, 6, blink ? '#FFFFFF' : '#F43F5E', { align: 'center', scale: 2 });
  }

  // Active Drill Target Reticle
  let aimDr = 1;
  let aimDc = 0;
  if (sim.aimDir === 'UP') {
    aimDr = -1;
    aimDc = 0;
  } else if (sim.aimDir === 'LEFT') {
    aimDr = 0;
    aimDc = -1;
  } else if (sim.aimDir === 'RIGHT') {
    aimDr = 0;
    aimDc = 1;
  }
  const targetR = pRow + aimDr;
  const targetC = pCol + aimDc;
  if (targetC >= 0 && targetC < GRID_COLS && targetR >= 0) {
    const tCell = sim.getCell(targetR, targetC);
    if (tCell.state !== 'EMPTY') {
      const tx = VIRTUAL_WALL + targetC * VIRTUAL_CELL;
      const ty = Math.round((targetR - topWorldRow) * VIRTUAL_CELL);
      const isLatched = sim.aimDir !== 'DOWN';
      v.fillStyle = isLatched ? 'rgba(250, 204, 21, 0.14)' : 'rgba(250, 204, 21, 0.07)';
      v.fillRect(tx + 1, ty + 1, VIRTUAL_CELL - 2, VIRTUAL_CELL - 2);
      drawPixelReticle(v, tx, ty, anim4 % 2 === 0 ? '#FACC15' : '#FEF08A');
    }
  }

  // Hover Reticle & Live Right-Click Drag Directional Swap Preview
  if (rmbDrag && rmbDrag.c >= 0 && rmbDrag.c < GRID_COLS && rmbDrag.r >= 0) {
    const sx = VIRTUAL_WALL + rmbDrag.c * VIRTUAL_CELL;
    const sy = Math.round((rmbDrag.r - topWorldRow) * VIRTUAL_CELL);
    const dx = VIRTUAL_WALL + rmbDrag.targetC * VIRTUAL_CELL;
    const dy = Math.round((rmbDrag.targetR - topWorldRow) * VIRTUAL_CELL);

    v.fillStyle = 'rgba(250, 204, 21, 0.16)';
    v.fillRect(sx + 1, sy + 1, VIRTUAL_CELL - 2, VIRTUAL_CELL - 2);
    v.fillStyle = 'rgba(56, 189, 248, 0.22)';
    v.fillRect(dx + 1, dy + 1, VIRTUAL_CELL - 2, VIRTUAL_CELL - 2);

    drawPixelReticle(v, sx, sy, '#FACC15');
    drawPixelReticle(v, dx, dy, '#38BDF8');

    const mx = Math.round((sx + dx) * 0.5 + VIRTUAL_CELL * 0.5);
    const my = Math.round((sy + dy) * 0.5 + VIRTUAL_CELL * 0.5);
    drawPixelLine(v, sx + 12, sy + 12, dx + 12, dy + 12, '#09090B', 3);
    drawPixelLine(v, sx + 12, sy + 12, dx + 12, dy + 12, '#38BDF8', 1);
    const arrowChar = rmbDrag.dirX < 0 ? '◀' : rmbDrag.dirX > 0 ? '▶' : rmbDrag.dirY < 0 ? '▲' : '▼';
    const dirLabel = rmbDrag.dirX < 0 ? 'IZQ' : rmbDrag.dirX > 0 ? 'DER' : rmbDrag.dirY < 0 ? 'SUBIR' : 'BAJAR';
    drawPixelText(v, arrowChar, mx, my - 3, '#FFFFFF', { align: 'center', scale: 1 });
    drawPixelText(v, dirLabel, Math.round((sx + dx) * 0.5 + 12), Math.min(sy, dy) - 7, '#38BDF8', {
      align: 'center',
      scale: 1,
    });
  } else if (hoveredCell && hoveredCell.c >= 0 && hoveredCell.c < GRID_COLS && hoveredCell.r >= 0) {
    const manhattan = Math.abs(hoveredCell.r - pRow) + Math.abs(hoveredCell.c - pCol);
    if (manhattan === 1 && sim.getCell(hoveredCell.r, hoveredCell.c).state !== 'EMPTY') {
      drawPixelReticle(
        v,
        VIRTUAL_WALL + hoveredCell.c * VIRTUAL_CELL,
        Math.round((hoveredCell.r - topWorldRow) * VIRTUAL_CELL),
        '#38BDF8'
      );
    }
  }

  // 1-Block Climbable Step-Up Cue
  if (sim.tutorialStep === 0) {
    for (const dir of [-1, 1] as const) {
      if (sim.canClimbStep(dir)) {
        const lx = VIRTUAL_WALL + (pCol + dir) * VIRTUAL_CELL + 12;
        const ly = Math.round((pRow - 0.35 - topWorldRow) * VIRTUAL_CELL);
        drawPixelText(v, '▲', lx, ly, 'rgba(255,255,255,0.65)', { align: 'center', scale: 1 });
      }
    }
  }

  // Guided Tutorial In-World Pixel Guides
  if (sim.tutorialStep > 0) {
    const pulseCol = anim4 % 2 === 0 ? '#FACC15' : '#FFFFFF';
    if (sim.tutorialStep === 1) {
      const tx = VIRTUAL_WALL + pCol * VIRTUAL_CELL;
      const ty = Math.round((5 - topWorldRow) * VIRTUAL_CELL);
      drawPixelReticle(v, tx, ty, pulseCol);
      drawPixelText(v, '▼', tx + 12, ty + 8, '#FACC15', { align: 'center', scale: 1 });
    } else if (sim.tutorialStep === 2) {
      const ty = Math.round((7 - topWorldRow) * VIRTUAL_CELL);
      const centerX = VIRTUAL_WALL + 4 * VIRTUAL_CELL;
      drawPixelReticle(v, centerX, ty, '#38BDF8');
      drawPixelText(v, '◀Q', centerX - 10, ty + 9, '#FFFFFF', { align: 'center', scale: 1 });
      drawPixelText(v, 'E▶', centerX + 34, ty + 9, '#FFFFFF', { align: 'center', scale: 1 });
    } else if (sim.tutorialStep === 3) {
      const ox = VIRTUAL_WALL + 4.5 * VIRTUAL_CELL;
      const oy = Math.round((8.5 - topWorldRow) * VIRTUAL_CELL);
      drawPixelCircle(v, ox, oy, 13, '#A3E635', 1);
    }
  }

  // ==================== SWAP TRAILS (BEHIND PLAYER) ====================
  for (const st of sim.fx.swapTrails) {
    const p = 1 - st.life / st.maxLife;
    const x1 = VIRTUAL_WALL + (st.c1 + 0.5) * VIRTUAL_CELL;
    const y1 = (st.r1 + 0.5 - topWorldRow) * VIRTUAL_CELL;
    const x2 = VIRTUAL_WALL + (st.c2 + 0.5) * VIRTUAL_CELL;
    const y2 = (st.r2 + 0.5 - topWorldRow) * VIRTUAL_CELL;
    const arcLift = Math.sin(p * Math.PI) * 5;
    v.globalAlpha = st.life / st.maxLife;
    drawPixelLine(v, x1, y1 - arcLift, x2, y2 + arcLift, st.color1, 2);
    drawPixelLine(v, x2, y2 + arcLift, x1, y1 - arcLift, st.color2, 1);
    v.globalAlpha = 1;
  }

  // ==================== EXO-RIG PLAYER, VERLET SCARF & AFTERIMAGES ====================
  drawPlayer(v, sim, topWorldRow, timeSec, baseStratum);

  // ==================== UNIFIED PIXEL FX LAYER ====================
  // 1. Opaque Cellular Sand, Smoke & Buoyant Steam
  for (const pt of sim.fx.cellular) {
    if (pt.kind !== 'SAND' && pt.kind !== 'SMOKE' && pt.kind !== 'STEAM') continue;
    const p = pt.life / pt.maxLife;
    const px = Math.round(VIRTUAL_WALL + pt.gx * VIRTUAL_CELL);
    const py = Math.round((pt.gy - topWorldRow) * VIRTUAL_CELL);
    const sz =
      pt.kind === 'STEAM'
        ? Math.max(2, Math.round(2 + p * 3))
        : pt.kind === 'SMOKE'
        ? Math.max(1, Math.round(1 + p * 2.5))
        : Math.max(1, Math.round(pt.size));
    v.globalAlpha =
      pt.kind === 'STEAM' ? (1 - p) * 0.45 : pt.kind === 'SMOKE' ? (1 - p) * 0.42 : Math.max(0.2, 1 - p * p);
    v.fillStyle = pt.kind === 'STEAM' ? pt.color : pt.kind === 'SMOKE' ? '#52525B' : pt.color;
    v.fillRect(px, py, sz, sz);
  }
  v.globalAlpha = 1;

  // 2. Textured Rigid-Body Debris Shards (with 45-degree crisp pixel rotation!)
  for (const d of sim.fx.debris) {
    const px = Math.round(VIRTUAL_WALL + d.x * VIRTUAL_CELL);
    const py = Math.round((d.y - topWorldRow) * VIRTUAL_CELL);
    const stepRot = Math.round(d.rot / (Math.PI / 4)) * (Math.PI / 4);
    v.save();
    v.globalAlpha = Math.min(1, d.life / 8);
    v.translate(px, py);
    if (stepRot !== 0) v.rotate(stepRot);
    const hw = Math.floor(d.w * 0.5);
    const hh = Math.floor(d.h * 0.5);
    v.fillStyle = '#09090B';
    v.fillRect(-hw - 1, -hh - 1, d.w + 2, d.h + 2);
    v.fillStyle = d.colDark;
    v.fillRect(-hw, -hh, d.w, d.h);
    v.fillStyle = d.colMid;
    v.fillRect(-hw, -hh, Math.max(1, d.w - 1), Math.max(1, d.h - 1));
    v.fillStyle = d.colLight;
    v.fillRect(-hw, -hh, 1, 1);
    v.restore();
  }
  v.globalAlpha = 1;

  // 3. Additive Embers, Cryo, Lava Drops, Sparks, Blast Waves, Drill Flashes, Parry Slashes
  v.save();
  v.globalCompositeOperation = 'lighter';

  for (const pt of sim.fx.cellular) {
    if (pt.kind === 'SAND' || pt.kind === 'SMOKE' || pt.kind === 'STEAM') continue;
    const p = pt.life / pt.maxLife;
    const px = Math.round(VIRTUAL_WALL + pt.gx * VIRTUAL_CELL);
    const py = Math.round((pt.gy - topWorldRow) * VIRTUAL_CELL);
    const sz = Math.max(1, Math.round(pt.size));
    const alpha = Math.max(0, 1 - p);

    // Motion streaks for fast kinetic sparks, lava droplets & void energy!
    if (pt.kind === 'SPARK' || pt.kind === 'LAVA_DROP' || pt.kind === 'VOID_SPARK') {
      const prevX = Math.round(VIRTUAL_WALL + pt.prevGx * VIRTUAL_CELL);
      const prevY = Math.round((pt.prevGy - topWorldRow) * VIRTUAL_CELL);
      if (Math.abs(px - prevX) + Math.abs(py - prevY) >= 2) {
        v.globalAlpha = alpha * 0.68;
        drawPixelLine(v, prevX, prevY, px, py, pt.color, 1);
      }
    }

    v.globalAlpha = alpha;
    v.fillStyle = p < 0.28 ? '#FFFFFF' : pt.color;
    v.fillRect(px, py, sz, sz);
  }

  for (const w of sim.fx.blastWaves) {
    const wx = Math.round(VIRTUAL_WALL + w.x * VIRTUAL_CELL);
    const wy = Math.round((w.y - topWorldRow) * VIRTUAL_CELL);
    const alpha = w.life / w.maxLife;
    v.globalAlpha = alpha * 0.92;
    if (w.isVerticalBeam) {
      v.fillStyle = w.color;
      v.fillRect(wx - 14, wy, 28, Math.round(VIRTUAL_CELL * 4 * (1 - alpha * 0.2)));
      v.fillStyle = '#FFFFFF';
      v.fillRect(wx - 6, wy, 12, Math.round(VIRTUAL_CELL * 4 * (1 - alpha * 0.2)));
    } else if (w.isHorizontalWave) {
      const span = Math.round(w.radius * VIRTUAL_CELL);
      v.fillStyle = w.color;
      v.fillRect(wx - span, wy - 2, span * 2, 4);
      v.fillStyle = '#FFFFFF';
      v.fillRect(wx - span + 4, wy - 1, Math.max(0, span * 2 - 8), 2);
    } else {
      drawPixelCircle(v, wx, wy, w.radius * VIRTUAL_CELL, w.color, 2);
      v.globalAlpha = alpha * 0.6;
      drawPixelCircle(v, wx, wy, w.radius * VIRTUAL_CELL * 0.7, '#FFFFFF', 1);
    }
  }

  for (const fl of sim.fx.drillFlashes) {
    const p = 1 - fl.life / fl.maxLife;
    const alpha = 1 - p;
    const cx = Math.round(VIRTUAL_WALL + (fl.c + 0.5) * VIRTUAL_CELL);
    const cy = Math.round((fl.r + 0.5 - topWorldRow) * VIRTUAL_CELL);
    const len = Math.round(8 + p * 14);
    v.globalAlpha = alpha;
    v.fillStyle = '#FFFFFF';
    v.fillRect(cx - len, cy - 1, len * 2, 2);
    v.fillRect(cx - 1, cy - len, 2, len * 2);
    v.fillStyle = fl.isSlag ? '#FB923C' : fl.color;
    v.fillRect(cx - 4, cy - 4, 8, 8);
    drawPixelCircle(v, cx, cy, 6 + p * 14, fl.isSlag ? '#F97316' : '#FDE047', 1);
  }

  for (const ps of sim.fx.parrySlashes) {
    const p = 1 - ps.life / ps.maxLife;
    const cx = Math.round(VIRTUAL_WALL + ps.x * VIRTUAL_CELL);
    const cy = Math.round((ps.y - topWorldRow) * VIRTUAL_CELL);
    v.globalAlpha = 1 - p;
    const span = 22 + Math.round(p * 10);
    drawPixelLine(v, cx - span * ps.dir, cy + span * 0.6, cx + span * ps.dir, cy - span * 0.6, '#FFFFFF', 3);
    drawPixelLine(v, cx - span * ps.dir, cy + span * 0.6 + 2, cx + span * ps.dir, cy - span * 0.6 + 2, '#38BDF8', 2);
  }

  v.restore();

  // 4. Magnetic Collectible Isotope Shards (always crisp & vivid!)
  for (const orb of sim.fx.isotopeOrbs) {
    const ox = Math.round(VIRTUAL_WALL + orb.x * VIRTUAL_CELL);
    const oy = Math.round((orb.y - topWorldRow) * VIRTUAL_CELL);
    for (let t = 0; t < orb.trail.length; t++) {
      const tr = orb.trail[t];
      v.globalAlpha = (t + 1) / (orb.trail.length + 1) * 0.5;
      v.fillStyle = orb.color;
      v.fillRect(Math.round(VIRTUAL_WALL + tr.x * VIRTUAL_CELL) - 1, Math.round((tr.y - topWorldRow) * VIRTUAL_CELL) - 1, 2, 2);
    }
    v.globalAlpha = 1;
    v.fillStyle = '#09090B';
    v.fillRect(ox - 3, oy - 3, 6, 6);
    v.fillStyle = orb.color;
    v.fillRect(ox - 2, oy - 2, 4, 4);
    v.fillStyle = '#FFFFFF';
    v.fillRect(ox - 1, oy - 1, 2, 2);
  }

  // ==================== MULTI-PASS PIXEL-QUANTIZED DYNAMIC LIGHTING ====================
  const dirVec: Record<AimDir, [number, number]> = {
    DOWN: [0, 1],
    UP: [0, -1],
    LEFT: [-1, 0],
    RIGHT: [1, 0],
  };
  const [dvx, dvy] = dirVec[sim.aimDir];
  const flickerPulse = 0.88 + 0.12 * Math.sin(timeSec * 19.7);

  if (!baseStratum.isLightMode && visualSettings.pixelGlow) {
    // Collect visible emissive cells once for all 3 lighting passes
    const emissiveCells: Array<{ r: number; c: number; lx: number; ly: number; radius: number; color: string; intensity: number; rimAlpha: number }> = [];
    for (let r = startR; r <= endR; r++) {
      const row = sim.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = row[c];
        if (cell.state === 'EMPTY') continue;
        const lx = VIRTUAL_WALL + (c + 0.5) * VIRTUAL_CELL;
        const ly = (r + 0.5 - topWorldRow) * VIRTUAL_CELL;
        if (cell.state === 'IGNITING') {
          const cHex = cell.color >= 0 ? baseStratum.blockColors[cell.color] : '#FACC15';
          emissiveCells.push({ r, c, lx, ly, radius: 28 + (fastAnim4 % 2) * 3, color: cHex, intensity: 0.31 * flickerPulse, rimAlpha: 0.42 });
        } else if (cell.kind === 'OXYGEN' || cell.kind === 'CRYO_VENT') {
          emissiveCells.push({ r, c, lx, ly, radius: 22, color: '#38BDF8', intensity: 0.2, rimAlpha: 0.34 });
        } else if (cell.kind === 'GEODE') {
          emissiveCells.push({ r, c, lx, ly, radius: 20, color: '#FACC15', intensity: 0.18, rimAlpha: 0.28 });
        } else if (cell.kind === 'MAGMA_NODE') {
          emissiveCells.push({ r, c, lx, ly, radius: 26, color: '#FB7185', intensity: 0.25 * flickerPulse, rimAlpha: 0.42 });
        } else if (cell.kind === 'SLAG') {
          emissiveCells.push({
            r,
            c,
            lx,
            ly,
            radius: 15,
            color: cell.isVolatileSlag ? '#A3E635' : '#F97316',
            intensity: 0.12,
            rimAlpha: cell.isVolatileSlag ? 0.24 : 0.14,
          });
        } else if (cell.kind === 'GAS_POCKET') {
          emissiveCells.push({ r, c, lx, ly, radius: 20, color: '#A3E635', intensity: 0.18, rimAlpha: 0.28 });
        } else if (cell.kind === 'ACID_VAT') {
          emissiveCells.push({ r, c, lx, ly, radius: 20, color: '#4ADE80', intensity: 0.2, rimAlpha: 0.34 });
        } else if (cell.kind === 'GRAV_WELL') {
          emissiveCells.push({ r, c, lx, ly, radius: 26, color: '#C084FC', intensity: 0.24, rimAlpha: 0.36 });
        } else if (cell.kind === 'SHOCK_MINE') {
          emissiveCells.push({
            r,
            c,
            lx,
            ly,
            radius: cell.mineArmed ? 22 : 14,
            color: cell.mineArmed ? '#F43F5E' : '#FACC15',
            intensity: cell.mineArmed ? 0.25 : 0.13,
            rimAlpha: cell.mineArmed ? 0.36 : 0.18,
          });
        } else if (cell.kind === 'TREASURE_CACHE') {
          emissiveCells.push({ r, c, lx, ly, radius: 22, color: '#FACC15', intensity: 0.22, rimAlpha: 0.32 });
        } else if (cell.kind === 'ARTIFACT_POD') {
          emissiveCells.push({ r, c, lx, ly, radius: 30, color: '#FDE047', intensity: 0.34, rimAlpha: 0.45 });
        } else if (cell.kind === 'BOUNCE_PAD') {
          emissiveCells.push({ r, c, lx, ly, radius: 16, color: '#38BDF8', intensity: 0.14, rimAlpha: 0.22 });
        } else if (cell.kind === 'CONDUCTOR') {
          emissiveCells.push({ r, c, lx, ly, radius: 18, color: '#FDE047', intensity: 0.16, rimAlpha: 0.26 });
        }
      }
    }

    // PASS 1: Subtle Subterranean Ambient Darkness & Carved Lightfield (half-res overscanned buffer)
    const lightOverscan = 48;
    const lW = Math.ceil((VIRTUAL_W + lightOverscan * 2) * 0.5);
    const lH = Math.ceil((vH + lightOverscan * 2) * 0.5);
    const [lightBuf, lctx] = ensureLightBuffer(lW, lH);
    const ambientDarkness =
      sim.overdriveTimer > 0
        ? 0.12
        : Math.min(0.35, 0.21 + (baseStratum.id - 1) * 0.024);

    lctx.save();
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lW, lH);
    lctx.globalAlpha = 1;
    lctx.fillStyle = `rgba(5, 8, 16, ${ambientDarkness.toFixed(3)})`;
    lctx.fillRect(0, 0, lW, lH);

    // Carve light pools out of cavern shadow
    lctx.globalCompositeOperation = 'destination-out';
    // Player suit aura + directional 4-step Headlamp Beam Cone
    carveLightOctagon(lctx, playerVX, playerVY, sim.overdriveTimer > 0 ? 58 : 42, lightOverscan, 1);
    for (let step = 1; step <= 4; step++) {
      const cx = playerVX + dvx * step * 18;
      const cy = playerVY + dvy * step * 18;
      carveLightOctagon(lctx, cx, cy, 18 + step * 7, lightOverscan, 0.98 - step * 0.16);
    }
    // Carve light pools for emissive blocks
    for (const em of emissiveCells) {
      carveLightOctagon(lctx, em.lx, em.ly, em.radius * 1.45, lightOverscan, 0.92);
    }
    // Carve pools for Active Guardian & Loom Anchors
    if (sim.activeGuardian) {
      const g = sim.activeGuardian;
      const gx = VIRTUAL_WALL + (g.pendulumCol + 0.5) * VIRTUAL_CELL;
      const gy = (g.arenaRow - 4 - topWorldRow) * VIRTUAL_CELL;
      carveLightOctagon(lctx, gx, gy, 58, lightOverscan, 0.95);
      for (const anchor of g.loomAnchors) {
        if (anchor.hp > 0) {
          carveLightOctagon(
            lctx,
            VIRTUAL_WALL + (anchor.col + 0.5) * VIRTUAL_CELL,
            (anchor.row + 0.5 - topWorldRow) * VIRTUAL_CELL,
            26,
            lightOverscan,
            0.9
          );
        }
      }
    }
    // Carve pools for transient FX lights (blasts, drills, swaps, parries)
    for (const fl of sim.fx.lights) {
      const lx = VIRTUAL_WALL + fl.x * VIRTUAL_CELL;
      const ly = (fl.y - topWorldRow) * VIRTUAL_CELL;
      const ratio = Math.max(0, fl.life / Math.max(1, fl.maxLife));
      carveLightOctagon(lctx, lx, ly, fl.radius * VIRTUAL_CELL * 0.85, lightOverscan, ratio);
    }
    // Carve pools for bright isotope orbs & up to 20 glowing cellular sparks/embers
    for (const orb of sim.fx.isotopeOrbs) {
      carveLightOctagon(
        lctx,
        VIRTUAL_WALL + orb.x * VIRTUAL_CELL,
        (orb.y - topWorldRow) * VIRTUAL_CELL,
        14,
        lightOverscan,
        0.75
      );
    }
    let litParticles = 0;
    for (let i = sim.fx.cellular.length - 1; i >= 0 && litParticles < 20; i--) {
      const pt = sim.fx.cellular[i];
      if (pt.kind !== 'SPARK' && pt.kind !== 'EMBER' && pt.kind !== 'LAVA_DROP' && pt.kind !== 'ACID') continue;
      litParticles++;
      carveLightOctagon(
        lctx,
        VIRTUAL_WALL + pt.gx * VIRTUAL_CELL,
        (pt.gy - topWorldRow) * VIRTUAL_CELL,
        12,
        lightOverscan,
        0.6
      );
    }
    lctx.restore();

    // Composite darkness lightfield over shaft
    v.globalAlpha = 1;
    v.drawImage(lightBuf, -lightOverscan, -lightOverscan, lW * 2, lH * 2);

    // PASS 2: Colored Dynamic Rim / Bounce Lighting on Adjacent Solid Blocks
    v.save();
    v.globalCompositeOperation = 'lighter';
    for (const em of emissiveCells) {
      if (em.rimAlpha < 0.2) continue;
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nr = em.r + dr;
        const nc = em.c + dc;
        if (nc < 0 || nc >= GRID_COLS || nr < startR) continue;
        const nCell = sim.getCell(nr, nc);
        if (nCell.state !== 'EMPTY' && nCell.state !== 'IGNITING') {
          drawBlockBounceRim(v, nr, nc, -dr, -dc, topWorldRow, em.color, em.rimAlpha);
        }
      }
    }
    // Player Headlamp Rim Glint on first illuminated block along aimDir
    const headCol = sim.overdriveTimer > 0 ? '#FACC15' : '#67E8F9';
    for (let step = 1; step <= 2; step++) {
      const tr = pRow + dvy * step;
      const tc = pCol + dvx * step;
      if (tc >= 0 && tc < GRID_COLS && tr >= startR) {
        const target = sim.getCell(tr, tc);
        if (target.state !== 'EMPTY') {
          drawBlockBounceRim(v, tr, tc, -dvy, -dvx, topWorldRow, headCol, step === 1 ? 0.58 : 0.3);
          break;
        }
      }
    }

    // PASS 3: Volumetric Headlamp Cone, Illuminated Floating Dust Motes & Rich Blooms
    for (let step = 1; step <= 4; step++) {
      const lx = playerVX + dvx * step * 16;
      const ly = playerVY + dvy * step * 16;
      drawPixelLightHalo(
        v,
        lx,
        ly,
        12 + step * 7,
        sim.overdriveTimer > 0 ? '#FACC15' : '#38BDF8',
        0.15 - step * 0.028
      );
    }

    // World-locked drifting subterranean dust motes lit up inside the headlamp beam & near lights
    for (let m = 0; m < 18; m++) {
      const spanR = Math.max(10, Math.ceil(visibleRows) + 4);
      const wr = startR + ((m * 3.73 + timeSec * (0.28 + (m % 3) * 0.14)) % spanR);
      const wc = (m * 2.17 + Math.sin(timeSec * 0.9 + m) * 0.55 + GRID_COLS) % GRID_COLS;
      const mx = Math.round(VIRTUAL_WALL + wc * VIRTUAL_CELL);
      const my = Math.round((wr - topWorldRow) * VIRTUAL_CELL);
      const dxBeam = mx - playerVX;
      const dyBeam = my - playerVY;
      const proj = dxBeam * dvx + dyBeam * dvy;
      const perp = Math.abs(dxBeam * dvy - dyBeam * dvx);
      const inCone = proj > 4 && proj < 84 && perp < 12 + proj * 0.34;
      const nearPlayer = Math.hypot(dxBeam, dyBeam) < 42;
      if (inCone || nearPlayer) {
        v.globalAlpha = (inCone ? 0.55 : 0.35) * (0.5 + 0.5 * Math.sin(timeSec * 5 + m * 2.1));
        v.fillStyle = m % 3 === 0 || sim.overdriveTimer > 0 ? '#FEF08A' : '#BAE6FD';
        v.fillRect(mx, my, 1, 1);
      }
    }

    if (sim.overdriveTimer > 0) {
      drawPixelLightHalo(v, playerVX, playerVY, 34, '#FACC15', 0.25);
    }

    for (const em of emissiveCells) {
      drawPixelLightHalo(v, em.lx, em.ly, em.radius, em.color, em.intensity);
    }

    // Transient blast/impact/drill flash lights
    for (const fl of sim.fx.lights) {
      const lx = VIRTUAL_WALL + fl.x * VIRTUAL_CELL;
      const ly = (fl.y - topWorldRow) * VIRTUAL_CELL;
      const ratio = Math.max(0, fl.life / Math.max(1, fl.maxLife));
      drawPixelLightHalo(v, lx, ly, fl.radius * VIRTUAL_CELL * 0.62, fl.color, fl.intensity * ratio);
    }

    // Subtle collectible isotope orb glow
    for (const orb of sim.fx.isotopeOrbs) {
      drawPixelLightHalo(
        v,
        VIRTUAL_WALL + orb.x * VIRTUAL_CELL,
        (orb.y - topWorldRow) * VIRTUAL_CELL,
        9,
        orb.color,
        0.16
      );
    }
    v.restore();
  }

  // 5. Crisp 5x7 Pixel Bitmap Floating Callouts (always full brightness above shadow veil!)
  for (const f of sim.fx.floatingTexts) {
    const fx = Math.round(VIRTUAL_WALL + f.x * VIRTUAL_CELL);
    const fy = Math.round((f.y - topWorldRow) * VIRTUAL_CELL);
    v.globalAlpha = Math.min(1, f.life / 16);
    const textScale = f.scale >= 1.2 ? 2 : 1;
    drawPixelText(v, f.text, fx, fy, f.color, { align: 'center', scale: textScale });
    if (f.subtext) {
      drawPixelText(v, f.subtext, fx, fy + 8 * textScale + 1, '#F2EFE9', { align: 'center', scale: 1 });
    }
  }
  v.globalAlpha = 1;

  // High-Fall Speed Wind Streaks + Warning Cue at >= 4.2 blocks
  if (sim.playerState === 'falling' && sim.playerFallRows >= 2.4 && !sim.finished) {
    const intense = sim.playerFallRows >= 4.2;
    v.fillStyle = intense ? 'rgba(244, 63, 94, 0.5)' : 'rgba(56, 189, 248, 0.35)';
    for (let s = 0; s < 5; s++) {
      const sx = playerVX + (s - 2) * 7 + (s % 2);
      const sy = playerVY - 18 - ((Math.floor(timeSec * 45) + s * 7) % 18);
      v.fillRect(sx, sy, 1, intense ? 12 : 8);
    }
    if (intense && fastAnim4 % 2 === 0) {
      drawPixelText(v, 'DASH [C]', playerVX, Math.max(12, playerVY - 22), '#FACC15', { align: 'center', scale: 1 });
    }
  }

  // Fall Shock Impact Perimeter Flash vs Low-O2 / Overdrive borders
  if (sim.fallShockFlashFrames > 0) {
    v.fillStyle = `rgba(244, 63, 94, ${(sim.fallShockFlashFrames / 24).toFixed(2)})`;
    v.fillRect(VIRTUAL_WALL, 0, VIRTUAL_PLAY_W, 4);
    v.fillRect(VIRTUAL_WALL, vH - 4, VIRTUAL_PLAY_W, 4);
    v.fillRect(VIRTUAL_WALL, 0, 4, vH);
    v.fillRect(VIRTUAL_WALL + VIRTUAL_PLAY_W - 4, 0, 4, vH);
  }
  const o2DangerRatio = sim.oxygen / Math.max(1, sim.maxOxygen);
  if (sim.inLastBreath && !sim.finished) {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 14);
    v.fillStyle = `rgba(18, 5, 12, ${(0.18 + pulse * 0.1).toFixed(2)})`;
    v.fillRect(VIRTUAL_WALL, 0, VIRTUAL_PLAY_W, vH);
    v.fillStyle = `rgba(244, 63, 94, ${(0.38 + pulse * 0.34).toFixed(2)})`;
    v.fillRect(VIRTUAL_WALL, 0, VIRTUAL_PLAY_W, 3);
    v.fillRect(VIRTUAL_WALL, vH - 3, VIRTUAL_PLAY_W, 3);
    v.fillRect(VIRTUAL_WALL, 0, 3, vH);
    v.fillRect(VIRTUAL_WALL + VIRTUAL_PLAY_W - 3, 0, 3, vH);

    const lbRatio = Math.max(0, Math.min(1, sim.lastBreathTimer / Math.max(1, LAST_BREATH_FRAMES)));
    const barW = 26;
    const bx = Math.round(playerVX - barW * 0.5);
    const by = Math.max(10, playerVY - 24);
    v.fillStyle = '#09090B';
    v.fillRect(bx - 1, by - 1, barW + 2, 5);
    v.fillStyle = '#F43F5E';
    v.fillRect(bx, by, Math.round(barW * lbRatio), 3);
    if (pulse > 0.45) {
      drawPixelText(v, 'ALIENTO', playerVX, Math.max(6, by - 4), '#FDA4AF', { align: 'center', scale: 1 });
    }
  } else if (o2DangerRatio <= 0.25 && !sim.inStratum6 && sim.overdriveTimer === 0) {
    if (fastAnim4 % 2 === 0) {
      v.fillStyle = 'rgba(225, 29, 72, 0.28)';
      v.fillRect(VIRTUAL_WALL, 0, VIRTUAL_PLAY_W, 3);
      v.fillRect(VIRTUAL_WALL, vH - 3, VIRTUAL_PLAY_W, 3);
      v.fillRect(VIRTUAL_WALL, 0, 3, vH);
      v.fillRect(VIRTUAL_WALL + VIRTUAL_PLAY_W - 3, 0, 3, vH);
    }
  } else if (sim.overdriveTimer > 0) {
    v.fillStyle = fastAnim4 % 2 === 0 ? 'rgba(250, 204, 21, 0.36)' : 'rgba(255, 255, 255, 0.22)';
    v.fillRect(VIRTUAL_WALL, 0, VIRTUAL_PLAY_W, 2);
    v.fillRect(VIRTUAL_WALL, vH - 2, VIRTUAL_PLAY_W, 2);
  }

  v.restore(); // end shaft clip

  // ==================== 20px RETAINING SIDE WALLS & PLASMA O2 CONDUITS ====================
  drawRetainingWalls(
    v,
    sim,
    vH,
    topWorldRow,
    activeWallBg,
    activeWallBorder,
    timeSec,
    baseStratum.id
  );

  // White Flash on Kinetic Parry
  if (sim.whiteFlashFrames > 0) {
    v.fillStyle = 'rgba(255,255,255,0.45)';
    v.fillRect(0, 0, VIRTUAL_W, vH);
  }

  v.restore();

  // ==================== FINAL BLIT TO DISPLAY CANVAS + CRT POST-PROCESS ====================
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(buf, 0, 0, width, height);

  // Chromatic impact edge flash (2px RGB split pulse on heavy parries / x3+ blasts)
  if (sim.chromaFlashFrames > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.11;
    ctx.drawImage(buf, 2, 0, width, height);
    ctx.drawImage(buf, -2, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  if (visualSettings.crtMode !== 'OFF') {
    const isArcade = visualSettings.crtMode === 'ARCADE';
    ctx.fillStyle = isArcade ? 'rgba(0, 0, 0, 0.17)' : 'rgba(0, 0, 0, 0.08)';
    const step = isArcade ? 3 : 4;
    for (let sy = 0; sy < height; sy += step) {
      ctx.fillRect(0, sy, width, 1);
    }
    if (isArcade) {
      const vig = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.35,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.72
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
    }
  }
  ctx.restore();
}

function drawPixelReticle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const ix = Math.round(x) + 1;
  const iy = Math.round(y) + 1;
  const s = VIRTUAL_CELL - 2;
  const L = 5;
  ctx.fillStyle = color;
  // Top-left
  ctx.fillRect(ix, iy, L, 1);
  ctx.fillRect(ix, iy, 1, L);
  // Top-right
  ctx.fillRect(ix + s - L, iy, L, 1);
  ctx.fillRect(ix + s - 1, iy, 1, L);
  // Bottom-left
  ctx.fillRect(ix, iy + s - 1, L, 1);
  ctx.fillRect(ix, iy + s - L, 1, L);
  // Bottom-right
  ctx.fillRect(ix + s - L, iy + s - 1, L, 1);
  ctx.fillRect(ix + s - 1, iy + s - L, 1, L);
}

function drawRetainingWalls(
  ctx: CanvasRenderingContext2D,
  sim: EstratoSimulation,
  vH: number,
  topWorldRow: number,
  wallBg: string,
  wallBorder: string,
  timeSec: number,
  stratumId: number
): void {
  const wallFrame = Math.floor(timeSec * 7) & 3;
  const wallStrip = getShaftWallStrip(wallBg, wallBorder, stratumId, wallFrame);
  const stripH = wallStrip.height;
  const off = ((Math.round(topWorldRow * VIRTUAL_CELL) % stripH) + stripH) % stripH;

  for (let y = -off - stripH; y < vH + stripH * 2; y += stripH) {
    ctx.drawImage(wallStrip, 0, Math.round(y));
    ctx.save();
    ctx.translate(VIRTUAL_W, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(wallStrip, 0, 0);
    ctx.restore();
  }

  // Inner shaft highlight rim
  ctx.fillStyle = wallBorder;
  ctx.fillRect(VIRTUAL_WALL - 1, -44, 1, vH + 88);
  ctx.fillRect(VIRTUAL_W - VIRTUAL_WALL, -44, 1, vH + 88);

  // Pressurized Glass Plasma O2 Conduits inside the 20px walls
  const o2Ratio = Math.max(0, Math.min(1, sim.oxygen / Math.max(1, sim.maxOxygen)));
  const isLowO2 = o2Ratio <= 0.25;
  const baseCol =
    sim.overdriveTimer > 0
      ? '#FACC15'
      : isLowO2
      ? '#E11D48'
      : sim.oxygenFreezeTimer > 0
      ? '#67E8F9'
      : '#38BDF8';

  const tubeW = 6;
  const leftX = VIRTUAL_WALL - tubeW - 3;
  const rightX = VIRTUAL_W - VIRTUAL_WALL + 3;
  const tubeTop = 8;
  const tubeBot = vH - 8;
  const tubeH = Math.max(20, tubeBot - tubeTop);
  const fillH = Math.round(tubeH * o2Ratio);

  for (const tx of [leftX, rightX]) {
    ctx.fillStyle = '#09090B';
    ctx.fillRect(tx, tubeTop, tubeW, tubeH);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(tx, tubeTop, tubeW, 1);
    ctx.fillRect(tx, tubeBot - 1, tubeW, 1);

    if (fillH > 1) {
      const fy = tubeBot - fillH;
      ctx.fillStyle = shadeHex(baseCol, -0.2);
      ctx.fillRect(tx + 1, fy, tubeW - 2, fillH);
      ctx.fillStyle = baseCol;
      ctx.fillRect(tx + 2, fy, 2, fillH);

      // Rising pixel bubbles
      ctx.fillStyle = '#FFFFFF';
      for (let b = 0; b < 4; b++) {
        const bh = Math.round(((timeSec * 36 + b * 43) % Math.max(6, fillH)));
        const by = tubeBot - bh;
        if (by > fy + 2 && by < tubeBot - 2) {
          ctx.fillRect(tx + 2 + (b % 2), by, 1, 2);
        }
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(tx + 1, fy, tubeW - 2, 2);
    }

    // Calibration notches
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    for (const frac of [0.25, 0.5, 0.75]) {
      ctx.fillRect(tx, Math.round(tubeBot - tubeH * frac), 3, 1);
    }
  }
}

export function drawCharacterAccessory(
  ctx: CanvasRenderingContext2D,
  nodes: ScarfNode[],
  originX: number,
  originY: number,
  scalePx: number,
  isOverdrive: boolean,
  chassis: ChassisId,
  timeSec = 0
): void {
  if (nodes.length < 2) return;
  const pxScale = Math.max(1, Math.round(scalePx / VIRTUAL_CELL));
  const outlineW = Math.max(2, pxScale * 2 + 1);
  const coreW = Math.max(1, pxScale + 1);

  for (let i = 0; i < nodes.length - 1; i++) {
    const x0 = Math.round(originX + nodes[i].x * scalePx);
    const y0 = Math.round(originY + nodes[i].y * scalePx);
    const x1 = Math.round(originX + nodes[i + 1].x * scalePx);
    const y1 = Math.round(originY + nodes[i + 1].y * scalePx);

    if (chassis === 'MKI_BRISA') {
      // Nora · Brisa: flowing golden ponytail with teal hair band at root
      const wOut = Math.max(2, Math.round((nodes.length - i) * 0.65 * pxScale) + 1);
      const wIn = Math.max(1, wOut - pxScale);
      drawPixelLine(ctx, x0, y0, x1, y1 + 1, '#09090B', wOut);
      drawPixelLine(
        ctx,
        x0,
        y0,
        x1,
        y1,
        isOverdrive ? '#FEF08A' : i === 0 ? '#2DD4BF' : i >= 3 ? '#FDE68A' : '#F59E0B',
        wIn
      );
    } else if (chassis === 'MKII_ESPECTRO') {
      // Sable · Espectro: forked twin stealth ribbons
      const splitY = Math.round((i + 1) * 0.9 * pxScale);
      drawPixelLine(ctx, x0, y0, x1, y1 + 1, '#09090B', outlineW);
      drawPixelLine(ctx, x0, y0 + splitY, x1, y1 + splitY + 1, '#09090B', Math.max(2, outlineW - 1));
      drawPixelLine(ctx, x0, y0, x1, y1, isOverdrive ? '#FFFFFF' : '#C084FC', coreW);
      drawPixelLine(ctx, x0, y0 + splitY, x1, y1 + splitY, isOverdrive ? '#FACC15' : '#38BDF8', Math.max(1, coreW - 1));
    } else if (chassis === 'MKIII_YUNQUE') {
      // Bram · Yunque: forged steel & amber chain links
      drawPixelLine(ctx, x0, y0, x1, y1 + 1, '#09090B', outlineW + pxScale);
      drawPixelLine(ctx, x0, y0, x1, y1, i % 2 === 0 ? '#94A3B8' : '#F59E0B', coreW);
      const r = Math.max(1, pxScale);
      ctx.fillStyle = isOverdrive ? '#FFFFFF' : '#FACC15';
      ctx.fillRect(x0 - r, y0 - r, r * 2, r * 2);
    } else if (chassis === 'MKVII_PIRO') {
      // Ignis · Crisol: broad smoldering magma cape with incandescent tail
      const capeW = Math.max(2, coreW + (i <= 2 ? pxScale : 0));
      drawPixelLine(ctx, x0, y0, x1, y1 + 1, '#09090B', capeW + 2);
      drawPixelLine(
        ctx,
        x0,
        y0,
        x1,
        y1,
        isOverdrive ? '#FFFFFF' : i >= 3 ? '#FEF08A' : i >= 1 ? '#FB923C' : '#9A3412',
        capeW
      );
    } else if (chassis === 'MKIV_METRONOMO') {
      // Lyra · Cadencia: beat-pulsing cyan/gold acoustic EQ ribbon
      const beatPulse = Math.sin(timeSec * 12.56 + i * 0.9) > 0.35;
      drawPixelLine(ctx, x0, y0, x1, y1 + 1, '#09090B', outlineW);
      drawPixelLine(ctx, x0, y0, x1, y1, isOverdrive || beatPulse ? '#FACC15' : '#38BDF8', coreW);
    } else if (chassis === 'MKV_TITAN') {
      // Orson · Titán: heavy armored power tether with lime energy beads
      drawPixelLine(ctx, x0, y0, x1, y1 + 1, '#09090B', outlineW + pxScale);
      drawPixelLine(ctx, x0, y0, x1, y1, '#475569', coreW + 1);
      if (i % 2 === 0) {
        const s = Math.max(2, pxScale + 1);
        ctx.fillStyle = isOverdrive ? '#FACC15' : '#A3E635';
        ctx.fillRect(x1 - Math.floor(s / 2), y1 - Math.floor(s / 2), s, s);
      }
    } else if (chassis === 'MKVI_QUANTUM') {
      // Vex · Cuántico: double luminous magenta/cyan phase veil
      drawPixelLine(ctx, x0, y0, x1, y1 + 1, '#09090B', outlineW);
      drawPixelLine(ctx, x0, y0, x1, y1, isOverdrive ? '#FFFFFF' : '#F472B6', coreW);
      drawPixelLine(ctx, x0, y0 - pxScale, x1, y1 - pxScale, '#67E8F9', Math.max(1, coreW - 1));
    } else {
      // Kael · Vértice: classic crisp crimson explorer scarf
      const mainCol = isOverdrive ? '#FACC15' : '#EE4E34';
      const hiCol = isOverdrive ? '#FFFFFF' : '#FEF08A';
      drawPixelLine(ctx, x0, y0, x1, y1 + 1, '#09090B', outlineW);
      drawPixelLine(ctx, x0, y0, x1, y1, i === 0 ? hiCol : mainCol, coreW);
    }
  }
}

function drawScarfPixelChain(
  ctx: CanvasRenderingContext2D,
  nodes: ScarfNode[],
  topWorldRow: number,
  isOverdrive: boolean,
  chassis: ChassisId,
  timeSec: number,
  offsetX = VIRTUAL_WALL
): void {
  drawCharacterAccessory(ctx, nodes, offsetX, -topWorldRow * VIRTUAL_CELL, VIRTUAL_CELL, isOverdrive, chassis, timeSec);
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  sim: EstratoSimulation,
  topWorldRow: number,
  timeSec: number,
  stratum: StratumPalette
): void {
  const cx = Math.round(VIRTUAL_WALL + (sim.px + 0.5) * VIRTUAL_CELL);
  const cy = Math.round((sim.py - 0.5 - topWorldRow) * VIRTUAL_CELL);

  // 0. Crisp tinted pixel Afterimages from Dash / Overdrive
  for (const img of sim.fx.afterimages) {
    const ix = Math.round(VIRTUAL_WALL + img.x * VIRTUAL_CELL);
    const iy = Math.round((img.y - topWorldRow) * VIRTUAL_CELL);
    const ghost = getExoRigPixelSprite({
      chassis: sim.config.chassis,
      upgrades: sim.getRigUpgrades(),
      rigLevel: sim.getRigLevel(),
      pose: img.pose,
      animFrame: img.animFrame,
      aimDir: img.aimDir,
      facing: img.facing,
      tintColor: img.color,
    });
    ctx.globalAlpha = (img.life / img.maxLife) * 0.45;
    ctx.drawImage(ghost, ix - 18, iy - 18);
  }
  ctx.globalAlpha = 1;

  // 1. 6-Node Verlet Character Physics Accessory behind Operator
  drawScarfPixelChain(ctx, sim.fx.scarf, topWorldRow, sim.overdriveTimer > 0, sim.config.chassis, timeSec);

  // 2. MK-IV Metrónomo Diegetic Beat Reticle around player
  if (sim.config.chassis === 'MKIV_METRONOMO') {
    const phase = soundEngine.getBeatPhase();
    const beatRad = Math.round(11 + (1 - phase) * 5);
    const onBeat = sim.metronomeOnBeatFlash > 0 || soundEngine.isOnBeat(0.18);
    drawPixelCircle(
      ctx,
      cx,
      cy,
      beatRad,
      onBeat ? '#FACC15' : 'rgba(56, 189, 248, 0.35)',
      1
    );
  }

  // 2b. Golden Architect Crown 8-point Aura when 14/14 Artifacts completed
  if (sim.hasArchitectCrown) {
    const pulse = (Math.floor(timeSec * 8) & 3);
    const crownR = 14 + (pulse % 2);
    drawPixelCircle(ctx, cx, cy - 1, crownR, '#FACC15', 1);
    const pts: [number, number][] = [
      [cx, cy - crownR - 2],
      [cx + crownR + 1, cy - 1],
      [cx, cy + crownR],
      [cx - crownR - 2, cy - 1],
    ];
    ctx.fillStyle = pulse % 2 === 0 ? '#FFFFFF' : '#FEF08A';
    for (const [px, py] of pts) {
      ctx.fillRect(px, py, 2, 2);
    }
  }

  // 3. Coyote Crush Shield Dome + [W+Q/E] cue
  if (sim.coyoteCrushTimer > 0) {
    const parryCol = Math.floor(timeSec * 24) % 2 === 0 ? '#FFFFFF' : '#38BDF8';
    drawPixelCircle(ctx, cx, cy - 2, 16, parryCol, 2);
    drawPixelText(vSafe(ctx), 'W+Q/E', cx, cy - 25, '#FFFFFF', { align: 'center', scale: 1 });
  }

  ctx.save();
  ctx.translate(cx, cy);

  const activePose: RigPose =
    sim.actionPose ||
    (sim.isClimbing
      ? 'CLIMB'
      : sim.playerState === 'falling'
      ? sim.slamDiving
        ? 'SLAM_DIVE'
        : 'FALL'
      : Math.abs(sim.vx) > 0.35
      ? 'WALK'
      : 'IDLE');

  drawExoRigAvatar(ctx, {
    chassis: sim.config.chassis,
    upgrades: sim.getRigUpgrades(),
    rigLevel: sim.getRigLevel(),
    timeSec,
    cellSize: VIRTUAL_CELL,
    aimAngle: Math.PI * 0.5,
    facing: sim.facing,
    aimDir: sim.aimDir,
    pose: activePose,
    isFalling: sim.playerState === 'falling',
    isClimbing: sim.isClimbing,
    hasPyro: sim.modules.some((m) => m.id.startsWith('PYRO_')),
    hasBallistic: sim.modules.some((m) => m.id.startsWith('BAL_')),
    hasShield: sim.kineticShields > 0 || sim.invulnTimer > 0,
    anvilShield: sim.anvilShieldAvailable,
    hasAlpha: sim.hasAlphaFragment,
    hasLance: sim.hasSingularityLance,
    overdriveActive: sim.overdriveTimer > 0,
    squashX: sim.squashX,
    squashY: sim.squashY,
    vx: sim.vx,
    vy: sim.vy,
    coyoteCrushTimer: sim.coyoteCrushTimer,
    oxygenRatio: Math.max(0, Math.min(1, sim.oxygen / Math.max(1, sim.maxOxygen))),
    showO2Ring: true,
  });

  ctx.restore();
  void stratum;
}

function vSafe(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  return ctx;
}

export function drawExoRigAvatar(ctx: CanvasRenderingContext2D, opts: ExoRigRenderOpts): void {
  const {
    chassis,
    upgrades,
    rigLevel,
    timeSec,
    cellSize,
    facing = 1,
    aimDir = 'DOWN',
    pose: explicitPose,
    isFalling = false,
    isClimbing = false,
    hasPyro = false,
    hasBallistic = false,
    hasShield = false,
    anvilShield = false,
    hasAlpha = false,
    hasLance = false,
    overdriveActive = false,
    squashX = 1,
    squashY = 1,
    vx = 0,
    vy = 0,
    oxygenRatio = 1,
    showO2Ring = false,
  } = opts;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const scaleToCell = cellSize / VIRTUAL_CELL;

  // Kinetic Shield & O2 stepped pixel halos
  if (showO2Ring) {
    const ringR = Math.round(14 * scaleToCell);
    const o2Col = overdriveActive ? '#FACC15' : oxygenRatio <= 0.25 ? '#E11D48' : '#38BDF8';
    drawPixelCircle(ctx, 0, 0, ringR, 'rgba(255,255,255,0.12)', Math.max(1, Math.round(scaleToCell)));
    if (oxygenRatio > 0.05) {
      // Top arc segments proportional to O2
      const segs = Math.round(16 * oxygenRatio);
      ctx.fillStyle = o2Col;
      for (let s = 0; s < segs; s++) {
        const ang = -Math.PI * 0.5 + (s / 16) * Math.PI * 2;
        ctx.fillRect(
          Math.round(Math.cos(ang) * ringR),
          Math.round(Math.sin(ang) * ringR),
          Math.max(1, Math.round(scaleToCell)),
          Math.max(1, Math.round(scaleToCell))
        );
      }
    }
  }

  if (hasShield || anvilShield) {
    drawPixelCircle(
      ctx,
      0,
      0,
      Math.round(16 * scaleToCell),
      anvilShield ? '#F59E0B' : '#A3E635',
      Math.max(1, Math.round(scaleToCell))
    );
  }

  // Pyrolytic orbiting incandescent pixel sparks
  if (hasPyro) {
    for (let k = 0; k < 3; k++) {
      const ang = timeSec * 4.2 + (k * Math.PI * 2) / 3;
      const ox = Math.round(Math.cos(ang) * 15 * scaleToCell);
      const oy = Math.round(Math.sin(ang) * 15 * scaleToCell);
      const sz = Math.max(2, Math.round(2 * scaleToCell));
      ctx.fillStyle = '#F26419';
      ctx.fillRect(ox - 1, oy - 1, sz + 1, sz + 1);
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(ox, oy, Math.max(1, sz - 1), Math.max(1, sz - 1));
    }
  }

  // Alpha Fragment / Singularity Lance orbit
  if (hasAlpha || hasLance) {
    const ox = Math.round(Math.cos(timeSec * 4.5) * 16 * scaleToCell);
    const oy = Math.round(Math.sin(timeSec * 4.5) * 16 * scaleToCell);
    const sz = Math.max(3, Math.round(3 * scaleToCell));
    ctx.fillStyle = hasLance ? '#FACC15' : '#FFFFFF';
    ctx.fillRect(ox - 1, oy - 1, sz, sz);
  }

  // Vex · Cuántico orbiting phase motes
  if (chassis === 'MKVI_QUANTUM') {
    for (let q = 0; q < 2; q++) {
      const ang = timeSec * 3.6 + q * Math.PI;
      const qx = Math.round(Math.cos(ang) * 14 * scaleToCell);
      const qy = Math.round(Math.sin(ang) * 14 * scaleToCell);
      const qsz = Math.max(2, Math.round(2 * scaleToCell));
      ctx.fillStyle = q === 0 ? '#67E8F9' : '#F472B6';
      ctx.fillRect(qx - 1, qy - 1, qsz, qsz);
    }
  }

  // Armor Tier 3 Orbiting Kinetic Pixel Satellites
  if (upgrades.armorTier >= 3) {
    for (let s = 0; s < 2; s++) {
      const ang = timeSec * 2.8 + s * Math.PI;
      const sx = Math.round(Math.cos(ang) * 15 * scaleToCell);
      const sy = Math.round(Math.sin(ang) * 15 * scaleToCell);
      const sz = Math.max(2, Math.round(2.5 * scaleToCell));
      ctx.fillStyle = '#09090B';
      ctx.fillRect(sx - 1, sy - 1, sz + 2, sz + 2);
      ctx.fillStyle = '#A3E635';
      ctx.fillRect(sx, sy, sz, sz);
    }
  }

  // Velocity squash/stretch
  const fallStretch = isFalling ? Math.min(0.14, vy * 0.006) : 0;
  ctx.scale(squashX * (1 - fallStretch * 0.35), squashY * (1 + fallStretch));

  const pose: RigPose =
    explicitPose ||
    (isClimbing ? 'CLIMB' : isFalling ? 'FALL' : Math.abs(vx) > 0.35 ? 'WALK' : 'IDLE');
  const animSpeed = pose === 'WALK' || pose === 'DRILL_STRIKE' ? 14 : pose === 'FALL' ? 16 : 6;
  const animFrame = Math.floor(timeSec * animSpeed) & 3;

  const sprite = getExoRigPixelSprite({
    chassis,
    upgrades,
    rigLevel,
    pose,
    animFrame,
    aimDir,
    facing,
    hasPyro,
    hasBallistic,
    isLowO2: oxygenRatio <= 0.25,
    overdriveActive,
  });

  const drawSize = Math.round(36 * scaleToCell);
  const halfDraw = Math.round(drawSize * 0.5);
  ctx.drawImage(sprite, -halfDraw, -halfDraw, drawSize, drawSize);

  ctx.restore();
}

// ==================== LIVING SUBTERRANEAN PIXEL DIORAMA FOR TITLE SCREEN ====================

const titleScarfNodes: ScarfNode[] = createScarfNodes(0, 0, 6);

export function renderTitleDiorama(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  chassis: ChassisId,
  upgrades: RigUpgrades,
  rigLevel: number
): void {
  const vW = 220;
  const vH = Math.max(140, Math.round((height / Math.max(1, width)) * vW));
  const [buf, v] = ensureVirtualBuffer(vW, vH);

  const stratum = STRATA[0];
  const anim4 = Math.floor(timeSec * 6) & 3;
  const scrollRow = timeSec * 1.4;

  v.save();
  v.imageSmoothingEnabled = false;
  v.fillStyle = stratum.bg;
  v.fillRect(0, 0, vW, vH);

  // Layer 0 + Layer 1 Parallax Cavern
  const vista = getDeepVistaTile(1, stratum.bg, stratum.wallBorder, stratum.blockColors[0]);
  const vistaY = ((Math.round(scrollRow * 3) % vista.height) + vista.height) % vista.height;
  for (let y = -vistaY; y < vH + vista.height; y += vista.height) {
    for (let x = 0; x < vW; x += vista.width) {
      v.drawImage(vista, x, y);
    }
  }
  const cav = getParallaxCavernTile(1, stratum.bg, stratum.wallBorder, stratum.blockColors[0]);
  const cavY = ((Math.round(scrollRow * 7) % cav.height) + cav.height) % cav.height;
  v.globalAlpha = 0.7;
  for (let y = -cavY; y < vH + cav.height; y += cav.height) {
    for (let x = 0; x < vW; x += cav.width) {
      v.drawImage(cav, x, y);
    }
  }
  v.globalAlpha = 1;

  // Midground scaffolding
  const mid = getParallaxMidgroundScaffolding(1, stratum.wallBorder, stratum.blockColors[0]);
  const midY = ((Math.round(scrollRow * 14) % mid.height) + mid.height) % mid.height;
  for (let y = -midY; y < vH + mid.height; y += mid.height) {
    v.drawImage(mid, 2, y);
  }

  // Left & Right 20px Masonry Retaining Walls
  const wall = getShaftWallStrip(stratum.wallBg, stratum.wallBorder, 1, anim4);
  const wY = ((Math.round(scrollRow * 24) % wall.height) + wall.height) % wall.height;
  for (let y = -wY; y < vH + wall.height; y += wall.height) {
    v.drawImage(wall, 0, y);
    v.save();
    v.translate(vW, y);
    v.scale(-1, 1);
    v.drawImage(wall, 0, 0);
    v.restore();
  }

  // Bottom stepped mineral seam shelf with connected blocks + O2 pod + Geode!
  const floorY = vH - 42;
  const cols = [0, 1, 2, 1, 3, 2, 0];
  for (let i = 0; i < cols.length; i++) {
    const bx = 26 + i * 24;
    if (i === 1) {
      v.drawImage(getGeodeBlockSprite(anim4), bx, floorY + 14);
    } else if (i === 5) {
      v.drawImage(getOxygenPodSprite(anim4), bx, floorY - 4);
    } else {
      const cIdx = cols[i];
      v.drawImage(
        getMineralBlockSprite(1, stratum.blockColors[cIdx], cIdx, i & 3, 0, false),
        bx,
        floorY + (i === 3 ? -8 : 10)
      );
    }
  }

  // Floating embers
  for (let i = 0; i < 16; i++) {
    const ex = 24 + ((i * 29 + Math.round(Math.sin(timeSec * 2 + i) * 6)) % (vW - 48));
    const ey = ((vH - Math.round(timeSec * (18 + (i % 4) * 6) + i * 21)) % vH + vH) % vH;
    v.fillStyle = i % 3 === 0 ? '#FEF08A' : i % 2 === 0 ? '#FB923C' : '#38BDF8';
    v.fillRect(ex, ey, 2, 2);
  }

  // Descending Animated Exo-Rig + Verlet Scarf + Carved Dynamic Lightfield in center of diorama
  const rigX = Math.round(vW * 0.5);
  const rigY = Math.round(vH * 0.42 + Math.sin(timeSec * 2.5) * 4);

  const lW = Math.ceil(vW * 0.5);
  const lH = Math.ceil(vH * 0.5);
  const [dLightBuf, dlctx] = ensureLightBuffer(lW, lH);
  dlctx.save();
  dlctx.globalCompositeOperation = 'source-over';
  dlctx.clearRect(0, 0, lW, lH);
  dlctx.fillStyle = 'rgba(5, 8, 16, 0.24)';
  dlctx.fillRect(0, 0, lW, lH);
  dlctx.globalCompositeOperation = 'destination-out';
  carveLightOctagon(dlctx, rigX, rigY, 54, 0, 1);
  carveLightOctagon(dlctx, rigX, rigY + 26, 36, 0, 0.85);
  carveLightOctagon(dlctx, 26 + 24 + 12, floorY + 26, 26, 0, 0.88);
  carveLightOctagon(dlctx, 26 + 5 * 24 + 12, floorY + 8, 28, 0, 0.9);
  dlctx.restore();
  v.drawImage(dLightBuf, 0, 0, lW * 2, lH * 2);

  stepScarfNodes(titleScarfNodes, 0, 0, 1, 0, 11, timeSec, false, chassis);
  drawCharacterAccessory(v, titleScarfNodes, rigX - 4, rigY - 4, 22, false, chassis, timeSec);

  v.save();
  v.globalCompositeOperation = 'lighter';
  drawPixelLightHalo(v, rigX, rigY + 14, 28, '#38BDF8', 0.22);
  drawPixelLightHalo(v, rigX, rigY + 32, 22, '#38BDF8', 0.14);
  drawPixelLightHalo(v, 26 + 24 + 12, floorY + 26, 22, '#FACC15', 0.18);
  drawPixelLightHalo(v, 26 + 5 * 24 + 12, floorY + 8, 24, '#38BDF8', 0.2);
  v.restore();

  const rigSprite = getExoRigPixelSprite({
    chassis,
    upgrades,
    rigLevel,
    pose: 'FALL',
    animFrame: anim4,
    aimDir: 'DOWN',
    facing: 1,
  });
  v.drawImage(rigSprite, rigX - 18, rigY - 18);

  // Subtle depth readout stamp
  drawPixelText(v, `ESTRATO I · -${String(Math.floor(scrollRow * 4) % 500).padStart(3, '0')}M`, vW * 0.5, 10, '#FACC15', {
    align: 'center',
    scale: 1,
  });

  v.restore();

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(buf, 0, 0, width, height);
  ctx.restore();
}
