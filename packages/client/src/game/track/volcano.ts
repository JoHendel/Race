import * as THREE from "three";
import { CURB_WIDTH, mulberry32, stripRibbon, stripWall, type ShortcutPath } from "@apex/sim";
import { toGeometry, type SplineTrack } from "./splineTrack";

/** Shared animated lava material (time uniform advanced by the track animators). */
function lavaMaterial(time: { value: number }, opacity: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { time, opacity },
    vertexShader: `varying vec2 vUv; varying vec3 vPos; void main(){ vUv = uv; vPos = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.0); }`,
    fragmentShader: `uniform float time; uniform float opacity; varying vec2 vUv; varying vec3 vPos;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main(){
        vec2 p = vPos.xz * 0.18 + vec2(time * 0.15, time * 0.05);
        float n = noise(p) * 0.6 + noise(p * 2.7 - time * 0.2) * 0.4;
        float crust = smoothstep(0.62, 0.8, n);
        // kept below the bloom threshold so the lava stays orange instead of turning white
        vec3 hot = mix(vec3(0.68, 0.1, 0.02), vec3(0.82, 0.3, 0.05), smoothstep(0.2, 0.6, n));
        vec3 c = mix(hot, vec3(0.12, 0.04, 0.02), crust);
        gl_FragColor = vec4(c, opacity); }`,
  });
}

/** Volcano scenery: basalt plain, lava rivers, the volcano with a glowing crater, and the lava flows on the road. */
export function buildVolcano(t: SplineTrack): void {
  const g = t.group;
  const time = { value: 0 };
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1, envMapIntensity: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  g.add(ground);

  // Volcano in the middle of the spiral
  const centre = new THREE.Vector3(125, -2, 100);
  const basalt = new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: 0.95, envMapIntensity: 0.12, flatShading: true });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(9, 34, 46, 14, 4, true), basalt);
  cone.position.copy(centre).add(new THREE.Vector3(0, 23, 0));
  g.add(cone);
  const crater = new THREE.Mesh(new THREE.CircleGeometry(9, 20), lavaMaterial(time, { value: 1 }));
  crater.rotation.x = -Math.PI / 2;
  crater.position.copy(centre).add(new THREE.Vector3(0, 44, 0));
  g.add(crater);
  const glow = new THREE.PointLight(0xff5a1f, 220, 120, 1.8);
  glow.position.copy(centre).add(new THREE.Vector3(0, 50, 0));
  g.add(glow);
  // Smoke column
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x2a2224, transparent: true, opacity: 0.35, depthWrite: false });
  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(6 + i * 2, 10, 8), smokeMat);
    m.position.copy(centre).add(new THREE.Vector3(i * 2, 52 + i * 9, i * 1.5));
    puffs.push(m);
    g.add(m);
  }

  // Lava rivers on the plain and basalt rocks
  const river = lavaMaterial(time, { value: 1 });
  const rnd = mulberry32(61);
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const dist = 260 + rnd() * 120;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16 + rnd() * 18, 220), river);
    m.rotation.set(-Math.PI / 2, 0, a);
    m.position.set(centre.x + Math.cos(a) * dist, -1.95, centre.z + Math.sin(a) * dist);
    g.add(m);
  }
  const rock = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < t.samples.length; i += 6) {
    const s = t.samples[i]!;
    for (const side of [1, -1]) {
      if (rnd() < 0.45) continue;
      const p = s.pos.clone().addScaledVector(s.left, side * (t.halfWidth + 12 + rnd() * 40));
      if (t.distanceToTrack(p) < t.halfWidth + 9 || t.nearShortcut(p, 10) || p.distanceTo(centre) < 40) continue;
      const r = 2 + rnd() * 6;
      const m = new THREE.Mesh(rock, basalt);
      m.scale.set(r, r * (0.6 + rnd() * 0.8), r);
      m.position.set(p.x, -2 + r * 0.4, p.z);
      m.rotation.set(rnd(), rnd() * 3, rnd());
      g.add(m);
    }
  }

  // Lava flows on the road: both halves are built, the inactive one fades out
  const lava = t.lava;
  const flows: { zone: number; side: 1 | -1; opacity: { value: number } }[] = [];
  if (lava) {
    const hw = t.halfWidth;
    lava.ranges.forEach(([a, b], zone) => {
      for (const side of [1, -1] as const) {
        const opacity = { value: lava.side(zone) === side ? 1 : 0 };
        const m = new THREE.Mesh(t.partialRibbon(a, b, side * (hw + CURB_WIDTH), side * -0.6, 0.04), lavaMaterial(time, opacity));
        m.renderOrder = 1;
        g.add(m);
        flows.push({ zone, side, opacity });
      }
    });
  }

  for (const m of puffs) m.userData.noMerge = true;
  t.animators.push((dt) => {
    time.value += dt;
    puffs.forEach((m, i) => (m.position.y += Math.sin(time.value * 0.4 + i) * 0.01));
    glow.intensity = 200 + Math.sin(time.value * 3) * 40;
    if (!lava) return;
    for (const f of flows) {
      const target = lava.side(f.zone) === f.side ? 1 : 0;
      f.opacity.value += (target - f.opacity.value) * Math.min(1, dt * 2.5);
    }
  });
}

/** Lava tube shortcut: dark basalt tunnel with glowing lava cracks along the floor. */
export function buildLavaTube(t: SplineTrack, c: ShortcutPath, off: number): void {
  const g = t.group;
  const basalt = new THREE.MeshStandardMaterial({ color: 0x241815, roughness: 0.95, envMapIntensity: 0.1, side: THREE.DoubleSide });
  const k0 = Math.floor(c.samples.length * 0.15);
  const k1 = Math.ceil(c.samples.length * 0.85);
  const tube = c.samples.slice(k0, k1 + 1);
  const H = 8;
  for (const side of [1, -1]) {
    g.add(new THREE.Mesh(toGeometry(stripWall(tube, false, side * (off + 0.3), H)), basalt));
    g.add(new THREE.Mesh(toGeometry(stripRibbon(tube, false, side * (off + 0.3), side * 2, H, H + 3)), basalt));
    // glowing cracks at the base of the walls
    g.add(new THREE.Mesh(toGeometry(stripRibbon(tube, false, side * (off + 0.2), side * (off - 0.4), 0.06, 0.06)), new THREE.MeshBasicMaterial({ color: 0xff5a1f, side: THREE.DoubleSide })));
  }
  const lamp = new THREE.MeshBasicMaterial({ color: 0xff8a1f });
  for (let k = 0; k < tube.length; k += 6) {
    const s = tube[k]!;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lamp);
    m.position.copy(s.pos).add(new THREE.Vector3(0, H + 2.4, 0));
    g.add(m);
  }
}
