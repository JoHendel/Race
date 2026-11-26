import * as THREE from "three";
import { theme } from "@apex/shared";
import { mulberry32 } from "@apex/sim/pure";
import type { SplineTrack } from "./splineTrack";
import { normalMap, type SurfaceKind } from "../normalMaps";

/** Flat ground plane under the track, optionally with a procedural normal map. */
function ground(t: SplineTrack, color: number, roughness = 1, surface?: SurfaceKind): void {
  let nm: THREE.Texture | null = null;
  if (surface) {
    nm = normalMap(surface).clone();
    nm.repeat.set(120, 120);
    nm.needsUpdate = true;
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: 0.1, normalMap: nm }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -2;
  t.group.add(m);
}

/** Free spot next to the track (not on the road, not on a shortcut), or null. */
function spot(t: SplineTrack, i: number, side: number, dist: number, margin: number): THREE.Vector3 | null {
  const s = t.samples[i % t.samples.length]!;
  const p = s.pos.clone().addScaledVector(s.left, side * dist);
  if (t.distanceToTrack(p) < t.halfWidth + margin || t.nearShortcut(p, margin)) return null;
  return p;
}

/** Sunset Canyon: sand, layered red mesas, cacti and boulders. */
export function buildDesert(t: SplineTrack): void {
  const g = t.group;
  ground(t, 0x9a5a2e, 1, "sand");
  const rnd = mulberry32(31);
  const layers = [0xa2482a, 0xc0653a, 0x8a3a22, 0xd07a45].map((c) => new THREE.MeshStandardMaterial({ color: c, normalMap: normalMap("rock"), normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.95, envMapIntensity: 0.12, flatShading: true }));
  const cyl = new THREE.CylinderGeometry(1, 1.15, 1, 9);

  // Mesas: stacked, slightly shrinking layers – far from the road
  for (let i = 0; i < t.samples.length; i += 22) {
    for (const side of [1, -1]) {
      if (rnd() < 0.35) continue;
      const p = spot(t, i, side, t.halfWidth + 45 + rnd() * 70, 35);
      if (!p) continue;
      const r = 14 + rnd() * 22;
      let y = -2;
      const n = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const h = 5 + rnd() * 7;
        const m = new THREE.Mesh(cyl, layers[(k + i) % layers.length]!);
        const rr = r * (1 - k * 0.08);
        m.scale.set(rr, h, rr * (0.7 + rnd() * 0.4));
        m.position.set(p.x, y + h / 2, p.z);
        m.rotation.y = rnd() * Math.PI;
        g.add(m);
        y += h;
      }
    }
  }

  // Cacti and boulders close to the road
  const cactus = new THREE.MeshStandardMaterial({ color: 0x3f6b35, roughness: 0.9, envMapIntensity: 0.1, flatShading: true });
  const stem = new THREE.CylinderGeometry(0.45, 0.55, 1, 7);
  const rock = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < t.samples.length; i += 5) {
    for (const side of [1, -1]) {
      if (rnd() < 0.55) continue;
      const p = spot(t, i, side, t.halfWidth + 10 + rnd() * 30, 8);
      if (!p) continue;
      if (rnd() < 0.6) {
        const h = 3 + rnd() * 4;
        const c = new THREE.Group();
        const main = new THREE.Mesh(stem, cactus);
        main.scale.y = h;
        main.position.y = h / 2;
        c.add(main);
        for (const dir of [1, -1]) {
          if (rnd() < 0.35) continue;
          const arm = new THREE.Mesh(stem, cactus);
          arm.scale.set(0.75, h * 0.35, 0.75);
          arm.position.set(dir * 0.9, h * (0.45 + rnd() * 0.2), 0);
          c.add(arm);
          const elbow = new THREE.Mesh(stem, cactus);
          elbow.scale.set(0.75, 0.9, 0.75);
          elbow.rotation.z = (dir * Math.PI) / 2;
          elbow.position.set(dir * 0.45, h * 0.3, 0);
          c.add(elbow);
        }
        c.position.set(p.x, -2, p.z);
        c.rotation.y = rnd() * Math.PI;
        g.add(c);
      } else {
        const r = 1 + rnd() * 3;
        const m = new THREE.Mesh(rock, layers[1]!);
        m.scale.set(r, r * 0.7, r);
        m.position.set(p.x, -2 + r * 0.3, p.z);
        m.rotation.set(rnd(), rnd() * 3, rnd());
        g.add(m);
      }
    }
  }
}

