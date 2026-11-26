/** Pure helpers for touch and gamepad input (the DOM part lives in the client). */

/**
 * Virtual thumb stick: finger offset from the stick centre (px) → value in −1…1 per axis,
 * clamped to the circle, with a dead zone and a slightly soft curve near the centre.
 */
export function stickValue(dx: number, dy: number, radius: number, dead = 0.12): { x: number; y: number } {
  const len = Math.hypot(dx, dy);
  if (radius <= 0 || len / radius < dead) return { x: 0, y: 0 };
  const mag = Math.min(1, (len / radius - dead) / (1 - dead));
  const curved = mag ** 1.3;
  return { x: (dx / len) * curved, y: (dy / len) * curved };
}

/**
 * Tilt steering from the device's left/right tilt in degrees (DeviceOrientation `gamma`,
 * or `beta` in landscape): ±maxAngle gives full lock, small wobbles are ignored.
 */
export function tiltSteer(angle: number, maxAngle = 28, dead = 3): number {
  const a = Math.abs(angle);
  if (!Number.isFinite(angle) || a < dead) return 0;
  return Math.sign(angle) * Math.min(1, (a - dead) / (maxAngle - dead));
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type NavDir = "up" | "down" | "left" | "right";

/**
 * Spatial menu navigation: from the element at `from`, pick the nearest element whose centre lies
 * in direction `dir`. Elements in the same row (left/right) or column (up/down) come first;
 * otherwise distance along the direction counts double and the sideways offset once.
 * Returns `from` if nothing lies that way (or −1 → 0 when nothing was focused yet).
 */
export function navigate(rects: Rect[], from: number, dir: NavDir): number {
  if (!rects.length) return -1;
  if (from < 0 || from >= rects.length) return 0;
  const src = rects[from]!;
  const horizontal = dir === "left" || dir === "right";
  const c = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const a = c(src);
  let best = from;
  let bestScore = Infinity;
  rects.forEach((r, i) => {
    if (i === from) return;
    const b = c(r);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const along = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
    if (along <= 4) return;
    // same row (for left/right) or same column (for up/down) wins over everything else
    const overlap = horizontal ? Math.min(src.y + src.h, r.y + r.h) - Math.max(src.y, r.y) : Math.min(src.x + src.w, r.x + r.w) - Math.max(src.x, r.x);
    const side = horizontal ? Math.abs(dy) : Math.abs(dx);
    const score = (overlap > 0 ? 0 : 1e6) + along * 2 + side;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** Direction from a gamepad: d-pad buttons 12–15 or the left stick (with a firm threshold). */
export function padDirection(buttons: boolean[], axes: number[]): NavDir | null {
  if (buttons[12]) return "up";
  if (buttons[13]) return "down";
  if (buttons[14]) return "left";
  if (buttons[15]) return "right";
  const x = axes[0] ?? 0;
  const y = axes[1] ?? 0;
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.6) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "down" : "up";
}

/** Key repeat for held directions: first step at once, then after 0.35 s every 0.12 s. */
export class RepeatGate {
  private held: string | null = null;
  private t = 0;
  private fired = 0;

  next(key: string | null, dt: number): boolean {
    if (key !== this.held) {
      this.held = key;
      this.t = 0;
      this.fired = 0;
      return key !== null;
    }
    if (key === null) return false;
    this.t += dt;
    const due = this.t >= 0.35 + this.fired * 0.12;
    if (due) this.fired++;
    return due;
  }
}
