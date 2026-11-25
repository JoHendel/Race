import { describe, expect, it } from "vitest";
import { GLACIER_RIFT, NEON_HARBOR, TRACKS, surfaceGripAt, trackById } from "./tracks";
import { translate } from "./i18n";

describe("tracks", () => {
  it("have unique ids and can be found by id", () => {
    const ids = TRACKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TRACKS) expect(trackById(t.id)).toBe(t);
  });

  it("each have a description with an English translation", () => {
    for (const t of TRACKS) {
      expect(t.blurb, t.id).toBeTruthy();
      expect(translate(t.blurb!, "en"), t.id).not.toBe(t.blurb);
    }
  });

  it("the Neon Cup has four tracks", () => {
    expect(TRACKS.filter((t) => t.cup === "neon")).toHaveLength(4);
  });

  it("report the surface grip along the lap", () => {
    expect(surfaceGripAt(NEON_HARBOR, 0.25)).toBe(1);
    expect(surfaceGripAt(GLACIER_RIFT, 0.25)).toBeLessThan(1);
    expect(surfaceGripAt(GLACIER_RIFT, 0.4)).toBe(1);
    expect(surfaceGripAt(GLACIER_RIFT, 1.25)).toBeLessThan(1);
  });

  it("handle zones that wrap around the start line", () => {
    const def = { ...NEON_HARBOR, surfaces: [{ from: 0.95, to: 0.05, grip: 0.5, kind: "ice" as const }] };
    expect(surfaceGripAt(def, 0.98)).toBe(0.5);
    expect(surfaceGripAt(def, 0.02)).toBe(0.5);
    expect(surfaceGripAt(def, 0.5)).toBe(1);
  });
});
