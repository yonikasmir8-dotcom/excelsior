// Real-money layer: wallet (deposits/withdrawals), identity + age verification,
// safer-gambling controls, and the launch gate.
//
// MONEY_MODE=play (default) — Knight Coins, free signup balance, daily bonus. Nothing here runs.
// MONEY_MODE=real            — GBP. No free money; deposits via a payments provider; every
//                               deposit and trade requires verified identity (18+) and passes
//                               safer-gambling checks. The server refuses to start in real mode
//                               until licensing + providers are configured (assertLaunchReady).
//
// Providers are adapters. `sandbox` implementations ship here so the whole flow runs end to end
// in development and tests; production adapters (e.g. Trustly / TrueLayer open banking, a card
// acquirer, an IDV vendor, GAMSTOP) implement the same small contracts.

const crypto = require('crypto');
const db = require('./db');
const { ApiError, credit, now } = require('./exchange');

const cfg = () => ({
  mode: process.env.MONEY_MODE === 'real' ? 'real' : 'play',
  currency: process.env.MONEY_MODE === 'real' ? 'GBP' : 'KC',
  symbol: process.env.MONEY_MODE === 'real' ? '£' : '₭',
  feeBps: Number(process.env.TAKER_FEE_BPS || 0),
  minDeposit: Number(process.env.MIN_DEPOSIT || 5_00),
  maxDeposit: Number(process.env.MAX_DEPOSIT || 5_000_00),
  minWithdrawal: Number(process.env.MIN_WITHDRAWAL || 10_00),
  // UKGC financial-vulnerability check trigger: net deposits over a rolling 30 days (Feb 2026: £150)
  fvcThreshold: Number(process.env.FVC_THRESHOLD || 150_00),
  // Enhanced financial-risk assessment triggers (full-rollout thresholds; staged by operator size)
  fraDay: Number(process.env.FRA_24H_THRESHOLD || 1_000_00),
  fra90: Number(process.env.FRA_90D_THRESHOLD || 3_000_00),
  allowedCountries: (process.env.ALLOWED_COUNTRIES || 'GB').split(',').map(s => s.trim().toUpperCase()),
  geoEnforce: process.env.GEO_ENFORCE === 'true',
  operator: process.env.OPERATOR_LEGAL_NAME || null,
  licence: process.env.LICENCE_NUMBER || null,
});
const isReal = () => cfg().mode === 'real';

function audit(userId, action, detail) {
  db.prepare('INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)')
    .run(userId ?? null, action, detail ? JSON.stringify(detail) : null, now());
}

