import type { CarClass } from "./cars";

/** Pure audio maths (gearbox, engine voice, mixing, settings) – the WebAudio part lives in the client. */

export const GEARS = 5;

/**
 * Simulated gearbox: maps speed to gear and engine speed (0 = idle, 1 = redline).
 * Each gear covers an equal share of the top speed; inside a gear the engine climbs from 0.3 to 1.
 */
export function engineRpm(speed: number, topSpeed: number): { gear: number; rpm: number } {
  const f = Math.min(1.05, Math.abs(speed) / Math.max(1, topSpeed));
  if (f < 0.02) return { gear: 1, rpm: 0 };
  const g = Math.min(GEARS - 1, Math.floor(f * GEARS));
  const inGear = f * GEARS - g;
  return { gear: g + 1, rpm: Math.min(1, 0.3 + inGear * 0.7) };
}

export interface EngineVoice {
  /** Fundamental frequency (Hz). */
  freq: number;
  /** 0–1 loudness before the master volume. */
  gain: number;
  /** Lowpass cutoff (Hz): opens up with throttle. */
  cutoff: number;
}

const BASE_FREQ: Record<CarClass, number> = { street: 62, drift: 70, muscle: 44, hyper: 82 };

export function engineVoice(rpm: number, throttle: number, cls: CarClass, boosting = false): EngineVoice {
  const base = BASE_FREQ[cls];
  const t = Math.max(0, Math.min(1, throttle));
  return {
    freq: base * (1 + rpm * 2.4) * (boosting ? 1.08 : 1),
    gain: 0.18 + 0.22 * t + 0.1 * rpm,
    cutoff: 500 + 1800 * t + 1400 * rpm + (boosting ? 800 : 0),
  };
}

/** Tyre squeal loudness from slip angle (rad) and speed (m/s). */
export function squealGain(slip: number, speed: number, drifting: boolean): number {
  if (Math.abs(speed) < 6) return 0;
  const s = Math.min(1, Math.max(0, (Math.abs(slip) - 0.12) / 0.5));
  return Math.min(1, (drifting ? 0.35 + s * 0.65 : s * 0.5) * Math.min(1, Math.abs(speed) / 20));
}

/** Loudness for a sound at `dist` metres (linear fall-off to 0 at `maxDist`). */
export function distanceGain(dist: number, maxDist = 120): number {
  return Math.max(0, 1 - dist / maxDist) ** 1.5;
}

export interface AudioSettings {
  /** 0–1, everything */
  volume: number;
  /** 0–1, music relative to the main volume */
  music: number;
  muted: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = { volume: 0.7, music: 0.5, muted: false };

/** Read stored settings; broken or missing data gives the defaults. */
export function parseAudioSettings(text: string | null): AudioSettings {
  try {
    const j = JSON.parse(text ?? "") as Partial<AudioSettings>;
    const level = (v: unknown, def: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : def);
    return { volume: level(j.volume, DEFAULT_AUDIO.volume), music: level(j.music, DEFAULT_AUDIO.music), muted: j.muted === true };
  } catch {
    return { ...DEFAULT_AUDIO };
  }
}

export function effectiveVolume(s: AudioSettings): number {
  return s.muted ? 0 : s.volume;
}
