import { CampaignChapterDef, StorySpeaker, StoryTransmission } from '../types/game';

export const SPEAKER_PROFILES: Record<
  StorySpeaker,
  { name: string; title: string; color: string; freq: string }
> = {
  VANCE: {
    name: 'Dir. Helena Vance',
    title: 'Control de Misión · Geología Aplicada',
    color: '#38BDF8',
    freq: 'CH-01 · 142.8 MHz',
  },
  SOLER: {
    name: 'Ing. Mateo Soler',
    title: 'Jefe de Sondeo e Ingeniería Mecánica',
    color: '#FACC15',
    freq: 'CH-04 · 088.4 MHz',
  },
  KAI: {
    name: 'Piloto K. Aranda',
    title: 'Vanguardia · Unidad Espectro',
    color: '#A3E635',
    freq: 'CH-07 · 310.2 MHz',
  },
  ARQUITECTO: {
    name: 'Sello Sub-Cero [?]',
    title: 'Resonancia Profunda del Núcleo',
    color: '#C084FC',
    freq: 'ERR · ??? Hz',
  },
};

export const CAMPAIGN_CHAPTERS: CampaignChapterDef[] = [
  {
    id: 1,
    name: 'Cap. I · La Cicatriz',
    stratumName: 'I. Corteza',
    depthStart: 0,
    depthEnd: 500,
    bossName: 'Centinela de Cuarzo',
    bossDepth: 500,
    hazardName: 'Temblores Sísmicos',
    synopsis:
      'Desciende por el Pozo 09 bajo la plataforma industrial. Las vetas de cuatro colores resuenan; al fondo aguarda el Centinela Cristalino sellando la Falla.',
    accentColor: '#EE4E34',
  },
  {
    id: 2,
    name: 'Cap. II · Garganta de Escarcha',
    stratumName: 'II. Falla',
    depthStart: 500,
    depthEnd: 1000,
    bossName: 'El Telar',
    bossDepth: 1000,
    hazardName: 'Chuzos Criogénicos',
    synopsis:
      'El cuarzo glacial cede bajo el peso propio. Columnas de hielo descienden como guillotinas mientras El Telar suelda el abismo con haces térmicos.',
    accentColor: '#3FD0F4',
  },
  {
    id: 3,
    name: 'Cap. III · Pulso Piroclástico',
    stratumName: 'III. Manto',
    depthStart: 1000,
    depthEnd: 1500,
    bossName: 'La Fragua Gemela',
    bossDepth: 1500,
    hazardName: 'Corrientes Magmáticas',
    synopsis:
      'Filamentos de cobre vitrificado conducen explosiones entre bolsones de gas tóxico y magma. Los pistones de La Fragua aplastan todo lo que oscila lento.',
    accentColor: '#FF6B1A',
  },
  {
    id: 4,
    name: 'Cap. IV · Peso Absoluto',
    stratumName: 'IV. Presión',
    depthStart: 1500,
    depthEnd: 2000,
    bossName: 'El Péndulo',
    bossDepth: 2000,
    hazardName: 'Pulsos Hidrostáticos',
    synopsis:
      'Minas electromagnéticas, remaches de titanio y la presión comprimida del abismo. Solo los Cortes Cinéticos desvían el monolito oscilante de El Péndulo.',
    accentColor: '#A3E635',
  },
  {
    id: 5,
    name: 'Cap. V · Interferencia',
    stratumName: 'V. Singularidad',
    depthStart: 2000,
    depthEnd: 2500,
    bossName: 'El Sello del Arquitecto',
    bossDepth: 2500,
    hazardName: 'Tormenta de Fase',
    synopsis:
      'La materia alterna de espectro cada cuatro latidos del metrónomo bajo pozos gravitatorios. Rompe el Sello del Arquitecto antes de que su techo te alcance.',
    accentColor: '#FFFFFF',
  },
  {
    id: 6,
    name: 'Cap. VI · Silencio de Alabastro',
    stratumName: 'VI. Núcleo Inconexo',
    depthStart: 2500,
    depthEnd: 3000,
    bossName: 'Techo Vivo Descendente',
    bossDepth: 3000,
    hazardName: 'Inversión Térmica',
    synopsis:
      'No existe consumo de oxígeno bajo la cota 2500: la luz blanca invierte el abismo mientras un cielo sólido desciende persiguiéndote sin tregua.',
    accentColor: '#C4993B',
  },
  {
    id: 7,
    name: 'Cap. VII · Horizonte de Eventos',
    stratumName: 'VII. Horizonte de Eventos',
    depthStart: 3000,
    depthEnd: 3500,
    bossName: 'El Cronolito',
    bossDepth: 3500,
    hazardName: 'Fisuras del Vacío',
    synopsis:
      'La cámara primordial bajo la corteza planetaria. Destruye los nodos armónicos del Cronolito para apagar la resonancia sísmica de una vez por todas.',
    accentColor: '#F472B6',
  },
];

