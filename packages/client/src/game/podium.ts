import * as THREE from "three";
import { theme } from "@apex/shared";
import type { Car } from "./car";

const STEP_HEIGHTS = [2.2, 1.5, 1.0]; // Platz 1, 2, 3
const STEP_X = [0, -4.6, 4.6];
const CONFETTI = 900;

/** Siegertreppe mit Pokal, Konfetti, Feuerwerk und Kamerafahrt. */
export class Podium {
  readonly group = new THREE.Group();
  private time = 0;
  private readonly confetti: THREE.InstancedMesh;
  private readonly confettiState: { p: THREE.Vector3; v: THREE.Vector3; r: THREE.Euler; s: number }[] = [];
  private readonly fireworks: THREE.Points;
  private readonly fwPos = new Float32Array(1200 * 3);
  private readonly fwVel = new Float32Array(1200 * 3);
  private readonly fwCol = new Float32Array(1200 * 3);
  private readonly fwLife = new Float32Array(1200);
  private fwNext = 0;
  private nextBurst = 0.3;
  private readonly trophy: THREE.Group;
  private readonly dummy = new THREE.Object3D();
  private readonly emoteSprites = new Map<Car, THREE.Sprite>();

  constructor(
    readonly anchor: THREE.Vector3,
    readonly yaw: number,
  ) {
    this.group.position.copy(anchor);
    this.group.rotation.y = yaw;

    // Bühne
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 15, 0.6, 48),
      new THREE.MeshStandardMaterial({ color: 0x080914, roughness: 0.55, metalness: 0.4, envMapIntensity: 0.2 }),
    );
    stage.position.y = 0.3;
    this.group.add(stage);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(14.5, 0.12, 8, 96), new THREE.MeshBasicMaterial({ color: theme.magenta }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.62;
    this.group.add(ring);

    // Treppenstufen mit Nummern
    STEP_HEIGHTS.forEach((h, i) => {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(4.4, h, 5.2),
        new THREE.MeshStandardMaterial({ color: 0x12142a, roughness: 0.45, metalness: 0.5, envMapIntensity: 0.25 }),
      );
      step.position.set(STEP_X[i]!, 0.6 + h / 2, 0);
      this.group.add(step);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: numberTexture(i + 1), transparent: true }));
      label.position.set(STEP_X[i]!, 0.6 + h / 2, 2.62);
      this.group.add(label);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(4.45, 0.08, 5.25),
        new THREE.MeshBasicMaterial({ color: [0xffd34d, 0xd9e1ff, 0xff9a4d][i] }),
      );
      edge.position.set(STEP_X[i]!, 0.6 + h, 0);
      this.group.add(edge);
    });

    this.trophy = createTrophy();
    this.trophy.position.set(0, 0.6 + STEP_HEIGHTS[0]! + 2.6, -1.6);
    this.group.add(this.trophy);

    // Scheinwerfer
    for (const [x, c] of [
      [-10, theme.cyan],
      [10, theme.magenta],
      [0, 0xffffff],
    ] as const) {
      const light = new THREE.SpotLight(c, 45, 50, 0.45, 0.6, 1.2);
      light.position.set(x, 18, 10);
      light.target.position.set(0, 2, 0);
      this.group.add(light, light.target);
    }

    // Konfetti
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
    this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 0.28), mat, CONFETTI);
    const palette = [theme.cyan, theme.magenta, theme.orange, 0xffe14d, 0x39ff88, 0xffffff];
    const c = new THREE.Color();
    for (let i = 0; i < CONFETTI; i++) {
      this.confettiState.push({
        p: new THREE.Vector3((Math.random() - 0.5) * 20, 12 + Math.random() * 14, (Math.random() - 0.5) * 12),
        v: new THREE.Vector3((Math.random() - 0.5) * 1.5, -1.2 - Math.random() * 1.6, (Math.random() - 0.5) * 1.5),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        s: 0.6 + Math.random() * 0.8,
      });
      this.confetti.setColorAt(i, c.setHex(palette[i % palette.length]!));
    }
    this.confetti.frustumCulled = false;
    this.group.add(this.confetti);

    // Feuerwerk
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.fwPos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.fwCol, 3));
    this.fwPos.fill(-1000);
    this.fireworks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.fireworks.frustumCulled = false;
    this.group.add(this.fireworks);
  }

  /** Stellt die Autos der Plätze 1–3 auf die Stufen. */
  placeCars(cars: Car[]): void {
    cars.slice(0, 3).forEach((car, i) => {
      const local = new THREE.Vector3(STEP_X[i]!, 0.6 + STEP_HEIGHTS[i]! + 0.75, 0);
      const world = this.group.localToWorld(local.clone());
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      car.setRemote(true);
      car.teleport([world.x, world.y, world.z], [q.x, q.y, q.z, q.w]);
      car.body.setNextKinematicTranslation({ x: world.x, y: world.y, z: world.z });
      car.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    });
  }

  /** Zeigt ein Emote über einem Auto. */
  showEmote(car: Car, emoji: string): void {
    let sprite = this.emoteSprites.get(car);
    if (!sprite) {
      sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sprite.scale.set(2.4, 2.4, 1);
      this.emoteSprites.set(car, sprite);
      this.group.parent?.add(sprite);
    }
    sprite.material.map = emojiTexture(emoji);
    sprite.material.needsUpdate = true;
    sprite.userData.age = 0;
  }

  private burst(origin: THREE.Vector3, color: number): void {
    const c = new THREE.Color(color);
    for (let n = 0; n < 120; n++) {
      const i = this.fwNext;
      this.fwNext = (this.fwNext + 1) % this.fwLife.length;
      const dir = new THREE.Vector3().randomDirection().multiplyScalar(6 + Math.random() * 4);
      this.fwPos.set([origin.x, origin.y, origin.z], i * 3);
      this.fwVel.set([dir.x, dir.y, dir.z], i * 3);
      this.fwCol.set([c.r, c.g, c.b], i * 3);
      this.fwLife[i] = 1.2 + Math.random() * 0.6;
    }
  }

  /** Animation und Kamerafahrt. */
  update(dt: number, camera: THREE.PerspectiveCamera): void {
    this.time += dt;
    for (let i = 0; i < CONFETTI; i++) {
      const s = this.confettiState[i]!;
      s.p.addScaledVector(s.v, dt);
      s.p.x += Math.sin(this.time * 2 + i) * dt * 0.6;
      s.r.x += dt * 3 * s.s;
      s.r.y += dt * 2 * s.s;
      if (s.p.y < 0.7) s.p.y = 14 + Math.random() * 8;
      this.dummy.position.copy(s.p);
      this.dummy.rotation.copy(s.r);
      this.dummy.updateMatrix();
      this.confetti.setMatrixAt(i, this.dummy.matrix);
    }
    this.confetti.instanceMatrix.needsUpdate = true;

    this.nextBurst -= dt;
    if (this.nextBurst <= 0) {
      this.nextBurst = 0.5 + Math.random() * 0.7;
      const colors = [theme.cyan, theme.magenta, theme.orange, 0xffe14d, 0x39ff88];
      this.burst(new THREE.Vector3((Math.random() - 0.5) * 30, 16 + Math.random() * 8, -12 - Math.random() * 10), colors[Math.floor(Math.random() * colors.length)]!);
    }
    for (let i = 0; i < this.fwLife.length; i++) {
      if (this.fwLife[i]! <= 0) continue;
      this.fwLife[i]! -= dt;
      const k = i * 3;
      this.fwVel[k + 1]! -= 4 * dt;
      for (let a = 0; a < 3; a++) {
        this.fwVel[k + a]! *= 1 - 1.2 * dt;
        this.fwPos[k + a]! += this.fwVel[k + a]! * dt;
      }
      if (this.fwLife[i]! <= 0) this.fwPos[k + 1] = -1000;
    }
    this.fireworks.geometry.attributes.position!.needsUpdate = true;
    this.fireworks.geometry.attributes.color!.needsUpdate = true;

    this.trophy.rotation.y += dt * 0.8;
    this.trophy.position.y = 0.6 + STEP_HEIGHTS[0]! + 2.6 + Math.sin(this.time * 2) * 0.15;

    for (const [car, sprite] of this.emoteSprites) {
      sprite.userData.age += dt;
      sprite.position.copy(car.mesh.position).add(new THREE.Vector3(0, 2.6 + Math.min(1, sprite.userData.age as number) * 0.6, 0));
      sprite.material.opacity = Math.max(0, 1 - Math.max(0, (sprite.userData.age as number) - 2.5));
    }

    // Kamera kreist langsam um die Treppe und kommt näher.
    const t = Math.min(1, this.time / 6);
    const ease = t * t * (3 - 2 * t);
    const angle = this.yaw + (-0.9 + ease * 0.9) + Math.sin(this.time * 0.25) * 0.25;
    const radius = 24 - ease * 9;
    const target = this.group.localToWorld(new THREE.Vector3(0, 2.6, 0));
    camera.position.set(target.x + Math.sin(angle) * radius, target.y + 4.5 - ease * 1.5, target.z + Math.cos(angle) * radius);
    camera.lookAt(target);
    camera.fov += (55 - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const s of this.emoteSprites.values()) s.removeFromParent();
  }
}

