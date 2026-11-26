import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {
  DRIFT_LEVELS,
  DRIFT_MIN_SPEED,
  NitroTank,
  driftLevel,
  steerAngle,
  type VehicleStats,
} from "@apex/shared";
import type { ControlState } from "./controls";
import type { CarDef } from "@apex/shared";

export const SUSPENSION_REST = 0.32;

export interface WheelLayout {
  /** Wheel positions relative to the chassis: [x, z, front]. */
  wheels: [number, number, boolean][];
  radius: number;
}

/** Wheel positions and radius derived from a car's size and body style. */
export function wheelLayout(def: CarDef): WheelLayout {
  const L = def.length;
  const W = def.width;
  const radius = def.body === "muscle" ? 0.4 : def.body === "hyper" ? 0.36 : 0.35;
  return {
    radius,
    wheels: [
      [-(W / 2 - 0.1), L * 0.32, true],
      [W / 2 - 0.1, L * 0.32, true],
      [-(W / 2 - 0.1), -L * 0.3, false],
      [W / 2 - 0.1, -L * 0.3, false],
    ],
  };
}

/** Events that HUD and effects react to. */
export interface CarEvents {
  onDriftBoost?: (level: number) => void;
}

/** Arcade car physics without graphics: Rapier ray-cast vehicle plus drift, boost and nitro logic. */
export class VehiclePhysics {
  readonly body: RAPIER.RigidBody;
  protected readonly vehicle: RAPIER.DynamicRayCastVehicleController;
  protected readonly wheels: [number, number, boolean][];
  readonly nitro: NitroTank;

  speed = 0;
  driftTime = 0;
  drifting = false;
  boostTime = 0;
  private boostForce = 0;
  nitroActive = false;
  private stuckTime = 0;
  /** Number of automatic or manual resets (used as a driving metric). */
  resets = 0;
  private resetPose = { pos: new THREE.Vector3(), yaw: 0 };

  constructor(
    protected readonly world: RAPIER.World,
    readonly stats: VehicleStats & { extraMass?: number },
    protected readonly events: CarEvents = {},
    layout: WheelLayout,
  ) {
    this.wheels = layout.wheels;
    const wheelRadius = layout.radius;
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

  /** Extra downward acceleration (m/s²) while on the ground – set on low-gravity tracks. */
  groundPress = 0;

  /** Current surface grip factor (1 = asphalt, < 1 = ice). */
  surfaceGrip = 1;

  /** Extra push forward for `time` seconds (item boosts); keeps the stronger of two boosts. */
  addBoost(time: number, force: number): void {
    if (force >= this.boostForce || this.boostTime <= 0) this.boostForce = force;
    this.boostTime = Math.max(this.boostTime, time);
  }

  /** Spin the car around its vertical axis (hit by a mine or drone). */
  spin(rate: number): void {
    if (this.remote) return;
    const av = this.body.angvel();
    this.body.setAngvel({ x: av.x, y: rate, z: av.z }, true);
  }

  /** Slow the car down (lava): exponential drag with `rate` per second on the horizontal velocity. */
  applyDrag(rate: number, dt: number): void {
    if (rate <= 0 || this.remote) return;
    const v = this.body.linvel();
    const k = Math.exp(-rate * dt);
    this.body.setLinvel({ x: v.x * k, y: v.y, z: v.z * k }, true);
  }

  /** Set the grip of the surface under the car (from the track, every physics step). */
  setSurfaceGrip(factor: number): void {
    if (factor === this.surfaceGrip) return;
    this.surfaceGrip = factor;
    for (let i = 0; i < this.wheels.length; i++) this.vehicle.setWheelFrictionSlip(i, this.stats.grip * factor);
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
    this.resets++;
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
      // Low-gravity tracks: the "magnetic" road presses the car down like normal gravity, so grip stays the same.
      if (this.groundPress > 0) this.body.applyImpulse({ x: 0, y: -this.groundPress * mass * dt, z: 0 }, true);
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

  /** Position as a plain object (no graphics needed). */
  get position(): { x: number; y: number; z: number } {
    return this.body.translation();
  }

  dispose(): void {
    this.world.removeVehicleController(this.vehicle);
    this.world.removeRigidBody(this.body);
  }
}
