// GameKnight API — football prediction exchange.
// Play-money: users trade YES/NO shares with Knight Coins (KC). 100¢ = 1 KC.
//
// Modules: db.js (schema) · exchange.js (order book + matching) · events.js (markets,
// odds model, resolution) · marketmaker.js (house liquidity) · feed.js (fixtures/results)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const express = require('express');
const cors = require('cors');
const db = require('./db');
const ex = require('./exchange');
const events = require('./events');
const mm = require('./marketmaker');
const feed = require('./feed');
const { ApiError, now } = ex;

const PORT = process.env.PORT || 4000;
const ADMIN_USERS = (process.env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const STARTING_BALANCE = 1000_00;
const DAILY_BONUS = 100_00;

// ── Auth helpers ──────────────────────────────────────────────────────────────
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(crypto.scryptSync(pw, salt, 64), Buffer.from(hash, 'hex'));
}
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

function loadUser(req) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    const row = db.prepare('SELECT u.*, k.id AS key_id FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash = ?').get(sha256(apiKey));
    if (row) db.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?').run(now(), row.key_id);
    return row;
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return token ? db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?').get(token) : undefined;
}

const canClaimBonus = u => !u.last_bonus_at || Date.now() - new Date(u.last_bonus_at) >= 864e5;

// ── Valuation ─────────────────────────────────────────────────────────────────
function priceMap(marketIds) {
  const out = {};
  for (const id of marketIds) {
    const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(id);
    out[id] = ex.displayPrice(m);
  }
  return out;
}

function openPositions(userId) {
  const rows = db.prepare(`SELECT p.*, m.label, m.question, m.code, m.grp, m.status AS market_status, m.event_id,
      e.title AS event_title, e.slug, e.kind, e.competition, e.closes_at, e.status AS event_status
    FROM positions p JOIN markets m ON m.id = p.market_id JOIN events e ON e.id = m.event_id
    WHERE p.user_id = ? AND (p.yes > 0 OR p.no > 0) ORDER BY e.closes_at`).all(userId);
  const prices = priceMap([...new Set(rows.map(r => r.market_id))]);
  const out = [];
  for (const r of rows) {
    const price = prices[r.market_id];
    for (const [outcome, shares, cost] of [['YES', r.yes, r.yes_cost], ['NO', r.no, r.no_cost]]) {
      if (!shares) continue;
      const px = outcome === 'YES' ? price : 100 - price;
      out.push({
        market_id: r.market_id, event_id: r.event_id, slug: r.slug, event_title: r.event_title, competition: r.competition,
        question: r.question, label: r.label, outcome, shares, avg_price: cost / shares, cost, price: px,
        value: shares * px, pnl: shares * px - cost, closes_at: r.closes_at,
        state: events.eventState({ status: r.event_status, closes_at: r.closes_at }),
      });
    }
  }
  return out;
}

function accountValue(user) {
  const positions = openPositions(user.id);
  const posValue = positions.reduce((s, p) => s + p.value, 0);
  const escrow = db.prepare("SELECT COALESCE(SUM(price * (size - filled)), 0) AS v FROM orders WHERE user_id = ? AND status = 'open' AND side = 'buy'").get(user.id).v;
  const total = user.balance + escrow + posValue;
  return { cash: user.balance, in_orders: escrow, positions_value: posValue, portfolio: total, profit: total - user.granted, positions };
}

// Cash on the maker's side of a fill: same as the taker's when they traded the same
// outcome (a transfer), the complement when they were on opposite outcomes (mint/merge)
const MAKER_CASH = 'CASE WHEN t.taker_outcome = t.maker_outcome THEN t.notional ELSE t.size * 100 - t.notional END';

function userVolume(userId, since) {
  return db.prepare(`SELECT COALESCE(SUM(CASE WHEN taker_id = @u THEN notional ELSE 0 END)
      + SUM(CASE WHEN maker_id = @u THEN ${MAKER_CASH.replace(/t\./g, '')} ELSE 0 END), 0) AS v
    FROM trades WHERE (taker_id = @u OR maker_id = @u) AND created_at >= @since`).get({ u: userId, since: since || '' }).v;
}

