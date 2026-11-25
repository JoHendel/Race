/** Streckendefinitionen. Eine Strecke ist ein geschlossener Spline durch Kontrollpunkte [x, y, z] in Metern. */
export interface TrackDef {
  id: string;
  name: string;
  cup: "neon" | "turbo";
  /** Kontrollpunkte im Uhrzeigersinn, y = Höhe. */
  points: [number, number, number][];
  width: number;
  /** Farben der Randsteine/Leitplanken. */
  accent: number;
  accent2: number;
  /** Rampen auf der Strecke: Position als Anteil der Runde (0..1), Länge in m, Höhe in m. */
  ramps: { at: number; length: number; height: number }[];
  /** Zones with a different surface, e.g. ice: start/end as share of the lap (0..1), grip factor (1 = asphalt). */
  surfaces?: TrackSurface[];
  /** Look of the surroundings (sky, fog, scenery). Default: neon night harbor. */
  environment?: TrackEnvironment;
  /** One-line description for the track selection. German source text, translated in i18n. */
  blurb?: string;
}

export interface TrackSurface {
  from: number;
  to: number;
  grip: number;
  kind: "ice";
}

export interface TrackEnvironment {
  scenery: "harbor" | "glacier";
  sky: { top: number; mid: number; horizon: number };
  fog: number;
  sun: number | null;
  aurora?: boolean;
}

export const DEFAULT_ENVIRONMENT: TrackEnvironment = {
  scenery: "harbor",
  sky: { top: 0x05060f, mid: 0x2a0b4a, horizon: 0xff2bd6 },
  fog: 0x1a0830,
  sun: 0xff8a1f,
};

/** Grip factor of the track surface at a given share of the lap. */
export function surfaceGripAt(def: TrackDef, lapShare: number): number {
  if (!def.surfaces) return 1;
  const t = ((lapShare % 1) + 1) % 1;
  for (const z of def.surfaces) {
    const inside = z.from <= z.to ? t >= z.from && t < z.to : t >= z.from || t < z.to;
    if (inside) return z.grip;
  }
  return 1;
}

export const NEON_HARBOR: TrackDef = {
  id: "neon-harbor",
  name: "Neon Harbor",
  cup: "neon",
  width: 16,
  accent: 0x00e5ff,
  accent2: 0xff2bd6,
  points: [
    [0, 0, 0],
    [0, 0, 170],
    [30, 0, 250],
    [110, 2, 285],
    [200, 6, 255],
    [240, 9, 180],
    [215, 9, 105],
    [250, 5, 35],
    [320, 1, -15],
    [335, 0, -115],
    [275, 0, -180],
    [165, 0, -175],
    [105, 0, -115],
    [40, 0, -75],
  ],
  ramps: [{ at: 0.86, length: 14, height: 2.4 }],
  blurb: "Hafen bei Nacht, Sprung über das Hafenbecken",
};

export const SUNSET_CANYON: TrackDef = {
  id: "sunset-canyon",
  name: "Sunset Canyon",
  cup: "neon",
  width: 16,
  accent: 0xff8a1f,
  accent2: 0xffe14d,
  points: [
    [0, 0, 0],
    [0, 0, 140],
    [40, 3, 220],
    [130, 6, 245],
    [195, 8, 185],
    [175, 6, 95],
    [225, 4, 25],
    [305, 2, 0],
    [345, 0, -90],
    [295, 0, -170],
    [185, 2, -195],
    [85, 4, -155],
    [30, 2, -85],
  ],
  ramps: [{ at: 0.36, length: 16, height: 3 }],
  blurb: "Wüstenschlucht im Abendlicht, großer Sprung",
};

export const SKYLINE_LOOP: TrackDef = {
  id: "skyline-loop",
  name: "Skyline Loop",
  cup: "neon",
  width: 15,
  accent: 0x9b5cff,
  accent2: 0x00e5ff,
  points: [
    [0, 0, 0],
    [0, 4, 120],
    [55, 8, 180],
    [145, 10, 160],
    [160, 10, 75],
    [100, 8, 35],
    [115, 6, -35],
    [205, 4, -65],
    [235, 2, -155],
    [150, 0, -210],
    [50, 0, -175],
    [15, 0, -90],
  ],
  ramps: [{ at: 0.62, length: 12, height: 2 }],
  blurb: "Hochhäuser und Rampen zwischen den Dächern",
};

export const GRAND_CIRCUIT: TrackDef = {
  id: "grand-circuit",
  name: "Grand Circuit",
  cup: "turbo",
  width: 18,
  accent: 0x39ff88,
  accent2: 0xf4f6ff,
  points: [
    [0, 0, 0],
    [0, 0, 300],
    [40, 0, 365],
    [125, 0, 365],
    [165, 0, 300],
    [165, 0, 185],
    [225, 0, 120],
    [320, 0, 120],
    [365, 0, 60],
    [365, 0, -120],
    [305, 0, -175],
    [120, 0, -175],
    [60, 0, -125],
    [35, 0, -60],
  ],
  ramps: [{ at: 0.46, length: 12, height: 1.8 }],
  blurb: "Klassische Rennstrecke, lange Geraden für den Windschatten",
};

export const GLACIER_RIFT: TrackDef = {
  id: "glacier-rift",
  name: "Glacier Rift",
  cup: "neon",
  width: 16,
  accent: 0x7fe9ff,
  accent2: 0xb48cff,
  points: [
    [0, 0, 0],
    [0, 1, 150],
    [-35, 3, 225],
    [-120, 6, 250],
    [-200, 8, 210],
    [-215, 8, 130],
    [-160, 6, 70],
    [-185, 4, -10],
    [-260, 2, -60],
    [-265, 0, -150],
    [-190, 0, -210],
    [-90, 2, -205],
    [-30, 1, -140],
    [5, 0, -70],
  ],
  ramps: [{ at: 0.72, length: 14, height: 2.6 }],
  surfaces: [
    { from: 0.2, to: 0.3, grip: 0.55, kind: "ice" },
    { from: 0.52, to: 0.6, grip: 0.55, kind: "ice" },
  ],
  environment: {
    scenery: "glacier",
    sky: { top: 0x020814, mid: 0x0b2440, horizon: 0x2ad8c8 },
    fog: 0x0a1c30,
    sun: null,
    aurora: true,
  },
  blurb: "Gletscher mit Eisflächen (weniger Grip) und Polarlichtern",
};

export const TRACKS: TrackDef[] = [NEON_HARBOR, SUNSET_CANYON, SKYLINE_LOOP, GLACIER_RIFT, GRAND_CIRCUIT];

export function trackById(id: string): TrackDef | undefined {
  return TRACKS.find((t) => t.id === id);
}

/** Mirrored copy of a track (left and right swapped) – used for data augmentation. */
export function mirrorTrack(def: TrackDef): TrackDef {
  return { ...def, id: `${def.id}-mirror`, name: `${def.name} (mirror)`, points: def.points.map(([x, y, z]) => [-x, y, z]) as [number, number, number][] };
}
