import React, { useCallback, useEffect, useState } from 'react'
import { api, getToken, setToken } from './api.js'
import { C, display, fmt, useIsMobile } from './theme.js'
import AuthPage from './AuthPage.jsx'
import MarketsPage from './MarketsPage.jsx'
import MatchPage from './MatchPage.jsx'
import PortfolioPage from './PortfolioPage.jsx'
import LeaderboardPage from './LeaderboardPage.jsx'
import AdminPage from './AdminPage.jsx'

// Hash routes: #/  #/match/:id  #/portfolio  #/leaderboard  #/admin  #/login
function parseRoute() {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  return { page: parts[0] || 'markets', id: parts[1] }
}
export const go = path => { window.location.hash = path }

const NAV = [
  { page: 'markets', href: '#/', label: 'Markets', icon: '⚽' },
  { page: 'portfolio', href: '#/portfolio', label: 'Portfolio', icon: '💼', auth: true },
  { page: 'leaderboard', href: '#/leaderboard', label: 'Table', icon: '🏆' },
  { page: 'admin', href: '#/admin', label: 'Admin', icon: '🛠', admin: true },
]

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(!!getToken())
  const mobile = useIsMobile()

  useEffect(() => {
    const on = () => { setRoute(parseRoute()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!getToken()) return setUser(null)
    try { setUser(await api.me()) } catch (e) { if (e.status === 401) { setToken(null); setUser(null) } }
  }, [])

  useEffect(() => { refreshUser().finally(() => setBooting(false)) }, [refreshUser])

  const onAuth = ({ token, user }) => { setToken(token); setUser(user); refreshUser(); go('/') }
  const logout = async () => { try { await api.logout() } catch {} setToken(null); setUser(null); go('/') }

  const claimBonus = async () => {
    try { await api.claimBonus(); refreshUser() } catch (e) { alert(e.message) }
  }

  const nav = NAV.filter(n => (!n.auth || user) && (!n.admin || user?.is_admin))
  const needsAuth = ['portfolio', 'admin'].includes(route.page) && !user && !booting

  let content
  if (booting) content = null
  else if (route.page === 'login' || needsAuth) content = <AuthPage onAuth={onAuth} />
  else if (route.page === 'match') content = <MatchPage id={route.id} user={user} onTrade={refreshUser} />
  else if (route.page === 'portfolio') content = <PortfolioPage />
  else if (route.page === 'leaderboard') content = <LeaderboardPage me={user} />
  else if (route.page === 'admin') content = user?.is_admin ? <AdminPage /> : <MarketsPage />
  else content = <MarketsPage />

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(1200px 500px at 50% -200px, #1d3a2a 0%, ${C.bg} 70%)` }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 20, background: `${C.bg}e6`, backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${C.line}`,
      }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 16px', height: 60, display: 'flex', alignItems: 'center', gap: mobile ? 12 : 24 }}>
          <a href="#/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 28, lineHeight: 1, color: C.accent }}>♞</span>
            <span style={{ ...display, fontSize: mobile ? 22 : 26, fontWeight: 800, textTransform: 'uppercase' }}>
              Game<span style={{ color: C.accent }}>Knight</span>
            </span>
          </a>
          {!mobile && (
            <nav style={{ display: 'flex', gap: 4 }}>
              {nav.map(n => (
                <a key={n.page} href={n.href} style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                  color: route.page === n.page || (n.page === 'markets' && route.page === 'match') ? C.text : C.muted,
                  background: route.page === n.page ? C.surface2 : 'transparent',
                }}>{n.label}</a>
              ))}
            </nav>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {user ? (
              <>
                {user.can_claim_bonus && (
                  <button onClick={claimBonus} title="Claim your daily 100 KC" style={{
                    background: 'transparent', border: `1px dashed ${C.accent}`, color: C.accent, borderRadius: 8,
                    padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{mobile ? '+100' : '+100 daily'}</button>
                )}
                <a href="#/portfolio" title="Your balance" style={{
                  background: C.surface2, border: `1px solid ${C.line}`, borderRadius: 8, padding: '6px 12px',
                  fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap',
                }}>
                  <span style={{ color: C.accent }}>●</span> {fmt.coinsShort(user.balance)} <span style={{ color: C.muted, fontWeight: 500 }}>KC</span>
                </a>
                {!mobile && (
                  <button onClick={logout} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13 }}>
                    {user.username} · Sign out
                  </button>
                )}
              </>
            ) : !booting && (
              <a href="#/login" style={{ background: C.accent, color: C.accentInk, borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 14 }}>
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: mobile ? '16px 16px 96px' : '28px 16px 48px', animation: 'gk-fade .25s ease' }} key={route.page + (route.id || '')}>
        {content}
      </main>

      <footer style={{ maxWidth: 1180, margin: '0 auto', padding: mobile ? '0 16px 100px' : '0 16px 32px', color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
          ♞ GameKnight is a <strong style={{ color: C.text2 }}>play-money</strong> football prediction market. Knight Coins (KC) have no cash value
          and cannot be bought, sold or withdrawn. No real-money wagering takes place on this site.
          {mobile && user && <> · <button onClick={logout} style={{ background: 'none', border: 'none', color: C.text2, padding: 0, textDecoration: 'underline', fontSize: 12 }}>Sign out {user.username}</button></>}
        </div>
      </footer>

      {mobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30, display: 'flex', background: `${C.surface}f2`,
          backdropFilter: 'blur(10px)', borderTop: `1px solid ${C.line}`, paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {(user ? nav : [...nav, { page: 'login', href: '#/login', label: 'Sign in', icon: '👤' }]).map(n => {
            const active = route.page === n.page || (n.page === 'markets' && route.page === 'match')
            return (
              <a key={n.page} href={n.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 0 8px',
                fontSize: 11, fontWeight: 600, color: active ? C.accent : C.muted,
              }}>
                <span style={{ fontSize: 18, filter: active ? 'none' : 'grayscale(1)' }}>{n.icon}</span>{n.label}
              </a>
            )
          })}
        </nav>
      )}
    </div>
  )
}
