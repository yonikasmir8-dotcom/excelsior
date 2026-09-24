import React, { useEffect, useRef, useState } from 'react'
import { C, FONT } from './theme.js'

// Flash green/red when a number moves — the exchange feels alive
export function useFlash(value) {
  const prev = useRef(value)
  const [dir, setDir] = useState(null)
  useEffect(() => {
    if (prev.current != null && value != null && value !== prev.current) {
      setDir(value > prev.current ? 'up' : 'down')
      const t = setTimeout(() => setDir(null), 900)
      prev.current = value
      return () => clearTimeout(t)
    }
    prev.current = value
  }, [value])
  return dir
}

export function Flash({ value, children, style }) {
  const dir = useFlash(value)
  return (
    <span style={{
      transition: 'background-color .9s ease, color .9s ease', borderRadius: 2,
      backgroundColor: dir === 'up' ? '#1ec31e44' : dir === 'down' ? '#e0000044' : 'transparent', ...style,
    }}>{children}</span>
  )
}

// Re-render every `ms` (live countdowns)
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t) }, [ms])
  return now
}

export function Countdown({ to, style }) {
  const now = useNow(1000)
  const s = Math.max(0, (new Date(to) - now) / 1000)
  if (!s) return <span style={style}>Kick-off</span>
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60)
  const pad = n => String(n).padStart(2, '0')
  return <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{d ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`}</span>
}

export function LiveDot({ color = C.noText, size = 8 }) {
  return <span aria-hidden style={{ width: size, height: size, borderRadius: 99, background: color, display: 'inline-block', animation: 'gk-pulse 1.4s ease-in-out infinite' }} />
}

export function Skeleton({ h = 16, w = '100%', style }) {
  return <div aria-hidden style={{ height: h, width: w, background: 'linear-gradient(90deg, #1a1a1a 0%, #262626 50%, #1a1a1a 100%)', backgroundSize: '200% 100%', animation: 'gk-shimmer 1.2s linear infinite', ...style }} />
}

// Toasts
const listeners = new Set()
export function toast(message, tone = 'ok') { listeners.forEach(l => l({ id: Math.random(), message, tone })) }
export function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const on = t => { setItems(xs => [...xs, t]); setTimeout(() => setItems(xs => xs.filter(x => x.id !== t.id)), 3800) }
    listeners.add(on)
    return () => listeners.delete(on)
  }, [])
  return (
    <div aria-live="polite" style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', zIndex: 90, display: 'grid', justifyItems: 'center', gap: 8, pointerEvents: 'none', padding: '0 16px' }}>
      {items.map(t => (
        <div key={t.id} style={{
          pointerEvents: 'auto', maxWidth: 440, width: '100%', background: '#121212', border: `1px solid ${t.tone === 'ok' ? C.yes : C.no}`,
          borderLeft: `4px solid ${t.tone === 'ok' ? C.yes : C.no}`, color: C.text, padding: '12px 14px', fontFamily: FONT, fontSize: 14, fontWeight: 600,
          boxShadow: '0 14px 40px #000', animation: 'gk-up .25s ease',
        }}>{t.message}</div>
      ))}
    </div>
  )
}
