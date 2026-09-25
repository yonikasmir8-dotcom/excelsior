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

// ── Sorcerer wild magic ──────────────────────────────────────────────────────
const SURGES = [
  { r: [1, 1], name: 'Backfire!', bad: true, fx: (c) => { dealDamage(null, c, c.maxHp * 0.08, { roll: { hit: true }, unavoidable: true, type: 'fire' }); burst(c.center(), 0xff4020, 20, 5); } },
  { r: [2, 2], name: 'Chicken Hat', bad: true, fx: (c) => { popText(c.head(), 'BAWK!', 'sfx'); c.addStatus('slow', 2); } },
  { r: [3, 3], name: 'Random Teleport', fx: (c) => { c.pos.add(V((Math.random() - 0.5) * 10, 3, (Math.random() - 0.5) * 10)); burst(c.center(), 0xc070ff, 20, 4); } },
  { r: [4, 17], name: null },
  { r: [18, 18], name: 'Mana Rush', fx: (c) => { for (const k in c.cds) c.cds[k] *= 0.5; } },
  { r: [19, 19], name: 'Echo Cast', fx: (c, ab, T) => { setTimeout(() => { if (!c.dead && !c.downed) ab.cast(c, { ...T, echo: true }); }, 300); } },
  { r: [20, 20], name: 'WILD SURGE!', fx: (c) => { for (const e of enemiesNear(c.pos, 10, c.team)) { beam(c.center(), e.center(), 0xff60ff, 0.2, 0.3, 1); dealDamage(c, e, 20 * c.pow, { type: 'lightning', roll: { hit: true } }); } addStyle(30); } },
];
function wildSurge(c, ab, T) {
  if (T.echo) return;
  let r = d20();
  const chaos = c.t('chaos_bloom'); const tamed = c.t('tamed_chaos');
  if (chaos) r = Math.min(20, r + chaos * 2);
  if (tamed >= 2 && r <= 3) r = 4;
  if (r <= 2 && c.gearFlag('chicken_luck')) r = 19;
  const s = SURGES.find((s) => r >= s.r[0] && r <= s.r[1]);
  if (!s || !s.name) return;
  popText(c.head().add(V(0, 0.6, 0)), `d${r}: ${s.name}`, s.bad ? 'fumble' : 'fate');
  s.fx(c, ab, T);
}

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
    model: { weapon: 'sword', hat: 'helm', extras: ['shield', 'shoulder', 'cape'], colors: { body: 0xb03028, legs: 0x4a3a30, accent: 0x9aa4b0, cape: 0x8a1818 } },
    passive: { name: 'Grit', desc: 'Taking damage builds Grit. At 100 Grit, your next ability deals +50% damage.' },
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
      { id: 'battlecry', key: 'RMB', lvl: 4, name: 'Battle Cry', cd: 14, tags: ['taunt'], desc: 'Taunt all enemies nearby and take 30% less damage for 5s.', cast(c, T) {
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
    name: 'Sorcerer', role: 'Chaotic blaster', color: '#b04ae0',
    blurb: 'Raw, unstable magic. Every spell rolls a Wild Surge die: mostly nothing, sometimes glorious, occasionally a chicken.',
    stats: { hp: 80, hpPer: 11, ac: 12, speed: 6.2, atk: 5 },
    skill: { arcana: 5, persuasion: 3, insight: 2 },
    model: { weapon: 'staff', hat: 'wizard', extras: ['robe', 'cape'], colors: { body: 0x5a2a8a, legs: 0x3a1a5a, accent: 0xe0b040, hat: 0x4a1a7a, cape: 0x2a0a4a, magic: 0xff7a30 } },
    passive: { name: 'Wild Magic', desc: 'Each spell rolls a d20 surge. 20: a free lightning nova. 19: the spell echoes. 1: backfire.' },
    basic: { name: 'Arcane Bolt', cd: 0.4, range: 22, cast(c, T) {
      faceAim(c, T); c.model.play('shoot', 0.25); Audio.play('zap');
      bolt(c, T, { color: 0xd080ff, size: 0.22, speed: 30, homing: 2, onHit: (e) => { strike(c, e, '1d8+1', T, { type: 'lightning', word: 'lightning', sfxColor: '#d080ff' }); let prev = e; const seen = new Set([e]); for (let i = 0; i < c.t('conductor'); i++) { const n = nearestEnemy(prev, c.team, 6, (x) => !seen.has(x)); if (!n) break; seen.add(n); beam(prev.center(), n.center(), 0xd080ff, 0.08, 0.15, 0.6); strike(c, n, '1d6', { useFate: false }, { type: 'lightning', quiet: true }); prev = n; } } });
      return true; } },
    abilities: [
      { id: 'firebolt', key: 'Q', lvl: 1, name: 'Firebolt', cd: 3.5, tags: ['fire'], desc: 'A roaring bolt that explodes and sets foes ablaze.', cast(c, T) {
        faceAim(c, T); c.model.play('shoot', 0.3); Audio.play('fire');
        const explode = (p, direct) => {
          burst(p, [0xff5a1a, 0xffd23a], 24, 7, 0.6, 0.25); ring(p, 3, 0xff7a30); markTag('fire', p, c);
          for (const e of enemiesNear(p, 2.8 + c.t('inferno') * 0.6, c.team)) {
            const r = strike(c, e, e === direct ? '2d10+4' : '1d10+2', T, { type: 'fire', heavy: e === direct });
            e.addStatus('burn', 3 + c.t('inferno'), { every: 0.5, onTick: (x) => dealDamage(c, x, 2 * c.pow, { type: 'fire', quiet: true, roll: { hit: true } }) });
          }
        };
        const n = c.gearFlag('triple_firebolt') ? 3 : 1;
        for (let i = 0; i < n; i++) { const d = aimDir(c, T).applyAxisAngle(V(0, 1, 0), (i - (n - 1) / 2) * 0.18); bolt(c, { ...T, target: i === 0 ? T.target : null, dir: d }, { color: 0xff6a1a, size: 0.42, speed: 28, onHit: (e, p) => explode(p, e), onWorld: (p) => explode(p), onExpire: (p) => explode(p) }); }
        wildSurge(c, this, T); return true; } },
      { id: 'chain', key: 'E', lvl: 2, name: 'Chain Lightning', cd: 6, tags: ['lightning'], desc: 'Lightning leaps between up to 4 enemies.', cast(c, T) {
        faceAim(c, T); c.model.play('cast', 0.35); Audio.play('zap');
        let tgt = T.target && !T.target.dead ? T.target : nearestEnemy(c, c.team, 18);
        if (!tgt) return false;
        const hitSet = new Set(); let prev = c.center().add(V(0, 0.5, 0));
        const max = 4 + c.t('arc_jumps') * 2 + (c.t('eye_of_storm') ? 8 : 0);
        const roll = attackRoll(c, tgt, T);
        for (let i = 0; i < max && tgt; i++) {
          hitSet.add(tgt); beam(prev, tgt.center(), 0xaef4ff, 0.14, 0.25, 1.1);
          strike(c, tgt, '2d6+2', {}, { type: 'lightning', roll, mult: 1 + c.t('static') * 0.1 * i });
          if (c.t('static')) tgt.addStatus('slow', 1.5);
          markTag('lightning', tgt.pos, c);
          prev = tgt.center(); tgt = nearestEnemy(tgt, c.team, 8, (e) => !hitSet.has(e));
          if (c.t('eye_of_storm') && !roll.hit) break;
        }
        wildSurge(c, this, T); return true; } },
      { id: 'blink', key: 'RMB', lvl: 4, name: 'Blink', cd: 7, tags: ['blink'], desc: 'Teleport 9m, leaving an arcane blast behind.', cast(c, T) {
        const dir = flat((T.dir || c.forward()).clone());
        const from = c.pos.clone(); Audio.play('shadow');
        burst(c.center(), 0xc070ff, 24, 5, 0.5); ring(from, 3.5, 0xc070ff);
        for (const e of enemiesNear(from, 3.5, c.team)) strike(c, e, '1d10+3', T, { type: 'lightning', knock: 8 });
        let dist = 9; for (let d = 9; d > 0; d -= 0.5) { const p = from.clone().addScaledVector(dir, d); if (!G.world.boxHits(p.x - 0.35, p.y + 0.1, p.z - 0.35, p.x + 0.35, p.y + 1.8, p.z + 0.35)) { dist = d; break; } dist = 0; }
        c.pos.addScaledVector(dir, dist); c.vel.set(0, 0, 0); c.addStatus('invuln', 0.3);
        burst(c.center(), 0xc070ff, 24, 5, 0.5); markTag('blink', c.pos, c);
        if (c.t('phase_cloak')) c.addStatus('stealth', 1.5 * c.t('phase_cloak'));
        wildSurge(c, this, T); return true; } },
      { id: 'meteor', key: 'R', lvl: 6, name: 'Meteor', cd: 28, tags: ['fire'], desc: 'Call down a meteor that craters the ground.', cast(c, T) {
        const p = aimPoint(c, T, 24); c.model.play('cast', 0.8); Audio.play('fire');
        const n = c.t('meteor_swarm') ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const pp = p.clone().add(V((Math.random() - 0.5) * (i ? 8 : 0), 0, (Math.random() - 0.5) * (i ? 8 : 0)));
          telegraph(pp, 5, 1.1 + i * 0.35, 0xff5a1a, (q) => {
            Audio.play('explode'); shake(0.9); G.post && (G.post.flash = 0.6);
            const blocks = G.world.explode(q.x, q.y, q.z, 3.4, G.realm?.protect); debris(blocks);
            burst(q, [0xff5a1a, 0xffd23a, 0x222222], 40, 12, 1.0, 0.3);
            for (const e of enemiesNear(q, 5, c.team)) strike(c, e, '4d12+8', { forced: true, useFate: i === 0 }, { type: 'fire', knock: 16, heavy: true });
            markTag('fire', q, c);
          });
        }
        wildSurge(c, this, T); return true; } },
    ],
    talents: [
      { id: 'focus', spec: 'core', tier: 0, max: 3, name: 'Arcane Focus', desc: '+8% spell damage per rank.' },
      { id: 'inferno', spec: 'core', tier: 0, max: 3, name: 'Inferno', desc: 'Firebolt burns longer and explodes wider.' },
      { id: 'phase_cloak', spec: 'core', tier: 1, max: 2, name: 'Phase Cloak', desc: 'Blink grants stealth.' },
      { id: 'mana_flow', spec: 'core', tier: 1, max: 3, name: 'Mana Flow', desc: '-6% cooldowns per rank.' },
      { id: 'arc_jumps', spec: 'a', tier: 1, max: 3, name: 'Arc Jumps', desc: 'Chain Lightning jumps 2 more times per rank.' },
      { id: 'static', spec: 'a', tier: 2, max: 3, name: 'Static Charge', desc: 'Each jump deals +10% more and slows.' },
      { id: 'conductor', spec: 'a', tier: 2, max: 2, name: 'Conductor', desc: 'Basic bolts chain to 1 extra enemy per rank.' },
      { id: 'meteor_swarm', spec: 'a', tier: 3, max: 1, name: 'Meteor Swarm', desc: 'Meteor calls down three meteors.' },
      { id: 'eye_of_storm', spec: 'a', tier: 4, max: 1, name: 'Eye of the Storm', keystone: true, desc: 'KEYSTONE — Chain Lightning jumps up to 12 times, but stops the moment it misses.' },
      { id: 'chaos_bloom', spec: 'b', tier: 1, max: 3, name: 'Chaos Bloom', desc: 'Wild Surge rolls +2 per rank.' },
      { id: 'tamed_chaos', spec: 'b', tier: 2, max: 2, name: 'Tamed Chaos', desc: 'Rank 2: surges can no longer backfire.' },
      { id: 'lucky_star', spec: 'b', tier: 2, max: 2, name: 'Lucky Star', desc: 'Start fights with 1 extra Fate Die per rank.' },
      { id: 'entropy', spec: 'b', tier: 3, max: 3, name: 'Entropy', desc: 'Glancing blows deal full damage (33% per rank).' },
      { id: 'probability_engine', spec: 'b', tier: 4, max: 1, name: 'Probability Engine', keystone: true, desc: 'KEYSTONE — Sacrificed Fate Dice are rerolled back into your hand.' },
    ],
    specs: { a: 'Stormcaller', b: 'Chaos Weaver' },
    resonance: { neon: { firebolt: 'Hot-Shot Blast', chain: 'Arc Reactor', blink: 'Speedster Flicker', meteor: 'Orbital Drop' }, asterion: { firebolt: 'Plasma Lance', chain: 'Ion Cascade', blink: 'Phase Jump', meteor: 'Decaying Orbit' } },
    resonanceBonus: 'emberwood',
  },

  // ───────────────────────────────── ARTIFICER ───────────────────────────────
  artificer: {
    name: 'Artificer', role: 'Gadgeteer', color: '#e0a030',
    blurb: 'Builds the fight around them: turrets, grenades and a repair bot. Kills drop Scrap; 3 Scrap instantly recharges your turret.',
    stats: { hp: 95, hpPer: 13, ac: 14, speed: 6.2, atk: 4 },
    skill: { tech: 5, arcana: 3, insight: 1 },
    model: { weapon: 'wrench', hat: 'goggles', extras: ['backpack', 'apron'], colors: { body: 0x3a6a8a, legs: 0x5a4a3a, accent: 0xd0a040, hair: 0xd06a20 } },
    passive: { name: 'Scrap', desc: 'Enemies you defeat drop Scrap. At 3 Scrap, Deploy Turret recharges instantly.' },
    basic: { name: 'Rivet Gun', cd: 0.3, range: 20, cast(c, T) {
      faceAim(c, T); c.model.play('shoot', 0.2); Audio.play('laser');
      bolt(c, T, { color: 0xffd060, size: 0.16, speed: 36, onHit: (e) => strike(c, e, '1d6+1', T, { type: 'tech', word: 'tech' }) });
      return true; } },
    abilities: [
      { id: 'turret', key: 'Q', lvl: 1, name: 'Deploy Turret', cd: 12, tags: ['turret'], desc: 'Build an auto-turret that fires for 14s.', cast(c, T) {
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
      { id: 'grenade', key: 'E', lvl: 2, name: 'Arc Grenade', cd: 7, tags: ['grenade'], desc: 'Lob a grenade that explodes and shocks enemies.', cast(c, T) {
        faceAim(c, T); c.model.play('attack', 0.3);
        const p = aimPoint(c, T, 18); const from = c.center().add(V(0, 0.5, 0));
        const dist = Math.max(3, from.distanceTo(p)); const dir = p.clone().sub(from); dir.y = 0; dir.normalize();
        const spd = Math.sqrt(dist * 22) ; const v = dir.multiplyScalar(spd * 0.72); v.y = spd * 0.72;
        const boom = (q) => {
          Audio.play('explode'); shake(0.35); burst(q, [0x80e0ff, 0xffffff, 0x3060ff], 36, 9, 0.7, 0.25); ring(q, 4, 0x80e0ff);
          for (const e of enemiesNear(q, 3.8 + c.t('bigger_boom') * 0.8, c.team)) { strike(c, e, '2d8+3', T, { type: 'lightning', knock: 9 }); e.addStatus('stun', 0.6); }
          if (c.t('demolition')) debris(G.world.explode(q.x, q.y, q.z, 2, G.realm?.protect));
          markTag('grenade', q, c);
          if (c.gearFlag('grenade_cluster') && !q.cluster) for (let i = 0; i < 3; i++) { const qq = q.clone().add(V((Math.random() - .5) * 6, 0, (Math.random() - .5) * 6)); qq.cluster = true; setTimeout(() => boom(qq), 250 + i * 150); }
        };
        spawnProjectile({ from, dir: v, speed: v.length(), gravity: 22, color: 0x60c0ff, size: 0.3, owner: c, life: 3, onHit: (e, q) => boom(q), onWorld: (q) => boom(q), onExpire: boom });
        return true; } },
      { id: 'bot', key: 'RMB', lvl: 4, name: 'Repair Bot', cd: 16, tags: ['bot'], desc: 'A hovering bot heals allies near you for 12s.', cast(c, T) {
        Audio.play('build');
        new Minion('bot', c, c.pos.clone().add(V(0, 1.5, 0)), { life: 12 + c.t('long_battery') * 4, heal: 4 * (1 + c.t('field_medic') * 0.25), shield: !!c.t('nanite_cloud') });
        markTag('bot', c.pos, c); return true; } },
      { id: 'overclock', key: 'R', lvl: 6, name: 'Overclock', cd: 35, tags: ['overclock'], desc: 'The party gains haste for 6s, your gadgets upgrade, and cooldowns drop by 50%.', cast(c, T) {
        Audio.play('levelup'); ring(c.pos, 12, 0xffd060, 0.6);
        for (const h of G.party) { if (h.downed) continue; h.addStatus('haste', 6); for (const k in h.cds) h.cds[k] *= 0.5; burst(h.center(), 0xffd060, 12, 4); }
        for (const e of G.entities) if (e.isMinion && e.owner === c) { e.life += 6; if (e.kind === 'turret') e.tesla = true; }
        markTag('overclock', c.pos, c); return true; } },
    ],
    onKill(c) { c.scrap = (c.scrap || 0) + 1; if (c.scrap >= 3) { c.scrap = 0; c.cds.turret = 0; popText(c.head(), 'SCRAP! Turret ready', 'info', { color: '#ffd060' }); } },
    talents: [
      { id: 'sturdy_build', spec: 'core', tier: 0, max: 3, name: 'Sturdy Build', desc: 'Turrets last 4s longer per rank.' },
      { id: 'bigger_boom', spec: 'core', tier: 0, max: 3, name: 'Bigger Boom', desc: 'Grenade radius increased.' },
      { id: 'long_battery', spec: 'core', tier: 1, max: 2, name: 'Long Battery', desc: 'Repair Bot lasts 4s longer per rank.' },
      { id: 'tinkerer', spec: 'core', tier: 1, max: 3, name: 'Tinkerer', desc: '+5% max HP and +1 AC per rank.' },
      { id: 'calibrated', spec: 'a', tier: 1, max: 3, name: 'Calibrated Optics', desc: 'Turret damage +20% per rank.' },
      { id: 'twin_turrets', spec: 'a', tier: 2, max: 1, name: 'Twin Turrets', desc: 'Deploy two turrets at once.' },
      { id: 'demolition', spec: 'a', tier: 2, max: 1, name: 'Demolition', desc: 'Grenades destroy terrain.' },
      { id: 'scrapper', spec: 'a', tier: 3, max: 3, name: 'Scrapper', desc: 'Rivet Gun damage +15% per rank.' },
      { id: 'siege_mode', spec: 'a', tier: 4, max: 1, name: 'Siege Mode', keystone: true, desc: 'KEYSTONE — Turrets become mortars that fire explosive arcing shells.' },
      { id: 'field_medic', spec: 'b', tier: 1, max: 3, name: 'Field Medic', desc: 'Repair Bot heals +25% per rank.' },
      { id: 'reinforced', spec: 'b', tier: 2, max: 3, name: 'Reinforced Plating', desc: 'Allies near your bot take 5% less damage per rank.' },
      { id: 'quick_fix', spec: 'b', tier: 2, max: 2, name: 'Quick Fix', desc: 'Repair Bot cooldown -3s per rank.' },
      { id: 'jury_rig', spec: 'b', tier: 3, max: 1, name: 'Jury Rig', desc: 'Revive downed allies twice as fast.' },
      { id: 'nanite_cloud', spec: 'b', tier: 4, max: 1, name: 'Nanite Cloud', keystone: true, desc: 'KEYSTONE — Your Repair Bot also shields every ally it heals.' },
    ],
    specs: { a: 'Gunsmith', b: 'Field Engineer' },
    resonance: { emberwood: { turret: 'Clockwork Ballista', grenade: 'Alchemist Flask', bot: 'Brass Homunculus', overclock: 'Runic Overdrive' }, neon: { turret: 'Sentry Gun', grenade: 'EMP Charge', bot: 'Medi-Drone', overclock: 'Suit Overload' } },
    resonanceBonus: 'asterion',
  },

  // ───────────────────────────────── CLERIC ──────────────────────────────────
  cleric: {
    name: 'Cleric', role: 'Battle healer', color: '#f0d060',
    blurb: 'Keeps everyone standing, then hits things with a mace. Faith builds as you heal; at full Faith your next heal also smites nearby enemies.',
    stats: { hp: 105, hpPer: 15, ac: 15, speed: 6.0, atk: 4 },
    skill: { insight: 5, persuasion: 4, arcana: 2 },
    model: { weapon: 'mace', hat: 'halo', extras: ['robe', 'emblem'], colors: { body: 0xf0e8d0, legs: 0xc0b090, accent: 0xe0b040, hair: 0x8a5a30, emblem: 0xe0b040 } },
    passive: { name: 'Faith', desc: 'Healing builds Faith. At 100 Faith, your next heal also blasts enemies with holy light.' },
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
      { id: 'smite', key: 'RMB', lvl: 4, name: 'Guiding Bolt', cd: 6, tags: ['holy'], desc: 'A radiant bolt that marks the target: attacks on it crit on 16+.', cast(c, T) {
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
    model: { weapon: 'daggers', hat: 'hood', extras: ['cape'], colors: { body: 0x2a4a3a, legs: 0x1a2a22, accent: 0x40c080, hat: 0x1a3a2a, cape: 0x122a1e } },
    passive: { name: 'Sneak Attack', desc: 'Attacks from stealth or from behind crit on a roll of 15+.' },
    basic: { name: 'Twin Daggers', cd: 0.3, range: 2.2, cast(c, T) {
      faceAim(c, T); lunge(c, 2.5); c.model.play(Math.random() < 0.5 ? 'attack' : 'thrust', 0.2); Audio.play('swing');
      meleeHits(c, 2.2, 100, (e) => { const behind = e.forward().dot(c.forward()) > 0.3; strike(c, e, '1d6+2', { ...T, fromBehind: behind }, { type: 'slash', word: 'shadow' }); });
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
        strike(c, t, '3d6+4', { ...T, autoCrit: true, fromBehind: true }, { type: 'slash', word: 'shadow', heavy: true, mult: low ? 1.5 : 1 });
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
      { id: 'knives', key: 'RMB', lvl: 4, name: 'Fan of Knives', cd: 7, tags: ['knives'], desc: 'Throw a fan of 7 knives that make enemies bleed.', cast(c, T) {
        faceAim(c, T); c.model.play('spin', 0.3); Audio.play('arrow');
        const base = aimDir(c, T); base.y = Math.max(-0.2, Math.min(0.2, base.y));
        const n = 7 + c.t('more_knives') * 2;
        for (let i = 0; i < n; i++) {
          const a = (i - (n - 1) / 2) * 0.13; const d = base.clone().applyAxisAngle(V(0, 1, 0), a);
          spawnProjectile({ from: c.center(), dir: d, speed: 28, color: 0xd0d8e0, size: 0.14, owner: c, life: 0.8, onHit: (e) => {
            strike(c, e, '1d8+2', T, { type: 'slash', quiet: true });
            e.addStatus('bleed', 4, { every: 0.5, onTick: (x) => dealDamage(c, x, 1.5 * c.pow * (1 + c.t('hemorrhage') * 0.33), { quiet: true, roll: { hit: true } }) }); markTag('knives', e.pos, c); } });
        }
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
      { id: 'more_knives', spec: 'core', tier: 0, max: 3, name: 'More Knives', desc: 'Fan of Knives throws 2 more per rank.' },
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
    model: { weapon: 'bow', hat: 'hood', extras: ['quiver', 'cape'], colors: { body: 0x4a6a2a, legs: 0x5a4020, accent: 0x8a6a3a, hat: 0x3a5a22, cape: 0x2a4018 } },
    passive: { name: "Hunter's Focus", desc: 'Each consecutive hit on the same target adds +6% damage (up to 5 stacks).' },
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
      { id: 'pounce', key: 'RMB', lvl: 1, name: 'Command: Pounce', cd: 6, tags: ['beast'], desc: 'Your wolf leaps on the target, dealing heavy damage and stunning it.', cast(c, T) {
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
