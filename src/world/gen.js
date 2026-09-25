// World generators. Terrain is a smooth heightfield, buildings are textured masonry, and scenery is
// sculpted props. Each generator returns { W, layout } where layout holds named points of interest.
import * as THREE from 'three';
import { VoxelWorld } from './voxel.js';
import { PALETTES, riftPalette } from './palettes.js';
import { Rng, fbm2, noise2, hash3 } from '../core/rng.js';
import { tex } from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const col = new THREE.Color(), c2 = new THREE.Color();
function box(W, x0, y0, z0, x1, y1, z1, v) { W.fill(x0, y0, z0, x1, y1, z1, v); }
function column(W, x, z, y0, y1, v) { for (let y = y0; y <= y1; y++) W.set(x, y, z, v); }
function hollow(W, x0, y0, z0, x1, y1, z1, v) { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (x === x0 || x === x1 || z === z0 || z === z1) W.set(x, y, z, v); }
function heights(w, d, fn) { const h = new Float32Array((w + 1) * (d + 1)); for (let z = 0; z <= d; z++) for (let x = 0; x <= w; x++) h[x + z * (w + 1)] = fn(x, z); return h; }
function blocker(W, B, x, y, z, hgt = 2) { for (let k = 0; k < hgt; k++) if (!W.get(Math.floor(x), Math.floor(y) + k, Math.floor(z))) W.set(Math.floor(x), Math.floor(y) + k, Math.floor(z), B.inv); }
function pitchedRoof(x0, z0, x1, z1, y, peak, color = 0xb86a4a) {
  const w = x1 - x0, d = z1 - z0; const g = new THREE.BufferGeometry();
  const v = [x0 - 1, y, z0 - 1, x1 + 1, y, z0 - 1, x1 + 1, y + peak, z0 + d / 2, x0 - 1, y + peak, z0 + d / 2, x0 - 1, y, z1 + 1, x1 + 1, y, z1 + 1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([0, 3, 2, 0, 2, 1, 4, 5, 2, 4, 2, 3, 0, 4, 3, 1, 2, 5]);
  const uv = [0, 0, w / 3, 0, w / 3, d / 5, 0, d / 5, 0, 0, w / 3, 0]; g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, map: tex('roof'), roughness: 0.8, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true; return m;
}

// ── TAVERN: the Hearth Between, a half-timbered inn on a floating isle ──
export function genTavern() {
  const { p, B } = PALETTES.tavern;
  const S = 64, cx = 32, cz = 32;
  const W = new VoxelWorld(S, 28, S, p);
  const x0 = 16, x1 = 48, z0 = 18, z1 = 44, fy = 5;
  W.setTerrain(heights(S, S, (x, z) => {
    const d = Math.hypot(x - cx, z - cz); const r = 28 + noise2(x * 0.15, z * 0.15) * 3;
    if (d > r) return NaN;
    if (x >= x0 - 2 && x <= x1 + 2 && z >= z0 - 2 && z <= z1 + 2) return fy - 0.02;
    return fy - 0.3 + noise2(x * 0.2, z * 0.2, 4) * 0.8 - Math.max(0, d - r + 3) * 0.4;
  }), (x, z, h, ny, out) => { const n = noise2(x * 0.3, z * 0.3, 9); out.setHex(0x6a8a3a).lerp(c2.setHex(0x9a9a4a), n * 0.6); if (Math.hypot(x - cx, z - (z0 - 5)) < 3 || (Math.abs(x - cx) < 1.8 && z < z0 && z > z0 - 14)) out.setHex(0x9a8a6a); });
  // floor
  box(W, x0, 4, z0, x1, 4, z1, B.plank);
  box(W, cx - 7, 4, cz - 5, cx + 3, 4, cz + 4, B.rug);
  // walls: stone plinth, half-timber above
  hollow(W, x0, fy, z0, x1, fy + 1, z1, B.stone);
  hollow(W, x0, fy + 2, z0, x1, fy + 7, z1, B.plaster);
  for (let x = x0; x <= x1; x += 4) { column(W, x, z0, fy + 2, fy + 7, B.beam); column(W, x, z1, fy + 2, fy + 7, B.beam); }
  for (let z = z0; z <= z1; z += 4) { column(W, x0, z, fy + 2, fy + 7, B.beam); column(W, x1, z, fy + 2, fy + 7, B.beam); }
  for (let x = x0; x <= x1; x++) { W.set(x, fy + 2, z0, B.beam); W.set(x, fy + 2, z1, B.beam); W.set(x, fy + 7, z0, B.beam); W.set(x, fy + 7, z1, B.beam); }
  for (let z = z0; z <= z1; z++) { W.set(x0, fy + 2, z, B.beam); W.set(x1, fy + 2, z, B.beam); W.set(x0, fy + 7, z, B.beam); W.set(x1, fy + 7, z, B.beam); }
  for (let x = x0 + 2; x < x1; x += 4) { box(W, x, fy + 3, z0, x + 1, fy + 5, z0, B.glass); }
  for (let z = z0 + 2; z < z1; z += 4) { box(W, x0, fy + 3, z, x0, fy + 5, z + 1, B.glass); box(W, x1, fy + 3, z, x1, fy + 5, z + 1, B.glass); }
  box(W, cx - 1, fy, z0, cx + 1, fy + 3, z0, 0); // front door
  // bar counter
  box(W, x1 - 7, fy, z0 + 4, x1 - 7, fy + 1, z0 + 14, B.darkplank);
  // fireplace
  box(W, x0 + 1, fy, cz - 3, x0 + 2, fy + 6, cz + 3, B.stone); box(W, x0 + 2, fy, cz - 1, x0 + 2, fy + 2, cz + 1, 0);
  // stage + notice board + hall of doors
  box(W, x0 + 2, 4, z1 - 6, x0 + 10, fy, z1 - 2, B.stage);
  box(W, cx + 5, fy + 2, z0 + 1, cx + 10, fy + 4, z0 + 1, B.board);
  const doors = {};
  const hall = [['emberwood', B.doorE, x0 + 13], ['neon', B.doorN, x0 + 17], ['asterion', B.doorA, x0 + 21], ['rift', B.doorR, x0 + 25], ['loom', B.doorL, x0 + 29]];
  for (const [k, b, dx] of hall) { box(W, dx - 1, fy, z1 - 1, dx + 1, fy + 4, z1 - 1, B.beam); box(W, dx, fy, z1 - 1, dx, fy + 3, z1 - 1, b); doors[k] = V(dx + 0.5, fy, z1 - 2.5); }
  // props: furniture, lights, garden
  const P = [];
  const tables = [V(cx - 6, fy, cz - 5), V(cx, fy, cz - 5), V(cx - 6, fy, cz + 2), V(cx, fy, cz + 2), V(cx + 6, fy, cz - 2)];
  for (const t of tables) { P.push({ type: 'table', x: t.x, y: fy, z: t.z }); blocker(W, B, t.x, fy, t.z, 2); for (let i = 0; i < 3; i++) P.push({ type: 'stool', x: t.x + Math.cos(i * 2.1) * 1.4, y: fy, z: t.z + Math.sin(i * 2.1) * 1.4 }); }
  for (let z = z0 + 3; z <= z0 + 15; z += 3) P.push({ type: 'barrel', x: x1 - 1.5, y: fy, z, r: 0 });
  for (let z = z0 + 4; z <= z0 + 14; z += 3) P.push({ type: 'bottles', x: x1 - 7.5, y: fy + 2, z, r: Math.PI / 2 });
  P.push({ type: 'fireplace', x: x0 + 2.6, y: fy, z: cz + 0.5 });
  P.push({ type: 'bookshelf', x: x0 + 3, y: fy, z: z0 + 1.3, r: 0 }, { type: 'bookshelf', x: x0 + 6, y: fy, z: z0 + 1.3, r: 0 });
  P.push({ type: 'anvil', x: cx + 10, y: fy, z: cz + 6 });
  for (let x = x0 + 4; x < x1; x += 8) { P.push({ type: 'torch', x, y: fy + 4, z: z0 + 0.8 }); P.push({ type: 'torch', x, y: fy + 4, z: z1 - 0.8 }); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const x = cx + Math.cos(a) * 25, z = cz + Math.sin(a) * 25; if (!isNaN(W.terrainAt(x, z)) && W.terrainAt(x, z) > 0) P.push({ type: 'lamp', x, y: W.terrainAt(x, z), z, v: 0 }); }
  const R = new Rng(5);
  for (let i = 0; i < 400; i++) { const x = R.range(4, 60), z = R.range(4, 60); const t = W.terrainAt(x, z); if (t === -Infinity) continue; if (x > x0 - 3 && x < x1 + 3 && z > z0 - 3 && z < z1 + 3) continue; P.push({ type: R.chance(0.85) ? 'grass' : 'flower', v: R.int(0, 3), x, y: t, z, s: R.range(0.8, 1.3) }); }
  for (const [tx, tz] of [[8, 22], [56, 40], [22, 58], [50, 10], [10, 44]]) { const t = W.terrainAt(tx, tz); if (t > -Infinity) { P.push({ type: 'tree', v: 3, x: tx, y: t, z: tz }); blocker(W, B, tx, t, tz, 3); } }
  W.props = P;
  // pitched roof (hidden when you're inside) + the isle's rocky underside
  W.roof = pitchedRoof(x0, z0, x1 + 1, z1 + 1, fy + 8, 6);
  const under = new THREE.Mesh(new THREE.ConeGeometry(29, 26, 18, 4), new THREE.MeshStandardMaterial({ color: 0x5a4a5a, map: tex('stone'), roughness: 0.95 }));
  under.rotation.x = Math.PI; under.position.set(cx, fy - 13.5, cz);
  W.extras = [W.roof, under];
  const lights = [{ pos: V(x0 + 3, fy + 1.5, cz + 0.5), color: 0xff9a4a, intensity: 30, dist: 18 }, { pos: V(cx, fy + 6, cz), color: 0xffc080, intensity: 26, dist: 26 }, { pos: V(x1 - 4, fy + 5, z0 + 9), color: 0xffb070, intensity: 18, dist: 16 }];
  return { W, layout: { spawn: V(cx + 0.5, fy, z0 + 10), doors, bar: V(x1 - 4, fy, z0 + 9), fire: V(x0 + 5, fy, cz), stage: V(x0 + 6, fy + 1, z1 - 4), board: V(cx + 7.5, fy, z0 + 2.5), shelves: V(x0 + 4.5, fy, z0 + 3), tables: tables.map((t) => t.clone()), cellar: V(x0 + 6, fy, z1 - 10), center: V(cx, fy, cz), lights, inside: { x0, z0, x1, z1 } } };
}

// ── EMBERWOOD REACH: endless autumn, ley-stones and the Hollow Keep ──
export function genEmberwood(seed = 1) {
  const { p, B } = PALETTES.emberwood; const R = new Rng(seed);
  const S = 160, H = 48;
  const W = new VoxelWorld(S, H, S, p);
  const L = {
    spawn: V(18, 0, 18), camp: V(30, 0, 34), stones: [V(78, 0, 36), V(38, 0, 112), V(112, 0, 84)],
    keep: V(132, 0, 132), camps: [V(84, 0, 64), V(58, 0, 84), V(120, 0, 40), V(80, 0, 128)], grove: V(38, 0, 112),
  };
  const flats = [[L.spawn, 8], [L.camp, 9], ...L.stones.map((s) => [s, 9]), [L.keep, 22], ...L.camps.map((c) => [c, 7])];
  const path = [L.spawn, L.camp, L.stones[0], L.camps[0], L.stones[2], L.keep, L.camps[3], L.stones[1], L.camps[1], L.camp];
  const distPath = (x, z) => { let m = 1e9; for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1]; const dx = b.x - a.x, dz = b.z - a.z; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz))); m = Math.min(m, Math.hypot(x - a.x - dx * t, z - a.z - dz * t)); } return m; };
  const hf = heights(S, S, (x, z) => {
    let h = 10 + fbm2(x * 0.022, z * 0.022, seed) * 18 + noise2(x * 0.08, z * 0.08, seed + 3) * 1.5;
    for (const [c, r] of flats) { const d = Math.hypot(x - c.x, z - c.z); if (d < r + 10) { const t = Math.max(0, Math.min(1, (d - r) / 10)); const s = t * t * (3 - 2 * t); h = h * s + 16 * (1 - s); } }
    const edge = Math.min(x, z, S - x, S - z); if (edge < 10) h += (10 - edge) * 1.2;
    return h;
  });
  W.setTerrain(hf, (x, z, h, ny, out) => {
    const n = fbm2(x * 0.05, z * 0.05, 21);
    out.setHex(0x7a8a3a).lerp(c2.setHex(0xb0903a), n).lerp(c2.setHex(0xa05a2a), Math.max(0, noise2(x * 0.03, z * 0.03, 22) - 0.6) * 1.5);
    if (distPath(x, z) < 2.2) out.lerp(c2.setHex(0x8a7050), 0.75);
    if (h < 12.8) out.lerp(c2.setHex(0xc8b080), 0.8);
    if (ny < 0.72) out.lerp(c2.setHex(0x7a7470), Math.min(1, (0.72 - ny) * 4));
  });
  W.waterLevel = 12.3; W.waterColor = 0x2a5a6a;
  const top = (x, z) => W.terrainAt(x, z);
  for (const k of ['spawn', 'camp', 'keep', 'grove']) L[k].y = top(L[k].x, L[k].z);
  L.stones.forEach((s) => (s.y = top(s.x, s.z))); L.camps.forEach((s) => (s.y = top(s.x, s.z)));
  const nearPOI = (x, z, r) => flats.some(([c, rr]) => Math.hypot(x - c.x, z - c.z) < rr + r) || distPath(x, z) < 3;
  const P = [];
  for (let i = 0; i < 520; i++) {
    const x = R.range(3, S - 4), z = R.range(3, S - 4);
    if (nearPOI(x, z, 3) || noise2(x * 0.05, z * 0.05, seed + 9) < 0.33) continue;
    const y = top(x, z); if (y < 13) continue;
    const kind = R.chance(0.14) ? 'pine' : 'tree';
    P.push({ type: kind, v: R.int(0, 4), x, y: y - 0.2, z, s: R.range(0.85, 1.35) }); blocker(W, B, x, y, z, 3);
  }
  for (let i = 0; i < 28; i++) { const a = R.next() * Math.PI * 2, d = R.range(9, 24); const x = L.grove.x + Math.cos(a) * d, z = L.grove.z + Math.sin(a) * d; const y = top(x, z); P.push({ type: 'mushroom', v: R.int(0, 1), x, y, z, s: R.range(0.8, 1.6) }); blocker(W, B, x, y, z, 2); }
  for (let i = 0; i < 160; i++) { const x = R.range(4, S - 4), z = R.range(4, S - 4); const y = top(x, z); if (y < 12.6 || nearPOI(x, z, 1)) continue; const t = R.next(); P.push({ type: t < 0.35 ? 'rock' : t < 0.75 ? 'bush' : 'deadtree', v: R.int(0, 2), x, y: y - 0.1, z, s: R.range(0.6, 1.6) }); if (t < 0.35) blocker(W, B, x, y, z, 1); }
  for (let i = 0; i < 2600; i++) { const x = R.range(2, S - 2), z = R.range(2, S - 2); const y = top(x, z); if (y < 12.8) continue; P.push({ type: R.chance(0.9) ? 'grass' : 'flower', v: R.int(0, 3), x, y, z, s: R.range(0.8, 1.4) }); }
  // ley-stones: a ring of standing stones around a corrupted monolith
  L.stoneBlocks = [];
  for (const s of L.stones) {
    box(W, s.x - 3, Math.floor(s.y) - 1, s.z - 3, s.x + 3, Math.floor(s.y) - 1, s.z + 3, B.cobble);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; column(W, Math.round(s.x + Math.cos(a) * 4), Math.round(s.z + Math.sin(a) * 4), Math.floor(s.y) - 1, Math.floor(s.y) + 2 + (i % 2), B.brick); }
    const blocks = []; for (let y = 0; y < 5; y++) { W.set(s.x, Math.floor(s.y) + y, s.z, B.leycorrupt); blocks.push([s.x, Math.floor(s.y) + y, s.z]); }
    L.stoneBlocks.push(blocks);
  }
  // ranger camp
  P.push({ type: 'campfire', x: L.camp.x + 0.5, y: L.camp.y, z: L.camp.z + 0.5 });
  for (const [dx, dz, v] of [[-5, 0, 0], [4, 3, 1], [-2, 5, 0]]) { P.push({ type: 'tent', v, x: L.camp.x + dx, y: top(L.camp.x + dx, L.camp.z + dz), z: L.camp.z + dz }); blocker(W, B, L.camp.x + dx, top(L.camp.x + dx, L.camp.z + dz), L.camp.z + dz, 2); }
  // enemy camps
  for (const k of L.camps) { P.push({ type: 'campfire', x: k.x, y: k.y, z: k.z }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; P.push({ type: 'stake', x: k.x + Math.cos(a) * 5, y: top(k.x + Math.cos(a) * 5, k.z + Math.sin(a) * 5), z: k.z + Math.sin(a) * 5 }); } P.push({ type: 'tent', v: 1, x: k.x + 3, y: k.y, z: k.z - 3 }); }
  // the Hollow Keep
  const K = L.keep, kx0 = K.x - 16, kx1 = K.x + 16, kz0 = K.z - 16, kz1 = K.z + 16, ky = Math.floor(K.y);
  box(W, kx0, ky - 1, kz0, kx1, ky - 1, kz1, B.cobble);
  for (let y = ky; y < ky + 9; y++) for (let z = kz0; z <= kz1; z++) for (let x = kx0; x <= kx1; x++) if (x === kx0 || x === kx1 || z === kz0 || z === kz1) W.set(x, y, z, y === ky + 8 && (x + z) % 2 ? 0 : B.brick);
  for (const [tx, tz] of [[kx0, kz0], [kx1, kz0], [kx0, kz1], [kx1, kz1]]) { box(W, tx - 2, ky, tz - 2, tx + 2, ky + 12, tz + 2, B.brick); box(W, tx - 3, ky + 12, tz - 3, tx + 3, ky + 12, tz + 3, B.darkstone); }
  box(W, kx0, ky, K.z - 2, kx0, ky + 4, K.z + 2, 0);
  box(W, K.x + 8, ky, K.z - 3, K.x + 12, ky + 1, K.z + 3, B.darkstone); box(W, K.x + 11, ky + 2, K.z - 1, K.x + 11, ky + 5, K.z + 1, B.gold);
  for (let x = kx0 + 4; x < kx1; x += 8) { P.push({ type: 'banner', v: 0, x, y: ky + 3, z: kz0 + 1.2, r: 0 }); P.push({ type: 'banner', v: 0, x, y: ky + 3, z: kz1 - 1.2, r: Math.PI }); }
  for (const [tx, tz] of [[kx0 + 1.5, K.z - 3], [kx0 + 1.5, K.z + 3], [K.x + 7, K.z - 4], [K.x + 7, K.z + 4]]) P.push({ type: 'torch', x: tx, y: ky + 1.5, z: tz });
  L.bossPos = V(K.x + 6, ky, K.z); L.gate = V(kx0 - 4, top(kx0 - 4, K.z), K.z);
  W.props = P;
  L.protect = () => true;
  L.collect = [];
  for (let i = 0; i < 5; i++) { let x, z; do { x = R.int(10, S - 10); z = R.int(10, S - 10); } while (nearPOI(x, z, 2) || top(x, z) <= 13); L.collect.push(V(x + 0.5, top(x, z), z + 0.5)); }
  L.enemySpots = [];
  for (let i = 0; i < 22; i++) { let x, z; do { x = R.int(12, S - 12); z = R.int(12, S - 12); } while (Math.hypot(x - L.spawn.x, z - L.spawn.z) < 30 || top(x, z) <= 13); L.enemySpots.push(V(x, top(x, z), z)); }
  return { W, layout: L };
}

