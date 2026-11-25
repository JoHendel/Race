import { beforeAll, describe, expect, it } from "vitest";
import { NEON_HARBOR } from "@apex/shared";
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
});
