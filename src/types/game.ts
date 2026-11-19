export type GameMode = 'CAMPAIGN' | 'ENDLESS' | 'SPRINT_500' | 'DUEL' | 'TRIAL';

export type TrialId = 'GRAVEL_AVALANCHE' | 'VOLATILE_CHAIN' | 'ANAEROBIC_RUN' | 'BOSS_RUSH';

export type ScreenView = 'INTRO' | 'TITLE' | 'PLAYING' | 'DUEL' | 'ARCHIVE';

export type ChassisId =
  | 'MKI_VERTICE'
  | 'MKI_BRISA'
  | 'MKII_ESPECTRO'
  | 'MKIII_YUNQUE'
  | 'MKVII_PIRO'
  | 'MKIV_METRONOMO'
  | 'MKV_TITAN'
  | 'MKVI_QUANTUM';

export type CharacterAccessoryStyle =
  | 'SCARF'
  | 'PONYTAIL'
  | 'TWIN_RIBBON'
  | 'CHAIN'
  | 'EMBER_CAPE'
  | 'EQ_RIBBON'
  | 'TETHER'
  | 'PLASMA_VEIL';

export interface RmbDragPreview {
  r: number;
  c: number;
  targetR: number;
  targetC: number;
  dirX: -1 | 0 | 1;
  dirY: -1 | 0 | 1;
  progress: number;
}

export type Archetype = 'PIROLITICO' | 'BALISTICO' | 'PARASITO' | 'CUANTICO' | 'SOBRECARGA';

export type AimDir = 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';

export type RigPose =
  | 'IDLE'
  | 'WALK'
  | 'FALL'
  | 'SLAM_DIVE'
  | 'CLIMB'
  | 'DRILL_STRIKE'
  | 'SWAP_CAST'
  | 'PARRY_SLASH'
  | 'DASH';

export type CrtMode = 'OFF' | 'SUBTLE' | 'ARCADE';

export type TouchControlMode = 'HYBRID' | 'GESTURES';

export type ControlAction =
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'drill'
  | 'swapLeft'
  | 'swapRight'
  | 'dash'
  | 'overdrive'
  | 'slam'
  | 'detonate'
  | 'reroll'
  | 'gadget1'
  | 'gadget2'
  | 'gadget3'
  | 'pause';

export type KeyBindingSlot = [string, string | null];
export type KeyBindings = Record<ControlAction, KeyBindingSlot>;
export type KeyBindingPresetId = 'STANDARD' | 'ARROWS_ZXC' | 'LEFT_HAND_MOUSE';

export interface VisualSettings {
  crtMode: CrtMode;
  screenShake: number;
  pixelGlow: boolean;
  musicVolume?: number;
  sfxVolume?: number;
  touchControlMode?: TouchControlMode;
  cameraAnchorY?: number;
  swipeDownDrill?: boolean;
  skipIntro?: boolean;
  visualDefaultsVersion?: number;
}

export type StyleRank = 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS';

export type FeverEventType = 'GOLD_RUSH' | 'FLASH_CHAIN' | 'FLASH_DRILL' | 'OVERPRESSURE';

export interface ActiveFeverEvent {
  type: FeverEventType;
  title: string;
  subtitle: string;
  color: string;
  timer: number;
  maxTimer: number;
  progress: number;
  target: number;
}

export interface ArchetypeSynergyState {
  archetype: Archetype;
  count: number;
  tier: 0 | 1 | 2;
  label: string;
  desc: string;
}

export interface AcidPuddle {
  r: number;
  c: number;
  timer: number;
  maxTimer: number;
}

export interface RadarMilestone {
  kind: 'SEAL' | 'BREACH' | 'VAULT' | 'BIFURCATION' | 'GUARDIAN';
  depth: number;
  label: string;
  color: string;
}

