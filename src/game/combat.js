// Combat rules: d20 attack rolls, Fate Dice, damage, the Style meter, Team-Ups and the Initiative Break meter.
import * as THREE from 'three';
import { G, activeHero } from '../core/state.js';
import { emit } from '../core/events.js';
import { Audio } from '../core/audio.js';
import { burst, popText, shake, hitstop, ring, beam, zone, debris, telegraph } from './effects.js';

export const d20 = () => 1 + Math.floor(Math.random() * 20);
export function rollDice(spec) { // "2d6+3"
  const m = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(spec); if (!m) return +spec || 0;
  let s = +(m[3] || 0); for (let i = 0; i < +m[1]; i++) s += 1 + Math.floor(Math.random() * +m[2]); return s;
}

// ── combat session (dice hand / style / break meter) ─────────────────────────
export const STYLE_RANKS = [
  { id: 'D', min: 0, label: 'Dull', color: '#9a9aa8' },
  { id: 'C', min: 60, label: 'Cool', color: '#6ad0ff' },
  { id: 'B', min: 140, label: 'Bold', color: '#7cff6a' },
  { id: 'A', min: 240, label: 'Awesome', color: '#ffd23a' },
  { id: 'S', min: 360, label: 'Spectacular', color: '#ff7a2a' },
  { id: 'L', min: 500, label: 'LEGENDARY', color: '#ff3a8a' },
];
export function styleRank(v) { let r = STYLE_RANKS[0]; for (const s of STYLE_RANKS) if (v >= s.min) r = s; return r; }

export function newCombatState() {
  return { active: false, idle: 0, dice: [], sel: 0, armed: null, meter: 0, style: 0, styleIdx: 0, styleDecayWait: 0, recent: [], best: 0, kills: 0, teamupsThisFight: [] };
}
export function diceHandSize() {
  let n = 5 + (G.realm?.state?.extraDice || 0) + (G.save?.buff?.id === 'pie' ? 2 : 0); for (const h of G.party) n += (h.gearStat?.('dice') || 0) + (h.t ? h.t('lucky_star') + h.t('lucky') : 0); return Math.min(9, n);
}
export function startCombat() {
  const C = G.combat; if (C.active) { C.idle = 0; return; }
  C.active = true; C.idle = 0; C.style = 0; C.secondChanceUsed = false; C.best = 0; C.kills = 0; C.teamupsThisFight = []; C.recent = [];
  const loaded = G.party.some((h) => h.t?.('loaded_dice'));
  C.dice = []; for (let i = 0; i < diceHandSize(); i++) C.dice.push(loaded ? Math.max(5, d20()) : d20());
  C.sel = 0; C.armed = null;
  Audio.play('dice'); emit('combatStart');
}
export function endCombat() {
  const C = G.combat; if (!C.active) return;
  C.active = false; C.armed = null;
  emit('combatEnd', { best: C.best, kills: C.kills });
  C.dice = [];
}
export function addStyle(v, why) {
  const C = G.combat; if (!C.active) return;
  C.style = Math.max(0, Math.min(620, C.style + v)); C.styleDecayWait = v > 0 ? 2.5 : 0;
  C.best = Math.max(C.best, C.style);
  const r = styleRank(C.style); const idx = STYLE_RANKS.indexOf(r);
  if (idx > C.styleIdx) emit('styleUp', r);
  C.styleIdx = idx;
}
export function addMeter(v) { G.combat.meter = Math.max(0, Math.min(100, G.combat.meter + v)); }
export function noteAbility(caster, id) {
  if (caster.team !== 'party' || caster.isMinion) return;
  const C = G.combat; const key = caster.classId + ':' + id;
  addStyle(C.recent.includes(key) ? 4 : 16, 'variety');
  C.recent.push(key); if (C.recent.length > 3) C.recent.shift();
}
export function updateCombat(dt) {
  const C = G.combat;
  if (!C.active) return;
  if (C.styleDecayWait > 0) C.styleDecayWait -= dt; else C.style = Math.max(0, C.style - dt * (10 + C.style * 0.04));
  C.styleIdx = STYLE_RANKS.indexOf(styleRank(C.style));
  const hostile = G.entities.some((e) => e.team === 'enemy' && !e.dead && e.aggro);
  C.idle = hostile ? 0 : C.idle + dt;
  if (C.idle > 3) endCombat();
}
// Fate dice controls
export function armSelectedDie() {
  const C = G.combat; if (!C.dice.length) return;
  C.armed = C.armed === C.sel ? null : C.sel; Audio.play('diceLand');
}
export function sacrificeSelectedDie() {
  const C = G.combat; if (!C.dice.length) return;
  const v = C.dice[C.sel];
  const gain = Math.round((21 - v) * 1.6);
  addMeter(gain);
  const h = activeHero(); if (h) popText(h.head(), `+${gain}% BREAK`, 'info', { color: '#ffd23a' });
  if (G.party.some((p) => p.t?.('probability_engine'))) C.dice[C.sel] = d20(); else C.dice.splice(C.sel, 1);
  for (const p of G.party) if (p.t && p.t('gambit')) p.addStatus('gambit', 5, { mult: 1 + 0.1 * p.t('gambit') });
  if (C.armed === C.sel) C.armed = null; else if (C.armed !== null && C.armed > C.sel) C.armed--;
  C.sel = Math.min(C.sel, Math.max(0, C.dice.length - 1));
  Audio.play('dice');
}

