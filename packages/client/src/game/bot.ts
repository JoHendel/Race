import * as THREE from "three";
import type { Car } from "./car";
import type { ControlState } from "./input";
import type { SplineTrack } from "./track/splineTrack";

export type BotSkill = "easy" | "normal" | "hard";

const SKILL = {
  easy: { pace: 0.78, cornering: 0.85, nitroChance: 0.1 },
  normal: { pace: 0.88, cornering: 0.95, nitroChance: 0.25 },
  hard: { pace: 0.97, cornering: 1.05, nitroChance: 0.45 },
} as const;

/** Einfacher, aber flüssiger Bot: folgt der Ideallinie mit eigener Spur und bremst vor Kurven. */
export class BotDriver {
  private index = 0;
  private readonly tmp = new THREE.Vector3();
  private lane: number;
  private laneTimer = 0;
  private stuckTime = 0;

  constructor(
    private readonly car: Car,
    private readonly track: SplineTrack,
    readonly skill: BotSkill,
    private readonly rnd: () => number,
  ) {
    this.lane = (rnd() - 0.5) * track.halfWidth * 1.1;
    this.index = track.nearestIndex(car.mesh.position);
  }

  /** Krümmung als Richtungsänderung (rad) über die nächsten `ahead` Stützpunkte. */
  private curvature(from: number, ahead: number): number {
    const a = this.track.sample(from).tangent;
    const b = this.track.sample(from + ahead).tangent;
    return Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  }

  drive(dt: number): ControlState {
    const s = SKILL[this.skill];
    const pos = this.car.mesh.position;
    this.index = this.track.nearestIndex(pos, this.index);
    const speed = this.car.speed;

    // Spur gelegentlich wechseln, damit Bots nicht im Gänsemarsch fahren.
    this.laneTimer -= dt;
    if (this.laneTimer <= 0) {
      this.laneTimer = 3 + this.rnd() * 4;
      this.lane = (this.rnd() - 0.5) * this.track.halfWidth * 1.1;
    }

    const lookahead = Math.round(5 + Math.max(0, speed) * 0.35);
    const target = this.track.sample(this.index + lookahead);
    const curve = this.curvature(this.index, 22);
    const laneHere = this.lane * (1 - Math.min(1, curve * 1.5));
    const aim = this.tmp.copy(target.pos).addScaledVector(target.left, laneHere);

    // Lenkwinkel aus dem Winkel zwischen Fahrtrichtung und Ziel.
    const fwd = this.car.forward(new THREE.Vector3()).setY(0).normalize();
    const toAim = aim.sub(pos).setY(0).normalize();
    const cross = fwd.x * toAim.z - fwd.z * toAim.x;
    const angle = Math.atan2(cross, fwd.dot(toAim));
    // Positiver Winkel = Ziel liegt rechts (rechts ist hier -x bei Blick nach +z).
    const steer = THREE.MathUtils.clamp(angle * 2.4, -1, 1);

    const top = this.car.stats.topSpeed * s.pace;
    const targetSpeed = top * Math.max(0.38, 1 - curve * 0.75 / s.cornering);
    let throttle = speed < targetSpeed ? 1 : 0.25;
    const brake = speed > targetSpeed + 4 ? 1 : 0;
    const straight = curve < 0.08;
    const nitro = straight && this.car.nitro.fraction > 0.5 && this.rnd() < s.nitroChance * dt * 4;

    // Feststecken: kurz zurücksetzen lassen.
    this.stuckTime = speed < 2 ? this.stuckTime + dt : 0;
    const reset = this.stuckTime > 3;
    if (reset) {
      this.stuckTime = 0;
      const back = this.track.sample(this.index - 3);
      this.car.setResetPose(back.pos, Math.atan2(back.tangent.x, back.tangent.z));
      throttle = 1;
    }

    return { throttle: brake ? 0 : throttle, brake, steer, drift: false, nitro, reset };
  }
}
