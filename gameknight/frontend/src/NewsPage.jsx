import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, GRADIENT, clubStyle, compStyle, display, fmt, share, useLive } from './theme.js'
import { Empty, ErrorBox, Icon, SearchBar, notify } from './ui.jsx'
import { FollowChips, tagName } from './opinion.jsx'

const KIND_LABEL = { result: 'Full time', mover: 'Market move', 'big-call': 'Big call', listing: 'New opinions', article: 'Headlines' }

export default function NewsPage() {
  const [items, setItems] = useState(null)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState(null)
  const [error, setError] = useState('')
  const load = () => api.news().then(setItems).catch(e => setError(e.message))
  useEffect(() => { load() }, [])
  useLive(m => m.type === 'event' || m.type === 'trade', load)

  const needle = (q.replace(/#/g, '').trim() || (tag ? tagName(tag) : '')).toLowerCase()
  const shown = (items || []).filter(i => !needle || `${i.title} ${i.body || ''} ${i.home || ''} ${i.away || ''} ${i.competition || ''}`.toLowerCase().includes(needle))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
      <FollowChips active={tag} onPick={setTag} />
      <SearchBar value={q} onChange={setQ} placeholder="Search by #team, #player or #league" />
      <ErrorBox>{error}</ErrorBox>
      {!items && !error && <Empty>Loading the wire…</Empty>}
      {items && !shown.length && <Empty>No stories {needle ? `about #${needle}` : 'yet'}.</Empty>}
      <div style={{ display: 'grid', gap: 14 }}>
        {shown.map((n, i) => <Story key={i} n={n} />)}
      </div>
    </div>
  )
}

// Poster art in club colours for stories without a photo
function Poster({ n }) {
  const a = n.home ? clubStyle(n.home) : compStyle(n.competition || 'Game Knight')
  const b = n.away ? clubStyle(n.away) : null
  return (
    <div style={{
      position: 'relative', aspectRatio: '16 / 8', maxWidth: '100%', overflow: 'hidden',
      background: b ? `linear-gradient(115deg, ${a.bg} 0 50%, ${b.bg} 50% 100%)` : n.kind === 'mover' ? GRADIENT : a.bg,
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #0000 30%, #000c)' }} />
      {b && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-around', ...display, fontSize: 'clamp(34px, 11vw, 64px)' }}>
          <span style={{ color: a.ink, opacity: 0.9 }}>{a.code}</span>
          <span style={{ color: '#fff', fontSize: '0.5em', opacity: 0.8 }}>{n.kind === 'result' ? (n.title.match(/\d+–\d+/) || ['v'])[0] : 'v'}</span>
          <span style={{ color: b.ink, opacity: 0.9 }}>{b.code}</span>
        </div>
      )}
      {!b && <div style={{ position: 'absolute', left: 16, top: 12, ...display, fontSize: 'clamp(28px, 9vw, 52px)', color: '#fff', opacity: 0.9 }}>{n.label || a.code}</div>}
      <span style={{ position: 'absolute', left: 12, bottom: 10, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: '#000a', padding: '3px 7px' }}>
        {KIND_LABEL[n.kind] || 'News'}{n.competition ? ` · ${n.competition}` : ''}
      </span>
    </div>
  )
}

function Story({ n }) {
  const href = n.slug ? `#/event/${n.slug}` : n.link
  const shareIt = async e => {
    e.preventDefault(); e.stopPropagation()
    const r = n.slug ? await share({ title: n.title, path: `/event/${n.slug}` }) : await navigator.clipboard?.writeText(n.link).then(() => 'copied', () => n.link)
    if (r === 'copied') notify('Link copied.')
    else if (r && r !== 'shared' && r !== 'cancelled') notify(`Share this link: ${r}`)
  }
  return (
    <a href={href} target={n.slug ? undefined : '_blank'} rel="noreferrer" style={{ display: 'block', border: `1px solid ${C.line}` }}>
      {n.image ? <img src={n.image} alt="" style={{ width: '100%', aspectRatio: '16 / 8', objectFit: 'cover', display: 'block' }} /> : <Poster n={n} />}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, padding: '10px 12px', background: C.surface2, alignItems: 'start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.35 }}>{n.title}</div>
          {n.body && <div style={{ fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>{n.body}</div>}
          {n.source && <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{n.source}</div>}
        </div>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 2, color: C.text2 }}>
          <button onClick={shareIt} aria-label="Share story" style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', display: 'grid', padding: 2 }}><Icon name="share" size={18} /></button>
          <span style={{ fontSize: 11 }}>{fmt.ago(n.at)}</span>
        </div>
      </div>
    </a>
  )
}
