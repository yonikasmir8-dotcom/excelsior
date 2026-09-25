// Loot: rarity tiers, random affixes, realm-flavoured names, and class legendaries with unique effects.
import { rng } from '../core/rng.js';

export const RARITY = [
  { id: 'common', name: 'Common', color: '#c8c4bc', affixes: 1, mult: 1, w: 50 },
  { id: 'uncommon', name: 'Uncommon', color: '#6ad06a', affixes: 2, mult: 1.15, w: 30 },
  { id: 'rare', name: 'Rare', color: '#4aa0ff', affixes: 3, mult: 1.3, w: 14 },
  { id: 'epic', name: 'Epic', color: '#c060ff', affixes: 4, mult: 1.5, w: 5 },
  { id: 'legendary', name: 'Legendary', color: '#ff9a20', affixes: 4, mult: 1.75, w: 1 },
  { id: 'mythic', name: 'Mythic', color: '#ff3a6a', affixes: 5, mult: 2.1, w: 0 },
];
export const rarityOf = (id) => RARITY.find((r) => r.id === id) || RARITY[0];

export const STAT_INFO = {
  power: { name: 'Power', fmt: (v) => `+${v}% damage` },
  hp: { name: 'Vitality', fmt: (v) => `+${v} max HP` },
  ac: { name: 'Armor Class', fmt: (v) => `+${v} AC` },
  crit: { name: 'Keen', fmt: (v) => `Crit range +${v}` },
  critdmg: { name: 'Brutal', fmt: (v) => `+${v}% crit damage` },
  cdr: { name: 'Haste', fmt: (v) => `-${v}% cooldowns` },
  lifesteal: { name: 'Vampiric', fmt: (v) => `${v}% lifesteal` },
  dice: { name: 'Fated', fmt: (v) => `+${v} Fate Die` },
  healing: { name: 'Blessed', fmt: (v) => `+${v}% healing` },
  armor: { name: 'Warded', fmt: (v) => `-${v}% damage taken` },
  nemesis: { name: 'Grudge', fmt: (v) => `+${v}% damage vs Nemeses` },
  speed: { name: 'Swift', fmt: (v) => `+${v}% move speed` },
  meter: { name: 'Initiative', fmt: (v) => `+${v}% Break charge` },
  hit: { name: 'Accurate', fmt: (v) => `+${v} to hit` },
};
const AFFIX_POOL = {
  weapon: ['power', 'power', 'crit', 'critdmg', 'lifesteal', 'hit', 'nemesis', 'cdr', 'meter'],
  armor: ['hp', 'hp', 'ac', 'armor', 'healing', 'speed', 'cdr'],
  trinket: ['dice', 'crit', 'cdr', 'meter', 'healing', 'speed', 'nemesis', 'hit', 'lifesteal'],
};
function affixValue(stat, level, mult) {
  const L = level;
  switch (stat) {
    case 'power': return Math.round((4 + L * 1.2) * mult);
    case 'hp': return Math.round((8 + L * 5) * mult);
    case 'ac': return Math.max(1, Math.round((0.6 + L * 0.08) * mult));
    case 'crit': return mult >= 1.5 ? 2 : 1;
    case 'critdmg': return Math.round((10 + L * 1.5) * mult);
    case 'cdr': return Math.min(25, Math.round((3 + L * 0.3) * mult));
    case 'lifesteal': return Math.min(15, Math.round((2 + L * 0.15) * mult));
    case 'dice': return 1;
    case 'healing': return Math.round((6 + L * 0.8) * mult);
    case 'armor': return Math.min(25, Math.round((3 + L * 0.3) * mult));
    case 'nemesis': return Math.round((10 + L * 1.5) * mult);
    case 'speed': return Math.min(25, Math.round((3 + L * 0.3) * mult));
    case 'meter': return Math.round((8 + L * 0.8) * mult);
    case 'hit': return Math.max(1, Math.round((0.5 + L * 0.06) * mult));
  }
  return 1;
}

