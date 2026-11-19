// Unified Pixel-Art Physics & Visual FX Engine for ESTRATO
// Handles rigid-body rock shards, Noita-style cellular pixels, magnetic isotope shards,
// Verlet thermal scarf physics, action trails, parry slashes, and pixel floating callouts.

import { AimDir, Cell, ChassisId, DT, GRID_COLS, RigPose } from '../types/game';

export interface DebrisShard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  w: number;
  h: number;
  colLight: string;
  colMid: string;
  colDark: string;
  life: number;
  maxLife: number;
  gravity: number;
  bounce: number;
}

export type CellularKind =
  | 'SAND'
  | 'EMBER'
  | 'SMOKE'
  | 'CRYO'
  | 'STEAM'
  | 'LAVA_DROP'
  | 'SPARK'
  | 'ACID'
  | 'TOXIC'
  | 'VOID_SPARK';

export interface FxLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
  intensity: number;
}

export interface ShaftCable {
  anchorRow: number;
  side: 'LEFT' | 'RIGHT';
  nodes: ScarfNode[];
  color: string;
}

export interface CellularPixel {
  gx: number;
  gy: number;
  prevGx: number;
  prevGy: number;
  vx: number;
  vy: number;
  kind: CellularKind;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  settled: boolean;
}

export interface IsotopeOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  age: number;
  collected: boolean;
  color: string;
  trail: Array<{ x: number; y: number }>;
}

export interface SwapTrail {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  color1: string;
  color2: string;
  life: number;
  maxLife: number;
}

export interface DrillFlash {
  r: number;
  c: number;
  dir: AimDir;
  color: string;
  isSlag: boolean;
  life: number;
  maxLife: number;
}

export interface ParrySlash {
  x: number;
  y: number;
  dir: -1 | 1;
  life: number;
  maxLife: number;
}

export interface Afterimage {
  x: number;
  y: number;
  pose: RigPose;
  animFrame: number;
  aimDir: AimDir;
  facing: -1 | 1;
  color: string;
  life: number;
  maxLife: number;
}

export interface BlastWave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  isVerticalBeam?: boolean;
  isHorizontalWave?: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface ScarfNode {
  x: number;
  y: number;
  oldX: number;
  oldY: number;
}

const MAX_CELLULAR_PIXELS = 240;
const MAX_DEBRIS_SHARDS = 120;
const MAX_FX_LIGHTS = 36;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [180, 180, 190];
  const n = parseInt(clean, 16);
  if (Number.isNaN(n)) return [180, 180, 190];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shadeTriplet(hex: string): { light: string; mid: string; dark: string } {
  const [r, g, b] = hexToRgb(hex);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const light = `rgb(${clamp(r + (255 - r) * 0.36)},${clamp(g + (255 - g) * 0.32)},${clamp(b + (255 - b) * 0.24)})`;
  const mid = `rgb(${r},${g},${b})`;
  const dark = `rgb(${clamp(r * 0.48)},${clamp(g * 0.46)},${clamp(b * 0.56)})`;
  return { light, mid, dark };
}

export function createScarfNodes(anchorX: number, anchorY: number, count = 6): ScarfNode[] {
  const nodes: ScarfNode[] = [];
  for (let i = 0; i < count; i++) {
    const x = anchorX - i * 0.1;
    const y = anchorY + i * 0.08;
    nodes.push({ x, y, oldX: x, oldY: y });
  }
  return nodes;
}

export function getAccessoryPhysicsProfile(chassis?: ChassisId): {
  damping: number;
  gravity: number;
  segLen: number;
  flutter: number;
  updraftScale: number;
} {
  switch (chassis) {
    case 'MKI_BRISA':
      return { damping: 0.87, gravity: 0.0085, segLen: 0.15, flutter: 0.007, updraftScale: 1.25 };
    case 'MKII_ESPECTRO':
      return { damping: 0.88, gravity: 0.0075, segLen: 0.16, flutter: 0.006, updraftScale: 1.2 };
    case 'MKIII_YUNQUE':
      return { damping: 0.78, gravity: 0.0175, segLen: 0.13, flutter: 0.0018, updraftScale: 0.65 };
    case 'MKVII_PIRO':
      return { damping: 0.85, gravity: 0.009, segLen: 0.155, flutter: 0.0065, updraftScale: 1.15 };
    case 'MKIV_METRONOMO':
      return { damping: 0.86, gravity: 0.0095, segLen: 0.145, flutter: 0.0055, updraftScale: 1.05 };
    case 'MKV_TITAN':
      return { damping: 0.79, gravity: 0.016, segLen: 0.135, flutter: 0.0022, updraftScale: 0.7 };
    case 'MKVI_QUANTUM':
      return { damping: 0.9, gravity: 0.005, segLen: 0.16, flutter: 0.0062, updraftScale: 1.3 };
    default:
      return { damping: 0.84, gravity: 0.011, segLen: 0.14, flutter: 0.0045, updraftScale: 1.0 };
  }
}

