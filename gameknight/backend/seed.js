// Demo data for an empty database: upcoming fixtures across Europe's top leagues,
// a handful of bot traders to give the markets some history, and one settled match.

const crypto = require('crypto');
const lmsr = require('./lmsr');

const FIXTURES = [
  // [competition, home, away, dayOffset, hourUTC, home%, draw%, away%, over2.5%, btts%]
  ['Premier League', 'Arsenal', 'Chelsea', 1, 16.5, 0.52, 0.25, 0.23, 0.55, 0.54],
  ['Premier League', 'Liverpool', 'Manchester City', 2, 15.5, 0.39, 0.25, 0.36, 0.64, 0.62],
  ['Premier League', 'Manchester United', 'Tottenham Hotspur', 2, 14, 0.42, 0.26, 0.32, 0.6, 0.6],
  ['Premier League', 'Newcastle United', 'Aston Villa', 3, 19, 0.47, 0.26, 0.27, 0.53, 0.55],
  ['La Liga', 'Real Madrid', 'Barcelona', 3, 20, 0.44, 0.24, 0.32, 0.66, 0.63],
  ['La Liga', 'Atlético Madrid', 'Sevilla', 4, 19, 0.58, 0.26, 0.16, 0.42, 0.44],
  ['Serie A', 'Inter', 'Juventus', 4, 18.75, 0.46, 0.3, 0.24, 0.45, 0.48],
  ['Bundesliga', 'Bayern Munich', 'Borussia Dortmund', 5, 16.5, 0.63, 0.19, 0.18, 0.72, 0.6],
  ['Champions League', 'Paris Saint-Germain', 'Bayern Munich', 6, 19, 0.4, 0.24, 0.36, 0.68, 0.64],
  ['Champions League', 'Barcelona', 'Arsenal', 7, 19, 0.43, 0.25, 0.32, 0.62, 0.6],
];

const BOTS = ['TikiTaka', 'GegenPress', 'FalseNine', 'Catenaccio', 'TotalFootball', 'ParkTheBus'];

module.exports = function seed({ db, createFixture, trade, settleFixture, hashPassword, STARTING_BALANCE }) {
  const start = Date.now() - 36 * 3600e3;
  const iso = t => new Date(t).toISOString();

  const botIds = BOTS.map(name => db.prepare(
    'INSERT INTO users (username, pass_hash, balance, granted, is_bot, created_at) VALUES (?, ?, ?, ?, 1, ?)'
  ).run(name, hashPassword(crypto.randomBytes(24).toString('hex')), STARTING_BALANCE * 2, STARTING_BALANCE * 2, iso(start)).lastInsertRowid);

  // Deterministic PRNG so every fresh install looks the same
  let s = 42;
  const rand = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);

  // Bots are noisy value traders: each picks the outcome that looks cheapest against
  // its own jittered view of the fair odds, so prices wander without running away.
  const botTrades = (fixtureId, n, probs) => {
    const fair = {
      '1X2': [probs.home, probs.draw, probs.away],
      OU25: [probs.over25, 1 - probs.over25],
      BTTS: [probs.btts, 1 - probs.btts],
    };
    const markets = db.prepare('SELECT id, type, b FROM markets WHERE fixture_id = ?').all(fixtureId);
    for (let i = 0; i < n; i++) {
      const m = markets[Math.floor(rand() * markets.length)];
      const outs = db.prepare('SELECT id, q FROM outcomes WHERE market_id = ? ORDER BY sort').all(m.id);
      const ps = lmsr.prices(outs.map(o => o.q), m.b);
      const edge = ps.map((p, j) => fair[m.type][j] * (0.75 + rand() * 0.5) - p);
      const pick = edge.indexOf(Math.max(...edge));
      const userId = botIds[Math.floor(rand() * botIds.length)];
      const ts = iso(start + ((i + 1) / (n + 1)) * 34 * 3600e3);
      try {
        trade({ userId, marketId: m.id, outcomeId: outs[pick].id, side: 'buy', amount: Math.round(10 + rand() * 60), ts });
      } catch { /* bot ran out of coins — skip */ }
    }
  };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // One finished match so settled markets and the leaderboard have something to show
  const pastProbs = { home: 0.5, draw: 0.26, away: 0.24, over25: 0.55, btts: 0.55 };
  const pastId = createFixture({
    competition: 'Premier League', home: 'Brighton', away: 'Brentford', kickoff: iso(Date.now() + 3600e3), probs: pastProbs,
  });
  db.prepare('UPDATE price_history SET created_at = ? WHERE market_id IN (SELECT id FROM markets WHERE fixture_id = ?)').run(iso(start), pastId);
  botTrades(pastId, 14, pastProbs);
  db.prepare('UPDATE fixtures SET kickoff = ? WHERE id = ?').run(iso(Date.now() - 3 * 3600e3), pastId);
  settleFixture(pastId, 2, 1);

  for (const [competition, home, away, day, hour, ph, pd, pa, over25, btts] of FIXTURES) {
    const probs = { home: ph, draw: pd, away: pa, over25, btts };
    const id = createFixture({ competition, home, away, kickoff: iso(today.getTime() + day * 864e5 + hour * 3600e3), probs });
    db.prepare('UPDATE price_history SET created_at = ? WHERE market_id IN (SELECT id FROM markets WHERE fixture_id = ?)').run(iso(start), id);
    botTrades(id, 10 + Math.floor(rand() * 14), probs);
  }
  console.log(`Seeded ${FIXTURES.length + 1} demo fixtures and ${BOTS.length} bot traders`);
};
