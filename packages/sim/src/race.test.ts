import { beforeAll, describe, expect, it } from "vitest";
import { NEON_HARBOR, ORBITAL_STATION } from "@apex/shared";
import { HeadlessRace } from "./race";

describe("HeadlessRace", () => {
  beforeAll(async () => {
    await HeadlessRace.init();
  });

  it("fährt ein Rennen mit Bots ohne Grafik bis ins Ziel", () => {
    const race = new HeadlessRace(NEON_HARBOR, [{ id: "a", skill: "hard" }, { id: "b" }, { id: "c", skill: "easy" }], 1, 7);
    const t0 = performance.now();
    const result = race.run(180);
    const ms = performance.now() - t0;
    race.dispose();
    expect(result.every((r) => r.finished)).toBe(true);
    expect(result.find((r) => r.id === "a")!.bestLap).toBeGreaterThan(20);
    // Deutlich schneller als Echtzeit
    expect(ms / 1000).toBeLessThan(race.time / 2);
  }, 60_000);

  it("uses the gravity of the track and presses cars down on the ground on low-gravity tracks", () => {
    const low = new HeadlessRace(ORBITAL_STATION, [{ id: "a" }], 1, 1);
    expect(low.world.gravity.y).toBeCloseTo(-4.2);
    expect(low.racers[0]!.car.groundPress).toBeCloseTo(9.81 - 4.2);
    low.dispose();
    const normal = new HeadlessRace(NEON_HARBOR, [{ id: "a" }], 1, 1);
    expect(normal.world.gravity.y).toBeCloseTo(-9.81);
    expect(normal.racers[0]!.car.groundPress).toBe(0);
    normal.dispose();
  });

  it("rain lowers the grip of the whole track and the bots drive slower", () => {
    const dry = new HeadlessRace(NEON_HARBOR, [{ id: "a", skill: "hard" }], 1, 3);
    const wet = new HeadlessRace(NEON_HARBOR, [{ id: "a", skill: "hard" }], 1, 3, "rain");
    expect(wet.track.gripAt(10)).toBeLessThan(dry.track.gripAt(10));
    const tDry = dry.run(200)[0]!;
    const tWet = wet.run(200)[0]!;
    dry.dispose();
    wet.dispose();
    expect(tDry.finished && tWet.finished).toBe(true);
    expect(tWet.bestLap!).toBeGreaterThan(tDry.bestLap!);
  }, 60_000);
});