/** Window texture for skyscrapers: dark facade with random lit windows. */
function windowTexture(seed: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#07081a";
  g.fillRect(0, 0, 64, 128);
  const rnd = mulberry32(seed);
  const colors = ["#ffd98a", "#9fe9ff", "#ff9ad8", "#ffffff"];
  for (let y = 4; y < 128; y += 8)
    for (let x = 4; x < 64; x += 8) {
      if (rnd() < 0.45) continue;
      g.fillStyle = colors[Math.floor(rnd() * colors.length)]!;
      g.globalAlpha = 0.35 + rnd() * 0.65;
      g.fillRect(x, y, 4, 5);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/** Skyline Loop: a dense neon city of skyscrapers with lit windows, rooftop lights and sign bands. */
export function buildCity(t: SplineTrack): void {
  const g = t.group;
  ground(t, 0x05060f, 0.6);
  const grid = new THREE.GridHelper(2000, 160, theme.violet, 0x120a28);
  grid.position.y = -1.95;
  g.add(grid);
  const rnd = mulberry32(13);
  const facades = [1, 2, 3, 4].map((sd) => {
    const map = windowTexture(sd);
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.3, envMapIntensity: 0.15 });
  });
  const roof = new THREE.MeshStandardMaterial({ color: 0x0b0c1c, roughness: 0.8 });
  const neon = [theme.cyan, theme.magenta, theme.orange, theme.violet].map((c) => new THREE.MeshBasicMaterial({ color: c }));
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < t.samples.length; i += 7) {
    for (const side of [1, -1]) {
      if (rnd() < 0.2) continue;
      const p = spot(t, i, side, t.halfWidth + 16 + rnd() * 45, 12);
      if (!p) continue;
      const w = 12 + rnd() * 16;
      const d = 12 + rnd() * 16;
      const h = 30 + rnd() * rnd() * 110;
      const mat = facades[Math.floor(rnd() * facades.length)]!;
      const b = new THREE.Mesh(box, [mat, mat, roof, roof, mat, mat]);
      b.scale.set(w, h, d);
      b.position.set(p.x, -2 + h / 2, p.z);
      b.rotation.y = rnd() * Math.PI;
      // repeat the window texture according to the building size
      g.add(b);
      // a glowing sign band around some buildings
      if (rnd() < 0.5) {
        const band = new THREE.Mesh(box, neon[Math.floor(rnd() * neon.length)]!);
        band.scale.set(w + 0.3, 1.2, d + 0.3);
        band.position.set(p.x, -2 + h * (0.55 + rnd() * 0.35), p.z);
        band.rotation.y = b.rotation.y;
        g.add(band);
      }
      // blinking-red aircraft light on tall towers
      if (h > 80) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
        lamp.position.set(p.x, -2 + h + 1.5, p.z);
        g.add(lamp);
      }
    }
  }
  // scale textures per building would need a geometry per building; instead set a sensible repeat
  for (const f of facades) f.map!.repeat.set(2, 4);
}

