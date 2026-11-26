import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  FALSE_START_PENALTY,
  FINISH_GRACE_TIME,
  LapTracker,
  PERFECT_START_WINDOW,
  CARS,
  carById,
  computeAwards,
  defaultLooks,
  raceReward,
  statsFor,
  stockTuning,
  type CarLooks,
  type RaceReward,
  type Tuning,
  formatTime,
  pointsForPlace,
  type CupStandings,
  rankRacers,
  theme,
  DEFAULT_ENVIRONMENT,
  trackGravity,
  weatherGrip,
  ITEM_NAMES,
  type TrackDef,
  type Weather,
  ReplayRecorder,
  EMOTES,
  FxLimiter,
  isEmote,
  type FxKind,
  RivalBook,
  RIVAL_BONUS_POINTS,
  RIVAL_BONUS_XP,
  pickHighlights,
  type Replay,
} from "@apex/shared";
import { INTERPOLATION_DELAY, SnapshotBuffer, type CarState, type HostMessage, type RacerStatus } from "@apex/net";
import { Car } from "./car";
import { ChaseCamera } from "./chaseCamera";
import { Hud } from "./hud";
import { Input, type ControlState } from "./input";
import { Sparks } from "./sparks";
import { createSky } from "./sky";
import { loadEnvironmentMap } from "./environmentMap";
import { POST_FX, type PostFx } from "./postFx";
import { Chaos } from "./chaos";
import { SoloMode } from "./soloMode";
import { ReplayView } from "./replayView";
import { CarFx } from "./carFx";
import { Rain, weatherEnvIntensity, weatherEnvironment, weatherFog, weatherLight, weatherPostFx } from "./weatherFx";
import { BotDriver, type BotSkill } from "./bot";
import { RaceHud } from "./raceHud";
import { SplineTrack, mulberry32 } from "./track/splineTrack";
import { Podium } from "./podium";
import { AiDriver, CURRENT_MODEL } from "@apex/ai";

const STEP = 1 / 60;
export const BOT_NAMES = ["Nova", "Blaze", "Kaito", "Vera", "Rook", "Juno", "Dash", "Mika", "Zed"];
export const RACER_COLORS = [theme.cyan, theme.magenta, theme.orange, theme.violet, 0x39ff88, 0xffe14d, 0xff4d6d, 0x4dd2ff, 0xc0c0ff, 0xff9ef0];
const LEVEL_NAMES = ["", "BOOST", "SUPER BOOST", "ULTRA BOOST"];
const LEVEL_COLORS = ["white", "cyan", "orange", "violet"] as const;

export type Phase = "intro" | "countdown" | "racing" | "finishing" | "results";
export type NetRole = "offline" | "host" | "client";

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

export interface RewardSummary {
  reward: RaceReward;
  levelUp: boolean;
  level: number;
  unlocked: string[];
}

interface Racer {
  id: string;
  name: string;
  car: Car;
  tracker: LapTracker;
  bot: BotDriver | null;
  ai: AiDriver | null;
  human: boolean;
  index: number;
  color: number;
  wrongWayTime: number;
  buffer: SnapshotBuffer | null;
  netStatus: RacerStatus | null;
  connected: boolean;
  driftTime: number;
  overtakes: number;
  worstPlace: number;
  lastPlace: number;
  onPodium: boolean;
}

export interface RaceOptions {
  track: TrackDef;
  laps: number;
  bots: number;
  skill: BotSkill;
  playerName: string;
  /** Nur für Tests: Spieler fährt per Bot-Logik. */
  autopilot?: boolean;
  /** Auto des lokalen Spielers (offline). */
  playerCar?: { id: string; tuning: unknown; looks: unknown };
  /** Netzwerk: Rolle, eigene ID und Startaufstellung vom Host. */
  role?: NetRole;
  localId?: string;
  grid?: GridEntry[];
  seed?: number;
  /** Grand Prix: aktuelle Runde, Anzahl Rennen und Gesamtwertung (wird nach dem Rennen ergänzt). */
  cup?: { round: number; total: number; standings: CupStandings };
  /** Weather of this race (already resolved, never "random"). */
  weather?: Weather;
  /** Chaos mode: item boxes and power-ups. */
  chaos?: boolean;
  /** Rival bookkeeping kept across the races of a session (offline/host). */
  rivals?: RivalBook;
  /** Host only: rival books of the other human players (id → book), kept across races. */
  peerRivals?: Map<string, RivalBook>;
  /** Game mode: normal race, time trial against the own ghost, or drift challenge (both alone). */
  mode?: RaceMode;
}

export type RaceMode = "race" | "timetrial" | "drift";

export interface RaceCallbacks {
  onRestart: () => void;
  onMenu: () => void;
  onNext?: () => void;
  /** Wird einmal aufgerufen, wenn das Ergebnis feststeht; liefert die Belohnung für die Anzeige. */
  onReward?: (reward: RaceReward, info: { place: number; cupWin: boolean }) => RewardSummary;
  /** Online client: the player wants to use the held item (sent to the host). */
  onUseItem?: () => void;
  /** A horn or emote happened here (own car, or a bot on host/offline) – online it goes to everyone. */
  onFx?: (id: string, kind: FxKind, value?: string) => void;
}

