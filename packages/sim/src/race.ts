import RAPIER from "@dimforge/rapier3d-compat";
import { LapTracker, carById, statsFor, stockTuning, trackGravity, weatherGrip, type TrackDef, type Tuning, type Weather } from "@apex/shared";
import { ItemSystem, type ItemEvent, type ItemRacer } from "./items";
import { BotDriver, type BotSkill } from "./bot";
import { IDLE_CONTROLS, type ControlState } from "./controls";
import { mulberry32 } from "./random";
import { TrackGeometry } from "./track";
import { VehiclePhysics, wheelLayout } from "./vehicle";

export const SIM_STEP = 1 / 60;

/** Everything a controller may look at in one step. */
export interface DriverContext {
  self: SimRacer;
  race: HeadlessRace;
  dt: number;
}

export type Controller = (ctx: DriverContext) => ControlState;

export interface RacerSpec {
  id: string;
  carId?: string;
  tuning?: Tuning;
  /** Rule-based bot skill, or a custom controller (e.g. the AI driver). */
  skill?: BotSkill;
  controller?: Controller;
}

export interface SimRacer {
  id: string;
  car: VehiclePhysics;
  tracker: LapTracker;
  bot: BotDriver | null;
  controller: Controller | null;
  index: number;
  /** Last controls applied (what the driver "did" this step). */
  controls: ControlState;
  wallContacts: number;
  wrongWaySteps: number;
  /** Sum of |lateral offset| for the mean distance to the racing line. */
  lateralSum: number;
  lateralSamples: number;
  private_inWall?: boolean;
}

export interface RaceSummary {
  id: string;
  finished: boolean;
  finishTime: number | null;
  bestLap: number | null;
  lapTimes: number[];
  progress: number;
  wallContacts: number;
  resets: number;
  meanLateralOffset: number;
  place: number;
}

/**
 * A complete race without graphics. Runs in Node faster than real time.
 * Uses the same physics, tracks, lap counting and bots as the game.
 */
export class HeadlessRace {
  readonly world: RAPIER.World;
  readonly track: TrackGeometry;
  readonly racers: SimRacer[] = [];
  time = 0;
  steps = 0;
  /** Called after every physics step (used to record telemetry). */
  onStep?: (race: HeadlessRace) => void;
  /** Chaos mode item system (null in normal races). */
  items: ItemSystem | null = null;
  /** Item events of the race (for tests and statistics). */
  readonly itemEvents: ItemEvent[] = [];

  constructor(
    def: TrackDef,
    specs: RacerSpec[],
    readonly laps: number,
    seed = 1,
    weather: Weather = "clear",
    chaos = false,
  ) {
    this.world = new RAPIER.World({ x: 0, y: -trackGravity(def), z: 0 });
    this.world.timestep = SIM_STEP;
    this.track = new TrackGeometry(this.world, def);
    this.track.weatherGrip = weatherGrip(weather);
    // separate random stream, so chaos mode does not change anything else in the race
    if (chaos) this.items = new ItemSystem(this.track, mulberry32(seed ^ 0x5eed));
    const rnd = mulberry32(seed);
    specs.slice(0, 10).forEach((spec, slot) => {
      const carDef = carById(spec.carId ?? "volt-hatch");
      const car = new VehiclePhysics(this.world, statsFor(carDef, spec.tuning ?? stockTuning()), {}, wheelLayout(carDef));
      car.groundPress = Math.max(0, 9.81 - trackGravity(def));
      const { pos, yaw } = this.track.gridSlot(slot);
      car.setResetPose(pos, yaw);
      car.reset();
      car.resets = 0;
      const index = this.track.nearestIndex(pos);
      const tracker = new LapTracker(laps);
      tracker.update(index / this.track.samples.length, 0);
      this.racers.push({
        id: spec.id,
        car,
        tracker,
        bot: spec.controller ? null : new BotDriver(car, this.track, spec.skill ?? "normal", rnd),
        controller: spec.controller ?? null,
        index,
        controls: IDLE_CONTROLS,
        wallContacts: 0,
        wrongWaySteps: 0,
        lateralSum: 0,
        lateralSamples: 0,
      });
    });
  }

