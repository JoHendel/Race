import { describe, expect, it } from "vitest";
import { CupStandings, computeAwards } from "./cup";

describe("CupStandings", () => {
  it("summiert Punkte über mehrere Rennen und sortiert", () => {
    const cup = new CupStandings(2);
    cup.add([
      { id: "a", name: "A", color: 0, place: 1, fastestLap: false },
      { id: "b", name: "B", color: 0, place: 2, fastestLap: true },
    ]);
    cup.add([
      { id: "a", name: "A", color: 0, place: 2, fastestLap: false },
      { id: "b", name: "B", color: 0, place: 1, fastestLap: false },
    ]);
    const t = cup.table();
    expect(t.map((r) => [r.id, r.points])).toEqual([
      ["b", 28],
      ["a", 27],
    ]);
    expect(cup.finished).toBe(true);
  });
});

describe("computeAwards", () => {
  it("vergibt Auszeichnungen an die Richtigen", () => {
    const awards = computeAwards([
      { id: "a", name: "A", bestLap: 40, driftTime: 2, overtakes: 1, worstPlace: 2, finalPlace: 1 },
      { id: "b", name: "B", bestLap: 39, driftTime: 8, overtakes: 5, worstPlace: 9, finalPlace: 3 },
    ]);
    const by = Object.fromEntries(awards.map((a) => [a.key, a.id]));
    expect(by).toEqual({ fastest: "b", drift: "b", overtakes: "b", comeback: "b" });
  });

  it("vergibt nichts ohne echte Leistung", () => {
    expect(computeAwards([{ id: "a", name: "A", bestLap: null, driftTime: 0, overtakes: 0, worstPlace: 1, finalPlace: 1 }])).toEqual([]);
  });
});

describe("cup bonus points", () => {
  it("adds extra points such as the rival bonus", () => {
    const s = new CupStandings(2);
    s.add([
      { id: "me", name: "Me", color: 0, place: 2, fastestLap: false, bonus: 1 },
      { id: "x", name: "X", color: 0, place: 1, fastestLap: false },
    ]);
    expect(s.table().find((r) => r.id === "me")!.points).toBe(13);
  });
});
