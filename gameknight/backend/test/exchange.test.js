const test = require('node:test');
const assert = require('node:assert/strict');
const { ex, events, mm, db, makeUser, bal, pos, newMatch, assertConserved } = require('./helpers');

const order = (userId, marketId, outcome, side, price, size) => ex.placeOrder({ userId, marketId, outcome, side, type: 'limit', price, size });

test('book mapping', () => {
  assert.deepEqual(ex.toBook('YES', 'buy', 60), { book_side: 'bid', book_price: 60 });
  assert.deepEqual(ex.toBook('YES', 'sell', 60), { book_side: 'ask', book_price: 60 });
  assert.deepEqual(ex.toBook('NO', 'buy', 30), { book_side: 'ask', book_price: 70 });
  assert.deepEqual(ex.toBook('NO', 'sell', 30), { book_side: 'bid', book_price: 70 });
});

test('buy YES × buy NO mints a pair; each pays their side', () => {
  const { markets } = newMatch();
  const a = makeUser(), b = makeUser();
  const r1 = order(a, markets.HOME, 'YES', 'buy', 60, 10);
  assert.equal(r1.status, 'open');
  assert.equal(bal(a), 1000_00 - 600, 'escrowed');
  const r2 = order(b, markets.HOME, 'NO', 'buy', 40, 10);
  assert.equal(r2.status, 'filled');
  assert.equal(pos(a, markets.HOME).yes, 10);
  assert.equal(pos(b, markets.HOME).no, 10);
  assert.equal(bal(b), 1000_00 - 400);
  assertConserved(assert);
});

test('price improvement is refunded to the taker', () => {
  const { markets } = newMatch();
  const maker = makeUser(), taker = makeUser();
  order(maker, markets.DRAW, 'NO', 'buy', 70, 50);           // ask YES @30
  const r = order(taker, markets.DRAW, 'YES', 'buy', 45, 20); // willing to pay 45, fills at 30
  assert.equal(r.filled, 20);
  assert.equal(r.cost, 600);
  assert.equal(bal(taker), 1000_00 - 600);
  assertConserved(assert);
});

test('sell YES transfers shares; sell YES × sell NO merges back to cash', () => {
  const { markets } = newMatch();
  const a = makeUser(), b = makeUser(), c = makeUser();
  order(a, markets.BTTS, 'YES', 'buy', 55, 100);
  order(b, markets.BTTS, 'NO', 'buy', 45, 100);   // mint 100 pairs
  order(c, markets.BTTS, 'YES', 'buy', 60, 40);   // resting bid
  const sell = order(a, markets.BTTS, 'YES', 'sell', 58, 40);
  assert.equal(sell.filled, 40);
  assert.equal(sell.proceeds, 40 * 60, 'fills at the resting bid');
  assert.equal(pos(c, markets.BTTS).yes, 40);
  // merge: a sells remaining 60 YES @50, b sells 60 NO @50
  order(a, markets.BTTS, 'YES', 'sell', 50, 60);
  const m = order(b, markets.BTTS, 'NO', 'sell', 50, 60);
  assert.equal(m.filled, 60);
  assert.equal(pos(a, markets.BTTS).yes, 0);
  assert.equal(pos(b, markets.BTTS).no, 40);
  assertConserved(assert);
});

test('cannot sell shares you do not have or that are locked in another order', () => {
  const { markets } = newMatch();
  const a = makeUser(), b = makeUser();
  order(a, markets.OVER25, 'YES', 'buy', 50, 10);
  order(b, markets.OVER25, 'NO', 'buy', 50, 10);
  order(a, markets.OVER25, 'YES', 'sell', 90, 8);
  assert.throws(() => order(a, markets.OVER25, 'YES', 'sell', 90, 3), /available/);
  assert.throws(() => order(b, markets.OVER25, 'YES', 'sell', 90, 1), /available/);
});

test('insufficient balance and bad input are rejected', () => {
  const { markets } = newMatch();
  const a = makeUser(1000);
  assert.throws(() => order(a, markets.HOME, 'YES', 'buy', 50, 21), /Insufficient/);
  assert.throws(() => order(a, markets.HOME, 'YES', 'buy', 0, 1), /Price/);
  assert.throws(() => order(a, markets.HOME, 'YES', 'buy', 100, 1), /Price/);
  assert.throws(() => order(a, markets.HOME, 'YES', 'buy', 50, 1.5), /Size/);
  assert.throws(() => order(a, markets.HOME, 'MAYBE', 'buy', 50, 1), /outcome/);
});

