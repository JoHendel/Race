import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { TitleScene } from "./titleScene";
import { DriveScene } from "./game/driveScene";

interface ActiveScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize(w: number, h: number): void;
  update(dt: number): void;
}

const canvas = document.querySelector<HTMLCanvasElement>("#scene");
const ui = document.querySelector<HTMLElement>("#ui");
const startButton = document.querySelector<HTMLButtonElement>("#start");
if (!canvas || !ui || !startButton) throw new Error("UI-Elemente fehlen");

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

async function startDrive(): Promise<void> {
  startButton!.disabled = true;
  await RAPIER.init();
  const title = document.querySelector<HTMLElement>("#title");
  title?.remove();
  const drive = new DriveScene(ui!, renderer);
  setScene(drive);
  // Für automatische Tests und Debugging erreichbar
  (window as unknown as { apex: unknown }).apex = { drive };
}

startButton.addEventListener("click", () => void startDrive());
window.addEventListener("keydown", (e) => {
  if (e.code === "Enter" && !startButton.disabled) void startDrive();
});

const clock = new THREE.Clock();
function frame(): void {
  active.update(clock.getDelta());
  composer.render();
  requestAnimationFrame(frame);
}
frame();
