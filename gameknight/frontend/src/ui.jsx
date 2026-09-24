import React, { useEffect } from 'react'
import { C, FONT, GRADIENT, clubStyle, display, fmt, num } from './theme.js'
import logo from './assets/logo.png'

export const LOGO = logo

// ── Primitives ──────────────────────────────────────────────────────────────
export function Card({ children, style, ...rest }) {
  return <div style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 4, ...style }} {...rest}>{children}</div>
}

export function Button({ children, kind = 'primary', style, ...rest }) {
  const kinds = {
    primary: { background: C.accent, color: '#fff', border: `1px solid ${C.accent}` },
    buy: { background: C.yes, color: '#fff', border: `1px solid ${C.yes}` },
    ghost: { background: 'transparent', color: C.text, border: `1px solid ${C.text}` },
    quiet: { background: 'transparent', color: C.text2, border: `1px solid ${C.line}` },
    danger: { background: 'transparent', color: C.noText, border: `1px solid ${C.no}` },
    yes: { background: C.yes, color: '#fff', border: `1px solid ${C.yes}` },
    no: { background: C.no, color: '#fff', border: `1px solid ${C.no}` },
  }
  return (
    <button
      style={{
        ...kinds[kind], borderRadius: 3, padding: '10px 16px', fontWeight: 700, fontFamily: FONT,
        cursor: rest.disabled ? 'not-allowed' : 'pointer', opacity: rest.disabled ? 0.45 : 1, fontSize: 15, transition: 'filter .15s', ...style,
      }}
      onMouseEnter={e => !rest.disabled && (e.currentTarget.style.filter = 'brightness(1.12)')}
      onMouseLeave={e => (e.currentTarget.style.filter = '')}
      {...rest}
    >{children}</button>
  )
}

export function Input({ style, light, ...rest }) {
  return (
    <input style={{
      width: '100%', background: light ? C.field : C.bg, color: light ? C.fieldInk : C.text, border: `1px solid ${light ? C.field : C.lineLight}`,
      borderRadius: 3, padding: '10px 12px', fontSize: 15, fontFamily: FONT, ...style,
    }} {...rest} />
  )
}

export function Label({ children, style }) {
  return <div style={{ fontSize: 13, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, ...style }}>{children}</div>
}

export function Heading({ children, style }) {
  return <h1 style={{ ...display, fontSize: 28, margin: '0 0 16px', textWrap: 'balance', ...style }}>{children}</h1>
}

// Deck-style outlined tab: magenta fill when active
export function Pill({ active, children, style, ...rest }) {
  return (
    <button
      style={{
        background: active ? C.accent : 'transparent', color: C.text, border: `1px solid ${active ? C.accent : C.text}`,
        borderRadius: 2, padding: '7px 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT, ...style,
      }}
      {...rest}
    >{children}</button>
  )
}

export function StateBadge({ state }) {
  const map = { open: ['Live', C.yes], closed: ['Awaiting result', '#eda100'], resolved: ['Resolved', C.muted], void: ['Void', C.muted] }
  const [t, c] = map[state] || map.open
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: C.text2, whiteSpace: 'nowrap' }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: c }} />{t}
    </span>
  )
}

export function Stat({ label, value, sub, tone }) {
  return (
    <Card style={{ padding: 14, flex: '1 1 140px' }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{label}</div>
      <div style={{ ...display, ...num, fontSize: 24, color: tone || C.text, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </Card>
  )
}

export function Empty({ children }) {
  return <div style={{ padding: 28, textAlign: 'center', color: C.muted, fontSize: 14 }}>{children}</div>
}

export function ErrorBox({ children }) {
  if (!children) return null
  return <div role="alert" style={{ background: C.noBg, border: `1px solid ${C.no}`, color: '#ffb3b3', borderRadius: 3, padding: '10px 12px', fontSize: 14 }}>{children}</div>
}

export function Tabs({ tabs, value, onChange, size = 14 }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 18, borderBottom: `1px solid ${C.line}`, overflowX: 'auto' }}>
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)} style={{
          background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', fontWeight: 700, fontSize: size, whiteSpace: 'nowrap', fontFamily: FONT,
          color: value === k ? C.text : C.muted, borderBottom: `2px solid ${value === k ? C.accent : 'transparent'}`, marginBottom: -1,
        }}>{label}</button>
      ))}
    </div>
  )
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <div style={{ display: 'flex', gap: 6, ...style }}>
      {options.map(([k, label]) => <Pill key={k} active={value === k} onClick={() => onChange(k)} style={{ flex: 1, padding: '6px 8px', fontSize: 13 }}>{label}</Pill>)}
    </div>
  )
}

export function UserLink({ name, style }) {
  return <a href={`#/u/${encodeURIComponent(name)}`} style={{ fontWeight: 700, ...style }} onClick={e => e.stopPropagation()}>{name}</a>
}

