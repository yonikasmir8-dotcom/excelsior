// Location loading + realm quest scripts. Realms are seeded so layouts stay stable between visits,
// while enemies, captains and loot are rolled fresh each time.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { Rng } from '../core/rng.js';
import { Audio } from '../core/audio.js';
import { emit, on } from '../core/events.js';
import { genTavern, genEmberwood, genNeon, genAsterion, genRift, genLoom } from '../world/gen.js';
import { Hero } from '../entities/hero.js';
import { Enemy } from '../entities/enemy.js';
import { NPC } from '../entities/npc.js';
import { NPCS, COMPANIONS } from '../content/npcs.js';
import { REALM_POOLS } from './enemies.js';
import { spawnBoss } from './bosses.js';
import { clearEffects, initEffects, burst, popText, ring, zone, timed } from './effects.js';
import { captainsFor, ensureWarband } from './nemesis.js';
import { summonPet, CLASSES } from './classes.js';
import { newCombatState, endCombat } from './combat.js';
import { LEGENDARIES, makeLegendary } from './loot.js';
import { UI } from '../ui/ui.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const REALMS = {
  tavern: { name: 'The Hearth Between', kind: 'tavern', style: 'tavern', music: 'tavern', sky: [0x1a0a3a, 0x6a2a6a], fog: [0x2a1a3a, 40, 140], sun: 0xffd0a0, amb: 0xd0b0c0, stars: true, bright: 1.5 },
  emberwood: { name: 'Emberwood Reach', kind: 'emberwood', style: 'emberwood', music: 'emberwood', sky: [0x5a8ad0, 0xffc890], fog: [0xe8c090, 40, 150], sun: 0xfff0d0, amb: 0x9a8aa0, base: 1, genre: 'Fantasy', blurb: 'An endless autumn forest. A dead king. Three corrupted ley-stones.' },
  neon: { name: 'Neon Meridian', kind: 'neon', style: 'neon', music: 'neon', sky: [0x0a0420, 0x6a1a6a], fog: [0x2a0a3a, 40, 170], sun: 0xa0a0ff, amb: 0x8a70c0, stars: true, base: 3, genre: 'Superhero', blurb: 'A city where the heroes are being erased from memory.' },
  asterion: { name: 'The Asterion', kind: 'asterion', style: 'asterion', music: 'asterion', sky: [0x02040a, 0x0a1a2a], fog: [0x05101a, 50, 170], sun: 0xc0e0ff, amb: 0x5a7080, stars: true, base: 5, genre: 'Sci-Fi', blurb: 'A derelict ship whose AI is rewriting its sleeping crew.' },
  rift: { name: 'Rift', kind: 'rift', style: 'rift', music: 'rift', sky: [0x2a0a3a, 0xff6a9a], fog: [0x4a1a5a, 40, 140], sun: 0xffe0f0, amb: 0x9a7aa0, stars: true, base: 2, genre: 'Everything', blurb: 'Torn places where genres bleed together. Endless, stranger with depth.' },
  loom: { name: 'The Loom', kind: 'loom', style: 'loom', music: 'loom', sky: [0xffffff, 0xffd0e0], fog: [0xfff0f4, 50, 160], sun: 0xffffff, amb: 0xc0b0c0, base: 10, genre: 'Finale', blurb: 'Where every thread meets.' },
};

export const TRIAL_MODS = { fighter: ['elite', 'swift', 'bloodmoon'], sorcerer: ['glass', 'volatile', 'fate'], artificer: ['nemesis', 'elite', 'volatile'], cleric: ['glass', 'vampire', 'swift'], rogue: ['swift', 'nemesis', 'glass'], ranger: ['lowgrav', 'elite', 'swift'] };
export const RIFT_MODS = [
  { id: 'lowgrav', name: 'Low Gravity', desc: 'Everyone jumps higher and falls slower.', apply: (st) => { st.grav = 0.45; } },
  { id: 'glass', name: 'Glass Cannons', desc: 'Everyone deals and takes 50% more damage.', apply: (st) => { st.glass = true; } },
  { id: 'fate', name: 'Fate-Blessed', desc: '+3 Fate Dice every fight.', apply: (st) => { st.extraDice = 3; } },
  { id: 'swift', name: 'Swift Foes', desc: 'Enemies move 30% faster.', apply: (st) => { st.enemySpeed = 1.3; } },
  { id: 'elite', name: 'Elite Warbands', desc: 'Far more elites.', apply: (st) => { st.elites = 0.35; } },
  { id: 'bigheads', name: 'Big Head Mode', desc: 'Exactly what it sounds like.', apply: (st) => { st.bigheads = true; } },
  { id: 'bloodmoon', name: 'Blood Moon', desc: 'Enemies have 30% more HP. Loot is much better.', apply: (st) => { st.enemyHp = 1.3; st.lootBoost = 1.5; } },
  { id: 'volatile', name: 'Volatile', desc: 'Enemies explode when they die. Watch the rings.', apply: (st) => { st.volatile = true; } },
  { id: 'vampire', name: 'Vampiric', desc: 'Everyone heals for 10% of the damage they deal.', apply: (st) => { st.vamp = 0.1; } },
  { id: 'nemesis', name: 'Hunted', desc: 'Nemeses are drawn to you. Extra captains appear.', apply: (st) => { st.extraCaptains = 2; } },
];

