import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  DRIFT_LEVELS,
  DRIFT_MIN_SPEED,
  NitroTank,
  driftLevel,
  steerAngle,
  theme,
  type VehicleStats,
} from "@apex/shared";
import type { ControlState } from "./input";

const WHEELS = [
  // [x, z, vorne?]
  [-0.82, 1.3, true],
  [0.82, 1.3, true],
  [-0.82, -1.25, false],
  [0.82, -1.25, false],
] as const;

const WHEEL_RADIUS = 0.36;
const SUSPENSION_REST = 0.32;

/** Ereignisse, auf die HUD und Effekte reagieren. */
export interface CarEvents {
  onDriftBoost?: (level: number) => void;
}

/** Ein Arcade-Auto: Rapier-Raycast-Fahrzeug plus Drift-, Boost- und Nitro-Logik. */
export class Car {
  readonly mesh = new THREE.Group();
  readonly body: RAPIER.RigidBody;
  private readonly vehicle: RAPIER.DynamicRayCastVehicleController;
  private readonly wheelMeshes: THREE.Object3D[] = [];
  readonly nitro: NitroTank;

  speed = 0;
  driftTime = 0;
  drifting = false;
  boostTime = 0;
  private boostForce = 0;
  nitroActive = false;
  private stuckTime = 0;
  private resetPose = { pos: new THREE.Vector3(), yaw: 0 };