// ── Provider adapters ────────────────────────────────────────────────────────
// payments: createDeposit({ payment, user }) → { status: 'completed'|'pending'|'failed', ref, redirect_url?, reason? }
//           createPayout({ payment, user })  → { status, ref, reason? }
//           verifyWebhook(req) → { ref, status, reason? } | throws
// identity: verify({ user, full_name, dob, postcode, country }) → { status: 'verified'|'rejected'|'pending', ref, reason? }
// exclusion: isExcluded({ user, full_name, dob, postcode }) → boolean   (GAMSTOP in the UK)
const SANDBOX = {
  payments: {
    // Amounts ending in 13p fail, ending in 77p stay pending until a webhook — handy for testing
    createDeposit: ({ payment }) => payment.amount % 100 === 13 ? { status: 'failed', ref: `sbx_${payment.id}`, reason: 'Declined by bank (sandbox)' }
      : payment.amount % 100 === 77 ? { status: 'pending', ref: `sbx_${payment.id}` }
      : { status: 'completed', ref: `sbx_${payment.id}` },
    createPayout: ({ payment }) => payment.amount % 100 === 13 ? { status: 'failed', ref: `sbx_${payment.id}`, reason: 'Payout rejected (sandbox)' } : { status: 'completed', ref: `sbx_${payment.id}` },
    verifyWebhook: req => {
      const sig = req.headers['x-sandbox-signature'];
      const expected = crypto.createHash('sha256').update(`${process.env.SANDBOX_WEBHOOK_SECRET || 'sandbox'}:${req.body?.ref}:${req.body?.status}`).digest('hex');
      if (sig !== expected) throw new ApiError(401, 'Bad webhook signature');
      return { ref: req.body.ref, status: req.body.status, reason: req.body.reason };
    },
  },
  identity: {
    verify: ({ full_name, dob }) => {
      const age = (Date.now() - new Date(dob)) / (365.25 * 864e5);
      if (!full_name || isNaN(age)) return { status: 'rejected', reason: 'Name and date of birth are required' };
      if (age < 18) return { status: 'rejected', reason: 'You must be 18 or over' };
      if (/fail/i.test(full_name)) return { status: 'rejected', reason: 'Identity could not be verified (sandbox)' };
      return { status: 'verified', ref: `idv_${crypto.randomBytes(6).toString('hex')}` };
    },
  },
  exclusion: {
    isExcluded: ({ full_name }) => (process.env.SANDBOX_GAMSTOP_NAMES || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(String(full_name || '').toLowerCase()),
  },
};
const PROVIDERS = { payments: { sandbox: SANDBOX.payments }, identity: { sandbox: SANDBOX.identity }, exclusion: { sandbox: SANDBOX.exclusion } };
const provider = kind => {
  const name = process.env[{ payments: 'PAYMENTS_PROVIDER', identity: 'KYC_PROVIDER', exclusion: 'EXCLUSION_PROVIDER' }[kind]] || 'sandbox';
  const p = PROVIDERS[kind][name];
  if (!p) throw new ApiError(500, `No ${kind} adapter named "${name}" is installed`);
  return { name, ...p };
};

// Refuse to take real money unless the business side is in place.
function assertLaunchReady() {
  if (!isReal()) return { ok: true, mode: 'play' };
  const c = cfg();
  const missing = [];
  if (!c.operator) missing.push('OPERATOR_LEGAL_NAME');
  if (!c.licence) missing.push('LICENCE_NUMBER (Gambling Commission operating licence)');
  for (const k of ['PAYMENTS_PROVIDER', 'KYC_PROVIDER', 'EXCLUSION_PROVIDER']) {
    const v = process.env[k] || 'sandbox';
    if (v === 'sandbox' && process.env.ALLOW_SANDBOX_PROVIDERS !== 'true') missing.push(`${k} (sandbox not allowed in production)`);
  }
  if (process.env.HOUSE_MARKET_MAKER === 'true' && !process.env.GENERAL_BETTING_LICENCE) missing.push('GENERAL_BETTING_LICENCE (the house market maker takes positions)');
  if (missing.length) {
    const msg = `Real-money mode is locked. Missing:\n  - ${missing.join('\n  - ')}`;
    const err = new Error(msg);
    err.missing = missing;
    throw err;
  }
  return { ok: true, mode: 'real' };
}

// ── Safer gambling ───────────────────────────────────────────────────────────
function rg(userId) {
  let row = db.prepare('SELECT * FROM rg_settings WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare('INSERT INTO rg_settings (user_id, updated_at) VALUES (?, ?)').run(userId, now());
    row = db.prepare('SELECT * FROM rg_settings WHERE user_id = ?').get(userId);
  }
  // Apply limit increases once their 24h cooling-off has passed
  if (row.pending_limits && row.pending_effective_at <= now()) {
    const p = JSON.parse(row.pending_limits);
    db.prepare('UPDATE rg_settings SET limit_day = ?, limit_week = ?, limit_month = ?, pending_limits = NULL, pending_effective_at = NULL, updated_at = ? WHERE user_id = ?')
      .run(p.day, p.week, p.month, now(), userId);
    audit(userId, 'rg.limits_applied', p);
    row = db.prepare('SELECT * FROM rg_settings WHERE user_id = ?').get(userId);
  }
  return row;
}

function setLimits(userId, { day, week, month }) {
  const cur = rg(userId);
  const clean = v => (v == null || v === '' ? null : Math.max(0, Math.round(Number(v))));
  const next = { day: clean(day), week: clean(week), month: clean(month) };
  if ([next.day, next.week, next.month].some(v => v != null && isNaN(v))) throw new ApiError(400, 'Limits must be amounts in pence');
  // Decreases (or adding a limit) apply now; increases (or removing a limit) wait 24 hours
  const looser = (a, b) => (b == null ? a != null : a != null && b > a);
  const increase = looser(cur.limit_day, next.day) || looser(cur.limit_week, next.week) || looser(cur.limit_month, next.month);
  if (increase) {
    const at = new Date(Date.now() + 864e5).toISOString();
    db.prepare('UPDATE rg_settings SET pending_limits = ?, pending_effective_at = ?, updated_at = ? WHERE user_id = ?').run(JSON.stringify(next), at, now(), userId);
    audit(userId, 'rg.limits_increase_requested', next);
    return { applied: false, effective_at: at };
  }
  db.prepare('UPDATE rg_settings SET limit_day = ?, limit_week = ?, limit_month = ?, pending_limits = NULL, pending_effective_at = NULL, updated_at = ? WHERE user_id = ?')
    .run(next.day, next.week, next.month, now(), userId);
  audit(userId, 'rg.limits_set', next);
  return { applied: true };
}

function takeBreak(userId, hours) {
  const h = Number(hours);
  if (![24, 72, 168, 720, 1440].includes(h)) throw new ApiError(400, 'Choose 1, 3, 7, 30 or 60 days');
  rg(userId);
  const until = new Date(Date.now() + h * 3600e3).toISOString();
  db.prepare('UPDATE rg_settings SET timeout_until = ?, updated_at = ? WHERE user_id = ?').run(until, now(), userId);
  cancelOpenOrders(userId);
  audit(userId, 'rg.timeout', { until });
  return { until };
}

function selfExclude(userId, months) {
  const m = Number(months);
  if (![6, 12, 60].includes(m)) throw new ApiError(400, 'Choose 6 months, 1 year or 5 years');
  rg(userId);
  const until = new Date(Date.now() + m * 30.44 * 864e5).toISOString();
  db.prepare('UPDATE rg_settings SET excluded_until = ?, updated_at = ? WHERE user_id = ?').run(until, now(), userId);
  cancelOpenOrders(userId);
  audit(userId, 'rg.self_exclusion', { until, months: m });
  return { until };
}

function cancelOpenOrders(userId) {
  require('./exchange').cancelAll('user_id = ?', [userId]);
}

function netDeposits(userId, sinceMs) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const r = db.prepare(`SELECT COALESCE(SUM(CASE WHEN kind = 'deposit' THEN amount ELSE -amount END), 0) AS v FROM payments
    WHERE user_id = ? AND status = 'completed' AND created_at >= ?`).get(userId, since);
  return r.v;
}
function depositedSince(userId, sinceMs) {
  return db.prepare(`SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE user_id = ? AND kind = 'deposit' AND status IN ('completed', 'pending') AND created_at >= ?`)
    .get(userId, new Date(Date.now() - sinceMs).toISOString()).v;
}