// ── NEON MERIDIAN: an art-deco city of champions under a storm-lit night ──
export function genNeon(seed = 2) {
  const { p, B } = PALETTES.neon; const R = new Rng(seed);
  const S = 152, H = 72, G0 = 5;
  const W = new VoxelWorld(S, H, S, p);
  box(W, 0, 0, 0, S - 1, G0 - 1, S - 1, B.street);
  const cell = 24, street = 8;
  const L = { buildings: [], pads: [], erasers: [], civilians: [], enemySpots: [], camps: [], collect: [] };
  const P = [];
  const plaza = [2, 2];
  for (let cz = 0; cz < 6; cz++) for (let cx = 0; cx < 6; cx++) {
    const x0 = cx * cell + street / 2 + 2, z0 = cz * cell + street / 2 + 2, x1 = x0 + cell - street - 1, z1 = z0 + cell - street - 1;
    box(W, x0 - 2, G0 - 1, z0 - 2, x1 + 2, G0 - 1, z1 + 2, B.walk);
    if ((cx === plaza[0] || cx === plaza[0] + 1) && (cz === plaza[1] || cz === plaza[1] + 1)) continue;
    if (cx === 0 && cz === 0) { for (let i = 0; i < 5; i++) P.push({ type: 'tree', v: 3, x: R.range(x0 + 2, x1 - 2), y: G0, z: R.range(z0 + 2, z1 - 2), s: 0.8 }); continue; }
    if (R.chance(0.12)) { for (let i = 0; i < 4; i++) { const x = R.range(x0 + 2, x1 - 2), z = R.range(z0 + 2, z1 - 2); P.push({ type: 'tree', v: 3, x, y: G0, z, s: 0.9 }); blocker(W, B, x, G0, z, 3); } L.camps.push(V((x0 + x1) / 2, G0, (z0 + z1) / 2)); continue; }
    const h = R.int(10, 44) + (Math.abs(cx - 2.5) < 2 && Math.abs(cz - 2.5) < 2 ? 8 : 0);
    const wall = R.pick([B.marble, B.marble, B.stoneA, B.stoneB, B.stoneC]);
    const win = R.chance(0.7) ? B.win : B.winB;
    for (let y = G0; y < G0 + h; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (!edge) { if (y === G0 + h - 1) W.set(x, y, z, B.roof); continue; }
      const along = (x === x0 || x === x1) ? z : x; const floor = (y - G0) % 4;
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
      if (corner) { W.set(x, y, z, wall); continue; }
      if ((y - G0) % 12 === 0 && y > G0) { W.set(x, y, z, B.gold); continue; }
      const isWin = floor >= 1 && floor <= 2 && along % 3 !== 0 && y < G0 + h - 1 && y > G0;
      W.set(x, y, z, isWin ? (hash3(x, y, z) < 0.3 ? B.winOff : win) : wall);
    }
    for (let z = z0 - 1; z <= z1 + 1; z++) for (let x = x0 - 1; x <= x1 + 1; x++) if (x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1) W.set(x, G0 + h, z, B.gold);
    const sign = R.pick([B.neonP, B.neonC, B.neonY, B.neonG]); const sy = G0 + R.int(5, Math.max(6, h - 4));
    box(W, x0 + 3, sy, z0 - 1, x1 - 3, sy, z0 - 1, sign);
    const roof = V((x0 + x1) / 2 + 0.5, G0 + h, (z0 + z1) / 2 + 0.5);
    L.buildings.push({ x0, z0, x1, z1, h, roof });
    const px = (x0 + x1) >> 1, pz = z0 - 2; box(W, px - 1, G0 - 1, pz - 1, px + 1, G0 - 1, pz, B.pad);
    L.pads.push({ pos: V(px + 0.5, G0, pz), target: roof.clone(), h });
  }
  const pc = V(plaza[0] * cell + cell, G0, plaza[1] * cell + cell);
  box(W, pc.x - 20, G0 - 1, pc.z - 20, pc.x + 20, G0 - 1, pc.z + 20, B.walk);
  for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; W.set(Math.round(pc.x + Math.cos(t) * 12), G0 - 1, Math.round(pc.z + Math.sin(t) * 12), B.line); }
  P.push({ type: 'statue', x: pc.x, y: G0, z: pc.z, s: 1.6, r: Math.PI }); box(W, pc.x - 2, G0, pc.z - 2, pc.x + 1, G0 + 1, pc.z + 1, B.inv);
  for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; P.push({ type: 'pillar', x: pc.x + Math.cos(t) * 17, y: G0, z: pc.z + Math.sin(t) * 17, s: 0.8 }); blocker(W, B, pc.x + Math.cos(t) * 17, G0, pc.z + Math.sin(t) * 17, 3); }
  L.bossPos = pc.clone().add(V(0, 0, 8)); L.plaza = pc;
  for (let i = 0; i < S; i += 3) for (let k = 0; k < 7; k++) { W.set(i, G0 - 1, k * cell + 2, B.line); W.set(k * cell + 2, G0 - 1, i, B.line); }
  for (let i = 8; i < S; i += 14) for (let k = 0; k < 7; k++) { const x = k * cell + 5, z = i; if (!W.get(x, G0, z)) P.push({ type: 'lamp', v: 1, x, y: G0, z }); }
  L.spawn = V(12, G0, 12);
  const tall = L.buildings.filter((b) => b.h > 18).sort(() => R.next() - 0.5).slice(0, 3);
  for (const b of tall) { const r = b.roof; box(W, r.x - 1, r.y + 1, r.z - 1, r.x, r.y + 3, r.z, B.eraser); L.erasers.push({ pos: V(r.x, r.y + 1, r.z), building: b }); }
  for (let i = 0; i < 4; i++) { const k = R.int(1, 5); L.civilians.push(V(k * cell + 2 + R.range(-1, 1), G0, R.int(20, S - 20))); }
  for (let i = 0; i < 24; i++) { const k = R.int(0, 6) * cell + 2; const t = R.int(10, S - 10); const pos = R.chance(0.5) ? V(t, G0, k) : V(k, G0, t); if (pos.distanceTo(L.spawn) > 30) L.enemySpots.push(pos); }
  for (const b of L.buildings) if (R.chance(0.3)) L.enemySpots.push(b.roof.clone().add(V(0, 1, 0)));
  for (let i = 0; i < 5; i++) { const b = R.pick(L.buildings); L.collect.push(b.roof.clone().add(V(R.range(-3, 3), 1, R.range(-3, 3)))); }
  if (L.camps.length < 3) L.camps.push(V(pc.x - 30, G0, pc.z - 30), V(pc.x + 30, G0, pc.z - 30), V(pc.x - 30, G0, pc.z + 30));
  W.props = P;
  L.protect = () => true;
  return { W, layout: L };
}

