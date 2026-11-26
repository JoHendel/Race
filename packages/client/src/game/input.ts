import type { ControlState } from "@apex/sim";

export type { ControlState };

const KEYS = {
  throttle: ["KeyW", "ArrowUp"],
  brake: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  drift: ["Space"],
  nitro: ["ShiftLeft", "ShiftRight"],
  reset: ["KeyR"],
  item: ["KeyE"],
};

/** Liest Tastatur und Gamepad und liefert einen gemeinsamen Steuerzustand. */
export class Input {
  private pressed = new Set<string>();
  /** Für Tests und Bots: überschreibt die echte Eingabe, solange gesetzt. */
  override: Partial<ControlState> | null = null;
  private smoothSteer = 0;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => {
      if (Object.values(KEYS).some((k) => k.includes(e.code))) e.preventDefault();
      this.pressed.add(e.code);
    });
    target.addEventListener("keyup", (e) => this.pressed.delete(e.code));
    target.addEventListener("blur", () => this.pressed.clear());
  }

  private any(codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c));
  }

  read(dt: number): ControlState {
    let throttle = this.any(KEYS.throttle) ? 1 : 0;
    let brake = this.any(KEYS.brake) ? 1 : 0;
    let steerTarget = (this.any(KEYS.right) ? 1 : 0) - (this.any(KEYS.left) ? 1 : 0);
    let drift = this.any(KEYS.drift);
    let nitro = this.any(KEYS.nitro);
    let reset = this.any(KEYS.reset);
    let item = this.any(KEYS.item);

    const pad = navigator.getGamepads?.().find((g) => g && g.connected);
    if (pad) {
      const axis = pad.axes[0] ?? 0;
      if (Math.abs(axis) > 0.12) steerTarget = axis;
      throttle = Math.max(throttle, pad.buttons[7]?.value ?? 0);
      brake = Math.max(brake, pad.buttons[6]?.value ?? 0);
      drift ||= pad.buttons[0]?.pressed ?? false;
      nitro ||= pad.buttons[2]?.pressed ?? false;
      reset ||= pad.buttons[3]?.pressed ?? false;
      item ||= pad.buttons[1]?.pressed ?? false;
    }

    // Tastatur-Lenkung weich einblenden, damit das Auto nicht zuckt.
    const rate = steerTarget === 0 ? 8 : 5;
    this.smoothSteer += (steerTarget - this.smoothSteer) * Math.min(1, rate * dt);
    if (Math.abs(this.smoothSteer) < 0.01 && steerTarget === 0) this.smoothSteer = 0;

    const state: ControlState = { throttle, brake, steer: this.smoothSteer, drift, nitro, reset, item };
    return this.override ? { ...state, ...this.override } : state;
  }
}