// Blocks gambling for excluded / on-break / unverified users. Used by deposits and trading.
function gamblingBlock(user) {
  if (!isReal()) return null;
  const k = db.prepare('SELECT * FROM kyc WHERE user_id = ?').get(user.id);
  if (!k || k.status !== 'verified') return 'Verify your identity and age before playing';
  const r = rg(user.id);
  if (r.excluded_until && r.excluded_until > now()) return `You are self-excluded until ${r.excluded_until.slice(0, 10)}`;
  if (r.timeout_until && r.timeout_until > now()) return `You are taking a break until ${r.timeout_until.slice(0, 16).replace('T', ' ')}`;
  return null;
}

// ── Identity ─────────────────────────────────────────────────────────────────
function verifyIdentity(user, { full_name, dob, postcode, country }) {
  if (!isReal()) throw new ApiError(400, 'Identity checks are only needed for real-money play');
  const c = cfg();
  const ctry = String(country || '').toUpperCase();
  if (!c.allowedCountries.includes(ctry)) throw new ApiError(400, `Game Knight is only available to residents of ${c.allowedCountries.join(', ')}`);
  const idv = provider('identity');
  const res = idv.verify({ user, full_name, dob, postcode, country: ctry });
  let status = res.status, reason = res.reason || null;
  if (status === 'verified' && provider('exclusion').isExcluded({ user, full_name, dob, postcode })) {
    status = 'rejected'; reason = 'You are registered with a national self-exclusion scheme (GAMSTOP)';
  }
  db.prepare(`INSERT INTO kyc (user_id, status, provider, provider_ref, full_name, dob, country, reason, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET status = excluded.status, provider = excluded.provider, provider_ref = excluded.provider_ref,
      full_name = excluded.full_name, dob = excluded.dob, country = excluded.country, reason = excluded.reason, updated_at = excluded.updated_at`)
    .run(user.id, status, idv.name, res.ref || null, full_name, dob, ctry, reason, now());
  audit(user.id, 'kyc.result', { status, reason, provider: idv.name });
  return { status, reason };
}

