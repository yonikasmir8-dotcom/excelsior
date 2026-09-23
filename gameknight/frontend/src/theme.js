import { useEffect, useRef, useState } from 'react'
import { subscribe } from './api.js'

// Floodlit-pitch palette. Series colours are a validated categorical set for the
// dark surface (blue / orange / aqua / amber) — used for outcome lines in charts.
export const C = {
  bg: '#0b110e',
  surface: '#131a16',
  surface2: '#1a231e',
  surface3: '#222d27',
  line: '#253029',
  text: '#eef3ef',
  text2: '#b3c2b8',
  muted: '#7d8f84',
  accent: '#c6f432',
  accentInk: '#101a05',
  yes: '#3ecf7a',
  no: '#ff6b5e',
  yesBg: '#3ecf7a1f',
  noBg: '#ff6b5e1f',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500'],
}

export const display = { fontFamily: '"Barlow Condensed", Inter, sans-serif', letterSpacing: '0.01em' }
export const num = { fontVariantNumeric: 'tabular-nums' }

const n2 = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
export const fmt = {
  kc: cents => `${(cents / 100).toLocaleString(undefined, n2)} KC`,
  kcShort: cents => {
    const v = cents / 100
    if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    if (Math.abs(v) >= 1e4) return `${(v / 1e3).toFixed(0)}K`
    if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`
    return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  },
  signed: cents => `${cents >= 0 ? '+' : '−'}${(Math.abs(cents) / 100).toLocaleString(undefined, n2)}`,
  cents: c => (c == null ? '—' : `${Math.round(c * 10) / 10}¢`),
  pct: c => (c == null ? '—' : c < 1 ? '<1%' : c > 99 ? '>99%' : `${Math.round(c)}%`),
  shares: n => Number(n).toLocaleString(),
  kickoff: iso => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  date: iso => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
  time: iso => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  ago: iso => {
    const s = (Date.now() - new Date(iso)) / 1000
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  },
  countdown: iso => {
    const s = (new Date(iso) - Date.now()) / 1000
    if (s <= 0) return 'Closed'
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
    return d > 60 ? fmt.date(iso) : d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
  },
}

export function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 720)
  useEffect(() => {
    const on = () => setM(window.innerWidth <= 720)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return m
}

// Re-run `fn` when a live message passes `filter`, throttled so bursts coalesce.
export function useLive(filter, fn, deps = []) {
  const ref = useRef({ fn, filter })
  ref.current = { fn, filter }
  useEffect(() => {
    let t = null
    const un = subscribe(msg => {
      if (!ref.current.filter(msg)) return
      if (t) return
      t = setTimeout(() => { t = null; ref.current.fn(msg) }, 400)
    })
    return () => { un(); clearTimeout(t) }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

export const STATE_LABEL = { open: 'Live', closed: 'Awaiting result', resolved: 'Resolved', void: 'Void' }
