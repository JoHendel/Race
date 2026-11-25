import { Mlp } from "./mlp";
import { FEATURES, FEATURE_INFO, OBS_SIZE } from "./observation";
import { CONFIG, type EvalRow, type Sample, type SplitName } from "./pipeline";

const f = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "–");
const pct = (v: number) => `${(v * 100).toFixed(1)} %`;

function minOf(a: number[]): number {
  let m = Infinity;
  for (const v of a) if (v < m) m = v;
  return m;
}
function maxOf(a: number[]): number {
  let m = -Infinity;
  for (const v of a) if (v > m) m = v;
  return m;
}
function mean(a: number[]): number {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
}
function std(a: number[]): number {
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
}
function pearson(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return num / Math.sqrt(da * db || 1);
}

export interface RegressionMetrics {
  mae: number;
  r2: number;
}
export interface ClassMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  positives: number;
}

export function regression(pred: number[], truth: number[]): RegressionMetrics {
  const m = mean(truth);
  let se = 0;
  let st = 0;
  let ae = 0;
  for (let i = 0; i < pred.length; i++) {
    ae += Math.abs(pred[i]! - truth[i]!);
    se += (pred[i]! - truth[i]!) ** 2;
    st += (truth[i]! - m) ** 2;
  }
  return { mae: ae / pred.length, r2: 1 - se / (st || 1) };
}

export function classification(pred: boolean[], truth: boolean[]): ClassMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  pred.forEach((p, i) => {
    const t = truth[i]!;
    if (p && t) tp++;
    else if (p && !t) fp++;
    else if (!p && !t) tn++;
    else fn++;
  });
  return {
    accuracy: (tp + tn) / Math.max(1, pred.length),
    precision: tp / Math.max(1, tp + fp),
    recall: tp / Math.max(1, tp + fn),
    tp,
    fp,
    tn,
    fn,
    positives: tp + fn,
  };
}

export function modelMetrics(model: Mlp, samples: Sample[]) {
  const preds = samples.map((s) => model.predict(s.x));
  return {
    n: samples.length,
    steer: regression(preds.map((p) => p[0]!), samples.map((s) => s.y[0])),
    throttle: regression(preds.map((p) => p[1]!), samples.map((s) => s.y[1])),
    drift: classification(preds.map((p) => p[2]! > 0.5), samples.map((s) => s.y[2] > 0.5)),
    nitro: classification(preds.map((p) => p[3]! > 0.5), samples.map((s) => s.y[3] > 0.5)),
  };
}

// ---------- SVG charts (no library needed) ----------

function lineChart(title: string, series: { name: string; color: string; values: number[] }[], xLabel: string, yLabel: string): string {
  const W = 640;
  const H = 320;
  const pad = { l: 60, r: 20, t: 40, b: 50 };
  const all = series.flatMap((s) => s.values);
  const maxY = Math.max(...all) * 1.05;
  const minY = Math.min(0, Math.min(...all));
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - minY) / (maxY - minY || 1)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => minY + ((maxY - minY) * i) / 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="sans-serif" font-size="12">
<rect width="${W}" height="${H}" fill="#0d1024"/>
<text x="${W / 2}" y="22" fill="#f4f6ff" text-anchor="middle" font-size="15">${title}</text>
${ticks.map((t) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}" stroke="#262b55"/><text x="${pad.l - 8}" y="${y(t) + 4}" fill="#9aa3c7" text-anchor="end">${t.toFixed(3)}</text>`).join("\n")}
${series.map((s) => `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" points="${s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>`).join("\n")}
${series.map((s, i) => `<rect x="${pad.l + 10 + i * 150}" y="${H - 22}" width="14" height="4" fill="${s.color}"/><text x="${pad.l + 30 + i * 150}" y="${H - 16}" fill="#f4f6ff">${s.name}</text>`).join("\n")}
<text x="${W - pad.r}" y="${H - 16}" fill="#9aa3c7" text-anchor="end">${xLabel}</text>
<text x="14" y="${pad.t - 10}" fill="#9aa3c7">${yLabel}</text>
</svg>`;
}

function barChart(title: string, labels: string[], values: number[], color: string, signed = false): string {
  const W = 640;
  const rowH = 22;
  const H = 50 + labels.length * rowH;
  const max = Math.max(...values.map(Math.abs), 1e-9);
  const mid = signed ? 360 : 200;
  const span = signed ? 220 : 400;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="sans-serif" font-size="12">
<rect width="${W}" height="${H}" fill="#0d1024"/>
<text x="${W / 2}" y="22" fill="#f4f6ff" text-anchor="middle" font-size="15">${title}</text>
${labels
  .map((l, i) => {
    const v = values[i]!;
    const w = (Math.abs(v) / max) * span;
    const yy = 40 + i * rowH;
    const x0 = signed ? (v < 0 ? mid - w : mid) : mid;
    return `<text x="${(signed ? mid - span : mid) - 8}" y="${yy + 14}" fill="#f4f6ff" text-anchor="end">${l}</text><rect x="${x0}" y="${yy + 3}" width="${w.toFixed(1)}" height="14" fill="${v < 0 ? "#ff2bd6" : color}"/><text x="${(signed ? mid + span : mid + w) + 6}" y="${yy + 14}" fill="#9aa3c7">${v.toFixed(3)}</text>`;
  })
  .join("\n")}
