// Procedural Multi-Theme Dynamic Soundtrack & Spatial Acoustic Engine for ESTRATO
// Stereo Spatial Acoustics, Convolution Cavern Reverb, 10 Distinct Multi-Bar Themes (A/B/C/D),
// Continuous Calm-to-Frenetic Morphing, Rhodes/FM/Supersaw Voices & Scale-Quantized FX.

import { StorySpeaker, StyleRank } from '../types/game';

export interface MusicDynamicContext {
  comboMult?: number;
  comboCount?: number;
  styleRank?: StyleRank;
  overdriveActive?: boolean;
  guardianActive?: boolean;
  guardianPhase2?: boolean;
  hazardActive?: boolean;
  inLastBreath?: boolean;
  feverActive?: boolean;
  activityLevel?: number;
  isFallingFast?: boolean;
}

export type MusicThemeId =
  | 'MENU'
  | 'STRATUM_1'
  | 'STRATUM_2'
  | 'STRATUM_3'
  | 'STRATUM_4'
  | 'STRATUM_5'
  | 'STRATUM_6'
  | 'STRATUM_7'
  | 'BOSS'
  | 'OVERDRIVE';

type LeadTimbre =
  | 'RHODES_BELL'
  | 'CRYSTAL_HARP'
  | 'VOLCANIC_BRASS'
  | 'NOIR_SYNTH'
  | 'QUANTUM_FM'
  | 'CELESTIAL_CHOIR'
  | 'COSMIC_LEAD'
  | 'BOSS_METAL'
  | 'OVERDRIVE_SUPERSAW';

interface ThemeConfig {
  id: MusicThemeId;
  title: string;
  rootHz: number;
  intervals: number[]; // Extended 2-octave scale
  calmBpm: number;
  freneticBpm: number;
  timbre: LeadTimbre;
  // 8-bar progression (1 chord per bar, semitones relative to rootHz * 2)
  chords: number[][];
  // 32-step (2-bar) composed motifs: >=0 = scale degree, -1 = rest, -2 = legato sustain
  melodyA: number[];
  melodyB: number[];
  melodyC: number[];
  melodyD: number[];
  counterMelody: number[];
  bassCalm: number[]; // 16-step sparse pulse
  bassDrive: number[]; // 32-step syncopated/driving groove
  arpPattern: number[]; // 16-step shimmering arpeggio
}

