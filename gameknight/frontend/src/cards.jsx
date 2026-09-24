import React from 'react'
import { C, clubStyle, display, fmt, num, share } from './theme.js'
import { Crest, Icon, notify } from './ui.jsx'
import { Countdown, Flash, LiveDot } from './fx.jsx'
import { questionFor, rowsFor } from './opinion.jsx'
import PriceChart from './PriceChart.jsx'

const go = hash => { window.location.hash = hash }

// ── Visual atoms ─────────────────────────────────────────────────────────────

// Win-probability bar in club colours (draw in neutral), 2px gaps between segments
export function ProbBar({ ev, height = 6, labels }) {
  const rows = rowsFor(ev, 'result')
  if (rows.length !== 3) return null
  const total = rows.reduce((s, r) => s + r.prob, 0) || 1
  const colour = r => (r.market.code === 'DRAW' ? '#5b5b5b' : clubStyle(r.label).bg)
  return (
    <div>
      <div role="img" aria-label={rows.map(r => `${r.label} ${fmt.pct(r.prob)}`).join(', ')} style={{ display: 'flex', gap: 2, height }}>
        {rows.map(r => (
          <div key={r.market.id} style={{
            width: `${(r.prob / total) * 100}%`, background: colour(r), transition: 'width .6s ease',
            boxShadow: ['#ffffff', '#000000'].includes(colour(r)) ? `inset 0 0 0 1px ${C.lineLight}` : 'none',
          }} />
        ))}
      </div>
      {labels && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: C.muted, fontWeight: 700, ...num }}>
          {rows.map(r => <span key={r.market.id}>{r.market.code === 'DRAW' ? 'Draw' : clubStyle(r.label).code} {fmt.pct(r.prob)}</span>)}
        </div>
      )}
    </div>
  )
}

export function Sparkline({ points, w = 90, h = 28, color }) {
  if (!points?.length) return null
  const lo = Math.min(...points), hi = Math.max(...points)
  const span = Math.max(hi - lo, 4)
  const x = i => (i / (points.length - 1)) * w
  const y = p => h - 2 - ((p - lo) / span) * (h - 4)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join('')
  const up = points[points.length - 1] >= points[0]
  const col = color || (up ? C.yes : C.no)
  return (
    <svg width={w} height={h} aria-hidden style={{ display: 'block' }}>
      <path d={`${d}L${w},${h}L0,${h}Z`} fill={col} opacity=".12" />
      <path d={d} fill="none" stroke={col} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx={w} cy={y(points[points.length - 1])} r="2.4" fill={col} />
    </svg>
  )
}

// Semicircle chance gauge for Yes/No questions
export function Gauge({ value, size = 84 }) {
  const r = size / 2 - 6, cx = size / 2, cy = size / 2
  const a = Math.PI * (1 - Math.max(0, Math.min(100, value)) / 100)
  const arc = (from, to) => `M${cx + r * Math.cos(from)},${cy - r * Math.sin(from)} A${r},${r} 0 0 1 ${cx + r * Math.cos(to)},${cy - r * Math.sin(to)}`
  const col = value >= 50 ? C.yes : C.no
  return (
    <div style={{ position: 'relative', width: size, height: size / 2 + 12 }}>
      <svg width={size} height={size / 2 + 4} aria-hidden>
        <path d={arc(Math.PI, 0)} stroke={C.surface3} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d={arc(Math.PI, a)} stroke={col} strokeWidth="7" fill="none" strokeLinecap="round" />
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: size / 2 - 16, textAlign: 'center', lineHeight: 1 }}>
        <div style={{ ...display, ...num, fontSize: 19 }}>{fmt.pct(value)}</div>
        <div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>chance</div>
      </div>
    </div>
  )
}

function StatusChip({ ev }) {
  if (ev.state === 'closed') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.noText, fontWeight: 800, fontSize: 12 }}><LiveDot />LIVE</span>
  if (ev.state === 'resolved') return <span style={{ color: C.muted, fontWeight: 800, fontSize: 12 }}>{ev.kind === 'match' ? 'FT' : 'Settled'}</span>
  if (ev.state === 'void') return <span style={{ color: C.muted, fontWeight: 800, fontSize: 12 }}>Void</span>
  const soon = new Date(ev.closes_at) - Date.now() < 3600e3
  return soon
    ? <span style={{ color: '#eda100', fontWeight: 800, fontSize: 12 }}>Kick-off in <Countdown to={ev.closes_at} /></span>
    : <span style={{ color: C.muted, fontWeight: 700, fontSize: 12 }}>{ev.kind === 'match' ? fmt.kickoff(ev.starts_at) : `Closes ${fmt.date(ev.closes_at)}`}</span>
}

