import * as THREE from "three";
import { CURB_WIDTH, mulberry32, stripRibbon, stripWall, type ShortcutPath } from "@apex/sim";
import { toGeometry, type SplineTrack } from "./splineTrack";

/**
 * Jungle Ruins scenery: jungle floor, trees, a stepped temple pyramid, stone pillars,
 * a waterfall the track runs through and a rope bridge section.
 */
export function buildJungle(t: SplineTrack): void {
  const g = t.group;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0x0c2416, roughness: 1, envMapIntensity: 0.1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  g.add(ground);

  const rnd = mulberry32(83);
  const trunk = new THREE.CylinderGeometry(0.5, 0.8, 1, 6);
  const crown = new THREE.IcosahedronGeometry(1, 0);
  const bark = new THREE.MeshStandardMaterial({ color: 0x3a2716, roughness: 1, envMapIntensity: 0.1 });
  const leaves = [0x1f6b3a, 0x2c8a46, 0x165a32].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, emissive: 0x062a12, emissiveIntensity: 0.4, flatShading: true }));
  const stone = new THREE.MeshStandardMaterial({ color: 0x6f6c5c, roughness: 0.95, envMapIntensity: 0.15, flatShading: true });
  const box = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < t.samples.length; i += 4) {
    const s = t.samples[i]!;
    for (const side of [1, -1]) {
      if (rnd() < 0.35 || t.inRopeBridge(i)) continue;
      const dist = t.halfWidth + 10 + rnd() * 50;
      const p = s.pos.clone().addScaledVector(s.left, side * dist);
      if (t.distanceToTrack(p) < t.halfWidth + 8 || t.nearShortcut(p, 10)) continue;
      if (rnd() < 0.82) {
        const h = 8 + rnd() * 16;
        const tr = new THREE.Mesh(trunk, bark);
        tr.scale.set(1, h, 1);
        tr.position.set(p.x, -2 + h / 2, p.z);
        g.add(tr);
        const r = 3 + rnd() * 4;
        const c = new THREE.Mesh(crown, leaves[Math.floor(rnd() * leaves.length)]!);
        c.scale.set(r, r * 0.8, r);
        c.position.set(p.x, -2 + h + r * 0.3, p.z);
        c.rotation.y = rnd() * Math.PI;
        g.add(c);
      } else {
        // broken stone pillar
        const h = 3 + rnd() * 7;
        const m = new THREE.Mesh(box, stone);
        m.scale.set(2.2, h, 2.2);
        m.position.set(p.x, -2 + h / 2, p.z);
        m.rotation.set((rnd() - 0.5) * 0.2, rnd() * Math.PI, (rnd() - 0.5) * 0.2);
        g.add(m);
      }
    }
  }

  // Stepped temple pyramid inside the lower loop, with a glowing shrine on top
  const centre = new THREE.Vector3(-100, -2, 125);
  if (t.distanceToTrack(centre) > 45) {
    for (let k = 0; k < 6; k++) {
      const w = 44 - k * 7;
      const step = new THREE.Mesh(box, stone);
      step.scale.set(w, 4, w);
      step.position.set(centre.x, centre.y + 2 + k * 4, centre.z);
      g.add(step);
    }
    const shrine = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 6), new THREE.MeshStandardMaterial({ color: 0x3d3a30, emissive: 0x39ff88, emissiveIntensity: 0.25 }));
    shrine.position.set(centre.x, centre.y + 26.5, centre.z);
    g.add(shrine);
  }

  const env = t.def.environment;
  if (env?.waterfall !== undefined) buildWaterfall(t, env.waterfall);
  if (env?.ropeBridge) buildRopeBridge(t, env.ropeBridge);
}

