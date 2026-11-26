import { describe, expect, it } from "vitest";
import { RivalBook } from "./rivals";

describe("rivals", () => {
  it("needs two passes, then picks whoever passed most", () => {
    const b = new RivalBook();
    expect(b.add("bot-1")).toBe(false);
    expect(b.rival()).toBeNull();
    expect(b.add("bot-1")).toBe(true);
    expect(b.rival()).toBe("bot-1");
    b.add("bot-2");
    b.add("bot-2");
    expect(b.rival()).toBe("bot-1"); // tie keeps the earlier rival
    expect(b.add("bot-2")).toBe(true);
    expect(b.rival()).toBe("bot-2");
  });

  it("knows when the rival was beaten", () => {
    const b = new RivalBook();
    b.add("x");
    b.add("x");
    expect(b.beaten(["me", "x"], "me")).toBe(true);
    expect(b.beaten(["x", "me"], "me")).toBe(false);
    expect(new RivalBook().beaten(["me", "x"], "me")).toBe(false);
  });
});