export const STORY_TRANSMISSIONS: StoryTransmission[] = [
  {
    id: 'ST_01_PROLOGUE',
    chapter: 1,
    speaker: 'VANCE',
    triggerEvent: 'PROLOGUE',
    title: 'Protocolo de Descompresión · Pozo 09',
    lines: [
      'Enlace establecido. Bienvenido al Pozo 09, piloto. Los sismógrafos acaban de registrar un nuevo latido bajo la cota tres mil.',
      'Recuerda las tres leyes del subsuelo: une 4 bloques para encender la mecha, recoge Isótopos en las geodas y desvía el aplastamiento lateralmente con W + Q/E.',
    ],
  },
  {
    id: 'ST_02_FIRST_COMBO',
    chapter: 1,
    speaker: 'SOLER',
    triggerDepth: 110,
    title: 'Resonancia de Veta',
    lines: [
      '¿Lo notas en la broca? Cuando encadenas rupturas rápidas, el condensador carga tu Overdrive (X/V). Guárdalo para triturar escoria de un golpe.',
    ],
    isTicker: true,
  },
  {
    id: 'ST_03_KAI_SIGNAL',
    chapter: 1,
    speaker: 'KAI',
    triggerDepth: 320,
    title: 'Frecuencia Fantasma',
    lines: [
      'Piloto, aquí Vanguardia. Detecté una Llave de Fase perlada incrustada en esta franja y varias cajas blindadas de suministros.',
      'Mantén los ojos en el muro derecho si buscas el Fragmento Alfa. Cuidado con la gravedad suelta: la grava cae al instante.',
    ],
    isTicker: true,
  },
  {
    id: 'ST_04_WARDEN_INTRO',
    chapter: 1,
    speaker: 'VANCE',
    triggerEvent: 'WARDEN_INTRO',
    title: '¡Bloqueo Cristalino en Cota 500m!',
    lines: [
      '¡Alerta sísmica! El Centinela de Cuarzo ha cristalizado el fondo de la Corteza y levanta escudos prismáticos.',
      'Taladra o detona bloques junto a su coraza para fracturar sus 3 núcleos armónicos. ¡No dejes que el oxígeno caiga a cero!',
    ],
  },
  {
    id: 'ST_05_WARDEN_DEFEAT_CHOICE',
    chapter: 2,
    speaker: 'SOLER',
    triggerEvent: 'WARDEN_DEFEAT',
    title: 'Bifurcación hacia la Falla Glacial',
    lines: [
      '¡Espectacular demolición! El acceso a la Falla está abierto, pero la presión criogénica aumenta. ¿Qué protocolo transmito a tu Exo-Rig?',
    ],
    choices: [
      {
        id: 'CH_CH2_EXTRACTION',
        label: 'A · Redirigir drones de extracción mineral',
        rewardText: '+40 ISO · +6 Ferrita · +4 Cuarzo',
        tag: 'BOTÍN',
      },
      {
        id: 'CH_CH2_SURVIVAL',
        label: 'B · Inyectar reserva criogénica y blindaje',
        rewardText: '+35% O₂ · +2 Escudos Cinéticos',
        tag: 'SUPERVIVENCIA',
      },
    ],
  },
  {
    id: 'ST_06_FALLA_AMBIENT',
    chapter: 2,
    speaker: 'KAI',
    triggerDepth: 720,
    title: 'Hielo Vivo y Muelles',
    lines: [
      'A esta profundidad el cuarzo estalla bajo peso muerto y los muelles tectónicos rebotan bloques enteros. Usa los respiraderos criogénicos para congelar el consumo de O₂.',
    ],
    isTicker: true,
  },
  {
    id: 'ST_07_LOOM_INTRO',
    chapter: 2,
    speaker: 'VANCE',
    triggerEvent: 'LOOM_INTRO',
    title: 'Guardián de la Falla · El Telar',
    lines: [
      'Cota 1.000m alcanzada. El Telar suelda franjas horizontales completas con haces térmicos antes de sellar el pozo.',
      'Detona reacciones ×2+ cerca de sus anclajes de pared para desconectarlo.',
    ],
  },
  {
    id: 'ST_08_LOOM_DEFEAT',
    chapter: 3,
    speaker: 'SOLER',
    triggerEvent: 'LOOM_DEFEAT',
    title: 'Entrada al Horno Cerámico',
    lines: [
      'El Telar cayó. Bajo los mil metros te esperan bolsas de gas inflamable, conductores vitrificados y depósitos ácidos. ¡Úsalos a tu favor!',
    ],
    isTicker: true,
  },
  {
    id: 'ST_09_MANTO_VOICE',
    chapter: 3,
    speaker: 'ARQUITECTO',
    triggerDepth: 1240,
    title: 'Espectro Acústico Desconocido',
    lines: [
      '...No perforáis piedra... abrís arterias dormidas bajo el manto... la Fragua ya mide vuestro pulso...',
    ],
    isTicker: true,
  },
  {
    id: 'ST_10_FORGE_INTRO',
    chapter: 3,
    speaker: 'SOLER',
    triggerEvent: 'FORGE_INTRO',
    title: '¡La Fragua Gemela en Cota 1.500m!',
    lines: [
      '¡Dos pistones hidráulicos gigantes sellan las paredes del Manto! Sus válvulas ventilan magma y rocas volcánicas.',
      'Lanza detonaciones en cadena u ondas sísmicas contra sus núcleos laterales para sobrecalentarla.',
    ],
  },
  {
    id: 'ST_11_FORGE_DEFEAT_CHOICE',
    chapter: 4,
    speaker: 'VANCE',
    triggerEvent: 'FORGE_DEFEAT',
    title: 'Decisión Táctica · Zona de Presión',
    lines: [
      'Has atravesado el Horno Cerámico. Al frente aguardan minas electromagnéticas y remaches de titanio. ¿Qué apoyo priorizamos?',
    ],
    choices: [
      {
        id: 'CH_CH4_POWER',
        label: 'A · Condensar Overdrive y recarga de ignición',
        rewardText: '100% Overdrive · +4 Ignita · +3 Titanio',
        tag: 'OFENSIVA',
      },
      {
        id: 'CH_CH4_ARMOR',
        label: 'B · Sellar casco contra minas y presión',
        rewardText: '+40% O₂ · +2 Escudos · +30 ISO',
        tag: 'DEFENSA',
      },
    ],
  },
  {
    id: 'ST_12_PRESION_AMBIENT',
    chapter: 4,
    speaker: 'KAI',
    triggerDepth: 1760,
    title: 'Protocolo Anti-Minas',
    lines: [
      'Las minas de choque se arman al acercarte, pero si las permutas con Q/E o las taladras antes del pitido final obtienes Titanio puro y carga de Overdrive.',
    ],
    isTicker: true,
  },
  {
    id: 'ST_13_PENDULUM_INTRO',
    chapter: 4,
    speaker: 'VANCE',
    triggerEvent: 'PENDULUM_INTRO',
    title: 'Guardián de la Presión · El Péndulo',
    lines: [
      '¡El Péndulo oscila sobre el abismo técnico! Es invulnerable a las brocas convencionales.',
      'Atácale ejecutando Cortes Cinéticos bajo sus columnas o desatando cadenas ×3+.',
    ],
  },
  {
    id: 'ST_14_PENDULUM_DEFEAT',
    chapter: 5,
    speaker: 'KAI',
    triggerEvent: 'PENDULUM_DEFEAT',
    title: 'Frontera de la Singularidad',
    lines: [
      'El Péndulo se ha detenido. Aquí la materia oscila de color cada cuatro pulsos y los pozos gravitatorios curvan los derrumbes. ¡Átate bien al chasis!',
    ],
    isTicker: true,
  },
  {
    id: 'ST_15_SINGULARIDAD_WHISPER',
    chapter: 5,
    speaker: 'ARQUITECTO',
    triggerDepth: 2240,
    title: 'Señal Sincronizada',
    lines: [
      '...Cuatro latidos... la piedra recuerda la forma de las estrellas... el Sello espera en dos mil quinientos...',
    ],
    isTicker: true,
  },
  {
    id: 'ST_16_ARCHITECT_INTRO',
    chapter: 5,
    speaker: 'ARQUITECTO',
    triggerEvent: 'ARCHITECT_INTRO',
    title: 'El Sello del Arquitecto · 2.500m',
    lines: [
      'Has descendido más lejos que toda vuestra historia de superficie. Demuestra que mereces ver el Alabastro bajo el Sello.',
      'El techo desciende. Cada cadena ×2+ resquebraja mi cerradura.',
    ],
  },
  {
    id: 'ST_17_ARCHITECT_DEFEAT_CHOICE',
    chapter: 6,
    speaker: 'VANCE',
    triggerEvent: 'ARCHITECT_DEFEAT',
    title: '¡La Brecha del Núcleo Inconexo!',
    lines: [
      '¡Lo lograste! El Sello principal de 2.500m se ha fracturado, revelando cámaras imposibles de alabastro blanco y energía de Eventos por debajo.',
      'Tu contrato oficial termina aquí... pero Soler puede forzar la compuerta hacia el Núcleo Profundo (3.500m). ¿Cuál es tu orden?',
    ],
    choices: [
      {
        id: 'CH_DESCEND_DEEP',
        label: 'A · Forzar compuerta: Descender al Núcleo Inconexo (Cap. VI–VII)',
        rewardText: 'Desbloquea Cap. VI–VII · +4 Éter · +40% O₂',
        tag: 'EXPEDICIÓN PROFUNDA',
      },
      {
        id: 'CH_EXTRACT_VICTORY',
        label: 'B · Activar extracción triunfal en Cota 2.500m',
        rewardText: 'Victoria de Campaña Acto I · Botín 100%',
        tag: 'EXTRACCIÓN',
      },
    ],
  },
  {
    id: 'ST_18_ALABASTRO_ENTRY',
    chapter: 6,
    speaker: 'VANCE',
    triggerDepth: 2560,
    title: 'Cero Absoluto · Alabastro Blanco',
    lines: [
      'Los sensores de oxígeno están estables al mínimo drenaje, pero la bóveda entera sobre tu cabeza cae sin pausa. ¡Perfora sin mirar atrás hasta la cota 3.000m!',
    ],
    isTicker: true,
  },
  {
    id: 'ST_19_HORIZON_ENTRY',
    chapter: 7,
    speaker: 'KAI',
    triggerDepth: 3030,
    title: 'Horizonte de Eventos · Más allá de todo mapa',
    lines: [
      'Cota 3.000 metros superada. Aquí las grietas del vacío abren brechas luminosas en todo el pozo. Sigue hasta el fondo: algo late a los 3.500m.',
    ],
  },
  {
    id: 'ST_20_CHRONOLITH_INTRO',
    chapter: 7,
    speaker: 'ARQUITECTO',
    triggerEvent: 'CHRONOLITH_INTRO',
    title: 'El Cronolito · Corazón del Planeta',
    lines: [
      'Soy el metrónomo que sostiene la corteza. Quien atraviesa la Singularidad y el Alabastro puede apagar o reclamar mi pulso.',
      'Sobrevive a mis fisuras temporales y rompe los 6 pilares de resonancia.',
    ],
  },
  {
    id: 'ST_21_CHRONOLITH_DEFEAT',
    chapter: 7,
    speaker: 'VANCE',
    triggerEvent: 'CHRONOLITH_DEFEAT',
    title: 'Silencio Sísmico Total · Victoria Absoluta',
    lines: [
      '¡La resonancia se ha detenido en todo el planeta! Acabas de completar la expedición más profunda jamás registrada en ESTRATO.',
      'La superficie está a salvo. Tu Exo-Rig queda consagrado como leyenda del Pozo 09.',
    ],
  },
];