/** A cliff beside the track and a curtain of falling water across it – the cars drive straight through. */
function buildWaterfall(t: SplineTrack, at: number): void {
  const g = t.group;
  const s = t.sample(Math.round(at * t.samples.length));
  const yaw = Math.atan2(s.tangent.x, s.tangent.z);
  const span = t.wallOffset * 2 + 6;
  const height = 26;

  // Rock arch the water falls from
  const rock = new THREE.MeshStandardMaterial({ color: 0x4a4639, roughness: 0.95, envMapIntensity: 0.15, flatShading: true });
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(span + 8, 6, 8), rock);
  lintel.position.copy(s.pos).add(new THREE.Vector3(0, height + 3, 0));
  lintel.rotation.y = yaw;
  g.add(lintel);
  for (const side of [1, -1]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(6, height + 8, 9), rock);
    col.position.copy(s.pos).addScaledVector(s.left, side * (span / 2 + 3)).add(new THREE.Vector3(0, (height + 8) / 2 - 2, 0));
    col.rotation.y = yaw;
    g.add(col);
  }

  // Animated water curtain (no collider)
  const time = { value: 0 };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(span, height + 2, 1, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { time },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float time; varying vec2 vUv;
        float hash(float n){ return fract(sin(n) * 43758.5453); }
        void main(){
          float col = floor(vUv.x * 60.0);
          float speed = 0.8 + hash(col) * 0.8;
          float streak = fract(vUv.y * 3.0 + time * speed + hash(col + 7.0));
          float a = 0.25 + 0.45 * smoothstep(0.2, 1.0, streak);
          vec3 c = mix(vec3(0.55, 0.85, 1.0), vec3(1.0), streak * 0.6);
          float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
          gl_FragColor = vec4(c, a * edge * 0.75); }`,
    }),
  );
  water.position.copy(s.pos).add(new THREE.Vector3(0, (height + 2) / 2 - 1, 0));
  water.rotation.y = yaw;
  water.renderOrder = 2;
  g.add(water);

  // Mist where the water hits the road
  const mistMat = new THREE.MeshBasicMaterial({ color: 0xcfefff, transparent: true, opacity: 0.12, depthWrite: false });
  const mists: THREE.Mesh[] = [];
  const rnd = mulberry32(5);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(2.5 + rnd() * 2, 10, 8), mistMat);
    m.position.copy(s.pos).addScaledVector(s.left, (rnd() - 0.5) * span).add(new THREE.Vector3(0, 0.8 + rnd(), 0));
    mists.push(m);
    g.add(m);
  }
  for (const m of mists) m.userData.noMerge = true;
  t.animators.push((dt) => {
    time.value += dt;
    mists.forEach((m, i) => m.scale.setScalar(1 + 0.15 * Math.sin(time.value * 1.5 + i)));
  });
}

/** Rope bridge: wooden planks on the deck, posts with rope railings and pillars down to the jungle floor. */
function buildRopeBridge(t: SplineTrack, [from, to]: [number, number]): void {
  const g = t.group;
  const n = t.samples.length;
  const a = Math.floor(from * n);
  const b = Math.floor(to * n);
  const hw = t.halfWidth;

  // Planks over the road
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < 64; y += 8) {
    const v = 70 + ((y * 37) % 30);
    ctx.fillStyle = `rgb(${v + 30},${v},${v - 30})`;
    ctx.fillRect(0, y, 64, 7);
    ctx.fillStyle = "#2a1a0e";
    ctx.fillRect(0, y + 7, 64, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const deck = new THREE.Mesh(t.partialRibbon(a, b, hw + CURB_WIDTH, -hw - CURB_WIDTH, 0.035), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, envMapIntensity: 0.1, side: THREE.DoubleSide }));
  deck.renderOrder = 1;
  g.add(deck);

  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.95, envMapIntensity: 0.1 });
  const rope = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 1, emissive: 0x3a2a10, emissiveIntensity: 0.4 });
  const post = new THREE.BoxGeometry(0.35, 1.6, 0.35);
  const off = t.wallOffset;
  const part = t.samples.slice(a, b + 1);
  for (const side of [1, -1]) {
    for (let k = 0; k < part.length; k += 4) {
      const s = part[k]!;
      const m = new THREE.Mesh(post, wood);
      m.position.copy(s.pos).addScaledVector(s.left, side * off).add(new THREE.Vector3(0, 0.8, 0));
      g.add(m);
    }
    for (const h of [0.75, 1.45]) g.add(new THREE.Mesh(toGeometry(stripRibbon(part, false, side * off, side * (off + 0.08), h, h + 0.08)), rope));
    // a hint of neon so the edge is readable at night
    g.add(new THREE.Mesh(toGeometry(stripWall(part, false, side * (off + 0.02), 0.1)), new THREE.MeshBasicMaterial({ color: side === 1 ? t.def.accent : t.def.accent2, side: THREE.DoubleSide })));
  }
  // Pillars down to the jungle floor
  const pillar = new THREE.BoxGeometry(1.4, 1, 1.4);
  for (let k = 0; k < part.length; k += 12) {
    const s = part[k]!;
    const h = s.pos.y + 2;
    if (h < 3) continue;
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(pillar, wood);
      m.scale.y = h;
      m.position.copy(s.pos).addScaledVector(s.left, side * (hw + 1)).add(new THREE.Vector3(0, -h / 2, 0));
      g.add(m);
    }
  }
}

/** Temple shortcut: stone walls with columns, a partly broken roof and golden glyphs. */
export function buildTemple(t: SplineTrack, c: ShortcutPath, off: number): void {
  const g = t.group;
  const stone = new THREE.MeshStandardMaterial({ color: 0x77735f, roughness: 0.95, envMapIntensity: 0.15, side: THREE.DoubleSide });
  const k0 = Math.floor(c.samples.length * 0.18);
  const k1 = Math.ceil(c.samples.length * 0.85);
  const hall = c.samples.slice(k0, k1 + 1);
  const H = 9;
  for (const side of [1, -1]) {
    g.add(new THREE.Mesh(toGeometry(stripWall(hall, false, side * (off + 0.3), H)), stone));
    // golden glyph band
    g.add(new THREE.Mesh(toGeometry(stripRibbon(hall, false, side * (off + 0.25), side * (off + 0.25), 4, 4.5)), new THREE.MeshBasicMaterial({ color: 0xffc94d, side: THREE.DoubleSide })));
  }
  // Roof slabs with gaps (the temple is crumbling)
  const slab = new THREE.BoxGeometry((off + 0.5) * 2, 0.8, 3.2);
  const rnd = mulberry32(19);
  for (let k = 0; k < hall.length; k += 2) {
    if (rnd() < 0.3) continue;
    const s = hall[k]!;
    const m = new THREE.Mesh(slab, stone);
    m.position.copy(s.pos).add(new THREE.Vector3(0, H + 0.4, 0));
    m.lookAt(m.position.clone().add(s.tangent));
    m.rotateZ((rnd() - 0.5) * 0.08);
    g.add(m);
  }
  // Columns along the inner walls
  const column = new THREE.CylinderGeometry(0.7, 0.8, H, 8);
  for (let k = 2; k < hall.length; k += 5) {
    const s = hall[k]!;
    for (const side of [1, -1]) {
      const m = new THREE.Mesh(column, stone);
      m.position.copy(s.pos).addScaledVector(s.left, side * (off - 0.6)).add(new THREE.Vector3(0, H / 2, 0));
      g.add(m);
    }
  }
  // Torches at the entrance
  const fire = new THREE.MeshBasicMaterial({ color: 0xff8a1f });
  const entry = c.samples[k0]!;
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 8), fire);
    m.position.copy(entry.pos).addScaledVector(entry.left, side * (off + 1.2)).add(new THREE.Vector3(0, 3.5, 0));
    g.add(m);
  }
}
