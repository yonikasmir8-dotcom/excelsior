import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, fmt, useIsMobile } from './theme.js'
import { Button, Card, Empty, ErrorBox, Heading, Input, Label, StateBadge } from './ui.jsx'

const blank = { competition: 'Premier League', home: '', away: '', kickoff: '', home_p: 40, draw_p: 27, away_p: 33, over25: 50, btts: 50, liquidity: 250 }

export default function AdminPage() {
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [fixtures, setFixtures] = useState([])
  const mobile = useIsMobile()

  const load = async () => {
    const [open, awaiting] = await Promise.all([api.fixtures('open'), api.fixtures('awaiting')])
    setFixtures([...awaiting, ...open])
  }
  useEffect(() => { load().catch(e => setError(e.message)) }, [])

  const set = k => e => setForm({ ...form, [k]: e.target.value })
  const sum1x2 = Number(form.home_p) + Number(form.draw_p) + Number(form.away_p)

  const create = async e => {
    e.preventDefault(); setError(''); setMsg('')
    try {
      const f = await api.createFixture({
        competition: form.competition, home: form.home, away: form.away, kickoff: new Date(form.kickoff).toISOString(),
        liquidity: Number(form.liquidity),
        probs: {
          home: form.home_p / sum1x2, draw: form.draw_p / sum1x2, away: form.away_p / sum1x2,
          over25: form.over25 / 100, btts: form.btts / 100,
        },
      })
      setMsg(`Created ${f.home} v ${f.away}`); setForm({ ...blank, competition: form.competition }); load()
    } catch (err) { setError(err.message) }
  }

  return (
    <div>
      <Heading>Admin</Heading>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : '380px minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        <Card style={{ padding: 16 }}>
          <Label>New fixture</Label>
          <form onSubmit={create} style={{ display: 'grid', gap: 10 }}>
            <Input placeholder="Competition" value={form.competition} onChange={set('competition')} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Input placeholder="Home team" value={form.home} onChange={set('home')} required />
              <Input placeholder="Away team" value={form.away} onChange={set('away')} required />
            </div>
            <div>
              <Label>Kick-off (your local time)</Label>
              <Input type="datetime-local" value={form.kickoff} onChange={set('kickoff')} required />
            </div>
            <div>
              <Label>Opening odds — home / draw / away (%)</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <Input type="number" min="1" value={form.home_p} onChange={set('home_p')} />
                <Input type="number" min="1" value={form.draw_p} onChange={set('draw_p')} />
                <Input type="number" min="1" value={form.away_p} onChange={set('away_p')} />
              </div>
              {sum1x2 !== 100 && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Sums to {sum1x2}% — will be normalised to 100%.</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div><Label>Over 2.5 %</Label><Input type="number" min="1" max="99" value={form.over25} onChange={set('over25')} /></div>
              <div><Label>BTTS yes %</Label><Input type="number" min="1" max="99" value={form.btts} onChange={set('btts')} /></div>
              <div><Label>Liquidity</Label><Input type="number" min="10" value={form.liquidity} onChange={set('liquidity')} /></div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
              Liquidity (b) sets how much a trade moves the price. House subsidy per market is at most b × ln(outcomes).
            </div>
            <ErrorBox>{error}</ErrorBox>
            {msg && <div style={{ color: C.good, fontSize: 14 }}>✓ {msg}</div>}
            <Button type="submit">Create fixture + 3 markets</Button>
          </form>
        </Card>

        <div style={{ display: 'grid', gap: 10 }}>
          <Label>Settle or void</Label>
          {!fixtures.length && <Card><Empty>No open fixtures.</Empty></Card>}
          {fixtures.map(f => <SettleRow key={f.id} f={f} onDone={load} />)}
        </div>
      </div>
    </div>
  )
}

function SettleRow({ f, onDone }) {
  const [h, setH] = useState('')
  const [a, setA] = useState('')
  const [error, setError] = useState('')
  const act = async fn => {
    setError('')
    try { await fn(); onDone() } catch (e) { setError(e.message) }
  }
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <a href={`#/match/${f.id}`} style={{ fontWeight: 600 }}>{f.home} v {f.away}</a>
        <span style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 10 }}>{f.competition} · {fmt.kickoff(f.kickoff)} <StateBadge state={f.state} /></span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Input type="number" min="0" placeholder="Home" value={h} onChange={e => setH(e.target.value)} style={{ width: 80 }} aria-label={`${f.home} goals`} />
        <span style={{ color: C.muted }}>–</span>
        <Input type="number" min="0" placeholder="Away" value={a} onChange={e => setA(e.target.value)} style={{ width: 80 }} aria-label={`${f.away} goals`} />
        <Button disabled={h === '' || a === ''} onClick={() => {
          if (confirm(`Settle ${f.home} ${h}–${a} ${f.away}? This pays out all markets and can't be undone.`)) act(() => api.settle(f.id, Number(h), Number(a)))
        }}>Settle</Button>
        <Button kind="danger" onClick={() => {
          if (confirm(`Void ${f.home} v ${f.away}? All stakes are refunded.`)) act(() => api.voidFixture(f.id))
        }}>Void</Button>
      </div>
      {error && <div style={{ marginTop: 8 }}><ErrorBox>{error}</ErrorBox></div>}
    </Card>
  )
}
