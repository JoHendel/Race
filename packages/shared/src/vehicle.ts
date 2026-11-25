/** Fahrwerte eines Fahrzeugs. Alle Zahlen in SI-Einheiten (m, s, kg, N). */
export interface VehicleStats {
  id: string;
  name: string;
  /** Höchstgeschwindigkeit in m/s. */
  topSpeed: number;
  /** Antriebskraft pro angetriebenem Rad in N. */
  engineForce: number;
  /** Bremskraft pro Rad. */
  brakeForce: number;
  /** Maximaler Lenkwinkel bei Stillstand in rad. */
  maxSteer: number;
  /** Grip der Reifen (Reibung). */
  grip: number;
  /** Seitenhaftung der Hinterräder im Drift (0 = rutscht komplett, 1 = normal). */
  driftGrip: number;
  /** Zusätzliche Drehhilfe im Drift. */
  driftYawAssist: number;
  /** Nitro-Kapazität in Sekunden Vollgas-Boost. */
  nitroCapacity: number;
  /** Zusatzkraft beim Nitro in N (auf das Chassis). */
  nitroForce: number;
}

export const STARTER_CAR: VehicleStats = {
  id: "volt-hatch",
  name: "Volt Hatch",
  topSpeed: 52,
  engineForce: 6800,
  brakeForce: 90,
  maxSteer: 0.55,
  grip: 3.6,
  driftGrip: 0.35,
  driftYawAssist: 1.5,
  nitroCapacity: 3,
  nitroForce: 9000,
};

/** Drift-Stufen: ab welcher Driftdauer (s) welche Stufe erreicht ist und wie lange der Boost hält. */
export const DRIFT_LEVELS = [
  { minTime: 0.7, boostTime: 0.5, boostForce: 7000, color: "cyan" },
  { minTime: 1.5, boostTime: 0.9, boostForce: 8500, color: "orange" },
  { minTime: 2.4, boostTime: 1.4, boostForce: 10000, color: "violet" },
] as const;

/** Mindestgeschwindigkeit in m/s, ab der ein Drift zählt. */
export const DRIFT_MIN_SPEED = 9;

/** Gibt die Drift-Stufe (0 = keine, 1–3) für eine Driftdauer zurück. */
export function driftLevel(driftTime: number): 0 | 1 | 2 | 3 {
  let level: 0 | 1 | 2 | 3 = 0;
  DRIFT_LEVELS.forEach((l, i) => {
    if (driftTime >= l.minTime) level = (i + 1) as 1 | 2 | 3;
  });
  return level;
}

/** Lenkwinkel nimmt mit dem Tempo ab, damit das Auto bei Vollgas stabil bleibt. */
export function steerAngle(maxSteer: number, speed: number, topSpeed: number): number {
  const t = Math.min(1, Math.abs(speed) / topSpeed);
  return maxSteer * (1 - 0.6 * t);
}

/** Nitro-Tank: lädt durch Drifts und Tricks, leert sich beim Boosten. */
export class NitroTank {
  amount = 0;
  constructor(readonly capacity: number) {}

  /** Füllt um `seconds` Boost-Sekunden auf, maximal bis zur Kapazität. */
  charge(seconds: number): void {
    this.amount = Math.min(this.capacity, this.amount + Math.max(0, seconds));
  }

  /** Verbraucht `dt` Sekunden. Gibt zurück, ob Nitro verfügbar war. */
  drain(dt: number): boolean {
    if (this.amount <= 0) return false;
    this.amount = Math.max(0, this.amount - dt);
    return true;
  }

  get fraction(): number {
    return this.capacity > 0 ? this.amount / this.capacity : 0;
  }
}
