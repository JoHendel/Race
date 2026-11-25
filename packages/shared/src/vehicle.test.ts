import { describe, expect, it } from "vitest";
import { NitroTank, driftLevel, steerAngle } from "./vehicle";

describe("driftLevel", () => {
  it("steigt mit der Driftdauer in drei Stufen", () => {
    expect(driftLevel(0.2)).toBe(0);
    expect(driftLevel(0.8)).toBe(1);
    expect(driftLevel(1.6)).toBe(2);
    expect(driftLevel(5)).toBe(3);
  });
});

describe("steerAngle", () => {
  it("lenkt bei Höchstgeschwindigkeit weniger stark", () => {
    expect(steerAngle(0.5, 0, 50)).toBeCloseTo(0.5);
    expect(steerAngle(0.5, 50, 50)).toBeCloseTo(0.2);
  });
});

describe("NitroTank", () => {
  it("lädt bis zur Kapazität und leert sich beim Boosten", () => {
    const tank = new NitroTank(3);
    tank.charge(5);
    expect(tank.amount).toBe(3);
    expect(tank.drain(1)).toBe(true);
    expect(tank.fraction).toBeCloseTo(2 / 3);
    tank.drain(10);
    expect(tank.drain(0.1)).toBe(false);
  });
});
