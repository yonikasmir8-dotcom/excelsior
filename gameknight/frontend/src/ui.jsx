import React from 'react'
import { C, display } from './theme.js'

export function Card({ children, style, ...rest }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, ...style }} {...rest}>{children}</div>
}

export function Button({ children, kind = 'primary', style, ...rest }) {
  const kinds = {
    primary: { background: C.accent, color: C.accentInk, border: `1px solid ${C.accent}` },
    ghost: { background: 'transparent', color: C.text, border: `1px solid ${C.line}` },
    danger: { background: 'transparent', color: C.sell, border: `1px solid ${C.sell}66` },
  }
  return (
    <button
      style={{
        ...kinds[kind], borderRadius: 8, padding: '10px 16px', fontWeight: 700, cursor: rest.disabled ? 'not-allowed' : 'pointer',
        opacity: rest.disabled ? 0.5 : 1, fontSize: 14, transition: 'filter .15s', ...style,
      }}
      onMouseEnter={e => !rest.disabled && (e.currentTarget.style.filter = 'brightness(1.12)')}
      onMouseLeave={e => (e.currentTarget.style.filter = '')}
      {...rest}
    >{children}</button>
  )
}

export function Input({ style, ...rest }) {
  return <input style={{ width: '100%', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '10px 12px', fontSize: 15, ...style }} {...rest} />
}

export function Label({ children }) {
  return <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{children}</div>
}

export function Heading({ children, style }) {
  return <h1 style={{ ...display, fontSize: 34, fontWeight: 800, margin: '0 0 16px', textTransform: 'uppercase', ...style }}>{children}</h1>
}

export function Pill({ active, children, ...rest }) {
  return (
    <button
      style={{
        background: active ? C.text : 'transparent', color: active ? C.bg : C.text2, border: `1px solid ${active ? C.text : C.line}`,
        borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
      {...rest}
    >{children}</button>
  )
}

export function StateBadge({ state }) {
  const map = {
    open: { t: 'Open', c: C.good },
    awaiting: { t: 'Awaiting result', c: '#eda100' },
    settled: { t: 'Full time', c: C.text2 },
    void: { t: 'Void', c: C.muted },
  }
  const s = map[state] || map.open
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.text2 }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: s.c }} />{s.t}
    </span>
  )
}

export function Stat({ label, value, sub, tone }) {
  return (
    <Card style={{ padding: 16, flex: '1 1 150px' }}>
      <Label>{label}</Label>
      <div style={{ ...display, fontSize: 30, fontWeight: 700, color: tone || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </Card>
  )
}

export function Empty({ children }) {
  return <div style={{ padding: 32, textAlign: 'center', color: C.muted, fontSize: 14 }}>{children}</div>
}

export function ErrorBox({ children }) {
  if (!children) return null
  return <div role="alert" style={{ background: '#ff7a6b1a', border: `1px solid ${C.sell}55`, color: '#ffb3aa', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}>{children}</div>
}

export function Crest({ name, size = 36 }) {
  // Deterministic two-tone crest from the club name
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  const initials = name.split(/\s+/).filter(w => !/^(fc|cf|ac|de|the)$/i.test(w)).map(w => w[0]).join('').slice(0, 3).toUpperCase()
  return (
    <div aria-hidden style={{
      width: size, height: size * 1.12, flexShrink: 0, display: 'grid', placeItems: 'center',
      background: `linear-gradient(135deg, hsl(${h} 55% 38%) 50%, hsl(${(h + 40) % 360} 45% 26%) 50%)`,
      clipPath: 'polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%)',
      ...display, fontWeight: 800, fontSize: size * 0.34, color: '#fff', paddingBottom: size * 0.18,
    }}>{initials}</div>
  )
}
