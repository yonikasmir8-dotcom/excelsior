// Companion AI: follows the leader, picks sensible targets, uses abilities with role-aware heuristics,
// and revives downed friends. Tactics (P menu) tilt how aggressive each companion is.
import * as THREE from 'three';
import { G, activeHero } from '../core/state.js';
import { enemiesNear, nearestEnemy, revive } from './combat.js';
import { setTether } from './classes.js';
import { popText } from './effects.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const RANGED = { sorcerer: 10, artificer: 9, ranger: 12, cleric: 2.2, fighter: 2, rogue: 1.8 };

export function updateCompanion(h, dt, slot) {
  if (h.downed || h.dead) return;
  const lead = activeHero();
  h.moveInput.set(0, 0, 0);
  h.aiCd = Math.max(0, (h.aiCd || 0) - dt);
  const tactic = h.data.tactic || 'balanced';
  // revive
  const downed = G.party.find((a) => a.downed && a !== h && a.pos.distanceTo(h.pos) < 16);
  if (downed && (tactic !== 'aggressive' || enemiesNear(downed.pos, 6, 'party').length === 0)) {
    const to = downed.pos.clone().sub(h.pos); to.y = 0;
    if (to.length() > 1.4) { h.moveInput.copy(to.normalize()); h.faceTo(downed.pos, 0.3); }
    else { downed.reviveT = (downed.reviveT || 0) + dt * (h.t('jury_rig') ? 2 : 1); if (downed.reviveT > 2.2) { downed.reviveT = 0; revive(downed); } }
    jumpIfBlocked(h); return;
  }
  // step out of enemy telegraphs (companions play fair too)
  for (const f of G.effects) {
    if (f.kind !== 'telegraph' || !f.hostile) continue;
    const d = h.pos.clone().sub(f.pos); d.y = 0; const dist = d.length();
    if (dist < f.radius + 0.8) {
      if (dist < 0.1) d.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      h.moveInput.copy(d.normalize());
      if (f.t > f.life * 0.55 && Math.random() < 0.5) h.dash(h.moveInput);
      jumpIfBlocked(h); return;
    }
  }
  const foes = enemiesNear(lead.pos, 22, 'party').filter((e) => e.aggro || e.pos.distanceTo(h.pos) < 8);
  if (!foes.length) {
    // follow in formation
    const off = [V(-1.8, 0, -1.6), V(1.8, 0, -1.6), V(0, 0, -3)][slot % 3].applyAxisAngle(V(0, 1, 0), lead.yaw);
    const want = lead.pos.clone().add(off); const to = want.sub(h.pos); to.y = 0; const d = to.length();
    if (d > 1.2) { h.moveInput.copy(to.normalize()).multiplyScalar(Math.min(1.3, d / 3)); h.faceTo(h.pos.clone().add(h.moveInput), 0.2); }
    if (d > 30 || h.pos.y < lead.pos.y - 12) { h.pos.copy(lead.pos).add(V(0, 1, 0)); h.vel.set(0, 0, 0); }
    h.speed = h.cls.stats.speed * (d > 8 ? 1.4 : 1);
    jumpIfBlocked(h);
    return;
  }
  h.speed = h.cls.stats.speed;
  // target: leader's target if close, else nearest
  let tgt = (lead.aimTarget && !lead.aimTarget.dead && lead.aimTarget.pos.distanceTo(h.pos) < 20) ? lead.aimTarget : null;
  if (!tgt || tactic === 'defensive') tgt = nearestEnemy(tactic === 'defensive' ? lead : h, 'party', 22);
  if (!tgt) return;
  h.aiTarget = tgt;
  const to = tgt.pos.clone().sub(h.pos); to.y = 0; const dist = to.length();
  const want = RANGED[h.classId] * (tactic === 'aggressive' ? 0.8 : 1);
  if (dist > want + 0.5) h.moveInput.copy(to.clone().normalize());
  else if (dist < want - 3 && want > 5) h.moveInput.copy(to.clone().normalize().multiplyScalar(-0.8));
  else if (want > 5) h.moveInput.set(-to.z, 0, to.x).normalize().multiplyScalar(0.4 * Math.sin(G.time * 0.7 + slot));
  h.faceTo(tgt.pos, 0.25);
  jumpIfBlocked(h);
  // leash to leader
  if (h.pos.distanceTo(lead.pos) > 26) { const back = lead.pos.clone().sub(h.pos); back.y = 0; h.moveInput.copy(back.normalize()); }
  if (!h.canAct) return;
  if (useMechanic(h, tgt, foes, dist, dt)) return;
  const T = { target: tgt, dir: tgt.center().sub(h.center()).normalize(), point: tgt.pos.clone(), ai: true };
  if (h.aiCd <= 0) {
    const ab = pickAbility(h, tgt, foes, dist);
    if (ab && h.tryCast(ab, T)) { h.aiCd = 0.7 + Math.random() * 0.6; if (Math.random() < 0.15) popText(h.head(), ab.name + '!', 'speech'); return; }
  }
  const basic = h.basicAbility();
  if (dist <= (basic.range || 2.5) + tgt.radius + 0.5 && !(h.cds.basic > 0)) h.tryCast(basic, T);
}

