import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { carById, defaultLooks, theme, type CarDef, type CarLooks, type VehicleStats } from "@apex/shared";
import { SUSPENSION_REST, VehiclePhysics, wheelLayout, type CarEvents } from "@apex/sim";
import { buildCarModel } from "./carModel";

export type { CarEvents };

/** A car in the game: shared physics from @apex/sim plus the 3D model. */
export class Car extends VehiclePhysics {
  readonly mesh = new THREE.Group();
  private readonly wheelMeshes: THREE.Object3D[];
  /** Model id (decides e.g. the horn sound). */
  readonly modelId: string;

  constructor(
    world: RAPIER.World,
    stats: VehicleStats & { extraMass?: number },
    events: CarEvents = {},
    appearance: number | { def: CarDef; looks: CarLooks } = theme.cyan,
  ) {
    const look =
      typeof appearance === "number"
        ? { def: carById("volt-hatch"), looks: { ...defaultLooks(carById("volt-hatch")), color: appearance, rimColor: appearance, underglow: appearance, spoiler: true } }
        : appearance;
    super(world, stats, events, wheelLayout(look.def));
    this.modelId = look.def.id;
    const model = buildCarModel(look.def, look.looks);
    this.mesh.add(model.group);
    this.wheelMeshes = model.wheelMeshes;
  }

  /** Copies the physics state onto the 3D model (once per rendered frame). */
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
      w.children.forEach((ch) => (ch.rotation.x = this.vehicle.wheelRotation(i) ?? 0));
    }
  }
}
