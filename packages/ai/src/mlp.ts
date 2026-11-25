/**
 * A small multilayer perceptron in plain TypeScript.
 * Hidden layers use tanh. Outputs: [steer, throttle] through tanh (regression, −1…1)
 * and [drift, nitro] through a sigmoid (binary classification).
 */

export interface MlpJson {
  version: string;
  sizes: number[];
  weights: number[][]; // per layer, row-major [out][in]
  biases: number[][];
  meta?: Record<string, unknown>;
}

export const REG_OUTPUTS = 2;
export const BIN_OUTPUTS = 2;

function gaussian(rnd: () => number): number {
  const u = Math.max(1e-9, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export class Mlp {
  readonly W: Float32Array[];
  readonly b: Float32Array[];

  constructor(
    readonly sizes: number[],
    rnd: () => number = Math.random,
  ) {
    this.W = [];
    this.b = [];
    for (let l = 0; l < sizes.length - 1; l++) {
      const nin = sizes[l]!;
      const nout = sizes[l + 1]!;
      const scale = Math.sqrt(1 / nin); // Xavier-style init for tanh
      this.W.push(Float32Array.from({ length: nin * nout }, () => gaussian(rnd) * scale));
      this.b.push(new Float32Array(nout));
    }
  }

  get parameterCount(): number {
    return this.W.reduce((a, w) => a + w.length, 0) + this.b.reduce((a, b) => a + b.length, 0);
  }

  /** Forward pass; returns activations of every layer (needed for training). */
  forwardAll(x: ArrayLike<number>): Float32Array[] {
    const acts: Float32Array[] = [Float32Array.from(x)];
    for (let l = 0; l < this.W.length; l++) {
      const nin = this.sizes[l]!;
      const nout = this.sizes[l + 1]!;
      const W = this.W[l]!;
      const prev = acts[l]!;
      const out = new Float32Array(nout);
      const last = l === this.W.length - 1;
      for (let o = 0; o < nout; o++) {
        let s = this.b[l]![o]!;
        const row = o * nin;
        for (let i = 0; i < nin; i++) s += W[row + i]! * prev[i]!;
        out[o] = last ? s : Math.tanh(s);
      }
      acts.push(out);
    }
    return acts;
  }

  /** Final outputs: [steer, throttle] in −1…1, [pDrift, pNitro] in 0…1. */
  predict(x: ArrayLike<number>): Float32Array {
    const z = this.forwardAll(x).at(-1)!;
    const y = new Float32Array(z.length);
    for (let i = 0; i < z.length; i++) y[i] = i < REG_OUTPUTS ? Math.tanh(z[i]!) : sigmoid(z[i]!);
    return y;
  }

  toJSON(meta?: Record<string, unknown>): MlpJson {
    return {
      version: "1",
      sizes: this.sizes,
      weights: this.W.map((w) => Array.from(w, (v) => Math.round(v * 1e6) / 1e6)),
      biases: this.b.map((b) => Array.from(b, (v) => Math.round(v * 1e6) / 1e6)),
      meta,
    };
  }

  static fromJSON(json: MlpJson): Mlp {
    const m = new Mlp(json.sizes, () => 0.5);
    json.weights.forEach((w, l) => m.W[l]!.set(w));
    json.biases.forEach((b, l) => m.b[l]!.set(b));
    return m;
  }
}

export interface TrainOptions {
  epochs: number;
  batchSize: number;
  lr: number;
  /** Weight for positive samples of each binary output (class imbalance). */
  posWeight: [number, number];
  rnd: () => number;
  onEpoch?: (epoch: number, trainLoss: number, valLoss: number) => void;
}

export interface Dataset {
  x: Float32Array; // n * inputs
  y: Float32Array; // n * 4
  n: number;
  inputs: number;
}

/** Loss of one sample: MSE on the regression outputs + weighted binary cross-entropy. */
function sampleLoss(z: Float32Array, t: ArrayLike<number>, posWeight: [number, number], grad?: Float32Array): number {
  let loss = 0;
  for (let i = 0; i < REG_OUTPUTS; i++) {
    const y = Math.tanh(z[i]!);
    const d = y - t[i]!;
    loss += d * d;
    if (grad) grad[i] = 2 * d * (1 - y * y);
  }
  for (let j = 0; j < BIN_OUTPUTS; j++) {
    const i = REG_OUTPUTS + j;
    const p = Math.min(1 - 1e-7, Math.max(1e-7, sigmoid(z[i]!)));
    const w = t[i]! > 0.5 ? posWeight[j]! : 1;
    loss += -w * (t[i]! * Math.log(p) + (1 - t[i]!) * Math.log(1 - p));
    if (grad) grad[i] = w * (p - t[i]!);
  }
  return loss;
}

export function datasetLoss(m: Mlp, d: Dataset, posWeight: [number, number]): number {
  let total = 0;
  for (let s = 0; s < d.n; s++) {
    const z = m.forwardAll(d.x.subarray(s * d.inputs, (s + 1) * d.inputs)).at(-1)!;
    total += sampleLoss(z, d.y.subarray(s * 4, s * 4 + 4), posWeight);
  }
  return total / Math.max(1, d.n);
}

/** Mini-batch training with backpropagation and the Adam optimizer. */
export function train(m: Mlp, trainSet: Dataset, valSet: Dataset, opt: TrainOptions): { train: number[]; val: number[]; bestEpoch: number } {
  const L = m.W.length;
  const gW = m.W.map((w) => new Float32Array(w.length));
  const gb = m.b.map((b) => new Float32Array(b.length));
  const mW = m.W.map((w) => new Float32Array(w.length));
  const vW = m.W.map((w) => new Float32Array(w.length));
  const mb = m.b.map((b) => new Float32Array(b.length));
  const vb = m.b.map((b) => new Float32Array(b.length));
  const beta1 = 0.9;
  const beta2 = 0.999;
  let t = 0;
  const order = Array.from({ length: trainSet.n }, (_, i) => i);
  const history = { train: [] as number[], val: [] as number[], bestEpoch: 0 };
  // Early stopping: remember the weights with the lowest validation loss.
  let bestVal = Infinity;
  let bestW = m.W.map((w) => Float32Array.from(w));
  let bestB = m.b.map((b) => Float32Array.from(b));
  const outGrad = new Float32Array(m.sizes.at(-1)!);

  for (let epoch = 1; epoch <= opt.epochs; epoch++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(opt.rnd() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    let epochLoss = 0;
    for (let start = 0; start < order.length; start += opt.batchSize) {
      const batch = order.slice(start, start + opt.batchSize);
      gW.forEach((g) => g.fill(0));
      gb.forEach((g) => g.fill(0));
      for (const s of batch) {
        const acts = m.forwardAll(trainSet.x.subarray(s * trainSet.inputs, (s + 1) * trainSet.inputs));
        epochLoss += sampleLoss(acts[L]!, trainSet.y.subarray(s * 4, s * 4 + 4), opt.posWeight, outGrad);
        let delta = Float32Array.from(outGrad);
        for (let l = L - 1; l >= 0; l--) {
          const nin = m.sizes[l]!;
          const nout = m.sizes[l + 1]!;
          const prev = acts[l]!;
          const W = m.W[l]!;
          const next = l > 0 ? new Float32Array(nin) : null;
          for (let o = 0; o < nout; o++) {
            const d = delta[o]!;
            gb[l]![o]! += d;
            const row = o * nin;
            for (let i = 0; i < nin; i++) {
              gW[l]![row + i]! += d * prev[i]!;
              if (next) next[i]! += d * W[row + i]!;
            }
          }
          if (next) {
            for (let i = 0; i < nin; i++) next[i]! *= 1 - prev[i]! * prev[i]!; // tanh'
            delta = next;
          }
        }
      }
      // Adam update
      t++;
      const scale = 1 / batch.length;
      const lrT = (opt.lr * Math.sqrt(1 - beta2 ** t)) / (1 - beta1 ** t);
      const step = (p: Float32Array, g: Float32Array, mm: Float32Array, vv: Float32Array) => {
        for (let i = 0; i < p.length; i++) {
          const gi = g[i]! * scale;
          mm[i] = beta1 * mm[i]! + (1 - beta1) * gi;
          vv[i] = beta2 * vv[i]! + (1 - beta2) * gi * gi;
          p[i]! -= (lrT * mm[i]!) / (Math.sqrt(vv[i]!) + 1e-8);
        }
      };
      for (let l = 0; l < L; l++) {
        step(m.W[l]!, gW[l]!, mW[l]!, vW[l]!);
        step(m.b[l]!, gb[l]!, mb[l]!, vb[l]!);
      }
    }
    const trainLoss = epochLoss / trainSet.n;
    const valLoss = datasetLoss(m, valSet, opt.posWeight);
    history.train.push(trainLoss);
    history.val.push(valLoss);
    if (valLoss < bestVal) {
      bestVal = valLoss;
      history.bestEpoch = epoch;
      bestW = m.W.map((w) => Float32Array.from(w));
      bestB = m.b.map((b) => Float32Array.from(b));
    }
    opt.onEpoch?.(epoch, trainLoss, valLoss);
  }
  bestW.forEach((w, l) => m.W[l]!.set(w));
  bestB.forEach((b, l) => m.b[l]!.set(b));
  return history;
}
