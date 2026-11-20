import {
  ActiveContractState,
  ArchiveSave,
  ArtifactId,
  ChassisId,
  GadgetId,
  MaterialBag,
  MaterialId,
  MineralRecord,
  OperatorMasteryRecord,
  RelicId,
  RunSummary,
  VisualSettings,
} from '../types/game';
import { CHASSIS_LIST, LORE_FRAGMENTS, MODULES } from '../data/catalog';
import { ARTIFACT_MILESTONES, ARTIFACTS } from '../data/collectibles';
import {
  CHALLENGES,
  CONTRACT_POOL,
  EMPTY_MATERIAL_BAG,
  GADGETS,
  RELICS,
  rollInitialContracts,
} from '../data/crafting';

const STORAGE_KEY = 'estrato_archive_v1';
const VISUAL_STORAGE_KEY = 'estrato_visual_v1';
const VISUAL_DEFAULTS_VERSION = 2;

export function getDefaultVisualSettings(): VisualSettings {
  return {
    crtMode: 'SUBTLE',
    screenShake: 1,
    pixelGlow: true,
    musicVolume: 0.78,
    sfxVolume: 0.9,
    touchControlMode: 'GESTURES',
    swipeDownDrill: true,
    skipIntro: false,
    visualDefaultsVersion: VISUAL_DEFAULTS_VERSION,
  };
}

export function loadVisualSettings(): VisualSettings {
  try {
    const raw = localStorage.getItem(VISUAL_STORAGE_KEY);
    if (!raw) return getDefaultVisualSettings();
    const parsed = JSON.parse(raw) as Partial<VisualSettings>;
    const crtMode =
      parsed.crtMode === 'OFF' || parsed.crtMode === 'SUBTLE' || parsed.crtMode === 'ARCADE'
        ? parsed.crtMode
        : 'SUBTLE';
    const screenShake =
      typeof parsed.screenShake === 'number' ? Math.max(0, Math.min(1.5, parsed.screenShake)) : 1;
    const pixelGlow = typeof parsed.pixelGlow === 'boolean' ? parsed.pixelGlow : true;
    const musicVolume =
      typeof parsed.musicVolume === 'number' && !Number.isNaN(parsed.musicVolume)
        ? Math.max(0, Math.min(1, parsed.musicVolume))
        : 0.78;
    const sfxVolume =
      typeof parsed.sfxVolume === 'number' && !Number.isNaN(parsed.sfxVolume)
        ? Math.max(0, Math.min(1, parsed.sfxVolume))
        : 0.9;
    const hasV2 = typeof parsed.visualDefaultsVersion === 'number' && parsed.visualDefaultsVersion >= VISUAL_DEFAULTS_VERSION;
    const touchControlMode = !hasV2
      ? 'GESTURES'
      : parsed.touchControlMode === 'HYBRID'
        ? 'HYBRID'
        : 'GESTURES';
    const swipeDownDrill = typeof parsed.swipeDownDrill === 'boolean' ? parsed.swipeDownDrill : true;
    const skipIntro = typeof parsed.skipIntro === 'boolean' ? parsed.skipIntro : false;
    const cameraAnchorY =
      typeof parsed.cameraAnchorY === 'number' && Number.isFinite(parsed.cameraAnchorY)
        ? Math.max(0.38, Math.min(0.72, Number(parsed.cameraAnchorY.toFixed(2))))
        : undefined;
    const base: VisualSettings = {
      crtMode,
      screenShake,
      pixelGlow,
      musicVolume,
      sfxVolume,
      touchControlMode,
      swipeDownDrill,
      skipIntro,
      visualDefaultsVersion: VISUAL_DEFAULTS_VERSION,
    };
    return cameraAnchorY !== undefined ? { ...base, cameraAnchorY } : base;
  } catch {
    return getDefaultVisualSettings();
  }
}

export function saveVisualSettings(s: VisualSettings): void {
  try {
    localStorage.setItem(
      VISUAL_STORAGE_KEY,
      JSON.stringify({ ...s, visualDefaultsVersion: VISUAL_DEFAULTS_VERSION })
    );
  } catch {
    // Ignore quota errors
  }
}

const DEFAULT_UNLOCKED_MODULES = MODULES.filter((m) => !m.unlockCost).map((m) => m.id);

export function getLevelFromXp(xp: number): number {
  return Math.min(30, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 110)));
}

export function getXpForNextLevel(level: number): number {
  return level * level * 110;
}

export function getDefaultMaterials(): MaterialBag {
  return {
    ferrita: 8,
    cuarzo: 4,
    ignita: 2,
    titanio: 0,
    eter: 0,
    alabastro: 0,
  };
}

