import { stickValue, tiltSteer } from "@apex/shared";

/** What the on-screen controls currently press; read by `Input`. */
export interface TouchState {
  steer: number;
  throttle: number;
  brake: number;
  drift: boolean;
  nitro: boolean;
  item: boolean;
  reset: boolean;
}

const onScreen = new Set<TouchControls>();

/** The touch controls on screen right now (null on desktop). */
export function activeTouch(): TouchState | null {
  for (const t of onScreen) return t.state;
  return null;
}

/** Touch screen without mouse, or forced with ?touch=1. */
export function wantsTouch(): boolean {
  const forced = new URLSearchParams(location.search).get("touch");
  if (forced !== null) return forced !== "0";
  return window.matchMedia?.("(pointer: coarse)").matches === true && navigator.maxTouchPoints > 0;
}

const TILT_KEY = "apexrush.tilt";

/** Keep getting the moves of this finger even when it slides off the control. */
function capture(el: HTMLElement, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    // pointer already gone (or synthetic) – fine
  }
}

/**
 * On-screen controls for phones: a thumb stick on the left (steering), buttons on the right
 * (gas, brake, drift, nitro, item) and a small reset button. Tilt steering can be switched on.
 */
export class TouchControls {
  readonly state: TouchState = { steer: 0, throttle: 0, brake: 0, drift: false, nitro: false, item: false, reset: false };
  private readonly el: HTMLElement;
  private readonly knob: HTMLElement;
  private stickPointer: number | null = null;
  private stickCentre = { x: 0, y: 0 };
  private tilt = false;
  private tiltValue = 0;

  static maybeCreate(ui: HTMLElement, opts: { item?: boolean } = {}): TouchControls | null {
    return wantsTouch() ? new TouchControls(ui, opts.item ?? false) : null;
  }

  constructor(ui: HTMLElement, withItem: boolean) {
    this.el = document.createElement("div");
    this.el.className = "touch";
    this.el.dataset.testid = "touch-controls";
    this.el.innerHTML = `
      <div class="t-stick" data-testid="touch-stick"><div class="t-knob"></div></div>
      <div class="t-buttons">
        <button type="button" class="t-btn t-gas" data-k="throttle" data-testid="touch-gas" aria-label="Gas">GAS</button>
        <button type="button" class="t-btn t-brake" data-k="brake" aria-label="Bremse">◼</button>
        <button type="button" class="t-btn t-drift" data-k="drift" data-testid="touch-drift" aria-label="Drift">DRIFT</button>
        <button type="button" class="t-btn t-nitro" data-k="nitro" aria-label="Nitro">N₂O</button>
        ${withItem ? `<button type="button" class="t-btn t-item" data-k="item" aria-label="Item">ITEM</button>` : ""}
      </div>
      <button type="button" class="t-small t-reset" data-k="reset" aria-label="Zurücksetzen">↺</button>
      <button type="button" class="t-small t-tilt" data-testid="touch-tilt" aria-label="Neigungssteuerung">📱</button>`;
    ui.appendChild(this.el);
    this.knob = this.el.querySelector(".t-knob")!;
    const stick = this.el.querySelector<HTMLElement>(".t-stick")!;

    stick.addEventListener("pointerdown", (e) => {
      this.stickPointer = e.pointerId;
      capture(stick, e.pointerId);
      const r = stick.getBoundingClientRect();
      this.stickCentre = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      this.moveStick(e.clientX, e.clientY, r.width / 2);
      e.preventDefault();
    });
    stick.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.stickPointer) return;
      this.moveStick(e.clientX, e.clientY, stick.getBoundingClientRect().width / 2);
    });
    const release = (e: PointerEvent): void => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.state.steer = this.tilt ? this.tiltValue : 0;
      this.knob.style.transform = "";
    };
    stick.addEventListener("pointerup", release);
    stick.addEventListener("pointercancel", release);

    this.el.querySelectorAll<HTMLElement>("[data-k]").forEach((b) => {
      const k = b.dataset.k as keyof TouchState;
      const set = (on: boolean): void => {
        if (k === "throttle" || k === "brake") this.state[k] = on ? 1 : 0;
        else (this.state as unknown as Record<string, boolean>)[k] = on;
        b.classList.toggle("on", on);
      };
      b.addEventListener("pointerdown", (e) => {
        capture(b, e.pointerId);
        set(true);
        e.preventDefault();
      });
      b.addEventListener("pointerup", () => set(false));
      b.addEventListener("pointercancel", () => set(false));
      b.addEventListener("contextmenu", (e) => e.preventDefault());
    });

    const tiltBtn = this.el.querySelector<HTMLButtonElement>(".t-tilt")!;
    tiltBtn.onclick = () => void this.setTilt(!this.tilt);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(TILT_KEY);
    } catch {
      // ignore
    }
    if (stored === "1") void this.setTilt(true);
    onScreen.add(this);
  }

  private moveStick(x: number, y: number, radius: number): void {
    const dx = x - this.stickCentre.x;
    const dy = y - this.stickCentre.y;
    const v = stickValue(dx, dy, radius);
    this.state.steer = v.x;
    const len = Math.min(radius, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    this.knob.style.transform = `translate(${Math.cos(a) * len * 0.6}px, ${Math.sin(a) * len * 0.6}px)`;
  }

  private readonly onOrientation = (e: DeviceOrientationEvent): void => {
    // landscape: left/right tilt is beta, sign depends on which way the phone is turned
    const angle = window.screen?.orientation?.angle ?? 0;
    const raw = angle === 90 ? (e.beta ?? 0) : angle === 270 || angle === -90 ? -(e.beta ?? 0) : (e.gamma ?? 0);
    this.tiltValue = tiltSteer(raw);
    if (this.stickPointer === null) this.state.steer = this.tiltValue;
  };

  private async setTilt(on: boolean): Promise<void> {
    if (on) {
      // iOS asks for permission; other browsers just deliver the events
      const req = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
      if (req) {
        try {
          if ((await req()) !== "granted") return;
        } catch {
          return;
        }
      }
      window.addEventListener("deviceorientation", this.onOrientation);
    } else {
      window.removeEventListener("deviceorientation", this.onOrientation);
      if (this.stickPointer === null) this.state.steer = 0;
    }
    this.tilt = on;
    this.el.classList.toggle("tilt-on", on);
    try {
      localStorage.setItem(TILT_KEY, on ? "1" : "0");
    } catch {
      // ignore
    }
  }

  dispose(): void {
    window.removeEventListener("deviceorientation", this.onOrientation);
    this.el.remove();
    onScreen.delete(this);
  }
}
