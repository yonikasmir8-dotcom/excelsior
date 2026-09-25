// Sculpted scenery: trees, rocks, foliage, furniture, lamps, statues. Each prop type is a merged,
// vertex-coloured geometry drawn with InstancedMesh, so a forest costs a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash3 } from '../core/rng.js';
import { quality } from '../core/settings.js';

const tmpC = new THREE.Color();
function paint(geo, color, jitter = 0.08, seed = 1) {
  geo = geo.index ? geo.toNonIndexed() : geo;
  const n = geo.attributes.position.count; const cols = new Float32Array(n * 3); const c = new THREE.Color(color);
  const p = geo.attributes.position;
  for (let i = 0; i < n; i++) {
    const k = 1 + (hash3(Math.floor(p.getX(i) * 7), Math.floor(p.getY(i) * 7) + seed, Math.floor(p.getZ(i) * 7)) - 0.5) * jitter * 2;
    cols[i * 3] = c.r * k; cols[i * 3 + 1] = c.g * k; cols[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  if (geo.attributes.uv) geo.deleteAttribute('uv');
  return geo;
}
function xf(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  geo.applyMatrix4(m); return geo;
}
function lumpy(geo, amt, seed) { // painterly irregular foliage/rock silhouettes
  const p = geo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + (hash3(Math.round(v.x * 5), Math.round(v.y * 5) + seed, Math.round(v.z * 5)) - 0.5) * amt; p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
  geo.computeVertexNormals(); return geo;
}
const merge = (list) => { const g = mergeGeometries(list, false); g.computeVertexNormals(); return g; };

// Each builder returns { std: geometry (lit), glow?: {geo, color, intensity} }
const B = {
  tree(v) {
    const leaf = [0xd8702a, 0xc0402a, 0xe0a83a, 0x6a8a3a, 0x9a3a4a][v % 5];
    const trunkH = 3.2 + (v % 3) * 0.6;
    const parts = [paint(xf(new THREE.CylinderGeometry(0.22, 0.42, trunkH, 7), { y: trunkH / 2 }), 0x5a3e2a, 0.15)];
    parts.push(paint(xf(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 5), { x: 0.5, y: trunkH * 0.7, rz: -0.8 }), 0x5a3e2a));
    parts.push(paint(xf(new THREE.CylinderGeometry(0.06, 0.12, 1.4, 5), { x: -0.45, y: trunkH * 0.6, rz: 0.9, ry: 1 }), 0x5a3e2a));
    const blobs = [[0, trunkH + 1.0, 0, 1.9], [0.9, trunkH + 0.4, 0.5, 1.3], [-0.9, trunkH + 0.5, -0.4, 1.35], [0.2, trunkH + 1.9, -0.3, 1.25], [-0.4, trunkH + 0.2, 0.9, 1.1]];
    blobs.forEach(([x, y, z, r], i) => parts.push(paint(lumpy(xf(new THREE.IcosahedronGeometry(r, 2), { x, y, z }), 0.35, i + v), tmpC.setHex(leaf).offsetHSL((i % 3) * 0.015, 0, (i % 2) * 0.04 - 0.02).getHex(), 0.18, i)));
    return { std: merge(parts), shadow: true };
  },
  pine(v) {
    const parts = [paint(xf(new THREE.CylinderGeometry(0.15, 0.3, 5, 6), { y: 2.5 }), 0x4a3424)];
    for (let i = 0; i < 4; i++) parts.push(paint(lumpy(xf(new THREE.ConeGeometry(2.1 - i * 0.42, 2.2, 8), { y: 2.2 + i * 1.3 }), 0.15, i), v % 2 ? 0x2e5a3a : 0x3a6a42, 0.15, i));
    return { std: merge(parts), shadow: true };
  },
  deadtree(v) {
    const parts = [paint(xf(new THREE.CylinderGeometry(0.15, 0.35, 4, 6), { y: 2 }), 0x3a3030)];
    for (let i = 0; i < 4; i++) parts.push(paint(xf(new THREE.CylinderGeometry(0.04, 0.1, 1.8, 4), { y: 2.6 + i * 0.35, rz: (i % 2 ? 1 : -1) * 0.9, ry: i * 1.7, x: (i % 2 ? -0.5 : 0.5) }), 0x3a3030));
    return { std: merge(parts), shadow: true };
  },
  mushroom(v) {
    const cap = v % 2 ? 0x9a5aff : 0x40e0c0;
    return { std: merge([paint(xf(new THREE.CylinderGeometry(0.35, 0.5, 3, 8), { y: 1.5 }), 0xe8e0d0)]), glow: { geo: lumpy(xf(new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), { y: 2.8, sy: 0.6 }), 0.1, v), color: cap, intensity: 1.4 }, shadow: true };
  },
  rock(v) { return { std: paint(lumpy(xf(new THREE.DodecahedronGeometry(1, 1), { y: 0.3, sy: 0.7 }), 0.45, v), [0x8a8680, 0x7a7670, 0x9a948a][v % 3], 0.12), shadow: true }; },
  bush(v) { return { std: merge([0, 1, 2].map((i) => paint(lumpy(xf(new THREE.IcosahedronGeometry(0.7, 1), { x: (i - 1) * 0.55, y: 0.5, z: (i % 2) * 0.3 }), 0.3, i + v), v % 2 ? 0x5a7a34 : 0xa0602a, 0.2, i))), shadow: true }; },
  grass(v) {
    const parts = [];
    for (let i = 0; i < 5; i++) parts.push(paint(xf(new THREE.ConeGeometry(0.05, 0.6 + (i % 3) * 0.2, 3), { x: Math.cos(i * 1.3) * 0.2, y: 0.3, z: Math.sin(i * 1.3) * 0.2, rz: Math.cos(i) * 0.3 }), v % 2 ? 0x7a9a3a : 0xa89a4a, 0.2, i));
    return { std: merge(parts) };
  },
  flower(v) {
    const col = [0xff6a8a, 0xffd23a, 0xc07aff, 0xffffff][v % 4];
    return { std: merge([paint(xf(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 3), { y: 0.25 }), 0x4a7a2a), paint(xf(new THREE.IcosahedronGeometry(0.12, 0), { y: 0.55 }), col)]) };
  },
  crystal(v) {
    const col = [0x60f0ff, 0xc070ff, 0xff5a9a][v % 3];
    return { glow: { geo: merge([0, 1, 2].map((i) => xf(new THREE.OctahedronGeometry(0.5, 0), { x: (i - 1) * 0.4, y: 0.8 + i * 0.2, sy: 2.4 - i * 0.4, rz: (i - 1) * 0.3 }))), color: col, intensity: 1.8 }, std: paint(xf(new THREE.DodecahedronGeometry(0.6, 0), { y: 0.2, sy: 0.5 }), 0x5a5560) };
  },
  lamp(v) { // city/street lantern post
    return { std: merge([paint(xf(new THREE.CylinderGeometry(0.08, 0.12, 4, 6), { y: 2 }), 0x3a3228), paint(xf(new THREE.CylinderGeometry(0.3, 0.25, 0.15, 6), { y: 4.05 }), 0x3a3228), paint(xf(new THREE.ConeGeometry(0.35, 0.3, 6), { y: 4.65 }), 0x3a3228)]), glow: { geo: xf(new THREE.CylinderGeometry(0.2, 0.2, 0.45, 6), { y: 4.35 }), color: v % 2 ? 0x8ae8ff : 0xffc870, intensity: 3 }, shadow: true };
  },
  torch(v) { return { std: paint(xf(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 5), { y: 0.4 }), 0x4a3020), glow: { geo: xf(new THREE.ConeGeometry(0.12, 0.35, 6), { y: 0.95 }), color: 0xffa040, intensity: 4 } }; },
  table() {
    return { std: merge([paint(xf(new THREE.CylinderGeometry(0.95, 0.95, 0.12, 14), { y: 0.95 }), 0x8a5a34, 0.1), paint(xf(new THREE.CylinderGeometry(0.1, 0.18, 0.9, 6), { y: 0.45 }), 0x5a3a20), paint(xf(new THREE.CylinderGeometry(0.4, 0.45, 0.06, 8), { y: 0.03 }), 0x5a3a20)]), glow: { geo: xf(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 6), { y: 1.1, x: 0.3 }), color: 0xffc060, intensity: 3 }, shadow: true };
  },
  stool() { return { std: merge([paint(xf(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10), { y: 0.55 }), 0x7a4a2a), ...[0, 1, 2].map((i) => paint(xf(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 4), { x: Math.cos(i * 2.1) * 0.18, z: Math.sin(i * 2.1) * 0.18, y: 0.27 }), 0x4a2a1a))]), shadow: true }; },
  barrel() {
    const g = new THREE.CylinderGeometry(0.48, 0.48, 1.2, 12, 4); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + 0.12 * Math.cos(y / 0.6 * Math.PI / 2); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
    return { std: merge([paint(xf(g, { y: 0.6 }), 0x7a4a24, 0.12), paint(xf(new THREE.TorusGeometry(0.52, 0.03, 4, 16), { y: 0.25, rx: Math.PI / 2 }), 0x3a3a3a), paint(xf(new THREE.TorusGeometry(0.52, 0.03, 4, 16), { y: 0.95, rx: Math.PI / 2 }), 0x3a3a3a)]), shadow: true };
  },
  bottles() { return { std: merge([0, 1, 2, 3, 4].map((i) => paint(xf(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 6), { x: i * 0.22 - 0.44, y: 0.18 }), [0x2a6a3a, 0x6a2a2a, 0x8a6a2a, 0x2a3a6a, 0x5a2a5a][i]))) }; },
  pillar(v) { return { std: merge([paint(xf(new THREE.CylinderGeometry(0.55, 0.6, 6, 12), { y: 3 }), 0xe8e0d0, 0.05), paint(xf(new THREE.BoxGeometry(1.5, 0.35, 1.5), { y: 0.17 }), 0xd8d0c0), paint(xf(new THREE.BoxGeometry(1.5, 0.35, 1.5), { y: 6.1 }), 0xd8d0c0)]), shadow: true }; },
  banner(v) { const col = [0x8a1a2a, 0x2a3a8a, 0xc08a2a][v % 3]; return { std: merge([paint(xf(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 5), { y: 3.6, rz: Math.PI / 2 }), 0x3a2a1a), paint(xf(new THREE.BoxGeometry(1.4, 2.8, 0.05), { y: 2.2 }), col, 0.05), paint(xf(new THREE.ConeGeometry(0.7, 0.6, 3), { y: 0.55, rx: Math.PI, sz: 0.07 }), col)]) }; },
  statue(v) { // heroic statue: sword raised to the sky
    const m = 0xc8c0b0;
    return { std: merge([paint(xf(new THREE.BoxGeometry(2.4, 1.2, 2.4), { y: 0.6 }), 0x8a8478), paint(xf(new THREE.CylinderGeometry(0.5, 0.35, 1.6, 8), { y: 3.2 }), m), paint(xf(new THREE.SphereGeometry(0.35, 10, 8), { y: 4.35 }), m), paint(xf(new THREE.CylinderGeometry(0.2, 0.22, 1.5, 6), { x: -0.3, y: 1.9 }), m), paint(xf(new THREE.CylinderGeometry(0.2, 0.22, 1.5, 6), { x: 0.3, y: 1.9 }), m), paint(xf(new THREE.CylinderGeometry(0.13, 0.13, 1.1, 6), { x: 0.6, y: 4.5, rz: -0.2 }), m), paint(xf(new THREE.BoxGeometry(0.14, 2.4, 0.04), { x: 0.8, y: 6.1 }), 0xe0e0e8)]), glow: { geo: xf(new THREE.OctahedronGeometry(0.25, 0), { x: 0.8, y: 7.4 }), color: 0x9ae8ff, intensity: 3 }, shadow: true };
  },
  anvil() { return { std: merge([paint(xf(new THREE.BoxGeometry(0.9, 0.35, 0.45), { y: 0.95 }), 0x3a3a40), paint(xf(new THREE.BoxGeometry(0.4, 0.6, 0.35), { y: 0.5 }), 0x3a3a40), paint(xf(new THREE.BoxGeometry(0.8, 0.2, 0.6), { y: 0.1 }), 0x5a4a3a)]), shadow: true }; },
  bookshelf() { return { std: merge([paint(xf(new THREE.BoxGeometry(2.2, 3, 0.5), { y: 1.5 }), 0x5a3a22), ...[0, 1, 2, 3].map((i) => paint(xf(new THREE.BoxGeometry(1.9, 0.5, 0.35), { y: 0.5 + i * 0.7, z: 0.1 }), [0x8a2a2a, 0x2a4a7a, 0x6a5a2a, 0x3a5a3a][i], 0.4, i))]), shadow: true }; },
  fireplace() { return { std: paint(xf(new THREE.BoxGeometry(0.1, 0.1, 0.1), {}), 0x000000), glow: { geo: merge([0, 1, 2].map((i) => lumpy(xf(new THREE.ConeGeometry(0.35 - i * 0.05, 1.1 - i * 0.2, 6), { x: (i - 1) * 0.35, y: 0.5 }), 0.2, i))), color: 0xff8a2a, intensity: 3.5 } }; },
  hull(v) { // Astral/sci-fi console
    return { std: merge([paint(xf(new THREE.BoxGeometry(1.2, 1, 0.7), { y: 0.5 }), 0x5a6470), paint(xf(new THREE.BoxGeometry(1.1, 0.5, 0.1), { y: 1.3, z: -0.2, rx: -0.4 }), 0x3a4048)]), glow: { geo: xf(new THREE.BoxGeometry(0.9, 0.35, 0.02), { y: 1.3, z: -0.14, rx: -0.4 }), color: 0x40e0ff, intensity: 2 }, shadow: true };
  },
  crate(v) { return { std: paint(xf(new THREE.BoxGeometry(1, 1, 1), { y: 0.5, ry: v * 0.3 }), v % 2 ? 0x7a6a4a : 0x5a6a4a, 0.15), shadow: true }; },
};

