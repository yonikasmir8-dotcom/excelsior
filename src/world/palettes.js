// Building materials per realm. Each entry is a tint over a painted texture (see textures.js).
// Terrain is not in here: it is a smooth heightfield coloured per realm in gen.js.
function pal(list) { const p = [null]; const idx = {}; list.forEach(([name, def]) => { idx[name] = p.length; p.push(def); }); return { p, B: idx }; }
const INV = { c: 0, invisible: true };

export const PALETTES = {
  tavern: pal([
    ['plank', { c: 0xb08058, tex: 'plank', scale: 4 }], ['darkplank', { c: 0x7a5236, tex: 'plank', scale: 4 }], ['stone', { c: 0xa8a098, tex: 'stone', scale: 3 }], ['cobble', { c: 0x9a948c, tex: 'cobble', scale: 3 }],
    ['beam', { c: 0x5a3a24, tex: 'bark', scale: 2 }], ['plaster', { c: 0xe8d8b8, tex: 'plaster', scale: 4 }], ['rug', { c: 0xffffff, tex: 'rug', scale: 9 }],
    ['glass', { c: 0x9ad0e0, alpha: true }], ['roof', { c: 0xb86a4a, tex: 'roof', scale: 3 }], ['inv', INV],
    ['doorE', { c: 0xffa040, glow: true, emissive: 2.5 }], ['doorN', { c: 0x4a8aff, glow: true, emissive: 2.5 }], ['doorA', { c: 0x3affd0, glow: true, emissive: 2.5 }], ['doorR', { c: 0xc06aff, glow: true, emissive: 2.5 }], ['doorL', { c: 0xffffff, glow: true, emissive: 2.5 }],
    ['board', { c: 0xd8c090, tex: 'plank', scale: 2 }], ['stage', { c: 0x8a3a4a, tex: 'plank', scale: 3 }], ['gold', { c: 0xd0a040, tex: 'metal', metal: 0.8, rough: 0.35, scale: 2 }],
  ]),
  emberwood: pal([
    ['brick', { c: 0xa09a90, tex: 'stone', scale: 3 }], ['darkstone', { c: 0x6a6670, tex: 'stone', scale: 3 }], ['cobble', { c: 0x8a847a, tex: 'cobble', scale: 3 }],
    ['ley', { c: 0x60f0ff, glow: true, emissive: 3 }], ['leycorrupt', { c: 0xc02060, glow: true, emissive: 2.5 }],
    ['banner', { c: 0x6a1a2a, tex: 'plaster', scale: 2 }], ['tent', { c: 0xc0a07a, tex: 'plaster', scale: 2 }], ['wood', { c: 0x8a6040, tex: 'plank', scale: 3 }],
    ['inv', INV], ['gold', { c: 0xd8a830, tex: 'metal', metal: 0.85, rough: 0.3, scale: 2 }], ['fire', { c: 0xff8a2a, glow: true, emissive: 3 }], ['roof', { c: 0x6a3a3a, tex: 'roof', scale: 3 }],
  ]),
  neon: pal([
    ['street', { c: 0x4a4a52, tex: 'cobble', scale: 3 }], ['walk', { c: 0xb0aca4, tex: 'stone', scale: 2 }], ['line', { c: 0xd8b040, tex: 'plaster', scale: 2 }],
    ['marble', { c: 0xece6dc, tex: 'marble', scale: 6 }], ['stoneA', { c: 0xa8a4a0, tex: 'stone', scale: 4 }], ['stoneB', { c: 0x8a7a8a, tex: 'stone', scale: 4 }], ['stoneC', { c: 0x9a8a70, tex: 'stone', scale: 4 }],
    ['win', { c: 0xffc870, glow: true, emissive: 1.6 }], ['winB', { c: 0x9ad8ff, glow: true, emissive: 1.4 }], ['winOff', { c: 0x2a2a38, tex: 'plaster', rough: 0.3, scale: 2 }],
    ['neonP', { c: 0xff4aa0, glow: true, emissive: 3 }], ['neonC', { c: 0x4ae8ff, glow: true, emissive: 3 }], ['neonY', { c: 0xffd84a, glow: true, emissive: 3 }], ['neonG', { c: 0x8aff5a, glow: true, emissive: 3 }],
    ['roof', { c: 0x6a6a74, tex: 'stone', scale: 4 }], ['gold', { c: 0xd8a830, tex: 'metal', metal: 0.85, rough: 0.3, scale: 2 }],
    ['car1', { c: 0x8a2a2a, tex: 'metal', metal: 0.6, rough: 0.35 }], ['car2', { c: 0x2a4a8a, tex: 'metal', metal: 0.6, rough: 0.35 }], ['car3', { c: 0xc0a040, tex: 'metal', metal: 0.6, rough: 0.35 }],
    ['pad', { c: 0x4ae8ff, glow: true, emissive: 2.5 }], ['eraser', { c: 0xffffff, glow: true, emissive: 3 }], ['glass', { c: 0x80c0e0, alpha: true }], ['inv', INV], ['billboard', { c: 0xff8a3a, glow: true, emissive: 2 }],
  ]),
  asterion: pal([
    ['hull', { c: 0x8a96a4, tex: 'metal', metal: 0.5, rough: 0.5, scale: 4 }], ['floor', { c: 0x5a6068, tex: 'metal', metal: 0.4, rough: 0.6, scale: 3 }], ['panel', { c: 0xd8dce4, tex: 'marble', scale: 5 }],
    ['stripe', { c: 0xd8a030, tex: 'plaster', scale: 2 }], ['red', { c: 0xff4050, glow: true, emissive: 2.5 }], ['cyan', { c: 0x40ffd0, glow: true, emissive: 2.5 }], ['light', { c: 0xd8f0ff, glow: true, emissive: 2 }],
    ['pipe', { c: 0xb07a4a, tex: 'metal', metal: 0.8, rough: 0.35, scale: 2 }], ['glass', { c: 0x80e0ff, alpha: true }],
    ['terminal', { c: 0x40ff80, glow: true, emissive: 2.5 }], ['terminalOff', { c: 0x3a3a3a, tex: 'metal', scale: 2 }], ['core', { c: 0xff3040, glow: true, emissive: 3 }], ['coreDoor', { c: 0xffa020, glow: true, emissive: 2 }],
    ['inv', INV],
  ]),
  loom: pal([
    ['white', { c: 0xf4f0ec, tex: 'marble', scale: 8 }], ['thread1', { c: 0xff4a9a, glow: true, emissive: 2.5 }], ['thread2', { c: 0x4affd8, glow: true, emissive: 2.5 }], ['thread3', { c: 0xffa04a, glow: true, emissive: 2.5 }], ['thread4', { c: 0xc07aff, glow: true, emissive: 2.5 }],
    ['grey', { c: 0xb8b4b0, tex: 'stone', scale: 3 }], ['gold', { c: 0xffd84a, glow: true, emissive: 1.8 }], ['inv', INV],
    ['grass', { c: 0x7a9a4a, tex: 'plaster', scale: 3 }], ['street', { c: 0x4a4a52, tex: 'cobble', scale: 3 }], ['hull', { c: 0x8a96a4, tex: 'metal', metal: 0.5, scale: 3 }],
  ]),
};

