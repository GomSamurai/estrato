import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Layers, Shield, Sparkles, Terminal, UserCheck, X } from 'lucide-react';
import { CHASSIS_LIST, MINERAL_SPECS, STRATA } from '../data/catalog';
import { GADGETS } from '../data/crafting';
import { KeyBindings, MineralSpecDef } from '../types/game';
import { soundEngine } from '../engine/audio';
import {
  getAcidVatBlockSprite,
  getBioSporeBlockSprite,
  getBouncePadBlockSprite,
  getConductorBlockSprite,
  getCryoSlagBlockSprite,
  getCryoVentBlockSprite,
  getCrystalBlockSprite,
  getExoRigPixelSprite,
  getGasPocketBlockSprite,
  getGeodeBlockSprite,
  getGravelBlockSprite,
  getGravWellBlockSprite,
  getHeavyOreBlockSprite,
  getMagmaNodeBlockSprite,
  getMagnetCoilBlockSprite,
  getMineralBlockSprite,
  getOxygenPodSprite,
  getPhaseBlockSprite,
  getPorousSpongeBlockSprite,
  getPrismCoreBlockSprite,
  getPyriteChargeBlockSprite,
  getResonanceVeinBlockSprite,
  getSeismicBellBlockSprite,
  getShockMineBlockSprite,
  getSlagBlockSprite,
  getSupportBeamBlockSprite,
  getTreasureCacheBlockSprite,
} from '../engine/pixelArt';
import { formatActionKeys } from '../storage/controls';

interface TacticalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  keyBindings?: KeyBindings;
}

type GuideTab = 'CONCEPT' | 'HUD_UI' | 'MOVEMENT' | 'COUNTER' | 'ABILITIES' | 'BLOCKS';

function drawPixelLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = '#FFFFFF',
  size = 10,
  withBg = true
) {
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  const pad = 6;
  const tw = ctx.measureText(text).width;
  const minX = pad + tw / 2;
  const maxX = Math.max(minX, ctx.canvas.width - pad - tw / 2);
  const cx = Math.max(minX, Math.min(maxX, x));

  if (withBg) {
    const bw = tw + 10;
    const bh = size + 5;
    ctx.fillStyle = 'rgba(9, 10, 15, 0.88)';
    ctx.fillRect(Math.round(cx - bw / 2), Math.round(y - size), Math.round(bw), bh);
  }

  ctx.fillStyle = '#09090B';
  ctx.fillText(text, Math.round(cx) + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(cx), y);
}

const BlockGuideThumb: React.FC<{ kind: MineralSpecDef['kind']; size?: number }> = ({ kind, size = 34 }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let id = 0;
    const draw = (now: number) => {
      const c = ref.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, size, size);
          const f = Math.floor((now / 1000) * 6) & 3;
          let spr: HTMLCanvasElement;
          if (kind === 'SLAG') spr = getSlagBlockSprite(STRATA[0].slagColor, 4, false, 0, f, false);
          else if (kind === 'CRYSTAL') spr = getCrystalBlockSprite(STRATA[1].blockColors[0], 0, false, f);
          else if (kind === 'CONDUCTOR') spr = getConductorBlockSprite(f, false);
          else if (kind === 'PHASE') spr = getPhaseBlockSprite(STRATA[4].blockColors[0], STRATA[2].blockColors[2], 2, false, f);
          else if (kind === 'OXYGEN') spr = getOxygenPodSprite(f);
          else if (kind === 'GEODE') spr = getGeodeBlockSprite(f);
          else if (kind === 'CRYO_VENT') spr = getCryoVentBlockSprite(f);
          else if (kind === 'MAGMA_NODE') spr = getMagmaNodeBlockSprite(f);
          else if (kind === 'GRAVEL') spr = getGravelBlockSprite(0);
          else if (kind === 'BOUNCE_PAD') spr = getBouncePadBlockSprite(f, false);
          else if (kind === 'RESONANCE_VEIN') spr = getResonanceVeinBlockSprite(f);
          else if (kind === 'SUPPORT_BEAM') spr = getSupportBeamBlockSprite(f);
          else if (kind === 'GAS_POCKET') spr = getGasPocketBlockSprite(f);
          else if (kind === 'ACID_VAT') spr = getAcidVatBlockSprite(f);
          else if (kind === 'GRAV_WELL') spr = getGravWellBlockSprite(f);
          else if (kind === 'SHOCK_MINE') spr = getShockMineBlockSprite(f, f >= 2);
          else if (kind === 'TREASURE_CACHE') spr = getTreasureCacheBlockSprite(f);
          else if (kind === 'HEAVY_ORE') spr = getHeavyOreBlockSprite(STRATA[0].blockColors[1], 1, f);
          else if (kind === 'PRISM_CORE') spr = getPrismCoreBlockSprite(f);
          else if (kind === 'PYRITE_CHARGE') spr = getPyriteChargeBlockSprite(f);
          else if (kind === 'POROUS_SPONGE') spr = getPorousSpongeBlockSprite(STRATA[0].blockColors[2], f);
          else if (kind === 'MAGNET_COIL') spr = getMagnetCoilBlockSprite(f);
          else if (kind === 'CRYO_SLAG') spr = getCryoSlagBlockSprite(0, f);
          else if (kind === 'SEISMIC_BELL') spr = getSeismicBellBlockSprite(f);
          else if (kind === 'BIO_SPORE') spr = getBioSporeBlockSprite(f);
          else spr = getMineralBlockSprite(1, STRATA[0].blockColors[0], 0, 0, 0, false);
          ctx.drawImage(spr, 1, 1, size - 2, size - 2);
        }
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [kind, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className="pixel-canvas shrink-0 bg-[#090A0F] border border-[#2B2D38]"
      style={{ width: size, height: size }}
    />
  );
};

