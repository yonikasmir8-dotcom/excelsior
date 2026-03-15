import { useState, useRef } from 'react'
import { fetchCoverImage, amazonUrl } from './api.js'

const COLORS = [
  { label: 'Crimson',       value: '#b30000' },
  { label: 'Marvel Blue',   value: '#1a4fa8' },
  { label: 'Midnight',      value: '#1a2744' },
  { label: 'Cosmic Purple', value: '#4a1a6b' },
  { label: 'Hulk Green',    value: '#1a5c2e' },
  { label: 'Bronze Age',    value: '#7a4e00' },
  { label: 'Dark Matter',   value: '#1a1a2e' },
  { label: 'Venom Black',   value: '#0d1117' },
]

const inp = {
  width: '100%', background: 'var(--mid)', border: '2px solid var(--border)',
  borderRadius: '3px', fontSize: '0.88rem', color: 'var(--white)',
  padding: '0.6rem 0.75rem', outline: 'none',
}
const lbl = {
  display: 'block', fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: '0.35rem',
}

export default function ComicModal({ initial = null, onSave, onClose, onDelete }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    title:       initial?.title       || '',
    publisher:   initial?.publisher   || '',
    writer:      initial?.writer      || '',
    artist:      initial?.artist      || '',
    issue_num:   initial?.issue_num   || '',
    shelf:       initial?.shelf       || 'read',
    rating:      initial?.rating      || 0,
    date_read:   initial?.date_read   || new Date().toISOString().split('T')[0],
    review:      initial?.review      || '',
    tags:        initial?.tags?.join(', ') || '',
    cover_color: initial?.cover_color || '#b30000',
    cover_image: initial?.cover_image || '',
    amazon_url:  initial?.amazon_url  || '',
  })
  const [hoverStar, setHoverStar] = useState(0)
  const [fetching, setFetching]   = useState(false)
  const [fetchMsg, setFetchMsg]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const debounceRef = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleTitleChange = (val) => {
    set('title', val)
    clearTimeout(debounceRef.current)
    if (val.length < 3) return
    debounceRef.current = setTimeout(async () => {
      setFetching(true); setFetchMsg('Looking up cover…')
      const img = await fetchCoverImage(val, form.publisher)
      if (img) { set('cover_image', img); setFetchMsg('✓ Cover found!') }
      else setFetchMsg('No cover found — colour used instead')
      setFetching(false)
    }, 900)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      await onSave({
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        amazon_url: form.amazon_url || amazonUrl(form.title, form.publisher),
        rating: Number(form.rating),
      })
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(4px)', padding: 0,
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      {/* Sheet slides up from bottom — feels native on mobile */}
      <div className="anim-pop" style={{
        background: 'var(--panel)', borderTop: '4px solid var(--red)',
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
            {isEdit ? 'Edit Comic' : 'Log a Comic'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '1.2rem', padding: '0.2rem 0.5rem', borderRadius: '3px', minHeight: 'unset' }}>✕</button>
        </div>

        <div style={{ padding: '1.25rem' }}>

          {/* Cover preview + title block */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.1rem', alignItems: 'flex-start' }}>
            <div style={{
              width: '72px', height: '100px', borderRadius: '2px', flexShrink: 0,
              background: form.cover_image ? 'transparent' : form.cover_color,
              boxShadow: '4px 4px 0 rgba(0,0,0,0.5)', overflow: 'hidden', position: 'relative',
            }}>
              {form.cover_image
                ? <img src={form.cover_image} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => set('cover_image', '')} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bangers', cursive", fontSize: '0.6rem', textAlign: 'center', padding: '0.4rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>
                    {form.title || 'Cover'}
                  </div>
              }
              {fetching && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏳</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={lbl}>Title *</label>
                <input style={inp} value={form.title} onChange={e => handleTitleChange(e.target.value)} placeholder="Series or issue title" />
                {fetchMsg && <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', color: fetchMsg.startsWith('✓') ? '#2a9d4e' : 'var(--muted)', marginTop: '0.25rem', letterSpacing: '0.05em' }}>{fetchMsg}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Issue</label>
                  <input style={inp} value={form.issue_num} onChange={e => set('issue_num', e.target.value)} placeholder="#1, Vol.3…" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={lbl}>Shelf</label>
                  <select style={inp} value={form.shelf} onChange={e => set('shelf', e.target.value)}>
                    <option value="read" style={{ background: 'var(--panel)' }}>Read</option>
                    <option value="reading" style={{ background: 'var(--panel)' }}>Reading</option>
                    <option value="want" style={{ background: 'var(--panel)' }}>Want to Read</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Publisher + Date — responsive 2-col */}
          <div className="form-row-2">
            <div>
              <label style={lbl}>Publisher</label>
              <input style={inp} value={form.publisher} onChange={e => set('publisher', e.target.value)} placeholder="Marvel, DC, Image…" list="pubs" />
              <datalist id="pubs">
                {['Marvel Comics','DC Comics','Image Comics','Dark Horse Comics','IDW Publishing','BOOM! Studios','Fantagraphics'].map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div>
              <label style={lbl}>Date Read</label>
              <input style={inp} type="date" value={form.date_read} onChange={e => set('date_read', e.target.value)} />
            </div>
          </div>

          {/* Writer + Artist */}
          <div className="form-row-2">
            <div>
              <label style={lbl}>Writer</label>
              <input style={inp} value={form.writer} onChange={e => set('writer', e.target.value)} placeholder="Script" />
            </div>
            <div>
              <label style={lbl}>Artist</label>
              <input style={inp} value={form.artist} onChange={e => set('artist', e.target.value)} placeholder="Pencils" />
            </div>
          </div>

          {/* Star rating */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Rating</label>
            <div style={{ display: 'flex', gap: '8px' }} onMouseLeave={() => setHoverStar(0)}>
              {[1,2,3,4,5].map(n => (
                <span key={n}
                  onMouseEnter={() => setHoverStar(n)}
                  onClick={() => set('rating', n)}
                  style={{ fontSize: '1.8rem', cursor: 'pointer', color: n <= (hoverStar || form.rating) ? 'var(--yellow)' : 'var(--border)', transition: 'color 0.1s', WebkitTapHighlightColor: 'transparent' }}>★</span>
              ))}
              {form.rating > 0 && (
                <button onClick={() => set('rating', 0)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: '0.5rem', minHeight: 'unset' }}>clear</button>
              )}
            </div>
          </div>

          {/* Review */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Review / Notes</label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: '72px', lineHeight: 1.55 }}
              value={form.review} onChange={e => set('review', e.target.value)}
              placeholder="What did you think?" />
          </div>

          {/* Tags + Cover colour */}
          <div className="form-row-2">
            <div>
              <label style={lbl}>Tags (comma separated)</label>
              <input style={inp} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="superhero, noir…" />
            </div>
            <div>
              <label style={lbl}>Cover Colour (fallback)</label>
              <select style={inp} value={form.cover_color} onChange={e => set('cover_color', e.target.value)}>
                {COLORS.map(c => <option key={c.value} value={c.value} style={{ background: 'var(--panel)' }}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {error && <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem', color: 'var(--red)', marginBottom: '0.75rem', letterSpacing: '0.06em' }}>{error}</p>}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1rem', borderTop: '2px solid var(--border)', flexWrap: 'wrap' }}>
            {isEdit && onDelete && (
              <button onClick={onDelete} style={{ background: 'none', border: '2px solid #4a1a1a', color: '#8b3030', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0.55rem 1rem', borderRadius: '3px', marginRight: 'auto', minHeight: 'unset' }}>Remove</button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: '2px solid var(--border)', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0.55rem 1rem', borderRadius: '3px', minHeight: 'unset', marginLeft: isEdit ? '0' : 'auto' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ background: saving ? 'var(--border)' : 'var(--red)', color: 'var(--white)', border: 'none', borderBottom: saving ? 'none' : '3px solid var(--red-dark)', fontFamily: "'Bangers', cursive", fontSize: '1rem', letterSpacing: '0.08em', padding: '0.55rem 1.5rem', borderRadius: '3px', minHeight: 'unset', flexGrow: 1 }}>
              {saving ? 'Saving…' : 'Save to Collection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
