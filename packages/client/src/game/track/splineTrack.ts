import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { theme, type TrackDef } from "@apex/shared";
import { CURB_WIDTH, TrackGeometry, mulberry32, type MeshArrays } from "@apex/sim";

export { mulberry32 };

const WALL_HEIGHT = 1.4;

function toGeometry(m: MeshArrays): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(m.positions, 3));
  if (m.uvs.length) geo.setAttribute("uv", new THREE.BufferAttribute(m.uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(m.indices, 1));
  geo.computeVertexNormals();
  return geo;
}

/** Track with visuals: geometry and collision come from @apex/sim, this class adds the look. */
export class SplineTrack extends TrackGeometry {
  readonly group = new THREE.Group();

  constructor(world: RAPIER.World, def: TrackDef) {
    super(world, def);
    this.buildRoad();
    this.buildCurbs();
    this.buildWalls();
    this.buildStartLine();
    this.buildScenery();
  }

  private buildRoad(): void {
    const hw = this.halfWidth;
    const geo = toGeometry(this.ribbon(hw, -hw));
    const tex = this.asphaltTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.15, envMapIntensity: 0.12, side: THREE.DoubleSide });
    this.group.add(new THREE.Mesh(geo, mat));
    // Seitenstreifen (befahrbar, aber langsamer gibt es erst mit Untergrund-Typen in M6)
    for (const side of [1, -1]) {
      const shoulder = toGeometry(this.ribbon(side * hw, side * this.wallOffset));
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
      this.group.add(new THREE.Mesh(toGeometry(this.ribbon(side * hw, side * (hw + CURB_WIDTH), 0.02, 0.06)), mat));
    }
  }

  private buildWalls(): void {
    const off = this.halfWidth + CURB_WIDTH + 3;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c0d1c, roughness: 0.7, envMapIntensity: 0.1, side: THREE.DoubleSide });
    for (const [side, color] of [
      [1, this.def.accent],
      [-1, this.def.accent2],
    ] as const) {
      const geo = toGeometry(this.wall(side * off, WALL_HEIGHT));
      this.group.add(new THREE.Mesh(geo, wallMat));
      // Kollision höher als sichtbar, damit niemand rausfliegt.
      const glow = toGeometry(this.ribbon(side * off, side * (off + 0.05), WALL_HEIGHT, WALL_HEIGHT + 0.12));
      this.group.add(new THREE.Mesh(glow, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })));
    }
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
}
