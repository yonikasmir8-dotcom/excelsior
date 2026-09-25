// Everything you hear is synthesised live with Web Audio — no audio files.
import { G } from './state.js';

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let music = null;

function ensure() {
  if (ctx) return true;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    Audio.applyVolume();
    return true;
  } catch (e) { return false; }
}

function tone({ f = 440, f2 = null, type = 'square', t = 0.15, v = 0.2, at = 0.005, delay = 0, bus = sfxBus, filter = null }) {
  const now = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, now);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), now + t);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(v, now + at); g.gain.exponentialRampToValueAtTime(0.0001, now + t);
  let node = o;
  if (filter) { const fl = ctx.createBiquadFilter(); fl.type = filter.type || 'lowpass'; fl.frequency.value = filter.f; fl.Q.value = filter.q || 1; o.connect(fl); node = fl; }
  node.connect(g); g.connect(bus); o.start(now); o.stop(now + t + 0.05);
}
function noise({ t = 0.2, v = 0.3, f = 1200, f2 = null, type = 'lowpass', delay = 0, q = 1 }) {
  const now = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, now); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, now + t);
  const g = ctx.createGain(); g.gain.setValueAtTime(v, now); g.gain.exponentialRampToValueAtTime(0.0001, now + t);
  s.connect(fl); fl.connect(g); g.connect(sfxBus); s.start(now); s.stop(now + t + 0.05);
}

