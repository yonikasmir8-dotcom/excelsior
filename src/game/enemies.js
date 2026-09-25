// Enemy archetypes per realm. Behaviour is chosen by `ai`; everything telegraphs before it hurts.
export const ENEMY_TYPES = {
  // tutorial
  dummy:    { name: 'Training Dummy', ai: 'none', hp: 400, dmg: '1d1', ac: 8, speed: 0, xp: 0, model: { kind: 'humanoid', colors: { skin: 0xc8a860, body: 0xb09050, legs: 0x8a7040, accent: 0x6a4a2a, hair: 0xd8c070 }, extras: ['harness'] } },
  cellarRat:{ name: 'Cellar Goblin', ai: 'melee', hp: 14, dmg: '1d4', ac: 9, speed: 4.5, xp: 15, model: { kind: 'humanoid', scale: 0.7, colors: { skin: 0x6a9a3a, body: 0x5a3a2a, legs: 0x3a2a1a, accent: 0x8a6a3a, eye: 0xffe040 }, weapon: 'club', hat: 'bandana' } },
  // ── Emberwood (fantasy) ──
  goblin:   { name: 'Hollow Goblin', ai: 'melee', hp: 30, dmg: '1d6+2', ac: 11, speed: 5.5, xp: 12, model: { kind: 'humanoid', scale: 0.75, colors: { skin: 0x6a9a3a, body: 0x5a3a2a, legs: 0x3a2a1a, accent: 0x8a6a3a, eye: 0xffe040 }, weapon: 'club', hat: 'bandana' } },
  archer:   { name: 'Bramble Archer', ai: 'ranged', hp: 24, dmg: '1d8+1', ac: 12, speed: 5, xp: 14, proj: 0xa0d060, model: { kind: 'humanoid', scale: 0.9, colors: { skin: 0x8aa060, body: 0x3a5a2a, legs: 0x2a3a1a, accent: 0x6a4a2a, eye: 0xffe040 }, weapon: 'bow', hat: 'hood', extras: ['quiver'] } },
  wolf:     { name: 'Dire Wolf', ai: 'melee', hp: 26, dmg: '1d8+1', ac: 12, speed: 8.5, xp: 12, attack: 'bite', model: { kind: 'beast', scale: 0.9, colors: { body: 0x4a4048, skin: 0x2a2028, eye: 0xff4040 }, glowEyes: 0xff3030 } },
  shaman:   { name: 'Mushroom Shaman', ai: 'caster', hp: 28, dmg: '1d10+2', ac: 11, speed: 4.5, xp: 18, heals: true, proj: 0xc070ff, model: { kind: 'blob', scale: 0.9, colors: { body: 0xe0d0b0, accent: 0xd03a3a }, hat: 'mushroom', glowEyes: 0xc070ff } },
  troll:    { name: 'Stone Troll', ai: 'brute', hp: 110, dmg: '2d10+4', ac: 13, speed: 4.2, xp: 45, elite: true, knockResist: 0.8, model: { kind: 'giant', scale: 1.7, bulk: 1.3, colors: { skin: 0x7a8a8a, body: 0x5a6a6a, legs: 0x4a5a5a, accent: 0x3a4a4a, eye: 0xff8030 }, weapon: 'club', extras: ['spikes'] } },
  skeleton: { name: 'Forgotten Knight', ai: 'melee', hp: 40, dmg: '1d10+2', ac: 14, speed: 5, xp: 18, model: { kind: 'humanoid', colors: { skin: 0xe8e0c8, body: 0x6a6a7a, legs: 0x5a5a6a, accent: 0x9aa4b0, eye: 0x40c0ff }, glowEyes: 0x40c0ff, weapon: 'sword', hat: 'helm', extras: ['shield'] } },
  // ── Neon Meridian (superhero) ──
  punk:     { name: 'Chrome Punk', ai: 'melee', hp: 32, dmg: '1d8+2', ac: 11, speed: 6, xp: 12, model: { kind: 'humanoid', colors: { skin: 0xd09070, body: 0x1a1a2a, legs: 0x2a2a4a, accent: 0xff3a8a, hat: 0xff3a8a }, weapon: 'baton', hat: 'mohawk' } },
  goon:     { name: 'Laser Goon', ai: 'ranged', hp: 28, dmg: '1d8+2', ac: 12, speed: 5, xp: 14, proj: 0xff3050, model: { kind: 'humanoid', colors: { skin: 0xc08060, body: 0x3a3a4a, legs: 0x2a2a3a, accent: 0xffd020, visor: 0xff3050 }, weapon: 'gun', hat: 'visor' } },
  drone:    { name: 'Surveillance Drone', ai: 'ranged', hp: 22, dmg: '1d6+2', ac: 13, speed: 6, xp: 14, flying: true, proj: 0xff40ff, model: { kind: 'drone', colors: { body: 0x2a2a3a, accent: 0xff40ff }, glowEyes: 0xff40ff } },
  mime:     { name: 'Mime-Tech Assassin', ai: 'blinker', hp: 30, dmg: '1d10+3', ac: 14, speed: 7, xp: 20, model: { kind: 'humanoid', colors: { skin: 0xf8f8f8, body: 0x111111, legs: 0x111111, accent: 0xffffff, eye: 0x111111 }, weapon: 'daggers', hat: 'tophat' } },
  mech:     { name: 'Brute Mech', ai: 'brute', hp: 120, dmg: '2d10+4', ac: 15, speed: 4, xp: 50, elite: true, knockResist: 0.9, model: { kind: 'giant', scale: 1.8, bulk: 1.4, colors: { skin: 0x6a6a7a, body: 0xd0a020, legs: 0x3a3a4a, accent: 0x1a1a1a }, weapon: 'shieldfist', hat: 'visor', extras: ['chestlight'] } },
  // ── Asterion (sci-fi) ──
  husk:     { name: 'Crew Husk', ai: 'melee', hp: 34, dmg: '1d8+2', ac: 11, speed: 5, xp: 12, model: { kind: 'humanoid', colors: { skin: 0x8ab0a0, body: 0xd06a20, legs: 0x5a5a60, accent: 0x40ffd0, eye: 0x40ffd0 }, glowEyes: 0x40ffd0, extras: ['chestlight'] } },
  sentry:   { name: 'Sentry Bot', ai: 'ranged', hp: 30, dmg: '1d10+1', ac: 13, speed: 3.5, xp: 15, proj: 0x40ffd0, model: { kind: 'drone', scale: 1.1, colors: { body: 0xd0d8e0, accent: 0x3a4a5a }, glowEyes: 0x40ffd0 } },
  crawler:  { name: 'Vent Crawler', ai: 'melee', hp: 20, dmg: '1d6+2', ac: 12, speed: 9, xp: 10, attack: 'bite', model: { kind: 'beast', scale: 0.7, colors: { body: 0x3a5a4a, skin: 0x2a3a30, eye: 0x40ffd0 }, glowEyes: 0x80ff40, extras: ['spikes'] } },
  nanite:   { name: 'Nanite Swarm', ai: 'caster', hp: 26, dmg: '1d10+2', ac: 12, speed: 4.5, xp: 18, flying: true, proj: 0x80ff40, model: { kind: 'blob', scale: 0.8, colors: { body: 0x2a3a3a, accent: 0x80ff40 }, glowEyes: 0x80ff40 } },
  loader:   { name: 'Loader Mech', ai: 'brute', hp: 130, dmg: '2d10+5', ac: 15, speed: 3.8, xp: 55, elite: true, knockResist: 0.9, model: { kind: 'giant', scale: 1.9, bulk: 1.5, colors: { skin: 0x5a5a60, body: 0xe0a020, legs: 0x3a3a40, accent: 0x1a1a1a }, weapon: 'claws', hat: 'dome', extras: ['chestlight'] } },
  // ── Rift / Loom ──
  wisp:     { name: 'Thread Wisp', ai: 'ranged', hp: 26, dmg: '1d10+2', ac: 13, speed: 6, xp: 16, flying: true, proj: 0xffffff, model: { kind: 'drone', scale: 0.8, colors: { body: 0xf0f0f0, accent: 0xff3a8a }, glowEyes: 0xff3a8a } },
  unwoven:  { name: 'Unwoven', ai: 'blinker', hp: 38, dmg: '1d12+3', ac: 14, speed: 7, xp: 22, model: { kind: 'humanoid', colors: { skin: 0xf8f8f8, body: 0xe8e8e8, legs: 0xd0d0d0, accent: 0xff3a8a, eye: 0xff3a8a }, glowEyes: 0xff3a8a, hat: 'mask' } },
};

export const REALM_POOLS = {
  emberwood: { common: ['goblin', 'goblin', 'archer', 'wolf', 'shaman', 'skeleton'], elite: ['troll'] },
  neon: { common: ['punk', 'punk', 'goon', 'drone', 'mime'], elite: ['mech'] },
  asterion: { common: ['husk', 'husk', 'sentry', 'crawler', 'nanite'], elite: ['loader'] },
  rift: { common: ['goblin', 'archer', 'punk', 'goon', 'husk', 'sentry', 'wisp', 'unwoven', 'mime', 'wolf'], elite: ['troll', 'mech', 'loader'] },
  loom: { common: ['wisp', 'unwoven', 'unwoven', 'wisp'], elite: ['troll', 'mech', 'loader'] },
};
