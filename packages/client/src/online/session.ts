import {
  RECONNECT_WINDOW,
  SNAPSHOT_RATE,
  createRoomCode,
  type ClientMessage,
  type ClientTransport,
  type HostMessage,
  type HostTransport,
  type LobbyPlayer,
  type LobbySettings,
  type SignalingProvider,
} from "@apex/net";
import { DEFAULT_LAPS, MAX_PLAYERS, NEON_HARBOR, clampLaps, trackById } from "@apex/shared";
import { BOT_NAMES, RACER_COLORS, apexAiEntry, type GridEntry, type RaceScene } from "../game/raceScene";
import { currentCar } from "../save";

type StartMessage = Extract<HostMessage, { t: "start" }>;

export interface SessionEvents {
  onLobby: (players: LobbyPlayer[], settings: LobbySettings) => void;
  onStart: (start: StartMessage) => void;
  onToLobby: () => void;
  onClosed: (reason: string) => void;
}

/** Host einer Online-Runde: verwaltet Lobby, Startaufstellung und sendet Snapshots. */
export class HostSession {
  readonly code = createRoomCode();
  readonly clientId: string;
  players: LobbyPlayer[] = [];
  settings: LobbySettings = { trackId: NEON_HARBOR.id, laps: DEFAULT_LAPS, fillWithBots: true };
  race: RaceScene | null = null;
  private transport: HostTransport | null = null;
  private readonly peerToClient = new Map<string, string>();
  private readonly dropTimers = new Map<string, number>();
  private timer = 0;
  private lastStart: StartMessage | null = null;

  constructor(
    private readonly signaling: SignalingProvider,
    clientId: string,
    name: string,
    private readonly events: SessionEvents,
  ) {
    this.clientId = clientId;
    this.players.push({ clientId, name, color: RACER_COLORS[0]!, ready: true, isHost: true, connected: true, car: currentCar() });
  }

  async open(): Promise<void> {
    const t = await this.signaling.host(this.code);
    this.transport = t;
    t.onMessage((peer, msg) => this.handle(peer, msg));
    t.onLeave((peer) => this.drop(peer));
    this.timer = window.setInterval(() => {
      if (this.race) t.broadcast(this.race.buildSnapshot());
    }, 1000 / SNAPSHOT_RATE);
    this.emitLobby();
  }

  private handle(peer: string, msg: ClientMessage): void {
    const t = this.transport!;
    if (msg.t === "hello") {
      let p = this.players.find((x) => x.clientId === msg.clientId);
      if (!p) {
        if (this.players.length >= MAX_PLAYERS || (this.race && !p)) {
          t.send(peer, { t: "kick", reason: this.race ? "Das Rennen läuft schon." : "Der Raum ist voll." });
          return;
        }
        const color = RACER_COLORS.find((c) => !this.players.some((x) => x.color === c)) ?? RACER_COLORS[1]!;
        p = { clientId: msg.clientId, name: cleanName(msg.name), color, ready: false, isHost: false, connected: true, car: msg.car };
        this.players.push(p);
      }
      p.connected = true;
      window.clearTimeout(this.dropTimers.get(p.clientId));
      this.peerToClient.set(peer, p.clientId);
      t.send(peer, { t: "welcome", clientId: p.clientId, players: this.players, settings: this.settings });
      // Wiedereinstieg in ein laufendes Rennen
      if (this.race && this.lastStart) {
        t.send(peer, this.lastStart);
        this.race.setHumanConnected(p.clientId, true);
      }
      this.emitLobby();
      return;
    }
    const id = this.peerToClient.get(peer);
    const p = this.players.find((x) => x.clientId === id);
    if (!p) return;
    if (msg.t === "ready") p.ready = msg.ready;
    else if (msg.t === "name") p.name = cleanName(msg.name);
    else if (msg.t === "vehicle") p.car = msg.car;
    else if (msg.t === "car") {
      this.race?.applyRemoteCar(p.clientId, msg.state);
      return;
    }
    this.emitLobby();
  }

  private drop(peer: string): void {
    const id = this.peerToClient.get(peer);
    this.peerToClient.delete(peer);
    const p = this.players.find((x) => x.clientId === id);
    if (!p) return;
    p.connected = false;
    this.race?.setHumanConnected(p.clientId, false);
    // Nach Ablauf der Frist endgültig aus der Lobby entfernen (im Rennen fährt weiter ein Bot).
    this.dropTimers.set(
      p.clientId,
      window.setTimeout(() => {
        if (!p.connected && !this.race) this.players = this.players.filter((x) => x !== p);
        this.emitLobby();
      }, RECONNECT_WINDOW * 1000),
    );
    this.emitLobby();
  }