const matStd = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 });
// Scenery near the camera dissolves (screen-door dither) so foliage never blocks the view of the fight.
matStd.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPropWorld;').replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvPropWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvPropWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPropWorld;').replace('void main() {', 'void main() {\n  float camD = distance(vPropWorld, cameraPosition);\n  if (camD < 4.5) { float th = fract(dot(floor(gl_FragCoord.xy), vec2(0.5, 0.25))) ; if (th + 0.1 > (camD - 1.0) / 3.5) discard; }');
};
const glowMats = new Map();
function glowMat(color, intensity) { const k = color + ':' + intensity; if (!glowMats.has(k)) glowMats.set(k, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.4 })); return glowMats.get(k); }
const geoCache = new Map();

// props: [{ type, v, x, y, z, s, r }]
export function buildProps(group, props) {
  const byKey = new Map();
  const q = quality();
  for (const p of props) {
    if ((p.type === 'grass' || p.type === 'flower') && hash3(p.x * 7 | 0, 3, p.z * 7 | 0) > q.grass) continue;
    if ((p.type === 'bush' || p.type === 'rock' || p.type === 'floatrock') && hash3(p.x * 5 | 0, 9, p.z * 5 | 0) > q.props) continue; const k = p.type + ':' + (p.v || 0); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(p); }
  const d = new THREE.Object3D();
  for (const [k, list] of byKey) {
    const [type, v] = k.split(':');
    if (!geoCache.has(k)) geoCache.set(k, B[type](+v));
    const def = geoCache.get(k);
    const add = (geo, mat, shadow) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((p, i) => { d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.r ?? hash3(p.x | 0, 7, p.z | 0) * 6.28, 0); d.scale.setScalar(p.s || 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.castShadow = !!shadow; im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
    };
    if (def.std) add(def.std, matStd, def.shadow);
    if (def.glow) add(def.glow.geo, glowMat(def.glow.color, def.glow.intensity), false);
  }
}
B.tent = (v) => ({ std: merge([paint(xf(new THREE.ConeGeometry(1.7, 2.2, 4), { y: 1.1, ry: Math.PI / 4 }), v % 2 ? 0xb89a70 : 0x8a5a3a, 0.1), paint(xf(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 4), { y: 1.3 }), 0x4a3020)]), shadow: true });
B.campfire = () => ({ std: merge([0, 1, 2, 3, 4, 5].map((i) => paint(xf(new THREE.DodecahedronGeometry(0.22, 0), { x: Math.cos(i) * 0.6, y: 0.1, z: Math.sin(i) * 0.6 }), 0x6a6660)).concat([paint(xf(new THREE.CylinderGeometry(0.07, 0.07, 1, 5), { y: 0.12, rz: Math.PI / 2, ry: 0.5 }), 0x4a3020), paint(xf(new THREE.CylinderGeometry(0.07, 0.07, 1, 5), { y: 0.14, rz: Math.PI / 2, ry: -0.7 }), 0x4a3020)])), glow: { geo: merge([0, 1, 2].map((i) => lumpy(xf(new THREE.ConeGeometry(0.28 - i * 0.05, 0.9 - i * 0.2, 6), { x: (i - 1) * 0.2, y: 0.45 }), 0.2, i))), color: 0xff8a2a, intensity: 4 } });
B.stake = (v) => ({ std: merge([paint(xf(new THREE.CylinderGeometry(0.06, 0.1, 2.2, 5), { y: 1.1 }), 0x5a4030), paint(xf(new THREE.SphereGeometry(0.2, 8, 6), { y: 2.35, sy: 1.2 }), 0xe8e0c8)]), shadow: true });
B.floatrock = (v) => ({ std: paint(lumpy(xf(new THREE.DodecahedronGeometry(1, 1), { sy: 0.6 }), 0.5, v + 3), [0x7a7670, 0x6a6a80, 0x8a7a6a][v % 3], 0.15), shadow: true });