let skyMesh = null, lights = [];
function makeSky(def) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 512; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#' + new THREE.Color(def.sky[0]).getHexString()); grd.addColorStop(0.55, '#' + new THREE.Color(def.sky[1]).getHexString()); grd.addColorStop(1, '#' + new THREE.Color(def.sky[1]).getHexString());
  g.fillStyle = grd; g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(380, 24, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }));
  if (def.stars) {
    const pos = []; for (let i = 0; i < 700; i++) { const v = V(Math.random() - .5, Math.random() * 0.9 + 0.05, Math.random() - .5).normalize().multiplyScalar(360); pos.push(v); }
    const star = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), pos.length);
    const d = new THREE.Object3D(); pos.forEach((p, i) => { d.position.copy(p); d.scale.setScalar(0.5 + Math.random() * 1.2); d.updateMatrix(); star.setMatrixAt(i, d.matrix); }); m.add(star);
  }
  return m;
}

export function clearLocation() {
  endCombat();
  for (const e of G.entities.slice()) e.remove();
  G.entities = []; clearEffects();
  if (G.world) { G.scene.remove(G.world.group); G.world.dispose(); G.world = null; }
  if (skyMesh) { G.scene.remove(skyMesh); skyMesh = null; }
  lights.forEach((l) => G.scene.remove(l)); lights = [];
  G.interactables = []; G.markers = []; G.pickups = [];
  G.party = [];
  if (G.scriptOff) { G.scriptOff.forEach((f) => f()); G.scriptOff = null; }
  UI.bossBar(null);
}

export function buildParty(spawn) {
  const S = G.save;
  G.party = [];
  S.active.forEach((id, i) => {
    const data = S.members.find((m) => m.id === id); if (!data) return;
    const h = new Hero(data, spawn.clone().add(V((i % 2) * 1.5 - 0.75, 0.2, -Math.floor(i / 2) * 1.5 - (i ? 1 : 0))));
    h.spawn = spawn.clone(); h.yaw = Math.atan2(G.world.w / 2 - spawn.x, G.world.d / 2 - spawn.z); G.entities.push(h); G.party.push(h);
    if (data.classId === 'ranger' && G.location !== 'tavern') summonPet(h);
    if (S.buff && G.location !== 'tavern') { if (S.buff.id === 'hearty') { h.maxHp = Math.round(h.maxHp * 1.2); h.hp = h.maxHp; } if (S.buff.id === 'chili') h.pow *= 1.12; }
  });
  G.activeIndex = 0;
}

export function loadLocation(id, opts = {}) {
  clearLocation();
  const def = REALMS[id]; G.location = id; G.realm = { ...def, id, pool: REALM_POOLS[id] || REALM_POOLS.rift, state: {} };
  G.combat = newCombatState();
  const S = G.save;
  let gen;
  if (id === 'tavern') gen = genTavern();
  else if (id === 'emberwood') gen = genEmberwood(11);
  else if (id === 'neon') gen = genNeon(22);
  else if (id === 'asterion') gen = genAsterion(33);
  else if (id === 'loom') gen = genLoom();
  else gen = genRift(opts.seed || (1000 + S.riftDepth * 7919 + Math.floor(Math.random() * 1000)));
  const { W, layout } = gen;
  G.world = W; G.layout = layout; W.buildAll(); G.scene.add(W.group);
  G.realm.protect = layout.protect || (() => false);
  // sky, fog, light
  skyMesh = makeSky(def); G.scene.add(skyMesh);
  G.scene.background = new THREE.Color(def.sky[1]);
  G.scene.fog = new THREE.Fog(def.fog[0], def.fog[1], def.fog[2]);
  if (id === 'rift' && layout.theme) { G.realm.name = 'Rift: ' + layout.theme.name; G.scene.fog.color.setHex(layout.theme.ground).lerp(new THREE.Color(0xffffff), 0.4); }
  const hemi = new THREE.HemisphereLight(def.amb, 0x3a2a30, 1.6 * (def.bright || 1));
  const sun = new THREE.DirectionalLight(def.sun, 1.9); sun.position.set(0.6, 1, 0.35);
  lights = [hemi, sun]; lights.forEach((l) => G.scene.add(l));
  G.post.setStyle(def.style);
  Audio.music(def.music);
  initEffects();
  // level
  const L = S.party.level;
  G.realm.level = id === 'rift' ? Math.max(2, L) + Math.floor(S.riftDepth / 2) : Math.max(def.base || 1, L);
  // party
  const spawn = layout.spawn.clone();
  if (spawn.y === 0 || !spawn.y) spawn.y = W.heightAt(spawn.x, spawn.z);
  buildParty(spawn);
  G.realm.spawn = spawn;
  // location content
  if (id === 'tavern') setupTavern(layout);
  else setupRealm(id, layout, opts);
  UI.enterLocation(G.realm);
  emit('locationLoaded', { id });
}

