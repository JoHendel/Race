import { describe, expect, it } from "vitest";
import { distanceGain, engineRpm, engineVoice, effectiveVolume, parseAudioSettings, squealGain } from "./audio";

describe("audio", () => {
  it("shifts through 5 gears: rpm drops after each shift", () => {
    expect(engineRpm(0, 50)).toEqual({ gear: 1, rpm: 0 });
    const a = engineRpm(9.9, 50);
    const b = engineRpm(10.1, 50);
    expect(a.gear).toBe(1);
    expect(b.gear).toBe(2);
    expect(b.rpm).toBeLessThan(a.rpm);
    expect(engineRpm(50, 50).gear).toBe(5);
    expect(engineRpm(80, 50).rpm).toBe(1);
  });

  it("engine is higher with rpm, louder with throttle, deeper for muscle cars", () => {
    expect(engineVoice(1, 0, "street").freq).toBeGreaterThan(engineVoice(0.3, 0, "street").freq);
    expect(engineVoice(0.5, 1, "street").gain).toBeGreaterThan(engineVoice(0.5, 0, "street").gain);
    expect(engineVoice(0.5, 1, "muscle").freq).toBeLessThan(engineVoice(0.5, 1, "hyper").freq);
  });

  it("tyres squeal only when sliding at speed", () => {
    expect(squealGain(0.6, 3, true)).toBe(0);
    expect(squealGain(0.05, 30, false)).toBe(0);
    expect(squealGain(0.6, 30, true)).toBeGreaterThan(squealGain(0.2, 30, true));
  });

  it("fades with distance", () => {
    expect(distanceGain(0)).toBe(1);
    expect(distanceGain(200)).toBe(0);
    expect(distanceGain(30)).toBeGreaterThan(distanceGain(60));
  });

  it("reads stored settings safely", () => {
    expect(parseAudioSettings(null)).toEqual({ volume: 0.7, music: 0.5, muted: false });
    expect(parseAudioSettings('{"volume":3,"muted":true}')).toEqual({ volume: 1, music: 0.5, muted: true });
    expect(parseAudioSettings('{"music":0.2}').music).toBe(0.2);
    expect(parseAudioSettings("{oops")).toEqual({ volume: 0.7, music: 0.5, muted: false });
    expect(effectiveVolume({ volume: 0.5, music: 0.5, muted: true })).toBe(0);
  });
});
