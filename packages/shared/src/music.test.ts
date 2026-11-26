import { describe, expect, it } from "vitest";
import { SONGS, STEPS_PER_BAR, chordTones, loopSteps, midiToFreq, stepDuration, stepEvents } from "./music";

describe("music", () => {
  it("converts notes and tempo", () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(57)).toBeCloseTo(220);
    expect(stepDuration(120)).toBeCloseTo(0.125);
  });

  it("all patterns are 16 steps and use only valid symbols", () => {
    for (const song of Object.values(SONGS)) {
      for (const p of [song.bass, song.arp, song.lead, song.kick, song.snare, song.hat]) {
        if (p === undefined) continue;
        expect(p).toHaveLength(STEPS_PER_BAR);
        expect(p).toMatch(/^[x.0-3]+$/);
      }
    }
  });

  it("plays the kick on the downbeat and follows the chords", () => {
    const race = SONGS.race;
    const first = stepEvents(race, 0);
    expect(first.some((e) => e.voice === "kick")).toBe(true);
    const bass0 = first.find((e) => e.voice === "bass")!;
    const bass1 = stepEvents(race, STEPS_PER_BAR).find((e) => e.voice === "bass")!;
    expect(bass0.freq).toBeCloseTo(midiToFreq(45)); // A, one octave down
    expect(bass1.freq).toBeCloseTo(midiToFreq(41)); // F
    expect(chordTones(57, "m")).toEqual([57, 60, 64, 69]);
  });

  it("loops and gets faster and busier towards the final lap", () => {
    expect(stepEvents(SONGS.race, 3).map((e) => e.voice)).toEqual(stepEvents(SONGS.race, 3 + loopSteps(SONGS.race)).map((e) => e.voice));
    expect(SONGS.final.bpm).toBeGreaterThan(SONGS.race.bpm);
    expect(SONGS.race.bpm).toBeGreaterThan(SONGS.menu.bpm);
    const count = (id: "race" | "final") => Array.from({ length: 64 }, (_, i) => stepEvents(SONGS[id], i).length).reduce((a, b) => a + b, 0);
    expect(count("final")).toBeGreaterThan(count("race"));
  });
});
