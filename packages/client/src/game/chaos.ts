import * as THREE from "three";
import { ITEM_CONFIG, ITEM_ICONS, ITEM_NAMES, type ItemKind } from "@apex/shared";
import { ItemSystem, applyCarEffect, mulberry32, type CarEffect, type ItemEvent, type ItemRacer, type VehiclePhysics } from "@apex/sim";
import type { ChaosNet } from "@apex/net";
import type { SplineTrack } from "./track/splineTrack";

export interface ChaosHooks {
  /** Called for item events that concern the local player. */
  onLocal: (e: ItemEvent) => void;
  /** Called for an EMP pulse anywhere (visual ring). */
  onEmp: (pos: THREE.Vector3) => void;
}

/**
 * Chaos mode in the browser. On the host / offline it owns the ItemSystem; on clients it mirrors the
 * state from snapshots and applies the effect timers to the local car. It also draws boxes, mines,
 * drones, shields and EMP rings, and shows the held item in the HUD.
 */
export class Chaos {
  readonly system: ItemSystem | null;
  private net: ChaosNet | null = null;
  private readonly group = new THREE.Group();
  private readonly boxMeshes: THREE.Mesh[] = [];
  private readonly minePool: THREE.Mesh[] = [];
  private readonly dronePool: THREE.Mesh[] = [];
  private readonly shields = new Map<string, THREE.Mesh>();
  private readonly rings: { mesh: THREE.Mesh; age: number }[] = [];
  private readonly slot: HTMLElement;
  private time = 0;
  private lastLocalFx: CarEffect = { stun: 0, slow: 0, shield: 0, boost: 0 };
  /** Item events of the last step (host/offline), for statistics and tests. */
  readonly events: ItemEvent[] = [];

  constructor(
    scene: THREE.Scene,
    ui: HTMLElement,
    private readonly track: SplineTrack,
    authoritative: boolean,
    seed: number,
    private readonly localId: string,
    private readonly hooks: ChaosHooks,
  ) {
    this.system = authoritative ? new ItemSystem(track, mulberry32(seed ^ 0x5eed)) : null;
    scene.add(this.group);
    const boxTex = this.boxTexture();
    const boxMat = new THREE.MeshStandardMaterial({ map: boxTex, emissiveMap: boxTex, emissive: 0xffffff, emissiveIntensity: 0.7, transparent: true, opacity: 0.9, roughness: 0.3 });
    const boxGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const boxes = this.system?.boxes ?? new ItemSystem(track, () => 0.5).boxes;
    for (const b of boxes) {
      const m = new THREE.Mesh(boxGeo, boxMat);
      m.position.copy(b.pos);
      this.group.add(m);
      this.boxMeshes.push(m);
    }
    this.slot = document.createElement("div");
    this.slot.className = "item-slot";
    this.slot.dataset.testid = "item-slot";
    ui.appendChild(this.slot);
    this.renderSlot(null);
  }

  private boxTexture(): THREE.CanvasTexture {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, "#00e5ff");
    grad.addColorStop(1, "#ff2bd6");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = "rgba(255,255,255,0.9)";
    g.lineWidth = 4;
    g.strokeRect(3, 3, 58, 58);
    g.fillStyle = "#ffffff";
    g.font = "bold 42px system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("?", 32, 35);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** Host / offline: one physics step. `uses` = ids that want to use their item now. */
  step(racers: ItemRacer[], uses: Set<string>, autoUsers: Set<string>, dt: number): void {
    const sys = this.system;
    if (!sys) return;
    this.events.length = 0;
    const evs = sys.update(racers, dt);
    for (const r of racers) {
      if (uses.has(r.id) || (autoUsers.has(r.id) && sys.wantsToUse(r, racers))) evs.push(...sys.use(r, racers));
    }
    this.events.push(...evs);
    for (const e of evs) this.dispatch(e);
  }

  private dispatch(e: ItemEvent): void {
    if (e.type === "emp") this.hooks.onEmp(new THREE.Vector3(...e.pos));
    if (e.id === this.localId) this.hooks.onLocal(e);
  }

  /** Host: state for the snapshot. */
  netState(): ChaosNet | undefined {
    const sys = this.system;
    if (!sys) return undefined;
    const h: ChaosNet["h"] = {};
    for (const [id, it] of sys.held) h[id] = [it.kind, it.charges];
    const fx: ChaosNet["fx"] = {};
    for (const [id, e] of sys.effects) if (e.stun > 0 || e.slow > 0 || e.shield > 0 || e.boost > 0) fx[id] = [e.stun, e.slow, e.shield, e.boost];
    const r = (v: THREE.Vector3): [number, number, number] => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
    return {
      b: sys.boxes.flatMap((b, i) => (b.respawn > 0 ? [i] : [])),
      m: sys.mines.map((m) => r(m.pos)),
      d: sys.drones.map((d) => r(d.pos)),
      h,
      fx,
    };
  }

  /** Client: new state from the host. Detects hits on the local car for feedback. */
  applyNet(net: ChaosNet | undefined): void {
    if (!net) return;
    const mine = net.fx[this.localId];
    const fx: CarEffect = mine ? { stun: mine[0], slow: mine[1], shield: mine[2], boost: mine[3] } : { stun: 0, slow: 0, shield: 0, boost: 0 };
    if (fx.stun > 0 && this.lastLocalFx.stun <= 0) this.hooks.onLocal({ type: "hit", id: this.localId, by: "", item: "mine" });
    if (fx.slow > 0 && this.lastLocalFx.slow <= 0) this.hooks.onLocal({ type: "hit", id: this.localId, by: "", item: "emp" });
    const prevHeld = this.net?.h[this.localId];
    const held = net.h[this.localId];
    if (held && !prevHeld) this.hooks.onLocal({ type: "pickup", id: this.localId, item: held[0] as ItemKind });
    this.lastLocalFx = fx;
    this.net = net;
  }

