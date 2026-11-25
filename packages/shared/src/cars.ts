import type { VehicleStats } from "./vehicle";

export type CarClass = "street" | "drift" | "muscle" | "hyper";
export type BodyStyle = "hatch" | "coupe" | "wedge" | "muscle" | "hyper";

/** Werte auf einer Skala von 1 bis 10. */
export interface CarRating {
  topSpeed: number;
  accel: number;
  handling: number;
  drift: number;
  weight: number;
  nitro: number;
}

export interface CarDef {
  id: string;
  name: string;
  cls: CarClass;
  rating: CarRating;
  /** Level, ab dem das Auto freigeschaltet ist. */
  unlockLevel: number;
  /** Alternativ: Freischaltung durch einen Grand-Prix-Sieg. */
  unlockByCup?: boolean;
  body: BodyStyle;
  /** Länge, Breite in m. */
  length: number;
  width: number;
  defaultColor: number;
}

export const CLASS_NAMES: Record<CarClass, string> = {
  street: "Street",
  drift: "Drift",
  muscle: "Muscle",
  hyper: "Hyper",
};

/** Leistungsindex-Obergrenzen je Klasse für faire Online-Rennen. */
export const CLASS_PI_LIMIT: Record<CarClass, number> = {
  street: 450,
  drift: 550,
  muscle: 650,
  hyper: 850,
};

export const CARS: CarDef[] = [
  { id: "volt-hatch", name: "Volt Hatch", cls: "street", body: "hatch", length: 3.9, width: 1.8, unlockLevel: 1, defaultColor: 0x00e5ff, rating: { topSpeed: 5, accel: 6, handling: 6, drift: 5, weight: 4, nitro: 5 } },
  { id: "rookie-gt", name: "Rookie GT", cls: "street", body: "coupe", length: 4.2, width: 1.85, unlockLevel: 1, defaultColor: 0xffe14d, rating: { topSpeed: 6, accel: 5, handling: 6, drift: 4, weight: 5, nitro: 5 } },
  { id: "pixel-coupe", name: "Pixel Coupe", cls: "street", body: "coupe", length: 4.0, width: 1.8, unlockLevel: 1, defaultColor: 0x39ff88, rating: { topSpeed: 5, accel: 6, handling: 7, drift: 5, weight: 4, nitro: 4 } },
  { id: "kitsune-rs", name: "Kitsune RS", cls: "drift", body: "wedge", length: 4.3, width: 1.85, unlockLevel: 3, defaultColor: 0xff8a1f, rating: { topSpeed: 6, accel: 6, handling: 6, drift: 9, weight: 4, nitro: 6 } },
  { id: "sidewinder", name: "Sidewinder", cls: "drift", body: "coupe", length: 4.4, width: 1.9, unlockLevel: 5, defaultColor: 0x9b5cff, rating: { topSpeed: 6, accel: 7, handling: 5, drift: 8, weight: 5, nitro: 6 } },
  { id: "smoke-queen", name: "Smoke Queen", cls: "drift", body: "wedge", length: 4.5, width: 1.95, unlockLevel: 8, defaultColor: 0xff2bd6, rating: { topSpeed: 7, accel: 6, handling: 6, drift: 10, weight: 5, nitro: 7 } },
  { id: "iron-bison", name: "Iron Bison", cls: "muscle", body: "muscle", length: 4.8, width: 2.0, unlockLevel: 6, defaultColor: 0xff4d6d, rating: { topSpeed: 7, accel: 8, handling: 4, drift: 6, weight: 8, nitro: 6 } },
  { id: "thunderhorn", name: "Thunderhorn", cls: "muscle", body: "muscle", length: 4.9, width: 2.0, unlockLevel: 9, defaultColor: 0x4dd2ff, rating: { topSpeed: 8, accel: 9, handling: 4, drift: 5, weight: 9, nitro: 6 } },
  { id: "blacktop-v8", name: "Blacktop V8", cls: "muscle", body: "muscle", length: 5.0, width: 2.05, unlockLevel: 12, defaultColor: 0xc0c0ff, rating: { topSpeed: 8, accel: 9, handling: 5, drift: 6, weight: 9, nitro: 7 } },
  { id: "apex-phantom", name: "Apex Phantom", cls: "hyper", body: "hyper", length: 4.6, width: 2.0, unlockLevel: 12, defaultColor: 0xf4f6ff, rating: { topSpeed: 9, accel: 8, handling: 7, drift: 6, weight: 3, nitro: 8 } },
  { id: "ion-arrow", name: "Ion Arrow", cls: "hyper", body: "hyper", length: 4.7, width: 2.0, unlockLevel: 16, defaultColor: 0x00ffc8, rating: { topSpeed: 10, accel: 8, handling: 7, drift: 5, weight: 3, nitro: 9 } },
  { id: "nova-prime", name: "Nova Prime", cls: "hyper", body: "hyper", length: 4.8, width: 2.05, unlockLevel: 20, unlockByCup: true, defaultColor: 0xffc94d, rating: { topSpeed: 10, accel: 10, handling: 8, drift: 7, weight: 3, nitro: 10 } },
];