const GuideDioramaCanvas: React.FC<{ tab: GuideTab }> = ({ tab }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId = 0;
    const render = (now: number) => {
      const canvas = ref.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          const t = (now / 1000) % 4;
          const f4 = Math.floor((now / 1000) * 6) & 3;
          ctx.imageSmoothingEnabled = false;
          ctx.fillStyle = '#090A0F';
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = 'rgba(255,255,255,0.04)';
          ctx.lineWidth = 1;
          for (let gx = 0; gx < w; gx += 24) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, h);
            ctx.stroke();
          }
          for (let gy = 0; gy < h; gy += 24) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(w, gy);
            ctx.stroke();
          }

          const rigIdle = getExoRigPixelSprite({
            chassis: 'MKI_VERTICE',
            upgrades: { drillTier: 1, thrusterTier: 0, tankTier: 0, armorTier: 0, capacitorTier: 0, magnetTier: 0 },
            rigLevel: 1,
            pose: 'IDLE',
            animFrame: f4,
            aimDir: 'DOWN',
            facing: 1,
          });

          if (tab === 'CONCEPT') {
            const phase = Math.floor(t);
            drawPixelLabel(
              ctx,
              phase === 3 ? 'CADENA x2+ + OVERDRIVE!' : 'BUCLE: PERFORA · UNE 4+ · SOBREVIVE',
              w / 2,
              15,
              '#FACC15',
              10
            );

            for (let i = 0; i < 4; i++) {
              const bx = 42 + i * 34;
              const isPrism = i === 2;
              const spr = isPrism
                ? getPrismCoreBlockSprite(f4)
                : getMineralBlockSprite(1, '#F97316', 0, i & 3, 0, false);
              if (phase === 3) {
                ctx.fillStyle = 'rgba(250, 204, 21, 0.34)';
                ctx.fillRect(bx - 2, 68, 32, 32);
              }
              ctx.drawImage(spr, bx, 70, 28, 28);
            }
            ctx.drawImage(getOxygenPodSprite(f4), 270, 70, 28, 28);
            ctx.drawImage(getTreasureCacheBlockSprite(f4), 344, 70, 28, 28);

            const rigDrill = getExoRigPixelSprite({
              chassis: 'MKI_VERTICE',
              upgrades: { drillTier: 1, thrusterTier: 0, tankTier: 0, armorTier: 0, capacitorTier: 0, magnetTier: 0 },
              rigLevel: 1,
              pose: phase < 2 ? 'DRILL_STRIKE' : 'DASH',
              animFrame: f4,
              aimDir: 'DOWN',
              facing: 1,
            });
            ctx.drawImage(rigDrill, 82 + Math.min(2, phase) * 14, 28, 36, 36);
            drawPixelLabel(ctx, '1. UNE 4+ O PRISMA', 110, 118, '#F97316', 9);
            drawPixelLabel(ctx, '2. RECOGE O₂ Y BOTÍN', 322, 118, '#38BDF8', 9);
            drawPixelLabel(ctx, 'META CAMPAÑA: GUARDIANES HASTA 3.500m', w / 2, 139, '#E4E4E7', 9);
          } else if (tab === 'HUD_UI') {
            drawPixelLabel(ctx, 'ELEMENTOS PRINCIPALES DE PANTALLA (HUD)', w / 2, 15, '#38BDF8', 10);
            ctx.fillStyle = '#12131A';
            ctx.fillRect(18, 24, 404, 94);
            ctx.strokeStyle = '#3F4354';
            ctx.strokeRect(18, 24, 404, 94);

            // Top bar widgets (fit strictly inside x=28..412)
            ctx.fillStyle = '#090A0F';
            ctx.fillRect(28, 32, 114, 22);
            ctx.strokeStyle = '#38BDF8';
            ctx.strokeRect(28, 32, 114, 22);
            drawPixelLabel(ctx, 'O₂ 84% · 🛡️2', 85, 47, '#38BDF8', 9, false);

            ctx.fillStyle = '#090A0F';
            ctx.fillRect(152, 32, 122, 22);
            ctx.strokeStyle = '#FACC15';
            ctx.strokeRect(152, 32, 122, 22);
            drawPixelLabel(ctx, '0420m · ESTILO S', 213, 47, '#FACC15', 9, false);

            ctx.fillStyle = '#090A0F';
            ctx.fillRect(284, 32, 128, 22);
            ctx.strokeStyle = '#F43F5E';
            ctx.strokeRect(284, 32, 128, 22);
            drawPixelLabel(ctx, '⚠️ ALERTA CAÍDA', 348, 47, '#FDA4AF', 9, false);

            const hi = Math.floor(t) % 2;
            drawPixelLabel(ctx, 'BARRA SUPERIOR: OXÍGENO, ESCUDOS, COTA Y PELIGRO', w / 2, 71, hi === 0 ? '#FFFFFF' : '#94A3B8', 9, false);

            // Bottom skill dock widgets (fit cleanly inside x=28..410)
            const btns: [string, string, number][] = [
              ['⚡ 100%', '#FACC15', 28],
              ['✦ 85%', '#38BDF8', 106],
              ['◈ LISTO', '#A3E635', 184],
              ['[1] 🧪', '#C084FC', 262],
              ['[?] INFO', '#E4E4E7', 340],
            ];
            for (const [label, col, bx] of btns) {
              ctx.fillStyle = '#181A24';
              ctx.fillRect(bx, 83, 70, 23);
              ctx.strokeStyle = col;
              ctx.strokeRect(bx, 83, 70, 23);
              drawPixelLabel(ctx, label, bx + 35, 98, col, 9, false);
            }
            drawPixelLabel(ctx, 'TOCA CUALQUIER BARRA O [?] PARA LEER SU EFECTO', w / 2, 139, hi === 1 ? '#FACC15' : '#94A3B8', 9);
          } else if (tab === 'MOVEMENT') {
            drawPixelLabel(ctx, 'ARRASTRA LATERAL -> CAMINA O TREPA 1 BLOQUE', w / 2, 15, '#38BDF8', 10);
            const tile = getMineralBlockSprite(1, STRATA[0].blockColors[0], 0, 0, 0, false);
            for (let c = 0; c < 8; c++) {
              ctx.drawImage(tile, 44 + c * 44, 88, 34, 34);
            }
            // Step block on column 4
            ctx.drawImage(tile, 220, 54, 34, 34);

            const prog = (t % 2) / 2;
            const px = prog < 0.5 ? 128 + prog * 2 * 44 : 172 + (prog - 0.5) * 2 * 44;
            const py = prog < 0.5 ? 54 : 54 - Math.sin((prog - 0.5) * 2 * Math.PI * 0.5) * 34;
            ctx.drawImage(rigIdle, px, py, 34, 34);

            const handX = 48 + ((t * 36) % 90);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
            ctx.fillRect(46, 36, handX - 46, 4);
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath();
            ctx.arc(handX, 38, 6, 0, Math.PI * 2);
            ctx.fill();

            drawPixelLabel(ctx, 'PERMUTA Q / E O ARRASTRA · DOBLE TAP: DASH', w / 2, 139, '#FACC15', 9);
          } else if (tab === 'COUNTER') {
            drawPixelLabel(ctx, 'AVISO ROJO SUPERIOR -> CONTRAATAQUE / PARRY!', w / 2, 15, '#FACC15', 10);
            const slag = getSlagBlockSprite(STRATA[1].slagColor, 2, false, 1, f4, t > 2.1 && t < 2.6);
            const floor = getMineralBlockSprite(2, STRATA[1].blockColors[1], 1, 0, 0, false);
            for (let c = 0; c < 8; c++) {
              ctx.drawImage(floor, 44 + c * 44, 90, 34, 34);
            }
            const fallY = t < 2.0 ? 22 + t * 18 : 54;
            if (t >= 1.4 && t <= 2.3) {
              ctx.strokeStyle = '#EF4444';
              ctx.lineWidth = 2;
              ctx.strokeRect(202, fallY - 2, 36, 36);
            }
            if (t > 2.2 && t < 3.0) {
              ctx.beginPath();
              ctx.arc(220, 66, 24, Math.PI, 0);
              ctx.strokeStyle = '#38BDF8';
              ctx.lineWidth = 3;
              ctx.stroke();
              drawPixelLabel(ctx, 'BLOQUE DESTRUIDO!', 220, 38, '#A3E635', 10);
            } else {
              ctx.drawImage(slag, 203, fallY, 34, 34);
            }
            ctx.drawImage(rigIdle, 203, 56, 34, 34);
            drawPixelLabel(ctx, 'PULSA W / ↑ / ESPACIO O DESLIZA ↑ AL IMPACTO', w / 2, 139, '#38BDF8', 9);
          } else if (tab === 'ABILITIES') {
            drawPixelLabel(
              ctx,
              t > 2.4 ? '⚡ OVERDRIVE + ✦ RESONANCIA LISTOS!' : 'CADENAS Y PERFORACIÓN RECARGAN BARRAS',
              w / 2,
              15,
              '#FACC15',
              10
            );
            const odW = Math.min(200, (t / 3.5) * 200);
            ctx.fillStyle = '#181A22';
            ctx.fillRect(120, 24, 200, 14);
            ctx.fillStyle = t > 2.4 ? '#FACC15' : '#F97316';
            ctx.fillRect(122, 26, Math.max(0, odW - 4), 10);

            const pulse = 1 + Math.sin(now / 120) * 0.22;
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(220, 76, 22 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.drawImage(rigIdle, 202, 58, 36, 36);

            drawPixelLabel(ctx, '⚡ [X] OVERDRIVE', 86, 66, '#FACC15', 9);
            drawPixelLabel(ctx, '✦ [F] RESONANCIA', 86, 98, '#38BDF8', 9);
            drawPixelLabel(ctx, '◈ [G] TÁCTICA', 354, 66, '#A3E635', 9);
            drawPixelLabel(ctx, '🧪 [1-3] GADGETS', 354, 98, '#C084FC', 9);
            drawPixelLabel(ctx, 'TOCA CUALQUIER BOTÓN DEL HUD PARA SU FICHA', w / 2, 139, '#E4E4E7', 9);
          } else {
            drawPixelLabel(ctx, '26 TIPOS DE BLOQUES Y RELIQUIAS GEOLÓGICAS', w / 2, 15, '#FACC15', 10);
            const samples: [HTMLCanvasElement, string][] = [
              [getBouncePadBlockSprite(f4, t > 2), 'VÁLV.'],
              [getPrismCoreBlockSprite(f4), 'PRISMA'],
              [getPyriteChargeBlockSprite(f4), 'PIRITA'],
              [getPorousSpongeBlockSprite(STRATA[0].blockColors[2], f4), 'PÓMEZ'],
              [getMagnetCoilBlockSprite(f4), 'BOBINA'],
              [getCryoSlagBlockSprite(0, f4), 'CRIO'],
              [getSeismicBellBlockSprite(f4), 'CAMP.'],
              [getBioSporeBlockSprite(f4), 'ESPORA'],
            ];
            samples.forEach(([spr, lbl], idx) => {
              const sx = 24 + idx * 50;
              ctx.drawImage(spr, sx, 38, 32, 32);
              drawPixelLabel(ctx, lbl, sx + 16, 86, '#D4D4D8', 8, false);
            });
            drawPixelLabel(ctx, 'CADA ESTRATO DESBLOQUEA NUEVAS INTERACCIONES', w / 2, 114, '#38BDF8', 9);
            drawPixelLabel(ctx, 'DESLIZA ABAJO PARA VER LAS 26 FICHAS COMPLETAS', w / 2, 139, '#A3E635', 9);
          }
        }
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [tab]);

  return (
    <canvas
      ref={ref}
      width={440}
      height={148}
      className="w-full max-w-[540px] mx-auto block border-2 border-[#2B2D38] bg-[#090A0F] pixel-canvas shrink-0"
    />
  );
};

