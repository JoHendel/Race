import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import { GRAND_CIRCUIT, NEON_HARBOR, SUNSET_CANYON, VOLCANO_RUSH, forTraining, withoutShortcuts, type DrawbridgeEvent } from "@apex/shared";
import { TrackGeometry } from "./track";

describe("TrackGeometry shortcuts", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  const make = (def = NEON_HARBOR) => new TrackGeometry(new RAPIER.World({ x: 0, y: -9.81, z: 0 }), def);

  it("builds the warehouse shortcut of Neon Harbor", () => {
    const t = make();
    expect(t.shortcuts).toHaveLength(1);
    const c = t.shortcuts[0]!;
    expect(c.samples.length).toBeGreaterThan(40);
    expect(c.samples[0]!.frac).toBeCloseTo(0.6);
    expect(c.samples.at(-1)!.frac).toBeCloseTo(0.78);
  });

  it("opens the main wall only on the side of the shortcut", () => {
    const t = make();
    const gaps = (side: 1 | -1) => (t.wallMask(side) ?? []).filter((v) => !v).length;
    const left = gaps(1);
    const right = gaps(-1);
    expect(Math.min(left, right)).toBe(0);
    expect(Math.max(left, right)).toBeGreaterThan(4);
  });

  it("locates a car inside the shortcut with the matching lap share", () => {
    const t = make();
    const c = t.shortcuts[0]!;
    const mid = c.samples[Math.floor(c.samples.length / 2)]!;
    const loc = t.locate(mid.pos, Math.round(0.62 * t.samples.length));
    expect(loc.shortcut).toBe(c);
    expect(loc.u).toBeGreaterThan(0.4);
    expect(loc.u).toBeLessThan(0.6);
    expect(loc.index / t.samples.length).toBeCloseTo((0.6 + 0.78) / 2, 1);
  });

  it("on the main track locate equals the nearest sample", () => {
    const t = make();
    const s = t.samples[100]!;
    const loc = t.locate(s.pos, 98);
    expect(loc.shortcut).toBeNull();
    expect(loc.index).toBe(100);
  });

  it("tracks without shortcuts have no wall gaps", () => {
    for (const def of [GRAND_CIRCUIT, withoutShortcuts(NEON_HARBOR)]) {
      const t = make(def);
      expect(t.shortcuts).toHaveLength(0);
      expect(t.wallMask(1)).toBeUndefined();
    }
  });
});

describe("Drawbridge", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("stays flat in lap 1 and rises once the leader starts lap 2", () => {
    const t = new TrackGeometry(new RAPIER.World({ x: 0, y: -9.81, z: 0 }), NEON_HARBOR);
    expect(t.bridges).toHaveLength(1);
    const b = t.bridges[0]!;
    for (let i = 0; i < 600; i++) t.updateEvents(0, 1 / 60);
    expect(b.angle).toBe(0);
    expect(t.updateEvents(1, 1 / 60)).toEqual([b]);
    for (let i = 0; i < 600; i++) t.updateEvents(1, 1 / 60);
    expect((b.angle * 180) / Math.PI).toBeCloseTo(10, 5);
  });

  it("leaves a gap in the fixed road only where the bridge is", () => {
    const t = new TrackGeometry(new RAPIER.World({ x: 0, y: -9.81, z: 0 }), NEON_HARBOR);
    const gaps = t.roadMask!.filter((v) => !v).length;
    expect(gaps * 2).toBeCloseTo((NEON_HARBOR.events![0] as DrawbridgeEvent).span, -1);
  });

  it("the training variant has no bridge and no road gap", () => {
    const t = new TrackGeometry(new RAPIER.World({ x: 0, y: -9.81, z: 0 }), forTraining(NEON_HARBOR));
    expect(t.bridges).toHaveLength(0);
    expect(t.roadMask).toBeUndefined();
  });
});

describe("Drawbridge state", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });
  it("stays open once it has opened", () => {
    const t = new TrackGeometry(new RAPIER.World({ x: 0, y: -9.81, z: 0 }), NEON_HARBOR);
    const b = t.bridges[0]!;
    b.update(1, 10);
    b.update(0, 1 / 60);
    expect((b.angle * 180) / Math.PI).toBeCloseTo(10, 5);
  });
});

describe("Rockfall", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("keeps the canyon shortcut of Sunset Canyon closed until lap 2", () => {
    const t = new TrackGeometry(new RAPIER.World({ x: 0, y: -9.81, z: 0 }), SUNSET_CANYON);
    const c = t.shortcuts[0]!;
    const mid = c.samples[Math.floor(c.samples.length / 2)]!;
    expect(c.open).toBe(false);
    expect(t.locate(mid.pos, Math.round(0.6 * t.samples.length)).shortcut).toBeNull();
    for (let i = 0; i < 600; i++) t.updateEvents(0, 1 / 60);
    expect(c.open).toBe(false);
    expect(t.updateEvents(1, 1 / 60)).toEqual([t.rockfalls[0]]);
    for (let i = 0; i < 60 * 3; i++) t.updateEvents(1, 1 / 60);
    expect(c.open).toBe(true);
    expect(t.locate(mid.pos, Math.round(0.6 * t.samples.length)).shortcut).toBe(c);
  });
});

describe("Lava flows", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  it("covers one half of the road and switches sides with every lap of the leader", () => {
    const t = new TrackGeometry(new RAPIER.World({ x: 0, y: -9.81, z: 0 }), VOLCANO_RUSH);
    const lava = t.lava!;
    const [a, b] = lava.ranges[0]!;
    const mid = Math.round((a + b) / 2);
    const side = lava.side(0);
    expect(t.lavaDrag(mid, side * 4)).toBeGreaterThan(0);
    expect(t.lavaDrag(mid, -side * 4)).toBe(0);
    expect(t.lavaDrag(b + 20, side * 4)).toBe(0);
    expect(t.updateEvents(1, 1 / 60)).toContain(lava);
    expect(lava.side(0)).toBe(-side);
    expect(t.lavaDrag(mid, side * 4)).toBe(0);
    expect(t.lavaDrag(mid, -side * 4)).toBeGreaterThan(0);
  });

  it("is not part of the training variant", () => {
    const t = new TrackGeometry(new RAPIER.World({ x: 0, y: -9.81, z: 0 }), forTraining(VOLCANO_RUSH));
    expect(t.lava).toBeNull();
    expect(t.lavaDrag(50, 3)).toBe(0);
  });
});
