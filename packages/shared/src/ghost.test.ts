import { describe, expect, it } from "vitest";
import { GHOST_STEP, GhostRecorder, decodeGhost, driftCombo, driftPoints, encodeGhost, ghostPose } from "./ghost";

describe("ghost", () => {
  const lap = () => {
    const r = new GhostRecorder();
    for (let i = 0; i <= 600; i++) {
      const t = i / 60;
      r.add(t, { x: 100 + Math.cos(t) * 50, y: Math.sin(t * 3), z: -40 + Math.sin(t) * 50, yaw: (t * 0.7) % (Math.PI * 2) });
    }
    return r;
  };

  it("records one sample every 0.1 s", () => {
    const r = lap();
    expect(r.samples.length).toBe(Math.round(10 / GHOST_STEP) + 1);
  });

  it("round-trips through the compact encoding within 2 cm", () => {
    const r = lap();
    const text = encodeGhost({ trackId: "neon-harbor", lapTime: 42.5, samples: r.samples });
    expect(text.length).toBeLessThan(2000);
    const g = decodeGhost(text)!;
    expect(g.trackId).toBe("neon-harbor");
    expect(g.lapTime).toBe(42.5);
    expect(g.samples.length).toBe(r.samples.length);
    g.samples.forEach((s, i) => {
      expect(Math.abs(s.x - r.samples[i]!.x)).toBeLessThan(0.02);
      expect(Math.abs(s.z - r.samples[i]!.z)).toBeLessThan(0.02);
    });
  });

  it("interpolates between samples and handles angle wrap-around", () => {
    const g = { trackId: "x", lapTime: 1, samples: [{ x: 0, y: 0, z: 0, yaw: 3.1 }, { x: 10, y: 0, z: 0, yaw: -3.1 }] };
    const p = ghostPose(g, GHOST_STEP / 2)!;
    expect(p.x).toBeCloseTo(5);
    expect(Math.abs(p.yaw)).toBeGreaterThan(3.1);
    expect(ghostPose(g, 99)!.x).toBe(10);
  });

  it("ignores broken data", () => {
    expect(decodeGhost("nonsense")).toBeNull();
    expect(decodeGhost(null)).toBeNull();
  });
});

describe("drift challenge", () => {
  it("gives points only while drifting at speed, more for steeper angles", () => {
    expect(driftPoints(1, 0.5, 30, false)).toBe(0);
    expect(driftPoints(1, 0.5, 5, true)).toBe(0);
    expect(driftPoints(1, 0.9, 30, true)).toBeGreaterThan(driftPoints(1, 0.2, 30, true));
  });

  it("long drifts build a combo up to x3", () => {
    expect(driftCombo(0)).toBe(1);
    expect(driftCombo(3.1)).toBe(2);
    expect(driftCombo(60)).toBe(3);
  });
});
