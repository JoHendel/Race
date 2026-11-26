import * as THREE from "three";
import { ITEM_CONFIG as C, rollItem, type ItemKind } from "@apex/shared";
import type { TrackGeometry } from "./track";
import type { VehiclePhysics } from "./vehicle";

/** What the item system needs to know about a racer. */
export interface ItemRacer {
  id: string;
  car: VehiclePhysics;
  /** Sample index on the main track. */
  index: number;
  /** Race position (1 = leader). */
  place: number;
  /** Total progress in laps (for "who is behind me"). */
  progress: number;
}

/** Timers of the effects on one car (seconds left). */
export interface CarEffect {
  stun: number;
  slow: number;
  shield: number;
  boost: number;
}

export type ItemEvent =
  | { type: "pickup"; id: string; item: ItemKind }
  | { type: "use"; id: string; item: ItemKind }
  | { type: "hit"; id: string; by: string; item: ItemKind }
  | { type: "blocked"; id: string; item: ItemKind }
  | { type: "emp"; id: string; pos: [number, number, number] };

export interface ItemBox {
  pos: THREE.Vector3;
  /** Seconds until it is back (0 = available). */
  respawn: number;
}

export interface HeldItem {
  kind: ItemKind;
  /** Turbo cells have several charges. */
  charges: number;
  /** Seconds the item has been held (bots wait a moment before using it). */
  held: number;
}

const newEffect = (): CarEffect => ({ stun: 0, slow: 0, shield: 0, boost: 0 });

/**
 * Apply effect timers to a car for one physics step. Shared by the host (all simulated cars)
 * and online clients (their own car, with the timers from the snapshot).
 */
export function applyCarEffect(car: VehiclePhysics, fx: CarEffect, dt: number): void {
  if (fx.stun > 0) {
    car.applyDrag(3.5, dt);
    car.spin(7);
  } else if (fx.slow > 0) car.applyDrag(1.6, dt);
  if (fx.boost > 0) car.addBoost(Math.min(fx.boost, C.turboTime), C.turboForce);
}

/**
 * Chaos mode: item boxes, held items, mines, homing drones and effects. Host-authoritative and
 * deterministic for a given random function, so it also runs in the headless simulation.
 */
export class ItemSystem {
  readonly boxes: ItemBox[] = [];
  readonly held = new Map<string, HeldItem>();
  readonly effects = new Map<string, CarEffect>();
  readonly mines: { pos: THREE.Vector3; owner: string; age: number }[] = [];
  readonly drones: { pos: THREE.Vector3; owner: string; target: string | null; age: number }[] = [];
  private readonly tmp = new THREE.Vector3();

  constructor(
    private readonly track: TrackGeometry,
    private readonly rnd: () => number,
  ) {
    const n = track.samples.length;
    for (let row = 0; row < C.boxRows; row++) {
      const s = track.sample(Math.round(((row + 0.5) / C.boxRows) * n));
      for (let k = 0; k < C.boxesPerRow; k++) {
        const lateral = (-0.6 + (1.2 * k) / Math.max(1, C.boxesPerRow - 1)) * track.halfWidth;
        this.boxes.push({ pos: s.pos.clone().addScaledVector(s.left, lateral).add(new THREE.Vector3(0, 1, 0)), respawn: 0 });
      }
    }
  }

  effect(id: string): CarEffect {
    let e = this.effects.get(id);
    if (!e) this.effects.set(id, (e = newEffect()));
    return e;
  }

