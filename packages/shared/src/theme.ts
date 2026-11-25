/** Zentrale Farbpalette „Neon-Zukunft“. Alle Farben im Spiel kommen von hier. */
export const theme = {
  background: 0x05060f,
  backgroundSoft: 0x0d1024,
  cyan: 0x00e5ff,
  magenta: 0xff2bd6,
  orange: 0xff8a1f,
  violet: 0x9b5cff,
  white: 0xf4f6ff,
  grid: 0x1b2350,
} as const;

export type ThemeColor = keyof typeof theme;

/** Wandelt eine Farbe aus dem Theme in einen CSS-Hex-String um. */
export function cssColor(color: ThemeColor): string {
  return `#${theme[color].toString(16).padStart(6, "0")}`;
}
