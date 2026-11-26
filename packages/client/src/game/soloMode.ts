import * as THREE from "three";
import { GhostRecorder, decodeGhost, driftCombo, driftPoints, encodeGhost, formatTime, ghostPose, type Ghost, type TrackDef } from "@apex/shared";
import type { Car } from "./car";

type Mode = "timetrial" | "drift";

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage full or unavailable – the ghost is just not kept
  }
}

/**
 * Single-player modes on top of a normal race:
 * - time trial: drive against the ghost of the own best lap (stored per track in the browser)
 * - drift challenge: points for drift duration and angle, with a combo for long drifts
 */
export class SoloMode {
  private ghost: Ghost | null = null;
  private ghostMesh: THREE.Object3D | null = null;
  private readonly recorder = new GhostRecorder();
  private bestLap: number | null = null;
  private newRecord = false;
  private score = 0;
  private driftRun = 0;
  private pending = 0;
  private bestScore = 0;
  private lastSpeed = 0;
  private crashFlash = 0;
  private readonly hud: HTMLElement | null = null;
  private readonly tmp = new THREE.Vector3();

  constructor(
    readonly mode: Mode,
    private readonly track: TrackDef,
    private readonly scene: THREE.Scene,
    ui: HTMLElement,
    private readonly car: Car,
  ) {
    if (mode === "timetrial") {
      this.ghost = decodeGhost(load(this.ghostKey));
      if (this.ghost?.trackId !== track.id) this.ghost = null;
      this.bestLap = this.ghost?.lapTime ?? null;
      this.ghostMesh = this.makeGhostMesh();
      scene.add(this.ghostMesh);
    } else {
      this.bestScore = Number(load(this.driftKey) ?? 0) || 0;
      this.hud = document.createElement("div");
      this.hud.className = "drift-score";
      this.hud.dataset.testid = "drift-score";
      ui.appendChild(this.hud);
      this.renderScore();
    }
  }

  /** Best lap of the time trial (stored ghost or this session), else null. */
  get bestLapTime(): number | null {
    return this.mode === "timetrial" ? this.bestLap : null;
  }

  private get ghostKey(): string {
    return `apexrush.ghost.${this.track.id}`;
  }

  private get driftKey(): string {
    return `apexrush.drift.${this.track.id}`;
  }

  /** A see-through copy of the player's car. */
  private makeGhostMesh(): THREE.Object3D {
    const m = this.car.mesh.clone(true);
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const ghostMats = mats.map((mat) => {
        const c = (mat as THREE.Material).clone() as THREE.MeshStandardMaterial;
        c.transparent = true;
        c.opacity = 0.45;
        c.depthWrite = false;
        if ("emissive" in c) {
          c.emissive = new THREE.Color(0x66e8ff);
          c.emissiveIntensity = 0.9;
        }
        return c;
      });
      mesh.material = Array.isArray(mesh.material) ? ghostMats : ghostMats[0]!;
      mesh.castShadow = false;
    });
    m.visible = false;
    return m;
  }

  /** Every physics step while racing. `lapTime` = seconds since the current lap started. */
  step(lapTime: number, dt: number): void {
    const p = this.car.body.translation();
    const f = this.car.forward(this.tmp);
    if (this.mode === "timetrial") {
      this.recorder.add(lapTime, { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(f.x, f.z) });
      return;
    }
    // drift challenge
    const v = this.car.body.linvel();
    const speed = Math.hypot(v.x, v.z);
    const slip = speed > 1 ? Math.acos(Math.max(-1, Math.min(1, (f.x * v.x + f.z * v.z) / (Math.hypot(f.x, f.z) * speed)))) : 0;
    const crashed = this.lastSpeed > 10 && speed < this.lastSpeed * 0.75;
    this.lastSpeed = speed;
    this.crashFlash = Math.max(0, this.crashFlash - dt);
    if (crashed && this.driftRun > 0) {
      // hitting a wall mid-drift loses the points of that drift
      this.pending = 0;
      this.driftRun = 0;
      this.crashFlash = 1.2;
    } else if (this.car.drifting) {
      this.driftRun += dt;
      this.pending += driftPoints(dt, slip, speed, true) * driftCombo(this.driftRun);
    } else if (this.driftRun > 0) {
      // the drift ended: bank the points
      this.score += Math.round(this.pending);
      this.pending = 0;
      this.driftRun = 0;
    }
    this.renderScore();
  }

  private renderScore(): void {
    if (!this.hud) return;
    const live = this.driftRun > 0 ? ` <b>+${Math.round(this.pending)}</b> <i>×${driftCombo(this.driftRun)}</i>` : this.crashFlash > 0 ? ` <b class="lost">CRASH</b>` : "";
    this.hud.innerHTML = `<small>DRIFT</small><span>${this.score.toLocaleString("de-DE")}</span>${live}`;
  }

  /** Every frame: move the ghost along its recorded lap. */
  render(lapTime: number): void {
    if (!this.ghost || !this.ghostMesh) return;
    const pose = ghostPose(this.ghost, lapTime);
    this.ghostMesh.visible = Boolean(pose);
    if (!pose) return;
    this.ghostMesh.position.set(pose.x, pose.y, pose.z);
    this.ghostMesh.rotation.set(0, pose.yaw, 0);
  }

  /** A lap is done. Returns a banner text, or null for the normal lap banner. */
  lapDone(lapTime: number): string | null {
    if (this.mode !== "timetrial") return null;
    const prev = this.bestLap;
    let banner: string;
    if (prev === null || lapTime < prev) {
      this.bestLap = lapTime;
      this.newRecord = true;
      this.ghost = { trackId: this.track.id, lapTime, samples: this.recorder.samples };
      store(this.ghostKey, encodeGhost(this.ghost));
      banner = prev === null ? "BESTZEIT GESPEICHERT" : `NEUE BESTZEIT! −${(prev - lapTime).toFixed(2)} s`;
    } else banner = `+${(lapTime - prev).toFixed(2)} s`;
    this.recorder.reset();
    return banner;
  }

  /** Text for the results screen. */
  summary(): string {
    if (this.mode === "timetrial") {
      const best = this.bestLap === null ? "–" : formatTime(this.bestLap);
      return `Ghost-Bestzeit: <b>${best}</b>${this.newRecord ? ` <em>NEU!</em>` : ""}`;
    }
    this.score += Math.round(this.pending);
    this.pending = 0;
    this.driftRun = 0;
    const record = this.score > this.bestScore;
    if (record) {
      this.bestScore = this.score;
      store(this.driftKey, String(this.score));
    }
    this.renderScore();
    return `Drift-Punkte: <b>${this.score.toLocaleString("de-DE")}</b> · Bestwert: ${this.bestScore.toLocaleString("de-DE")}${record ? ` <em>NEU!</em>` : ""}`;
  }

  dispose(): void {
    this.hud?.remove();
    if (this.ghostMesh) this.scene.remove(this.ghostMesh);
  }
}
