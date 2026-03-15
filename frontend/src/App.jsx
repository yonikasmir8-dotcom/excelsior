import { useEffect, useState } from 'react'
import { SignedIn, SignedOut, useAuth } from '@clerk/react'
import AuthPage from './AuthPage.jsx'
import AliasSetup from './AliasSetup.jsx'
import MainApp from './MainApp.jsx'
import PublicProfile from './PublicProfile.jsx'
import { api } from './api.js'

// Simple hash router — supports #/u/:alias for public profiles
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/')
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash
}

export default function App() {
  const hash = useHashRoute()

  // Public profile route — no login required
  const profileMatch = hash.match(/^#\/u\/([a-z0-9_-]+)$/i)
  if (profileMatch) {
    return <PublicProfile alias={profileMatch[1].toLowerCase()} />
  }

  return (
    <>
      <SignedOut>
        <AuthPage />
      </SignedOut>
      <SignedIn>
        <AuthenticatedApp />
      </SignedIn>
    </>
  )
}

function AuthenticatedApp() {
  const { getToken, isLoaded } = useAuth()
  const [alias, setAlias]           = useState(undefined)
  const [showAliasBanner, setShowAliasBanner] = useState(false)
  const [showAliasSetup, setShowAliasSetup]   = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    api.alias.mine(getToken)
      .then(({ alias: a }) => {
        setAlias(a)
        if (!a) {
          // Check how many times we've been dismissed
          const dismissCount = parseInt(localStorage.getItem('alias_dismiss_count') || '0')
          if (dismissCount === 0) {
            // First time — show full setup page
            setShowAliasSetup(true)
          } else if (dismissCount <= 2) {
            // Subsequent visits — show gentle banner
            setShowAliasBanner(true)
          }
          // After 2 dismissals — stop showing
        }
      })
      .catch(() => { setAlias(null) })
  }, [isLoaded, getToken])

  const handleAliasSkip = () => {
    const count = parseInt(localStorage.getItem('alias_dismiss_count') || '0')
    localStorage.setItem('alias_dismiss_count', String(count + 1))
    setShowAliasSetup(false)
    setShowAliasBanner(false)
    if (alias === undefined) setAlias(null)
  }

  const handleAliasComplete = () => {
    api.alias.mine(getToken)
      .then(({ alias: a }) => { setAlias(a); setShowAliasSetup(false); setShowAliasBanner(false) })
      .catch(() => { setShowAliasSetup(false) })
  }

  if (alias === undefined && !showAliasSetup) return (
    <div style={{ minHeight:'100vh', background:'var(--ink)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem' }}>
      <div style={{ fontFamily:"'Bangers',cursive", fontSize:'3rem', color:'var(--yellow)', textShadow:'3px 3px 0 var(--red)', animation:'bang 2s ease-in-out infinite' }}>EXCELSIOR!</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'0.7rem', color:'var(--muted)', letterSpacing:'0.15em', textTransform:'uppercase' }}>Loading your collection…</div>
    </div>
  )

  // First time — full-page alias setup
  if (showAliasSetup) return (
    <AliasSetup onComplete={handleAliasComplete} onSkip={handleAliasSkip} />
  )

  return (
    <>
      {/* Gentle banner for returning users without alias */}
      {showAliasBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
          background: 'var(--panel)', borderBottom: '2px solid var(--yellow)',
          padding: '0.6rem 1rem', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem', color: 'var(--light)', letterSpacing: '0.04em' }}>
            ⚡ Set your identity to find friends and share your profile
          </span>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button onClick={() => setShowAliasSetup(true)} style={{
              background: 'var(--yellow)', color: 'var(--ink)', border: 'none',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.35rem 0.75rem',
              borderRadius: '3px', cursor: 'pointer', minHeight: 'unset',
            }}>Set Alias</button>
            <button onClick={handleAliasSkip} style={{
              background: 'none', border: 'none', color: 'var(--muted)',
              fontSize: '1rem', cursor: 'pointer', padding: '0 0.3rem', minHeight: 'unset', lineHeight: 1,
            }}>✕</button>
          </div>
        </div>
      )}
      <MainApp alias={alias || null} />
    </>
  )
}
