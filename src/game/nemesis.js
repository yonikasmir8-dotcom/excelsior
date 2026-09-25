// The Nemesis system: named captains who remember you. They get promoted when they
// down a hero or survive, cheat death with new scars, adapt to what hurt them, and
// taunt you with your shared history. Fallen captains are replaced by those who witnessed it.
import { G } from '../core/state.js';
import { Rng } from '../core/rng.js';
import { emit } from '../core/events.js';

const r = new Rng();
export const TRAITS = {
  fireproof:     { name: 'Fireproof', good: true, desc: 'Immune to fire damage.', resist: { fire: 0 } },
  grounded:      { name: 'Grounded', good: true, desc: 'Immune to lightning.', resist: { lightning: 0 } },
  thick_hide:    { name: 'Thick Hide', good: true, desc: 'Takes half damage from arrows and knives.', resist: { pierce: 0.5, slash: 0.75 } },
  blessed_armor: { name: 'Profane Ward', good: true, desc: 'Takes half holy damage.', resist: { holy: 0.5 } },
  vengeful:      { name: 'Vengeful', good: true, desc: 'Enrages below 50% health: faster and deadlier.' },
  coward:        { name: 'Coward', good: false, desc: 'Flees when badly hurt, and returns stronger.' },
  dice_curse:    { name: 'Dice-Cursed', good: true, desc: 'Destroys your two best Fate Dice when the fight starts.' },
  shield_bearer: { name: 'Shield-Bearer', good: true, desc: 'Blocks most frontal damage. Hit from behind!' },
  teleporter:    { name: 'Blink-Step', good: true, desc: 'Teleports behind its target.' },
  summoner:      { name: 'Warband Leader', good: true, desc: 'Calls reinforcements when hurt.' },
  regenerator:   { name: 'Regenerator', good: true, desc: 'Regenerates health unless burning or bleeding.' },
  berserker:     { name: 'Berserker', good: true, desc: 'Deals 40% more damage, has 2 less AC.' },
  iron_will:     { name: 'Iron Will', good: true, desc: 'Cannot be stunned, snared or taunted.' },
  critproof:     { name: 'Uncrittable', good: true, desc: 'Critical hits do not affect it.' },
  rift_walker:   { name: 'Rift-Walker', good: true, desc: 'Can hunt you in any realm.' },
  // weaknesses
  fear_fire:     { name: 'Fears Fire', good: false, desc: 'Takes double fire damage.', resist: { fire: 2 } },
  fear_beasts:   { name: 'Fears Beasts', good: false, desc: 'Beast attacks stun it for twice as long.' },
  glass_jaw:     { name: 'Glass Jaw', good: false, desc: 'Critical hits deal triple damage.' },
  holy_weak:     { name: 'Unholy', good: false, desc: 'Takes double holy damage.', resist: { holy: 2 } },
  overconfident: { name: 'Overconfident', good: false, desc: 'Takes 50% more damage for the first 6 seconds.' },
  shock_weak:    { name: 'Conductive', good: false, desc: 'Takes double lightning damage.', resist: { lightning: 2 } },
};
const COUNTER = { fire: 'fireproof', lightning: 'grounded', pierce: 'thick_hide', slash: 'thick_hide', holy: 'blessed_armor', shadow: 'critproof', blast: 'iron_will', bite: 'iron_will', tech: 'iron_will', blunt: 'iron_will' };
const GOOD = Object.keys(TRAITS).filter((k) => TRAITS[k].good && k !== 'rift_walker');
const BAD = Object.keys(TRAITS).filter((k) => !TRAITS[k].good);

