// Demo data for an empty database (skipped when the live fixtures feed is enabled):
// upcoming fixtures across Europe's top leagues, season outrights, and a week of
// backfilled trading by bot accounts against the house market maker, so charts,
// order books, leaderboards and activity feeds are all populated on first boot.

const crypto = require('crypto');
const db = require('./db');
const ex = require('./exchange');
const events = require('./events');
const mm = require('./marketmaker');

// [competition, home, away, dayOffset, hourUTC, xgHome, xgAway]
const FIXTURES = [
  ['Premier League', 'Arsenal', 'Chelsea', 1, 16.5, 1.85, 1.05],
  ['Premier League', 'Liverpool', 'Manchester City', 2, 15.5, 1.6, 1.5],
  ['Premier League', 'Manchester United', 'Tottenham Hotspur', 2, 14, 1.55, 1.35],
  ['Premier League', 'Newcastle United', 'Aston Villa', 3, 19, 1.6, 1.2],
  ['Premier League', 'Brighton', 'Brentford', 3, 14, 1.5, 1.25],
  ['La Liga', 'Real Madrid', 'Barcelona', 3, 20, 1.65, 1.45],
  ['La Liga', 'Atlético Madrid', 'Sevilla', 4, 19, 1.55, 0.8],
  ['Serie A', 'Inter', 'Juventus', 4, 18.75, 1.45, 0.95],
  ['Serie A', 'Napoli', 'AC Milan', 5, 18.75, 1.4, 1.2],
  ['Bundesliga', 'Bayern Munich', 'Borussia Dortmund', 5, 16.5, 2.4, 1.2],
  ['Ligue 1', 'Paris Saint-Germain', 'Marseille', 6, 19, 2.1, 0.95],
  ['Champions League', 'Paris Saint-Germain', 'Bayern Munich', 7, 19, 1.6, 1.55],
  ['Champions League', 'Barcelona', 'Arsenal', 8, 19, 1.55, 1.4],
  ['Champions League', 'Manchester City', 'Real Madrid', 8, 19, 1.6, 1.35],
];

const OUTRIGHTS = [
  {
    competition: 'Premier League', title: 'Premier League 2026/27 winner', question: 'Will {name} win the 2026/27 Premier League?',
    closesAt: '2027-05-23T15:00:00Z', description: 'Who lifts the Premier League trophy in May 2027?',
    contenders: [['Arsenal', 30], ['Liverpool', 24], ['Manchester City', 22], ['Chelsea', 8], ['Newcastle United', 5], ['Manchester United', 4],
      ['Tottenham Hotspur', 3], ['Aston Villa', 2], ['Brighton', 1], ['Other club', 1]],
  },
  {
    competition: 'Champions League', title: 'Champions League 2026/27 winner', question: 'Will {name} win the 2026/27 Champions League?',
    closesAt: '2027-05-29T19:00:00Z', description: 'Winner of the 2026/27 UEFA Champions League final.',
    contenders: [['Paris Saint-Germain', 15], ['Real Madrid', 14], ['Arsenal', 13], ['Bayern Munich', 12], ['Liverpool', 11], ['Barcelona', 10],
      ['Manchester City', 9], ['Inter', 5], ['Chelsea', 4], ['Other club', 7]],
  },
  {
    competition: 'Premier League', title: 'Premier League 2026/27 Golden Boot', question: 'Will {name} finish as the 2026/27 Premier League top scorer?',
    closesAt: '2027-05-23T15:00:00Z', description: 'Outright top scorer. Ties: every tied player resolves YES.',
    contenders: [['Erling Haaland', 42], ['Mohamed Salah', 12], ['Alexander Isak', 10], ['Viktor Gyökeres', 9], ['Cole Palmer', 7],
      ['Ollie Watkins', 5], ['Bukayo Saka', 4], ['Other player', 11]],
  },
];

const BOTS = ['TikiTaka', 'GegenPress', 'FalseNine', 'Catenaccio', 'TotalFootball', 'ParkTheBus', 'Trequartista', 'Regista'];

