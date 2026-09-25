// The Forgotten Tavern — entry point. Boots the renderer, wires the game API, runs the loop.
import * as THREE from 'three';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import { G, activeHero } from './core/state.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { FantasyRenderer } from './core/renderer.js';
import { on } from './core/events.js';
import { UI } from './ui/ui.js';
import { buildDialogues } from './content/dialogue.js';
import { CHAT } from './content/banter.js';
import { NPCS, COMPANIONS } from './content/npcs.js';
import { CLASSES } from './game/classes.js';
import { REALMS, loadLocation, travel, compModel, questHint, refreshObjective, makeSky } from './game/realms.js';
import { updateEffects, updatePopupsFrame, FX, initEffects } from './game/effects.js';
import { updateCombat, newCombatState } from './game/combat.js';
import { updateCompanion } from './game/ai.js';
import { initPlayer, updatePlayer, updateCamera, resetCamera, Cam } from './game/player.js';
import { initProgress, grantXp, updatePickups } from './game/progress.js';
import { rollItem, randomLegendary } from './game/loot.js';
import { newSave, saveGame, loadGame, slotInfo, deleteSave, loadSettings, saveSettings } from './game/save.js';
import { revealTrait, fullName, TRAITS, RANKS, ensureWarband } from './game/nemesis.js';
import { genTavern } from './world/gen.js';
import { VoxelModel } from './entities/model.js';

// ── boot ──
loadSettings();
const post = new FantasyRenderer(document.getElementById('game'));
G.post = post; G.renderer = post.renderer;
G.scene = new THREE.Scene();
G.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 900);
post.build(G.scene, G.camera);
G.combat = newCombatState();
G.mode = 'title';
Input.init(post.renderer.domElement);
UI.init();
initProgress();

let memberSeq = Date.now() % 1e6;
function newMember({ name, classId, look = {}, isPlayer = false, companionId = null, longHair, scale }) {
  const L = G.save ? G.save.party.level : 1;
  const weapon = rollItem(Math.max(1, L - 1), { slot: 'weapon', classId, minRarity: 0 }); weapon.rarity = 'common';
  const armor = rollItem(Math.max(1, L - 1), { slot: 'armor', minRarity: 0 }); armor.rarity = 'common';
  return { id: 'm' + (++memberSeq), name, classId, look, isPlayer, companionId, longHair, scale, talents: {}, gear: { weapon, armor, trinket: null }, tactic: 'balanced' };
}

