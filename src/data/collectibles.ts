import { ArchiveSave, ArtifactDef, ArtifactMilestoneDef } from '../types/game';

export const ARTIFACTS: ArtifactDef[] = [
  // Estrato I · Corteza
  {
    id: 'ART_01',
    code: 'ART-01 · I',
    name: 'Brújula del Pionero',
    stratumId: 1,
    rarity: 'COMÚN',
    color: '#F59E0B',
    accent: '#FEF08A',
    iconShape: 'COMPASS',
    lore: 'Instrumento magnético recuperado de la Primera Brigada de Sondeo de 2149. Su aguja ignora el norte terrestre y apunta siempre directo hacia el centro del Pozo 09.',
    quote: '«A cien metros dejamos de mirar el cielo. La aguja ya sabía adónde pertenecíamos.»',
    findBonusIso: 22,
    findBonusMat: 'ferrita',
  },
  {
    id: 'ART_02',
    code: 'ART-02 · I',
    name: 'Placa del Pozo 09',
    stratumId: 1,
    rarity: 'COMÚN',
    color: '#EE4E34',
    accent: '#FDBA74',
    iconShape: 'BADGE',
    lore: 'Insignia de bronce industrial grabada con el número de serie del primer elevador orbital convertido en montacargas subterráneo.',
    quote: '«Tres leyes del subsuelo grabadas al dorso bajo manchas de hollín y ferrita.»',
    findBonusIso: 25,
    findBonusMat: 'ferrita',
  },

  // Estrato II · Falla
  {
    id: 'ART_03',
    code: 'ART-03 · II',
    name: 'Prisma Glacial',
    stratumId: 2,
    rarity: 'RARO',
    color: '#38BDF8',
    accent: '#E0F2FE',
    iconShape: 'PRISM',
    lore: 'Cristal hexagonal formado bajo presiones criogénicas imposibles. Refracta una única frecuencia azul incluso en oscuridad absoluta.',
    quote: '«Cuando vibra cerca de un casco de piloto, el medidor de O₂ deja de caer unos instantes.»',
    findBonusIso: 32,
    findBonusMat: 'cuarzo',
  },
  {
    id: 'ART_04',
    code: 'ART-04 · II',
    name: 'Campanilla de Escarcha',
    stratumId: 2,
    rarity: 'RARO',
    color: '#67E8F9',
    accent: '#FFFFFF',
    iconShape: 'CHIME',
    lore: 'Resonador hueco esculpido de una estalactita armónica. Emite la misma nota sostenida que precede cada temblor del Centinela.',
    quote: '«Si la escuchas sonar sola, prepárate para esquivar.»',
    findBonusIso: 35,
    findBonusMat: 'cuarzo',
  },

  // Estrato III · Manto
  {
    id: 'ART_05',
    code: 'ART-05 · III',
    name: 'Lágrima de Obsidiana',
    stratumId: 3,
    rarity: 'RARO',
    color: '#FB7185',
    accent: '#FEF08A',
    iconShape: 'TEAR',
    lore: 'Gota de vidrio volcánico enfriada instantáneamente en una cámara piroclástica. Su núcleo sigue incandescente por dentro sin quemar al tacto.',
    quote: '«Ceniza vitrificada de un fuego que lleva milenios respirando.»',
    findBonusIso: 42,
    findBonusMat: 'ignita',
  },
  {
    id: 'ART_06',
    code: 'ART-06 · III',
    name: 'Pistón de La Fragua',
    stratumId: 3,
    rarity: 'ÉPICO',
    color: '#FF6B1A',
    accent: '#FDE047',
    iconShape: 'PISTON',
    lore: 'Válvula de bronce cerámico desprendida de la maquinaria ancestral del Manto III. Su peso excede tres veces el del acero convencional.',
    quote: '«Quien diseñó estos pistones no temía al magma: lo usaba como lubricante.»',
    findBonusIso: 48,
    findBonusMat: 'ignita',
  },

  // Estrato IV · Presión
  {
    id: 'ART_07',
    code: 'ART-07 · IV',
    name: 'Diapasón Abisal',
    stratumId: 4,
    rarity: 'ÉPICO',
    color: '#A3E635',
    accent: '#ECFCCB',
    iconShape: 'FORK',
    lore: 'Horquilla de titanio-64 calibrada exactamente a 120 latidos por minuto. Cancela interferencias de minas electromagnéticas al vibrar.',
    quote: '«Lyra jura que la música no nace en el transmisor, sino en esta barra de metal.»',
    findBonusIso: 55,
    findBonusMat: 'titanio',
  },
  {
    id: 'ART_08',
    code: 'ART-08 · IV',
    name: 'Lente Hidrostática',
    stratumId: 4,
    rarity: 'ÉPICO',
    color: '#34D399',
    accent: '#FFFFFF',
    iconShape: 'LENS',
    lore: 'Óptica blindada capaz de enfocar ondas de choque en un plano horizontal perfecto. Pieza clave de los primeros escudos balísticos.',
    quote: '«Mirar a través de esta lente deja ver las fisuras internas de toda la roca.»',
    findBonusIso: 60,
    findBonusMat: 'titanio',
  },

  // Estrato V · Singularidad
  {
    id: 'ART_09',
    code: 'ART-09 · V',
    name: 'Reloj de Fase Cero',
    stratumId: 5,
    rarity: 'ÉPICO',
    color: '#C084FC',
    accent: '#F3E8FF',
    iconShape: 'CLOCK',
    lore: 'Cronómetro sin manecillas cuyas marcas parpadean entre dos estados de materia simultáneos cada cuatro pulsos sísmicos.',
    quote: '«Bajo la cota dos mil, el tiempo deja de fluir en línea recta.»',
    findBonusIso: 72,
    findBonusMat: 'eter',
  },
  {
    id: 'ART_10',
    code: 'ART-10 · V',
    name: 'Núcleo Espectral',
    stratumId: 5,
    rarity: 'MÍTICO',
    color: '#F472B6',
    accent: '#FFFFFF',
    iconShape: 'CORE',
    lore: 'Esfera de éter cuántico comprimido que orbita medio milímetro sobre cualquier palma que la sostenga.',
    quote: '«Sable perdió un guante al tocarlo; desde entonces permuta la piedra a distancia.»',
    findBonusIso: 80,
    findBonusMat: 'eter',
  },

  // Estrato VI · Núcleo Inconexo
  {
    id: 'ART_11',
    code: 'ART-11 · VI',
    name: 'Pluma de Alabastro',
    stratumId: 6,
    rarity: 'MÍTICO',
    color: '#EAB308',
    accent: '#FFFFFF',
    iconShape: 'FEATHER',
    lore: 'Estalactita cristalina blanca de densidad casi nula. Se formó en la inversión térmica donde la gravedad parece dudar.',
    quote: '«El aire blanco no quema el oxígeno: guarda memoria de cada paso.»',
    findBonusIso: 92,
    findBonusMat: 'alabastro',
  },
  {
    id: 'ART_12',
    code: 'ART-12 · VI',
    name: 'Tablilla Inversa',
    stratumId: 6,
    rarity: 'MÍTICO',
    color: '#FACC15',
    accent: '#FEF08A',
    iconShape: 'TABLET',
    lore: 'Estela geométrica de alabastro estelar tallada con un mapa topográfico invertido: nuestra superficie aparece como un pozo invertido.',
    quote: '«¿Y si el cielo blanco estuviera debajo todo este tiempo?»',
    findBonusIso: 100,
    findBonusMat: 'alabastro',
  },

  // Estrato VII · Horizonte de Eventos
  {
    id: 'ART_13',
    code: 'ART-13 · VII',
    name: 'Dial del Cronolito',
    stratumId: 7,
    rarity: 'MÍTICO',
    color: '#E879F9',
    accent: '#FFFFFF',
    iconShape: 'DIAL',
    lore: 'Fragmento orbital del propio Cronolito primordial. Sus anillos concéntricos giran en silencio absoluto hasta entrar en Resonancia.',
    quote: '«Cada continente descansa sobre una muesca de este dial.»',
    findBonusIso: 120,
    findBonusMat: 'alabastro',
  },
  {
    id: 'ART_14',
    code: 'ART-14 · VII',
    name: 'Corona Sub-Cero',
    stratumId: 7,
    rarity: 'MÍTICO',
    color: '#FFFFFF',
    accent: '#FACC15',
    iconShape: 'CROWN',
    lore: 'La decimocuarta reliquia del Archivo: el sello maestro del Arquitecto Primordial, dormido a 3.400 metros esperando al portador digno.',
    quote: '«Catorce piezas, siete mundos bajo tierra, una sola canción completa.»',
    findBonusIso: 150,
    findBonusMat: 'alabastro',
  },
];

