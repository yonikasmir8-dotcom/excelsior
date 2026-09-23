import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, fmt, useIsMobile } from './theme.js'
import { Button, Card, Empty, ErrorBox, Heading, Input, Label, Segmented, StateBadge } from './ui.jsx'

export default function AdminPage() {
  const [mode, setMode] = useState('match')
  const [events, setEvents] = useState([])
  const [health, setHealth] = useState(null)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const mobile = useIsMobile()

  const load = async () => {
    const [open, closed] = await Promise.all([api.events({ status: 'closed', sort: 'ending' }), api.events({ status: 'open', sort: 'ending' })])
    setEvents([...open, ...closed])
    api.admin.health().then(setHealth).catch(() => {})
  }
  useEffect(() => { load().catch(e => setError(e.message)) }, [])
  const run = async (fn, ok) => { setError(''); setMsg(''); try { const r = await fn(); setMsg(ok(r)); load() } catch (e) { setError(e.message) } }

  return (
    <div>
      <Heading>Admin</Heading>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        {health && (
          <span style={{ fontSize: 13, color: health.ok ? C.yes : C.no, fontWeight: 700 }}>
            {health.ok ? '✓ Ledger reconciled · all markets balanced' : `⚠ ${health.ledger_mismatch.length} ledger mismatches, ${health.unbalanced_markets.length} unbalanced markets`}
          </span>
        )}
        {health?.house && <span style={{ fontSize: 13, color: C.muted }}>House MM P&L {fmt.signed(health.house.profit)} KC · {fmt.kcShort(health.house.in_orders)} KC quoting</span>}
        <Button kind="ghost" style={{ marginLeft: 'auto' }} onClick={() => run(api.admin.syncFeed, r => `Feed: ${r.created} created, ${r.resolved} resolved, ${r.voided} voided`)}>Sync fixtures feed</Button>
      </div>
      {msg && <div style={{ color: C.yes, marginBottom: 12 }}>✓ {msg}</div>}
      <ErrorBox>{error}</ErrorBox>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : '400px minmax(0,1fr)', gap: 20, alignItems: 'start', marginTop: 12 }}>
        <Card style={{ padding: 16 }}>
          <Segmented value={mode} onChange={setMode} options={[['match', 'New match'], ['outright', 'New outright']]} style={{ marginBottom: 14 }} />
          {mode === 'match' ? <MatchForm run={run} /> : <OutrightForm run={run} />}
        </Card>
        <div style={{ display: 'grid', gap: 10 }}>
          <Label>Resolve · closed events first</Label>
          {!events.length && <Card><Empty>No open events.</Empty></Card>}
          {events.map(ev => <ResolveRow key={ev.id} ev={ev} run={run} />)}
        </div>
      </div>
    </div>
  )
}

function MatchForm({ run }) {
  const [f, setF] = useState({ competition: 'Premier League', home: '', away: '', kickoff: '', xg_home: '1.5', xg_away: '1.2' })
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const submit = e => {
    e.preventDefault()
    run(() => api.admin.createMatch({ ...f, kickoff: new Date(f.kickoff).toISOString(), xg_home: Number(f.xg_home), xg_away: Number(f.xg_away) }),
      ev => `Listed ${ev.title} — ${ev.markets.length} markets, house quoting`)
  }
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
      <Input placeholder="Competition" value={f.competition} onChange={set('competition')} required />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Input placeholder="Home team" value={f.home} onChange={set('home')} required />
        <Input placeholder="Away team" value={f.away} onChange={set('away')} required />
      </div>
      <div><Label>Kick-off (local time)</Label><Input type="datetime-local" value={f.kickoff} onChange={set('kickoff')} required /></div>
      <div>
        <Label>Expected goals — home / away</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Input type="number" step="0.05" min="0.1" max="5" value={f.xg_home} onChange={set('xg_home')} />
          <Input type="number" step="0.05" min="0.1" max="5" value={f.xg_away} onChange={set('xg_away')} />
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
          Opening prices for all 7 markets (1X2, O/U 1.5/2.5/3.5, BTTS) come from a Poisson model on these. The house market maker quotes around them; the crowd takes it from there.
        </div>
      </div>
      <Button type="submit">List match</Button>
    </form>
  )
}

