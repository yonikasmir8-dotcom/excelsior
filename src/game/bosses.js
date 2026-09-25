// Boss fights: multi-phase, fully telegraphed pattern sets. Each realm's boss plays differently.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { Enemy } from '../entities/enemy.js';
import { VoxelModel } from '../entities/model.js';
import { telegraph, spawnProjectile, burst, ring, popText, shake, debris, beam, zone } from './effects.js';
import { strike, enemiesOf, dealDamage } from './combat.js';
import { Audio } from '../core/audio.js';
import { emit } from '../core/events.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const heroes = () => enemiesOf('enemy').filter((e) => !e.isMinion);

function circleAttack(boss, p, r, delay, dmg, color = 0xff2020, extra) {
  telegraph(p, r, delay, color, (q) => {
    burst(q, [color, 0xffffff], 24, 7, 0.6, 0.3); Audio.play('bigHit'); shake(0.25);
    for (const e of enemiesOf('enemy')) if (e.pos.distanceTo(q) < r + e.radius) strike(boss, e, dmg, {}, { type: 'blast', knock: 12, heavy: true });
    extra && extra(q);
  }, boss);
}
function spiral(boss, n, color, dmg, speed = 12) {
  const base = Math.random() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      if (boss.dead) return;
      const a = base + i * 0.5; const d = V(Math.sin(a), 0, Math.cos(a));
      spawnProjectile({ from: boss.center(), dir: d, speed, color, size: 0.45, owner: boss, life: 3, onHit: (e) => strike(boss, e, dmg, {}, { type: 'blast' }) });
      if (i % 3 === 0) Audio.play('laser');
    }, i * 60);
  }
}
function summon(boss, types, n) {
  const near = G.entities.filter((e) => e.team === 'enemy' && !e.dead && !e.isBoss && e.pos.distanceTo(boss.pos) < 30).length;
  if (near >= 4) { for (const h of heroes()) circleAttack(boss, h.pos.clone(), 3, 1.1, '3d8+3', 0xff3a8a); return; }
  n = Math.min(n, 4 - near);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2; const p = boss.pos.clone().add(V(Math.cos(a) * 6, 1, Math.sin(a) * 6));
    p.y = G.world.groundBelow(p.x, p.y + 6, p.z) + 0.1;
    const e = new Enemy(types[i % types.length], p, boss.level); e.aggro = true; burst(e.center(), 0x8040ff, 16, 4);
  }
}

