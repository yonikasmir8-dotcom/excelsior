// Procedural generators for every location. Each returns a layout of named points of interest.
import * as THREE from 'three';
import { VoxelWorld } from './voxel.js';
import { PALETTES, riftPalette } from './palettes.js';
import { Rng, fbm2, noise2, hash3 } from '../core/rng.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function blob(W, cx, cy, cz, r, v, onlyAir = true, jitter = 0.4) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let z = Math.floor(cz - r); z <= cz + r; z++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 1.2, z - cz) + hash3(x, y, z) * jitter * r;
        if (d <= r && (!onlyAir || !W.get(x, y, z))) W.set(x, y, z, v);
      }
}
function column(W, x, z, y0, y1, v) { for (let y = y0; y <= y1; y++) W.set(x, y, z, v); }
function box(W, x0, y0, z0, x1, y1, z1, v) { W.fill(x0, y0, z0, x1, y1, z1, v); }
function hollowBox(W, x0, y0, z0, x1, y1, z1, v) {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++)
    if (x === x0 || x === x1 || z === z0 || z === z1) W.set(x, y, z, v);
}

// ── TAVERN: the Hearth Between, floating in the void under a cosmic sky ──
export function genTavern() {
  const { p, B } = PALETTES.tavern;
  const W = new VoxelWorld(56, 26, 56, p);
  const cx = 28, cz = 28;
  // floating island
  for (let z = 0; z < 56; z++) for (let x = 0; x < 56; x++) {
    const d = Math.hypot(x - cx, z - cz); const r = 25 + noise2(x * 0.2, z * 0.2) * 3;
    if (d > r) continue;
    const depth = Math.floor((r - d) * 0.6 + noise2(x * 0.3, z * 0.3, 5) * 3);
    for (let y = Math.max(0, 4 - depth); y <= 4; y++) W.set(x, y, z, y === 4 ? B.grass : y > 2 ? B.dirt : B.voidrock);
  }
  // building footprint
  const x0 = 12, x1 = 44, z0 = 14, z1 = 40, fy = 5;
  box(W, x0, 4, z0, x1, 4, z1, B.plank);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if ((x + z) % 7 === 0) W.set(x, 4, z, B.darkplank);
  hollowBox(W, x0, fy, z0, x1, fy + 6, z1, B.plank);
  // stone lower wall + beams
  hollowBox(W, x0, fy, z0, x1, fy + 1, z1, B.stone);
  for (let x = x0; x <= x1; x += 4) { column(W, x, z0, fy, fy + 7, B.beam); column(W, x, z1, fy, fy + 7, B.beam); }
  for (let z = z0; z <= z1; z += 4) { column(W, x0, z, fy, fy + 7, B.beam); column(W, x1, z, fy, fy + 7, B.beam); }
  // windows
  for (let x = x0 + 2; x < x1; x += 4) { box(W, x, fy + 3, z0, x + 1, fy + 4, z0, B.glass); box(W, x, fy + 3, z1, x + 1, fy + 4, z1, B.glass); }
  // front door (south, z0) opening
  box(W, cx - 1, fy, z0, cx + 1, fy + 3, z0, 0);
  // mezzanine (second floor) along the north side with stairs
  box(W, x0 + 1, fy + 5, z1 - 7, x1 - 1, fy + 5, z1 - 1, B.darkplank);
  for (let x = x0 + 1; x < x1; x++) if (x % 2) W.set(x, fy + 6, z1 - 8, B.beam);
  for (let i = 0; i < 5; i++) box(W, x1 - 6 - i, fy, z1 - 8 - 0, x1 - 6 - i, fy + i, z1 - 8, B.darkplank);
  // bar counter (east side)
  box(W, x1 - 7, fy, z0 + 4, x1 - 7, fy + 1, z0 + 14, B.table); box(W, x1 - 7, fy + 1, z0 + 4, x1 - 7, fy + 1, z0 + 14, B.darkplank);
  for (let z = z0 + 3; z <= z0 + 15; z += 2) { W.set(x1 - 1, fy + 2, z, B.bottle); W.set(x1 - 1, fy + 3, z, B.bottle); }
  box(W, x1 - 1, fy, z0 + 3, x1 - 1, fy + 1, z0 + 15, B.barrel);
  // fireplace (west)
  box(W, x0, fy, cz - 3, x0 + 1, fy + 5, cz + 3, B.stone); box(W, x0 + 1, fy, cz - 1, x0 + 1, fy + 1, cz + 1, B.fire);
  // tables + rugs
  box(W, cx - 6, 4, cz - 4, cx + 2, 4, cz + 4, B.rug);
  for (const [tx, tz] of [[cx - 8, cz - 6], [cx - 2, cz - 6], [cx - 8, cz + 1], [cx - 2, cz + 1], [cx + 4, cz - 3]]) {
    box(W, tx, fy, tz, tx + 1, fy, tz + 1, B.table);
  }
  // stage (north-west under mezzanine)
  box(W, x0 + 2, fy, z1 - 6, x0 + 9, fy, z1 - 2, B.stage);
  // notice board (nemesis wanted wall) on the south wall inside
  box(W, cx + 5, fy + 2, z0 + 1, cx + 10, fy + 4, z0 + 1, B.board);
  // bookshelves (cartographer corner)
  box(W, x0 + 1, fy, z0 + 1, x0 + 5, fy + 3, z0 + 1, B.bookshelf);
  // lamps
  for (let x = x0 + 4; x < x1; x += 8) for (let z = z0 + 4; z < z1 - 8; z += 8) W.set(x, fy + 6, z, B.lamp);
  // realm doors on the west wall... placed outside on the island ring as standing portals
  const doors = {};
  const doorDefs = [['emberwood', B.doorE, cx - 16, cz + 16], ['neon', B.doorN, cx - 8, cz + 20], ['asterion', B.doorA, cx + 8, cz + 20], ['rift', B.doorR, cx + 16, cz + 16], ['loom', B.doorL, cx, cz + 22]];
  // doors live inside along the north wall instead — the "Hall of Doors"
  const hall = [['emberwood', B.doorE, x0 + 12], ['neon', B.doorN, x0 + 16], ['asterion', B.doorA, x0 + 20], ['rift', B.doorR, x0 + 24], ['loom', B.doorL, x0 + 28]];
  for (const [k, b, dx] of hall) {
    box(W, dx - 1, fy, z1, dx + 1, fy + 3, z1, B.beam); box(W, dx, fy, z1, dx, fy + 2, z1, b);
    doors[k] = V(dx + 0.5, fy, z1 - 1.5);
  }
  // outside: a little garden and a void-edge railing
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; const x = Math.round(cx + Math.cos(a) * 22), z = Math.round(cz + Math.sin(a) * 22); if (W.get(x, 4, z)) W.set(x, 5, z, B.lamp); }
  for (const [tx, tz] of [[6, 20], [48, 36], [20, 48], [44, 8]]) { if (W.get(tx, 4, tz)) { column(W, tx, tz, 5, 9, B.beam); blob(W, tx, 11, tz, 2.5, B.leaf); } }
  return { W, layout: { spawn: V(cx + 0.5, fy, z0 + 6), doors, bar: V(x1 - 4, fy, z0 + 9), fire: V(x0 + 4, fy, cz), stage: V(x0 + 5, fy + 1, z1 - 4), board: V(cx + 7.5, fy, z0 + 2.5), shelves: V(x0 + 3, fy, z0 + 3), tables: [V(cx - 7, fy, cz - 5), V(cx - 1, fy, cz - 5), V(cx - 7, fy, cz + 2), V(cx - 1, fy, cz + 2), V(cx + 5, fy, cz - 2)], mezz: V(cx, fy + 6, z1 - 4), cellar: V(x0 + 6, fy, z1 - 12), garden: V(cx, 5, 8), center: V(cx, fy, cz) } };
}

