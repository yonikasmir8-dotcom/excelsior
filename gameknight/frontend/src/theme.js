import { useEffect, useRef, useState } from 'react'
import { subscribe } from './api.js'
import CRESTS from './crests.json'

// Game Knight design tokens — lifted from the pitch deck: true-black canvas with a
// purple cast at the top of the screen, #171717 cards on #303030 strips, magenta
// (#d103e6) for the backed outcome and active tab, green for Buy/profit, red for loss.
export const C = {
  bg: '#000000',
  bgTop: '#0c000e',
  surface: '#171717',
  surface2: '#222222',
  surface3: '#303030',
  line: '#303030',
  lineLight: '#4a4a4a',
  text: '#ffffff',
  text2: '#cccccc',
  muted: '#a3a1a4',
  accent: '#d103e6',         // magenta — selection, active nav, "Yoni"
  accentInk: '#ffffff',
  purple: '#80138a',
  yes: '#1ec31e',            // Buy button, profit, Yes line
  yesText: '#3be23b',
  no: '#e00000',             // loss, No line
  noText: '#ff4040',
  yesBg: '#1ec31e22',
  noBg: '#e0000022',
  field: '#ffffff',          // the deck's white search / units fields
  fieldInk: '#171717',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500'],
}

export const GRADIENT = 'linear-gradient(135deg, #ff2d3b 0%, #f0106f 45%, #d103e6 100%)'
export const FONT = '"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif'
export const display = { fontFamily: FONT, fontWeight: 700, letterSpacing: '-0.01em' }
export const num = { fontVariantNumeric: 'tabular-nums' }

// Knight Coins: 100 units of price = ₭1.00. Play money, no cash value.
// Currency symbol comes from the server (/api/config): ₭ for play money, £ for real money
export let CUR = '₭'
export const setCurrency = sym => { CUR = sym }
const n2 = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
export const fmt = {
  kc: cents => `${cents < 0 ? '−' : ''}${CUR}${(Math.abs(cents) / 100).toLocaleString('en-GB', n2)}`,
  kcShort: cents => {
    const v = Math.abs(cents) / 100, sign = cents < 0 ? '−' : ''
    if (v >= 1e6) return `${sign}${CUR}${(v / 1e6).toFixed(1)}M`
    if (v >= 1e4) return `${sign}${CUR}${(v / 1e3).toFixed(0)}K`
    if (v >= 1e3) return `${sign}${CUR}${(v / 1e3).toFixed(1)}K`
    return `${sign}${CUR}${v.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
  },
  signed: cents => `${cents >= 0 ? '+' : '−'}${CUR}${(Math.abs(cents) / 100).toLocaleString('en-GB', n2)}`,
  // Price per unit, e.g. 54 → ₭0.54
  cents: c => (c == null ? '—' : `${CUR}${(c / 100).toFixed(2)}`),
  pct: c => (c == null ? '—' : c < 1 ? '<1%' : c > 99 ? '>99%' : `${Math.round(c)}%`),
  shares: n => Number(n).toLocaleString('en-GB'),
  kickoff: iso => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  date: iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  time: iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  ago: iso => {
    const s = (Date.now() - new Date(iso)) / 1000
    if (s < 60) return 'now'
    if (s < 3600) return `${Math.floor(s / 60)}m`
    if (s < 86400) return `${Math.floor(s / 3600)}h`
    if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`
    return `${Math.floor(s / (7 * 86400))}w`
  },
  // "Ends in 74d" / "20m"
  endsIn: iso => {
    const s = (new Date(iso) - Date.now()) / 1000
    if (s <= 0) return 'Closed'
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
    return d ? `${d}d` : h ? `${h}h ${m}m` : `${m}m`
  },
  countdown: iso => fmt.endsIn(iso),
}

