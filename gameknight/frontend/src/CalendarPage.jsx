import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, clubStyle, compStyle, display, fmt, num, share, useIsMobile, useLive } from './theme.js'
import { Empty, ErrorBox, Icon, SearchBar, Tile, notify } from './ui.jsx'
import { FollowChips, tagName, useFollows } from './opinion.jsx'

const DAY = 864e5
const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const dayLabel = (d, today) => {
  const diff = Math.round((d - today) / DAY)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Google Calendar "add event" link (plain https — works inside any viewer)
function calendarLink(ev) {
  const f = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const end = new Date(new Date(ev.starts_at).getTime() + 115 * 60e3)
  const u = new URL('https://calendar.google.com/calendar/render')
  u.searchParams.set('action', 'TEMPLATE')
  u.searchParams.set('text', `${ev.home} v ${ev.away} (${ev.competition})`)
  u.searchParams.set('dates', `${f(ev.starts_at)}/${f(end)}`)
  u.searchParams.set('details', `Back your opinions on Game Knight: ${location.origin}${location.pathname}#/event/${ev.slug}`)
  return u.toString()
}

export default function CalendarPage() {
  const today = startOfDay(Date.now())
  const [day, setDay] = useState(today)
  const stripRef = React.useRef(null)
  const [q, setQ] = useState('')
  const [tag, setTag] = useState(null)
  const [evs, setEvs] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [error, setError] = useState('')
  const [follows, toggle] = useFollows()
  const mobile = useIsMobile()

  const load = () => api.events({ status: 'all', kind: 'match', sort: 'ending', from: day.toISOString(), to: new Date(day.getTime() + DAY).toISOString() })
    .then(setEvs).catch(e => setError(e.message))
  useEffect(() => { setEvs(null); load() }, [day]) // eslint-disable-line react-hooks/exhaustive-deps
  useLive(m => m.type === 'event', load, [day])

  const needle = (q.replace(/#/g, '').trim() || (tag ? tagName(tag) : '')).toLowerCase()
  const shown = (evs || []).filter(e => !needle || `${e.home} ${e.away} ${e.competition}`.toLowerCase().includes(needle))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const groups = shown.reduce((g, e) => ({ ...g, [e.competition]: [...(g[e.competition] || []), e] }), {})
  const days = Array.from({ length: 17 }, (_, i) => new Date(today.getTime() + (i - 3) * DAY))
  // Centre the selected day in the strip (horizontal scroll only — never move the page)
  useEffect(() => {
    const strip = stripRef.current, btn = strip?.querySelector('[aria-pressed="true"]')
    if (btn) strip.scrollLeft = btn.offsetLeft - strip.clientWidth / 2 + btn.offsetWidth / 2
  }, [day])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
      <FollowChips active={tag} onPick={setTag} />
      <SearchBar value={q} onChange={setQ} placeholder="#Champions League  #Premier League" />

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        <div ref={stripRef} style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', background: C.surface3, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {days.map(d => (
            <button key={d.getTime()} aria-pressed={d.getTime() === day.getTime()} onClick={() => setDay(d)} style={{
              background: 'none', border: 'none', color: d.getTime() === day.getTime() ? C.accent : C.text, fontWeight: 700, fontSize: mobile ? 13 : 14,
              padding: '11px 10px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>{dayLabel(d, today)}</button>
          ))}
        </div>
        <button onClick={() => setDay(today)} aria-label="Back to today" title="Today" style={{ width: 44, background: 'transparent', border: `1px solid ${C.text}`, color: C.text, cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
          {today.getDate()}
        </button>
      </div>

      <ErrorBox>{error}</ErrorBox>
      {!evs && !error && <Empty>Loading fixtures…</Empty>}
      {evs && !shown.length && <Empty>No fixtures {needle ? `for #${needle}` : ''} on {dayLabel(day, today).toLowerCase()}. Try another day.</Empty>}

      {Object.entries(groups).map(([comp, list]) => (
        <section key={comp} style={{ display: 'grid', gap: 8, marginTop: 6 }}>
          <button onClick={() => setCollapsed({ ...collapsed, [comp]: !collapsed[comp] })} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', color: C.text, padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <div style={{ width: 44, height: 44, background: compStyle(comp).bg, color: compStyle(comp).ink, border: `1px solid ${C.text}`, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13 }}>{compStyle(comp).code}</div>
            <span style={{ ...display, fontSize: 17, flex: 1 }}>{comp}</span>
            <span style={{ transform: collapsed[comp] ? 'rotate(-90deg)' : 'none', display: 'inline-flex' }}><Icon name="down" size={18} /></span>
          </button>
          {!collapsed[comp] && list.map(ev => <Fixture key={ev.id} ev={ev} mobile={mobile} liked={follows.includes(`event:${ev.id}`)} onLike={() => toggle(`event:${ev.id}`)} />)}
        </section>
      ))}
    </div>
  )
}


function Fixture({ ev, mobile, liked, onLike }) {
  const tile = mobile ? 52 : 60
  const mid = ev.state === 'resolved'
    ? <><div style={{ fontSize: 11, color: C.muted }}>FT</div><div style={{ fontWeight: 800 }}>{ev.home_score}–{ev.away_score}</div></>
    : ev.state === 'closed' ? <><div style={{ fontSize: 11, color: C.noText, fontWeight: 700 }}>LIVE</div><div style={{ fontWeight: 800 }}>–</div></>
    : ev.state === 'void' ? <div style={{ fontSize: 12, color: C.muted }}>Void</div>
    : <><div style={{ fontSize: 11, color: C.muted }}>GMT</div><div style={{ fontWeight: 800 }}>{new Date(ev.starts_at).toISOString().slice(11, 16)}</div></>
  const shareIt = async () => {
    const r = await share({ title: `${ev.home} v ${ev.away}`, path: `/event/${ev.slug}` })
    if (r === 'copied') notify('Match link copied — invite your mates.')
    else if (r !== 'shared' && r !== 'cancelled') notify(`Share this link: ${r}`)
  }
  const code = name => {
    const s = clubStyle(name)
    return <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 13, padding: '3px 0', background: s.bg, color: s.ink, border: `1px solid ${C.lineLight}` }}>{s.code}</div>
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${tile}px minmax(0,1fr) ${tile}px`, gap: 4 }}>
      <div style={{ display: 'grid', gap: 4, alignContent: 'start' }}><Tile name={ev.home} w={tile} h={tile} crest />{code(ev.home)}</div>
      <div style={{ display: 'grid', gridTemplateRows: '1fr auto', gap: 4, minWidth: 0 }}>
        <a href={`#/event/${ev.slug}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', alignItems: 'center', gap: 6, background: C.surface2, padding: '0 10px', minHeight: tile, fontSize: mobile ? 13 : 15, fontWeight: 700 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.home}</span>
          <span style={{ textAlign: 'center', lineHeight: 1.1, ...num }}>{mid}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{ev.away}</span>
        </a>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', background: C.surface3, padding: '4px 8px', gap: 6, fontSize: 13, color: C.muted, fontWeight: 700 }}>
          <button onClick={onLike} aria-label={liked ? 'Unfollow match' : 'Follow match'} style={iconBtn}><Icon name={liked ? 'heartFill' : 'heart'} size={17} color={liked ? C.accent : C.text2} /></button>
          {ev.state === 'open' && Date.now() < new Date(ev.starts_at) - 0
            ? <a href={calendarLink(ev)} target="_blank" rel="noreferrer" style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Add to My Calendar</a>
            : <a href={`#/event/${ev.slug}`} style={{ textAlign: 'center' }}>View Opinions</a>}
          <button onClick={shareIt} aria-label="Share match" style={iconBtn}><Icon name="share" size={16} color={C.text2} /></button>
        </div>
        {ev.state === 'open' && <a href={`#/event/${ev.slug}`} style={{ fontSize: 12, color: C.accent, fontWeight: 700, textAlign: 'center' }}>View opinions · {fmt.shares(ev.players)} players</a>}
      </div>
      <div style={{ display: 'grid', gap: 4, alignContent: 'start' }}><Tile name={ev.away} w={tile} h={tile} crest />{code(ev.away)}</div>
    </div>
  )
}

const iconBtn = { background: 'none', border: 'none', padding: 2, cursor: 'pointer', display: 'grid' }