  /** One step: pickups, mines, drones, effect timers. Applies effects to simulated (non-remote) cars. */
  update(racers: ItemRacer[], dt: number): ItemEvent[] {
    const events: ItemEvent[] = [];
    const total = racers.length;
    for (const b of this.boxes) if (b.respawn > 0) b.respawn = Math.max(0, b.respawn - dt);
    for (const r of racers) {
      const p = r.car.position;
      const h = this.held.get(r.id);
      if (h) h.held += dt;
      else
        for (const b of this.boxes) {
          if (b.respawn > 0) continue;
          if (Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < C.pickupRadius && Math.abs(b.pos.y - 1 - p.y) < 3) {
            b.respawn = C.boxRespawn;
            const kind = rollItem(r.place, total, this.rnd);
            this.held.set(r.id, { kind, charges: kind === "turbo" ? C.turboBoosts : 1, held: 0 });
            events.push({ type: "pickup", id: r.id, item: kind });
            break;
          }
        }
    }
    // Mines
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i]!;
      m.age += dt;
      for (const r of racers) {
        if (r.id === m.owner && m.age < C.mineArm) continue;
        const p = r.car.position;
        if (Math.hypot(m.pos.x - p.x, m.pos.z - p.z) < C.mineRadius && Math.abs(m.pos.y - p.y) < 2.5) {
          this.hit(r.id, m.owner, "mine", events);
          this.mines.splice(i, 1);
          break;
        }
      }
    }
    // Drones fly at their target
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const d = this.drones[i]!;
      d.age += dt;
      const target = racers.find((r) => r.id === d.target);
      if (!target || d.age > C.droneLife) {
        this.drones.splice(i, 1);
        continue;
      }
      const to = this.tmp.copy(target.car.position).add(new THREE.Vector3(0, 0.8, 0)).sub(d.pos);
      const dist = to.length();
      if (dist < C.droneHitRadius) {
        this.hit(target.id, d.owner, "drone", events);
        this.drones.splice(i, 1);
        continue;
      }
      d.pos.addScaledVector(to.normalize(), Math.min(dist, C.droneSpeed * dt));
    }
    // Effect timers and their physics
    for (const r of racers) {
      const e = this.effects.get(r.id);
      if (!e) continue;
      applyCarEffect(r.car, e, dt);
      e.stun = Math.max(0, e.stun - dt);
      e.slow = Math.max(0, e.slow - dt);
      e.shield = Math.max(0, e.shield - dt);
      e.boost = Math.max(0, e.boost - dt);
    }
    return events;
  }

  private hit(id: string, by: string, item: ItemKind, events: ItemEvent[]): void {
    const e = this.effect(id);
    if (e.shield > 0) {
      e.shield = 0;
      events.push({ type: "blocked", id, item });
      return;
    }
    if (item === "emp") e.slow = Math.max(e.slow, C.empTime);
    else e.stun = Math.max(e.stun, C.stunTime);
    events.push({ type: "hit", id, by, item });
  }

  /** Use the held item of `user`. Returns the events (nothing happens without an item). */
  use(user: ItemRacer, racers: ItemRacer[]): ItemEvent[] {
    const h = this.held.get(user.id);
    if (!h) return [];
    const events: ItemEvent[] = [{ type: "use", id: user.id, item: h.kind }];
    const pos = user.car.position;
    switch (h.kind) {
      case "shield":
        this.effect(user.id).shield = C.shieldTime;
        break;
      case "turbo":
        this.effect(user.id).boost = C.turboTime;
        break;
      case "mine": {
        const back = user.car.forward(new THREE.Vector3()).setY(0).normalize().multiplyScalar(-4);
        this.mines.push({ pos: new THREE.Vector3(pos.x, pos.y, pos.z).add(back), owner: user.id, age: 0 });
        break;
      }
      case "drone": {
        const ahead = racers.find((r) => r.place === user.place - 1) ?? null;
        this.drones.push({ pos: new THREE.Vector3(pos.x, pos.y + 2, pos.z), owner: user.id, target: ahead?.id ?? null, age: 0 });
        break;
      }
      case "emp":
        events.push({ type: "emp", id: user.id, pos: [pos.x, pos.y, pos.z] });
        for (const r of racers) {
          if (r.id === user.id) continue;
          const p = r.car.position;
          if (Math.hypot(p.x - pos.x, p.z - pos.z) < C.empRadius) this.hit(r.id, user.id, "emp", events);
        }
        break;
    }
    h.charges--;
    if (h.charges <= 0) this.held.delete(user.id);
    else h.held = 0;
    return events;
  }

  /** Simple rules for bots and APEX-AI: when is it a good moment to use the held item? */
  wantsToUse(user: ItemRacer, racers: ItemRacer[]): boolean {
    const h = this.held.get(user.id);
    if (!h || h.held < 1.2) return false;
    const pos = user.car.position;
    switch (h.kind) {
      case "shield":
        return this.effect(user.id).shield <= 0;
      case "turbo": {
        const a = this.track.sample(user.index).tangent;
        const b = this.track.sample(user.index + 30).tangent;
        return user.car.speed > 12 && a.angleTo(b) < 0.25;
      }
      case "mine":
        return racers.some((r) => r !== user && user.progress - r.progress > 0 && user.progress - r.progress < 0.04) || h.held > 8;
      case "drone":
        return user.place > 1;
      case "emp":
        return racers.some((r) => r !== user && Math.hypot(r.car.position.x - pos.x, r.car.position.z - pos.z) < C.empRadius * 0.7) || h.held > 10;
    }
  }
}
