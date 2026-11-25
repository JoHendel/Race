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
