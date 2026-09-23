process.env.DB_PATH = ':memory:';
process.env.SEED_DEMO = 'false';
process.env.ADMIN_USERS = 'boss';

const test = require('node:test');
const assert = require('node:assert/strict');
const { app, db } = require('../server');

let base, server;
test.before(() => new Promise(r => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
test.after(() => server.close());

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test('full market lifecycle: create → trade → settle', async () => {
  const boss = (await call('POST', '/auth/register', { username: 'boss', password: 'password123' })).body;
  const fan = (await call('POST', '/auth/register', { username: 'fan', password: 'password123' })).body;
  assert.equal(boss.user.is_admin, true);
  assert.equal(fan.user.is_admin, false);
  assert.equal(fan.user.balance, 1000);

  const denied = await call('POST', '/admin/fixtures', { competition: 'X', home: 'A', away: 'B', kickoff: new Date(Date.now() + 864e5) }, fan.token);
  assert.equal(denied.status, 403);

  const fx = (await call('POST', '/admin/fixtures', {
    competition: 'Premier League', home: 'Arsenal', away: 'Spurs',
    kickoff: new Date(Date.now() + 864e5).toISOString(), probs: { home: 0.5, draw: 0.25, away: 0.25 },
  }, boss.token)).body;
  assert.equal(fx.state, 'open');
  const result = fx.markets.find(m => m.type === '1X2');
  const home = result.outcomes.find(o => o.code === 'HOME');
  assert.ok(Math.abs(home.price - 0.5) < 1e-9);

  const quote = (await call('POST', `/markets/${result.id}/quote`, { outcomeId: home.id, side: 'buy', amount: 100 }, fan.token)).body;
  assert.ok(quote.shares > 100 && quote.price_after > 0.5);
  assert.equal((await call('GET', '/me', null, fan.token)).body.balance, 1000, 'quote must not move money');

  const buy = (await call('POST', `/markets/${result.id}/trade`, { outcomeId: home.id, side: 'buy', amount: 100 }, fan.token)).body;
  assert.equal(buy.balance, 900);
  assert.ok(Math.abs(buy.shares - quote.shares) < 1e-9);

  const tooMuch = await call('POST', `/markets/${result.id}/trade`, { outcomeId: home.id, side: 'buy', amount: 5000 }, fan.token);
  assert.equal(tooMuch.status, 400);
  const oversell = await call('POST', `/markets/${result.id}/trade`, { outcomeId: home.id, side: 'sell', shares: buy.shares + 1 }, fan.token);
  assert.equal(oversell.status, 400);

  const sell = (await call('POST', `/markets/${result.id}/trade`, { outcomeId: home.id, side: 'sell', shares: buy.shares / 2 }, fan.token)).body;
  assert.ok(sell.amount > 45 && sell.amount < 55);

  const pf = (await call('GET', '/portfolio', null, fan.token)).body;
  assert.equal(pf.open.length, 1);
  assert.ok(Math.abs(pf.open[0].shares - buy.shares / 2) < 1e-9);

  // Kick-off passes → trading closes
  db.prepare('UPDATE fixtures SET kickoff = ? WHERE id = ?').run(new Date(Date.now() - 1000).toISOString(), fx.id);
  const late = await call('POST', `/markets/${result.id}/trade`, { outcomeId: home.id, side: 'buy', amount: 10 }, fan.token);
  assert.equal(late.status, 400);

  const settle = (await call('POST', `/admin/fixtures/${fx.id}/settle`, { home_score: 2, away_score: 0 }, boss.token)).body;
  assert.ok(Math.abs(settle.paid - buy.shares / 2) < 0.01);
  const me = (await call('GET', '/me', null, fan.token)).body;
  assert.ok(Math.abs(me.balance - (900 + sell.amount + buy.shares / 2)) < 0.02);

  const after = (await call('GET', `/fixtures/${fx.id}`)).body;
  assert.equal(after.state, 'settled');
  assert.deepEqual(after.markets.map(m => m.winning_outcome), ['HOME', 'UNDER', 'NO']);

  const again = await call('POST', `/admin/fixtures/${fx.id}/settle`, { home_score: 0, away_score: 0 }, boss.token);
  assert.equal(again.status, 400);
});

test('void refunds remaining cost basis', async () => {
  const boss = (await call('POST', '/auth/login', { username: 'boss', password: 'password123' })).body;
  const v = (await call('POST', '/auth/register', { username: 'voider', password: 'password123' })).body;
  const fx = (await call('POST', '/admin/fixtures', { competition: 'Serie A', home: 'Inter', away: 'Milan', kickoff: new Date(Date.now() + 864e5) }, boss.token)).body;
  const m = fx.markets[1];
  await call('POST', `/markets/${m.id}/trade`, { outcomeId: m.outcomes[0].id, side: 'buy', amount: 250 }, v.token);
  assert.equal((await call('GET', '/me', null, v.token)).body.balance, 750);
  await call('POST', `/admin/fixtures/${fx.id}/void`, {}, boss.token);
  assert.equal((await call('GET', '/me', null, v.token)).body.balance, 1000);
});

test('auth validation and daily bonus', async () => {
  assert.equal((await call('POST', '/auth/register', { username: 'a', password: 'password123' })).status, 400);
  assert.equal((await call('POST', '/auth/register', { username: 'FAN', password: 'password123' })).status, 409);
  assert.equal((await call('POST', '/auth/login', { username: 'fan', password: 'nope-nope' })).status, 401);
  const u = (await call('POST', '/auth/register', { username: 'bonus_hunter', password: 'password123' })).body;
  assert.equal((await call('POST', '/me/bonus', {}, u.token)).body.balance, 1100);
  assert.equal((await call('POST', '/me/bonus', {}, u.token)).status, 400);
});
