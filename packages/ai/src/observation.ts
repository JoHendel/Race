import type { HeadlessRace, SimRacer, TrackGeometry, VehiclePhysics } from "@apex/sim";

/** Names and meaning of the 24 input features (all normalized to roughly −1…1). */
export const FEATURES = [
  "speed",
  "airborne",
  "nitro_level",
  "heading_10m",
  "heading_20m",
  "heading_40m",
  "heading_60m",
  "heading_80m",
  "curvature_near",
  "curvature_far",
  "lateral_offset",
  "ray_-90",
  "ray_-60",
  "ray_-30",
  "ray_0",
  "ray_30",
  "ray_60",
  "ray_90",
  "lateral_velocity",
  "yaw_rate",
  "opp1_forward",
  "opp1_right",
  "opp2_forward",
  "opp2_right",
] as const;

export const OBS_SIZE = FEATURES.length;

/** Plain-language description of each feature for the documentation. */
export const FEATURE_INFO: Record<(typeof FEATURES)[number], string> = {
  speed: "forward speed / 60 m/s",
  airborne: "1 if no wheel touches the ground, else −1",
  nitro_level: "nitro tank fill level",
  heading_10m: "angle to the track point 10 m ahead / π (positive = right)",
  heading_20m: "angle to the track point 20 m ahead / π",
  heading_40m: "angle to the track point 40 m ahead / π",
  heading_60m: "angle to the track point 60 m ahead / π",
  heading_80m: "angle to the track point 80 m ahead / π",
  curvature_near: "direction change of the track over the next 44 m",
  curvature_far: "direction change of the track 44–88 m ahead",
  lateral_offset: "signed distance from the centre line / wall distance",
  "ray_-90": "free distance to the wall at −90° (left), up to 40 m",
  "ray_-60": "free distance at −60°",
  "ray_-30": "free distance at −30°",
  ray_0: "free distance straight ahead",
  ray_30: "free distance at +30°",
  ray_60: "free distance at +60°",
  ray_90: "free distance at +90° (right)",
  lateral_velocity: "sideways sliding speed / 15 m/s",
  yaw_rate: "rotation speed around the vertical axis / 3 rad/s",
  opp1_forward: "nearest opponent: distance ahead / 30 m",
  opp1_right: "nearest opponent: distance to the right / 30 m",
  opp2_forward: "second nearest opponent: distance ahead / 30 m",
  opp2_right: "second nearest opponent: distance to the right / 30 m",
};

const LOOKAHEAD = [5, 10, 20, 30, 40]; // samples of 2 m
const RAY_ANGLES = [-90, -60, -30, 0, 30, 60, 90].map((d) => (d * Math.PI) / 180);
const RAY_MAX = 40;
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function curvature(track: TrackGeometry, from: number, ahead: number): number {
  const a = track.sample(from).tangent;
  const b = track.sample(from + ahead).tangent;
  return Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z)));
}

/** Distance along a horizontal ray until the point leaves the area between the walls. */
function castRay(track: TrackGeometry, x: number, z: number, dx: number, dz: number, hint: number): number {
  let idx = hint;
  for (let d = 2; d <= RAY_MAX; d += 2) {
    const p = { x: x + dx * d, y: 0, z: z + dz * d };
    idx = track.nearestIndex({ x: p.x, y: track.sample(idx).pos.y, z: p.z }, idx, 16);
    if (Math.abs(track.lateralOffset(p, idx)) > track.wallOffset) return d - 1;
  }
  return RAY_MAX;
}

/** Builds the observation vector for one car. Only uses information a human player could see. */
export function observe(track: TrackGeometry, car: VehiclePhysics, index: number, opponents: VehiclePhysics[], out: Float32Array<ArrayBufferLike> = new Float32Array(OBS_SIZE)): Float32Array<ArrayBufferLike> {
  const p = car.position;
  const f = car.forward();
  const fl = Math.hypot(f.x, f.z) || 1;
  const fx = f.x / fl;
  const fz = f.z / fl;
  const rx = -fz; // right vector
  const rz = fx;
  let k = 0;
  out[k++] = clamp(car.speed / 60);
  out[k++] = car.grounded ? -1 : 1;
  out[k++] = car.nitro.fraction * 2 - 1;
  for (const ahead of LOOKAHEAD) {
    const s = track.sample(index + ahead).pos;
    const tx = s.x - p.x;
    const tz = s.z - p.z;
    out[k++] = Math.atan2(tx * rx + tz * rz, tx * fx + tz * fz) / Math.PI;
  }
  out[k++] = clamp(curvature(track, index, 22) / 1.5);
  out[k++] = clamp(curvature(track, index + 22, 22) / 1.5);
  out[k++] = clamp(track.lateralOffset(p, index) / track.wallOffset);
  for (const a of RAY_ANGLES) {
    const dx = fx * Math.cos(a) + rx * Math.sin(a);
    const dz = fz * Math.cos(a) + rz * Math.sin(a);
    out[k++] = (castRay(track, p.x, p.z, dx, dz, index) / RAY_MAX) * 2 - 1;
  }
  const v = car.body.linvel();
  out[k++] = clamp((v.x * rx + v.z * rz) / 15);
  out[k++] = clamp(car.body.angvel().y / 3);
  const near = opponents
    .map((o) => {
      const q = o.position;
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      return { fwd: dx * fx + dz * fz, right: dx * rx + dz * rz, d: dx * dx + dz * dz };
    })
    .sort((a, b) => a.d - b.d);
  for (let i = 0; i < 2; i++) {
    const o = near[i];
    out[k++] = o && o.d < 900 ? clamp(o.fwd / 30) : 1;
    out[k++] = o && o.d < 900 ? clamp(o.right / 30) : 0;
  }
  return out;
}

/** Observation for a racer inside a headless race. */
export function observeRacer(race: HeadlessRace, r: SimRacer, out?: Float32Array<ArrayBufferLike>): Float32Array<ArrayBufferLike> {
  const opponents = race.racers.filter((x) => x !== r).map((x) => x.car);
  return observe(race.track, r.car, r.index, opponents, out);
}
