import React, { useEffect, useMemo, useState } from 'react'
import { api, getToken } from './api.js'
import { C, display, fmt, num, share, useIsMobile } from './theme.js'
import { Crest, Icon, Input, PriceBox, Sheet, Strip, Tile, notify } from './ui.jsx'

// ── Follows store ("Tailored Experience") ────────────────────────────────────
let follows = []
let loaded = false
const subs = new Set()
const emit = () => subs.forEach(f => f(follows))
export async function loadFollows() {
  if (!getToken()) { follows = []; loaded = true; emit(); return }
  try { follows = await api.follows() } catch { follows = [] }
  loaded = true
  emit()
}
export function useFollows() {
  const [list, setList] = useState(follows)
  useEffect(() => {
    subs.add(setList)
    if (!loaded) loadFollows()
    return () => subs.delete(setList)
  }, [])
  const toggle = async tag => {
    if (!getToken()) { window.location.hash = '/login'; return }
    const on = follows.includes(tag)
    follows = on ? follows.filter(t => t !== tag) : [...follows, tag]
    emit()
    try { on ? await api.unfollow(tag) : await api.follow(tag) } catch (e) { notify(e.message); loadFollows() }
  }
  return [list, toggle]
}
export const tagName = t => t.slice(t.indexOf(':') + 1)

// Horizontal chips under the greeting: your follows (magenta) + trending suggestions
export function FollowChips({ active, onPick }) {
  const [list, toggle] = useFollows()
  const [tags, setTags] = useState([])
  const [manage, setManage] = useState(false)
  useEffect(() => { api.tags().then(setTags).catch(() => {}) }, [])
  const suggestions = tags.filter(t => !list.includes(t.tag)).slice(0, 6)
  const chip = (tag, followed) => (
    <div key={tag} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', whiteSpace: 'nowrap', fontSize: 14, fontWeight: 700,
      background: active === tag ? C.accent : C.surface, border: `1px solid ${active === tag ? C.accent : C.line}`,
    }}>
      <button onClick={() => onPick?.(active === tag ? null : tag)} style={{ background: 'none', border: 'none', color: C.text, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0, fontWeight: 700, fontSize: 14 }}>
        {followed && <Icon name="star" size={13} color={active === tag ? '#fff' : C.muted} />}{tagName(tag)}
      </button>
      {!followed && <button onClick={() => toggle(tag)} aria-label={`Follow ${tagName(tag)}`} style={{ background: 'none', border: 'none', color: C.accent, cursor: 'pointer', padding: 0, display: 'grid' }}><Icon name="plus" size={16} /></button>}
    </div>
  )
  return (
    <>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, margin: '0 -16px', padding: '0 16px 6px', scrollbarWidth: 'none' }}>
        {list.map(t => chip(t, true))}
        {suggestions.map(t => chip(t.tag, false))}
        <button onClick={() => setManage(true)} style={{ padding: '7px 12px', whiteSpace: 'nowrap', background: 'transparent', border: `1px dashed ${C.accent}`, color: C.accent, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          + Your #teams
        </button>
      </div>
      <TailoredSheet open={manage} onClose={() => setManage(false)} tags={tags} list={list} toggle={toggle} />
    </>
  )
}

