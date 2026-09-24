// Real-money mode, end to end against the sandbox providers
process.env.MONEY_MODE = 'real';
process.env.ALLOW_SANDBOX_PROVIDERS = 'true';
process.env.OPERATOR_LEGAL_NAME = 'Game Knight Test Ltd';
process.env.LICENCE_NUMBER = 'TEST-000000';
process.env.TAKER_FEE_BPS = '200';
process.env.SANDBOX_GAMSTOP_NAMES = 'Excluded Person';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { app, db, ex, newMatch, assertConserved } = require('./helpers');

let base, server;
test.before(() => new Promise(r => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}/api`; r(); }); }));
test.after(() => server.close());

async function call(method, p, body, token, headers = {}) {
  const res = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...headers }, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
const signup = async name => (await call('POST', '/auth/register', { username: name, password: 'password123' })).body;
const verify = (t, name = 'Alex Fan', dob = '1990-05-01') => call('POST', '/kyc', { full_name: name, dob, postcode: 'N5 1BU', country: 'GB' }, t);
const bal = id => db.prepare('SELECT balance FROM users WHERE id = ?').get(id).balance;

test('real-money server refuses to boot without a licence and live providers', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, MONEY_MODE: 'real', DB_PATH: ':memory:', LICENCE_NUMBER: '', OPERATOR_LEGAL_NAME: '', ALLOW_SANDBOX_PROVIDERS: '' }, encoding: 'utf8', timeout: 15000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Real-money mode is locked/);
  assert.match(r.stderr, /LICENCE_NUMBER/);
  assert.match(r.stderr, /PAYMENTS_PROVIDER/);
});

test('no free money, no bonus; config reports GBP', async () => {
  const cfg = (await call('GET', '/config')).body;
  assert.equal(cfg.mode, 'real');
  assert.equal(cfg.symbol, '£');
  const u = await signup('realfan1');
  assert.equal(u.user.balance, 0);
  assert.equal((await call('POST', '/me/bonus', {}, u.token)).status, 400);
});

test('identity: under-18, GAMSTOP and non-GB residents are refused', async () => {
  const u = await signup('kid');
  assert.equal((await verify(u.token, 'Young Fan', new Date(Date.now() - 16 * 365 * 864e5).toISOString().slice(0, 10))).body.status, 'rejected');
  const g = await signup('gamstopped');
  assert.equal((await verify(g.token, 'Excluded Person')).body.status, 'rejected');
  const f = await signup('abroad');
  assert.equal((await call('POST', '/kyc', { full_name: 'Abroad Fan', dob: '1990-01-01', country: 'US' }, f.token)).status, 400);
});

test('deposits require verification, respect limits, are idempotent, and fund trading with a fee', async () => {
  const u = await signup('depositor');
  assert.equal((await call('POST', '/wallet/deposits', { amount: 20_00 }, u.token)).status, 403, 'unverified cannot deposit');
  assert.equal((await verify(u.token)).body.status, 'verified');

  const d1 = await call('POST', '/wallet/deposits', { amount: 50_00, idempotency_key: 'k1' }, u.token);
  assert.equal(d1.body.status, 'completed');
  const again = await call('POST', '/wallet/deposits', { amount: 50_00, idempotency_key: 'k1' }, u.token);
  assert.equal(again.body.id, d1.body.id, 'same key, same payment');
  assert.equal(bal(u.user.id), 50_00);

  const declined = await call('POST', '/wallet/deposits', { amount: 10_13 }, u.token);
  assert.equal(declined.body.status, 'failed');
  assert.equal(bal(u.user.id), 50_00);

  // Daily limit: tightening applies immediately
  assert.equal((await call('PUT', '/rg/limits', { day: 60_00 }, u.token)).body.applied, true);
  assert.equal((await call('POST', '/wallet/deposits', { amount: 20_00 }, u.token)).status, 403, 'over daily limit');
  // Loosening waits 24h
  const up = (await call('PUT', '/rg/limits', { day: 500_00 }, u.token)).body;
  assert.equal(up.applied, false);
  assert.ok(up.effective_at > new Date().toISOString());

  // Trade: a counterparty rests an order, our player takes it and pays the 2% fee
  const mk = await signup('maker1'); await verify(mk.token, 'Maker One');
  await call('POST', '/wallet/deposits', { amount: 100_00 }, mk.token);
  const { markets } = newMatch();
  assert.equal((await call('POST', '/orders', { market_id: markets.HOME, outcome: 'NO', side: 'buy', type: 'limit', price: 60, size: 50 }, mk.token)).status, 200);
  const preview = (await call('POST', '/orders/preview', { market_id: markets.HOME, outcome: 'YES', side: 'buy', type: 'market', size: 20 }, u.token)).body;
  assert.equal(preview.fee, 16, 'preview shows the fee (and must not leave a dangling fee account behind)');
  const buy = (await call('POST', '/orders', { market_id: markets.HOME, outcome: 'YES', side: 'buy', type: 'market', size: 20 }, u.token)).body;
  assert.equal(buy.filled, 20);
  assert.equal(buy.cost, 20 * 40);
  assert.equal(buy.fee, Math.ceil(800 * 0.02));
  assert.equal(bal(u.user.id), 50_00 - 800 - 16);
  assert.equal(bal(ex.feeAccount()), 16);
  assertConserved(assert);
});

test('withdrawals debit immediately and reverse when the payout fails', async () => {
  const u = await signup('withdrawer'); await verify(u.token, 'Will Draw');
  await call('POST', '/wallet/deposits', { amount: 100_00 }, u.token);
  const w = (await call('POST', '/wallet/withdrawals', { amount: 40_00 }, u.token)).body;
  assert.equal(w.status, 'completed');
  assert.equal(bal(u.user.id), 60_00);
  const bad = (await call('POST', '/wallet/withdrawals', { amount: 20_13 }, u.token)).body;
  assert.equal(bad.status, 'failed');
  assert.equal(bal(u.user.id), 60_00, 'failed payout refunded');
  assert.equal((await call('POST', '/wallet/withdrawals', { amount: 1000_00 }, u.token)).status, 400);
  assertConserved(assert);
});

test('pending deposits settle via signed webhook, once', async () => {
  const u = await signup('webhooker'); await verify(u.token, 'Web Hook');
  const d = (await call('POST', '/wallet/deposits', { amount: 30_77 }, u.token)).body;
  assert.equal(d.status, 'pending');
  const ref = db.prepare('SELECT provider_ref FROM payments WHERE id = ?').get(d.id).provider_ref;
  const sig = require('crypto').createHash('sha256').update(`sandbox:${ref}:completed`).digest('hex');
  assert.equal((await call('POST', '/payments/webhook/sandbox', { ref, status: 'completed' }, null, { 'x-sandbox-signature': 'nope' })).status, 401);
  assert.equal((await call('POST', '/payments/webhook/sandbox', { ref, status: 'completed' }, null, { 'x-sandbox-signature': sig })).body.status, 'completed');
  await call('POST', '/payments/webhook/sandbox', { ref, status: 'completed' }, null, { 'x-sandbox-signature': sig });
  assert.equal(bal(u.user.id), 30_77, 'credited exactly once');
});

test('take-a-break and self-exclusion block deposits and trading but not withdrawals', async () => {
  const u = await signup('breaker'); await verify(u.token, 'Break Taker');
  await call('POST', '/wallet/deposits', { amount: 50_00 }, u.token);
  const { markets } = newMatch();
  await call('POST', '/orders', { market_id: markets.DRAW, outcome: 'YES', side: 'buy', type: 'limit', price: 20, size: 10 }, u.token);
  assert.equal((await call('POST', '/rg/break', { hours: 24 }, u.token)).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status = 'open'").get(u.user.id).n, 0, 'open orders cancelled');
  assert.equal((await call('POST', '/wallet/deposits', { amount: 10_00 }, u.token)).status, 403);
  assert.equal((await call('POST', '/orders', { market_id: markets.DRAW, outcome: 'YES', side: 'buy', type: 'market', size: 1 }, u.token)).status, 403);
  assert.equal((await call('POST', '/wallet/withdrawals', { amount: 50_00 }, u.token)).body.status, 'completed');

  const x = await signup('excluder'); await verify(x.token, 'Self Excluder');
  assert.equal((await call('POST', '/rg/self-exclude', { months: 6 }, x.token)).status, 200);
  assert.equal((await call('POST', '/wallet/deposits', { amount: 10_00 }, x.token)).status, 403);
});

test('crossing the £150 net-deposit threshold flags a financial vulnerability check', async () => {
  const u = await signup('bigdepositor'); await verify(u.token, 'Big Depositor');
  await call('POST', '/wallet/deposits', { amount: 100_00 }, u.token);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE user_id = ? AND action = 'flag.financial_vulnerability_check'").get(u.user.id).n, 0);
  await call('POST', '/wallet/deposits', { amount: 60_00 }, u.token);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE user_id = ? AND action = 'flag.financial_vulnerability_check'").get(u.user.id).n, 1);
});
