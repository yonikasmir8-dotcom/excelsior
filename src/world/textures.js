// Procedural painterly textures (canvas → THREE textures). Mostly light, low-contrast detail maps that
// are tinted per material, so one texture serves many surfaces.
import * as THREE from 'three';
import { hash3, noise2, fbm2 } from '../core/rng.js';

const cache = new Map();
const S = 256;

function canvas() { const c = document.createElement('canvas'); c.width = c.height = S; return [c, c.getContext('2d')]; }
function toTex(c, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function noiseFill(g, base, amp, scale = 0.05, seed = 1) {
  const img = g.getImageData(0, 0, S, S); const d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // tileable fbm: blend 4 samples
    const u = x / S, v = y / S;
    const n = (f) => fbm2(x * f, y * f, seed) * (1 - u) * (1 - v) + fbm2((x - S) * f, y * f, seed) * u * (1 - v) + fbm2(x * f, (y - S) * f, seed) * (1 - u) * v + fbm2((x - S) * f, (y - S) * f, seed) * u * v;
    const k = (n(scale) - 0.5) * amp;
    const i = (y * S + x) * 4;
    d[i] = Math.max(0, Math.min(255, d[i] * base + k * 255)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] * base + k * 255)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] * base + k * 255));
  }
  g.putImageData(img, 0, 0);
}
function speckle(g, n, a, size = 1.5) {
  for (let i = 0; i < n; i++) { const x = Math.random() * S, y = Math.random() * S; g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; g.fillRect(x, y, size, size); }
}