export function getDefaultGadgetInventory(): Record<GadgetId, number> {
  return {
    GAD_O2_CELL: 1,
    GAD_SEISMIC_CHARGE: 1,
    GAD_CRYO_BOMB: 0,
    GAD_PHASE_SWAP: 0,
    GAD_REPAIR_SHIELD: 0,
    GAD_OVERDRIVE_INJ: 0,
    GAD_SONAR_PULSE: 0,
    GAD_RESONANCE_CELL: 0,
  };
}

export function getDefaultArchive(): ArchiveSave {
  return {
    isotopes: 65,
    anomalyCores: 0,
    xp: 0,
    rigLevel: 1,
    rigUpgrades: {
      drillTier: 0,
      thrusterTier: 0,
      tankTier: 0,
      armorTier: 0,
      capacitorTier: 0,
      magnetTier: 0,
    },
    unlockedChassis: ['MKI_VERTICE', 'MKI_BRISA'],
    selectedChassis: 'MKI_VERTICE',
    unlockedModules: [...DEFAULT_UNLOCKED_MODULES],
    banishedModules: [],
    infra: {
      reroll: 1,
      banish: 0,
      initialInjection: 0,
      salvageCapsule: 0,
      elevatorUnlock: 0,
      beltSlots: 0,
      relicSlots: 0,
      supplyDrop: 0,
    },
    discoveredCodex: ['STRATUM_1'],
    discoveredLore: ['LORE_01_BITACORA'],
    mineralStats: {},
    totalRuns: 0,
    totalBlocksDestroyed: 0,
    bestCombo: 1,
    maxDepthCampaign: 0,
    maxDepthEndless: 0,
    bestSprintSeconds: null,
    campaignWins: 0,
    maxAscensionUnlocked: 1,
    totalSlagDestroyed: 0,
    totalParries: 0,
    bestChain: 0,
    lastDeathEcho: null,
    dailyCompletedDate: null,
    dailyBestDepth: 0,
    tutorialCompleted: false,
    materials: getDefaultMaterials(),
    craftedRelics: [],
    equippedRelics: [],
    gadgetInventory: getDefaultGadgetInventory(),
    equippedBelt: ['GAD_O2_CELL', null, null],
    seenStoryIds: [],
    storyChoices: {},
    unlockedChapters: 1,
    claimedChallenges: [],
    challengeProgress: {},
    activeContracts: rollInitialContracts(),
    completedTrials: [],
    skipSeenDialogues: false,
    discoveredArtifacts: [],
    claimedArtifactMilestones: [],
    architectCrownUnlocked: false,
    operatorMastery: {},
  };
}

