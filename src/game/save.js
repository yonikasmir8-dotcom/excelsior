// Save system. Envelope { format, version, savedAt, checksum, data }.
// Desktop: files written atomically with 3 rolling backups (electron/main.cjs). Browser: localStorage with the same rotation.
// Every load is checksum-verified, migrated to the current version and validated/clamped. If the main save is damaged,
// the newest valid backup is used and the player is told.
import { G } from '../core/state.js';

export const SAVE_VERSION = 2;
const FORMAT = 'forgotten-tavern-save';
const KEY = 'forgotten-tavern-save-';
const BACKUPS = 3;
const desktop = () => typeof window !== 'undefined' && window.electronAPI;

export function newSave(hero) {
  return {
    v: SAVE_VERSION, created: Date.now(), playTime: 0,
    party: { level: 1, xp: 0 },
    members: hero ? [hero] : [], active: hero ? [hero.id] : [], leader: hero ? hero.id : null,
    gold: 60, potions: 3, inventory: [],
    flags: {}, doors: {}, realms: {}, shards: [],
    nemesis: { captains: [], nextId: 0, slain: [] },
    teamups: [], collected: {}, lore: [], riftDepth: 0, riftBest: 0, trials: {},
    buff: null, stats: { kills: 0, crits: 0, nat20: 0, nat1: 0, deaths: 0, bosses: 0, legendary: 0 },
    ending: null,
  };
}

function checksum(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }
export function encode(data) { const body = JSON.stringify(data); return JSON.stringify({ format: FORMAT, version: SAVE_VERSION, savedAt: Date.now(), checksum: checksum(body), data: body }); }
export function decode(text) {
  if (!text) throw new Error('empty');
  const o = JSON.parse(text);
  if (o && o.format === FORMAT) {
    if (checksum(o.data) !== o.checksum) throw new Error('checksum mismatch');
    return { data: migrate(JSON.parse(o.data), o.version), savedAt: o.savedAt };
  }
  if (o && o.members && o.party) return { data: migrate(o, o.v || 1), savedAt: o.created }; // legacy (pre-envelope) save
  throw new Error('not a save file');
}

// ── migrations: each step upgrades one version ──
const MIGRATIONS = {
  1: (s) => { s.party.level = Math.min(20, s.party.level || 1); s.leader = s.leader || (s.members[0] && s.members[0].id); s.trials = s.trials || {}; s.v = 2; return s; },
};
function migrate(s, from) { let v = from || 1; while (v < SAVE_VERSION) { s = MIGRATIONS[v](s); v++; } return s; }