// ── Wallet ───────────────────────────────────────────────────────────────────
function deposit(user, { amount, method = 'open_banking', idempotency_key }) {
  if (!isReal()) throw new ApiError(400, 'Deposits are disabled in play-money mode');
  const c = cfg();
  const amt = Math.round(Number(amount));
  if (!Number.isInteger(amt) || amt < c.minDeposit || amt > c.maxDeposit) throw new ApiError(400, `Deposits must be between £${c.minDeposit / 100} and £${c.maxDeposit / 100}`);
  const block = gamblingBlock(user);
  if (block) throw new ApiError(403, block);
  if (idempotency_key) {
    const prior = db.prepare('SELECT * FROM payments WHERE idempotency_key = ?').get(String(idempotency_key));
    if (prior) return publicPayment(prior);
  }
  const r = rg(user.id);
  for (const [lim, ms, label] of [[r.limit_day, 864e5, 'daily'], [r.limit_week, 7 * 864e5, 'weekly'], [r.limit_month, 30 * 864e5, 'monthly']]) {
    if (lim != null && depositedSince(user.id, ms) + amt > lim) {
      audit(user.id, 'rg.deposit_blocked_by_limit', { amount: amt, limit: label });
      throw new ApiError(403, `This would take you over your ${label} deposit limit of £${(lim / 100).toFixed(2)}`);
    }
  }
  const pay = provider('payments');
  const ts = now();
  const { lastInsertRowid: id } = db.prepare(`INSERT INTO payments (user_id, kind, amount, status, provider, method, idempotency_key, created_at, updated_at)
    VALUES (?, 'deposit', ?, 'pending', ?, ?, ?, ?, ?)`).run(user.id, amt, pay.name, method, idempotency_key ? String(idempotency_key) : null, ts, ts);
  const res = pay.createDeposit({ payment: { id, amount: amt, method }, user });
  db.prepare('UPDATE payments SET provider_ref = ?, updated_at = ? WHERE id = ?').run(res.ref || null, now(), id);
  audit(user.id, 'wallet.deposit_initiated', { id, amount: amt, provider: pay.name });
  if (res.status !== 'pending') settlePayment(res.ref, res.status, res.reason);
  const out = publicPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
  if (res.redirect_url) out.redirect_url = res.redirect_url;
  return out;
}

function withdraw(user, { amount }) {
  if (!isReal()) throw new ApiError(400, 'Withdrawals are disabled in play-money mode');
  const c = cfg();
  const amt = Math.round(Number(amount));
  if (!Number.isInteger(amt) || amt < c.minWithdrawal) throw new ApiError(400, `Minimum withdrawal is £${c.minWithdrawal / 100}`);
  const k = db.prepare('SELECT status FROM kyc WHERE user_id = ?').get(user.id);
  if (!k || k.status !== 'verified') throw new ApiError(403, 'Verify your identity before withdrawing');
  const pay = provider('payments');
  const id = db.transaction(() => {
    const bal = db.prepare('SELECT balance FROM users WHERE id = ?').get(user.id).balance;
    if (amt > bal) throw new ApiError(400, 'You can only withdraw cash that is not in open orders or positions');
    const ts = now();
    const { lastInsertRowid } = db.prepare(`INSERT INTO payments (user_id, kind, amount, status, provider, created_at, updated_at) VALUES (?, 'withdrawal', ?, 'pending', ?, ?, ?)`)
      .run(user.id, amt, pay.name, ts, ts);
    credit(user.id, -amt, 'withdrawal', lastInsertRowid);
    return lastInsertRowid;
  })();
  const res = pay.createPayout({ payment: { id, amount: amt }, user });
  db.prepare('UPDATE payments SET provider_ref = ?, updated_at = ? WHERE id = ?').run(res.ref || null, now(), id);
  audit(user.id, 'wallet.withdrawal_initiated', { id, amount: amt, provider: pay.name });
  if (res.status !== 'pending') settlePayment(res.ref, res.status, res.reason);
  return publicPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(id));
}