test('market buy by amount walks the book and refunds unspent cash', () => {
  const { markets } = newMatch();
  const mk = makeUser(), t = makeUser();
  order(mk, markets.AWAY, 'NO', 'buy', 70, 10); // ask 30 ×10
  order(mk, markets.AWAY, 'NO', 'buy', 65, 10); // ask 35 ×10
  const r = ex.placeOrder({ userId: t, marketId: markets.AWAY, outcome: 'YES', side: 'buy', type: 'market', amount: 1000 });
  assert.equal(r.filled, 20, 'takes all 20 shares on offer');
  assert.equal(r.cost, 300 + 350);
  assert.equal(bal(t), 1000_00 - 650, 'unspent 350¢ refunded');
  const r2 = ex.placeOrder({ userId: mk, marketId: markets.AWAY, outcome: 'NO', side: 'buy', type: 'limit', price: 60, size: 100 }); // ask 40 ×100
  const r3 = ex.placeOrder({ userId: t, marketId: markets.AWAY, outcome: 'YES', side: 'buy', type: 'market', amount: 1000 });
  assert.equal(r3.filled, 25, 'budget-limited: floor(1000 / 40)');
  assert.equal(r3.cost, 1000);
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(r.order_id);
  assert.equal(o.status, 'filled');
  assert.equal(o.filled, r.filled, 'taker fill is persisted');
  assertConserved(assert);
});

test('market order with no liquidity fails cleanly and leaves nothing behind', () => {
  const { markets } = newMatch();
  const t = makeUser();
  const before = db.prepare('SELECT COUNT(*) AS n FROM orders').get().n;
  assert.throws(() => ex.placeOrder({ userId: t, marketId: markets.OVER35, outcome: 'YES', side: 'buy', type: 'market', amount: 500 }), /liquidity/);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM orders').get().n, before);
  assert.equal(bal(t), 1000_00);
});

test('partially filled limit order rests with the right remaining size', () => {
  const { markets } = newMatch();
  const mk = makeUser(), t = makeUser(), t2 = makeUser();
  order(mk, markets.HOME, 'NO', 'buy', 50, 5);           // ask 50 ×5
  const r = order(t, markets.HOME, 'YES', 'buy', 50, 12); // takes 5, rests 7
  assert.equal(r.status, 'open');
  assert.equal(r.resting, 7);
  const r2 = order(t2, markets.HOME, 'NO', 'buy', 50, 20); // should only fill 7 against t
  assert.equal(r2.filled, 7);
  assert.equal(pos(t, markets.HOME).yes, 12);
  assertConserved(assert);
});

test('self-trade prevention cancels the resting order instead of matching', () => {
  const { markets } = newMatch();
  const a = makeUser();
  const rest = order(a, markets.DRAW, 'NO', 'buy', 70, 10);
  const r = order(a, markets.DRAW, 'YES', 'buy', 40, 10);
  assert.equal(r.filled, 0);
  assert.equal(db.prepare('SELECT status FROM orders WHERE id = ?').get(rest.order_id).status, 'cancelled');
  assert.equal(bal(a), 1000_00 - 400);
  assertConserved(assert);
});

test('cancel returns escrow; dry run changes nothing', () => {
  const { markets } = newMatch();
  const a = makeUser(), b = makeUser();
  const r = order(a, markets.HOME, 'YES', 'buy', 40, 100);
  ex.cancelOrder(a, r.order_id);
  assert.equal(bal(a), 1000_00);
  order(b, markets.HOME, 'NO', 'buy', 55, 100);
  const preview = ex.placeOrder({ userId: a, marketId: markets.HOME, outcome: 'YES', side: 'buy', type: 'market', amount: 2000, dryRun: true });
  assert.ok(preview.filled > 0);
  assert.equal(bal(a), 1000_00);
  assert.equal(pos(a, markets.HOME).yes, 0);
});

