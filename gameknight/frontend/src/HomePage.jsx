import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, display, useIsMobile, useLive } from './theme.js'
import { Crest, Empty, ErrorBox, Icon, InsightsBar, Pill, SearchBar, Sheet } from './ui.jsx'
import { FollowChips, InsightsSheet, tagName, useFollows } from './opinion.jsx'
import { FeaturedCard, MarketCard } from './cards.jsx'
import { Skeleton } from './fx.jsx'

const FEEDS = [['trending', 'Trending'], ['foryou', 'For you'], ['live', 'In play'], ['ending', 'Ending soon'], ['futures', 'Season']]
const SORTS = [['trending', 'Trending'], ['volume', 'Most traded'], ['liquidity', 'Deepest'], ['ending', 'Ending soon'], ['new', 'Newest']]

export default function HomePage({ user }) {
  const mobile = useIsMobile()
  const [feed, setFeed] = useState('trending')
  const [league, setLeague] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState(null)
  const [filters, setFilters] = useState({ sort: 'trending', status: 'open' })
  const [showFilters, setShowFilters] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [categories, setCategories] = useState([])
  const [evs, setEvs] = useState(null)
  const [error, setError] = useState('')
  const [follows] = useFollows()

  useEffect(() => { const t = setTimeout(() => setSearch(q.trim().replace(/^#/, '')), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { api.categories().then(setCategories).catch(() => {}) }, [])

  const params = () => {
    const p = { status: filters.status, category: league, sort: filters.sort, q: search || (tag ? tagName(tag) : '') }
    if (feed === 'foryou' && follows.length && !tag && !search) p.following = 1
    if (feed === 'trending') p.sort = 'trending'
    if (feed === 'ending') p.sort = 'ending'
    if (feed === 'live') p.status = 'closed'
    if (feed === 'futures') p.kind = 'outright'
    return p
  }
  const load = () => api.events(params()).then(setEvs).catch(e => setError(e.message))
  useEffect(() => { setEvs(null); setError(''); load() }, [feed, league, search, tag, filters, follows.length]) // eslint-disable-line react-hooks/exhaustive-deps
  useLive(m => m.type === 'trade' || m.type === 'event', load, [feed, league, search, tag, filters, follows.length])

  const plain = feed === 'trending' && !league && !search && !tag && filters.status === 'open'
  const featured = plain ? (evs || []).find(e => e.kind === 'match' && e.state === 'open') : null
  const cards = []
  ;(evs || []).forEach((ev, i) => {
    if (ev === featured) return
    cards.push({ ev, grp: ev.kind === 'match' ? 'result' : 'winner', key: `${ev.id}` })
    if (ev.kind === 'match' && ev.state === 'open' && i % 2 === 0) cards.push({ ev, grp: i % 4 === 0 ? 'btts' : 'goals', key: `${ev.id}b` })
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
      {mobile && <FollowChips active={tag} onPick={setTag} />}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <SearchBar value={q} onChange={setQ} placeholder="Search by #team(s), #player(s) or #league(s)" onFilter={() => setShowFilters(true)} />
        <InsightsBar onClick={() => setShowInsights(true)} />
      </div>

      {/* Topic bar: feeds, then leagues with their crests */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2 }}>
        {FEEDS.map(([k, t]) => <Pill key={k} active={feed === k && !league} onClick={() => { setFeed(k); setLeague('') }}>{k === 'live' && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 99, background: C.noText, marginRight: 6, verticalAlign: 1 }} />}{t}</Pill>)}
        <span style={{ width: 1, background: C.line, flexShrink: 0 }} />
        {categories.map(c => (
          <Pill key={c.name} active={league === c.name} onClick={() => setLeague(league === c.name ? '' : c.name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Crest name={c.name} size={18} />{c.name}
          </Pill>
        ))}
      </div>
      {!mobile && <FollowChips active={tag} onPick={setTag} />}

      {feed === 'foryou' && !follows.length && !search && !tag && (
        <div style={{ fontSize: 13, color: C.muted }}>Follow a few teams with <strong style={{ color: C.accent }}>+</strong> and this feed becomes yours. Showing everything for now.</div>
      )}
      {(tag || search) && <div style={{ fontSize: 13, color: C.muted }}>Showing opinions for <strong style={{ color: C.text }}>#{search || tagName(tag)}</strong></div>}

      <ErrorBox>{error}</ErrorBox>
      {featured && <FeaturedCard ev={featured} mobile={mobile} />}

      {!evs && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {Array.from({ length: 6 }, (_, i) => <div key={i} style={{ border: `1px solid ${C.line}`, padding: 12, display: 'grid', gap: 10 }}><Skeleton h={14} w="60%" /><Skeleton h={18} /><Skeleton h={18} /><Skeleton h={18} /></div>)}
        </div>
      )}
      {evs && !evs.length && <Empty>{feed === 'live' ? 'Nothing in play right now. Check the calendar for kick-off times.' : 'No opinions here yet. Try another filter.'}</Empty>}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, alignItems: 'stretch' }}>
        {cards.map(c => <MarketCard key={c.key} ev={c.ev} grp={c.grp} />)}
      </div>

      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title="Filters">
        <div style={{ display: 'grid', gap: 14 }}>
          <FilterRow title="Sort" options={SORTS} value={filters.sort} onChange={v => setFilters({ ...filters, sort: v })} />
          <FilterRow title="Status" options={[['open', 'Live'], ['closed', 'In play'], ['resolved', 'Settled']]} value={filters.status} onChange={v => setFilters({ ...filters, status: v })} />
        </div>
      </Sheet>
      <InsightsSheet open={showInsights} onClose={() => setShowInsights(false)} />
    </div>
  )
}

function FilterRow({ title, options, value, onChange }) {
  return (
    <div>
      <div style={{ ...display, fontSize: 14, color: C.muted, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(([k, t]) => <Pill key={k} active={value === k} onClick={() => onChange(k)}>{t}</Pill>)}
      </div>
    </div>
  )
}

