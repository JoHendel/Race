import { cssColor, driftLevel } from "@apex/shared";
import type { Car } from "./car";

const LEVEL_COLORS = ["white", "cyan", "orange", "violet"] as const;

/** Fahr-HUD: Tacho, Nitro-Leiste und Drift-Anzeige. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly speed: HTMLElement;
  private readonly nitroFill: HTMLElement;
  private readonly drift: HTMLElement;
  private readonly toast: HTMLElement;
  private toastTimer = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "hud";
    this.root.innerHTML = `
      <div class="hud-speed" data-testid="speed"><span class="value">0</span><span class="unit">km/h</span></div>
      <div class="hud-nitro"><div class="label">NITRO</div><div class="bar"><div class="fill"></div></div></div>
      <div class="hud-drift"></div>
      <div class="hud-toast"></div>
      <div class="hud-help">W/S Gas/Bremse · A/D Lenken · Leertaste Drift · Shift Nitro · R Zurücksetzen</div>
    `;
    parent.appendChild(this.root);
    this.speed = this.root.querySelector(".hud-speed .value")!;
    this.nitroFill = this.root.querySelector(".hud-nitro .fill")!;
    this.drift = this.root.querySelector(".hud-drift")!;
    this.toast = this.root.querySelector(".hud-toast")!;
  }

  showToast(text: string, color: (typeof LEVEL_COLORS)[number] = "white"): void {
    this.toast.textContent = text;
    this.toast.style.color = cssColor(color);
    this.toast.classList.remove("pop");
    void this.toast.offsetWidth;
    this.toast.classList.add("pop");
    this.toastTimer = 1.2;
  }

  update(car: Car, dt: number): void {
    this.speed.textContent = String(Math.round(Math.abs(car.speed) * 3.6));
    this.nitroFill.style.width = `${Math.round(car.nitro.fraction * 100)}%`;
    this.nitroFill.classList.toggle("active", car.nitroActive);

    const level = car.drifting ? driftLevel(car.driftTime) : 0;
    this.drift.textContent = car.drifting ? `DRIFT ${"▮".repeat(level)}${"▯".repeat(3 - level)}` : "";
    this.drift.style.color = cssColor(LEVEL_COLORS[level]!);

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.textContent = "";
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
