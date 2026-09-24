import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, num, useIsMobile, useLive } from './theme.js'
import { Button, Card, Crest, Empty, ErrorBox, Icon, InsightsBar, Pill, Segmented, Tabs, UserLink } from './ui.jsx'
import { InsightsSheet, questionFor, rowsFor } from './opinion.jsx'
import { MarketCard, ProbBar } from './cards.jsx'
import { Countdown, Flash, LiveDot, Skeleton, toast } from './fx.jsx'
import PriceChart from './PriceChart.jsx'
import OrderBook from './OrderBook.jsx'
import TradeWidget from './TradeWidget.jsx'

const GROUP_TABS = { result: 'Result', goals: 'Goals', btts: 'Both score', winner: 'Contenders' }

export default function EventPage({ slug, query, user, onTrade }) {
  const [ev, setEv] = useState(null)
  const [error, setError] = useState('')
  const [grp, setGrp] = useState(query.g || null)
  const [sel, setSel] = useState(query.m ? { m: Number(query.m), o: query.o === 'NO' ? 'NO' : 'YES' } : null)
  const [range, setRange] = useState('1w')
  const [history, setHistory] = useState({})
  const [insights, setInsights] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [showNews, setShowNews] = useState(false)
  const [tab, setTab] = useState('comments')
  const ticketRef = React.useRef(null)
  const mobile = useIsMobile()

  const load = useCallback(() => api.event(slug).then(setEv).catch(e => setError(e.message)), [slug])
  const loadHistory = useCallback(id => api.history(id, range === 'all' ? '' : range).then(setHistory).catch(() => {}), [range])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (ev) loadHistory(ev.id) }, [ev?.id, loadHistory]) // eslint-disable-line react-hooks/exhaustive-deps
  const marketIds = useMemo(() => new Set(ev?.markets.map(m => m.id)), [ev])
  useLive(m => m.event_id === ev?.id || marketIds.has(m.market_id), () => { load(); loadHistory(ev.id) }, [ev?.id, marketIds, loadHistory])

  if (error && !ev) return <ErrorBox>{error}</ErrorBox>
  if (!ev) return <div style={{ display: 'grid', gap: 12 }}><Skeleton h={90} /><Skeleton h={260} /><Skeleton h={180} /></div>

  const groups = [...new Set(ev.markets.map(m => m.grp))]
  const g = grp && groups.includes(grp) ? grp : (ev.markets.find(m => m.id === sel?.m)?.grp || groups[0])
  const rows = rowsFor(ev, g)
  const pair = rows.length === 2 && rows[0].market === rows[1].market
  const lead = rows.reduce((a, r) => (r.prob > (a?.prob ?? -1) ? r : a), null)
  const selRow = rows.find(r => sel && r.market.id === sel.m && (pair ? r.outcome === sel.o : true)) || lead
  const market = selRow.market
  const outcome = pair ? selRow.outcome : (sel?.m === market.id ? sel.o : 'YES')
  const tradable = ev.state === 'open' && market.status === 'open'
  const holdings = (ev.my_positions || []).filter(p => p.market_id === market.id).reduce((h, p) => ({ ...h, [p.outcome]: p.shares }), {})
  const label = pair ? `${outcome === 'YES' ? 'Yes' : 'No'} · ${market.question}` : `${outcome === 'YES' ? '' : 'Not '}${selRow.label}`
  const pick = (m, o) => {
    setSel({ m: m.id, o })
    if (mobile) setTimeout(() => ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
  }

  // Chart: every outcome's probability for 1X2 / outrights; Yes vs No for single questions
  const now = new Date().toISOString()
  const withNow = (pts, p, open) => (open && pts.length ? [...pts, { t: now, p }] : pts)
  const series = g === 'result' || g === 'winner'
    ? rows.slice(0, 4).map((r, i) => ({ id: r.market.id, label: r.label, color: C.series[i], points: withNow(history[r.market.id] || [], r.market.price, r.market.status === 'open') }))
    : g === 'goals'
      ? rows.map((r, i) => ({ id: r.market.id, label: r.label, color: C.series[i], points: withNow(history[r.market.id] || [], r.market.price, r.market.status === 'open') }))
      : [
        { id: 'yes', label: 'Yes', color: C.yes, points: withNow(history[market.id] || [], market.price, market.status === 'open') },
        { id: 'no', label: 'No', color: C.no, points: withNow((history[market.id] || []).map(p => ({ t: p.t, p: 100 - p.p })), 100 - market.price, market.status === 'open') },
      ]
  const afterTrade = () => { load(); onTrade() }

  const ticket = (
    <div ref={ticketRef} style={{ display: 'grid', gap: 12 }}>
      <Card style={{ padding: 14, display: 'grid', gap: 12, borderColor: tradable ? '#5a3a5e' : C.line }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(g === 'result' && market.code !== 'DRAW') || g === 'winner' ? <Crest name={market.label} size={36} /> : <Crest name={ev.competition} size={30} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{ev.kind === 'match' ? `${ev.home} v ${ev.away}` : ev.title}</div>
            <div style={{ ...display, fontSize: 16, lineHeight: 1.25 }}>{market.question}</div>
          </div>
        </div>
        {tradable ? (
          <UnitsTicket key={`${market.id}${outcome}`} market={market} outcome={outcome} user={user} holdings={holdings} label={label}
            canOppose={!pair} onOppose={() => setSel({ m: market.id, o: outcome === 'YES' ? 'NO' : 'YES' })} onDone={afterTrade} />
        ) : (
          <div style={{ color: C.text2, fontSize: 14 }}>
            {ev.state === 'closed' ? 'Kick-off! Trading is paused while the match is played. Opinions settle on the final whistle.'
              : market.outcome === 'VOID' ? 'This opinion was voided. Every unit paid ₭0.50.'
              : `Settled: ${market.outcome === 'YES' ? 'Yes' : 'No'}. Winning units paid ₭1.00 each.`}
          </div>
        )}
      </Card>
      {tradable && (
        <div>
          <button onClick={() => setAdvanced(!advanced)} style={{ background: 'none', border: 'none', color: C.muted, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Advanced: order book, limit orders <span style={{ transform: advanced ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}><Icon name="chev" size={14} /></span>
          </button>
          {advanced && (
            <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
              <Card style={{ padding: 12 }}><OrderBook marketId={market.id} outcome={outcome} /></Card>
              <TradeWidget market={market} outcome={outcome} setOutcome={o => setSel({ m: market.id, o })} user={user}
                holdings={{ yes: holdings.YES || 0, no: holdings.NO || 0 }} onDone={afterTrade} />
            </div>
          )}
        </div>
      )}
      <MyPositions ev={ev} />
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16 }}>
      <a href="#/" style={{ color: C.muted, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="left" size={16} />Opinions</a>
      <EventHeader ev={ev} mobile={mobile} />

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) 370px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 16, minWidth: 0 }}>
          {groups.length > 1 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
              {groups.map(k => <Pill key={k} active={g === k} onClick={() => { setGrp(k); setSel(null) }}>{GROUP_TABS[k]}</Pill>)}
            </div>
          )}

          <Card style={{ padding: 14, background: '#141414' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <div style={{ ...display, fontSize: 15, color: C.text2, textTransform: 'uppercase' }}>Opinions graph</div>
              <Segmented value={range} onChange={setRange} options={[['1d', '1D'], ['1w', '1W'], ['1m', '1M'], ['all', 'All']]} style={{ width: 210 }} />
            </div>
            <PriceChart series={series} live={ev.state === 'open'} height={mobile ? 210 : 280} />
          </Card>

          <OutcomeTable ev={ev} rows={rows} pair={pair} selected={{ market, outcome }} onPick={pick} mobile={mobile} />

          {mobile && ticket}

          <InsightsBar onClick={() => setInsights(true)} text={<><strong style={{ color: C.text2 }}>Ask</strong> for data-backed insights on <strong style={{ color: C.text2 }}>{ev.kind === 'match' ? `${ev.home} v ${ev.away}` : ev.title}</strong></>} />

          <RowLink title="News sources" open={showNews} onClick={() => setShowNews(!showNews)} />
          {showNews && <EventNews slug={ev.slug} />}

          <Card style={{ padding: 14, background: '#1c1c1c' }}>
            <div style={{ ...display, fontSize: 15, marginBottom: 6 }}>Opinion rules</div>
            <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{market.rules}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Trading closes {fmt.kickoff(ev.closes_at)}. Each winning unit pays {fmt.kc(100)}; losing units expire worthless.</div>
          </Card>

          <Related ev={ev} />

          <Card style={{ padding: '0 14px 14px' }}>
            <Tabs value={tab} onChange={setTab} tabs={[['comments', `Discussion (${ev.comments})`], ['activity', 'Activity'], ['holders', 'Top holders']]} />
            <div style={{ paddingTop: 12 }}>
              {tab === 'comments' && <Comments ev={ev} user={user} />}
              {tab === 'activity' && <Activity ev={ev} />}
              {tab === 'holders' && <Holders market={market} />}
            </div>
          </Card>
        </div>

        {!mobile && <div style={{ position: 'sticky', top: 84, minWidth: 0 }}>{ticket}</div>}
      </div>

      <InsightsSheet open={insights} onClose={() => setInsights(false)} event={ev.id} />
    </div>
  )
}

function EventHeader({ ev, mobile }) {
  const size = mobile ? 52 : 76
  const stats = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 13, color: C.muted, ...num }}>
      <span><strong style={{ color: C.text }}>{fmt.kc(ev.volume)}</strong> vol</span>
      <span><strong style={{ color: C.text }}>{fmt.kcShort(ev.liquidity)}</strong> liquidity</span>
      <span><strong style={{ color: C.accent }}>{fmt.shares(ev.players)}</strong> players</span>
      {ev.state === 'open' && <span>Ends in <strong style={{ color: C.text }}>{fmt.endsIn(ev.closes_at)}</strong></span>}
    </div>
  )
  if (ev.kind !== 'match') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Crest name={ev.competition} size={size} />
        <div style={{ minWidth: 0, display: 'grid', gap: 6 }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>{ev.competition} · Season opinion</div>
          <h1 style={{ ...display, fontSize: mobile ? 24 : 32, margin: 0, lineHeight: 1.1 }}>{questionFor(ev, 'winner')}</h1>
          {stats}
        </div>
      </div>
    )
  }
  const mid = ev.state === 'resolved' ? <div style={{ ...display, fontSize: mobile ? 34 : 46 }}>{ev.home_score} – {ev.away_score}</div>
    : ev.state === 'closed' ? <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.noText, fontWeight: 800 }}><LiveDot />IN PLAY</div>
    : <><div style={{ fontSize: 11, color: C.muted, fontWeight: 800 }}>KICK-OFF IN</div><Countdown to={ev.starts_at} style={{ ...display, fontSize: mobile ? 18 : 24, color: C.accent }} /><div style={{ fontSize: 12, color: C.muted }}>{fmt.kickoff(ev.starts_at)}</div></>
  return (
    <Card style={{ padding: mobile ? 14 : 20, background: 'linear-gradient(160deg, #1d0520 0%, #141414 60%)', display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.muted, fontWeight: 700 }}><Crest name={ev.competition} size={18} />{ev.competition}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 6, textAlign: 'center' }}><Crest name={ev.home} size={size} /><strong style={{ fontSize: mobile ? 15 : 19 }}>{ev.home}</strong></div>
        <div style={{ textAlign: 'center' }}>{mid}</div>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 6, textAlign: 'center' }}><Crest name={ev.away} size={size} /><strong style={{ fontSize: mobile ? 15 : 19 }}>{ev.away}</strong></div>
      </div>
      {ev.state !== 'resolved' && <ProbBar ev={ev} height={8} labels />}
      {stats}
    </Card>
  )
}

