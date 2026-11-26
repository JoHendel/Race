import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { DEFAULT_POST_FX, GradeShader, type PostFx } from "./game/postFx";
import { CupStandings, DEFAULT_LAPS, RivalBook, NEON_HARBOR, TRACKS, WEATHER_CHOICES, WEATHER_NAMES, clampLaps, isWeatherChoice, resolveWeather, type TrackDef, type WeatherChoice } from "@apex/shared";
import { LocalSignaling, PeerSignaling, parseRoomCode, type SignalingProvider } from "@apex/net";
import { TitleScene } from "./titleScene";
import { DriveScene } from "./game/driveScene";
import { RaceScene } from "./game/raceScene";
import { runFrameHooks } from "./game/frameHooks";
import { ClientSession, HostSession } from "./online/session";
import { LobbyView, showNotice } from "./online/lobby";
import { VoteView } from "./online/vote";
import { VOTE_RESULT_SECONDS } from "./online/session";
import { currentLang, initI18n, setLang } from "./i18n";
import { Garage } from "./garage/garage";
import { currentCar, loadSave, storeSave } from "./save";
import { applyReward, levelFromXp, type RaceReward } from "@apex/shared";
import type { RaceMode, RewardSummary } from "./game/raceScene";

interface ActiveScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize(w: number, h: number): void;
  update(dt: number): void;
  /** Optional look of this scene (bloom, colour grade). */
  postFx?: PostFx;
}

const params = new URLSearchParams(window.location.search);
const signaling: SignalingProvider = params.get("net") === "local" ? new LocalSignaling() : new PeerSignaling();

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const ui = document.querySelector<HTMLElement>("#ui");
if (!canvas || !ui) throw new Error("UI-Elemente fehlen");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

let active: ActiveScene = new TitleScene();
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(active.scene, active.camera);
composer.addPass(renderPass);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), DEFAULT_POST_FX.bloom, 0.5, DEFAULT_POST_FX.threshold);
composer.addPass(bloomPass);
const gradePass = new ShaderPass(GradeShader);
composer.addPass(gradePass);
composer.addPass(new OutputPass());

function applyPostFx(fx: PostFx = DEFAULT_POST_FX): void {
  bloomPass.strength = fx.bloom;
  bloomPass.threshold = fx.threshold;
  gradePass.uniforms.saturation!.value = fx.saturation;
  gradePass.uniforms.contrast!.value = fx.contrast;
  (gradePass.uniforms.tint!.value as THREE.Color).setHex(fx.tint);
  gradePass.uniforms.vignette!.value = fx.vignette;
}

function setScene(next: ActiveScene): void {
  active = next;
  renderPass.scene = next.scene;
  renderPass.camera = next.camera;
  applyPostFx(next.postFx);
  resize();
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  active.resize(w, h);
}
window.addEventListener("resize", resize);
resize();

// ---------- Spielerdaten ----------

function storedName(): string {
  try {
    const n = localStorage.getItem("apex-name");
    if (n) return n;
  } catch {
    /* Speicher nicht verfügbar */
  }
  const name = `Fahrer-${Math.floor(1000 + Math.random() * 9000)}`;
  saveName(name);
  return name;
}

function saveName(name: string): void {
  try {
    localStorage.setItem("apex-name", name);
  } catch {
    /* egal */
  }
}