export function loadArchive(): ArchiveSave {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultArchive();
    const parsed = JSON.parse(raw) as Partial<ArchiveSave>;
    const base = getDefaultArchive();
    const xp = typeof parsed.xp === 'number' ? parsed.xp : base.xp;
    const mergedMinerals: Record<string, MineralRecord> = {};
    if (parsed.mineralStats && typeof parsed.mineralStats === 'object') {
      for (const [k, v] of Object.entries(parsed.mineralStats)) {
        if (v && typeof v.destroyed === 'number') {
          mergedMinerals[k] = {
            destroyed: v.destroyed,
            deepestRow: typeof v.deepestRow === 'number' ? v.deepestRow : 0,
          };
        }
      }
    }
    const maxCampaign = typeof parsed.maxDepthCampaign === 'number' ? parsed.maxDepthCampaign : 0;
    const derivedChapters = Math.max(
      typeof parsed.unlockedChapters === 'number' ? parsed.unlockedChapters : 1,
      maxCampaign >= 3000
        ? 7
        : maxCampaign >= 2500
          ? 6
          : maxCampaign >= 2000
            ? 5
            : maxCampaign >= 1500
              ? 4
              : maxCampaign >= 1000
                ? 3
                : maxCampaign >= 500
                  ? 2
                  : 1
    );

    const hydratedBelt: (GadgetId | null)[] = [null, null, null];
    if (Array.isArray(parsed.equippedBelt)) {
      for (let i = 0; i < 3; i++) {
        hydratedBelt[i] = (parsed.equippedBelt[i] as GadgetId | null) ?? null;
      }
    } else {
      hydratedBelt[0] = base.equippedBelt[0];
    }

    return {
      ...base,
      ...parsed,
      xp,
      rigLevel: getLevelFromXp(xp),
      rigUpgrades: { ...base.rigUpgrades, ...(parsed.rigUpgrades || {}) },
      infra: { ...base.infra, ...(parsed.infra || {}) },
      unlockedChassis: Array.from(new Set([...base.unlockedChassis, ...(parsed.unlockedChassis || [])])),
      selectedChassis:
        parsed.selectedChassis &&
          Array.from(new Set([...base.unlockedChassis, ...(parsed.unlockedChassis || [])])).includes(parsed.selectedChassis)
          ? parsed.selectedChassis
          : base.selectedChassis,
      unlockedModules: Array.from(new Set([...DEFAULT_UNLOCKED_MODULES, ...(parsed.unlockedModules || [])])),
      discoveredCodex: Array.from(new Set([...base.discoveredCodex, ...(parsed.discoveredCodex || [])])),
      discoveredLore: Array.from(new Set([...base.discoveredLore, ...(parsed.discoveredLore || [])])),
      mineralStats: mergedMinerals,
      materials: parsed.materials ? { ...EMPTY_MATERIAL_BAG, ...parsed.materials } : getDefaultMaterials(),
      craftedRelics: Array.isArray(parsed.craftedRelics) ? parsed.craftedRelics : [],
      equippedRelics: Array.isArray(parsed.equippedRelics) ? parsed.equippedRelics : [],
      gadgetInventory: parsed.gadgetInventory
        ? { ...getDefaultGadgetInventory(), ...parsed.gadgetInventory }
        : getDefaultGadgetInventory(),
      equippedBelt: hydratedBelt,
      seenStoryIds: Array.isArray(parsed.seenStoryIds) ? parsed.seenStoryIds : [],
      storyChoices: parsed.storyChoices && typeof parsed.storyChoices === 'object' ? parsed.storyChoices : {},
      unlockedChapters: derivedChapters,
      claimedChallenges: Array.isArray(parsed.claimedChallenges) ? parsed.claimedChallenges : [],
      challengeProgress:
        parsed.challengeProgress && typeof parsed.challengeProgress === 'object' ? parsed.challengeProgress : {},
      activeContracts:
        Array.isArray(parsed.activeContracts) && parsed.activeContracts.length > 0
          ? parsed.activeContracts
          : rollInitialContracts(),
      completedTrials: Array.isArray(parsed.completedTrials) ? parsed.completedTrials : [],
      skipSeenDialogues: Boolean(parsed.skipSeenDialogues),
      discoveredArtifacts: Array.isArray(parsed.discoveredArtifacts)
        ? (Array.from(new Set(parsed.discoveredArtifacts)) as ArtifactId[])
        : [],
      claimedArtifactMilestones: Array.isArray(parsed.claimedArtifactMilestones)
        ? parsed.claimedArtifactMilestones
        : [],
      architectCrownUnlocked: Boolean(parsed.architectCrownUnlocked),
      operatorMastery:
        parsed.operatorMastery && typeof parsed.operatorMastery === 'object' ? parsed.operatorMastery : {},
    };
  } catch {
    return getDefaultArchive();
  }
}

export function saveArchive(data: ArchiveSave): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore quota errors
  }
}

export function getMaxRelicSlots(archive: ArchiveSave): number {
  return Math.min(3, 1 + (archive.infra?.relicSlots || 0));
}

export function getMaxBeltSlots(archive: ArchiveSave): number {
  return Math.min(3, 1 + (archive.infra?.beltSlots || 0));
}

export function getBestDepth(archive: ArchiveSave): number {
  return Math.max(archive.maxDepthCampaign || 0, archive.maxDepthEndless || 0);
}

export function canAffordMaterials(bag: MaterialBag, cost: Partial<MaterialBag>): boolean {
  for (const [k, amt] of Object.entries(cost)) {
    const id = k as MaterialId;
    if ((bag[id] || 0) < (amt || 0)) return false;
  }
  return true;
}

export function subtractMaterials(bag: MaterialBag, cost: Partial<MaterialBag>): MaterialBag {
  const next = { ...bag };
  for (const [k, amt] of Object.entries(cost)) {
    const id = k as MaterialId;
    next[id] = Math.max(0, (next[id] || 0) - (amt || 0));
  }
  return next;
}

export function addMaterialsToBag(bag: MaterialBag, delta: Partial<MaterialBag>): MaterialBag {
  const next = { ...bag };
  for (const [k, amt] of Object.entries(delta)) {
    const id = k as MaterialId;
    next[id] = (next[id] || 0) + (amt || 0);
  }
  return next;
}

export function craftRelic(archive: ArchiveSave, relicId: RelicId): ArchiveSave | null {
  const def = RELICS.find((r) => r.id === relicId);
  if (!def) return null;
  if (archive.craftedRelics.includes(relicId)) return null;
  if (getBestDepth(archive) < (def.minDepth ?? 0)) return null;
  if (archive.isotopes < def.isoCost || !canAffordMaterials(archive.materials, def.matCost)) return null;

  const maxSlots = getMaxRelicSlots(archive);
  const autoEquip = archive.equippedRelics.length < maxSlots;
  const next: ArchiveSave = {
    ...archive,
    isotopes: archive.isotopes - def.isoCost,
    materials: subtractMaterials(archive.materials, def.matCost),
    craftedRelics: [...archive.craftedRelics, relicId],
    equippedRelics: autoEquip ? [...archive.equippedRelics, relicId] : [...archive.equippedRelics],
  };
  saveArchive(next);
  return next;
}