  constructor(
    private readonly world: RAPIER.World,
    readonly stats: VehicleStats,
    private readonly events: CarEvents = {},
    color = theme.cyan,
  ) {
    this.nitro = new NitroTank(stats.nitroCapacity);
    this.nitro.charge(stats.nitroCapacity * 0.5);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(0, 1.2, 0)
      .setLinearDamping(0.08)
      .setAngularDamping(1.2)
      .setCanSleep(false);
    this.body = world.createRigidBody(bodyDesc);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.9, 0.3, 2.0).setDensity(260).setFriction(0.4).setTranslation(0, 0.15, 0),
      this.body,
    );
    // Schwerpunkt tief legen, damit das Auto nicht so leicht kippt.
    this.body.setAdditionalMassProperties(
      400,
      { x: 0, y: -0.45, z: 0 },
      { x: 400, y: 500, z: 200 },
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    );

    this.vehicle = world.createVehicleController(this.body);
    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;
    WHEELS.forEach(([x, z], i) => {
      this.vehicle.addWheel({ x, y: -0.05, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, SUSPENSION_REST, WHEEL_RADIUS);
      this.vehicle.setWheelSuspensionStiffness(i, 34);
      this.vehicle.setWheelMaxSuspensionTravel(i, 0.3);
      this.vehicle.setWheelSuspensionCompression(i, 4.4);
      this.vehicle.setWheelSuspensionRelaxation(i, 3.0);
      this.vehicle.setWheelMaxSuspensionForce(i, 60000);
      this.vehicle.setWheelFrictionSlip(i, stats.grip);
      this.vehicle.setWheelSideFrictionStiffness(i, 1);
    });

    this.buildMesh(color);
  }

  private buildMesh(color: number): void {
    const paint = new THREE.MeshPhysicalMaterial({ color: 0x2b3a8c, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
    const glow = new THREE.MeshBasicMaterial({ color });
    const glass = new THREE.MeshStandardMaterial({ color: 0x050816, metalness: 0.9, roughness: 0.15, envMapIntensity: 0.5 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.45, 4.0), paint);
    base.position.y = 0.15;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.9), glass);
    cabin.position.set(0, 0.58, -0.2);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.06, 4.02), glow);
    stripe.position.y = 0.2;
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.35), glow);
    spoiler.position.set(0, 0.72, -1.85);
    const under = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    under.rotation.x = -Math.PI / 2;
    under.position.y = -0.2;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.05), new THREE.MeshBasicMaterial({ color: theme.magenta }));
    tail.position.set(0, 0.25, -2.02);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: theme.white }));
    head.position.set(0, 0.25, 2.02);
    this.mesh.add(base, cabin, stripe, spoiler, under, tail, head);

    const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const rim = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < WHEELS.length; i++) {
      const wheel = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.3, 20), tire);
      t.rotation.z = Math.PI / 2;
      const r = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS * 0.62, 0.04, 6, 20), rim);
      r.rotation.y = Math.PI / 2;
      r.position.x = WHEELS[i]![0] < 0 ? -0.16 : 0.16;
      wheel.add(t, r);
      this.mesh.add(wheel);
      this.wheelMeshes.push(wheel);
    }
  }

  setResetPose(pos: THREE.Vector3, yaw: number): void {
    this.resetPose = { pos: pos.clone(), yaw };
  }

  /** Setzt das Auto aufrecht an die Reset-Position. */
  reset(): void {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.resetPose.yaw);
    this.body.setTranslation({ x: this.resetPose.pos.x, y: this.resetPose.pos.y + 1, z: this.resetPose.pos.z }, true);
    this.body.setRotation(q, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.driftTime = 0;
    this.drifting = false;
    this.boostTime = 0;
    this.stuckTime = 0;
  }

  forward(target = new THREE.Vector3()): THREE.Vector3 {
    const r = this.body.rotation();
    return target.set(0, 0, 1).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  }

  up(target = new THREE.Vector3()): THREE.Vector3 {
    const r = this.body.rotation();
    return target.set(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w));
  }

  get grounded(): boolean {
    for (let i = 0; i < WHEELS.length; i++) if (this.vehicle.wheelIsInContact(i)) return true;
    return false;
  }

  /** Physik-Schritt: Eingabe anwenden, bevor die Welt simuliert wird. */
  update(controls: ControlState, dt: number): void {
    const s = this.stats;
    this.speed = this.vehicle.currentVehicleSpeed();
    const absSpeed = Math.abs(this.speed);

    if (controls.reset) {
      this.reset();
      return;
    }

    // Antrieb: Gas vorwärts, Bremse bremst und fährt im Stand rückwärts.
    let engine = 0;
    let brake = 0;
    if (controls.throttle > 0 && this.speed < s.topSpeed) engine = s.engineForce * controls.throttle;
    if (controls.brake > 0) {
      if (this.speed > 1) brake = s.brakeForce * controls.brake;
      else if (this.speed > -12) engine = -s.engineForce * 0.6 * controls.brake;
    }
    if (controls.throttle === 0 && controls.brake === 0) brake = 1.2; // Motorbremse

    // Drift: Hinterräder verlieren Seitenhaftung, das Heck kommt.
    const wantsDrift = controls.drift && absSpeed > DRIFT_MIN_SPEED && Math.abs(controls.steer) > 0.2 && this.grounded;
    if (wantsDrift) {
      this.drifting = true;
      this.driftTime += dt;
    } else if (this.drifting) {
      const level = driftLevel(this.driftTime);
      if (level > 0) {
        const cfg = DRIFT_LEVELS[level - 1]!;
        this.boostTime = cfg.boostTime;
        this.boostForce = cfg.boostForce;
        this.nitro.charge(0.25 * level);
        this.events.onDriftBoost?.(level);
      }
      this.drifting = false;
      this.driftTime = 0;
    }

    const steerMax = steerAngle(s.maxSteer, this.speed, s.topSpeed) * (this.drifting ? 1.25 : 1);
    const steer = -controls.steer * steerMax;
    for (let i = 0; i < WHEELS.length; i++) {
      const front = WHEELS[i]![2];
      this.vehicle.setWheelSteering(i, front ? steer : 0);
      this.vehicle.setWheelEngineForce(i, front ? 0 : engine);
      this.vehicle.setWheelBrake(i, brake);
      this.vehicle.setWheelSideFrictionStiffness(i, !front && this.drifting ? s.driftGrip : 1);
    }

    const fwd = this.forward();
    const mass = this.body.mass();

    // Drift-Regelung: Drehrate auf einen Zielwert ziehen statt frei zu kreiseln.
    if (this.drifting) {
      const av = this.body.angvel();
      const speedFactor = Math.min(1, absSpeed / 25);
      const target = -controls.steer * s.driftYawAssist * (0.55 + 0.45 * speedFactor);
      const yaw = av.y + (target - av.y) * (1 - Math.exp(-5 * dt));
      this.body.setAngvel({ x: av.x, y: yaw, z: av.z }, true);
    }

    // Boost nach dem Drift und Nitro schieben das Chassis nach vorne.
    let push = 0;
    if (this.boostTime > 0) {
      this.boostTime -= dt;
      push += this.boostForce;
    }
    this.nitroActive = controls.nitro && this.nitro.drain(dt);
    if (this.nitroActive) push += s.nitroForce;
    if (push > 0 && this.grounded && this.speed < s.topSpeed * 1.35) {
      this.body.applyImpulse({ x: fwd.x * push * dt, y: 0, z: fwd.z * push * dt }, true);
    }

    // Abtrieb hält das Auto bei hohem Tempo am Boden.
    if (this.grounded) {
      this.body.applyImpulse({ x: 0, y: -absSpeed * 18 * dt * (mass / 1000), z: 0 }, true);
    }

    // Auto-Reset: liegt das Auto auf dem Dach oder steckt fest, nach 2 s zurücksetzen.
    const upright = this.up().y;
    const fellOff = this.body.translation().y < -5;
    if (fellOff) {
      this.reset();
      return;
    }
    const stuck = upright < 0.3 || (controls.throttle > 0 && absSpeed < 0.5 && !this.grounded);
    this.stuckTime = stuck ? this.stuckTime + dt : 0;
    if (this.stuckTime > 2) this.reset();

    this.vehicle.updateVehicle(dt);
  }

  /** Überträgt den Physik-Zustand auf die 3D-Modelle (pro Render-Frame). */
  sync(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.mesh.position.set(t.x, t.y, t.z);
    this.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    for (let i = 0; i < WHEELS.length; i++) {
      const [x, z] = WHEELS[i]!;
      const len = this.vehicle.wheelSuspensionLength(i) ?? SUSPENSION_REST;
      const w = this.wheelMeshes[i]!;
      w.position.set(x, -0.05 - len, z);
      w.rotation.set(0, this.vehicle.wheelSteering(i) ?? 0, 0);
      w.children.forEach((c) => (c.rotation.x = this.vehicle.wheelRotation(i) ?? 0));
    }
  }

  dispose(): void {
    this.world.removeVehicleController(this.vehicle);
    this.world.removeRigidBody(this.body);
  }
}
