// House market maker: solves the cold-start problem. From the moment a market opens,
// the house quotes a ladder of bids and asks around its fair value, so a trader can
// always get filled. It quotes cash-only (bids = buy YES, asks = buy NO), which mints
// pairs; matched YES+NO inventory is merged back to cash automatically.
//
// Fair value follows the flow: every fill against the house nudges its mid toward
// the taker's side. In mutually exclusive groups (1X2, outright winner) the other
// contenders are rescaled so the group still sums to ~100%. Quotes are post-only
// and never cross other traders' resting orders, so users can always improve on
// the house price and become the best bid/ask themselves.

const crypto = require('crypto');
const db = require('./db');
const { bus, placeOrder, cancelAll, credit, now } = require('./exchange');

const HOUSE_NAME = 'GameKnight';
const HOUSE_FLOAT = 5_000_000_00; // 5M KC of quoting capital (cents)
const LADDER = [
  { off: 1, size: 150 },
  { off: 3, size: 300 },
  { off: 6, size: 600 },
];
const EXCLUSIVE = new Set(['result', 'winner']);

let houseId = null;

function ensureHouse(hashPassword) {
  const row = db.prepare('SELECT id, balance FROM users WHERE is_house = 1').get();
  if (row) {
    houseId = row.id;
    if (row.balance < HOUSE_FLOAT / 2) credit(houseId, HOUSE_FLOAT - row.balance, 'house_topup', null);
    return houseId;
  }
  houseId = db.prepare(`INSERT INTO users (username, pass_hash, balance, granted, is_bot, is_house, bio, created_at)
    VALUES (?, ?, 0, 0, 1, 1, ?, ?)`).run(HOUSE_NAME, hashPassword(crypto.randomBytes(24).toString('hex')),
    'Designated market maker. Quotes every market from open to kick-off.', now()).lastInsertRowid;
  credit(houseId, HOUSE_FLOAT, 'house_float', null);
  db.prepare('UPDATE users SET granted = ? WHERE id = ?').run(HOUSE_FLOAT, houseId);
  return houseId;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function requote(marketId) {
  const m = db.prepare(`SELECT m.*, e.status AS ev_status, e.closes_at FROM markets m JOIN events e ON e.id = m.event_id WHERE m.id = ?`).get(marketId);
  cancelAll('market_id = ? AND user_id = ?', [marketId, houseId]);
  if (!m || m.status !== 'open' || m.ev_status !== 'open' || new Date(m.closes_at) <= new Date()) return;

  // Never cross other traders — step inside their best prices instead
  const bestAsk = db.prepare("SELECT MIN(book_price) AS p FROM orders WHERE market_id = ? AND status = 'open' AND book_side = 'ask'").get(marketId).p ?? 100;
  const bestBid = db.prepare("SELECT MAX(book_price) AS p FROM orders WHERE market_id = ? AND status = 'open' AND book_side = 'bid'").get(marketId).p ?? 0;

  for (const { off, size } of LADDER) {
    const bid = Math.min(m.fair - off, bestAsk - 1);
    const ask = Math.max(m.fair + off, bestBid + 1);
    try { if (bid >= 1) placeOrder({ userId: houseId, marketId, outcome: 'YES', side: 'buy', type: 'limit', price: bid, size, postOnly: true }); } catch {}
    try { if (ask <= 99) placeOrder({ userId: houseId, marketId, outcome: 'NO', side: 'buy', type: 'limit', price: 100 - ask, size, postOnly: true }); } catch {}
  }
}

// Move fair value after a trade the house took the other side of
function onTrade(t) {
  if (t.taker_id === houseId) return;
  const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(t.market_id);
  if (!m || m.status !== 'open') return;
  const bullish = (t.outcome === 'YES') === (t.side === 'buy');
  const step = clamp(Math.round(t.size / 250), 1, 4) * (bullish ? 1 : -1);
  // Anchor to where the market actually traded, then lean with the flow
  const target = clamp(Math.round((m.fair + t.price) / 2) + step, 2, 98);
  db.prepare('UPDATE markets SET fair = ? WHERE id = ?').run(target, m.id);

  const touched = [m.id];
  if (EXCLUSIVE.has(m.grp)) {
    const others = db.prepare("SELECT * FROM markets WHERE event_id = ? AND grp = ? AND status = 'open' AND id != ?").all(m.event_id, m.grp, m.id);
    const otherSum = others.reduce((s, o) => s + o.fair, 0);
    const room = Math.max(others.length, 100 - target);
    for (const o of others) {
      const f = clamp(Math.round((o.fair / otherSum) * room), 1, 98);
      if (f !== o.fair) { db.prepare('UPDATE markets SET fair = ? WHERE id = ?').run(f, o.id); touched.push(o.id); }
    }
  }
  touched.forEach(schedule);
}

const queued = new Set();
function schedule(marketId) {
  if (queued.has(marketId)) return;
  queued.add(marketId);
  setImmediate(() => {
    queued.delete(marketId);
    try { requote(marketId); } catch (e) { console.error('requote failed', marketId, e.message); }
  });
}

// onlyMissing: skip markets the house is already quoting (fast restarts)
function requoteAll({ onlyMissing = false } = {}) {
  const ids = db.prepare(`SELECT m.id FROM markets m JOIN events e ON e.id = m.event_id
    WHERE m.status = 'open' AND e.status = 'open' AND e.closes_at > ?
    ${onlyMissing ? "AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.market_id = m.id AND o.user_id = ? AND o.status = 'open')" : ''}`)
    .all(...(onlyMissing ? [now(), houseId] : [now()])).map(r => r.id);
  ids.forEach(id => requote(id));
  return ids.length;
}

// Run pending requotes synchronously (used by the seeder, which trades in a tight loop)
function flush() {
  for (const id of [...queued]) { queued.delete(id); requote(id); }
}

let started = false;
function start(hashPassword) {
  ensureHouse(hashPassword);
  if (started) return;
  started = true;
  bus.on('trade', t => { try { onTrade(t); } catch (e) { console.error('mm', e.message); } });
  requoteAll({ onlyMissing: true });
}

module.exports = { start, flush, requote, requoteAll, ensureHouse, getHouseId: () => houseId, HOUSE_NAME };