// ── queries ──────────────────────────────────────────────────────────────────
export const hostile = (a, b) => a.team !== b.team && a.team !== 'npc' && b.team !== 'npc';
export function enemiesOf(team) { return G.entities.filter((e) => !e.dead && !e.downed && e.team !== team && e.team !== 'npc' && !e.untargetable); }
export function enemiesNear(pos, r, team) { return enemiesOf(team).filter((e) => e.pos.distanceTo(pos) <= r + e.radius); }
export function alliesNear(pos, r, team, includeDowned = false) { return G.entities.filter((e) => !e.dead && (includeDowned || !e.downed) && e.team === team && !e.isMinion && e.pos.distanceTo(pos) <= r); }
export function nearestEnemy(from, team, range = 30, pred = null) {
  let best = null, bd = range;
  for (const e of enemiesOf(team)) { if (pred && !pred(e)) continue; const dd = e.pos.distanceTo(from.pos || from); if (dd < bd) { bd = dd; best = e; } }
  return best;
}
export function inArc(src, tgt, range, arcDeg) {
  const to = tgt.pos.clone().sub(src.pos); to.y = 0; const dist = to.length();
  if (dist > range + tgt.radius) return false; if (dist < 0.6) return true;
  const ang = to.normalize().angleTo(src.forward()); return ang <= (arcDeg / 2) * Math.PI / 180;
}

// ── attack roll ──────────────────────────────────────────────────────────────
// T.useFate: allow the armed Fate Die; T.forced: Initiative Break (advantage, min 10)
export function attackRoll(att, tgt, T = {}) {
  let roll, fate = false;
  const C = G.combat;
  if (att.team === 'party' && !att.isMinion && T.useFate !== false && C.armed !== null && C.dice[C.armed] !== undefined && att === activeHero()) {
    roll = C.dice[C.armed]; if (roll === 1 && G.party.some((h) => h.gearFlag?.('snake_eyes'))) roll = 20; C.dice.splice(C.armed, 1); C.sel = Math.min(C.sel, Math.max(0, C.dice.length - 1)); C.armed = null; fate = true;
    popText(att.head(), `FATE ${roll}`, 'fate');
  } else if (T.preRoll) roll = T.preRoll;
  else roll = d20();
  if (T.forced) roll = Math.max(roll, d20(), 10);
  if (att.has('bless')) roll = Math.min(20, roll + 2);
  let critMin = 20 - (att.gearStat?.('crit') || 0);
  if (att.t && att.t('deadeye') && roll >= 18) critMin = 18;
  if (att.team === 'party' && (att.has('stealth') || T.fromBehind) && att.classId === 'rogue') critMin = Math.min(critMin, 15);
  if (tgt.has('marked_crit')) critMin = Math.min(critMin, 16);
  if (T.autoCrit) roll = Math.max(roll, critMin);
  const nat = roll;
  const total = roll + att.atk + (T.bonus || 0);
  let ac = tgt.ac + (tgt.acAura || 0); if (tgt.has('sanctuary')) ac += 2; if (tgt.has('shieldwall')) ac += 4; if (tgt.has('exposed')) ac -= 4;
  const crit = nat >= critMin && !tgt.critImmune;
  const fumble = nat === 1 && !T.forced;
  const hit = crit || (!fumble && total >= ac);
  return { roll: nat, total, hit, crit, fumble, glance: !hit && !fumble, fate };
}

