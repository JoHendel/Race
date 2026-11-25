import { CARS, carById, defaultLooks, stockTuning, type CarLooks, type Tuning } from "./cars";

/** Spielstand. Wird lokal gespeichert. */
export interface SaveGame {
  version: 1;
  xp: number;
  credits: number;
  selected: string;
  cupWins: number;
  tuning: Record<string, Tuning>;
  looks: Record<string, CarLooks>;
  /** Freigeschaltete Optik-Teile je Auto, z. B. "decal", "spoiler". */
  boughtLooks: Record<string, string[]>;
}

export function newSave(): SaveGame {
  return { version: 1, xp: 0, credits: 500, selected: CARS[0]!.id, cupWins: 0, tuning: {}, looks: {}, boughtLooks: {} };
}

/** Liest einen Spielstand robust ein; kaputte oder alte Daten werden ersetzt. */
export function parseSave(raw: string | null): SaveGame {
  if (!raw) return newSave();
  try {
    const data = JSON.parse(raw) as Partial<SaveGame>;
    if (data.version !== 1) return newSave();
    const base = newSave();
    return {
      ...base,
      ...data,
      xp: Math.max(0, Number(data.xp) || 0),
      credits: Math.max(0, Number(data.credits) || 0),
      tuning: data.tuning ?? {},
      looks: data.looks ?? {},
      boughtLooks: data.boughtLooks ?? {},
    };
  } catch {
    return newSave();
  }
}

/** XP-Schwelle für ein Level (Level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(300 * Math.pow(level - 1, 1.35));
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < 30 && xp >= xpForLevel(level + 1)) level++;
  return level;
}

export interface RaceReward {
  xp: number;
  credits: number;
}

/** Belohnung für ein Rennen nach Platz, Feldgröße und Leistungen. */
export function raceReward(place: number, total: number, finished: boolean, driftTime: number, overtakes: number): RaceReward {
  const placeShare = total > 1 ? (total - place) / (total - 1) : 1;
  const xp = Math.round(80 + placeShare * 220 + Math.min(120, driftTime * 6) + overtakes * 15 + (finished ? 40 : 0));
  const credits = Math.round(100 + placeShare * 400 + (place === 1 ? 200 : 0) + (finished ? 50 : 0));
  return { xp, credits };
}

export function isUnlocked(save: SaveGame, carId: string): boolean {
  const def = carById(carId);
  if (def.unlockByCup && save.cupWins > 0) return true;
  return levelFromXp(save.xp) >= def.unlockLevel;
}

export function tuningOf(save: SaveGame, carId: string): Tuning {
  return save.tuning[carId] ?? stockTuning();
}

export function looksOf(save: SaveGame, carId: string): CarLooks {
  return save.looks[carId] ?? defaultLooks(carById(carId));
}

/** Wendet eine Belohnung an und meldet neu freigeschaltete Autos. */
export function applyReward(save: SaveGame, reward: RaceReward): { save: SaveGame; levelUp: boolean; unlocked: string[] } {
  const before = CARS.filter((c) => isUnlocked(save, c.id)).map((c) => c.id);
  const oldLevel = levelFromXp(save.xp);
  const next = { ...save, xp: save.xp + reward.xp, credits: save.credits + reward.credits };
  const unlocked = CARS.filter((c) => isUnlocked(next, c.id) && !before.includes(c.id)).map((c) => c.name);
  return { save: next, levelUp: levelFromXp(next.xp) > oldLevel, unlocked };
}
