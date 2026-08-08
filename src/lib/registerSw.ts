/** Register service worker (browser only) for model CDN caching */
export function registerModelCacheSw(): void {
  if (typeof window === 'undefined') return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  if (typeof document === 'undefined') return

  const ok =
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1'
  if (!ok) return

  const run = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* private mode / blocked */
    })
  }

  if (document.readyState === 'complete') {
    run()
  } else {
    window.addEventListener('load', run, { once: true })
  }
}
