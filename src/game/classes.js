// The six classes: stats, look, basic attack, four abilities, a passive, two-spec talent trees
// and "realm resonance" (abilities re-flavour in each genre of realm).
import * as THREE from 'three';
import { G } from '../core/state.js';
import { Audio } from '../core/audio.js';
import { spawnProjectile, burst, beam, ring, zone, telegraph, popText, shake, debris, timed } from './effects.js';
import { strike, dealDamage, heal, revive, enemiesNear, alliesNear, nearestEnemy, inArc, markTag, attackRoll, d20, addStyle, addMeter } from './combat.js';
import { Minion } from '../entities/minion.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const flat = (v) => { v.y = 0; return v.lengthSq() ? v.normalize() : V(0, 0, 1); };
function aimDir(c, T) { if (T.target && !T.target.dead) return T.target.center().sub(c.center()).normalize(); return (T.dir || c.forward()).clone().normalize(); }
function aimPoint(c, T, max = 18) {
  if (T.target && !T.target.dead) return T.target.pos.clone();
  if (T.point && T.point.distanceTo(c.pos) <= max) return T.point.clone();
  return c.pos.clone().add(flat(aimDir(c, T).clone()).multiplyScalar(Math.min(max, 10)));
}
function meleeHits(c, range, arc, fn) {
  const hits = enemiesNear(c.pos, range + 1, c.team).filter((e) => inArc(c, e, range, arc));
  hits.forEach(fn); return hits;
}
function faceAim(c, T) { const d = aimDir(c, T); c.yaw = Math.atan2(d.x, d.z); }
function lunge(c, dist) { c.knock.add(c.forward().multiplyScalar(dist)); }

// ── Sorcerer elements ────────────────────────────────────────────────────────
const ELEM = {
  fire: { name: 'Fire', color: 0xff7a2a, css: '#ff9a5a', type: 'fire', tag: 'fire' },
  frost: { name: 'Frost', color: 0x9ad8ff, css: '#a8dcff', type: 'frost', tag: 'frost' },
  storm: { name: 'Storm', color: 0xaef4ff, css: '#c8f8ff', type: 'lightning', tag: 'lightning' },
};
export { ELEM };
function resonate(c, el) {
  if (c.lastElem && c.lastElem !== el && G.time - (c.lastElemT || -99) < 5) { const max = 3 + c.t('deep_resonance'); c.resonance = Math.min(max, (c.resonance || 0) + 1); c.resT = G.time; }
  c.lastElem = el; c.lastElemT = G.time;
}
function resMult(c) { if (G.time - (c.resT || -99) > 6) c.resonance = 0; return 1 + (c.resonance || 0) * 0.1; }
function burn(c, e, t) { e.addStatus('burn', t, { every: 0.5, onTick: (x) => dealDamage(c, x, 2 * c.pow, { type: 'fire', quiet: true, roll: { hit: true } }) }); }
function chill(e, t, c) { e.addStatus('chill', t); e.addStatus('slow', t); }
function freeze(e, t) { if (e.isBoss) { e.addStatus('slow', t); return; } e.addStatus('frozen', t); e.addStatus('stun', t); e.model?.flash(0x9ad8ff, t); }

// ── ability helpers ──────────────────────────────────────────────────────────
function bolt(c, T, o) {
  const from = c.center().add(c.forward().multiplyScalar(0.5)).add(V(0, 0.3, 0));
  const dir = aimDir(c, T);
  return spawnProjectile({ from, dir, speed: o.speed || 26, color: o.color, size: o.size || 0.28, owner: c, pierce: o.pierce, homing: o.homing, target: T.target, gravity: o.gravity,
    onHit: (e, p) => o.onHit(e, p), onWorld: o.onWorld, onExpire: o.onExpire });
}