// ── THE ASTERION: a derelict star-vessel, its halls cracked open to the void ──
export function genAsterion(seed = 3) {
  const { p, B } = PALETTES.asterion; const R = new Rng(seed);
  const N = 5, RS = 22, S = N * RS + 8, H = 36, F = 6;
  const W = new VoxelWorld(S, H, S, p);
  const L = { rooms: [], terminals: [], enemySpots: [], camps: [], collect: [], lowG: [] };
  const P = [];
  const off = 4;
  for (let z = off - 2; z < S - off + 2; z++) for (let x = off - 2; x < S - off + 2; x++) { W.set(x, F - 2, z, B.hull); W.set(x, F - 1, z, B.floor); }
  const wallH = 7;
  const open = new Set(); const seen = new Set(['0,0']); const stack = [[0, 0]];
  while (stack.length) {
    const [cx, cz] = stack[stack.length - 1];
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [cx + dx, cz + dz]).filter(([x, z]) => x >= 0 && z >= 0 && x < N && z < N && !seen.has(x + ',' + z));
    if (!nb.length) { stack.pop(); continue; }
    const [nx, nz] = R.pick(nb); seen.add(nx + ',' + nz); open.add([cx, cz, nx, nz].join(',')); open.add([nx, nz, cx, cz].join(',')); stack.push([nx, nz]);
  }
  for (let i = 0; i < 8; i++) { const cx = R.int(0, N - 2), cz = R.int(0, N - 1); open.add([cx, cz, cx + 1, cz].join(',')); open.add([cx + 1, cz, cx, cz].join(',')); }
  for (let cz = 0; cz < N; cz++) for (let cx = 0; cx < N; cx++) {
    const x0 = off + cx * RS, z0 = off + cz * RS, x1 = x0 + RS, z1 = z0 + RS;
    const breached = R.chance(0.22) && !(cx === 0 && cz === 0) && !(cx === N - 1 && cz === N - 1);
    const room = { cx, cz, x0, z0, x1, z1, c: V((x0 + x1) / 2, F, (z0 + z1) / 2), breached };
    L.rooms.push(room);
    for (let y = F; y < F + wallH; y++) {
      const m = y === F + 1 ? B.stripe : y === F + wallH - 1 ? B.light : (y === F ? B.panel : B.hull);
      for (let x = x0; x <= x1; x++) { W.set(x, y, z0, (x % 2 || y !== F + wallH - 1) ? m : B.hull); W.set(x, y, z1, (x % 2 || y !== F + wallH - 1) ? m : B.hull); }
      for (let z = z0; z <= z1; z++) { W.set(x0, y, z, m); W.set(x1, y, z, m); }
    }
    if (breached) { for (let i = 0; i < 40; i++) { const x = R.int(x0, x1), z = R.int(z0, z1); for (let y = F; y < F + wallH; y++) W.set(x, y, z, 0); } L.lowG.push(room); }
    for (let i = 0; i < 4; i++) P.push({ type: 'crate', v: R.int(0, 1), x: R.range(x0 + 3, x1 - 3), y: F, z: R.range(z0 + 3, z1 - 3), s: R.range(0.9, 1.4) });
    P.push({ type: 'hull', x: x0 + 2, y: F, z: (z0 + z1) / 2, r: Math.PI / 2 });
    if (R.chance(0.35)) P.push({ type: 'bush', v: 0, x: R.range(x0 + 4, x1 - 4), y: F, z: R.range(z0 + 4, z1 - 4) });
    if (R.chance(0.4)) for (let x = x0 + 1; x < x1; x++) W.set(x, F + 4, z0 + 1, B.pipe);
  }
  L.rooms.forEach(() => {});
  for (const pr of P) if (pr.type === 'crate') blocker(W, B, pr.x, F, pr.z, 2);
  for (const k of open) {
    const [ax, az, bx, bz] = k.split(',').map(Number); if (bx < ax || bz < az) continue;
    if (bx > ax) { const x = off + bx * RS, zc = off + az * RS + RS / 2; box(W, x, F, zc - 2, x, F + 4, zc + 2, 0); }
    else { const z = off + bz * RS, xc = off + ax * RS + RS / 2; box(W, xc - 2, F, z, xc + 2, F + 4, z, 0); }
  }
  const far = L.rooms.filter((r) => r.cx + r.cz >= 3 && !(r.cx === N - 1 && r.cz === N - 1)).sort(() => R.next() - 0.5).slice(0, 3);
  for (const r of far) { const t = r.c.clone(); box(W, t.x - 1, F, t.z - 1, t.x + 1, F, t.z + 1, B.stripe); box(W, t.x, F, t.z, t.x, F + 2, t.z, B.terminalOff); L.terminals.push({ pos: V(t.x + 0.5, F, t.z + 1.8), block: [t.x, F + 2, t.z], room: r }); }
  const core = L.rooms.find((r) => r.cx === N - 1 && r.cz === N - 1);
  L.coreDoor = [];
  for (let z = core.z0 + 1; z < core.z1; z++) for (let y = F; y <= F + 4; y++) if (W.get(core.x0, y, z) === 0) { W.set(core.x0, y, z, B.coreDoor); L.coreDoor.push([core.x0, y, z]); }
  for (let x = core.x0 + 1; x < core.x1; x++) for (let y = F; y <= F + 4; y++) if (W.get(x, y, core.z0) === 0) { W.set(x, y, core.z0, B.coreDoor); L.coreDoor.push([x, y, core.z0]); }
  const cz2 = core.z0 + (RS >> 1), cx2 = core.x0 + (RS >> 1);
  box(W, cx2 - 1, F, cz2 - 1, cx2 + 1, F + 1, cz2 + 1, B.hull); column(W, cx2, cz2, F + 2, F + 10, B.core);
  L.coreRoom = core; L.bossPos = V(cx2 + 0.5, F + 2, cz2 + 0.5);
  L.spawn = V(off + RS / 2, F, off + RS / 2);
  for (const r of L.rooms) { if ((r.cx === 0 && r.cz === 0) || r === core) continue; for (let i = 0; i < 2; i++) L.enemySpots.push(r.c.clone().add(V(R.range(-6, 6), 0, R.range(-6, 6)))); }
  L.camps = L.rooms.filter((r) => r.cx + r.cz >= 2 && r !== core).sort(() => R.next() - 0.5).slice(0, 3).map((r) => r.c.clone());
  for (let i = 0; i < 5; i++) { const r = R.pick(L.rooms); L.collect.push(r.c.clone().add(V(R.range(-7, 7), 0, R.range(-7, 7)))); }
  // debris floating in the void around the ship
  for (let i = 0; i < 30; i++) P.push({ type: 'floatrock', v: i % 3, x: R.range(-40, S + 40), y: R.range(-10, 30), z: R.range(-40, S + 40), s: R.range(1, 4) });
  W.props = P;
  L.protect = () => true;
  return { W, layout: L };
}