const GEN = {
  stone() { // ashlar blocks
    const [c, g] = canvas(); g.fillStyle = '#c8c4bc'; g.fillRect(0, 0, S, S);
    const rows = 4; const rh = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -40; const y = r * rh;
      while (x < S) {
        const w = 70 + Math.floor(hash3(r, x, 3) * 60);
        const l = 180 + Math.floor(hash3(r, x, 7) * 50);
        g.fillStyle = `rgb(${l},${l - 4},${l - 10})`; g.fillRect(x + 3, y + 3, w - 6, rh - 6);
        if (x + w > S) { g.fillRect(x + 3 - S, y + 3, w - 6, rh - 6); }
        x += w;
      }
    }
    noiseFill(g, 1, 0.35, 0.04, 2); speckle(g, 900, 0.12);
    return toTex(c);
  },
  cobble() {
    const [c, g] = canvas(); g.fillStyle = '#6a655e'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {
      const x = hash3(i, 1, 2) * S, y = hash3(i, 3, 4) * S, r = 12 + hash3(i, 5, 6) * 12; const l = 150 + hash3(i, 7, 8) * 70;
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { g.fillStyle = `rgb(${l},${l - 3},${l - 8})`; g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.8, i, 0, 7); g.fill(); }
    }
    noiseFill(g, 1, 0.3, 0.05, 3); return toTex(c);
  },
  plank() {
    const [c, g] = canvas(); const boards = 4; const bw = S / boards;
    for (let b = 0; b < boards; b++) {
      const l = 170 + hash3(b, 9, 1) * 50; g.fillStyle = `rgb(${l},${l * 0.8},${l * 0.6})`; g.fillRect(b * bw, 0, bw, S);
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(60,35,15,${0.08 + Math.random() * 0.1})`; g.lineWidth = 1; g.beginPath(); const x = b * bw + Math.random() * bw; g.moveTo(x, 0); g.bezierCurveTo(x + 6, S * 0.3, x - 6, S * 0.6, x + 3, S); g.stroke(); }
      g.fillStyle = 'rgba(30,18,8,0.7)'; g.fillRect(b * bw, 0, 2, S);
      const seam = hash3(b, 2, 2) * S; g.fillRect(b * bw, seam, bw, 2);
    }
    noiseFill(g, 1, 0.12, 0.03, 4); return toTex(c);
  },
  bark() {
    const [c, g] = canvas(); g.fillStyle = '#8a6a4a'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 90; k++) { g.strokeStyle = `rgba(40,25,12,${0.2 + Math.random() * 0.3})`; g.lineWidth = 2 + Math.random() * 3; const x = Math.random() * S; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - .5) * 20, S); g.stroke(); }
    noiseFill(g, 1, 0.25, 0.05, 5); return toTex(c);
  },
  marble() {
    const [c, g] = canvas(); g.fillStyle = '#ece8e0'; g.fillRect(0, 0, S, S);
    const img = g.getImageData(0, 0, S, S); const d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = Math.sin((x + y) * 0.03 + fbm2(x * 0.02, y * 0.02, 6) * 9); const k = Math.pow(Math.abs(v), 0.15);
      const i = (y * S + x) * 4; const l = 200 + k * 50; d[i] = l; d[i + 1] = l - 2; d[i + 2] = l - 6;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(80,70,60,0.25)'; g.lineWidth = 2; for (let i = 0; i <= S; i += S / 2) { g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); }
    return toTex(c);
  },
  plaster() { const [c, g] = canvas(); g.fillStyle = '#e8dcc4'; g.fillRect(0, 0, S, S); noiseFill(g, 1, 0.18, 0.02, 7); speckle(g, 1500, 0.06); return toTex(c); },
  metal() {
    const [c, g] = canvas(); g.fillStyle = '#b0a080'; g.fillRect(0, 0, S, S); noiseFill(g, 1, 0.2, 0.08, 8);
    g.strokeStyle = 'rgba(40,30,20,0.5)'; g.lineWidth = 3; g.strokeRect(2, 2, S - 4, S / 2 - 4); g.strokeRect(2, S / 2 + 2, S - 4, S / 2 - 4);
    g.fillStyle = 'rgba(60,45,30,0.7)'; for (const [x, y] of [[12, 12], [S - 12, 12], [12, S / 2 - 12], [S - 12, S / 2 - 12], [12, S / 2 + 12], [S - 12, S / 2 + 12], [12, S - 12], [S - 12, S - 12]]) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    return toTex(c);
  },
  roof() {
    const [c, g] = canvas(); g.fillStyle = '#7a3a2a'; g.fillRect(0, 0, S, S);
    for (let r = 0; r < 8; r++) for (let k = 0; k < 8; k++) { const l = 0.8 + hash3(r, k, 9) * 0.35; g.fillStyle = `rgba(${150 * l},${80 * l},${60 * l},1)`; g.beginPath(); g.ellipse(k * 32 + (r % 2) * 16, r * 32 + 24, 15, 20, 0, 0, Math.PI); g.fill(); }
    noiseFill(g, 1, 0.15, 0.05, 10); return toTex(c);
  },
  ground() { // grayscale detail for terrain (multiplied by vertex colour)
    const [c, g] = canvas(); g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, S, S); noiseFill(g, 1, 0.35, 0.06, 11); speckle(g, 4000, 0.08, 1.2);
    for (let i = 0; i < 500; i++) { const x = Math.random() * S, y = Math.random() * S; g.strokeStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},0,0.07)`; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 4, y - 3 - Math.random() * 5); g.stroke(); }
    return toTex(c);
  },
  rug() {
    const [c, g] = canvas(); g.fillStyle = '#8a2a2a'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#d8b060'; g.lineWidth = 6; g.strokeRect(14, 14, S - 28, S - 28); g.lineWidth = 2; g.strokeRect(26, 26, S - 52, S - 52);
    g.fillStyle = 'rgba(216,176,96,0.6)'; for (let i = 0; i < 4; i++) { g.save(); g.translate(S / 2, S / 2); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(0, -60); g.lineTo(20, -20); g.lineTo(0, 0); g.lineTo(-20, -20); g.fill(); g.restore(); }
    noiseFill(g, 1, 0.15, 0.1, 12); return toTex(c);
  },
  rune() {
    const [c, g] = canvas(); g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); return toTex(c);
  },
  leaf() { const [c, g] = canvas(); g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S); noiseFill(g, 1, 0.4, 0.09, 13); speckle(g, 3000, 0.15, 2); return toTex(c); },
  soft() { // radial soft particle
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
  },
  runeCircle() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.translate(128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 120, 0, 7); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 104, 0, 7); g.stroke();
    g.font = '20px serif'; g.fillStyle = 'rgba(255,255,255,0.9)'; const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; i++) { g.save(); g.rotate(i / 24 * Math.PI * 2); g.fillText(glyphs[i], -6, -108); g.restore(); }
    g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.lineTo(Math.cos(a) * 90, Math.sin(a) * 90); } g.closePath(); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  },
};

export function tex(name) {
  if (!cache.has(name)) cache.set(name, (GEN[name] || GEN.plaster)());
  return cache.get(name);
}