module.exports = function seed({ hashPassword }) {
  const DAY = 864e5;
  const start = Date.now() - 7 * DAY;
  const iso = t => new Date(t).toISOString();
  let s = 7;
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

  ex.setClock(iso(start));
  const botIds = BOTS.map(name => {
    const { lastInsertRowid: id } = db.prepare('INSERT INTO users (username, pass_hash, granted, is_bot, created_at) VALUES (?, ?, ?, 1, ?)')
      .run(name, hashPassword(crypto.randomBytes(24).toString('hex')), 5000_00, iso(start));
    ex.credit(id, 5000_00, 'signup', null);
    return id;
  });

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const createdAt = iso(start);
  for (const [competition, home, away, day, hour, xgHome, xgAway] of FIXTURES) {
    events.createMatchEvent({ competition, home, away, kickoff: iso(today.getTime() + day * DAY + hour * 3600e3), xgHome, xgAway, createdAt });
  }
  for (const o of OUTRIGHTS) {
    events.createOutrightEvent({ ...o, contenders: o.contenders.map(([name, prob]) => ({ name, prob })), createdAt });
  }
  // A finished match so resolved markets have something to show
  const pastId = events.createMatchEvent({ competition: 'Premier League', home: 'Everton', away: 'Fulham', kickoff: iso(Date.now() + 3600e3), xgHome: 1.3, xgAway: 1.2, createdAt });

  mm.start(hashPassword);

  // Each bot holds a private, drifting belief per market and trades when the book disagrees
  const markets = db.prepare("SELECT id, fair FROM markets WHERE status = 'open'").all();
  const belief = Object.fromEntries(markets.map(m => [m.id, m.fair + (rand() - 0.5) * 8]));
  const STEPS = 900;
  for (let i = 0; i < STEPS; i++) {
    ex.setClock(iso(start + (i / STEPS) * (Date.now() - start - 60e3)));
    const m = markets[Math.floor(rand() ** 1.6 * markets.length)]; // earlier (featured) markets trade more
    belief[m.id] = Math.max(2, Math.min(98, belief[m.id] + (rand() - 0.5) * 3));
    const userId = botIds[Math.floor(rand() * botIds.length)];
    const view = belief[m.id] + (rand() - 0.5) * 10;
    const qt = ex.quotes(m.id);
    try {
      const r = rand();
      if (r < 0.2) {
        // Rest a limit order inside the spread — adds depth from real traders
        const yes = rand() < 0.5;
        const px = Math.round(yes ? Math.min(view - 1, (qt.best_ask ?? 99) - 1) : Math.min(100 - view - 1, (qt.buy_no ?? 99) - 1));
        if (px >= 2 && px <= 97) ex.placeOrder({ userId, marketId: m.id, outcome: yes ? 'YES' : 'NO', side: 'buy', type: 'limit', price: px, size: 20 + Math.floor(rand() * 120) });
      } else if (r < 0.3) {
        // Take profit on an existing position
        const pos = ex.getPos(userId, m.id);
        const outcome = pos.yes > pos.no ? 'YES' : 'NO';
        const avail = ex.available(userId, m.id, outcome);
        if (avail > 5) ex.placeOrder({ userId, marketId: m.id, outcome, side: 'sell', type: 'market', size: Math.ceil(avail * (0.3 + rand() * 0.7)) });
      } else if (qt.buy_yes != null && view > qt.buy_yes + 1) {
        ex.placeOrder({ userId, marketId: m.id, outcome: 'YES', side: 'buy', type: 'market', amount: Math.round((15 + rand() * 120) * 100) });
      } else if (qt.buy_no != null && 100 - view > qt.buy_no + 1) {
        ex.placeOrder({ userId, marketId: m.id, outcome: 'NO', side: 'buy', type: 'market', amount: Math.round((15 + rand() * 120) * 100) });
      }
    } catch { /* out of cash or no liquidity — skip */ }
    mm.flush();
  }
  ex.setClock(null);

  db.prepare('UPDATE events SET closes_at = ?, starts_at = ? WHERE id = ?').run(iso(Date.now() - 3 * 3600e3), iso(Date.now() - 3 * 3600e3), pastId);
  events.closeExpired();
  events.resolveMatch(pastId, 2, 1);
  console.log(`Seeded ${FIXTURES.length + 1} fixtures, ${OUTRIGHTS.length} outrights, ${BOTS.length} bot traders`);
};
