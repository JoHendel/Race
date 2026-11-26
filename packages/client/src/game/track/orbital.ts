import * as THREE from "three";
import { mulberry32, type ShortcutPath } from "@apex/sim";
import type { SplineTrack } from "./splineTrack";

/**
 * Orbital Station scenery: stars, a planet far below, the station ring with spokes and modules,
 * solar panels and a faint energy floor (the invisible safety net under the track).
 */
export function buildOrbital(t: SplineTrack): void {
  const g = t.group;
  const rnd = mulberry32(97);

  // Stars
  const starPos: number[] = [];
  for (let i = 0; i < 1500; i++) {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() * 0.9 - 0.2, rnd() - 0.5).normalize().multiplyScalar(460);
    starPos.push(v.x, v.y, v.z);
  }
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false }),
  );
  g.add(stars);

  // Planet with a thin glowing atmosphere
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(260, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0x1b3a8a, roughness: 0.8, emissive: 0x0a1640, emissiveIntensity: 0.6, fog: false }),
  );
  planet.position.set(-150, -360, 420);
  g.add(planet);
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(272, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x4dd2ff, transparent: true, opacity: 0.12, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  atmosphere.position.copy(planet.position);
  g.add(atmosphere);

  // Energy floor: faint grid below the track (where the invisible ground collider is)
  const grid = new THREE.GridHelper(1600, 80, 0x00e5ff, 0x0a1a3a);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.25;
  grid.position.y = -2;
  g.add(grid);

  // Station: a big ring with spokes around the inner part of the track, plus modules and solar panels
  const hull = new THREE.MeshStandardMaterial({ color: 0xc9cfe0, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.5 });
  const darkHull = new THREE.MeshStandardMaterial({ color: 0x2a3048, roughness: 0.6, metalness: 0.5, envMapIntensity: 0.3 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const centre = new THREE.Vector3(120, 30, 60);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(70, 4, 12, 64), hull);
  ring.position.copy(centre);
  ring.rotation.x = Math.PI / 2.4;
  g.add(ring);
  const windows = new THREE.Mesh(new THREE.TorusGeometry(70, 4.15, 4, 64), new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.35 }));
  windows.position.copy(centre);
  windows.rotation.copy(ring.rotation);
  g.add(windows);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 26, 20), darkHull);
  hub.position.copy(centre);
  hub.rotation.copy(ring.rotation);
  g.add(hub);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 70, 8), hull);
    const a = (i / 4) * Math.PI * 2;
    spoke.position.set(Math.cos(a) * 35, 0, Math.sin(a) * 35);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = -a;
    const holder = new THREE.Group();
    holder.add(spoke);
    holder.position.copy(centre);
    holder.rotation.copy(ring.rotation);
    holder.rotateX(Math.PI / 2);
    g.add(holder);
  }

  // Modules and solar panels along the outside of the track
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x1a2c6b, roughness: 0.3, metalness: 0.8, emissive: 0x0b1a4a, emissiveIntensity: 0.5 });
  for (let i = 0; i < t.samples.length; i += 14) {
    const s = t.samples[i]!;
    const side = rnd() < 0.5 ? 1 : -1;
    const p = s.pos.clone().addScaledVector(s.left, side * (t.halfWidth + 22 + rnd() * 30));
    if (t.distanceToTrack(p) < t.halfWidth + 14 || t.nearShortcut(p, 14)) continue;
    p.y = s.pos.y - 6 + rnd() * 18;
    if (rnd() < 0.5) {
      const mod = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 16 + rnd() * 10, 16), rnd() < 0.5 ? hull : darkHull);
      mod.position.copy(p);
      mod.rotation.set(Math.PI / 2, rnd() * Math.PI, 0);
      g.add(mod);
      const band = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.2, 6, 24), glow);
      band.position.copy(p);
      band.rotation.copy(mod.rotation);
      band.rotateX(Math.PI / 2);
      g.add(band);
    } else {
      const truss = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 30), darkHull);
      truss.position.copy(p);
      truss.rotation.y = rnd() * Math.PI;
      g.add(truss);
      for (const off of [-9, 9]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 7), panelMat);
        panel.position.copy(p).add(new THREE.Vector3(0, 0, off).applyEuler(truss.rotation));
        panel.rotation.y = truss.rotation.y;
        g.add(panel);
      }
    }
  }

  for (const o of [ring, windows, atmosphere]) o.userData.noMerge = true;
  t.animators.push((dt) => {
    ring.rotation.z += dt * 0.05;
    windows.rotation.z = ring.rotation.z;
    atmosphere.rotation.y += dt * 0.01;
  });
}

/** Glass tube shortcut: a transparent tube around the road with light rings. */
export function buildGlassTube(t: SplineTrack, c: ShortcutPath, off: number): void {
  const g = t.group;
  const k0 = Math.floor(c.samples.length * 0.12);
  const k1 = Math.ceil(c.samples.length * 0.88);
  const pts = c.samples.slice(k0, k1 + 1).map((s) => s.pos.clone().add(new THREE.Vector3(0, 1.5, 0)));
  const curve = new THREE.CatmullRomCurve3(pts);
  const radius = off + 1.2;
  const glass = new THREE.Mesh(
    new THREE.TubeGeometry(curve, pts.length * 2, radius, 24, false),
    new THREE.MeshPhysicalMaterial({ color: 0x9fe9ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
  );
  glass.renderOrder = 3;
  g.add(glass);
  const ringGeo = new THREE.TorusGeometry(radius, 0.18, 6, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  for (let k = 0; k < pts.length; k += 6) {
    const m = new THREE.Mesh(ringGeo, ringMat);
    m.position.copy(pts[k]!);
    m.lookAt(pts[k]!.clone().add(curve.getTangentAt(k / (pts.length - 1))));
    g.add(m);
  }
}
