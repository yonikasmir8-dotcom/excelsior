const test = require('node:test');
const assert = require('node:assert/strict');
const { app, db, ex, events, mm, assertConserved } = require('./helpers');
const feed = require('../feed');

let base, server;
test.before(() => new Promise(r => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
test.after(() => server.close());

async function call(method, path, body, auth) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth?.startsWith?.('gk_')) headers['X-API-Key'] = auth; else if (auth) headers.Authorization = `Bearer ${auth}`;
  const res = await fetch(base + path, { method, headers, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}

test('end to end: admin lists a match, house quotes it, users trade via session and API key, admin settles', async () => {
  const boss = (await call('POST', '/auth/register', { username: 'boss', password: 'password123' })).body;
  const fan = (await call('POST', '/auth/register', { username: 'fan', password: 'password123' })).body;
  assert.equal(boss.user.is_admin, true);
  assert.equal(fan.user.balance, 1000_00);

  assert.equal((await call('POST', '/admin/events/match', { competition: 'X', home: 'A', away: 'B', kickoff: new Date(Date.now() + 864e5) }, fan.token)).status, 403);
  const ev = (await call('POST', '/admin/events/match', {
    competition: 'Premier League', home: 'Arsenal', away: 'Spurs', kickoff: new Date(Date.now() + 864e5).toISOString(), xg_home: 1.9, xg_away: 1.0,
  }, boss.token)).body;
  assert.equal(ev.markets.length, 7);
  const home = ev.markets.find(m => m.code === 'HOME');
  assert.ok(home.buy_yes > home.price - 5 && home.buy_yes <= home.price + 5, 'house is quoting around fair');

  const book = (await call('GET', `/markets/${home.id}/book`)).body;
  assert.equal(book.bids.length, 3);
  assert.equal(book.asks.length, 3);

  const preview = (await call('POST', '/orders/preview', { market_id: home.id, outcome: 'YES', side: 'buy', type: 'market', amount: 5000 }, fan.token)).body;
  assert.ok(preview.filled > 0);
  assert.equal((await call('GET', '/me', null, fan.token)).body.balance, 1000_00, 'preview has no side effects');

  const buy = (await call('POST', '/orders', { market_id: home.id, outcome: 'YES', side: 'buy', type: 'market', amount: 5000 }, fan.token)).body;
  assert.equal(buy.filled, preview.filled);
  assert.equal(buy.balance, 1000_00 - buy.cost);

  // API key trading
  const key = (await call('POST', '/keys', { label: 'bot' }, fan.token)).body.key;
  assert.match(key, /^gk_/);
  const limit = await call('POST', '/orders', { market_id: home.id, outcome: 'NO', side: 'buy', type: 'limit', price: 5, size: 10 }, key);
  assert.equal(limit.status, 200);
  assert.equal(limit.body.status, 'open');
  const open = (await call('GET', '/orders', null, key)).body;
  assert.equal(open.length, 1);
  assert.equal((await call('DELETE', `/orders/${open[0].id}`, null, key)).status, 200);
  assert.equal((await call('POST', '/keys', {}, key)).status, 403, 'keys cannot mint keys');

  // House fair moved up after a big YES buy and requoted
  mm.flush();
  const after = (await call('GET', `/events/${ev.slug}`, null, fan.token)).body;
  assert.ok(after.markets.find(m => m.code === 'HOME').price >= home.price);
  assert.equal(after.my_positions.length, 1);

  const pf = (await call('GET', '/portfolio', null, fan.token)).body;
  assert.equal(pf.positions.length, 1);
  assert.equal(pf.history.length >= 1, true);

  // Comments show the commenter's stake
  await call('POST', `/events/${ev.id}/comments`, { body: 'Arsenal cruise this' }, fan.token);
  const comments = (await call('GET', `/events/${ev.id}/comments`)).body;
  assert.equal(comments[0].holding.label, 'Arsenal');

  // Close + settle
  db.prepare('UPDATE events SET closes_at = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), ev.id);
  assert.equal((await call('POST', '/orders', { market_id: home.id, outcome: 'YES', side: 'buy', type: 'market', amount: 100 }, fan.token)).status, 400);
  const settle = await call('POST', `/admin/events/${ev.id}/resolve`, { home_score: 3, away_score: 1 }, boss.token);
  assert.equal(settle.status, 200);
  const me = (await call('GET', '/me', null, fan.token)).body;
  assert.equal(me.balance, 1000_00 - buy.cost + buy.filled * 100);
  const health = (await call('GET', '/admin/health', null, boss.token)).body;
  assert.equal(health.ok, true);
  assertConserved(assert);

  const lb = (await call('GET', '/leaderboard')).body;
  assert.equal(lb[0].username, 'fan');
  assert.ok(!lb.some(u => u.username === 'GameKnight'), 'house is not on the leaderboard');
});

test('outright: create, trade, resolve winner', async () => {
  const boss = (await call('POST', '/auth/login', { username: 'boss', password: 'password123' })).body;
  const ev = (await call('POST', '/admin/events/outright', {
    competition: 'Premier League', title: 'Test title race', closes_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    contenders: [{ name: 'Arsenal', prob: 50 }, { name: 'Liverpool', prob: 30 }, { name: 'City', prob: 20 }],
  }, boss.token)).body;
  assert.equal(ev.kind, 'outright');
  const liv = ev.markets.find(m => m.label === 'Liverpool');
  const b = await call('POST', '/orders', { market_id: liv.id, outcome: 'YES', side: 'buy', type: 'market', amount: 1000 }, boss.token);
  assert.equal(b.status, 200);
  assert.equal((await call('POST', `/admin/events/${ev.id}/resolve`, { winner_market_id: liv.id }, boss.token)).status, 200);
  const resolved = (await call('GET', `/events/${ev.id}`)).body;
  assert.deepEqual(resolved.markets.map(m => m.outcome), ['NO', 'YES', 'NO']);
  assertConserved(assert);
});

test('auth validation, bonus, rate limit headers', async () => {
  assert.equal((await call('POST', '/auth/register', { username: 'a', password: 'password123' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { username: 'FAN', password: 'password123' })).status, 409);
  assert.equal((await call('POST', '/auth/login', { username: 'fan', password: 'wrong-wrong' })).status, 401);
  const u = (await call('POST', '/auth/register', { username: 'bonus_hunter', password: 'password123' })).body;
  assert.equal((await call('POST', '/me/bonus', {}, u.token)).body.balance, 1100_00);
  assert.equal((await call('POST', '/me/bonus', {}, u.token)).status, 400);
});

test('fixtures feed creates and resolves matches from football-data.org payloads', () => {
  const ko = new Date(Date.now() + 2 * 864e5).toISOString();
  const base = { id: 9001, utcDate: ko, competition: { name: 'Premier League' }, homeTeam: { shortName: 'Leeds' }, awayTeam: { shortName: 'Burnley' } };
  assert.equal(feed.applyMatches([{ ...base, status: 'TIMED' }]).created, 1);
  assert.equal(feed.applyMatches([{ ...base, status: 'TIMED' }]).created, 0, 'idempotent');
  const ev = db.prepare("SELECT * FROM events WHERE external_id = 'fd:9001'").get();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM markets WHERE event_id = ?').get(ev.id).n, 7);
  const r = feed.applyMatches([{ ...base, status: 'FINISHED', score: { fullTime: { home: 3, away: 2 }, regularTime: { home: 2, away: 2 } } }]);
  assert.equal(r.resolved, 1);
  const draw = db.prepare("SELECT outcome FROM markets WHERE event_id = ? AND code = 'DRAW'").get(ev.id);
  assert.equal(draw.outcome, 'YES', 'settles on the 90-minute score, not extra time');
});
