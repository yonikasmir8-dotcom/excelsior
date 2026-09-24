// Boots the real GameKnight backend inside the browser. The server code is unchanged;
// esbuild swaps its Node dependencies for the shims in ./shims (see build.mjs).
//
// Standalone extras, so the demo stays alive on a phone with no server:
//   • timestamps in the pre-seeded database are shifted so fixtures are always upcoming
//   • finished matches are auto-resolved with a simulated score 2h after kick-off
//   • new fixtures are listed as old ones finish
//   • simulated traders place a trade every ~20s while the app is open

import initSqlJs from 'sql.js/dist/sql-asm-memory-growth.js';

const realSetInterval = globalThis.setInterval;
globalThis.setInterval = (fn, ms) => { const id = realSetInterval(fn, ms); return { id, unref() { return this; } }; };
globalThis.setImmediate = globalThis.setImmediate || ((fn, ...a) => setTimeout(fn, 0, ...a));
globalThis.process = globalThis.process || { env: {} };
Object.assign(globalThis.process.env, { SEED_DEMO: 'false', ADMIN_USERS: '' });

const TIME_COLUMNS = {
  users: ['last_bonus_at', 'created_at'], sessions: ['created_at'], api_keys: ['last_used_at', 'created_at'], ledger: ['created_at'],
  events: ['starts_at', 'closes_at', 'resolved_at', 'created_at'], markets: ['created_at'], orders: ['created_at'],
  trades: ['created_at'], price_history: ['created_at'], comments: ['created_at'],
};

const TEAMS = {
  'Premier League': ['Arsenal', 'Liverpool', 'Manchester City', 'Chelsea', 'Newcastle United', 'Aston Villa', 'Tottenham Hotspur', 'Manchester United', 'Brighton', 'Brentford', 'Everton', 'Fulham', 'West Ham United', 'Crystal Palace', 'Nottingham Forest', 'Bournemouth'],
  'La Liga': ['Real Madrid', 'Barcelona', 'Atlético Madrid', 'Sevilla', 'Real Sociedad', 'Villarreal', 'Athletic Club', 'Real Betis'],
  'Serie A': ['Inter', 'Juventus', 'Napoli', 'AC Milan', 'Roma', 'Atalanta', 'Lazio', 'Fiorentina'],
  Bundesliga: ['Bayern Munich', 'Borussia Dortmund', 'Bayer Leverkusen', 'RB Leipzig', 'Eintracht Frankfurt', 'Stuttgart'],
};

export async function boot({ dbBytes, builtAt, fresh }) {
  globalThis.__GK_SQL = await initSqlJs();
  globalThis.__GK_DB_BYTES = dbBytes;
  const server = require('../backend/server.js');
  const db = require('../backend/db.js');
  const ex = require('../backend/exchange.js');
  const events = require('../backend/events.js');
  const mm = require('../backend/marketmaker.js');

  if (fresh) {
    const days = (Date.now() - builtAt) / 864e5;
    db.transaction(() => {
      for (const [table, cols] of Object.entries(TIME_COLUMNS)) {
        for (const c of cols) db.prepare(`UPDATE ${table} SET ${c} = strftime('%Y-%m-%dT%H:%M:%fZ', julianday(${c}) + ?) WHERE ${c} IS NOT NULL`).run(days);
      }
    })();
    // Sessions from the build machine are meaningless here
    db.prepare('DELETE FROM sessions').run();
  }

  let s = Date.now() % 2147483647;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const poisson = l => { let k = 0, p = Math.exp(-l), c = p; const u = rand(); while (u > c && k < 10) { k++; p *= l / k; c += p; } return k; };

  // Resolve matches that kicked off more than 2 hours ago with a score drawn from their own market prices
  function simulateResults() {
    const due = db.prepare("SELECT * FROM events WHERE kind = 'match' AND status = 'open' AND starts_at <= ?")
      .all(new Date(Date.now() - 2 * 3600e3).toISOString());
    for (const ev of due) {
      const px = Object.fromEntries(db.prepare('SELECT code, last_price FROM markets WHERE event_id = ?').all(ev.id).map(m => [m.code, m.last_price]));
      const goals = 2.2 + ((px.OVER25 ?? 50) - 50) / 25;
      const hs = ((px.HOME ?? 40) + (px.DRAW ?? 27) / 2) / 100;
      events.resolveMatch(ev.id, poisson(goals * hs), poisson(goals * (1 - hs)));
    }
  }

  // Keep ~12 upcoming fixtures listed
  function topUpFixtures() {
    const open = db.prepare("SELECT COUNT(*) AS n FROM events WHERE kind = 'match' AND status = 'open' AND closes_at > ?").get(new Date().toISOString()).n;
    for (let i = open; i < 12; i++) {
      const comps = Object.keys(TEAMS);
      const comp = comps[Math.floor(rand() * comps.length)];
      const t = [...TEAMS[comp]].sort(() => rand() - 0.5);
      const day = 1 + Math.floor(rand() * 7);
      const ko = new Date(); ko.setUTCHours(0, 0, 0, 0);
      const id = events.createMatchEvent({
        competition: comp, home: t[0], away: t[1], kickoff: new Date(ko.getTime() + day * 864e5 + (13 + Math.floor(rand() * 8)) * 3600e3),
        xgHome: 1.1 + rand() * 1.1, xgAway: 0.8 + rand() * 1.0,
      });
      db.prepare('SELECT id FROM markets WHERE event_id = ?').all(id).forEach(m => mm.requote(m.id));
    }
  }

  // Background traders so prices keep moving while you watch
  const bots = db.prepare('SELECT id FROM users WHERE is_bot = 1 AND is_house = 0').all().map(r => r.id);
  function botTick() {
    const markets = db.prepare(`SELECT m.id, m.fair FROM markets m JOIN events e ON e.id = m.event_id
      WHERE m.status = 'open' AND e.status = 'open' AND e.closes_at > ?`).all(new Date().toISOString());
    if (!markets.length || !bots.length) return;
    const m = markets[Math.floor(rand() ** 1.5 * markets.length)];
    const yes = rand() < 0.5;
    try {
      ex.placeOrder({ userId: bots[Math.floor(rand() * bots.length)], marketId: m.id, outcome: yes ? 'YES' : 'NO', side: 'buy', type: 'market', amount: Math.round((10 + rand() * 60) * 100) });
    } catch {}
  }

  const maintain = () => {
    try { events.closeExpired(); simulateResults(); topUpFixtures(); } catch (e) { console.warn('maintenance', e); }
  };
  maintain();
  realSetInterval(maintain, 60e3);
  realSetInterval(() => { if (document.visibilityState === 'visible') botTick(); }, 20e3);

  return {
    handle: req => server.app.handle(req),
    bus: ex.bus,
    exportDb: () => db.export(),
  };
}