export const ARTIFACT_MILESTONES: ArtifactMilestoneDef[] = [
  {
    id: 'ART_M1',
    required: 3,
    title: 'Explorador del Archivo',
    subtitle: 'Encuentra 3 artefactos distintos del subsuelo',
    rewardIso: 200,
    rewardCores: 1,
    rewardMats: { ferrita: 4, cuarzo: 4 },
    rewardGadgets: { GAD_O2_CELL: 2 },
    permBonusDesc: '+3% de Oxígeno Máximo permanente en todos los descensos',
  },
  {
    id: 'ART_M2',
    required: 6,
    title: 'Arqueólogo de la Falla',
    subtitle: 'Encuentra 6 artefactos distintos del subsuelo',
    rewardIso: 400,
    rewardCores: 2,
    rewardMats: { ignita: 5, titanio: 4 },
    rewardGadgets: { GAD_REPAIR_SHIELD: 2 },
    permBonusDesc: '+8% de Isótopos ganados permanente en todas las partidas',
  },
  {
    id: 'ART_M3',
    required: 10,
    title: 'Cazador de Singularidades',
    subtitle: 'Encuentra 10 artefactos distintos del subsuelo',
    rewardIso: 750,
    rewardCores: 3,
    rewardMats: { eter: 5, alabastro: 4 },
    rewardGadgets: { GAD_PHASE_SWAP: 2, GAD_SONAR_PULSE: 2 },
    permBonusDesc: '+12% de velocidad de carga para Overdrive y Resonancia',
  },
  {
    id: 'ART_M4_GRAND',
    required: 14,
    title: 'CORONA DEL ARQUITECTO (Lote Completo)',
    subtitle: 'Reúne los 14 artefactos de los 7 Estratos',
    rewardIso: 1500,
    rewardCores: 5,
    rewardMats: { ferrita: 6, cuarzo: 6, ignita: 6, titanio: 6, eter: 6, alabastro: 6 },
    rewardGadgets: { GAD_RESONANCE_CELL: 3, GAD_OVERDRIVE_INJ: 2 },
    permBonusDesc: 'PREMIO FINAL: +10% O₂ Máx, +15% ISO, +1 Escudo inicial, Aura Dorada & Epílogo Secreto',
    isGrandPrize: true,
  },
];

