/* BG Remover — cache AI model assets for faster repeat visits */
const CACHE = 'bg-remover-models-v1'
const MATCH =
  /staticimgly\.com|background-removal-data|ort-wasm|onnxruntime|\.wasm($|\?)/i

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (!MATCH.test(req.url)) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(req)
      if (cached) return cached
      try {
        const res = await fetch(req)
        if (res.ok) {
          cache.put(req, res.clone()).catch(() => {})
        }
        return res
      } catch (err) {
        if (cached) return cached
        throw err
      }
    })(),
  )
})