// ───────────────────────────── TAVERN ─────────────────────────────
function setupTavern(L) {
  const S = G.save;
  const place = (id, pos, yaw, opts = {}) => { const n = new NPC(id, NPCS[id], pos.clone(), { yaw, ...opts }); addTalk(n); return n; };
  place('maren', L.bar, -Math.PI / 2);
  place('grizzle', L.center.clone().add(V(7, 0, 8)), Math.PI);
  place('lute', L.stage, 0, { idle: 'cheer' });
  place('carto', L.shelves.clone().add(V(1, 0, 2)), 0);
  place('rollo', L.tables[0].clone().add(V(0.5, 0, -1)), 0, { idle: 'sit' });
  place('stew', L.fire.clone().add(V(2, 0, 3)), Math.PI / 2);
  place('ghost', L.cellar, 0);
  if (!S.ending) place('stranger', L.tables[4].clone().add(V(0.8, 0, 0.5)), -Math.PI / 2, { idle: 'sit' });
  // companions not in the party hang out around the tavern
  const spots = [L.tables[1].clone().add(V(0.5, 0, -1)), L.tables[2].clone().add(V(0.5, 0, -1)), L.tables[3].clone().add(V(-1, 0, 0.5)), L.fire.clone().add(V(3, 0, -3)), L.center.clone().add(V(-2, 0, -8)), L.bar.clone().add(V(-3, 0, -5)), L.bar.clone().add(V(-3, 0, 4)), L.center.clone().add(V(4, 0, 5))];
  let si = 0;
  for (const [cid, c] of Object.entries(COMPANIONS)) {
    if (c.unlock && !S.realms[c.unlock]?.done) continue;
    const member = S.members.find((m) => m.companionId === cid);
    if (member && S.active.includes(member.id)) continue;
    const look = { kind: 'humanoid', ...compModel(cid) };
    const n = new NPC(cid, { name: c.name, look, idle: 'drink' }, spots[si++ % spots.length], { dialogue: 'comp_' + cid, yaw: Math.random() * 6, idle: si % 3 === 0 ? 'sit' : 'drink' });
    addTalk(n);
  }
  // doors
  for (const [k, pos] of Object.entries(L.doors)) {
    G.interactables.push({ pos: pos.clone().add(V(0, 0, 1)), radius: 2.2, label: () => doorLabel(k), use: () => useDoor(k) });
  }
  // nemesis board
  G.interactables.push({ pos: L.board.clone(), radius: 2.5, label: () => 'Read the Wanted Wall (Nemeses)', use: () => UI.openJournal('nemesis') });
  // party companions in tavern are normal heroes (controllable); also allow talking to them
  S.buff = null;
  if (!S.flags.prologue) setTimeout(() => UI.dialogue('maren'), 900);
  UI.objective(S.flags.prologue ? (S.ending ? 'Explore the Rifts, hunt Nemeses, collect Legendaries.' : questHint()) : 'Talk to Old Maren at the bar.');
}
export function compModel(cid) {
  const C = COMPANIONS[cid]; const cl = CLASSES[C.classId];
  const base = cl ? cl.model : {};
  return { ...base, colors: { skin: 0xf0c090, eye: 0x1a1020, ...(base.colors || {}), ...C.look }, longHair: C.longHair, scale: C.scale };
}
function addTalk(n) {
  G.interactables.push({ pos: n.pos, radius: 2.4, label: () => `Talk to ${n.label}`, use: () => UI.dialogue(n.dialogue, n), npc: n });
}
function doorLabel(k) {
  const S = G.save; const r = REALMS[k];
  if (!S.doors[k]) return k === 'rift' ? 'Rift Door (sealed: save a realm first)' : k === 'loom' ? 'White Door (sealed)' : `${r.name} (sealed: talk to Maren)`;
  const done = S.realms[k]?.done ? ' ✓' : '';
  return `Enter ${r.name}${done}` + (k === 'rift' ? ` (Depth ${S.riftDepth + 1})` : '');
}
function useDoor(k) {
  const S = G.save; if (!S.doors[k]) { Audio.play('miss'); UI.toast('The door is sealed.'); return; }
  if (S.active.length < 2 && !S.flags.soloWarned) { S.flags.soloWarned = 1; UI.toast('You\'re alone! Recruit companions in the tavern first (or go solo if you dare).'); return; }
  UI.realmIntro(k, () => travel(k));
}
export function travel(k, opts) { Audio.play('portal'); UI.fade(() => { loadLocation(k, opts); G.saveNow?.(); }); }
export function questHint() {
  const S = G.save;
  if (S.shards.length >= 3 && !S.flags.confession) return 'Bring the three Loom-Shards to Maren.';
  if (S.flags.confession && !S.ending) return 'Enter the Loom (white door) and face the Unraveller.';
  const left = ['emberwood', 'neon', 'asterion'].filter((k) => !S.realms[k]?.done).map((k) => REALMS[k].name);
  return left.length ? `Save a realm: ${left.join(', ')}.` : 'Explore the Rifts.';
}