export function toggleEquipRelic(archive: ArchiveSave, relicId: RelicId): ArchiveSave {
  if (!archive.craftedRelics.includes(relicId)) return archive;
  const equipped = [...archive.equippedRelics];
  const idx = equipped.indexOf(relicId);
  if (idx >= 0) {
    equipped.splice(idx, 1);
  } else {
    const maxSlots = getMaxRelicSlots(archive);
    if (equipped.length >= maxSlots) {
      equipped.shift();
    }
    equipped.push(relicId);
  }
  const next: ArchiveSave = { ...archive, equippedRelics: equipped };
  saveArchive(next);
  return next;
}

export function craftGadget(archive: ArchiveSave, gadgetId: GadgetId): ArchiveSave | null {
  const def = GADGETS.find((g) => g.id === gadgetId);
  if (!def) return null;
  if (getBestDepth(archive) < (def.minDepth ?? 0)) return null;
  const owned = archive.gadgetInventory[gadgetId] || 0;
  if (owned >= def.maxStack) return null;
  if (archive.isotopes < def.isoCost || !canAffordMaterials(archive.materials, def.matCost)) return null;

  const belt = [...archive.equippedBelt];
  const maxSlots = getMaxBeltSlots(archive);
  if (!belt.slice(0, maxSlots).includes(gadgetId)) {
    const emptyIdx = belt.slice(0, maxSlots).indexOf(null);
    if (emptyIdx >= 0) {
      belt[emptyIdx] = gadgetId;
    }
  }

  const next: ArchiveSave = {
    ...archive,
    isotopes: archive.isotopes - def.isoCost,
    materials: subtractMaterials(archive.materials, def.matCost),
    gadgetInventory: {
      ...archive.gadgetInventory,
      [gadgetId]: owned + 1,
    },
    equippedBelt: belt,
  };
  saveArchive(next);
  return next;
}

export function setBeltSlot(archive: ArchiveSave, slotIdx: number, gadgetId: GadgetId | null): ArchiveSave {
  const maxSlots = getMaxBeltSlots(archive);
  if (slotIdx < 0 || slotIdx >= maxSlots) return archive;
  if (gadgetId && (archive.gadgetInventory[gadgetId] || 0) <= 0) return archive;
  const belt = [...archive.equippedBelt];
  belt[slotIdx] = gadgetId;
  const next: ArchiveSave = { ...archive, equippedBelt: belt };
  saveArchive(next);
  return next;
}

export function getChallengeProgressValue(archive: ArchiveSave, key: string): number {
  switch (key) {
    case 'bestDepth':
      return Math.max(archive.maxDepthCampaign || 0, archive.maxDepthEndless || 0);
    case 'totalBlocks':
      return archive.totalBlocksDestroyed || 0;
    case 'totalSlag':
      return archive.totalSlagDestroyed || 0;
    case 'totalParries':
      return archive.totalParries || 0;
    case 'bestCombo':
      return archive.bestCombo || 1;
    case 'bestChain':
      return archive.bestChain || 0;
    case 'relicsCrafted':
      return (archive.craftedRelics || []).length;
    case 'artifactsFound':
      return (archive.discoveredArtifacts || []).length;
    default:
      return archive.challengeProgress?.[key] || 0;
  }
}

export function getOperatorMasteryRank(rec?: OperatorMasteryRecord): {
  rank: number;
  title: string;
  nextBlocks: number;
} {
  const blocks = rec?.blocks || 0;
  if (blocks >= 1600) return { rank: 5, title: 'Leyenda Subterránea', nextBlocks: 1600 };
  if (blocks >= 800) return { rank: 4, title: 'Maestro del Pozo', nextBlocks: 1600 };
  if (blocks >= 350) return { rank: 3, title: 'Veterano de Sondeo', nextBlocks: 800 };
  if (blocks >= 120) return { rank: 2, title: 'Explorador de Vetas', nextBlocks: 350 };
  return { rank: 1, title: 'Recluta de Descenso', nextBlocks: 120 };
}