export function stepScarfNodes(
  nodes: ScarfNode[],
  anchorX: number,
  anchorY: number,
  facing: -1 | 1,
  vx: number,
  vy: number,
  windPhase: number,
  isDashing = false,
  chassis?: ChassisId
): void {
  if (nodes.length === 0) return;

  nodes[0].x = anchorX;
  nodes[0].y = anchorY;
  nodes[0].oldX = anchorX;
  nodes[0].oldY = anchorY;

  const prof = getAccessoryPhysicsProfile(chassis);
  const damping = prof.damping;
  const gravity = prof.gravity;
  const updraft = vy > 2 ? -Math.min(0.04, vy * 0.0022 * prof.updraftScale) : 0;
  const lateralDrag = -vx * 0.0032 - facing * (isDashing ? 0.025 : 0.003);

  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    const velX = (n.x - n.oldX) * damping;
    const velY = (n.y - n.oldY) * damping;
    n.oldX = n.x;
    n.oldY = n.y;
    const flutter = Math.sin(windPhase * 9 + i * 1.15) * prof.flutter;
    n.x += velX + lateralDrag + flutter;
    n.y += velY + gravity + updraft;
  }

  const segLen = prof.segLen;
  for (let iter = 0; iter < 3; iter++) {
    nodes[0].x = anchorX;
    nodes[0].y = anchorY;
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const diff = (dist - segLen) / dist;
      if (i === 0) {
        b.x -= dx * diff;
        b.y -= dy * diff;
      } else {
        a.x += dx * diff * 0.35;
        a.y += dy * diff * 0.35;
        b.x -= dx * diff * 0.65;
        b.y -= dy * diff * 0.65;
      }
    }
  }
}

export interface FxUpdateContext {
  getCell: (r: number, c: number) => Cell;
  minPrunedRow: number;
  maxGeneratedRow: number;
  cameraRow: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  facing: -1 | 1;
  isFalling: boolean;
  isDashing: boolean;
  frameCount: number;
  chassis?: ChassisId;
  magnetBonus?: number;
  onCollectIsotope: (amount: number, orbX: number, orbY: number) => void;
}

export class FxWorld {
  public debris: DebrisShard[] = [];
  public cellular: CellularPixel[] = [];
  public isotopeOrbs: IsotopeOrb[] = [];
  public swapTrails: SwapTrail[] = [];
  public drillFlashes: DrillFlash[] = [];
  public parrySlashes: ParrySlash[] = [];
  public afterimages: Afterimage[] = [];
  public blastWaves: BlastWave[] = [];
  public floatingTexts: FloatingText[] = [];
  public lights: FxLight[] = [];
  public shaftCables: Map<number, ShaftCable> = new Map();
  public scarf: ScarfNode[] = createScarfNodes(4.5, 4.42, 6);

  public resetScarf(px: number, py: number, facing: -1 | 1): void {
    this.scarf = createScarfNodes(px + 0.5 - facing * 0.14, py - 0.58, 6);
  }

