import { describe, expect, it } from "vitest";
import { ITEMS, ITEM_NAMES, itemWeights, rollItem } from "./items";
import { translate } from "./i18n";

describe("chaos items", () => {
  it("the back of the field gets stronger items than the leader", () => {
    const first = itemWeights(1, 10);
    const last = itemWeights(10, 10);
    expect(last.turbo).toBeGreaterThan(first.turbo);
    expect(last.drone).toBeGreaterThan(first.drone);
    expect(first.shield).toBeGreaterThan(last.shield);
    for (const k of ITEMS) expect(first[k]).toBeGreaterThan(0);
  });

  it("rolls every item at some point and only valid ones", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) seen.add(rollItem(1 + (i % 10), 10, Math.random));
    expect([...seen].sort()).toEqual([...ITEMS].sort());
  });

  it("follows the weights (leader gets shields more often than drones)", () => {
    let shield = 0;
    let drone = 0;
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const k = rollItem(1, 10, rnd);
      if (k === "shield") shield++;
      if (k === "drone") drone++;
    }
    expect(shield).toBeGreaterThan(drone * 3);
  });

  it("has English names", () => {
    for (const n of Object.values(ITEM_NAMES)) expect(translate(n, "en")).not.toBe(n);
  });
});
