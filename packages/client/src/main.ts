import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { TitleScene } from "./titleScene";
import { DriveScene } from "./game/driveScene";
import { RaceScene } from "./game/raceScene";
import { DEFAULT_LAPS, NEON_HARBOR, clampLaps } from "@apex/shared";

const params = new URLSearchParams(window.location.search);

interface ActiveScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize(w: number, h: number): void;
  update(dt: number): void;
}

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

const titleHtml = document.querySelector<HTMLElement>("#title")!.outerHTML;
let current: { dispose(): void } | null = null;
let busy = false;

function clearCurrent(): void {
  current?.dispose();
  current = null;
  document.querySelector("#title")?.remove();
}

async function startDrive(): Promise<void> {
  if (busy) return;
  busy = true;
  await RAPIER.init();
  clearCurrent();
  const drive = new DriveScene(ui!, renderer);
  current = { dispose: () => drive.dispose() };
  setScene(drive);
  (window as unknown as { apex: unknown }).apex = { drive };
  busy = false;
}

async function startRace(): Promise<void> {
  if (busy) return;
  busy = true;
  await RAPIER.init();
  clearCurrent();
  const race = new RaceScene(
    ui!,
    renderer,
    {
      track: NEON_HARBOR,
      laps: clampLaps(Number(params.get("laps") ?? DEFAULT_LAPS)),
      bots: Math.min(9, Math.max(0, Number(params.get("bots") ?? 9))),
      skill: "normal",
      playerName: "Du",
      autopilot: params.has("autopilot"),
    },
    { onRestart: () => void startRace(), onMenu: showMenu },
  );
  current = race;
  setScene(race);
  (window as unknown as { apex: unknown }).apex = { race };
  busy = false;
}

function showMenu(): void {
  clearCurrent();
  ui!.insertAdjacentHTML("afterbegin", titleHtml);
  bindMenu();
  setScene(new TitleScene());
}

function bindMenu(): void {
  document.querySelector<HTMLButtonElement>("#start")!.onclick = () => void startDrive();
  document.querySelector<HTMLButtonElement>("#race")!.onclick = () => void startRace();
}
bindMenu();

window.addEventListener("keydown", (e) => {
  if (e.code === "Enter" && document.querySelector("#title")) void startRace();
  if (e.code === "Escape" && current) showMenu();
});

const clock = new THREE.Clock();
function frame(): void {
  active.update(clock.getDelta());
  composer.render();
  requestAnimationFrame(frame);
}
frame();
