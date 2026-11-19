import React, { useEffect, useState } from 'react';
import { Keyboard, RotateCcw, Smartphone, X } from 'lucide-react';
import {
  ControlAction,
  KeyBindingPresetId,
  KeyBindings,
  TouchControlMode,
  VisualSettings,
} from '../types/game';
import {
  assignKeyBinding,
  CONTROL_ACTION_META,
  formatKeyCode,
  getDefaultKeyBindings,
  KEYBINDING_PRESETS,
} from '../storage/controls';
import { soundEngine } from '../engine/audio';
import {
  clampCameraAnchorY,
  DEFAULT_MOBILE_CAMERA_ANCHOR_Y,
  DEFAULT_PC_CAMERA_ANCHOR_Y,
  MAX_CAMERA_ANCHOR_Y,
  MIN_CAMERA_ANCHOR_Y,
} from '../engine/renderer';

interface ControlsModalProps {
  keyBindings: KeyBindings;
  onUpdateKeyBindings: (next: KeyBindings) => void;
  visualSettings: VisualSettings;
  onUpdateVisualSettings: (next: VisualSettings) => void;
  onClose: () => void;
  initialSection?: 'KEYBOARD' | 'MOBILE';
}

export const ControlsModal: React.FC<ControlsModalProps> = ({
  keyBindings,
  onUpdateKeyBindings,
  visualSettings,
  onUpdateVisualSettings,
  onClose,
  initialSection = 'KEYBOARD',
}) => {
  const [section, setSection] = useState<'KEYBOARD' | 'MOBILE'>(initialSection);
  const [listening, setListening] = useState<{ action: ControlAction; slot: 0 | 1 } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const touchMode: TouchControlMode = visualSettings.touchControlMode === 'HYBRID' ? 'HYBRID' : 'GESTURES';
  const swipeDownDrill = visualSettings.swipeDownDrill !== false;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!listening) {
        if (e.code === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'Escape') {
        setListening(null);
        setNotice('Asignación cancelada.');
        return;
      }

      const { next, swappedFrom } = assignKeyBinding(keyBindings, listening.action, listening.slot, e.code);
      onUpdateKeyBindings(next);
      soundEngine.init();
      soundEngine.playUiClick();

      const targetMeta = CONTROL_ACTION_META.find((m) => m.action === listening.action);
      if (swappedFrom) {
        const prevMeta = CONTROL_ACTION_META.find((m) => m.action === swappedFrom);
        setNotice(
          `${formatKeyCode(e.code)} → ${targetMeta?.label || listening.action} (reemplazada en ${prevMeta?.label || swappedFrom})`
        );
      } else {
        setNotice(`${formatKeyCode(e.code)} asignada a ${targetMeta?.label || listening.action}`);
      }
      setListening(null);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [listening, keyBindings, onUpdateKeyBindings, onClose]);

  const applyPreset = (presetId: KeyBindingPresetId) => {
    const preset = KEYBINDING_PRESETS[presetId];
    const cloned = {} as KeyBindings;
    for (const meta of CONTROL_ACTION_META) {
      const slot = preset.bindings[meta.action];
      cloned[meta.action] = [slot[0], slot[1]];
    }
    onUpdateKeyBindings(cloned);
    setListening(null);
    setNotice(`Perfil aplicado: ${preset.name}`);
    soundEngine.init();
    soundEngine.playUiClick();
  };

  const resetDefaults = () => {
    onUpdateKeyBindings(getDefaultKeyBindings());
    setListening(null);
    setNotice('Controles restaurados por defecto.');
    soundEngine.init();
    soundEngine.playUiClick();
  };

  const selectTouchMode = (mode: TouchControlMode) => {
    onUpdateVisualSettings({ ...visualSettings, touchControlMode: mode });
    soundEngine.init();
    soundEngine.playUiClick();
  };

  const groups: Array<{ id: 'MOVIMIENTO' | 'ACCIONES' | 'TACTICO'; title: string }> = [
    { id: 'MOVIMIENTO', title: 'Movimiento y Dirección' },
    { id: 'ACCIONES', title: 'Perforación, Permuta y Combate' },
    { id: 'TACTICO', title: 'Sistema y Artilugios' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#090A0F]/88 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !listening) onClose();
      }}
    >
      <div className="pixel-panel w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#12131A] overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b-2 border-[#262834] flex items-center justify-between gap-3 shrink-0">
          <div>
            <div className="font-pixel text-[10px] text-[#FACC15] tracking-wider">CONFIGURACIÓN DE CONTROL</div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
              Editor de Teclas y Modo Táctil
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            aria-label="Cerrar editor de controles"
            className="pixel-btn p-2 text-[#A1A1AA] hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="px-4 sm:px-5 py-2.5 border-b-2 border-[#232530] bg-[#0D0E14] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setListening(null);
                setSection('KEYBOARD');
              }}
              className={`px-3 py-1.5 border-2 font-pixel text-[10px] flex items-center gap-1.5 cursor-pointer ${
                section === 'KEYBOARD'
                  ? 'border-[#EE4E34] bg-[#241517] text-[#FACC15]'
                  : 'border-[#2B2D38] bg-[#14151C] text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              Teclado (PC)
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setListening(null);
                setSection('MOBILE');
              }}
              className={`px-3 py-1.5 border-2 font-pixel text-[10px] flex items-center gap-1.5 cursor-pointer ${
                section === 'MOBILE'
                  ? 'border-[#38BDF8] bg-[#0F1B26] text-[#38BDF8]'
                  : 'border-[#2B2D38] bg-[#14151C] text-[#A1A1AA] hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Móvil / Táctil ({touchMode === 'HYBRID' ? 'Híbrido' : 'Gestual'})
            </button>
          </div>
          {notice && <span className="text-[11px] font-mono text-[#FACC15]">{notice}</span>}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
          {section === 'KEYBOARD' && (
            <>
              {/* Presets & Reset */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-pixel text-[10px] text-[#8E92A4]">PERFILES RÁPIDOS DE TECLADO</span>
                  <button
                    type="button"
                    onClick={resetDefaults}
                    className="pixel-btn px-2.5 py-1 text-[10px] font-pixel text-[#D4D4D8] hover:text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar por defecto
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(Object.keys(KEYBINDING_PRESETS) as KeyBindingPresetId[]).map((pid) => {
                    const p = KEYBINDING_PRESETS[pid];
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => applyPreset(pid)}
                        className="pixel-btn p-2.5 text-left cursor-pointer space-y-0.5"
                      >
                        <div className="font-display text-sm font-bold text-white">{p.name}</div>
                        <div className="text-[11px] text-[#8E92A4] leading-snug">{p.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Listening Banner */}
              {listening && (
                <div className="p-3 border-2 border-[#FACC15] bg-[#211C0D] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-pixel text-[10px] text-[#FACC15] mr-2">PULSA UNA TECLA...</span>
                    <span className="text-white">
                      Asignando{' '}
                      <strong>
                        {CONTROL_ACTION_META.find((m) => m.action === listening.action)?.label}
                      </strong>{' '}
                      (ranura {listening.slot + 1}) · Esc cancela
                    </span>
                  </div>
                  {listening.action === 'pause' && (
                    <button
                      type="button"
                      onClick={() => {
                        const { next } = assignKeyBinding(keyBindings, 'pause', listening.slot, 'Escape');
                        onUpdateKeyBindings(next);
                        setListening(null);
                        setNotice('Esc asignada a Pausa');
                      }}
                      className="pixel-btn px-2.5 py-1 font-pixel text-[10px] text-white cursor-pointer"
                    >
                      Asignar Esc
                    </button>
                  )}
                </div>
              )}

              {/* Keybinding Groups */}
              <div className="space-y-4">
                {groups.map((grp) => (
                  <div key={grp.id} className="space-y-1.5">
                    <div className="font-pixel text-[10px] text-[#38BDF8] border-b border-[#232530] pb-1">
                      {grp.title}
                    </div>
                    <div className="divide-y divide-[#1D1F29]">
                      {CONTROL_ACTION_META.filter((m) => m.group === grp.id).map((meta) => {
                        const slot = keyBindings[meta.action];
                        const isListening0 = listening?.action === meta.action && listening.slot === 0;
                        const isListening1 = listening?.action === meta.action && listening.slot === 1;
                        return (
                          <div
                            key={meta.action}
                            className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white">{meta.label}</div>
                              <div className="text-[11px] text-[#71717A]">{meta.desc}</div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  soundEngine.playUiClick();
                                  setListening({ action: meta.action, slot: 0 });
                                }}
                                className={`min-w-[84px] px-2.5 py-1.5 border-2 font-mono text-xs cursor-pointer transition-colors ${
                                  isListening0
                                    ? 'border-[#FACC15] bg-[#FACC15]/20 text-[#FACC15]'
                                    : 'border-[#2E3140] bg-[#161822] text-white hover:border-[#38BDF8]'
                                }`}
                              >
                                {isListening0 ? 'Pulsa tecla...' : formatKeyCode(slot[0])}
                              </button>

                              <div className="flex items-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    soundEngine.playUiClick();
                                    setListening({ action: meta.action, slot: 1 });
                                  }}
                                  title="Tecla alternativa (opcional)"
                                  className={`min-w-[78px] px-2.5 py-1.5 border-2 font-mono text-xs cursor-pointer transition-colors ${
                                    isListening1
                                      ? 'border-[#FACC15] bg-[#FACC15]/20 text-[#FACC15]'
                                      : slot[1]
                                      ? 'border-[#2B2D38] bg-[#13141B] text-[#D4D4D8] hover:border-[#38BDF8]'
                                      : 'border-dashed border-[#262834] bg-[#0F1016] text-[#52525B] hover:text-[#A1A1AA]'
                                  }`}
                                >
                                  {isListening1 ? 'Pulsa tecla...' : slot[1] ? formatKeyCode(slot[1]) : '+ Alt'}
                                </button>
                                {slot[1] && (
                                  <button
                                    type="button"
                                    aria-label={`Limpiar tecla alternativa de ${meta.label}`}
                                    onClick={() => {
                                      const { next } = assignKeyBinding(keyBindings, meta.action, 1, null);
                                      onUpdateKeyBindings(next);
                                      soundEngine.playUiClick();
                                    }}
                                    className="ml-1 px-1.5 py-1.5 text-xs font-mono text-[#71717A] hover:text-[#F43F5E] cursor-pointer"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pixel-panel p-3 bg-[#0E0F14] text-xs text-[#A1A1AA]">
                <span className="font-pixel text-[9px] text-[#FACC15] mr-2">RATÓN SIEMPRE ACTIVO:</span>
                Clic izquierdo perfora el bloque adyacente (o detona bloques ardiendo) · Mantener clic derecho y
                deslizar permuta hacia izquierda, derecha, arriba o abajo.
              </div>
            </>
          )}

          {section === 'MOBILE' && (
            <div className="space-y-4">
              <p className="text-sm text-[#D4D4D8] leading-relaxed">
                Sin teclados virtuales molestos: todas las acciones de bloque se hacen directamente sobre el pozo y puedes
                elegir cómo prefieres controlar el movimiento y el impulso.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  onClick={() => selectTouchMode('GESTURES')}
                  className={`p-4 text-left border-2 transition-all cursor-pointer space-y-2 ${
                    touchMode === 'GESTURES'
                      ? 'border-[#FACC15] bg-[#1E1A0E] shadow-[inset_0_2px_0_rgba(250,204,21,0.2)]'
                      : 'border-[#2B2D38] bg-[#14151C] hover:border-[#4B5063]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-pixel text-[10px] text-[#FACC15]">PRINCIPAL · PANTALLA COMPLETA</span>
                    {touchMode === 'GESTURES' && (
                      <span className="px-2 py-0.5 bg-[#FACC15]/20 border border-[#FACC15] font-pixel text-[9px] text-[#FACC15]">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <div className="font-display text-xl font-bold text-white">100% Gestos Directos</div>
                  <p className="text-xs text-[#D4D4D8] leading-relaxed">
                    Sin barra inferior: el pozo ocupa toda la pantalla. Toca o arrastra bloques cercanos para picar o
                    permutar; mantén tocado a izquierda/derecha del pozo para moverte; desliza rápido a los lados (o doble
                    tap) para hacer Dash, arriba para Freno Aéreo y abajo en caída para Slam.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => selectTouchMode('HYBRID')}
                  className={`p-4 text-left border-2 transition-all cursor-pointer space-y-2 ${
                    touchMode === 'HYBRID'
                      ? 'border-[#38BDF8] bg-[#0F1B26] shadow-[inset_0_2px_0_rgba(56,189,248,0.2)]'
                      : 'border-[#2B2D38] bg-[#14151C] hover:border-[#4B5063]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-pixel text-[10px] text-[#38BDF8]">ALTERNATIVA · BARRA PULGAR</span>
                    {touchMode === 'HYBRID' && (
                      <span className="px-2 py-0.5 bg-[#38BDF8]/20 border border-[#38BDF8] font-pixel text-[9px] text-[#38BDF8]">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <div className="font-display text-xl font-bold text-white">Híbrido Minimalista (Pulgar + Pozo)</div>
                  <p className="text-xs text-[#D4D4D8] leading-relaxed">
                    Franja inferior ergonómica con <strong>slider suave</strong> para el pulgar izquierdo (mover izq/der,
                    empujar arriba para escalar y abajo para Slam) + dos botones grandes a la derecha (
                    <strong>DASH / FRENO</strong> y <strong>PICAR</strong>), manteniendo todos los toques y deslizamientos
                    directos sobre los bloques.
                  </p>
                </button>
              </div>

              <div className="pixel-panel p-3.5 bg-[#101117] flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-pixel text-[10px] text-[#FB923C]">DESLIZAR ↓ PARA PICAR BLOQUE A BLOQUE</div>
                  <div className="text-[#A1A1AA] mt-0.5">
                    Arrastra el dedo hacia abajo en pantalla para picar cada bloque bajo tus pies (en caída libre mantiene el Slam).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.init();
                    soundEngine.playUiClick();
                    onUpdateVisualSettings({ ...visualSettings, swipeDownDrill: !swipeDownDrill });
                  }}
                  className={`pixel-btn px-3 py-1.5 font-pixel text-[10px] shrink-0 cursor-pointer ${
                    swipeDownDrill ? 'border-[#F97316] bg-[#21130C] text-[#FDBA74]' : 'text-[#A1A1AA]'
                  }`}
                >
                  {swipeDownDrill ? 'ACTIVADO' : 'DESACT.'}
                </button>
              </div>

              <div className="pixel-panel p-3.5 bg-[#0D0E14] space-y-2 text-xs">
                <div className="font-pixel text-[10px] text-[#FACC15]">GESTOS COMUNES EN EL POZO (AMBOS MODOS)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#A1A1AA]">Tap en bloque cercano</span>
                    <span className="text-white">Perforar</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#A1A1AA]">Arrastrar bloque cercano</span>
                    <span className="text-[#38BDF8]">Permutar / Parry</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#A1A1AA]">Tap bloque en ignición</span>
                    <span className="text-[#FB923C]">Detonar ya</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#A1A1AA]">Deslizar abajo / arriba aire</span>
                    <span className="text-[#FACC15]">Slam / Freno Aéreo</span>
                  </div>
                </div>
              </div>

              <div className="pixel-panel p-3.5 bg-[#101117] space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-pixel text-[10px] text-[#38BDF8]">POSICIÓN DE CÁMARA (ZONA DE ACCIÓN)</span>
                  <span className="font-mono text-[#FACC15] tabular-nums">
                    {Math.round(clampCameraAnchorY(visualSettings.cameraAnchorY, DEFAULT_PC_CAMERA_ANCHOR_Y) * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-[#8E92A4]">Arriba</span>
                  <input
                    type="range"
                    min={Math.round(MIN_CAMERA_ANCHOR_Y * 100)}
                    max={Math.round(MAX_CAMERA_ANCHOR_Y * 100)}
                    value={Math.round(clampCameraAnchorY(visualSettings.cameraAnchorY, DEFAULT_PC_CAMERA_ANCHOR_Y) * 100)}
                    onChange={(e) =>
                      onUpdateVisualSettings({
                        ...visualSettings,
                        cameraAnchorY: Number(e.target.value) / 100,
                      })
                    }
                    className="flex-1 accent-[#38BDF8]"
                  />
                  <span className="font-mono text-[11px] text-[#8E92A4]">Pulgares</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onUpdateVisualSettings({ ...visualSettings, cameraAnchorY: DEFAULT_PC_CAMERA_ANCHOR_Y });
                    }}
                    className="pixel-btn px-2.5 py-1 font-pixel text-[9px] text-white cursor-pointer"
                  >
                    Estándar PC (42%)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      onUpdateVisualSettings({ ...visualSettings, cameraAnchorY: DEFAULT_MOBILE_CAMERA_ANCHOR_Y });
                    }}
                    className="pixel-btn px-2.5 py-1 font-pixel text-[9px] text-[#38BDF8] cursor-pointer"
                  >
                    Ergonómico Móvil (60%)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 border-t-2 border-[#262834] bg-[#0D0E14] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {onUpdateVisualSettings && visualSettings && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                onUpdateVisualSettings({ ...visualSettings, skipIntro: !visualSettings.skipIntro });
              }}
              className="pixel-btn px-3 py-1.5 font-pixel text-[10px] text-[#D4D4D8] hover:text-white cursor-pointer"
            >
              Intro animada al inicio:{' '}
              <span className={visualSettings.skipIntro ? 'text-[#71717A]' : 'text-[#A3E635]'}>
                {visualSettings.skipIntro ? 'OMITIR' : 'ACTIVADA'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              onClose();
            }}
            className="pixel-btn-primary px-6 py-2 font-pixel text-xs font-bold text-white cursor-pointer ml-auto"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

