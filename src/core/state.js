// Shared game context. Every system reads and writes through G so modules stay decoupled.
export const G = {
  scene: null, camera: null, renderer: null, post: null,
  world: null,          // VoxelWorld for the current location
  realm: null,          // current realm definition
  location: 'title',    // 'title' | 'tavern' | realm id
  entities: [],         // all live actors (party, enemies, npcs)
  effects: [],          // transient visual / gameplay effects
  party: [],            // Actor[] (index 0..3)
  activeIndex: 0,
  time: 0,              // game time (scaled)
  realTime: 0,
  timeScale: 1,
  paused: false,
  inBreak: false,
  inDialogue: false,
  combat: null,         // combat session state (dice hand, style, meter)
  save: null,           // persistent save data object
  settings: { volume: 0.6, music: 0.5, sens: 1, postfx: true, camera: 'third', difficulty: 'normal' },
  debug: false,
};

export function activeHero() { return G.party[G.activeIndex]; }
