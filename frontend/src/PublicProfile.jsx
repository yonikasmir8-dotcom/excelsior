import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { social, api, amazonUrl } from './api.js'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const halftone = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Ccircle cx='3' cy='3' r='0.9' fill='rgba(255,255,255,0.03)'/%3E%3C/svg%3E")`

function CoverCard({ comic, size = [90, 126] }) {
  const [w, h] = size
  const [imgErr, setImgErr] = useState(false)
  return (
    <div style={{
      width: `${w}px`, height: `${h}px`, flexShrink: 0, borderRadius: '2px',
      background: (!comic.cover_image || imgErr) ? comic.cover_color : 'transparent',
      backgroundImage: (!comic.cover_image || imgErr) ? halftone : 'none',
      boxShadow: '4px 4px 0 rgba(0,0,0,0.6)', overflow: 'hidden', position: 'relative',
    }}>
      {comic.cover_image && !imgErr
        ? <img src={comic.cover_image} alt={comic.title} onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: "'Bangers', cursive", fontSize: '0.7rem',
            textAlign: 'center', padding: '0.5rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.3,
          }}>{comic.title}</div>
      }
      {comic.issue_num && (
        <div style={{
          position: 'absolute', top: 4, right: 4, background: 'var(--yellow)', color: 'var(--ink)',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.48rem', fontWeight: 700,
          padding: '0.1rem 0.3rem', borderRadius: '2px', letterSpacing: '0.04em',
        }}>{comic.issue_num}</div>
      )}
    </div>
  )
}

function Stars({ rating }) {
  if (!rating) return null
  return (
    <div style={{ display: 'flex', gap: '1px', alignItems: 'center' }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ fontSize: '0.75rem', color: n <= Math.round(rating) ? 'var(--yellow)' : 'var(--border)' }}>★</span>
      ))}
      {rating % 1 !== 0 && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', color: 'var(--muted)', marginLeft: '0.2rem' }}>{rating}</span>}
    </div>
  )
}

