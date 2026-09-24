import React, { useEffect, useState } from 'react'
import { api, STANDALONE } from './api.js'
import { C, fmt } from './theme.js'
import { Button, Card, Empty, ErrorBox, Heading, Input, Label, confirmDialog } from './ui.jsx'

export default function SettingsPage({ user }) {
  const [bio, setBio] = useState('')
  const [saved, setSaved] = useState(false)
  const [keys, setKeys] = useState([])
  const [label, setLabel] = useState('')
  const [fresh, setFresh] = useState(null)
  const [error, setError] = useState('')

  const loadKeys = () => api.keys().then(setKeys).catch(e => setError(e.message))
  useEffect(() => { loadKeys(); api.profile(user.username).then(p => setBio(p.bio || '')).catch(() => {}) }, [user.username])

  const saveBio = async e => { e.preventDefault(); await api.saveProfile(bio); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  const create = async e => {
    e.preventDefault(); setError('')
    try { setFresh(await api.createKey(label || 'API key')); setLabel(''); loadKeys() } catch (err) { setError(err.message) }
  }
  const revoke = async id => { if (await confirmDialog('Revoke this key? Anything using it will stop working.', 'Revoke')) { await api.revokeKey(id); loadKeys() } }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 18 }}>
      <Heading style={{ marginBottom: 0 }}>Settings</Heading>
      <Card style={{ padding: 16 }}>
        <form onSubmit={saveBio} style={{ display: 'grid', gap: 10 }}>
          <Label>Profile bio</Label>
          <Input value={bio} onChange={e => setBio(e.target.value)} maxLength={280} placeholder="Gooner. Over 2.5 merchant." />
          <div><Button type="submit">{saved ? '✓ Saved' : 'Save'}</Button></div>
        </form>
      </Card>
      {STANDALONE && (
        <Card style={{ padding: 16 }}>
          <Label>On-device demo</Label>
          <p style={{ fontSize: 14, color: C.text2, marginTop: 0, lineHeight: 1.6 }}>
            This copy of GameKnight runs entirely on your phone — the exchange, the market maker and the database live in this browser.
            Your account and trades are saved on this device only. Matches settle with simulated scores two hours after kick-off, and new fixtures appear as old ones finish.
          </p>
          <Button kind="danger" onClick={async () => { if (await confirmDialog('Wipe this device\'s GameKnight data and start fresh?', 'Reset')) (await import('./standalone.js')).resetDemo() }}>Reset demo</Button>
        </Card>
      )}
      {!STANDALONE && <Card style={{ padding: 16 }}>
        <Label>API keys</Label>
        <p style={{ fontSize: 14, color: C.text2, marginTop: 0 }}>
          Trade programmatically — run a market-making bot, hedge from a spreadsheet, build an integration. Send the key as an
          <code style={{ background: C.bg, padding: '1px 5px', borderRadius: 4, margin: '0 4px' }}>X-API-Key</code> header. See the <a href="#/docs" style={{ color: C.accent }}>API docs</a>.
        </p>
        <form onSubmit={create} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label, e.g. market-maker-bot" maxLength={40} />
          <Button type="submit" style={{ whiteSpace: 'nowrap' }}>Create key</Button>
        </form>
        <ErrorBox>{error}</ErrorBox>
        {fresh && (
          <div style={{ background: C.yesBg, border: `1px solid ${C.yes}55`, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Copy your new key now — it won't be shown again.</div>
            <code style={{ display: 'block', background: C.bg, padding: 8, borderRadius: 6, overflowWrap: 'anywhere', fontSize: 13 }}>{fresh.key}</code>
            <button onClick={() => navigator.clipboard?.writeText(fresh.key).catch(() => {})} style={{ marginTop: 8, background: 'none', border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Copy</button>
          </div>
        )}
        {!keys.length && <Empty>No API keys yet.</Empty>}
        {keys.map(k => (
          <div key={k.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: `1px solid ${C.line}`, fontSize: 14 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{k.label} <code style={{ color: C.muted }}>{k.prefix}…</code></div>
              <div style={{ fontSize: 12, color: C.muted }}>Created {fmt.date(k.created_at)} · {k.last_used_at ? `last used ${fmt.ago(k.last_used_at)}` : 'never used'}</div>
            </div>
            <Button kind="danger" onClick={() => revoke(k.id)} style={{ padding: '6px 12px' }}>Revoke</Button>
          </div>
        ))}
      </Card>}
    </div>
  )
}
