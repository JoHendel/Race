import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { surfaceGripAt, type TrackDef, type TrackShortcut } from "@apex/shared";
import { Drawbridge } from "./drawbridge";
import { Rockfall } from "./rockfall";
import { LavaFlows } from "./lava";

export const SAMPLE_SPACING = 2; // m between two samples
export const CURB_WIDTH = 1.2;
export const SHOULDER_WIDTH = 3;
export const WALL_COLLIDER_HEIGHT = 6;

export interface TrackSample {
  pos: THREE.Vector3;
  tangent: THREE.Vector3;
  left: THREE.Vector3; // points left, horizontal
}

/** Sampled centre line of a shortcut. `frac` is the lap share the sample counts as. */
export interface ShortcutPath {
  def: TrackShortcut;
  samples: (TrackSample & { frac: number })[];
  halfWidth: number;
  /** Closed shortcuts (e.g. blocked by rocks) are ignored by locate() and give no lap credit. */
  open: boolean;
  /** Wall segments of the shortcut that are outside the main track (per side). */
  wallMask: { left: boolean[]; right: boolean[] };
}

/** Where a car is: sample index on the main track, and the shortcut it is in (if any). */
export interface TrackLocation {
  index: number;
  shortcut: ShortcutPath | null;
  /** Position along the shortcut, 0..1 (only when in a shortcut). */
  u: number;
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

  /** Grip factor of the surface at a sample index (1 = asphalt, lower = ice). */
  gripAt(index: number): number {
    const n = this.samples.length;
    return surfaceGripAt(this.def, (((index % n) + n) % n) / n);
  }
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
    this.buildShortcuts();
    this.buildRoadGaps();
    this.buildColliders();
    this.buildEvents();
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

  /** Ribbon along the samples between two lateral offsets. Segments with `mask[i] === false` are left out. */
  ribbon(inner: number, outer: number, yInner = 0, yOuter = 0, mask?: boolean[]): MeshArrays {
    return stripRibbon(this.samples, true, inner, outer, yInner, yOuter, mask);
  }

  /** Vertical wall strip at a lateral offset. Segments with `mask[i] === false` are left out (gaps). */
  wall(offset: number, height: number, mask?: boolean[]): MeshArrays {
    return stripWall(this.samples, true, offset, height, mask);
  }

  /** Wall mask of the main track for one side (1 = left, -1 = right): gaps where a shortcut branches off. */
  wallMask(side: 1 | -1): boolean[] | undefined {
    return side === 1 ? this.mainMask.left : this.mainMask.right;
  }

  readonly shortcuts: ShortcutPath[] = [];
  readonly bridges: Drawbridge[] = [];
  readonly rockfalls: Rockfall[] = [];
  lava: LavaFlows | null = null;

  /** Does the track have dynamic events at all? */
  get hasEvents(): boolean {
    return this.bridges.length + this.rockfalls.length > 0 || this.lava !== null;
  }

  /** Lava drag rate (1/s) at a position on the track. */
  lavaDrag(index: number, lateral: number): number {
    return this.lava ? this.lava.dragAt(index, lateral) : 0;
  }
  /** Road segments that are replaced by moving parts (drawbridges); false = no fixed road there. */
  roadMask?: boolean[];

  private bridgeRange(at: number, span: number): [number, number] {
    const n = this.samples.length;
    const c = Math.round(at * n);
    const half = Math.round(span / 2 / SAMPLE_SPACING);
    return [c - half, c + half];
  }

  private buildRoadGaps(): void {
    const bridges = (this.def.events ?? []).filter((e) => e.kind === "drawbridge");
    if (!bridges.length) return;
    const n = this.samples.length;
    const mask = this.samples.map(() => true);
    for (const e of bridges) {
      const [a, b] = this.bridgeRange(e.at, e.span);
      for (let i = a; i < b; i++) mask[((i % n) + n) % n] = false;
    }
    this.roadMask = mask;
  }