// ── RIFT REALMS: torn places where worlds bleed together ──
export function genRift(seed = 4) {
  const R = new Rng(seed); const pal = riftPalette(R); const { p, B } = pal; const T = pal.theme;
  const S = 128, H = 48;
  const W = new VoxelWorld(S, H, S, p);
  const L = { theme: T, tears: [], enemySpots: [], camps: [], collect: [] };
  const sq = R.range(0.02, 0.04), amp = R.range(8, 18);
  const hf = heights(S, S, (x, z) => {
    const d = Math.hypot(x - S / 2, z - S / 2);
    let h = 10 + fbm2(x * sq, z * sq, seed) * amp;
    if (d > S / 2 - 8) h -= (d - S / 2 + 8) * 2.5;
    if (d < 10) h = h * (d / 10) + 14 * (1 - d / 10);
    return h < 1 ? NaN : h;
  });
  W.setTerrain(hf, (x, z, h, ny, out) => { out.setHex(T.low).lerp(c2.setHex(T.high), Math.min(1, Math.max(0, (h - 8) / 16))).lerp(c2.setHex(T.rock), ny < 0.75 ? Math.min(1, (0.75 - ny) * 4) : 0); });
  const top = (x, z) => W.terrainAt(x, z);
  const P = [];
  for (let i = 0; i < 180; i++) { const x = R.range(8, S - 8), z = R.range(8, S - 8), y = top(x, z); if (y === -Infinity || Math.hypot(x - S / 2, z - S / 2) < 12) continue; P.push({ type: T.trees, v: R.int(0, 4), x, y: y - 0.2, z, s: R.range(0.8, 1.4) }); blocker(W, B, x, y, z, 3); }
  for (let i = 0; i < 60; i++) { const x = R.range(8, S - 8), z = R.range(8, S - 8), y = top(x, z); if (y === -Infinity) continue; P.push({ type: 'crystal', v: T.crystal, x, y, z, s: R.range(0.8, 2) }); }
  for (let i = 0; i < 90; i++) { const x = R.range(8, S - 8), z = R.range(8, S - 8), y = top(x, z); if (y === -Infinity) continue; P.push({ type: 'rock', v: R.int(0, 2), x, y, z, s: R.range(0.6, 2) }); }
  for (let i = 0; i < 18; i++) P.push({ type: 'floatrock', v: i % 3, x: R.range(0, S), y: R.range(28, 44), z: R.range(0, S), s: R.range(2, 5) });
  for (let i = 0; i < 1500; i++) { const x = R.range(4, S - 4), z = R.range(4, S - 4), y = top(x, z); if (y === -Infinity) continue; P.push({ type: 'grass', v: i % 2, x, y, z }); }
  // ruins
  for (let i = 0; i < 14; i++) {
    const x = R.int(12, S - 12), z = R.int(12, S - 12); const y = top(x, z); if (y === -Infinity) continue; const yb = Math.floor(y) - 1;
    const len = R.int(3, 8), hgt = R.int(2, 6); const alongX = R.chance(0.5);
    for (let k = 0; k < len; k++) column(W, alongX ? x + k : x, alongX ? z : z + k, yb, yb + hgt - (k % 3 === 2 ? 2 : 0), B.ruin);
  }
  const pts = [V(S * 0.25, 0, S * 0.3), V(S * 0.72, 0, S * 0.28), V(S * 0.5, 0, S * 0.75)];
  for (const t of pts) { t.x = Math.round(t.x); t.z = Math.round(t.z); t.y = top(t.x, t.z); if (t.y === -Infinity) t.y = 10; const yb = Math.floor(t.y); box(W, t.x - 3, yb - 1, t.z - 3, t.x + 3, yb - 1, t.z + 3, B.stone); const blocks = []; for (let y = 0; y < 6; y++) { W.set(t.x, yb + y, t.z, B.tear); blocks.push([t.x, yb + y, t.z]); } L.tears.push({ pos: V(t.x, yb, t.z), blocks }); }
  L.spawn = V(S / 2, top(S / 2, S / 2), S / 2);
  L.bossPos = V(S / 2, 0, S / 2 + 22); L.bossPos.y = top(L.bossPos.x, L.bossPos.z); if (L.bossPos.y === -Infinity) L.bossPos.y = 12;
  for (let i = 0; i < 22; i++) { const x = R.int(14, S - 14), z = R.int(14, S - 14); const y = top(x, z); if (y > 3 && Math.hypot(x - S / 2, z - S / 2) > 18) L.enemySpots.push(V(x, y, z)); }
  L.camps = L.enemySpots.slice(0, 3).map((v) => v.clone());
  W.props = P;
  L.protect = () => true;
  return { W, layout: L };
}

