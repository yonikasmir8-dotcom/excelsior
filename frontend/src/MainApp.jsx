import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth, UserButton } from '@clerk/clerk-react'
import { api, social, amazonUrl } from './api.js'
import ComicModal from './ComicModal.jsx'
import DetailModal from './DetailModal.jsx'
import FriendsFeed from './FriendsFeed.jsx'
import DiscoverTab from './DiscoverTab.jsx'

const halftone = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Ccircle cx='3' cy='3' r='0.9' fill='rgba(255,255,255,0.03)'/%3E%3C/svg%3E")`
const SHELF_COLOR = { read: 'var(--red)', reading: 'var(--blue)', want: 'var(--muted)' }
const SHELF_LABEL = { read: 'Read', reading: 'Reading', want: 'Want' }

// Hook: track viewport width for responsive decisions
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth <= 640)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth <= 640)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

function CoverBlock({ comic, w = 88, h = 120 }) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <div style={{
      width: `${w}px`, height: `${h}px`, flexShrink: 0, borderRadius: '2px',
      background: (!comic.cover_image || imgErr) ? comic.cover_color : 'transparent',
      backgroundImage: (!comic.cover_image || imgErr) ? halftone : 'none',
      boxShadow: '4px 4px 0 rgba(0,0,0,0.55)', overflow: 'hidden', position: 'relative',
    }}>
      {comic.cover_image && !imgErr
        ? <img src={comic.cover_image} alt={comic.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Bangers', cursive", fontSize: '0.65rem', textAlign: 'center',
            padding: '0.5rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>
            {comic.publisher && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.44rem', letterSpacing: '0.06em',
                padding: '0.15rem 0.3rem', textTransform: 'uppercase' }}>{comic.publisher}</div>
            )}
            {comic.title}
          </div>
      }
      {comic.issue_num && (
        <div style={{ position: 'absolute', top: 4, right: 4, background: 'var(--yellow)', color: 'var(--ink)',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.44rem', fontWeight: 700,
          padding: '0.1rem 0.28rem', borderRadius: '2px', letterSpacing: '0.04em', zIndex: 1 }}>
          {comic.issue_num}
        </div>
      )}
    </div>
  )
}

// Bottom tab bar — shown on mobile only
function BottomNav({ view, setView, onAdd, notifCount }) {
  const tabs = [
    { v: 'diary',    icon: '📖', label: 'Log' },
    { v: 'add',      icon: '＋',  label: 'Log Comic', isAction: true },
    { v: 'shelf',    icon: '📚', label: 'Collection' },
    { v: 'discover', icon: '🔍', label: 'Discover' },
    { v: 'friends',  icon: '👥', label: 'Friends' },
  ]
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: 'var(--panel)', borderTop: '2px solid var(--border)',
      display: 'flex', height: 'var(--bottom-nav-h)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map(({ v, icon, label, isAction }) => (
        <button key={v} onClick={() => isAction ? onAdd() : setView(v)}
          style={{
            flex: 1, background: isAction ? 'var(--red)' : (view === v ? 'var(--mid)' : 'none'),
            border: 'none', color: isAction ? 'var(--white)' : (view === v ? 'var(--yellow)' : 'var(--muted)'),
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '2px', cursor: 'pointer', transition: 'all 0.15s', minHeight: '100%',
            borderRight: isAction ? 'none' : '1px solid var(--border)',
            position: 'relative',
          }}>
          {view === v && !isAction && (
            <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: '2px', background: 'var(--yellow)', borderRadius: '0 0 2px 2px' }} />
          )}
          <span style={{ fontSize: isAction ? '1.3rem' : '1.1rem', lineHeight: 1, position: 'relative' }}>
            {icon}
            {v === 'friends' && notifCount > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -6, background: 'var(--red)', color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.45rem', fontWeight: 700, padding: '0.1rem 0.28rem', borderRadius: '99px', lineHeight: 1.3 }}>{notifCount}</span>
            )}
          </span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
        </button>
      ))}
    </nav>
  )
}

