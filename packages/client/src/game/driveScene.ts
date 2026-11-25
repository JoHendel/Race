import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { STARTER_CAR, theme } from "@apex/shared";
import { Car } from "./car";
import { ChaseCamera } from "./chaseCamera";
import { Hud } from "./hud";
import { Input } from "./input";
import { Sparks } from "./sparks";
import { TestTrack } from "./testTrack";
import { createSky } from "./sky";

const STEP = 1 / 60;
const LEVEL_NAMES = ["", "BOOST", "SUPER BOOST", "ULTRA BOOST"];
const LEVEL_COLORS = ["white", "cyan", "orange", "violet"] as const;

/** Freie Testfahrt (M1): ein Auto auf dem Testgelände. */
export class DriveScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  readonly input = new Input();
  private readonly world: RAPIER.World;
  readonly car: Car;
  private readonly track: TestTrack;
  private readonly chase: ChaseCamera;
  private readonly hud: Hud;
  private readonly sparks = new Sparks();
  private accumulator = 0;
  private readonly tmp = new THREE.Vector3();

  constructor(uiRoot: HTMLElement, renderer: THREE.WebGLRenderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    this.scene.add(createSky());
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(0x1a0830, 80, 320);
    this.scene.add(new THREE.HemisphereLight(0x8899ff, 0x220022, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(30, 60, 20);
    this.scene.add(sun);

    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = STEP;
    this.track = new TestTrack(this.world);
    this.scene.add(this.track.group);

    this.hud = new Hud(uiRoot);
    this.car = new Car(this.world, STARTER_CAR, {
      onDriftBoost: (level) => {
        this.hud.showToast(LEVEL_NAMES[level]!, LEVEL_COLORS[level]);
        this.chase.kick(0.15 * level);
        this.sparks.emit(this.car.mesh.position, level, 40 * level, 6);
      },
    });
    this.car.setResetPose(this.track.spawn, 0);
    this.car.reset();
    this.scene.add(this.car.mesh);
    this.scene.add(this.sparks.points);
    this.chase = new ChaseCamera(this.camera);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(frameDt: number): void {
    const dt = Math.min(frameDt, 0.1);
    const controls = this.input.read(dt);
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < 6) {
      this.car.update(controls, STEP);
      this.world.step();
      this.accumulator -= STEP;
      steps++;
      if (controls.reset) controls.reset = false;
    }
    this.car.sync();
    this.track.sync();

    // Funken an den Hinterrädern beim Driften
    if (this.car.drifting) {
      const level = Math.min(3, Math.floor(this.car.driftTime / 0.8));
      const back = this.car.forward(this.tmp).multiplyScalar(-1.6).add(this.car.mesh.position);
      back.y = this.car.mesh.position.y - 0.4;
      this.sparks.emit(back, level, 3);
    }
    if (this.car.nitroActive) {
      const back = this.car.forward(this.tmp).multiplyScalar(-2.1).add(this.car.mesh.position);
      this.sparks.emit(back, 1, 4, 1.5);
    }
    this.sparks.update(dt);
    this.chase.update(this.car, dt);
    this.hud.update(this.car, dt);
  }
}
