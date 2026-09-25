// Player settings: defaults, persistence, key bindings and live application (graphics, accessibility).
import { G } from './state.js';

export const DEFAULT_KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', walk: 'ControlLeft', jump: 'Space', dash: 'ShiftLeft',
  attack: 'Mouse0', mechanic: 'Mouse2', ab1: 'KeyQ', ab2: 'KeyE', ab3: 'KeyC', ult: 'KeyR',
  interact: 'KeyF', potion: 'KeyH', break: 'Tab', dieArm: 'KeyX', dieSacrifice: 'KeyZ', camera: 'KeyV',
  inventory: 'KeyI', talents: 'KeyK', journal: 'KeyJ', party: 'KeyP',
};
export const ACTION_LABELS = {
  forward: 'Move forward', back: 'Move back', left: 'Move left', right: 'Move right', walk: 'Walk (hold)', jump: 'Jump', dash: 'Dodge',
  attack: 'Basic attack', mechanic: 'Class signature', ab1: 'Ability 1', ab2: 'Ability 2', ab3: 'Ability 3', ult: 'Ultimate',
  interact: 'Interact / revive', potion: 'Drink potion', break: 'Initiative Break', dieArm: 'Arm Fate Die', dieSacrifice: 'Sacrifice Fate Die', camera: 'First/third person',
  inventory: 'Inventory', talents: 'Talents', journal: 'Journal', party: 'Party',
};
export const DEFAULTS = {
  v: 2,
  // audio
  volume: 0.6, music: 0.5,
  // gameplay
  difficulty: 'normal', enemyDamage: 1, enemyHealth: 1, timing: 1, toggleHold: false, camera: 'third',
  // controls
  sens: 1, invertY: false, keys: { ...DEFAULT_KEYS },
  // graphics
  quality: null, fps: false, fov: 58, postfx: true,
  // accessibility
  uiScale: 1, textScale: 1, reduceFlashing: false, shake: 1, colorblind: 'none', highContrast: false, threatCues: true,
  seenNotice: false,
};
export const QUALITY = {
  low:    { pixelRatio: 0.85, shadows: 0, bloom: false, grass: 0.2, props: 0.6, label: 'Low' },
  medium: { pixelRatio: 1, shadows: 1024, bloom: true, grass: 0.5, props: 0.85, label: 'Medium' },
  high:   { pixelRatio: 1.25, shadows: 2048, bloom: true, grass: 1, props: 1, label: 'High' },
  ultra:  { pixelRatio: 1.5, shadows: 4096, bloom: true, grass: 1.4, props: 1, label: 'Ultra' },
};
export const CB_TELEGRAPH = { none: null, protan: 0xffb000, deutan: 0xffb000, tritan: 0xff3aa0 };

export function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('forgotten-tavern-settings') || '{}'); } catch (e) { saved = {}; }
  Object.assign(G.settings, JSON.parse(JSON.stringify(DEFAULTS)), saved);
  G.settings.keys = { ...DEFAULT_KEYS, ...(saved.keys || {}) };
  G.settings.v = DEFAULTS.v;
}
export function saveSettings() { try { localStorage.setItem('forgotten-tavern-settings', JSON.stringify(G.settings)); } catch (e) {} }
export function quality() { return QUALITY[G.settings.quality] || QUALITY.high; }
export function keyName(code) {
  if (!code) return '—';
  if (code.startsWith('Mouse')) return ['Left mouse', 'Middle mouse', 'Right mouse', 'Mouse 4', 'Mouse 5'][+code.slice(5)] || code;
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' (L)').replace('Right', ' (R)').replace('Arrow', '');
}

// Apply everything that can change live.
export function applySettings() {
  const S = G.settings, root = document.documentElement;
  root.style.setProperty('--ui-scale', S.uiScale);
  root.style.setProperty('--text-scale', S.textScale);
  document.body.classList.toggle('hc', !!S.highContrast);
  const q = quality();
  if (G.renderer) {
    G.renderer.setPixelRatio(Math.min(devicePixelRatio, q.pixelRatio));
    G.renderer.shadowMap.enabled = q.shadows > 0;
    G.post?.resize();
    if (G.post?.bloom) G.post.bloom.enabled = q.bloom;
  }
  if (G.sun) { G.sun.castShadow = q.shadows > 0; if (q.shadows && G.sun.shadow.mapSize.x !== q.shadows) { G.sun.shadow.mapSize.set(q.shadows, q.shadows); G.sun.shadow.map?.dispose(); G.sun.shadow.map = null; } }
  if (G.camera) { G.camera.fov = S.fov; G.camera.updateProjectionMatrix(); }
  const fps = document.getElementById('fps'); if (fps) fps.hidden = !S.fps;
}

// First-launch auto-detect: pick a preset from the GPU string and a short frame-time sample.
export function detectQuality(sampleMs) {
  let gpu = '';
  try { const gl = G.renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; } catch (e) {}
  const g = gpu.toLowerCase();
  let q = 'high';
  if (/swiftshader|llvmpipe|software|microsoft basic/.test(g)) q = 'low';
  else if (/intel|uhd|iris|mali|adreno|vega 3|vega 6|vega 8/.test(g)) q = 'medium';
  if (sampleMs > 30) q = 'low'; else if (sampleMs > 20 && q === 'high') q = 'medium';
  if (/rtx 3[0-9]{3}|rtx 4[0-9]{3}|rtx 5|rx 6[89]|rx 7[89]|apple m[2-9] (pro|max|ultra)/.test(g) && sampleMs < 12) q = 'ultra';
  return { quality: q, gpu };
}