  private buildEvents(): void {
    const n = this.samples.length;
    for (const e of this.def.events ?? []) {
      if (e.kind === "drawbridge") this.bridges.push(new Drawbridge(this.world, e, this.sample(Math.round(e.at * n)), this.wallOffset - 0.15));
      else if (e.kind === "rockfall" && this.shortcuts[e.shortcut]) this.rockfalls.push(new Rockfall(this.world, e, this.shortcuts[e.shortcut]!));
      else if (e.kind === "lava") this.lava = new LavaFlows(e, n, SAMPLE_SPACING);
    }
  }

  /** Advance dynamic events. Returns the events that just started (for banners and sounds). */
  updateEvents(leaderLaps: number, dt: number): (Drawbridge | Rockfall | LavaFlows)[] {
    const started: (Drawbridge | Rockfall | LavaFlows)[] = [];
    for (const b of this.bridges) if (b.update(leaderLaps, dt)) started.push(b);
    for (const r of this.rockfalls) if (r.update(leaderLaps, dt)) started.push(r);
    if (this.lava?.update(leaderLaps, dt)) started.push(this.lava);
    return started;
  }
  private mainMask: { left?: boolean[]; right?: boolean[] } = {};

  private buildShortcuts(): void {
    const n = this.samples.length;
    for (const def of this.def.shortcuts ?? []) {
      const a = this.sample(Math.round(def.from * n));
      const b = this.sample(Math.round(def.to * n));
      const pts = [a.pos.clone()];
      def.via.forEach(([x, z], k) => pts.push(new THREE.Vector3(x, a.pos.y + ((b.pos.y - a.pos.y) * (k + 1)) / (def.via.length + 1), z)));
      pts.push(b.pos.clone());
      const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      const count = Math.max(2, Math.round(curve.getLength() / SAMPLE_SPACING));
      const up = new THREE.Vector3(0, 1, 0);
      const samples: ShortcutPath["samples"] = [];
      for (let k = 0; k <= count; k++) {
        const u = k / count;
        const pos = curve.getPointAt(u);
        // Near the main track follow its height, so there is no ledge at the junctions.
        const mi = this.nearestIndex(pos);
        const m = this.samples[mi]!.pos;
        const d = Math.hypot(pos.x - m.x, pos.z - m.z);
        const w = 1 - smoothstep(this.wallOffset - 2, this.wallOffset + 10, d);
        pos.y += (m.y - pos.y) * w;
        const tangent = curve.getTangentAt(u).normalize();
        const left = new THREE.Vector3().crossVectors(up, tangent).normalize();
        samples.push({ pos, tangent, left, frac: def.from + (def.to - def.from) * u });
      }
      const halfWidth = def.width / 2;
      const outside = (k: number, side: number) => {
        const s = samples[k]!;
        const p = s.pos.clone().addScaledVector(s.left, side * (halfWidth + CURB_WIDTH));
        // walls start a bit inside the shortcut: a funnel at the junction, no wall end in the racing line
        return this.distanceToTrack(p) > this.wallOffset + 4;
      };
      const seg = (side: number) => samples.map((_, k) => k < samples.length - 1 && outside(k, side) && outside(k + 1, side));
      this.shortcuts.push({ def, samples, halfWidth, open: true, wallMask: { left: seg(1), right: seg(-1) } });
    }
    if (!this.shortcuts.length) return;
    // Gaps in the main walls where a shortcut corridor crosses them
    const blocked = (i: number, side: number) => {
      const s = this.samples[i % n]!;
      const p = s.pos.clone().addScaledVector(s.left, side * this.wallOffset);
      // generous gap = funnel into the shortcut, so clipping the wall end is unlikely
      return this.shortcuts.some((c) => nearestDistance(c.samples, p) < c.halfWidth + CURB_WIDTH + 3.5);
    };
    const mask = (side: number) => this.samples.map((_, i) => !blocked(i, side) && !blocked(i + 1, side));
    this.mainMask = { left: mask(1), right: mask(-1) };
  }

