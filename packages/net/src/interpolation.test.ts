import { describe, expect, it } from "vitest";
import { SnapshotBuffer } from "./interpolation";

describe("SnapshotBuffer", () => {
  it("interpoliert zwischen zwei Zuständen", () => {
    const b = new SnapshotBuffer();
    b.push({ time: 0, p: [0, 0, 0], q: [0, 0, 0, 1] });
    b.push({ time: 1, p: [10, 0, 0], q: [0, 0, 0, 1] });
    expect(b.sample(0.5)!.p[0]).toBeCloseTo(5);
  });

  it("hält den letzten Zustand, wenn neuere fehlen", () => {
    const b = new SnapshotBuffer();
    b.push({ time: 0, p: [1, 2, 3], q: [0, 0, 0, 1] });
    expect(b.sample(5)!.p).toEqual([1, 2, 3]);
  });

  it("ignoriert veraltete Zustände in falscher Reihenfolge", () => {
    const b = new SnapshotBuffer();
    b.push({ time: 1, p: [1, 0, 0], q: [0, 0, 0, 1] });
    b.push({ time: 0.5, p: [99, 0, 0], q: [0, 0, 0, 1] });
    expect(b.sample(1)!.p[0]).toBe(1);
  });
});
