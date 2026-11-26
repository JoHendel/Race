import * as THREE from "three";
import { mulberry32 } from "@apex/sim/pure";

export type SurfaceKind = "asphalt" | "rock" | "ice" | "sand";

/**
 * Procedural normal maps (no external files, no licence questions): a height field from
 * layered value noise, turned into normals with a Sobel filter. Cached per kind.
 */
const cache = new Map<SurfaceKind, THREE.CanvasTexture>();

const PARAMS: Record<SurfaceKind, { scales: number[]; strength: number; ridges?: boolean; dunes?: boolean }> = {
  asphalt: { scales: [64, 32], strength: 2.2 },
  rock: { scales: [6, 12, 24], strength: 3.5, ridges: true },
  ice: { scales: [4, 10], strength: 2.5, ridges: true },
  sand: { scales: [3, 24], strength: 2, dunes: true },
};

export function normalMap(kind: SurfaceKind): THREE.CanvasTexture {
  const hit = cache.get(kind);
  if (hit) return hit;
  const N = 256;
  const p = PARAMS[kind];
  const rnd = mulberry32(kind.length * 977 + 13);
  // tileable value-noise grids
  const grids = p.scales.map((s) => ({ s, v: Array.from({ length: s * s }, () => rnd()) }));
  const sample = (g: { s: number; v: number[] }, x: number, y: number) => {
    const gx = (x / N) * g.s;
    const gy = (y / N) * g.s;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = gx - x0;
    const fy = gy - y0;
    const at = (i: number, j: number) => g.v[(((j % g.s) + g.s) % g.s) * g.s + (((i % g.s) + g.s) % g.s)]!;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return a + (b - a) * sy;
  };
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let v = 0;
      let amp = 1;
      for (const g of grids) {
        let n = sample(g, x, y);
        if (p.ridges) n = 1 - Math.abs(n * 2 - 1);
        v += n * amp;
        amp *= 0.5;
      }
      if (p.dunes) v += 0.6 * Math.sin((y / N) * Math.PI * 2 * 6 + v * 3);
      h[y * N + x] = v;
    }
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(N, N);
  const H = (x: number, y: number) => h[((y + N) % N) * N + ((x + N) % N)]!;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * p.strength;
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * p.strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  cache.set(kind, tex);
  return tex;
}