/** Ein komplettes Rennen: Intro, Countdown, Runden, Zieleinlauf, Ergebnis – offline, als Host oder als Client. */
export class RaceScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  readonly input = new Input();
  readonly world: RAPIER.World;
  readonly track: SplineTrack;
  readonly racers: Racer[] = [];
  /** The local player's racer – while spectating, the driver being watched. */
  player: Racer;
  /** Joined during a running race: not in the grid, only watching. */
  readonly spectating: boolean;
  readonly role: NetRole;
  phase: Phase = "intro";
  raceTime = 0;
  private phaseTime = 0;
  private countdownStep = -1;
  private falseStart = 0;
  private startBoostGiven = false;
  private graceLeft = FINISH_GRACE_TIME;
  private timeScale = 1;
  private slowMoLeft = 0;
  private accumulator = 0;
  private clock = 0; // lokale Uhr in s
  private hostClockOffset: number | null = null;
  private lastLap = 0;
  private lapStartLocal = 0;
  private resultsTimer = 0;
  private resultsFinal = false;
  private refreshTimer = 0;
  private placeTimer = 0;
  private podium: Podium | null = null;
  private readonly carFx: CarFx;
  private readonly fxLimiter = new FxLimiter();
  private readonly rivals: RivalBook | null;
  private rivalBeaten = false;
  /** Online client: the rival the host told us about. */
  private netRival: string | null = null;
  private readonly canvas: HTMLCanvasElement;
  private readonly replayRec = new ReplayRecorder();
  private replayClock = 0;
  private replayData: Replay | null = null;
  private replayView: ReplayView | null = null;
  private highlightsShown = false;
  private readonly replayTrack = new Map<string, { drift: number; air: number }>();
  private replayRankTimer = 0;
  private replayRank: string[] = [];
  private readonly sky: THREE.Group;
  /** Bloom and colour grade of this track. */
  readonly postFx: PostFx;
  private bridgeBannerIn = 0;
  private chaos: Chaos | null = null;
  private readonly solo: SoloMode | null;
  private prevItemKey = false;
  private readonly pendingUses = new Set<string>();
  private rain: Rain | null = null;
  readonly weather: Weather;
  private headlight: THREE.SpotLight | null = null;
  private eventBanner = "";
  private podiumTime = 0;
  private cupRecorded = false;
  private cupCeremony = false;
  private readonly chase: ChaseCamera;
  private readonly hud: Hud;
  private readonly raceHud: RaceHud;
  private readonly sparks = new Sparks();
  private readonly results: HTMLElement;
  private readonly tmp = new THREE.Vector3();
  private readonly idle: ControlState = { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false, reset: false };

  constructor(
    private readonly ui: HTMLElement,
    renderer: THREE.WebGLRenderer,
    readonly options: RaceOptions,
    private readonly callbacks: RaceCallbacks,
  ) {
    this.role = options.role ?? "offline";
    this.canvas = renderer.domElement;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = options.weather === "night" ? 0.08 : 0.25;
    this.scene.background = new THREE.Color(theme.background);
    const weather = options.weather ?? "clear";
    const baseEnv = options.track.environment ?? DEFAULT_ENVIRONMENT;
    const env = weatherEnvironment(baseEnv, weather);
    this.postFx = weatherPostFx(POST_FX[env.scenery], weather);
    // Track-specific reflections (CC0 HDRI), loaded in the background; the room environment is the fallback.
    loadEnvironmentMap(renderer, env.scenery)
      .then((tex) => {
        if (this.disposed) tex.dispose();
        else {
          this.scene.environment = tex;
          // real HDRIs are darker than the generated room environment; at night much less
          this.scene.environmentIntensity = weatherEnvIntensity(this.weather);
        }
      })
      .catch(() => undefined);
    const [fogNear, fogFar] = weatherFog(weather);
    this.scene.fog = new THREE.Fog(env.fog, fogNear, fogFar);
    this.sky = createSky(env);
    this.scene.add(this.sky);
    const light = weatherLight(weather);
    this.scene.add(new THREE.HemisphereLight(0x8899ff, 0x220022, 0.55 * light));
    const sun = new THREE.DirectionalLight(0xffd6f0, 0.9 * light);
    sun.position.set(60, 120, 40);
    this.scene.add(sun);

    this.world = new RAPIER.World({ x: 0, y: -trackGravity(options.track), z: 0 });
    this.world.timestep = STEP;
    this.track = new SplineTrack(this.world, options.track);
    this.track.weatherGrip = weatherGrip(weather);
    if (weather === "rain") {
      this.track.setWet();
      this.rain = new Rain();
      this.scene.add(this.rain.object);
    }
    this.weather = weather;
    this.scene.add(this.track.group);

    this.hud = new Hud(ui);
    this.raceHud = new RaceHud(ui, this.track);
    this.results = document.createElement("div");
    this.results.className = "results";
    ui.appendChild(this.results);

    const localId = options.localId ?? "player";
    const grid = options.grid ?? RaceScene.offlineGrid(options);
    const rnd = mulberry32(options.seed ?? 42);
    grid.slice(0, 10).forEach((entry, slot) => {
      const isLocal = entry.id === localId;
      const simulatedBot = !entry.human && this.role !== "client";
      const remote = !isLocal && !simulatedBot;
      const choice = entry.car ?? (isLocal ? options.playerCar : undefined) ?? RaceScene.botCar(entry, rnd);
      const def = carById(choice.id);
      const tuning = (choice.tuning as Tuning | undefined) ?? stockTuning();
      const looks = (choice.looks as CarLooks | undefined) ?? defaultLooks(def);
      const car = new Car(
        this.world,
        statsFor(def, tuning),
        isLocal
          ? {
              onDriftBoost: (level) => {
                this.hud.showToast(LEVEL_NAMES[level]!, LEVEL_COLORS[level]);
                this.chase.kick(0.15 * level);
                this.sparks.emit(car.mesh.position, level, 40 * level, 6);
              },
            }
          : {},
        { def, looks },
      );
      car.groundPress = Math.max(0, 9.81 - trackGravity(options.track));
      const { pos, yaw } = this.track.gridSlot(slot);
      car.setResetPose(pos, yaw);
      car.reset();
      car.setRemote(remote);
      this.scene.add(car.mesh);
      const aiDriven = Boolean(entry.ai) && simulatedBot;
      const drivenByBot = (simulatedBot && !aiDriven) || (isLocal && options.autopilot);
      this.racers.push({
        id: entry.id,
        name: entry.name,
        car,
        tracker: new LapTracker(options.laps),
        bot: drivenByBot ? new BotDriver(car, this.track, isLocal ? "hard" : options.skill, rnd) : null,
        ai: aiDriven ? new AiDriver(CURRENT_MODEL) : null,
        human: entry.human,
        index: this.track.nearestIndex(pos),
        color: entry.color,
        wrongWayTime: 0,
        buffer: remote ? new SnapshotBuffer() : null,
        netStatus: null,
        connected: true,
        driftTime: 0,
        overtakes: 0,
        worstPlace: slot + 1,
        lastPlace: slot + 1,
        onPodium: false,
      });
    });
    const own = this.racers.find((r) => r.id === localId);
    this.spectating = !own && this.role === "client";
    this.player = own ?? this.racers[0]!;
    if (this.weather === "night") {
      // Headlights: one spot light on the player's car (cheap), pointing a bit down the road
      const spot = new THREE.SpotLight(0xfff0d0, 260, 90, 0.55, 0.45, 1.4);
      spot.position.set(0, 1.1, 1.6);
      spot.target.position.set(0, -0.5, 25);
      this.player.car.mesh.add(spot, spot.target);
      this.headlight = spot;
    }
    for (const r of this.racers) r.tracker.update(r.index / this.track.samples.length, 0);

    this.scene.add(this.sparks.points);
    this.chase = new ChaseCamera(this.camera);
    if (options.chaos) {
      this.chaos = new Chaos(this.scene, ui, this.track, this.role !== "client", options.seed ?? 1, this.player.id, {
        onLocal: (e) => {
          if (e.type === "pickup") this.hud.showToast(ITEM_NAMES[e.item], "cyan");
          else if (e.type === "hit") {
            this.raceHud.showBanner("GETROFFEN!", 1.2);
            this.chase.kick(0.7);
          } else if (e.type === "blocked") this.raceHud.showBanner("ABGEWEHRT!", 1.2);
          else if (e.type === "use" && e.item === "turbo") this.chase.kick(0.25);
        },
        onEmp: (pos) => this.chaos?.ring(pos),
      });
    }
    this.solo = options.mode && options.mode !== "race" && this.role === "offline" ? new SoloMode(options.mode, options.track, this.scene, ui, this.player.car) : null;
    this.raceHud.showBanner(options.track.name.toUpperCase(), 3);
    window.addEventListener("keydown", this.skipIntro);
    this.carFx = new CarFx(this.scene, this.camera);
    this.rivals = this.role === "client" || this.solo ? null : (options.rivals ?? new RivalBook());
    if (this.spectating) this.setupSpectator();
    this.carFx.setRival(this.rivalRacer?.car.mesh ?? null);
    window.addEventListener("keydown", this.onFxKey);
  }

  /** Spectator: banner, a hint and Q/E to switch the watched driver. */
  private setupSpectator(): void {
    const tag = document.createElement("div");
    tag.className = "spectator-tag";
    tag.dataset.testid = "spectator";
    tag.innerHTML = `<b>ZUSCHAUER</b><span>Q/E: Fahrer wechseln · Im nächsten Rennen fährst du mit</span><em></em>`;
    this.ui.appendChild(tag);
    this.spectatorTag = tag;
    this.ui.querySelector(".hud-help")?.remove();
    this.watch(0);
    window.addEventListener("keydown", this.onSpectatorKey);
  }

  private spectatorTag: HTMLElement | null = null;

  /** Switch the watched driver by `step` places. */
  watch(step: number): void {
    const i = this.racers.indexOf(this.player);
    this.player = this.racers[(i + step + this.racers.length) % this.racers.length]!;
    const name = this.spectatorTag?.querySelector("em");
    if (name) name.textContent = this.player.name;
  }

  private readonly onSpectatorKey = (e: KeyboardEvent): void => {
    if (this.replayView) return;
    if (e.code === "KeyE" || e.code === "ArrowRight") this.watch(1);
    if (e.code === "KeyQ" || e.code === "ArrowLeft") this.watch(-1);
  };

  /** H = horn, 1–6 = emotes (also on the podium). */
  private readonly onFxKey = (e: KeyboardEvent): void => {
    if (this.replayView || this.phase === "intro" || e.repeat) return;
    if (e.target instanceof HTMLInputElement) return;
    if (e.code === "KeyH") this.localFx("horn");
    const n = /^Digit([1-6])$/.exec(e.code);
    if (n) this.localFx("emote", EMOTES[Number(n[1]) - 1]);
  };

  /** The local player honks or emotes: show it here and send it to the others. */
  localFx(kind: FxKind, value?: string): void {
    if (this.spectating) return;
    if (!this.fxLimiter.allow(`${this.player.id}:${kind}`, this.clock)) return;
    this.showFx(this.player.id, kind, value);
    this.callbacks.onFx?.(this.player.id, kind, value);
  }

  /** Show a horn or emote of any racer (also called for messages from the network). */
  showFx(id: string, kind: FxKind, value?: string): void {
    const r = this.racers.find((x) => x.id === id);
    if (!r) return;
    if (kind === "horn") this.carFx.horn(r.car.mesh, r.car.modelId);
    else if (isEmote(value)) {
      if (this.podium && r.onPodium) this.podium.showEmote(r.car, value);
      else this.carFx.emote(r.car.mesh, value);
    }
  }

  private get rivalRacer(): Racer | null {
    const id = this.role === "client" ? this.netRival : this.rivals?.rival();
    return (id && this.racers.find((r) => r.id === id && r !== this.player)) || null;
  }

  /** Someone just overtook the local player. */
  private notePassedPlayer(passer: Racer): void {
    if (!this.rivals || passer === this.player) return;
    if (this.rivals.add(passer.id)) {
      this.carFx.setRival(passer.car.mesh);
      this.raceHud.showBanner(`NEUER RIVALE: ${passer.name.toUpperCase()}`, 2.5);
    }
  }

  /** Bots sometimes honk or show off when they pass someone closely (only where bots are simulated). */
  private botBanter(r: Racer, passed: Racer | undefined): void {
    if (!passed || this.role === "client" || r.human || this.options.autopilot) return;
    if (r.car.mesh.position.distanceTo(passed.car.mesh.position) > 12 || Math.random() > 0.35) return;
    if (!this.fxLimiter.allow(r.id, this.clock)) return;
    const kind: FxKind = Math.random() < 0.6 ? "horn" : "emote";
    const value = kind === "emote" ? (Math.random() < 0.5 ? "😎" : "👋") : undefined;
    this.showFx(r.id, kind, value);
    this.callbacks.onFx?.(r.id, kind, value);
  }

  /** Bots fahren Autos aus den ersten drei Klassen in ihrer Farbe. */
  static botCar(entry: GridEntry, rnd: () => number): { id: string; tuning: Tuning; looks: CarLooks } {
    const pool = CARS.filter((c) => c.cls !== "hyper");
    const def = pool[Math.floor(rnd() * pool.length)]!;
    const looks = { ...defaultLooks(def), color: entry.color, rimColor: entry.color, underglow: entry.color, decal: "stripes" as const };
    return { id: def.id, tuning: stockTuning(), looks };
  }

  /** Offline-Aufstellung: Spieler startet im hinteren Mittelfeld, der Rest sind Bots. */
  static offlineGrid(options: RaceOptions): GridEntry[] {
    // time trial and drift challenge: alone on the track
    if (options.mode && options.mode !== "race") return [{ id: "player", name: options.playerName, color: theme.cyan, human: true }];
    const total = Math.min(10, 2 + options.bots);
    const playerSlot = Math.min(total - 1, Math.floor(total * 0.6));
    const aiSlot = Math.floor(total * 0.3);
    const grid: GridEntry[] = [];
    let bot = 0;
    for (let slot = 0; slot < total; slot++) {
      if (slot === playerSlot) grid.push({ id: "player", name: options.playerName, color: theme.cyan, human: true });
      else if (slot === aiSlot) grid.push(apexAiEntry());
      else {
        grid.push({ id: `bot-${bot}`, name: BOT_NAMES[bot % BOT_NAMES.length]!, color: RACER_COLORS[(bot % 9) + 1]!, human: false });
        bot++;
      }
    }
    return grid;
  }

  private readonly skipIntro = (e: KeyboardEvent): void => {
    if (this.role !== "client" && this.phase === "intro" && (e.code === "Enter" || e.code === "Space")) this.startCountdown();
  };

  private startCountdown(): void {
    this.phase = "countdown";
    this.phaseTime = 0;
    this.countdownStep = -1;
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Rennstatus eines Fahrers: lokal berechnet oder (als Client) vom Host. */
  private status(r: Racer): RacerStatus {
    if (this.role === "client") return r.netStatus ?? { id: r.id, progress: 0, lap: 0, finishTime: null, bestLap: null };
    return {
      id: r.id,
      progress: r.tracker.progress,
      lap: r.tracker.lap,
      finishTime: r.tracker.finishTime,
      bestLap: r.tracker.bestLap,
      drift: Math.round(r.driftTime * 10) / 10,
      overtakes: r.overtakes,
      worst: r.worstPlace,
    };
  }

  private finished(r: Racer): boolean {
    return this.status(r).finishTime !== null;
  }

  get playerPlace(): number {
    return this.ranking().indexOf(this.player) + 1;
  }

  /** Chaos mode step: host/offline runs the item system, clients apply their own effects. */
  private stepChaos(playerControls: ControlState): void {
    const chaos = this.chaos!;
    const pressed = Boolean(playerControls.item) && !this.prevItemKey && !this.finished(this.player);
    this.prevItemKey = Boolean(playerControls.item);
    if (this.role === "client") {
      chaos.stepClient(this.player.car, STEP);
      if (pressed) this.callbacks.onUseItem?.();
      return;
    }
    const order = this.ranking();
    const list = this.racers.map((r) => ({ id: r.id, car: r.car, index: r.index, place: order.indexOf(r) + 1, progress: this.status(r).progress }));
    const uses = new Set(this.pendingUses);
    this.pendingUses.clear();
    if (pressed) uses.add(this.player.id);
    // bots and APEX-AI (and the player on autopilot) use their items by simple rules
    const auto = new Set(this.racers.filter((r) => !this.finished(r) && (!r.human || (r === this.player && this.options.autopilot))).map((r) => r.id));
    chaos.step(list, uses, auto, STEP);
  }

  /** Host: an online client wants to use its item. */
  useItemRemote(id: string): void {
    this.pendingUses.add(id);
  }

  private ranking(): Racer[] {
    const ranked = rankRacers(this.racers.map((r) => ({ ...this.status(r), id: r.id })));
    return ranked.map((s) => this.racers.find((x) => x.id === s.id)!);
  }

  private get racing(): boolean {
    return this.phase === "racing" || this.phase === "finishing" || this.phase === "results";
  }

  update(frameDt: number): void {
    const realDt = Math.min(frameDt, 0.1);
    (this.sky.userData.update as ((dt: number) => void) | undefined)?.(realDt);
    this.track.syncBridges(realDt);
    this.rain?.update(realDt, this.camera);
    if (this.bridgeBannerIn > 0) {
      this.bridgeBannerIn -= realDt;
      if (this.bridgeBannerIn <= 0) this.raceHud.showBanner(this.eventBanner, 3);
    }
    this.clock += realDt;
    this.phaseTime += realDt;
    this.carFx.update(realDt);
    if (this.replayView) {
      this.replayView.update(realDt);
      return;
    }

    if (this.phase === "intro") {
      this.updateIntroCamera();
      if (this.role !== "client" && this.phaseTime > 4) this.startCountdown();
      this.syncAll();
      this.raceHud.update(realDt, this.hudInfo(), this.hudRacers());
      return;
    }

    if (this.phase === "countdown") this.updateCountdown();

    if (this.slowMoLeft > 0) {
      this.slowMoLeft -= realDt;
      this.timeScale = this.slowMoLeft > 0 ? 0.35 : 1;
    }
    const dt = realDt * this.timeScale;
    const playerControls = this.input.read(realDt);

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < 6) {
      this.physicsStep(playerControls);
      this.accumulator -= STEP;
      steps++;
      playerControls.reset = false;
    }
    this.syncAll();
    if (this.phase === "racing" || this.phase === "finishing") this.recordReplay(dt);
    this.updateEffects(dt);
    if (this.podium) {
      this.podiumTime += realDt;
      this.podium.update(realDt, this.camera);
      if (this.podiumTime > 7 && !this.results.classList.contains("show")) this.showResults(true);
      return;
    }
    this.chase.update(this.player.car, realDt);
    this.chaos?.render(realDt, this.racers.map((r) => ({ id: r.id, pos: r.car.mesh.position })));
    if (this.solo && (this.phase === "racing" || this.phase === "countdown")) this.solo.render(this.phase === "racing" ? this.player.tracker.currentLapTime(this.raceTime) : 0);
    this.hud.update(this.player.car, realDt);
    this.raceHud.update(realDt, this.hudInfo(), this.hudRacers());
  }

  /** Record every car's pose and notable moments for replay and highlight clip. */
  private recordReplay(dt: number): void {
    this.replayClock += dt;
    const t = this.replayClock;
    for (const r of this.racers) {
      const p = r.car.mesh.position;
      const f = r.car.forward(this.tmp);
      this.replayRec.add(r.id, t, { x: p.x, y: p.y, z: p.z, yaw: Math.atan2(f.x, f.z) });
      let st = this.replayTrack.get(r.id);
      if (!st) this.replayTrack.set(r.id, (st = { drift: 0, air: 0 }));
      if (r.car.drifting) st.drift += dt;
      else if (st.drift > 0) {
        this.replayRec.moment({ kind: "drift", t, carId: r.id, value: st.drift });
        st.drift = 0;
      }
      const inAir = this.role !== "client" && !r.car.grounded;
      if (inAir) st.air += dt;
      else if (st.air > 0) {
        this.replayRec.moment({ kind: "jump", t, carId: r.id, value: st.air });
        st.air = 0;
      }
    }
    this.replayRankTimer -= dt;
    if (this.replayRankTimer > 0 || t < 3) return;
    this.replayRankTimer = 0.25;
    const ranked = this.ranking();
    const ids = ranked.map((r) => r.id);
    ranked.forEach((r, i) => {
      const before = this.replayRank.indexOf(r.id);
      const passed = ranked[i + 1];
      if (before > i && passed && !this.finished(r)) {
        const gap = r.car.mesh.position.distanceTo(passed.car.mesh.position);
        if (gap < 15) this.replayRec.moment({ kind: "overtake", t, carId: r.id, value: 1 / (gap + 0.5) });
      }
    });
    this.replayRank = ids;
  }

  /** Replay (free) or highlight clip, played over the results screen. */
  private openReplay(highlights: boolean): void {
    if (this.replayView) return;
    this.replayData ??= this.replayRec.finish();
    const segments = highlights ? pickHighlights(this.replayData) : null;
    if (highlights && !segments!.length) return;
    this.results.classList.remove("show");
    if (this.podium) this.podium.group.visible = false;
    this.ui.querySelectorAll<HTMLElement>(".race-hud, .hud, .emote-bar").forEach((el) => el.classList.add("replay-hidden"));
    this.replayView = new ReplayView(
      this.replayData,
      this.racers.map((r) => ({ id: r.id, name: r.name, mesh: r.car.mesh })),
      this.camera,
      this.canvas,
      this.ui,
      this.player.id,
      () => {
        this.replayView = null;
        if (this.podium) this.podium.group.visible = true;
        this.ui.querySelectorAll<HTMLElement>(".replay-hidden").forEach((el) => el.classList.remove("replay-hidden"));
        this.syncAll();
        this.results.classList.add("show");
      },
      segments,
    );
  }

  private updateEffects(dt: number): void {
    const car = this.player.car;
    if (car.drifting) {
      const level = Math.min(3, Math.floor(car.driftTime / 0.8));
      const back = car.forward(this.tmp).multiplyScalar(-1.6).add(car.mesh.position);
      back.y -= 0.4;
      this.sparks.emit(back, level, 3);
    }
    if (car.nitroActive) {
      const back = car.forward(this.tmp).multiplyScalar(-2.1).add(car.mesh.position);
      this.sparks.emit(back, 1, 4, 1.5);
    }
    this.sparks.update(dt);
  }

  private updateIntroCamera(): void {
    const t = Math.min(1, this.phaseTime / 4);
    const ease = t * t * (3 - 2 * t);
    const start = this.track.sample(0).pos;
    const angle = 1.2 - ease * 1.2;
    const radius = 120 - ease * 100;
    const height = 70 - ease * 62;
    this.camera.position.set(start.x + Math.sin(angle) * radius, start.y + height, start.z - Math.cos(angle) * radius);
    this.camera.lookAt(start.x, start.y, start.z - 10);
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
  }

  private updateCountdown(): void {
    const step = Math.floor(this.phaseTime);
    if (step !== this.countdownStep) {
      this.countdownStep = step;
      if (step < 3) this.raceHud.setCountdown(String(3 - step), ["#ff2bd6", "#ff8a1f", "#ffe14d"][step]);
      else {
        this.raceHud.setCountdown("GO!", "#39ff88");
        this.phase = "racing";
        this.phaseTime = 0;
        this.raceTime = 0;
      }
    }
  }

  /** Steuerung des lokalen Spielers inklusive Perfektstart und Frühstart. */
  private localControls(r: Racer, input: ControlState): ControlState {
    if (this.finished(r)) return { ...this.idle, brake: r.car.speed > 3 ? 0.4 : 0 };
    if (!this.racing) {
      if (input.throttle > 0 && this.phase === "countdown" && this.phaseTime > 1.5) this.falseStart = FALSE_START_PENALTY;
      return this.idle;
    }
    if (r.bot) {
      this.startBoostGiven = true;
      return r.bot.drive(STEP);
    }
    let controls = input;
    if (!this.startBoostGiven && this.raceTime < PERFECT_START_WINDOW && input.throttle > 0) {
      this.startBoostGiven = true;
      if (this.falseStart <= 0) {
        r.car.boostTime = 1.0;
        r.car.nitro.charge(0.5);
        this.raceHud.showBanner("PERFEKTSTART!", 1.5);
        this.chase.kick(0.3);
      }
    }
    if (this.falseStart > 0) {
      this.falseStart -= STEP;
      this.startBoostGiven = true;
      controls = { ...controls, throttle: 0, steer: Math.sin(this.raceTime * 20) * 0.3 };
    }
    return controls;
  }

  private physicsStep(playerControls: ControlState): void {
    if (this.racing && this.role !== "client") this.raceTime += STEP;
    const renderTime = this.remoteRenderTime();

    for (const r of this.racers) {
      if (r.onPodium) continue;
      if (r.buffer) {
        const s = r.buffer.sample(renderTime);
        if (s) r.car.setRemoteTarget(s.p, s.q, r.car.speed, r.car.drifting, r.car.nitroActive);
        continue;
      }
      let controls: ControlState;
      if (r === this.player) controls = this.localControls(r, playerControls);
      else if (!this.racing) controls = this.idle;
      else if (r.ai) {
        const others = this.racers.filter((x) => x !== r).map((x) => x.car);
        controls = this.finished(r) ? { ...this.idle, brake: r.car.speed > 3 ? 0.4 : 0 } : r.ai.drive(r.car, this.track, r.index, others, STEP);
      } else if (this.finished(r) && r.bot) controls = { ...r.bot.drive(STEP), throttle: 0.4, nitro: false };
      else if (r.bot) controls = r.bot.drive(STEP);
      else controls = this.idle;
      r.car.setSurfaceGrip(this.track.gripAt(r.index));
      if (this.track.lava) r.car.applyDrag(this.track.lavaDrag(r.index, this.track.lateralOffset(r.car.body.translation(), r.index)), STEP);
      r.car.update(controls, STEP);
    }
    if (this.track.hasEvents && this.racing) {
      const leaderLaps = Math.max(...this.racers.map((r) => this.status(r).lap));
      // Shown a moment later so it does not collide with the lap banner of the leader.
      for (const ev of this.track.updateEvents(leaderLaps, STEP)) {
        // lava switches only after lap 1 (no banner at the start)
        if (ev.event.kind === "lava" && this.track.lava!.leaderLaps === 0) continue;
        this.eventBanner =
          ev.event.kind === "lava"
            ? "LAVA WECHSELT DIE SEITE!"
            : ev.event.kind === "drawbridge"
            ? "ZUGBRÜCKE ÖFFNET SICH!"
            : "shortcut" in ev && ev.shortcut.def.kind === "temple"
              ? "TEMPEL STÜRZT EIN – ABKÜRZUNG FREI!"
              : "STEINSCHLAG – ABKÜRZUNG FREI!";
        this.bridgeBannerIn = 1.8;
      }
    }
    if (this.chaos && this.racing) this.stepChaos(playerControls);
    this.world.step();
    if (this.solo && this.phase === "racing" && !this.finished(this.player)) this.solo.step(this.player.tracker.currentLapTime(this.raceTime), STEP);
    if (this.racing && this.role !== "client") this.updateRaceStats();

    // Reset-Position des Spielers folgt der Strecke
    const n = this.track.samples.length;
    const playerLoc = this.track.locate(this.player.car.body.translation(), this.player.index);
    this.player.index = playerLoc.index;
    const back = this.track.sample(this.player.index - 2);
    this.player.car.setResetPose(back.pos, Math.atan2(back.tangent.x, back.tangent.z));

    if (!this.racing) return;

    // Falsche Richtung für den lokalen Spieler
    const tangent = playerLoc.shortcut
      ? playerLoc.shortcut.samples[Math.round(playerLoc.u * (playerLoc.shortcut.samples.length - 1))]!.tangent
      : this.track.sample(this.player.index).tangent;
    const wrong = this.player.car.forward(this.tmp).dot(tangent) < -0.3 && Math.abs(this.player.car.speed) > 3;
    this.player.wrongWayTime = wrong ? this.player.wrongWayTime + STEP : 0;

    if (this.role === "client") {
      this.checkLocalLapBanner();
      return;
    }

    for (const r of this.racers) {
      const loc = r === this.player ? playerLoc : this.track.locate(r.car.body.translation(), r.index);
      r.index = loc.index;
      const lapDone = r.tracker.update(r.index / n, this.raceTime);
      if (loc.shortcut && loc.u > 0.4 && loc.u < 0.6) r.tracker.creditShortcut(loc.shortcut.def.from, loc.shortcut.def.to);
      if (r === this.player && lapDone) this.onPlayerLap();
      if (lapDone && r.tracker.finished && this.phase === "racing") {
        this.phase = "finishing";
        if (r === this.player && this.role === "offline") this.slowMoLeft = 1.6;
      }
    }

    if (this.phase === "results" && !this.resultsFinal) {
      this.graceLeft -= STEP;
      this.refreshTimer -= STEP;
      if (this.racers.every((r) => r.tracker.finished) || this.graceLeft <= 0) {
        this.resultsFinal = true;
        this.onResultsFinal();
      }
      if (this.refreshTimer <= 0 || this.resultsFinal) {
        this.refreshTimer = 0.5;
        this.renderRows();
      }
    }
    if (this.phase === "finishing") {
      this.graceLeft -= STEP;
      const humansDone = this.racers.filter((r) => r.human && r.connected).every((r) => r.tracker.finished);
      if (humansDone && this.resultsTimer === 0) this.resultsTimer = 3;
      if (this.graceLeft <= 0) this.showResults();
    }
    if (this.resultsTimer > 0) {
      this.resultsTimer -= STEP;
      if (this.resultsTimer <= 0) this.showResults();
    }
  }

  /** Client: Runden-Ansagen aus dem Host-Status ableiten. */
  private checkLocalLapBanner(): void {
    const s = this.status(this.player);
    if (s.lap > this.lastLap) {
      this.lastLap = s.lap;
      this.lapStartLocal = this.raceTime;
      this.onPlayerLap();
    }
  }

  private onPlayerLap(): void {
    const s = this.status(this.player);
    const soloBanner = this.solo?.lapDone(this.player.tracker.lapTimes.at(-1)!);
    if (soloBanner && s.finishTime === null) {
      this.raceHud.showBanner(soloBanner, 2.5);
      return;
    }
    if (s.finishTime !== null) {
      this.raceHud.setCountdown("ZIEL!", "#f4f6ff");
      this.raceHud.showBanner(`PLATZ ${this.playerPlace}`, 3);
    } else if (s.lap === this.options.laps - 1) {
      this.raceHud.showBanner("FINAL LAP", 2.5);
    } else {
      this.raceHud.showBanner(`RUNDE ${s.lap + 1}`, 1.5);
    }
  }

  /** Platzierungen, Überholungen und Driftzeit fürs Auszeichnungs-System (Host/Offline). */
  private updateRaceStats(): void {
    for (const r of this.racers) if (r.car.drifting && !this.finished(r)) r.driftTime += STEP;
    this.placeTimer -= STEP;
    if (this.placeTimer > 0) return;
    this.placeTimer = 0.5;
    const ranked = this.ranking();
    ranked.forEach((r, i) => {
      const place = i + 1;
      if (this.raceTime > 3 && !this.finished(r) && place < r.lastPlace) {
        r.overtakes += r.lastPlace - place;
        this.botBanter(r, ranked[i + 1]);
        if (ranked[i + 1] === this.player) this.notePassedPlayer(r);
        const victim = ranked[i + 1];
        if (victim && victim.human && victim !== this.player && victim !== r) {
          const books = this.options.peerRivals;
          if (books) {
            if (!books.has(victim.id)) books.set(victim.id, new RivalBook());
            books.get(victim.id)!.add(r.id);
          }
        }
      }
      if (this.raceTime > 3) r.worstPlace = Math.max(r.worstPlace, place);
      r.lastPlace = place;
    });
  }

  private awards() {
    const ranked = this.ranking();
    return computeAwards(
      ranked.map((r, i) => {
        const s = this.status(r);
        return {
          id: r.id,
          name: r.name,
          bestLap: s.bestLap,
          driftTime: s.drift ?? 0,
          overtakes: s.overtakes ?? 0,
          worstPlace: Math.max(s.worst ?? i + 1, i + 1),
          finalPlace: i + 1,
        };
      }),
    );
  }

  /** Alle im Ziel oder Frist abgelaufen: Wertung festschreiben und Siegertreppe zeigen. */
  private onResultsFinal(): void {
    const cup = this.options.cup;
    const order = this.ranking().map((r) => r.id);
    const rival = this.rivalRacer;
    this.rivalBeaten = Boolean(rival && !this.spectating && order.indexOf(this.player.id) < order.indexOf(rival.id));
    if (cup && !this.cupRecorded) {
      this.cupRecorded = true;
      const ranked = this.ranking();
      const fastest = Math.min(...this.racers.map((r) => this.status(r).bestLap ?? Infinity));
      cup.standings.add(
        ranked.map((r, i) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          place: i + 1,
          fastestLap: this.status(r).bestLap === fastest,
          bonus: r === this.player && this.rivalBeaten ? RIVAL_BONUS_POINTS : 0,
        })),
      );
    }
    this.grantReward();
    this.startPodium(this.ranking().slice(0, 3));
  }

  private rewardSummary: RewardSummary | null = null;

  private grantReward(): void {
    if (this.rewardSummary || !this.callbacks.onReward || this.options.autopilot || this.solo || this.spectating) return;
    const place = this.playerPlace;
    const s = this.status(this.player);
    const reward = raceReward(place, this.racers.length, s.finishTime !== null, s.drift ?? this.player.driftTime, s.overtakes ?? this.player.overtakes);
    if (this.rivalBeaten) reward.xp += RIVAL_BONUS_XP;
    const cup = this.options.cup;
    const cupWin = Boolean(cup && cup.standings.finished && cup.standings.table()[0]?.id === this.player.id);
    this.rewardSummary = this.callbacks.onReward(reward, { place, cupWin });
  }

  private startPodium(top: Racer[], title?: string): void {
    this.podium?.dispose();
    for (const r of this.racers) r.onPodium = false;
    const xs = this.track.samples.map((s) => s.pos.x);
    const zs = this.track.samples.map((s) => s.pos.z);
    const anchor = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, -1.9, Math.min(...zs) - 140);
    this.podium = new Podium(anchor, 0);
    this.scene.add(this.podium.group);
    for (const r of top) r.onPodium = true;
    this.podium.placeCars(top.map((r) => r.car));
    this.podiumTime = 0;
    this.results.classList.remove("show");
    this.ui.querySelectorAll<HTMLElement>(".race-hud, .hud").forEach((el) => (el.style.display = "none"));
    this.raceHud.showBanner(title ?? `SIEGER: ${top[0]?.name.toUpperCase() ?? ""}`, 6);
    this.ui.querySelector(".race-hud")?.setAttribute("style", "");
    this.ui.querySelectorAll<HTMLElement>(".race-hud > :not(.rh-banner)").forEach((el) => (el.style.display = "none"));
    this.showEmoteBar(top.includes(this.player));
  }

  private showEmoteBar(visible: boolean): void {
    this.ui.querySelector(".emote-bar")?.remove();
    if (!visible) return;
    const bar = document.createElement("div");
    bar.className = "emote-bar";
    bar.innerHTML = EMOTES.map((e) => `<button type="button" aria-label="Emote ${e}">${e}</button>`).join("");
    bar.querySelectorAll("button").forEach((b, i) => (b.onclick = () => this.localFx("emote", EMOTES[i])));
    this.ui.appendChild(bar);
  }

  private showResults(afterPodium = false): void {
    if (this.phase === "results" && this.results.classList.contains("show")) return;
    if (this.podium && !afterPodium && this.podiumTime < 7) return;
    this.phase = "results";
    const canRestart = this.role !== "client";
    const cup = this.options.cup;
    let primary = canRestart ? `<button class="btn" data-action="restart">${this.role === "host" ? "Zur Lobby" : "Revanche"}</button>` : `<span class="hint">Der Host startet das nächste Rennen.</span>`;
    if (cup && this.resultsFinal) {
      primary = cup.standings.finished
        ? this.cupCeremony
          ? ""
          : `<button class="btn" data-action="ceremony">Cup-Siegerehrung</button>`
        : `<button class="btn" data-action="next">Nächstes Rennen (${cup.round + 1}/${cup.total})</button>`;
    }
    this.results.innerHTML = `
      <div class="results-card" data-testid="results">
        <h2>${cup ? `GRAND PRIX · RENNEN ${cup.round}/${cup.total}` : "ERGEBNIS"} · ${this.options.track.name.toUpperCase()}</h2>
        <table>
          <thead><tr><th>#</th><th>Fahrer</th><th>Zeit</th><th>Beste Runde</th><th>Punkte</th></tr></thead>
          <tbody></tbody>
        </table>
        ${this.solo ? `<div class="solo-result" data-testid="solo-result">${this.solo.summary()}</div>` : ""}
        <div class="rival-result" data-testid="rival-result"></div>
        <div class="awards" data-testid="awards"></div>
        <div class="reward"></div>
        ${cup ? `<div class="standings"></div>` : ""}
        <div class="results-actions">
          ${primary}
          <button class="btn btn-ghost" data-action="highlights" data-testid="open-highlights">Highlights</button>
          <button class="btn btn-ghost" data-action="replay" data-testid="open-replay">Replay</button>
          <button class="btn btn-ghost" data-action="menu">Zum Menü</button>
        </div>
      </div>`;
    this.renderRows();
    this.results.classList.add("show");
    const restart = this.results.querySelector<HTMLButtonElement>("[data-action=restart]");
    if (restart) restart.onclick = () => this.callbacks.onRestart();
    const next = this.results.querySelector<HTMLButtonElement>("[data-action=next]");
    if (next) next.onclick = () => this.callbacks.onNext?.();
    const ceremony = this.results.querySelector<HTMLButtonElement>("[data-action=ceremony]");
    if (ceremony) ceremony.onclick = () => this.startCupCeremony();
    this.results.querySelector<HTMLButtonElement>("[data-action=menu]")!.onclick = () => this.callbacks.onMenu();
    this.results.querySelector<HTMLButtonElement>("[data-action=replay]")!.onclick = () => this.openReplay(false);
    this.results.querySelector<HTMLButtonElement>("[data-action=highlights]")!.onclick = () => this.openReplay(true);
    // the highlight clip runs once by itself after a normal offline race
    if (!this.highlightsShown && this.role === "offline" && !this.options.autopilot && !this.solo && !this.cupCeremony) {
      this.highlightsShown = true;
      window.setTimeout(() => {
        if (!this.disposed && this.phase === "results") this.openReplay(true);
      }, 1500);
    }
  }

  /** Tabelle neu zeichnen; wer noch fährt, steht unter Vorbehalt, nach Ablauf der Frist mit DNF. */
  private renderRows(): void {
    const body = this.results.querySelector("tbody");
    if (!body) return;
    const ranked = this.ranking();
    const fastest = Math.min(...this.racers.map((r) => this.status(r).bestLap ?? Infinity));
    body.innerHTML = ranked
      .map((r, i) => {
        const s = this.status(r);
        const isFastest = s.bestLap !== null && s.bestLap === fastest;
        const pts = pointsForPlace(i + 1, isFastest) + (r === this.player && this.rivalBeaten ? RIVAL_BONUS_POINTS : 0);
        const rivalTag = r === this.rivalRacer ? ' <span class="rival-badge">RIVALE</span>' : "";
        const time = s.finishTime !== null ? formatTime(s.finishTime) : this.resultsFinal ? "DNF" : "fährt …";
        return `<tr class="${r === this.player ? "me" : ""}">
          <td>${i + 1}</td>
          <td><span class="dot" style="background:#${r.color.toString(16).padStart(6, "0")}"></span>${escapeHtml(r.name)}${r.id === APEX_AI_ID ? ' <span class="ai-badge" title="Neural network driver">KI</span>' : ""}${rivalTag}</td>
          <td>${time}</td>
          <td>${formatTime(s.bestLap)}${isFastest ? " ⚡" : ""}</td>
          <td>${pts}</td>
        </tr>`;
      })
      .join("");
    const rivalNote = this.results.querySelector(".rival-result");
    const rival = this.rivalRacer;
    if (rivalNote && this.resultsFinal && rival)
      rivalNote.innerHTML = this.rivalBeaten
        ? `Rivale ${escapeHtml(rival.name)} besiegt! <b>+${RIVAL_BONUS_POINTS} Punkt · +${RIVAL_BONUS_XP} XP</b>`
        : `Dein Rivale ${escapeHtml(rival.name)} war schneller – Revanche?`;
    const awards = this.results.querySelector(".awards");
    if (awards) {
      awards.innerHTML = this.resultsFinal
        ? this.awards()
            .map((a) => `<div class="award"><span class="t">${a.title}</span><b>${escapeHtml(a.name)}</b><span class="d">${a.detail}</span></div>`)
            .join("")
        : "";
    }
    const rewardEl = this.results.querySelector(".reward");
    if (rewardEl && this.rewardSummary) {
      const r = this.rewardSummary;
      rewardEl.innerHTML = `<span>+${r.reward.xp} XP</span><span>+${r.reward.credits} Credits</span>${r.levelUp ? `<span class="hl">LEVEL ${r.level}!</span>` : ""}${r.unlocked.map((n) => `<span class="hl">Neu: ${escapeHtml(n)}</span>`).join("")}`;
    }
    const standings = this.results.querySelector(".standings");
    const cup = this.options.cup;
    if (standings && cup && this.cupRecorded) {
      standings.innerHTML = `<h3>GESAMTWERTUNG nach ${cup.standings.races}/${cup.total}</h3><ol>${cup.standings
        .table()
        .slice(0, 10)
        .map((r) => `<li class="${r.id === this.player.id ? "me" : ""}"><span class="dot" style="background:#${r.color.toString(16).padStart(6, "0")}"></span>${escapeHtml(r.name)}<b>${r.points}</b></li>`)
        .join("")}</ol>`;
    }
  }

  /** Nach dem letzten Grand-Prix-Rennen: Siegertreppe nach Gesamtwertung. */
  private startCupCeremony(): void {
    const cup = this.options.cup;
    if (!cup) return;
    this.cupCeremony = true;
    const top = cup.standings
      .table()
      .slice(0, 3)
      .map((row) => this.racers.find((r) => r.id === row.id))
      .filter((r): r is Racer => Boolean(r));
    this.startPodium(top, `GRAND-PRIX-SIEGER: ${top[0]?.name.toUpperCase() ?? ""}`);
  }

  private syncAll(): void {
    for (const r of this.racers) r.car.sync();
  }

  private hudInfo() {
    const s = this.status(this.player);
    const lapTime =
      this.role === "client"
        ? this.raceTime - this.lapStartLocal
        : this.player.tracker.currentLapTime(this.raceTime);
    return {
      place: this.playerPlace,
      total: this.racers.length,
      lap: s.lap,
      laps: this.options.laps,
      lapTime: this.racing && s.finishTime === null ? lapTime : 0,
      best: this.solo?.bestLapTime ?? s.bestLap,
      wrongWay: this.player.wrongWayTime > 1,
    };
  }

  private hudRacers() {
    return this.racers.map((r) => ({ name: r.name, color: r.color, pos: r.car.mesh.position, isPlayer: r === this.player, isAi: r.id === APEX_AI_ID }));
  }

  // ---------- Netzwerk ----------

  private remoteRenderTime(): number {
    if (this.role === "client") return this.hostClockOffset === null ? 0 : this.clock + this.hostClockOffset - INTERPOLATION_DELAY;
    return this.clock - INTERPOLATION_DELAY;
  }

  /** Host: Zustand eines Client-Autos übernehmen (mit Plausibilitätsprüfung). */
  applyRemoteCar(id: string, state: CarState): void {
    const r = this.racers.find((x) => x.id === id);
    if (!r || !r.buffer || r.onPodium) return;
    if (Math.abs(state.v) > r.car.stats.topSpeed * 1.6) return;
    r.buffer.push({ time: this.clock, p: state.p, q: state.q });
    r.car.speed = state.v;
    r.car.drifting = state.d === 1;
    r.car.nitroActive = state.n === 1;
  }

  /** Host: Verbindung eines menschlichen Spielers verloren oder wieder da. Solange er weg ist, fährt ein Bot. */
  setHumanConnected(id: string, connected: boolean): void {
    const r = this.racers.find((x) => x.id === id);
    if (!r || !r.human || r === this.player || r.connected === connected) return;
    r.connected = connected;
    if (!connected) {
      r.buffer = null;
      r.car.setRemote(false);
      r.bot = new BotDriver(r.car, this.track, this.options.skill, Math.random);
    } else {
      r.bot = null;
      r.buffer = new SnapshotBuffer();
      r.car.setRemote(true);
    }
  }

  /** Host: Snapshot für alle Clients. */
  buildSnapshot(): Extract<HostMessage, { t: "snap" }> {
    return {
      t: "snap",
      time: this.clock,
      phase: this.phase,
      phaseTime: this.phaseTime,
      raceTime: this.raceTime,
      final: this.resultsFinal,
      cars: this.racers.map((r) => r.car.snapshot(r.id)),
      racers: this.racers.map((r) => this.status(r)),
      chaos: this.chaos?.netState(),
      rivals: this.peerRivalIds(),
    };
  }

  /** Client: Snapshot vom Host anwenden. */
  /** Host: current rival of every other human (only those that have one). */
  private peerRivalIds(): Record<string, string> | undefined {
    const books = this.options.peerRivals;
    if (!books) return undefined;
    const out: Record<string, string> = {};
    for (const [id, b] of books) {
      const rival = b.rival();
      if (rival && this.racers.some((r) => r.id === id)) out[id] = rival;
    }
    return out;
  }

  applySnapshot(snap: Extract<HostMessage, { t: "snap" }>): void {
    const rivalId = this.spectating ? null : (snap.rivals?.[this.player.id] ?? null);
    if (rivalId !== this.netRival) {
      const isNew = this.netRival !== null || this.phase === "racing";
      this.netRival = rivalId;
      const rival = this.rivalRacer;
      this.carFx.setRival(rival?.car.mesh ?? null);
      if (rival && isNew) this.raceHud.showBanner(`NEUER RIVALE: ${rival.name.toUpperCase()}`, 2.5);
    }
    const offset = snap.time - this.clock;
    this.hostClockOffset = this.hostClockOffset === null ? offset : Math.max(offset, this.hostClockOffset - 0.002);
    for (const c of snap.cars) {
      const r = this.racers.find((x) => x.id === c.id);
      if (!r) continue;
      if (r === this.player && !this.spectating) {
        // Wiedereinstieg: eigenes Auto dort einsetzen, wo der Ersatz-Bot es hingefahren hat.
        const p = r.car.body.translation();
        if (this.phaseTime < 0.5 && Math.hypot(p.x - c.p[0], p.z - c.p[2]) > 8) r.car.teleport(c.p, c.q);
        continue;
      }
      if (r.onPodium) continue;
      r.buffer?.push({ time: snap.time, p: c.p, q: c.q });
      r.car.speed = c.v;
      r.car.drifting = c.d === 1;
      r.car.nitroActive = c.n === 1;
    }
    for (const s of snap.racers) {
      const r = this.racers.find((x) => x.id === s.id);
      if (r) r.netStatus = s;
    }
    this.chaos?.applyNet(snap.chaos);
    this.raceTime = snap.raceTime;
    const phase = snap.phase as Phase;
    if (phase !== this.phase) {
      if (phase === "countdown") this.startCountdown();
      else if (phase === "results") this.showResults();
      else this.phase = phase;
      this.phaseTime = snap.phaseTime;
    } else if (phase === "countdown" || phase === "intro") {
      this.phaseTime = snap.phaseTime;
    }
    if (phase === "results") {
      const wasFinal = this.resultsFinal;
      this.resultsFinal = snap.final;
      if (this.resultsFinal && !wasFinal) this.onResultsFinal();
      this.renderRows();
    }
  }

  /** Client: eigenes Auto für den Host. */
  localCarState(): CarState {
    return this.player.car.snapshot(this.player.id);
  }

  private disposed = false;

  dispose(): void {
    this.disposed = true;
    this.chaos?.dispose();
    this.solo?.dispose();
    this.replayView?.dispose();
    window.removeEventListener("keydown", this.skipIntro);
    window.removeEventListener("keydown", this.onFxKey);
    window.removeEventListener("keydown", this.onSpectatorKey);
    this.spectatorTag?.remove();
    this.carFx.dispose();
    this.podium?.dispose();
    this.ui.querySelector(".emote-bar")?.remove();
    this.hud.dispose();
    this.raceHud.dispose();
    this.results.remove();
    this.world.free();
  }
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
