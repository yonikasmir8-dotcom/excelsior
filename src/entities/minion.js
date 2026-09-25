// Summons: turrets, repair bots, beast companions, decoys.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { Actor } from './actor.js';
import { spawnProjectile, beam, burst, popText } from '../game/effects.js';
import { strike, heal, nearestEnemy, dealDamage, alliesNear, markTag, revive } from '../game/combat.js';
import { Audio } from '../core/audio.js';

const SPECS = {
  turret: { kind: 'drone', scale: 0.8, colors: { body: 0x8a6a3a, accent: 0xd0a040 }, glowEyes: 0x40ffd0 },
  bot: { kind: 'drone', scale: 0.5, colors: { body: 0xe0e0e8, accent: 0x40d080 }, glowEyes: 0x40ff80 },
  wolf: { kind: 'beast', scale: 0.8, colors: { body: 0x8a8070, skin: 0x5a5048, legs: 0x6a6058, eye: 0xffe040 } },
  decoy: { kind: 'humanoid', scale: 1, colors: { skin: 0x5a4a6a, body: 0x3a2a4a, legs: 0x2a1a3a, accent: 0x6a4a8a } },
};

export class Minion extends Actor {
  constructor(kind, owner, pos, opts = {}) {
    super({ name: opts.name || kind, team: owner.team, pos, hp: opts.hp || 40, ac: 12, model: opts.model || SPECS[kind], speed: kind === 'wolf' ? 9 : 5, radius: kind === 'wolf' ? 0.45 : 0.35, height: kind === 'turret' ? 1.4 : 1.2 });
    this.kind = kind; this.owner = owner; this.isMinion = true; this.life = opts.life || Infinity; this.pow = owner.pow;
    this.atk = owner.atk; this.fireT = 0; this.opts = opts; this.tesla = false;
    if (kind === 'turret' || kind === 'decoy') this.speed = 0;
    if (kind === 'bot') { this.flying = true; this.hoverY = pos.y + 0.5; }
    this.bloodColor = kind === 'wolf' ? 0xaa2222 : 0xffd060;
    this.untargetable = kind === 'bot';
    G.entities.push(this);
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0 || (this.owner.dead)) { burst(this.center(), 0xffd060, 12, 4, 0.5); this.remove(); return; }
    if (this.downed) { this.remove(); return; }
    this.fireT -= dt;
    this.moveInput.set(0, 0, 0);
    const o = this.owner;
    if (this.kind === 'turret') {
      const t = nearestEnemy(this, this.team, this.opts.range || 16, (e) => G.world.lineClear(this.center(), e.center()));
      if (t) {
        this.faceTo(t.pos);
        if (this.fireT <= 0) {
          this.fireT = this.tesla ? 0.9 : (this.opts.rate || 0.55);
          if (this.tesla) {
            let prev = this.center().add(new THREE.Vector3(0, 0.6, 0)); let cur = t; const hitSet = new Set();
            for (let i = 0; i < 4 && cur; i++) { hitSet.add(cur); beam(prev, cur.center(), 0xaef4ff, 0.12, 0.2, 0.8); strike(this, cur, 7, { useFate: false }, { type: 'lightning', quiet: i > 0 }); prev = cur.center(); cur = nearestEnemy(cur, this.team, 7, (e) => !hitSet.has(e)); }
            Audio.play('zap');
          } else if (this.opts.mortar) {
            const p = t.pos.clone();
            spawnProjectile({ from: this.center().add(new THREE.Vector3(0, 0.8, 0)), dir: p.clone().sub(this.center()).setY(8).normalize(), speed: 14, gravity: 20, color: 0xffa040, owner: this, size: 0.35,
              onWorld: (pp) => { burst(pp, [0xff8030, 0x444444], 16, 6); for (const e of G.entities) if (e.team !== this.team && e.team !== 'npc' && !e.dead && e.pos.distanceTo(pp) < 3) strike(this, e, 9, { useFate: false }, { type: 'blast', knock: 6 }); },
              onHit: (e, pp) => strike(this, e, 12, { useFate: false }, { type: 'blast' }) });
          } else {
            const from = this.center().add(new THREE.Vector3(0, 0.3, 0));
            spawnProjectile({ from, dir: t.center().sub(from), speed: 30, color: 0x40ffd0, owner: this, size: 0.18, onHit: (e) => strike(this, e, this.opts.dmg || 5, { useFate: false }, { type: 'tech', quiet: true }) });
            Audio.play('laser');
          }
        }
      }
    } else if (this.kind === 'bot') {
      const target = o.dead ? this : o;
      const want = target.pos.clone().add(new THREE.Vector3(Math.sin(G.time) * 1.5, 0, Math.cos(G.time) * 1.5));
      const to = want.sub(this.pos); to.y = 0; if (to.length() > 0.5) this.moveInput.copy(to.normalize());
      this.hoverY = target.pos.y + 1.2;
      if (this.fireT <= 0) {
        this.fireT = 1;
        if (o.gearFlag && o.gearFlag('bot_revive')) for (const a of alliesNear(this.pos, 3, this.team, true)) if (a.downed) { revive(a, 0.3); }
        for (const a of alliesNear(this.pos, 7, this.team)) {
          if (a.hp < a.maxHp) { heal(o, a, (this.opts.heal || 4) * o.pow, true); beam(this.center(), a.center(), 0x60ff90, 0.06, 0.2); }
          if (this.opts.shield) a.addStatus('shield', 3, { amount: 5 * o.pow });
          if (o.t && o.t('reinforced')) a.addStatus('reinforced', 1.2, { mult: 1 - 0.05 * o.t('reinforced') });
        }
      }
    } else if (this.kind === 'wolf') {
      let t = this.forced && !this.forced.dead ? this.forced : (o.aiTarget && !o.aiTarget.dead ? o.aiTarget : nearestEnemy(this, this.team, 12));
      if (t && t.team === this.team) t = null;
      if (t) {
        const to = t.pos.clone().sub(this.pos); to.y = 0; const dist = to.length();
        this.faceTo(t.pos, 0.3);
        if (dist > 1.6) this.moveInput.copy(to.normalize());
        else if (this.fireT <= 0) { this.fireT = 0.9; this.model.play('bite', 0.3); strike(this, t, this.opts.dmg || 6, { useFate: false }, { type: 'bite' }); }
      } else {
        const to = o.pos.clone().add(new THREE.Vector3(1.5, 0, -1.5)).sub(this.pos); to.y = 0;
        if (to.length() > 3) { this.moveInput.copy(to.normalize()); this.faceTo(o.pos, 0.2); }
        if (to.length() > 30) this.pos.copy(o.pos);
      }
      if (this.blocked && this.grounded && this.moveInput.lengthSq() > 0) { this.vel.y = 10; this.blocked = false; }
    } else if (this.kind === 'decoy') {
      for (const e of G.entities) if (e.team !== this.team && e.team !== 'npc' && !e.dead && e.pos.distanceTo(this.pos) < 10) e.tauntedBy = this;
    }
    super.update(dt);
  }
  pounce(t) {
    this.forced = t;
    const to = t.pos.clone().sub(this.pos); to.y = 0; const dist = to.length();
    this.knock.copy(to.normalize().multiplyScalar(Math.min(22, dist * 2.6))); this.knock.y = 6;
    setTimeout(() => {
      if (this.dead || t.dead) return;
      strike(this, t, (this.opts.dmg || 6) * 2.2, { useFate: false }, { type: 'bite', heavy: true });
      t.addStatus('stun', 1.2 + (this.owner.t?.('alpha') ? 1 : 0)); markTag('beast', t.pos, this.owner);
      popText(t.head(), 'POUNCE!', 'sfx');
    }, 350);
  }
}
