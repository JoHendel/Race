import { GRAND_CIRCUIT, NEON_HARBOR, SKYLINE_LOOP, SUNSET_CANYON, mirrorTrack, type TrackDef } from "@apex/shared";
import { HeadlessRace, mulberry32, type Controller, type RacerSpec, type RaceSummary } from "@apex/sim";
import { Mlp, train, type Dataset, type MlpJson } from "./mlp";
import { OBS_SIZE, observeRacer } from "./observation";
import { AiDriver } from "./driver";

/** Fixed configuration so that every run is reproducible. */
export const CONFIG = {
  seed: 2026,
  /** Split by track (not by sample) so that validation and test tracks are never seen in training. */
  split: {
    train: [NEON_HARBOR, SUNSET_CANYON],
    validation: [SKYLINE_LOOP],
    test: [GRAND_CIRCUIT],
  },
  mirror: true,
  racesPerTrack: 3,
  lapsPerRace: 2,
  botsPerRace: 9,
  /** Record every n-th physics step (60 Hz → 15 samples per second and car). */
  sampleEvery: 4,
  hidden: [32, 32],
  epochs: 25,
  batchSize: 256,
  learningRate: 0.002,
  evalRaces: 3,
};

export type SplitName = "train" | "validation" | "test";

export interface Sample {
  x: Float32Array;
  /** steer, throttle (−1 = full brake … 1 = full throttle), drift (0/1), nitro (0/1) */
  y: [number, number, number, number];
  track: string;
  split: SplitName;
  run: number;
  valid: boolean;
  invalidReason?: string;
}

export function tracksOf(split: SplitName): TrackDef[] {
  const base = CONFIG.split[split];
  return CONFIG.mirror ? [...base, ...base.map(mirrorTrack)] : base;
}

/** CRISP-DM phase 2/3: record telemetry of the rule-based bots in the headless simulation. */
export async function recordDataset(log: (s: string) => void = () => {}): Promise<{ samples: Sample[]; runs: number; simSeconds: number }> {
  await HeadlessRace.init();
  const samples: Sample[] = [];
  let runs = 0;
  let simSeconds = 0;
  for (const split of ["train", "validation", "test"] as SplitName[]) {
    for (const track of tracksOf(split)) {
      for (let r = 0; r < CONFIG.racesPerTrack; r++) {
        const seed = CONFIG.seed + runs * 17;
        const specs: RacerSpec[] = Array.from({ length: CONFIG.botsPerRace }, (_, i) => ({
          id: `bot-${i}`,
          skill: i % 3 === 0 ? "hard" : "normal",
        }));
        const race = new HeadlessRace(track, specs, CONFIG.lapsPerRace, seed);
        const lastResets = new Map<string, number>();
        race.onStep = (rc) => {
          if (rc.steps % CONFIG.sampleEvery !== 0) return;
          for (const racer of rc.racers) {
            if (racer.tracker.finished) continue;
            const c = racer.controls;
            const resetNow = racer.car.resets !== (lastResets.get(racer.id) ?? 0);
            lastResets.set(racer.id, racer.car.resets);
            const x = observeRacer(rc, racer);
            const finite = x.every((v) => Number.isFinite(v));
            const valid = finite && !resetNow && rc.time > 1;
            samples.push({
              x: Float32Array.from(x),
              y: [c.steer, c.throttle - c.brake, c.drift ? 1 : 0, c.nitro ? 1 : 0],
              track: track.id,
              split,
              run: runs,
              valid,
              invalidReason: valid ? undefined : !finite ? "non-finite value" : resetNow ? "car reset" : "race start",
            });
          }
        };
        race.run(400);
        simSeconds += race.time;
        race.dispose();
        runs++;
        log(`recorded ${track.id} race ${r + 1}/${CONFIG.racesPerTrack} (${samples.length} samples so far)`);
      }
    }
  }
  return { samples, runs, simSeconds };
}

export function toDataset(samples: Sample[]): Dataset {
  const n = samples.length;
  const x = new Float32Array(n * OBS_SIZE);
  const y = new Float32Array(n * 4);
  samples.forEach((s, i) => {
    x.set(s.x, i * OBS_SIZE);
    y.set(s.y, i * 4);
  });
  return { x, y, n, inputs: OBS_SIZE };
}

/** CRISP-DM phase 4: behavior cloning. */
export function trainModel(samples: Sample[], log: (s: string) => void = () => {}) {
  const rnd = mulberry32(CONFIG.seed);
  const clean = samples.filter((s) => s.valid);
  const trainSet = toDataset(clean.filter((s) => s.split === "train"));
  const valSet = toDataset(clean.filter((s) => s.split === "validation"));
  // Class weights against the imbalance of drift and nitro (rare events).
  const pos = (k: number) => clean.filter((s) => s.split === "train" && s.y[k]! > 0.5).length;
  const posWeight: [number, number] = [
    Math.min(10, (trainSet.n - pos(2)) / Math.max(1, pos(2))),
    Math.min(10, (trainSet.n - pos(3)) / Math.max(1, pos(3))),
  ];
  const model = new Mlp([OBS_SIZE, ...CONFIG.hidden, 4], rnd);
  const history = train(model, trainSet, valSet, {
    epochs: CONFIG.epochs,
    batchSize: CONFIG.batchSize,
    lr: CONFIG.learningRate,
    posWeight,
    rnd,
    onEpoch: (e, tr, va) => log(`epoch ${e}: train loss ${tr.toFixed(4)}, validation loss ${va.toFixed(4)}`),
  });
  return { model, history, posWeight, trainSize: trainSet.n, valSize: valSet.n };
}

/** Controller that drives a car with the neural network. */
export function aiController(model: Mlp): Controller {
  const driver = new AiDriver(model);
  return ({ self, race, dt }) => driver.drive(self.car, race.track, self.index, race.racers.filter((r) => r !== self).map((r) => r.car), dt);
}

export interface EvalRow {
  track: string;
  run: number;
  driver: "apex-ai" | "apex-ai-v1" | "rule-bot";
  summary: RaceSummary;
}

/** CRISP-DM phase 5: let the AI race on the unseen test tracks, compared with a rule-based bot in the same slot. */
export async function evaluateModel(model: Mlp, tracks: TrackDef[] = tracksOf("test"), previous?: Mlp): Promise<EvalRow[]> {
  await HeadlessRace.init();
  const rows: EvalRow[] = [];
  for (const track of tracks) {
    for (let run = 0; run < CONFIG.evalRaces; run++) {
      const drivers = previous ? (["apex-ai", "apex-ai-v1", "rule-bot"] as const) : (["apex-ai", "rule-bot"] as const);
      for (const driver of drivers) {
        const specs: RacerSpec[] = Array.from({ length: CONFIG.botsPerRace }, (_, i) => ({ id: `bot-${i}`, skill: "normal" as const }));
        // The candidate starts in the middle of the field (slot 4).
        specs.splice(
          4,
          0,
          driver === "rule-bot"
            ? { id: "candidate", skill: "hard" }
            : { id: "candidate", controller: aiController(driver === "apex-ai" ? model : previous!) },
        );
        const race = new HeadlessRace(track, specs, CONFIG.lapsPerRace, CONFIG.seed + 1000 + run);
        const summary = race.run(400).find((s) => s.id === "candidate")!;
        race.dispose();
        rows.push({ track: track.id, run, driver, summary });
      }
    }
  }
  return rows;
}

export function modelJson(model: Mlp, extra: Record<string, unknown>): MlpJson {
  return model.toJSON({ name: "APEX-AI", features: OBS_SIZE, seed: CONFIG.seed, ...extra });
}