function publicUser(u) {
  const { positions, ...value } = accountValue(u);
  return {
    id: u.id, username: u.username, is_admin: !!u.is_admin, balance: u.balance, ...value,
    open_positions: positions.length, can_claim_bonus: canClaimBonus(u),
  };
}

// ── Read models ──────────────────────────────────────────────────────────────
const since24h = () => new Date(Date.now() - 864e5).toISOString();

function marketView(m) {
  const qt = ex.quotes(m.id);
  const vol = db.prepare('SELECT COALESCE(SUM(notional), 0) AS v FROM trades WHERE market_id = ?').get(m.id).v;
  const prev = db.prepare('SELECT price FROM price_history WHERE market_id = ? AND created_at <= ? ORDER BY id DESC LIMIT 1').get(m.id, since24h());
  const price = ex.displayPrice(m, qt);
  return {
    id: m.id, code: m.code, label: m.label, question: m.question, grp: m.grp, rules: m.rules,
    status: m.status, outcome: m.outcome, price, change_24h: prev ? price - prev.price : 0,
    last_price: m.last_price, volume: vol, ...qt,
  };
}

function eventView(ev, { full = false } = {}) {
  const markets = db.prepare('SELECT * FROM markets WHERE event_id = ? ORDER BY sort').all(ev.id).map(marketView);
  const ids = markets.map(m => m.id);
  const ph = ids.map(() => '?').join(',');
  const vol24 = ids.length ? db.prepare(`SELECT COALESCE(SUM(notional), 0) AS v FROM trades WHERE market_id IN (${ph}) AND created_at >= ?`).get(...ids, since24h()).v : 0;
  const liquidity = ids.length ? db.prepare(`SELECT COALESCE(SUM((size - filled) * price), 0) AS v FROM orders WHERE status = 'open' AND market_id IN (${ph})`).get(...ids).v : 0;
  const view = {
    id: ev.id, slug: ev.slug, kind: ev.kind, competition: ev.competition, title: ev.title, home: ev.home, away: ev.away,
    starts_at: ev.starts_at, closes_at: ev.closes_at, state: events.eventState(ev), home_score: ev.home_score, away_score: ev.away_score,
    volume: markets.reduce((s, m) => s + m.volume, 0), volume_24h: vol24, liquidity,
    comments: db.prepare('SELECT COUNT(*) AS n FROM comments WHERE event_id = ?').get(ev.id).n,
    markets,
  };
  if (full) view.description = ev.description;
  return view;
}

function findEvent(idOrSlug) {
  const ev = /^\d+$/.test(idOrSlug)
    ? db.prepare('SELECT * FROM events WHERE id = ?').get(idOrSlug)
    : db.prepare('SELECT * FROM events WHERE slug = ?').get(idOrSlug);
  if (!ev) throw new ApiError(404, 'Event not found');
  return ev;
}

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : true }));
app.use(express.json({ limit: '50kb' }));

// Token-bucket rate limiting per IP (or per user when authenticated)
const buckets = new Map();
function rateLimit(name, perMinute) {
  return (req, res, next) => {
    const id = `${name}:${req.user?.id || req.ip}`;
    const t = Date.now();
    const b = buckets.get(id) || { tokens: perMinute, at: t };
    b.tokens = Math.min(perMinute, b.tokens + ((t - b.at) / 60e3) * perMinute);
    b.at = t;
    if (b.tokens < 1) return res.status(429).json({ error: 'Too many requests — slow down a moment' });
    b.tokens -= 1;
    buckets.set(id, b);
    next();
  };
}
setInterval(() => { const cut = Date.now() - 10 * 60e3; for (const [k, b] of buckets) if (b.at < cut) buckets.delete(k); }, 60e3).unref();

const optionalAuth = (req, res, next) => { req.user = loadUser(req); next(); };
const requireAuth = (req, res, next) => {
  req.user = loadUser(req);
  if (!req.user) return res.status(401).json({ error: 'Sign in required' });
  if (req.user.is_bot) return res.status(403).json({ error: 'Bot accounts cannot use the API' });
  next();
};
const requireAdmin = (req, res, next) => requireAuth(req, res, () => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admins only' });
  next();
});
const wrap = fn => async (req, res, next) => { try { res.json(await fn(req, res)); } catch (e) { next(e); } };

