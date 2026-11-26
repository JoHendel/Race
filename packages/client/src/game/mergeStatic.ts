import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Fewer draw calls for static scenery: all opaque meshes below `root` that share a material are
 * baked into one mesh (world transforms applied). Objects (or their parents) marked with
 * `userData.noMerge` – everything that moves or fades – are left alone, as are transparent
 * materials (their sort order matters), instanced meshes, points, lines and sprites.
 * Returns how many meshes were replaced (`before`) by how many merged ones (`after`).
 */
export function mergeStatic(root: THREE.Object3D, minPerMaterial = 2): { before: number; after: number } {
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  interface Bucket {
    material: THREE.Material;
    /** mesh → its parts with this material */
    meshes: Map<THREE.Mesh, THREE.BufferGeometry[]>;
  }
  const buckets = new Map<string, Bucket>();
  const signature = (g: THREE.BufferGeometry): string => Object.keys(g.attributes).sort().join(",");

  const visit = (o: THREE.Object3D): void => {
    if (o.userData.noMerge || !o.visible || o.renderOrder !== 0) return;
    const mesh = o as THREE.Mesh;
    const plain = mesh.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh && !(o as THREE.SkinnedMesh).isSkinnedMesh;
    if (plain && o.children.length === 0) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (mats.every((m) => !m.transparent && m.visible)) {
        const local = new THREE.Matrix4().multiplyMatrices(rootInv, mesh.matrixWorld);
        const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(local);
        const groups =
          Array.isArray(mesh.material) && geo.groups.length ? geo.groups : [{ start: 0, count: geo.attributes.position!.count, materialIndex: 0 }];
        for (const gr of groups) {
          const material = mats[gr.materialIndex ?? 0]!;
          const part = slice(geo, gr.start, gr.count);
          const key = `${material.uuid}|${signature(part)}`;
          let b = buckets.get(key);
          if (!b) buckets.set(key, (b = { material, meshes: new Map() }));
          const list = b.meshes.get(mesh);
          if (list) list.push(part);
          else b.meshes.set(mesh, [part]);
        }
        geo.dispose();
        return;
      }
    }
    for (const c of [...o.children]) visit(c);
  };
  visit(root);

  // a mesh can only go if every one of its parts ends up in a merged mesh
  const usable = (b: Bucket): boolean => b.meshes.size >= minPerMaterial;
  const blocked = new Set<THREE.Mesh>();
  for (const b of buckets.values()) if (!usable(b)) for (const m of b.meshes.keys()) blocked.add(m);

  let before = 0;
  let after = 0;
  const removed = new Set<THREE.Mesh>();
  for (const b of buckets.values()) {
    if (!usable(b)) continue;
    const take = [...b.meshes].filter(([m]) => !blocked.has(m));
    if (take.length < minPerMaterial) continue;
    const merged = mergeGeometries(take.flatMap(([, parts]) => parts), false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.name = "merged";
    mesh.receiveShadow = take.some(([m]) => m.receiveShadow);
    root.add(mesh);
    for (const [m] of take) removed.add(m);
    after++;
  }
  for (const m of removed) {
    m.removeFromParent();
    before++;
  }
  for (const b of buckets.values()) for (const parts of b.meshes.values()) for (const p of parts) p.dispose();
  return { before, after };
}

/** Copy vertices [start, start + count) of a non-indexed geometry. */
function slice(g: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    const a = attr as THREE.BufferAttribute;
    const size = a.itemSize;
    out.setAttribute(name, new THREE.BufferAttribute(a.array.slice(start * size, (start + count) * size), size, a.normalized));
  }
  return out;
}
