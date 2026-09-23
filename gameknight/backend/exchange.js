// The GameKnight exchange: a central limit order book per binary market.
//
// Every market has YES and NO shares; one YES + one NO is always worth exactly 100¢
// because exactly one of them redeems for 100¢ at resolution. Both sides trade on a
// single YES-priced book (see db.js for the mapping), which gives four fill types:
//
//   bid: buy YES   × ask: sell YES  → transfer YES, buyer pays P
//   bid: buy YES   × ask: buy NO    → MINT a YES+NO pair, buyers pay P and 100−P
//   bid: sell NO   × ask: sell YES  → MERGE a pair, sellers receive 100−P and P
//   bid: sell NO   × ask: buy NO    → transfer NO, buyer pays 100−P
//
// Cash + escrow + 100¢ × (outstanding pairs) is conserved across every operation;
// test/exchange.test.js checks that invariant under random order flow.

const { EventEmitter } = require('events');
const db = require('./db');

const bus = new EventEmitter();
bus.setMaxListeners(1000);

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
class DryRun extends Error {
  constructor(result) { super('dry run'); this.result = result; }
}

// Clock override lets the demo seeder backfill realistic history
let clock = null;
const now = () => clock || new Date().toISOString();
const setClock = ts => { clock = ts; };
const PAIR = 100;