function TailoredSheet({ open, onClose, tags, list, toggle }) {
  const [q, setQ] = useState('')
  const shown = tags.filter(t => !list.includes(t.tag) && t.name.toLowerCase().includes(q.toLowerCase())).slice(0, 18)
  const Group = ({ title, icon, items, followed }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.line}`, padding: 12, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: followed ? C.accent : C.text2, fontSize: 14, marginBottom: 10 }}>
        <Icon name={icon} size={16} color={followed ? C.accent : C.text2} />{title}
      </div>
      {!items.length && <div style={{ color: C.muted, fontSize: 13 }}>{followed ? 'Follow teams, players and leagues to tailor your feed.' : 'No matches.'}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
        {items.map(t => (
          <button key={t} onClick={() => toggle(t)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, background: C.surface2, border: `1px solid ${C.line}`,
            color: C.text, padding: '8px 10px', fontWeight: 600, fontSize: 13, cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tagName(t)}</span>
            <Icon name={followed ? 'x' : 'plus'} size={15} color={followed ? C.text2 : C.accent} />
          </button>
        ))}
      </div>
    </div>
  )
  return (
    <Sheet open={open} onClose={onClose} title="Tailor your feed">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, border: `1px solid ${C.lineLight}`, padding: '0 10px' }}>
        <Icon name="search" size={18} color={C.muted} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by #team, #player or #league" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: C.text, padding: '10px 0', fontSize: 15 }} />
      </label>
      <Group title="Trending" icon="trend" items={shown.map(t => t.tag)} />
      <Group title="Your #follows" icon="star" items={list} followed />
    </Sheet>
  )
}

// ── Opinion card ─────────────────────────────────────────────────────────────
export function questionFor(ev, grp) {
  if (ev.kind === 'match') {
    if (grp === 'goals') return `How many goals in ${ev.home} v ${ev.away}?`
    if (grp === 'btts') return `Will both ${ev.home} and ${ev.away} score?`
    return `Who wins ${ev.home} v ${ev.away}?`
  }
  const t = ev.title.replace(/\s+winner$/i, '')
  return /boot|scorer/i.test(ev.title) ? `Who finishes as ${t} top scorer?`.replace(' Golden Boot top scorer', ' top scorer') : `Who will win the ${t}?`
}

// Rows to show for a card: [{ market, outcome, label, price }]
export function rowsFor(ev, grp) {
  const ms = ev.markets.filter(m => m.grp === grp)
  if (ms.length === 1) {
    const m = ms[0]
    return [
      { market: m, outcome: 'YES', label: 'Yes', price: m.buy_yes ?? m.price, prob: m.price },
      { market: m, outcome: 'NO', label: 'No', price: m.buy_no ?? 100 - m.price, prob: 100 - m.price },
    ]
  }
  const rows = ms.map(m => ({ market: m, outcome: 'YES', label: m.code === 'DRAW' ? 'Draw' : m.label, price: m.buy_yes ?? m.price, prob: m.price }))
  return grp === 'winner' ? rows.sort((a, b) => b.prob - a.prob) : rows
}

export function OpinionCard({ ev, grp, maxRows = 3, strip, rowTone, selected, onRow, compact }) {
  const mobile = useIsMobile()
  const g = grp || (ev.kind === 'match' ? 'result' : 'winner')
  const rows = rowsFor(ev, g)
  const lead = rows.reduce((a, r) => (r.prob > (a?.prob ?? -1) ? r : a), null)
  const open = e => {
    if (e.defaultPrevented) return
    window.location.hash = `/event/${ev.slug}?g=${g}`
  }
  const shareIt = async () => {
    const r = await share({ title: questionFor(ev, g), path: `/event/${ev.slug}` })
    if (r === 'copied') notify('Link copied — send it to your group chat.')
    else if (r !== 'shared' && r !== 'cancelled') notify(`Share this link: ${r}`)
  }
  const tileW = mobile ? 76 : 92
  const shown = rows.slice(0, maxRows)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `minmax(0,1fr) ${tileW}px`, gap: 6, cursor: onRow ? 'default' : 'pointer' }} onClick={onRow ? undefined : open}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {strip || <Strip players={ev.players} endsAt={ev.closes_at} state={ev.state} onShare={shareIt} />}
        <div style={{ background: C.surface, flex: 1, padding: compact ? '10px 12px' : '12px 14px', borderLeft: `1px solid ${C.surface}`, borderRight: `1px solid ${C.surface}` }}>
          <div style={{ ...display, fontSize: mobile ? 16 : 17, lineHeight: 1.3, paddingBottom: 10, borderBottom: `1px solid ${C.line}`, textWrap: 'balance' }}>
            {ev.state === 'resolved' && ev.kind === 'match' ? `${ev.home} ${ev.home_score}–${ev.away_score} ${ev.away}` : questionFor(ev, g)}
          </div>
          <div style={{ display: 'grid', gap: 6, paddingTop: 10 }}>
            {shown.map(r => {
              const settled = r.market.status !== 'open'
              const won = settled && (r.market.outcome === r.outcome)
              const pair = rows.length === 2 && rows[0].market === rows[1].market
              const isSel = selected && selected.market.id === r.market.id && (pair ? selected.outcome === r.outcome : true)
              const tone = rowTone ? rowTone(r) : selected
                ? (isSel ? (!pair && selected.outcome === 'NO' ? 'lose' : 'lead') : null)
                : settled ? (won ? 'win' : null) : (r === lead ? 'lead' : null)
              return (
                <button key={`${r.market.id}${r.outcome}`} onClick={e => { if (onRow) { e.preventDefault(); e.stopPropagation(); onRow(r) } else { e.stopPropagation(); window.location.hash = `/event/${ev.slug}?g=${g}&m=${r.market.id}&o=${r.outcome}` } }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, color: C.text, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                  <PriceBox cents={settled ? (won ? 100 : 0) : r.price} tone={tone} />
                  <span style={{ fontSize: 14, fontWeight: tone ? 700 : 500, color: tone === 'lead' && !selected ? C.text : tone === 'win' ? C.yesText : tone === 'lose' ? C.noText : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {!pair && isSel && selected.outcome === 'NO' ? `Not ${r.label}` : r.label}{r.suffix}
                  </span>
                  {!compact && <span style={{ fontSize: 12, color: C.muted, ...num }}>{settled ? (won ? 'Won' : '') : fmt.pct(r.prob)}</span>}
                </button>
              )
            })}
            {rows.length > shown.length && <div style={{ fontSize: 12, color: C.muted, paddingLeft: 2 }}>+ {rows.length - shown.length} more</div>}
          </div>
        </div>
      </div>
      <CardArt ev={ev} w={tileW} />
    </div>
  )
}

// Right-hand art column: home tile · score/kick-off · away tile, or a tall competition tile
export function CardArt({ ev, w }) {
  const box = { background: '#101010', border: `1px solid ${C.line}`, display: 'grid', placeItems: 'center' }
  if (ev.kind !== 'match') {
    return <div style={{ ...box, width: w, minHeight: 120 }}><Crest name={ev.competition} size={Math.round(w * 0.7)} /></div>
  }
  const mid = ev.state === 'resolved' ? `${ev.home_score}–${ev.away_score}` : ev.state === 'closed' ? 'LIVE' : fmt.time(ev.starts_at)
  return (
    <div style={{ display: 'grid', gridTemplateRows: '1fr auto 1fr', gap: 6, minHeight: 150, width: w }}>
      <div style={box}><Crest name={ev.home} size={Math.round(w * 0.62)} /></div>
      <div style={{ border: `1px solid ${C.line}`, background: C.bgTop, textAlign: 'center', padding: '4px 0', ...num }}>
        {ev.state === 'open' && <div style={{ fontSize: 10, color: C.muted, lineHeight: 1 }}>GMT</div>}
        <div style={{ fontSize: 14, fontWeight: 800, color: ev.state === 'closed' ? C.noText : C.text }}>{mid}</div>
      </div>
      <div style={box}><Crest name={ev.away} size={Math.round(w * 0.62)} /></div>
    </div>
  )
}

// Insights sheet (the deck's "Ask AI" bar)
export function InsightsSheet({ open, onClose, event }) {
  const [q, setQ] = useState('')
  const [items, setItems] = useState(null)
  const [asked, setAsked] = useState('')
  useEffect(() => {
    if (!open) return
    setItems(null)
    api.insights(event ? { event } : { q: asked }).then(setItems).catch(e => setItems([{ title: 'Unavailable', body: e.message }]))
  }, [open, event, asked])
  return (
    <Sheet open={open} onClose={onClose} title="✦ Insights">
      {!event && (
        <form onSubmit={e => { e.preventDefault(); setAsked(q) }} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask about a team, player or match…" />
          <button type="submit" style={{ background: C.accent, border: 'none', color: '#fff', fontWeight: 700, padding: '0 16px', cursor: 'pointer' }}>Ask</button>
        </form>
      )}
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Data-backed reads from live prices, our goals model, order flow and depth. Not advice.</div>
      {!items && <div style={{ color: C.muted }}>Crunching the numbers…</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {items?.map((it, i) => (
          <a key={i} href={it.slug ? `#/event/${it.slug}${it.market_id ? `?m=${it.market_id}` : ''}` : undefined} onClick={() => it.slug && onClose()}
            style={{ display: 'block', background: C.surface, border: `1px solid ${C.line}`, padding: '10px 12px', cursor: it.slug ? 'pointer' : 'default' }}>
            <div style={{ fontWeight: 700, color: C.accent, fontSize: 13 }}>{it.title}</div>
            <div style={{ fontSize: 14, color: C.text2, marginTop: 2, lineHeight: 1.45 }}>{it.body}</div>
          </a>
        ))}
      </div>
    </Sheet>
  )
}

export function useTags() {
  const [tags, setTags] = useState([])
  useEffect(() => { api.tags().then(setTags).catch(() => {}) }, [])
  return useMemo(() => tags, [tags])
}
