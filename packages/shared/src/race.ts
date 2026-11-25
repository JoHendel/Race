/** Rennlogik ohne Grafik: Rundenzählung, Checkpoints, Platzierung, Zeiten. */

export const CHECKPOINTS_PER_LAP = 24;

/** Verfolgt den Fortschritt eines Fahrers auf einer Rundstrecke. */
export class LapTracker {
  lap = 0; // abgeschlossene Runden
  finished = false;
  finishTime: number | null = null;
  lapTimes: number[] = [];
  private raw = 0; // fortlaufender Fortschritt in Runden
  private last: number | null = null;
  private lapStart = 0;
  private visited = new Set<number>();

  constructor(readonly totalLaps: number) {}

  /** Gesamtfortschritt in Runden, z. B. 1.5 = Mitte der zweiten Runde. */
  get progress(): number {
    return this.raw;
  }

  /** Position auf der aktuellen Runde (0..1). */
  get fraction(): number {
    return this.raw - this.lap;
  }

  get bestLap(): number | null {
    return this.lapTimes.length ? Math.min(...this.lapTimes) : null;
  }

  /**
   * Aktualisiert mit der aktuellen Position auf der Strecke (0..1).
   * Eine Runde zählt nur, wenn fast alle Checkpoints besucht wurden – Abkürzen lohnt sich nicht.
   * Gibt `true` zurück, wenn gerade eine Runde abgeschlossen wurde.
   */
  update(fraction: number, raceTime: number): boolean {
    if (this.finished) return false;
    if (this.last === null) {
      // Startaufstellung steht kurz hinter der Linie.
      this.raw = fraction > 0.5 ? fraction - 1 : fraction;
      this.last = fraction;
      return false;
    }
    let delta = fraction - this.last;
    if (delta < -0.5) delta += 1;
    if (delta > 0.5) delta -= 1;
    this.last = fraction;
    this.raw += delta;

    const within = this.raw - this.lap;
    if (within >= 0 && within < 1) this.visited.add(Math.floor(within * CHECKPOINTS_PER_LAP));

    if (this.raw >= this.lap + 1) {
      if (this.visited.size >= CHECKPOINTS_PER_LAP - 2) {
        this.lap++;
        this.lapTimes.push(raceTime - this.lapStart);
        this.lapStart = raceTime;
        this.visited.clear();
        if (this.lap >= this.totalLaps) {
          this.finished = true;
          this.finishTime = raceTime;
        }
        return true;
      }
      this.raw = this.lap + 0.999;
    }
    return false;
  }

  currentLapTime(raceTime: number): number {
    return raceTime - this.lapStart;
  }
}

export interface Ranked {
  id: string;
  progress: number;
  finishTime: number | null;
}

/** Sortiert Fahrer: zuerst Fertige nach Zielzeit, dann alle anderen nach Fortschritt. */
export function rankRacers<T extends Ranked>(racers: T[]): T[] {
  return [...racers].sort((a, b) => {
    if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime;
    if (a.finishTime !== null) return -1;
    if (b.finishTime !== null) return 1;
    return b.progress - a.progress;
  });
}

/** Formatiert Sekunden als m:ss.mmm. */
export function formatTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "–";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

/** Perfektstart: Gas innerhalb dieses Fensters nach GO gibt einen Boost. */
export const PERFECT_START_WINDOW = 0.35;
/** Wer zu früh Gas gibt (vor GO), dreht so lange durch. */
export const FALSE_START_PENALTY = 1.0;
/** Zeit für die anderen, nachdem der Erste im Ziel ist. */
export const FINISH_GRACE_TIME = 30;
