// Heroes: the player character and companions. Stats come from class + party level + talents + gear.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { Actor } from './actor.js';
import { CLASSES, cdMod } from '../game/classes.js';
import { noteAbility, addMeter, dealDamage, strike } from '../game/combat.js';
import { popText, burst } from '../game/effects.js';
import { Audio } from '../core/audio.js';

export function xpForLevel(l) { return Math.round(90 * Math.pow(l, 1.55)); }
export const MAX_LEVEL = 30;

export class Hero extends Actor {
  constructor(data, pos) {
    const cl = CLASSES[data.classId];
    const colors = { skin: 0xf0c090, eye: 0x1a1020, hair: 0x5a3018, ...cl.model.colors, ...(data.look || {}) };
    super({ name: data.name, team: 'party', pos, model: { kind: 'humanoid', ...cl.model, colors, longHair: data.longHair, beard: data.beard } });
    this.data = data; this.classId = data.classId; this.cls = cl;
    this.isPlayer = !!data.isPlayer;
    this.bloodColor = 0xff3a3a;
    this.recompute(true);
  }
  t(id) { return this.data.talents[id] || 0; }
  gearStat(k) { let s = 0; for (const it of Object.values(this.data.gear)) if (it && it.stats[k]) s += it.stats[k]; return s; }
  gearFlag(f) { for (const it of Object.values(this.data.gear)) if (it && it.flag === f) return true; return false; }
  recompute(full = false) {
    const st = this.cls.stats, L = G.save.party.level;
    this.level = L;
    const frac = this.maxHp ? this.hp / this.maxHp : 1;
    let hp = st.hp + st.hpPer * (L - 1) + this.gearStat('hp');
    hp *= 1 + this.t('toughness') * 0.1 + this.t('resilience') * 0.08 + this.t('tinkerer') * 0.05;
    this.maxHp = Math.round(hp);
    this.hp = full ? this.maxHp : Math.round(this.maxHp * frac);
    this.ac = st.ac + Math.floor(L / 6) + this.gearStat('ac') + this.t('tinkerer');
    this.atk = st.atk + Math.floor(L / 3) + this.gearStat('hit') + this.t('called_shot');
    this.pow = (1 + (L - 1) * 0.11) * (1 + this.gearStat('power') / 100);
    this.speed = st.speed * (1 + this.gearStat('speed') / 100 + this.t('fleetfoot') * 0.05);
  }
  abilityList() { return this.cls.abilities.filter((a) => a.lvl <= G.save.party.level); }
  dmgMult(tgt, opts) {
    let m = 1;
    m *= 1 + this.t('focus') * 0.08;
    if (tgt.hp / tgt.maxHp < 0.35) m *= 1 + this.t('executioner') * 0.12;
    if ((tgt.isBoss || tgt.isElite || tgt.isNemesis)) m *= 1 + this.t('headhunter') * 0.15;
    if (this.t('longshot') && tgt.pos.distanceTo(this.pos) > 12) m *= 1 + this.t('longshot') * 0.1;
    if (opts.type === 'tech' && this.t('scrapper')) m *= 1 + this.t('scrapper') * 0.15;
    if (this.has('avatar')) m *= 2;
    if (this.has('ley')) m *= 1.25;
    if (this.has('gambit')) m *= this.status('gambit').mult;
    if (G.realm && this.cls.resonanceBonus === G.realm.kind) m *= 1.15;
    return m;
  }
  onDealDamage(tgt, amt, opts, r) {
    this.cls.onDeal?.(this, amt);
    if (r && r.crit && this.t('wrath')) this.faith = Math.min(100, (this.faith || 0) + 5 * this.t('wrath'));
    if (this.t('poison') && this.classId === 'rogue' && Math.random() < 0.3 * this.t('poison')) tgt.addStatus('poison', 3, { every: 0.5, onTick: (x) => dealDamage(this, x, 1.2 * this.pow, { quiet: true, roll: { hit: true } }) });
    if (this.t('pickpocket') && Math.random() < 0.08 * this.t('pickpocket')) { const g = 2 + Math.floor(Math.random() * 3 * this.level); G.save.gold += g; popText(tgt.head(), `+${g}g`, 'info', { color: '#ffd23a' }); Audio.play('coin'); }
    if (this.gearStat('meter')) addMeter(amt * 0.02 * this.gearStat('meter') / 100);
  }
  onHurt(amt, src) { this.cls.onHurt?.(this, amt, src); }
  onBlock(src) {
    if (this.t('riposte') && src && !src.dead && src.pos.distanceTo(this.pos) < 4) strike(this, src, `${this.t('riposte')}d10`, { useFate: false }, { type: 'slash' });
  }
  onKill(enemy) {
    this.cls.onKill?.(this, enemy);
    if (this.has('whirl') && this.t('red_mist')) this.status('whirl').t += 1;
  }
  cooldownOf(abId) { return this.cds[abId] || 0; }
  tryCast(ab, T) {
    if (!this.canAct) return false;
    if ((this.cds[ab.id] || 0) > 0 && !T.forced) return false;
    if (this.has('stealth') && ab.id !== 'smoke' && ab.id !== 'basic' && ab.id !== 'shadowstep' && !this.t('shadow_dance')) this.removeStatus('stealth');
    const ok = ab.cast(this, T);
    if (ok === false) return false;
    let cd = ab.cd * (ab.id === 'basic' ? (1 - this.t('quick_hands') * 0.08) : cdMod(this, ab.id));
    if (this.has('haste') && ab.id === 'basic') cd *= 0.7;
    this.cds[ab.id] = T.forced ? Math.max(this.cds[ab.id] || 0, 0) : cd;
    if (ab.id !== 'basic') noteAbility(this, ab.id);
    return true;
  }
  basicAbility() { return { id: 'basic', ...this.cls.basic }; }
  update(dt) {
    for (const k in this.cds) if (this.cds[k] > 0) this.cds[k] = Math.max(0, this.cds[k] - dt * (this.has('haste') ? 1.3 : 1));
    this.dashCd = Math.max(0, (this.dashCd || 0) - dt);
    if (this.downed) { this.moveInput.set(0, 0, 0); this.downT = (this.downT || 0) + dt; }
    // Guardian aura (fighter)
    if (this.t('guardian')) for (const a of G.party) a.acAura = a !== this && a.pos.distanceTo(this.pos) < 6 ? this.t('guardian') : 0;
    // out-of-combat regen so the game never stalls between fights
    if (!G.combat.active && !this.downed && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.06 * dt);
    super.update(dt);
  }
  dash(dir) {
    if (this.dashCd > 0 || !this.canAct) return;
    this.dashCd = 1.1 * (1 - this.t('evasion') * 0.15);
    const d = dir.lengthSq() > 0 ? dir.clone().normalize() : this.forward();
    this.knock.add(d.multiplyScalar(22)); this.addStatus('dodge', 0.28); this.addStatus('invuln', 0.2);
    Audio.play('dash');
    burst(this.center(), 0xffffff, 8, 3, 0.3, 0.2, 0);
  }
  jump() {
    if (!this.canAct) return;
    if (this.grounded) { this.vel.y = 11; this.grounded = false; Audio.play('jump'); }
    else if (this.airJumps < 1) { this.airJumps++; this.vel.y = 10; Audio.play('jump'); burst(this.pos.clone(), 0xffffff, 8, 3, 0.3, 0.2, 0); }
  }
}
