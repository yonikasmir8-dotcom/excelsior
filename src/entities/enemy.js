// Enemies: data-driven archetypes with telegraphed attacks, pack aggro, captains (nemeses) and bosses.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { Actor } from './actor.js';
import { ENEMY_TYPES } from '../game/enemies.js';
import { strike, enemiesOf, dealDamage, heal, startCombat, rollDice } from '../game/combat.js';
import { spawnProjectile, telegraph, burst, popText, ring, shake } from '../game/effects.js';
import { TRAITS, captainScale, fullName, fleeLine } from '../game/nemesis.js';
import { emit } from '../core/events.js';
import { Audio } from '../core/audio.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const DIFF = { story: { hp: 0.7, dmg: 0.55 }, normal: { hp: 1, dmg: 1 }, hard: { hp: 1.35, dmg: 1.4 } };

export class Enemy extends Actor {
  constructor(typeKey, pos, level, opts = {}) {
    const T = ENEMY_TYPES[typeKey];
    const spec = JSON.parse(JSON.stringify(T.model));
    const cap = opts.captain;
    if (cap) {
      spec.scale = (spec.scale || 1) * captainScale(cap);
      spec.extras = [...(spec.extras || []), ...cap.scars];
      if (!spec.hat || spec.hat === 'bandana') spec.hat = cap.rank >= 2 ? 'crown' : 'horns';
      const c = new THREE.Color().setHSL(cap.hue, 0.7, 0.45).getHex();
      spec.colors.accent = c; spec.colors.cape = c; spec.extras.push('cape');
    }
    if (opts.skin) Object.assign(spec.colors, opts.skin);
    const L = level;
    const diff = DIFF[G.settings.difficulty || 'normal'];
    let hp = T.hp * (1 + 0.3 * (L - 1)) * 2.4 * diff.hp;
    if (cap) hp *= 3.2 + cap.rank * 0.6;
    if (opts.hpMult) hp *= opts.hpMult;
    super({ name: cap ? fullName(cap) : T.name, team: 'enemy', pos, hp: Math.round(hp), ac: T.ac + Math.floor(L / 5) + (cap ? 1 : 0), atk: 2 + Math.floor(L / 3),
      speed: T.speed, model: spec, radius: 0.4 * (spec.scale || 1), height: 1.8 * (spec.scale || 1) * (spec.kind === 'beast' ? 0.7 : 1), flying: T.flying });
    this.type = typeKey; this.def = T; this.level = L;
    this.pow = (1 + 0.14 * (L - 1)) * (cap ? 1.35 : 1) * (opts.powMult || 1) * 1.7 * diff.dmg;
    this.home = pos.clone(); this.spawn = pos.clone();
    this.ai = T.ai; this.aggro = false; this.atkCd = 1 + Math.random(); this.windup = 0; this.action = null;
    this.isElite = !!T.elite; this.knockResist = T.knockResist || 0;
    this.bloodColor = T.flying || spec.kind === 'drone' ? 0xffd060 : 0xc02020;
    this.hoverY = pos.y + 1; this.xp = T.xp * (cap ? 6 : 1) * (1 + L * 0.08);
    this.captain = cap || null; this.isNemesis = !!cap;
    this.resist = {};
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.born = G.time;
    if (cap) {
      for (const t of cap.traits) { const tr = TRAITS[t]; if (tr && tr.resist) Object.assign(this.resist, tr.resist); }
      if (cap.traits.includes('berserker')) { this.pow *= 1.4; this.ac -= 2; }
      if (cap.traits.includes('critproof')) this.critImmune = true;
      this.knockResist = Math.max(this.knockResist, 0.5);
    }
    G.entities.push(this);
  }
  trait(t) { return this.captain && this.captain.traits.includes(t); }
  reveal(t) { if (this.captain && !this.captain.known.includes(t)) { this.captain.known.push(t); popText(this.head(), TRAITS[t].name.toUpperCase() + '!', 'info', { color: '#ff7a2a' }); emit('traitRevealed', { c: this.captain, t }); } }
  chooseTarget() {
    if (this.tauntedBy && !this.tauntedBy.dead && !this.tauntedBy.downed && !this.trait('iron_will')) return this.tauntedBy;
    let best = null, bs = -1;
    for (const e of enemiesOf('enemy')) {
      if (e.untargetable) continue;
      const dist = e.pos.distanceTo(this.pos);
      if (e.has('stealth') && dist > 1.8) continue;
      if (dist > 30) continue;
      let s = 30 - dist + (this.threat.get(e) || 0) * 0.3;
      if (this.captain && this.captain.grudge === e.classId) s += 15;
      if (e.isMinion) s -= 6;
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }
  alert() {
    if (this.aggro) return; this.aggro = true; startCombat();
    for (const e of G.entities) if (e.team === 'enemy' && !e.aggro && e.pos.distanceTo(this.pos) < 14) { e.aggro = true; }
    if (this.captain) emit('captainEncounter', { enemy: this, c: this.captain });
  }
  onHurt(amt, src) {
    if (!this.aggro) this.alert();
    if (this.trait('overconfident') && G.time - this.born < 6) { this.hp -= amt * 0.5; this.reveal('overconfident'); }
    if (this.captain) {
      this.lastDmgType = this._lastType;
      const f = this.hp / this.maxHp;
      if (this.trait('vengeful') && f < 0.5 && !this.enraged) { this.enraged = true; this.pow *= 1.35; this.speed *= 1.3; this.reveal('vengeful'); Audio.play('roar'); popText(this.head(), 'ENRAGED!', 'crit-banner', { color: '#ff3a3a' }); }
      if (this.trait('summoner') && f < 0.6 && !this.summoned) { this.summoned = true; this.reveal('summoner'); for (let i = 0; i < 3; i++) new Enemy(G.realm.pool.common[i % G.realm.pool.common.length], this.pos.clone().add(V((Math.random() - .5) * 6, 0.5, (Math.random() - .5) * 6)), this.level).aggro = true; popText(this.head(), 'TO ME, WARBAND!', 'sfx'); }
      if (f < 0.25 && !this.fleeing && (this.trait('coward') || (Math.random() < 0.02 && this.captain.rank < 2))) { this.fleeing = true; this.fleeT = 4; this.reveal('coward'); popText(this.head(), fleeLine(this.captain), 'speech'); }
    }
  }
  onDeath(src) {
    if (this.isBoss && this.bossPhase && this.bossPhase(src) === false) return false;
    if (this.captain) emit('captainDefeated', { enemy: this, c: this.captain, by: src, type: this.lastDmgType });
    return true;
  }
  update(dt) {
    if (this.dead) return;
    const T = this.def;
    this.moveInput.set(0, 0, 0);
    if (this.trait('iron_will')) { this.statuses.delete('stun'); this.statuses.delete('snare'); }
    if (this.trait('regenerator') && !this.has('burn') && !this.has('bleed')) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.012 * dt);
    if (this.isBoss) { this.bossUpdate?.(dt); super.update(dt); return; }
    if (!this.canAct) { this.windup = 0; this.action = null; super.update(dt); return; }
    const tgt = this.aggro ? this.chooseTarget() : null;
    if (!this.aggro) {
      // idle: wander + look for heroes
      this.wanderT = (this.wanderT || 0) - dt;
      if (this.wanderT <= 0) { this.wanderT = 2 + Math.random() * 3; this.wanderDir = Math.random() < 0.5 ? null : V(Math.random() - .5, 0, Math.random() - .5).normalize(); }
      if (this.wanderDir && this.pos.distanceTo(this.home) < 6) { this.moveInput.copy(this.wanderDir).multiplyScalar(0.4); this.yaw = Math.atan2(this.wanderDir.x, this.wanderDir.z); }
      else if (this.pos.distanceTo(this.home) >= 6) { const d = this.home.clone().sub(this.pos); d.y = 0; this.moveInput.copy(d.normalize()).multiplyScalar(0.5); }
      for (const h of G.party) if (!h.downed && !h.has('stealth') && h.pos.distanceTo(this.pos) < (this.captain ? 16 : 13)) { this.alert(); break; }
      super.update(dt); return;
    }
    if (this.fleeing) {
      this.fleeT -= dt; const away = this.pos.clone().sub(G.party[0].pos); away.y = 0; this.moveInput.copy(away.normalize()); this.speed = T.speed * 1.6; this.yaw = Math.atan2(away.x, away.z);
      if (this.fleeT <= 0) { burst(this.center(), 0x444444, 30, 5, 1, 0.4); emit('captainFled', { enemy: this, c: this.captain, type: this.lastDmgType || 'blunt' }); this.remove(); return; }
      super.update(dt); return;
    }
    if (!tgt) { this.aggro = false; super.update(dt); return; }
    this.target = tgt;
    const to = tgt.pos.clone().sub(this.pos); const dist = Math.hypot(to.x, to.z); to.y = 0; const dir = to.clone().normalize();
    this.atkCd -= dt;
    // blinded enemies stumble
    if (this.has('blind')) { this.moveInput.set(Math.sin(G.time * 3), 0, Math.cos(G.time * 2)).multiplyScalar(0.4); super.update(dt); return; }
    if (this.windup > 0) {
      this.windup -= dt; this.faceTo(tgt.pos, dt * 6);
      if (this.windup <= 0 && this.action) { const a = this.action; this.action = null; a(); }
      super.update(dt); return;
    }
    const reach = 1.4 + this.radius + tgt.radius;
    switch (this.ai) {
      case 'melee': case 'brute': {
        this.faceTo(tgt.pos, dt * 8);
        if (dist > reach * 0.85) this.moveInput.copy(dir);
        if (this.ai === 'brute' && this.atkCd <= 0 && dist < 7) { this.brute(tgt); break; }
        if (this.trait('teleporter') && this.atkCd <= 0 && dist > 5 && dist < 16 && Math.random() < 0.02) { this.blinkBehind(tgt); break; }
        if (dist <= reach && this.atkCd <= 0) this.melee(tgt);
        break; }
      case 'ranged': case 'caster': {
        this.faceTo(tgt.pos, dt * 6);
        const want = this.ai === 'caster' ? 10 : 9;
        if (dist > want + 3) this.moveInput.copy(dir);
        else if (dist < want - 3) this.moveInput.copy(dir).multiplyScalar(-1);
        else { this.moveInput.set(-dir.z * this.strafe, 0, dir.x * this.strafe).multiplyScalar(0.6); if (Math.random() < dt * 0.4) this.strafe *= -1; }
        if (this.flying) this.hoverY = tgt.pos.y + 2.5;
        if (this.atkCd <= 0 && dist < 22 && G.world.lineClear(this.center(), tgt.center())) {
          if (this.ai === 'caster') this.cast(tgt); else this.shoot(tgt);
        }
        break; }
      case 'blinker': {
        this.faceTo(tgt.pos, dt * 8);
        if (dist > reach) this.moveInput.copy(dir);
        if (this.atkCd <= 0 && dist > 4 && dist < 18) this.blinkBehind(tgt);
        else if (dist <= reach && this.atkCd <= 0) this.melee(tgt);
        break; }
    }
    if (this.blocked && this.grounded && this.moveInput.lengthSq() > 0.1) { this.vel.y = 10; this.blocked = false; }
    // leash
    if (this.pos.distanceTo(this.home) > 45 && !this.captain) { this.aggro = false; this.hp = this.maxHp; }
    super.update(dt);
  }
  melee(tgt) {
    this.windup = this.def.attack === 'bite' ? 0.35 : 0.5; this.model.flash(0xff4020, this.windup);
    this.atkCd = 1.05 + Math.random() * 0.5;
    this.action = () => {
      this.model.play(this.def.attack === 'bite' ? 'bite' : 'attack', 0.3); Audio.play('swing');
      this.knock.add(this.forward().multiplyScalar(4));
      for (const e of enemiesOf('enemy')) {
        const to = e.pos.clone().sub(this.pos); to.y = 0;
        if (to.length() < 2.2 + this.radius + e.radius && to.normalize().dot(this.forward()) > 0.2) strike(this, e, this.def.dmg, {}, { type: this.def.attack === 'bite' ? 'bite' : 'blunt', knock: 4 });
      }
    };
  }
  shoot(tgt) {
    this.windup = 0.55; this.model.flash(0xff4020, 0.55); this.atkCd = 1.6 + Math.random() * 1.2;
    this.action = () => {
      if (tgt.dead) return; this.model.play('shoot', 0.3); Audio.play(this.def.proj === 0xa0d060 ? 'arrow' : 'laser');
      const from = this.center().add(this.forward().multiplyScalar(0.6));
      const lead = tgt.center().add(tgt.vel.clone().multiplyScalar(0.25));
      spawnProjectile({ from, dir: lead.sub(from), speed: 17, color: this.def.proj || 0xff3050, size: 0.3, owner: this, onHit: (e) => strike(this, e, this.def.dmg, {}, { type: 'pierce' }) });
    };
  }
  cast(tgt) {
    this.atkCd = 2.4 + Math.random();
    const hurt = G.entities.find((e) => e.team === 'enemy' && !e.dead && e !== this && e.hp < e.maxHp * 0.6 && e.pos.distanceTo(this.pos) < 12);
    if (this.def.heals && hurt && Math.random() < 0.6) {
      this.windup = 0.6; this.model.play('cast', 0.6);
      this.action = () => { heal(this, hurt, hurt.maxHp * 0.3); ring(hurt.pos, 2, 0x70ff70); Audio.play('heal'); };
      return;
    }
    this.windup = 0.3; this.model.play('cast', 0.5);
    const p = tgt.pos.clone();
    this.action = () => telegraph(p, 2.6, 1.1, 0xff3060, (q) => {
      burst(q, [this.def.proj || 0xc070ff, 0xffffff], 24, 6, 0.6); Audio.play('zap');
      for (const e of enemiesOf('enemy')) if (e.pos.distanceTo(q) < 2.6 + e.radius) strike(this, e, this.def.dmg, {}, { type: 'lightning', knock: 5 });
    }, this);
  }
  brute(tgt) {
    this.atkCd = 3 + Math.random();
    if (Math.random() < 0.55) {
      this.model.play('slam', 1.0); this.windup = 0.2;
      const p = this.pos.clone().add(this.forward().multiplyScalar(2));
      this.action = () => telegraph(p, 3.6, 0.9, 0xff2020, (q) => {
        Audio.play('bigHit'); shake(0.4); ring(q, 4, 0xffffff); burst(q, [0x806040, 0xffffff], 30, 7, 0.7, 0.3);
        for (const e of enemiesOf('enemy')) if (e.pos.distanceTo(q) < 3.6 + e.radius) strike(this, e, this.def.dmg, {}, { type: 'blunt', knock: 16, heavy: true });
      }, this);
    } else {
      this.windup = 0.7; this.model.flash(0xff2020, 0.7); popText(this.head(), '!', 'crit-banner', { color: '#ff3a3a' });
      this.action = () => {
        const d = tgt.pos.clone().sub(this.pos); d.y = 0; d.normalize(); this.knock.add(d.multiplyScalar(24)); Audio.play('dash');
        const hitSet = new Set();
        const chk = () => { for (const e of enemiesOf('enemy')) if (!hitSet.has(e) && e.pos.distanceTo(this.pos) < 2 + this.radius) { hitSet.add(e); strike(this, e, this.def.dmg, {}, { type: 'blunt', knock: 18, heavy: true }); } };
        [0, 100, 200, 300, 400].forEach((t) => setTimeout(chk, t));
      };
    }
  }
  blinkBehind(tgt) {
    this.atkCd = 2.5; this.windup = 0.35;
    burst(this.center(), 0x222222, 16, 4); Audio.play('shadow');
    const p = tgt.pos.clone().sub(tgt.forward().multiplyScalar(1.5)); p.y = tgt.pos.y + 0.2;
    if (!G.world.boxHits(p.x - 0.4, p.y, p.z - 0.4, p.x + 0.4, p.y + this.height, p.z + 0.4)) this.pos.copy(p);
    if (this.trait('teleporter')) this.reveal('teleporter');
    this.model.flash(0xff4020, 0.35);
    this.action = () => { this.model.play('attack', 0.3); if (tgt.pos.distanceTo(this.pos) < 3) strike(this, tgt, this.def.dmg, {}, { type: 'slash', knock: 5 }); };
  }
}

// Shield-bearer frontal block; resist reveals
Enemy.prototype.frontalCheck = function (src) {
  if (!this.trait('shield_bearer')) return 1;
  const to = src.pos.clone().sub(this.pos); to.y = 0; to.normalize();
  if (to.dot(this.forward()) > 0.3) { this.reveal('shield_bearer'); popText(this.head(), 'BLOCKED', 'miss'); return 0.25; }
  return 1;
};
Enemy.prototype.onResist = function (type) {
  if (!this.captain) return;
  for (const t of this.captain.traits) { const tr = TRAITS[t]; if (tr?.resist && tr.resist[type] != null) this.reveal(t); }
};
