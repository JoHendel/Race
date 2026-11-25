import type { ControlState, TrackGeometry, VehiclePhysics } from "@apex/sim";
import { Mlp, type MlpJson } from "./mlp";
import { OBS_SIZE, observe } from "./observation";

/**
 * APEX-AI as a driver: observation → neural network → controls.
 * Works with any car and track that use the shared simulation classes (game and headless training).
 */
export class AiDriver {
  readonly model: Mlp;
  private readonly obs = new Float32Array(OBS_SIZE);
  private slowTime = 0;
  /** Last network outputs (for debugging and statistics). */
  last: Float32Array<ArrayBufferLike> = new Float32Array(4);

  constructor(model: Mlp | MlpJson) {
    this.model = model instanceof Mlp ? model : Mlp.fromJSON(model);
  }

  drive(car: VehiclePhysics, track: TrackGeometry, index: number, opponents: VehiclePhysics[], dt: number): ControlState {
    const y = this.model.predict(observe(track, car, index, opponents, this.obs));
    this.last = y;
    const steer = Math.max(-1, Math.min(1, y[0]!));
    const thr = Math.max(-1, Math.min(1, y[1]!));
    // Same self-rescue rule as the bots: stuck for 3 s → reset behind the car.
    this.slowTime = Math.abs(car.speed) < 2 ? this.slowTime + dt : 0;
    const reset = this.slowTime > 3;
    if (reset) {
      this.slowTime = 0;
      const back = track.sample(index - 3);
      car.setResetPose(back.pos, Math.atan2(back.tangent.x, back.tangent.z));
    }
    return { steer, throttle: Math.max(0, thr), brake: Math.max(0, -thr), drift: y[2]! > 0.5, nitro: y[3]! > 0.5, reset };
  }
}
