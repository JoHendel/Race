import { describe, expect, it } from "vitest";
import { mulberry32 } from "@apex/sim";
import { Mlp, datasetLoss, train, type Dataset } from "./mlp";

function makeSet(n: number, rnd: () => number): Dataset {
  const x = new Float32Array(n * 2);
  const y = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const a = rnd() * 2 - 1;
    const b = rnd() * 2 - 1;
    x.set([a, b], i * 2);
    // steer follows a, throttle follows -b, drift if a > 0.5, nitro if b < -0.5
    y.set([a * 0.8, -b * 0.8, a > 0.5 ? 1 : 0, b < -0.5 ? 1 : 0], i * 4);
  }
  return { x, y, n, inputs: 2 };
}

describe("Mlp", () => {
  it("lernt eine einfache Abbildung (Loss sinkt deutlich)", () => {
    const rnd = mulberry32(1);
    const trainSet = makeSet(800, rnd);
    const valSet = makeSet(200, rnd);
    const m = new Mlp([2, 16, 16, 4], rnd);
    const before = datasetLoss(m, valSet, [1, 1]);
    train(m, trainSet, valSet, { epochs: 30, batchSize: 32, lr: 0.01, posWeight: [1, 1], rnd });
    const after = datasetLoss(m, valSet, [1, 1]);
    expect(after).toBeLessThan(before * 0.3);
    const p = m.predict([0.9, -0.9]);
    expect(p[0]).toBeGreaterThan(0.4);
    expect(p[2]).toBeGreaterThan(0.5);
    expect(p[3]).toBeGreaterThan(0.5);
  });

  it("übersteht Export und Import unverändert", () => {
    const m = new Mlp([3, 4, 2], mulberry32(2));
    const copy = Mlp.fromJSON(m.toJSON());
    const a = m.predict([0.1, 0.2, 0.3]);
    const b = copy.predict([0.1, 0.2, 0.3]);
    expect(b[0]).toBeCloseTo(a[0]!, 4);
  });
});