${signed ? `<line x1="${mid}" x2="${mid}" y1="36" y2="${H - 6}" stroke="#9aa3c7"/>` : ""}
</svg>`;
}

function histogram(values: number[], bins: number, lo: number, hi: number): number[] {
  const h = new Array(bins).fill(0);
  for (const v of values) h[Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)))]++;
  return h.map((c) => c / values.length);
}

// ---------- Report ----------

export interface ReportInput {
  samples: Sample[];
  runs: number;
  simSeconds: number;
  model: Mlp;
  history: { train: number[]; val: number[]; bestEpoch?: number };
  posWeight: [number, number];
  evaluation: EvalRow[];
}

export function buildReport(input: ReportInput): { markdown: string; files: Record<string, string>; metrics: Record<string, unknown> } {
  const { samples, model, history, evaluation } = input;
  const valid = samples.filter((s) => s.valid);
  const invalid = samples.filter((s) => !s.valid);
  const reasons = new Map<string, number>();
  invalid.forEach((s) => reasons.set(s.invalidReason ?? "?", (reasons.get(s.invalidReason ?? "?") ?? 0) + 1));
  const bySplit = (sp: SplitName) => valid.filter((s) => s.split === sp);
  const tracks = (sp: SplitName) => [...new Set(samples.filter((s) => s.split === sp).map((s) => s.track))];

  // Per-feature statistics on all recorded samples (invalid share = non-finite values).
  const featureStats = FEATURES.map((name, i) => {
    const raw = samples.map((s) => s.x[i]!);
    const fin = raw.filter((v) => Number.isFinite(v));
    return {
      name,
      info: FEATURE_INFO[name],
      min: minOf(fin),
      max: maxOf(fin),
      mean: mean(fin),
      std: std(fin),
      invalid: 1 - fin.length / raw.length,
    };
  });

  const steer = valid.map((s) => s.y[0]);
  const thr = valid.map((s) => s.y[1]);
  const driftShare = mean(valid.map((s) => s.y[2]));
  const nitroShare = mean(valid.map((s) => s.y[3]));
  const brakeShare = mean(thr.map((v) => (v < 0 ? 1 : 0)));

  const corr = FEATURES.map((name, i) => ({
    name,
    steer: pearson(valid.map((s) => s.x[i]!), steer),
    throttle: pearson(valid.map((s) => s.x[i]!), thr),
  }));
  const topSteer = [...corr].sort((a, b) => Math.abs(b.steer) - Math.abs(a.steer)).slice(0, 8);
  const topThrottle = [...corr].sort((a, b) => Math.abs(b.throttle) - Math.abs(a.throttle)).slice(0, 8);

  const mVal = modelMetrics(model, bySplit("validation"));
  const mTest = modelMetrics(model, bySplit("test"));

  // Driving metrics on the unseen test tracks
  const drive = (driver: EvalRow["driver"]) => {
    const rows = evaluation.filter((r) => r.driver === driver).map((r) => r.summary);
    const laps = rows.reduce((a, r) => a + Math.max(1, r.lapTimes.length), 0);
    return {
      races: rows.length,
      finishRate: mean(rows.map((r) => (r.finished ? 1 : 0))),
      bestLap: Math.min(...rows.map((r) => r.bestLap ?? Infinity)),
      meanBestLap: mean(rows.filter((r) => r.bestLap !== null).map((r) => r.bestLap!)),
      wallContactsPerLap: rows.reduce((a, r) => a + r.wallContacts, 0) / laps,
      resetsPerRace: mean(rows.map((r) => r.resets)),
      meanLateralOffset: mean(rows.map((r) => r.meanLateralOffset)),
      meanPlace: mean(rows.map((r) => r.place)),
    };
  };
  const ai = drive("apex-ai");
  const bot = drive("rule-bot");
  const lapRatio = ai.meanBestLap / bot.meanBestLap;
  const criteria = [
    { name: "Lap time ≤ 105 % of the rule-based bot", value: pct(lapRatio), ok: lapRatio <= 1.05 },
    { name: "Wall contacts < 1 per lap", value: f(ai.wallContactsPerLap, 2), ok: ai.wallContactsPerLap < 1 },
    { name: "Finish rate 100 %", value: pct(ai.finishRate), ok: ai.finishRate >= 1 },
  ];

  const files: Record<string, string> = {
    "learning-curve.svg": lineChart(
      "Behavior cloning – loss per epoch",
      [
        { name: "training", color: "#00e5ff", values: history.train },
        { name: "validation", color: "#ff8a1f", values: history.val },
      ],
      "epoch",
      "loss",
    ),
    "steering-distribution.svg": barChart(
      "Distribution of steering values (valid samples)",
      Array.from({ length: 10 }, (_, i) => `${(-1 + i * 0.2).toFixed(1)}…${(-0.8 + i * 0.2).toFixed(1)}`),
      histogram(steer, 10, -1, 1),
      "#00e5ff",
    ),
    "correlation-steering.svg": barChart("Pearson correlation of features with steering", topSteer.map((c) => c.name), topSteer.map((c) => c.steer), "#00e5ff", true),
  };

  const cm = (c: ClassMetrics) => `| | predicted on | predicted off |\n| --- | --- | --- |\n| **actual on** | ${c.tp} | ${c.fn} |\n| **actual off** | ${c.fp} | ${c.tn} |`;

  const markdown = `# APEX-AI – Data Analysis Report