test('resolution pays winners 100¢, void pays 50¢, orders are refunded', () => {
  const m1 = newMatch();
  const a = makeUser(), b = makeUser(), c = makeUser();
  order(a, m1.markets.HOME, 'YES', 'buy', 60, 10);
  order(b, m1.markets.HOME, 'NO', 'buy', 40, 10);
  order(c, m1.markets.AWAY, 'YES', 'buy', 20, 50); // resting, refunded on resolve
  events.resolveMatch(m1.id, 2, 0);
  assert.equal(bal(a), 1000_00 - 600 + 1000);
  assert.equal(bal(b), 1000_00 - 400);
  assert.equal(bal(c), 1000_00);
  assert.equal(pos(a, m1.markets.HOME).realized, 400);
  assert.throws(() => events.resolveMatch(m1.id, 0, 0), /already/);

  const m2 = newMatch();
  order(a, m2.markets.DRAW, 'YES', 'buy', 30, 10);
  order(b, m2.markets.DRAW, 'NO', 'buy', 70, 10);
  const before = [bal(a), bal(b)];
  events.voidEvent(m2.id);
  assert.equal(bal(a) - before[0], 500);
  assert.equal(bal(b) - before[1], 500);
  assertConserved(assert);
});

test('match resolution rules', () => {
  const R = events.RESOLVERS;
  assert.deepEqual(['HOME', 'DRAW', 'AWAY', 'OVER15', 'OVER25', 'OVER35', 'BTTS'].map(k => R[k](2, 1)), [true, false, false, true, true, false, true]);
  assert.deepEqual(['HOME', 'DRAW', 'AWAY', 'OVER15', 'OVER25', 'OVER35', 'BTTS'].map(k => R[k](0, 0)), [false, true, false, false, false, false, false]);
});

test('goals model is coherent', () => {
  const p = events.matchProbabilities(1.6, 1.1);
  assert.ok(Math.abs(p.HOME + p.DRAW + p.AWAY - 1) < 1e-9);
  assert.ok(p.HOME > p.AWAY);
  assert.ok(p.OVER15 > p.OVER25 && p.OVER25 > p.OVER35);
});

test('fuzz: random order flow with the house market maker conserves money', () => {
  const { id, markets } = newMatch({ xgHome: 1.7, xgAway: 1.0 });
  const ids = Object.values(markets);
  ids.forEach(m => mm.requote(m));
  const users = Array.from({ length: 6 }, () => makeUser(2000_00));
  let s = 99;
  const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  let fills = 0;
  for (let i = 0; i < 1500; i++) {
    const u = users[Math.floor(rand() * users.length)];
    const m = ids[Math.floor(rand() * ids.length)];
    const outcome = rand() < 0.5 ? 'YES' : 'NO';
    const r = rand();
    try {
      let res;
      if (r < 0.35) res = ex.placeOrder({ userId: u, marketId: m, outcome, side: 'buy', type: 'limit', price: 1 + Math.floor(rand() * 98), size: 1 + Math.floor(rand() * 80) });
      else if (r < 0.55) res = ex.placeOrder({ userId: u, marketId: m, outcome, side: 'buy', type: 'market', amount: 100 + Math.floor(rand() * 5000) });
      else if (r < 0.7) res = ex.placeOrder({ userId: u, marketId: m, outcome, side: 'sell', type: 'limit', price: 1 + Math.floor(rand() * 98), size: 1 + Math.floor(rand() * 40) });
      else if (r < 0.85) res = ex.placeOrder({ userId: u, marketId: m, outcome, side: 'sell', type: 'market', size: 1 + Math.floor(rand() * 40) });
      else {
        const open = db.prepare("SELECT id FROM orders WHERE user_id = ? AND status = 'open' LIMIT 1").get(u);
        if (open) ex.cancelOrder(u, open.id);
      }
      if (res?.filled) fills++;
    } catch (e) { if (!e.status) throw e; }
    mm.flush();
    if (i % 250 === 0) assertConserved(assert);
    const over = db.prepare("SELECT id FROM orders WHERE filled > size OR (status = 'open' AND filled >= size)").all();
    assert.deepEqual(over, [], 'no overfilled or stale-open orders');
  }
  assert.ok(fills > 300, `expected plenty of fills, got ${fills}`);
  const crossed = ids.filter(m => { const q = ex.quotes(m); return q.best_bid != null && q.best_ask != null && q.best_bid >= q.best_ask; });
  assert.deepEqual(crossed, [], 'book must never be left crossed');
  assertConserved(assert);
  events.resolveMatch(id, 1, 1);
  assertConserved(assert);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders o JOIN markets m ON m.id = o.market_id WHERE m.event_id = ? AND o.status = 'open'").get(id).n, 0);
});