  static async init(): Promise<void> {
    await RAPIER.init();
  }

  get finished(): boolean {
    return this.racers.every((r) => r.tracker.finished);
  }

  /** One physics step for all cars. */
  step(): void {
    const n = this.track.samples.length;
    for (const r of this.racers) {
      let c: ControlState;
      if (r.tracker.finished) c = { ...IDLE_CONTROLS, brake: r.car.speed > 3 ? 0.5 : 0 };
      else if (r.controller) c = r.controller({ self: r, race: this, dt: SIM_STEP });
      else c = r.bot!.drive(SIM_STEP);
      r.controls = c;
      r.car.setSurfaceGrip(this.track.gripAt(r.index));
      if (this.track.lava) r.car.applyDrag(this.track.lavaDrag(r.index, this.track.lateralOffset(r.car.position, r.index)), SIM_STEP);
      r.car.update(c, SIM_STEP);
    }
    if (this.items) this.stepItems();
    if (this.track.hasEvents) this.track.updateEvents(Math.max(...this.racers.map((r) => r.tracker.lap)), SIM_STEP);
    this.world.step();
    this.time += SIM_STEP;
    this.steps++;

    for (const r of this.racers) {
      const p = r.car.position;
      const loc = this.track.locate(p, r.index);
      r.index = loc.index;
      r.tracker.update(r.index / n, this.time);
      if (loc.shortcut && loc.u > 0.4 && loc.u < 0.6) r.tracker.creditShortcut(loc.shortcut.def.from, loc.shortcut.def.to);
      // Reset pose follows the track.
      const back = this.track.sample(r.index - 2);
      r.car.setResetPose(back.pos, Math.atan2(back.tangent.x, back.tangent.z));
      if (r.tracker.finished) continue;
      const lateral = this.track.lateralOffset(p, r.index);
      r.lateralSum += Math.abs(lateral);
      r.lateralSamples++;
      // inside a shortcut the distance to the main track says nothing about walls
      const inWall = !loc.shortcut && Math.abs(lateral) > this.track.wallOffset - 1.3;
      if (inWall && !r.private_inWall) r.wallContacts++;
      r.private_inWall = inWall;
      const t = this.track.sample(r.index).tangent;
      const fwd = r.car.forward();
      if (fwd.x * t.x + fwd.z * t.z < -0.3 && Math.abs(r.car.speed) > 3) r.wrongWaySteps++;
    }
    this.onStep?.(this);
  }

  private stepItems(): void {
    const items = this.items!;
    const order = [...this.racers].sort((a, b) => b.tracker.progress - a.tracker.progress);
    const list: ItemRacer[] = this.racers.map((r) => ({ id: r.id, car: r.car, index: r.index, place: order.indexOf(r) + 1, progress: r.tracker.progress }));
    this.itemEvents.push(...items.update(list, SIM_STEP));
    for (const r of list) if (!this.racers.find((x) => x.id === r.id)!.tracker.finished && items.wantsToUse(r, list)) this.itemEvents.push(...items.use(r, list));
  }

  /** Runs until everyone has finished or the time limit is reached. */
  run(maxSeconds = 600): RaceSummary[] {
    while (!this.finished && this.time < maxSeconds) this.step();
    return this.summary();
  }

  summary(): RaceSummary[] {
    const ranked = [...this.racers].sort((a, b) => {
      const fa = a.tracker.finishTime;
      const fb = b.tracker.finishTime;
      if (fa !== null && fb !== null) return fa - fb;
      if (fa !== null) return -1;
      if (fb !== null) return 1;
      return b.tracker.progress - a.tracker.progress;
    });
    return this.racers.map((r) => ({
      id: r.id,
      finished: r.tracker.finished,
      finishTime: r.tracker.finishTime,
      bestLap: r.tracker.bestLap,
      lapTimes: [...r.tracker.lapTimes],
      progress: r.tracker.progress,
      wallContacts: r.wallContacts,
      resets: r.car.resets,
      meanLateralOffset: r.lateralSamples ? r.lateralSum / r.lateralSamples : 0,
      place: ranked.indexOf(r) + 1,
    }));
  }

  dispose(): void {
    this.world.free();
  }
}