> Generated automatically by \`pnpm ai:report\` (seed ${CONFIG.seed}). Do not edit by hand.

## 1. Dataset overview

| Parameter | Value |
| --- | --- |
| Recorded races (runs) | ${input.runs} |
| Simulated driving time | ${(input.simSeconds / 60).toFixed(1)} min (${CONFIG.botsPerRace} cars per race) |
| Samples recorded | ${samples.length.toLocaleString("en-US")} |
| Valid samples | ${valid.length.toLocaleString("en-US")} (${pct(valid.length / samples.length)}) |
| Invalid samples | ${invalid.length.toLocaleString("en-US")} – ${[...reasons].map(([r, c]) => `${r}: ${c}`).join(", ") || "none"} |
| Features (inputs) | ${OBS_SIZE} |
| Targets (outputs) | 4: steering, throttle/brake, drift, nitro |
| Sampling rate | every ${CONFIG.sampleEvery}th physics step = ${60 / CONFIG.sampleEvery} samples per second and car |

**Split by track** (prevents data leakage – validation and test tracks are never seen during training):

| Split | Tracks | Valid samples | Share |
| --- | --- | --- | --- |
| Training | ${tracks("train").join(", ")} | ${bySplit("train").length.toLocaleString("en-US")} | ${pct(bySplit("train").length / valid.length)} |
| Validation | ${tracks("validation").join(", ")} | ${bySplit("validation").length.toLocaleString("en-US")} | ${pct(bySplit("validation").length / valid.length)} |
| Test | ${tracks("test").join(", ")} | ${bySplit("test").length.toLocaleString("en-US")} | ${pct(bySplit("test").length / valid.length)} |

## 2. Feature statistics

| Feature | Meaning | Min | Max | Mean | Std. dev. | Invalid |
| --- | --- | --- | --- | --- | --- | --- |
${featureStats.map((s) => `| \`${s.name}\` | ${s.info} | ${f(s.min)} | ${f(s.max)} | ${f(s.mean)} | ${f(s.std)} | ${pct(s.invalid)} |`).join("\n")}

## 3. Target distribution and class balance

| Target | Statistic |
| --- | --- |
| Steering | mean ${f(mean(steer))}, std. dev. ${f(std(steer))} |
| Throttle/brake | mean ${f(mean(thr))}, std. dev. ${f(std(thr))}, braking in ${pct(brakeShare)} of samples |
| Drift | on in ${pct(driftShare)} of samples (class weight for training: ${f(input.posWeight[0], 1)}) |
| Nitro | on in ${pct(nitroShare)} of samples (class weight for training: ${f(input.posWeight[1], 1)}) |

![Steering distribution](steering-distribution.svg)

## 4. Correlations

Pearson correlation of the strongest features with the targets (valid samples):

| Feature | r (steering) | | Feature | r (throttle) |
| --- | --- | --- | --- | --- |
${topSteer.map((c, i) => `| \`${c.name}\` | ${f(c.steer)} | | \`${topThrottle[i]!.name}\` | ${f(topThrottle[i]!.throttle)} |`).join("\n")}

