import { beforeAll, describe, expect, it } from "vitest";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { GRAND_CIRCUIT, ITEM_CONFIG, NEON_HARBOR } from "@apex/shared";
import { ItemSystem, type ItemRacer } from "./items";
import { HeadlessRace } from "./race";
import { TrackGeometry } from "./track";
import { VehiclePhysics, wheelLayout } from "./vehicle";
import { carById, statsFor, stockTuning } from "@apex/shared";

const DEF = carById("volt-hatch");
const makeCar = (world: RAPIER.World) => new VehiclePhysics(world, statsFor(DEF, stockTuning()), {}, wheelLayout(DEF));

describe("chaos items", () => {
  beforeAll(async () => {
    await RAPIER.init();
  });

  const setup = () => {
    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const track = new TrackGeometry(world, GRAND_CIRCUIT);
    const items = new ItemSystem(track, () => 0.5);
    const car = (i: number) => {
      const c = makeCar(world);
      const s = track.sample(i);
      c.body.setTranslation({ x: s.pos.x, y: s.pos.y + 0.6, z: s.pos.z }, true);
      return c;
    };
    return { world, track, items, car };
  };

  it("places rows of item boxes along the lap", () => {
    const { items } = setup();
    expect(items.boxes).toHaveLength(ITEM_CONFIG.boxRows * ITEM_CONFIG.boxesPerRow);
  });

  it("a car driving into a box picks up an item and the box respawns later", () => {
    const { items, world } = setup();
    const c = makeCar(world);
    const b = items.boxes[0]!;
    c.body.setTranslation({ x: b.pos.x, y: b.pos.y - 0.6, z: b.pos.z }, true);
    const r: ItemRacer = { id: "a", car: c, index: 0, place: 1, progress: 0.1 };
    const ev = items.update([r], 1 / 60);
    expect(ev[0]?.type).toBe("pickup");
    expect(items.held.get("a")).toBeTruthy();
    expect(b.respawn).toBeGreaterThan(0);
  });

  it("a shield blocks a mine, the next mine hits", () => {
    const { items, car } = setup();
    const victim: ItemRacer = { id: "v", car: car(200), index: 200, place: 2, progress: 0.3 };
    items.effect("v").shield = 5;
    const c = victim.car.position;
    const p = () => new THREE.Vector3(c.x, c.y, c.z);
    items.mines.push({ pos: p(), owner: "x", age: 2 });
    expect(items.update([victim], 1 / 60).map((e) => e.type)).toContain("blocked");
    items.mines.push({ pos: p(), owner: "x", age: 2 });
    expect(items.update([victim], 1 / 60).map((e) => e.type)).toContain("hit");
    expect(items.effect("v").stun).toBeGreaterThan(0);
  });

  it("a drone flies to the racer ahead and hits it", () => {
    const { items, car } = setup();
    const leader: ItemRacer = { id: "lead", car: car(120), index: 120, place: 1, progress: 0.2 };
    const me: ItemRacer = { id: "me", car: car(100), index: 100, place: 2, progress: 0.18 };
    items.held.set("me", { kind: "drone", charges: 1, held: 5 });
    items.use(me, [leader, me]);
    let hit = false;
    for (let i = 0; i < 120 && !hit; i++) hit = items.update([leader, me], 1 / 60).some((e) => e.type === "hit" && e.id === "lead");
    expect(hit).toBe(true);
  });

  it("a turbo cell has three boosts", () => {
    const { items, car } = setup();
    const me: ItemRacer = { id: "me", car: car(10), index: 10, place: 3, progress: 0 };
    items.held.set("me", { kind: "turbo", charges: ITEM_CONFIG.turboBoosts, held: 5 });
    for (let k = 0; k < ITEM_CONFIG.turboBoosts; k++) expect(items.use(me, [me])[0]?.type).toBe("use");
    expect(items.held.has("me")).toBe(false);
    expect(items.use(me, [me])).toEqual([]);
  });

  it("a headless chaos race: everyone finishes, items are used, and it is reproducible", () => {
    const run = () => {
      const race = new HeadlessRace(NEON_HARBOR, [{ id: "a", skill: "hard" }, { id: "b" }, { id: "c" }, { id: "d", skill: "easy" }], 2, 9, "clear", true);
      const res = race.run(300);
      const uses = race.itemEvents.filter((e) => e.type === "use").length;
      const hits = race.itemEvents.filter((e) => e.type === "hit").length;
      race.dispose();
      return { res, uses, hits };
    };
    const a = run();
    const b = run();
    expect(a.res.every((r) => r.finished)).toBe(true);
    expect(a.uses).toBeGreaterThan(5);
    expect(a.hits).toBeGreaterThan(0);
    expect(b.res.map((r) => r.bestLap)).toEqual(a.res.map((r) => r.bestLap));
  }, 120_000);
});
