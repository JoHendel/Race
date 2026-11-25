import { describe, expect, it } from "vitest";
import { CARS, CLASS_PI_LIMIT, performanceIndex, statsFor, stockTuning, upgradeCost } from "./cars";
import { applyReward, isUnlocked, levelFromXp, newSave, parseSave, raceReward, xpForLevel } from "./progress";

describe("Fahrzeuge", () => {
  it("hat 12 Autos in 4 Klassen mit je 3 Autos", () => {
    expect(CARS).toHaveLength(12);
    for (const cls of ["street", "drift", "muscle", "hyper"]) expect(CARS.filter((c) => c.cls === cls)).toHaveLength(3);
  });

  it("liegt serienmäßig unter dem Leistungsindex-Limit der Klasse", () => {
    for (const c of CARS) expect(performanceIndex(c, stockTuning())).toBeLessThanOrEqual(CLASS_PI_LIMIT[c.cls]);
  });

  it("macht Tuning messbar schneller und teurer", () => {
    const car = CARS[0]!;
    const tuned = stockTuning();
    tuned.levels.engine = 5;
    expect(statsFor(car, tuned).topSpeed).toBeGreaterThan(statsFor(car).topSpeed);
    expect(performanceIndex(car, tuned)).toBeGreaterThan(performanceIndex(car, stockTuning()));
    expect(upgradeCost("engine", 4)).toBeGreaterThan(upgradeCost("engine", 0));
  });

  it("Hyper-Autos sind schneller als Street-Autos", () => {
    const street = statsFor(CARS.find((c) => c.cls === "street")!);
    const hyper = statsFor(CARS.find((c) => c.cls === "hyper")!);
    expect(hyper.topSpeed).toBeGreaterThan(street.topSpeed);
  });
});

describe("Fortschritt", () => {
  it("steigt im Level mit XP", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(xpForLevel(5))).toBe(5);
    expect(levelFromXp(xpForLevel(5) - 1)).toBe(4);
  });

  it("schaltet Autos ab dem richtigen Level frei", () => {
    const save = newSave();
    expect(isUnlocked(save, "volt-hatch")).toBe(true);
    expect(isUnlocked(save, "kitsune-rs")).toBe(false);
    const { save: next, unlocked } = applyReward(save, { xp: xpForLevel(3), credits: 0 });
    expect(isUnlocked(next, "kitsune-rs")).toBe(true);
    expect(unlocked).toContain("Kitsune RS");
  });

  it("belohnt den Sieger mehr als den Letzten", () => {
    expect(raceReward(1, 10, true, 0, 0).credits).toBeGreaterThan(raceReward(10, 10, true, 0, 0).credits);
  });

  it("übersteht kaputte Spielstände", () => {
    expect(parseSave("{kaputt").xp).toBe(0);
    expect(parseSave(JSON.stringify({ version: 1, xp: 50 })).xp).toBe(50);
  });
});
