import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Lock, RefreshCw, Sparkles } from 'lucide-react';
import {
  ArchiveSave,
  ArtifactId,
  ChassisId,
  COYOTE_CRUSH_FRAMES,
  GadgetId,
  MaterialId,
  MineralSpecDef,
  RelicId,
  RigPose,
  RigUpgrades,
  StorySpeaker,
} from '../types/game';
import {
  ARCHETYPE_COLORS,
  ARCHETYPE_LABELS,
  CHASSIS_LIST,
  CODEX_ENTRIES,
  LORE_FRAGMENTS,
  MINERAL_SPECS,
  MODULES,
  OVERCHARGES,
  RIG_UPGRADES,
  STRATA,
} from '../data/catalog';
import {
  ARCHITECT_EPILOGUE,
  ARTIFACT_MILESTONES,
  ARTIFACTS,
  getArtifactPermanentBonuses,
} from '../data/collectibles';
import {
  CHALLENGES,
  CONTRACT_POOL,
  GADGETS,
  MATERIALS,
  RELICS,
} from '../data/crafting';
import { CAMPAIGN_CHAPTERS, SPEAKER_PROFILES, STORY_TRANSMISSIONS } from '../data/story';
import {
  buyChassisUnlock,
  canAffordMaterials,
  claimArtifactMilestone,
  claimChallengeReward,
  claimContractReward,
  craftGadget,
  craftRelic,
  getChallengeProgressValue,
  getMaxBeltSlots,
  getMaxRelicSlots,
  getOperatorMasteryRank,
  getXpForNextLevel,
  refreshCompletedContracts,
  saveArchive,
  setBeltSlot,
  toggleEquipRelic,
} from '../storage/archive';
import { drawCharacterAccessory, drawExoRigAvatar } from '../engine/renderer';
import { createScarfNodes, stepScarfNodes } from '../engine/fx';
import {
  getAcidVatBlockSprite,
  getArtifactIconSprite,
  getBouncePadBlockSprite,
  getCharacterPortraitSprite,
  getConductorBlockSprite,
  getCryoVentBlockSprite,
  getCrystalBlockSprite,
  getExoRigPixelSprite,
  getGasPocketBlockSprite,
  getGeodeBlockSprite,
  getGravelBlockSprite,
  getGravWellBlockSprite,
  getMagmaNodeBlockSprite,
  getMaterialIconSprite,
  getMineralBlockSprite,
  getOxygenPodSprite,
  getPhaseBlockSprite,
  getShockMineBlockSprite,
  getSlagBlockSprite,
  getTreasureCacheBlockSprite,
} from '../engine/pixelArt';
import { soundEngine } from '../engine/audio';

interface ArchiveHubProps {
  archive: ArchiveSave;
  initialTab?: ArchiveTab;
  onUpdateArchive: (next: ArchiveSave) => void;
  onBack: () => void;
  onLaunchRun: () => void;
  onLaunchChapter: (startDepth: number) => void;
}

type ArchiveTab =
  | 'SHOP'
  | 'FORGE'
  | 'CHASSIS'
  | 'CALIBRATION'
  | 'CATALOG'
  | 'CHALLENGES'
  | 'CAMPAIGN'
  | 'ARTIFACTS'
  | 'DISCOVERIES';
type DiscoveryFilter = 'ALL' | 'MINERALS' | 'LORE' | 'CODEX';
type ModuleFilter = 'ALL' | 'PIROLITICO' | 'BALISTICO' | 'PARASITO' | 'CUANTICO' | 'OVERCHARGE';
type PreviewMode = 'IDLE' | 'WALK' | 'DRILL_STRIKE' | 'OVERDRIVE';

const ArtifactSpriteThumb: React.FC<{ artifactId: ArtifactId; discovered: boolean; size?: number }> = ({
  artifactId,
  discovered,
  size = 40,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const spr = getArtifactIconSprite(artifactId);
    ctx.drawImage(spr, 0, 0, size, size);
    if (!discovered) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(10, 11, 16, 0.88)';
      ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [artifactId, discovered, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="pixel-canvas shrink-0 border-2 border-[#262834] bg-[#0B0C10]"
    />
  );
};

const MaterialIconThumb: React.FC<{ matId: MaterialId; size?: number }> = ({ matId, size = 24 }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    const spr = getMaterialIconSprite(matId);
    ctx.drawImage(spr, 0, 0, size, size);
  }, [matId, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="pixel-canvas shrink-0 inline-block"
    />
  );
};

const PortraitCanvas: React.FC<{ speaker: StorySpeaker; size?: number }> = ({ speaker, size = 48 }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let id = 0;
    const tick = (now: number) => {
      const c = ref.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, size, size);
          const f = Math.floor((now / 1000) * 4) & 3;
          ctx.drawImage(getCharacterPortraitSprite(speaker, f), 0, 0, size, size);
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [speaker, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="border-2 border-[#2B2D38] bg-[#0B0C10] pixel-canvas shrink-0"
    />
  );
};

