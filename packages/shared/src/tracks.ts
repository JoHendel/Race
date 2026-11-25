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

export const TRACKS: TrackDef[] = [NEON_HARBOR];
