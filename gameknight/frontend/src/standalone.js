// Standalone (phone/offline) runtime: boots the real backend in this browser tab and
// persists its SQLite database to IndexedDB. Only bundled in `--mode standalone`.
import { boot } from '../../standalone/.build/backend.js'
import { BUILT_AT, SEED_B64 } from '../../standalone/.build/seed.js'
import { CRESTS_INLINE, CRESTS_ONLY } from '../../standalone/.build/crests-inline.js'

// Embedded crests (sandboxed viewers block external images)
globalThis.__GK_CRESTS = CRESTS_INLINE
globalThis.__GK_CRESTS_ONLY = CRESTS_ONLY

const DB_NAME = 'gameknight', STORE = 'db', KEY = 'main'
let rt = null
let saveTimer = null

function idb(mode, fn) {
  return new Promise(resolve => {
    try {
      const open = indexedDB.open(DB_NAME, 1)
      open.onupgradeneeded = () => open.result.createObjectStore(STORE)
      open.onerror = () => resolve(null)
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction(STORE, mode)
          const req = fn(tx.objectStore(STORE))
          tx.oncomplete = () => resolve(req?.result ?? null)
          tx.onerror = () => resolve(null)
        } catch { resolve(null) }
      }
    } catch { resolve(null) }
  })
}

async function gunzip(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { if (rt) idb('readwrite', s => s.put(rt.exportDb(), KEY)) }, 1500)
}

export async function start() {
  const saved = await idb('readonly', s => s.get(KEY))
  const dbBytes = saved ? new Uint8Array(saved) : await gunzip(SEED_B64)
  rt = await boot({ dbBytes, builtAt: BUILT_AT, fresh: !saved })
  for (const t of ['trade', 'event']) rt.bus.on(t, scheduleSave)
  scheduleSave()
  window.addEventListener('pagehide', () => { clearTimeout(saveTimer); if (rt) idb('readwrite', s => s.put(rt.exportDb(), KEY)) })
}

export async function localFetch(method, path, body, token) {
  const r = await rt.handle({ method, url: `/api${path}`, headers: token ? { authorization: `Bearer ${token}` } : {}, body })
  if (method !== 'GET') scheduleSave()
  return r
}

export function onMessage(fn) {
  const types = ['trade', 'book', 'event', 'comment']
  const hs = types.map(type => { const h = p => fn({ type, ...p }); rt.bus.on(type, h); return [type, h] })
  return () => hs.forEach(([t, h]) => rt.bus.off(t, h))
}

export async function resetDemo() {
  clearTimeout(saveTimer)
  rt = null
  await idb('readwrite', s => s.delete(KEY))
  try { localStorage.removeItem('gk_token') } catch {}
  location.hash = '/'
  location.reload()
}
