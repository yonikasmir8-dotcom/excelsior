// Progression glue: XP & levels, gold and loot drops, Nemesis reactions, party wipes, banter.
import * as THREE from 'three';
import { G, activeHero } from '../core/state.js';
import { on, emit } from '../core/events.js';
import { Audio } from '../core/audio.js';
import { rollItem, randomLegendary, rarityOf } from './loot.js';
import { popText, burst, timed } from './effects.js';
import { styleRank, STYLE_RANKS, startCombat } from './combat.js';
import { xpForLevel, MAX_LEVEL } from '../entities/hero.js';
import { onCaptainDownedHero, onPartyWipe, onCaptainFled, onCaptainKilled, taunt, killBrag, fullName, TRAITS } from './nemesis.js';
import { BANTER } from '../content/banter.js';
import { UI } from '../ui/ui.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function grantXp(n) {
  const S = G.save; if (S.party.level >= MAX_LEVEL) return;
  S.party.xp += Math.round(n);
  let leveled = false;
  while (S.party.level < MAX_LEVEL && S.party.xp >= xpForLevel(S.party.level)) { S.party.xp -= xpForLevel(S.party.level); S.party.level++; leveled = true; }
  if (leveled) {
    Audio.play('levelup');
    for (const h of G.party) { h.recompute(); h.hp = h.maxHp; if (!h.downed) burst(h.center(), 0xffd23a, 30, 6, 1, 0.25, 2); }
    const L = S.party.level; const unlock = G.party.flatMap((h) => h.cls.abilities.filter((a) => a.lvl === L).map((a) => `${h.name}: ${a.name}`));
    UI.banner(`LEVEL ${L}!`, (unlock.length ? 'New abilities! ' + unlock.join(', ') + '. ' : '') + 'Talent points available [K].');
    setTimeout(() => tip('level'), 3200);
  }
}

export function dropItem(pos, item) {
  const col = new THREE.Color(rarityOf(item.rarity).color);
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: col }));
  const beamM = new THREE.Mesh(new THREE.BoxGeometry(0.12, 6, 0.12), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false }));
  beamM.position.y = 3; g.add(box, beamM); g.position.copy(pos); g.position.y = G.world.groundBelow(pos.x, pos.y + 2, pos.z) + 0.4;
  G.scene.add(g);
  const p = { item, pos: g.position, g };
  G.pickups.push(p);
  G.effects.push({ obj: g, t: 0, update(dt) { this.t += dt; box.rotation.y += dt * 2; box.position.y = Math.sin(this.t * 3) * 0.15; return !p.taken; }, dispose() { G.scene.remove(g); } });
}
export function updatePickups() {
  const h = activeHero(); if (!h) return;
  for (const p of G.pickups) {
    if (p.taken) continue;
    if (G.party.some((x) => !x.downed && x.pos.distanceTo(p.pos) < 1.8)) {
      p.taken = true; G.save.inventory.push(p.item); Audio.play('loot');
      popText(p.pos.clone().add(V(0, 1, 0)), p.item.name, 'loot', { color: rarityOf(p.item.rarity).color });
      UI.lootToast(p.item); tip('loot');
      if (p.item.rarity === 'legendary') { G.save.stats.legendary++; UI.banner('LEGENDARY!', p.item.name + ' — ' + (p.item.desc || '')); }
    }
  }
  G.pickups = G.pickups.filter((p) => !p.taken);
}
function lootBoost() { return (G.realm?.state?.lootBoost || 0) + (G.location === 'rift' ? G.save.riftDepth * 0.15 : 0); }
function classIds() { return G.party.map((h) => h.classId); }
function randCls() { const c = classIds(); return c[Math.floor(Math.random() * c.length)]; }