// ── API used by dialogue + UI ──
let lastDiceText = '';
const API = {
  save: () => G.save,
  heal: () => { for (const h of G.party) { h.downed = false; h.hp = h.maxHp; } Audio.play('heal'); },
  flag: (k, v) => { G.save.flags[k] = v; },
  unlockDoor: (k) => { G.save.doors[k] = true; },
  questLog: (t) => UI.objective(t),
  pick: (a) => a[Math.floor(Math.random() * a.length)],
  gold: (n) => { G.save.gold = Math.max(0, G.save.gold + n); Audio.play('coin'); },
  openShop: () => setTimeout(() => UI.openShop(), 50),
  openForge: () => setTimeout(() => UI.openForge(), 50),
  heroName: () => G.save.members[0].name,
  buyIntel: () => {
    const caps = G.save.nemesis.captains.filter((c) => c.alive && c.traits.some((t) => !c.known.includes(t)));
    if (!caps.length) return 'I know everything there is to know about every captain out there. Which is to say: you know it too. Keep your gold.';
    G.save.gold -= 40; const c = caps[Math.floor(Math.random() * caps.length)]; const t = revealTrait(c);
    return `Word is ${fullName(c)} is ${TRAITS[t].name}. ${TRAITS[t].desc} That one's on the Wanted Wall now.`;
  },
  bardSong: () => {
    const S = G.save; const h = S.members[0].name;
    const deeds = [];
    if (S.realms.emberwood?.done) deeds.push(`how ${h} put the Hollow King back in his grave`);
    if (S.realms.neon?.done) deeds.push(`how ${h} made Neon Meridian remember its heroes`);
    if (S.realms.asterion?.done) deeds.push(`how ${h} tucked the CARETAKER into its own sleep`);
    if (S.nemesis.slain.length) deeds.push(`how ${S.nemesis.slain[S.nemesis.slain.length - 1].name} fell`);
    if (S.stats.nat20 > 5) deeds.push(`about the ${S.stats.nat20} natural twenties`);
    return deeds.length ? `🎵 Gather round and hear ${API.pick(deeds)}! 🎵 ...It's a working title.` : 'I\'m Lute, the finest bard in any realm. Currently between epics. Do something worth singing about and I\'ll make you famous.';
  },
  bardRumor: () => {
    const caps = G.save.nemesis.captains.filter((c) => c.alive);
    if (!caps.length) return 'No captains worth gossiping about. Yet.';
    const c = caps.sort((a, b) => b.rank - a.rank)[0];
    if (!G.save.flags['rumor_' + c.id]) { G.save.flags['rumor_' + c.id] = 1; const t = revealTrait(c); if (t) return `They say ${fullName(c)}, a ${RANKS[c.rank]} of ${c.realm}, is ${TRAITS[t].name}. ${TRAITS[t].desc} Free of charge, because it rhymes.`; }
    return `${fullName(c)} has been bragging in every realm. "${c.history[c.history.length - 1].text}" I'd watch my back.`;
  },
  diceGame: (bet, cheat) => {
    const me = 1 + Math.floor(Math.random() * 20) + (cheat ? 5 : 0), him = 1 + Math.floor(Math.random() * 20);
    Audio.play('dice');
    if (me > him) { G.save.gold += bet; lastDiceText = `You rolled ${me}, Rollo rolled ${him}. You WIN ${bet * 2}g! "Beginner's luck," he grumbles.`; }
    else { G.save.gold -= bet; lastDiceText = `You rolled ${me}, Rollo rolled ${him}. ${me === him ? 'Tie goes to the house!' : 'House wins!'} He pockets your ${bet}g.`; }
  },
  lastDice: () => lastDiceText,
  buyFood: (id) => { G.save.gold -= 30; G.save.buff = { id, name: { hearty: 'Hearty Stew (+20% HP)', chili: 'Dragon Chili (+12% damage)', pie: 'Lucky Pie (+2 Fate Dice)' }[id] }; Audio.play('coin'); },
  inParty: (cid) => { const m = G.save.members.find((x) => x.companionId === cid); return !!(m && G.save.active.includes(m.id)); },
  partyFull: () => G.save.active.length >= 4 && !G.save._justJoined,
  companionChat: (cid) => CHAT[cid] || ['...'],
  recruit: (cid) => {
    const S = G.save; S._justJoined = false;
    let m = S.members.find((x) => x.companionId === cid);
    const C = COMPANIONS[cid];
    if (!m) { m = newMember({ name: C.name, classId: C.classId, look: C.look, companionId: cid, longHair: C.longHair, scale: C.scale }); S.members.push(m); }
    if (S.active.length >= 4) return;
    S.active.push(m.id); S._justJoined = true; Audio.play('quest');
    UI.toast(`${C.name} joins the party!`);
    setTimeout(() => { if (G.location === 'tavern') API.reloadTavern(); }, 50);
  },
  dismiss: (cid) => { const S = G.save; const m = S.members.find((x) => x.companionId === cid); if (!m) return; S.active = S.active.filter((x) => x !== m.id); setTimeout(() => API.reloadTavern(), 50); },
  advance: (realm, fromStage) => { const r = G.save.realms[realm]; if (r && r.stage === fromStage) { r.stage = fromStage + 1; Audio.play('quest'); refreshObjective(realm); } },
  ending: (kind) => { G.save.ending = kind; G.save.flags.ending = 1; G.pendingEnding = kind; API.saveNow(); },
  trialLabel: (c) => { const t = (G.save.trials?.[c] || 0) + 1; return `The ${CLASSES[c].name}'s Trial ${['I', 'II', 'III'][t - 1] || ''} (needs level ${[6, 14, 22][t - 1]})`; },
  trialAvailable: (c) => { const t = (G.save.trials?.[c] || 0); return t < 3 && G.save.party.level >= [6, 14, 22][t] && G.save.active.some((id) => G.save.members.find((m) => m.id === id)?.classId === c); },
  startTrial: (c) => { const tier = (G.save.trials?.[c] || 0) + 1; setTimeout(() => UI.realmIntro('rift', () => travel('rift', { trial: { cls: c, tier } })), 300); },
  latestSlot: () => { let best = null, bt = -1; for (const i of [1, 2, 3]) { const s = loadGame(i); if (s && (s.savedAt || s.created) > bt) { bt = s.savedAt || s.created; best = i; } } return best; },
  canQuit: () => !!window.electronAPI,
  quit: () => { API.saveNow(); window.electronAPI?.quit(); },
  version: __APP_VERSION__,
  // UI-facing
  grantXp: (n) => grantXp(n),
  slotInfo, deleteSave, saveSettings,
  skillBonus: (skill) => { let b = 0; for (const h of G.party) b = Math.max(b, (h.cls.skill[skill] || 0)); return b + Math.floor(G.save.party.level / 4); },
  reloadTavern: () => { const p = activeHero()?.pos.clone(); loadLocation('tavern'); if (p) G.party.forEach((h, i) => h.pos.copy(p).add(new THREE.Vector3(i * 0.8, 0.2, 0))); resetCamera(); },
  randomLegendary: () => randomLegendary(G.save.party.level, G.save.active.map((id) => G.save.members.find((m) => m.id === id).classId)),
  realms: REALMS,
  saveNow: () => { if (G.save) { saveGame(G.slot); } },
  travel: (k) => travel(k),
  newGame: (slot, hero) => {
    G.slot = slot; G.save = newSave(null);
    const m = newMember({ ...hero, isPlayer: true }); G.save.members = [m]; G.save.active = [m.id];
    ensureWarband('emberwood', 2); ensureWarband('neon', 4); ensureWarband('asterion', 6);
    startPlaying('tavern');
  },
  continueGame: (slot) => { const s = loadGame(slot); if (!s) return; G.slot = slot; G.save = s; startPlaying('tavern'); },
};
API.dialogues = buildDialogues(API);
UI.api = API;
G.saveNow = () => API.saveNow();

