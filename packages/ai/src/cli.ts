/**
 * Command line for the AI pipeline (CRISP-DM):
 *   record   → data/telemetry   (phase 2/3)
 *   train    → packages/ai/models/apex-ai-v1.json (phase 4)
 *   evolve   → packages/ai/models/apex-ai-v2.json (phase 4, stage 2)
 *   evaluate → data/evaluation.json (phase 5)
 *   report   → docs/ai/ (data analysis parameters, charts)
 *   all      → everything in order
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FEATURES, OBS_SIZE } from "./observation";
import { Mlp, type MlpJson } from "./mlp";
import { CONFIG, evaluateModel, modelJson, recordDataset, trainModel, type EvalRow, type Sample } from "./pipeline";
import { buildReport } from "./report";
import { ES_CONFIG, evolve, type EvolveLog } from "./evolve";
import { existsSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dataDir = join(root, "data");
const modelPath = join(root, "packages/ai/models/apex-ai-v1.json");
const model2Path = join(root, "packages/ai/models/apex-ai-v2.json");
const docsDir = join(root, "docs/ai");
const log = (s: string) => console.log(`[ai] ${s}`);

function saveSamples(samples: Sample[], meta: Record<string, unknown>): void {
  mkdirSync(dataDir, { recursive: true });
  const x = new Float32Array(samples.length * OBS_SIZE);
  samples.forEach((s, i) => x.set(s.x, i * OBS_SIZE));
  writeFileSync(join(dataDir, "telemetry-x.bin"), Buffer.from(x.buffer));
  writeFileSync(
    join(dataDir, "telemetry-meta.json"),
    JSON.stringify({ ...meta, features: FEATURES, rows: samples.map((s) => [s.y, s.track, s.split, s.run, s.valid, s.invalidReason ?? null]) }),
  );
}

function loadSamples(): { samples: Sample[]; runs: number; simSeconds: number } {
  const meta = JSON.parse(readFileSync(join(dataDir, "telemetry-meta.json"), "utf8"));
  const buf = readFileSync(join(dataDir, "telemetry-x.bin"));
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
  const samples: Sample[] = meta.rows.map((r: [Sample["y"], string, Sample["split"], number, boolean, string | null], i: number) => ({
    x: x.subarray(i * OBS_SIZE, (i + 1) * OBS_SIZE),
    y: r[0],
    track: r[1],
    split: r[2],
    run: r[3],
    valid: r[4],
    invalidReason: r[5] ?? undefined,
  }));
  return { samples, runs: meta.runs, simSeconds: meta.simSeconds };
}

async function record() {
  const t0 = Date.now();
  const { samples, runs, simSeconds } = await recordDataset(log);
  saveSamples(samples, { runs, simSeconds, config: CONFIG });
  log(`saved ${samples.length} samples from ${runs} races in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

function trainCmd() {
  const { samples } = loadSamples();
  const { model, history, posWeight, trainSize, valSize } = trainModel(samples, log);
  mkdirSync(dirname(modelPath), { recursive: true });
  writeFileSync(modelPath, JSON.stringify(modelJson(model, { trainSize, valSize, posWeight })));
  writeFileSync(join(dataDir, "training-history.json"), JSON.stringify({ history, posWeight }));
  log(`model saved to ${modelPath}`);
}

const loadModel = (p: string) => Mlp.fromJSON(JSON.parse(readFileSync(p, "utf8")) as MlpJson);

async function evolveCmd() {
  const t0 = Date.now();
  const { model, history } = await evolve(loadModel(modelPath), log);
  writeFileSync(model2Path, JSON.stringify(model.toJSON({ name: "APEX-AI", version: 2, stage: "evolution strategy", es: ES_CONFIG })));
  writeFileSync(join(dataDir, "evolve-history.json"), JSON.stringify(history));
  log(`stage 2 finished in ${((Date.now() - t0) / 1000).toFixed(0)} s, model saved to ${model2Path}`);
}

async function evaluate() {
  const v1 = loadModel(modelPath);
  const hasV2 = existsSync(model2Path);
  const rows = hasV2 ? await evaluateModel(loadModel(model2Path), undefined, v1) : await evaluateModel(v1);
  writeFileSync(join(dataDir, "evaluation.json"), JSON.stringify(rows));
  for (const r of rows) log(`${r.track} run ${r.run} ${r.driver}: finished=${r.summary.finished} best=${r.summary.bestLap?.toFixed(2)} place=${r.summary.place} walls=${r.summary.wallContacts}`);
}

function report() {
  const { samples, runs, simSeconds } = loadSamples();
  const model = loadModel(modelPath);
  const evolveHistory: EvolveLog[] | undefined = existsSync(join(dataDir, "evolve-history.json"))
    ? JSON.parse(readFileSync(join(dataDir, "evolve-history.json"), "utf8"))
    : undefined;
  const { history, posWeight } = JSON.parse(readFileSync(join(dataDir, "training-history.json"), "utf8"));
  const evaluation = JSON.parse(readFileSync(join(dataDir, "evaluation.json"), "utf8")) as EvalRow[];
  const { markdown, files, metrics } = buildReport({ samples, runs, simSeconds, model, history, posWeight, evaluation, evolveHistory });
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(join(docsDir, "report.md"), markdown);
  writeFileSync(join(docsDir, "metrics.json"), JSON.stringify(metrics, null, 2));
  for (const [name, content] of Object.entries(files)) writeFileSync(join(docsDir, name), content);
  log(`report written to ${docsDir}`);
}

const cmd = process.argv[2] ?? "all";
if (cmd === "record") await record();
else if (cmd === "train") trainCmd();
else if (cmd === "evaluate") await evaluate();
else if (cmd === "evolve") await evolveCmd();
else if (cmd === "report") report();
else if (cmd === "all") {
  await record();
  trainCmd();
  await evolveCmd();
  await evaluate();
  report();
} else {
  console.error(`unknown command ${cmd}`);
  process.exit(1);
}