// ── EMBERWOOD REACH: autumn forests, ley-stones, the Hollow Keep ──
export function genEmberwood(seed = 1) {
  const { p, B } = PALETTES.emberwood; const R = new Rng(seed);
  const S = 160, H = 48;
  const W = new VoxelWorld(S, H, S, p);
  const L = {
    spawn: V(18, 0, 18), camp: V(30, 0, 34), stones: [V(78, 0, 36), V(38, 0, 112), V(112, 0, 84)],
    keep: V(132, 0, 132), gate: V(118, 0, 132), camps: [V(84, 0, 64), V(58, 0, 84), V(120, 0, 40), V(80, 0, 128)], grove: V(38, 0, 112),
  };
  const flats = [[L.spawn, 8], [L.camp, 9], ...L.stones.map((s) => [s, 9]), [L.keep, 22], ...L.camps.map((c) => [c, 7])];
  const hgt = (x, z) => {
    let h = 10 + fbm2(x * 0.025, z * 0.025, seed) * 16 + noise2(x * 0.1, z * 0.1, seed + 3) * 2;
    for (const [c, r] of flats) { const d = Math.hypot(x - c.x, z - c.z); if (d < r + 8) { const t = Math.max(0, Math.min(1, (d - r) / 8)); h = h * t + 16 * (1 - t); } }
    return Math.floor(h);
  };
  const heights = new Int16Array(S * S);
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const h = hgt(x, z); heights[x + z * S] = h;
    W.set(x, 0, z, B.bedrock);
    for (let y = 1; y < h; y++) W.set(x, y, z, y < h - 4 ? B.stone : B.dirt);
    const shore = h <= 13;
    W.set(x, h, z, shore ? B.sand : B.grass);
    for (let y = h + 1; y <= 12; y++) W.set(x, y, z, B.water);
  }
  const top = (x, z) => heights[Math.floor(x) + Math.floor(z) * S] + 1;
  for (const k of ['spawn', 'camp', 'keep', 'gate', 'grove']) L[k].y = top(L[k].x, L[k].z);
  L.stones.forEach((s) => (s.y = top(s.x, s.z))); L.camps.forEach((s) => (s.y = top(s.x, s.z)));
  const nearPOI = (x, z, r) => flats.some(([c, rr]) => Math.hypot(x - c.x, z - c.z) < rr + r);
  // trees
  for (let i = 0; i < 700; i++) {
    const x = R.int(3, S - 4), z = R.int(3, S - 4);
    if (nearPOI(x, z, 3) || noise2(x * 0.05, z * 0.05, seed + 9) < 0.35) continue;
    const y = top(x, z); if (y <= 13) continue;
    const th = R.int(4, 7); column(W, x, z, y, y + th, B.log);
    const lc = R.pick([B.leafO, B.leafO, B.leafR, B.leafY, B.leafG]);
    blob(W, x, y + th + 1, z, R.range(2, 3.4), lc);
  }
  // glowing mushroom grove around stone 2
  for (let i = 0; i < 26; i++) {
    const a = R.next() * Math.PI * 2, d = R.range(8, 22); const x = Math.round(L.grove.x + Math.cos(a) * d), z = Math.round(L.grove.z + Math.sin(a) * d);
    const y = top(x, z); const h = R.int(3, 8); column(W, x, z, y, y + h, B.mushstem);
    const r = R.int(2, 3), cap = R.chance(0.5) ? B.mushcap : B.mushcap2;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dz * dz <= r * r + 1) { W.set(x + dx, y + h, z + dz, cap); if (Math.abs(dx) === r || Math.abs(dz) === r) W.set(x + dx, y + h - 1, z + dz, cap); }
  }
  // flowers + rocks
  for (let i = 0; i < 400; i++) { const x = R.int(1, S - 2), z = R.int(1, S - 2); const y = top(x, z); if (y > 13 && !W.get(x, y, z)) W.set(x, y, z, R.chance(0.7) ? B.flower : B.stone); }
  // ley stones (corrupted until cleansed)
  L.stoneBlocks = [];
  for (const s of L.stones) {
    box(W, s.x - 3, s.y - 1, s.z - 3, s.x + 3, s.y - 1, s.z + 3, B.darkstone);
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) column(W, s.x + dx, s.z + dz, s.y, s.y + 2, B.stone);
    const blocks = []; for (let y = 0; y < 5; y++) { W.set(s.x, s.y + y, s.z, B.leycorrupt); blocks.push([s.x, s.y + y, s.z]); }
    L.stoneBlocks.push(blocks);
  }
  // ranger camp
  const c = L.camp; box(W, c.x - 1, c.y - 1, c.z - 1, c.x + 1, c.y - 1, c.z + 1, B.stone); W.set(c.x, c.y, c.z, B.fire);
  for (const [dx, dz] of [[-5, 0], [4, 3]]) { box(W, c.x + dx - 1, c.y, c.z + dz - 1, c.x + dx + 1, c.y + 1, c.z + dz + 1, B.tent); W.set(c.x + dx, c.y + 2, c.z + dz, B.tent); }
  // enemy camps
  for (const k of L.camps) { W.set(k.x, k.y, k.z, B.fire); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; column(W, Math.round(k.x + Math.cos(a) * 5), Math.round(k.z + Math.sin(a) * 5), k.y, k.y + 2, B.log); W.set(Math.round(k.x + Math.cos(a) * 5), k.y + 3, Math.round(k.z + Math.sin(a) * 5), B.bone); } }
  // the Hollow Keep
  const K = L.keep, kx0 = K.x - 16, kx1 = K.x + 16, kz0 = K.z - 16, kz1 = K.z + 16, ky = K.y;
  box(W, kx0, ky - 1, kz0, kx1, ky - 1, kz1, B.darkstone);
  for (let y = ky; y < ky + 9; y++) for (let z = kz0; z <= kz1; z++) for (let x = kx0; x <= kx1; x++) if (x === kx0 || x === kx1 || z === kz0 || z === kz1) W.set(x, y, z, y === ky + 8 && (x + z) % 2 ? 0 : B.brick);
  for (const [tx, tz] of [[kx0, kz0], [kx1, kz0], [kx0, kz1], [kx1, kz1]]) { box(W, tx - 2, ky, tz - 2, tx + 2, ky + 12, tz + 2, B.brick); box(W, tx - 2, ky + 13, tz - 2, tx + 2, ky + 13, tz + 2, B.banner); }
  box(W, kx0, ky, K.z - 2, kx0, ky + 4, K.z + 2, 0); // gate
  box(W, K.x + 8, ky, K.z - 3, K.x + 12, ky + 1, K.z + 3, B.darkstone); box(W, K.x + 11, ky + 2, K.z - 1, K.x + 11, ky + 5, K.z + 1, B.gold); // throne
  for (let x = kx0 + 4; x < kx1; x += 8) { column(W, x, kz0 + 1, ky + 2, ky + 6, B.banner); column(W, x, kz1 - 1, ky + 2, ky + 6, B.banner); }
  L.bossPos = V(K.x + 6, ky, K.z); L.gate = V(kx0 - 4, top(kx0 - 4, K.z), K.z);
  L.protect = (x, y, z) => y <= 1;
  // collectibles: lost pages
  L.collect = [];
  for (let i = 0; i < 5; i++) { let x, z; do { x = R.int(10, S - 10); z = R.int(10, S - 10); } while (nearPOI(x, z, 2) || top(x, z) <= 13); L.collect.push(V(x + 0.5, top(x, z), z + 0.5)); }
  L.enemySpots = [];
  for (let i = 0; i < 26; i++) { let x, z; do { x = R.int(10, S - 10); z = R.int(10, S - 10); } while (Math.hypot(x - L.spawn.x, z - L.spawn.z) < 30 || top(x, z) <= 13); L.enemySpots.push(V(x, top(x, z), z)); }
  return { W, layout: L };
}

