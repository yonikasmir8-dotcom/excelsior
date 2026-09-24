// Minimal service worker: makes GameKnight installable and keeps the app shell
// available offline. API calls always go to the network (prices must be live).
const CACHE = 'gk-shell-v1'
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png']))); self.skipWaiting() })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim() })
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone()
    caches.open(CACHE).then(c => c.put(e.request, copy))
    return res
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/'))))
})