export const RIFT_THEMES = [
  { name: 'Shattered Moonfields', low: 0x5a5a7a, high: 0xb8b8d8, rock: 0x6a6a80, sky: [0x0a0a2a, 0x5a4a8a], fog: 0x3a3a6a, accent: 0xc0c8ff, trees: 'deadtree', crystal: 0 },
  { name: 'Ashen Wastes', low: 0x4a3a34, high: 0x8a6a5a, rock: 0x3a3030, sky: [0x2a0a0a, 0xa04a2a], fog: 0x6a3a2a, accent: 0xff7a3a, trees: 'deadtree', crystal: 2 },
  { name: 'Crystal Hollows', low: 0x4a5a6a, high: 0x8aa0b0, rock: 0x5a6a7a, sky: [0x0a1a3a, 0x3a8ab0], fog: 0x3a6a8a, accent: 0x60f0ff, trees: 'pine', crystal: 0 },
  { name: 'Feywild Bloom', low: 0x4a7a3a, high: 0xa0c060, rock: 0x7a8a6a, sky: [0x3a1a5a, 0xffa0c0], fog: 0xc08ab0, accent: 0xff8ad0, trees: 'tree', crystal: 1 },
  { name: 'Frostwild', low: 0x8a9aa8, high: 0xf0f4f8, rock: 0x7a8490, sky: [0x3a5a8a, 0xd0e0f0], fog: 0xb0c4d8, accent: 0x9ae8ff, trees: 'pine', crystal: 0 },
  { name: 'Storm-Torn Steppes', low: 0x5a6a4a, high: 0x9aa070, rock: 0x6a6a60, sky: [0x1a2030, 0x6a7a90], fog: 0x4a5a6a, accent: 0xaef4ff, trees: 'deadtree', crystal: 0 },
  { name: 'Clockwork Ruins', low: 0x8a6a3a, high: 0xc8a060, rock: 0x7a6a50, sky: [0x3a2a1a, 0xe0a060], fog: 0x9a7a4a, accent: 0xffb040, trees: 'deadtree', crystal: 2 },
  { name: 'Neon Jungle', low: 0x1a4a2a, high: 0x3a8a4a, rock: 0x2a3a30, sky: [0x0a0a1a, 0x4a1a5a], fog: 0x1a2a3a, accent: 0xff4aa0, trees: 'tree', crystal: 1 },
];
export function riftPalette(rng) {
  const t = rng.pick(RIFT_THEMES);
  return { theme: t, ...pal([
    ['stone', { c: 0xa09a94, tex: 'stone', scale: 3 }], ['tear', { c: 0xff3a8a, glow: true, emissive: 3 }], ['tearOff', { c: 0x3a3a3a, tex: 'stone', scale: 2 }],
    ['ruin', { c: t.rock, tex: 'stone', scale: 3 }], ['glowA', { c: t.accent, glow: true, emissive: 2.5 }], ['inv', { c: 0, invisible: true }], ['hull', { c: 0x8a96a4, tex: 'metal', metal: 0.5, scale: 3 }],
  ]) };
}
