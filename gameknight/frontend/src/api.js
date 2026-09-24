// All API calls. Money and prices are integer cents on the wire (100¢ = 1 KC).
const BASE = import.meta.env.VITE_API_URL || '/api'
// Standalone build: the whole backend runs inside this tab (see standalone.js)
export const STANDALONE = import.meta.env.VITE_STANDALONE === 'true'
const TOKEN_KEY = 'gk_token'

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } }
export const setToken = t => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch {} }

async function request(method, path, body) {
  const token = getToken()
  if (STANDALONE) {
    const { localFetch } = await import('./standalone.js')
    const r = await localFetch(method, path, body, token)
    if (r.status >= 400) {
      const err = new Error(r.body?.error || `Request failed (${r.status})`)
      err.status = r.status
      throw err
    }
    return r.body
  }
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
  config: () => request('GET', '/config'),
  wallet: () => request('GET', '/wallet'),
  deposit: (amount, method) => request('POST', '/wallet/deposits', { amount, method, idempotency_key: `dep_${Date.now()}_${Math.random().toString(36).slice(2)}` }),
  withdraw: amount => request('POST', '/wallet/withdrawals', { amount }),
  verifyIdentity: body => request('POST', '/kyc', body),
  setLimits: limits => request('PUT', '/rg/limits', limits),
  takeBreak: hours => request('POST', '/rg/break', { hours }),
  selfExclude: months => request('POST', '/rg/self-exclude', { months }),
  tags: () => request('GET', '/tags'),
  follows: () => request('GET', '/me/follows'),
  follow: tag => request('POST', '/me/follows', { tag }),
  unfollow: tag => request('DELETE', `/me/follows?tag=${encodeURIComponent(tag)}`),
  news: () => request('GET', '/news'),
  insights: params => request('GET', `/insights?${qs(params || {})}`),
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
    finance: () => request('GET', '/admin/finance'),
    flags: () => request('GET', '/admin/audit?flags=1'),
  },
}

// One shared Server-Sent Events connection; components subscribe to live updates.
const listeners = new Set()
let source = null
export function subscribe(fn) {
  listeners.add(fn)
  if (STANDALONE && !source) {
    source = true
    import('./standalone.js').then(m => m.onMessage(msg => listeners.forEach(l => l(msg))))
  } else if (!source && typeof EventSource !== 'undefined') {
    source = new EventSource(`${BASE}/stream`)
    source.onmessage = e => { try { const msg = JSON.parse(e.data); listeners.forEach(l => l(msg)) } catch {} }
  }
  return () => listeners.delete(fn)
}
