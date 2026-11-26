import { describe, expect, it } from "vitest";
import { ReplayRecorder, pickHighlights, replayPose } from "./replay";

function race() {
  const r = new ReplayRecorder();
  for (let i = 0; i <= 1200; i++) {
    const t = i / 20;
    r.add("a", t, { x: t * 10, y: 0, z: 0, yaw: 0 });
    r.add("b", t, { x: t * 9, y: 0, z: 2, yaw: 0 });
  }
  return r;
}

describe("replay", () => {
  it("plays back every car on the race clock", () => {
    const rep = race().finish();
    expect(rep.duration).toBeCloseTo(60);
    expect(replayPose(rep, "a", 12.34)!.x).toBeCloseTo(123.4, 1);
    expect(replayPose(rep, "b", 30)!.x).toBeCloseTo(270, 1);
    expect(replayPose(rep, "nobody", 1)).toBeNull();
  });

  it("picks the best moment of each kind, in race order, within 15 s and without overlap", () => {
    const r = race();
    r.moment({ kind: "drift", t: 20, carId: "a", value: 2 });
    r.moment({ kind: "drift", t: 40, carId: "b", value: 4.5 });
    r.moment({ kind: "jump", t: 10, carId: "a", value: 1.2 });
    r.moment({ kind: "overtake", t: 41, carId: "a", value: 3 });
    r.moment({ kind: "jump", t: 50, carId: "b", value: 0.1 }); // too small
    const segs = pickHighlights(r.finish());
    expect(segs.map((s) => s.kind)).toEqual(["jump", "drift", "overtake"]);
    expect(segs[1]!.carId).toBe("b");
    const total = segs.reduce((n, s) => n + s.end - s.start, 0);
    expect(total).toBeLessThanOrEqual(15.001);
    for (let i = 1; i < segs.length; i++) expect(segs[i]!.start).toBeGreaterThanOrEqual(segs[i - 1]!.end);
  });

  it("falls back to the finish when nothing happened", () => {
    const segs = pickHighlights(race().finish());
    expect(segs).toHaveLength(1);
    expect(segs[0]!.end).toBeCloseTo(60);
  });
});
