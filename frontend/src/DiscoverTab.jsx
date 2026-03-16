import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api, amazonUrl } from './api.js'

const halftone = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Ccircle cx='3' cy='3' r='0.9' fill='rgba(255,255,255,0.03)'/%3E%3C/svg%3E")`

function CoverCard({ comic, w = 100, h = 140 }) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <div style={{
      width: `${w}px`, height: `${h}px`, flexShrink: 0, borderRadius: '2px',
      background: (!comic.cover_image || imgErr) ? (comic.cover_color || '#b30000') : 'transparent',
      backgroundImage: (!comic.cover_image || imgErr) ? halftone : 'none',
      boxShadow: '4px 4px 0 rgba(0,0,0,0.55)', overflow: 'hidden', position: 'relative',
    }}>
      {comic.cover_image && !imgErr
        ? <img src={comic.cover_image} alt={comic.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgErr(true)} />
        : <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: "'Bangers', cursive", fontSize: '0.7rem',
            textAlign: 'center', padding: '0.5rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.3,
          }}>{comic.title}</div>
      }
      {comic.issue_num && (
        <div style={{
          position: 'absolute', top: 4, right: 4, background: 'var(--yellow)', color: 'var(--ink)',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.44rem', fontWeight: 700,
          padding: '0.1rem 0.28rem', borderRadius: '2px', letterSpacing: '0.04em',
        }}>{comic.issue_num}</div>
      )}
    </div>
  )
}

function BuyButton({ title, issueNum = '', publisher, size = 'normal' }) {
  const url = amazonUrl(title, issueNum, publisher)
  const isSmall = size === 'small'
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: isSmall ? '0.3rem' : '0.5rem',
        background: '#ff9900', color: 'var(--ink)',
        fontFamily: "'Bangers', cursive",
        fontSize: isSmall ? '0.72rem' : '0.88rem',
        letterSpacing: '0.04em',
        padding: isSmall ? '0.35rem 0.65rem' : '0.5rem 1rem',
        borderRadius: '3px', textDecoration: 'none',
        boxShadow: '0 2px 0 #cc7a00',
        transition: 'transform 0.1s',
        whiteSpace: 'nowrap',
      }}>
      {isSmall ? 'Buy' : 'Buy on Amazon'}
    </a>
  )
}

function Stars({ rating, size = '0.72rem' }) {
  if (!rating) return null
  return (
    <div style={{ display: 'flex', gap: '1px', alignItems: 'center' }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ fontSize: size, color: n <= Math.round(rating) ? 'var(--star-review)' : 'var(--border)' }}>★</span>
      ))}
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', color: 'var(--muted)', marginLeft: '0.2rem' }}>{rating}</span>
    </div>
  )
}