// ── THE LOOM: the finale, a marble disc where every thread meets ──
export function genLoom() {
  const { p, B } = PALETTES.loom;
  const S = 100, H = 44, C = 50;
  const W = new VoxelWorld(S, H, S, p);
  const P = [];
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - C, z - C); if (d > 42) continue;
    for (let y = 5; y < 8; y++) W.set(x, y, z, B.grey);
    const ring = Math.floor(d) % 10 === 0 && d > 5; const spoke = Math.abs(((Math.atan2(z - C, x - C) * 8 / Math.PI) % 1 + 1) % 1 - 0.5) > 0.47;
    W.set(x, 8, z, ring ? B.thread1 : spoke ? B.gold : B.white);
  }
  const frags = [[B.grass, 'tree'], [B.street, 'lamp'], [B.hull, 'hull']];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2; const x = Math.round(C + Math.cos(a) * 36), z = Math.round(C + Math.sin(a) * 36);
    const [g, prop] = frags[i % 3]; box(W, x - 2, 9, z - 2, x + 2, 9, z + 2, g); P.push({ type: prop, v: 3, x: x + 0.5, y: 10, z: z + 0.5 });
  }
  const th = [B.thread1, B.thread2, B.thread3, B.thread4];
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; const x = Math.round(C + Math.cos(a) * 22), z = Math.round(C + Math.sin(a) * 22); column(W, x, z, 9, 30, th[i]); P.push({ type: 'pillar', x: x + 0.5, y: 9, z: z + 0.5, s: 0.6 }); }
  for (let i = 0; i < 24; i++) P.push({ type: 'floatrock', v: i % 3, x: C + Math.cos(i) * (50 + (i % 5) * 8), y: 12 + (i % 7) * 4, z: C + Math.sin(i) * (50 + (i % 5) * 8), s: 2 + (i % 4) });
  W.props = P;
  return { W, layout: { spawn: V(C, 9, C - 30), bossPos: V(C, 9, C + 4), center: V(C, 9, C), enemySpots: [], camps: [], collect: [], protect: () => true } };
}

