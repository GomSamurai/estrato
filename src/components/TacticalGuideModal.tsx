import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, X } from 'lucide-react';
import { KeyBindings } from '../types/game';
import { soundEngine } from '../engine/audio';
import {
  getBouncePadBlockSprite,
  getExoRigPixelSprite,
  getMineralBlockSprite,
  getOxygenPodSprite,
  getResonanceVeinBlockSprite,
  getSlagBlockSprite,
  getSupportBeamBlockSprite,
} from '../engine/pixelArt';
import { formatActionKeys } from '../storage/controls';

interface TacticalGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  keyBindings?: KeyBindings;
}

type GuideTab = 'MOVEMENT' | 'COUNTER' | 'ABILITIES' | 'BLOCKS';

function drawPixelLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#FFFFFF') {
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#09090B';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
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
          const f = Math.floor((now / 1000) * 6) & 3;
          ctx.imageSmoothingEnabled = false;

          // Cavern backdrop
          ctx.fillStyle = '#0B0D14';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#1E2230';
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

          if (tab === 'MOVEMENT') {
            // Draw floor blocks + 1 step-up block + drill block
            for (let c = 0; c < 11; c++) {
              const bx = 12 + c * 28;
              ctx.drawImage(getMineralBlockSprite(1, '#38BDF8', 0, c & 3, 10, false), bx, 104, 28, 28);
            }
            ctx.drawImage(getMineralBlockSprite(1, '#F97316', 1, 1, 0, false), 12 + 6 * 28, 76, 28, 28);
            const playerProg = t < 1.5 ? t / 1.5 : 1;
            const px = 12 + 3 * 28 + playerProg * 56;
            const climbY = t > 1.8 && t < 3.0 ? Math.min(1, (t - 1.8) / 0.6) * 28 : t >= 3.0 ? 28 : 0;
            const py = 72 - climbY;
            const rig = getExoRigPixelSprite({
              chassis: 'MKI_VERTICE',
              upgrades: { drillTier: 1, thrusterTier: 1, tankTier: 0, armorTier: 0, capacitorTier: 0, magnetTier: 0 },
              rigLevel: 2,
              pose: climbY > 2 && climbY < 26 ? 'CLIMB' : t < 1.5 ? 'WALK' : 'IDLE',
              animFrame: f,
              aimDir: t >= 3.0 ? 'DOWN' : 'RIGHT',
              facing: 1,
            });
            ctx.drawImage(rig, Math.round(px - 2), Math.round(py - 2), 32, 32);
            ctx.strokeStyle = '#FACC15';
            ctx.lineWidth = 2;
            ctx.strokeRect(12 + 6 * 28 + 2, 78, 24, 24);
            drawPixelLabel(ctx, t < 1.6 ? 'DESLIZAR ▶ STEP 1' : t < 3.0 ? 'ESCALAR BLOQUE ▲' : 'PICAR ▼', w / 2, 24, '#FACC15');
          } else if (tab === 'COUNTER') {
            for (let c = 0; c < 11; c++) {
              const bx = 12 + c * 28;
              ctx.drawImage(getMineralBlockSprite(1, '#4B5563', 0, c & 3, 10, false), bx, 104, 28, 28);
            }
            const fallProgress = (t % 2.4) / 2.4;
            const isStrike = fallProgress > 0.68 && fallProgress < 0.9;
            const rockY = 12 + Math.min(0.68, fallProgress) * 64;
            const cx = 12 + 5 * 28;
            if (!isStrike) {
              ctx.drawImage(getSlagBlockSprite('#78716C', 3, false, 0, f, false), cx, Math.round(rockY), 28, 28);
              ctx.fillStyle = fallProgress > 0.5 ? '#FACC15' : '#F43F5E';
              ctx.fillRect(cx + 10, Math.round(rockY) + 30, 8, 5);
            } else {
              ctx.strokeStyle = '#FACC15';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(cx + 14, 72, 22, Math.PI, Math.PI * 2);
              ctx.stroke();
            }
            const rig = getExoRigPixelSprite({
              chassis: 'MKI_VERTICE',
              upgrades: { drillTier: 1, thrusterTier: 0, tankTier: 0, armorTier: 1, capacitorTier: 0, magnetTier: 0 },
              rigLevel: 2,
              pose: isStrike ? 'PARRY_SLASH' : 'IDLE',
              animFrame: f,
              aimDir: 'UP',
              facing: 1,
            });
            ctx.drawImage(rig, cx - 2, 72, 32, 32);
            drawPixelLabel(
              ctx,
              isStrike ? '¡CONTRAATAQUE PERFECTO! (0% O2)' : 'BLOQUE CAYENDO -> DESLIZA ▲ / [W]',
              w / 2,
              20,
              isStrike ? '#FACC15' : '#FDA4AF'
            );
          } else if (tab === 'ABILITIES') {
            const bars = [
              { label: '⚡ OVERDRIVE [X]', pct: ((t * 0.25) % 1), col: '#FACC15', y: 28 },
              { label: '✦ RESONANCIA [F]', pct: (((t + 0.8) * 0.22) % 1), col: '#38BDF8', y: 58 },
              { label: '◈ TÁCTICA [G]', pct: Math.min(1, ((t * 0.35) % 1.1)), col: '#A3E635', y: 88 },
            ];
            for (const b of bars) {
              ctx.fillStyle = '#E4E4E7';
              ctx.font = 'bold 10px monospace';
              ctx.textAlign = 'left';
              ctx.fillText(b.label, 24, b.y);
              ctx.fillStyle = '#09090B';
              ctx.fillRect(160, b.y - 9, 148, 12);
              ctx.fillStyle = b.col;
              ctx.fillRect(162, b.y - 7, Math.round(144 * Math.min(1, b.pct)), 8);
              ctx.strokeStyle = '#3F4354';
              ctx.strokeRect(160, b.y - 9, 148, 12);
            }
            drawPixelLabel(ctx, 'CARGA ESTRATÉGICA + HABILIDAD POR OPERADOR', w / 2, 118, '#A1A1AA');
          } else {
            // Blocks showcase
            const items = [
              { spr: getBouncePadBlockSprite(f, f % 2 === 0), label: 'VÁLVULA', sub: '1 IMPULSO +O₂', x: 34 },
              { spr: getResonanceVeinBlockSprite(f), label: 'PIEZO', sub: 'ONDA -2HP', x: 112 },
              { spr: getSupportBeamBlockSprite(f), label: 'PUNTAL', sub: 'SOSTIENE TECHO', x: 190 },
              { spr: getOxygenPodSprite(f), label: 'BÓVEDA/O₂', sub: 'RUTAS Y BOTÍN', x: 268 },
            ];
            for (const it of items) {
              ctx.drawImage(it.spr, it.x - 16, 40, 32, 32);
              drawPixelLabel(ctx, it.label, it.x, 90, '#FACC15');
              drawPixelLabel(ctx, it.sub, it.x, 105, '#D4D4D8');
            }
            drawPixelLabel(ctx, 'NO ATRAPA · ROMPE PUNTALES CON CABEZA', w / 2, 20, '#38BDF8');
          }

          animId = requestAnimationFrame(render);
        }
      }
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [tab]);

  return (
    <canvas
      ref={ref}
      width={332}
      height={136}
      className="w-full h-[136px] border-2 border-[#2B2D38] bg-[#0B0C10] pixel-canvas"
    />
  );
};

