// Fixtures + results feed from football-data.org (free tier covers the top European
// leagues and the Champions League). With FOOTBALL_DATA_TOKEN set, the server lists
// upcoming matches automatically and resolves them from official full-time scores —
// no admin work needed. Without a token this module is a no-op.

const db = require('./db');
const { createMatchEvent, resolveMatch, voidEvent } = require('./events');

const API = 'https://api.football-data.org/v4';
const COMPETITIONS = (process.env.FEED_COMPETITIONS || 'PL,PD,SA,BL1,FL1,CL').split(',').map(s => s.trim()).filter(Boolean);
const DAYS_AHEAD = Number(process.env.FEED_DAYS_AHEAD || 10);

// Home advantage + league scoring baselines. Without bookmaker odds we open every
// market at a neutral-ish prior and let the order book discover the price.
const PRIOR = { xgHome: 1.5, xgAway: 1.2 };

const ymd = d => d.toISOString().slice(0, 10);

async function fetchMatches(token, fetchImpl = fetch) {
  const from = new Date(Date.now() - 3 * 864e5), to = new Date(Date.now() + DAYS_AHEAD * 864e5);
  const url = `${API}/matches?competitions=${COMPETITIONS.join(',')}&dateFrom=${ymd(from)}&dateTo=${ymd(to)}`;
  const res = await fetchImpl(url, { headers: { 'X-Auth-Token': token } });
  if (!res.ok) throw new Error(`football-data.org responded ${res.status}`);
  return (await res.json()).matches || [];
}

// Pure function over the feed's match objects so it can be tested offline.
function applyMatches(matches) {
  const stats = { created: 0, resolved: 0, voided: 0, updated: 0 };
  for (const m of matches) {
    const externalId = `fd:${m.id}`;
    const ev = db.prepare('SELECT * FROM events WHERE external_id = ?').get(externalId);
    const home = m.homeTeam?.shortName || m.homeTeam?.name;
    const away = m.awayTeam?.shortName || m.awayTeam?.name;
    if (!home || !away) continue;

    if (!ev) {
      if (['SCHEDULED', 'TIMED'].includes(m.status) && new Date(m.utcDate) > new Date()) {
        createMatchEvent({ competition: m.competition?.name || 'Football', home, away, kickoff: m.utcDate, ...PRIOR, externalId });
        stats.created++;
      }
      continue;
    }
    if (ev.status !== 'open') continue;

    // Kick-off moved
    if (['SCHEDULED', 'TIMED'].includes(m.status) && m.utcDate && new Date(m.utcDate).toISOString() !== ev.starts_at) {
      db.prepare('UPDATE events SET starts_at = ?, closes_at = ? WHERE id = ?').run(new Date(m.utcDate).toISOString(), new Date(m.utcDate).toISOString(), ev.id);
      stats.updated++;
    }
    if (m.status === 'FINISHED') {
      // Markets settle on the 90-minute score; regularTime is present when a tie went to extra time
      const s = m.score?.regularTime || m.score?.fullTime;
      if (Number.isInteger(s?.home) && Number.isInteger(s?.away)) {
        resolveMatch(ev.id, s.home, s.away);
        stats.resolved++;
      }
    } else if (['CANCELLED', 'ABANDONED'].includes(m.status)
      || (m.status === 'POSTPONED' && Date.now() - new Date(ev.starts_at) > 48 * 3600e3)) {
      voidEvent(ev.id);
      stats.voided++;
    }
  }
  return stats;
}

async function sync(fetchImpl) {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return null;
  const stats = applyMatches(await fetchMatches(token, fetchImpl));
  if (stats.created || stats.resolved || stats.voided) console.log('feed sync', stats);
  return stats;
}

function start() {
  if (!process.env.FOOTBALL_DATA_TOKEN) return false;
  const run = () => sync().catch(e => console.error('feed sync failed:', e.message));
  run();
  setInterval(run, Number(process.env.FEED_INTERVAL_MIN || 10) * 60e3).unref();
  return true;
}

module.exports = { start, sync, applyMatches };
