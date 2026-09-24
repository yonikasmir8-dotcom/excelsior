import React, { useState } from 'react'
import { api } from './api.js'
import { C, display, fmt } from './theme.js'
import { Button, ErrorBox, GradientRule, Input, LOGO } from './ui.jsx'

const PILLARS = [
  ['Simple Yes/No', 'Back an opinion in two taps. No betting-slip clutter.'],
  ['Insights', 'Data-backed reads on every match, from live prices and our goals model.'],
  ['Tailored', 'Follow your #teams, #players and #leagues.'],
  ['Complete stack', 'Fixtures calendar, news and opinions in one place.'],
  ['Shareable', 'Invite mates to a match and share your winning calls.'],
  ['Transparent', 'Profit, invested and closing value on every opinion.'],
]

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('register')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setBusy(true); setError('')
    try { onAuth(await (mode === 'register' ? api.register(username, password) : api.login(username, password))) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 26 }}>
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        <img src={LOGO} alt="Game Knight" style={{ height: 150, width: 'auto' }} />
        <div style={{ ...display, fontSize: 38, color: '#d9d9d9', marginTop: 10 }}>Game Knight</div>
        <GradientRule />
        <div style={{ fontWeight: 700, color: '#d9d9d9', fontSize: 17 }}>Your Insights. Your Opinions. Your Win!</div>
        <p style={{ color: C.muted, fontSize: 15, lineHeight: 1.55, maxWidth: 460, margin: '14px auto 0' }}>
          The one-stop platform for everything football. Back your opinions on every result, scoreline and title race,
          and turn real-time insight into wins with your mates.
        </p>
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gap: 10, background: C.surface, border: `1px solid ${C.line}`, padding: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
          {[['register', 'Create account'], ['login', 'Sign in']].map(([m, t]) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError('') }} style={{
              padding: '9px 0', border: `1px solid ${mode === m ? C.accent : C.text}`, background: mode === m ? C.accent : 'transparent',
              color: C.text, fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>
        <Input light value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" placeholder="Username" aria-label="Username" required />
        <Input light type="password" value={password} onChange={e => setPassword(e.target.value)} aria-label="Password"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'} required />
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" kind="buy" disabled={busy} style={{ padding: '13px 16px', fontSize: 16 }}>
          {busy ? '…' : mode === 'register' ? `Kick off with ${fmt.kc(100000)}` : 'Sign in'}
        </Button>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Knight Coins are play money with no cash value. Plus {fmt.kc(10000)} free every day.</div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1, background: C.line, border: `1px solid ${C.line}` }}>
        {PILLARS.map(([t, d]) => (
          <div key={t} style={{ background: C.bg, padding: '12px 14px' }}>
            <div style={{ ...display, fontSize: 16 }}>{t}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>{d}</div>
          </div>
        ))}
      </div>

      <blockquote style={{ margin: 0, textAlign: 'right' }}>
        <div style={{ ...display, fontSize: 20 }}>Football isn't a game, nor a sport; it's a religion.</div>
        <div style={{ color: C.muted, marginTop: 4 }}>Diego Maradona</div>
      </blockquote>
    </div>
  )
}