// ───────────────────────────── REALMS ─────────────────────────────
function spawnGroup(pos, n, level, pool, elites = 0.12) {
  const R = G.realm.state;
  const out = [];
  for (let i = 0; i < n; i++) {
    const elite = Math.random() < (R.elites || elites) && i === 0;
    const type = elite ? pool.elite[Math.floor(Math.random() * pool.elite.length)] : pool.common[Math.floor(Math.random() * pool.common.length)];
    const p = pos.clone().add(V((Math.random() - .5) * 6, 0, (Math.random() - .5) * 6));
    p.y = G.world.groundBelow(p.x, p.y + 6, p.z) + 0.05;
    const e = new Enemy(type, p, level + (elite ? 1 : 0), { hpMult: R.enemyHp || 1 });
    if (R.enemySpeed) e.speed *= R.enemySpeed;
    if (R.bigheads && e.model.parts.head) e.model.parts.head.scale.setScalar(2);
    out.push(e);
  }
  return out;
}
export function spawnCaptain(c, pos, retinue = 3) {
  const p = pos.clone(); p.y = G.world.groundBelow(p.x, p.y + 8, p.z) + 0.05;
  const e = new Enemy(c.type, p, c.level, { captain: c });
  if (retinue) spawnGroup(pos, retinue, G.realm.level, G.realm.pool, 0);
  return e;
}
function setupRealm(id, L, opts) {
  const S = G.save; const R = G.realm; const lvl = R.level;
  S.realms[id] = S.realms[id] || { stage: 0, done: false, visits: 0 };
  S.realms[id].visits++;
  // rift modifiers
  if (id === 'rift') {
    const n = 1 + Math.min(3, Math.floor(S.riftDepth / 2));
    const mods = []; const pool = RIFT_MODS.slice();
    if (opts.trial) { R.trial = opts.trial; for (const mid of TRIAL_MODS[opts.trial.cls].slice(0, opts.trial.tier)) mods.push(RIFT_MODS.find((m) => m.id === mid)); R.level = Math.max(R.level, S.party.level + opts.trial.tier); G.realm.name = `${CLASSES[opts.trial.cls].name}'s Trial ${['I', 'II', 'III'][opts.trial.tier - 1]}`; }
    else for (let i = 0; i < n; i++) mods.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    R.mods = mods; mods.forEach((m) => m.apply(R.state));
  }
  if (R.state.grav) G.party.forEach((h) => (h.gravScale = R.state.grav));
  // enemies
  const heavy = id === 'loom' ? 0 : 1;
  (L.enemySpots || []).forEach((p, i) => { if (Math.random() < 0.8 * heavy) spawnGroup(p, 3 + Math.floor(Math.random() * 3), lvl, R.pool); });
  // captains / nemeses
  if (id !== 'loom') {
    ensureWarband(id === 'rift' ? 'rift' : id, lvl);
    const caps = captainsFor(id === 'rift' ? 'rift' : id, 2 + (R.state.extraCaptains || 0));
    caps.forEach((c, i) => { const camp = (L.camps || [])[i % Math.max(1, (L.camps || []).length)]; if (camp) spawnCaptain(c, camp.clone().add(V(i * 3, 0, 0))); });
  }
  // collectibles
  (L.collect || []).forEach((p, i) => {
    const key = id + ':' + i; if (S.collected[key] || id === 'rift') return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.15), new THREE.MeshBasicMaterial({ color: 0xffe080 }));
    m.position.copy(p).add(V(0, 1, 0)); G.scene.add(m);
    G.effects.push({ obj: m, t: 0, update(dt) { this.t += dt; m.rotation.y += dt * 2; m.position.y = p.y + 1 + Math.sin(this.t * 3) * 0.2; return !S.collected[key]; }, dispose() { G.scene.remove(m); } });
    G.interactables.push({ pos: p, radius: 2, label: () => 'Pick up ' + LORE_NAMES[id], use: () => { S.collected[key] = 1; S.lore.push(key); Audio.play('loot'); UI.lore(id, i); G.interactables = G.interactables.filter((x) => x.pos !== p); UI.grantXp(40 + lvl * 5); } });
  });
  // return portal
  const ret = G.realm.spawn.clone().add(V(0, 0, -7)); ret.y = G.world.groundBelow(ret.x, ret.y + 4, ret.z);
  portalFx(ret, 0xffd070);
  G.interactables.push({ pos: ret, radius: 2.4, label: () => 'Return to the Tavern', use: () => travel('tavern') });
  // realm-specific mechanics
  if (id === 'emberwood') setupEmberwood(L);
  if (id === 'neon') setupNeon(L);
  if (id === 'asterion') setupAsterion(L);
  if (id === 'rift') setupRift(L);
  if (id === 'loom') setupLoom(L);
  // banter on entry
  setTimeout(() => emit('banter', { ev: id, fallback: 'enter' }), 1500);
}
export const LORE_NAMES = { emberwood: 'Lost Page', neon: 'Vintage Comic', asterion: 'Crew Log', rift: 'Fragment', loom: 'Thread' };

