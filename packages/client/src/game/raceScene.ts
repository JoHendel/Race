import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  FALSE_START_PENALTY,
  FINISH_GRACE_TIME,
  LapTracker,
  PERFECT_START_WINDOW,
  STARTER_CAR,
  formatTime,
  pointsForPlace,
  rankRacers,
  theme,
  type TrackDef,
} from "@apex/shared";
import { Car } from "./car";
import { ChaseCamera } from "./chaseCamera";
import { Hud } from "./hud";
import { Input, type ControlState } from "./input";
import { Sparks } from "./sparks";
import { createSky } from "./sky";
import { BotDriver, type BotSkill } from "./bot";
import { RaceHud } from "./raceHud";
import { SplineTrack, mulberry32 } from "./track/splineTrack";

const STEP = 1 / 60;
const BOT_NAMES = ["Nova", "Blitz", "Kaito", "Vera", "Rook", "Juno", "Dash", "Mika", "Zed"];
const BOT_COLORS = [theme.magenta, theme.orange, theme.violet, 0x39ff88, 0xffe14d, 0xff4d6d, 0x4dd2ff, 0xc0c0ff, 0xff9ef0];
const LEVEL_NAMES = ["", "BOOST", "SUPER BOOST", "ULTRA BOOST"];
const LEVEL_COLORS = ["white", "cyan", "orange", "violet"] as const;

type Phase = "intro" | "countdown" | "racing" | "finishing" | "results";

interface Racer {
  id: string;
  name: string;
  car: Car;
  tracker: LapTracker;
  bot: BotDriver | null;
  index: number;
  color: number;
  wrongWayTime: number;
}

export interface RaceOptions {
  track: TrackDef;
  laps: number;
  bots: number;
  skill: BotSkill;
  playerName: string;
  /** Nur für Tests: Spieler fährt per Bot-Logik. */
  autopilot?: boolean;
}

export interface RaceCallbacks {
  onRestart: () => void;
  onMenu: () => void;
}

