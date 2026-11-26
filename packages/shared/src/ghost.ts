/**
 * Ghost of a lap: position and heading every GHOST_STEP seconds, encoded compactly
 * (16-bit fixed point relative to the first sample) so it fits into localStorage.
 */
export const GHOST_STEP = 0.1;

export interface GhostSample {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface Ghost {
  trackId: string;
  lapTime: number;
  samples: GhostSample[];
}

/** Records one lap; call `add` every physics step with the time since the lap started. */
export class GhostRecorder {
  samples: GhostSample[] = [];
  private next = 0;

  add(t: number, s: GhostSample): void {
    if (t + 1e-9 < this.next) return;
    this.samples.push({ ...s });
    this.next = this.samples.length * GHOST_STEP;
  }

  reset(): void {
    this.samples = [];
    this.next = 0;
  }
}

/** Pose of a ghost at time `t` (interpolated); the last pose after the end. */
export function ghostPose(g: Ghost, t: number): GhostSample | null {
  const n = g.samples.length;
  if (!n) return null;
  const f = Math.max(0, t / GHOST_STEP);
  const i = Math.min(n - 1, Math.floor(f));
  const a = g.samples[i]!;
  const b = g.samples[Math.min(n - 1, i + 1)]!;
  const k = Math.min(1, f - i);
  let dy = b.yaw - a.yaw;
  if (dy > Math.PI) dy -= Math.PI * 2;
  if (dy < -Math.PI) dy += Math.PI * 2;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, yaw: a.yaw + dy * k };
}

const POS_SCALE = 50; // 2 cm
const YAW_SCALE = 10000;

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Encode a ghost: each sample as the delta to the previous one (int16 x, y, z, yaw). */
export function encodeGhost(g: Ghost): string {
  const n = g.samples.length;
  const buf = new Int16Array(Math.max(0, n * 4));
  let px = 0;
  let py = 0;
  let pz = 0;
  let pyaw = 0;
  const first = g.samples[0] ?? { x: 0, y: 0, z: 0, yaw: 0 };
  g.samples.forEach((s, i) => {
    const qx = Math.round((s.x - first.x) * POS_SCALE);
    const qy = Math.round((s.y - first.y) * POS_SCALE);
    const qz = Math.round((s.z - first.z) * POS_SCALE);
    const qyaw = Math.round(Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw)) * YAW_SCALE);
    buf[i * 4] = clamp16(qx - px);
    buf[i * 4 + 1] = clamp16(qy - py);
    buf[i * 4 + 2] = clamp16(qz - pz);
    buf[i * 4 + 3] = clamp16(qyaw - pyaw);
    px += buf[i * 4]!;
    py += buf[i * 4 + 1]!;
    pz += buf[i * 4 + 2]!;
    pyaw += buf[i * 4 + 3]!;
  });
  return JSON.stringify({ v: 1, t: g.trackId, l: g.lapTime, o: [first.x, first.y, first.z], d: toBase64(new Uint8Array(buf.buffer)) });
}

export function decodeGhost(text: string | null): Ghost | null {
  if (!text) return null;
  try {
    const j = JSON.parse(text) as { v: number; t: string; l: number; o: [number, number, number]; d: string };
    if (j.v !== 1 || typeof j.l !== "number") return null;
    const bytes = fromBase64(j.d);
    const buf = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.length / 2));
    const samples: GhostSample[] = [];
    let x = 0;
    let y = 0;
    let z = 0;
    let yaw = 0;
    for (let i = 0; i + 3 < buf.length; i += 4) {
      x += buf[i]!;
      y += buf[i + 1]!;
      z += buf[i + 2]!;
      yaw += buf[i + 3]!;
      samples.push({ x: j.o[0] + x / POS_SCALE, y: j.o[1] + y / POS_SCALE, z: j.o[2] + z / POS_SCALE, yaw: yaw / YAW_SCALE });
    }
    return { trackId: j.t, lapTime: j.l, samples };
  } catch {
    return null;
  }
}

function clamp16(v: number): number {
  return Math.max(-32768, Math.min(32767, v));
}

/**
 * Drift challenge score for one physics step: only while drifting at speed;
 * a steeper drift angle (slip between heading and velocity) gives more points.
 */
export function driftPoints(dt: number, slipAngle: number, speed: number, drifting: boolean): number {
  if (!drifting || speed < 8) return 0;
  const angle = Math.min(Math.abs(slipAngle), 1.2); // rad, capped
  const angleFactor = 0.3 + (angle / 1.2) * 1.7;
  const speedFactor = Math.min(1.5, speed / 25);
  return dt * 250 * angleFactor * speedFactor;
}

/** Combo multiplier: grows with the length of the current drift. */
export function driftCombo(driftSeconds: number): number {
  return 1 + Math.min(2, Math.floor(driftSeconds / 1.5) * 0.5);
}
