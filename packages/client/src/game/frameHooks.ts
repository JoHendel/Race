/** Callbacks that run right after the next frame was drawn (canvas content still readable). */
const pending: (() => void)[] = [];

export function afterNextFrame(cb: () => void): void {
  pending.push(cb);
}

export function runFrameHooks(): void {
  while (pending.length) pending.shift()!();
}
