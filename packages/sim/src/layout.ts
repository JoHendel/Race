import type { CarDef } from "@apex/shared";

export interface WheelLayout {
  /** Wheel positions relative to the chassis: [x, z, front]. */
  wheels: [number, number, boolean][];
  radius: number;
}

/** Wheel positions and radius derived from a car's size and body style. */
export function wheelLayout(def: CarDef): WheelLayout {
  const L = def.length;
  const W = def.width;
  const radius = def.body === "muscle" ? 0.4 : def.body === "hyper" ? 0.36 : 0.35;
  return {
    radius,
    wheels: [
      [-(W / 2 - 0.1), L * 0.32, true],
      [W / 2 - 0.1, L * 0.32, true],
      [-(W / 2 - 0.1), -L * 0.3, false],
      [W / 2 - 0.1, -L * 0.3, false],
    ],
  };
}
