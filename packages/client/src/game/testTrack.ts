import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { theme } from "@apex/shared";

interface Prop {
  mesh: THREE.Object3D;
  body: RAPIER.RigidBody;
}

/** Testgelände für M1: große Fläche, Pylonen-Slalom, Rampe und Begrenzungsmauern. */
export class TestTrack {
  readonly group = new THREE.Group();
  private readonly props: Prop[] = [];
  readonly spawn = new THREE.Vector3(0, 0.5, -60);

  constructor(private readonly world: RAPIER.World) {
    this.buildGround();
    this.buildWalls();
    this.buildCones();
    this.buildRamp(new THREE.Vector3(0, 0, -15), 0);
    this.buildRamp(new THREE.Vector3(-60, 0, 0), Math.PI / 2);
    this.buildPillars();
  }

  private addStatic(desc: RAPIER.ColliderDesc, mesh?: THREE.Object3D): void {
    this.world.createCollider(desc.setFriction(1));
    if (mesh) this.group.add(mesh);
  }

  private buildGround(): void {
    const size = 220;
    this.addStatic(RAPIER.ColliderDesc.cuboid(size / 2, 0.5, size / 2).setTranslation(0, -0.5, 0));
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: 0x07081a, roughness: 0.55, metalness: 0.3, envMapIntensity: 0.25 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);
    const grid = new THREE.GridHelper(size, 55, theme.violet, theme.grid);
    grid.position.y = 0.02;
    this.group.add(grid);
  }

  private buildWalls(): void {
    const half = 105;
    const mat = new THREE.MeshStandardMaterial({ color: 0x12142a, roughness: 0.6 });
    const glow = new THREE.MeshBasicMaterial({ color: theme.magenta });
    const walls: [number, number, number, number][] = [
      [0, half, half, 0.5],
      [0, -half, half, 0.5],
      [half, 0, 0.5, half],
      [-half, 0, 0.5, half],
    ];
    for (const [x, z, hx, hz] of walls) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, 1.2, hz * 2), mat);
      mesh.position.set(x, 0.6, z);
      const line = new THREE.Mesh(new THREE.BoxGeometry(hx * 2 + 0.02, 0.08, hz * 2 + 0.02), glow);
      line.position.y = 0.6;
      mesh.add(line);
      this.addStatic(RAPIER.ColliderDesc.cuboid(hx, 6, hz).setTranslation(x, 5, z), mesh);
    }
  }

  private buildCones(): void {
    const geo = new THREE.ConeGeometry(0.35, 0.9, 12);
    const mat = new THREE.MeshStandardMaterial({ color: theme.orange, emissive: theme.orange, emissiveIntensity: 0.6 });
    for (let i = 0; i < 10; i++) {
      const pos = new THREE.Vector3(-30 + (i % 2 === 0 ? -1 : 1) * 2.5, 0.45, -50 + i * 7);
      this.addCone(pos, geo, mat);
    }
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      this.addCone(new THREE.Vector3(55 + Math.cos(ang) * 14, 0.45, Math.sin(ang) * 14), geo, mat);
    }
  }

  private addCone(pos: THREE.Vector3, geo: THREE.BufferGeometry, mat: THREE.Material): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z));
    this.world.createCollider(RAPIER.ColliderDesc.cone(0.45, 0.35).setDensity(30).setFriction(0.8), body);
    const mesh = new THREE.Mesh(geo, mat);
    this.group.add(mesh);
    this.props.push({ mesh, body });
  }

  private buildRamp(center: THREE.Vector3, yaw: number): void {
    const length = 14;
    const angle = 0.22;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-angle, yaw, 0, "YXZ"));
    const height = Math.sin(angle) * length;
    const pos = center.clone().add(new THREE.Vector3(0, height / 2 - 0.2, 0));
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.4, length),
      new THREE.MeshStandardMaterial({ color: theme.backgroundSoft, emissive: theme.cyan, emissiveIntensity: 0.15 }),
    );
    mesh.position.copy(pos);
    mesh.quaternion.copy(q);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: theme.cyan }),
    );
    mesh.add(edges);
    this.addStatic(
      RAPIER.ColliderDesc.cuboid(4, 0.2, length / 2)
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }),
      mesh,
    );
  }

  private buildPillars(): void {
    const geo = new THREE.BoxGeometry(1, 14, 1);
    const colors = [theme.cyan, theme.magenta, theme.violet];
    for (let i = 0; i < 24; i++) {
      const ang = (i / 24) * Math.PI * 2;
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0b0d1f, emissive: colors[i % 3], emissiveIntensity: 0.8 }));
      mesh.position.set(Math.cos(ang) * 98, 7, Math.sin(ang) * 98);
      this.group.add(mesh);
    }
  }

  sync(): void {
    for (const p of this.props) {
      const t = p.body.translation();
      const r = p.body.rotation();
      p.mesh.position.set(t.x, t.y, t.z);
      p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }
}