// ── NEON MERIDIAN: a comic-book city of rooftops, jump pads and neon ──
export function genNeon(seed = 2) {
  const { p, B } = PALETTES.neon; const R = new Rng(seed);
  const S = 152, H = 72, G0 = 5;
  const W = new VoxelWorld(S, H, S, p);
  box(W, 0, 0, 0, S - 1, 0, S - 1, B.bedrock); box(W, 0, 1, 0, S - 1, G0 - 2, S - 1, B.concrete);
  box(W, 0, G0 - 1, 0, S - 1, G0 - 1, S - 1, B.asphalt);
  const cell = 24, street = 8;
  const L = { buildings: [], pads: [], erasers: [], civilians: [], enemySpots: [], camps: [], collect: [] };
  const plaza = [2, 2]; // center plaza cell
  for (let cz = 0; cz < 6; cz++) for (let cx = 0; cx < 6; cx++) {
    const x0 = cx * cell + street / 2 + 2, z0 = cz * cell + street / 2 + 2, x1 = x0 + cell - street - 1, z1 = z0 + cell - street - 1;
    // sidewalks
    box(W, x0 - 2, G0 - 1, z0 - 2, x1 + 2, G0 - 1, z1 + 2, B.sidewalk);
    if ((cx === plaza[0] || cx === plaza[0] + 1) && (cz === plaza[1] || cz === plaza[1] + 1)) continue;
    if (cx === 0 && cz === 0) continue; // spawn park
    if (R.chance(0.12)) { // small park
      for (let i = 0; i < 4; i++) { const tx = R.int(x0 + 2, x1 - 2), tz = R.int(z0 + 2, z1 - 2); column(W, tx, tz, G0, G0 + 2, B.metal); blob(W, tx, G0 + 4, tz, 2, B.tree); }
      L.camps.push(V((x0 + x1) / 2, G0, (z0 + z1) / 2)); continue;
    }
    const h = R.int(10, 44) + (Math.abs(cx - 2.5) < 2 && Math.abs(cz - 2.5) < 2 ? 8 : 0);
    const wall = R.pick([B.wallA, B.wallB, B.wallC, B.wallD]);
    const win = R.chance(0.6) ? B.win : B.winB;
    for (let y = G0; y < G0 + h; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (!edge) { if (y === G0 + h - 1) W.set(x, y, z, B.roof); continue; }
      const along = (x === x0 || x === x1) ? z : x;
      const isWin = (y - G0) % 4 >= 1 && (y - G0) % 4 <= 2 && along % 3 !== 0 && y < G0 + h - 1 && y > G0;
      W.set(x, y, z, isWin ? (hash3(x, y, z) < 0.25 ? B.winOff : win) : wall);
    }
    // parapet
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (x === x0 || x === x1 || z === z0 || z === z1) W.set(x, G0 + h, z, B.metal);
    // neon sign
    const sign = R.pick([B.neonP, B.neonC, B.neonY, B.neonG]); const sy = G0 + R.int(4, Math.max(5, h - 4));
    box(W, x0 + 3, sy, z0 - 1, x1 - 3, sy + 1, z0 - 1, sign);
    if (R.chance(0.3)) box(W, x0 + 2, G0 + h + 1, (z0 + z1) >> 1, x1 - 2, G0 + h + 4, (z0 + z1) >> 1, B.billboard);
    const roof = V((x0 + x1) / 2 + 0.5, G0 + h, (z0 + z1) / 2 + 0.5);
    L.buildings.push({ x0, z0, x1, z1, h, roof });
    // jump pad at the building's front
    const px = (x0 + x1) >> 1, pz = z0 - 2; box(W, px - 1, G0 - 1, pz - 1, px + 1, G0 - 1, pz, B.pad);
    L.pads.push({ pos: V(px + 0.5, G0, pz), target: roof.clone(), h });
  }
  // plaza with statue
  const pc = V(plaza[0] * cell + cell, G0, plaza[1] * cell + cell);
  box(W, pc.x - 20, G0 - 1, pc.z - 20, pc.x + 20, G0 - 1, pc.z + 20, B.sidewalk);
  for (let z = -20; z <= 20; z += 4) for (let x = -20; x <= 20; x += 4) if (Math.hypot(x, z) < 18) W.set(pc.x + x, G0 - 1, pc.z + z, B.line);
  box(W, pc.x - 2, G0, pc.z - 2, pc.x + 2, G0 + 1, pc.z + 2, B.concrete);
  box(W, pc.x - 1, G0 + 2, pc.z - 1, pc.x + 1, G0 + 6, pc.z + 1, B.metal); box(W, pc.x - 3, G0 + 5, pc.z, pc.x + 3, G0 + 5, pc.z, B.metal); box(W, pc.x - 1, G0 + 7, pc.z - 1, pc.x + 1, G0 + 8, pc.z + 1, B.neonY);
  L.bossPos = pc.clone().add(V(0, 0, 8)); L.plaza = pc;
  // road lines + cars
  for (let i = 0; i < S; i += 3) for (let k = 0; k < 7; k++) { W.set(i, G0 - 1, k * cell + 2, B.line); W.set(k * cell + 2, G0 - 1, i, B.line); }
  for (let i = 0; i < 30; i++) {
    const along = R.chance(0.5); const k = R.int(0, 6) * cell + (R.chance(0.5) ? 0 : 3); const t = R.int(4, S - 8);
    const x = along ? t : k, z = along ? k : t; if (Math.hypot(x - pc.x, z - pc.z) < 22) continue;
    const col = R.pick([B.car1, B.car2, B.car3]);
    if (along) { box(W, x, G0, z, x + 3, G0, z + 1, col); box(W, x + 1, G0 + 1, z, x + 2, G0 + 1, z + 1, B.glass); W.set(x, G0 - 0, z - 0, B.tire); }
    else { box(W, x, G0, z, x + 1, G0, z + 3, col); box(W, x, G0 + 1, z + 1, x + 1, G0 + 1, z + 2, B.glass); }
  }
  // streetlights
  for (let i = 8; i < S; i += 16) for (let k = 0; k < 7; k++) { const x = k * cell + 5, z = i; if (!W.get(x, G0, z)) { column(W, x, z, G0, G0 + 5, B.metal); W.set(x, G0 + 6, z, B.neonC); } }
  L.spawn = V(12, G0, 12);
  // objectives: 3 erasers on rooftops (pick high buildings with pads), 4 civilians in streets
  const tall = L.buildings.filter((b) => b.h > 18).sort(() => R.next() - 0.5).slice(0, 3);
  for (const b of tall) { const r = b.roof; box(W, r.x - 1, r.y + 1, r.z - 1, r.x, r.y + 3, r.z, B.eraser); L.erasers.push({ pos: V(r.x, r.y + 1, r.z), blocks: [[r.x - 1, r.y + 1, r.z - 1]], building: b }); }
  for (let i = 0; i < 4; i++) { const k = R.int(1, 5); L.civilians.push(V(k * cell + 2 + R.range(-1, 1), G0, R.int(20, S - 20))); }
  for (let i = 0; i < 28; i++) { const k = R.int(0, 6) * cell + 2; const t = R.int(10, S - 10); const pos = R.chance(0.5) ? V(t, G0, k) : V(k, G0, t); if (pos.distanceTo(L.spawn) > 30) L.enemySpots.push(pos); }
  for (const b of L.buildings) if (R.chance(0.35)) L.enemySpots.push(b.roof.clone().add(V(0, 1, 0)));
  for (let i = 0; i < 5; i++) { const b = R.pick(L.buildings); L.collect.push(b.roof.clone().add(V(R.range(-3, 3), 1, R.range(-3, 3)))); }
  if (L.camps.length < 3) L.camps.push(V(pc.x - 30, G0, pc.z - 30), V(pc.x + 30, G0, pc.z - 30), V(pc.x - 30, G0, pc.z + 30));
  L.protect = (x, y, z) => y < G0 - 1;
  return { W, layout: L };
}

