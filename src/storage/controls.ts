import { ControlAction, KeyBindingPresetId, KeyBindings } from '../types/game';

const CONTROLS_STORAGE_KEY = 'estrato_controls_v1';

export interface ControlActionMeta {
  action: ControlAction;
  label: string;
  desc: string;
  group: 'MOVIMIENTO' | 'ACCIONES' | 'TACTICO';
}

export const CONTROL_ACTION_META: ControlActionMeta[] = [
  { action: 'left', label: 'Mover Izquierda', desc: 'Caminar / apuntar a la izquierda', group: 'MOVIMIENTO' },
  { action: 'right', label: 'Mover Derecha', desc: 'Caminar / apuntar a la derecha', group: 'MOVIMIENTO' },
  { action: 'up', label: 'Mirar Arriba / Escalar', desc: 'Apuntar arriba, escalar o preparar Parry', group: 'MOVIMIENTO' },
  { action: 'down', label: 'Mirar Abajo', desc: 'Fijar mira hacia el bloque inferior', group: 'MOVIMIENTO' },
  { action: 'drill', label: 'Perforar (Taladro)', desc: 'Romper el bloque hacia donde apuntas', group: 'ACCIONES' },
  { action: 'swapLeft', label: 'Permutar Izquierda / Arriba', desc: 'Intercambia hacia la izquierda (o arriba en pared)', group: 'ACCIONES' },
  { action: 'swapRight', label: 'Permutar Derecha / Abajo', desc: 'Intercambia hacia la derecha (o abajo en pared)', group: 'ACCIONES' },
  { action: 'dash', label: 'Impulso / Freno Aéreo', desc: 'Dash horizontal o amortiguación en caída alta', group: 'ACCIONES' },
  { action: 'slam', label: 'Slam (Mantener en caída)', desc: 'Caída rápida ×2,5 con onda expansiva', group: 'ACCIONES' },
  { action: 'detonate', label: 'Detonar Mecha Ya', desc: 'Hace estallar inmediatamente bloques en ignición', group: 'ACCIONES' },
  { action: 'overdrive', label: 'Activar Overdrive', desc: 'Desata el modo sísmico al llegar al 100%', group: 'TACTICO' },
  { action: 'reroll', label: 'Re-calibrar Brecha', desc: 'Cambia módulos ofrecidos en Cámaras de Brecha', group: 'TACTICO' },
  { action: 'gadget1', label: 'Artilugio Ranura 1', desc: 'Activa el consumible táctico [1]', group: 'TACTICO' },
  { action: 'gadget2', label: 'Artilugio Ranura 2', desc: 'Activa el consumible táctico [2]', group: 'TACTICO' },
  { action: 'gadget3', label: 'Artilugio Ranura 3', desc: 'Activa el consumible táctico [3]', group: 'TACTICO' },
  { action: 'pause', label: 'Pausa / Menú', desc: 'Pausa la partida y abre ajustes rápidos', group: 'TACTICO' },
];

export const KEYBINDING_PRESETS: Record<
  KeyBindingPresetId,
  { id: KeyBindingPresetId; name: string; desc: string; bindings: KeyBindings }
> = {
  STANDARD: {
    id: 'STANDARD',
    name: 'Estándar (WASD + Q/E)',
    desc: 'Esquema clásico equilibrado con soporte para flechas',
    bindings: {
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      drill: ['Space', 'KeyJ'],
      swapLeft: ['KeyQ', 'KeyU'],
      swapRight: ['KeyE', 'KeyO'],
      dash: ['KeyC', 'ControlLeft'],
      overdrive: ['KeyX', 'KeyV'],
      slam: ['ShiftLeft', 'ShiftRight'],
      detonate: ['KeyK', 'KeyF'],
      reroll: ['KeyR', null],
      gadget1: ['Digit1', null],
      gadget2: ['Digit2', null],
      gadget3: ['Digit3', null],
      pause: ['Escape', 'KeyP'],
    },
  },
  ARROWS_ZXC: {
    id: 'ARROWS_ZXC',
    name: 'Flechas + Z/X/C',
    desc: 'Movimiento con flechas y acciones en mano izquierda',
    bindings: {
      left: ['ArrowLeft', null],
      right: ['ArrowRight', null],
      up: ['ArrowUp', null],
      down: ['ArrowDown', null],
      drill: ['KeyZ', 'Space'],
      swapLeft: ['KeyA', 'KeyQ'],
      swapRight: ['KeyD', 'KeyE'],
      dash: ['KeyX', 'ControlLeft'],
      overdrive: ['KeyC', 'KeyV'],
      slam: ['ShiftLeft', 'ShiftRight'],
      detonate: ['KeyS', 'KeyF'],
      reroll: ['KeyR', null],
      gadget1: ['Digit1', null],
      gadget2: ['Digit2', null],
      gadget3: ['Digit3', null],
      pause: ['Escape', 'KeyP'],
    },
  },
  LEFT_HAND_MOUSE: {
    id: 'LEFT_HAND_MOUSE',
    name: 'Mano Izq. + Ratón',
    desc: 'Optimizado para combinar WASD con clic derecho deslizable',
    bindings: {
      left: ['KeyA', null],
      right: ['KeyD', null],
      up: ['KeyW', null],
      down: ['KeyS', null],
      drill: ['Space', 'KeyJ'],
      swapLeft: ['KeyQ', null],
      swapRight: ['KeyE', null],
      dash: ['ShiftLeft', null],
      overdrive: ['KeyF', null],
      slam: ['KeyC', null],
      detonate: ['KeyG', null],
      reroll: ['KeyR', null],
      gadget1: ['Digit1', null],
      gadget2: ['Digit2', null],
      gadget3: ['Digit3', null],
      pause: ['Escape', 'KeyP'],
    },
  },
};