// strike = roll + damage in one call. base is a number or dice string.
export function strike(att, tgt, base, T = {}, opts = {}) {
  if (!tgt || tgt.dead) return null;
  const r = T.roll || attackRoll(att, tgt, T);
  let amt = typeof base === 'string' ? rollDice(base) : base;
  amt *= att.pow * (opts.mult || 1) * (att.dmgMult ? att.dmgMult(tgt, opts) : 1);
  if (att.team === 'party' && tgt.isNemesis) amt *= 1 + (att.gearStat?.('nemesis') || 0) / 100;
  if (r.crit) amt *= 2 + (att.gearStat?.('critdmg') || 0) / 100 + (att.t ? att.t('assassinate') * 0.25 : 0);
  else if (r.fumble) amt = 0;
  else if (r.glance) amt *= (opts.glance ?? 0.35) + (att.t ? att.t('entropy') * 0.22 : 0);
  dealDamage(att, tgt, amt, { ...opts, roll: r });
  if (r.fumble && att.team === 'party' && !opts.quiet) { popText(att.head(), 'NAT 1!', 'fumble'); Audio.play('fumble'); att.addStatus('stun', 0.35); addStyle(-10); }
  return r;
}

const WORDS = {
  slash: ['SHNK!', 'SLASH!', 'SHING!', 'KSSH!'], blunt: ['BONK!', 'THWACK!', 'KRAK!', 'WHAM!'], fire: ['FWOOSH!', 'KA-BLAM!', 'SIZZLE!'],
  lightning: ['KZZT!', 'ZAKKT!', 'BZZRT!'], holy: ['SHWING!', 'HALLELU-BONK!', 'RADIANT!'], pierce: ['THUNK!', 'THWIP!', 'PFFT!'],
  tech: ['KLANG!', 'BZZAP!', 'CLUNK!'], shadow: ['SHHK!', 'SNIKT!', 'FSST!'], blast: ['BOOM!', 'KA-THOOM!', 'KRAKOOM!'], bite: ['CHOMP!', 'GNASH!', 'RRRIP!'],
};

