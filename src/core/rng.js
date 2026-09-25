// Seeded randomness + value noise used by every procedural generator.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Rng {
  constructor(seed = Date.now()) { this.r = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed); }
  next() { return this.r(); }
  range(a, b) { return a + (b - a) * this.r(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this.r()); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length)]; }
  chance(p) { return this.r() < p; }
  shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
  weighted(items, wKey = 'w') { const t = items.reduce((s, i) => s + i[wKey], 0); let v = this.r() * t; for (const i of items) { v -= i[wKey]; if (v <= 0) return i; } return items[items.length - 1]; }
}

export const rng = new Rng();
export const d = (sides) => 1 + Math.floor(Math.random() * sides);

function smooth(t) { return t * t * (3 - 2 * t); }
export function noise2(x, z, seed = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash3(xi, seed, zi), b = hash3(xi + 1, seed, zi), c = hash3(xi, seed, zi + 1), e = hash3(xi + 1, seed, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
}
export function fbm2(x, z, seed = 0, oct = 4) {
  let s = 0, amp = 1, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += noise2(x * f, z * f, seed + i * 17) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return s / norm;
}
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const h = (i, j, k) => hash3(xi + i + seed * 31, yi + j, zi + k);
  return l(l(l(h(0,0,0), h(1,0,0), xf), l(h(0,1,0), h(1,1,0), xf), yf),
           l(l(h(0,0,1), h(1,0,1), xf), l(h(0,1,1), h(1,1,1), xf), yf), zf);
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
