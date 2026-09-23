import React, { useEffect, useRef, useState } from 'react'
import { C, fmt } from './theme.js'

// Implied-probability history for one market: one stepped line per outcome,
// shared 0–100% axis, crosshair + tooltip on hover.
export default function PriceChart({ history, outcomes, live }) {
  const wrap = useRef(null)
  const [w, setW] = useState(0)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const h = 220
  const pad = { l: 40, r: 12, t: 12, b: 26 }
  const iw = Math.max(10, w - pad.l - pad.r)
  const ih = h - pad.t - pad.b
  const pts = history.map(p => ({ t: new Date(p.t).getTime(), prices: p.prices }))
  const t0 = pts[0]?.t ?? Date.now()
  const t1 = Math.max(live ? Date.now() : pts[pts.length - 1]?.t ?? t0, t0 + 60e3)
  const x = t => pad.l + ((t - t0) / (t1 - t0)) * iw
  const y = p => pad.t + (1 - p) * ih

  const path = i => {
    let d = ''
    pts.forEach((p, k) => {
      const px = x(p.t), py = y(p.prices[i])
      d += k === 0 ? `M${px},${py}` : `H${px}V${py}`
    })
    return d + `H${x(t1)}`
  }

  const ticks = []
  const span = t1 - t0
  const step = span > 3 * 864e5 ? 864e5 : span > 864e5 ? 6 * 3600e3 : span > 6 * 3600e3 ? 3 * 3600e3 : 3600e3
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) ticks.push(t)
  const tickLabel = t => step >= 864e5
    ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  const onMove = e => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    if (px < pad.l || px > pad.l + iw) return setHover(null)
    const t = t0 + ((px - pad.l) / iw) * (t1 - t0)
    let idx = 0
    for (let k = 0; k < pts.length; k++) if (pts[k].t <= t) idx = k
    setHover({ px, t, prices: pts[idx].prices })
  }

  const last = pts[pts.length - 1]?.prices || []
  const summary = outcomes.map((o, i) => `${o.label} ${fmt.pct(last[i] ?? 0)}`).join(', ')

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginBottom: 8, fontSize: 13 }}>
        {outcomes.map((o, i) => (
          <span key={o.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.text2 }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: C.series[i] }} />
            {o.label} <strong style={{ color: C.text, fontVariantNumeric: 'tabular-nums' }}>{fmt.pct(last[i] ?? 0)}</strong>
          </span>
        ))}
      </div>
      <svg width={w} height={h} role="img" aria-label={`Implied probability over time. Latest: ${summary}`}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ display: 'block', touchAction: 'pan-y' }}
        onTouchMove={e => onMove(e.touches[0] && { clientX: e.touches[0].clientX, currentTarget: e.currentTarget })}>
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <g key={p}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(p)} y2={y(p)} stroke={C.line} strokeDasharray={p === 0 ? '' : '2 4'} />
            <text x={pad.l - 8} y={y(p) + 4} textAnchor="end" fontSize="11" fill={C.muted}>{p * 100}%</text>
          </g>
        ))}
        {ticks.map(t => (
          <text key={t} x={x(t)} y={h - 6} textAnchor="middle" fontSize="11" fill={C.muted}>{tickLabel(t)}</text>
        ))}
        {outcomes.map((o, i) => (
          <path key={o.id} d={path(i)} fill="none" stroke={C.series[i]} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {outcomes.map((o, i) => (
          <circle key={o.id} cx={x(t1)} cy={y(last[i] ?? 0)} r="4" fill={C.series[i]} stroke={C.surface} strokeWidth="2" />
        ))}
        {hover && (
          <g>
            <line x1={hover.px} x2={hover.px} y1={pad.t} y2={pad.t + ih} stroke={C.text2} strokeWidth="1" />
            {outcomes.map((o, i) => (
              <circle key={o.id} cx={hover.px} cy={y(hover.prices[i])} r="4" fill={C.series[i]} stroke={C.surface} strokeWidth="2" />
            ))}
          </g>
        )}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute', top: 36, left: Math.min(hover.px + 12, w - 170), pointerEvents: 'none', width: 158,
          background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px', fontSize: 12,
          boxShadow: '0 6px 20px #0008',
        }}>
          <div style={{ color: C.muted, marginBottom: 4 }}>
            {new Date(hover.t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
          {outcomes.map((o, i) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 6, lineHeight: 1.7 }}>
              <span style={{ width: 8, height: 8, borderRadius: 99, background: C.series[i] }} />
              <span style={{ flex: 1, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt.pct(hover.prices[i])}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
