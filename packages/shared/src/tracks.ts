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
};

export const TRACKS: TrackDef[] = [NEON_HARBOR, SUNSET_CANYON, SKYLINE_LOOP, GRAND_CIRCUIT];

export function trackById(id: string): TrackDef | undefined {
  return TRACKS.find((t) => t.id === id);
}

/** Mirrored copy of a track (left and right swapped) – used for data augmentation. */
export function mirrorTrack(def: TrackDef): TrackDef {
  return { ...def, id: `${def.id}-mirror`, name: `${def.name} (mirror)`, points: def.points.map(([x, y, z]) => [-x, y, z]) };
}