export const ARCHITECT_EPILOGUE = {
  title: 'EPÍLOGO DEL ARCHIVO · SELLO COMPLETO 14/14',
  subtitle: 'Transmisión Final Desbloqueada · Horizonte Sub-Cero',
  lines: [
    'Al ensamblar los catorce fragmentos sobre la consola del Archivo, los siete estratos responden con un único acorde armónico desde tres mil quinientos metros bajo el suelo.',
    'La Directora Vance confirma que la actividad sísmica de la superficie ha entrado en fase estable por primera vez desde 2149. El Pozo 09 ya no es una cicatriz: es el metrónomo que sostiene el planeta.',
    'Tu Exo-Rig porta desde ahora la Corona del Arquitecto: el subsuelo reconoce tu paso.',
  ],
};

export interface ArtifactPermanentBonuses {
  maxO2BonusPct: number;
  isoBonusMult: number;
  chargeSpeedMult: number;
  starterShieldBonus: number;
  hasArchitectCrown: boolean;
}

export function getArtifactPermanentBonuses(archive: ArchiveSave): ArtifactPermanentBonuses {
  const claimed = new Set(archive.claimedArtifactMilestones || []);
  const m1 = claimed.has('ART_M1');
  const m2 = claimed.has('ART_M2');
  const m3 = claimed.has('ART_M3');
  const m4 = claimed.has('ART_M4_GRAND') || Boolean(archive.architectCrownUnlocked);

  return {
    maxO2BonusPct: (m1 ? 3 : 0) + (m4 ? 10 : 0),
    isoBonusMult: 1 + (m2 ? 0.08 : 0) + (m4 ? 0.15 : 0),
    chargeSpeedMult: 1 + (m3 ? 0.12 : 0),
    starterShieldBonus: m4 ? 1 : 0,
    hasArchitectCrown: m4,
  };
}

