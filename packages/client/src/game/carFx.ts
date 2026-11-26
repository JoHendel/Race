import * as THREE from "three";
import { distanceGain, hornFor } from "@apex/shared";
import { sound } from "../audio/sound";
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
    sound.horn(hornFor(carModel), distanceGain(mesh.position.distanceTo(this.camera.position)) * 0.22);
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
  }
}
