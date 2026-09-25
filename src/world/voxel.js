// Voxel world: dense block grid, chunked face-culled meshes with baked AO,
// collision queries, raycasts and destruction.
import * as THREE from 'three';
import { hash3 } from '../core/rng.js';

const CH = 16;
const FACES = [
  { n: [1, 0, 0], shade: 0.82, corners: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { n: [-1, 0, 0], shade: 0.72, corners: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { n: [0, 1, 0], shade: 1.0, corners: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { n: [0, -1, 0], shade: 0.5, corners: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [0, 0, 1], shade: 0.9, corners: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { n: [0, 0, -1], shade: 0.66, corners: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
];

export class VoxelWorld {
  constructor(w, h, d, palette) {
    this.w = w; this.h = h; this.d = d;
    this.data = new Uint8Array(w * h * d);
    this.palette = palette; // index → { c, top?, v?, glow?, solid? (default true), alpha? }
    this.cols = palette.map((p) => p ? { c: new THREE.Color(p.c), top: new THREE.Color(p.top ?? p.c) } : null);
    this.group = new THREE.Group();
    this.chunks = new Map();
    this.dirty = new Set();
    this.litMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.alphaMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.65, depthWrite: false });
  }
  idx(x, y, z) { return x + this.w * (z + this.d * y); }
  inBounds(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d; }
  get(x, y, z) {
    if (x < 0 || z < 0 || x >= this.w || z >= this.d) return 255; // boundary wall
    if (y < 0) return 255; if (y >= this.h) return 0;
    return this.data[this.idx(x, y, z)];
  }
  set(x, y, z, v) {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.idx(x, y, z)] = v;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    this.dirty.add(cx + ',' + cz);
    if (x % CH === 0) this.dirty.add((cx - 1) + ',' + cz);
    if (x % CH === CH - 1) this.dirty.add((cx + 1) + ',' + cz);
    if (z % CH === 0) this.dirty.add(cx + ',' + (cz - 1));
    if (z % CH === CH - 1) this.dirty.add(cx + ',' + (cz + 1));
  }
  fill(x0, y0, z0, x1, y1, z1, v) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, v);
  }
  isSolid(x, y, z) {
    const v = this.get(Math.floor(x), Math.floor(y), Math.floor(z));
    if (v === 255) return true; if (!v) return false;
    const p = this.palette[v]; return p ? p.solid !== false : false;
  }
  opaque(v) { if (v === 255) return true; if (!v) return false; const p = this.palette[v]; return p && p.solid !== false && !p.alpha; }
  heightAt(x, z) { // top solid y+1 at column
    x = Math.floor(x); z = Math.floor(z);
    for (let y = this.h - 1; y >= 0; y--) if (this.isSolid(x, y, z)) return y + 1;
    return 0;
  }
  groundBelow(x, y, z) {
    x = Math.floor(x); z = Math.floor(z);
    for (let yy = Math.floor(y); yy >= 0; yy--) if (this.isSolid(x, yy, z)) return yy + 1;
    return 0;
  }
  boxHits(minx, miny, minz, maxx, maxy, maxz) {
    for (let y = Math.floor(miny); y <= Math.floor(maxy - 1e-4); y++)
      for (let z = Math.floor(minz); z <= Math.floor(maxz - 1e-4); z++)
        for (let x = Math.floor(minx); x <= Math.floor(maxx - 1e-4); x++)
          if (this.isSolid(x, y, z)) return true;
    return false;
  }
  // Amanatides–Woo DDA. Returns {x,y,z,dist,normal} of first solid block or null.
  raycast(o, dir, maxDist) {
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
    const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
    let tmx = sx > 0 ? (x + 1 - o.x) * tdx : (o.x - x) * tdx;
    let tmy = sy > 0 ? (y + 1 - o.y) * tdy : (o.y - y) * tdy;
    let tmz = sz > 0 ? (z + 1 - o.z) * tdz : (o.z - z) * tdz;
    if (!isFinite(tmx)) tmx = Infinity; if (!isFinite(tmy)) tmy = Infinity; if (!isFinite(tmz)) tmz = Infinity;
    let t = 0, nx = 0, ny = 0, nz = 0;
    while (t <= maxDist) {
      if (this.isSolid(x, y, z)) return { x, y, z, dist: t, normal: [nx, ny, nz] };
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tmz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }
  lineClear(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length(); if (len < 0.01) return true;
    dir.divideScalar(len); return !this.raycast(a, dir, len - 0.3);
  }
  // Blow a sphere out of the world. Returns removed block colours for debris.
  explode(cx, cy, cz, r, protect = () => false) {
    const out = [];
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let z = Math.floor(cz - r); z <= cz + r; z++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++) {
          const dd = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 + (z + 0.5 - cz) ** 2;
          if (dd > r * r || y <= 0) continue;
          const v = this.get(x, y, z); if (!v || v === 255) continue;
          const p = this.palette[v]; if (!p || p.hard || protect(x, y, z)) continue;
          out.push({ x, y, z, c: p.c }); this.set(x, y, z, 0);
        }
    return out;
  }
  buildAll() {
    for (let cx = 0; cx < Math.ceil(this.w / CH); cx++)
      for (let cz = 0; cz < Math.ceil(this.d / CH); cz++) this.buildChunk(cx, cz);
    this.dirty.clear();
  }
  update() {
    if (!this.dirty.size) return;
    let n = 0;
    for (const k of this.dirty) { const [cx, cz] = k.split(',').map(Number); if (cx >= 0 && cz >= 0) this.buildChunk(cx, cz); this.dirty.delete(k); if (++n > 4) break; }
  }
  buildChunk(cx, cz) {
    const key = cx + ',' + cz;
    const old = this.chunks.get(key);
    if (old) { old.forEach((m) => { this.group.remove(m); m.geometry.dispose(); }); }
    const bufs = { lit: newBuf(), glow: newBuf(), alpha: newBuf() };
    const x0 = cx * CH, z0 = cz * CH, x1 = Math.min(this.w, x0 + CH), z1 = Math.min(this.d, z0 + CH);
    const tmp = new THREE.Color();
    for (let y = 0; y < this.h; y++)
      for (let z = z0; z < z1; z++)
        for (let x = x0; x < x1; x++) {
          const v = this.data[this.idx(x, y, z)]; if (!v) continue;
          const p = this.palette[v]; if (!p) continue;
          const col = this.cols[v];
          const buf = p.glow ? bufs.glow : p.alpha ? bufs.alpha : bufs.lit;
          const jitter = 1 + (hash3(x, y, z) - 0.5) * (p.v ?? 0.12);
          for (let f = 0; f < 6; f++) {
            const F = FACES[f];
            const nv = this.get(x + F.n[0], y + F.n[1], z + F.n[2]);
            if (p.alpha ? nv === v || this.opaque(nv) : this.opaque(nv)) continue;
            if (nv === 255) continue;
            const base = f === 2 ? col.top : col.c;
            const vi = buf.pos.length / 3;
            for (let c = 0; c < 4; c++) {
              const k = F.corners[c];
              buf.pos.push(x + k[0], y + k[1], z + k[2]);
              buf.nor.push(F.n[0], F.n[1], F.n[2]);
              let ao = 1;
              if (!p.glow) ao = this.ao(x, y, z, F.n, k);
              const s = (p.glow ? 1 : F.shade) * ao * jitter;
              tmp.copy(base).multiplyScalar(s);
              buf.col.push(tmp.r, tmp.g, tmp.b);
            }
            buf.idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
          }
        }
    const meshes = [];
    for (const [kind, b] of Object.entries(bufs)) {
      if (!b.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.idx);
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, kind === 'glow' ? this.glowMat : kind === 'alpha' ? this.alphaMat : this.litMat);
      this.group.add(m); meshes.push(m);
    }
    this.chunks.set(key, meshes);
  }
  ao(x, y, z, n, k) {
    // Sample the 3 neighbours around this corner on the face's outward side.
    const ox = x + n[0], oy = y + n[1], oz = z + n[2];
    const dx = k[0] ? 1 : -1, dy = k[1] ? 1 : -1, dz = k[2] ? 1 : -1;
    let a, b, c;
    if (n[0]) { a = this.opaque(this.get(ox, y + dy, z)); b = this.opaque(this.get(ox, y, z + dz)); c = this.opaque(this.get(ox, y + dy, z + dz)); }
    else if (n[1]) { a = this.opaque(this.get(x + dx, oy, z)); b = this.opaque(this.get(x, oy, z + dz)); c = this.opaque(this.get(x + dx, oy, z + dz)); }
    else { a = this.opaque(this.get(x + dx, y, oz)); b = this.opaque(this.get(x, y + dy, oz)); c = this.opaque(this.get(x + dx, y + dy, oz)); }
    const occ = a && b ? 3 : (a + b + c);
    return 1 - occ * 0.16;
  }
  dispose() {
    for (const ms of this.chunks.values()) ms.forEach((m) => m.geometry.dispose());
    this.chunks.clear();
  }
}
function newBuf() { return { pos: [], nor: [], col: [], idx: [] }; }
