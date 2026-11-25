import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { TrackDef } from "@apex/shared";

export const SAMPLE_SPACING = 2; // m between two samples
export const CURB_WIDTH = 1.2;
export const SHOULDER_WIDTH = 3;
export const WALL_COLLIDER_HEIGHT = 6;

export interface TrackSample {
  pos: THREE.Vector3;
  tangent: THREE.Vector3;
  left: THREE.Vector3; // points left, horizontal
}

export interface MeshArrays {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/**
 * Track geometry and collision without any graphics.
 * Used by the game (which adds visuals on top) and by the headless AI simulation.
 */
export class TrackGeometry {
  readonly curve: THREE.CatmullRomCurve3;
  readonly samples: TrackSample[] = [];
  readonly length: number;
  readonly halfWidth: number;
  /** Lateral distance from the centre line to the walls. */
  readonly wallOffset: number;

  constructor(
    protected readonly world: RAPIER.World,
    readonly def: TrackDef,
  ) {
    this.halfWidth = def.width / 2;
    this.wallOffset = this.halfWidth + CURB_WIDTH + SHOULDER_WIDTH;
    this.curve = new THREE.CatmullRomCurve3(
      def.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      true,
      "centripetal",
    );
    this.length = this.curve.getLength();
    const n = Math.round(this.length / SAMPLE_SPACING);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const pos = this.curve.getPointAt(u);
      pos.y += this.rampOffset(u);
      const tangent = this.curve.getTangentAt(u).normalize();
      const left = new THREE.Vector3().crossVectors(up, tangent).normalize();
      this.samples.push({ pos, tangent, left });
    }
    this.buildColliders();
  }

  /** Extra height from ramps: rises and then drops (jump edge). */
  private rampOffset(u: number): number {
    for (const r of this.def.ramps) {
      const len = r.length / this.length;
      const d = u - (r.at - len);
      if (d >= 0 && d <= len) return (d / len) * r.height;
    }
    return 0;
  }

  /** Ribbon along the samples between two lateral offsets. */
  ribbon(inner: number, outer: number, yInner = 0, yOuter = 0): MeshArrays {
    const n = this.samples.length;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let dist = 0;
    for (let i = 0; i <= n; i++) {
      const s = this.samples[i % n]!;
      if (i > 0) dist += s.pos.distanceTo(this.samples[(i - 1) % n]!.pos);
      const a = s.pos.clone().addScaledVector(s.left, inner);
      const b = s.pos.clone().addScaledVector(s.left, outer);
      pos.push(a.x, a.y + yInner, a.z, b.x, b.y + yOuter, b.z);
      uv.push(0, dist / 8, 1, dist / 8);
      if (i < n) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    return { positions: new Float32Array(pos), uvs: new Float32Array(uv), indices: new Uint32Array(idx) };
  }

  /** Vertical wall strip at a lateral offset. */
  wall(offset: number, height: number): MeshArrays {
    const n = this.samples.length;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const s = this.samples[i % n]!;
      const p = s.pos.clone().addScaledVector(s.left, offset);
      pos.push(p.x, p.y - 0.5, p.z, p.x, p.y + height, p.z);
      if (i < n) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    return { positions: new Float32Array(pos), uvs: new Float32Array(0), indices: new Uint32Array(idx) };
  }

  private trimesh(m: MeshArrays, friction: number): void {
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(m.positions, m.indices).setFriction(friction));
  }

  private buildColliders(): void {
    const hw = this.halfWidth;
    this.trimesh(this.ribbon(hw, -hw), 1);
    for (const side of [1, -1]) {
      this.trimesh(this.ribbon(side * hw, side * this.wallOffset), 0.6);
      // Wall colliders are higher than the visible wall so nobody flies off.
      this.trimesh(this.wall(side * this.wallOffset, WALL_COLLIDER_HEIGHT), 0.2);
    }
    // Water / ground far below the track
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(1000, 0.5, 1000).setTranslation(0, -2.5, 0));
  }

  /** Index of the nearest sample, optionally searched only near a known index. */
  nearestIndex(p: { x: number; y: number; z: number }, hint?: number, window = 40): number {
    const n = this.samples.length;
    let best = 0;
    let bestD = Infinity;
    const check = (i: number) => {
      const s = this.samples[i]!.pos;
      const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2 + (s.z - p.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    };
    if (hint === undefined) for (let i = 0; i < n; i++) check(i);
    else for (let k = -window; k <= window; k++) check((((hint + k) % n) + n) % n);
    return best;
  }

  /** Signed lateral offset from the centre line (positive = left). */
  lateralOffset(p: { x: number; z: number }, index: number): number {
    const s = this.sample(index);
    return (p.x - s.pos.x) * s.left.x + (p.z - s.pos.z) * s.left.z;
  }

  distanceToTrack(p: THREE.Vector3): number {
    const s = this.samples[this.nearestIndex(p)]!;
    return Math.hypot(p.x - s.pos.x, p.z - s.pos.z);
  }

  sample(i: number): TrackSample {
    const n = this.samples.length;
    return this.samples[((Math.round(i) % n) + n) % n]!;
  }

  /** Starting grid: staggered pairs behind the line. */
  gridSlot(slot: number): { pos: THREE.Vector3; yaw: number } {
    const row = Math.floor(slot / 2);
    const col = slot % 2;
    const back = 6 + row * 7 + col * 3.5;
    const idx = -Math.round(back / SAMPLE_SPACING);
    const s = this.sample(idx);
    const pos = s.pos.clone().addScaledVector(s.left, col === 0 ? 3.5 : -3.5);
    return { pos, yaw: Math.atan2(s.tangent.x, s.tangent.z) };
  }
}
