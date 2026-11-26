import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import type { TrackEnvironment } from "@apex/shared";

/**
 * Reflections per track from small CC0 HDRIs (Poly Haven, packed by @pmndrs/assets).
 * Each map is loaded on demand (~150–400 KB), so the first page load does not grow.
 */
const HDRI: Record<TrackEnvironment["scenery"], () => Promise<{ default: string }>> = {
  harbor: () => import("@pmndrs/assets/hdri/night.exr"),
  desert: () => import("@pmndrs/assets/hdri/sunset.exr"),
  city: () => import("@pmndrs/assets/hdri/city.exr"),
  glacier: () => import("@pmndrs/assets/hdri/dawn.exr"),
  jungle: () => import("@pmndrs/assets/hdri/forest.exr"),
  volcano: () => import("@pmndrs/assets/hdri/sunset.exr"),
  orbital: () => import("@pmndrs/assets/hdri/studio.exr"),
  circuit: () => import("@pmndrs/assets/hdri/park.exr"),
};

/** Load the environment map for a scenery and turn it into a prefiltered (PMREM) texture. */
export async function loadEnvironmentMap(renderer: THREE.WebGLRenderer, scenery: TrackEnvironment["scenery"]): Promise<THREE.Texture> {
  const { default: url } = await HDRI[scenery]();
  const equirect = await new EXRLoader().loadAsync(url);
  equirect.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(equirect).texture;
  env.name = `hdri:${scenery}`;
  equirect.dispose();
  pmrem.dispose();
  return env;
}
