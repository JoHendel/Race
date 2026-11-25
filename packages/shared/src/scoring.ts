/** Punkte pro Platz im Grand Prix (Index 0 = Platz 1). */
export const GRAND_PRIX_POINTS = [15, 12, 10, 8, 7, 6, 5, 4, 3, 2] as const;

/** Bonuspunkt für die schnellste Runde. */
export const FASTEST_LAP_BONUS = 1;

export const MAX_PLAYERS = 10;
export const DEFAULT_LAPS = 3;
export const MIN_LAPS = 1;
export const MAX_LAPS = 10;

/** Punkte für einen Platz (1-basiert). Plätze außerhalb der Wertung bekommen 0. */
export function pointsForPlace(place: number, fastestLap = false): number {
  const base = GRAND_PRIX_POINTS[place - 1] ?? 0;
  return base + (fastestLap ? FASTEST_LAP_BONUS : 0);
}

/** Begrenzt eine gewünschte Rundenzahl auf den erlaubten Bereich. */
export function clampLaps(laps: number): number {
  if (!Number.isFinite(laps)) return DEFAULT_LAPS;
  return Math.min(MAX_LAPS, Math.max(MIN_LAPS, Math.round(laps)));
}
