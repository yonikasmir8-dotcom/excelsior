// Visual + gameplay effects: projectiles, particles, beams, telegraphs, zones, comic popups.
import * as THREE from 'three';
import { G } from '../core/state.js';

const MAXP = 900;
let particles = [], pMesh = null;
const dummy = new THREE.Object3D();
const tmpC = new THREE.Color();
let popLayer = null;
const popups = [];

export const FX = { shake: 0, hitstop: 0 };

export function initEffects() {
  if (pMesh) { G.scene.add(pMesh); return; }
  pMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXP);
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pMesh.frustumCulled = false;
  for (let i = 0; i < MAXP; i++) pMesh.setColorAt(i, tmpC.setHex(0xffffff));
  G.scene.add(pMesh);
  popLayer = document.createElement('div'); popLayer.id = 'popups'; document.body.appendChild(popLayer);
}
export function clearEffects() {
  particles = [];
  for (const e of G.effects) e.dispose?.();
  G.effects = [];
  popups.forEach((p) => p.el.remove()); popups.length = 0;
}

export function burst(pos, color = 0xffaa33, n = 12, speed = 5, life = 0.6, size = 0.18, grav = -9) {
  for (let i = 0; i < n && particles.length < MAXP; i++) {
    const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    particles.push({ p: pos.clone(), v, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), c: Array.isArray(color) ? color[i % color.length] : color, g: grav, rot: Math.random() * 6 });
  }
}
export function debris(blocks) {
  for (const b of blocks.slice(0, 28)) burst(new THREE.Vector3(b.x + 0.5, b.y + 0.5, b.z + 0.5), b.c, 1, 7, 1.0, 0.26, -18);
}

function updateParticles(dt) {
  let n = 0;
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.life -= dt; if (q.life <= 0) { particles.splice(i, 1); continue; }
    q.v.y += q.g * dt; q.p.addScaledVector(q.v, dt); q.rot += dt * 6;
    if (G.world && G.world.isSolid(q.p.x, q.p.y, q.p.z)) { q.v.multiplyScalar(-0.3); q.p.addScaledVector(q.v, dt * 2); }
  }
  for (const q of particles) {
    const s = q.size * Math.min(1, q.life / q.max * 2);
    dummy.position.copy(q.p); dummy.rotation.set(q.rot, q.rot * 0.7, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
    pMesh.setMatrixAt(n, dummy.matrix); pMesh.setColorAt(n, tmpC.setHex(q.c)); n++;
  }
  pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
}

// ── generic effect objects ───────────────────────────────────────────────────
class Fx {
  constructor(obj, life) { this.obj = obj; this.life = life; this.t = 0; if (obj) G.scene.add(obj); G.effects.push(this); }
  update(dt) { this.t += dt; return this.t < this.life; }
  dispose() { if (this.obj) { G.scene.remove(this.obj); this.obj.traverse?.((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); } }
}

export function beam(a, b, color = 0x80e0ff, width = 0.15, life = 0.15, jag = 0) {
  const g = new THREE.Group();
  const segs = jag ? 5 : 1; let prev = a.clone();
  for (let i = 1; i <= segs; i++) {
    const t = i / segs; const p = a.clone().lerp(b, t);
    if (jag && i < segs) p.add(new THREE.Vector3((Math.random() - 0.5) * jag, (Math.random() - 0.5) * jag, (Math.random() - 0.5) * jag));
    const len = prev.distanceTo(p);
    const m = new THREE.Mesh(new THREE.BoxGeometry(width, width, len), new THREE.MeshBasicMaterial({ color }));
    m.position.copy(prev).lerp(p, 0.5); m.lookAt(p); g.add(m); prev = p;
  }
  const f = new Fx(g, life);
  f.update = function (dt) { this.t += dt; g.children.forEach((c) => c.scale.set(1 - this.t / this.life, 1 - this.t / this.life, 1)); return this.t < this.life; };
  return f;
}

export function ring(pos, radius = 3, color = 0xffffff, life = 0.35) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.copy(pos); m.position.y += 0.1;
  const f = new Fx(m, life);
  f.update = function (dt) { this.t += dt; const k = this.t / this.life; m.scale.setScalar(radius * (0.2 + k * 0.8)); m.material.opacity = 1 - k; return this.t < this.life; };
  return f;
}

// Ground telegraph: warns the player, then fires onDone. Fair, readable danger.
export function telegraph(pos, radius, delay, color, onDone, owner = null) {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  const edge = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  [fill, edge, inner].forEach((m) => { m.rotation.x = -Math.PI / 2; g.add(m); });
  g.position.copy(pos); g.position.y = (G.world ? G.world.groundBelow(pos.x, pos.y + 1, pos.z) : pos.y) + 0.06;
  g.scale.setScalar(radius);
  const f = new Fx(g, delay);
  f.owner = owner; f.kind = 'telegraph'; f.pos = g.position; f.radius = radius; f.hostile = !owner || owner.team === 'enemy';
  f.update = function (dt) {
    this.t += dt; const k = Math.min(1, this.t / this.life);
    inner.scale.setScalar(k); edge.material.opacity = 0.5 + 0.5 * Math.sin(this.t * 20);
    if (this.owner && this.owner.dead) return false;
    if (this.t >= this.life) { onDone(g.position.clone()); return false; }
    return true;
  };
  return f;
}

