import React, { useEffect, useRef, useState } from 'react'
import { C, fmt } from './theme.js'

// Implied-probability history: one stepped line per outcome on a shared % axis,
// crosshair + tooltip on hover, legend with the latest value.
// series: [{ id, label, color, points: [{ t, p }] }]
export default function PriceChart({ series, live = true, height = 240 }) {
  const wrap = useRef(null)
  const [w, setW] = useState(0)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const pad = { l: 8, r: 44, t: 10, b: 24 }
  const iw = Math.max(10, w - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const data = series.map(s => ({ ...s, pts: s.points.map(p => ({ t: new Date(p.t).getTime(), p: p.p })) })).filter(s => s.pts.length)
  const all = data.flatMap(s => s.pts)
  const t0 = all.length ? Math.min(...all.map(p => p.t)) : Date.now() - 864e5
  const t1 = Math.max(live ? Date.now() : Math.max(...all.map(p => p.t), t0), t0 + 60e3)
  const lo = Math.max(0, Math.floor((Math.min(...all.map(p => p.p), 50) - 5) / 10) * 10)
  const hi = Math.min(100, Math.ceil((Math.max(...all.map(p => p.p), 50) + 5) / 10) * 10)
  const x = t => pad.l + ((t - t0) / (t1 - t0)) * iw
  const y = p => pad.t + (1 - (p - lo) / (hi - lo)) * ih

  const path = pts => pts.reduce((d, p, k) => d + (k ? `H${x(p.t)}V${y(p.p)}` : `M${x(p.t)},${y(p.p)}`), '') + (pts.length ? `H${x(t1)}` : '')
  const at = (pts, t) => { let v = pts[0]?.p; for (const p of pts) { if (p.t <= t) v = p.p; else break } return v }

  const gridStep = hi - lo > 50 ? 25 : hi - lo > 20 ? 10 : 5
  const grid = []
  for (let g = Math.ceil(lo / gridStep) * gridStep; g <= hi; g += gridStep) grid.push(g)

  const span = t1 - t0
  // Pick the smallest "nice" interval that keeps labels ~70px apart
  const maxTicks = Math.max(2, Math.floor(iw / 70))
  const step = [3600e3, 3 * 3600e3, 6 * 3600e3, 12 * 3600e3, 864e5, 2 * 864e5, 7 * 864e5, 14 * 864e5, 30 * 864e5]
    .find(s => span / s <= maxTicks) || 30 * 864e5
  const ticks = []
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t)
  const tickLabel = t => step >= 864e5
    ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const onMove = clientX => {
    const rect = wrap.current.getBoundingClientRect()
    const px = clientX - rect.left
    if (px < pad.l || px > pad.l + iw) return setHover(null)
    setHover({ px, t: t0 + ((px - pad.l) / iw) * (t1 - t0) })
  }

  const latest = data.map(s => s.pts[s.pts.length - 1].p)

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 10, fontSize: 13 }}>
        {data.map((s, i) => (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.text2 }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color }} />
            {s.label} <strong style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmt.pct(latest[i])}</strong>
          </span>
        ))}
      </div>
      <div ref={wrap} style={{ position: 'relative', width: '100%' }}
        onMouseMove={e => onMove(e.clientX)} onMouseLeave={() => setHover(null)}
        onTouchMove={e => e.touches[0] && onMove(e.touches[0].clientX)} onTouchEnd={() => setHover(null)}>
        <svg width={w} height={height} role="img" style={{ display: 'block' }}
          aria-label={`Implied probability over time. Latest: ${data.map((s, i) => `${s.label} ${fmt.pct(latest[i])}`).join(', ')}`}>
          {grid.map(g => (
            <g key={g}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(g)} y2={y(g)} stroke={C.line} strokeDasharray="2 4" />
              <text x={pad.l + iw + 8} y={y(g) + 4} fontSize="11" fill={C.muted}>{g}%</text>
            </g>
          ))}
          {ticks.map(t => <text key={t} x={x(t)} y={height - 6} textAnchor="middle" fontSize="11" fill={C.muted}>{tickLabel(t)}</text>)}
          {data.map(s => <path key={s.id} d={path(s.pts)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />)}
          {!hover && data.map((s, i) => <circle key={s.id} cx={x(t1)} cy={y(latest[i])} r="4" fill={s.color} stroke={C.surface} strokeWidth="2" />)}
          {hover && (
            <g>
              <line x1={hover.px} x2={hover.px} y1={pad.t} y2={pad.t + ih} stroke={C.text2} strokeWidth="1" />
              {data.map(s => <circle key={s.id} cx={hover.px} cy={y(at(s.pts, hover.t))} r="4" fill={s.color} stroke={C.surface} strokeWidth="2" />)}
            </g>
          )}
        </svg>
        {hover && (
          <div style={{
            position: 'absolute', top: 8, left: Math.min(hover.px + 12, Math.max(0, w - 190)), pointerEvents: 'none', width: 178,
            background: C.surface3, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', fontSize: 12, boxShadow: '0 6px 20px #0008',
          }}>
            <div style={{ color: C.muted, marginBottom: 4 }}>
              {new Date(hover.t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
            {data.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.7 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: s.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt.pct(at(s.pts, hover.t))}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
