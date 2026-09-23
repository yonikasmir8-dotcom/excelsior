import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, useIsMobile } from './theme.js'
import { Card, Crest, Empty, ErrorBox, Heading, Pill, StateBadge } from './ui.jsx'

const TABS = [['open', 'Upcoming'], ['awaiting', 'Awaiting result'], ['settled', 'Results']]

export default function MarketsPage() {
  const [state, setState] = useState('open')
  const [competition, setCompetition] = useState('')
  const [competitions, setCompetitions] = useState([])
  const [fixtures, setFixtures] = useState(null)
  const [activity, setActivity] = useState([])
  const [error, setError] = useState('')
  const mobile = useIsMobile()

  useEffect(() => { api.competitions().then(setCompetitions).catch(() => {}) }, [])
  useEffect(() => {
    setFixtures(null); setError('')
    api.fixtures(state, competition).then(setFixtures).catch(e => setError(e.message))
  }, [state, competition])
  useEffect(() => {
    const load = () => api.activity().then(setActivity).catch(() => {})
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  // Group by day
  const groups = []
  for (const f of fixtures || []) {
    const day = new Date(f.kickoff).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    if (!groups.length || groups[groups.length - 1].day !== day) groups.push({ day, items: [] })
    groups[groups.length - 1].items.push(f)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'minmax(0, 1fr) 300px', gap: 24 }}>
      <div>
        <Heading>Football markets</Heading>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
          {TABS.map(([k, t]) => <Pill key={k} active={state === k} onClick={() => setState(k)}>{t}</Pill>)}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 2 }}>
          <Pill active={!competition} onClick={() => setCompetition('')}>All competitions</Pill>
          {competitions.map(c => (
            <Pill key={c.competition} active={competition === c.competition} onClick={() => setCompetition(c.competition)}>{c.competition}</Pill>
          ))}
        </div>

        <ErrorBox>{error}</ErrorBox>
        {fixtures && !fixtures.length && <Card><Empty>No {TABS.find(t => t[0] === state)[1].toLowerCase()} fixtures{competition && ` in ${competition}`}.</Empty></Card>}
        {!fixtures && !error && <Card><Empty>Loading fixtures…</Empty></Card>}

        {groups.map(g => (
          <section key={g.day} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px 2px' }}>{g.day}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {g.items.map(f => <FixtureCard key={f.id} f={f} mobile={mobile} />)}
            </div>
          </section>
        ))}
      </div>

      <aside>
        <Card style={{ padding: 16, position: mobile ? 'static' : 'sticky', top: 84 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 99, background: C.good, boxShadow: `0 0 0 4px ${C.good}22` }} />
            <span style={{ ...display, fontSize: 20, fontWeight: 700, textTransform: 'uppercase' }}>Live trades</span>
          </div>
          {!activity.length && <Empty>No trades yet — be the first.</Empty>}
          <div style={{ display: 'grid', gap: 10, maxHeight: mobile ? 320 : 'calc(100vh - 180px)', overflowY: 'auto' }}>
            {activity.slice(0, mobile ? 8 : 30).map((t, i) => (
              <a key={i} href={`#/match/${t.fixture_id}`} style={{ fontSize: 13, lineHeight: 1.45, borderBottom: `1px solid ${C.line}`, paddingBottom: 10 }}>
                <strong>{t.username}</strong>{' '}
                <span style={{ color: t.side === 'buy' ? C.good : C.sell, fontWeight: 600 }}>{t.side === 'buy' ? 'bought' : 'sold'}</span>{' '}
                {fmt.shares(t.shares)} <strong>{t.outcome}</strong>
                <div style={{ color: C.muted, fontSize: 12 }}>{t.home} v {t.away} · {fmt.coinsShort(t.amount)} KC · {fmt.ago(t.created_at)}</div>
              </a>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  )
}

function FixtureCard({ f, mobile }) {
  const result = f.markets.find(m => m.type === '1X2')
  const settled = f.state === 'settled'
  return (
    <Card style={{ padding: mobile ? 14 : 16, transition: 'border-color .15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#3a4a40')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = C.line)}>
      <a href={`#/match/${f.id}`} style={{ display: 'block' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.muted, marginBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>{f.competition} · {fmt.time(f.kickoff)}</span>
          <span style={{ display: 'flex', gap: 12 }}>
            {f.state === 'open' && <span>⏱ {fmt.countdown(f.kickoff)}</span>}
            <span>{fmt.coinsShort(f.volume)} KC vol</span>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) 330px', gap: 14, alignItems: 'center' }}>
          <div style={{ display: 'grid', gap: 8 }}>
            {[[f.home, f.home_score], [f.away, f.away_score]].map(([team, score]) => (
              <div key={team} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Crest name={team} size={24} />
                <span style={{ fontWeight: 600, fontSize: 16, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team}</span>
                {settled && <span style={{ ...display, fontSize: 22, fontWeight: 800 }}>{score}</span>}
              </div>
            ))}
            {!settled && f.state !== 'open' && <StateBadge state={f.state} />}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {result.outcomes.map((o, i) => {
              const won = settled && result.winning_outcome === o.code
              return (
                <div key={o.id} style={{
                  background: won ? `${C.accent}1f` : C.surface2, border: `1px solid ${won ? C.accent : C.line}`, borderRadius: 8,
                  padding: '8px 6px', textAlign: 'center', position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {o.code === 'HOME' ? '1 · Home' : o.code === 'DRAW' ? 'X · Draw' : '2 · Away'}
                  </div>
                  <div style={{ ...display, fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {settled ? (won ? '✓ Won' : '—') : fmt.pct(o.price)}
                  </div>
                  {!settled && <div style={{ fontSize: 11, color: C.muted }}>odds {fmt.odds(o.price)}</div>}
                  <div style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${o.price * 100}%`, background: C.series[i], borderRadius: '0 2px 0 0' }} />
                </div>
              )
            })}
          </div>
        </div>
      </a>
    </Card>
  )
}
