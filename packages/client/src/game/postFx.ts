import * as THREE from "three";
import type { TrackEnvironment } from "@apex/shared";

/** Post-processing settings of a scene: bloom and a simple colour grade. */
export interface PostFx {
  bloom: number;
  threshold: number;
  saturation: number;
  contrast: number;
  /** Colour multiplier (warm/cold tint). */
  tint: number;
  vignette: number;
}

export const DEFAULT_POST_FX: PostFx = { bloom: 0.65, threshold: 0.55, saturation: 1.05, contrast: 1.03, tint: 0xffffff, vignette: 0.25 };

/** Look per track: neon night glows more, daylight tracks less. */
export const POST_FX: Record<TrackEnvironment["scenery"], PostFx> = {
  harbor: { ...DEFAULT_POST_FX, bloom: 0.75, saturation: 1.12 },
  city: { ...DEFAULT_POST_FX, bloom: 0.8, saturation: 1.15, tint: 0xf2eaff },
  desert: { ...DEFAULT_POST_FX, bloom: 0.5, threshold: 0.62, saturation: 1.1, contrast: 1.06, tint: 0xfff0e0 },
  glacier: { ...DEFAULT_POST_FX, bloom: 0.55, threshold: 0.6, saturation: 0.95, tint: 0xe6f6ff },
  jungle: { ...DEFAULT_POST_FX, bloom: 0.5, threshold: 0.62, saturation: 1.1, tint: 0xf4ffe8 },
  volcano: { ...DEFAULT_POST_FX, bloom: 0.7, saturation: 1.1, contrast: 1.08, tint: 0xffe8e0 },
  orbital: { ...DEFAULT_POST_FX, bloom: 0.7, saturation: 1.05, tint: 0xe8f0ff, vignette: 0.35 },
  circuit: { ...DEFAULT_POST_FX, bloom: 0.45, threshold: 0.65, saturation: 1.05, contrast: 1.05 },
};

/** Colour grade shader (saturation, contrast, tint, vignette) for an EffectComposer ShaderPass. */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    saturation: { value: 1 },
    contrast: { value: 1 },
    tint: { value: new THREE.Color(0xffffff) },
    vignette: { value: 0.25 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float saturation; uniform float contrast; uniform vec3 tint; uniform float vignette; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      vec3 col = mix(vec3(l), c.rgb, saturation);
      col = (col - 0.18) * contrast + 0.18;
      col *= tint;
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - vignette * smoothstep(0.35, 0.85, d);
      gl_FragColor = vec4(max(col, 0.0), c.a); }`,
};