function portalFx(pos, color) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 0.4), new THREE.MeshLambertMaterial({ color: 0x3a2a20 }));
  const inner = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.8, 0.45), new THREE.MeshBasicMaterial({ color }));
  frame.position.y = 1.7; inner.position.y = 1.5; g.add(frame, inner); g.position.copy(pos); G.scene.add(g);
  G.effects.push({ obj: g, t: 0, update(dt) { this.t += dt; inner.scale.set(1 + Math.sin(this.t * 4) * 0.04, 1, 1); if (Math.random() < 0.3) burst(pos.clone().add(V((Math.random() - .5) * 1.8, Math.random() * 3, 0)), color, 1, 1, 0.8, 0.15, 1); return true; }, dispose() { G.scene.remove(g); } });
}

// Stage helpers
function stage(id) { return G.save.realms[id].stage; }
function setStage(id, n) { G.save.realms[id].stage = n; Audio.play('quest'); refreshObjective(id); }
export function refreshObjective(id = G.location) {
  const S = G.save; const R = G.realm; if (!R || !R.objectives) return;
  const o = R.objectives[Math.min(stage(id), R.objectives.length - 1)];
  UI.objective(S.realms[id].done ? R.patrolText || 'Realm saved! Hunt captains, find collectibles, or return to the Tavern.' : (typeof o === 'function' ? o() : o));
}
function onScript(evt, fn) { const off = on(evt, fn); (G.scriptOff = G.scriptOff || []).push(off); }
function marker(pos, color = 0xffd23a) { G.markers.push({ pos, color }); }
function clearMarkers() { G.markers = []; }
function wave(center, n, types, onClear, level = G.realm.level) {
  const spawned = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random(); const p = center.clone().add(V(Math.cos(a) * 11, 2, Math.sin(a) * 11));
    p.y = G.world.groundBelow(p.x, p.y + 8, p.z) + 0.05;
    const e = new Enemy(types[i % types.length], p, level); e.aggro = true; spawned.push(e); burst(e.center(), 0x8040ff, 14, 4);
  }
  timed(600, () => { if (spawned.every((e) => e.dead)) { onClear(); return false; } });
  return spawned;
}
function realmComplete(id, memory) {
  const S = G.save; if (S.realms[id].done) return;
  S.realms[id].done = true;
  if (!S.shards.includes(id)) S.shards.push(id);
  S.flags.riftOpen = 1; S.doors.rift = true;
  S.stats.bosses++;
  UI.grantXp(400 + G.realm.level * 40);
  setTimeout(() => UI.dialogue(memory, null, () => { UI.banner('REALM SAVED', `${G.realm.name} remembers itself. Loom-Shard obtained (${S.shards.length}/3).`); refreshObjective(id); G.saveNow?.(); }), 1500);
}

