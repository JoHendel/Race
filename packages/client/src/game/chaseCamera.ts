import * as THREE from "three";
import type { Car } from "./car";

/** Verfolgerkamera mit Federung. Das Sichtfeld wächst mit dem Tempo und beim Boost. */
export class ChaseCamera {
  private readonly pos = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private shake = 0;
  private initialized = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  kick(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  update(car: Car, dt: number): void {
    const carPos = car.mesh.position;
    const fwd = car.forward(this.tmp).setY(0).normalize();
    const speed = Math.abs(car.speed);
    const distance = 7 + speed * 0.05;
    const desired = carPos.clone().addScaledVector(fwd, -distance).add(new THREE.Vector3(0, 2.6 + speed * 0.015, 0));
    const lookTarget = carPos.clone().addScaledVector(fwd, 4).add(new THREE.Vector3(0, 1, 0));

    if (!this.initialized) {
      this.pos.copy(desired);
      this.look.copy(lookTarget);
      this.initialized = true;
    }
    this.pos.lerp(desired, 1 - Math.exp(-6 * dt));
    this.look.lerp(lookTarget, 1 - Math.exp(-10 * dt));

    this.shake *= Math.exp(-5 * dt);
    const s = this.shake;
    this.camera.position.copy(this.pos).add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, 0));
    this.camera.lookAt(this.look);

    const boosting = car.boostTime > 0 || car.nitroActive;
    const targetFov = 62 + Math.min(speed, 60) * 0.25 + (boosting ? 10 : 0);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-4 * dt));
    this.camera.updateProjectionMatrix();
  }
}