export function carById(id: string): CarDef {
  return CARS.find((c) => c.id === id) ?? CARS[0]!;
}

// ---------- Tuning ----------

export const TUNING_PARTS = ["engine", "gearbox", "tires", "suspension", "nitro", "weight"] as const;
export type TuningPart = (typeof TUNING_PARTS)[number];
export type TireType = "street" | "drift" | "allweather";

export interface Tuning {
  levels: Record<TuningPart, number>; // 0..5
  /** Getriebe: -1 kurz (Beschleunigung) … +1 lang (Topspeed). */
  gearRatio: number;
  tires: TireType;
}

export const MAX_TUNING_LEVEL = 5;

export const TUNING_NAMES: Record<TuningPart, string> = {
  engine: "Motor",
  gearbox: "Getriebe",
  tires: "Reifen",
  suspension: "Fahrwerk",
  nitro: "Nitro",
  weight: "Gewicht",
};

export function stockTuning(): Tuning {
  return { levels: { engine: 0, gearbox: 0, tires: 0, suspension: 0, nitro: 0, weight: 0 }, gearRatio: 0, tires: "street" };
}

/** Preis der nächsten Stufe eines Bauteils in Credits. */
export function upgradeCost(part: TuningPart, currentLevel: number): number {
  const base = part === "engine" ? 400 : part === "weight" ? 350 : 300;
  return base * (currentLevel + 1);
}

/** Effektive Werte (1–10+) nach Tuning. */
export function tunedRating(def: CarDef, t: Tuning): CarRating {
  const r = { ...def.rating };
  const l = t.levels;
  const gear = Math.max(-1, Math.min(1, t.gearRatio));
  r.topSpeed += l.engine * 0.3 + l.gearbox * 0.15 + gear * 0.6;
  r.accel += l.engine * 0.25 + l.gearbox * 0.2 - gear * 0.6 + l.weight * 0.15;
  r.handling += l.suspension * 0.3 + l.tires * 0.2 + l.weight * 0.1;
  r.drift += l.tires * 0.1 + (t.tires === "drift" ? 1.2 : t.tires === "street" ? 0 : -0.4);
  if (t.tires === "drift") r.handling -= 0.6;
  r.weight -= l.weight * 0.35;
  r.nitro += l.nitro * 0.35;
  return r;
}

/** Leistungsindex 100–999 aus den getunten Werten. */
export function performanceIndex(def: CarDef, t: Tuning): number {
  const r = tunedRating(def, t);
  const score = r.topSpeed * 2.2 + r.accel * 2 + r.handling * 1.5 + r.drift * 0.6 + r.nitro * 0.8 - r.weight * 0.4;
  return Math.max(100, Math.min(999, Math.round(score * 10.5)));
}

/** Physikalische Fahrwerte aus Werten und Tuning. */
export function statsFor(def: CarDef, t: Tuning = stockTuning()): VehicleStats & { extraMass: number } {
  const r = tunedRating(def, t);
  return {
    id: def.id,
    name: def.name,
    topSpeed: 38 + r.topSpeed * 2.6,
    engineForce: 4600 + r.accel * 420,
    brakeForce: 80 + r.handling * 3,
    maxSteer: 0.44 + r.handling * 0.018,
    grip: 2.9 + r.handling * 0.13 + (t.tires === "allweather" ? 0.15 : 0),
    driftGrip: Math.max(0.18, 0.52 - r.drift * 0.025),
    driftYawAssist: 1.05 + r.drift * 0.07,
    nitroCapacity: 2 + r.nitro * 0.22,
    nitroForce: 7600 + r.nitro * 300,
    extraMass: 150 + r.weight * 70,
  };
}

// ---------- Optik ----------

export type PaintFinish = "metallic" | "matte" | "chrome";
export type DecalPattern = "none" | "stripes" | "flames" | "checker" | "lightning";

export interface CarLooks {
  color: number;
  finish: PaintFinish;
  rimColor: number;
  spoiler: boolean;
  underglow: number;
  decal: DecalPattern;
  number: number;
  smoke: number;
  horn: number;
}

export function defaultLooks(def: CarDef): CarLooks {
  return {
    color: def.defaultColor,
    finish: "metallic",
    rimColor: def.defaultColor,
    spoiler: def.cls !== "street",
    underglow: def.defaultColor,
    decal: "none",
    number: Math.floor(Math.random() * 99) + 1,
    smoke: 0xffffff,
    horn: 0,
  };
}

/** Kosten für Optik-Teile (Lack und Startnummer sind gratis). */
export const LOOKS_COST: Partial<Record<keyof CarLooks, number>> = {
  finish: 200,
  rimColor: 150,
  spoiler: 250,
  underglow: 200,
  decal: 300,
  smoke: 150,
  horn: 100,
};

export const PAINT_COLORS = [0x00e5ff, 0xff2bd6, 0xff8a1f, 0x9b5cff, 0x39ff88, 0xffe14d, 0xff4d6d, 0xf4f6ff, 0x1b1e3a, 0x4dd2ff, 0xc0c0ff, 0xffc94d];
export const HORNS = ["Klassisch", "Doppelton", "Trucker", "Retro-Synth", "Quietsch"];
