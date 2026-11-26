import { describe, expect, it } from "vitest";
import { pickCandidates, tallyVotes } from "./voting";

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("track vote", () => {
  it("picks three different tracks", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    for (let k = 0; k < 20; k++) {
      const c = pickCandidates(ids, Math.random);
      expect(c).toHaveLength(3);
      expect(new Set(c).size).toBe(3);
      for (const x of c) expect(ids).toContain(x);
    }
  });

  it("never picks more candidates than there are tracks", () => {
    expect(pickCandidates(["a", "b"], Math.random)).toHaveLength(2);
  });

  it("the track with the most votes wins", () => {
    const r = tallyVotes(["a", "b", "c"], ["b", "b", "a"], seq(0.9));
    expect(r.winner).toBe("b");
    expect(r.tie).toEqual(["b"]);
    expect(r.counts).toEqual({ a: 1, b: 2, c: 0 });
  });

  it("a tie is decided by the wheel among the tied tracks only", () => {
    expect(tallyVotes(["a", "b", "c"], ["a", "c"], seq(0)).winner).toBe("a");
    expect(tallyVotes(["a", "b", "c"], ["a", "c"], seq(0.99)).winner).toBe("c");
    expect(tallyVotes(["a", "b", "c"], ["a", "c"], seq(0.5)).tie).toEqual(["a", "c"]);
  });

  it("without votes all candidates are tied; unknown votes are ignored", () => {
    const r = tallyVotes(["a", "b", "c"], ["x"], seq(0.4));
    expect(r.tie).toEqual(["a", "b", "c"]);
    expect(r.winner).toBe("b");
  });
});
