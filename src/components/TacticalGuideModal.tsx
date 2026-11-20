import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Layers, Shield, Sparkles, Terminal, UserCheck, X } from 'lucide-react';
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

function drawPixelLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#FFFFFF', size = 10) {
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#09090B';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
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
          else if (kind === 'MAGMA_NODE') spr = getMagmaNodeBlockSpriteSafe(f);
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

// Local safe wrapper so unused import check is avoided while reusing Magma sprite cleanly
import { getMagmaNodeBlockSprite as _getMagmaSprite } from '../engine/pixelArt';
function getMagmaNodeBlockSpriteSafe(f: number): HTMLCanvasElement {
  return _getMagmaSprite(f);
}

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

          // Subtle background strata grid
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
            // Core vertical loop: Drill -> Prism/Match 4+ -> Chain Explosion + O2 -> Guardián 500m
            const phase = Math.floor(t);
            const blocks = [0, 0, 1, 0];
            for (let i = 0; i < 4; i++) {
              const bx = 34 + i * 32;
              const isPrism = i === 2;
              const spr = isPrism
                ? getPrismCoreBlockSprite(f4)
                : getMineralBlockSprite(1, '#F97316', 0, i & 3, 0, false);
              if (phase === 3) {
                ctx.fillStyle = 'rgba(250, 204, 21, 0.32)';
                ctx.fillRect(bx - 2, 62, 32, 32);
              }
              ctx.drawImage(spr, bx, 64, 28, 28);
            }
            ctx.drawImage(getOxygenPodSprite(f4), 192, 64, 28, 28);
            ctx.drawImage(getTreasureCacheBlockSprite(f4), 240, 64, 28, 28);

            const rigDrill = getExoRigPixelSprite({
              chassis: 'MKI_VERTICE',
              upgrades: { drillTier: 1, thrusterTier: 0, tankTier: 0, armorTier: 0, capacitorTier: 0, magnetTier: 0 },
              rigLevel: 1,
              pose: phase < 2 ? 'DRILL_STRIKE' : 'DASH',
              animFrame: f4,
              aimDir: 'DOWN',
              facing: 1,
            });
            ctx.drawImage(rigDrill, 74 + Math.min(2, phase) * 14, 18, 42, 42);
            drawPixelLabel(ctx, '1. JUNTA 4+ O PRISMA', 96, 114, '#F97316');
            drawPixelLabel(ctx, '2. RECOGE O₂ Y COFRES', 226, 114, '#38BDF8');
            drawPixelLabel(ctx, phase === 3 ? 'CADENA x2+ + OVERDRIVE!' : 'PERFORA HACIA EL NÚCLEO (3.500m)', w / 2, 134, '#FACC15');
            void blocks;
          } else if (tab === 'HUD_UI') {
            // Annotated miniature HUD mockup
            ctx.fillStyle = '#12131A';
            ctx.fillRect(14, 12, w - 28, 116);
            ctx.strokeStyle = '#3F4354';
            ctx.strokeRect(14, 12, w - 28, 116);

            // Top bar widgets
            ctx.fillStyle = '#090A0F';
            ctx.fillRect(22, 20, 74, 20);
            ctx.strokeStyle = '#38BDF8';
            ctx.strokeRect(22, 20, 74, 20);
            drawPixelLabel(ctx, 'O₂ 84% 🛡️2', 59, 34, '#38BDF8', 9);

            ctx.fillStyle = '#090A0F';
            ctx.fillRect(104, 20, 70, 20);
            ctx.strokeStyle = '#FACC15';
            ctx.strokeRect(104, 20, 70, 20);
            drawPixelLabel(ctx, '0420m · S+', 139, 34, '#FACC15', 9);

            ctx.fillStyle = '#090A0F';
            ctx.fillRect(182, 20, 96, 20);
            ctx.strokeStyle = '#F43F5E';
            ctx.strokeRect(182, 20, 96, 20);
            drawPixelLabel(ctx, '⚠️ CAÍDA / ESTILO', 230, 34, '#FDA4AF', 9);

            // Bottom skill dock widgets
            const btns: [string, string, number][] = [
              ['⚡ 100%', '#FACC15', 24],
              ['✦ 85%', '#38BDF8', 82],
              ['◈ LISTO', '#A3E635', 140],
              ['[1] 🧪', '#C084FC', 198],
              ['[?]', '#E4E4E7', 250],
            ];
            for (const [label, col, bx] of btns) {
              ctx.fillStyle = '#181A24';
              ctx.fillRect(bx, 74, 50, 22);
              ctx.strokeStyle = col;
              ctx.strokeRect(bx, 74, 50, 22);
              drawPixelLabel(ctx, label, bx + 25, 89, col, 9);
            }
            const hi = Math.floor(t) % 3;
            drawPixelLabel(ctx, 'BARRA SUPERIOR: O₂, ESCUDOS, COTA Y RIESGO', w / 2, 58, hi === 0 ? '#FFFFFF' : '#8E92A4', 9);
            drawPixelLabel(ctx, 'BOTONERA TÁCTICA: OVERDRIVE · RESONANCIA · TÁCTICA · GADGETS · ?', w / 2, 114, hi >= 1 ? '#FACC15' : '#8E92A4', 8);
          } else if (tab === 'MOVEMENT') {
            const tile = getMineralBlockSprite(1, STRATA[0].blockColors[0], 0, 0, 0, false);
            for (let c = 0; c < 6; c++) {
              ctx.drawImage(tile, 20 + c * 44, 96, 40, 40);
            }
            ctx.drawImage(tile, 152, 56, 40, 40);
            const prog = (t % 2) / 2;
            const px = prog < 0.5 ? 64 + prog * 2 * 44 : 108 + (prog - 0.5) * 2 * 44;
            const py = prog < 0.5 ? 54 : 54 - Math.sin((prog - 0.5) * 2 * Math.PI * 0.5) * 40;
            ctx.drawImage(rigIdle, px, py, 40, 40);

            const handX = 64 + ((t * 50) % 120);
            ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
            ctx.fillRect(60, 24, handX - 60, 4);
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath();
            ctx.arc(handX, 26, 7, 0, Math.PI * 2);
            ctx.fill();
            drawPixelLabel(ctx, 'ARRASTRA -> TREPA 1 BLOQUE', 150, 18, '#38BDF8');
            drawPixelLabel(ctx, 'PERMUTA Q / E o ARRASTRA', 225, 134, '#FACC15');
          } else if (tab === 'COUNTER') {
            const slag = getSlagBlockSprite(STRATA[1].slagColor, 2, false, 1, f4, t > 2.1 && t < 2.6);
            const floor = getMineralBlockSprite(2, STRATA[1].blockColors[1], 1, 0, 0, false);
            for (let c = 0; c < 6; c++) {
              ctx.drawImage(floor, 20 + c * 44, 102, 40, 40);
            }
            const fallY = t < 2.0 ? 8 + t * 24 : 56;
            if (t >= 1.5 && t <= 2.4) {
              ctx.strokeStyle = '#EF4444';
              ctx.lineWidth = 2;
              ctx.strokeRect(128, fallY - 2, 44, 44);
              drawPixelLabel(ctx, 'PARRY ↑ / ESPACIO!', 150, 20, '#FACC15');
            }
            if (t > 2.2 && t < 3.0) {
              ctx.fillStyle = '#38BDF8';
              ctx.beginPath();
              ctx.arc(150, 74, 24, Math.PI, 0);
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 3;
              ctx.stroke();
              drawPixelLabel(ctx, 'BLOQUE DESTRUIDO!', 150, 44, '#A3E635');
            } else {
              ctx.drawImage(slag, 130, fallY, 40, 40);
            }
            ctx.drawImage(rigIdle, 130, 62, 40, 40);
          } else if (tab === 'ABILITIES') {
            const odW = Math.min(180, (t / 3.5) * 180);
            ctx.fillStyle = '#181A22';
            ctx.fillRect(60, 22, 180, 16);
            ctx.fillStyle = t > 2.5 ? '#FACC15' : '#F97316';
            ctx.fillRect(62, 24, Math.max(0, odW - 4), 12);
            drawPixelLabel(ctx, t > 2.5 ? '⚡ OVERDRIVE + RESONANCIA ✦ LISTOS!' : 'CADENAS RECARGAN ⚡ / ✦ / ◈', 150, 16, '#FACC15');

            const pulse = 1 + Math.sin(now / 120) * 0.25;
            ctx.strokeStyle = '#38BDF8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(150, 82, 22 * pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.drawImage(rigIdle, 130, 62, 40, 40);
            drawPixelLabel(ctx, 'RESONANCIA [F] · TÁCTICA [G] · CINTURÓN [1-3]', 150, 130, '#A3E635');
          } else {
            // BLOCKS showcase row animating all key tactical blocks
            const samples = [
              getBouncePadBlockSprite(f4, t > 2),
              getPrismCoreBlockSprite(f4),
              getPyriteChargeBlockSprite(f4),
              getPorousSpongeBlockSprite(STRATA[0].blockColors[2], f4),
              getMagnetCoilBlockSprite(f4),
              getCryoSlagBlockSprite(0, f4),
              getSeismicBellBlockSprite(f4),
              getBioSporeBlockSprite(f4),
            ];
            samples.forEach((spr, idx) => {
              ctx.drawImage(spr, 16 + idx * 34, 46, 30, 30);
            });
            drawPixelLabel(ctx, '26 TIPOS DE BLOQUES Y RELIQUIAS GEOLÓGICAS', w / 2, 26, '#FACC15');
            drawPixelLabel(ctx, 'CADA ESTRATO INTRODUCE NUEVAS INTERACCIONES TÁCTICAS', w / 2, 108, '#38BDF8');
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
      width={300}
      height={142}
      className="w-full max-w-[340px] mx-auto block border-2 border-[#2B2D38] bg-[#090A0F] pixel-canvas"
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

  if (!isOpen) return null;

  const tabs: { id: GuideTab; label: string }[] = [
    { id: 'CONCEPT', label: 'Concepto' },
    { id: 'HUD_UI', label: 'Interfaz HUD' },
    { id: 'MOVEMENT', label: 'Movimiento' },
    { id: 'COUNTER', label: 'Parry' },
    { id: 'ABILITIES', label: 'Habilidades' },
    { id: 'BLOCKS', label: 'Bloques (26)' },
  ];

  const kb = keyBindings;
  const drillKey = kb ? formatActionKeys(kb, 'drill') : 'J / Espacio';
  const swapKeys = kb ? `${formatActionKeys(kb, 'swapLeft')} / ${formatActionKeys(kb, 'swapRight')}` : 'Q / E';
  const dashKey = kb ? formatActionKeys(kb, 'dash') : 'C / Shift';
  const odKey = kb ? formatActionKeys(kb, 'overdrive') : 'X';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto pixel-panel bg-[#12131A] border-[#38BDF8] p-4 sm:p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#232530] pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#38BDF8]" />
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-tight">
                Manual Táctico e Interfaz · ESTRATO
              </h2>
              <p className="text-[11px] text-[#8E92A4]">
                Concepto completo, leyenda del HUD, habilidades de operadores y los 26 bloques del abismo.
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
            className="pixel-btn p-1.5 text-[#A1A1AA] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setTab(t.id);
              }}
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

        <GuideDioramaCanvas tab={tab} />

        {tab === 'CONCEPT' && (
          <div className="space-y-2.5 text-xs text-[#E4E4E7] leading-relaxed">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 bg-[#0E1017] border border-[#F97316]/40">
                <div className="font-pixel text-[9px] text-[#F97316]">OBJETIVO DEL DESCENSO</div>
                <p className="mt-1">
                  Excava verticalmente a través de 7 estratos hasta los 3.500 m. Cada 500 m te espera un{' '}
                  <strong className="text-white">Guardián mecánico</strong> y las transmisiones del Pozo 09 revelan la conspiración de HELIOS.
                </p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#38BDF8]/40">
                <div className="font-pixel text-[9px] text-[#38BDF8]">QUÍMICA DE CADENAS (4+)</div>
                <p className="mt-1">
                  Permuta bloques para unir <strong className="text-white">4+ del mismo color</strong> (o con un Prisma Cromático) e iniciar ignición. Detonar cadenas ×2/×3/×4+ regenera oxígeno y recarga habilidades.
                </p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#FACC15]/40">
                <div className="font-pixel text-[9px] text-[#FACC15]">OXÍGENO Y ÚLTIMO ALIENTO</div>
                <p className="mt-1">
                  Si el O₂ llega a 0%, entras en <strong className="text-[#FB7185]">Último Aliento</strong> en cámara lenta: recoge una cápsula o detona ×2+ para sobrevivir al límite.
                </p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#A3E635]/40">
                <div className="font-pixel text-[9px] text-[#A3E635]">DIRECTOR DINÁMICO Y BIFURCACIONES</div>
                <p className="mt-1">
                  El Director de Campaña reacciona a tu partida: libera bolsas de O₂ si estás al borde de la asfixia o invoca vetas de Prisma y Mena Acorazada si mantienes Estilo S/S+.
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'HUD_UI' && (
          <div className="space-y-2.5 text-xs text-[#E4E4E7] leading-relaxed">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 bg-[#0E1017] border border-[#38BDF8]/40">
                <div className="font-pixel text-[9px] text-[#38BDF8]">BARRA DE OXÍGENO (%) Y ESCUDOS (🛡️)</div>
                <p className="mt-1">Muestra el aire restante antes de la asfixia. Los Escudos Cinéticos absorben un aplastamiento o impacto letal automático.</p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#FACC15]/40">
                <div className="font-pixel text-[9px] text-[#FACC15]">⚡ OVERDRIVE SÍSMICO [{odKey}]</div>
                <p className="mt-1">Al llegar al 100%, detiene el drenaje de O₂, rompe escoria de 1 toque y perfora varios bloques en línea.</p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#A78BFA]/40">
                <div className="font-pixel text-[9px] text-[#A78BFA]">✦ RESONANCIA DE OPERADOR [F]</div>
                <p className="mt-1">Habilidad definitiva exclusiva de tu piloto. Se recarga perforando, detonando cadenas y recolectando vetas.</p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#A3E635]/40">
                <div className="font-pixel text-[9px] text-[#A3E635]">◈ TÁCTICA [G] Y CINTURÓN [1-3]</div>
                <p className="mt-1">
                  Habilidad activa de recarga rápida (◈) y hasta 3 artilugios consumibles equipados en el Hangar.{' '}
                  <strong className="text-white">Toca cualquier botón aunque esté cargando o pulsa [?]</strong> para ver su efecto en vivo.
                </p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#F97316]/40">
                <div className="font-pixel text-[9px] text-[#F97316]">🔥 DETONAR · ♻ REROLL · ESTILO (D–S+)</div>
                <p className="mt-1">Acelera igniciones abiertas al instante para sumar ×Cadena. El Rango de Estilo mide tu fluidez y activa retos del Director.</p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#FB7185]/40">
                <div className="font-pixel text-[9px] text-[#FB7185]">ALERTA ⚠️ SUPERIOR Y BALIZA DE RÉCORD</div>
                <p className="mt-1">El borde rojo parpadea cuando una columna suelta está a punto de caer sobre tu cabeza. La línea dorada marca tu mejor profundidad.</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'MOVEMENT' && (
          <div className="space-y-2.5 text-xs text-[#E4E4E7] leading-relaxed">
            {isMobile ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-[#0E1017] border border-[#232530]">
                  <div className="font-pixel text-[9px] text-[#38BDF8]">DESLIZAR EN EL POZO</div>
                  <p className="mt-1">Arrastra el dedo lateralmente sobre un hueco para caminar 1 casilla o trepar encima de un bloque.</p>
                </div>
                <div className="p-2.5 bg-[#0E1017] border border-[#232530]">
                  <div className="font-pixel text-[9px] text-[#FACC15]">PERMUTAR BLOQUES</div>
                  <p className="mt-1">Toca un bloque y deslízalo hacia izquierda/derecha para intercambiar posiciones y juntar 4 iguales.</p>
                </div>
                <div className="p-2.5 bg-[#0E1017] border border-[#232530]">
                  <div className="font-pixel text-[9px] text-[#F97316]">TOQUE / DESLIZ ↓ PICAR</div>
                  <p className="mt-1">Toca un bloque adyacente para taladrar. Desliza hacia abajo en zona libre para perforación rápida.</p>
                </div>
                <div className="p-2.5 bg-[#0E1017] border border-[#232530]">
                  <div className="font-pixel text-[9px] text-[#A3E635]">DOBLE TOQUE / DASH</div>
                  <p className="mt-1">Pulsa dos veces rápido a izquierda o derecha en aire para carrera continua o usa el botón DASH.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-[#0E1017] border border-[#232530]">
                  <div className="font-pixel text-[9px] text-[#38BDF8]">MOVIMIENTO Y ESCALADA</div>
                  <p className="mt-1">Pulsa A / D o Flechas. Toca pared + bloque accesible para trepar 1 nivel automáticamente sin atascarte.</p>
                </div>
                <div className="p-2.5 bg-[#0E1017] border border-[#232530]">
                  <div className="font-pixel text-[9px] text-[#FACC15]">TALADRO Y PERMUTA</div>
                  <p className="mt-1">Pulsa <kbd className="px-1 bg-[#1C1D26] border border-[#3F4354]">{drillKey}</kbd> o clic izquierdo para taladrar; <kbd className="px-1 bg-[#1C1D26] border border-[#3F4354]">{swapKeys}</kbd> o clic derecho para permutar.</p>
                </div>
                <div className="p-2.5 bg-[#0E1017] border border-[#232530]">
                  <div className="font-pixel text-[9px] text-[#F97316]">IMPULSO / FRENO AÉREO</div>
                  <p className="mt-1">Pulsa <kbd className="px-1 bg-[#1C1D26] border border-[#3F4354]">{dashKey}</kbd> para atravesar peligros o frenar una caída larga antes del impacto.</p>
                </div>
                <div className="p-2.5 bg-[#0E1017] border border-[#232530]">
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
            <ul className="space-y-1.5 text-[11px] list-disc pl-4">
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
              <UserCheck className="w-3.5 h-3.5" />
              TODOS LOS OPERADORES (PASIVA · ✦ RESONANCIA · ◈ TÁCTICA)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {CHASSIS_LIST.map((ch) => (
                <div key={ch.id} className="p-2.5 bg-[#0E1017] border border-[#232530] space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold text-white">{ch.callsign}</span>
                    <span
                      className="font-pixel text-[8px] px-1.5 py-0.5 border"
                      style={{ color: ch.accentColor, borderColor: `${ch.accentColor}66` }}
                    >
                      {ch.code} · {ch.role.split(' ')[0]}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#D4D4D8]">
                    <strong className="text-[#94A3B8]">Pasiva:</strong> {ch.traitTitle} — {ch.traitDesc}
                  </div>
                  <div className="text-[10px] text-[#BAE6FD]">
                    <strong style={{ color: ch.accentColor }}>✦ {ch.signatureName}:</strong> {ch.signatureDesc}
                  </div>
                  <div className="text-[10px] text-[#BEF264]">
                    <strong className="text-[#A3E635]">◈ {ch.tacticalName}:</strong> {ch.tacticalDesc}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1.5 font-pixel text-[10px] text-[#FACC15] pt-1 border-t border-[#232530]">
              <Shield className="w-3.5 h-3.5" />
              CINTURÓN DE GADGETS CONSUMIBLES [TECLAS 1 · 2 · 3]
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1 text-[10px]">
              {GADGETS.map((g) => (
                <div key={g.id} className="p-2 bg-[#0E1017] border border-[#232530] flex items-start gap-2">
                  <span className="text-base leading-none shrink-0" style={{ color: g.color }}>{g.glyph}</span>
                  <div className="min-w-0">
                    <div className="font-bold text-white">{g.name}</div>
                    <div className="text-[#A1A1AA]">{g.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 bg-[#12101D] border border-[#C084FC]/40 text-[10px] flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#C084FC] shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#E9D5FF]">SINERGIAS DE ARQUETIPO (2 / 4 / 6 Módulos):</strong> reunir varios módulos de un mismo arquetipo en Cámaras de Brecha (250m / 750m / 1250m) desbloquea bonos de conjunto: explosiones mayores (Pyro), freno de drenaje O₂ (Cryo), alcance de permuta +2 (Cuántico), blindaje sísmico (Balístico) o saqueo de isótopos (Parásito).
              </div>
            </div>
          </div>
        )}

        {tab === 'BLOCKS' && (
          <div className="space-y-2.5 text-xs text-[#E4E4E7] leading-relaxed">
            <div className="flex items-center justify-between gap-2 text-[10px] text-[#A1A1AA]">
              <span className="flex items-center gap-1.5 font-pixel text-[#FACC15]">
                <Layers className="w-3.5 h-3.5" />
                ESPECTRO COMPLETO DE {MINERAL_SPECS.length} BLOQUES
              </span>
              <span className="flex items-center gap-1 font-mono">
                <Terminal className="w-3 h-3 text-[#38BDF8]" />
                Q/E o arrastre funciona con casi todos
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1 text-[10px]">
              {MINERAL_SPECS.map((sp) => (
                <div key={sp.kind} className="p-2 bg-[#0E1017] border border-[#232530] flex items-start gap-2.5">
                  <BlockGuideThumb kind={sp.kind} size={34} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-white truncate">{sp.name}</span>
                      <span className="font-mono text-[9px] text-[#38BDF8] shrink-0">{sp.strataRange.split('(')[0].trim()}</span>
                    </div>
                    <div className="font-mono text-[9px] text-[#FACC15]">{sp.hardness}</div>
                    <p className="text-[#A1A1AA] leading-snug">{sp.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            soundEngine.playUiClick();
            onClose();
          }}
          className="pixel-btn-primary w-full py-2.5 font-pixel text-xs font-bold text-white cursor-pointer"
        >
          ENTENDIDO
        </button>
      </div>
    </div>
  );
};
