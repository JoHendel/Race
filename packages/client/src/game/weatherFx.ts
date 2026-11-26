import * as THREE from "three";
import type { TrackEnvironment, Weather } from "@apex/shared";
import type { PostFx } from "./postFx";

/** Environment adjusted for the weather (darker sky at night, greyer in rain and fog). */
export function weatherEnvironment(env: TrackEnvironment, w: Weather): TrackEnvironment {
  const scale = (hex: number, f: number, toward = 0x000000) => new THREE.Color(hex).lerp(new THREE.Color(toward), 1 - f).getHex();
  if (w === "night") return { ...env, sky: { top: scale(env.sky.top, 0.12, 0x02030a), mid: scale(env.sky.mid, 0.1, 0x04061a), horizon: scale(env.sky.horizon, 0.14, 0x0a1030) }, fog: scale(env.fog, 0.15, 0x03040c), sun: null };
  if (w === "rain") return { ...env, sky: { top: scale(env.sky.top, 0.6, 0x1a2030), mid: scale(env.sky.mid, 0.4, 0x2a3040), horizon: scale(env.sky.horizon, 0.35, 0x4a5568) }, fog: 0x2a3040, sun: null };
  if (w === "fog") return { ...env, sky: { top: scale(env.sky.top, 0.5, 0x8a93a8), mid: scale(env.sky.mid, 0.3, 0x9aa3b8), horizon: 0xaab3c6 }, fog: 0x9aa3b8, sun: null };
  return env;
}

/** Post-processing adjusted for the weather. */
export function weatherPostFx(fx: PostFx, w: Weather): PostFx {
  if (w === "rain") return { ...fx, saturation: fx.saturation * 0.85, contrast: fx.contrast * 0.97, tint: 0xdfe8ff, vignette: fx.vignette + 0.1 };
  if (w === "fog") return { ...fx, saturation: fx.saturation * 0.8, bloom: fx.bloom * 0.8, tint: 0xeef2ff };
  if (w === "night") return { ...fx, bloom: fx.bloom * 1.15, threshold: fx.threshold * 0.9, vignette: fx.vignette + 0.12 };
  return fx;
}

/** Fog distances (near, far) for the weather. */
export function weatherFog(w: Weather): [number, number] {
  if (w === "fog") return [18, 150];
  if (w === "rain") return [60, 320];
  if (w === "night") return [80, 420];
  return [120, 520];
}

/** Light intensity factor (hemisphere and sun) for the weather. */
export function weatherLight(w: Weather): number {
  return w === "night" ? 0.12 : w === "rain" ? 0.6 : w === "fog" ? 0.8 : 1;
}

/** Strength of the environment reflections for the weather (the HDRIs are daylight). */
export function weatherEnvIntensity(w: Weather): number {
  return w === "night" ? 0.12 : w === "rain" ? 0.45 : 0.6;
}

/**
 * Rain: thousands of short streaks in a box that follows the camera; they fall and wrap around.
 * Rendered as one LineSegments object, so it is cheap.
 */
export class Rain {
  readonly object: THREE.LineSegments;
  private readonly pos: Float32Array;
  private readonly count = 2600;
  private readonly size = 70;
  private readonly height = 40;

  constructor() {
    this.pos = new Float32Array(this.count * 6);
    for (let i = 0; i < this.count; i++) this.place(i, Math.random() * this.height);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.object = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaec8ff, transparent: true, opacity: 0.35, depthWrite: false }));
    this.object.frustumCulled = false;
  }

  private place(i: number, y: number): void {
    const x = (Math.random() - 0.5) * this.size;
    const z = (Math.random() - 0.5) * this.size;
    const o = i * 6;
    this.pos.set([x, y, z, x + 0.15, y - 1.1, z + 0.05], o);
  }

  update(dt: number, camera: THREE.Camera): void {
    this.object.position.set(camera.position.x, camera.position.y - this.height / 2, camera.position.z);
    const fall = 32 * dt;
    for (let i = 0; i < this.count; i++) {
      const o = i * 6;
      this.pos[o + 1]! -= fall;
      this.pos[o + 4]! -= fall;
      if (this.pos[o + 4]! < 0) this.place(i, this.height);
    }
    (this.object.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}