const THEMES: Record<MusicThemeId, ThemeConfig> = {
  // 0. MENU / HUB: Warm Rhodes + Iconic ESTRATO Leitmotif (D Dorian / F Maj9)
  MENU: {
    id: 'MENU',
    title: 'Horizonte Silencioso',
    rootHz: 73.42, // D2
    intervals: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 22, 24],
    calmBpm: 90,
    freneticBpm: 108,
    timbre: 'RHODES_BELL',
    chords: [
      [0, 3, 7, 14], // Dm9
      [-2, 2, 5, 9], // C6/9
      [-4, 0, 3, 7], // BbMaj7
      [-5, -2, 2, 7], // Am7
      [0, 3, 7, 10], // Dm7
      [5, 9, 12, 15], // Gm9
      [3, 7, 10, 14], // FMaj9
      [-5, 0, 4, 7], // Asus4->A
    ],
    melodyA: [
      7, -2, -2, -2, 9, -2, 10, -2, 11, -2, -2, -2, 9, -2, 7, -1,
      5, -2, -2, -2, 7, -2, 4, -2, 2, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyB: [
      7, -2, -2, -2, 10, -2, 11, -2, 12, -2, -2, -2, 11, -2, 10, -1,
      9, -2, 7, -2, 5, -2, 7, -2, 4, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyC: [
      11, -2, -2, 9, 10, -2, 11, -2, 14, -2, -2, 11, 10, -2, 9, -1,
      7, -2, 9, -2, 10, -2, 7, -2, 5, -2, -2, 4, 2, -2, -1, -1,
    ],
    melodyD: [
      7, -2, 9, -2, 10, -2, 11, -2, 12, -2, 11, -2, 10, -2, 9, -1,
      7, -2, -2, 5, 4, -2, 2, -2, 0, -2, -2, -2, -1, -1, -1, -1,
    ],
    counterMelody: [
      4, -2, -1, -1, 5, -2, -1, -1, 7, -2, -1, -1, 5, -2, 4, -1,
      2, -2, -1, -1, 4, -2, 0, -2, -1, -1, 2, -2, -1, -1, -1, -1,
    ],
    bassCalm: [0, -1, -1, -1, -1, -1, 4, -1, 0, -1, -1, -1, 2, -1, -1, -1],
    bassDrive: [
      0, -1, -1, 4, 0, -1, 4, -1, 2, -1, -1, 4, 5, -1, 4, -1,
      0, -1, 0, 4, 3, -1, 5, -1, 2, -1, 4, -1, 5, -1, 4, 2,
    ],
    arpPattern: [7, 9, 11, 14, 9, 11, 12, 9, 7, 10, 11, 14, 10, 9, 11, 7],
  },

  // I. CORTEZA: Atmospheric Explorer Leitmotif -> Punchy Industrial Synth Drive (D Dorian)
  STRATUM_1: {
    id: 'STRATUM_1',
    title: 'Corteza · Pulso de Acero',
    rootHz: 73.42, // D2
    intervals: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15, 17, 19, 21, 22, 24],
    calmBpm: 96,
    freneticBpm: 142,
    timbre: 'RHODES_BELL',
    chords: [
      [0, 3, 7, 10], // Dm7
      [0, 3, 7, 14], // Dm9
      [-2, 2, 5, 10], // C/D -> Bb/C feel
      [-4, 0, 3, 7], // BbMaj7
      [3, 7, 10, 14], // FMaj9
      [2, 5, 9, 12], // Em7/C
      [-4, 0, 3, 9], // BbMaj13
      [-5, -1, 2, 7], // A7sus4
    ],
    melodyA: [
      7, -2, -1, 7, 9, -2, 10, -2, 11, -2, 10, -2, 9, -2, 7, -1,
      5, -2, 7, -2, 4, -2, -1, 2, 4, -2, 5, -2, 4, -2, -1, -1,
    ],
    melodyB: [
      7, -2, 9, -2, 10, -2, 11, -2, 12, -2, 11, -2, 10, -2, 9, -1,
      10, -2, 9, -2, 7, -2, 5, -2, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyC: [
      11, -2, -1, 11, 12, -2, 14, -2, 11, -2, 10, -2, 9, -2, 10, -1,
      9, -2, -1, 9, 10, -2, 11, -2, 9, -2, 7, -2, 5, -2, -1, -1,
    ],
    melodyD: [
      14, -2, 12, -2, 11, -2, 10, -2, 11, -2, 9, -2, 7, -2, 5, -1,
      4, -2, 5, -2, 7, -2, 9, -2, 7, -2, -2, -2, 4, -2, -1, -1,
    ],
    counterMelody: [
      0, -2, -1, 4, 5, -2, 7, -2, 7, -2, 5, -2, 4, -2, 2, -1,
      2, -2, 4, -2, 0, -2, -1, -1, 2, -2, 4, -2, 0, -2, -1, -1,
    ],
    bassCalm: [0, -1, -1, -1, 4, -1, -1, -1, 0, -1, -1, -1, 5, -1, 4, -1],
    bassDrive: [
      0, -1, 0, 7, 0, -1, 6, 4, 0, -1, 0, 7, 5, -1, 4, 2,
      3, -1, 3, 7, 3, -1, 5, 4, 2, -1, 4, -1, 5, 4, 2, 0,
    ],
    arpPattern: [7, 10, 11, 9, 7, 11, 14, 10, 7, 9, 11, 10, 12, 10, 9, 7],
  },

  // II. FALLA: Crystalline Glass Harp & Lyrical Nocturne -> Sparkling Arpeggio Rush (F# Minor)
  STRATUM_2: {
    id: 'STRATUM_2',
    title: 'Falla · Espejos de Cuarzo',
    rootHz: 92.5, // F#2
    intervals: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24],
    calmBpm: 94,
    freneticBpm: 144,
    timbre: 'CRYSTAL_HARP',
    chords: [
      [0, 3, 7, 14], // F#m9
      [-2, 2, 5, 10], // Emaj7
      [-4, 0, 3, 7], // DMaj7
      [-5, -1, 2, 7], // C#m7
      [0, 3, 7, 12], // F#m
      [3, 7, 10, 14], // AMaj9
      [5, 8, 12, 15], // Bm9
      [-2, 3, 7, 10], // E6/F#m turn
    ],
    melodyA: [
      11, -2, 10, -2, 9, -2, 7, -1, 8, -2, 9, -2, 7, -2, 4, -1,
      5, -2, 7, -2, 8, -2, 7, -2, 4, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyB: [
      11, -2, 12, -2, 14, -2, 11, -1, 10, -2, 11, -2, 9, -2, 7, -1,
      5, -2, 4, -2, 2, -2, 4, -2, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyC: [
      14, -2, -1, 12, 11, -2, 9, -2, 10, -2, 11, -2, 12, -2, 14, -1,
      11, -2, -1, 10, 9, -2, 8, -2, 7, -2, -2, 5, 4, -2, -1, -1,
    ],
    melodyD: [
      7, -2, 9, -2, 11, -2, 14, -2, 12, -2, 11, -2, 10, -2, 9, -1,
      8, -2, 7, -2, 5, -2, 4, -2, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    counterMelody: [
      7, -2, -1, -1, 5, -2, 4, -1, 4, -2, 5, -2, 4, -2, 0, -1,
      2, -2, 4, -2, 5, -2, 4, -2, 0, -2, -1, -1, -1, -1, -1, -1,
    ],
    bassCalm: [0, -1, -1, 4, -1, -1, 7, -1, 3, -1, -1, 4, 2, -1, -1, -1],
    bassDrive: [
      0, 0, 7, 0, 4, -1, 7, 5, 3, 3, 7, 3, 5, -1, 4, 2,
      5, 5, 9, 5, 4, -1, 7, 4, 2, 2, 6, 4, 0, -1, 4, 7,
    ],
    arpPattern: [7, 9, 11, 14, 11, 9, 10, 12, 7, 10, 11, 14, 12, 11, 9, 8],
  },

  // III. MANTO: Hypnotic Volcanic Motif -> Tribal Fire Groove (C Phrygian)
  STRATUM_3: {
    id: 'STRATUM_3',
    title: 'Manto · Forja Obsidiana',
    rootHz: 65.41, // C2
    intervals: [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24],
    calmBpm: 100,
    freneticBpm: 148,
    timbre: 'VOLCANIC_BRASS',
    chords: [
      [0, 3, 7, 13], // Cm(b9)
      [1, 5, 8, 12], // DbMaj7
      [0, 3, 7, 10], // Cm7
      [1, 5, 8, 13], // DbMaj7#11 feel
      [3, 7, 10, 15], // EbMaj7
      [5, 8, 12, 15], // Fm9
      [1, 5, 8, 12], // DbMaj7
      [0, 4, 7, 10], // C7 dominant tension
    ],
    melodyA: [
      7, -2, 8, -2, 7, -2, 5, -1, 4, -2, 5, -2, 7, -2, 1, -1,
      0, -2, 1, -2, 3, -2, 4, -2, 5, -2, 4, -2, 1, -2, 0, -1,
    ],
    melodyB: [
      7, -2, 8, -2, 10, -2, 11, -1, 10, -2, 8, -2, 7, -2, 5, -1,
      4, -2, 5, -2, 7, -2, 8, -2, 7, -2, -2, 4, 5, -2, -1, -1,
    ],
    melodyC: [
      11, -2, -1, 10, 8, -2, 7, -2, 8, -2, 10, -2, 11, -2, 13, -1,
      11, -2, 10, -2, 8, -2, 7, -2, 5, -2, 4, -2, 1, -2, -1, -1,
    ],
    melodyD: [
      7, -2, 11, -2, 10, -2, 8, -2, 7, -2, 5, -2, 4, -2, 5, -1,
      7, -2, 4, -2, 1, -2, 4, -2, 0, -2, -2, -2, -1, -1, -1, -1,
    ],
    counterMelody: [
      0, -2, 1, -2, 0, -2, -1, -1, 1, -2, 0, -2, 4, -2, -1, -1,
      3, -2, 4, -2, 5, -2, 7, -2, 4, -2, 1, -2, 0, -2, -1, -1,
    ],
    bassCalm: [0, -1, 1, -1, 0, -1, 4, -1, 0, -1, 1, -1, 5, -1, 4, -1],
    bassDrive: [
      0, 0, -1, 1, 0, 0, 4, 1, 0, 0, -1, 5, 4, 1, 0, -1,
      3, 3, -1, 4, 5, 5, 4, 1, 0, 1, 4, 5, 4, 1, 0, -1,
    ],
    arpPattern: [7, 8, 10, 11, 8, 7, 10, 12, 7, 8, 11, 13, 8, 7, 10, 8],
  },

  // IV. PRESIÓN: Atmospheric Synth-Noir Rhodes -> Deep Neon Drive (A Harmonic Minor)
  STRATUM_4: {
    id: 'STRATUM_4',
    title: 'Presión · Abismo de Neón',
    rootHz: 55.0, // A1
    intervals: [0, 2, 3, 5, 7, 8, 11, 12, 14, 15, 17, 19, 20, 23, 24],
    calmBpm: 92,
    freneticBpm: 146,
    timbre: 'NOIR_SYNTH',
    chords: [
      [0, 3, 7, 11], // Am(Maj7)
      [5, 8, 12, 14], // Dm9
      [3, 7, 11, 14], // C+(Maj7)
      [-5, -1, 2, 7], // E7sus4/E
      [0, 3, 7, 14], // Am9
      [-4, 0, 3, 7], // FMaj7
      [-7, -4, 0, 3], // Dm7
      [-5, -1, 2, 8], // E7b9
    ],
    melodyA: [
      7, -2, 6, -2, 7, -2, -2, -1, 9, -2, 8, -2, 7, -2, 4, -1,
      5, -2, 6, -2, 7, -2, 8, -2, 6, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyB: [
      11, -2, 10, -2, 9, -2, 7, -1, 8, -2, 7, -2, 6, -2, 4, -1,
      5, -2, 4, -2, 3, -2, 2, -2, 4, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyC: [
      14, -2, 13, -2, 14, -2, 11, -1, 10, -2, 9, -2, 8, -2, 7, -1,
      6, -2, 7, -2, 8, -2, 10, -2, 11, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyD: [
      14, -2, 12, -2, 11, -2, 10, -2, 9, -2, 8, -2, 7, -2, 6, -1,
      4, -2, 6, -2, 7, -2, 9, -2, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    counterMelody: [
      0, -2, 2, -2, 3, -2, -1, -1, 5, -2, 4, -2, 3, -2, 0, -1,
      2, -2, 3, -2, 4, -2, 5, -2, 2, -2, -1, -1, -1, -1, -1, -1,
    ],
    bassCalm: [0, -1, -1, 4, -1, -1, 3, -1, 5, -1, -1, 4, 2, -1, -1, -1],
    bassDrive: [
      0, 0, 7, -1, 0, 4, 6, -1, 5, 5, 7, -1, 4, 2, 1, -1,
      0, 0, 7, 4, 3, 5, 7, -1, 2, 4, 6, 4, 2, 1, 0, -1,
    ],
    arpPattern: [7, 10, 11, 13, 10, 8, 11, 14, 7, 9, 10, 13, 11, 9, 8, 10],
  },

  // V. SINGULARIDAD: Precision Clockwork FM -> Kaleidoscopic Arpeggio Storm (E Phrygian Dominant)
  STRATUM_5: {
    id: 'STRATUM_5',
    title: 'Singularidad · Reloj Cuántico',
    rootHz: 82.41, // E2
    intervals: [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19, 20, 22, 24],
    calmBpm: 102,
    freneticBpm: 150,
    timbre: 'QUANTUM_FM',
    chords: [
      [0, 4, 7, 10], // E7
      [1, 5, 8, 12], // FMaj7
      [3, 7, 10, 13], // Gm7b5/C feel
      [1, 4, 8, 12], // Fmaj7#5
      [0, 4, 7, 13], // E7b9
      [5, 8, 12, 16], // AmMaj7
      [1, 5, 8, 10], // Fmaj7/G
      [0, 4, 7, 12], // E
    ],
    melodyA: [
      7, 9, 8, -2, 7, 5, 4, -2, 7, 8, 9, 11, 9, 8, 7, -1,
      5, 7, 8, -2, 7, 4, 2, -2, 4, 5, 7, 8, 7, 4, 1, -1,
    ],
    melodyB: [
      7, 9, 11, -2, 12, 11, 9, -2, 8, 9, 11, 12, 14, 12, 11, -1,
      9, 8, 7, -2, 5, 4, 2, -2, 1, 2, 4, 5, 4, -2, -1, -1,
    ],
    melodyC: [
      11, -2, 9, 8, 7, 8, 9, 11, 12, -2, 11, 9, 8, 9, 11, -1,
      9, -2, 8, 7, 5, 7, 8, 9, 7, -2, 5, 4, 2, 4, 1, -1,
    ],
    melodyD: [
      7, 9, 11, 14, 12, 11, 9, 8, 7, 9, 11, 9, 8, 7, 5, 4,
      2, 4, 5, 7, 8, 9, 11, 12, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    counterMelody: [
      0, 2, 4, -2, 5, 4, 2, -2, 4, 5, 7, 8, 7, 5, 4, -1,
      1, 2, 4, -2, 5, 2, 0, -2, 1, 2, 4, 5, 4, 2, 0, -1,
    ],
    bassCalm: [0, -1, 1, -1, 4, -1, 1, -1, 0, -1, 5, -1, 4, -1, 1, -1],
    bassDrive: [
      0, -1, 7, 0, 1, -1, 7, 1, 4, -1, 7, 4, 5, -1, 4, 1,
      0, 0, 7, 4, 1, 1, 8, 4, 2, -1, 5, 4, 2, 1, 0, 4,
    ],
    arpPattern: [7, 9, 11, 8, 9, 11, 12, 9, 7, 8, 11, 14, 11, 9, 8, 11],
  },

  // VI. NÚCLEO INCONEXO: Transcendent Radiant Light Beauty (C Lydian)
  STRATUM_6: {
    id: 'STRATUM_6',
    title: 'Núcleo Inconexo · Luz Inmóvil',
    rootHz: 65.41, // C2
    intervals: [0, 2, 4, 6, 7, 9, 11, 12, 14, 16, 18, 19, 21, 23, 24],
    calmBpm: 90,
    freneticBpm: 138,
    timbre: 'CELESTIAL_CHOIR',
    chords: [
      [0, 4, 7, 11], // CMaj7
      [2, 6, 9, 14], // D/C -> D9
      [4, 7, 11, 18], // EmMaj7#11 feel
      [0, 4, 9, 14], // C6/9
      [7, 11, 14, 18], // GMaj7#11
      [2, 6, 9, 12], // D7
      [3, 7, 11, 14], // F#m7b5 -> Em9
      [0, 4, 7, 14], // CMaj9
    ],
    melodyA: [
      11, -2, -2, 10, 9, -2, -2, 7, 6, -2, 7, -2, 9, -2, -2, -1,
      10, -2, -2, 9, 7, -2, 6, -2, 4, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyB: [
      11, -2, 12, -2, 14, -2, -2, 11, 10, -2, 9, -2, 7, -2, -2, -1,
      9, -2, 10, -2, 11, -2, 9, -2, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyC: [
      14, -2, -2, 12, 11, -2, 10, -2, 11, -2, 14, -2, 12, -2, -2, -1,
      11, -2, 10, -2, 9, -2, 7, -2, 6, -2, 7, -2, 9, -2, -1, -1,
    ],
    melodyD: [
      7, -2, 9, -2, 10, -2, 11, -2, 14, -2, 12, -2, 11, -2, 10, -1,
      9, -2, 7, -2, 6, -2, 4, -2, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    counterMelody: [
      4, -2, -2, 6, 7, -2, -2, 4, 2, -2, 4, -2, 6, -2, -2, -1,
      6, -2, -2, 4, 2, -2, 0, -2, 2, -2, -2, -2, -1, -1, -1, -1,
    ],
    bassCalm: [0, -1, -1, -1, 4, -1, -1, -1, 2, -1, -1, -1, 4, -1, -1, -1],
    bassDrive: [
      0, -1, 4, -1, 7, -1, 4, -1, 2, -1, 6, -1, 7, -1, 6, 4,
      4, -1, 7, -1, 9, -1, 7, -1, 0, -1, 4, -1, 7, -1, 4, 2,
    ],
    arpPattern: [7, 9, 10, 11, 14, 11, 10, 9, 7, 10, 11, 14, 12, 11, 10, 9],
  },

  // VII. HORIZONTE DE EVENTOS: Heroic Cosmic Finale Reprise (G Minor / Harmonic)
  STRATUM_7: {
    id: 'STRATUM_7',
    title: 'Horizonte · Colapso Estelar',
    rootHz: 98.0, // G2
    intervals: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 22, 24],
    calmBpm: 100,
    freneticBpm: 152,
    timbre: 'COSMIC_LEAD',
    chords: [
      [0, 3, 7, 10], // Gm7
      [-4, 0, 3, 7], // EbMaj7
      [-2, 2, 5, 10], // F6
      [-5, -2, 2, 7], // Dm7
      [0, 3, 7, 14], // Gm9
      [5, 8, 12, 15], // Cm9
      [-4, 0, 3, 9], // EbMaj13
      [-5, -1, 2, 7], // D7sus4
    ],
    melodyA: [
      7, -2, -1, 7, 9, -2, 10, -2, 11, -2, 10, -2, 9, -2, 7, -1,
      8, -2, 9, -2, 10, -2, 11, -2, 9, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyB: [
      11, -2, 12, -2, 14, -2, 11, -1, 10, -2, 11, -2, 9, -2, 7, -1,
      5, -2, 7, -2, 8, -2, 9, -2, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    melodyC: [
      14, -2, 14, -1, 12, -2, 11, -2, 10, -2, 11, -2, 12, -2, 14, -1,
      11, -2, 10, -2, 9, -2, 8, -2, 9, -2, 10, -2, 11, -2, -1, -1,
    ],
    melodyD: [
      14, -2, 12, -2, 11, -2, 10, -2, 11, -2, 10, -2, 9, -2, 7, -1,
      8, -2, 7, -2, 5, -2, 4, -2, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    counterMelody: [
      0, -2, -1, 0, 2, -2, 3, -2, 4, -2, 3, -2, 2, -2, 0, -1,
      1, -2, 2, -2, 3, -2, 4, -2, 2, -2, -1, -1, -1, -1, -1, -1,
    ],
    bassCalm: [0, -1, 4, -1, 5, -1, 4, -1, 0, -1, 5, -1, 3, -1, 2, -1],
    bassDrive: [
      0, 0, 7, 0, 4, 4, 7, 5, 3, 3, 7, 3, 2, 4, 6, 4,
      0, 0, 7, 0, 5, 5, 8, 5, 3, 5, 7, 8, 6, 4, 2, 0,
    ],
    arpPattern: [7, 10, 11, 14, 11, 10, 8, 11, 7, 9, 11, 14, 12, 11, 10, 9],
  },

  // GUARDIAN BOSS: Ferocious Boss Fight Theme (E Minor)
  BOSS: {
    id: 'BOSS',
    title: 'Guardián del Estrato',
    rootHz: 82.41, // E2
    intervals: [0, 1, 3, 5, 7, 8, 10, 12, 13, 15, 17, 19, 20, 22, 24],
    calmBpm: 134,
    freneticBpm: 154,
    timbre: 'BOSS_METAL',
    chords: [
      [0, 3, 7, 12],
      [1, 5, 8, 12],
      [3, 7, 10, 15],
      [1, 7, 10, 13],
      [0, 4, 7, 10],
      [5, 8, 12, 15],
      [3, 7, 10, 14],
      [1, 4, 7, 12],
    ],
    melodyA: [
      7, -1, 7, 8, 7, -1, 10, -2, 7, -1, 8, 7, 5, 4, 1, 0,
      7, -1, 7, 8, 10, -2, 11, -2, 10, 8, 7, 5, 4, -2, -1, -1,
    ],
    melodyB: [
      11, -1, 11, 12, 14, -2, 11, -1, 10, -1, 10, 11, 10, 8, 7, -1,
      8, 7, 5, 4, 7, 5, 4, 1, 0, -2, 4, -2, 7, -2, -1, -1,
    ],
    melodyC: [
      14, -2, 11, 10, 8, -2, 10, 11, 12, -2, 11, 10, 8, 7, 5, -1,
      7, 8, 10, 11, 10, 8, 7, 5, 4, 5, 7, 8, 7, -2, -1, -1,
    ],
    melodyD: [
      7, 8, 10, 11, 14, -2, 11, 10, 11, 12, 14, 12, 11, 10, 8, 7,
      5, 7, 8, 10, 8, 7, 5, 4, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    counterMelody: [
      0, -1, 0, 1, 0, -1, 4, -2, 0, -1, 1, 0, 3, 2, 1, 0,
      0, -1, 0, 1, 3, -2, 4, -2, 3, 1, 0, 3, 2, -2, -1, -1,
    ],
    bassCalm: [0, 0, 4, 1, 0, 0, 5, 4, 0, 0, 6, 4, 1, 0, 4, 1],
    bassDrive: [
      0, 0, 7, 0, 1, 0, 7, 0, 0, 0, 8, 7, 5, 4, 1, 0,
      0, 0, 7, 0, 3, 3, 7, 4, 5, 5, 8, 7, 4, 1, 0, 7,
    ],
    arpPattern: [7, 8, 11, 14, 11, 8, 7, 10, 7, 8, 11, 13, 11, 10, 8, 7],
  },

  // OVERDRIVE / FEVER: High-Adrenaline Euphoric Climax Anthem (D Dorian -> Mixolydian Lift)
  OVERDRIVE: {
    id: 'OVERDRIVE',
    title: 'Sobrecarga · Ascenso Total',
    rootHz: 73.42, // D2 (matches global stratum key dynamically!)
    intervals: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21, 22, 24],
    calmBpm: 142,
    freneticBpm: 156,
    timbre: 'OVERDRIVE_SUPERSAW',
    chords: [
      [0, 4, 7, 14],
      [-2, 2, 7, 10],
      [-4, 0, 4, 9],
      [2, 7, 10, 14],
      [0, 4, 7, 10],
      [5, 9, 12, 16],
      [4, 7, 10, 14],
      [-2, 4, 7, 14],
    ],
    melodyA: [
      7, -1, 9, 10, 11, -2, 14, -2, 12, -2, 11, -2, 10, 9, 7, -1,
      9, -1, 10, 11, 12, -2, 14, -2, 11, -2, 10, -2, 9, -2, -1, -1,
    ],
    melodyB: [
      14, -1, 14, 12, 11, -2, 14, -2, 12, -2, 11, 9, 7, -2, -1, -1,
      10, -1, 11, 12, 14, -2, 11, -2, 9, -2, 7, -2, 7, -2, -1, -1,
    ],
    melodyC: [
      11, 12, 14, -2, 11, 12, 14, -2, 12, 11, 10, 9, 7, 9, 10, 11,
      14, -2, 12, 11, 10, -2, 9, 7, 9, 10, 11, 12, 14, -2, -1, -1,
    ],
    melodyD: [
      14, -2, 12, 14, 11, -2, 10, 11, 9, -2, 7, 9, 10, -2, 11, -2,
      12, -2, 11, -2, 10, -2, 9, -2, 7, -2, -2, -2, -1, -1, -1, -1,
    ],
    counterMelody: [
      4, -1, 5, 7, 7, -2, 11, -2, 9, -2, 7, -2, 6, 5, 4, -1,
      5, -1, 7, 7, 9, -2, 11, -2, 7, -2, 6, -2, 5, -2, -1, -1,
    ],
    bassCalm: [0, 7, 0, 7, 5, 7, 5, 7, 4, 7, 4, 7, 5, 4, 2, 0],
    bassDrive: [
      0, 7, 0, 7, 0, 7, 6, 7, 5, 7, 5, 7, 4, 7, 2, 7,
      3, 7, 3, 7, 5, 9, 5, 7, 2, 7, 4, 7, 5, 6, 7, 9,
    ],
    arpPattern: [7, 10, 11, 14, 12, 11, 10, 14, 7, 11, 14, 12, 11, 9, 10, 11],
  },
};

const STRATUM_THEME_IDS: MusicThemeId[] = [
  'STRATUM_1',
  'STRATUM_2',
  'STRATUM_3',
  'STRATUM_4',
  'STRATUM_5',
  'STRATUM_6',
  'STRATUM_7',
];

export function resolveMusicThemeId(
  stratum: number,
  isPlaying: boolean,
  dyn: MusicDynamicContext = {}
): MusicThemeId {
  if (!isPlaying) return 'MENU';
  if (dyn.guardianActive) return 'BOSS';
  if (dyn.overdriveActive || dyn.feverActive) return 'OVERDRIVE';
  const idx = Math.max(0, Math.min(STRATUM_THEME_IDS.length - 1, Math.floor(stratum) - 1));
  return STRATUM_THEME_IDS[idx];
}

function semiToHz(rootHz: number, semitones: number): number {
  return rootHz * Math.pow(2, semitones / 12);
}

function makeSoftClipCurve(amount = 24): Float32Array<ArrayBuffer> {
  const n = 256;
  const buf = new ArrayBuffer(n * 4);
  const curve = new Float32Array(buf);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private musicVolGain: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sidechainGain: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private reverbSend: GainNode | null = null;
  private bossDistortion: WaveShaperNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private enabled = true;
  private musicVolume = 0.78;
  private sfxVolume = 0.9;
  private bpm = 96;
  private lastTickTime = 0;
  private stepPhase = 0;
  private totalSteps = 0;
  private polyCounter = 0;
  private lowOxygenMode = false;
  private musicEnergy = 0.14;
  private activityEnergy = 0;
  private lastActivityMs = 0;
  private activeStratumId = 1;
  private activeThemeId: MusicThemeId = 'MENU';
  private visibilityBound = false;

  public init() {
    if (!this.visibilityBound && typeof document !== 'undefined') {
      this.visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.lastTickTime = 0;
          this.stepPhase = 0;
        } else if (this.ctx && this.ctx.state === 'suspended' && this.enabled) {
          this.ctx.resume().catch(() => {});
        }
      });
    }

    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -13;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 3.8;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.enabled ? 0.54 : 0;

      this.musicVolGain = this.ctx.createGain();
      this.musicVolGain.gain.value = this.musicVolume;

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume;

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 11500;
      this.musicFilter.Q.value = 0.9;

      this.sidechainGain = this.ctx.createGain();
      this.sidechainGain.gain.value = 1.0;

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.9;

      this.bossDistortion = this.ctx.createWaveShaper();
      this.bossDistortion.curve = makeSoftClipCurve(22);
      this.bossDistortion.oversample = '2x';

      // Stereo cavern convolution + dual cross-delay acoustic send
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.34;

      try {
        const sr = this.ctx.sampleRate;
        const irLen = Math.floor(sr * 1.45);
        const ir = this.ctx.createBuffer(2, irLen, sr);
        for (let ch = 0; ch < 2; ch++) {
          const d = ir.getChannelData(ch);
          for (let i = 0; i < irLen; i++) {
            const t = i / irLen;
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.9) * (i < 1100 ? i / 1100 : 1);
          }
        }
        const convolver = this.ctx.createConvolver();
        convolver.buffer = ir;
        const convFilter = this.ctx.createBiquadFilter();
        convFilter.type = 'lowpass';
        convFilter.frequency.value = 3100;
        const convGain = this.ctx.createGain();
        convGain.gain.value = 0.44;
        this.reverbSend.connect(convolver);
        convolver.connect(convFilter);
        convFilter.connect(convGain);
        convGain.connect(this.compressor);
      } catch {
        // Fallback smoothly if Convolver unavailable
      }

      const delayL = this.ctx.createDelay(0.8);
      delayL.delayTime.value = 0.19;
      const delayR = this.ctx.createDelay(0.8);
      delayR.delayTime.value = 0.27;
      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 2300;
      const delayFeedback = this.ctx.createGain();
      delayFeedback.gain.value = 0.26;

      this.reverbSend.connect(delayL);
      delayL.connect(delayFilter);
      delayFilter.connect(delayR);
      delayR.connect(delayFeedback);
      delayFeedback.connect(delayL);
      delayFilter.connect(this.compressor);
      delayR.connect(this.compressor);

      // Music routing: musicBus -> sidechainGain -> musicFilter -> musicVolGain -> compressor
      this.musicBus.connect(this.sidechainGain);
      this.sidechainGain.connect(this.musicFilter);
      this.musicFilter.connect(this.musicVolGain);
      this.musicVolGain.connect(this.compressor);

      // SFX routing: sfxBus -> compressor -> masterGain -> destination
      this.sfxBus.connect(this.compressor);
      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // 1s white noise buffer for tactile rock/steam/acid transients
      const sampleRate = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < sampleRate; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.lastTickTime = this.ctx.currentTime;
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private getOutputNode(): AudioNode | null {
    return this.sfxBus || this.compressor;
  }

  private panFromCol(col?: number): number {
    if (col === undefined || Number.isNaN(col)) return 0;
    return Math.max(-0.82, Math.min(0.82, (col - 4) / 4.2));
  }

  private routePanned(
    node: AudioNode,
    col?: number,
    sendReverb = false,
    toMusicBus = false,
    bypassSidechain = false
  ) {
    if (!this.ctx) return;
    const baseDest = toMusicBus
      ? bypassSidechain && this.musicFilter
        ? this.musicFilter
        : this.musicBus
      : this.sfxBus || this.compressor;
    if (!baseDest) return;

    const panVal = this.panFromCol(col);
    if (Math.abs(panVal) > 0.02 && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = panVal;
      node.connect(panner);
      panner.connect(baseDest);
      if (sendReverb && this.reverbSend) panner.connect(this.reverbSend);
    } else {
      node.connect(baseDest);
      if (sendReverb && this.reverbSend) node.connect(this.reverbSend);
    }
  }

  private getActiveTheme(): ThemeConfig {
    return THEMES[this.activeThemeId] || THEMES.STRATUM_1;
  }

  private getCurrentScale(): ThemeConfig {
    return THEMES[STRATUM_THEME_IDS[Math.max(0, Math.min(STRATUM_THEME_IDS.length - 1, this.activeStratumId - 1))]];
  }

  private spawnNoiseBurst(
    duration: number,
    filterType: BiquadFilterType,
    freqStart: number,
    freqEnd: number,
    gainPeak: number,
    q = 1.2,
    delayOffset = 0,
    sendReverb = false,
    toMusicBus = false,
    col?: number
  ) {
    if (!this.ctx || !this.noiseBuffer || !this.compressor) return;
    const now = this.ctx.currentTime + delayOffset;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freqStart, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    this.routePanned(gain, col, sendReverb, toMusicBus, true);

    src.start(now, Math.random() * 0.4, duration + 0.02);
    src.stop(now + duration + 0.03);
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(val ? 0.54 : 0, this.ctx.currentTime, 0.03);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    if (this.musicVolGain && this.ctx) {
      this.musicVolGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.04);
    }
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.04);
    }
  }

  public setBPM(bpm: number) {
    this.bpm = Math.max(70, Math.min(180, bpm));
  }

  public setMusicIntensity(intensity: number) {
    this.musicEnergy = Math.max(0.08, Math.min(1, intensity));
  }

  public pulseActivity(amount: number) {
    this.activityEnergy = Math.min(1.0, this.activityEnergy + Math.max(0, amount));
    this.lastActivityMs = Date.now();
  }

  public getMusicDebugState(): {
    themeId: MusicThemeId;
    bpm: number;
    energy: number;
    activityEnergy: number;
    totalSteps: number;
  } {
    return {
      themeId: this.activeThemeId,
      bpm: Number(this.bpm.toFixed(1)),
      energy: Number(this.musicEnergy.toFixed(3)),
      activityEnergy: Number(this.activityEnergy.toFixed(3)),
      totalSteps: this.totalSteps,
    };
  }

  public getBeatPhase(): number {
    if (!this.ctx) return 0;
    return ((this.totalSteps % 4) + Math.min(0.999, Math.max(0, this.stepPhase))) / 4;
  }

  public isOnBeat(tolerance = 0.22): boolean {
    const phase = this.getBeatPhase();
    return phase <= tolerance || phase >= 1 - tolerance;
  }

  public setLowOxygen(low: boolean) {
    if (this.lowOxygenMode === low) return;
    this.lowOxygenMode = low;
    if (this.musicFilter && this.ctx) {
      this.musicFilter.frequency.setTargetAtTime(low ? 540 : 11500, this.ctx.currentTime, 0.14);
    }
  }

  public tickMenuMusic() {
    this.tickMetronome(1, false, false, {});
  }

  // Dynamic Multi-Theme 16th-Note Adaptive Soundtrack Engine
  public tickMetronome(
    stratum: number,
    isPlaying: boolean,
    hasIgnition = false,
    dyn: MusicDynamicContext = {}
  ) {
    this.activeStratumId = Math.max(1, Math.min(STRATUM_THEME_IDS.length, Math.floor(stratum) || 1));
    const nextThemeId = resolveMusicThemeId(this.activeStratumId, isPlaying, dyn);
    this.activeThemeId = nextThemeId;
    const theme = this.getActiveTheme();

    // Smooth decay of player activity impulse over ~6.5s when idle
    if (typeof dyn.activityLevel === 'number') {
      this.activityEnergy = Math.max(this.activityEnergy * 0.92, Math.min(1, dyn.activityLevel));
    } else {
      const idleMs = Date.now() - this.lastActivityMs;
      const decayRate = idleMs > 1800 ? 0.014 : 0.006;
      this.activityEnergy = Math.max(0, this.activityEnergy - decayRate);
    }

    const comboMult = dyn.comboMult ?? 1;
    const styleBonus =
      dyn.styleRank === 'SSS'
        ? 0.42
        : dyn.styleRank === 'SS'
        ? 0.34
        : dyn.styleRank === 'S'
        ? 0.25
        : dyn.styleRank === 'A'
        ? 0.15
        : dyn.styleRank === 'B'
        ? 0.08
        : 0;
    const isBoss = Boolean(dyn.guardianActive);
    const isPhase2 = Boolean(dyn.guardianPhase2);
    const isHype = Boolean(dyn.overdriveActive || dyn.feverActive);

    let targetEnergy = 0.14;
    if (isPlaying) {
      targetEnergy =
        0.14 +
        this.activityEnergy * 0.44 +
        (hasIgnition ? 0.24 : 0) +
        Math.min(0.28, Math.max(0, comboMult - 1) * 0.08) +
        styleBonus +
        (dyn.hazardActive ? 0.22 : 0) +
        (dyn.isFallingFast ? 0.12 : 0);
      if (isHype) targetEnergy = Math.max(targetEnergy, 0.88);
      if (isBoss) targetEnergy = Math.max(targetEnergy, isPhase2 ? 1.0 : 0.88);
      targetEnergy = Math.max(0.12, Math.min(1.0, targetEnergy));
    }

    const rampRate = targetEnergy > this.musicEnergy ? 0.075 : 0.018;
    this.musicEnergy += (targetEnergy - this.musicEnergy) * rampRate;

    const targetBpm =
      theme.calmBpm + (theme.freneticBpm - theme.calmBpm) * Math.pow(this.musicEnergy, 1.08);
    this.bpm += (targetBpm - this.bpm) * 0.04;

    if (!this.enabled || !this.ctx || !this.musicBus || !this.musicFilter) return;

    const now = this.ctx.currentTime;
    const dt = this.lastTickTime > 0 ? Math.max(0, Math.min(0.09, now - this.lastTickTime)) : 0;
    this.lastTickTime = now;

    // Continuous phase accumulator prevents tempo-ramp phase jumps!
    this.stepPhase += dt * (this.bpm / 60) * 4;
    let stepsThisTick = 0;
    while (this.stepPhase >= 1 && stepsThisTick < 2) {
      this.stepPhase -= 1;
      stepsThisTick++;
      this.scheduleMusicStep(this.totalSteps, theme, isPlaying, hasIgnition, dyn);
      this.totalSteps++;
    }
  }

  private scheduleMusicStep(
    stepIdx: number,
    theme: ThemeConfig,
    isPlaying: boolean,
    hasIgnition: boolean,
    dyn: MusicDynamicContext
  ) {
    if (!this.ctx || !this.musicBus) return;
    const now = this.ctx.currentTime;
    const sixteenthDur = 60 / this.bpm / 4;
    const step16 = ((stepIdx % 16) + 16) % 16;
    const step32 = ((stepIdx % 32) + 32) % 32;
    const barCount = Math.floor(stepIdx / 16);
    const barInChorus = ((barCount % 8) + 8) % 8;
    const energy = this.musicEnergy;
    const isBoss = theme.id === 'BOSS';
    const isPhase2 = Boolean(dyn.guardianPhase2);
    const isHype = energy >= 0.72 || theme.id === 'OVERDRIVE';

    // When Overdrive is active, root stays anchored to current Stratum for harmonic continuity!
    const rootHz =
      theme.id === 'OVERDRIVE' ? this.getCurrentScale().rootHz : theme.rootHz;

    // Dynamic brightness sweeps naturally with energy
    if (!this.lowOxygenMode && this.musicFilter) {
      const targetFilterHz = 2600 + energy * 9200;
      this.musicFilter.frequency.setTargetAtTime(targetFilterHz, now, 0.08);
    }

    // 1. Kick & Sidechain + Heartbeat
    const grooveKick =
      isPlaying &&
      energy > 0.27 &&
      (step16 % 4 === 0 ||
        (energy > 0.62 && step16 === 14) ||
        (energy > 0.78 && step16 === 6) ||
        (isBoss && step16 === 10));
    if (grooveKick) {
      const isDownbeat = step16 === 0;
      const isGhost = step16 === 14 || step16 === 10 || step16 === 6;
      const kickAmp = (isDownbeat ? 0.24 : isGhost ? 0.11 : 0.18) * Math.min(1, 0.35 + energy * 0.75);
      this.playTightKick(now, isBoss, isDownbeat, isGhost, kickAmp);

      if (this.sidechainGain && step16 % 4 === 0 && energy > 0.35) {
        const duckDepth = 1 - Math.min(0.45, energy * 0.45);
        this.sidechainGain.gain.cancelScheduledValues(now);
        this.sidechainGain.gain.setValueAtTime(duckDepth, now);
        this.sidechainGain.gain.linearRampToValueAtTime(1.0, now + sixteenthDur * 1.75);
      }
    }

    if (dyn.inLastBreath && step16 === 0) {
      this.playHeartbeatDouble(now);
    }

    // 2. Percussion & 4-Bar / 8-Bar Transitional Fills
    if (isPlaying && !this.lowOxygenMode) {
      // Soft shaker / closed hats from energy 0.24+
      if (energy > 0.24) {
        if (step16 % 4 === 2) {
          this.spawnNoiseBurst(
            0.048,
            'highpass',
            5600,
            3400,
            0.036 * energy,
            1.4,
            0,
            false,
            true,
            step16 === 2 ? 2.6 : 5.4
          );
        } else if (energy > 0.54 && step16 % 2 === 1) {
          this.spawnNoiseBurst(0.022, 'bandpass', 7600, 5000, 0.018 * energy, 2.1, 0, false, true, 3.1);
        } else if (energy > 0.84) {
          this.spawnNoiseBurst(0.016, 'highpass', 8800, 6200, 0.014 * energy, 1.8, 0, false, true, 4.9);
        }
      }

      // Snare on beats 2 & 4 + Fill rolls at end of bar 4 & bar 8
      const isFillZone = (barInChorus === 3 || barInChorus === 7) && step16 >= 12 && energy > 0.52;
      if (((step16 === 4 || step16 === 12) && energy > 0.38) || (isFillZone && step16 % 2 === 0)) {
        const snareAmp = isFillZone ? 0.048 * energy : (isBoss ? 0.082 : 0.062) * energy;
        this.playSnare(now, snareAmp, isBoss);
      }

      // War toms on frenetic/Volcanic/Boss phrases
      if ((isBoss || (theme.id === 'STRATUM_3' && energy > 0.62) || isFillZone) && (step16 === 13 || step16 === 15)) {
        this.playTom(now, step16 === 13 ? 178 : 138, 0.08 * energy, step16 === 13 ? 2.0 : 6.0);
      }

      // Cymbal crash accent at chorus loop start (Bar 0 beat 0) when energetic
      if (barInChorus === 0 && step16 === 0 && energy > 0.6) {
        this.spawnNoiseBurst(0.42, 'highpass', 3600, 7200, 0.045 * energy, 0.7, 0, true, true, 4);
      }
    }

    // 3. Evolving Lush Stereo Chord Pad / Warm Rhodes Voicing (Every Bar!)
    if (step16 === 0 && !this.lowOxygenMode) {
      const chord = theme.chords[barInChorus % theme.chords.length] || [0, 3, 7, 10];
      const holdBars = energy < 0.32 ? 2 : 1;
      if (barInChorus % holdBars === 0) {
        const chordDur = sixteenthDur * 15.5 * holdBars;
        this.playStereoPadChord(now, rootHz, chord, chordDur, energy, theme.timbre);
      }
    }

    // 4. Layered Bassline (Warm calm root pulse -> Full driving syncopated groove)
    const useDriveBass = isPlaying && energy > 0.34;
    const bassDeg = useDriveBass ? theme.bassDrive[step32 % theme.bassDrive.length] : theme.bassCalm[step16];
    if (bassDeg >= 0) {
      const semi = theme.intervals[bassDeg % theme.intervals.length];
      const bassHz = semiToHz(rootHz, semi);
      const isAccent = step16 % 4 === 0 || step16 % 4 === 2;
      this.playLayeredBass(now, bassHz, sixteenthDur, energy, isBoss, useDriveBass, isAccent);
    }

    // 5. Shimmering Counter-Rhythm Arpeggiator
    const arpActive = isPlaying
      ? energy > 0.75 || (energy > 0.25 && step16 % 2 === 0) || step16 % 4 === 0
      : step16 % 4 === 0;
    if (arpActive && !this.lowOxygenMode) {
      this.polyCounter = (this.polyCounter + 1) % 7;
      const deg = theme.arpPattern[(step16 + barCount * 2) % theme.arpPattern.length];
      const octaveShift = (isHype || hasIgnition) && this.polyCounter % 3 === 0 ? 12 : 0;
      const arpHz = semiToHz(rootHz * 2, theme.intervals[deg % theme.intervals.length] + octaveShift);
      const arpAmp = (isPlaying ? 0.028 + energy * 0.032 : 0.032);
      this.playFmPluck(now, arpHz, isPlaying ? 0.22 : 0.38, arpAmp, energy, step16 % 2 === 0 ? 2.5 : 5.5);
    }

    // 6. Primary Expressive Multi-Section Lead Melody (Bars 0-1 A, 2-3 B, 4-5 C, 6-7 D)
    const sectionIdx = Math.floor(barInChorus / 2) % 4;
    const sectionArr =
      sectionIdx === 0
        ? theme.melodyA
        : sectionIdx === 1
        ? theme.melodyB
        : sectionIdx === 2
        ? theme.melodyC
        : theme.melodyD;
    const leadDeg = sectionArr[step32 % sectionArr.length];
    if (leadDeg >= 0 && !this.lowOxygenMode) {
      // Measure legato sustain length via trailing `-2` tokens
      let holdSteps = 1;
      for (let k = 1; k <= 6; k++) {
        const nextIdx = (step32 + k) % sectionArr.length;
        if (sectionArr[nextIdx] === -2) holdSteps++;
        else break;
      }
      const noteDur = Math.max(sixteenthDur * 0.9, holdSteps * sixteenthDur * 0.94);
      const semi = theme.intervals[leadDeg % theme.intervals.length] + (isPhase2 || energy > 0.88 ? 12 : 0);
      const leadHz = semiToHz(rootHz * 4, semi);
      this.playExpressiveLead(now, leadHz, noteDur, theme.timbre, energy, step16 % 4 === 0 ? 3.5 : 4.5);
    }

    // 7. Complementary Counter-Melody Harmony (Enters on medium-high & frenetic states!)
    if (isPlaying && energy > 0.56 && !this.lowOxygenMode && barInChorus % 2 === 1) {
      const cDeg = theme.counterMelody[step32 % theme.counterMelody.length];
      if (cDeg >= 0) {
        let holdSteps = 1;
        for (let k = 1; k <= 4; k++) {
          if (theme.counterMelody[(step32 + k) % theme.counterMelody.length] === -2) holdSteps++;
          else break;
        }
        const cHz = semiToHz(rootHz * 4, theme.intervals[cDeg % theme.intervals.length]);
        this.playBellVoice(now, cHz, holdSteps * sixteenthDur * 0.9, 0.026 * energy, 2.2);
      }
    }

    // 8. Subterranean Biome Texture Accent (Atmospheric cave sonar / embers / crystal chimes)
    if (!this.lowOxygenMode && step16 === 8 && barCount % 2 === 1 && energy < 0.78) {
      this.playBiomeAtmosphere(now, theme.rootHz, theme.intervals, this.activeStratumId, barCount);
    }
  }

  private playTightKick(now: number, isBoss: boolean, isDownbeat: boolean, isGhost: boolean, amp: number) {
    if (!this.ctx || !this.musicFilter) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isBoss ? 126 : isDownbeat ? 112 : isGhost ? 84 : 96, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + (isGhost ? 0.065 : 0.13));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  private playSnare(now: number, amp: number, isBoss: boolean) {
    if (!this.ctx) return;
    this.spawnNoiseBurst(
      isBoss ? 0.12 : 0.09,
      'bandpass',
      isBoss ? 1650 : 2100,
      580,
      amp,
      1.15,
      0,
      true,
      true,
      4.5
    );
    const body = this.ctx.createOscillator();
    const bGain = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(195, now);
    body.frequency.exponentialRampToValueAtTime(95, now + 0.075);
    bGain.gain.setValueAtTime(0.0001, now);
    bGain.gain.linearRampToValueAtTime(amp * 0.7, now + 0.003);
    bGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    body.connect(bGain);
    this.routePanned(bGain, 4.1, false, true, true);
    body.start(now);
    body.stop(now + 0.1);
  }

  private playTom(now: number, pitchHz: number, amp: number, col: number) {
    if (!this.ctx) return;
    const tom = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    tom.type = 'triangle';
    tom.frequency.setValueAtTime(pitchHz, now);
    tom.frequency.exponentialRampToValueAtTime(58, now + 0.11);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    tom.connect(gain);
    this.routePanned(gain, col, true, true, true);
    tom.start(now);
    tom.stop(now + 0.14);
  }

  private playStereoPadChord(
    now: number,
    rootHz: number,
    chordIntervals: number[],
    padDur: number,
    energy: number,
    timbre: LeadTimbre
  ) {
    if (!this.ctx || !this.musicBus) return;
    const isCalm = energy < 0.38;
    const peakAmp = (isCalm ? 0.032 : 0.024) + energy * 0.008;

    chordIntervals.forEach((iv, idx) => {
      if (!this.ctx || !this.musicBus) return;
      const hz = semiToHz(rootHz * 2, iv);

      // Warm Rhodes-like chord attack tine on calm downbeats!
      if (isCalm && (timbre === 'RHODES_BELL' || timbre === 'NOIR_SYNTH' || timbre === 'CELESTIAL_CHOIR')) {
        const tine = this.ctx.createOscillator();
        const tGain = this.ctx.createGain();
        tine.type = 'sine';
        tine.frequency.setValueAtTime(hz, now + idx * 0.014);
        tGain.gain.setValueAtTime(0.0001, now + idx * 0.014);
        tGain.gain.linearRampToValueAtTime(0.024, now + idx * 0.014 + 0.018);
        tGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(1.4, padDur * 0.7));
        tine.connect(tGain);
        this.routePanned(tGain, 2.5 + idx * 1.1, true, true, false);
        tine.start(now + idx * 0.014);
        tine.stop(now + Math.min(1.45, padDur * 0.72));
      }

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = isCalm || timbre === 'CELESTIAL_CHOIR' ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(hz, now);
      osc.detune.value = (idx % 2 === 0 ? -1 : 1) * 5;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isCalm ? 620 : 880, now);
      filter.frequency.linearRampToValueAtTime(isCalm ? 1150 : 1900, now + padDur * 0.48);
      filter.frequency.linearRampToValueAtTime(520, now + padDur);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peakAmp, now + Math.min(0.28, padDur * 0.22));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + padDur);

      osc.connect(filter);
      filter.connect(gain);
      this.routePanned(gain, 2.2 + idx * 1.2, true, true, false);
      osc.start(now);
      osc.stop(now + padDur + 0.05);
    });
  }

  private playLayeredBass(
    now: number,
    bassHz: number,
    sixteenthDur: number,
    energy: number,
    isBoss: boolean,
    isDriving: boolean,
    isAccent: boolean
  ) {
    if (!this.ctx || !this.musicBus) return;
    const dur = isDriving ? sixteenthDur * 0.92 : sixteenthDur * 2.2;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = isBoss ? 'sawtooth' : isDriving ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(bassHz, now);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(bassHz, now);

    const cutoff = isBoss ? 860 : (isDriving ? 340 : 210) + energy * 720;
    filter.type = 'lowpass';
    filter.Q.value = isBoss ? 4.8 : isDriving ? 3.2 : 1.5;
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(105, now + dur);

    const amp = (isBoss ? 0.115 : isDriving ? (isAccent ? 0.095 : 0.072) : 0.068) * (0.6 + energy * 0.4);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(filter);
    sub.connect(filter);
    if (isBoss && this.bossDistortion) {
      filter.connect(this.bossDistortion);
      this.bossDistortion.connect(gain);
    } else {
      filter.connect(gain);
    }
    gain.connect(this.musicBus);
    osc.start(now);
    sub.start(now);
    osc.stop(now + dur + 0.02);
    sub.stop(now + dur + 0.02);
  }

  private playFmPluck(now: number, noteHz: number, dur: number, amp: number, energy: number, col: number) {
    if (!this.ctx) return;
    const carrier = this.ctx.createOscillator();
    const mod = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const env = this.ctx.createGain();

    carrier.type = 'sine';
    mod.type = 'triangle';
    carrier.frequency.setValueAtTime(noteHz, now);
    mod.frequency.setValueAtTime(noteHz * 2, now);
    modGain.gain.setValueAtTime(noteHz * (0.32 + energy * 0.72), now);
    modGain.gain.exponentialRampToValueAtTime(1, now + dur * 0.65);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(amp, now + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(env);
    this.routePanned(env, col, true, true, false);
    carrier.start(now);
    mod.start(now);
    carrier.stop(now + dur + 0.02);
    mod.stop(now + dur + 0.02);
  }

  private playBellVoice(now: number, hz: number, dur: number, amp: number, col: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const over = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const oGain = this.ctx.createGain();
    osc.type = 'sine';
    over.type = 'triangle';
    osc.frequency.setValueAtTime(hz, now);
    over.frequency.setValueAtTime(hz * 2, now);
    oGain.gain.setValueAtTime(amp * 0.25, now);
    oGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.min(0.16, dur));

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    over.connect(oGain);
    oGain.connect(gain);
    osc.connect(gain);
    this.routePanned(gain, col, true, true, false);
    osc.start(now);
    over.start(now);
    osc.stop(now + dur + 0.03);
    over.stop(now + dur + 0.03);
  }

  private playExpressiveLead(
    now: number,
    leadHz: number,
    dur: number,
    timbre: LeadTimbre,
    energy: number,
    col: number
  ) {
    if (!this.ctx) return;
    // Calm states always favor singing, warm Rhodes/Crystal/Bell tones;
    // Medium/Frenetic states crossfade cleanly into detuned dual-osc synths & supersaw leads!
    if (energy < 0.34 || timbre === 'RHODES_BELL' || timbre === 'CRYSTAL_HARP' || timbre === 'CELESTIAL_CHOIR') {
      const bellAmp = timbre === 'CELESTIAL_CHOIR' ? 0.044 : 0.052;
      this.playBellVoice(now, leadHz, Math.min(0.75, dur + 0.14), bellAmp, col);
      if (energy < 0.45) return;
    }

    const isAggressive = timbre === 'BOSS_METAL' || timbre === 'OVERDRIVE_SUPERSAW' || energy > 0.72;
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const filt = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    oscA.type = isAggressive ? 'sawtooth' : timbre === 'QUANTUM_FM' ? 'square' : 'triangle';
    oscB.type = isAggressive ? 'sawtooth' : 'sine';
    oscA.frequency.setValueAtTime(leadHz, now);
    oscB.frequency.setValueAtTime(leadHz, now);
    oscA.detune.value = -7;
    oscB.detune.value = 7;

    filt.type = 'lowpass';
    filt.Q.value = isAggressive ? 2.4 : 1.2;
    const startCut = 1200 + energy * 3400;
    filt.frequency.setValueAtTime(startCut, now);
    filt.frequency.exponentialRampToValueAtTime(Math.max(580, startCut * 0.38), now + dur);

    const amp = (0.022 + energy * 0.028) * (isAggressive ? 1.0 : 0.85);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(amp, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    oscA.connect(filt);
    oscB.connect(filt);
    filt.connect(gain);
    this.routePanned(gain, col, true, true, false);
    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + dur + 0.03);
    oscB.stop(now + dur + 0.03);
  }

  private playBiomeAtmosphere(
    now: number,
    rootHz: number,
    intervals: number[],
    stratum: number,
    barCount: number
  ) {
    if (!this.ctx) return;
    if (stratum === 1) {
      this.spawnNoiseBurst(0.32, 'bandpass', 520, 290, 0.016, 3.0, 0, true, true, 1.5);
    } else if (stratum === 2 || stratum === 6) {
      const hz = semiToHz(rootHz * 8, intervals[(barCount * 3) % intervals.length]);
      this.playBellVoice(now, hz, 0.58, 0.022, (barCount % 5) + 2);
    } else if (stratum === 3) {
      this.spawnNoiseBurst(0.45, 'lowpass', 260, 90, 0.026, 1.8, 0, true, true, 6.5);
    } else if (stratum === 4) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.36);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.024, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);
      osc.connect(gain);
      this.routePanned(gain, 2.0, true, true);
      osc.start(now);
      osc.stop(now + 0.58);
    } else {
      const hz = semiToHz(rootHz * 6, intervals[(barCount + 2) % intervals.length]);
      this.playBellVoice(now, hz, 0.68, 0.022, (barCount * 2) % 8);
    }
  }

  private playHeartbeatDouble(now: number) {
    if (!this.ctx || !this.sfxBus) return;
    [0, 0.14].forEach((off, idx) => {
      if (!this.ctx || !this.sfxBus) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 68 : 56, now + off);
      osc.frequency.exponentialRampToValueAtTime(28, now + off + 0.11);
      gain.gain.setValueAtTime(idx === 0 ? 0.22 : 0.16, now + off);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + off + 0.13);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(now + off);
      osc.stop(now + off + 0.14);
    });
  }

  public playUiClick() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(1060, now + 0.026);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playStep() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(215 + Math.random() * 28, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.024);
    gain.gain.setValueAtTime(0.032, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.032);
  }

  public playClimb() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(510, now + 0.055);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.072);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playLand(intensity = 0.5, col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const amp = Math.max(0.06, Math.min(0.25, intensity * 0.23));
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118 + intensity * 24, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.085);
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    osc.connect(gain);
    this.routePanned(gain, col, false);
    osc.start(now);
    osc.stop(now + 0.1);
    this.spawnNoiseBurst(0.05, 'lowpass', 720, 170, amp * 0.52, 0.95, 0, true, false, col);
  }

  public playFallImpact(severity = 0.6, col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(145 + severity * 45, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + 0.36);
    subGain.gain.setValueAtTime(0.35, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    sub.connect(subGain);
    this.routePanned(subGain, col, true);
    sub.start(now);
    sub.stop(now + 0.4);

    // Metallic exo-armor groan + gravel scatter
    this.spawnNoiseBurst(0.26, 'bandpass', 1480, 175, 0.28, 1.4, 0, true, false, col);

    const warn = this.ctx.createOscillator();
    const wGain = this.ctx.createGain();
    warn.type = 'sawtooth';
    warn.frequency.setValueAtTime(430, now + 0.03);
    warn.frequency.exponentialRampToValueAtTime(185, now + 0.21);
    wGain.gain.setValueAtTime(0.075, now + 0.03);
    wGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
    warn.connect(wGain);
    this.routePanned(wGain, col, false);
    warn.start(now + 0.03);
    warn.stop(now + 0.24);
  }

  public playAirBrake(col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    this.spawnNoiseBurst(0.15, 'highpass', 3600, 1100, 0.14, 1.6, 0, true, false, col);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(1020, now + 0.095);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.125);
    osc.connect(gain);
    this.routePanned(gain, col, true);
    osc.start(now);
    osc.stop(now + 0.135);
  }

  public playDrill(isSlag = false, drillTier = 0, col?: number, blockKind?: string) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;

    if (blockKind === 'GRAVEL') {
      this.spawnNoiseBurst(0.095, 'bandpass', 2450 * jitter, 640, 0.19, 2.1, 0, true, false, col);
      this.spawnNoiseBurst(0.075, 'bandpass', 1820, 460, 0.13, 1.8, 0.026, false, false, col);
      return;
    }

    if (blockKind === 'CRYSTAL' || blockKind === 'GEODE') {
      const scale = this.getCurrentScale();
      const semi = scale.intervals[(blockKind === 'GEODE' ? 4 : 2) % scale.intervals.length];
      const hz = semiToHz(scale.rootHz * 8, semi) * jitter;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz, now);
      osc.frequency.exponentialRampToValueAtTime(hz * 1.42, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
      osc.connect(gain);
      this.routePanned(gain, col, true);
      osc.start(now);
      osc.stop(now + 0.16);
      this.spawnNoiseBurst(0.055, 'highpass', 4400, 2600, 0.095, 1.4, 0, true, false, col);
      return;
    }

    // Punchy mechanical impact + metallic spark bite
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isSlag ? 'square' : 'triangle';
    osc.frequency.setValueAtTime((isSlag ? 265 : 196 + drillTier * 24) * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(isSlag ? 88 : 44, now + 0.082);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(isSlag ? 0.21 : 0.24, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.092);

    osc.connect(gain);
    this.routePanned(gain, col, false);
    osc.start(now);
    osc.stop(now + 0.098);

    // Musical spark ping quantized to stratum root
    const scale = this.getCurrentScale();
    const sparkHz = semiToHz(scale.rootHz * 8, scale.intervals[(drillTier + 1) % 5]) * jitter;
    const ping = this.ctx.createOscillator();
    const pingGain = this.ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(isSlag ? 680 * jitter : sparkHz, now);
    ping.frequency.exponentialRampToValueAtTime(240, now + 0.06);
    pingGain.gain.setValueAtTime(0.052 + drillTier * 0.015, now);
    pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    ping.connect(pingGain);
    this.routePanned(pingGain, col, true);
    ping.start(now);
    ping.stop(now + 0.072);

    this.spawnNoiseBurst(
      isSlag ? 0.082 : 0.068,
      'bandpass',
      (isSlag ? 2150 : 1320 + drillTier * 210) * jitter,
      isSlag ? 700 : 340,
      isSlag ? 0.18 : 0.155,
      1.3,
      0,
      true,
      false,
      col
    );
  }

  public playSwap(col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(660, now);
    osc1.frequency.exponentialRampToValueAtTime(1180, now + 0.044);
    osc2.frequency.setValueAtTime(990, now);
    osc2.frequency.exponentialRampToValueAtTime(560, now + 0.044);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.125, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.058);

    osc1.connect(gain);
    osc2.connect(gain);
    this.routePanned(gain, col, true);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.065);
    osc2.stop(now + 0.065);

    this.spawnNoiseBurst(0.036, 'highpass', 3200, 1600, 0.055, 1.2, 0, true, false, col);
  }

  public playWobbleTick() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(175 + Math.random() * 30, now);
    osc.frequency.exponentialRampToValueAtTime(88, now + 0.025);
    gain.gain.setValueAtTime(0.036, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.032);
  }

  public playIgnite(chainLevel: number, col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const scale = this.getCurrentScale();
    const base = semiToHz(scale.rootHz * 4, scale.intervals[(chainLevel - 1) % 7]);

    [1, 1.5, 2].forEach((mult, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = idx === 2 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(base * mult, now + idx * 0.024);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(440, now);
      filter.frequency.exponentialRampToValueAtTime(3800, now + 0.28);

      const peak = idx === 2 ? 0.065 : 0.1;
      gain.gain.setValueAtTime(0.001, now + idx * 0.024);
      gain.gain.linearRampToValueAtTime(peak, now + idx * 0.024 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

      osc.connect(filter);
      filter.connect(gain);
      this.routePanned(gain, col, true);
      osc.start(now + idx * 0.024);
      osc.stop(now + 0.38);
    });
  }

  public playDetonate(chainLevel: number, col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(130 + chainLevel * 14, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.3 + chainLevel * 0.03);
    subGain.gain.setValueAtTime(Math.min(0.42, 0.24 + chainLevel * 0.05), now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    sub.connect(subGain);
    this.routePanned(subGain, col, false);
    sub.start(now);
    sub.stop(now + 0.38);

    this.spawnNoiseBurst(0.2, 'lowpass', 2600, 240, 0.18, 1.0, 0, true, false, col);

    const scale = this.getCurrentScale();
    const baseDeg = Math.min(chainLevel - 1, 7);
    [0, 2, 4, 7].slice(0, chainLevel >= 3 ? 4 : 3).forEach((off, idx) => {
      if (!this.ctx) return;
      const chime = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chime.type = 'sine';
      const t = now + idx * 0.024;
      const deg = (baseDeg + off) % scale.intervals.length;
      const hz = semiToHz(scale.rootHz * 4, scale.intervals[deg]);
      chime.frequency.setValueAtTime(hz, t);
      chimeGain.gain.setValueAtTime(0.001, t);
      chimeGain.gain.linearRampToValueAtTime(0.105, t + 0.008);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      chime.connect(chimeGain);
      this.routePanned(chimeGain, col, true);
      chime.start(t);
      chime.stop(t + 0.3);
    });
  }

  public playThermalDud() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.14);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.17);

    this.spawnNoiseBurst(0.16, 'bandpass', 2200, 650, 0.11, 1.5, 0.01, true);
  }

  public playParry() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;

    const slice = this.ctx.createOscillator();
    const sliceFilter = this.ctx.createBiquadFilter();
    const sliceGain = this.ctx.createGain();
    slice.type = 'triangle';
    slice.frequency.setValueAtTime(1620, now);
    slice.frequency.exponentialRampToValueAtTime(520, now + 0.13);
    sliceFilter.type = 'bandpass';
    sliceFilter.frequency.value = 1480;
    sliceGain.gain.setValueAtTime(0.24, now);
    sliceGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    slice.connect(sliceFilter);
    sliceFilter.connect(sliceGain);
    sliceGain.connect(out);
    if (this.reverbSend) sliceGain.connect(this.reverbSend);
    slice.start(now);
    slice.stop(now + 0.17);

    const boom = this.ctx.createOscillator();
    const boomGain = this.ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(108, now);
    boom.frequency.exponentialRampToValueAtTime(28, now + 0.34);
    boomGain.gain.setValueAtTime(0.4, now);
    boomGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    boom.connect(boomGain);
    boomGain.connect(out);
    boom.start(now);
    boom.stop(now + 0.38);

    // Metallic bell shimmer resonance
    this.playBellVoice(now + 0.02, 1318.5, 0.28, 0.06, 4);
  }

  public playOxygenPickup() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const scale = this.getCurrentScale();
    [0, 2, 4, 7].forEach((deg, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.034;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(semiToHz(scale.rootHz * 8, scale.intervals[deg % scale.intervals.length]), t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playSeismicSeal() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const scale = this.getCurrentScale();
    [0, 4, 7].forEach((deg, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.06;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(semiToHz(scale.rootHz * 4, scale.intervals[deg % scale.intervals.length]), t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playDeath() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.65);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.65);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.72);
  }

  public playDash() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    this.spawnNoiseBurst(0.12, 'bandpass', 960, 3400, 0.13, 1.4, 0, true);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.085);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.115, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.115);
    osc.connect(gain);
    gain.connect(out);
    if (this.reverbSend) gain.connect(this.reverbSend);
    osc.start(now);
    osc.stop(now + 0.125);
  }

  public playOverdrive() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(36, now + 0.42);
    subGain.gain.setValueAtTime(0.36, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    sub.connect(subGain);
    subGain.connect(out);
    sub.start(now);
    sub.stop(now + 0.48);

    const scale = this.getCurrentScale();
    [0, 2, 4, 7, 10].forEach((deg, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.038;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.setValueAtTime(3400, t);
      osc.frequency.setValueAtTime(semiToHz(scale.rootHz * 4, scale.intervals[deg % scale.intervals.length]), t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.095, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(filt);
      filt.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playSlamImpact(col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(145, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.26);
    subGain.gain.setValueAtTime(0.36, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    sub.connect(subGain);
    this.routePanned(subGain, col, false);
    sub.start(now);
    sub.stop(now + 0.3);
    this.spawnNoiseBurst(0.2, 'lowpass', 1900, 210, 0.24, 1.0, 0, true, false, col);
  }

  public playIsotopePickup(comboStep = 0, col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const scale = this.getCurrentScale();
    const deg = scale.intervals[Math.max(0, comboStep) % scale.intervals.length];
    const base = semiToHz(scale.rootHz * 8, deg);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.25, now + 0.07);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    osc.connect(gain);
    this.routePanned(gain, col, true);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playGeodeBreak(col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const scale = this.getCurrentScale();
    [2, 4, 7, 9].forEach((deg, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.024;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(semiToHz(scale.rootHz * 8, scale.intervals[deg % scale.intervals.length]), t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.095, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain);
      this.routePanned(gain, col, true);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  public playCryoVent(col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    this.spawnNoiseBurst(0.24, 'highpass', 4800, 1800, 0.11, 1.8, 0, true, false, col);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.22);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(gain);
    this.routePanned(gain, col, true);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playSteamHiss(col?: number) {
    this.spawnNoiseBurst(0.32, 'bandpass', 3400, 1200, 0.13, 1.5, 0, true, false, col);
  }

  public playComboTierUp(mult: number) {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const scale = this.getCurrentScale();
    const rootIdx = Math.min(scale.intervals.length - 1, Math.max(0, mult - 2));
    const base = semiToHz(scale.rootHz * 4, scale.intervals[rootIdx]);
    [1, 1.5, 2].forEach((m, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.032;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(base * m, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.075, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  public playStyleRankUp(rank: StyleRank) {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const scale = this.getCurrentScale();
    const notes = rank === 'SSS' || rank === 'SS' || rank === 'S' ? [0, 4, 7, 10] : [0, 4, 7];
    notes.forEach((deg, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.036;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(semiToHz(scale.rootHz * 6, scale.intervals[deg % scale.intervals.length]), t);
      gain.gain.setValueAtTime(0.085, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playSynergyActivate() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    [392, 523.25, 659.25, 987.77].forEach((freq, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.042;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.095, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  public playFeverStart() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.04;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playBossAttack() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.16);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playBossPhase2() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    this.spawnNoiseBurst(0.45, 'bandpass', 600, 2600, 0.22, 1.5, 0, true);
    [146.83, 185, 220, 293.66].forEach((freq, i) => {
      if (!this.ctx) return;
      const t = now + i * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.11, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  public playParryTension() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1480, now);
    osc.frequency.exponentialRampToValueAtTime(1960, now + 0.06);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playBiomeTransition(stratumId: number) {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const id = STRATUM_THEME_IDS[Math.max(0, Math.min(STRATUM_THEME_IDS.length - 1, stratumId - 1))];
    const theme = THEMES[id];

    this.spawnNoiseBurst(0.65, 'bandpass', 240, 1450, 0.14, 2.4, 0, true);

    const chord = [0, 7, 12, theme.intervals[2] + 12];
    chord.forEach((semi, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.075;
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(semiToHz(theme.rootHz * 2, semi), t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.72);
    });
  }

  public playBounce(col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.14);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
    osc.connect(gain);
    this.routePanned(gain, col, true);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playAcidMelt(col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    this.spawnNoiseBurst(0.28, 'bandpass', 2400, 900, 0.14, 2.2, 0, true, false, col);
  }

  public playGasExplode(col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.25);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    osc.connect(gain);
    this.routePanned(gain, col, true);
    osc.start(now);
    osc.stop(now + 0.28);
    this.spawnNoiseBurst(0.22, 'lowpass', 1500, 220, 0.24, 1.0, 0, true, false, col);
  }

  public playMineBeep() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1680, now);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  public playMineZap(col?: number) {
    if (!this.enabled || !this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    osc.connect(gain);
    this.routePanned(gain, col, true);
    osc.start(now);
    osc.stop(now + 0.22);
    this.spawnNoiseBurst(0.12, 'highpass', 3200, 1400, 0.12, 1.6, 0, true, false, col);
  }

  public playTreasureOpen() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.27);
    });
  }

  public playGadgetUse() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    [440, 660, 990].forEach((freq, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.03;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  public playCraftSuccess() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    [392.0, 493.88, 587.33, 783.99].forEach((freq, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  public playDialogueBlip(speaker: StorySpeaker) {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    const base =
      speaker === 'VANCE'
        ? 540
        : speaker === 'SOLER'
        ? 380
        : speaker === 'KAI'
        ? 660
        : speaker === 'DR_LINDQVIST'
        ? 470
        : speaker === 'REYES'
        ? 310
        : speaker === 'ECHO_01'
        ? 740
        : speaker === 'CORO_ABISAL'
        ? 165
        : 220;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type =
      speaker === 'ARQUITECTO' || speaker === 'CORO_ABISAL'
        ? 'sawtooth'
        : speaker === 'DR_LINDQVIST' || speaker === 'ECHO_01'
        ? 'triangle'
        : 'square';
    osc.frequency.setValueAtTime(base + (Math.random() - 0.5) * 45, now);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.036);
  }

  public playArtifactFound() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((freq, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.48);
    });
  }

  public playResonanceBurst() {
    const out = this.getOutputNode();
    if (!this.enabled || !this.ctx || !out) return;
    const now = this.ctx.currentTime;
    this.spawnNoiseBurst(0.24, 'bandpass', 600, 3400, 0.14, 1.8, 0, true);
    const scale = this.getCurrentScale();
    [0, 4, 7, 11, 14].forEach((semi, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.028;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(semiToHz(scale.rootHz * 4, semi), t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.105, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain);
      gain.connect(out);
      if (this.reverbSend) gain.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }
}

export const soundEngine = new SoundEngine();
