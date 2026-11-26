/**
 * Procedural synthwave: a tiny step sequencer. Songs are data (tempo, chord progression,
 * patterns); `stepEvents` tells which notes sound on a 16th-note step. The client turns these
 * events into WebAudio voices.
 */
export type Voice = "bass" | "arp" | "lead" | "pad" | "kick" | "snare" | "hat";

export interface NoteEvent {
  voice: Voice;
  /** Frequency in Hz (0 for drums). */
  freq: number;
  /** Length in steps. */
  steps: number;
  /** 0–1 */
  velocity: number;
}

export interface Song {
  id: SongId;
  bpm: number;
  /** Chord roots as MIDI notes, one per bar. */
  chords: number[];
  /** Chord quality per bar: "m" = minor, "M" = major. */
  quality: ("m" | "M")[];
  /** 16-step patterns: "x" = hit, "." = rest; for melodic voices a digit = chord tone index. */
  bass: string;
  arp: string;
  lead?: string;
  kick: string;
  snare: string;
  hat: string;
  /** Pad holds the chord for the whole bar. */
  pad: boolean;
}

export type SongId = "menu" | "race" | "final";

export const STEPS_PER_BAR = 16;

export function midiToFreq(n: number): number {
  return 440 * 2 ** ((n - 69) / 12);
}

/** Length of one 16th-note step in seconds. */
export function stepDuration(bpm: number): number {
  return 60 / bpm / 4;
}

// A minor – F – C – G: the classic synthwave turn
const PROGRESSION = [57, 53, 48, 55];
const QUALITY: ("m" | "M")[] = ["m", "M", "M", "M"];

export const SONGS: Record<SongId, Song> = {
  menu: {
    id: "menu",
    bpm: 92,
    chords: PROGRESSION,
    quality: QUALITY,
    bass: "0...0...0...0.0.",
    arp: "0.1.2.1.0.1.2.3.",
    kick: "x.......x.......",
    snare: "....x.......x...",
    hat: "..x...x...x...x.",
    pad: true,
  },
  race: {
    id: "race",
    bpm: 120,
    chords: PROGRESSION,
    quality: QUALITY,
    bass: "0.00.00.0.00.00.",
    arp: "0120312001203120",
    kick: "x...x...x...x...",
    snare: "....x.......x...",
    hat: "x.x.x.x.x.x.x.xx",
    pad: false,
  },
  final: {
    id: "final",
    bpm: 134,
    chords: PROGRESSION,
    quality: QUALITY,
    bass: "0000000000000000",
    arp: "0123012301230123",
    lead: "2...1...3.2.1...",
    kick: "x...x...x...x.x.",
    snare: "....x.......x.xx",
    hat: "xxxxxxxxxxxxxxxx",
    pad: true,
  },
};

/** Chord tones (MIDI) of a bar: root, third, fifth, octave. */
export function chordTones(root: number, quality: "m" | "M"): number[] {
  return [root, root + (quality === "m" ? 3 : 4), root + 7, root + 12];
}

/** All notes that start on global step `step` of `song`. */
export function stepEvents(song: Song, step: number): NoteEvent[] {
  const bar = Math.floor(step / STEPS_PER_BAR) % song.chords.length;
  const s = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  const tones = chordTones(song.chords[bar]!, song.quality[bar]!);
  const out: NoteEvent[] = [];
  const melodic = (pattern: string | undefined, voice: Voice, octave: number, steps: number, velocity: number): void => {
    const c = pattern?.[s];
    if (!c || c === ".") return;
    const idx = c === "x" ? 0 : Number(c);
    out.push({ voice, freq: midiToFreq(tones[idx % tones.length]! + octave * 12), steps, velocity });
  };
  melodic(song.bass, "bass", -1, 1, 0.9);
  melodic(song.arp, "arp", 1, 1, s % 4 === 0 ? 0.8 : 0.55);
  melodic(song.lead, "lead", 2, 4, 0.7);
  if (song.pad && s === 0) for (const t of tones.slice(0, 3)) out.push({ voice: "pad", freq: midiToFreq(t), steps: STEPS_PER_BAR, velocity: 0.5 });
  for (const voice of ["kick", "snare", "hat"] as const) {
    if (song[voice][s] === "x") out.push({ voice, freq: 0, steps: 1, velocity: voice === "hat" ? (s % 2 ? 0.4 : 0.6) : 1 });
  }
  return out;
}

/** Steps in one full loop of the song. */
export function loopSteps(song: Song): number {
  return song.chords.length * STEPS_PER_BAR;
}
