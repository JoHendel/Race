import { HeadlessRace, mulberry32, type RacerSpec } from "@apex/sim";
import type { TrackDef } from "@apex/shared";
import { AiDriver } from "./driver";
import { Mlp } from "./mlp";
import { tracksOf } from "./pipeline";

/** Settings of stage 2 (fine-tuning with an evolution strategy). */
export const ES_CONFIG = {
  seed: 7,
  generations: 30,
  /** Antithetic pairs per generation (population = 2 × pairs). */
  pairs: 8,
  sigma: 0.02,
  /** Larger exploration for the output biases so that rare actions (nitro, drift) can be tried at all. */
  outputBiasSigma: 0.6,
  nitroSigma: 0.15,
  learningRate: 0.03,
  opponents: 3,
  laps: 1,
  maxSeconds: 90,
};

export interface FitnessDetail {
  fitness: number;
  progress: number;
  finished: boolean;
  time: number;
  wallContacts: number;
  resets: number;
  wrongWaySteps: number;
  nitroShare: number;
}

/**
 * Reward of one race: progress counts most, finishing faster gives a bonus,
 * wall contacts, resets and wrong-way driving are penalized.
 */
export function raceFitness(model: Mlp, track: TrackDef, seed: number): FitnessDetail {
  const driver = new AiDriver(model);
  let nitroSteps = 0;
  let steps = 0;
  const specs: RacerSpec[] = Array.from({ length: ES_CONFIG.opponents }, (_, i) => ({ id: `bot-${i}`, skill: "normal" as const }));
  specs.splice(1, 0, {
    id: "ai",
    controller: ({ self, race, dt }) => {
      const c = driver.drive(self.car, race.track, self.index, race.racers.filter((r) => r !== self).map((r) => r.car), dt);
      steps++;
      if (c.nitro) nitroSteps++;
      return c;
    },
  });
  const race = new HeadlessRace(track, specs, ES_CONFIG.laps, seed);
  while (!race.racers[1]!.tracker.finished && race.time < ES_CONFIG.maxSeconds) race.step();
  const ai = race.racers[1]!;
  const progress = Math.max(0, ai.tracker.progress);
  const finished = ai.tracker.finished;
  const time = finished ? ai.tracker.finishTime! : race.time;
  const fitness = progress * 100 + (finished ? ES_CONFIG.maxSeconds - time : 0) - ai.wallContacts * 3 - ai.car.resets * 8 - ai.wrongWaySteps * 0.05;
  race.dispose();
  return { fitness, progress, finished, time, wallContacts: ai.wallContacts, resets: ai.car.resets, wrongWaySteps: ai.wrongWaySteps, nitroShare: steps ? nitroSteps / steps : 0 };
}

