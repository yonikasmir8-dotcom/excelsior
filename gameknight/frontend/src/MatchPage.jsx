import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { C, display, fmt, useIsMobile } from './theme.js'
import { Button, Card, Crest, Empty, ErrorBox, Input, Label, StateBadge } from './ui.jsx'
import PriceChart from './PriceChart.jsx'

const MARKET_TAB = { '1X2': 'Match result', OU25: 'Goals O/U 2.5', BTTS: 'Both to score' }

export default function MatchPage({ id, user, onTrade }) {
  const [f, setF] = useState(null)
  const [error, setError] = useState('')
  const [marketIdx, setMarketIdx] = useState(0)
  const [outcomeId, setOutcomeId] = useState(null)
  const [side, setSide] = useState('buy')
  const mobile = useIsMobile()

  const load = useCallback(() => api.fixture(id).then(setF).catch(e => setError(e.message)), [id])
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t) }, [load])

  if (error && !f) return <ErrorBox>{error}</ErrorBox>
  if (!f) return <Card><Empty>Loading match…</Empty></Card>

  const market = f.markets[marketIdx]
  const mine = Object.fromEntries((f.my_positions || []).map(p => [p.outcome_id, p]))
  const selected = market.outcomes.find(o => o.id === outcomeId) || null
  const tradable = f.state === 'open' && market.status === 'open'

  const pick = (o, s = 'buy') => { setOutcomeId(o.id); setSide(s) }

  return (
    <div>
      <a href="#/" style={{ color: C.muted, fontSize: 14 }}>← All markets</a>

      <Card style={{ padding: mobile ? 16 : 24, margin: '12px 0 20px', background: `linear-gradient(160deg, #183224, ${C.surface} 60%)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 13, color: C.text2, marginBottom: 16 }}>
          <span style={{ fontWeight: 600 }}>{f.competition}</span>
          <StateBadge state={f.state} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
          <Team name={f.home} mobile={mobile} />
          <div style={{ textAlign: 'center' }}>
            {f.state === 'settled' ? (
              <div style={{ ...display, fontSize: mobile ? 40 : 56, fontWeight: 800 }}>{f.home_score} – {f.away_score}</div>
            ) : (
              <>
                <div style={{ ...display, fontSize: mobile ? 26 : 34, fontWeight: 800, color: C.accent }}>{fmt.countdown(f.kickoff)}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{fmt.kickoff(f.kickoff)}</div>
              </>
            )}
          </div>
          <Team name={f.away} mobile={mobile} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: C.muted, marginTop: 14 }}>{fmt.coinsShort(f.volume)} KC traded across {f.markets.length} markets</div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) 340px', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 16, minWidth: 0 }}>
          <div role="tablist" style={{ display: 'flex', gap: 4, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: 4 }}>
            {f.markets.map((m, i) => (
              <button key={m.id} role="tab" aria-selected={i === marketIdx} onClick={() => { setMarketIdx(i); setOutcomeId(null) }} style={{
                flex: 1, minWidth: 0, padding: '9px 4px', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: mobile ? 12 : 14,
                background: i === marketIdx ? C.surface2 : 'transparent', color: i === marketIdx ? C.text : C.muted,
              }}>{MARKET_TAB[m.type]}</button>
            ))}
          </div>

          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 8 }}>
              <div style={{ ...display, fontSize: 22, fontWeight: 700, textTransform: 'uppercase' }}>{market.question}</div>
              <div style={{ fontSize: 12, color: C.muted, whiteSpace: 'nowrap' }}>{fmt.coinsShort(market.volume)} KC vol</div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {market.outcomes.map((o, i) => (
                <OutcomeRow key={o.id} o={o} color={C.series[i]} pos={mine[o.id]} market={market} tradable={tradable}
                  selected={o.id === outcomeId} onBuy={() => pick(o, 'buy')} onSell={() => pick(o, 'sell')} />
              ))}
            </div>
          </Card>

          <Card style={{ padding: 16 }}>
            <Label>Implied probability</Label>
            <PriceChart history={market.history} outcomes={market.outcomes} live={f.state === 'open'} />
          </Card>

          {!mobile && <RecentTrades trades={f.recent_trades} />}
        </div>

        <div style={{ position: mobile ? 'static' : 'sticky', top: 84, display: 'grid', gap: 16 }}>
          <TradePanel key={`${market.id}-${outcomeId}-${side}`} market={market} outcome={selected} side={side} setSide={setSide}
            pos={selected && mine[selected.id]} user={user} tradable={tradable} fixtureState={f.state}
            onDone={() => { load(); onTrade() }} />
          <Card style={{ padding: 16, fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
            <strong style={{ color: C.text }}>How it works.</strong> Each share pays <strong style={{ color: C.text }}>1 KC</strong> if
            that outcome happens and 0 if not. The price is the market's probability — buying pushes it up, selling pushes it down.
            Trading closes at kick-off; markets settle on the 90-minute result (incl. stoppage time).
          </Card>
          {mobile && <RecentTrades trades={f.recent_trades} />}
        </div>
      </div>
    </div>
  )
}

function Team({ name, mobile }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center', minWidth: 0 }}>
      <Crest name={name} size={mobile ? 44 : 60} />
      <div style={{ ...display, fontSize: mobile ? 18 : 26, fontWeight: 700, textTransform: 'uppercase', lineHeight: 1.05 }}>{name}</div>
    </div>
  )
}

function OutcomeRow({ o, color, pos, market, tradable, selected, onBuy, onSell }) {
  const won = market.status === 'settled' && market.winning_outcome === o.code
  const lost = market.status === 'settled' && !won
  const held = pos?.shares > 0
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px',
      borderRadius: 10, border: `1px solid ${selected ? C.accent : C.line}`, background: selected ? `${C.accent}0d` : C.surface2,
      opacity: lost ? 0.55 : 1,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
          {won && <span style={{ fontSize: 11, fontWeight: 800, color: C.accentInk, background: C.accent, borderRadius: 4, padding: '1px 6px' }}>WINNER</span>}
        </div>
        <div style={{ height: 4, background: C.bg, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${o.price * 100}%`, background: color, borderRadius: 2, transition: 'width .4s' }} />
        </div>
        {held && (
          <div style={{ fontSize: 12, color: C.text2, marginTop: 6 }}>
            You hold <strong style={{ color: C.text }}>{fmt.shares(pos.shares)}</strong> shares · pays {fmt.coins(pos.shares)} if right
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ ...display, fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{fmt.pct(o.price)}</div>
          <div style={{ fontSize: 11, color: C.muted }}>odds {fmt.odds(o.price)}</div>
        </div>
        {tradable && (
          <div style={{ display: 'grid', gap: 4 }}>
            <button onClick={onBuy} style={smallBtn(C.accent, C.accentInk)}>Buy</button>
            {held && <button onClick={onSell} style={smallBtn('transparent', C.sell, C.sell)}>Sell</button>}
          </div>
        )}
      </div>
    </div>
  )
}

const smallBtn = (bg, fg, border) => ({
  background: bg, color: fg, border: `1px solid ${border || bg}`, borderRadius: 6, padding: '5px 12px',
  fontWeight: 700, fontSize: 12, cursor: 'pointer',
})

function TradePanel({ market, outcome, side, setSide, pos, user, tradable, fixtureState, onDone }) {
  const [value, setValue] = useState('')
  const [quote, setQuote] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const timer = useRef()

  const body = outcome && (side === 'buy'
    ? { outcomeId: outcome.id, side, amount: Number(value) }
    : { outcomeId: outcome.id, side, shares: Number(value) })

  useEffect(() => {
    clearTimeout(timer.current)
    setQuote(null); setError('')
    if (!user || !outcome || !(Number(value) > 0)) return
    timer.current = setTimeout(() => {
      api.quote(market.id, body).then(setQuote).catch(e => setError(e.message))
    }, 250)
    return () => clearTimeout(timer.current)
  }, [value, side, outcome?.id, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true); setError('')
    try {
      const r = await api.trade(market.id, body)
      setDone(r); setValue(''); onDone()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const head = <div style={{ ...display, fontSize: 22, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12 }}>Trade slip</div>

  if (!tradable) {
    return (
      <Card style={{ padding: 16 }}>
        {head}
        <Empty>{fixtureState === 'settled' ? 'This match has been settled. Winning shares paid 1 KC each.'
          : fixtureState === 'void' ? 'This match was voided and stakes refunded.'
          : 'Trading closed at kick-off. Markets settle when the result is in.'}</Empty>
      </Card>
    )
  }
  if (!user) {
    return (
      <Card style={{ padding: 16 }}>
        {head}
        <p style={{ color: C.text2, fontSize: 14, marginTop: 0 }}>Sign up free to get 1,000 Knight Coins and start trading.</p>
        <a href="#/login"><Button style={{ width: '100%' }}>Sign in to trade</Button></a>
      </Card>
    )
  }
  if (!outcome) {
    return <Card style={{ padding: 16 }}>{head}<Empty>Pick an outcome to buy.</Empty></Card>
  }

  const presets = side === 'buy' ? [10, 25, 50, 100] : null
  const maxSell = pos?.shares || 0

  return (
    <Card style={{ padding: 16, borderColor: `${C.accent}55` }}>
      {head}
      <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 8, padding: 3, marginBottom: 14 }}>
        {['buy', 'sell'].map(s => (
          <button key={s} disabled={s === 'sell' && !maxSell} onClick={() => setSide(s)} style={{
            flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 13, textTransform: 'capitalize',
            cursor: s === 'sell' && !maxSell ? 'not-allowed' : 'pointer', opacity: s === 'sell' && !maxSell ? 0.4 : 1,
            background: side === s ? (s === 'buy' ? C.accent : C.sell) : 'transparent', color: side === s ? C.accentInk : C.muted,
          }}>{s}</button>
        ))}
      </div>
      <div style={{ fontSize: 14, marginBottom: 12 }}>
        <span style={{ color: C.muted }}>{side === 'buy' ? 'Buying' : 'Selling'}</span>{' '}
        <strong>{outcome.label}</strong> <span style={{ color: C.muted }}>@ {fmt.pct(outcome.price)}</span>
      </div>

      <Label>{side === 'buy' ? 'Stake (KC)' : `Shares to sell (you hold ${fmt.shares(maxSell)})`}</Label>
      <Input type="number" inputMode="decimal" min="0" step="any" value={value} autoFocus
        onChange={e => { setValue(e.target.value); setDone(null) }} placeholder={side === 'buy' ? '0' : '0.00'}
        style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {side === 'buy'
          ? presets.map(p => <Chip key={p} onClick={() => setValue(String(p))}>{p}</Chip>)
          : [0.25, 0.5, 1].map(p => <Chip key={p} onClick={() => setValue(String(Math.floor(maxSell * p * 1e6) / 1e6))}>{p === 1 ? 'All' : `${p * 100}%`}</Chip>)}
        {side === 'buy' && <Chip onClick={() => setValue(String(Math.floor(user.balance)))}>Max</Chip>}
      </div>

      {quote && (
        <div style={{ marginTop: 14, display: 'grid', gap: 6, fontSize: 13, background: C.bg, borderRadius: 8, padding: 12 }}>
          <Row k={side === 'buy' ? 'Shares' : 'You receive'} v={side === 'buy' ? fmt.shares(quote.shares) : fmt.coins(quote.amount)} />
          <Row k="Avg price" v={`${(quote.avg_price * 100).toFixed(1)}%`} />
          <Row k="Price after" v={`${fmt.pct(quote.price_before)} → ${fmt.pct(quote.price_after)}`} />
          {side === 'buy' && (
            <Row k="Pays if right" v={<span style={{ color: C.good }}>{fmt.coins(quote.shares)} <span style={{ color: C.muted }}>({fmt.signed(quote.shares - quote.amount)})</span></span>} strong />
          )}
        </div>
      )}
      <div style={{ marginTop: 12 }}><ErrorBox>{error}</ErrorBox></div>
      {done && (
        <div role="status" style={{ marginTop: 12, fontSize: 13, color: C.good, background: `${C.good}14`, borderRadius: 8, padding: '10px 12px' }}>
          ✓ {done.side === 'buy' ? 'Bought' : 'Sold'} {fmt.shares(done.shares)} shares for {fmt.coins(done.amount)}. Balance {fmt.coins(done.balance)}.
        </div>
      )}
      <Button onClick={submit} disabled={busy || !quote} style={{
        width: '100%', marginTop: 12, padding: '12px 16px', fontSize: 15,
        ...(side === 'sell' && { background: C.sell, borderColor: C.sell, color: C.accentInk }),
      }}>
        {busy ? 'Placing…' : side === 'buy' ? `Buy ${outcome.label}` : `Sell ${outcome.label}`}
      </Button>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 8, textAlign: 'center' }}>Balance {fmt.coins(user.balance)}</div>
    </Card>
  )
}

function Chip({ children, ...rest }) {
  return <button {...rest} style={{ flex: 1, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 6, padding: '6px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{children}</button>
}

function Row({ k, v, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: C.muted }}>{k}</span>
      <span style={{ fontWeight: strong ? 700 : 600, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  )
}

function RecentTrades({ trades }) {
  return (
    <Card style={{ padding: 16 }}>
      <Label>Recent trades on this match</Label>
      {!trades.length && <Empty>No trades yet.</Empty>}
      <div style={{ display: 'grid' }}>
        {trades.map((t, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, fontSize: 13, padding: '8px 0', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <strong>{t.username}</strong>{' '}
              <span style={{ color: t.side === 'buy' ? C.good : C.sell }}>{t.side === 'buy' ? 'bought' : 'sold'}</span>{' '}
              {fmt.shares(t.shares)} × {t.outcome}
              <div style={{ color: C.muted, fontSize: 12 }}>{t.question}</div>
            </div>
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {fmt.coinsShort(t.amount)} KC
              <div style={{ color: C.muted, fontSize: 12 }}>{fmt.ago(t.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
