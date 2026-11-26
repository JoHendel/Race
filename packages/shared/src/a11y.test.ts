import { describe, expect, it } from "vitest";
import { COLORBLIND_RACER_COLORS, DEFAULT_KEYS, KEY_ACTIONS, keyLabel, parseA11y, racerColor, rebind } from "./a11y";

describe("accessibility settings", () => {
  it("rebinding moves a key and keeps every key unique", () => {
    const k = rebind(DEFAULT_KEYS, "drift", "KeyW");
    expect(k.drift[0]).toBe("KeyW");
    expect(k.throttle).toEqual(["ArrowUp"]);
    const all = KEY_ACTIONS.flatMap((a) => k[a]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("keeps the second key of the action", () => {
    expect(rebind(DEFAULT_KEYS, "throttle", "KeyI").throttle).toEqual(["KeyI", "ArrowUp"]);
  });

  it("refuses reserved keys", () => {
    expect(rebind(DEFAULT_KEYS, "horn", "Escape")).toBe(DEFAULT_KEYS);
    expect(rebind(DEFAULT_KEYS, "horn", "KeyM")).toBe(DEFAULT_KEYS);
  });

  it("parses stored settings safely", () => {
    expect(parseA11y(null).keys).toEqual(DEFAULT_KEYS);
    const s = parseA11y(JSON.stringify({ colorblind: true, keys: { drift: ["KeyJ"], nitro: ["<b>"] } }));
    expect(s.colorblind).toBe(true);
    expect(s.captions).toBe(false);
    expect(s.keys.drift).toEqual(["KeyJ"]);
    expect(s.keys.nitro).toEqual(DEFAULT_KEYS.nitro);
    expect(parseA11y("{broken").colorblind).toBe(false);
  });

  it("labels keys readably", () => {
    expect(keyLabel("KeyW")).toBe("W");
    expect(keyLabel("ArrowLeft")).toBe("←");
    expect(keyLabel("Digit3")).toBe("3");
  });

  it("colour-blind palette has 10 distinct colours", () => {
    expect(new Set(COLORBLIND_RACER_COLORS).size).toBe(10);
    expect(racerColor(0x123456, 2, false)).toBe(0x123456);
    expect(racerColor(0x123456, 2, true)).toBe(COLORBLIND_RACER_COLORS[2]);
  });
});
