import { describe, expect, it } from "vitest";
import { EMOTES, FxLimiter, hornFor, isEmote } from "./fx";
import { CARS } from "./cars";

describe("fx", () => {
  it("accepts only the six emotes", () => {
    expect(EMOTES).toHaveLength(6);
    expect(isEmote("🔥")).toBe(true);
    expect(isEmote("<script>")).toBe(false);
    expect(isEmote(5)).toBe(false);
  });

  it("gives every car a stable horn and uses several different sounds", () => {
    expect(hornFor("volt-hatch")).toEqual(hornFor("volt-hatch"));
    const kinds = new Set(CARS.map((c) => JSON.stringify(hornFor(c.id))));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it("limits effects per player", () => {
    const l = new FxLimiter(0.6);
    expect(l.allow("a", 0)).toBe(true);
    expect(l.allow("a", 0.3)).toBe(false);
    expect(l.allow("b", 0.3)).toBe(true);
    expect(l.allow("a", 0.7)).toBe(true);
  });
});