// Provider confirmation (inline for instant rails, or via webhook). Idempotent.
function settlePayment(ref, status, reason) {
  return db.transaction(() => {
    const p = db.prepare('SELECT * FROM payments WHERE provider_ref = ?').get(ref);
    if (!p) throw new ApiError(404, 'Unknown payment');
    if (p.status !== 'pending') return publicPayment(p);
    if (!['completed', 'failed'].includes(status)) throw new ApiError(400, 'status must be completed or failed');
    db.prepare('UPDATE payments SET status = ?, failure_reason = ?, updated_at = ? WHERE id = ?').run(status, reason || null, now(), p.id);
    if (p.kind === 'deposit' && status === 'completed') credit(p.user_id, p.amount, 'deposit', p.id);
    if (p.kind === 'withdrawal' && status === 'failed') credit(p.user_id, p.amount, 'withdrawal_reversal', p.id);
    audit(p.user_id, `wallet.${p.kind}_${status}`, { id: p.id, amount: p.amount, reason });
    if (p.kind === 'deposit' && status === 'completed') checkAffordability(p.user_id);
    return publicPayment(db.prepare('SELECT * FROM payments WHERE id = ?').get(p.id));
  })();
}

// Flag customers who cross the regulator's financial-risk thresholds for review
function checkAffordability(userId) {
  const c = cfg();
  const flags = [];
  if (netDeposits(userId, 30 * 864e5) > c.fvcThreshold) flags.push('financial_vulnerability_check');
  if (netDeposits(userId, 864e5) >= c.fraDay || netDeposits(userId, 90 * 864e5) >= c.fra90) flags.push('financial_risk_assessment');
  for (const f of flags) {
    const seen = db.prepare("SELECT 1 FROM audit_log WHERE user_id = ? AND action = ? AND created_at >= ?").get(userId, `flag.${f}`, new Date(Date.now() - 30 * 864e5).toISOString());
    if (!seen) audit(userId, `flag.${f}`, { net_30d: netDeposits(userId, 30 * 864e5) });
  }
  return flags;
}

const publicPayment = p => ({ id: p.id, kind: p.kind, amount: p.amount, status: p.status, method: p.method, reason: p.failure_reason, created_at: p.created_at });

function walletView(user) {
  const r = isReal() ? rg(user.id) : null;
  const k = db.prepare('SELECT status, reason, full_name, updated_at FROM kyc WHERE user_id = ?').get(user.id);
  return {
    mode: cfg().mode, balance: db.prepare('SELECT balance FROM users WHERE id = ?').get(user.id).balance,
    kyc: k || { status: 'unverified' },
    limits: r && { day: r.limit_day, week: r.limit_week, month: r.limit_month, pending: r.pending_limits ? JSON.parse(r.pending_limits) : null, pending_effective_at: r.pending_effective_at },
    timeout_until: r?.timeout_until > now() ? r.timeout_until : null,
    excluded_until: r?.excluded_until > now() ? r.excluded_until : null,
    reality_check_min: r?.reality_check_min ?? 30,
    net_deposits_30d: netDeposits(user.id, 30 * 864e5),
    deposited_today: depositedSince(user.id, 864e5),
    payments: db.prepare('SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 50').all(user.id).map(publicPayment),
    block: gamblingBlock(user),
  };
}

// Customer-funds position: what the operator owes players (must be held in segregated accounts)
function fundsReport() {
  const cash = db.prepare('SELECT COALESCE(SUM(balance), 0) AS v FROM users WHERE is_house = 0 AND is_system = 0 AND is_bot = 0').get().v;
  const escrow = db.prepare("SELECT COALESCE(SUM(o.price * (o.size - o.filled)), 0) AS v FROM orders o JOIN users u ON u.id = o.user_id WHERE o.status = 'open' AND o.side = 'buy' AND u.is_house = 0 AND u.is_bot = 0").get().v;
  const pendingOut = db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE kind = 'withdrawal' AND status = 'pending'").get().v;
  const fees = db.prepare("SELECT COALESCE(SUM(balance), 0) AS v FROM users WHERE is_system = 1").get().v;
  const deposits = db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE kind = 'deposit' AND status = 'completed'").get().v;
  const withdrawals = db.prepare("SELECT COALESCE(SUM(amount), 0) AS v FROM payments WHERE kind = 'withdrawal' AND status = 'completed'").get().v;
  const flags = db.prepare("SELECT action, COUNT(DISTINCT user_id) AS users FROM audit_log WHERE action LIKE 'flag.%' GROUP BY action").all();
  return { customer_cash: cash, customer_escrow: escrow, pending_withdrawals: pendingOut, platform_fees: fees, deposits_total: deposits, withdrawals_total: withdrawals, flags };
}

module.exports = {
  cfg, isReal, assertLaunchReady, audit, provider, PROVIDERS, rg, setLimits, takeBreak, selfExclude, gamblingBlock,
  verifyIdentity, deposit, withdraw, settlePayment, checkAffordability, walletView, fundsReport, netDeposits,
};