const NAMES = {
  emberwood: { first: ['Grukk', 'Skarn', 'Morgra', 'Vex', 'Thrag', 'Ulna', 'Brakka', 'Gorm', 'Nix', 'Hesk', 'Rotgut', 'Snikt', 'Old Tallow', 'Maw'], title: ['Bone-Chewer', 'of the Hollow Crown', 'Twice-Buried', 'the Grudge-Keeper', 'Tooth-Taker', 'the Mossy', 'Crow-Friend', 'the Unlucky', 'Oathbreaker'] },
  neon: { first: ['Doctor Static', 'Captain Spite', 'Lady Blackout', 'Kid Kaboom', 'Baron Chrome', 'Mister Nullwave', 'The Headline', 'Madame Glitch', 'Big Rerun', 'Retcon'], title: ['the Supervillain', 'of the Evening News', 'Menace to Society', 'the Relaunched', 'Issue #1', 'the Cancelled', 'Crossover Event'] },
  asterion: { first: ['KX-9 "Grinder"', 'Warden Holt', 'Unit Sable', 'Chief Voss', 'Subroutine Mara', 'Hull-Eater', 'Specimen 12', 'Ensign Rook', 'Deck-Boss Ivo'], title: ['the Recompiled', 'of Deck Nine', 'the Airlock', 'Reactor-Born', 'the Unrecycled', 'Last of Shift C'] },
  rift: { first: ['The Stitched', 'Many-Faced Oru', 'Hollowhand', 'Seamstress Kell', 'Knot', 'Frayed Jack'], title: ['of Nowhere', 'the Between', 'Loose Thread', 'the Unwritten'] },
};
const TYPE_FOR = { emberwood: ['goblin', 'troll', 'skeleton', 'archer', 'shaman'], neon: ['punk', 'mech', 'goon', 'mime'], asterion: ['husk', 'loader', 'sentry', 'crawler'], rift: ['unwoven', 'troll', 'mech', 'loader'] };
export const RANKS = ['Captain', 'Warlord', 'Overlord', 'NEMESIS'];
const EXTRAS = ['scar', 'eyepatch', 'metaljaw', 'bandage'];

