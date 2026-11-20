import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Keyboard, Monitor, Pause, Play, RotateCcw, Smartphone, Volume2, VolumeX } from 'lucide-react';
import {
  ActiveFeverEvent,
  AimDir,
  Archetype,
  ArchetypeSynergyState,
  ArchiveSave,
  ArtifactId,
  ChassisId,
  DT,
  GadgetId,
  GameMode,
  GRID_COLS,
  HazardType,
  KeyBindings,
  MaterialBag,
  MaterialId,
  OVERDRIVE_DURATION_FRAMES,
  RadarMilestone,
  RelicId,
  RmbDragPreview,
  RunSummary,
  StorySpeaker,
  StoryTransmission,
  StyleRank,
  TouchControlMode,
  TrialId,
  VisualSettings,
} from '../types/game';
import { ARCHETYPE_COLORS, CHASSIS_LIST, MODULES, OVERCHARGES, RIG_UPGRADES } from '../data/catalog';
import { ARTIFACTS } from '../data/collectibles';
import { CONTRACT_POOL, EMPTY_MATERIAL_BAG, GADGETS, MATERIALS, RELICS, TRIAL_DEFS } from '../data/crafting';
import { SPEAKER_PROFILES } from '../data/story';
import { BifurcationOffer, BreachOffer, EstratoSimulation, InputState } from '../engine/simulation';
import { formatActionKeys, formatKeyCode, isActionHeld, isCodeBoundToAction } from '../storage/controls';
import { getArtifactIconSprite, getCharacterPortraitSprite, getMaterialIconSprite } from '../engine/pixelArt';
import { renderSimulation, screenPointToGridCell } from '../engine/renderer';
import { soundEngine } from '../engine/audio';
import { ControlsModal } from './ControlsModal';
import { TacticalGuideModal } from './TacticalGuideModal';

const PortraitCanvas: React.FC<{ speaker: StorySpeaker; frame: number; size?: number }> = ({
  speaker,
  frame,
  size = 64,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const sprite = getCharacterPortraitSprite(speaker, frame);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(sprite, 0, 0, c.width, c.height);
  }, [speaker, frame]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className="pixel-canvas shrink-0 border-2 border-[#2B2D38] bg-[#0B0C10]"
      style={{ width: size, height: size }}
    />
  );
};

const MaterialMiniIcon: React.FC<{ matId: MaterialId; size?: number }> = ({ matId, size = 16 }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const sprite = getMaterialIconSprite(matId);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(sprite, 0, 0, c.width, c.height);
  }, [matId]);
  return <canvas ref={ref} width={size} height={size} className="pixel-canvas shrink-0" style={{ width: size, height: size }} />;
};

const ArtifactMiniIcon: React.FC<{ artifactId: ArtifactId; size?: number }> = ({ artifactId, size = 20 }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const sprite = getArtifactIconSprite(artifactId);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(sprite, 0, 0, c.width, c.height);
  }, [artifactId]);
  return <canvas ref={ref} width={size} height={size} className="pixel-canvas shrink-0" style={{ width: size, height: size }} />;
};

function computeRmbDragDirection(
  sim: EstratoSimulation,
  anchorR: number,
  anchorC: number,
  dx: number,
  dy: number,
  cellSize: number
): {
  dirX: -1 | 0 | 1;
  dirY: -1 | 0 | 1;
  preview: RmbDragPreview | null;
  threshold: number;
} {
  const threshold = Math.max(22, cellSize * 0.52);
  const dr = anchorR - Math.max(0, sim.gridRow);
  let dirX: -1 | 0 | 1 = 0;
  let dirY: -1 | 0 | 1 = 0;

  if (dr !== 0) {
    if (Math.abs(dx) >= 4 || Math.abs(dx) >= Math.abs(dy) * 0.45) {
      dirX = dx >= 0 ? 1 : -1;
    } else {
      dirX = sim.facing;
    }
  } else if (Math.abs(dy) > Math.abs(dx) * 1.15) {
    dirY = dy >= 0 ? 1 : -1;
  } else {
    dirX = dx >= 0 ? 1 : -1;
  }

  const target = sim.getDirectionalSwapTarget(anchorR, anchorC, dirX, dirY);
  const progress = Math.min(1, Math.hypot(dx, dy) / threshold);
  const preview: RmbDragPreview | null = target
    ? {
        r: target.r1,
        c: target.c1,
        targetR: target.r2,
        targetC: target.c2,
        dirX: target.c2 !== target.c1 ? (target.c2 > target.c1 ? 1 : -1) : 0,
        dirY: target.r2 !== target.r1 ? (target.r2 > target.r1 ? 1 : -1) : 0,
        progress,
      }
    : null;
  return { dirX, dirY, preview, threshold };
}

interface GameCanvasProps {
  mode: GameMode;
  seed: string;
  chassis: ChassisId;
  ascension: number;
  startDepth?: number;
  trialId?: TrialId;
  skipSeenDialogues?: boolean;
  enableTutorial?: boolean;
  onTutorialComplete?: () => void;
  archive: ArchiveSave;
  visualSettings: VisualSettings;
  onCycleCrtMode: () => void;
  onUpdateVisualSettings?: (next: VisualSettings) => void;
  keyBindings: KeyBindings;
  onUpdateKeyBindings?: (next: KeyBindings) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onFinishRun: (summary: RunSummary, discoveredCodex: string[]) => string[];
  onExitToTitle: () => void;
  onGoToArchive: () => void;
  onRestartRun: () => void;
}

interface HudSnapshot {
  depth: number;
  stratumName: string;
  oxygen: number;
  maxOxygen: number;
  inLastBreath: boolean;
  isotopes: number;
  isotopesBanked: number;
  maxChain: number;
  parries: number;
  shields: number;
  rerolls: number;
  modules: { id: string; mk2: boolean }[];
  overcharges: string[];
  guardian: { name: string; hp: number; maxHp: number } | null;
  inStratum6: boolean;
  hasAlpha: boolean;
  hasLance: boolean;
  aimDir: AimDir;
  tutorialStep: 0 | 1 | 2 | 3;
  score: number;
  comboCount: number;
  comboMultiplier: number;
  comboTimerRatio: number;
  maxComboMultiplier: number;
  speedMult: number;
  densityPct: number;
  overdrive: number;
  overdriveTimer: number;
  overdriveMaxDuration: number;
  dashReadyRatio: number;
  belt: (GadgetId | null)[];
  equippedRelics: RelicId[];
  materialsEarned: MaterialBag;
  pendingStory: StoryTransmission | null;
  activeTicker: { speaker: StorySpeaker; name: string; text: string; color: string; timer: number } | null;
  activeHazard: {
    type: HazardType;
    label: string;
    color: string;
    warningTimer: number;
    activeTimer: number;
    targetCols: number[];
  } | null;
  styleRank: StyleRank;
  styleScore: number;
  styleMult: number;
  peakStyleRank: StyleRank;
  synergies: ArchetypeSynergyState[];
  activeFever: ActiveFeverEvent | null;
  activeBreach: BreachOffer | null;
  activeBifurcation: BifurcationOffer | null;
  upcomingMilestones: RadarMilestone[];
  guardianPhase: 1 | 2;
  hasIgniting: boolean;
  isFallingPlayer: boolean;
  resonanceCharge: number;
  tacticalReadyRatio: number;
  overheadDangerDist: number;
  hasArchitectCrown: boolean;
  artifactNearby: boolean;
  recentArtifactBanner: {
    id: ArtifactId;
    name: string;
    rarity: string;
    color: string;
    bonusText: string;
    timer: number;
  } | null;
  discoveredArtifactsCount: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  seed,
  chassis,
  ascension,
  startDepth = 0,
  trialId,
  skipSeenDialogues = false,
  enableTutorial = false,
  onTutorialComplete,
  archive,
  visualSettings,
  onCycleCrtMode,
  onUpdateVisualSettings,
  keyBindings,
  onUpdateKeyBindings,
  soundEnabled,
  onToggleSound,
  onFinishRun,
  onExitToTitle,
  onGoToArchive,
  onRestartRun,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<EstratoSimulation | null>(null);
  const pausedRef = useRef(false);
  const visualSettingsRef = useRef<VisualSettings>(visualSettings);
  visualSettingsRef.current = visualSettings;
  const keyBindingsRef = useRef<KeyBindings>(keyBindings);
  keyBindingsRef.current = keyBindings;
  const touchMode: TouchControlMode = visualSettings.touchControlMode === 'HYBRID' ? 'HYBRID' : 'GESTURES';
  const touchModeRef = useRef<TouchControlMode>(touchMode);
  touchModeRef.current = touchMode;

  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [hudInfoBanner, setHudInfoBanner] = useState<{ title: string; desc: string; color: string } | null>(null);
  const hudInfoTimerRef = useRef<number | null>(null);
  const showHudInfo = (title: string, desc: string, color = '#38BDF8') => {
    setHudInfoBanner({ title, desc, color });
    if (hudInfoTimerRef.current !== null) window.clearTimeout(hudInfoTimerRef.current);
    hudInfoTimerRef.current = window.setTimeout(() => setHudInfoBanner(null), 4200);
  };
  const [controlsModalSection, setControlsModalSection] = useState<'KEYBOARD' | 'MOBILE' | null>(null);
  const controlsModalOpenRef = useRef(false);
  controlsModalOpenRef.current = controlsModalSection !== null;
  const showGuideOpenRef = useRef(false);
  showGuideOpenRef.current = showGuide;
  const [sliderNub, setSliderNub] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [storyRevealChars, setStoryRevealChars] = useState(999);
  const [portraitFrame, setPortraitFrame] = useState(0);
  const storyRevealDoneRef = useRef(true);
  const storyIntervalRef = useRef<number | null>(null);
  const completeStoryText = (totalLen?: number) => {
    if (storyIntervalRef.current !== null) {
      window.clearInterval(storyIntervalRef.current);
      storyIntervalRef.current = null;
    }
    storyRevealDoneRef.current = true;
    setStoryRevealChars(totalLen ?? 99999);
    setPortraitFrame(0);
  };
  const [hud, setHud] = useState<HudSnapshot>({
    depth: startDepth,
    stratumName: 'I. Corteza',
    oxygen: 100,
    maxOxygen: 100,
    inLastBreath: false,
    isotopes: 0,
    isotopesBanked: 0,
    maxChain: 1,
    parries: 0,
    shields: 0,
    rerolls: archive.infra.reroll,
    modules: [],
    overcharges: [],
    guardian: null,
    inStratum6: false,
    hasAlpha: false,
    hasLance: false,
    aimDir: 'DOWN',
    tutorialStep: enableTutorial && mode !== 'DUEL' && startDepth === 0 ? 1 : 0,
    score: 0,
    comboCount: 0,
    comboMultiplier: 1,
    comboTimerRatio: 0,
    maxComboMultiplier: 1,
    speedMult: 1.0,
    densityPct: 0,
    overdrive: 0,
    overdriveTimer: 0,
    overdriveMaxDuration: OVERDRIVE_DURATION_FRAMES,
    dashReadyRatio: 1,
    belt: [...(archive.equippedBelt || [null, null, null])],
    equippedRelics: [...(archive.equippedRelics || [])],
    materialsEarned: { ...EMPTY_MATERIAL_BAG },
    pendingStory: null,
    activeTicker: null,
    activeHazard: null,
    styleRank: 'D',
    styleScore: 0,
    styleMult: 1.0,
    peakStyleRank: 'D',
    synergies: [],
    activeFever: null,
    activeBreach: null,
    activeBifurcation: null,
    upcomingMilestones: [],
    guardianPhase: 1,
    hasIgniting: false,
    isFallingPlayer: false,
    resonanceCharge: 0,
    tacticalReadyRatio: 1,
    overheadDangerDist: 99,
    hasArchitectCrown: Boolean(archive.architectCrownUnlocked),
    artifactNearby: false,
    recentArtifactBanner: null,
    discoveredArtifactsCount: archive.discoveredArtifacts?.length || 0,
  });

  const hoveredCellRef = useRef<{ r: number; c: number } | null>(null);
  const rmbDragRef = useRef<{
    startX: number;
    startY: number;
    anchorR: number;
    anchorC: number;
    cellSize: number;
    fired: boolean;
  } | null>(null);
  const rmbDragPreviewRef = useRef<RmbDragPreview | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clearDrag = () => {
      rmbDragRef.current = null;
      rmbDragPreviewRef.current = null;
    };

    const handleWindowMouseMove = (e: MouseEvent) => {
      const drag = rmbDragRef.current;
      const sim = simRef.current;
      if (!drag || drag.fired || !sim || pausedRef.current || sim.finished) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const dist = Math.hypot(dx, dy);
      if (dist < 6) {
        rmbDragPreviewRef.current = null;
        return;
      }

      const { dirX, dirY, preview, threshold } = computeRmbDragDirection(
        sim,
        drag.anchorR,
        drag.anchorC,
        dx,
        dy,
        drag.cellSize
      );
      rmbDragPreviewRef.current = preview;

      if (dist >= threshold && preview) {
        sim.tryDirectionalSwapAtCell(drag.anchorR, drag.anchorC, dirX, dirY);
        drag.fired = true;
        rmbDragPreviewRef.current = null;
      }
    };

