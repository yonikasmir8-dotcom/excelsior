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
const money = require('./money');
const { ApiError, now } = ex;

const PORT = process.env.PORT || 4000;
const ADMIN_USERS = (process.env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
// Play money: free starting coins + daily bonus. Real money: players fund their own wallets.
const STARTING_BALANCE = () => (money.isReal() ? 0 : 1000_00);
const DAILY_BONUS = 100_00;
const AUTH_RATE = Number(process.env.AUTH_RATE_PER_MIN || 10);

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

const canClaimBonus = u => !money.isReal() && (!u.last_bonus_at || Date.now() - new Date(u.last_bonus_at) >= 864e5);

// ── Valuation ─────────────────────────────────────────────────────────────────
function priceMap(marketIds) {
  const out = {};
  for (const id of marketIds) {
    const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(id);
    out[id] = ex.displayPrice(m);
  }
  return out;
}

// Other outcomes in the same exclusive group (1X2 / outright), for opinion cards
function siblings(r) {
  if (!['result', 'winner'].includes(r.grp)) return null;
  return db.prepare("SELECT * FROM markets WHERE event_id = ? AND grp = ? ORDER BY last_price DESC LIMIT 4").all(r.event_id, r.grp)
    .map(m => ({ market_id: m.id, label: m.label, price: ex.displayPrice(m), outcome: m.outcome }));
}

function openPositions(userId) {
  const rows = db.prepare(`SELECT p.*, m.label, m.question, m.code, m.grp, m.status AS market_status, m.event_id, e.home, e.away,
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
        value: shares * px, pnl: shares * px - cost, closes_at: r.closes_at, grp: r.grp, code: r.code, kind: r.kind,
        home: r.home, away: r.away, state: events.eventState({ status: r.event_status, closes_at: r.closes_at }),
        siblings: siblings(r),
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
    last_price: m.last_price, volume: vol, ...qt, spark: spark(m.id, price),
  };
}

// ~24 evenly spaced prices over the last 7 days, for card sparklines
function spark(marketId, current) {
  const from = new Date(Date.now() - 7 * 864e5).toISOString();
  const start = db.prepare('SELECT price FROM price_history WHERE market_id = ? AND created_at < ? ORDER BY id DESC LIMIT 1').get(marketId, from);
  const rows = db.prepare('SELECT price, created_at FROM price_history WHERE market_id = ? AND created_at >= ? ORDER BY id').all(marketId, from);
  const out = [];
  let i = 0, last = start ? start.price : rows[0]?.price ?? current;
  for (let k = 0; k < 24; k++) {
    const t = new Date(Date.now() - 7 * 864e5 + (k / 23) * 7 * 864e5).toISOString();
    while (i < rows.length && rows[i].created_at <= t) last = rows[i++].price;
    out.push(last);
  }
  out[23] = current;
  return out;
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
    players: ids.length ? db.prepare(`SELECT COUNT(DISTINCT u) AS n FROM (SELECT taker_id AS u FROM trades WHERE market_id IN (${ph})
      UNION SELECT maker_id FROM trades WHERE market_id IN (${ph})) WHERE u NOT IN (SELECT id FROM users WHERE is_house = 1 OR is_system = 1)`).get(...ids, ...ids).n : 0,
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

app.post('/api/auth/register', rateLimit('auth', AUTH_RATE), wrap(req => {
  const { username = '', password = '' } = req.body || {};
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw new ApiError(400, 'Username must be 3–20 letters, numbers or underscores');
  if (typeof password !== 'string' || password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new ApiError(409, 'That username is taken');
  const humans = db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_bot = 0').get().n;
  const isAdmin = ADMIN_USERS.length ? ADMIN_USERS.includes(username.toLowerCase()) : humans === 0;
  const id = db.transaction(() => {
    const { lastInsertRowid } = db.prepare('INSERT INTO users (username, pass_hash, granted, is_admin, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(username, hashPassword(password), STARTING_BALANCE(), isAdmin ? 1 : 0, now());
    ex.credit(lastInsertRowid, STARTING_BALANCE(), 'signup', null);
    money.audit(lastInsertRowid, 'account.created', { ip: req.ip, mode: money.cfg().mode });
    return lastInsertRowid;
  })();
  return { token: issueSession(id), user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
}));

app.post('/api/auth/login', rateLimit('auth', AUTH_RATE), wrap(req => {
  const { username = '', password = '' } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username));
  if (!u || u.is_bot || !verifyPassword(String(password), u.pass_hash)) throw new ApiError(401, 'Wrong username or password');
  return { token: issueSession(u.id), user: publicUser(u) };
}));

app.post('/api/auth/logout', requireAuth, wrap(req => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
  return { ok: true };
}));

app.get('/api/me', requireAuth, wrap(req => ({ ...publicUser(req.user), mode: money.cfg().mode, gambling_block: money.gamblingBlock(req.user) })));

app.post('/api/me/bonus', requireAuth, wrap(req => {
  if (money.isReal()) throw new ApiError(400, 'Bonuses are not available on real-money accounts');
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

app.get('/api/events', optionalAuth, wrap(req => {
  const { category, q: search, sort = 'trending', status = 'open', kind, from, to, following } = req.query;
  let rows = db.prepare('SELECT * FROM events ORDER BY closes_at').all();
  if (from) rows = rows.filter(e => (e.starts_at || e.closes_at) >= from);
  if (to) rows = rows.filter(e => (e.starts_at || e.closes_at) < to);
  if (following && req.user) {
    const tags = db.prepare('SELECT tag FROM follows WHERE user_id = ?').all(req.user.id).map(r => r.tag);
    rows = rows.filter(e => tags.some(t => matchesTag(e, t)));
  }
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

// ── Money: config, wallet, identity, safer gambling ─────────────────────────
app.get('/api/config', wrap(() => {
  const c = money.cfg();
  return {
    mode: c.mode, currency: c.currency, symbol: c.symbol, fee_bps: c.feeBps, starting_balance: STARTING_BALANCE(), daily_bonus: money.isReal() ? 0 : DAILY_BONUS,
    min_deposit: c.minDeposit, max_deposit: c.maxDeposit, min_withdrawal: c.minWithdrawal, operator: c.operator, licence: c.licence,
  };
}));

app.get('/api/wallet', requireAuth, wrap(req => money.walletView(req.user)));
app.post('/api/wallet/deposits', requireAuth, geoGate, rateLimit('deposit', 10), wrap(req => money.deposit(req.user, req.body || {})));
app.post('/api/wallet/withdrawals', requireAuth, rateLimit('withdraw', 10), wrap(req => money.withdraw(req.user, req.body || {})));
app.post('/api/kyc', requireAuth, geoGate, rateLimit('kyc', 5), wrap(req => money.verifyIdentity(req.user, req.body || {})));
app.put('/api/rg/limits', requireAuth, wrap(req => money.setLimits(req.user.id, req.body || {})));
app.post('/api/rg/break', requireAuth, wrap(req => money.takeBreak(req.user.id, req.body?.hours)));
app.post('/api/rg/self-exclude', requireAuth, wrap(req => money.selfExclude(req.user.id, req.body?.months)));
app.post('/api/payments/webhook/:provider', wrap(req => {
  const p = money.provider('payments');
  if (p.name !== req.params.provider) throw new ApiError(404, 'Unknown provider');
  const evt = p.verifyWebhook(req);
  return money.settlePayment(evt.ref, evt.status, evt.reason);
}));
app.get('/api/admin/finance', requireAdmin, wrap(() => ({ ...money.fundsReport(), launch: (() => { try { return money.assertLaunchReady(); } catch (e) { return { ok: false, missing: e.missing } } })() })));
app.get('/api/admin/audit', requireAdmin, wrap(req => db.prepare(`SELECT a.*, u.username FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
  ${req.query.flags ? "WHERE a.action LIKE 'flag.%'" : ''} ORDER BY a.id DESC LIMIT 200`).all()));

// ── Tailored experience: follows + tags ─────────────────────────────────────
function matchesTag(ev, tag) {
  const [kind, ...rest] = tag.split(':');
  const v = rest.join(':');
  if (kind === 'comp') return ev.competition === v;
  if (kind === 'event') return String(ev.id) === v;
  if (kind === 'team' || kind === 'player') {
    return ev.home === v || ev.away === v
      || !!db.prepare('SELECT 1 FROM markets WHERE event_id = ? AND label = ?').get(ev.id, v);
  }
  return false;
}

app.get('/api/tags', wrap(() => {
  const teams = db.prepare("SELECT home AS name FROM events WHERE kind = 'match' UNION SELECT away FROM events WHERE kind = 'match'").all().map(r => r.name);
  const contenders = db.prepare("SELECT DISTINCT m.label, e.title FROM markets m JOIN events e ON e.id = m.event_id WHERE m.grp = 'winner'").all();
  const teamSet = new Set(teams);
  const players = [...new Set(contenders.filter(c => /scorer|boot|player/i.test(c.title) && !/^other/i.test(c.label)).map(c => c.label))];
  for (const c of contenders) if (!/scorer|boot|player/i.test(c.title) && !/^other/i.test(c.label)) teamSet.add(c.label);
  const comps = db.prepare('SELECT DISTINCT competition FROM events').all().map(r => r.competition);
  // Most-traded teams first, so the suggestion chips lead with what's hot
  const vol = {}
  for (const r of db.prepare(`SELECT e.home AS h, e.away AS a, COALESCE(SUM(t.notional), 0) AS v FROM events e
    JOIN markets m ON m.event_id = e.id LEFT JOIN trades t ON t.market_id = m.id WHERE e.kind = 'match' GROUP BY e.id`).all()) {
    vol[r.h] = (vol[r.h] || 0) + r.v
    vol[r.a] = (vol[r.a] || 0) + r.v
  }
  return [
    ...[...teamSet].sort((x, y) => (vol[y] || 0) - (vol[x] || 0) || x.localeCompare(y)).map(n => ({ tag: `team:${n}`, name: n, kind: 'team' })),
    ...players.map(n => ({ tag: `player:${n}`, name: n, kind: 'player' })),
    ...comps.map(n => ({ tag: `comp:${n}`, name: n, kind: 'comp' })),
  ];
}));

app.get('/api/me/follows', requireAuth, wrap(req => db.prepare('SELECT tag FROM follows WHERE user_id = ? ORDER BY created_at').all(req.user.id).map(r => r.tag)));
app.post('/api/me/follows', requireAuth, wrap(req => {
  const tag = String(req.body?.tag || '');
  if (!/^(team|player|comp|event):.{1,80}$/.test(tag)) throw new ApiError(400, 'Invalid tag');
  if (db.prepare('SELECT COUNT(*) AS n FROM follows WHERE user_id = ?').get(req.user.id).n >= 100) throw new ApiError(400, 'Following limit reached');
  db.prepare('INSERT OR IGNORE INTO follows (user_id, tag, created_at) VALUES (?, ?, ?)').run(req.user.id, tag, now());
  return { ok: true };
}));
app.delete('/api/me/follows', requireAuth, wrap(req => {
  db.prepare('DELETE FROM follows WHERE user_id = ? AND tag = ?').run(req.user.id, String(req.query.tag || ''));
  return { ok: true };
}));

// ── News: the market wire (results, movers, big calls, new listings) + optional RSS ──
let rssCache = { at: 0, items: [] };
async function rssItems() {
  const url = process.env.NEWS_RSS_URL;
  if (!url || typeof fetch !== 'function') return [];
  if (Date.now() - rssCache.at < 10 * 60e3) return rssCache.items;
  try {
    const xml = await (await fetch(url, { signal: AbortSignal.timeout(5000) })).text();
    const pick = (block, tag) => (block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`)) || [])[1]?.trim();
    rssCache = {
      at: Date.now(),
      items: [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20).map(([, b]) => ({
        kind: 'article', title: pick(b, 'title'), link: pick(b, 'link'), at: new Date(pick(b, 'pubDate') || Date.now()).toISOString(),
        image: (b.match(/<media:thumbnail[^>]*url="([^"]+)"/) || [])[1] || null, source: new URL(url).hostname.replace(/^www\.|^feeds\./, ''),
      })),
    };
  } catch { /* keep the last good copy */ }
  return rssCache.items;
}

