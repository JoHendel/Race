import type * as THREE from "three";

/** Frame statistics for `?fps`: frames per second, frame time and what the GPU had to draw. */
export interface FrameStats {
  fps: number;
  ms: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export class PerfStats {
  readonly stats: FrameStats = { fps: 0, ms: 0, calls: 0, triangles: 0, geometries: 0, textures: 0 };
  private readonly el: HTMLElement | null;
  private frames = 0;
  private acc = 0;
  private worst = 0;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    show: boolean,
  ) {
    // count all passes of the composer together, reset once per frame
    renderer.info.autoReset = false;
    this.el = show ? document.createElement("div") : null;
    if (this.el) {
      this.el.className = "perf";
      this.el.dataset.testid = "perf";
      document.body.appendChild(this.el);
    }
  }

  /** Call once per frame after rendering. */
  frame(dt: number): void {
    const info = this.renderer.info;
    this.frames++;
    this.acc += dt;
    this.worst = Math.max(this.worst, dt);
    if (this.acc >= 0.5) {
      const s = this.stats;
      s.fps = Math.round(this.frames / this.acc);
      s.ms = +((this.acc / this.frames) * 1000).toFixed(1);
      s.calls = info.render.calls;
      s.triangles = info.render.triangles;
      s.geometries = info.memory.geometries;
      s.textures = info.memory.textures;
      if (this.el) this.el.textContent = `${s.fps} FPS · ${s.ms} ms (max ${(this.worst * 1000).toFixed(0)}) · ${s.calls} draws · ${(s.triangles / 1000).toFixed(0)}k tris · ${s.geometries} geo · ${s.textures} tex`;
      this.frames = 0;
      this.acc = 0;
      this.worst = 0;
    }
    info.reset();
  }
}
