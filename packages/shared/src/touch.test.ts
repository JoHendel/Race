import { describe, expect, it } from "vitest";
import { RepeatGate, navigate, padDirection, stickValue, tiltSteer } from "./touch";

describe("touch & gamepad helpers", () => {
  it("thumb stick: dead zone, clamped to the circle", () => {
    expect(stickValue(3, 0, 60)).toEqual({ x: 0, y: 0 });
    expect(stickValue(200, 0, 60).x).toBeCloseTo(1);
    const half = stickValue(30, 0, 60).x;
    expect(half).toBeGreaterThan(0.2);
    expect(half).toBeLessThan(0.6);
    expect(stickValue(-200, 0, 60).x).toBeCloseTo(-1);
  });

  it("tilt: ignores wobble, full lock at the max angle", () => {
    expect(tiltSteer(2)).toBe(0);
    expect(tiltSteer(28)).toBe(1);
    expect(tiltSteer(-40)).toBe(-1);
    expect(tiltSteer(15)).toBeGreaterThan(0.3);
    expect(tiltSteer(NaN)).toBe(0);
  });

  it("menu navigation picks the nearest element in the direction", () => {
    // a row of three buttons and one below the middle
    const rects = [
      { x: 0, y: 0, w: 100, h: 40 },
      { x: 120, y: 0, w: 100, h: 40 },
      { x: 240, y: 0, w: 100, h: 40 },
      { x: 120, y: 80, w: 100, h: 40 },
    ];
    expect(navigate(rects, 0, "right")).toBe(1);
    expect(navigate(rects, 1, "right")).toBe(2);
    expect(navigate(rects, 2, "right")).toBe(2);
    expect(navigate(rects, 1, "down")).toBe(3);
    expect(navigate(rects, 3, "up")).toBe(1);
    expect(navigate(rects, -1, "down")).toBe(0);
    expect(navigate([], 0, "down")).toBe(-1);
  });

  it("gamepad direction from d-pad or stick", () => {
    expect(padDirection(Object.assign([], { 13: true }), [])).toBe("down");
    expect(padDirection([], [0.9, 0.1])).toBe("right");
    expect(padDirection([], [0.2, -0.3])).toBeNull();
  });

  it("repeats a held direction after a delay", () => {
    const g = new RepeatGate();
    expect(g.next("down", 0)).toBe(true);
    expect(g.next("down", 0.2)).toBe(false);
    expect(g.next("down", 0.2)).toBe(true);
    expect(g.next(null, 0.1)).toBe(false);
    expect(g.next("up", 0)).toBe(true);
  });
});