function startPlaying(loc) {
  Audio.unlock();
  UI.fade(() => { loadLocation(loc); initPlayer(); resetCamera(); UI.toast('Click to capture the mouse. Press Esc for the menu.'); Input.lock(); });
}

// ── portraits: render each NPC's voxel head once ──
function makePortraits() {
  const scene = new THREE.Scene(); scene.background = null;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x604050, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(1, 1, 2); scene.add(d);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  const rt = new THREE.WebGLRenderTarget(128, 128); const buf = new Uint8Array(128 * 128 * 4);
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const ctx = cv.getContext('2d');
  const all = [...Object.entries(NPCS).map(([id, n]) => [id, n.look, n.color]), ...Object.entries(COMPANIONS).map(([id, c]) => [id, { kind: 'humanoid', ...compModel(id), scale: 1 }, c.color])];
  for (const [id, look, color] of all) {
    const m = new VoxelModel({ ...look, scale: 1 }); scene.add(m.root); m.update(0.01, false, 0, true);
    cam.position.set(0.9, 2.05, 2.6); cam.lookAt(0, 1.72, 0);
    G.renderer.setRenderTarget(rt); G.renderer.setClearColor(new THREE.Color(color), 1); G.renderer.clear(); G.renderer.render(scene, cam);
    G.renderer.readRenderTargetPixels(rt, 0, 0, 128, 128, buf);
    const img = ctx.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const s = ((127 - y) * 128 + x) * 4, t = (y * 128 + x) * 4; img.data[t] = buf[s]; img.data[t + 1] = buf[s + 1]; img.data[t + 2] = buf[s + 2]; img.data[t + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    // halftone overlay for comic feel
    ctx.fillStyle = 'rgba(20,12,24,0.18)'; for (let y = 0; y < 128; y += 5) for (let x = (y / 5) % 2 ? 2 : 0; x < 128; x += 5) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 6.3); ctx.fill(); }
    UI.setPortrait(id, cv.toDataURL());
    scene.remove(m.root); m.dispose();
  }
  G.renderer.setRenderTarget(null);
}

// ── title backdrop: the tavern, slowly orbiting ──
function titleBackdrop() {
  const { W, layout } = genTavern();
  G.world = W; W.buildAll(); G.scene.add(W.group);
  const def = REALMS.tavern;
  const sky = makeSky(def); G.scene.add(sky);
  G.scene.background = new THREE.Color(def.sky[1]); G.scene.fog = new THREE.Fog(def.fog[0], def.fog[1], def.fog[2]);
  const hemi = new THREE.HemisphereLight(def.amb, 0x3a2a30, def.hemi); const s = new THREE.DirectionalLight(def.sun, def.sunI); s.position.set(60, 80, 40); s.target.position.set(32, 0, 32);
  s.castShadow = true; s.shadow.mapSize.set(2048, 2048); const sc = s.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.far = 220;
  G.scene.add(hemi, s, s.target);
  for (const L of layout.lights) { const pl = new THREE.PointLight(L.color, L.intensity, L.dist, 1.6); pl.position.copy(L.pos); G.scene.add(pl); }
  post.setStyle('tavern');
  G.titleLights = G.scene.children.filter((c) => c.isLight || c.isObject3D && c.type === 'Object3D').concat([sky]);
  initEffects();
}