export function newCaptain(realm, level, witness = null) {
  const N = NAMES[realm] || NAMES.rift;
  let name; do { name = r.pick(N.first); } while (G.save.nemesis.captains.some((c) => c.alive && c.name === name) && Math.random() < 0.9);
  const traits = [r.pick(GOOD), r.pick(BAD)];
  if (Math.random() < 0.4) { const t = r.pick(GOOD); if (!traits.includes(t)) traits.push(t); }
  const c = {
    id: ++G.save.nemesis.nextId, name, title: r.pick(N.title), realm, type: r.pick(TYPE_FOR[realm] || TYPE_FOR.rift), level, rank: 0,
    traits, known: [], scars: [], history: [], alive: true, kills: 0, encounters: 0, escapes: 0, deaths: 0, grudge: null, hue: Math.random(),
  };
  if (witness) c.history.push({ e: 'rose', text: `Rose to power after watching you defeat ${witness}.` });
  else c.history.push({ e: 'rose', text: 'Leads a warband in ' + realmName(realm) + '.' });
  G.save.nemesis.captains.push(c);
  return c;
}
export function realmName(k) { return { emberwood: 'Emberwood Reach', neon: 'Neon Meridian', asterion: 'the Asterion', rift: 'the Rifts', loom: 'the Loom' }[k] || k; }
export function fullName(c) { return `${c.name} ${c.title}`; }
export function ensureWarband(realm, level) {
  const alive = G.save.nemesis.captains.filter((c) => c.alive && c.realm === realm);
  for (let i = alive.length; i < 4; i++) newCaptain(realm, level + r.int(0, 2));
}
// Pick captains to appear in this realm visit.
export function captainsFor(realm, count) {
  const pool = G.save.nemesis.captains.filter((c) => c.alive && (c.realm === realm || (c.traits.includes('rift_walker') && Math.random() < 0.5)));
  pool.sort((a, b) => b.rank - a.rank + (Math.random() - 0.5) * 2);
  return pool.slice(0, count);
}
function remember(c, e, text) { c.history.push({ e, text }); if (c.history.length > 12) c.history.splice(1, 1); }
function addTrait(c, good = true) {
  const pool = (good ? GOOD : BAD).filter((t) => !c.traits.includes(t));
  if (!pool.length) return null; const t = r.pick(pool); c.traits.push(t); return t;
}
function promote(c, lv, why) {
  c.level += lv;
  const old = c.rank;
  if (c.rank < RANKS.length - 1 && (c.kills + c.escapes + c.deaths) >= (c.rank + 1) * 1.5) c.rank++;
  const t = addTrait(c, true);
  emit('nemesisPromoted', { c, why, trait: t, rankUp: c.rank > old });
}
// ── events ──
export function onCaptainDownedHero(c, hero) {
  c.kills++; c.grudge = hero.classId;
  remember(c, 'kill', `Struck down ${hero.name} the ${hero.cls.name}.`);
  promote(c, 1, `downed ${hero.name}`);
}
export function onPartyWipe(c) {
  c.kills++; remember(c, 'wipe', 'Defeated your entire party.'); promote(c, 2, 'defeated your party');
  if (c.rank < 3) c.rank = Math.min(3, c.rank + 1);
}
export function onCaptainFled(c, dmgType) {
  c.escapes++;
  const counter = COUNTER[dmgType];
  let learned = null;
  if (counter && !c.traits.includes(counter)) { c.traits.push(counter); learned = counter; }
  const scar = EXTRAS.find((x) => !c.scars.includes(x)); if (scar) c.scars.push(scar);
  remember(c, 'fled', `Escaped you, scarred.${learned ? ' Swore never to be hurt by ' + dmgType + ' again.' : ''}`);
  promote(c, 1, 'escaped');
  emit('nemesisLearned', { c, trait: learned });
}
// returns true if the captain cheats death
export function onCaptainKilled(c, byHero, dmgType) {
  c.deaths++;
  const cheat = (c.rank >= 1 && Math.random() < 0.45) || (c.traits.includes('regenerator') && Math.random() < 0.5) || (c.deaths === 1 && Math.random() < 0.25);
  if (cheat && c.deaths < 4) {
    const scar = EXTRAS.find((x) => !c.scars.includes(x)); if (scar) c.scars.push(scar);
    const counter = COUNTER[dmgType]; if (counter && !c.traits.includes(counter)) c.traits.push(counter);
    remember(c, 'cheated', `Was left for dead by ${byHero ? byHero.name : 'you'}... and crawled back.`);
    c.level += 1; c.grudge = byHero ? byHero.classId : c.grudge;
    if (c.deaths >= 2 && !c.traits.includes('rift_walker')) c.traits.push('rift_walker');
    emit('nemesisCheated', { c });
    return true;
  }
  c.alive = false;
  remember(c, 'died', `Slain by ${byHero ? byHero.name : 'your party'}.`);
  G.save.nemesis.slain.push({ name: fullName(c), realm: c.realm, by: byHero ? byHero.name : 'the party' });
  // a witness rises to take their place
  const heir = newCaptain(c.realm, c.level, fullName(c));
  if (Math.random() < 0.5) heir.traits.push(r.pick(GOOD.filter((t) => !heir.traits.includes(t))));
  emit('nemesisSlain', { c, heir });
  return false;
}
export function revealTrait(c) {
  const hidden = c.traits.filter((t) => !c.known.includes(t)); if (!hidden.length) return null;
  const t = r.pick(hidden); c.known.push(t); return t;
}
// ── taunts ──
export function taunt(c) {
  const last = c.history[c.history.length - 1];
  const hero = G.party.find((h) => h.classId === c.grudge);
  const lines = [];
  if (c.encounters === 0) lines.push(`So you're the ones Maren sends. I'll be the story they tell about you.`, `Fresh meat from the Tavern! My warband's been bored.`, `Another hero? Let's see what you're made of.`);
  if (last?.e === 'kill' && hero) lines.push(`${hero.name}! Back for another beating, ${hero.cls.name}?`, `I still have ${hero.name}'s tooth. Want it back?`);
  if (last?.e === 'wipe') lines.push(`Last time I dropped your whole party. Did you bring better friends?`, `You again? I've been telling everyone how you screamed.`);
  if (last?.e === 'fled') lines.push(`You gave me this scar. Now I'll give you one.`, `I ran. I trained. I'm not running this time.`);
  if (last?.e === 'cheated') lines.push(`Surprised? You should have made sure.`, `Death spat me out. It didn't like the taste.`, `I came back from the dark for YOU.`);
  if (c.scars.includes('metaljaw')) lines.push(`*CLANK* Like my new jaw? I had it forged from the sword you left in me.`);
  if (c.rank >= 3) lines.push(`Every realm knows my name now. Because of you.`);
  if (c.traits.includes('fireproof') && c.known.includes('fireproof')) lines.push(`Go on, sorcerer. Burn me. I dare you.`);
  return r.pick(lines.length ? lines : [`Hah!`]);
}
export function killBrag(c, hero) { return r.pick([`Stay down, ${hero.cls.name}!`, `One for the trophy wall!`, `${hero.name} falls! Who's next?`]); }
export function fleeLine(c) { return r.pick([`This isn't over!`, `I'll remember this!`, `Retreat! RETREAT!`, `You'll see me again. Count on it.`]); }
export function captainScale(c) { return 1.2 + c.rank * 0.12; }
