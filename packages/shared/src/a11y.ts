/** Accessibility settings: colour-blind palette, sound captions and free key bindings. */

export type KeyAction = "throttle" | "brake" | "left" | "right" | "drift" | "nitro" | "reset" | "item" | "horn";

export const KEY_ACTIONS: KeyAction[] = ["throttle", "brake", "left", "right", "drift", "nitro", "reset", "item", "horn"];

export const KEY_ACTION_NAMES: Record<KeyAction, string> = {
  throttle: "Gas",
  brake: "Bremse / Rückwärts",
  left: "Links lenken",
  right: "Rechts lenken",
  drift: "Drift",
  nitro: "Nitro",
  reset: "Zurücksetzen",
  item: "Item benutzen",
  horn: "Hupe",
};

export type KeyBindings = Record<KeyAction, string[]>;

export const DEFAULT_KEYS: KeyBindings = {
  throttle: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  drift: ["Space"],
  nitro: ["ShiftLeft", "ShiftRight"],
  reset: ["KeyR"],
  item: ["KeyE"],
  horn: ["KeyH"],
};

/** Keys that stay reserved for menus and system functions. */
export const RESERVED_KEYS = ["Escape", "Enter", "Tab", "KeyM", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"];

export interface A11ySettings {
  colorblind: boolean;
  captions: boolean;
  keys: KeyBindings;
}

export const DEFAULT_A11Y: A11ySettings = { colorblind: false, captions: false, keys: DEFAULT_KEYS };

/**
 * Put `code` as the main key of `action`. The key is taken away from every other action,
 * and the action keeps its old second key (if any) so arrows stay usable.
 * Reserved keys are refused (returns the bindings unchanged).
 */
export function rebind(keys: KeyBindings, action: KeyAction, code: string): KeyBindings {
  if (RESERVED_KEYS.includes(code)) return keys;
  const out = {} as KeyBindings;
  for (const a of KEY_ACTIONS) out[a] = (keys[a] ?? []).filter((c) => c !== code);
  const rest = out[action].slice(1, 2);
  out[action] = [code, ...rest.filter((c) => c !== code)];
  return out;
}

/** Read stored settings; unknown or broken values fall back to the defaults. */
export function parseA11y(text: string | null): A11ySettings {
  try {
    const j = JSON.parse(text ?? "") as Partial<A11ySettings>;
    const keys = { ...DEFAULT_KEYS };
    if (j.keys && typeof j.keys === "object") {
      for (const a of KEY_ACTIONS) {
        const v = (j.keys as Partial<KeyBindings>)[a];
        if (Array.isArray(v) && v.every((c) => typeof c === "string" && /^[A-Za-z0-9]+$/.test(c))) keys[a] = v.slice(0, 2);
      }
    }
    return { colorblind: j.colorblind === true, captions: j.captions === true, keys };
  } catch {
    return { ...DEFAULT_A11Y, keys: { ...DEFAULT_KEYS } };
  }
}

/** Readable name of a key code ("KeyW" → "W", "ArrowUp" → "↑"). */
export function keyLabel(code: string): string {
  const special: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Space: "Leertaste",
    ShiftLeft: "Shift",
    ShiftRight: "Shift rechts",
    ControlLeft: "Strg",
    ControlRight: "Strg rechts",
    AltLeft: "Alt",
    Backspace: "⌫",
  };
  if (special[code]) return special[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  return code;
}

/**
 * Colour-blind friendly racer colours (Okabe–Ito palette plus white and grey):
 * distinguishable with red-green and blue-yellow colour blindness.
 */
export const COLORBLIND_RACER_COLORS = [0x56b4e9, 0xe69f00, 0xf0e442, 0xcc79a7, 0x009e73, 0xffffff, 0xd55e00, 0x0072b2, 0x9a9a9a, 0xffb6db];

/** Colour of grid slot `slot` – the normal colour, or the colour-blind palette. */
export function racerColor(normal: number, slot: number, colorblind: boolean): number {
  return colorblind ? COLORBLIND_RACER_COLORS[slot % COLORBLIND_RACER_COLORS.length]! : normal;
}

/** Text captions for sounds that carry game information. */
export const SOUND_CAPTIONS: Partial<Record<string, string>> = {
  finalLap: "♪ Letzte Runde",
  hit: "💥 Getroffen",
  blocked: "🛡 Abgewehrt",
  emp: "⚡ EMP-Puls",
  mine: "Mine gelegt",
  drone: "Drohne gestartet",
  shield: "🛡 Schild aktiv",
  turbo: "Turbo",
  pickup: "Item aufgenommen",
  perfectStart: "Perfektstart",
  finish: "🏁 Ziel",
  go: "Los!",
};
