/** Nachrichten zwischen Host und Clients. Alles JSON, kompakt gehalten. */

/** Fahrzeugwahl eines Spielers (Tuning und Optik als JSON). */
export interface VehicleChoice {
  id: string;
  tuning: unknown;
  looks: unknown;
}

export interface LobbyPlayer {
  clientId: string;
  name: string;
  color: number;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
  car?: VehicleChoice;
  /** Joined while a race was running: watches it and races in the next one. */
  spectator?: boolean;
}

export type JoinResult = "player" | "spectator" | "full";

/**
 * How a new player gets in: in the lobby as a racer, during a race as a spectator
 * (they race from the next start on), or not at all when the room is full.
 */
export function joinRole(playerCount: number, maxPlayers: number, raceRunning: boolean): JoinResult {
  if (playerCount >= maxPlayers) return "full";
  return raceRunning ? "spectator" : "player";
}

export interface LobbySettings {
  trackId: string;
  laps: number;
  fillWithBots: boolean;
  /** Chaos mode with item boxes and power-ups. */
  chaos?: boolean;
  /** Choose the track by vote instead of the host's pick. */
  vote?: boolean;
  /** Weather choice; in the start message it is already resolved (never "random"). */
  weather?: "clear" | "rain" | "fog" | "night" | "random";
}

/** Zustand eines Autos: Position, Rotation (Quaternion), Tempo, Effekte. */
export interface CarState {
  id: string;
  p: [number, number, number];
  q: [number, number, number, number];
  v: number;
  d: 0 | 1; // driftet
  n: 0 | 1; // Nitro aktiv
}

export interface RacerStatus {
  id: string;
  progress: number;
  lap: number;
  finishTime: number | null;
  bestLap: number | null;
  drift?: number;
  overtakes?: number;
  worst?: number;
}

/** Chaos mode state in a snapshot: unavailable boxes, mines, drones, held items, effect timers. */
export interface ChaosNet {
  b: number[];
  m: [number, number, number][];
  d: [number, number, number][];
  h: Record<string, [string, number]>;
  fx: Record<string, [number, number, number, number]>;
}

export type HostMessage =
  | { t: "welcome"; clientId: string; players: LobbyPlayer[]; settings: LobbySettings }
  | { t: "lobby"; players: LobbyPlayer[]; settings: LobbySettings }
  | { t: "start"; seed: number; settings: LobbySettings; grid: { id: string; name: string; color: number; human: boolean; ai?: boolean; car?: VehicleChoice }[] }
  | { t: "snap"; time: number; raceTime: number; phase: string; phaseTime: number; final: boolean; cars: CarState[]; racers: RacerStatus[]; chaos?: ChaosNet; rivals?: Record<string, string> }
  | { t: "toLobby" }
  | { t: "kick"; reason: string }
  /** Track vote: candidates, seconds left, current votes (clientId → trackId). Sent at the start and on every new vote. */
  | { t: "vote"; candidates: string[]; seconds: number; votes: Record<string, string> }
  | { t: "voteResult"; winner: string; tie: string[] }
  /** Horn or emote of a racer, relayed to everyone (value = emoji for emotes). */
  | { t: "fx"; id: string; kind: "emote" | "horn"; value?: string };

export type ClientMessage =
  | { t: "hello"; clientId: string; name: string; car?: VehicleChoice }
  | { t: "ready"; ready: boolean }
  | { t: "name"; name: string }
  | { t: "vehicle"; car: VehicleChoice }
  | { t: "car"; state: CarState }
  | { t: "vote"; trackId: string }
  | { t: "useItem" }
  | { t: "fx"; kind: "emote" | "horn"; value?: string };

export const SNAPSHOT_RATE = 30;
export const RECONNECT_WINDOW = 30;