export const BOSSES = {
  hollowking: {
    name: 'The Hollow King', type: 'skeleton', hpMult: 10, scale: 2.4, title: 'Lich of the Forgotten Crown',
    skin: { body: 0x3a2a4a, legs: 0x2a1a3a, accent: 0xffcc30, skin: 0xe8e0c8 }, hat: 'crown', weapon: 'greatsword', extras: ['cape', 'shoulder'],
    phases: ['The King stirs...', 'THE CROWN REMEMBERS!', 'I WILL NOT BE FORGOTTEN!'],
    pattern(b, ph) {
      const P = [
        () => { b.model.play('slam', 1); for (const h of heroes()) circleAttack(b, h.pos.clone(), 3.2, 1.2, '3d8+4', 0x8040ff); },
        () => { b.model.play('cast', 1); popText(b.head(), 'Rise, my knights.', 'speech'); summon(b, ['skeleton', 'goblin'], 2 + ph); },
        () => { b.model.play('slam', 1); for (let k = 1; k <= 4; k++) setTimeout(() => { if (b.dead) return; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + k * 0.3; circleAttack(b, b.pos.clone().add(V(Math.cos(a) * k * 3.5, 0, Math.sin(a) * k * 3.5)), 1.8, 0.8, '2d8+2', 0xffcc30); } }, k * 350); },
        () => { b.model.play('cast', 1); spiral(b, 14 + ph * 6, 0x8040ff, '2d6+3'); },
      ];
      return P[Math.floor(Math.random() * P.length)];
    },
  },
  null: {
    name: 'NULL', type: 'mime', hpMult: 9, scale: 1.8, title: 'The Hero Eraser',
    skin: { body: 0xf0f0f0, legs: 0xe0e0e0, accent: 0x111111, skin: 0x111111, eye: 0xffffff }, hat: 'mask', weapon: 'baton', extras: ['cape'],
    phases: ['Nobody will remember you.', 'DELETING HEROES...', 'I AM THE BLANK PAGE!'],
    pattern(b, ph) {
      const P = [
        () => { b.model.play('cast', 1); popText(b.head(), 'Be forgotten.', 'speech'); for (const h of heroes()) circleAttack(b, h.pos.clone(), 2.8, 1.1, '3d8+3', 0xf0f0f0, (q) => debris(G.world.explode(q.x, q.y - 0.5, q.z, 2.2, G.realm.protect))); },
        () => { popText(b.head(), 'Meet my admirers.', 'speech'); summon(b, ['mime', 'punk', 'goon'], 2 + ph); },
        () => { b.model.play('spin', 1); spiral(b, 20 + ph * 8, 0x111111, '2d6+3', 14); },
        () => { const t = heroes()[0]; if (!t) return; burst(b.center(), 0x111111, 30, 5); const p = t.pos.clone().add(V(2, 0.5, 2)); b.pos.copy(p); Audio.play('shadow'); circleAttack(b, b.pos.clone(), 4, 0.7, '3d10+4', 0x111111); },
      ];
      return P[Math.floor(Math.random() * P.length)];
    },
  },
  caretaker: {
    name: 'CARETAKER', type: 'sentry', hpMult: 11, scale: 3.2, title: 'Ship Intelligence of the Asterion', flying: true,
    skin: { body: 0xe0e8f0, accent: 0xff3040 }, glow: 0xff3040,
    phases: ['Crew wellness: suboptimal. Correcting.', 'CORRECTIVE MEASURES ESCALATED.', 'I WILL KEEP THEM ALL. FOREVER.'],
    shieldWhileAdds: true,
    pattern(b, ph) {
      const P = [
        () => { popText(b.head(), 'Deploying sentries.', 'speech'); summon(b, ['sentry', 'husk'], 2 + ph); },
        () => { const n = 10 + ph * 4; for (let i = 0; i < n; i++) { const p = b.pos.clone().add(V((Math.random() - .5) * 26, 0, (Math.random() - .5) * 26)); circleAttack(b, p, 2.4, 1 + Math.random() * 0.8, '2d8+3', 0x40ffd0); } popText(b.head(), 'Venting plasma.', 'speech'); },
        () => { for (let s = 0; s < 3; s++) setTimeout(() => { if (!b.dead) spiral(b, 16, 0xff3040, '2d6+2', 13); }, s * 900); },
        () => { for (const h of heroes()) { const from = b.center(); beam(from, h.center(), 0xff3040, 0.08, 1.0); circleAttack(b, h.pos.clone(), 2, 1.0, '4d8+4', 0xff3040); } popText(b.head(), 'Target locked.', 'speech'); },
      ];
      return P[Math.floor(Math.random() * P.length)];
    },
  },
  warden: {
    name: 'Rift Warden', type: 'unwoven', hpMult: 7, scale: 2, title: 'Guardian of a Frayed Realm',
    skin: { body: 0x8a2a8a, legs: 0x4a1a4a, accent: 0xff3a8a }, hat: 'antlers', weapon: 'greatsword', extras: ['cape'],
    phases: ['This realm is ours now.', 'THE SEAMS SPLIT!', 'UNRAVEL WITH IT!'],
    pattern(b, ph) {
      return [
        () => { for (const h of heroes()) circleAttack(b, h.pos.clone(), 3, 1.1, '3d8+3', 0xff3a8a); },
        () => { summon(b, G.realm.pool.common, 2 + ph); },
        () => spiral(b, 16 + ph * 6, 0xff3a8a, '2d6+3'),
      ][Math.floor(Math.random() * 3)];
    },
  },
  unraveller: {
    name: 'THE UNRAVELLER', type: 'unwoven', hpMult: 16, scale: 3.2, title: 'That Which Unmakes',
    skin: { body: 0xf8f8f8, legs: 0xf0f0f0, accent: 0xff3a8a, skin: 0xffffff, eye: 0xff3a8a }, hat: 'antlers', weapon: 'greatsword', extras: ['cape', 'wings'],
    phases: ['You led me here. Thank you.', 'EVERY THREAD. EVERY REALM.', 'THE KNOT COMES UNDONE!', 'I... AM... FORGOTTEN...'],
    pattern(b, ph) {
      const all = [BOSSES.hollowking, BOSSES.null, BOSSES.caretaker];
      if (Math.random() < 0.5) return all[Math.floor(Math.random() * 3)].pattern(b, ph);
      return () => { popText(b.head(), 'Unravel.', 'speech'); for (let i = 0; i < 12 + ph * 4; i++) circleAttack(b, b.pos.clone().add(V((Math.random() - .5) * 30, 0, (Math.random() - .5) * 30)), 2.6, 0.8 + Math.random(), '3d8+4', 0xff3a8a); };
    },
  },
};

