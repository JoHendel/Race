import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CupStandings, DEFAULT_LAPS, NEON_HARBOR, TRACKS, clampLaps, type TrackDef } from "@apex/shared";
import { LocalSignaling, PeerSignaling, parseRoomCode, type SignalingProvider } from "@apex/net";
import { TitleScene } from "./titleScene";
import { DriveScene } from "./game/driveScene";
import { RaceScene } from "./game/raceScene";
import { ClientSession, HostSession } from "./online/session";
import { LobbyView, showNotice } from "./online/lobby";
import { Garage } from "./garage/garage";
import { currentCar, loadSave, storeSave } from "./save";
import { applyReward, levelFromXp, type RaceReward } from "@apex/shared";
import type { RewardSummary } from "./game/raceScene";

interface ActiveScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize(w: number, h: number): void;
  update(dt: number): void;
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
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.65, 0.5, 0.55));
composer.addPass(new OutputPass());

function setScene(next: ActiveScene): void {
  active = next;
  renderPass.scene = next.scene;
  renderPass.camera = next.camera;
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

/** Grand Prix: 4 Rennen eines Cups. Solange der Cup weniger Strecken hat, wiederholen sie sich. */
function cupTracks(): TrackDef[] {
  const neon = TRACKS.filter((t) => t.cup === "neon");
  return Array.from({ length: 4 }, (_, i) => neon[i % neon.length]!);
}

let cup: { round: number; total: number; standings: CupStandings; tracks: TrackDef[] } | null = null;

function startGrandPrix(): void {
  const tracks = cupTracks();
  cup = { round: 1, total: tracks.length, standings: new CupStandings(tracks.length), tracks };
  void startOfflineRace();
}

async function startOfflineRace(): Promise<void> {
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
      track: cup ? cup.tracks[cup.round - 1]! : NEON_HARBOR,
      laps: clampLaps(Number(params.get("laps") ?? DEFAULT_LAPS)),
      bots: Math.min(9, Math.max(0, Number(params.get("bots") ?? 9))),
      skill: "normal",
      playerName: "Du",
      autopilot: params.has("autopilot"),
    },
    {
      onRestart: () => void startOfflineRace(),
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
  document.querySelector<HTMLButtonElement>("#start")!.onclick = () => void startDrive();
  document.querySelector<HTMLButtonElement>("#race")!.onclick = () => {
    cup = null;
    void startOfflineRace();
  };
  document.querySelector<HTMLButtonElement>("#cup")!.onclick = () => startGrandPrix();
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
    onStart: (start) => void beginOnlineRace(start.settings.trackId, start.settings.laps, start.grid, start.seed),
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
      if (!(s instanceof HostSession) || !s.canStart) return;
      const start = s.start();
      void beginOnlineRace(start.settings.trackId, start.settings.laps, start.grid, start.seed);
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
  grid: { id: string; name: string; color: number; human: boolean }[],
  seed: number,
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
  if (e.code === "Escape" && current && !session) showMenu();
});

const roomParam = params.get("room");
if (roomParam) showOnlineMenu(roomParam);

const clock = new THREE.Clock();
function frame(): void {
  active.update(clock.getDelta());
  composer.render();
  requestAnimationFrame(frame);
}
frame();