export type CellState =
  | 'EMPTY'
  | 'SOLID'
  | 'SWAPPING'
  | 'WOBBLE'
  | 'FALLING'
  | 'IGNITING'
  | 'DETONATING'
  | 'SLAG'
  | 'RIVET'
  | 'CRYSTAL'
  | 'CONDUCTOR'
  | 'PHASE'
  | 'OXYGEN'
  | 'GEODE'
  | 'CRYO_VENT'
  | 'MAGMA_NODE'
  | 'GRAVEL'
  | 'BOUNCE_PAD'
  | 'GAS_POCKET'
  | 'ACID_VAT'
  | 'GRAV_WELL'
  | 'SHOCK_MINE'
  | 'TREASURE_CACHE'
  | 'MONOLITH'
  | 'PHASE_KEY'
  | 'GHOST_ECHO'
  | 'BREACH_SEAL'
  | 'BIFURCATION_SEAL'
  | 'EXTRACTION_TUBE'
  | 'ARTIFACT_POD';

export type ColorSymbol = 'CIRCLE' | 'DIAGONALS' | 'CHEVRON' | 'CROSS' | 'RETICLE';

export interface Cell {
  id: number;
  state: CellState;
  kind?: CellState; // underlying block material (SOLID, SLAG, CRYSTAL, CONDUCTOR, PHASE, OXYGEN, etc.)
  color: number; // 0..4 for standard colors, -1 for non-colored
  altColor?: number; // for PHASE blocks
  clusterId: number;
  wobbleTimer: number;
  wobbleMax: number;
  fuseTimer: number;
  fuseMax: number;
  chainLevel: number;
  detonateTimer: number;
  hp: number; // for SLAG (5), RIVET (99), MONOLITH (99)
  fallOffset: number; // sub-cell vertical offset [0..1)
  fallDistance: number; // rows fallen in current fall
  fallSpeed?: number; // current vertical velocity in cells/s for real acceleration
  swapProgress: number; // 0..1
  swapFromCol: number;
  swapFromRow: number;
  crystalTimer: number; // 0.4s break delay when weight rests on CRYSTAL
  crystalTriggered: boolean;
  emberTimer: number; // Brasa Persistente residual timer (0 if none)
  isVolatileSlag?: boolean; // Alquimia de Basalto
  breachOptionIndex?: number; // 0, 1, 2 for Breach Chamber gates
  bifurcationSide?: 'LEFT' | 'RIGHT';
  monolithColor?: number;
  isGarbage?: boolean; // sent in Duel
  echoModuleId?: string;
  landBounce?: number; // 0..1 decaying spring squash when falling block lands
  hitFlash?: number; // integer frames of pure white flash when damaged
  drillCrack?: number; // optional fracture intensity
  nearMatch?: boolean; // 3-cluster harmonic tension indicator
  mineTimer?: number;
  mineArmed?: boolean;
  acidCorrodeTimer?: number;
  bounceAnim?: number;
  artifactId?: ArtifactId;
}

export interface ModuleDef {
  id: string;
  name: string;
  archetype: Archetype;
  shortDesc: string;
  mk2Desc: string;
  glyph: string;
  unlockCost?: number;
  featHint?: string;
}

export interface ActiveModule {
  id: string;
  mk2: boolean;
}

export interface OverchargeDef {
  id: string;
  name: string;
  benefit: string;
  cost: string;
  glyph: string;
}

export interface ChassisDef {
  id: ChassisId;
  name: string;
  callsign: string;
  role: string;
  code: string;
  summary: string;
  stats: string;
  traitTitle: string;
  traitDesc: string;
  accentColor: string;
  accessoryStyle: CharacterAccessoryStyle;
  isStarter?: boolean;
  unlockIsoCost?: number;
  unlockRequirement: string;
  maxOxygen: number;
  moveSpeedMult: number;
  baseSwapReach: number;
  slagHits: number;
  canAutoClimb: boolean;
  phasesThroughIgniting: boolean;
  fallDamageMult?: number;
  dashCooldownMult?: number;
  o2CapsuleBonus?: number;
  fuseBonusFrames?: number;
  isotopeChainBonus?: number;
  overdriveGainMult?: number;
  magnetBonus?: number;
  starterShields?: number;
  origin?: string;
  bio?: string;
  motto?: string;
  signatureName?: string;
  signatureDesc?: string;
  banter?: {
    start: string;
    deep: string;
    chain: string;
    artifact: string;
    lastBreath: string;
  };
}

