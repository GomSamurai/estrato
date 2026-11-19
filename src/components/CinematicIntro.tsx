import React, { useEffect, useRef, useState } from 'react';
import { CHASSIS_LIST, STRATA } from '../data/catalog';
import { ARTIFACTS } from '../data/collectibles';
import { soundEngine } from '../engine/audio';
import { createScarfNodes, stepScarfNodes } from '../engine/fx';
import {
  getArtifactPodSprite,
  getCrystalBlockSprite,
  getExoRigPixelSprite,
  getGeodeBlockSprite,
  getMagmaNodeBlockSprite,
  getMineralBlockSprite,
  getSlagBlockSprite,
} from '../engine/pixelArt';
import { drawCharacterAccessory } from '../engine/renderer';
import { ArchiveSave, RigUpgrades } from '../types/game';

interface CinematicIntroProps {
  archive: ArchiveSave;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
  onFinish: () => void;
  onSkipForever?: () => void;
}

const WHISPERS = [
  '2149 · LA GRIETA PARTIÓ EL SUBSUELO HASTA LOS 3.500 METROS.',
  'SIETE ESTRATOS VIVOS · SEIS GUARDIANES · CATORCE ARTEFACTOS DEL ARQUITECTO.',
  'ALIMENTA LA MECHA · DESVÍA EL DERRUMBE · SOBREVIVE AL ÚLTIMO ALIENTO.',
];

