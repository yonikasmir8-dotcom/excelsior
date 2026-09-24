// Platform config from /api/config, loaded once before the first render (main.jsx)
import { api } from './api.js'
import { setCurrency } from './theme.js'

export const CONFIG = { mode: 'play', symbol: '₭', currency: 'KC', fee_bps: 0, starting_balance: 100000, daily_bonus: 10000, operator: null, licence: null, min_deposit: 500, min_withdrawal: 1000 }
export const isReal = () => CONFIG.mode === 'real'

export async function loadConfig() {
  try { Object.assign(CONFIG, await api.config()) } catch { /* offline: keep play defaults */ }
  setCurrency(CONFIG.symbol)
  return CONFIG
}
