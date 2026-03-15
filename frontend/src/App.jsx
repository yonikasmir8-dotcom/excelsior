import { useEffect, useState } from 'react'
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react'
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
  const [needsAlias, setNeedsAlias] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    api.alias.mine(getToken)
      .then(({ alias: a }) => { setAlias(a); setNeedsAlias(!a) })
      .catch(() => { setAlias(null); setNeedsAlias(false) })
  }, [isLoaded, getToken])

  if (alias === undefined) return (
    <div style={{ minHeight:'100vh', background:'var(--ink)', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'1rem' }}>
      <div style={{ fontFamily:"'Bangers',cursive", fontSize:'3rem', color:'var(--yellow)', textShadow:'3px 3px 0 var(--red)', animation:'bang 2s ease-in-out infinite' }}>EXCELSIOR!</div>
      <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:'0.7rem', color:'var(--muted)', letterSpacing:'0.15em', textTransform:'uppercase' }}>Loading your collection…</div>
    </div>
  )

  if (needsAlias) return (
    <AliasSetup onComplete={() => {
      api.alias.mine(getToken)
        .then(({ alias: a }) => { setAlias(a); setNeedsAlias(false) })
        .catch(() => setNeedsAlias(false))
    }} />
  )

  return <MainApp alias={alias} />
}