export function claimArtifactMilestone(archive: ArchiveSave, milestoneId: string): ArchiveSave | null {
  const claimed = new Set(archive.claimedArtifactMilestones || []);
  if (claimed.has(milestoneId)) return null;
  const def = ARTIFACT_MILESTONES.find((m) => m.id === milestoneId);
  if (!def) return null;
  const count = (archive.discoveredArtifacts || []).length;
  if (count < def.required) return null;

  const nextInventory = { ...(archive.gadgetInventory || getDefaultGadgetInventory()) };
  for (const [k, v] of Object.entries(def.rewardGadgets || {})) {
    const gid = k as GadgetId;
    const cap = GADGETS.find((g) => g.id === gid)?.maxStack || 9;
    nextInventory[gid] = Math.min(cap, (nextInventory[gid] || 0) + (v || 0));
  }

  const nextLore = new Set(archive.discoveredLore || ['LORE_01_BITACORA']);
  if (def.isGrandPrize) {
    nextLore.add('LORE_24_CORONA_ARQUITECTO');
  }

  const next: ArchiveSave = {
    ...archive,
    isotopes: archive.isotopes + def.rewardIso,
    anomalyCores: archive.anomalyCores + def.rewardCores,
    materials: addMaterialsToBag(archive.materials || EMPTY_MATERIAL_BAG, def.rewardMats),
    gadgetInventory: nextInventory,
    claimedArtifactMilestones: [...claimed, milestoneId],
    architectCrownUnlocked: Boolean(archive.architectCrownUnlocked || def.isGrandPrize),
    discoveredLore: Array.from(nextLore),
  };
  saveArchive(next);
  return next;
}

export function claimChallengeReward(archive: ArchiveSave, challengeId: string): ArchiveSave | null {
  if (archive.claimedChallenges.includes(challengeId)) return null;
  const def = CHALLENGES.find((c) => c.id === challengeId);
  if (!def) return null;
  if (getChallengeProgressValue(archive, def.progressKey) < def.target) return null;

  const next: ArchiveSave = {
    ...archive,
    isotopes: archive.isotopes + def.rewardIso,
    anomalyCores: archive.anomalyCores + (def.rewardCores || 0),
    materials: addMaterialsToBag(archive.materials, def.rewardMats),
    claimedChallenges: [...archive.claimedChallenges, challengeId],
  };
  saveArchive(next);
  return next;
}

export function claimContractReward(archive: ArchiveSave, contractId: string): ArchiveSave | null {
  const st = archive.activeContracts.find((c) => c.id === contractId);
  if (!st || !st.completed || st.claimed) return null;
  const def = CONTRACT_POOL.find((c) => c.id === contractId);
  if (!def) return null;

  const updatedContracts: ActiveContractState[] = archive.activeContracts.map((c) =>
    c.id === contractId ? { ...c, claimed: true } : c
  );

  const next: ArchiveSave = {
    ...archive,
    isotopes: archive.isotopes + def.rewardIso,
    materials: addMaterialsToBag(archive.materials, def.rewardMats),
    activeContracts: updatedContracts,
  };
  saveArchive(next);
  return next;
}

export function refreshCompletedContracts(archive: ArchiveSave): ArchiveSave {
  const activeIds = archive.activeContracts.filter((c) => !c.claimed).map((c) => c.id);
  const rolled = rollInitialContracts(activeIds);
  let rIdx = 0;
  const nextContracts = archive.activeContracts.map((c) => {
    if (!c.claimed) return c;
    const replacement = rolled[rIdx % rolled.length];
    rIdx++;
    return replacement;
  });
  const next: ArchiveSave = { ...archive, activeContracts: nextContracts };
  saveArchive(next);
  return next;
}