// Club colours + three-letter codes, as on the deck's calendar tiles
const CLUBS = {
  Arsenal: ['#db0007', '#ffffff', 'ARS'], Chelsea: ['#034694', '#ffffff', 'CHE'], Liverpool: ['#c8102e', '#ffffff', 'LIV'],
  'Manchester City': ['#6cabdd', '#1c2c5b', 'MCI'], 'Manchester United': ['#da291c', '#fbe122', 'MUN'], 'Tottenham Hotspur': ['#ffffff', '#132257', 'TOT'],
  'Newcastle United': ['#241f20', '#ffffff', 'NEW'], 'Aston Villa': ['#670e36', '#95bfe5', 'AVL'], Brighton: ['#0057b8', '#ffffff', 'BHA'],
  Brentford: ['#e30613', '#ffffff', 'BRE'], Everton: ['#003399', '#ffffff', 'EVE'], Fulham: ['#ffffff', '#000000', 'FUL'],
  'West Ham United': ['#7a263a', '#1bb1e7', 'WHU'], 'Crystal Palace': ['#1b458f', '#c4122e', 'CRY'], 'Nottingham Forest': ['#dd0000', '#ffffff', 'NFO'],
  Bournemouth: ['#da291c', '#000000', 'BOU'], Leeds: ['#ffffff', '#1d428a', 'LEE'], Burnley: ['#6c1d45', '#99d6ea', 'BUR'],
  'Real Madrid': ['#ffffff', '#00529f', 'RMA'], Barcelona: ['#a50044', '#edbb00', 'FCB'], 'Atlético Madrid': ['#cb3524', '#ffffff', 'ATM'],
  Sevilla: ['#ffffff', '#d71920', 'SEV'], 'Real Sociedad': ['#0067b1', '#ffffff', 'RSO'], Villarreal: ['#ffe667', '#005187', 'VIL'],
  'Athletic Club': ['#ee2523', '#ffffff', 'ATH'], 'Real Betis': ['#0bb363', '#ffffff', 'BET'], Inter: ['#010e80', '#ffffff', 'INT'],
  Juventus: ['#000000', '#ffffff', 'JUV'], Napoli: ['#12a0d7', '#ffffff', 'NAP'], 'AC Milan': ['#fb090b', '#000000', 'MIL'],
  Roma: ['#8e1f2f', '#f0bc42', 'ROM'], Atalanta: ['#1e71b8', '#000000', 'ATA'], Lazio: ['#87d8f7', '#15366b', 'LAZ'],
  Fiorentina: ['#482e92', '#ffffff', 'FIO'], 'Bayern Munich': ['#dc052d', '#ffffff', 'BAY'], 'Borussia Dortmund': ['#fde100', '#000000', 'BVB'],
  'Bayer Leverkusen': ['#e32221', '#000000', 'B04'], 'RB Leipzig': ['#dd0741', '#ffffff', 'RBL'], 'Eintracht Frankfurt': ['#e1000f', '#000000', 'SGE'],
  Stuttgart: ['#e32219', '#ffffff', 'VFB'], 'Paris Saint-Germain': ['#004170', '#da291c', 'PSG'], Marseille: ['#2faee0', '#ffffff', 'OM'],
}
const COMPS = {
  'Premier League': ['#80138a', '#ffffff', 'PL'], 'Champions League': ['#0c3e6f', '#ffffff', 'UCL'], 'La Liga': ['#ee8707', '#ffffff', 'LL'],
  'Serie A': ['#024494', '#ffffff', 'SA'], Bundesliga: ['#d20515', '#ffffff', 'BL'], 'Ligue 1': ['#091c3e', '#dae025', 'L1'],
  'FA Cup': ['#0c3e6f', '#ffffff', 'FAC'],
}

function hashHue(name) { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360; return h }
const initials = name => name.split(/\s+/).filter(w => !/^(fc|cf|ac|de|the|of)$/i.test(w)).map(w => w[0]).join('').slice(0, 3).toUpperCase()

export function clubStyle(name = '') {
  if (CLUBS[name]) return { bg: CLUBS[name][0], ink: CLUBS[name][1], code: CLUBS[name][2] }
  if (COMPS[name]) return { bg: COMPS[name][0], ink: COMPS[name][1], code: COMPS[name][2] }
  const h = hashHue(name)
  return { bg: `hsl(${h} 55% 32%)`, ink: '#ffffff', code: initials(name) || '?' }
}
export const compStyle = name => (COMPS[name] ? { bg: COMPS[name][0], ink: COMPS[name][1], code: COMPS[name][2] } : clubStyle(name))

// Crest URLs (football-logos.cc via the football-logos package). Standalone builds swap in
// embedded data: URIs when the build machine could download them.
const normName = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\b(fc|afc|cf|ac|as|sc|vfb|rc|ssc|calcio|club|de|logo)\b/g, '').replace(/[^a-z0-9]/g, '')
export function crestUrl(name = '') {
  const u = CRESTS.comps[name] || CRESTS.teams[normName(name)]
  if (!u) return null
  return globalThis.__GK_CRESTS?.[u] ?? (globalThis.__GK_CRESTS_ONLY ? null : u)
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

export async function share({ title, path }) {
  const url = `${location.origin}${location.pathname}#${path}`
  try {
    if (navigator.share) { await navigator.share({ title, url }); return 'shared' }
  } catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  try { await navigator.clipboard.writeText(url); return 'copied' } catch { return url }
}

export const STATE_LABEL = { open: 'Live', closed: 'Awaiting result', resolved: 'Resolved', void: 'Void' }