![Correlation with steering](correlation-steering.svg)

## 5. Model and training

| Parameter | Value |
| --- | --- |
| Architecture | MLP ${model.sizes.join(" → ")} (tanh hidden layers) |
| Trainable parameters | ${model.parameterCount.toLocaleString("en-US")} |
| Loss | MSE (steering, throttle) + weighted binary cross-entropy (drift, nitro) |
| Optimizer | Adam, learning rate ${CONFIG.learningRate}, batch size ${CONFIG.batchSize}, ${CONFIG.epochs} epochs |
| Early stopping | weights of epoch ${history.bestEpoch ?? "–"} kept (lowest validation loss ${f(Math.min(...history.val), 4)}) |
| Final loss | training ${f(history.train.at(-1)!, 4)}, validation ${f(history.val.at(-1)!, 4)} |

![Learning curve](learning-curve.svg)

## 6. Model metrics

| Metric | Validation (${mVal.n.toLocaleString("en-US")} samples) | Test (${mTest.n.toLocaleString("en-US")} samples) |
| --- | --- | --- |
| Steering MAE | ${f(mVal.steer.mae)} | ${f(mTest.steer.mae)} |
| Steering R² | ${f(mVal.steer.r2)} | ${f(mTest.steer.r2)} |
| Throttle MAE | ${f(mVal.throttle.mae)} | ${f(mTest.throttle.mae)} |
| Throttle R² | ${f(mVal.throttle.r2)} | ${f(mTest.throttle.r2)} |
| Drift accuracy / precision / recall | ${pct(mVal.drift.accuracy)} / ${pct(mVal.drift.precision)} / ${pct(mVal.drift.recall)} | ${pct(mTest.drift.accuracy)} / ${pct(mTest.drift.precision)} / ${pct(mTest.drift.recall)} |
| Nitro accuracy / precision / recall | ${pct(mVal.nitro.accuracy)} / ${pct(mVal.nitro.precision)} / ${pct(mVal.nitro.recall)} | ${pct(mTest.nitro.accuracy)} / ${pct(mTest.nitro.precision)} / ${pct(mTest.nitro.recall)} |

**Confusion matrix – drift (test):**

${cm(mTest.drift)}

**Confusion matrix – nitro (test):**

${cm(mTest.nitro)}

## 7. Driving evaluation on unseen test tracks

${CONFIG.evalRaces} races per test track, ${CONFIG.lapsPerRace} laps each, against ${CONFIG.botsPerRace} rule-based bots. The comparison driver is a rule-based bot (skill "hard") in the same grid slot.

| Metric | APEX-AI | Rule-based bot |
| --- | --- | --- |
| Races | ${ai.races} | ${bot.races} |
| Finish rate | ${pct(ai.finishRate)} | ${pct(bot.finishRate)} |
| Best lap | ${f(ai.bestLap, 2)} s | ${f(bot.bestLap, 2)} s |
| Mean best lap | ${f(ai.meanBestLap, 2)} s | ${f(bot.meanBestLap, 2)} s |
| Wall contacts per lap | ${f(ai.wallContactsPerLap, 2)} | ${f(bot.wallContactsPerLap, 2)} |
| Resets per race | ${f(ai.resetsPerRace, 2)} | ${f(bot.resetsPerRace, 2)} |
| Mean distance to centre line | ${f(ai.meanLateralOffset, 2)} m | ${f(bot.meanLateralOffset, 2)} m |
| Mean finishing place (of 10) | ${f(ai.meanPlace, 1)} | ${f(bot.meanPlace, 1)} |

## 8. Success criteria

| Criterion | Result | Met |
| --- | --- | --- |
${criteria.map((c) => `| ${c.name} | ${c.value} | ${c.ok ? "✅" : "❌"} |`).join("\n")}
`;

  const metrics = {
    seed: CONFIG.seed,
    samples: samples.length,
    valid: valid.length,
    split: { train: bySplit("train").length, validation: bySplit("validation").length, test: bySplit("test").length },
    classBalance: { drift: driftShare, nitro: nitroShare, braking: brakeShare },
    validation: mVal,
    test: mTest,
    driving: { apexAi: ai, ruleBot: bot },
    criteria,
    finalLoss: { train: history.train.at(-1), validation: history.val.at(-1) },
    bestEpoch: history.bestEpoch,
    bestValidationLoss: Math.min(...history.val),
  };
  return { markdown, files, metrics };
}
