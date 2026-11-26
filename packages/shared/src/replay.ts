import { GhostRecorder, ghostPose, type GhostSample } from "./ghost";

/**
 * Race replay: one ghost-style track (pose every 0.1 s) per car on the shared race clock,
 * plus notable moments for the highlight clip.
 */
export type HighlightKind = "overtake" | "drift" | "jump";

export interface ReplayMoment {
  kind: HighlightKind;
  /** Race time when the moment ends (s). */
  t: number;
  carId: string;
  /** Size of the moment: drift seconds, air seconds, or 1 / gap for an overtake. */
  value: number;
}

export interface Replay {
  duration: number;
  cars: Record<string, GhostSample[]>;
  moments: ReplayMoment[];
}

export class ReplayRecorder {
  private readonly cars = new Map<string, GhostRecorder>();
  private readonly moments: ReplayMoment[] = [];
  private last = 0;

  add(carId: string, t: number, s: GhostSample): void {
    let r = this.cars.get(carId);
    if (!r) this.cars.set(carId, (r = new GhostRecorder()));
    r.add(t, s);
    this.last = Math.max(this.last, t);
  }

  moment(m: ReplayMoment): void {
    this.moments.push(m);
  }

  finish(): Replay {
    const cars: Record<string, GhostSample[]> = {};
    for (const [id, r] of this.cars) cars[id] = r.samples;
    return { duration: this.last, cars, moments: [...this.moments] };
  }
}

export function replayPose(replay: Replay, carId: string, t: number): GhostSample | null {
  const samples = replay.cars[carId];
  return samples ? ghostPose({ trackId: "", lapTime: 0, samples }, t) : null;
}

/** Minimum size for a moment to be worth showing. */
const MIN_VALUE: Record<HighlightKind, number> = { drift: 1.5, jump: 0.6, overtake: 0.2 };

export interface HighlightSegment {
  kind: HighlightKind;
  carId: string;
  start: number;
  end: number;
}

/**
 * Pick the best moment of each kind (longest drift, biggest jump, closest overtake),
 * cut a window around each, and return them in race order without overlap,
 * together at most `total` seconds long.
 */
export function pickHighlights(replay: Replay, total = 15): HighlightSegment[] {
  const best = new Map<HighlightKind, ReplayMoment>();
  for (const m of replay.moments) {
    if (m.value < MIN_VALUE[m.kind]) continue;
    const cur = best.get(m.kind);
    if (!cur || m.value > cur.value) best.set(m.kind, m);
  }
  const order: HighlightKind[] = ["overtake", "drift", "jump"];
  const chosen = order.map((k) => best.get(k)).filter((m): m is ReplayMoment => Boolean(m));
  if (!chosen.length) {
    // nothing special happened: show the finish
    const end = replay.duration;
    const first = Object.keys(replay.cars)[0];
    return first ? [{ kind: "overtake", carId: first, start: Math.max(0, end - Math.min(total, 6)), end }] : [];
  }
  const len = total / chosen.length;
  const segs = chosen
    .map((m) => {
      const lead = m.kind === "drift" ? Math.min(len - 1, m.value + 0.5) : len * 0.6;
      const start = Math.max(0, m.t - lead);
      return { kind: m.kind, carId: m.carId, start, end: Math.min(replay.duration, start + len) };
    })
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < segs.length; i++) {
    const prev = segs[i - 1]!;
    if (segs[i]!.start < prev.end) prev.end = segs[i]!.start;
  }
  return segs.filter((s) => s.end - s.start > 0.5);
}
