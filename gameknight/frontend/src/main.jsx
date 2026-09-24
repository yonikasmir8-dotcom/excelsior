import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { STANDALONE } from './api.js'
import { loadConfig } from './config.js'

async function main() {
  if (STANDALONE) {
    try {
      await (await import('./standalone.js')).start()
    } catch (e) {
      document.getElementById('boot').textContent = `Couldn't start GameKnight on this device: ${e.message}`
      throw e
    }
  }
  await loadConfig()
  createRoot(document.getElementById('root')).render(<App />)
}
main()

// Installable PWA + offline app shell for the hosted version
if (!STANDALONE && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
