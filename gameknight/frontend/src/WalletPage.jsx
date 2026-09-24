import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, num } from './theme.js'
import { Button, Card, Empty, ErrorBox, Input, Label, Pill, Sheet, confirmDialog } from './ui.jsx'
import { toast } from './fx.jsx'
import { CONFIG, isReal } from './config.js'

const pounds = p => Math.round(Number(String(p).replace(/[^\d.]/g, '')) * 100)

export default function WalletPage({ user, onChange, onBonus }) {
  const [w, setW] = useState(null)
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null) // deposit | withdraw
  const load = () => api.wallet().then(setW).catch(e => setError(e.message))
  useEffect(() => { load() }, [])
  const refresh = () => { load(); onChange?.() }

  if (!isReal()) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
        <h1 style={{ ...display, fontSize: 28, margin: 0 }}>Wallet</h1>
        <Card style={{ padding: 16, display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>Knight Coins</div>
          <div style={{ ...display, ...num, fontSize: 34 }}>{fmt.kc(user.balance)}</div>
          <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.5 }}>You're playing with Knight Coins: free, play-money credits with no cash value. Real-money play launches once Game Knight is licensed.</div>
          {user.can_claim_bonus && <Button onClick={onBonus}>Claim daily {fmt.kc(CONFIG.daily_bonus)}</Button>}
        </Card>
      </div>
    )
  }
  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!w) return <Empty>Loading wallet…</Empty>
  const verified = w.kyc.status === 'verified'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 14 }}>
      <h1 style={{ ...display, fontSize: 28, margin: 0 }}>Wallet</h1>

      {w.block && verified && <div role="alert" style={{ border: `1px solid ${C.no}`, background: C.noBg, padding: '10px 12px', fontSize: 14 }}>{w.block}. You can still withdraw your balance.</div>}

      <Card style={{ padding: 16, display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>Cash balance</div>
          <div style={{ ...display, ...num, fontSize: 36 }}>{fmt.kc(w.balance)}</div>
          <div style={{ fontSize: 12, color: C.muted, ...num }}>Deposited today {fmt.kc(w.deposited_today)} · net deposits last 30 days {fmt.kc(w.net_deposits_30d)}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Button kind="buy" disabled={!verified || !!w.block} onClick={() => setSheet('deposit')}>Deposit</Button>
          <Button kind="ghost" disabled={!verified || w.balance < CONFIG.min_withdrawal} onClick={() => setSheet('withdraw')}>Withdraw</Button>
        </div>
      </Card>

      {!verified && <VerifyIdentity kyc={w.kyc} onDone={refresh} />}

      <SaferGambling w={w} onDone={refresh} />

      <Card style={{ padding: 14 }}>
        <div style={{ ...display, fontSize: 16, marginBottom: 6 }}>Transactions</div>
        {!w.payments.length && <div style={{ color: C.muted, fontSize: 14 }}>No deposits or withdrawals yet.</div>}
        {w.payments.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: `1px solid ${C.line}`, fontSize: 14, ...num }}>
            <span>{p.kind === 'deposit' ? 'Deposit' : 'Withdrawal'} <span style={{ color: C.muted }}>· {new Date(p.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {p.reason && <div style={{ fontSize: 12, color: C.noText }}>{p.reason}</div>}</span>
            <span style={{ textAlign: 'right' }}>
              <strong style={{ color: p.kind === 'deposit' ? C.yesText : C.text }}>{p.kind === 'deposit' ? '+' : '−'}{fmt.kc(p.amount)}</strong>
              <div style={{ fontSize: 12, color: p.status === 'completed' ? C.muted : p.status === 'failed' ? C.noText : '#eda100', textTransform: 'capitalize' }}>{p.status}</div>
            </span>
          </div>
        ))}
      </Card>

      <MoveMoney kind={sheet} onClose={() => setSheet(null)} w={w} onDone={() => { setSheet(null); refresh() }} />
    </div>
  )
}

function VerifyIdentity({ kyc, onDone }) {
  const [f, setF] = useState({ full_name: '', dob: '', postcode: '', country: 'GB' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = await api.verifyIdentity(f)
      if (r.status === 'verified') { toast('✓ Identity verified. You can now deposit.'); onDone() } else setError(r.reason || 'We could not verify you')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <Card style={{ padding: 16, borderColor: C.accent }}>
      <div style={{ ...display, fontSize: 17 }}>Verify your identity</div>
      <p style={{ fontSize: 14, color: C.text2, margin: '6px 0 12px', lineHeight: 1.5 }}>
        The law requires us to confirm you're 18+ and who you say you are before you deposit or play. We also check the GAMSTOP self-exclusion register.
      </p>
      {kyc.status === 'rejected' && <div style={{ fontSize: 13, color: C.noText, marginBottom: 10 }}>Last attempt: {kyc.reason}</div>}
      <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
        <Input light placeholder="Full legal name" value={f.full_name} onChange={e => setF({ ...f, full_name: e.target.value })} required aria-label="Full legal name" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.muted }}>Date of birth<Input light type="date" value={f.dob} onChange={e => setF({ ...f, dob: e.target.value })} required /></label>
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: C.muted }}>Postcode<Input light value={f.postcode} onChange={e => setF({ ...f, postcode: e.target.value })} required /></label>
        </div>
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Verify me'}</Button>
      </form>
    </Card>
  )
}

