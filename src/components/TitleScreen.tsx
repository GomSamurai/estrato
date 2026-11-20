import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Keyboard, Lock, Shuffle, Smartphone, Volume2, VolumeX } from 'lucide-react';
import { ArchiveSave, ChassisId, GameMode, KeyBindings, RigUpgrades, TrialId, VisualSettings } from '../types/game';
import { CHASSIS_LIST, STRATA } from '../data/catalog';
import { GADGETS, RELICS, TRIAL_DEFS } from '../data/crafting';
import { soundEngine } from '../engine/audio';
import { formatActionKeys } from '../storage/controls';
import { getExoRigPixelSprite } from '../engine/pixelArt';
import { renderTitleDiorama } from '../engine/renderer';
import { ControlsModal } from './ControlsModal';
import { TacticalGuideModal } from './TacticalGuideModal';

const OperatorPortraitThumb: React.FC<{
  chassisId: ChassisId;
  upgrades: RigUpgrades;
  rigLevel: number;
  selected: boolean;
  locked: boolean;
}> = ({ chassisId, upgrades, rigLevel, selected, locked }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let animId = 0;
    const render = (now: number) => {
      const c = ref.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, c.width, c.height);
          const f = Math.floor((now / 1000) * (selected ? 8 : 5)) & 3;
          const spr = getExoRigPixelSprite({
            chassis: chassisId,
            upgrades,
            rigLevel,
            pose: selected ? 'WALK' : 'IDLE',
            animFrame: f,
            aimDir: 'DOWN',
            facing: 1,
            tintColor: locked ? '#27272A' : undefined,
          });
          ctx.drawImage(spr, 0, 0, c.width, c.height);
        }
      }
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    chassisId,
    selected,
    locked,
    rigLevel,
    upgrades.drillTier,
    upgrades.thrusterTier,
    upgrades.tankTier,
    upgrades.armorTier,
    upgrades.capacitorTier,
    upgrades.magnetTier,
  ]);
  return (
    <canvas
      ref={ref}
      width={40}
      height={40}
      className="w-10 h-10 pixel-canvas shrink-0 bg-[#0B0C10] border border-[#232530]"
    />
  );
};