function flatten(m: Mlp): Float32Array {
  const parts = [...m.W, ...m.b];
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function assign(m: Mlp, theta: Float32Array): void {
  let o = 0;
  for (const p of [...m.W, ...m.b]) {
    p.set(theta.subarray(o, o + p.length));
    o += p.length;
  }
}

function gaussian(rnd: () => number): number {
  const u = Math.max(1e-9, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

export interface EvolveLog {
  generation: number;
  meanFitness: number;
  bestFitness: number;
  validationFitness: number;
  validationTime: number;
  nitroShare: number;
}

/**
 * OpenAI-style evolution strategy with antithetic sampling and rank-based fitness shaping.
 * Keeps the parameters with the best validation fitness (early stopping, like in stage 1).
 */
export async function evolve(start: Mlp, log: (s: string) => void = () => {}): Promise<{ model: Mlp; history: EvolveLog[] }> {
  await HeadlessRace.init();
  const rnd = mulberry32(ES_CONFIG.seed);
  const model = Mlp.fromJSON(start.toJSON());
  // Behavior cloning saw (almost) no nitro, so its nitro output is stuck at "off".
  // Re-initialize that output neuron so the evolution strategy can discover nitro by itself.
  const lastW = model.W.at(-1)!;
  const nin = model.sizes.at(-2)!;
  const NITRO = 3;
  lastW.fill(0, NITRO * nin, (NITRO + 1) * nin);
  model.b.at(-1)![NITRO] = 0;
  const theta = flatten(model);
  const n = theta.length;
  // Exploration scale per parameter: larger for the biases of the output layer.
  const sigma = new Float32Array(n).fill(ES_CONFIG.sigma);
  const outBias = model.b.at(-1)!.length;
  for (let i = n - outBias; i < n; i++) sigma[i] = ES_CONFIG.outputBiasSigma;
  // Nitro weights of the output layer also explore more strongly.
  const wOffset = model.W.slice(0, -1).reduce((a, w) => a + w.length, 0);
  for (let i = 0; i < nin; i++) sigma[wOffset + NITRO * nin + i] = ES_CONFIG.nitroSigma;

  const trainTracks = tracksOf("train");
  const valTracks = tracksOf("validation");
  const probe = Mlp.fromJSON(model.toJSON());
  const evalOn = (t: Float32Array, track: TrackDef, seed: number) => {
    assign(probe, t);
    return raceFitness(probe, track, seed);
  };
  const validate = (t: Float32Array) => {
    const r = valTracks.map((track, i) => evalOn(t, track, 500 + i));
    return { fitness: r.reduce((a, x) => a + x.fitness, 0) / r.length, time: r.reduce((a, x) => a + x.time, 0) / r.length, nitro: r.reduce((a, x) => a + x.nitroShare, 0) / r.length };
  };

  const history: EvolveLog[] = [];
  let best = validate(theta);
  let bestTheta = Float32Array.from(theta);
  history.push({ generation: 0, meanFitness: best.fitness, bestFitness: best.fitness, validationFitness: best.fitness, validationTime: best.time, nitroShare: best.nitro });
  log(`generation 0: validation fitness ${best.fitness.toFixed(1)}, lap ${best.time.toFixed(2)} s`);

  for (let g = 1; g <= ES_CONFIG.generations; g++) {
    const track = trainTracks[(g - 1) % trainTracks.length]!;
    const seed = 1000 + g;
    const eps: Float32Array[] = [];
    const scores: number[] = [];
    let nitro = 0;
    for (let p = 0; p < ES_CONFIG.pairs; p++) {
      const e = Float32Array.from({ length: n }, () => gaussian(rnd));
      eps.push(e);
      for (const sign of [1, -1]) {
        const cand = new Float32Array(n);
        for (let i = 0; i < n; i++) cand[i] = theta[i]! + sign * sigma[i]! * e[i]!;
        const r = evalOn(cand, track, seed);
        scores.push(r.fitness);
        nitro += r.nitroShare;
      }
    }
    // Rank-based fitness shaping: robust against outliers (e.g. one crash).
    const order = scores.map((s, i) => [s, i] as const).sort((a, b) => a[0] - b[0]);
    const ranks = new Float32Array(scores.length);
    order.forEach(([, i], r) => (ranks[i] = r / (scores.length - 1) - 0.5));
    const grad = new Float32Array(n);
    for (let p = 0; p < ES_CONFIG.pairs; p++) {
      const w = ranks[2 * p]! - ranks[2 * p + 1]!;
      const e = eps[p]!;
      for (let i = 0; i < n; i++) grad[i]! += w * e[i]!;
    }
    for (let i = 0; i < n; i++) theta[i]! += (ES_CONFIG.learningRate / (ES_CONFIG.pairs * 2)) * sigma[i]! * grad[i]! / ES_CONFIG.sigma;

    const val = validate(theta);
    const mean = scores.reduce((a, s) => a + s, 0) / scores.length;
    history.push({ generation: g, meanFitness: mean, bestFitness: Math.max(...scores), validationFitness: val.fitness, validationTime: val.time, nitroShare: nitro / scores.length });
    if (val.fitness > best.fitness) {
      best = val;
      bestTheta = Float32Array.from(theta);
    }
    log(`generation ${g} (${track.id}): mean ${mean.toFixed(1)}, best ${Math.max(...scores).toFixed(1)}, validation ${val.fitness.toFixed(1)} (lap ${val.time.toFixed(2)} s), nitro ${(100 * (nitro / scores.length)).toFixed(1)} %`);
  }
  assign(model, bestTheta);
  return { model, history };
}
