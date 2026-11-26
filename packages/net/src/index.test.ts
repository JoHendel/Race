import { describe, expect, it } from "vitest";
import { createRoomCode } from "./index";

describe("createRoomCode", () => {
  it("erzeugt 5 Zeichen ohne verwechselbare Zeichen", () => {
    for (let i = 0; i < 200; i++) {
      const code = createRoomCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    }
  });
});

describe("joinRole", () => {
  it("lets new players race in the lobby, watch during a race, and stops at 10", async () => {
    const { joinRole } = await import("./protocol");
    expect(joinRole(3, 10, false)).toBe("player");
    expect(joinRole(3, 10, true)).toBe("spectator");
    expect(joinRole(10, 10, true)).toBe("full");
    expect(joinRole(10, 10, false)).toBe("full");
  });
});