function createTrophy(): THREE.Group {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc94d, metalness: 1, roughness: 0.18, emissive: 0x3a2400, emissiveIntensity: 0.6 });
  const profile = [
    [0, 0],
    [0.55, 0],
    [0.55, 0.15],
    [0.22, 0.25],
    [0.16, 0.8],
    [0.3, 0.95],
    [0.75, 1.3],
    [0.85, 2.0],
    [0.8, 2.05],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 40), gold));
  for (const side of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 8, 24, Math.PI), gold);
    handle.position.set(side * 0.85, 1.55, 0);
    handle.rotation.z = side * -Math.PI / 2;
    g.add(handle);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  star.position.y = 2.4;
  g.add(star);
  return g;
}

function numberTexture(n: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "italic 900 110px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = ["#ffd34d", "#d9e1ff", "#ff9a4d"][n - 1]!;
  g.shadowColor = g.fillStyle;
  g.shadowBlur = 16;
  g.fillText(String(n), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const emojiCache = new Map<string, THREE.CanvasTexture>();
export function emojiTexture(emoji: string): THREE.CanvasTexture {
  const cached = emojiCache.get(emoji);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "96px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 64, 72);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  emojiCache.set(emoji, tex);
  return tex;
}

export { EMOTES } from "@apex/shared";
