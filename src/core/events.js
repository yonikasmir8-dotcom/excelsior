// Tiny event bus so quests, nemeses, loot and UI can react to combat without tangled imports.
const subs = new Map();
export function on(evt, fn) { if (!subs.has(evt)) subs.set(evt, []); subs.get(evt).push(fn); return () => off(evt, fn); }
export function off(evt, fn) { const a = subs.get(evt); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
export function emit(evt, data) { const a = subs.get(evt); if (a) for (const fn of a.slice()) { try { fn(data); } catch (e) { console.error(evt, e); } } }