export const CLASSES = {
  // ───────────────────────────────── FIGHTER ─────────────────────────────────
  fighter: {
    name: 'Fighter', role: 'Frontline tank', color: '#d8443a',
    blurb: 'A wall of steel who gets stronger the more punishment they take. Grit builds when you are hit; at full Grit your next ability hits 50% harder.',
    stats: { hp: 120, hpPer: 18, ac: 16, speed: 6.4, atk: 4 },
    skill: { intimidation: 4, athletics: 5, persuasion: 1 },
    model: { weapon: 'sword', heroic: 1.35, fur: true, extras: ['shield', 'shoulder', 'harness', 'cape'], colors: { body: 0x7a2a24, legs: 0x5a4030, accent: 0xd8a840, cape: 0x6a1418, boots: 0x4a3020, shield: 0x7a2a24 } },
    passive: { name: 'Resolve', desc: 'Blocking and taking hits builds Resolve. At 100 Resolve, your next ability deals +50% damage.' },
    mechanic: { name: 'Guard', key: 'RMB', hold: true, desc: 'Hold to raise your shield: frontal damage is cut by 75%. Raise it just before a blow lands to PARRY: the attacker is staggered and your next strike is a guaranteed critical.',
      start(c) { c.guardStart = G.time; c.addStatus('guarding', 99); c.model.play('guard', 99); Audio.play('block'); },
      tick(c) { c.model.state = 'guard'; c.model.stateT = 1; },
      end(c) { c.removeStatus('guarding'); c.model.play('idle', 0.01); } },
    basic: { name: 'Blade Combo', cd: 0.45, range: 2.6, cast(c, T) {
      c.combo = ((c.combo || 0) + 1) % 3; faceAim(c, T); lunge(c, 3);
      c.model.play(c.combo === 2 ? 'spin' : 'attack', 0.3); Audio.play('swing');
      const mult = c.combo === 2 ? 1.6 : 1;
      meleeHits(c, 2.6, c.combo === 2 ? 360 : 120, (e) => strike(c, e, '1d8+2', T, { type: 'slash', mult, knock: c.combo === 2 ? 7 : 2 }));
      return true; } },
    abilities: [
      { id: 'cleave', key: 'Q', lvl: 1, name: 'Cleave', cd: 5, tags: ['cleave'], desc: 'A huge 200° sweep that knocks foes back.', cast(c, T) {
        faceAim(c, T); c.model.play('spin', 0.35); Audio.play('swing'); shake(0.15);
        const mult = gritMult(c) * (1 + c.t('heavy_blade') * 0.15);
        const hits = meleeHits(c, 3.4 + c.t('reach') * 0.6, 200, (e) => { strike(c, e, '2d8+4', T, { type: 'slash', mult, knock: 11, heavy: true }); if (c.t('bloodlust')) c.lifestealOnce = true; });
        if (c.t('bloodlust') && hits.length) heal(c, c, hits.length * 4 * c.t('bloodlust') * c.pow);
        ring(c.pos, 3.6, 0xffe0a0, 0.3); markTag('cleave', c.pos, c);
        if (c.gearFlag('cleave_wave')) spawnProjectile({ from: c.center(), dir: c.forward(), speed: 18, color: 0xffe0a0, size: 1.2, long: 0.3, owner: c, pierce: 99, life: 0.6, onHit: (e) => strike(c, e, '2d6+2', { useFate: false }, { type: 'slash', knock: 6 }) });
        return true; } },
      { id: 'charge', key: 'E', lvl: 2, name: 'Shield Charge', cd: 8, tags: ['shield'], desc: 'Charge forward, stunning the first enemy hit.', cast(c, T) {
        faceAim(c, T); const dir = flat(aimDir(c, T).clone()); c.knock.add(dir.clone().multiplyScalar(26)); c.addStatus('invuln', 0.35);
        c.model.play('thrust', 0.4); Audio.play('dash'); let hit = false;
        timed(0.4, (f) => {
          if (hit) return false;
          for (const e of enemiesNear(c.pos, 1.8, c.team)) {
            hit = true; strike(c, e, '2d6+3', T, { type: 'blunt', mult: gritMult(c), knock: 14, heavy: true });
            if ((e.dead && (c.gearFlag('charge_reset') || c.t('momentum')))) setTimeout(() => { c.cds.charge = 0; }, 50);
            e.addStatus('stun', 1.2 + c.t('bulwark') * 0.5); c.knock.set(0, 0, 0); markTag('shield', e.pos, c); shake(0.3);
          }
        });
        return true; } },
      { id: 'battlecry', key: 'C', lvl: 4, name: 'Battle Cry', cd: 14, tags: ['taunt'], desc: 'Taunt all enemies nearby and take 30% less damage for 5s.', cast(c, T) {
        c.model.play('cheer', 0.6); Audio.play('roar'); ring(c.pos, 10, 0xff5040, 0.5); shake(0.2);
        c.addStatus('battlecry', 5); if (c.t('immovable')) c.knockResist = 1;
        for (const e of enemiesNear(c.pos, 10, c.team)) { e.tauntedBy = c; e.tauntT = 5; e.addStatus('taunted', 5); }
        if (c.t('unbreakable')) heal(c, c, c.maxHp * 0.1 * c.t('unbreakable'));
        markTag('taunt', c.pos, c); setTimeout(() => { c.knockResist = 0; }, 5000);
        return true; } },
      { id: 'whirlwind', key: 'R', lvl: 6, name: 'Whirlwind of Steel', cd: 30, tags: ['cleave'], desc: 'Become a spinning storm of blades for 3 seconds.', cast(c, T) {
        const dur = c.t('red_mist') ? 5 : 3; c.addStatus('whirl', dur); c.addStatus('haste', dur); Audio.play('swing');
        timed(dur, (f, dt) => { f.acc = (f.acc || 0) + dt; c.model.play('spin', 0.3);
          if (f.acc > 0.25) { f.acc = 0; Audio.play('swing'); for (const e of enemiesNear(c.pos, 3.2, c.team)) strike(c, e, '1d8+3', { useFate: false }, { type: 'slash', knock: 4, quiet: Math.random() < 0.6 }); markTag('cleave', c.pos, c); }
          if (c.downed || c.dead) return false; });
        return true; } },
    ],
    onHurt(c, amt) { c.grit = Math.min(100, (c.grit || 0) + amt * (1.2 + c.t('thick_skin') * 0.2)); },
    onDeal(c, amt) { if (c.t('rage')) c.grit = Math.min(100, (c.grit || 0) + amt * 0.15 * c.t('rage')); },
    talents: [
      { id: 'toughness', spec: 'core', tier: 0, max: 3, name: 'Toughness', desc: '+10% max HP per rank.' },
      { id: 'heavy_blade', spec: 'core', tier: 0, max: 3, name: 'Heavy Blade', desc: 'Cleave deals +15% damage per rank.' },
      { id: 'reach', spec: 'core', tier: 1, max: 2, name: 'Longsword Reach', desc: 'Cleave reaches further.' },
      { id: 'thick_skin', spec: 'core', tier: 1, max: 3, name: 'Thick Skin', desc: 'Grit builds 20% faster per rank.' },
      { id: 'bulwark', spec: 'a', tier: 1, max: 3, name: 'Bulwark', desc: 'Shield Charge stuns 0.5s longer per rank.' },
      { id: 'unbreakable', spec: 'a', tier: 2, max: 3, name: 'Unbreakable', desc: 'Battle Cry heals 10% max HP per rank.' },
      { id: 'riposte', spec: 'a', tier: 2, max: 2, name: 'Riposte', desc: 'Blocking an attack strikes back for 1d10 per rank.' },
      { id: 'guardian', spec: 'a', tier: 3, max: 2, name: 'Guardian Aura', desc: 'Allies within 6m gain +1 AC per rank.' },
      { id: 'immovable', spec: 'a', tier: 4, max: 1, name: 'Immovable Object', keystone: true, desc: 'KEYSTONE — Battle Cry makes you immune to knockback and reflects 30% of damage taken.' },
      { id: 'bloodlust', spec: 'b', tier: 1, max: 3, name: 'Bloodlust', desc: 'Cleave heals you per enemy hit.' },
      { id: 'rage', spec: 'b', tier: 2, max: 3, name: 'Rage', desc: 'Dealing damage also builds Grit.' },
      { id: 'momentum', spec: 'b', tier: 2, max: 1, name: 'Momentum', desc: 'Kills reset Shield Charge.' },
      { id: 'executioner', spec: 'b', tier: 3, max: 3, name: 'Executioner', desc: '+12% damage per rank to enemies below 35% HP.' },
      { id: 'red_mist', spec: 'b', tier: 4, max: 1, name: 'Red Mist', keystone: true, desc: 'KEYSTONE — Whirlwind lasts 5s, and kills during it extend it by 1s.' },
    ],
    specs: { a: 'Vanguard', b: 'Berserker' },
    resonance: { neon: { cleave: 'Haymaker Sweep', charge: 'Freight-Train Tackle', battlecry: 'Hero Landing', whirlwind: 'Cyclone Punch' }, asterion: { cleave: 'Plasma Arc', charge: 'Mag-Boot Ram', battlecry: 'Aggro Beacon', whirlwind: 'Centrifuge Protocol' } },
    resonanceBonus: 'neon',
  },

  // ───────────────────────────────── SORCERER ────────────────────────────────
  sorcerer: {
    name: 'Sorcerer', role: 'Elemental weaver', color: '#8ab8ff',
    blurb: 'Commands fire, frost and storm. Right-click to change attunement: every spell transforms. Weave different elements back to back to build Resonance.',
    stats: { hp: 80, hpPer: 11, ac: 12, speed: 6.2, atk: 5 },
    skill: { arcana: 5, persuasion: 3, insight: 2 },
    model: { weapon: 'staff', hat: 'hood', sleeves: true, extras: ['robe', 'cape'], colors: { body: 0x2a2a5a, legs: 0x1a1a3a, accent: 0xc8a050, hat: 0x2a2a5a, cape: 0x1a1a40, magic: 0xaef4ff } },
    passive: { name: 'Resonance', desc: 'Casting a spell of a different element than your last within 5s grants Resonance (+10% spell damage, stacks 3×).' },
    mechanic: { name: 'Attunement', key: 'RMB', desc: 'Cycle Fire → Frost → Storm. Your bolt, Evocation, Conjuration and Cataclysm all change with it.', press(c) {
      const order = ['fire', 'frost', 'storm']; c.element = order[(order.indexOf(c.element || 'fire') + 1) % 3];
      Audio.play('zap'); burst(c.center(), ELEM[c.element].color, 16, 3, 0.6, 0.3, 1); popText(c.head(), ELEM[c.element].name, 'fate', { color: ELEM[c.element].css });
      if (c.t('triune')) for (const k in c.cds) if (k !== 'basic') c.cds[k] = Math.max(0, c.cds[k] - 1.5);
      if (c.model?.parts.weapon) c.model.parts.weapon.traverse((o) => { if (o.material?.emissive && o.material.emissiveIntensity > 1) o.material.emissive.setHex(ELEM[c.element].color); });
      return true; } },
    basic: { name: 'Arcane Bolt', cd: 0.42, range: 22, cast(c, T) {
      faceAim(c, T); c.model.play('shoot', 0.25); const el = ELEM[c.element || 'fire'];
      bolt(c, T, { color: el.color, size: 0.26, speed: 32, homing: 2, onHit: (e) => {
        strike(c, e, '1d8+1', T, { type: el.type, mult: resMult(c) });
        if (c.element === 'frost') chill(e, 1.2, c); else if (c.element === 'fire' && Math.random() < 0.3) burn(c, e, 2);
        else if (c.element === 'storm') { const n = nearestEnemy(e, c.team, 6, (x) => x !== e); if (n) { beam(e.center(), n.center(), el.color, 0.06, 0.15, 0.6); strike(c, n, '1d4+1', { useFate: false }, { type: 'lightning', quiet: true }); } }
      } });
      return true; } },
    abilities: [
      { id: 'evocation', key: 'Q', lvl: 1, name: 'Evocation', cd: 4, tags: ['fire'], desc: 'Fire: exploding Fireball. Frost: piercing Ice Lance that shatters chilled foes. Storm: Chain Lightning.', cast(c, T) {
        faceAim(c, T); c.model.play('shoot', 0.3); const el = c.element || 'fire'; resonate(c, el); this.tags = [ELEM[el].tag];
        if (el === 'fire') {
          Audio.play('fire');
          const explode = (p, direct) => { burst(p, [0xff7a2a, 0xffd07a], 30, 5, 0.7, 0.35, 1); ring(p, 3, 0xff7a2a); markTag('fire', p, c);
            for (const e of enemiesNear(p, 2.8 + c.t('inferno') * 0.6, c.team)) { strike(c, e, e === direct ? '2d10+4' : '1d10+2', T, { type: 'fire', heavy: e === direct, mult: resMult(c) }); burn(c, e, 3 + c.t('inferno')); } };
          const n = c.gearFlag('triple_firebolt') ? 3 : 1;
          for (let i = 0; i < n; i++) { const d = aimDir(c, T).applyAxisAngle(V(0, 1, 0), (i - (n - 1) / 2) * 0.18); bolt(c, { ...T, target: i === 0 ? T.target : null, dir: d }, { color: 0xff7a2a, size: 0.5, speed: 28, onHit: (e, p) => explode(p, e), onWorld: (p) => explode(p), onExpire: (p) => explode(p) }); }
        } else if (el === 'frost') {
          Audio.play('laser');
          bolt(c, T, { color: 0x9ad8ff, size: 0.34, speed: 42, pierce: 3, onHit: (e) => { const frozen = e.has('frozen') || e.has('chill'); strike(c, e, '2d8+3', T, { type: 'frost', mult: resMult(c) * (frozen ? 1.8 + c.t('permafrost') * 0.2 : 1), heavy: frozen }); if (frozen) { burst(e.center(), 0xd8f4ff, 20, 5, 0.6, 0.3); popText(e.head(), 'Shatter', 'fate'); e.removeStatus('frozen'); } chill(e, 2.5, c); markTag('frost', e.pos, c); } });
        } else {
          Audio.play('zap');
          let tgt = T.target && !T.target.dead ? T.target : nearestEnemy(c, c.team, 18); if (!tgt) return false;
          const hitSet = new Set(); let prev = c.center().add(V(0, 0.5, 0)); const max = 4 + c.t('arc_jumps') * 2 + (c.t('eye_of_storm') ? 8 : 0);
          const roll = attackRoll(c, tgt, T);
          for (let i = 0; i < max && tgt; i++) { hitSet.add(tgt); beam(prev, tgt.center(), 0xaef4ff, 0.12, 0.25, 1.1); strike(c, tgt, '2d6+2', {}, { type: 'lightning', roll, mult: resMult(c) * (1 + c.t('static') * 0.1 * i) }); if (c.t('static')) tgt.addStatus('slow', 1.5); markTag('lightning', tgt.pos, c); prev = tgt.center(); tgt = nearestEnemy(tgt, c.team, 8, (e) => !hitSet.has(e)); if (c.t('eye_of_storm') && !roll.hit) break; }
        }
        return true; } },
      { id: 'conjuration', key: 'E', lvl: 2, name: 'Conjuration', cd: 9, tags: ['fire'], desc: 'Fire: a Flame Pillar that burns. Frost: a Frost Nova that freezes everything around you. Storm: a Thunderstrike that stuns.', cast(c, T) {
        const el = c.element || 'fire'; resonate(c, el); this.tags = [ELEM[el].tag];
        if (el === 'fire') {
          const p = aimPoint(c, T, 20); c.model.play('cast', 0.5); Audio.play('fire');
          zone({ pos: p, radius: 3.2, life: 4, color: 0xff7a2a, tag: 'fire', owner: c, tick: (z) => { burst(z.pos.clone().add(V(0, 1, 0)), [0xff7a2a, 0xffc04a], 6, 3, 0.8, 0.4, 3); for (const e of enemiesNear(z.pos, 3.2, c.team)) { dealDamage(c, e, 4 * c.pow * resMult(c), { type: 'fire', quiet: true, roll: { hit: true } }); burn(c, e, 2); } } });
          markTag('fire', p, c);
        } else if (el === 'frost') {
          c.model.play('slam', 0.5); Audio.play('holy'); ring(c.pos, 7, 0x9ad8ff, 0.6); burst(c.center(), [0xd8f4ff, 0x9ad8ff], 40, 8, 0.8, 0.35, 0);
          for (const e of enemiesNear(c.pos, 6.5, c.team)) { strike(c, e, '2d6+2', T, { type: 'frost', knock: 6, mult: resMult(c) }); freeze(e, 2 + c.t('permafrost') * 0.5); markTag('frost', e.pos, c); }
        } else {
          const p = aimPoint(c, T, 22); c.model.play('cast', 0.6);
          telegraph(p, 3.2, 0.55, 0xaef4ff, (q) => { beam(q.clone().add(V(0, 26, 0)), q, 0xaef4ff, 0.35, 0.35, 2.5); Audio.play('thunder'); shake(0.15); burst(q, [0xaef4ff, 0xffffff], 36, 7, 0.6, 0.35, 0);
            for (const e of enemiesNear(q, 3.2, c.team)) { strike(c, e, '3d8+4', { forced: true }, { type: 'lightning', heavy: true, mult: resMult(c) }); e.addStatus('stun', 1); markTag('lightning', e.pos, c); } }, c);
        }
        return true; } },
      { id: 'blink', key: 'C', lvl: 4, name: 'Blink', cd: 7, tags: ['blink'], desc: 'Teleport 9m, leaving a burst of your current element behind.', cast(c, T) {
        const dir = flat((T.dir || c.forward()).clone()); const from = c.pos.clone(); Audio.play('shadow'); const el = ELEM[c.element || 'fire'];
        burst(c.center(), el.color, 24, 4, 0.6, 0.3, 0); ring(from, 3.5, el.color);
        for (const e of enemiesNear(from, 3.5, c.team)) { strike(c, e, '1d10+3', T, { type: el.type, knock: 8 }); if (c.element === 'frost') chill(e, 2, c); }
        let dist = 0; for (let d = 9; d > 0; d -= 0.5) { const p = from.clone().addScaledVector(dir, d); if (!G.world.boxHits(p.x - 0.35, p.y + 0.3, p.z - 0.35, p.x + 0.35, p.y + 1.8, p.z + 0.35)) { dist = d; break; } }
        c.pos.addScaledVector(dir, dist); c.vel.set(0, 0, 0); c.addStatus('invuln', 0.3); burst(c.center(), el.color, 24, 4, 0.6, 0.3, 0); markTag('blink', c.pos, c);
        if (c.t('phase_cloak')) c.addStatus('stealth', 1.5 * c.t('phase_cloak'));
        return true; } },
      { id: 'cataclysm', key: 'R', lvl: 6, name: 'Cataclysm', cd: 28, tags: ['fire'], desc: 'Fire: Meteor. Frost: a Blizzard that slows and grinds foes down. Storm: a Tempest of lightning strikes.', cast(c, T) {
        const el = c.element || 'fire'; resonate(c, el); this.tags = [ELEM[el].tag]; const p = aimPoint(c, T, 24); c.model.play('cast', 0.8);
        if (el === 'fire') {
          const n = c.t('meteor_swarm') ? 3 : 1; Audio.play('fire');
          for (let i = 0; i < n; i++) { const pp = p.clone().add(V((Math.random() - 0.5) * (i ? 8 : 0), 0, (Math.random() - 0.5) * (i ? 8 : 0)));
            telegraph(pp, 5, 1.1 + i * 0.35, 0xff7a2a, (q) => { Audio.play('explode'); shake(0.4); G.post && (G.post.flash = 0.2); beam(q.clone().add(V(8, 40, 4)), q, 0xff9a4a, 0.9, 0.3); burst(q, [0xff7a2a, 0xffd07a, 0x3a2a2a], 60, 10, 1.1, 0.5, 1); for (const e of enemiesNear(q, 5, c.team)) strike(c, e, '4d12+8', { forced: true, useFate: i === 0 }, { type: 'fire', knock: 14, heavy: true, mult: resMult(c) }); markTag('fire', q, c); }); }
        } else if (el === 'frost') {
          Audio.play('holy');
          zone({ pos: p, radius: 6, life: 6, color: 0x9ad8ff, tag: 'frost', owner: c, opacity: 0.12, tick: (z) => { burst(z.pos.clone().add(V((Math.random() - .5) * 10, 5, (Math.random() - .5) * 10)), 0xe8f8ff, 8, 2, 1.4, 0.25, -6); for (const e of enemiesNear(z.pos, 6, c.team)) { dealDamage(c, e, 5 * c.pow * resMult(c), { type: 'frost', quiet: true, roll: { hit: true } }); chill(e, 1, c); if (Math.random() < 0.15) freeze(e, 1); } } });
        } else {
          Audio.play('thunder');
          let k = 0; timed(3.2, (f, dt) => { f.acc = (f.acc || 0) + dt; if (f.acc > 0.4) { f.acc = 0; const foes = enemiesNear(p, 12, c.team); const e = foes[Math.floor(Math.random() * foes.length)]; const q = e ? e.pos.clone() : p.clone().add(V((Math.random() - .5) * 10, 0, (Math.random() - .5) * 10)); beam(q.clone().add(V(0, 28, 0)), q, 0xaef4ff, 0.3, 0.3, 2.5); Audio.play('zap'); burst(q, 0xaef4ff, 20, 5, 0.5, 0.3, 0); for (const x of enemiesNear(q, 2.5, c.team)) strike(c, x, '2d10+4', { forced: k++ < 1 }, { type: 'lightning', mult: resMult(c) }); markTag('lightning', q, c); } });
        }
        return true; } },
    ],
    talents: [
      { id: 'focus', spec: 'core', tier: 0, max: 3, name: 'Arcane Focus', desc: '+8% spell damage per rank.' },
      { id: 'inferno', spec: 'core', tier: 0, max: 3, name: 'Inferno', desc: 'Fire burns last longer and explode wider.' },
      { id: 'phase_cloak', spec: 'core', tier: 1, max: 2, name: 'Phase Cloak', desc: 'Blink grants stealth.' },
      { id: 'mana_flow', spec: 'core', tier: 1, max: 3, name: 'Mana Flow', desc: '-6% cooldowns per rank.' },
      { id: 'arc_jumps', spec: 'a', tier: 1, max: 3, name: 'Arc Jumps', desc: 'Chain Lightning jumps 2 more times per rank.' },
      { id: 'static', spec: 'a', tier: 2, max: 3, name: 'Static Charge', desc: 'Each lightning jump deals +10% more and slows.' },
      { id: 'conductor', spec: 'a', tier: 2, max: 2, name: 'Conductor', desc: 'Storm bolts chain to 1 extra enemy per rank.' },
      { id: 'meteor_swarm', spec: 'a', tier: 3, max: 1, name: 'Meteor Swarm', desc: 'Fire Cataclysm calls down three meteors.' },
      { id: 'eye_of_storm', spec: 'a', tier: 4, max: 1, name: 'Eye of the Storm', keystone: true, desc: 'KEYSTONE — Chain Lightning jumps up to 12 times, but stops the moment it misses.' },
      { id: 'deep_resonance', spec: 'b', tier: 1, max: 2, name: 'Deep Resonance', desc: 'Resonance can stack 1 more time per rank.' },
      { id: 'permafrost', spec: 'b', tier: 2, max: 3, name: 'Permafrost', desc: 'Freezes last longer and Shatter hits harder.' },
      { id: 'lucky_star', spec: 'b', tier: 2, max: 2, name: 'Star-Touched', desc: 'Start fights with 1 extra Fate Die per rank.' },
      { id: 'entropy', spec: 'b', tier: 3, max: 3, name: 'Entropy', desc: 'Glancing blows deal more damage (22% per rank).' },
      { id: 'triune', spec: 'b', tier: 4, max: 1, name: 'Triune Mastery', keystone: true, desc: 'KEYSTONE — Switching attunement refunds 1.5s of every cooldown.' },
    ],
    specs: { a: 'Stormcaller', b: 'Elementalist' },
    resonance: { neon: { evocation: 'Hero-Bolt', conjuration: 'Power Surge', blink: 'Speedster Flicker', cataclysm: 'Orbital Drop' }, asterion: { evocation: 'Plasma Lance', conjuration: 'Field Collapse', blink: 'Phase Jump', cataclysm: 'Decaying Orbit' } },
    resonanceBonus: 'emberwood',
  },

  // ───────────────────────────────── ARTIFICER ───────────────────────────────
  artificer: {
    name: 'Runesmith', role: 'Siege & wards', color: '#e0a030',
    blurb: 'Sets the battlefield: ballista wards, blast runes and a mending totem, then right-clicks to DETONATE everything at once. Kills drop Scrap; 3 Scrap recharges your ballista.',
    stats: { hp: 95, hpPer: 13, ac: 14, speed: 6.2, atk: 4 },
    skill: { tech: 5, arcana: 3, insight: 1 },
    model: { weapon: 'wrench', hat: 'goggles', heroic: 1.1, bulk: 1.08, extras: ['backpack', 'shoulder', 'apron'], colors: { body: 0x4a5a6a, legs: 0x4a3a2a, accent: 0xc88a3a, hair: 0xa04a1a } },
    passive: { name: 'Salvage', desc: 'Enemies you defeat drop Scrap. At 3 Scrap, your Ballista Ward recharges instantly.' },
    mechanic: { name: 'Detonate', key: 'RMB', desc: 'Detonate every ward, rune and totem you have placed. Wards explode, runes erupt at 150%, totems release a wave of healing. Detonated wards refund 40% of their cooldown.', press(c) { return detonate(c); } },
    basic: { name: 'Runic Bolt', cd: 0.3, range: 20, cast(c, T) {
      faceAim(c, T); c.model.play('shoot', 0.2); Audio.play('laser');
      bolt(c, T, { color: 0xffd060, size: 0.16, speed: 36, onHit: (e) => strike(c, e, '1d6+1', T, { type: 'tech', word: 'tech' }) });
      return true; } },
    abilities: [
      { id: 'turret', key: 'Q', lvl: 1, name: 'Ballista Ward', cd: 12, tags: ['turret'], desc: 'Raise a runic ballista that fires for 14s.', cast(c, T) {
        const p = c.pos.clone().add(c.forward().multiplyScalar(1.6)); p.y = G.world.groundBelow(p.x, p.y + 2, p.z);
        const n = c.t('twin_turrets') ? 2 : 1; Audio.play('build');
        for (let i = 0; i < n; i++) {
          const pp = p.clone().add(V(i ? 1.5 : 0, 0, 0));
          const t = new Minion('turret', c, pp, { life: 14 + c.t('sturdy_build') * 4, hp: 40 * c.pow, dmg: 5 * (1 + c.t('calibrated') * 0.2), rate: 0.55, mortar: !!c.t('siege_mode') });
          if (c.gearFlag('turret_tesla')) t.tesla = true;
          c.turrets = (c.turrets || []).filter((x) => !x.dead); c.turrets.push(t);
          burst(pp.clone().add(V(0, 0.5, 0)), 0xffd060, 14, 4);
          markTag('turret', pp, c);
        }
        return true; } },
      { id: 'grenade', key: 'E', lvl: 2, name: 'Blast Rune', cd: 5, tags: ['grenade'], desc: 'Inscribe a rune on the ground (up to 3). It erupts when an enemy steps on it, or when you Detonate.', cast(c, T) {
        faceAim(c, T); c.model.play('cast', 0.3); Audio.play('build');
        const p = aimPoint(c, T, 16); p.y = G.world.groundBelow(p.x, p.y + 3, p.z);
        placeRune(c, p); return true; } },
      { id: 'bot', key: 'C', lvl: 4, name: 'Mending Totem', cd: 16, tags: ['bot'], desc: 'Plant a totem that heals allies within 7m for 12s. Detonating it releases a burst of healing instead.', cast(c, T) {
        Audio.play('build'); const p = c.pos.clone().add(c.forward().multiplyScalar(1.5)); p.y = G.world.groundBelow(p.x, p.y + 2, p.z);
        new Minion('bot', c, p, { life: 12 + c.t('long_battery') * 4, heal: 4 * (1 + c.t('field_medic') * 0.25), shield: !!c.t('nanite_cloud'), stationary: true });
        markTag('bot', c.pos, c); return true; } },
      { id: 'overclock', key: 'R', lvl: 6, name: 'Overclock', cd: 35, tags: ['overclock'], desc: 'The party gains haste for 6s, your gadgets upgrade, and cooldowns drop by 50%.', cast(c, T) {
        Audio.play('levelup'); ring(c.pos, 12, 0xffd060, 0.6);
        for (const h of G.party) { if (h.downed) continue; h.addStatus('haste', 6); for (const k in h.cds) h.cds[k] *= 0.5; burst(h.center(), 0xffd060, 12, 4); }
        for (const e of G.entities) if (e.isMinion && e.owner === c) { e.life += 6; if (e.kind === 'turret') e.tesla = true; }
        markTag('overclock', c.pos, c); return true; } },
    ],
    onKill(c) { c.scrap = (c.scrap || 0) + 1; if (c.scrap >= 3) { c.scrap = 0; c.cds.turret = 0; popText(c.head(), 'SCRAP! Turret ready', 'info', { color: '#ffd060' }); } },
    talents: [
      { id: 'sturdy_build', spec: 'core', tier: 0, max: 3, name: 'Sturdy Build', desc: 'Ballista Wards last 4s longer per rank.' },
      { id: 'bigger_boom', spec: 'core', tier: 0, max: 3, name: 'Wider Glyphs', desc: 'Blast Rune radius increased.' },
      { id: 'long_battery', spec: 'core', tier: 1, max: 2, name: 'Deep Roots', desc: 'Mending Totem lasts 4s longer per rank.' },
      { id: 'tinkerer', spec: 'core', tier: 1, max: 3, name: 'Tinkerer', desc: '+5% max HP and +1 AC per rank.' },
      { id: 'calibrated', spec: 'a', tier: 1, max: 3, name: 'True Sights', desc: 'Ballista damage +20% per rank.' },
      { id: 'twin_turrets', spec: 'a', tier: 2, max: 1, name: 'Twin Wards', desc: 'Raise two ballistae at once.' },
      { id: 'demolition', spec: 'a', tier: 2, max: 1, name: 'Chain Reaction', desc: 'Erupting runes set off other runes and wards nearby.' },
      { id: 'scrapper', spec: 'a', tier: 3, max: 3, name: 'Etched Bolts', desc: 'Runic Bolt damage +15% per rank.' },
      { id: 'siege_mode', spec: 'a', tier: 4, max: 1, name: 'Siege Engine', keystone: true, desc: 'KEYSTONE — Ballistae become trebuchets that lob exploding stones.' },
      { id: 'field_medic', spec: 'b', tier: 1, max: 3, name: 'Verdant Glyphs', desc: 'Mending Totem heals +25% per rank.' },
      { id: 'reinforced', spec: 'b', tier: 2, max: 3, name: 'Warding Ring', desc: 'Allies near your totem take 5% less damage per rank.' },
      { id: 'quick_fix', spec: 'b', tier: 2, max: 2, name: 'Quick Carving', desc: 'Mending Totem cooldown -3s per rank.' },
      { id: 'jury_rig', spec: 'b', tier: 3, max: 1, name: 'Jury Rig', desc: 'Revive downed allies twice as fast.' },
      { id: 'nanite_cloud', spec: 'b', tier: 4, max: 1, name: 'Aegis Totem', keystone: true, desc: 'KEYSTONE — Your totem also shields every ally it heals.' },
    ],
    specs: { a: 'Siegewright', b: 'Wardkeeper' },
    resonance: { neon: { turret: 'Sentry Gun', grenade: 'Proximity Mine', bot: 'Medi-Beacon', overclock: 'Suit Overload' }, asterion: { turret: 'Pulse Turret', grenade: 'Plasma Mine', bot: 'Nanite Pylon', overclock: 'Reactor Overdrive' } },
    resonanceBonus: 'asterion',
  },

  // ───────────────────────────────── CLERIC ──────────────────────────────────
  cleric: {
    name: 'Cleric', role: 'Battle healer', color: '#f0d060',
    blurb: 'Keeps everyone standing, then hits things with a mace. Faith builds as you heal; at full Faith your next heal also smites nearby enemies.',
    stats: { hp: 105, hpPer: 15, ac: 15, speed: 6.0, atk: 4 },
    skill: { insight: 5, persuasion: 4, arcana: 2 },
    model: { weapon: 'mace', hat: 'halo', heroic: 1.1, extras: ['robe', 'plate', 'shield', 'cape'], colors: { body: 0xece4d0, legs: 0xc0b090, accent: 0xd8a840, hair: 0x8a5a30, robe: 0xece4d0, cape: 0xd8c890, shield: 0xece4d0 } },
    passive: { name: 'Faith', desc: 'Healing builds Faith. At 100 Faith, your next heal also blasts enemies with holy light.' },
    mechanic: { name: 'Tether', key: 'RMB', desc: 'Bind a light-tether to the ally nearest your aim. They take 15% less damage and regenerate, and 30% of all damage you deal heals them.', press(c) { const t = tetherTarget(c); setTether(c, t); return true; } },
    basic: { name: 'Blessed Mace', cd: 0.55, range: 2.4, cast(c, T) {
      faceAim(c, T); lunge(c, 2); c.model.play('attack', 0.3); Audio.play('swing');
      c.maceCount = (c.maceCount || 0) + 1;
      if (c.gearFlag('mace_nova') && c.maceCount % 3 === 0) { ring(c.pos, 6, 0xfff080); for (const a of alliesNear(c.pos, 6, c.team)) heal(c, a, 6 * c.pow); }
      meleeHits(c, 2.4, 110, (e) => { const r = strike(c, e, '1d8+2', T, { type: 'blunt', knock: 3, mult: 1 + c.t('crusader') * 0.15 }); if (r && r.hit) { const low = lowestAlly(c, 12); if (low) heal(c, low, 2 * c.pow, true); } });
      return true; } },
    abilities: [
      { id: 'heal', key: 'Q', lvl: 1, name: 'Healing Word', cd: 5, tags: ['heal'], desc: 'Heal the most wounded ally (or yourself).', cast(c, T) {
        const t = lowestAlly(c, 22) || c; c.model.play('cast', 0.3); Audio.play('heal');
        heal(c, t, (18 + c.level * 3) * c.pow * (1 + c.t('lifegiver') * 0.15)); beam(c.center(), t.center(), 0xfff080, 0.12, 0.3);
        if (c.t('beacon')) for (const a of alliesNear(t.pos, 6, c.team)) if (a !== t) heal(c, a, 8 * c.pow);
        if (t.downed) revive(t, 0.3);
        if ((c.faith || 0) >= 100) { c.faith = 0; ring(t.pos, 6, 0xfff080, 0.5); for (const e of enemiesNear(t.pos, 6, c.team)) strike(c, e, '2d8+4', { forced: true }, { type: 'holy', knock: 8 }); popText(c.head(), 'FAITH!', 'fate'); }
        markTag('heal', t.pos, c); return true; } },
      { id: 'sanctuary', key: 'E', lvl: 2, name: 'Sanctuary', cd: 14, tags: ['sanctuary'], desc: 'Hallowed ground: allies take 40% less damage and regenerate.', cast(c, T) {
        Audio.play('holy'); const p = c.pos.clone();
        zone({ pos: p, radius: 5 + c.t('wide_blessing'), life: 7, color: 0xfff080, tag: 'sanctuary', owner: c, tick: (z) => {
          if (c.gearFlag('sanct_move')) { z.pos.x = c.pos.x; z.pos.z = c.pos.z; z.obj.position.x = c.pos.x; z.obj.position.z = c.pos.z; }
          for (const a of alliesNear(z.pos, z.radius, c.team)) { a.addStatus('sanctuary', 0.4); heal(c, a, 1.5 * c.pow, true); }
          if (c.t('consecrate')) for (const e of enemiesNear(z.pos, z.radius, c.team)) dealDamage(c, e, 2 * c.t('consecrate') * c.pow, { type: 'holy', quiet: true, roll: { hit: true } });
        } });
        markTag('sanctuary', p, c); return true; } },
      { id: 'smite', key: 'C', lvl: 4, name: 'Guiding Bolt', cd: 6, tags: ['holy'], desc: 'A radiant bolt that marks the target: attacks on it crit on 16+.', cast(c, T) {
        faceAim(c, T); c.model.play('shoot', 0.3); Audio.play('holy');
        bolt(c, T, { color: 0xfff080, size: 0.36, speed: 30, homing: 3, onHit: (e) => { strike(c, e, '3d6+3', T, { type: 'holy', heavy: true, mult: 1 + c.t('zealot') * 0.12 }); e.addStatus('marked_crit', 5); markTag('holy', e.pos, c); } });
        return true; } },
      { id: 'divine', key: 'R', lvl: 6, name: 'Divine Intervention', cd: 50, tags: ['holy'], desc: 'Revive every downed ally, heal the whole party and release a holy nova.', cast(c, T) {
        Audio.play('holy'); Audio.play('heal'); shake(0.5); G.post && (G.post.flash = 0.8);
        for (const h of G.party) { if (h.downed) revive(h, 0.6); else heal(c, h, h.maxHp * 0.5); }
        ring(c.pos, 12, 0xfff080, 0.7);
        for (const e of enemiesNear(c.pos, 12, c.team)) strike(c, e, '3d10+6', { forced: true }, { type: 'holy', knock: 12, heavy: true });
        if (c.t('avatar')) { c.addStatus('avatar', 8); c.model.body.scale.setScalar(1.6); setTimeout(() => c.model && c.model.body.scale.setScalar(1), 8000); }
        markTag('holy', c.pos, c); return true; } },
    ],
    talents: [
      { id: 'lifegiver', spec: 'core', tier: 0, max: 3, name: 'Lifegiver', desc: '+15% healing per rank.' },
      { id: 'wide_blessing', spec: 'core', tier: 0, max: 2, name: 'Wide Blessing', desc: 'Sanctuary is 1m wider per rank.' },
      { id: 'devotion', spec: 'core', tier: 1, max: 3, name: 'Devotion', desc: 'Faith builds 25% faster per rank.' },
      { id: 'resilience', spec: 'core', tier: 1, max: 3, name: 'Resilience', desc: '+8% max HP per rank.' },
      { id: 'beacon', spec: 'a', tier: 1, max: 1, name: 'Beacon of Light', desc: 'Healing Word also heals allies near the target.' },
      { id: 'mercy', spec: 'a', tier: 2, max: 3, name: 'Mercy', desc: 'Healing Word cooldown -1s per rank.' },
      { id: 'aegis', spec: 'a', tier: 2, max: 3, name: 'Aegis', desc: 'Your heals also grant a shield.' },
      { id: 'second_chance', spec: 'a', tier: 3, max: 1, name: 'Second Chance', desc: 'Once per fight, a lethal hit on an ally leaves them at 1 HP.' },
      { id: 'miracle', spec: 'a', tier: 4, max: 1, name: 'Miracle Worker', keystone: true, desc: 'KEYSTONE — Divine Intervention cooldown is halved.' },
      { id: 'zealot', spec: 'b', tier: 1, max: 3, name: 'Zealot', desc: 'Guiding Bolt deals +12% per rank.' },
      { id: 'consecrate', spec: 'b', tier: 2, max: 3, name: 'Consecrate', desc: 'Sanctuary burns enemies standing in it.' },
      { id: 'crusader', spec: 'b', tier: 2, max: 3, name: 'Crusader', desc: 'Mace hits deal +15% per rank.' },
      { id: 'wrath', spec: 'b', tier: 3, max: 2, name: 'Wrath', desc: 'Crits restore 5 Faith per rank.' },
      { id: 'avatar', spec: 'b', tier: 4, max: 1, name: 'Avatar of Dawn', keystone: true, desc: 'KEYSTONE — After Divine Intervention you grow huge for 8s: double damage, immune to stun.' },
    ],
    specs: { a: 'Life Domain', b: 'War Domain' },
    resonance: { neon: { heal: 'First Aid Kit', sanctuary: 'Safe Zone', smite: 'Justice Beam', divine: 'Rally the City' }, asterion: { heal: 'Stim Injector', sanctuary: 'Med Field', smite: 'Solar Flare', divine: 'Emergency Resuscitation' } },
    resonanceBonus: 'emberwood',
  },

  // ───────────────────────────────── ROGUE ───────────────────────────────────
  rogue: {
    name: 'Rogue', role: 'Assassin', color: '#40c080',
    blurb: 'Hits from the shadows. Attacks from stealth or from behind crit on 15+. Hand them your best Fate Die and watch things disappear.',
    stats: { hp: 85, hpPer: 12, ac: 14, speed: 7.2, atk: 6 },
    skill: { stealth: 5, persuasion: 3, insight: 3, athletics: 2 },
    model: { weapon: 'daggers', hat: 'hood', extras: ['cape'], colors: { body: 0x2a2e2a, legs: 0x1e2220, accent: 0x6a4a30, hat: 0x22302a, cape: 0x18221c, boots: 0x2a1a12 } },
    passive: { name: 'Sneak Attack & Combo', desc: 'Attacks from stealth or from behind crit on 15+. Hits build Combo (max 5), which Eviscerate spends.' },
    mechanic: { name: 'Tumble', key: 'RMB', desc: 'Roll through your target and come up behind it (2 charges). Gain 1 Combo; your next hit within 1.5s is a guaranteed crit.', press(c, T) {
      c.tumbleCharges = c.tumbleCharges ?? 2; if (c.tumbleCharges <= 0) { Audio.play('miss'); return false; }
      c.tumbleCharges--; setTimeout(() => (c.tumbleCharges = Math.min(2, (c.tumbleCharges || 0) + 1)), 4000);
      const t = T.target && !T.target.dead && T.target.pos.distanceTo(c.pos) < 8 ? T.target : null;
      const dest = t ? t.pos.clone().sub(t.forward().multiplyScalar(1.4)) : c.pos.clone().add(flat((T.dir || c.forward()).clone()).multiplyScalar(5));
      const d = dest.sub(c.pos); d.y = 0; c.knock.add(d.multiplyScalar(4.2)); c.addStatus('invuln', 0.4); c.addStatus('dodge', 0.4); c.addStatus('tumbled', 1.5);
      c.model.play('roll', 0.35); Audio.play('dash'); addCombo(c, 1);
      if (t) setTimeout(() => { c.yaw = Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z); }, 280);
      return true; } },
    basic: { name: 'Twin Daggers', cd: 0.3, range: 2.2, cast(c, T) {
      faceAim(c, T); lunge(c, 2.5); c.model.play(Math.random() < 0.5 ? 'attack' : 'thrust', 0.2); Audio.play('swing');
      meleeHits(c, 2.2, 100, (e) => { const behind = e.forward().dot(c.forward()) > 0.3; const tum = c.has('tumbled'); if (tum) c.removeStatus('tumbled'); const r = strike(c, e, '1d6+2', { ...T, fromBehind: behind, autoCrit: tum }, { type: 'slash', word: 'shadow' }); if (r && r.hit) addCombo(c, 1); });
      if (c.has('stealth') && !c.t('shadow_dance')) c.removeStatus('stealth');
      return true; } },
    abilities: [
      { id: 'shadowstep', key: 'Q', lvl: 1, name: 'Shadowstep', cd: 6, tags: ['shadow'], desc: 'Teleport behind a target and backstab (auto-crit).', cast(c, T) {
        const t = T.target && !T.target.dead ? T.target : nearestEnemy(c, c.team, 14); if (!t) return false;
        burst(c.center(), 0x40c080, 14, 3); Audio.play('shadow');
        const behind = t.pos.clone().sub(t.forward().multiplyScalar(1.2)); behind.y = t.pos.y + 0.1;
        if (!G.world.boxHits(behind.x - 0.3, behind.y, behind.z - 0.3, behind.x + 0.3, behind.y + 1.8, behind.z + 0.3)) c.pos.copy(behind); else c.pos.copy(t.pos).add(V(0.8, 0.2, 0));
        c.faceTo(t.pos); c.yaw = Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z); c.model.play('thrust', 0.3);
        const low = t.hp / t.maxHp < 0.25 && c.t('assassinate');
        strike(c, t, '3d6+4', { ...T, autoCrit: true, fromBehind: true }, { type: 'slash', word: 'shadow', heavy: true, mult: low ? 1.5 : 1 }); addCombo(c, 2);
        if (c.gearFlag('shadow_double')) setTimeout(() => { if (!t.dead) strike(c, t, '3d6+4', { autoCrit: true, useFate: false }, { type: 'slash', word: 'shadow' }); }, 180);
        markTag('shadow', t.pos, c); return true; } },
      { id: 'smoke', key: 'E', lvl: 2, name: 'Smoke Bomb', cd: 12, tags: ['smoke'], desc: 'Smoke cloud: allies inside are stealthed, enemies inside are blinded.', cast(c, T) {
        Audio.play('dash'); const p = c.pos.clone();
        burst(p.clone().add(V(0, 1, 0)), [0x606070, 0x404050], 50, 5, 1.5, 0.5, 0.5);
        zone({ pos: p, radius: 4.5, life: 6, color: 0x707080, opacity: 0.35, tag: 'smoke', owner: c, tick: (z) => {
          for (const a of alliesNear(z.pos, z.radius, c.team)) a.addStatus('stealth', 1);
          for (const e of enemiesNear(z.pos, z.radius, c.team)) { e.addStatus('blind', 1); e.tauntedBy = null; }
          burst(z.pos.clone().add(V((Math.random() - .5) * 6, 1, (Math.random() - .5) * 6)), 0x606070, 3, 1, 1.2, 0.6, 0.3);
        } });
        if (c.t('decoy')) new Minion('decoy', c, p.clone(), { life: 6, hp: 60 * c.pow });
        c.addStatus('stealth', 2); markTag('smoke', p, c); return true; } },
      { id: 'eviscerate', key: 'C', lvl: 4, name: 'Eviscerate', cd: 3, tags: ['knives'], desc: 'Finisher: spends all Combo. Damage grows with each point; at 5 Combo it is a guaranteed crit that leaves the target bleeding.', cast(c, T) {
        const cp = c.combo || 0; if (cp < 1) { popText(c.head(), 'No combo', 'miss'); return false; }
        const t = T.target && !T.target.dead && T.target.pos.distanceTo(c.pos) < 4 ? T.target : nearestEnemy(c, c.team, 3.5); if (!t) return false;
        faceAim(c, { target: t }); c.model.play('thrust', 0.3); Audio.play('bigHit'); c.combo = 0;
        strike(c, t, '1d8+3', { ...T, autoCrit: cp >= 5 }, { type: 'slash', heavy: true, mult: 1 + cp * 0.6 });
        if (cp >= 3 || c.t('more_knives')) t.addStatus('bleed', 4, { every: 0.5, onTick: (x) => dealDamage(c, x, (1.5 + c.t('more_knives')) * c.pow * (1 + c.t('hemorrhage') * 0.33), { quiet: true, roll: { hit: true } }) });
        burst(t.center(), 0xc02a2a, 10, 3, 0.4, 0.2, -4); markTag('knives', t.pos, c);
        return true; } },
      { id: 'deathmark', key: 'R', lvl: 6, name: 'Death Mark', cd: 30, tags: ['shadow'], desc: 'Mark a target. After 4s it takes all the damage it took again, plus 50%.', cast(c, T) {
        const t = T.target && !T.target.dead ? T.target : nearestEnemy(c, c.team, 20); if (!t) return false;
        Audio.play('shadow'); popText(t.head(), 'MARKED', 'fumble');
        t.addStatus('deathmark', 4, { stored: 0, onEnd: (x, s) => { if (x.dead) return; burst(x.center(), 0x40ff90, 30, 6); dealDamage(c, x, s.stored * 1.5 + 20 * c.pow, { type: 'shadow', roll: { hit: true, crit: true, roll: 20 }, heavy: true }); } });
        markTag('shadow', t.pos, c); return true; } },
    ],
    onKill(c) { if (c.t('vanishing_act')) c.addStatus('stealth', 3); if (c.t('loaded_dice') && G.combat.active && G.combat.dice.length < 9) { G.combat.dice.push(Math.max(5, d20())); popText(c.head(), '+1 FATE DIE', 'fate'); } },
    talents: [
      { id: 'quick_hands', spec: 'core', tier: 0, max: 3, name: 'Quick Hands', desc: 'Attack speed +8% per rank.' },
      { id: 'more_knives', spec: 'core', tier: 0, max: 3, name: 'Serrated Edge', desc: 'Eviscerate always causes bleeding, and bleeds harder per rank.' },
      { id: 'evasion', spec: 'core', tier: 1, max: 3, name: 'Evasion', desc: 'Dash cooldown -15% per rank.' },
      { id: 'poison', spec: 'core', tier: 1, max: 3, name: 'Poisoned Edge', desc: 'Basic attacks poison.' },
      { id: 'assassinate', spec: 'a', tier: 1, max: 3, name: 'Assassinate', desc: 'Crits deal +25% per rank; Shadowstep deals +50% to foes below 25% HP.' },
      { id: 'shadow_dance', spec: 'a', tier: 2, max: 1, name: 'Shadow Dance', desc: 'Basic attacks no longer break stealth.' },
      { id: 'cold_blood', spec: 'a', tier: 2, max: 2, name: 'Cold Blood', desc: 'Shadowstep cooldown -1.5s per rank.' },
      { id: 'hemorrhage', spec: 'a', tier: 3, max: 3, name: 'Hemorrhage', desc: 'Bleeds deal double damage.' },
      { id: 'vanishing_act', spec: 'a', tier: 4, max: 1, name: 'Vanishing Act', keystone: true, desc: 'KEYSTONE — Kills put you back into stealth for 3s.' },
      { id: 'pickpocket', spec: 'b', tier: 1, max: 3, name: 'Pickpocket', desc: 'Hits have a chance to steal gold.' },
      { id: 'decoy', spec: 'b', tier: 2, max: 1, name: 'Decoy', desc: 'Smoke Bomb leaves a decoy that taunts enemies.' },
      { id: 'lucky', spec: 'b', tier: 2, max: 2, name: 'Lucky', desc: 'Start fights with 1 extra Fate Die per rank.' },
      { id: 'gambit', spec: 'b', tier: 3, max: 3, name: "Gambler's Gambit", desc: 'Sacrificing a die grants +10% damage for 5s per rank.' },
      { id: 'loaded_dice', spec: 'b', tier: 4, max: 1, name: 'Loaded Dice', keystone: true, desc: 'KEYSTONE — Fate Dice never roll below 5, and kills add a new die to your hand.' },
    ],
    specs: { a: 'Assassin', b: 'Trickster' },
    resonance: { neon: { shadowstep: 'Rooftop Drop', smoke: 'Flashbang', knives: 'Shuriken Storm', deathmark: 'Contract Kill' }, asterion: { shadowstep: 'Phase Shift', smoke: 'Coolant Vent', knives: 'Monofilament Fan', deathmark: 'Terminal Virus' } },
    resonanceBonus: 'neon',
  },

  // ───────────────────────────────── RANGER ──────────────────────────────────
  ranger: {
    name: 'Ranger', role: 'Hunter & beast friend', color: '#6ab04a',
    blurb: 'A bow and a loyal wolf. Consecutive hits on the same prey stack Hunter\'s Focus for more damage.',
    stats: { hp: 90, hpPer: 13, ac: 14, speed: 6.8, atk: 5 },
    skill: { survival: 5, athletics: 3, insight: 3 },
    model: { weapon: 'bow', sleeves: true, extras: ['quiver', 'cape'], colors: { body: 0x3e5a2a, legs: 0x5a4020, accent: 0x8a6a3a, cape: 0x2e4420, hair: 0x6a3a1a } },
    passive: { name: "Hunter's Focus", desc: 'Each consecutive hit on the same target adds +6% damage (up to 5 stacks).' },
    mechanic: { name: 'Aimed Shot', key: 'RMB', hold: true, desc: 'Hold to draw your bow, release to loose. A full draw pierces everything in its path and crits on 14+.',
      start(c) { c.drawT = 0; c.addStatus('drawing', 99); Audio.play('arrow'); },
      tick(c, dt) { c.drawT = Math.min(1.1, (c.drawT || 0) + dt); c.model.state = 'draw'; c.model.stateT = 1; if (c.drawT >= 1.1 && !c._drawReady) { c._drawReady = true; Audio.play('diceLand'); burst(c.center(), 0xfff0a0, 10, 2, 0.4, 0.2, 0); } },
      end(c, T) { c.removeStatus('drawing'); c._drawReady = false; const k = Math.min(1, (c.drawT || 0) / 1.1); c.model.play('shoot', 0.25); Audio.play('arrow');
        if (k < 0.15) return;
        faceAim(c, T); const full = k >= 1;
        bolt(c, T, { color: full ? 0xfff0a0 : 0xe8d8a0, size: full ? 0.2 : 0.14, speed: 70, arrow: true, pierce: full ? 99 : 0, onHit: (e) => { strike(c, e, '2d8+4', { ...T, bonus: full ? 4 : 0, critFloor: full ? 14 : null }, { type: 'pierce', mult: 0.6 + 1.8 * k, heavy: full }); if (full) burst(e.center(), 0xfff0a0, 12, 4, 0.4, 0.25, 0); } });
        c.cds.basic = 0.3; } },
    basic: { name: 'Longbow', cd: 0.5, range: 28, cast(c, T) {
      faceAim(c, T); c.model.play('shoot', 0.3); Audio.play('arrow');
      bolt(c, T, { color: 0xe8d8a0, size: 0.12, speed: 44, pierce: c.t('piercing') ? 2 : 0, onHit: (e) => {
        if (c.prey === e) c.focus = Math.min(5, (c.focus || 0) + 1); else { c.prey = e; c.focus = 0; }
        strike(c, e, '1d8+2', T, { type: 'pierce', mult: 1 + c.focus * 0.06 * (1 + c.t('patience') * 0.5), word: 'pierce' });
        if (c.gearFlag('ricochet')) { const n2 = nearestEnemy(e, c.team, 10, (x) => x !== e); if (n2) { beam(e.center(), n2.center(), 0xe8d8a0, 0.05, 0.15); strike(c, n2, '1d8', { useFate: false }, { type: 'pierce', quiet: true }); } } } });
      return true; } },
    abilities: [
      { id: 'volley', key: 'Q', lvl: 1, name: 'Volley', cd: 8, tags: ['volley'], desc: 'Rain arrows on an area for 2 seconds.', cast(c, T) {
        const p = aimPoint(c, T, 26); c.model.play('shoot', 0.4); Audio.play('arrow');
        const r = 4 + c.t('wide_volley');
        zone({ pos: p, radius: r, life: 2.2, color: 0xe8d8a0, tag: 'volley', owner: c, opacity: 0.12, tick: (z) => {
          Audio.play('arrow');
          for (let i = 0; i < 5; i++) { const q = z.pos.clone().add(V((Math.random() - .5) * r * 1.6, 0, (Math.random() - .5) * r * 1.6)); spawnProjectile({ from: q.clone().add(V(0, 10, 0)), dir: V(0, -1, 0), speed: 30, color: 0xe8d8a0, size: 0.12, owner: c, life: 0.6 }); }
          for (const e of enemiesNear(z.pos, r, c.team)) { strike(c, e, '1d6+2', { useFate: false }, { type: 'pierce', quiet: true }); if (c.gearFlag('volley_snare')) e.addStatus('snare', 0.5); }
        } });
        if (c.t('alpha')) { const foes = enemiesNear(p, r, c.team); G.entities.filter((e) => e.isMinion && e.kind === 'wolf' && e.owner === c).forEach((w, i) => foes[i] && w.pounce(foes[i])); }
        markTag('volley', p, c); return true; } },
      { id: 'snare', key: 'E', lvl: 2, name: 'Snare Trap', cd: 10, tags: ['snare'], desc: 'Toss a trap that roots every enemy nearby for 3s.', cast(c, T) {
        const p = aimPoint(c, T, 16); Audio.play('build');
        telegraph(p, 3.5, 0.35, 0x80c040, (q) => {
          Audio.play('block'); ring(q, 3.5, 0x80c040, 0.4);
          for (const e of enemiesNear(q, 3.5 + c.t('bigger_traps'), c.team)) { e.addStatus('snare', 3 + c.t('bigger_traps') * 0.5); strike(c, e, '1d8', { useFate: false }, { type: 'pierce' }); markTag('snare', e.pos, c); }
        }, c);
        return true; } },
      { id: 'pounce', key: 'C', lvl: 1, name: 'Command: Pounce', cd: 6, tags: ['beast'], desc: 'Your wolf leaps on the target, dealing heavy damage and stunning it.', cast(c, T) {
        const t = T.target && !T.target.dead ? T.target : nearestEnemy(c, c.team, 20); if (!t) return false;
        const pets = G.entities.filter((e) => e.isMinion && e.kind === 'wolf' && e.owner === c && !e.dead);
        if (!pets.length) { summonPet(c); return true; }
        pets.forEach((p) => p.pounce(t)); Audio.play('roar'); return true; } },
      { id: 'storm', key: 'R', lvl: 6, name: 'Arrowstorm', cd: 30, tags: ['volley'], desc: 'For 8s every arrow splits into 3 and ricochets.', cast(c, T) {
        c.addStatus('arrowstorm', 8); Audio.play('levelup'); ring(c.pos, 6, 0xe8d8a0);
        timed(8, (f, dt) => { f.acc = (f.acc || 0) + dt; if (f.acc > 0.3) { f.acc = 0; const t = nearestEnemy(c, c.team, 26); if (t) { for (let i = -1; i <= 1; i++) { const d = t.center().sub(c.center()).normalize().applyAxisAngle(V(0, 1, 0), i * 0.12); spawnProjectile({ from: c.center().add(V(0, 0.4, 0)), dir: d, speed: 40, color: 0xfff0a0, size: 0.12, owner: c, onHit: (e) => strike(c, e, '1d8+2', { useFate: false }, { type: 'pierce', quiet: true }) }); } Audio.play('arrow'); markTag('volley', t.pos, c); } } if (c.downed) return false; });
        return true; } },
    ],
    talents: [
      { id: 'piercing', spec: 'core', tier: 0, max: 1, name: 'Piercing Shots', desc: 'Arrows pierce 2 enemies.' },
      { id: 'wide_volley', spec: 'core', tier: 0, max: 3, name: 'Wide Volley', desc: 'Volley radius +1m per rank.' },
      { id: 'bigger_traps', spec: 'core', tier: 1, max: 3, name: 'Bigger Traps', desc: 'Snare radius and duration increased.' },
      { id: 'fleetfoot', spec: 'core', tier: 1, max: 3, name: 'Fleetfoot', desc: '+5% move speed per rank.' },
      { id: 'patience', spec: 'a', tier: 1, max: 3, name: 'Patience', desc: "Hunter's Focus bonus +50% per rank." },
      { id: 'longshot', spec: 'a', tier: 2, max: 3, name: 'Longshot', desc: '+10% damage to targets more than 12m away.' },
      { id: 'called_shot', spec: 'a', tier: 2, max: 2, name: 'Called Shot', desc: '+1 to hit per rank.' },
      { id: 'headhunter', spec: 'a', tier: 3, max: 3, name: 'Headhunter', desc: '+15% damage to elites, captains and bosses per rank.' },
      { id: 'deadeye', spec: 'a', tier: 4, max: 1, name: 'Deadeye', keystone: true, desc: 'KEYSTONE — Your attacks crit on a natural 18 or higher.' },
      { id: 'packleader', spec: 'b', tier: 1, max: 3, name: 'Pack Leader', desc: 'Wolf damage and HP +25% per rank.' },
      { id: 'feral', spec: 'b', tier: 2, max: 2, name: 'Feral Bond', desc: 'Pounce cooldown -1.5s per rank.' },
      { id: 'second_pet', spec: 'b', tier: 2, max: 1, name: 'Second Companion', desc: 'A second wolf joins the hunt.' },
      { id: 'bonded', spec: 'b', tier: 3, max: 3, name: 'Bonded', desc: 'When your wolf bites, you heal.' },
      { id: 'alpha', spec: 'b', tier: 4, max: 1, name: 'Alpha', keystone: true, desc: 'KEYSTONE — Wolves stun longer, and your Volley makes them pounce every target inside.' },
    ],
    specs: { a: 'Sharpshooter', b: 'Beastmaster' },
    resonance: { neon: { volley: 'Trick-Arrow Barrage', snare: 'Bola Launcher', pounce: 'Sidekick Assist', storm: 'Quiver of Wonders' }, asterion: { volley: 'Flechette Rain', snare: 'Gravity Mine', pounce: 'Robo-Hound Strike', storm: 'Swarm Protocol' } },
    resonanceBonus: 'asterion',
  },
};

