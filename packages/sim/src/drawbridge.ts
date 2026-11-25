import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { drawbridgeAngle, type DrawbridgeEvent } from "@apex/shared";
import type { TrackSample } from "./track";

export const LEAF_THICKNESS = 0.5;

/** One leaf of a drawbridge: pivots at its outer end, the tip points to the bridge centre. */
export interface BridgeLeaf {
  body: RAPIER.RigidBody;
  pivot: THREE.Vector3;
  /** +1: leaf extends forward from its pivot, -1: backward. */
  dir: 1 | -1;
  length: number;
  halfWidth: number;
}

/**
 * A drawbridge on the track. Its two leaves are kinematic bodies, so cars drive on them like on the road,
 * and they rise once the leader reaches the opening lap.
 */
export class Drawbridge {
  readonly leaves: BridgeLeaf[] = [];
  angle = 0;
  private openSince: number | null = null;
  private readonly yaw: number;

  constructor(
    world: RAPIER.World,
    readonly event: DrawbridgeEvent,
    centre: TrackSample,
    halfWidth: number,
  ) {
    this.yaw = Math.atan2(centre.tangent.x, centre.tangent.z);
    const length = event.span / 2;
    for (const dir of [1, -1] as const) {
      const pivot = centre.pos.clone().addScaledVector(centre.tangent, -dir * length);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pivot.x, pivot.y, pivot.z));
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(halfWidth, LEAF_THICKNESS / 2, length / 2)
          .setTranslation(0, -LEAF_THICKNESS / 2, (dir * length) / 2)
          .setFriction(1),
        body,
      );
      this.leaves.push({ body, pivot, dir, length, halfWidth });
    }
    this.apply();
  }

  /** Is the bridge (partly) raised? */
  get open(): boolean {
    return this.openSince !== null;
  }

  /** Advance the bridge: `leaderLaps` = laps completed by the race leader. Returns true when it starts to open. */
  update(leaderLaps: number, dt: number): boolean {
    let started = false;
    if (this.openSince === null && leaderLaps + 1 >= this.event.fromLap) {
      this.openSince = 0;
      started = true;
    }
    if (this.openSince !== null) this.openSince += dt;
    // Once open, a bridge stays open; the angle only depends on how long it has been rising.
    const angle = this.openSince === null ? 0 : drawbridgeAngle(this.event, this.event.fromLap - 1, this.openSince);
    if (angle !== this.angle) {
      this.angle = angle;
      this.apply();
    }
    return started;
  }

  /** Rotation of a leaf: heading of the track, then tilted so its tip rises. */
  leafRotation(leaf: BridgeLeaf, target = new THREE.Quaternion()): THREE.Quaternion {
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -leaf.dir * this.angle);
    return target.copy(yaw).multiply(pitch);
  }

  private apply(): void {
    const q = new THREE.Quaternion();
    for (const leaf of this.leaves) {
      this.leafRotation(leaf, q);
      leaf.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      leaf.body.setNextKinematicTranslation(leaf.pivot);
      // Also set the pose directly so it is correct before the next world step (e.g. at the start).
      leaf.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, false);
    }
  }
}