// EMBERWOOD — cleanse ley-stones, breach the keep, slay the Hollow King
function setupEmberwood(L) {
  const id = 'emberwood'; const S = G.save; const R = G.realm;
  const st = () => S.realms[id].stones = S.realms[id].stones || [false, false, false];
  const cleansed = () => st().filter(Boolean).length;
  R.objectives = ['Find Ranger Elowen at the camp.', () => `Cleanse the corrupted Ley-Stones (${cleansed()}/3).`, 'Breach the Hollow Keep: defeat the Gatekeeper.', 'Enter the keep and defeat the Hollow King.'];
  const n = new NPC('elowen', NPCS.elowen, L.camp.clone().add(V(2, 0, 0)), { yaw: -Math.PI / 2 }); addTalk(n);
  // restore cleansed stones visually
  st().forEach((c, i) => { if (c) cleanseStone(L, i, true); });
  L.stones.forEach((s, i) => {
    G.interactables.push({ pos: s.clone().add(V(0, 0, 2)), radius: 3, label: () => st()[i] ? 'Ley-Stone (cleansed)' : 'Cleanse the Ley-Stone', cond: () => stage(id) >= 1, use: () => {
      if (st()[i] || R.busy) return; R.busy = true;
      UI.toast('The corruption fights back! Hold the stone!'); Audio.play('roar');
      wave(s, 4 + Math.floor(R.level / 4), ['goblin', 'wolf', 'shaman', 'skeleton'], () => { R.busy = false; st()[i] = true; cleanseStone(L, i); UI.grantXp(80 + R.level * 10); if (cleansed() >= 3) { setStage(id, 2); spawnGatekeeper(); } else refreshObjective(id); });
    } });
  });
  const spawnGatekeeper = () => {
    const e = new Enemy('troll', L.gate.clone(), R.level + 2, { hpMult: 2.2 }); e.name = 'The Gatekeeper'; e.isElite = true;
    onScript('enemyKilled', ({ enemy }) => { if (enemy === e) { setStage(id, 3); UI.toast('The keep\'s gate groans open!'); spawnKing(); } });
  };
  const spawnKing = () => { const b = spawnBoss('hollowking', L.bossPos.clone(), R.level + 1); onScript('bossDefeated', ({ key }) => { if (key === 'hollowking') realmComplete(id, 'memory_emberwood'); }); };
  if (stage(id) === 2) spawnGatekeeper();
  if (stage(id) === 3 && !S.realms[id].done) spawnKing();
  // ley-light buff
  R.tick = () => { for (const h of G.party) for (let i = 0; i < 3; i++) if (st()[i] && h.pos.distanceTo(L.stones[i]) < 7) h.addStatus('ley', 0.5); };
  R.markers = () => { const s = stage(id); if (S.realms[id].done) return []; if (s === 0) return [L.camp]; if (s === 1) return L.stones.filter((_, i) => !st()[i]); if (s === 2) return [L.gate]; return [L.bossPos]; };
  refreshObjective(id);
}
function cleanseStone(L, i, silent) {
  const W = G.world; const B = W.palette.findIndex((p) => p && p.c === 0x60f0ff);
  for (const b of L.stoneBlocks[i]) W.set(b[0], b[1], b[2], B);
  zone({ pos: L.stones[i], radius: 7, life: 9999, color: 0x60f0ff, opacity: 0.08 });
  if (!silent) { Audio.play('holy'); ring(L.stones[i], 10, 0x60f0ff, 1); UI.toast('Ley-Stone cleansed! Stand in its light for +25% damage.'); }
}

