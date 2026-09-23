import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, useIsMobile } from './theme.js'
import { Card, Empty, ErrorBox, Heading } from './ui.jsx'

export default function LeaderboardPage({ me }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const mobile = useIsMobile()
  useEffect(() => { api.leaderboard().then(setRows).catch(e => setError(e.message)) }, [])

  if (error) return <ErrorBox>{error}</ErrorBox>
  const cols = mobile ? '44px minmax(0,1fr) auto' : '56px minmax(0,1fr) 90px 140px 140px'
  return (
    <div>
      <Heading style={{ marginBottom: 4 }}>The table</Heading>
      <p style={{ color: C.muted, marginTop: 0, fontSize: 14 }}>Ranked by profit — net worth (cash + open positions at market price) minus coins received.</p>
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 16px', fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.line}` }}>
          <span>Pos</span><span>Manager</span>{!mobile && <span style={{ textAlign: 'right' }}>Trades</span>}
          {!mobile && <span style={{ textAlign: 'right' }}>Net worth</span>}<span style={{ textAlign: 'right' }}>Profit</span>
        </div>
        {!rows && <Empty>Loading…</Empty>}
        {rows && !rows.length && <Empty>No one has traded yet.</Empty>}
        {rows?.map(r => {
          const isMe = me && r.username === me.username
          return (
            <div key={r.username} style={{
              display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '12px 16px',
              borderTop: `1px solid ${C.line}`, background: isMe ? `${C.accent}12` : 'transparent',
            }}>
              <span style={{ ...display, fontSize: 22, fontWeight: 800, color: r.rank <= 3 ? C.accent : C.text2 }}>{r.rank}</span>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.username}
                {r.is_bot && <span style={{ fontSize: 10, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 4, padding: '1px 5px', marginLeft: 8 }}>BOT</span>}
                {isMe && <span style={{ fontSize: 10, color: C.accent, marginLeft: 8 }}>YOU</span>}
              </span>
              {!mobile && <span style={{ textAlign: 'right', color: C.text2 }}>{r.trades}</span>}
              {!mobile && <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt.coinsShort(r.net_worth)}</span>}
              <span style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: r.profit > 0 ? C.good : r.profit < 0 ? C.bad : C.text }}>
                {fmt.signed(r.profit)}
              </span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