// ── THE ASTERION: a derelict ship, cracked open to the stars ──
export function genAsterion(seed = 3) {
  const { p, B } = PALETTES.asterion; const R = new Rng(seed);
  const N = 5, RS = 22, S = N * RS + 8, H = 36, F = 6;
  const W = new VoxelWorld(S, H, S, p);
  const L = { rooms: [], terminals: [], enemySpots: [], camps: [], collect: [], lowG: [] };
  const off = 4;
  // deck plate
  for (let z = off - 2; z < S - off + 2; z++) for (let x = off - 2; x < S - off + 2; x++) { W.set(x, F - 3, z, B.bedrock); W.set(x, F - 2, z, B.hull); W.set(x, F - 1, z, (x % 4 === 0 || z % 4 === 0) ? B.grate : B.floor); }
  // rooms + walls
  const wallH = 7;
  const open = new Set();
  // spanning tree over the room grid
  const seen = new Set(['0,0']); const stack = [[0, 0]];
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
      for (let x = x0; x <= x1; x++) { W.set(x, y, z0, B.hull); W.set(x, y, z1, B.hull); }
      for (let z = z0; z <= z1; z++) { W.set(x0, y, z, B.hull); W.set(x1, y, z, B.hull); }
    }
    for (let x = x0; x <= x1; x += 2) { W.set(x, F + wallH - 1, z0, B.light); W.set(x, F + wallH - 1, z1, B.light); }
    for (let x = x0; x <= x1; x++) { W.set(x, F + 1, z0, B.stripe); W.set(x, F + 1, z1, B.stripe); }
    if (breached) { // hull breach: walls torn, low gravity, glass shards
      for (let i = 0; i < 40; i++) { const x = R.int(x0, x1), z = R.int(z0, z1); for (let y = F; y < F + wallH; y++) W.set(x, y, z, 0); }
      L.lowG.push(room);
    }
    // decor
    for (let i = 0; i < 5; i++) { const x = R.int(x0 + 3, x1 - 3), z = R.int(z0 + 3, z1 - 3); const cr = R.pick([B.crate, B.crate2]); box(W, x, F, z, x + 1, F + R.int(0, 2), z + 1, cr); }
    if (R.chance(0.4)) { for (let x = x0 + 1; x < x1; x++) W.set(x, F + 4, z0 + 1, B.pipe); }
    if (R.chance(0.3)) { const x = R.int(x0 + 4, x1 - 4), z = R.int(z0 + 4, z1 - 4); box(W, x, F, z, x + 2, F, z + 2, B.plant); }
  }
  // doors
  for (const k of open) {
    const [ax, az, bx, bz] = k.split(',').map(Number); if (bx < ax || bz < az) continue;
    if (bx > ax) { const x = off + bx * RS, zc = off + az * RS + RS / 2; box(W, x, F, zc - 2, x, F + 4, zc + 2, 0); }
    else { const z = off + bz * RS, xc = off + ax * RS + RS / 2; box(W, xc - 2, F, z, xc + 2, F + 4, z, 0); }
  }
  // terminals in 3 distant rooms, core room at the far corner
  const far = L.rooms.filter((r) => r.cx + r.cz >= 3 && !(r.cx === N - 1 && r.cz === N - 1)).sort(() => R.next() - 0.5).slice(0, 3);
  for (const r of far) { const t = r.c.clone(); box(W, t.x - 1, F, t.z - 1, t.x + 1, F, t.z + 1, B.stripe); box(W, t.x, F, t.z, t.x, F + 2, t.z, B.terminalOff); L.terminals.push({ pos: V(t.x + 0.5, F, t.z + 1.8), block: [t.x, F + 2, t.z], room: r }); }
  const core = L.rooms.find((r) => r.cx === N - 1 && r.cz === N - 1);
  // core room: seal with a door until the terminals are online
  const cd = { x: core.x0, z0: core.z0 + RS / 2 - 2, z1: core.z0 + RS / 2 + 2 };
  L.coreDoor = []; for (let z = cd.z0; z <= cd.z1; z++) for (let y = F; y <= F + 4; y++) { W.set(cd.x, y, z, B.coreDoor); L.coreDoor.push([cd.x, y, z]); }
  const cz2 = core.z0 + (RS >> 1), cx2 = core.x0 + (RS >> 1); for (let z = core.z0 + 1; z < core.z1; z++) for (let y = F; y <= F + 4; y++) { if (W.get(core.x0, y, z) === 0) { W.set(core.x0, y, z, B.coreDoor); L.coreDoor.push([core.x0, y, z]); } }
  const upper = L.rooms.find((r) => r.cx === N - 1 && r.cz === N - 2); if (upper) for (let x = core.x0 + 1; x < core.x1; x++) for (let y = F; y <= F + 4; y++) if (W.get(x, y, core.z0) === 0) { W.set(x, y, core.z0, B.coreDoor); L.coreDoor.push([x, y, core.z0]); }
  box(W, cx2 - 1, F, cz2 - 1, cx2 + 1, F + 1, cz2 + 1, B.hull); column(W, cx2, cz2, F + 2, F + 10, B.core);
  L.coreRoom = core; L.bossPos = V(cx2 + 0.5, F + 2, cz2 + 0.5); L.coreDoorPos = V(core.x0 - 2, F, core.z0 + RS / 2);
  L.spawn = V(off + RS / 2, F, off + RS / 2);
  for (const r of L.rooms) { if (r.cx === 0 && r.cz === 0) continue; if (r === core) continue; for (let i = 0; i < 2; i++) L.enemySpots.push(r.c.clone().add(V(R.range(-6, 6), 0, R.range(-6, 6)))); }
  L.camps = L.rooms.filter((r) => r.cx + r.cz >= 2 && r !== core).sort(() => R.next() - 0.5).slice(0, 3).map((r) => r.c.clone());
  for (let i = 0; i < 5; i++) { const r = R.pick(L.rooms); L.collect.push(r.c.clone().add(V(R.range(-7, 7), 0, R.range(-7, 7)))); }
  L.protect = (x, y, z) => y < F || L.coreDoor.some((b) => b[0] === x && b[1] === y && b[2] === z);
  return { W, layout: L };
}