export default function MainApp({ alias }) {
  const { getToken } = useAuth()
  const isMobile = useIsMobile()

  const [view, setView]             = useState('diary')
  const [comics, setComics]         = useState([])
  const [stats, setStats]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [shelfFilter, setShelfFilter] = useState('all')
  const [showAdd, setShowAdd]       = useState(false)
  const [editing, setEditing]       = useState(null)
  const [detail, setDetail]         = useState(null)
  const [toast, setToast]           = useState('')
  const [profileCopied, setProfileCopied] = useState(false)
  const [notifCount, setNotifCount]         = useState(0)

  // Global search state
  const [searchQuery, setSearchQuery]     = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchOpen, setSearchOpen]       = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimer = useRef(null)
  const searchBoxRef = useRef(null)

  const gt = useCallback(getToken, [])

  // Poll notification count
  useEffect(() => {
    const poll = () => social.notifCount(gt).then(({ count }) => setNotifCount(count)).catch(() => {})
    poll()
    const t = setInterval(poll, 30000)
    return () => clearInterval(t)
  }, [gt])

  // Global search with debounce
  const handleSearch = useCallback((q) => {
    setSearchQuery(q)
    clearTimeout(searchTimer.current)
    if (q.length < 2) { setSearchResults(null); setSearchOpen(false); return }
    setSearchLoading(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await api.search(q)
        setSearchResults(data)
        setSearchOpen(true)
      } catch { setSearchResults(null) }
      setSearchLoading(false)
    }, 350)
  }, [])

  // Close search on click outside
  useEffect(() => {
    const handler = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const load = useCallback(async (filter) => {
    setLoading(true)
    try {
      const [data, s] = await Promise.all([
        api.comics.list(gt, filter === 'all' ? null : filter),
        api.stats(gt)
      ])
      setComics(data)
      setStats(s)
    } catch (e) { showToast('Error: ' + e.message) }
    finally { setLoading(false) }
  }, [gt])

  useEffect(() => {
    if (view === 'friends' || view === 'discover') return // These tabs manage their own data
    load(view === 'shelf' ? shelfFilter : null)
  }, [view, shelfFilter])

  const copyProfile = () => {
    if (!alias) { showToast('Set an alias first!'); return }
    const url = window.location.origin + window.location.pathname + '#/u/' + alias
    navigator.clipboard.writeText(url)
    setProfileCopied(true)
    setTimeout(() => setProfileCopied(false), 2500)
  }

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const handleSave = async (data) => {
    if (editing) await api.comics.update(gt, editing.id, data)
    else await api.comics.create(gt, data)
    setShowAdd(false); setEditing(null); setDetail(null)
    load(view === 'shelf' ? shelfFilter : null)
    showToast(editing ? 'Updated!' : 'Added to collection!')
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this comic?')) return
    await api.comics.delete(gt, id)
    setDetail(null)
    load(view === 'shelf' ? shelfFilter : null)
    showToast('Removed from collection')
  }

  const openEdit = (comic) => { setEditing(comic); setDetail(null); setShowAdd(true) }
  const readComics = comics.filter(c => c.shelf === 'read')
    .sort((a, b) => new Date(b.date_read || b.created_at) - new Date(a.date_read || a.created_at))

  const filterBtn = (active) => ({
    background: active ? 'var(--red)' : 'none',
    color: active ? 'var(--white)' : 'var(--muted)',
    border: 'none', borderRight: '2px solid var(--border)',
    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.68rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    padding: isMobile ? '0.5rem 0.65rem' : '0.5rem 1rem',
    cursor: 'pointer', transition: 'all 0.15s', minHeight: '40px',
  })

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--ink)', backgroundImage: halftone }}>

      {/* ── HEADER ── */}
      <header style={{
        background: 'var(--red)', borderBottom: '4px solid var(--yellow)',
        padding: '0 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 'var(--header-h)', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 4px 0 var(--ink), 0 6px 20px rgba(0,0,0,0.5)',
      }}>
        <div onClick={() => setView('diary')} style={{
          fontFamily: "'Bangers', cursive", fontSize: isMobile ? '1.45rem' : '1.7rem',
          letterSpacing: '0.04em', color: 'var(--yellow)', textShadow: '2px 2px 0 var(--ink)',
          cursor: 'pointer', animation: 'bang 3s ease-in-out infinite', lineHeight: 1,
        }}>EXCELSIOR!</div>

        {/* Desktop nav — hidden on mobile (replaced by bottom bar) */}
        {!isMobile && (
          <nav style={{ display: 'flex' }}>
            {[['diary', 'Log'], ['shelf', 'Collection'], ['discover', 'Discover'], ['friends', 'Friends'], ['stats', 'Stats']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} style={{
                background: view === v ? 'rgba(0,0,0,0.25)' : 'none',
                border: 'none', borderLeft: '2px solid rgba(0,0,0,0.2)',
                color: view === v ? 'var(--yellow)' : 'rgba(255,255,255,0.7)',
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                padding: '0 1rem', height: '60px', cursor: 'pointer', transition: 'all 0.15s',
                position: 'relative', minHeight: 'unset',
              }}>
                {label}
                {view === v && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'var(--yellow)' }} />}
              </button>
            ))}
          </nav>
        )}

        {/* Global search */}
        <div ref={searchBoxRef} style={{ position: 'relative', flex: isMobile ? 0 : '0 1 280px' }}>
          <input
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onFocus={() => searchResults && searchQuery.length >= 2 && setSearchOpen(true)}
            placeholder={isMobile ? '🔍' : '🔍 Search comics & users…'}
            style={{
              width: isMobile ? '36px' : '100%',
              background: 'rgba(0,0,0,0.3)', border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: '3px', color: 'var(--white)',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem',
              padding: isMobile ? '0.35rem' : '0.4rem 0.75rem',
              outline: 'none', textAlign: isMobile ? 'center' : 'left',
              transition: 'width 0.2s, background 0.2s',
            }}
            onFocusCapture={e => {
              if (isMobile) {
                e.target.style.width = '180px'
                e.target.style.textAlign = 'left'
                e.target.placeholder = 'Search comics & users…'
              }
            }}
            onBlurCapture={e => {
              if (isMobile && !searchQuery) {
                e.target.style.width = '36px'
                e.target.style.textAlign = 'center'
                e.target.placeholder = '🔍'
              }
            }}
          />
          {searchOpen && searchResults && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, width: isMobile ? '85vw' : '360px',
              background: 'var(--panel)', border: '2px solid var(--border)',
              borderRadius: '0 0 4px 4px', boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
              maxHeight: '420px', overflowY: 'auto', zIndex: 600,
            }}>
              {/* Comic results */}
              {searchResults.comics?.length > 0 && (
                <>
                  <div style={{ padding: '0.5rem 0.75rem', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>Comics</div>
                  {searchResults.comics.slice(0, 8).map(c => (
                    <div key={c.id}
                      onClick={() => { window.location.hash = ''; setView('discover'); setSearchOpen(false); setSearchQuery('') }}
                      style={{
                        display: 'flex', gap: '0.6rem', alignItems: 'center',
                        padding: '0.55rem 0.75rem', cursor: 'pointer',
                        borderBottom: '1px solid var(--border)', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--mid)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {c.cover_image
                        ? <img src={c.cover_image} alt="" style={{ width: '28px', height: '40px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} />
                        : <div style={{ width: '28px', height: '40px', background: 'var(--border)', borderRadius: '2px', flexShrink: 0 }} />
                      }
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.82rem', fontWeight: 700, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.title}{c.issue_num ? ` ${c.issue_num}` : ''}
                        </div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', color: 'var(--muted)' }}>
                          {[c.publisher, c.writer].filter(Boolean).join(' · ')}
                          {c.avg_rating ? ` · ★${c.avg_rating}` : ''}
                          {c.log_count > 0 ? ` · ${c.log_count} logged` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {/* User results */}
              {searchResults.users?.length > 0 && (
                <>
                  <div style={{ padding: '0.5rem 0.75rem', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>Users</div>
                  {searchResults.users.slice(0, 6).map(u => (
                    <a key={u.alias} href={`#/u/${u.alias}`}
                      onClick={() => { setSearchOpen(false); setSearchQuery('') }}
                      style={{
                        display: 'flex', gap: '0.6rem', alignItems: 'center',
                        padding: '0.55rem 0.75rem', cursor: 'pointer', textDecoration: 'none',
                        borderBottom: '1px solid var(--border)', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--mid)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: `hsl(${[...u.alias].reduce((n, c) => n + c.charCodeAt(0), 0) % 360}, 55%, 32%)`,
                        border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Bangers', cursive", fontSize: '0.65rem', color: 'rgba(255,255,255,0.9)',
                      }}>{u.alias.slice(0, 2).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.88rem', fontWeight: 700, color: 'var(--yellow)' }}>{u.alias}</div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', color: 'var(--muted)' }}>
                          {u.read_count} read · {u.follower_count} followers
                        </div>
                      </div>
                    </a>
                  ))}
                </>
              )}
              {/* No results */}
              {(!searchResults.comics?.length && !searchResults.users?.length) && (
                <div style={{ padding: '1.5rem', textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.75rem', color: 'var(--muted)' }}>
                  No results for "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem' }}>
          {/* Share — icon only on mobile */}
          <button onClick={copyProfile} style={{
            background: profileCopied ? 'var(--green)' : 'transparent',
            border: '2px solid ' + (profileCopied ? 'var(--green)' : 'rgba(255,255,255,0.3)'),
            color: profileCopied ? 'var(--white)' : 'rgba(255,255,255,0.8)',
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.68rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: isMobile ? '0.4rem 0.6rem' : '0.45rem 0.9rem',
            borderRadius: '3px', cursor: 'pointer', transition: 'all 0.2s',
            whiteSpace: 'nowrap', minHeight: 'unset',
          }}>
            {isMobile ? (profileCopied ? '✓' : '⎘') : (profileCopied ? '✓ Copied!' : '⎘ Share')}
          </button>

          {/* Notification bell — desktop */}
          {!isMobile && (
            <button onClick={() => setView('friends')} style={{
              background: 'none', border: 'none', position: 'relative',
              color: 'rgba(255,255,255,0.75)', fontSize: '1.1rem', padding: '0.3rem',
              cursor: 'pointer', minHeight: 'unset', lineHeight: 1,
            }}>
              🔔
              {notifCount > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, background: 'var(--yellow)', color: 'var(--ink)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.5rem', fontWeight: 700, padding: '0.1rem 0.28rem', borderRadius: '99px', lineHeight: 1.3 }}>{notifCount}</span>
              )}
            </button>
          )}
          {/* + Log button — desktop only; mobile uses bottom nav */}
          {!isMobile && (
            <button onClick={() => { setEditing(null); setShowAdd(true) }} style={{
              background: 'var(--yellow)', color: 'var(--ink)', border: 'none',
              borderBottom: '3px solid rgba(0,0,0,0.3)', fontFamily: "'Bangers', cursive",
              fontSize: '0.95rem', letterSpacing: '0.08em', padding: '0.5rem 1.2rem',
              borderRadius: '3px', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 'unset',
            }}>+ Log a Comic</button>
          )}

          <UserButton afterSignOutUrl="/" appearance={{ variables: { colorBackground: 'var(--panel)', colorText: 'var(--white)' } }} />
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="main-scroll-area" style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '1.25rem 1rem' : '2rem 1.5rem' }}>

        {/* ── DIARY ── */}
        {view === 'diary' && (
          <div className="anim-up">
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border)' }}>
              <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', letterSpacing: '0.04em', textShadow: '2px 2px 0 var(--red)', lineHeight: 1 }}>
                {alias ? `${alias}'s` : 'My'} Reading Log
              </h1>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.3rem' }}>
                Comic by comic, issue by issue
              </p>
            </div>

            {loading ? <Spinner /> : readComics.length === 0 ? (
              <EmptyState icon="📚" title="No issues logged yet!" sub={isMobile ? 'Tap + below to start' : 'Hit "+ Log a Comic" to start'} />
            ) : readComics.map((c, i) => (
              <div key={c.id} className="anim-up" style={{
                animationDelay: `${i * 0.04}s`,
                display: 'grid',
                gridTemplateColumns: isMobile ? '72px 1fr' : '88px 1fr',
                gap: isMobile ? '0.85rem' : '1.25rem',
                padding: isMobile ? '0.9rem 0.75rem' : '1.25rem 1rem',
                marginBottom: '0.5rem',
                background: 'var(--panel)', border: '2px solid var(--border)', borderLeft: '4px solid var(--red)',
                borderRadius: '3px', cursor: 'pointer', transition: 'border-color 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
                onClick={() => setDetail(c)}
                onMouseEnter={e => { if (!isMobile) { e.currentTarget.style.borderColor = 'var(--yellow)'; e.currentTarget.style.borderLeftColor = 'var(--yellow)' } }}
                onMouseLeave={e => { if (!isMobile) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.borderLeftColor = 'var(--red)' } }}
              >
                <CoverBlock comic={c} w={isMobile ? 72 : 88} h={isMobile ? 100 : 120} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem', justifyContent: 'center', minWidth: 0, overflow: 'hidden' }}>
                  {c.date_read && <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {new Date(c.date_read + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: isMobile ? 'short' : 'long', year: 'numeric' })}
                  </div>}
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: isMobile ? '1rem' : '1.2rem', color: 'var(--white)', letterSpacing: '0.02em', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title} {c.issue_num && <span style={{ color: 'var(--yellow)', fontSize: '0.9em' }}>{c.issue_num}</span>}
                  </div>
                  {c.publisher && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.publisher}</div>}
                  {!isMobile && (c.writer || c.artist) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[c.writer && `W: ${c.writer}`, c.artist && `A: ${c.artist}`].filter(Boolean).join('  ·  ')}
                    </div>
                  )}
                  {c.rating > 0 && <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>{[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '0.78rem', color: n <= Math.round(c.rating) ? 'var(--star-review)' : 'var(--border)' }}>★</span>)}<span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', color: 'var(--muted)', marginLeft: '0.25rem' }}>{c.rating}</span></div>}
                  {c.review && !isMobile && (
                    <div style={{ fontSize: '0.78rem', color: '#888', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontStyle: 'italic' }}>{c.review}</div>
                  )}
                  {c.tags?.length > 0 && !isMobile && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {c.tags.slice(0, 3).map(t => <span key={t} style={{ background: 'var(--mid)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0.1rem 0.35rem', borderRadius: '2px' }}>{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── SHELF ── */}
        {view === 'shelf' && (
          <div className="anim-up">
            <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border)' }}>
              <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', letterSpacing: '0.04em', textShadow: '2px 2px 0 var(--red)', lineHeight: 1 }}>My Collection</h1>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.3rem' }}>Every issue you've touched</p>
            </div>

            {/* Filter — scrollable on mobile */}
            <div style={{ display: 'flex', overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '1.5rem', scrollbarWidth: 'none' }}>
              <div style={{ display: 'flex', border: '2px solid var(--border)', borderRadius: '3px', overflow: 'hidden', flexShrink: 0 }}>
                {[['all', 'All'], ['read', 'Read'], ['reading', 'Reading'], ['want', 'Want']].map(([v, l]) => (
                  <button key={v} style={{ ...filterBtn(shelfFilter === v), borderRight: v === 'want' ? 'none' : '2px solid var(--border)', minHeight: 'unset' }} onClick={() => setShelfFilter(v)}>{l}</button>
                ))}
              </div>
            </div>

            {loading ? <Spinner /> : comics.length === 0 ? (
              <EmptyState icon="📦" title="Shelf empty" sub="Add some comics to get started" />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${isMobile ? '100px' : '130px'})`, gap: isMobile ? '1rem 0.85rem' : '1.5rem 1.25rem', justifyContent: 'start' }}>
                {comics.map((c, i) => (
                  <div key={c.id} className="anim-up" style={{ animationDelay: `${i * 0.03}s`, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                    onClick={() => setDetail(c)}>
                    <div style={{
                      width: '100%', aspectRatio: '2/3', borderRadius: '2px', overflow: 'hidden',
                      background: c.cover_image ? 'transparent' : c.cover_color,
                      backgroundImage: c.cover_image ? 'none' : halftone,
                      boxShadow: '4px 4px 0 rgba(0,0,0,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                    }}>
                      {c.cover_image
                        ? <img src={c.cover_image} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                        : <div style={{ fontFamily: "'Bangers', cursive", fontSize: '0.75rem', textAlign: 'center', padding: '0.5rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>{c.title}</div>
                      }
                      <div style={{ position: 'absolute', bottom: 4, right: 4, background: SHELF_COLOR[c.shelf], color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.46rem', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.12rem 0.32rem', borderRadius: '2px' }}>{SHELF_LABEL[c.shelf]}</div>
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: isMobile ? '0.75rem' : '0.82rem', marginTop: '0.45rem', lineHeight: 1.2, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                    {c.rating > 0 && <div style={{ display: 'flex', gap: '1px', marginTop: '0.2rem', alignItems: 'center' }}>{[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '0.62rem', color: n <= Math.round(c.rating) ? 'var(--star-review)' : 'var(--border)' }}>★</span>)}<span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.5rem', color: 'var(--muted)', marginLeft: '0.15rem' }}>{c.rating}</span></div>}
                    {c.shelf === 'want' && (
                      <a href={amazonUrl(c.title, c.publisher)} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          gap: '0.25rem', marginTop: '0.35rem',
                          background: '#ff9900', color: 'var(--ink)',
                          fontFamily: "'Bangers', cursive", fontSize: '0.62rem',
                          letterSpacing: '0.04em', padding: '0.28rem 0.55rem',
                          borderRadius: '2px', textDecoration: 'none',
                          boxShadow: '0 2px 0 #cc7a00',
                        }}>
                        Get It
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STATS ── */}
        {view === 'stats' && (
          !stats ? <Spinner /> : (
          <div className="anim-up">
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border)' }}>
              <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', letterSpacing: '0.04em', textShadow: '2px 2px 0 var(--red)', lineHeight: 1 }}>My Stats</h1>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.3rem' }}>Your reading universe, by the numbers</p>
            </div>

            {/* 2-col grid on mobile, 4-col on desktop */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '1px', background: 'var(--border)', border: '2px solid var(--border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
              {[
                { num: stats.read,                label: 'Read',            color: 'var(--red)' },
                { num: stats.reading,             label: 'Reading Now',     color: 'var(--blue)' },
                { num: stats.want,                label: 'Want to Read',    color: 'var(--muted)' },
                { num: stats.avg_rating ?? '—',   label: 'Avg Rating ⭐',  color: 'var(--yellow)' },
              ].map(({ num, label, color }) => (
                <div key={label} style={{ background: 'var(--panel)', padding: isMobile ? '1.1rem 1rem' : '1.5rem 1.25rem' }}>
                  <div style={{ fontFamily: "'Bangers', cursive", fontSize: isMobile ? '2rem' : '2.6rem', color, lineHeight: 1, letterSpacing: '0.03em' }}>{num}</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginTop: '0.2rem' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Category Rating Averages */}
            {(stats.avg_plot || stats.avg_art || stats.avg_writing) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'var(--border)', border: '2px solid var(--border)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                {[
                  { num: stats.avg_plot ?? '—', label: 'Avg Plot', icon: '📖' },
                  { num: stats.avg_art ?? '—', label: 'Avg Art', icon: '🎨' },
                  { num: stats.avg_writing ?? '—', label: 'Avg Writing', icon: '✍️' },
                ].map(({ num, label, icon }) => (
                  <div key={label} style={{ background: 'var(--panel)', padding: isMobile ? '0.9rem 0.75rem' : '1.25rem 1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1rem', marginBottom: '0.2rem' }}>{icon}</div>
                    <div style={{ fontFamily: "'Bangers', cursive", fontSize: isMobile ? '1.4rem' : '1.8rem', color: 'var(--yellow)', lineHeight: 1 }}>{num}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.52rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginTop: '0.15rem' }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {stats.top_publisher && (
              <div style={{ background: 'var(--panel)', border: '2px solid var(--border)', borderLeft: '4px solid var(--yellow)', borderRadius: '3px', padding: '1.1rem 1.25rem', marginBottom: '0.75rem' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.3rem' }}>Favourite Publisher</div>
                <div style={{ fontFamily: "'Bangers', cursive", fontSize: isMobile ? '1.3rem' : '1.6rem', color: 'var(--yellow)', letterSpacing: '0.04em' }}>{stats.top_publisher}</div>
              </div>
            )}

            <div style={{ background: 'var(--panel)', border: '2px solid var(--border)', borderRadius: '3px', padding: '1.1rem 1.25rem' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.5rem' }}>Total Collection</div>
              <div style={{ fontFamily: "'Bangers', cursive", fontSize: isMobile ? '1.6rem' : '2rem', color: 'var(--white)', letterSpacing: '0.04em' }}>{stats.read + stats.reading + stats.want} issues tracked</div>
            </div>

            {/* Share profile card */}
            {alias && (
              <div style={{ marginTop: '1.5rem', background: 'var(--panel)', border: '2px solid var(--border)', borderTop: '3px solid var(--red)', borderRadius: '3px', padding: '1.25rem' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.5rem' }}>Your Public Profile</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.88rem', color: 'var(--light)', marginBottom: '1rem', wordBreak: 'break-all' }}>
                  {window.location.origin}{window.location.pathname}<span style={{ color: 'var(--yellow)' }}>#/u/{alias}</span>
                </div>
                <button onClick={copyProfile} style={{
                  background: profileCopied ? 'var(--green)' : 'var(--red)', color: 'var(--white)',
                  border: 'none', borderBottom: '3px solid rgba(0,0,0,0.3)',
                  fontFamily: "'Bangers', cursive", fontSize: '1rem', letterSpacing: '0.08em',
                  padding: '0.6rem 1.5rem', borderRadius: '3px', cursor: 'pointer', width: isMobile ? '100%' : 'auto',
                }}>
                  {profileCopied ? '✓ Link Copied!' : '⎘ Copy Profile Link'}
                </button>
              </div>
            )}
          </div>
          )
        )}
        {/* ── DISCOVER ── */}
        {view === 'discover' && (
          <DiscoverTab isMobile={isMobile} />
        )}

        {/* ── FRIENDS ── */}
        {view === 'friends' && (
          <FriendsFeed myAlias={alias} isMobile={isMobile} onNotifsRead={() => setNotifCount(0)} />
        )}
      </main>

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && <BottomNav view={view} setView={setView} onAdd={() => { setEditing(null); setShowAdd(true) }} notifCount={notifCount} />}

      {/* ── MODALS ── */}
      {showAdd && (
        <ComicModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onDelete={editing ? () => { handleDelete(editing.id); setShowAdd(false); setEditing(null) } : null}
        />
      )}
      {detail && (
        <DetailModal
          comic={detail}
          onClose={() => setDetail(null)}
          onEdit={() => openEdit(detail)}
          onDelete={() => handleDelete(detail.id)}
        />
      )}

      {/* ── TOAST ── */}
      <div style={{
        position: 'fixed', bottom: isMobile ? 'calc(var(--bottom-nav-h) + 1rem)' : '1.5rem',
        left: '50%', transform: 'translateX(-50%)',
        background: 'var(--panel)', border: '2px solid var(--border)', color: 'var(--white)',
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.75rem', fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0.7rem 1.5rem',
        borderRadius: '3px', boxShadow: '4px 4px 0 rgba(0,0,0,0.5)', zIndex: 999,
        opacity: toast ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>{toast}</div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'bang 1s ease-in-out infinite' }}>⚡</div>
      Loading…
    </div>
  )
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 2rem', border: '2px dashed var(--border)', borderRadius: '4px', background: 'var(--panel)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.4 }}>{icon}</div>
      <div style={{ fontFamily: "'Bangers', cursive", fontSize: '1.4rem', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.35rem' }}>{title}</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#444' }}>{sub}</div>
    </div>
  )
}
