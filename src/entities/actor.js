// Base actor: physics body + voxel model + stats + statuses. Heroes, enemies, NPCs and minions all extend this.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { VoxelModel } from './model.js';

const GRAV = 30;
let nextId = 1;

export class Actor {
  constructor(opts) {
    this.id = nextId++;
    this.name = opts.name || '???';
    this.team = opts.team || 'enemy';
    this.pos = new THREE.Vector3().copy(opts.pos || new THREE.Vector3());
    this.vel = new THREE.Vector3();
    this.yaw = opts.yaw || 0;
    this.radius = opts.radius ?? 0.35;
    this.height = opts.height ?? 1.8;
    this.grounded = false; this.airJumps = 0;
    this.maxHp = opts.hp || 30; this.hp = this.maxHp;
    this.ac = opts.ac ?? 12; this.atk = opts.atk ?? 3; this.pow = opts.pow ?? 1;
    this.speed = opts.speed ?? 6;
    this.level = opts.level || 1;
    this.statuses = new Map();
    this.cds = {};
    this.dead = false; this.downed = false;
    this.flying = !!opts.flying;
    this.moveInput = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.lastHitBy = null;
    this.threat = new Map();
    if (opts.model) {
      this.model = new VoxelModel(opts.model);
      this.model.root.position.copy(this.pos);
      G.scene.add(this.model.root);
    }
  }
  center() { return this.pos.clone().add(new THREE.Vector3(0, this.height * 0.55, 0)); }
  head() { return this.pos.clone().add(new THREE.Vector3(0, this.height + 0.3, 0)); }
  forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  has(s) { return this.statuses.has(s); }
  status(s) { return this.statuses.get(s); }
  addStatus(id, dur, data = {}) {
    const cur = this.statuses.get(id);
    if (cur) { cur.t = Math.max(cur.t, dur); Object.assign(cur, data); return cur; }
    const s = { t: dur, max: dur, ...data }; this.statuses.set(id, s); return s;
  }
  removeStatus(id) { this.statuses.delete(id); }
  get canAct() { return !this.dead && !this.downed && !this.has('stun') && !this.has('frozen'); }
  speedMult() {
    let m = 1;
    if (this.has('slow')) m *= 0.5; if (this.has('haste')) m *= 1.4; if (this.has('snare') || this.has('stun') || this.has('root')) m = 0;
    return m;
  }
  faceTo(p, rate = 1) {
    const want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let dlt = want - this.yaw; while (dlt > Math.PI) dlt -= Math.PI * 2; while (dlt < -Math.PI) dlt += Math.PI * 2;
    this.yaw += dlt * Math.min(1, rate);
  }
  tickStatuses(dt) {
    for (const [k, s] of this.statuses) {
      s.t -= dt;
      if (s.onTick) { s.acc = (s.acc || 0) + dt; while (s.acc >= (s.every || 0.5)) { s.acc -= (s.every || 0.5); s.onTick(this, s); } }
      if (s.t <= 0) { this.statuses.delete(k); s.onEnd && s.onEnd(this, s); }
    }
  }
  physics(dt) {
    const W = G.world; if (!W) return;
    const sm = this.speedMult();
    const desired = this.moveInput.clone().multiplyScalar(this.speed * sm);
    const accel = this.grounded ? 14 : 5;
    this.vel.x += (desired.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (desired.z - this.vel.z) * Math.min(1, accel * dt);
    if (this.flying) this.vel.y += (((this.hoverY ?? this.pos.y) - this.pos.y) * 4 - this.vel.y) * Math.min(1, dt * 4);
    else if (!this.noGravity) this.vel.y -= GRAV * (this.gravScale ?? 1) * dt;
    this.vel.y = Math.max(this.vel.y, -40);
    const kv = this.knock; const total = this.vel.clone().add(kv);
    kv.multiplyScalar(Math.max(0, 1 - dt * 6));
    this.moveAxis(total.x * dt, 0); this.moveAxis(total.z * dt, 2);
    const wasG = this.grounded; this.grounded = false;
    this.moveAxis(total.y * dt, 1);
    if (this.pos.y < -10) this.onVoid();
    if (!wasG && this.grounded) this.onLand?.();
  }
  moveAxis(d, axis) {
    if (d === 0) return;
    const W = G.world, r = this.radius, h = this.height;
    const p = this.pos.clone(); p.setComponent(axis, p.getComponent(axis) + d);
    const hit = W.boxHits(p.x - r, p.y, p.z - r, p.x + r, p.y + h, p.z + r);
    if (!hit) { this.pos.copy(p); return; }
    if (axis === 1) {
      if (d < 0) { this.pos.y = Math.floor(this.pos.y + d) + 1; this.grounded = true; this.airJumps = 0; }
      else this.pos.y = Math.min(this.pos.y, Math.ceil(this.pos.y + h + d) - h - 1e-3);
      this.vel.y = 0; this.knock.y = 0; return;
    }
    // auto step-up one block when grounded (keeps traversal fluid)
    if ((this.grounded || this.vel.y <= 0.1) && !this.flying) {
      const up = p.clone(); up.y = Math.floor(this.pos.y) + 1.001;
      if (up.y - this.pos.y <= 1.05 && !W.boxHits(up.x - r, up.y, up.z - r, up.x + r, up.y + h, up.z + r)) { this.pos.copy(up); return; }
    }
    if (axis === 0) this.vel.x = 0; else this.vel.z = 0;
    this.knock.setComponent(axis, 0);
    this.blocked = true;
  }
  onVoid() { const W = G.world; this.pos.set(W.w / 2, W.h, W.d / 2); if (this.spawn) this.pos.copy(this.spawn); this.vel.set(0, 0, 0); }
  syncModel(dt) {
    if (!this.model) return;
    const r = this.model.root;
    r.position.copy(this.pos);
    let dy = this.yaw - r.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    r.rotation.y += dy * Math.min(1, dt * 14);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.model.downed = this.downed;
    this.model.update(dt, hs > 0.6, Math.min(1, hs / 8), this.grounded || this.flying);
    const inv = this.has('stealth');
    if (inv !== this._inv) { this._inv = inv; this.model.mats.forEach((m) => { m.transparent = inv; m.opacity = inv ? 0.35 : 1; }); }
  }
  update(dt) { this.tickStatuses(dt); this.physics(dt); this.syncModel(dt); }
  remove() {
    this.dead = true;
    if (this.model) { G.scene.remove(this.model.root); this.model.dispose(); }
    const i = G.entities.indexOf(this); if (i >= 0) G.entities.splice(i, 1);
  }
}