app.get('/api/health', (req, res) => res.json({ ok: true, time: now() }));

// ── Auth & account ────────────────────────────────────────────────────────────
function issueSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, now());
  return token;
}

app.post('/api/auth/register', rateLimit('auth', 10), wrap(req => {
  const { username = '', password = '' } = req.body || {};
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new ApiError(400, 'Username must be 3–20 letters, numbers or underscores');
  if (typeof password !== 'string' || password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new ApiError(409, 'That username is taken');
  const humans = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_bot = 0').get().n;
  const isAdmin = ADMIN_USERS.length ? ADMIN_USERS.includes(username.toLowerCase()) : humans === 0;
  const id = db.transaction(() => {
    const { lastInsertRowid } = db.prepare('INSERT INTO users (username, pass_hash, granted, is_admin, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(username, hashPassword(password), STARTING_BALANCE, isAdmin ? 1 : 0, now());
    ex.credit(lastInsertRowid, STARTING_BALANCE, 'signup', null);
    return lastInsertRowid;
  })();
  return { token: issueSession(id), user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
}));

app.post('/api/auth/login', rateLimit('auth', 10), wrap(req => {
  const { username = '', password = '' } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username));
  if (!u || u.is_bot || !verifyPassword(String(password), u.pass_hash)) throw new ApiError(401, 'Wrong username or password');
  return { token: issueSession(u.id), user: publicUser(u) };
}));

app.post('/api/auth/logout', requireAuth, wrap(req => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  return { ok: true };
}));

app.get('/api/me', requireAuth, wrap(req => publicUser(req.user)));

app.post('/api/me/bonus', requireAuth, wrap(req => {
  if (!canClaimBonus(req.user)) throw new ApiError(400, 'Daily bonus already claimed — come back tomorrow');
  db.transaction(() => {
    ex.credit(req.user.id, DAILY_BONUS, 'bonus', null);
    db.prepare('UPDATE users SET granted = granted + ?, last_bonus_at = ? WHERE id = ?').run(DAILY_BONUS, now(), req.user.id);
  })();
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id));
}));

app.put('/api/me/profile', requireAuth, wrap(req => {
  const bio = String(req.body?.bio || '').slice(0, 280);
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(bio, req.user.id);
  return { ok: true };
}));

// API keys for programmatic trading (market makers, bots, integrations)
app.get('/api/keys', requireAuth, wrap(req =>
  db.prepare('SELECT id, prefix, label, last_used_at, created_at FROM api_keys WHERE user_id = ? ORDER BY id DESC').all(req.user.id)));
app.post('/api/keys', requireAuth, rateLimit('keys', 5), wrap(req => {
  if (req.headers['x-api-key']) throw new ApiError(403, 'API keys cannot create API keys');
  const count = db.prepare('SELECT COUNT(*) AS n FROM api_keys WHERE user_id = ?').get(req.user.id).n;
  if (count >= 5) throw new ApiError(400, 'Maximum 5 API keys — revoke one first');
  const key = `gk_${crypto.randomBytes(24).toString('base64url')}`;
  const label = String(req.body?.label || 'API key').slice(0, 40);
  db.prepare('INSERT INTO api_keys (user_id, key_hash, prefix, label, created_at) VALUES (?, ?, ?, ?, ?)').run(req.user.id, sha256(key), key.slice(0, 7), label, now());
  return { key, label, note: 'Store this key now — it will not be shown again.' };
}));
app.delete('/api/keys/:id', requireAuth, wrap(req => {
  const r = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!r.changes) throw new ApiError(404, 'Key not found');
  return { ok: true };
}));

// ── Discovery ────────────────────────────────────────────────────────────────
app.get('/api/categories', wrap(() => db.prepare(`SELECT competition AS name, COUNT(*) AS events FROM events
  WHERE status = 'open' AND closes_at > ? GROUP BY competition ORDER BY events DESC`).all(now())));