// ── Cash & positions ─────────────────────────────────────────────────────────
const q = {
  user: db.prepare('SELECT * FROM users WHERE id = ?'),
  addBalance: db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?'),
  ledger: db.prepare('INSERT INTO ledger (user_id, delta, reason, ref, created_at) VALUES (?, ?, ?, ?, ?)'),
  pos: db.prepare('SELECT * FROM positions WHERE user_id = ? AND market_id = ?'),
  savePos: db.prepare(`INSERT INTO positions (user_id, market_id, yes, no, yes_cost, no_cost, realized)
    VALUES (@user_id, @market_id, @yes, @no, @yes_cost, @no_cost, @realized)
    ON CONFLICT(user_id, market_id) DO UPDATE SET yes=@yes, no=@no, yes_cost=@yes_cost, no_cost=@no_cost, realized=@realized`),
  locked: db.prepare(`SELECT COALESCE(SUM(size - filled), 0) AS n FROM orders
    WHERE user_id = ? AND market_id = ? AND outcome = ? AND side = 'sell' AND status = 'open'`),
  market: db.prepare('SELECT * FROM markets WHERE id = ?'),
  event: db.prepare('SELECT * FROM events WHERE id = ?'),
  order: db.prepare('SELECT * FROM orders WHERE id = ?'),
  bestAsk: db.prepare(`SELECT * FROM orders WHERE market_id = ? AND status = 'open' AND book_side = 'ask' AND book_price <= ?
    ORDER BY book_price ASC, id ASC LIMIT 1`),
  bestBid: db.prepare(`SELECT * FROM orders WHERE market_id = ? AND status = 'open' AND book_side = 'bid' AND book_price >= ?
    ORDER BY book_price DESC, id ASC LIMIT 1`),
  fill: db.prepare(`UPDATE orders SET filled = filled + ?, status = CASE WHEN filled + ? >= size THEN 'filled' ELSE status END WHERE id = ?`),
  cancel: db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?"),
  trade: db.prepare(`INSERT INTO trades (market_id, price, size, notional, taker_id, maker_id, taker_outcome, taker_side, maker_outcome, maker_side, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  history: db.prepare('INSERT INTO price_history (market_id, price, created_at) VALUES (?, ?, ?)'),
  lastPrice: db.prepare('UPDATE markets SET last_price = ? WHERE id = ?'),
};

function credit(userId, delta, reason, ref) {
  if (!delta) return;
  q.addBalance.run(delta, userId);
  q.ledger.run(userId, delta, reason, ref == null ? null : String(ref), now());
}

function getPos(userId, marketId) {
  return q.pos.get(userId, marketId) || { user_id: userId, market_id: marketId, yes: 0, no: 0, yes_cost: 0, no_cost: 0, realized: 0 };
}

function available(userId, marketId, outcome) {
  const p = getPos(userId, marketId);
  return (outcome === 'YES' ? p.yes : p.no) - q.locked.get(userId, marketId, outcome).n;
}

const key = o => (o === 'YES' ? 'yes' : 'no');

function addShares(pos, outcome, shares, cost) {
  pos[key(outcome)] += shares;
  pos[`${key(outcome)}_cost`] += cost;
}
function removeShares(pos, outcome, shares, proceeds) {
  const k = key(outcome);
  const basis = shares >= pos[k] ? pos[`${k}_cost`] : Math.round((pos[`${k}_cost`] * shares) / pos[k]);
  pos[k] -= shares;
  pos[`${k}_cost`] -= basis;
  pos.realized += proceeds - basis;
}

// ── Order book mapping ───────────────────────────────────────────────────────
function toBook(outcome, side, price) {
  const bid = (outcome === 'YES') === (side === 'buy');
  return { book_side: bid ? 'bid' : 'ask', book_price: outcome === 'YES' ? price : PAIR - price };
}
const ownPrice = (order, yesPrice) => (order.outcome === 'YES' ? yesPrice : PAIR - yesPrice);

function assertTradable(market) {
  if (!market) throw new ApiError(404, 'Market not found');
  const ev = q.event.get(market.event_id);
  if (market.status !== 'open' || ev.status !== 'open' || new Date(ev.closes_at) <= new Date()) {
    throw new ApiError(400, 'This market is closed for trading');
  }
  return ev;
}

// ── Placing orders ───────────────────────────────────────────────────────────
// input: { userId, marketId, outcome: YES|NO, side: buy|sell, type: limit|market,
//          price (limit, cents 1–99), size (shares; limit orders and market sells),
//          amount (cents; market buys), postOnly, dryRun }
function placeOrder(input) {
  const pending = [];
  try {
    const result = db.transaction(() => {
      const r = placeOrderTx(input, pending);
      if (input.dryRun) throw new DryRun(r);
      return r;
    })();
    for (const [name, payload] of pending) bus.emit(name, payload);
    return result;
  } catch (e) {
    if (e instanceof DryRun) return e.result;
    throw e;
  }
}

function placeOrderTx(input, pending) {
  const { userId, marketId, postOnly } = input;
  const outcome = String(input.outcome || '').toUpperCase();
  const side = String(input.side || '').toLowerCase();
  const type = input.type === 'market' ? 'market' : 'limit';
  if (!['YES', 'NO'].includes(outcome)) throw new ApiError(400, 'outcome must be YES or NO');
  if (!['buy', 'sell'].includes(side)) throw new ApiError(400, 'side must be buy or sell');

  const market = q.market.get(marketId);
  assertTradable(market);
  const user = q.user.get(userId);

  let price, size, budget = null;
  if (type === 'limit') {
    price = Number(input.price);
    size = Number(input.size);
    if (!Number.isInteger(price) || price < 1 || price > 99) throw new ApiError(400, 'Price must be a whole number of cents between 1 and 99');
    if (!Number.isInteger(size) || size < 1) throw new ApiError(400, 'Size must be a whole number of shares');
    if (size > 1e6) throw new ApiError(400, 'Order too large');
  } else if (side === 'buy') {
    price = 99;
    budget = Number(input.amount);
    if (!Number.isInteger(budget) || budget < 1) throw new ApiError(400, 'Enter an amount to spend');
    size = Math.floor(budget / 1); // upper bound; the budget is the real limit
  } else {
    price = 1;
    size = Number(input.size);
    if (!Number.isInteger(size) || size < 1) throw new ApiError(400, 'Size must be a whole number of shares');
  }

  // Escrow: cash for buys, share availability for sells
  const escrow = side === 'buy' ? (budget ?? price * size) : 0;
  if (side === 'buy' && escrow > user.balance) throw new ApiError(400, 'Insufficient balance');
  if (side === 'sell' && available(userId, marketId, outcome) < size) throw new ApiError(400, `You don't have ${size} ${outcome} shares available to sell`);

  const book = toBook(outcome, side, price);
  const { lastInsertRowid: orderId } = db.prepare(`INSERT INTO orders
    (user_id, market_id, outcome, side, price, size, book_side, book_price, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(userId, marketId, outcome, side, price, size, book.book_side, book.book_price, now());
  if (escrow) credit(userId, -escrow, 'order_escrow', orderId);

  const taker = q.order.get(orderId);
  const fills = [];
  let cashLeft = budget;
  let paid = 0, received = 0;
  const touched = new Set([userId]);

  while (taker.filled < taker.size) {
    const maker = taker.book_side === 'bid'
      ? q.bestAsk.get(marketId, taker.book_price)
      : q.bestBid.get(marketId, taker.book_price);
    if (!maker) break;
    if (postOnly) throw new ApiError(400, 'Post-only order would cross the book');
    if (maker.user_id === userId) {
      // Self-trade prevention: cancel the resting order rather than trade with yourself
      cancelTx(maker, pending);
      continue;
    }
    const P = maker.book_price;
    const tOwn = ownPrice(taker, P);
    let s = Math.min(taker.size - taker.filled, maker.size - maker.filled);
    if (budget != null) s = Math.min(s, Math.floor(cashLeft / tOwn));
    if (s <= 0) break;

    settleFill(taker, maker, P, s, budget != null);
    if (taker.side === 'buy') { paid += tOwn * s; if (budget != null) cashLeft -= tOwn * s; }
    else received += tOwn * s;
    taker.filled += s;
    fills.push({ price: P, own_price: tOwn, size: s, maker_id: maker.user_id });
    touched.add(maker.user_id);
  }

  // Finalise the taker order: market orders never rest (immediate-or-cancel)
  let status;
  if (type === 'market') {
    if (!taker.filled) throw new ApiError(400, 'No liquidity available right now');
    if (budget != null) {
      taker.size = taker.filled;
      if (cashLeft) credit(userId, cashLeft, 'order_refund', orderId);
    }
    status = taker.filled >= taker.size ? 'filled' : 'cancelled';
  } else {
    status = taker.filled >= taker.size ? 'filled' : 'open';
  }
  db.prepare('UPDATE orders SET size = ?, filled = ?, status = ? WHERE id = ?').run(taker.size, taker.filled, status, orderId);

  for (const uid of touched) autoMerge(uid, marketId);

  if (fills.length) {
    const last = fills[fills.length - 1].price;
    q.lastPrice.run(last, marketId);
    q.history.run(marketId, last, now());
    pending.push(['trade', { market_id: marketId, event_id: market.event_id, price: last, size: taker.filled, taker_id: userId, outcome, side }]);
  }
  pending.push(['book', { market_id: marketId, event_id: market.event_id }]);

  const filled = taker.filled;
  const cash = side === 'buy' ? paid : received;
  return {
    order_id: orderId, status, outcome, side, type, price, size: taker.size,
    filled, resting: status === 'open' ? size - filled : 0,
    avg_price: filled ? cash / filled : null, [side === 'buy' ? 'cost' : 'proceeds']: cash,
    fills: fills.length, balance: q.user.get(userId).balance,
  };
}

// Apply one fill between the incoming order and a resting maker at YES price P.
function settleFill(taker, maker, P, s, takerBudget) {
  const ts = now();
  for (const o of [taker, maker]) {
    const c = ownPrice(o, P);
    const pos = getPos(o.user_id, o.market_id);
    if (o.side === 'buy') {
      addShares(pos, o.outcome, s, c * s);
      // Buyers escrowed at their limit; refund any price improvement
      const improvement = (o.price - c) * s;
      if (improvement > 0 && !(o === taker && takerBudget)) credit(o.user_id, improvement, 'order_refund', o.id);
    } else {
      removeShares(pos, o.outcome, s, c * s);
      credit(o.user_id, c * s, 'fill', o.id);
    }
    q.savePos.run(pos);
  }
  q.fill.run(s, s, maker.id);
  q.trade.run(maker.market_id, P, s, ownPrice(taker, P) * s, taker.user_id, maker.user_id, taker.outcome, taker.side, maker.outcome, maker.side, ts);
}

// Holding YES and NO in the same market is the same as holding cash — redeem
// matched pairs automatically so capital isn't trapped.
function autoMerge(userId, marketId) {
  const pairs = Math.min(available(userId, marketId, 'YES'), available(userId, marketId, 'NO'));
  if (pairs <= 0) return;
  const pos = getPos(userId, marketId);
  removeShares(pos, 'YES', pairs, 0);
  removeShares(pos, 'NO', pairs, 0);
  pos.realized += pairs * PAIR;
  q.savePos.run(pos);
  credit(userId, pairs * PAIR, 'merge', marketId);
}

// ── Cancelling ───────────────────────────────────────────────────────────────
function cancelTx(order, pending) {
  if (order.status !== 'open') return;
  q.cancel.run(order.id);
  const remaining = order.size - order.filled;
  if (order.side === 'buy' && remaining > 0) credit(order.user_id, order.price * remaining, 'order_refund', order.id);
  pending.push(['book', { market_id: order.market_id }]);
}

function cancelOrder(userId, orderId) {
  const pending = [];
  db.transaction(() => {
    const o = q.order.get(orderId);
    if (!o || o.user_id !== userId) throw new ApiError(404, 'Order not found');
    if (o.status !== 'open') throw new ApiError(400, 'Order is no longer open');
    cancelTx(o, pending);
  })();
  pending.forEach(([n, p]) => bus.emit(n, p));
}

function cancelAll(where, params) {
  const pending = [];
  db.transaction(() => {
    for (const o of db.prepare(`SELECT * FROM orders WHERE status = 'open' AND ${where}`).all(...params)) cancelTx(o, pending);
  })();
  pending.forEach(([n, p]) => bus.emit(n, p));
  return pending.length;
}

// ── Resolution ───────────────────────────────────────────────────────────────
// outcome YES → each YES share pays 100¢; NO → each NO pays 100¢; VOID → every share pays 50¢.
function resolveMarketTx(marketId, outcome) {
  const m = q.market.get(marketId);
  if (m.status !== 'open') throw new ApiError(400, `Market "${m.question}" is already ${m.status}`);
  const pending = [];
  for (const o of db.prepare("SELECT * FROM orders WHERE market_id = ? AND status = 'open'").all(marketId)) cancelTx(o, pending);
  let paid = 0;
  for (const p of db.prepare('SELECT * FROM positions WHERE market_id = ? AND (yes > 0 OR no > 0)').all(marketId)) {
    const payout = outcome === 'YES' ? p.yes * PAIR : outcome === 'NO' ? p.no * PAIR : (p.yes + p.no) * (PAIR / 2);
    q.savePos.run({ ...p, yes: 0, no: 0, yes_cost: 0, no_cost: 0, realized: p.realized + payout - p.yes_cost - p.no_cost });
    credit(p.user_id, payout, 'payout', marketId);
    paid += payout;
  }
  const final = outcome === 'YES' ? 100 : outcome === 'NO' ? 0 : 50;
  db.prepare('UPDATE markets SET status = ?, outcome = ?, last_price = ? WHERE id = ?').run(outcome === 'VOID' ? 'void' : 'resolved', outcome, final, marketId);
  q.history.run(marketId, final, now());
  return paid;
}

// ── Read models ──────────────────────────────────────────────────────────────
function orderBook(marketId, depth = 12) {
  const levels = side => db.prepare(`SELECT book_price AS price, SUM(size - filled) AS size, COUNT(*) AS orders
    FROM orders WHERE market_id = ? AND status = 'open' AND book_side = ? GROUP BY book_price
    ORDER BY book_price ${side === 'bid' ? 'DESC' : 'ASC'} LIMIT ?`).all(marketId, side, depth);
  return { bids: levels('bid'), asks: levels('ask') };
}

// Best prices to BUY each side right now (what a Polymarket-style "Buy Yes 54¢" button shows)
function quotes(marketId) {
  const bestAsk = db.prepare("SELECT MIN(book_price) AS p FROM orders WHERE market_id = ? AND status = 'open' AND book_side = 'ask'").get(marketId).p;
  const bestBid = db.prepare("SELECT MAX(book_price) AS p FROM orders WHERE market_id = ? AND status = 'open' AND book_side = 'bid'").get(marketId).p;
  return {
    best_bid: bestBid, best_ask: bestAsk,
    buy_yes: bestAsk, buy_no: bestBid == null ? null : PAIR - bestBid,
    spread: bestAsk != null && bestBid != null ? bestAsk - bestBid : null,
  };
}

// Displayed probability: midpoint when the spread is tight, otherwise last trade (Polymarket's rule)
function displayPrice(market, qt = quotes(market.id)) {
  if (market.status !== 'open') return market.last_price;
  if (qt.spread != null && qt.spread <= 10) return Math.round((qt.best_bid + qt.best_ask) / 2);
  return market.last_price;
}

module.exports = {
  bus, ApiError, now, setClock, credit, placeOrder, cancelOrder, cancelAll, resolveMarketTx, orderBook, quotes, displayPrice,
  available, getPos, toBook, PAIR,
};
