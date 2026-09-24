import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, num, share, useIsMobile, useLive } from './theme.js'
import { Button, Card, Empty, ErrorBox, Pill, PriceBox, Strip, notify } from './ui.jsx'
import { CardArt } from './opinion.jsx'

export default function PortfolioPage({ user, onChange, onBonus }) {
  const [p, setP] = useState(null)
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('all')
  const [error, setError] = useState('')

  const load = () => Promise.all([api.portfolio(), api.orders()]).then(([pf, os]) => { setP(pf); setOrders(os) }).catch(e => setError(e.message))
  useEffect(() => { load() }, [])
  useLive(m => m.type === 'trade' || m.type === 'event', load)

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!p) return <Empty>Loading your opinions…</Empty>

  const cancel = async id => { await api.cancelOrder(id); load(); onChange?.() }
  const active = p.positions
  const past = p.settled

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', border: `1px solid ${C.line}`, background: C.surface }}>
        <Figure label="Balance" value={fmt.kc(p.cash)} />
        <Figure label="In opinions" value={fmt.kc(p.positions_value + p.in_orders)} />
        <Figure label="All-time" value={fmt.signed(p.profit)} tone={p.profit >= 0 ? C.yesText : C.noText} />
      </div>
      {user?.can_claim_bonus && <Button kind="ghost" onClick={onBonus} style={{ borderColor: C.accent, color: C.accent }}>Claim your daily {fmt.kc(10000)}</Button>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
        {[['all', 'All Opinions'], ['past', 'Past Opinions'], ['active', 'Active Opinions']].map(([k, t]) => (
          <Pill key={k} active={tab === k} onClick={() => setTab(k)} style={{ padding: '9px 4px', fontSize: 14 }}>{t}</Pill>
        ))}
      </div>

      {(tab === 'all' || tab === 'active') && active.map(x => <ActiveCard key={`${x.market_id}${x.outcome}`} x={x} />)}
      {(tab === 'all' || tab === 'active') && orders.length > 0 && (
        <Card style={{ padding: 12 }}>
          <div style={{ ...display, fontSize: 15, marginBottom: 6 }}>Waiting to fill</div>
          {orders.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
              <a href={`#/event/${o.slug}?m=${o.market_id}`} style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{o.side === 'buy' ? 'Buy' : 'Sell'} {o.outcome === 'YES' ? 'Yes' : 'No'} · {o.question}</div>
                <div style={{ color: C.muted, fontSize: 13, ...num }}>{fmt.shares(o.size - o.filled)} units at {fmt.cents(o.price)}</div>
              </a>
              <Button kind="quiet" onClick={() => cancel(o.id)} style={{ padding: '5px 10px', fontSize: 13 }}>Cancel</Button>
            </div>
          ))}
        </Card>
      )}
      {(tab === 'all' || tab === 'past') && past.map(s => <PastCard key={`${s.market_id}-${s.created_at}`} s={s} />)}

      {tab === 'active' && !active.length && <Empty>No active opinions. <a href="#/" style={{ color: C.accent }}>Back your first one →</a></Empty>}
      {tab === 'past' && !past.length && <Empty>Nothing settled yet. Results land here after the final whistle.</Empty>}
      {tab === 'all' && !active.length && !past.length && <Empty>You haven't backed anything yet. <a href="#/" style={{ color: C.accent }}>Find an opinion →</a></Empty>}
    </div>
  )
}