/** Pro Tab eindeutig, bleibt beim Neuladen erhalten – so klappt der Wiedereinstieg. */
function clientId(): string {
  try {
    let id = sessionStorage.getItem("apex-client-id");
    if (!id) {
      id = `p-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem("apex-client-id", id);
    }
    return id;
  } catch {
    return `p-${Math.random().toString(36).slice(2, 10)}`;
  }
}

// ---------- Ablauf ----------

const titleHtml = document.querySelector<HTMLElement>("#title")!.outerHTML;
initI18n(params.get("lang"));
let current: { dispose(): void } | null = null;
let session: HostSession | ClientSession | null = null;
let lobby: LobbyView | null = null;
let busy = false;

function expose(value: Record<string, unknown>): void {
  (window as unknown as { apex: unknown }).apex = value;
}

function clearScreen(): void {
  current?.dispose();
  current = null;
  lobby?.dispose();
  lobby = null;
  document.querySelector("#title")?.remove();
  document.querySelectorAll("#ui > .panel").forEach((el) => el.remove());
}

function leaveSession(): void {
  session?.close();
  session = null;
}

async function startDrive(): Promise<void> {
  if (busy) return;
  busy = true;
  await RAPIER.init();
  clearScreen();
  const drive = new DriveScene(ui!, renderer);
  current = drive;
  setScene(drive);
  expose({ drive });
  busy = false;
}

/** Grand Prix: the 4 races of the cup the selected track belongs to (Neon Cup or Turbo Cup). */
function cupTracks(): TrackDef[] {
  const tracks = TRACKS.filter((t) => t.cup === selectedTrack.cup);
  return Array.from({ length: 4 }, (_, i) => tracks[i % tracks.length]!);
}

const TRACK_KEY = "apexrush.track";
function readTrackChoice(): TrackDef {
  let id = params.get("track");
  if (!id) {
    try {
      id = localStorage.getItem(TRACK_KEY);
    } catch {
      id = null;
    }
  }
  return TRACKS.find((t) => t.id === id) ?? NEON_HARBOR;
}
let selectedTrack = readTrackChoice();

const WEATHER_KEY = "apexrush.weather";
function readWeatherChoice(): WeatherChoice {
  let v: string | null = params.get("weather");
  if (!v) {
    try {
      v = localStorage.getItem(WEATHER_KEY);
    } catch {
      v = null;
    }
  }
  return isWeatherChoice(v) ? v : "clear";
}
let selectedWeather: WeatherChoice = readWeatherChoice();

const CHAOS_KEY = "apexrush.chaos";
function readChaos(): boolean {
  if (params.has("chaos")) return params.get("chaos") !== "0";
  try {
    return localStorage.getItem(CHAOS_KEY) === "1";
  } catch {
    return false;
  }
}
let chaosMode = readChaos();

function bindChaosToggle(): void {
  const box = document.querySelector<HTMLInputElement>("[data-testid=chaos-toggle]");
  if (!box) return;
  box.checked = chaosMode;
  box.onchange = () => {
    chaosMode = box.checked;
    try {
      localStorage.setItem(CHAOS_KEY, chaosMode ? "1" : "0");
    } catch {
      // not remembered without storage
    }
  };
}

function bindWeatherPicker(): void {
  const root = document.querySelector<HTMLElement>("[data-testid=weather-pick]");
  if (!root) return;
  const render = () => {
    root.innerHTML = `<small>Wetter</small>${WEATHER_CHOICES.map((w) => `<button type="button" class="chip ${w === selectedWeather ? "on" : ""}" data-weather="${w}" data-testid="weather-${w}">${WEATHER_NAMES[w]}</button>`).join("")}`;
    root.querySelectorAll<HTMLButtonElement>("[data-weather]").forEach((b) => {
      b.onclick = () => {
        selectedWeather = b.dataset.weather as WeatherChoice;
        try {
          localStorage.setItem(WEATHER_KEY, selectedWeather);
        } catch {
          // not remembered without storage
        }
        render();
      };
    });
  };
  render();
}

function bindTrackPicker(): void {
  const root = document.querySelector<HTMLElement>("[data-testid=track-pick]");
  if (!root) return;
  const show = () => {
    root.querySelector("[data-field=track-name]")!.textContent = selectedTrack.name;
    root.querySelector("[data-field=track-cup]")!.textContent = selectedTrack.cup === "neon" ? "Neon Cup" : "Turbo Cup";
    root.querySelector("[data-field=track-blurb]")!.textContent = selectedTrack.blurb ?? "";
  };
  root.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach((b) => {
    b.onclick = () => {
      const i = TRACKS.indexOf(selectedTrack);
      selectedTrack = TRACKS[(i + Number(b.dataset.dir) + TRACKS.length) % TRACKS.length]!;
      try {
        localStorage.setItem(TRACK_KEY, selectedTrack.id);
      } catch {
        // not remembered without storage
      }
      show();
    };
  });
  show();
}

/** Rivals are kept over all offline races of this visit. */
const offlineRivals = new RivalBook();
let cup: { round: number; total: number; standings: CupStandings; tracks: TrackDef[] } | null = null;

function startGrandPrix(): void {
  const tracks = cupTracks();
  cup = { round: 1, total: tracks.length, standings: new CupStandings(tracks.length), tracks };
  void startOfflineRace();
}

async function startOfflineRace(mode: RaceMode = "race"): Promise<void> {
  if (busy) return;
  busy = true;
  await RAPIER.init();
  clearScreen();
  const race = new RaceScene(
    ui!,
    renderer,
    {
      cup: cup ?? undefined,
      playerCar: currentCar(),
      track: cup ? cup.tracks[cup.round - 1]! : selectedTrack,
      weather: resolveWeather(selectedWeather, Math.random),
      chaos: mode === "race" && chaosMode,
      mode,
      rivals: offlineRivals,
      laps: clampLaps(Number(params.get("laps") ?? (mode === "timetrial" ? 5 : DEFAULT_LAPS))),
      bots: Math.min(9, Math.max(0, Number(params.get("bots") ?? 9))),
      skill: "normal",
      playerName: "Du",
      autopilot: params.has("autopilot"),
    },
    {
      onRestart: () => void startOfflineRace(mode),
      onMenu: showMenu,
      onReward: (reward, info) => grantReward(reward, info),
      onNext: () => {
        if (!cup) return;
        cup.round++;
        void startOfflineRace();
      },
    },
  );
  current = race;
  setScene(race);
  expose({ race });
  busy = false;
}

function grantReward(reward: RaceReward, info: { cupWin: boolean }): RewardSummary {
  let save = loadSave();
  if (info.cupWin) save = { ...save, cupWins: save.cupWins + 1 };
  const result = applyReward(save, reward);
  storeSave(result.save);
  return { reward, levelUp: result.levelUp, level: levelFromXp(result.save.xp), unlocked: result.unlocked };
}

function startGarage(): void {
  clearScreen();
  const garage = new Garage(ui!, renderer, showMenu);
  current = garage;
  setScene(garage);
  expose({ garage });
}

function showMenu(): void {
  cup = null;
  leaveSession();
  clearScreen();
  ui!.insertAdjacentHTML("afterbegin", titleHtml);
  bindMenu();
  setScene(new TitleScene());
  expose({});
}

function bindMenu(): void {
  bindTrackPicker();
  bindWeatherPicker();
  bindChaosToggle();
  const langBtn = document.querySelector<HTMLButtonElement>("#lang")!;
  // The button shows the language you switch TO.
  const label = () => (langBtn.textContent = currentLang() === "de" ? "EN" : "DE");
  label();
  langBtn.onclick = () => {
    setLang(currentLang() === "de" ? "en" : "de");
    label();
  };
  document.querySelector<HTMLButtonElement>("#start")!.onclick = () => void startDrive();
  document.querySelector<HTMLButtonElement>("#race")!.onclick = () => {
    cup = null;
    void startOfflineRace();
  };
  document.querySelector<HTMLButtonElement>("#cup")!.onclick = () => startGrandPrix();
  document.querySelector<HTMLButtonElement>("#timetrial")!.onclick = () => {
    cup = null;
    void startOfflineRace("timetrial");
  };
  document.querySelector<HTMLButtonElement>("#drift")!.onclick = () => {
    cup = null;
    void startOfflineRace("drift");
  };
  document.querySelector<HTMLButtonElement>("#garage")!.onclick = () => startGarage();
  document.querySelector<HTMLButtonElement>("#online")!.onclick = () => showOnlineMenu();
}

function showOnlineMenu(prefill = ""): void {
  clearScreen();
  const el = document.createElement("div");
  el.className = "panel";
  el.innerHTML = `
    <div class="panel-card">
      <h2>ONLINE SPIELEN</h2>
      <p class="hint">Erstelle einen Raum und teile den Code oder Link – bis zu 10 Spieler, kein Konto nötig.</p>
      <div class="actions left"><button class="btn" data-action="host" data-testid="host">Raum erstellen</button></div>
      <div class="join">
        <input data-field="code" placeholder="RAUMCODE" maxlength="5" data-testid="code-input" />
        <button class="btn btn-ghost" data-action="join" data-testid="join">Beitreten</button>
      </div>
      <p class="error" data-field="error"></p>
      <div class="actions"><button class="btn btn-ghost small" data-action="back">Zurück</button></div>
    </div>`;
  ui!.appendChild(el);
  const error = el.querySelector<HTMLElement>("[data-field=error]")!;
  const codeInput = el.querySelector<HTMLInputElement>("[data-field=code]")!;
  codeInput.value = prefill;
  el.querySelector<HTMLButtonElement>("[data-action=back]")!.onclick = showMenu;
  el.querySelector<HTMLButtonElement>("[data-action=host]")!.onclick = () => void hostGame(error);
  el.querySelector<HTMLButtonElement>("[data-action=join]")!.onclick = () => {
    const code = parseRoomCode(codeInput.value);
    if (!code) {
      error.textContent = "Der Raumcode hat 5 Zeichen, z. B. K7QXM.";
      return;
    }
    void joinGame(code, error);
  };
  if (prefill) {
    const code = parseRoomCode(prefill);
    if (code) void joinGame(code, error);
  }
}

async function hostGame(error: HTMLElement): Promise<void> {
  if (busy) return;
  busy = true;
  error.textContent = "Raum wird erstellt …";
  const host = new HostSession(signaling, clientId(), storedName(), {
    onLobby: (players, settings) => lobby?.update(players, settings, host.canStart),
    onVote: showVote,
    onVoteResult: showVoteResult,
    onVoteDone: () => startHostRace(host),
    onStart: () => undefined,
    onToLobby: () => undefined,
    onClosed: (reason) => showNotice(ui!, reason, showMenu),
  });
  try {
    await host.open();
  } catch (e) {
    error.textContent = `Raum konnte nicht erstellt werden: ${(e as Error).message}`;
    busy = false;
    return;
  }
  session = host;
  busy = false;
  showLobby();
}

async function joinGame(code: string, error: HTMLElement): Promise<void> {
  if (busy) return;
  busy = true;
  error.textContent = "Verbinde …";
  const client: ClientSession = new ClientSession(signaling, code, clientId(), storedName(), {
    onLobby: (players, settings) => {
      if (!lobby && !current) showLobby();
      lobby?.update(players, settings, false);
    },
    onVote: showVote,
    onVoteResult: showVoteResult,
    onStart: (start) => {
      closeVote();
      void beginOnlineRace(start.settings.trackId, start.settings.laps, start.grid, start.seed, start.settings.weather, start.settings.chaos);
    },
    onToLobby: () => showLobby(),
    onClosed: (reason) => {
      leaveSession();
      clearScreen();
      showNotice(ui!, reason, showMenu);
    },
  });
  session = client;
  try {
    await client.open();
  } catch (e) {
    session = null;
    error.textContent = `Beitreten fehlgeschlagen: ${(e as Error).message}`;
    busy = false;
    return;
  }
  busy = false;
}

let vote: VoteView | null = null;

function showVote(candidates: string[], votes: Record<string, string>, seconds: number): void {
  const s = session;
  if (!s) return;
  if (!vote) {
    vote = new VoteView(ui!, s.clientId, (trackId) => (s instanceof HostSession ? s.castVote(s.clientId, trackId) : s.vote(trackId)));
    expose({ session: s, vote });
  }
  vote.update(candidates, votes, seconds);
}

function showVoteResult(winner: string, tie: string[]): void {
  vote?.showResult(winner, tie, tie.length > 1 ? VOTE_RESULT_SECONDS.wheel : VOTE_RESULT_SECONDS.plain);
}

function closeVote(): void {
  vote?.dispose();
  vote = null;
}

/** Host: start the online race with the current settings. */
function startHostRace(s: HostSession): void {
  closeVote();
  const start = s.start();
  void beginOnlineRace(start.settings.trackId, start.settings.laps, start.grid, start.seed, start.settings.weather, start.settings.chaos);
}

function showLobby(): void {
  const s = session;
  if (!s) return;
  clearScreen();
  setScene(new TitleScene());
  const isHost = s instanceof HostSession;
  lobby = new LobbyView(ui!, {
    isHost,
    code: s.code,
    clientId: s.clientId,
    name: storedName(),
    onName: (name) => {
      saveName(name);
      s.setName(name);
    },
    onReady: (ready) => (s instanceof ClientSession ? s.setReady(ready) : undefined),
    onSettings: (patch) => (s instanceof HostSession ? s.updateSettings(patch) : undefined),
    onStart: () => {
      if (!(s instanceof HostSession) || !s.canStart || s.voting) return;
      if (s.settings.vote) s.startVote();
      else startHostRace(s);
    },
    onLeave: showMenu,
  });
  if (s instanceof HostSession) lobby.update(s.players, s.settings, s.canStart);
  else if (s.settings) lobby.update(s.players, s.settings, false);
  expose({ session: s });
}

async function beginOnlineRace(
  trackId: string,
  laps: number,
  grid: { id: string; name: string; color: number; human: boolean; ai?: boolean }[],
  seed: number,
  weather?: WeatherChoice,
  chaos?: boolean,
): Promise<void> {
  const s = session;
  if (!s) return;
  await RAPIER.init();
  clearScreen();
  const isHost = s instanceof HostSession;
  const race = new RaceScene(
    ui!,
    renderer,
    {
      track: TRACKS.find((t) => t.id === trackId) ?? NEON_HARBOR,
      laps,
      bots: 0,
      skill: "normal",
      playerName: storedName(),
      role: isHost ? "host" : "client",
      localId: s.clientId,
      grid,
      seed,
      // the host resolves "random" before the start, so this is the same for everyone
      weather: resolveWeather(weather, Math.random),
      chaos: Boolean(chaos),
      rivals: s instanceof HostSession ? s.rivals : undefined,
      autopilot: params.has("autopilot"),
    },
    {
      onRestart: () => {
        if (s instanceof HostSession) {
          s.backToLobby();
          showLobby();
        }
      },
      onMenu: showMenu,
      onReward: (reward, info) => grantReward(reward, info),
      onUseItem: () => (s instanceof ClientSession ? s.useItem() : undefined),
      onFx: (id, kind, value) => (s instanceof ClientSession ? s.fx(kind, value) : s.sendFx(id, kind, value)),
    },
  );
  s.race = race;
  current = { dispose: () => race.dispose() };
  setScene(race);
  expose({ race, session: s });
}

// ---------- Start ----------

bindMenu();
window.addEventListener("keydown", (e) => {
  if (e.code === "Enter" && document.querySelector("#title")) {
    cup = null;
    void startOfflineRace();
  }
  if (e.code === "Escape" && current && !session && !document.querySelector(".replay")) showMenu();
});

const roomParam = params.get("room");
if (roomParam) showOnlineMenu(roomParam);

const clock = new THREE.Timer();
function frame(): void {
  clock.update();
  active.update(clock.getDelta());
  composer.render();
  runFrameHooks();
  requestAnimationFrame(frame);
}
frame();
// Hide the loading screen once the first frame is on screen.
requestAnimationFrame(() => {
  const boot = document.getElementById("boot");
  if (!boot) return;
  boot.classList.add("done");
  window.setTimeout(() => boot.remove(), 600);
});
