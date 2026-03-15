const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const TAG  = import.meta.env.VITE_AMAZON_TAG || 'excelsior-20'

// Called with a getToken function from useAuth()
async function req(path, getToken, opts = {}) {
  const token = await getToken()
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {})
    }
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const api = {
  comics: {
    list:   (gt, shelf)    => req('/comics' + (shelf && shelf !== 'all' ? `?shelf=${shelf}` : ''), gt),
    get:    (gt, id)       => req(`/comics/${id}`, gt),
    create: (gt, data)     => req('/comics', gt, { method: 'POST', body: JSON.stringify(data) }),
    update: (gt, id, data) => req(`/comics/${id}`, gt, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (gt, id)       => req(`/comics/${id}`, gt, { method: 'DELETE' }),
  },
  stats: (gt) => req('/stats', gt),
  alias: {
    mine:   (gt)           => req('/alias/mine', gt),
    set:    (gt, alias)    => req('/alias', gt, { method: 'POST', body: JSON.stringify({ alias }) }),
    check:  (alias)        => fetch(`${BASE}/alias/check/${alias}`).then(r => r.json()),
  }
}

// Open Library cover lookup (free, commercial-friendly)
export async function fetchCoverImage(title, author = '') {
  try {
    const q = encodeURIComponent(`${title} ${author} comic`.trim())
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&fields=cover_i,title&limit=3`)
    const data = await res.json()
    const hit = data.docs?.find(d => d.cover_i)
    if (hit?.cover_i) return `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`
    return null
  } catch {
    return null
  }
}

// Amazon affiliate search URL
export function amazonUrl(title, publisher = '') {
  const query = encodeURIComponent(`${title} ${publisher} comic book`.trim())
  return `https://www.amazon.com/s?k=${query}&tag=${TAG}&i=stripbooks`
}

export function starsHtml(n) {
  return Array.from({length: 5}, (_, i) => i < n ? '★' : '☆').join('')
}

// Public profile (no auth token needed)
export const publicApi = {
  profile: (alias) => fetch(`${BASE}/profile/${alias}`).then(r => {
    if (r.status === 404) throw Object.assign(new Error('Not found'), { status: 404 })
    return r.json()
  })
}

// ── Social API ─────────────────────────────────────────────────────────────────
export const social = {
  follow:     (gt, alias)  => req(`/follow/${alias}`, gt, { method: 'POST' }),
  unfollow:   (gt, alias)  => req(`/follow/${alias}`, gt, { method: 'DELETE' }),
  following:  (gt)         => req('/following', gt),
  followers:  (gt)         => req('/followers', gt),
  feed:       (gt)         => req('/feed', gt),
  notifCount: (gt)         => req('/notifications/count', gt),
  notifs:     (gt)         => req('/notifications', gt),
}
