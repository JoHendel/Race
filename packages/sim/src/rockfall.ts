import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { ROCKFALL_DURATION, type RockfallEvent } from "@apex/shared";
import type { ShortcutPath } from "./track";

export interface Boulder {
  body: RAPIER.RigidBody;
  radius: number;
  /** Rest position (barrier) or start position high up (falling rock). */
  start: THREE.Vector3;
  /** Where it ends up when the event is over. */
  end: THREE.Vector3;
  /** Falling boulders are only visible during the event. */
  falling: boolean;
}

/**
 * A rock barrier closes a shortcut. Once the leader reaches `fromLap`, two boulders crash down,
 * the barrier rocks tumble aside and sink into the sand, and the shortcut opens.
 */
export class Rockfall {
  readonly boulders: Boulder[] = [];
  /** Seconds since the rockfall started, or null while the barrier stands. */
  elapsed: number | null = null;

  constructor(
    private readonly world: RAPIER.World,
    readonly event: RockfallEvent,
    readonly shortcut: ShortcutPath,
  ) {
    shortcut.open = false;
    // Barrier just behind the point where the shortcut leaves the main track corridor
    const k = Math.min(shortcut.samples.length - 1, Math.max(0, shortcut.wallMask.left.indexOf(true)) + 3);
    const s = shortcut.samples[k]!;
    const span = shortcut.halfWidth + 1.2;
    const count = 3;
    for (let i = 0; i < count; i++) {
      const lateral = -span + ((i + 0.5) * 2 * span) / count;
      const radius = 2.3 + (i % 2) * 0.4;
      const start = s.pos.clone().addScaledVector(s.left, lateral).add(new THREE.Vector3(0, radius * 0.7, 0));
      const away = s.left.clone().multiplyScalar(Math.sign(lateral || 1) * (span + 4));
      const end = start.clone().add(away).add(new THREE.Vector3(0, -radius * 1.6, 0)).addScaledVector(s.tangent, 3);
      this.boulders.push({ body: this.ball(start, radius), radius, start, end, falling: false });
    }
    for (let i = 0; i < 2; i++) {
      const radius = 1.8;
      const end = s.pos.clone().addScaledVector(s.left, (i ? 1 : -1) * 2).add(new THREE.Vector3(0, -radius * 2.2, 0)).addScaledVector(s.tangent, 1.5);
      const start = end.clone().add(new THREE.Vector3(0, 32, 0)).addScaledVector(s.left, (i ? 1 : -1) * 10);
      // falling rocks have no collider (pure effect) – parked far below until needed
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, -50, start.z));
      this.boulders.push({ body, radius, start, end, falling: true });
    }
  }

  private ball(p: THREE.Vector3, r: number): RAPIER.RigidBody {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z));
    this.world.createCollider(RAPIER.ColliderDesc.ball(r).setFriction(0.8), body);
    return body;
  }

  get open(): boolean {
    return this.shortcut.open;
  }

  /** Visual progress of a boulder for rendering. Returns null when it should be hidden. */
  pose(b: Boulder): { pos: THREE.Vector3; spin: number } | null {
    const t = this.elapsed;
    if (b.falling) {
      if (t === null || t > ROCKFALL_DURATION) return null;
      const f = Math.min(1, t / 1.1);
      return { pos: b.start.clone().lerp(b.end, f * f), spin: t * 4 };
    }
    if (t === null) return { pos: b.start, spin: 0 };
    const f = Math.min(1, Math.max(0, (t - 1) / (ROCKFALL_DURATION - 1)));
    const e = f * f * (3 - 2 * f);
    return { pos: b.start.clone().lerp(b.end, e), spin: e * 3 };
  }

  /** Returns true when the rockfall starts. */
  update(leaderLaps: number, dt: number): boolean {
    let started = false;
    if (this.elapsed === null) {
      if (leaderLaps + 1 < this.event.fromLap) return false;
      this.elapsed = 0;
      started = true;
    } else this.elapsed += dt;
    for (const b of this.boulders) {
      const p = this.pose(b);
      if (!b.falling && p) b.body.setNextKinematicTranslation(p.pos);
    }
    if (!this.shortcut.open && this.elapsed >= ROCKFALL_DURATION) {
      this.shortcut.open = true;
      // the barrier is gone: remove its colliders
      for (const b of this.boulders) if (!b.falling) for (let i = b.body.numColliders() - 1; i >= 0; i--) this.world.removeCollider(b.body.collider(i), false);
    }
    return started;
  }
}