export function dealDamage(src, tgt, amt, opts = {}) {
  if (tgt.dead || tgt.downed || tgt.invuln || tgt.has('invuln')) return 0;
  const r = opts.roll || { hit: true };
  if (tgt.has('dodge') && !opts.unavoidable) { popText(tgt.head(), 'DODGE', 'miss'); return 0; }
  // enemy attacks against the party: shown as BLOCKED on a miss
  if (tgt.team === 'party' && r.glance && src && src.team === 'enemy' && !opts.unavoidable) {
    popText(tgt.head(), 'BLOCKED', 'miss'); Audio.play('block'); tgt.onBlock?.(src); return 0;
  }
  let mult = 1;
  if (tgt.has('sanctuary')) mult *= 0.6;
  if (tgt.has('battlecry')) mult *= 0.7;
  if (tgt.has('oath')) mult = 0;
  if (tgt.resist && opts.type && tgt.resist[opts.type] != null) { mult *= tgt.resist[opts.type]; tgt.onResist?.(opts.type); }
  if (opts.type) tgt._lastType = opts.type;
  if (tgt.frontalCheck && src) mult *= tgt.frontalCheck(src);
  if (r.crit && tgt.trait && tgt.trait('glass_jaw')) { mult *= 1.5; tgt.reveal('glass_jaw'); }
  if (tgt.team === 'party') mult *= 1 - Math.min(0.5, (tgt.gearStat?.('armor') || 0) / 100);
  if (tgt.has('vulnerable')) mult *= 1.25;
  if (G.realm?.state?.glass) mult *= 1.5;
  if (G.realm?.state?.vamp && src && !src.dead && amt > 0 && !opts.reflected) src.hp = Math.min(src.maxHp, src.hp + amt * G.realm.state.vamp);
  if (tgt.has('reinforced')) mult *= tgt.status('reinforced').mult;
  if (tgt.has('avatar')) mult *= 0.6;
  if (tgt.gearFlag && tgt.gearFlag('grit_armor') && (tgt.grit || 0) >= 100) mult *= 0.7;
  if (src && tgt.has('battlecry') && tgt.t && tgt.t('immovable') && !opts.reflected && src.team !== tgt.team) dealDamage(tgt, src, amt * 0.3, { roll: { hit: true }, reflected: true, quiet: true });
  if (tgt.has('deathmark')) tgt.status('deathmark').stored += amt;
  amt = Math.max(0, Math.round(amt * mult));
  const shield = tgt.status('shield');
  if (shield && amt > 0) { const ab = Math.min(shield.amount, amt); shield.amount -= ab; amt -= ab; if (shield.amount <= 0) tgt.removeStatus('shield'); if (ab) popText(tgt.head(), `-${ab} shield`, 'info', { color: '#8ad8ff' }); }
  tgt.hp -= amt;
  tgt.lastHitBy = src;
  if (src) tgt.threat.set(src, (tgt.threat.get(src) || 0) + amt + (opts.threat || 0));
  // feedback
  const c = tgt.center();
  const style = r.crit ? 'crit' : r.glance ? 'glance' : 'dmg';
  popText(c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4, 0)), r.crit ? `${amt}!` : String(amt), tgt.team === 'party' ? 'hurt' : style);
  if (r.crit) {
    popText(c.clone().add(new THREE.Vector3(0, 1.1, 0)), r.roll === 20 ? 'NAT 20!' : 'CRIT!', 'crit-banner');
    Audio.play('crit'); shake(0.35); hitstop(0.09); G.post && (G.post.flash = 0.35);
    if (src && src.team === 'party') emit('critFx');
    emit('crit', { src, tgt, roll: r.roll });
  } else if (amt > 0) { Audio.play(opts.heavy ? 'bigHit' : 'hit'); shake(opts.heavy ? 0.2 : 0.06); if (opts.heavy) hitstop(0.05); }
  if (!opts.quiet && amt > 0 && (r.crit || opts.heavy || Math.random() < 0.35)) {
    const w = WORDS[opts.word || opts.type] || WORDS.blunt;
    popText(c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 0.8, 0)), w[Math.floor(Math.random() * w.length)], 'sfx', { color: opts.sfxColor });
  }
  if (r.glance && amt > 0) popText(c.clone().add(new THREE.Vector3(0, 0.9, 0)), 'glance', 'miss');
  tgt.model?.flash(tgt.team === 'party' ? 0xff2020 : 0xffffff, 0.1);
  burst(c, opts.color || (tgt.bloodColor ?? 0xffffff), Math.min(14, 4 + amt / 4), 5, 0.4, 0.14);
  if (opts.knock && src) {
    const dir = tgt.pos.clone().sub(src.pos); dir.y = 0; dir.normalize();
    const kr = tgt.knockResist ?? 0; const k = opts.knock * (1 - kr);
    tgt.knock.add(dir.multiplyScalar(k)); tgt.knock.y += k * 0.35;
  }
  // meters and style
  if (src && src.team === 'party' && amt > 0) { addMeter(r.crit ? 5 : 1.6); addStyle(r.crit ? 20 : 2); startCombat(); }
  if (tgt.team === 'party' && amt > 0) { addMeter(2.5); if (!tgt.isMinion) addStyle(-22); startCombat(); Audio.play('hurt'); tgt.onHurt?.(amt, src); }
  if (tgt.team === 'enemy' && src) { tgt.aggro = true; tgt.onHurt?.(amt, src); }
  if (src && src.lifesteal && amt > 0) heal(src, src, amt * src.lifesteal, true);
  if (src && src.team === 'party' && src.gearStat && amt > 0) { const ls = src.gearStat('lifesteal'); if (ls) heal(src, src, amt * ls / 100, true); }
  if (src && src.onDealDamage && amt > 0) src.onDealDamage(tgt, amt, opts, r);
  if (src && src.isMinion && src.kind === 'wolf' && src.owner.t && src.owner.t('bonded') && amt > 0) heal(src.owner, src.owner, amt * 0.15 * src.owner.t('bonded'), true);
  emit('damage', { src, tgt, amt, crit: !!r.crit, type: opts.type });
  if (tgt.hp <= 0) kill(tgt, src, opts);
  return amt;
}

