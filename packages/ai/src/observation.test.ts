import { beforeAll, describe, expect, it } from "vitest";
import { NEON_HARBOR } from "@apex/shared";
import { HeadlessRace } from "@apex/sim";
import { OBS_SIZE, observeRacer } from "./observation";

describe("observe", () => {
  beforeAll(async () => {
    await HeadlessRace.init();
  });

  it("liefert 24 endliche Werte im Bereich −1…1", () => {
    const race = new HeadlessRace(NEON_HARBOR, [{ id: "a" }, { id: "b" }], 1, 1);
    for (let i = 0; i < 300; i++) race.step();
    const x = observeRacer(race, race.racers[0]!);
    race.dispose();
    expect(x).toHaveLength(OBS_SIZE);
    for (const v of x) {
      expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(v)).toBeLessThanOrEqual(1.0001);
    }
  });
});
