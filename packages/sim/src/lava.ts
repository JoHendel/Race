import { LAVA_DRAG, lavaSide, type LavaEvent } from "@apex/shared";

/** Lava flows of a track: which half of the road is covered, and how much a car is slowed down. */
export class LavaFlows {
  leaderLaps = 0;
  /** Seconds since the flows last switched sides (for the cross-fade in the client). */
  sinceSwitch = 99;
  /** Sample ranges of the zones. */
  readonly ranges: [number, number][];

  constructor(
    readonly event: LavaEvent,
    private readonly samples: number,
    spacing: number,
  ) {
    this.ranges = event.zones.map((z) => {
      const c = Math.round(z.at * samples);
      const half = Math.round(z.length / 2 / spacing);
      return [c - half, c + half];
    });
  }

  side(zone: number): 1 | -1 {
    return lavaSide(zone, this.leaderLaps);
  }

  /** Zone index at a sample index, or -1. */
  zoneAt(index: number): number {
    const n = this.samples;
    for (let z = 0; z < this.ranges.length; z++) {
      const [a, b] = this.ranges[z]!;
      const i = ((index - a) % n + n) % n;
      if (i <= b - a) return z;
    }
    return -1;
  }

  /** Drag rate (1/s) for a car at sample `index` with lateral offset `lateral` (positive = left). */
  dragAt(index: number, lateral: number): number {
    const z = this.zoneAt(index);
    if (z < 0) return 0;
    // lava covers its half plus a small margin over the centre line
    return lateral * this.side(z) > -0.6 ? LAVA_DRAG : 0;
  }

  /** Returns true when the flows switch sides. */
  update(leaderLaps: number, dt: number): boolean {
    this.sinceSwitch += dt;
    if (leaderLaps === this.leaderLaps) return false;
    this.leaderLaps = leaderLaps;
    this.sinceSwitch = 0;
    return true;
  }
}