export default function PublicProfile({ alias }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied]   = useState(false)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [wishlist, setWishlist] = useState([])
  const authCtx = useAuth()

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    const doFetch = async () => {
      try {
        // Try to attach auth token if signed in — enables viewer_follows
        let headers = {}
        try {
          const token = await authCtx.getToken()
          if (token) headers['Authorization'] = `Bearer ${token}`
        } catch (_) {}
        const r = await fetch(`${API}/profile/${alias}`, { headers })
        if (r.status === 404) { setNotFound(true); return }
        const d = await r.json()
        setData(d)
        setFollowing(d.viewer_follows || false)
        // Load wishlist for gift/buy suggestions
        api.wishlist(alias).then(setWishlist).catch(() => {})
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    doFetch()
  }, [alias])

  const handleFollow = async () => {
    if (!authCtx?.isSignedIn) { window.location.hash = '/'; return }
    setFollowLoading(true)
    try {
      const gt = authCtx.getToken
      if (following) {
        await social.unfollow(gt, alias)
        setFollowing(false)
        setData(d => ({ ...d, follower_count: d.follower_count - 1 }))
      } else {
        await social.follow(gt, alias)
        setFollowing(true)
        setData(d => ({ ...d, follower_count: d.follower_count + 1 }))
      }
    } catch (e) { console.error(e) }
    finally { setFollowLoading(false) }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', backgroundImage: halftone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontFamily: "'Bangers', cursive", fontSize: '3rem', color: 'var(--yellow)', textShadow: '3px 3px 0 var(--red)', animation: 'bang 2s ease-in-out infinite' }}>EXCELSIOR!</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.7rem', color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Loading hero profile…</div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', backgroundImage: halftone, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
      <div style={{ fontFamily: "'Bangers', cursive", fontSize: 'clamp(2.5rem,8vw,5rem)', color: 'var(--yellow)', textShadow: '4px 4px 0 var(--red)', animation: 'bang 3s ease-in-out infinite' }}>EXCELSIOR!</div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Bangers', cursive", fontSize: '2rem', color: 'var(--red)', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Hero Not Found</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.8rem', color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          No hero goes by <strong style={{ color: 'var(--light)' }}>{alias}</strong> in this universe
        </div>
      </div>
      <a href="#/" style={{
        background: 'var(--red)', color: 'var(--white)', fontFamily: "'Bangers', cursive",
        fontSize: '1rem', letterSpacing: '0.08em', padding: '0.6rem 1.5rem', borderRadius: '3px',
        textDecoration: 'none', borderBottom: '3px solid var(--red-dark)',
      }}>← Back to Excelsior!</a>
    </div>
  )

  const { stats, recent, favourites, currently_reading } = data

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', backgroundImage: halftone }}>

      {/* ── HEADER ── */}
      <header style={{
        background: 'var(--red)', borderBottom: '4px solid var(--yellow)',
        padding: '0 1.5rem', height: '60px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 4px 0 var(--ink), 0 6px 20px rgba(0,0,0,0.5)',
      }}>
        <a href="#/" style={{
          fontFamily: "'Bangers', cursive", fontSize: '1.7rem', letterSpacing: '0.04em',
          color: 'var(--yellow)', textShadow: '2px 2px 0 var(--ink)', textDecoration: 'none',
          animation: 'bang 3s ease-in-out infinite',
        }}>EXCELSIOR!</a>
        <a href="#/" style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.7rem', fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)',
          textDecoration: 'none', border: '2px solid rgba(255,255,255,0.3)', padding: '0.4rem 0.9rem',
          borderRadius: '3px', transition: 'all 0.15s',
        }}>Sign In / Join</a>
      </header>

      {/* ── HERO BANNER ── */}
      <div style={{
        background: 'linear-gradient(180deg, var(--panel) 0%, var(--ink) 100%)',
        borderBottom: '2px solid var(--border)',
        padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 2rem)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative bg text */}
        <div style={{ position: 'absolute', right: '-1rem', top: '-1rem', fontFamily: "'Bangers', cursive", fontSize: 'clamp(4rem,12vw,10rem)', color: 'rgba(212,43,43,0.06)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none', letterSpacing: '0.05em', maxWidth: '100%', overflow: 'hidden' }}>
          {alias.toUpperCase()}
        </div>

        <div style={{ maxWidth: '1100px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              {/* Mask icon */}
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🦸</div>
              <h1 style={{
                fontFamily: "'Bangers', cursive", fontSize: 'clamp(2.5rem, 7vw, 4.5rem)',
                letterSpacing: '0.04em', color: 'var(--white)',
                textShadow: '3px 3px 0 var(--red)', lineHeight: 1,
              }}>
                {alias}
              </h1>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem',
                color: 'var(--muted)', letterSpacing: '0.15em', textTransform: 'uppercase',
                marginTop: '0.4rem',
              }}>
                Excelsior! Member · {stats.read} issues read
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Follow/Unfollow button */}
            {!data.is_own_profile && (
              <button onClick={handleFollow} disabled={followLoading} style={{
                background: following ? 'var(--mid)' : 'var(--red)',
                border: following ? '2px solid var(--border)' : 'none',
                borderBottom: following ? '2px solid var(--border)' : '3px solid var(--red-dark)',
                color: 'var(--white)',
                fontFamily: "'Bangers', cursive", fontSize: '1rem', letterSpacing: '0.06em',
                padding: '0.6rem 1.5rem', borderRadius: '3px', cursor: 'pointer',
                transition: 'all 0.2s', opacity: followLoading ? 0.6 : 1,
              }}>
                {followLoading ? '…' : following ? 'Following ✓' : 'Follow'}
              </button>
            )}
            {/* Share button */}
            <button onClick={copyLink} style={{
              background: copied ? 'var(--green)' : 'var(--mid)',
              border: '2px solid ' + (copied ? 'var(--green)' : 'var(--border)'),
              color: copied ? 'var(--white)' : 'var(--muted)',
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.7rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '0.6rem 1.25rem', borderRadius: '3px', cursor: 'pointer',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              {copied ? '✓ Link Copied!' : '⎘ Share Profile'}
            </button>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{
            display: 'flex', gap: '0', marginTop: '2rem',
            border: '2px solid var(--border)', borderRadius: '3px', overflow: 'hidden',
            width: 'fit-content', maxWidth: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: 'var(--panel)',
          }}>
            {[
              { num: stats.read,                   label: 'Read' },
              { num: stats.reading,                 label: 'Reading' },
              { num: stats.want,                    label: 'Want to Read' },
              { num: stats.avg_rating ?? '—',       label: 'Avg Rating' },
              { num: stats.top_publisher ?? '—',    label: 'Top Publisher', small: true },
              { num: data.follower_count ?? 0,         label: 'Followers',     small: false },
              { num: data.following_count ?? 0,        label: 'Following',     small: false },
            ].map(({ num, label, small }, i, arr) => (
              <div key={label} style={{
                padding: '0.85rem 1.25rem',
                borderRight: i < arr.length - 1 ? '2px solid var(--border)' : 'none',
              }}>
                <div style={{
                  fontFamily: "'Bangers', cursive",
                  fontSize: small ? 'clamp(0.9rem, 2vw, 1.15rem)' : 'clamp(1.5rem, 3vw, 1.9rem)',
                  color: 'var(--yellow)', lineHeight: 1, letterSpacing: '0.03em',
                  paddingTop: small ? '0.3rem' : 0,
                }}>{num}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginTop: '0.2rem' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'clamp(1.25rem, 3vw, 2.5rem) clamp(0.85rem, 3vw, 1.5rem)' }}>

        {/* Currently Reading */}
        {currently_reading.length > 0 && (
          <Section title="Currently Reading" subtitle="Mid-issue" accent="var(--blue)">
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {currently_reading.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: 'var(--panel)', border: '2px solid var(--border)', borderLeft: '3px solid var(--blue)', borderRadius: '3px', padding: '0.75rem', minWidth: '180px', flex: '1 1 160px', maxWidth: '240px' }}>
                  <CoverCard comic={c} size={[52, 72]} />
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '0.88rem', color: 'var(--white)', lineHeight: 1.2 }}>{c.title}</div>
                    {c.issue_num && <div style={{ fontSize: '0.7rem', color: 'var(--yellow)', fontFamily: "'Barlow Condensed', sans-serif", marginTop: '0.15rem' }}>{c.issue_num}</div>}
                    {c.publisher && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{c.publisher}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Five-star favourites */}
        {favourites.length > 0 && (
          <Section title="Top Rated" subtitle="The absolute best" accent="var(--yellow)">
            <div style={{ display: 'flex', gap: '1.1rem', flexWrap: 'wrap' }}>
              {favourites.map(c => (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: 'clamp(75px, 18vw, 90px)' }}>
                  <CoverCard comic={c} size={[90, 126]} />
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '0.72rem', color: 'var(--white)', textAlign: 'center', lineHeight: 1.2 }}>{c.title}</div>
                  <Stars rating={c.rating} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Recent reads */}
        {recent.length > 0 && (
          <Section title="Recent Reads" subtitle="Latest entries in the log" accent="var(--red)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recent.map(c => {
                const dateStr = c.date_read
                  ? new Date(c.date_read + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  : null
                return (
                  <div key={c.id} style={{
                    display: 'grid', gridTemplateColumns: '62px 1fr',
                    gap: '1rem', padding: '1rem', alignItems: 'center',
                    background: 'var(--panel)', border: '2px solid var(--border)',
                    borderLeft: '4px solid var(--red)', borderRadius: '3px',
                  }}>
                    <CoverCard comic={c} size={[62, 86]} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem', minWidth: 0 }}>
                      {dateStr && <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{dateStr}</div>}
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '1.1rem', color: 'var(--white)', lineHeight: 1.1 }}>
                        {c.title} {c.issue_num && <span style={{ color: 'var(--yellow)', fontSize: '0.9em' }}>{c.issue_num}</span>}
                      </div>
                      {c.publisher && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{c.publisher}</div>}
                      <Stars rating={c.rating} />
                      {c.review && (
                        <div style={{ fontSize: '0.78rem', color: '#888', fontStyle: 'italic', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: '520px' }}>
                          "{c.review}"
                        </div>
                      )}
                      <a href={amazonUrl(c.title, c.publisher)} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          marginTop: '0.35rem', background: '#ff9900', color: 'var(--ink)',
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem',
                          fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                          padding: '0.22rem 0.5rem', borderRadius: '2px', textDecoration: 'none',
                          boxShadow: '0 1px 0 #cc7a00',
                        }}>
                        Buy on Amazon
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>
        )}

        {/* Wishlist — want to read (with buy buttons for gift ideas) */}
        {wishlist.length > 0 && (
          <Section title={`${alias}'s Wishlist`} subtitle="Gift ideas for this hero" accent="var(--yellow)">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {wishlist.map(c => (
                <div key={c.id} style={{
                  display: 'flex', gap: '0.75rem', alignItems: 'center',
                  background: 'var(--panel)', border: '2px solid var(--border)',
                  borderRadius: '3px', padding: '0.75rem',
                }}>
                  <CoverCard comic={c} size={[48, 67]} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                      fontSize: '0.82rem', color: 'var(--white)', lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{c.title}</div>
                    {c.publisher && <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{c.publisher}</div>}
                    <a href={amazonUrl(c.title, c.publisher)} target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                        marginTop: '0.4rem', background: '#ff9900', color: 'var(--ink)',
                        fontFamily: "'Bangers', cursive", fontSize: '0.68rem',
                        letterSpacing: '0.04em', padding: '0.3rem 0.6rem',
                        borderRadius: '2px', textDecoration: 'none',
                        boxShadow: '0 2px 0 #cc7a00',
                      }}>
                      Buy as Gift
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.52rem', color: '#444', letterSpacing: '0.06em', marginTop: '0.75rem', textAlign: 'center' }}>
              We may earn a commission from purchases made via these links
            </p>
          </Section>
        )}

        {/* Empty state */}
        {recent.length === 0 && favourites.length === 0 && currently_reading.length === 0 && (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '2px dashed var(--border)', borderRadius: '4px', background: 'var(--panel)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>📚</div>
            <div style={{ fontFamily: "'Bangers', cursive", fontSize: '1.5rem', letterSpacing: '0.05em', color: 'var(--muted)' }}>
              This hero hasn't logged any issues yet
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '2px solid var(--border)', padding: '1.5rem',
        textAlign: 'center', marginTop: '3rem',
      }}>
        <a href="#/" style={{
          fontFamily: "'Bangers', cursive", fontSize: '1.3rem', letterSpacing: '0.04em',
          color: 'var(--yellow)', textShadow: '1px 1px 0 var(--red)', textDecoration: 'none',
        }}>EXCELSIOR!</a>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.4rem' }}>
          Track your comic book universe
        </div>
      </footer>
    </div>
  )
}

function Section({ title, subtitle, accent, children }) {
  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.1rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)' }}>
        <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: '1.6rem', letterSpacing: '0.04em', color: 'var(--white)', textShadow: `1px 1px 0 ${accent}`, lineHeight: 1 }}>{title}</h2>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{subtitle}</span>
      </div>
      {children}
    </div>
  )
}
