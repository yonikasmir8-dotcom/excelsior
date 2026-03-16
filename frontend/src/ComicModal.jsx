import { useState, useRef, useEffect, useCallback } from 'react'
import { fetchCoverImage, amazonUrl, api } from './api.js'

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

function StarRow({ label, value, hover, onHover, onLeave, onChange, onClear }) {
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <label style={{ ...lbl, marginBottom: '0.2rem' }}>{label}</label>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} onMouseLeave={onLeave}>
        {[1,2,3,4,5].map(n => (
          <span key={n}
            onMouseEnter={() => onHover(n)}
            onClick={() => onChange(n)}
            style={{ fontSize: '1.3rem', cursor: 'pointer', color: n <= (hover || value) ? 'var(--yellow)' : 'var(--border)', transition: 'color 0.1s', WebkitTapHighlightColor: 'transparent', lineHeight: 1 }}>★</span>
        ))}
        {value > 0 && (
          <button onClick={onClear} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.55rem', letterSpacing: '0.06em', textTransform: 'uppercase', paddingLeft: '0.3rem', minHeight: 'unset' }}>✕</button>
        )}
      </div>
    </div>
  )
}

export default function ComicModal({ initial = null, onSave, onClose, onDelete }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    title:          initial?.title          || '',
    publisher:      initial?.publisher      || '',
    writer:         initial?.writer         || '',
    artist:         initial?.artist         || '',
    issue_num:      initial?.issue_num      || '',
    shelf:          initial?.shelf          || 'read',
    rating_plot:    initial?.rating_plot    || 0,
    rating_art:     initial?.rating_art     || 0,
    rating_writing: initial?.rating_writing || 0,
    date_read:      initial?.date_read      || new Date().toISOString().split('T')[0],
    review:         initial?.review         || '',
    tags:           initial?.tags           || [],
    cover_color:    initial?.cover_color    || '#b30000',
    cover_image:    initial?.cover_image    || '',
    amazon_url:     initial?.amazon_url     || '',
    catalog_id:     initial?.catalog_id     || null,
    format:         initial?.format         || 'single',
  })

  const [hoverPlot, setHoverPlot]       = useState(0)
  const [hoverArt, setHoverArt]         = useState(0)
  const [hoverWriting, setHoverWriting] = useState(0)
  const [fetching, setFetching]         = useState(false)
  const [fetchMsg, setFetchMsg]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  // Catalog search
  const [searchResults, setSearchResults] = useState([])
  const [showResults, setShowResults]     = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef(null)
  const dropdownRef = useRef(null)

  // Tags
  const [allTags, setAllTags]       = useState([])
  const [tagInput, setTagInput]     = useState('')
  const [tagSuggestions, setTagSuggestions] = useState([])
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)

  // Load predefined tags on mount
  useEffect(() => {
    api.tags().then(setAllTags).catch(() => {})
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Catalog search with debounce
  const handleTitleChange = useCallback((val) => {
    set('title', val)
    clearTimeout(searchRef.current)
    if (val.length < 2) { setSearchResults([]); setShowResults(false); return }
    setSearchLoading(true)
    searchRef.current = setTimeout(async () => {
      try {
        const results = await api.catalog.search(val)
        setSearchResults(results)
        setShowResults(results.length > 0)
      } catch { setSearchResults([]) }
      setSearchLoading(false)
    }, 400)
  }, [])

  // Select from catalog → auto-fill everything
  const selectCatalog = (entry) => {
    setForm(f => ({
      ...f,
      title: entry.title,
      issue_num: entry.issue_num || f.issue_num,
      publisher: entry.publisher || f.publisher,
      writer: entry.writer || f.writer,
      artist: entry.artist || f.artist,
      cover_image: entry.cover_image || f.cover_image,
      catalog_id: entry.id,
      tags: entry.tags ? entry.tags.split(',').map(t => t.trim()).filter(Boolean) : f.tags,
    }))
    setShowResults(false)

    // If catalog has no cover, try Open Library
    if (!entry.cover_image) {
      setFetching(true); setFetchMsg('Looking up cover…')
      fetchCoverImage(entry.title, entry.publisher).then(img => {
        if (img) { set('cover_image', img); setFetchMsg('✓ Cover found!') }
        else setFetchMsg('No cover found — colour used instead')
        setFetching(false)
      })
    } else {
      setFetchMsg('✓ Cover loaded from catalog')
    }
  }

  // Manual title (no catalog match) — try cover lookup
  const handleTitleBlur = () => {
    setTimeout(() => setShowResults(false), 200)
    if (!form.catalog_id && form.title.length >= 3 && !form.cover_image) {
      setFetching(true); setFetchMsg('Looking up cover…')
      fetchCoverImage(form.title, form.publisher).then(img => {
        if (img) { set('cover_image', img); setFetchMsg('✓ Cover found!') }
        else setFetchMsg('No cover found — colour used instead')
        setFetching(false)
      })
    }
  }

  // Tag handling
  const addTag = (tag) => {
    const clean = tag.toLowerCase().trim()
    if (clean && !form.tags.includes(clean)) {
      set('tags', [...form.tags, clean])
    }
    setTagInput('')
    setShowTagSuggestions(false)
  }
  const removeTag = (tag) => set('tags', form.tags.filter(t => t !== tag))

  const handleTagInputChange = (val) => {
    setTagInput(val)
    if (val.length > 0) {
      const matches = allTags.filter(t => t.includes(val.toLowerCase()) && !form.tags.includes(t))
      setTagSuggestions(matches.slice(0, 8))
      setShowTagSuggestions(matches.length > 0)
    } else {
      // Show all unselected tags when input is focused and empty
      setTagSuggestions(allTags.filter(t => !form.tags.includes(t)).slice(0, 12))
      setShowTagSuggestions(true)
    }
  }
  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (tagInput.trim()) addTag(tagInput)
    }
  }

  // Computed overall rating for display
  const rated = [form.rating_plot, form.rating_art, form.rating_writing].filter(r => r > 0)
  const overallRating = rated.length ? +(rated.reduce((a,b)=>a+b,0) / rated.length).toFixed(1) : 0

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true); setError('')
    try {
      await onSave({
        ...form,
        amazon_url: form.amazon_url || amazonUrl(form.title, form.publisher),
      })
    } catch (e) { setError(e.message); setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      backdropFilter: 'blur(4px)', padding: 0,
    }} onClick={e => e.target === e.currentTarget && onClose()}>

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

          {/* Cover preview + title/search block */}
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
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={lbl}>Search Comics *</label>
                <input
                  style={inp}
                  value={form.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  onBlur={handleTitleBlur}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  placeholder="Start typing a title…"
                  autoFocus={!isEdit}
                />
                {searchLoading && <p style={{ ...lbl, color: 'var(--muted)', marginTop: '0.2rem' }}>Searching catalog…</p>}
                {fetchMsg && <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', color: fetchMsg.startsWith('✓') ? '#2a9d4e' : 'var(--muted)', marginTop: '0.25rem', letterSpacing: '0.05em' }}>{fetchMsg}</p>}

                {/* Catalog search dropdown */}
                {showResults && searchResults.length > 0 && (
                  <div ref={dropdownRef} style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
                    background: 'var(--dark)', border: '2px solid var(--border)', borderRadius: '3px',
                    maxHeight: '220px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}>
                    {searchResults.map((r, i) => (
                      <button key={r.id || i}
                        onMouseDown={e => { e.preventDefault(); selectCatalog(r) }}
                        style={{
                          display: 'flex', gap: '0.6rem', alignItems: 'center',
                          width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                          padding: '0.55rem 0.75rem', cursor: 'pointer', textAlign: 'left', minHeight: 'unset',
                          color: 'var(--white)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--mid)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        {r.cover_image
                          ? <img src={r.cover_image} alt="" style={{ width: '28px', height: '40px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} />
                          : <div style={{ width: '28px', height: '40px', background: 'var(--border)', borderRadius: '2px', flexShrink: 0 }} />
                        }
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.title}{r.issue_num ? ` #${r.issue_num}` : ''}
                          </div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.62rem', color: 'var(--muted)' }}>
                            {[r.publisher, r.writer].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
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

          {/* Format */}
          <div>
            <label style={lbl}>Format</label>
            <select style={inp} value={form.format} onChange={e => set('format', e.target.value)}>
              <option value="single" style={{ background: 'var(--panel)' }}>Single Issue</option>
              <option value="trade" style={{ background: 'var(--panel)' }}>Trade Paperback</option>
              <option value="omnibus" style={{ background: 'var(--panel)' }}>Omnibus</option>
            </select>
          </div>

          {/* Publisher + Date */}
          <div className="form-row-2">
            <div>
              <label style={lbl}>Publisher</label>
              <input style={inp} value={form.publisher} onChange={e => set('publisher', e.target.value)} placeholder="Marvel, DC, Image…" list="pubs" />
              <datalist id="pubs">
                {['Marvel Comics','DC Comics','Image Comics','Dark Horse Comics','IDW Publishing','BOOM! Studios','Fantagraphics','Kodansha','Shueisha','Valiant Comics'].map(p => <option key={p} value={p} />)}
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

          {/* 3-Category Star Ratings */}
          <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'var(--mid)', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ ...lbl, marginBottom: 0 }}>Ratings</label>
              {overallRating > 0 && (
                <span style={{ fontFamily: "'Bangers', cursive", fontSize: '1rem', color: 'var(--yellow)' }}>
                  {overallRating} ★
                </span>
              )}
            </div>
            <StarRow label="Plot" value={form.rating_plot} hover={hoverPlot}
              onHover={setHoverPlot} onLeave={() => setHoverPlot(0)}
              onChange={v => set('rating_plot', v)} onClear={() => set('rating_plot', 0)} />
            <StarRow label="Art" value={form.rating_art} hover={hoverArt}
              onHover={setHoverArt} onLeave={() => setHoverArt(0)}
              onChange={v => set('rating_art', v)} onClear={() => set('rating_art', 0)} />
            <StarRow label="Writing" value={form.rating_writing} hover={hoverWriting}
              onHover={setHoverWriting} onLeave={() => setHoverWriting(0)}
              onChange={v => set('rating_writing', v)} onClear={() => set('rating_writing', 0)} />
          </div>

          {/* Review */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Review / Notes</label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: '72px', lineHeight: 1.55 }}
              value={form.review} onChange={e => set('review', e.target.value)}
              placeholder="What did you think?" />
          </div>

          {/* Tags — chip selector + autocomplete */}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <label style={lbl}>Tags</label>
            {/* Selected tags as chips */}
            {form.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                {form.tags.map(tag => (
                  <span key={tag} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    background: 'var(--dark)', border: '1px solid var(--border)', borderRadius: '3px',
                    padding: '0.2rem 0.5rem', fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--light)',
                  }}>
                    {tag}
                    <button onClick={() => removeTag(tag)} style={{
                      background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.7rem',
                      padding: 0, minHeight: 'unset', cursor: 'pointer', lineHeight: 1,
                    }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <input
              style={inp}
              value={tagInput}
              onChange={e => handleTagInputChange(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onFocus={() => handleTagInputChange(tagInput)}
              onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
              placeholder="Type or select tags…"
            />
            {showTagSuggestions && tagSuggestions.length > 0 && (
              <div style={{
                position: 'absolute', left: 0, right: 0, zIndex: 50,
                background: 'var(--dark)', border: '2px solid var(--border)', borderRadius: '3px',
                maxHeight: '140px', overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}>
                {tagSuggestions.map(tag => (
                  <button key={tag}
                    onMouseDown={e => { e.preventDefault(); addTag(tag) }}
                    style={{
                      display: 'block', width: '100%', background: 'none', border: 'none',
                      borderBottom: '1px solid var(--border)', padding: '0.45rem 0.75rem',
                      textAlign: 'left', cursor: 'pointer', minHeight: 'unset',
                      fontFamily: "'Barlow Condensed', sans-serif", fontSize: '0.72rem',
                      textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--light)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--mid)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >{tag}</button>
                ))}
              </div>
            )}
          </div>

          {/* Cover colour fallback */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={lbl}>Cover Colour (fallback)</label>
            <select style={inp} value={form.cover_color} onChange={e => set('cover_color', e.target.value)}>
              {COLORS.map(c => <option key={c.value} value={c.value} style={{ background: 'var(--panel)' }}>{c.label}</option>)}
            </select>
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
