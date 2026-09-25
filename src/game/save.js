// Save slots in localStorage. Saves are plain JSON so they survive updates.
import { G } from '../core/state.js';

const KEY = 'forgotten-tavern-save-';
export function newSave(hero) {
  return {
    v: 1, created: Date.now(), playTime: 0,
    party: { level: 1, xp: 0 },
    members: hero ? [hero] : [],       // all recruited heroes (data objects)
    active: hero ? [hero.id] : [],     // ids in current party (max 4, player first)
    gold: 60, potions: 3, inventory: [],
    flags: {}, doors: {}, realms: {}, shards: [],
    nemesis: { captains: [], nextId: 0, slain: [] },
    teamups: [], collected: {}, lore: [], riftDepth: 0, riftBest: 0,
    buff: null, stats: { kills: 0, crits: 0, nat20: 0, nat1: 0, deaths: 0, bosses: 0, legendary: 0 },
    ending: null,
  };
}
export function saveGame(slot = G.slot) {
  if (!G.save) return false;
  try { localStorage.setItem(KEY + slot, JSON.stringify(G.save)); return true; } catch (e) { return false; }
}
export function loadGame(slot) {
  try { const s = localStorage.getItem(KEY + slot); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
export function deleteSave(slot) { try { localStorage.removeItem(KEY + slot); } catch (e) {} }
export function slotInfo(slot) {
  const s = loadGame(slot); if (!s) return null;
  const h = s.members[0];
  return { name: h.name, classId: h.classId, level: s.party.level, shards: s.shards.length, time: s.playTime, ending: s.ending };
}
export function loadSettings() { try { const s = localStorage.getItem('forgotten-tavern-settings'); if (s) Object.assign(G.settings, JSON.parse(s)); } catch (e) {} }
export function saveSettings() { try { localStorage.setItem('forgotten-tavern-settings', JSON.stringify(G.settings)); } catch (e) {} }