const SFX = {
  click: () => tone({ f: 900, t: 0.05, v: 0.1 }),
  hover: () => tone({ f: 1400, t: 0.03, v: 0.04, type: 'sine' }),
  jump: () => tone({ f: 220, f2: 520, t: 0.14, v: 0.12, type: 'square' }),
  dash: () => noise({ t: 0.25, v: 0.35, f: 3000, f2: 400, type: 'bandpass', q: 2 }),
  swing: () => noise({ t: 0.12, v: 0.25, f: 2500, f2: 800, type: 'bandpass', q: 3 }),
  hit: () => { noise({ t: 0.12, v: 0.5, f: 1800, f2: 200 }); tone({ f: 160, f2: 60, t: 0.12, v: 0.3, type: 'triangle' }); },
  bigHit: () => { noise({ t: 0.35, v: 0.7, f: 1400, f2: 80 }); tone({ f: 110, f2: 40, t: 0.3, v: 0.5, type: 'sawtooth', filter: { f: 600 } }); },
  crit: () => { SFX.bigHit(); [0, 4, 7, 12].forEach((s, i) => tone({ f: 523 * Math.pow(2, s / 12), t: 0.25, v: 0.12, delay: i * 0.05, type: 'square' })); },
  miss: () => tone({ f: 500, f2: 300, t: 0.12, v: 0.08, type: 'sine' }),
  fumble: () => { [0, -3, -6].forEach((s, i) => tone({ f: 330 * Math.pow(2, s / 12), t: 0.25, v: 0.12, delay: i * 0.12, type: 'triangle' })); },
  hurt: () => tone({ f: 300, f2: 120, t: 0.18, v: 0.2, type: 'sawtooth', filter: { f: 1200 } }),
  fire: () => { noise({ t: 0.4, v: 0.35, f: 800, f2: 3000, type: 'bandpass' }); tone({ f: 200, f2: 90, t: 0.3, v: 0.15, type: 'sawtooth' }); },
  zap: () => { for (let i = 0; i < 4; i++) tone({ f: 1200 + Math.random() * 1600, f2: 200, t: 0.08, v: 0.12, delay: i * 0.03, type: 'square' }); },
  arrow: () => noise({ t: 0.15, v: 0.2, f: 5000, f2: 1500, type: 'highpass' }),
  heal: () => [0, 4, 7, 11, 14].forEach((s, i) => tone({ f: 440 * Math.pow(2, s / 12), t: 0.4, v: 0.08, delay: i * 0.06, type: 'sine' })),
  holy: () => { [0, 7, 12].forEach((s) => tone({ f: 330 * Math.pow(2, s / 12), t: 0.6, v: 0.1, type: 'triangle' })); noise({ t: 0.5, v: 0.15, f: 6000, type: 'highpass' }); },
  explode: () => { noise({ t: 0.8, v: 0.9, f: 900, f2: 50 }); tone({ f: 80, f2: 30, t: 0.6, v: 0.6, type: 'sine' }); },
  build: () => { tone({ f: 600, t: 0.06, v: 0.15, type: 'square' }); tone({ f: 800, t: 0.06, v: 0.15, type: 'square', delay: 0.08 }); },
  laser: () => tone({ f: 1800, f2: 300, t: 0.2, v: 0.15, type: 'sawtooth', filter: { f: 3000 } }),
  shadow: () => { tone({ f: 200, f2: 800, t: 0.2, v: 0.1, type: 'sine' }); noise({ t: 0.2, v: 0.15, f: 400, type: 'lowpass' }); },
  roar: () => { tone({ f: 90, f2: 60, t: 0.8, v: 0.4, type: 'sawtooth', filter: { f: 500, q: 4 } }); noise({ t: 0.8, v: 0.3, f: 300 }); },
  dice: () => { for (let i = 0; i < 6; i++) tone({ f: 1800 + Math.random() * 800, t: 0.03, v: 0.1, delay: i * 0.045 + Math.random() * 0.02, type: 'square' }); },
  diceLand: () => { tone({ f: 700, t: 0.08, v: 0.2, type: 'square' }); noise({ t: 0.05, v: 0.2, f: 3000 }); },
  coin: () => { tone({ f: 988, t: 0.08, v: 0.1, type: 'square' }); tone({ f: 1319, t: 0.2, v: 0.1, type: 'square', delay: 0.07 }); },
  loot: () => [0, 4, 7, 12, 16].forEach((s, i) => tone({ f: 660 * Math.pow(2, s / 12), t: 0.18, v: 0.08, delay: i * 0.05, type: 'triangle' })),
  levelup: () => [0, 4, 7, 12, 7, 12, 16, 19].forEach((s, i) => tone({ f: 392 * Math.pow(2, s / 12), t: 0.25, v: 0.1, delay: i * 0.08, type: 'square' })),
  breakStart: () => { tone({ f: 60, f2: 400, t: 0.5, v: 0.3, type: 'sawtooth', filter: { f: 1500 } }); noise({ t: 0.6, v: 0.3, f: 200, f2: 6000, type: 'bandpass' }); },
  panel: () => { noise({ t: 0.08, v: 0.4, f: 4000, type: 'highpass' }); tone({ f: 200, t: 0.1, v: 0.2, type: 'square' }); },
  teamup: () => { [0, 5, 7, 12, 17, 19, 24].forEach((s, i) => tone({ f: 262 * Math.pow(2, s / 12), t: 0.3, v: 0.12, delay: i * 0.05, type: 'sawtooth', filter: { f: 3000 } })); SFX.explode(); },
  nemesis: () => { [0, 1, 0, -5].forEach((s, i) => tone({ f: 110 * Math.pow(2, s / 12), t: 0.5, v: 0.25, delay: i * 0.22, type: 'sawtooth', filter: { f: 800 } })); },
  portal: () => { tone({ f: 100, f2: 1600, t: 1.2, v: 0.2, type: 'sine' }); noise({ t: 1.2, v: 0.2, f: 300, f2: 5000, type: 'bandpass', q: 5 }); },
  talk: () => tone({ f: 300 + Math.random() * 200, t: 0.04, v: 0.04, type: 'square' }),
  quest: () => [0, 7, 12].forEach((s, i) => tone({ f: 523 * Math.pow(2, s / 12), t: 0.4, v: 0.1, delay: i * 0.1, type: 'triangle' })),
  down: () => [0, -2, -4, -7].forEach((s, i) => tone({ f: 330 * Math.pow(2, s / 12), t: 0.3, v: 0.12, delay: i * 0.15, type: 'triangle' })),
  block: () => { tone({ f: 1200, t: 0.08, v: 0.15, type: 'square' }); noise({ t: 0.1, v: 0.3, f: 5000, type: 'highpass' }); },
};

