// Event + market templates, opening odds, and resolution.
//
// A match event opens seven binary markets. Opening prices come from an
// independent-Poisson goals model driven by each side's expected goals, so the
// 1X2, totals and BTTS lines are mutually consistent from the first second.

const db = require('./db');
const { ApiError, now, resolveMarketTx, cancelAll, bus } = require('./exchange');

// ── Goals model ───────────────────────────────────────────────────────────────
function poissonRow(lambda, max = 10) {
  const row = [Math.exp(-lambda)];
  for (let k = 1; k <= max; k++) row.push((row[k - 1] * lambda) / k);
  return row;
}

function matchProbabilities(xgHome, xgAway) {
  const h = poissonRow(xgHome), a = poissonRow(xgAway);
  const p = { HOME: 0, DRAW: 0, AWAY: 0, OVER15: 0, OVER25: 0, OVER35: 0, BTTS: 0 };
  let total = 0;
  for (let i = 0; i < h.length; i++) {
    for (let j = 0; j < a.length; j++) {
      const pr = h[i] * a[j];
      total += pr;
      if (i > j) p.HOME += pr; else if (i === j) p.DRAW += pr; else p.AWAY += pr;
      if (i + j > 1.5) p.OVER15 += pr;
      if (i + j > 2.5) p.OVER25 += pr;
      if (i + j > 3.5) p.OVER35 += pr;
      if (i > 0 && j > 0) p.BTTS += pr;
    }
  }
  for (const k in p) p[k] /= total;
  return p;
}

const toCents = p => Math.min(97, Math.max(3, Math.round(p * 100)));

const FT = 'after 90 minutes plus stoppage time (extra time and penalty shoot-outs do not count)';
const VOID_RULE = 'If the match is abandoned, or postponed and not played within 48 hours of the scheduled kick-off, the market is voided and every unit pays ₭0.50.';

function matchMarkets(home, away) {
  const fx = `${home} v ${away}`;
  return [
    { code: 'HOME', grp: 'result', label: home, question: `Will ${home} beat ${away}?`, rules: `Resolves YES if ${home} are winning ${FT}. Otherwise NO.` },
    { code: 'DRAW', grp: 'result', label: 'Draw', question: `Will ${fx} end in a draw?`, rules: `Resolves YES if the scores are level ${FT}. Otherwise NO.` },
    { code: 'AWAY', grp: 'result', label: away, question: `Will ${away} beat ${home}?`, rules: `Resolves YES if ${away} are winning ${FT}. Otherwise NO.` },
    { code: 'OVER15', grp: 'goals', label: 'Over 1.5 goals', question: `Will ${fx} have 2 or more goals?`, rules: `Resolves YES if 2 or more goals in total are scored ${FT}.` },
    { code: 'OVER25', grp: 'goals', label: 'Over 2.5 goals', question: `Will ${fx} have 3 or more goals?`, rules: `Resolves YES if 3 or more goals in total are scored ${FT}.` },
    { code: 'OVER35', grp: 'goals', label: 'Over 3.5 goals', question: `Will ${fx} have 4 or more goals?`, rules: `Resolves YES if 4 or more goals in total are scored ${FT}.` },
    { code: 'BTTS', grp: 'btts', label: 'Both teams to score', question: `Will both ${home} and ${away} score?`, rules: `Resolves YES if both teams score at least once ${FT}. Own goals count for the team credited.` },
  ].map(m => ({ ...m, rules: `${m.rules} ${VOID_RULE} Official result per the competition organiser.` }));
}

const RESOLVERS = {
  HOME: (h, a) => h > a, DRAW: (h, a) => h === a, AWAY: (h, a) => h < a,
  OVER15: (h, a) => h + a > 1.5, OVER25: (h, a) => h + a > 2.5, OVER35: (h, a) => h + a > 3.5,
  BTTS: (h, a) => h > 0 && a > 0,
};

// ── Creation ─────────────────────────────────────────────────────────────────
function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}
function uniqueSlug(base) {
  let slug = base, n = 2;
  while (db.prepare('SELECT 1 FROM events WHERE slug = ?').get(slug)) slug = `${base}-${n++}`;
  return slug;
}

const insertMarket = db.prepare(`INSERT INTO markets (event_id, code, label, question, rules, grp, fair, last_price, sort, created_at)
  VALUES (@event_id, @code, @label, @question, @rules, @grp, @fair, @fair, @sort, @created_at)`);
const insertHistory = db.prepare('INSERT INTO price_history (market_id, price, created_at) VALUES (?, ?, ?)');

