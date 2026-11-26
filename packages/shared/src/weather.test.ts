import { describe, expect, it } from "vitest";
import { WEATHERS, isWeatherChoice, resolveWeather, weatherGrip } from "./weather";
import { translate } from "./i18n";
import { WEATHER_NAMES } from "./weather";

describe("weather", () => {
  it("rain lowers the grip, the rest does not", () => {
    expect(weatherGrip("rain")).toBeLessThan(1);
    expect(weatherGrip("clear")).toBe(1);
    expect(weatherGrip("fog")).toBe(1);
    expect(weatherGrip("night")).toBe(1);
  });

  it("resolves random choices to a real weather and keeps fixed ones", () => {
    expect(resolveWeather("fog", () => 0.9)).toBe("fog");
    expect(resolveWeather(undefined, () => 0.9)).toBe("clear");
    for (const r of [0, 0.3, 0.6, 0.999]) expect(WEATHERS).toContain(resolveWeather("random", () => r));
  });

  it("validates choices and has an English label for each", () => {
    expect(isWeatherChoice("rain")).toBe(true);
    expect(isWeatherChoice("snow")).toBe(false);
    for (const label of Object.values(WEATHER_NAMES)) expect(translate(label, "en")).not.toBe(label);
  });
});
