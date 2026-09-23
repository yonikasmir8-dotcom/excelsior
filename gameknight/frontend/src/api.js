// All API calls. The session token lives in localStorage; every request sends it.
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

export const api = {
  register: (username, password) => request('POST', '/auth/register', { username, password }),
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/me'),
  claimBonus: () => request('POST', '/me/bonus'),

  competitions: () => request('GET', '/competitions'),
  fixtures: (state = 'open', competition) =>
    request('GET', `/fixtures?state=${state}${competition ? `&competition=${encodeURIComponent(competition)}` : ''}`),
  fixture: id => request('GET', `/fixtures/${id}`),
  quote: (marketId, body) => request('POST', `/markets/${marketId}/quote`, body),
  trade: (marketId, body) => request('POST', `/markets/${marketId}/trade`, body),

  portfolio: () => request('GET', '/portfolio'),
  leaderboard: () => request('GET', '/leaderboard'),
  activity: () => request('GET', '/activity'),

  createFixture: body => request('POST', '/admin/fixtures', body),
  settle: (id, home_score, away_score) => request('POST', `/admin/fixtures/${id}/settle`, { home_score, away_score }),
  voidFixture: id => request('POST', `/admin/fixtures/${id}/void`),
}
