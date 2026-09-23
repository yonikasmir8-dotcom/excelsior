import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, num, useIsMobile } from './theme.js'
import { Card, Empty, ErrorBox, Heading, Segmented, UserLink } from './ui.jsx'

export default function LeaderboardPage({ me }) {
  const [by, setBy] = useState('profit')
  const [period, setPeriod] = useState('all')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const mobile = useIsMobile()
  useEffect(() => { setRows(null); api.leaderboard(by, period).then(setRows).catch(e => setError(e.message)) }, [by, period])

  const cols = mobile ? '40px minmax(0,1fr) auto' : '56px minmax(0,1fr) 150px 150px'
  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <Heading style={{ marginBottom: 4 }}>Leaderboard</Heading>
      <p style={{ color: C.muted, marginTop: 0, fontSize: 14 }}>Profit = portfolio value minus coins received. Volume = KC traded.</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <Segmented value={by} onChange={setBy} options={[['profit', 'Profit'], ['volume', 'Volume']]} style={{ width: 200 }} />
        {by === 'volume' && <Segmented value={period} onChange={setPeriod} options={[['all', 'All time'], ['week', 'This week']]} style={{ width: 220 }} />}
      </div>
      <ErrorBox>{error}</ErrorBox>
      <Card style={{ overflow: 'hidden' }}>
        {!rows && <Empty>Loading…</Empty>}
        {rows && !rows.length && <Empty>No traders yet.</Empty>}
        {rows?.map(r => {
          const isMe = me && r.username === me.username
          return (
            <div key={r.username} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: r.rank > 1 ? `1px solid ${C.line}` : 'none', background: isMe ? `${C.accent}12` : 'transparent' }}>
              <span style={{ ...display, fontSize: 22, fontWeight: 800, color: r.rank <= 3 ? C.accent : C.text2 }}>{r.rank}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <UserLink name={r.username} />
                {r.is_bot && <span style={{ fontSize: 10, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 4, padding: '1px 5px', marginLeft: 8 }}>BOT</span>}
                {isMe && <span style={{ fontSize: 10, color: C.accent, marginLeft: 8 }}>YOU</span>}
              </span>
              {!mobile && <span style={{ textAlign: 'right', color: C.text2, ...num }}>{by === 'profit' ? `${fmt.kcShort(r.volume)} vol` : <span style={{ color: r.profit >= 0 ? C.yes : C.no }}>{fmt.signed(r.profit)}</span>}</span>}
              <span style={{ textAlign: 'right', fontWeight: 800, ...num, color: by === 'profit' ? (r.profit >= 0 ? C.yes : C.no) : C.text }}>
                {by === 'profit' ? fmt.signed(r.profit) : `${fmt.kcShort(r.volume)} KC`}
              </span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}