export default function DiscoverTab({ isMobile }) {
  const { getToken } = useAuth()
  const gt = useCallback(getToken, [])

  const [trending, setTrending] = useState([])
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.trending().catch(() => []),
      api.recommendations(gt).catch(() => []),
    ]).then(([t, r]) => {
      setTrending(t)
      setRecs(r)
    }).finally(() => setLoading(false))
  }, [gt])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'bang 1s ease-in-out infinite' }}>🔍</div>
      Discovering comics...
    </div>
  )

  return (
    <div className="anim-up">
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border)' }}>
        <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 'clamp(1.8rem, 5vw, 2.4rem)', letterSpacing: '0.04em', textShadow: '2px 2px 0 var(--red)', lineHeight: 1 }}>
          Discover
        </h1>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.3rem' }}>
          Find your next great read
        </p>
      </div>

      {/* ── PERSONALIZED RECS ── */}
      {recs.length > 0 && (
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--border)' }}>
            <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: '1.5rem', letterSpacing: '0.04em', color: 'var(--yellow)', textShadow: '1px 1px 0 var(--red)', lineHeight: 1 }}>
              Recommended For You
            </h2>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Based on your taste
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '155px' : '220px'}, 1fr))`,
            gap: isMobile ? '0.85rem' : '1.1rem',
          }}>
            {recs.map((c, i) => (
              <div key={c.id} className="anim-up" style={{
                animationDelay: `${i * 0.04}s`,
                background: 'var(--panel)', border: '2px solid var(--border)',
                borderRadius: '3px', overflow: 'hidden',
                transition: 'border-color 0.15s',
              }}>
                {/* Reason badge */}
                <div style={{
                  background: 'var(--mid)', padding: '0.4rem 0.7rem',
                  borderBottom: '1px solid var(--border)',
                  fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem',
                  color: 'var(--yellow)', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  {c.reason}
                </div>

                <div style={{ padding: '0.85rem', display: 'flex', gap: '0.75rem' }}>
                  <CoverCard comic={c} w={isMobile ? 65 : 80} h={isMobile ? 91 : 112} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <div style={{
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                      fontSize: isMobile ? '0.82rem' : '0.95rem', color: 'var(--white)',
                      lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {c.title} {c.issue_num && <span style={{ color: 'var(--yellow)' }}>{c.issue_num}</span>}
                    </div>
                    {c.publisher && <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif" }}>{c.publisher}</div>}
                    {c.writer && <div style={{ fontSize: '0.65rem', color: 'var(--light)' }}>W: {c.writer}</div>}
                    {c.avg_rating && <Stars rating={c.avg_rating} size="0.65rem" />}
                    <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
                      <BuyButton title={c.title} issueNum={c.issue_num} publisher={c.publisher} size="small" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── TRENDING ── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.1rem', paddingBottom: '0.5rem', borderBottom: '2px solid var(--border)' }}>
          <h2 style={{ fontFamily: "'Bangers', cursive", fontSize: '1.5rem', letterSpacing: '0.04em', color: 'var(--white)', textShadow: '1px 1px 0 var(--red)', lineHeight: 1 }}>
            Trending on Excelsior!
          </h2>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Most logged
          </span>
        </div>

        {trending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--border)', borderRadius: '4px', background: 'var(--panel)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.4 }}>📊</div>
            <div style={{ fontFamily: "'Bangers', cursive", fontSize: '1.2rem', color: 'var(--muted)' }}>No trending data yet</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', color: '#444', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '0.3rem' }}>Start logging comics to see what's popular!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {trending.map((c, i) => (
              <div key={c.id} className="anim-up" style={{
                animationDelay: `${i * 0.03}s`,
                display: 'grid',
                gridTemplateColumns: isMobile ? '28px 55px 1fr auto' : '36px 72px 1fr auto',
                gap: isMobile ? '0.65rem' : '1rem',
                padding: isMobile ? '0.65rem' : '0.85rem 1rem',
                background: 'var(--panel)', border: '2px solid var(--border)',
                borderLeft: i < 3 ? '4px solid var(--yellow)' : '4px solid var(--border)',
                borderRadius: '3px', alignItems: 'center',
              }}>
                {/* Rank number */}
                <div style={{
                  fontFamily: "'Bangers', cursive",
                  fontSize: i < 3 ? (isMobile ? '1.3rem' : '1.6rem') : (isMobile ? '1rem' : '1.2rem'),
                  color: i < 3 ? 'var(--yellow)' : 'var(--muted)',
                  textAlign: 'center', lineHeight: 1,
                }}>
                  {i + 1}
                </div>

                <CoverCard comic={c} w={isMobile ? 55 : 72} h={isMobile ? 77 : 100} />

                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                    fontSize: isMobile ? '0.88rem' : '1.05rem', color: 'var(--white)',
                    lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {c.title} {c.issue_num && <span style={{ color: 'var(--yellow)', fontSize: '0.9em' }}>{c.issue_num}</span>}
                  </div>
                  {c.publisher && <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif" }}>{c.publisher}</div>}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.1rem', flexWrap: 'wrap' }}>
                    {c.avg_rating && <Stars rating={c.avg_rating} size="0.65rem" />}
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', color: 'var(--muted)', letterSpacing: '0.06em' }}>
                      {c.log_count} {c.log_count === 1 ? 'reader' : 'readers'}
                    </span>
                  </div>
                  {!isMobile && c.writer && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--light)', marginTop: '0.1rem' }}>
                      {[c.writer && `W: ${c.writer}`, c.artist && `A: ${c.artist}`].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>

                <BuyButton title={c.title} issueNum={c.issue_num} publisher={c.publisher} size="small" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Affiliate disclosure */}
      <div style={{
        textAlign: 'center', padding: '1.5rem', borderTop: '2px solid var(--border)',
        fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem',
        color: '#444', letterSpacing: '0.08em', lineHeight: 1.8,
      }}>
        As an Amazon Associate, Excelsior! earns from qualifying purchases.<br />
        Prices and availability are subject to change.
      </div>
    </div>
  )
}
