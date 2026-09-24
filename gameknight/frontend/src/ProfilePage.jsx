import React, { useEffect, useState } from 'react'
import { api, STANDALONE } from './api.js'
import { C, GRADIENT, display, fmt, num, share } from './theme.js'
import { Button, Card, Empty, ErrorBox, Icon, Tabs, notify } from './ui.jsx'
import { tagName, useFollows } from './opinion.jsx'

export default function ProfilePage({ username, me, onLogout, onBonus }) {
  const [p, setP] = useState(null)
  const [tab, setTab] = useState('positions')
  const [error, setError] = useState('')
  const [follows, toggle] = useFollows()
  const isMe = me && me.username.toLowerCase() === username.toLowerCase()
  useEffect(() => { api.profile(username).then(setP).catch(e => setError(e.message)) }, [username])
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!p) return <Empty>Loading…</Empty>

  const shareProfile = async () => {
    const r = await share({ title: `${p.username} on Game Knight`, path: `/u/${encodeURIComponent(p.username)}` })
    if (r === 'copied') notify('Profile link copied.')
    else if (r !== 'shared' && r !== 'cancelled') notify(`Share this link: ${r}`)
  }
  const value = p.positions.reduce((s, x) => s + x.value, 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 66, height: 66, borderRadius: 99, padding: 3, background: GRADIENT, flexShrink: 0 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: 99, background: C.bg, display: 'grid', placeItems: 'center', ...display, fontSize: 28 }}>{p.username[0].toUpperCase()}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ ...display, fontSize: 26, margin: 0, overflowWrap: 'anywhere' }}>
            {p.username} {p.is_house && <span style={{ fontSize: 12, color: C.accent }}>MARKET MAKER</span>}{p.is_bot && !p.is_house && <span style={{ fontSize: 12, color: C.muted }}>BOT</span>}
          </h1>
          <div style={{ color: C.muted, fontSize: 13 }}>Joined {fmt.date(p.joined)}</div>
          {p.bio && <div style={{ color: C.text2, fontSize: 14, marginTop: 4 }}>{p.bio}</div>}
        </div>
        <button onClick={shareProfile} aria-label="Share profile" style={{ background: 'none', border: `1px solid ${C.text}`, color: C.text, padding: 8, cursor: 'pointer', display: 'grid' }}><Icon name="share" size={18} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', border: `1px solid ${C.line}`, background: C.surface }}>
        {[['In opinions', fmt.kc(value)], ['Profit / loss', p.profit == null ? '—' : fmt.signed(p.profit), p.profit >= 0 ? C.yesText : C.noText], ['Volume traded', fmt.kcShort(p.volume)], ['Opinions backed', fmt.shares(p.markets_traded)]].map(([k, v, tone], i) => (
          <div key={k} style={{ padding: '12px 14px', borderRight: i % 2 === 0 ? `1px solid ${C.line}` : 'none', borderTop: i > 1 ? `1px solid ${C.line}` : 'none' }}>
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{k}</div>
            <div style={{ ...display, ...num, fontSize: 20, color: tone || C.text, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      {isMe && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
            <a href="#/wallet" style={{ gridColumn: '1 / -1' }}><Button style={{ width: '100%' }}>Wallet{STANDALONE ? '' : ' & safer gambling'}</Button></a>
            <a href="#/leaderboard"><Button kind="ghost" style={{ width: '100%' }}>Leaderboard</Button></a>
            <a href="#/settings"><Button kind="ghost" style={{ width: '100%' }}>{STANDALONE ? 'Settings' : 'Settings & API'}</Button></a>
            {me.can_claim_bonus && <Button onClick={onBonus} style={{ gridColumn: '1 / -1' }}>Claim daily {fmt.kc(10000)}</Button>}
            {me.is_admin && <a href="#/admin" style={{ gridColumn: '1 / -1' }}><Button kind="quiet" style={{ width: '100%' }}>Admin: list and settle opinions</Button></a>}
          </div>
          <Card style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: C.accent, marginBottom: 8 }}><Icon name="star" size={15} color={C.accent} />Your #follows</div>
            {!follows.length && <div style={{ fontSize: 14, color: C.muted }}>Follow teams, players and leagues from the chips on Home to tailor your feed.</div>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {follows.map(t => (
                <button key={t} onClick={() => toggle(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.surface2, border: `1px solid ${C.line}`, color: C.text, padding: '6px 10px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  {t.startsWith('event:') ? 'Match watch' : tagName(t)} <Icon name="x" size={13} />
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      <Card style={{ padding: '0 14px 8px' }}>
        <Tabs value={tab} onChange={setTab} tabs={[['positions', 'Active opinions'], ['activity', 'Activity']]} />
        {tab === 'positions' && (
          <div>
            {!p.positions.length && <Empty>No active opinions.</Empty>}
            {p.positions.slice(0, 50).map(x => (
              <a key={`${x.market_id}${x.outcome}`} href={`#/event/${x.slug}?m=${x.market_id}&o=${x.outcome}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
                <span style={{ minWidth: 0 }}><strong style={{ color: x.outcome === 'YES' ? C.yesText : C.noText }}>{x.outcome === 'YES' ? 'Yes' : 'No'}</strong> · {x.question}</span>
                <span style={{ whiteSpace: 'nowrap', ...num }}>x {fmt.shares(x.shares)} · <span style={{ color: x.pnl >= 0 ? C.yesText : C.noText }}>{fmt.signed(x.pnl)}</span></span>
              </a>
            ))}
          </div>
        )}
        {tab === 'activity' && (
          <div>
            {!p.recent.length && <Empty>No trades yet.</Empty>}
            {p.recent.map((t, i) => (
              <a key={i} href={`#/event/${t.slug}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
                <span style={{ minWidth: 0 }}>{t.side === 'buy' ? 'Backed' : 'Sold'} <strong style={{ color: t.outcome === 'YES' ? C.yesText : C.noText }}>{t.outcome === 'YES' ? '' : 'against '}{t.label}</strong> x {fmt.shares(t.size)} <span style={{ color: C.muted }}>· {t.event_title}</span></span>
                <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>{fmt.ago(t.created_at)}</span>
              </a>
            ))}
          </div>
        )}
      </Card>

      {isMe && <Button kind="danger" onClick={onLogout}>Sign out</Button>}
    </div>
  )
}
