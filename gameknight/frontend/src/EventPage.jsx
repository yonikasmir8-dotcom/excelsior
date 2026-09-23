import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, num, useIsMobile, useLive } from './theme.js'
import { Button, Card, Crest, Empty, ErrorBox, Segmented, StateBadge, Tabs, UserLink } from './ui.jsx'
import PriceChart from './PriceChart.jsx'
import OrderBook from './OrderBook.jsx'
import TradeWidget from './TradeWidget.jsx'

const GROUPS = { result: 'Match result', goals: 'Total goals', btts: 'Both teams to score', winner: 'Contenders' }

export default function EventPage({ slug, query, user, onTrade }) {
  const [ev, setEv] = useState(null)
  const [error, setError] = useState('')
  const [marketId, setMarketId] = useState(query.m ? Number(query.m) : null)
  const [outcome, setOutcome] = useState(query.o === 'NO' ? 'NO' : 'YES')
  const [expanded, setExpanded] = useState(query.m ? Number(query.m) : null)
  const [range, setRange] = useState('1w')
  const [history, setHistory] = useState({})
  const [tab, setTab] = useState('comments')
  const [sheet, setSheet] = useState(!!query.m)
  const [pickedPrice, setPickedPrice] = useState(null)
  const mobile = useIsMobile()

  const load = useCallback(() => api.event(slug).then(setEv).catch(e => setError(e.message)), [slug])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (ev) api.history(ev.id, range === 'all' ? '' : range).then(setHistory).catch(() => {}) }, [ev?.id, range]) // eslint-disable-line react-hooks/exhaustive-deps
  const marketIds = useMemo(() => new Set(ev?.markets.map(m => m.id)), [ev])
  useLive(m => m.event_id === ev?.id || marketIds.has(m.market_id), () => {
    load()
    api.history(ev.id, range === 'all' ? '' : range).then(setHistory).catch(() => {})
  }, [ev?.id, marketIds, range])

  if (error && !ev) return <ErrorBox>{error}</ErrorBox>
  if (!ev) return <Card><Empty>Loading market…</Empty></Card>

  const market = ev.markets.find(m => m.id === marketId) || ev.markets[0]
  const featured = ev.kind === 'match'
    ? ev.markets.filter(m => m.grp === 'result')
    : [...ev.markets].sort((a, b) => b.price - a.price).slice(0, 4)
  // End each line at the live displayed price so the legend matches the market rows
  const series = featured.map((m, i) => {
    const pts = history[m.id] || []
    return { id: m.id, label: m.label, color: C.series[i], points: pts.length && m.status === 'open' ? [...pts, { t: new Date().toISOString(), p: m.price }] : pts }
  })
  const holdings = (ev.my_positions || []).filter(p => p.market_id === market.id)
    .reduce((h, p) => ({ ...h, [p.outcome === 'YES' ? 'yes' : 'no']: p.shares }), { yes: 0, no: 0 })
  const groups = Object.entries(ev.markets.reduce((g, m) => ({ ...g, [m.grp]: [...(g[m.grp] || []), m] }), {}))

  const choose = (m, o) => {
    setMarketId(m.id); setOutcome(o); setPickedPrice(null)
    if (mobile) setSheet(true)
  }
  const afterTrade = () => { load(); onTrade() }

  const widget = (
    <TradeWidget market={market} outcome={outcome} setOutcome={setOutcome} user={user} holdings={holdings}
      onDone={afterTrade} initialPrice={pickedPrice} onClose={mobile ? () => setSheet(false) : null} />
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) 360px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 18, minWidth: 0 }}>
          <Header ev={ev} mobile={mobile} />

          <Card style={{ padding: 16 }}>
            <PriceChart series={series} live={ev.state === 'open'} height={mobile ? 200 : 260} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Segmented value={range} onChange={setRange} options={[['1d', '1D'], ['1w', '1W'], ['1m', '1M'], ['all', 'All']]} style={{ width: 220 }} />
            </div>
          </Card>

          {groups.map(([grp, ms]) => (
            <div key={grp}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 2px' }}>{GROUPS[grp]}</div>
              <Card style={{ overflow: 'hidden' }}>
                {[...ms].sort((a, b) => grp === 'winner' ? b.price - a.price : 0).map((m, i) => (
                  <MarketRow key={m.id} m={m} ev={ev} first={i === 0} mobile={mobile} selected={m.id === market.id}
                    expanded={expanded === m.id} onToggle={() => { setExpanded(expanded === m.id ? null : m.id); setMarketId(m.id) }}
                    onBuy={o => choose(m, o)}
                    myOrders={(ev.my_orders || []).filter(o => o.market_id === m.id)} onCancel={async id => { await api.cancelOrder(id); afterTrade() }}
                    outcome={m.id === market.id ? outcome : 'YES'}
                    onPickPrice={(price, kind, o) => { setMarketId(m.id); setOutcome(o); setPickedPrice({ price, side: kind === 'ask' ? 'buy' : 'sell', at: Date.now() }); if (mobile) setSheet(true) }} />
                ))}
              </Card>
            </div>
          ))}

          <Card style={{ padding: '0 16px 16px' }}>
            <Tabs value={tab} onChange={setTab} tabs={[['comments', `Comments (${ev.comments})`], ['activity', 'Activity'], ['holders', 'Top holders'], ['rules', 'Rules']]} />
            <div style={{ paddingTop: 14 }}>
              {tab === 'comments' && <Comments ev={ev} user={user} />}
              {tab === 'activity' && <Activity ev={ev} />}
              {tab === 'holders' && <Holders market={market} />}
              {tab === 'rules' && (
                <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.65 }}>
                  {ev.description && <p style={{ marginTop: 0 }}>{ev.description}</p>}
                  <p style={{ margin: '0 0 6px', color: C.text, fontWeight: 700 }}>{market.question}</p>
                  <p style={{ marginTop: 0 }}>{market.rules}</p>
                  <p style={{ marginBottom: 0, color: C.muted, fontSize: 13 }}>
                    Trading closes {fmt.kickoff(ev.closes_at)}. Winning shares redeem for 1 KC each; losing shares expire worthless.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {!mobile && (
          <div style={{ position: 'sticky', top: 84, display: 'grid', gap: 14 }}>
            {widget}
            <MyPositions ev={ev} />
          </div>
        )}
      </div>

      {mobile && (
        <>
          <MyPositions ev={ev} style={{ marginTop: 18 }} />
          {sheet && (
            <div onClick={() => setSheet(false)} style={{ position: 'fixed', inset: 0, background: '#000a', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
              <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxHeight: '92vh', overflowY: 'auto', animation: 'gk-up .2s ease', paddingBottom: 'env(safe-area-inset-bottom)' }}>
                {widget}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Header({ ev, mobile }) {
  return (
    <div>
      <a href="#/" style={{ color: C.muted, fontSize: 13 }}>← Markets</a>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10 }}>
        {ev.kind === 'match'
          ? <div style={{ display: 'flex' }}><Crest name={ev.home} size={mobile ? 38 : 48} /><div style={{ marginLeft: -8 }}><Crest name={ev.away} size={mobile ? 38 : 48} /></div></div>
          : <div style={{ fontSize: mobile ? 34 : 42 }}>🏆</div>}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>{ev.competition}</div>
          <h1 style={{ ...display, fontSize: mobile ? 26 : 38, fontWeight: 800, margin: 0, lineHeight: 1.05, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
            {ev.kind === 'match' && ev.state === 'resolved' ? <>{ev.home} {ev.home_score}–{ev.away_score} {ev.away}</> : ev.title}
          </h1>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 12, fontSize: 13, color: C.text2 }}>
        <StateBadge state={ev.state} />
        <span style={num}>🏦 {fmt.kc(ev.volume)} vol</span>
        <span style={num}>💧 {fmt.kcShort(ev.liquidity)} KC liquidity</span>
        {ev.state === 'open' && <span>⏱ {ev.kind === 'match' ? `Kick-off ${fmt.kickoff(ev.starts_at)}` : `Closes ${fmt.date(ev.closes_at)}`} · {fmt.countdown(ev.closes_at)}</span>}
      </div>
    </div>
  )
}

function MarketRow({ m, ev, first, mobile, selected, expanded, onToggle, onBuy, myOrders, onCancel, outcome, onPickPrice }) {
  const open = m.status === 'open' && ev.state === 'open'
  const [bookSide, setBookSide] = useState(outcome)
  useEffect(() => setBookSide(outcome), [outcome])
  const buyBtn = (o, px) => (
    <button onClick={e => { e.stopPropagation(); onBuy(o) }} disabled={px == null} style={{
      background: o === 'YES' ? C.yesBg : C.noBg, color: o === 'YES' ? C.yes : C.no, border: 'none', borderRadius: 8,
      padding: mobile ? '9px 8px' : '10px 14px', minWidth: mobile ? 76 : 112, fontWeight: 800, fontSize: 14, cursor: px == null ? 'not-allowed' : 'pointer', ...num,
    }}
      onMouseEnter={e => { if (px != null) { e.currentTarget.style.background = o === 'YES' ? C.yes : C.no; e.currentTarget.style.color = C.bg } }}
      onMouseLeave={e => { e.currentTarget.style.background = o === 'YES' ? C.yesBg : C.noBg; e.currentTarget.style.color = o === 'YES' ? C.yes : C.no }}>
      {mobile ? '' : 'Buy '}{o === 'YES' ? 'Yes' : 'No'} {px != null ? `${px}¢` : '—'}
    </button>
  )
  return (
    <div style={{ borderTop: first ? 'none' : `1px solid ${C.line}`, background: selected ? C.surface2 : 'transparent' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: mobile ? '12px' : '14px 16px', cursor: 'pointer', flexWrap: mobile ? 'wrap' : 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: mobile ? '55%' : 0 }}>
          {m.grp === 'result' && m.code !== 'DRAW' || m.grp === 'winner' ? <Crest name={m.label} size={26} /> : null}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.label}</div>
            <div style={{ fontSize: 12, color: C.muted, ...num }}>{fmt.kcShort(m.volume)} KC vol</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 64 }}>
          {m.status === 'open' ? (
            <>
              <div style={{ ...display, ...num, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{fmt.pct(m.price)}</div>
              {m.change_24h !== 0 && <div style={{ fontSize: 12, fontWeight: 700, color: m.change_24h > 0 ? C.yes : C.no, ...num }}>{m.change_24h > 0 ? '▲' : '▼'} {Math.abs(m.change_24h)}</div>}
            </>
          ) : (
            <span style={{ fontWeight: 800, color: m.outcome === 'YES' ? C.yes : C.muted }}>{m.outcome === 'VOID' ? 'Void 50/50' : m.outcome === 'YES' ? '✓ Yes' : 'No'}</span>
          )}
        </div>
        {open && (
          <div style={{ display: 'flex', gap: 6, ...(mobile && { width: '100%' }) }}>
            {buyBtn('YES', m.buy_yes)}{buyBtn('NO', m.buy_no)}
          </div>
        )}
      </div>
      {expanded && (
        <div style={{ padding: mobile ? '0 12px 14px' : '0 16px 16px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
          <Segmented value={bookSide} onChange={setBookSide} options={[['YES', 'Trade Yes'], ['NO', 'Trade No']]} style={{ width: 220 }} />
          <OrderBook marketId={m.id} outcome={bookSide} onPickPrice={open ? (price, kind) => onPickPrice(price, kind, bookSide) : null} />
          {myOrders.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 6 }}>YOUR OPEN ORDERS</div>
              {myOrders.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderTop: `1px solid ${C.line}` }}>
                  <span style={num}><strong style={{ color: o.side === 'buy' ? C.yes : C.no, textTransform: 'capitalize' }}>{o.side}</strong> {o.outcome === 'YES' ? 'Yes' : 'No'} · {fmt.shares(o.size - o.filled)} @ {o.price}¢</span>
                  <button onClick={() => onCancel(o.id)} style={{ background: 'none', border: `1px solid ${C.line}`, borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: C.text2 }}>Cancel</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MyPositions({ ev, style }) {
  const ps = ev.my_positions || []
  if (!ps.length) return null
  return (
    <Card style={{ padding: 14, ...style }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Your positions</div>
      {ps.map(p => (
        <div key={`${p.market_id}${p.outcome}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: `1px solid ${C.line}`, fontSize: 13 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}><span style={{ color: p.outcome === 'YES' ? C.yes : C.no }}>{p.outcome === 'YES' ? 'Yes' : 'No'}</span> · {p.label}</div>
            <div style={{ color: C.muted, ...num }}>{fmt.shares(p.shares)} @ {fmt.cents(p.avg_price)} → {p.price}¢</div>
          </div>
          <div style={{ textAlign: 'right', ...num }}>
            <div style={{ fontWeight: 700 }}>{fmt.kc(p.value)}</div>
            <div style={{ color: p.pnl >= 0 ? C.yes : C.no }}>{fmt.signed(p.pnl)}</div>
          </div>
        </div>
      ))}
    </Card>
  )
}

function Comments({ ev, user }) {
  const [list, setList] = useState(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const load = () => api.comments(ev.id).then(setList).catch(() => {})
  useEffect(() => { load() }, [ev.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useLive(m => m.type === 'comment' && m.event_id === ev.id, load, [ev.id])
  const post = async e => {
    e.preventDefault(); setError('')
    try { await api.postComment(ev.id, body); setBody(''); load() } catch (err) { setError(err.message) }
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {user ? (
        <form onSubmit={post} style={{ display: 'flex', gap: 8 }}>
          <input value={body} onChange={e => setBody(e.target.value)} maxLength={1000} placeholder="Share your take…"
            style={{ flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 14 }} />
          <Button type="submit" disabled={!body.trim()}>Post</Button>
        </form>
      ) : <div style={{ fontSize: 14, color: C.muted }}><a href="#/login" style={{ color: C.accent }}>Sign in</a> to join the conversation.</div>}
      <ErrorBox>{error}</ErrorBox>
      {list && !list.length && <Empty>No comments yet. Call it first.</Empty>}
      {list?.map(c => (
        <div key={c.id} style={{ fontSize: 14, lineHeight: 1.5 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
            <UserLink name={c.username} />
            {c.holding && (
              <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 4, padding: '1px 6px', background: c.holding.outcome === 'YES' ? C.yesBg : C.noBg, color: c.holding.outcome === 'YES' ? C.yes : C.no }}>
                {fmt.shares(c.holding.shares)} {c.holding.outcome === 'YES' ? 'Yes' : 'No'} · {c.holding.label}
              </span>
            )}
            <span style={{ color: C.muted }}>{fmt.ago(c.created_at)}</span>
          </div>
          <div style={{ color: C.text2, marginTop: 2, overflowWrap: 'anywhere' }}>{c.body}</div>
        </div>
      ))}
    </div>
  )
}

function Activity({ ev }) {
  const [list, setList] = useState(null)
  const load = () => api.activity(ev.id).then(setList).catch(() => {})
  useEffect(() => { load() }, [ev.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useLive(m => m.type === 'trade' && m.event_id === ev.id, load, [ev.id])
  if (!list) return <Empty>Loading…</Empty>
  if (!list.length) return <Empty>No trades yet.</Empty>
  return (
    <div>
      {list.map(t => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '8px 0', borderTop: `1px solid ${C.line}` }}>
          <span style={{ minWidth: 0 }}>
            <UserLink name={t.username} />{' '}
            <span style={{ color: C.muted }}>{t.side === 'buy' ? 'bought' : 'sold'}</span>{' '}
            <strong style={{ color: t.outcome === 'YES' ? C.yes : C.no }}>{fmt.shares(t.size)} {t.outcome === 'YES' ? 'Yes' : 'No'}</strong>{' '}
            {t.label} <span style={{ color: C.muted }}>@ {t.outcome === 'YES' ? t.price : 100 - t.price}¢</span>
          </span>
          <span style={{ color: C.muted, whiteSpace: 'nowrap', ...num }}>{fmt.kcShort(t.notional)} KC · {fmt.ago(t.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

function Holders({ market }) {
  const [h, setH] = useState(null)
  useEffect(() => { setH(null); api.holders(market.id).then(setH).catch(() => {}) }, [market.id])
  if (!h) return <Empty>Loading…</Empty>
  const col = (title, rows, color) => (
    <div style={{ flex: '1 1 200px' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 6 }}>{title}</div>
      {!rows.length && <div style={{ fontSize: 13, color: C.muted }}>No holders</div>}
      {rows.map((r, i) => (
        <div key={r.username} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
          <UserLink name={r.username} /><span style={{ color: C.text2, ...num }}>{fmt.shares(r.shares)}</span>
        </div>
      ))}
    </div>
  )
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>{market.question}</div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>{col('YES HOLDERS', h.yes, C.yes)}{col('NO HOLDERS', h.no, C.no)}</div>
    </div>
  )
}