function Figure({ label, value, tone }) {
  return (
    <div style={{ padding: '10px 12px', borderRight: `1px solid ${C.line}` }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{label}</div>
      <div style={{ ...display, ...num, fontSize: 17, color: tone || C.text, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  )
}

function Money({ label, cents, strong }) {
  return <span style={{ whiteSpace: 'nowrap' }}>{label} <strong style={{ color: strong || C.text, ...num }}>{fmt.kc(Math.abs(cents))}</strong></span>
}

function shareWin(title, pnl) {
  return async () => {
    const r = await share({ title: `${pnl >= 0 ? 'Called it' : 'Backed'}: ${title} on Game Knight`, path: '/' })
    if (r === 'copied') notify('Link copied — show off your call.')
    else if (r !== 'shared' && r !== 'cancelled') notify(`Share this link: ${r}`)
  }
}

function WalletCard({ tone, header, question, rows, art, onShare, href }) {
  const mobile = useIsMobile()
  const w = mobile ? 76 : 92
  return (
    <a href={href} style={{ display: 'grid', gridTemplateColumns: `minmax(0,1fr) ${w}px`, gap: 6 }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Strip tone={tone} onShare={onShare}>{header}</Strip>
        <div style={{ background: C.surface, flex: 1, padding: '12px 14px' }}>
          <div style={{ ...display, fontSize: 16, lineHeight: 1.3, paddingBottom: 10, borderBottom: `1px solid ${C.line}` }}>{question}</div>
          <div style={{ display: 'grid', gap: 6, paddingTop: 10 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PriceBox cents={r.price} tone={r.tone} />
                <span style={{ fontSize: 14, fontWeight: r.tone ? 700 : 500, color: r.tone === 'win' ? C.yesText : r.tone === 'lose' ? C.noText : C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.label}{r.units ? <span style={{ color: C.text }}> x {fmt.shares(r.units)}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {art(w)}
    </a>
  )
}

function ActiveCard({ x }) {
  const up = x.pnl >= 0
  const tone = up ? 'profit' : 'loss'
  const held = up ? 'win' : 'lose'
  let rows
  if (x.siblings) {
    rows = x.siblings.map(s => s.market_id === x.market_id
      ? { price: x.outcome === 'YES' ? s.price : 100 - s.price, label: x.outcome === 'YES' ? s.label : `Not ${s.label}`, units: x.shares, tone: held }
      : { price: s.price, label: s.label })
    if (!x.siblings.some(s => s.market_id === x.market_id)) rows.unshift({ price: x.price, label: x.outcome === 'YES' ? x.label : `Not ${x.label}`, units: x.shares, tone: held })
  } else {
    rows = ['YES', 'NO'].map(o => ({
      price: o === x.outcome ? x.price : 100 - x.price, label: o === 'YES' ? 'Yes' : 'No', units: o === x.outcome ? x.shares : 0, tone: o === x.outcome ? held : null,
    }))
  }
  const ev = { kind: x.kind, home: x.home, away: x.away, competition: x.competition, state: x.state, starts_at: x.closes_at }
  return (
    <WalletCard tone={tone} href={`#/event/${x.slug}?m=${x.market_id}&o=${x.outcome}`} question={x.question} rows={rows}
      onShare={shareWin(x.question, x.pnl)} art={w => <CardArt ev={ev} w={w} />}
      header={<>
        <Money label={up ? 'Profit' : 'Loss'} cents={x.pnl} strong={up ? C.yesText : C.noText} />
        <span style={{ color: C.lineLight }}>|</span><Money label="Invested" cents={x.cost} strong={up ? C.yesText : C.noText} />
        <span style={{ color: C.lineLight }}>|</span><Money label="Closing" cents={x.value} strong={up ? C.yesText : C.noText} />
      </>} />
  )
}

function PastCard({ s }) {
  const up = s.realized >= 0
  const outcome = s.yes >= s.no ? 'YES' : 'NO'
  const units = Math.max(s.yes, s.no)
  const won = s.outcome === outcome
  const rows = ['YES', 'NO'].map(o => ({
    price: s.outcome === 'VOID' ? 50 : s.outcome === o ? 100 : 0,
    label: o === 'YES' ? (s.grp === 'result' || s.grp === 'winner' ? s.label : 'Yes') : (s.grp === 'result' || s.grp === 'winner' ? `Not ${s.label}` : 'No'),
    units: o === outcome ? units : 0, tone: o === outcome ? (won ? 'win' : s.outcome === 'VOID' ? null : 'lose') : null,
  }))
  const ev = { kind: s.kind, home: s.home, away: s.away, competition: s.event_title, state: 'resolved', home_score: s.home_score, away_score: s.away_score }
  return (
    <WalletCard tone={up ? 'profit' : 'loss'} href={`#/event/${s.slug}`} question={s.question} rows={rows}
      onShare={shareWin(s.question, s.realized)} art={w => <CardArt ev={ev} w={w} />}
      header={<>
        <Money label={up ? 'Profit' : 'Loss'} cents={s.realized} strong={up ? C.yesText : C.noText} />
        <span style={{ color: C.lineLight }}>|</span><Money label="Invested" cents={s.cost} strong={up ? C.yesText : C.noText} />
        <span style={{ color: C.lineLight }}>|</span><Money label="Paid" cents={s.payout} strong={up ? C.yesText : C.noText} />
      </>} />
  )
}
