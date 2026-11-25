import { describe, expect, it } from "vitest";
import { LapTracker, formatTime, rankRacers } from "./race";

function driveLap(t: LapTracker, start: number, time: number): number {
  for (let i = 1; i <= 100; i++) t.update((i / 100) % 1, time + i * 0.5);
  return time + 50;
}

describe("LapTracker", () => {
  it("zählt eine Runde nur nach allen Checkpoints", () => {
    const t = new LapTracker(3);
    t.update(0, 0);
    driveLap(t, 0, 0);
    expect(t.lap).toBe(1);
    expect(t.lapTimes[0]).toBeCloseTo(50);
  });

  it("zählt keine Runde, wenn jemand abkürzt", () => {
    const t = new LapTracker(3);
    t.update(0.05, 0);
    t.update(0.5, 1);
    t.update(0.95, 2);
    t.update(0.02, 3);
    expect(t.lap).toBe(0);
  });

  it("counts a lap through an official shortcut that skips checkpoints", () => {
    const t = new LapTracker(3);
    t.update(0, 0);
    let time = 0;
    for (let i = 1; i <= 60; i++) t.update(i / 100, (time += 0.5)); // up to 0.60
    t.creditShortcut(0.6, 0.78); // drove through the shortcut gate
    for (let i = 78; i <= 100; i++) t.update((i / 100) % 1, (time += 0.5));
    expect(t.lap).toBe(1);
  });

  it("does not count the shortcut checkpoints without passing the shortcut", () => {
    const t = new LapTracker(3);
    t.update(0, 0);
    let time = 0;
    for (let i = 1; i <= 60; i++) t.update(i / 100, (time += 0.5));
    for (let i = 78; i <= 100; i++) t.update((i / 100) % 1, (time += 0.5));
    expect(t.lap).toBe(0);
  });

  it("forgets a shortcut credit after the lap", () => {
    const t = new LapTracker(3);
    t.update(0, 0);
    let time = 0;
    for (let i = 1; i <= 60; i++) t.update(i / 100, (time += 0.5));
    t.creditShortcut(0.6, 0.78);
    for (let i = 78; i <= 100; i++) t.update((i / 100) % 1, (time += 0.5));
    for (let i = 1; i <= 60; i++) t.update(i / 100, (time += 0.5));
    for (let i = 78; i <= 100; i++) t.update((i / 100) % 1, (time += 0.5));
    expect(t.lap).toBe(1);
  });

  it("ist nach der letzten Runde im Ziel", () => {
    const t = new LapTracker(2);
    t.update(0, 0);
    const time = driveLap(t, 0, 0);
    driveLap(t, 0, time);
    expect(t.finished).toBe(true);
    expect(t.finishTime).toBeCloseTo(100);
  });

  it("setzt den Fortschritt beim Rückwärtsfahren über die Linie zurück", () => {
    const t = new LapTracker(3);
    t.update(0.05, 0);
    t.update(0.95, 1);
    expect(t.progress).toBeLessThan(0);
  });
});

describe("rankRacers", () => {
  it("setzt Fertige vor Fahrende und sortiert nach Fortschritt", () => {
    const ranked = rankRacers([
      { id: "a", progress: 2.5, finishTime: null },
      { id: "b", progress: 3, finishTime: 120 },
      { id: "c", progress: 2.9, finishTime: null },
      { id: "d", progress: 3, finishTime: 118 },
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["d", "b", "c", "a"]);
  });
});

describe("formatTime", () => {
  it("formatiert Minuten, Sekunden und Millisekunden", () => {
    expect(formatTime(75.5)).toBe("1:15.500");
    expect(formatTime(null)).toBe("–");
  });
});
