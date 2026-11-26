import * as THREE from "three";
import { theme, type BodyStyle, type CarDef, type CarLooks, type DecalPattern } from "@apex/shared";
import { wheelLayout } from "@apex/sim/pure";

/** Seitenprofil (z nach vorne, y nach oben) pro Karosserie, normiert auf Länge 1 und Höhe 1. */
const PROFILES: Record<BodyStyle, [number, number][]> = {
  hatch: [[-0.5, 0.05], [0.5, 0.05], [0.5, 0.38], [0.42, 0.5], [0.18, 0.55], [0.05, 1.0], [-0.42, 1.0], [-0.5, 0.75]],
  coupe: [[-0.5, 0.05], [0.5, 0.05], [0.5, 0.35], [0.38, 0.45], [0.12, 0.52], [-0.02, 0.95], [-0.32, 0.95], [-0.5, 0.6]],
  wedge: [[-0.5, 0.05], [0.5, 0.05], [0.5, 0.25], [0.2, 0.45], [0.0, 0.85], [-0.28, 0.88], [-0.5, 0.62]],
  muscle: [[-0.5, 0.05], [0.5, 0.05], [0.5, 0.48], [0.45, 0.56], [0.1, 0.58], [-0.04, 0.95], [-0.3, 0.95], [-0.42, 0.62], [-0.5, 0.6]],
  hyper: [[-0.5, 0.05], [0.5, 0.05], [0.5, 0.18], [0.28, 0.34], [0.05, 0.78], [-0.2, 0.82], [-0.45, 0.55], [-0.5, 0.5]],
};

const HEIGHT: Record<BodyStyle, number> = { hatch: 1.3, coupe: 1.15, wedge: 1.05, muscle: 1.25, hyper: 0.95 };

export interface CarModel {
  group: THREE.Group;
  /** Radpositionen relativ zum Chassis: [x, z, vorne]. */
  wheels: [number, number, boolean][];
  wheelMeshes: THREE.Object3D[];
  wheelRadius: number;
}