    const handleWindowMouseUp = (e: MouseEvent) => {
      if (e.button !== 2) return;
      const drag = rmbDragRef.current;
      if (!drag) return;

      const sim = simRef.current;
      if (!drag.fired && sim && !pausedRef.current && !sim.finished) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const dist = Math.hypot(dx, dy);
        if (dist >= 10) {
          const { dirX, dirY } = computeRmbDragDirection(sim, drag.anchorR, drag.anchorC, dx, dy, drag.cellSize);
          sim.tryDirectionalSwapAtCell(drag.anchorR, drag.anchorC, dirX, dirY);
        } else {
          const curCol = Math.max(0, Math.min(GRID_COLS - 1, sim.gridCol));
          const dc = drag.anchorC - curCol;
          if (dc === 0) {
            sim.tryDirectionalSwapAtCell(drag.anchorR, drag.anchorC, sim.facing, 0);
          } else {
            sim.aimAndActAtCell(drag.anchorR, drag.anchorC, dc > 0 ? 'SWAP_RIGHT' : 'SWAP_LEFT');
          }
        }
      }
      clearDrag();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    window.addEventListener('blur', clearDrag);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      window.removeEventListener('blur', clearDrag);
    };
  }, []);

  const lastBiomeIdRef = useRef<number>(0);
  const biomeTimeoutRef = useRef<number | null>(null);
  const [biomeBanner, setBiomeBanner] = useState<{
    name: string;
    subtitle: string;
    depth: number;
    primaryColor: string;
    secondaryColor: string;
  } | null>(null);

  const lastDrillIdRef = useRef<number>(0);
  const drillShakeRef = useRef<{ timer: number; intensity: number }>({ timer: 0, intensity: 0 });

  const keysHeld = useRef<Set<string>>(new Set());
  const edgeQueue = useRef<{
    drill: boolean;
    swapL: boolean;
    swapR: boolean;
    detonate: boolean;
    reroll: boolean;
    dash: boolean;
    overdrive: boolean;
    gadget1: boolean;
    gadget2: boolean;
    gadget3: boolean;
  }>({
    drill: false,
    swapL: false,
    swapR: false,
    detonate: false,
    reroll: false,
    dash: false,
    overdrive: false,
    gadget1: false,
    gadget2: false,
    gadget3: false,
  });

  const prevPadButtons = useRef<boolean[]>([]);
  const touchInputRef = useRef<{ left: boolean; right: boolean; up: boolean; down: boolean; slam: boolean }>({
    left: false,
    right: false,
    up: false,
    down: false,
    slam: false,
  });
  const canvasTouchRef = useRef<{
    id: number;
    mode: 'BLOCK' | 'FREE' | 'DOWN_DRILL' | 'DONE';
    startX: number;
    startY: number;
    startTime: number;
    anchorR: number;
    anchorC: number;
    cellSize: number;
    side: -1 | 1;
    fired: boolean;
    airBrakeFired: boolean;
    dashFlicked: boolean;
    downDrillAnchorY: number;
    downDrillCount: number;
  } | null>(null);
  const lastFreeTapRef = useRef<{ time: number; side: -1 | 1 }>({ time: 0, side: 1 });
  const lastTouchEndMsRef = useRef<number>(0);
  const sliderTouchRef = useRef<{ id: number; startY: number; width: number; left: number } | null>(null);

  // Typewriter & animated pixel portrait when a story dialogue modal is open
  useEffect(() => {
    if (storyIntervalRef.current !== null) {
      window.clearInterval(storyIntervalRef.current);
      storyIntervalRef.current = null;
    }
    const st = hud.pendingStory;
    if (!st) {
      storyRevealDoneRef.current = true;
      return;
    }
    const totalChars = st.lines.join('\n').length;
    setStoryRevealChars(0);
    setPortraitFrame(0);
    storyRevealDoneRef.current = false;
    let count = 0;
    let tick = 0;
    storyIntervalRef.current = window.setInterval(() => {
      if (storyRevealDoneRef.current) {
        if (storyIntervalRef.current !== null) {
          window.clearInterval(storyIntervalRef.current);
          storyIntervalRef.current = null;
        }
        return;
      }
      tick++;
      if (count < totalChars) {
        count = Math.min(totalChars, count + 2);
        setStoryRevealChars(count);
        if (tick % 3 === 0) soundEngine.playDialogueBlip(st.speaker);
      }
      if (count >= totalChars) {
        storyRevealDoneRef.current = true;
        setPortraitFrame(0);
        if (storyIntervalRef.current !== null) {
          window.clearInterval(storyIntervalRef.current);
          storyIntervalRef.current = null;
        }
      } else if (tick % 6 === 0) {
        setPortraitFrame((f) => (f === 0 ? 1 : 0));
      }
    }, 22);
    return () => {
      if (storyIntervalRef.current !== null) {
        window.clearInterval(storyIntervalRef.current);
        storyIntervalRef.current = null;
      }
    };
  }, [hud.pendingStory?.id]);

  useEffect(() => {
    soundEngine.init();
    const sim = new EstratoSimulation({
      mode,
      seed,
      chassis,
      ascension,
      archive,
      startDepth,
      trialId,
      skipSeenDialogues,
      enableTutorial,
      onTutorialComplete,
    });
    simRef.current = sim;
    pausedRef.current = false;
    setPaused(false);
    setSummary(null);
    lastBiomeIdRef.current = 0;
    lastDrillIdRef.current = 0;
    if (biomeTimeoutRef.current !== null) {
      window.clearTimeout(biomeTimeoutRef.current);
      biomeTimeoutRef.current = null;
    }
    setBiomeBanner(null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (controlsModalOpenRef.current) return;
      if (showGuideOpenRef.current) {
        if (e.code === 'Escape') {
          e.preventDefault();
          setShowGuide(false);
        }
        return;
      }
      const code = e.code;
      const kb = keyBindingsRef.current;
      if (
        ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code) ||
        isCodeBoundToAction(kb, 'drill', code) ||
        isCodeBoundToAction(kb, 'swapLeft', code) ||
        isCodeBoundToAction(kb, 'swapRight', code) ||
        isCodeBoundToAction(kb, 'dash', code)
      ) {
        e.preventDefault();
      }
      if (isCodeBoundToAction(kb, 'pause', code) || code === 'Escape') {
        if (!sim.finished) {
          pausedRef.current = !pausedRef.current;
          setPaused(pausedRef.current);
        }
        return;
      }
      // Intercept inputs cleanly when a campaign story dialogue modal is open
      if (sim.pendingStory && !pausedRef.current && !sim.finished && !e.repeat) {
        const st = sim.pendingStory;
        if (st.choices && st.choices.length > 0) {
          if (code === 'Digit1' && st.choices[0]) {
            completeStoryText();
            sim.resolvePendingStory(st.choices[0].id);
            return;
          }
          if (code === 'Digit2' && st.choices[1]) {
            completeStoryText();
            sim.resolvePendingStory(st.choices[1].id);
            return;
          }
          if ((code === 'Space' || code === 'Enter' || isCodeBoundToAction(kb, 'drill', code)) && !storyRevealDoneRef.current) {
            completeStoryText();
            return;
          }
        } else if (code === 'Space' || code === 'Enter' || isCodeBoundToAction(kb, 'drill', code)) {
          if (!storyRevealDoneRef.current) {
            completeStoryText();
          } else {
            sim.resolvePendingStory();
          }
          return;
        }
        return;
      }
      if (!e.repeat) {
        if (isCodeBoundToAction(kb, 'drill', code)) edgeQueue.current.drill = true;
        if (isCodeBoundToAction(kb, 'swapLeft', code)) edgeQueue.current.swapL = true;
        if (isCodeBoundToAction(kb, 'swapRight', code)) edgeQueue.current.swapR = true;
        if (isCodeBoundToAction(kb, 'detonate', code)) edgeQueue.current.detonate = true;
        if (isCodeBoundToAction(kb, 'reroll', code)) edgeQueue.current.reroll = true;
        if (isCodeBoundToAction(kb, 'dash', code)) edgeQueue.current.dash = true;
        if (isCodeBoundToAction(kb, 'overdrive', code)) edgeQueue.current.overdrive = true;
        if (isCodeBoundToAction(kb, 'gadget1', code)) edgeQueue.current.gadget1 = true;
        if (isCodeBoundToAction(kb, 'gadget2', code)) edgeQueue.current.gadget2 = true;
        if (isCodeBoundToAction(kb, 'gadget3', code)) edgeQueue.current.gadget3 = true;
        if (code === 'KeyF') {
          sim.triggerOperatorResonance();
        }
        if (code === 'KeyG') {
          sim.triggerOperatorTactical();
        }
        if (isCodeBoundToAction(kb, 'up', code) && (sim.overheadDangerDist <= 4.5 || sim.coyoteCrushTimer > 0)) {
          sim.triggerOverheadCounter();
        }
      }
      keysHeld.current.add(code);
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
    let accumulator = 0;
    let hudFrameCounter = 0;
    let finishedProcessed = false;

    const pollGamepad = (): {
      left: boolean;
      right: boolean;
      up: boolean;
      down: boolean;
      slam: boolean;
    } => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = pads[0];
      if (!pad) return { left: false, right: false, up: false, down: false, slam: false };

      const btn = (idx: number) => Boolean(pad.buttons[idx]?.pressed);
      const justPressed = (idx: number) => btn(idx) && !prevPadButtons.current[idx];

      if (justPressed(0)) edgeQueue.current.drill = true; // A / Cross
      if (justPressed(2)) edgeQueue.current.dash = true; // X / Square
      if (justPressed(4)) edgeQueue.current.swapL = true; // LB / L1
      if (justPressed(5)) edgeQueue.current.swapR = true; // RB / R1
      if (justPressed(1)) edgeQueue.current.detonate = true; // B / Circle
      if (justPressed(3)) edgeQueue.current.reroll = true; // Y / Triangle
      if (justPressed(6)) edgeQueue.current.overdrive = true; // LT / L2
      if (justPressed(9) && !sim.finished) {
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
      }

      prevPadButtons.current = pad.buttons.map((b) => b.pressed);

      const axX = pad.axes[0] || 0;
      const axY = pad.axes[1] || 0;
      return {
        left: axX < -0.4 || btn(14),
        right: axX > 0.4 || btn(15),
        up: axY < -0.45 || btn(12),
        down: axY > 0.45 || btn(13),
        slam: btn(7) || (pad.buttons[7]?.value ?? 0) > 0.3,
      };
    };

    const loop = (now: number) => {
      const frameDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const padState = pollGamepad();

      if (!pausedRef.current && !sim.finished) {
        accumulator += frameDt;
        while (accumulator >= DT) {
          const held = keysHeld.current;
          const kb = keyBindingsRef.current;
          const ti = touchInputRef.current;
          const input: InputState = {
            left: isActionHeld(kb, 'left', held) || padState.left || ti.left,
            right: isActionHeld(kb, 'right', held) || padState.right || ti.right,
            up: isActionHeld(kb, 'up', held) || padState.up || ti.up,
            down: isActionHeld(kb, 'down', held) || padState.down || ti.down,
            drillPressed: edgeQueue.current.drill,
            swapLeftPressed: edgeQueue.current.swapL,
            swapRightPressed: edgeQueue.current.swapR,
            slamHeld: isActionHeld(kb, 'slam', held) || padState.slam || ti.slam,
            detonatePressed: edgeQueue.current.detonate,
            rerollPressed: edgeQueue.current.reroll,
            dashPressed: edgeQueue.current.dash,
            overdrivePressed: edgeQueue.current.overdrive,
            gadget1Pressed: edgeQueue.current.gadget1,
            gadget2Pressed: edgeQueue.current.gadget2,
            gadget3Pressed: edgeQueue.current.gadget3,
          };
          edgeQueue.current.drill = false;
          edgeQueue.current.swapL = false;
          edgeQueue.current.swapR = false;
          edgeQueue.current.detonate = false;
          edgeQueue.current.reroll = false;
          edgeQueue.current.dash = false;
          edgeQueue.current.overdrive = false;
          edgeQueue.current.gadget1 = false;
          edgeQueue.current.gadget2 = false;
          edgeQueue.current.gadget3 = false;

          if (sim.beginTickAndCheckInputs(input)) {
            sim.stepGridMovementWithLerp(input);
            sim.stepTerrainState(input.slamHeld);
            sim.checkImmediatePlayerFall();
            sim.finishTickWorldEvents();
          }

          accumulator -= DT;

          if (sim.finished && sim.summary && !finishedProcessed) {
            finishedProcessed = true;
            const unlocks = onFinishRun(sim.summary, Array.from(sim.discoveredCodex));
            setSummary({ ...sim.summary, newUnlocks: unlocks });
            break;
          }
        }
      }

      // Subtle DOM container tremor on heavy drill / biome impact scaled by user visualSettings
      const drillEv = sim.lastDrillEvent;
      if (drillEv && drillEv.id !== lastDrillIdRef.current) {
        lastDrillIdRef.current = drillEv.id;
        drillShakeRef.current = {
          timer: drillEv.isSlag ? 9 : 6,
          intensity: drillEv.isSlag ? 4.5 : 2.8,
        };
      }

      const biomeEv = sim.lastBiomeTransition;
      if (biomeEv && biomeEv.id !== lastBiomeIdRef.current) {
        lastBiomeIdRef.current = biomeEv.id;
        drillShakeRef.current = { timer: 14, intensity: 5.2 };
        setBiomeBanner({
          name: biomeEv.name,
          subtitle: biomeEv.subtitle,
          depth: biomeEv.milestoneDepth,
          primaryColor: biomeEv.primaryColor,
          secondaryColor: biomeEv.secondaryColor,
        });
        if (biomeTimeoutRef.current !== null) {
          window.clearTimeout(biomeTimeoutRef.current);
        }
        biomeTimeoutRef.current = window.setTimeout(() => {
          setBiomeBanner(null);
          biomeTimeoutRef.current = null;
        }, 3200);
      }

      if (canvasFrameRef.current) {
        const shakeScale = visualSettingsRef.current.screenShake;
        if (!pausedRef.current && !sim.finished && drillShakeRef.current.timer > 0 && shakeScale > 0) {
          const tRatio = drillShakeRef.current.timer / 10;
          const mag = drillShakeRef.current.intensity * tRatio * shakeScale;
          const sx = (Math.random() * 2 - 1) * mag;
          const sy = (Math.random() * 2 - 1) * mag;
          canvasFrameRef.current.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0)`;
          drillShakeRef.current.timer--;
        } else {
          canvasFrameRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
        }
      }

      // High-FPS Unified Virtual-Pixel Canvas Render
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const rect = canvas.getBoundingClientRect();
        const targetW = Math.max(1, Math.floor(rect.width * dpr));
        const targetH = Math.max(1, Math.floor(rect.height * dpr));
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderSimulation(
            ctx,
            sim,
            rect.width,
            rect.height,
            now / 1000,
            hoveredCellRef.current,
            visualSettingsRef.current,
            rmbDragPreviewRef.current
          );
        }
      }

      // Sync React HUD at ~15Hz
      hudFrameCounter++;
      if (hudFrameCounter >= 4) {
        hudFrameCounter = 0;
        const stratum = sim.getStratumForRow(sim.depthMeters);
        const dashMax = Math.max(1, sim.dashMaxCooldown);
        setHud({
          depth: sim.depthMeters,
          stratumName: stratum.name,
          oxygen: Math.round(sim.oxygen),
          maxOxygen: sim.maxOxygen,
          inLastBreath: sim.inLastBreath,
          isotopes: sim.isotopes,
          isotopesBanked: sim.isotopesBanked,
          maxChain: sim.maxChain,
          parries: sim.parries,
          shields: sim.kineticShields + (sim.anvilShieldAvailable ? 1 : 0),
          rerolls: sim.rerollsRemaining,
          modules: [...sim.modules],
          overcharges: [...sim.overcharges],
          guardian: sim.activeGuardian
            ? { name: sim.activeGuardian.name, hp: sim.activeGuardian.hp, maxHp: sim.activeGuardian.maxHp }
            : null,
          inStratum6: sim.inStratum6,
          hasAlpha: sim.hasAlphaFragment,
          hasLance: sim.hasSingularityLance,
          aimDir: sim.aimDir,
          tutorialStep: sim.tutorialStep,
          score: sim.score,
          comboCount: sim.comboCount,
          comboMultiplier: sim.comboMultiplier,
          comboTimerRatio: sim.comboTimerRatio,
          maxComboMultiplier: sim.maxComboMultiplier,
          speedMult: sim.dynamicDescentSpeedMult,
          densityPct: Math.round(sim.dynamicBlockDensityBoost * 100),
          overdrive: Math.round(sim.overdrive),
          overdriveTimer: sim.overdriveTimer,
          overdriveMaxDuration: sim.getOverdriveMaxDuration(),
          dashReadyRatio: Math.max(0, Math.min(1, 1 - sim.dashCooldown / dashMax)),
          belt: [...sim.belt],
          equippedRelics: Array.from(sim.equippedRelics),
          materialsEarned: { ...sim.materialsEarned },
          pendingStory: sim.pendingStory,
          activeTicker: sim.activeTicker ? { ...sim.activeTicker } : null,
          activeHazard: sim.activeHazard
            ? { ...sim.activeHazard, targetCols: [...sim.activeHazard.targetCols] }
            : null,
          styleRank: sim.styleRank,
          styleScore: Math.round(sim.styleScore),
          styleMult: sim.getStyleMultiplier(),
          peakStyleRank: sim.peakStyleRank,
          synergies: sim.getArchetypeSynergies(),
          activeFever: sim.activeFever ? { ...sim.activeFever } : null,
          activeBreach:
            sim.activeBreach && !sim.activeBreach.resolved
              ? { ...sim.activeBreach, options: sim.activeBreach.options.map((o) => ({ ...o })) }
              : null,
          activeBifurcation:
            sim.activeBifurcation && !sim.activeBifurcation.resolved ? { ...sim.activeBifurcation } : null,
          upcomingMilestones: sim.getUpcomingMilestones(),
          guardianPhase: sim.activeGuardian?.phase ?? 1,
          hasIgniting: sim.hasIgnitingBlocks(),
          isFallingPlayer: sim.playerState === 'falling',
          resonanceCharge: Math.round(sim.resonanceCharge),
          tacticalReadyRatio: sim.getTacticalReadyRatio(),
          overheadDangerDist: sim.overheadDangerDist,
          hasArchitectCrown: sim.hasArchitectCrown,
          artifactNearby: sim.artifactNearby,
          recentArtifactBanner: sim.recentArtifactBanner ? { ...sim.recentArtifactBanner } : null,
          discoveredArtifactsCount: sim.discoveredArtifacts.length,
        });
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      if (biomeTimeoutRef.current !== null) {
        window.clearTimeout(biomeTimeoutRef.current);
        biomeTimeoutRef.current = null;
      }
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      soundEngine.setLowOxygen(false);
    };
  }, [mode, seed, chassis, ascension, startDepth, trialId, skipSeenDialogues]);

  const togglePause = () => {
    if (summary) return;
    soundEngine.playUiClick();
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const getCellFromPointer = (
    clientX: number,
    clientY: number
  ): { r: number; c: number; cellSize: number } | null => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim) return null;
    const rect = canvas.getBoundingClientRect();
    return screenPointToGridCell(clientX, clientY, rect, sim, visualSettingsRef.current.cameraAnchorY);
  };

  const handleCanvasPointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = getCellFromPointer(e.clientX, e.clientY);
    hoveredCellRef.current = hit ? { r: hit.r, c: hit.c } : null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 2 || pausedRef.current || summary) return;
    e.preventDefault();
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas) return;
    const hit = getCellFromPointer(e.clientX, e.clientY);

    let anchorR: number;
    let anchorC: number;
    const rect = canvas.getBoundingClientRect();
    const fallbackCellSize = (24 / 256) * rect.width * sim.camZoom;

    if (
      hit &&
      (sim.getDirectionalSwapTarget(hit.r, hit.c, 1, 0) ||
        sim.getDirectionalSwapTarget(hit.r, hit.c, -1, 0) ||
        sim.getDirectionalSwapTarget(hit.r, hit.c, 0, -1) ||
        sim.getDirectionalSwapTarget(hit.r, hit.c, 0, 1))
    ) {
      anchorR = hit.r;
      anchorC = hit.c;
    } else {
      const curRow = Math.max(0, sim.gridRow);
      const curCol = Math.max(0, Math.min(GRID_COLS - 1, sim.gridCol));
      const off =
        sim.aimDir === 'UP'
          ? [-1, 0]
          : sim.aimDir === 'LEFT'
          ? [0, -1]
          : sim.aimDir === 'RIGHT'
          ? [0, 1]
          : [1, 0];
      anchorR = Math.max(0, curRow + off[0]);
      anchorC = Math.max(0, Math.min(GRID_COLS - 1, curCol + off[1]));
    }

    rmbDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      anchorR,
      anchorC,
      cellSize: hit?.cellSize || fallbackCellSize,
      fired: false,
    };
    rmbDragPreviewRef.current = null;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (performance.now() - lastTouchEndMsRef.current < 450) return;
    if (e.button !== 0 || pausedRef.current || summary) return;
    const sim = simRef.current;
    if (!sim) return;
    const cell = getCellFromPointer(e.clientX, e.clientY);
    if (!cell) return;
    sim.handleCellTap(cell.r, cell.c);
  };

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };

  const findChangedTouchById = (list: React.TouchList, id: number): React.Touch | null => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].identifier === id) return list[i];
    }
    return null;
  };

  const resetCanvasTouchInput = () => {
    if (!sliderTouchRef.current) {
      touchInputRef.current.left = false;
      touchInputRef.current.right = false;
      touchInputRef.current.up = false;
      touchInputRef.current.down = false;
      touchInputRef.current.slam = false;
    }
  };

  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (pausedRef.current || summary) return;
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas || canvasTouchRef.current) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    e.preventDefault();

    const hit = getCellFromPointer(touch.clientX, touch.clientY);
    const rect = canvas.getBoundingClientRect();
    const screenSide: -1 | 1 = touch.clientX - rect.left < rect.width * 0.5 ? -1 : 1;

    if (hit && sim.getCell(hit.r, hit.c).state === 'IGNITING') {
      sim.triggerForceDetonate();
      canvasTouchRef.current = {
        id: touch.identifier,
        mode: 'DONE',
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: performance.now(),
        anchorR: hit.r,
        anchorC: hit.c,
        cellSize: hit.cellSize,
        side: screenSide,
        fired: true,
        airBrakeFired: false,
        dashFlicked: false,
        downDrillAnchorY: touch.clientY,
        downDrillCount: 0,
      };
      return;
    }

    const hitCell = hit ? sim.getCell(hit.r, hit.c) : null;
    const isCoyoteOverhead = Boolean(
      hit && sim.coyoteCrushTimer > 0 && hit.r === Math.max(0, sim.gridRow) - 1 && hit.c === sim.gridCol
    );
    const isAdjacentBlock =
      hit &&
      hitCell &&
      (hitCell.state !== 'EMPTY' || isCoyoteOverhead) &&
      (sim.getDirectionalSwapTarget(hit.r, hit.c, 1, 0) ||
        sim.getDirectionalSwapTarget(hit.r, hit.c, -1, 0) ||
        sim.getDirectionalSwapTarget(hit.r, hit.c, 0, -1) ||
        sim.getDirectionalSwapTarget(hit.r, hit.c, 0, 1));

    if (isAdjacentBlock && hit) {
      canvasTouchRef.current = {
        id: touch.identifier,
        mode: 'BLOCK',
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: performance.now(),
        anchorR: hit.r,
        anchorC: hit.c,
        cellSize: hit.cellSize,
        side: screenSide,
        fired: false,
        airBrakeFired: false,
        dashFlicked: false,
        downDrillAnchorY: touch.clientY,
        downDrillCount: 0,
      };
      return;
    }

    // Free zone (or empty space): never move on single touch; rapid double-tap on left/right half triggers Dash
    const now = performance.now();
    if (
      touchModeRef.current === 'GESTURES' &&
      now - lastFreeTapRef.current.time < 320 &&
      lastFreeTapRef.current.side === screenSide
    ) {
      sim.triggerDirectionalDash(screenSide);
      lastFreeTapRef.current = { time: 0, side: 1 };
      canvasTouchRef.current = {
        id: touch.identifier,
        mode: 'DONE',
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: now,
        anchorR: hit?.r ?? Math.max(0, sim.gridRow + 1),
        anchorC: hit?.c ?? sim.gridCol,
        cellSize: hit?.cellSize ?? (24 / 256) * rect.width * sim.camZoom,
        side: screenSide,
        fired: true,
        airBrakeFired: false,
        dashFlicked: true,
        downDrillAnchorY: touch.clientY,
        downDrillCount: 0,
      };
      return;
    }

    canvasTouchRef.current = {
      id: touch.identifier,
      mode: 'FREE',
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: now,
      anchorR: hit?.r ?? Math.max(0, sim.gridRow + 1),
      anchorC: hit?.c ?? sim.gridCol,
      cellSize: hit?.cellSize ?? (24 / 256) * rect.width * sim.camZoom,
      side: screenSide,
      fired: false,
      airBrakeFired: false,
      dashFlicked: false,
      downDrillAnchorY: touch.clientY,
      downDrillCount: 0,
    };
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const g = canvasTouchRef.current;
    const sim = simRef.current;
    if (!g || !sim || pausedRef.current || sim.finished) return;
    const touch = findChangedTouchById(e.touches, g.id);
    if (!touch) return;
    e.preventDefault();

    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;
    const dist = Math.hypot(dx, dy);
    const swipeDownEnabled = visualSettingsRef.current.swipeDownDrill !== false;
    const drillStepPx = Math.max(26, Math.round(g.cellSize * 0.72));

    if (g.mode === 'DOWN_DRILL') {
      touchInputRef.current.left = false;
      touchInputRef.current.right = false;
      touchInputRef.current.up = false;
      touchInputRef.current.slam = false;
      if (touch.clientY < g.downDrillAnchorY) {
        g.downDrillAnchorY = touch.clientY;
      } else if (touch.clientY - g.downDrillAnchorY >= drillStepPx && sim.playerState !== 'falling') {
        sim.triggerDownwardDrill();
        g.downDrillAnchorY = touch.clientY;
        g.downDrillCount++;
      }
      return;
    }

    if (g.mode === 'BLOCK' && !g.fired) {
      if (dist < 6) {
        rmbDragPreviewRef.current = null;
        return;
      }
      const { dirX, dirY, preview } = computeRmbDragDirection(sim, g.anchorR, g.anchorC, dx, dy, g.cellSize);
      rmbDragPreviewRef.current = preview;
      const threshold = Math.max(20, g.cellSize * 0.48);
      if (dist >= threshold && preview) {
        sim.tryDirectionalSwapAtCell(g.anchorR, g.anchorC, dirX, dirY);
        g.fired = true;
        rmbDragPreviewRef.current = null;
      } else if (!preview && swipeDownEnabled && sim.playerState !== 'falling' && dy >= drillStepPx && dy > Math.abs(dx) * 1.35) {
        g.mode = 'DOWN_DRILL';
        rmbDragPreviewRef.current = null;
        touchInputRef.current.left = false;
        touchInputRef.current.right = false;
        touchInputRef.current.up = false;
        touchInputRef.current.slam = false;
        sim.triggerDownwardDrill();
        g.downDrillAnchorY = touch.clientY;
        g.downDrillCount = 1;
      }
    } else if (g.mode === 'FREE') {
      if (sim.playerState === 'falling') {
        if (dy >= 24 && dy > Math.abs(dx) * 1.25) touchInputRef.current.slam = true;
        if (dy <= -28 && Math.abs(dy) > Math.abs(dx) * 1.25 && !g.airBrakeFired) {
          edgeQueue.current.dash = true;
          g.airBrakeFired = true;
        }
      } else if (swipeDownEnabled && !g.dashFlicked && dy >= drillStepPx && dy > Math.abs(dx) * 1.35) {
        g.mode = 'DOWN_DRILL';
        touchInputRef.current.left = false;
        touchInputRef.current.right = false;
        touchInputRef.current.up = false;
        touchInputRef.current.slam = false;
        sim.triggerDownwardDrill();
        g.downDrillAnchorY = touch.clientY;
        g.downDrillCount = 1;
        return;
      }
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const g = canvasTouchRef.current;
    if (!g) return;
    const touch = findChangedTouchById(e.changedTouches, g.id);
    if (!touch) return;
    e.preventDefault();
    lastTouchEndMsRef.current = performance.now();

    const sim = simRef.current;
    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;
    const dist = Math.hypot(dx, dy);

    if (g.mode === 'BLOCK' && !g.fired && sim && !pausedRef.current && !sim.finished) {
      if (dist >= 12) {
        const { dirX, dirY } = computeRmbDragDirection(sim, g.anchorR, g.anchorC, dx, dy, g.cellSize);
        sim.tryDirectionalSwapAtCell(g.anchorR, g.anchorC, dirX, dirY);
      } else {
        sim.handleCellTap(g.anchorR, g.anchorC);
      }
    } else if (
      g.mode === 'FREE' &&
      touchModeRef.current === 'GESTURES' &&
      !g.dashFlicked &&
      sim &&
      !pausedRef.current &&
      !sim.finished
    ) {
      const swipeStepPx = Math.max(22, Math.round(g.cellSize * 0.45));
      if (Math.abs(dx) >= swipeStepPx && Math.abs(dx) > Math.abs(dy) * 1.1) {
        const moveDir: -1 | 1 = dx > 0 ? 1 : -1;
        sim.triggerStepMove(moveDir, true);
        lastFreeTapRef.current = { time: 0, side: 1 };
      } else if (dy <= -swipeStepPx && Math.abs(dy) > Math.abs(dx) * 1.25 && !g.airBrakeFired) {
        if (sim.overheadDangerDist <= 4.5 || sim.coyoteCrushTimer > 0) {
          sim.triggerOverheadCounter();
        } else if (sim.playerState !== 'falling') {
          if (sim.canClimbStep(sim.facing, true)) {
            sim.triggerStepMove(sim.facing, true);
          } else {
            sim.aimDir = 'UP';
          }
        }
        lastFreeTapRef.current = { time: 0, side: 1 };
      } else if (dist < 16 && performance.now() - g.startTime < 280) {
        lastFreeTapRef.current = { time: performance.now(), side: g.side };
      }
    }

    rmbDragPreviewRef.current = null;
    canvasTouchRef.current = null;
    resetCanvasTouchInput();
  };

  const updateSliderFromTouch = (touch: React.Touch, meta: { startY: number; width: number; left: number }) => {
    const halfW = Math.max(40, meta.width * 0.42);
    const center = meta.left + meta.width * 0.5;
    const normX = Math.max(-1, Math.min(1, (touch.clientX - center) / halfW));
    const dy = touch.clientY - meta.startY;

    touchInputRef.current.left = normX <= -0.18;
    touchInputRef.current.right = normX >= 0.18;
    touchInputRef.current.up = dy <= -18;
    touchInputRef.current.slam = dy >= 18;
    setSliderNub({ x: normX, y: Math.max(-1, Math.min(1, dy / 28)), active: true });
  };

  const handleSliderTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const meta = { id: touch.identifier, startY: touch.clientY, width: rect.width, left: rect.left };
    sliderTouchRef.current = meta;
    updateSliderFromTouch(touch, meta);
  };

  const handleSliderTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const meta = sliderTouchRef.current;
    if (!meta) return;
    const touch = findChangedTouchById(e.touches, meta.id);
    if (!touch) return;
    e.preventDefault();
    updateSliderFromTouch(touch, meta);
  };

  const handleSliderTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const meta = sliderTouchRef.current;
    if (!meta) return;
    const touch = findChangedTouchById(e.changedTouches, meta.id);
    if (!touch) return;
    e.preventDefault();
    sliderTouchRef.current = null;
    touchInputRef.current.left = false;
    touchInputRef.current.right = false;
    touchInputRef.current.up = false;
    touchInputRef.current.slam = false;
    setSliderNub({ x: 0, y: 0, active: false });
  };

  const aimLabels: Record<AimDir, string> = {
    DOWN: 'ABAJO',
    UP: 'ARRIBA',
    LEFT: 'IZQUIERDA',
    RIGHT: 'DERECHA',
  };

  const crtLabels: Record<VisualSettings['crtMode'], string> = {
    SUBTLE: 'SUTIL',
    ARCADE: 'ARCADE',
    OFF: 'OFF',
  };

  const chassisDef = CHASSIS_LIST.find((c) => c.id === chassis) || CHASSIS_LIST[0];
  const rigUpgrades = archive.rigUpgrades || {
    drillTier: 0,
    thrusterTier: 0,
    tankTier: 0,
    armorTier: 0,
    capacitorTier: 0,
    magnetTier: 0,
  };
  const earnedMaterialsList = MATERIALS.filter((m) => (hud.materialsEarned[m.id] || 0) > 0);
  const trialDef = trialId ? TRIAL_DEFS.find((t) => t.id === trialId) : null;

  const activeMult = hud.comboMultiplier;
  const comboScale = 1 + Math.min(0.28, (activeMult - 1) * 0.028);
  const comboGlowColor =
    activeMult >= 8
      ? '#F43F5E'
      : activeMult >= 5
      ? '#FB923C'
      : activeMult >= 3
      ? '#FACC15'
      : activeMult >= 2
      ? '#38BDF8'
      : '#71717A';
  const comboGlowPx = activeMult === 1 ? 0 : Math.min(28, 8 + (activeMult - 1) * 2.5);
  const tierStepsFilled = activeMult >= 12 ? 2 : hud.comboCount > 0 ? (hud.comboCount % 2 === 0 ? 2 : 1) : 0;

  const isOverdriveActive = hud.overdriveTimer > 0;
  const isOverdriveReady = hud.overdrive >= 100 && !isOverdriveActive;
  const overdrivePct = isOverdriveActive
    ? Math.max(0, Math.min(100, Math.round((hud.overdriveTimer / Math.max(1, hud.overdriveMaxDuration)) * 100)))
    : Math.max(0, Math.min(100, hud.overdrive));

  const styleColors: Record<StyleRank, string> = {
    D: '#71717A',
    C: '#94A3B8',
    B: '#A3E635',
    A: '#38BDF8',
    S: '#F97316',
    SS: '#FACC15',
    SSS: '#F43F5E',
  };
  const archCounts: Partial<Record<Archetype, number>> = {};
  for (const m of hud.modules) {
    const def = MODULES.find((x) => x.id === m.id);
    if (def) archCounts[def.archetype] = (archCounts[def.archetype] || 0) + 1;
  }

  return (
    <div className="h-screen w-full bg-[#0E0F14] text-[#F2EFE9] flex flex-col overflow-hidden select-none">
      {/* Slim 3-Zone Arcade Top Bar */}
      <header className="h-12 px-4 sm:px-5 border-b-2 border-[#262834] flex items-center justify-between gap-4 shrink-0 bg-[#12131A]">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <button
            onClick={onExitToTitle}
            className="pixel-btn px-2.5 py-1 flex items-center gap-1.5 text-xs font-pixel text-[#A1A1AA] hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Salir
          </button>
          <span className="font-pixel text-sm font-bold tracking-wider uppercase text-white whitespace-nowrap shrink-0">
            ESTRATO
          </span>
        </div>

        <div className="hidden md:flex items-center gap-3 text-xs text-[#A1A1AA] font-mono tabular-nums whitespace-nowrap shrink-0">
          <span className="text-[#FACC15] font-semibold">{hud.stratumName}</span>
          <span aria-hidden="true">·</span>
          <span>SEMILLA {seed}</span>
          {ascension > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span>PRESIÓN {ascension}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              pausedRef.current = true;
              setPaused(true);
              setShowGuide(true);
            }}
            title="Manual Táctico Animado"
            className="pixel-btn px-2.5 py-1 text-[11px] font-pixel text-[#A3E635] hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Guía</span>
          </button>
          <button
            onClick={() => {
              soundEngine.playUiClick();
              onCycleCrtMode();
            }}
            title="Alternar modo CRT"
            className="pixel-btn px-2.5 py-1 text-[11px] font-pixel text-[#D4D4D8] hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Monitor className="w-3.5 h-3.5 text-[#38BDF8]" />
            CRT:{crtLabels[visualSettings.crtMode]}
          </button>
          <button
            onClick={onToggleSound}
            aria-label={soundEnabled ? 'Silenciar audio' : 'Activar audio'}
            className="pixel-btn p-1.5 text-[#A1A1AA] hover:text-white cursor-pointer"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={togglePause}
            className="pixel-btn px-3 py-1 text-xs font-pixel text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? 'Reanudar' : 'Pausa'}
          </button>
        </div>
      </header>

      {/* Main Play Workspace: Left Telemetry | Center 9-Col Shaft | Right Build & Controls */}
      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[265px_minmax(0,540px)_285px] justify-center gap-5 px-4 py-3">
        {/* Left Peripheral Telemetry */}
        <aside className="hidden lg:flex flex-col justify-between gap-4 overflow-y-auto pr-1">
          <div className="space-y-4">
            {/* Depth Panel */}
            <div className="pixel-panel p-4">
              <div className="font-pixel text-[10px] uppercase text-[#8E92A4]">Profundidad</div>
              <div className="font-display text-5xl font-bold tracking-tight tabular-nums text-white leading-none mt-1">
                {String(hud.depth).padStart(4, '0')}
                <span className="text-xl text-[#71717A] ml-1">m</span>
              </div>
              <div className="text-[11px] font-mono text-[#A1A1AA] mt-1.5">
                {mode === 'TRIAL'
                  ? trialDef
                    ? `Prueba: ${trialDef.goalDepth}m`
                    : 'Prueba Élite'
                  : mode === 'SPRINT_500'
                  ? 'Meta Sprint: 0500m'
                  : mode === 'ENDLESS'
                  ? 'Abismo Infinito'
                  : hud.depth >= 2500 || hud.inStratum6
                  ? 'Sector Final: 3500m'
                  : 'Campaña: 3500m'}
              </div>
            </div>

            {/* Segmented Oxygen & Overdrive & Dash Panel */}
            <div className="pixel-panel p-4 space-y-3.5">
              {/* Oxygen */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-pixel text-[10px] text-[#8E92A4]">OXÍGENO</span>
                  <span
                    className={`font-mono text-xs font-bold tabular-nums ${
                      isOverdriveActive
                        ? 'text-[#FACC15]'
                        : hud.inLastBreath
                        ? 'text-[#E11D48]'
                        : hud.oxygen <= 25
                        ? 'text-[#F05D4E]'
                        : 'text-[#38BDF8]'
                    }`}
                  >
                    {isOverdriveActive
                      ? 'PAUSADO'
                      : hud.inLastBreath
                      ? 'ÚLTIMO ALIENTO'
                      : hud.inStratum6
                      ? 'TECHO VIVO'
                      : `${hud.oxygen}%`}
                  </span>
                </div>
                <div className="w-full h-3 bg-[#0B0C10] border border-[#2B2D38] p-0.5">
                  <div
                    className={`h-full pixel-bar-seg transition-all duration-100 ${
                      isOverdriveActive ? 'bg-[#FACC15]' : hud.oxygen <= 25 ? 'bg-[#E11D48]' : 'bg-[#38BDF8]'
                    }`}
                    style={{ width: `${Math.min(100, (hud.oxygen / Math.max(1, hud.maxOxygen)) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Overdrive Sísmico */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-pixel text-[10px] text-[#8E92A4]">OVERDRIVE</span>
                  <span
                    className={`font-pixel text-[10px] tabular-nums ${
                      isOverdriveActive
                        ? 'text-[#FFFFFF] animate-pulse'
                        : isOverdriveReady
                        ? 'text-[#FACC15] animate-pulse'
                        : 'text-[#A1A1AA]'
                    }`}
                  >
                    {isOverdriveActive ? 'ACTIVO!' : isOverdriveReady ? 'PULSA [X]' : `${overdrivePct}%`}
                  </span>
                </div>
                <div
                  className={`w-full h-3 bg-[#0B0C10] border p-0.5 ${
                    isOverdriveActive || isOverdriveReady ? 'border-[#FACC15]' : 'border-[#2B2D38]'
                  }`}
                >
                  <div
                    className={`h-full pixel-bar-seg transition-all duration-100 ${
                      isOverdriveActive ? 'bg-[#FFFFFF]' : isOverdriveReady ? 'bg-[#FACC15]' : 'bg-[#F97316]'
                    }`}
                    style={{ width: `${overdrivePct}%` }}
                  />
                </div>
              </div>

              {/* Dash Propulsor */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-pixel text-[10px] text-[#8E92A4]">PROPULSOR</span>
                  <span className={`font-pixel text-[10px] ${hud.dashReadyRatio >= 1 ? 'text-[#A3E635]' : 'text-[#71717A]'}`}>
                    {hud.dashReadyRatio >= 1 ? 'LISTO [C]' : 'CARGA'}
                  </span>
                </div>
                <div className="w-full h-2 bg-[#0B0C10] border border-[#2B2D38]">
                  <div
                    className={`h-full transition-all duration-75 ${
                      hud.dashReadyRatio >= 1 ? 'bg-[#A3E635]' : 'bg-[#38BDF8]'
                    }`}
                    style={{ width: `${Math.round(hud.dashReadyRatio * 100)}%` }}
                  />
                </div>
              </div>

              {/* Operator Active Signature Resonance */}
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() =>
                      showHudInfo(
                        `✦ ${chassisDef.signatureName || 'RESONANCIA'} [F]`,
                        `${chassisDef.signatureDesc} (Carga con cadenas y perforación).`,
                        chassisDef.accentColor
                      )
                    }
                    className="font-pixel text-[9px] text-[#8E92A4] hover:text-white truncate text-left cursor-pointer"
                    title={chassisDef.signatureDesc}
                  >
                    ✦ {chassisDef.signatureName || 'RESONANCIA'}
                  </button>
                  {hud.resonanceCharge >= 100 ? (
                    <button
                      type="button"
                      onClick={() => simRef.current?.triggerOperatorResonance()}
                      className="pixel-badge font-pixel text-[9px] animate-pulse cursor-pointer shrink-0"
                      style={{
                        borderColor: chassisDef.accentColor,
                        color: chassisDef.accentColor,
                      }}
                    >
                      [F] ACTIVAR
                    </button>
                  ) : (
                    <span className="font-pixel text-[9px] text-[#71717A] tabular-nums shrink-0">
                      {hud.resonanceCharge}%
                    </span>
                  )}
                </div>
                <div
                  className="w-full h-2 bg-[#0B0C10] border"
                  style={{ borderColor: hud.resonanceCharge >= 100 ? chassisDef.accentColor : '#2B2D38' }}
                >
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${Math.max(0, Math.min(100, hud.resonanceCharge))}%`,
                      backgroundColor: hud.resonanceCharge >= 100 ? '#FFFFFF' : chassisDef.accentColor,
                    }}
                  />
                </div>
                <div className="text-[10px] text-[#71717A] mt-0.5 line-clamp-1">{chassisDef.signatureDesc}</div>
              </div>

              {/* Operator Active Second Tactical Ability */}
              <div>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() =>
                      showHudInfo(
                        `◈ ${chassisDef.tacticalName || 'TÁCTICA'} [G]`,
                        `${chassisDef.tacticalDesc} (Habilidad activa de recarga rápida).`,
                        '#A3E635'
                      )
                    }
                    className="font-pixel text-[9px] text-[#8E92A4] hover:text-white truncate text-left cursor-pointer"
                    title={chassisDef.tacticalDesc}
                  >
                    ◈ {chassisDef.tacticalName || 'TÁCTICA'}
                  </button>
                  {hud.tacticalReadyRatio >= 1 ? (
                    <button
                      type="button"
                      onClick={() => simRef.current?.triggerOperatorTactical()}
                      className="pixel-badge border-[#A3E635] text-[#A3E635] font-pixel text-[9px] animate-pulse cursor-pointer shrink-0"
                    >
                      [G] ACTIVAR
                    </button>
                  ) : (
                    <span className="font-pixel text-[9px] text-[#71717A] tabular-nums shrink-0">
                      {Math.round(hud.tacticalReadyRatio * 100)}%
                    </span>
                  )}
                </div>
                <div className={`w-full h-2 bg-[#0B0C10] border ${hud.tacticalReadyRatio >= 1 ? 'border-[#A3E635]' : 'border-[#2B2D38]'}`}>
                  <div
                    className="h-full transition-all duration-100"
                    style={{
                      width: `${Math.round(hud.tacticalReadyRatio * 100)}%`,
                      backgroundColor: hud.tacticalReadyRatio >= 1 ? '#A3E635' : '#4D7C0F',
                    }}
                  />
                </div>
                <div className="text-[10px] text-[#71717A] mt-0.5 line-clamp-1">{chassisDef.tacticalDesc}</div>
              </div>
            </div>

            {hud.guardian && (
              <div className="pixel-panel p-3.5 border-[#E11D48] bg-[#241016]">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-pixel text-[10px] text-[#FDA4AF]">GUARDIÁN ACTIVO</div>
                  {hud.guardianPhase === 2 && (
                    <span className="pixel-badge border-[#FACC15] text-[#FACC15] animate-pulse">FASE 2</span>
                  )}
                </div>
                <div className="font-display text-2xl font-bold text-white mt-0.5">{hud.guardian.name}</div>
                <div className="w-full h-2.5 bg-[#0B0C10] border border-[#E11D48]/50 mt-2 p-0.5">
                  <div
                    className="h-full bg-[#E11D48] pixel-bar-seg"
                    style={{ width: `${(hud.guardian.hp / hud.guardian.maxHp) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Score & Telemetry Matrix */}
            <div className="pixel-panel p-4 grid grid-cols-2 gap-y-3 gap-x-3">
              <div>
                <div className="font-pixel text-[9px] text-[#71717A]">PUNTOS</div>
                <div className="font-mono text-base font-bold tabular-nums text-white mt-0.5">
                  {hud.score.toLocaleString('es-ES')}
                </div>
              </div>
              <div>
                <div className="font-pixel text-[9px] text-[#71717A]">COMBO</div>
                <div className="font-mono text-base font-bold tabular-nums text-[#FACC15] mt-0.5">
                  ×{hud.comboMultiplier}
                  {hud.comboCount > 0 && <span className="text-[11px] text-[#71717A] ml-1">({hud.comboCount})</span>}
                </div>
              </div>
              <div>
                <div className="font-pixel text-[9px] text-[#71717A]">CADENA MÁX</div>
                <div className="font-mono text-base font-bold tabular-nums text-white mt-0.5">×{hud.maxChain}</div>
              </div>
              <div>
                <div className="font-pixel text-[9px] text-[#71717A]">CORTES</div>
                <div className="font-mono text-base font-bold tabular-nums text-[#38BDF8] mt-0.5">{hud.parries}</div>
              </div>
              <div>
                <div className="font-pixel text-[9px] text-[#71717A]">ISÓTOPOS</div>
                <div className="font-mono text-base font-bold tabular-nums text-[#FBBF24] mt-0.5">
                  {hud.isotopes + hud.isotopesBanked}
                </div>
              </div>
              <div>
                <div className="font-pixel text-[9px] text-[#71717A]">PRESIÓN</div>
                <div className="font-mono text-xs font-bold tabular-nums text-[#FB923C] mt-1">
                  {hud.speedMult.toFixed(2)}× · +{hud.densityPct}%
                </div>
              </div>
            </div>

            {/* Tactical Belt [1] [2] [3] */}
            <div className="pixel-panel p-3 space-y-2">
              <div className="flex items-center justify-between font-pixel text-[9px] text-[#8E92A4]">
                <span>CINTURÓN TÁCTICO</span>
                <span className="font-mono text-[#38BDF8]">[1 / 2 / 3]</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((slot) => {
                  const gid = hud.belt[slot];
                  const g = gid ? GADGETS.find((x) => x.id === gid) : null;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={!g}
                      title={g ? `${g.name}: ${g.desc}` : `Ranura ${slot + 1} vacía`}
                      onClick={() => simRef.current?.useBeltGadget(slot)}
                      className={`p-1.5 border text-left transition-all flex flex-col justify-between min-h-[46px] ${
                        g
                          ? 'bg-[#121622] hover:brightness-125 cursor-pointer'
                          : 'border-[#232530] bg-[#0B0C10] opacity-55 cursor-default'
                      }`}
                      style={{ borderColor: g ? g.color : '#232530' }}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-[#71717A]">[{slot + 1}]</span>
                        <span style={{ color: g ? g.color : '#52525B' }}>{g ? g.glyph : '·'}</span>
                      </div>
                      <div className="font-pixel text-[9px] text-white truncate mt-0.5">
                        {g ? g.shortCode : 'VACÍO'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pixel-panel p-3.5 text-xs text-[#A1A1AA] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-base font-bold text-white">{chassisDef.name}</span>
              <span className="font-pixel text-[10px] text-[#FACC15] tabular-nums">NIV.{archive.rigLevel || 1}</span>
            </div>
            <div className="font-mono text-[10px] text-[#71717A] tabular-nums">
              B{rigUpgrades.drillTier} · I{rigUpgrades.thrusterTier} · O{rigUpgrades.tankTier} · BL{rigUpgrades.armorTier} · C
              {rigUpgrades.capacitorTier} · M{rigUpgrades.magnetTier}
              {hud.shields > 0 ? ` · ⛨${hud.shields}` : ''}
            </div>
            {hud.equippedRelics.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {hud.equippedRelics.map((rid) => {
                  const r = RELICS.find((x) => x.id === rid);
                  return (
                    <span
                      key={rid}
                      title={r?.desc}
                      className="px-1.5 py-0.5 border text-[9px] font-mono bg-[#14151D]"
                      style={{ borderColor: r?.color || '#FACC15', color: r?.color || '#FACC15' }}
                    >
                      {r?.glyph} {r?.code}
                    </span>
                  );
                })}
              </div>
            )}
            {earnedMaterialsList.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-[#232530]">
                {earnedMaterialsList.map((m) => (
                  <div key={m.id} className="flex items-center gap-1 font-mono text-[10px] text-white" title={m.name}>
                    <MaterialMiniIcon matId={m.id} size={14} />
                    <span className="tabular-nums">+{hud.materialsEarned[m.id]}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-0.5 flex items-center justify-between font-mono text-[11px]">
              <span className="text-[#71717A]">Taladro:</span>
              <span className={hud.aimDir === 'DOWN' ? 'text-[#D4D4D8]' : 'text-[#FACC15] font-semibold'}>
                {aimLabels[hud.aimDir]}
              </span>
            </div>
            {(hud.hasAlpha || hud.hasLance) && (
              <div className="text-[#FACC15] pt-0.5 font-pixel text-[10px]">
                {hud.hasLance ? '★ LANZA DE SINGULARIDAD' : '◆ FRAGMENTO ALFA'}
              </div>
            )}
          </div>
        </aside>

        {/* Center 9-Column Shaft Canvas */}
        <div className="relative flex flex-col items-center justify-center min-h-0 h-full">
          {/* Mobile compact telemetry bar */}
          <div className="lg:hidden w-full flex items-center justify-between px-2 py-1.5 text-xs font-mono tabular-nums border-b-2 border-[#262834] mb-1 bg-[#12131A]">
            <span className="font-bold text-white">{String(hud.depth).padStart(4, '0')}m</span>
            <span className="text-white">{hud.score.toLocaleString('es-ES')} pts</span>
            <span className={hud.overdrive >= 100 ? 'text-[#FACC15]' : 'text-[#A1A1AA]'}>
              OD {overdrivePct}%
            </span>
            <span className={hud.oxygen <= 25 ? 'text-[#E11D48]' : 'text-[#38BDF8]'}>O₂ {hud.oxygen}%</span>
          </div>

          <div
            ref={canvasFrameRef}
            className="relative w-full h-full max-w-[520px] border-2 border-[#2B2D38] bg-[#0B0C10] overflow-hidden shadow-[0_6px_0_#06070B] will-change-transform"
          >
            <canvas
              ref={canvasRef}
              onMouseMove={handleCanvasPointerMove}
              onMouseDown={handleCanvasMouseDown}
              onMouseLeave={() => {
                hoveredCellRef.current = null;
              }}
              onClick={handleCanvasClick}
              onContextMenu={handleCanvasContextMenu}
              onTouchStart={handleCanvasTouchStart}
              onTouchMove={handleCanvasTouchMove}
              onTouchEnd={handleCanvasTouchEnd}
              onTouchCancel={handleCanvasTouchEnd}
              className="w-full h-full block cursor-crosshair pixel-canvas touch-game-surface"
            />

            {/* Top-Right Non-Blocking Detonate Pill on Mobile Viewport */}
            {!paused && !summary && !hud.pendingStory && hud.hasIgniting && (
              <div className="lg:hidden absolute top-2 right-2 z-20 pointer-events-auto">
                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    simRef.current?.triggerForceDetonate();
                  }}
                  onClick={() => simRef.current?.triggerForceDetonate()}
                  className="pixel-btn px-3 py-1.5 border-[#FB923C] bg-[#24130C]/95 font-pixel text-[10px] text-[#FED7AA] shadow-lg animate-pulse"
                >
                  DETONAR 🔥
                </button>
              </div>
            )}

            {/* Unobtrusive 3-Step Guided Tutorial Directive Banner */}
            {hud.tutorialStep > 0 && !paused && !summary && (
              <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
                <div className="pixel-panel px-4 py-3 flex items-start justify-between gap-4 bg-[#12131A]/95">
                  <div className="space-y-1 min-w-0">
                    <div className="font-pixel text-[10px] text-[#FACC15] tabular-nums">
                      TUTORIAL {hud.tutorialStep}/3 · OXÍGENO EN PAUSA
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-white leading-snug">
                      {hud.tutorialStep === 1 &&
                        `Pulsa ${formatActionKeys(keyBindings, 'drill')} (o toca el bloque marcado) para perforar y caer al siguiente nivel.`}
                      {hud.tutorialStep === 2 &&
                        `Pulsa ${formatActionKeys(keyBindings, 'swapLeft')} / ${formatActionKeys(keyBindings, 'swapRight')} (o arrastra el bloque) para alinear 4 iguales. Detonará en 1,2 s o con ${formatActionKeys(keyBindings, 'detonate')}.`}
                      {hud.tutorialStep === 3 &&
                        'Desciende por el hueco para recoger la cápsula de O₂ (+20%). Después el pozo queda bajo tu control.'}
                    </div>
                  </div>
                  <button
                    onClick={() => simRef.current?.skipTutorial()}
                    className="pixel-btn pointer-events-auto shrink-0 px-2.5 py-1 text-[10px] font-pixel text-[#D4D4D8] hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    Saltar
                  </button>
                </div>
              </div>
            )}

            {/* Artifact Proximity Radar & Discovery Toast */}
            {!paused && !summary && !hud.pendingStory && (
              <>
                {hud.artifactNearby && !hud.recentArtifactBanner && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none">
                    <div className="px-3 py-1 border-2 border-[#FACC15] bg-[#1E1A0E]/92 font-pixel text-[9px] text-[#FACC15] animate-pulse shadow-[0_0_16px_rgba(250,204,21,0.35)] whitespace-nowrap">
                      ✦ SEÑAL DE ARTEFACTO CERCA
                    </div>
                  </div>
                )}
                {hud.recentArtifactBanner && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[380px] z-20 pointer-events-none select-none">
                    <div
                      className="pixel-panel bg-[#12131A]/96 px-3.5 py-2.5 flex items-center gap-3"
                      style={{
                        borderColor: hud.recentArtifactBanner.color,
                        boxShadow: `0 0 22px ${hud.recentArtifactBanner.color}55`,
                      }}
                    >
                      <ArtifactMiniIcon artifactId={hud.recentArtifactBanner.id} size={28} />
                      <div className="min-w-0 flex-1">
                        <div className="font-pixel text-[9px]" style={{ color: hud.recentArtifactBanner.color }}>
                          ARTEFACTO RECUPERADO · {hud.recentArtifactBanner.rarity}
                        </div>
                        <div className="font-display text-lg font-bold text-white leading-tight truncate">
                          {hud.recentArtifactBanner.name}
                        </div>
                        <div className="font-mono text-[11px] text-[#A3E635] truncate">
                          {hud.recentArtifactBanner.bonusText}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 500m Biome Transition Horizon Banner */}
            {biomeBanner && !paused && !summary && hud.tutorialStep === 0 && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[calc(100%-24px)] max-w-[380px] z-10 pointer-events-none select-none">
                <div
                  className="pixel-panel bg-[#12131A]/95 px-4 py-2.5"
                  style={{
                    borderColor: biomeBanner.primaryColor,
                    boxShadow: `0 0 22px ${biomeBanner.primaryColor}44`,
                  }}
                >
                  <div
                    className="h-1 w-full mb-2"
                    style={{
                      background: `linear-gradient(90deg, ${biomeBanner.primaryColor}, ${biomeBanner.secondaryColor})`,
                    }}
                  />
                  <div className="flex items-center justify-between gap-2 font-pixel text-[10px] uppercase text-[#D4D4D8] tabular-nums">
                    <span>HORIZONTE DE BIOMA</span>
                    <span style={{ color: biomeBanner.primaryColor }}>{biomeBanner.depth}m</span>
                  </div>
                  <div className="font-display text-2xl font-bold text-white leading-tight mt-0.5">
                    {biomeBanner.name}
                  </div>
                  <div className="text-xs text-[#A1A1AA] mt-0.5 leading-snug">{biomeBanner.subtitle}</div>
                </div>
              </div>
            )}

            {/* Scaling & Glowing Pixel Combo Meter Overlay */}
            {!paused && !summary && (
              <div
                className="absolute bottom-3 left-3 z-10 pointer-events-none select-none origin-bottom-left transition-all duration-150"
                style={{ transform: `scale(${comboScale.toFixed(3)})` }}
              >
                <div
                  className="pixel-panel bg-[#12131A]/92 px-3 py-2 min-w-[144px] transition-colors duration-150"
                  style={{
                    borderColor: activeMult > 1 ? comboGlowColor : '#2B2D38',
                    boxShadow:
                      activeMult > 1
                        ? `0 0 ${comboGlowPx}px ${comboGlowColor}55, 0 3px 0 #08090D`
                        : '0 3px 0 #08090D',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-pixel text-[9px] text-[#A1A1AA]">COMBO</span>
                    <span className="font-mono text-[10px] tabular-nums text-[#D4D4D8]">
                      {hud.comboCount > 0 ? `${hud.comboCount} bloq.` : 'ESPERA'}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3 mt-0.5">
                    <div
                      className="font-display text-3xl font-bold leading-none tabular-nums"
                      style={{
                        color: activeMult >= 8 ? '#FFFFFF' : activeMult > 1 ? comboGlowColor : '#E4E4E7',
                        textShadow: activeMult > 1 ? `0 0 10px ${comboGlowColor}` : 'none',
                      }}
                    >
                      ×{activeMult}
                    </div>

                    <div className="flex flex-col items-end gap-1 pb-0.5">
                      <span className="font-pixel text-[8px] text-[#A1A1AA] tabular-nums">
                        {activeMult >= 12 ? 'MÁX' : `SIG ×${activeMult + 1}`}
                      </span>
                      <div className="flex items-center gap-1">
                        {[0, 1].map((pipIdx) => {
                          const lit = hud.comboCount > 0 && pipIdx < tierStepsFilled;
                          return (
                            <span
                              key={pipIdx}
                              className="w-3 h-1.5"
                              style={{ backgroundColor: lit ? comboGlowColor : '#27272A' }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="w-full h-1.5 bg-[#09090B] mt-1.5 overflow-hidden">
                    <div
                      className="h-full transition-[width] duration-75"
                      style={{
                        width: `${Math.round(hud.comboTimerRatio * 100)}%`,
                        backgroundColor: activeMult > 1 ? comboGlowColor : '#52525B',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Rich Interactive Breach Cards (aligned with the 3 gates) */}
            {hud.activeBreach && !paused && !summary && !hud.pendingStory && !biomeBanner && (
              <div className="absolute top-2.5 left-2.5 right-2.5 z-10 pointer-events-none select-none space-y-1.5">
                <div className="flex items-center justify-between px-2 py-1 pixel-panel bg-[#0E1018]/92">
                  <span className="font-pixel text-[9px] text-[#38BDF8]">
                    BRECHA {hud.activeBreach.yRow}m · PICA BAJO TU ELECCIÓN
                  </span>
                  {hud.rerolls > 0 && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))}
                      className="pointer-events-auto pixel-btn px-2 py-0.5 font-pixel text-[9px] text-[#FACC15] cursor-pointer"
                    >
                      [R] RE-CALIBRAR ({hud.rerolls})
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {hud.activeBreach.options.map((opt, idx) => {
                    const mod = opt.isOvercharge ? null : MODULES.find((m) => m.id === opt.moduleId);
                    const oc = opt.isOvercharge ? OVERCHARGES.find((o) => o.id === opt.moduleId) : null;
                    const archCol = opt.isOvercharge
                      ? '#E11D48'
                      : mod
                      ? ARCHETYPE_COLORS[mod.archetype]
                      : '#38BDF8';
                    const synCount = mod ? archCounts[mod.archetype] || 0 : 0;
                    return (
                      <div
                        key={`${opt.moduleId}-${idx}`}
                        className="pixel-panel bg-[#0E1018]/95 p-2 space-y-1"
                        style={{ borderColor: archCol }}
                      >
                        <div className="flex items-center justify-between gap-1 text-[9px] font-pixel">
                          <span style={{ color: archCol }}>
                            {opt.isOvercharge ? 'SOBRECARGA' : opt.isUpgrade ? 'MK-II' : mod?.archetype || 'MÓDULO'}
                          </span>
                          {mod && synCount > 0 && (
                            <span className="text-[#A3E635]">
                              {synCount}→{synCount + 1}
                            </span>
                          )}
                        </div>
                        <div className="font-display text-xs font-bold text-white leading-tight truncate">
                          {mod ? `${mod.glyph} ${mod.name}` : oc ? `${oc.glyph} ${oc.name}` : opt.moduleId}
                        </div>
                        <div className="text-[10px] text-[#D4D4D8] leading-snug line-clamp-2">
                          {mod ? (opt.isUpgrade ? mod.mk2Desc : mod.shortDesc) : oc ? oc.benefit : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rich Bifurcation Decision Cards */}
            {hud.activeBifurcation && !paused && !summary && !hud.pendingStory && !biomeBanner && !hud.activeBreach && (
              <div className="absolute top-2.5 left-2.5 right-2.5 z-10 pointer-events-none select-none space-y-1">
                <div className="px-2 py-1 pixel-panel bg-[#0E1018]/92 font-pixel text-[9px] text-[#FACC15] text-center">
                  BIFURCACIÓN {hud.activeBifurcation.yRow}m · ELIGE LADO IZQUIERDO O DERECHO
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="pixel-panel bg-[#0E1018]/95 p-2.5 border-[#4AC6E8]">
                    <div className="font-pixel text-[9px] text-[#4AC6E8]">◀ RUTA IZQUIERDA</div>
                    <div className="font-display text-sm font-bold text-white mt-0.5">
                      {hud.activeBifurcation.leftTitle}
                    </div>
                    <div className="text-[10px] text-[#D4D4D8] mt-0.5">{hud.activeBifurcation.leftDesc}</div>
                  </div>
                  <div className="pixel-panel bg-[#0E1018]/95 p-2.5 border-[#FBBF24]">
                    <div className="font-pixel text-[9px] text-[#FBBF24]">RUTA DERECHA ▶</div>
                    <div className="font-display text-sm font-bold text-white mt-0.5">
                      {hud.activeBifurcation.rightTitle}
                    </div>
                    <div className="text-[10px] text-[#D4D4D8] mt-0.5">{hud.activeBifurcation.rightDesc}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Environmental Hazard Banner */}
            {hud.activeHazard && !paused && !summary && !hud.pendingStory && !biomeBanner && hud.tutorialStep === 0 && (
              <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none select-none max-w-[260px]">
                <div
                  className="pixel-panel px-3 py-1.5 bg-[#12131A]/92 flex items-center gap-2"
                  style={{ borderColor: hud.activeHazard.color }}
                >
                  <span
                    className={`w-2 h-2 shrink-0 ${hud.activeHazard.warningTimer > 0 ? 'animate-ping' : 'animate-pulse'}`}
                    style={{ backgroundColor: hud.activeHazard.color }}
                  />
                  <div className="min-w-0">
                    <div className="font-pixel text-[9px] truncate" style={{ color: hud.activeHazard.color }}>
                      {hud.activeHazard.warningTimer > 0 ? '⚠ ALERTA SÍSMICA' : '⚡ PELIGRO ACTIVO'}
                    </div>
                    <div className="text-[11px] font-bold text-white truncate">{hud.activeHazard.label}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Ambient Non-Blocking Radio Ticker */}
            {hud.activeTicker && !hud.pendingStory && !paused && !summary && (
              <div className="absolute bottom-3 right-3 z-10 pointer-events-none select-none max-w-[265px]">
                <div
                  className="pixel-panel bg-[#101119]/92 px-2.5 py-2 flex items-start gap-2.5"
                  style={{ borderColor: hud.activeTicker.color }}
                >
                  <PortraitCanvas speaker={hud.activeTicker.speaker} frame={0} size={32} />
                  <div className="min-w-0">
                    <div className="font-pixel text-[8px] truncate" style={{ color: hud.activeTicker.color }}>
                      {hud.activeTicker.name}
                    </div>
                    <div className="text-[11px] text-[#E4E4E7] leading-snug line-clamp-2 mt-0.5">
                      {hud.activeTicker.text}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Interactive Pixel-Art Story Dialogue Modal */}
            {hud.pendingStory && !paused && !summary && (() => {
              const st = hud.pendingStory;
              const profile = SPEAKER_PROFILES[st.speaker] || SPEAKER_PROFILES.VANCE;
              const totalLen = st.lines.join('\n').length;
              const isTyping = storyRevealChars < totalLen;
              let rem = storyRevealChars;
              const revealedLines = st.lines.map((line) => {
                if (rem <= 0) return '';
                const s = line.slice(0, rem);
                rem -= s.length + 1;
                return s;
              });
              return (
                <div
                  className="absolute inset-0 bg-[#0B0C10]/75 story-scanlines z-20 overflow-y-auto"
                  onClick={() => {
                    if (isTyping) {
                      completeStoryText(totalLen);
                    }
                  }}
                >
                  <div className="min-h-full flex items-end sm:items-center justify-center p-3 sm:p-5">
                    <div
                      className="pixel-panel max-w-md w-full p-4 sm:p-5 space-y-3 bg-[#11131C]/98"
                      style={{
                        borderColor: profile.color,
                        boxShadow: `0 0 24px ${profile.color}33, 0 6px 0 #06070B`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isTyping) {
                          completeStoryText(totalLen);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3.5">
                        <PortraitCanvas speaker={st.speaker} frame={portraitFrame} size={64} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <span className="font-pixel text-[10px] font-bold" style={{ color: profile.color }}>
                              {profile.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[9px] text-[#71717A]">{profile.freq}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  completeStoryText(totalLen);
                                  if (!(st.choices && st.choices.length > 0)) {
                                    simRef.current?.resolvePendingStory();
                                  }
                                }}
                                className="pixel-btn px-2 py-0.5 font-pixel text-[8px] text-[#D4D4D8] hover:text-white cursor-pointer"
                              >
                                {st.choices && st.choices.length > 0 ? 'VER TODO ⏭' : 'OMITIR ⏭'}
                              </button>
                            </div>
                          </div>
                          <div className="text-[10px] text-[#8E92A4]">{profile.title}</div>
                          <div className="font-display text-lg font-bold text-white leading-tight mt-1">{st.title}</div>
                        </div>
                      </div>

                      <div className="space-y-2 border-y-2 border-[#232530] py-3 text-xs sm:text-sm text-[#E4E4E7] leading-relaxed min-h-[72px]">
                        {revealedLines.map((ln, idx) =>
                          ln ? (
                            <p key={idx}>
                              {ln}
                              {isTyping && idx === revealedLines.findIndex((x, k) => k === revealedLines.length - 1 || !revealedLines[k + 1]) ? (
                                <span className="inline-block w-1.5 h-3.5 bg-[#FACC15] ml-1 align-middle animate-pulse" />
                              ) : null}
                            </p>
                          ) : null
                        )}
                      </div>

                      {st.choices && st.choices.length > 0 ? (
                        <div className="space-y-2">
                          <div className="font-pixel text-[9px] text-[#FACC15]">DECISIÓN DE CAMPAÑA [1 / 2]</div>
                          <div className="space-y-2">
                            {st.choices.map((ch, idx) => (
                              <button
                                key={ch.id}
                                onClick={() => {
                                  completeStoryText(totalLen);
                                  simRef.current?.resolvePendingStory(ch.id);
                                }}
                                className="w-full p-2.5 text-left border-2 border-[#2B2D38] bg-[#161822] hover:border-[#FACC15] hover:bg-[#1E1A12] transition-all cursor-pointer space-y-0.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-xs text-white">
                                    [{idx + 1}] {ch.label}
                                  </span>
                                  {ch.tag && (
                                    <span className="pixel-badge border-[#38BDF8]/60 text-[#38BDF8]">{ch.tag}</span>
                                  )}
                                </div>
                                <div className="font-mono text-[11px] text-[#A3E635]">{ch.rewardText}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <span className="font-mono text-[10px] text-[#71717A]">
                            {isTyping ? 'Clic para completar texto' : 'Transmisión recibida'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isTyping) {
                                completeStoryText(totalLen);
                              } else {
                                simRef.current?.resolvePendingStory();
                              }
                            }}
                            className="pixel-btn-primary px-4 py-1.5 font-pixel text-[10px] font-bold text-white cursor-pointer"
                          >
                            {isTyping ? 'VER TODO' : 'CONTINUAR [ESPACIO]'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Pause Modal Overlay */}
            {paused && !summary && (
              <div className="absolute inset-0 bg-[#0E0F14]/92 z-30 overflow-y-auto">
                <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
                  <div className="pixel-panel max-w-sm mx-auto w-full p-6 space-y-5">
                  <div>
                    <div className="font-pixel text-[10px] text-[#FACC15] tabular-nums">
                      {String(hud.depth).padStart(4, '0')}m · {hud.stratumName}
                    </div>
                    <h2 className="font-display text-4xl font-bold text-white mt-1">Descenso en pausa</h2>
                  </div>

                  {/* Quick Audio & Visual Settings inside Pause */}
                  <div className="border-t-2 border-[#232530] pt-3 space-y-2.5">
                    <div className="font-pixel text-[10px] text-[#8E92A4]">AJUSTES DE AUDIO Y VISUALES</div>
                    {onUpdateVisualSettings && (
                      <div className="space-y-2 text-[11px] font-mono">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[#A1A1AA] w-16 shrink-0">Música</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round((visualSettings.musicVolume ?? 0.78) * 100)}
                            onChange={(e) =>
                              onUpdateVisualSettings({
                                ...visualSettings,
                                musicVolume: Number(e.target.value) / 100,
                              })
                            }
                            className="flex-1 accent-[#FACC15] cursor-pointer"
                          />
                          <span className="text-white w-9 text-right tabular-nums">
                            {Math.round((visualSettings.musicVolume ?? 0.78) * 100)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[#A1A1AA] w-16 shrink-0">Efectos</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round((visualSettings.sfxVolume ?? 0.9) * 100)}
                            onChange={(e) =>
                              onUpdateVisualSettings({
                                ...visualSettings,
                                sfxVolume: Number(e.target.value) / 100,
                              })
                            }
                            className="flex-1 accent-[#38BDF8] cursor-pointer"
                          />
                          <span className="text-white w-9 text-right tabular-nums">
                            {Math.round((visualSettings.sfxVolume ?? 0.9) * 100)}%
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={onCycleCrtMode}
                        className="pixel-btn py-1.5 px-2 text-[10px] font-pixel text-white cursor-pointer"
                      >
                        CRT: {crtLabels[visualSettings.crtMode]}
                      </button>
                      <button
                        onClick={() => {
                          if (!onUpdateVisualSettings) return;
                          const nextGlow = !visualSettings.pixelGlow;
                          onUpdateVisualSettings({ ...visualSettings, pixelGlow: nextGlow });
                        }}
                        className="pixel-btn py-1.5 px-2 text-[10px] font-pixel text-white cursor-pointer"
                      >
                        LUZ: {visualSettings.pixelGlow ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => {
                          if (!onUpdateVisualSettings) return;
                          const nextShake = visualSettings.screenShake > 0 ? 0 : 1;
                          onUpdateVisualSettings({ ...visualSettings, screenShake: nextShake });
                        }}
                        className="pixel-btn py-1.5 px-2 text-[10px] font-pixel text-white cursor-pointer"
                      >
                        SHAKE: {visualSettings.screenShake > 0 ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {onUpdateVisualSettings && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#8E92A4]">
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3 h-3 text-[#38BDF8]" />
                            Modo Táctil Móvil
                          </span>
                          <div className="grid grid-cols-2 gap-1">
                            {(
                              [
                                ['GESTURES', 'Gestual'],
                                ['HYBRID', 'Híbrido'],
                              ] as [TouchControlMode, string][]
                            ).map(([tm, label]) => (
                              <button
                                key={tm}
                                type="button"
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  onUpdateVisualSettings({ ...visualSettings, touchControlMode: tm });
                                }}
                                className={`px-2 py-1 border text-[9px] font-pixel cursor-pointer ${
                                  touchMode === tm
                                    ? 'border-[#38BDF8] bg-[#0F1B26] text-[#38BDF8]'
                                    : 'border-[#2B2D38] bg-[#14151C] text-[#A1A1AA]'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            onUpdateVisualSettings({
                              ...visualSettings,
                              swipeDownDrill: visualSettings.swipeDownDrill === false,
                            });
                          }}
                          className="pixel-btn w-full py-1 px-2 text-[9px] font-pixel flex items-center justify-between text-[#D4D4D8] cursor-pointer"
                        >
                          <span>Deslizar ↓ Picar abajo</span>
                          <span className={visualSettings.swipeDownDrill !== false ? 'text-[#F97316]' : 'text-[#71717A]'}>
                            {visualSettings.swipeDownDrill !== false ? 'ON' : 'OFF'}
                          </span>
                        </button>
                      </div>
                    )}
                    {onUpdateKeyBindings && onUpdateVisualSettings && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setShowGuide(true);
                          }}
                          className="pixel-btn w-full py-1.5 px-3 text-[10px] font-pixel text-[#A3E635] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          Manual Táctico (Guía Animada)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playUiClick();
                            setControlsModalSection('KEYBOARD');
                          }}
                          className="pixel-btn w-full py-1.5 px-3 text-[10px] font-pixel text-[#FACC15] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Keyboard className="w-3.5 h-3.5" />
                          Editor de Teclas y Controles
                        </button>
                      </>
                    )}
                  </div>

                  {/* Ficha Táctica del Operador */}
                  <div className="space-y-1.5 border-t-2 border-[#232530] pt-3 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-pixel text-[9px] text-[#38BDF8]">FICHA TÁCTICA · {chassisDef.callsign}</span>
                      <span className="font-mono text-[10px] text-[#8E92A4]">{chassisDef.role}</span>
                    </div>
                    <div className="p-2 bg-[#0E1017] border border-[#232530] space-y-1">
                      <div className="text-[#D4D4D8]">
                        <strong style={{ color: chassisDef.accentColor }}>{chassisDef.traitTitle}:</strong> {chassisDef.traitDesc}
                      </div>
                      <div className="text-[#BAE6FD]">
                        <strong style={{ color: chassisDef.accentColor }}>✦ {chassisDef.signatureName || 'Resonancia'} [F]:</strong>{' '}
                        {chassisDef.signatureDesc}
                      </div>
                      <div className="text-[#BEF264]">
                        <strong className="text-[#A3E635]">◈ {chassisDef.tacticalName || 'Táctica'} [G]:</strong>{' '}
                        {chassisDef.tacticalDesc}
                      </div>
                      {hud.belt.some(Boolean) && (
                        <div className="pt-1 border-t border-[#232530] space-y-0.5">
                          <div className="font-pixel text-[8px] text-[#FACC15]">CINTURÓN [1 / 2 / 3]</div>
                          {hud.belt.map((gid, slot) => {
                            const g = gid ? GADGETS.find((x) => x.id === gid) : null;
                            if (!g) return null;
                            return (
                              <div key={slot} className="text-[10px] text-[#D4D4D8]">
                                <span style={{ color: g.color }}>[{slot + 1}] {g.glyph} {g.name}:</span> {g.desc}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {hud.modules.length > 0 && (
                    <div className="space-y-2 border-t-2 border-[#232530] pt-3">
                      <div className="font-pixel text-[10px] text-[#8E92A4]">MÓDULOS ACOPLADOS</div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {hud.modules.map((m, idx) => {
                          const def = MODULES.find((d) => d.id === m.id);
                          if (!def) return null;
                          return (
                            <div key={`${m.id}-${idx}`} className="p-2 border border-[#2B2D38] bg-[#181A22] text-xs">
                              <div className="flex items-center justify-between font-semibold text-white">
                                <span>
                                  {def.glyph} {def.name} {m.mk2 ? 'MK-II' : ''}
                                </span>
                                <span style={{ color: ARCHETYPE_COLORS[def.archetype] }}>{def.archetype}</span>
                              </div>
                              <p className="text-[#A1A1AA] mt-0.5">{m.mk2 ? def.mk2Desc : def.shortDesc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2.5 pt-1">
                    <button
                      onClick={togglePause}
                      className="pixel-btn-primary w-full py-2.5 px-4 text-white font-pixel text-xs font-bold cursor-pointer"
                    >
                      Reanudar descenso
                    </button>
                    <button
                      onClick={onRestartRun}
                      className="pixel-btn w-full py-2.5 px-4 text-white font-pixel text-xs cursor-pointer"
                    >
                      Reiniciar semilla
                    </button>
                    <button
                      onClick={onExitToTitle}
                      className="w-full py-2 px-4 text-[#A1A1AA] hover:text-white text-xs font-pixel transition-colors cursor-pointer"
                    >
                      Abandonar pozo
                    </button>
                  </div>
                </div>
                </div>
              </div>
            )}

            {/* Run Summary / Black Box Overlay */}
            {summary && (() => {
              const finalMats = summary.materialsEarned || hud.materialsEarned;
              const matDrops = MATERIALS.filter((m) => (finalMats[m.id] || 0) > 0);
              const peakRank = summary.peakStyleRank || hud.peakStyleRank;
              const affordableNow: string[] = [];
              for (const u of RIG_UPGRADES) {
                const cur = rigUpgrades[u.key] ?? 0;
                if (cur < 5 && archive.isotopes >= u.costs[cur]) {
                  affordableNow.push(`${u.name} Nv.${cur + 1}`);
                }
              }
              for (const r of RELICS) {
                if ((archive.craftedRelics || []).includes(r.id)) continue;
                const matOk = Object.entries(r.matCost).every(
                  ([k, v]) => (archive.materials?.[k as MaterialId] || 0) >= (v || 0)
                );
                if (matOk && archive.isotopes >= r.isoCost) {
                  affordableNow.push(`Reliquia: ${r.name}`);
                }
              }
              return (
              <div className="absolute inset-0 bg-[#0E0F14]/95 z-40 overflow-y-auto">
                <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
                  <div className="pixel-panel max-w-md mx-auto w-full p-6 space-y-4">
                    <div>
                      <div className="font-pixel text-[10px] text-[#FACC15]">
                        {summary.victory ? 'SECUENCIA COMPLETADA' : `CAJA NEGRA · ${summary.causeOfDeath}`}
                      </div>
                      <h2 className="font-display text-4xl font-bold text-white mt-1">
                        {summary.secretEnding
                          ? 'Núcleo Inconexo Alcanzado'
                          : summary.victory && mode === 'TRIAL'
                          ? '¡Prueba Élite Superada!'
                          : summary.victory
                          ? 'Descenso Completado'
                          : `Señal perdida a ${summary.depthMeters}m`}
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 py-3.5 border-y-2 border-[#232530] font-mono tabular-nums">
                      <div>
                        <div className="font-pixel text-[9px] text-[#71717A]">PROFUNDIDAD</div>
                        <div className="text-2xl font-bold text-white">
                          {summary.depthMeters}m <span className="text-xs text-[#A1A1AA] font-normal">· {summary.durationSeconds}s</span>
                        </div>
                      </div>
                      <div>
                        <div className="font-pixel text-[9px] text-[#71717A]">PUNTOS / COMBO</div>
                        <div className="text-2xl font-bold text-[#FACC15]">
                          {hud.score.toLocaleString('es-ES')} <span className="text-xs text-white font-normal">· ×{hud.maxComboMultiplier}</span>
                        </div>
                      </div>
                      <div>
                        <div className="font-pixel text-[9px] text-[#71717A]">CADENA / ESTILO</div>
                        <div className="text-lg font-semibold text-white">
                          ×{summary.maxChain} / {summary.parries}
                          <span className="ml-2 font-pixel text-xs" style={{ color: styleColors[peakRank] }}>
                            {peakRank}
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="font-pixel text-[9px] text-[#71717A]">BOTÍN RECUPERADO</div>
                        <div className="text-lg font-semibold text-[#FBBF24]">
                          +{summary.isotopesSaved} ISO
                          {summary.xpEarned ? <span className="text-[#38BDF8] ml-2">+{summary.xpEarned} XP</span> : null}
                        </div>
                      </div>
                    </div>

                    {matDrops.length > 0 && (
                      <div className="p-3 border-2 border-[#38BDF8]/40 bg-[#0F172A]/60 space-y-1.5">
                        <div className="font-pixel text-[9px] text-[#38BDF8]">MATERIALES RECOLECTADOS</div>
                        <div className="flex flex-wrap gap-2.5">
                          {matDrops.map((m) => (
                            <div key={m.id} className="flex items-center gap-1.5 text-xs font-mono text-white">
                              <MaterialMiniIcon matId={m.id} size={16} />
                              <span className="text-[#A1A1AA]">{m.name}:</span>
                              <span className="font-bold text-[#FACC15]">+{finalMats[m.id]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(summary.discoveredArtifacts?.length || 0) > 0 && (
                      <div className="p-3 border-2 border-[#FACC15]/70 bg-[#1E1A0E]/80 space-y-1.5">
                        <div className="font-pixel text-[9px] text-[#FACC15]">ARTEFACTOS DEL ARQUITECTO ENCONTRADOS</div>
                        <div className="flex flex-wrap gap-2.5">
                          {(summary.discoveredArtifacts || []).map((artId) => {
                            const art = ARTIFACTS.find((a) => a.id === artId);
                            if (!art) return null;
                            return (
                              <div key={artId} className="flex items-center gap-1.5 text-xs font-mono text-white">
                                <ArtifactMiniIcon artifactId={artId} size={18} />
                                <span style={{ color: art.color }} className="font-bold">
                                  {art.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {summary.newUnlocks.length > 0 && (
                      <div className="p-3 border-2 border-[#A3E635]/60 bg-[#A3E635]/10 space-y-1">
                        <div className="font-pixel text-[10px] text-[#A3E635]">NUEVOS DESBLOQUEOS</div>
                        {summary.newUnlocks.map((u) => (
                          <div key={u} className="text-xs text-white">
                            ★ {u}
                          </div>
                        ))}
                      </div>
                    )}

                    {affordableNow.length > 0 && (
                      <div className="p-3 border-2 border-[#FACC15]/60 bg-[#FACC15]/10 space-y-1">
                        <div className="font-pixel text-[10px] text-[#FACC15]">¡LISTO EN LA TIENDA ({affordableNow.length})!</div>
                        {affordableNow.slice(0, 3).map((item) => (
                          <div key={item} className="text-xs text-white font-mono">
                            → {item}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <button
                        onClick={onRestartRun}
                        className="pixel-btn-primary flex-1 py-2.5 px-4 text-white font-pixel text-xs font-bold flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Jugar de nuevo
                      </button>
                      <button
                        onClick={onGoToArchive}
                        className="pixel-btn-gold flex-1 py-2.5 px-4 text-white font-pixel text-xs font-bold cursor-pointer whitespace-nowrap"
                      >
                        Tienda de Equipo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })()}
          </div>

          {/* Non-Blocking Interactive HUD Ability / UI Explainer Strip */}
          {hudInfoBanner && !paused && !summary && (
            <div
              className="w-full max-w-[520px] pt-1.5 shrink-0 cursor-pointer"
              onClick={() => setHudInfoBanner(null)}
            >
              <div
                className="px-3 py-1.5 bg-[#12131A]/95 border text-[11px] leading-snug flex items-start justify-between gap-2"
                style={{ borderColor: hudInfoBanner.color }}
              >
                <div className="min-w-0">
                  <span className="font-pixel text-[9px] mr-1.5" style={{ color: hudInfoBanner.color }}>
                    {hudInfoBanner.title}:
                  </span>
                  <span className="text-[#E4E4E7]">{hudInfoBanner.desc}</span>
                </div>
                <span className="font-pixel text-[9px] text-[#71717A] shrink-0">✕</span>
              </div>
            </div>
          )}

          {/* Fixed Zero-Overlap Mobile Tactical Action Dock */}
          {!paused && !summary && (
            <div className="lg:hidden w-full max-w-[520px] pt-1.5 flex items-center justify-between gap-1.5 shrink-0 touch-game-surface">
              <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    if (isOverdriveReady) {
                      edgeQueue.current.overdrive = true;
                    } else {
                      soundEngine.playUiClick();
                      showHudInfo(
                        '⚡ OVERDRIVE SÍSMICO',
                        'Al 100% pausa el drenaje de O₂, rompe escoria de 1 golpe y perfora varios bloques seguidos.',
                        '#FACC15'
                      );
                    }
                  }}
                  onClick={() => {
                    if (isOverdriveReady) {
                      edgeQueue.current.overdrive = true;
                    } else {
                      soundEngine.playUiClick();
                      showHudInfo(
                        '⚡ OVERDRIVE SÍSMICO',
                        'Al 100% pausa el drenaje de O₂, rompe escoria de 1 golpe y perfora varios bloques seguidos.',
                        '#FACC15'
                      );
                    }
                  }}
                  className={`relative overflow-hidden pixel-btn px-2 py-1.5 font-pixel text-[9px] shrink-0 cursor-pointer ${
                    isOverdriveReady
                      ? 'border-[#FACC15] text-[#FACC15] animate-pulse'
                      : isOverdriveActive
                        ? 'border-[#FFFFFF] text-white'
                        : 'border-[#2B2D38] text-[#A1A1AA]'
                  }`}
                >
                  <span className="absolute inset-y-0 left-0 bg-[#FACC15]/20" style={{ width: `${overdrivePct}%` }} />
                  <span className="relative z-10">{isOverdriveActive ? 'OVR!' : `⚡ ${overdrivePct}%`}</span>
                </button>

                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    if (hud.resonanceCharge >= 100) {
                      simRef.current?.triggerOperatorResonance();
                    } else {
                      soundEngine.playUiClick();
                      showHudInfo(
                        `✦ ${chassisDef.signatureName || 'RESONANCIA'}`,
                        `${chassisDef.signatureDesc} (Cargas con cadenas y perforación).`,
                        chassisDef.accentColor
                      );
                    }
                  }}
                  onClick={() => {
                    if (hud.resonanceCharge >= 100 && simRef.current?.triggerOperatorResonance()) return;
                    soundEngine.playUiClick();
                    showHudInfo(
                      `✦ ${chassisDef.signatureName || 'RESONANCIA'}`,
                      `${chassisDef.signatureDesc} (Cargas con cadenas y perforación).`,
                      chassisDef.accentColor
                    );
                  }}
                  className={`relative overflow-hidden pixel-btn px-2 py-1.5 font-pixel text-[9px] shrink-0 cursor-pointer ${
                    hud.resonanceCharge >= 100 ? 'animate-pulse text-white' : 'border-[#2B2D38] text-[#A1A1AA]'
                  }`}
                  style={
                    hud.resonanceCharge >= 100
                      ? { borderColor: chassisDef.accentColor, color: chassisDef.accentColor }
                      : undefined
                  }
                >
                  <span
                    className="absolute inset-y-0 left-0 opacity-25"
                    style={{ width: `${Math.min(100, hud.resonanceCharge)}%`, backgroundColor: chassisDef.accentColor }}
                  />
                  <span className="relative z-10">✦ {hud.resonanceCharge}%</span>
                </button>

                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    if (hud.tacticalReadyRatio >= 1) {
                      simRef.current?.triggerOperatorTactical();
                    } else {
                      soundEngine.playUiClick();
                      showHudInfo(
                        `◈ ${chassisDef.tacticalName || 'TÁCTICA'}`,
                        `${chassisDef.tacticalDesc} (Habilidad activa de recarga rápida).`,
                        '#A3E635'
                      );
                    }
                  }}
                  onClick={() => {
                    if (hud.tacticalReadyRatio >= 1 && simRef.current?.triggerOperatorTactical()) return;
                    soundEngine.playUiClick();
                    showHudInfo(
                      `◈ ${chassisDef.tacticalName || 'TÁCTICA'}`,
                      `${chassisDef.tacticalDesc} (Habilidad activa de recarga rápida).`,
                      '#A3E635'
                    );
                  }}
                  className={`relative overflow-hidden pixel-btn px-2 py-1.5 font-pixel text-[9px] shrink-0 cursor-pointer ${
                    hud.tacticalReadyRatio >= 1
                      ? 'border-[#A3E635] text-[#A3E635] animate-pulse'
                      : 'border-[#2B2D38] text-[#A1A1AA]'
                  }`}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-[#A3E635]/20"
                    style={{ width: `${Math.round(hud.tacticalReadyRatio * 100)}%` }}
                  />
                  <span className="relative z-10">◈ {Math.round(hud.tacticalReadyRatio * 100)}%</span>
                </button>

                {hud.belt.map((gid, slot) => {
                  const g = gid ? GADGETS.find((x) => x.id === gid) : null;
                  if (!g) return null;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onTouchStart={(e) => {
                        e.preventDefault();
                        simRef.current?.useBeltGadget(slot);
                      }}
                      onClick={() => simRef.current?.useBeltGadget(slot)}
                      className="pixel-btn px-2 py-1.5 text-[9px] font-mono text-white bg-[#12131A] shrink-0 cursor-pointer"
                      style={{ borderColor: g.color }}
                      title={`${g.name}: ${g.desc}`}
                    >
                      {g.glyph}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    soundEngine.playUiClick();
                    showHudInfo(
                      'LEYENDA HUD',
                      '⚡ Overdrive · ✦ Resonancia · ◈ Táctica · 🛡️ Absorbe 1 aplastamiento. Toca cualquier botón o abre Manual Táctico.',
                      '#38BDF8'
                    );
                  }}
                  onClick={() => {
                    soundEngine.playUiClick();
                    showHudInfo(
                      'LEYENDA HUD',
                      '⚡ Overdrive · ✦ Resonancia · ◈ Táctica · 🛡️ Absorbe 1 aplastamiento. Toca cualquier botón o abre Manual Táctico.',
                      '#38BDF8'
                    );
                  }}
                  aria-label="Explicación del HUD"
                  className="pixel-btn px-1.5 py-1.5 font-pixel text-[9px] border-[#38BDF8]/60 text-[#38BDF8] shrink-0 cursor-pointer"
                >
                  ?
                </button>
              </div>

              {touchMode === 'GESTURES' && (
                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    edgeQueue.current.dash = true;
                  }}
                  onClick={() => (edgeQueue.current.dash = true)}
                  className={`pixel-btn px-3 py-1.5 font-pixel text-[9px] relative overflow-hidden shrink-0 ${
                    hud.isFallingPlayer
                      ? 'border-[#F43F5E] bg-[#2A1018] text-[#FDA4AF]'
                      : hud.dashReadyRatio >= 1
                        ? 'border-[#38BDF8] bg-[#0F1B26] text-[#38BDF8]'
                        : 'border-[#2B2D38] bg-[#12131A] text-[#71717A]'
                  }`}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-[#38BDF8]/20"
                    style={{ width: `${Math.round(hud.dashReadyRatio * 100)}%` }}
                  />
                  <span className="relative z-10">{hud.isFallingPlayer ? 'FRENO ✦' : 'DASH'}</span>
                </button>
              )}
            </div>
          )}

          {/* Minimalist Mobile Controls (Option B: Hybrid Thumb Deck | Option A: Full Gestures) */}
          {touchMode === 'HYBRID' ? (
            <div className="lg:hidden w-full max-w-[520px] flex items-stretch gap-2 pt-2 shrink-0 touch-game-surface">
              {/* Left Thumb Ergonomic Slider Track */}
              <div
                onTouchStart={handleSliderTouchStart}
                onTouchMove={handleSliderTouchMove}
                onTouchEnd={handleSliderTouchEnd}
                onTouchCancel={handleSliderTouchEnd}
                className="relative flex-1 min-h-[56px] pixel-panel bg-[#101219] border-[#2E3242] flex items-center justify-between px-3 overflow-hidden select-none touch-game-surface"
              >
                <span className="font-mono text-xs text-[#71717A]">◀</span>
                <div className="text-center leading-tight pointer-events-none">
                  <div className="font-pixel text-[9px] text-[#A1A1AA]">DESLIZA PULGAR</div>
                  <div className="font-mono text-[9px] text-[#52525B]">▲ Subir · ▼ Slam</div>
                </div>
                <span className="font-mono text-xs text-[#71717A]">▶</span>
                <div
                  className={`absolute top-1/2 left-1/2 w-10 h-10 -ml-5 -mt-5 border-2 pointer-events-none flex items-center justify-center transition-colors ${
                    sliderNub.active
                      ? 'border-[#38BDF8] bg-[#38BDF8]/25 text-white'
                      : 'border-[#3F4354] bg-[#1B1E29]/80 text-[#71717A]'
                  }`}
                  style={{
                    transform: `translate3d(${Math.round(sliderNub.x * 54)}px, ${Math.round(sliderNub.y * 10)}px, 0)`,
                  }}
                >
                  <span className="font-pixel text-[10px]">◆</span>
                </div>
              </div>

              {/* Right 2 Action Buttons (Dash/Brake + Drill) */}
              <div className="flex items-stretch gap-1.5 shrink-0">
                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    edgeQueue.current.dash = true;
                  }}
                  onClick={() => (edgeQueue.current.dash = true)}
                  className={`pixel-btn px-3 min-w-[74px] flex flex-col items-center justify-center relative overflow-hidden touch-game-surface ${
                    hud.isFallingPlayer
                      ? 'border-[#F43F5E] text-[#FDA4AF]'
                      : hud.dashReadyRatio >= 1
                      ? 'border-[#38BDF8] text-[#38BDF8]'
                      : 'text-[#71717A]'
                  }`}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-[#38BDF8]/18"
                    style={{ width: `${Math.round(hud.dashReadyRatio * 100)}%` }}
                  />
                  <span className="relative z-10 font-pixel text-[10px]">
                    {hud.isFallingPlayer ? 'FRENO' : 'DASH'}
                  </span>
                  <span className="relative z-10 font-mono text-[9px] opacity-80">
                    {hud.isFallingPlayer ? 'AÉREO' : `${Math.round(hud.dashReadyRatio * 100)}%`}
                  </span>
                </button>
                <button
                  type="button"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    edgeQueue.current.drill = true;
                  }}
                  onClick={() => (edgeQueue.current.drill = true)}
                  className="pixel-btn-primary px-3.5 min-w-[72px] font-pixel text-[11px] font-bold text-white touch-game-surface"
                >
                  PICAR
                </button>
              </div>
            </div>
          ) : (
            <div className="lg:hidden w-full max-w-[520px] pt-1.5 text-center font-mono text-[10px] text-[#71717A] shrink-0">
              TAP bloque: Picar · Arrastrar bloque: Permutar · Deslizar ◀/▶ y soltar: Mover 1 casilla · Doble tap izq/der: Dash
              {visualSettings.swipeDownDrill !== false ? ' · ↓ Arrastrar: Picar abajo' : ''}
            </div>
          )}
        </div>

        {/* Right Panel: Style Rank, Fever, Vertical Radar, Modules, Synergies, Contracts */}
        <aside className="hidden lg:flex flex-col justify-between gap-3.5 overflow-y-auto pl-1">
          <div className="space-y-3.5">
            {/* Live Style Rank Meter (D -> SSS) */}
            <div
              className="pixel-panel p-3.5 space-y-2"
              style={{ borderColor: hud.styleRank !== 'D' ? styleColors[hud.styleRank] : '#2B2D38' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-pixel text-[9px] text-[#8E92A4]">RANGO DE ESTILO</div>
                  <div className="font-mono text-xs text-[#D4D4D8] mt-0.5">
                    Botín <span className="font-bold text-white">×{hud.styleMult.toFixed(2)}</span>
                  </div>
                </div>
                <div
                  className="font-display text-3xl font-black leading-none px-2.5 py-1 border-2 bg-[#0B0C10]"
                  style={{
                    color: styleColors[hud.styleRank],
                    borderColor: styleColors[hud.styleRank],
                  }}
                >
                  {hud.styleRank}
                </div>
              </div>
              <div className="w-full h-1.5 bg-[#09090B] overflow-hidden">
                <div
                  className="h-full transition-all duration-100"
                  style={{
                    width: `${Math.min(100, Math.round((hud.styleScore / 850) * 100))}%`,
                    backgroundColor: styleColors[hud.styleRank],
                  }}
                />
              </div>
            </div>

            {/* Active Fiebre del Pozo Micro-Event */}
            {hud.activeFever && (
              <div
                className="pixel-panel p-3 space-y-1.5 bg-[#151320]"
                style={{ borderColor: hud.activeFever.color }}
              >
                <div className="flex items-center justify-between text-[9px] font-pixel">
                  <span style={{ color: hud.activeFever.color }}>⚡ {hud.activeFever.title}</span>
                  <span className="text-white tabular-nums">{Math.ceil(hud.activeFever.timer / 60)}s</span>
                </div>
                <div className="text-[11px] text-[#E4E4E7]">{hud.activeFever.subtitle}</div>
                <div className="w-full h-1.5 bg-[#09090B] overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, Math.round((hud.activeFever.progress / Math.max(1, hud.activeFever.target)) * 100))}%`,
                      backgroundColor: hud.activeFever.color,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Seismic Vertical Radar */}
            {hud.upcomingMilestones.length > 0 && (
              <div className="pixel-panel p-3.5 space-y-2">
                <div className="font-pixel text-[9px] text-[#8E92A4]">RADAR SÍSMICO</div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {hud.upcomingMilestones.map((m) => (
                    <div key={`${m.kind}-${m.depth}`} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 shrink-0" style={{ backgroundColor: m.color }} />
                        <span className="text-[#E4E4E7] truncate">{m.label}</span>
                      </div>
                      <span className="shrink-0 tabular-nums font-bold" style={{ color: m.color }}>
                        -{Math.max(1, m.depth - hud.depth)}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Core Modules (6 slots) */}
            <div className="pixel-panel p-3.5">
              <div className="flex items-center justify-between font-pixel text-[10px] text-[#8E92A4] mb-2">
                <span>MÓDULOS DE NÚCLEO</span>
                <span className="tabular-nums text-white">{hud.modules.length}/6</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => {
                  const mod = hud.modules[i];
                  const def = mod ? MODULES.find((m) => m.id === mod.id) : null;
                  return (
                    <div
                      key={i}
                      title={def ? (mod.mk2 ? def.mk2Desc : def.shortDesc) : 'Ranura vacía (Brecha cada 250m impares)'}
                      className="p-2 border border-[#2B2D38] bg-[#101117] min-h-[50px] flex flex-col justify-between"
                    >
                      {def ? (
                        <>
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span style={{ color: ARCHETYPE_COLORS[def.archetype] }}>{def.glyph}</span>
                            {mod.mk2 && <span className="font-pixel text-[9px] text-[#FACC15]">MK2</span>}
                          </div>
                          <div className="text-[11px] font-semibold text-white truncate">{def.name}</div>
                        </>
                      ) : (
                        <div className="font-pixel text-[9px] text-[#3F3F46] my-auto">RANURA {i + 1}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Archetype Resonances */}
            {hud.synergies.length > 0 && (
              <div className="pixel-panel p-3 space-y-1.5">
                <div className="font-pixel text-[9px] text-[#8E92A4]">RESONANCIAS DE BUILD</div>
                {hud.synergies.map((s) => (
                  <div
                    key={s.archetype}
                    title={s.desc}
                    className={`px-2 py-1 border text-[11px] flex items-center justify-between gap-2 ${
                      s.tier >= 1 ? 'bg-[#131822]' : 'bg-[#0E0F14] opacity-75'
                    }`}
                    style={{ borderColor: s.tier >= 1 ? ARCHETYPE_COLORS[s.archetype] : '#262834' }}
                  >
                    <span className="truncate font-semibold text-white">{s.label}</span>
                    <span className="font-mono text-[10px] shrink-0" style={{ color: ARCHETYPE_COLORS[s.archetype] }}>
                      {s.count}/4 {s.tier >= 2 ? 'II' : s.tier === 1 ? 'I' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {hud.overcharges.length > 0 && (
              <div className="pixel-panel p-3.5 border-[#E11D48]/60 bg-[#1F1016]">
                <div className="font-pixel text-[10px] text-[#FDA4AF] mb-2">SOBRECARGAS ACTIVAS</div>
                <div className="space-y-1.5">
                  {hud.overcharges.map((id) => {
                    const oc = OVERCHARGES.find((o) => o.id === id);
                    if (!oc) return null;
                    return (
                      <div key={id} className="p-2 border border-[#E11D48]/40 bg-[#120A0E] text-xs">
                        <div className="font-semibold text-white">
                          {oc.glyph} {oc.name}
                        </div>
                        <div className="text-[#FDA4AF] text-[11px] mt-0.5">{oc.benefit}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Active Contracts */}
            {(archive.activeContracts || []).some((c) => !c.claimed) && (
              <div className="pixel-panel p-3 space-y-1.5">
                <div className="font-pixel text-[9px] text-[#8E92A4]">CONTRATOS ACTIVOS</div>
                {(archive.activeContracts || [])
                  .filter((c) => !c.claimed)
                  .slice(0, 3)
                  .map((c) => {
                    const def = CONTRACT_POOL.find((x) => x.id === c.id);
                    if (!def) return null;
                    return (
                      <div key={c.id} className="text-[11px] flex items-center justify-between gap-2 text-[#D4D4D8]">
                        <span className="truncate">{def.title}</span>
                        <span className="font-mono text-[10px] shrink-0 text-[#FACC15] tabular-nums">
                          {Math.min(c.progress, def.target)}/{def.target}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Collapsible Controls Reference */}
            <div className="pixel-panel p-3 text-xs text-[#A1A1AA]">
              <button
                type="button"
                onClick={() => setShowControls((v) => !v)}
                className="w-full flex items-center justify-between font-pixel text-[10px] text-white cursor-pointer"
              >
                <span>? CONTROLES Y AYUDA</span>
                <span className="text-[#FACC15]">{showControls ? '−' : '+'}</span>
              </button>
              {showControls && (
                <div className="space-y-1.5 mt-2.5 pt-2 border-t border-[#232530]">
                  <div className="flex justify-between">
                    <span>Mover / Mira</span>
                    <span className="font-mono text-white">
                      {formatKeyCode(keyBindings.left[0])}/{formatKeyCode(keyBindings.right[0])}/
                      {formatKeyCode(keyBindings.up[0])}/{formatKeyCode(keyBindings.down[0])}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Perforar</span>
                    <span className="font-mono text-white">{formatActionKeys(keyBindings, 'drill')} / Clic</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Permutar</span>
                    <span className="font-mono text-white">
                      {formatKeyCode(keyBindings.swapLeft[0])}/{formatKeyCode(keyBindings.swapRight[0])} · Clic Der.+Deslizar
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dash / Amortiguar</span>
                    <span className="font-mono text-[#38BDF8]">{formatActionKeys(keyBindings, 'dash')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdrive</span>
                    <span className="font-mono text-[#FACC15]">{formatActionKeys(keyBindings, 'overdrive')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Slam (Picado)</span>
                    <span className="font-mono text-white">{formatKeyCode(keyBindings.slam[0])} (Mant.)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Detonar Mecha</span>
                    <span className="font-mono text-white">{formatActionKeys(keyBindings, 'detonate')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Re-calibrar ({hud.rerolls})</span>
                    <span className="font-mono text-white">{formatActionKeys(keyBindings, 'reroll')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Artilugios</span>
                    <span className="font-mono text-[#38BDF8]">
                      {formatKeyCode(keyBindings.gadget1[0])} / {formatKeyCode(keyBindings.gadget2[0])} /{' '}
                      {formatKeyCode(keyBindings.gadget3[0])}
                    </span>
                  </div>
                  {onUpdateKeyBindings && onUpdateVisualSettings && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playUiClick();
                        pausedRef.current = true;
                        setPaused(true);
                        setControlsModalSection('KEYBOARD');
                      }}
                      className="pixel-btn w-full mt-2 py-1.5 px-2 font-pixel text-[9px] text-[#FACC15] cursor-pointer"
                    >
                      Editar teclas / modo móvil
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pixel-panel p-3 text-[11px] text-[#8E92A4] leading-relaxed">
            <span className="font-pixel text-[9px] text-[#FACC15] block mb-1">CONSEJO TÁCTICO</span>
            Al caer desde 5+ bloques usa{' '}
            <span className="text-[#38BDF8] font-mono">Dash [{formatKeyCode(keyBindings.dash[0])}]</span> para amortiguar,
            o{' '}
            <span className="text-white font-mono">
              {formatKeyCode(keyBindings.up[0])} + {formatKeyCode(keyBindings.swapLeft[0])}/
              {formatKeyCode(keyBindings.swapRight[0])}
            </span>{' '}
            frente a bloques encima para Corte Cinético.
          </div>
        </aside>
      </main>

      {controlsModalSection && onUpdateKeyBindings && onUpdateVisualSettings && (
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