// Companions use their class mechanic too, so every class feels distinct even when you're not driving it.
function useMechanic(h, tgt, foes, dist, dt) {
  const T = { target: tgt, dir: tgt.center().sub(h.center()).normalize(), point: tgt.pos.clone() };
  switch (h.classId) {
    case 'fighter': {
      const threat = G.entities.find((e) => e.team === 'enemy' && !e.dead && e.target === h && e.windup > 0 && e.windup < 0.32 && e.pos.distanceTo(h.pos) < 4 + e.radius);
      if (threat && !h.mechHeld) { h.faceTo(threat.pos, 1); h.mechPress(T); h.guardUntil = G.time + 0.5; }
      if (h.mechHeld) { h.mechHold(dt, T); if (G.time > (h.guardUntil || 0)) h.mechRelease(T); return true; }
      return false; }
    case 'sorcerer': if (G.time > (h.nextAttune || 0)) { h.nextAttune = G.time + 5 + Math.random() * 4; h.mechPress(T); } return false;
    case 'cleric': if (G.time > (h.nextTether || 0)) { h.nextTether = G.time + 4; let low = null, lv = 2; for (const a of G.party) { if (a.dead || a.downed) continue; const v = a.hp / a.maxHp + (a === h ? 0.15 : 0); if (v < lv) { lv = v; low = a; } } if (low) setTether(h, low); } return false;
    case 'artificer': { const near = G.entities.filter((e) => e.isMinion && e.owner === h && !e.dead && e.kind === 'turret' && enemiesNear(e.pos, 4.5, 'party').length >= 2); if (near.length && e_(h)) { h.mechPress(T); return true; } return false; }
    case 'rogue': if ((h.tumbleCharges ?? 2) > 0 && dist < 7 && dist > 2 && Math.random() < dt * 0.8) { h.mechPress(T); return true; } return false;
    case 'ranger':
      if (h.mechHeld) { h.faceTo(tgt.pos, 1); h.mechHold(dt, T); if ((h.drawT || 0) >= 1.1) h.mechRelease(T); return true; }
      if (dist > 9 && (h.tgtDraw || 0) < G.time && Math.random() < dt * 0.4) { h.tgtDraw = G.time + 4; h.mechPress(T); return true; }
      return false;
  }
  return false;
}
function e_(h) { return (h.cds.mech || 0) <= 0; }

function jumpIfBlocked(h) { if (h.blocked && h.grounded && h.moveInput.lengthSq() > 0.1) { h.jump(); } h.blocked = false; }

function pickAbility(h, tgt, foes, dist) {
  const ready = h.abilityList().filter((a) => !(h.cds[a.id] > 0));
  if (!ready.length) return null;
  const allies = G.party.filter((a) => !a.dead);
  const hurt = allies.filter((a) => !a.downed && a.hp / a.maxHp < 0.55);
  const downedN = allies.filter((a) => a.downed).length;
  const near = (r) => enemiesNear(h.pos, r, 'party').length;
  const clusterAt = (p, r) => enemiesNear(p, r, 'party').length;
  const big = tgt.isBoss || tgt.isElite || tgt.isNemesis;
  const want = {
    cleave: near(3.5) >= 2 || (near(3) >= 1 && Math.random() < 0.3),
    charge: dist > 4 && dist < 11,
    battlecry: near(8) >= 3 || (allies.some((a) => a !== h && enemiesNear(a.pos, 3, 'party').length >= 2)),
    whirlwind: near(4) >= 3 || (big && dist < 4),
    firebolt: dist < 22, chain: foes.length >= 2 || big, blink: h.hp / h.maxHp < 0.4 && near(3) >= 1, meteor: clusterAt(tgt.pos, 5) >= 3 || big,
    turret: !G.entities.some((e) => e.isMinion && e.kind === 'turret' && e.owner === h && !e.dead), grenade: clusterAt(tgt.pos, 4) >= 2 || big, bot: hurt.length >= 1, overclock: foes.length >= 4 || big,
    heal: hurt.length >= 1 || downedN > 0, sanctuary: allies.filter((a) => a.pos.distanceTo(h.pos) < 5).length >= 2 && foes.length >= 2, smite: dist < 24, divine: downedN >= 1 || hurt.length >= 2,
    shadowstep: dist < 14, smoke: h.hp / h.maxHp < 0.45 || (allies.some((a) => a.hp / a.maxHp < 0.3)), knives: near(7) >= 2, deathmark: big,
    volley: clusterAt(tgt.pos, 4) >= 2 || big, snare: clusterAt(tgt.pos, 3.5) >= 2 || (big && Math.random() < 0.3), pounce: true, storm: foes.length >= 3 || big,
  };
  // priority: emergency healing first
  const order = ['divine', 'heal', 'bot', 'sanctuary', 'smoke', 'blink', 'battlecry', 'overclock', 'meteor', 'whirlwind', 'storm', 'deathmark', 'turret', 'pounce', 'shadowstep', 'charge', 'chain', 'grenade', 'volley', 'snare', 'cleave', 'firebolt', 'knives', 'smite'];
  for (const id of order) { const a = ready.find((x) => x.id === id); if (a && want[id]) return a; }
  return null;
}
