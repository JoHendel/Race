import * as THREE from "three";
import { theme } from "@apex/shared";

const MAX = 600;
const LEVEL_COLORS = [theme.white, theme.cyan, theme.orange, theme.violet];

/** Funken-Partikel für Drift und Boost. Ein einziges Points-Objekt, kein GC pro Frame. */
export class Sparks {
  readonly points: THREE.Points;
  private readonly positions = new Float32Array(MAX * 3);
  private readonly colors = new Float32Array(MAX * 3);
  private readonly velocities = new Float32Array(MAX * 3);
  private readonly life = new Float32Array(MAX);
  private next = 0;
  private readonly color = new THREE.Color();

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  emit(origin: THREE.Vector3, level: number, count: number, spread = 3): void {
    this.color.setHex(LEVEL_COLORS[Math.min(level, 3)]!);
    for (let n = 0; n < count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      this.positions.set([origin.x, origin.y, origin.z], i * 3);
      this.velocities.set(
        [(Math.random() - 0.5) * spread, Math.random() * spread * 0.8, (Math.random() - 0.5) * spread],
        i * 3,
      );
      this.colors.set([this.color.r, this.color.g, this.color.b], i * 3);
      this.life[i] = 0.35 + Math.random() * 0.3;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i]! <= 0) continue;
      this.life[i]! -= dt;
      const k = i * 3;
      this.velocities[k + 1]! -= 9 * dt;
      this.positions[k]! += this.velocities[k]! * dt;
      this.positions[k + 1]! += this.velocities[k + 1]! * dt;
      this.positions[k + 2]! += this.velocities[k + 2]! * dt;
      if (this.life[i]! <= 0) this.positions[k + 1] = -1000;
    }
    this.points.geometry.attributes.position!.needsUpdate = true;
    this.points.geometry.attributes.color!.needsUpdate = true;
  }
}