// Polymarket-style outcome rows: crest · name · chance · Buy Yes / Buy No
function OutcomeTable({ ev, rows, pair, selected, onPick, mobile }) {
  const list = pair ? [{ market: rows[0].market, label: rows[0].market.question, prob: rows[0].prob }] : rows
  return (
    <Card style={{ overflow: 'hidden' }}>
      {list.map((r, i) => {
        const m = r.market
        const isSel = selected.market.id === m.id
        const open = m.status === 'open' && ev.state === 'open'
        const btn = (o, px) => {
          const on = isSel && selected.outcome === o
          const col = o === 'YES' ? C.yes : C.no
          return (
            <button onClick={() => onPick(m, o)} disabled={!open || px == null} style={{
              minWidth: mobile ? 84 : 118, padding: '10px 10px', fontWeight: 800, fontSize: 14, cursor: open ? 'pointer' : 'default', ...num, fontFamily: 'inherit',
              background: on ? col : `${col}1f`, color: on ? '#fff' : o === 'YES' ? C.yesText : C.noText, border: `1px solid ${on ? col : `${col}55`}`, opacity: open ? 1 : 0.4,
            }}>
              {o === 'YES' ? (pair ? 'Yes' : 'Back') : (pair ? 'No' : 'Oppose')} <Flash value={px}>{fmt.cents(px)}</Flash>
            </button>
          )
        }
        return (
          <div key={m.id} onClick={() => open && onPick(m, isSel ? selected.outcome : 'YES')} style={{
            display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr) auto' : 'minmax(0,1fr) 90px auto', alignItems: 'center', gap: 12,
            padding: mobile ? '12px' : '14px 16px', borderTop: i ? `1px solid ${C.line}` : 'none', cursor: open ? 'pointer' : 'default',
            background: isSel ? '#d103e614' : 'transparent', boxShadow: isSel ? `inset 3px 0 0 ${C.accent}` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {m.grp === 'result' && m.code !== 'DRAW' || m.grp === 'winner' ? <Crest name={m.label} size={34} /> : null}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: pair ? 'normal' : 'nowrap' }}>{r.label}</div>
                <div style={{ fontSize: 12, color: C.muted, ...num }}>
                  {fmt.kcShort(m.volume)} vol
                  {mobile && m.status === 'open' && <> · <strong style={{ color: C.text }}>{fmt.pct(m.price)}</strong>{m.change_24h ? <span style={{ color: m.change_24h > 0 ? C.yesText : C.noText }}> {m.change_24h > 0 ? '▲' : '▼'}{Math.abs(m.change_24h)}</span> : null}</>}
                </div>
              </div>
            </div>
            {!mobile && (
              <div style={{ textAlign: 'right' }}>
                {m.status === 'open' ? (
                  <>
                    <div style={{ ...display, ...num, fontSize: 24, lineHeight: 1 }}><Flash value={m.price}>{fmt.pct(m.price)}</Flash></div>
                    {m.change_24h !== 0 && <div style={{ fontSize: 12, fontWeight: 700, color: m.change_24h > 0 ? C.yesText : C.noText, ...num }}>{m.change_24h > 0 ? '▲' : '▼'} {Math.abs(m.change_24h)}</div>}
                  </>
                ) : <span style={{ fontWeight: 800, color: m.outcome === 'YES' ? C.yesText : C.muted }}>{m.outcome === 'VOID' ? 'Void' : m.outcome === 'YES' ? '✓ Yes' : 'No'}</span>}
              </div>
            )}
            {m.status === 'open' ? (
              <div style={{ display: 'flex', gap: 6, gridColumn: mobile ? '1 / -1' : 'auto' }} onClick={e => e.stopPropagation()}>
                {btn('YES', m.buy_yes)}{btn('NO', m.buy_no)}
              </div>
            ) : mobile && <span style={{ fontWeight: 800, color: m.outcome === 'YES' ? C.yesText : C.muted }}>{m.outcome === 'VOID' ? 'Void' : m.outcome === 'YES' ? '✓ Yes' : 'No'}</span>}
          </div>
        )
      })}
    </Card>
  )
}

