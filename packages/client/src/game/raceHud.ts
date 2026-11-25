import * as THREE from "three";
import { cssColor, formatTime } from "@apex/shared";
import type { SplineTrack } from "./track/splineTrack";

export interface HudRacer {
  name: string;
  color: number;
  pos: THREE.Vector3;
  isPlayer: boolean;
  isAi?: boolean;
}

/** Renn-HUD: Platz, Runde, Zeiten, Minimap, Countdown, Falsche-Richtung-Warnung. */
export class RaceHud {
  private readonly root: HTMLElement;
  private readonly place: HTMLElement;
  private readonly lap: HTMLElement;
  private readonly times: HTMLElement;
  private readonly center: HTMLElement;
  private readonly warning: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly map: CanvasRenderingContext2D;
  private readonly mapPath: Path2D;
  private readonly shortcutPath = new Path2D();
  private readonly mapTransform: (x: number, z: number) => [number, number];
  private bannerTimer = 0;

  constructor(parent: HTMLElement, track: SplineTrack) {
    this.root = document.createElement("div");
    this.root.className = "race-hud";
    this.root.innerHTML = `
      <div class="rh-place" data-testid="place"><span class="n">1</span><span class="of">/10</span></div>
      <div class="rh-lap" data-testid="lap">RUNDE 1/3</div>
      <div class="rh-times"></div>
      <canvas class="rh-map" width="200" height="200"></canvas>
      <div class="rh-center" data-testid="countdown"></div>
      <div class="rh-banner"></div>
      <div class="rh-warning">FALSCHE RICHTUNG</div>
    `;
    parent.appendChild(this.root);
    this.place = this.root.querySelector(".rh-place")!;
    this.lap = this.root.querySelector(".rh-lap")!;
    this.times = this.root.querySelector(".rh-times")!;
    this.center = this.root.querySelector(".rh-center")!;
    this.warning = this.root.querySelector(".rh-warning")!;
    this.banner = this.root.querySelector(".rh-banner")!;
    this.map = this.root.querySelector<HTMLCanvasElement>(".rh-map")!.getContext("2d")!;

    // Minimap-Maßstab aus den Stützpunkten
    const xs = track.samples.map((s) => s.pos.x);
    const zs = track.samples.map((s) => s.pos.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const scale = 170 / Math.max(maxX - minX, maxZ - minZ);
    const ox = (200 - (maxX - minX) * scale) / 2;
    const oz = (200 - (maxZ - minZ) * scale) / 2;
    // Spiegeln, damit die Karte zur Fahrtrichtung passt (rechts im Spiel = rechts auf der Karte).
    this.mapTransform = (x, z) => [200 - (ox + (x - minX) * scale), 200 - (oz + (z - minZ) * scale)];
    this.mapPath = new Path2D();
    track.samples.forEach((s, i) => {
      const [x, y] = this.mapTransform(s.pos.x, s.pos.z);
      if (i === 0) this.mapPath.moveTo(x, y);
      else this.mapPath.lineTo(x, y);
    });
    this.mapPath.closePath();
    for (const c of track.shortcuts) {
      c.samples.forEach((s, i) => {
        const [x, y] = this.mapTransform(s.pos.x, s.pos.z);
        if (i === 0) this.shortcutPath.moveTo(x, y);
        else this.shortcutPath.lineTo(x, y);
      });
    }
  }

  setCountdown(text: string, color = "white"): void {
    this.center.textContent = text;
    this.center.style.color = color;
    this.center.classList.remove("pop");
    void this.center.offsetWidth;
    if (text) this.center.classList.add("pop");
  }

  showBanner(text: string, seconds = 2): void {
    this.banner.textContent = text;
    this.banner.classList.remove("pop");
    void this.banner.offsetWidth;
    this.banner.classList.add("pop");
    this.bannerTimer = seconds;
  }

  update(
    dt: number,
    info: { place: number; total: number; lap: number; laps: number; lapTime: number; best: number | null; wrongWay: boolean },
    racers: HudRacer[],
  ): void {
    this.place.querySelector(".n")!.textContent = String(info.place);
    this.place.querySelector(".of")!.textContent = `/${info.total}`;
    this.lap.textContent = `RUNDE ${Math.min(info.lap + 1, info.laps)}/${info.laps}`;
    this.times.innerHTML = `<div>RUNDE <b>${formatTime(info.lapTime)}</b></div><div>BESTE <b>${formatTime(info.best)}</b></div>`;
    this.warning.classList.toggle("show", info.wrongWay);

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.textContent = "";
    }

    const g = this.map;
    g.clearRect(0, 0, 200, 200);
    g.lineWidth = 6;
    g.strokeStyle = "rgba(255,255,255,0.18)";
    g.stroke(this.mapPath);
    g.lineWidth = 2;
    g.strokeStyle = cssColor("cyan");
    g.stroke(this.mapPath);
    // Shortcuts: dashed orange
    g.setLineDash([4, 4]);
    g.strokeStyle = cssColor("orange");
    g.stroke(this.shortcutPath);
    g.setLineDash([]);
    for (const r of [...racers].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer))) {
      const [x, y] = this.mapTransform(r.pos.x, r.pos.z);
      g.beginPath();
      g.arc(x, y, r.isPlayer ? 6 : 4, 0, Math.PI * 2);
      g.fillStyle = `#${r.color.toString(16).padStart(6, "0")}`;
      g.fill();
      if (r.isPlayer) {
        g.lineWidth = 2;
        g.strokeStyle = "#ffffff";
        g.stroke();
      }
      if (r.isAi) {
        // APEX-AI: gold ring with a small "AI" label
        g.lineWidth = 2;
        g.strokeStyle = "#ffc94d";
        g.beginPath();
        g.arc(x, y, 8, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "#ffc94d";
        g.font = "bold 9px system-ui, sans-serif";
        g.fillText("AI", x + 9, y - 6);
      }
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