interface TitleScreenProps {
  mode: GameMode;
  onSelectMode: (m: GameMode) => void;
  trialId: TrialId;
  onSelectTrial: (id: TrialId) => void;
  seed: string;
  onChangeSeed: (s: string) => void;
  onRandomSeed: () => void;
  isDaily: boolean;
  onToggleDaily: () => void;
  ascension: number;
  onChangeAscension: (a: number) => void;
  startDepth: number;
  onChangeStartDepth: (d: number) => void;
  archive: ArchiveSave;
  tutorialEnabled: boolean;
  onToggleTutorial: () => void;
  onToggleSkipDialogues: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  visualSettings: VisualSettings;
  onUpdateVisualSettings: (next: VisualSettings) => void;
  keyBindings: KeyBindings;
  onUpdateKeyBindings: (next: KeyBindings) => void;
  onSelectChassis: (id: ChassisId) => void;
  onStartGame: () => void;
  onOpenArchive: () => void;
  onOpenCharacters: () => void;
  onOpenArtifacts?: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  mode,
  onSelectMode,
  trialId,
  onSelectTrial,
  seed,
  onChangeSeed,
  onRandomSeed,
  isDaily,
  onToggleDaily,
  ascension,
  onChangeAscension,
  startDepth,
  onChangeStartDepth,
  archive,
  tutorialEnabled,
  onToggleTutorial,
  onToggleSkipDialogues,
  soundEnabled,
  onToggleSound,
  visualSettings,
  onUpdateVisualSettings,
  keyBindings,
  onUpdateKeyBindings,
  onSelectChassis,
  onStartGame,
  onOpenArchive,
  onOpenCharacters,
  onOpenArtifacts,
}) => {
  const [controlsModalSection, setControlsModalSection] = useState<'KEYBOARD' | 'MOBILE' | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const activeChassis = CHASSIS_LIST.find((c) => c.id === archive.selectedChassis) || CHASSIS_LIST[0];
  const dioramaRef = useRef<HTMLCanvasElement | null>(null);
  const rigUpgrades = archive.rigUpgrades || {
    drillTier: 0,
    thrusterTier: 0,
    tankTier: 0,
    armorTier: 0,
    capacitorTier: 0,
    magnetTier: 0,
  };
  const rigLevel = Math.max(1, archive.rigLevel || 1);

  // Subtle hypnotic subterranean ambience on start menu once audio is unlocked
  useEffect(() => {
    const unlockAudio = () => {
      soundEngine.init();
    };
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    const timer = window.setInterval(() => {
      if (soundEnabled && soundEngine.isEnabled()) {
        soundEngine.tickMetronome(1, false, false);
      }
    }, 45);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.clearInterval(timer);
    };
  }, [soundEnabled]);

  // Living pixel-art subterranean diorama loop
  useEffect(() => {
    let animId = 0;
    const renderLoop = (now: number) => {
      const canvas = dioramaRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        const tw = Math.max(1, Math.floor(rect.width * dpr));
        const th = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== tw || canvas.height !== th) {
          canvas.width = tw;
          canvas.height = th;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderTitleDiorama(
            ctx,
            rect.width,
            rect.height,
            now / 1000,
            archive.selectedChassis,
            rigUpgrades,
            rigLevel
          );
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };
    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [archive.selectedChassis, rigLevel, rigUpgrades.drillTier, rigUpgrades.thrusterTier, rigUpgrades.tankTier, rigUpgrades.armorTier]);

  const withClick = (fn: () => void) => () => {
    soundEngine.init();
    soundEngine.playUiClick();
    fn();
  };

  return (
    <div className="min-h-screen w-full bg-[#0E0F14] text-[#F2EFE9] flex flex-col overflow-x-hidden">
      {/* 5-color Geological Stratum Pixel Crown Strip */}
      <div className="h-1.5 w-full grid grid-cols-5 shrink-0">
        {STRATA[0].blockColors.map((col, i) => (
          <div key={i} style={{ backgroundColor: col }} />
        ))}
      </div>

      {/* Strict 3-Zone Top Bar */}
      <header className="h-14 px-4 sm:px-6 border-b-2 border-[#262834] bg-[#12131A] flex items-center justify-between gap-3 shrink-0 min-w-0 overflow-hidden">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="px-2 py-0.5 bg-[#D94126] border border-[#F97316] font-pixel text-sm font-bold tracking-widest text-white shadow-[0_2px_0_#7F1D1D]">
            ESTRATO
          </div>
          <span className="hidden sm:inline font-pixel text-[10px] text-[#71717A] tracking-wider">
            HI-BIT ARCADE
          </span>
        </div>

        <nav className="hidden lg:flex items-center gap-4 xl:gap-6 text-xs font-pixel tracking-wide text-[#A1A1AA] min-w-0 overflow-hidden">
          <button
            onClick={withClick(() => onSelectMode('CAMPAIGN'))}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'CAMPAIGN' ? 'text-[#FACC15]' : ''
            }`}
          >
            Campaña
          </button>
          <button
            onClick={withClick(() => onSelectMode('ENDLESS'))}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'ENDLESS' ? 'text-[#FACC15]' : ''
            }`}
          >
            Abismo
          </button>
          <button
            onClick={withClick(() => onSelectMode('SPRINT_500'))}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'SPRINT_500' ? 'text-[#FACC15]' : ''
            }`}
          >
            Sprint 500m
          </button>
          <button
            onClick={withClick(() => onSelectMode('TRIAL'))}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'TRIAL' ? 'text-[#FACC15]' : ''
            }`}
          >
            Pruebas
          </button>
          <button
            onClick={withClick(() => onSelectMode('DUEL'))}
            className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === 'DUEL' ? 'text-[#FACC15]' : ''
            }`}
          >
            Duelo 1v1
          </button>
          <button
            onClick={withClick(onOpenArchive)}
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Tienda y Archivo
          </button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={withClick(() => setShowGuide(true))}
            title="Manual Táctico Animado: controles, contraataque, habilidades y bloques"
            className="pixel-btn px-2.5 py-1.5 text-[11px] font-pixel text-[#A3E635] hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guía</span>
          </button>
          <button
            type="button"
            onClick={withClick(() => setControlsModalSection('KEYBOARD'))}
            title="Editor de Teclas y Controles Táctiles"
            className="pixel-btn px-2.5 py-1.5 text-[11px] font-pixel text-[#D4D4D8] hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Keyboard className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span className="hidden sm:inline">Teclas / Móvil</span>
          </button>
          <button
            onClick={() => {
              onToggleSound();
              soundEngine.playUiClick();
            }}
            aria-label={soundEnabled ? 'Silenciar audio' : 'Activar audio'}
            className="pixel-btn p-2 text-[#A1A1AA] hover:text-white cursor-pointer shrink-0"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={withClick(onStartGame)}
            className="pixel-btn-primary px-4 py-1.5 text-white font-pixel text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
          >
            Descender
          </button>
        </div>
      </header>

      {/* Main Split Workspace — responsive, zero clipping or overlapping */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 lg:py-8 grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Left Column: Launch Configuration */}
        <section className="lg:col-span-7 min-w-0 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1.5 pixel-panel text-xs font-mono text-[#A1A1AA] tabular-nums">
              <span className="text-white font-semibold">{activeChassis.name}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#38BDF8]">Piloto Niv. {rigLevel}</span>
              <span aria-hidden="true">·</span>
              <span>Récord {archive.maxDepthCampaign}m</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#FACC15] font-semibold">{archive.isotopes} Isótopos</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={withClick(onOpenArtifacts || onOpenArchive)}
                className="text-[#C084FC] hover:text-white font-semibold cursor-pointer"
              >
                ✦ {(archive.discoveredArtifacts || []).length}/14 Artefactos
              </button>
              {archive.architectCrownUnlocked && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#FACC15] font-bold">👑 Corona</span>
                </>
              )}
            </div>

            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[0.96] text-balance">
              Perfora el pozo. Alimenta la mecha. Desvía el derrumbe.
            </h1>
            <p className="text-sm sm:text-base text-[#A1A1AA] max-w-xl leading-relaxed">
              Desciende hasta 3.500 metros a través de 7 estratos vivos en pixel art de alto voltaje. Forja reliquias,
              activa artilugios tácticos y sobrevive a 6 Guardianes en campaña narrativa.
            </p>
          </div>

          {/* Quick Operator / Character Roster Selector (2 Starters + 6 Unlockables) */}
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <label className="font-pixel text-[11px] uppercase tracking-wider text-[#A1A1AA]">
                Operador en descenso ({archive.unlockedChassis.length}/{CHASSIS_LIST.length})
              </label>
              <button
                type="button"
                onClick={withClick(onOpenCharacters)}
                className="font-pixel text-[10px] text-[#38BDF8] hover:text-white cursor-pointer"
              >
                Ver Hangar y Habilidades →
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CHASSIS_LIST.map((ch) => {
                const unlocked = archive.unlockedChassis.includes(ch.id);
                const selected = archive.selectedChassis === ch.id;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={withClick(() => {
                      if (unlocked) onSelectChassis(ch.id);
                      else onOpenCharacters();
                    })}
                    title={unlocked ? `${ch.name} — ${ch.traitTitle}: ${ch.traitDesc}` : `Bloqueado · ${ch.unlockRequirement}`}
                    className={`min-w-0 p-2 text-left border-2 transition-all cursor-pointer flex items-center gap-2 ${
                      selected
                        ? 'bg-[#1D1820] shadow-[inset_0_2px_0_rgba(255,255,255,0.12),0_3px_0_#08090D]'
                        : unlocked
                        ? 'border-[#2B2D38] bg-[#14151C] hover:border-[#4B5063] shadow-[0_2px_0_#08090D]'
                        : 'border-[#22242E] bg-[#101116] opacity-75 hover:opacity-100 hover:border-[#3F4354]'
                    }`}
                    style={selected ? { borderColor: ch.accentColor } : undefined}
                  >
                    <OperatorPortraitThumb
                      chassisId={ch.id}
                      upgrades={rigUpgrades}
                      rigLevel={rigLevel}
                      selected={selected}
                      locked={!unlocked}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display text-sm font-bold text-white truncate">{ch.callsign}</span>
                        {!unlocked && <Lock className="w-3 h-3 text-[#71717A] shrink-0" />}
                      </div>
                      <div className="text-[10px] font-mono truncate" style={{ color: unlocked ? ch.accentColor : '#71717A' }}>
                        {unlocked ? (selected ? 'ACTIVO' : ch.isStarter ? 'INICIAL' : ch.role.split(' ')[0]) : ch.unlockIsoCost ? `${ch.unlockIsoCost} ISO` : 'BLOQ.'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="pixel-panel px-3 py-2 bg-[#111218] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="font-pixel text-[9px] mr-2" style={{ color: activeChassis.accentColor }}>
                  {activeChassis.traitTitle}:
                </span>
                <span className="text-[#D4D4D8]">{activeChassis.traitDesc}</span>
              </div>
              <span className="font-mono text-[10px] text-[#8E92A4] shrink-0">{activeChassis.stats}</span>
            </div>
          </div>

          {/* Mode Segmented Selector */}
          <div className="space-y-2 min-w-0">
            <label className="font-pixel text-[11px] uppercase tracking-wider text-[#A1A1AA] block">
              Modo de descenso
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
              {(
                [
                  ['CAMPAIGN', 'Campaña 3.500m', '7 capítulos · Historia'],
                  ['ENDLESS', 'Abismo Infinito', 'Escalado continuo'],
                  ['SPRINT_500', 'Sprint 500m', 'Contra el reloj'],
                  ['TRIAL', 'Pruebas Élite', '4 desafíos extremos'],
                  ['DUEL', 'Duelo Sísmico', '1v1 IA o Local'],
                ] as [GameMode, string, string][]
              ).map(([mId, label, sub]) => (
                <button
                  key={mId}
                  onClick={withClick(() => onSelectMode(mId))}
                  className={`min-w-0 p-3 text-left transition-all cursor-pointer flex flex-col justify-between border-2 ${
                    mode === mId
                      ? 'border-[#EE4E34] bg-[#211516] shadow-[inset_0_2px_0_rgba(255,255,255,0.12),0_3px_0_#08090D]'
                      : 'border-[#2B2D38] bg-[#14151C] hover:border-[#4B5063] shadow-[0_3px_0_#08090D]'
                  }`}
                >
                  <div className="font-display text-base font-bold text-white leading-tight">{label}</div>
                  <div className="text-[11px] text-[#8E92A4] mt-1 leading-snug">{sub}</div>
                </button>
              ))}
            </div>

            {mode === 'TRIAL' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {TRIAL_DEFS.map((t) => {
                  const selected = trialId === t.id;
                  const done = (archive.completedTrials || []).includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={withClick(() => onSelectTrial(t.id))}
                      className={`p-3 text-left border-2 transition-all cursor-pointer space-y-1 ${
                        selected
                          ? 'border-[#FACC15] bg-[#1E1A0E]'
                          : 'border-[#2B2D38] bg-[#111218] hover:border-[#4B5063]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-bold text-white">{t.name}</span>
                        {done ? (
                          <span className="pixel-badge border-[#A3E635] text-[#A3E635]">✓ COMPLETADA</span>
                        ) : (
                          <span className="font-mono text-[11px] text-[#FACC15]">{t.goalDepth}m</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] leading-snug">{t.rules[0] || t.subtitle}</p>
                      <div className="font-mono text-[10px] text-[#38BDF8]">
                        Recompensa: +{t.rewardIso} ISO
                        {Object.entries(t.rewardMats)
                          .map(([m, amt]) => ` · +${amt} ${m}`)
                          .join('')}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seed & Protocol Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t-2 border-[#232530]">
            <div className="space-y-1.5 min-w-0">
              <label htmlFor="seed-input" className="font-pixel text-[10px] uppercase text-[#A1A1AA] block">
                Semilla del pozo
              </label>
              <div className="flex items-stretch gap-2 min-w-0 w-full">
                <input
                  id="seed-input"
                  type="text"
                  value={seed}
                  disabled={isDaily}
                  onChange={(e) => onChangeSeed(e.target.value.toUpperCase())}
                  className="min-w-0 w-full flex-1 bg-[#12131A] border-2 border-[#2B2D38] px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#EE4E34] disabled:opacity-60"
                />
                <button
                  onClick={withClick(onRandomSeed)}
                  disabled={isDaily}
                  title="Generar nueva semilla"
                  aria-label="Generar nueva semilla"
                  className="pixel-btn shrink-0 px-2.5 text-[#A1A1AA] hover:text-white cursor-pointer disabled:opacity-40 flex items-center justify-center"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
                <button
                  onClick={withClick(onToggleDaily)}
                  className={`shrink-0 px-3 py-2 text-xs font-pixel border-2 transition-colors cursor-pointer whitespace-nowrap ${
                    isDaily
                      ? 'border-[#FACC15] bg-[#FACC15]/20 text-[#FACC15]'
                      : 'border-[#2B2D38] bg-[#14151C] text-[#A1A1AA] hover:text-white'
                  }`}
                >
                  Diaria
                </button>
              </div>
            </div>

            {mode === 'CAMPAIGN' && (
              <div className="space-y-1.5 min-w-0">
                <label htmlFor="ascension-select" className="font-pixel text-[10px] uppercase text-[#A1A1AA] block">
                  Protocolo de Profundidad
                </label>
                <div className="flex items-stretch gap-2 min-w-0 w-full">
                  <select
                    id="ascension-select"
                    value={ascension}
                    onChange={(e) => {
                      soundEngine.playUiClick();
                      onChangeAscension(Number(e.target.value));
                    }}
                    className="min-w-0 w-full flex-1 bg-[#12131A] border-2 border-[#2B2D38] px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#EE4E34]"
                  >
                    {Array.from({ length: archive.maxAscensionUnlocked }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Nivel {i + 1} {i === 0 ? '(Estándar)' : ''}
                      </option>
                    ))}
                  </select>
                  {archive.infra.elevatorUnlock > 0 && (
                    <select
                      aria-label="Profundidad inicial"
                      value={startDepth}
                      onChange={(e) => {
                        soundEngine.playUiClick();
                        onChangeStartDepth(Number(e.target.value));
                      }}
                      className="shrink-0 bg-[#12131A] border-2 border-[#2B2D38] px-2.5 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#EE4E34]"
                    >
                      {[0, 500, 1000, 1500, 2000, 2500]
                        .filter((d) => d === 0 || (archive.infra.elevatorUnlock || 0) >= d / 500)
                        .map((d) => (
                          <option key={d} value={d}>
                            {String(d).padStart(4, '0')}m
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Guided Tutorial & Campaign Dialogue Options */}
          {mode !== 'DUEL' && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="inline-flex items-center gap-2.5 text-xs text-[#D4D4D8] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={tutorialEnabled}
                  onChange={() => {
                    soundEngine.init();
                    soundEngine.playUiClick();
                    onToggleTutorial();
                  }}
                  className="w-4 h-4 accent-[#D94126] cursor-pointer shrink-0"
                />
                <span>Incluir tutorial guiado inicial (3 pasos)</span>
              </label>
              {mode === 'CAMPAIGN' && (
                <label className="inline-flex items-center gap-2.5 text-xs text-[#D4D4D8] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(archive.skipSeenDialogues)}
                    onChange={() => {
                      soundEngine.init();
                      soundEngine.playUiClick();
                      onToggleSkipDialogues();
                    }}
                    className="w-4 h-4 accent-[#38BDF8] cursor-pointer shrink-0"
                  />
                  <span>Saltar diálogos ya vistos</span>
                </label>
              )}
            </div>
          )}

          {/* Compact Equipped Relics & Tactical Belt Bar */}
          {mode !== 'DUEL' && (
            <div className="pixel-panel p-3 flex flex-wrap items-center justify-between gap-3 text-xs bg-[#12131A]">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="font-pixel text-[9px] text-[#8E92A4] mr-1">RELIQUIAS:</span>
                {(archive.equippedRelics || []).length === 0 ? (
                  <span className="text-[#52525B] font-mono text-[11px]">Ninguna</span>
                ) : (
                  (archive.equippedRelics || []).map((rid) => {
                    const rel = RELICS.find((r) => r.id === rid);
                    return (
                      <span
                        key={rid}
                        title={rel?.desc}
                        className="px-2 py-0.5 border border-[#FACC15]/50 bg-[#FACC15]/10 text-[#FACC15] font-mono text-[10px]"
                      >
                        {rel?.glyph} {rel?.name || rid}
                      </span>
                    );
                  })
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                <span className="font-pixel text-[9px] text-[#8E92A4]">CINTURÓN:</span>
                {[0, 1, 2].map((slot) => {
                  const gid = archive.equippedBelt?.[slot] ?? null;
                  const g = gid ? GADGETS.find((x) => x.id === gid) : null;
                  return (
                    <span
                      key={slot}
                      title={g ? g.desc : 'Ranura de cinturón vacía'}
                      className={`px-1.5 py-0.5 border ${
                        g ? 'border-[#38BDF8]/60 bg-[#38BDF8]/10 text-white' : 'border-[#2B2D38] text-[#52525B]'
                      }`}
                    >
                      [{slot + 1}] {g ? g.glyph : '—'}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              onClick={withClick(onStartGame)}
              className="pixel-btn-primary px-7 py-3 text-white font-pixel text-xs sm:text-sm font-bold tracking-wide cursor-pointer whitespace-nowrap"
            >
              {mode === 'DUEL' ? 'Iniciar Duelo Sísmico' : 'Iniciar Descenso'}
            </button>
            <button
              onClick={withClick(onOpenArchive)}
              className="pixel-btn-gold px-6 py-3 text-white font-pixel text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
            >
              Tienda de Equipo y Archivo
            </button>
          </div>
        </section>

        {/* Right Column: Living Pixel-Art Subterranean Diorama + Tactical Reference */}
        <aside className="lg:col-span-5 min-w-0 space-y-5">
          {/* Living Subterranean Pixel Diorama */}
          <div className="pixel-panel p-2">
            <div className="relative w-full h-[210px] bg-[#0B0C10] border border-[#2B2D38] overflow-hidden">
              <canvas ref={dioramaRef} className="w-full h-full block pixel-canvas" />
            </div>
          </div>

          <div className="pixel-panel p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">Esquema táctico de control</h2>
                <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">
                  La mira queda fijada al pulsar dirección o tocar un bloque cercano. En móvil juega sin teclado en
                  pantalla:{' '}
                  <span className="text-[#38BDF8] font-mono">
                    {visualSettings.touchControlMode === 'HYBRID' ? 'Híbrido Pulgar' : 'Gestual (Principal)'}
                  </span>
                  .
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={withClick(() => setControlsModalSection('KEYBOARD'))}
                  className="pixel-btn px-2.5 py-1.5 font-pixel text-[9px] text-[#FACC15] flex items-center gap-1 cursor-pointer"
                >
                  <Keyboard className="w-3 h-3" />
                  Editar Teclas
                </button>
                <button
                  type="button"
                  onClick={withClick(() => setControlsModalSection('MOBILE'))}
                  className="pixel-btn px-2.5 py-1.5 font-pixel text-[9px] text-[#38BDF8] flex items-center gap-1 cursor-pointer"
                >
                  <Smartphone className="w-3 h-3" />
                  Móvil
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#232530] text-xs">
              {[
                [
                  'Mover / Fijar mira',
                  `${formatActionKeys(keyBindings, 'up').split(' / ')[0]}${formatActionKeys(keyBindings, 'left').split(' / ')[0]}${formatActionKeys(keyBindings, 'down').split(' / ')[0]}${formatActionKeys(keyBindings, 'right').split(' / ')[0]} (${formatActionKeys(keyBindings, 'left')} / ${formatActionKeys(keyBindings, 'right')})`,
                  'Cruceta / Stick',
                ],
                ['Perforar (Drill)', `${formatActionKeys(keyBindings, 'drill')} / Clic Izq.`, 'A / Cruz'],
                [
                  'Permutar Izq / Der',
                  `${formatActionKeys(keyBindings, 'swapLeft')} / ${formatActionKeys(keyBindings, 'swapRight')} · Clic Der.+Deslizar`,
                  'LB / RB',
                ],
                ['Impulso / Freno Aéreo', formatActionKeys(keyBindings, 'dash'), 'X / Cuadrado'],
                ['Overdrive Sísmico', formatActionKeys(keyBindings, 'overdrive'), 'LT / L2'],
                ['Slam (Caída ×2,5)', `${formatActionKeys(keyBindings, 'slam')} (Mant.)`, 'RT / R2'],
                ['Detonación Forzada', formatActionKeys(keyBindings, 'detonate'), 'B / Círculo'],
                ['Re-calibrar (Brecha)', formatActionKeys(keyBindings, 'reroll'), 'Y / Triángulo'],
                [
                  'Artilugios Tácticos',
                  `${formatActionKeys(keyBindings, 'gadget1')} / ${formatActionKeys(keyBindings, 'gadget2')} / ${formatActionKeys(keyBindings, 'gadget3')}`,
                  'D-Pad / Botón',
                ],
              ].map(([act, kb, pad]) => (
                <div key={act} className="py-1.5 flex items-center justify-between gap-3">
                  <span className="text-[#D4D4D8] min-w-0">{act}</span>
                  <div className="font-mono text-right tabular-nums shrink-0 text-[11px]">
                    <span className="text-white">{kb}</span>
                    <span className="text-[#52525B] mx-1">/</span>
                    <span className="text-[#71717A]">{pad}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {controlsModalSection && (
        <ControlsModal
          keyBindings={keyBindings}
          onUpdateKeyBindings={onUpdateKeyBindings}
          visualSettings={visualSettings}
          onUpdateVisualSettings={onUpdateVisualSettings}
          initialSection={controlsModalSection}
          onClose={() => setControlsModalSection(null)}
        />
      )}
      <TacticalGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        keyBindings={keyBindings}
      />
    </div>
  );
};
