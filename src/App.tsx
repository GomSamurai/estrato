import { useEffect, useState } from 'react';
import { ArchiveSave, ChassisId, CrtMode, GameMode, KeyBindings, RunSummary, ScreenView, TrialId, VisualSettings } from './types/game';
import { generateRandomSeedCode, getDailySeedCode } from './engine/rng';
import {
  applyRunResultToArchive,
  loadArchive,
  loadVisualSettings,
  saveArchive,
  saveVisualSettings,
} from './storage/archive';
import { loadKeyBindings, saveKeyBindings } from './storage/controls';
import { soundEngine } from './engine/audio';
import { TitleScreen } from './components/TitleScreen';
import { GameCanvas } from './components/GameCanvas';
import { DuelView } from './components/DuelView';
import { ArchiveHub } from './components/ArchiveHub';
import { CinematicIntro } from './components/CinematicIntro';

export default function App() {
  const [visualSettings, setVisualSettings] = useState<VisualSettings>(() => loadVisualSettings());
  const [screen, setScreen] = useState<ScreenView>(() => (visualSettings.skipIntro ? 'TITLE' : 'INTRO'));
  const [archiveInitialTab, setArchiveInitialTab] = useState<'SHOP' | 'CHASSIS' | 'ARTIFACTS'>('SHOP');
  const [mode, setMode] = useState<GameMode>('CAMPAIGN');
  const [seed, setSeed] = useState<string>(() => generateRandomSeedCode());
  const [isDaily, setIsDaily] = useState(false);
  const [ascension, setAscension] = useState(1);
  const [startDepth, setStartDepth] = useState(0);
  const [trialId, setTrialId] = useState<TrialId>('GRAVEL_AVALANCHE');
  const [runCounter, setRunCounter] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [archive, setArchive] = useState<ArchiveSave>(() => loadArchive());
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(() => loadKeyBindings());
  const [tutorialEnabled, setTutorialEnabled] = useState<boolean>(() => !loadArchive().tutorialCompleted);

  useEffect(() => {
    soundEngine.setMusicVolume(visualSettings.musicVolume ?? 0.78);
    soundEngine.setSfxVolume(visualSettings.sfxVolume ?? 0.9);
  }, [visualSettings.musicVolume, visualSettings.sfxVolume]);

  useEffect(() => {
    if (screen !== 'TITLE' && screen !== 'ARCHIVE' && screen !== 'INTRO') return;
    const timer = window.setInterval(() => {
      soundEngine.tickMenuMusic();
    }, 35);
    return () => window.clearInterval(timer);
  }, [screen]);

  const cycleCrtMode = () => {
    const order: CrtMode[] = ['SUBTLE', 'ARCADE', 'OFF'];
    const nextMode = order[(order.indexOf(visualSettings.crtMode) + 1) % order.length];
    const next = { ...visualSettings, crtMode: nextMode };
    setVisualSettings(next);
    saveVisualSettings(next);
  };

  const updateVisualSettings = (next: VisualSettings) => {
    setVisualSettings(next);
    saveVisualSettings(next);
  };

  const updateKeyBindings = (next: KeyBindings) => {
    setKeyBindings(next);
    saveKeyBindings(next);
  };

  const dailyInfo = getDailySeedCode();

  const toggleSound = () => {
    soundEngine.init();
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundEngine.setEnabled(next);
  };

  const handleToggleDaily = () => {
    if (!isDaily) {
      setIsDaily(true);
      setSeed(dailyInfo.seed);
      setMode('ENDLESS');
    } else {
      setIsDaily(false);
      setSeed(generateRandomSeedCode());
    }
  };

  const handleStartGame = () => {
    soundEngine.init();
    setRunCounter((c) => c + 1);
    if (mode === 'DUEL') {
      setScreen('DUEL');
    } else {
      setScreen('PLAYING');
    }
  };

  const handleFinishRun = (summary: RunSummary, discoveredCodex: string[]): string[] => {
    const { updated, newUnlocks } = applyRunResultToArchive(
      archive,
      summary,
      discoveredCodex,
      isDaily,
      dailyInfo.dateStr
    );
    setArchive(updated);
    return newUnlocks;
  };

  const handleTutorialComplete = () => {
    setTutorialEnabled(false);
    setArchive((prev) => {
      if (prev.tutorialCompleted) return prev;
      const updated = { ...prev, tutorialCompleted: true };
      saveArchive(updated);
      return updated;
    });
  };

  if (screen === 'INTRO') {
    return (
      <CinematicIntro
        archive={archive}
        soundEnabled={soundEnabled}
        onFinish={() => setScreen('TITLE')}
        onSkipForever={() => {
          updateVisualSettings({ ...visualSettings, skipIntro: true });
          setScreen('TITLE');
        }}
      />
    );
  }

  if (screen === 'PLAYING') {
    return (
      <GameCanvas
        key={runCounter}
        mode={mode}
        seed={mode === 'SPRINT_500' ? 'SPR-500' : seed}
        chassis={archive.selectedChassis}
        ascension={ascension}
        startDepth={mode === 'CAMPAIGN' ? startDepth : 0}
        trialId={mode === 'TRIAL' ? trialId : undefined}
        skipSeenDialogues={archive.skipSeenDialogues}
        enableTutorial={tutorialEnabled}
        onTutorialComplete={handleTutorialComplete}
        archive={archive}
        visualSettings={visualSettings}
        onCycleCrtMode={cycleCrtMode}
        onUpdateVisualSettings={updateVisualSettings}
        keyBindings={keyBindings}
        onUpdateKeyBindings={updateKeyBindings}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onFinishRun={handleFinishRun}
        onExitToTitle={() => setScreen('TITLE')}
        onGoToArchive={() => {
          setArchiveInitialTab('SHOP');
          setScreen('ARCHIVE');
        }}
        onRestartRun={() => setRunCounter((c) => c + 1)}
      />
    );
  }

  if (screen === 'DUEL') {
    return (
      <DuelView
        seed={seed}
        chassis={archive.selectedChassis}
        archive={archive}
        visualSettings={visualSettings}
        onCycleCrtMode={cycleCrtMode}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onExit={() => setScreen('TITLE')}
      />
    );
  }

  if (screen === 'ARCHIVE') {
    return (
      <ArchiveHub
        archive={archive}
        initialTab={archiveInitialTab}
        onUpdateArchive={setArchive}
        onBack={() => setScreen('TITLE')}
        onLaunchRun={handleStartGame}
        onLaunchChapter={(depth) => {
          setMode('CAMPAIGN');
          setStartDepth(depth);
          setRunCounter((c) => c + 1);
          soundEngine.init();
          setScreen('PLAYING');
        }}
      />
    );
  }

  return (
    <TitleScreen
      mode={mode}
      onSelectMode={(m) => {
        setMode(m);
        if (m !== 'ENDLESS') setIsDaily(false);
      }}
      trialId={trialId}
      onSelectTrial={setTrialId}
      seed={seed}
      onChangeSeed={setSeed}
      onRandomSeed={() => setSeed(generateRandomSeedCode())}
      isDaily={isDaily}
      onToggleDaily={handleToggleDaily}
      ascension={ascension}
      onChangeAscension={setAscension}
      startDepth={startDepth}
      onChangeStartDepth={setStartDepth}
      archive={archive}
      tutorialEnabled={tutorialEnabled}
      onToggleTutorial={() => setTutorialEnabled((v) => !v)}
      onToggleSkipDialogues={() => {
        const next = { ...archive, skipSeenDialogues: !archive.skipSeenDialogues };
        saveArchive(next);
        setArchive(next);
      }}
      soundEnabled={soundEnabled}
      onToggleSound={toggleSound}
      visualSettings={visualSettings}
      onUpdateVisualSettings={updateVisualSettings}
      keyBindings={keyBindings}
      onUpdateKeyBindings={updateKeyBindings}
      onSelectChassis={(id: ChassisId) => {
        if (!archive.unlockedChassis.includes(id)) return;
        const next = { ...archive, selectedChassis: id };
        saveArchive(next);
        setArchive(next);
      }}
      onStartGame={handleStartGame}
      onOpenArchive={() => {
        setArchiveInitialTab('SHOP');
        setScreen('ARCHIVE');
      }}
      onOpenCharacters={() => {
        setArchiveInitialTab('CHASSIS');
        setScreen('ARCHIVE');
      }}
      onOpenArtifacts={() => {
        setArchiveInitialTab('ARTIFACTS');
        setScreen('ARCHIVE');
      }}
      onReplayIntro={() => setScreen('INTRO')}
    />
  );
}
