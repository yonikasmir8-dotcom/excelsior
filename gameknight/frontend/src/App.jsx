import React, { useCallback, useEffect, useState } from 'react'
import { api, getToken, setToken, STANDALONE } from './api.js'
import { C, FONT, clubStyle, display, fmt, num, useIsMobile, useLive } from './theme.js'
import { Crest, Icon, LOGO, notify } from './ui.jsx'
import { Toaster } from './fx.jsx'
import { loadFollows } from './opinion.jsx'
import AuthPage from './AuthPage.jsx'
import HomePage from './HomePage.jsx'
import EventPage from './EventPage.jsx'
import CalendarPage from './CalendarPage.jsx'
import NewsPage from './NewsPage.jsx'
import PortfolioPage from './PortfolioPage.jsx'
import LeaderboardPage from './LeaderboardPage.jsx'
import ProfilePage from './ProfilePage.jsx'
import SettingsPage from './SettingsPage.jsx'
import DocsPage from './DocsPage.jsx'
import AdminPage from './AdminPage.jsx'

// Hash routes: #/  #/event/:slug?g=&m=&o=  #/calendar  #/news  #/opinions  #/profile  #/u/:name
//              #/leaderboard  #/settings  #/docs  #/admin  #/login
function parseRoute() {
  const [path, search = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  const page = { portfolio: 'opinions' }[parts[0]] || parts[0] || 'home'
  return { page, id: parts[1], query: Object.fromEntries(new URLSearchParams(search)) }
}

// The deck's five tabs, Home in the middle
const NAV = [
  { page: 'news', href: '#/news', label: 'News', icon: 'news' },
  { page: 'calendar', href: '#/calendar', label: 'Calendar', icon: 'calendar' },
  { page: 'home', href: '#/', label: 'Home', icon: 'home' },
  { page: 'opinions', href: '#/opinions', label: 'Opinions', icon: 'wallet' },
  { page: 'profile', href: '#/profile', label: 'Profile', icon: 'profile' },
]

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(!!getToken())
  const [menu, setMenu] = useState(false)
  const mobile = useIsMobile()

  useEffect(() => {
    const on = () => { setRoute(parseRoute()); setMenu(false); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!getToken()) return setUser(null)
    try { setUser(await api.me()) } catch (e) { if (e.status === 401) { setToken(null); setUser(null) } }
  }, [])
  useEffect(() => { refreshUser().finally(() => setBooting(false)) }, [refreshUser])
  useLive(m => m.type === 'trade' || m.type === 'event', refreshUser, [])

  const onAuth = ({ token }) => { setToken(token); refreshUser(); loadFollows(); window.location.hash = '/' }
  const logout = async () => { try { await api.logout() } catch {} setToken(null); setUser(null); loadFollows(); window.location.hash = '/' }
  const claimBonus = async () => { try { await api.claimBonus(); refreshUser(); notify(`${fmt.kc(10000)} daily bonus added. Come back tomorrow for more.`) } catch (e) { notify(e.message) } }

  const needsAuth = ['opinions', 'admin', 'settings', 'profile'].includes(route.page) && !user && !booting
  const active = n => route.page === n.page || (n.page === 'home' && route.page === 'event')

  let content = null
  if (booting) content = null
  else if (route.page === 'login' || needsAuth) content = <AuthPage onAuth={onAuth} />
  else if (route.page === 'event') content = <EventPage key={route.id} slug={route.id} query={route.query} user={user} onTrade={refreshUser} />
  else if (route.page === 'calendar') content = <CalendarPage />
  else if (route.page === 'news') content = <NewsPage />
  else if (route.page === 'opinions') content = <PortfolioPage user={user} onChange={refreshUser} onBonus={claimBonus} />
  else if (route.page === 'leaderboard') content = <LeaderboardPage me={user} />
  else if (route.page === 'profile') content = <ProfilePage key="me" username={user.username} me={user} onLogout={logout} onBonus={claimBonus} />
  else if (route.page === 'u') content = <ProfilePage key={route.id} username={route.id} me={user} onLogout={logout} onBonus={claimBonus} />
  else if (route.page === 'settings') content = <SettingsPage user={user} />
  else if (route.page === 'docs') content = <DocsPage />
  else if (route.page === 'admin') content = user?.is_admin ? <AdminPage /> : <HomePage user={user} />
  else content = <HomePage user={user} />

  const greeting = (
    <div style={{ position: 'relative' }}>
      <button onClick={() => (user ? setMenu(!menu) : (window.location.hash = '/login'))} style={{
        background: 'none', border: 'none', color: C.text, fontSize: mobile ? 19 : 16, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONT, padding: '6px 4px', whiteSpace: 'nowrap',
      }}>
        {user
          ? <>Hey, <strong style={{ color: C.accent, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.username}</strong><Icon name="chev" size={16} /></>
          : <>Hey, <strong style={{ color: C.accent }}>fan</strong><span style={{ fontSize: 14, fontWeight: 700, marginLeft: 8, textDecoration: 'underline' }}>Sign in</span></>}
      </button>
      {menu && user && (
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: 42, background: C.surface, border: `1px solid ${C.lineLight}`, padding: 6, minWidth: 210, zIndex: 40, boxShadow: '0 12px 30px #000' }}>
          {[['#/profile', 'Profile'], ['#/opinions', 'My opinions'], ['#/leaderboard', 'Leaderboard'], ['#/settings', STANDALONE ? 'Settings' : 'Settings & API keys'],
            ...(!STANDALONE ? [['#/docs', 'API docs']] : []), ...(user.is_admin ? [['#/admin', 'Admin']] : [])].map(([h, t]) => (
            <a key={h} href={h} style={{ display: 'block', padding: '9px 10px', fontSize: 15 }}>{t}</a>
          ))}
          {user.can_claim_bonus && <button onClick={() => { setMenu(false); claimBonus() }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', background: 'none', border: 'none', color: C.accent, fontSize: 15, cursor: 'pointer', fontWeight: 700 }}>Claim daily {fmt.kc(10000)}</button>}
          <button onClick={logout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', background: 'none', border: 'none', color: C.noText, fontSize: 15, cursor: 'pointer' }}>Sign out</button>
        </div>
      )}
    </div>
  )

  const balance = user && (
    <a href="#/opinions" title="Your Knight Coins" style={{ border: `1px solid ${C.line}`, padding: '5px 8px', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', ...num }}>
      {fmt.kcShort(user.balance)}
    </a>
  )

  return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${C.bgTop} 0, ${C.bg} 320px)`, color: C.text, fontFamily: FONT }}>
      <header style={{ position: 'sticky', top: 'env(safe-area-inset-top, 0px)', zIndex: 30, background: `${C.bgTop}f2`, backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 16px', height: mobile ? 58 : 64, display: 'grid', gridTemplateColumns: mobile ? '56px 1fr 56px' : 'auto minmax(0,1fr) auto auto', alignItems: 'center', gap: mobile ? 8 : 20 }}>
          <a href="#/" aria-label="Game Knight home" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src={LOGO} alt="" style={{ height: 38, width: 'auto' }} />
            {!mobile && <span style={{ ...display, fontSize: 19 }}>Game Knight</span>}
          </a>
          {mobile ? <div style={{ justifySelf: 'center', minWidth: 0 }}>{greeting}</div> : <GlobalSearch />}
          {!mobile && (
            <nav style={{ display: 'flex', gap: 2 }}>
              {NAV.map(n => (
                <a key={n.page} href={n.href} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 11px', fontSize: 15, fontWeight: 700, color: active(n) ? C.accent : C.text2 }}>
                  <Icon name={n.icon} size={19} />{n.label}
                </a>
              ))}
            </nav>
          )}
          <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 10 }}>
            {!mobile && greeting}
            {balance}
          </div>
        </div>
      </header>

      <main key={route.page + (route.id || '')} style={{ maxWidth: ['home', 'event'].includes(route.page) ? 1280 : ['admin', 'docs'].includes(route.page) ? 1000 : 760, margin: '0 auto', padding: mobile ? '14px 16px 100px' : '24px 16px 56px', animation: 'gk-fade .2s ease' }}>
        {content}
      </main>

      <Toaster />
      <footer style={{ maxWidth: 1280, margin: '0 auto', padding: mobile ? '0 16px 104px' : '0 16px 32px', color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          {STANDALONE && <strong style={{ color: C.accent }}>On-device demo: everything runs and is saved on this phone. </strong>}
          Game Knight uses Knight Coins ({fmt.kc(100)} each), a play-money currency with no cash value.
          Coins can't be bought, sold or withdrawn, and no real-money wagering takes place.
        </div>
      </footer>

      {mobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30, display: 'flex', background: '#0b0b0bf2', backdropFilter: 'blur(10px)',
          borderTop: `1px solid ${C.line}`, paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {NAV.map(n => (
            <a key={n.page} href={n.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '9px 0 8px',
              fontSize: 12, fontWeight: 700, color: active(n) ? C.accent : C.text,
            }}>
              <Icon name={n.icon} size={24} />{n.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}

// Header search with instant results (desktop)
function GlobalSearch() {
  const [q, setQ] = React.useState('')
  const [res, setRes] = React.useState(null)
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (!q.trim()) { setRes(null); return }
    const t = setTimeout(() => api.events({ q: q.trim().replace(/^#/, ''), status: 'all', sort: 'volume' }).then(r => setRes(r.slice(0, 7))).catch(() => setRes([])), 180)
    return () => clearTimeout(t)
  }, [q])
  const goTo = slug => { setOpen(false); setQ(''); window.location.hash = `/event/${slug}` }
  return (
    <div style={{ position: 'relative', maxWidth: 440, width: '100%' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#161616', border: `1px solid ${C.line}`, padding: '0 12px', color: C.muted }}>
        <Icon name="search" size={18} />
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={e => { if (e.key === 'Enter' && res?.[0]) goTo(res[0].slug) }}
          placeholder="Search teams, players, leagues" aria-label="Search opinions"
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: C.text, padding: '10px 0', fontSize: 14, fontFamily: FONT }} />
        <kbd style={{ fontSize: 11, color: C.muted, border: `1px solid ${C.line}`, padding: '1px 5px' }}>↵</kbd>
      </label>
      {open && res && (
        <div style={{ position: 'absolute', top: 44, left: 0, right: 0, background: '#121212', border: `1px solid ${C.lineLight}`, boxShadow: '0 20px 50px #000', zIndex: 50 }}>
          {!res.length && <div style={{ padding: 14, color: C.muted, fontSize: 14 }}>No opinions match “{q}”.</div>}
          {res.map(ev => {
            const lead = [...ev.markets].filter(m => ['result', 'winner'].includes(m.grp)).sort((a, b) => b.price - a.price)[0]
            return (
              <button key={ev.id} onMouseDown={() => goTo(ev.slug)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', background: 'none', border: 'none', borderTop: `1px solid ${C.line}`, color: C.text, cursor: 'pointer', textAlign: 'left', fontFamily: FONT }}>
                {ev.kind === 'match' ? <span style={{ display: 'flex' }}><Crest name={ev.home} size={22} /><Crest name={ev.away} size={22} /></span> : <Crest name={ev.competition} size={24} />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{ev.competition}</span>
                </span>
                {lead && <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', ...num }}>{clubStyle(lead.label).code} <span style={{ color: C.accent }}>{fmt.pct(lead.price)}</span></span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