// NEON — rescue civilians, smash memory erasers, face NULL
function setupNeon(L) {
  const id = 'neon'; const S = G.save; const R = G.realm;
  const N = S.realms[id]; N.civ = N.civ || [false, false, false, false]; N.er = N.er || [false, false, false];
  const civ = () => N.civ.filter(Boolean).length, er = () => N.er.filter(Boolean).length;
  R.objectives = ['Find Spark in the park by the spawn point.', () => `Rescue trapped civilians (${civ()}/4).`, () => `Smash NULL's Memory Erasers on the rooftops (${er()}/3). Use the cyan jump pads!`, 'Confront NULL in the central plaza.'];
  const n = new NPC('spark', NPCS.spark, L.spawn.clone().add(V(4, 0, 4)), { yaw: Math.PI }); addTalk(n);
  // jump pads
  R.tick = () => {
    for (const pad of L.pads) for (const h of G.party) {
      if (h.grounded && Math.abs(h.pos.x - pad.pos.x) < 1.6 && Math.abs(h.pos.z - pad.pos.z) < 1.4 && Math.abs(h.pos.y - pad.pos.y) < 0.6) {
        const tgt = pad.target; const d = tgt.clone().sub(h.pos); const hgt = tgt.y - h.pos.y + 4;
        const vy = Math.sqrt(2 * 30 * (h.gravScale || 1) * hgt); const t = vy / (30 * (h.gravScale || 1)) * 1.7;
        h.vel.y = vy; h.knock.set(d.x / t, 0, d.z / t); h.grounded = false; Audio.play('jump'); burst(h.pos.clone(), 0x3affff, 16, 5, 0.5);
        popText(h.head(), 'BOING!', 'sfx', { color: '#3affff' });
      }
    }
  };
  // civilians
  L.civilians.forEach((p, i) => {
    if (N.civ[i]) return;
    const c = new NPC('civilian', { ...NPCS.civilian, look: { ...NPCS.civilian.look, colors: { ...NPCS.civilian.look.colors, body: [0x4a8ac0, 0xc04a4a, 0x4ac08a, 0xc0a04a][i] } } }, p.clone(), { dialogue: 'civilian' });
    const guards = spawnGroup(p.clone().add(V(3, 0, 3)), 3, R.level, R.pool, 0);
    G.interactables.push({ pos: c.pos, radius: 2.5, label: () => guards.some((g) => !g.dead) ? 'Civilian (defeat the thugs first!)' : 'Rescue the civilian', cond: () => stage(id) >= 1 && !N.civ[i], use: () => {
      if (guards.some((g) => !g.dead)) { UI.toast('Deal with the thugs first!'); return; }
      N.civ[i] = true; UI.dialogue('civilian', c); Audio.play('quest'); UI.grantXp(60 + R.level * 8); S.gold += 25;
      setTimeout(() => { burst(c.center(), 0x3affff, 20, 5); c.remove(); }, 1200);
      if (civ() >= 4) setStage(id, 2); else refreshObjective(id);
    } });
  });
  // erasers
  L.erasers.forEach((e, i) => {
    if (N.er[i]) { G.world.fill(e.pos.x - 1, e.pos.y, e.pos.z - 1, e.pos.x, e.pos.y + 2, e.pos.z, 0); return; }
    spawnGroup(e.pos.clone().add(V(2, 0, 2)), 2, R.level, R.pool, 0.3);
    G.interactables.push({ pos: e.pos, radius: 3, label: () => 'Smash the Memory Eraser', cond: () => stage(id) >= 2 && !N.er[i], use: () => {
      N.er[i] = true; G.world.fill(e.pos.x - 1, e.pos.y, e.pos.z - 1, e.pos.x, e.pos.y + 2, e.pos.z, 0); Audio.play('explode'); burst(e.pos.clone().add(V(0, 1, 0)), [0xffffff, 0x3affff], 40, 8);
      popText(e.pos.clone().add(V(0, 2, 0)), 'KRRSSH!', 'sfx'); UI.grantXp(80 + R.level * 10);
      if (er() >= 3) { setStage(id, 3); spawnNull(); } else refreshObjective(id);
    } });
  });
  const spawnNull = () => { spawnBoss('null', L.bossPos.clone(), R.level + 1); onScript('bossDefeated', ({ key }) => { if (key === 'null') realmComplete(id, 'memory_neon'); }); };
  if (stage(id) === 3 && !N.done) spawnNull();
  R.markers = () => { const s = stage(id); if (N.done) return []; if (s === 0) return [n.pos]; if (s === 1) return L.civilians.filter((_, i) => !N.civ[i]); if (s === 2) return L.erasers.filter((_, i) => !N.er[i]).map((e) => e.pos); return [L.bossPos]; };
  refreshObjective(id);
}

// ASTERION — restore terminals (hold to hack under fire), open the core, stop CARETAKER
function setupAsterion(L) {
  const id = 'asterion'; const S = G.save; const R = G.realm; const N = S.realms[id];
  N.term = N.term || [false, false, false];
  const on = () => N.term.filter(Boolean).length;
  R.objectives = ['Find Ensign Pell in the starting bay.', () => `Restore the power terminals (${on()}/3). Hold [F] to hack.`, 'The core is open. Shut down CARETAKER.'];
  const n = new NPC('pell', NPCS.pell, L.spawn.clone().add(V(4, 0, 4)), { yaw: Math.PI }); addTalk(n);
  const B = G.world.palette.findIndex((p) => p && p.c === 0x40ff80);
  const openCore = () => { for (const b of L.coreDoor) G.world.set(b[0], b[1], b[2], 0); };
  L.terminals.forEach((t, i) => {
    if (N.term[i]) { G.world.set(t.block[0], t.block[1], t.block[2], B); return; }
    G.interactables.push({ pos: t.pos, radius: 2.4, hold: () => S.flags.fasthack ? 2.5 : 4.5, label: () => 'Hack the terminal (hold)', cond: () => stage(id) >= 1 && !N.term[i],
      onHoldStart: () => { if (!R.hackWave) { R.hackWave = true; wave(t.pos, 3 + Math.floor(R.level / 5), ['husk', 'crawler', 'sentry'], () => { R.hackWave = false; }); } },
      use: () => { N.term[i] = true; G.world.set(t.block[0], t.block[1], t.block[2], B); Audio.play('levelup'); UI.toast('Terminal online!'); UI.grantXp(80 + R.level * 10); if (on() >= 3) { setStage(id, 2); openCore(); spawnCare(); } else refreshObjective(id); } });
  });
  const spawnCare = () => { spawnBoss('caretaker', L.bossPos.clone(), R.level + 1); onScript('bossDefeated', ({ key }) => { if (key === 'caretaker') realmComplete(id, 'memory_asterion'); }); };
  if (stage(id) >= 2) { openCore(); if (!N.done) spawnCare(); }
  // low gravity in breached rooms
  R.tick = () => { for (const h of G.party) { const inLow = L.lowG.some((r) => h.pos.x > r.x0 && h.pos.x < r.x1 && h.pos.z > r.z0 && h.pos.z < r.z1); h.gravScale = inLow ? 0.3 : (R.state.grav || 1); if (inLow && !h._lowWarn) { h._lowWarn = true; if (h === G.party[G.activeIndex]) UI.toast('Hull breach: low gravity!'); } } };
  R.markers = () => { const s = stage(id); if (N.done) return []; if (s === 0) return [n.pos]; if (s === 1) return L.terminals.filter((_, i) => !N.term[i]).map((t) => t.pos); return [L.bossPos]; };
  refreshObjective(id);
}