// The deck's ticket: "# of Units [15] · Potential Win ₭15.00 · Buy"
function UnitsTicket({ market, outcome, user, holdings, label, canOppose, onOppose, onDone }) {
  const [units, setUnits] = useState('10')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const n = Math.max(0, parseInt(units, 10) || 0)
  const held = holdings[outcome] || 0

  useEffect(() => {
    setPreview(null); setError('')
    if (!user || !n) return
    const t = setTimeout(() => api.preview({ market_id: market.id, outcome, side: 'buy', type: 'market', size: n }).then(setPreview).catch(e => setError(e.message)), 200)
    return () => clearTimeout(t)
  }, [n, market.id, outcome, user?.id, market.buy_yes, market.buy_no]) // eslint-disable-line react-hooks/exhaustive-deps

  const buy = async () => {
    if (!user) { window.location.hash = '/login'; return }
    setBusy(true); setError('')
    try { const r = await api.placeOrder({ market_id: market.id, outcome, side: 'buy', type: 'market', size: n }); setDone(r); toast(`✓ Backed ${label} — ${fmt.shares(r.filled)} units at ${fmt.cents(r.avg_price)}. Win ${fmt.kc(r.filled * 100)} if right.`); onDone() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const sell = async () => {
    setBusy(true); setError('')
    try { const r = await api.placeOrder({ market_id: market.id, outcome, side: 'sell', type: 'market', size: Math.min(held, n || held) }); setDone(r); toast(`Sold ${fmt.shares(r.filled)} units for ${fmt.kc(r.proceeds)}.`); onDone() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const unitPrice = outcome === 'YES' ? market.buy_yes : market.buy_no
  const fillsAll = !preview || preview.filled === n
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13, color: C.muted }}>
        <span>Backing <strong style={{ color: C.accent }}>{label}</strong> at {fmt.cents(unitPrice)} / unit</span>
        {canOppose && <button onClick={onOppose} style={{ background: 'none', border: 'none', color: C.text2, textDecoration: 'underline', cursor: 'pointer', fontSize: 13, padding: 0, whiteSpace: 'nowrap' }}>{outcome === 'YES' ? 'Oppose instead' : 'Back instead'}</button>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, background: C.field, color: C.fieldInk, padding: '6px 8px', fontWeight: 700, fontSize: 13, minWidth: 0 }}>
          <span style={{ lineHeight: 1.15 }}># of Units</span>
          <input inputMode="numeric" value={units} onChange={e => setUnits(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="Number of units"
            style={{ width: 52, minWidth: 0, border: 'none', borderBottom: `2px solid ${C.fieldInk}`, outline: 'none', background: 'transparent', color: C.fieldInk, fontWeight: 800, fontSize: 17, textAlign: 'center', ...num }} />
        </label>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 6, border: `1px solid ${C.lineLight}`, padding: '6px 8px', color: C.yesText, fontWeight: 700, fontSize: 13, minWidth: 0 }}>
          <span style={{ lineHeight: 1.15 }}>Potential Win</span>
          <span style={{ fontSize: 16, ...num }}>{fmt.kc((preview?.filled ?? n) * 100)}</span>
        </div>
        <Button kind="buy" onClick={buy} disabled={busy || !n || (user && !preview)} style={{ padding: '10px 20px', fontSize: 17, borderRadius: 0 }}>{busy ? '…' : 'Buy'}</Button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: C.muted, flexWrap: 'wrap', ...num }}>
        <span>{preview ? <>Cost <strong style={{ color: C.text }}>{fmt.kc(preview.cost)}</strong> · avg {fmt.cents(preview.avg_price)} · profit if right <strong style={{ color: C.yesText }}>{fmt.signed(preview.filled * 100 - preview.cost)}</strong></> : user ? ' ' : <a href="#/login" style={{ color: C.accent, fontWeight: 700 }}>Sign up free for {fmt.kc(100000)} to play</a>}</span>
        {user && <span>You have {fmt.kc(user.balance)}</span>}
      </div>
      {!fillsAll && <div style={{ fontSize: 13, color: '#eda100' }}>Only {preview.filled} units available at the moment. Your order fills what it can.</div>}
      {held > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 14, border: `1px solid ${C.line}`, padding: '8px 10px' }}>
          <span>You hold <strong>{fmt.shares(held)} units</strong> · worth {fmt.kc(held * (outcome === 'YES' ? market.price : 100 - market.price))}</span>
          <Button kind="quiet" onClick={sell} disabled={busy} style={{ padding: '6px 12px', fontSize: 13 }}>Sell {n && n < held ? n : 'all'}</Button>
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>
    </div>
  )
}