function createMatchEvent({ competition, home, away, kickoff, xgHome = 1.45, xgAway = 1.15, externalId = null, createdAt = now() }) {
  if (!(xgHome > 0 && xgHome < 6 && xgAway > 0 && xgAway < 6)) throw new ApiError(400, 'Expected goals must be between 0 and 6');
  const ko = new Date(kickoff);
  if (isNaN(ko)) throw new ApiError(400, 'Invalid kick-off time');
  const probs = matchProbabilities(xgHome, xgAway);
  return db.transaction(() => {
    const title = `${home} v ${away}`;
    const { lastInsertRowid: eventId } = db.prepare(`INSERT INTO events
      (slug, kind, competition, title, home, away, starts_at, closes_at, external_id, created_at)
      VALUES (?, 'match', ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uniqueSlug(slugify(`${title} ${ko.toISOString().slice(0, 10)}`)), competition, title, home, away, ko.toISOString(), ko.toISOString(), externalId, createdAt);
    matchMarkets(home, away).forEach((m, i) => {
      const { lastInsertRowid } = insertMarket.run({ ...m, event_id: eventId, fair: toCents(probs[m.code]), sort: i, created_at: createdAt });
      insertHistory.run(lastInsertRowid, toCents(probs[m.code]), createdAt);
    });
    return eventId;
  })();
}

// Outright: one binary market per contender, e.g. "Will Arsenal win the Premier League?"
function createOutrightEvent({ competition, title, question, closesAt, contenders, description = '', createdAt = now() }) {
  if (!Array.isArray(contenders) || contenders.length < 2) throw new ApiError(400, 'Add at least two contenders');
  if (isNaN(new Date(closesAt))) throw new ApiError(400, 'Invalid close date');
  const total = contenders.reduce((s, c) => s + (Number(c.prob) || 0), 0) || 1;
  return db.transaction(() => {
    const { lastInsertRowid: eventId } = db.prepare(`INSERT INTO events (slug, kind, competition, title, closes_at, description, created_at)
      VALUES (?, 'outright', ?, ?, ?, ?, ?)`).run(uniqueSlug(slugify(title)), competition, title, new Date(closesAt).toISOString(), description, createdAt);
    contenders.forEach((c, i) => {
      const fair = Math.min(97, Math.max(1, Math.round(((Number(c.prob) || 0) / total) * 100)));
      const q = (question || 'Will {name} win?').replace('{name}', c.name);
      const { lastInsertRowid } = insertMarket.run({
        event_id: eventId, code: 'TEAM', grp: 'winner', label: c.name, question: q, sort: i, fair, created_at: createdAt,
        rules: `Resolves YES if ${c.name} is the officially declared winner of "${title}". Resolves NO otherwise. If the competition is cancelled without a winner, every market is voided and every unit pays ₭0.50.`,
      });
      insertHistory.run(lastInsertRowid, fair, createdAt);
    });
    return eventId;
  })();
}

// ── Resolution ───────────────────────────────────────────────────────────────
function assertOpenEvent(eventId) {
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!ev) throw new ApiError(404, 'Event not found');
  if (ev.status !== 'open') throw new ApiError(400, `Event already ${ev.status}`);
  return ev;
}

function resolveMatch(eventId, homeScore, awayScore) {
  const res = db.transaction(() => {
    const ev = assertOpenEvent(eventId);
    if (ev.kind !== 'match') throw new ApiError(400, 'Not a match event');
    let paid = 0;
    for (const m of db.prepare('SELECT * FROM markets WHERE event_id = ?').all(eventId)) {
      paid += resolveMarketTx(m.id, RESOLVERS[m.code](homeScore, awayScore) ? 'YES' : 'NO');
    }
    db.prepare("UPDATE events SET status = 'resolved', home_score = ?, away_score = ?, resolved_at = ? WHERE id = ?").run(homeScore, awayScore, now(), eventId);
    return { paid };
  })();
  bus.emit('event', { event_id: eventId });
  return res;
}

function resolveOutright(eventId, winnerMarketId) {
  const res = db.transaction(() => {
    const ev = assertOpenEvent(eventId);
    if (ev.kind !== 'outright') throw new ApiError(400, 'Not an outright event');
    const markets = db.prepare('SELECT * FROM markets WHERE event_id = ?').all(eventId);
    if (!markets.some(m => m.id === Number(winnerMarketId))) throw new ApiError(400, 'Winner must be one of this event\'s markets');
    let paid = 0;
    for (const m of markets) if (m.status === 'open') paid += resolveMarketTx(m.id, m.id === Number(winnerMarketId) ? 'YES' : 'NO');
    db.prepare("UPDATE events SET status = 'resolved', resolved_at = ? WHERE id = ?").run(now(), eventId);
    return { paid };
  })();
  bus.emit('event', { event_id: eventId });
  return res;
}

// Knock a single contender out of an outright early (e.g. relegated, eliminated)
function resolveSingleMarket(marketId, outcome) {
  return db.transaction(() => {
    const m = db.prepare('SELECT * FROM markets WHERE id = ?').get(marketId);
    if (!m) throw new ApiError(404, 'Market not found');
    assertOpenEvent(m.event_id);
    return { paid: resolveMarketTx(m.id, outcome) };
  })();
}

function voidEvent(eventId) {
  const res = db.transaction(() => {
    assertOpenEvent(eventId);
    let paid = 0;
    for (const m of db.prepare("SELECT * FROM markets WHERE event_id = ? AND status = 'open'").all(eventId)) paid += resolveMarketTx(m.id, 'VOID');
    db.prepare("UPDATE events SET status = 'void', resolved_at = ? WHERE id = ?").run(now(), eventId);
    return { paid };
  })();
  bus.emit('event', { event_id: eventId });
  return res;
}

// Stop trading at kick-off / close: pull every resting order and refund escrow.
function closeExpired() {
  const due = db.prepare(`SELECT DISTINCT e.id FROM events e JOIN markets m ON m.event_id = e.id JOIN orders o ON o.market_id = m.id
    WHERE e.status = 'open' AND e.closes_at <= ? AND o.status = 'open'`).all(now());
  for (const { id } of due) cancelAll('market_id IN (SELECT id FROM markets WHERE event_id = ?)', [id]);
  return due.length;
}

function eventState(ev) {
  if (ev.status !== 'open') return ev.status;
  return new Date(ev.closes_at) > new Date() ? 'open' : 'closed';
}

module.exports = {
  matchProbabilities, createMatchEvent, createOutrightEvent, resolveMatch, resolveOutright, resolveSingleMarket,
  voidEvent, closeExpired, eventState, RESOLVERS,
};