function cloneBindings(b: KeyBindings): KeyBindings {
  const out = {} as KeyBindings;
  for (const meta of CONTROL_ACTION_META) {
    const slot = b[meta.action] || KEYBINDING_PRESETS.STANDARD.bindings[meta.action];
    out[meta.action] = [slot[0], slot[1] ?? null];
  }
  return out;
}

export function getDefaultKeyBindings(): KeyBindings {
  return cloneBindings(KEYBINDING_PRESETS.STANDARD.bindings);
}

export function loadKeyBindings(): KeyBindings {
  const base = getDefaultKeyBindings();
  try {
    const raw = localStorage.getItem(CONTROLS_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<KeyBindings>;
    for (const meta of CONTROL_ACTION_META) {
      const slot = parsed[meta.action];
      if (Array.isArray(slot) && typeof slot[0] === 'string' && slot[0].length > 0) {
        base[meta.action] = [slot[0], typeof slot[1] === 'string' && slot[1].length > 0 ? slot[1] : null];
      }
    }
    return base;
  } catch {
    return base;
  }
}

export function saveKeyBindings(bindings: KeyBindings): void {
  try {
    localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    // Ignore storage quota errors
  }
}

export function isCodeBoundToAction(bindings: KeyBindings, action: ControlAction, code: string): boolean {
  const slot = bindings[action];
  return Boolean(slot && (slot[0] === code || slot[1] === code));
}

export function isActionHeld(bindings: KeyBindings, action: ControlAction, held: Set<string>): boolean {
  const slot = bindings[action];
  if (!slot) return false;
  return held.has(slot[0]) || Boolean(slot[1] && held.has(slot[1]));
}

export function assignKeyBinding(
  bindings: KeyBindings,
  action: ControlAction,
  slotIndex: 0 | 1,
  newCode: string | null
): { next: KeyBindings; swappedFrom?: ControlAction } {
  const next = cloneBindings(bindings);
  if (newCode === null) {
    if (slotIndex === 1) {
      next[action][1] = null;
      return { next };
    }
    if (next[action][1]) {
      next[action][0] = next[action][1]!;
      next[action][1] = null;
    }
    return { next };
  }

  const prevCode = next[action][slotIndex];
  const otherSlotInSelf: 0 | 1 = slotIndex === 0 ? 1 : 0;

  if (next[action][otherSlotInSelf] === newCode) {
    if (slotIndex === 0) {
      next[action][1] = prevCode;
      next[action][0] = newCode;
    }
    return { next };
  }

  let swappedFrom: ControlAction | undefined;
  for (const meta of CONTROL_ACTION_META) {
    if (meta.action === action) continue;
    for (const sIdx of [0, 1] as const) {
      if (next[meta.action][sIdx] === newCode) {
        swappedFrom = meta.action;
        if (sIdx === 0) {
          if (prevCode) {
            next[meta.action][0] = prevCode;
          } else if (next[meta.action][1]) {
            next[meta.action][0] = next[meta.action][1]!;
            next[meta.action][1] = null;
          } else {
            next[meta.action][0] = next[action][0];
          }
        } else {
          next[meta.action][1] = null;
        }
      }
    }
  }

  next[action][slotIndex] = newCode;
  if (next[action][0] === next[action][1]) {
    next[action][1] = null;
  }
  return { next, swappedFrom };
}

const KEY_LABELS: Record<string, string> = {
  Space: 'Espacio',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift D.',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl D.',
  AltLeft: 'Alt',
  AltRight: 'AltGr',
  Escape: 'Esc',
  Enter: 'Intro',
  Tab: 'Tab',
  Backspace: 'Retro',
};

export function formatKeyCode(code: string | null): string {
  if (!code) return '—';
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num${code.slice(6)}`;
  return code;
}

export function formatActionKeys(bindings: KeyBindings, action: ControlAction): string {
  const slot = bindings[action];
  if (!slot) return '—';
  const k1 = formatKeyCode(slot[0]);
  const k2 = slot[1] ? formatKeyCode(slot[1]) : null;
  return k2 ? `${k1} / ${k2}` : k1;
}

