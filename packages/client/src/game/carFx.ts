import * as THREE from "three";
import { hornFor, type HornSound } from "@apex/shared";
import { emojiTexture } from "./podium";
import { currentLang } from "../i18n";

function rivalTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.font = "italic 900 44px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "#ff2a55";
  g.shadowBlur = 18;
  g.fillStyle = "#ff4d6d";
  g.fillText(currentLang() === "en" ? "▼ RIVAL" : "▼ RIVALE", 128, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const EMOTE_TIME = 2.5;

/** Emotes above cars and horns, for every car in the race (local, bots and remote players). */
export class CarFx {
  private readonly bubbles = new Map<THREE.Object3D, THREE.Sprite>();
  private audio: AudioContext | null = null;
  private rival: { mesh: THREE.Object3D; sprite: THREE.Sprite } | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {}

  emote(mesh: THREE.Object3D, emoji: string): void {
    let sprite = this.bubbles.get(mesh);
    if (!sprite) {
      sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sprite.renderOrder = 10;
      this.bubbles.set(mesh, sprite);
      this.scene.add(sprite);
    }
    sprite.material.map = emojiTexture(emoji);
    sprite.material.needsUpdate = true;
    sprite.userData.age = 0;
    sprite.visible = true;
  }

  /** Mark one car as the player's rival (null = no marker). */
  setRival(mesh: THREE.Object3D | null): void {
    if (this.rival) {
      this.rival.sprite.removeFromParent();
      this.rival.sprite.material.map?.dispose();
      this.rival.sprite.material.dispose();
      this.rival = null;
    }
    if (!mesh) return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: rivalTexture(), transparent: true, depthTest: false }));
    sprite.scale.set(2.6, 0.98, 1);
    sprite.renderOrder = 9;
    sprite.name = "rival-marker";
    this.scene.add(sprite);
    this.rival = { mesh, sprite };
  }

  /** Honk; quieter the further the car is from the camera. */
  horn(mesh: THREE.Object3D, carModel: string): void {
    const dist = mesh.position.distanceTo(this.camera.position);
    const volume = Math.max(0, 1 - dist / 120) * 0.22;
    if (volume < 0.01) return;
    this.play(hornFor(carModel), volume);
  }

  private play(h: HornSound, volume: number): void {
    try {
      this.audio ??= new AudioContext();
      const ctx = this.audio;
      if (ctx.state === "suspended") void ctx.resume();
      const t = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.02);
      gain.gain.setValueAtTime(volume, t + h.length - 0.06);
      gain.gain.linearRampToValueAtTime(0, t + h.length);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2400;
      filter.connect(gain).connect(ctx.destination);
      for (const f of h.freqs) {
        const osc = ctx.createOscillator();
        osc.type = h.wave;
        osc.frequency.value = f;
        osc.connect(filter);
        osc.start(t);
        osc.stop(t + h.length + 0.02);
      }
    } catch {
      // no audio available (e.g. blocked autoplay) – the horn just stays silent
    }
  }

  update(dt: number): void {
    if (this.rival) {
      const { mesh, sprite } = this.rival;
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, 1.9, 0));
      // fade the marker out close to the camera so it never covers the view
      const d = mesh.position.distanceTo(this.camera.position);
      sprite.material.opacity = THREE.MathUtils.clamp((d - 4) / 6, 0, 1);
    }
    for (const [mesh, sprite] of this.bubbles) {
      if (!sprite.visible) continue;
      const age = (sprite.userData.age as number) + dt;
      sprite.userData.age = age;
      // pop in, float up, fade out
      const pop = Math.min(1, age / 0.15);
      const s = 1.5 * (0.6 + 0.4 * pop);
      sprite.scale.set(s, s, 1);
      sprite.position.copy(mesh.position).add(new THREE.Vector3(0, 2.3 + age * 0.4, 0));
      sprite.material.opacity = age > EMOTE_TIME - 0.5 ? Math.max(0, (EMOTE_TIME - age) / 0.5) : 1;
      if (age > EMOTE_TIME) sprite.visible = false;
    }
  }

  dispose(): void {
    for (const s of this.bubbles.values()) {
      s.removeFromParent();
      s.material.dispose();
    }
    this.bubbles.clear();
    this.setRival(null);
    void this.audio?.close();
  }
}