// RIFTS — close tears, kill the Warden, go deeper
function setupRift(L) {
  const S = G.save; const R = G.realm;
  R.closed = 0;
  R.objectives = [() => `Close the Rift tears (${R.closed}/3).`, R.trial ? 'Defeat the Trial Champion.' : 'Defeat the Rift Warden.', 'The rift is stable. Go deeper, or return home.'];
  R.stage = 0;
  S.realms.rift.stage = 0; S.realms.rift.done = false;
  UI.toast('Modifiers: ' + R.mods.map((m) => m.name).join(', '));
  L.tears.forEach((t, i) => {
    let closed = false;
    G.interactables.push({ pos: t.pos.clone().add(V(0, 0, 2)), radius: 3, label: () => closed ? 'Tear (closed)' : 'Close the tear', use: () => {
      if (closed || R.busy) return; R.busy = true; UI.toast('Things pour out of the tear!');
      wave(t.pos, 4 + Math.floor(S.riftDepth / 2), R.pool.common, () => {
        R.busy = false; closed = true; R.closed++;
        const B = G.world.palette.findIndex((p) => p && p.c === 0x3a3a3a); for (const b of t.blocks) G.world.set(b[0], b[1], b[2], B);
        Audio.play('holy'); UI.grantXp(60 + R.level * 8);
        if (R.closed >= 3) { S.realms.rift.stage = 1; refreshObjective('rift'); const b = spawnBoss('warden', L.bossPos.clone(), R.level + 1); if (R.trial) { b.name = `Champion of the ${CLASSES[R.trial.cls].name}'s Trial`; b.title = ['The First Test', 'The Second Test', 'The Final Test'][R.trial.tier - 1]; b.maxHp *= 1 + R.trial.tier * 0.4; b.hp = b.maxHp; } } else refreshObjective('rift');
      });
    } });
  });
  onScript('bossDefeated', ({ key }) => {
    if (key !== 'warden') return;
    if (R.trial) {
      const { cls, tier } = R.trial; S.trials = S.trials || {}; S.trials[cls] = Math.max(S.trials[cls] || 0, tier);
      const L = LEGENDARIES.filter((l) => l.cls === cls)[tier - 1];
      const it = makeLegendary(L.id, R.level); S.inventory.push(it); S.stats.legendary++;
      UI.grantXp(500 + R.level * 40); Audio.play('levelup');
      UI.banner(`TRIAL ${['I', 'II', 'III'][tier - 1]} COMPLETE`, `${CLASSES[cls].name} Legendary earned: ${it.name}. ${it.desc}`, 4500);
      S.realms.rift.stage = 2; R.objectives[2] = 'Trial complete. Return to the Tavern.'; refreshObjective('rift'); G.saveNow?.();
      return;
    }
    S.riftDepth++; S.riftBest = Math.max(S.riftBest, S.riftDepth); S.realms.rift.stage = 2; refreshObjective('rift');
    UI.grantXp(250 + R.level * 30); S.gold += 50 + S.riftDepth * 20;
    UI.banner(`DEPTH ${S.riftDepth} CLEARED`, 'The rift stabilises. A deeper tear opens nearby.');
    UI.riftReward();
    const deeper = L.bossPos.clone().add(V(4, 0, 0)); portalFx(deeper, 0xff3a8a);
    G.interactables.push({ pos: deeper, radius: 2.5, label: () => `Go deeper (Depth ${S.riftDepth + 1})`, use: () => travel('rift') });
    G.saveNow?.();
  });
  R.markers = () => R.closed < 3 ? L.tears.map((t) => t.pos) : [L.bossPos];
  refreshObjective('rift');
}

// THE LOOM — final battle
function setupLoom(L) {
  const S = G.save; const R = G.realm;
  R.objectives = ['Defeat the Unraveller.'];
  setTimeout(() => {
    const b = spawnBoss('unraveller', L.bossPos.clone(), R.level + 2);
    b.aggro = false;
    onScript('bossPhase', ({ phase }) => { const types = ['wisp', 'unwoven']; wave(L.center, 3 + phase, types, () => {}); });
    onScript('bossDefeated', ({ key }) => { if (key === 'unraveller') setTimeout(() => UI.dialogue('ending'), 1800); });
  }, 500);
  R.markers = () => [L.bossPos];
  refreshObjective('loom');
}
