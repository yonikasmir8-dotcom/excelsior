import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt } from './theme.js'
import { Empty, ErrorBox, InsightsBar, Pill, SearchBar, Sheet } from './ui.jsx'
import { FollowChips, InsightsSheet, OpinionCard, tagName, useFollows } from './opinion.jsx'

const FEEDS = [['foryou', 'For you'], ['trending', 'Trending'], ['ending', 'Ending soon'], ['futures', 'Season']]
const SORTS = [['trending', 'Trending'], ['volume', 'Most traded'], ['liquidity', 'Deepest'], ['ending', 'Ending soon'], ['new', 'Newest']]

export default function HomePage({ user }) {
  const [feed, setFeed] = useState(user ? 'foryou' : 'trending')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState(null)
  const [filters, setFilters] = useState({ sort: 'trending', status: 'open', category: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const [categories, setCategories] = useState([])
  const [evs, setEvs] = useState(null)
  const [error, setError] = useState('')
  const [follows] = useFollows()

  useEffect(() => { const t = setTimeout(() => setSearch(q.trim().replace(/^#/, '')), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { api.categories().then(setCategories).catch(() => {}) }, [])

  const params = () => {
    const p = { status: filters.status, category: filters.category, sort: filters.sort, q: search || (tag ? tagName(tag) : '') }
    if (feed === 'foryou' && follows.length && !tag && !search) p.following = 1
    if (feed === 'trending') p.sort = 'trending'
    if (feed === 'ending') p.sort = 'ending'
    if (feed === 'futures') p.kind = 'outright'
    return p
  }
  const load = () => api.events(params()).then(setEvs).catch(e => setError(e.message))
  useEffect(() => { setEvs(null); setError(''); load() }, [feed, search, tag, filters, follows.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mix in Yes/No questions (goals, both-to-score) between the headline cards, like the deck's feed
  const cards = []
  ;(evs || []).forEach((ev, i) => {
    cards.push({ ev, grp: ev.kind === 'match' ? 'result' : 'winner', key: `${ev.id}` })
    if (ev.kind === 'match' && ev.state === 'open' && i % 2 === 1) cards.push({ ev, grp: i % 4 === 1 ? 'btts' : 'goals', key: `${ev.id}b` })
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
      <FollowChips active={tag} onPick={setTag} />
      <SearchBar value={q} onChange={setQ} placeholder="Search by #team(s), #player(s) or #league(s)" onFilter={() => setShowFilters(true)} />
      <InsightsBar onClick={() => setShowInsights(true)} />
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {FEEDS.map(([k, t]) => <Pill key={k} active={feed === k} onClick={() => setFeed(k)}>{t}</Pill>)}
      </div>
      {feed === 'foryou' && !follows.length && !search && !tag && (
        <div style={{ fontSize: 13, color: C.muted }}>Follow a few teams with <strong style={{ color: C.accent }}>+</strong> above and this feed becomes yours. Showing everything for now.</div>
      )}
      {(tag || search) && <div style={{ fontSize: 13, color: C.muted }}>Showing opinions for <strong style={{ color: C.text }}>#{search || tagName(tag)}</strong></div>}

      <ErrorBox>{error}</ErrorBox>
      {!evs && !error && <Empty>Loading opinions…</Empty>}
      {evs && !evs.length && <Empty>No opinions here yet. Try another filter.</Empty>}
      <div style={{ display: 'grid', gap: 14 }}>
        {cards.map(c => <OpinionCard key={c.key} ev={c.ev} grp={c.grp} />)}
      </div>

      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title="Filters">
        <div style={{ display: 'grid', gap: 14 }}>
          <FilterRow title="Sort" options={SORTS} value={filters.sort} onChange={v => setFilters({ ...filters, sort: v })} />
          <FilterRow title="Status" options={[['open', 'Live'], ['closed', 'In play'], ['resolved', 'Settled']]} value={filters.status} onChange={v => setFilters({ ...filters, status: v })} />
          <FilterRow title="League" options={[['', 'All'], ...categories.map(c => [c.name, c.name])]} value={filters.category} onChange={v => setFilters({ ...filters, category: v })} />
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

export { fmt }
