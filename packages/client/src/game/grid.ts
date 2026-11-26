import { theme } from "@apex/shared";

/** Grid data and small helpers that the lobby and menus need without loading the 3D race (and its physics). */
export const BOT_NAMES = ["Nova", "Blaze", "Kaito", "Vera", "Rook", "Juno", "Dash", "Mika", "Zed"];
export const RACER_COLORS = [theme.cyan, theme.magenta, theme.orange, theme.violet, 0x39ff88, 0xffe14d, 0xff4d6d, 0x4dd2ff, 0xc0c0ff, 0xff9ef0];
export interface GridEntry {
  id: string;
  name: string;
  color: number;
  human: boolean;
  /** The machine-learning driver APEX-AI (simulated by the host or offline). */
  ai?: boolean;
  car?: { id: string; tuning: unknown; looks: unknown };
}

export const APEX_AI_ID = "apex-ai";
export const APEX_AI_COLOR = 0xffc94d;

/** APEX-AI drives the car it was trained with, in its own black-and-gold livery. */
export function apexAiEntry(): GridEntry {
  return {
    id: APEX_AI_ID,
    name: "APEX-AI",
    color: APEX_AI_COLOR,
    human: false,
    ai: true,
    car: {
      id: "volt-hatch",
      tuning: undefined,
      looks: { color: 0x14162b, finish: "chrome", rimColor: APEX_AI_COLOR, spoiler: true, underglow: APEX_AI_COLOR, decal: "lightning", number: 0, smoke: APEX_AI_COLOR, horn: 3 },
    },
  };
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