app.get('/api/events', wrap(req => {
  const { category, q: search, sort = 'trending', status = 'open', kind } = req.query;
  let rows = db.prepare('SELECT * FROM events ORDER BY closes_at').all();
  if (category) rows = rows.filter(e => e.competition === category);
  if (kind) rows = rows.filter(e => e.kind === kind);
  if (search) {
    const s = String(search).toLowerCase();
    rows = rows.filter(e => `${e.title} ${e.competition}`.toLowerCase().includes(s)
      || db.prepare('SELECT 1 FROM markets WHERE event_id = ? AND lower(label) LIKE ?').get(e.id, `%${s}%`));
  }
  if (status !== 'all') {
    const want = status === 'resolved' ? ['resolved', 'void'] : [status];
    rows = rows.filter(e => want.includes(events.eventState(e)));
  }
  let views = rows.slice(0, 200).map(e => eventView(e));
  const sorters = {
    trending: (a, b) => b.volume_24h - a.volume_24h || b.volume - a.volume,
    volume: (a, b) => b.volume - a.volume,
    liquidity: (a, b) => b.liquidity - a.liquidity,
    ending: (a, b) => new Date(a.closes_at) - new Date(b.closes_at),
    new: (a, b) => b.id - a.id,
  };
  views.sort(sorters[sort] || sorters.trending);
  if (status === 'resolved') views.sort((a, b) => new Date(b.closes_at) - new Date(a.closes_at));
  return views.slice(0, 60);
}));

app.get('/api/events/:id', optionalAuth, wrap(req => {
  const ev = findEvent(req.params.id);
  const view = eventView(ev, { full: true });
  if (req.user) {
    const ids = view.markets.map(m => m.id);
    view.my_positions = openPositions(req.user.id).filter(p => p.event_id === ev.id);
    view.my_orders = db.prepare(`SELECT * FROM orders WHERE user_id = ? AND status = 'open' AND market_id IN (${ids.map(() => '?').join(',')}) ORDER BY id DESC`).all(req.user.id, ...ids);
  }
  return view;
}));

const RANGES = { '1d': 864e5, '1w': 7 * 864e5, '1m': 30 * 864e5 };
app.get('/api/events/:id/history', wrap(req => {
  const ev = findEvent(req.params.id);
  const span = RANGES[req.query.range];
  const from = span ? new Date(Date.now() - span).toISOString() : '';
  const out = {};
  for (const m of db.prepare('SELECT id FROM markets WHERE event_id = ?').all(ev.id)) {
    // Carry the last price before the window in, so every line starts at the left edge
    const before = from ? db.prepare('SELECT price FROM price_history WHERE market_id = ? AND created_at < ? ORDER BY id DESC LIMIT 1').get(m.id, from) : null;
    const pts = db.prepare('SELECT price AS p, created_at AS t FROM price_history WHERE market_id = ? AND created_at >= ? ORDER BY id').all(m.id, from);
    if (before) pts.unshift({ p: before.price, t: from });
    out[m.id] = pts;
  }
  return out;
}));

app.get('/api/events/:id/activity', wrap(req => {
  const ev = findEvent(req.params.id);
  return db.prepare(`SELECT t.id, t.price, t.size, t.notional, t.taker_outcome AS outcome, t.taker_side AS side, t.created_at,
      u.username, m.label, m.id AS market_id
    FROM trades t JOIN markets m ON m.id = t.market_id JOIN users u ON u.id = t.taker_id
    WHERE m.event_id = ? ORDER BY t.id DESC LIMIT 50`).all(ev.id);
}));

app.get('/api/markets/:id/book', wrap(req => {
  const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(req.params.id);
  if (!m) throw new ApiError(404, 'Market not found');
  return { ...ex.orderBook(m.id), ...ex.quotes(m.id), last_price: m.last_price };
}));

app.get('/api/markets/:id/holders', wrap(req => {
  const top = col => db.prepare(`SELECT u.username, p.${col} AS shares FROM positions p JOIN users u ON u.id = p.user_id
    WHERE p.market_id = ? AND p.${col} > 0 AND u.is_house = 0 ORDER BY p.${col} DESC LIMIT 10`).all(req.params.id);
  return { yes: top('yes'), no: top('no') };
}));

