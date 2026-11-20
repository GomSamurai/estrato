import {
  ActiveModule,
  AimDir,
  ArchiveSave,
  ArtifactId,
  Cell,
  CellState,
  ChassisId,
  CLIMB_HOLD_FRAMES,
  COYOTE_CRUSH_FRAMES,
  DASH_COOLDOWN_FRAMES,
  DETONATING_FRAMES,
  DT,
  FALL_SPEED_NORMAL,
  FALL_SPEED_SLAM,
  GadgetId,
  GameMode,
  GRID_COLS,
  HazardType,
  IGNITE_FUSE_FRAMES,
  INPUT_BUFFER_FRAMES,
  LAST_BREATH_FRAMES,
  MaterialBag,
  MaterialId,
  MineralRecord,
  AcidPuddle,
  ActiveFeverEvent,
  Archetype,
  ArchetypeSynergyState,
  FeverEventType,
  ORIENT_THRESHOLD_FRAMES,
  OVERDRIVE_DURATION_FRAMES,
  PLAYER_SPEED_CELLS_PER_SEC,
  RadarMilestone,
  RelicId,
  RigPose,
  RigUpgrades,
  RoomArchetype,
  RunSummary,
  StorySpeaker,
  StoryTransmission,
  StratumPalette,
  StyleRank,
  SWAP_DURATION_FRAMES,
  TrialId,
} from '../types/game';
import { CHASSIS_LIST, LORE_FRAGMENTS, MODULES, OVERCHARGES, STRATA } from '../data/catalog';
import { ARTIFACTS, getArtifactPermanentBonuses } from '../data/collectibles';
import { EMPTY_MATERIAL_BAG, TRIAL_DEFS } from '../data/crafting';
import { SPEAKER_PROFILES, STORY_TRANSMISSIONS } from '../data/story';
import { getBestDepth } from '../storage/archive';
import { SeededRNG } from './rng';
import { soundEngine } from './audio';
import { BlastWave, FloatingText, FxWorld } from './fx';

export type { BlastWave, FloatingText };

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  drillPressed: boolean;
  swapLeftPressed: boolean;
  swapRightPressed: boolean;
  slamHeld: boolean;
  detonatePressed: boolean;
  rerollPressed: boolean;
  dashPressed?: boolean;
  overdrivePressed?: boolean;
  gadget1Pressed?: boolean;
  gadget2Pressed?: boolean;
  gadget3Pressed?: boolean;
}

export interface BreachOffer {
  options: { moduleId: string; isUpgrade: boolean; isOvercharge?: boolean }[];
  resolved: boolean;
  yRow: number;
}

export interface BifurcationOffer {
  yRow: number;
  resolved: boolean;
  leftTitle: string;
  leftDesc: string;
  leftMutator: string;
  rightTitle: string;
  rightDesc: string;
  rightMutator: string;
}

export interface GuardianState {
  id: 'WARDEN' | 'LOOM' | 'FORGE' | 'PENDULUM' | 'ARCHITECT' | 'CHRONOLITH';
  name: string;
  hp: number;
  maxHp: number;
  arenaRow: number;
  timerFrames: number;
  actionCooldown: number;
  pendulumCol: number;
  pendulumDir: number;
  loomAnchors: { row: number; col: number; hp: number }[];
  laserWarningRow: number | null;
  laserWarningTimer: number;
  ceilingRow: number;
  hitFlashTimer: number;
  phase: 1 | 2;
  attackCols: number[];
  attackWarnTimer: number;
}

export interface SimConfig {
  mode: GameMode;
  seed: string;
  chassis: ChassisId;
  ascension: number;
  archive: ArchiveSave;
  startDepth?: number;
  trialId?: TrialId;
  skipSeenDialogues?: boolean;
  enableTutorial?: boolean;
  onTutorialComplete?: () => void;
  onGarbageSend?: (amount: number) => void;
}

let nextCellId = 1;

function makeEmptyCell(): Cell {
  return {
    id: nextCellId++,
    state: 'EMPTY',
    kind: 'EMPTY',
    color: -1,
    clusterId: 0,
    wobbleTimer: 0,
    wobbleMax: 39,
    fuseTimer: 0,
    fuseMax: 72,
    chainLevel: 0,
    detonateTimer: 0,
    hp: 0,
    fallOffset: 0,
    fallDistance: 0,
    swapProgress: 0,
    swapFromCol: 0,
    swapFromRow: 0,
    crystalTimer: 0,
    crystalTriggered: false,
    emberTimer: 0,
  };
}

export function isSwappableKind(kind: CellState | undefined): boolean {
  if (!kind) return false;
  return (
    kind === 'EMPTY' ||
    kind === 'SOLID' ||
    kind === 'SLAG' ||
    kind === 'CRYSTAL' ||
    kind === 'CONDUCTOR' ||
    kind === 'PHASE' ||
    kind === 'OXYGEN' ||
    kind === 'GEODE' ||
    kind === 'CRYO_VENT' ||
    kind === 'MAGMA_NODE' ||
    kind === 'GRAVEL' ||
    kind === 'BOUNCE_PAD' ||
    kind === 'RESONANCE_VEIN' ||
    kind === 'SUPPORT_BEAM' ||
    kind === 'GAS_POCKET' ||
    kind === 'ACID_VAT' ||
    kind === 'GRAV_WELL' ||
    kind === 'SHOCK_MINE' ||
    kind === 'TREASURE_CACHE' ||
    kind === 'PHASE_KEY'
  );
}

export function isPassableForPlayer(cell: Cell, phasesIgniting: boolean): boolean {
  if (cell.state === 'EMPTY' || cell.state === 'DETONATING') return true;
  if (cell.kind === 'OXYGEN' || cell.kind === 'EXTRACTION_TUBE') return true;
  if (phasesIgniting && cell.state === 'IGNITING') return true;
  return false;
}

export class EstratoSimulation {
  public config: SimConfig;
  public rng: SeededRNG;
  public grid: Map<number, Cell[]> = new Map();
  public maxGeneratedRow = -1;
  public minPrunedRow = 0;

  // Player state (py is feet Y in world row units; body occupies gridRow = Math.floor(py - 0.45))
  public playerState: 'idle' | 'moving' | 'falling' = 'idle';
  public gridCol = 4;
  public gridRow = 4;
  public targetCol = 4;
  public targetRow = 4;
  public px = 4;
  public py = 5;
  public vx = 0;
  public vy = 0;
  public aimDir: AimDir = 'DOWN';
  public facing: -1 | 1 = 1;
  public lateralHoldFrames = 0;
  public lateralHoldDir: -1 | 1 | 0 = 0;
  private lastMoveInputDir: -1 | 1 | 0 = 0;
  private dasHoldFrames = 0;
  private dasRepeatCounter = 0;
  public isClimbing = false;
  public squashX = 1;
  public squashY = 1;
  public isFallingPlayer = false;
  public playerFallRows = 0;
  public swapCooldown = 0;
  public invulnTimer = 0; // from blasts or Escudo de Inercia
  public kineticShields = 0;
  public anvilShieldAvailable = false;

  // Guided 3-step Tutorial (0 = inactive/completed, 1..3 = active step)
  public tutorialStep: 0 | 1 | 2 | 3 = 0;
  public tutorialDrills = 0;
  public tutorialIgnitions = 0;
  public tutorialO2Collected = 0;

  // Coyote Crush (9 frames)
  public coyoteCrushTimer = 0;
  public coyoteCrushCellPos: { r: number; c: number } | null = null;

  // Input buffer (5 frames)
  private bufferedAction: 'DRILL' | 'SWAP_L' | 'SWAP_R' | null = null;
  private bufferTimer = 0;

  // Oxygen & Progression
  public oxygen = 100;
  public maxOxygen = 100;
  public oxygenFreezeTimer = 0;
  public lastBreathTimer = 0;
  public inLastBreath = false;

  public depthMeters = 0;
  public maxDepthReached = 0;
  public frameCount = 0;
  public hitstopFrames = 0;
  public whiteFlashFrames = 0;
  public shakeX = 0;
  public shakeY = 0;
  public shakeTimer = 0;

  // Camera
  public cameraRow = 5;

  // Roguelite state
  public modules: ActiveModule[] = [];
  public overcharges: string[] = [];
  public rerollsRemaining = 0;
  public isotopes = 0;
  public isotopesBanked = 0;
  public anomalyCores = 0;
  public maxChain = 1;
  public parries = 0;
  public slagDestroyed = 0;
  public activeMutators: string[] = [];

  // Secret chain
  public hasAlphaFragment = false;
  public hasSingularityLance = false;
  public inStratum6 = false;
  public stratum6CeilingRow = 2492;

  // Events & Chambers
  public nextSeismicSealRow = 100;
  public nextBreachRow = 250;
  public nextBifurcationRow = 500;
  public activeBreach: BreachOffer | null = null;
  public activeBifurcation: BifurcationOffer | null = null;
  public activeGuardian: GuardianState | null = null;
  public defeatedGuardians: Set<number> = new Set();
  public phaseKeySpawned = false;
  public pressurePulseTimer = 25 * 60;
  public pressureActiveTimer = 0;
  public phaseColorBeatCounter = 0;
  public phaseColorToggle = false;
  public phaseShiftWarning = 0;

  // Visual FX & Camera Juice
  public fx: FxWorld = new FxWorld();
  public get floatingTexts(): FloatingText[] {
    return this.fx.floatingTexts;
  }
  public get blastWaves(): BlastWave[] {
    return this.fx.blastWaves;
  }
  public camKickX = 0;
  public camKickY = 0;
  public camZoom = 1.0;
  public camZoomImpulse = 0;
  public camTrauma = 0;
  public fallShockFlashFrames = 0;
  public fallImpacts = 0;
  public chromaFlashFrames = 0;
  public camLookAheadY = 0;
  public styleScore = 0;
  public styleRank: StyleRank = 'D';
  public peakStyleRank: StyleRank = 'D';
  private styleDecayTimer = 0;
  private lastStyleAction = '';
  public activeFever: ActiveFeverEvent | null = null;
  private nextFeverDepth = 180;
  public acidPuddles: AcidPuddle[] = [];
  private notifiedSynergies: Set<string> = new Set();
  public actionPose: RigPose | null = null;
  public actionPoseTimer = 0;
  public dashCooldown = 0;
  public overdrive = 0;
  public overdriveTimer = 0;
  public slamDiving = false;
  public overheadDangerCol = false;
  public metronomeOnBeatFlash = 0;
  private lastActionOnBeat = false;
  public score = 0;
  public comboCount = 0;
  public comboMultiplier = 1;
  public comboTimerFrames = 0;
  public comboMaxTimerFrames = 150;
  public maxComboMultiplier = 1;
  private isotopePickupStreak = 0;
  private ddaLastTierNotified = 0;
  public discoveredCodex: Set<string> = new Set(['STRATUM_1']);
  public discoveredLore: Set<string> = new Set(['LORE_01_BITACORA']);
  public runMineralStats: Record<string, MineralRecord> = {};

  // End state
  public finished = false;
  public summary: RunSummary | null = null;
  public lastDrillEvent: { id: number; r: number; c: number; color: string; isSlag: boolean } | null = null;
  public lastBiomeTransition: {
    id: number;
    milestoneDepth: number;
    stratumId: number;
    name: string;
    subtitle: string;
    primaryColor: string;
    secondaryColor: string;
    bgColor: string;
  } | null = null;
  public destructionEvents: Array<{
    id: number;
    r: number;
    c: number;
    color: string;
    basePoints: number;
    kind: string;
  }> = [];
  public dynamicDescentSpeedMult = 1.0;
  public dynamicBlockDensityBoost = 0;
  private drillEventSeq = 0;
  private biomeTransitionSeq = 0;
  private destructionSeq = 0;
  private lastOxygenCapsuleRow = 0;
  private lastBiomeMilestoneRow = 0;
  private lastIsotopeDepthMilestone = 0;
  private emberCells: { r: number; c: number; timer: number }[] = [];
  private currentStratumId = 1;

  // Expansion: Crafting, Relics, Gadgets, Storytelling, Hazards & Trials
  public materialsEarned: MaterialBag = { ...EMPTY_MATERIAL_BAG };
  public equippedRelics: Set<RelicId> = new Set();
  public belt: (GadgetId | null)[] = [null, null, null];
  public consumedBeltSlots: GadgetId[] = [];
  public pendingStory: StoryTransmission | null = null;
  public activeTicker: { speaker: StorySpeaker; name: string; text: string; color: string; timer: number } | null = null;
  public triggeredStoryIds: Set<string> = new Set();
  public storyChoicesMade: Record<string, string> = {};
  public deepDescentUnlocked = false;
  public activeHazard: {
    type: HazardType;
    label: string;
    color: string;
    warningTimer: number;
    activeTimer: number;
    targetCols: number[];
  } | null = null;
  private hazardCooldown = 540;
  private cryoHazardTick = 0;
  private swapTransmuteCounter = 0;
  public bossesDefeated = 0;
  public geodesBroken = 0;
  public bouncesTriggered = 0;
  public acidMelts = 0;
  public gadgetsUsed = 0;
  public cachesOpened = 0;
  public o2CapsulesCollected = 0;

  // Immersion, Collectibles & Operator Signature Resonance
  public resonanceCharge = 0;
  public resonanceUsed = 0;
  public discoveredArtifacts: ArtifactId[] = [];
  public rowMeta = new Map<
    number,
    { archetype: RoomArchetype; bannerText?: string; bannerColor?: string; secretHint?: boolean }
  >();
  private activeRoomArchetype: RoomArchetype = 'STANDARD';
  private roomRowsLeft = 0;
  public personalBestRow = 0;
  public personalBestBroken = false;
  public tacticalCooldown = 0;
  public tacticalMaxCooldown = 780;
  public overheadGuardTimer = 0;
  public overheadDangerDist = 99;
  public overheadCounterHeat = 0;
  public overheadCounterCooldown = 0;
  private overheadHeatDecayTimer = 0;
  public recentArtifactBanner: {
    id: ArtifactId;
    name: string;
    rarity: string;
    color: string;
    bonusText: string;
    timer: number;
  } | null = null;
  public artifactNearby = false;
  public hasArchitectCrown = false;
  private artifactIsoBonusMult = 1;
  private chargeSpeedMult = 1;
  private spawnedArtifactStrata: Set<number> = new Set();
  private bioFilterBlockCount = 0;
  private lastBanterFrame = -400;

  constructor(config: SimConfig) {
    this.config = config;
    this.rng = new SeededRNG(config.seed);
    for (const id of config.archive.discoveredLore || []) {
      this.discoveredLore.add(id);
    }
    for (const rel of config.archive.equippedRelics || []) {
      this.equippedRelics.add(rel);
    }
    const maxBeltSlots = Math.min(3, 1 + (config.archive.infra?.beltSlots || 0));
    for (let i = 0; i < maxBeltSlots; i++) {
      const gid = config.archive.equippedBelt?.[i] || null;
      if (gid && (config.archive.gadgetInventory?.[gid] || 0) > 0) {
        this.belt[i] = gid;
      }
    }

    const chassisDef = CHASSIS_LIST.find((c) => c.id === config.chassis) || CHASSIS_LIST[0];
    this.personalBestRow = getBestDepth(config.archive);
    this.tacticalMaxCooldown = Math.max(240, Math.round((chassisDef.tacticalCooldownSec ?? 14) * 60));
    const upg = this.getRigUpgrades();
    const rigLevel = Math.max(1, config.archive.rigLevel || 1);
    const artBonuses = getArtifactPermanentBonuses(config.archive);
    this.hasArchitectCrown = artBonuses.hasArchitectCrown;
    this.artifactIsoBonusMult = artBonuses.isoBonusMult;
    this.chargeSpeedMult = artBonuses.chargeSpeedMult * (this.hasRelic('REL_RESONANCE_COIL') ? 1.15 : 1);

    let maxO2 =
      chassisDef.maxOxygen +
      upg.tankTier * 15 +
      Math.max(0, (rigLevel - 1) * 2) +
      (config.archive.infra?.supplyDrop || 0) * 5 +
      artBonuses.maxO2BonusPct;
    if (this.hasRelic('REL_GLASS_CANNON')) maxO2 = Math.round(maxO2 * 0.85);
    this.maxOxygen = maxO2;
    this.oxygen = this.maxOxygen;
    this.anvilShieldAvailable = this.hasRelic('REL_GRAV_ANCHOR');
    let startShields = upg.armorTier >= 4 ? 2 : upg.armorTier >= 2 ? 1 : 0;
    startShields += chassisDef.starterShields || 0;
    startShields += artBonuses.starterShieldBonus;
    if ((config.archive.infra?.supplyDrop || 0) >= 2) startShields += 1;
    if (this.hasRelic('REL_GRAV_ANCHOR')) startShields += 1;
    if (this.hasRelic('REL_ARCHITECT_SHARD')) this.hasSingularityLance = true;
    this.kineticShields = startShields;

    if ((upg.capacitorTier || 0) >= 5) this.overdrive = 25;
    else if ((upg.capacitorTier || 0) >= 4) this.overdrive = 12;
    if (this.hasRelic('REL_THERMAL_CORE')) this.overdrive = Math.min(100, this.overdrive + 30);
    if (this.hasRelic('REL_RESONANCE_COIL')) this.resonanceCharge = 35;

    this.rerollsRemaining = config.archive.infra.reroll;

    const startRow = config.startDepth && config.startDepth > 0 ? config.startDepth : 0;
    this.depthMeters = startRow;
    this.maxDepthReached = startRow;
    this.lastIsotopeDepthMilestone = startRow;
    this.lastBiomeMilestoneRow = Math.floor(startRow / 500) * 500;
    this.currentStratumId = this.getStratumForRow(startRow).id;
    this.nextSeismicSealRow = Math.floor(startRow / 100) * 100 + 100;
    this.nextBreachRow = Math.floor(startRow / 250) * 250;
    if (this.nextBreachRow % 500 === 0) this.nextBreachRow += 250;
    if (this.nextBreachRow <= startRow + 10) this.nextBreachRow += 500;
    this.nextBifurcationRow = startRow < 515 ? 515 : startRow < 1515 ? 1515 : 99999;

    // Unlock chapters VI-VII immediately if campaign already cleared before or starting deep
    if ((config.archive.campaignWins || 0) > 0 || startRow >= 2500) {
      this.deepDescentUnlocked = true;
    }

    // Initial Injection infrastructure
    if (config.archive.infra.initialInjection > 0 && config.mode !== 'DUEL') {
      const pool = this.getAvailableModulePool();
      if (pool.length > 0) {
        const picked = this.rng.pick(pool);
        this.modules.push({ id: picked.id, mk2: false });
      }
    }

    // Elite Trial Starting Setup
    if (config.mode === 'TRIAL' && config.trialId) {
      if (config.trialId === 'VOLATILE_CHAIN') {
        this.modules.push({ id: 'PYRO_NOVA', mk2: false });
        this.overdrive = 100;
      } else if (config.trialId === 'ANAEROBIC_RUN') {
        this.overcharges.push('OC_ANAEROBIC');
      } else if (config.trialId === 'BOSS_RUSH') {
        this.kineticShields += 2;
        const pool = this.getAvailableModulePool();
        for (let i = 0; i < 2 && pool.length > 0; i++) {
          const picked = this.rng.pick(pool);
          if (!this.hasModule(picked.id)) this.modules.push({ id: picked.id, mk2: false });
        }
      }
    }

    // Elevator compensatory modules if starting deeper
    if (startRow >= 500 && config.mode !== 'TRIAL') {
      const bonusCount = Math.floor(startRow / 500);
      for (let i = 0; i < bonusCount; i++) {
        const pool = this.getAvailableModulePool();
        if (pool.length > 0) {
          this.modules.push({ id: this.rng.pick(pool).id, mk2: false });
        }
      }
    }

    // Initialize starting pit
    const baseSpawnRow = startRow;
    for (let r = baseSpawnRow; r <= baseSpawnRow + 4; r++) {
      const row = Array.from({ length: GRID_COLS }, () => makeEmptyCell());
      this.grid.set(r, row);
      this.maxGeneratedRow = r;
    }
    this.gridCol = 4;
    this.gridRow = baseSpawnRow + 4;
    this.targetCol = 4;
    this.targetRow = baseSpawnRow + 4;
    this.playerState = 'idle';
    this.px = 4;
    this.py = baseSpawnRow + 5;
    this.vx = 0;
    this.vy = 0;
    this.cameraRow = this.py;
    this.minPrunedRow = baseSpawnRow;
    this.ddaLastTierNotified = Math.floor(startRow / 350);
    this.fx.resetScarf(this.px, this.py, this.facing);

    if (config.enableTutorial && config.mode !== 'DUEL' && startRow === 0) {
      this.tutorialStep = 1;
    }

    this.generateRowsUpTo(baseSpawnRow + 40);
    this.recomputeClustersAndSupport();

    if (config.mode !== 'CAMPAIGN' || startRow > 0) {
      this.triggerOperatorBanter('start', true);
    }
  }

  public hasRelic(id: RelicId): boolean {
    return this.equippedRelics.has(id);
  }

  public addMaterial(id: MaterialId, amount = 1): void {
    if (amount <= 0) return;
    let mult = this.hasOvercharge('OC_GOLD_FEVER') ? 2 : 1;
    if (this.hasRelic('REL_GEODE_COMPASS')) mult *= 1.5;
    if (this.hasModule('PAR_SCAVENGER')) mult *= this.hasModuleMk2('PAR_SCAVENGER') ? 2 : 1.75;
    const finalAmt = Math.max(1, Math.round(amount * mult));
    this.materialsEarned[id] = (this.materialsEarned[id] || 0) + finalAmt;
  }