const TIPS = {
  combat: 'FATE DICE rolled! Scroll the mouse wheel to pick a die, press X to arm it, and your next attack uses that roll. Save the 19s and 20s for big moments.',
  meter: 'Your BREAK meter is full! Press TAB to freeze time and plan a combo for the whole party.',
  captain: 'That was a NEMESIS. Captains remember you. If they down a hero or escape, they get stronger. Check the Wanted Wall in your Journal (J).',
  level: 'Level up! Press K to spend talent points. Every class has two specialisations and a keystone at the bottom.',
  loot: 'Loot! Walk over drops to grab them, then press I to equip. Weapons are class-specific.',
  teamup: 'TEAM-UP! Certain abilities from different heroes combine. The Journal (J) lists every one you\'ve found.',
  lowdice: 'Tip: press Z to SACRIFICE a low Fate Die. The lower the die, the more Break charge you get.',
  down: 'A hero is down! Stand next to them and hold F to revive, or let a companion do it.',
};
export function tip(k) { const S = G.save; if (!S || S.flags['tip_' + k]) return; S.flags['tip_' + k] = 1; UI.toast('💡 ' + TIPS[k], 7000); }

export function initProgress() {
  on('combatStart', () => { tip('combat'); if (G.save?.stats.kills > 12) tip('lowdice'); });
  on('styleUp', () => { if (G.combat.meter >= 100) tip('meter'); });
  on('damage', () => { if (G.combat.meter >= 100) tip('meter'); });
  on('captainEncounter', () => setTimeout(() => tip('captain'), 3000));
  on('teamup', () => setTimeout(() => tip('teamup'), 2200));
  on('heroDown', () => tip('down'));
  on('enemyKilled', ({ enemy, by }) => {
    const S = G.save; S.stats.kills++;
    grantXp(enemy.xp);
    const killer = by?.isMinion ? by.owner : by;
    killer?.onKill?.(enemy);
    const gold = Math.round((2 + Math.random() * 4) * (1 + enemy.level * 0.3) * (enemy.isElite ? 3 : 1));
    S.gold += gold; popText(enemy.head(), `+${gold}g`, 'info', { color: '#ffd23a' });
    if (Math.random() < 0.06) { S.potions++; popText(enemy.head().add(V(0, 0.5, 0)), '+1 Potion', 'heal'); }
    const L = G.realm.level;
    if (enemy.isBoss) {
      dropItem(enemy.pos.clone(), rollItem(L + 1, { boost: 2 + lootBoost(), realmKind: G.realm.kind, classId: randCls(), minRarity: 3 }));
      if (Math.random() < 0.6 || enemy.bossKey === 'unraveller') dropItem(enemy.pos.clone().add(V(2, 0, 0)), randomLegendary(L + 1, classIds()));
      else dropItem(enemy.pos.clone().add(V(2, 0, 0)), rollItem(L + 1, { boost: 2, realmKind: G.realm.kind, minRarity: 2 }));
    } else if (enemy.isElite) dropItem(enemy.pos.clone(), rollItem(L, { boost: 0.6 + lootBoost(), realmKind: G.realm.kind, classId: randCls(), minRarity: 1 }));
    else if (Math.random() < 0.09 + lootBoost() * 0.03) dropItem(enemy.pos.clone(), rollItem(L, { boost: lootBoost(), realmKind: G.realm.kind, classId: randCls() }));
  });
  on('crit', ({ src, roll }) => { if (src?.team === 'party') { G.save.stats.crits++; if (roll === 20) G.save.stats.nat20++; if (Math.random() < 0.2) banter('crit', src); } });
  on('combatEnd', ({ best, kills }) => {
    G.save.flags.inspired = 0;
  });
  on('combatStart', () => {
    if (G.save.flags.inspired) G.combat.meter = Math.max(G.combat.meter, 10);
    for (const h of G.party) if (h.gearFlag('faith_full')) h.faith = 100;
    const cursed = G.entities.find((e) => e.captain && e.aggro && e.trait('dice_curse'));
    if (cursed && G.combat.dice.length) { G.combat.dice.sort((a, b) => a - b); G.combat.dice.splice(-2, 2); cursed.reveal('dice_curse'); UI.toast(`${cursed.name} curses your two best Fate Dice!`); }
  });
  on('heroDown', ({ hero, by }) => {
    G.save.stats.deaths++;
    const cap = by && by.captain ? by : (by?.isMinion ? null : null);
    if (cap) { onCaptainDownedHero(cap.captain, hero); popText(cap.head(), killBrag(cap.captain, hero), 'speech', { life: 2.5 }); }
    banter('down', hero, true);
    if (G.party.every((h) => h.downed)) partyWipe(by);
  });
  on('captainEncounter', ({ enemy, c }) => {
    const line = taunt(c); c.encounters++;
    if (c.traits.includes('overconfident')) enemy.born = G.time;
    Audio.play('nemesis'); G.timeScale = 0.25;
    UI.nemesisIntro(c, line, () => { G.timeScale = 1; });
    banter('nemesis');
  });
  on('captainDefeated', ({ enemy, c, by, type }) => {
    const hero = by?.isMinion ? by.owner : by;
    const cheated = onCaptainKilled(c, hero, type || 'blunt');
    UI.nemesisOutcome(c, cheated ? 'cheated' : 'slain');
    dropItem(enemy.pos.clone(), rollItem(c.level, { boost: 1 + c.rank + lootBoost(), realmKind: G.realm.kind, classId: randCls(), minRarity: 2 + Math.min(2, c.rank) }));
    if (c.rank >= 2 && !cheated) dropItem(enemy.pos.clone().add(V(1.5, 0, 0)), randomLegendary(c.level, classIds()));
    grantXp(enemy.xp * 0.5);
  });
  on('captainFled', ({ c, type }) => { onCaptainFled(c, type); UI.nemesisOutcome(c, 'fled'); });
  on('nemesisPromoted', ({ c, why, trait, rankUp }) => { UI.toast(`${fullName(c)} grows stronger (${why})${trait ? ': gains ' + TRAITS[trait].name : ''}${rankUp ? '. Rank up!' : ''}`); });
  on('critFx', () => UI.speedlines(true));
  on('dashFx', () => UI.speedlines(false));
  on('teamup', ({ tu, first }) => { UI.speedlines(true); UI.teamupBanner(tu, first); banter('teamup'); });
  on('bossEncounter', () => { banter('boss'); Audio.music('combat'); });
  on('bossDefeated', () => { Audio.music(G.realm.music); });
  on('banter', ({ ev, fallback }) => { if (!banter(ev)) banter(fallback); });
  on('damage', ({ tgt }) => { if (tgt.team === 'party' && !tgt.isMinion && tgt.hp / tgt.maxHp < 0.3 && !tgt._lowT) { tgt._lowT = true; setTimeout(() => (tgt._lowT = false), 12000); banter('low', tgt, true); } });
  on('traitRevealed', ({ c, t }) => UI.toast(`Intel: ${c.name} is ${TRAITS[t].name}. ${TRAITS[t].desc}`));
}

let lastBanter = 0;
export function banter(ev, who = null, force = false) {
  if (!force && G.realTime - lastBanter < 7) return false;
  const pool = G.party.filter((h) => h.data.companionId && !h.downed && BANTER[h.data.companionId]?.[ev]);
  const speaker = who && who.data?.companionId && BANTER[who.data.companionId]?.[ev] ? who : pool[Math.floor(Math.random() * pool.length)];
  if (!speaker) return false;
  const lines = BANTER[speaker.data.companionId][ev];
  lastBanter = G.realTime;
  popText(speaker.head().add(V(0, 0.4, 0)), lines[Math.floor(Math.random() * lines.length)], 'speech', { life: 2.8 });
  return true;
}

function partyWipe(by) {
  const S = G.save;
  const killer = by && by.captain ? by.captain : G.entities.find((e) => e.captain && e.aggro && !e.dead)?.captain;
  if (killer) onPartyWipe(killer);
  const lost = Math.floor(S.gold * 0.15); S.gold -= lost;
  Audio.play('down');
  UI.wipe(killer, lost, () => { import('./realms.js').then((m) => m.travel('tavern')); });
}
export { grantXp as xp };