app.get('/api/news', wrap(async () => {
  const items = [];
  for (const e of db.prepare("SELECT * FROM events WHERE status != 'open' ORDER BY resolved_at DESC LIMIT 8").all()) {
    const paid = db.prepare('SELECT COALESCE(SUM(s.payout), 0) AS v, COUNT(DISTINCT s.user_id) AS n FROM settlements s JOIN markets m ON m.id = s.market_id WHERE m.event_id = ?').get(e.id);
    items.push({
      kind: 'result', at: e.resolved_at, slug: e.slug, competition: e.competition, home: e.home, away: e.away,
      title: e.status === 'void' ? `${e.title} voided — every opinion refunded at 50%`
        : e.kind === 'match' ? `FT: ${e.home} ${e.home_score}–${e.away_score} ${e.away}` : `${e.title} settled`,
      body: `${paid.n} players paid out ₭${(paid.v / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })} across ${db.prepare('SELECT COUNT(*) AS n FROM markets WHERE event_id = ?').get(e.id).n} opinions.`,
    });
  }
  const open = db.prepare("SELECT m.*, e.slug, e.title AS event_title, e.competition, e.home, e.away FROM markets m JOIN events e ON e.id = m.event_id WHERE m.status = 'open' AND e.status = 'open' AND e.closes_at > ?").all(now());
  const movers = open.map(m => {
    const prev = db.prepare('SELECT price, created_at FROM price_history WHERE market_id = ? AND created_at <= ? ORDER BY id DESC LIMIT 1').get(m.id, since24h());
    const price = ex.displayPrice(m);
    return { m, price, move: prev ? price - prev.price : 0 };
  }).filter(x => Math.abs(x.move) >= 4).sort((a, b) => Math.abs(b.move) - Math.abs(a.move)).slice(0, 6);
  for (const { m, price, move } of movers) {
    const last = db.prepare('SELECT created_at FROM trades WHERE market_id = ? ORDER BY id DESC LIMIT 1').get(m.id);
    items.push({
      kind: 'mover', at: last?.created_at || now(), slug: m.slug, competition: m.competition, home: m.home, away: m.away, label: m.label,
      title: `${m.question} ${move > 0 ? 'surges' : 'slides'} to ${price}%`,
      body: `${move > 0 ? 'Up' : 'Down'} ${Math.abs(move)} points in 24 hours on ${m.event_title}. The crowd is ${move > 0 ? 'piling in' : 'cooling off'}.`,
    });
  }
  for (const t of db.prepare(`SELECT t.*, u.username, m.question, m.label, e.slug, e.competition, e.home, e.away FROM trades t JOIN users u ON u.id = t.taker_id
      JOIN markets m ON m.id = t.market_id JOIN events e ON e.id = m.event_id WHERE u.is_house = 0 AND t.created_at >= ? ORDER BY t.notional DESC LIMIT 4`).all(since24h())) {
    items.push({
      kind: 'big-call', at: t.created_at, slug: t.slug, competition: t.competition, home: t.home, away: t.away, label: t.label,
      title: `Big call: ${t.username} backs ${t.taker_outcome === 'YES' ? '' : 'against '}${t.label}`,
      body: `${t.size.toLocaleString()} units at ₭${((t.taker_outcome === 'YES' ? t.price : 100 - t.price) / 100).toFixed(2)} on "${t.question}"`,
    });
  }
  for (const e of db.prepare("SELECT * FROM events WHERE status = 'open' AND closes_at > ? ORDER BY created_at DESC LIMIT 3").all(now())) {
    items.push({ kind: 'listing', at: e.created_at, slug: e.slug, competition: e.competition, home: e.home, away: e.away, title: `New opinions: ${e.title}`, body: `${db.prepare('SELECT COUNT(*) AS n FROM markets WHERE event_id = ?').get(e.id).n} questions open until ${new Date(e.closes_at).toUTCString().slice(0, 22)} GMT.` });
  }
  items.push(...await rssItems());
  return items.filter(i => i.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}));

// ── Insights: data-backed reads on an event, or the whole board ─────────────
app.get('/api/insights', wrap(req => {
  const pct = n => `${Math.round(n)}%`;
  const out = [];
  if (req.query.event) {
    const ev = findEvent(String(req.query.event));
    const view = eventView(ev);
    const ms = db.prepare('SELECT * FROM markets WHERE event_id = ?').all(ev.id);
    const fav = [...view.markets].filter(m => ['result', 'winner'].includes(m.grp)).sort((a, b) => b.price - a.price)[0];
    if (fav) out.push({ title: 'Crowd favourite', body: `${fav.label} at ${pct(fav.price)} — decimal odds of ${(100 / Math.max(fav.price, 1)).toFixed(2)}.` });
    for (const m of ms) {
      const mv = view.markets.find(x => x.id === m.id);
      const gap = m.fair - mv.price;
      if (Math.abs(gap) >= 3 && m.status === 'open') out.push({ title: gap > 0 ? 'Model says undervalued' : 'Model says overvalued', body: `"${m.question}" trades at ${pct(mv.price)}; our goals model and order flow put it nearer ${pct(m.fair)}.`, market_id: m.id });
      if (Math.abs(mv.change_24h) >= 4) out.push({ title: mv.change_24h > 0 ? 'Momentum' : 'Drifting', body: `"${m.question}" has moved ${mv.change_24h > 0 ? '+' : ''}${mv.change_24h} points in 24h.`, market_id: m.id });
    }
    const goals = view.markets.find(m => m.code === 'OVER25');
    if (goals) out.push({ title: 'Goals outlook', body: `The market prices ${pct(goals.price)} for 3+ goals and ${pct(view.markets.find(m => m.code === 'BTTS')?.price ?? 50)} for both teams scoring.` });
    const top = db.prepare(`SELECT u.username, SUM(t.notional) AS v FROM trades t JOIN users u ON u.id = t.taker_id JOIN markets m ON m.id = t.market_id
      WHERE m.event_id = ? AND u.is_house = 0 GROUP BY u.id ORDER BY v DESC LIMIT 1`).get(ev.id);
    if (top) out.push({ title: 'Biggest player', body: `${top.username} has put ${(top.v / 100).toFixed(0)} KC into this event.` });
    out.push({ title: 'Depth', body: `${view.players} players, ${(view.liquidity / 100).toFixed(0)} KC resting in the order book, ${(view.volume / 100).toFixed(0)} KC traded.` });
  } else {
    const open = db.prepare("SELECT m.*, e.slug, e.title AS event_title FROM markets m JOIN events e ON e.id = m.event_id WHERE m.status = 'open' AND e.status = 'open' AND e.closes_at > ?").all(now());
    const scored = open.map(m => ({ m, price: ex.displayPrice(m) })).map(x => ({ ...x, gap: x.m.fair - x.price }));
    for (const x of scored.filter(x => Math.abs(x.gap) >= 3).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 4)) {
      out.push({ title: x.gap > 0 ? 'Value spot' : 'Looks rich', body: `${x.m.question} — market ${pct(x.price)}, model ${pct(x.m.fair)}.`, slug: x.m.slug, market_id: x.m.id });
    }
    const hot = db.prepare(`SELECT e.slug, e.title, SUM(t.notional) AS v FROM trades t JOIN markets m ON m.id = t.market_id JOIN events e ON e.id = m.event_id
      WHERE t.created_at >= ? GROUP BY e.id ORDER BY v DESC LIMIT 3`).all(since24h());
    for (const h of hot) out.push({ title: 'Most traded today', body: `${h.title}: ${(h.v / 100).toFixed(0)} KC in 24h.`, slug: h.slug });
    const q = String(req.query.q || '').toLowerCase().trim();
    if (q) {
      const hits = open.filter(m => `${m.question} ${m.event_title}`.toLowerCase().includes(q)).slice(0, 5);
      out.unshift(...hits.map(m => ({ title: m.event_title, body: `${m.question} — ${pct(ex.displayPrice(m))} (model ${pct(m.fair)})`, slug: m.slug, market_id: m.id })));
      if (!hits.length) out.unshift({ title: 'No match', body: `Nothing open mentions "${q}". Try a team, player or competition.` });
    }
  }
  return out;
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
// Real money: identity verified, not excluded / on a break, and (optionally) inside an allowed country
function canGamble(req, res, next) {
  const block = money.gamblingBlock(req.user);
  if (block) return res.status(403).json({ error: block, code: 'gambling_blocked' });
  next();
}
function geoGate(req, res, next) {
  const c = money.cfg();
  if (!money.isReal() || !c.geoEnforce) return next();
  const country = String(req.headers['cf-ipcountry'] || req.headers['x-country'] || '').toUpperCase();
  if (!c.allowedCountries.includes(country)) return res.status(451).json({ error: 'Game Knight is not available in your location', code: 'geo_blocked' });
  next();
}

app.post('/api/orders', requireAuth, geoGate, canGamble, rateLimit('order', 120), wrap(req => {
  const r = ex.placeOrder(orderInput(req, false));
  if (money.isReal()) money.audit(req.user.id, 'trade', { order_id: r.order_id, market_id: req.body?.market_id, side: r.side, outcome: r.outcome, filled: r.filled, fee: r.fee });
  return r;
}));

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
  const settled = db.prepare(`SELECT s.yes, s.no, s.cost, s.payout, s.payout - s.cost AS realized, s.created_at, m.id AS market_id, m.label, m.question,
      m.outcome, m.status, m.grp, e.title AS event_title, e.slug, e.home, e.away, e.kind, e.home_score, e.away_score, e.resolved_at
    FROM settlements s JOIN markets m ON m.id = s.market_id JOIN events e ON e.id = m.event_id
    WHERE s.user_id = ? ORDER BY s.id DESC LIMIT 100`).all(req.user.id);
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
  const users = db.prepare('SELECT * FROM users WHERE is_house = 0 AND is_system = 0').all();
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

// Real money stays locked until licensing and providers are configured
try { money.assertLaunchReady(); } catch (e) {
  if (require.main === module) { console.error(`\n${e.message}\n\nSet MONEY_MODE=play to run the play-money platform.\n`); process.exit(1); }
  throw e;
}
if (!money.isReal() && process.env.SEED_DEMO !== 'false' && !process.env.FOOTBALL_DATA_TOKEN && db.prepare('SELECT COUNT(*) AS n FROM events').get().n === 0) {
  require('./seed')({ hashPassword });
}
// In real money the house only makes markets if the operator holds a general betting licence
if (!money.isReal() || process.env.HOUSE_MARKET_MAKER === 'true') mm.start(hashPassword);
feed.start();
setInterval(() => { if (events.closeExpired()) mm.requoteAll(); }, 30e3).unref();

if (require.main === module) {
  app.listen(PORT, () => console.log(`♞ GameKnight exchange on http://localhost:${PORT}`));
}

module.exports = { app, db, hashPassword };
