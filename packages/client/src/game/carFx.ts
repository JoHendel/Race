import * as THREE from "three";
import { hornFor, type HornSound } from "@apex/shared";
import { emojiTexture } from "./podium";

const EMOTE_TIME = 2.5;

/** Emotes above cars and horns, for every car in the race (local, bots and remote players). */
export class CarFx {
  private readonly bubbles = new Map<THREE.Object3D, THREE.Sprite>();
  private audio: AudioContext | null = null;

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
    void this.audio?.close();
  }
}
