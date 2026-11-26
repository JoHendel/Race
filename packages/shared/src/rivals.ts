/**
 * Rival system: the driver who overtook you most often (over the races of one session)
 * becomes your rival. Finishing ahead of your rival gives a bonus.
 */
export const RIVAL_MIN_PASSES = 2;
export const RIVAL_BONUS_POINTS = 1;
export const RIVAL_BONUS_XP = 60;

export class RivalBook {
  /** passer id → how often they overtook the local player */
  readonly passes = new Map<string, number>();

  /** `passerId` just overtook the local player. Returns true if this made them the (new) rival. */
  add(passerId: string): boolean {
    const before = this.rival();
    this.passes.set(passerId, (this.passes.get(passerId) ?? 0) + 1);
    return this.rival() !== before && this.rival() === passerId;
  }

  /** The rival, or null while nobody passed often enough. Ties keep the earlier rival. */
  rival(): string | null {
    let best: string | null = null;
    let bestN = RIVAL_MIN_PASSES - 1;
    for (const [id, n] of this.passes) {
      if (n > bestN) {
        best = id;
        bestN = n;
      }
    }
    return best;
  }

  /** Did the local player finish ahead of the rival? `order` = ids from first to last. */
  beaten(order: string[], me: string): boolean {
    const rival = this.rival();
    if (!rival) return false;
    const a = order.indexOf(me);
    const b = order.indexOf(rival);
    return a >= 0 && b >= 0 && a < b;
  }
}
