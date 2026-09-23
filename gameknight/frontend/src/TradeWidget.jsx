import React, { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, num } from './theme.js'
import { Button, Card, ErrorBox, Segmented } from './ui.jsx'

// Polymarket-style order ticket: Buy/Sell × Market/Limit × Yes/No, with a live
// server-side preview (the exact fills the matching engine would produce).
export default function TradeWidget({ market, outcome, setOutcome, user, holdings, onDone, initialPrice, onClose }) {
  const [side, setSide] = useState('buy')
  const [type, setType] = useState('market')
  const [amount, setAmount] = useState('')
  const [shares, setShares] = useState('')
  const [price, setPrice] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const timer = useRef()

  const held = outcome === 'YES' ? holdings?.yes || 0 : holdings?.no || 0
  const yesPx = side === 'buy' ? market.buy_yes : market.best_bid
  const noPx = side === 'buy' ? market.buy_no : market.best_ask == null ? null : 100 - market.best_ask

  useEffect(() => {
    if (initialPrice) { setType('limit'); setPrice(String(initialPrice.price)); setSide(initialPrice.side) }
  }, [initialPrice])
  useEffect(() => { setDone(null) }, [market.id, outcome, side, type])

  const order = () => {
    const base = { market_id: market.id, outcome, side, type }
    if (type === 'limit') return { ...base, price: Number(price), size: Number(shares) }
    if (side === 'buy') return { ...base, amount: Math.round(Number(amount) * 100) }
    return { ...base, size: Number(shares) }
  }
  const ready = type === 'limit' ? Number(price) >= 1 && Number(price) <= 99 && Number(shares) >= 1
    : side === 'buy' ? Number(amount) > 0 : Number(shares) >= 1

  useEffect(() => {
    clearTimeout(timer.current)
    setPreview(null); setError('')
    if (!user || !ready || market.status !== 'open') return
    timer.current = setTimeout(() => api.preview(order()).then(setPreview).catch(e => setError(e.message)), 250)
    return () => clearTimeout(timer.current)
  }, [market.id, outcome, side, type, amount, shares, price, user?.id, market.buy_yes, market.buy_no]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true); setError('')
    try {
      const r = await api.placeOrder(order())
      setDone(r); setAmount(''); setShares(''); setPreview(null)
      onDone?.()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (market.status !== 'open') {
    return <Card style={{ padding: 16 }}><div style={{ color: C.text2, fontSize: 14 }}>This market is {market.status}{market.outcome ? ` — resolved ${market.outcome}` : ''}.</div></Card>
  }

  const outcomeBtn = (o, px) => {
    const active = outcome === o
    const col = o === 'YES' ? C.yes : C.no
    return (
      <button type="button" onClick={() => setOutcome(o)} style={{
        flex: 1, padding: '12px 8px', borderRadius: 8, border: `1px solid ${active ? col : C.line}`, cursor: 'pointer', fontWeight: 800, fontSize: 15,
        background: active ? col : C.surface2, color: active ? C.bg : C.text2, ...num,
      }}>{o === 'YES' ? 'Yes' : 'No'} {px != null ? `${px}¢` : ''}</button>
    )
  }

  const bump = (setter, v, d, lo, hi) => setter(String(Math.max(lo, Math.min(hi, (Number(v) || 0) + d))))

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: C.muted }}>{market.grp === 'winner' ? 'Outright' : market.grp === 'result' ? 'Match result' : market.label}</div>
          <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{market.question}</div>
        </div>
        {onClose && <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>×</button>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.line}`, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {['buy', 'sell'].map(s => (
            <button key={s} onClick={() => setSide(s)} style={{
              background: 'none', border: 'none', padding: '8px 0', fontWeight: 800, fontSize: 15, cursor: 'pointer', textTransform: 'capitalize',
              color: side === s ? C.text : C.muted, borderBottom: `2px solid ${side === s ? C.text : 'transparent'}`, marginBottom: -1,
            }}>{s}</button>
          ))}
        </div>
        <select value={type} onChange={e => setType(e.target.value)} aria-label="Order type"
          style={{ background: 'transparent', border: 'none', color: C.text2, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          <option value="market">Market</option><option value="limit">Limit</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {outcomeBtn('YES', yesPx)}
        {outcomeBtn('NO', noPx)}
      </div>

      {type === 'limit' && (
        <Field label="Limit price">
          <Stepper value={price} onChange={setPrice} suffix="¢" onMinus={() => bump(setPrice, price, -1, 1, 99)} onPlus={() => bump(setPrice, price, 1, 1, 99)} placeholder="0" />
        </Field>
      )}
      {type === 'market' && side === 'buy' ? (
        <Field label="Amount" hint={user && `Balance ${fmt.kc(user.balance)}`}>
          <BigInput value={amount} onChange={setAmount} prefix="KC" placeholder="0" />
          <Chips items={[['+1', () => bump(setAmount, amount, 1, 0, 1e9)], ['+10', () => bump(setAmount, amount, 10, 0, 1e9)], ['+100', () => bump(setAmount, amount, 100, 0, 1e9)],
            ['Max', () => user && setAmount(String(Math.floor(user.balance) / 100))]]} />
        </Field>
      ) : (
        <Field label="Shares" hint={side === 'sell' ? `You hold ${fmt.shares(held)} ${outcome === 'YES' ? 'Yes' : 'No'}` : null}>
          <BigInput value={shares} onChange={v => setShares(v.replace(/\D/g, ''))} placeholder="0" />
          {side === 'sell'
            ? <Chips items={[['25%', () => setShares(String(Math.floor(held / 4)))], ['50%', () => setShares(String(Math.floor(held / 2)))], ['Max', () => setShares(String(held))]]} />
            : <Chips items={[['+10', () => bump(setShares, shares, 10, 0, 1e6)], ['+100', () => bump(setShares, shares, 100, 0, 1e6)], ['+1K', () => bump(setShares, shares, 1000, 0, 1e6)]]} />}
        </Field>
      )}

      {type === 'limit' && ready && (
        <div style={{ fontSize: 13, display: 'grid', gap: 6, marginBottom: 10 }}>
          <Line k={side === 'buy' ? 'Total' : 'You\'ll receive'} v={fmt.kc(Number(price) * Number(shares))} />
          {side === 'buy' && <Line k="To win" v={<span style={{ color: C.yes }}>{fmt.kc(Number(shares) * 100)}</span>} />}
        </div>
      )}

      {preview && (
        <div style={{ background: C.bg, borderRadius: 8, padding: 12, fontSize: 13, display: 'grid', gap: 6, marginBottom: 10 }}>
          {type === 'limit' && <Line k="Fills now" v={`${fmt.shares(preview.filled)} of ${fmt.shares(preview.size)} shares`} />}
          {type === 'limit' && preview.resting > 0 && <Line k="Rests on book" v={`${fmt.shares(preview.resting)} @ ${preview.price}¢`} />}
          {preview.filled > 0 && <Line k="Avg price" v={fmt.cents(preview.avg_price)} />}
          {type === 'market' && side === 'buy' && <Line k="Shares" v={fmt.shares(preview.filled)} />}
          {side === 'buy' && preview.filled > 0 && type === 'market' && (
            <Line k="To win" strong v={<span style={{ color: C.yes }}>{fmt.kc(preview.filled * 100)} <span style={{ color: C.muted, fontWeight: 500 }}>({fmt.signed(preview.filled * 100 - preview.cost)})</span></span>} />
          )}
          {side === 'sell' && preview.filled > 0 && <Line k="You'll receive" strong v={fmt.kc(preview.proceeds)} />}
        </div>
      )}

      <ErrorBox>{error}</ErrorBox>
      {done && (
        <div role="status" style={{ fontSize: 13, color: C.yes, background: C.yesBg, borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
          ✓ {done.filled ? `${done.side === 'buy' ? 'Bought' : 'Sold'} ${fmt.shares(done.filled)} ${done.outcome === 'YES' ? 'Yes' : 'No'} @ ${fmt.cents(done.avg_price)}` : 'Order placed'}
          {done.resting > 0 && ` · ${fmt.shares(done.resting)} resting @ ${done.price}¢`}
        </div>
      )}
      {user ? (
        <Button kind={outcome === 'YES' ? 'yes' : 'no'} onClick={submit} disabled={busy || !ready || (!preview && type === 'market')}
          style={{ width: '100%', marginTop: 10, padding: '13px 16px', fontSize: 16 }}>
          {busy ? 'Placing…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${outcome === 'YES' ? 'Yes' : 'No'}${type === 'limit' ? ' (limit)' : ''}`}
        </Button>
      ) : (
        <a href="#/login"><Button style={{ width: '100%', marginTop: 10, padding: '13px 16px' }}>Sign up to trade — get 1,000 KC free</Button></a>
      )}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: 'center' }}>
        Each winning share pays 1 KC. Play money — no cash value.
      </div>
    </Card>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: C.text2, fontWeight: 700 }}>{label}</span>
        {hint && <span style={{ color: C.muted }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function BigInput({ value, onChange, prefix, placeholder }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '0 12px' }}>
      {prefix && <span style={{ color: C.muted, fontWeight: 700, marginRight: 8 }}>{prefix}</span>}
      <input inputMode="decimal" value={value} onChange={e => onChange(e.target.value.replace(/[^\d.]/g, ''))} placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', padding: '11px 0', fontSize: 22, fontWeight: 700, textAlign: 'right', ...num }} />
    </div>
  )
}

function Stepper({ value, onChange, onMinus, onPlus, suffix, placeholder }) {
  const b = { background: C.surface3, border: 'none', borderRadius: 6, width: 36, height: 36, fontSize: 18, fontWeight: 700, cursor: 'pointer' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 4 }}>
      <button type="button" onClick={onMinus} style={b} aria-label="Decrease">−</button>
      <input inputMode="numeric" value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', textAlign: 'center', fontSize: 20, fontWeight: 700, ...num }} />
      <span style={{ color: C.muted, fontWeight: 700 }}>{suffix}</span>
      <button type="button" onClick={onPlus} style={b} aria-label="Increase">+</button>
    </div>
  )
}

function Chips({ items }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      {items.map(([t, fn]) => (
        <button key={t} type="button" onClick={fn} style={{ flex: 1, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 6, padding: '6px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t}</button>
      ))}
    </div>
  )
}

function Line({ k, v, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: C.muted }}>{k}</span>
      <span style={{ fontWeight: strong ? 800 : 600, ...num }}>{v}</span>
    </div>
  )
}