function RowLink({ title, onClick, open }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: '#1c1c1c', border: `1px solid ${C.line}`,
      color: C.text, padding: '12px 14px', fontWeight: 700, fontSize: 15, cursor: 'pointer',
    }}>
      {title}<span style={{ transform: open ? 'rotate(90deg)' : 'none', display: 'inline-flex', transition: 'transform .15s' }}><Icon name="arrow" size={18} /></span>
    </button>
  )
}

function EventNews({ slug }) {
  const [items, setItems] = useState(null)
  useEffect(() => { api.news().then(all => setItems(all.filter(i => i.slug === slug))).catch(() => setItems([])) }, [slug])
  if (!items) return <Empty>Loading…</Empty>
  if (!items.length) return <Card style={{ padding: 12, fontSize: 14, color: C.muted }}>No stories on this one yet. Price moves, big calls and results show up here as they happen.</Card>
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {items.map((n, i) => (
        <Card key={i} style={{ padding: '10px 12px' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{n.body} · {fmt.ago(n.at)}</div>
        </Card>
      ))}
    </div>
  )
}

function Related({ ev }) {
  const [list, setList] = useState(null)
  const [open, setOpen] = useState(false)
  useEffect(() => { if (open && !list) api.events({ category: ev.competition, sort: 'trending' }).then(l => setList(l.filter(x => x.id !== ev.id).slice(0, 4))).catch(() => setList([])) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button onClick={() => setOpen(!open)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1c1c1c', border: `1px solid ${C.text2}`, color: C.text, padding: '9px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          Related opinions <Icon name={open ? 'down' : 'arrow'} size={16} />
        </button>
      </div>
      {open && !list && <Empty>Loading…</Empty>}
      {open && list && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>{list.map(r => <MarketCard key={r.id} ev={r} />)}</div>}
      {open && list && !list.length && <Empty>Nothing else in {ev.competition} right now.</Empty>}
    </div>
  )
}

function MyPositions({ ev }) {
  const ps = ev.my_positions || []
  if (!ps.length) return null
  return (
    <Card style={{ padding: 12 }}>
      <div style={{ ...display, fontSize: 15, marginBottom: 6 }}>Your opinions here</div>
      {ps.map(p => (
        <div key={`${p.market_id}${p.outcome}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700 }}><span style={{ color: p.outcome === 'YES' ? C.yesText : C.noText }}>{p.outcome === 'YES' ? 'Yes' : 'No'}</span> · {p.label} <span style={{ color: C.muted }}>x {fmt.shares(p.shares)}</span></div>
            <div style={{ color: C.muted, fontSize: 13, ...num }}>Invested {fmt.kc(p.cost)} · now {fmt.cents(p.price)}/unit</div>
          </div>
          <div style={{ textAlign: 'right', ...num }}>
            <div style={{ fontWeight: 700 }}>{fmt.kc(p.value)}</div>
            <div style={{ color: p.pnl >= 0 ? C.yesText : C.noText, fontSize: 13 }}>{fmt.signed(p.pnl)}</div>
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
            style={{ flex: 1, minWidth: 0, background: C.bg, border: `1px solid ${C.lineLight}`, color: C.text, padding: '10px 12px', fontSize: 15 }} />
          <Button type="submit" disabled={!body.trim()}>Post</Button>
        </form>
      ) : <div style={{ fontSize: 14, color: C.muted }}><a href="#/login" style={{ color: C.accent }}>Sign in</a> to join the discussion.</div>}
      <ErrorBox>{error}</ErrorBox>
      {list && !list.length && <Empty>No takes yet. Call it first.</Empty>}
      {list?.map(c => (
        <div key={c.id} style={{ fontSize: 14, lineHeight: 1.5 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
            <UserLink name={c.username} />
            {c.holding && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', background: c.holding.outcome === 'YES' ? C.yesBg : C.noBg, color: c.holding.outcome === 'YES' ? C.yesText : C.noText }}>
                {c.holding.outcome === 'YES' ? '' : 'Against '}{c.holding.label} x {fmt.shares(c.holding.shares)}
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
            <UserLink name={t.username} />{' '}<span style={{ color: C.muted }}>{t.side === 'buy' ? 'bought' : 'sold'}</span>{' '}
            <strong style={{ color: t.outcome === 'YES' ? C.yesText : C.noText }}>{fmt.shares(t.size)} {t.outcome === 'YES' ? 'Yes' : 'No'}</strong>{' '}
            {t.label} <span style={{ color: C.muted }}>@ {fmt.cents(t.outcome === 'YES' ? t.price : 100 - t.price)}</span>
          </span>
          <span style={{ color: C.muted, whiteSpace: 'nowrap', ...num }}>{fmt.kcShort(t.notional)} · {fmt.ago(t.created_at)}</span>
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
          <UserLink name={r.username} /><span style={{ color: C.text2, ...num }}>{fmt.shares(r.shares)} units</span>
        </div>
      ))}
    </div>
  )
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>{market.question}</div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>{col('YES', h.yes, C.yesText)}{col('NO', h.no, C.noText)}</div>
    </div>
  )
}