// ── Comments ─────────────────────────────────────────────────────────────────
app.get('/api/events/:id/comments', wrap(req => {
  const ev = findEvent(req.params.id);
  const marketIds = db.prepare('SELECT id FROM markets WHERE event_id = ?').all(ev.id).map(r => r.id);
  return db.prepare(`SELECT c.id, c.body, c.created_at, u.username FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.event_id = ? ORDER BY c.id DESC LIMIT 100`).all(ev.id).map(c => {
    // Show each commenter's current stake, like Polymarket's holder badges
    const u = db.prepare('SELECT id FROM users WHERE username = ?').get(c.username);
    const pos = db.prepare(`SELECT m.label, p.yes, p.no FROM positions p JOIN markets m ON m.id = p.market_id
      WHERE p.user_id = ? AND p.market_id IN (${marketIds.map(() => '?').join(',')}) AND (p.yes > 0 OR p.no > 0)
      ORDER BY (p.yes + p.no) DESC LIMIT 1`).get(u.id, ...marketIds);
    return { ...c, holding: pos ? { label: pos.label, outcome: pos.yes >= pos.no ? 'YES' : 'NO', shares: Math.max(pos.yes, pos.no) } : null };
  });
}));

app.post('/api/events/:id/comments', requireAuth, rateLimit('comment', 6), wrap(req => {
  const ev = findEvent(req.params.id);
  const body = String(req.body?.body || '').trim();
  if (!body || body.length > 1000) throw new ApiError(400, 'Comments must be 1–1000 characters');
  const { lastInsertRowid } = db.prepare('INSERT INTO comments (event_id, user_id, body, created_at) VALUES (?, ?, ?, ?)').run(ev.id, req.user.id, body, now());
  ex.bus.emit('comment', { event_id: ev.id });
  return { id: lastInsertRowid, body, created_at: now(), username: req.user.username };
}));

// ── Trading ──────────────────────────────────────────────────────────────────
function orderInput(req, dryRun) {
  const b = req.body || {};
  return {
    userId: req.user.id, marketId: Number(b.market_id), outcome: b.outcome, side: b.side, type: b.type,
    price: b.price == null ? undefined : Number(b.price), size: b.size == null ? undefined : Number(b.size),
    amount: b.amount == null ? undefined : Number(b.amount), postOnly: !!b.post_only, dryRun,
  };
}

app.post('/api/orders/preview', requireAuth, rateLimit('preview', 240), wrap(req => ex.placeOrder(orderInput(req, true))));
app.post('/api/orders', requireAuth, rateLimit('order', 120), wrap(req => ex.placeOrder(orderInput(req, false))));

app.get('/api/orders', requireAuth, wrap(req => db.prepare(`SELECT o.*, m.label, m.question, e.title AS event_title, e.slug
  FROM orders o JOIN markets m ON m.id = o.market_id JOIN events e ON e.id = m.event_id
  WHERE o.user_id = ? AND o.status = ? ORDER BY o.id DESC LIMIT 200`).all(req.user.id, req.query.status === 'all' ? 'filled' : 'open')));

app.delete('/api/orders/:id', requireAuth, wrap(req => { ex.cancelOrder(req.user.id, Number(req.params.id)); return { ok: true }; }));
app.delete('/api/orders', requireAuth, wrap(req => {
  const marketId = req.query.market_id;
  const n = marketId
    ? ex.cancelAll('user_id = ? AND market_id = ?', [req.user.id, Number(marketId)])
    : ex.cancelAll('user_id = ?', [req.user.id]);
  return { cancelled: n };
}));

// ── Portfolio, profiles, leaderboard ────────────────────────────────────────
app.get('/api/portfolio', requireAuth, wrap(req => {
  const value = accountValue(req.user);
  const history = db.prepare(`SELECT t.id, t.price, t.size, t.notional, t.created_at, m.label, m.question, e.title AS event_title, e.slug,
      CASE WHEN t.taker_id = @u THEN t.taker_outcome ELSE t.maker_outcome END AS outcome,
      CASE WHEN t.taker_id = @u THEN t.taker_side ELSE t.maker_side END AS side,
      CASE WHEN t.taker_id = @u THEN t.notional ELSE ${MAKER_CASH} END AS cash
    FROM trades t JOIN markets m ON m.id = t.market_id JOIN events e ON e.id = m.event_id
    WHERE t.taker_id = @u OR t.maker_id = @u ORDER BY t.id DESC LIMIT 100`).all({ u: req.user.id });
  const settled = db.prepare(`SELECT p.realized, m.label, m.question, m.outcome, m.status, e.title AS event_title, e.slug, e.resolved_at
    FROM positions p JOIN markets m ON m.id = p.market_id JOIN events e ON e.id = m.event_id
    WHERE p.user_id = ? AND m.status != 'open' AND p.realized != 0 ORDER BY e.resolved_at DESC LIMIT 100`).all(req.user.id);
  return { ...publicUser(req.user), ...value, history, settled, volume: userVolume(req.user.id) };
}));

