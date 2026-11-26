import { parseA11y, type A11ySettings, type KeyAction } from "@apex/shared";

const STORE_KEY = "apexrush.a11y";

let current: A11ySettings = load();
const listeners = new Set<(s: A11ySettings) => void>();

function load(): A11ySettings {
  try {
    return parseA11y(localStorage.getItem(STORE_KEY));
  } catch {
    return parseA11y(null);
  }
}

export function a11y(): A11ySettings {
  return current;
}

export function setA11y(patch: Partial<A11ySettings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
  document.body.classList.toggle("colorblind", current.colorblind);
  for (const l of listeners) l(current);
}

export function onA11yChange(fn: (s: A11ySettings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Is `code` bound to `action`? */
export function isKey(action: KeyAction, code: string): boolean {
  return current.keys[action].includes(code);
}

export function initA11y(): void {
  document.body.classList.toggle("colorblind", current.colorblind);
}