// ── Generative music: each realm gets a scale, tempo, and instrument voice ──
const MUSIC = {
  title:    { bpm: 84,  root: 50, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'triangle', bass: 'sine', pad: true, drums: 0.2 },
  tavern:   { bpm: 108, root: 55, scale: [0, 2, 4, 5, 7, 9, 11], lead: 'triangle', bass: 'triangle', pad: false, drums: 0.5, jig: true },
  emberwood:{ bpm: 96,  root: 52, scale: [0, 2, 3, 5, 7, 9, 10], lead: 'triangle', bass: 'sine', pad: true, drums: 0.4 },
  neon:     { bpm: 124, root: 45, scale: [0, 3, 5, 7, 10], lead: 'sawtooth', bass: 'square', pad: true, drums: 1 },
  asterion: { bpm: 72,  root: 41, scale: [0, 1, 5, 7, 8], lead: 'sine', bass: 'sawtooth', pad: true, drums: 0.3 },
  rift:     { bpm: 116, root: 48, scale: [0, 1, 4, 5, 7, 8, 11], lead: 'square', bass: 'sawtooth', pad: true, drums: 0.8 },
  loom:     { bpm: 88,  root: 43, scale: [0, 2, 3, 6, 7, 8, 11], lead: 'triangle', bass: 'sawtooth', pad: true, drums: 0.6 },
  combat:   { bpm: 140, root: 45, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'square', bass: 'sawtooth', pad: false, drums: 1 },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function startMusic(key) {
  const def = MUSIC[key] || MUSIC.title;
  if (music && music.key === key) return;
  if (music) music.stop = true;
  const m = { key, def, step: 0, next: ctx.currentTime + 0.1, stop: false, seed: Math.random() * 1000, phrase: [] };
  // Build a 16-step motif that repeats with variation
  for (let i = 0; i < 16; i++) m.phrase.push(Math.random() < 0.6 ? Math.floor(Math.random() * def.scale.length) : -1);
  music = m;
  const spb = 60 / def.bpm / 2; // eighth notes
  const tick = () => {
    if (m.stop || !ctx) return;
    while (m.next < ctx.currentTime + 0.2) {
      const s = m.step % 16, bar = Math.floor(m.step / 16);
      const t = m.next - ctx.currentTime;
      const chordRoot = [0, 5, 3, 4][bar % 4];
      const deg = (i) => { const sc = def.scale; const o = Math.floor(i / sc.length); return sc[((i % sc.length) + sc.length) % sc.length] + o * 12; };
      if (s % 4 === 0) tone({ f: mtof(def.root - 12 + deg(chordRoot)), t: spb * 3.5, v: 0.12, type: def.bass, delay: t, bus: musicBus, filter: { f: 700 } });
      if (def.jig && s % 2 === 1) tone({ f: mtof(def.root + deg(chordRoot + 2)), t: spb * 0.8, v: 0.04, type: 'triangle', delay: t, bus: musicBus });
      const n = m.phrase[s];
      if (n >= 0 && (bar % 2 === 0 || Math.random() < 0.7)) {
        const vary = bar % 4 === 3 ? 2 : 0;
        tone({ f: mtof(def.root + 12 + deg(n + chordRoot + vary)), t: spb * 1.6, v: 0.05, type: def.lead, delay: t, bus: musicBus, filter: { f: 2400 } });
      }
      if (def.pad && s === 0) [0, 2, 4].forEach((k) => tone({ f: mtof(def.root + deg(chordRoot + k)), t: spb * 15, v: 0.025, at: 0.6, type: 'sine', delay: t, bus: musicBus }));
      if (def.drums > 0) {
        const now = ctx.currentTime + t;
        if (s % 4 === 0) { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.setValueAtTime(140, now); o.frequency.exponentialRampToValueAtTime(40, now + 0.12); g.gain.setValueAtTime(0.3 * def.drums, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.15); o.connect(g); g.connect(musicBus); o.start(now); o.stop(now + 0.2); }
        if (s % 8 === 4 && def.drums > 0.5) { const src = ctx.createBufferSource(); src.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; const g = ctx.createGain(); g.gain.setValueAtTime(0.18 * def.drums, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.12); src.connect(f); f.connect(g); g.connect(musicBus); src.start(now); src.stop(now + 0.15); }
        if (s % 2 === 1 && def.drums >= 0.8) { const src = ctx.createBufferSource(); src.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(0.05, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.04); src.connect(f); f.connect(g); g.connect(musicBus); src.start(now); src.stop(now + 0.05); }
      }
      m.next += spb; m.step++;
    }
    setTimeout(tick, 50);
  };
  tick();
}

export const Audio = {
  unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
  play(name) { if (!ensure() || !SFX[name]) return; try { SFX[name](); } catch (e) {} },
  music(key) { if (!ensure()) return; startMusic(key); },
  stopMusic() { if (music) music.stop = true; music = null; },
  applyVolume() { if (!ctx) return; sfxBus.gain.value = G.settings.volume; musicBus.gain.value = G.settings.music * 0.6; },
};