  public spawnDebrisBurst(x: number, y: number, hex: string, count: number, speedScale = 1): void {
    const { light, mid, dark } = shadeTriplet(hex);
    for (let i = 0; i < count; i++) {
      if (this.debris.length >= MAX_DEBRIS_SHARDS) {
        this.debris.shift();
      }
      const ang = (Math.PI * 2 * i) / Math.max(1, count) + (Math.random() - 0.5) * 0.65;
      const spd = (1.8 + Math.random() * 5.2) * speedScale;
      const w = 2 + Math.floor(Math.random() * 3);
      const h = 2 + Math.floor(Math.random() * 2);
      const maxLife = 22 + Math.floor(Math.random() * 20);
      this.debris.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1.8 * speedScale,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.35,
        w,
        h,
        colLight: light,
        colMid: mid,
        colDark: dark,
        life: maxLife,
        maxLife,
        gravity: 0.24,
        bounce: 0.45,
      });
    }
  }

  public spawnCellularPixel(
    gx: number,
    gy: number,
    vx: number,
    vy: number,
    kind: CellularKind,
    color: string,
    size = 1.5,
    maxLife = 42
  ): void {
    if (this.cellular.length >= MAX_CELLULAR_PIXELS) {
      this.cellular.shift();
    }
    this.cellular.push({
      gx,
      gy,
      prevGx: gx,
      prevGy: gy,
      vx,
      vy,
      kind,
      color,
      size,
      life: 0,
      maxLife,
      settled: false,
    });
  }

  public spawnCellularBurst(
    x: number,
    y: number,
    kind: CellularKind,
    color: string,
    count: number,
    speed = 0.09
  ): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.35 + Math.random() * 0.85);
      this.spawnCellularPixel(
        x + (Math.random() - 0.5) * 0.4,
        y + (Math.random() - 0.5) * 0.4,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd - (kind === 'EMBER' ? 0.035 : 0.015),
        kind,
        color,
        kind === 'SPARK' ? 1 : 1.5,
        kind === 'SAND' ? 48 + Math.floor(Math.random() * 26) : 26 + Math.floor(Math.random() * 22)
      );
    }
  }

  public spawnIsotopeOrbs(
    x: number,
    y: number,
    totalValue: number,
    orbCount: number,
    color = '#FACC15'
  ): void {
    if (totalValue <= 0 || orbCount <= 0) return;
    const perOrb = Math.max(1, Math.floor(totalValue / orbCount));
    let remainder = totalValue - perOrb * orbCount;
    for (let i = 0; i < orbCount; i++) {
      const val = perOrb + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.2;
      const spd = 2.4 + Math.random() * 2.8;
      this.isotopeOrbs.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1.2,
        value: val,
        age: 0,
        collected: false,
        color: i % 2 === 0 ? color : '#FEF08A',
        trail: [],
      });
    }
  }

  public spawnSwapTrail(r1: number, c1: number, r2: number, c2: number, color1: string, color2: string): void {
    this.swapTrails.push({
      r1,
      c1,
      r2,
      c2,
      color1,
      color2,
      life: 10,
      maxLife: 10,
    });
  }

  public spawnDrillFlash(r: number, c: number, dir: AimDir, color: string, isSlag: boolean): void {
    this.drillFlashes.push({
      r,
      c,
      dir,
      color,
      isSlag,
      life: isSlag ? 14 : 11,
      maxLife: isSlag ? 14 : 11,
    });
  }

  public spawnParrySlash(x: number, y: number, dir: -1 | 1): void {
    this.parrySlashes.push({
      x,
      y,
      dir,
      life: 16,
      maxLife: 16,
    });
  }

  public spawnAfterimage(
    x: number,
    y: number,
    pose: RigPose,
    animFrame: number,
    aimDir: AimDir,
    facing: -1 | 1,
    color: string,
    maxLife = 12
  ): void {
    this.afterimages.push({
      x,
      y,
      pose,
      animFrame,
      aimDir,
      facing,
      color,
      life: maxLife,
      maxLife,
    });
    if (this.afterimages.length > 24) {
      this.afterimages.shift();
    }
  }

  public spawnBlastWave(wave: BlastWave): void {
    this.blastWaves.push(wave);
  }

  public spawnLight(x: number, y: number, radius: number, color: string, life = 14, intensity = 0.36): void {
    if (this.lights.length >= MAX_FX_LIGHTS) this.lights.shift();
    this.lights.push({ x, y, radius, color, life, maxLife: life, intensity });
  }

  // Directional spray of incandescent drill sparks & rock dust firing opposite drill aim vector
  public spawnDrillJet(wx: number, wy: number, dir: AimDir, color: string, isArmored = false): void {
    const vecMap: Record<AimDir, [number, number]> = {
      DOWN: [0, 1],
      UP: [0, -1],
      LEFT: [-1, 0],
      RIGHT: [1, 0],
    };
    const [dx, dy] = vecMap[dir];
    const baseAngle = Math.atan2(-dy, -dx);
    const sparkCount = isArmored ? 8 : 5;
    for (let i = 0; i < sparkCount; i++) {
      const ang = baseAngle + (Math.random() - 0.5) * 1.15;
      const spd = 0.08 + Math.random() * 0.14;
      this.spawnCellularPixel(
        wx - dx * 0.25,
        wy - dy * 0.25,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd - 0.02,
        'SPARK',
        i % 2 === 0 ? '#FEF08A' : isArmored ? '#FB923C' : color,
        1.1,
        14 + Math.floor(Math.random() * 10)
      );
    }
    for (let i = 0; i < 4; i++) {
      const ang = baseAngle + (Math.random() - 0.5) * 1.3;
      const spd = 0.04 + Math.random() * 0.06;
      this.spawnCellularPixel(
        wx - dx * 0.2,
        wy - dy * 0.2,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        'SAND',
        color,
        1.4,
        28 + Math.floor(Math.random() * 14)
      );
    }
    this.spawnLight(wx - dx * 0.2, wy - dy * 0.2, isArmored ? 2.4 : 1.9, isArmored ? '#FB923C' : '#FDE047', 10, 0.38);
  }

  // Physical bilateral ground-skimming dust, smoke & shrapnel impact on landing
  public spawnLandingImpact(wx: number, wy: number, fallRows: number, floorColor = '#A1A1AA'): void {
    const count = Math.min(14, Math.max(4, Math.round(fallRows * 2.2)));
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const spd = (0.045 + Math.random() * 0.09) * Math.min(1.8, 0.7 + fallRows * 0.15);
      this.spawnCellularPixel(
        wx + side * 0.15,
        wy - 0.06,
        side * spd,
        -0.02 - Math.random() * 0.045,
        i % 3 === 0 ? 'SMOKE' : 'SAND',
        floorColor,
        i % 3 === 0 ? 1.8 : 1.3,
        24 + Math.floor(Math.random() * 18)
      );
    }
    if (fallRows >= 2.2) {
      this.spawnDebrisBurst(wx, wy - 0.08, floorColor, Math.min(8, Math.round(fallRows)), 0.7);
    }
    if (fallRows >= 4.2) {
      this.spawnBlastWave({
        x: wx,
        y: wy,
        radius: 0.2,
        maxRadius: Math.min(2.6, 1.2 + fallRows * 0.2),
        life: 10,
        maxLife: 10,
        color: '#FDE047',
        isHorizontalWave: true,
      });
      this.spawnLight(wx, wy - 0.2, 2.6, '#FACC15', 12, 0.4);
    }
  }

  // Radially blast nearby settled sand, debris, cables & embers from explosions/slams
  public applyShockwaveToParticles(wx: number, wy: number, radius: number, force: number): void {
    this.applyImpulseToCables(wx, wy, radius, force);
    const invR = 1 / Math.max(0.2, radius);
    for (const pt of this.cellular) {
      const dx = pt.gx - wx;
      const dy = pt.gy - wy;
      const d = Math.hypot(dx, dy);
      if (d > 0.01 && d <= radius) {
        const k = (1 - d * invR) * force * 0.038;
        pt.settled = false;
        pt.vx += (dx / d) * k;
        pt.vy += (dy / d) * k - k * 0.35;
      }
    }
    for (const d of this.debris) {
      const dx = d.x - wx;
      const dy = d.y - wy;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05 && dist <= radius) {
        const push = (1 - dist * invR) * force * 1.4;
        d.vx += (dx / dist) * push;
        d.vy += (dy / dist) * push - push * 0.4;
      }
    }
  }

  public applyImpulseToCables(wx: number, wy: number, radius: number, force: number): void {
    for (const cable of this.shaftCables.values()) {
      for (let i = 1; i < cable.nodes.length; i++) {
        const n = cable.nodes[i];
        const dx = n.x - wx;
        const dy = n.y - wy;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d <= radius) {
          const push = (1 - d / radius) * force * 0.035;
          n.oldX -= (dx / d) * push;
          n.oldY -= (dy / d) * push;
        }
      }
    }
  }

  public applyGravityWellPull(gx: number, gy: number, radius: number): void {
    for (const d of this.debris) {
      const dx = gx - d.x;
      const dy = gy - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.15 && dist < radius) {
        const pull = (1 - dist / radius) * 0.55;
        d.vx += (dx / dist) * pull - (dy / dist) * pull * 0.25;
        d.vy += (dy / dist) * pull + (dx / dist) * pull * 0.25;
      }
    }
    for (const orb of this.isotopeOrbs) {
      const dx = gx - orb.x;
      const dy = gy - orb.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.2 && dist < radius) {
        const pull = (1 - dist / radius) * 0.45;
        orb.vx += (dx / dist) * pull;
        orb.vy += (dy / dist) * pull;
      }
    }
  }

  public spawnShockArc(x1: number, y1: number, x2: number, y2: number, color = '#FDE047'): void {
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jitter = i > 0 && i < steps ? (Math.random() - 0.5) * 0.28 : 0;
      this.spawnCellularPixel(
        x1 + (x2 - x1) * t + jitter,
        y1 + (y2 - y1) * t + jitter,
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.04,
        'SPARK',
        color,
        1.4,
        12
      );
    }
    this.blastWaves.push({
      x: (x1 + x2) * 0.5,
      y: (y1 + y2) * 0.5,
      radius: 0.2,
      maxRadius: Math.max(1.2, Math.hypot(x2 - x1, y2 - y1) * 0.65),
      life: 10,
      maxLife: 10,
      color,
      isHorizontalWave: Math.abs(y2 - y1) < 0.3,
    });
  }

  public addFloatingText(
    x: number,
    y: number,
    text: string,
    subtext: string | undefined,
    color: string,
    scale = 1
  ): void {
    this.floatingTexts.push({
      x,
      y,
      text,
      subtext,
      color,
      life: 56,
      maxLife: 56,
      scale,
    });
    if (this.floatingTexts.length > 26) {
      this.floatingTexts.shift();
    }
  }

  public emitAmbientWorldPixels(ctx: FxUpdateContext): void {
    if (ctx.frameCount % 3 !== 0) return;
    const pR = Math.floor(ctx.cameraRow);
    const rMin = Math.max(ctx.minPrunedRow, pR - 10);
    const rMax = Math.min(ctx.maxGeneratedRow, pR + 12);
    for (let rr = rMin; rr <= rMax; rr++) {
      for (let cc = 0; cc < GRID_COLS; cc++) {
        const cell = ctx.getCell(rr, cc);
        if (cell.state === 'EMPTY') continue;
        if (cell.state === 'IGNITING' && Math.random() < 0.48) {
          this.spawnCellularPixel(
            cc + 0.15 + Math.random() * 0.7,
            rr + 0.25,
            (Math.random() - 0.5) * 0.03,
            -0.038 - Math.random() * 0.035,
            Math.random() < 0.72 ? 'EMBER' : 'SMOKE',
            Math.random() < 0.5 ? '#FEF08A' : '#FB923C',
            1.5,
            26 + Math.floor(Math.random() * 18)
          );
        } else if (cell.kind === 'SLAG' && Math.random() < 0.055 && ctx.getCell(rr + 1, cc).state === 'EMPTY') {
          this.spawnCellularPixel(
            cc + 0.2 + Math.random() * 0.6,
            rr + 0.96,
            0,
            0.015,
            'LAVA_DROP',
            cell.isVolatileSlag ? '#BEF264' : '#FB923C',
            1.5,
            42
          );
        } else if ((cell.kind === 'OXYGEN' || cell.kind === 'CRYO_VENT') && Math.random() < 0.16) {
          this.spawnCellularPixel(
            cc + 0.2 + Math.random() * 0.6,
            rr + 0.25,
            (Math.random() - 0.5) * 0.018,
            -0.025,
            'CRYO',
            cell.kind === 'CRYO_VENT' ? '#A5F3FC' : '#BAE6FD',
            1.2,
            30
          );
        } else if (cell.kind === 'GEODE' && Math.random() < 0.12) {
          this.spawnCellularPixel(
            cc + 0.15 + Math.random() * 0.7,
            rr + 0.15 + Math.random() * 0.7,
            (Math.random() - 0.5) * 0.02,
            -0.02,
            'SPARK',
            Math.random() < 0.5 ? '#FEF08A' : '#F472B6',
            1.2,
            20
          );
        } else if (cell.kind === 'MAGMA_NODE' && Math.random() < 0.18) {
          this.spawnCellularPixel(
            cc + 0.2 + Math.random() * 0.6,
            rr + 0.2,
            (Math.random() - 0.5) * 0.025,
            -0.035,
            'EMBER',
            '#FB7185',
            1.4,
            24
          );
        } else if (cell.kind === 'GAS_POCKET' && Math.random() < 0.16) {
          this.spawnCellularPixel(
            cc + 0.2 + Math.random() * 0.6,
            rr + 0.25,
            (Math.random() - 0.5) * 0.02,
            -0.024,
            'TOXIC',
            '#A3E635',
            1.4,
            34
          );
        } else if (cell.kind === 'ACID_VAT' && Math.random() < 0.14 && ctx.getCell(rr + 1, cc).state === 'EMPTY') {
          this.spawnCellularPixel(
            cc + 0.25 + Math.random() * 0.5,
            rr + 0.94,
            0,
            0.02,
            'ACID',
            '#4ADE80',
            1.4,
            36
          );
        } else if (cell.kind === 'GRAV_WELL' && Math.random() < 0.2) {
          const ang = Math.random() * Math.PI * 2;
          this.spawnCellularPixel(
            cc + 0.5 + Math.cos(ang) * 0.55,
            rr + 0.5 + Math.sin(ang) * 0.55,
            -Math.cos(ang) * 0.028,
            -Math.sin(ang) * 0.028,
            'VOID_SPARK',
            '#C084FC',
            1.3,
            22
          );
        } else if (cell.kind === 'TREASURE_CACHE' && Math.random() < 0.12) {
          this.spawnCellularPixel(
            cc + 0.15 + Math.random() * 0.7,
            rr + 0.15 + Math.random() * 0.7,
            0,
            -0.022,
            'SPARK',
            '#FACC15',
            1.3,
            18
          );
        }
      }
    }
  }

  public update(ctx: FxUpdateContext): void {
    // 1. Update Character Verlet Accessory
    const isPonytail = ctx.chassis === 'MKI_BRISA';
    const anchorX = ctx.px + 0.5 - ctx.facing * (isPonytail ? 0.18 : 0.14);
    const anchorY = ctx.py - (isPonytail ? 0.68 : 0.58);
    stepScarfNodes(
      this.scarf,
      anchorX,
      anchorY,
      ctx.facing,
      ctx.vx,
      ctx.vy,
      ctx.frameCount * DT,
      ctx.isDashing,
      ctx.chassis
    );

    // Subtle character-specific signature micro-sparks while moving/falling
    const tail = this.scarf[this.scarf.length - 1];
    if (tail && (Math.abs(ctx.vx) > 2 || Math.abs(ctx.vy) > 4 || ctx.isDashing)) {
      if (ctx.chassis === 'MKVII_PIRO' && ctx.frameCount % 5 === 0) {
        this.spawnCellularPixel(tail.x, tail.y, (Math.random() - 0.5) * 0.02, -0.02, 'EMBER', '#FB923C', 1.1, 14);
      } else if (ctx.chassis === 'MKI_BRISA' && ctx.frameCount % 6 === 0) {
        this.spawnCellularPixel(ctx.px + 0.5, ctx.py - 0.1, -ctx.vx * 0.01, -0.012, 'STEAM', '#99F6E4', 1.0, 11);
      } else if (ctx.chassis === 'MKVI_QUANTUM' && ctx.frameCount % 6 === 0) {
        this.spawnCellularPixel(tail.x, tail.y, (Math.random() - 0.5) * 0.025, 0, 'SPARK', '#67E8F9', 1.1, 12);
      }
    }

    // 2. Ambient emitters
    this.emitAmbientWorldPixels(ctx);

    // 3. Step Rigid-Body Debris Shards
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const p = this.debris[i];
      p.rot += p.vrot;
      const nextX = p.x + p.vx * DT;
      const nextY = p.y + p.vy * DT;
      const pr = Math.floor(nextY);
      const pc = Math.floor(nextX);

      if (pc < 0 || pc >= GRID_COLS) {
        p.vx = -p.vx * p.bounce;
        p.vrot = -p.vrot * 0.7;
      } else {
        const hitCell = pr >= ctx.minPrunedRow ? ctx.getCell(pr, pc) : null;
        if (hitCell && hitCell.state !== 'EMPTY' && hitCell.kind !== 'OXYGEN') {
          if (p.vy > 0 && Math.floor(p.y) < pr) {
            p.vy = -p.vy * p.bounce;
            p.vx *= 0.72;
            p.vrot *= 0.65;
            p.y = pr - 0.03;
          } else {
            p.vx = -p.vx * p.bounce;
          }
        } else {
          p.x = nextX;
          p.y = nextY;
        }
      }

      p.vy += p.gravity;
      p.life--;
      if (p.life <= 0) this.debris.splice(i, 1);
    }

    // 4. Step Noita-Style Cellular Pixels + Player Wake + Spark Collision Bounces
    const wakeX = ctx.px + 0.5;
    const wakeY = ctx.py - 0.45;
    const wakeSpeed = Math.hypot(ctx.vx, ctx.vy);
    const hasWake = wakeSpeed > 3.5 || ctx.isDashing;
    for (let i = this.cellular.length - 1; i >= 0; i--) {
      const pt = this.cellular[i];
      pt.prevGx = pt.gx;
      pt.prevGy = pt.gy;
      pt.life++;
      if (pt.life >= pt.maxLife) {
        this.cellular.splice(i, 1);
        continue;
      }

      if (hasWake && (pt.kind === 'SMOKE' || pt.kind === 'STEAM' || pt.kind === 'EMBER' || pt.kind === 'CRYO' || pt.kind === 'TOXIC' || (pt.kind === 'SAND' && !pt.settled))) {
        const wdx = pt.gx - wakeX;
        const wdy = pt.gy - wakeY;
        const wd = Math.hypot(wdx, wdy);
        if (wd > 0.04 && wd < 1.55) {
          const slip = (1 - wd / 1.55) * (ctx.isDashing ? 0.022 : 0.01);
          pt.vx += (wdx / wd) * slip + ctx.vx * 0.0008;
          pt.vy += (wdy / wd) * slip * 0.65 - 0.004;
        }
      }

      if (pt.kind === 'SAND') {
        if (!pt.settled) {
          pt.vy = Math.min(0.18, pt.vy + 0.009);
          const nx = pt.gx + pt.vx;
          const ny = pt.gy + pt.vy;
          const col = Math.floor(nx);
          const row = Math.floor(ny);
          if (col < 0 || col >= GRID_COLS) {
            pt.vx = -pt.vx * 0.5;
          } else {
            const hit = ctx.getCell(row, col);
            if (hit.state !== 'EMPTY' && hit.kind !== 'OXYGEN') {
              const dirTry = Math.random() < 0.5 ? -1 : 1;
              if (col + dirTry >= 0 && col + dirTry < GRID_COLS && ctx.getCell(row, col + dirTry).state === 'EMPTY') {
                pt.gx += dirTry * 0.08;
                pt.vx *= 0.6;
              } else if (
                col - dirTry >= 0 &&
                col - dirTry < GRID_COLS &&
                ctx.getCell(row, col - dirTry).state === 'EMPTY'
              ) {
                pt.gx -= dirTry * 0.08;
                pt.vx *= 0.6;
              } else {
                pt.gy = row - 0.03;
                pt.vx = 0;
                pt.vy = 0;
                pt.settled = true;
              }
            } else {
              pt.gx = nx;
              pt.gy = ny;
              pt.vx *= 0.94;
            }
          }
        }
      } else if (pt.kind === 'LAVA_DROP') {
        pt.vy = Math.min(0.22, pt.vy + 0.012);
        const nx = pt.gx + pt.vx;
        const ny = pt.gy + pt.vy;
        const col = Math.floor(nx);
        const row = Math.floor(ny);
        const hit = col >= 0 && col < GRID_COLS ? ctx.getCell(row, col) : null;
        if (hit && hit.state !== 'EMPTY' && hit.kind !== 'OXYGEN') {
          // Splash into glowing SPARK pixels on landing
          for (let s = 0; s < 3; s++) {
            this.spawnCellularPixel(
              nx,
              row - 0.05,
              (Math.random() - 0.5) * 0.08,
              -0.04 - Math.random() * 0.04,
              'SPARK',
              pt.color,
              1.1,
              14
            );
          }
          this.cellular.splice(i, 1);
          continue;
        } else {
          pt.gx = nx;
          pt.gy = ny;
        }
      } else if (pt.kind === 'EMBER' || pt.kind === 'SPARK') {
        pt.vx += (Math.random() - 0.5) * (pt.kind === 'EMBER' ? 0.007 : 0.004);
        if (pt.kind === 'EMBER') {
          pt.vy -= 0.0014;
        } else {
          pt.vy += 0.0062;
          pt.vx *= 0.985;
        }
        const nx = pt.gx + pt.vx;
        const ny = pt.gy + pt.vy;
        const col = Math.floor(nx);
        const row = Math.floor(ny);
        if (col < 0 || col >= GRID_COLS) {
          pt.vx = -pt.vx * (pt.kind === 'SPARK' ? 0.62 : 0.7);
          pt.gx = Math.max(0.02, Math.min(GRID_COLS - 0.02, nx));
        } else {
          const hit = ctx.getCell(row, col);
          if (hit.state !== 'EMPTY' && hit.kind !== 'OXYGEN') {
            if (pt.kind === 'SPARK' && Math.abs(pt.vy) > 0.06 && this.cellular.length < MAX_CELLULAR_PIXELS - 2) {
              // Emit a tiny cooling ember upward on strong spark impact
              this.spawnCellularPixel(nx, row - 0.05, -pt.vx * 0.35, -0.022, 'EMBER', '#FB923C', 1.1, 16);
            }
            if (Math.floor(pt.gy) < row) {
              pt.vy = -Math.abs(pt.vy) * (pt.kind === 'SPARK' ? 0.56 : 0.45);
              pt.vx *= 0.78;
              pt.gy = row - 0.04;
            } else {
              pt.vx = -pt.vx * 0.58;
            }
          } else {
            pt.gx = nx;
            pt.gy = ny;
          }
        }
      } else if (pt.kind === 'ACID') {
        pt.vy = Math.min(0.24, pt.vy + 0.015);
        const nx = pt.gx + pt.vx;
        const ny = pt.gy + pt.vy;
        const col = Math.floor(nx);
        const row = Math.floor(ny);
        const hit = col >= 0 && col < GRID_COLS ? ctx.getCell(row, col) : null;
        if (hit && hit.state !== 'EMPTY' && hit.kind !== 'OXYGEN') {
          for (let s = 0; s < 2; s++) {
            this.spawnCellularPixel(
              nx,
              row - 0.06,
              (Math.random() - 0.5) * 0.06,
              -0.03 - Math.random() * 0.03,
              'TOXIC',
              '#86EFAC',
              1.1,
              16
            );
          }
          this.cellular.splice(i, 1);
          continue;
        } else {
          pt.gx = nx;
          pt.gy = ny;
        }
      } else if (pt.kind === 'TOXIC') {
        pt.gx += pt.vx + Math.sin(pt.life * 0.3) * 0.008;
        pt.gy += pt.vy - 0.002;
        pt.vx *= 0.96;
      } else if (pt.kind === 'VOID_SPARK') {
        const ang = pt.life * 0.25;
        pt.gx += pt.vx + Math.cos(ang) * 0.008;
        pt.gy += pt.vy + Math.sin(ang) * 0.008;
      } else if (pt.kind === 'STEAM') {
        pt.gx += pt.vx + Math.sin(pt.life * 0.22 + pt.gy) * 0.014;
        pt.gy += pt.vy - 0.0024;
        pt.vx *= 0.96;
      } else {
        // CRYO / SMOKE wisps curl smoothly upward
        pt.gx += pt.vx + Math.sin(pt.life * 0.25) * 0.005;
        pt.gy += pt.vy;
      }
    }

    // 5. Step Magnetic Isotope Shards
    const targetX = ctx.px + 0.5;
    const targetY = ctx.py - 0.5;
    for (let i = this.isotopeOrbs.length - 1; i >= 0; i--) {
      const orb = this.isotopeOrbs[i];
      orb.age++;
      orb.trail.push({ x: orb.x, y: orb.y });
      if (orb.trail.length > 5) orb.trail.shift();

      if (orb.age < 14) {
        orb.vy += 0.22;
        orb.x += orb.vx * DT;
        orb.y += orb.vy * DT;
        if (orb.x < 0.2 || orb.x > GRID_COLS - 0.2) {
          orb.vx = -orb.vx * 0.6;
          orb.x = Math.max(0.2, Math.min(GRID_COLS - 0.2, orb.x));
        }
      } else {
        const dx = targetX - orb.x;
        const dy = targetY - orb.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const pull = Math.min(22, 7 + (orb.age - 14) * 0.85);
        orb.vx += ((dx / dist) * pull - orb.vx) * 0.25;
        orb.vy += ((dy / dist) * pull - orb.vy) * 0.25;
        orb.x += orb.vx * DT;
        orb.y += orb.vy * DT;

        const pullRadius = 0.48 * (1 + (ctx.magnetBonus || 0));
        if (dist < pullRadius || orb.age > 95) {
          ctx.onCollectIsotope(orb.value, orb.x, orb.y);
          this.isotopeOrbs.splice(i, 1);
          continue;
        }
      }
    }

    // 6. Step Action Trails, Flashes, Slashes, Afterimages, BlastWaves, FloatingText
    for (let i = this.swapTrails.length - 1; i >= 0; i--) {
      this.swapTrails[i].life--;
      if (this.swapTrails[i].life <= 0) this.swapTrails.splice(i, 1);
    }
    for (let i = this.drillFlashes.length - 1; i >= 0; i--) {
      this.drillFlashes[i].life--;
      if (this.drillFlashes[i].life <= 0) this.drillFlashes.splice(i, 1);
    }
    for (let i = this.parrySlashes.length - 1; i >= 0; i--) {
      this.parrySlashes[i].life--;
      if (this.parrySlashes[i].life <= 0) this.parrySlashes.splice(i, 1);
    }
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life--;
      if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
    }
    for (let i = this.blastWaves.length - 1; i >= 0; i--) {
      const w = this.blastWaves[i];
      w.life--;
      w.radius += (w.maxRadius - w.radius) * 0.28;
      if (w.life <= 0) this.blastWaves.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const f = this.floatingTexts[i];
      f.y -= 0.024;
      f.life--;
      if (f.life <= 0) this.floatingTexts.splice(i, 1);
    }
    for (let i = this.lights.length - 1; i >= 0; i--) {
      this.lights[i].life--;
      if (this.lights[i].life <= 0) this.lights.splice(i, 1);
    }

    // 7. Hanging Shaft Cables/Chains Verlet Simulation (anchored every 12 rows along walls)
    const minAnchor = Math.max(12, Math.floor((ctx.cameraRow - 16) / 12) * 12);
    const maxAnchor = Math.floor((ctx.cameraRow + 18) / 12) * 12;
    for (const k of this.shaftCables.keys()) {
      if (k < minAnchor - 12 || k > maxAnchor + 12) this.shaftCables.delete(k);
    }
    for (let ar = minAnchor; ar <= maxAnchor; ar += 12) {
      if (!this.shaftCables.has(ar)) {
        const side: 'LEFT' | 'RIGHT' = (ar / 12) % 2 === 0 ? 'LEFT' : 'RIGHT';
        const ax = side === 'LEFT' ? 0.06 : GRID_COLS - 0.06;
        const nodes: ScarfNode[] = [];
        for (let i = 0; i < 5; i++) {
          const nx = ax + (side === 'LEFT' ? 0.14 : -0.14) * i;
          const ny = ar + i * 0.35;
          nodes.push({ x: nx, y: ny, oldX: nx, oldY: ny });
        }
        this.shaftCables.set(ar, {
          anchorRow: ar,
          side,
          nodes,
          color: side === 'LEFT' ? '#475569' : '#64748B',
        });
      }
    }
    const pxCenter = ctx.px + 0.5;
    const pyCenter = ctx.py - 0.5;
    for (const cable of this.shaftCables.values()) {
      const ax = cable.side === 'LEFT' ? 0.04 : GRID_COLS - 0.04;
      const ay = cable.anchorRow;
      const nodes = cable.nodes;
      nodes[0].x = ax;
      nodes[0].y = ay;
      nodes[0].oldX = ax;
      nodes[0].oldY = ay;
      const breeze = Math.sin(ctx.frameCount * 0.05 + ay) * 0.0018;
      for (let i = 1; i < nodes.length; i++) {
        const n = nodes[i];
        const vx = (n.x - n.oldX) * 0.92;
        const vy = (n.y - n.oldY) * 0.92;
        n.oldX = n.x;
        n.oldY = n.y;
        let wakeX = 0;
        if (Math.hypot(n.x - pxCenter, n.y - pyCenter) < 1.8 && Math.abs(ctx.vy) + Math.abs(ctx.vx) > 2) {
          wakeX = (n.x - pxCenter) * 0.008;
        }
        n.x += vx + breeze + wakeX;
        n.y += vy + 0.009;
      }
      const segLen = 0.38;
      for (let it = 0; it < 2; it++) {
        nodes[0].x = ax;
        nodes[0].y = ay;
        for (let i = 0; i < nodes.length - 1; i++) {
          const a = nodes[i];
          const b = nodes[i + 1];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const diff = (dist - segLen) / dist;
          if (i === 0) {
            b.x -= dx * diff;
            b.y -= dy * diff;
          } else {
            a.x += dx * diff * 0.35;
            a.y += dy * diff * 0.35;
            b.x -= dx * diff * 0.65;
            b.y -= dy * diff * 0.65;
          }
        }
      }
    }
  }
}