/** Crowd texture for the grandstands: rows of coloured dots. */
function crowdTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1a1d30";
  g.fillRect(0, 0, 128, 64);
  const rnd = mulberry32(3);
  const colors = ["#ff4d6d", "#00e5ff", "#ffd34d", "#f4f6ff", "#39ff88", "#ff8a1f", "#9b5cff"];
  for (let y = 3; y < 64; y += 6)
    for (let x = 2; x < 128; x += 4) {
      if (rnd() < 0.15) continue;
      g.fillStyle = colors[Math.floor(rnd() * colors.length)]!;
      g.fillRect(x + (rnd() - 0.5), y, 2, 3);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Grand Circuit: grass, grandstands with crowds along the straights, a pit building with garages, flags and trees. */
export function buildCircuit(t: SplineTrack): void {
  const g = t.group;
  ground(t, 0x1f4a26);
  const rnd = mulberry32(71);
  const n = t.samples.length;
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8a8f9e, roughness: 0.85, envMapIntensity: 0.15 });
  const crowd = new THREE.MeshStandardMaterial({ map: crowdTexture(), roughness: 0.9, envMapIntensity: 0.1 });
  crowd.map!.repeat.set(6, 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x9aa0b6, roughness: 0.55, metalness: 0.4 });

  // Grandstands along the straights (where the track hardly curves)
  const straight = (i: number) => t.sample(i).tangent.angleTo(t.sample(i + 30).tangent) < 0.12;
  for (let i = 0; i < n; i += 45) {
    if (!straight(i)) continue;
    const s = t.sample(i + 15);
    const side = i % 90 === 0 ? 1 : -1;
    const p = s.pos.clone().addScaledVector(s.left, side * (t.wallOffset + 9));
    if (t.distanceToTrack(p) < t.wallOffset + 4 || t.nearShortcut(p, 12)) continue;
    const stand = new THREE.Group();
    const len = 55;
    for (let k = 0; k < 5; k++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(len, 1.6, 2.4), [concrete, concrete, crowd, concrete, crowd, crowd]);
      step.position.set(0, 0.8 + k * 1.6, k * 2.4);
      stand.add(step);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(len, 10, 0.6), concrete);
    back.position.set(0, 5, 12.4);
    stand.add(back);
    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(len + 2, 0.5, 15), roofMat);
    roofSlab.position.set(0, 11, 5.5);
    roofSlab.rotation.x = -0.08;
    stand.add(roofSlab);
    stand.position.copy(p).setY(s.pos.y - 0.5);
    // face the track
    stand.lookAt(stand.position.clone().addScaledVector(s.left, -side));
    stand.rotateY(Math.PI);
    g.add(stand);
  }

  // Pit building with garages along the start straight (outside of the left wall)
  const start = t.sample(25);
  const pit = new THREE.Group();
  const garageCount = 10;
  const garageW = 7;
  const building = new THREE.Mesh(new THREE.BoxGeometry(garageCount * garageW + 4, 7, 12), concrete);
  building.position.set(0, 3.5, 6);
  pit.add(building);
  const teamColors = [theme.cyan, theme.magenta, theme.orange, theme.violet, 0x39ff88];
  for (let k = 0; k < garageCount; k++) {
    const tc = teamColors[k % teamColors.length]!;
    // standard material with a little glow – basic colours would bloom to white
    const door = new THREE.Mesh(new THREE.PlaneGeometry(garageW - 1.2, 4.5), new THREE.MeshStandardMaterial({ color: tc, emissive: tc, emissiveIntensity: 0.15, roughness: 0.6, side: THREE.DoubleSide }));
    door.position.set(-((garageCount - 1) * garageW) / 2 + k * garageW, 2.4, -0.02);
    door.rotation.y = Math.PI;
    pit.add(door);
  }
  const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 16, 6), roofMat);
  tower.position.set(((garageCount * garageW) / 2 + 6), 8, 6);
  pit.add(tower);
  pit.position.copy(start.pos).addScaledVector(start.left, t.wallOffset + 5).setY(start.pos.y - 0.5);
  pit.lookAt(pit.position.clone().addScaledVector(start.left, -1));
  pit.rotateY(Math.PI);
  g.add(pit);

  // Flags and trees around the circuit
  const pole = new THREE.CylinderGeometry(0.12, 0.12, 8, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd9dce8, metalness: 0.6, roughness: 0.4 });
  const trunk = new THREE.CylinderGeometry(0.4, 0.6, 1, 6);
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 1 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x2f6b30, roughness: 0.9, flatShading: true });
  const crown = new THREE.IcosahedronGeometry(1, 0);
  const flags: THREE.Mesh[] = [];
  for (let i = 0; i < n; i += 9) {
    for (const side of [1, -1]) {
      if (rnd() < 0.5) continue;
      if (rnd() < 0.35) {
        const p = spot(t, i, side, t.wallOffset + 2.5, 1);
        if (!p) continue;
        const pm = new THREE.Mesh(pole, poleMat);
        pm.position.set(p.x, t.samples[i]!.pos.y + 4 - 0.5, p.z);
        g.add(pm);
        const fc = teamColors[Math.floor(rnd() * teamColors.length)]!;
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ color: fc, emissive: fc, emissiveIntensity: 0.12, roughness: 0.8, side: THREE.DoubleSide }));
        flag.position.set(p.x + 1.2, t.samples[i]!.pos.y + 7, p.z);
        g.add(flag);
        flags.push(flag);
      } else {
        const p = spot(t, i, side, t.halfWidth + 18 + rnd() * 50, 14);
        if (!p) continue;
        const h = 5 + rnd() * 6;
        const tr = new THREE.Mesh(trunk, bark);
        tr.scale.y = h;
        tr.position.set(p.x, -2 + h / 2, p.z);
        g.add(tr);
        const r = 2.5 + rnd() * 2.5;
        const c = new THREE.Mesh(crown, leaves);
        c.scale.set(r, r, r);
        c.position.set(p.x, -2 + h + r * 0.5, p.z);
        g.add(c);
      }
    }
  }
  let time = 0;
  for (const f of flags) f.userData.noMerge = true;
  t.animators.push((dt) => {
    time += dt;
    flags.forEach((f, i) => (f.rotation.y = Math.sin(time * 2 + i) * 0.4));
  });
}