export const CinematicIntro: React.FC<CinematicIntroProps> = ({
  archive,
  soundEnabled = true,
  hapticsEnabled = false,
  onFinish,
  onSkipForever,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ nx: number; ny: number }>({ nx: 0, ny: 0 });
  const launchingRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const [ignitionFlash, setIgnitionFlash] = useState(false);
  const [whisperIdx, setWhisperIdx] = useState(0);

  const activeChassis = CHASSIS_LIST.find((c) => c.id === archive.selectedChassis) || CHASSIS_LIST[0];
  const rigLevel = Math.max(1, archive.rigLevel || 1);
  const collectedCount = (archive.discoveredArtifacts || []).length;

  const finishOnce = () => {
    if (launchingRef.current) return;
    launchingRef.current = true;
    soundEngine.init();
    if (soundEnabled) {
      soundEngine.playSeismicSeal();
    }
    if (hapticsEnabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([16, 20, 24]);
      } catch {
        // Ignore haptic refusal on unsupported browsers
      }
    }
    setIgnitionFlash(true);
    window.setTimeout(() => {
      onFinishRef.current();
    }, 145);
  };

  useEffect(() => {
    const iv = window.setInterval(() => {
      setWhisperIdx((idx) => (idx + 1) % WHISPERS.length);
    }, 4400);
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
        e.preventDefault();
        finishOnce();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const rawRig = (archive.rigUpgrades || {}) as Partial<RigUpgrades>;
    const upgrades: RigUpgrades = {
      drillTier: rawRig.drillTier ?? 0,
      thrusterTier: rawRig.thrusterTier ?? 0,
      tankTier: rawRig.tankTier ?? 0,
      armorTier: rawRig.armorTier ?? 0,
      capacitorTier: rawRig.capacitorTier ?? 0,
      magnetTier: rawRig.magnetTier ?? 0,
    };
    const scarfNodes = createScarfNodes(0, 0, 7);

    const embers = Array.from({ length: 68 }, (_, i) => ({
      x: ((i * 61 + 13) % 100) / 100,
      y: ((i * 37 + 7) % 100) / 100,
      speed: 0.14 + ((i * 23) % 12) * 0.025,
      size: i % 5 === 0 ? 3 : i % 2 === 0 ? 2 : 1,
      phase: i * 0.9,
      bright: i % 4 === 0,
    }));

    const streaks = Array.from({ length: 24 }, (_, i) => ({
      xNorm: 0.18 + (((i * 43 + 11) % 64) / 100),
      y: ((i * 29) % 100) / 100,
      speed: 0.75 + ((i * 17) % 8) * 0.14,
      len: 10 + (i % 4) * 6,
    }));

    const sparks = Array.from({ length: 18 }, (_, i) => ({
      phase: (i / 18) * Math.PI * 2,
      speed: 2.8 + (i % 5) * 0.55,
      spread: ((i % 7) - 3) * 0.35,
    }));

    const startMs = performance.now();
    let animId = 0;

    const tick = (now: number) => {
      const elapsed = (now - startMs) / 1000;
      const canvas = canvasRef.current;

      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const pixelScale = rect.width < 640 ? 2 : 3;
        const W = Math.max(160, Math.ceil(rect.width / pixelScale));
        const H = Math.max(240, Math.ceil(rect.height / pixelScale));
        if (canvas.width !== W || canvas.height !== H) {
          canvas.width = W;
          canvas.height = H;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;

          // Smooth stratum mood cycle across the 7 strata as the camera plunges
          const cyclePos = (elapsed * 0.16) % STRATA.length;
          const sA = STRATA[Math.floor(cyclePos) % STRATA.length];
          const sB = STRATA[(Math.floor(cyclePos) + 1) % STRATA.length];
          const activeStratum = Math.sin(elapsed * 0.5) >= 0 ? sA : sB;
          const accentMain = activeStratum.blockColors[0] || '#EE4E34';
          const accentAlt = activeStratum.blockColors[2] || '#FACC15';

          const pxOff = Math.round(pointerRef.current.nx * 7);
          const pyOff = Math.round(pointerRef.current.ny * 4);
          const shakeX = Math.sin(elapsed * 37) > 0.96 ? (Math.sin(elapsed * 91) > 0 ? 1 : -1) : 0;

          // 1. Deep cavern abyssal backdrop
          ctx.fillStyle = '#06070B';
          ctx.fillRect(0, 0, W, H);

          const topBeam = ctx.createLinearGradient(0, 0, 0, H);
          topBeam.addColorStop(0, '#1B1118');
          topBeam.addColorStop(0.32, '#0A0D14');
          topBeam.addColorStop(0.7, '#090B12');
          topBeam.addColorStop(1, '#26110E');
          ctx.fillStyle = topBeam;
          ctx.fillRect(0, 0, W, H);

          // 2. Parallax deep cavern walls & structural struts (0.35x scroll)
          const wallScrollSlow = Math.floor(elapsed * 32);
          const shaftHalfW = Math.min(Math.round(W * 0.36), Math.max(58, Math.round(W * 0.29)));
          const shaftLeft = Math.round(W * 0.5 - shaftHalfW + pxOff * 0.5 + shakeX);
          const shaftRight = shaftLeft + shaftHalfW * 2;

          // Background rocky cliff strata outside main shaft
          ctx.fillStyle = '#0D1018';
          ctx.fillRect(0, 0, Math.max(0, shaftLeft), H);
          ctx.fillRect(shaftRight, 0, Math.max(0, W - shaftRight), H);

          const girderSpacing = 48;
          for (let gy = -girderSpacing; gy < H + girderSpacing; gy += girderSpacing) {
            const sy = gy - (wallScrollSlow % girderSpacing);
            ctx.fillStyle = '#141824';
            ctx.fillRect(0, sy, W, 3);
            ctx.fillStyle = '#1F2536';
            ctx.fillRect(Math.max(0, shaftLeft), sy, shaftHalfW * 2, 1);
          }

          // Volumetric shaft sunlight shaft from surface breach at top
          const topGlow = ctx.createRadialGradient(W * 0.5 + pxOff * 0.4, -10, 6, W * 0.5, H * 0.35, Math.max(W, H) * 0.55);
          topGlow.addColorStop(0, 'rgba(238,78,52,0.28)');
          topGlow.addColorStop(0.45, 'rgba(56,189,248,0.10)');
          topGlow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = topGlow;
          ctx.fillRect(0, 0, W, H);

          // Volumetric molten core rising from abyss bottom
          const bottomPulse = 0.28 + Math.sin(elapsed * 4.2) * 0.08;
          const abyssGlow = ctx.createRadialGradient(W * 0.5, H + 8, 10, W * 0.5, H * 0.85, Math.max(W, H) * 0.5);
          abyssGlow.addColorStop(0, `rgba(250,204,21,${bottomPulse + 0.16})`);
          abyssGlow.addColorStop(0.45, `rgba(238,78,52,${bottomPulse})`);
          abyssGlow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = abyssGlow;
          ctx.fillRect(0, 0, W, H);

          // 3. Scrolling foreground block columns built from real pixel-art engine tiles
          const tileSz = 18;
          const fastScroll = Math.floor(elapsed * 116);
          const animFrame = Math.floor(elapsed * 8) & 3;
          const baseRowIdx = Math.floor(fastScroll / tileSz);
          const rowPixelOffset = fastScroll % tileSz;
          const rowsVisible = Math.ceil(H / tileSz) + 3;
          const wallCols = Math.max(1, Math.ceil(shaftLeft / tileSz) + 1);

          for (let r = -1; r < rowsVisible; r++) {
            const worldRow = baseRowIdx + r;
            const drawY = r * tileSz - rowPixelOffset;
            const rowStratum = STRATA[Math.floor((Math.abs(worldRow) * 0.07) % STRATA.length)];

            // Left & right mineral strata walls (innermost 2 columns richer)
            for (let side = 0; side < 2; side++) {
              for (let cOff = 0; cOff < wallCols; cOff++) {
                const bx = side === 0 ? shaftLeft - (cOff + 1) * tileSz : shaftRight + cOff * tileSz;
                if (bx + tileSz < -4 || bx > W + 4) continue;
                const hash = Math.abs((worldRow * 73856093) ^ (cOff * 19349663) ^ (side * 83492791)) % 29;
                let spr: HTMLCanvasElement;
                if (cOff === 0 && hash === 7) {
                  const art = ARTIFACTS[Math.abs(worldRow) % ARTIFACTS.length];
                  spr = getArtifactPodSprite(art.color, art.accent, animFrame);
                } else if (cOff === 0 && hash === 3) {
                  spr = getGeodeBlockSprite(animFrame);
                } else if (cOff === 0 && hash === 11) {
                  spr = getMagmaNodeBlockSprite(animFrame);
                } else if (hash % 5 === 0) {
                  spr = getSlagBlockSprite(rowStratum.slagColor, 5, false, hash & 1, animFrame, false);
                } else if (hash % 7 === 0) {
                  spr = getCrystalBlockSprite(rowStratum.blockColors[hash % 4], 0, false, animFrame);
                } else {
                  spr = getMineralBlockSprite(
                    rowStratum.id,
                    rowStratum.blockColors[hash % rowStratum.blockColors.length],
                    hash % 4,
                    0,
                    animFrame,
                    false
                  );
                }
                ctx.globalAlpha = cOff === 0 ? 0.92 : cOff === 1 ? 0.62 : 0.36;
                ctx.drawImage(spr, bx + pxOff + shakeX, drawY, tileSz, tileSz);
                ctx.globalAlpha = 1;
              }
            }

            // Glowing shaft steel rails + depth elevation ticks
            ctx.fillStyle = '#2B3245';
            ctx.fillRect(shaftLeft + pxOff + shakeX - 2, drawY, 2, tileSz);
            ctx.fillRect(shaftRight + pxOff + shakeX, drawY, 2, tileSz);

            if (worldRow % 8 === 0) {
              const meters = ((Math.abs(worldRow) * 12) % 3500) + 100;
              ctx.fillStyle = accentAlt;
              ctx.fillRect(shaftLeft + pxOff + shakeX - 4, drawY + 6, 4, 2);
              ctx.fillRect(shaftRight + pxOff + shakeX, drawY + 6, 4, 2);
              ctx.fillStyle = 'rgba(228,228,231,0.34)';
              ctx.font = 'bold 7px monospace';
              ctx.fillText(`${String(meters).padStart(4, '0')}m`, shaftLeft + pxOff + shakeX + 5, drawY + 9);
            }
          }

          // 4. Vertical velocity wind streaks inside shaft
          streaks.forEach((st) => {
            const sy = ((st.y - elapsed * st.speed) % 1 + 1) % 1;
            const sx = Math.round(shaftLeft + (st.xNorm - 0.18) / 0.64 * (shaftHalfW * 2) + pxOff);
            ctx.fillStyle = 'rgba(148,163,184,0.22)';
            ctx.fillRect(sx, Math.round(sy * H), 1, st.len);
          });

          // 5. Center Action Hero: Active Exo-Rig plunging through the shaft
          const heroX = Math.round(W * 0.5 + Math.sin(elapsed * 2.1) * 4 + pxOff * 1.4 + shakeX);
          const heroY = Math.round(H * 0.51 + Math.cos(elapsed * 3.4) * 3 + pyOff);

          // Volumetric headlamp cone projecting downward
          const cone = ctx.createRadialGradient(heroX, heroY + 12, 3, heroX, heroY + 64, 96);
          cone.addColorStop(0, 'rgba(250,204,21,0.52)');
          cone.addColorStop(0.5, 'rgba(56,189,248,0.18)');
          cone.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = cone;
          ctx.beginPath();
          ctx.moveTo(heroX - 6, heroY + 6);
          ctx.lineTo(heroX + 6, heroY + 6);
          ctx.lineTo(heroX + 66, heroY + 118);
          ctx.lineTo(heroX - 66, heroY + 118);
          ctx.closePath();
          ctx.fill();

          // Flickering thruster jetpack exhaust shooting upward behind helmet
          const thrustH = 12 + Math.round(Math.sin(elapsed * 42) * 4 + 4);
          ctx.fillStyle = '#38BDF8';
          ctx.fillRect(heroX - 4, heroY - 22 - thrustH, 8, thrustH);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(heroX - 2, heroY - 20 - Math.round(thrustH * 0.6), 4, Math.round(thrustH * 0.6));

          // Rotating 8-point Golden Architect Crown aura if 14/14 unlocked
          if (archive.architectCrownUnlocked) {
            for (let i = 0; i < 8; i++) {
              const ang = elapsed * 2.2 + (Math.PI * 2 * i) / 8;
              const ox = Math.round(heroX + Math.cos(ang) * 28);
              const oy = Math.round(heroY + Math.sin(ang) * 24);
              ctx.fillStyle = i % 2 === 0 ? '#FACC15' : '#FFFFFF';
              ctx.fillRect(ox - 1, oy - 1, 3, 3);
            }
          }

          // Verlet Scarf / Ponytail / Cape flowing upward in fast descent
          stepScarfNodes(scarfNodes, 0, 0, 1, 2.2, -7.2, elapsed, true, activeChassis.id);
          drawCharacterAccessory(ctx, scarfNodes, heroX - 6, heroY - 8, 56, true, activeChassis.id, elapsed);

          // Crisp 48x48 Exo-Rig Pixel Sprite
          const rigSpr = getExoRigPixelSprite({
            chassis: activeChassis.id,
            upgrades,
            rigLevel,
            pose: 'DRILL_STRIKE',
            animFrame,
            aimDir: 'DOWN',
            facing: 1,
            overdriveActive: true,
          });
          ctx.drawImage(rigSpr, heroX - 24, heroY - 24, 48, 48);

          // Plasma drill burst sparks downward from bit
          sparks.forEach((sp) => {
            const life = (elapsed * sp.speed + sp.phase) % 1;
            const sx = Math.round(heroX + sp.spread * life * 44);
            const sy = Math.round(heroY + 20 + life * 26);
            ctx.fillStyle = life < 0.35 ? '#FFFFFF' : life < 0.7 ? '#FACC15' : '#EE4E34';
            ctx.fillRect(sx, sy, life < 0.5 ? 2 : 1, life < 0.5 ? 2 : 1);
          });

          // 6. Floating hot embers rising across entire viewport
          embers.forEach((em) => {
            const ey = ((em.y - elapsed * em.speed) % 1 + 1) % 1;
            const ex = em.x + Math.sin(elapsed * 2.2 + em.phase) * 0.014;
            ctx.fillStyle = em.bright ? '#FACC15' : accentMain;
            ctx.globalAlpha = em.bright ? 0.8 : 0.52;
            ctx.fillRect(Math.round(ex * W), Math.round(ey * H), em.size, em.size);
            ctx.globalAlpha = 1;
          });
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [archive.selectedChassis, archive.rigLevel, archive.rigUpgrades, archive.architectCrownUnlocked]);

  return (
    <div
      onClick={finishOnce}
      onPointerMove={(e) => {
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        pointerRef.current = {
          nx: (e.clientX / w - 0.5) * 2,
          ny: (e.clientY / h - 0.5) * 2,
        };
      }}
      className="fixed inset-0 h-dvh w-full bg-[#06070B] text-[#F2EFE9] overflow-hidden select-none cursor-pointer touch-game-surface flex flex-col justify-between safe-pt safe-pb"
    >
      {/* Top 5-color Stratum Pixel Crown */}
      <div className="h-1.5 w-full grid grid-cols-5 shrink-0 z-20">
        {STRATA[0].blockColors.map((col, i) => (
          <div key={i} style={{ backgroundColor: col }} />
        ))}
      </div>

      {/* Full-Screen Pixel-Art Canvas (100% edge-to-edge) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block pixel-canvas" />

      {/* Atmospheric Edge Vignette (keeps title and CTA ultra-legible over lively pixel art) */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#06070B]/82 via-transparent to-[#06070B]/92 pointer-events-none" />

      {/* Subtle Corner Header */}
      <header className="relative z-10 px-4 sm:px-6 pt-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-pixel text-[9px] sm:text-[10px]">
          <span className="px-2 py-1 border border-[#EE4E34] bg-[#160D0F]/90 text-[#FACC15]">
            POZO 09 · SEÑAL ACTIVA
          </span>
          <span className="hidden sm:inline-block px-2 py-1 border border-[#2B2D38] bg-[#0B0C10]/85 text-[#C084FC]">
            ✦ {collectedCount}/14{archive.architectCrownUnlocked ? ' 👑' : ''}
          </span>
        </div>

        {onSkipForever && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (launchingRef.current) return;
              launchingRef.current = true;
              soundEngine.init();
              if (soundEnabled) soundEngine.playUiClick();
              onSkipForever();
            }}
            className="pixel-btn px-2.5 py-1.5 font-pixel text-[9px] text-[#A1A1AA] hover:text-white bg-[#0B0C10]/85 cursor-pointer"
          >
            No mostrar al iniciar
          </button>
        )}
      </header>

      {/* Upper Monumental Hero Title Overlay (No Heavy Box) */}
      <div className="relative z-10 px-4 pt-2 sm:pt-4 text-center pointer-events-none space-y-2">
        <div className="inline-block px-3 py-1 bg-[#D94126] border-2 border-[#F97316] font-pixel text-[10px] sm:text-xs font-bold tracking-[0.22em] text-white shadow-[0_3px_0_#7F1D1D]">
          PROYECTO SUBTERRÁNEO · 2149
        </div>
        <h1 className="font-display text-7xl sm:text-8xl font-bold tracking-tight text-white leading-none drop-shadow-[0_6px_0_#09090B]">
          ESTRATO
        </h1>
        <p className="font-pixel text-[10px] sm:text-xs tracking-[0.26em] text-[#FACC15] drop-shadow-[0_2px_0_#09090B]">
          DESCENSO CINÉTICO
        </p>
      </div>

      {/* Center Spacer Leaving Hero Exo-Rig Clear & Unobstructed */}
      <div className="flex-1 min-h-0 pointer-events-none" />

      {/* Bottom Launch Section */}
      <footer className="relative z-10 px-4 sm:px-6 pb-6 sm:pb-8 flex flex-col items-center gap-3 text-center">
        <p className="font-mono text-[11px] sm:text-xs text-[#E4E4E7] bg-[#0B0C10]/70 border border-[#262834] px-3 py-1.5 max-w-xl">
          {WHISPERS[whisperIdx]}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-[#A1A1AA] bg-[#0E1017]/90 border border-[#2B2D38] px-3.5 py-1.5">
          <span className="font-bold" style={{ color: activeChassis.accentColor }}>
            {activeChassis.name}
          </span>
          <span>·</span>
          <span className="text-[#38BDF8]">Piloto Niv. {rigLevel}</span>
          <span>·</span>
          <span>Récord {archive.maxDepthCampaign}m</span>
          <span>·</span>
          <span className="text-[#C084FC]">
            ✦ {collectedCount}/14{archive.architectCrownUnlocked ? ' 👑' : ''}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            finishOnce();
          }}
          className="pixel-btn-primary w-full max-w-sm py-3.5 sm:py-4 font-pixel text-xs sm:text-sm font-bold text-white tracking-wider animate-pulse shadow-[0_0_28px_rgba(238,78,52,0.55)] cursor-pointer"
        >
          ▶ INICIAR DESCENSO
        </button>

        <div className="font-mono text-[10px] text-[#8E92A4]">
          Pulsa en cualquier lugar o [ESPACIO / ENTER] para entrar al Pozo 09
        </div>
      </footer>

      {/* 145ms Ignition Flash on Launch */}
      {ignitionFlash && <div className="fixed inset-0 bg-[#FFF7ED]/70 pointer-events-none z-50 transition-opacity duration-150" />}
    </div>
  );
};
