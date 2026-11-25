import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { theme, type TrackDef } from "@apex/shared";

const SAMPLE_SPACING = 2; // m zwischen zwei Stützpunkten
const WALL_HEIGHT = 1.4;
const CURB_WIDTH = 1.2;

export interface TrackSample {
  pos: THREE.Vector3;
  tangent: THREE.Vector3;
  left: THREE.Vector3; // zeigt nach links, waagrecht
}

/** Baut aus einer Streckendefinition Fahrbahn, Randsteine, Mauern, Kollision und Hilfsdaten. */
export class SplineTrack {
  readonly group = new THREE.Group();
  readonly curve: THREE.CatmullRomCurve3;
  readonly samples: TrackSample[] = [];
  readonly length: number;
  readonly halfWidth: number;

  constructor(
    private readonly world: RAPIER.World,
    readonly def: TrackDef,
  ) {
    this.halfWidth = def.width / 2;
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
    this.buildRoad();
    this.buildCurbs();
    this.buildWalls();
    this.buildStartLine();
    this.buildScenery();
  }

  /** Zusätzliche Höhe durch Rampen: steigt an und bricht dann ab (Sprungkante). */
  private rampOffset(u: number): number {
    for (const r of this.def.ramps) {
      const len = r.length / this.length;
      const d = u - (r.at - len);
      if (d >= 0 && d <= len) return (d / len) * r.height;
    }
    return 0;
  }