const ChassisPreviewMini: React.FC<{
  chassisId: ChassisId;
  upgrades: RigUpgrades;
  rigLevel: number;
  locked: boolean;
}> = ({ chassisId, upgrades, rigLevel, locked }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const scarfRef = useRef(createScarfNodes(0, 0, 6));
  useEffect(() => {
    let id = 0;
    const tick = (now: number) => {
      const c = ref.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, 56, 56);
          const t = now / 1000;
          const f = Math.floor(t * 6) & 3;
          if (!locked) {
            stepScarfNodes(scarfRef.current, 0, 0, 1, 2.2, 1.5, t, false, chassisId);
            drawCharacterAccessory(ctx, scarfRef.current, 24, 24, 30, false, chassisId, t);
          }
          const spr = getExoRigPixelSprite({
            chassis: chassisId,
            upgrades,
            rigLevel,
            pose: locked ? 'IDLE' : 'WALK',
            animFrame: f,
            aimDir: 'DOWN',
            facing: 1,
            tintColor: locked ? '#27272A' : undefined,
          });
          ctx.drawImage(spr, 2, 2, 52, 52);
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [
    chassisId,
    upgrades.drillTier,
    upgrades.thrusterTier,
    upgrades.tankTier,
    upgrades.armorTier,
    upgrades.capacitorTier,
    upgrades.magnetTier,
    rigLevel,
    locked,
  ]);

  return (
    <canvas
      ref={ref}
      width={56}
      height={56}
      className="w-14 h-14 bg-[#0D0E14] border border-[#2B2D38] pixel-canvas shrink-0"
    />
  );
};

const MineralSpriteThumb: React.FC<{
  kind: MineralSpecDef['kind'];
  discovered: boolean;
}> = ({ kind, discovered }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let id = 0;
    const tick = (now: number) => {
      const c = ref.current;
      if (c) {
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, 48, 48);
          const f = Math.floor((now / 1000) * 6) & 3;
          let spr: HTMLCanvasElement;
          if (kind === 'SLAG') spr = getSlagBlockSprite(STRATA[0].slagColor, 5, false, 0, f, false);
          else if (kind === 'CRYSTAL') spr = getCrystalBlockSprite(STRATA[1].blockColors[0], 0, false, f);
          else if (kind === 'CONDUCTOR') spr = getConductorBlockSprite(f, false);
          else if (kind === 'PHASE') spr = getPhaseBlockSprite(STRATA[4].blockColors[0], STRATA[2].blockColors[2], 2, false, f);
          else if (kind === 'OXYGEN') spr = getOxygenPodSprite(f);
          else if (kind === 'GEODE') spr = getGeodeBlockSprite(f);
          else if (kind === 'CRYO_VENT') spr = getCryoVentBlockSprite(f);
          else if (kind === 'MAGMA_NODE') spr = getMagmaNodeBlockSprite(f);
          else if (kind === 'GRAVEL') spr = getGravelBlockSprite(0);
          else if (kind === 'BOUNCE_PAD') spr = getBouncePadBlockSprite(f, false);
          else if (kind === 'GAS_POCKET') spr = getGasPocketBlockSprite(f);
          else if (kind === 'ACID_VAT') spr = getAcidVatBlockSprite(f);
          else if (kind === 'GRAV_WELL') spr = getGravWellBlockSprite(f);
          else if (kind === 'SHOCK_MINE') spr = getShockMineBlockSprite(f, f >= 2);
          else if (kind === 'TREASURE_CACHE') spr = getTreasureCacheBlockSprite(f);
          else spr = getMineralBlockSprite(1, STRATA[0].blockColors[0], 0, 0, 0, false);

          ctx.globalAlpha = discovered ? 1 : 0.3;
          ctx.drawImage(spr, 2, 2, 44, 44);
          ctx.globalAlpha = 1;
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [kind, discovered]);

  return (
    <canvas
      ref={ref}
      width={48}
      height={48}
      className="w-12 h-12 bg-[#0D0E14] border border-[#2B2D38] pixel-canvas shrink-0"
    />
  );
};

const MaterialCostBadges: React.FC<{
  bag: ArchiveSave['materials'];
  cost: Partial<Record<MaterialId, number>>;
}> = ({ bag, cost }) => {
  const entries = Object.entries(cost) as [MaterialId, number][];
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.map(([mId, need]) => {
        const have = bag[mId] || 0;
        const ok = have >= need;
        const def = MATERIALS.find((m) => m.id === mId);
        return (
          <span
            key={mId}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[11px] font-mono tabular-nums ${
              ok ? 'border-[#2E3846] bg-[#10131C] text-white' : 'border-[#7F1D1D] bg-[#201015] text-[#FDA4AF]'
            }`}
            title={def?.name}
          >
            <MaterialIconThumb matId={mId} size={14} />
            <span>
              {have}/{need}
            </span>
          </span>
        );
      })}
    </div>
  );
};

export const ArchiveHub: React.FC<ArchiveHubProps> = ({
  archive,
  initialTab = 'SHOP',
  onUpdateArchive,
  onBack,
  onLaunchRun,
  onLaunchChapter,
}) => {
  const [tab, setTab] = useState<ArchiveTab>(initialTab);
  const [discoveryFilter, setDiscoveryFilter] = useState<DiscoveryFilter>('ALL');
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('ALL');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('IDLE');
  const [activeBeltPicker, setActiveBeltPicker] = useState<number>(0);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scarfRef = useRef(createScarfNodes(0, 0, 6));

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [tab]);

  const commit = (next: ArchiveSave) => {
    saveArchive(next);
    onUpdateArchive(next);
  };

  const rawRig = (archive.rigUpgrades || {}) as Partial<RigUpgrades>;
  const rigUpgrades: RigUpgrades = {
    drillTier: rawRig.drillTier ?? 0,
    thrusterTier: rawRig.thrusterTier ?? 0,
    tankTier: rawRig.tankTier ?? 0,
    armorTier: rawRig.armorTier ?? 0,
    capacitorTier: rawRig.capacitorTier ?? 0,
    magnetTier: rawRig.magnetTier ?? 0,
  };
  const rigLevel = Math.max(1, archive.rigLevel || 1);
  const currentXp = archive.xp || 0;
  const prevLevelXp = rigLevel <= 1 ? 0 : getXpForNextLevel(rigLevel - 1);
  const nextLevelXp = getXpForNextLevel(rigLevel);
  const xpProgress =
    rigLevel >= 30
      ? 100
      : Math.max(0, Math.min(100, Math.round(((currentXp - prevLevelXp) / Math.max(1, nextLevelXp - prevLevelXp)) * 100)));

  const activeChassis = CHASSIS_LIST.find((c) => c.id === archive.selectedChassis) || CHASSIS_LIST[0];
  const maxRelicSlots = getMaxRelicSlots(archive);
  const maxBeltSlots = getMaxBeltSlots(archive);

  useEffect(() => {
    if (tab !== 'SHOP') return;
    let animId = 0;
    const renderPreview = (now: number) => {
      const canvas = previewCanvasRef.current;
      if (canvas) {
        const w = 240;
        const h = 240;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, w, h);

          ctx.fillStyle = '#0D0E14';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          for (let g = 16; g < w; g += 16) {
            ctx.fillRect(g, 0, 1, h);
            ctx.fillRect(0, g, w, 1);
          }

          const isOd = previewMode === 'OVERDRIVE';
          ctx.fillStyle = isOd ? 'rgba(250,204,21,0.22)' : 'rgba(56,189,248,0.14)';
          ctx.fillRect(Math.round(w * 0.5 - 56), Math.round(h * 0.78), 112, 10);
          ctx.fillStyle = isOd ? '#FACC15' : '#38BDF8';
          ctx.fillRect(Math.round(w * 0.5 - 46), Math.round(h * 0.78), 92, 2);

          const t = now / 1000;
          const bob = Math.round(Math.sin(t * (previewMode === 'WALK' ? 8 : 2.6)) * (previewMode === 'IDLE' ? 2 : 3));

          stepScarfNodes(
            scarfRef.current,
            0,
            0,
            1,
            previewMode === 'WALK' ? 5 : isOd ? 7 : 0.4,
            previewMode === 'DRILL_STRIKE' ? 2 : 0,
            t,
            isOd,
            archive.selectedChassis
          );
          const rx = Math.round(w * 0.5);
          const ry = Math.round(h * 0.45 + bob);

          drawCharacterAccessory(ctx, scarfRef.current, rx - 14, ry - 10, 95, isOd, archive.selectedChassis, t);

          const pose: RigPose = previewMode === 'OVERDRIVE' ? 'DRILL_STRIKE' : previewMode;

          ctx.save();
          ctx.translate(rx, ry);
          drawExoRigAvatar(ctx, {
            chassis: archive.selectedChassis,
            upgrades: rigUpgrades,
            rigLevel,
            timeSec: t,
            cellSize: 102,
            aimAngle: Math.PI * 0.5,
            facing: 1,
            aimDir: 'DOWN',
            pose,
            isFalling: false,
            hasPyro: isOd,
            hasShield: rigUpgrades.armorTier >= 2 || (activeChassis.starterShields || 0) > 0,
            anvilShield: (archive.equippedRelics || []).includes('REL_GRAV_ANCHOR'),
            overdriveActive: isOd,
            oxygenRatio: 1,
            showO2Ring: true,
          });
          ctx.restore();

          ctx.fillStyle = 'rgba(0,0,0,0.16)';
          for (let sy = 0; sy < h; sy += 3) {
            ctx.fillRect(0, sy, w, 1);
          }
        }
      }
      animId = requestAnimationFrame(renderPreview);
    };
    animId = requestAnimationFrame(renderPreview);
    return () => cancelAnimationFrame(animId);
  }, [
    tab,
    previewMode,
    archive.selectedChassis,
    rigLevel,
    rigUpgrades.drillTier,
    rigUpgrades.thrusterTier,
    rigUpgrades.tankTier,
    rigUpgrades.armorTier,
    rigUpgrades.capacitorTier,
    rigUpgrades.magnetTier,
  ]);

  const buyRigUpgrade = (key: keyof RigUpgrades, cost: number) => {
    const curTier = rigUpgrades[key] || 0;
    if (curTier >= 5 || archive.isotopes < cost) return;
    soundEngine.init();
    soundEngine.playSeismicSeal();
    commit({
      ...archive,
      isotopes: archive.isotopes - cost,
      rigUpgrades: {
        ...rigUpgrades,
        [key]: curTier + 1,
      },
    });
  };

  const selectChassis = (id: ChassisId) => {
    if (!archive.unlockedChassis.includes(id)) return;
    soundEngine.init();
    soundEngine.playUiClick();
    commit({ ...archive, selectedChassis: id });
  };

  const buyInfra = (
    key:
      | 'reroll'
      | 'banish'
      | 'initialInjection'
      | 'salvageCapsule'
      | 'elevatorUnlock'
      | 'relicSlots'
      | 'beltSlots'
      | 'supplyDrop',
    costIsotopes: number,
    maxLevel: number
  ) => {
    if (archive.isotopes < costIsotopes || (archive.infra[key] || 0) >= maxLevel) return;
    soundEngine.init();
    soundEngine.playSeismicSeal();
    commit({
      ...archive,
      isotopes: archive.isotopes - costIsotopes,
      infra: {
        ...archive.infra,
        [key]: (archive.infra[key] || 0) + 1,
      },
    });
  };

  const unlockModule = (id: string, cost: number) => {
    if (archive.isotopes < cost || archive.unlockedModules.includes(id)) return;
    soundEngine.init();
    soundEngine.playSeismicSeal();
    commit({
      ...archive,
      isotopes: archive.isotopes - cost,
      unlockedModules: [...archive.unlockedModules, id],
    });
  };

  const maxBanishAllowed =
    archive.infra.banish === 0 ? 0 : archive.infra.banish === 1 ? 2 : archive.infra.banish === 2 ? 4 : 8;

  const toggleBanishModule = (id: string) => {
    if (maxBanishAllowed === 0) return;
    soundEngine.init();
    soundEngine.playUiClick();
    const isBanished = archive.banishedModules.includes(id);
    if (isBanished) {
      commit({
        ...archive,
        banishedModules: archive.banishedModules.filter((m) => m !== id),
      });
    } else if (archive.banishedModules.length < maxBanishAllowed) {
      commit({
        ...archive,
        banishedModules: [...archive.banishedModules, id],
      });
    }
  };

  const claimableChallengesCount = CHALLENGES.filter(
    (c) => !archive.claimedChallenges.includes(c.id) && getChallengeProgressValue(archive, c.progressKey) >= c.target
  ).length;
  const claimableContractsCount = (archive.activeContracts || []).filter((c) => c.completed && !c.claimed).length;
  const discoveredArtifactsList = archive.discoveredArtifacts || [];
  const claimedMilestonesList = archive.claimedArtifactMilestones || [];
  const claimableArtifactsCount = ARTIFACT_MILESTONES.filter(
    (m) => discoveredArtifactsList.length >= m.required && !claimedMilestonesList.includes(m.id)
  ).length;

  return (
    <div className="h-screen w-full bg-[#0E0F14] text-[#F2EFE9] flex flex-col overflow-hidden">
      {/* Sticky Non-Shrinking 2-Row Arcade Header */}
      <header className="shrink-0 bg-[#12131A] border-b-2 border-[#262834] z-20">
        {/* Top Row: Back + Title + Currencies + Launch */}
        <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4 border-b border-[#1D1F2A]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="pixel-btn px-2.5 py-1 flex items-center gap-1.5 text-xs font-pixel text-[#A1A1AA] hover:text-white cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Inicio
            </button>
            <span className="font-pixel text-xs sm:text-sm font-bold tracking-wider uppercase text-white truncate">
              Taller, Tienda y Archivo
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2.5 text-xs font-mono tabular-nums text-[#A1A1AA] px-3 py-1 bg-[#0D0E14] border border-[#262834]">
              <span className="text-[#FACC15] font-bold">{archive.isotopes} ISO</span>
              <span className="text-[#3F3F46]">·</span>
              <span className="text-[#C084FC] font-bold">{archive.anomalyCores} NÚCL</span>
              <span className="text-[#3F3F46]">·</span>
              <span className="text-[#38BDF8] font-bold">NIV.{rigLevel}</span>
            </div>
            <button
              onClick={onLaunchRun}
              className="pixel-btn-primary px-4 py-1.5 text-white font-pixel text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              Descender
            </button>
          </div>
        </div>

        {/* Second Row: Full Wrapping Navigation Tabs (Zero horizontal clipping!) */}
        <nav className="px-4 sm:px-6 py-2 bg-[#0B0C10] flex flex-wrap items-center gap-1.5">
          {(
            [
              ['SHOP', 'Equipo (0–5)'],
              ['FORGE', 'Taller y Reliquias'],
              ['CHASSIS', `Personajes (${archive.unlockedChassis.length}/${CHASSIS_LIST.length})`],
              ['CALIBRATION', 'Infraestructura'],
              ['CATALOG', `Módulos (${archive.unlockedModules.length}/${MODULES.length})`],
              ['CHALLENGES', `Retos${claimableChallengesCount + claimableContractsCount > 0 ? ` (${claimableChallengesCount + claimableContractsCount}!)` : ''}`],
              ['CAMPAIGN', 'Mapa e Historia'],
              ['ARTIFACTS', `Artefactos (${discoveredArtifactsList.length}/14)${claimableArtifactsCount > 0 ? ` (${claimableArtifactsCount}!)` : ''}`],
              ['DISCOVERIES', 'Archivo y Códice'],
            ] as [ArchiveTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                soundEngine.playUiClick();
                setTab(id);
              }}
              className={`px-3 py-1.5 font-pixel text-[10px] border-2 transition-colors cursor-pointer whitespace-nowrap ${
                tab === id
                  ? 'border-[#EE4E34] bg-[#241517] text-[#FACC15]'
                  : 'border-[#232530] bg-[#14151C] text-[#A1A1AA] hover:text-white hover:border-[#3F4354]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* Dedicated Bulletproof Scroll Container */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24">
          {/* ==================== TAB 1: EQUIPO (6 TRACKS x TIER 0..5) ==================== */}
          {tab === 'SHOP' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-2 border-[#232530] pb-4">
                <div>
                  <h1 className="font-display text-3xl font-bold text-white">Tienda de Equipo y Evolución</h1>
                  <p className="text-sm text-[#A1A1AA] mt-1">
                    Seis subsistemas mejorables hasta Grado 5. Cada avance transforma las capacidades y el sprite de tu Exo-Rig.
                  </p>
                </div>
                <div className="font-pixel text-xs tabular-nums text-[#FACC15]">
                  SALDO: {archive.isotopes} ISÓTOPOS
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Live Animated Preview */}
                <aside className="lg:col-span-4 pixel-panel p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-pixel text-[10px] text-[#71717A]">{activeChassis.code}</div>
                      <h2 className="font-display text-2xl font-bold text-white">{activeChassis.name}</h2>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <div className="font-pixel text-[9px] text-[#71717A]">PILOTO</div>
                      <div className="font-pixel text-sm font-bold text-[#FACC15]">NIV.{rigLevel}</div>
                    </div>
                  </div>

                  <div className="flex justify-center border-2 border-[#262834] bg-[#0B0C10]">
                    <canvas
                      ref={previewCanvasRef}
                      width={240}
                      height={240}
                      className="w-[240px] h-[240px] block pixel-canvas"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        ['IDLE', 'REPOSO'],
                        ['WALK', 'CORRER'],
                        ['DRILL_STRIKE', 'TALADRO'],
                        ['OVERDRIVE', 'OVERDR.'],
                      ] as [PreviewMode, string][]
                    ).map(([pm, label]) => (
                      <button
                        key={pm}
                        onClick={() => {
                          soundEngine.playUiClick();
                          setPreviewMode(pm);
                        }}
                        className={`py-1.5 font-pixel text-[9px] border cursor-pointer transition-colors ${
                          previewMode === pm
                            ? 'border-[#FACC15] bg-[#FACC15]/20 text-[#FACC15]'
                            : 'border-[#2B2D38] bg-[#101117] text-[#A1A1AA] hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono tabular-nums text-[#A1A1AA]">
                      <span>Experiencia (Máx 30)</span>
                      <span>{rigLevel >= 30 ? 'MÁXIMO' : `${currentXp} / ${nextLevelXp} XP`}</span>
                    </div>
                    <div className="w-full h-2.5 bg-[#09090B] border border-[#2B2D38] overflow-hidden">
                      <div className="h-full bg-[#38BDF8] pixel-bar-seg transition-all" style={{ width: `${xpProgress}%` }} />
                    </div>
                  </div>

                  <div className="border-t-2 border-[#232530] pt-3.5 space-y-2 text-xs font-mono tabular-nums">
                    <div className="flex justify-between">
                      <span className="text-[#A1A1AA] font-sans">Oxígeno máximo</span>
                      <span className="text-[#38BDF8]">
                        {activeChassis.maxOxygen + rigUpgrades.tankTier * 15 + Math.max(0, (rigLevel - 1) * 2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A1A1AA] font-sans">Velocidad lateral</span>
                      <span className="text-white">
                        {Math.round(
                          activeChassis.moveSpeedMult *
                            (1 + rigUpgrades.thrusterTier * 0.08 + Math.min(0.15, (rigLevel - 1) * 0.015)) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A1A1AA] font-sans">Potencia vs Escoria</span>
                      <span className="text-[#F97316]">
                        {1 + (rigUpgrades.drillTier >= 5 ? 2 : rigUpgrades.drillTier >= 2 ? 1 : 0)} daño/golpe
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A1A1AA] font-sans">Ventana Corte Cinético</span>
                      <span className="text-[#A3E635]">{COYOTE_CRUSH_FRAMES + rigUpgrades.armorTier * 2} frames</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A1A1AA] font-sans">Duración Overdrive</span>
                      <span className="text-[#FACC15]">{(6 + (rigUpgrades.capacitorTier || 0) * 0.8).toFixed(1)} s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A1A1AA] font-sans">Escudos iniciales</span>
                      <span className="text-[#A3E635]">
                        {rigUpgrades.armorTier >= 4 ? '+2' : rigUpgrades.armorTier >= 2 ? '+1' : '0'}
                      </span>
                    </div>
                  </div>
                </aside>

                {/* 6 Upgradable Hardware Tracks Tier 0..5 */}
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {RIG_UPGRADES.map((upg) => {
                    const tier = Math.min(5, rigUpgrades[upg.key] || 0);
                    const maxed = tier >= 5;
                    const nextCost = maxed ? 0 : upg.costs[tier];
                    const canAfford = !maxed && archive.isotopes >= nextCost;
                    const curInfo = upg.tiers[tier];
                    const nextInfo = !maxed ? upg.tiers[tier + 1] : null;

                    return (
                      <div key={upg.key} className="pixel-panel p-5 flex flex-col justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between font-pixel text-[10px]">
                            <span className="text-[#71717A]">{upg.slotLabel}</span>
                            <span className="text-[#FACC15] tabular-nums">GRADO {tier}/5</span>
                          </div>

                          <div>
                            <h3 className="font-display text-2xl font-bold text-white">{upg.name}</h3>
                            <div className="text-xs font-semibold text-[#38BDF8] mt-0.5">{curInfo.title}</div>
                          </div>

                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((lv) => (
                              <span
                                key={lv}
                                className={`h-1.5 flex-1 ${lv <= tier ? 'bg-[#FACC15]' : 'bg-[#232530]'}`}
                              />
                            ))}
                          </div>

                          <div className="p-3 bg-[#101117] border border-[#232530] space-y-1 text-xs">
                            <div className="text-[#D4D4D8]">{curInfo.physical}</div>
                            <div className="text-[#71717A]">Aspecto: {curInfo.visual}</div>
                          </div>

                          {nextInfo && (
                            <div className="text-xs text-[#A1A1AA] space-y-0.5">
                              <div className="text-white font-medium">Siguiente → {nextInfo.title}</div>
                              <div>{nextInfo.physical}</div>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t-2 border-[#232530] flex items-center justify-between gap-3">
                          <span className="font-pixel text-[11px] tabular-nums text-[#FACC15]">
                            {maxed ? 'AL MÁXIMO' : `${nextCost} ISO`}
                          </span>
                          {!maxed && (
                            <button
                              onClick={() => buyRigUpgrade(upg.key, nextCost)}
                              disabled={!canAfford}
                              className={`px-4 py-2 font-pixel text-[10px] font-bold cursor-pointer ${
                                canAfford
                                  ? 'pixel-btn-primary text-white'
                                  : 'bg-[#20222C] border-2 border-[#2B2D38] text-[#71717A] cursor-not-allowed'
                              }`}
                            >
                              MEJORAR
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 2: TALLER Y FORJA (RELIQUIAS + GADGETS) ==================== */}
          {tab === 'FORGE' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-2 border-[#232530] pb-4">
                <div>
                  <h1 className="font-display text-3xl font-bold text-white">Taller de Forja y Armamento Táctico</h1>
                  <p className="text-sm text-[#A1A1AA] mt-1">
                    Refina minerales en bruto extraídos del subsuelo para forjar Reliquias pasivas y Artilugios activos (teclas 1, 2 y 3).
                  </p>
                </div>
                <div className="font-pixel text-xs tabular-nums text-[#FACC15]">
                  SALDO: {archive.isotopes} ISO
                </div>
              </div>

              {/* Materials Inventory Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {MATERIALS.map((mat) => (
                  <div key={mat.id} className="pixel-panel p-3 flex items-center gap-3" title={mat.dropSource}>
                    <MaterialIconThumb matId={mat.id} size={28} />
                    <div className="min-w-0">
                      <div className="font-pixel text-[10px] truncate" style={{ color: mat.accent }}>
                        {mat.name.split(' ')[0].toUpperCase()}
                      </div>
                      <div className="font-mono text-lg font-bold text-white tabular-nums">
                        {archive.materials[mat.id] || 0}
                      </div>
                      <div className="text-[10px] text-[#71717A] truncate">{mat.formula}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Relics Section */}
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white">Reliquias Pasivas de Expedición</h2>
                    <p className="text-xs text-[#A1A1AA]">
                      Forja permanentes con materiales raros. Ranuras activas: {archive.equippedRelics.length} / {maxRelicSlots} (amplía en Infraestructura).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 3 }).map((_, idx) => {
                      const unlocked = idx < maxRelicSlots;
                      const rId = unlocked ? archive.equippedRelics[idx] : undefined;
                      const rDef = rId ? RELICS.find((r) => r.id === rId) : null;
                      return (
                        <div
                          key={idx}
                          className={`px-3 py-1.5 border-2 font-pixel text-[10px] ${
                            !unlocked
                              ? 'border-[#232530] bg-[#0B0C10] text-[#52525B]'
                              : rDef
                              ? 'border-[#FACC15] bg-[#1F1A10] text-white'
                              : 'border-[#383B4A] bg-[#14151C] text-[#A1A1AA]'
                          }`}
                        >
                          {!unlocked ? 'BLOQ.' : rDef ? `${rDef.glyph} ${rDef.name}` : `RANURA ${idx + 1}`}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {RELICS.map((rel) => {
                    const crafted = archive.craftedRelics.includes(rel.id);
                    const equipped = archive.equippedRelics.includes(rel.id);
                    const canAfford =
                      !crafted &&
                      archive.isotopes >= rel.isoCost &&
                      canAffordMaterials(archive.materials, rel.matCost);

                    return (
                      <div
                        key={rel.id}
                        className={`pixel-panel p-4 flex flex-col justify-between gap-3 ${
                          equipped ? 'border-[#FACC15] bg-[#1C1910]' : ''
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between font-pixel text-[10px]">
                            <span style={{ color: rel.color }}>{rel.code}</span>
                            {equipped ? (
                              <span className="text-[#FACC15]">EQUIPADA</span>
                            ) : crafted ? (
                              <span className="text-[#38BDF8]">FORJADA</span>
                            ) : (
                              <span className="text-[#71717A] tabular-nums">{rel.isoCost} ISO</span>
                            )}
                          </div>
                          <h3 className="font-display text-xl font-bold text-white flex items-center gap-2">
                            <span>{rel.glyph}</span>
                            <span>{rel.name}</span>
                          </h3>
                          <p className="text-xs text-[#D4D4D8] leading-relaxed">{rel.desc}</p>
                        </div>

                        <div className="pt-3 border-t border-[#232530] space-y-2.5">
                          {!crafted && <MaterialCostBadges bag={archive.materials} cost={rel.matCost} />}
                          {crafted ? (
                            <button
                              onClick={() => {
                                soundEngine.playUiClick();
                                onUpdateArchive(toggleEquipRelic(archive, rel.id));
                              }}
                              className={`w-full py-1.5 font-pixel text-[10px] font-bold cursor-pointer ${
                                equipped ? 'pixel-btn-gold text-[#FACC15]' : 'pixel-btn text-white'
                              }`}
                            >
                              {equipped ? 'DESEQUIPAR' : 'EQUIPAR EN RANURA'}
                            </button>
                          ) : (
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                soundEngine.init();
                                const next = craftRelic(archive, rel.id);
                                if (next) {
                                  soundEngine.playCraftSuccess();
                                  onUpdateArchive(next);
                                }
                              }}
                              className={`w-full py-1.5 font-pixel text-[10px] font-bold cursor-pointer ${
                                canAfford
                                  ? 'pixel-btn-primary text-white'
                                  : 'bg-[#20222C] border-2 border-[#2B2D38] text-[#71717A] cursor-not-allowed'
                              }`}
                            >
                              FORJAR · {rel.isoCost} ISO
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Tactical Belt & Active Consumable Gadgets */}
              <section className="space-y-4 border-t-2 border-[#232530] pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white">Cinturón Táctico (Teclas 1 · 2 · 3)</h2>
                    <p className="text-xs text-[#A1A1AA]">
                      Fabrica cargas consumibles de un uso por ranura en partida. Pulsa una ranura abajo y asigna el artilugio deseado.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {[0, 1, 2].map((slot) => {
                      const unlocked = slot < maxBeltSlots;
                      const gId = unlocked ? archive.equippedBelt[slot] : null;
                      const gDef = gId ? GADGETS.find((g) => g.id === gId) : null;
                      const isSel = activeBeltPicker === slot;
                      return (
                        <button
                          key={slot}
                          disabled={!unlocked}
                          onClick={() => {
                            soundEngine.playUiClick();
                            setActiveBeltPicker(slot);
                          }}
                          className={`px-3 py-1.5 border-2 font-pixel text-[10px] cursor-pointer ${
                            !unlocked
                              ? 'border-[#232530] bg-[#0B0C10] text-[#52525B] cursor-not-allowed'
                              : isSel
                              ? 'border-[#38BDF8] bg-[#102030] text-white'
                              : 'border-[#383B4A] bg-[#14151C] text-[#D4D4D8]'
                          }`}
                        >
                          [{slot + 1}] {!unlocked ? 'BLOQ.' : gDef ? `${gDef.glyph} ${gDef.shortCode}` : 'VACÍO'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {GADGETS.map((gad) => {
                    const owned = archive.gadgetInventory[gad.id] || 0;
                    const canAfford =
                      owned < gad.maxStack &&
                      archive.isotopes >= gad.isoCost &&
                      canAffordMaterials(archive.materials, gad.matCost);
                    const equippedInPicker = archive.equippedBelt[activeBeltPicker] === gad.id;

                    return (
                      <div key={gad.id} className="pixel-panel p-4 flex flex-col justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between font-pixel text-[10px]">
                            <span style={{ color: gad.color }}>
                              {gad.glyph} {gad.shortCode}
                            </span>
                            <span className="text-white tabular-nums">
                              STOCK: {owned}/{gad.maxStack}
                            </span>
                          </div>
                          <h3 className="font-display text-xl font-bold text-white">{gad.name}</h3>
                          <p className="text-xs text-[#D4D4D8] leading-relaxed">{gad.desc}</p>
                        </div>

                        <div className="pt-3 border-t border-[#232530] space-y-2.5">
                          <MaterialCostBadges bag={archive.materials} cost={gad.matCost} />
                          <div className="flex items-center gap-2">
                            <button
                              disabled={!canAfford}
                              onClick={() => {
                                soundEngine.init();
                                const next = craftGadget(archive, gad.id);
                                if (next) {
                                  soundEngine.playCraftSuccess();
                                  onUpdateArchive(next);
                                }
                              }}
                              className={`flex-1 py-1.5 font-pixel text-[10px] font-bold cursor-pointer ${
                                canAfford
                                  ? 'pixel-btn-primary text-white'
                                  : 'bg-[#20222C] border-2 border-[#2B2D38] text-[#71717A] cursor-not-allowed'
                              }`}
                            >
                              CREAR · {gad.isoCost} ISO
                            </button>
                            {owned > 0 && activeBeltPicker < maxBeltSlots && (
                              <button
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  onUpdateArchive(
                                    setBeltSlot(archive, activeBeltPicker, equippedInPicker ? null : gad.id)
                                  );
                                }}
                                className={`px-3 py-1.5 font-pixel text-[10px] cursor-pointer ${
                                  equippedInPicker ? 'pixel-btn-gold text-[#FACC15]' : 'pixel-btn text-white'
                                }`}
                              >
                                {equippedInPicker ? `QUITAR [${activeBeltPicker + 1}]` : `A [${activeBeltPicker + 1}]`}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ==================== TAB 3: HANGAR DE PERSONAJES (8) ==================== */}
          {tab === 'CHASSIS' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b-2 border-[#232530] pb-4">
                <div>
                  <h1 className="font-display text-3xl font-bold text-white">
                    Operadores y Personajes ({CHASSIS_LIST.length})
                  </h1>
                  <p className="text-sm text-[#A1A1AA] mt-1">
                    Empiezas con 2 operadores básicos listos para el pozo y desbloqueas otros 6 por hitos o Isótopos, cada uno con rasgo sutil y físicas propias.
                  </p>
                </div>
                <div className="font-mono text-xs tabular-nums text-[#FACC15]">
                  SALDO: {archive.isotopes} ISO · Récord: {archive.maxDepthCampaign}m
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {CHASSIS_LIST.map((c) => {
                  const unlocked = archive.unlockedChassis.includes(c.id);
                  const selected = archive.selectedChassis === c.id;
                  const canBuy = !unlocked && (c.unlockIsoCost ?? 0) > 0 && archive.isotopes >= (c.unlockIsoCost ?? 0);
                  const masteryRec = archive.operatorMastery?.[c.id];
                  const mastery = getOperatorMasteryRank(masteryRec);
                  return (
                    <div
                      key={c.id}
                      className={`pixel-panel p-5 flex flex-col justify-between gap-4 ${
                        selected ? 'bg-[#1F1517]' : !unlocked ? 'opacity-85' : ''
                      }`}
                      style={selected ? { borderColor: c.accentColor } : undefined}
                    >
                      <div className="flex items-start gap-4">
                        <ChassisPreviewMini
                          chassisId={c.id}
                          upgrades={rigUpgrades}
                          rigLevel={rigLevel}
                          locked={!unlocked}
                        />
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-pixel text-[10px]" style={{ color: c.accentColor }}>
                              {c.code} · {c.role}
                            </span>
                            {selected ? (
                              <span className="font-pixel text-[10px] text-[#FACC15] flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> ACTIVO
                              </span>
                            ) : !unlocked ? (
                              <span className="font-pixel text-[10px] text-[#71717A] flex items-center gap-1">
                                <Lock className="w-3.5 h-3.5" /> BLOQUEADO
                              </span>
                            ) : c.isStarter ? (
                              <span className="font-pixel text-[9px] text-[#2DD4BF]">INICIAL</span>
                            ) : null}
                          </div>
                          <h2 className="font-display text-2xl font-bold text-white">{c.name}</h2>
                          {c.origin && <div className="font-mono text-[11px] text-[#8E92A4]">{c.origin}</div>}
                          <p className="text-sm text-[#D4D4D8]">{c.bio || c.summary}</p>
                          {c.motto && <p className="text-xs italic text-[#A1A1AA]">{c.motto}</p>}
                          <div className="px-2.5 py-1.5 border border-[#262834] bg-[#0B0C10]/70 text-xs">
                            <span className="font-pixel text-[9px] mr-1.5" style={{ color: c.accentColor }}>
                              {c.traitTitle}:
                            </span>
                            <span className="text-[#E4E4E7]">{c.traitDesc}</span>
                          </div>
                          {c.signatureName && (
                            <div className="px-2.5 py-1.5 border border-[#38BDF8]/35 bg-[#0D1520]/80 text-xs">
                              <span className="font-pixel text-[9px] text-[#38BDF8] mr-1.5">
                                ✦ RESONANCIA [F] · {c.signatureName}:
                              </span>
                              <span className="text-[#E4E4E7]">{c.signatureDesc}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#A1A1AA] pt-0.5">
                            <span>{c.stats}</span>
                            <span className="text-[#FACC15]">
                              Rango {mastery.rank} · {mastery.title} ({masteryRec?.runs || 0} runs · {masteryRec?.maxDepth || 0}m · {masteryRec?.blocks || 0} bloq.)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t-2 border-[#232530] flex items-center justify-between gap-3">
                        <span className="text-xs text-[#71717A]">{c.unlockRequirement}</span>
                        {unlocked && !selected && (
                          <button
                            onClick={() => selectChassis(c.id)}
                            className="pixel-btn px-4 py-1.5 font-pixel text-[10px] text-white cursor-pointer shrink-0"
                          >
                            SELECCIONAR
                          </button>
                        )}
                        {!unlocked && (c.unlockIsoCost ?? 0) > 0 && (
                          <button
                            disabled={!canBuy}
                            onClick={() => {
                              const next = buyChassisUnlock(archive, c.id);
                              if (next) {
                                soundEngine.init();
                                soundEngine.playCraftSuccess();
                                onUpdateArchive(next);
                              } else {
                                soundEngine.playThermalDud();
                              }
                            }}
                            className={`px-3 py-1.5 font-pixel text-[10px] border-2 shrink-0 cursor-pointer transition-colors ${
                              canBuy
                                ? 'pixel-btn-gold text-white'
                                : 'border-[#232530] bg-[#101117] text-[#52525B] cursor-not-allowed'
                            }`}
                          >
                            DESBLOQUEAR · {c.unlockIsoCost} ISO
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== TAB 4: INFRAESTRUCTURA (8) ==================== */}
          {tab === 'CALIBRATION' && (
            <div className="space-y-6">
              <div className="border-b-2 border-[#232530] pb-4 flex items-end justify-between">
                <div>
                  <h1 className="font-display text-3xl font-bold text-white">Calibración de Infraestructura</h1>
                  <p className="text-sm text-[#A1A1AA] mt-1">
                    Expande permanentemente ranuras de Taller, ascensores de campaña, suministros y control de Cámaras de Brecha.
                  </p>
                </div>
                <div className="font-pixel text-xs text-[#FACC15] tabular-nums">{archive.isotopes} ISO</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  {
                    key: 'relicSlots' as const,
                    title: 'Ranuras de Reliquia',
                    desc: 'Amplía el máximo de Reliquias pasivas equipables simultáneamente en expedición (1 → 3).',
                    level: archive.infra.relicSlots || 0,
                    max: 2,
                    cost: 95 + (archive.infra.relicSlots || 0) * 110,
                  },
                  {
                    key: 'beltSlots' as const,
                    title: 'Ranuras de Cinturón Táctico',
                    desc: 'Habilita ranuras extra [2] y [3] para llevar más Artilugios activos al subsuelo.',
                    level: archive.infra.beltSlots || 0,
                    max: 2,
                    cost: 80 + (archive.infra.beltSlots || 0) * 95,
                  },
                  {
                    key: 'elevatorUnlock' as const,
                    title: 'Ascensor Geológico Profundo',
                    desc: 'Permite arrancar la Campaña directamente en cotas de 500m, 1000m, 1500m, 2000m o 2500m con módulos compensatorios.',
                    level: archive.infra.elevatorUnlock || 0,
                    max: 5,
                    cost: 120 + (archive.infra.elevatorUnlock || 0) * 90,
                  },
                  {
                    key: 'supplyDrop' as const,
                    title: 'Suministros de Despliegue',
                    desc: '+5% de O₂ máximo por nivel y +1 Escudo Cinético de arranque a partir de Nivel 2.',
                    level: archive.infra.supplyDrop || 0,
                    max: 3,
                    cost: 70 + (archive.infra.supplyDrop || 0) * 65,
                  },
                  {
                    key: 'reroll' as const,
                    title: 'Re-calibración (Reroll)',
                    desc: 'Permite pulsar R / Y en una Cámara de Brecha para rotar los 3 módulos ofrecidos.',
                    level: archive.infra.reroll,
                    max: 3,
                    cost: 65 + archive.infra.reroll * 55,
                  },
                  {
                    key: 'banish' as const,
                    title: 'Descarte de Planos (Banish)',
                    desc: 'Permite bloquear hasta 8 módulos del mazo aleatorio para forzar tu arquetipo ideal.',
                    level: archive.infra.banish,
                    max: 3,
                    cost: 80 + archive.infra.banish * 60,
                  },
                  {
                    key: 'initialInjection' as const,
                    title: 'Inyección Inicial',
                    desc: 'Arranca cada descenso con 1 Módulo aleatorio ya acoplado a los 0 metros.',
                    level: archive.infra.initialInjection,
                    max: 1,
                    cost: 140,
                  },
                  {
                    key: 'salvageCapsule' as const,
                    title: 'Cápsula de Salvamento',
                    desc: 'Genera Tubos de Extracción en el pozo para asegurar el 100% de tus Isótopos.',
                    level: archive.infra.salvageCapsule,
                    max: 1,
                    cost: 120,
                  },
                ].map((item) => {
                  const maxed = item.level >= item.max;
                  const canAfford = archive.isotopes >= item.cost;
                  return (
                    <div key={item.key} className="pixel-panel p-5 flex flex-col justify-between gap-4">
                      <div>
                        <div className="font-pixel text-[10px] text-[#A1A1AA] mb-1">
                          NIVEL {item.level} / {item.max}
                        </div>
                        <h3 className="font-display text-2xl font-bold text-white">{item.title}</h3>
                        <p className="text-sm text-[#A1A1AA] mt-1">{item.desc}</p>
                      </div>
                      <div className="pt-4 border-t-2 border-[#232530] flex items-center justify-between">
                        <span className="font-pixel text-xs tabular-nums text-[#FACC15]">
                          {maxed ? 'MÁXIMO' : `${item.cost} ISO`}
                        </span>
                        {!maxed && (
                          <button
                            onClick={() => buyInfra(item.key, item.cost, item.max)}
                            disabled={!canAfford}
                            className={`px-4 py-2 font-pixel text-[10px] font-bold cursor-pointer ${
                              canAfford
                                ? 'pixel-btn-primary text-white'
                                : 'bg-[#20222C] border-2 border-[#2B2D38] text-[#71717A] cursor-not-allowed'
                            }`}
                          >
                            MEJORAR
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== TAB 5: CATÁLOGO DE MÓDULOS (30) & SOBRECARGAS (6) ==================== */}
          {tab === 'CATALOG' && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b-2 border-[#232530] pb-4">
                <div>
                  <h1 className="font-display text-3xl font-bold text-white">Catálogo Táctico ({MODULES.length} Módulos · {OVERCHARGES.length} Sobrecargas)</h1>
                  <p className="text-sm text-[#A1A1AA] mt-1">
                    Desbloquea planos con Isótopos, explora sinergias o descarta módulos para esculpir tus probabilidades.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ['ALL', 'Todos'],
                      ['PIROLITICO', 'Pirolítico'],
                      ['BALISTICO', 'Balístico'],
                      ['PARASITO', 'Parásito'],
                      ['CUANTICO', 'Cuántico'],
                      ['OVERCHARGE', `Sobrecargas (${OVERCHARGES.length})`],
                    ] as [ModuleFilter, string][]
                  ).map(([fid, label]) => (
                    <button
                      key={fid}
                      onClick={() => {
                        soundEngine.playUiClick();
                        setModuleFilter(fid);
                      }}
                      className={`px-2.5 py-1 font-pixel text-[9px] border cursor-pointer ${
                        moduleFilter === fid
                          ? 'border-[#EE4E34] bg-[#241517] text-[#FACC15]'
                          : 'border-[#2B2D38] bg-[#101117] text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {moduleFilter === 'OVERCHARGE' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {OVERCHARGES.map((oc) => (
                    <div key={oc.id} className="pixel-panel p-4 border-[#E11D48]/60 bg-[#1B1015] space-y-2">
                      <div className="font-pixel text-[10px] text-[#FDA4AF]">
                        {oc.glyph} SOBRECARGA EXTREMA
                      </div>
                      <h3 className="font-display text-xl font-bold text-white">{oc.name}</h3>
                      <p className="text-xs text-[#A3E635]">+ {oc.benefit}</p>
                      <p className="text-xs text-[#FDA4AF]">− {oc.cost}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="font-pixel text-[11px] text-[#A1A1AA] tabular-nums">
                    Descartados en mazo: {archive.banishedModules.length} / {maxBanishAllowed}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MODULES.filter((m) => moduleFilter === 'ALL' || m.archetype === moduleFilter).map((m) => {
                      const unlocked = archive.unlockedModules.includes(m.id);
                      const banished = archive.banishedModules.includes(m.id);
                      const cost = m.unlockCost || 0;
                      return (
                        <div
                          key={m.id}
                          className={`pixel-panel p-4 flex flex-col justify-between gap-3 ${banished ? 'opacity-50' : ''}`}
                        >
                          <div>
                            <div className="flex items-center justify-between font-pixel text-[10px] mb-1">
                              <span style={{ color: ARCHETYPE_COLORS[m.archetype] }}>
                                {m.glyph} {ARCHETYPE_LABELS[m.archetype]}
                              </span>
                              {banished && <span className="text-[#E11D48]">DESCARTADO</span>}
                            </div>
                            <h3 className="font-display text-xl font-bold text-white">{m.name}</h3>
                            <p className="text-xs text-[#D4D4D8] mt-1 leading-relaxed">{m.shortDesc}</p>
                            <p className="text-[11px] text-[#FACC15]/85 mt-1.5">MK-II: {m.mk2Desc}</p>
                          </div>

                          <div className="pt-3 border-t border-[#232530] flex items-center justify-between">
                            {!unlocked ? (
                              <button
                                onClick={() => unlockModule(m.id, cost)}
                                disabled={archive.isotopes < cost}
                                className={`w-full py-1.5 font-pixel text-[10px] font-bold cursor-pointer ${
                                  archive.isotopes >= cost
                                    ? 'pixel-btn-primary text-white'
                                    : 'bg-[#20222C] border-2 border-[#2B2D38] text-[#71717A] cursor-not-allowed'
                                }`}
                              >
                                DESBLOQUEAR · {cost} ISO
                              </button>
                            ) : maxBanishAllowed > 0 ? (
                              <button
                                onClick={() => toggleBanishModule(m.id)}
                                className="text-xs font-pixel text-[#A1A1AA] hover:text-white cursor-pointer"
                              >
                                {banished ? 'Restaurar al mazo' : 'Descartar (Banish)'}
                              </button>
                            ) : (
                              <span className="font-pixel text-[10px] text-[#38BDF8]">DESBLOQUEADO</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==================== TAB 6: RETOS, CONTRATOS E HITOS (16 + 3) ==================== */}
          {tab === 'CHALLENGES' && (
            <div className="space-y-8">
              <div className="border-b-2 border-[#232530] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl font-bold text-white">Contratos Activos e Hitos</h1>
                  <p className="text-sm text-[#A1A1AA] mt-1">
                    Completa encargos rotativos y objetivos permanentes para cobrar grandes remesas de Isótopos, Materiales y Núcleos.
                  </p>
                </div>
                <button
                  onClick={() => {
                    soundEngine.playUiClick();
                    onUpdateArchive(refreshCompletedContracts(archive));
                  }}
                  className="pixel-btn px-3 py-1.5 font-pixel text-[10px] text-white flex items-center gap-1.5 cursor-pointer self-start"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Rotar Cobrados
                </button>
              </div>

              {/* Active Contracts */}
              <section className="space-y-3">
                <h2 className="font-display text-2xl font-bold text-white">Contratos de Expedición</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(archive.activeContracts || []).map((st) => {
                    const def = CONTRACT_POOL.find((d) => d.id === st.id);
                    if (!def) return null;
                    const pct = Math.min(100, Math.round((st.progress / def.target) * 100));
                    return (
                      <div key={st.id} className="pixel-panel p-4 flex flex-col justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex justify-between font-pixel text-[10px]">
                            <span className="text-[#38BDF8]">CONTRATO</span>
                            <span className="text-[#FACC15] tabular-nums">+{def.rewardIso} ISO</span>
                          </div>
                          <h3 className="font-display text-xl font-bold text-white">{def.title}</h3>
                          <p className="text-xs text-[#A1A1AA]">{def.desc}</p>
                          <div className="space-y-1 pt-1">
                            <div className="flex justify-between font-mono text-xs tabular-nums">
                              <span>Progreso</span>
                              <span>
                                {st.progress} / {def.target}
                              </span>
                            </div>
                            <div className="h-2 bg-[#09090B] border border-[#2B2D38]">
                              <div className="h-full bg-[#38BDF8]" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {(Object.entries(def.rewardMats) as [MaterialId, number][]).map(([mId, qty]) => (
                              <span key={mId} className="inline-flex items-center gap-1 text-[11px] font-mono text-white px-1.5 py-0.5 bg-[#101117] border border-[#232530]">
                                <MaterialIconThumb matId={mId} size={13} /> +{qty}
                              </span>
                            ))}
                          </div>
                        </div>

                        {st.claimed ? (
                          <div className="text-center font-pixel text-[10px] text-[#71717A] py-1">COBRADO</div>
                        ) : st.completed ? (
                          <button
                            onClick={() => {
                              const next = claimContractReward(archive, st.id);
                              if (next) {
                                soundEngine.playCraftSuccess();
                                onUpdateArchive(next);
                              }
                            }}
                            className="pixel-btn-gold w-full py-1.5 font-pixel text-[10px] font-bold text-[#FACC15] cursor-pointer"
                          >
                            COBRAR RECOMPENSA
                          </button>
                        ) : (
                          <div className="text-center font-pixel text-[10px] text-[#52525B] py-1">EN CURSO</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 16 Permanent Milestones */}
              <section className="space-y-3 border-t-2 border-[#232530] pt-6">
                <h2 className="font-display text-2xl font-bold text-white">Hitos Permanentes ({archive.claimedChallenges.length}/{CHALLENGES.length})</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CHALLENGES.map((ch) => {
                    const claimed = archive.claimedChallenges.includes(ch.id);
                    const cur = Math.min(ch.target, getChallengeProgressValue(archive, ch.progressKey));
                    const ready = !claimed && cur >= ch.target;
                    const pct = Math.round((cur / ch.target) * 100);
                    return (
                      <div key={ch.id} className={`pixel-panel p-4 flex flex-col justify-between gap-3 ${claimed ? 'opacity-65' : ''}`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between font-pixel text-[10px]">
                            <span className={ready ? 'text-[#A3E635]' : claimed ? 'text-[#38BDF8]' : 'text-[#71717A]'}>
                              {claimed ? 'COMPLETADO' : ready ? 'LISTO PARA COBRAR' : 'PROGRESO'}
                            </span>
                            <span className="text-[#FACC15] tabular-nums">
                              +{ch.rewardIso} ISO {ch.rewardCores ? `· +${ch.rewardCores} NÚCL` : ''}
                            </span>
                          </div>
                          <h3 className="font-display text-xl font-bold text-white">{ch.title}</h3>
                          <p className="text-xs text-[#A1A1AA]">{ch.desc}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between font-mono text-xs tabular-nums">
                              <span>
                                {cur.toLocaleString('es-ES')} / {ch.target.toLocaleString('es-ES')}
                              </span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-2 bg-[#09090B] border border-[#2B2D38]">
                              <div
                                className="h-full"
                                style={{ width: `${pct}%`, backgroundColor: ready ? '#A3E635' : '#EE4E34' }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#232530]">
                          <div className="flex flex-wrap gap-1.5">
                            {(Object.entries(ch.rewardMats) as [MaterialId, number][]).map(([mId, qty]) => (
                              <span key={mId} className="inline-flex items-center gap-1 text-[11px] font-mono text-white px-1.5 py-0.5 bg-[#101117] border border-[#232530]">
                                <MaterialIconThumb matId={mId} size={13} /> +{qty}
                              </span>
                            ))}
                          </div>
                          {ready && (
                            <button
                              onClick={() => {
                                const next = claimChallengeReward(archive, ch.id);
                                if (next) {
                                  soundEngine.playCraftSuccess();
                                  onUpdateArchive(next);
                                }
                              }}
                              className="pixel-btn-gold px-3 py-1.5 font-pixel text-[10px] font-bold text-[#FACC15] cursor-pointer shrink-0"
                            >
                              RECLAMAR
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ==================== TAB 7: MAPA DE CAMPAÑA E HISTORIA (7 CAPÍTULOS) ==================== */}
          {tab === 'CAMPAIGN' && (
            <div className="space-y-8">
              <div className="border-b-2 border-[#232530] pb-4">
                <h1 className="font-display text-3xl font-bold text-white">Expedición de Campaña · 7 Capítulos</h1>
                <p className="text-sm text-[#A1A1AA] mt-1">
                  Desciende desde la Corteza Industrial hasta el Horizonte de Eventos (3.500m). Salta directamente a cualquier capítulo desbloqueado.
                </p>
              </div>

              {/* 7-Chapter Vertical Progression Map */}
              <div className="space-y-3">
                {CAMPAIGN_CHAPTERS.map((ch) => {
                  const unlocked = archive.unlockedChapters >= ch.id;
                  const canJump = ch.depthStart === 0 || (archive.infra.elevatorUnlock || 0) >= ch.id - 1;
                  return (
                    <div
                      key={ch.id}
                      className={`pixel-panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        !unlocked ? 'opacity-60' : ''
                      }`}
                      style={{ borderLeftWidth: 4, borderLeftColor: unlocked ? ch.accentColor : '#2B2D38' }}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 font-pixel text-[10px]">
                          <span style={{ color: ch.accentColor }}>
                            {ch.depthStart}m – {ch.depthEnd}m
                          </span>
                          <span className="text-[#52525B]">·</span>
                          <span className="text-white">JEFE: {ch.bossName}</span>
                          <span className="text-[#52525B]">·</span>
                          <span className="text-[#FDA4AF]">RIESGO: {ch.hazardName}</span>
                        </div>
                        <h2 className="font-display text-2xl font-bold text-white">{ch.name}</h2>
                        <p className="text-xs sm:text-sm text-[#D4D4D8] leading-relaxed">{ch.synopsis}</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {unlocked && canJump ? (
                          <button
                            onClick={() => {
                              soundEngine.playUiClick();
                              onLaunchChapter(ch.depthStart);
                            }}
                            className="pixel-btn-primary px-4 py-2 font-pixel text-[10px] font-bold text-white flex items-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" /> DESPLEGAR EN {ch.depthStart}m
                          </button>
                        ) : (
                          <span className="pixel-badge text-[#71717A] flex items-center gap-1">
                            <Lock className="w-3 h-3" /> {unlocked ? 'DESBLOQ. ASCENSOR EN INFRA' : `ALCANZA ${ch.depthStart}m`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Story Transmissions Log with Character Portraits */}
              <section className="space-y-4 border-t-2 border-[#232530] pt-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-2xl font-bold text-white">Archivo de Transmisiones</h2>
                  <span className="font-pixel text-[11px] text-[#A1A1AA] tabular-nums">
                    {(archive.seenStoryIds || []).length} / {STORY_TRANSMISSIONS.length} RECIBIDAS
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {STORY_TRANSMISSIONS.map((tx) => {
                    const seen = (archive.seenStoryIds || []).includes(tx.id);
                    const prof = SPEAKER_PROFILES[tx.speaker];
                    const choicePicked = archive.storyChoices?.[tx.id];
                    return (
                      <div key={tx.id} className={`pixel-panel p-4 flex items-start gap-3.5 ${seen ? '' : 'opacity-55'}`}>
                        <PortraitCanvas speaker={tx.speaker} size={52} />
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 font-pixel text-[9px]">
                            <span style={{ color: prof.color }}>{prof.name}</span>
                            <span className="text-[#71717A]">CAP.{tx.chapter}</span>
                          </div>
                          <h3 className="font-display text-lg font-bold text-white">
                            {seen ? tx.title : 'Transmisión encriptada'}
                          </h3>
                          <p className="text-xs text-[#D4D4D8] leading-relaxed">
                            {seen
                              ? tx.lines.join(' ')
                              : 'Descender en Modo Campaña revelará este comunicado por radio.'}
                          </p>
                          {seen && choicePicked && (
                            <div className="text-[11px] font-mono text-[#FACC15] pt-1">
                              Decisión tomada: {tx.choices?.find((c) => c.id === choicePicked)?.label || choicePicked}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ==================== TAB 8: ARCHIVO (16 MINERALES, 16 BITÁCORA, CÓDICE) ==================== */}
          {tab === 'DISCOVERIES' &&
            (() => {
              const mineralStats = archive.mineralStats || {};
              const discoveredLoreSet = new Set(archive.discoveredLore || ['LORE_01_BITACORA']);
              const catalogedMineralsCount = MINERAL_SPECS.filter((m) => (mineralStats[m.kind]?.destroyed || 0) > 0).length;

              return (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-2 border-[#232530] pb-4">
                    <div>
                      <h1 className="font-display text-3xl font-bold text-white">Archivo Geológico y Códice</h1>
                      <p className="text-sm text-[#A1A1AA] mt-1">
                        Los 16 minerales y dispositivos del pozo, 16 registros históricos y códice vertical completo.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 p-1 pixel-panel shrink-0 self-start">
                      {(
                        [
                          ['ALL', 'Todo'],
                          ['MINERALS', `Minerales (${MINERAL_SPECS.length})`],
                          ['LORE', `Bitácora (${LORE_FRAGMENTS.length})`],
                          ['CODEX', `Códice (${CODEX_ENTRIES.length})`],
                        ] as [DiscoveryFilter, string][]
                      ).map(([fid, flabel]) => (
                        <button
                          key={fid}
                          onClick={() => setDiscoveryFilter(fid)}
                          className={`px-3 py-1 font-pixel text-[10px] transition-colors cursor-pointer whitespace-nowrap ${
                            discoveryFilter === fid ? 'bg-[#D94126] text-white' : 'text-[#A1A1AA] hover:text-white'
                          }`}
                        >
                          {flabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4-Column Telemetry */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="pixel-panel p-4">
                      <div className="font-pixel text-[10px] text-[#A1A1AA]">DESCENSOS</div>
                      <div className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
                        {archive.totalRuns || 0}
                      </div>
                    </div>
                    <div className="pixel-panel p-4">
                      <div className="font-pixel text-[10px] text-[#A1A1AA]">BLOQUES ROTOS</div>
                      <div className="font-mono text-2xl font-bold text-[#38BDF8] tabular-nums mt-1">
                        {(archive.totalBlocksDestroyed || 0).toLocaleString('es-ES')}
                      </div>
                    </div>
                    <div className="pixel-panel p-4">
                      <div className="font-pixel text-[10px] text-[#A1A1AA]">COMBO / CADENA</div>
                      <div className="font-mono text-2xl font-bold text-[#FACC15] tabular-nums mt-1">
                        ×{archive.bestCombo || 1}{' '}
                        <span className="text-sm text-[#A1A1AA] font-normal">· ×{archive.bestChain || 1}</span>
                      </div>
                    </div>
                    <div className="pixel-panel p-4">
                      <div className="font-pixel text-[10px] text-[#A1A1AA]">BITÁCORA</div>
                      <div className="font-mono text-2xl font-bold text-white tabular-nums mt-1">
                        {discoveredLoreSet.size}{' '}
                        <span className="text-sm text-[#71717A] font-normal">/ {LORE_FRAGMENTS.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* 16 Mineral Specimens */}
                  {(discoveryFilter === 'ALL' || discoveryFilter === 'MINERALS') && (
                    <section className="space-y-4">
                      <div className="flex items-baseline justify-between">
                        <h2 className="font-display text-2xl font-bold text-white">Espectro Mineralógico Completo</h2>
                        <span className="font-pixel text-[11px] tabular-nums text-[#A1A1AA]">
                          {catalogedMineralsCount} / {MINERAL_SPECS.length} CATALOGADOS
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {MINERAL_SPECS.map((spec) => {
                          const rec = mineralStats[spec.kind];
                          const discovered = Boolean(rec && rec.destroyed > 0);
                          return (
                            <div
                              key={spec.kind}
                              className={`pixel-panel p-4 flex flex-col justify-between gap-3 ${
                                discovered ? '' : 'opacity-75'
                              }`}
                            >
                              <div className="flex items-start gap-3.5">
                                <MineralSpriteThumb kind={spec.kind} discovered={discovered} />
                                <div className="space-y-1.5 min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <h3 className="font-display text-xl font-bold text-white truncate">
                                      {discovered ? spec.name : 'Espécimen sin muestrear'}
                                    </h3>
                                    <span className="font-mono text-xs tabular-nums text-[#FACC15] shrink-0">
                                      {discovered ? `${rec.destroyed.toLocaleString('es-ES')}×` : '0×'}
                                    </span>
                                  </div>
                                  <div className="text-xs font-mono text-[#A1A1AA] flex flex-wrap items-center gap-x-2 tabular-nums">
                                    <span>{discovered ? spec.formula : `Franja: ${spec.strataRange}`}</span>
                                    {discovered && <span>· {spec.hardness}</span>}
                                  </div>
                                  <p className="text-xs text-[#D4D4D8] leading-relaxed">
                                    {discovered
                                      ? spec.note
                                      : 'Perfora, rebota o detona este bloque en partida para catalogar su ficha.'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* 16 Lore Fragments */}
                  {(discoveryFilter === 'ALL' || discoveryFilter === 'LORE') && (
                    <section className="space-y-4">
                      <div className="flex items-baseline justify-between">
                        <h2 className="font-display text-2xl font-bold text-white">Fragmentos de Bitácora</h2>
                        <span className="font-pixel text-[11px] tabular-nums text-[#A1A1AA]">
                          {discoveredLoreSet.size} / {LORE_FRAGMENTS.length} RECUPERADOS
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {LORE_FRAGMENTS.map((frag) => {
                          const found = discoveredLoreSet.has(frag.id);
                          return (
                            <div key={frag.id} className={`pixel-panel p-5 flex flex-col justify-between gap-3 ${found ? '' : 'opacity-75'}`}>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2 text-xs font-mono text-[#A1A1AA] tabular-nums">
                                  <div className="flex items-center gap-2">
                                    <span>{frag.code}</span>
                                    <span>·</span>
                                    <span>{frag.depthLabel}</span>
                                  </div>
                                  <span className={`font-pixel text-[10px] ${found ? 'text-[#C084FC]' : 'text-[#71717A]'}`}>
                                    {found ? 'DESCIFRADO' : 'ENCRIPTADO'}
                                  </span>
                                </div>
                                <h3 className="font-display text-xl font-bold text-white">
                                  {found ? frag.title : 'Fragmento sin descifrar'}
                                </h3>
                                {found && <div className="text-xs text-[#A1A1AA]">{frag.author}</div>}
                                <p className="text-sm text-[#D4D4D8] leading-relaxed pt-1">
                                  {found ? `«${frag.excerpt}»` : `Condición: ${frag.triggerHint}`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Geological Codex */}
                  {(discoveryFilter === 'ALL' || discoveryFilter === 'CODEX') && (
                    <section className="space-y-4">
                      <div className="flex items-baseline justify-between">
                        <h2 className="font-display text-2xl font-bold text-white">Códice Geológico Vertical</h2>
                        <span className="font-pixel text-[11px] tabular-nums text-[#A1A1AA]">
                          {archive.discoveredCodex.length} / {CODEX_ENTRIES.length}
                        </span>
                      </div>

                      <div className="relative pl-8 border-l-2 border-[#2B2D38] space-y-4">
                        {CODEX_ENTRIES.map((entry) => {
                          const found = archive.discoveredCodex.includes(entry.id);
                          return (
                            <div key={entry.id} className="relative">
                              <div
                                className={`absolute -left-[39px] top-2 w-3 h-3 border-2 ${
                                  found ? 'bg-[#EE4E34] border-[#FACC15]' : 'bg-[#12131A] border-[#3F3F46]'
                                }`}
                              />
                              <div className="pixel-panel p-4">
                                <div className="flex items-center gap-3 font-pixel text-[10px] text-[#71717A] tabular-nums">
                                  <span>{entry.depth}</span>
                                  <span>·</span>
                                  <span>{entry.category}</span>
                                </div>
                                <h3 className="font-display text-xl font-bold text-white mt-1">
                                  {found ? entry.title : 'Registro geológico sin descifrar'}
                                </h3>
                                <p className="text-sm text-[#A1A1AA] mt-1 leading-relaxed">
                                  {found
                                    ? entry.note
                                    : 'Desciende más profundo o provoca este fenómeno para documentarlo.'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </div>
              );
            })()}

          {/* ==================== TAB 9: COLECCIÓN DE ARTEFACTOS (14 + LOTE COMPLETO) ==================== */}
          {tab === 'ARTIFACTS' &&
            (() => {
              const bonuses = getArtifactPermanentBonuses(archive);
              const collectedCount = discoveredArtifactsList.length;
              return (
                <div className="space-y-7">
                  <div className="border-b-2 border-[#232530] pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                      <h1 className="font-display text-3xl font-bold text-white">
                        Museo del Archivo · 14 Artefactos del Arquitecto
                      </h1>
                      <p className="text-sm text-[#A1A1AA] mt-1">
                        Explora los 7 Estratos para localizar cámaras doradas ocultas. Reúne hitos de colección y completa los 14 para reclamar la Corona del Arquitecto.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 font-pixel text-xs tabular-nums">
                      <span className="px-3 py-1.5 border-2 border-[#C084FC] bg-[#181024] text-[#E9D5FF]">
                        {collectedCount} / {ARTIFACTS.length} HALLADOS
                      </span>
                      {bonuses.hasArchitectCrown && (
                        <span className="px-3 py-1.5 border-2 border-[#FACC15] bg-[#1E1A0E] text-[#FACC15]">
                          👑 CORONA ACTIVA
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Permanent Bonuses Bar */}
                  <div className="pixel-panel p-4 bg-[#10121B] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                    <div className="font-pixel text-[10px] text-[#38BDF8]">BONIFICACIONES PERMANENTES ACTIVAS:</div>
                    <div className="flex flex-wrap gap-3 text-white">
                      <span>O₂ Máx +{bonuses.maxO2BonusPct}%</span>
                      <span>·</span>
                      <span>Isótopos ×{bonuses.isoBonusMult.toFixed(2)}</span>
                      <span>·</span>
                      <span>Carga Resonancia/OVR ×{bonuses.chargeSpeedMult.toFixed(2)}</span>
                      <span>·</span>
                      <span>Escudos extra +{bonuses.starterShieldBonus}</span>
                    </div>
                  </div>

                  {/* Tiered Milestone Rewards & Grand Prize */}
                  <section className="space-y-3">
                    <h2 className="font-display text-2xl font-bold text-white">Premios de Colección</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ARTIFACT_MILESTONES.map((ms) => {
                        const isClaimed = claimedMilestonesList.includes(ms.id);
                        const unlocked = collectedCount >= ms.required;
                        const pct = Math.min(100, Math.round((collectedCount / ms.required) * 100));
                        return (
                          <div
                            key={ms.id}
                            className={`pixel-panel p-4 space-y-3 ${
                              ms.isGrandPrize
                                ? 'border-[#FACC15] bg-[#1B170C]'
                                : unlocked && !isClaimed
                                ? 'border-[#A3E635] bg-[#121C10]'
                                : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div
                                  className={`font-pixel text-[9px] ${
                                    ms.isGrandPrize ? 'text-[#FACC15]' : 'text-[#38BDF8]'
                                  }`}
                                >
                                  HITO {Math.min(collectedCount, ms.required)} / {ms.required} ARTEFACTOS
                                </div>
                                <h3 className="font-display text-xl font-bold text-white mt-0.5">{ms.title}</h3>
                                <p className="text-xs text-[#A1A1AA]">{ms.subtitle}</p>
                              </div>
                              {isClaimed ? (
                                <span className="pixel-badge border-[#A3E635] text-[#A3E635]">RECLAMADO</span>
                              ) : unlocked ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = claimArtifactMilestone(archive, ms.id);
                                    if (next) {
                                      soundEngine.init();
                                      soundEngine.playArtifactFound();
                                      onUpdateArchive(next);
                                    }
                                  }}
                                  className="pixel-btn-gold px-3 py-1.5 font-pixel text-[10px] font-bold text-white cursor-pointer shrink-0 animate-pulse"
                                >
                                  RECLAMAR PREMIO
                                </button>
                              ) : null}
                            </div>

                            <div className="h-2 bg-[#09090B] border border-[#2B2D38] overflow-hidden">
                              <div
                                className="h-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: ms.isGrandPrize ? '#FACC15' : unlocked ? '#A3E635' : '#C084FC',
                                }}
                              />
                            </div>

                            <div className="text-xs font-mono text-[#FACC15]">
                              Recompensa: +{ms.rewardIso} ISO · +{ms.rewardCores} Núcl.
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {(Object.entries(ms.rewardMats) as [MaterialId, number][]).map(([mId, qty]) => {
                                if (!qty) return null;
                                return (
                                  <span
                                    key={mId}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-[#2E3846] bg-[#10131C] text-[11px] font-mono text-white"
                                  >
                                    <MaterialIconThumb matId={mId} size={14} />
                                    +{qty}
                                  </span>
                                );
                              })}
                              {(Object.entries(ms.rewardGadgets || {}) as [GadgetId, number][]).map(([gId, qty]) => {
                                const gad = GADGETS.find((g) => g.id === gId);
                                if (!qty || !gad) return null;
                                return (
                                  <span
                                    key={gId}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 border text-[10px] font-mono bg-[#10131C]"
                                    style={{ borderColor: gad.color, color: gad.color }}
                                  >
                                    {gad.glyph} {gad.shortCode} ×{qty}
                                  </span>
                                );
                              })}
                            </div>
                            <div className="text-xs text-[#E4E4E7] bg-[#0B0C10]/80 border border-[#262834] px-2.5 py-1.5">
                              {ms.permBonusDesc}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Secret Epilogue unlocked with 14/14 Grand Prize */}
                  {archive.architectCrownUnlocked && (
                    <section className="pixel-panel p-5 border-2 border-[#FACC15] bg-[#16130A] space-y-2.5">
                      <div className="font-pixel text-[10px] text-[#FACC15]">{ARCHITECT_EPILOGUE.subtitle}</div>
                      <h2 className="font-display text-2xl font-bold text-white">{ARCHITECT_EPILOGUE.title}</h2>
                      <div className="space-y-2 text-sm text-[#F4EFE4] leading-relaxed">
                        {ARCHITECT_EPILOGUE.lines.map((line, i) => (
                          <p key={i}>{line}</p>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* All 14 Artifacts Gallery */}
                  <section className="space-y-3">
                    <h2 className="font-display text-2xl font-bold text-white">Galería del Subsuelo (I–VII)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ARTIFACTS.map((art) => {
                        const found = discoveredArtifactsList.includes(art.id);
                        const stratum = STRATA.find((s) => s.id === art.stratumId) || STRATA[0];
                        return (
                          <div
                            key={art.id}
                            className={`pixel-panel p-4 flex items-start gap-3.5 ${!found ? 'opacity-70' : ''}`}
                            style={found ? { borderColor: art.color } : undefined}
                          >
                            <ArtifactSpriteThumb artifactId={art.id} discovered={found} size={44} />
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center justify-between gap-2 font-pixel text-[9px]">
                                <span style={{ color: found ? art.color : '#71717A' }}>
                                  {art.code} · {stratum.name}
                                </span>
                                <span className="pixel-badge" style={{ borderColor: art.color, color: found ? art.color : '#71717A' }}>
                                  {art.rarity}
                                </span>
                              </div>
                              <h3 className="font-display text-xl font-bold text-white">
                                {found ? art.name : 'Reliquia sin identificar'}
                              </h3>
                              <p className="text-xs text-[#D4D4D8] leading-relaxed">
                                {found
                                  ? art.lore
                                  : `Emite señal oculta en ${stratum.name} (${stratum.depthStart}–${stratum.depthEnd}m). Acércate para sintonizarla.`}
                              </p>
                              {found && <p className="text-[11px] italic text-[#FACC15]">{art.quote}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>
              );
            })()}
        </main>
      </div>
    </div>
  );
};
