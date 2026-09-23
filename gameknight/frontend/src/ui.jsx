import React from 'react'
import { C, display } from './theme.js'

export function Card({ children, style, ...rest }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, ...style }} {...rest}>{children}</div>
}

export function Button({ children, kind = 'primary', style, ...rest }) {
  const kinds = {
    primary: { background: C.accent, color: C.accentInk, border: `1px solid ${C.accent}` },
    ghost: { background: 'transparent', color: C.text, border: `1px solid ${C.line}` },
    danger: { background: 'transparent', color: C.no, border: `1px solid ${C.no}66` },
    yes: { background: C.yes, color: '#06200f', border: `1px solid ${C.yes}` },
    no: { background: C.no, color: '#2a0703', border: `1px solid ${C.no}` },
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
    open: { t: 'Live', c: C.yes },
    closed: { t: 'Awaiting result', c: '#eda100' },
    resolved: { t: 'Resolved', c: C.text2 },
    void: { t: 'Void', c: C.muted },
  }
  const s = map[state] || map.open
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: C.text2, whiteSpace: 'nowrap' }}>
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
  return <div role="alert" style={{ background: '#ff7a6b1a', border: `1px solid ${C.no}55`, color: '#ffb3aa', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}>{children}</div>
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

export function Tabs({ tabs, value, onChange, size = 14 }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 18, borderBottom: `1px solid ${C.line}`, overflowX: 'auto' }}>
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)} style={{
          background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', fontWeight: 700, fontSize: size, whiteSpace: 'nowrap',
          color: value === k ? C.text : C.muted, borderBottom: `2px solid ${value === k ? C.accent : 'transparent'}`, marginBottom: -1,
        }}>{label}</button>
      ))}
    </div>
  )
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 8, padding: 3, ...style }}>
      {options.map(([k, label, activeStyle]) => (
        <button key={k} type="button" onClick={() => onChange(k)} style={{
          flex: 1, padding: '7px 8px', borderRadius: 6, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
          background: value === k ? C.surface3 : 'transparent', color: value === k ? C.text : C.muted, ...(value === k && activeStyle),
        }}>{label}</button>
      ))}
    </div>
  )
}

export function UserLink({ name, style }) {
  return <a href={`#/u/${encodeURIComponent(name)}`} style={{ fontWeight: 600, ...style }} onClick={e => e.stopPropagation()}>{name}</a>
}