// ── validation: structural checks + clamps. Throws on anything unrecoverable. ──
const num = (v, lo, hi, d = lo) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
export function validate(s) {
  if (!s || typeof s !== 'object') throw new Error('bad root');
  if (!Array.isArray(s.members) || !s.members.length) throw new Error('no heroes');
  for (const m of s.members) { if (!m.id || !m.classId || !m.name) throw new Error('bad hero'); m.talents = m.talents && typeof m.talents === 'object' ? m.talents : {}; m.gear = m.gear || {}; }
  s.party = s.party || { level: 1, xp: 0 }; s.party.level = num(s.party.level, 1, 20, 1); s.party.xp = num(s.party.xp, 0, 1e9, 0);
  s.gold = Math.floor(num(s.gold, 0, 9999999, 0)); s.potions = Math.floor(num(s.potions, 0, 99, 0));
  s.active = (Array.isArray(s.active) ? s.active : []).filter((id) => s.members.some((m) => m.id === id)).slice(0, 4);
  if (!s.active.length) s.active = [s.members[0].id];
  s.inventory = (Array.isArray(s.inventory) ? s.inventory : []).filter((it) => it && it.slot && it.stats).slice(0, 500);
  for (const it of s.inventory) for (const k in it.stats) it.stats[k] = num(it.stats[k], 0, 100000, 0);
  for (const k of ['flags', 'doors', 'realms', 'collected', 'trials']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  for (const k of ['shards', 'teamups', 'lore']) if (!Array.isArray(s[k])) s[k] = [];
  s.nemesis = s.nemesis && Array.isArray(s.nemesis.captains) ? s.nemesis : { captains: [], nextId: 0, slain: [] };
  s.riftDepth = Math.floor(num(s.riftDepth, 0, 999, 0)); s.riftBest = Math.floor(num(s.riftBest, 0, 999, 0));
  s.stats = s.stats || {}; s.playTime = num(s.playTime, 0, 1e9, 0);
  return s;
}

// ── storage backends ──
function readRaw(slot) {
  if (desktop()) return window.electronAPI.saveRead(slot);
  const backups = []; for (let i = 1; i <= BACKUPS; i++) backups.push(ls(`${KEY}${slot}.bak${i}`));
  return { main: ls(KEY + slot), backups };
}
function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function writeRaw(slot, text) {
  if (desktop()) return window.electronAPI.saveWrite(slot, text);
  try {
    localStorage.setItem(`${KEY}${slot}.tmp`, text); // proves there is room before touching anything
    const cur = ls(KEY + slot);
    if (cur) { for (let i = BACKUPS; i > 1; i--) { const prev = ls(`${KEY}${slot}.bak${i - 1}`); if (prev) localStorage.setItem(`${KEY}${slot}.bak${i}`, prev); } localStorage.setItem(`${KEY}${slot}.bak1`, cur); }
    localStorage.setItem(KEY + slot, text); localStorage.removeItem(`${KEY}${slot}.tmp`);
    return { ok: true };
  } catch (e) { try { localStorage.removeItem(`${KEY}${slot}.tmp`); } catch (_) {} return { ok: false, error: e && e.name === 'QuotaExceededError' ? 'storage full' : String(e) }; }
}

// ── public API ──
export function saveGame(slot = G.slot) {
  if (!G.save || !slot) return { ok: false, error: 'no game' };
  G.save.savedAt = Date.now();
  const res = writeRaw(slot, encode(G.save));
  if (res.ok) G.lastSaveAt = Date.now();
  return res;
}
// Returns { data, source: 'main'|'backup N', note } or null if the slot is empty. Throws only if every copy is damaged.
export function loadGameDetailed(slot) {
  const raw = readRaw(slot);
  const copies = [['main', raw.main], ...raw.backups.map((b, i) => [`backup ${i + 1}`, b])].filter(([, t]) => t);
  if (!copies.length) return null;
  const errors = [];
  for (const [src, text] of copies) {
    try { const { data, savedAt } = decode(text); return { data: validate(data), source: src, savedAt, note: src === 'main' ? null : `Your latest save was damaged (${errors[0]}). Restored from ${src}.` }; }
    catch (e) { errors.push(e.message); }
  }
  const err = new Error('All copies of this save are damaged: ' + errors.join('; ')); err.damaged = true; throw err;
}
export function loadGame(slot) { try { const r = loadGameDetailed(slot); return r ? r.data : null; } catch (e) { return null; } }
export function deleteSave(slot) {
  if (desktop()) { window.electronAPI.saveDelete(slot); return; }
  for (const s of ['', '.tmp', '.bak1', '.bak2', '.bak3']) { try { localStorage.removeItem(KEY + slot + s); } catch (e) {} }
}
export function slotInfo(slot) {
  let r; try { r = loadGameDetailed(slot); } catch (e) { return { damaged: true }; }
  if (!r) return null; const s = r.data; const h = s.members[0];
  return { name: h.name, classId: h.classId, level: s.party.level, shards: s.shards.length, time: s.playTime, ending: s.ending, savedAt: r.savedAt, restored: !!r.note };
}
export async function exportSave(slot) {
  const raw = readRaw(slot); if (!raw.main) return { ok: false, error: 'Empty slot' };
  if (desktop()) return window.electronAPI.exportSave(slot, raw.main);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([raw.main], { type: 'application/json' })); a.download = `forgotten-tavern-slot${slot}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return { ok: true };
}
export function importSaveText(slot, text) {
  const { data } = decode(text); validate(data); // throws with a readable message if the file is not a valid save
  return writeRaw(slot, encode(data));
}
