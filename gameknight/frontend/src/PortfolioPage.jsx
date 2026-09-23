import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, fmt, num, useIsMobile, useLive } from './theme.js'
import { Card, Empty, ErrorBox, Heading, Stat, StateBadge, Tabs } from './ui.jsx'

export default function PortfolioPage({ onChange }) {
  const [p, setP] = useState(null)
  const [orders, setOrders] = useState([])
  const [tab, setTab] = useState('positions')
  const [error, setError] = useState('')
  const mobile = useIsMobile()

  const load = () => Promise.all([api.portfolio(), api.orders()]).then(([pf, os]) => { setP(pf); setOrders(os) }).catch(e => setError(e.message))
  useEffect(() => { load() }, [])
  useLive(m => m.type === 'trade' || m.type === 'event', load)

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!p) return <Card><Empty>Loading portfolio…</Empty></Card>

  const tone = n => (n > 0 ? C.yes : n < 0 ? C.no : C.text)
  const cancel = async id => { await api.cancelOrder(id); load(); onChange?.() }
  const cols = mobile ? 'minmax(0,1fr) auto' : 'minmax(0,2.2fr) 1fr 1fr 1fr 1.1fr'

  return (
    <div>
      <Heading>Portfolio</Heading>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Stat label="Portfolio value" value={fmt.kcShort(p.portfolio)} sub="Cash + orders + positions at market" />
        <Stat label="Cash" value={fmt.kcShort(p.cash)} sub={p.in_orders ? `${fmt.kcShort(p.in_orders)} KC in open orders` : 'Available to trade'} />
        <Stat label="All-time P&L" value={fmt.signed(p.profit)} tone={tone(p.profit)} sub="vs. coins received" />
        <Stat label="Volume traded" value={fmt.kcShort(p.volume)} sub={`${p.positions.length} open position${p.positions.length === 1 ? '' : 's'}`} />
      </div>

      <Card style={{ padding: '0 16px 8px' }}>
        <Tabs value={tab} onChange={setTab} tabs={[['positions', `Positions (${p.positions.length})`], ['orders', `Open orders (${orders.length})`], ['history', 'History'], ['settled', 'Resolved']]} />

        {tab === 'positions' && (
          <div>
            {!p.positions.length && <Empty>No open positions. <a href="#/" style={{ color: C.accent }}>Find a market →</a></Empty>}
            {p.positions.length > 0 && !mobile && (
              <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '12px 0 6px', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' }}>
                <span>Market</span><span style={{ textAlign: 'right' }}>Avg → Now</span><span style={{ textAlign: 'right' }}>Shares</span><span style={{ textAlign: 'right' }}>Value</span><span style={{ textAlign: 'right' }}>P&L</span>
              </div>
            )}
            {p.positions.map(x => (
              <a key={`${x.market_id}${x.outcome}`} href={`#/event/${x.slug}?m=${x.market_id}`} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${C.line}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    <span style={{ color: x.outcome === 'YES' ? C.yes : C.no, fontWeight: 800 }}>{x.outcome === 'YES' ? 'Yes' : 'No'}</span> · {x.question}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                    <span>{x.event_title}</span><StateBadge state={x.state} />
                  </div>
                </div>
                {!mobile && <span style={{ textAlign: 'right', ...num }}>{fmt.cents(x.avg_price)} → {x.price}¢</span>}
                {!mobile && <span style={{ textAlign: 'right', ...num }}>{fmt.shares(x.shares)}</span>}
                {!mobile && <span style={{ textAlign: 'right', fontWeight: 700, ...num }}>{fmt.kc(x.value)}</span>}
                <span style={{ textAlign: 'right', ...num }}>
                  {mobile && <div style={{ fontWeight: 700 }}>{fmt.kc(x.value)}</div>}
                  <span style={{ color: tone(x.pnl), fontWeight: 700 }}>{fmt.signed(x.pnl)}</span>
                  <span style={{ color: C.muted, fontSize: 12 }}> ({x.cost ? Math.round((x.pnl / x.cost) * 100) : 0}%)</span>
                </span>
              </a>
            ))}
          </div>
        )}

        {tab === 'orders' && (
          <div>
            {!orders.length && <Empty>No open orders. Limit orders you place will rest here until filled.</Empty>}
            {orders.map(o => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: `1px solid ${C.line}` }}>
                <a href={`#/event/${o.slug}?m=${o.market_id}`} style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    <span style={{ color: o.side === 'buy' ? C.yes : C.no, textTransform: 'capitalize', fontWeight: 800 }}>{o.side}</span> {o.outcome === 'YES' ? 'Yes' : 'No'} · {o.question}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, ...num }}>{fmt.shares(o.filled)}/{fmt.shares(o.size)} filled @ {o.price}¢ · {fmt.ago(o.created_at)}</div>
                </a>
                <button onClick={() => cancel(o.id)} style={{ background: 'none', border: `1px solid ${C.line}`, borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: C.text2 }}>Cancel</button>
              </div>
            ))}
          </div>
        )}

        {tab === 'history' && (
          <div>
            {!p.history.length && <Empty>No trades yet.</Empty>}
            {p.history.map(t => (
              <a key={t.id} href={`#/event/${t.slug}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ color: t.side === 'buy' ? C.yes : C.no, textTransform: 'capitalize' }}>{t.side === 'buy' ? 'Bought' : 'Sold'}</strong>{' '}
                  {fmt.shares(t.size)} {t.outcome === 'YES' ? 'Yes' : 'No'} · {t.label} <span style={{ color: C.muted }}>· {t.event_title}</span>
                </span>
                <span style={{ color: C.text2, whiteSpace: 'nowrap', ...num }}>{fmt.kc(t.cash)} · {fmt.ago(t.created_at)}</span>
              </a>
            ))}
          </div>
        )}

        {tab === 'settled' && (
          <div>
            {!p.settled.length && <Empty>Nothing resolved yet.</Empty>}
            {p.settled.map((s, i) => (
              <a key={i} href={`#/event/${s.slug}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
                <span style={{ minWidth: 0 }}>{s.question} <span style={{ color: C.muted }}>· resolved {s.outcome === 'VOID' ? '50/50' : s.outcome}</span></span>
                <strong style={{ color: tone(s.realized), ...num }}>{fmt.signed(s.realized)}</strong>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
