import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  CARS,
  CLASS_NAMES,
  CLASS_PI_LIMIT,
  HORNS,
  LOOKS_COST,
  MAX_TUNING_LEVEL,
  PAINT_COLORS,
  TUNING_NAMES,
  TUNING_PARTS,
  carById,
  isUnlocked,
  levelFromXp,
  looksOf,
  performanceIndex,
  stockTuning,
  theme,
  tunedRating,
  tuningOf,
  upgradeCost,
  xpForLevel,
  type CarLooks,
  type DecalPattern,
  type PaintFinish,
  type SaveGame,
  type TireType,
  type TuningPart,
} from "@apex/shared";
import { buildCarModel } from "../game/carModel";
import { escapeHtml } from "../game/grid";
import { loadSave, storeSave } from "../save";

const RATING_NAMES: [keyof ReturnType<typeof tunedRating>, string][] = [
  ["topSpeed", "Topspeed"],
  ["accel", "Beschleunigung"],
  ["handling", "Handling"],
  ["drift", "Drift"],
  ["weight", "Gewicht"],
  ["nitro", "Nitro"],
];
const DECALS: [DecalPattern, string][] = [
  ["none", "Keine"],
  ["stripes", "Streifen"],
  ["flames", "Flammen"],
  ["checker", "Karo"],
  ["lightning", "Blitz"],
];
const FINISHES: [PaintFinish, string][] = [
  ["metallic", "Metallic"],
  ["matte", "Matt"],
  ["chrome", "Chrom"],
];
const TIRES: [TireType, string][] = [
  ["street", "Straße"],
  ["drift", "Drift"],
  ["allweather", "Allwetter"],
];

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** Garage: 3D-Drehteller plus Oberfläche für Auswahl, Tuning und Optik. */
export class Garage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  private readonly turntable = new THREE.Group();
  private model: THREE.Group | null = null;
  private readonly root = document.createElement("div");
  private save: SaveGame = loadSave();
  private viewing: string = this.save.selected;
  private tab: "perf" | "looks" = "perf";
  private time = 0;

  constructor(
    private readonly ui: HTMLElement,
    renderer: THREE.WebGLRenderer,
    private readonly onDone: () => void,
  ) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    this.scene.background = new THREE.Color(0x07081a);
    this.scene.fog = new THREE.Fog(0x07081a, 14, 40);
    this.camera.position.set(6.5, 2.6, 7.5);
    this.camera.lookAt(0, 0.6, 0);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(30, 64),
      new THREE.MeshStandardMaterial({ color: 0x05060f, roughness: 0.25, metalness: 0.7 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.7, 0.18, 64), new THREE.MeshStandardMaterial({ color: 0x10122a, metalness: 0.6, roughness: 0.3 }));
    disc.position.y = 0.09;
    this.turntable.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.65, 0.04, 8, 96), new THREE.MeshBasicMaterial({ color: theme.cyan }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.19;
    this.turntable.add(ring);
    this.scene.add(this.turntable);
    for (const [x, z, c] of [
      [-6, 4, theme.magenta],
      [6, 4, theme.cyan],
      [0, -6, 0xffffff],
    ] as const) {
      const l = new THREE.SpotLight(c, 80, 30, 0.6, 0.6, 1.2);
      l.position.set(x, 8, z);
      l.target.position.set(0, 0.5, 0);
      this.scene.add(l, l.target);
    }
    this.scene.add(new THREE.HemisphereLight(0x8899ff, 0x110011, 0.4));

    this.root.className = "garage";
    this.root.dataset.testid = "garage-screen";
    ui.appendChild(this.root);
    this.rebuildModel();
    this.render();
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / h;
    // Auf schmalen Bildschirmen weiter weg, damit das Auto neben der Oberfläche Platz hat.
    this.camera.position.set(6.5, 2.6, w < 900 ? 11 : 7.5);
    this.camera.lookAt(w < 900 ? 0 : -1.2, 0.6, 0);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.time += dt;
    this.turntable.rotation.y += dt * 0.35;
  }

  private rebuildModel(): void {
    if (this.model) this.turntable.remove(this.model);
    const def = carById(this.viewing);
    const m = buildCarModel(def, looksOf(this.save, def.id));
    m.group.position.y = 0.18 + 0.25 + 0.36;
    m.wheels.forEach(([x, z], i) => m.wheelMeshes[i]!.position.set(x, -0.05 - 0.32, z));
    this.model = m.group;
    this.turntable.add(m.group);
  }

  private commit(next: SaveGame): void {
    this.save = next;
    storeSave(next);
    this.rebuildModel();
    this.render();
  }

  private buyLook(key: keyof CarLooks): boolean {
    const cost = LOOKS_COST[key] ?? 0;
    const owned = this.save.boughtLooks[this.viewing] ?? [];
    if (!cost || owned.includes(key)) return true;
    if (this.save.credits < cost) return false;
    this.save = {
      ...this.save,
      credits: this.save.credits - cost,
      boughtLooks: { ...this.save.boughtLooks, [this.viewing]: [...owned, key] },
    };
    return true;
  }

  private setLook<K extends keyof CarLooks>(key: K, value: CarLooks[K]): void {
    const free = key === "color" || key === "number" || (key === "finish" && value === "metallic");
    if (!free && !this.buyLook(key)) {
      this.flash("Nicht genug Credits");
      return;
    }
    const looks = { ...looksOf(this.save, this.viewing), [key]: value };
    this.commit({ ...this.save, looks: { ...this.save.looks, [this.viewing]: looks } });
  }

  private upgrade(part: TuningPart): void {
    const t = tuningOf(this.save, this.viewing);
    const level = t.levels[part];
    if (level >= MAX_TUNING_LEVEL) return;
    const cost = upgradeCost(part, level);
    if (this.save.credits < cost) {
      this.flash("Nicht genug Credits");
      return;
    }
    const next = { ...t, levels: { ...t.levels, [part]: level + 1 } };
    this.commit({ ...this.save, credits: this.save.credits - cost, tuning: { ...this.save.tuning, [this.viewing]: next } });
  }

  private flash(text: string): void {
    const el = this.root.querySelector<HTMLElement>(".g-flash");
    if (!el) return;
    el.textContent = text;
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
  }

  private render(): void {
    const save = this.save;
    const def = carById(this.viewing);
    const unlocked = isUnlocked(save, def.id);
    const tuning = tuningOf(save, def.id);
    const looks = looksOf(save, def.id);
    const level = levelFromXp(save.xp);
    const xpNow = save.xp - xpForLevel(level);
    const xpNeed = xpForLevel(level + 1) - xpForLevel(level);
    const pi = performanceIndex(def, tuning);
    const limit = CLASS_PI_LIMIT[def.cls];
    const rating = tunedRating(def, tuning);
    const stock = tunedRating(def, stockTuning());
    const owned = save.boughtLooks[def.id] ?? [];
    const price = (key: keyof CarLooks) => (owned.includes(key) || !LOOKS_COST[key] ? "" : ` · ${LOOKS_COST[key]} Cr`);

    const list = (["street", "drift", "muscle", "hyper"] as const)
      .map(
        (cls) => `<div class="g-class"><h4>${CLASS_NAMES[cls]}</h4>${CARS.filter((c) => c.cls === cls)
          .map((c) => {
            const ok = isUnlocked(save, c.id);
            const lock = c.unlockByCup ? `Level ${c.unlockLevel} oder Cup-Sieg` : `ab Level ${c.unlockLevel}`;
            return `<button class="g-car ${c.id === this.viewing ? "active" : ""} ${ok ? "" : "locked"} ${c.id === save.selected ? "selected" : ""}" data-car="${c.id}">
              <span class="dot" style="background:${hex(c.defaultColor)}"></span>${c.name}<small>${ok ? (c.id === save.selected ? "gewählt" : "") : "🔒 " + lock}</small></button>`;
          })
          .join("")}</div>`,
      )
      .join("");

    const bars = RATING_NAMES.map(([k, name]) => {
      const v = Math.max(0, Math.min(12, rating[k]));
      const base = Math.max(0, Math.min(12, stock[k]));
      return `<div class="g-stat"><span>${name}</span><div class="bar"><div class="base" style="width:${(base / 12) * 100}%"></div><div class="tuned" style="width:${(v / 12) * 100}%"></div></div><b>${v.toFixed(1)}</b></div>`;
    }).join("");

    const perf = `${TUNING_PARTS.map((p) => {
      const lv = tuning.levels[p];
      const max = lv >= MAX_TUNING_LEVEL;
      return `<div class="g-part"><span>${TUNING_NAMES[p]}</span><span class="pips">${"●".repeat(lv)}${"○".repeat(MAX_TUNING_LEVEL - lv)}</span>
        <button class="btn small" data-upgrade="${p}" ${max || !unlocked ? "disabled" : ""}>${max ? "MAX" : `${upgradeCost(p, lv)} Cr`}</button></div>`;
    }).join("")}
      <label class="g-row">Übersetzung <input type="range" min="-1" max="1" step="0.1" value="${tuning.gearRatio}" data-gear ${unlocked ? "" : "disabled"}/><small>kurz ↔ lang</small></label>
      <div class="g-row">Reifen ${TIRES.map(([t, n]) => `<button class="chip ${tuning.tires === t ? "on" : ""}" data-tires="${t}" ${unlocked ? "" : "disabled"}>${n}</button>`).join("")}</div>`;

    const swatches = (key: "color" | "rimColor" | "underglow" | "smoke") =>
      PAINT_COLORS.map((c) => `<button class="swatch ${looks[key] === c ? "on" : ""}" style="background:${hex(c)}" data-look="${key}" data-value="${c}" aria-label="Farbe"></button>`).join("");
    const looksTab = `
      <div class="g-row">Lack ${swatches("color")}</div>
      <div class="g-row">Oberfläche ${FINISHES.map(([f, n]) => `<button class="chip ${looks.finish === f ? "on" : ""}" data-finish="${f}">${n}${f === "metallic" ? "" : price("finish")}</button>`).join("")}</div>
      <div class="g-row">Felgen${price("rimColor")} ${swatches("rimColor")}</div>
      <div class="g-row">Unterboden${price("underglow")} ${swatches("underglow")}</div>
      <div class="g-row">Folie${price("decal")} ${DECALS.map(([d, n]) => `<button class="chip ${looks.decal === d ? "on" : ""}" data-decal="${d}">${n}</button>`).join("")}</div>
      <div class="g-row">Spoiler${price("spoiler")} <button class="chip ${looks.spoiler ? "on" : ""}" data-spoiler>${looks.spoiler ? "an" : "aus"}</button>
        Startnummer <input type="number" min="1" max="99" value="${looks.number}" data-number /></div>
      <div class="g-row">Reifenrauch${price("smoke")} ${swatches("smoke")}</div>
      <div class="g-row">Hupe${price("horn")} ${HORNS.map((h, i) => `<button class="chip ${looks.horn === i ? "on" : ""}" data-horn="${i}">${h}</button>`).join("")}</div>`;

    this.root.innerHTML = `
      <header class="g-top">
        <h2>GARAGE</h2>
        <div class="g-level">LEVEL <b>${level}</b><div class="xp"><div style="width:${Math.min(100, (xpNow / xpNeed) * 100)}%"></div></div><small>${xpNow} / ${xpNeed} XP</small></div>
        <div class="g-credits" data-testid="credits">${save.credits.toLocaleString("de-DE")} Credits</div>
        <button class="btn btn-ghost small" data-action="back">Zurück</button>
      </header>
      <aside class="g-list">${list}</aside>
      <section class="g-panel">
        <div class="g-head"><div><small>${CLASS_NAMES[def.cls].toUpperCase()}</small><h3>${escapeHtml(def.name)}</h3></div>
          <div class="g-pi ${pi > limit ? "over" : ""}" title="Leistungsindex (Limit der Klasse: ${limit})">PI <b>${pi}</b><small>/ ${limit}</small></div></div>
        <div class="g-stats">${bars}</div>
        <div class="g-tabs"><button class="chip ${this.tab === "perf" ? "on" : ""}" data-tab="perf">Leistung</button><button class="chip ${this.tab === "looks" ? "on" : ""}" data-tab="looks">Optik</button></div>
        <div class="g-tab">${unlocked ? (this.tab === "perf" ? perf : looksTab) : `<p class="hint">Dieses Auto wird ${def.unlockByCup ? `ab Level ${def.unlockLevel} oder mit einem Grand-Prix-Sieg` : `ab Level ${def.unlockLevel}`} freigeschaltet.</p>`}</div>
        <div class="actions">
          <span class="g-flash"></span>
          <button class="btn" data-action="select" data-testid="select-car" ${unlocked ? "" : "disabled"}>${save.selected === def.id ? "Gewählt ✓" : "Dieses Auto fahren"}</button>
        </div>
      </section>`;
    this.bind();
  }

  private bind(): void {
    const q = <T extends HTMLElement>(sel: string) => [...this.root.querySelectorAll<T>(sel)];
    q<HTMLButtonElement>("[data-action=back]")[0]!.onclick = () => this.onDone();
    q<HTMLButtonElement>("[data-action=select]")[0]!.onclick = () => {
      if (!isUnlocked(this.save, this.viewing)) return;
      this.commit({ ...this.save, selected: this.viewing });
      this.flash("Auto gewählt");
    };
    q<HTMLButtonElement>("[data-car]").forEach((b) => (b.onclick = () => {
      this.viewing = b.dataset.car!;
      this.rebuildModel();
      this.render();
    }));
    q<HTMLButtonElement>("[data-tab]").forEach((b) => (b.onclick = () => {
      this.tab = b.dataset.tab as "perf" | "looks";
      this.render();
    }));
    q<HTMLButtonElement>("[data-upgrade]").forEach((b) => (b.onclick = () => this.upgrade(b.dataset.upgrade as TuningPart)));
    const gear = q<HTMLInputElement>("[data-gear]")[0];
    if (gear)
      gear.onchange = () => {
        const t = tuningOf(this.save, this.viewing);
        this.commit({ ...this.save, tuning: { ...this.save.tuning, [this.viewing]: { ...t, gearRatio: Number(gear.value) } } });
      };
    q<HTMLButtonElement>("[data-tires]").forEach((b) => (b.onclick = () => {
      const t = tuningOf(this.save, this.viewing);
      this.commit({ ...this.save, tuning: { ...this.save.tuning, [this.viewing]: { ...t, tires: b.dataset.tires as TireType } } });
    }));
    q<HTMLButtonElement>("[data-look]").forEach((b) => (b.onclick = () => this.setLook(b.dataset.look as "color", Number(b.dataset.value))));
    q<HTMLButtonElement>("[data-finish]").forEach((b) => (b.onclick = () => this.setLook("finish", b.dataset.finish as PaintFinish)));
    q<HTMLButtonElement>("[data-decal]").forEach((b) => (b.onclick = () => this.setLook("decal", b.dataset.decal as DecalPattern)));
    q<HTMLButtonElement>("[data-horn]").forEach((b) => (b.onclick = () => this.setLook("horn", Number(b.dataset.horn))));
    const spoiler = q<HTMLButtonElement>("[data-spoiler]")[0];
    if (spoiler) spoiler.onclick = () => this.setLook("spoiler", !looksOf(this.save, this.viewing).spoiler);
    const num = q<HTMLInputElement>("[data-number]")[0];
    if (num) num.onchange = () => this.setLook("number", Math.max(1, Math.min(99, Math.round(Number(num.value) || 1))));
  }

  dispose(): void {
    this.root.remove();
  }
}
