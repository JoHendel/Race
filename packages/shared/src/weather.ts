/** Weather and time of day of a race. */
export type Weather = "clear" | "rain" | "fog" | "night";
export const WEATHERS: Weather[] = ["clear", "rain", "fog", "night"];
/** What can be chosen in the menu / lobby ("random" is resolved once before the race). */
export type WeatherChoice = Weather | "random";
export const WEATHER_CHOICES: WeatherChoice[] = ["clear", "rain", "fog", "night", "random"];

/** German UI labels (translated in i18n). */
export const WEATHER_NAMES: Record<WeatherChoice, string> = {
  clear: "Klar",
  rain: "Regen",
  fog: "Nebel",
  night: "Nacht",
  random: "Zufall",
};

/** Grip factor for the whole track (multiplies with surfaces like ice). Same for every driver. */
export function weatherGrip(w: Weather): number {
  return w === "rain" ? 0.8 : 1;
}

/** Turn a choice into the weather of a race. */
export function resolveWeather(choice: WeatherChoice | undefined, rnd: () => number): Weather {
  if (!choice) return "clear";
  if (choice !== "random") return choice;
  return WEATHERS[Math.min(WEATHERS.length - 1, Math.floor(rnd() * WEATHERS.length))]!;
}

export function isWeatherChoice(v: unknown): v is WeatherChoice {
  return typeof v === "string" && (WEATHER_CHOICES as string[]).includes(v);
}
