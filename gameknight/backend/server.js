// GameKnight — football prediction market API
// Play-money only: users trade shares in match outcomes with virtual Knight Coins (KC).
// Prices come from an LMSR automated market maker (see lmsr.js), so every price is
// the crowd's implied probability of that outcome.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const lmsr = require('./lmsr');

// ── Config ────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
const PORT = process.env.PORT || 4000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'gameknight.db');
const ADMIN_USERS = (process.env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const STARTING_BALANCE = 1000;
const DAILY_BONUS = 100;
const DEFAULT_LIQUIDITY = 250;
const MIN_TRADE = 1;

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pass_hash TEXT NOT NULL,
    balance REAL NOT NULL,
    granted REAL NOT NULL,              -- total coins ever given (start + bonuses), for P&L
    is_admin INTEGER NOT NULL DEFAULT 0,
    is_bot INTEGER NOT NULL DEFAULT 0,
    last_bonus_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fixtures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    competition TEXT NOT NULL,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    kickoff TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',   -- scheduled | settled | void
    home_score INTEGER,
    away_score INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS markets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                         -- 1X2 | OU25 | BTTS
    question TEXT NOT NULL,
    b REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',        -- open | settled | void
    winning_outcome TEXT
  );
  CREATE TABLE IF NOT EXISTS outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    label TEXT NOT NULL,
    q REAL NOT NULL,
    sort INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS positions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outcome_id INTEGER NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
    shares REAL NOT NULL DEFAULT 0,
    cost REAL NOT NULL DEFAULT 0,               -- remaining cost basis
    realized REAL NOT NULL DEFAULT 0,           -- realised P&L from sells + settlement
    PRIMARY KEY (user_id, outcome_id)
  );
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    outcome_id INTEGER NOT NULL REFERENCES outcomes(id) ON DELETE CASCADE,
    side TEXT NOT NULL,                         -- buy | sell
    shares REAL NOT NULL,
    amount REAL NOT NULL,                       -- coins paid (buy) or received (sell)
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    market_id INTEGER NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    prices TEXT NOT NULL,                       -- JSON array, same order as outcomes.sort
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_trades_market ON trades(market_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_history_market ON price_history(market_id, created_at);
`);

// ── Helpers ───────────────────────────────────────────────────────────────────
const now = () => new Date().toISOString();
const round2 = n => Math.round(n * 100) / 100;
const floor2 = n => Math.floor(n * 100 + 1e-9) / 100;
const EPS = 1e-6;

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

// Market templates — how each market is labelled and how a final score resolves it.
const MARKET_TYPES = {
  '1X2': {
    question: 'Match result',
    outcomes: f => [['HOME', f.home], ['DRAW', 'Draw'], ['AWAY', f.away]],
    resolve: (h, a) => (h > a ? 'HOME' : h === a ? 'DRAW' : 'AWAY'),
  },
  OU25: {
    question: 'Total goals — over/under 2.5',
    outcomes: () => [['OVER', 'Over 2.5'], ['UNDER', 'Under 2.5']],
    resolve: (h, a) => (h + a > 2.5 ? 'OVER' : 'UNDER'),
  },
  BTTS: {
    question: 'Both teams to score',
    outcomes: () => [['YES', 'Yes'], ['NO', 'No']],
    resolve: (h, a) => (h > 0 && a > 0 ? 'YES' : 'NO'),
  },
};

function fixtureState(f) {
  if (f.status !== 'scheduled') return f.status;
  return new Date(f.kickoff) > new Date() ? 'open' : 'awaiting';
}

function publicUser(u) {
  return {
    id: u.id, username: u.username, balance: round2(u.balance),
    is_admin: !!u.is_admin, can_claim_bonus: canClaimBonus(u),
    next_bonus_at: u.last_bonus_at ? new Date(new Date(u.last_bonus_at).getTime() + 864e5).toISOString() : null,
  };
}
function canClaimBonus(u) {
  return !u.last_bonus_at || Date.now() - new Date(u.last_bonus_at).getTime() >= 864e5;
}

const stmt = {
  userById: db.prepare('SELECT * FROM users WHERE id = ?'),
  userByName: db.prepare('SELECT * FROM users WHERE username = ?'),
  session: db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'),
  fixture: db.prepare('SELECT * FROM fixtures WHERE id = ?'),
  market: db.prepare('SELECT * FROM markets WHERE id = ?'),
  marketsForFixture: db.prepare('SELECT * FROM markets WHERE fixture_id = ? ORDER BY id'),
  outcomes: db.prepare('SELECT * FROM outcomes WHERE market_id = ? ORDER BY sort'),
  position: db.prepare('SELECT * FROM positions WHERE user_id = ? AND outcome_id = ?'),
  upsertPosition: db.prepare(`INSERT INTO positions (user_id, outcome_id, shares, cost, realized) VALUES (@user_id, @outcome_id, @shares, @cost, @realized)
    ON CONFLICT(user_id, outcome_id) DO UPDATE SET shares = @shares, cost = @cost, realized = @realized`),
  setQ: db.prepare('UPDATE outcomes SET q = ? WHERE id = ?'),
  setBalance: db.prepare('UPDATE users SET balance = ? WHERE id = ?'),
  addHistory: db.prepare('INSERT INTO price_history (market_id, prices, created_at) VALUES (?, ?, ?)'),
  addTrade: db.prepare('INSERT INTO trades (user_id, market_id, outcome_id, side, shares, amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
};

// ── Core market operations ───────────────────────────────────────────────────
function createFixture({ competition, home, away, kickoff, probs = {}, liquidity = DEFAULT_LIQUIDITY }) {
  const opening = {
    '1X2': [probs.home ?? 0.4, probs.draw ?? 0.27, probs.away ?? 0.33],
    OU25: [probs.over25 ?? 0.5, 1 - (probs.over25 ?? 0.5)],
    BTTS: [probs.btts ?? 0.5, 1 - (probs.btts ?? 0.5)],
  };
  return db.transaction(() => {
    const ts = now();
    const { lastInsertRowid: fixtureId } = db.prepare(
      'INSERT INTO fixtures (competition, home, away, kickoff, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(competition, home, away, new Date(kickoff).toISOString(), ts);
    for (const [type, def] of Object.entries(MARKET_TYPES)) {
      const { lastInsertRowid: marketId } = db.prepare(
        'INSERT INTO markets (fixture_id, type, question, b) VALUES (?, ?, ?, ?)'
      ).run(fixtureId, type, def.question, liquidity);
      const qs = lmsr.initialQuantities(opening[type], liquidity);
      def.outcomes({ home, away }).forEach(([code, label], i) => {
        db.prepare('INSERT INTO outcomes (market_id, code, label, q, sort) VALUES (?, ?, ?, ?, ?)').run(marketId, code, label, qs[i], i);
      });
      stmt.addHistory.run(marketId, JSON.stringify(lmsr.prices(qs, liquidity)), ts);
    }
    return fixtureId;
  })();
}

// Executes (or, with dryRun, just prices) a trade. Buys specify coins to spend,
// sells specify shares to sell. Returns the fill and the post-trade prices.
function trade({ userId, marketId, outcomeId, side, amount, shares, dryRun = false, ts = now() }) {
  return db.transaction(() => {
    const market = stmt.market.get(marketId);
    if (!market) throw new ApiError(404, 'Market not found');
    const fixture = stmt.fixture.get(market.fixture_id);
    if (market.status !== 'open' || fixtureState(fixture) !== 'open') throw new ApiError(400, 'Trading is closed for this market');
    const outs = stmt.outcomes.all(marketId);
    const idx = outs.findIndex(o => o.id === Number(outcomeId));
    if (idx < 0) throw new ApiError(400, 'Unknown outcome');
    const user = stmt.userById.get(userId);
    const qs = outs.map(o => o.q);
    const pos = stmt.position.get(userId, outs[idx].id) || { user_id: userId, outcome_id: outs[idx].id, shares: 0, cost: 0, realized: 0 };

    let fillShares, fillAmount;
    if (side === 'buy') {
      fillAmount = round2(Number(amount));
      if (!(fillAmount >= MIN_TRADE)) throw new ApiError(400, `Minimum trade is ${MIN_TRADE} KC`);
      if (fillAmount > user.balance + EPS) throw new ApiError(400, 'Insufficient balance');
      fillShares = lmsr.sharesForAmount(qs, market.b, idx, fillAmount);
    } else if (side === 'sell') {
      fillShares = Number(shares);
      if (!(fillShares > 0)) throw new ApiError(400, 'Enter a number of shares to sell');
      if (fillShares > pos.shares + EPS) throw new ApiError(400, "You don't hold that many shares");
      fillShares = Math.min(fillShares, pos.shares);
      fillAmount = floor2(-lmsr.costToTrade(qs, market.b, idx, -fillShares));
    } else {
      throw new ApiError(400, 'side must be buy or sell');
    }

    const nextQs = qs.slice();
    nextQs[idx] += side === 'buy' ? fillShares : -fillShares;
    const before = lmsr.prices(qs, market.b);
    const after = lmsr.prices(nextQs, market.b);
    const result = {
      side, outcome_id: outs[idx].id, outcome: outs[idx].label,
      shares: fillShares, amount: fillAmount,
      avg_price: fillAmount / fillShares,
      price_before: before[idx], price_after: after[idx],
      max_payout: side === 'buy' ? pos.shares + fillShares : pos.shares - fillShares,
    };
    if (dryRun) return result;

    if (side === 'buy') {
      pos.shares += fillShares;
      pos.cost += fillAmount;
      stmt.setBalance.run(round2(user.balance - fillAmount), userId);
    } else {
      const basisSold = pos.shares > 0 ? pos.cost * (fillShares / pos.shares) : 0;
      pos.shares -= fillShares;
      pos.cost -= basisSold;
      pos.realized += fillAmount - basisSold;
      if (pos.shares < EPS) { pos.shares = 0; pos.cost = 0; }
      stmt.setBalance.run(round2(user.balance + fillAmount), userId);
    }
    stmt.upsertPosition.run(pos);
    stmt.setQ.run(nextQs[idx], outs[idx].id);
    stmt.addTrade.run(userId, marketId, outs[idx].id, side, fillShares, fillAmount, ts);
    stmt.addHistory.run(marketId, JSON.stringify(after), ts);
    result.balance = round2(stmt.userById.get(userId).balance);
    return result;
  })();
}

// Settle every market on a fixture from the final score. Winning shares pay 1 KC each.
function settleFixture(fixtureId, homeScore, awayScore) {
  return db.transaction(() => {
    const f = stmt.fixture.get(fixtureId);
    if (!f) throw new ApiError(404, 'Fixture not found');
    if (f.status !== 'scheduled') throw new ApiError(400, `Fixture already ${f.status}`);
    let paid = 0;
    for (const m of stmt.marketsForFixture.all(fixtureId)) {
      const winner = MARKET_TYPES[m.type].resolve(homeScore, awayScore);
      for (const o of stmt.outcomes.all(m.id)) {
        const holders = db.prepare('SELECT * FROM positions WHERE outcome_id = ? AND shares > 0').all(o.id);
        for (const p of holders) {
          const payout = o.code === winner ? round2(p.shares) : 0;
          if (payout) {
            db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(payout, p.user_id);
            paid += payout;
          }
          stmt.upsertPosition.run({ ...p, realized: p.realized + payout - p.cost, shares: 0, cost: 0 });
        }
      }
      db.prepare("UPDATE markets SET status = 'settled', winning_outcome = ? WHERE id = ?").run(winner, m.id);
    }
    db.prepare("UPDATE fixtures SET status = 'settled', home_score = ?, away_score = ? WHERE id = ?").run(homeScore, awayScore, fixtureId);
    return { paid: round2(paid) };
  })();
}

// Void a fixture (e.g. postponed): refund each holder's remaining cost basis.
function voidFixture(fixtureId) {
  return db.transaction(() => {
    const f = stmt.fixture.get(fixtureId);
    if (!f) throw new ApiError(404, 'Fixture not found');
    if (f.status !== 'scheduled') throw new ApiError(400, `Fixture already ${f.status}`);
    let refunded = 0;
    for (const m of stmt.marketsForFixture.all(fixtureId)) {
      for (const o of stmt.outcomes.all(m.id)) {
        for (const p of db.prepare('SELECT * FROM positions WHERE outcome_id = ? AND shares > 0').all(o.id)) {
          const refund = round2(p.cost);
          db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(refund, p.user_id);
          refunded += refund;
          stmt.upsertPosition.run({ ...p, shares: 0, cost: 0 });
        }
      }
      db.prepare("UPDATE markets SET status = 'void' WHERE id = ?").run(m.id);
    }
    db.prepare("UPDATE fixtures SET status = 'void' WHERE id = ?").run(fixtureId);
    return { refunded: round2(refunded) };
  })();
}

function marketView(m, { history = false } = {}) {
  const outs = stmt.outcomes.all(m.id);
  const ps = lmsr.prices(outs.map(o => o.q), m.b);
  const vol = db.prepare('SELECT COALESCE(SUM(amount), 0) AS v FROM trades WHERE market_id = ?').get(m.id).v;
  const view = {
    id: m.id, type: m.type, question: m.question, status: m.status, liquidity: m.b,
    winning_outcome: m.winning_outcome, volume: round2(vol),
    outcomes: outs.map((o, i) => ({ id: o.id, code: o.code, label: o.label, price: ps[i] })),
  };
  if (history) {
    view.history = db.prepare('SELECT prices, created_at FROM price_history WHERE market_id = ? ORDER BY id')
      .all(m.id).map(h => ({ t: h.created_at, prices: JSON.parse(h.prices) }));
  }
  return view;
}

function fixtureView(f, opts) {
  const markets = stmt.marketsForFixture.all(f.id).map(m => marketView(m, opts));
  return {
    id: f.id, competition: f.competition, home: f.home, away: f.away, kickoff: f.kickoff,
    state: fixtureState(f), home_score: f.home_score, away_score: f.away_score,
    volume: round2(markets.reduce((s, m) => s + m.volume, 0)), markets,
  };
}

// Mark-to-market value of a user's open positions.
function openPositions(userId) {
  const rows = db.prepare(`
    SELECT p.*, o.code, o.label, o.market_id, m.type, m.question, m.b, m.fixture_id,
           f.home, f.away, f.kickoff, f.competition, f.status AS fixture_status
    FROM positions p JOIN outcomes o ON o.id = p.outcome_id JOIN markets m ON m.id = o.market_id
    JOIN fixtures f ON f.id = m.fixture_id
    WHERE p.user_id = ? AND p.shares > 0 AND m.status = 'open' ORDER BY f.kickoff`).all(userId);
  const priceCache = {};
  return rows.map(r => {
    if (!priceCache[r.market_id]) {
      const outs = stmt.outcomes.all(r.market_id);
      priceCache[r.market_id] = Object.fromEntries(lmsr.prices(outs.map(o => o.q), r.b).map((p, i) => [outs[i].id, p]));
    }
    const price = priceCache[r.market_id][r.outcome_id];
    return {
      outcome_id: r.outcome_id, market_id: r.market_id, fixture_id: r.fixture_id,
      fixture: `${r.home} v ${r.away}`, competition: r.competition, kickoff: r.kickoff,
      state: fixtureState({ status: r.fixture_status, kickoff: r.kickoff }),
      question: r.question, outcome: r.label, shares: r.shares, cost: round2(r.cost),
      price, value: round2(r.shares * price), unrealized: round2(r.shares * price - r.cost),
    };
  });
}

function netWorth(user) {
  const value = openPositions(user.id).reduce((s, p) => s + p.value, 0);
  return { balance: round2(user.balance), positions_value: round2(value), net_worth: round2(user.balance + value), profit: round2(user.balance + value - user.granted) };
}

// ── App & middleware ─────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : true }));
app.use(express.json({ limit: '50kb' }));

function loadUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return token ? stmt.session.get(token) : undefined;
}
const optionalAuth = (req, res, next) => { req.user = loadUser(req); next(); };
const requireAuth = (req, res, next) => {
  req.user = loadUser(req);
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  next();
};
const requireAdmin = (req, res, next) => requireAuth(req, res, () => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admins only' });
  next();
});
const wrap = fn => (req, res, next) => { try { res.json(fn(req, res)); } catch (e) { next(e); } };

// ── Auth ──────────────────────────────────────────────────────────────────────
function issueSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, now());
  return token;
}

app.post('/api/auth/register', wrap(req => {
  const { username = '', password = '' } = req.body || {};
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new ApiError(400, 'Username must be 3–20 letters, numbers or underscores');
  if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');
  if (stmt.userByName.get(username)) throw new ApiError(409, 'That username is taken');
  const humans = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_bot = 0').get().n;
  const isAdmin = ADMIN_USERS.length ? ADMIN_USERS.includes(username.toLowerCase()) : humans === 0;
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO users (username, pass_hash, balance, granted, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(username, hashPassword(password), STARTING_BALANCE, STARTING_BALANCE, isAdmin ? 1 : 0, now());
  return { token: issueSession(lastInsertRowid), user: publicUser(stmt.userById.get(lastInsertRowid)) };
}));

app.post('/api/auth/login', wrap(req => {
  const { username = '', password = '' } = req.body || {};
  const u = stmt.userByName.get(username);
  if (!u || u.is_bot || !verifyPassword(password, u.pass_hash)) throw new ApiError(401, 'Wrong username or password');
  return { token: issueSession(u.id), user: publicUser(u) };
}));

app.post('/api/auth/logout', requireAuth, wrap(req => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.headers.authorization.replace(/^Bearer\s+/i, ''));
  return { ok: true };
}));

app.get('/api/me', requireAuth, wrap(req => ({ ...publicUser(req.user), ...netWorth(req.user) })));

app.post('/api/me/bonus', requireAuth, wrap(req => {
  if (!canClaimBonus(req.user)) throw new ApiError(400, 'Bonus already claimed — come back tomorrow');
  db.prepare('UPDATE users SET balance = balance + ?, granted = granted + ?, last_bonus_at = ? WHERE id = ?')
    .run(DAILY_BONUS, DAILY_BONUS, now(), req.user.id);
  return publicUser(stmt.userById.get(req.user.id));
}));

// ── Fixtures & markets ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/competitions', wrap(() =>
  db.prepare('SELECT competition, COUNT(*) AS fixtures FROM fixtures GROUP BY competition ORDER BY competition').all()));

app.get('/api/fixtures', wrap(req => {
  const { state = 'open', competition } = req.query;
  let rows = db.prepare('SELECT * FROM fixtures ORDER BY kickoff').all();
  if (competition) rows = rows.filter(f => f.competition === competition);
  if (state !== 'all') rows = rows.filter(f => fixtureState(f) === state);
  if (state === 'settled' || state === 'void') rows.reverse();
  return rows.slice(0, 100).map(f => fixtureView(f));
}));

app.get('/api/fixtures/:id', optionalAuth, wrap(req => {
  const f = stmt.fixture.get(req.params.id);
  if (!f) throw new ApiError(404, 'Fixture not found');
  const view = fixtureView(f, { history: true });
  view.recent_trades = db.prepare(`
    SELECT t.side, t.shares, t.amount, t.created_at, u.username, o.label AS outcome, m.question
    FROM trades t JOIN users u ON u.id = t.user_id JOIN outcomes o ON o.id = t.outcome_id JOIN markets m ON m.id = t.market_id
    WHERE m.fixture_id = ? ORDER BY t.id DESC LIMIT 20`).all(f.id);
  if (req.user) {
    view.my_positions = db.prepare(`
      SELECT p.outcome_id, p.shares, p.cost, p.realized FROM positions p JOIN outcomes o ON o.id = p.outcome_id
      JOIN markets m ON m.id = o.market_id WHERE p.user_id = ? AND m.fixture_id = ?`).all(req.user.id, f.id);
  }
  return view;
}));

app.post('/api/markets/:id/quote', requireAuth, wrap(req =>
  trade({ ...req.body, userId: req.user.id, marketId: Number(req.params.id), dryRun: true })));

app.post('/api/markets/:id/trade', requireAuth, wrap(req =>
  trade({ ...req.body, userId: req.user.id, marketId: Number(req.params.id) })));

// ── Portfolio, leaderboard, activity ─────────────────────────────────────────
app.get('/api/portfolio', requireAuth, wrap(req => {
  const settled = db.prepare(`
    SELECT o.label AS outcome, m.question, m.status, m.winning_outcome, o.code, f.id AS fixture_id,
           f.home, f.away, f.home_score, f.away_score, f.kickoff, p.realized
    FROM positions p JOIN outcomes o ON o.id = p.outcome_id JOIN markets m ON m.id = o.market_id
    JOIN fixtures f ON f.id = m.fixture_id
    WHERE p.user_id = ? AND m.status != 'open' ORDER BY f.kickoff DESC LIMIT 100`).all(req.user.id)
    .map(r => ({ ...r, realized: round2(r.realized), won: r.status === 'settled' && r.code === r.winning_outcome }));
  return { ...publicUser(req.user), ...netWorth(req.user), open: openPositions(req.user.id), settled };
}));

app.get('/api/leaderboard', wrap(() => {
  const users = db.prepare('SELECT * FROM users').all();
  const trades = Object.fromEntries(db.prepare('SELECT user_id, COUNT(*) AS n FROM trades GROUP BY user_id').all().map(r => [r.user_id, r.n]));
  return users.map(u => ({ username: u.username, is_bot: !!u.is_bot, trades: trades[u.id] || 0, ...netWorth(u) }))
    .filter(u => u.trades > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 50)
    .map((u, i) => ({ rank: i + 1, ...u }));
}));

app.get('/api/activity', wrap(() => db.prepare(`
  SELECT t.side, t.shares, t.amount, t.created_at, u.username, o.label AS outcome, m.question,
         f.id AS fixture_id, f.home, f.away
  FROM trades t JOIN users u ON u.id = t.user_id JOIN outcomes o ON o.id = t.outcome_id
  JOIN markets m ON m.id = t.market_id JOIN fixtures f ON f.id = m.fixture_id
  ORDER BY t.id DESC LIMIT 30`).all()));

// ── Admin ─────────────────────────────────────────────────────────────────────
app.post('/api/admin/fixtures', requireAdmin, wrap(req => {
  const { competition, home, away, kickoff, probs, liquidity } = req.body || {};
  if (![competition, home, away].every(s => typeof s === 'string' && s.trim())) throw new ApiError(400, 'competition, home and away are required');
  if (isNaN(new Date(kickoff))) throw new ApiError(400, 'kickoff must be a valid date');
  const b = Number(liquidity) || DEFAULT_LIQUIDITY;
  if (b < 10 || b > 100000) throw new ApiError(400, 'liquidity must be between 10 and 100000');
  const p = probs || {};
  for (const k of ['home', 'draw', 'away', 'over25', 'btts']) {
    if (p[k] !== undefined && !(p[k] > 0 && p[k] < 1)) throw new ApiError(400, `probs.${k} must be between 0 and 1`);
  }
  const id = createFixture({ competition: competition.trim(), home: home.trim(), away: away.trim(), kickoff, probs: p, liquidity: b });
  return fixtureView(stmt.fixture.get(id));
}));

app.post('/api/admin/fixtures/:id/settle', requireAdmin, wrap(req => {
  const h = Number(req.body?.home_score), a = Number(req.body?.away_score);
  if (![h, a].every(n => Number.isInteger(n) && n >= 0)) throw new ApiError(400, 'Scores must be whole numbers ≥ 0');
  return settleFixture(Number(req.params.id), h, a);
}));

app.post('/api/admin/fixtures/:id/void', requireAdmin, wrap(req => voidFixture(Number(req.params.id))));

// ── Errors, static frontend, start ───────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

// In production, serve the built frontend from the same origin.
const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(dist)) app.use(express.static(dist));

if (process.env.SEED_DEMO !== 'false' && db.prepare('SELECT COUNT(*) AS n FROM fixtures').get().n === 0) {
  require('./seed')({ db, createFixture, trade, settleFixture, hashPassword, STARTING_BALANCE });
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`♞ GameKnight API on http://localhost:${PORT}`));
}

module.exports = { app, db, createFixture, trade, settleFixture, voidFixture };
