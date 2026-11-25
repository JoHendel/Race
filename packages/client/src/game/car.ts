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
import { buildCarModel } from "./carModel";
import { carById, defaultLooks, type CarDef, type CarLooks } from "@apex/shared";

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
  private readonly wheelMeshes: THREE.Object3D[];
  private readonly wheels: [number, number, boolean][];
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
    readonly stats: VehicleStats & { extraMass?: number },
    private readonly events: CarEvents = {},
    appearance: number | { def: CarDef; looks: CarLooks } = theme.cyan,
  ) {
    const look =
      typeof appearance === "number"
        ? { def: carById("volt-hatch"), looks: { ...defaultLooks(carById("volt-hatch")), color: appearance, rimColor: appearance, underglow: appearance, spoiler: true } }
        : appearance;
    const model = buildCarModel(look.def, look.looks);
    this.mesh.add(model.group);
    this.wheels = model.wheels;
    this.wheelMeshes = model.wheelMeshes;
    const wheelRadius = model.wheelRadius;
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
      stats.extraMass ?? 400,
      { x: 0, y: -0.45, z: 0 },
      { x: 400, y: 500, z: 200 },
      { x: 0, y: 0, z: 0, w: 1 },
      true,
    );

    this.vehicle = world.createVehicleController(this.body);
    this.vehicle.indexUpAxis = 1;
    this.vehicle.setIndexForwardAxis = 2;
    this.wheels.forEach(([x, z], i) => {
      this.vehicle.addWheel({ x, y: -0.05, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, SUSPENSION_REST, wheelRadius);
      this.vehicle.setWheelSuspensionStiffness(i, 34);
      this.vehicle.setWheelMaxSuspensionTravel(i, 0.3);
      this.vehicle.setWheelSuspensionCompression(i, 4.4);
      this.vehicle.setWheelSuspensionRelaxation(i, 3.0);
      this.vehicle.setWheelMaxSuspensionForce(i, 60000);
      this.vehicle.setWheelFrictionSlip(i, stats.grip);
      this.vehicle.setWheelSideFrictionStiffness(i, 1);
    });

  }

  /** Entfernte Autos (andere Spieler) werden nicht simuliert, sondern auf empfangene Zustände gesetzt. */
  remote = false;

  setRemote(remote: boolean): void {
    if (this.remote === remote) return;
    this.remote = remote;
    this.body.setBodyType(remote ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Dynamic, true);
    if (!remote) {
      this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }

  /** Ziel für ein entferntes Auto im nächsten Physik-Schritt. */
  setRemoteTarget(p: [number, number, number], q: [number, number, number, number], speed: number, drifting: boolean, nitro: boolean): void {
    this.body.setNextKinematicTranslation({ x: p[0], y: p[1], z: p[2] });
    this.body.setNextKinematicRotation({ x: q[0], y: q[1], z: q[2], w: q[3] });
    this.speed = speed;
    this.drifting = drifting;
    this.nitroActive = nitro;
  }

  /** Setzt das Auto sofort an eine Stelle (z. B. beim Wiedereinstieg). */
  teleport(p: [number, number, number], q: [number, number, number, number]): void {
    this.body.setTranslation({ x: p[0], y: p[1], z: p[2] }, true);
    this.body.setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Kompakter Zustand für das Netzwerk. */
  snapshot(id: string): { id: string; p: [number, number, number]; q: [number, number, number, number]; v: number; d: 0 | 1; n: 0 | 1 } {
    const t = this.body.translation();
    const r = this.body.rotation();
    const round = (x: number) => Math.round(x * 1000) / 1000;
    return {
      id,
      p: [round(t.x), round(t.y), round(t.z)],
      q: [round(r.x), round(r.y), round(r.z), round(r.w)],
      v: Math.round(this.speed * 10) / 10,
      d: this.drifting ? 1 : 0,
      n: this.nitroActive ? 1 : 0,
    };
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
    for (let i = 0; i < this.wheels.length; i++) if (this.vehicle.wheelIsInContact(i)) return true;
    return false;
  }

  /** Physik-Schritt: Eingabe anwenden, bevor die Welt simuliert wird. */
  update(controls: ControlState, dt: number): void {
    if (this.remote) return;
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
    for (let i = 0; i < this.wheels.length; i++) {
      const front = this.wheels[i]![2];
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
    for (let i = 0; i < this.wheels.length; i++) {
      const [x, z] = this.wheels[i]!;
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