export interface StratumPalette {
  id: number;
  name: string;
  subtitle: string;
  depthStart: number;
  depthEnd: number;
  colorCount: number;
  oxygenDrain: number; // % per second
  wobbleSeconds: number;
  bg: string;
  wallBg: string;
  wallBorder: string;
  voidText: string;
  blockColors: string[];
  slagColor: string;
  slagAccent: string;
  isLightMode?: boolean;
}

export type MaterialId = 'ferrita' | 'cuarzo' | 'ignita' | 'titanio' | 'eter' | 'alabastro';

export type MaterialBag = Record<MaterialId, number>;

export type RelicId =
  | 'REL_MAGNET_HEART'
  | 'REL_CRYO_VALVE'
  | 'REL_THERMAL_CORE'
  | 'REL_PARRY_LENS'
  | 'REL_SLAM_BOOTS'
  | 'REL_PHASE_CLOAK'
  | 'REL_GEODE_COMPASS'
  | 'REL_GLASS_CANNON'
  | 'REL_ACID_PLATING'
  | 'REL_GRAV_ANCHOR'
  | 'REL_ALCHEMIST_RING'
  | 'REL_ARCHITECT_SHARD'
  | 'REL_ARTIFACT_SCANNER'
  | 'REL_RESONANCE_COIL';

export type GadgetId =
  | 'GAD_O2_CELL'
  | 'GAD_SEISMIC_CHARGE'
  | 'GAD_CRYO_BOMB'
  | 'GAD_PHASE_SWAP'
  | 'GAD_REPAIR_SHIELD'
  | 'GAD_OVERDRIVE_INJ'
  | 'GAD_SONAR_PULSE'
  | 'GAD_RESONANCE_CELL';

export type ArtifactId =
  | 'ART_01'
  | 'ART_02'
  | 'ART_03'
  | 'ART_04'
  | 'ART_05'
  | 'ART_06'
  | 'ART_07'
  | 'ART_08'
  | 'ART_09'
  | 'ART_10'
  | 'ART_11'
  | 'ART_12'
  | 'ART_13'
  | 'ART_14';

export type ArtifactRarity = 'COMÚN' | 'RARO' | 'ÉPICO' | 'MÍTICO';

export interface ArtifactDef {
  id: ArtifactId;
  code: string;
  name: string;
  stratumId: number;
  rarity: ArtifactRarity;
  color: string;
  accent: string;
  iconShape:
    | 'COMPASS'
    | 'BADGE'
    | 'PRISM'
    | 'CHIME'
    | 'TEAR'
    | 'PISTON'
    | 'FORK'
    | 'LENS'
    | 'CLOCK'
    | 'CORE'
    | 'FEATHER'
    | 'TABLET'
    | 'DIAL'
    | 'CROWN';
  lore: string;
  quote: string;
  findBonusIso: number;
  findBonusMat: MaterialId;
}

export interface ArtifactMilestoneDef {
  id: string;
  required: number;
  title: string;
  subtitle: string;
  rewardIso: number;
  rewardCores: number;
  rewardMats: Partial<Record<MaterialId, number>>;
  rewardGadgets: Partial<Record<GadgetId, number>>;
  permBonusDesc: string;
  isGrandPrize?: boolean;
}

export interface OperatorMasteryRecord {
  runs: number;
  maxDepth: number;
  blocks: number;
  resonanceUses: number;
}

export type StorySpeaker = 'VANCE' | 'SOLER' | 'KAI' | 'ARQUITECTO';

export type HazardType =
  | 'NONE'
  | 'SEISMIC_TREMOR'
  | 'CRYO_SHARDS'
  | 'MAGMA_UPDRAFT'
  | 'PRESSURE_PULSE'
  | 'PHASE_STORM'
  | 'VOID_RIFT';

export interface StoryChoice {
  id: string;
  label: string;
  rewardText: string;
  tag?: string;
}

