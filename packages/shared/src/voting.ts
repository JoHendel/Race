/** Track vote in the online lobby: 3 random tracks, everyone votes, a wheel decides ties. */

export const VOTE_CANDIDATES = 3;
/** Seconds the vote stays open (it ends earlier when everyone has voted). */
export const VOTE_SECONDS = 12;

/** Pick `count` different track ids at random. */
export function pickCandidates(ids: string[], rnd: () => number, count = VOTE_CANDIDATES): string[] {
  const pool = [...ids];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

export interface VoteResult {
  winner: string;
  /** Candidates with the most votes; more than one means the wheel decided. */
  tie: string[];
  counts: Record<string, number>;
}

/** Count the votes (votes for other tracks are ignored). Without any vote all candidates are tied. */
export function tallyVotes(candidates: string[], votes: string[], rnd: () => number): VoteResult {
  const counts: Record<string, number> = Object.fromEntries(candidates.map((c) => [c, 0]));
  for (const v of votes) if (v in counts) counts[v]!++;
  const max = Math.max(...Object.values(counts));
  const tie = candidates.filter((c) => counts[c] === max);
  const winner = tie.length === 1 ? tie[0]! : tie[Math.min(tie.length - 1, Math.floor(rnd() * tie.length))]!;
  return { winner, tie, counts };
}
