/** Emotes and horns: small social effects that are shown to every player. */
export const EMOTES = ["🏆", "😎", "🔥", "🎉", "😤", "👋"] as const;
export type Emote = (typeof EMOTES)[number];
export type FxKind = "emote" | "horn";

export function isEmote(v: unknown): v is Emote {
  return typeof v === "string" && (EMOTES as readonly string[]).includes(v);
}

export interface HornSound {
  /** Two tones played together (Hz). */
  freqs: [number, number];
  wave: "square" | "sawtooth" | "triangle";
  /** Length of one honk (s). */
  length: number;
}

const HORNS: HornSound[] = [
  { freqs: [392, 494], wave: "square", length: 0.45 }, // bright two-tone
  { freqs: [262, 330], wave: "sawtooth", length: 0.55 }, // deep truck
  { freqs: [523, 659], wave: "triangle", length: 0.3 }, // little beep
  { freqs: [311, 370], wave: "sawtooth", length: 0.5 }, // muscle growl
  { freqs: [440, 466], wave: "square", length: 0.4 }, // nasty clash
  { freqs: [587, 784], wave: "triangle", length: 0.35 }, // hyper chime
];

/** Every car model has its own horn; the same id always gives the same sound. */
export function hornFor(carId: string): HornSound {
  let h = 0;
  for (let i = 0; i < carId.length; i++) h = (h * 31 + carId.charCodeAt(i)) >>> 0;
  return HORNS[h % HORNS.length]!;
}

/** Per-player spam protection: at most one effect every `gap` seconds. */
export class FxLimiter {
  private readonly last = new Map<string, number>();

  constructor(private readonly gap = 0.6) {}

  allow(id: string, now: number): boolean {
    const prev = this.last.get(id);
    if (prev !== undefined && now - prev < this.gap) return false;
    this.last.set(id, now);
    return true;
  }
}