async function shareEvent(ev, title) {
  const r = await share({ title, path: `/event/${ev.slug}` })
  if (r === 'copied') notify('Link copied — send it to your group chat.')
  else if (r !== 'shared' && r !== 'cancelled') notify(`Share this link: ${r}`)
}

function CardFrame({ ev, children, onClick, hero }) {
  return (
    <article onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', background: C.surface, border: `1px solid ${C.line}`, cursor: 'pointer', minWidth: 0,
      transition: 'border-color .15s, transform .15s, box-shadow .15s', ...(hero && { background: `linear-gradient(160deg, #1d0520 0%, ${C.surface} 55%)` }),
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#5a3a5e'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px #0009' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
      {children}
    </article>
  )
}

// Deck strip: competition · kick-off on the left, players + share on the right
function CardHead({ ev, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: C.surface3, fontSize: 12, color: C.muted, fontWeight: 700, minWidth: 0 }}>
      <span title={ev.competition} style={{ display: 'inline-flex' }}><Crest name={ev.competition} size={18} /></span>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}><StatusChip ev={ev} /></span>
      <span style={{ marginLeft: 'auto', color: C.accent, whiteSpace: 'nowrap', ...num }}>{fmt.shares(ev.players || 0)} Players</span>
      <button onClick={e => { e.stopPropagation(); shareEvent(ev, title) }} aria-label="Share" style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', display: 'grid', padding: 0 }}><Icon name="share" size={16} /></button>
    </div>
  )
}

function PriceBtn({ cents, lead, onClick, won }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} style={{
      minWidth: 64, padding: '6px 8px', fontWeight: 800, fontSize: 14, cursor: 'pointer', ...num, fontFamily: 'inherit',
      background: won ? C.yes : lead ? C.accent : 'transparent', color: C.text, border: `1px solid ${won ? C.yes : lead ? C.accent : C.lineLight}`,
      transition: 'background .15s',
    }}
      onMouseEnter={e => { if (!lead && !won) e.currentTarget.style.background = '#d103e633' }}
      onMouseLeave={e => { if (!lead && !won) e.currentTarget.style.background = 'transparent' }}>
      <Flash value={cents}>{won ? 'Won' : fmt.cents(cents)}</Flash>
    </button>
  )
}

