import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, fmt, useIsMobile } from './theme.js'
import { Card, Empty, ErrorBox, Heading, Label, Stat, StateBadge } from './ui.jsx'

export default function PortfolioPage() {
  const [p, setP] = useState(null)
  const [error, setError] = useState('')
  const mobile = useIsMobile()
  useEffect(() => { api.portfolio().then(setP).catch(e => setError(e.message)) }, [])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!p) return <Card><Empty>Loading portfolio…</Empty></Card>

  const tone = n => (n > 0 ? C.good : n < 0 ? C.bad : C.text)
  return (
    <div>
      <Heading>{p.username}'s portfolio</Heading>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <Stat label="Cash" value={fmt.coinsShort(p.balance)} sub="Knight Coins available" />
        <Stat label="In play" value={fmt.coinsShort(p.positions_value)} sub={`${p.open.length} open position${p.open.length === 1 ? '' : 's'} at market price`} />
        <Stat label="Net worth" value={fmt.coinsShort(p.net_worth)} />
        <Stat label="All-time P&L" value={fmt.signed(p.profit)} tone={tone(p.profit)} sub="vs. coins received" />
      </div>

      <Label>Open positions</Label>
      <Card style={{ marginBottom: 24, overflow: 'hidden' }}>
        {!p.open.length && <Empty>No open positions. <a href="#/" style={{ color: C.accent }}>Find a match →</a></Empty>}
        {p.open.map((o, i) => (
          <a key={o.outcome_id} href={`#/match/${o.fixture_id}`} style={{
            display: 'grid', gridTemplateColumns: mobile ? '1fr auto' : 'minmax(0,2fr) 1fr 1fr 1fr', gap: 12, alignItems: 'center',
            padding: '12px 16px', borderTop: i ? `1px solid ${C.line}` : 'none',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{o.outcome} <span style={{ color: C.muted, fontWeight: 400 }}>· {o.question}</span></div>
              <div style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                <span>{o.fixture}</span><span>{fmt.kickoff(o.kickoff)}</span><StateBadge state={o.state} />
              </div>
            </div>
            {!mobile && <Cell k="Shares" v={fmt.shares(o.shares)} />}
            {!mobile && <Cell k="Price" v={fmt.pct(o.price)} />}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt.coins(o.value)}</div>
              <div style={{ fontSize: 12, color: tone(o.unrealized) }}>{fmt.signed(o.unrealized)}</div>
            </div>
          </a>
        ))}
      </Card>

      <Label>Settled</Label>
      <Card style={{ overflow: 'hidden' }}>
        {!p.settled.length && <Empty>Nothing settled yet.</Empty>}
        {p.settled.map((s, i) => (
          <a key={i} href={`#/match/${s.fixture_id}`} style={{
            display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '12px 16px',
            borderTop: i ? `1px solid ${C.line}` : 'none',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>
                {s.status === 'void' ? '↺' : s.won ? '✓' : '✗'} {s.outcome} <span style={{ color: C.muted, fontWeight: 400 }}>· {s.question}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {s.home} {s.status === 'settled' ? `${s.home_score}–${s.away_score}` : 'v'} {s.away} {s.status === 'void' && '· void, refunded'}
              </div>
            </div>
            <div style={{ fontWeight: 700, color: tone(s.realized), fontVariantNumeric: 'tabular-nums' }}>{fmt.signed(s.realized)}</div>
          </a>
        ))}
      </Card>
    </div>
  )
}

function Cell({ k, v }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted }}>{k}</div>
      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  )
}
