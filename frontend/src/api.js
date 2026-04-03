// Ensure BASE always ends with /api (Vercel env may omit it)
const _raw = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
const BASE = _raw.endsWith('/api') ? _raw : _raw.replace(/\/$/, '') + '/api'
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
    list:   (gt, shelf, { limit=50, offset=0 }={}) => {
      const params = new URLSearchParams()
      if (shelf && shelf !== 'all') params.set('shelf', shelf)
      if (limit !== 50) params.set('limit', limit)
      if (offset) params.set('offset', offset)
      const qs = params.toString()
      return req('/comics' + (qs ? `?${qs}` : ''), gt)
    },
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
  },
  catalog: {
    search: (q) => fetch(`${BASE}/catalog/search?q=${encodeURIComponent(q)}`).then(r => r.json()),
    get:    (id) => fetch(`${BASE}/catalog/${id}`).then(r => r.json()),
    ratings:(id) => fetch(`${BASE}/catalog/${id}/ratings`).then(r => r.json()),
  },
  tags: () => fetch(`${BASE}/tags`).then(r => r.json()),
  similarRaters: (gt) => req('/similar-raters', gt),
  trending: () => fetch(`${BASE}/trending`).then(r => r.json()),
  globalFeed: (offset=0) => fetch(`${BASE}/feed/global?offset=${offset}`).then(r => r.json()),
  recommendations: (gt) => req('/recommendations', gt),
  wishlist: (alias) => fetch(`${BASE}/wishlist/${alias}`).then(r => r.json()),
  search: (q, type='all') => fetch(`${BASE}/search?q=${encodeURIComponent(q)}&type=${type}`).then(r => r.json()),
  characters: {
    search: (q) => fetch(`${BASE}/characters/search?q=${encodeURIComponent(q)}`).then(r => r.json()),
  },
  series: {
    list: (q='', offset=0) => fetch(`${BASE}/series?q=${encodeURIComponent(q)}&offset=${offset}`).then(r => r.json()),
    get:  (title, publisher='') => fetch(`${BASE}/series/${encodeURIComponent(title)}?publisher=${encodeURIComponent(publisher)}`).then(r => r.json()),
  },
  eras: () => fetch(`${BASE}/eras`).then(r => r.json()),
  comicCharacters: (id) => fetch(`${BASE}/comics/${id}/characters`).then(r => r.json()),
  detailedStats: (gt) => req('/stats/detailed', gt),
  profileStats: (alias) => fetch(`${BASE}/profile/${alias}/stats`).then(r => r.json()),
  comments: {
    list:   (comicId)         => fetch(`${BASE}/comics/${comicId}/comments`).then(r => r.json()),
    add:    (gt, comicId, body, parentId) => req(`/comics/${comicId}/comments`, gt, { method: 'POST', body: JSON.stringify({ body, parent_id: parentId }) }),
    react:  (gt, commentId, type) => req(`/comments/${commentId}/react`, gt, { method: 'POST', body: JSON.stringify({ type }) }),
    delete: (gt, commentId) => req(`/comments/${commentId}`, gt, { method: 'DELETE' }),
  },
  social: (comicId) => fetch(`${BASE}/comics/${comicId}/social`).then(r => r.json()),
  repost: (gt, comicId) => req(`/comics/${comicId}/repost`, gt, { method: 'POST' }),
}

// Cover lookup via server proxy (caches results, avoids slow direct Open Library calls)
export async function fetchCoverImage(title, author = '') {
  try {
    const params = new URLSearchParams({ title, author })
    const res = await fetch(`${BASE}/cover-lookup?${params}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.cover || null
  } catch {
    return null
  }
}

// Amazon affiliate search URL
export function amazonUrl(title, issueNum = '', publisher = '') {
  const parts = [title]
  if (issueNum) parts.push(`#${issueNum}`)
  if (publisher) parts.push(publisher)
  const query = encodeURIComponent(parts.join(' ').trim())
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
  feed:       (gt, offset=0) => req(`/feed?offset=${offset}`, gt),
  notifCount: (gt)         => req('/notifications/count', gt),
  notifs:     (gt, offset=0) => req(`/notifications?offset=${offset}`, gt),
}