  public getTacticalReadyRatio(): number {
    if (this.tacticalMaxCooldown <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - this.tacticalCooldown / this.tacticalMaxCooldown));
  }

  public get dashMaxCooldown(): number {
    const relicCut = this.hasRelic('REL_PHASE_CLOAK') ? 20 : 0;
    const modCut = this.hasModule('QUA_PHASE_DASH') ? (this.hasModuleMk2('QUA_PHASE_DASH') ? 0.5 : 0.65) : 1;
    const chassisMult = this.getChassisDef().dashCooldownMult ?? 1;
    return Math.max(
      22,
      Math.round((DASH_COOLDOWN_FRAMES - this.getRigUpgrades().thrusterTier * 8 - relicCut) * modCut * chassisMult)
    );
  }

  public get comboTimerRatio(): number {
    return this.comboTimerFrames > 0
      ? this.comboTimerFrames / Math.max(1, this.comboMaxTimerFrames)
      : 0;
  }

  private setActionPose(pose: RigPose, frames: number): void {
    this.actionPose = pose;
    this.actionPoseTimer = frames;
  }

  public addOverdrive(amount: number): void {
    if (this.overdriveTimer > 0) return;
    const upg = this.getRigUpgrades();
    const capMult =
      (1 + (upg.capacitorTier || 0) * 0.15 + (this.hasRelic('REL_THERMAL_CORE') ? 0.2 : 0)) *
      this.chargeSpeedMult;
    const chassisMult = this.getChassisDef().overdriveGainMult ?? 1;
    const prev = this.overdrive;
    this.overdrive = Math.min(100, this.overdrive + amount * capMult * chassisMult * 0.42);
    if (prev < 100 && this.overdrive >= 100) {
      this.fx.addFloatingText(
        this.px + 0.5,
        this.py - 1.3,
        'OVERDRIVE LISTO!',
        'PULSA [X] PARA ACTIVAR',
        '#FACC15',
        1.1
      );
      soundEngine.playComboTierUp(8);
    }
  }

  private addIsotopes(amount: number, fromChain = false): number {
    const magTier = this.getRigUpgrades().magnetTier || 0;
    let mult = this.activeMutators.includes('CRYSTAL_FAULT') ? 2 : 1;
    if (this.overdriveTimer > 0) mult *= 1.5;
    if (this.hasOvercharge('OC_GOLD_FEVER')) mult *= 2;
    if (this.hasRelic('REL_MAGNET_HEART')) mult *= 1.25;
    if (this.activeFever?.type === 'GOLD_RUSH') mult *= 1.4;
    if (fromChain) mult *= 1 + (this.getChassisDef().isotopeChainBonus ?? 0);
    mult *= 1 + Math.min(0.4, magTier * 0.08);
    mult *= 1 + (this.getStyleMultiplier() - 1) * 0.5;
    mult *= this.artifactIsoBonusMult;
    const depthScale =
      this.depthMeters >= 800
        ? 1.75
        : this.depthMeters >= 450
          ? 1.45
          : this.depthMeters >= 200
            ? 1.15
            : 0.85;
    mult *= depthScale;
    const finalAmt = Math.max(1, Math.round(amount * mult));
    this.isotopes += finalAmt;
    return finalAmt;
  }

  public getChassisDef() {
    return CHASSIS_LIST.find((c) => c.id === this.config.chassis) || CHASSIS_LIST[0];
  }

  public getRigUpgrades(): RigUpgrades {
    const raw = (this.config.archive.rigUpgrades || {}) as Partial<RigUpgrades>;
    return {
      drillTier: raw.drillTier ?? 0,
      thrusterTier: raw.thrusterTier ?? 0,
      tankTier: raw.tankTier ?? 0,
      armorTier: raw.armorTier ?? 0,
      capacitorTier: raw.capacitorTier ?? 0,
      magnetTier: raw.magnetTier ?? 0,
    };
  }

  public getRigLevel(): number {
    return Math.max(1, this.config.archive.rigLevel || 1);
  }

  public setDynamicDifficulty(descentSpeedMult: number, blockDensityBoost: number): void {
    this.dynamicDescentSpeedMult = Math.max(1.0, Math.min(2.2, descentSpeedMult));
    this.dynamicBlockDensityBoost = Math.max(0, Math.min(0.28, blockDensityBoost));
  }

  public getMaxComboMultiplier(): number {
    return this.hasModule('QUA_OVERCLOCK') ? 16 : 12;
  }

  public getOverdriveMaxDuration(): number {
    const capTier = this.getRigUpgrades().capacitorTier || 0;
    return OVERDRIVE_DURATION_FRAMES + capTier * 48;
  }

  public addCamTrauma(amount: number): void {
    this.camTrauma = Math.max(0, Math.min(1, this.camTrauma + amount));
  }

  public pulseCamZoom(delta: number): void {
    this.camZoomImpulse = Math.max(-0.08, Math.min(0.12, this.camZoomImpulse + delta));
  }

  public getStyleMultiplier(): number {
    const map: Record<StyleRank, number> = {
      D: 1.0,
      C: 1.05,
      B: 1.12,
      A: 1.22,
      S: 1.38,
      SS: 1.65,
      SSS: 2.0,
    };
    return map[this.styleRank] || 1.0;
  }

  private computeStyleRank(pts: number): StyleRank {
    if (pts >= 850) return 'SSS';
    if (pts >= 620) return 'SS';
    if (pts >= 420) return 'S';
    if (pts >= 260) return 'A';
    if (pts >= 140) return 'B';
    if (pts >= 55) return 'C';
    return 'D';
  }

  private rankIndex(r: StyleRank): number {
    const order: StyleRank[] = ['D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    return order.indexOf(r);
  }

  public addStyle(actionKey: string, basePts: number): void {
    if (this.finished || this.config.mode === 'DUEL') return;
    const isFresh = actionKey !== this.lastStyleAction;
    this.lastStyleAction = actionKey;
    const gain = Math.round(basePts * (isFresh ? 1.35 : 0.65));
    this.styleScore = Math.min(1000, this.styleScore + gain);
    this.styleDecayTimer = 165;

    const nextRank = this.computeStyleRank(this.styleScore);
    if (this.rankIndex(nextRank) > this.rankIndex(this.styleRank)) {
      this.styleRank = nextRank;
      if (this.rankIndex(nextRank) > this.rankIndex(this.peakStyleRank)) {
        this.peakStyleRank = nextRank;
      }
      if (this.rankIndex(nextRank) >= 2) {
        soundEngine.playStyleRankUp(nextRank);
        const rankCol =
          nextRank === 'SSS'
            ? '#F43F5E'
            : nextRank === 'SS'
              ? '#FACC15'
              : nextRank === 'S'
                ? '#F97316'
                : nextRank === 'A'
                  ? '#38BDF8'
                  : '#A3E635';
        this.fx.addFloatingText(
          this.px + 0.5,
          Math.max(1, this.py - 1.5),
          `RANGO ${nextRank}!`,
          `×${this.getStyleMultiplier().toFixed(2)} BOTÍN`,
          rankCol,
          1.25
        );
      }
    } else {
      this.styleRank = nextRank;
    }
  }

  public getArchetypeSynergies(): ArchetypeSynergyState[] {
    const defs: Record<Archetype, { label: string; d1: string; d2: string }> = {
      PIROLITICO: {
        label: 'Resonancia Pirolítica',
        d1: '2+: Detonaciones dañan escoria adyacente y encienden gas.',
        d2: '4+: Cadenas desatan onda expansiva térmica extra.',
      },
      BALISTICO: {
        label: 'Resonancia Balística',
        d1: '2+: -35% daño por caída y Slam más amplio.',
        d2: '4+: Slam inmune a caídas y perfora +1 fila extra.',
      },
      CUANTICO: {
        label: 'Resonancia Cuántica',
        d1: '2+: +1 alcance adicional de permuta (Q/E).',
        d2: '4+: Cada 8 permutas atrae una cápsula de O₂.',
      },
      PARASITO: {
        label: 'Resonancia Parasítica',
        d1: '2+: Cadenas ×3+ absorben +4% O₂ extra.',
        d2: '4+: Cadenas ×4+ recargan un artilugio gastado.',
      },
      SOBRECARGA: {
        label: 'Sobrecarga Abisal',
        d1: 'Potencia brutal con coste de riesgo.',
        d2: 'Máxima singularidad energética.',
      },
    };
    const counts: Partial<Record<Archetype, number>> = {};
    for (const m of this.modules) {
      const def = MODULES.find((x) => x.id === m.id);
      if (!def) continue;
      counts[def.archetype] = (counts[def.archetype] || 0) + 1;
    }
    const list: ArchetypeSynergyState[] = [];
    for (const arch of ['PIROLITICO', 'BALISTICO', 'CUANTICO', 'PARASITO'] as Archetype[]) {
      const count = counts[arch] || 0;
      if (count <= 0) continue;
      const tier: 0 | 1 | 2 = count >= 4 ? 2 : count >= 2 ? 1 : 0;
      const meta = defs[arch];
      list.push({
        archetype: arch,
        count,
        tier,
        label: meta.label,
        desc: tier >= 2 ? meta.d2 : meta.d1,
      });
    }
    return list;
  }

  public getSynergyTier(arch: Archetype): 0 | 1 | 2 {
    let count = 0;
    for (const m of this.modules) {
      const def = MODULES.find((x) => x.id === m.id);
      if (def?.archetype === arch) count++;
    }
    return count >= 4 ? 2 : count >= 2 ? 1 : 0;
  }

  public getUpcomingMilestones(): RadarMilestone[] {
    if (this.config.mode === 'DUEL') return [];
    const cur = Math.max(0, this.depthMeters);
    const horizon = cur + 550;
    const out: RadarMilestone[] = [];

    const nextSeal = Math.floor(cur / 100) * 100 + 100;
    if (nextSeal <= horizon) {
      out.push({ kind: 'SEAL', depth: nextSeal, label: 'Sello Sísmico', color: '#38BDF8' });
    }
    if ((this.config.mode === 'CAMPAIGN' || this.config.mode === 'ENDLESS') && this.nextBreachRow <= horizon) {
      out.push({ kind: 'BREACH', depth: this.nextBreachRow, label: 'Brecha Módulos', color: '#A3E635' });
    }
    const nextVault = Math.floor(cur / 360) * 360 + 360;
    if (nextVault <= horizon) {
      out.push({ kind: 'VAULT', depth: nextVault, label: 'Bóveda Tesoro', color: '#FACC15' });
    }
    if (this.config.mode === 'CAMPAIGN' && this.nextBifurcationRow <= horizon) {
      out.push({ kind: 'BIFURCATION', depth: this.nextBifurcationRow, label: 'Bifurcación', color: '#FB923C' });
    }

    const bossThresholds =
      this.config.mode === 'TRIAL' && this.config.trialId === 'BOSS_RUSH'
        ? [120, 240, 360, 480, 600]
        : this.config.mode === 'CAMPAIGN' || this.config.mode === 'ENDLESS'
          ? [500, 1000, 1500, 2000, 2500, 3500]
          : [];
    for (const bRow of bossThresholds) {
      if (!this.defeatedGuardians.has(bRow) && bRow > cur && bRow <= horizon) {
        out.push({ kind: 'GUARDIAN', depth: bRow, label: 'Guardián', color: '#F43F5E' });
        break;
      }
    }

    out.sort((a, b) => a.depth - b.depth);
    return out.slice(0, 4);
  }

  private emitDestruction(r: number, c: number, color: string, basePoints: number, kind: string): void {
    this.recordMineralStats(kind, r);
    this.comboCount += 1;
    this.checkFeverProgress('DRILL', 1);
    const baseWin = Math.max(96, 156 - this.comboCount * 2);
    const nextWindow = this.hasModule('QUA_OVERCLOCK')
      ? Math.round(baseWin * (this.hasModuleMk2('QUA_OVERCLOCK') ? 1.7 : 1.4))
      : baseWin;
    this.comboMaxTimerFrames = nextWindow;
    this.comboTimerFrames = nextWindow;

    const prevMult = this.comboMultiplier;
    const mult = Math.min(this.getMaxComboMultiplier(), 1 + Math.floor(this.comboCount / 2));
    this.comboMultiplier = mult;
    if (mult > this.maxComboMultiplier) {
      this.maxComboMultiplier = mult;
    }
    if (mult > prevMult) {
      if (mult === 3 || mult === 5 || mult === 8 || mult === 12 || mult === 16) {
        soundEngine.playComboTierUp(mult);
      }
      if (this.hasModuleMk2('QUA_OVERCLOCK')) {
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 6);
      }
    }

    const overdriveMult = this.overdriveTimer > 0 ? 1.5 : 1;
    const prismRelicMult = this.hasRelic('REL_GLASS_CANNON') ? 1.35 : 1;
    const styleMult = this.getStyleMultiplier();
    const feverMult = this.activeFever?.type === 'GOLD_RUSH' ? 1.5 : 1;
    const pts = Math.round(basePoints * mult * overdriveMult * prismRelicMult * styleMult * feverMult);
    this.score += pts;
    this.addOverdrive(1 + Math.min(2, Math.floor(mult / 3)));
    this.addResonance(1.1);

    if (this.hasModule('PAR_BIO_FILTER')) {
      this.bioFilterBlockCount++;
      const cycle = this.hasModuleMk2('PAR_BIO_FILTER') ? 12 : 15;
      if (this.bioFilterBlockCount >= cycle) {
        this.bioFilterBlockCount = 0;
        const heal = this.hasModuleMk2('PAR_BIO_FILTER') ? 8 : 5;
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + heal);
        if (this.hasModuleMk2('PAR_BIO_FILTER')) this.addIsotopes(4);
        this.addFloatingText(this.px + 0.5, this.py - 1.1, `+${heal}% BIO-FILTRO`, undefined, '#A3E635');
      }
    }

    // Small material drop chance on general mining
    const magTier = this.getRigUpgrades().magnetTier || 0;
    const dropBonus = magTier >= 5 ? 0.04 : magTier >= 4 ? 0.025 : 0;
    if (kind === 'CRYSTAL' && this.rng.next() < 0.22 + dropBonus) this.addMaterial('cuarzo', 1);
    else if (kind === 'CONDUCTOR' && this.rng.next() < 0.35 + dropBonus) this.addMaterial('titanio', 1);
    else if (kind === 'PHASE' && this.rng.next() < 0.28 + dropBonus) this.addMaterial('eter', 1);
    else if (r >= 2500 && this.rng.next() < 0.09 + dropBonus) this.addMaterial('alabastro', 1);
    else if (this.rng.next() < 0.025 + dropBonus) this.addMaterial('ferrita', 1);

    this.fx.addFloatingText(
      c + 0.5 + (Math.random() - 0.5) * 0.25,
      r + 0.25,
      `+${pts}`,
      mult >= 2 ? `COMBO ×${mult}` : undefined,
      mult >= 5 ? '#FACC15' : mult >= 3 ? '#38BDF8' : color,
      Math.min(1.5, 0.95 + mult * 0.06)
    );
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'SAND', color, mult >= 3 ? 6 : 4, 0.09);

    this.destructionEvents.push({
      id: ++this.destructionSeq,
      r,
      c,
      color,
      basePoints,
      kind,
    });
    if (this.destructionEvents.length > 72) {
      this.destructionEvents.shift();
    }
  }

  private recordMineralStats(rawKind: string, row: number): void {
    const known = new Set([
      'SLAG',
      'CRYSTAL',
      'CONDUCTOR',
      'PHASE',
      'OXYGEN',
      'GEODE',
      'CRYO_VENT',
      'MAGMA_NODE',
      'GRAVEL',
      'BOUNCE_PAD',
      'RESONANCE_VEIN',
      'SUPPORT_BEAM',
      'GAS_POCKET',
      'ACID_VAT',
      'GRAV_WELL',
      'SHOCK_MINE',
      'TREASURE_CACHE',
      'ARTIFACT_POD',
    ]);
    const normKind = known.has(rawKind) ? rawKind : 'SOLID';
    const prev = this.runMineralStats[normKind];
    const nextCount = (prev?.destroyed || 0) + 1;
    this.runMineralStats[normKind] = {
      destroyed: nextCount,
      deepestRow: Math.max(prev?.deepestRow || 0, Math.max(0, row)),
    };

    if (normKind === 'SOLID' && nextCount >= 25) {
      this.unlockLoreFragment('LORE_02_VETA_ROJA');
    } else if (normKind === 'SLAG') {
      this.unlockLoreFragment('LORE_03_ESCORIA');
    } else if (normKind === 'CRYSTAL') {
      this.unlockLoreFragment('LORE_05_CRISTAL');
    } else if (normKind === 'CONDUCTOR') {
      this.unlockLoreFragment('LORE_07_CONDUCTOR');
    } else if (normKind === 'PHASE') {
      this.unlockLoreFragment('LORE_09_FASE');
    } else if (normKind === 'GRAVEL' || normKind === 'BOUNCE_PAD') {
      this.unlockLoreFragment('LORE_11_GRAVA');
    } else if (normKind === 'GAS_POCKET' || normKind === 'ACID_VAT') {
      this.unlockLoreFragment('LORE_12_QUIMICA');
    } else if (normKind === 'TREASURE_CACHE') {
      this.unlockLoreFragment('LORE_13_BOVEDAS');
    }
  }

  private unlockLoreFragment(id: string): void {
    if (this.discoveredLore.has(id)) return;
    this.discoveredLore.add(id);
    const def = LORE_FRAGMENTS.find((f) => f.id === id);
    if (def) {
      soundEngine.playSeismicSeal();
      this.addFloatingText(4.5, Math.max(2, this.py - 1.6), 'REGISTRO RECUPERADO', def.title.toUpperCase(), '#C084FC');
    }
  }

  public getEffectiveMoveSpeedMult(): number {
    const upg = this.getRigUpgrades();
    const lvlBonus = Math.min(0.15, Math.max(0, this.getRigLevel() - 1) * 0.015);
    const ddaTempoBonus = 1 + (this.dynamicDescentSpeedMult - 1) * 0.28;
    const odMult = this.overdriveTimer > 0 ? 1.2 : 1;
    return this.getChassisDef().moveSpeedMult * (1 + upg.thrusterTier * 0.08 + lvlBonus) * ddaTempoBonus * odMult;
  }

  public getEffectiveParryFrames(): number {
    const base = this.hasModule('QUA_FLUX')
      ? this.hasModuleMk2('QUA_FLUX')
        ? 18
        : 14
      : COYOTE_CRUSH_FRAMES;
    return base + this.getRigUpgrades().armorTier * 2 + (this.hasRelic('REL_PARRY_LENS') ? 4 : 0);
  }

  public hasModule(id: string): boolean {
    return this.modules.some((m) => m.id === id);
  }

  public hasModuleMk2(id: string): boolean {
    return this.modules.some((m) => m.id === id && m.mk2);
  }

  public hasOvercharge(id: string): boolean {
    return this.overcharges.includes(id);
  }

  public getStratumForRow(row: number): StratumPalette {
    if (this.config.mode === 'CAMPAIGN' && row >= 3000) {
      return STRATA[6];
    }
    if (row >= 2500 && (this.inStratum6 || this.config.mode === 'CAMPAIGN')) {
      return STRATA[5];
    }
    if (this.config.mode === 'ENDLESS' && row >= 2500) {
      const cycle = Math.floor((row - 2500) / 500) % STRATA.length;
      return STRATA[cycle];
    }
    for (const s of STRATA) {
      if (row >= s.depthStart && row < s.depthEnd) return s;
    }
    return STRATA[4];
  }

  public getCurrentWobbleFrames(row: number): number {
    const stratum = this.getStratumForRow(row);
    let sec = stratum.wobbleSeconds;
    if (this.config.mode === 'ENDLESS' && row > 2500) {
      const extra = Math.min(0.1, ((row - 2500) / 2500) * 0.08);
      sec = Math.max(0.25, sec - extra);
    }
    if (this.activeMutators.includes('FAST_WOBBLE')) sec *= 0.8;
    if (this.hasOvercharge('OC_HYPER_GRAV')) sec *= 0.7;
    if (this.pressureActiveTimer > 0) sec *= 0.72;
    if (this.config.ascension >= 3) sec *= 0.92;
    return Math.max(12, Math.round(sec * 60));
  }

  // ==================== CAMPAIGN STORYTELLING & BELT GADGETS ====================

  private presentStoryTransmission(tx: StoryTransmission): void {
    if (this.triggeredStoryIds.has(tx.id)) return;
    this.triggeredStoryIds.add(tx.id);
    const prof = SPEAKER_PROFILES[tx.speaker];
    const alreadySeen = (this.config.archive.seenStoryIds || []).includes(tx.id);
    const shouldSkipModal =
      tx.isTicker || (Boolean(this.config.skipSeenDialogues) && alreadySeen && (!tx.choices || tx.choices.length === 0));

    if (shouldSkipModal) {
      this.activeTicker = {
        speaker: tx.speaker,
        name: prof.name,
        text: tx.lines[0] || tx.title,
        color: prof.color,
        timer: 320,
      };
      soundEngine.playDialogueBlip(tx.speaker);
      return;
    }
    this.pendingStory = tx;
    soundEngine.playDialogueBlip(tx.speaker);
  }

  public tryTriggerStoryByEvent(event: StoryTransmission['triggerEvent']): void {
    if (!event || this.config.mode !== 'CAMPAIGN') return;
    const match = STORY_TRANSMISSIONS.find((s) => s.triggerEvent === event && !this.triggeredStoryIds.has(s.id));
    if (match) this.presentStoryTransmission(match);
  }

  public resolvePendingStory(choiceId?: string): void {
    const st = this.pendingStory;
    if (!st) return;
    this.pendingStory = null;
    if (!choiceId || !st.choices) return;

    this.storyChoicesMade[st.id] = choiceId;
    if (choiceId === 'CH_CH2_EXTRACTION') {
      this.addIsotopes(40);
      this.addMaterial('ferrita', 6);
      this.addMaterial('cuarzo', 4);
      this.addFloatingText(4.5, this.py - 1.5, '+40 ISO · MATERIALES', 'DRONES DE EXTRACCIÓN', '#FACC15');
    } else if (choiceId === 'CH_CH2_SURVIVAL') {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 35);
      this.kineticShields += 2;
      this.addFloatingText(4.5, this.py - 1.5, '+35% O₂ · +2 ESCUDOS', 'RESERVA CRIOGÉNICA', '#38BDF8');
    } else if (choiceId === 'CH_CH4_POWER') {
      this.overdrive = 100;
      this.addMaterial('ignita', 4);
      this.addMaterial('titanio', 3);
      this.addFloatingText(4.5, this.py - 1.5, 'OVERDRIVE 100% · +IGNITA', undefined, '#F97316');
    } else if (choiceId === 'CH_CH4_ARMOR') {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 40);
      this.kineticShields += 2;
      this.addIsotopes(30);
      this.addFloatingText(4.5, this.py - 1.5, '+40% O₂ · +2 ESCUDOS', undefined, '#A3E635');
    } else if (choiceId === 'CH_DESCEND_DEEP') {
      this.deepDescentUnlocked = true;
      this.inStratum6 = true;
      this.stratum6CeilingRow = Math.max(2492, this.py - 14);
      this.discoveredCodex.add('STRATUM_6');
      this.addMaterial('eter', 4);
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 40);
      this.addFloatingText(4.5, 2496, 'COMPUERTA FORZADA', 'RUMBO AL HORIZONTE 3500m', '#C084FC');
    } else if (choiceId === 'CH_EXTRACT_VICTORY') {
      this.triggerVictory(false);
    }
    soundEngine.playUiClick();
  }

  public useBeltGadget(slotIdx: number): boolean {
    if (this.finished || this.pendingStory) return false;
    const gid = this.belt[slotIdx];
    if (!gid) return false;
    this.belt[slotIdx] = null;
    this.consumedBeltSlots.push(gid);
    this.gadgetsUsed++;
    soundEngine.playGadgetUse();

    const pRow = Math.max(0, this.gridRow);
    const pCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));

    switch (gid) {
      case 'GAD_O2_CELL':
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 45);
        this.oxygenFreezeTimer = Math.max(this.oxygenFreezeTimer, 240);
        this.inLastBreath = false;
        this.fx.spawnCellularBurst(this.px + 0.5, this.py - 0.5, 'CRYO', '#38BDF8', 16, 0.14);
        this.addFloatingText(this.px + 0.5, this.py - 1.2, '+45% O₂ · CRIO 4s', 'PULMÓN PORTÁTIL', '#38BDF8');
        break;
      case 'GAD_SEISMIC_CHARGE':
        this.invulnTimer = Math.max(this.invulnTimer, 24);
        this.triggerBlastArea(pRow + 1, pCol, 2, true);
        this.fx.spawnBlastWave({
          x: pCol + 0.5,
          y: pRow + 1.5,
          radius: 0.4,
          maxRadius: 4.2,
          life: 16,
          maxLife: 16,
          color: '#F97316',
        });
        if (this.activeGuardian) this.damageGuardian(1);
        this.triggerShake(7, 10);
        soundEngine.playDetonate(3);
        this.recomputeClustersAndSupport();
        this.addFloatingText(this.px + 0.5, this.py - 1.2, 'CARGA SÍSMICA 5×5!', undefined, '#F97316');
        break;
      case 'GAD_CRYO_BOMB':
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 20);
        this.oxygenFreezeTimer = Math.max(this.oxygenFreezeTimer, 300);
        for (let rr = Math.max(this.minPrunedRow, pRow - 10); rr <= pRow + 10; rr++) {
          for (let cc = 0; cc < GRID_COLS; cc++) {
            const c = this.getCell(rr, cc);
            if (c.kind === 'SLAG') this.breakSlag(rr, cc);
            else if (c.state === 'IGNITING') c.fuseTimer += 150;
          }
        }
        this.fx.spawnCellularBurst(this.px + 0.5, this.py - 0.5, 'CRYO', '#A5F3FC', 22, 0.16);
        this.recomputeClustersAndSupport();
        this.addFloatingText(this.px + 0.5, this.py - 1.2, 'BOMBA CRIOGÉNICA!', 'ESCORIA PULVERIZADA', '#67E8F9');
        break;
      case 'GAD_PHASE_SWAP': {
        const stratum = this.getStratumForRow(pRow + 2);
        const targetColor = this.rng.int(0, Math.max(1, stratum.colorCount) - 1);
        for (let rr = pRow + 1; rr <= pRow + 3; rr++) {
          for (let cc = Math.max(0, pCol - 1); cc <= Math.min(GRID_COLS - 1, pCol + 1); cc++) {
            const cell = this.getCell(rr, cc);
            if (cell.state === 'SOLID' && cell.kind !== 'RIVET' && cell.kind !== 'MONOLITH') {
              cell.kind = 'SOLID';
              cell.color = targetColor;
            }
          }
        }
        this.recomputeClustersAndSupport();
        this.checkIgnitions(2);
        this.addFloatingText(this.px + 0.5, this.py - 1.2, 'INVERSOR CUÁNTICO 3×3', undefined, '#C084FC');
        break;
      }
      case 'GAD_REPAIR_SHIELD':
        this.kineticShields += 2;
        this.invulnTimer = Math.max(this.invulnTimer, 120);
        this.addFloatingText(this.px + 0.5, this.py - 1.2, '+2 ESCUDOS CINÉTICOS', 'INVULN 2s', '#A3E635');
        break;
      case 'GAD_OVERDRIVE_INJ':
        this.overdrive = 100;
        this.tryActivateOverdrive();
        break;
      case 'GAD_SONAR_PULSE':
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 12);
        for (let rr = Math.max(this.minPrunedRow, pRow - 4); rr <= pRow + 7; rr++) {
          for (let cc = 0; cc < GRID_COLS; cc++) {
            const c = this.getCell(rr, cc);
            if (c.kind === 'SLAG') this.breakSlag(rr, cc);
          }
        }
        this.fx.spawnBlastWave({
          x: pCol + 0.5,
          y: pRow + 0.5,
          radius: 0.4,
          maxRadius: 5.5,
          life: 16,
          maxLife: 16,
          color: '#FBBF24',
        });
        this.recomputeClustersAndSupport();
        this.addFloatingText(this.px + 0.5, this.py - 1.2, 'PULSO DE SONAR!', 'ESCORIA PULVERIZADA +12% O₂', '#FBBF24');
        break;
      case 'GAD_RESONANCE_CELL':
        this.resonanceCharge = 100;
        this.triggerOperatorResonance();
        break;
    }
    return true;
  }

  public getCell(r: number, c: number): Cell {
    if (c < 0 || c >= GRID_COLS || r < 0) return makeEmptyCell();
    const row = this.grid.get(r);
    if (!row) return makeEmptyCell();
    return row[c];
  }

  private setCell(r: number, c: number, cell: Cell): void {
    if (c < 0 || c >= GRID_COLS || r < 0) return;
    let row = this.grid.get(r);
    if (!row) {
      row = Array.from({ length: GRID_COLS }, () => makeEmptyCell());
      this.grid.set(r, row);
    }
    row[c] = cell;
  }

  private getAvailableModulePool() {
    const unlocked = new Set(this.config.archive.unlockedModules);
    const banished = new Set(this.config.archive.banishedModules);
    return MODULES.filter((m) => unlocked.has(m.id) && !banished.has(m.id));
  }

  private generateRowsUpTo(targetMaxRow: number): void {
    while (this.maxGeneratedRow < targetMaxRow) {
      const r = this.maxGeneratedRow + 1;
      this.generateSingleRow(r);
      this.maxGeneratedRow = r;
    }
  }

  private generateSingleRow(r: number): void {
    const stratum = this.getStratumForRow(r);
    const colorCount = stratum.colorCount;
    const row: Cell[] = Array.from({ length: GRID_COLS }, () => makeEmptyCell());

    // Special structural rows:
    // 1. Breach Chamber at odd 250m (250, 750, 1250, 1750, 2250) in CAMPAIGN/ENDLESS
    if (
      (this.config.mode === 'CAMPAIGN' || this.config.mode === 'ENDLESS') &&
      r > 10 &&
      r % 250 === 0 &&
      r % 500 !== 0
    ) {
      // Clear 3 rows above for breathing room
      for (let clearR = r - 3; clearR < r; clearR++) {
        const prev = this.grid.get(clearR);
        if (prev) {
          for (let c = 0; c < GRID_COLS; c++) prev[c] = makeEmptyCell();
        }
      }
      // Build 3 crystal breach gates (cols 0-2, 3-5, 6-8) with solid rivet dividers
      for (let c = 0; c < GRID_COLS; c++) {
        const gateIdx = Math.floor(c / 3);
        const cell = makeEmptyCell();
        if (c === 2 || c === 5) {
          // Wait: let's make cols 0,1 gate 0; col 2 divider? No, 3 gates of 3 cols!
          // Make all 3 cols of each gate drillable breach seals!
        }
        cell.state = 'SOLID';
        cell.kind = 'BREACH_SEAL';
        cell.color = gateIdx;
        cell.hp = 1;
        cell.breachOptionIndex = gateIdx;
        row[c] = cell;
      }
      this.grid.set(r, row);
      return;
    }

    // 2. Bifurcation at 515m / 1515m (immediately following Warden 500m / Forge 1500m)
    if (
      this.config.mode === 'CAMPAIGN' &&
      r > 10 &&
      (r === 515 || r === 1515)
    ) {
      for (let clearR = r - 3; clearR < r; clearR++) {
        const prev = this.grid.get(clearR);
        if (prev) {
          for (let c = 0; c < GRID_COLS; c++) prev[c] = makeEmptyCell();
        }
      }
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = makeEmptyCell();
        if (c === 4) {
          cell.state = 'SOLID';
          cell.kind = 'RIVET';
          cell.hp = 99;
        } else {
          cell.state = 'SOLID';
          cell.kind = 'BIFURCATION_SEAL';
          cell.bifurcationSide = c < 4 ? 'LEFT' : 'RIGHT';
          cell.hp = 1;
        }
        row[c] = cell;
      }
      this.grid.set(r, row);
      return;
    }

    // 3. Guardian Arena Floor Locks (Campaign 500/1000/1500/2000/2500/3500 or Boss Rush Trial)
    const isBossLockRow =
      (this.config.mode === 'CAMPAIGN' &&
        (r === 500 || r === 1000 || r === 1500 || r === 2000 || r === 2500 || r === 3500)) ||
      (this.config.mode === 'TRIAL' &&
        this.config.trialId === 'BOSS_RUSH' &&
        (r === 120 || r === 240 || r === 360 || r === 480 || r === 600));
    if (isBossLockRow) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = makeEmptyCell();
        cell.state = 'SOLID';
        cell.kind = 'RIVET';
        cell.hp = 99;
        row[c] = cell;
      }
      this.grid.set(r, row);
      return;
    }

    // 3b. Sculpted Adventure Treasure Chambers (~every 360m, away from breach/boss locks)
    if (
      r > 80 &&
      r % 360 === 0 &&
      r % 250 !== 0 &&
      r % 500 !== 0 &&
      this.config.mode !== 'DUEL'
    ) {
      const prev = this.grid.get(r - 1);
      if (prev) {
        for (let cc = 3; cc <= 5; cc++) prev[cc] = makeEmptyCell();
      }
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = makeEmptyCell();
        if (c === 4) {
          cell.state = 'SOLID';
          cell.kind = 'TREASURE_CACHE';
          cell.hp = 1;
        } else if (c === 3 || c === 5) {
          cell.state = 'SOLID';
          cell.kind = 'GEODE';
          cell.hp = 1;
        } else if (c === 2 || c === 6) {
          cell.state = 'SOLID';
          cell.kind = r >= 700 ? 'SHOCK_MINE' : 'SLAG';
          cell.hp = r >= 700 ? 1 : this.getChassisDef().slagHits;
        } else {
          cell.state = 'SOLID';
          cell.kind = 'SOLID';
          cell.color = c % colorCount;
          cell.hp = 1;
        }
        row[c] = cell;
      }
      this.grid.set(r, row);
      return;
    }

    // 4. Unique Biome Transition Strata Layer surrounding every 500m milestone (e.g. 500m, 1000m, 1500m, 2000m...)
    const distFromMilestone = Math.min(r % 500, 500 - (r % 500));
    if (r >= 488 && distFromMilestone <= 6) {
      const incoming = this.getStratumForRow(Math.round(r / 500) * 500 + 5);
      const outgoing = this.getStratumForRow(Math.max(0, Math.round(r / 500) * 500 - 10));
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = makeEmptyCell();
        // Sculpted central geode arch pocket on the immediate threshold rows
        if (distFromMilestone <= 1 && c >= 3 && c <= 5 && r % 500 !== 0) {
          row[c] = cell;
          continue;
        }
        // Flanking crystalline frontier veins on shaft edges
        if (c === 0 || c === GRID_COLS - 1) {
          cell.state = 'SOLID';
          cell.kind = distFromMilestone % 2 === 0 ? 'CRYSTAL' : 'SLAG';
          cell.color = cell.kind === 'CRYSTAL' ? c % Math.min(incoming.colorCount, colorCount) : -1;
          cell.hp = cell.kind === 'SLAG' ? this.getChassisDef().slagHits : 1;
          row[c] = cell;
          continue;
        }
        // Chromatic frontier phase blocks blending outgoing/incoming palettes without pre-igniting
        const colIdx = (c + r * 2) % Math.min(colorCount, incoming.colorCount);
        cell.state = 'SOLID';
        cell.kind = (c + r) % 3 === 0 ? 'PHASE' : (c + r) % 5 === 0 ? 'CRYSTAL' : 'SOLID';
        cell.color = colIdx;
        if (cell.kind === 'PHASE') {
          cell.altColor = (colIdx + 1) % Math.min(colorCount, outgoing.colorCount);
        }
        cell.hp = 1;
        row[c] = cell;
      }
      // Guarantee O2 cryo vent right past the biome threshold (dist === 4 above or after)
      if (r % 500 === 4) {
        const vent = makeEmptyCell();
        vent.state = 'SOLID';
        vent.kind = 'OXYGEN';
        vent.hp = 1;
        row[4] = vent;
      }
      this.grid.set(r, row);
      return;
    }

    // Normal procedural organic stratum generation scaled dynamically with depth density boost
    const densityBoost = this.dynamicBlockDensityBoost;
    const slagDensity =
      (this.activeMutators.includes('HEAVY_SLAG') ? 0.14 : 0.04 + (stratum.id - 1) * 0.02) +
      densityBoost * 0.48;
    const crystalChance =
      (stratum.id === 2 || this.config.ascension >= 2 || this.activeMutators.includes('CRYSTAL_FAULT')
        ? this.activeMutators.includes('CRYSTAL_FAULT')
          ? 0.2
          : 0.09
        : 0) +
      densityBoost * 0.22;
    const conductorChance = stratum.id === 3 ? 0.075 + densityBoost * 0.14 : densityBoost > 0.12 ? 0.025 : 0;
    const rivetChance = stratum.id === 4 ? 0.065 + densityBoost * 0.08 : stratum.id >= 5 ? 0.04 + densityBoost * 0.08 : 0;
    const phaseChance = stratum.id === 5 ? 0.14 + densityBoost * 0.12 : 0;

    // Procedural Subterranean Room Archetype Planner (tunnels, narrows, caverns, vaults, halls)
    let rowArch: RoomArchetype = 'STANDARD';
    let roomBanner: string | undefined;
    let roomBannerColor: string | undefined;
    let secretHint = false;
    if (this.config.mode !== 'DUEL' && r > 18 && !(this.tutorialStep > 0 && r <= 14)) {
      this.roomRowsLeft--;
      if (this.roomRowsLeft <= 0) {
        if (this.activeRoomArchetype !== 'STANDARD') {
          this.activeRoomArchetype = 'STANDARD';
          this.roomRowsLeft = this.rng.int(5, 8);
        } else {
          const rRoll = this.rng.next();
          if (r > 30 && rRoll < 0.16) {
            this.activeRoomArchetype = 'SECRET_VAULT';
            this.roomRowsLeft = 4;
            roomBanner = 'BÓVEDA OCULTA';
            roomBannerColor = '#FACC15';
          } else if (rRoll < 0.34) {
            this.activeRoomArchetype = 'NARROWS';
            this.roomRowsLeft = 7;
            roomBanner = 'ESTRECHAMIENTO';
            roomBannerColor = '#F97316';
          } else if (rRoll < 0.52) {
            this.activeRoomArchetype = 'TWIN_TUNNELS';
            this.roomRowsLeft = 7;
            roomBanner = 'TÚNELES GEMELOS';
            roomBannerColor = '#38BDF8';
          } else if (rRoll < 0.70) {
            this.activeRoomArchetype = 'OPEN_CAVERN';
            this.roomRowsLeft = 7;
            roomBanner = 'CAVERNA ABIERTA';
            roomBannerColor = '#A3E635';
          } else if (rRoll < 0.86) {
            this.activeRoomArchetype = 'ZIGZAG_CORRIDOR';
            this.roomRowsLeft = 8;
            roomBanner = 'GALERÍA EN ZIGZAG';
            roomBannerColor = '#FB923C';
          } else {
            this.activeRoomArchetype = 'MINING_HALL';
            this.roomRowsLeft = 6;
            roomBanner = 'CÁMARA DE EXTRACCIÓN';
            roomBannerColor = '#FDE047';
          }
        }
      }
      rowArch = this.activeRoomArchetype;
      secretHint = rowArch === 'SECRET_VAULT';
      this.rowMeta.set(r, {
        archetype: rowArch,
        bannerText: roomBanner,
        bannerColor: roomBannerColor,
        secretHint,
      });
    }

    // Architectural Slag Beam / Arch chance (scales tighter with DDA block density)
    const beamProb = Math.min(0.92, 0.65 + densityBoost * 1.1);
    const makeSlagBeam = r > 14 && r % 14 === 0 && this.rng.next() < beamProb;
    const beamStart = makeSlagBeam ? this.rng.int(0, GRID_COLS - 4) : -1;
    const beamLen = makeSlagBeam ? this.rng.int(2, 3) : 0;

    // Crafted 3-Turn Tutorial Layout (rows 5..12) when tutorial is active
    if (this.tutorialStep > 0 && r >= 5 && r <= 12) {
      if (r === 5) {
        // Row 5: clean 1-block platform to drill through (Step 1)
        for (let c = 0; c < GRID_COLS; c++) {
          const cell = makeEmptyCell();
          cell.state = 'SOLID';
          cell.kind = 'SOLID';
          cell.color = c % 4;
          row[c] = cell;
        }
        this.grid.set(r, row);
        return;
      }
      if (r === 6) {
        // Row 6: open corridor with walls on edges so player drops smoothly onto the Step 2 puzzle
        for (let c = 0; c < GRID_COLS; c++) {
          if (c === 0 || c === GRID_COLS - 1) {
            const cell = makeEmptyCell();
            cell.state = 'SOLID';
            cell.kind = 'SOLID';
            cell.color = 2;
            row[c] = cell;
          }
        }
        this.grid.set(r, row);
        return;
      }
      if (r === 7) {
        // Row 7: symmetric 3-block wings [1,2,3] & [5,6,7] around col 4 -> either Q or E from col 4 ignites 4!
        const pattern = [1, 0, 0, 0, 1, 0, 0, 0, 1];
        for (let c = 0; c < GRID_COLS; c++) {
          const cell = makeEmptyCell();
          cell.state = 'SOLID';
          cell.kind = 'SOLID';
          cell.color = pattern[c];
          row[c] = cell;
        }
        this.grid.set(r, row);
        return;
      }
      if (r === 8) {
        // Row 8: O2 capsule in col 4 right beneath the ignited chute, alternating colors 2/3 so row 7 never merges vertically
        for (let c = 0; c < GRID_COLS; c++) {
          const cell = makeEmptyCell();
          cell.state = 'SOLID';
          cell.kind = c === 4 ? 'OXYGEN' : 'SOLID';
          cell.color = c === 4 ? -1 : c % 2 === 0 ? 2 : 3;
          row[c] = cell;
        }
        this.grid.set(r, row);
        return;
      }
      if (r === 9) {
        // Row 9: solid landing floor with 2 Slag blocks on left to introduce armored Basalt Slag
        for (let c = 0; c < GRID_COLS; c++) {
          const cell = makeEmptyCell();
          cell.state = 'SOLID';
          cell.kind = c >= 1 && c <= 2 ? 'SLAG' : 'SOLID';
          cell.color = c >= 1 && c <= 2 ? -1 : c % 2 === 0 ? 1 : 0;
          cell.hp = c >= 1 && c <= 2 ? this.getChassisDef().slagHits : 1;
          row[c] = cell;
        }
        this.grid.set(r, row);
        return;
      }
    }

    for (let c = 0; c < GRID_COLS; c++) {
      const cell = makeEmptyCell();

      // Guarantee safe starting landing platform at r === 5 (or startDepth + 5)
      if (r === 5) {
        cell.state = 'SOLID';
        cell.kind = 'SOLID';
        cell.color = (c + r) % colorCount;
        row[c] = cell;
        continue;
      }

      // Slag architectural beam
      if (makeSlagBeam && c >= beamStart && c < beamStart + beamLen) {
        cell.state = 'SOLID';
        cell.kind = 'SLAG';
        cell.hp = this.getChassisDef().slagHits;
        row[c] = cell;
        continue;
      }

      // Open pockets shrink dynamically as depth block density rises
      const pocketChance = Math.max(0.015, 0.07 - densityBoost * 0.22);
      if (r > 7 && this.rng.next() < pocketChance) {
        row[c] = cell;
        continue;
      }

      // Special blocks by stratum
      const roll = this.rng.next();
      if (roll < rivetChance && c > 0 && c < GRID_COLS - 1 && r % 4 === 0) {
        cell.state = 'SOLID';
        cell.kind = 'RIVET';
        cell.hp = 99;
        row[c] = cell;
        continue;
      }

      if (roll < rivetChance + crystalChance) {
        cell.state = 'SOLID';
        cell.kind = 'CRYSTAL';
        cell.color = this.rng.int(0, colorCount - 1);
        cell.hp = 1;
        row[c] = cell;
        continue;
      }

      if (roll < rivetChance + crystalChance + conductorChance) {
        cell.state = 'SOLID';
        cell.kind = 'CONDUCTOR';
        cell.color = -1;
        cell.hp = 2;
        row[c] = cell;
        continue;
      }

      if (roll < rivetChance + crystalChance + conductorChance + slagDensity && r > 10) {
        cell.state = 'SOLID';
        cell.kind = 'SLAG';
        cell.hp = this.getChassisDef().slagHits;
        row[c] = cell;
        continue;
      }

      const specialBase = rivetChance + crystalChance + conductorChance + slagDensity;
      const isGravelTrial = this.config.mode === 'TRIAL' && this.config.trialId === 'GRAVEL_AVALANCHE';
      const isVolatileTrial = this.config.mode === 'TRIAL' && this.config.trialId === 'VOLATILE_CHAIN';

      const geodeChance = r > 12 && stratum.id <= 7 ? 0.026 : 0;
      const cryoVentChance = stratum.id >= 2 && stratum.id <= 7 ? 0.018 : 0;
      const magmaNodeChance = (stratum.id >= 3 && stratum.id <= 7) || isVolatileTrial ? (isVolatileTrial ? 0.055 : 0.018) : 0;
      const gravelChance = r > 14 ? (isGravelTrial ? 0.14 : stratum.id <= 5 ? 0.026 : 0.014) : 0;
      const bounceChance = r > 40 ? (isGravelTrial ? 0.055 : 0.018) : 0;
      const resonanceVeinChance = r > 24 && stratum.id <= 7 ? 0.022 : 0;
      const supportBeamChance = r > 18 && stratum.id <= 7 ? 0.018 : 0;
      const gasChance = r > 320 || isVolatileTrial ? (isVolatileTrial ? 0.075 : 0.024) : 0;
      const acidChance = r > 520 ? 0.018 : 0;
      const gravChance = r > 1100 ? 0.016 : 0;
      const mineBase = r > 800 || isVolatileTrial ? (isVolatileTrial ? 0.032 : 0.016) : 0;
      const mineChance = mineBase * (this.hasOvercharge('OC_TESLA_COIL') ? 2 : 1);
      const cacheRandomChance = r > 90 && r % 47 === 0 ? 0.02 : 0;

      let acc = specialBase;
      const spawnSpec = (kind: CellState, hp = 1) => {
        cell.state = 'SOLID';
        cell.kind = kind;
        cell.color = -1;
        cell.hp = hp;
        row[c] = cell;
      };

      if (roll < (acc += geodeChance)) {
        spawnSpec('GEODE', 1);
        continue;
      }
      if (roll < (acc += cryoVentChance)) {
        spawnSpec('CRYO_VENT', 1);
        continue;
      }
      if (roll < (acc += magmaNodeChance)) {
        spawnSpec('MAGMA_NODE', 1);
        continue;
      }
      if (roll < (acc += gravelChance)) {
        spawnSpec('GRAVEL', 1);
        continue;
      }
      if (roll < (acc += bounceChance)) {
        spawnSpec('BOUNCE_PAD', 1);
        continue;
      }
      if (roll < (acc += resonanceVeinChance)) {
        spawnSpec('RESONANCE_VEIN', 1);
        continue;
      }
      if (roll < (acc += supportBeamChance)) {
        spawnSpec('SUPPORT_BEAM', 1);
        continue;
      }
      if (roll < (acc += gasChance)) {
        spawnSpec('GAS_POCKET', 1);
        continue;
      }
      if (roll < (acc += acidChance)) {
        spawnSpec('ACID_VAT', 1);
        continue;
      }
      if (roll < (acc += gravChance)) {
        spawnSpec('GRAV_WELL', 1);
        continue;
      }
      if (roll < (acc += mineChance)) {
        spawnSpec('SHOCK_MINE', 1);
        continue;
      }
      if (roll < (acc += cacheRandomChance)) {
        spawnSpec('TREASURE_CACHE', 1);
        continue;
      }

      // Standard colored block (organic 1-3 cluster bias, anti-ignition check)
      let chosenColor = this.rng.int(0, colorCount - 1);
      // Organic bias: 35% chance to match left or top neighbor if safe
      const leftColor = c > 0 && row[c - 1].kind === 'SOLID' ? row[c - 1].color : -1;
      const topCell = this.getCell(r - 1, c);
      const topColor = topCell.kind === 'SOLID' ? topCell.color : -1;

      if (leftColor >= 0 && this.rng.next() < 0.34) {
        chosenColor = leftColor;
      } else if (topColor >= 0 && this.rng.next() < 0.28) {
        chosenColor = topColor;
      }

      // Anti-ignition guarantee (Section 7.2): never spawn a 4+ group!
      row[c].state = 'SOLID';
      row[c].kind = roll < acc + phaseChance ? 'PHASE' : 'SOLID';
      row[c].color = chosenColor;
      if (row[c].kind === 'PHASE') {
        row[c].altColor = (chosenColor + 1 + this.rng.int(0, colorCount - 2)) % colorCount;
      }
      row[c].hp = 1;

      // Temporarily place row to test flood-fill size
      this.grid.set(r, row);
      if (this.countSameColorClusterAt(r, c, chosenColor) >= 4) {
        // Pick a safe alternative color
        for (let attempt = 1; attempt < colorCount; attempt++) {
          const alt = (chosenColor + attempt) % colorCount;
          row[c].color = alt;
          if (this.countSameColorClusterAt(r, c, alt) < 4) {
            break;
          }
        }
      }
    }

    // Apply Non-Linear Room Sculpting while guaranteeing passability & anti-pit safety
    if (rowArch !== 'STANDARD') {
      const makeCell = (kind: CellState, hp = 1, col = -1): Cell => {
        const mc = makeEmptyCell();
        mc.state = kind === 'EMPTY' ? 'EMPTY' : 'SOLID';
        mc.kind = kind;
        mc.hp = hp;
        mc.color = col;
        return mc;
      };
      if (rowArch === 'NARROWS') {
        if (r % 2 === 0) {
          row[0] = makeCell('SLAG', this.getChassisDef().slagHits);
          row[GRID_COLS - 1] = makeCell('SLAG', this.getChassisDef().slagHits);
        }
        row[1] = makeCell('SLAG', this.getChassisDef().slagHits);
        row[GRID_COLS - 2] = makeCell('SLAG', this.getChassisDef().slagHits);
        if (r % 3 !== 0) row[4] = makeEmptyCell();
      } else if (rowArch === 'TWIN_TUNNELS') {
        row[4] = r % 3 === 0 ? makeCell('SUPPORT_BEAM', 1) : makeCell('SLAG', this.getChassisDef().slagHits);
        if (r % 4 !== 0) {
          row[2] = makeEmptyCell();
          row[6] = makeEmptyCell();
        }
      } else if (rowArch === 'ZIGZAG_CORRIDOR') {
        const zigLeft = Math.floor(r / 3) % 2 === 0;
        if (zigLeft) {
          for (let zc = 0; zc <= 3; zc++) row[zc] = makeCell('SLAG', this.getChassisDef().slagHits);
          if (r % 3 === 1) row[6] = makeEmptyCell();
        } else {
          for (let zc = 5; zc < GRID_COLS; zc++) row[zc] = makeCell('SLAG', this.getChassisDef().slagHits);
          if (r % 3 === 1) row[2] = makeEmptyCell();
        }
      } else if (rowArch === 'OPEN_CAVERN') {
        const isBridgeRow = this.roomRowsLeft % 4 === 1;
        if (!isBridgeRow) {
          for (let cc = 2; cc <= 6; cc++) {
            if (row[cc].kind === 'OXYGEN' || row[cc].kind === 'RESONANCE_VEIN') continue;
            row[cc] = makeEmptyCell();
          }
          if (this.roomRowsLeft % 2 === 0) {
            row[1] = makeCell('SUPPORT_BEAM', 1);
            row[7] = makeCell('SUPPORT_BEAM', 1);
          }
        } else {
          row[4] = makeCell('SOLID', 1, r % colorCount);
        }
      } else if (rowArch === 'SECRET_VAULT') {
        const leftSide = (r >> 3) % 2 === 0;
        const gateCol = leftSide ? 2 : 6;
        const vaultInner = leftSide ? [0, 1] : [7, 8];
        row[gateCol] =
          this.roomRowsLeft === 2 ? makeCell('SUPPORT_BEAM', 1) : makeCell('SLAG', this.getChassisDef().slagHits);
        if (this.roomRowsLeft === 2) {
          row[vaultInner[1]] = makeCell('TREASURE_CACHE', 1);
          row[vaultInner[0]] = makeCell('RESONANCE_VEIN', 1);
        } else if (this.roomRowsLeft === 3) {
          row[vaultInner[0]] = makeEmptyCell();
          row[vaultInner[1]] = makeCell('GEODE', 1);
        }
      } else if (rowArch === 'MINING_HALL') {
        if (this.roomRowsLeft % 2 === 0) {
          row[2] = makeCell('SUPPORT_BEAM', 1);
          row[6] = makeCell('SUPPORT_BEAM', 1);
        }
        if (this.roomRowsLeft === 3) {
          row[4] = makeCell('RESONANCE_VEIN', 1);
        } else if (row[4].state !== 'EMPTY' && row[4].kind === 'SOLID') {
          row[4] = makeCell('CRYSTAL', 1, r % colorCount);
        }
      }

      // Safety invariant A: prevent > 4 consecutive empty vertical air rows in any column
      for (let c = 0; c < GRID_COLS; c++) {
        if (row[c].state === 'EMPTY') {
          let streak = 0;
          for (let kr = 1; kr <= 4; kr++) {
            if (this.getCell(r - kr, c).state === 'EMPTY') streak++;
            else break;
          }
          if (streak >= 4) {
            row[c] = makeCell('SOLID', 1, (c + r) % colorCount);
          }
        }
      }

      // Safety invariant B: guarantee at least 3 drillable/passable columns per row
      let passableCount = 0;
      for (let c = 0; c < GRID_COLS; c++) {
        if (row[c].kind !== 'RIVET' && row[c].kind !== 'MONOLITH') passableCount++;
      }
      if (passableCount < 3) {
        row[3] = makeCell('SOLID', 1, 0);
        row[4] = makeCell('SOLID', 1, 1 % colorCount);
        row[5] = makeCell('SOLID', 1, 2 % colorCount);
      }
    }

    this.grid.set(r, row);

    // Pacing guaranteed Oxygen capsule every 18-22 rows (unless OC_ANAEROBIC)
    const o2Interval = stratum.id >= 4 ? 17 : 20;
    if (!this.hasOvercharge('OC_ANAEROBIC') && r - this.lastOxygenCapsuleRow >= o2Interval && r > 12) {
      const col = this.rng.int(1, GRID_COLS - 2);
      const cap = makeEmptyCell();
      cap.state = 'SOLID';
      cap.kind = 'OXYGEN';
      cap.hp = 1;
      row[col] = cap;
      // Ensure cell above capsule isn't a rivet
      const above = this.getCell(r - 1, col);
      if (above.kind === 'RIVET') {
        above.kind = 'SOLID';
        above.color = this.rng.int(0, colorCount - 1);
      }
      this.lastOxygenCapsuleRow = r;
    }

    // Guaranteed once-per-stratum Ancient Artifact Pod (prioritizes undiscovered artifacts!)
    if (
      this.config.mode !== 'DUEL' &&
      !this.spawnedArtifactStrata.has(stratum.id) &&
      r >= stratum.depthStart + 65 &&
      r < stratum.depthStart + 420 &&
      r % 250 !== 0 &&
      (r >= stratum.depthStart + 210 || this.rng.next() < 0.045)
    ) {
      const stratumArts = ARTIFACTS.filter((a) => a.stratumId === stratum.id);
      const ownedSet = new Set([...(this.config.archive.discoveredArtifacts || []), ...this.discoveredArtifacts]);
      const unowned = stratumArts.filter((a) => !ownedSet.has(a.id));
      const pool = unowned.length > 0 ? unowned : stratumArts;
      if (pool.length > 0 && (unowned.length > 0 || this.rng.next() < 0.65)) {
        const chosenArt = this.rng.pick(pool);
        const col = this.rng.int(1, GRID_COLS - 2);
        const pod = makeEmptyCell();
        pod.state = 'SOLID';
        pod.kind = 'ARTIFACT_POD';
        pod.artifactId = chosenArt.id;
        pod.hp = 1;
        row[col] = pod;
        this.spawnedArtifactStrata.add(stratum.id);
      }
    }

    // Secret Phase Key (Stratum I between 310m and 430m)
    if (
      this.config.mode === 'CAMPAIGN' &&
      !this.phaseKeySpawned &&
      r >= 320 &&
      r <= 420 &&
      this.rng.next() < 0.08
    ) {
      this.phaseKeySpawned = true;
      const pk = makeEmptyCell();
      pk.state = 'SOLID';
      pk.kind = 'PHASE_KEY';
      pk.hp = 99;
      row[3] = pk;
    }

    // Ghost Echo from previous run death
    if (
      this.config.archive.lastDeathEcho &&
      r === Math.max(15, this.config.archive.lastDeathEcho.depth)
    ) {
      const echo = makeEmptyCell();
      echo.state = 'SOLID';
      echo.kind = 'GHOST_ECHO';
      echo.hp = 99;
      echo.echoModuleId = this.config.archive.lastDeathEcho.moduleId;
      row[4] = echo;
    }

    // Resonance Monolith (rare in Strata II-IV)
    if (r > 520 && r % 145 === 0 && r % 250 !== 0) {
      const mCol = this.rng.int(1, GRID_COLS - 2);
      const mono = makeEmptyCell();
      mono.state = 'SOLID';
      mono.kind = 'MONOLITH';
      mono.monolithColor = this.rng.int(0, colorCount - 1);
      mono.hp = 99;
      row[mCol] = mono;
    }

    // Salvage Extraction Tube if infra unlocked
    if (
      this.config.archive.infra.salvageCapsule > 0 &&
      r > 120 &&
      r % 380 === 0
    ) {
      const tube = makeEmptyCell();
      tube.state = 'SOLID';
      tube.kind = 'EXTRACTION_TUBE';
      tube.hp = 1;
      row[this.rng.int(1, GRID_COLS - 2)] = tube;
    }
  }

  private countSameColorClusterAt(startR: number, startC: number, color: number): number {
    if (color < 0) return 0;
    const visited = new Set<string>();
    const queue: [number, number][] = [[startR, startC]];
    visited.add(`${startR},${startC}`);
    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        const key = `${nr},${nc}`;
        if (visited.has(key) || nc < 0 || nc >= GRID_COLS || nr < 0) continue;
        const neighbor = this.getCell(nr, nc);
        if (
          neighbor.state !== 'EMPTY' &&
          (neighbor.kind === 'SOLID' || neighbor.kind === 'PHASE') &&
          neighbor.color === color
        ) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }
    return visited.size;
  }

  public injectGarbageRows(count: number): void {
    const insertRow = Math.max(this.minPrunedRow + 1, Math.floor(this.py) - 7);
    const stratum = this.getStratumForRow(Math.floor(this.py));
    for (let i = 0; i < count; i++) {
      const r = insertRow - i;
      if (r < 0) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.getCell(r, c).state === 'EMPTY' && this.rng.next() < 0.78) {
          const slag = makeEmptyCell();
          slag.state = 'FALLING';
          slag.kind = 'SLAG';
          slag.hp = this.getChassisDef().slagHits;
          slag.isGarbage = true;
          this.setCell(r, c, slag);
        }
      }
    }
    this.addFloatingText(4.5, insertRow, `¡ESCORIA RIVAL ×${count}!`, undefined, stratum.blockColors[0]);
  }

  // ==================== MAIN 60 HZ TICK ====================

  public step(input: InputState): void {
    if (!this.beginTickAndCheckInputs(input)) return;
    this.stepGridMovementWithLerp(input);
    this.stepTerrainState(input.slamHeld);
    this.finishTickWorldEvents();
  }

  public beginTickAndCheckInputs(input: InputState): boolean {
    if (this.finished) return false;

    // Pause simulation during interactive Campaign Story Transmissions
    if (this.pendingStory) {
      this.updateFX();
      return false;
    }

    this.frameCount++;

    if (this.frameCount === 1 && this.config.mode === 'CAMPAIGN' && (this.config.startDepth || 0) === 0) {
      this.tryTriggerStoryByEvent('PROLOGUE');
      if (this.pendingStory) {
        this.updateFX();
        return false;
      }
    }

    if (this.activeTicker) {
      this.activeTicker.timer--;
      if (this.activeTicker.timer <= 0) this.activeTicker = null;
    }

    // Active Tactical Belt Gadgets [1], [2], [3]
    if (input.gadget1Pressed) this.useBeltGadget(0);
    if (input.gadget2Pressed) this.useBeltGadget(1);
    if (input.gadget3Pressed) this.useBeltGadget(2);

    // Hitstop & camera juice decay (preserves input buffer!)
    if (this.whiteFlashFrames > 0) this.whiteFlashFrames--;
    if (this.chromaFlashFrames > 0) this.chromaFlashFrames--;
    if (this.metronomeOnBeatFlash > 0) this.metronomeOnBeatFlash--;
    if (this.fallShockFlashFrames > 0) this.fallShockFlashFrames--;
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
      if (this.shakeTimer === 0) {
        this.shakeX = 0;
        this.shakeY = 0;
      }
    }
    this.camTrauma = Math.max(0, this.camTrauma - DT * 1.9);
    this.camZoomImpulse *= 0.86;
    if (Math.abs(this.camZoomImpulse) < 0.001) this.camZoomImpulse = 0;
    this.camKickX *= 0.72;
    this.camKickY *= 0.72;
    if (Math.abs(this.camKickX) < 0.05) this.camKickX = 0;
    if (Math.abs(this.camKickY) < 0.05) this.camKickY = 0;

    if (input.drillPressed) {
      this.bufferedAction = 'DRILL';
      this.bufferTimer = INPUT_BUFFER_FRAMES;
    } else if (input.swapLeftPressed) {
      this.bufferedAction = 'SWAP_L';
      this.bufferTimer = INPUT_BUFFER_FRAMES;
    } else if (input.swapRightPressed) {
      this.bufferedAction = 'SWAP_R';
      this.bufferTimer = INPUT_BUFFER_FRAMES;
    } else if (this.bufferTimer > 0) {
      this.bufferTimer--;
      if (this.bufferTimer === 0) this.bufferedAction = null;
    }

    if (this.hitstopFrames > 0) {
      this.hitstopFrames--;
      this.updateFX();
      return false;
    }

    // Dynamic Difficulty Adjustment (DDA) automatically scales with depth
    const depthProgress = Math.min(2.2, this.depthMeters / 1200);
    const descentSpeedMult = Number((1 + depthProgress * 0.48).toFixed(3));
    const blockDensityBoost = Number(
      Math.min(0.24, (this.depthMeters / 2400) * 0.19 + (this.depthMeters > 2500 ? 0.04 : 0)).toFixed(3)
    );
    this.setDynamicDifficulty(descentSpeedMult, blockDensityBoost);
    const ddaTier = Math.floor(this.depthMeters / 350);
    if (ddaTier > this.ddaLastTierNotified && this.depthMeters > 50) {
      this.ddaLastTierNotified = ddaTier;
      this.fx.addFloatingText(
        4.5,
        Math.max(2, this.py - 2.2),
        `PRESIÓN ×${descentSpeedMult.toFixed(2)}`,
        `DENSIDAD +${Math.round(blockDensityBoost * 100)}%`,
        '#FB923C',
        1.15
      );
    }

    // Adaptive multi-theme 16th-note soundtrack & metronome tick
    soundEngine.tickMetronome(this.getStratumForRow(this.depthMeters).id, true, this.hasAnyActiveIgnition(), {
      comboMult: this.comboMultiplier,
      comboCount: this.comboCount,
      styleRank: this.styleRank,
      overdriveActive: this.overdriveTimer > 0,
      guardianActive: Boolean(this.activeGuardian),
      guardianPhase2: this.activeGuardian?.phase === 2,
      hazardActive: Boolean(this.activeHazard && this.activeHazard.activeTimer > 0 && this.activeHazard.warningTimer <= 0),
      inLastBreath: this.inLastBreath,
      feverActive: Boolean(this.activeFever),
      isFallingFast: this.playerState === 'falling' && this.vy > 10,
    });

    // Style rank smooth decay
    if (this.styleDecayTimer > 0) {
      this.styleDecayTimer--;
    } else if (this.styleScore > 0) {
      const drop = this.rankIndex(this.styleRank) >= 4 ? 1.8 : 1.1;
      this.styleScore = Math.max(0, this.styleScore - drop);
      this.styleRank = this.computeStyleRank(this.styleScore);
    }

    this.stepFeverAndPuddles();

    // Combo decay timer
    if (this.comboTimerFrames > 0) {
      this.comboTimerFrames--;
      if (this.comboTimerFrames <= 0) {
        this.comboCount = 0;
        this.comboMultiplier = 1;
      }
    }

    // Squash, stretch & cooldown recovery
    this.squashX += (1 - this.squashX) * 0.25;
    this.squashY += (1 - this.squashY) * 0.25;
    if (this.actionPoseTimer > 0) {
      this.actionPoseTimer--;
      if (this.actionPoseTimer <= 0) this.actionPose = null;
    }
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.overdriveTimer > 0) {
      this.overdriveTimer--;
      this.swapCooldown = 0;
      if (this.overdriveTimer % 4 === 0) {
        this.fx.spawnAfterimage(
          this.px + 0.5,
          this.py - 0.5,
          this.actionPose || (this.playerState === 'falling' ? 'FALL' : 'IDLE'),
          Math.floor(this.frameCount / 6) & 3,
          this.aimDir,
          this.facing,
          '#FACC15',
          10
        );
      }
    } else if (this.swapCooldown > 0) {
      this.swapCooldown--;
    }
    if (this.invulnTimer > 0) this.invulnTimer--;
    if (this.oxygenFreezeTimer > 0) this.oxygenFreezeTimer--;
    if (this.tacticalCooldown > 0) this.tacticalCooldown--;
    if (this.overheadGuardTimer > 0) this.overheadGuardTimer--;
    if (this.overheadCounterCooldown > 0) this.overheadCounterCooldown--;
    if (this.overheadHeatDecayTimer > 0) {
      this.overheadHeatDecayTimer--;
      if (this.overheadHeatDecayTimer === 0) this.overheadCounterHeat = 0;
    }

    // Activate Overdrive if requested and charged
    if (input.overdrivePressed) {
      this.tryActivateOverdrive();
    }

    // Stratum IV Pressure Pulses (every 25s)
    const stratum = this.getStratumForRow(this.depthMeters);
    if (stratum.id === 4) {
      this.pressurePulseTimer--;
      if (this.pressurePulseTimer <= 0) {
        this.pressureActiveTimer = 300; // 5s compressed wobble
        this.pressurePulseTimer = 25 * 60;
        this.addFloatingText(4.5, this.py - 2, 'PULSO DE PRESIÓN', 'WOBBLE ACELERADO', '#E11D48');
      }
      if (this.pressureActiveTimer > 0) this.pressureActiveTimer--;
    }

    // Stratum V Phase shifting every 4 beats (~2s at 120 BPM)
    if (stratum.id === 5 || this.activeGuardian?.id === 'ARCHITECT') {
      this.phaseColorBeatCounter++;
      if (this.phaseColorBeatCounter >= 120) {
        this.phaseColorBeatCounter = 0;
        this.phaseColorToggle = !this.phaseColorToggle;
        this.shiftPhaseBlocks();
      }
      this.phaseShiftWarning = this.phaseColorBeatCounter >= 90 ? 1 : 0;
    }

    // Detonación Forzada (B / K / F)
    if (input.detonatePressed && !this.hasOvercharge('OC_RUNAWAY')) {
      this.forceDetonateAll();
    }

    // Reroll inside Breach Chamber (R / Y)
    if (input.rerollPressed && this.activeBreach && !this.activeBreach.resolved && this.rerollsRemaining > 0) {
      this.rerollsRemaining--;
      this.rollBreachOptions(this.activeBreach.yRow);
      soundEngine.playSwap();
    }

    // Handle Coyote Crush Window (9 frames)
    if (this.coyoteCrushTimer > 0) {
      this.coyoteCrushTimer--;
      // Check if player executes Parry (Up + Swap)
      if (
        (this.bufferedAction === 'SWAP_L' || this.bufferedAction === 'SWAP_R') &&
        (input.up || this.aimDir === 'UP')
      ) {
        const dir = this.bufferedAction === 'SWAP_L' ? -1 : 1;
        this.bufferedAction = null;
        this.bufferTimer = 0;
        if (this.executeKineticParry(dir)) {
          this.updateFX();
          return false;
        }
      }
      if (this.coyoteCrushTimer > 0 && this.overheadGuardTimer > 0 && this.coyoteCrushCellPos) {
        const { r: cr, c: cc } = this.coyoteCrushCellPos;
        this.coyoteCrushTimer = 0;
        this.coyoteCrushCellPos = null;
        this.overheadGuardTimer = 0;
        this.shatterOverheadBlock(cr, cc, false);
        this.updateFX();
        return false;
      }
      if (this.coyoteCrushTimer === 0 && this.coyoteCrushCellPos) {
        // Confirm lethal crush!
        this.coyoteCrushCellPos = null;
        this.handlePlayerCrushed();
        if (this.finished) return false;
      }
    }

    return true;
  }

  public stepGridMovementWithLerp(input: InputState): void {
    this.updatePlayer(input);
  }

  public stepTerrainState(slamHeld: boolean): void {
    // During Último Aliento, hostile terrain advances at 50% clutch slow-motion
    // while player movement, drilling, swaps & items remain at crisp 60 FPS!
    if (!this.inLastBreath || this.frameCount % 2 === 0) {
      this.updateCells(slamHeld);
    }
    this.applySequentialTerrainGravity();
  }

  public finishTickWorldEvents(): void {
    // Update Guardian Encounters & Environmental Hazards
    this.updateGuardian();
    this.updateEnvironmentalHazards();

    // Update Secret Stratum VI/VII Living Ceiling
    if (this.inStratum6) {
      const ceilSpeed = this.depthMeters >= 3000 ? 1.15 : 1.65;
      this.stratum6CeilingRow += ceilSpeed * DT;
      if (this.stratum6CeilingRow >= this.py - 0.5) {
        this.triggerDeath('SINGULARIDAD');
        return;
      }
    }

    // Update Oxygen
    this.updateOxygen();

    // Update Depth, Seismic Seals, Breach Chambers, Bifurcations, Guardians
    this.updateDepthEvents();

    // Generate ahead & prune far behind
    const playerRow = Math.floor(this.py);
    this.generateRowsUpTo(playerRow + 42);
    this.pruneRowsAbove(playerRow - 28);

    // Dynamic Cinematographic Camera (Look-ahead + context-driven Zoom in/out)
    const lookTarget =
      this.playerState === 'falling' && this.vy > 8
        ? 2.15
        : this.playerState === 'falling'
          ? 1.15
          : this.vy < -2 || this.aimDir === 'UP'
            ? -0.85
            : this.aimDir === 'DOWN'
              ? 0.45
              : -0.2;
    this.camLookAheadY += (lookTarget - this.camLookAheadY) * 0.1;
    const targetCam = this.py + this.camLookAheadY;
    this.cameraRow += (targetCam - this.cameraRow) * 0.22;

    const contextZoom = this.activeGuardian
      ? 0.925
      : this.playerState === 'falling' && (this.playerFallRows >= 2.2 || this.vy > 11)
        ? 0.935
        : this.overdriveTimer > 0 || this.styleRank === 'SS' || this.styleRank === 'SSS'
          ? 1.035
          : 1.0;
    const goalZoom = Math.max(0.89, Math.min(1.12, contextZoom + this.camZoomImpulse));
    this.camZoom += (goalZoom - this.camZoom) * 0.14;
    if (Math.abs(this.camZoom - 1.0) < 0.0015 && Math.abs(goalZoom - 1.0) < 0.0015) {
      this.camZoom = 1.0;
    }

    if (this.recentArtifactBanner) {
      this.recentArtifactBanner.timer--;
      if (this.recentArtifactBanner.timer <= 0) {
        this.recentArtifactBanner = null;
      }
    }
    if (this.frameCount % 12 === 0) {
      const scanRange = this.hasRelic('REL_ARTIFACT_SCANNER') ? 14 : 7;
      const centerR = Math.floor(this.py);
      let foundNearby = false;
      const hasVaultSense = this.hasModule('QUA_VAULT_SENSE');
      const vaultScanRange = this.hasModuleMk2('QUA_VAULT_SENSE') ? 8 : 6;
      for (let rr = Math.max(this.minPrunedRow, centerR - 4); rr <= centerR + scanRange && !foundNearby; rr++) {
        const rrRow = this.grid.get(rr);
        if (!rrRow) continue;
        for (let cc = 0; cc < GRID_COLS; cc++) {
          if (rrRow[cc].kind === 'ARTIFACT_POD' && rrRow[cc].state !== 'EMPTY') {
            foundNearby = true;
            break;
          }
        }
      }
      if (!foundNearby && hasVaultSense) {
        for (let rr = Math.max(this.minPrunedRow, centerR - 2); rr <= centerR + vaultScanRange; rr++) {
          if (this.rowMeta.get(rr)?.secretHint) {
            foundNearby = true;
            break;
          }
        }
      }
      this.artifactNearby = foundNearby;
    }

    // Overhead danger column check (WOBBLE or FALLING directly above player)
    const pRow = Math.max(0, Math.floor(this.py - 0.45));
    const pCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));
    let dangerCol = false;
    let minFallingDist = this.coyoteCrushTimer > 0 ? 0 : 99;
    const topDangerR = Math.max(this.minPrunedRow, pRow - 10);
    for (let rr = topDangerR; rr < pRow; rr++) {
      const c = this.getCell(rr, pCol);
      if (c.state === 'WOBBLE' || c.state === 'FALLING') {
        dangerCol = true;
        if (c.state === 'FALLING') {
          const gap = Math.max(0, pRow - (rr + c.fallOffset));
          if (gap < minFallingDist) minFallingDist = gap;
        }
      }
    }
    this.overheadDangerCol = dangerCol;
    this.overheadDangerDist = minFallingDist;

    this.updateFX();
  }

  private updateEnvironmentalHazards(): void {
    if (this.config.mode === 'DUEL' || this.tutorialStep > 0 || this.activeGuardian) {
      this.activeHazard = null;
      return;
    }
    const stratum = this.getStratumForRow(this.depthMeters);

    if (this.activeHazard) {
      const hz = this.activeHazard;
      if (hz.warningTimer > 0) {
        hz.warningTimer--;
        if (hz.warningTimer === 0) {
          if (hz.type === 'SEISMIC_TREMOR') {
            this.triggerShake(4.8, 14);
            const pRow = Math.floor(this.py);
            for (const c of hz.targetCols) {
              const cell = this.getCell(pRow - 4, c);
              if (cell.state === 'SOLID' && cell.kind !== 'RIVET') {
                cell.state = 'WOBBLE';
                cell.wobbleMax = this.getCurrentWobbleFrames(pRow - 4);
                cell.wobbleTimer = Math.floor(cell.wobbleMax * 0.5);
              }
            }
          } else if (hz.type === 'PHASE_STORM') {
            this.shiftPhaseBlocks();
          }
        }
      } else if (hz.activeTimer > 0) {
        hz.activeTimer--;
        if (hz.type === 'CRYO_SHARDS') {
          this.cryoHazardTick++;
          if (this.cryoHazardTick % 24 === 0) {
            for (const col of hz.targetCols) {
              const dropR = Math.max(this.minPrunedRow + 1, Math.floor(this.py) - 8);
              if (this.getCell(dropR, col).state === 'EMPTY') {
                const shard = makeEmptyCell();
                shard.state = 'FALLING';
                shard.kind = 'CRYSTAL';
                shard.color = col % Math.max(1, stratum.colorCount);
                shard.hp = 1;
                this.setCell(dropR, col, shard);
              }
            }
          }
        } else if (hz.type === 'VOID_RIFT' && hz.activeTimer % 60 === 0) {
          this.shiftPhaseBlocks();
        }
        if (hz.activeTimer <= 0) {
          this.activeHazard = null;
          this.hazardCooldown = 480 + this.rng.int(0, 240);
        }
      }
      return;
    }

    this.hazardCooldown--;
    if (this.hazardCooldown <= 0 && this.depthMeters >= 60) {
      const cols: number[] = [];
      const pickC = () => this.rng.int(0, GRID_COLS - 1);
      if (stratum.id === 1) {
        cols.push(pickC(), pickC());
        this.activeHazard = { type: 'SEISMIC_TREMOR', label: 'TEMBLOR SÍSMICO', color: '#F59E0B', warningTimer: 90, activeTimer: 90, targetCols: cols };
      } else if (stratum.id === 2) {
        cols.push(pickC(), pickC());
        this.activeHazard = { type: 'CRYO_SHARDS', label: 'CHUZOS CRIOGÉNICOS', color: '#38BDF8', warningTimer: 95, activeTimer: 110, targetCols: cols };
      } else if (stratum.id === 3) {
        this.activeHazard = { type: 'MAGMA_UPDRAFT', label: 'CORRIENTE MAGMÁTICA', color: '#F97316', warningTimer: 80, activeTimer: 160, targetCols: [] };
      } else if (stratum.id === 4) {
        this.activeHazard = { type: 'PRESSURE_PULSE', label: 'PULSO HIDROSTÁTICO', color: '#A3E635', warningTimer: 75, activeTimer: 180, targetCols: [] };
      } else if (stratum.id === 5) {
        this.activeHazard = { type: 'PHASE_STORM', label: 'TORMENTA DE FASE', color: '#C084FC', warningTimer: 80, activeTimer: 140, targetCols: [] };
      } else {
        cols.push(pickC(), pickC(), pickC());
        this.activeHazard = { type: 'VOID_RIFT', label: 'FISURA DEL VACÍO', color: '#F472B6', warningTimer: 85, activeTimer: 150, targetCols: cols };
      }
      this.discoveredCodex.add('MECH_HAZARDS');
    }
  }

  private shiftPhaseBlocks(): void {
    const startR = Math.max(this.minPrunedRow, Math.floor(this.py) - 12);
    const endR = Math.floor(this.py) + 16;
    let changed = false;
    for (let r = startR; r <= endR; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = row[c];
        if (cell.kind === 'PHASE' && cell.state === 'SOLID' && cell.altColor !== undefined) {
          const tmp = cell.color;
          cell.color = cell.altColor;
          cell.altColor = tmp;
          changed = true;
        }
      }
    }
    if (changed) {
      this.recomputeClustersAndSupport();
      this.checkIgnitions();
    }
  }

  public checkImmediatePlayerFall(): boolean {
    if (this.isClimbing) return false;
    const phasesIgniting = this.getChassisDef().phasesThroughIgniting;
    const supportRow = Math.floor(this.py + 1e-4);
    const col = Math.max(0, Math.min(GRID_COLS - 1, this.targetCol));
    const blockedByGuardian = this.activeGuardian && supportRow >= this.activeGuardian.arenaRow;
    const groundBelow = blockedByGuardian || !isPassableForPlayer(this.getCell(supportRow, col), phasesIgniting);

    const horizontallyOverCell = Math.abs(this.px - col) <= 0.42;
    if (!groundBelow && horizontallyOverCell) {
      this.playerState = 'falling';
      this.isFallingPlayer = true;
      this.gridCol = col;
      this.targetCol = col;
      this.aimDir = 'DOWN';
      if (this.vy >= 0 && this.vy < 4.5) this.vy = 4.5;
      return true;
    }
    return false;
  }

  private updatePlayer(input: InputState): void {
    const chassis = this.getChassisDef();
    const phasesIgniting = chassis.phasesThroughIgniting;

    const isColPassable = (rowIdx: number, colIdx: number): boolean => {
      if (colIdx < 0 || colIdx >= GRID_COLS || rowIdx < 0) return false;
      return isPassableForPlayer(this.getCell(rowIdx, colIdx), phasesIgniting);
    };

    const hasGroundAtRow = (r: number, c: number): boolean => {
      if (this.activeGuardian && r >= this.activeGuardian.arenaRow) return true;
      return !isPassableForPlayer(this.getCell(r, c), phasesIgniting);
    };

    // 0. Safety Ejection if a falling/swapping block overlapped the player's body cell
    // Skip ejection against the ledge beneath while mid-climb; only cancel if destination cell itself gets blocked.
    if (!this.isClimbing) {
      const bodyRow = Math.floor(this.py - 0.45);
      const clampedCol = Math.max(0, Math.min(GRID_COLS - 1, this.targetCol));
      if (bodyRow >= 0 && !isPassableForPlayer(this.getCell(bodyRow, clampedCol), phasesIgniting)) {
        if (isColPassable(bodyRow, clampedCol - 1)) {
          this.targetCol = clampedCol - 1;
          this.gridCol = this.targetCol;
          this.px = this.targetCol;
        } else if (isColPassable(bodyRow, clampedCol + 1)) {
          this.targetCol = clampedCol + 1;
          this.gridCol = this.targetCol;
          this.px = this.targetCol;
        } else if (bodyRow > 0 && isPassableForPlayer(this.getCell(bodyRow - 1, clampedCol), phasesIgniting)) {
          this.py = bodyRow;
          this.gridRow = bodyRow - 1;
          this.targetRow = this.gridRow;
          this.vy = 0;
        }
      }
    } else if (this.targetRow >= 0 && !isPassableForPlayer(this.getCell(this.targetRow, this.targetCol), phasesIgniting)) {
      this.isClimbing = false;
      const fallbackCol = Math.max(0, Math.min(GRID_COLS - 1, Math.round(this.px)));
      this.targetCol = fallbackCol;
      this.gridCol = fallbackCol;
      this.px = fallbackCol;
      this.targetRow = Math.max(0, Math.floor(this.py - 0.45));
      this.gridRow = this.targetRow;
    }

    // 1. Immediate 'falling' State Check (never interrupt a 1-block climb vault!)
    if (this.isClimbing) {
      if (Math.abs(this.py - (this.targetRow + 1)) <= 0.04 && Math.abs(this.px - this.targetCol) <= 0.06) {
        this.px = this.targetCol;
        this.py = this.targetRow + 1;
        this.gridCol = this.targetCol;
        this.gridRow = this.targetRow;
        this.isClimbing = false;
      }
    }

    const nearRowBoundary = Math.abs(this.py - Math.round(this.py)) < 0.08;
    const groundedNow = !this.isClimbing && nearRowBoundary && hasGroundAtRow(Math.round(this.py), this.targetCol);

    if (!groundedNow && !this.isClimbing) {
      if (this.playerState !== 'falling') {
        this.playerState = 'falling';
        this.isFallingPlayer = true;
        this.aimDir = 'DOWN';
        this.vy = Math.max(this.vy, 4.5);
      }
    }

    // 2. Vertical Fall Physics (when playerState === 'falling') & Tap-1-Block + DAS Input Processing
    const moveDir: -1 | 1 | 0 = input.left && !input.right ? -1 : input.right && !input.left ? 1 : 0;
    const moveMult = this.getEffectiveMoveSpeedMult();
    const DAS_INITIAL_FRAMES = 9; // ~150ms crisp arcade DAS
    const dasRepeatFrames = Math.max(4, Math.round(5.5 / moveMult)); // fluid high-speed repeat

    // Kinetic Phase Dash!
    const dashedThisFrame = input.dashPressed ? this.tryPlayerDash(input, moveDir) : false;

    let isFreshMovePress = false;
    let allowHoldRepeat = false;

    if (dashedThisFrame) {
      this.lastMoveInputDir = moveDir;
      this.dasHoldFrames = 0;
      this.dasRepeatCounter = 0;
    } else if (moveDir === 0) {
      this.lastMoveInputDir = 0;
      this.dasHoldFrames = 0;
      this.dasRepeatCounter = 0;
    } else if (moveDir !== this.lastMoveInputDir) {
      this.lastMoveInputDir = moveDir;
      this.dasHoldFrames = 0;
      this.dasRepeatCounter = 0;
      isFreshMovePress = true;
    } else {
      this.dasHoldFrames++;
      if (this.dasHoldFrames >= DAS_INITIAL_FRAMES) {
        this.dasRepeatCounter++;
        if (this.dasRepeatCounter >= dasRepeatFrames) {
          this.dasRepeatCounter = 0;
          allowHoldRepeat = true;
        }
      }
    }

    if (this.playerState === 'falling') {
      // Mid-air lateral grid steering: Tap moves strictly 1 column; holding waits for DAS
      const canAirStep =
        (isFreshMovePress && Math.abs(this.px - this.targetCol) <= 0.45) ||
        (allowHoldRepeat && Math.abs(this.px - this.targetCol) <= 0.16);
      if (moveDir !== 0 && !input.up && !input.down && canAirStep) {
        const nextCol = this.targetCol + moveDir;
        const checkTopRow = Math.max(0, Math.floor(this.py - 0.85));
        const checkBotRow = Math.max(0, Math.floor(this.py - 0.05));
        if (
          nextCol >= 0 &&
          nextCol < GRID_COLS &&
          isColPassable(checkTopRow, nextCol) &&
          isColPassable(checkBotRow, nextCol)
        ) {
          this.targetCol = nextCol;
          this.gridCol = nextCol;
          this.facing = moveDir;
        }
      }

      // Smooth Lerp to exact horizontal center of target/drilled column (zero corner snag)
      const prevPx = this.px;
      const airLerp = 1 - Math.exp(-16 * DT * moveMult);
      this.px += (this.targetCol - this.px) * airLerp;
      if (Math.abs(this.targetCol - this.px) < 0.008) {
        this.px = this.targetCol;
      }
      this.vx = (this.px - prevPx) / DT;

      const GRAVITY = (this.hasOvercharge('OC_HYPER_GRAV') ? 68 : 46) * this.dynamicDescentSpeedMult;
      const maxFall = (input.slamHeld ? 34 : 23) * (1 + (this.dynamicDescentSpeedMult - 1) * 0.62);
      this.vy = Math.min(maxFall, this.vy + GRAVITY * DT);

      const prevPy = this.py;
      const prevRow = Math.floor(this.py - 1e-4);
      const nextPy = this.py + this.vy * DT;

      if (this.vy < 0) {
        // Rising upward (e.g., from Bounce Pad spring!) — check ceiling clearance
        this.playerFallRows = 0;
        const headRow = Math.floor(nextPy - 0.92);
        if (headRow < this.minPrunedRow || !isColPassable(headRow, this.targetCol)) {
          this.vy = 0;
          this.py = Math.max(this.minPrunedRow + 1, headRow + 1.92);
        } else {
          this.py = nextPy;
          this.gridRow = Math.max(0, Math.floor(this.py - 0.45));
          this.targetRow = this.gridRow;
        }
        this.isFallingPlayer = true;
      } else {
        const checkStart = Math.max(prevRow + 1, Math.floor(this.py + 1e-4));
        const checkEnd = Math.floor(nextPy + 1e-4);

        let landedRow: number | null = null;
        for (let checkR = checkStart; checkR <= checkEnd; checkR++) {
          if (hasGroundAtRow(checkR, this.targetCol)) {
            landedRow = checkR;
            break;
          }
        }

        if (landedRow !== null) {
          this.playerFallRows += Math.max(0, landedRow - prevPy);
          const landedCell = this.getCell(landedRow, this.targetCol);
          // Player landing on BOUNCE_PAD (Válvula Geotérmica) vents 1 steam lift, heals O2 & purges itself
          if (landedCell.kind === 'BOUNCE_PAD') {
            this.setCell(landedRow, this.targetCol, makeEmptyCell());
            if (landedRow - 1 >= 0) {
              const aboveValve = this.getCell(landedRow - 1, this.targetCol);
              if (
                aboveValve.state !== 'EMPTY' &&
                aboveValve.kind !== 'RIVET' &&
                aboveValve.kind !== 'MONOLITH' &&
                aboveValve.kind !== 'BREACH_SEAL' &&
                aboveValve.kind !== 'BIFURCATION_SEAL'
              ) {
                const ak = aboveValve.kind || 'SOLID';
                this.setCell(landedRow - 1, this.targetCol, makeEmptyCell());
                this.emitDestruction(landedRow - 1, this.targetCol, '#38BDF8', 25, ak);
              }
            }
            this.py = landedRow - 0.05;
            this.vy = -12.8;
            this.playerState = 'falling';
            this.isFallingPlayer = true;
            this.slamDiving = false;
            this.playerFallRows = 0;
            this.bouncesTriggered++;
            this.recordMineralStats('BOUNCE_PAD', landedRow);
            const heal =
              6 + (this.hasModule('BAL_SPRING_MASTER') ? (this.hasModuleMk2('BAL_SPRING_MASTER') ? 14 : 8) : 0);
            this.oxygen = Math.min(this.maxOxygen, this.oxygen + heal);
            this.invulnTimer = Math.max(this.invulnTimer, this.hasModule('BAL_SPRING_MASTER') ? 24 : 12);
            soundEngine.playBounce(this.targetCol);
            soundEngine.playSteamHiss(this.targetCol);
            this.addStyle('BOUNCE', 40);
            this.pulseCamZoom(-0.04);
            this.fx.spawnLight(this.targetCol + 0.5, landedRow, 2.4, '#38BDF8', 16, 0.4);
            this.fx.applyImpulseToCables(this.targetCol + 0.5, landedRow, 3.2, 2.4);
            this.squashX = 0.72;
            this.squashY = 1.35;
            this.fx.spawnCellularBurst(this.targetCol + 0.5, landedRow, 'STEAM', '#BAE6FD', 14, 0.14);
            this.fx.spawnBlastWave({
              x: this.targetCol + 0.5,
              y: landedRow,
              radius: 0.2,
              maxRadius: 1.9,
              life: 10,
              maxLife: 10,
              color: '#38BDF8',
              isHorizontalWave: true,
            });
            this.addFloatingText(
              this.targetCol + 0.5,
              landedRow - 0.9,
              `VÁLVULA +${heal}% O₂`,
              'IMPULSO PURGADO',
              '#38BDF8'
            );
            if (this.hasModuleMk2('BAL_SPRING_MASTER')) {
              this.triggerBlastArea(landedRow, this.targetCol, 1, false);
            }
            this.recomputeClustersAndSupport();
          } else {
            const impactVy = this.vy;
            const fallHeight = this.playerFallRows;
            const balSynergyTier = this.getSynergyTier('BALISTICO');
            this.py = landedRow;
            this.gridRow = landedRow - 1;
            this.targetRow = this.gridRow;
            this.vy = 0;
            this.playerState = 'idle';
            this.isFallingPlayer = false;
            this.aimDir = 'DOWN';

            const intensity = Math.min(0.32, impactVy / 72);
            this.squashX = 1 + intensity;
            this.squashY = 1 - intensity * 0.85;
            const landStratum = this.getStratumForRow(landedRow);
            const floorHex =
              landedCell.color >= 0
                ? landStratum.blockColors[landedCell.color] || '#A1A1AA'
                : landedCell.kind === 'SLAG'
                  ? '#78716C'
                  : '#A1A1AA';
            if (impactVy > 7) {
              soundEngine.playLand(impactVy / 24, this.targetCol);
              this.spawnParticles(this.targetCol + 0.5, this.py - 0.05, floorHex, 6);
              this.fx.spawnLandingImpact(this.targetCol + 0.5, this.py, Math.max(1.2, fallHeight), floorHex);
            }
            if (fallHeight >= 3) {
              this.triggerShake(Math.min(4.5, fallHeight * 0.75), 7);
              this.addCamTrauma(Math.min(0.35, fallHeight * 0.06));
            }

            // High-Altitude Fall Shock Damage (>= 5 blocks continuous freefall!)
            const fallProtected =
              this.overdriveTimer > 0 ||
              ((this.hasRelic('REL_SLAM_BOOTS') || balSynergyTier >= 2) && this.slamDiving);
            if (fallHeight >= 5 && !fallProtected) {
              const armorTier = this.getRigUpgrades().armorTier || 0;
              let rawLoss = Math.min(28, 6 + (fallHeight - 5) * 3.5);
              rawLoss *= 1 - Math.min(0.55, armorTier * 0.11);
              if (this.slamDiving) rawLoss *= 0.5;
              if (this.hasRelic('REL_SLAM_BOOTS')) rawLoss *= 0.5;
              if (balSynergyTier >= 1) rawLoss *= 0.65;
              if (this.kineticShields > 0) rawLoss *= 0.6;
              rawLoss *= this.getChassisDef().fallDamageMult ?? 1;
              const finalLoss = Math.max(2, Math.round(rawLoss));

              this.oxygen = Math.max(0, this.oxygen - finalLoss);
              if (this.oxygen <= 0 && !this.inLastBreath) {
                this.inLastBreath = true;
                this.lastBreathTimer = Math.max(this.lastBreathTimer, LAST_BREATH_FRAMES);
              }
              this.fallImpacts++;
              this.fallShockFlashFrames = 16;
              this.addCamTrauma(Math.min(0.95, 0.45 + (fallHeight - 4) * 0.1));
              this.pulseCamZoom(0.065);
              this.hitstopFrames = Math.max(this.hitstopFrames, 2);
              this.squashX = 1.48;
              this.squashY = 0.56;
              soundEngine.playFallImpact(Math.min(1, (fallHeight - 4) / 5), this.targetCol);
              soundEngine.pulseActivity(0.28);
              this.fx.spawnLight(this.targetCol + 0.5, landedRow, 2.8, '#F43F5E', 16, 0.44);
              this.fx.applyShockwaveToParticles(this.targetCol + 0.5, landedRow, 4.0, 3.0);
              this.fx.spawnBlastWave({
                x: this.targetCol + 0.5,
                y: landedRow,
                radius: 0.3,
                maxRadius: 2.2,
                life: 12,
                maxLife: 12,
                color: '#F43F5E',
                isHorizontalWave: true,
              });
              this.addFloatingText(
                this.targetCol + 0.5,
                landedRow - 1.1,
                `IMPACTO -${finalLoss}% O₂`,
                `CAÍDA ${Math.round(fallHeight)}M · DASH [C] AMORTIGUA`,
                '#F43F5E',
                1.15
              );
            }

            // Slam Drill Dive Impact ("Picado Sísmico")
            const slamThreshold = this.hasRelic('REL_SLAM_BOOTS') || this.hasOvercharge('OC_HYPER_GRAV') ? 2 : 3;
            if (this.slamDiving && fallHeight >= slamThreshold) {
              this.slamDiving = false;
              this.triggerShake(6.5, 10);
              this.addCamTrauma(0.5);
              this.pulseCamZoom(0.05);
              this.camKickY = 4;
              soundEngine.playSlamImpact(this.targetCol);
              soundEngine.pulseActivity(0.32);
              this.addStyle('SLAM', 50);
              this.fx.spawnLight(this.targetCol + 0.5, landedRow, 3.4, '#FB923C', 18, 0.48);
              this.fx.applyShockwaveToParticles(this.targetCol + 0.5, landedRow, 4.4, 3.5);
              const slamRad =
                (this.hasRelic('REL_SLAM_BOOTS') ? 3.5 : 2.8) + (balSynergyTier >= 1 ? 0.8 : 0);
              this.fx.spawnBlastWave({
                x: this.targetCol + 0.5,
                y: landedRow,
                radius: 0.4,
                maxRadius: slamRad,
                life: 12,
                maxLife: 12,
                color: '#FB923C',
                isHorizontalWave: true,
              });
              this.fx.spawnCellularBurst(this.targetCol + 0.5, landedRow, 'SAND', '#FBBF24', 12, 0.14);
              if (this.hasModule('BAL_SHOCK_STEP')) {
                const shockDmg = this.hasModuleMk2('BAL_SHOCK_STEP') ? 2 : 1;
                for (const sc of [this.targetCol - 1, this.targetCol + 1]) {
                  if (sc >= 0 && sc < GRID_COLS) {
                    const sCell = this.getCell(landedRow, sc);
                    if (sCell.kind === 'SLAG') {
                      sCell.hp -= shockDmg;
                      sCell.hitFlash = 5;
                      if (sCell.hp <= 0) this.breakSlag(landedRow, sc);
                    }
                  }
                }
              }
              if (
                landedCell.state !== 'EMPTY' &&
                landedCell.kind !== 'RIVET' &&
                landedCell.kind !== 'MONOLITH' &&
                landedCell.kind !== 'BREACH_SEAL' &&
                landedCell.kind !== 'BIFURCATION_SEAL'
              ) {
                if (landedCell.kind === 'SLAG') landedCell.hp -= 1;
                this.drillAt(landedRow, this.targetCol, true, false);
              }
              if (balSynergyTier >= 2) {
                const subCell = this.getCell(landedRow + 1, this.targetCol);
                if (
                  subCell.state !== 'EMPTY' &&
                  subCell.kind !== 'RIVET' &&
                  subCell.kind !== 'MONOLITH' &&
                  subCell.kind !== 'BREACH_SEAL' &&
                  subCell.kind !== 'BIFURCATION_SEAL'
                ) {
                  this.drillAt(landedRow + 1, this.targetCol, true, false);
                }
              }
              for (const adjCol of [this.targetCol - 1, this.targetCol + 1]) {
                if (adjCol >= 0 && adjCol < GRID_COLS) {
                  const adj = this.getCell(landedRow, adjCol);
                  if (
                    adj.state === 'SOLID' &&
                    adj.kind !== 'RIVET' &&
                    adj.kind !== 'MONOLITH' &&
                    adj.kind !== 'BREACH_SEAL' &&
                    adj.kind !== 'BIFURCATION_SEAL'
                  ) {
                    adj.state = 'WOBBLE';
                    adj.wobbleMax = this.getCurrentWobbleFrames(landedRow);
                    adj.wobbleTimer = Math.floor(adj.wobbleMax * 0.45);
                  }
                }
              }
            }
            this.slamDiving = false;

            if (this.hasModule('BAL_INERTIA') && fallHeight >= (this.hasModuleMk2('BAL_INERTIA') ? 4 : 5)) {
              this.invulnTimer = Math.max(this.invulnTimer, this.hasModuleMk2('BAL_INERTIA') ? 108 : 72);
              this.addFloatingText(this.targetCol + 0.5, this.py - 1, 'ESCUDO DE INERCIA', undefined, '#4AC6E8');
              if (this.hasModuleMk2('BAL_INERTIA')) {
                this.drillAt(landedRow, this.targetCol);
              }
            }
            this.playerFallRows = 0;
          }
        } else {
          this.playerFallRows += Math.max(0, nextPy - prevPy);
          this.py = nextPy;
          this.gridRow = Math.max(0, Math.floor(this.py - 0.45));
          this.targetRow = this.gridRow;
          this.isFallingPlayer = true;
          this.slamDiving = Boolean(input.slamHeld && this.playerFallRows >= 1);
        }
      }
    } else {
      // Grounded state
      if (!this.isClimbing) {
        const snapR = Math.round(this.py);
        this.py = snapR;
        this.gridRow = snapR - 1;
        this.targetRow = this.gridRow;
      }
      this.vy = 0;
      this.isFallingPlayer = false;
      this.playerFallRows = 0;
    }

    const curRow = Math.max(0, this.gridRow);
    const curCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));

    // 3. Persistent Latched Aiming (remains locked on side/top target after key release!)
    const hasBlockAtSide = (dir: -1 | 1): boolean => {
      const c1 = curCol + dir;
      if (c1 >= 0 && c1 < GRID_COLS && this.getCell(curRow, c1).state !== 'EMPTY') return true;
      if (this.getSwapReach() >= 2) {
        const c2 = curCol + dir * 2;
        if (c2 >= 0 && c2 < GRID_COLS && this.getCell(curRow, c2).state !== 'EMPTY') return true;
      }
      return false;
    };

    if (input.down) {
      this.aimDir = 'DOWN';
    } else if (input.up && !input.left && !input.right) {
      this.aimDir = 'UP';
    } else if (input.left && !input.right) {
      this.facing = -1;
      if (hasBlockAtSide(-1)) {
        this.aimDir = 'LEFT';
      } else if (!input.up) {
        this.aimDir = 'DOWN';
      }
    } else if (input.right && !input.left) {
      this.facing = 1;
      if (hasBlockAtSide(1)) {
        this.aimDir = 'RIGHT';
      } else if (!input.up) {
        this.aimDir = 'DOWN';
      }
    } else {
      // No direction key held: keep latched aimDir valid until target clears, player moves, falls, or presses Down
      if (this.aimDir === 'LEFT' && !hasBlockAtSide(-1)) {
        this.aimDir = 'DOWN';
      } else if (this.aimDir === 'RIGHT' && !hasBlockAtSide(1)) {
        this.aimDir = 'DOWN';
      }
    }

    // Collect Oxygen Capsule or Extraction Tube on overlap
    const overlapCell = this.getCell(curRow, curCol);
    if (overlapCell.kind === 'OXYGEN' && overlapCell.state !== 'EMPTY') {
      this.collectOxygenCapsule(curRow, curCol);
    } else if (overlapCell.kind === 'EXTRACTION_TUBE' && overlapCell.state !== 'EMPTY') {
      this.setCell(curRow, curCol, makeEmptyCell());
      this.isotopesBanked += this.isotopes;
      this.isotopes = 0;
      this.addFloatingText(curCol + 0.5, curRow, 'ISÓTOPOS ASEGURADOS 100%', undefined, '#A3E635');
      soundEngine.playSeismicSeal();
    }

    // 4. Execute Buffered Action (Drill / Swap) before grid movement
    if (this.bufferedAction && this.bufferTimer > 0) {
      let consumed = false;
      if (this.bufferedAction === 'DRILL') {
        consumed = this.tryPlayerDrill(curRow, curCol);
        if (consumed) {
          this.lateralHoldFrames = 0;
          this.checkImmediatePlayerFall();
        }
      } else if (this.bufferedAction === 'SWAP_L' || this.bufferedAction === 'SWAP_R') {
        if (this.swapCooldown === 0) {
          const dir = this.bufferedAction === 'SWAP_L' ? -1 : 1;
          consumed = this.tryPlayerSwap(curRow, curCol, dir);
          if (consumed) {
            this.lateralHoldFrames = 0;
            this.checkImmediatePlayerFall();
          }
        }
      }
      if (consumed) {
        this.bufferedAction = null;
        this.bufferTimer = 0;
      }
    }

    // 5. Grid-Based Movement (Tap = 1 block, Hold = DAS cadence) & Strict 1-Block Climb
    if (this.playerState !== 'falling' && !this.isClimbing) {
      if (moveDir !== 0) {
        if (this.lateralHoldDir !== moveDir) {
          this.lateralHoldDir = moveDir;
          this.lateralHoldFrames = 0;
        }
        this.lateralHoldFrames++;

        const distToTargetX = Math.abs(this.px - this.targetCol);
        const distToTargetY = Math.abs(this.py - (this.targetRow + 1));

        if (distToTargetY <= 0.14) {
          const nextCol = this.targetCol + moveDir;
          if (nextCol >= 0 && nextCol < GRID_COLS && isColPassable(this.targetRow, nextCol)) {
            const canStepGround =
              (isFreshMovePress && distToTargetX <= 0.48) ||
              (allowHoldRepeat && distToTargetX <= 0.16);
            if (!input.up && !input.down && canStepGround) {
              this.targetCol = nextCol;
              this.gridCol = nextCol;
              this.playerState = 'moving';
              this.lateralHoldFrames = 0;
              this.aimDir = 'DOWN';
              soundEngine.playStep();
            }
          } else if (nextCol >= 0 && nextCol < GRID_COLS && distToTargetX <= 0.18) {
            // Strict 1-block climb: (targetRow, nextCol) is occupied, BOTH (targetRow - 1, targetCol) AND (targetRow - 1, nextCol) must be empty/passable!
            const sideBlock = this.getCell(this.targetRow, nextCol);
            const canVault =
              sideBlock.state !== 'EMPTY' &&
              sideBlock.state !== 'FALLING' &&
              this.targetRow >= 1 &&
              isColPassable(this.targetRow - 1, this.targetCol) &&
              isColPassable(this.targetRow - 1, nextCol);

            // Climb either instantly with Up+Direction, or passively if chassis supports auto-climb
            if (canVault && (input.up || (chassis.canAutoClimb && this.lateralHoldFrames >= CLIMB_HOLD_FRAMES))) {
              this.isClimbing = true;
              this.targetCol = nextCol;
              this.targetRow -= 1;
              this.gridCol = this.targetCol;
              this.gridRow = this.targetRow;
              this.playerState = 'moving';
              this.lateralHoldFrames = 0;
              this.aimDir = 'DOWN';
              this.squashX = 0.82;
              this.squashY = 1.24;
              this.spawnParticles(nextCol + 0.5, this.targetRow + 1, '#A1A1AA', 5);
              soundEngine.playClimb();
            }
          }
        }
      } else {
        this.lateralHoldDir = 0;
        this.lateralHoldFrames = 0;
      }
    }

    if (this.playerState !== 'falling') {
      // Exponential lerp toward exact center coordinate of target grid cell
      const prevPx = this.px;
      const speedLerp = 1 - Math.exp(-16 * DT * moveMult);
      const climbRiseLerp = 1 - Math.exp(-26 * DT * moveMult);
      const climbSlideLerp = 1 - Math.exp(-22 * DT * moveMult);

      const targetPy = this.targetRow + 1;
      if (this.isClimbing) {
        // Rise vertically slightly ahead of horizontal step so sprite clears the 1-block corner cleanly
        this.py += (targetPy - this.py) * climbRiseLerp;
        if (Math.abs(this.py - targetPy) < 0.65) {
          this.px += (this.targetCol - this.px) * climbSlideLerp;
        }
      } else {
        this.px += (this.targetCol - this.px) * speedLerp;
        this.py += (targetPy - this.py) * speedLerp;
      }

      const snapThresh = this.isClimbing ? 0.02 : 0.008;
      if (Math.abs(this.targetCol - this.px) < snapThresh) {
        this.px = this.targetCol;
      }
      if (Math.abs(targetPy - this.py) < snapThresh) {
        this.py = targetPy;
      }

      if (this.isClimbing && this.px === this.targetCol && this.py === targetPy) {
        this.isClimbing = false;
      }

      this.vx = (this.px - prevPx) / DT;
      if (!this.isClimbing && this.px === this.targetCol && this.py === targetPy && moveDir === 0) {
        this.playerState = 'idle';
        this.vx = 0;
      } else if (this.px !== this.targetCol || this.py !== targetPy) {
        this.playerState = 'moving';
      }
    }

    // Re-verify immediate fall if moving into an open pit over an empty cell
    this.checkImmediatePlayerFall();

    // 6. Update 3-Step Guided Tutorial Progress
    this.updateTutorialProgress();
  }

  private updateTutorialProgress(): void {
    if (this.tutorialStep === 0) return;

    if (this.tutorialStep === 1 && this.tutorialDrills >= 1 && this.py >= 6.8) {
      this.tutorialStep = 2;
      this.addFloatingText(4.5, this.py - 1.5, 'PASO 2/3 · PERMUTAR', 'PULSA Q / E PARA UNIR 4', '#38BDF8');
      soundEngine.playSeismicSeal();
    } else if (this.tutorialStep === 2 && this.tutorialIgnitions >= 1) {
      this.tutorialStep = 3;
      this.addFloatingText(4.5, this.py - 1.5, 'PASO 3/3 · OXÍGENO', 'RECOGE O₂ Y EVITA ESCORIA', '#A3E635');
      soundEngine.playSeismicSeal();
    } else if (
      this.tutorialStep === 3 &&
      (this.py >= 10.5 || this.tutorialO2Collected >= 1)
    ) {
      this.tutorialStep = 0;
      this.addFloatingText(4.5, this.py - 1.5, 'TUTORIAL COMPLETADO', 'EL POZO ES TUYO', '#FACC15');
      soundEngine.playSeismicSeal();
      if (this.config.onTutorialComplete) {
        this.config.onTutorialComplete();
      }
    }
  }

  public skipTutorial(): void {
    if (this.tutorialStep === 0) return;
    this.tutorialStep = 0;
    if (this.config.onTutorialComplete) {
      this.config.onTutorialComplete();
    }
  }

  public canClimbStep(dir: -1 | 1, isManualUp = false): boolean {
    if (this.playerState === 'falling' || this.isClimbing || this.targetRow < 1) return false;
    const chassis = this.getChassisDef();
    if (!chassis.canAutoClimb && !isManualUp) return false;
    const nextCol = this.targetCol + dir;
    if (nextCol < 0 || nextCol >= GRID_COLS) return false;
    const phasesIgniting = chassis.phasesThroughIgniting;
    const sideBlock = this.getCell(this.targetRow, nextCol);
    if (sideBlock.state === 'EMPTY' || sideBlock.state === 'FALLING') return false;
    return (
      isPassableForPlayer(this.getCell(this.targetRow - 1, this.targetCol), phasesIgniting) &&
      isPassableForPlayer(this.getCell(this.targetRow - 1, nextCol), phasesIgniting)
    );
  }

  private tryPlayerDash(input: InputState, moveDir: -1 | 1 | 0): boolean {
    if (this.dashCooldown > 0 || this.isClimbing) return false;
    const phasesIgniting = this.getChassisDef().phasesThroughIgniting;
    const isPassable = (r: number, c: number) =>
      c >= 0 && c < GRID_COLS && r >= 0 && isPassableForPlayer(this.getCell(r, c), phasesIgniting);

    const curRow = Math.max(0, this.targetRow);
    const curCol = Math.max(0, Math.min(GRID_COLS - 1, this.targetCol));
    const frame4 = Math.floor(this.frameCount / 6) & 3;

    const wasHighFall = this.playerFallRows >= 2;
    // Vertical boost jump if holding UP and empty overhead
    if (input.up && curRow > 0 && isPassable(curRow - 1, curCol)) {
      this.fx.spawnAfterimage(this.px + 0.5, this.py - 0.5, 'DASH', frame4, this.aimDir, this.facing, '#38BDF8', 12);
      this.targetRow = curRow - 1;
      this.gridRow = this.targetRow;
      this.py = this.targetRow + 1;
      this.vy = -4;
      this.playerFallRows = 0;
      this.playerState = 'moving';
      this.isFallingPlayer = false;
      this.dashCooldown = this.dashMaxCooldown;
      this.invulnTimer = Math.max(this.invulnTimer, 10);
      this.setActionPose('DASH', 10);
      this.squashX = 0.78;
      this.squashY = 1.28;
      this.camKickY = -2.2;
      this.fx.spawnCellularBurst(this.px + 0.5, this.py - 0.3, 'SPARK', '#38BDF8', 10, 0.11);
      this.fx.spawnLight(this.px + 0.5, this.py - 0.3, 2.2, '#38BDF8', 10, 0.36);
      soundEngine.pulseActivity(0.22);
      if (wasHighFall) {
        soundEngine.playAirBrake(curCol);
        this.addStyle('AIR_BRAKE', 45);
        this.addFloatingText(this.px + 0.5, this.py - 1.2, 'AMORTIGUADO!', undefined, '#38BDF8');
      } else {
        soundEngine.playDash();
      }
      return true;
    }

    const dashDir: -1 | 1 = moveDir !== 0 ? moveDir : this.facing;
    let steps = 0;
    if (isPassable(curRow, curCol + dashDir)) {
      steps = 1;
      if (isPassable(curRow, curCol + dashDir * 2)) {
        steps = 2;
      }
    } else if (this.hasModule('BAL_JUGGERNAUT') && curCol + dashDir >= 0 && curCol + dashDir < GRID_COLS) {
      const blocker = this.getCell(curRow, curCol + dashDir);
      if (
        blocker.kind !== 'RIVET' &&
        blocker.kind !== 'MONOLITH' &&
        blocker.kind !== 'BREACH_SEAL' &&
        blocker.kind !== 'BIFURCATION_SEAL' &&
        (blocker.kind !== 'SLAG' || this.hasModuleMk2('BAL_JUGGERNAUT'))
      ) {
        this.drillAt(curRow, curCol + dashDir, true, false);
        if (blocker.kind === 'SLAG') this.addOverdrive(10);
        steps = 1;
      }
    }
    // Mid-air Retro-Thrust Air-Brake even inside narrow 1-col shaft!
    if (steps === 0) {
      if (!wasHighFall) return false;
      this.playerFallRows = 0;
      this.vy = Math.min(this.vy, 1.5);
      this.dashCooldown = Math.round(this.dashMaxCooldown * 0.7);
      this.invulnTimer = Math.max(this.invulnTimer, 10);
      this.setActionPose('DASH', 8);
      this.squashX = 0.8;
      this.squashY = 1.24;
      this.fx.spawnCellularBurst(this.px + 0.5, this.py - 0.2, 'CRYO', '#38BDF8', 12, 0.13);
      soundEngine.playAirBrake(curCol);
      this.addStyle('AIR_BRAKE', 45);
      this.addFloatingText(this.px + 0.5, this.py - 1.2, 'FRENO AÉREO!', undefined, '#38BDF8');
      return true;
    }

    for (let s = 0; s < steps; s++) {
      this.fx.spawnAfterimage(
        curCol + dashDir * (s * 0.65) + 0.5,
        this.py - 0.5,
        'DASH',
        frame4,
        this.aimDir,
        dashDir,
        '#38BDF8',
        12 - s * 2
      );
    }

    const cloakBonus = this.hasRelic('REL_PHASE_CLOAK') ? 8 : 0;
    this.facing = dashDir;
    this.targetCol = curCol + dashDir * steps;
    this.gridCol = this.targetCol;
    this.px = this.targetCol;
    this.dashCooldown = this.dashMaxCooldown;
    this.invulnTimer = Math.max(this.invulnTimer, 10 + cloakBonus);
    this.setActionPose('DASH', 10);
    this.squashX = 1.28;
    this.squashY = 0.78;
    this.camKickX = dashDir * 2.5;
    this.fx.spawnCellularBurst(this.px + 0.5, this.py - 0.5, 'SPARK', '#38BDF8', 10, 0.12);
    this.fx.spawnLight(this.px + 0.5, this.py - 0.5, 2.2, '#38BDF8', 10, 0.36);
    this.fx.applyImpulseToCables(this.px + 0.5, this.py - 0.5, 2.5, 2.0);
    soundEngine.pulseActivity(0.22);
    if (wasHighFall) {
      this.playerFallRows = 0;
      this.vy = Math.min(this.vy, 2.5);
      soundEngine.playAirBrake(this.targetCol);
      this.addStyle('AIR_BRAKE', 45);
      this.addFloatingText(this.px + 0.5, this.py - 1.2, 'AMORTIGUADO!', undefined, '#38BDF8');
    } else {
      soundEngine.playDash();
    }
    if (this.hasModuleMk2('QUA_PHASE_DASH')) {
      for (const sc of [this.targetCol - 1, this.targetCol + 1]) {
        if (sc >= 0 && sc < GRID_COLS && this.getCell(curRow, sc).kind === 'SLAG') {
          this.breakSlag(curRow, sc);
        }
      }
    }
    soundEngine.playDash();
    this.checkImmediatePlayerFall();
    return true;
  }

  private tryActivateOverdrive(): boolean {
    if (this.overdrive < 100 || this.overdriveTimer > 0) return false;
    this.overdrive = 0;
    this.overdriveTimer = this.getOverdriveMaxDuration();
    this.invulnTimer = Math.max(this.invulnTimer, 30);
    this.hitstopFrames = 4;
    this.camZoom = 1.05;
    this.chromaFlashFrames = 3;
    this.triggerShake(6.5, 10);
    const pRow = Math.max(0, this.gridRow);
    const pCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));
    this.triggerBlastArea(pRow, pCol, 1, false);
    this.recomputeClustersAndSupport();
    this.fx.spawnBlastWave({
      x: this.px + 0.5,
      y: this.py - 0.5,
      radius: 0.4,
      maxRadius: 3.8,
      life: 16,
      maxLife: 16,
      color: '#FACC15',
    });
    this.fx.addFloatingText(
      this.px + 0.5,
      this.py - 1.5,
      'OVERDRIVE SÍSMICO!',
      'O₂ EN PAUSA · SUPERPERFORACIÓN',
      '#FACC15',
      1.25
    );
    soundEngine.playOverdrive();
    return true;
  }

  public aimAndActAtCell(
    targetR: number,
    targetC: number,
    action: 'AIM' | 'DRILL' | 'SWAP_LEFT' | 'SWAP_RIGHT'
  ): boolean {
    if (this.finished) return false;
    const curRow = Math.max(0, this.gridRow);
    const curCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));
    const dr = targetR - curRow;
    const dc = targetC - curCol;

    let valid = false;
    if (dr === 1 && dc === 0) {
      this.aimDir = 'DOWN';
      valid = true;
    } else if (dr === -1 && dc === 0) {
      this.aimDir = 'UP';
      valid = true;
    } else if (dr === 0 && dc < 0 && dc >= -2) {
      this.aimDir = 'LEFT';
      this.facing = -1;
      valid = true;
    } else if (dr === 0 && dc > 0 && dc <= 2) {
      this.aimDir = 'RIGHT';
      this.facing = 1;
      valid = true;
    }

    if (!valid) return false;
    if (action === 'DRILL') {
      this.bufferedAction = 'DRILL';
      this.bufferTimer = INPUT_BUFFER_FRAMES;
    } else if (action === 'SWAP_LEFT') {
      this.bufferedAction = 'SWAP_L';
      this.bufferTimer = INPUT_BUFFER_FRAMES;
    } else if (action === 'SWAP_RIGHT') {
      this.bufferedAction = 'SWAP_R';
      this.bufferTimer = INPUT_BUFFER_FRAMES;
    }
    return true;
  }

  public getDirectionalSwapTarget(
    anchorR: number,
    anchorC: number,
    dirX: -1 | 0 | 1,
    dirY: -1 | 0 | 1
  ): {
    r1: number;
    c1: number;
    r2: number;
    c2: number;
    aimDir: AimDir;
    isParry: boolean;
  } | null {
    const curRow = Math.max(0, this.gridRow);
    const curCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));
    const dr = anchorR - curRow;
    const dc = anchorC - curCol;
    const reach = Math.max(1, this.getSwapReach());

    let aimDir: AimDir | null = null;
    if (dr === 1 && dc === 0) aimDir = 'DOWN';
    else if (dr === -1 && dc === 0) aimDir = 'UP';
    else if (reach >= 2 && dr === 2 && dc === 0 && this.getCell(curRow + 1, curCol).state === 'EMPTY') aimDir = 'DOWN';
    else if (reach >= 2 && dr === -2 && dc === 0 && curRow > 0 && this.getCell(curRow - 1, curCol).state === 'EMPTY') aimDir = 'UP';
    else if (dr === 0 && dc < 0 && dc >= -reach) aimDir = 'LEFT';
    else if (dr === 0 && dc > 0 && dc <= reach) aimDir = 'RIGHT';

    if (!aimDir) return null;

    if (this.coyoteCrushTimer > 0 && dr === -1 && dc === 0 && dirX !== 0) {
      return {
        r1: anchorR,
        c1: anchorC,
        r2: anchorR,
        c2: Math.max(0, Math.min(GRID_COLS - 1, anchorC + dirX)),
        aimDir: 'UP',
        isParry: true,
      };
    }

    const r1 = anchorR;
    const c1 = anchorC;
    let r2 = r1;
    let c2 = c1;

    if (aimDir === 'DOWN' || aimDir === 'UP') {
      if (dirX === 0) return null;
      c2 = c1 + dirX;
      if (reach >= 2 && c2 >= 0 && c2 < GRID_COLS) {
        const mid = this.getCell(r1, c2);
        if (mid.kind === 'RIVET' || mid.kind === 'MONOLITH') {
          c2 = c1 + dirX * 2;
        }
      }
    } else {
      if (dirY !== 0) {
        r2 = r1 + dirY;
      } else if (dirX !== 0) {
        const candC = c1 + dirX;
        if (candC !== curCol && candC >= 0 && candC < GRID_COLS) {
          c2 = candC;
        } else {
          r2 = r1 - 1;
        }
      } else {
        return null;
      }
    }

    if (c1 < 0 || c1 >= GRID_COLS || c2 < 0 || c2 >= GRID_COLS || r1 < 0 || r2 < 0) return null;
    return { r1, c1, r2, c2, aimDir, isParry: false };
  }

  public tryDirectionalSwapAtCell(
    anchorR: number,
    anchorC: number,
    dirX: -1 | 0 | 1,
    dirY: -1 | 0 | 1
  ): boolean {
    if (this.finished || this.pendingStory || this.swapCooldown > 0) return false;
    const target = this.getDirectionalSwapTarget(anchorR, anchorC, dirX, dirY);
    if (!target) return false;

    this.aimDir = target.aimDir;
    if (target.aimDir === 'LEFT') this.facing = -1;
    else if (target.aimDir === 'RIGHT') this.facing = 1;

    if (target.isParry && this.coyoteCrushTimer > 0) {
      return this.executeKineticParry(dirX < 0 ? -1 : 1);
    }

    const cell1 = this.getCell(target.r1, target.c1);
    const cell2 = this.getCell(target.r2, target.c2);
    if (cell1.state === 'EMPTY' && cell2.state === 'EMPTY') return false;
    if (
      cell1.state === 'IGNITING' ||
      cell2.state === 'IGNITING' ||
      cell1.state === 'DETONATING' ||
      cell2.state === 'DETONATING'
    ) {
      return false;
    }
    if (!isSwappableKind(cell1.kind) || !isSwappableKind(cell2.kind)) {
      soundEngine.playThermalDud();
      return false;
    }

    this.performSwap(target.r1, target.c1, target.r2, target.c2);
    return true;
  }

  public hasIgnitingBlocks(): boolean {
    const startR = Math.max(this.minPrunedRow, Math.floor(this.py) - 16);
    const endR = Math.floor(this.py) + 18;
    for (let r = startR; r <= endR; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        if (row[c].state === 'IGNITING') return true;
      }
    }
    return false;
  }

  public triggerForceDetonate(): boolean {
    if (this.finished || this.pendingStory || this.hasOvercharge('OC_RUNAWAY')) return false;
    return this.forceDetonateAll();
  }

  public handleCellTap(targetR: number, targetC: number): 'DETONATE' | 'DRILL' | 'NONE' {
    if (this.finished || this.pendingStory) return 'NONE';
    const cell = this.getCell(targetR, targetC);
    if (cell.state === 'IGNITING') {
      return this.triggerForceDetonate() ? 'DETONATE' : 'NONE';
    }
    return this.aimAndActAtCell(targetR, targetC, 'DRILL') ? 'DRILL' : 'NONE';
  }

  public triggerDownwardDrill(): boolean {
    if (this.finished || this.pendingStory || this.playerState === 'falling') return false;
    this.aimDir = 'DOWN';
    const pRow = Math.max(0, this.gridRow);
    const pCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));
    const drilled = this.tryPlayerDrill(pRow, pCol);
    if (drilled) {
      this.checkImmediatePlayerFall();
    }
    return drilled;
  }

  public triggerStepMove(dir: -1 | 1, allowClimb = true): boolean {
    if (this.finished || this.pendingStory) return false;
    if (this.isClimbing) {
      if (Math.abs(this.py - (this.targetRow + 1)) <= 0.35 && Math.abs(this.px - this.targetCol) <= 0.35) {
        this.px = this.targetCol;
        this.py = this.targetRow + 1;
        this.gridCol = this.targetCol;
        this.gridRow = this.targetRow;
        this.isClimbing = false;
      } else {
        return false;
      }
    }
    this.facing = dir;
    const phasesIgniting = this.getChassisDef().phasesThroughIgniting;
    const isColPassable = (rowIdx: number, colIdx: number): boolean => {
      if (colIdx < 0 || colIdx >= GRID_COLS || rowIdx < 0) return false;
      return isPassableForPlayer(this.getCell(rowIdx, colIdx), phasesIgniting);
    };

    const nextCol = this.targetCol + dir;
    if (nextCol < 0 || nextCol >= GRID_COLS) return false;

    if (this.playerState === 'falling') {
      const checkTopRow = Math.max(0, Math.floor(this.py - 0.85));
      const checkBotRow = Math.max(0, Math.floor(this.py - 0.05));
      if (isColPassable(checkTopRow, nextCol) && isColPassable(checkBotRow, nextCol)) {
        this.targetCol = nextCol;
        this.gridCol = nextCol;
        return true;
      }
      return false;
    }

    if (isColPassable(this.targetRow, nextCol)) {
      this.targetCol = nextCol;
      this.gridCol = nextCol;
      this.playerState = 'moving';
      this.lateralHoldFrames = 0;
      this.aimDir = 'DOWN';
      soundEngine.playStep();
      this.checkImmediatePlayerFall();
      return true;
    }

    if (this.canClimbStep(dir, allowClimb)) {
      this.px = this.targetCol;
      this.py = this.targetRow + 1;
      this.isClimbing = true;
      this.targetCol = nextCol;
      this.targetRow -= 1;
      this.gridCol = this.targetCol;
      this.gridRow = this.targetRow;
      this.playerState = 'moving';
      this.lateralHoldFrames = 0;
      this.aimDir = 'DOWN';
      this.squashX = 0.82;
      this.squashY = 1.24;
      this.spawnParticles(nextCol + 0.5, this.targetRow + 1, '#A1A1AA', 5);
      soundEngine.playClimb();
      return true;
    }

    this.aimDir = dir < 0 ? 'LEFT' : 'RIGHT';
    return false;
  }

  public triggerDirectionalDash(dir: -1 | 1): boolean {
    if (this.finished || this.pendingStory || this.isClimbing) return false;
    this.facing = dir;
    const dashed = this.tryPlayerDash(
      {
        left: dir < 0,
        right: dir > 0,
        up: false,
        down: false,
        drillPressed: false,
        swapLeftPressed: false,
        swapRightPressed: false,
        slamHeld: false,
        detonatePressed: false,
        rerollPressed: false,
        dashPressed: true,
        overdrivePressed: false,
      },
      dir
    );
    if (dashed) {
      this.lastMoveInputDir = 0;
      this.dasHoldFrames = 0;
      this.dasRepeatCounter = 0;
      this.checkImmediatePlayerFall();
    }
    return dashed;
  }

  private getAimOffset(): [number, number] {
    switch (this.aimDir) {
      case 'UP':
        return [-1, 0];
      case 'LEFT':
        return [0, -1];
      case 'RIGHT':
        return [0, 1];
      default:
        return [1, 0];
    }
  }

  private tryPlayerDrill(pRow: number, pCol: number): boolean {
    let [dr, dc] = this.getAimOffset();
    let tr = pRow + dr;
    let tc = pCol + dc;
    let target = tc >= 0 && tc < GRID_COLS && tr >= 0 ? this.getCell(tr, tc) : null;

    // Fallback: if aiming sideways at empty air, drill block beneath feet if present
    if ((!target || target.state === 'EMPTY') && (this.aimDir === 'LEFT' || this.aimDir === 'RIGHT')) {
      const below = this.getCell(pRow + 1, pCol);
      if (below.state !== 'EMPTY') {
        tr = pRow + 1;
        tc = pCol;
        target = below;
      }
    }

    if (!target || tc < 0 || tc >= GRID_COLS || tr < 0) return false;
    if (target.state === 'EMPTY' || target.state === 'DETONATING') return false;

    // Immune while IGNITING (GDD 3.2)
    if (target.state === 'IGNITING') return false;

    // Rivet & Monolith immune to Drill
    if (target.kind === 'RIVET' || target.kind === 'MONOLITH' || target.kind === 'PHASE_KEY') {
      soundEngine.playThermalDud();
      this.spawnParticles(tc + 0.5, tr + 0.5, '#9AA5B1', 4);
      return true;
    }

    // Breach Seal?
    if (target.kind === 'BREACH_SEAL' && this.activeBreach && !this.activeBreach.resolved) {
      this.resolveBreachChoice(target.breachOptionIndex ?? 0);
      return true;
    }

    // Bifurcation Seal?
    if (target.kind === 'BIFURCATION_SEAL' && this.activeBifurcation && !this.activeBifurcation.resolved) {
      this.resolveBifurcationChoice(target.bifurcationSide || 'LEFT');
      return true;
    }

    this.drillAt(tr, tc, true);
    if (tr === pRow + 1 && tc === pCol) {
      this.targetCol = pCol;
      this.gridCol = pCol;
    }
    if (this.tutorialStep > 0) this.tutorialDrills++;
    return true;
  }

  private drillAt(r: number, c: number, fromPlayer = false, allowPierce = true): void {
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY' || cell.state === 'IGNITING') return;

    const upg = this.getRigUpgrades();
    const isOverdrive = this.overdriveTimer > 0;
    const [pDr, pDc] = this.getAimOffset();

    if (fromPlayer) {
      this.setActionPose('DRILL_STRIKE', 10);
      this.camKickX = pDc * 1.6;
      this.camKickY = pDr * 1.6;
    }

    // Lyra · Cadencia subtle rhythm bonus (non-punishing)
    if (fromPlayer && this.config.chassis === 'MKIV_METRONOMO') {
      if (soundEngine.isOnBeat()) {
        this.metronomeOnBeatFlash = 14;
        this.lastActionOnBeat = true;
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 0.8);
        this.addStyle('BEAT', 18);
      } else {
        this.lastActionOnBeat = false;
      }
    }

    const tryOverdrivePierce = () => {
      if (!isOverdrive || !allowPierce || !fromPlayer) return;
      const pr = r + pDr;
      const pc = c + pDc;
      if (pc >= 0 && pc < GRID_COLS && pr >= 0) {
        const next = this.getCell(pr, pc);
        if (
          next.state !== 'EMPTY' &&
          next.state !== 'IGNITING' &&
          next.kind !== 'RIVET' &&
          next.kind !== 'MONOLITH' &&
          next.kind !== 'BREACH_SEAL' &&
          next.kind !== 'BIFURCATION_SEAL'
        ) {
          this.drillAt(pr, pc, true, false);
        }
      }
      // PYRO_OVERHEAT extra cross spark during Overdrive!
      if (this.hasModule('PYRO_OVERHEAT')) {
        const offsets = this.hasModuleMk2('PYRO_OVERHEAT')
          ? [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]
          : [[pDr * 2, pDc * 2]];
        for (const [odr, odc] of offsets) {
          const xr = r + odr;
          const xc = c + odc;
          if (xc >= 0 && xc < GRID_COLS && xr >= 0) {
            const xCell = this.getCell(xr, xc);
            if (xCell.state !== 'EMPTY' && xCell.kind !== 'RIVET' && xCell.kind !== 'MONOLITH') {
              this.drillAt(xr, xc, false, false);
              this.fx.spawnShockArc(c + 0.5, r + 0.5, xc + 0.5, xr + 0.5, '#FACC15');
            }
          }
        }
      }
    };

    // OC_TESLA_COIL lightning arc on any player drill
    if (fromPlayer && this.hasOvercharge('OC_TESLA_COIL')) {
      for (let tr = Math.max(this.minPrunedRow, r - 2); tr <= r + 2; tr++) {
        for (let tc = Math.max(0, c - 2); tc <= Math.min(GRID_COLS - 1, c + 2); tc++) {
          if (tr === r && tc === c) continue;
          const nb = this.getCell(tr, tc);
          if (nb.kind === 'CONDUCTOR' || nb.kind === 'SHOCK_MINE') {
            this.fx.spawnShockArc(c + 0.5, r + 0.5, tc + 0.5, tr + 0.5, '#FDE047');
            if (nb.kind === 'SHOCK_MINE') {
              this.disarmShockMine(tr, tc);
            } else {
              nb.hp -= 1;
              nb.hitFlash = 4;
              if (nb.hp <= 0) {
                this.setCell(tr, tc, makeEmptyCell());
                this.emitDestruction(tr, tc, '#FACC15', 45, 'CONDUCTOR');
              }
            }
          }
        }
      }
    }

    // Volatile Slag (Alquimia de Basalto)
    if (cell.kind === 'SLAG' && cell.isVolatileSlag) {
      this.setCell(r, c, makeEmptyCell());
      this.triggerBlastArea(r, c, 2, true); // 5x5 blast!
      if (this.hasModuleMk2('PAR_ALCHEMY')) {
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 10);
      }
      this.slagDestroyed++;
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#A3E635', true);
      this.addFloatingText(c + 0.5, r, 'ESCORIA VOLÁTIL 5×5!', undefined, '#A3E635');
      soundEngine.playDetonate(3);
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'SLAG') {
      const tungsten = this.hasModule('PAR_TUNGSTEN');
      const rigSlagBonus = upg.drillTier >= 5 ? 2 : upg.drillTier >= 2 ? 1 : 0;
      const dmg = isOverdrive || this.hasModuleMk2('PAR_TUNGSTEN') ? 99 : (tungsten ? 3 : 1) + rigSlagBonus;
      cell.hp -= dmg;
      cell.hitFlash = 4;
      soundEngine.playDrill(true, upg.drillTier);
      soundEngine.pulseActivity(0.16);
      this.spawnParticles(c + 0.5, r + 0.5, isOverdrive ? '#FACC15' : upg.drillTier >= 1 ? '#38BDF8' : '#6B7280', 8 + upg.drillTier * 2);
      this.fx.spawnDrillFlash(r, c, this.aimDir, isOverdrive ? '#FACC15' : '#F97316', true);
      this.fx.spawnDrillJet(c + 0.5, r + 0.5, this.aimDir, isOverdrive ? '#FACC15' : '#F97316', true);
      this.triggerShake(3.2, 5);
      this.lastDrillEvent = {
        id: ++this.drillEventSeq,
        r,
        c,
        color: '#F97316',
        isSlag: true,
      };

      if (!this.hasModule('PAR_LUNG') && !isOverdrive) {
        this.oxygen = Math.max(0, this.oxygen - 4); // 4% O2 cost per manual hit
      }

      if (tungsten) {
        this.forceWobbleColumn(c - 1, r);
        this.forceWobbleColumn(c + 1, r);
      }

      if (cell.hp <= 0) {
        this.breakSlag(r, c);
        if (upg.drillTier >= 3) {
          for (const sc of [c - 1, c + 1]) {
            if (sc >= 0 && sc < GRID_COLS) {
              const adj = this.getCell(r, sc);
              if (adj.kind === 'SLAG' && adj.state !== 'EMPTY') {
                adj.hp -= 1;
                adj.hitFlash = 4;
                this.spawnParticles(sc + 0.5, r + 0.5, '#FACC15', 5);
                if (adj.hp <= 0) this.breakSlag(r, sc);
              }
            }
          }
        }
        tryOverdrivePierce();
        this.recomputeClustersAndSupport();
      }
      return;
    }

    if (cell.kind === 'CONDUCTOR') {
      cell.hp -= isOverdrive ? 99 : 1;
      cell.hitFlash = 4;
      soundEngine.playDrill(true, upg.drillTier);
      this.spawnParticles(c + 0.5, r + 0.5, '#F97316', 7);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#FACC15', false);
      this.triggerShake(2.4, 4);
      this.lastDrillEvent = {
        id: ++this.drillEventSeq,
        r,
        c,
        color: '#FACC15',
        isSlag: false,
      };
      if (cell.hp <= 0) {
        this.setCell(r, c, makeEmptyCell());
        this.emitDestruction(r, c, '#FACC15', 45, 'CONDUCTOR');
        tryOverdrivePierce();
        this.recomputeClustersAndSupport();
      }
      return;
    }

    if (cell.kind === 'GEODE') {
      this.breakGeode(r, c);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#FACC15', false);
      this.lastDrillEvent = { id: ++this.drillEventSeq, r, c, color: '#FACC15', isSlag: false };
      tryOverdrivePierce();
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'CRYO_VENT') {
      this.breakCryoVent(r, c);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#67E8F9', false);
      this.lastDrillEvent = { id: ++this.drillEventSeq, r, c, color: '#67E8F9', isSlag: false };
      tryOverdrivePierce();
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'MAGMA_NODE') {
      this.triggerMagmaNode(r, c);
      this.lastDrillEvent = { id: ++this.drillEventSeq, r, c, color: '#FB7185', isSlag: true };
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'GAS_POCKET') {
      this.triggerGasPocket(r, c);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#A3E635', true);
      this.lastDrillEvent = { id: ++this.drillEventSeq, r, c, color: '#A3E635', isSlag: true };
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'ACID_VAT') {
      this.triggerAcidMelt(r, c);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#4ADE80', false);
      this.lastDrillEvent = { id: ++this.drillEventSeq, r, c, color: '#4ADE80', isSlag: false };
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'GRAV_WELL') {
      this.breakGravWell(r, c);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#C084FC', false);
      this.lastDrillEvent = { id: ++this.drillEventSeq, r, c, color: '#C084FC', isSlag: false };
      tryOverdrivePierce();
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'SHOCK_MINE') {
      this.disarmShockMine(r, c);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#FACC15', false);
      this.lastDrillEvent = { id: ++this.drillEventSeq, r, c, color: '#FACC15', isSlag: false };
      tryOverdrivePierce();
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'TREASURE_CACHE') {
      this.openTreasureCache(r, c);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#FACC15', false);
      this.lastDrillEvent = { id: ++this.drillEventSeq, r, c, color: '#FACC15', isSlag: false };
      tryOverdrivePierce();
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'ARTIFACT_POD') {
      this.collectArtifactPod(r, c);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#FACC15', false);
      this.lastDrillEvent = { id: ++this.drillEventSeq, r, c, color: '#FACC15', isSlag: false };
      tryOverdrivePierce();
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'BOUNCE_PAD') {
      this.setCell(r, c, makeEmptyCell());
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 4);
      soundEngine.playDrill(false, upg.drillTier);
      soundEngine.playSteamHiss(c);
      this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'STEAM', '#BAE6FD', 10, 0.12);
      this.emitDestruction(r, c, '#38BDF8', 35, 'BOUNCE_PAD');
      this.addMaterial('cuarzo', 1);
      this.addFloatingText(c + 0.5, r - 0.1, 'VÁLVULA +4% O₂', undefined, '#38BDF8');
      tryOverdrivePierce();
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'RESONANCE_VEIN') {
      this.triggerResonanceVein(r, c);
      tryOverdrivePierce();
      this.recomputeClustersAndSupport();
      return;
    }

    if (cell.kind === 'SUPPORT_BEAM') {
      this.breakSupportBeam(r, c);
      tryOverdrivePierce();
      return;
    }

    if (cell.kind === 'OXYGEN') {
      this.collectOxygenCapsule(r, c);
      return;
    }

    if (cell.kind === 'CRYSTAL') {
      this.breakCrystal(r, c);
      this.fx.spawnDrillFlash(r, c, this.aimDir, '#4AC6E8', false);
      this.lastDrillEvent = {
        id: ++this.drillEventSeq,
        r,
        c,
        color: '#4AC6E8',
        isSlag: false,
      };
      this.triggerShake(2.4, 4);
      tryOverdrivePierce();
      this.recomputeClustersAndSupport();
      return;
    }

    // Normal block destruction (0 hitstop!)
    const stratum = this.getStratumForRow(r);
    const colHex = cell.color >= 0 ? stratum.blockColors[cell.color] : '#9CA3AF';
    const cellKind = cell.kind || 'SOLID';
    this.setCell(r, c, makeEmptyCell());
    soundEngine.playDrill(false, upg.drillTier, c, cellKind);
    soundEngine.pulseActivity(0.2);
    this.addStyle('DRILL', 12);
    this.spawnParticles(c + 0.5, r + 0.5, colHex, 8 + upg.drillTier * 2);
    if (upg.drillTier >= 1 || isOverdrive) {
      this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'SPARK', isOverdrive || upg.drillTier >= 3 ? '#FACC15' : '#38BDF8', 5, 0.11);
    }
    this.fx.spawnDrillFlash(r, c, this.aimDir, isOverdrive ? '#FACC15' : colHex, false);
    this.fx.spawnDrillJet(c + 0.5, r + 0.5, this.aimDir, isOverdrive ? '#FACC15' : colHex, false);
    this.triggerShake(2.2, 4);
    this.lastDrillEvent = {
      id: ++this.drillEventSeq,
      r,
      c,
      color: colHex,
      isSlag: false,
    };
    this.emitDestruction(r, c, colHex, 25, cellKind);
    this.squashX = 1.15;
    this.squashY = 0.85;
    tryOverdrivePierce();
    this.recomputeClustersAndSupport();
  }

  private forceWobbleColumn(c: number, centerR: number): void {
    if (c < 0 || c >= GRID_COLS) return;
    for (let r = centerR - 2; r <= centerR + 2; r++) {
      const cell = this.getCell(r, c);
      if (cell.state === 'SOLID' && cell.kind !== 'RIVET' && cell.kind !== 'MONOLITH') {
        cell.state = 'WOBBLE';
        cell.wobbleMax = this.getCurrentWobbleFrames(r);
        cell.wobbleTimer = Math.floor(cell.wobbleMax * 0.5);
      }
    }
  }

  private breakSlag(r: number, c: number): void {
    this.setCell(r, c, makeEmptyCell());
    this.slagDestroyed++;
    const isoBonus = this.hasModuleMk2('PAR_LEECH') ? 6 : this.hasModule('PAR_LEECH') ? 4 : 2;
    this.addIsotopes(isoBonus);
    if (this.rng.next() < 0.35) this.addMaterial('ferrita', 1);
    if (this.hasModule('PAR_LUNG')) {
      const heal = this.hasModuleMk2('PAR_LUNG') ? 7 : 4;
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + heal);
      this.addFloatingText(c + 0.5, r, `+${heal}% O₂`, undefined, '#A3E635');
    }
    this.emitDestruction(r, c, '#F97316', 75, 'SLAG');
    this.spawnParticles(c + 0.5, r + 0.5, '#9CA3AF', 10);
  }

  private breakCrystal(r: number, c: number): void {
    this.setCell(r, c, makeEmptyCell());
    this.spawnParticles(c + 0.5, r + 0.5, '#4AC6E8', 12);
    soundEngine.playDrill(false);
    this.emitDestruction(r, c, '#4AC6E8', 45, 'CRYSTAL');
    if (this.hasModule('QUA_PRISM')) {
      const heal = this.hasModuleMk2('QUA_PRISM') ? 8 : 4;
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + heal);
      this.addFloatingText(c + 0.5, r, `+${heal}% O₂`, undefined, '#4AC6E8');
    }
  }

  private breakGeode(r: number, c: number): void {
    this.setCell(r, c, makeEmptyCell());
    this.geodesBroken++;
    let mult = this.activeMutators.includes('CRYSTAL_FAULT') ? 2 : 1;
    if (this.overdriveTimer > 0) mult *= 1.5;
    if (this.hasModule('PAR_SCAVENGER')) mult *= 1.75;
    const totalIso = Math.round((12 + (this.hasRelic('REL_GEODE_COMPASS') ? 10 : 0)) * mult);
    this.fx.spawnIsotopeOrbs(c + 0.5, r + 0.5, totalIso, 5, '#FACC15');
    this.addMaterial('cuarzo', 1);
    if (this.rng.next() < 0.65) this.addMaterial('ferrita', 1);
    if (r >= 1500 && this.rng.next() < 0.4) this.addMaterial('eter', 1);
    if (r >= 2500) this.addMaterial('alabastro', 1);
    this.addOverdrive(8);
    this.spawnParticles(c + 0.5, r + 0.5, '#FACC15', 14);
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'SPARK', '#F472B6', 10, 0.13);
    this.fx.spawnLight(c + 0.5, r + 0.5, 2.8, '#FACC15', 16, 0.44);
    soundEngine.playGeodeBreak();
    soundEngine.pulseActivity(0.24);
    this.emitDestruction(r, c, '#FACC15', 80, 'GEODE');
    this.addFloatingText(c + 0.5, r - 0.1, `GEODA +${totalIso} ISO`, '+CUARZO · +15% OVR', '#FACC15');
  }

  private triggerResonanceVein(r: number, c: number): void {
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY') return;
    this.setCell(r, c, makeEmptyCell());
    this.recordMineralStats('RESONANCE_VEIN', r);
    this.addOverdrive(26);
    this.addResonance(28);
    this.addMaterial('cuarzo', 1);
    this.addIsotopes(6);
    this.addStyle('RESONANCE_VEIN', 50);

    for (let sc = Math.max(0, c - 3); sc <= Math.min(GRID_COLS - 1, c + 3); sc++) {
      if (sc === c) continue;
      const side = this.getCell(r, sc);
      if (side.state === 'EMPTY') continue;
      if (side.kind === 'SLAG') {
        side.hp -= 2;
        side.hitFlash = 6;
        if (side.hp <= 0) this.breakSlag(r, sc);
      } else if (side.kind === 'CRYSTAL') {
        this.breakCrystal(r, sc);
      }
    }

    this.fx.spawnBlastWave({
      x: c + 0.5,
      y: r + 0.5,
      radius: 0.4,
      maxRadius: 3.4,
      life: 14,
      maxLife: 14,
      color: '#FDE047',
      isHorizontalWave: true,
    });
    this.fx.spawnLight(c + 0.5, r + 0.5, 3.0, '#FDE047', 16, 0.46);
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'SPARK', '#FEF08A', 16, 0.14);
    soundEngine.playDetonate(2, c);
    this.emitDestruction(r, c, '#FDE047', 85, 'RESONANCE_VEIN');
    this.addFloatingText(c + 0.5, r - 0.1, 'VETA PIEZOELÉCTRICA!', 'ONDA -2 HP · +CARGA', '#FDE047');
  }

  private breakSupportBeam(r: number, c: number): void {
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY') return;
    this.setCell(r, c, makeEmptyCell());
    this.recordMineralStats('SUPPORT_BEAM', r);
    const iso = this.addIsotopes(5);
    this.addMaterial('ferrita', 1);
    this.addStyle('BEAM_CUT', 35);
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'SPARK', '#FB923C', 14, 0.13);
    soundEngine.playDrill(true, 1);
    this.triggerShake(3.2, 6);
    this.emitDestruction(r, c, '#FB923C', 65, 'SUPPORT_BEAM');
    this.addFloatingText(c + 0.5, r - 0.1, `PUNTAL +${iso} ISO`, '+FERRITA · SOPORTE LIBERADO', '#FB923C');
    this.recomputeClustersAndSupport();
  }

  private shatterOverheadBlock(r: number, c: number, isPerfect: boolean): void {
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY') return;
    const bKind = cell.kind || 'SOLID';
    this.setCell(r, c, makeEmptyCell());

    if (this.hasModule('BAL_OVERHEAD_BREAKER')) {
      const extraDepth = this.hasModuleMk2('BAL_OVERHEAD_BREAKER') ? 2 : 1;
      for (let step = 1; step <= extraDepth; step++) {
        const sr = r - step;
        if (sr < 0) break;
        const stacked = this.getCell(sr, c);
        if (
          stacked.state === 'FALLING' &&
          stacked.kind !== 'OXYGEN' &&
          stacked.kind !== 'RIVET' &&
          stacked.kind !== 'MONOLITH' &&
          stacked.kind !== 'BREACH_SEAL' &&
          stacked.kind !== 'BIFURCATION_SEAL'
        ) {
          const sk = stacked.kind || 'SOLID';
          this.setCell(sr, c, makeEmptyCell());
          this.emitDestruction(sr, c, '#FACC15', 30, sk);
        }
      }
    }

    this.invulnTimer = Math.max(this.invulnTimer, isPerfect ? 20 : 16);
    this.triggerShake(isPerfect ? 4.8 : 3.2, 7);
    this.addCamTrauma(isPerfect ? 0.35 : 0.22);
    this.hitstopFrames = Math.max(this.hitstopFrames, isPerfect ? 3 : 2);
    soundEngine.playParry();
    this.fx.spawnParrySlash(this.px + 0.5, this.py - 0.75, this.facing || 1);
    this.fx.spawnLight(c + 0.5, Math.max(0, this.py - 0.8), 2.8, isPerfect ? '#FACC15' : '#38BDF8', 16, 0.48);
    this.fx.spawnCellularBurst(c + 0.5, Math.max(0, this.py - 0.8), 'SPARK', isPerfect ? '#FACC15' : '#38BDF8', 18, 0.16);
    this.emitDestruction(r, c, isPerfect ? '#FACC15' : '#38BDF8', isPerfect ? 90 : 45, bKind);
    this.addStyle(isPerfect ? 'PERFECT_COUNTER' : 'GUARD_COUNTER', isPerfect ? 65 : 30);
    if (isPerfect) {
      this.addOverdrive(14);
      this.addResonance(16);
      const mk2O2 = this.hasModuleMk2('BAL_OVERHEAD_BREAKER') ? 6 : 0;
      if (mk2O2 > 0) this.oxygen = Math.min(this.maxOxygen, this.oxygen + mk2O2);
      this.addFloatingText(
        this.px + 0.5,
        this.py - 1.35,
        'CONTRAATAQUE PERFECTO!',
        mk2O2 > 0 ? `+6% O₂ · +CARGA` : '0% O₂ · +CARGA',
        '#FACC15',
        1.15
      );
    } else {
      this.addFloatingText(this.px + 0.5, this.py - 1.35, 'BLOQUEO AÉREO!', '-6% O₂', '#38BDF8');
    }
    this.recomputeClustersAndSupport();
  }

  public triggerOverheadCounter(): 'PERFECT' | 'GUARD' | 'DODGE' | 'WHIFF' | 'COOLDOWN' {
    if (this.finished || this.pendingStory) return 'COOLDOWN';
    if (this.overheadCounterCooldown > 0) {
      soundEngine.playThermalDud();
      this.addFloatingText(this.px + 0.5, this.py - 1.2, 'ENFRIANDO...', undefined, '#94A3B8');
      return 'COOLDOWN';
    }

    const pRow = Math.max(0, Math.floor(this.py - 0.45));
    const pCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));
    const isBreaker = this.hasModule('BAL_OVERHEAD_BREAKER');

    let targetR = -1;
    let targetCell: Cell | null = null;
    let distRows = 99;

    if (this.coyoteCrushTimer > 0 && this.coyoteCrushCellPos) {
      targetR = this.coyoteCrushCellPos.r;
      targetCell = this.getCell(this.coyoteCrushCellPos.r, this.coyoteCrushCellPos.c);
      distRows = 0;
    } else {
      for (let rr = pRow - 1; rr >= Math.max(this.minPrunedRow, pRow - 5); rr--) {
        const cell = this.getCell(rr, pCol);
        if (cell.state === 'FALLING') {
          targetR = rr;
          targetCell = cell;
          distRows = Math.max(0, pRow - (rr + cell.fallOffset));
          break;
        }
      }
    }

    if (targetCell && targetR >= 0 && this.overheadCounterHeat < 3) {
      if (targetCell.kind === 'MONOLITH' || targetCell.kind === 'RIVET' || targetCell.kind === 'BREACH_SEAL') {
        const firstDir: -1 | 1 = this.facing < 0 ? -1 : 1;
        const secondDir: -1 | 1 = firstDir === 1 ? -1 : 1;
        for (const d of [firstDir, secondDir] as const) {
          const nc = pCol + d;
          if (nc >= 0 && nc < GRID_COLS && this.getCell(pRow, nc).state === 'EMPTY') {
            this.targetCol = nc;
            this.gridCol = nc;
            this.px = nc;
            this.facing = d;
            this.coyoteCrushTimer = 0;
            this.coyoteCrushCellPos = null;
            this.invulnTimer = Math.max(this.invulnTimer, 20);
            this.addStyle('DODGE_PARRY', 55);
            soundEngine.playDash();
            this.addFloatingText(nc + 0.5, this.py - 1.2, 'ESQUIVA LATERAL!', 'ROCA INDESTRUCTIBLE', '#38BDF8');
            return 'DODGE';
          }
        }
      }

      if (distRows <= 2.35) {
        const perfectCutoff = isBreaker ? 1.65 : 1.15;
        const isPerfect = this.coyoteCrushTimer > 0 || distRows <= perfectCutoff;
        const o2Cost = isPerfect ? 0 : isBreaker ? 3 : 6;
        if (o2Cost > 0 && this.overdriveTimer <= 0) {
          this.oxygen = Math.max(0, this.oxygen - o2Cost);
        }
        const hitC = this.coyoteCrushCellPos ? this.coyoteCrushCellPos.c : pCol;
        this.coyoteCrushTimer = 0;
        this.coyoteCrushCellPos = null;
        this.overheadGuardTimer = 0;
        this.shatterOverheadBlock(targetR, hitC, isPerfect);
        this.overheadCounterHeat++;
        this.overheadHeatDecayTimer = 150;
        if (this.overheadCounterHeat >= 3) {
          this.overheadCounterCooldown = 75;
        }
        return isPerfect ? 'PERFECT' : 'GUARD';
      }

      // Slightly higher falling block: brace overhead gauntlet for incoming impact
      this.overheadGuardTimer = isBreaker ? 24 : 16;
      this.aimDir = 'UP';
      this.setActionPose('PARRY_SLASH', 10);
      soundEngine.playUiClick();
      this.addFloatingText(this.px + 0.5, this.py - 1.2, 'GUARDIA SUPERIOR', undefined, '#38BDF8');
      return 'GUARD';
    }

    // Blind whiff costs a bit of oxygen & locks counter briefly
    if (this.overdriveTimer <= 0) {
      this.oxygen = Math.max(0, this.oxygen - 3);
    }
    this.overheadCounterCooldown = 36;
    this.aimDir = 'UP';
    soundEngine.playThermalDud();
    this.addFloatingText(this.px + 0.5, this.py - 1.2, 'SIN IMPACTO -3% O₂', undefined, '#94A3B8');
    return 'WHIFF';
  }

  private breakCryoVent(r: number, c: number): void {
    this.setCell(r, c, makeEmptyCell());
    this.oxygenFreezeTimer = Math.max(this.oxygenFreezeTimer, 240);
    this.oxygen = Math.min(this.maxOxygen, this.oxygen + 6);
    this.addMaterial('cuarzo', 1);
    let thermalSteam = false;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nc >= 0 && nc < GRID_COLS && nr >= 0) {
        const adj = this.getCell(nr, nc);
        if (adj.kind === 'SLAG' && adj.state !== 'EMPTY') {
          adj.hp = Math.min(1, adj.hp);
          adj.hitFlash = 6;
          thermalSteam = true;
        } else if (adj.kind === 'MAGMA_NODE' && adj.state !== 'EMPTY') {
          this.setCell(nr, nc, makeEmptyCell());
          this.addMaterial('ignita', 1);
          this.emitDestruction(nr, nc, '#67E8F9', 95, 'MAGMA_NODE');
          this.fx.spawnCellularBurst(nc + 0.5, nr + 0.5, 'STEAM', '#E0F2FE', 14, 0.12);
          thermalSteam = true;
        }
      }
    }
    this.fx.spawnBlastWave({
      x: c + 0.5,
      y: r + 0.5,
      radius: 0.3,
      maxRadius: 2.2,
      life: 14,
      maxLife: 14,
      color: '#67E8F9',
    });
    this.fx.spawnLight(c + 0.5, r + 0.5, 2.5, '#67E8F9', 14, 0.38);
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'CRYO', '#A5F3FC', 12, 0.12);
    this.fx.spawnCellularBurst(c + 0.5, r + 0.3, 'STEAM', '#F0F9FF', thermalSteam ? 14 : 7, 0.08);
    soundEngine.playCryoVent(c);
    if (thermalSteam) {
      soundEngine.playSteamHiss(c);
      this.addStyle('CRYO_REACT', 45);
      // Buoyant thermal steam updraft lifts player slightly if close
      if (Math.hypot(this.px - c, this.py - (r + 1)) <= 1.8) {
        this.vy = Math.min(this.vy, -8.5);
        this.playerState = 'falling';
        this.playerFallRows = 0;
      }
    }
    this.emitDestruction(r, c, '#67E8F9', 60, 'CRYO_VENT');
    this.addFloatingText(
      c + 0.5,
      r - 0.1,
      thermalSteam ? 'REACCIÓN CRIO-VAPOR!' : 'CRIO-PULSO +6% O₂',
      thermalSteam ? 'ESCORIA QUEBRADIZA · VAPOR' : 'DRENAJE PAUSADO 4s',
      '#67E8F9'
    );
  }

  private triggerMagmaNode(r: number, c: number): void {
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY') return;
    this.setCell(r, c, makeEmptyCell());
    this.addOverdrive(this.hasModule('PYRO_GAS_SPARK') ? 10 : 5);
    this.addMaterial('ignita', 1);
    if (this.hasModuleMk2('PYRO_GAS_SPARK')) {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 12);
    }
    this.emitDestruction(r, c, '#FB7185', 90, 'MAGMA_NODE');
    const radius = this.hasModule('PYRO_GAS_SPARK') ? 2 : 1;
    this.triggerBlastArea(r, c, radius, this.hasModuleMk2('PYRO_GAS_SPARK'), -1);
    this.fx.spawnBlastWave({
      x: c + 0.5,
      y: r + 0.5,
      radius: 0.4,
      maxRadius: 1.8 + radius * 1.1,
      life: 14,
      maxLife: 14,
      color: '#FB7185',
    });
    this.fx.spawnLight(c + 0.5, r + 0.5, 3.0, '#FB7185', 16, 0.45);
    this.fx.applyShockwaveToParticles(c + 0.5, r + 0.5, 3.8, 2.6);
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'EMBER', '#FB923C', 16, 0.14);
    soundEngine.playDetonate(3, c);
    soundEngine.pulseActivity(0.28);
    this.addStyle('MAGMA_BLAST', 40);
    this.triggerShake(5.5, 8);
    this.addCamTrauma(0.42);
    this.chromaFlashFrames = Math.max(this.chromaFlashFrames, 1);
    this.addFloatingText(c + 0.5, r - 0.1, 'NÓDULO MAGMÁTICO!', `+IGNITA · PULSO`, '#FB7185');
  }

  private triggerGasPocket(r: number, c: number): void {
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY') return;
    this.setCell(r, c, makeEmptyCell());
    this.addMaterial('ignita', 1);
    this.addOverdrive(this.hasModule('PYRO_GAS_SPARK') ? 10 : 4);
    if (this.hasModuleMk2('PYRO_GAS_SPARK')) {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 12);
    }
    this.emitDestruction(r, c, '#84CC16', 75, 'GAS_POCKET');
    const radius = this.hasModule('PYRO_GAS_SPARK') ? 2 : 1;
    this.triggerBlastArea(r, c, radius, this.hasModuleMk2('PYRO_GAS_SPARK'), -1);
    this.fx.spawnBlastWave({
      x: c + 0.5,
      y: r + 0.5,
      radius: 0.4,
      maxRadius: 2.0 + radius,
      life: 15,
      maxLife: 15,
      color: '#84CC16',
    });
    this.fx.spawnLight(c + 0.5, r + 0.5, 3.2, '#A3E635', 16, 0.48);
    this.fx.applyShockwaveToParticles(c + 0.5, r + 0.5, 4.0, 2.8);
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'TOXIC', '#BEF264', 18, 0.14);
    soundEngine.playGasExplode(c);
    soundEngine.pulseActivity(0.28);
    this.addStyle('GAS_CHAIN', 45);
    this.triggerShake(5.2, 8);
    this.addCamTrauma(0.45);
    this.addFloatingText(c + 0.5, r - 0.1, 'BOLSA DE GAS!', 'DETONACIÓN QUÍMICA', '#A3E635');
  }

  private triggerAcidMelt(r: number, c: number): void {
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY') return;
    this.setCell(r, c, makeEmptyCell());
    this.addMaterial('ignita', 1);
    this.emitDestruction(r, c, '#4ADE80', 65, 'ACID_VAT');
    soundEngine.playAcidMelt(c);
    this.fx.spawnLight(c + 0.5, r + 0.5, 2.4, '#4ADE80', 16, 0.4);
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'ACID', '#4ADE80', 18, 0.12);

    let melted = 0;
    let lowestRow = r;
    for (let mr = r + 1; mr <= r + 3; mr++) {
      const target = this.getCell(mr, c);
      if (target.state === 'EMPTY') {
        lowestRow = mr;
        continue;
      }
      if (target.kind === 'RIVET' || target.kind === 'MONOLITH' || target.kind === 'BREACH_SEAL' || target.kind === 'BIFURCATION_SEAL') {
        break;
      }
      if (target.kind === 'SLAG') this.breakSlag(mr, c);
      else {
        const mKind = target.kind || 'SOLID';
        this.setCell(mr, c, makeEmptyCell());
        this.emitDestruction(mr, c, '#4ADE80', 35, mKind);
      }
      melted++;
      lowestRow = mr;
      this.acidMelts++;
      if (this.hasModule('PAR_ACID_SIPHON')) {
        const heal = this.hasModuleMk2('PAR_ACID_SIPHON') ? 7 : 4;
        const iso = this.hasModuleMk2('PAR_ACID_SIPHON') ? 5 : 3;
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + heal);
        this.addIsotopes(iso);
      }
      if (this.hasRelic('REL_ACID_PLATING')) {
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 5);
      }
    }
    // Leave persistent corrosive puddle resting on top of lowest melted cavity
    let floorRow = lowestRow + 1;
    while (floorRow < lowestRow + 8 && this.getCell(floorRow, c).state === 'EMPTY') {
      floorRow++;
    }
    if (this.getCell(floorRow, c).state !== 'EMPTY') {
      if (this.acidPuddles.length > 16) this.acidPuddles.shift();
      this.acidPuddles.push({ r: floorRow, c, timer: 240, maxTimer: 240 });
    }
    this.addStyle('ACID_MELT', 35);
    this.addFloatingText(c + 0.5, r - 0.1, `ÁCIDO CORROSIVO ×${melted}`, 'CHARCO CORROSIVO ACTIVO', '#4ADE80');
  }

  private breakGravWell(r: number, c: number): void {
    this.setCell(r, c, makeEmptyCell());
    this.addMaterial('eter', 1);
    this.emitDestruction(r, c, '#C084FC', 85, 'GRAV_WELL');
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'VOID_SPARK', '#E879F9', 16, 0.14);
    this.fx.spawnLight(c + 0.5, r + 0.5, 2.8, '#C084FC', 15, 0.42);
    this.fx.applyImpulseToCables(c + 0.5, r + 0.5, 4.0, -2.5);
    this.fx.spawnBlastWave({
      x: c + 0.5,
      y: r + 0.5,
      radius: 0.3,
      maxRadius: 2.6,
      life: 14,
      maxLife: 14,
      color: '#C084FC',
    });
    soundEngine.playSwap(c);
    this.addStyle('GRAV_IMPLODE', 45);
    this.addFloatingText(c + 0.5, r - 0.1, '+1 ÉTER CUÁNTICO', 'IMPLOSIÓN', '#C084FC');
  }

  private disarmShockMine(r: number, c: number): void {
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY') return;
    this.setCell(r, c, makeEmptyCell());
    const ovrGain = this.hasModule('PAR_MINE_HARVEST') ? 18 : 10;
    this.addOverdrive(ovrGain);
    this.addMaterial('titanio', 1);
    if (this.hasModuleMk2('PAR_MINE_HARVEST')) {
      this.kineticShields += 1;
    }
    this.emitDestruction(r, c, '#FACC15', 95, 'SHOCK_MINE');
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'SPARK', '#FEF08A', 12, 0.12);
    soundEngine.playBounce();
    this.addFloatingText(c + 0.5, r - 0.1, 'MINA DESARMADA!', `+${ovrGain}% OVR · +1 TITANIO`, '#FACC15');
  }

  private openTreasureCache(r: number, c: number): void {
    this.setCell(r, c, makeEmptyCell());
    this.cachesOpened++;
    let bonusMult = this.hasRelic('REL_GEODE_COMPASS') || this.hasModule('PAR_SCAVENGER') ? 1.5 : 1;
    if (this.hasModule('QUA_VAULT_SENSE')) bonusMult *= 1.25;
    const iso = this.addIsotopes(Math.round(35 * bonusMult));
    this.addMaterial('ferrita', 3);
    this.addMaterial('cuarzo', 2);
    this.addMaterial(r >= 1500 ? 'eter' : 'titanio', 2);
    if (r >= 2500) this.addMaterial('alabastro', 2);

    this.kineticShields += this.hasModuleMk2('QUA_VAULT_SENSE') ? 2 : 1;
    this.fx.spawnIsotopeOrbs(c + 0.5, r + 0.5, 10, 5, '#FACC15');
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'SPARK', '#FACC15', 18, 0.15);
    soundEngine.playTreasureOpen();
    this.emitDestruction(r, c, '#FACC15', 150, 'TREASURE_CACHE');
    this.addFloatingText(c + 0.5, r - 0.1, `COFRE +${iso} ISO!`, '+ESCUDO · +MATERIALES', '#FACC15', 1.15);
  }

  public collectArtifactPod(r: number, c: number): void {
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY') return;
    const stratum = this.getStratumForRow(r);
    const art =
      ARTIFACTS.find((a) => a.id === cell.artifactId) ||
      ARTIFACTS.find((a) => a.stratumId === stratum.id) ||
      ARTIFACTS[0];
    this.setCell(r, c, makeEmptyCell());

    const alreadyOwned =
      (this.config.archive.discoveredArtifacts || []).includes(art.id) ||
      this.discoveredArtifacts.includes(art.id);
    if (!this.discoveredArtifacts.includes(art.id)) {
      this.discoveredArtifacts.push(art.id);
    }

    const scanMult = this.hasRelic('REL_ARTIFACT_SCANNER') ? 1.35 : 1;
    const bonusIso = this.addIsotopes(Math.round(art.findBonusIso * scanMult));
    this.addMaterial(art.findBonusMat, alreadyOwned ? 2 : 1);
    this.addResonance(12);
    this.addOverdrive(10);
    this.addStyle('ARTIFACT', 120);
    this.fx.spawnLight(c + 0.5, r + 0.5, 3.6, art.color, 24, 0.58);
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'SPARK', art.accent, 22, 0.18);
    this.fx.spawnIsotopeOrbs(c + 0.5, r + 0.5, Math.min(20, Math.round(art.findBonusIso * 0.4)), 5, art.color);
    soundEngine.playArtifactFound();
    soundEngine.pulseActivity(0.35);
    this.emitDestruction(r, c, art.color, 250, 'ARTIFACT_POD');

    const matNames: Record<MaterialId, string> = {
      ferrita: 'Ferrita',
      cuarzo: 'Cuarzo',
      ignita: 'Ignita',
      titanio: 'Titanio',
      eter: 'Éter',
      alabastro: 'Alabastro',
    };
    const bonusText = `+${bonusIso} ISO · +${matNames[art.findBonusMat]} · +25% RESO`;
    this.recentArtifactBanner = {
      id: art.id,
      name: art.name,
      rarity: alreadyOwned ? `ECO · ${art.rarity}` : art.rarity,
      color: art.color,
      bonusText,
      timer: 220,
    };
    this.addFloatingText(
      c + 0.5,
      r - 0.15,
      alreadyOwned ? `ECO DE ARTEFACTO!` : `¡ARTEFACTO HALLADO!`,
      `${art.name} · +${bonusIso} ISO`,
      art.color,
      1.2
    );
    this.triggerOperatorBanter('artifact', true);
  }

  public addResonance(amount: number): void {
    if (this.finished || this.config.mode === 'DUEL') return;
    const prev = this.resonanceCharge;
    this.resonanceCharge = Math.min(100, this.resonanceCharge + amount * this.chargeSpeedMult * 0.38);
    if (prev < 100 && this.resonanceCharge >= 100) {
      soundEngine.playComboTierUp(6);
      this.addFloatingText(
        this.px + 0.5,
        this.py - 1.4,
        `${this.getChassisDef().signatureName?.toUpperCase() || 'RESONANCIA'} LISTA!`,
        'PULSA [F] PARA ACTIVAR',
        this.getChassisDef().accentColor,
        1.1
      );
    }
  }

  public triggerOperatorResonance(): boolean {
    if (this.finished || this.pendingStory || this.resonanceCharge < 100) return false;
    this.resonanceCharge = 0;
    this.resonanceUsed++;
    const def = this.getChassisDef();
    const pRow = Math.max(0, this.gridRow);
    const pCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));

    soundEngine.playResonanceBurst();
    soundEngine.pulseActivity(0.45);
    this.addStyle('RESONANCE', 65);
    this.triggerShake(5.5, 9);
    this.addCamTrauma(0.45);
    this.fx.spawnLight(this.px + 0.5, this.py - 0.5, 3.8, def.accentColor, 20, 0.55);
    this.fx.spawnBlastWave({
      x: this.px + 0.5,
      y: this.py - 0.5,
      radius: 0.35,
      maxRadius: 3.4,
      life: 16,
      maxLife: 16,
      color: def.accentColor,
    });
    this.fx.applyShockwaveToParticles(this.px + 0.5, this.py - 0.5, 4.0, 3.2);

    switch (def.id) {
      case 'MKI_VERTICE': {
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 12);
        for (let rr = pRow - 1; rr <= pRow + 1; rr++) {
          for (let cc = Math.max(0, pCol - 1); cc <= Math.min(GRID_COLS - 1, pCol + 1); cc++) {
            const c = this.getCell(rr, cc);
            if (c.kind === 'SLAG') this.breakSlag(rr, cc);
          }
        }
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'DESCARGA DE VÁLVULA!', '+12% O₂ · ESCORIA ROTA', def.accentColor, 1.15);
        break;
      }
      case 'MKI_BRISA': {
        this.vy = Math.min(this.vy, -5.5);
        this.playerFallRows = 0;
        this.invulnTimer = Math.max(this.invulnTimer, 150);
        this.addOverdrive(15);
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'CORRIENTE ASCENDENTE!', '2,5s INVULN · +15% OVR', def.accentColor, 1.15);
        break;
      }
      case 'MKII_ESPECTRO': {
        const stratum = this.getStratumForRow(pRow + 1);
        const targetCol = this.rng.int(0, Math.max(1, stratum.colorCount) - 1);
        let changed = 0;
        for (let rr = pRow + 1; rr <= pRow + 2 && changed < 4; rr++) {
          for (let cc = Math.max(0, pCol - 1); cc <= Math.min(GRID_COLS - 1, pCol + 1) && changed < 4; cc++) {
            const cell = this.getCell(rr, cc);
            if (cell.state === 'SOLID' && cell.kind === 'SOLID') {
              cell.color = targetCol;
              changed++;
            }
          }
        }
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'ARMONIZACIÓN CROMÁTICA!', `${changed} BLOQUES SINCRO`, def.accentColor, 1.15);
        break;
      }
      case 'MKIII_YUNQUE': {
        for (let rr = pRow; rr <= pRow + 1; rr++) {
          for (let cc = 0; cc < GRID_COLS; cc++) {
            const cell = this.getCell(rr, cc);
            if (cell.kind === 'SLAG') {
              cell.hp -= 2;
              cell.hitFlash = 6;
              if (cell.hp <= 0) this.breakSlag(rr, cc);
            } else if (cell.kind === 'SHOCK_MINE') {
              this.disarmShockMine(rr, cc);
            }
          }
        }
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'GOLPE DE FRAGUA!', 'ONDAS CONTRA ESCORIA', def.accentColor, 1.15);
        break;
      }
      case 'MKVII_PIRO': {
        const stratum = this.getStratumForRow(pRow + 1);
        let bestColor = 0;
        let ignited = false;
        for (let cc = Math.max(0, pCol - 1); cc <= Math.min(GRID_COLS - 1, pCol + 1); cc++) {
          const cand = this.getCell(pRow + 1, cc);
          if (cand.kind === 'SOLID' && cand.color >= 0) {
            bestColor = cand.color;
            break;
          }
        }
        for (let cc = Math.max(0, pCol - 1); cc <= Math.min(GRID_COLS - 1, pCol + 1); cc++) {
          const cell = this.getCell(pRow + 1, cc);
          if (cell.state === 'SOLID' && (cell.kind === 'SOLID' || cell.kind === 'PHASE')) {
            cell.kind = 'SOLID';
            cell.color = bestColor % Math.max(1, stratum.colorCount);
            ignited = true;
          }
        }
        if (!ignited) this.triggerBlastArea(pRow + 1, pCol, 1, true);
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'IGNI-IGNICIÓN!', 'REACCIÓN PIROCLÁSTICA', def.accentColor, 1.15);
        break;
      }
      case 'MKIV_METRONOMO': {
        this.oxygenFreezeTimer = Math.max(this.oxygenFreezeTimer, 240);
        this.addStyle('RESONANCE_BEAT', 90);
        this.comboTimerFrames = Math.max(this.comboTimerFrames, this.comboMaxTimerFrames);
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'CADENCIA CERO!', 'O₂ PAUSADO 4s · +ESTILO', def.accentColor, 1.15);
        break;
      }
      case 'MKV_TITAN': {
        this.kineticShields += 1;
        this.invulnTimer = Math.max(this.invulnTimer, 90);
        for (let rr = Math.max(this.minPrunedRow, pRow - 4); rr < pRow; rr++) {
          const cell = this.getCell(rr, pCol);
          if (cell.state === 'WOBBLE') cell.state = 'SOLID';
        }
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'BASTIÓN ABISAL!', '+1 ESCUDO CINÉTICO', def.accentColor, 1.15);
        break;
      }
      case 'MKVI_QUANTUM': {
        let pulledO2 = 0;
        for (let rr = Math.max(this.minPrunedRow, pRow - 4); rr <= pRow + 4; rr++) {
          for (let cc = 0; cc < GRID_COLS; cc++) {
            if (this.getCell(rr, cc).kind === 'OXYGEN') {
              this.collectOxygenCapsule(rr, cc);
              pulledO2++;
            }
          }
        }
        this.addOverdrive(22);
        this.addFloatingText(
          this.px + 0.5,
          this.py - 1.3,
          'PULSO ENTRELAZADO!',
          pulledO2 > 0 ? `+22% OVR · ${pulledO2} O₂` : '+22% OVERDRIVE',
          def.accentColor,
          1.15
        );
        break;
      }
    }

    this.recomputeClustersAndSupport();
    this.checkIgnitions(2);
    this.checkImmediatePlayerFall();
    return true;
  }

  public triggerOperatorTactical(): boolean {
    if (this.finished || this.pendingStory || this.tacticalCooldown > 0) return false;
    const def = this.getChassisDef();
    this.tacticalCooldown = this.tacticalMaxCooldown;
    const pRow = Math.max(0, this.gridRow);
    const pCol = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));

    soundEngine.playResonanceBurst();
    soundEngine.pulseActivity(0.32);
    this.addStyle('TACTICAL', 40);
    this.triggerShake(4.0, 6);
    this.fx.spawnLight(this.px + 0.5, this.py - 0.5, 3.0, def.accentColor, 16, 0.45);

    switch (def.id) {
      case 'MKI_VERTICE': {
        for (let rr = pRow + 1; rr <= pRow + 3; rr++) {
          const target = this.getCell(rr, pCol);
          if (target.kind === 'RIVET' || target.kind === 'MONOLITH' || target.kind === 'BREACH_SEAL') break;
          if (target.state !== 'EMPTY') this.drillAt(rr, pCol, false, false);
        }
        for (const sc of [pCol - 1, pCol + 1]) {
          if (sc >= 0 && sc < GRID_COLS) {
            const side = this.getCell(pRow + 1, sc);
            if (side.kind === 'SLAG') {
              side.hp -= 2;
              if (side.hp <= 0) this.breakSlag(pRow + 1, sc);
            }
          }
        }
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'PULSO PERFORADOR!', '3 BLOQUES · ESCORIA', def.accentColor);
        break;
      }
      case 'MKII_ESPECTRO': {
        const oppCol = GRID_COLS - 1 - pCol;
        const c1 = this.getCell(pRow + 1, pCol);
        const c2 = this.getCell(pRow + 1, oppCol);
        if (isSwappableKind(c1.kind) && isSwappableKind(c2.kind)) {
          this.setCell(pRow + 1, pCol, c2);
          this.setCell(pRow + 1, oppCol, c1);
          this.fx.spawnSwapTrail(pRow + 1, pCol, pRow + 1, oppCol, '#38BDF8', '#A78BFA');
        }
        this.invulnTimer = Math.max(this.invulnTimer, 72);
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'CAMBIO FANTASMA!', 'ESPEJO · 1,2s INVULN', def.accentColor);
        break;
      }
      case 'MKI_BRISA': {
        this.oxygenFreezeTimer = Math.max(this.oxygenFreezeTimer, 300);
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 10);
        for (let rr = Math.max(this.minPrunedRow, pRow - 3); rr <= pRow; rr++) {
          const cell = this.getCell(rr, pCol);
          if (cell.state === 'WOBBLE') cell.state = 'SOLID';
        }
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'VELO TÉRMICO!', '+10% O₂ · 5s CRIO', def.accentColor);
        break;
      }
      case 'MKIII_YUNQUE': {
        this.triggerBlastArea(pRow + 1, pCol, 1, false);
        for (let rr = Math.max(0, pRow - 1); rr <= pRow + 2; rr++) {
          for (let cc = Math.max(0, pCol - 2); cc <= Math.min(GRID_COLS - 1, pCol + 2); cc++) {
            const c = this.getCell(rr, cc);
            if (c.kind === 'SLAG') {
              c.hp -= 2;
              if (c.hp <= 0) this.breakSlag(rr, cc);
            }
          }
        }
        if (this.kineticShields < 3) this.kineticShields += 1;
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'MARTILLO BASTIÓN!', 'ESCORIA ROTA · +ESCUDO', def.accentColor);
        break;
      }
      case 'MKIV_METRONOMO': {
        for (let cc = Math.max(0, pCol - 1); cc <= Math.min(GRID_COLS - 1, pCol + 1); cc++) {
          const c = this.getCell(pRow + 1, cc);
          if (c.kind === 'SLAG') {
            c.hp -= 2;
            if (c.hp <= 0) this.breakSlag(pRow + 1, cc);
          } else if (c.state !== 'EMPTY' && c.kind !== 'RIVET' && c.kind !== 'MONOLITH') {
            this.drillAt(pRow + 1, cc, false, false);
          }
        }
        const onBeat = soundEngine.isOnBeat(0.32);
        if (onBeat) {
          this.oxygen = Math.min(this.maxOxygen, this.oxygen + 12);
          this.tacticalCooldown = Math.round(this.tacticalCooldown * 0.65);
        }
        this.addFloatingText(
          this.px + 0.5,
          this.py - 1.3,
          onBeat ? 'SÍNCOPE PERFECTA!' : 'SÍNCOPE SÓNICA!',
          onBeat ? '+12% O₂ · -35% ENFRIAM.' : 'BARRIDO 3×1',
          def.accentColor
        );
        break;
      }
      case 'MKV_TITAN': {
        for (let rr = pRow + 1; rr <= pRow + 2; rr++) {
          for (let cc = Math.max(0, pCol - 1); cc <= Math.min(GRID_COLS - 1, pCol + 1); cc++) {
            const c = this.getCell(rr, cc);
            if (c.kind === 'SLAG') this.breakSlag(rr, cc);
            else if (c.state !== 'EMPTY' && c.kind !== 'RIVET' && c.kind !== 'MONOLITH' && c.kind !== 'BREACH_SEAL') {
              this.drillAt(rr, cc, false, false);
            }
          }
        }
        if (this.kineticShields < 4) this.kineticShields += 1;
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'APLASTAMIENTO TITÁN!', 'BOLSILLO 3×2 · +ESCUDO', def.accentColor);
        break;
      }
      case 'MKVI_QUANTUM': {
        const stratum = this.getStratumForRow(pRow + 2);
        const modColors = Math.max(2, stratum.colorCount);
        for (let rr = pRow + 1; rr <= pRow + 3; rr++) {
          for (let cc = Math.max(0, pCol - 1); cc <= Math.min(GRID_COLS - 1, pCol + 1); cc++) {
            const cell = this.getCell(rr, cc);
            if (cell.state === 'SOLID' && (cell.kind === 'SOLID' || cell.kind === 'PHASE')) {
              cell.kind = 'SOLID';
              cell.color = (cc === pCol ? 0 : 1) % modColors;
            }
          }
        }
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'PULSO ENTRÓPICO!', 'MATRIZ 3×3 ALINEADA', def.accentColor);
        break;
      }
      case 'MKVII_PIRO': {
        this.triggerBlastArea(pRow + 1, pCol, 1, false);
        for (let rr = pRow + 1; rr <= pRow + 2; rr++) {
          for (let cc = Math.max(0, pCol - 1); cc <= Math.min(GRID_COLS - 1, pCol + 1); cc++) {
            this.emberCells.push({ r: rr, c: cc, timer: 180 });
          }
        }
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'ANTORCHA PIRA!', 'CRÁTER + BRASAS', def.accentColor);
        break;
      }
    }
    this.recomputeClustersAndSupport();
    this.checkIgnitions();
    this.checkImmediatePlayerFall();
    return true;
  }

  private triggerOperatorBanter(
    kind: 'start' | 'deep' | 'chain' | 'artifact' | 'lastBreath',
    force = false
  ): void {
    if (this.config.mode === 'DUEL' || this.pendingStory) return;
    if (!force && this.frameCount - this.lastBanterFrame < 540) return;
    const def = this.getChassisDef();
    const text = def.banter?.[kind];
    if (!text) return;
    this.lastBanterFrame = this.frameCount;
    const speakerMap: Partial<Record<ChassisId, StorySpeaker>> = {
      MKI_VERTICE: 'KAI',
      MKII_ESPECTRO: 'KAI',
      MKI_BRISA: 'VANCE',
      MKIV_METRONOMO: 'VANCE',
      MKIII_YUNQUE: 'SOLER',
      MKVII_PIRO: 'SOLER',
      MKV_TITAN: 'SOLER',
      MKVI_QUANTUM: 'ARQUITECTO',
    };
    this.activeTicker = {
      speaker: speakerMap[def.id] || 'KAI',
      name: `${def.name} · Radio`,
      text,
      color: def.accentColor,
      timer: 260,
    };
  }

  private collectOxygenCapsule(r: number, c: number): void {
    this.setCell(r, c, makeEmptyCell());
    this.recordMineralStats('OXYGEN', r);
    this.o2CapsulesCollected++;
    if (this.tutorialStep > 0) this.tutorialO2Collected++;
    const heal = 20 + (this.getChassisDef().o2CapsuleBonus ?? 0);
    this.oxygen = Math.min(this.maxOxygen, this.oxygen + heal);
    if (this.hasRelic('REL_CRYO_VALVE')) {
      this.oxygenFreezeTimer = Math.max(this.oxygenFreezeTimer, 120);
    }
    if (this.rng.next() < 0.25) this.addMaterial('cuarzo', 1);
    if (this.inLastBreath) {
      this.inLastBreath = false;
      this.lastBreathTimer = 0;
      this.oxygen = Math.max(this.oxygen, 15);
    }
    soundEngine.playOxygenPickup();
    soundEngine.pulseActivity(0.18);
    this.fx.spawnLight(c + 0.5, r + 0.5, 2.6, '#38BDF8', 14, 0.42);
    this.spawnParticles(c + 0.5, r + 0.5, '#38BDF8', 14);
    this.addFloatingText(c + 0.5, r, `+${heal}% O₂`, undefined, '#38BDF8');
    this.recomputeClustersAndSupport();
  }

  private getSwapReach(): number {
    let reach = this.getChassisDef().baseSwapReach;
    if (this.hasModule('QUA_REACH') || this.getSynergyTier('CUANTICO') >= 1) reach = 2;
    return reach;
  }

  public getSwapPair(pRow: number, pCol: number, dir: -1 | 1): { r1: number; c1: number; r2: number; c2: number } | null {
    const [dr, dc] = this.getAimOffset();
    let r1 = pRow + dr;
    let c1 = pCol + dc;

    const reach = this.getSwapReach();
    if (reach >= 2 && this.getCell(r1, c1).state === 'EMPTY') {
      const extR = r1 + dr;
      const extC = c1 + dc;
      if (extC >= 0 && extC < GRID_COLS && extR >= 0 && this.getCell(extR, extC).state !== 'EMPTY') {
        r1 = extR;
        c1 = extC;
      }
    }

    let r2 = r1;
    let c2 = c1;
    if (this.aimDir === 'DOWN' || this.aimDir === 'UP') {
      c2 = c1 + dir;
      if (reach >= 2 && c2 >= 0 && c2 < GRID_COLS) {
        const mid = this.getCell(r1, c2);
        if (mid.kind === 'RIVET' || mid.kind === 'MONOLITH') {
          c2 = c1 + dir * 2;
        }
      }
    } else {
      // Aiming left/right wall: dir -1 = up, dir +1 = down
      r2 = r1 + dir;
    }

    if (c1 < 0 || c1 >= GRID_COLS || c2 < 0 || c2 >= GRID_COLS || r1 < 0 || r2 < 0) return null;
    return { r1, c1, r2, c2 };
  }

  private tryPlayerSwap(pRow: number, pCol: number, dir: -1 | 1): boolean {
    const pair = this.getSwapPair(pRow, pCol, dir);
    if (!pair) return false;
    const { r1, c1, r2, c2 } = pair;
    const cell1 = this.getCell(r1, c1);
    const cell2 = this.getCell(r2, c2);

    if (cell1.state === 'EMPTY' && cell2.state === 'EMPTY') return false;
    if (cell1.state === 'IGNITING' || cell2.state === 'IGNITING' || cell1.state === 'DETONATING' || cell2.state === 'DETONATING') {
      return false;
    }
    if (!isSwappableKind(cell1.kind) || !isSwappableKind(cell2.kind)) {
      soundEngine.playThermalDud();
      return false;
    }

    this.performSwap(r1, c1, r2, c2);
    return true;
  }

  private performSwap(r1: number, c1: number, r2: number, c2: number): void {
    const cell1 = this.getCell(r1, c1);
    const cell2 = this.getCell(r2, c2);
    const stratum = this.getStratumForRow(r1);
    const col1 = cell1.color >= 0 ? stratum.blockColors[cell1.color] : '#38BDF8';
    const col2 = cell2.color >= 0 ? stratum.blockColors[cell2.color] : '#38BDF8';

    // Swap positions in grid
    const next1 = { ...cell2 };
    const next2 = { ...cell1 };

    if (next1.state !== 'EMPTY') {
      next1.swapFromCol = c2;
      next1.swapFromRow = r2;
      next1.swapProgress = 0;
      next1.state = 'SWAPPING';
    }
    if (next2.state !== 'EMPTY') {
      next2.swapFromCol = c1;
      next2.swapFromRow = r1;
      next2.swapProgress = 0;
      next2.state = 'SWAPPING';
    }

    this.setCell(r1, c1, next1);
    this.setCell(r2, c2, next2);

    this.setActionPose('SWAP_CAST', 8);
    this.fx.spawnSwapTrail(r1, c1, r2, c2, col1, col2);
    this.fx.spawnLight((c1 + c2 + 1) * 0.5, (r1 + r2 + 1) * 0.5, 2.2, '#38BDF8', 10, 0.34);
    this.swapCooldown = this.overdriveTimer > 0 || this.hasModuleMk2('QUA_REACH') ? 0 : 2;
    soundEngine.playSwap(c1);
    soundEngine.pulseActivity(0.14);
    this.addResonance(
      this.hasModule('QUA_RESONANCE') ? (this.hasModuleMk2('QUA_RESONANCE') ? 4.5 : 2.6) : 1.0
    );
    if (this.hasModule('QUA_RESONANCE')) {
      this.addOverdrive(this.hasModuleMk2('QUA_RESONANCE') ? 3 : 2);
    }
    this.addStyle('SWAP', 12);
    if (this.getSynergyTier('CUANTICO') >= 2 && this.frameCount % 8 === 0) {
      for (let qr = Math.max(this.minPrunedRow, r1 - 3); qr <= r1 + 3; qr++) {
        for (let qc = 0; qc < GRID_COLS; qc++) {
          const o = this.getCell(qr, qc);
          if (o.kind === 'OXYGEN' && o.state === 'SOLID') {
            this.collectOxygenCapsule(qr, qc);
            qr = r1 + 99;
            break;
          }
        }
      }
    }
    this.squashX = 1.12;
    this.squashY = 0.9;

    if (this.config.chassis === 'MKIV_METRONOMO') {
      if (soundEngine.isOnBeat()) {
        this.metronomeOnBeatFlash = 14;
        this.lastActionOnBeat = true;
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + 0.8);
        this.addStyle('BEAT', 18);
      } else {
        this.lastActionOnBeat = false;
      }
    }

    // Disarm armed/dormant Shock Mines when safely swapped!
    if (next1.kind === 'SHOCK_MINE' || next2.kind === 'SHOCK_MINE') {
      if (next1.kind === 'SHOCK_MINE') this.disarmShockMine(r1, c1);
      if (next2.kind === 'SHOCK_MINE') this.disarmShockMine(r2, c2);
    }

    // REL_ALCHEMIST_RING: every 20 swaps transmutes adjacent Slag into Geode
    if (this.hasRelic('REL_ALCHEMIST_RING')) {
      this.swapTransmuteCounter++;
      if (this.swapTransmuteCounter >= 20) {
        this.swapTransmuteCounter = 0;
        outer: for (let sr = r1 - 2; sr <= r1 + 2; sr++) {
          for (let sc = 0; sc < GRID_COLS; sc++) {
            const scell = this.getCell(sr, sc);
            if (scell.kind === 'SLAG') {
              scell.kind = 'GEODE';
              scell.hp = 1;
              this.addFloatingText(sc + 0.5, sr, 'TRANSMUTACIÓN ALQUÍMICA', 'ESCORIA → GEODA', '#FB7185');
              break outer;
            }
          }
        }
      }
    }

    // Secret Phase Key Check: swapped into rightmost column 8 in Stratum I
    if (
      (next1.kind === 'PHASE_KEY' && c1 === GRID_COLS - 1) ||
      (next2.kind === 'PHASE_KEY' && c2 === GRID_COLS - 1)
    ) {
      const keyR = next1.kind === 'PHASE_KEY' ? r1 : r2;
      this.setCell(keyR, GRID_COLS - 1, makeEmptyCell());
      this.hasAlphaFragment = true;
      this.discoveredCodex.add('SECRET_PHASE_KEY');
      this.addFloatingText(GRID_COLS - 1, keyR, 'FRAGMENTO ALFA OBTENIDO', 'SECRETO DESPERTADO', '#FFFFFF');
      soundEngine.playSeismicSeal();
    }

    // Eco de Permuta (QUA_ECHO): if two same-color blocks sandwich a different block
    if (this.hasModule('QUA_ECHO')) {
      this.checkEchoSwap(r1, c1);
      this.checkEchoSwap(r2, c2);
    }
  }

  private checkEchoSwap(r: number, c: number): void {
    const center = this.getCell(r, c);
    if (center.state === 'EMPTY' || center.color < 0) return;
    // Check c-2 and c having same color with different c-1
    if (c >= 2) {
      const left2 = this.getCell(r, c - 2);
      const mid = this.getCell(r, c - 1);
      if (left2.color === center.color && mid.state !== 'EMPTY' && mid.color !== center.color && mid.kind !== 'RIVET') {
        this.setCell(r, c - 1, makeEmptyCell());
        this.spawnParticles(c - 0.5, r + 0.5, '#C084FC', 10);
      }
    }
    if (c <= GRID_COLS - 3) {
      const right2 = this.getCell(r, c + 2);
      const mid = this.getCell(r, c + 1);
      if (right2.color === center.color && mid.state !== 'EMPTY' && mid.color !== center.color && mid.kind !== 'RIVET') {
        this.setCell(r, c + 1, makeEmptyCell());
        this.spawnParticles(c + 1.5, r + 0.5, '#C084FC', 10);
      }
    }
  }

  private executeKineticParry(dir: -1 | 1): boolean {
    if (!this.coyoteCrushCellPos) return false;
    const { r, c } = this.coyoteCrushCellPos;
    const aggressor = this.getCell(r, c);
    if (aggressor.state === 'EMPTY') return false;

    const targetCol = c + dir;
    if (targetCol < 0 || targetCol >= GRID_COLS) return false;
    const sideCell = this.getCell(r, targetCol);
    if (sideCell.kind === 'RIVET' || sideCell.kind === 'MONOLITH') return false;

    // Clean column swap!
    this.setCell(r, targetCol, { ...aggressor, state: 'SOLID', fallOffset: 0, fallDistance: 0 });
    this.setCell(r, c, { ...sideCell });

    this.coyoteCrushTimer = 0;
    this.coyoteCrushCellPos = null;
    this.parries++;
    this.discoveredCodex.add('MECH_PARRY');
    this.unlockLoreFragment('LORE_06_PARRY');

    // Hitstop + Pure White Flash + Sub-bass + Parry Slash!
    this.hitstopFrames = 4;
    this.whiteFlashFrames = 2;
    this.chromaFlashFrames = 2;
    this.pulseCamZoom(0.06);
    this.addCamTrauma(0.55);
    this.camKickX = dir * 3.5;
    this.setActionPose('PARRY_SLASH', 14);
    this.fx.spawnParrySlash(targetCol + 0.5, r + 0.5, dir);
    this.fx.spawnLight(targetCol + 0.5, r + 0.5, 3.2, '#38BDF8', 16, 0.48);
    this.fx.applyShockwaveToParticles(targetCol + 0.5, r + 0.5, 4.2, 3.8);
    this.triggerShake(6, 8);
    this.addOverdrive(35);
    this.addStyle('PARRY', 75);
    soundEngine.playParry();
    soundEngine.pulseActivity(0.38);

    // Parry damages Pendulum OR Crystal-lance Warden directly!
    if (this.activeGuardian && (this.activeGuardian.id === 'PENDULUM' || aggressor.kind === 'CRYSTAL')) {
      this.damageGuardian(1);
    }

    // Oxygen & Shield bonuses
    let o2Gain = this.hasOvercharge('OC_ANAEROBIC') ? 25 : 8;
    if (this.hasModuleMk2('BAL_COUNTER')) o2Gain += 15;
    this.oxygen = Math.min(this.maxOxygen, this.oxygen + o2Gain);
    this.invulnTimer = Math.max(this.invulnTimer, 18);
    this.swapCooldown = 0;

    if (this.hasRelic('REL_PARRY_LENS')) {
      this.addIsotopes(12);
    }

    if (this.hasModuleMk2('QUA_FLUX') && this.parries % 4 === 0) {
      this.kineticShields++;
    }

    // Contraataque Sísmico (BAL_COUNTER): push row laterally outward away from player!
    if (this.hasModule('BAL_COUNTER')) {
      for (let col = 1; col < c; col++) {
        const cell = this.getCell(r, col);
        if (cell.state !== 'EMPTY' && isSwappableKind(cell.kind) && this.getCell(r, col - 1).state === 'EMPTY') {
          this.setCell(r, col - 1, { ...cell, swapFromCol: col, swapFromRow: r, swapProgress: 0, state: 'SWAPPING' });
          this.setCell(r, col, makeEmptyCell());
        }
      }
      for (let col = GRID_COLS - 2; col > c; col--) {
        const cell = this.getCell(r, col);
        if (cell.state !== 'EMPTY' && isSwappableKind(cell.kind) && this.getCell(r, col + 1).state === 'EMPTY') {
          this.setCell(r, col + 1, { ...cell, swapFromCol: col, swapFromRow: r, swapProgress: 0, state: 'SWAPPING' });
          this.setCell(r, col, makeEmptyCell());
        }
      }
      this.fx.spawnBlastWave({
        x: c + 0.5,
        y: r + 0.5,
        radius: 0.4,
        maxRadius: 4.5,
        life: 12,
        maxLife: 12,
        color: '#4AC6E8',
        isHorizontalWave: true,
      });
      if (this.hasModuleMk2('BAL_COUNTER')) {
        for (let col = 0; col < GRID_COLS; col++) {
          const cell = this.getCell(r, col);
          if (cell.kind === 'SLAG') {
            this.breakSlag(r, col);
          }
        }
      }
    }

    // Push Stratum VI ceiling up!
    if (this.inStratum6) {
      this.stratum6CeilingRow -= 6;
    }

    // Damage Pendulum Guardian if active!
    if (this.activeGuardian?.id === 'PENDULUM') {
      this.damageGuardian(1);
    }

    // Duel counter garbage send!
    if (this.config.mode === 'DUEL' && aggressor.isGarbage && this.config.onGarbageSend) {
      this.config.onGarbageSend(2);
    }

    this.addFloatingText(targetCol + 0.5, r, 'CORTE CINÉTICO!', `+${o2Gain}% O₂`, '#FFFFFF');
    this.spawnParticles(targetCol + 0.5, r + 0.5, '#FFFFFF', 22);

    this.recomputeClustersAndSupport();
    // If moved block completes 4+, ignite directly at x2!
    this.checkIgnitions(2);
    return true;
  }

  private handlePlayerCrushed(): void {
    if (this.invulnTimer > 0) return;
    const armorShockwave = () => {
      if (this.getRigUpgrades().armorTier >= 3) {
        const cr = Math.max(0, this.gridRow);
        const cc = Math.max(0, Math.min(GRID_COLS - 1, this.gridCol));
        this.triggerBlastArea(cr, cc, 1, false);
        this.recomputeClustersAndSupport();
      }
    };
    if (this.anvilShieldAvailable) {
      this.anvilShieldAvailable = false;
      this.invulnTimer = 45;
      armorShockwave();
      this.addFloatingText(this.px + 0.5, this.py - 1, 'BLINDAJE YUNQUE', 'IMPACTO ABSORBIDO', '#F59E0B');
      soundEngine.playParry();
      return;
    }
    if (this.kineticShields > 0) {
      this.kineticShields--;
      this.invulnTimer = 45;
      armorShockwave();
      this.addFloatingText(this.px + 0.5, this.py - 1, 'ESCUDO CINÉTICO', 'IMPACTO ABSORBIDO', '#38BDF8');
      soundEngine.playParry();
      return;
    }
    this.triggerDeath('APLASTAMIENTO');
  }

  private updateCells(slamHeld: boolean): void {
    const startR = Math.max(this.minPrunedRow, Math.floor(this.py) - 18);
    const endR = Math.floor(this.py) + 22;

    // 1. Update SWAPPING transitions (4 frames) & decay hitFlash / landBounce / bounceAnim
    const pRowPre = Math.floor(this.py - 0.45);
    const pColPre = Math.round(this.px);
    let anySwapFinished = false;
    for (let r = startR; r <= endR; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = row[c];
        if (cell.hitFlash && cell.hitFlash > 0) cell.hitFlash--;
        if (cell.bounceAnim && cell.bounceAnim > 0) cell.bounceAnim--;
        if (cell.landBounce && cell.landBounce > 0) {
          cell.landBounce *= 0.78;
          if (cell.landBounce < 0.03) cell.landBounce = 0;
        }
        if (cell.state === 'SWAPPING') {
          cell.swapProgress += 1 / SWAP_DURATION_FRAMES;
          if (cell.swapProgress >= 1) {
            cell.swapProgress = 0;
            cell.state = cell.wobbleTimer > 0 ? 'WOBBLE' : 'SOLID';
            anySwapFinished = true;
          }
        }
        // SHOCK_MINE arming & detonation countdown when player approaches within Manhattan dist 2
        if (cell.kind === 'SHOCK_MINE' && cell.state === 'SOLID') {
          const dist = Math.abs(r - pRowPre) + Math.abs(c - pColPre);
          if (!cell.mineArmed && dist <= 2) {
            cell.mineArmed = true;
            cell.mineTimer = 72;
            soundEngine.playMineBeep();
          } else if (cell.mineArmed && cell.mineTimer !== undefined) {
            cell.mineTimer--;
            if (cell.mineTimer === 48 || cell.mineTimer === 24 || cell.mineTimer === 10) {
              soundEngine.playMineBeep();
            }
            if (cell.mineTimer <= 0) {
              this.setCell(r, c, makeEmptyCell());
              soundEngine.playMineZap();
              this.fx.spawnShockArc(Math.max(0.5, c - 1.5), r + 0.5, Math.min(GRID_COLS - 0.5, c + 2.5), r + 0.5, '#E11D48');
              const immuneToMine =
                this.invulnTimer > 0 ||
                this.overdriveTimer > 0 ||
                this.hasRelic('REL_ACID_PLATING') ||
                this.getRigUpgrades().armorTier >= 5;
              if (!immuneToMine && Math.abs(r - pRowPre) <= 1 && Math.abs(c - pColPre) <= 2) {
                if (this.kineticShields > 0) {
                  this.kineticShields--;
                  this.addFloatingText(this.px + 0.5, this.py - 1, 'ESCUDO VS MINA', undefined, '#38BDF8');
                } else {
                  this.oxygen = Math.max(0, this.oxygen - 12);
                  this.triggerShake(4.5, 8);
                  this.addFloatingText(this.px + 0.5, this.py - 1, 'DESCARGA -12% O₂', undefined, '#E11D48');
                }
              }
              anySwapFinished = true;
            }
          }
        }
        // GRAV_WELL physical vortex pull on debris/isotopes + O2 pods
        if (cell.kind === 'GRAV_WELL' && cell.state === 'SOLID') {
          if (this.frameCount % 2 === 0) {
            this.fx.applyGravityWellPull(c + 0.5, r + 0.5, 4.2);
          }
          if (this.frameCount % 12 === 0) {
            const pullR = this.hasModule('QUA_GRAV_INVERT') ? 3 : 1;
            for (let gc = Math.max(0, c - pullR); gc <= Math.min(GRID_COLS - 1, c + pullR); gc++) {
              if (gc === c) continue;
              const nb = this.getCell(r, gc);
              if (nb.kind === 'OXYGEN' && nb.state === 'SOLID') {
                const step = gc < c ? 1 : -1;
                if (this.getCell(r, gc + step).state === 'EMPTY') {
                  this.setCell(r, gc + step, nb);
                  this.setCell(r, gc, makeEmptyCell());
                }
              }
            }
          }
        }
      }
    }

    if (anySwapFinished) {
      this.recomputeClustersAndSupport();
      this.checkIgnitions();
    }

    // 2. Update CRYSTAL break timers (0.4s = 24 frames when weight rests on them)
    for (let r = startR; r <= endR; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = row[c];
        if (cell.kind === 'CRYSTAL' && cell.state === 'SOLID') {
          const above = this.getCell(r - 1, c);
          if (above.state !== 'EMPTY' && (above.state === 'SOLID' || above.state === 'WOBBLE' || above.state === 'FALLING')) {
            cell.crystalTriggered = true;
          }
          if (cell.crystalTriggered) {
            cell.crystalTimer++;
            if (cell.crystalTimer >= 24) {
              this.breakCrystal(r, c);
              this.recomputeClustersAndSupport();
            }
          }
        }
      }
    }

    // 3. Update WOBBLE timers -> FALLING (with DDA pace scaling & stone crumbs)
    const ddaSpeed = 1 + (this.dynamicDescentSpeedMult - 1) * 0.45;
    const wobbleStep =
      (slamHeld && this.hasModule('BAL_SEISMIC_SLAM') ? (this.hasModuleMk2('BAL_SEISMIC_SLAM') ? 2.2 : 1.55) : 1) *
      ddaSpeed;
    for (let r = endR; r >= startR; r--) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = row[c];
        if (cell.state === 'WOBBLE') {
          cell.wobbleTimer += wobbleStep;
          if (cell.wobbleTimer % 12 < 1) {
            soundEngine.playWobbleTick();
            this.fx.spawnCellularPixel(
              c + 0.2 + Math.random() * 0.6,
              r + 0.95,
              (Math.random() - 0.5) * 0.03,
              0.02 + Math.random() * 0.025,
              'SAND',
              '#A1A1AA',
              1.4,
              20
            );
          }
          if (cell.wobbleTimer >= cell.wobbleMax) {
            cell.state = 'FALLING';
            cell.fallOffset = 0;
            cell.fallDistance = 0;
            cell.fallSpeed = 4.5 * ddaSpeed; // accelerates realistically under gravity
          }
        }
      }
    }

    // 4. Update FALLING blocks with real gravitational acceleration (bottom-to-top cascade)
    const hyperMult = this.hasOvercharge('OC_HYPER_GRAV') ? 1.5 : 1;
    const maxFallSpd = (slamHeld ? FALL_SPEED_SLAM : FALL_SPEED_NORMAL) * hyperMult * (1 + (this.dynamicDescentSpeedMult - 1) * 0.48);
    const blockGravity = (slamHeld ? 160 : 62) * hyperMult * this.dynamicDescentSpeedMult;
    const pRow = Math.floor(this.py - 0.45);
    const pCol = Math.round(this.px);

    let anyLanded = false;
    for (let r = endR; r >= startR; r--) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = row[c];
        if (cell.state !== 'FALLING') continue;

        // Hold crushing cell compressed against player's top shield during Coyote Crush window
        if (
          this.coyoteCrushTimer > 0 &&
          this.coyoteCrushCellPos &&
          this.coyoteCrushCellPos.r === r &&
          this.coyoteCrushCellPos.c === c
        ) {
          cell.fallOffset = 0.65;
          continue;
        }

        // Check if Ember ignites falling block
        const emberIdx = this.emberCells.findIndex((e) => e.r === r && e.c === c);
        if (emberIdx >= 0 && cell.kind === 'SOLID') {
          this.emberCells.splice(emberIdx, 1);
          cell.state = 'IGNITING';
          cell.chainLevel = this.hasModuleMk2('PYRO_EMBER') ? 2 : 1;
          cell.fuseMax = IGNITE_FUSE_FRAMES[0];
          cell.fuseTimer = cell.fuseMax;
          continue;
        }

        // Player Coyote Crush collision check!
        if (c === pCol && r === pRow - 1 && cell.fallOffset > 0.35 && this.coyoteCrushTimer === 0 && this.invulnTimer === 0) {
          if (cell.kind !== 'OXYGEN') {
            if (
              this.overheadGuardTimer > 0 &&
              cell.kind !== 'RIVET' &&
              cell.kind !== 'MONOLITH' &&
              cell.kind !== 'BREACH_SEAL' &&
              cell.kind !== 'BIFURCATION_SEAL'
            ) {
              this.overheadGuardTimer = 0;
              const o2Cost = this.overdriveTimer > 0 ? 0 : this.hasModule('BAL_OVERHEAD_BREAKER') ? 3 : 6;
              if (o2Cost > 0) this.oxygen = Math.max(0, this.oxygen - o2Cost);
              this.shatterOverheadBlock(r, c, false);
              continue;
            }
            this.coyoteCrushTimer = this.getEffectiveParryFrames();
            this.coyoteCrushCellPos = { r, c };
            soundEngine.playParryTension();
          }
        }

        // Real gravity acceleration per falling block
        cell.fallSpeed = Math.min(maxFallSpd, (cell.fallSpeed ?? 5) + blockGravity * DT);
        const fallRate = cell.fallSpeed * DT;

        const below = this.getCell(r + 1, c);
        const blockedByGuardian = this.activeGuardian && r + 1 >= this.activeGuardian.arenaRow;

        if (below.state === 'EMPTY' && !blockedByGuardian) {
          cell.fallOffset += fallRate;
          while (cell.fallOffset >= 1) {
            const nextR = r + 1;
            const targetBelow = this.getCell(nextR, c);
            if (targetBelow.state === 'EMPTY' && !(this.activeGuardian && nextR >= this.activeGuardian.arenaRow)) {
              this.setCell(nextR, c, cell);
              this.setCell(r, c, makeEmptyCell());
              cell.fallOffset -= 1;
              cell.fallDistance += 1;

              // Check direct head impact after moving down
              if (c === pCol && nextR === pRow && cell.kind !== 'OXYGEN' && this.coyoteCrushTimer === 0 && this.invulnTimer === 0) {
                if (
                  this.overheadGuardTimer > 0 &&
                  cell.kind !== 'RIVET' &&
                  cell.kind !== 'MONOLITH' &&
                  cell.kind !== 'BREACH_SEAL' &&
                  cell.kind !== 'BIFURCATION_SEAL'
                ) {
                  this.overheadGuardTimer = 0;
                  const o2Cost = this.overdriveTimer > 0 ? 0 : this.hasModule('BAL_OVERHEAD_BREAKER') ? 3 : 6;
                  if (o2Cost > 0) this.oxygen = Math.max(0, this.oxygen - o2Cost);
                  this.shatterOverheadBlock(nextR, c, false);
                  break;
                }
                this.coyoteCrushTimer = this.getEffectiveParryFrames();
                this.coyoteCrushCellPos = { r: nextR, c };
                soundEngine.playParryTension();
              }
              break;
            } else {
              cell.fallOffset = 0;
              if (cell.fallDistance >= 1) {
                this.spawnParticles(c + 0.5, r + 1, '#A1A1AA', 4);
                if (cell.fallDistance >= 3) this.triggerShake(2.2, 4);
              }
              cell.fallSpeed = 0;
              this.onFallingBlockImpact(r, c, cell, nextR, c, targetBelow, slamHeld);
              anyLanded = true;
              break;
            }
          }
        } else {
          cell.fallOffset = 0;
          if (cell.fallDistance >= 1) {
            this.spawnParticles(c + 0.5, r + 1, '#A1A1AA', 4);
            if (cell.fallDistance >= 3) this.triggerShake(2.2, 4);
          }
          cell.fallSpeed = 0;
          this.onFallingBlockImpact(r, c, cell, r + 1, c, below, slamHeld);
          anyLanded = true;
        }
      }
    }

    if (anyLanded) {
      this.recomputeClustersAndSupport();
      this.checkIgnitions();
    }

    // 5. Update Telekinetic O2 Attraction (QUA_TELE)
    if (this.hasModule('QUA_TELE')) {
      const range = this.hasModuleMk2('QUA_TELE') ? 2 : 0;
      for (let dr = -range; dr <= range; dr++) {
        const rr = pRow + dr;
        for (let c = 0; c < GRID_COLS; c++) {
          const cell = this.getCell(rr, c);
          if (cell.kind === 'OXYGEN' && cell.state === 'SOLID' && c !== pCol) {
            const step = c < pCol ? 1 : -1;
            if (this.getCell(rr, c + step).state === 'EMPTY' && this.frameCount % 8 === 0) {
              this.setCell(rr, c + step, cell);
              this.setCell(rr, c, makeEmptyCell());
            }
          }
        }
      }
    }

    // 6. Update IGNITING fuses & DETONATING frames
    for (let r = startR; r <= endR; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = row[c];
        if (cell.state === 'IGNITING') {
          cell.fuseTimer--;
          if (cell.fuseTimer <= 0) {
            cell.state = 'DETONATING';
            cell.detonateTimer = DETONATING_FRAMES;
          }
        } else if (cell.state === 'DETONATING') {
          cell.detonateTimer--;
          if (cell.detonateTimer <= 0) {
            this.resolveCellDetonation(r, c, cell);
          }
        }
      }
    }

    // 7. Update Ember residual tiles (PYRO_EMBER)
    for (let i = this.emberCells.length - 1; i >= 0; i--) {
      this.emberCells[i].timer--;
      if (this.emberCells[i].timer <= 0) {
        this.emberCells.splice(i, 1);
      }
    }
  }

  private onFallingBlockImpact(
    r: number,
    c: number,
    falling: Cell,
    belowR: number,
    belowC: number,
    below: Cell,
    slamHeld: boolean
  ): void {
    // 1. O2 capsule crushed by falling block!
    if (below.kind === 'OXYGEN' && !this.hasModuleMk2('QUA_TELE')) {
      this.setCell(belowR, belowC, makeEmptyCell());
      this.spawnParticles(belowC + 0.5, belowR + 0.5, '#38BDF8', 10);
      this.addFloatingText(belowC + 0.5, belowR, 'O₂ DESTRUIDA', undefined, '#EF4444');
    }

    // 2. Martillo de Vacío (BAL_HAMMER): Slam + fell 3+ rows drills block underneath
    if (
      slamHeld &&
      this.hasModule('BAL_HAMMER') &&
      falling.fallDistance >= 3 &&
      below.kind !== 'RIVET' &&
      below.kind !== 'MONOLITH' &&
      below.state !== 'IGNITING'
    ) {
      this.setCell(belowR, belowC, makeEmptyCell());
      this.spawnParticles(belowC + 0.5, belowR + 0.5, '#4AC6E8', 8);
      if (this.hasModuleMk2('BAL_HAMMER')) {
        const below2 = this.getCell(belowR + 1, belowC);
        if (below2.state !== 'EMPTY' && below2.kind !== 'RIVET' && below2.kind !== 'MONOLITH') {
          this.setCell(belowR + 1, belowC, makeEmptyCell());
        }
      }
      falling.state = 'FALLING';
      falling.fallDistance = 0;
      return;
    }

    // 2b. Falling block landing on Válvula Geotérmica (BOUNCE_PAD) purges the valve cleanly in 1 vent!
    if (below.kind === 'BOUNCE_PAD' && falling.kind !== 'OXYGEN') {
      this.setCell(belowR, belowC, makeEmptyCell());
      soundEngine.playSteamHiss(belowC);
      this.fx.spawnCellularBurst(belowC + 0.5, belowR + 0.5, 'STEAM', '#BAE6FD', 10, 0.1);
      falling.state = 'FALLING';
      falling.fallOffset = 0;
      falling.fallDistance = 0;
      return;
    }

    // 2c. GRAVEL Avalanche diagonal slide when landing on solid block
    if (falling.kind === 'GRAVEL') {
      const firstDir = (r + c) % 2 === 0 ? 1 : -1;
      for (const dir of [firstDir, -firstDir] as const) {
        const sc = c + dir;
        if (
          sc >= 0 &&
          sc < GRID_COLS &&
          this.getCell(r, sc).state === 'EMPTY' &&
          this.getCell(r + 1, sc).state === 'EMPTY'
        ) {
          this.setCell(r + 1, sc, { ...falling, fallOffset: 0, fallDistance: falling.fallDistance + 1, state: 'FALLING' });
          this.setCell(r, c, makeEmptyCell());
          return;
        }
      }
    }

    // BAL_AVALANCHE: falling Gravel or Crystal 3+ rows releases seismic burst
    if (
      this.hasModule('BAL_AVALANCHE') &&
      (falling.kind === 'GRAVEL' || falling.kind === 'CRYSTAL') &&
      falling.fallDistance >= 3
    ) {
      this.fx.spawnBlastWave({ x: c + 0.5, y: r + 1, radius: 0.2, maxRadius: 2.2, life: 10, maxLife: 10, color: '#F59E0B' });
      if (this.hasModuleMk2('BAL_AVALANCHE')) {
        this.score += 150;
        if (below.state === 'SOLID' && below.kind !== 'RIVET' && below.kind !== 'MONOLITH') {
          this.drillAt(belowR, belowC, false, false);
        }
      }
    }

    // 2d. Active Acid Puddle reaction: falling block landing on acid dissolves!
    if (
      falling.kind !== 'OXYGEN' &&
      falling.kind !== 'RIVET' &&
      falling.kind !== 'MONOLITH' &&
      falling.kind !== 'BREACH_SEAL' &&
      falling.kind !== 'BIFURCATION_SEAL'
    ) {
      const puddleIdx = this.acidPuddles.findIndex((p) => p.r === belowR && p.c === belowC && p.timer > 0);
      if (puddleIdx >= 0) {
        const pKind = falling.kind || 'SOLID';
        this.setCell(r, c, makeEmptyCell());
        this.acidMelts++;
        soundEngine.playAcidMelt(c);
        this.fx.spawnCellularBurst(c + 0.5, r + 0.7, 'ACID', '#4ADE80', 14, 0.12);
        this.emitDestruction(r, c, '#4ADE80', 80, pKind);
        this.addStyle('ACID_TRAP', 55);
        return;
      }
    }

    // 3. Impact on IGNITING block -> Feed or Thermal Dud!
    if (below.state === 'IGNITING') {
      if (falling.kind === 'SOLID' && falling.color === below.color) {
        // Feed the flame!
        falling.state = 'IGNITING';
        falling.chainLevel = below.chainLevel + 1;
        this.applyFuseCurve(falling);
        this.setIgnitionGroupChain(belowR, belowC, falling.chainLevel);
        soundEngine.playIgnite(falling.chainLevel);
        return;
      } else {
        // THERMAL DUD (Ahogamiento Térmico)!
        this.triggerThermalDud(r, c, falling, belowR, belowC);
        return;
      }
    }

    if (falling.fallDistance >= 1) {
      falling.landBounce = Math.min(1, 0.35 + falling.fallDistance * 0.2);
      const stratum = this.getStratumForRow(r);
      const puffColor = falling.color >= 0 ? stratum.blockColors[falling.color] : '#A1A1AA';
      this.fx.spawnCellularPixel(c + 0.1, r + 0.96, -0.05, -0.02, 'SAND', puffColor, 1.5, 24);
      this.fx.spawnCellularPixel(c + 0.9, r + 0.96, 0.05, -0.02, 'SAND', puffColor, 1.5, 24);
      if (falling.fallDistance >= 2) {
        this.camKickY = Math.min(4, this.camKickY + 1.8);
      }
    }

    falling.state = 'SOLID';
    falling.fallDistance = 0;
    falling.wobbleTimer = 0;
  }

  private triggerThermalDud(r: number, c: number, falling: Cell, targetR: number, targetC: number): void {
    this.discoveredCodex.add('MECH_THERMAL_DUD');
    soundEngine.playThermalDud();

    // Check Secret Step 2: Fragmento Alfa + x3 Ignition + Conductor Thermal Dud -> Lanza de Singularidad!
    const targetCell = this.getCell(targetR, targetC);
    if (
      this.hasAlphaFragment &&
      !this.hasSingularityLance &&
      falling.kind === 'CONDUCTOR' &&
      targetCell.chainLevel >= 3
    ) {
      this.hasSingularityLance = true;
      this.addFloatingText(c + 0.5, r, 'LANZA DE SINGULARIDAD FORJADA', 'EL FONDO AGUARDA', '#FACC15');
      soundEngine.playSeismicSeal();
    }

    const volatile = this.hasModule('PAR_ALCHEMY');
    const convertToSlag = (cell: Cell) => {
      cell.state = 'SOLID';
      cell.kind = 'SLAG';
      cell.color = -1;
      cell.hp = this.getChassisDef().slagHits;
      cell.isVolatileSlag = volatile;
      cell.chainLevel = 0;
    };

    convertToSlag(falling);

    // Flood-fill all connected IGNITING cells and solidify into SLAG!
    const visited = new Set<string>();
    const queue: [number, number][] = [[targetR, targetC]];
    visited.add(`${targetR},${targetC}`);
    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      const cell = this.getCell(cr, cc);
      convertToSlag(cell);
      this.spawnParticles(cc + 0.5, cr + 0.5, volatile ? '#A3E635' : '#52525B', 5);

      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dr, dc] of dirs) {
        const nr = cr + dr;
        const nc = cc + dc;
        const key = `${nr},${nc}`;
        if (!visited.has(key) && nc >= 0 && nc < GRID_COLS && nr >= 0) {
          const n = this.getCell(nr, nc);
          if (n.state === 'IGNITING') {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }

    // Ascension VIII: Thermal Dud infects adjacent solid blocks too
    if (this.config.ascension >= 8) {
      const adj = this.getCell(targetR, targetC + 1);
      if (adj.state === 'SOLID' && adj.kind === 'SOLID') convertToSlag(adj);
    }

    this.addFloatingText(
      c + 0.5,
      r,
      volatile ? 'ALQUIMIA DE ESCORIA' : 'AHOGAMIENTO TÉRMICO',
      undefined,
      volatile ? '#A3E635' : '#9CA3AF'
    );
  }

  private setIgnitionGroupChain(startR: number, startC: number, newChain: number): void {
    const visited = new Set<string>();
    const queue: [number, number][] = [[startR, startC]];
    visited.add(`${startR},${startC}`);
    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      const cell = this.getCell(cr, cc);
      cell.chainLevel = Math.max(cell.chainLevel, newChain);
      this.applyFuseCurve(cell);
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nr = cr + dr;
        const nc = cc + dc;
        const key = `${nr},${nc}`;
        if (!visited.has(key) && nc >= 0 && nc < GRID_COLS && nr >= 0) {
          const n = this.getCell(nr, nc);
          if (n.state === 'IGNITING') {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }
  }

  private applyFuseCurve(cell: Cell): void {
    const idx = Math.min(Math.max(0, cell.chainLevel - 1), IGNITE_FUSE_FRAMES.length - 1);
    let frames = IGNITE_FUSE_FRAMES[idx] + (this.getChassisDef().fuseBonusFrames ?? 0);
    if (this.hasModuleMk2('PYRO_DIAG')) frames += 15;
    if (this.config.chassis === 'MKIV_METRONOMO' && this.lastActionOnBeat) {
      frames += 7;
    }
    if (this.hasOvercharge('OC_RUNAWAY')) frames = Math.floor(frames * 0.5);
    cell.fuseMax = frames;
    cell.fuseTimer = frames;
  }

  private forceDetonateAll(): boolean {
    const startR = Math.max(this.minPrunedRow, Math.floor(this.py) - 18);
    const endR = Math.floor(this.py) + 22;
    let triggered = false;
    for (let r = startR; r <= endR; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        if (row[c].state === 'IGNITING') {
          row[c].state = 'DETONATING';
          row[c].detonateTimer = 2;
          triggered = true;
        }
      }
    }
    if (triggered) {
      soundEngine.playSwap();
    }
    return triggered;
  }

  private resolveCellDetonation(r: number, c: number, cell: Cell): void {
    let chain = Math.max(1, cell.chainLevel);
    if (this.hasOvercharge('OC_RUNAWAY')) chain += 1;
    if (chain > this.maxChain) this.maxChain = chain;

    const stratum = this.getStratumForRow(r);
    const colHex = cell.color >= 0 ? stratum.blockColors[cell.color] : '#F97316';
    const baseColor = cell.color;

    // Collect full connected DETONATING / IGNITING group to resolve cleanly together
    const group: [number, number][] = [];
    const visited = new Set<string>();
    const queue: [number, number][] = [[r, c]];
    visited.add(`${r},${c}`);
    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      group.push([cr, cc]);
      const cur = this.getCell(cr, cc);
      if (cur.chainLevel > chain) chain = cur.chainLevel + (this.hasOvercharge('OC_RUNAWAY') ? 1 : 0);
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nr = cr + dr;
        const nc = cc + dc;
        const key = `${nr},${nc}`;
        if (!visited.has(key) && nc >= 0 && nc < GRID_COLS && nr >= 0) {
          const n = this.getCell(nr, nc);
          if (n.state === 'DETONATING' || n.state === 'IGNITING') {
            visited.add(key);
            queue.push([nr, nc]);
          }
        }
      }
    }

    // Clear group cells & emit combo destruction events
    for (const [gr, gc] of group) {
      const grpKind = this.getCell(gr, gc).kind || 'SOLID';
      this.setCell(gr, gc, makeEmptyCell());
      this.spawnParticles(gc + 0.5, gr + 0.5, colHex, 9);
      this.emitDestruction(gr, gc, colHex, 35 * chain, grpKind);
      if (this.hasModule('PYRO_EMBER') && (chain >= 2 || this.hasModuleMk2('PYRO_EMBER'))) {
        this.emberCells.push({ r: gr, c: gc, timer: this.hasModuleMk2('PYRO_EMBER') ? 210 : 150 });
      }
    }

    // Blast Rewards & Blast Wave Scale (Section 3.4)
    const isMass = group.length >= 6;
    let o2Reward = 2;
    let blastRadius = 0;
    let destroyRivets = false;

    if (chain >= 4) {
      o2Reward = 30;
      blastRadius = 2;
      destroyRivets = true;
      this.kineticShields = Math.min(2, this.kineticShields + 1);
      // Vertical 3x4 Drill Beam!
      for (let br = r + 1; br <= r + 4; br++) {
        for (let bc = Math.max(0, c - 1); bc <= Math.min(GRID_COLS - 1, c + 1); bc++) {
          this.blastCell(br, bc, true, baseColor);
        }
      }
      this.blastWaves.push({
        x: c + 0.5,
        y: r + 0.5,
        radius: 0.5,
        maxRadius: 4.5,
        life: 16,
        maxLife: 16,
        color: '#FFFFFF',
        isVerticalBeam: true,
      });
    } else if (chain === 3) {
      o2Reward = 18;
      blastRadius = 1; // 3x3
    } else if (chain === 2) {
      o2Reward = 10;
      blastRadius = 1; // cross
      this.oxygenFreezeTimer = Math.max(this.oxygenFreezeTimer, 90);
    } else if (isMass) {
      o2Reward = 6;
      blastRadius = 1; // cross
    }

    if (this.hasModule('PYRO_NOVA')) {
      blastRadius += this.hasModuleMk2('PYRO_NOVA') ? 2 : 1;
    }
    if (this.hasModule('PYRO_CATALYST') && chain >= 2) {
      o2Reward += this.hasModuleMk2('PYRO_CATALYST') ? 12 : 6;
      if (this.hasModuleMk2('PYRO_CATALYST')) this.oxygenFreezeTimer = Math.max(this.oxygenFreezeTimer, 150);
    }

    // Trigger any MAGMA_NODE / GAS_POCKET / PYRO_THERMITE effects adjacent to the exploding group
    const thermite = this.hasModule('PYRO_THERMITE');
    for (const [gr, gc] of group) {
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nr = gr + dr;
        const nc = gc + dc;
        if (nc >= 0 && nc < GRID_COLS && nr >= 0) {
          const adj = this.getCell(nr, nc);
          if (adj.kind === 'MAGMA_NODE') this.triggerMagmaNode(nr, nc);
          else if (adj.kind === 'GAS_POCKET') this.triggerGasPocket(nr, nc);
          else if (thermite && adj.kind === 'SLAG') {
            this.breakSlag(nr, nc);
            if (this.hasModuleMk2('PYRO_THERMITE')) this.addOverdrive(5);
          }
        }
      }
    }

    // Apply blast wave around every cell in group
    if (blastRadius > 0) {
      for (const [gr, gc] of group) {
        if (chain >= 3 || this.hasModule('PYRO_NOVA')) {
          this.triggerBlastArea(gr, gc, blastRadius, destroyRivets, baseColor);
        } else {
          // Cross (orthogonal 1)
          for (const [dr, dc] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            this.blastCell(gr + dr, gc + dc, false, baseColor);
          }
        }
      }
    }

    // Overcharge: Inverse Gravity (lifts blocks above 3 rows!)
    if (this.hasOvercharge('OC_INVERSE_GRAV') && chain >= 3) {
      for (let lr = r - 6; lr <= r - 1; lr++) {
        for (let lc = Math.max(0, c - 2); lc <= Math.min(GRID_COLS - 1, c + 2); lc++) {
          const lCell = this.getCell(lr, lc);
          const dest = this.getCell(lr - 2, lc);
          if (lCell.state === 'SOLID' && lCell.kind !== 'RIVET' && dest.state === 'EMPTY') {
            this.setCell(lr - 2, lc, { ...lCell, state: 'FALLING' });
            this.setCell(lr, lc, makeEmptyCell());
          }
        }
      }
    }

    // Oxygen + Last Breath revival + Player 0.25s explosion immunity
    this.oxygen = Math.min(this.maxOxygen, this.oxygen + o2Reward);
    if (this.inLastBreath && chain >= 2) {
      this.inLastBreath = false;
      this.lastBreathTimer = 0;
      this.oxygen = Math.max(this.oxygen, 15);
      this.addFloatingText(this.px + 0.5, this.py - 1, 'ÚLTIMO ALIENTO SALVADO!', undefined, '#38BDF8');
    }

    const distToPlayer = Math.hypot(c - this.px, r - this.py);
    if (distToPlayer <= 3.5) {
      this.invulnTimer = Math.max(this.invulnTimer, 15); // 0.25s debris immunity
    }

    // Isotopes, Overdrive & Guardian Damage
    if (chain === 2) this.addIsotopes(4, true);
    else if (chain >= 3) this.addIsotopes(chain * 5, true);
    this.addOverdrive(chain * 3.5);
    if (this.activeGuardian) {
      if (this.activeGuardian.id === 'WARDEN') {
        let hit = false;
        for (const anchor of this.activeGuardian.loomAnchors) {
          if (anchor.hp > 0 && Math.abs(anchor.row - r) <= 3 && Math.abs(anchor.col - c) <= 3) {
            anchor.hp = 0;
            this.damageGuardian(1);
            hit = true;
          }
        }
        if (!hit && chain >= 2) this.damageGuardian(1);
      } else if (this.activeGuardian.id === 'LOOM' && chain >= 2) {
        for (const anchor of this.activeGuardian.loomAnchors) {
          if (anchor.hp > 0 && Math.abs(anchor.row - r) <= 3 && Math.abs(anchor.col - c) <= 3) {
            anchor.hp = 0;
            this.damageGuardian(1);
          }
        }
      } else if (this.activeGuardian.id === 'FORGE' && chain >= 2) {
        this.damageGuardian(1);
      } else if (this.activeGuardian.id === 'PENDULUM' && chain >= 3) {
        this.damageGuardian(1);
      } else if (this.activeGuardian.id === 'ARCHITECT' && chain >= 2) {
        this.damageGuardian(1);
      } else if (this.activeGuardian.id === 'CHRONOLITH') {
        let anchorHit = false;
        for (const anchor of this.activeGuardian.loomAnchors) {
          if (anchor.hp > 0 && Math.abs(anchor.row - r) <= 3 && Math.abs(anchor.col - c) <= 3) {
            anchor.hp = 0;
            this.damageGuardian(1);
            anchorHit = true;
          }
        }
        if (!anchorHit && chain >= 3) this.damageGuardian(1);
      }
    }

    // Stratum VI Living Ceiling Pushback
    if (this.inStratum6 && chain >= 3) {
      this.stratum6CeilingRow -= chain * 2.2;
    }

    // Duel Garbage Attack!
    if (this.config.mode === 'DUEL' && chain >= 2 && this.config.onGarbageSend) {
      this.config.onGarbageSend(chain - 1);
    }

    // Juice: Hitstop + Shake + Camera Zoom/Chroma + Lights + Cables + Spatial Sound
    soundEngine.playDetonate(chain, c);
    soundEngine.pulseActivity(0.32 + Math.min(0.4, chain * 0.05));
    this.addResonance(Math.min(12, 3.6 * chain));
    if (chain >= 3) {
      this.triggerOperatorBanter('chain');
    }
    this.addStyle(chain >= 2 ? 'CHAIN_BLAST' : 'DETONATE', 25 * chain);
    this.checkFeverProgress('CHAIN', chain);
    this.fx.spawnLight(c + 0.5, r + 0.5, 2.5 + chain * 0.8, colHex, 16, 0.45);
    this.fx.applyShockwaveToParticles(c + 0.5, r + 0.5, 3.4 + chain * 0.5, 2.5 + chain * 0.6);

    if (this.hasModule('PYRO_SOLAR_LANCE') && chain >= 3) {
      const span = this.hasModuleMk2('PYRO_SOLAR_LANCE') ? 4 : 2;
      this.fx.spawnBlastWave({
        x: c + 0.5,
        y: r + 0.5,
        radius: 0.5,
        maxRadius: span,
        life: 14,
        maxLife: 14,
        color: '#FB923C',
        isVerticalBeam: true,
      });
      for (let sr = r + 1; sr <= r + span; sr++) {
        const sc = this.getCell(sr, c);
        if (sc.state !== 'EMPTY' && sc.kind !== 'RIVET' && sc.kind !== 'MONOLITH' && sc.kind !== 'BREACH_SEAL' && sc.kind !== 'BIFURCATION_SEAL') {
          if (sc.kind === 'SLAG' && this.hasModuleMk2('PYRO_SOLAR_LANCE')) this.breakSlag(sr, c);
          else if (sc.kind === 'ARTIFACT_POD') this.collectArtifactPod(sr, c);
          else if (sc.kind !== 'SLAG') {
            this.setCell(sr, c, makeEmptyCell());
            this.emitDestruction(sr, c, '#FB923C', 45, sc.kind || 'SOLID');
          }
        }
      }
    }

    const pyroTier = this.getSynergyTier('PIROLITICO');
    if (pyroTier >= 1) {
      // Pirolítico Synergy: detonations crack adjacent Slag & trigger nearby Gas Pockets
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const adj = this.getCell(r + dr, c + dc);
        if (adj.kind === 'GAS_POCKET') this.triggerGasPocket(r + dr, c + dc);
        else if (adj.kind === 'SLAG') {
          adj.hp -= pyroTier;
          adj.hitFlash = 5;
          if (adj.hp <= 0) this.breakSlag(r + dr, c + dc);
        }
      }
      if (pyroTier >= 2 && chain >= 2) {
        this.triggerBlastArea(r, c, 1, false, -1);
      }
    }
    const paraTier = this.getSynergyTier('PARASITO');
    if (paraTier >= 1 && chain >= 3) {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 4);
    }
    if (paraTier >= 2 && chain >= 4) {
      const emptyIdx = this.belt.findIndex((b) => b === null);
      if (emptyIdx >= 0) {
        this.belt[emptyIdx] = 'GAD_O2_CELL';
        this.addFloatingText(this.px + 0.5, this.py - 1.3, 'PARÁSITO 4+: +ARTILUGIO O₂!', undefined, '#A3E635');
      }
    }

    if (chain >= 2) {
      this.hitstopFrames = Math.min(4, chain);
      this.triggerShake(chain >= 3 ? 6 : 3.5, 9);
      this.addCamTrauma(Math.min(0.65, chain * 0.16));
      if (chain >= 3) {
        this.chromaFlashFrames = Math.max(this.chromaFlashFrames, 2);
        this.pulseCamZoom(chain >= 4 ? 0.065 : 0.04);
      }
    }
    this.blastWaves.push({
      x: c + 0.5,
      y: r + 0.5,
      radius: 0.4,
      maxRadius: 1.8 + chain * 0.85,
      life: 14,
      maxLife: 14,
      color: colHex,
    });
    this.fx.spawnCellularBurst(c + 0.5, r + 0.5, 'EMBER', colHex, 8 + chain * 4, 0.14);

    const label = chain >= 4 ? `×${chain} SUPERCRÍTICO!` : chain >= 2 ? `×${chain}` : isMass ? 'MASA' : '';
    if (label) {
      this.addFloatingText(c + 0.5, r + 0.2, label, `+${o2Reward}% O₂`, colHex);
    }

    this.recomputeClustersAndSupport();
  }

  private triggerBlastArea(centerR: number, centerC: number, radius: number, destroyRivets: boolean, colorIdx = -1): void {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        this.blastCell(centerR + dr, centerC + dc, destroyRivets, colorIdx);
      }
    }
  }

  private blastCell(r: number, c: number, destroyRivets: boolean, blastColor = -1): void {
    if (c < 0 || c >= GRID_COLS || r < 0) return;
    const cell = this.getCell(r, c);
    if (cell.state === 'EMPTY') return;
    if (cell.kind === 'BREACH_SEAL' || cell.kind === 'BIFURCATION_SEAL' || cell.kind === 'OXYGEN') return;

    if (cell.kind === 'MONOLITH') {
      if (blastColor >= 0 && cell.monolithColor === blastColor) {
        this.setCell(r, c, makeEmptyCell());
        this.isotopes += 45;
        this.anomalyCores += 1;
        this.addFloatingText(c + 0.5, r, 'MONOLITO FRACTURADO!', '+1 NÚCLEO', '#FACC15');
        soundEngine.playSeismicSeal();
      }
      return;
    }

    if (cell.kind === 'GHOST_ECHO') {
      const recoveredId = cell.echoModuleId;
      this.setCell(r, c, makeEmptyCell());
      if (recoveredId && this.modules.length < 6) {
        this.modules.push({ id: recoveredId, mk2: false });
        const def = MODULES.find((m) => m.id === recoveredId);
        this.addFloatingText(c + 0.5, r, 'ECO RECUPERADO', def?.name || recoveredId, '#E5E7EB');
      }
      return;
    }

    if (cell.kind === 'RIVET' && !destroyRivets) return;
    if (cell.kind === 'SLAG') {
      this.breakSlag(r, c);
      return;
    }
    if (cell.kind === 'CRYSTAL') {
      this.breakCrystal(r, c);
      return;
    }
    if (cell.kind === 'GEODE') {
      this.breakGeode(r, c);
      return;
    }
    if (cell.kind === 'CRYO_VENT') {
      this.breakCryoVent(r, c);
      return;
    }
    if (cell.kind === 'MAGMA_NODE') {
      this.triggerMagmaNode(r, c);
      return;
    }
    if (cell.kind === 'GAS_POCKET') {
      this.triggerGasPocket(r, c);
      return;
    }
    if (cell.kind === 'ACID_VAT') {
      this.triggerAcidMelt(r, c);
      return;
    }
    if (cell.kind === 'GRAV_WELL') {
      this.breakGravWell(r, c);
      return;
    }
    if (cell.kind === 'SHOCK_MINE') {
      this.disarmShockMine(r, c);
      return;
    }
    if (cell.kind === 'TREASURE_CACHE') {
      this.openTreasureCache(r, c);
      return;
    }
    if (cell.kind === 'ARTIFACT_POD') {
      this.collectArtifactPod(r, c);
      return;
    }
    if (cell.kind === 'RESONANCE_VEIN') {
      this.triggerResonanceVein(r, c);
      return;
    }
    if (cell.kind === 'SUPPORT_BEAM') {
      this.breakSupportBeam(r, c);
      return;
    }
    if (cell.state !== 'IGNITING' && cell.state !== 'DETONATING') {
      const blastKind = cell.kind || 'SOLID';
      this.setCell(r, c, makeEmptyCell());
      this.emitDestruction(r, c, '#F97316', 30, blastKind);
      this.spawnParticles(c + 0.5, r + 0.5, '#F97316', 5);
    }
  }

  private recomputeClustersAndSupport(): void {
    const startR = Math.max(this.minPrunedRow, Math.floor(this.py) - 22);
    const endR = Math.min(this.maxGeneratedRow, Math.floor(this.py) + 25);

    // Assign cluster IDs to orthogonally connected same-color SOLID/WOBBLE blocks
    let nextCluster = 1;
    const clusterCells = new Map<number, [number, number][]>();

    for (let r = startR; r <= endR; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        row[c].clusterId = 0;
        row[c].nearMatch = false;
      }
    }

    for (let r = startR; r <= endR; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = row[c];
        if (
          cell.state === 'EMPTY' ||
          cell.state === 'FALLING' ||
          cell.state === 'SWAPPING' ||
          cell.state === 'DETONATING' ||
          cell.clusterId !== 0
        ) {
          continue;
        }

        const cid = nextCluster++;
        const list: [number, number][] = [];
        const isStickyColor = (cell.kind === 'SOLID' || cell.kind === 'PHASE') && cell.state !== 'IGNITING';

        if (!isStickyColor) {
          cell.clusterId = cid;
          list.push([r, c]);
          clusterCells.set(cid, list);
          continue;
        }

        // BFS same-color sticky cluster
        const queue: [number, number][] = [[r, c]];
        cell.clusterId = cid;
        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!;
          list.push([cr, cc]);
          for (const [dr, dc] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr < startR || nr > endR || nc < 0 || nc >= GRID_COLS) continue;
            const n = this.getCell(nr, nc);
            if (
              n.clusterId === 0 &&
              (n.state === 'SOLID' || n.state === 'WOBBLE') &&
              (n.kind === 'SOLID' || n.kind === 'PHASE') &&
              n.color === cell.color
            ) {
              n.clusterId = cid;
              queue.push([nr, nc]);
            }
          }
        }
        clusterCells.set(cid, list);
      }
    }

    // Bottom-up iterative support check
    const supportedClusters = new Set<number>();
    const isCellSupported = (r: number, c: number): boolean => {
      const cell = this.getCell(r, c);
      if (cell.state === 'EMPTY' || cell.state === 'FALLING') return false;
      if (
        cell.kind === 'RIVET' ||
        cell.kind === 'SUPPORT_BEAM' ||
        cell.kind === 'MONOLITH' ||
        cell.kind === 'BREACH_SEAL' ||
        cell.kind === 'BIFURCATION_SEAL' ||
        cell.state === 'IGNITING' ||
        cell.state === 'SWAPPING'
      ) {
        return true;
      }
      if (r >= endR) return true; // rests on generated bedrock
      return supportedClusters.has(cell.clusterId);
    };

    // Sequential bottom-up fixed-point convergence across full active shaft
    let changed = true;
    let safetyPasses = 0;
    while (changed && safetyPasses < 24) {
      changed = false;
      safetyPasses++;
      for (let r = endR; r >= startR; r--) {
        for (let c = 0; c < GRID_COLS; c++) {
          const cell = this.getCell(r, c);
          if (cell.clusterId === 0 || supportedClusters.has(cell.clusterId)) continue;
          if (
            cell.kind === 'RIVET' ||
            cell.kind === 'SUPPORT_BEAM' ||
            cell.kind === 'MONOLITH' ||
            cell.kind === 'BREACH_SEAL' ||
            cell.kind === 'BIFURCATION_SEAL' ||
            cell.state === 'IGNITING' ||
            cell.state === 'SWAPPING' ||
            r >= endR
          ) {
            supportedClusters.add(cell.clusterId);
            changed = true;
            continue;
          }
          if (isCellSupported(r + 1, c)) {
            supportedClusters.add(cell.clusterId);
            changed = true;
          }
        }
      }
    }

    // Apply WOBBLE vs SOLID transitions cleanly & flag 3-cluster harmonic tension
    for (const [cid, cells] of clusterCells.entries()) {
      const hasSupport = supportedClusters.has(cid);
      const isNearMatch =
        cells.length === 3 &&
        cells.every(([rr, cc]) => {
          const k = this.getCell(rr, cc).kind;
          return k === 'SOLID' || k === 'PHASE';
        });
      for (const [r, c] of cells) {
        const cell = this.getCell(r, c);
        cell.nearMatch = isNearMatch;
        if (cell.state === 'IGNITING' || cell.state === 'DETONATING' || cell.state === 'SWAPPING' || cell.state === 'FALLING') {
          continue;
        }
        if (hasSupport) {
          if (cell.state === 'WOBBLE') {
            cell.state = 'SOLID';
            cell.wobbleTimer = 0;
          }
        } else {
          if (cell.state === 'SOLID') {
            if (cell.kind === 'GRAVEL') {
              cell.state = 'FALLING';
              cell.fallOffset = 0;
              cell.fallDistance = 0;
              cell.fallSpeed = 6.5;
            } else {
              cell.state = 'WOBBLE';
              cell.wobbleMax = this.getCurrentWobbleFrames(r);
              cell.wobbleTimer = 0;
            }
          }
        }
      }
    }
  }

  public applySequentialTerrainGravity(): void {
    this.recomputeClustersAndSupport();
    const startR = Math.max(this.minPrunedRow, Math.floor(this.py) - 20);
    const endR = Math.min(this.maxGeneratedRow - 1, Math.floor(this.py) + 24);

    // Sequential bottom-to-top cascade for non-sticky blocks directly above empty/falling space
    // (sticky same-color SOLID/PHASE clusters retain horizontal cantilever support per GDD)
    for (let r = endR; r >= startR; r--) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = this.getCell(r, c);
        if (cell.state !== 'SOLID') continue;
        const isSticky = cell.kind === 'SOLID' || cell.kind === 'PHASE';
        if (isSticky) continue;
        if (cell.kind === 'RIVET' || cell.kind === 'SUPPORT_BEAM' || cell.kind === 'MONOLITH' || cell.kind === 'BREACH_SEAL' || cell.kind === 'BIFURCATION_SEAL') continue;
        const below = this.getCell(r + 1, c);
        if (below.state === 'EMPTY' || below.state === 'FALLING') {
          if (cell.kind === 'GRAVEL') {
            cell.state = 'FALLING';
            cell.fallOffset = 0;
            cell.fallDistance = 0;
            cell.fallSpeed = 6.5;
          } else {
            cell.state = 'WOBBLE';
            cell.wobbleMax = this.getCurrentWobbleFrames(r);
            cell.wobbleTimer = 0;
          }
        }
      }
    }
  }

  private checkIgnitions(forcedBaseChain = 1): void {
    const startR = Math.max(this.minPrunedRow, Math.floor(this.py) - 18);
    const endR = Math.min(this.maxGeneratedRow, Math.floor(this.py) + 20);
    const useDiagonal = this.hasModule('PYRO_DIAG');

    const dirs = useDiagonal
      ? [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]
      : [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];

    const visited = new Set<string>();
    for (let r = startR; r <= endR; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        const start = this.getCell(r, c);
        if (
          (start.state !== 'SOLID' && start.state !== 'IGNITING' && start.state !== 'WOBBLE') ||
          (start.kind !== 'SOLID' && start.kind !== 'PHASE') ||
          start.color < 0
        ) {
          continue;
        }

        const color = start.color;
        const group: [number, number][] = [];
        const conductors: [number, number][] = [];
        const queue: [number, number][] = [[r, c]];
        visited.add(key);

        let hasExistingIgniting = false;
        let maxExistingChain = 0;

        while (queue.length > 0) {
          const [cr, cc] = queue.shift()!;
          const cur = this.getCell(cr, cc);
          if (cur.kind === 'CONDUCTOR') {
            conductors.push([cr, cc]);
          } else {
            group.push([cr, cc]);
            if (cur.state === 'IGNITING') {
              hasExistingIgniting = true;
              maxExistingChain = Math.max(maxExistingChain, cur.chainLevel);
            }
          }

          for (const [dr, dc] of dirs) {
            const nr = cr + dr;
            const nc = cc + dc;
            const nKey = `${nr},${nc}`;
            if (nr < startR || nr > endR || nc < 0 || nc >= GRID_COLS || visited.has(nKey)) continue;
            const n = this.getCell(nr, nc);
            if (n.state !== 'SOLID' && n.state !== 'IGNITING' && n.state !== 'WOBBLE') continue;

            // Conductor bridges ignitions!
            if (n.kind === 'CONDUCTOR') {
              visited.add(nKey);
              queue.push([nr, nc]);
            } else if ((n.kind === 'SOLID' || n.kind === 'PHASE') && n.color === color) {
              visited.add(nKey);
              queue.push([nr, nc]);
            }
          }
        }

        const massThreshold =
          this.hasModule('PYRO_MASS') && (color === 0 || (this.hasModuleMk2('PYRO_MASS') && color === 1)) ? 3 : 4;

        if (group.length >= massThreshold) {
          const anyUnignited = group.some(([gr, gc]) => this.getCell(gr, gc).state !== 'IGNITING');
          if (anyUnignited) {
            const newChain = hasExistingIgniting ? maxExistingChain + 1 : forcedBaseChain;
            for (const [gr, gc] of group) {
              const cell = this.getCell(gr, gc);
              cell.state = 'IGNITING';
              cell.chainLevel = newChain;
              this.applyFuseCurve(cell);
            }
            for (const [cr, cc] of conductors) {
              const cCell = this.getCell(cr, cc);
              cCell.state = 'IGNITING';
              cCell.color = color;
              cCell.chainLevel = newChain;
              this.applyFuseCurve(cCell);
            }
            soundEngine.playIgnite(newChain);
            this.addOverdrive(8 * newChain);
            if (this.tutorialStep > 0) this.tutorialIgnitions++;
          }
        }
      }
    }
  }

  private updateOxygen(): void {
    // Pause O2 drain during Tutorial, Breach Chamber, Bifurcation, Stratum VI, or Anaerobics with active ignition
    if (this.tutorialStep > 0) return;
    if (this.inStratum6) return;
    if (this.activeBreach && !this.activeBreach.resolved && Math.abs(this.py - this.activeBreach.yRow) <= 6) return;
    if (this.activeBifurcation && !this.activeBifurcation.resolved && Math.abs(this.py - this.activeBifurcation.yRow) <= 6) return;

    if (this.oxygenFreezeTimer > 0) return;
    if (this.overdriveTimer > 0) return;

    if (this.hasOvercharge('OC_ANAEROBIC')) {
      if (this.hasAnyActiveIgnition()) return;
    }

    const stratum = this.getStratumForRow(this.depthMeters);
    let drainPerSec = stratum.oxygenDrain * Math.max(0.7, 1 - this.getRigUpgrades().tankTier * 0.05);
    if (this.hasRelic('REL_CRYO_VALVE')) drainPerSec *= 0.85;
    if (this.hasOvercharge('OC_GOLD_FEVER')) drainPerSec *= 1.25;
    if (this.activeMutators.includes('LOW_O2_DRAIN')) drainPerSec *= 0.72;
    if (this.config.ascension >= 4) drainPerSec *= 1.15;

    // Stratum III Conductor adjacency doubles drain!
    const pRow = Math.floor(this.py - 0.01);
    const pCol = Math.round(this.px);
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (this.getCell(pRow + dr, pCol + dc).kind === 'CONDUCTOR') {
        drainPerSec *= 1.85;
        break;
      }
    }

    this.oxygen = Math.max(0, this.oxygen - drainPerSec * DT);
    soundEngine.setLowOxygen(this.oxygen < 25);

    if (this.oxygen <= 0) {
      if (!this.inLastBreath) {
        this.inLastBreath = true;
        this.lastBreathTimer = LAST_BREATH_FRAMES;
        this.addFloatingText(this.px + 0.5, this.py - 1.5, 'ÚLTIMO ALIENTO!', 'PROVOCA x2+ O TOMA O₂', '#EF4444');
        this.triggerOperatorBanter('lastBreath', true);
      } else {
        this.lastBreathTimer--;
        if (this.lastBreathTimer <= 0) {
          this.triggerDeath('ASFIXIA');
        }
      }
    } else {
      this.inLastBreath = false;
      this.lastBreathTimer = 0;
    }
  }

  private hasAnyActiveIgnition(): boolean {
    const startR = Math.max(this.minPrunedRow, Math.floor(this.py) - 14);
    const endR = Math.floor(this.py) + 16;
    for (let r = startR; r <= endR; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        if (row[c].state === 'IGNITING') return true;
      }
    }
    return false;
  }

  private stepFeverAndPuddles(): void {
    // Decay acid puddles
    for (let i = this.acidPuddles.length - 1; i >= 0; i--) {
      this.acidPuddles[i].timer--;
      if (this.acidPuddles[i].timer <= 0) {
        this.acidPuddles.splice(i, 1);
      }
    }

    // Active Fever Micro-Event countdown & completion check
    if (this.activeFever) {
      this.activeFever.timer--;
      if (this.activeFever.type === 'GOLD_RUSH') {
        this.activeFever.progress = this.activeFever.maxTimer - this.activeFever.timer;
      }
      if (this.activeFever.progress >= this.activeFever.target && this.activeFever.type !== 'GOLD_RUSH') {
        // Complete Fever Challenge Jackpot!
        const rewIso = 65;
        this.addIsotopes(rewIso);
        this.addMaterial(this.depthMeters >= 1500 ? 'titanio' : 'cuarzo', 2);
        this.kineticShields++;
        this.addOverdrive(35);
        this.addStyle('FEVER_CLEAR', 120);
        soundEngine.playTreasureOpen();
        this.fx.spawnLight(this.px + 0.5, this.py - 0.5, 4.0, '#FACC15', 22, 0.55);
        this.fx.addFloatingText(
          this.px + 0.5,
          this.py - 1.6,
          `¡FIEBRE SUPERADA! +${rewIso} ISO`,
          '+2 MATERIALES · +1 ESCUDO',
          '#FACC15',
          1.25
        );
        this.activeFever = null;
      } else if (this.activeFever.timer <= 0) {
        if (this.activeFever.type === 'GOLD_RUSH') {
          this.fx.addFloatingText(this.px + 0.5, this.py - 1.3, 'VETA AGOTADA', undefined, '#FBBF24');
        }
        this.activeFever = null;
      }
    }
  }

  private checkFeverProgress(kind: 'CHAIN' | 'DRILL', amount: number): void {
    if (!this.activeFever) return;
    if (this.activeFever.type === 'FLASH_CHAIN' && kind === 'CHAIN' && amount >= 2) {
      this.activeFever.progress++;
    } else if (this.activeFever.type === 'FLASH_DRILL' && kind === 'DRILL') {
      this.activeFever.progress += amount;
    } else if (this.activeFever.type === 'OVERPRESSURE' && kind === 'CHAIN' && amount >= 3) {
      this.activeFever.progress++;
    }
  }

  private maybeStartFeverEvent(curRow: number): void {
    if (
      this.activeFever ||
      this.activeGuardian ||
      this.tutorialStep > 0 ||
      this.config.mode === 'DUEL' ||
      curRow < this.nextFeverDepth
    ) {
      return;
    }
    this.nextFeverDepth = curRow + 185 + this.rng.int(0, 45);
    // Avoid overlapping Breach / Boss zone
    if (Math.abs(curRow - this.nextBreachRow) <= 18) return;

    const types: FeverEventType[] = ['GOLD_RUSH', 'FLASH_CHAIN', 'FLASH_DRILL', 'OVERPRESSURE'];
    const picked = types[(Math.floor(curRow / 180) + this.rng.int(0, 3)) % types.length];
    if (picked === 'GOLD_RUSH') {
      this.activeFever = {
        type: 'GOLD_RUSH',
        title: 'VETA MADRE DÓRADA',
        subtitle: '×1.5 Puntos e Isótopos durante 14s',
        color: '#FACC15',
        timer: 840,
        maxTimer: 840,
        progress: 0,
        target: 840,
      };
    } else if (picked === 'FLASH_CHAIN') {
      this.activeFever = {
        type: 'FLASH_CHAIN',
        title: 'RETO: DOBLE CADENA',
        subtitle: 'Detona 2 cadenas ×2+ antes que acabe',
        color: '#38BDF8',
        timer: 960,
        maxTimer: 960,
        progress: 0,
        target: 2,
      };
    } else if (picked === 'FLASH_DRILL') {
      this.activeFever = {
        type: 'FLASH_DRILL',
        title: 'FRENESÍ EXCAVADOR',
        subtitle: 'Destruye 20 bloques en 14s',
        color: '#FB923C',
        timer: 840,
        maxTimer: 840,
        progress: 0,
        target: 20,
      };
    } else {
      this.activeFever = {
        type: 'OVERPRESSURE',
        title: 'SOBREPRESIÓN CRÍTICA',
        subtitle: 'Ejecuta 1 cadena ×3+ por botín épico',
        color: '#F43F5E',
        timer: 900,
        maxTimer: 900,
        progress: 0,
        target: 1,
      };
    }
    soundEngine.playFeverStart();
    this.pulseCamZoom(0.035);
    this.fx.addFloatingText(
      4.5,
      Math.max(2, curRow - 1.5),
      `⚡ ${this.activeFever.title}`,
      this.activeFever.subtitle,
      this.activeFever.color,
      1.2
    );
  }

  private updateDepthEvents(): void {
    const curRow = Math.floor(this.py);
    this.depthMeters = Math.max(this.depthMeters, curRow);
    if (curRow > this.maxDepthReached) {
      this.maxDepthReached = curRow;
    }
    if (this.personalBestRow > 0 && !this.personalBestBroken && this.depthMeters >= this.personalBestRow) {
      this.personalBestBroken = true;
      const bonus = this.addIsotopes(15);
      this.addStyle('NEW_RECORD', 100);
      soundEngine.playBiomeTransition(this.currentStratumId);
      this.addFloatingText(
        this.px + 0.5,
        this.py - 1.4,
        '¡RÉCORD PERSONAL SUPERADO!',
        `${this.depthMeters}M · +${bonus} ISO`,
        '#FACC15',
        1.25
      );
    }
    this.maybeStartFeverEvent(curRow);

    // Steady Isotope depth extraction every 25m
    if (this.maxDepthReached >= this.lastIsotopeDepthMilestone + 25) {
      this.lastIsotopeDepthMilestone += 25;
      const gained = this.addIsotopes(3);
      this.addFloatingText(this.px + 0.5, this.py - 1.2, `+${gained} ISO`, undefined, '#FBBF24');
    }

    // Track Stratum Codex discovery & Biome Transition milestones (every 500m or biome shift)
    const stratum = this.getStratumForRow(curRow);
    const milestoneStep = Math.floor(curRow / 500) * 500;
    if (stratum.id !== this.currentStratumId || (milestoneStep >= 500 && milestoneStep > this.lastBiomeMilestoneRow)) {
      this.currentStratumId = stratum.id;
      if (milestoneStep >= 500) this.lastBiomeMilestoneRow = milestoneStep;
      this.discoveredCodex.add(`STRATUM_${stratum.id}`);
      if (curRow >= 500 || stratum.id >= 2) this.unlockLoreFragment('LORE_05_CRISTAL');
      if (curRow >= 1000 || stratum.id >= 3) this.unlockLoreFragment('LORE_07_CONDUCTOR');
      if (curRow >= 1500 || stratum.id >= 4) this.unlockLoreFragment('LORE_08_PRESION');
      if (curRow >= 2000 || stratum.id >= 5) this.unlockLoreFragment('LORE_09_FASE');
      if (curRow >= 2500 || stratum.id >= 6) this.unlockLoreFragment('LORE_10_ALABASTRO');
      this.lastBiomeTransition = {
        id: ++this.biomeTransitionSeq,
        milestoneDepth: milestoneStep > 0 ? milestoneStep : curRow,
        stratumId: stratum.id,
        name: stratum.name,
        subtitle: stratum.subtitle,
        primaryColor: stratum.blockColors[0] || '#38BDF8',
        secondaryColor: stratum.blockColors[1] || '#FACC15',
        bgColor: stratum.bg,
      };
      soundEngine.playBiomeTransition(stratum.id);
      this.triggerOperatorBanter('deep');
      this.triggerShake(4.2, 10);
      this.addFloatingText(
        4.5,
        Math.max(2, curRow - 1.5),
        `BIOMA ${stratum.name.toUpperCase()}`,
        `${stratum.subtitle.toUpperCase()} · ${milestoneStep || curRow}m`,
        stratum.blockColors[0] || '#FACC15'
      );
    }

    // Campaign Depth Storytelling beats
    if (this.config.mode === 'CAMPAIGN' && !this.pendingStory) {
      for (const tx of STORY_TRANSMISSIONS) {
        if (tx.triggerDepth !== undefined && this.depthMeters >= tx.triggerDepth && !this.triggeredStoryIds.has(tx.id)) {
          this.presentStoryTransmission(tx);
          break;
        }
      }
    }

    // SPRINT 500m Victory!
    if (this.config.mode === 'SPRINT_500' && this.depthMeters >= 500) {
      this.triggerVictory(false);
      return;
    }

    // TRIAL non-boss-rush depth Victory!
    if (this.config.mode === 'TRIAL' && this.config.trialId && this.config.trialId !== 'BOSS_RUSH') {
      const tDef = TRIAL_DEFS.find((t) => t.id === this.config.trialId);
      if (tDef && this.depthMeters >= tDef.goalDepth) {
        this.triggerVictory(false);
        return;
      }
    }

    // Stratum VII Horizons Peak Victory (3,510m fallback after Chronolith)
    if (this.inStratum6 && this.depthMeters >= 3510 && this.defeatedGuardians.has(3500)) {
      this.triggerVictory(true);
      return;
    }

    // 1. Seismic Seal every 100m
    if (curRow >= this.nextSeismicSealRow) {
      this.triggerSeismicSeal(this.nextSeismicSealRow);
      this.nextSeismicSealRow += 100;
    }

    // 2. Breach Chamber activation when approaching odd 250m
    if (
      (this.config.mode === 'CAMPAIGN' || this.config.mode === 'ENDLESS') &&
      !this.activeBreach &&
      curRow >= this.nextBreachRow - 6 &&
      curRow <= this.nextBreachRow
    ) {
      this.rollBreachOptions(this.nextBreachRow);
    }

    // 3. Bifurcation activation at 515m / 1515m
    if (
      this.config.mode === 'CAMPAIGN' &&
      !this.activeBifurcation &&
      (this.nextBifurcationRow === 515 || this.nextBifurcationRow === 1515) &&
      curRow >= this.nextBifurcationRow - 6 &&
      curRow <= this.nextBifurcationRow
    ) {
      this.createBifurcationOffer(this.nextBifurcationRow);
    }

    // 4. Guardian Triggers (Campaign 500..3500m, or Boss Rush Trial 120..600m)
    if (!this.activeGuardian) {
      const bossRows =
        this.config.mode === 'TRIAL' && this.config.trialId === 'BOSS_RUSH'
          ? [120, 240, 360, 480, 600]
          : this.config.mode === 'CAMPAIGN'
            ? [500, 1000, 1500, 2000, 2500, 3500]
            : [];
      for (const gRow of bossRows) {
        if (!this.defeatedGuardians.has(gRow) && curRow >= gRow - 10 && curRow < gRow) {
          this.startGuardianEncounter(gRow);
          break;
        }
      }
    }
  }

  private triggerSeismicSeal(sealRow: number): void {
    soundEngine.playSeismicSeal();
    this.oxygen = Math.min(this.maxOxygen, this.oxygen + 20);
    this.isotopes += 25;
    this.anvilShieldAvailable = this.hasRelic('REL_GRAV_ANCHOR');

    // Vaporize accumulated slag above player!
    for (let r = Math.max(this.minPrunedRow, sealRow - 16); r <= sealRow; r++) {
      const row = this.grid.get(r);
      if (!row) continue;
      for (let c = 0; c < GRID_COLS; c++) {
        if (row[c].kind === 'SLAG') {
          this.setCell(r, c, makeEmptyCell());
          this.spawnParticles(c + 0.5, r + 0.5, '#F59E0B', 4);
        }
      }
    }
    this.addFloatingText(4.5, sealRow - 2, `SELLO SÍSMICO ${sealRow}m`, '+20% O₂ · ESCORIA PURGADA', '#FBBF24');
  }

  private rollBreachOptions(breachRow: number): void {
    const pool = this.getAvailableModulePool();
    const ownedIds = new Set(this.modules.map((m) => m.id));
    const fullSlots = this.modules.length >= 6;

    const options: { moduleId: string; isUpgrade: boolean; isOvercharge?: boolean }[] = [];
    const candidates = fullSlots
      ? pool.filter((m) => ownedIds.has(m.id) && !this.hasModuleMk2(m.id))
      : pool.filter((m) => !ownedIds.has(m.id));

    const source = candidates.length >= 3 ? candidates : pool;
    const shuffled = [...source].sort(() => this.rng.next() - 0.5);

    for (let i = 0; i < 3; i++) {
      if (i === 2 && this.rng.next() < 0.25 && this.overcharges.length < 2) {
        const ocAvail = OVERCHARGES.filter((o) => !this.overcharges.includes(o.id));
        if (ocAvail.length > 0) {
          options.push({ moduleId: this.rng.pick(ocAvail).id, isUpgrade: false, isOvercharge: true });
          continue;
        }
      }
      const picked = shuffled[i % shuffled.length];
      options.push({
        moduleId: picked.id,
        isUpgrade: ownedIds.has(picked.id),
      });
    }

    this.activeBreach = {
      options,
      resolved: false,
      yRow: breachRow,
    };
  }

  private resolveBreachChoice(optionIdx: number): void {
    if (!this.activeBreach || this.activeBreach.resolved) return;
    const chosen = this.activeBreach.options[optionIdx];
    if (!chosen) return;

    if (chosen.isOvercharge) {
      this.overcharges.push(chosen.moduleId);
      const oc = OVERCHARGES.find((o) => o.id === chosen.moduleId);
      this.addFloatingText(4.5, this.activeBreach.yRow - 1, `SOBRECARGA: ${oc?.name}`, oc?.benefit, '#E11D48');
    } else {
      const existing = this.modules.find((m) => m.id === chosen.moduleId);
      if (existing) {
        existing.mk2 = true;
      } else if (this.modules.length < 6) {
        this.modules.push({ id: chosen.moduleId, mk2: false });
      } else {
        this.modules[0] = { id: chosen.moduleId, mk2: false };
      }
      const def = MODULES.find((m) => m.id === chosen.moduleId);
      this.addFloatingText(
        4.5,
        this.activeBreach.yRow - 1,
        existing ? `${def?.name} MK-II` : `${def?.name}`,
        def?.shortDesc,
        '#38BDF8'
      );
    }

    // Open chosen 3-column gate, lock the other two
    const sealRow = this.activeBreach.yRow;
    for (let c = 0; c < GRID_COLS; c++) {
      if (Math.floor(c / 3) === optionIdx) {
        this.setCell(sealRow, c, makeEmptyCell());
      } else {
        const lock = makeEmptyCell();
        lock.state = 'SOLID';
        lock.kind = 'RIVET';
        lock.hp = 99;
        this.setCell(sealRow, c, lock);
      }
    }

    this.activeBreach.resolved = true;
    this.activeBreach = null;
    this.nextBreachRow += 500;
    soundEngine.playSeismicSeal();
    for (const syn of this.getArchetypeSynergies()) {
      const key = `${syn.archetype}_${syn.tier}`;
      if (syn.tier >= 1 && !this.notifiedSynergies.has(key)) {
        this.notifiedSynergies.add(key);
        soundEngine.playSynergyActivate();
        this.addStyle('SYNERGY', 60 * syn.tier);
        this.fx.addFloatingText(4.5, sealRow - 2.2, `★ ${syn.label.toUpperCase()}`, syn.desc, '#A3E635', 1.15);
      }
    }
    this.recomputeClustersAndSupport();
  }

  private createBifurcationOffer(row: number): void {
    const isFirst = row < 1000;
    this.activeBifurcation = {
      yRow: row,
      resolved: false,
      leftTitle: isFirst ? 'Falla Cristalina' : 'Veta Piroclástica',
      leftDesc: isFirst ? '+Cristales · ×2 Isótopos' : '+Escoria densa · +15% O₂',
      leftMutator: isFirst ? 'CRYSTAL_FAULT' : 'HEAVY_SLAG',
      rightTitle: isFirst ? 'Conducto Presurizado' : 'Cámara Estable',
      rightDesc: isFirst ? '-28% Drenaje O₂ · Wobble rápido' : 'Física estándar · +1 Reroll',
      rightMutator: isFirst ? 'LOW_O2_DRAIN' : 'FAST_WOBBLE',
    };
  }

  private resolveBifurcationChoice(side: 'LEFT' | 'RIGHT'): void {
    if (!this.activeBifurcation || this.activeBifurcation.resolved) return;
    const mut = side === 'LEFT' ? this.activeBifurcation.leftMutator : this.activeBifurcation.rightMutator;
    const title = side === 'LEFT' ? this.activeBifurcation.leftTitle : this.activeBifurcation.rightTitle;
    this.activeMutators = [mut];
    if (mut === 'HEAVY_SLAG') {
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 15);
      this.addFloatingText(4.5, this.activeBifurcation.yRow - 2, '+15% O₂ · VETA PIROCLÁSTICA', undefined, '#FACC15');
    }
    if (side === 'RIGHT' && this.activeBifurcation.yRow >= 1000) {
      this.rerollsRemaining++;
    }

    const r = this.activeBifurcation.yRow;
    for (let c = 0; c < GRID_COLS; c++) {
      if ((side === 'LEFT' && c < 4) || (side === 'RIGHT' && c > 4)) {
        this.setCell(r, c, makeEmptyCell());
      } else {
        const lock = makeEmptyCell();
        lock.state = 'SOLID';
        lock.kind = 'RIVET';
        lock.hp = 99;
        this.setCell(r, c, lock);
      }
    }

    this.activeBifurcation.resolved = true;
    this.activeBifurcation = null;
    this.nextBifurcationRow = r < 1000 ? 1515 : 99999;
    this.addFloatingText(4.5, r - 1, `RUTA: ${title}`, undefined, '#FBBF24');
    soundEngine.playSeismicSeal();
    this.recomputeClustersAndSupport();
  }

  private startGuardianEncounter(arenaRow: number): void {
    this.oxygen = Math.min(this.maxOxygen, this.oxygen + 35);
    const isBossRush = this.config.mode === 'TRIAL' && this.config.trialId === 'BOSS_RUSH';
    const role = isBossRush
      ? arenaRow === 120
        ? 'WARDEN'
        : arenaRow === 240
          ? 'LOOM'
          : arenaRow === 360
            ? 'FORGE'
            : arenaRow === 480
              ? 'PENDULUM'
              : 'ARCHITECT'
      : arenaRow === 500
        ? 'WARDEN'
        : arenaRow === 1000
          ? 'LOOM'
          : arenaRow === 1500
            ? 'FORGE'
            : arenaRow === 2000
              ? 'PENDULUM'
              : arenaRow === 2500
                ? 'ARCHITECT'
                : 'CHRONOLITH';

    if (role === 'WARDEN') {
      this.discoveredCodex.add('GUARDIAN_WARDEN');
      this.activeGuardian = {
        id: 'WARDEN',
        name: 'CENTINELA DE CUARZO',
        hp: 3,
        maxHp: 3,
        arenaRow,
        timerFrames: 0,
        actionCooldown: 200,
        pendulumCol: 4,
        pendulumDir: 1,
        loomAnchors: [
          { row: arenaRow - 3, col: 1, hp: 1 },
          { row: arenaRow - 5, col: 7, hp: 1 },
          { row: arenaRow - 2, col: 4, hp: 1 },
        ],
        laserWarningRow: null,
        laserWarningTimer: 0,
        ceilingRow: arenaRow - 12,
        hitFlashTimer: 0,
        phase: 1,
        attackCols: [],
        attackWarnTimer: 0,
      };
      this.addFloatingText(4.5, arenaRow - 5, 'GUARDIÁN: CENTINELA DE CUARZO', 'ROMPE SUS 3 NÚCLEOS O DETONA ×2+', '#38BDF8');
      this.tryTriggerStoryByEvent('WARDEN_INTRO');
    } else if (role === 'LOOM') {
      this.discoveredCodex.add('GUARDIAN_LOOM');
      this.activeGuardian = {
        id: 'LOOM',
        name: 'EL TELAR',
        hp: 3,
        maxHp: 3,
        arenaRow,
        timerFrames: 0,
        actionCooldown: 240,
        pendulumCol: 4,
        pendulumDir: 1,
        loomAnchors: [
          { row: arenaRow - 4, col: 0, hp: 1 },
          { row: arenaRow - 6, col: 8, hp: 1 },
          { row: arenaRow - 2, col: 4, hp: 1 },
        ],
        laserWarningRow: null,
        laserWarningTimer: 0,
        ceilingRow: arenaRow - 12,
        hitFlashTimer: 0,
        phase: 1,
        attackCols: [],
        attackWarnTimer: 0,
      };
      this.addFloatingText(4.5, arenaRow - 5, 'GUARDIÁN: EL TELAR', 'DETONA ×2+ JUNTO A LOS 3 ANCLAJES', '#F59E0B');
      this.tryTriggerStoryByEvent('LOOM_INTRO');
    } else if (role === 'FORGE') {
      this.discoveredCodex.add('GUARDIAN_FORGE');
      this.activeGuardian = {
        id: 'FORGE',
        name: 'LA FRAGUA GEMELA',
        hp: 4,
        maxHp: 4,
        arenaRow,
        timerFrames: 0,
        actionCooldown: 220,
        pendulumCol: 4,
        pendulumDir: 1,
        loomAnchors: [],
        laserWarningRow: null,
        laserWarningTimer: 0,
        ceilingRow: arenaRow - 12,
        hitFlashTimer: 0,
        phase: 1,
        attackCols: [],
        attackWarnTimer: 0,
      };
      this.addFloatingText(4.5, arenaRow - 5, 'GUARDIÁN: LA FRAGUA GEMELA', 'DETONA CADENAS ×2+ ENTRE LOS PISTONES', '#F97316');
      this.tryTriggerStoryByEvent('FORGE_INTRO');
    } else if (role === 'PENDULUM') {
      this.discoveredCodex.add('GUARDIAN_PENDULUM');
      this.activeGuardian = {
        id: 'PENDULUM',
        name: 'EL PÉNDULO',
        hp: 4,
        maxHp: 4,
        arenaRow,
        timerFrames: 0,
        actionCooldown: 180,
        pendulumCol: 4,
        pendulumDir: 1,
        loomAnchors: [],
        laserWarningRow: null,
        laserWarningTimer: 0,
        ceilingRow: arenaRow - 12,
        hitFlashTimer: 0,
        phase: 1,
        attackCols: [],
        attackWarnTimer: 0,
      };
      this.addFloatingText(4.5, arenaRow - 5, 'GUARDIÁN: EL PÉNDULO', 'DAÑA CON CORTES CINÉTICOS O ×3+', '#E11D48');
      this.tryTriggerStoryByEvent('PENDULUM_INTRO');
    } else if (role === 'ARCHITECT') {
      this.discoveredCodex.add('GUARDIAN_SEAL');
      this.activeGuardian = {
        id: 'ARCHITECT',
        name: 'EL SELLO DEL ARQUITECTO',
        hp: 5,
        maxHp: 5,
        arenaRow,
        timerFrames: 0,
        actionCooldown: 200,
        pendulumCol: 4,
        pendulumDir: 1,
        loomAnchors: [],
        laserWarningRow: null,
        laserWarningTimer: 0,
        ceilingRow: arenaRow - 12,
        hitFlashTimer: 0,
        phase: 1,
        attackCols: [],
        attackWarnTimer: 0,
      };
      this.addFloatingText(4.5, arenaRow - 5, 'EL SELLO DEL ARQUITECTO', 'DETONA ×2+ BAJO EL TECHO DESCENDENTE', '#FFFFFF');
      this.tryTriggerStoryByEvent('ARCHITECT_INTRO');
    } else {
      this.discoveredCodex.add('GUARDIAN_CHRONOLITH');
      this.activeGuardian = {
        id: 'CHRONOLITH',
        name: 'EL CRONOLITO',
        hp: 6,
        maxHp: 6,
        arenaRow,
        timerFrames: 0,
        actionCooldown: 180,
        pendulumCol: 4,
        pendulumDir: 1,
        loomAnchors: [
          { row: arenaRow - 3, col: 1, hp: 1 },
          { row: arenaRow - 3, col: 7, hp: 1 },
          { row: arenaRow - 6, col: 4, hp: 1 },
        ],
        laserWarningRow: null,
        laserWarningTimer: 0,
        ceilingRow: arenaRow - 12,
        hitFlashTimer: 0,
        phase: 1,
        attackCols: [],
        attackWarnTimer: 0,
      };
      this.addFloatingText(4.5, arenaRow - 5, 'JEFE FINAL: EL CRONOLITO', 'DETONA LOS 6 PILARES DE RESONANCIA', '#F472B6');
      this.tryTriggerStoryByEvent('CHRONOLITH_INTRO');
    }
    soundEngine.playSeismicSeal();
  }

  private updateGuardian(): void {
    const g = this.activeGuardian;
    if (!g) return;
    g.timerFrames++;
    g.actionCooldown--;
    if (g.hitFlashTimer > 0) g.hitFlashTimer--;

    const stratum = this.getStratumForRow(g.arenaRow);
    const isP2 = g.phase === 2;

    // Resolve shared telegraphed column barrage attacks
    if (g.attackWarnTimer > 0) {
      g.attackWarnTimer--;
      if (g.attackWarnTimer <= 0 && g.attackCols.length > 0) {
        const dropR = Math.max(this.minPrunedRow + 1, g.arenaRow - 8);
        soundEngine.playBossAttack();
        this.addCamTrauma(0.32);
        this.fx.applyImpulseToCables(4.5, dropR + 2, 5.0, 2.5);
        for (const ac of g.attackCols) {
          if (ac < 0 || ac >= GRID_COLS) continue;
          const proj = makeEmptyCell();
          proj.state = 'FALLING';
          proj.hp = 1;
          if (g.id === 'WARDEN') {
            proj.kind = 'CRYSTAL';
            proj.color = 0;
          } else if (g.id === 'CHRONOLITH') {
            proj.kind = 'GRAV_WELL';
            proj.color = -1;
          } else if (g.id === 'FORGE') {
            proj.kind = 'MAGMA_NODE';
            proj.color = -1;
          } else {
            proj.kind = 'SOLID';
            proj.color = this.rng.int(0, Math.max(1, stratum.colorCount) - 1);
          }
          if (this.getCell(dropR, ac).state === 'EMPTY') {
            this.setCell(dropR, ac, proj);
          }
        }
        g.attackCols = [];
      }
    }

    // Periodically drop helpful colored blocks + O2 from ceiling to keep the fight flowing!
    if (g.timerFrames % 125 === 0) {
      const dropR = Math.max(this.minPrunedRow + 1, g.arenaRow - 9);
      for (let i = 0; i < 3; i++) {
        const c = this.rng.int(0, GRID_COLS - 1);
        if (this.getCell(dropR, c).state === 'EMPTY') {
          const b = makeEmptyCell();
          b.state = 'FALLING';
          b.kind = i === 0 && this.oxygen < 45 ? 'OXYGEN' : 'SOLID';
          b.color = b.kind === 'OXYGEN' ? -1 : this.rng.int(0, stratum.colorCount - 1);
          b.hp = 1;
          this.setCell(dropR, c, b);
        }
      }
    }

    if (g.id === 'WARDEN') {
      if (g.timerFrames % (isP2 ? 42 : 60) === 0) {
        g.pendulumCol += g.pendulumDir;
        if (g.pendulumCol >= GRID_COLS - 2) g.pendulumDir = -1;
        if (g.pendulumCol <= 1) g.pendulumDir = 1;
      }
      if (g.actionCooldown <= 0) {
        g.actionCooldown = isP2 ? 220 : 300;
        const count = isP2 ? 3 : 2;
        g.attackCols = Array.from({ length: count }, (_, idx) => (g.pendulumCol + idx * 3) % GRID_COLS);
        g.attackWarnTimer = isP2 ? 55 : 70;
      }
    } else if (g.id === 'LOOM') {
      if (g.laserWarningRow !== null) {
        g.laserWarningTimer--;
        if (g.laserWarningTimer <= 0) {
          const weldColor = this.rng.int(0, stratum.colorCount - 1);
          for (let c = 0; c < GRID_COLS; c++) {
            const cell = this.getCell(g.laserWarningRow, c);
            if (cell.state !== 'EMPTY' && cell.kind === 'SOLID') {
              cell.color = weldColor;
            }
          }
          g.laserWarningRow = null;
          this.recomputeClustersAndSupport();
          this.checkIgnitions();
        }
      } else if (g.actionCooldown <= 0) {
        g.actionCooldown = isP2 ? 240 : 340;
        g.laserWarningRow = g.arenaRow - this.rng.int(2, 5);
        g.laserWarningTimer = isP2 ? 55 : 75;
      }
    } else if (g.id === 'FORGE') {
      if (g.laserWarningRow !== null) {
        g.laserWarningTimer--;
        if (g.laserWarningTimer <= 0) {
          const drops = isP2 ? 2 : 1;
          for (let i = 0; i < drops; i++) {
            const cNode = this.rng.int(1, GRID_COLS - 2);
            const mn = makeEmptyCell();
            mn.state = 'FALLING';
            mn.kind = 'MAGMA_NODE';
            mn.hp = 1;
            this.setCell(Math.max(this.minPrunedRow + 1, g.arenaRow - 8), cNode, mn);
          }
          g.laserWarningRow = null;
        }
      } else if (g.actionCooldown <= 0) {
        g.actionCooldown = isP2 ? 190 : 260;
        g.laserWarningRow = g.arenaRow - this.rng.int(2, 4);
        g.laserWarningTimer = 60;
        if (isP2) {
          g.attackCols = [1, 7];
          g.attackWarnTimer = 60;
        }
      }
    } else if (g.id === 'PENDULUM') {
      if (g.timerFrames % (isP2 ? 34 : 48) === 0) {
        g.pendulumCol += g.pendulumDir;
        if (g.pendulumCol >= GRID_COLS - 2) g.pendulumDir = -1;
        if (g.pendulumCol <= 1) g.pendulumDir = 1;
      }
      if (g.actionCooldown <= 0) {
        g.actionCooldown = isP2 ? 170 : 240;
        g.attackCols = isP2 ? [g.pendulumCol, Math.max(0, Math.min(GRID_COLS - 1, this.gridCol))] : [g.pendulumCol];
        g.attackWarnTimer = 58;
      }
    } else if (g.id === 'ARCHITECT') {
      if (g.timerFrames % (isP2 ? 68 : 90) === 0) {
        g.ceilingRow += isP2 ? 0.42 : 0.35;
        if (g.ceilingRow >= this.py - 0.5) {
          this.triggerDeath('APLASTAMIENTO');
        }
      }
    } else if (g.id === 'CHRONOLITH') {
      if (g.timerFrames % (isP2 ? 38 : 54) === 0) {
        g.pendulumCol += g.pendulumDir;
        if (g.pendulumCol >= GRID_COLS - 2) g.pendulumDir = -1;
        if (g.pendulumCol <= 1) g.pendulumDir = 1;
      }
      if (g.timerFrames % (isP2 ? 85 : 120) === 0) {
        this.shiftPhaseBlocks();
      }
      if (g.actionCooldown <= 0) {
        g.actionCooldown = isP2 ? 180 : 250;
        g.attackCols = isP2 ? [1, 4, 7] : [2, 6];
        g.attackWarnTimer = 65;
      }
    }
  }

  private damageGuardian(amount: number): void {
    const g = this.activeGuardian;
    if (!g) return;
    const totalDmg = amount + (this.hasRelic('REL_ARCHITECT_SHARD') ? 1 : 0);
    g.hp -= totalDmg;
    g.hitFlashTimer = 10;
    soundEngine.playParry();
    this.addStyle('BOSS_HIT', 70);
    this.triggerShake(7.5, 12);
    this.addCamTrauma(0.6);
    this.pulseCamZoom(0.055);
    this.chromaFlashFrames = 2;
    this.fx.spawnLight(4.5, g.arenaRow - 4, 4.5, '#FACC15', 16, 0.5);
    this.fx.applyImpulseToCables(4.5, g.arenaRow - 4, 6.0, 3.8);

    if (g.hp > 0 && g.phase === 1 && g.hp <= Math.ceil(g.maxHp / 2)) {
      g.phase = 2;
      soundEngine.playBossPhase2();
      this.addCamTrauma(0.85);
      this.pulseCamZoom(0.08);
      this.hitstopFrames = Math.max(this.hitstopFrames, 4);
      this.addFloatingText(4.5, g.arenaRow - 5, '¡FASE 2 · ENFURECIDO!', 'PATRONES ACELERADOS', '#F43F5E', 1.3);
    }
    if (g.hp <= 0) {
      const arenaRow = g.arenaRow;
      const bossId = g.id;
      this.defeatedGuardians.add(arenaRow);
      this.activeGuardian = null;
      this.bossesDefeated++;
      this.anomalyCores += 1;
      this.addIsotopes(100);
      this.addMaterial(arenaRow >= 2000 ? 'eter' : 'titanio', 3);
      if (arenaRow >= 2500) this.addMaterial('alabastro', 3);
      this.oxygen = Math.min(this.maxOxygen, this.oxygen + 40);
      this.chromaFlashFrames = 3;
      this.camZoom = 1.06;

      // Open arena floor!
      for (let c = 0; c < GRID_COLS; c++) {
        this.setCell(arenaRow, c, makeEmptyCell());
      }

      if (this.config.mode === 'TRIAL' && this.config.trialId === 'BOSS_RUSH' && arenaRow === 600) {
        this.triggerVictory(true);
        return;
      }

      if (bossId === 'CHRONOLITH') {
        this.tryTriggerStoryByEvent('CHRONOLITH_DEFEAT');
        this.triggerVictory(true);
        return;
      }

      if (bossId === 'ARCHITECT') {
        if (this.hasSingularityLance || this.deepDescentUnlocked) {
          this.inStratum6 = true;
          this.stratum6CeilingRow = Math.max(2492, arenaRow - 12);
          this.discoveredCodex.add('STRATUM_6');
          this.tryTriggerStoryByEvent('ARCHITECT_DEFEAT');
          this.addFloatingText(4.5, 2496, 'FRACTURA DEL FONDO ABIERTA', 'RUMBO AL CRONOLITO (3.500m)', '#FACC15');
        } else {
          this.tryTriggerStoryByEvent('ARCHITECT_DEFEAT');
          if (!this.pendingStory) {
            this.triggerVictory(false);
          }
        }
      } else {
        if (bossId === 'WARDEN') this.tryTriggerStoryByEvent('WARDEN_DEFEAT');
        else if (bossId === 'LOOM') this.tryTriggerStoryByEvent('LOOM_DEFEAT');
        else if (bossId === 'FORGE') this.tryTriggerStoryByEvent('FORGE_DEFEAT');
        else if (bossId === 'PENDULUM') this.tryTriggerStoryByEvent('PENDULUM_DEFEAT');
        this.addFloatingText(4.5, arenaRow - 2, 'GUARDIÁN DERROTADO!', '+1 NÚCLEO · +MATERIALES', '#A3E635');
      }
      soundEngine.playSeismicSeal();
    }
  }

  private triggerDeath(cause: 'APLASTAMIENTO' | 'ASFIXIA' | 'SINGULARIDAD'): void {
    if (this.finished) return;
    this.finished = true;
    this.chromaFlashFrames = 4;
    soundEngine.playDeath();
    soundEngine.setLowOxygen(false);

    // Black box saves 60% of unbanked isotopes + 100% banked
    const saved = this.isotopesBanked + Math.floor(this.isotopes * 0.6);
    const xpEarned = Math.max(
      20,
      this.maxDepthReached * 2 + this.maxChain * 25 + this.parries * 45 + this.slagDestroyed * 12
    );

    this.summary = {
      victory: false,
      secretEnding: false,
      causeOfDeath: cause,
      depthMeters: this.maxDepthReached,
      durationSeconds: Math.round(this.frameCount / 60),
      maxChain: this.maxChain,
      maxCombo: this.maxComboMultiplier,
      parries: this.parries,
      slagDestroyed: this.slagDestroyed,
      isotopesEarned: this.isotopes + this.isotopesBanked,
      isotopesSaved: saved,
      anomalyCoresEarned: this.anomalyCores,
      xpEarned,
      mineralStats: { ...this.runMineralStats },
      discoveredLore: Array.from(this.discoveredLore),
      materialsEarned: { ...this.materialsEarned },
      trialId: this.config.trialId,
      bossesDefeated: this.bossesDefeated,
      geodesBroken: this.geodesBroken,
      bouncesTriggered: this.bouncesTriggered,
      acidMelts: this.acidMelts,
      gadgetsUsed: this.gadgetsUsed,
      cachesOpened: this.cachesOpened,
      o2CapsulesCollected: this.o2CapsulesCollected,
      seenStoryIds: Array.from(this.triggeredStoryIds),
      storyChoicesMade: { ...this.storyChoicesMade },
      consumedBeltSlots: [...this.consumedBeltSlots],
      peakStyleRank: this.peakStyleRank,
      fallImpacts: this.fallImpacts,
      discoveredArtifacts: [...this.discoveredArtifacts],
      resonanceUsed: this.resonanceUsed,
      seed: this.config.seed,
      mode: this.config.mode,
      chassis: this.config.chassis,
      ascension: this.config.ascension,
      modules: [...this.modules],
      overcharges: [...this.overcharges],
      newUnlocks: [],
    };
  }

  private triggerVictory(secretEnding: boolean): void {
    if (this.finished) return;
    this.finished = true;
    soundEngine.playSeismicSeal();
    soundEngine.setLowOxygen(false);

    let trialBonus = 0;
    if (this.config.mode === 'TRIAL' && this.config.trialId) {
      const tDef = TRIAL_DEFS.find((t) => t.id === this.config.trialId);
      if (tDef) {
        trialBonus = tDef.rewardIso;
        for (const [k, v] of Object.entries(tDef.rewardMats)) {
          this.addMaterial(k as MaterialId, v || 0);
        }
      }
    }

    const saved = this.isotopesBanked + this.isotopes + trialBonus + (secretEnding ? 300 : 150);
    const xpEarned = Math.max(
      120,
      this.maxDepthReached * 2 + this.maxChain * 25 + this.parries * 45 + this.slagDestroyed * 12 + (secretEnding ? 500 : 300)
    );
    this.summary = {
      victory: true,
      secretEnding,
      causeOfDeath: 'VICTORIA',
      depthMeters: this.maxDepthReached,
      durationSeconds: Math.round(this.frameCount / 60),
      maxChain: this.maxChain,
      maxCombo: this.maxComboMultiplier,
      parries: this.parries,
      slagDestroyed: this.slagDestroyed,
      isotopesEarned: saved,
      isotopesSaved: saved,
      anomalyCoresEarned: this.anomalyCores + (secretEnding ? 3 : 1),
      xpEarned,
      mineralStats: { ...this.runMineralStats },
      discoveredLore: Array.from(this.discoveredLore),
      materialsEarned: { ...this.materialsEarned },
      trialId: this.config.trialId,
      bossesDefeated: this.bossesDefeated,
      geodesBroken: this.geodesBroken,
      bouncesTriggered: this.bouncesTriggered,
      acidMelts: this.acidMelts,
      gadgetsUsed: this.gadgetsUsed,
      cachesOpened: this.cachesOpened,
      o2CapsulesCollected: this.o2CapsulesCollected,
      seenStoryIds: Array.from(this.triggeredStoryIds),
      storyChoicesMade: { ...this.storyChoicesMade },
      consumedBeltSlots: [...this.consumedBeltSlots],
      peakStyleRank: this.peakStyleRank,
      fallImpacts: this.fallImpacts,
      discoveredArtifacts: [...this.discoveredArtifacts],
      resonanceUsed: this.resonanceUsed,
      seed: this.config.seed,
      mode: this.config.mode,
      chassis: this.config.chassis,
      ascension: this.config.ascension,
      modules: [...this.modules],
      overcharges: [...this.overcharges],
      newUnlocks: [],
    };
  }

  private pruneRowsAbove(minRow: number): void {
    while (this.minPrunedRow < minRow) {
      this.grid.delete(this.minPrunedRow);
      this.rowMeta.delete(this.minPrunedRow);
      this.minPrunedRow++;
    }
  }

  private triggerShake(intensity: number, frames: number): void {
    this.shakeTimer = frames;
    this.shakeX = (Math.random() - 0.5) * intensity * 2;
    this.shakeY = (Math.random() - 0.5) * intensity * 2;
  }

  public spawnParticles(x: number, y: number, color: string, count: number): void {
    this.fx.spawnDebrisBurst(x, y, color, Math.max(3, Math.round(count * 0.75)));
    this.fx.spawnCellularBurst(x, y, 'SPARK', color, Math.max(2, Math.round(count * 0.5)), 0.1);
  }

  public addFloatingText(
    x: number,
    y: number,
    text: string,
    subtext: string | undefined,
    color: string,
    scale = 1
  ): void {
    this.fx.addFloatingText(x, y, text, subtext, color, scale);
  }

  private updateFX(): void {
    this.fx.update({
      getCell: (r, c) => this.getCell(r, c),
      minPrunedRow: this.minPrunedRow,
      maxGeneratedRow: this.maxGeneratedRow,
      cameraRow: this.cameraRow,
      px: this.px,
      py: this.py,
      vx: this.vx,
      vy: this.vy,
      facing: this.facing,
      isFalling: this.playerState === 'falling',
      isDashing: this.actionPose === 'DASH',
      frameCount: this.frameCount,
      chassis: this.config.chassis,
      magnetBonus: this.getChassisDef().magnetBonus ?? 0,
      onCollectIsotope: (amount, ox, oy) => {
        this.isotopes += amount;
        this.isotopePickupStreak++;
        soundEngine.playIsotopePickup(this.isotopePickupStreak);
        this.fx.spawnCellularBurst(ox, oy, 'SPARK', '#FEF08A', 4, 0.08);
      },
    });
  }
}
