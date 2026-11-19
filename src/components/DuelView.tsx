import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Monitor, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { ArchiveSave, ChassisId, DT, GRID_COLS, VisualSettings } from '../types/game';
import { EstratoSimulation, InputState } from '../engine/simulation';
import { renderSimulation } from '../engine/renderer';
import { soundEngine } from '../engine/audio';

interface DuelViewProps {
  seed: string;
  chassis: ChassisId;
  archive: ArchiveSave;
  visualSettings: VisualSettings;
  onCycleCrtMode: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onExit: () => void;
}

export const DuelView: React.FC<DuelViewProps> = ({
  seed,
  chassis,
  archive,
  visualSettings,
  onCycleCrtMode,
  soundEnabled,
  onToggleSound,
  onExit,
}) => {
  const [rivalType, setRivalType] = useState<'CPU' | 'LOCAL'>('CPU');
  const [winner, setWinner] = useState<'P1' | 'P2' | null>(null);
  const [stats, setStats] = useState({
    p1Depth: 0,
    p1O2: 100,
    p1Od: 0,
    p2Depth: 0,
    p2O2: 100,
    p2Od: 0,
    p1Sent: 0,
    p2Sent: 0,
  });
  const [runKey, setRunKey] = useState(0);

  const canvas1Ref = useRef<HTMLCanvasElement | null>(null);
  const canvas2Ref = useRef<HTMLCanvasElement | null>(null);
  const visualSettingsRef = useRef<VisualSettings>(visualSettings);
  visualSettingsRef.current = visualSettings;

  const keysHeld = useRef<Set<string>>(new Set());
  const p1Edge = useRef({
    drill: false,
    swapL: false,
    swapR: false,
    detonate: false,
    dash: false,
    overdrive: false,
  });
  const p2Edge = useRef({
    drill: false,
    swapL: false,
    swapR: false,
    detonate: false,
    dash: false,
    overdrive: false,
  });

  useEffect(() => {
    soundEngine.init();
    setWinner(null);

    let sent1 = 0;
    let sent2 = 0;

    let sim1: EstratoSimulation;
    let sim2: EstratoSimulation;

    sim1 = new EstratoSimulation({
      mode: 'DUEL',
      seed: `${seed}-D`,
      chassis,
      ascension: 1,
      archive,
      onGarbageSend: (amt) => {
        sent1 += amt;
        sim2.injectGarbageRows(amt);
      },
    });

    sim2 = new EstratoSimulation({
      mode: 'DUEL',
      seed: `${seed}-D`,
      chassis: 'MKI_VERTICE',
      ascension: 1,
      archive,
      onGarbageSend: (amt) => {
        sent2 += amt;
        sim1.injectGarbageRows(amt);
      },
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        // P1 Controls: WASD + Space/J + Q/E + F + C (Dash) + X (Overdrive)
        if (e.code === 'Space' || e.code === 'KeyJ') p1Edge.current.drill = true;
        if (e.code === 'KeyQ') p1Edge.current.swapL = true;
        if (e.code === 'KeyE') p1Edge.current.swapR = true;
        if (e.code === 'KeyF') p1Edge.current.detonate = true;
        if (e.code === 'KeyC') p1Edge.current.dash = true;
        if (e.code === 'KeyX') p1Edge.current.overdrive = true;

        // P2 Local Controls: Arrows + Enter/Numpad0 + U/O + K + Slash (Dash) + KeyL (Overdrive)
        if (e.code === 'Enter' || e.code === 'Numpad0') p2Edge.current.drill = true;
        if (e.code === 'KeyU' || e.code === 'Comma') p2Edge.current.swapL = true;
        if (e.code === 'KeyO' || e.code === 'Period') p2Edge.current.swapR = true;
        if (e.code === 'KeyK') p2Edge.current.detonate = true;
        if (e.code === 'Slash' || e.code === 'KeyM') p2Edge.current.dash = true;
        if (e.code === 'KeyL') p2Edge.current.overdrive = true;
      }
      keysHeld.current.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.current.delete(e.code);
    };

    const onBlur = () => {
      keysHeld.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    let animId = 0;
    let lastTime = performance.now();
    let acc = 0;
    let botTimer = 0;
    let botMoveDir: -1 | 0 | 1 = 0;
    let hudTick = 0;
    let ended = false;

    const getBotInput = (): InputState => {
      botTimer++;
      const out: InputState = {
        left: false,
        right: false,
        up: false,
        down: false,
        drillPressed: false,
        swapLeftPressed: false,
        swapRightPressed: false,
        slamHeld: false,
        detonatePressed: false,
        rerollPressed: false,
        dashPressed: false,
        overdrivePressed: false,
      };

      // 1. Tactical Parry when falling block threatens head
      if (sim2.coyoteCrushTimer > 0) {
        out.up = true;
        if (sim2.gridCol >= GRID_COLS - 1) out.swapLeftPressed = true;
        else out.swapRightPressed = true;
        return out;
      }

      // 2. Activate Overdrive immediately when charged
      if (sim2.overdrive >= 100 && sim2.overdriveTimer === 0) {
        out.overdrivePressed = true;
      }

      const pR = Math.max(0, sim2.gridRow);
      const pC = Math.max(0, Math.min(GRID_COLS - 1, sim2.gridCol));

      // 3. Evade overhead collapse column with Phase Dash or lateral step
      if (sim2.overheadDangerCol) {
        const evadeDir: -1 | 1 = pC <= 1 ? 1 : pC >= GRID_COLS - 2 ? -1 : botTimer % 2 === 0 ? -1 : 1;
        if (evadeDir < 0) out.left = true;
        else out.right = true;
        if (sim2.dashCooldown === 0) out.dashPressed = true;
        return out;
      }

      // 4. Seek O2 capsule column when oxygen is below 55%
      let targetCol: number | null = null;
      if (sim2.oxygen < 55) {
        for (let rr = pR; rr <= pR + 8; rr++) {
          for (let cc = 0; cc < GRID_COLS; cc++) {
            if (sim2.getCell(rr, cc).kind === 'OXYGEN') {
              targetCol = cc;
              break;
            }
          }
          if (targetCol !== null) break;
        }
      }

      if (targetCol !== null) {
        if (targetCol < pC) out.left = true;
        else if (targetCol > pC) out.right = true;
        else out.down = true;
      } else {
        // Wander & target near-match clusters below
        if (botTimer % 26 === 0) {
          botMoveDir = (Math.random() < 0.35 ? -1 : Math.random() < 0.7 ? 1 : 0) as -1 | 0 | 1;
        }
        if (botMoveDir < 0) out.left = true;
        else if (botMoveDir > 0) out.right = true;
      }

      // 5. Smart swap detection on row below feet
      if (botTimer % 18 === 0) {
        const below = sim2.getCell(pR + 1, pC);
        const bLeft = pC > 0 ? sim2.getCell(pR + 1, pC - 1) : null;
        const bRight = pC < GRID_COLS - 1 ? sim2.getCell(pR + 1, pC + 1) : null;
        if (bLeft && bLeft.nearMatch && below.color === bLeft.color) {
          out.swapLeftPressed = true;
        } else if (bRight && bRight.nearMatch && below.color === bRight.color) {
          out.swapRightPressed = true;
        } else if (Math.random() < 0.35) {
          if (pC > 0 && Math.random() < 0.5) out.swapLeftPressed = true;
          else if (pC < GRID_COLS - 1) out.swapRightPressed = true;
        }
      }

      if (botTimer % 14 === 0) {
        out.down = true;
        out.drillPressed = true;
      }
      return out;
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (!ended) {
        acc += dt;
        while (acc >= DT) {
          const held = keysHeld.current;
          const in1: InputState = {
            left: held.has('KeyA'),
            right: held.has('KeyD'),
            up: held.has('KeyW'),
            down: held.has('KeyS'),
            drillPressed: p1Edge.current.drill,
            swapLeftPressed: p1Edge.current.swapL,
            swapRightPressed: p1Edge.current.swapR,
            slamHeld: held.has('ShiftLeft'),
            detonatePressed: p1Edge.current.detonate,
            rerollPressed: false,
            dashPressed: p1Edge.current.dash,
            overdrivePressed: p1Edge.current.overdrive,
          };
          p1Edge.current = { drill: false, swapL: false, swapR: false, detonate: false, dash: false, overdrive: false };

          const in2: InputState =
            rivalType === 'CPU'
              ? getBotInput()
              : {
                  left: held.has('ArrowLeft'),
                  right: held.has('ArrowRight'),
                  up: held.has('ArrowUp'),
                  down: held.has('ArrowDown'),
                  drillPressed: p2Edge.current.drill,
                  swapLeftPressed: p2Edge.current.swapL,
                  swapRightPressed: p2Edge.current.swapR,
                  slamHeld: held.has('ShiftRight'),
                  detonatePressed: p2Edge.current.detonate,
                  rerollPressed: false,
                  dashPressed: p2Edge.current.dash,
                  overdrivePressed: p2Edge.current.overdrive,
                };
          p2Edge.current = { drill: false, swapL: false, swapR: false, detonate: false, dash: false, overdrive: false };

          sim1.step(in1);
          sim2.step(in2);
          acc -= DT;

          if (sim1.finished && !ended) {
            ended = true;
            setWinner('P2');
          } else if (sim2.finished && !ended) {
            ended = true;
            setWinner('P1');
          }
        }
      }

      const drawTo = (canvas: HTMLCanvasElement | null, sim: EstratoSimulation) => {
        if (!canvas) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.floor(rect.width * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderSimulation(ctx, sim, rect.width, rect.height, now / 1000, null, visualSettingsRef.current);
        }
      };

      drawTo(canvas1Ref.current, sim1);
      drawTo(canvas2Ref.current, sim2);

      hudTick++;
      if (hudTick >= 6) {
        hudTick = 0;
        setStats({
          p1Depth: sim1.depthMeters,
          p1O2: Math.round(sim1.oxygen),
          p1Od: Math.round(sim1.overdrive),
          p2Depth: sim2.depthMeters,
          p2O2: Math.round(sim2.oxygen),
          p2Od: Math.round(sim2.overdrive),
          p1Sent: sent1,
          p2Sent: sent2,
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [seed, chassis, rivalType, runKey]);

  const crtLabels: Record<VisualSettings['crtMode'], string> = {
    SUBTLE: 'SUTIL',
    ARCADE: 'ARCADE',
    OFF: 'OFF',
  };

  return (
    <div className="h-screen w-full bg-[#0E0F14] text-[#F2EFE9] flex flex-col overflow-hidden select-none">
      <header className="h-12 px-4 sm:px-5 border-b-2 border-[#262834] bg-[#12131A] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="pixel-btn px-2.5 py-1 flex items-center gap-1.5 text-xs font-pixel text-[#A1A1AA] hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Salir
          </button>
          <span className="font-pixel text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            Duelo Sísmico 1v1
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 pixel-panel">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              setRivalType('CPU');
              setRunKey((k) => k + 1);
            }}
            className={`px-3 py-1 font-pixel text-[10px] transition-colors cursor-pointer ${
              rivalType === 'CPU' ? 'bg-[#D94126] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            VS IA Arquitecto
          </button>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              setRivalType('LOCAL');
              setRunKey((k) => k + 1);
            }}
            className={`px-3 py-1 font-pixel text-[10px] transition-colors cursor-pointer ${
              rivalType === 'LOCAL' ? 'bg-[#D94126] text-white' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            2 Jugadores Local
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onCycleCrtMode();
            }}
            className="pixel-btn px-2.5 py-1 text-[10px] font-pixel text-[#D4D4D8] hover:text-white flex items-center gap-1 cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5 text-[#38BDF8]" />
            {crtLabels[visualSettings.crtMode]}
          </button>
          <button
            onClick={() => setRunKey((k) => k + 1)}
            className="pixel-btn px-3 py-1 text-xs font-pixel text-white cursor-pointer"
          >
            Reiniciar
          </button>
          <button onClick={onToggleSound} className="pixel-btn p-1.5 text-[#A1A1AA] hover:text-white cursor-pointer">
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-2 gap-5 max-w-5xl w-full mx-auto px-4 py-3 relative">
        {/* Player 1 Shaft */}
        <div className="flex flex-col min-h-0">
          <div className="pixel-panel px-3 py-1.5 mb-2 flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="font-pixel text-[10px] text-white">P1 · WASD / ESP / Q-E / C-X</span>
            <span className="text-[#38BDF8]">
              {stats.p1Depth}m · O₂ {stats.p1O2}% · OD {stats.p1Od}% · Env:{stats.p1Sent}
            </span>
          </div>
          <div className="flex-1 min-h-0 border-2 border-[#2B2D38] bg-[#0B0C10]">
            <canvas ref={canvas1Ref} className="w-full h-full block pixel-canvas" />
          </div>
        </div>

        {/* Player 2 / CPU Shaft */}
        <div className="flex flex-col min-h-0">
          <div className="pixel-panel px-3 py-1.5 mb-2 flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="font-pixel text-[10px] text-white">
              {rivalType === 'CPU' ? 'IA ARQUITECTO' : 'P2 · FLECHAS / ENT / U-O / /-L'}
            </span>
            <span className="text-[#F4604F]">
              {stats.p2Depth}m · O₂ {stats.p2O2}% · OD {stats.p2Od}% · Env:{stats.p2Sent}
            </span>
          </div>
          <div className="flex-1 min-h-0 border-2 border-[#2B2D38] bg-[#0B0C10]">
            <canvas ref={canvas2Ref} className="w-full h-full block pixel-canvas" />
          </div>
        </div>

        {winner && (
          <div className="absolute inset-0 bg-[#0E0F14]/90 flex items-center justify-center z-20">
            <div className="pixel-panel p-8 max-w-sm w-full text-center space-y-5">
              <div className="font-pixel text-[10px] text-[#FACC15]">RESULTADO DEL DUELO</div>
              <h2 className="font-display text-4xl font-bold text-white">
                {winner === 'P1'
                  ? 'Victoria Jugador 1'
                  : rivalType === 'CPU'
                  ? 'Victoria de la IA'
                  : 'Victoria Jugador 2'}
              </h2>
              <p className="text-sm text-[#A1A1AA]">
                Cadenas ×2+ envían escoria comprimida al rival. Los Cortes Cinéticos devuelven el ataque.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setRunKey((k) => k + 1)}
                  className="pixel-btn-primary flex-1 py-2.5 px-4 text-white font-pixel text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Revancha
                </button>
                <button
                  onClick={onExit}
                  className="pixel-btn flex-1 py-2.5 px-4 text-white font-pixel text-xs cursor-pointer"
                >
                  Salir
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