// ── RIFT REALMS: endless mash-ups of every genre ──
export function genRift(seed = 4) {
  const R = new Rng(seed); const pal = riftPalette(R); const { p, B } = pal;
  const S = 128, H = 48;
  const W = new VoxelWorld(S, H, S, p);
  const L = { theme: pal.theme, tears: [], enemySpots: [], camps: [], collect: [] };
  const sq = R.range(0.02, 0.045), amp = R.range(8, 20), floating = R.chance(0.5);
  const heights = new Int16Array(S * S);
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - S / 2, z - S / 2);
    let h = 10 + fbm2(x * sq, z * sq, seed) * amp;
    if (d > S / 2 - 6) h = Math.min(h, 10 - (d - S / 2 + 6) * 2);
    const hh = Math.floor(h); heights[x + z * S] = hh;
    if (hh < 3) continue;
    W.set(x, 0, z, B.bedrock); for (let y = 1; y < hh; y++) W.set(x, y, z, y < hh - 3 ? B.stone : B.under); W.set(x, hh, z, B.ground);
  }
  const top = (x, z) => heights[Math.floor(x) + Math.floor(z) * S] + 1;
  // floating islands
  if (floating) for (let i = 0; i < 14; i++) { const x = R.int(15, S - 15), z = R.int(15, S - 15); blob(W, x, R.int(26, 38), z, R.range(3, 6), B.ground, true, 0.2); }
  // genre fragments: ruined buildings, trees, hull pieces
  for (let i = 0; i < 40; i++) {
    const x = R.int(8, S - 8), z = R.int(8, S - 8), y = top(x, z); if (y < 5) continue;
    const kind = R.int(0, 2);
    if (kind === 0) { column(W, x, z, y, y + R.int(3, 6), B.log); blob(W, x, y + 7, z, 2.5, B.plant); }
    else if (kind === 1) { const h = R.int(4, 12); hollowBox(W, x - 2, y, z - 2, x + 2, y + h, z + 2, B.hull); for (let yy = y + 1; yy < y + h; yy += 2) W.set(x - 2, yy, z, B.win); }
    else { for (let k = 0; k < 4; k++) W.set(x + k, y + k, z, B.accent); }
  }
  // tears
  const pts = [V(S * 0.25, 0, S * 0.3), V(S * 0.72, 0, S * 0.28), V(S * 0.5, 0, S * 0.75)];
  for (const t of pts) { t.x = Math.round(t.x); t.z = Math.round(t.z); t.y = top(t.x, t.z); if (t.y < 5) t.y = 10; box(W, t.x - 3, t.y - 1, t.z - 3, t.x + 3, t.y - 1, t.z + 3, B.stone); const blocks = []; for (let y = 0; y < 6; y++) { W.set(t.x, t.y + y, t.z, B.tear); blocks.push([t.x, t.y + y, t.z]); } L.tears.push({ pos: t, blocks }); }
  L.spawn = V(S / 2, 0, S / 2); L.spawn.y = Math.max(top(S / 2, S / 2), 10);
  box(W, S / 2 - 3, L.spawn.y - 1, S / 2 - 3, S / 2 + 3, L.spawn.y - 1, S / 2 + 3, B.stone);
  L.bossPos = V(S / 2, L.spawn.y, S / 2 + 20); L.bossPos.y = Math.max(top(L.bossPos.x, L.bossPos.z), 8);
  for (let i = 0; i < 24; i++) { const x = R.int(12, S - 12), z = R.int(12, S - 12); const y = top(x, z); if (y > 4 && Math.hypot(x - S / 2, z - S / 2) > 18) L.enemySpots.push(V(x, y, z)); }
  L.camps = L.enemySpots.slice(0, 3).map((v) => v.clone());
  L.protect = (x, y, z) => y <= 1;
  return { W, layout: L };
}