export interface StoryTransmission {
  id: string;
  chapter: number;
  speaker: StorySpeaker;
  triggerDepth?: number;
  triggerEvent?:
    | 'PROLOGUE'
    | 'FIRST_DRILL_COMBO'
    | 'WARDEN_INTRO'
    | 'WARDEN_DEFEAT'
    | 'LOOM_INTRO'
    | 'LOOM_DEFEAT'
    | 'FORGE_INTRO'
    | 'FORGE_DEFEAT'
    | 'PENDULUM_INTRO'
    | 'PENDULUM_DEFEAT'
    | 'ARCHITECT_INTRO'
    | 'ARCHITECT_DEFEAT'
    | 'CHRONOLITH_INTRO'
    | 'CHRONOLITH_DEFEAT';
  title: string;
  lines: string[];
  choices?: StoryChoice[];
  isTicker?: boolean;
}

export interface CampaignChapterDef {
  id: number;
  name: string;
  stratumName: string;
  depthStart: number;
  depthEnd: number;
  bossName: string;
  bossDepth: number;
  hazardName: string;
  synopsis: string;
  accentColor: string;
}

export interface MaterialDef {
  id: MaterialId;
  name: string;
  formula: string;
  color: string;
  accent: string;
  dropSource: string;
}

export interface RelicDef {
  id: RelicId;
  name: string;
  code: string;
  glyph: string;
  color: string;
  desc: string;
  isoCost: number;
  matCost: Partial<MaterialBag>;
}

export interface GadgetDef {
  id: GadgetId;
  name: string;
  shortCode: string;
  glyph: string;
  color: string;
  desc: string;
  isoCost: number;
  matCost: Partial<MaterialBag>;
  maxStack: number;
}

export interface ChallengeDef {
  id: string;
  title: string;
  desc: string;
  progressKey: string;
  target: number;
  rewardIso: number;
  rewardCores?: number;
  rewardMats: Partial<MaterialBag>;
}

export interface ContractDef {
  id: string;
  title: string;
  desc: string;
  metric: 'DEPTH' | 'SLAG' | 'GEODES' | 'PARRIES' | 'COMBO' | 'CHAIN' | 'BOUNCES' | 'CACHES';
  target: number;
  rewardIso: number;
  rewardMats: Partial<MaterialBag>;
}

