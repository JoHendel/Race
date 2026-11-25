import * as THREE from "three";
import { theme } from "@apex/shared";

/** Titelbildschirm: Neon-Fahrbahn, die unter der Kamera hindurchrast. */
export class TitleScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
  private readonly stripes: THREE.Mesh[] = [];
  private readonly grid: THREE.GridHelper;
  private time = 0;

  constructor() {
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(theme.background, 20, 120);
    this.camera.position.set(0, 3, 10);
    this.camera.lookAt(0, 2, -50);

    this.grid = new THREE.GridHelper(400, 160, theme.magenta, theme.grid);
    this.scene.add(this.grid);

    const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 400), new THREE.MeshBasicMaterial({ color: theme.backgroundSoft }));
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    this.scene.add(road);

    const edgeMat = new THREE.MeshBasicMaterial({ color: theme.cyan });
    for (const x of [-4, 4]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 400), edgeMat);
      edge.position.set(x, 0.03, 0);
      this.scene.add(edge);
    }

    const stripeMat = new THREE.MeshBasicMaterial({ color: theme.orange });
    for (let i = 0; i < 30; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 3), stripeMat);
      stripe.position.set(0, 0.04, -i * 8);
      this.scene.add(stripe);
      this.stripes.push(stripe);
    }

    const sun = new THREE.Mesh(new THREE.CircleGeometry(18, 64), new THREE.MeshBasicMaterial({ color: theme.magenta, fog: false }));
    sun.position.set(0, 14, -140);
    this.scene.add(sun);
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.time += dt;
    const speed = 40;
    for (const stripe of this.stripes) {
      stripe.position.z += speed * dt;
      if (stripe.position.z > 12) stripe.position.z -= this.stripes.length * 8;
    }
    this.grid.position.z = (this.grid.position.z + speed * dt) % 2.5;
    this.camera.position.x = Math.sin(this.time * 0.4) * 0.6;
  }
}