/** Baut ein Auto aus Seitenprofil, Glas, Leuchten, Spoiler, Felgen und Folie. */
export function buildCarModel(def: CarDef, looks: CarLooks): CarModel {
  const group = new THREE.Group();
  const L = def.length;
  const W = def.width;
  const H = HEIGHT[def.body];
  const shape = new THREE.Shape();
  PROFILES[def.body].forEach(([z, y], i) => {
    const px = z * L;
    const py = y * H;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  });
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  geo.translate(0, 0, -W / 2);
  geo.rotateY(-Math.PI / 2); // Profil-x -> Welt-z (vorne), Extrusion -> Welt-x
  geo.translate(0, -0.25, 0);

  const paint =
    looks.finish === "chrome"
      ? new THREE.MeshPhysicalMaterial({ color: looks.color, metalness: 1, roughness: 0.08, clearcoat: 1 })
      : looks.finish === "matte"
        ? new THREE.MeshStandardMaterial({ color: looks.color, metalness: 0.1, roughness: 0.85 })
        : new THREE.MeshPhysicalMaterial({ color: looks.color, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const body = new THREE.Mesh(geo, paint);
  group.add(body);

  // Glas als leicht schmalere Kopie der Kabine
  const glass = new THREE.MeshStandardMaterial({ color: 0x050816, metalness: 0.9, roughness: 0.12, envMapIntensity: 0.6 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, H * 0.32, L * 0.36), glass);
  const cabinZ = def.body === "hatch" ? -0.12 * L : -0.1 * L;
  cabin.position.set(0, H * 0.72 - 0.25, cabinZ);
  group.add(cabin);

  const glowColor = looks.underglow;
  const head = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.07, 0.04), new THREE.MeshBasicMaterial({ color: theme.white }));
  head.position.set(0, PROFILES[def.body][2]![1] * H - 0.32, L / 2 + 0.07);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.86, 0.09, 0.04), new THREE.MeshBasicMaterial({ color: theme.magenta }));
  tail.position.set(0, PROFILES[def.body].at(-1)![1] * H - 0.4, -L / 2 - 0.07);
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.9, L * 0.92),
    new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.55 }),
  );
  under.rotation.x = -Math.PI / 2;
  under.position.y = -0.24;
  const sideLine = new THREE.Mesh(new THREE.BoxGeometry(W + 0.14, 0.05, L * 0.9), new THREE.MeshBasicMaterial({ color: glowColor }));
  sideLine.position.y = -0.12;
  group.add(head, tail, under, sideLine);

  if (looks.spoiler) {
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0b0c18, metalness: 0.5, roughness: 0.4 });
    const wingY = PROFILES[def.body].at(-1)![1] * H - 0.05;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(W * 0.95, 0.06, 0.42), wingMat);
    wing.position.set(0, wingY + 0.32, -L / 2 + 0.25);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(W * 0.96, 0.02, 0.43), new THREE.MeshBasicMaterial({ color: glowColor }));
    edge.position.copy(wing.position).add(new THREE.Vector3(0, 0.04, 0));
    group.add(wing, edge);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.12), wingMat);
      post.position.set(side * W * 0.32, wingY + 0.16, -L / 2 + 0.25);
      group.add(post);
    }
  }

  const decal = decalTexture(looks.decal, looks.number, looks.color);
  if (decal) {
    for (const side of [-1, 1]) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(L * 0.8, H * 0.42),
        new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      plane.position.set(side * (W / 2 + 0.075), H * 0.28 - 0.25, 0);
      plane.rotation.y = side * Math.PI / 2;
      if (side < 0) plane.scale.x = -1;
      group.add(plane);
    }
  }

  const { wheels, radius } = wheelLayout(def);
  const tire = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const rim = new THREE.MeshBasicMaterial({ color: looks.rimColor });
  const wheelMeshes: THREE.Object3D[] = [];
  for (const [x] of wheels) {
    const wheel = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.32, 20), tire);
    t.rotation.z = Math.PI / 2;
    const r = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.62, 0.04, 6, 20), rim);
    r.rotation.y = Math.PI / 2;
    r.position.x = x < 0 ? -0.17 : 0.17;
    const spokes = new THREE.Mesh(new THREE.BoxGeometry(0.02, radius * 1.1, 0.08), rim);
    spokes.position.x = r.position.x;
    wheel.add(t, r, spokes);
    group.add(wheel);
    wheelMeshes.push(wheel);
  }
  return { group, wheels, wheelMeshes, wheelRadius: radius };
}

const decalCache = new Map<string, THREE.CanvasTexture>();

/** Seitliche Folie mit Muster und Startnummer, prozedural gezeichnet. */
function decalTexture(pattern: DecalPattern, number: number, base: number): THREE.CanvasTexture | null {
  const key = `${pattern}-${number}-${base}`;
  const cached = decalCache.get(key);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d")!;
  const accent = luminance(base) > 0.6 ? "#05060f" : "#f4f6ff";
  g.fillStyle = accent;
  g.strokeStyle = accent;
  if (pattern === "stripes") {
    g.fillRect(0, 50, 512, 10);
    g.fillRect(0, 68, 512, 10);
  } else if (pattern === "flames") {
    g.fillStyle = "#ff8a1f";
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      const y = 30 + (i % 3) * 25;
      g.moveTo(0, y);
      g.quadraticCurveTo(120 + i * 25, y - 30, 200 + i * 30, y + 5);
      g.quadraticCurveTo(110 + i * 20, y + 10, 0, y + 30);
      g.fill();
    }
  } else if (pattern === "checker") {
    for (let x = 0; x < 512; x += 16)
      for (let y = 40; y < 88; y += 16) if (((x + y) / 16) % 2 < 1) g.fillRect(x, y, 16, 16);
  } else if (pattern === "lightning") {
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(0, 64);
    for (let x = 40; x <= 512; x += 40) g.lineTo(x, x % 80 === 0 ? 40 : 88);
    g.stroke();
  }
  // Startnummer im Kreis
  g.fillStyle = "#f4f6ff";
  g.beginPath();
  g.arc(256, 64, 40, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#05060f";
  g.font = "italic 900 52px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(number), 256, 67);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  decalCache.set(key, tex);
  return tex;
}

function luminance(hex: number): number {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