export interface ActiveContractState {
  id: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface TrialDef {
  id: TrialId;
  name: string;
  subtitle: string;
  goalDepth: number;
  rules: string[];
  rewardIso: number;
  rewardMats: Partial<MaterialBag>;
  accentColor: string;
}

export interface RigUpgrades {
  drillTier: number; // 0..5
  thrusterTier: number; // 0..5
  tankTier: number; // 0..5
  armorTier: number; // 0..5
  capacitorTier: number; // 0..5
  magnetTier: number; // 0..5
}

export interface InfrastructureLevels {
  reroll: number; // 0..3
  banish: number; // 0..3 (max 8 banished)
  initialInjection: number; // 0..1
  salvageCapsule: number; // 0..1
  elevatorUnlock: number; // 0..5 depth shortcuts
  beltSlots: number; // 0..2 extra gadget belt slots (1..3 total)
  relicSlots: number; // 0..2 extra relic slots (1..3 total)
  supplyDrop: number; // 0..3 extra starting shields / O2 reserve
}

export interface MineralRecord {
  destroyed: number;
  deepestRow: number;
}

export interface LoreFragmentDef {
  id: string;
  code: string;
  title: string;
  author: string;
  depthLabel: string;
  triggerHint: string;
  excerpt: string;
}

export interface MineralSpecDef {
  kind:
    | 'SOLID'
    | 'SLAG'
    | 'CRYSTAL'
    | 'CONDUCTOR'
    | 'PHASE'
    | 'OXYGEN'
    | 'GEODE'
    | 'CRYO_VENT'
    | 'MAGMA_NODE'
    | 'GRAVEL'
    | 'BOUNCE_PAD'
    | 'GAS_POCKET'
    | 'ACID_VAT'
    | 'GRAV_WELL'
    | 'SHOCK_MINE'
    | 'TREASURE_CACHE';
  name: string;
  formula: string;
  strataRange: string;
  hardness: string;
  swatch: string;
  note: string;
}

export interface RunSummary {
  victory: boolean;
  secretEnding: boolean;
  causeOfDeath: 'APLASTAMIENTO' | 'ASFIXIA' | 'SINGULARIDAD' | 'VICTORIA';
  depthMeters: number;
  durationSeconds: number;
  maxChain: number;
  maxCombo?: number;
  parries: number;
  slagDestroyed: number;
  isotopesEarned: number;
  isotopesSaved: number;
  anomalyCoresEarned: number;
  xpEarned?: number;
  mineralStats?: Record<string, MineralRecord>;
  discoveredLore?: string[];
  materialsEarned?: MaterialBag;
  trialId?: TrialId;
  bossesDefeated?: number;
  geodesBroken?: number;
  bouncesTriggered?: number;
  acidMelts?: number;
  gadgetsUsed?: number;
  cachesOpened?: number;
  o2CapsulesCollected?: number;
  seenStoryIds?: string[];
  storyChoicesMade?: Record<string, string>;
  consumedBeltSlots?: GadgetId[];
  peakStyleRank?: StyleRank;
  fallImpacts?: number;
  discoveredArtifacts?: ArtifactId[];
  resonanceUsed?: number;
  seed: string;
  mode: GameMode;
  chassis: ChassisId;
  ascension: number;
  modules: ActiveModule[];
  overcharges: string[];
  newUnlocks: string[];
}

export interface ArchiveSave {
  isotopes: number;
  anomalyCores: number;
  xp: number;
  rigLevel: number;
  rigUpgrades: RigUpgrades;
  unlockedChassis: ChassisId[];
  selectedChassis: ChassisId;
  unlockedModules: string[];
  banishedModules: string[];
  infra: InfrastructureLevels;
  discoveredCodex: string[];
  discoveredLore: string[];
  mineralStats: Record<string, MineralRecord>;
  totalRuns: number;
  totalBlocksDestroyed: number;
  bestCombo: number;
  maxDepthCampaign: number;
  maxDepthEndless: number;
  bestSprintSeconds: number | null;
  campaignWins: number;
  maxAscensionUnlocked: number;
  totalSlagDestroyed: number;
  totalParries: number;
  bestChain: number;
  lastDeathEcho: {
    depth: number;
    moduleId: string;
  } | null;
  dailyCompletedDate: string | null;
  dailyBestDepth: number;
  tutorialCompleted: boolean;
  materials: MaterialBag;
  craftedRelics: RelicId[];
  equippedRelics: RelicId[];
  gadgetInventory: Record<GadgetId, number>;
  equippedBelt: (GadgetId | null)[];
  seenStoryIds: string[];
  storyChoices: Record<string, string>;
  unlockedChapters: number;
  claimedChallenges: string[];
  challengeProgress: Record<string, number>;
  activeContracts: ActiveContractState[];
  completedTrials: TrialId[];
  skipSeenDialogues: boolean;
  discoveredArtifacts?: ArtifactId[];
  claimedArtifactMilestones?: string[];
  architectCrownUnlocked?: boolean;
  operatorMastery?: Partial<Record<ChassisId, OperatorMasteryRecord>>;
}

export const GRID_COLS = 9;
export const LOGIC_HZ = 60;
export const DT = 1 / LOGIC_HZ;

export const PLAYER_SPEED_CELLS_PER_SEC = 8.5;
export const ORIENT_THRESHOLD_FRAMES = 4;
export const CLIMB_HOLD_FRAMES = 7; // ~0.12s
export const SWAP_DURATION_FRAMES = 4; // 66ms
export const INPUT_BUFFER_FRAMES = 5;
export const COYOTE_CRUSH_FRAMES = 9; // 150ms
export const IGNITE_FUSE_FRAMES = [72, 57, 45, 33]; // 1.20 -> 0.95 -> 0.75 -> 0.55s
export const DETONATING_FRAMES = 6;
export const FALL_SPEED_NORMAL = 18; // cells/s
export const FALL_SPEED_SLAM = 45; // cells/s (2.5x)
export const LAST_BREATH_FRAMES = 165; // 2.75s clutch survival window
export const DASH_COOLDOWN_FRAMES = 84; // 1.4s base
export const OVERDRIVE_DURATION_FRAMES = 360; // 6.0s
export const COLOR_SYMBOLS: ColorSymbol[] = ['CIRCLE', 'DIAGONALS', 'CHEVRON', 'CROSS', 'RETICLE'];
