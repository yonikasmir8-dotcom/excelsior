import React, { useEffect, useState } from 'react'
import { api } from './api.js'
import { C, fmt, num, useLive } from './theme.js'
import { Empty } from './ui.jsx'

// Depth view for one side of a binary market. The book is stored in YES prices;
// for the NO view every level is mirrored (NO bid at q = YES ask at 100 − q).
export default function OrderBook({ marketId, outcome = 'YES', onPickPrice }) {
  const [book, setBook] = useState(null)
  const load = () => api.book(marketId).then(setBook).catch(() => {})
  useEffect(() => { setBook(null); load() }, [marketId]) // eslint-disable-line react-hooks/exhaustive-deps
  useLive(m => m.market_id === marketId && (m.type === 'book' || m.type === 'trade'), load, [marketId])

  if (!book) return <Empty>Loading order book…</Empty>
  const flip = lv => lv.map(l => ({ ...l, price: 100 - l.price }))
  const bids = outcome === 'YES' ? book.bids : flip(book.asks)
  const asks = outcome === 'YES' ? book.asks : flip(book.bids)
  if (!bids.length && !asks.length) return <Empty>No orders yet — place a limit order to make this market.</Empty>

  const cum = levels => { let t = 0; return levels.map(l => ({ ...l, total: (t += l.size * l.price) })) }
  const a = cum(asks.slice(0, 8)).reverse()
  const b = cum(bids.slice(0, 8))
  const max = Math.max(...a.map(l => l.total), ...b.map(l => l.total), 1)
  const spread = asks[0] && bids[0] ? asks[0].price - bids[0].price : null
  const mid = asks[0] && bids[0] ? (asks[0].price + bids[0].price) / 2 : null

  const Row = ({ l, kind }) => (
    <button type="button" onClick={() => onPickPrice?.(l.price, kind)} title={`Use ${fmt.cents(l.price)}`} style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', width: '100%', padding: '4px 10px', fontSize: 13, position: 'relative',
      background: 'none', border: 'none', cursor: onPickPrice ? 'pointer' : 'default', ...num,
    }}>
      <span style={{
        position: 'absolute', right: 0, top: 1, bottom: 1, width: `${(l.total / max) * 100}%`,
        background: kind === 'ask' ? C.noBg : C.yesBg, borderRadius: 3,
      }} />
      <span style={{ position: 'relative', textAlign: 'left', color: kind === 'ask' ? C.noText : C.yesText, fontWeight: 700 }}>{fmt.cents(l.price)}</span>
      <span style={{ position: 'relative', textAlign: 'right', color: C.text2 }}>{fmt.shares(l.size)}</span>
      <span style={{ position: 'relative', textAlign: 'right', color: C.text2 }}>{fmt.kcShort(l.total)}</span>
    </button>
  )

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0 10px 6px', fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <span>Trade {outcome === 'YES' ? 'Yes' : 'No'}</span><span style={{ textAlign: 'right' }}>Units</span><span style={{ textAlign: 'right' }}>Total</span>
      </div>
      {a.map(l => <Row key={`a${l.price}`} l={l} kind="ask" />)}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', margin: '4px 0', borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, color: C.muted, fontSize: 12 }}>
        <span>{mid != null ? `Mid ${fmt.cents(mid)}` : 'One-sided book'}</span>
        <span>{spread != null ? `Spread ${fmt.cents(spread)}` : ''}</span>
      </div>
      {b.map(l => <Row key={`b${l.price}`} l={l} kind="bid" />)}
    </div>
  )
}