  private emitLobby(): void {
    this.transport?.broadcast({ t: "lobby", players: this.players, settings: this.settings });
    this.events.onLobby(this.players, this.settings);
  }

  setName(name: string): void {
    this.players[0]!.name = cleanName(name);
    this.emitLobby();
  }

  updateSettings(patch: Partial<LobbySettings>): void {
    const trackId = patch.trackId && trackById(patch.trackId) ? patch.trackId : this.settings.trackId;
    this.settings = { ...this.settings, ...patch, trackId, laps: clampLaps(patch.laps ?? this.settings.laps) };
    this.emitLobby();
  }

  get canStart(): boolean {
    return this.players.filter((p) => p.connected).every((p) => p.ready);
  }

  /** Startaufstellung: Menschen in Beitrittsreihenfolge, Rest mit Bots auffüllen. */
  start(): StartMessage {
    const humans = this.players.filter((p) => p.connected);
    this.players[0]!.car = currentCar();
    const grid: GridEntry[] = humans.map((p) => ({ id: p.clientId, name: p.name, color: p.color, human: true, car: p.car }));
    // APEX-AI always races along (if there is a free slot).
    if (grid.length < MAX_PLAYERS) grid.splice(Math.min(grid.length, 2), 0, apexAiEntry());
    if (this.settings.fillWithBots) {
      let b = 0;
      while (grid.length < MAX_PLAYERS) {
        const color = RACER_COLORS.find((c) => !grid.some((g) => g.color === c)) ?? RACER_COLORS[(b % 9) + 1]!;
        grid.push({ id: `bot-${b}`, name: BOT_NAMES[b % BOT_NAMES.length]!, color, human: false });
        b++;
      }
    }
    const msg: StartMessage = { t: "start", seed: Math.floor(Math.random() * 1e9), settings: this.settings, grid };
    this.lastStart = msg;
    this.transport?.broadcast(msg);
    for (const p of this.players) if (!p.isHost) p.ready = false;
    return msg;
  }

  backToLobby(): void {
    this.race = null;
    this.lastStart = null;
    this.transport?.broadcast({ t: "toLobby" });
    this.players = this.players.filter((p) => p.connected);
    this.emitLobby();
  }

  close(): void {
    window.clearInterval(this.timer);
    this.transport?.close();
  }
}

/** Client einer Online-Runde. */
export class ClientSession {
  players: LobbyPlayer[] = [];
  settings: LobbySettings | null = null;
  race: RaceScene | null = null;
  private transport: ClientTransport | null = null;
  private timer = 0;
  private closedByUs = false;

  constructor(
    private readonly signaling: SignalingProvider,
    readonly code: string,
    readonly clientId: string,
    private name: string,
    private readonly events: SessionEvents,
  ) {}

  async open(): Promise<void> {
    const t = await this.signaling.join(this.code);
    this.transport = t;
    t.onMessage((msg) => this.handle(msg));
    t.onClose(() => {
      if (!this.closedByUs) this.events.onClosed("Die Verbindung zum Host ist abgebrochen.");
    });
    t.send({ t: "hello", clientId: this.clientId, name: this.name, car: currentCar() });
    this.timer = window.setInterval(() => {
      if (this.race) t.send({ t: "car", state: this.race.localCarState() });
    }, 1000 / SNAPSHOT_RATE);
  }

  private handle(msg: HostMessage): void {
    switch (msg.t) {
      case "welcome":
      case "lobby":
        this.players = msg.players;
        this.settings = msg.settings;
        this.events.onLobby(msg.players, msg.settings);
        break;
      case "start":
        this.events.onStart(msg);
        break;
      case "snap":
        this.race?.applySnapshot(msg);
        break;
      case "toLobby":
        this.race = null;
        this.events.onToLobby();
        break;
      case "kick":
        this.events.onClosed(msg.reason);
        break;
    }
  }

  setReady(ready: boolean): void {
    this.transport?.send({ t: "ready", ready });
  }

  setName(name: string): void {
    this.name = name;
    this.transport?.send({ t: "name", name });
  }

  close(): void {
    this.closedByUs = true;
    window.clearInterval(this.timer);
    this.transport?.close();
  }
}

function cleanName(name: string): string {
  const n = name.replace(/\s+/g, " ").trim().slice(0, 16);
  return n || "Fahrer";
}