const BASES = {
  fantasy: {
    weapon: { fighter: ['Longsword', 'Bastard Sword', 'War Axe'], sorcerer: ['Oak Staff', 'Emberwand', 'Rune Staff'], artificer: ['Brass Wrench', 'Rivet Caster', 'Cog Hammer'], cleric: ['Morningstar', 'Holy Mace', 'Censer Flail'], rogue: ['Twin Dirks', 'Stilettos', 'Kris Blades'], ranger: ['Yew Longbow', 'Hunting Bow', 'Elven Recurve'] },
    armor: ['Chainmail', 'Leather Jerkin', 'Wizard Robes', 'Plate Cuirass', 'Ranger Cloak', 'Studded Vest'],
    trinket: ['Lucky Coin', 'Bone Die', 'Silver Amulet', 'Tavern Token', 'Acorn Charm', 'Runed Ring'],
    pre: ['Hollow', 'Emberforged', 'Ley-touched', 'Old', 'Royal', 'Moss-grown', 'Crowned', 'Wyrmbone'],
  },
  hero: {
    weapon: { fighter: ['Power Gauntlet', 'Starmetal Shield', 'Kinetic Knuckles'], sorcerer: ['Cosmic Focus', 'Mystic Ring', 'Plasma Glove'], artificer: ['Gadget Belt', 'Kinetic Wrench', 'Grapple Launcher'], cleric: ['Justice Baton', 'Beacon Staff', 'Halo Mace'], rogue: ['Shuriken Set', 'Crescent Throwing Blades', 'Retractable Claws'], ranger: ['Trick Bow', 'Compound Bow', 'Holo-Bow'] },
    armor: ['Ballistic Weave', 'Suit of Destiny', 'Armored Trenchcoat', 'Nano-Weave', 'Cape & Cowl', 'Hero Suit Mk II'],
    trinket: ['Secret ID Card', 'Signal Charm', 'Lucky Comic #1', 'Utility Pouch', 'Mask Fragment', 'Radioactive Die'],
    pre: ['Neon', 'Heroic', 'Vigilante', 'Rooftop', 'Gamma', 'Midnight', 'Headline', 'Legendary Team-Up'],
  },
  scifi: {
    weapon: { fighter: ['Plasma Cutter', 'Mag-Blade', 'Riot Shield'], sorcerer: ['Psionic Amp', 'Ion Focus', 'Void Lens'], artificer: ['Omni-Tool', 'Fabricator Gun', 'Drone Remote'], cleric: ['Med-Staff', 'Stim Baton', 'Reactor Mace'], rogue: ['Monofilament Blades', 'Phase Daggers', 'Vibro-Knives'], ranger: ['Rail Bow', 'Flechette Launcher', 'Gauss Longbow'] },
    armor: ['EVA Suit', 'Hardshell Plating', 'Crew Jumpsuit', 'Exo-Frame', 'Stealth Weave', 'Hazard Suit'],
    trinket: ['Data Chip', 'Crew Tag', 'Quantum Die', 'Micro Reactor', 'AI Shard', 'Grav Coin'],
    pre: ['Derelict', 'Quantum', 'Asterion', 'Void-tempered', 'Zero-G', 'Reactor-hot', 'Salvaged', 'Prototype'],
  },
};
const SUFFIX = { power: 'of Ruin', hp: 'of the Bear', ac: 'of Warding', crit: 'of Precision', critdmg: 'of Carnage', cdr: 'of Haste', lifesteal: 'of the Leech', dice: 'of Fortune', healing: 'of Mercy', armor: 'of the Bulwark', nemesis: 'of Vendetta', speed: 'of the Wind', meter: 'of Initiative', hit: 'of the Hawk' };

let uid = Date.now() % 100000;
export function rollItem(level, { boost = 0, realmKind = 'fantasy', classId = null, slot = null, minRarity = 0 } = {}) {
  const tiers = RARITY.slice(0, 5).map((r, i) => ({ ...r, w: r.w * (i >= 2 ? 1 + boost : 1) + (i >= 3 ? boost * 3 : 0) }));
  let rar = rng.weighted(tiers);
  let ri = RARITY.findIndex((r) => r.id === rar.id); ri = Math.max(ri, minRarity); rar = RARITY[ri];
  slot = slot || rng.pick(['weapon', 'armor', 'trinket']);
  const genre = realmKind === 'neon' ? 'hero' : realmKind === 'asterion' ? 'scifi' : realmKind === 'rift' ? rng.pick(['fantasy', 'hero', 'scifi']) : 'fantasy';
  const B = BASES[genre];
  const cls = slot === 'weapon' ? (classId || rng.pick(Object.keys(B.weapon))) : null;
  const base = slot === 'weapon' ? rng.pick(B.weapon[cls]) : rng.pick(B[slot]);
  const stats = {};
  const pool = AFFIX_POOL[slot].slice();
  const n = rar.affixes;
  for (let i = 0; i < n; i++) { const s = rng.pick(pool); stats[s] = (stats[s] || 0) + affixValue(s, level, rar.mult); if (s === 'dice' || s === 'crit') pool.splice(pool.indexOf(s), 1); }
  if (slot === 'weapon' && !stats.power) stats.power = affixValue('power', level, rar.mult);
  if (slot === 'armor' && !stats.hp) stats.hp = affixValue('hp', level, rar.mult);
  const main = Object.keys(stats).sort((a, b) => stats[b] - stats[a])[0];
  const name = (ri >= 2 ? rng.pick(B.pre) + ' ' : '') + base + (ri >= 1 ? ' ' + SUFFIX[main] : '');
  return { uid: ++uid, name, slot, cls, rarity: rar.id, level, stats, value: Math.round((10 + level * 4) * rar.mult * rar.mult) };
}

