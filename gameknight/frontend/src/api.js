// All API calls. Money and prices are integer cents on the wire (100¢ = 1 KC).
const BASE = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'gk_token'

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken = t => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch {} }

async function request(method, path, body) {
  const token = getToken()
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error("Can't reach the GameKnight server")
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return data
}

const qs = o => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString()

export const api = {
  register: (username, password) => request('POST', '/auth/register', { username, password }),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/me'),
  claimBonus: () => request('POST', '/me/bonus'),
  saveProfile: bio => request('PUT', '/me/profile', { bio }),
  keys: () => request('GET', '/keys'),
  createKey: label => request('POST', '/keys', { label }),
  revokeKey: id => request('DELETE', `/keys/${id}`),

  stats: () => request('GET', '/stats'),
  categories: () => request('GET', '/categories'),
  events: params => request('GET', `/events?${qs(params)}`),
  event: slug => request('GET', `/events/${encodeURIComponent(slug)}`),
  history: (id, range) => request('GET', `/events/${id}/history?${qs({ range })}`),
  activity: id => request('GET', id ? `/events/${id}/activity` : '/activity'),
  comments: id => request('GET', `/events/${id}/comments`),
  postComment: (id, body) => request('POST', `/events/${id}/comments`, { body }),
  book: marketId => request('GET', `/markets/${marketId}/book`),
  holders: marketId => request('GET', `/markets/${marketId}/holders`),

  preview: order => request('POST', '/orders/preview', order),
  placeOrder: order => request('POST', '/orders', order),
  orders: () => request('GET', '/orders'),
  cancelOrder: id => request('DELETE', `/orders/${id}`),

  portfolio: () => request('GET', '/portfolio'),
  profile: username => request('GET', `/users/${encodeURIComponent(username)}`),
  leaderboard: (by, period) => request('GET', `/leaderboard?${qs({ by, period })}`),

  admin: {
    createMatch: body => request('POST', '/admin/events/match', body),
    createOutright: body => request('POST', '/admin/events/outright', body),
    resolve: (id, body) => request('POST', `/admin/events/${id}/resolve`, body),
    resolveMarket: (id, outcome) => request('POST', `/admin/markets/${id}/resolve`, { outcome }),
    voidEvent: id => request('POST', `/admin/events/${id}/void`),
    syncFeed: () => request('POST', '/admin/feed/sync'),
    health: () => request('GET', '/admin/health'),
  },
}

// One shared Server-Sent Events connection; components subscribe to live updates.
const listeners = new Set()
let source = null
export function subscribe(fn) {
  listeners.add(fn)
  if (!source && typeof EventSource !== 'undefined') {
    source = new EventSource(`${BASE}/stream`)
    source.onmessage = e => { try { const msg = JSON.parse(e.data); listeners.forEach(l => l(msg)) } catch {} }
  }
  return () => listeners.delete(fn)
}