function OutrightForm({ run }) {
  const [f, setF] = useState({ competition: 'Premier League', title: '', question: 'Will {name} win?', closes_at: '', lines: 'Arsenal, 30\nLiverpool, 25\nManchester City, 25\nOther, 20' })
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const submit = e => {
    e.preventDefault()
    const contenders = f.lines.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [name, prob] = l.split(/,(?=[^,]*$)/)
      return { name: name.trim(), prob: Number(prob) || 1 }
    })
    run(() => api.admin.createOutright({ ...f, closes_at: new Date(f.closes_at).toISOString(), contenders }), ev => `Listed ${ev.title} — ${ev.markets.length} contenders`)
  }
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
      <Input placeholder="Competition" value={f.competition} onChange={set('competition')} required />
      <Input placeholder="Title, e.g. Premier League 2026/27 winner" value={f.title} onChange={set('title')} required />
      <Input placeholder="Question template — {name} is replaced" value={f.question} onChange={set('question')} />
      <div><Label>Trading closes</Label><Input type="datetime-local" value={f.closes_at} onChange={set('closes_at')} required /></div>
      <div>
        <Label>Contenders — "name, opening %" per line</Label>
        <textarea value={f.lines} onChange={set('lines')} rows={7}
          style={{ width: '100%', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
      </div>
      <Button type="submit">List outright</Button>
    </form>
  )
}

function ResolveRow({ ev, run }) {
  const [h, setH] = useState('')
  const [a, setA] = useState('')
  const [winner, setWinner] = useState('')
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <a href={`#/event/${ev.slug}`} style={{ fontWeight: 700 }}>{ev.title}</a>
        <span style={{ fontSize: 12, color: C.muted, display: 'flex', gap: 10 }}>{ev.competition} · {fmt.kickoff(ev.closes_at)} <StateBadge state={ev.state} /></span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {ev.kind === 'match' ? (
          <>
            <Input type="number" min="0" placeholder={ev.home} value={h} onChange={e => setH(e.target.value)} style={{ width: 90 }} aria-label={`${ev.home} goals`} />
            <span style={{ color: C.muted }}>–</span>
            <Input type="number" min="0" placeholder={ev.away} value={a} onChange={e => setA(e.target.value)} style={{ width: 90 }} aria-label={`${ev.away} goals`} />
            <Button disabled={h === '' || a === ''} onClick={() => confirm(`Resolve ${ev.home} ${h}–${a} ${ev.away}? Pays out all 7 markets; cannot be undone.`)
              && run(() => api.admin.resolve(ev.id, { home_score: Number(h), away_score: Number(a) }), r => `Resolved — paid ${fmt.kc(r.paid)}`)}>Resolve</Button>
          </>
        ) : (
          <>
            <select value={winner} onChange={e => setWinner(e.target.value)} style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 10px' }}>
              <option value="">Winner…</option>
              {ev.markets.filter(m => m.status === 'open').map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <Button disabled={!winner} onClick={() => confirm('Resolve this outright? Cannot be undone.')
              && run(() => api.admin.resolve(ev.id, { winner_market_id: Number(winner) }), r => `Resolved — paid ${fmt.kc(r.paid)}`)}>Resolve</Button>
            <Button kind="ghost" disabled={!winner} title="Eliminate this contender (resolve NO) without closing the event"
              onClick={() => run(() => api.admin.resolveMarket(Number(winner), 'NO'), () => 'Contender eliminated')}>Eliminate</Button>
          </>
        )}
        <Button kind="danger" onClick={() => confirm(`Void ${ev.title}? Every share pays 50¢.`) && run(() => api.admin.voidEvent(ev.id), () => 'Voided')}>Void</Button>
      </div>
    </Card>
  )
}
