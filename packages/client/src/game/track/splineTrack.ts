import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { DEFAULT_ENVIRONMENT, theme, type TrackDef } from "@apex/shared";
import { CURB_WIDTH, LEAF_THICKNESS, TrackGeometry, mulberry32, stripRibbon, stripWall, type Drawbridge, type MeshArrays, type Rockfall, type ShortcutPath } from "@apex/sim";

import { buildJungle, buildTemple } from "./jungle";
import { buildLavaTube, buildVolcano } from "./volcano";
import { buildGlassTube, buildOrbital } from "./orbital";
import { buildCircuit, buildCity, buildDesert } from "./scenery";

export { mulberry32, toGeometry };

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
    this.buildSurfaces();
    for (const c of this.shortcuts) this.buildShortcut(c);
    for (const b of this.bridges) this.buildBridge(b);
    for (const r of this.rockfalls) this.buildRockfall(r);
    const scenery = (this.def.environment ?? DEFAULT_ENVIRONMENT).scenery;
    if (scenery === "glacier") this.buildGlacier();
    else if (scenery === "jungle") buildJungle(this);
    else if (scenery === "volcano") buildVolcano(this);
    else if (scenery === "orbital") buildOrbital(this);
    else if (scenery === "desert") buildDesert(this);
    else if (scenery === "city") buildCity(this);
    else if (scenery === "circuit") buildCircuit(this);
    else this.buildScenery();
  }

  /** Per-frame animations of the scenery (e.g. the waterfall). */
  readonly animators: ((dt: number) => void)[] = [];

  /** Is a lap share inside the rope bridge section of this track? */
  inRopeBridge(i: number): boolean {
    const rb = this.def.environment?.ropeBridge;
    if (!rb) return false;
    const n = this.samples.length;
    const t = (((i % n) + n) % n) / n;
    return t >= rb[0] && t < rb[1];
  }

  private readonly bridgeVisuals: { bridge: Drawbridge; leaves: THREE.Object3D[]; lights: THREE.MeshBasicMaterial[] }[] = [];
  private blink = 0;

  /** Drawbridge: two leaves (follow the physics bodies), towers with counterweights and warning lights. */
  private buildBridge(b: Drawbridge): void {
    const deckTex = this.asphaltTexture();
    const deck = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.75, metalness: 0.2, envMapIntensity: 0.12 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x1b1e36, roughness: 0.6, metalness: 0.5, envMapIntensity: 0.2 });
    const stripe = new THREE.MeshBasicMaterial({ color: theme.orange });
    const leaves: THREE.Object3D[] = [];
    for (const leaf of b.leaves) {
      const g = new THREE.Group();
      const w = leaf.halfWidth * 2;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, LEAF_THICKNESS, leaf.length), [steel, steel, deck, steel, steel, steel]);
      slab.position.set(0, -LEAF_THICKNESS / 2, (leaf.dir * leaf.length) / 2);
      g.add(slab);
      // warning stripes on the tip edge
      const tip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.6), stripe);
      tip.position.set(0, 0.02, leaf.dir * (leaf.length - 0.3));
      g.add(tip);
      // side girders with neon edges
      for (const side of [1, -1]) {
        const girder = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, leaf.length), steel);
        girder.position.set(side * (leaf.halfWidth - 0.2), 0.4, (leaf.dir * leaf.length) / 2);
        g.add(girder);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, leaf.length), stripe);
        edge.position.set(side * (leaf.halfWidth - 0.2), 1.05, (leaf.dir * leaf.length) / 2);
        g.add(edge);
      }
      // hazard chevrons painted on the deck near the tip
      const hazard = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 3), new THREE.MeshBasicMaterial({ map: this.chevronTexture(), transparent: true }));
      hazard.rotation.x = -Math.PI / 2;
      hazard.rotation.z = -Math.PI / 2; // chevrons point in driving direction on both leaves
      hazard.position.set(0, 0.03, leaf.dir * (leaf.length - 2.5));
      g.add(hazard);
      this.group.add(g);
      leaves.push(g);
    }
    // Towers at the pivots with blinking warning lights
    const lights: THREE.MeshBasicMaterial[] = [];
    const tower = new THREE.BoxGeometry(1.6, 12, 1.6);
    for (const leaf of b.leaves) {
      const q = b.leafRotation(leaf);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q).setY(0).normalize();
      for (const side of [1, -1]) {
        const base = leaf.pivot.clone().addScaledVector(right, side * (leaf.halfWidth + 1.6));
        const t = new THREE.Mesh(tower, steel);
        t.position.copy(base).add(new THREE.Vector3(0, 6 - 2, 0));
        this.group.add(t);
        for (const y of [3, 6.5]) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 1.7), stripe);
          band.position.copy(base).add(new THREE.Vector3(0, y, 0));
          this.group.add(band);
        }
        const lightMat = new THREE.MeshBasicMaterial({ color: 0x331100 });
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), lightMat);
        lamp.position.copy(base).add(new THREE.Vector3(0, 10.4, 0));
        this.group.add(lamp);
        lights.push(lightMat);
      }
    }
    this.bridgeVisuals.push({ bridge: b, leaves, lights });
    this.syncBridges(0);
  }

  /** Canyon shortcut: tall sandstone cliffs on both sides with loose rocks on top. */
  private buildCanyon(c: ShortcutPath, off: number): void {
    const rock = new THREE.MeshStandardMaterial({ color: 0x8a4b2a, roughness: 0.95, envMapIntensity: 0.15, side: THREE.DoubleSide });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3d2216, roughness: 1, envMapIntensity: 0.1 });
    const k0 = Math.floor(c.samples.length * 0.12);
    const k1 = Math.ceil(c.samples.length * 0.88);
    const part = c.samples.slice(k0, k1 + 1);
    for (const side of [1, -1]) {
      this.group.add(new THREE.Mesh(toGeometry(stripWall(part, false, side * (off + 0.4), 16)), rock));
      this.group.add(new THREE.Mesh(toGeometry(stripRibbon(part, false, side * (off + 0.4), side * (off + 9), 16, 18)), rock));
    }
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const rnd = mulberry32(57);
    for (let k = 0; k < part.length; k += 3) {
      const s = part[k]!;
      for (const side of [1, -1]) {
        if (rnd() < 0.4) continue;
        const r = 1.5 + rnd() * 3;
        const m = new THREE.Mesh(geo, dark);
        m.scale.set(r, r * 0.8, r);
        m.position.copy(s.pos).addScaledVector(s.left, side * (off + 2 + rnd() * 6)).add(new THREE.Vector3(0, 16.5 + r * 0.3, 0));
        m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        this.group.add(m);
      }
    }
  }

  private readonly rockVisuals: { rockfall: Rockfall; meshes: THREE.Mesh[]; dust: THREE.Mesh }[] = [];

  /** Rock barrier and falling boulders of a rockfall event. */
  private buildRockfall(r: Rockfall): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x6e3a20, roughness: 0.95, envMapIntensity: 0.15 });
    const temple = r.shortcut.def.kind === "temple";
    if (temple) mat.color.setHex(0x7d7a68);
    const meshes = r.boulders.map((b) => {
      // temple: collapsed stone blocks instead of round boulders
      const geo = temple ? new THREE.BoxGeometry(b.radius * 1.5, b.radius * 1.2, b.radius * 1.5) : new THREE.DodecahedronGeometry(b.radius, 1);
      const m = new THREE.Mesh(geo, mat);
      this.group.add(m);
      return m;
    });
    const dust = new THREE.Mesh(
      new THREE.SphereGeometry(1, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xd9a066, transparent: true, opacity: 0, depthWrite: false }),
    );
    dust.position.copy(r.boulders[0]!.start);
    this.group.add(dust);
    this.rockVisuals.push({ rockfall: r, meshes, dust });
  }

  /** Move the bridge meshes to the physics pose; blink the warning lights while a bridge is open. */
  syncBridges(dt: number): void {
    for (const a of this.animators) a(dt);
    for (const v of this.rockVisuals) {
      v.rockfall.boulders.forEach((b, i) => {
        const m = v.meshes[i]!;
        const pose = v.rockfall.pose(b);
        m.visible = pose !== null;
        if (pose) {
          m.position.copy(pose.pos);
          m.rotation.set(pose.spin, pose.spin * 0.7, 0);
        }
      });
      // A dust cloud grows and fades while the barrier collapses
      const t = v.rockfall.elapsed;
      const mat = v.dust.material as THREE.MeshBasicMaterial;
      if (t === null || t > 4) mat.opacity = 0;
      else {
        const f = Math.min(1, t / 4);
        v.dust.scale.setScalar(3 + f * 14);
        mat.opacity = t < 1 ? 0 : 0.55 * (1 - f);
      }
    }
    this.blink += dt;
    for (const v of this.bridgeVisuals) {
      v.bridge.leaves.forEach((leaf, i) => {
        const g = v.leaves[i]!;
        g.position.copy(leaf.pivot);
        v.bridge.leafRotation(leaf, g.quaternion);
      });
      const on = v.bridge.open && Math.floor(this.blink * 2.5) % 2 === 0;
      for (const m of v.lights) m.color.setHex(on ? 0xff3b1f : 0x331100);
    }
  }

  nearShortcut(p: THREE.Vector3, margin: number): boolean {
    return this.shortcuts.some((c) => c.samples.some((s) => Math.hypot(s.pos.x - p.x, s.pos.z - p.z) < c.halfWidth + margin));
  }

  /** Shortcut: road, curbs, walls with neon trim and a warehouse over the middle part. */
  private buildShortcut(c: ShortcutPath): void {
    const hw = c.halfWidth;
    const road = new THREE.MeshStandardMaterial({ map: this.asphaltTexture(), roughness: 0.8, metalness: 0.1, envMapIntensity: 0.1, side: THREE.DoubleSide });
    const roadMesh = new THREE.Mesh(toGeometry(stripRibbon(c.samples, false, hw, -hw, 0.02, 0.02)), road);
    roadMesh.renderOrder = 1;
    this.group.add(roadMesh);
    const curb = new THREE.MeshStandardMaterial({ color: theme.orange, emissive: theme.orange, emissiveIntensity: 0.25, side: THREE.DoubleSide });
    for (const side of [1, -1]) this.group.add(new THREE.Mesh(toGeometry(stripRibbon(c.samples, false, side * hw, side * (hw + CURB_WIDTH), 0.04, 0.06)), curb));
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0c0d1c, roughness: 0.7, envMapIntensity: 0.1, side: THREE.DoubleSide });
    const trim = new THREE.MeshBasicMaterial({ color: theme.orange, side: THREE.DoubleSide });
    const off = hw + CURB_WIDTH + 0.5;
    for (const [side, mask] of [
      [1, c.wallMask.left],
      [-1, c.wallMask.right],
    ] as const) {
      this.group.add(new THREE.Mesh(toGeometry(stripWall(c.samples, false, side * off, WALL_HEIGHT, mask)), wallMat));
      this.group.add(new THREE.Mesh(toGeometry(stripRibbon(c.samples, false, side * off, side * (off + 0.05), WALL_HEIGHT, WALL_HEIGHT + 0.12, mask)), trim));
    }

    if (c.def.kind === "canyon") {
      this.buildCanyon(c, off);
      return;
    }
    if (c.def.kind === "temple") {
      buildTemple(this, c, off);
      return;
    }
    if (c.def.kind === "lavatube") {
      buildLavaTube(this, c, off);
      return;
    }
    if (c.def.kind === "glasstube") {
      buildGlassTube(this, c, off);
      return;
    }

    // Warehouse over the middle 60 % of the shortcut
    const k0 = Math.floor(c.samples.length * 0.2);
    const k1 = Math.ceil(c.samples.length * 0.8);
    const hall = c.samples.slice(k0, k1 + 1);
    const H = 8;
    const shell = new THREE.MeshStandardMaterial({ color: 0x15172b, roughness: 0.85, metalness: 0.2, envMapIntensity: 0.1, side: THREE.DoubleSide });
    for (const side of [1, -1]) this.group.add(new THREE.Mesh(toGeometry(stripWall(hall, false, side * (off + 0.3), H)), shell));
    this.group.add(new THREE.Mesh(toGeometry(stripRibbon(hall, false, off + 0.3, -(off + 0.3), H, H)), shell));
    // Ceiling lights and a neon stripe along the hall
    const lamp = new THREE.MeshBasicMaterial({ color: 0xfff1c9 });
    const lampGeo = new THREE.BoxGeometry(hw * 1.2, 0.15, 0.6);
    for (let k = 0; k < hall.length; k += 5) {
      const s = hall[k]!;
      const m = new THREE.Mesh(lampGeo, lamp);
      m.position.copy(s.pos).add(new THREE.Vector3(0, H - 0.3, 0));
      m.lookAt(m.position.clone().add(s.tangent));
      this.group.add(m);
    }
    for (const side of [1, -1]) this.group.add(new THREE.Mesh(toGeometry(stripRibbon(hall, false, side * (off + 0.25), side * (off + 0.25), 3.2, 3.6)), new THREE.MeshBasicMaterial({ color: theme.magenta, side: THREE.DoubleSide })));
    // Crates along the inner walls
    const crate = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.9, envMapIntensity: 0.1 });
    const rnd = mulberry32(41);
    for (let k = 3; k < hall.length - 3; k += 4) {
      const s = hall[k]!;
      const side = rnd() < 0.5 ? 1 : -1;
      const size = 1.2 + rnd() * 0.8;
      const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crate);
      m.position.copy(s.pos).addScaledVector(s.left, side * (off - 0.4 - size / 2 + 0.2)).add(new THREE.Vector3(0, size / 2, 0));
      if (Math.abs(side * (off - 0.4 - size / 2)) < hw + CURB_WIDTH) continue;
      m.rotation.y = rnd() * Math.PI;
      this.group.add(m);
    }
    // Glowing chevron sign above the entry so the shortcut is easy to spot
    const entry = c.samples[Math.min(c.samples.length - 1, k0)]!;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(hw * 1.6, 1.4), new THREE.MeshBasicMaterial({ map: this.chevronTexture(), transparent: true, side: THREE.DoubleSide }));
    sign.position.copy(entry.pos).add(new THREE.Vector3(0, H + 1.4, 0));
    sign.lookAt(sign.position.clone().sub(entry.tangent));
    this.group.add(sign);
  }

  private chevronTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 56;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(5,6,15,0.85)";
    g.fillRect(0, 0, 256, 56);
    g.strokeStyle = "#ff8a1f";
    g.lineWidth = 9;
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 48;
      g.beginPath();
      g.moveTo(x, 10);
      g.lineTo(x + 18, 28);
      g.lineTo(x, 46);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Ribbon over part of the lap (sample indices a..b, wrapping around the start). */
  partialRibbon(a: number, b: number, inner: number, outer: number, y: number): THREE.BufferGeometry {
    const n = this.samples.length;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const count = ((b - a + n) % n) + 1;
    for (let k = 0; k < count; k++) {
      const s = this.samples[(a + k) % n]!;
      const p = s.pos.clone().addScaledVector(s.left, inner);
      const q = s.pos.clone().addScaledVector(s.left, outer);
      pos.push(p.x, p.y + y, p.z, q.x, q.y + y, q.z);
      uv.push(0, k / 6, 1, k / 6);
      if (k > 0) {
        const i = (k - 1) * 2;
        idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /** Ice zones: glossy, cracked surface and glowing edges so the low grip is visible in advance. */
  private buildSurfaces(): void {
    if (!this.def.surfaces?.length) return;
    const n = this.samples.length;
    const tex = this.iceTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: 0x7fb6cc,
      roughness: 0.1,
      metalness: 0.45,
      envMapIntensity: 0.6,
      emissive: 0x08304a,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const edge = new THREE.MeshBasicMaterial({ color: 0x9ff4ff, side: THREE.DoubleSide });
    const hw = this.halfWidth;
    for (const z of this.def.surfaces) {
      const a = Math.floor(z.from * n);
      const b = Math.floor(z.to * n) % n;
      const ice = new THREE.Mesh(this.partialRibbon(a, b, hw, -hw, 0.03), mat);
      ice.renderOrder = 1;
      this.group.add(ice);
      for (const side of [1, -1]) this.group.add(new THREE.Mesh(this.partialRibbon(a, b, side * (hw + CURB_WIDTH), side * (hw + CURB_WIDTH + 0.25), 0.08), edge));
    }
  }

  private iceTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#d8f6ff";
    g.fillRect(0, 0, 128, 128);
    const rnd = mulberry32(11);
    g.strokeStyle = "rgba(90,170,210,0.55)";
    g.lineWidth = 1;
    for (let i = 0; i < 22; i++) {
      let x = rnd() * 128;
      let y = rnd() * 128;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        x += (rnd() - 0.5) * 40;
        y += (rnd() - 0.5) * 40;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Glacier scenery: snow field, ice spires and an ice cave over the track. */
  private buildGlacier(): void {
    const snow = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: 0x5d7690, roughness: 0.95, envMapIntensity: 0.15 }),
    );
    snow.rotation.x = -Math.PI / 2;
    snow.position.y = -2;
    this.group.add(snow);

    const rnd = mulberry32(23);
    const cone = new THREE.ConeGeometry(1, 1, 6);
    const iceMat = new THREE.MeshStandardMaterial({ color: 0x6fb8d8, roughness: 0.2, metalness: 0.1, emissive: 0x0b4b6b, emissiveIntensity: 0.3, transparent: true, opacity: 0.9 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x1b2638, roughness: 0.9, envMapIntensity: 0.1 });
    const rock = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < this.samples.length; i += 6) {
      const s = this.samples[i]!;
      for (const side of [1, -1]) {
        if (rnd() < 0.3) continue;
        const dist = this.halfWidth + 12 + rnd() * 45;
        const p = s.pos.clone().addScaledVector(s.left, side * dist);
        if (this.distanceToTrack(p) < this.halfWidth + 9 || this.nearShortcut(p, 12)) continue;
        if (rnd() < 0.6) {
          const h = 8 + rnd() * 34;
          const r = 2 + rnd() * 6;
          const m = new THREE.Mesh(cone, iceMat);
          m.scale.set(r, h, r);
          m.position.set(p.x, -2 + h / 2, p.z);
          m.rotation.set((rnd() - 0.5) * 0.25, rnd() * Math.PI, (rnd() - 0.5) * 0.25);
          this.group.add(m);
        } else {
          const r = 3 + rnd() * 9;
          const m = new THREE.Mesh(rock, rockMat);
          m.scale.set(r, r * (0.5 + rnd() * 0.6), r);
          m.position.set(p.x, -2 + r * 0.25, p.z);
          m.rotation.y = rnd() * Math.PI;
          this.group.add(m);
        }
      }
    }

    // Ice cave: glowing arches over the first ice zone
    const zone = this.def.surfaces?.[0];
    if (zone) {
      const n = this.samples.length;
      const a = Math.floor(zone.from * n);
      const b = Math.floor(zone.to * n);
      const span = this.halfWidth + CURB_WIDTH + 3.5;
      const arch = new THREE.TorusGeometry(span, 1.1, 6, 24, Math.PI);
      const archMat = new THREE.MeshStandardMaterial({ color: 0x3f8fb0, roughness: 0.3, emissive: 0x1a8f9a, emissiveIntensity: 0.22, transparent: true, opacity: 0.8 });
      for (let i = a; i <= b; i += 7) {
        const s = this.samples[i % n]!;
        const m = new THREE.Mesh(arch, archMat);
        m.position.copy(s.pos);
        m.lookAt(s.pos.clone().add(s.tangent));
        this.group.add(m);
      }
    }
  }

  private buildRoad(): void {
    const hw = this.halfWidth;
    const geo = toGeometry(this.ribbon(hw, -hw, 0, 0, this.roadMask));
    const tex = this.asphaltTexture();
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.15, envMapIntensity: 0.12, side: THREE.DoubleSide });
    this.group.add(new THREE.Mesh(geo, mat));
    // Seitenstreifen (befahrbar, aber langsamer gibt es erst mit Untergrund-Typen in M6)
    for (const side of [1, -1]) {
      const shoulder = toGeometry(this.ribbon(side * hw, side * this.wallOffset, 0, 0, this.roadMask));
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
      const base = this.wallMask(side);
      // On the rope bridge the ropes are the visible railing; the (invisible) collider wall stays.
      const mask = this.def.environment?.ropeBridge ? this.samples.map((_, i) => (base ? base[i]! : true) && !this.inRopeBridge(i) && !this.inRopeBridge(i + 1)) : base;
      const geo = toGeometry(this.wall(side * off, WALL_HEIGHT, mask));
      this.group.add(new THREE.Mesh(geo, wallMat));
      // Kollision höher als sichtbar, damit niemand rausfliegt.
      const glow = toGeometry(this.ribbon(side * off, side * (off + 0.05), WALL_HEIGHT, WALL_HEIGHT + 0.12, mask));
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
        if (this.distanceToTrack(p) < this.halfWidth + 10 || this.nearShortcut(p, 14)) continue;
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
