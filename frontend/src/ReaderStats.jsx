import { useState, useEffect } from 'react'
import { api } from './api.js'

const lbl = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.5rem',
}
const card = {
  background: 'var(--mid)', borderRadius: '4px', border: '1px solid var(--border)',
  padding: '0.9rem', marginBottom: '0.75rem',
}

function Bar({ label, value, max, color = 'var(--red)' }) {
  const pct = max > 0 ? (value / max * 100) : 0
  return (
    <div style={{ marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.7rem', color: 'var(--light)' }}>{label}</span>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', color: 'var(--muted)' }}>{value}</span>
      </div>
      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

function StatCard({ title, children }) {
  return (
    <div style={card}>
      <div style={lbl}>{title}</div>
      {children}
    </div>
  )
}

export default function ReaderStats({ alias, getToken, onClose, isMobile }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    const p = alias
      ? api.profileStats(alias)
      : api.detailedStats(getToken)
    p.then(setData).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [alias, getToken])

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ fontFamily: "'Bangers', cursive", fontSize: '1.3rem', color: 'var(--yellow)' }}>Loading stats…</div>
    </div>
  )

  if (error) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--panel)', padding: '2rem', borderRadius: '8px', textAlign: 'center' }}>
        <p style={{ color: 'var(--red)', fontFamily: "'Barlow Condensed', sans-serif" }}>{error}</p>
        <button onClick={onClose} style={{ marginTop: '1rem', background: 'var(--red)', color: 'white', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '3px', fontFamily: "'Bangers', cursive", fontSize: '0.9rem', cursor: 'pointer' }}>Close</button>
      </div>
    </div>
  )

  if (!data) return null

  const maxPub = Math.max(...data.publishers.map(p => p.count), 1)
  const maxWriter = Math.max(...data.writers.map(w => w.count), 1)
  const maxArtist = Math.max(...data.artists.map(a => a.count), 1)
  const maxChar = Math.max(...(data.characters || []).map(c => c.count), 1)
  const maxPace = Math.max(...data.pace.map(p => p.count), 1)
  const maxRating = Math.max(...data.ratingDist.map(r => r.count), 1)
  const maxTag = Math.max(...data.topTags.map(t => t.count), 1)

  const formatLabels = { single: 'Single Issues', trade: 'Trades', omnibus: 'Omnibuses' }
  const formatColors = { single: 'var(--red)', trade: '#1a4fa8', omnibus: '#4a1a6b' }
  const totalFormats = data.formats.reduce((a, f) => a + f.count, 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="anim-pop" style={{
        background: 'var(--panel)', borderTop: '4px solid var(--yellow)',
        borderRadius: '12px 12px 0 0',
        width: '100%', maxWidth: '640px',
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
          <span style={{ fontFamily: "'Bangers', cursive", fontSize: '1.3rem', color: 'var(--yellow)', letterSpacing: '0.05em' }}>
            📊 {alias ? `${alias}'s` : 'My'} Reader Stats
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.2rem', padding: '0.2rem 0.5rem', borderRadius: '3px', minHeight: 'unset', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '1.25rem' }}>
          {/* Totals */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
            {[
              { label: 'Read', val: data.totals.read, color: 'var(--red)' },
              { label: 'Reading', val: data.totals.reading, color: '#2a9d4e' },
              { label: 'Want', val: data.totals.want, color: '#1a4fa8' },
              { label: 'Avg ★', val: data.totals.avg_rating || '—', color: 'var(--yellow)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--mid)', borderRadius: '4px', border: '1px solid var(--border)', padding: '0.6rem', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Bangers', cursive", fontSize: '1.4rem', color: s.color }}>{s.val}</div>
                <div style={lbl}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Two column layout on desktop */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>

            {/* Publishers */}
            {data.publishers.length > 0 && (
              <StatCard title="Top Publishers">
                {data.publishers.map(p => (
                  <Bar key={p.publisher} label={p.publisher} value={p.count} max={maxPub} />
                ))}
              </StatCard>
            )}

            {/* Format breakdown */}
            {data.formats.length > 0 && (
              <StatCard title="Format Breakdown">
                {data.formats.map(f => (
                  <Bar key={f.format} label={formatLabels[f.format] || f.format} value={f.count} max={totalFormats} color={formatColors[f.format] || 'var(--red)'} />
                ))}
              </StatCard>
            )}

            {/* Era breakdown */}
            {data.eras.length > 0 && (
              <StatCard title="Reading by Era">
                {data.eras.map(e => (
                  <Bar key={e.era} label={e.era} value={e.count} max={Math.max(...data.eras.map(x => x.count), 1)} color="#7a4e00" />
                ))}
              </StatCard>
            )}

            {/* Characters */}
            {data.characters?.length > 0 && (
              <StatCard title="Most-Read Characters">
                {data.characters.map(c => (
                  <Bar key={c.name} label={c.name} value={c.count} max={maxChar} color="#4a1a6b" />
                ))}
              </StatCard>
            )}

            {/* Top Writers */}
            {data.writers.length > 0 && (
              <StatCard title="Top Writers">
                {data.writers.map(w => (
                  <Bar key={w.writer} label={`${w.writer}${w.avg_rating ? ` (${w.avg_rating}★)` : ''}`} value={w.count} max={maxWriter} color="#1a4fa8" />
                ))}
              </StatCard>
            )}

            {/* Top Artists */}
            {data.artists.length > 0 && (
              <StatCard title="Top Artists">
                {data.artists.map(a => (
                  <Bar key={a.artist} label={`${a.artist}${a.avg_rating ? ` (${a.avg_rating}★)` : ''}`} value={a.count} max={maxArtist} color="#2a9d4e" />
                ))}
              </StatCard>
            )}

            {/* Rating distribution */}
            {data.ratingDist.length > 0 && (
              <StatCard title="Rating Distribution">
                {[1,2,3,4,5].map(s => {
                  const found = data.ratingDist.find(r => r.stars === s)
                  return <Bar key={s} label={`${'★'.repeat(s)}${'☆'.repeat(5-s)}`} value={found?.count || 0} max={maxRating} color="var(--star-review, #e87a2f)" />
                })}
              </StatCard>
            )}

            {/* Top Tags */}
            {data.topTags.length > 0 && (
              <StatCard title="Top Genres / Tags">
                {data.topTags.map(t => (
                  <Bar key={t.tag} label={t.tag} value={t.count} max={maxTag} color="var(--red)" />
                ))}
              </StatCard>
            )}
          </div>

          {/* Reading pace */}
          {data.pace.length > 0 && (
            <StatCard title="Reading Pace (Monthly)">
              <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '80px', padding: '0.25rem 0' }}>
                {data.pace.map(p => (
                  <div key={p.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{
                      width: '100%', background: 'var(--red)', borderRadius: '2px 2px 0 0',
                      height: `${Math.max((p.count / maxPace) * 100, 4)}%`, minHeight: '2px',
                      transition: 'height 0.3s ease',
                    }} />
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.45rem', color: 'var(--muted)', marginTop: '0.15rem', whiteSpace: 'nowrap' }}>
                      {p.month.slice(5)}
                    </div>
                  </div>
                ))}
              </div>
            </StatCard>
          )}
        </div>
      </div>
    </div>
  )
}
