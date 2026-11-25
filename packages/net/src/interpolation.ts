/** Puffer für Zustände eines entfernten Autos. Gerendert wird leicht in der Vergangenheit, damit es flüssig aussieht. */
export interface TimedState {
  time: number;
  p: [number, number, number];
  q: [number, number, number, number];
}

export const INTERPOLATION_DELAY = 0.1;

export class SnapshotBuffer {
  private readonly buf: TimedState[] = [];

  push(state: TimedState): void {
    const last = this.buf[this.buf.length - 1];
    if (last && state.time <= last.time) return;
    this.buf.push(state);
    if (this.buf.length > 30) this.buf.shift();
  }

  /** Zustand zum Zeitpunkt `time` (linear für Position, normiertes Lerp für Rotation). */
  sample(time: number): TimedState | null {
    const b = this.buf;
    if (b.length === 0) return null;
    if (time <= b[0]!.time) return b[0]!;
    for (let i = 1; i < b.length; i++) {
      const a = b[i - 1]!;
      const c = b[i]!;
      if (time <= c.time) {
        const k = (time - a.time) / (c.time - a.time);
        return { time, p: lerp3(a.p, c.p, k), q: nlerpQuat(a.q, c.q, k) };
      }
    }
    return b[b.length - 1]!;
  }
}

function lerp3(a: [number, number, number], b: [number, number, number], k: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function nlerpQuat(
  a: [number, number, number, number],
  b: [number, number, number, number],
  k: number,
): [number, number, number, number] {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = dot < 0 ? -1 : 1;
  const q: [number, number, number, number] = [
    a[0] + (s * b[0] - a[0]) * k,
    a[1] + (s * b[1] - a[1]) * k,
    a[2] + (s * b[2] - a[2]) * k,
    a[3] + (s * b[3] - a[3]) * k,
  ];
  const len = Math.hypot(...q) || 1;
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}
