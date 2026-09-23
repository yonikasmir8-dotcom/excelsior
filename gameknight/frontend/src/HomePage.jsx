import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, num, useIsMobile, useLive } from './theme.js'
import { Card, Crest, Empty, ErrorBox, Pill, StateBadge } from './ui.jsx'

const SORTS = [['trending', 'Trending'], ['volume', 'Volume'], ['liquidity', 'Liquidity'], ['ending', 'Ending soon'], ['new', 'Newest']]

export default function HomePage() {
  const [category, setCategory] = useState('')
  const [futures, setFutures] = useState(false)
  const [sort, setSort] = useState('trending')
  const [status, setStatus] = useState('open')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [categories, setCategories] = useState([])
  const [evs, setEvs] = useState(null)
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')
  const mobile = useIsMobile()

  useEffect(() => { const t = setTimeout(() => setSearch(q.trim()), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { api.categories().then(setCategories).catch(() => {}); api.stats().then(setStats).catch(() => {}) }, [])

  const load = () => api.events({ category, sort, status, q: search, kind: futures ? 'outright' : '' }).then(setEvs).catch(e => setError(e.message))
  useEffect(() => { setEvs(null); setError(''); load() }, [category, sort, status, search, futures]) // eslint-disable-line react-hooks/exhaustive-deps
  useLive(m => m.type === 'trade' || m.type === 'event', () => { load(); api.stats().then(setStats).catch(() => {}) })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: mobile ? 'stretch' : 'flex-end', justifyContent: 'space-between', gap: 16, flexDirection: mobile ? 'column' : 'row', marginBottom: 18 }}>
        <div>
          <h1 style={{ ...display, fontSize: mobile ? 34 : 44, fontWeight: 800, margin: 0, textTransform: 'uppercase', lineHeight: 1 }}>
            Trade the <span style={{ color: C.accent }}>beautiful game</span>
          </h1>
          <p style={{ color: C.text2, margin: '8px 0 0', fontSize: 15 }}>
            Buy YES or NO on every result, scoreline and title race. Prices are probabilities — set by fans, not bookies.
          </p>
        </div>
        {stats && !mobile && (
          <div style={{ display: 'flex', gap: mobile ? 16 : 20, flexShrink: 0 }}>
            <Kpi label="24h volume" value={`${fmt.kcShort(stats.volume_24h)} KC`} />
            <Kpi label="Open markets" value={stats.open_markets} />
            <Kpi label="All-time volume" value={`${fmt.kcShort(stats.volume)} KC`} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search teams, players, competitions…" aria-label="Search markets"
          style={{ flex: '1 1 260px', minWidth: 0, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 14px', fontSize: 15 }} />
        <select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"
          style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 600 }}>
          {SORTS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status"
          style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 600 }}>
          <option value="open">Live</option><option value="closed">Awaiting result</option><option value="resolved">Resolved</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        <Pill active={!category && !futures} onClick={() => { setCategory(''); setFutures(false) }}>All</Pill>
        <Pill active={futures} onClick={() => { setFutures(!futures); setCategory('') }}>🏆 Futures</Pill>
        {categories.map(c => (
          <Pill key={c.name} active={category === c.name} onClick={() => { setCategory(category === c.name ? '' : c.name); setFutures(false) }}>{c.name}</Pill>
        ))}
      </div>

      <ErrorBox>{error}</ErrorBox>
      {!evs && !error && <Card><Empty>Loading markets…</Empty></Card>}
      {evs && !evs.length && <Card><Empty>No markets match. Try another filter.</Empty></Card>}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${mobile ? 260 : 330}px, 1fr))`, gap: 14 }}>
        {evs?.map(ev => ev.kind === 'match' ? <MatchCard key={ev.id} ev={ev} /> : <OutrightCard key={ev.id} ev={ev} />)}
      </div>
    </div>
  )
}

function Kpi({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ ...display, ...num, fontSize: 24, fontWeight: 700, whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  )
}

function CardShell({ ev, children, title }) {
  return (
    <Card style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', transition: 'border-color .15s, transform .15s' }}
      onClick={() => { window.location.hash = `/event/${ev.slug}` }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a4a40' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.line }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: C.muted, fontWeight: 600 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.competition}</span>
        {ev.state === 'open' ? <span style={{ whiteSpace: 'nowrap' }}>{ev.kind === 'match' ? fmt.kickoff(ev.starts_at) : `Closes ${fmt.date(ev.closes_at)}`}</span> : <StateBadge state={ev.state} />}
      </div>
      {title}
      <div style={{ display: 'grid', gap: 6 }}>{children}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginTop: 'auto' }}>
        <span style={num}>{fmt.kcShort(ev.volume)} KC vol</span>
        <span style={{ display: 'flex', gap: 12 }}>
          {ev.volume_24h > 0 && <span style={num}>↑ {fmt.kcShort(ev.volume_24h)} 24h</span>}
          {ev.comments > 0 && <span>💬 {ev.comments}</span>}
        </span>
      </div>
    </Card>
  )
}

function OutcomeLine({ ev, m, label, crest }) {
  const resolved = m.status !== 'open'
  const go = outcome => e => { e.stopPropagation(); window.location.hash = `/event/${ev.slug}?m=${m.id}&o=${outcome}` }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 32 }}>
      {crest}
      <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {resolved ? (
        <span style={{ fontSize: 12, fontWeight: 800, color: m.outcome === 'YES' ? C.yes : C.muted }}>{m.outcome === 'YES' ? '✓ WON' : m.outcome === 'VOID' ? 'VOID' : '—'}</span>
      ) : (
        <>
          <span style={{ ...display, ...num, fontSize: 20, fontWeight: 700, minWidth: 44, textAlign: 'right' }}>{fmt.pct(m.price)}</span>
          {ev.state === 'open' && (
            <span style={{ display: 'flex', gap: 4 }}>
              <MiniBtn yes onClick={go('YES')}>Yes</MiniBtn>
              <MiniBtn onClick={go('NO')}>No</MiniBtn>
            </span>
          )}
        </>
      )}
    </div>
  )
}

function MiniBtn({ yes, children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: yes ? C.yesBg : C.noBg, color: yes ? C.yes : C.no, border: 'none', borderRadius: 6, padding: '5px 9px',
      fontSize: 12, fontWeight: 700, cursor: 'pointer',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = yes ? C.yes : C.no; e.currentTarget.style.color = C.bg }}
      onMouseLeave={e => { e.currentTarget.style.background = yes ? C.yesBg : C.noBg; e.currentTarget.style.color = yes ? C.yes : C.no }}>{children}</button>
  )
}

function MatchCard({ ev }) {
  const result = ev.markets.filter(m => m.grp === 'result')
  const settled = ev.state === 'resolved'
  return (
    <CardShell ev={ev} title={
      <div style={{ ...display, fontSize: 21, fontWeight: 700, lineHeight: 1.1, textTransform: 'uppercase' }}>
        {ev.home} <span style={{ color: C.muted }}>{settled ? `${ev.home_score}–${ev.away_score}` : 'v'}</span> {ev.away}
      </div>
    }>
      {result.map(m => (
        <OutcomeLine key={m.id} ev={ev} m={m} label={m.code === 'DRAW' ? 'Draw' : m.label}
          crest={m.code === 'DRAW' ? <span style={{ width: 22, textAlign: 'center', color: C.muted, fontWeight: 800 }}>=</span> : <Crest name={m.label} size={22} />} />
      ))}
    </CardShell>
  )
}

function OutrightCard({ ev }) {
  const top = [...ev.markets].sort((a, b) => (b.outcome === 'YES') - (a.outcome === 'YES') || b.price - a.price).slice(0, 4)
  return (
    <CardShell ev={ev} title={<div style={{ ...display, fontSize: 21, fontWeight: 700, lineHeight: 1.1, textTransform: 'uppercase' }}>🏆 {ev.title}</div>}>
      {top.map(m => <OutcomeLine key={m.id} ev={ev} m={m} label={m.label} crest={<Crest name={m.label} size={22} />} />)}
      {ev.markets.length > 4 && <div style={{ fontSize: 12, color: C.muted }}>+ {ev.markets.length - 4} more</div>}
    </CardShell>
  )
}