app.get('/api/users/:username', wrap(req => {
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(req.params.username);
  if (!u) throw new ApiError(404, 'User not found');
  const value = accountValue(u);
  const trades = db.prepare(`SELECT t.price, t.size, t.notional, t.taker_outcome AS outcome, t.taker_side AS side, t.created_at, m.label, e.title AS event_title, e.slug
    FROM trades t JOIN markets m ON m.id = t.market_id JOIN events e ON e.id = m.event_id WHERE t.taker_id = ? ORDER BY t.id DESC LIMIT 30`).all(u.id);
  return {
    username: u.username, bio: u.bio, joined: u.created_at, is_bot: !!u.is_bot, is_house: !!u.is_house,
    portfolio: value.portfolio, profit: u.is_house ? null : value.profit, positions: value.positions,
    volume: userVolume(u.id), trades: db.prepare('SELECT COUNT(*) AS n FROM trades WHERE taker_id = ? OR maker_id = ?').get(u.id, u.id).n,
    markets_traded: db.prepare('SELECT COUNT(*) AS n FROM positions WHERE user_id = ?').get(u.id).n,
    recent: trades,
  };
}));

app.get('/api/leaderboard', wrap(req => {
  const by = req.query.by === 'volume' ? 'volume' : 'profit';
  const since = req.query.period === 'week' ? new Date(Date.now() - 7 * 864e5).toISOString() : '';
  const users = db.prepare('SELECT * FROM users WHERE is_house = 0').all();
  return users.map(u => {
    const { profit, portfolio } = accountValue(u);
    return { username: u.username, is_bot: !!u.is_bot, profit, portfolio, volume: userVolume(u.id, since) };
  }).filter(u => u.volume > 0)
    .sort((a, b) => b[by] - a[by])
    .slice(0, 100)
    .map((u, i) => ({ rank: i + 1, ...u }));
}));

app.get('/api/activity', wrap(() => db.prepare(`SELECT t.id, t.price, t.size, t.notional, t.taker_outcome AS outcome, t.taker_side AS side, t.created_at,
    u.username, m.label, e.title AS event_title, e.slug
  FROM trades t JOIN users u ON u.id = t.taker_id JOIN markets m ON m.id = t.market_id JOIN events e ON e.id = m.event_id
  ORDER BY t.id DESC LIMIT 40`).all()));

app.get('/api/stats', wrap(() => ({
  volume_24h: db.prepare('SELECT COALESCE(SUM(notional), 0) AS v FROM trades WHERE created_at >= ?').get(since24h()).v,
  volume: db.prepare('SELECT COALESCE(SUM(notional), 0) AS v FROM trades').get().v,
  open_markets: db.prepare("SELECT COUNT(*) AS n FROM markets m JOIN events e ON e.id = m.event_id WHERE m.status = 'open' AND e.closes_at > ?").get(now()).n,
  traders: db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_bot = 0').get().n,
})));

// ── Live stream (Server-Sent Events) ────────────────────────────────────────
const clients = new Set();
app.get('/api/stream', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 3000\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});
function broadcast(type, payload) {
  const msg = `data: ${JSON.stringify({ type, ...payload })}\n\n`;
  for (const c of clients) c.write(msg);
}
for (const type of ['trade', 'book', 'event', 'comment']) ex.bus.on(type, p => broadcast(type, p));
setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 25e3).unref();

