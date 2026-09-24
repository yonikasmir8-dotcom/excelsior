import React from 'react'
import { C, display } from './theme.js'
import { Card, Heading } from './ui.jsx'

const origin = typeof window !== 'undefined' ? window.location.origin : ''

const ENDPOINTS = [
  ['GET', '/api/events?status=open&sort=trending&category=&q=', 'List events with every market\'s price, best bid/ask, volume'],
  ['GET', '/api/events/:slug', 'One event with markets, rules, and (if authenticated) your positions + open orders'],
  ['GET', '/api/events/:id/history?range=1d|1w|1m', 'Price history per market (YES price in cents)'],
  ['GET', '/api/markets/:id/book', 'Aggregated order book — bids/asks in YES cents'],
  ['GET', '/api/stream', 'Server-Sent Events: trade, book, event, comment messages'],
  ['POST', '/api/orders', 'Place an order (see below)', true],
  ['POST', '/api/orders/preview', 'Dry-run an order: exact fills, avg price, no side effects', true],
  ['GET', '/api/orders', 'Your open orders', true],
  ['DELETE', '/api/orders/:id', 'Cancel one order', true],
  ['DELETE', '/api/orders?market_id=', 'Cancel all your orders (optionally in one market)', true],
  ['GET', '/api/portfolio', 'Cash, positions marked to market, fills history', true],
]

const Code = ({ children }) => (
  <pre style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 14, overflowX: 'auto', fontSize: 13, lineHeight: 1.55, margin: '8px 0 0' }}><code>{children}</code></pre>
)

export default function DocsPage() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 18 }}>
      <div>
        <Heading style={{ marginBottom: 6 }}>Trading API</Heading>
        <p style={{ color: C.text2, margin: 0, fontSize: 15, lineHeight: 1.6 }}>
          Everything in the app is available over a JSON REST API — built for market makers, arbitrage bots and data folks.
          Create a key under <a href="#/settings" style={{ color: C.accent }}>Settings</a> and send it as <code>X-API-Key</code>.
        </p>
      </div>

      <Card style={{ padding: 18 }}>
        <h2 style={{ ...display, fontSize: 22, margin: '0 0 8px', textTransform: 'uppercase' }}>How the book works</h2>
        <ul style={{ color: C.text2, fontSize: 14, lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
          <li>Every market is binary. A <strong>YES</strong> and a <strong>NO</strong> share together always redeem for exactly <strong>100¢ (1 KC)</strong>.</li>
          <li>All prices are integer cents 1–99; sizes are whole shares; cash amounts are integer cents.</li>
          <li>There is one book per market, priced in YES. Buying NO at 40¢ is an ask for YES at 60¢, so YES and NO orders match each other (minting or merging pairs).</li>
          <li>Price-time priority; fills happen at the resting order's price; you get the improvement back.</li>
          <li>Self-trade prevention cancels your resting order instead of matching it.</li>
          <li>Limit orders rest until filled or cancelled; market orders are immediate-or-cancel. <code>post_only</code> rejects an order that would cross.</li>
          <li>Trading halts at kick-off / close. Open orders are cancelled and escrow refunded. Winning shares pay 100¢; void markets pay 50¢ per share.</li>
        </ul>
      </Card>

      <Card style={{ padding: 18 }}>
        <h2 style={{ ...display, fontSize: 22, margin: '0 0 8px', textTransform: 'uppercase' }}>Endpoints</h2>
        <div style={{ display: 'grid', gap: 2 }}>
          {ENDPOINTS.map(([m, path, desc, auth]) => (
            <div key={m + path} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.line}`, fontSize: 13 }}>
              <code style={{ color: m === 'GET' ? C.yes : m === 'POST' ? C.accent : C.no, fontWeight: 700 }}>{m}</code>
              <div style={{ minWidth: 0 }}>
                <code style={{ overflowWrap: 'anywhere' }}>{path}</code> {auth && <span style={{ fontSize: 11, color: C.muted }}>🔑</span>}
                <div style={{ color: C.muted }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: 18 }}>
        <h2 style={{ ...display, fontSize: 22, margin: '0 0 8px', textTransform: 'uppercase' }}>Place an order</h2>
        <Code>{`# Limit: bid 20 YES shares at 54¢ (rests on the book)
curl -X POST ${origin}/api/orders \\
  -H "X-API-Key: gk_..." -H "Content-Type: application/json" \\
  -d '{"market_id": 12, "outcome": "YES", "side": "buy", "type": "limit", "price": 54, "size": 20}'

# Market: spend 25.00 KC on NO at the best available prices
-d '{"market_id": 12, "outcome": "NO", "side": "buy", "type": "market", "amount": 2500}'

# Market: sell 10 YES shares into the bids
-d '{"market_id": 12, "outcome": "YES", "side": "sell", "type": "market", "size": 10}'`}</Code>
        <p style={{ color: C.text2, fontSize: 14, marginBottom: 0 }}>Response:</p>
        <Code>{`{ "order_id": 981, "status": "filled" | "open" | "cancelled", "filled": 20, "resting": 0,
  "avg_price": 53.4, "cost": 1068, "fills": 2, "balance": 98932 }`}</Code>
      </Card>

      <Card style={{ padding: 18 }}>
        <h2 style={{ ...display, fontSize: 22, margin: '0 0 8px', textTransform: 'uppercase' }}>Live stream</h2>
        <Code>{`const es = new EventSource('${origin}/api/stream')
es.onmessage = e => {
  const msg = JSON.parse(e.data)
  // { type: 'trade', market_id, event_id, price, size, outcome, side }
  // { type: 'book', market_id }  → re-fetch /api/markets/:id/book
}`}</Code>
        <p style={{ color: C.muted, fontSize: 13, marginBottom: 0 }}>Rate limits: 120 orders/min, 240 previews/min per account. Errors return <code>{'{ "error": "…" }'}</code> with a 4xx status.</p>
      </Card>
    </div>
  )
}
