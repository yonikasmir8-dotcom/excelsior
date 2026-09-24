process.env.DB_PATH = ':memory:';
process.env.SEED_DEMO = 'false';
process.env.ADMIN_USERS = 'boss';
process.env.AUTH_RATE_PER_MIN = '1000';
delete process.env.FOOTBALL_DATA_TOKEN;

const server = require('../server');
const ex = require('../exchange');
const events = require('../events');
const mm = require('../marketmaker');
const db = require('../db');

let n = 0;
function makeUser(balance = 1000_00) {
  const { lastInsertRowid: id } = db.prepare('INSERT INTO users (username, pass_hash, granted, created_at) VALUES (?, ?, ?, ?)')
    .run(`user${++n}_${Date.now() % 1e6}`, 'x:y', balance, ex.now());
  ex.credit(id, balance, 'signup', null);
  return id;
}
const bal = id => db.prepare('SELECT balance FROM users WHERE id = ?').get(id).balance;
const pos = (id, m) => ex.getPos(id, m);

function newMatch(opts = {}) {
  const id = events.createMatchEvent({ competition: 'Test League', home: 'Home FC', away: 'Away FC', kickoff: new Date(Date.now() + 864e5), ...opts });
  const markets = Object.fromEntries(db.prepare('SELECT id, code FROM markets WHERE event_id = ?').all(id).map(m => [m.code, m.id]));
  return { id, markets };
}

// Every cent that entered the system is either cash, escrowed in an open buy order,
// or backing an outstanding YES+NO pair (100¢ each).
function assertConserved(assert) {
  const inflow = db.prepare("SELECT COALESCE(SUM(delta), 0) AS v FROM ledger WHERE reason IN ('signup','bonus','house_float','house_topup','deposit','withdrawal','withdrawal_reversal')").get().v;
  const cash = db.prepare('SELECT SUM(balance) AS v FROM users').get().v;
  const escrow = db.prepare("SELECT COALESCE(SUM(price * (size - filled)), 0) AS v FROM orders WHERE status = 'open' AND side = 'buy'").get().v;
  const pairs = db.prepare("SELECT COALESCE(SUM(p.yes), 0) AS v FROM positions p JOIN markets m ON m.id = p.market_id WHERE m.status = 'open'").get().v;
  const payouts = db.prepare("SELECT COALESCE(SUM(delta), 0) AS v FROM ledger WHERE reason = 'payout'").get().v;
  const unbalanced = db.prepare('SELECT market_id FROM positions GROUP BY market_id HAVING SUM(yes) != SUM(no)').all();
  assert.deepEqual(unbalanced, [], 'YES and NO outstanding must match in every market');
  assert.equal(cash + escrow + pairs * 100, inflow, 'cash + escrow + collateral must equal money in');
  const mismatch = db.prepare('SELECT u.id FROM users u LEFT JOIN ledger l ON l.user_id = u.id GROUP BY u.id HAVING u.balance != COALESCE(SUM(l.delta), 0)').all();
  assert.deepEqual(mismatch, [], 'balances must reconcile with the ledger');
  return { inflow, payouts };
}

module.exports = { ...server, ex, events, mm, db, makeUser, bal, pos, newMatch, assertConserved };