// ── keys ──
addEventListener('keydown', (e) => {
  UI.handleKey(e);
  if (G.mode !== 'play') { if (e.code === 'Escape') UI.closeModal(); return; }
  if (e.code === 'Escape') { if (UI.blocking()) UI.closeModal(); else UI.pause(); return; }
  if (UI.blocking() || G.inBreak) return;
  if (e.code === 'KeyI') UI.openInventory(); if (e.code === 'KeyK') UI.openTalents(); if (e.code === 'KeyJ') UI.openJournal(); if (e.code === 'KeyP') UI.openParty();
});
// release the tavern stage lights once play begins
on('locationLoaded', () => { if (G.titleLights) { G.titleLights.forEach((l) => G.scene.remove(l)); G.titleLights = null; } });

// world ambience: sun + shadows follow the hero, roofs lift when you step inside, lamps flicker, storms flash
let stormT = 6;
function ambience(dt) {
  const h = activeHero();
  if (G.sun && h) { const d = G.sun.userData.dir; G.sun.target.position.copy(h.pos); G.sun.position.copy(h.pos).addScaledVector(d, 90); }
  if (G.roof && G.inside && h) { const i = G.inside; const inside = h.pos.x > i.x0 && h.pos.x < i.x1 + 1 && h.pos.z > i.z0 && h.pos.z < i.z1 + 1; G.roof.material.opacity = THREE.MathUtils.lerp(G.roof.material.opacity ?? 1, inside ? 0 : 1, Math.min(1, dt * 6)); G.roof.material.transparent = true; G.roof.visible = G.roof.material.opacity > 0.02; }
  for (const l of G.scene.children) if (l.isPointLight && l.userData.flicker) l.intensity = l.userData.base * (0.85 + Math.sin(G.realTime * 11 + l.id) * 0.06 + Math.random() * 0.09);
  if (G.realm?.storm && G.hemi) {
    stormT -= dt; if (stormT <= 0) { stormT = 5 + Math.random() * 9; G.stormFlash = 1; setTimeout(() => Audio.play('thunder'), 300 + Math.random() * 900); }
    G.stormFlash = Math.max(0, (G.stormFlash || 0) - dt * 3); G.hemi.intensity = (REALMS[G.location]?.hemi ?? 1.1) + G.stormFlash * (Math.random() < 0.5 ? 2.5 : 1);
  }
}

// ── loop ──
let last = performance.now(), saveT = 0, titleT = 0, frameNo = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dtReal = Math.min(0.05, (now - last) / 1000); last = now;
  G.realTime += dtReal;
  if (G.mode === 'title') {
    titleT += dtReal * 0.08;
    G.camera.position.set(32 + Math.cos(titleT) * 34, 17, 32 + Math.sin(titleT) * 34); G.camera.lookAt(32, 7, 32);
  } else if (G.mode === 'play' && G.save) {
    let scale = G.paused ? 0 : G.timeScale;
    if (FX.hitstop > 0) { FX.hitstop -= dtReal; scale *= 0.05; }
    const dt = dtReal * scale;
    if (!G.paused && !UI.blocking()) updatePlayer(dt);
    if (dt > 0) {
      G.time += dt;
      let slot = 0;
      G.party.forEach((h, i) => { if (i !== G.activeIndex) updateCompanion(h, dt, slot++); });
      const me = activeHero(); const far2 = 75 * 75; frameNo++;
      for (const e of G.entities.slice()) {
        if (e.dead) continue;
        // sleep distant idle enemies: skip most updates and hide them past the fog
        if (e.team === 'enemy' && !e.aggro && me) {
          const d2 = e.pos.distanceToSquared(me.pos);
          if (e.model) e.model.root.visible = d2 < 110 * 110;
          if (d2 > far2 && (frameNo + e.id) % 8 !== 0) continue;
        }
        e.update(dt);
      }
      updateEffects(dt); updateCombat(dt); updatePickups();
      G.realm?.tick?.(dt);
      G.save.playTime += dt;
    }
    G.world?.update();
    ambience(dtReal);
    updateCamera(dtReal);
    UI.update(dtReal);
    saveT += dtReal; if (saveT > 45) { saveT = 0; API.saveNow(); }
  }
  updatePopupsFrame(dtReal);
  post.render(G.scene, G.camera, dtReal);
  Input.endFrame();
}

titleBackdrop();
try { makePortraits(); } catch (e) { console.warn('portraits failed', e); }
UI.title();
requestAnimationFrame(frame);
window.__G = G; window.__API = API; window.__UI = UI; // debug handles
import * as _ai from './game/ai.js'; import * as _fx from './game/effects.js'; import * as _cb from './game/combat.js'; import * as _rl from './game/realms.js'; import * as _bs from './game/bosses.js';
window.__M = { ai: _ai, fx: _fx, combat: _cb, realms: _rl, bosses: _bs };
