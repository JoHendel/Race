import { describe, expect, it } from "vitest";
import { EN, detectLang, translate } from "./i18n";

describe("i18n", () => {
  it("leaves German untouched", () => {
    expect(translate("Rennen starten", "de")).toBe("Rennen starten");
  });
  it("translates exact phrases and keeps whitespace", () => {
    expect(translate("Rennen starten", "en")).toBe("Start race");
    expect(translate("  Zurück ", "en")).toBe("  Back ");
  });
  it("translates texts with numbers", () => {
    expect(translate("RUNDE 2/3", "en")).toBe("LAP 2/3");
    expect(translate("Neon Harbor · 5 Runden · mit Bots", "en")).toBe("Neon Harbor · 5 laps · with bots");
    expect(translate("Neon Harbor · 3 Runden", "en")).toBe("Neon Harbor · 3 laps");
    expect(translate("von Platz 7 auf 2", "en")).toBe("from P7 to P2");
    expect(translate("Felgen · 200 Cr", "en")).toBe("Rims · 200 Cr");
  });
  it("leaves unknown texts (names, numbers) unchanged", () => {
    expect(translate("Nova", "en")).toBe("Nova");
    expect(translate("0:38.950", "en")).toBe("0:38.950");
  });
  it("has no empty translations", () => {
    for (const [de, en] of Object.entries(EN)) expect(en.length, de).toBeGreaterThan(0);
  });
  it("detects the language", () => {
    expect(detectLang("en", "de-DE")).toBe("en");
    expect(detectLang(null, "de-AT")).toBe("de");
    expect(detectLang(null, "fr-FR")).toBe("en");
  });
});

describe("i18n and names", () => {
  it("never translates bot names", async () => {
    const names = ["Nova", "Blaze", "Rook", "Vera", "Kaito", "Mika", "Dash", "Juno", "Zed", "APEX-AI"];
    for (const n of names) expect(translate(n, "en")).toBe(n);
  });
});