export function zone({ pos, radius, life, color, tick, tag, owner, opacity = 0.18, onEnd }) {
  const g = new THREE.Group();
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  fill.rotation.x = -Math.PI / 2; g.add(fill);
  const edge = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  edge.rotation.x = -Math.PI / 2; g.add(edge);
  g.position.copy(pos); g.position.y = (G.world ? G.world.groundBelow(pos.x, pos.y + 1, pos.z) : pos.y) + 0.05; g.scale.setScalar(radius);
  const f = new Fx(g, life);
  Object.assign(f, { pos: g.position, radius, tag, owner, color, kind: 'zone' });
  let acc = 0;
  f.update = function (dt) {
    this.t += dt; acc += dt;
    if (acc >= 0.25) { acc -= 0.25; tick && tick(this, 0.25); if (Math.random() < 0.8) burst(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius * 1.6, 0.2, (Math.random() - 0.5) * radius * 1.6)), color, 1, 1.5, 0.8, 0.15, 2); }
    edge.rotation.z += dt;
    if (this.t >= this.life) { onEnd && onEnd(this); return false; }
    return true;
  };
  return f;
}

export function spawnProjectile(o) {
  const size = o.size || 0.3;
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size * (o.long || 1.6)), new THREE.MeshBasicMaterial({ color: o.color || 0xffaa33 }));
  m.position.copy(o.from);
  const f = new Fx(m, o.life || 2.5);
  f.vel = o.dir.clone().normalize().multiplyScalar(o.speed || 20);
  f.owner = o.owner; f.hitSet = new Set(); f.kind = 'projectile'; f.team = o.owner ? o.owner.team : 'enemy';
  f.update = function (dt) {
    this.t += dt; if (this.t > this.life) { o.onExpire && o.onExpire(m.position.clone()); return false; }
    if (o.gravity) this.vel.y -= o.gravity * dt;
    if (o.homing && o.target && !o.target.dead) {
      const want = o.target.center().sub(m.position).normalize().multiplyScalar(this.vel.length());
      this.vel.lerp(want, Math.min(1, dt * o.homing));
    }
    const step = this.vel.clone().multiplyScalar(dt);
    const next = m.position.clone().add(step);
    m.lookAt(next); m.position.copy(next);
    if (Math.random() < 0.6) burst(m.position.clone(), o.trail || o.color || 0xffaa33, 1, 0.5, 0.25, size * 0.6, 0);
    if (G.world && G.world.isSolid(next.x, next.y, next.z)) { o.onWorld && o.onWorld(next.clone()); return false; }
    for (const e of G.entities) {
      if (e.dead || e.team === this.team || e.team === 'npc' || e.untargetable || this.hitSet.has(e)) continue;
      if (e.pos.distanceTo(next) < e.radius + 0.5 + size * 0.5 && next.y > e.pos.y - 0.3 && next.y < e.pos.y + e.height + 0.3) {
        this.hitSet.add(e);
        o.onHit && o.onHit(e, next.clone());
        if (!o.pierce || this.hitSet.size > o.pierce) return false;
      }
    }
    return true;
  };
  return f;
}

// Stand-in world object that ticks (turret base, bomb, mine, etc.)
export function timed(life, update, obj = null) { const f = new Fx(obj, life); f.update = function (dt) { this.t += dt; if (update(this, dt) === false) return false; return this.t < this.life; }; return f; }

// ── comic popups (HTML so the lettering stays crisp) ─────────────────────────
const v3 = new THREE.Vector3();
export function popText(pos, text, style = 'dmg', opts = {}) {
  if (!popLayer) return;
  const el = document.createElement('div');
  el.className = 'pop pop-' + style; el.textContent = text;
  if (opts.color) el.style.color = opts.color;
  if (opts.size) el.style.fontSize = opts.size + 'px';
  popLayer.appendChild(el);
  const rot = (Math.random() - 0.5) * (style === 'sfx' ? 24 : 10);
  popups.push({ el, pos: pos.clone(), t: 0, life: opts.life || (style === 'sfx' ? 0.9 : 0.8), rot, dx: (Math.random() - 0.5) * 30 });
  if (popups.length > 40) { const p = popups.shift(); p.el.remove(); }
}
function updatePopups(dt) {
  const w = innerWidth, h = innerHeight;
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i]; p.t += dt;
    if (p.t >= p.life) { p.el.remove(); popups.splice(i, 1); continue; }
    v3.copy(p.pos); v3.y += p.t * 1.2; v3.project(G.camera);
    if (v3.z > 1) { p.el.style.display = 'none'; continue; }
    p.el.style.display = '';
    const k = p.t / p.life;
    const sc = k < 0.12 ? 0.4 + k / 0.12 * 0.9 : 1.3 - Math.min(0.3, (k - 0.12) * 1.2);
    p.el.style.transform = `translate(${(v3.x * 0.5 + 0.5) * w + p.dx * k}px, ${(-v3.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) rotate(${p.rot}deg) scale(${sc})`;
    p.el.style.opacity = k > 0.75 ? String(1 - (k - 0.75) * 4) : '1';
  }
}

export function updateEffects(dt) {
  for (let i = G.effects.length - 1; i >= 0; i--) {
    const f = G.effects[i];
    let alive = true;
    try { alive = f.update(dt); } catch (e) { console.error(e); alive = false; }
    if (!alive) { f.dispose(); G.effects.splice(i, 1); }
  }
  updateParticles(dt);
}
export function updatePopupsFrame(dt) { updatePopups(dt); }
export function shake(a) { FX.shake = Math.min(1.2, FX.shake + a); }
export function hitstop(t) { FX.hitstop = Math.max(FX.hitstop, t); }