// ── Cards ────────────────────────────────────────────────────────────────────
export function MarketCard({ ev, grp }) {
  const g = grp || (ev.kind === 'match' ? 'result' : 'winner')
  if (g === 'btts' || g === 'goals') return <YesNoCard ev={ev} grp={g} />
  const rows = rowsFor(ev, g)
  const shown = rows.slice(0, g === 'winner' ? 4 : 3)
  const lead = rows.reduce((a, r) => (r.prob > (a?.prob ?? -1) ? r : a), null)
  const title = questionFor(ev, g)
  const leadMarket = ev.markets.find(m => m.id === lead?.market.id)
  const settled = ev.state === 'resolved' || ev.state === 'void'
  return (
    <CardFrame ev={ev} onClick={() => go(`/event/${ev.slug}`)}>
      <CardHead ev={ev} title={title} />
      <div style={{ padding: '12px 12px 10px', display: 'grid', gap: 10, flex: 1 }}>
        <div style={{ ...display, fontSize: 16, lineHeight: 1.3, textWrap: 'balance' }}>
          {ev.kind === 'match' && ev.state === 'resolved' ? `${ev.home} ${ev.home_score}–${ev.away_score} ${ev.away}` : title}
        </div>
        <div style={{ display: 'grid', gap: 7 }}>
          {shown.map(r => {
            const won = settled && r.market.outcome === 'YES'
            return (
              <div key={r.market.id} onClick={e => { e.stopPropagation(); go(`/event/${ev.slug}?g=${g}&m=${r.market.id}&o=YES`) }}
                style={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto auto', alignItems: 'center', gap: 10 }}>
                {r.market.code === 'DRAW' ? <span style={{ width: 28, textAlign: 'center', color: C.muted, fontWeight: 800 }}>=</span> : <Crest name={r.label} size={26} />}
                <span style={{ fontWeight: r === lead ? 800 : 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                <span style={{ ...display, ...num, fontSize: 16, color: r === lead ? C.text : C.text2 }}><Flash value={r.prob}>{settled ? '' : fmt.pct(r.prob)}</Flash></span>
                {settled ? <span style={{ fontSize: 12, fontWeight: 800, color: won ? C.yesText : C.muted, minWidth: 40, textAlign: 'right' }}>{won ? '✓ WON' : ''}</span>
                  : <PriceBtn cents={r.price} lead={r === lead} onClick={() => go(`/event/${ev.slug}?g=${g}&m=${r.market.id}&o=YES`)} />}
              </div>
            )
          })}
          {rows.length > shown.length && <div style={{ fontSize: 12, color: C.muted }}>+ {rows.length - shown.length} more</div>}
        </div>
        {ev.kind === 'match' && !settled && <ProbBar ev={ev} height={5} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.muted, ...num }}>
        <span>{fmt.kcShort(ev.volume)} vol</span>
        {ev.volume_24h > 0 && <span style={{ color: C.text2 }}>+{fmt.kcShort(ev.volume_24h)} today</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {!settled && leadMarket?.spark && <><span style={{ color: C.text2, fontWeight: 700, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.label}</span><Sparkline points={leadMarket.spark} w={64} h={20} /></>}
        </span>
      </div>
    </CardFrame>
  )
}

function YesNoCard({ ev, grp }) {
  const m = grp === 'btts' ? ev.markets.find(x => x.code === 'BTTS') : ev.markets.find(x => x.code === 'OVER25')
  if (!m) return null
  const title = m.question
  const open = o => go(`/event/${ev.slug}?g=${grp}&m=${m.id}&o=${o}`)
  return (
    <CardFrame ev={ev} onClick={() => open('YES')}>
      <CardHead ev={ev} title={title} />
      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', flex: 1 }}>
        <div style={{ display: 'grid', gap: 8, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Crest name={ev.home} size={22} /><Crest name={ev.away} size={22} /></div>
          <div style={{ ...display, fontSize: 16, lineHeight: 1.3 }}>{title}</div>
        </div>
        <Gauge value={m.price} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '0 12px 12px' }}>
        {[['YES', 'Yes', m.buy_yes, C.yes], ['NO', 'No', m.buy_no, C.no]].map(([o, t, px, col]) => (
          <button key={o} onClick={e => { e.stopPropagation(); open(o) }} style={{
            padding: '10px 8px', background: `${col}22`, border: `1px solid ${col}66`, color: o === 'YES' ? C.yesText : C.noText, fontWeight: 800, fontSize: 15, cursor: 'pointer', ...num,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = col; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = `${col}22`; e.currentTarget.style.color = o === 'YES' ? C.yesText : C.noText }}>
            {t} <Flash value={px}>{fmt.cents(px)}</Flash>
          </button>
        ))}
      </div>
    </CardFrame>
  )
}

// Big hero for the top match: crests, countdown, probability bar, 1X2 buttons, 7-day chart
export function FeaturedCard({ ev, mobile }) {
  const rows = rowsFor(ev, 'result')
  const series = rows.map((r, i) => ({
    id: r.market.id, label: r.label, color: C.series[i],
    points: (r.market.spark || []).map((p, k, arr) => ({ t: new Date(Date.now() - (arr.length - 1 - k) * (7 * 864e5 / 23)).toISOString(), p })),
  }))
  return (
    <CardFrame ev={ev} hero onClick={() => go(`/event/${ev.slug}`)}>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) minmax(0,1.1fr)', gap: mobile ? 14 : 24, padding: mobile ? 14 : 22 }}>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <span style={{ color: C.accent }}>Featured</span> · <Crest name={ev.competition} size={16} /> {ev.competition}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 6, textAlign: 'center' }}><Crest name={ev.home} size={mobile ? 54 : 72} /><strong style={{ fontSize: mobile ? 15 : 17 }}>{ev.home}</strong></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.muted, fontWeight: 800 }}>KICK-OFF IN</div>
              <Countdown to={ev.starts_at} style={{ ...display, fontSize: mobile ? 18 : 22, color: C.accent }} />
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{fmt.kickoff(ev.starts_at)}</div>
            </div>
            <div style={{ display: 'grid', justifyItems: 'center', gap: 6, textAlign: 'center' }}><Crest name={ev.away} size={mobile ? 54 : 72} /><strong style={{ fontSize: mobile ? 15 : 17 }}>{ev.away}</strong></div>
          </div>
          <ProbBar ev={ev} height={8} labels />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
            {rows.map((r, i) => (
              <button key={r.market.id} onClick={e => { e.stopPropagation(); go(`/event/${ev.slug}?g=result&m=${r.market.id}&o=YES`) }} style={{
                display: 'grid', gap: 2, padding: '10px 6px', background: i === rows.indexOf(rows.reduce((a, x) => (x.prob > a.prob ? x : a))) ? C.accent : '#0e0e0e',
                border: `1px solid ${C.lineLight}`, color: C.text, cursor: 'pointer', fontFamily: 'inherit', minWidth: 0,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                <span style={{ ...display, ...num, fontSize: 18 }}><Flash value={r.price}>{fmt.cents(r.price)}</Flash></span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: 12, color: C.muted, ...num }}>
            <span>{fmt.kc(ev.volume)} vol</span><span>{fmt.shares(ev.players)} players</span><span>{fmt.kcShort(ev.liquidity)} liquidity</span>
          </div>
        </div>
        {!mobile && (
          <div style={{ minWidth: 0 }}>
            <PriceChart series={series} live height={250} />
          </div>
        )}
      </div>
    </CardFrame>
  )
}