export function spawnBoss(key, pos, level) {
  const B = BOSSES[key];
  const e = new Enemy(B.type, pos, level, { hpMult: B.hpMult, skin: B.skin });
  // rebuild model with boss look
  G.scene.remove(e.model.root);
  e.model.dispose();
  const spec = { ...e.model.spec, scale: B.scale, hat: B.hat ?? e.model.spec.hat, weapon: B.weapon ?? e.model.spec.weapon, extras: B.extras ?? e.model.spec.extras, colors: { ...e.model.spec.colors, ...B.skin } };
  if (B.glow) spec.glowEyes = B.glow;
  e.model = new VoxelModel(spec); G.scene.add(e.model.root);
  e.radius = 0.45 * B.scale; e.height = 1.8 * B.scale * (spec.kind === 'drone' ? 0.8 : 1);
  e.name = B.name; e.title = B.title; e.isBoss = true; e.bossKey = key; e.knockResist = 1; e.critImmune = false;
  e.ac += 1; e.pow *= 1.3; e.xp = 600 + level * 60;
  if (B.flying) { e.flying = true; e.hoverY = pos.y + 3; }
  e.phase = 0; e.patT = 3; e.phases = B.phases;
  e.bossPhase = () => {
    if (e.phase < B.phases.length - 1) {
      e.phase++; e.hp = e.maxHp * (e.phase === B.phases.length - 1 ? 0.35 : 0.6);
      e.addStatus('invuln', 2.5); Audio.play('roar'); shake(0.8); G.post && (G.post.flash = 0.6);
      popText(e.head(), B.phases[e.phase], 'crit-banner', { color: '#ff3a8a', life: 2.5 });
      ring(e.pos, 14, 0xff3a8a, 0.8);
      for (const h of heroes()) { const d = h.pos.clone().sub(e.pos); d.y = 0; h.knock.add(d.normalize().multiplyScalar(16)); }
      emit('bossPhase', { boss: e, phase: e.phase });
      return false;
    }
    emit('bossDefeated', { boss: e, key });
    return true;
  };
  e.bossUpdate = (dt) => {
    if (!e.aggro) { for (const h of G.party) if (!h.downed && h.pos.distanceTo(e.pos) < 18) { e.alert(); emit('bossEncounter', { boss: e }); popText(e.head(), B.phases[0], 'speech', { life: 3 }); } return; }
    const t = e.chooseTarget(); if (!t) return;
    e.target = t;
    e.faceTo(t.pos, dt * 3);
    const d = t.pos.clone().sub(e.pos); d.y = 0; const dist = d.length();
    e.moveInput.set(0, 0, 0);
    if (!B.flying && dist > 5) e.moveInput.copy(d.normalize()).multiplyScalar(0.7);
    if (B.flying) e.hoverY = t.pos.y + 4;
    if (B.shieldWhileAdds) {
      const adds = G.entities.filter((x) => x.team === 'enemy' && !x.dead && !x.isBoss && x.pos.distanceTo(e.pos) < 30).length;
      if (adds > 0 && !e.has('shielded')) popText(e.head(), 'Shielded: destroy its sentries', 'info', { color: '#40ffd0' });
      if (adds > 0) e.addStatus('shielded', 0.5); e.resist = adds > 0 ? { fire: 0.2, lightning: 0.2, pierce: 0.2, slash: 0.2, blunt: 0.2, holy: 0.2, tech: 0.2, shadow: 0.2, blast: 0.2, bite: 0.2 } : {};
    }
    // melee swipe if close
    e.swipeT = (e.swipeT || 0) - dt;
    if (dist < 4 + e.radius && e.swipeT <= 0 && !B.flying) { e.swipeT = 2; circleAttack(e, e.pos.clone().add(e.forward().multiplyScalar(2)), 3, 0.6, '2d10+4', 0xff2020); e.model.play('attack', 0.6); }
    e.patT -= dt * (1 + e.phase * 0.35);
    if (e.patT <= 0) { e.patT = 4.2; B.pattern(e, e.phase)(); }
  };
  return e;
}
