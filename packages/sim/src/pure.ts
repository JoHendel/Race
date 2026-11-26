/**
 * The parts of `@apex/sim` that do not need the physics engine – safe to import from menus
 * and the garage without pulling in Rapier.
 */
export { mulberry32 } from "./random";
export { wheelLayout, type WheelLayout } from "./layout";
