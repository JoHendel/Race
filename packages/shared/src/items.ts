/** Chaos mode: item boxes on the track and power-ups. */

export type ItemKind = "emp" | "mine" | "drone" | "shield" | "turbo";
export const ITEMS: ItemKind[] = ["emp", "mine", "drone", "shield", "turbo"];

/** German UI labels (translated in i18n). */
export const ITEM_NAMES: Record<ItemKind, string> = {
  emp: "EMP-Puls",
  mine: "Haftmine",
  drone: "Drohne",
  shield: "Schutzschild",
  turbo: "Turbo-Zelle",
};

export const ITEM_ICONS: Record<ItemKind, string> = { emp: "⚡", mine: "✷", drone: "➤", shield: "⬡", turbo: "»" };

export const ITEM_CONFIG = {
  /** Item boxes per lap (each a row across the track). */
  boxRows: 5,
  boxesPerRow: 4,
  /** Seconds until a picked box is back. */
  boxRespawn: 4,
  pickupRadius: 2.6,
  /** EMP: radius in m and how long cars in it are slowed. */
  empRadius: 24,
  empTime: 1.6,
  /** Mine / drone hit: seconds of spin-out. */
  stunTime: 1.3,
  mineRadius: 2.2,
  /** A mine becomes dangerous for its owner only after this many seconds. */
  mineArm: 1,
  droneSpeed: 70,
  droneHitRadius: 2.4,
  droneLife: 6,
  shieldTime: 8,
  /** Turbo cell: three strong boosts. */
  turboBoosts: 3,
  turboTime: 0.9,
  turboForce: 26000,
} as const;

/**
 * Weights of the items by race position. Leaders mostly get defensive items,
 * cars at the back get the strong ones – so everyone stays in the race.
 */
export function itemWeights(place: number, total: number): Record<ItemKind, number> {
  const back = total > 1 ? (place - 1) / (total - 1) : 0; // 0 = leader, 1 = last
  return {
    shield: 3 - 2 * back,
    mine: 3 - 1.5 * back,
    emp: 0.5 + 2 * back,
    drone: 0.5 + 2.5 * back,
    turbo: 1 + 3 * back,
  };
}

/** Draw an item for a racer at `place` of `total`. */
export function rollItem(place: number, total: number, rnd: () => number): ItemKind {
  const w = itemWeights(place, total);
  const sum = ITEMS.reduce((a, k) => a + w[k], 0);
  let r = rnd() * sum;
  for (const k of ITEMS) {
    r -= w[k];
    if (r <= 0) return k;
  }
  return ITEMS[ITEMS.length - 1]!;
}
