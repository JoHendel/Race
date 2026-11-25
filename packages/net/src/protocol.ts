/** Nachrichten zwischen Host und Clients. Alles JSON, kompakt gehalten. */

export interface LobbyPlayer {
  clientId: string;
  name: string;
  color: number;
  ready: boolean;
  isHost: boolean;
  connected: boolean;
}

export interface LobbySettings {
  trackId: string;
  laps: number;
  fillWithBots: boolean;
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
}

export type HostMessage =
  | { t: "welcome"; clientId: string; players: LobbyPlayer[]; settings: LobbySettings }
  | { t: "lobby"; players: LobbyPlayer[]; settings: LobbySettings }
  | { t: "start"; seed: number; settings: LobbySettings; grid: { id: string; name: string; color: number; human: boolean }[] }
  | { t: "snap"; time: number; raceTime: number; phase: string; phaseTime: number; final: boolean; cars: CarState[]; racers: RacerStatus[] }
  | { t: "toLobby" }
  | { t: "kick"; reason: string };

export type ClientMessage =
  | { t: "hello"; clientId: string; name: string }
  | { t: "ready"; ready: boolean }
  | { t: "name"; name: string }
  | { t: "car"; state: CarState };

export const SNAPSHOT_RATE = 30;
export const RECONNECT_WINDOW = 30;