export function kill(tgt, src, opts = {}) {
  if (tgt.dead || tgt.downed) return;
  if (tgt.team === 'party' && !tgt.isMinion) {
    const saver = G.party.find((h) => h.t && h.t('second_chance') && !h.downed && !G.combat.secondChanceUsed);
    if (saver) { G.combat.secondChanceUsed = true; tgt.hp = 1; tgt.addStatus('invuln', 1.5); popText(tgt.head(), 'SECOND CHANCE!', 'heal'); return; }
    tgt.hp = 0; tgt.downed = true; tgt.downT = 0; tgt.statuses.clear();
    popText(tgt.head(), 'DOWN!', 'crit-banner', { color: '#ff4a4a' }); Audio.play('down');
    emit('heroDown', { hero: tgt, by: src });
    return;
  }
  if (tgt.onDeath && tgt.onDeath(src) === false) return; // e.g. boss phase / cheat death
  tgt.hp = 0;
  burst(tgt.center(), [tgt.bloodColor ?? 0xffffff, 0x222222, 0xffd23a], 26, 8, 0.9, 0.24);
  tgt.remove();
  if (tgt.team === 'enemy' && G.realm?.state?.volatile && !tgt.isBoss) {
    const p = tgt.pos.clone();
    telegraph(p, 2.6, 0.9, 0xff8a2a, (q) => { burst(q, [0xff8a2a, 0xffd23a], 24, 7); Audio.play('explode'); for (const e of G.entities) if (e.team === 'party' && !e.dead && e.pos.distanceTo(q) < 2.8) dealDamage(null, e, e.maxHp * 0.12, { roll: { hit: true }, unavoidable: true, type: 'blast' }); });
  }
  if (tgt.team === 'enemy') {
    G.combat.kills++; addStyle(12); addMeter(4);
    emit('enemyKilled', { enemy: tgt, by: src });
  }
}

export function heal(src, tgt, amt, quiet = false) {
  if (tgt.dead || tgt.downed) return 0;
  amt *= 1 + (src?.gearStat?.('healing') || 0) / 100;
  if (src && src.t) amt *= 1 + src.t('lifegiver') * 0.15;
  const before = tgt.hp; tgt.hp = Math.min(tgt.maxHp, tgt.hp + amt);
  const got = Math.round(tgt.hp - before);
  if (got > 0 && !quiet) { popText(tgt.head(), `+${got}`, 'heal'); burst(tgt.center(), 0x7aff8a, 8, 3, 0.6, 0.14, 3); }
  if (got > 0 && src && src.team === 'party' && src !== tgt) { addStyle(4); }
  if (got > 0 && src && src.classId === 'cleric') src.faith = Math.min(100, (src.faith || 0) + got * 0.5 * (1 + src.t('devotion') * 0.25));
  if (got > 0 && src && src.t && src.t('aegis') && !quiet) tgt.addStatus('shield', 5, { amount: got * 0.15 * src.t('aegis') });
  return got;
}
export function revive(tgt, frac = 0.4) {
  if (!tgt.downed) return;
  tgt.downed = false; tgt.hp = Math.max(1, Math.round(tgt.maxHp * frac)); tgt.addStatus('invuln', 1.5);
  popText(tgt.head(), 'BACK UP!', 'heal'); Audio.play('heal'); burst(tgt.center(), 0xfff080, 20, 4, 0.8, 0.2, 2);
}

