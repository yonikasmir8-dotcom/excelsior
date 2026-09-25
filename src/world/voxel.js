// World: smooth heightfield terrain + greedy-meshed, textured architecture + water.
// The block grid is only the *collision and building* representation. What you see is textured
// masonry, timber and marble, merged into large surfaces so nothing reads as cubes.
import * as THREE from 'three';
import { tex } from './textures.js';
import { buildProps } from './props.js';

const CH = 16, TCH = 32;
const matCache = new Map();

function blockMaterial(p) {
  const key = [p.tex || 'plaster', !!p.glow, !!p.alpha, p.metal || 0, p.rough ?? 0.85, p.glow ? p.c : 0].join('|');
  if (matCache.has(key)) return matCache.get(key);
  let m;
  if (p.glow) m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(p.c), emissiveIntensity: p.emissive ?? 2.2, map: p.tex ? tex(p.tex) : null, roughness: 0.6 });
  else if (p.alpha) m = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.2, depthWrite: false });
  else m = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex(p.tex || 'plaster'), roughness: p.rough ?? 0.85, metalness: p.metal || 0 });
  matCache.set(key, m); return m;
}

export class VoxelWorld {
  constructor(w, h, d, palette) {
    this.w = w; this.h = h; this.d = d;
    this.data = new Uint8Array(w * h * d);
    this.palette = palette;
    this.cols = palette.map((p) => p ? new THREE.Color(p.c) : null);
    this.group = new THREE.Group();
    this.chunks = new Map(); this.dirty = new Set();
    this.hf = null; this.waterLevel = null;
  }
  idx(x, y, z) { return x + this.w * (z + this.d * y); }
  inBounds(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d; }
  get(x, y, z) {
    if (x < 0 || z < 0 || x >= this.w || z >= this.d) return 255;
    if (y < 0) return this.hf ? 0 : 255; if (y >= this.h) return 0;
    return this.data[this.idx(x, y, z)];
  }
  set(x, y, z, v) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if (!this.inBounds(x, y, z)) return;
    this.data[this.idx(x, y, z)] = v;
    const cx = Math.floor(x / CH), cz = Math.floor(z / CH);
    this.dirty.add(cx + ',' + cz);
    if (x % CH === 0) this.dirty.add((cx - 1) + ',' + cz); if (x % CH === CH - 1) this.dirty.add((cx + 1) + ',' + cz);
    if (z % CH === 0) this.dirty.add(cx + ',' + (cz - 1)); if (z % CH === CH - 1) this.dirty.add(cx + ',' + (cz + 1));
  }
  fill(x0, y0, z0, x1, y1, z1, v) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, z, v);
  }
  // ── terrain ──
  setTerrain(heights, colorFn) { this.hf = heights; this.hfColor = colorFn; }
  hRaw(x, z) { if (x < 0 || z < 0 || x > this.w || z > this.d) return NaN; return this.hf[x + z * (this.w + 1)]; }
  terrainAt(x, z) {
    if (!this.hf) return -Infinity;
    const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi;
    const a = this.hRaw(xi, zi), b = this.hRaw(xi + 1, zi), c = this.hRaw(xi, zi + 1), e = this.hRaw(xi + 1, zi + 1);
    if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(e)) return -Infinity;
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + e * fx) * fz;
  }
  // ── collision ──
  voxelSolid(x, y, z) {
    const v = this.get(x, y, z); if (v === 255) return true; if (!v) return false;
    const p = this.palette[v]; return p ? p.solid !== false : false;
  }
  isSolid(x, y, z) { return this.voxelSolid(Math.floor(x), Math.floor(y), Math.floor(z)) || y < this.terrainAt(x, z); }
  opaque(v) { if (v === 255) return true; if (!v) return false; const p = this.palette[v]; return p && p.solid !== false && !p.alpha && !p.invisible; }
  voxelTop(x, z, below = this.h) {
    x = Math.floor(x); z = Math.floor(z);
    for (let y = Math.min(this.h - 1, Math.floor(below)); y >= 0; y--) if (this.voxelSolid(x, y, z) && this.get(x, y, z) !== 255) return y + 1;
    return -Infinity;
  }
  heightAt(x, z) { return Math.max(this.voxelTop(x, z), this.terrainAt(x, z), 0); }
  groundBelow(x, y, z) {
    const t = this.terrainAt(x, z); const v = this.voxelTop(x, z, y);
    const g = Math.max(v, t <= y + 0.6 ? t : -Infinity);
    return g === -Infinity ? 0 : g;
  }
  boxHits(minx, miny, minz, maxx, maxy, maxz) {
    for (let y = Math.floor(miny); y <= Math.floor(maxy - 1e-4); y++)
      for (let z = Math.floor(minz); z <= Math.floor(maxz - 1e-4); z++)
        for (let x = Math.floor(minx); x <= Math.floor(maxx - 1e-4); x++)
          if (this.voxelSolid(x, y, z)) return true;
    return false;
  }
  raycast(o, dir, maxDist) {
    const step = 0.2; const p = o.clone();
    for (let t = 0; t <= maxDist; t += step) {
      p.set(o.x + dir.x * t, o.y + dir.y * t, o.z + dir.z * t);
      if (this.isSolid(p.x, p.y, p.z)) return { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z), dist: t, point: p.clone(), normal: [0, 1, 0] };
    }
    return null;
  }
  lineClear(a, b) { const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length(); if (len < 0.01) return true; dir.divideScalar(len); return !this.raycast(a, dir, len - 0.3); }
  explode() { return []; } // the world is no longer destructible: cleaner, more readable fights
  // ── meshing ──
  buildAll() {
    for (let cx = 0; cx < Math.ceil(this.w / CH); cx++) for (let cz = 0; cz < Math.ceil(this.d / CH); cz++) this.buildChunk(cx, cz);
    this.dirty.clear();
    if (this.hf) this.buildTerrain();
    if (this.props) buildProps(this.group, this.props);
    for (const m of this.extras || []) this.group.add(m);
    if (this.waterLevel != null) {
      const g = new THREE.PlaneGeometry(this.w + 200, this.d + 200); g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: this.waterColor || 0x2a5a78, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.78 }));
      m.position.set(this.w / 2, this.waterLevel, this.d / 2); m.receiveShadow = true; this.group.add(m); this.water = m;
    }
  }
  update() {
    if (!this.dirty.size) return; let n = 0;
    for (const k of this.dirty) { const [cx, cz] = k.split(',').map(Number); if (cx >= 0 && cz >= 0) this.buildChunk(cx, cz); this.dirty.delete(k); if (++n > 4) break; }
  }
  buildChunk(cx, cz) {
    const key = cx + ',' + cz;
    const old = this.chunks.get(key); if (old) old.forEach((m) => { this.group.remove(m); m.geometry.dispose(); });
    const x0 = cx * CH, z0 = cz * CH, x1 = Math.min(this.w, x0 + CH), z1 = Math.min(this.d, z0 + CH);
    const bufs = new Map(); // material → {pos, nor, uv, col, idx}
    const lo = [x0, 0, z0], hi = [x1, this.h, z1];
    const pos = [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3, v = (d + 2) % 3;
      const du = hi[u] - lo[u], dv = hi[v] - lo[v];
      const mask = new Int32Array(du * dv);
      for (const dir of [1, -1]) {
        for (let s = lo[d]; s < hi[d]; s++) {
          // build mask for this slice
          for (let j = 0; j < dv; j++) for (let i = 0; i < du; i++) {
            pos[d] = s; pos[u] = lo[u] + i; pos[v] = lo[v] + j;
            const b = this.data[this.idx(pos[0], pos[1], pos[2])];
            let key2 = 0;
            if (b) {
              const p = this.palette[b];
              if (p && !p.invisible) {
                const n = [pos[0], pos[1], pos[2]]; n[d] += dir;
                const nb = this.get(n[0], n[1], n[2]);
                const hidden = p.alpha ? (nb === b || this.opaque(nb)) : this.opaque(nb);
                if (!hidden && nb !== 255) key2 = b;
              }
            }
            mask[i + j * du] = key2;
          }
          // greedy merge
          for (let j = 0; j < dv; j++) for (let i = 0; i < du;) {
            const b = mask[i + j * du]; if (!b) { i++; continue; }
            let w = 1; while (i + w < du && mask[i + w + j * du] === b) w++;
            let h = 1; outer: while (j + h < dv) { for (let k = 0; k < w; k++) if (mask[i + k + (j + h) * du] !== b) break outer; h++; }
            for (let jj = 0; jj < h; jj++) for (let ii = 0; ii < w; ii++) mask[i + ii + (j + jj) * du] = 0;
            this.emitQuad(bufs, b, d, u, v, dir, s + (dir > 0 ? 1 : 0), lo[u] + i, lo[v] + j, w, h);
            i += w;
          }
        }
      }
    }
    const meshes = [];
    for (const [mat, b] of bufs) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      g.setIndex(b.idx); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.castShadow = !mat.transparent; m.receiveShadow = true;
      this.group.add(m); meshes.push(m);
    }
    this.chunks.set(key, meshes);
  }
  emitQuad(bufs, b, d, u, v, dir, s, a0, b0, w, h) {
    const p = this.palette[b]; const mat = blockMaterial(p);
    if (!bufs.has(mat)) bufs.set(mat, { pos: [], nor: [], uv: [], col: [], idx: [] });
    const B = bufs.get(mat); const vi = B.pos.length / 3;
    const corners = [[a0, b0], [a0 + w, b0], [a0 + w, b0 + h], [a0, b0 + h]];
    const n = [0, 0, 0]; n[d] = dir;
    const sc = 1 / (p.scale || 4); const c = this.cols[b];
    for (const [cu, cv] of corners) {
      const q = [0, 0, 0]; q[d] = s; q[u] = cu; q[v] = cv;
      B.pos.push(q[0], q[1], q[2]); B.nor.push(n[0], n[1], n[2]);
      if (d === 1) B.uv.push(q[0] * sc, q[2] * sc); else if (d === 0) B.uv.push(q[2] * sc, q[1] * sc); else B.uv.push(q[0] * sc, q[1] * sc);
      B.col.push(c.r, c.g, c.b);
    }
    if (dir > 0) B.idx.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); else B.idx.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2);
  }
  buildTerrain() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex('ground'), roughness: 0.95 });
    const W = this.w, D = this.d; const col = new THREE.Color();
    for (let cz = 0; cz < D; cz += TCH) for (let cx = 0; cx < W; cx += TCH) {
      const pos = [], nor = [], uv = [], cols = [], idx = [];
      const nx = Math.min(TCH, W - cx), nz = Math.min(TCH, D - cz);
      const vid = new Int32Array((nx + 1) * (nz + 1)).fill(-1);
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const x = cx + i, z = cz + j; const hgt = this.hRaw(x, z); if (isNaN(hgt)) continue;
        const hl = this.hRaw(x - 1, z), hr = this.hRaw(x + 1, z), hd = this.hRaw(x, z - 1), hu = this.hRaw(x, z + 1);
        const gx = (isNaN(hr) ? hgt : hr) - (isNaN(hl) ? hgt : hl), gz = (isNaN(hu) ? hgt : hu) - (isNaN(hd) ? hgt : hd);
        const nv = new THREE.Vector3(-gx, 2, -gz).normalize();
        vid[i + j * (nx + 1)] = pos.length / 3;
        pos.push(x, hgt, z); nor.push(nv.x, nv.y, nv.z); uv.push(x / 3, z / 3);
        this.hfColor(x, z, hgt, nv.y, col); cols.push(col.r, col.g, col.b);
      }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const a = vid[i + j * (nx + 1)], b = vid[i + 1 + j * (nx + 1)], c = vid[i + (j + 1) * (nx + 1)], e = vid[i + 1 + (j + 1) * (nx + 1)];
        if (a < 0 || b < 0 || c < 0 || e < 0) continue;
        idx.push(a, c, b, b, c, e);
      }
      if (!idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = true; this.group.add(m);
    }
  }
  dispose() {
    this.group.traverse((o) => { if (o.isMesh || o.isInstancedMesh) o.geometry.dispose(); });
    this.chunks.clear();
  }
}