// Class legendaries — each changes how the class plays, not just its numbers.
export const LEGENDARIES = [
  { id: 'l_fighter_1', cls: 'fighter', slot: 'weapon', name: 'Oathkeeper', flag: 'cleave_wave', desc: 'Cleave also launches a shockwave that travels 10m.', stats: { power: 30, crit: 1 } },
  { id: 'l_fighter_2', cls: 'fighter', slot: 'armor', name: 'The Unyielding Plate', flag: 'grit_armor', desc: 'At full Grit you take 30% less damage.', stats: { hp: 120, ac: 3 } },
  { id: 'l_fighter_3', cls: 'fighter', slot: 'trinket', name: 'Tavern Brawler\'s Tankard', flag: 'charge_reset', desc: 'Shield Charge kills refund its cooldown.', stats: { power: 15, meter: 20 } },
  { id: 'l_sorcerer_1', cls: 'sorcerer', slot: 'weapon', name: 'Staff of Three Suns', flag: 'triple_firebolt', desc: 'Firebolt splits into three bolts.', stats: { power: 30, cdr: 8 } },
  { id: 'l_sorcerer_2', cls: 'sorcerer', slot: 'trinket', name: 'The Prism Die', flag: 'chicken_luck', desc: 'Your first Attunement change in each fight adds a Fate Die to your hand.', stats: { dice: 1, crit: 1 } },
  { id: 'l_sorcerer_3', cls: 'sorcerer', slot: 'armor', name: 'Robes of Infinite Pockets', flag: 'blink_twice', desc: 'Blink has two charges.', stats: { hp: 80, cdr: 10 } },
  { id: 'l_artificer_1', cls: 'artificer', slot: 'weapon', name: 'The Brassika Special', flag: 'turret_tesla', desc: 'Turrets are always Tesla Towers.', stats: { power: 25, cdr: 8 } },
  { id: 'l_artificer_2', cls: 'artificer', slot: 'trinket', name: 'Pocket Reactor', flag: 'grenade_cluster', desc: 'Arc Grenades split into 3 cluster bombs.', stats: { power: 15, meter: 25 } },
  { id: 'l_artificer_3', cls: 'artificer', slot: 'armor', name: 'Exo-Rig "Clanky"', flag: 'bot_revive', desc: 'Your Repair Bot revives downed allies it reaches.', stats: { hp: 100, armor: 10 } },
  { id: 'l_cleric_1', cls: 'cleric', slot: 'weapon', name: 'Dawnbreaker Mace', flag: 'mace_nova', desc: 'Every third mace hit releases a healing nova.', stats: { power: 25, healing: 20 } },
  { id: 'l_cleric_2', cls: 'cleric', slot: 'trinket', name: 'Maren\'s Lost Locket', flag: 'faith_full', desc: 'Start every fight with full Faith.', stats: { healing: 30, dice: 1 } },
  { id: 'l_cleric_3', cls: 'cleric', slot: 'armor', name: 'Vestments of the Weave', flag: 'sanct_move', desc: 'Sanctuary follows you.', stats: { hp: 110, ac: 2 } },
  { id: 'l_rogue_1', cls: 'rogue', slot: 'weapon', name: 'Whisper & Scream', flag: 'shadow_double', desc: 'Shadowstep strikes twice.', stats: { power: 30, critdmg: 40 } },
  { id: 'l_rogue_2', cls: 'rogue', slot: 'trinket', name: 'Snake-Eyes Pair', flag: 'snake_eyes', desc: 'Natural 1s on Fate Dice become natural 20s.', stats: { dice: 2 } },
  { id: 'l_rogue_3', cls: 'rogue', slot: 'armor', name: 'Cloak of Many Exits', flag: 'smoke_cd', desc: 'Smoke Bomb cooldown halved.', stats: { hp: 70, speed: 15 } },
  { id: 'l_ranger_1', cls: 'ranger', slot: 'weapon', name: 'Horizon, the Last Bow', flag: 'ricochet', desc: 'Arrows ricochet to a second target.', stats: { power: 30, hit: 2 } },
  { id: 'l_ranger_2', cls: 'ranger', slot: 'trinket', name: 'Bramble\'s Collar', flag: 'giant_wolf', desc: 'Your wolf is twice the size and deals double damage.', stats: { power: 15, lifesteal: 6 } },
  { id: 'l_ranger_3', cls: 'ranger', slot: 'armor', name: 'Mantle of the Wild Hunt', flag: 'volley_snare', desc: 'Volley also snares enemies.', stats: { hp: 80, cdr: 10 } },
];
export function makeLegendary(id, level) {
  const L = LEGENDARIES.find((l) => l.id === id);
  const stats = {}; for (const [k, v] of Object.entries(L.stats)) stats[k] = k === 'dice' || k === 'crit' ? v : Math.round(v * (1 + level * 0.06));
  return { uid: ++uid, name: L.name, slot: L.slot, cls: L.cls, rarity: 'legendary', level, stats, flag: L.flag, desc: L.desc, legendaryId: L.id, value: 300 + level * 20 };
}
export function randomLegendary(level, classIds) {
  const pool = LEGENDARIES.filter((l) => classIds.includes(l.cls));
  return makeLegendary(rng.pick(pool.length ? pool : LEGENDARIES).id, level);
}
export function itemPower(it) { if (!it) return 0; let s = 0; for (const v of Object.values(it.stats)) s += v; return Math.round(s * rarityOf(it.rarity).mult); }