export function applyRunResultToArchive(
  current: ArchiveSave,
  summary: RunSummary,
  discoveredInRun: string[],
  isDaily: boolean,
  dailyDateStr: string
): { updated: ArchiveSave; newUnlocks: string[] } {
  const prevLevel = current.rigLevel || getLevelFromXp(current.xp || 0);
  const earnedXp =
    summary.xpEarned ??
    Math.max(
      15,
      summary.depthMeters * 2 +
      summary.maxChain * 25 +
      summary.parries * 45 +
      summary.slagDestroyed * 12 +
      (summary.victory ? 300 : 0)
    );
  const nextXp = (current.xp || 0) + earnedXp;
  const nextLevel = getLevelFromXp(nextXp);

  // Merge mineral stats from this run
  const mergedMinerals: Record<string, MineralRecord> = {};
  for (const [k, v] of Object.entries(current.mineralStats || {})) {
    mergedMinerals[k] = { ...v };
  }
  let runTotalBlocks = 0;
  if (summary.mineralStats) {
    for (const [kind, rec] of Object.entries(summary.mineralStats)) {
      runTotalBlocks += rec.destroyed;
      const prev = mergedMinerals[kind];
      mergedMinerals[kind] = {
        destroyed: (prev?.destroyed || 0) + rec.destroyed,
        deepestRow: Math.max(prev?.deepestRow || 0, rec.deepestRow),
      };
    }
  }

  // Merge earned materials
  const nextMaterials = summary.materialsEarned
    ? addMaterialsToBag(current.materials || EMPTY_MATERIAL_BAG, summary.materialsEarned)
    : { ...(current.materials || EMPTY_MATERIAL_BAG) };

  // Deduct used belt consumables from inventory and clear empty slots
  const nextInventory = { ...(current.gadgetInventory || getDefaultGadgetInventory()) };
  if (summary.consumedBeltSlots && summary.consumedBeltSlots.length > 0) {
    for (const gid of summary.consumedBeltSlots) {
      nextInventory[gid] = Math.max(0, (nextInventory[gid] || 0) - 1);
    }
  }
  const nextBelt = [...(current.equippedBelt || [null, null, null])].map((gid) =>
    gid && (nextInventory[gid] || 0) > 0 ? gid : null
  );

  // Compute newly discovered lore fragments
  const prevLore = new Set(current.discoveredLore || ['LORE_01_BITACORA']);
  const runLore = new Set([...prevLore, ...(summary.discoveredLore || [])]);
  if ((summary.maxCombo || 1) >= 4 || summary.maxChain >= 4) {
    runLore.add('LORE_04_CADENA');
  }
  if ((mergedMinerals.SOLID?.destroyed || 0) >= 25) {
    runLore.add('LORE_02_VETA_ROJA');
  }
  if (summary.parries >= 1) {
    runLore.add('LORE_06_PARRY');
  }
  if ((summary.bouncesTriggered || 0) > 0 || (mergedMinerals.GRAVEL?.destroyed || 0) > 0) {
    runLore.add('LORE_11_GRAVA');
  }
  if ((summary.acidMelts || 0) > 0 || (mergedMinerals.GAS_POCKET?.destroyed || 0) > 0) {
    runLore.add('LORE_12_QUIMICA');
  }
  if ((summary.cachesOpened || 0) > 0) {
    runLore.add('LORE_13_BOVEDAS');
  }
  if ((current.craftedRelics || []).length > 0 || (summary.gadgetsUsed || 0) > 0) {
    runLore.add('LORE_14_FORJA');
  }
  if ((summary.bossesDefeated || 0) > 0) {
    runLore.add('LORE_15_GUARDIANES');
  }
  if (summary.depthMeters >= 3000) {
    runLore.add('LORE_16_CRONOLITO');
  }

  // Merge discovered Artifacts & Operator Mastery
  const prevArtifacts = new Set<ArtifactId>(current.discoveredArtifacts || []);
  const nextArtifacts = new Set<ArtifactId>(prevArtifacts);
  for (const artId of summary.discoveredArtifacts || []) {
    nextArtifacts.add(artId);
  }
  const prevMastery = current.operatorMastery || {};
  const chPrev = prevMastery[summary.chassis] || { runs: 0, maxDepth: 0, blocks: 0, resonanceUses: 0 };
  const nextMastery: Partial<Record<ChassisId, OperatorMasteryRecord>> = {
    ...prevMastery,
    [summary.chassis]: {
      runs: chPrev.runs + 1,
      maxDepth: Math.max(chPrev.maxDepth, summary.depthMeters),
      blocks: chPrev.blocks + runTotalBlocks,
      resonanceUses: chPrev.resonanceUses + (summary.resonanceUsed || 0),
    },
  };

  if (nextArtifacts.size >= 1) runLore.add('LORE_17_COLAPSO_2149');
  if ((current.totalRuns || 0) + 1 >= 3) runLore.add('LORE_18_PRIMERA_BRIGADA');
  if (nextArtifacts.size >= 3) runLore.add('LORE_19_ARTEFACTOS_RELIC');
  if ((summary.resonanceUsed || 0) >= 1) runLore.add('LORE_20_RESONANCIA_OPERADOR');
  if (nextArtifacts.size >= 6 || Object.keys(nextMastery).length >= 2) runLore.add('LORE_21_VANGUARDIA_NORA_BRAM');
  if (nextArtifacts.size >= 8 || summary.depthMeters >= 1200) runLore.add('LORE_22_IGNIS_MANTO');
  if (nextArtifacts.size >= 10 || summary.depthMeters >= 1500) runLore.add('LORE_23_ORSON_CONTENCION');

  // Merge challenge progress
  const nextProgress = { ...(current.challengeProgress || {}) };
  nextProgress.geodesBroken = (nextProgress.geodesBroken || 0) + (summary.geodesBroken || 0);
  nextProgress.bouncesTriggered = (nextProgress.bouncesTriggered || 0) + (summary.bouncesTriggered || 0);
  nextProgress.acidMelts = (nextProgress.acidMelts || 0) + (summary.acidMelts || 0);
  nextProgress.cachesOpened = (nextProgress.cachesOpened || 0) + (summary.cachesOpened || 0);
  nextProgress.bossesDefeated = (nextProgress.bossesDefeated || 0) + (summary.bossesDefeated || 0);
  nextProgress.gadgetsUsed = (nextProgress.gadgetsUsed || 0) + (summary.gadgetsUsed || 0);
  nextProgress.resonanceUsed = (nextProgress.resonanceUsed || 0) + (summary.resonanceUsed || 0);
  nextProgress.artifactsFound = nextArtifacts.size;

  // Advance rotating contracts
  const nextContracts: ActiveContractState[] = (current.activeContracts || []).map((st) => {
    if (st.claimed || st.completed) return st;
    const def = CONTRACT_POOL.find((d) => d.id === st.id);
    if (!def) return st;
    let delta = 0;
    let isMaxMetric = false;
    switch (def.metric) {
      case 'DEPTH':
        delta = summary.depthMeters;
        break;
      case 'SLAG':
        delta = summary.slagDestroyed;
        break;
      case 'GEODES':
        delta = summary.geodesBroken || 0;
        break;
      case 'PARRIES':
        delta = summary.parries;
        break;
      case 'COMBO':
        delta = summary.maxCombo || 1;
        isMaxMetric = true;
        break;
      case 'CHAIN':
        delta = summary.maxChain;
        isMaxMetric = true;
        break;
      case 'BOUNCES':
        delta = summary.bouncesTriggered || 0;
        break;
      case 'CACHES':
        delta = summary.cachesOpened || 0;
        break;
    }
    const nextVal = isMaxMetric ? Math.max(st.progress, delta) : st.progress + delta;
    return {
      ...st,
      progress: Math.min(def.target, nextVal),
      completed: nextVal >= def.target,
    };
  });

  // Unlock chapters by depth reached
  const chapterFromDepth =
    summary.depthMeters >= 3000
      ? 7
      : summary.depthMeters >= 2500
        ? 6
        : summary.depthMeters >= 2000
          ? 5
          : summary.depthMeters >= 1500
            ? 4
            : summary.depthMeters >= 1000
              ? 3
              : summary.depthMeters >= 500
                ? 2
                : 1;

  const next: ArchiveSave = {
    ...current,
    xp: nextXp,
    rigLevel: nextLevel,
    rigUpgrades: { ...current.rigUpgrades },
    infra: { ...current.infra },
    unlockedChassis: [...current.unlockedChassis],
    unlockedModules: [...current.unlockedModules],
    discoveredCodex: Array.from(new Set([...current.discoveredCodex, ...discoveredInRun])),
    discoveredLore: Array.from(runLore),
    mineralStats: mergedMinerals,
    totalRuns: (current.totalRuns || 0) + 1,
    totalBlocksDestroyed: (current.totalBlocksDestroyed || 0) + runTotalBlocks,
    bestCombo: Math.max(current.bestCombo || 1, summary.maxCombo || 1),
    materials: nextMaterials,
    gadgetInventory: nextInventory,
    equippedBelt: nextBelt,
    seenStoryIds: Array.from(new Set([...(current.seenStoryIds || []), ...(summary.seenStoryIds || [])])),
    storyChoices: { ...(current.storyChoices || {}), ...(summary.storyChoicesMade || {}) },
    unlockedChapters: Math.max(current.unlockedChapters || 1, chapterFromDepth),
    challengeProgress: nextProgress,
    activeContracts: nextContracts,
    completedTrials: [...(current.completedTrials || [])],
    discoveredArtifacts: Array.from(nextArtifacts),
    claimedArtifactMilestones: [...(current.claimedArtifactMilestones || [])],
    architectCrownUnlocked: Boolean(current.architectCrownUnlocked),
    operatorMastery: nextMastery,
  };

  const newUnlocks: string[] = [];
  if (nextLevel > prevLevel) {
    newUnlocks.push(`Evolución de Chasis: Nivel de Piloto ${nextLevel} alcanzado`);
  }

  for (const artId of nextArtifacts) {
    if (!prevArtifacts.has(artId)) {
      const def = ARTIFACTS.find((a) => a.id === artId);
      if (def) {
        newUnlocks.push(`Artefacto hallado: ${def.name}`);
      }
    }
  }

  for (const fragId of runLore) {
    if (!prevLore.has(fragId)) {
      const def = LORE_FRAGMENTS.find((f) => f.id === fragId);
      if (def) {
        newUnlocks.push(`Archivo recuperado: ${def.title}`);
      }
    }
  }

  next.isotopes += summary.isotopesSaved;
  next.anomalyCores += summary.anomalyCoresEarned;
  next.totalSlagDestroyed += summary.slagDestroyed;
  next.totalParries += summary.parries;
  if (summary.maxChain > next.bestChain) next.bestChain = summary.maxChain;

  if (summary.mode === 'CAMPAIGN') {
    if (summary.depthMeters > next.maxDepthCampaign) {
      next.maxDepthCampaign = summary.depthMeters;
    }
    if (summary.victory) {
      next.campaignWins += 1;
      if (summary.ascension >= next.maxAscensionUnlocked && next.maxAscensionUnlocked < 10) {
        next.maxAscensionUnlocked += 1;
        newUnlocks.push(`Protocolo de Profundidad Nivel ${next.maxAscensionUnlocked}`);
      }
      if (next.campaignWins >= 1 && next.infra.elevatorUnlock < 1) {
        next.infra.elevatorUnlock = 1;
        newUnlocks.push('Ascensor de Estrato (500 m)');
      }
    }
  } else if (summary.mode === 'ENDLESS') {
    if (summary.depthMeters > next.maxDepthEndless) {
      next.maxDepthEndless = summary.depthMeters;
    }
  } else if (summary.mode === 'SPRINT_500' && summary.victory) {
    if (next.bestSprintSeconds === null || summary.durationSeconds < next.bestSprintSeconds) {
      next.bestSprintSeconds = summary.durationSeconds;
    }
  } else if (summary.mode === 'TRIAL' && summary.victory && summary.trialId) {
    if (!next.completedTrials.includes(summary.trialId)) {
      next.completedTrials.push(summary.trialId);
      newUnlocks.push(`Prueba de Élite completada: ${summary.trialId}`);
    }
  }

  // Unlock deep elevator automatically when chapter thresholds are cleared
  const minElevatorFromChapter = Math.min(5, Math.max(0, next.unlockedChapters - 1));
  if (minElevatorFromChapter > next.infra.elevatorUnlock) {
    next.infra.elevatorUnlock = minElevatorFromChapter;
  }

  if (isDaily) {
    next.dailyCompletedDate = dailyDateStr;
    if (summary.depthMeters > next.dailyBestDepth) {
      next.dailyBestDepth = summary.depthMeters;
    }
  }

  // Ghost Echo persistence on death
  if (!summary.victory && summary.modules.length > 0 && summary.depthMeters >= 60) {
    const lostModule = summary.modules[summary.modules.length - 1];
    next.lastDeathEcho = {
      depth: summary.depthMeters,
      moduleId: lostModule.id,
    };
  } else if (summary.victory) {
    next.lastDeathEcho = null;
  }

  // Chassis unlocks
  const unlockChassis = (id: ChassisId, label: string) => {
    if (!next.unlockedChassis.includes(id)) {
      next.unlockedChassis.push(id);
      newUnlocks.push(`Personaje desbloqueado: ${label}`);
    }
  };

  if (summary.depthMeters >= 400) {
    unlockChassis('MKII_ESPECTRO', 'Sable · Espectro');
  }
  if (next.totalSlagDestroyed >= 220 && (getBestDepth(next) >= 350 || summary.depthMeters >= 350)) {
    unlockChassis('MKIII_YUNQUE', 'Bram · Yunque');
  }
  if ((summary.maxChain >= 4 && getBestDepth(next) >= 550) || summary.depthMeters >= 750) {
    unlockChassis('MKVII_PIRO', 'Ignis · Crisol');
  }
  if ((summary.parries >= 6 && getBestDepth(next) >= 800) || summary.depthMeters >= 1000) {
    unlockChassis('MKIV_METRONOMO', 'Lyra · Cadencia');
  }
  if ((nextProgress.bossesDefeated || 0) >= 2 || summary.depthMeters >= 1400) {
    unlockChassis('MKV_TITAN', 'Orson · Titán');
  }
  if (summary.depthMeters >= 2000) {
    unlockChassis('MKVI_QUANTUM', 'Vex · Cuántico');
  }

  saveArchive(next);
  return { updated: next, newUnlocks };
}

export function buyChassisUnlock(archive: ArchiveSave, id: ChassisId): ArchiveSave | null {
  const def = CHASSIS_LIST.find((c) => c.id === id);
  if (!def) return null;
  if (archive.unlockedChassis.includes(id)) return null;
  if (getBestDepth(archive) < (def.minDepth ?? 0)) return null;
  const cost = def.unlockIsoCost ?? 0;
  if (cost <= 0 || archive.isotopes < cost) return null;
  const next: ArchiveSave = {
    ...archive,
    isotopes: archive.isotopes - cost,
    unlockedChassis: [...archive.unlockedChassis, id],
    selectedChassis: id,
  };
  saveArchive(next);
  return next;
}