// ── THE LOOM: the finale arena where all threads meet ──
export function genLoom() {
  const { p, B } = PALETTES.loom;
  const S = 100, H = 44, C = 50;
  const W = new VoxelWorld(S, H, S, p);
  for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - C, z - C); if (d > 42) continue;
    W.set(x, 0, z, B.bedrock); for (let y = 1; y < 8; y++) W.set(x, y, z, B.grey);
    const ring = Math.floor(d) % 8 === 0; const spoke = Math.abs(Math.atan2(z - C, x - C) * 8 / Math.PI % 1) < 0.08;
    W.set(x, 8, z, ring ? B.thread1 : spoke ? B.gold : B.white);
  }
  // fragments of every realm around the edge
  const frags = [[B.grass, B.thread3], [B.asphalt, B.neonP], [B.hull, B.thread2]];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2; const x = Math.round(C + Math.cos(a) * 36), z = Math.round(C + Math.sin(a) * 36);
    const [g, gl] = frags[i % 3]; box(W, x - 2, 9, z - 2, x + 2, 9, z + 2, g); column(W, x, z, 10, 10 + 6 + (i % 4) * 3, gl);
  }
  // thread pillars
  const th = [B.thread1, B.thread2, B.thread3, B.thread4];
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; const x = Math.round(C + Math.cos(a) * 22), z = Math.round(C + Math.sin(a) * 22); column(W, x, z, 9, 30, th[i]); }
  return { W, layout: { spawn: V(C, 9, C - 30), bossPos: V(C, 9, C + 4), center: V(C, 9, C), enemySpots: [], camps: [], collect: [], protect: (x, y, z) => y <= 8 } };
}