/** Ein komplettes Rennen gegen Bots: Intro, Countdown, Runden, Zieleinlauf, Ergebnis. */
export class RaceScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  readonly input = new Input();
  readonly world: RAPIER.World;
  readonly track: SplineTrack;
  readonly racers: Racer[] = [];
  readonly player: Racer;
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
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.25;
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(0x1a0830, 120, 520);
    this.scene.add(createSky());
    this.scene.add(new THREE.HemisphereLight(0x8899ff, 0x220022, 0.55));
    const sun = new THREE.DirectionalLight(0xffd6f0, 0.9);
    sun.position.set(60, 120, 40);
    this.scene.add(sun);

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.track = new SplineTrack(this.world, options.track);
    this.scene.add(this.track.group);

    this.hud = new Hud(ui);
    this.raceHud = new RaceHud(ui, this.track);
    this.results = document.createElement("div");
    this.results.className = "results";
    ui.appendChild(this.results);

    const rnd = mulberry32(42);
    const total = Math.min(10, 1 + options.bots);
    // Spieler startet hinten in der Mitte des Feldes: mehr Überholmanöver, mehr Spaß.
    const playerSlot = Math.min(total - 1, Math.floor(total * 0.6));
    let botIndex = 0;
    for (let slot = 0; slot < total; slot++) {
      const isPlayer = slot === playerSlot;
      const color = isPlayer ? theme.cyan : BOT_COLORS[botIndex % BOT_COLORS.length]!;
      const name = isPlayer ? options.playerName : BOT_NAMES[botIndex % BOT_NAMES.length]!;
      const car = new Car(
        this.world,
        STARTER_CAR,
        isPlayer
          ? {
              onDriftBoost: (level) => {
                this.hud.showToast(LEVEL_NAMES[level]!, LEVEL_COLORS[level]);
                this.chase.kick(0.15 * level);
                this.sparks.emit(car.mesh.position, level, 40 * level, 6);
              },
            }
          : {},
        color,
      );
      const { pos, yaw } = this.track.gridSlot(slot);
      car.setResetPose(pos, yaw);
      car.reset();
      this.scene.add(car.mesh);
      const racer: Racer = {
        id: isPlayer ? "player" : `bot-${botIndex}`,
        name,
        car,
        tracker: new LapTracker(options.laps),
        bot: isPlayer && !options.autopilot ? null : new BotDriver(car, this.track, isPlayer ? "hard" : options.skill, rnd),
        index: this.track.nearestIndex(pos),
        color,
        wrongWayTime: 0,
      };
      this.racers.push(racer);
      if (!isPlayer) botIndex++;
    }
    this.player = this.racers.find((r) => r.id === "player")!;
    for (const r of this.racers) r.tracker.update(r.index / this.track.samples.length, 0);

    this.scene.add(this.sparks.points);
    this.chase = new ChaseCamera(this.camera);
    this.raceHud.showBanner(options.track.name.toUpperCase(), 3);
    window.addEventListener("keydown", this.skipIntro);
  }

  private readonly skipIntro = (e: KeyboardEvent): void => {
    if (this.phase === "intro" && (e.code === "Enter" || e.code === "Space")) this.startCountdown();
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

  get playerPlace(): number {
    return this.ranking().findIndex((r) => r.id === "player") + 1;
  }

  private ranking(): Racer[] {
    return rankRacers(
      this.racers.map((r) => ({ ...r, progress: r.tracker.progress, finishTime: r.tracker.finishTime })),
    ).map((r) => this.racers.find((x) => x.id === r.id)!);
  }

  update(frameDt: number): void {
    const realDt = Math.min(frameDt, 0.1);
    this.phaseTime += realDt;

    if (this.phase === "intro") {
      this.updateIntroCamera();
      if (this.phaseTime > 4) this.startCountdown();
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

    if (this.player.car.drifting) {
      const level = Math.min(3, Math.floor(this.player.car.driftTime / 0.8));
      const back = this.player.car.forward(this.tmp).multiplyScalar(-1.6).add(this.player.car.mesh.position);
      back.y -= 0.4;
      this.sparks.emit(back, level, 3);
    }
    if (this.player.car.nitroActive) {
      const back = this.player.car.forward(this.tmp).multiplyScalar(-2.1).add(this.player.car.mesh.position);
      this.sparks.emit(back, 1, 4, 1.5);
    }
    this.sparks.update(dt);
    this.chase.update(this.player.car, realDt);
    this.hud.update(this.player.car, realDt);
    this.raceHud.update(realDt, this.hudInfo(), this.hudRacers());
  }

  private updateIntroCamera(): void {
    // Kameraflug: von hoch oben über der Strecke hinunter zur Startaufstellung.
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

  private physicsStep(playerControls: ControlState): void {
    const racing = this.phase === "racing" || this.phase === "finishing" || this.phase === "results";
    if (racing) this.raceTime += STEP;

    for (const r of this.racers) {
      let controls: ControlState;
      if (r.tracker.finished) {
        controls = { ...this.idle, brake: r.car.speed > 3 ? 0.4 : 0 };
        if (r.bot) controls = { ...r.bot.drive(STEP), throttle: 0.4, nitro: false };
      } else if (!racing) {
        controls = this.idle;
        // Frühstart erkennen: Gas vor GO.
        if (r === this.player && playerControls.throttle > 0 && this.phaseTime > 1.5) {
          this.falseStart = FALSE_START_PENALTY;
        }
      } else if (r.bot) {
        controls = r.bot.drive(STEP);
        if (r === this.player && !this.startBoostGiven) this.startBoostGiven = true;
      } else {
        controls = playerControls;
        if (!this.startBoostGiven && this.raceTime < PERFECT_START_WINDOW && playerControls.throttle > 0) {
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
          controls = { ...controls, throttle: 0, steer: Math.sin(this.raceTime * 20) * 0.3 };
          if (!this.startBoostGiven) this.startBoostGiven = true;
        }
      }
      r.car.update(controls, STEP);
    }
    this.world.step();

    if (!racing) return;
    const n = this.track.samples.length;
    for (const r of this.racers) {
      r.index = this.track.nearestIndex(r.car.body.translation() as THREE.Vector3, r.index);
      const lapDone = r.tracker.update(r.index / n, this.raceTime);
      // Falsche Richtung
      const tangent = this.track.sample(r.index).tangent;
      const wrong = r.car.forward(this.tmp).dot(tangent) < -0.3 && Math.abs(r.car.speed) > 3;
      r.wrongWayTime = wrong ? r.wrongWayTime + STEP : 0;
      if (r === this.player && lapDone) this.onPlayerLap();
      if (lapDone && r.tracker.finished && this.phase === "racing") {
        this.phase = "finishing";
        if (r === this.player) this.slowMoLeft = 1.6;
      }
      // Reset-Position folgt der Strecke
      if (r === this.player) {
        const s = this.track.sample(r.index - 2);
        r.car.setResetPose(s.pos, Math.atan2(s.tangent.x, s.tangent.z));
      }
    }

    if (this.phase === "results" && !this.resultsFinal) {
      this.graceLeft -= STEP;
      this.refreshTimer -= STEP;
      const allDone = this.racers.every((r) => r.tracker.finished);
      if (allDone || this.graceLeft <= 0) this.resultsFinal = true;
      if (this.refreshTimer <= 0 || this.resultsFinal) {
        this.refreshTimer = 0.5;
        this.renderRows();
      }
    }
    if (this.phase === "finishing") {
      this.graceLeft -= STEP;
      // Spieler im Ziel: kurz feiern, dann Ergebnis. Bots fahren im Hintergrund weiter.
      if (this.player.tracker.finished && this.resultsTimer === 0) this.resultsTimer = 3;
      if (this.graceLeft <= 0) this.showResults();
    }
    if (this.resultsTimer > 0) {
      this.resultsTimer -= STEP;
      if (this.resultsTimer <= 0) this.showResults();
    }
  }

  private resultsTimer = 0;

  private onPlayerLap(): void {
    const t = this.player.tracker;
    if (t.finished) {
      this.raceHud.setCountdown("ZIEL!", "#f4f6ff");
      this.raceHud.showBanner(`PLATZ ${this.playerPlace}`, 3);
    } else if (t.lap === this.options.laps - 1) {
      this.raceHud.showBanner("FINAL LAP", 2.5);
    } else {
      this.raceHud.showBanner(`RUNDE ${t.lap + 1}`, 1.5);
    }
  }

  private resultsFinal = false;
  private refreshTimer = 0;

  private showResults(): void {
    if (this.phase === "results") return;
    this.phase = "results";
    this.results.innerHTML = `
      <div class="results-card" data-testid="results">
        <h2>ERGEBNIS · ${this.options.track.name.toUpperCase()}</h2>
        <table>
          <thead><tr><th>#</th><th>Fahrer</th><th>Zeit</th><th>Beste Runde</th><th>Punkte</th></tr></thead>
          <tbody></tbody>
        </table>
        <div class="results-actions">
          <button class="btn" data-action="restart">Revanche</button>
          <button class="btn btn-ghost" data-action="menu">Zum Menü</button>
        </div>
      </div>`;
    this.renderRows();
    this.results.classList.add("show");
    this.results.querySelector<HTMLButtonElement>("[data-action=restart]")!.onclick = () => this.callbacks.onRestart();
    this.results.querySelector<HTMLButtonElement>("[data-action=menu]")!.onclick = () => this.callbacks.onMenu();
  }

  /** Tabelle neu zeichnen; wer noch fährt, steht unter Vorbehalt, nach Ablauf der Frist mit DNF. */
  private renderRows(): void {
    const body = this.results.querySelector("tbody");
    if (!body) return;
    const ranked = this.ranking();
    const fastest = Math.min(...this.racers.map((r) => r.tracker.bestLap ?? Infinity));
    body.innerHTML = ranked
      .map((r, i) => {
        const best = r.tracker.bestLap;
        const isFastest = best !== null && best === fastest;
        const pts = pointsForPlace(i + 1, isFastest);
        const time = r.tracker.finished ? formatTime(r.tracker.finishTime) : this.resultsFinal ? "DNF" : "fährt …";
        return `<tr class="${r.id === "player" ? "me" : ""}">
          <td>${i + 1}</td>
          <td><span class="dot" style="background:#${r.color.toString(16).padStart(6, "0")}"></span>${r.name}</td>
          <td>${time}</td>
          <td>${formatTime(best)}${isFastest ? " ⚡" : ""}</td>
          <td>${pts}</td>
        </tr>`;
      })
      .join("");
  }

  private syncAll(): void {
    for (const r of this.racers) r.car.sync();
  }

  private hudInfo() {
    const t = this.player.tracker;
    return {
      place: this.playerPlace,
      total: this.racers.length,
      lap: t.lap,
      laps: this.options.laps,
      lapTime: this.phase === "racing" || this.phase === "finishing" ? t.currentLapTime(this.raceTime) : 0,
      best: t.bestLap,
      wrongWay: this.player.wrongWayTime > 1,
    };
  }

  private hudRacers() {
    return this.racers.map((r) => ({ name: r.name, color: r.color, pos: r.car.mesh.position, isPlayer: r === this.player }));
  }

  dispose(): void {
    window.removeEventListener("keydown", this.skipIntro);
    this.hud.dispose();
    this.raceHud.dispose();
    this.results.remove();
    this.world.free();
  }
}
