import React, { useCallback, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api.js'
import { C, display, fmt, num, useIsMobile, useLive } from './theme.js'
import AuthPage from './AuthPage.jsx'
import HomePage from './HomePage.jsx'
import EventPage from './EventPage.jsx'
import PortfolioPage from './PortfolioPage.jsx'
import LeaderboardPage from './LeaderboardPage.jsx'
import ProfilePage from './ProfilePage.jsx'
import SettingsPage from './SettingsPage.jsx'
import DocsPage from './DocsPage.jsx'
import AdminPage from './AdminPage.jsx'

// Hash routes: #/  #/event/:slug?m=&o=  #/portfolio  #/leaderboard  #/u/:name  #/settings  #/docs  #/admin  #/login
function parseRoute() {
  const [path, search = ''] = window.location.hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  return { page: parts[0] || 'home', id: parts[1], query: Object.fromEntries(new URLSearchParams(search)) }
}

const NAV = [
  { page: 'home', href: '#/', label: 'Markets', icon: '⚽' },
  { page: 'portfolio', href: '#/portfolio', label: 'Portfolio', icon: '💼', auth: true },
  { page: 'leaderboard', href: '#/leaderboard', label: 'Leaderboard', short: 'Ranks', icon: '🏆' },
  { page: 'docs', href: '#/docs', label: 'API', icon: '⌘', desktop: true },
  { page: 'admin', href: '#/admin', label: 'Admin', icon: '🛠', admin: true, desktop: true },
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
  // Positions are marked to market — refresh the balance chip when anything trades
  useLive(m => m.type === 'trade' || m.type === 'event', refreshUser, [])

  const onAuth = ({ token }) => { setToken(token); refreshUser(); window.location.hash = '/' }
  const logout = async () => { try { await api.logout() } catch {} setToken(null); setUser(null); window.location.hash = '/' }
  const claimBonus = async () => { try { await api.claimBonus(); refreshUser() } catch (e) { alert(e.message) } }

  const nav = NAV.filter(n => (!n.auth || user) && (!n.admin || user?.is_admin))
  const needsAuth = ['portfolio', 'admin', 'settings'].includes(route.page) && !user && !booting

  let content = null
  if (booting) content = null
  else if (route.page === 'login' || needsAuth) content = <AuthPage onAuth={onAuth} />
  else if (route.page === 'event') content = <EventPage key={route.id} slug={route.id} query={route.query} user={user} onTrade={refreshUser} />
  else if (route.page === 'portfolio') content = <PortfolioPage onChange={refreshUser} />
  else if (route.page === 'leaderboard') content = <LeaderboardPage me={user} />
  else if (route.page === 'u') content = <ProfilePage key={route.id} username={route.id} />
  else if (route.page === 'settings') content = <SettingsPage user={user} />
  else if (route.page === 'docs') content = <DocsPage />
  else if (route.page === 'admin') content = user?.is_admin ? <AdminPage /> : <HomePage />
  else content = <HomePage />

  const active = n => route.page === n.page || (n.page === 'home' && route.page === 'event')

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(1200px 500px at 50% -220px, #1d3a2a 0%, ${C.bg} 70%)` }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: `${C.bg}e6`, backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 16px', height: 60, display: 'flex', alignItems: 'center', gap: mobile ? 10 : 24 }}>
          <a href="#/" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 28, lineHeight: 1, color: C.accent }}>♞</span>
            {!(mobile && user) && <span style={{ ...display, fontSize: mobile ? 22 : 26, fontWeight: 800, textTransform: 'uppercase' }}>Game<span style={{ color: C.accent }}>Knight</span></span>}
          </a>
          {!mobile && (
            <nav style={{ display: 'flex', gap: 2 }}>
              {nav.map(n => (
                <a key={n.page} href={n.href} style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  color: active(n) ? C.text : C.muted, background: active(n) ? C.surface2 : 'transparent',
                }}>{n.label}</a>
              ))}
            </nav>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <>
                {user.can_claim_bonus && (
                  <button onClick={claimBonus} title="Claim your daily 100 KC" style={{
                    background: 'transparent', border: `1px dashed ${C.accent}`, color: C.accent, borderRadius: 8,
                    padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{mobile ? '🎁 +100' : '+100 daily'}</button>
                )}
                <a href="#/portfolio" style={{ textAlign: 'right', lineHeight: 1.15, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase' }}>Portfolio</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.yes, ...num }}>{fmt.kcShort(user.portfolio)}</div>
                </a>
                {!mobile && (
                  <a href="#/portfolio" style={{ textAlign: 'right', lineHeight: 1.15, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase' }}>Cash</div>
                    <div style={{ fontSize: 14, fontWeight: 700, ...num }}>{fmt.kcShort(user.balance)}</div>
                  </a>
                )}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setMenu(!menu)} aria-label="Account menu" style={{
                    width: 34, height: 34, borderRadius: 99, border: `1px solid ${C.line}`, background: C.surface2, fontWeight: 800, cursor: 'pointer',
                  }}>{user.username[0].toUpperCase()}</button>
                  {menu && (
                    <div style={{ position: 'absolute', right: 0, top: 42, background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 6, minWidth: 180, boxShadow: '0 10px 30px #000a' }}>
                      {[[`#/u/${user.username}`, 'Profile'], ['#/portfolio', 'Portfolio'], ['#/settings', 'Settings & API keys'], ['#/docs', 'API docs'], ...(user.is_admin ? [['#/admin', 'Admin']] : [])].map(([h, t]) => (
                        <a key={h} href={h} style={{ display: 'block', padding: '8px 10px', borderRadius: 6, fontSize: 14 }}>{t}</a>
                      ))}
                      <button onClick={logout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', color: C.no, fontSize: 14, cursor: 'pointer' }}>Sign out</button>
                    </div>
                  )}
                </div>
              </>
            ) : !booting && (
              <>
                {!mobile && <a href="#/login" style={{ color: C.text2, fontWeight: 600, fontSize: 14, padding: '8px 10px' }}>Log in</a>}
                <a href="#/login" style={{ background: C.accent, color: C.accentInk, borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>Sign up</a>
              </>
            )}
          </div>
        </div>
      </header>

      <main key={route.page + (route.id || '')} style={{ maxWidth: 1240, margin: '0 auto', padding: mobile ? '16px 16px 96px' : '28px 16px 48px', animation: 'gk-fade .25s ease' }}>
        {content}
      </main>

      <footer style={{ maxWidth: 1240, margin: '0 auto', padding: mobile ? '0 16px 100px' : '0 16px 32px', color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <span style={{ maxWidth: 760 }}>
            ♞ GameKnight is a <strong style={{ color: C.text2 }}>play-money</strong> football prediction exchange. Knight Coins (KC) have no cash value
            and cannot be bought, sold or withdrawn. No real-money wagering takes place on this site.
          </span>
          <span style={{ display: 'flex', gap: 14 }}><a href="#/docs">API</a><a href="#/leaderboard">Leaderboard</a></span>
        </div>
      </footer>

      {mobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30, display: 'flex', background: `${C.surface}f2`,
          backdropFilter: 'blur(10px)', borderTop: `1px solid ${C.line}`, paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {[...nav.filter(n => !n.desktop), user ? { page: 'u', href: `#/u/${user.username}`, label: 'Me', icon: '👤' } : { page: 'login', href: '#/login', label: 'Sign up', icon: '👤' }].map(n => (
            <a key={n.page} href={n.href} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 0 8px',
              fontSize: 11, fontWeight: 600, color: active(n) ? C.accent : C.muted,
            }}>
              <span style={{ fontSize: 18, filter: active(n) ? 'none' : 'grayscale(1)' }}>{n.icon}</span>{n.short || n.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}
