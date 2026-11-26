import * as THREE from "three";
import { replayPose, type HighlightSegment, type Replay } from "@apex/shared";
import { afterNextFrame } from "./frameHooks";

export interface ReplayCar {
  id: string;
  name: string;
  mesh: THREE.Object3D;
}

type CamMode = "chase" | "orbit" | "free";

const SPEEDS = [1, 0.5, 0.25];
const CAPTIONS: Record<HighlightSegment["kind"], string> = {
  overtake: "KNAPPSTE ÜBERHOLUNG",
  drift: "LÄNGSTER DRIFT",
  jump: "GRÖSSTER SPRUNG",
};

/**
 * Plays back a recorded race: chase, orbit or free camera, slow motion, pause,
 * scrubbing and PNG screenshots. In highlight mode it runs through the given segments
 * and closes itself at the end.
 */
export class ReplayView {
  t = 0;
  paused = false;
  speedIndex = 0;
  focus: number;
  camMode: CamMode = "chase";
  private segIndex = 0;
  private readonly el: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly scrub: HTMLInputElement | null;
  private readonly yaw0 = new Map<string, number>();
  private orbitYaw = 0.6;
  private orbitPitch = 0.35;
  private orbitDist = 12;
  private readonly freePos = new THREE.Vector3();
  private freeYaw = 0;
  private freePitch = -0.2;
  private readonly keys = new Set<string>();
  private drag: { x: number; y: number } | null = null;
  private readonly camPos = new THREE.Vector3();
  private readonly camLook = new THREE.Vector3();
  private camInit = false;
  private shots = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly replay: Replay,
    private readonly cars: ReplayCar[],
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    ui: HTMLElement,
    focusId: string,
    private readonly onExit: () => void,
    private readonly segments: HighlightSegment[] | null = null,
  ) {
    this.focus = Math.max(0, cars.findIndex((c) => c.id === focusId));
    for (const c of cars) this.yaw0.set(c.id, c.mesh.rotation.y);
    if (segments?.length) this.startSegment(0);
    this.el = document.createElement("div");
    this.el.className = "replay";
    this.el.dataset.testid = segments ? "highlights" : "replay";
    this.el.innerHTML = segments
      ? `<div class="replay-tag">HIGHLIGHTS</div><div class="replay-caption"></div>
         <div class="replay-bar"><button class="btn btn-ghost small" data-act="exit">Überspringen</button></div>`
      : `<div class="replay-tag">REPLAY</div><div class="replay-caption"></div>
         <div class="replay-bar">
           <button class="btn btn-ghost small" data-act="play" title="Leertaste">❚❚</button>
           <input type="range" min="0" max="${replay.duration.toFixed(1)}" step="0.1" value="0" data-act="scrub" aria-label="Zeit" />
           <button class="btn btn-ghost small" data-act="speed" title="S">1×</button>
           <button class="btn btn-ghost small" data-act="prev" title="Q">◀</button>
           <span class="replay-name"></span>
           <button class="btn btn-ghost small" data-act="next" title="E">▶</button>
           <button class="btn btn-ghost small" data-act="cam" title="C">Kamera: Verfolger</button>
           <button class="btn btn-ghost small" data-act="shot" data-testid="screenshot" title="P">📷 Foto</button>
           <button class="btn btn-ghost small" data-act="exit">Schließen</button>
         </div>
         <div class="replay-help">Leertaste Pause · S Zeitlupe · Q/E Fahrer · C Kamera · Maus ziehen dreht · Freie Kamera: W/A/S/D, R/F hoch/runter · P Foto</div>`;
    ui.appendChild(this.el);
    this.caption = this.el.querySelector(".replay-caption")!;
    this.scrub = this.el.querySelector<HTMLInputElement>("[data-act=scrub]");
    this.el.querySelectorAll<HTMLElement>("[data-act]").forEach((b) => {
      if (b.dataset.act === "scrub") {
        b.oninput = () => (this.t = Number((b as HTMLInputElement).value));
        return;
      }
      b.onclick = () => this.action(b.dataset.act!);
    });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: true });
    this.renderUi();
  }

  get highlightMode(): boolean {
    return this.segments !== null;
  }

  private startSegment(i: number): void {
    this.segIndex = i;
    const seg = this.segments![i]!;
    this.t = seg.start;
    this.focus = Math.max(0, this.cars.findIndex((c) => c.id === seg.carId));
    this.camInit = false;
    // alternate between chase and orbit for a bit of variety
    this.camMode = i % 2 === 0 ? "chase" : "orbit";
    this.orbitYaw = 0.9 + i;
  }

  private action(act: string): void {
    if (act === "exit") return this.close();
    if (act === "play") this.paused = !this.paused;
    if (act === "speed") this.speedIndex = (this.speedIndex + 1) % SPEEDS.length;
    if (act === "next") this.focus = (this.focus + 1) % this.cars.length;
    if (act === "prev") this.focus = (this.focus + this.cars.length - 1) % this.cars.length;
    if (act === "cam") {
      this.camMode = this.camMode === "chase" ? "orbit" : this.camMode === "orbit" ? "free" : "chase";
      if (this.camMode === "free") {
        this.freePos.copy(this.camera.position);
        const d = this.camera.getWorldDirection(this.tmp);
        this.freeYaw = Math.atan2(d.x, d.z);
        this.freePitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
      }
    }
    if (act === "shot") this.screenshot();
    if (act === "next" || act === "prev") this.camInit = false;
    this.renderUi();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement && e.target.type !== "range") return;
    const map: Record<string, string> = { Space: "play", KeyS: "speed", KeyQ: "prev", KeyE: "next", KeyC: "cam", KeyP: "shot", Escape: "exit" };
    if (this.camMode === "free" && ["KeyW", "KeyA", "KeyS", "KeyD", "KeyR", "KeyF"].includes(e.code)) {
      this.keys.add(e.code);
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    const act = this.highlightMode ? (e.code === "Escape" || e.code === "Space" || e.code === "Enter" ? "exit" : undefined) : map[e.code];
    if (!act) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.action(act);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    this.drag = { x: e.clientX, y: e.clientY };
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.drag) return;
    const dx = (e.clientX - this.drag.x) * 0.005;
    const dy = (e.clientY - this.drag.y) * 0.005;
    this.drag = { x: e.clientX, y: e.clientY };
    if (this.camMode === "free") {
      this.freeYaw -= dx;
      this.freePitch = THREE.MathUtils.clamp(this.freePitch - dy, -1.4, 1.4);
    } else {
      if (this.camMode === "chase") this.camMode = "orbit";
      this.orbitYaw -= dx;
      this.orbitPitch = THREE.MathUtils.clamp(this.orbitPitch + dy, 0.05, 1.4);
      this.renderUi();
    }
  };

  private readonly onPointerUp = (): void => {
    this.drag = null;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    this.orbitDist = THREE.MathUtils.clamp(this.orbitDist * (e.deltaY > 0 ? 1.1 : 0.9), 4, 60);
  };

  private renderUi(): void {
    if (this.highlightMode) return;
    const play = this.el.querySelector<HTMLElement>("[data-act=play]")!;
    play.textContent = this.paused ? "▶" : "❚❚";
    this.el.querySelector<HTMLElement>("[data-act=speed]")!.textContent = `${SPEEDS[this.speedIndex]}×`;
    this.el.querySelector<HTMLElement>(".replay-name")!.textContent = this.cars[this.focus]?.name ?? "";
    const camName = { chase: "Verfolger", orbit: "Orbit", free: "Frei" }[this.camMode];
    this.el.querySelector<HTMLElement>("[data-act=cam]")!.textContent = `Kamera: ${camName}`;
  }

  /** Save the current picture (3D view only, without UI) as PNG. */
  screenshot(): void {
    afterNextFrame(() => {
      const url = this.canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `apex-rush-${String(++this.shots).padStart(2, "0")}.png`;
      a.click();
      this.caption.textContent = "FOTO GESPEICHERT";
      this.caption.classList.add("show");
      window.setTimeout(() => this.caption.classList.remove("show"), 1200);
    });
  }

  update(dt: number): void {
    const speed = SPEEDS[this.speedIndex]!;
    if (this.highlightMode) {
      const seg = this.segments![this.segIndex];
      if (!seg) return this.close();
      // slow motion in the middle of each highlight
      const mid = (this.t - seg.start) / Math.max(0.1, seg.end - seg.start);
      const slow = mid > 0.35 && mid < 0.75 ? 0.4 : 1;
      this.t += dt * slow;
      this.caption.textContent = CAPTIONS[seg.kind];
      this.caption.classList.add("show");
      if (this.t >= seg.end) {
        if (this.segIndex + 1 >= this.segments!.length) return this.close();
        this.startSegment(this.segIndex + 1);
      }
    } else if (!this.paused) {
      this.t = Math.min(this.replay.duration, this.t + dt * speed);
      if (this.scrub) this.scrub.value = this.t.toFixed(1);
    }
    for (const c of this.cars) {
      const p = replayPose(this.replay, c.id, this.t);
      if (!p) continue;
      c.mesh.position.set(p.x, p.y, p.z);
      c.mesh.rotation.set(0, p.yaw, 0);
    }
    this.updateCamera(dt);
  }

  private updateCamera(dt: number): void {
    const target = this.cars[this.focus]?.mesh;
    if (this.camMode === "free" || !target) {
      const move = new THREE.Vector3(
        (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0),
        (this.keys.has("KeyR") ? 1 : 0) - (this.keys.has("KeyF") ? 1 : 0),
        (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0),
      );
      const fwd = new THREE.Vector3(Math.sin(this.freeYaw) * Math.cos(this.freePitch), Math.sin(this.freePitch), Math.cos(this.freeYaw) * Math.cos(this.freePitch));
      const right = new THREE.Vector3(-Math.cos(this.freeYaw), 0, Math.sin(this.freeYaw));
      this.freePos.addScaledVector(fwd, move.z * 30 * dt).addScaledVector(right, move.x * 30 * dt);
      this.freePos.y += move.y * 20 * dt;
      this.camera.position.copy(this.freePos);
      this.camera.lookAt(this.tmp.copy(this.freePos).add(fwd));
      return;
    }
    const yaw = target.rotation.y;
    let desired: THREE.Vector3;
    if (this.camMode === "chase") {
      desired = new THREE.Vector3(target.position.x - Math.sin(yaw) * 8, target.position.y + 3, target.position.z - Math.cos(yaw) * 8);
    } else {
      const a = this.orbitYaw;
      desired = new THREE.Vector3(
        target.position.x + Math.sin(a) * Math.cos(this.orbitPitch) * this.orbitDist,
        target.position.y + 1 + Math.sin(this.orbitPitch) * this.orbitDist,
        target.position.z + Math.cos(a) * Math.cos(this.orbitPitch) * this.orbitDist,
      );
      if (!this.drag && this.highlightMode) this.orbitYaw += dt * 0.3;
    }
    const look = this.tmp.copy(target.position).add(new THREE.Vector3(0, 0.8, 0));
    if (!this.camInit) {
      this.camPos.copy(desired);
      this.camLook.copy(look);
      this.camInit = true;
    }
    const k = this.camMode === "orbit" ? 1 : 1 - Math.exp(-8 * dt);
    this.camPos.lerp(desired, k);
    this.camLook.lerp(look, 1 - Math.exp(-12 * dt));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  close(): void {
    this.dispose();
    this.onExit();
  }

  dispose(): void {
    this.el.remove();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }
}