// ── THE CELLAR: tutorial space beneath the Tavern ──
export function genCellar() {
  const { p, B } = PALETTES.tavern;
  const S = 36, H = 12, F = 2;
  const W = new VoxelWorld(S, H, S, p);
  box(W, 2, 0, 2, S - 3, F - 1, S - 3, B.cobble);
  hollow(W, 2, F, 2, S - 3, F + 5, S - 3, B.stone);
  for (let x = 6; x < S - 4; x += 6) { column(W, x, 3, F, F + 5, B.beam); column(W, x, S - 4, F, F + 5, B.beam); }
  // a low wall splits the room into a training half and a fighting half, with an opening
  for (let x = 3; x < S - 3; x++) if (x < 15 || x > 20) { W.set(x, F, 18, B.stone); W.set(x, F + 1, 18, B.stone); }
  const P = [];
  for (let i = 0; i < 8; i++) P.push({ type: 'barrel', x: 4 + (i % 2) * 1.2, y: F, z: 5 + i * 1.3, r: 0 });
  for (const [x, z] of [[4, 4], [S - 5, 4], [4, S - 5], [S - 5, S - 5], [17, 17], [S / 2, 8], [S / 2, S - 8]]) P.push({ type: 'torch', x, y: F + 3, z });
  for (let i = 0; i < 5; i++) P.push({ type: 'crate', v: i % 2, x: S - 6 - (i % 2), y: F, z: 6 + i * 1.6 });
  P.push({ type: 'bookshelf', x: 12, y: F, z: 3.3, r: 0 });
  W.props = P;
  const lights = [{ pos: V(10, F + 4, 10), color: 0xffa860, intensity: 22, dist: 20 }, { pos: V(26, F + 4, 10), color: 0xffa860, intensity: 22, dist: 20 }, { pos: V(18, F + 4, 27), color: 0xffa860, intensity: 26, dist: 22 }];
  return { W, layout: { spawn: V(9, F, 8), moveTo: V(26, F, 9), dummies: [V(12, F, 13), V(24, F, 13)], arena: V(18, F, 27), exitDoor: V(9.5, F, 4), lights, protect: () => true } };
}
