import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { social, api } from './api.js'

const halftone = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Ccircle cx='3' cy='3' r='0.9' fill='rgba(255,255,255,0.03)'/%3E%3C/svg%3E")`
const SHELF_COLOR = { read: 'var(--red)', reading: 'var(--blue)', want: 'var(--muted)' }
const SHELF_LABEL = { read: 'Read', reading: 'Reading', want: 'Want' }

function MiniCover({ comic, size = 52 }) {
  const [err, setErr] = useState(false)
  const h = Math.round(size * 1.4)
  return (
    <div style={{
      width: size, height: h, flexShrink: 0, borderRadius: '2px',
      background: (!comic.cover_image || err) ? comic.cover_color : 'transparent',
      backgroundImage: (!comic.cover_image || err) ? halftone : 'none',
      boxShadow: '3px 3px 0 rgba(0,0,0,0.5)', overflow: 'hidden',
    }}>
      {comic.cover_image && !err
        ? <img src={comic.cover_image} alt={comic.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setErr(true)} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bangers', cursive", fontSize: '0.58rem', textAlign: 'center', padding: '0.3rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.25 }}>{comic.title}</div>
      }
    </div>
  )
}

function AvatarCircle({ alias, size = 38 }) {
  const initials = alias ? alias.slice(0, 2).toUpperCase() : '??'
  const hue = alias ? [...alias].reduce((n, c) => n + c.charCodeAt(0), 0) % 360 : 0
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue}, 55%, 32%)`, border: '2px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Bangers', cursive", fontSize: size * 0.38, color: 'rgba(255,255,255,0.9)',
      letterSpacing: '0.04em',
    }}>{initials}</div>
  )
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function FriendsFeed({ myAlias, isMobile, onNotifsRead }) {
  const { getToken } = useAuth()
  const gt = useCallback(getToken, [])

  const [tab, setTab]             = useState('feed')
  const [feedMode, setFeedMode]   = useState('friends') // 'friends' or 'global'
  const [feed, setFeed]           = useState([])
  const [following, setFollowing] = useState([])
  const [followers, setFollowers] = useState([])
  const [notifs, setNotifs]       = useState([])
  const [loading, setLoading]     = useState(true)

  const loadTab = useCallback(async (t) => {  // eslint-disable-line
    setLoading(true)
    try {
      if (t === 'feed')      {
        if (feedMode === 'global') setFeed(await api.globalFeed())
        else setFeed(await social.feed(gt))
      }
      if (t === 'following') setFollowing(await social.following(gt))
      if (t === 'followers') setFollowers(await social.followers(gt))
      if (t === 'notifs') {
        const data = await social.notifs(gt) // marks all read server-side
        setNotifs(data)
        if (onNotifsRead) onNotifsRead() // reset bell in parent
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [gt, feedMode]) // gt is stable from useCallback above

  useEffect(() => { loadTab(tab) }, [tab, loadTab])

  const handleUnfollow = async (alias) => {
    await social.unfollow(gt, alias)
    setFollowing(f => f.filter(u => u.alias !== alias))
  }

  const handleFollowBack = async (alias) => {
    await social.follow(gt, alias)
    setFollowers(f => f.map(u => u.alias === alias ? { ...u, i_follow_back: 1 } : u))
  }

  const tabBtn = (t, label, badge) => (
    <button onClick={() => setTab(t)} style={{
      flex: 1, background: tab === t ? 'var(--red)' : 'none',
      color: tab === t ? 'var(--white)' : 'var(--muted)',
      border: 'none', borderRight: '2px solid var(--border)',
      fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.68rem', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.1em',
      padding: '0.5rem 0.5rem', cursor: 'pointer', transition: 'all 0.15s',
      minHeight: '40px', position: 'relative',
    }}>
      {label}
      {badge > 0 && (
        <span style={{
          position: 'absolute', top: 4, right: 4,
          background: 'var(--yellow)', color: 'var(--ink)',
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.52rem', fontWeight: 700,
          padding: '0.1rem 0.32rem', borderRadius: '99px', lineHeight: 1.2,
        }}>{badge}</span>
      )}
    </button>
  )

  const unreadNotifs = notifs.filter(n => !n.read).length

  return (
    <div className="anim-up">
      <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '2px solid var(--border)' }}>
        <h1 style={{ fontFamily: "'Bangers', cursive", fontSize: 'clamp(1.8rem,5vw,2.4rem)', letterSpacing: '0.04em', textShadow: '2px 2px 0 var(--red)', lineHeight: 1 }}>
          Friends
        </h1>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.3rem' }}>
          What your crew is reading
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', border: '2px solid var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '1.5rem' }}>
        {tabBtn('feed',      'Activity',  0)}
        {tabBtn('following', 'Following', 0)}
        {tabBtn('followers', 'Followers', 0)}
        {tabBtn('notifs',    'Alerts',    unreadNotifs)}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* ── ACTIVITY FEED ── */}
          {tab === 'feed' && (
            <>
              {/* Global / Friends toggle */}
              <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', border: '2px solid var(--border)', borderRadius: '3px', overflow: 'hidden', width: 'fit-content' }}>
                {[['friends', '👥 Friends'], ['global', '🌍 Global']].map(([mode, label]) => (
                  <button key={mode} onClick={() => setFeedMode(mode)} style={{
                    background: feedMode === mode ? 'var(--red)' : 'none',
                    color: feedMode === mode ? 'var(--white)' : 'var(--muted)',
                    border: 'none', borderRight: mode === 'friends' ? '2px solid var(--border)' : 'none',
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    padding: '0.4rem 0.85rem', cursor: 'pointer', minHeight: 'unset',
                  }}>{label}</button>
                ))}
              </div>
            </>
          )}
          {tab === 'feed' && (
            feed.length === 0
              ? <Empty icon={feedMode === 'global' ? '🌍' : '👥'} title="No activity yet" sub={feedMode === 'global' ? 'No one has logged comics yet — be the first!' : (following.length === 0 ? 'Follow some heroes to see their reading here' : 'The heroes you follow haven\'t logged anything yet')} />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {feed.map((c, i) => (
                    <div key={`${c.user_id}-${c.id}`} className="anim-up" style={{ animationDelay: `${i * 0.03}s`,
                      display: 'grid', gridTemplateColumns: '38px 52px 1fr', gap: '0.85rem',
                      padding: '0.9rem', background: 'var(--panel)',
                      border: '2px solid var(--border)', borderLeft: `4px solid ${SHELF_COLOR[c.shelf] || 'var(--red)'}`,
                      borderRadius: '3px', alignItems: 'center',
                    }}>
                      <a href={`#/u/${c.alias}`} style={{ textDecoration: 'none' }} title={c.alias}>
                        <AvatarCircle alias={c.alias} />
                      </a>
                      <MiniCover comic={c} size={52} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <a href={`#/u/${c.alias}`} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '0.82rem', color: 'var(--yellow)', textDecoration: 'none' }}>{c.alias}</a>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.68rem', color: 'var(--muted)' }}>
                            {c.shelf === 'read' ? 'read' : 'is reading'}
                          </span>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', color: '#444', marginLeft: 'auto' }}>{timeAgo(c.created_at)}</span>
                        </div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '0.98rem', color: 'var(--white)', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                          {c.title} {c.issue_num && <span style={{ color: 'var(--yellow)', fontSize: '0.85em' }}>{c.issue_num}</span>}
                        </div>
                        {c.publisher && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{c.publisher}</div>}
                        {c.rating > 0 && (
                          <div style={{ display: 'flex', gap: '1px', marginTop: '0.2rem', alignItems: 'center' }}>
                            {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '0.72rem', color: n <= Math.round(c.rating) ? 'var(--star-review)' : 'var(--border)' }}>★</span>)}
                            {c.rating % 1 !== 0 && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', color: 'var(--muted)', marginLeft: '0.15rem' }}>{c.rating}</span>}
                          </div>
                        )}
                        {c.review && (
                          <div style={{ fontSize: '0.75rem', color: '#777', fontStyle: 'italic', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: '0.2rem' }}>
                            "{c.review}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
          )}

          {/* ── FOLLOWING ── */}
          {tab === 'following' && (
            following.length === 0
              ? <Empty icon="🔍" title="Not following anyone yet" sub="Visit a hero's profile and hit Follow" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {following.map(u => (
                    <div key={u.alias} style={{
                      display: 'flex', alignItems: 'center', gap: '0.85rem',
                      padding: '0.85rem 1rem', background: 'var(--panel)',
                      border: '2px solid var(--border)', borderRadius: '3px',
                    }}>
                      <AvatarCircle alias={u.alias} size={44} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a href={`#/u/${u.alias}`} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '1.05rem', color: 'var(--white)', textDecoration: 'none', letterSpacing: '0.02em' }}>{u.alias}</a>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {u.read_count} issues read
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <a href={`#/u/${u.alias}`} style={{
                          background: 'none', border: '2px solid var(--border)', color: 'var(--muted)',
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '0.4rem 0.75rem', borderRadius: '3px', textDecoration: 'none',
                          display: 'flex', alignItems: 'center',
                        }}>Profile</a>
                        <button onClick={() => handleUnfollow(u.alias)} style={{
                          background: 'none', border: '2px solid #4a1a1a', color: '#8b3030',
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '0.4rem 0.75rem', borderRadius: '3px', cursor: 'pointer', minHeight: 'unset',
                        }}>Unfollow</button>
                      </div>
                    </div>
                  ))}
                </div>
          )}

          {/* ── FOLLOWERS ── */}
          {tab === 'followers' && (
            followers.length === 0
              ? <Empty icon="🦸" title="No followers yet" sub="Share your profile to attract your first followers" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {followers.map(u => (
                    <div key={u.alias} style={{
                      display: 'flex', alignItems: 'center', gap: '0.85rem',
                      padding: '0.85rem 1rem', background: 'var(--panel)',
                      border: '2px solid var(--border)', borderRadius: '3px',
                    }}>
                      <AvatarCircle alias={u.alias} size={44} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a href={`#/u/${u.alias}`} style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '1.05rem', color: 'var(--white)', textDecoration: 'none', letterSpacing: '0.02em' }}>{u.alias}</a>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {u.read_count} issues read
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <a href={`#/u/${u.alias}`} style={{
                          background: 'none', border: '2px solid var(--border)', color: 'var(--muted)',
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '0.4rem 0.75rem', borderRadius: '3px', textDecoration: 'none',
                          display: 'flex', alignItems: 'center',
                        }}>Profile</a>
                        {!u.i_follow_back && (
                          <button onClick={() => handleFollowBack(u.alias)} style={{
                            background: 'var(--red)', color: 'var(--white)', border: 'none',
                            borderBottom: '2px solid var(--red-dark)',
                            fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', fontWeight: 700,
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            padding: '0.4rem 0.75rem', borderRadius: '3px', cursor: 'pointer', minHeight: 'unset',
                          }}>Follow Back</button>
                        )}
                        {u.i_follow_back === 1 && (
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', color: 'var(--green)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0.4rem 0.5rem' }}>✓ Following</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === 'notifs' && (
            notifs.length === 0
              ? <Empty icon="🔔" title="No notifications yet" sub="You'll be alerted when someone follows you" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {notifs.map((n, i) => (
                    <div key={n.id} className="anim-up" style={{
                      animationDelay: `${i * 0.03}s`,
                      display: 'flex', gap: '0.85rem', alignItems: 'center',
                      padding: '0.85rem 1rem',
                      background: n.read ? 'var(--panel)' : 'var(--mid)',
                      border: `2px solid ${n.read ? 'var(--border)' : 'var(--border)'}`,
                      borderLeft: `4px solid ${n.read ? 'var(--border)' : 'var(--red)'}`,
                      borderRadius: '3px',
                    }}>
                      <AvatarCircle alias={n.actor_alias} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.88rem', color: 'var(--white)', lineHeight: 1.3 }}>
                          {n.type === 'new_follower' && (
                            <><a href={`#/u/${n.actor_alias}`} style={{ color: 'var(--yellow)', textDecoration: 'none', fontWeight: 700 }}>{n.actor_alias}</a> started following you</>
                          )}
                          {n.type === 'new_read' && (
                            <><a href={`#/u/${n.actor_alias}`} style={{ color: 'var(--yellow)', textDecoration: 'none', fontWeight: 700 }}>{n.actor_alias}</a> logged a new comic</>
                          )}
                        </div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', color: 'var(--muted)', marginTop: '0.15rem', letterSpacing: '0.06em' }}>
                          {timeAgo(n.created_at)}
                        </div>
                      </div>
                      {!n.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
          )}
        </>
      )}
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

function Empty({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 2rem', border: '2px dashed var(--border)', borderRadius: '4px', background: 'var(--panel)' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.4 }}>{icon}</div>
      <div style={{ fontFamily: "'Bangers', cursive", fontSize: '1.4rem', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.35rem' }}>{title}</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#444' }}>{sub}</div>
    </div>
  )
}