  /** Ribbon-Geometrie entlang der Stützpunkte zwischen zwei seitlichen Abständen. */
  private ribbon(inner: number, outer: number, yInner = 0, yOuter = 0): THREE.BufferGeometry {
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
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  private addTrimesh(geo: THREE.BufferGeometry, friction = 1): void {
    const vertices = new Float32Array(geo.attributes.position!.array);
    const indices = new Uint32Array(geo.index!.array);
    this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices).setFriction(friction));
  }

  private buildRoad(): void {
    const hw = this.halfWidth;
    const geo = this.ribbon(hw, -hw);
    const tex = this.asphaltTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.15, envMapIntensity: 0.12, side: THREE.DoubleSide });
    this.group.add(new THREE.Mesh(geo, mat));
    this.addTrimesh(geo);
    // Seitenstreifen (befahrbar, aber langsamer gibt es erst mit Untergrund-Typen in M6)
    for (const side of [1, -1]) {
      const shoulder = this.ribbon(side * hw, side * (hw + CURB_WIDTH + 3));
      this.addTrimesh(shoulder, 0.6);
      this.group.add(new THREE.Mesh(shoulder, new THREE.MeshStandardMaterial({ color: 0x07080f, roughness: 0.95, envMapIntensity: 0.05, side: THREE.DoubleSide })));
    }
  }

  private asphaltTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0e1020";
    g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 900; i++) {
      const v = 14 + Math.random() * 22;
      g.fillStyle = `rgb(${v},${v},${v + 15})`;
      g.fillRect(Math.random() * 64, Math.random() * 256, 1, 1);
    }
    // Mittellinie, gestrichelt
    g.fillStyle = "#ff8a1f";
    g.fillRect(30.5, 0, 3, 110);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  private buildCurbs(): void {
    const hw = this.halfWidth;
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 64;
    const g = c.getContext("2d")!;
    g.fillStyle = `#${this.def.accent.toString(16).padStart(6, "0")}`;
    g.fillRect(0, 0, 8, 32);
    g.fillStyle = "#59607e";
    g.fillRect(0, 32, 8, 32);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.18, side: THREE.DoubleSide, envMapIntensity: 0.1 });
    for (const side of [1, -1]) {
      this.group.add(new THREE.Mesh(this.ribbon(side * hw, side * (hw + CURB_WIDTH), 0.02, 0.06), mat));
    }
  }

  private buildWalls(): void {
    const off = this.halfWidth + CURB_WIDTH + 3;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c0d1c, roughness: 0.7, envMapIntensity: 0.1, side: THREE.DoubleSide });
    for (const [side, color] of [
      [1, this.def.accent],
      [-1, this.def.accent2],
    ] as const) {
      const geo = this.wallGeometry(side * off, WALL_HEIGHT);
      this.group.add(new THREE.Mesh(geo, wallMat));
      // Kollision höher als sichtbar, damit niemand rausfliegt.
      this.addTrimesh(this.wallGeometry(side * off, 6), 0.2);
      const glow = this.ribbon(side * off, side * (off + 0.05), WALL_HEIGHT, WALL_HEIGHT + 0.12);
      this.group.add(new THREE.Mesh(glow, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })));
    }
  }

  private wallGeometry(offset: number, height: number): THREE.BufferGeometry {
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
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  private buildStartLine(): void {
    const s = this.samples[0]!;
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 16;
    const g = c.getContext("2d")!;
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 4; y++) {
        g.fillStyle = (x + y) % 2 ? "#f4f6ff" : "#05060f";
        g.fillRect(x * 4, y * 4, 4, 4);
      }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(this.def.width, 2.5), new THREE.MeshBasicMaterial({ map: tex }));
    line.position.copy(s.pos).add(new THREE.Vector3(0, 0.03, 0));
    line.lookAt(line.position.clone().add(s.tangent));
    line.rotateX(-Math.PI / 2);
    this.group.add(line);

    // Startportal
    const gate = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x111326 });
    const glow = new THREE.MeshBasicMaterial({ color: theme.magenta });
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), postMat);
      post.position.set(side * (this.halfWidth + 2.5), 4.5, 0);
      gate.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(this.def.width + 5.8, 1.2, 0.8), glow);
    beam.position.y = 9;
    gate.add(beam);
    gate.position.copy(s.pos);
    gate.lookAt(s.pos.clone().add(s.tangent));
    this.group.add(gate);
  }

  private buildScenery(): void {
    // Hafenwasser mit Neon-Gitter
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: 0x02030a, roughness: 0.2, metalness: 0.6, envMapIntensity: 0.15 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -2;
    this.group.add(water);
    const grid = new THREE.GridHelper(2000, 200, theme.violet, theme.grid);
    grid.position.y = -1.95;
    this.group.add(grid);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(1000, 0.5, 1000).setTranslation(0, -2.5, 0));

    // Lagerhallen, Kräne und Neon-Türme am Rand
    const box = new THREE.BoxGeometry(1, 1, 1);
    const dark = new THREE.MeshStandardMaterial({ color: 0x0a0b18, roughness: 0.9, envMapIntensity: 0.08 });
    const colors = [theme.cyan, theme.magenta, theme.orange, theme.violet];
    const rnd = mulberry32(7);
    for (let i = 0; i < this.samples.length; i += 9) {
      const s = this.samples[i]!;
      for (const side of [1, -1]) {
        if (rnd() < 0.35) continue;
        const dist = this.halfWidth + 14 + rnd() * 40;
        const h = 6 + rnd() * 30;
        const w = 8 + rnd() * 14;
        const p = s.pos.clone().addScaledVector(s.left, side * dist);
        if (this.distanceToTrack(p) < this.halfWidth + 10) continue;
        const b = new THREE.Mesh(box, dark);
        b.scale.set(w, h, w);
        b.position.set(p.x, -2 + h / 2, p.z);
        b.rotation.y = rnd() * Math.PI;
        this.group.add(b);
        const stripe = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: colors[Math.floor(rnd() * 4)] }));
        stripe.scale.set(w + 0.1, 0.3, w + 0.1);
        stripe.position.set(p.x, -2 + h * (0.4 + rnd() * 0.55), p.z);
        stripe.rotation.y = b.rotation.y;
        this.group.add(stripe);
      }
    }
  }

  /** Index des nächstgelegenen Stützpunkts, optional nur in der Nähe eines bekannten Index gesucht. */
  nearestIndex(p: THREE.Vector3, hint?: number, window = 40): number {
    const n = this.samples.length;
    let best = 0;
    let bestD = Infinity;
    if (hint === undefined) {
      for (let i = 0; i < n; i++) {
        const d = this.samples[i]!.pos.distanceToSquared(p);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    }
    for (let k = -window; k <= window; k++) {
      const i = (((hint + k) % n) + n) % n;
      const d = this.samples[i]!.pos.distanceToSquared(p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  distanceToTrack(p: THREE.Vector3): number {
    const s = this.samples[this.nearestIndex(p)]!;
    return Math.hypot(p.x - s.pos.x, p.z - s.pos.z);
  }

  sample(i: number): TrackSample {
    const n = this.samples.length;
    return this.samples[((Math.round(i) % n) + n) % n]!;
  }

  /** Startaufstellung: 2er-Reihen versetzt hinter der Linie. */
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

/** Kleiner deterministischer Zufallsgenerator, damit die Kulisse immer gleich aussieht. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