export const TacticalGuideModal: React.FC<TacticalGuideModalProps> = ({
  isOpen,
  onClose,
  isMobile = false,
  keyBindings,
}) => {
  const [tab, setTab] = useState<GuideTab>('CONCEPT');
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      bodyScrollRef.current?.scrollTo({ top: 0 });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tabs: { id: GuideTab; label: string }[] = [
    { id: 'CONCEPT', label: 'Concepto' },
    { id: 'HUD_UI', label: 'Interfaz HUD' },
    { id: 'MOVEMENT', label: 'Movimiento' },
    { id: 'COUNTER', label: 'Parry' },
    { id: 'ABILITIES', label: 'Habilidades' },
    { id: 'BLOCKS', label: 'Bloques (26)' },
  ];

  const tabIndex = Math.max(0, tabs.findIndex((t) => t.id === tab));
  const selectTab = (nextId: GuideTab) => {
    soundEngine.playUiClick();
    setTab(nextId);
    bodyScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const kb = keyBindings;
  const drillKey = kb ? formatActionKeys(kb, 'drill') : 'J / Espacio';
  const swapKeys = kb ? `${formatActionKeys(kb, 'swapLeft')} / ${formatActionKeys(kb, 'swapRight')}` : 'Q / E';
  const dashKey = kb ? formatActionKeys(kb, 'dash') : 'C / Shift';
  const odKey = kb ? formatActionKeys(kb, 'overdrive') : 'X';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/88 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92dvh] flex flex-col pixel-panel bg-[#12131A] border-2 border-[#38BDF8] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Non-Shrinking Top Header & Tab Bar */}
        <div className="shrink-0 px-3.5 sm:px-5 pt-3.5 pb-2.5 border-b-2 border-[#232530] bg-[#141620] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-5 h-5 text-[#38BDF8] shrink-0" />
              <div className="min-w-0">
                <h2 className="font-display text-lg sm:text-2xl font-bold text-white leading-tight">
                  Manual Táctico e Interfaz · ESTRATO
                </h2>
                <p className="text-[11px] text-[#8E92A4] leading-snug">
                  Concepto completo, leyenda del HUD, habilidades de operadores y los {MINERAL_SPECS.length} bloques del abismo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onClose();
              }}
              aria-label="Cerrar manual"
              className="pixel-btn p-1.5 text-[#A1A1AA] hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTab(t.id)}
                className={`py-2 px-1.5 font-pixel text-[8px] sm:text-[9px] border-2 cursor-pointer transition-colors ${
                  tab === t.id
                    ? 'border-[#38BDF8] bg-[#0F1B26] text-white'
                    : 'border-[#232530] bg-[#161720] text-[#8E92A4] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dedicated Single Scrollable Body */}
        <div
          ref={bodyScrollRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3.5 sm:px-5 py-3.5 space-y-3.5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <GuideDioramaCanvas tab={tab} />

          {tab === 'CONCEPT' && (
            <div className="space-y-2.5 text-xs text-[#E4E4E7] leading-relaxed">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 bg-[#0E1017] border border-[#F97316]/40">
                  <div className="font-pixel text-[9px] text-[#F97316]">OBJETIVO DEL DESCENSO</div>
                  <p className="mt-1">
                    Excava verticalmente a través de 7 estratos hasta los 3.500 m. Cada 500 m te espera un{' '}
                    <strong className="text-white">Guardián mecánico</strong> y las transmisiones del Pozo 09 revelan la conspiración de HELIOS.
                  </p>
                </div>
                <div className="p-3 bg-[#0E1017] border border-[#38BDF8]/40">
                  <div className="font-pixel text-[9px] text-[#38BDF8]">QUÍMICA DE CADENAS (4+)</div>
                  <p className="mt-1">
                    Permuta bloques para unir <strong className="text-white">4+ del mismo color</strong> (o con un Prisma Cromático) e iniciar ignición. Detonar cadenas ×2/×3/×4+ regenera oxígeno y recarga habilidades.
                  </p>
                </div>
                <div className="p-3 bg-[#0E1017] border border-[#FACC15]/40">
                  <div className="font-pixel text-[9px] text-[#FACC15]">OXÍGENO Y ÚLTIMO ALIENTO</div>
                  <p className="mt-1">
                    Si el O₂ llega a 0%, entras en <strong className="text-[#FB7185]">Último Aliento</strong> en cámara lenta: recoge una cápsula o detona ×2+ para sobrevivir al límite.
                  </p>
                </div>
                <div className="p-3 bg-[#0E1017] border border-[#A3E635]/40">
                  <div className="font-pixel text-[9px] text-[#A3E635]">DIRECTOR DINÁMICO Y BIFURCACIONES</div>
                  <p className="mt-1">
                    El Director de Campaña reacciona a tu partida: libera bolsas de O₂ si estás al borde de la asfixia o invoca vetas de Prisma y Mena Acorazada si mantienes Estilo S/SS/SSS.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'HUD_UI' && (
            <div className="space-y-2.5 text-xs text-[#E4E4E7] leading-relaxed">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                <div className="p-3 bg-[#0E1017] border border-[#38BDF8]/40">
                  <div className="font-pixel text-[9px] text-[#38BDF8]">BARRA DE OXÍGENO (%) Y ESCUDOS (🛡️)</div>
                  <p className="mt-1">Muestra el aire restante antes de la asfixia. Los Escudos Cinéticos absorben un aplastamiento o impacto letal automático.</p>
                </div>
                <div className="p-3 bg-[#0E1017] border border-[#FACC15]/40">
                  <div className="font-pixel text-[9px] text-[#FACC15]">⚡ OVERDRIVE SÍSMICO [{odKey}]</div>
                  <p className="mt-1">Al llegar al 100%, detiene el drenaje de O₂, rompe escoria de 1 toque y perfora varios bloques en línea.</p>
                </div>
                <div className="p-3 bg-[#0E1017] border border-[#A78BFA]/40">
                  <div className="font-pixel text-[9px] text-[#A78BFA]">✦ RESONANCIA DE OPERADOR [F]</div>
                  <p className="mt-1">Habilidad definitiva exclusiva de tu piloto. Se recarga perforando, detonando cadenas y recolectando vetas.</p>
                </div>
                <div className="p-3 bg-[#0E1017] border border-[#A3E635]/40">
                  <div className="font-pixel text-[9px] text-[#A3E635]">◈ TÁCTICA [G] Y CINTURÓN [1-3]</div>
                  <p className="mt-1">
                    Habilidad activa de recarga rápida (◈) y hasta 3 artilugios consumibles equipados en el Hangar.{' '}
                    <strong className="text-white">Toca cualquier botón aunque esté cargando o pulsa [?]</strong> para ver su efecto en vivo.
                  </p>
                </div>
                <div className="p-3 bg-[#0E1017] border border-[#F97316]/40">
                  <div className="font-pixel text-[9px] text-[#F97316]">🔥 DETONAR · ♻ REROLL · ESTILO (D–SSS)</div>
                  <p className="mt-1">Acelera igniciones abiertas al instante para sumar ×Cadena. El Rango de Estilo mide tu fluidez y activa retos del Director.</p>
                </div>
                <div className="p-3 bg-[#0E1017] border border-[#FB7185]/40">
                  <div className="font-pixel text-[9px] text-[#FB7185]">ALERTA ⚠️ SUPERIOR Y BALIZA DE RÉCORD</div>
                  <p className="mt-1">El borde rojo parpadea cuando una columna suelta está a punto de caer sobre tu cabeza. La línea dorada marca tu mejor profundidad.</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'MOVEMENT' && (
            <div className="space-y-2.5 text-xs text-[#E4E4E7] leading-relaxed">
              {isMobile ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                  <div className="p-3 bg-[#0E1017] border border-[#232530]">
                    <div className="font-pixel text-[9px] text-[#38BDF8]">DESLIZAR EN EL POZO</div>
                    <p className="mt-1">Arrastra el dedo lateralmente sobre un hueco para caminar 1 casilla o trepar encima de un bloque.</p>
                  </div>
                  <div className="p-3 bg-[#0E1017] border border-[#232530]">
                    <div className="font-pixel text-[9px] text-[#FACC15]">PERMUTAR BLOQUES</div>
                    <p className="mt-1">Toca un bloque y deslízalo hacia izquierda/derecha para intercambiar posiciones y juntar 4 iguales.</p>
                  </div>
                  <div className="p-3 bg-[#0E1017] border border-[#232530]">
                    <div className="font-pixel text-[9px] text-[#F97316]">TOQUE / DESLIZ ↓ PICAR</div>
                    <p className="mt-1">Toca un bloque adyacente para taladrar. Desliza hacia abajo en zona libre para perforación rápida.</p>
                  </div>
                  <div className="p-3 bg-[#0E1017] border border-[#232530]">
                    <div className="font-pixel text-[9px] text-[#A3E635]">DOBLE TOQUE / DASH</div>
                    <p className="mt-1">Pulsa dos veces rápido a izquierda o derecha en aire para carrera continua o usa el botón DASH.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                  <div className="p-3 bg-[#0E1017] border border-[#232530]">
                    <div className="font-pixel text-[9px] text-[#38BDF8]">MOVIMIENTO Y ESCALADA</div>
                    <p className="mt-1">Pulsa A / D o Flechas. Toca pared + bloque accesible para trepar 1 nivel automáticamente sin atascarte.</p>
                  </div>
                  <div className="p-3 bg-[#0E1017] border border-[#232530]">
                    <div className="font-pixel text-[9px] text-[#FACC15]">TALADRO Y PERMUTA</div>
                    <p className="mt-1">Pulsa <kbd className="px-1 bg-[#1C1D26] border border-[#3F4354]">{drillKey}</kbd> o clic izquierdo para taladrar; <kbd className="px-1 bg-[#1C1D26] border border-[#3F4354]">{swapKeys}</kbd> o clic derecho para permutar.</p>
                  </div>
                  <div className="p-3 bg-[#0E1017] border border-[#232530]">
                    <div className="font-pixel text-[9px] text-[#F97316]">IMPULSO / FRENO AÉREO</div>
                    <p className="mt-1">Pulsa <kbd className="px-1 bg-[#1C1D26] border border-[#3F4354]">{dashKey}</kbd> para atravesar peligros o frenar una caída larga antes del impacto.</p>
                  </div>
                  <div className="p-3 bg-[#0E1017] border border-[#232530]">
                    <div className="font-pixel text-[9px] text-[#A3E635]">SALTO TÁCTICO HACIA ARRIBA</div>
                    <p className="mt-1">Mantén W / ↑ + Dash para impulso vertical por el eje cuando necesites escapar hacia arriba.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'COUNTER' && (
            <div className="space-y-2.5 text-xs text-[#E4E4E7] leading-relaxed">
              <p className="text-[#FACC15] font-semibold">
                Cuando un bloque o columna cae encima de tu Exo-Rig dispones de una ventana de supervivencia táctica:
              </p>
              <ul className="space-y-2 text-[11px] list-disc pl-4">
                <li><strong className="text-white">Contraataque en tiempo real:</strong> pulsa W / ↑ o ESPACIO (o desliza hacia arriba en móvil) justo cuando aparezca el aviso rojo superior.</li>
                <li><strong className="text-[#A3E635]">Parry Perfecto:</strong> sincroniza el golpe exacto al impacto y pulverizas el bloque enemigo sin daño + recargas Dash e Overdrive.</li>
                <li><strong className="text-[#38BDF8]">Escudos y Roca Pómez:</strong> un Escudo Cinético absorbe aplastamientos automáticamente, y caer sobre Roca Pómez amortigua el daño de altura (+6% O₂).</li>
                <li><strong className="text-[#F97316]">Módulos de Supervivencia:</strong> busca Quiebrabloques o Propulsión de Escape en las Cámaras de Brecha para ampliar tu ventana de parry.</li>
              </ul>
            </div>
          )}

          {tab === 'ABILITIES' && (
            <div className="space-y-3 text-xs text-[#E4E4E7] leading-relaxed">
              <div className="flex items-center gap-1.5 font-pixel text-[10px] text-[#38BDF8]">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                TODOS LOS OPERADORES (PASIVA · ✦ RESONANCIA · ◈ TÁCTICA)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CHASSIS_LIST.map((ch) => (
                  <div key={ch.id} className="p-3 bg-[#0E1017] border border-[#232530] space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-display text-base font-bold text-white">{ch.callsign}</span>
                      <span
                        className="font-pixel text-[8px] px-1.5 py-0.5 border"
                        style={{ color: ch.accentColor, borderColor: `${ch.accentColor}66` }}
                      >
                        {ch.code} · {ch.role.split(' ')[0]}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#D4D4D8]">
                      <strong className="text-[#94A3B8]">Pasiva:</strong> {ch.traitTitle} — {ch.traitDesc}
                    </div>
                    <div className="text-[11px] text-[#BAE6FD]">
                      <strong style={{ color: ch.accentColor }}>✦ {ch.signatureName}:</strong> {ch.signatureDesc}
                    </div>
                    <div className="text-[11px] text-[#BEF264]">
                      <strong className="text-[#A3E635]">◈ {ch.tacticalName}:</strong> {ch.tacticalDesc}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 font-pixel text-[10px] text-[#FACC15] pt-2 border-t border-[#232530]">
                <Shield className="w-3.5 h-3.5 shrink-0" />
                CINTURÓN DE GADGETS CONSUMIBLES [TECLAS 1 · 2 · 3]
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {GADGETS.map((g) => (
                  <div key={g.id} className="p-2.5 bg-[#0E1017] border border-[#232530] flex items-start gap-2.5">
                    <span className="text-base leading-none shrink-0" style={{ color: g.color }}>{g.glyph}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-white">{g.name}</div>
                      <div className="text-[#A1A1AA]">{g.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-[#12101D] border border-[#C084FC]/40 text-[11px] flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#C084FC] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#E9D5FF]">SINERGIAS DE ARQUETIPO (2 / 4 / 6 Módulos):</strong> reunir varios módulos de un mismo arquetipo en Cámaras de Brecha (250m / 750m / 1250m) desbloquea bonos de conjunto: explosiones mayores (Pyro), freno de drenaje O₂ (Cryo), alcance de permuta +2 (Cuántico), blindaje sísmico (Balístico) o saqueo de isótopos (Parásito).
                </div>
              </div>
            </div>
          )}

          {tab === 'BLOCKS' && (
            <div className="space-y-3 text-xs text-[#E4E4E7] leading-relaxed">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#A1A1AA]">
                <span className="flex items-center gap-1.5 font-pixel text-[#FACC15]">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  ESPECTRO COMPLETO DE {MINERAL_SPECS.length} BLOQUES
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Terminal className="w-3 h-3 text-[#38BDF8] shrink-0" />
                  Q/E o arrastre funciona con casi todos
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                {MINERAL_SPECS.map((sp) => (
                  <div key={sp.kind} className="p-2.5 bg-[#0E1017] border border-[#232530] flex items-start gap-2.5">
                    <BlockGuideThumb kind={sp.kind} size={36} />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                        <span className="font-bold text-white leading-tight">{sp.name}</span>
                        <span className="font-mono text-[10px] text-[#38BDF8] shrink-0">{sp.strataRange.split('(')[0].trim()}</span>
                      </div>
                      <div className="font-mono text-[10px] text-[#FACC15]">{sp.hardness}</div>
                      <p className="text-[#A1A1AA] leading-snug">{sp.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Bottom Footer with Section Pager & Close */}
        <div className="shrink-0 px-3.5 sm:px-5 py-2.5 border-t-2 border-[#232530] bg-[#141620] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={tabIndex <= 0}
              onClick={() => tabIndex > 0 && selectTab(tabs[tabIndex - 1].id)}
              aria-label="Sección anterior"
              className="pixel-btn px-2.5 py-2 font-pixel text-[9px] text-[#D4D4D8] disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Anterior</span>
            </button>
            <button
              type="button"
              disabled={tabIndex >= tabs.length - 1}
              onClick={() => tabIndex < tabs.length - 1 && selectTab(tabs[tabIndex + 1].id)}
              aria-label="Siguiente sección"
              className="pixel-btn px-2.5 py-2 font-pixel text-[9px] text-[#38BDF8] disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <span className="hidden sm:inline">Siguiente</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="pixel-btn-primary flex-1 sm:flex-initial sm:min-w-[160px] py-2 px-4 font-pixel text-xs font-bold text-white cursor-pointer"
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  );
};
