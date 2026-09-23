import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, num } from './theme.js'
import { Card, Empty, ErrorBox, Stat, Tabs } from './ui.jsx'

export default function ProfilePage({ username }) {
  const [p, setP] = useState(null)
  const [tab, setTab] = useState('positions')
  const [error, setError] = useState('')
  useEffect(() => { api.profile(username).then(setP).catch(e => setError(e.message)) }, [username])
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!p) return <Card><Empty>Loading…</Empty></Card>

  const share = () => { navigator.clipboard?.writeText(window.location.href); alert('Profile link copied') }
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: 99, background: `linear-gradient(135deg, ${C.accent}, #199e70)`, display: 'grid', placeItems: 'center', ...display, fontSize: 32, fontWeight: 800, color: C.accentInk }}>
          {p.username[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ ...display, fontSize: 34, fontWeight: 800, margin: 0 }}>
            {p.username} {p.is_house && <span style={{ fontSize: 14, color: C.accent }}>MARKET MAKER</span>}{p.is_bot && !p.is_house && <span style={{ fontSize: 14, color: C.muted }}>BOT</span>}
          </h1>
          <div style={{ color: C.muted, fontSize: 13 }}>Joined {fmt.date(p.joined)}</div>
          {p.bio && <div style={{ color: C.text2, fontSize: 14, marginTop: 4 }}>{p.bio}</div>}
        </div>
        <button onClick={share} style={{ background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 12px', cursor: 'pointer', fontWeight: 600 }}>Share</button>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <Stat label="Positions value" value={fmt.kcShort(p.positions.reduce((s, x) => s + x.value, 0))} />
        {p.profit != null && <Stat label="Profit / loss" value={fmt.signed(p.profit)} tone={p.profit >= 0 ? C.yes : C.no} />}
        <Stat label="Volume traded" value={fmt.kcShort(p.volume)} />
        <Stat label="Markets traded" value={p.markets_traded} />
      </div>
      <Card style={{ padding: '0 16px 8px' }}>
        <Tabs value={tab} onChange={setTab} tabs={[['positions', 'Positions'], ['activity', 'Activity']]} />
        {tab === 'positions' && (
          <div>
            {!p.positions.length && <Empty>No open positions.</Empty>}
            {p.positions.slice(0, 50).map(x => (
              <a key={`${x.market_id}${x.outcome}`} href={`#/event/${x.slug}?m=${x.market_id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
                <span style={{ minWidth: 0 }}><strong style={{ color: x.outcome === 'YES' ? C.yes : C.no }}>{x.outcome === 'YES' ? 'Yes' : 'No'}</strong> · {x.question}</span>
                <span style={{ whiteSpace: 'nowrap', ...num }}>{fmt.shares(x.shares)} · <span style={{ color: x.pnl >= 0 ? C.yes : C.no }}>{fmt.signed(x.pnl)}</span></span>
              </a>
            ))}
          </div>
        )}
        {tab === 'activity' && (
          <div>
            {!p.recent.length && <Empty>No trades yet.</Empty>}
            {p.recent.map((t, i) => (
              <a key={i} href={`#/event/${t.slug}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
                <span style={{ minWidth: 0 }}>{t.side === 'buy' ? 'Bought' : 'Sold'} <strong style={{ color: t.outcome === 'YES' ? C.yes : C.no }}>{fmt.shares(t.size)} {t.outcome === 'YES' ? 'Yes' : 'No'}</strong> · {t.label} <span style={{ color: C.muted }}>· {t.event_title}</span></span>
                <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>{fmt.ago(t.created_at)}</span>
              </a>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
