// Golden Path: every main quest from a fresh save to the ending, in order. Combat is fast-forwarded
// (damage is applied directly) so this checks quest scripting, gating, saves and the ending, not balance.
import { chromium } from 'playwright';
const URL = process.env.GAME_URL || 'http://localhost:5173/';
const SP = process.env.SHOTS;
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1024, height: 576 } });
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
await page.goto(URL); await page.waitForFunction(() => window.__API); await page.waitForTimeout(1500);
if (await page.$('text=Continue')) await page.click('text=Continue'); // first-run photosensitivity notice
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => SP && page.screenshot({ path: SP + '/' + n });
await ev(() => window.__API.newGame(2, { name: 'Q', classId: 'artificer', look: {} }));
await page.waitForTimeout(2500);
await ev(() => { document.querySelector('#dialogue')?.remove(); window.__G.paused = false; const A = window.__API; A.flag('prologue', 1); A.flag('tutorial', 1); ['emberwood', 'neon', 'asterion'].forEach(A.unlockDoor); ['brunhild', 'anselm', 'pip'].forEach(A.recruit); });
await page.waitForTimeout(500);
const killAll = async () => { for (let i = 0; i < 40; i++) { const n = await ev(async () => { const c = window.__M.combat; const G = window.__G; const foes = G.entities.filter((e) => e.team === 'enemy' && !e.dead && e.aggro); for (const e of foes) c.dealDamage(G.party[0], e, e.hp + 999, { roll: { hit: true }, quiet: true }); return foes.length; }); if (!n) break; await page.waitForTimeout(300); } };
const closeDlg = async () => { for (let i = 0; i < 10; i++) { const b = await page.$('#dialogue .ch button'); if (!b) break; await b.click(); await page.waitForTimeout(250); } };
const stage = (r) => ev((r) => JSON.stringify(window.__G.save.realms[r]), r);
async function useAll(filter) {
  const labels = await ev((f) => { const G = window.__G; const out = []; for (const it of G.interactables) { const l = typeof it.label === 'function' ? it.label() : it.label; if (l.includes(f) && (!it.cond || it.cond())) out.push(l); } return out; }, filter);
  return labels;
}
async function useFirst(filter) {
  return ev(async (f) => { const G = window.__G; const it = G.interactables.find((it) => { const l = typeof it.label === 'function' ? it.label() : it.label; return l.includes(f) && (!it.cond || it.cond()); }); if (!it) return null; G.party.forEach((h) => h.pos.copy(it.pos).add({ x: 1, y: 0.5, z: 1, isVector3: true })); it.onHoldStart?.(); it.use(); return typeof it.label === 'function' ? it.label() : it.label; }, filter);
}
// ── EMBERWOOD
await ev(async () => { window.__M.realms.loadLocation('emberwood'); });
await page.waitForTimeout(2500);
await ev(() => window.__API.advance('emberwood', 0));
for (let i = 0; i < 3; i++) { await useFirst('Cleanse the Ley'); await page.waitForTimeout(600); await killAll(); await page.waitForTimeout(800); }
check('Emberwood: three ley stones cleansed', JSON.parse(await stage('emberwood')).stones.every(Boolean), await stage('emberwood'));
await killAll(); // gatekeeper must be aggro... force
await ev(async () => { const c = window.__M.combat; const G = window.__G; const g = G.entities.find((e) => e.name === 'The Gatekeeper'); if (g) c.dealDamage(G.party[0], g, 1e6, { roll: { hit: true } }); });
await page.waitForTimeout(800);
check('Emberwood: Gatekeeper opens the grove', JSON.parse(await stage('emberwood')).stage >= 3);
for (let k = 0; k < 5; k++) { await ev(async () => { const c = window.__M.combat; const G = window.__G; const b = G.entities.find((e) => e.isBoss && !e.dead); if (b) { b.statuses.delete('invuln'); c.dealDamage(G.party[0], b, 1e6, { roll: { hit: true } }); } }); await page.waitForTimeout(700); }
await page.waitForTimeout(2500); await closeDlg();
check('Emberwood complete, shard awarded', JSON.parse(await stage('emberwood')).done && await ev(() => window.__G.save.shards.includes('emberwood')));
await shot('q-ember.png');
// ── NEON
await ev(async () => { window.__M.realms.loadLocation('neon'); });
await page.waitForTimeout(2500);
await ev(() => window.__API.advance('neon', 0));
for (let i = 0; i < 4; i++) { await ev(async () => { const c = window.__M.combat; const G = window.__G; for (const e of G.entities.filter((e) => e.team === 'enemy')) c.dealDamage(G.party[0], e, 1e6, { roll: { hit: true }, quiet: true }); }); await page.waitForTimeout(300); await useFirst('Rescue'); await page.waitForTimeout(1300); await closeDlg(); }
check('Neon: civilians rescued', JSON.parse(await stage('neon')).civ.every(Boolean), await stage('neon'));
for (let i = 0; i < 3; i++) { await useFirst('Smash'); await page.waitForTimeout(400); }
check('Neon: erasers smashed', JSON.parse(await stage('neon')).er.every(Boolean));
for (let k = 0; k < 5; k++) { await ev(async () => { const c = window.__M.combat; const G = window.__G; const b = G.entities.find((e) => e.isBoss && !e.dead); if (b) { b.statuses.delete('invuln'); c.dealDamage(G.party[0], b, 1e6, { roll: { hit: true } }); } }); await page.waitForTimeout(700); }
await page.waitForTimeout(2500); await closeDlg();
check('Neon complete', JSON.parse(await stage('neon')).done);
// ── ASTERION
await ev(async () => { window.__M.realms.loadLocation('asterion'); });
await page.waitForTimeout(2500);
await ev(() => window.__API.advance('asterion', 0));
for (let i = 0; i < 3; i++) { await useFirst('Hack'); await page.waitForTimeout(400); await killAll(); }
check('Asterion: terminals hacked', JSON.parse(await stage('asterion')).term.every(Boolean), await stage('asterion'));
for (let k = 0; k < 8; k++) { await ev(async () => { const c = window.__M.combat; const G = window.__G; for (const e of G.entities.filter((e) => e.team === 'enemy' && !e.isBoss && e.aggro)) c.dealDamage(G.party[0], e, 1e6, { roll: { hit: true }, quiet: true }); const b = G.entities.find((e) => e.isBoss && !e.dead); if (b) { b.statuses.delete('invuln'); b.resist = {}; c.dealDamage(G.party[0], b, 1e6, { roll: { hit: true } }); } }); await page.waitForTimeout(700); }
await page.waitForTimeout(2500); await closeDlg();
check('Asterion complete, three shards held', JSON.parse(await stage('asterion')).done && await ev(() => window.__G.save.shards.length) === 3);
// tavern → confession → loom
await ev(async () => { window.__M.realms.loadLocation('tavern'); });
await page.waitForTimeout(2500);
await ev(() => window.__UI.dialogue('maren'));
await page.waitForTimeout(500); await closeDlg(); await page.waitForTimeout(2000); await closeDlg();
check('Maren\'s confession opens the Loom', await ev(() => !!window.__G.save.doors.loom && !!window.__G.save.flags.confession));
await shot('q-tavern2.png');
await ev(async () => { window.__M.realms.loadLocation('loom'); });
await page.waitForTimeout(2500);
for (let k = 0; k < 6; k++) { await ev(async () => { const c = window.__M.combat; const G = window.__G; const b = G.entities.find((e) => e.isBoss && !e.dead); if (b) { b.statuses.delete('invuln'); c.dealDamage(G.party[0], b, 1e6, { roll: { hit: true } }); } }); await page.waitForTimeout(700); }
await page.waitForTimeout(3000);
await shot('q-ending.png');
await closeDlg(); await page.waitForTimeout(3000);
check('An ending is reached', !!await ev(() => window.__G.save.ending), await ev(() => window.__G.save.ending));
await shot('q-ending2.png');
check('Nemesis roster populated along the way', await ev(() => window.__G.save.nemesis.captains.length) > 0);
check('Game saves after the ending', await ev(() => { window.__API.saveNow(); return !!localStorage.getItem('forgotten-tavern-save-2'); }));
check('no page errors', errs.length === 0, errs.slice(0, 5).join(' / '));
await browser.close();
const pass = results.filter(Boolean).length; console.log(`\n${pass}/${results.length} passed`); process.exit(pass === results.length ? 0 : 1);