function MoveMoney({ kind, onClose, w, onDone }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('open_banking')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setAmount(''); setError('') }, [kind])
  const submit = async () => {
    setBusy(true); setError('')
    try {
      const p = kind === 'deposit' ? await api.deposit(pounds(amount), method) : await api.withdraw(pounds(amount))
      if (p.redirect_url) { window.location.href = p.redirect_url; return }
      if (p.status === 'failed') setError(p.reason || 'The payment failed')
      else { toast(p.status === 'completed' ? `✓ ${kind === 'deposit' ? 'Deposited' : 'Withdrawal sent:'} ${fmt.kc(p.amount)}` : `${fmt.kc(p.amount)} ${kind} is processing`); onDone() }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Sheet open={!!kind} onClose={onClose} title={kind === 'deposit' ? 'Deposit' : 'Withdraw'}>
      <div style={{ display: 'grid', gap: 12 }}>
        {kind === 'deposit' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Pill active={method === 'open_banking'} onClick={() => setMethod('open_banking')}>Pay by bank</Pill>
            <Pill active={method === 'debit_card'} onClick={() => setMethod('debit_card')}>Debit card</Pill>
          </div>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.field, color: C.fieldInk, padding: '0 12px', fontWeight: 800, fontSize: 22 }}>
          £<input inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" aria-label="Amount in pounds"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: C.fieldInk, fontSize: 22, fontWeight: 800, padding: '12px 0', ...num }} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          {(kind === 'deposit' ? [10, 20, 50, 100] : [Math.floor(w.balance / 100)]).map(v => (
            <Pill key={v} onClick={() => setAmount(String(v))} style={{ flex: 1 }}>{kind === 'withdraw' ? `All £${v}` : `£${v}`}</Pill>
          ))}
        </div>
        {kind === 'deposit' && w.limits && (w.limits.day || w.limits.week || w.limits.month) && (
          <div style={{ fontSize: 13, color: C.muted }}>Your limits: {[['day', 'daily'], ['week', 'weekly'], ['month', 'monthly']].filter(([k]) => w.limits[k]).map(([k, t]) => `${fmt.kc(w.limits[k])} ${t}`).join(' · ')}</div>
        )}
        <ErrorBox>{error}</ErrorBox>
        <Button kind={kind === 'deposit' ? 'buy' : 'primary'} onClick={submit} disabled={busy || !pounds(amount)} style={{ padding: 13 }}>
          {busy ? 'Processing…' : kind === 'deposit' ? `Deposit £${amount || '0'}` : `Withdraw £${amount || '0'}`}
        </Button>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          {kind === 'deposit' ? 'Credit cards cannot be used for gambling in Great Britain. Customer funds are held in segregated accounts.' : 'Withdrawals go back to the account you deposited from.'}
        </div>
      </div>
    </Sheet>
  )
}

function SaferGambling({ w, onDone }) {
  const [lim, setLim] = useState({ day: w.limits?.day ? w.limits.day / 100 : '', week: w.limits?.week ? w.limits.week / 100 : '', month: w.limits?.month ? w.limits.month / 100 : '' })
  const [error, setError] = useState('')
  const save = async () => {
    setError('')
    try {
      const body = Object.fromEntries(Object.entries(lim).map(([k, v]) => [k, v === '' ? null : pounds(v)]))
      const r = await api.setLimits(body)
      toast(r.applied ? '✓ Deposit limits saved' : `Limit increase takes effect after 24 hours (${new Date(r.effective_at).toLocaleString('en-GB')})`)
      onDone()
    } catch (e) { setError(e.message) }
  }
  const pause = async (hours, label) => {
    if (!(await confirmDialog(`Take a break for ${label}? You won't be able to deposit or play until it ends. Open orders will be cancelled.`, 'Take a break'))) return
    await api.takeBreak(hours); toast(`Break started: ${label}`); onDone()
  }
  const exclude = async (months, label) => {
    if (!(await confirmDialog(`Self-exclude for ${label}? This cannot be reversed early. You can still withdraw your balance.`, 'Self-exclude'))) return
    await api.selfExclude(months); toast(`Self-exclusion active for ${label}`); onDone()
  }
  return (
    <Card style={{ padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ ...display, fontSize: 17 }}>Safer gambling</div>
      <div>
        <Label>Deposit limits (£)</Label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
          {[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']].map(([k, t]) => (
            <label key={k} style={{ display: 'grid', gap: 4, fontSize: 12, color: C.muted }}>{t}
              <Input value={lim[k]} inputMode="decimal" placeholder="No limit" onChange={e => setLim({ ...lim, [k]: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          ))}
        </div>
        {w.limits?.pending && <div style={{ fontSize: 12, color: '#eda100', marginTop: 6 }}>Pending increase takes effect {new Date(w.limits.pending_effective_at).toLocaleString('en-GB')}</div>}
        <ErrorBox>{error}</ErrorBox>
        <Button kind="quiet" onClick={save} style={{ marginTop: 8 }}>Save limits</Button>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Lower limits apply straight away. Higher limits apply after 24 hours.</div>
      </div>
      <div>
        <Label>Take a break</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[[24, '24 hours'], [168, '7 days'], [720, '30 days'], [1440, '60 days']].map(([h, t]) => <Pill key={h} onClick={() => pause(h, t)}>{t}</Pill>)}
        </div>
      </div>
      <div>
        <Label>Self-exclude</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[[6, '6 months'], [12, '1 year'], [60, '5 years']].map(([m, t]) => <Pill key={m} onClick={() => exclude(m, t)} style={{ borderColor: C.no }}>{t}</Pill>)}
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
          To block all UK gambling sites at once, register with <a href="https://www.gamstop.co.uk" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>GAMSTOP</a>.
          Free, confidential support: <a href="https://www.begambleaware.org" target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>BeGambleAware.org</a> · National Gambling Helpline 0808 8020 133.
        </div>
      </div>
    </Card>
  )
}
