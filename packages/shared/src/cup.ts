import { pointsForPlace } from "./scoring";

export interface RaceResultEntry {
  id: string;
  name: string;
  color: number;
  place: number;
  fastestLap: boolean;
  /** Extra points (e.g. for beating the rival). */
  bonus?: number;
}

export interface StandingRow {
  id: string;
  name: string;
  color: number;
  points: number;
  wins: number;
  lastPlace: number;
}

/** Gesamtwertung eines Grand Prix über mehrere Rennen. */
export class CupStandings {
  private rows = new Map<string, StandingRow>();
  races = 0;

  constructor(readonly totalRaces = 4) {}

  add(results: RaceResultEntry[]): void {
    this.races++;
    for (const r of results) {
      const row = this.rows.get(r.id) ?? { id: r.id, name: r.name, color: r.color, points: 0, wins: 0, lastPlace: r.place };
      row.points += pointsForPlace(r.place, r.fastestLap) + (r.bonus ?? 0);
      if (r.place === 1) row.wins++;
      row.lastPlace = r.place;
      row.name = r.name;
      this.rows.set(r.id, row);
    }
  }

  /** Sortiert nach Punkten, dann Siegen, dann letzter Platzierung. */
  table(): StandingRow[] {
    return [...this.rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.lastPlace - b.lastPlace);
  }

  get finished(): boolean {
    return this.races >= this.totalRaces;
  }
}

export interface AwardInput {
  id: string;
  name: string;
  bestLap: number | null;
  driftTime: number;
  overtakes: number;
  worstPlace: number;
  finalPlace: number;
}

export interface Award {
  key: "fastest" | "drift" | "overtakes" | "comeback";
  title: string;
  id: string;
  name: string;
  detail: string;
}

/** Auszeichnungen nach einem Rennen. Nur vergeben, wenn es einen echten Wert gibt. */
export function computeAwards(racers: AwardInput[]): Award[] {
  const awards: Award[] = [];
  const withLap = racers.filter((r) => r.bestLap !== null);
  if (withLap.length) {
    const r = withLap.reduce((a, b) => (b.bestLap! < a.bestLap! ? b : a));
    awards.push({ key: "fastest", title: "Schnellste Runde", id: r.id, name: r.name, detail: `${r.bestLap!.toFixed(2)} s` });
  }
  const drifter = racers.reduce((a, b) => (b.driftTime > a.driftTime ? b : a), racers[0]!);
  if (drifter && drifter.driftTime >= 1) {
    awards.push({ key: "drift", title: "Drift-König", id: drifter.id, name: drifter.name, detail: `${drifter.driftTime.toFixed(1)} s gedriftet` });
  }
  const overtaker = racers.reduce((a, b) => (b.overtakes > a.overtakes ? b : a), racers[0]!);
  if (overtaker && overtaker.overtakes > 0) {
    awards.push({ key: "overtakes", title: "Meiste Überholungen", id: overtaker.id, name: overtaker.name, detail: `${overtaker.overtakes}×` });
  }
  const comeback = racers.reduce((a, b) => (b.worstPlace - b.finalPlace > a.worstPlace - a.finalPlace ? b : a), racers[0]!);
  if (comeback && comeback.worstPlace - comeback.finalPlace >= 2) {
    awards.push({
      key: "comeback",
      title: "Comeback des Rennens",
      id: comeback.id,
      name: comeback.name,
      detail: `von Platz ${comeback.worstPlace} auf ${comeback.finalPlace}`,
    });
  }
  return awards;
}
