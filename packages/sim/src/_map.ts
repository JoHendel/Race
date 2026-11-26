import { TRACKS } from "@apex/shared";
import { TrackGeometry } from "./track";
import RAPIER from "@dimforge/rapier3d-compat";
import { writeFileSync } from "node:fs";
await RAPIER.init();
const def = TRACKS.find((t) => t.id === process.argv[2])!;
const t = new TrackGeometry(new RAPIER.World({ x: 0, y: -9.81, z: 0 }), def);
const n = t.samples.length;
const xs = t.samples.map(s => s.pos.x), zs = t.samples.map(s => s.pos.z);
const minx = Math.min(...xs) - 40, minz = Math.min(...zs) - 40;
const sc = 1.6;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${(Math.max(...xs) - minx + 40) * sc}" height="${(Math.max(...zs) - minz + 40) * sc}"><rect width="100%" height="100%" fill="#111"/>`;
svg += `<polyline fill="none" stroke="#0ef" stroke-width="${16 * sc}" stroke-opacity="0.35" points="${t.samples.map(s => `${(s.pos.x - minx) * sc},${(s.pos.z - minz) * sc}`).join(" ")}"/>`;
for (const c of t.shortcuts) svg += `<polyline fill="none" stroke="#f80" stroke-width="${10 * sc}" stroke-opacity="0.5" points="${c.samples.map(s => `${(s.pos.x - minx) * sc},${(s.pos.z - minz) * sc}`).join(" ")}"/>`;
for (let i = 0; i < n; i += Math.round(n / 40)) { const s = t.samples[i]!; svg += `<text x="${(s.pos.x - minx) * sc}" y="${(s.pos.z - minz) * sc}" fill="#fff" font-size="13">${(i / n).toFixed(3)}</text>`; }
for (let x = Math.ceil(minx / 50) * 50; x < Math.max(...xs) + 40; x += 50) svg += `<text x="${(x - minx) * sc}" y="12" fill="#888" font-size="10">x${x}</text>`;
for (let z = Math.ceil(minz / 50) * 50; z < Math.max(...zs) + 40; z += 50) svg += `<text x="2" y="${(z - minz) * sc}" fill="#888" font-size="10">z${z}</text>`;
for (const [x, , z] of def.points) svg += `<circle cx="${(x - minx) * sc}" cy="${(z - minz) * sc}" r="4" fill="#f0f"/><text x="${(x - minx) * sc + 6}" y="${(z - minz) * sc - 6}" fill="#f8f" font-size="11">${x},${z}</text>`;
writeFileSync("/tmp/map.svg", svg + "</svg>");
