/** Control state for one physics step, independent of the input device. */
export interface ControlState {
  throttle: number; // 0..1
  brake: number; // 0..1 (also reverse)
  steer: number; // -1 (left) .. 1 (right)
  drift: boolean;
  nitro: boolean;
  reset: boolean;
  /** Use the held item (chaos mode). Optional, so recorded AI data is unaffected. */
  item?: boolean;
}

export const IDLE_CONTROLS: ControlState = { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false, reset: false };