export const TacticalGuideModal: React.FC<TacticalGuideModalProps> = ({
  isOpen,
  onClose,
  isMobile = false,
  keyBindings,
}) => {
  const [tab, setTab] = useState<GuideTab>('MOVEMENT');

  if (!isOpen) return null;

  const tabs: { id: GuideTab; label: string }[] = [
    { id: 'MOVEMENT', label: 'Movimiento' },
    { id: 'COUNTER', label: 'Contraataque' },
    { id: 'ABILITIES', label: 'Habilidades' },
    { id: 'BLOCKS', label: 'Bloques y Mundo' },
  ];

  const kb = keyBindings;
  const drillKey = kb ? formatActionKeys(kb, 'drill') : 'J / Espacio';
  const swapKeys = kb ? `${formatActionKeys(kb, 'swapLeft')} / ${formatActionKeys(kb, 'swapRight')}` : 'Q / E';
  const dashKey = kb ? formatActionKeys(kb, 'dash') : 'C / Shift';
  const odKey = kb ? formatActionKeys(kb, 'overdrive') : 'X';

  return (
    <div
      className="fixed inset-0 z-50 bg-[#08090D]/90 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="pixel-panel w-full max-w-xl bg-[#12131A] p-4 sm:p-5 space-y-4 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-[#232530] pb-3">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#FACC15]" />
            <div>
              <h2 className="font-display text-2xl font-bold text-white leading-none">
                Manual Táctico de Campo
              </h2>
              <div className="font-mono text-[11px] text-[#8E92A4] mt-0.5">
                {isMobile ? 'Gestos táctiles y supervivencia' : 'Controles, sinergias y arquitectura'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="pixel-btn p-1.5 text-[#A1A1AA] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setTab(item.id);
              }}
              className={`py-2 px-2 border-2 font-pixel text-[9px] cursor-pointer ${
                tab === item.id
                  ? 'border-[#FACC15] bg-[#1E1A0E] text-[#FACC15]'
                  : 'border-[#262834] bg-[#0B0C10] text-[#A1A1AA] hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <GuideDioramaCanvas tab={tab} />

        {tab === 'MOVEMENT' && (
          <div className="space-y-2 text-xs text-[#E4E4E7] leading-relaxed">
            <div className="p-2.5 bg-[#0E1017] border border-[#232530]">
              <span className="font-pixel text-[9px] text-[#FACC15] block mb-1">
                {isMobile ? 'GESTOS EN MÓVIL' : 'TECLADO Y RATÓN'}
              </span>
              {isMobile ? (
                <ul className="space-y-1">
                  <li>• <strong>Deslizar ◀ / ▶ y soltar</strong> (sin tocar bloque): mueve 1 casilla lateralmente.</li>
                  <li>• <strong>Doble tap rápido izq / der</strong>: Dash / Esquiva rápida lateral.</li>
                  <li>• <strong>TAP en bloque cercano</strong>: Picar · <strong>Arrastrar sobre bloque</strong>: Permutar.</li>
                  <li>• <strong>Deslizar ▼</strong>: Perforar hacia abajo bloque a bloque (ajustable en Pausa).</li>
                </ul>
              ) : (
                <ul className="space-y-1">
                  <li>• <strong>A / D</strong>: Paso lateral · <strong>W + A / D</strong>: Escalar un bloque de altura.</li>
                  <li>• <strong>{drillKey}</strong> o <strong>Clic</strong>: Picar · <strong>{swapKeys}</strong> o arrastrar: Permutar bloques.</li>
                  <li>• <strong>S / ▼</strong> al caer: Slam rápido · <strong>{dashKey}</strong>: Dash / Freno aéreo.</li>
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'COUNTER' && (
          <div className="space-y-2 text-xs text-[#E4E4E7] leading-relaxed">
            <div className="p-2.5 bg-[#0E1017] border border-[#232530] space-y-1.5">
              <div className="font-pixel text-[9px] text-[#FDA4AF]">SOBREVIVIR A DERRUMBES</div>
              <p>
                Cuando un bloque cae sobre tu columna verás un triángulo de peligro arriba. Pulsa{' '}
                <strong className="text-[#FACC15]">▲ / W</strong> o desliza <strong className="text-[#FACC15]">↑ en pantalla</strong> para golpearlo al vuelo:
              </p>
              <ul className="space-y-1 text-[11px]">
                <li>• <strong className="text-[#FACC15]">PERFECTO</strong> (justo antes del impacto): rompe el bloque con <strong>0% O₂</strong>, suma Estilo y carga habilidades.</li>
                <li>• <strong className="text-[#38BDF8]">GUARDIA AÉREA</strong> (anticipado): pulveriza el impacto pero consume <strong>6% O₂</strong>.</li>
                <li>• <strong className="text-[#A3E635]">ESQUIVA AUTOMÁTICA</strong>: ante Monolitos o Remaches indestructibles te desliza a un lado si está libre.</li>
                <li>• <em>Nota: fallar al aire penaliza -3% O₂ y abusar 3 veces seguidas recalienta el escudo 1,2s. En Coyote Crush también sirve W + Q/E.</em></li>
              </ul>
            </div>
          </div>
        )}

        {tab === 'ABILITIES' && (
          <div className="space-y-2 text-xs text-[#E4E4E7] leading-relaxed">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 bg-[#0E1017] border border-[#FACC15]/40">
                <div className="font-pixel text-[9px] text-[#FACC15]">⚡ OVERDRIVE [{odKey}]</div>
                <p className="mt-1 text-[11px]">Perforación instantánea e inmunidad temporal. Se recarga lentamente picando y detonando cadenas.</p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#38BDF8]/40">
                <div className="font-pixel text-[9px] text-[#38BDF8]">✦ RESONANCIA [F]</div>
                <p className="mt-1 text-[11px]">Habilidad definitiva única de tu operador (al llegar al 100%). Cada personaje tiene una propia.</p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#A3E635]/40">
                <div className="font-pixel text-[9px] text-[#A3E635]">◈ TÁCTICA [G]</div>
                <p className="mt-1 text-[11px]">Segunda habilidad activa de operador con enfriamiento corto para resolver bloqueos y escoria.</p>
              </div>
              <div className="p-2.5 bg-[#0E1017] border border-[#F97316]/40">
                <div className="font-pixel text-[9px] text-[#F97316]">🔥 DETONAR · CINTURÓN [1-3]</div>
                <p className="mt-1 text-[11px]">Junta 4 iguales y detona al instante desde el botón superior derecho o usa gadgets de tu cinturón.</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'BLOCKS' && (
          <div className="space-y-2 text-xs text-[#E4E4E7] leading-relaxed">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-[#0E1017] border border-[#38BDF8]/35">
                <strong className="text-[#38BDF8]">Válvula Geotérmica:</strong> un solo impulso de vapor ascendente con +6% O₂ que despeja tu techo y se purga al instante para nunca atraparte.
              </div>
              <div className="p-2 bg-[#0E1017] border border-[#FACC15]/35">
                <strong className="text-[#FACC15]">Veta Piezoeléctrica:</strong> emite un pulso sónico horizontal (-2 HP a escoria y cristales) y recarga tus barras tácticas.
              </div>
              <div className="p-2 bg-[#0E1017] border border-[#FB923C]/35">
                <strong className="text-[#FB923C]">Puntal Hidráulico:</strong> viga industrial que sostiene techos enteros; rómpela para provocar derrumbes controlados (+5 ISO).
              </div>
              <div className="p-2 bg-[#0E1017] border border-[#A3E635]/35">
                <strong className="text-[#A3E635]">Salas y Récord:</strong> busca runas en la pared para hallar Bóvedas Secretas, túneles gemelos y supera tu baliza luminosa de Récord Personal.
              </div>
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
