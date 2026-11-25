import { describe, expect, it } from "vitest";
import { clampLaps, pointsForPlace } from "./scoring";

describe("pointsForPlace", () => {
  it("gibt dem Sieger 15 Punkte", () => {
    expect(pointsForPlace(1)).toBe(15);
  });
  it("addiert den Bonus für die schnellste Runde", () => {
    expect(pointsForPlace(3, true)).toBe(11);
  });
  it("gibt Plätzen außerhalb der Wertung 0 Punkte", () => {
    expect(pointsForPlace(11)).toBe(0);
  });
});

describe("clampLaps", () => {
  it("begrenzt auf 1 bis 10 Runden", () => {
    expect(clampLaps(0)).toBe(1);
    expect(clampLaps(42)).toBe(10);
    expect(clampLaps(3.4)).toBe(3);
  });
  it("fällt bei ungültigen Werten auf 3 zurück", () => {
    expect(clampLaps(Number.NaN)).toBe(3);
  });
});