export const CLASS_IDS = Object.keys(CLASSES);

function placeRune(c, p) {
  c.runes = (c.runes || []).filter((r) => !r.done); if (c.runes.length >= 3) erupt(c, c.runes.shift(), 1);
  const r = { pos: p.clone(), owner: c, t: 0, done: false };
  const fx = zone({ pos: p, radius: 1.6 + c.t('bigger_boom') * 0.3, life: 60, color: 0xffb04a, opacity: 0.1, tag: 'grenade', owner: c, tick: (z) => {
    if (r.done) { z.t = z.life; return; }
    r.t += 0.25; if (r.t < 0.6) return;
    if (enemiesNear(r.pos, 2.2 + c.t('bigger_boom') * 0.4, c.team).length) erupt(c, r, 1);
  } });
  r.fx = fx; c.runes.push(r); markTag('grenade', p, c);
}
function erupt(c, r, mult) {
  if (r.done) return; r.done = true; if (r.fx) r.fx.t = r.fx.life;
  const q = r.pos; Audio.play('explode'); shake(0.15); burst(q.clone().add(V(0, 0.5, 0)), [0xffb04a, 0xfff0c0], 40, 7, 0.7, 0.4, 1); ring(q, 4, 0xffb04a);
  for (const e of enemiesNear(q, 3.8 + c.t('bigger_boom') * 0.6, c.team)) { strike(c, e, '2d8+4', { useFate: false }, { type: 'blast', knock: 9, mult }); e.addStatus('stun', 0.8); }
  if (c.t('demolition')) for (const o of (c.runes || [])) if (!o.done && o.pos.distanceTo(q) < 7) setTimeout(() => erupt(c, o, mult), 150);
  markTag('grenade', q, c);
}
function detonate(c) {
  const mine = G.entities.filter((e) => e.isMinion && e.owner === c && !e.dead && (e.kind === 'turret' || e.kind === 'bot'));
  const runes = (c.runes || []).filter((r) => !r.done);
  if (!mine.length && !runes.length) { popText(c.head(), 'Nothing to detonate', 'miss'); return false; }
  runes.forEach((r, i) => setTimeout(() => erupt(c, r, 1.5), i * 90));
  for (const m of mine) {
    const q = m.pos.clone(); const f = Math.max(0.3, Math.min(1, m.life / 14));
    if (m.kind === 'turret') { Audio.play('explode'); burst(q.clone().add(V(0, 1, 0)), [0xffb04a, 0xffffff], 40, 8, 0.8, 0.4, 1); ring(q, 5, 0xffb04a); for (const e of enemiesNear(q, 4.5, c.team)) strike(c, e, '2d10+4', { useFate: false }, { type: 'blast', knock: 12, heavy: true, mult: 1 + f }); c.cds.turret = Math.max(0, (c.cds.turret || 0) * 0.6); }
    else { Audio.play('heal'); ring(q, 8, 0x7aff9a); for (const a of alliesNear(q, 8, c.team)) heal(c, a, a.maxHp * 0.18 * (1 + f)); }
    m.life = 0;
  }
  return true;
}
function addCombo(c, n) { c.combo = Math.min(5, (c.combo || 0) + n); }
function tetherTarget(c) {
  const d = (c.aimDir || c.forward()).clone(); let best = null, bs = Infinity;
  for (const a of G.party) { if (a === c || a.dead) continue; const to = a.pos.clone().sub(c.pos); const dist = to.length(); if (dist > 25) continue; const s = to.normalize().angleTo(d) * 10 + dist * 0.1; if (s < bs) { bs = s; best = a; } }
  return best || c;
}
export function setTether(c, t) {
  if (c.tether === t) return; c.tether = t; Audio.play('heal'); popText(t.head(), 'Tethered', 'heal');
  if (c._tetherFx) c._tetherFx.dead = true;
  const fx = timed(99999, (f, dt) => {
    if (fx.dead || c.dead || t.dead || c.tether !== t) return false;
    t.addStatus('tethered', 0.5, { src: c }); if (!t.downed && !c.downed) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * 0.012 * dt);
    const a = c.center(), b = t.center(); f.line.geometry.setFromPoints([a, a.clone().lerp(b, 0.5).add(V(0, 0.5, 0)), b]);
  });
  const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: new THREE.Color(0xffe890).multiplyScalar(3), toneMapped: false, transparent: true, opacity: 0.8 }));
  G.scene.add(line); fx.line = line; const od = fx.dispose.bind(fx); fx.dispose = () => { G.scene.remove(line); line.geometry.dispose(); od(); };
  c._tetherFx = fx;
}
function gritMult(c) { if ((c.grit || 0) >= 100) { c.grit = 0; popText(c.head(), 'GRIT!', 'fate'); return 1.5; } return 1; }
function lowestAlly(c, range) {
  let best = null, bv = 1;
  for (const a of G.entities) { if (a.team !== c.team || a.isMinion || a.dead) continue; if (a.pos.distanceTo(c.pos) > range) continue; const v = a.downed ? -1 : a.hp / a.maxHp; if (v < bv) { bv = v; best = a; } }
  return best;
}
export function summonPet(c) {
  const n = 1 + (c.t('second_pet') ? 1 : 0);
  const have = G.entities.filter((e) => e.isMinion && e.kind === 'wolf' && e.owner === c && !e.dead).length;
  for (let i = have; i < n; i++) {
    const p = c.pos.clone().add(V(1.2 + i, 0.2, -1));
    const big = c.gearFlag('giant_wolf');
    const w = new Minion('wolf', c, p, { name: i ? 'Ash' : 'Bramble', hp: 45 * c.pow * (1 + c.t('packleader') * 0.25) * (big ? 1.5 : 1), dmg: 6 * (1 + c.t('packleader') * 0.25) * (big ? 2 : 1) });
    if (big) { w.model.body.scale.setScalar(1.6); w.radius = 0.7; }
  }
}

export function abilityName(classId, abId, realmKind) {
  const cl = CLASSES[classId]; const res = cl.resonance?.[realmKind]; return (res && res[abId]) || cl.abilities.find((a) => a.id === abId)?.name || abId;
}

// Base cooldown modifiers from talents that change specific abilities.
export function cdMod(c, abId) {
  let m = 1 - (c.t('mana_flow') * 0.06) - (c.gearStat?.('cdr') || 0) / 100;
  if (abId === 'heal') m -= c.t('mercy') * 0.2;
  if (abId === 'shadowstep') m -= c.t('cold_blood') * 0.25;
  if (abId === 'pounce') m -= c.t('feral') * 0.25;
  if (abId === 'bot') m -= c.t('quick_fix') * 0.18;
  if (abId === 'divine' && c.t('miracle')) m -= 0.5;
  if (abId === 'blink' && c.gearFlag('blink_twice')) m -= 0.45;
  if (abId === 'smoke' && c.gearFlag('smoke_cd')) m -= 0.5;
  if (G.realm && CLASSES[c.classId].resonanceBonus === G.realm.kind) m -= 0.1;
  return Math.max(0.3, m);
}
