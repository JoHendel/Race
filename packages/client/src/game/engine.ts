import RAPIER from "@dimforge/rapier3d-compat";

/**
 * Everything that needs the physics engine, loaded on demand: the title screen, lobby and garage
 * come up without the 1.7 MB Rapier download, which starts only when the first drive begins.
 */
export { DriveScene } from "./driveScene";
export { RaceScene } from "./raceScene";

let ready: Promise<void> | null = null;

export function initPhysics(): Promise<void> {
  ready ??= RAPIER.init();
  return ready;
}