  /**
   * Follow a car along the track: nearest main sample (searched near the last index), or the shortcut it is in.
   * Inside a shortcut the index is the main-track sample of the equivalent lap share.
   */
  locate(p: THREE.Vector3 | { x: number; y: number; z: number }, hint: number): TrackLocation {
    const n = this.samples.length;
    let index = this.nearestIndex(p, hint);
    let dMain = Math.hypot(p.x - this.samples[index]!.pos.x, p.z - this.samples[index]!.pos.z);
    if (dMain > this.wallOffset + 1 && this.shortcuts.length) {
      index = this.nearestIndex(p);
      dMain = Math.hypot(p.x - this.samples[index]!.pos.x, p.z - this.samples[index]!.pos.z);
    }
    for (const c of this.shortcuts) {
      if (!c.open) continue;
      let best = 0;
      let bestD = Infinity;
      c.samples.forEach((s, k) => {
        const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      });
      if (bestD < c.halfWidth + CURB_WIDTH + 1 && bestD < dMain) {
        return { index: Math.round(c.samples[best]!.frac * n) % n, shortcut: c, u: best / (c.samples.length - 1) };
      }
    }
    return { index, shortcut: null, u: 0 };
  }

  private trimesh(m: MeshArrays, friction: number): void {
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(m.positions, m.indices).setFriction(friction));
  }

  private buildColliders(): void {
    const hw = this.halfWidth;
    this.trimesh(this.ribbon(hw, -hw, 0, 0, this.roadMask), 1);
    for (const side of [1, -1] as const) {
      this.trimesh(this.ribbon(side * hw, side * this.wallOffset, 0, 0, this.roadMask), 0.6);
      // Wall colliders are higher than the visible wall so nobody flies off.
      this.trimesh(this.wall(side * this.wallOffset, WALL_COLLIDER_HEIGHT, this.wallMask(side)), 0.2);
    }
    for (const c of this.shortcuts) {
      this.trimesh(stripRibbon(c.samples, false, c.halfWidth + CURB_WIDTH, -c.halfWidth - CURB_WIDTH, 0.01, 0.01), 1);
      this.trimesh(stripWall(c.samples, false, c.halfWidth + CURB_WIDTH + 0.5, WALL_COLLIDER_HEIGHT, c.wallMask.left), 0.2);
      this.trimesh(stripWall(c.samples, false, -(c.halfWidth + CURB_WIDTH + 0.5), WALL_COLLIDER_HEIGHT, c.wallMask.right), 0.2);
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

function nearestDistance(samples: TrackSample[], p: THREE.Vector3): number {
  let best = Infinity;
  for (const s of samples) best = Math.min(best, Math.hypot(p.x - s.pos.x, p.z - s.pos.z));
  return best;
}

/** Ribbon between two lateral offsets along a list of samples (closed loop or open path). */
export function stripRibbon(samples: TrackSample[], closed: boolean, inner: number, outer: number, yInner = 0, yOuter = 0, mask?: boolean[]): MeshArrays {
  const n = samples.length;
  const last = closed ? n : n - 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let dist = 0;
  for (let i = 0; i <= last; i++) {
    const s = samples[i % n]!;
    if (i > 0) dist += s.pos.distanceTo(samples[(i - 1) % n]!.pos);
    const a = s.pos.clone().addScaledVector(s.left, inner);
    const b = s.pos.clone().addScaledVector(s.left, outer);
    pos.push(a.x, a.y + yInner, a.z, b.x, b.y + yOuter, b.z);
    uv.push(0, dist / 8, 1, dist / 8);
    if (i < last && (!mask || mask[i % n])) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  return { positions: new Float32Array(pos), uvs: new Float32Array(uv), indices: new Uint32Array(idx) };
}

/** Vertical wall strip at a lateral offset along a list of samples. */
export function stripWall(samples: TrackSample[], closed: boolean, offset: number, height: number, mask?: boolean[]): MeshArrays {
  const n = samples.length;
  const last = closed ? n : n - 1;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= last; i++) {
    const s = samples[i % n]!;
    const p = s.pos.clone().addScaledVector(s.left, offset);
    pos.push(p.x, p.y - 0.5, p.z, p.x, p.y + height, p.z);
    if (i < last && (!mask || mask[i % n])) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  return { positions: new Float32Array(pos), uvs: new Float32Array(0), indices: new Uint32Array(idx) };
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
