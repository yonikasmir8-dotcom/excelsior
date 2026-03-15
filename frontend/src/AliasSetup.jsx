import { useState, useEffect, useCallback } from 'react'
import { useAuth, useUser } from '@clerk/react'
import { api } from './api.js'

const ALIASES = [
  'NightReader','PanelPusher','InkSlinger','CapeChaser','IssueHunter',
  'SpiderPages','BatmanFan42','MarvelMaven','DCDetective','GothamReader',
  'XManiac','ThanosFan','VenomVault','GreenArrow','FlashCollector',
]

export default function AliasSetup({ onComplete, onSkip }) {
  const { getToken } = useAuth()
  const { user } = useUser()
  const [alias, setAlias] = useState('')
  const [status, setStatus] = useState(null) // null | 'checking' | 'available' | 'taken' | 'error'
  const [saving, setSaving] = useState(false)
  const suggestion = ALIASES[Math.floor(Math.random() * ALIASES.length)]

  const checkAlias = useCallback(async (val) => {
    if (!val || val.length < 2) { setStatus(null); return }
    setStatus('checking')
    try {
      const clean = val.toLowerCase().replace(/[^a-z0-9_-]/g, '')
      const { available } = await api.alias.check(clean)
      setStatus(available ? 'available' : 'taken')
    } catch { setStatus('error') }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => checkAlias(alias), 500)
    return () => clearTimeout(t)
  }, [alias, checkAlias])

  const handleSave = async () => {
    if (status !== 'available' || saving) return
    setSaving(true)
    try {
      await api.alias.set(getToken, alias.toLowerCase().replace(/[^a-z0-9_-]/g,''))
      onComplete()
    } catch (e) {
      setStatus('error')
    } finally { setSaving(false) }
  }

  const statusColor = { available:'#2a9d4e', taken:'var(--red)', checking:'var(--muted)', error:'var(--red)' }
  const statusText  = { available:'✓ That identity is available!', taken:'✗ Already taken — try another', checking:'Checking…', error:'Something went wrong' }

  return (
    <div style={{
      minHeight:'100vh', background:'var(--ink)', backgroundImage:'var(--halftone)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'2rem', gap:'2rem',
    }}>
      <div className="anim-up" style={{ textAlign:'center' }}>
        <div style={{
          fontFamily:"'Bangers', cursive", fontSize:'clamp(2.5rem,6vw,4rem)',
          color:'var(--yellow)', textShadow:'3px 3px 0 var(--red)', lineHeight:1,
        }}>EXCELSIOR!</div>
      </div>

      <div className="anim-up" style={{
        animationDelay:'0.05s', background:'var(--panel)', border:'2px solid var(--border)',
        borderTop:'4px solid var(--red)', borderRadius:'4px', padding:'2.5rem',
        maxWidth:'440px', width:'100%', boxShadow:'6px 6px 0 rgba(0,0,0,0.5)',
      }}>
        {/* Mask icon */}
        <div style={{ fontSize:'3.5rem', textAlign:'center', marginBottom:'1rem' }}>🦸</div>

        <h2 style={{
          fontFamily:"'Bangers', cursive", fontSize:'1.8rem', color:'var(--yellow)',
          textShadow:'2px 2px 0 var(--red)', letterSpacing:'0.04em', textAlign:'center',
          marginBottom:'0.5rem',
        }}>
          Choose Your Secret Identity
        </h2>
        <p style={{
          fontFamily:"'Barlow Condensed', sans-serif", fontSize:'0.82rem',
          color:'var(--muted)', textAlign:'center', letterSpacing:'0.06em',
          marginBottom:'1.75rem', lineHeight:1.6,
        }}>
          Every hero needs an alias. This is the name the world will know you by on Excelsior!
          Choose wisely — it's permanent.
        </p>

        {/* Input */}
        <div style={{ marginBottom:'0.5rem' }}>
          <label style={{
            display:'block', fontFamily:"'Barlow Condensed', sans-serif",
            fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase',
            letterSpacing:'0.1em', color:'var(--muted)', marginBottom:'0.4rem',
          }}>Your alias</label>
          <div style={{ position:'relative' }}>
            <input
              value={alias}
              onChange={e => setAlias(e.target.value.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,30))}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder={suggestion}
              maxLength={30}
              style={{
                width:'100%', background:'var(--mid)', border:'2px solid var(--border)',
                borderRadius:'3px', fontSize:'1rem', color:'var(--white)',
                padding:'0.65rem 0.85rem', outline:'none',
                borderColor: status === 'available' ? '#2a9d4e' : status === 'taken' ? 'var(--red)' : 'var(--border)',
                transition:'border-color 0.2s',
              }}
            />
            <span style={{
              position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)',
              fontFamily:"'Barlow Condensed', sans-serif", fontSize:'0.6rem',
              color:'var(--muted)', letterSpacing:'0.06em',
            }}>{alias.length}/30</span>
          </div>
          {status && (
            <p style={{
              fontFamily:"'Barlow Condensed', sans-serif", fontSize:'0.7rem',
              color: statusColor[status], marginTop:'0.4rem', letterSpacing:'0.06em',
            }}>{statusText[status]}</p>
          )}
        </div>

        <p style={{
          fontFamily:"'Barlow Condensed', sans-serif", fontSize:'0.65rem',
          color:'var(--muted)', letterSpacing:'0.06em', marginBottom:'1.5rem',
        }}>
          Letters, numbers, _ and - only. No spaces.
        </p>

        <button
          onClick={handleSave}
          disabled={status !== 'available' || saving}
          style={{
            width:'100%', background: status === 'available' ? 'var(--red)' : 'var(--border)',
            color: status === 'available' ? 'var(--white)' : 'var(--muted)',
            border:'none', borderBottom: status === 'available' ? '3px solid var(--red-dark)' : 'none',
            fontFamily:"'Bangers', cursive", fontSize:'1.1rem', letterSpacing:'0.08em',
            padding:'0.75rem', borderRadius:'3px', transition:'all 0.2s',
            cursor: status === 'available' ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Claiming identity…' : 'Claim This Identity ⚡'}
        </button>

        <div style={{ marginTop:'1.25rem', textAlign:'center' }}>
          <button onClick={onSkip || onComplete} style={{
            background:'none', border:'none', color:'var(--muted)',
            fontFamily:"'Barlow Condensed', sans-serif", fontSize:'0.7rem',
            letterSpacing:'0.08em', textTransform:'uppercase', cursor:'pointer',
            textDecoration:'underline',
          }}>
            Skip for now
          </button>
        </div>
      </div>

      <p className="anim-up" style={{
        animationDelay:'0.15s',
        fontFamily:"'Barlow Condensed', sans-serif", fontSize:'0.7rem',
        color:'#444', letterSpacing:'0.1em', textTransform:'uppercase',
        textAlign:'center',
      }}>
        Welcome, {user?.firstName || 'hero'} — your collection awaits
      </p>
    </div>
  )
}