// ── Game Knight pieces ───────────────────────────────────────────────────────

// Club / competition tile in club colours with its three-letter code (deck calendar + card art)
export function Tile({ name, w = 44, h = 44, label = true, style, big, crest }) {
  const s = clubStyle(name)
  if (crest) {
    // Generic shield in club colours (we don't ship club badges)
    return (
      <div aria-hidden style={{ width: w, height: h, background: '#ffffff', display: 'grid', placeItems: 'center', flexShrink: 0, ...style }}>
        <svg viewBox="0 0 40 46" width="70%" height="80%">
          <path d="M20 2 37 8v14c0 11-7.5 18.5-17 22C10.5 40.5 3 33 3 22V8z" fill={s.bg} stroke={s.ink === '#ffffff' ? '#00000033' : s.ink} strokeWidth="2" />
          <path d="M20 8v31M9 17h22" stroke={s.ink} strokeWidth="3" opacity=".85" />
        </svg>
      </div>
    )
  }
  return (
    <div aria-hidden style={{
      width: w, height: h, background: s.bg, color: s.ink, display: 'grid', placeItems: 'center', flexShrink: 0,
      border: `2px solid ${C.text}`, fontFamily: FONT, fontWeight: 800, fontSize: (typeof h === 'number' ? Math.min(w, h) : w) * (big ? 0.3 : 0.3), letterSpacing: '-0.02em', ...style,
    }}>{label ? s.code : ''}</div>
  )
}

// Price box: "₭0.40" in a bordered square; magenta when it's the leading/backed outcome
export function PriceBox({ cents, tone, style }) {
  const tones = {
    lead: { background: C.accent, borderColor: C.accent, color: '#fff' },
    win: { background: C.yes, borderColor: C.yes, color: '#fff' },
    lose: { background: C.no, borderColor: C.no, color: '#fff' },
  }
  return (
    <span style={{
      display: 'inline-block', minWidth: 58, textAlign: 'center', padding: '4px 6px', border: `1px solid ${C.lineLight}`, fontWeight: 700,
      fontSize: 15, color: C.text, ...num, ...tones[tone], ...style,
    }}>{fmt.cents(cents)}</span>
  )
}

// Top strip of every opinion card: "1,209 Players | Ends in 86d   ⇪"
export function Strip({ players, endsAt, state, onShare, children, tone }) {
  const tones = { profit: [C.yesBg, C.yes], loss: [C.noBg, C.no] }
  const [bg, border] = tones[tone] || [C.surface3, C.surface3]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: bg, border: `1px solid ${border}`, fontSize: 13, color: C.muted, fontWeight: 600 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: children ? '2px 8px' : 8, alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', flexWrap: children ? 'wrap' : 'nowrap', fontSize: children ? 12 : 13 }}>
        {children || (
          <>
            <span><span style={{ color: C.accent, ...num }}>{fmt.shares(players || 0)}</span> <span style={{ color: C.accent }}>Players</span></span>
            <span style={{ color: C.lineLight }}>|</span>
            <span>{state && state !== 'open' ? (state === 'closed' ? 'In play · awaiting result' : 'Settled') : <>Ends in <strong style={{ color: C.text2 }}>{fmt.endsIn(endsAt)}</strong></>}</span>
          </>
        )}
      </div>
      {onShare && <button onClick={e => { e.preventDefault(); e.stopPropagation(); onShare() }} aria-label="Share" style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: C.text2, display: 'grid' }}><Icon name="share" size={18} /></button>}
    </div>
  )
}

export function Icon({ name, size = 22, color = 'currentColor' }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  switch (name) {
    case 'news': return <svg {...p}><rect x="3" y="4" width="14" height="16" rx="2" /><path d="M17 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7" /><path d="M7 8h6M7 12h6M7 16h4" /></svg>
    case 'calendar': return <svg {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /><circle cx="9" cy="15" r="1.2" /><circle cx="15" cy="15" r="1.2" /></svg>
    case 'home': return <svg {...p}><path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
    case 'wallet': return <svg {...p}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M16 13h2M3 9h18M6 6V4.5A1.5 1.5 0 0 1 7.5 3H17" /></svg>
    case 'profile': return <svg {...p}><rect x="4" y="3" width="16" height="18" rx="3" /><circle cx="12" cy="10" r="3" /><path d="M7.5 18c1-2.2 2.6-3.3 4.5-3.3s3.5 1.1 4.5 3.3" /></svg>
    case 'search': return <svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
    case 'filter': return <svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
    case 'share': return <svg {...p}><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>
    case 'heart': return <svg {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
    case 'heartFill': return <svg {...p} fill={color}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
    case 'star': return <svg {...p} fill={color}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>
    case 'plus': return <svg {...p}><path d="M12 5v14M5 12h14" /></svg>
    case 'x': return <svg {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
    case 'arrow': return <svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    case 'down': return <svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
    case 'chev': return <svg {...p}><path d="m6 9 6 6 6-6" /></svg>
    case 'left': return <svg {...p}><path d="m15 6-6 6 6 6" /></svg>
    case 'right': return <svg {...p}><path d="m9 6 6 6-6 6" /></svg>
    case 'trend': return <svg {...p}><path d="m3 17 6-6 4 4 8-8M15 7h6v6" /></svg>
    case 'sparkle': return <svg {...p} fill={color} stroke="none"><path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8zM5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6z" /></svg>
    default: return null
  }
}

// White search field + outlined filter button (deck header)
export function SearchBar({ value, onChange, placeholder, onFilter }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <label style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: C.field, color: '#6b6b6b', padding: '0 12px', borderRadius: 2 }}>
        <Icon name="search" size={20} />
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label="Search"
          style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: C.fieldInk, fontSize: 15, padding: '11px 0', fontFamily: FONT, fontWeight: 600 }} />
      </label>
      {onFilter && (
        <button onClick={onFilter} aria-label="Filters" style={{ width: 46, background: 'transparent', border: `1px solid ${C.text}`, borderRadius: 2, color: C.text, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
          <Icon name="filter" size={22} />
        </button>
      )}
    </div>
  )
}

