import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { theme } from "@apex/shared";

// Titelbildschirm (M0): Neon-Gitter, das unter der Kamera hindurchrast.
const canvas = document.querySelector<HTMLCanvasElement>("#scene");
if (!canvas) throw new Error("Canvas #scene fehlt");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(theme.background);
scene.fog = new THREE.Fog(theme.background, 20, 120);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
camera.position.set(0, 3, 10);
camera.lookAt(0, 2, -50);

// Bodengitter
const grid = new THREE.GridHelper(400, 160, theme.magenta, theme.grid);
grid.position.y = 0;
scene.add(grid);

// Fahrbahn mit leuchtenden Randlinien
const roadMat = new THREE.MeshBasicMaterial({ color: theme.backgroundSoft });
const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 400), roadMat);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01;
scene.add(road);

const edgeMat = new THREE.MeshBasicMaterial({ color: theme.cyan });
for (const x of [-4, 4]) {
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 400), edgeMat);
  edge.position.set(x, 0.03, 0);
  scene.add(edge);
}

// Mittelstreifen, die auf die Kamera zufliegen
const stripes: THREE.Mesh[] = [];
const stripeMat = new THREE.MeshBasicMaterial({ color: theme.orange });
for (let i = 0; i < 30; i++) {
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 3), stripeMat);
  stripe.position.set(0, 0.04, -i * 8);
  scene.add(stripe);
  stripes.push(stripe);
}

// Neon-Sonne am Horizont
const sun = new THREE.Mesh(
  new THREE.CircleGeometry(18, 64),
  new THREE.MeshBasicMaterial({ color: theme.magenta, fog: false }),
);
sun.position.set(0, 14, -140);
scene.add(sun);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.1, 0.6, 0.1);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const clock = new THREE.Clock();
function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  const speed = 40;
  for (const stripe of stripes) {
    stripe.position.z += speed * dt;
    if (stripe.position.z > 12) stripe.position.z -= stripes.length * 8;
  }
  grid.position.z = (grid.position.z + speed * dt) % 2.5;
  camera.position.x = Math.sin(clock.elapsedTime * 0.4) * 0.6;
  composer.render();
  requestAnimationFrame(frame);
}
frame();