// ── Admin ────────────────────────────────────────────────────────────────────
app.post('/api/admin/events/match', requireAdmin, wrap(req => {
  const { competition, home, away, kickoff, xg_home, xg_away } = req.body || {};
  if (![competition, home, away].every(s => typeof s === 'string' && s.trim())) throw new ApiError(400, 'competition, home and away are required');
  if (new Date(kickoff) <= new Date()) throw new ApiError(400, 'Kick-off must be in the future');
  const id = events.createMatchEvent({ competition: competition.trim(), home: home.trim(), away: away.trim(), kickoff, xgHome: Number(xg_home) || 1.45, xgAway: Number(xg_away) || 1.15 });
  db.prepare('SELECT id FROM markets WHERE event_id = ?').all(id).forEach(m => mm.requote(m.id));
  return eventView(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
}));

app.post('/api/admin/events/outright', requireAdmin, wrap(req => {
  const { competition, title, question, closes_at, contenders, description } = req.body || {};
  if (![competition, title].every(s => typeof s === 'string' && s.trim())) throw new ApiError(400, 'competition and title are required');
  const id = events.createOutrightEvent({ competition, title, question, closesAt: closes_at, contenders, description });
  db.prepare('SELECT id FROM markets WHERE event_id = ?').all(id).forEach(m => mm.requote(m.id));
  return eventView(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
}));

app.post('/api/admin/events/:id/resolve', requireAdmin, wrap(req => {
  const ev = findEvent(req.params.id);
  if (ev.kind === 'match') {
    const h = Number(req.body?.home_score), a = Number(req.body?.away_score);
    if (![h, a].every(n => Number.isInteger(n) && n >= 0 && n < 50)) throw new ApiError(400, 'Scores must be whole numbers ≥ 0');
    return events.resolveMatch(ev.id, h, a);
  }
  return events.resolveOutright(ev.id, Number(req.body?.winner_market_id));
}));

app.post('/api/admin/markets/:id/resolve', requireAdmin, wrap(req => {
  const outcome = String(req.body?.outcome || '').toUpperCase();
  if (!['YES', 'NO', 'VOID'].includes(outcome)) throw new ApiError(400, 'outcome must be YES, NO or VOID');
  return events.resolveSingleMarket(Number(req.params.id), outcome);
}));

app.post('/api/admin/events/:id/void', requireAdmin, wrap(req => events.voidEvent(findEvent(req.params.id).id)));

app.post('/api/admin/feed/sync', requireAdmin, wrap(async () => {
  const r = await feed.sync();
  if (!r) throw new ApiError(400, 'Set FOOTBALL_DATA_TOKEN to enable the fixtures feed');
  mm.requoteAll();
  return r;
}));

// Reconciliation: every balance must equal the sum of its ledger entries, and every
// market must have equal YES and NO shares outstanding (they're only created in pairs).
app.get('/api/admin/health', requireAdmin, wrap(() => {
  const ledgerMismatch = db.prepare(`SELECT u.username, u.balance, COALESCE(SUM(l.delta), 0) AS ledger FROM users u
    LEFT JOIN ledger l ON l.user_id = u.id GROUP BY u.id HAVING u.balance != ledger`).all();
  const unbalanced = db.prepare('SELECT market_id, SUM(yes) AS yes, SUM(no) AS no FROM positions GROUP BY market_id HAVING SUM(yes) != SUM(no)').all();
  const house = db.prepare('SELECT * FROM users WHERE is_house = 1').get();
  return { ok: !ledgerMismatch.length && !unbalanced.length, ledger_mismatch: ledgerMismatch, unbalanced_markets: unbalanced, house: house && accountValue(house) };
}));

// ── Errors, static frontend, boot ────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(dist)) app.use(express.static(dist));

if (process.env.SEED_DEMO !== 'false' && !process.env.FOOTBALL_DATA_TOKEN && db.prepare('SELECT COUNT(*) AS n FROM events').get().n === 0) {
  require('./seed')({ hashPassword });
}
mm.start(hashPassword);
feed.start();
setInterval(() => { if (events.closeExpired()) mm.requoteAll(); }, 30e3).unref();

if (require.main === module) {
  app.listen(PORT, () => console.log(`♞ GameKnight exchange on http://localhost:${PORT}`));
}

module.exports = { app, db, hashPassword };