// ── Team-Ups: two tagged abilities near each other in time/space combine ────
export const TEAMUPS = [
  { id: 'tesla', name: 'Tesla Tower', a: 'turret', b: 'lightning', desc: 'Artificer turret + lightning: the turret becomes a chain-lightning pylon.' },
  { id: 'thermite', name: 'Thermite Blast', a: 'grenade', b: 'fire', desc: 'Grenade + fire: a block-shattering firestorm.' },
  { id: 'unseen', name: 'Unseen Barrage', a: 'smoke', b: 'volley', desc: 'Smoke + volley: every arrow crits from the dark.' },
  { id: 'oath', name: 'Unbreakable Oath', a: 'taunt', b: 'sanctuary', desc: 'Battle Cry inside Sanctuary: the party is immune for 3 seconds.' },
  { id: 'judgement', name: 'Judgement Sweep', a: 'cleave', b: 'holy', desc: 'Cleave a smitten foe: radiant shockwave.' },
  { id: 'trapped', name: 'Trapped Prey', a: 'snare', b: 'shadow', desc: 'Shadow strike on a snared foe: instant execute below 40%.' },
  { id: 'flaming', name: 'Flaming Arrows', a: 'volley', b: 'fire', desc: 'Fire meets volley: burning rain.' },
  { id: 'pack', name: 'Pack Tactics', a: 'beast', b: 'shield', desc: 'Beast pounce + shield charge: double stun and bonus damage.' },
  { id: 'nanite', name: 'Nanite Grace', a: 'bot', b: 'heal', desc: 'Repair bot + healing: party-wide regeneration.' },
  { id: 'storm', name: 'Stormcaller', a: 'lightning', b: 'volley', desc: 'Lightning through the arrows: every arrow chains.' },
  { id: 'shrapnel', name: 'Shrapnel Fan', a: 'knives', b: 'grenade', desc: 'Knives + grenade: a cloud of shrapnel.' },
  { id: 'blinkstrike', name: 'Twin Shadows', a: 'blink', b: 'shadow', desc: 'Blink + shadowstep: both warp and strike twice.' },
  { id: 'overcharge', name: 'Overcharged Faith', a: 'overclock', b: 'holy', desc: 'Overclock + holy power: cooldowns reset for everyone.' },
  { id: 'wildfire', name: 'Wild Hunt', a: 'beast', b: 'fire', desc: 'The beast catches fire and runs through the enemy.' },
];
const recentTags = []; // {tag, pos, time, by}
export function markTag(tag, pos, by) {
  if (!by || by.team !== 'party') return;
  const now = G.time;
  for (let i = recentTags.length - 1; i >= 0; i--) if (now - recentTags[i].time > 6) recentTags.splice(i, 1);
  for (const r of recentTags) {
    if (r.by === by && !by.isMinion) continue;
    if (r.pos.distanceTo(pos) > 12) continue;
    const tu = TEAMUPS.find((t) => (t.a === tag && t.b === r.tag) || (t.b === tag && t.a === r.tag));
    if (tu && (!r.used)) { r.used = true; triggerTeamUp(tu, pos.clone().lerp(r.pos, 0.5), by, r.by); return; }
  }
  recentTags.push({ tag, pos: pos.clone(), time: now, by });
}
export function triggerTeamUp(tu, pos, a, b) {
  const S = G.save;
  const first = S && !S.teamups.includes(tu.id);
  if (first) S.teamups.push(tu.id);
  Audio.play('teamup'); shake(0.6); G.post && (G.post.flash = 0.5);
  addStyle(60); addMeter(15);
  G.combat.teamupsThisFight.push(tu.id);
  emit('teamup', { tu, first, a, b });
  const lvlPow = Math.max(a?.pow || 1, b?.pow || 1);
  const foes = enemiesNear(pos, 9, 'party');
  const src = a || b;
  ring(pos, 9, 0xffd23a, 0.6);
  switch (tu.id) {
    case 'tesla': case 'storm':
      for (const e of foes.slice(0, 8)) { beam(pos.clone().add(new THREE.Vector3(0, 2, 0)), e.center(), 0xaef4ff, 0.18, 0.25, 1.2); dealDamage(src, e, 18 * lvlPow, { type: 'lightning', roll: { hit: true } }); e.addStatus('stun', 1); }
      break;
    case 'thermite': case 'flaming': case 'wildfire': {
      const blocks = G.world.explode(pos.x, pos.y + 1, pos.z, 3.2, G.realm?.protect || (() => false));
      debris(blocks);
      burst(pos, [0xff5a1a, 0xffd23a, 0x331100], 36, 11, 1.0, 0.28);
      for (const e of foes) { dealDamage(src, e, 26 * lvlPow, { type: 'fire', roll: { hit: true }, knock: 12, heavy: true }); e.addStatus('burn', 4, { every: 0.5, onTick: (x) => dealDamage(src, x, 3 * lvlPow, { type: 'fire', quiet: true, roll: { hit: true } }) }); }
      break; }
    case 'unseen': for (const h of G.party) h.addStatus('stealth', 4); for (const e of foes) dealDamage(src, e, 22 * lvlPow, { type: 'pierce', roll: { hit: true, crit: true, roll: 20 } }); break;
    case 'oath': for (const h of G.party) h.addStatus('oath', 3); burst(pos, 0xfff080, 40, 6, 1, 0.3, 2); break;
    case 'judgement': case 'overcharge':
      for (const e of foes) dealDamage(src, e, 24 * lvlPow, { type: 'holy', roll: { hit: true }, knock: 10 });
      if (tu.id === 'overcharge') for (const h of G.party) { for (const k in h.cds) h.cds[k] = 0; popText(h.head(), 'RESET!', 'info'); }
      break;
    case 'trapped': for (const e of foes) { if (e.hp / e.maxHp < 0.4 && !e.isBoss) dealDamage(src, e, e.hp + 1, { type: 'shadow', roll: { hit: true, crit: true, roll: 20 }, word: 'shadow' }); else dealDamage(src, e, 20 * lvlPow, { type: 'shadow', roll: { hit: true } }); } break;
    case 'pack': for (const e of foes.slice(0, 4)) { e.addStatus('stun', 2.2); dealDamage(src, e, 16 * lvlPow, { type: 'bite', roll: { hit: true } }); } break;
    case 'nanite': for (const h of G.party) h.addStatus('regen', 8, { every: 0.5, onTick: (x) => heal(src, x, x.maxHp * 0.025, true) }); zone({ pos, radius: 6, life: 3, color: 0x7affc8 }); break;
    case 'shrapnel': for (const e of foes) { dealDamage(src, e, 14 * lvlPow, { type: 'pierce', roll: { hit: true } }); e.addStatus('bleed', 5, { every: 0.5, onTick: (x) => dealDamage(src, x, 2 * lvlPow, { quiet: true, roll: { hit: true } }) }); } break;
    case 'blinkstrike': for (const e of foes.slice(0, 3)) { dealDamage(src, e, 18 * lvlPow, { type: 'shadow', roll: { hit: true } }); dealDamage(b || src, e, 18 * lvlPow, { type: 'shadow', roll: { hit: true } }); } break;
  }
}
