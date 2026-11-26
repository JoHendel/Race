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
}

export interface LobbySettings {
  trackId: string;
  laps: number;
  fillWithBots: boolean;
  /** Choose the track by vote instead of the host's pick. */
  vote?: boolean;
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

export type HostMessage =
  | { t: "welcome"; clientId: string; players: LobbyPlayer[]; settings: LobbySettings }
  | { t: "lobby"; players: LobbyPlayer[]; settings: LobbySettings }
  | { t: "start"; seed: number; settings: LobbySettings; grid: { id: string; name: string; color: number; human: boolean; ai?: boolean; car?: VehicleChoice }[] }
  | { t: "snap"; time: number; raceTime: number; phase: string; phaseTime: number; final: boolean; cars: CarState[]; racers: RacerStatus[] }
  | { t: "toLobby" }
  | { t: "kick"; reason: string }
  /** Track vote: candidates, seconds left, current votes (clientId → trackId). Sent at the start and on every new vote. */
  | { t: "vote"; candidates: string[]; seconds: number; votes: Record<string, string> }
  | { t: "voteResult"; winner: string; tie: string[] };

export type ClientMessage =
  | { t: "hello"; clientId: string; name: string; car?: VehicleChoice }
  | { t: "ready"; ready: boolean }
  | { t: "name"; name: string }
  | { t: "vehicle"; car: VehicleChoice }
  | { t: "car"; state: CarState }
  | { t: "vote"; trackId: string };

export const SNAPSHOT_RATE = 30;
export const RECONNECT_WINDOW = 30;