  /** Client: apply the effect timers from the host to the own (locally simulated) car. */
  stepClient(car: VehiclePhysics, dt: number): void {
    const fx = this.lastLocalFx;
    applyCarEffect(car, fx, dt);
    fx.stun = Math.max(0, fx.stun - dt);
    fx.slow = Math.max(0, fx.slow - dt);
    fx.boost = Math.max(0, fx.boost - dt);
  }

  private heldOf(id: string): [ItemKind, number] | null {
    if (this.system) {
      const h = this.system.held.get(id);
      return h ? [h.kind, h.charges] : null;
    }
    const h = this.net?.h[id];
    return h ? [h[0] as ItemKind, h[1]] : null;
  }

  private shieldOf(id: string): boolean {
    if (this.system) return (this.system.effects.get(id)?.shield ?? 0) > 0;
    return (this.net?.fx[id]?.[2] ?? 0) > 0;
  }

  private renderSlot(held: [ItemKind, number] | null): void {
    const key = held ? `${held[0]}:${held[1]}` : "";
    if (this.slot.dataset.key === key) return;
    this.slot.dataset.key = key;
    this.slot.classList.toggle("full", Boolean(held));
    this.slot.innerHTML = held
      ? `<span class="icon">${ITEM_ICONS[held[0]]}</span><span class="name">${ITEM_NAMES[held[0]]}</span>${held[0] === "turbo" ? `<span class="charges">×${held[1]}</span>` : ""}<span class="key">E</span>`
      : `<span class="icon empty">?</span>`;
  }

  /** Every frame: animate boxes, mines, drones, shields, rings and update the HUD slot. */
  render(dt: number, cars: { id: string; pos: THREE.Vector3 }[]): void {
    this.time += dt;
    const unavailable = new Set(this.system ? this.system.boxes.flatMap((b, i) => (b.respawn > 0 ? [i] : [])) : (this.net?.b ?? []));
    this.boxMeshes.forEach((m, i) => {
      m.visible = !unavailable.has(i);
      m.rotation.set(this.time * 0.7, this.time * 1.1 + i, 0);
      m.position.y = (this.system?.boxes[i]?.pos.y ?? m.position.y) + Math.sin(this.time * 2 + i) * 0.003;
    });
    const mines = this.system ? this.system.mines.map((m) => m.pos) : (this.net?.m ?? []).map((p) => new THREE.Vector3(...p));
    const drones = this.system ? this.system.drones.map((d) => d.pos) : (this.net?.d ?? []).map((p) => new THREE.Vector3(...p));
    this.pool(this.minePool, mines, () => new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2020, emissiveIntensity: 0.8 })), (m) => {
      m.rotation.y += dt * 3;
      m.scale.setScalar(1 + 0.15 * Math.sin(this.time * 10));
    });
    this.pool(this.dronePool, drones, () => new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 8), new THREE.MeshStandardMaterial({ color: 0xffc94d, emissive: 0xff8a1f, emissiveIntensity: 0.9 })), (m) => {
      m.rotation.x = Math.PI / 2;
      m.rotation.z += dt * 12;
    });
    // Shields
    for (const c of cars) {
      const on = this.shieldOf(c.id);
      let s = this.shields.get(c.id);
      if (on && !s) {
        s = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.18, depthWrite: false }));
        this.group.add(s);
        this.shields.set(c.id, s);
      }
      if (s) {
        s.visible = on;
        s.position.copy(c.pos).add(new THREE.Vector3(0, 0.8, 0));
        (s.material as THREE.MeshBasicMaterial).opacity = 0.14 + 0.06 * Math.sin(this.time * 6);
      }
    }
    // EMP rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!;
      r.age += dt;
      const f = r.age / 0.8;
      r.mesh.scale.setScalar(1 + f * ITEM_CONFIG.empRadius);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 * (1 - f));
      if (f >= 1) {
        this.group.remove(r.mesh);
        r.mesh.geometry.dispose();
        this.rings.splice(i, 1);
      }
    }
    this.renderSlot(this.heldOf(this.localId));
  }

  /** Expanding EMP ring at a position. */
  ring(pos: THREE.Vector3): void {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 48), new THREE.MeshBasicMaterial({ color: 0x9fe9ff, transparent: true, opacity: 0.8, depthWrite: false }));
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0));
    this.group.add(mesh);
    this.rings.push({ mesh, age: 0 });
  }

  private pool(pool: THREE.Mesh[], positions: THREE.Vector3[], make: () => THREE.Mesh, animate: (m: THREE.Mesh) => void): void {
    while (pool.length < positions.length) {
      const m = make();
      this.group.add(m);
      pool.push(m);
    }
    pool.forEach((m, i) => {
      const p = positions[i];
      m.visible = Boolean(p);
      if (p) {
        m.position.copy(p);
        animate(m);
      }
    });
  }

  dispose(): void {
    this.slot.remove();
    this.group.removeFromParent();
  }
}
