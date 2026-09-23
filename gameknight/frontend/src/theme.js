import { useEffect, useState } from 'react'

// Floodlit-pitch palette. Series colours are a validated categorical set for dark
// surfaces (blue / orange / aqua) — used for outcomes in charts and price bars.
export const C = {
  bg: '#0b110e',
  surface: '#131a16',
  surface2: '#1a231e',
  line: '#253029',
  text: '#eef3ef',
  text2: '#b3c2b8',
  muted: '#7d8f84',
  accent: '#c6f432',        // floodlight lime — primary actions
  accentInk: '#101a05',
  sell: '#ff7a6b',
  good: '#5ee08a',
  bad: '#ff7a6b',
  series: ['#3987e5', '#d95926', '#199e70'],
}

export const display = { fontFamily: '"Barlow Condensed", Inter, sans-serif', letterSpacing: '0.01em' }

export const fmt = {
  coins: n => `${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KC`,
  coinsShort: n => Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 }),
  pct: p => `${Math.round(p * 100)}%`,
  odds: p => (p > 0 ? (1 / p).toFixed(2) : '—'),
  shares: n => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }),
  signed: n => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  kickoff: iso => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
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
    if (s <= 0) return 'Kicked off'
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
  },
}

export function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 640)
  useEffect(() => {
    const on = () => setM(window.innerWidth <= 640)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return m
}

export const STATE_LABEL = { open: 'Open', awaiting: 'Awaiting result', settled: 'Full time', void: 'Void' }
