import { amazonUrl } from './api.js'

const SHELF_LABEL = { read: 'Read', reading: 'Currently Reading', want: 'Want to Read' }
const SHELF_COLOR = { read: 'var(--red)', reading: 'var(--blue)', want: 'var(--border)' }
const halftone = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Ccircle cx='3' cy='3' r='0.9' fill='rgba(255,255,255,0.03)'/%3E%3C/svg%3E")`

export default function DetailModal({ comic, onClose, onEdit, onDelete }) {
  if (!comic) return null
  const buyUrl = comic.amazon_url || amazonUrl(comic.title, comic.publisher)
  const dateStr = comic.date_read
    ? new Date(comic.date_read + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 500,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(6px)', padding: 0,
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="anim-pop" style={{
        background: 'var(--panel)', borderTop: '4px solid var(--red)',
        borderRadius: '12px 12px 0 0',
        width: '100%', maxWidth: '560px',
        maxHeight: '92dvh', overflowY: 'auto',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem 0 0' }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{ background: 'var(--mid)', borderBottom: '2px solid var(--border)', padding: '0.9rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ fontFamily: "'Bangers', cursive", fontSize: '1.25rem', color: 'var(--yellow)', letterSpacing: '0.05em' }}>Issue Details</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.2rem', padding: '0.2rem 0.5rem', borderRadius: '3px', cursor: 'pointer', minHeight: 'unset' }}>✕</button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* Cover + info */}
          <div style={{ display: 'flex', gap: '1.1rem', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
            <div style={{
              width: '90px', height: '126px', flexShrink: 0, borderRadius: '2px',
              background: comic.cover_image ? 'transparent' : comic.cover_color,
              backgroundImage: comic.cover_image ? 'none' : halftone,
              boxShadow: '5px 5px 0 rgba(0,0,0,0.6)', overflow: 'hidden', position: 'relative',
            }}>
              {comic.cover_image
                ? <img src={comic.cover_image} alt={comic.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bangers', cursive", fontSize: '0.78rem', textAlign: 'center', padding: '0.6rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>{comic.title}</div>
              }
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(1.1rem, 4vw, 1.45rem)', color: 'var(--white)', lineHeight: 1.1, letterSpacing: '0.02em' }}>
                {comic.title}
              </h2>
              {comic.issue_num && <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.82rem', color: 'var(--yellow)', fontWeight: 700, marginTop: '0.2rem' }}>{comic.issue_num}</div>}
              {comic.publisher && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem', fontFamily: "'Barlow Condensed', sans-serif" }}>{comic.publisher}</div>}
              {(comic.writer || comic.artist) && (
                <div style={{ fontSize: '0.75rem', color: 'var(--light)', marginTop: '0.35rem', lineHeight: 1.55 }}>
                  {comic.writer && <div><span style={{ color: 'var(--muted)' }}>W: </span>{comic.writer}</div>}
                  {comic.artist && <div><span style={{ color: 'var(--muted)' }}>A: </span>{comic.artist}</div>}
                </div>
              )}
              {comic.rating > 0 && (
                <div style={{ display: 'flex', gap: '2px', marginTop: '0.45rem' }}>
                  {[1,2,3,4,5].map(n => <span key={n} style={{ fontSize: '1rem', color: n <= comic.rating ? 'var(--yellow)' : 'var(--border)' }}>★</span>)}
                </div>
              )}
              {dateStr && <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.4rem' }}>Read {dateStr}</div>}
              <div style={{ display: 'inline-block', marginTop: '0.4rem', background: SHELF_COLOR[comic.shelf], color: 'var(--white)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.18rem 0.5rem', borderRadius: '2px' }}>
                {SHELF_LABEL[comic.shelf]}
              </div>
              {comic.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {comic.tags.map(t => <span key={t} style={{ background: 'var(--mid)', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0.12rem 0.4rem', borderRadius: '2px' }}>{t}</span>)}
                </div>
              )}
            </div>
          </div>

          {/* Review */}
          {comic.review && (
            <blockquote style={{ fontStyle: 'italic', fontSize: '0.84rem', color: 'var(--light)', lineHeight: 1.6, padding: '0.85rem 1rem', background: 'var(--mid)', borderLeft: '3px solid var(--red)', borderRadius: '0 3px 3px 0', marginBottom: '1.25rem' }}>
              "{comic.review}"
            </blockquote>
          )}

          {/* Amazon buy button — full width on mobile */}
          <a href={buyUrl} target="_blank" rel="noopener noreferrer" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
            width: '100%', background: '#ff9900', color: 'var(--ink)',
            fontFamily: "'Bangers', cursive", fontSize: '1.15rem', letterSpacing: '0.06em',
            padding: '0.9rem 1rem', borderRadius: '3px', textDecoration: 'none',
            boxShadow: '0 3px 0 #cc7a00', marginBottom: '0.5rem',
          }}>
            🛒 Buy on Amazon
          </a>
          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', color: 'var(--muted)', textAlign: 'center', letterSpacing: '0.06em', marginBottom: '1.1rem' }}>
            We may earn a commission from purchases made via this link
          </p>

          {/* Edit / Delete */}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '2px solid var(--border)' }}>
            <button onClick={onEdit} style={{ flex: 1, background: 'none', border: '2px solid var(--border)', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.65rem 1rem', borderRadius: '3px', cursor: 'pointer', minHeight: 'unset' }}>Edit</button>
            <button onClick={onDelete} style={{ flex: 1, background: 'none', border: '2px solid #4a1a1a', color: '#8b3030', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.65rem 1rem', borderRadius: '3px', cursor: 'pointer', minHeight: 'unset' }}>Remove</button>
          </div>
        </div>
      </div>
    </div>
  )
}
