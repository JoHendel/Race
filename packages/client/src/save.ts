import { carById, looksOf, parseSave, statsFor, tuningOf, type CarLooks, type SaveGame, type Tuning } from "@apex/shared";

const KEY = "apex-save-v1";

let cached: SaveGame | null = null;

export function loadSave(): SaveGame {
  if (cached) return cached;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* Speicher nicht verfügbar: Spielstand nur für diese Sitzung */
  }
  cached = parseSave(raw);
  return cached;
}

export function storeSave(save: SaveGame): void {
  cached = save;
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* egal */
  }
}

export interface CarChoice {
  id: string;
  tuning: Tuning;
  looks: CarLooks;
}

/** Das aktuell gewählte Auto mit Tuning und Optik. */
export function currentCar(): CarChoice {
  const save = loadSave();
  return { id: save.selected, tuning: tuningOf(save, save.selected), looks: looksOf(save, save.selected) };
}

export function choiceStats(choice: CarChoice) {
  return statsFor(carById(choice.id), choice.tuning);
}
