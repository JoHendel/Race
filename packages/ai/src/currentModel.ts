import type { MlpJson } from "./mlp";
import model from "../models/apex-ai-v2.json";

/** The model version that drives APEX-AI in the game. */
export const CURRENT_MODEL = model as unknown as MlpJson;
export const CURRENT_MODEL_VERSION = "v2";