// "✦ Ask for data-backed insights on Opinions & Football ✦"
export function InsightsBar({ onClick, text }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', cursor: 'pointer',
      background: 'transparent', border: `1px solid ${C.text2}`, borderRadius: 2, color: C.muted, fontSize: 14, fontFamily: FONT, textAlign: 'left',
    }}>
      <Icon name="sparkle" size={18} color={C.accent} />
      <span style={{ flex: 1 }}>{text || <><strong style={{ color: C.text2 }}>Ask</strong> for data-backed insights on <strong style={{ color: C.text2 }}>Opinions & Football</strong></>}</span>
      <Icon name="sparkle" size={18} color={C.accent} />
    </button>
  )
}

// Bottom sheet (mobile) / centred panel (desktop)
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const k = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: '#000c', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', background: '#0e0e0e', borderTop: `1px solid ${C.lineLight}`,
        borderLeft: `1px solid ${C.line}`, borderRight: `1px solid ${C.line}`, padding: '14px 16px calc(18px + env(safe-area-inset-bottom, 0px))', animation: 'gk-up .2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ ...display, fontSize: 18 }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: C.text2, cursor: 'pointer', display: 'grid' }}><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Wordmark({ size = 20 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <img src={LOGO} alt="" style={{ height: size * 1.5, width: 'auto' }} />
      <span style={{ ...display, fontSize: size, color: C.text }}>Game Knight</span>
    </span>
  )
}

export const GradientRule = ({ width = 220 }) => (
  <div style={{ height: 2, width, maxWidth: '100%', margin: '10px auto', background: `linear-gradient(90deg, transparent, #ffffff, transparent)` }} />
)
export { GRADIENT }

// ── In-app dialogs (native confirm/alert are blocked in embedded viewers) ─────
function overlay(message, buttons) {
  return new Promise(resolve => {
    const wrap = document.createElement('div')
    wrap.setAttribute('role', 'dialog')
    wrap.setAttribute('aria-modal', 'true')
    Object.assign(wrap.style, { position: 'fixed', inset: '0', zIndex: '100', background: '#000c', display: 'grid', placeItems: 'center', padding: '16px' })
    const box = document.createElement('div')
    Object.assign(box.style, { background: C.surface, border: `1px solid ${C.lineLight}`, borderRadius: '4px', padding: '20px', maxWidth: '380px', width: '100%', fontFamily: FONT })
    const p = document.createElement('p')
    p.textContent = message
    Object.assign(p.style, { margin: '0 0 18px', fontSize: '15px', lineHeight: '1.5', color: C.text, overflowWrap: 'anywhere' })
    const row = document.createElement('div')
    Object.assign(row.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' })
    const close = v => { wrap.remove(); resolve(v) }
    for (const [label, value, primary] of buttons) {
      const b = document.createElement('button')
      b.textContent = label
      Object.assign(b.style, {
        padding: '10px 16px', borderRadius: '3px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', fontFamily: FONT,
        background: primary ? C.accent : 'transparent', color: C.text, border: `1px solid ${primary ? C.accent : C.text}`,
      })
      b.onclick = () => close(value)
      row.appendChild(b)
    }
    wrap.onclick = e => { if (e.target === wrap) close(false) }
    box.append(p, row)
    wrap.appendChild(box)
    document.body.appendChild(wrap)
    row.lastChild.focus()
  })
}
export const confirmDialog = (message, okLabel = 'Confirm') => overlay(message, [['Cancel', false], [okLabel, true, true]])
export const notify = message => overlay(message, [['OK', true, true]])

// Kept for older call sites
export const Crest = ({ name, size = 36 }) => <Tile name={name} w={size} h={size} />
