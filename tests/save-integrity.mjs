// Hostile save & recovery suite (GDD §12). Run: node tests/save-integrity.mjs (dev server on :5173)
import { chromium } from 'playwright';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
const results = []; const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const ev = (f, a) => page.evaluate(f, a);
await page.goto(URL); await page.waitForFunction(() => window.__API);
await ev(() => { localStorage.clear(); window.__G.settings.seenNotice = true; });
await ev(() => window.__API.newGame(1, { name: 'Saver', classId: 'cleric', look: {} })); await page.waitForTimeout(2500);
await ev(() => { document.querySelector('#dialogue')?.remove(); window.__G.paused = false; const S = window.__G.save; S.gold = 1234; S.party.level = 5; });

// 1. round trip
let r = await ev(() => window.__API.saveNow());
check('save succeeds', r && r.ok);
await ev(() => { window.__G.save.gold = 2222; window.__API.saveNow(); }); // second save creates backup 1 (gold 1234)
const info = await ev(() => window.__API.slotInfo(1));
check('slot info reads back', info && info.name === 'Saver' && info.level === 5);
// 2. corrupt the main save → falls back to newest backup and tells the player
await ev(() => { const k = 'forgotten-tavern-save-1'; localStorage.setItem(k, localStorage.getItem(k).slice(0, 200)); });
r = await ev(async () => { const m = await import('/src/game/save.js'); const d = m.loadGameDetailed(1); return { src: d.source, gold: d.data.gold, note: d.note }; });
check('truncated main save → restored from backup', r.src === 'backup 1' && r.gold === 1234, JSON.stringify(r));
// 3. tampered save (checksum mismatch) is rejected, not loaded
await ev(() => { const k = 'forgotten-tavern-save-1'; const o = JSON.parse(localStorage.getItem(k + '.bak1')); o.data = o.data.replace('"gold":1234', '"gold":999999999'); localStorage.setItem(k, JSON.stringify(o)); });
r = await ev(async () => { const m = await import('/src/game/save.js'); const d = m.loadGameDetailed(1); return { src: d.source, gold: d.data.gold }; });
check('tampered save rejected by checksum, backup used', r.src !== 'main' && r.gold === 1234, JSON.stringify(r));
// 4. every copy damaged → slot marked damaged, other slots unaffected, no crash
await ev(() => { for (const s of ['', '.bak1', '.bak2', '.bak3']) localStorage.setItem('forgotten-tavern-save-2' + s, '{broken'); });
r = await ev(() => window.__API.slotInfo(2));
check('fully corrupted slot reported as damaged (no exception)', r && r.damaged === true);
r = await ev(() => window.__API.slotInfo(1));
check('other slot still loads', r && r.name === 'Saver');
// 5. legacy v1 save (pre-envelope, level 25) migrates and clamps
await ev(() => { const S = JSON.parse(JSON.stringify(window.__G.save)); delete S.v; S.party.level = 25; S.gold = -50; localStorage.setItem('forgotten-tavern-save-3', JSON.stringify(S)); });
r = await ev(async () => { const m = await import('/src/game/save.js'); const d = m.loadGameDetailed(3); return { level: d.data.party.level, gold: d.data.gold, v: d.data.v }; });
check('legacy save migrates to current version with clamps', r.level === 20 && r.gold === 0 && r.v === 2, JSON.stringify(r));
// 6. storage full → save reports failure and previous save is untouched
r = await ev(() => { const before = localStorage.getItem('forgotten-tavern-save-1'); const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; }; const res = window.__API.saveNow(); Storage.prototype.setItem = orig; return { ok: res.ok, error: res.error, intact: localStorage.getItem('forgotten-tavern-save-1') === before }; });
check('storage full → clear failure, previous save intact', r.ok === false && r.intact, JSON.stringify(r));
// 7. interrupted save (tmp written, never committed) does not damage the real save
r = await ev(async () => { localStorage.setItem('forgotten-tavern-save-1.tmp', 'partial…'); const m = await import('/src/game/save.js'); try { m.loadGameDetailed(1); return true; } catch (e) { return false; } });
check('interrupted write leaves a loadable save', r === true);
// 8. importing a non-save file is refused without changing the slot
r = await ev(async () => { const before = localStorage.getItem('forgotten-tavern-save-1'); const res = await window.__API.importSave(1, '{"hello":"world"}'); return { ok: res.ok, intact: localStorage.getItem('forgotten-tavern-save-1') === before }; });
check('invalid import refused, slot unchanged', r.ok === false && r.intact);
// 9. valid export→import round trip into an empty slot
r = await ev(async () => { const text = localStorage.getItem('forgotten-tavern-save-1.bak1'); const res = await window.__API.importSave(3, text); return res.ok && window.__API.slotInfo(3).name === 'Saver'; });
check('valid import into another slot', r === true);
// 10. crash boundary: a repeatedly failing entity is contained, the player is told, and the game keeps running
await ev(() => { window.__M.realms.loadLocation('emberwood'); }); await page.waitForTimeout(1500);
await ev(() => { const e = window.__G.entities.find((x) => x.team === 'enemy'); for (let i = 0; i < 3; i++) { const bad = window.__G.entities.find((x) => x.team === 'enemy' && !x.dead && !x._bad); if (bad) { bad._bad = true; bad.update = () => { throw new Error('test fault'); }; } } });
await page.waitForTimeout(1500);
r = await ev(() => ({ box: !!document.getElementById('crashbox'), running: window.__G.mode === 'play', t: window.__G.realTime }));
await page.waitForTimeout(500);
const t2 = await ev(() => window.__G.realTime);
check('crash boundary shows recovery screen and loop keeps running', r.box && t2 > r.t, JSON.stringify(r));
// 11. Unstuck returns the party to a safe spot
await ev(() => { document.getElementById('crashbox')?.remove(); const h = window.__G.party[0]; h.pos.set(5, 60, 5); window.__API.unstuck(); });
r = await ev(() => window.__G.party[0].pos.y < 40);
check('Unstuck relocates the party', r === true);
// 12. wave enemies never de-aggro: party far away, enemies still hunting
r = await ev(async () => { const G = window.__G; const it = G.interactables.find((x) => (typeof x.label === 'function' ? x.label() : x.label).includes('Ley-Stone') || (typeof x.label === 'function' ? x.label() : x.label).includes('Cleanse')); window.__API.advance('emberwood', 0); const it2 = G.interactables.find((x) => (typeof x.label === 'function' ? x.label() : x.label) === 'Cleanse the Ley-Stone'); it2.use(); const w = G.waves.flat(); G.party.forEach((p) => p.pos.set(20, 30, 20)); return w.length; });
await page.waitForTimeout(4000);
r = await ev(() => { const w = (window.__G.waves || []).flat().filter((e) => !e.dead); return { n: w.length, aggro: w.every((e) => e.aggro), marked: true }; });
check('quest-wave enemies stay aggressive when the party is far away', r.n > 0 && r.aggro, JSON.stringify(r));
console.log(pageErrors.filter((m) => !m.includes('test fault')).length ? 'UNEXPECTED PAGE ERRORS:\n' + pageErrors.filter((m) => !m.includes('test fault')).join('\n') : 'no unexpected page errors');
const failed = results.filter((x) => !x.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
await browser.close(); process.exit(failed ? 1 : 0);
