import React, { useState } from 'react'
import { api } from './api.js'
import { C, display } from './theme.js'
import { Button, Card, ErrorBox, Input, Label } from './ui.jsx'

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('register')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      onAuth(await (mode === 'register' ? api.register(username, password) : api.login(username, password)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, alignItems: 'center', minHeight: '60vh' }}>
      <div>
        <div style={{ ...display, fontSize: 'clamp(44px, 8vw, 72px)', fontWeight: 800, lineHeight: 0.95, textTransform: 'uppercase' }}>
          Back your<br />football <span style={{ color: C.accent }}>brain.</span>
        </div>
        <p style={{ color: C.text2, fontSize: 17, lineHeight: 1.55, maxWidth: 460, marginTop: 20 }}>
          GameKnight is a prediction exchange for football. Buy YES or NO on results, goals and title races —
          each winning share pays <strong style={{ color: C.text }}>1 KC</strong>. Prices are set by fans on a live order book,
          so a share at 62¢ means the market thinks it's a 62% shot.
        </p>
        <ul style={{ color: C.text2, fontSize: 15, lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
          <li>Start with <strong style={{ color: C.text }}>1,000 Knight Coins</strong>, +100 every day</li>
          <li>7 markets on every fixture + season outrights (title, Champions League, Golden Boot)</li>
          <li>Market and limit orders, sell any time before kick-off</li>
          <li>Deep liquidity from day one — our market maker quotes every market</li>
          <li>Public API for bots and market makers</li>
        </ul>
      </div>

      <Card style={{ padding: 24, maxWidth: 420, width: '100%', justifySelf: 'center' }}>
        <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 10, padding: 4, marginBottom: 20 }}>
          {[['register', 'Create account'], ['login', 'Sign in']].map(([m, t]) => (
            <button key={m} onClick={() => { setMode(m); setError('') }} style={{
              flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              background: mode === m ? C.surface2 : 'transparent', color: mode === m ? C.text : C.muted,
            }}>{t}</button>
          ))}
        </div>
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" placeholder="e.g. TheGaffer" required />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder={mode === 'register' ? 'At least 8 characters' : ''} required />
          </div>
          <ErrorBox>{error}</ErrorBox>
          <Button type="submit" disabled={busy} style={{ padding: '12px 16px', fontSize: 15 }}>
            {busy ? '…' : mode === 'register' ? 'Kick off — claim 1,000 KC' : 'Sign in'}
          </Button>
          <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.5 }}>
            Play money only. Knight Coins have no cash value and can't be purchased or withdrawn.
          </p>
        </form>
      </Card>
    </div>
  )
}
